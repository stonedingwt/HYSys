from datetime import datetime
from typing import Optional, List

from sqlalchemy import Column, DateTime, text, Float, Text
from sqlmodel import Field, select, col, func, delete

from mep.common.models.base import SQLModelSerializable
from mep.core.database import get_async_db_session


class SalesOrderHeader(SQLModelSerializable, table=True):
    """Sales order header / master table."""
    __tablename__ = 'sales_order_header'

    id: Optional[int] = Field(default=None, primary_key=True)
    customer_name: Optional[str] = Field(default=None, max_length=200, index=True)
    po: Optional[str] = Field(default=None, max_length=100, index=True)
    generic_article_no: Optional[str] = Field(default=None, max_length=100, index=True)
    total_amount: Optional[float] = Field(default=None, sa_column=Column(Float, nullable=True))
    total_pieces: Optional[int] = Field(default=None)
    currency: Optional[str] = Field(default=None, max_length=20)
    date_of_issue: Optional[str] = Field(default=None, max_length=50)
    cargo_delivery_date: Optional[str] = Field(default=None, max_length=50)
    presentation_date: Optional[str] = Field(default=None, max_length=50)
    article_description: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    delivery_at: Optional[str] = Field(default=None, max_length=200)
    payment_terms: Optional[str] = Field(default=None, max_length=200)
    delivery_terms: Optional[str] = Field(default=None, max_length=200)
    reference: Optional[str] = Field(default=None, max_length=200)
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP')))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')))


class SalesOrderLine(SQLModelSerializable, table=True):
    """Sales order line / detail table."""
    __tablename__ = 'sales_order_line'

    id: Optional[int] = Field(default=None, primary_key=True)
    header_id: int = Field(index=True)
    article: Optional[str] = Field(default=None, max_length=200)
    colour: Optional[str] = Field(default=None, max_length=100)
    size: Optional[str] = Field(default=None, max_length=100)
    quantity: Optional[int] = Field(default=None)
    tot_pieces: Optional[int] = Field(default=None)
    price_unit_buying: Optional[float] = Field(default=None, sa_column=Column(Float, nullable=True))
    position: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    dc: Optional[str] = Field(default=None, max_length=100)
    warehouse: Optional[str] = Field(default=None, max_length=200)
    flow: Optional[str] = Field(default=None, max_length=200)
    destination: Optional[str] = Field(default=None, max_length=200)
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP')))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')))


HEADER_FIELDS = [
    'customer_name', 'po', 'generic_article_no', 'total_amount', 'total_pieces',
    'currency', 'date_of_issue', 'cargo_delivery_date', 'presentation_date',
    'article_description', 'delivery_at', 'payment_terms', 'delivery_terms', 'reference',
]

LINE_FIELDS = [
    'article', 'colour', 'size', 'quantity', 'tot_pieces',
    'price_unit_buying', 'position', 'description', 'dc', 'warehouse', 'flow', 'destination',
]

ALL_FIELDS = HEADER_FIELDS + LINE_FIELDS


class SalesOrderDao:

    # ─── Header ───

    @classmethod
    async def list_headers(cls, filters: dict, page_num: int = 1,
                           page_size: int = 15, sort_by: str = '', sort_order: str = 'desc'):
        async with get_async_db_session() as session:
            stmt = select(SalesOrderHeader)
            count_stmt = select(func.count()).select_from(SalesOrderHeader)

            for field_name, value in filters.items():
                if not value or not hasattr(SalesOrderHeader, field_name):
                    continue
                col_attr = getattr(SalesOrderHeader, field_name)
                stmt = stmt.where(col(col_attr).contains(str(value)))
                count_stmt = count_stmt.where(col(col_attr).contains(str(value)))

            total = (await session.exec(count_stmt)).one()

            if sort_by and hasattr(SalesOrderHeader, sort_by):
                order_col = getattr(SalesOrderHeader, sort_by)
                stmt = stmt.order_by(order_col.desc() if sort_order == 'desc' else order_col.asc())
            else:
                stmt = stmt.order_by(col(SalesOrderHeader.id).desc())

            stmt = stmt.offset((page_num - 1) * page_size).limit(page_size)
            items = (await session.exec(stmt)).all()
            return items, total

    @classmethod
    async def get_lines(cls, header_id: int) -> list:
        async with get_async_db_session() as session:
            stmt = select(SalesOrderLine).where(
                SalesOrderLine.header_id == header_id
            ).order_by(col(SalesOrderLine.id).asc())
            return (await session.exec(stmt)).all()

    @classmethod
    async def list_all_for_export(cls, filters: dict, sort_by: str = '', sort_order: str = 'desc'):
        """Return header+lines joined for CSV export."""
        async with get_async_db_session() as session:
            stmt = select(SalesOrderHeader)
            for field_name, value in filters.items():
                if not value or not hasattr(SalesOrderHeader, field_name):
                    continue
                col_attr = getattr(SalesOrderHeader, field_name)
                stmt = stmt.where(col(col_attr).contains(str(value)))

            if sort_by and hasattr(SalesOrderHeader, sort_by):
                order_col = getattr(SalesOrderHeader, sort_by)
                stmt = stmt.order_by(order_col.desc() if sort_order == 'desc' else order_col.asc())
            else:
                stmt = stmt.order_by(col(SalesOrderHeader.id).desc())

            headers = (await session.exec(stmt)).all()
            result = []
            for h in headers:
                lines = (await session.exec(
                    select(SalesOrderLine).where(SalesOrderLine.header_id == h.id)
                    .order_by(col(SalesOrderLine.id).asc())
                )).all()
                if lines:
                    for line in lines:
                        result.append((h, line))
                else:
                    result.append((h, None))
            return result

    @classmethod
    async def update_header(cls, item_id: int, data: dict):
        async with get_async_db_session() as session:
            item = (await session.exec(
                select(SalesOrderHeader).where(SalesOrderHeader.id == item_id)
            )).first()
            if not item:
                return None
            for k, v in data.items():
                if k not in ('id', 'create_time', 'update_time') and hasattr(item, k):
                    setattr(item, k, v)
            session.add(item)
            await session.commit()
            await session.refresh(item)
            return item

    @classmethod
    async def update_line(cls, item_id: int, data: dict):
        async with get_async_db_session() as session:
            item = (await session.exec(
                select(SalesOrderLine).where(SalesOrderLine.id == item_id)
            )).first()
            if not item:
                return None
            for k, v in data.items():
                if k not in ('id', 'header_id', 'create_time', 'update_time') and hasattr(item, k):
                    setattr(item, k, v)
            session.add(item)
            await session.commit()
            await session.refresh(item)
            return item
