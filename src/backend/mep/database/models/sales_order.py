import re
from datetime import datetime
from typing import Optional, List

from sqlalchemy import Column, DateTime, text, Integer, String, Text
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
    """Sales order header / master table — maps to `sales_order` in DB."""
    __tablename__ = 'sales_order'
    __table_args__ = {'extend_existing': True}

    id: Optional[int] = Field(default=None, primary_key=True)
    customer_name: Optional[str] = Field(default=None, sa_column=Column('customer_name', String(255), index=True, nullable=True))
    po: Optional[str] = Field(default=None, sa_column=Column('po_number', String(50), index=True, nullable=True))
    generic_article_no: Optional[str] = Field(default=None, sa_column=Column('generic_article_no', String(100), index=True, nullable=True))
    total_amount: Optional[str] = Field(default=None, sa_column=Column('total_amount', String(25), nullable=True))
    total_pieces: Optional[str] = Field(default=None, sa_column=Column('total_quantity', String(25), nullable=True))
    currency: Optional[str] = Field(default=None, sa_column=Column('currency', String(10), nullable=True))
    date_of_issue: Optional[datetime] = Field(default=None, sa_column=Column('issue_date', DateTime, nullable=True))
    cargo_delivery_date: Optional[datetime] = Field(default=None, sa_column=Column('cargo_delivery_date', DateTime, nullable=True))
    presentation_date: Optional[datetime] = Field(default=None, sa_column=Column('presentation_date', DateTime, nullable=True))
    article_description: Optional[str] = Field(default=None, sa_column=Column('article_description', String(500), nullable=True))
    delivery_at: Optional[str] = Field(default=None, sa_column=Column('delivery_location', String(255), nullable=True))
    payment_terms: Optional[str] = Field(default=None, sa_column=Column('payment_terms', String(100), nullable=True))
    delivery_terms: Optional[str] = Field(default=None, sa_column=Column('delivery_terms', String(100), nullable=True))
    reference: Optional[str] = Field(default=None, sa_column=Column('contract_number', String(100), nullable=True))
    country: Optional[str] = Field(default=None, sa_column=Column('country', String(50), nullable=True))
    brand: Optional[str] = Field(default=None, sa_column=Column('brand', String(100), nullable=True))
    season: Optional[str] = Field(default=None, sa_column=Column('season', String(50), nullable=True))
    factory: Optional[str] = Field(default=None, sa_column=Column('factory', String(200), nullable=True))
    source_file_url: Optional[str] = Field(default=None, sa_column=Column('source_file_url', Text, nullable=True))
    markdown_url: Optional[str] = Field(default=None, sa_column=Column('markdown_url', Text, nullable=True))
    packing_list_url: Optional[str] = Field(default=None, sa_column=Column('packing_list_url', String(255), nullable=True))
    is_repeated: Optional[int] = Field(default=None, sa_column=Column('is_repeated', Integer, nullable=True))
    user_id: Optional[int] = Field(default=None, sa_column=Column('user_id', Integer, nullable=True))
    sales_organization: Optional[str] = Field(default=None, sa_column=Column('sales_organization', String(100), nullable=True))
    business_type: Optional[str] = Field(default=None, sa_column=Column('business_type', String(50), nullable=True))
    sales_person: Optional[str] = Field(default=None, sa_column=Column('sales_person', String(50), nullable=True))
    agent_name: Optional[str] = Field(default=None, sa_column=Column('agent', String(255), nullable=True))
    remarks: Optional[str] = Field(default=None, sa_column=Column('remarks', Text, nullable=True))
    file_name: Optional[str] = Field(default=None, sa_column=Column('file_name', String(255), nullable=True))
    process_task_id: Optional[str] = Field(default=None, sa_column=Column('process_task_id', String(50), nullable=True))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        'create_time', DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP')))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        'update_time', DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')))


class SalesOrderLine(SQLModelSerializable, table=True):
    """Sales order line / detail table — maps to `sales_order_detail` in DB."""
    __tablename__ = 'sales_order_detail'
    __table_args__ = {'extend_existing': True}

    id: Optional[int] = Field(default=None, primary_key=True)
    header_id: int = Field(sa_column=Column('order_id', Integer, index=True, nullable=False))
    po_number: Optional[str] = Field(default=None, sa_column=Column('po_number', String(50), nullable=True))
    generic_article_no: Optional[str] = Field(default=None, sa_column=Column('generic_article_no', String(100), nullable=True))
    article_description: Optional[str] = Field(default=None, sa_column=Column('article_description', Text, nullable=True))
    article: Optional[str] = Field(default=None, sa_column=Column('article', String(100), nullable=True))
    product_code: Optional[str] = Field(default=None, sa_column=Column('product_code', String(50), nullable=True))
    customer_product_code: Optional[str] = Field(default=None, sa_column=Column('customer_product_code', String(50), nullable=True))
    colour: Optional[str] = Field(default=None, sa_column=Column('color', String(50), nullable=True))
    size: Optional[str] = Field(default=None, sa_column=Column('size', String(50), nullable=True))
    quantity: Optional[int] = Field(default=None, sa_column=Column('quantity', Integer, nullable=True))
    tot_pieces: Optional[int] = Field(default=None, sa_column=Column('total_pieces', Integer, nullable=True))
    price_unit_buying: Optional[str] = Field(default=None, sa_column=Column('unit_price', String(100), nullable=True))
    position: Optional[str] = Field(default=None, sa_column=Column('position', String(50), nullable=True))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text, nullable=True))
    dc: Optional[str] = Field(default=None, sa_column=Column('dc', String(100), nullable=True))
    warehouse: Optional[str] = Field(default=None, sa_column=Column('warehouse', String(100), nullable=True))
    flow: Optional[str] = Field(default=None, sa_column=Column('flow', String(50), nullable=True))
    destination: Optional[str] = Field(default=None, sa_column=Column('destination', String(255), nullable=True))
    reference: Optional[str] = Field(default=None, sa_column=Column('reference', String(100), nullable=True))
    ean: Optional[str] = Field(default=None, sa_column=Column('ean', String(200), nullable=True))
    packing_code: Optional[str] = Field(default=None, sa_column=Column('packing_code', String(100), nullable=True))
    box_code: Optional[str] = Field(default=None, sa_column=Column('box_code', String(50), nullable=True))
    box_count: Optional[int] = Field(default=None, sa_column=Column('box_count', Integer, nullable=True))
    quantity_per_box: Optional[int] = Field(default=None, sa_column=Column('quantity_per_box', Integer, nullable=True))
    total_price: Optional[str] = Field(default=None, sa_column=Column('total_price', String(100), nullable=True))
    unit: Optional[str] = Field(default=None, sa_column=Column('unit', String(20), nullable=True))
    delivery_date: Optional[datetime] = Field(default=None, sa_column=Column('delivery_date', DateTime, nullable=True))
    image_url: Optional[str] = Field(default=None, sa_column=Column('image_url', String(255), nullable=True))
    line_remarks: Optional[str] = Field(default=None, sa_column=Column('remarks', Text, nullable=True))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        'create_time', DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP')))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        'update_time', DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')))


HEADER_FIELDS = [
    'customer_name', 'po', 'total_amount', 'total_pieces',
    'currency', 'date_of_issue', 'cargo_delivery_date', 'presentation_date',
    'delivery_at', 'payment_terms', 'delivery_terms', 'reference',
    'country', 'brand', 'season', 'factory',
    'sales_organization', 'business_type', 'sales_person',
]

LINE_FIELDS = [
    'generic_article_no', 'article_description',
    'article', 'product_code', 'colour', 'size', 'quantity', 'tot_pieces',
    'price_unit_buying', 'position', 'description', 'dc', 'warehouse', 'flow', 'destination',
    'ean', 'packing_code',
]

ALL_FIELDS = HEADER_FIELDS + LINE_FIELDS


class SalesOrderDao:

    @staticmethod
    def _normalize_date(val) -> Optional[datetime]:
        """Convert date string (DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD) to datetime object."""
        if not val:
            return None
        if isinstance(val, datetime):
            return val
        if not isinstance(val, str):
            return None
        val = val.strip()
        for sep in ('.', '/'):
            parts = val.split(sep)
            if len(parts) == 3 and len(parts[0]) <= 2 and len(parts[2]) == 4:
                val = f'{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}'
                break
        for fmt in ('%Y-%m-%d', '%Y-%m-%d %H:%M:%S'):
            try:
                return datetime.strptime(val, fmt)
            except ValueError:
                continue
        return None

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
                if total_amount is not None:
                    if isinstance(total_amount, (int, float)):
                        total_amount = str(total_amount)
                    elif isinstance(total_amount, str):
                        cleaned = re.sub(r'[^\d,.\-]', '', total_amount).strip()
                        if not cleaned:
                            total_amount = None
                        elif ',' in cleaned and '.' in cleaned:
                            if cleaned.rindex(',') > cleaned.rindex('.'):
                                cleaned = cleaned.replace('.', '').replace(',', '.')
                            else:
                                cleaned = cleaned.replace(',', '')
                            total_amount = cleaned
                        elif ',' in cleaned:
                            parts = cleaned.split(',')
                            if len(parts[-1]) <= 2:
                                cleaned = cleaned.replace(',', '.')
                            else:
                                cleaned = cleaned.replace(',', '')
                            total_amount = cleaned
                        else:
                            total_amount = cleaned

                total_qty = order.get('total_quantity')
                if total_qty is not None:
                    total_qty = str(total_qty).replace(',', '') if total_qty else None

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

                header_generic_no = order.get('generic_article_no')
                header_article_desc = order.get('article_description')

                for detail in order.get('details', []):
                    price = detail.get('unit_price')
                    if price is not None:
                        price = str(price).replace(',', '.')

                    size_val = detail.get('size')
                    if not size_val:
                        size_val = _extract_size_fallback(detail.get('description'))

                    line = SalesOrderLine(
                        header_id=header.id,
                        po_number=order.get('po_number'),
                        generic_article_no=detail.get('generic_article_no') or header_generic_no,
                        article_description=detail.get('article_description') or header_article_desc,
                        article=detail.get('article') or detail.get('product_code'),
                        product_code=detail.get('product_code'),
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

