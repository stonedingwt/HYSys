"""
Scheduled Task API Endpoints
定时任务API端点
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query
from loguru import logger

from mep.api.v1.schemas import resp_200
from mep.common.dependencies.user_deps import UserPayload
from mep.database.models.scheduled_task import (
    ScheduledTaskDao, ScheduledTaskLogDao
)

router = APIRouter(prefix='/scheduled_task', tags=['ScheduledTask'])


@router.get('/list')
def list_tasks(
    page_num: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    keyword: str = Query(default=""),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """获取定时任务列表"""
    data, total = ScheduledTaskDao.get_all_tasks(
        page=page_num, page_size=page_size, keyword=keyword
    )
    return resp_200(data={"data": data, "total": total})


@router.get('/detail')
def get_task(
    task_id: int = Query(...),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """获取任务详情"""
    task = ScheduledTaskDao.get_task_by_id(task_id)
    if not task:
        return resp_200(data=None, message="任务不存在")
    return resp_200(data=task.model_dump())


@router.post('/create')
def create_task(
    data: dict = Body(...),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """创建定时任务"""
    task = ScheduledTaskDao.create_task(
        user_id=login_user.user_id,
        name=data.get('name', ''),
        workflow_id=data.get('workflow_id', ''),
        workflow_name=data.get('workflow_name', ''),
        cron_expression=data.get('cron_expression', ''),
        description=data.get('description', ''),
        enabled=data.get('enabled', True),
        notify_on_failure=data.get('notify_on_failure', False),
        notify_email=data.get('notify_email', ''),
        smtp_server=data.get('smtp_server', ''),
        smtp_port=data.get('smtp_port', 465),
        smtp_account=data.get('smtp_account', ''),
        smtp_password=data.get('smtp_password', ''),
        input_params=data.get('input_params'),
    )
    # Reload scheduler
    _reload_scheduler()
    return resp_200(data=task.model_dump())


@router.post('/update')
def update_task(
    data: dict = Body(...),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """更新定时任务"""
    task_id = data.pop('id', None)
    if not task_id:
        return resp_200(data=None, message="缺少任务ID")

    allowed_fields = [
        'name', 'workflow_id', 'workflow_name', 'cron_expression', 'description',
        'enabled', 'notify_on_failure', 'notify_email', 'smtp_server', 'smtp_port',
        'smtp_account', 'smtp_password', 'input_params'
    ]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    task = ScheduledTaskDao.update_task(task_id, **update_data)
    if not task:
        return resp_200(data=None, message="任务不存在")
    _reload_scheduler()
    return resp_200(data=task.model_dump())


@router.post('/delete')
def delete_task(
    task_id: int = Body(..., embed=True),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """删除定时任务"""
    ok = ScheduledTaskDao.delete_task(task_id)
    _reload_scheduler()
    return resp_200(data={"success": ok})


@router.post('/toggle')
def toggle_task(
    task_id: int = Body(...),
    enabled: bool = Body(...),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """启用/禁用任务"""
    task = ScheduledTaskDao.update_task(task_id, enabled=enabled)
    if not task:
        return resp_200(data=None, message="任务不存在")
    _reload_scheduler()
    return resp_200(data=task.model_dump())


@router.post('/run')
def run_task_now(
    task_id: int = Body(..., embed=True),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """手动立即执行任务"""
    task = ScheduledTaskDao.get_task_by_id(task_id)
    if not task:
        return resp_200(data=None, message="任务不存在")
    try:
        from mep.worker.scheduled_task.tasks import run_scheduled_task
        run_scheduled_task.delay(task.id)
        return resp_200(data={"message": "任务已提交执行"})
    except Exception as e:
        logger.error(f"手动触发任务失败: {e}")
        return resp_200(data=None, message=f"触发失败: {str(e)}")


@router.get('/logs')
def get_task_logs(
    task_id: Optional[int] = Query(default=None),
    page_num: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str = Query(default=""),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """获取任务执行日志"""
    data, total = ScheduledTaskLogDao.get_logs(
        task_id=task_id, page=page_num, page_size=page_size, status=status
    )
    return resp_200(data={"data": data, "total": total})


@router.get('/log_detail')
def get_log_detail(
    log_id: int = Query(...),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """获取日志详情"""
    log = ScheduledTaskLogDao.get_log_by_id(log_id)
    if not log:
        return resp_200(data=None, message="日志不存在")
    return resp_200(data=log.model_dump())


def _reload_scheduler():
    """Signal the scheduler to reload tasks"""
    try:
        from mep.core.cache.redis_manager import get_redis_client_sync
        client = get_redis_client_sync()
        client.set("scheduled_task:reload", "1", ex=60)
    except Exception as e:
        logger.warning(f"Failed to signal scheduler reload: {e}")
