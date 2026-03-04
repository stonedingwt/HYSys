import asyncio
import base64
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Union, List, Type, Tuple
from urllib.parse import unquote
from uuid import uuid4

import aiofiles
from fastapi import APIRouter, BackgroundTasks, Body, Depends, File, Request, UploadFile
from fastapi.responses import StreamingResponse
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, SystemMessage
from loguru import logger
from sse_starlette import EventSourceResponse

from mep.api.services import knowledge_imp
from mep.api.services.audit_log import AuditLogService
from mep.api.services.knowledge import KnowledgeService
from mep.api.services.workflow import WorkFlowService
from mep.api.services.workstation import (WorkstationConversation,
                                              WorkstationMessage, WorkStationService)
from mep.api.v1.schema.chat_schema import APIChatCompletion, SSEResponse, delta
from mep.api.v1.schemas import FrequentlyUsedChat
from mep.api.v1.schemas import WorkstationConfig, resp_200, ExcelRule, UnifiedResponseModel
from mep.chat.utils import SourceType, process_source_document
from mep.common.constants.enums.telemetry import BaseTelemetryTypeEnum, ApplicationTypeEnum
from mep.common.dependencies.user_deps import UserPayload
from mep.common.errcode import BaseErrorCode
from mep.common.errcode.http_error import ServerError, UnAuthorizedError
from mep.common.errcode.workstation import WebSearchToolNotFoundError, ConversationNotFoundError, \
    AgentAlreadyExistsError
from mep.common.schemas.telemetry.event_data_schema import NewMessageSessionEventData, ApplicationAliveEventData, \
    ApplicationProcessEventData
from mep.common.services import telemetry_service
from mep.common.services.config_service import settings as mep_settings
from mep.core.cache.redis_manager import get_redis_client
from mep.core.cache.utils import save_download_file, save_uploaded_file, async_file_download
from mep.core.logger import trace_id_var
from mep.core.prompts.manager import get_prompt_manager
from mep.database.models.flow import FlowDao, FlowType
from mep.database.models.message import ChatMessage, ChatMessageDao
from mep.database.models.session import MessageSession, MessageSessionDao
from mep.llm.domain import LLMService
from mep.llm.domain.llm import MEPLLM
from mep.share_link.api.dependencies import header_share_token_parser
from mep.share_link.domain.models.share_link import ShareLink
from mep.tool.domain.models.gpts_tools import GptsToolsDao
from mep.tool.domain.services.executor import ToolExecutor
from mep.utils import get_request_ip
from mep.worker.workflow.redis_callback import RedisCallback
from mep.worker.workflow.tasks import execute_workflow, continue_workflow, workflow_stateful_worker
from mep.workflow.common.workflow import WorkflowStatus
from mep.api.v1.schema.workflow import WorkflowEventType

router = APIRouter(prefix='/workstation', tags=['WorkStation'])

titleInstruction = 'a concise, 5-word-or-less title for the conversation, using its same language, with no punctuation. Apply title case conventions appropriate for the language. Never directly mention the language name or the word "title"'  # noqa
promptSearch = '用户的问题是：%s \
判断用户的问题是否需要联网搜索，如果需要返回数字1，如果不需要返回数字0。只返回1或0，不要返回其他信息。\
如果问题涉及到实时信息、最新事件或特定数据库查询等超出你知识截止日期（2024年7月）的内容，就需要进行联网搜索来获取最新信息。'

visual_model_file_types = ['png', 'jpg', 'jpeg', 'webp', 'gif']

# Customizable JSON Serializer
def custom_json_serializer(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()  # Convert To ISO 8601 Format String
    raise TypeError(f'Type {type(obj)} not serializable')


def user_message(msgId, conversationId, sender, text):
    msg = json.dumps({
        'message': {
            'messageId': msgId,
            'conversationId': conversationId,
            'sender': sender,
            'text': text
        },
        'created': True
    })
    return f'event: message\ndata: {msg}\n\n'


def step_message(stepId, runId, index, msgId):
    msg = json.dumps({
        'event': 'on_run_step',
        'data': {
            'id': stepId,
            'runId': runId,
            'type': 'message_creation',
            'index': index,
            'stepDetails': {
                'type': 'message_creation',
                'message_creation': {
                    'message_id': msgId
                }
            }
        }
    })
    return f'event: message\ndata: {msg}\n\n'


async def final_message(conversation: MessageSession, title: str, requestMessage: ChatMessage, text: str,
                        error: bool, modelName: str, source_document: List[Document] = None):
    responseMessage = await ChatMessageDao.ainsert_one(
        ChatMessage(
            user_id=conversation.user_id,
            chat_id=conversation.chat_id,
            flow_id='',
            type='assistant',
            is_bot=True,
            message=text,
            category='answer',
            sender=modelName,
            extra=json.dumps({
                'parentMessageId': requestMessage.id,
                'error': error
            }),
            source=SourceType.FILE.value if source_document else SourceType.NOT_SUPPORT.value
        ))
    if source_document:
        # Asynchronous processing traceability information storage
        asyncio.create_task(process_source_document(source_document=source_document,
                                                    chat_id=conversation.chat_id,
                                                    message_id=responseMessage.id,
                                                    answer=text))

    # Last message time to update session
    msg = json.dumps(
        {
            'final': True,
            'conversation': WorkstationConversation.from_chat_session(conversation).model_dump(),
            'title': title,
            'requestMessage': (await WorkstationMessage.from_chat_message(requestMessage)).model_dump(),
            'responseMessage': (await WorkstationMessage.from_chat_message(responseMessage)).model_dump(),
        },
        default=custom_json_serializer)
    return f'event: message\ndata: {msg}\n\n'


@router.get('/config', summary='Get workbench configuration', response_model=UnifiedResponseModel)
def get_config(
        request: Request,
        login_user: UserPayload = Depends(UserPayload.get_login_user)):
    """ Get model configurations related to reviews """
    ret = WorkStationService.get_config()

    etl_for_lm_url = mep_settings.get_knowledge().etl4lm.url
    ret = ret.model_dump() if ret else {}

    ret['enable_etl4lm'] = bool(etl_for_lm_url)
    linsight_invitation_code = mep_settings.get_all_config().get('linsight_invitation_code', None)
    ret['linsight_invitation_code'] = linsight_invitation_code if linsight_invitation_code else False
    ret['linsight_cache_dir'] = "./"
    ret['waiting_list_url'] = mep_settings.get_linsight_conf().waiting_list_url

    return resp_200(data=ret)


@router.post('/config', summary='Update workbench configuration', response_model=UnifiedResponseModel)
def update_config(
        request: Request,
        login_user: UserPayload = Depends(UserPayload.get_admin_user),
        data: WorkstationConfig = Body(..., description='Default Model Configuration'),
):
    """ Update model configurations related to reviews """
    ret = WorkStationService.update_config(request, login_user, data)
    return resp_200(data=ret)


@router.post('/knowledgeUpload')
def knowledgeUpload(request: Request,
                    background_tasks: BackgroundTasks,
                    file: UploadFile = File(...),
                    login_user: UserPayload = Depends(UserPayload.get_login_user)):
    try:
        file_path = save_download_file(file.file, 'mep', file.filename)
        res = WorkStationService.uploadPersonalKnowledge(request,
                                                         login_user,
                                                         file_path=file_path,
                                                         background_tasks=background_tasks)
        return resp_200(data=res[0])
    except Exception as e:
        raise ServerError(msg=f'Knowledge base upload failed: {str(e)}', exception=e)
    finally:
        file.file.close()


@router.get('/queryKnowledge')
def queryKnoledgeList(request: Request,
                      page: int,
                      size: int,
                      login_user: UserPayload = Depends(UserPayload.get_login_user)):
    # Check if there is a personal knowledge base
    res, total = WorkStationService.queryKnowledgeList(request, login_user, page, size)
    return resp_200(data={'list': res, 'total': total})


@router.delete('/deleteKnowledge')
def deleteKnowledge(request: Request,
                    file_id: int,
                    login_user: UserPayload = Depends(UserPayload.get_login_user)):
    res = KnowledgeService.delete_knowledge_file(request, login_user, [file_id])
    return resp_200(data=res)


@router.post('/files')
async def upload_file(
        request: Request,
        file: UploadFile = File(...),
        file_id: str = Body(..., description='Doc.ID'),
        login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """
    Upload file
    """
    try:

        # Read file contents
        # Save file
        file_path = await save_uploaded_file(file, 'mep', unquote(file.filename))

        # Return to file path
        return resp_200(
            data={
                'filepath': file_path,
                'filename': unquote(file.filename),
                'type': file.content_type,
                'user': login_user.user_id,
                '_id': uuid4().hex,
                'createdAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'temp_file_id': file_id,
                'file_id': uuid4().hex,
                'message': 'File uploaded successfully',
                'context': 'message_attachment',
            })
    except Exception as e:
        raise ServerError(msg=f'File upload failed: {str(e)}', exception=e)
    finally:
        await file.close()


@router.post('/gen_title')
async def gen_title(conversationId: str = Body(..., description='', embed=True),
                    login_user: UserPayload = Depends(UserPayload.get_login_user)):
    """
    Generate Title
    """
    # Get session messages
    redis_key = f'workstation_title_{conversationId}'
    redis_client = await get_redis_client()

    title = await redis_client.aget(redis_key)
    if not title:
        await asyncio.sleep(5)
        # If the title already exists, go straight back to
        title = await redis_client.aget(redis_key)
    if title:
        # If the title already exists, go straight back to
        await redis_client.adelete(redis_key)
        return resp_200({'title': title})
    else:
        return resp_200({'title': 'New Chat'})


@router.get('/messages/{conversationId}')
async def get_chat_history(conversationId: str,
                           login_user: UserPayload = Depends(UserPayload.get_login_user),
                           share_link: Union['ShareLink', None] = Depends(header_share_token_parser)
                           ):
    messages = await ChatMessageDao.aget_messages_by_chat_id(chat_id=conversationId, limit=1000)
    if messages:

        if login_user.user_id != messages[0].user_id:
            # Verify sharing link permissions
            if not share_link or share_link.resource_id != conversationId:
                return UnAuthorizedError.return_resp()

        return resp_200([await WorkstationMessage.from_chat_message(message) for message in messages])
    else:
        return resp_200([])


async def genTitle(human: str, assistant: str, llm: MEPLLM, conversationId: str, login_user: UserPayload,
                   request: Request):
    """
    Generate Title
    """
    convo = f'||>User:\n"{human}"\n ||>Response:\n"{assistant}"'
    prompt = f'Please generate {titleInstruction} \n{convo} \n||>Title:'
    logger.info(f'convo: {convo}')
    res = await llm.ainvoke(prompt)
    title = res.content
    redis_client = await get_redis_client()
    await redis_client.aset(f'workstation_title_{conversationId}', title)
    session = await MessageSessionDao.async_get_one(conversationId)
    if session:
        session.flow_name = title[:200]
        session = await MessageSessionDao.async_insert_one(session)
        # Audit log
        await AuditLogService.create_chat_message(user=login_user, ip_address=get_request_ip(request), message=session)


async def webSearch(query: str, user_id: int, ws_web_search=None):
    """
    Internet search
    """
    from mep_langchain.gpts.tools.web_search.tool import WebSearchTool, SearchTool

    search_config = None
    if ws_web_search and ws_web_search.tool and ws_web_search.params:
        search_config = {
            'type': ws_web_search.tool,
            'config': {ws_web_search.tool: ws_web_search.params},
        }

    if not search_config:
        web_search_info = GptsToolsDao.get_tool_by_tool_key("web_search")
        if not web_search_info:
            raise WebSearchToolNotFoundError(exception=Exception("No web_search tool found in database"))
        web_search_tool = await ToolExecutor.init_by_tool_id(web_search_info.id,
                                                             app_id=ApplicationTypeEnum.DAILY_CHAT.value,
                                                             app_name=ApplicationTypeEnum.DAILY_CHAT.value,
                                                             app_type=ApplicationTypeEnum.DAILY_CHAT,
                                                             user_id=user_id)
        if not web_search_tool:
            raise WebSearchToolNotFoundError(exception=Exception("No web_search tool found in gpts tools"))
    else:
        tool_name = search_config.get('type', '')
        tool_config = search_config.get('config', {}).get(tool_name, {})
        if not tool_name or not tool_config:
            raise WebSearchToolNotFoundError(exception=Exception("Web search not properly configured"))
        search_tool = SearchTool.init_search_tool(tool_name, **tool_config)
        web_search_tool = WebSearchTool(api_wrapper=search_tool)

    search_list = await web_search_tool.ainvoke(input={"query": query})
    search_list = json.loads(search_list)
    search_res = ""
    for index, one in enumerate(search_list):
        search_res += f'[webpage ${index} begin]\n${one.get("snippet")}\n[webpage ${index} end]\n\n'
    return search_res, search_list


async def getFileContent(filepath_local: str, file_name, invoke_user_id: int):
    """
    Get file contents
    """
    raw_texts, _, _, _ = await knowledge_imp.async_read_chunk_text(
        invoke_user_id,
        filepath_local,
        file_name,
        ['\n\n', '\n'],
        ['after', 'after'],
        1000,
        0,
        excel_rule=ExcelRule(),
        no_summary=True
    )
    return knowledge_imp.KnowledgeUtils.chunk2promt(''.join(raw_texts), {'source': file_name})


async def _initialize_chat(data: APIChatCompletion, login_user: UserPayload):
    """Initializes chat session, message, and LLM."""
    wsConfig = await WorkStationService.aget_config()

    model_info = next((m for m in wsConfig.models if m.id == data.model), None)
    if not model_info:
        raise ValueError(f"Model with id '{data.model}' not found.")

    conversationId = data.conversationId
    is_new_conversation = False
    if not conversationId:
        is_new_conversation = True
        conversationId = uuid4().hex
        await MessageSessionDao.async_insert_one(
            MessageSession(
                chat_id=conversationId,
                flow_id='',
                flow_name='New Chat',
                flow_type=FlowType.WORKSTATION.value,
                user_id=login_user.user_id,
            ))

        # Telemetry for new session
        await telemetry_service.log_event(
            user_id=login_user.user_id,
            event_type=BaseTelemetryTypeEnum.NEW_MESSAGE_SESSION,
            trace_id=trace_id_var.get(),
            event_data=NewMessageSessionEventData(
                session_id=conversationId,
                app_id=ApplicationTypeEnum.DAILY_CHAT.value,
                source="platform",
                app_name=ApplicationTypeEnum.DAILY_CHAT.value,
                app_type=ApplicationTypeEnum.DAILY_CHAT
            ))

    conversation = await MessageSessionDao.async_get_one(conversationId)
    if conversation is None:
        raise ConversationNotFoundError()

    if data.overrideParentMessageId:
        message = await ChatMessageDao.aget_message_by_id(int(data.overrideParentMessageId))
    else:
        message = await ChatMessageDao.ainsert_one(
            ChatMessage(
                user_id=login_user.user_id,
                chat_id=conversationId,
                flow_id='',
                type='human',
                is_bot=False,
                sender='User',
                files=json.dumps(data.files) if data.files else None,
                extra=json.dumps({'parentMessageId': data.parentMessageId}),
                message=data.text,
                category='question',
                source=0,
            ))

    mepllm = await LLMService.get_mep_llm(
        model_id=data.model,
        app_id=ApplicationTypeEnum.DAILY_CHAT.value,
        app_name=ApplicationTypeEnum.DAILY_CHAT.value,
        app_type=ApplicationTypeEnum.DAILY_CHAT,
        user_id=login_user.user_id)

    return wsConfig, conversation, message, mepllm, model_info, is_new_conversation


async def _log_telemetry_events(user_id: str, conversation_id: str, start_time: float):
    """Logs telemetry events for application alive and process."""
    end_time = time.time()
    duration_ms = int((end_time - start_time) * 1000)

    common_data = {
        "app_id": ApplicationTypeEnum.DAILY_CHAT.value,
        "app_name": ApplicationTypeEnum.DAILY_CHAT.value,
        "app_type": ApplicationTypeEnum.DAILY_CHAT,
        "chat_id": conversation_id,
        "start_time": int(start_time),
        "end_time": int(end_time),
    }

    await telemetry_service.log_event(
        user_id=user_id,
        event_type=BaseTelemetryTypeEnum.APPLICATION_ALIVE,
        trace_id=trace_id_var.get(),
        event_data=ApplicationAliveEventData(**common_data)
    )

    await telemetry_service.log_event(
        user_id=user_id,
        event_type=BaseTelemetryTypeEnum.APPLICATION_PROCESS,
        trace_id=trace_id_var.get(),
        event_data=ApplicationProcessEventData(**common_data, process_time=duration_ms)
    )


_REACT_MARKERS = ('Thought:', 'Action:', 'Action Input:', 'Observation:', 'Final Answer:')
_REACT_MARKERS_LOWER = tuple(m.lower() for m in _REACT_MARKERS)


def _looks_like_react_output(text: str) -> bool:
    """Detect if text looks like raw ReAct agent reasoning."""
    if not text:
        return False
    s = text.strip().lower()
    for m in _REACT_MARKERS_LOWER:
        if m in s:
            return True
    if '"action"' in s and '"action_input"' in s:
        return True
    return False


def _clean_react_output(text: str) -> str:
    """Strip raw ReAct agent artifacts from LLM output, keeping only user-visible answer.

    Strategy: extract ONLY the final answer text, discarding all Thought/Action/JSON blocks.
    """
    if not text:
        return text
    s = text.strip()

    if 'Final Answer:' in s:
        answer = s.split('Final Answer:')[-1].strip()
        if answer:
            return answer

    lines = s.split('\n')
    result_lines: list[str] = []
    in_code_fence = False
    in_agent_block = False

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        stripped_lower = stripped.lower()

        if stripped.startswith('```'):
            if in_code_fence:
                in_code_fence = False
                in_agent_block = False
                i += 1
                continue
            in_code_fence = True
            lookahead = '\n'.join(lines[i:min(i + 10, len(lines))]).lower()
            if '"action"' in lookahead or '"action_input"' in lookahead:
                in_agent_block = True
                i += 1
                continue
            result_lines.append(line)
            i += 1
            continue

        if in_code_fence:
            if not in_agent_block:
                result_lines.append(line)
            i += 1
            continue

        is_marker = False
        for marker in _REACT_MARKERS:
            if stripped.startswith(marker):
                is_marker = True
                break
        if is_marker:
            i += 1
            while i < len(lines):
                nxt = lines[i].strip()
                if nxt.startswith('```'):
                    break
                if any(nxt.startswith(m) for m in _REACT_MARKERS):
                    break
                if nxt.startswith('{') and ('"action"' in nxt or '"action_input"' in nxt):
                    i += 1
                    continue
                if nxt == '}' or nxt == '```':
                    i += 1
                    continue
                if not nxt:
                    i += 1
                    break
                i += 1
                continue
            continue

        if stripped.startswith('{') and '"action' in stripped_lower:
            i += 1
            while i < len(lines) and lines[i].strip() != '}':
                i += 1
            if i < len(lines):
                i += 1
            continue

        if stripped:
            result_lines.append(line)
        elif result_lines:
            result_lines.append(line)
        i += 1

    cleaned = '\n'.join(result_lines).strip()
    if not cleaned:
        for line in reversed(lines):
            lt = line.strip()
            if lt and not any(lt.startswith(m) for m in _REACT_MARKERS) \
               and not lt.startswith('{') and not lt.startswith('}') \
               and not lt.startswith('```') and '"action' not in lt.lower():
                cleaned = lt
                break
    return cleaned if cleaned else text


async def _workflow_event_stream(wsConfig, conversation, message, data, login_user, request, is_new_conv, mepllm):
    """Bridge workflow execution events to workstation SSE format."""
    conversationId = conversation.chat_id
    yield user_message(message.id, conversationId, 'User', data.text)

    workflow_id = wsConfig.dailyChatFlowId
    error = False
    final_res = ''
    reasoning_res = ''

    try:
        workflow_info = await FlowDao.aget_flow_by_id(workflow_id)
        if not workflow_info:
            raise ServerError(msg=f"Workflow {workflow_id} not found")

        unique_id = uuid4().hex
        workflow = RedisCallback(unique_id, workflow_id, conversationId, login_user.user_id)

        execute_worker = await workflow_stateful_worker.find_task_node(unique_id)
        await workflow.async_set_workflow_data(workflow_info.data)
        await workflow.async_set_workflow_status(WorkflowStatus.WAITING.value)
        execute_workflow.apply_async(
            [unique_id, workflow_id, conversationId, login_user.user_id],
            queue=execute_worker)

        input_node_id = None
        input_message_id = None
        input_key = 'user_input'
        async for event in workflow.get_response_until_break():
            if event.category == WorkflowEventType.UserInput.value:
                msg = event.message if isinstance(event.message, dict) else json.loads(event.message)
                input_node_id = msg.get('node_id')
                input_message_id = event.message_id
                input_key = msg.get('input_schema', {}).get('key', 'user_input')
                break

        if input_node_id:
            user_input = {input_node_id: {input_key: data.text}}
            await workflow.async_set_user_input(user_input, message_id=input_message_id)
            await workflow.async_set_workflow_status(WorkflowStatus.INPUT_OVER.value)
            continue_workflow.apply_async(
                [unique_id, workflow_id, conversationId, login_user.user_id],
                queue=execute_worker)
        else:
            logger.warning(f'Workflow {workflow_id} did not reach INPUT state, streaming available events')

        stepId = 'step_' + uuid4().hex
        runId = uuid4().hex
        yield step_message(stepId, runId, 0, f'msg_{uuid4().hex}')

        _raw_buf = ''
        _detect_len = 0
        _is_agent = None
        _sent_clean = False
        _streamed_any = False

        async for event in workflow.get_response_until_break():
            if event.category == WorkflowEventType.StreamMsg.value and event.type == 'stream':
                msg = event.message if isinstance(event.message, dict) else json.loads(event.message)
                chunk = msg.get('msg', '')
                reasoning = msg.get('reasoning_content', '')
                if chunk:
                    _raw_buf += chunk
                    _detect_len += len(chunk)

                    if _is_agent is None:
                        if _looks_like_react_output(_raw_buf):
                            _is_agent = True
                            logger.info(f'[WS] Detected ReAct agent output after {_detect_len} chars, suppressing stream')
                        elif _detect_len > 800:
                            if _looks_like_react_output(_raw_buf):
                                _is_agent = True
                                logger.info('[WS] Late detection of agent output, suppressing')
                            else:
                                _is_agent = False
                                final_res += _raw_buf
                                _streamed_any = True
                                yield SSEResponse(event='on_message_delta',
                                                  data=delta(id=stepId, delta={
                                                      'content': [{'type': 'text', 'text': _raw_buf}]})).toString()
                    elif _is_agent is False:
                        if _looks_like_react_output(_raw_buf):
                            _is_agent = True
                            logger.info('[WS] Re-detected agent output after initial stream, will replace')
                        else:
                            final_res += chunk
                            _streamed_any = True
                            yield SSEResponse(event='on_message_delta',
                                              data=delta(id=stepId, delta={
                                                  'content': [{'type': 'text', 'text': chunk}]})).toString()

                if reasoning:
                    reasoning_res += reasoning
                    yield SSEResponse(event='on_reasoning_delta',
                                      data=delta(id=stepId, delta={
                                          'content': [{'type': 'think', 'think': reasoning}]})).toString()
            elif event.category == WorkflowEventType.StreamMsg.value and event.type == 'end':
                msg = event.message if isinstance(event.message, dict) else json.loads(event.message)
                clean_text = msg.get('msg', '')
                if clean_text:
                    safe_text = _clean_react_output(clean_text) if _looks_like_react_output(clean_text) else clean_text

                    if _is_agent is True or _is_agent is None:
                        final_res = safe_text
                        _sent_clean = True
                        yield SSEResponse(event='on_message_delta',
                                          data=delta(id=stepId, delta={
                                              'content': [{'type': 'text', 'text': safe_text}]})).toString()
                    elif _streamed_any and _looks_like_react_output(_raw_buf):
                        final_res = safe_text
                        _sent_clean = True
                        yield SSEResponse(event='on_message_delta',
                                          data=delta(id=stepId, delta={
                                              'content': [{'type': 'text', 'text': safe_text, 'replace': True}]})).toString()
                    elif _streamed_any and safe_text.strip() != _raw_buf.strip():
                        final_res = safe_text
                        _sent_clean = True
                        yield SSEResponse(event='on_message_delta',
                                          data=delta(id=stepId, delta={
                                              'content': [{'type': 'text', 'text': safe_text, 'replace': True}]})).toString()
                    elif not final_res:
                        final_res = safe_text
            elif event.category == WorkflowEventType.OutputMsg.value:
                msg = event.message if isinstance(event.message, dict) else json.loads(event.message)
                out = msg.get('msg', '')
                if out and not final_res:
                    final_res = _clean_react_output(out) if _looks_like_react_output(out) else out
            elif event.category == WorkflowEventType.Error.value:
                error = True
                msg = event.message if isinstance(event.message, dict) else {}
                err_msg = msg.get('status_message', '') if isinstance(msg, dict) else str(msg)
                logger.error(f'Workflow error: {err_msg}')

        status = await workflow.async_get_workflow_status()
        if status and status['status'] in [WorkflowStatus.SUCCESS.value, WorkflowStatus.FAILED.value]:
            await workflow.async_clear_workflow_status()

    except BaseErrorCode as e:
        error = True
        final_res = json.dumps(e.to_dict())
        yield e.to_sse_event_instance_str()
    except Exception as e:
        error = True
        server_error = ServerError(exception=e)
        logger.exception(f'Error in workflow event stream')
        final_res = json.dumps(server_error.to_dict())
        yield server_error.to_sse_event_instance_str()

    if not error and _looks_like_react_output(final_res):
        final_res = _clean_react_output(final_res)
    final_content = final_res
    if reasoning_res:
        final_content = ':::thinking\n' + reasoning_res + '\n:::' + final_res
    yield await final_message(conversation, conversation.flow_name, message, final_content, error, '赛乐助手')

    if is_new_conv:
        asyncio.create_task(genTitle(data.text, final_content, mepllm, conversationId, login_user, request))


@router.post('/chat/completions')
async def chat_completions(
        request: Request,
        data: APIChatCompletion,
        login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    start_time = time.time()
    try:
        wsConfig, conversation, message, mepllm, model_info, is_new_conv = await _initialize_chat(data, login_user)
        conversationId = conversation.chat_id
        conversation_id_for_telemetry = conversationId
    except (BaseErrorCode, ValueError) as e:
        error_response = e if isinstance(e, BaseErrorCode) else ServerError(message=str(e))
        return EventSourceResponse(iter([error_response.to_sse_event_instance()]))
    except Exception as e:
        logger.exception(f'Error in chat completions setup: {e}')
        return EventSourceResponse(iter([ServerError(exception=e).to_sse_event_instance()]))

    if wsConfig.dailyChatFlowId:
        try:
            return StreamingResponse(
                _workflow_event_stream(wsConfig, conversation, message, data, login_user, request, is_new_conv, mepllm),
                media_type='text/event-stream')
        finally:
            await _log_telemetry_events(login_user.user_id, conversationId, start_time)

    def _build_final_content_for_db(final_res, reasoning_res, web_list):
        if reasoning_res:
            final_res = ''':::thinking\n''' + reasoning_res + '''\n:::''' + final_res
        if web_list:
            final_res = ''':::web\n''' + json.dumps(web_list, ensure_ascii=False) + '''\n:::''' + final_res
        return final_res

    async def event_stream():
        yield user_message(message.id, conversationId, 'User', data.text)

        prompt = data.text
        web_list = []
        error = False
        final_res = ''  # Accumulates the final response for the user
        reasoning_res = ''  # Accumulates the reasoning process
        max_token = wsConfig.maxTokens
        runId = uuid4().hex
        index = 0
        stepId = None
        source_document = None
        image_bases64 = []
        use_qwen_builtin_search = False
        try:
            # Prepare prompt based on different modes (search, knowledge base, files)
            if data.search_enabled:
                ws_tool = wsConfig.webSearch.tool if wsConfig.webSearch else None
                if ws_tool == 'qwen':
                    use_qwen_builtin_search = True
                    logger.info('Using Qwen built-in web search (enable_search=True)')
                else:
                    stepId = f'step_${uuid4().hex}'
                    yield step_message(stepId, runId, index, f'msg_{uuid4().hex}')
                    index += 1

                    search_decision_prompt = promptSearch % data.text
                    searchRes = await mepllm.ainvoke(search_decision_prompt)

                    if searchRes.content == '1':
                        logger.info(f'Web search needed for prompt: {data.text}')
                        search_res, web_list = await webSearch(data.text, user_id=login_user.user_id, ws_web_search=wsConfig.webSearch)
                        content = {'content': [{'type': 'search_result', 'search_result': web_list}]}
                        yield SSEResponse(event='on_search_result',
                                          data=delta(id=stepId, delta=content)).toString()
                        prompt = wsConfig.webSearch.prompt.format(
                            search_results=search_res[:max_token],
                            cur_date=datetime.now().strftime('%Y-%m-%d'),
                            question=data.text)

            elif data.use_knowledge_base and (data.use_knowledge_base.personal_knowledge_enabled or len(
                    data.use_knowledge_base.organization_knowledge_ids) > 0):
                logger.info(f'Using knowledge base for prompt: {data.text}')
                chunks, source_document = await WorkStationService.queryChunksFromDB(data.text,
                                                                                     use_knowledge_param=data.use_knowledge_base,
                                                                                     max_token=max_token,
                                                                                     login_user=login_user)
                context_str = '\n'.join(chunks)
                if wsConfig.knowledgeBase.prompt:
                    prompt = wsConfig.knowledgeBase.prompt.format(retrieved_file_content=context_str,
                                                                  question=data.text)
                else:
                    prompt_service = await get_prompt_manager()
                    prompt = prompt_service.render_prompt('workstation', 'personal_knowledge',
                                                          retrieved_file_content=context_str,
                                                          question=data.text).prompt
                logger.debug(f'Knowledge prompt: {prompt}')


            elif data.files:

                logger.info(f'Using file content for prompt.')

                download_tasks = [async_file_download(file.get('filepath')) for file in data.files]

                downloaded_files = await asyncio.gather(*download_tasks)

                visual_tasks = []

                doc_tasks = []

                # image to base64
                async def _read_image_sync(filepath: str, filename: str) -> str:
                    async with aiofiles.open(filepath, mode='rb') as f:
                        image_data = await f.read()
                        ext = filename.split('.')[-1].lower()

                        mime_type = 'jpeg' if ext == 'jpg' else ext

                        return f"data:image/{mime_type};base64," + base64.b64encode(image_data).decode('utf-8')

                for filepath, filename in downloaded_files:

                    file_ext = filename.split('.')[-1].lower()

                    # Determine task type based on file extension and model capabilities
                    if model_info.visual and file_ext in visual_model_file_types:
                        # Image processing task
                        visual_tasks.append(_read_image_sync(filepath=filepath, filename=filename))

                    else:
                        # Document processing task
                        doc_tasks.append(
                            getFileContent(filepath_local=filepath,
                                           file_name=filename,
                                           invoke_user_id=login_user.user_id)
                        )

                # Execute all tasks concurrently
                results = await asyncio.gather(
                    asyncio.gather(*visual_tasks),
                    asyncio.gather(*doc_tasks)
                )

                # results[0] is image base64 list
                # results[1] is document content list
                image_bases64.extend(results[0])
                file_contents = results[1]

                file_context = '\n'.join(file_contents)[:max_token]
                prompt = wsConfig.fileUpload.prompt.format(file_content=file_context, question=data.text)

            # Update message with the generated prompt if it changed
            if prompt != data.text:
                extra = json.loads(message.extra) if message.extra else {}
                extra['prompt'] = prompt
                message.extra = json.dumps(extra, ensure_ascii=False)
                await ChatMessageDao.ainsert_one(message)

            # Prepare message history and call LLM
            history_messages = (await WorkStationService.get_chat_history(conversationId, 8))[:-1]
            content = [
                {'type': 'text', 'text': prompt},
            ]

            for img_base64 in image_bases64:
                content.append({'type': 'image_url', 'image_url': {
                    'url': img_base64
                }})

            inputs = [*history_messages, HumanMessage(content=content)]
            if wsConfig.systemPrompt:
                system_content = wsConfig.systemPrompt.format(cur_date=datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
                inputs.insert(0, SystemMessage(content=system_content))

            if not stepId:
                stepId = 'step_' + uuid4().hex
                yield step_message(stepId, runId, index, f'msg_{uuid4().hex}')
                index += 1

            # Enable Qwen built-in search if configured
            stream_kwargs = {}
            if use_qwen_builtin_search:
                from mep.llm.domain.const import LLMServerType
                if mepllm.server_info and mepllm.server_info.type == LLMServerType.QWEN.value:
                    stream_kwargs['enable_search'] = True
                    if hasattr(mepllm, 'llm') and hasattr(mepllm.llm, 'model_kwargs'):
                        mepllm.llm.model_kwargs = {**mepllm.llm.model_kwargs, 'enable_search': True}
                    logger.info('Qwen enable_search=True applied for this stream')

            # Stream LLM response
            async for chunk in mepllm.astream(inputs, **stream_kwargs):
                content = chunk.content
                reasoning_content = chunk.additional_kwargs.get('reasoning_content', '')

                if content:
                    final_res += content
                    yield SSEResponse(event='on_message_delta',
                                      data=delta(id=stepId,
                                                 delta={'content': [{'type': 'text', 'text': content}]})).toString()
                if reasoning_content:
                    reasoning_res += reasoning_content
                    yield SSEResponse(event='on_reasoning_delta',
                                      data=delta(id=stepId, delta={
                                          'content': [{'type': 'think', 'think': reasoning_content}]})).toString()

            final_content_for_db = _build_final_content_for_db(final_res, reasoning_res, web_list)

        except BaseErrorCode as e:
            error = True
            final_content_for_db = json.dumps(e.to_dict())
            yield e.to_sse_event_instance_str()
        except Exception as e:
            error = True
            server_error = ServerError(exception=e)
            logger.exception(f'Error in processing the prompt')
            final_content_for_db = json.dumps(server_error.to_dict())
            yield server_error.to_sse_event_instance_str()

        # Send final message and generate title if needed
        yield await final_message(conversation, conversation.flow_name, message, final_content_for_db,
                                  error, model_info.displayName, source_document)

        if is_new_conv:
            asyncio.create_task(
                genTitle(data.text, final_content_for_db, mepllm, conversationId, login_user, request))

    try:
        return StreamingResponse(event_stream(), media_type='text/event-stream')
    finally:
        await _log_telemetry_events(login_user.user_id, conversation_id_for_telemetry, start_time)


@router.get('/app/frequently_used')
def frequently_used_chat(login_user: UserPayload = Depends(UserPayload.get_login_user),
                         user_link_type: Optional[str] = 'app',
                         page: Optional[int] = 1,
                         limit: Optional[int] = 8
                         ):
    data, _ = WorkFlowService.get_frequently_used_flows(login_user, user_link_type, page, limit)

    return resp_200(data=data)


@router.post('/app/frequently_used')
def frequently_used_chat(login_user: UserPayload = Depends(UserPayload.get_login_user),
                         data: FrequentlyUsedChat = Body(..., description='Add your favorite apps')
                         ):
    is_new = WorkFlowService.add_frequently_used_flows(login_user, data.user_link_type, data.type_detail)
    if is_new:
        return resp_200(message='Added')
    else:
        return AgentAlreadyExistsError.return_resp()


@router.delete('/app/frequently_used')
def frequently_used_chat(login_user: UserPayload = Depends(UserPayload.get_login_user),
                         user_link_type: Optional[str] = None,
                         type_detail: Optional[str] = None
                         ):
    WorkFlowService.delete_frequently_used_flows(login_user, user_link_type, type_detail)
    return resp_200(message='Delete successful')


@router.get('/app/uncategorized')
def get_uncategorized_chat(login_user: UserPayload = Depends(UserPayload.get_login_user),
                           page: Optional[int] = 1,
                           limit: Optional[int] = 8):
    data, _ = WorkFlowService.get_uncategorized_flows(login_user, page, limit)
    return resp_200(data=data)
