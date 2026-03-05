import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from mep.common.schemas.api import resp_200, resp_500
from mep.database.models.task_center import (
    Task, TaskForm, TaskUpdateLog,
    TaskDao, TaskFocusDao, TaskFormDao, TaskUpdateLogDao,
    generate_task_number,
)
from mep.user.domain.services.auth import LoginUser
from mep.user.domain.models.user_role import UserRoleDao
from mep.user.domain.models.user import UserDao

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/task-center', tags=['task_center'])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TaskCreateReq(BaseModel):
    task_name: str
    task_type: str
    status: str = 'in_progress'
    priority_label: str = '普通'
    agent_id: Optional[str] = None
    chat_id: Optional[str] = None
    assignee_id: Optional[int] = None
    due_date: Optional[str] = None
    description: Optional[str] = None
    main_form_type: Optional[str] = None
    main_form_id: Optional[int] = None
    tags: Optional[list] = None
    extra: Optional[dict] = None


class TaskUpdateReq(BaseModel):
    task_name: Optional[str] = None
    status: Optional[str] = None
    priority_label: Optional[str] = None
    agent_id: Optional[str] = None
    assignee_id: Optional[int] = None
    due_date: Optional[str] = None
    description: Optional[str] = None
    main_form_type: Optional[str] = None
    main_form_id: Optional[int] = None
    tags: Optional[list] = None
    extra: Optional[dict] = None


class TransferReq(BaseModel):
    new_assignee_id: int


class FormAddReq(BaseModel):
    form_type: str
    form_id: Optional[int] = None
    form_name: str
    is_main: bool = False


class LogAddReq(BaseModel):
    log_type: str
    form_type: Optional[str] = None
    form_id: Optional[int] = None
    content: Optional[str] = None
    detail: Optional[dict] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _can_access_task(task: Task, login_user: LoginUser) -> bool:
    if login_user.is_admin():
        return True
    return task.assignee_id == login_user.user_id or task.creator_id == login_user.user_id


# ---------------------------------------------------------------------------
# Task CRUD
# ---------------------------------------------------------------------------

@router.get('/list')
async def list_tasks(
    status: Optional[str] = None,
    task_type: Optional[str] = None,
    keyword: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = 'create_time',
    sort_order: str = 'desc',
    login_user: LoginUser = Depends(LoginUser.get_login_user),
):
    try:
        items, total = await TaskDao.list_tasks(
            user_id=login_user.user_id,
            is_admin=login_user.is_admin(),
            status=status, task_type=task_type, keyword=keyword,
            page=page, page_size=page_size,
            sort_by=sort_by, sort_order=sort_order,
        )
        focused_ids = set(await TaskFocusDao.get_focused_task_ids(login_user.user_id))

        chat_ids = [t.chat_id for t in items if t.chat_id]
        latest_msgs: dict = {}
        if chat_ids:
            try:
                from mep.database.models.message import ChatMessageDao
                for cid in chat_ids:
                    msg = await ChatMessageDao.aget_latest_message_by_chatid(cid)
                    if msg:
                        latest_msgs[cid] = msg
            except Exception:
                logger.debug('Failed to fetch latest messages for task list')

        data = []
        for t in items:
            d = t.model_dump()
            d['is_focused'] = t.id in focused_ids
            msg = latest_msgs.get(t.chat_id) if t.chat_id else None
            if msg:
                d['latest_message'] = msg.message[:200] if msg.message else None
                d['latest_message_time'] = str(msg.create_time) if msg.create_time else None
            else:
                d['latest_message'] = None
                d['latest_message_time'] = None
            data.append(d)
        return resp_200({'items': data, 'total': total, 'page': page, 'page_size': page_size})
    except Exception as e:
        return resp_500(message=str(e))


@router.get('/stats')
async def get_stats(login_user: LoginUser = Depends(LoginUser.get_login_user)):
    try:
        stats = await TaskDao.get_stats(
            user_id=login_user.user_id,
            is_admin=login_user.is_admin(),
        )
        risk = await TaskDao.get_risk_count(
            user_id=login_user.user_id,
            is_admin=login_user.is_admin(),
        )
        focused = await TaskFocusDao.count_focused(login_user.user_id)
        stats['focused'] = focused
        stats['risk'] = risk
        return resp_200(stats)
    except Exception as e:
        return resp_500(message=str(e))


@router.get('/detail/{task_id}')
async def get_detail(task_id: int, login_user: LoginUser = Depends(LoginUser.get_login_user)):
    try:
        task = await TaskDao.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail='Task not found')
        if not _can_access_task(task, login_user):
            raise HTTPException(status_code=403, detail='No permission')

        focused_ids = set(await TaskFocusDao.get_focused_task_ids(login_user.user_id))
        forms = await TaskFormDao.list_forms(task_id)
        latest_log = await TaskUpdateLogDao.get_latest_log(task_id)

        data = task.model_dump()
        data['is_focused'] = task.id in focused_ids
        data['forms'] = [f.model_dump() for f in forms]
        data['latest_log'] = latest_log.model_dump() if latest_log else None
        return resp_200(data)
    except HTTPException:
        raise
    except Exception as e:
        return resp_500(message=str(e))


@router.post('/create')
async def create_task(req: TaskCreateReq, login_user: LoginUser = Depends(LoginUser.get_login_user)):
    try:
        task_number = await generate_task_number()
        task = Task(
            task_number=task_number,
            task_name=req.task_name,
            task_type=req.task_type,
            status=req.status,
            priority_label=req.priority_label,
            agent_id=req.agent_id,
            chat_id=req.chat_id,
            assignee_id=req.assignee_id or login_user.user_id,
            creator_id=login_user.user_id,
            description=req.description,
            main_form_type=req.main_form_type,
            main_form_id=req.main_form_id,
            tags=req.tags,
            extra=req.extra,
        )
        if req.due_date:
            from datetime import datetime
            task.due_date = datetime.fromisoformat(req.due_date)

        task = await TaskDao.create_task(task)
        await TaskUpdateLogDao.add_log(TaskUpdateLog(
            task_id=task.id, log_type='system',
            content=f'任务创建: {task.task_number}',
            user_id=login_user.user_id, user_name=login_user.user_name,
        ))
        return resp_200(task.model_dump())
    except Exception as e:
        return resp_500(message=str(e))


@router.put('/update/{task_id}')
async def update_task(task_id: int, req: TaskUpdateReq, login_user: LoginUser = Depends(LoginUser.get_login_user)):
    try:
        task = await TaskDao.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail='Task not found')
        if not _can_access_task(task, login_user):
            raise HTTPException(status_code=403, detail='No permission')

        update_data = req.model_dump(exclude_none=True)
        if 'due_date' in update_data and update_data['due_date']:
            from datetime import datetime
            update_data['due_date'] = datetime.fromisoformat(update_data['due_date'])

        old_status = task.status
        updated = await TaskDao.update_task(task_id, update_data)

        if 'status' in update_data and update_data['status'] != old_status:
            await TaskUpdateLogDao.add_log(TaskUpdateLog(
                task_id=task_id, log_type='status_change',
                content=f'状态变更: {old_status} → {update_data["status"]}',
                user_id=login_user.user_id, user_name=login_user.user_name,
            ))

        return resp_200(updated.model_dump() if updated else None)
    except HTTPException:
        raise
    except Exception as e:
        return resp_500(message=str(e))


# ---------------------------------------------------------------------------
# Transfer / Assign
# ---------------------------------------------------------------------------

@router.put('/transfer/{task_id}')
async def transfer_task(task_id: int, req: TransferReq, login_user: LoginUser = Depends(LoginUser.get_login_user)):
    try:
        task = await TaskDao.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail='Task not found')

        if not login_user.is_admin():
            if task.assignee_id != login_user.user_id:
                raise HTTPException(status_code=403, detail='只能转交自己负责的任务')

        current_assignee_id = task.assignee_id or login_user.user_id
        current_roles = {r.role_id for r in UserRoleDao.get_user_roles(current_assignee_id)}
        target_roles = {r.role_id for r in UserRoleDao.get_user_roles(req.new_assignee_id)}

        if not current_roles & target_roles:
            raise HTTPException(status_code=400, detail='目标用户角色不匹配，无法转交')

        old_assignee = task.assignee_id
        await TaskDao.update_task(task_id, {'assignee_id': req.new_assignee_id})

        target_user = await UserDao.aget_user(req.new_assignee_id)
        target_name = target_user.user_name if target_user else str(req.new_assignee_id)
        await TaskUpdateLogDao.add_log(TaskUpdateLog(
            task_id=task_id, log_type='system',
            content=f'任务转交给 {target_name}',
            user_id=login_user.user_id, user_name=login_user.user_name,
        ))
        return resp_200({'message': '转交成功'})
    except HTTPException:
        raise
    except Exception as e:
        return resp_500(message=str(e))


@router.get('/transferable-users/{task_id}')
async def get_transferable_users(task_id: int, login_user: LoginUser = Depends(LoginUser.get_login_user)):
    try:
        task = await TaskDao.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail='Task not found')

        assignee_id = task.assignee_id or login_user.user_id
        exclude_id = assignee_id

        if login_user.is_admin():
            from mep.core.database import get_async_db_session
            from sqlmodel import select as sql_select
            from mep.user.domain.models.user import User
            async with get_async_db_session() as session:
                all_users = (await session.exec(
                    sql_select(User).where(User.delete != 1)
                )).all()
            users = [
                {'user_id': u.user_id, 'user_name': u.user_name}
                for u in all_users
                if u.user_id != exclude_id
            ]
            return resp_200(users)

        role_ids = [r.role_id for r in UserRoleDao.get_user_roles(assignee_id)]
        if not role_ids:
            return resp_200([])

        user_roles = UserRoleDao.get_roles_user(role_ids)
        candidate_ids = list({ur.user_id for ur in user_roles} - {exclude_id})
        if not candidate_ids:
            return resp_200([])

        users = []
        for uid in candidate_ids:
            u = await UserDao.aget_user(uid)
            if u and u.delete != 1:
                users.append({'user_id': u.user_id, 'user_name': u.user_name})
        return resp_200(users)
    except HTTPException:
        raise
    except Exception as e:
        return resp_500(message=str(e))


# ---------------------------------------------------------------------------
# Focus
# ---------------------------------------------------------------------------

@router.post('/focus/{task_id}')
async def toggle_focus(task_id: int, login_user: LoginUser = Depends(LoginUser.get_login_user)):
    try:
        added = await TaskFocusDao.toggle_focus(task_id, login_user.user_id)
        return resp_200({'focused': added})
    except Exception as e:
        return resp_500(message=str(e))


# ---------------------------------------------------------------------------
# Forms
# ---------------------------------------------------------------------------

@router.get('/forms/{task_id}')
async def get_forms(task_id: int, login_user: LoginUser = Depends(LoginUser.get_login_user)):
    try:
        forms = await TaskFormDao.list_forms(task_id)
        return resp_200([f.model_dump() for f in forms])
    except Exception as e:
        return resp_500(message=str(e))


@router.post('/forms/{task_id}')
async def add_form(task_id: int, req: FormAddReq, login_user: LoginUser = Depends(LoginUser.get_login_user)):
    try:
        form = TaskForm(
            task_id=task_id,
            form_type=req.form_type,
            form_id=req.form_id,
            form_name=req.form_name,
            is_main=req.is_main,
        )
        form = await TaskFormDao.add_form(form)
        return resp_200(form.model_dump())
    except Exception as e:
        return resp_500(message=str(e))


@router.delete('/forms/{form_id}')
async def delete_form(form_id: int, login_user: LoginUser = Depends(LoginUser.get_login_user)):
    try:
        await TaskFormDao.delete_form(form_id)
        return resp_200({'message': '删除成功'})
    except Exception as e:
        return resp_500(message=str(e))


# ---------------------------------------------------------------------------
# Update Logs
# ---------------------------------------------------------------------------

@router.get('/logs/{task_id}')
async def get_logs(
    task_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    login_user: LoginUser = Depends(LoginUser.get_login_user),
):
    try:
        items, total = await TaskUpdateLogDao.list_logs(task_id, page, page_size)
        return resp_200({
            'items': [i.model_dump() for i in items],
            'total': total,
        })
    except Exception as e:
        return resp_500(message=str(e))


@router.post('/logs/{task_id}')
async def add_log(task_id: int, req: LogAddReq, login_user: LoginUser = Depends(LoginUser.get_login_user)):
    try:
        log = TaskUpdateLog(
            task_id=task_id,
            log_type=req.log_type,
            form_type=req.form_type,
            form_id=req.form_id,
            content=req.content,
            detail=req.detail,
            user_id=login_user.user_id,
            user_name=login_user.user_name,
        )
        log = await TaskUpdateLogDao.add_log(log)
        return resp_200(log.model_dump())
    except Exception as e:
        return resp_500(message=str(e))


# ---------------------------------------------------------------------------
# Task Stage Management
# ---------------------------------------------------------------------------

async def _get_task_stages(task_type: str) -> list[str]:
    """获取任务类型对应的所有阶段（从数据字典 1002 任务阶段中查询）。"""
    from mep.database.models.data_dict import DataDictDao, DictItem
    from mep.core.database import get_async_db_session
    from sqlmodel import select, col

    cat = await DataDictDao.find_category_by_code('1002')
    if not cat:
        return []
    async with get_async_db_session() as session:
        parent = (await session.exec(
            select(DictItem).where(
                DictItem.item_value == task_type,
                DictItem.parent_id == None,
            )
        )).first()
        if not parent:
            return []
        children = (await session.exec(
            select(DictItem).where(
                DictItem.category_id == cat.id,
                DictItem.parent_id == parent.id,
            ).order_by(col(DictItem.sort_order).asc())
        )).all()
        return [c.item_value for c in children]


@router.get('/stages/{task_id}')
async def get_task_stages(task_id: int, login_user: LoginUser = Depends(LoginUser.get_login_user)):
    """获取任务的所有可用阶段列表和当前阶段索引。"""
    try:
        task = await TaskDao.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail='Task not found')
        stages = await _get_task_stages(task.task_type)
        current_idx = stages.index(task.status) if task.status in stages else -1
        return resp_200({
            'stages': stages,
            'current': task.status,
            'current_index': current_idx,
            'is_last': current_idx == len(stages) - 1 if stages else False,
        })
    except HTTPException:
        raise
    except Exception as e:
        return resp_500(message=str(e))


class StageChangeReq(BaseModel):
    direction: str  # 'next' or 'prev'


@router.put('/stage/{task_id}')
async def change_stage(task_id: int, req: StageChangeReq, login_user: LoginUser = Depends(LoginUser.get_login_user)):
    """切换任务到上一个或下一个阶段。"""
    try:
        task = await TaskDao.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail='Task not found')
        if not _can_access_task(task, login_user):
            raise HTTPException(status_code=403, detail='No permission')

        stages = await _get_task_stages(task.task_type)
        if not stages:
            return resp_500(message='未找到该任务类型的阶段配置')

        current_idx = stages.index(task.status) if task.status in stages else -1
        if current_idx < 0:
            return resp_500(message=f'当前状态 "{task.status}" 不在阶段列表中')

        if req.direction == 'next':
            if current_idx >= len(stages) - 1:
                return resp_500(message='已是最后一个阶段')
            new_status = stages[current_idx + 1]
        elif req.direction == 'prev':
            if current_idx <= 0:
                return resp_500(message='已是第一个阶段')
            new_status = stages[current_idx - 1]
        else:
            return resp_500(message='direction must be "next" or "prev"')

        old_status = task.status
        updated = await TaskDao.update_task(task_id, {'status': new_status})

        await TaskUpdateLogDao.add_log(TaskUpdateLog(
            task_id=task_id,
            log_type='status_change',
            content=f'阶段变更: {old_status} → {new_status}',
            user_id=login_user.user_id,
            user_name=login_user.user_name,
        ))

        return resp_200(updated.model_dump() if updated else None)
    except HTTPException:
        raise
    except Exception as e:
        return resp_500(message=str(e))
