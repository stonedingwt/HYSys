"""Audit log for all queries made through the assistant.

Every tool invocation (knowledge-base search, sales-order query, SQL agent,
etc.) writes a row here so that administrators can review what data was
accessed, by whom, and when.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, String, Text, Index, text, func
from sqlmodel import Field, select

from mep.common.models.base import SQLModelSerializable
from mep.core.database import get_async_db_session, get_sync_db_session

logger = logging.getLogger(__name__)


class AssistantQueryLog(SQLModelSerializable, table=True):
    __tablename__ = 'assistant_query_log'

    id: Optional[int] = Field(default=None, primary_key=True)

    user_id: int = Field(
        sa_column=Column(String(64), nullable=False, comment='操作用户ID'),
    )
    user_name: str = Field(
        sa_column=Column(String(64), nullable=False, server_default='', comment='操作用户名'),
    )
    query_text: str = Field(
        sa_column=Column(Text, nullable=False, comment='用户原始查询'),
    )
    query_type: str = Field(
        sa_column=Column(String(32), nullable=False, server_default='', comment='查询类型'),
    )
    tool_name: str = Field(
        sa_column=Column(String(64), nullable=False, server_default='', comment='调用的工具名'),
    )
    query_params: Optional[str] = Field(
        default=None,
        sa_column=Column(Text, nullable=True, comment='工具接收的参数JSON'),
    )
    result_summary: Optional[str] = Field(
        default=None,
        sa_column=Column(String(500), nullable=True, comment='结果摘要'),
    )
    permission_scope: Optional[str] = Field(
        default=None,
        sa_column=Column(String(500), nullable=True, comment='权限范围'),
    )
    chat_id: Optional[str] = Field(
        default=None,
        sa_column=Column(String(64), nullable=True, comment='会话ID'),
    )
    create_time: Optional[datetime] = Field(
        default=None,
        sa_column=Column(
            DateTime, nullable=False, index=True,
            server_default=text('CURRENT_TIMESTAMP'),
        ),
    )

    __table_args__ = (
        Index('idx_aql_user_id', 'user_id'),
        Index('idx_aql_query_type', 'query_type'),
        {
            'mysql_charset': 'utf8mb4',
            'mysql_collate': 'utf8mb4_unicode_ci',
            'comment': '助手查询审计日志表',
            'extend_existing': True,
        },
    )


class AssistantQueryLogDao:

    @classmethod
    async def create(cls, log: AssistantQueryLog) -> AssistantQueryLog:
        async with get_async_db_session() as session:
            session.add(log)
            await session.commit()
            await session.refresh(log)
            return log

    @classmethod
    def create_sync(cls, log: AssistantQueryLog) -> AssistantQueryLog:
        with get_sync_db_session() as session:
            session.add(log)
            session.commit()
            session.refresh(log)
            return log

    @classmethod
    async def list_logs(
        cls,
        user_id: Optional[int] = None,
        query_type: str = '',
        page: int = 1,
        page_size: int = 20,
    ):
        async with get_async_db_session() as session:
            base = select(AssistantQueryLog)
            count_base = select(func.count()).select_from(AssistantQueryLog)

            if user_id is not None:
                base = base.where(AssistantQueryLog.user_id == str(user_id))
                count_base = count_base.where(AssistantQueryLog.user_id == str(user_id))
            if query_type:
                base = base.where(AssistantQueryLog.query_type == query_type)
                count_base = count_base.where(AssistantQueryLog.query_type == query_type)

            total = (await session.exec(count_base)).one()
            stmt = base.order_by(AssistantQueryLog.create_time.desc())
            stmt = stmt.offset((page - 1) * page_size).limit(page_size)
            items = (await session.exec(stmt)).all()
            return items, total


def log_query_sync(
    *,
    user_id: int,
    user_name: str = '',
    query_text: str = '',
    query_type: str = '',
    tool_name: str = '',
    query_params: dict | None = None,
    result_summary: str = '',
    permission_scope: str = '',
    chat_id: str = '',
) -> None:
    """Fire-and-forget helper to write an audit row (sync, for LangChain tools)."""
    try:
        AssistantQueryLogDao.create_sync(AssistantQueryLog(
            user_id=user_id,
            user_name=user_name,
            query_text=query_text,
            query_type=query_type,
            tool_name=tool_name,
            query_params=json.dumps(query_params, ensure_ascii=False) if query_params else None,
            result_summary=result_summary[:500] if result_summary else '',
            permission_scope=permission_scope[:500] if permission_scope else '',
            chat_id=chat_id or '',
        ))
    except Exception:
        logger.exception('Failed to write assistant query audit log')
