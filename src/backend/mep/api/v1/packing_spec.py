"""Packing specification CRUD API for managing packing list configuration."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from mep.common.dependencies.user_deps import UserPayload
from mep.common.schemas.api import resp_200, resp_500

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/packing-specs', tags=['packing_spec'])


class PackingSpecCreate(BaseModel):
    customer_name: Optional[str] = None
    customer_id: Optional[int] = None
    article_no: Optional[str] = None
    box_carton: Optional[str] = None
    box_max: Optional[int] = 50
    box_volume: Optional[float] = None
    net_weight: Optional[float] = None
    gross_weight: Optional[float] = None
    bag_size: Optional[str] = None
    box_height: Optional[int] = None
    remark: Optional[str] = None


class PackingSpecUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_id: Optional[int] = None
    article_no: Optional[str] = None
    box_carton: Optional[str] = None
    box_max: Optional[int] = None
    box_volume: Optional[float] = None
    net_weight: Optional[float] = None
    gross_weight: Optional[float] = None
    bag_size: Optional[str] = None
    box_height: Optional[int] = None
    remark: Optional[str] = None


@router.get('')
async def list_packing_specs(
    customer_name: Optional[str] = None,
    article_no: Optional[str] = None,
    page_num: int = 1,
    page_size: int = 50,
    sort_by: str = 'id',
    sort_order: str = 'desc',
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """List packing specifications with optional filters."""
    from mep.database.models.packing_spec import PackingSpecDao

    filters = {}
    if customer_name:
        filters['customer_name'] = customer_name
    if article_no:
        filters['article_no'] = article_no

    allowed_sort = {'id', 'customer_name', 'article_no', 'box_max', 'create_time'}
    if sort_by not in allowed_sort:
        sort_by = 'id'
    if sort_order not in ('asc', 'desc'):
        sort_order = 'desc'

    items, total = await PackingSpecDao.list_specs(
        filters, page_num, page_size, sort_by=sort_by, sort_order=sort_order,
    )
    return resp_200({
        'list': [item.dict() for item in items],
        'total': total,
        'page_num': page_num,
        'page_size': page_size,
    })


@router.post('')
async def create_packing_spec(
    body: PackingSpecCreate,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """Create a new packing specification."""
    from mep.database.models.packing_spec import PackingSpecDao

    try:
        data = body.dict(exclude_none=True)
        spec = await PackingSpecDao.create(data)
        return resp_200(spec.dict())
    except Exception as e:
        logger.exception('Failed to create packing spec')
        return resp_500(message=str(e))


@router.put('/{spec_id}')
async def update_packing_spec(
    spec_id: int,
    body: PackingSpecUpdate,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """Update an existing packing specification."""
    from mep.database.models.packing_spec import PackingSpecDao

    try:
        data = {k: v for k, v in body.dict().items() if v is not None}
        spec = await PackingSpecDao.update(spec_id, data)
        if not spec:
            return resp_500(message='规格不存在')
        return resp_200(spec.dict())
    except Exception as e:
        logger.exception('Failed to update packing spec')
        return resp_500(message=str(e))


@router.delete('/{spec_id}')
async def delete_packing_spec(
    spec_id: int,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """Delete a packing specification."""
    from mep.database.models.packing_spec import PackingSpecDao

    try:
        ok = await PackingSpecDao.delete(spec_id)
        if ok:
            return resp_200({'message': '删除成功'})
        return resp_500(message='规格不存在')
    except Exception as e:
        logger.exception('Failed to delete packing spec')
        return resp_500(message=str(e))


@router.get('/customers')
async def list_customers_for_packing(
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """List distinct customers from master_customer for packing spec dropdown."""
    from sqlmodel import select, col
    from mep.core.database import get_async_db_session
    from mep.database.models.master_data import Customer

    async with get_async_db_session() as session:
        stmt = (
            select(
                Customer.id,
                Customer.customer_code,
                Customer.customer_name,
                Customer.customer_short_name,
            )
            .order_by(col(Customer.customer_short_name).asc())
        )
        rows = (await session.exec(stmt)).all()
        seen = {}
        for r in rows:
            code = r.customer_code
            if code not in seen:
                seen[code] = {
                    'id': r.id,
                    'customer_code': code,
                    'customer_name': r.customer_name,
                    'short_name': r.customer_short_name,
                }
        return resp_200(list(seen.values()))


@router.get('/{spec_id}')
async def get_packing_spec(
    spec_id: int,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """Get a single packing specification by ID."""
    from mep.database.models.packing_spec import PackingSpecDao

    spec = await PackingSpecDao.get_by_id(spec_id)
    if not spec:
        return resp_500(message='规格不存在')
    return resp_200(spec.dict())
