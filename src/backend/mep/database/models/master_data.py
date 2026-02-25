from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, text
from sqlmodel import Field, select, col, func

from mep.common.models.base import SQLModelSerializable
from mep.core.database import get_async_db_session


class Customer(SQLModelSerializable, table=True):
    __tablename__ = 'master_customer'

    id: Optional[int] = Field(default=None, primary_key=True)
    customer_code: str = Field(index=True, max_length=100)
    customer_name: str = Field(max_length=200)
    customer_short_name: Optional[str] = Field(default=None, max_length=100)
    customer_tags: Optional[str] = Field(default=None, max_length=500)
    customer_service_id: Optional[int] = Field(default=None, index=True)
    sample_manager_id: Optional[int] = Field(default=None, index=True)
    process_manager_id: Optional[int] = Field(default=None, index=True)
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP')))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')))


class Supplier(SQLModelSerializable, table=True):
    __tablename__ = 'master_supplier'

    id: Optional[int] = Field(default=None, primary_key=True)
    supplier_code: str = Field(index=True, max_length=100)
    supplier_name: str = Field(max_length=200)
    address: Optional[str] = Field(default=None, max_length=500)
    supplier_type: Optional[str] = Field(default=None, max_length=100)
    contact_name: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=50)
    wechat: Optional[str] = Field(default=None, max_length=100)
    qr_code: Optional[str] = Field(default=None, max_length=500)
    bound_user_id: Optional[int] = Field(default=None, index=True)
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP')))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')))


class ProductionLine(SQLModelSerializable, table=True):
    __tablename__ = 'master_production_line'

    id: Optional[int] = Field(default=None, primary_key=True)
    line_name: str = Field(max_length=200)
    factory: Optional[str] = Field(default=None, max_length=200)
    manager_id: Optional[int] = Field(default=None, index=True)
    product_family_tags: Optional[str] = Field(default=None, max_length=500)
    priority_order: Optional[int] = Field(default=None)
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP')))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')))


class PlanManager(SQLModelSerializable, table=True):
    __tablename__ = 'master_plan_manager'

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, index=True)
    factory: Optional[str] = Field(default=None, max_length=200)
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP')))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')))


class WarehouseManager(SQLModelSerializable, table=True):
    __tablename__ = 'master_warehouse_manager'

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, index=True)
    warehouse_name: Optional[str] = Field(default=None, max_length=200)
    factory: Optional[str] = Field(default=None, max_length=200)
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP')))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')))


class QualityManager(SQLModelSerializable, table=True):
    __tablename__ = 'master_quality_manager'

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, index=True)
    tags: Optional[str] = Field(default=None, max_length=500)
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP')))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')))


MODEL_MAP = {
    'customer': Customer,
    'supplier': Supplier,
    'production_line': ProductionLine,
    'plan_manager': PlanManager,
    'warehouse_manager': WarehouseManager,
    'quality_manager': QualityManager,
}

SEARCH_FIELDS = {
    'customer': ['customer_code', 'customer_name', 'customer_short_name', 'customer_tags'],
    'supplier': ['supplier_code', 'supplier_name', 'contact_name', 'address'],
    'production_line': ['line_name', 'factory', 'product_family_tags'],
    'plan_manager': ['factory'],
    'warehouse_manager': ['warehouse_name', 'factory'],
    'quality_manager': ['tags'],
}


class MasterDataDao:

    @classmethod
    async def list_items(cls, entity: str, keyword: str = '', page_num: int = 1,
                         page_size: int = 10, sort_by: str = '', sort_order: str = 'desc'):
        model = MODEL_MAP.get(entity)
        if not model:
            return [], 0

        async with get_async_db_session() as session:
            statement = select(model)
            count_stmt = select(func.count()).select_from(model)

            if keyword:
                search_fields = SEARCH_FIELDS.get(entity, [])
                if search_fields:
                    conditions = []
                    for f in search_fields:
                        if hasattr(model, f):
                            conditions.append(col(getattr(model, f)).contains(keyword))
                    if conditions:
                        from sqlalchemy import or_
                        statement = statement.where(or_(*conditions))
                        count_stmt = count_stmt.where(or_(*conditions))

            total = (await session.exec(count_stmt)).one()

            if sort_by and hasattr(model, sort_by):
                order_col = getattr(model, sort_by)
                statement = statement.order_by(order_col.desc() if sort_order == 'desc' else order_col.asc())
            else:
                statement = statement.order_by(col(model.id).desc())

            statement = statement.offset((page_num - 1) * page_size).limit(page_size)
            items = (await session.exec(statement)).all()
            return items, total

    @classmethod
    async def create_item(cls, entity: str, data: dict):
        model = MODEL_MAP.get(entity)
        if not model:
            return None
        async with get_async_db_session() as session:
            item = model(**data)
            session.add(item)
            await session.commit()
            await session.refresh(item)
            return item

    @classmethod
    async def update_item(cls, entity: str, item_id: int, data: dict):
        model = MODEL_MAP.get(entity)
        if not model:
            return None
        async with get_async_db_session() as session:
            item = (await session.exec(select(model).where(model.id == item_id))).first()
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
    async def delete_item(cls, entity: str, item_id: int):
        model = MODEL_MAP.get(entity)
        if not model:
            return False
        async with get_async_db_session() as session:
            item = (await session.exec(select(model).where(model.id == item_id))).first()
            if not item:
                return False
            await session.delete(item)
            await session.commit()
            return True
