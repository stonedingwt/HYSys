"""Parsing log model for recording file parsing results."""

from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, Integer, String, text, Text
from sqlmodel import Field, select, col, func

from mep.common.models.base import SQLModelSerializable
from mep.core.database import get_async_db_session


class ParsingLog(SQLModelSerializable, table=True):
    __tablename__ = 'parsing_log'
    __table_args__ = {'comment': '文件解析日志 - 记录文件解析过程和结果'}

    id: Optional[int] = Field(default=None, primary_key=True)
    batch_id: Optional[str] = Field(default=None, sa_column=Column(String(100), index=True, nullable=True, comment='批次ID'))
    file_name: Optional[str] = Field(default=None, sa_column=Column(String(500), nullable=True, comment='文件名'))
    file_url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True, comment='文件URL'))
    file_type: Optional[str] = Field(default=None, sa_column=Column(String(50), nullable=True, comment='文件类型'))
    file_hash: Optional[str] = Field(default=None, sa_column=Column(String(64), index=True, nullable=True, comment='文件内容哈希'))
    status: Optional[str] = Field(default=None, sa_column=Column(String(20), nullable=True, comment='解析状态（pending/processing/success/failed/cancelled）'))
    error_message: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True, comment='错误信息'))
    result_summary: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True, comment='解析结果摘要'))
    user_id: Optional[int] = Field(default=None, sa_column=Column(Integer, index=True, nullable=True, comment='上传用户ID'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))


class ParsingLogDao:

    @classmethod
    async def create(cls, log_data: dict) -> ParsingLog:
        async with get_async_db_session() as session:
            log = ParsingLog(**log_data)
            session.add(log)
            await session.commit()
            await session.refresh(log)
            return log

    @classmethod
    async def update_status(cls, log_id: int, status: str,
                            error_message: str = None, result_summary: str = None):
        async with get_async_db_session() as session:
            log = (await session.exec(
                select(ParsingLog).where(ParsingLog.id == log_id)
            )).first()
            if log:
                log.status = status
                if error_message is not None:
                    log.error_message = error_message
                if result_summary is not None:
                    log.result_summary = result_summary
                session.add(log)
                await session.commit()

    @classmethod
    async def list_by_batch(cls, batch_id: str) -> list:
        async with get_async_db_session() as session:
            stmt = select(ParsingLog).where(
                ParsingLog.batch_id == batch_id
            ).order_by(col(ParsingLog.id).asc())
            return (await session.exec(stmt)).all()

    @classmethod
    async def list_stuck(cls) -> list:
        """Find records stuck in pending/processing (older than 60s)."""
        from datetime import timedelta
        async with get_async_db_session() as session:
            cutoff = datetime.now() - timedelta(seconds=60)
            stmt = select(ParsingLog).where(
                ParsingLog.status.in_(['pending', 'processing']),
                ParsingLog.create_time < cutoff,
            ).order_by(col(ParsingLog.id).asc())
            return (await session.exec(stmt)).all()

    @classmethod
    async def cancel(cls, log_id: int):
        async with get_async_db_session() as session:
            log = (await session.exec(
                select(ParsingLog).where(ParsingLog.id == log_id)
            )).first()
            if log and log.status in ('pending', 'processing'):
                log.status = 'cancelled'
                session.add(log)
                await session.commit()
                return True
            return False

    @classmethod
    async def reset_for_retry(cls, log_id: int) -> Optional['ParsingLog']:
        async with get_async_db_session() as session:
            log = (await session.exec(
                select(ParsingLog).where(ParsingLog.id == log_id)
            )).first()
            if log and log.status in ('failed', 'upload_failed', 'cancelled'):
                log.status = 'pending'
                log.error_message = None
                log.result_summary = None
                session.add(log)
                await session.commit()
                await session.refresh(log)
                return log
            return None

    @classmethod
    async def find_by_hash(cls, file_hash: str) -> Optional['ParsingLog']:
        """Find the most recent successful log with the same content hash."""
        async with get_async_db_session() as session:
            stmt = (
                select(ParsingLog)
                .where(ParsingLog.file_hash == file_hash, ParsingLog.status == 'success')
                .order_by(col(ParsingLog.id).desc())
                .limit(1)
            )
            return (await session.exec(stmt)).first()

    @classmethod
    async def find_by_filename_success(cls, file_name: str) -> Optional['ParsingLog']:
        """Find the most recent successful log with the same file name."""
        async with get_async_db_session() as session:
            stmt = (
                select(ParsingLog)
                .where(ParsingLog.file_name == file_name, ParsingLog.status == 'success')
                .order_by(col(ParsingLog.id).desc())
                .limit(1)
            )
            return (await session.exec(stmt)).first()

    @classmethod
    async def list_logs(cls, filters: dict, page_num: int = 1, page_size: int = 15,
                        sort_by: str = 'id', sort_order: str = 'desc'):
        async with get_async_db_session() as session:
            stmt = select(ParsingLog)
            count_stmt = select(func.count()).select_from(ParsingLog)

            for field_name, value in filters.items():
                if not value or not hasattr(ParsingLog, field_name):
                    continue
                col_attr = getattr(ParsingLog, field_name)
                if field_name == 'status' and value in (
                    'pending', 'processing', 'success', 'failed', 'upload_failed', 'cancelled',
                    'skipped_duplicate',
                ):
                    stmt = stmt.where(col_attr == value)
                    count_stmt = count_stmt.where(col_attr == value)
                else:
                    stmt = stmt.where(col(col_attr).contains(str(value)))
                    count_stmt = count_stmt.where(col(col_attr).contains(str(value)))

            total = (await session.exec(count_stmt)).one()

            sort_col = getattr(ParsingLog, sort_by, None) or ParsingLog.id
            if sort_order == 'asc':
                stmt = stmt.order_by(col(sort_col).asc())
            else:
                stmt = stmt.order_by(col(sort_col).desc())

            stmt = stmt.offset((page_num - 1) * page_size).limit(page_size)
            items = (await session.exec(stmt)).all()
            return items, total
