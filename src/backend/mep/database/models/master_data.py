from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, Integer, String, text
from sqlalchemy import or_
from sqlmodel import Field, select, col, func

from mep.common.models.base import SQLModelSerializable
from mep.core.database import get_async_db_session


class Customer(SQLModelSerializable, table=True):
    __tablename__ = 'master_customer'
    __table_args__ = {'comment': '客户主数据 - 客户信息和负责人配置'}

    id: Optional[int] = Field(default=None, primary_key=True)
    customer_code: str = Field(sa_column=Column(String(100), index=True, nullable=False, comment='客户编码'))
    customer_name: str = Field(sa_column=Column(String(200), nullable=False, comment='客户名称'))
    customer_short_name: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='客户简称'))
    customer_tags: Optional[str] = Field(default=None, sa_column=Column(String(500), nullable=True, comment='客户标签'))
    customer_service_id: Optional[int] = Field(default=None, sa_column=Column(Integer, index=True, nullable=True, comment='客服负责人用户ID'))
    sample_manager_id: Optional[int] = Field(default=None, sa_column=Column(Integer, index=True, nullable=True, comment='打样负责人用户ID'))
    process_manager_id: Optional[int] = Field(default=None, sa_column=Column(Integer, index=True, nullable=True, comment='工艺负责人用户ID'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), comment='更新时间'))


class Supplier(SQLModelSerializable, table=True):
    __tablename__ = 'master_supplier'
    __table_args__ = {'comment': '供应商主数据 - 供应商联系和绑定信息'}

    id: Optional[int] = Field(default=None, primary_key=True)
    supplier_code: str = Field(sa_column=Column(String(100), index=True, nullable=False, comment='供应商编码'))
    supplier_name: str = Field(sa_column=Column(String(200), nullable=False, comment='供应商名称'))
    address: Optional[str] = Field(default=None, sa_column=Column(String(500), nullable=True, comment='地址'))
    supplier_type: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='供应商类型'))
    contact_name: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='联系人'))
    phone: Optional[str] = Field(default=None, sa_column=Column(String(50), nullable=True, comment='联系电话'))
    wechat: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='微信号'))
    qr_code: Optional[str] = Field(default=None, sa_column=Column(String(500), nullable=True, comment='二维码URL'))
    bound_user_id: Optional[int] = Field(default=None, sa_column=Column(Integer, index=True, nullable=True, comment='绑定用户ID'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), comment='更新时间'))


class ProductionLine(SQLModelSerializable, table=True):
    __tablename__ = 'master_production_line'
    __table_args__ = {'comment': '产线主数据 - 生产线配置'}

    id: Optional[int] = Field(default=None, primary_key=True)
    line_name: str = Field(sa_column=Column(String(200), nullable=False, comment='产线名称'))
    factory: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='所属工厂'))
    manager_id: Optional[int] = Field(default=None, sa_column=Column(Integer, index=True, nullable=True, comment='产线负责人用户ID'))
    product_family_tags: Optional[str] = Field(default=None, sa_column=Column(String(500), nullable=True, comment='适用产品族标签'))
    priority_order: Optional[int] = Field(default=None, sa_column=Column(Integer, nullable=True, comment='优先级排序'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), comment='更新时间'))


class PlanManager(SQLModelSerializable, table=True):
    __tablename__ = 'master_plan_manager'
    __table_args__ = {'comment': '计划主管 - 计划排产负责人'}

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, sa_column=Column(Integer, index=True, nullable=True, comment='用户ID'))
    factory: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='所属工厂'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), comment='更新时间'))


class WarehouseManager(SQLModelSerializable, table=True):
    __tablename__ = 'master_warehouse_manager'
    __table_args__ = {'comment': '仓库主管 - 仓库管理负责人'}

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, sa_column=Column(Integer, index=True, nullable=True, comment='用户ID'))
    warehouse_name: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='仓库名称'))
    factory: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='所属工厂'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), comment='更新时间'))


class QualityManager(SQLModelSerializable, table=True):
    __tablename__ = 'master_quality_manager'
    __table_args__ = {'comment': '质量主管 - 品质管理负责人'}

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, sa_column=Column(Integer, index=True, nullable=True, comment='用户ID'))
    tags: Optional[str] = Field(default=None, sa_column=Column(String(500), nullable=True, comment='负责标签'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), comment='更新时间'))


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

    @classmethod
    async def get_all_customer_names(cls) -> list[str]:
        """Return all customer names."""
        async with get_async_db_session() as session:
            rows = (await session.exec(
                select(Customer.customer_name).order_by(Customer.customer_name)
            )).all()
            return [r for r in rows if r]

    @classmethod
    async def get_customer_names_for_user(cls, user_id: int) -> list[str]:
        """Return customer_name list where user is customer_service or sample_manager."""
        if not user_id:
            return []
        async with get_async_db_session() as session:
            rows = (await session.exec(
                select(Customer.customer_name).where(
                    or_(
                        Customer.customer_service_id == user_id,
                        Customer.sample_manager_id == user_id,
                    )
                )
            )).all()
            return [r for r in rows if r]

    @classmethod
    def get_customer_names_for_user_sync(cls, user_id: int) -> list[str]:
        """Sync version for workflow agents."""
        if not user_id:
            return []
        from mep.core.database.manager import get_sync_db_session
        from sqlmodel import text as sql_text
        with get_sync_db_session() as session:
            rows = session.execute(
                sql_text(
                    "SELECT customer_name FROM master_customer "
                    "WHERE customer_service_id = :uid OR sample_manager_id = :uid"
                ),
                {'uid': user_id},
            ).fetchall()
            return [r[0] for r in rows if r[0]]

    @classmethod
    async def get_customer_by_name(cls, customer_name: str) -> Optional['Customer']:
        """根据客户名称查找客户记录，先精确匹配 customer_name，再模糊匹配 customer_short_name。"""
        if not customer_name:
            return None
        name = customer_name.strip()
        async with get_async_db_session() as session:
            exact = (await session.exec(
                select(Customer).where(Customer.customer_name == name)
            )).first()
            if exact:
                return exact

            fuzzy = (await session.exec(
                select(Customer).where(
                    or_(
                        col(Customer.customer_name).contains(name),
                        col(Customer.customer_short_name).contains(name),
                    )
                )
            )).first()
            return fuzzy
