"""Business tables for Order Tracking Assistant upgrade.

Models:
  - BizFollowUp       跟单表
  - BizBom            BOM表头
  - BizBomDetail      BOM明细
  - BizSample         打样单表头
  - BizSampleRatio    打样配比
  - BizSampleMaterial 打样物料明细
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import Column, DateTime, Integer, String, Text, JSON, Boolean, Date, Float, text
from sqlalchemy import DECIMAL as SA_DECIMAL
from sqlmodel import Field, select, col, func, delete

from mep.common.models.base import SQLModelSerializable
from mep.core.database import get_async_db_session


# ---------------------------------------------------------------------------
# 跟单表 biz_follow_up
# ---------------------------------------------------------------------------

class BizFollowUp(SQLModelSerializable, table=True):
    __tablename__ = 'biz_follow_up'
    __table_args__ = {'comment': '跟单表 - 记录跟单任务的核心业务数据'}

    id: Optional[int] = Field(default=None, primary_key=True)
    style_images: Optional[list] = Field(default=None, sa_column=Column(
        JSON, nullable=True, comment='款式图片URL数组，自动从TP提取'))
    primary_image_idx: Optional[int] = Field(default=0, sa_column=Column(
        Integer, nullable=True, server_default=text('0'), comment='首图索引，默认0，用户可调整'))
    factory_article_no: Optional[str] = Field(default=None, sa_column=Column(
        String(128), index=True, nullable=True, comment='厂款号'))
    customer_article_no: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='客户款号'))
    product_desc: Optional[str] = Field(default=None, sa_column=Column(
        String(500), nullable=True, comment='产品描述'))
    material_name: Optional[str] = Field(default=None, sa_column=Column(
        String(2000), nullable=True, comment='物料名称'))
    product_family: Optional[str] = Field(default=None, sa_column=Column(
        String(100), nullable=True, comment='产品族'))
    customer_name: Optional[str] = Field(default=None, sa_column=Column(
        String(200), index=True, nullable=True, comment='所属客户'))
    brand: Optional[str] = Field(default=None, sa_column=Column(
        String(100), nullable=True, comment='品牌'))
    season: Optional[str] = Field(default=None, sa_column=Column(
        String(50), nullable=True, comment='季节'))
    product_category: Optional[str] = Field(default=None, sa_column=Column(
        String(100), nullable=True, comment='产品大类'))
    process_type: Optional[str] = Field(default=None, sa_column=Column(
        String(200), nullable=True, comment='加工工艺'))
    material_group: Optional[str] = Field(default=None, sa_column=Column(
        String(100), nullable=True, comment='物料分组'))
    color: Optional[str] = Field(default=None, sa_column=Column(
        String(200), nullable=True, comment='颜色'))
    size: Optional[str] = Field(default=None, sa_column=Column(
        String(200), nullable=True, comment='尺码'))
    po_number: Optional[str] = Field(default=None, sa_column=Column(
        String(100), index=True, nullable=True, comment='PO采购订单号'))
    header_id: Optional[int] = Field(default=None, sa_column=Column(
        Integer, index=True, nullable=True, comment='关联销售订单头ID'))
    task_id: Optional[int] = Field(default=None, sa_column=Column(
        Integer, index=True, nullable=True, comment='关联任务ID'))
    completeness: Optional[str] = Field(default='incomplete', sa_column=Column(
        String(20), nullable=True, server_default=text("'incomplete'"), comment='数据完整状态'))
    pending_fields: Optional[list] = Field(default=None, sa_column=Column(
        JSON, nullable=True, comment='待补全字段列表'))
    creator_id: Optional[int] = Field(default=None, sa_column=Column(
        Integer, nullable=True, comment='创建人用户ID'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        comment='更新时间'))


# ---------------------------------------------------------------------------
# BOM 表头 biz_bom
# ---------------------------------------------------------------------------

class BizBom(SQLModelSerializable, table=True):
    __tablename__ = 'biz_bom'
    __table_args__ = {'comment': 'BOM表头 - 物料清单主表'}

    id: Optional[int] = Field(default=None, primary_key=True)
    factory_article_no: Optional[str] = Field(default=None, sa_column=Column(
        String(128), index=True, nullable=True, comment='厂款号'))
    customer_article_no: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='客款号'))
    color_group: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='颜色组'))
    color_group_name: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='颜色组名'))
    size_group: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='尺码组'))
    size_group_name: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='尺码组名'))
    stage: Optional[str] = Field(default=None, sa_column=Column(
        String(64), nullable=True, comment='阶段（打样/大货/发单/包装）'))
    material_group: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='物料分组'))
    material_name: Optional[str] = Field(default=None, sa_column=Column(
        String(2000), nullable=True, comment='物料名称'))
    version: Optional[str] = Field(default='V1.0', sa_column=Column(
        String(256), nullable=True, server_default=text("'V1.0'"), comment='版本号'))
    contract_no: Optional[str] = Field(default=None, sa_column=Column(
        String(256), nullable=True, comment='订单合同号'))
    pattern_maker: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='版师'))
    use_org: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='使用组织'))
    task_id: Optional[int] = Field(default=None, sa_column=Column(
        Integer, index=True, nullable=True, comment='关联任务ID'))
    follow_up_id: Optional[int] = Field(default=None, sa_column=Column(
        Integer, index=True, nullable=True, comment='关联跟单表ID'))
    completeness: Optional[str] = Field(default='incomplete', sa_column=Column(
        String(20), nullable=True, server_default=text("'incomplete'"), comment='数据完整状态'))
    pending_fields: Optional[list] = Field(default=None, sa_column=Column(
        JSON, nullable=True, comment='待补全字段列表'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        comment='更新时间'))


# ---------------------------------------------------------------------------
# BOM 明细 biz_bom_detail
# ---------------------------------------------------------------------------

class BizBomDetail(SQLModelSerializable, table=True):
    __tablename__ = 'biz_bom_detail'
    __table_args__ = {'comment': 'BOM明细 - 物料清单行级数据'}

    id: Optional[int] = Field(default=None, primary_key=True)
    bom_id: Optional[int] = Field(default=None, sa_column=Column(
        Integer, index=True, nullable=True, comment='关联BOM表头ID'))
    position: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='部位'))
    material_name: Optional[str] = Field(default=None, sa_column=Column(
        String(2000), nullable=True, comment='物料名称'))
    material_code: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='物料编码'))
    inventory_category: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='存货类别（面料/辅料/外协）'))
    composition: Optional[str] = Field(default=None, sa_column=Column(
        String(256), nullable=True, comment='成份'))
    width: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='门幅'))
    color: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='颜色'))
    check_unit: Optional[str] = Field(default=None, sa_column=Column(
        String(64), nullable=True, comment='核料单位'))
    weight: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='克重'))
    check_usage: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='核料用量'))
    direction: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='方向'))
    supplier_code: Optional[str] = Field(default=None, sa_column=Column(
        String(256), nullable=True, comment='供应商编码'))
    material_attr: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='物料属性'))
    unified_spec: Optional[str] = Field(default=None, sa_column=Column(
        String(256), nullable=True, comment='统一规格'))
    size: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='尺码'))
    is_size_mapping: Optional[bool] = Field(default=False, sa_column=Column(
        Boolean, nullable=True, server_default=text('0'), comment='是否配码'))
    size_mapping: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='配码'))
    loss_percent: Optional[str] = Field(default=None, sa_column=Column(
        String(32), nullable=True, comment='损耗率'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        comment='更新时间'))


# ---------------------------------------------------------------------------
# 打样单表头 biz_sample
# ---------------------------------------------------------------------------

class BizSample(SQLModelSerializable, table=True):
    __tablename__ = 'biz_sample'
    __table_args__ = {'comment': '打样单表头 - 打样通知单主表'}

    id: Optional[int] = Field(default=None, primary_key=True)
    style_images: Optional[list] = Field(default=None, sa_column=Column(
        JSON, nullable=True, comment='款式图片URL数组'))
    primary_image_idx: Optional[int] = Field(default=0, sa_column=Column(
        Integer, nullable=True, server_default=text('0'), comment='首图索引'))
    order_code: Optional[str] = Field(default=None, sa_column=Column(
        String(255), unique=True, nullable=True, comment='打样单据编号'))
    sample_type: Optional[str] = Field(default=None, sa_column=Column(
        String(255), nullable=True, comment='打样类型'))
    sample_applicant: Optional[str] = Field(default=None, sa_column=Column(
        String(255), nullable=True, comment='打样申请人'))
    dev_type: Optional[str] = Field(default=None, sa_column=Column(
        String(255), nullable=True, comment='开发类型'))
    customer_name: Optional[str] = Field(default=None, sa_column=Column(
        String(255), index=True, nullable=True, comment='客户名称'))
    factory_article_no: Optional[str] = Field(default=None, sa_column=Column(
        String(255), index=True, nullable=True, comment='厂款号'))
    customer_article_no: Optional[str] = Field(default=None, sa_column=Column(
        String(255), nullable=True, comment='客款号'))
    material_name: Optional[str] = Field(default=None, sa_column=Column(
        String(255), nullable=True, comment='物料名称'))
    process_type: Optional[str] = Field(default=None, sa_column=Column(
        String(500), nullable=True, comment='加工工艺'))
    season: Optional[str] = Field(default=None, sa_column=Column(
        String(255), nullable=True, comment='季节'))
    bom_version: Optional[str] = Field(default=None, sa_column=Column(
        String(255), nullable=True, comment='BOM版本'))
    unit: Optional[str] = Field(default=None, sa_column=Column(
        String(255), nullable=True, comment='样衣单位'))
    sample_qty: Optional[int] = Field(default=None, sa_column=Column(
        Integer, nullable=True, comment='样衣数量'))
    reserve_qty: Optional[int] = Field(default=None, sa_column=Column(
        Integer, nullable=True, comment='留样总数'))
    color: Optional[str] = Field(default=None, sa_column=Column(
        String(255), nullable=True, comment='颜色'))
    size: Optional[str] = Field(default=None, sa_column=Column(
        String(255), nullable=True, comment='尺码'))
    product_category: Optional[str] = Field(default=None, sa_column=Column(
        String(255), nullable=True, comment='产品大类'))
    category: Optional[str] = Field(default=None, sa_column=Column(
        String(255), nullable=True, comment='品类'))
    pattern_maker: Optional[str] = Field(default=None, sa_column=Column(
        String(255), nullable=True, comment='版师'))
    required_date: Optional[date] = Field(default=None, sa_column=Column(
        Date, nullable=True, comment='需求日期'))
    plan_date: Optional[date] = Field(default=None, sa_column=Column(
        Date, nullable=True, comment='业务排单日期'))
    expected_delivery: Optional[date] = Field(default=None, sa_column=Column(
        Date, nullable=True, comment='预计交样日期'))
    actual_delivery: Optional[date] = Field(default=None, sa_column=Column(
        Date, nullable=True, comment='实际交样日期'))
    apply_date: Optional[date] = Field(default=None, sa_column=Column(
        Date, nullable=True, comment='申请日期'))
    fabric_status: Optional[str] = Field(default='未齐备', sa_column=Column(
        String(255), nullable=True, server_default=text("'未齐备'"), comment='面料齐备状态'))
    accessory_status: Optional[str] = Field(default='未齐备', sa_column=Column(
        String(255), nullable=True, server_default=text("'未齐备'"), comment='辅料齐备状态'))
    reserve_type: Optional[str] = Field(default=None, sa_column=Column(
        String(255), nullable=True, comment='预留类型'))
    gst: Optional[str] = Field(default=None, sa_column=Column(
        String(255), nullable=True, comment='GST'))
    gst_minutes: Optional[int] = Field(default=None, sa_column=Column(
        Integer, nullable=True, comment='GST分钟数'))
    sample_remark: Optional[str] = Field(default=None, sa_column=Column(
        Text, nullable=True, comment='样品备注'))
    contract_no: Optional[str] = Field(default=None, sa_column=Column(
        String(256), nullable=True, comment='订单合同号'))
    task_id: Optional[int] = Field(default=None, sa_column=Column(
        Integer, index=True, nullable=True, comment='关联任务ID'))
    follow_up_id: Optional[int] = Field(default=None, sa_column=Column(
        Integer, index=True, nullable=True, comment='关联跟单表ID'))
    completeness: Optional[str] = Field(default='incomplete', sa_column=Column(
        String(20), nullable=True, server_default=text("'incomplete'"), comment='数据完整状态'))
    pending_fields: Optional[list] = Field(default=None, sa_column=Column(
        JSON, nullable=True, comment='待补全字段列表'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        comment='更新时间'))


# ---------------------------------------------------------------------------
# 打样配比 biz_sample_ratio
# ---------------------------------------------------------------------------

class BizSampleRatio(SQLModelSerializable, table=True):
    __tablename__ = 'biz_sample_ratio'
    __table_args__ = {'comment': '打样配比 - 打样单颜色尺码配比'}

    id: Optional[int] = Field(default=None, primary_key=True)
    sample_id: Optional[int] = Field(default=None, sa_column=Column(
        Integer, index=True, nullable=True, comment='关联打样单ID'))
    color: Optional[str] = Field(default=None, sa_column=Column(
        String(255), nullable=True, comment='颜色'))
    size: Optional[str] = Field(default=None, sa_column=Column(
        String(255), nullable=True, comment='尺码'))
    unit: Optional[str] = Field(default=None, sa_column=Column(
        String(64), nullable=True, comment='单位'))
    pattern_maker: Optional[str] = Field(default=None, sa_column=Column(
        String(255), nullable=True, comment='版师'))
    quantity: Optional[int] = Field(default=None, sa_column=Column(
        Integer, nullable=True, comment='数量'))
    remark: Optional[str] = Field(default=None, sa_column=Column(
        Text, nullable=True, comment='备注'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        comment='更新时间'))


# ---------------------------------------------------------------------------
# 打样物料明细 biz_sample_material
# ---------------------------------------------------------------------------

class BizSampleMaterial(SQLModelSerializable, table=True):
    __tablename__ = 'biz_sample_material'
    __table_args__ = {'comment': '打样物料明细 - 打样单BOM物料'}

    id: Optional[int] = Field(default=None, primary_key=True)
    sample_id: Optional[int] = Field(default=None, sa_column=Column(
        Integer, index=True, nullable=True, comment='关联打样单ID'))
    material_name: Optional[str] = Field(default=None, sa_column=Column(
        String(2000), nullable=True, comment='BOM物料名称'))
    material_category_big: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='物料大类'))
    material_category_small: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='物料小类'))
    spec: Optional[str] = Field(default=None, sa_column=Column(
        String(256), nullable=True, comment='物料规格'))
    color: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='物料颜色'))
    gram_weight: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='克重'))
    estimated_ready_date: Optional[date] = Field(default=None, sa_column=Column(
        Date, nullable=True, comment='预计齐备日期'))
    material_status: Optional[str] = Field(default='待采购', sa_column=Column(
        String(128), nullable=True, server_default=text("'待采购'"), comment='物料状态'))
    material_composition: Optional[str] = Field(default=None, sa_column=Column(
        String(256), nullable=True, comment='物料成分'))
    supplier_code: Optional[str] = Field(default=None, sa_column=Column(
        String(256), nullable=True, comment='供应商编码'))
    loss_percent: Optional[str] = Field(default=None, sa_column=Column(
        String(32), nullable=True, comment='损耗百分比'))
    position: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='部位'))
    dosage_numerator: Optional[Decimal] = Field(default=None, sa_column=Column(
        SA_DECIMAL(10, 4), nullable=True, comment='用量分子'))
    dosage_denominator: Optional[Decimal] = Field(default=None, sa_column=Column(
        SA_DECIMAL(10, 4), nullable=True, server_default=text('1'), comment='用量分母'))
    unit: Optional[str] = Field(default=None, sa_column=Column(
        String(64), nullable=True, comment='BOM单位'))
    fabric_direction: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='面料方向'))
    bom_version: Optional[str] = Field(default=None, sa_column=Column(
        String(256), nullable=True, comment='BOM版本'))
    effective_width: Optional[str] = Field(default=None, sa_column=Column(
        String(128), nullable=True, comment='有效幅宽'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        comment='更新时间'))


# ---------------------------------------------------------------------------
# DAO helpers
# ---------------------------------------------------------------------------

class BizFollowUpDao:

    @classmethod
    async def create(cls, data: dict) -> BizFollowUp:
        async with get_async_db_session() as session:
            item = BizFollowUp(**data)
            session.add(item)
            await session.commit()
            await session.refresh(item)
            return item

    @classmethod
    async def get_by_id(cls, item_id: int) -> Optional[BizFollowUp]:
        async with get_async_db_session() as session:
            return (await session.exec(
                select(BizFollowUp).where(BizFollowUp.id == item_id)
            )).first()

    @classmethod
    async def get_by_task_id(cls, task_id: int) -> Optional[BizFollowUp]:
        async with get_async_db_session() as session:
            return (await session.exec(
                select(BizFollowUp).where(BizFollowUp.task_id == task_id)
            )).first()

    @classmethod
    async def get_by_po(cls, po_number: str) -> Optional[BizFollowUp]:
        async with get_async_db_session() as session:
            return (await session.exec(
                select(BizFollowUp).where(BizFollowUp.po_number == po_number)
            )).first()

    @classmethod
    async def update(cls, item_id: int, data: dict) -> Optional[BizFollowUp]:
        async with get_async_db_session() as session:
            item = (await session.exec(
                select(BizFollowUp).where(BizFollowUp.id == item_id)
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
    async def list_by_task(cls, task_id: int) -> List[BizFollowUp]:
        async with get_async_db_session() as session:
            return (await session.exec(
                select(BizFollowUp).where(BizFollowUp.task_id == task_id)
            )).all()

    @classmethod
    async def list_all(cls, *, page: int = 1, page_size: int = 20,
                       customer_name: str = '', po_number: str = ''):
        async with get_async_db_session() as session:
            stmt = select(BizFollowUp)
            cnt = select(func.count()).select_from(BizFollowUp)
            if customer_name:
                stmt = stmt.where(col(BizFollowUp.customer_name).contains(customer_name))
                cnt = cnt.where(col(BizFollowUp.customer_name).contains(customer_name))
            if po_number:
                stmt = stmt.where(col(BizFollowUp.po_number).contains(po_number))
                cnt = cnt.where(col(BizFollowUp.po_number).contains(po_number))
            total = (await session.exec(cnt)).one()
            stmt = stmt.order_by(col(BizFollowUp.id).desc())
            stmt = stmt.offset((page - 1) * page_size).limit(page_size)
            items = (await session.exec(stmt)).all()
            return items, total


class BizBomDao:

    @classmethod
    async def create(cls, data: dict) -> BizBom:
        async with get_async_db_session() as session:
            item = BizBom(**data)
            session.add(item)
            await session.commit()
            await session.refresh(item)
            return item

    @classmethod
    async def get_by_id(cls, item_id: int) -> Optional[BizBom]:
        async with get_async_db_session() as session:
            return (await session.exec(
                select(BizBom).where(BizBom.id == item_id)
            )).first()

    @classmethod
    async def get_by_follow_up(cls, follow_up_id: int) -> Optional[BizBom]:
        async with get_async_db_session() as session:
            return (await session.exec(
                select(BizBom).where(BizBom.follow_up_id == follow_up_id)
            )).first()

    @classmethod
    async def update(cls, item_id: int, data: dict) -> Optional[BizBom]:
        async with get_async_db_session() as session:
            item = (await session.exec(
                select(BizBom).where(BizBom.id == item_id)
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


class BizBomDetailDao:

    @classmethod
    async def create_batch(cls, items: List[dict]) -> List[BizBomDetail]:
        async with get_async_db_session() as session:
            objs = [BizBomDetail(**d) for d in items]
            session.add_all(objs)
            await session.commit()
            for o in objs:
                await session.refresh(o)
            return objs

    @classmethod
    async def list_by_bom(cls, bom_id: int) -> List[BizBomDetail]:
        async with get_async_db_session() as session:
            return (await session.exec(
                select(BizBomDetail).where(BizBomDetail.bom_id == bom_id)
                .order_by(col(BizBomDetail.id).asc())
            )).all()

    @classmethod
    async def replace_all(cls, bom_id: int, items: List[dict]) -> List[BizBomDetail]:
        async with get_async_db_session() as session:
            await session.exec(delete(BizBomDetail).where(BizBomDetail.bom_id == bom_id))
            objs = [BizBomDetail(bom_id=bom_id, **d) for d in items]
            session.add_all(objs)
            await session.commit()
            for o in objs:
                await session.refresh(o)
            return objs


class BizSampleDao:

    @classmethod
    async def create(cls, data: dict) -> BizSample:
        async with get_async_db_session() as session:
            item = BizSample(**data)
            session.add(item)
            await session.commit()
            await session.refresh(item)
            return item

    @classmethod
    async def get_by_id(cls, item_id: int) -> Optional[BizSample]:
        async with get_async_db_session() as session:
            return (await session.exec(
                select(BizSample).where(BizSample.id == item_id)
            )).first()

    @classmethod
    async def get_by_follow_up(cls, follow_up_id: int) -> Optional[BizSample]:
        async with get_async_db_session() as session:
            return (await session.exec(
                select(BizSample).where(BizSample.follow_up_id == follow_up_id)
            )).first()

    @classmethod
    async def update(cls, item_id: int, data: dict) -> Optional[BizSample]:
        async with get_async_db_session() as session:
            item = (await session.exec(
                select(BizSample).where(BizSample.id == item_id)
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


class BizSampleRatioDao:

    @classmethod
    async def replace_all(cls, sample_id: int, items: List[dict]) -> List[BizSampleRatio]:
        async with get_async_db_session() as session:
            await session.exec(delete(BizSampleRatio).where(BizSampleRatio.sample_id == sample_id))
            objs = [BizSampleRatio(sample_id=sample_id, **d) for d in items]
            session.add_all(objs)
            await session.commit()
            for o in objs:
                await session.refresh(o)
            return objs

    @classmethod
    async def list_by_sample(cls, sample_id: int) -> List[BizSampleRatio]:
        async with get_async_db_session() as session:
            return (await session.exec(
                select(BizSampleRatio).where(BizSampleRatio.sample_id == sample_id)
                .order_by(col(BizSampleRatio.id).asc())
            )).all()


class BizSampleMaterialDao:

    @classmethod
    async def replace_all(cls, sample_id: int, items: List[dict]) -> List[BizSampleMaterial]:
        async with get_async_db_session() as session:
            await session.exec(
                delete(BizSampleMaterial).where(BizSampleMaterial.sample_id == sample_id))
            objs = [BizSampleMaterial(sample_id=sample_id, **d) for d in items]
            session.add_all(objs)
            await session.commit()
            for o in objs:
                await session.refresh(o)
            return objs

    @classmethod
    async def list_by_sample(cls, sample_id: int) -> List[BizSampleMaterial]:
        async with get_async_db_session() as session:
            return (await session.exec(
                select(BizSampleMaterial).where(BizSampleMaterial.sample_id == sample_id)
                .order_by(col(BizSampleMaterial.id).asc())
            )).all()
