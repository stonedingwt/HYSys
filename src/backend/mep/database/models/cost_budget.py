"""
Data model for Kingdee Production Cost Budget records.
Stores each submission's form data, status and result.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, text
from sqlmodel import Field, select, col, func

from mep.common.models.base import SQLModelSerializable
from mep.core.database import get_async_db_session


class CostBudgetRecord(SQLModelSerializable, table=True):
    __tablename__ = 'cost_budget_record'
    __table_args__ = {'comment': '生产成本预算记录 - 报价助手数据'}

    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: str = Field(sa_column=Column(String(100), index=True, nullable=False, comment='关联任务ID'))
    user_id: Optional[int] = Field(default=None, sa_column=Column(Integer, index=True, nullable=True, comment='操作用户ID'))

    factory_article_no: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='厂款号'))
    order_type: Optional[str] = Field(default=None, sa_column=Column(String(50), nullable=True, comment='订单类型'))
    currency: Optional[str] = Field(default=None, sa_column=Column(String(20), nullable=True, comment='币种'))
    pricing_date: Optional[str] = Field(default=None, sa_column=Column(String(20), nullable=True, comment='定价日期'))
    bom_version: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='BOM版本号'))
    quote_date: Optional[str] = Field(default=None, sa_column=Column(String(20), nullable=True, comment='报价日期'))
    quote_quantity: Optional[int] = Field(default=None, sa_column=Column(Integer, nullable=True, comment='报价数量'))
    quote_size: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='报价尺码'))
    customer: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='客户名称'))
    season: Optional[str] = Field(default=None, sa_column=Column(String(20), nullable=True, comment='季节'))
    quote_type: Optional[str] = Field(default=None, sa_column=Column(String(50), nullable=True, comment='报价类型'))
    production_location: Optional[str] = Field(default=None, sa_column=Column(String(50), nullable=True, comment='生产地点'))
    brand: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='品牌'))
    product_family: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='产品族'))

    material_costs: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True, comment='面料成本JSON'))
    accessory_costs: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True, comment='辅料成本JSON'))
    packaging_costs: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True, comment='包装成本JSON'))
    secondary_costs: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True, comment='二次加工成本JSON'))
    other_costs: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True, comment='其他成本JSON'))

    sewing_gst: Optional[str] = Field(default=None, sa_column=Column(String(50), nullable=True, comment='缝制GST'))
    hour_conversion: Optional[str] = Field(default=None, sa_column=Column(String(50), nullable=True, comment='工时换算'))
    cutting_price: Optional[str] = Field(default=None, sa_column=Column(String(50), nullable=True, comment='裁剪单价'))
    capital_rate: Optional[str] = Field(default=None, sa_column=Column(String(50), nullable=True, comment='资金费率'))
    profit_rate: Optional[str] = Field(default=None, sa_column=Column(String(50), nullable=True, comment='利润率'))
    final_price_rmb: Optional[str] = Field(default=None, sa_column=Column(String(50), nullable=True, comment='最终报价(RMB)'))

    is_final_quote: Optional[bool] = Field(default=False, sa_column=Column(
        Boolean, nullable=False, server_default=text('0'), comment='是否最终报价'))
    status: str = Field(default='draft', sa_column=Column(
        String(20), nullable=False, server_default=text("'draft'"), comment='状态（draft/pending/success/failed）'))
    error_message: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True, comment='错误信息'))
    kingdee_doc_id: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='金蝶单据ID'))

    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), comment='更新时间'))


class CostBudgetDao:

    @classmethod
    async def create(cls, record: CostBudgetRecord) -> CostBudgetRecord:
        async with get_async_db_session() as session:
            session.add(record)
            await session.commit()
            await session.refresh(record)
            return record

    @classmethod
    async def get_by_task_id(cls, task_id: str) -> Optional[CostBudgetRecord]:
        async with get_async_db_session() as session:
            return (await session.exec(
                select(CostBudgetRecord).where(CostBudgetRecord.task_id == task_id)
            )).first()

    @classmethod
    async def list_records(cls, user_id: Optional[int] = None,
                           page_num: int = 1, page_size: int = 15):
        async with get_async_db_session() as session:
            stmt = select(CostBudgetRecord)
            count_stmt = select(func.count()).select_from(CostBudgetRecord)

            if user_id:
                stmt = stmt.where(CostBudgetRecord.user_id == user_id)
                count_stmt = count_stmt.where(CostBudgetRecord.user_id == user_id)

            total = (await session.exec(count_stmt)).one()
            stmt = stmt.order_by(col(CostBudgetRecord.create_time).desc())
            stmt = stmt.offset((page_num - 1) * page_size).limit(page_size)
            items = (await session.exec(stmt)).all()
            return items, total

    @classmethod
    async def get_by_id(cls, record_id: int) -> Optional[CostBudgetRecord]:
        async with get_async_db_session() as session:
            return (await session.exec(
                select(CostBudgetRecord).where(CostBudgetRecord.id == record_id)
            )).first()

    @classmethod
    async def mark_final_quote(cls, record_id: int, task_id: str) -> Optional[CostBudgetRecord]:
        async with get_async_db_session() as session:
            record = (await session.exec(
                select(CostBudgetRecord).where(CostBudgetRecord.id == record_id)
            )).first()
            if record:
                record.is_final_quote = True
                record.task_id = task_id
                record.status = 'pending'
                session.add(record)
                await session.commit()
                await session.refresh(record)
            return record

    @classmethod
    async def update_status(cls, task_id: str, status: str, error_message: str = None):
        async with get_async_db_session() as session:
            record = (await session.exec(
                select(CostBudgetRecord).where(CostBudgetRecord.task_id == task_id)
            )).first()
            if record:
                record.status = status
                if error_message:
                    record.error_message = error_message
                session.add(record)
                await session.commit()
