from datetime import datetime
from typing import Optional, List

from sqlalchemy import Column, DateTime, text, SmallInteger
from sqlmodel import Field, select, col, func, delete

from mep.common.models.base import SQLModelSerializable
from mep.core.database import get_async_db_session


class DictCategory(SQLModelSerializable, table=True):
    __tablename__ = 'dict_category'

    id: Optional[int] = Field(default=None, primary_key=True)
    parent_id: Optional[int] = Field(default=None, index=True)
    cat_code: str = Field(max_length=100, index=True, unique=True)
    cat_name: str = Field(max_length=200)
    sort_order: int = Field(default=0)
    status: int = Field(default=1, sa_column=Column(SmallInteger, nullable=False, server_default=text('1')))
    remark: Optional[str] = Field(default=None, max_length=500)
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP')))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')))


class DictItem(SQLModelSerializable, table=True):
    __tablename__ = 'dict_item'

    id: Optional[int] = Field(default=None, primary_key=True)
    parent_id: Optional[int] = Field(default=None, index=True)
    category_id: int = Field(index=True)
    item_label: str = Field(max_length=200)
    item_value: str = Field(max_length=200)
    sort_order: int = Field(default=0)
    status: int = Field(default=1, sa_column=Column(SmallInteger, nullable=False, server_default=text('1')))
    remark: Optional[str] = Field(default=None, max_length=500)
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP')))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')))


def _build_tree(items: list, id_field: str = 'id', parent_field: str = 'parent_id') -> list:
    """Build a tree from a flat list of dicts."""
    by_id = {item[id_field]: item for item in items}
    roots = []
    for item in items:
        item['children'] = []
    for item in items:
        pid = item[parent_field]
        if pid and pid in by_id:
            by_id[pid]['children'].append(item)
        else:
            roots.append(item)
    return roots


class DataDictDao:

    # ─── Category ───

    @classmethod
    async def get_category_tree(cls) -> list:
        async with get_async_db_session() as session:
            stmt = select(DictCategory).order_by(col(DictCategory.sort_order).asc(), col(DictCategory.id).asc())
            cats = (await session.exec(stmt)).all()
            return _build_tree([c.dict() for c in cats])

    @classmethod
    async def get_all_categories(cls) -> list:
        async with get_async_db_session() as session:
            stmt = select(DictCategory).order_by(col(DictCategory.sort_order).asc(), col(DictCategory.id).asc())
            return (await session.exec(stmt)).all()

    @classmethod
    async def create_category(cls, data: dict):
        async with get_async_db_session() as session:
            item = DictCategory(**data)
            session.add(item)
            await session.commit()
            await session.refresh(item)
            return item

    @classmethod
    async def update_category(cls, cat_id: int, data: dict):
        async with get_async_db_session() as session:
            item = (await session.exec(select(DictCategory).where(DictCategory.id == cat_id))).first()
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
    async def delete_category(cls, cat_id: int):
        """Delete category and cascade: delete child categories and all related items."""
        async with get_async_db_session() as session:
            all_ids = await cls._collect_child_cat_ids(session, cat_id)
            all_ids.append(cat_id)
            await session.exec(delete(DictItem).where(col(DictItem.category_id).in_(all_ids)))
            await session.exec(delete(DictCategory).where(col(DictCategory.id).in_(all_ids)))
            await session.commit()
            return True

    @classmethod
    async def _collect_child_cat_ids(cls, session, parent_id: int) -> list:
        children = (await session.exec(
            select(DictCategory.id).where(DictCategory.parent_id == parent_id)
        )).all()
        result = list(children)
        for cid in children:
            result.extend(await cls._collect_child_cat_ids(session, cid))
        return result

    @classmethod
    async def find_category_by_code(cls, code: str):
        async with get_async_db_session() as session:
            return (await session.exec(
                select(DictCategory).where(DictCategory.cat_code == code)
            )).first()

    # ─── Item ───

    @classmethod
    async def list_items(cls, category_id: int = 0, keyword: str = '',
                         page_num: int = 1, page_size: int = 15,
                         sort_by: str = '', sort_order: str = 'asc'):
        async with get_async_db_session() as session:
            stmt = select(DictItem)
            count_stmt = select(func.count()).select_from(DictItem)

            if category_id:
                stmt = stmt.where(DictItem.category_id == category_id)
                count_stmt = count_stmt.where(DictItem.category_id == category_id)

            if keyword:
                from sqlalchemy import or_
                cond = or_(
                    col(DictItem.item_label).contains(keyword),
                    col(DictItem.item_value).contains(keyword),
                    col(DictItem.remark).contains(keyword),
                )
                stmt = stmt.where(cond)
                count_stmt = count_stmt.where(cond)

            total = (await session.exec(count_stmt)).one()

            if sort_by and hasattr(DictItem, sort_by):
                order_col = getattr(DictItem, sort_by)
                stmt = stmt.order_by(order_col.desc() if sort_order == 'desc' else order_col.asc())
            else:
                stmt = stmt.order_by(col(DictItem.sort_order).asc(), col(DictItem.id).asc())

            stmt = stmt.offset((page_num - 1) * page_size).limit(page_size)
            items = (await session.exec(stmt)).all()
            return items, total

    @classmethod
    async def get_item_tree(cls, category_id: int) -> list:
        async with get_async_db_session() as session:
            stmt = select(DictItem).where(DictItem.category_id == category_id).order_by(
                col(DictItem.sort_order).asc(), col(DictItem.id).asc())
            items = (await session.exec(stmt)).all()
            return _build_tree([i.dict() for i in items])

    @classmethod
    async def get_items_by_category(cls, category_id: int) -> list:
        async with get_async_db_session() as session:
            stmt = select(DictItem).where(DictItem.category_id == category_id).order_by(
                col(DictItem.sort_order).asc(), col(DictItem.id).asc())
            return (await session.exec(stmt)).all()

    @classmethod
    async def create_item(cls, data: dict):
        async with get_async_db_session() as session:
            item = DictItem(**data)
            session.add(item)
            await session.commit()
            await session.refresh(item)
            return item

    @classmethod
    async def update_item(cls, item_id: int, data: dict):
        async with get_async_db_session() as session:
            item = (await session.exec(select(DictItem).where(DictItem.id == item_id))).first()
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
    async def delete_item(cls, item_id: int):
        """Delete item and cascade delete child items."""
        async with get_async_db_session() as session:
            all_ids = await cls._collect_child_item_ids(session, item_id)
            all_ids.append(item_id)
            await session.exec(delete(DictItem).where(col(DictItem.id).in_(all_ids)))
            await session.commit()
            return True

    @classmethod
    async def _collect_child_item_ids(cls, session, parent_id: int) -> list:
        children = (await session.exec(
            select(DictItem.id).where(DictItem.parent_id == parent_id)
        )).all()
        result = list(children)
        for cid in children:
            result.extend(await cls._collect_child_item_ids(session, cid))
        return result

    @classmethod
    async def get_items_by_ids(cls, ids: list) -> dict:
        """Return {id: {item_label, item_value, ...}} for given ids."""
        if not ids:
            return {}
        async with get_async_db_session() as session:
            stmt = select(DictItem).where(col(DictItem.id).in_(ids))
            items = (await session.exec(stmt)).all()
            return {i.id: i.dict() for i in items}

    @classmethod
    async def list_all_items(cls, category_id: int = 0, keyword: str = ''):
        """Return all items matching filter (for export)."""
        async with get_async_db_session() as session:
            stmt = select(DictItem)
            if category_id:
                stmt = stmt.where(DictItem.category_id == category_id)
            if keyword:
                from sqlalchemy import or_
                cond = or_(
                    col(DictItem.item_label).contains(keyword),
                    col(DictItem.item_value).contains(keyword),
                )
                stmt = stmt.where(cond)
            stmt = stmt.order_by(col(DictItem.sort_order).asc(), col(DictItem.id).asc())
            return (await session.exec(stmt)).all()

    # ─── Batch import ───

    @classmethod
    async def batch_import(cls, rows: List[dict]) -> dict:
        """Import rows. Each row: {cat_code, cat_name, parent_cat_code?, item_label, item_value, parent_item_value?, sort_order?, remark?}"""
        success = 0
        failed = 0
        errors = []
        cat_cache: dict = {}

        async with get_async_db_session() as session:
            existing_cats = (await session.exec(select(DictCategory))).all()
            for c in existing_cats:
                cat_cache[c.cat_code] = c

            for i, row in enumerate(rows):
                try:
                    cat_code = (row.get('cat_code') or '').strip()
                    cat_name = (row.get('cat_name') or '').strip()
                    item_label = (row.get('item_label') or '').strip()
                    item_value = (row.get('item_value') or '').strip()

                    if not cat_code or not item_label or not item_value:
                        errors.append(f'Row {i+2}: missing required fields (cat_code, item_label, item_value)')
                        failed += 1
                        continue

                    if cat_code not in cat_cache:
                        parent_cat_code = (row.get('parent_cat_code') or '').strip()
                        parent_cat_id = None
                        if parent_cat_code and parent_cat_code in cat_cache:
                            parent_cat_id = cat_cache[parent_cat_code].id
                        cat = DictCategory(
                            cat_code=cat_code,
                            cat_name=cat_name or cat_code,
                            parent_id=parent_cat_id,
                            sort_order=0,
                        )
                        session.add(cat)
                        await session.flush()
                        cat_cache[cat_code] = cat

                    category = cat_cache[cat_code]

                    parent_item_value = (row.get('parent_item_value') or '').strip()
                    parent_id = None
                    if parent_item_value:
                        parent_item = (await session.exec(
                            select(DictItem).where(
                                DictItem.category_id == category.id,
                                DictItem.item_value == parent_item_value,
                            )
                        )).first()
                        if parent_item:
                            parent_id = parent_item.id

                    sort_val = row.get('sort_order')
                    sort_order = int(sort_val) if sort_val and str(sort_val).strip().isdigit() else 0

                    item = DictItem(
                        category_id=category.id,
                        parent_id=parent_id,
                        item_label=item_label,
                        item_value=item_value,
                        sort_order=sort_order,
                        remark=(row.get('remark') or '').strip() or None,
                    )
                    session.add(item)
                    success += 1
                except Exception as e:
                    errors.append(f'Row {i+2}: {str(e)}')
                    failed += 1

            await session.commit()

        return {'success': success, 'failed': failed, 'errors': errors[:50]}
