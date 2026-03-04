from typing import Optional

from fastapi import APIRouter, Depends, Query

from mep.common.schemas.api import resp_200, resp_500
from mep.database.models.sys_message_log import SysMessageLog, SysMessageLogDao
from mep.database.models.data_dict import DataDictDao
from mep.database.models.task_center import TaskDao
from mep.user.domain.services.auth import LoginUser

router = APIRouter(prefix='/message-center', tags=['message_center'])

INFO_TYPE_LABEL = '信息提示'


async def _load_info_type_values() -> set[str]:
    """Return the set of message_type *values* that are non-task-related (信息提示)."""
    try:
        cat = await DataDictDao.find_category_by_code('message_type')
        if not cat:
            return {INFO_TYPE_LABEL}
        items = await DataDictDao.get_items_by_category(cat.id)
        return {it.item_value for it in items if it.item_label == INFO_TYPE_LABEL}
    except Exception:
        return {INFO_TYPE_LABEL}


@router.get('/types')
async def get_message_types(login_user: LoginUser = Depends(LoginUser.get_login_user)):
    """Return message types from data dictionary (category code: message_type)."""
    try:
        cat = await DataDictDao.find_category_by_code('message_type')
        if not cat:
            return resp_200([])
        items = await DataDictDao.get_items_by_category(cat.id)
        result = [
            {
                'label': it.item_label,
                'value': it.item_value,
                'is_task_related': it.item_label != INFO_TYPE_LABEL,
            }
            for it in items
        ]
        return resp_200(result)
    except Exception as e:
        return resp_500(message=str(e))


@router.get('/list')
async def list_messages(
    message_type: Optional[str] = None,
    is_read: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    login_user: LoginUser = Depends(LoginUser.get_login_user),
):
    """List messages with optional filtering. Enriches task-related messages with task info."""
    try:
        items, total = await SysMessageLogDao.list_all(
            message_type=message_type or '',
            is_read=is_read,
            page=page,
            page_size=page_size,
        )

        info_values = await _load_info_type_values()

        task_cache: dict = {}
        result = []
        for msg in items:
            d = msg.dict()
            d['is_task_related'] = msg.message_type not in info_values
            task_number = msg.task_id
            if d['is_task_related'] and task_number:
                if task_number not in task_cache:
                    task = await TaskDao.find_by_number(task_number)
                    task_cache[task_number] = task
                task = task_cache.get(task_number)
                if task:
                    d['task_db_id'] = task.id
                    d['task_name'] = task.task_name
                    d['chat_id'] = task.chat_id
                    d['agent_id'] = task.agent_id
                    d['task_status'] = task.status
                else:
                    d['task_db_id'] = None
                    d['task_name'] = None
                    d['chat_id'] = None
                    d['agent_id'] = None
                    d['task_status'] = None
            result.append(d)

        return resp_200({'items': result, 'total': total, 'page': page, 'page_size': page_size})
    except Exception as e:
        return resp_500(message=str(e))


@router.put('/read/{msg_id}')
async def mark_read(msg_id: int, login_user: LoginUser = Depends(LoginUser.get_login_user)):
    try:
        ok = await SysMessageLogDao.mark_read(msg_id)
        return resp_200({'success': ok})
    except Exception as e:
        return resp_500(message=str(e))


@router.put('/read-all')
async def mark_all_read(login_user: LoginUser = Depends(LoginUser.get_login_user)):
    try:
        count = await SysMessageLogDao.mark_all_read()
        return resp_200({'count': count})
    except Exception as e:
        return resp_500(message=str(e))
