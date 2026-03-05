"""
Order Assistant API - handles file upload and dispatching to TP or Sales Order processing.

Flow:
  1. Upload all files to MinIO first (fast, returns immediately)
  2. Background task parses files sequentially
  3. On completion, sends DingTalk notification with results
  4. Parsing failures are logged to parsing_log table
"""

import asyncio
import hashlib
import json
import logging
import traceback
from typing import List, Optional
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel

from mep.common.dependencies.user_deps import UserPayload
from mep.common.schemas.api import resp_200, resp_500

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/order-assistant', tags=['order_assistant'])

_background_tasks: dict[int, asyncio.Task] = {}


def _launch_background_task(file_tasks, batch_id, user_id=None, notify_url=None):
    """Launch a tracked background task that won't be silently lost."""
    async def _wrapper():
        try:
            await _process_files_background(file_tasks, batch_id, user_id, notify_url)
        except Exception:
            logger.exception('Background task crashed for batch %s', batch_id)
        finally:
            for lid in [t.get('log_id') for t in file_tasks if t.get('log_id')]:
                _background_tasks.pop(lid, None)

    task = asyncio.ensure_future(_wrapper())
    for ft in file_tasks:
        lid = ft.get('log_id')
        if lid:
            _background_tasks[lid] = task
    return task


async def recover_stuck_tasks():
    """Called on startup to recover tasks stuck in pending/processing."""
    try:
        from mep.database.models.parsing_log import ParsingLogDao
        stuck = await ParsingLogDao.list_stuck()
        if not stuck:
            logger.info('[Startup] No stuck parsing tasks found')
            return

        logger.info('[Startup] Found %d stuck parsing tasks, re-triggering...', len(stuck))
        batches: dict[str, list[dict]] = {}
        for item in stuck:
            if not item.file_url or not item.batch_id:
                continue
            batches.setdefault(item.batch_id, []).append({
                'file_name': item.file_name,
                'file_url': item.file_url,
                'file_type': item.file_type or 'sales_order',
                'log_id': item.id,
            })

        for bid, tasks in batches.items():
            _launch_background_task(tasks, bid)
            logger.info('[Startup] Re-triggered batch %s with %d files', bid, len(tasks))
    except Exception:
        logger.exception('[Startup] Failed to recover stuck tasks')

TP_FLOW_ID = 'dc06032fa9e942038861da1d22944ec5'
SO_FLOW_ID = '2d615d62073d4970ac63acf4d6dd957f'


async def _upload_to_minio(file: UploadFile) -> Optional[str]:
    """Upload a file to MinIO and return the accessible URL."""
    try:
        from mep.core.cache.utils import save_uploaded_file
        if len(file.filename) > 80:
            file.filename = file.filename[-80:]
        file_path = await save_uploaded_file(
            file, folder_name='order_assistant', file_name=file.filename,
        )
        return str(file_path) if file_path else None
    except Exception:
        logger.exception('File upload to MinIO failed: %s', file.filename)
        return None


async def _upload_to_minio_from_bytes(
    content: bytes, filename: str,
) -> Optional[str]:
    """Upload pre-read bytes to MinIO (avoids holding UploadFile open)."""
    try:
        import io
        from mep.core.storage.minio.minio_manager import get_minio_storage
        if len(filename) > 80:
            filename = filename[-80:]
        minio_client = await get_minio_storage()
        await minio_client.put_object_tmp(
            object_name=filename, file=io.BytesIO(content),
        )
        file_path = await minio_client.get_share_link(
            filename, minio_client.tmp_bucket, clear_host=False,
        )
        return str(file_path) if file_path else None
    except Exception:
        logger.exception('File upload to MinIO failed: %s', filename)
        return None


async def _process_tp(file_url: str, file_name: str) -> dict:
    """Call the TP workflow to process the file."""
    try:
        from mep.database.models.flow import FlowDao
        flow = await FlowDao.get_flow_by_id(TP_FLOW_ID)
        if not flow:
            return {'success': False, 'error': 'TP workflow not found'}

        from mep.processing.process import process_graph_cached
        graph_data = flow.data
        inputs = {'file_url': file_url, 'file_name': file_name}
        result = await process_graph_cached(
            graph_data, inputs, False, str(uuid4()),
            history_count=0, flow_id=TP_FLOW_ID,
        )
        return {'success': True, 'result': result}
    except Exception as e:
        logger.exception('TP processing failed for %s', file_name)
        return {'success': False, 'error': str(e)}


def _build_order_markdown(header_dict: dict, lines: list[dict], file_name: str) -> str:
    """Build a structured Markdown document from parsed sales order data."""
    po = header_dict.get('po') or ''
    md = [f'# 销售订单 {po}', '', f'> 源文件: {file_name}', '']

    md.append('## 订单信息')
    md.append('')
    md.append('| 字段 | 值 |')
    md.append('| --- | --- |')
    field_labels = [
        ('po', 'PO'), ('customer_name', '客户'), ('generic_article_no', '通用货号'),
        ('total_amount', '总金额'), ('total_pieces', '总件数'), ('currency', '币种'),
        ('date_of_issue', '签发日期'), ('cargo_delivery_date', '交货日期'),
        ('presentation_date', '展示日期'), ('article_description', '产品描述'),
        ('payment_terms', '付款条款'), ('delivery_terms', '交货条款'),
        ('country', '国家'), ('brand', '品牌'), ('season', '季节'),
        ('factory', '工厂'), ('delivery_at', '交货地点'), ('reference', '参考号'),
    ]
    for key, label in field_labels:
        val = header_dict.get(key)
        if val is not None and str(val).strip():
            md.append(f'| {label} | {val} |')

    if lines:
        md.append('')
        md.append(f'## 明细行（共 {len(lines)} 行）')
        md.append('')
        md.append('| 行号 | 货号 | 颜色 | 尺码 | 数量 | 总件数 | 单价 | 描述 | DC | 仓库 | EAN |')
        md.append('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
        for ln in lines:
            row = [
                ln.get('position') or '',
                ln.get('article') or '',
                ln.get('colour') or '',
                ln.get('size') or '',
                str(ln.get('quantity') or ''),
                str(ln.get('tot_pieces') or ''),
                str(ln.get('price_unit_buying') or ''),
                (ln.get('description') or '')[:40],
                ln.get('dc') or '',
                ln.get('warehouse') or '',
                ln.get('ean') or '',
            ]
            md.append('| ' + ' | '.join(row) + ' |')

    return '\n'.join(md)


async def _get_order_knowledge_id() -> Optional[int]:
    """Get the knowledge_id for storing parsed order documents."""
    try:
        from sqlmodel import text as sql_text
        from mep.core.database.manager import get_sync_db_session
        with get_sync_db_session() as session:
            row = session.execute(
                sql_text("SELECT value FROM config WHERE `key` = 'order_assistant_config' LIMIT 1")
            ).first()
            if row:
                config = json.loads(row[0])
                kid = config.get('knowledge_id')
                if kid:
                    return int(kid)
    except Exception:
        logger.warning('Failed to load order_assistant knowledge_id from config')
    return 1


async def _process_sales_order(file_url: str, file_name: str) -> dict:
    """Call the sales order processing pipeline directly."""
    try:
        from mep.api.v1.sales_order_process import (
            _call_paddleocr, _call_llm, _save_to_minio,
            _save_to_knowledge,
            STRUCTURE_PROMPT, EXTRACT_FIELDS_PROMPT,
            _split_ocr_text, _clean_llm_json,
        )
        from mep.core.documents.parser import OrderParser
        from mep.database.models.sales_order import SalesOrderDao

        ocr_text = await _call_paddleocr(file_url)
        if not ocr_text:
            return {'success': False, 'error': 'OCR识别失败，无法从文件提取文本'}

        chunks = _split_ocr_text(ocr_text, max_chars=4000)

        structure_coros = [
            _call_llm(STRUCTURE_PROMPT.format(ocr_text=chunk))
            for chunk in chunks
        ]
        field_coro = _call_llm(
            EXTRACT_FIELDS_PROMPT.format(ocr_text=ocr_text[:12000]),
        )
        all_results = await asyncio.gather(
            *structure_coros, field_coro, return_exceptions=True,
        )

        structure_results = all_results[:-1]
        fields_result = all_results[-1]

        all_tables: list = []
        for chunk_result in structure_results:
            if isinstance(chunk_result, Exception) or not chunk_result:
                continue
            cleaned = _clean_llm_json(chunk_result)
            try:
                tables = json.loads(cleaned)
                if isinstance(tables, list):
                    all_tables.extend(tables)
                elif isinstance(tables, dict):
                    all_tables.append(tables)
            except json.JSONDecodeError:
                pass

        if not all_tables:
            return {'success': False, 'error': 'LLM结构化失败，无法将OCR文本转换为表格'}
        tables_json_str = json.dumps(all_tables, ensure_ascii=False)

        extra_fields = {}
        fields_str = fields_result if isinstance(fields_result, str) else None
        if fields_str:
            try:
                fields_str = fields_str.strip()
                if fields_str.startswith('```'):
                    fields_str = fields_str.split('\n', 1)[-1]
                    if fields_str.endswith('```'):
                        fields_str = fields_str[:-3].strip()
                start = fields_str.find('{')
                end = fields_str.rfind('}')
                if start != -1 and end != -1:
                    extra_fields = json.loads(fields_str[start:end + 1])
            except Exception:
                pass

        parser = OrderParser()
        orders = parser.parse(tables_json_str, extra_fields)
        if not orders:
            return {'success': False, 'error': '解析失败，无法从文档中提取订单数据'}

        for order in orders:
            order['source_file_url'] = file_url

        header_ids = await SalesOrderDao.import_orders(orders)

        packing_results = []
        all_orders_for_packing = []
        all_lines_for_packing = []
        for hid in header_ids:
            try:
                header = await SalesOrderDao.get_header(hid)
                lines = await SalesOrderDao.get_lines(hid)
                if not header or not lines:
                    continue
                order_dict = header.dict()
                lines_dict = [ln.dict() for ln in lines]
                all_orders_for_packing.append(order_dict)
                all_lines_for_packing.append(lines_dict)
            except Exception:
                logger.exception('Failed to load data for header %d', hid)

        if all_orders_for_packing:
            try:
                customer = (all_orders_for_packing[0].get('customer_name') or '').upper()
                from mep.core.documents.packing_list import (
                    generate_hkm_packing_list_combined,
                    generate_generic_packing_list,
                )
                from mep.database.models.packing_spec import PackingSpecDao
                specs = await PackingSpecDao.find_by_customer(customer)
                specs_dict = [s.dict() for s in specs] if specs else []

                if 'HKM' in customer:
                    excel_bytes = generate_hkm_packing_list_combined(
                        all_orders_for_packing, all_lines_for_packing,
                        customer_specs=specs_dict,
                    )
                else:
                    excel_bytes = generate_generic_packing_list(
                        all_orders_for_packing[0],
                        [ln for lines in all_lines_for_packing for ln in lines],
                        customer_specs=specs_dict,
                    )

                po = all_orders_for_packing[0].get('po', '') or str(header_ids[0])
                packing_url = await _save_to_minio(
                    excel_bytes, f'sales_order/packing_list_{po}.xlsx',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                )
                if packing_url:
                    for hid in header_ids:
                        await SalesOrderDao.update_header(hid, {'packing_list_url': packing_url})
                    packing_results.append({'header_ids': header_ids, 'url': packing_url})
            except Exception:
                logger.exception('Packing list generation failed')

        # Save to knowledge base as Markdown
        knowledge_id = await _get_order_knowledge_id()
        doc_center_results = []
        if knowledge_id:
            try:
                for order_dict, lines_dict in zip(all_orders_for_packing, all_lines_for_packing):
                    md_text = _build_order_markdown(order_dict, lines_dict, file_name)
                    md_bytes = md_text.encode('utf-8')
                    po = order_dict.get('po', '') or ''
                    md_name = f'{po or file_name.rsplit(".", 1)[0]}.md'

                    article = order_dict.get('generic_article_no', '') or ''
                    tags = {
                        'file_name': file_name,
                        'customer_name': order_dict.get('customer_name', ''),
                        'order_number': po,
                        'article_no': article,
                        'source_type': 'sales_order',
                    }

                    md_file_id = await _save_to_knowledge(
                        knowledge_id, md_name, md_bytes, tags,
                    )
                    if md_file_id:
                        doc_center_results.append({'file': md_name, 'file_id': md_file_id})
                        logger.info('Saved MD to knowledge base: %s (file_id=%d)', md_name, md_file_id)
            except Exception:
                logger.exception('Failed to save order MD to knowledge base')

        # --- Create task, write message log, send DingTalk notification ---
        task_results = []
        try:
            task_results = await _create_tasks_for_orders(
                header_ids, all_orders_for_packing, all_lines_for_packing, file_name,
            )
        except Exception:
            logger.exception('Task creation failed for %s', file_name)

        return {
            'success': True,
            'result': {
                'header_ids': header_ids,
                'order_count': len(header_ids),
                'packing_lists': packing_results,
                'doc_center': doc_center_results,
                'tasks': task_results,
            },
        }
    except Exception as e:
        logger.exception('Sales order processing failed for %s', file_name)
        return {'success': False, 'error': str(e)}


# ---------------------------------------------------------------------------
# Task creation + SysMessageLog + DingTalk corp notification
# ---------------------------------------------------------------------------

async def _get_dict_value(cat_code: str, label: str, fallback: str | None = None) -> str:
    """从数据字典获取指定分类下指定 label 对应的 value，未找到返回 fallback（默认为 label 本身）。"""
    try:
        from mep.database.models.data_dict import DataDictDao
        cat = await DataDictDao.find_category_by_code(cat_code)
        if cat:
            items = await DataDictDao.get_items_by_category(cat.id)
            for item in items:
                if item.item_label == label:
                    return item.item_value
    except Exception:
        logger.warning('Failed to read %s/%s from data_dict, using fallback', cat_code, label)
    return label if fallback is None else fallback


async def _get_agent_by_parent_value(task_type_value: str, fallback: str = '') -> str:
    """从 task_type_agent 分类中，根据父项的 item_value 匹配，返回智能体 ID。"""
    try:
        from mep.database.models.data_dict import DataDictDao, DictItem
        from mep.core.database import get_async_db_session
        from sqlmodel import select

        cat = await DataDictDao.find_category_by_code('task_type_agent')
        if not cat:
            return fallback
        async with get_async_db_session() as session:
            items = (await session.exec(
                select(DictItem).where(DictItem.category_id == cat.id)
            )).all()
            if not items:
                return fallback
            parent_ids = {it.parent_id for it in items if it.parent_id}
            if not parent_ids:
                return fallback
            parents = (await session.exec(
                select(DictItem).where(DictItem.id.in_(parent_ids))
            )).all()
            parent_id_map = {p.id: p for p in parents}
            for it in items:
                parent = parent_id_map.get(it.parent_id)
                if parent and parent.item_value == task_type_value:
                    return it.item_value
        return fallback
    except Exception:
        logger.warning('Failed to get agent for task type %s', task_type_value)
        return fallback


async def _get_first_child_status(task_type_value: str, fallback: str = 'TP数据采集') -> str:
    """从1002(任务阶段)分类中，根据父项 item_value 匹配任务类型，返回其下 sort_order 最小的子阶段值。

    父项可能位于其他分类（如任务类型），通过跨分类 parent_id 引用。
    """
    try:
        from mep.database.models.data_dict import DataDictDao, DictItem
        from mep.core.database import get_async_db_session
        from sqlmodel import select, col

        cat = await DataDictDao.find_category_by_code('1002')
        if not cat:
            return fallback
        async with get_async_db_session() as session:
            parent = (await session.exec(
                select(DictItem).where(
                    DictItem.item_value == task_type_value,
                    DictItem.parent_id == None,
                )
            )).first()
            if not parent:
                return fallback
            first_child = (await session.exec(
                select(DictItem).where(
                    DictItem.category_id == cat.id,
                    DictItem.parent_id == parent.id,
                ).order_by(col(DictItem.sort_order).asc())
            )).first()
            return first_child.item_value if first_child else fallback
    except Exception:
        logger.warning('Failed to get first child status for %s', task_type_value)
        return fallback


async def _create_tasks_for_orders(
    header_ids: list[int],
    all_orders: list[dict],
    all_lines: list[list[dict]],
    file_name: str,
) -> list[dict]:
    """为每个成功解析的订单创建任务、写消息日志、发钉钉企业消息。"""
    from mep.database.models.task_center import (
        Task, TaskDao, TaskUpdateLog, TaskUpdateLogDao, generate_task_number,
    )
    from mep.database.models.master_data import MasterDataDao
    from mep.database.models.sys_message_log import SysMessageLog, SysMessageLogDao
    from mep.user.domain.models.user import UserDao
    from mep.core.dingtalk.dingtalk_message import async_send_dingtalk_message

    message_type_value = await _get_dict_value('message_type', '任务创建')

    agent_id = await _get_agent_by_parent_value('跟单任务')
    if not agent_id:
        logger.warning('No agent configured for task type 跟单任务 in data dict task_type_agent')

    initial_status = await _get_first_child_status('跟单任务')

    results = []

    for idx, hid in enumerate(header_ids):
        try:
            order_dict = all_orders[idx] if idx < len(all_orders) else {}
            lines_dict = all_lines[idx] if idx < len(all_lines) else []

            customer_name = order_dict.get('customer_name', '') or ''
            po = order_dict.get('po', '') or ''
            article = order_dict.get('generic_article_no', '') or ''
            total_amount = order_dict.get('total_amount', '') or ''
            total_pieces = order_dict.get('total_pieces', '') or ''
            cargo_date = order_dict.get('cargo_delivery_date', '') or ''

            # Dedup: check if task with same PO already exists
            if po:
                try:
                    from mep.core.biz.task_dedup import find_existing_task_by_po, handle_duplicate
                    existing = await find_existing_task_by_po(po)
                    if existing:
                        dedup_result = await handle_duplicate(
                            existing['task'], existing['header'], order_dict, file_name,
                        )
                        results.append({
                            'task_number': dedup_result['task_number'],
                            'header_id': hid,
                            'dedup': dedup_result,
                        })
                        continue
                except Exception:
                    logger.exception('Dedup check failed for PO=%s, proceeding with creation', po)

            description = (
                f"客户: {customer_name}\n"
                f"PO: {po}\n"
                f"款号: {article}\n"
                f"总金额: {total_amount}\n"
                f"总件数: {total_pieces}\n"
                f"交货日期: {cargo_date}\n"
                f"来源文件: {file_name}"
            )

            # 1. Look up customer -> customer_service_id
            assignee_id = None
            customer = await MasterDataDao.get_customer_by_name(customer_name)
            if customer and customer.customer_service_id:
                assignee_id = customer.customer_service_id

            # 2. Create task with agent association
            task_number = await generate_task_number()
            chat_id = uuid4().hex if agent_id else None
            task = Task(
                task_number=task_number,
                task_name=f"{customer_name} - PO:{po}",
                task_type='跟单任务',
                status=initial_status,
                priority_label='普通',
                agent_id=agent_id or None,
                chat_id=chat_id,
                assignee_id=assignee_id,
                creator_id=None,
                description=description,
                main_form_type='sales_order',
                main_form_id=hid,
                tags=[customer_name, po] if po else [customer_name],
            )
            task = await TaskDao.create_task(task)
            logger.info('Created task %s for header_id=%d', task.task_number, hid)

            # 3. Auto-populate three business tables (follow_up + bom + sample)
            biz_result = {}
            try:
                from mep.core.biz.auto_extract import populate_three_tables
                biz_result = await populate_three_tables(
                    header_id=hid,
                    task_id=task.id,
                    creator_id=None,
                )
                logger.info('Auto-populated biz tables for task %s: %s', task.task_number, biz_result)
            except Exception:
                logger.exception('Failed to auto-populate biz tables for task %s', task.task_number)

            # 4. Register biz tables as TaskForms
            from mep.database.models.task_center import TaskForm, TaskFormDao
            form_mappings = [
                ('sales_order', hid, f'销售订单 PO:{po}', True),
            ]
            if biz_result.get('follow_up_id'):
                form_mappings.append(('follow_up', biz_result['follow_up_id'], f'跟单表 {article}', False))
            if biz_result.get('bom_id'):
                form_mappings.append(('bom', biz_result['bom_id'], f'BOM表 {article}', False))
            if biz_result.get('sample_id'):
                form_mappings.append(('sample', biz_result['sample_id'], f'打样单 {article}', False))
            for ft, fid, fname, is_main in form_mappings:
                try:
                    await TaskFormDao.add_form(TaskForm(
                        task_id=task.id, form_type=ft, form_id=fid,
                        form_name=fname, is_main=is_main,
                    ))
                except Exception:
                    logger.exception('Failed to add TaskForm %s for task %s', ft, task.task_number)

            # 5. Auto-validate and repair biz tables
            if biz_result.get('follow_up_id'):
                try:
                    from mep.core.biz.data_validator import validate_and_repair
                    repair_result = await validate_and_repair(
                        biz_result['follow_up_id'],
                        ocr_text='',
                        notify_on_failure=True,
                    )
                    if repair_result.get('repaired'):
                        logger.info('Auto-repaired fields for task %s: %s',
                                    task.task_number, repair_result['repaired'])
                except Exception:
                    logger.exception('Validate/repair failed for task %s', task.task_number)

            # 6. Sync three tables to knowledge base (赛乐文档中心)
            if biz_result.get('follow_up_id'):
                try:
                    from mep.core.biz.knowledge_sync import sync_three_tables_to_knowledge
                    await sync_three_tables_to_knowledge(biz_result['follow_up_id'])
                except Exception:
                    logger.exception('Knowledge sync failed for task %s', task.task_number)

            # 6. Write TaskUpdateLog
            await TaskUpdateLogDao.add_log(TaskUpdateLog(
                task_id=task.id,
                log_type='system',
                content=f'任务创建: {task.task_number} - {customer_name} PO:{po}',
                user_id=None,
                user_name='system',
            ))

            # 7. Write SysMessageLog
            try:
                await SysMessageLogDao.create_log(SysMessageLog(
                    task_id=task.task_number,
                    message_type=message_type_value,
                    message_content=f'销售订单解析完成，任务已创建。客户: {customer_name}, PO: {po}, 款号: {article}',
                    update_by='system',
                    update_user_id=None,
                    relation_form_id=str(hid),
                ))
            except Exception:
                logger.exception('Failed to write SysMessageLog for task %s', task.task_number)

            # 8. Send DingTalk corp notification to assignee
            if assignee_id:
                try:
                    assignee_user = await UserDao.aget_user(assignee_id)
                    if assignee_user and assignee_user.user_name:
                        dingtalk_userid = assignee_user.user_name
                        pending_info = ''
                        ps = biz_result.get('pending_summary', {})
                        total_pending = sum(len(v) for v in ps.values())
                        if total_pending:
                            pending_info = f"<br/>待补全字段: {total_pending}个"
                        ding_result = await async_send_dingtalk_message(
                            user_list=[dingtalk_userid],
                            link='https://ai.noooyi.com/workspace/task-center',
                            title='新销售订单任务',
                            message_content=(
                                f"客户: {customer_name}<br/>"
                                f"PO: {po}<br/>"
                                f"款号: {article}<br/>"
                                f"任务编号: {task.task_number}"
                                f"{pending_info}"
                            ),
                            message_type='task',
                        )
                        logger.info('DingTalk notification for task %s: %s',
                                    task.task_number, ding_result)
                except Exception:
                    logger.exception('DingTalk notification failed for task %s', task.task_number)

            results.append({
                'task_number': task.task_number,
                'task_id': task.id,
                'header_id': hid,
                'assignee_id': assignee_id,
                'biz_tables': biz_result,
            })

        except Exception:
            logger.exception('Failed to create task for header_id=%d', hid)

    return results


async def _send_dingtalk_notification(webhook_url: str, message: str):
    """Send a notification message to DingTalk group bot."""
    if not webhook_url:
        logger.warning('No DingTalk webhook URL configured, skipping notification')
        return
    try:
        headers = {'Content-Type': 'application/json'}
        data = {'msgtype': 'text', 'text': {'content': message}}
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(webhook_url, headers=headers, json=data)
            resp.raise_for_status()
            logger.info('DingTalk notification sent successfully')
    except Exception:
        logger.exception('Failed to send DingTalk notification')


async def _get_dingtalk_webhook() -> Optional[str]:
    """Get DingTalk webhook URL from config table."""
    try:
        from sqlmodel import text as sql_text
        from mep.core.database.manager import get_sync_db_session
        with get_sync_db_session() as session:
            row = session.execute(
                sql_text("SELECT value FROM config WHERE `key` = 'order_assistant_config' LIMIT 1")
            ).first()
            if row:
                config = json.loads(row[0])
                return config.get('dingtalk_webhook')
    except Exception:
        logger.warning('Failed to load DingTalk webhook from config')
    return None


PER_FILE_TIMEOUT = 600


async def _process_files_background(
    file_tasks: list[dict],
    batch_id: str,
    user_id: Optional[int] = None,
    notify_url: Optional[str] = None,
):
    """Background task: process uploaded files sequentially, log results, send notification."""
    from mep.database.models.parsing_log import ParsingLogDao

    results = []
    success_count = 0
    fail_count = 0

    for task in file_tasks:
        fname = task['file_name']
        file_url = task['file_url']
        file_type = task['file_type']
        log_id = task.get('log_id')
        is_update = task.get('is_update', False)
        old_file_url = task.get('old_file_url')

        if log_id:
            await ParsingLogDao.update_status(log_id, 'processing')

        if is_update and file_type == 'sales_order' and old_file_url:
            try:
                from mep.database.models.sales_order import SalesOrderDao
                deleted = await SalesOrderDao.delete_orders_by_source_url(old_file_url)
                logger.info('[Batch %s] Deleted %d old order(s) for updated file %s', batch_id, deleted, fname)
            except Exception:
                logger.exception('[Batch %s] Failed to delete old orders for %s', batch_id, fname)

        logger.info('[Batch %s] Processing %s (type=%s, log_id=%s, update=%s)', batch_id, fname, file_type, log_id, is_update)

        try:
            if file_type == 'tp':
                proc = await asyncio.wait_for(_process_tp(file_url, fname), timeout=PER_FILE_TIMEOUT)
            elif file_type == 'sales_order':
                proc = await asyncio.wait_for(_process_sales_order(file_url, fname), timeout=PER_FILE_TIMEOUT)
            else:
                proc = {'success': False, 'error': f'未知文件类型: {file_type}'}

            if proc.get('success'):
                success_count += 1
                summary = json.dumps(proc.get('result', {}), ensure_ascii=False, default=str)
                if log_id:
                    await ParsingLogDao.update_status(log_id, 'success', result_summary=summary[:2000])
                results.append(f'✓ {fname}: 解析成功')
                logger.info('[Batch %s] %s parsed successfully', batch_id, fname)
            else:
                fail_count += 1
                error = proc.get('error', '未知错误')
                if log_id:
                    await ParsingLogDao.update_status(log_id, 'failed', error_message=error)
                results.append(f'✗ {fname}: {error}')
                logger.warning('[Batch %s] %s failed: %s', batch_id, fname, error[:200])

        except asyncio.TimeoutError:
            fail_count += 1
            error = f'解析超时 (>{PER_FILE_TIMEOUT}s)'
            if log_id:
                await ParsingLogDao.update_status(log_id, 'failed', error_message=error)
            results.append(f'✗ {fname}: {error}')
            logger.error('[Batch %s] %s timed out after %ds', batch_id, fname, PER_FILE_TIMEOUT)

        except Exception as e:
            fail_count += 1
            error_detail = traceback.format_exc()
            if log_id:
                await ParsingLogDao.update_status(log_id, 'failed', error_message=error_detail[:2000])
            results.append(f'✗ {fname}: {str(e)}')
            logger.exception('[Batch %s] Processing failed for %s', batch_id, fname)

    logger.info('[Batch %s] Complete: %d success, %d failed', batch_id, success_count, fail_count)

    webhook_url = notify_url or await _get_dingtalk_webhook()
    if webhook_url:
        msg_lines = [
            f'[订单解析通知] 批次: {batch_id}',
            f'总计: {len(file_tasks)} 个文件',
            f'成功: {success_count}, 失败: {fail_count}',
            '',
            '详情:',
        ]
        msg_lines.extend(results)
        await _send_dingtalk_notification(webhook_url, '\n'.join(msg_lines))


def _detect_file_type_by_name(filename: str) -> str:
    """Server-side file type detection as fallback."""
    lower = filename.lower()
    if any(kw in lower for kw in ('tp', 'techpack', 'tech_pack', 'tech-pack', 'tech pack')):
        return 'tp'
    if any(kw in lower for kw in ('po', 'order', 'sales', 'hkm', 'supplier')):
        return 'sales_order'
    ext = lower.rsplit('.', 1)[-1] if '.' in lower else ''
    if ext == 'pdf':
        return 'sales_order'
    if ext in ('xlsx', 'xls', 'csv'):
        return 'tp'
    return 'sales_order'


@router.post('/process')
async def process_files(
    files: List[UploadFile] = File(...),
    file_type: Optional[str] = Form(None),
    file_types: Optional[str] = Form(None),
    notify_url: Optional[str] = Form(None),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """
    Upload and process order files.

    file_type: single type for ALL files ('tp' or 'sales_order').
    file_types: JSON array of per-file types (overrides file_type).
    notify_url: optional DingTalk webhook URL for completion notification.

    All files are uploaded first, then parsed sequentially in background.
    Results are sent via DingTalk notification upon completion.
    """
    per_file_types: list[str] = []
    if file_types:
        try:
            per_file_types = json.loads(file_types)
        except (json.JSONDecodeError, TypeError):
            pass

    from mep.database.models.parsing_log import ParsingLogDao

    batch_id = str(uuid4())[:8]
    file_tasks = []
    upload_results = []
    duplicate_count = 0
    updated_count = 0

    file_metas: list[dict] = []
    for idx, f in enumerate(files):
        fname = f.filename or 'unknown'
        if idx < len(per_file_types) and per_file_types[idx] in ('tp', 'sales_order'):
            ft = per_file_types[idx]
        elif file_type in ('tp', 'sales_order'):
            ft = file_type
        else:
            ft = _detect_file_type_by_name(fname)
        content = await f.read()
        await f.close()
        file_hash = hashlib.md5(content).hexdigest()
        file_metas.append({'name': fname, 'type': ft, 'content': content, 'hash': file_hash})

    for m in file_metas:
        fname, ft, file_hash = m['name'], m['type'], m['hash']

        # NOTE: duplicate check disabled — all files proceed to parsing
        # existing_by_hash = await ParsingLogDao.find_by_hash(file_hash)
        # if existing_by_hash:
        #     duplicate_count += 1
        #     ...
        #     continue

        file_url = await _upload_to_minio_from_bytes(m['content'], fname)
        del m['content']

        if not file_url:
            upload_results.append({
                'file_name': fname, 'status': 'upload_failed',
                'message': '文件上传失败',
            })
            await ParsingLogDao.create({
                'batch_id': batch_id,
                'file_name': fname,
                'file_type': ft,
                'file_hash': file_hash,
                'status': 'upload_failed',
                'error_message': '文件上传到MinIO失败',
                'user_id': login_user.user_id if login_user else None,
            })
            continue

        log = await ParsingLogDao.create({
            'batch_id': batch_id,
            'file_name': fname,
            'file_url': file_url,
            'file_type': ft,
            'file_hash': file_hash,
            'status': 'pending',
            'user_id': login_user.user_id if login_user else None,
        })

        file_tasks.append({
            'file_name': fname,
            'file_url': file_url,
            'file_type': ft,
            'log_id': log.id,
            'is_update': False,
            'old_file_url': None,
        })
        upload_results.append({
            'file_name': fname,
            'status': 'uploaded',
            'message': '文件已上传，等待解析',
            'file_url': file_url,
        })

    if file_tasks:
        _launch_background_task(
            file_tasks, batch_id,
            user_id=login_user.user_id if login_user else None,
            notify_url=notify_url,
        )

    parts = []
    new_count = sum(1 for r in upload_results if r['status'] == 'uploaded')
    fail_count = sum(1 for r in upload_results if r['status'] == 'upload_failed')
    if new_count:
        parts.append(f'{new_count} 个新文件')
    if updated_count:
        parts.append(f'{updated_count} 个更新文件')
    if duplicate_count:
        parts.append(f'{duplicate_count} 个重复文件已跳过')
    if fail_count:
        parts.append(f'{fail_count} 个上传失败')
    summary = '，'.join(parts) if parts else '无文件处理'
    if file_tasks:
        summary += '，正在后台解析，完成后将通过钉钉通知'

    return resp_200({
        'batch_id': batch_id,
        'total': len(upload_results),
        'uploaded': new_count + updated_count,
        'upload_failed': fail_count,
        'duplicate': duplicate_count,
        'updated': updated_count,
        'message': summary,
        'results': upload_results,
    })


@router.get('/parsing-logs')
async def list_parsing_logs(
    batch_id: Optional[str] = None,
    status: Optional[str] = None,
    file_name: Optional[str] = None,
    file_type: Optional[str] = None,
    sort_by: str = 'id',
    sort_order: str = 'desc',
    page_num: int = 1,
    page_size: int = 15,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """List parsing logs with optional filters and sorting."""
    from mep.database.models.parsing_log import ParsingLogDao

    filters = {}
    if batch_id:
        filters['batch_id'] = batch_id
    if status:
        filters['status'] = status
    if file_name:
        filters['file_name'] = file_name
    if file_type:
        filters['file_type'] = file_type

    allowed_sort_fields = {'id', 'file_type', 'status', 'create_time', 'file_name'}
    if sort_by not in allowed_sort_fields:
        sort_by = 'id'
    if sort_order not in ('asc', 'desc'):
        sort_order = 'desc'

    items, total = await ParsingLogDao.list_logs(
        filters, page_num, page_size, sort_by=sort_by, sort_order=sort_order,
    )
    return resp_200({
        'list': [item.dict() for item in items],
        'total': total,
        'page_num': page_num,
        'page_size': page_size,
    })


@router.get('/parsing-logs/{batch_id}')
async def get_batch_logs(
    batch_id: str,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """Get all parsing logs for a specific batch."""
    from mep.database.models.parsing_log import ParsingLogDao
    items = await ParsingLogDao.list_by_batch(batch_id)
    return resp_200([item.dict() for item in items])


@router.post('/parsing-logs/{log_id}/cancel')
async def cancel_log(
    log_id: int,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """Cancel a pending/processing parsing log."""
    from mep.database.models.parsing_log import ParsingLogDao
    ok = await ParsingLogDao.cancel(log_id)
    if ok:
        return resp_200({'message': '已取消'})
    return resp_500(message='无法取消，当前状态不允许')


@router.post('/parsing-logs/{log_id}/retry')
async def retry_log(
    log_id: int,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """Retry a failed/cancelled parsing log."""
    from mep.database.models.parsing_log import ParsingLogDao
    log = await ParsingLogDao.reset_for_retry(log_id)
    if not log or not log.file_url:
        return resp_500(message='无法重试，记录不存在或状态不允许')

    task = {
        'file_name': log.file_name,
        'file_url': log.file_url,
        'file_type': log.file_type or 'sales_order',
        'log_id': log.id,
    }
    _launch_background_task(
        [task], log.batch_id,
        user_id=login_user.user_id if login_user else None,
    )
    return resp_200({'message': '已重新触发解析', 'log_id': log.id})


@router.post('/retry-stuck')
async def retry_stuck_files(
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """Find files stuck in pending/processing and re-trigger background parsing."""
    from mep.database.models.parsing_log import ParsingLogDao

    stuck_items = await ParsingLogDao.list_stuck()
    if not stuck_items:
        return resp_200({'message': '没有卡住的文件', 'retried': 0})

    batches: dict[str, list[dict]] = {}
    for item in stuck_items:
        if not item.file_url or not item.batch_id:
            continue
        batches.setdefault(item.batch_id, []).append({
            'file_name': item.file_name,
            'file_url': item.file_url,
            'file_type': item.file_type or 'sales_order',
            'log_id': item.id,
        })

    total_retried = 0
    for bid, tasks in batches.items():
        _launch_background_task(
            tasks, bid,
            user_id=login_user.user_id if login_user else None,
        )
        total_retried += len(tasks)

    return resp_200({
        'message': f'已重新触发 {total_retried} 个卡住的文件',
        'retried': total_retried,
        'batches': list(batches.keys()),
    })
