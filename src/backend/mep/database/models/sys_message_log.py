from datetime import datetime
from typing import Optional, List

from sqlalchemy import Column, DateTime, String, Text, Index, text, func
from sqlmodel import Field, select

from mep.common.models.base import SQLModelSerializable
from mep.core.database import get_async_db_session


class SysMessageLog(SQLModelSerializable, table=True):
    """系统消息日志表 - 记录所有关键消息更新（任务创建、信息更新、风险提示等）"""

    __tablename__ = "sys_message_log"

    id: Optional[int] = Field(default=None, primary_key=True)

    task_id: str = Field(
        sa_column=Column(String(64), nullable=False, comment='任务ID'),
    )

    message_type: str = Field(
        sa_column=Column(String(32), nullable=False, comment='消息类型'),
    )

    message_content: str = Field(
        sa_column=Column(Text, nullable=False, comment='消息内容'),
    )

    update_by: str = Field(
        sa_column=Column(String(64), nullable=False, comment='更新人/操作人'),
    )

    update_user_id: Optional[int] = Field(
        default=None,
        sa_column=Column(String(64), nullable=True, comment='操作人用户ID'),
    )

    relation_form_id: Optional[str] = Field(
        default=None,
        sa_column=Column(String(64), nullable=True, comment='关联表单ID'),
    )

    create_time: Optional[datetime] = Field(
        default=None,
        sa_column=Column(
            DateTime, nullable=False, index=True,
            server_default=text('CURRENT_TIMESTAMP'),
        ),
    )

    update_time: Optional[datetime] = Field(
        default=None,
        sa_column=Column(
            DateTime, nullable=False,
            server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        ),
    )

    __table_args__ = (
        Index('idx_sml_task_id', 'task_id'),
        Index('idx_sml_update_time', 'update_time'),
        {
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
            "comment": "系统消息日志表",
            "extend_existing": True,
        },
    )


class SysMessageLogDao:

    @classmethod
    async def create_log(cls, log: SysMessageLog) -> SysMessageLog:
        async with get_async_db_session() as session:
            session.add(log)
            await session.commit()
            await session.refresh(log)
            return log

    @classmethod
    async def list_by_task(cls, task_id: str, page: int = 1, page_size: int = 50):
        async with get_async_db_session() as session:
            base = select(SysMessageLog).where(SysMessageLog.task_id == task_id)
            count_stmt = select(func.count()).select_from(SysMessageLog).where(
                SysMessageLog.task_id == task_id,
            )
            total = (await session.exec(count_stmt)).one()
            stmt = base.order_by(SysMessageLog.create_time.desc())
            stmt = stmt.offset((page - 1) * page_size).limit(page_size)
            items = (await session.exec(stmt)).all()
            return items, total

    @classmethod
    async def list_by_form(cls, relation_form_id: str, page: int = 1, page_size: int = 50):
        async with get_async_db_session() as session:
            base = select(SysMessageLog).where(
                SysMessageLog.relation_form_id == relation_form_id,
            )
            count_stmt = select(func.count()).select_from(SysMessageLog).where(
                SysMessageLog.relation_form_id == relation_form_id,
            )
            total = (await session.exec(count_stmt)).one()
            stmt = base.order_by(SysMessageLog.create_time.desc())
            stmt = stmt.offset((page - 1) * page_size).limit(page_size)
            items = (await session.exec(stmt)).all()
            return items, total

    @classmethod
    async def get_latest_by_task(cls, task_id: str) -> Optional[SysMessageLog]:
        async with get_async_db_session() as session:
            result = await session.exec(
                select(SysMessageLog)
                .where(SysMessageLog.task_id == task_id)
                .order_by(SysMessageLog.create_time.desc())
                .limit(1)
            )
            return result.first()
