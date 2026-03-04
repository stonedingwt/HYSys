"""
Scheduled Task Celery Tasks
定时任务执行逻辑
"""
import time
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from loguru import logger

from mep.worker.main import mep_celery
from mep.database.models.scheduled_task import (
    ScheduledTask, ScheduledTaskDao, ScheduledTaskLogDao
)
from mep.database.models.flow import FlowDao
from mep.utils import generate_uuid


def _send_failure_email(task: ScheduledTask, error_message: str, log_id: int):
    """Send email notification on task failure"""
    if not task.notify_on_failure or not task.notify_email or not task.smtp_server:
        return
    try:
        subject = f"[MEP] 定时任务执行失败: {task.name}"
        body = f"""
        <html>
        <body>
        <h2>定时任务执行失败通知</h2>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
            <tr><td><b>任务名称</b></td><td>{task.name}</td></tr>
            <tr><td><b>任务ID</b></td><td>{task.id}</td></tr>
            <tr><td><b>工作流</b></td><td>{task.workflow_name or task.workflow_id}</td></tr>
            <tr><td><b>Cron表达式</b></td><td>{task.cron_expression}</td></tr>
            <tr><td><b>失败时间</b></td><td>{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</td></tr>
            <tr><td><b>日志ID</b></td><td>{log_id}</td></tr>
            <tr><td><b>错误信息</b></td><td style="color: red;">{error_message}</td></tr>
        </table>
        <p>请登录系统查看详细日志。</p>
        </body>
        </html>
        """

        msg = MIMEMultipart()
        msg['From'] = task.smtp_account
        msg['To'] = task.notify_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html', 'utf-8'))

        if task.smtp_port == 465:
            server = smtplib.SMTP_SSL(task.smtp_server, task.smtp_port, timeout=30)
        else:
            server = smtplib.SMTP(task.smtp_server, task.smtp_port, timeout=30)
            server.starttls()

        server.login(task.smtp_account, task.smtp_password)
        recipients = [e.strip() for e in task.notify_email.split(',') if e.strip()]
        server.sendmail(task.smtp_account, recipients, msg.as_string())
        server.quit()
        logger.info(f"Failure notification email sent for task {task.id} to {task.notify_email}")
    except Exception as e:
        logger.error(f"Failed to send failure email for task {task.id}: {e}")


def _execute_scheduled_workflow(task_id: int, triggered_by: str = "scheduler"):
    """Core logic for executing a scheduled workflow task"""
    task = ScheduledTaskDao.get_task_by_id(task_id)
    if not task:
        logger.warning(f"Scheduled task {task_id} not found")
        return

    start_time = time.time()
    now = datetime.now()

    log = ScheduledTaskLogDao.create_log(
        task_id=task.id,
        task_name=task.name,
        workflow_id=task.workflow_id,
        workflow_name=task.workflow_name,
        status="running",
        triggered_by=triggered_by,
    )

    ScheduledTaskDao.update_last_run(task.id, "running", now)

    try:
        flow_info = FlowDao.get_flow_by_id(task.workflow_id)
        if not flow_info:
            raise Exception(f"工作流 {task.workflow_id} 不存在")

        if not flow_info.data:
            raise Exception(f"工作流 {task.workflow_id} 没有数据")

        from mep.workflow.graph.workflow import Workflow
        from mep.workflow.common.workflow import WorkflowStatus
        from mep.common.services.config_service import settings
        from mep.worker.workflow.redis_callback import RedisCallback

        unique_id = generate_uuid()
        workflow_conf = settings.get_workflow_conf()
        chat_id = generate_uuid()

        redis_callback = RedisCallback(
            unique_id, task.workflow_id, chat_id,
            task.user_id, source="scheduled_task"
        )
        redis_callback.set_workflow_data(flow_info.data)

        workflow = Workflow(
            task.workflow_id, task.workflow_name or flow_info.name,
            task.user_id, flow_info.data, False,
            workflow_conf.max_steps,
            workflow_conf.timeout,
            redis_callback
        )
        redis_callback.workflow = workflow
        status, reason = workflow.run(task.input_params)

        end_time = time.time()
        duration_ms = int((end_time - start_time) * 1000)

        if status == WorkflowStatus.SUCCESS.value:
            ScheduledTaskLogDao.update_log(
                log.id,
                status="success",
                end_time=datetime.now(),
                duration_ms=duration_ms,
                result=f"工作流执行成功, 耗时 {duration_ms}ms"
            )
            ScheduledTaskDao.update_last_run(task.id, "success", now)
            logger.info(f"Scheduled task {task.id} completed successfully in {duration_ms}ms")
        else:
            error_msg = reason or f"工作流状态异常: {status}"
            ScheduledTaskLogDao.update_log(
                log.id,
                status="failed",
                end_time=datetime.now(),
                duration_ms=duration_ms,
                error_message=error_msg
            )
            ScheduledTaskDao.update_last_run(task.id, "failed", now)
            _send_failure_email(task, error_msg, log.id)
            logger.warning(f"Scheduled task {task.id} failed: {error_msg}")

    except Exception as e:
        end_time = time.time()
        duration_ms = int((end_time - start_time) * 1000)
        error_msg = str(e)[:500]
        ScheduledTaskLogDao.update_log(
            log.id,
            status="failed",
            end_time=datetime.now(),
            duration_ms=duration_ms,
            error_message=error_msg
        )
        ScheduledTaskDao.update_last_run(task.id, "failed", now)
        _send_failure_email(task, error_msg, log.id)
        logger.exception(f"Scheduled task {task.id} error: {e}")


@mep_celery.task
def run_scheduled_task(task_id: int, triggered_by: str = "scheduler"):
    """Celery task: execute a scheduled workflow"""
    _execute_scheduled_workflow(task_id, triggered_by)


@mep_celery.task
def sync_sso_users_task(scheduled_task_id: int = None, scheduled_log_id: int = None):
    """Celery task: sync SSO users from configured provider"""
    import asyncio

    start_time = time.time()
    now = datetime.now()

    if scheduled_task_id:
        ScheduledTaskDao.update_last_run(scheduled_task_id, "running", now)

    try:
        from mep.common.services.config_service import settings as mep_settings
        login_method = mep_settings.get_system_login_method()
        sso_type = login_method.sso_type or 'none'

        if sso_type == 'none':
            raise Exception('未配置 SSO 登录方式，无法同步用户')

        from mep.api.v1.sso_sync import _SYNC_HANDLERS
        handler = _SYNC_HANDLERS.get(sso_type)
        if not handler:
            raise Exception(f'不支持的 SSO 类型: {sso_type}')

        result = asyncio.run(handler())
        duration_ms = int((time.time() - start_time) * 1000)

        if result.get('error'):
            raise Exception(result['error'])

        msg = f"同步完成: 总计 {result.get('total', 0)} 人, 新建 {result.get('created', 0)}, 已存在 {result.get('existed', 0)}"
        logger.info(f"SSO user sync ({sso_type}): {msg}")

        if scheduled_task_id:
            ScheduledTaskDao.update_last_run(scheduled_task_id, "success", now)
        if scheduled_log_id:
            ScheduledTaskLogDao.update_log(scheduled_log_id, status="success",
                                           end_time=datetime.now(), duration_ms=duration_ms, result=msg)

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        error_msg = str(e)[:500]
        logger.exception(f"SSO user sync failed: {e}")
        if scheduled_task_id:
            ScheduledTaskDao.update_last_run(scheduled_task_id, "failed", now)
        if scheduled_log_id:
            ScheduledTaskLogDao.update_log(scheduled_log_id, status="failed",
                                           end_time=datetime.now(), duration_ms=duration_ms, error_message=error_msg)


@mep_celery.task
def check_scheduled_tasks():
    """Celery beat task: check and dispatch due scheduled tasks every minute"""
    from mep.worker.scheduled_task.scheduler import check_and_dispatch_tasks
    check_and_dispatch_tasks()
