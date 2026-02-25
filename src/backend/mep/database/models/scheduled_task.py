"""
Scheduled Task Model Module
定时任务模型模块
"""
from datetime import datetime
from typing import Dict, List, Optional, Any

from sqlalchemy import Column, DateTime, String, Text, Integer, Boolean, func, text
from sqlmodel import JSON, Field, select, update, col

from mep.common.models.base import SQLModelSerializable
from mep.core.database import get_sync_db_session, get_async_db_session


class ScheduledTaskBase(SQLModelSerializable):
    """定时任务基础字段"""
    name: str = Field(index=True, description="任务名称")
    workflow_id: str = Field(index=True, description="关联的工作流ID")
    workflow_name: Optional[str] = Field(default=None, description="工作流名称(冗余)")
    cron_expression: str = Field(description="Cron表达式, 如 '0 9 * * *' 表示每天9点")
    description: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    enabled: bool = Field(default=True, description="是否启用")
    # Email notification settings
    notify_on_failure: bool = Field(default=False, description="失败时发送邮件通知")
    notify_email: Optional[str] = Field(default=None, description="通知邮箱地址,多个用逗号分隔")
    smtp_server: Optional[str] = Field(default=None, description="SMTP服务器")
    smtp_port: int = Field(default=465, description="SMTP端口")
    smtp_account: Optional[str] = Field(default=None, description="SMTP账户")
    smtp_password: Optional[str] = Field(default=None, description="SMTP密码/授权码")
    # Workflow input parameters
    input_params: Optional[Dict] = Field(default=None, sa_column=Column(JSON, nullable=True))


class ScheduledTask(ScheduledTaskBase, table=True):
    """定时任务表"""
    __tablename__ = "scheduled_task"
    id: int = Field(default=None, primary_key=True)
    user_id: int = Field(index=True, description="创建者ID")
    create_time: Optional[datetime] = Field(
        sa_column=Column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    )
    update_time: Optional[datetime] = Field(
        sa_column=Column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'),
                         onupdate=func.now())
    )
    last_run_time: Optional[datetime] = Field(default=None, sa_column=Column(DateTime, nullable=True))
    last_run_status: Optional[str] = Field(default=None, description="最近运行状态: success/failed/running")


class ScheduledTaskLog(SQLModelSerializable, table=True):
    """定时任务执行日志表"""
    __tablename__ = "scheduled_task_log"
    id: int = Field(default=None, primary_key=True)
    task_id: int = Field(index=True, description="任务ID")
    task_name: str = Field(default="", description="任务名称")
    workflow_id: str = Field(default="", description="工作流ID")
    workflow_name: Optional[str] = Field(default=None, description="工作流名称")
    status: str = Field(default="running", description="状态: running/success/failed")
    start_time: Optional[datetime] = Field(
        sa_column=Column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    )
    end_time: Optional[datetime] = Field(default=None, sa_column=Column(DateTime, nullable=True))
    duration_ms: Optional[int] = Field(default=None, description="执行时长(毫秒)")
    result: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True), description="执行结果摘要")
    error_message: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True), description="错误信息")
    triggered_by: str = Field(default="scheduler", description="触发方式: scheduler/manual")


class ScheduledTaskDao:
    """定时任务数据访问对象"""

    @classmethod
    def get_all_tasks(cls, user_id: Optional[int] = None, page: int = 1, page_size: int = 20,
                      keyword: str = "") -> tuple:
        with get_sync_db_session() as session:
            stmt = select(ScheduledTask)
            if user_id is not None:
                stmt = stmt.where(ScheduledTask.user_id == user_id)
            if keyword:
                stmt = stmt.where(ScheduledTask.name.like(f"%{keyword}%"))
            # Count
            count_stmt = select(func.count()).select_from(stmt.subquery())
            total = session.exec(count_stmt).one()
            # Data
            stmt = stmt.order_by(ScheduledTask.update_time.desc())
            stmt = stmt.offset((page - 1) * page_size).limit(page_size)
            tasks = session.exec(stmt).all()
            return [t.model_dump() for t in tasks], total

    @classmethod
    def get_task_by_id(cls, task_id: int) -> Optional[ScheduledTask]:
        with get_sync_db_session() as session:
            return session.get(ScheduledTask, task_id)

    @classmethod
    def get_enabled_tasks(cls) -> List[ScheduledTask]:
        with get_sync_db_session() as session:
            stmt = select(ScheduledTask).where(ScheduledTask.enabled == True)
            return session.exec(stmt).all()

    @classmethod
    def create_task(cls, user_id: int, **data) -> ScheduledTask:
        with get_sync_db_session() as session:
            task = ScheduledTask(user_id=user_id, **data)
            session.add(task)
            session.commit()
            session.refresh(task)
            return task

    @classmethod
    def update_task(cls, task_id: int, **data) -> Optional[ScheduledTask]:
        with get_sync_db_session() as session:
            task = session.get(ScheduledTask, task_id)
            if not task:
                return None
            for key, value in data.items():
                if hasattr(task, key):
                    setattr(task, key, value)
            session.commit()
            session.refresh(task)
            return task

    @classmethod
    def delete_task(cls, task_id: int) -> bool:
        with get_sync_db_session() as session:
            task = session.get(ScheduledTask, task_id)
            if not task:
                return False
            session.delete(task)
            session.commit()
            return True

    @classmethod
    def update_last_run(cls, task_id: int, status: str, run_time: datetime = None):
        with get_sync_db_session() as session:
            task = session.get(ScheduledTask, task_id)
            if task:
                task.last_run_status = status
                task.last_run_time = run_time or datetime.now()
                session.commit()


class ScheduledTaskLogDao:
    """定时任务日志数据访问对象"""

    @classmethod
    def create_log(cls, **data) -> ScheduledTaskLog:
        with get_sync_db_session() as session:
            log = ScheduledTaskLog(**data)
            session.add(log)
            session.commit()
            session.refresh(log)
            return log

    @classmethod
    def update_log(cls, log_id: int, **data) -> Optional[ScheduledTaskLog]:
        with get_sync_db_session() as session:
            log = session.get(ScheduledTaskLog, log_id)
            if not log:
                return None
            for key, value in data.items():
                if hasattr(log, key):
                    setattr(log, key, value)
            session.commit()
            session.refresh(log)
            return log

    @classmethod
    def get_logs(cls, task_id: Optional[int] = None, page: int = 1, page_size: int = 20,
                 status: str = "") -> tuple:
        with get_sync_db_session() as session:
            stmt = select(ScheduledTaskLog)
            if task_id is not None:
                stmt = stmt.where(ScheduledTaskLog.task_id == task_id)
            if status:
                stmt = stmt.where(ScheduledTaskLog.status == status)
            count_stmt = select(func.count()).select_from(stmt.subquery())
            total = session.exec(count_stmt).one()
            stmt = stmt.order_by(ScheduledTaskLog.start_time.desc())
            stmt = stmt.offset((page - 1) * page_size).limit(page_size)
            logs = session.exec(stmt).all()
            return [l.model_dump() for l in logs], total

    @classmethod
    def get_log_by_id(cls, log_id: int) -> Optional[ScheduledTaskLog]:
        with get_sync_db_session() as session:
            return session.get(ScheduledTaskLog, log_id)
