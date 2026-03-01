"""Packing specification model for configurable packing list parameters."""

from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, Float, Integer, String, text, Text
from sqlmodel import Field, select, col, func

from mep.common.models.base import SQLModelSerializable
from mep.core.database import get_async_db_session


class PackingSpec(SQLModelSerializable, table=True):
    __tablename__ = 'packing_spec'
    __table_args__ = {'comment': '包装规格 - 客户包装参数配置'}

    id: Optional[int] = Field(default=None, primary_key=True)
    customer_name: Optional[str] = Field(default=None, sa_column=Column(String(200), index=True, nullable=True, comment='客户名称'))
    customer_id: Optional[int] = Field(default=None, sa_column=Column(Integer, index=True, nullable=True, comment='关联客户ID'))
    article_no: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='款号'))
    box_carton: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='箱型'))
    box_max: Optional[int] = Field(default=50, sa_column=Column(Integer, nullable=True, server_default=text('50'), comment='每箱最大数量'))
    box_volume: Optional[float] = Field(default=None, sa_column=Column(Float, nullable=True, comment='箱体积'))
    net_weight: Optional[float] = Field(default=None, sa_column=Column(Float, nullable=True, comment='净重'))
    gross_weight: Optional[float] = Field(default=None, sa_column=Column(Float, nullable=True, comment='毛重'))
    bag_size: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='袋子尺寸'))
    box_height: Optional[int] = Field(default=None, sa_column=Column(Integer, nullable=True, comment='箱高度'))
    remark: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True, comment='备注'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=True, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), comment='更新时间'))


class PackingSpecDao:

    @classmethod
    async def create(cls, data: dict) -> PackingSpec:
        async with get_async_db_session() as session:
            spec = PackingSpec(**data)
            session.add(spec)
            await session.commit()
            await session.refresh(spec)
            return spec

    @classmethod
    async def update(cls, spec_id: int, data: dict) -> Optional[PackingSpec]:
        async with get_async_db_session() as session:
            spec = (await session.exec(
                select(PackingSpec).where(PackingSpec.id == spec_id)
            )).first()
            if not spec:
                return None
            for k, v in data.items():
                if hasattr(spec, k) and k not in ('id', 'create_time'):
                    setattr(spec, k, v)
            session.add(spec)
            await session.commit()
            await session.refresh(spec)
            return spec

    @classmethod
    async def delete(cls, spec_id: int) -> bool:
        async with get_async_db_session() as session:
            spec = (await session.exec(
                select(PackingSpec).where(PackingSpec.id == spec_id)
            )).first()
            if not spec:
                return False
            await session.delete(spec)
            await session.commit()
            return True

    @classmethod
    async def get_by_id(cls, spec_id: int) -> Optional[PackingSpec]:
        async with get_async_db_session() as session:
            return (await session.exec(
                select(PackingSpec).where(PackingSpec.id == spec_id)
            )).first()

    @classmethod
    async def list_specs(cls, filters: dict = None, page_num: int = 1, page_size: int = 50,
                         sort_by: str = 'id', sort_order: str = 'desc'):
        async with get_async_db_session() as session:
            stmt = select(PackingSpec)
            count_stmt = select(func.count()).select_from(PackingSpec)

            if filters:
                for k, v in filters.items():
                    if not v or not hasattr(PackingSpec, k):
                        continue
                    col_attr = getattr(PackingSpec, k)
                    stmt = stmt.where(col(col_attr).contains(str(v)))
                    count_stmt = count_stmt.where(col(col_attr).contains(str(v)))

            total = (await session.exec(count_stmt)).one()

            sort_col = getattr(PackingSpec, sort_by, None) or PackingSpec.id
            if sort_order == 'asc':
                stmt = stmt.order_by(col(sort_col).asc())
            else:
                stmt = stmt.order_by(col(sort_col).desc())

            stmt = stmt.offset((page_num - 1) * page_size).limit(page_size)
            items = (await session.exec(stmt)).all()
            return items, total

    @classmethod
    async def find_by_customer(cls, customer_name: str) -> list:
        """Find specs matching a customer name (partial match)."""
        async with get_async_db_session() as session:
            stmt = select(PackingSpec).where(
                col(PackingSpec.customer_name).contains(customer_name)
            ).order_by(col(PackingSpec.id).desc())
            return (await session.exec(stmt)).all()
