import re
from datetime import datetime
from typing import Optional, List

from sqlalchemy import Column, DateTime, text, Float, Integer, String, Text
from sqlmodel import Field, select, col, func, delete

from mep.common.models.base import SQLModelSerializable
from mep.core.database import get_async_db_session


def _extract_size_fallback(description: Optional[str]) -> Optional[str]:
    """Try to extract size from description when the parser didn't catch it."""
    if not description:
        return None
    sizes = ['3XL', '2XL', 'XXL', 'XL', 'XXS', 'XS', 'L', 'M', 'S']
    clean_desc = re.sub(r'\n:selected:.*$', '', description).strip()
    parts = clean_desc.split(',')
    if len(parts) >= 2:
        last_part = parts[-1].strip()
        bra_match = re.match(r'^([A-H]\d{2,3})$', last_part)
        if bra_match:
            return bra_match.group(1)
        for size in sizes:
            if last_part.upper() == size:
                return size
        if re.match(r'^\d{2,3}$', last_part):
            return last_part
    for size in sizes:
        pattern = re.compile(r',\s*' + re.escape(size) + r'\s*(?:,|$)', re.IGNORECASE)
        if pattern.search(clean_desc):
            return size
        if clean_desc.upper().rstrip().endswith(size):
            trailing = clean_desc.upper().rstrip()
            idx = len(trailing) - len(size)
            if idx == 0 or not trailing[idx - 1].isalpha():
                return size
    num_match = re.search(r',\s*(\d{2,3})\s*$', clean_desc)
    if num_match:
        return num_match.group(1)
    return None


class SalesOrderHeader(SQLModelSerializable, table=True):
    """Sales order header / master table."""
    __tablename__ = 'sales_order_header'
    __table_args__ = {'comment': '销售订单表头 - 存储销售订单主数据'}

    id: Optional[int] = Field(default=None, primary_key=True)
    customer_name: Optional[str] = Field(default=None, sa_column=Column(String(200), index=True, nullable=True, comment='客户名称'))
    po: Optional[str] = Field(default=None, sa_column=Column(String(100), index=True, nullable=True, comment='PO采购订单号'))
    generic_article_no: Optional[str] = Field(default=None, sa_column=Column(String(100), index=True, nullable=True, comment='通用款号'))
    total_amount: Optional[float] = Field(default=None, sa_column=Column(Float, nullable=True, comment='订单总金额'))
    total_pieces: Optional[int] = Field(default=None, sa_column=Column(Integer, nullable=True, comment='总件数'))
    currency: Optional[str] = Field(default=None, sa_column=Column(String(20), nullable=True, comment='币种'))
    date_of_issue: Optional[str] = Field(default=None, sa_column=Column(String(50), nullable=True, comment='签发日期'))
    cargo_delivery_date: Optional[str] = Field(default=None, sa_column=Column(String(50), nullable=True, comment='货物交付日期'))
    presentation_date: Optional[str] = Field(default=None, sa_column=Column(String(50), nullable=True, comment='展示日期'))
    article_description: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True, comment='产品描述'))
    delivery_at: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='交货地点'))
    payment_terms: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='付款条件'))
    delivery_terms: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='交货条件'))
    reference: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='合同参考号'))
    country: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='国家'))
    brand: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='品牌'))
    season: Optional[str] = Field(default=None, sa_column=Column(String(50), nullable=True, comment='季节'))
    factory: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='工厂'))
    source_file_url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True, comment='源文件URL'))
    markdown_url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True, comment='Markdown文件URL'))
    packing_list_url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True, comment='装箱单URL'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), comment='更新时间'))


class SalesOrderLine(SQLModelSerializable, table=True):
    """Sales order line / detail table."""
    __tablename__ = 'sales_order_line'
    __table_args__ = {'comment': '销售订单明细行 - 存储订单行级数据'}

    id: Optional[int] = Field(default=None, primary_key=True)
    header_id: int = Field(sa_column=Column(Integer, index=True, nullable=False, comment='关联订单头ID'))
    article: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='产品款号'))
    colour: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='颜色'))
    size: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='尺码'))
    quantity: Optional[int] = Field(default=None, sa_column=Column(Integer, nullable=True, comment='数量'))
    tot_pieces: Optional[int] = Field(default=None, sa_column=Column(Integer, nullable=True, comment='总件数'))
    price_unit_buying: Optional[float] = Field(default=None, sa_column=Column(Float, nullable=True, comment='采购单价'))
    position: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='位置'))
    description: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True, comment='描述'))
    dc: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='配送中心'))
    warehouse: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='仓库'))
    flow: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='物流流向'))
    destination: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='目的地'))
    ean: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='EAN条码'))
    packing_code: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='包装编码'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), comment='更新时间'))


HEADER_FIELDS = [
    'customer_name', 'po', 'generic_article_no', 'total_amount', 'total_pieces',
    'currency', 'date_of_issue', 'cargo_delivery_date', 'presentation_date',
    'article_description', 'delivery_at', 'payment_terms', 'delivery_terms', 'reference',
    'country', 'brand', 'season', 'factory',
]

LINE_FIELDS = [
    'article', 'colour', 'size', 'quantity', 'tot_pieces',
    'price_unit_buying', 'position', 'description', 'dc', 'warehouse', 'flow', 'destination',
    'ean',
]

ALL_FIELDS = HEADER_FIELDS + LINE_FIELDS


class SalesOrderDao:

    @staticmethod
    def _normalize_date(val: Optional[str]) -> Optional[str]:
        """Convert DD.MM.YYYY or DD/MM/YYYY to YYYY-MM-DD; pass through if already standard."""
        if not val or not isinstance(val, str):
            return val
        val = val.strip()
        for sep in ('.', '/'):
            parts = val.split(sep)
            if len(parts) == 3 and len(parts[0]) <= 2 and len(parts[2]) == 4:
                return f'{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}'
        return val

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

    @classmethod
    async def import_orders(cls, orders: list[dict]) -> list[int]:
        """Bulk import parsed orders into database.

        Args:
            orders: list of order dicts from OrderParser.parse()

        Returns:
            list of created header ids
        """
        header_ids = []
        async with get_async_db_session() as session:
            for order in orders:
                total_amount = order.get('total_amount')
                if isinstance(total_amount, str):
                    try:
                        cleaned = re.sub(r'[^\d,.\-]', '', total_amount).strip()
                        if not cleaned:
                            total_amount = None
                        elif ',' in cleaned and '.' in cleaned:
                            if cleaned.rindex(',') > cleaned.rindex('.'):
                                cleaned = cleaned.replace('.', '').replace(',', '.')
                            else:
                                cleaned = cleaned.replace(',', '')
                            total_amount = float(cleaned)
                        elif ',' in cleaned:
                            parts = cleaned.split(',')
                            if len(parts[-1]) <= 2:
                                cleaned = cleaned.replace(',', '.')
                            else:
                                cleaned = cleaned.replace(',', '')
                            total_amount = float(cleaned)
                        else:
                            total_amount = float(cleaned)
                    except (ValueError, IndexError):
                        total_amount = None

                total_qty = order.get('total_quantity')
                if isinstance(total_qty, str):
                    try:
                        total_qty = int(total_qty.replace(',', ''))
                    except (ValueError, TypeError):
                        total_qty = None

                header = SalesOrderHeader(
                    customer_name=order.get('customer_name'),
                    po=order.get('po_number'),
                    generic_article_no=order.get('generic_article_no'),
                    total_amount=total_amount,
                    total_pieces=total_qty,
                    currency=order.get('currency'),
                    date_of_issue=cls._normalize_date(order.get('issue_date') or order.get('contract_date') or order.get('date_of_issue')),
                    cargo_delivery_date=cls._normalize_date(order.get('cargo_delivery_date')),
                    presentation_date=cls._normalize_date(order.get('presentation_date')),
                    article_description=order.get('article_description'),
                    delivery_at=order.get('delivery_at') or order.get('delivery_location'),
                    payment_terms=order.get('payment_terms'),
                    delivery_terms=order.get('delivery_terms'),
                    reference=order.get('contract_number'),
                    country=order.get('country'),
                    brand=order.get('brand'),
                    season=order.get('season'),
                    factory=order.get('factory'),
                    source_file_url=order.get('source_file_url'),
                    markdown_url=order.get('markdown_url'),
                    packing_list_url=order.get('packing_list_url'),
                )
                session.add(header)
                await session.flush()

                for detail in order.get('details', []):
                    price = detail.get('unit_price')
                    if isinstance(price, str):
                        try:
                            price = float(price.replace(',', '.'))
                        except (ValueError, TypeError):
                            price = None

                    size_val = detail.get('size')
                    if not size_val:
                        size_val = _extract_size_fallback(detail.get('description'))

                    line = SalesOrderLine(
                        header_id=header.id,
                        article=detail.get('article') or detail.get('product_code'),
                        colour=detail.get('color'),
                        size=size_val,
                        quantity=detail.get('quantity'),
                        tot_pieces=detail.get('total_pieces') or detail.get('quantity'),
                        price_unit_buying=price,
                        position=detail.get('position'),
                        description=detail.get('description'),
                        dc=detail.get('dc'),
                        warehouse=detail.get('warehouse'),
                        flow=detail.get('flow'),
                        destination=detail.get('destination'),
                        ean=detail.get('ean'),
                        packing_code=detail.get('packing_code'),
                    )
                    session.add(line)

                header_ids.append(header.id)

            await session.commit()
        return header_ids

    @classmethod
    async def get_header(cls, header_id: int) -> Optional[SalesOrderHeader]:
        async with get_async_db_session() as session:
            return (await session.exec(
                select(SalesOrderHeader).where(SalesOrderHeader.id == header_id)
            )).first()

    @classmethod
    async def update_header(cls, header_id: int, data: dict) -> Optional[SalesOrderHeader]:
        async with get_async_db_session() as session:
            item = (await session.exec(
                select(SalesOrderHeader).where(SalesOrderHeader.id == header_id)
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
    async def delete_orders_by_source_url(cls, source_file_url: str) -> int:
        """Delete all headers and their lines matching the given source file URL."""
        async with get_async_db_session() as session:
            headers = (await session.exec(
                select(SalesOrderHeader).where(
                    SalesOrderHeader.source_file_url == source_file_url
                )
            )).all()
            if not headers:
                return 0
            header_ids = [h.id for h in headers]
            await session.exec(
                delete(SalesOrderLine).where(SalesOrderLine.header_id.in_(header_ids))
            )
            await session.exec(
                delete(SalesOrderHeader).where(SalesOrderHeader.id.in_(header_ids))
            )
            await session.commit()
            return len(header_ids)

