"""
API endpoints for Kingdee Production Cost Budget automation.
"""

import json
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from mep.common.dependencies.user_deps import UserPayload
from mep.common.schemas.api import resp_200, resp_500
from mep.database.models.cost_budget import CostBudgetRecord, CostBudgetDao

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/cost-budget', tags=['cost_budget'])

MANAGER_ROLE_ID = 5


def _is_elevated(payload: UserPayload) -> bool:
    """Admin (role 1) or 管理层 (role 5) can see all data."""
    if payload.is_admin():
        return True
    return MANAGER_ROLE_ID in (payload.user_role or [])


class CostBudgetSubmitRequest(BaseModel):
    factory_article_no: str
    order_type: str
    currency: Optional[str] = None
    pricing_date: str
    bom_version: Optional[str] = None
    quote_date: str
    quote_quantity: int
    quote_size: Optional[str] = None
    customer: Optional[str] = None
    season: str
    quote_type: str
    production_location: str
    brand: Optional[str] = None
    product_family: Optional[str] = None

    material_costs: Optional[list[dict]] = None
    accessory_costs: Optional[list[dict]] = None
    packaging_costs: Optional[list[dict]] = None
    secondary_costs: Optional[list[dict]] = None
    other_costs: Optional[list[dict]] = None

    sewing_gst: Optional[str] = None
    hour_conversion: Optional[str] = None
    cutting_price: Optional[str] = None
    capital_rate: Optional[str] = None
    profit_rate: Optional[str] = None
    final_price_rmb: Optional[str] = None


@router.post('/save')
async def save_budget(req: CostBudgetSubmitRequest,
                      login_user: UserPayload = Depends(UserPayload.get_login_user)):
    """Save a quote to DB without triggering Kingdee RPA."""
    try:
        task_id = str(uuid.uuid4()).replace('-', '')[:16]
        user_id = login_user.user_id

        record = CostBudgetRecord(
            task_id=task_id,
            user_id=user_id,
            factory_article_no=req.factory_article_no,
            order_type=req.order_type,
            currency=req.currency,
            pricing_date=req.pricing_date,
            bom_version=req.bom_version,
            quote_date=req.quote_date,
            quote_quantity=req.quote_quantity,
            quote_size=req.quote_size,
            customer=req.customer,
            season=req.season,
            quote_type=req.quote_type,
            production_location=req.production_location,
            brand=req.brand,
            product_family=req.product_family,
            material_costs=json.dumps(req.material_costs or [], ensure_ascii=False),
            accessory_costs=json.dumps(req.accessory_costs or [], ensure_ascii=False),
            packaging_costs=json.dumps(req.packaging_costs or [], ensure_ascii=False),
            secondary_costs=json.dumps(req.secondary_costs or [], ensure_ascii=False),
            other_costs=json.dumps(req.other_costs or [], ensure_ascii=False),
            sewing_gst=req.sewing_gst,
            hour_conversion=req.hour_conversion,
            cutting_price=req.cutting_price,
            capital_rate=req.capital_rate,
            profit_rate=req.profit_rate,
            final_price_rmb=req.final_price_rmb,
            status='draft',
        )
        await CostBudgetDao.create(record)

        logger.info('Saved quote record %s', record.id)
        return resp_200({'id': record.id, 'message': '报价已保存'})

    except Exception as e:
        logger.exception('Failed to save quote')
        return resp_500(str(e))


@router.post('/final-quote/{record_id}')
async def mark_final_quote(record_id: int, request: Request):
    """Mark a quote as final. Kingdee sync is handled by scheduled task."""
    try:
        record = await CostBudgetDao.get_by_id(record_id)
        if not record:
            return resp_500('记录不存在')

        await CostBudgetDao.mark_final_quote_only(record_id)

        logger.info('Marked record %s as final quote (pending scheduled sync)', record_id)
        return resp_200({'message': '已标记为最终报价，将在定时任务中自动同步到金蝶'})

    except Exception as e:
        logger.exception('Failed to mark final quote')
        return resp_500(str(e))


@router.post('/retry/{record_id}')
async def retry_sync(record_id: int, request: Request):
    """Reset a failed record to pending status for retry by scheduled task,
    or trigger an immediate sync."""
    try:
        record = await CostBudgetDao.get_by_id(record_id)
        if not record:
            return resp_500('记录不存在')
        if not record.is_final_quote:
            return resp_500('该记录未标记为最终报价')

        await CostBudgetDao.reset_to_pending(record_id)
        logger.info('Record %d reset to pending for retry', record_id)

        from mep.worker.kingdee.kingdee_rpa_worker import sync_final_quotes_to_kingdee
        sync_final_quotes_to_kingdee.apply_async(args=[])

        return resp_200({'message': '已重新触发同步，请稍后查看状态'})
    except Exception as e:
        logger.exception('Failed to retry sync for record %d', record_id)
        return resp_500(str(e))


@router.get('/status/{task_id}')
async def get_status(task_id: str):
    """Poll the progress of a running RPA task."""
    try:
        from mep.core.kingdee.progress_callback import RedisProgressCallback
        callback = RedisProgressCallback(task_id)
        status = callback.get_status()
        if status:
            return resp_200(status)

        record = await CostBudgetDao.get_by_task_id(task_id)
        if record:
            return resp_200({
                'progress': 100 if record.status == 'success' else (-1 if record.status == 'failed' else 0),
                'message': record.error_message or record.status,
                'task_id': task_id,
            })
        return resp_200({'progress': 0, 'message': '任务未找到', 'task_id': task_id})

    except Exception as e:
        return resp_500(str(e))


@router.get('/config')
async def get_config():
    """Return dropdown options and default config for the form."""
    return resp_200({
        'order_types': ['FOB', '内销（OEM）', '内销', '内销3%'],
        'seasons': ['春季', '夏季', '秋季', '冬季'],
        'quote_types': ['无打样报价', '打样报价'],
        'production_locations': ['赛乐', '外协', '越南'],
        'other_cost_types': ['水电费', '管理运营费', '运费', '测试费', '样品费'],
    })


@router.get('/my-customers')
async def get_my_customers(login_user: UserPayload = Depends(UserPayload.get_login_user)):
    """Return customer list. Admin/管理层 get all, others get only associated."""
    try:
        from mep.database.models.master_data import MasterDataDao
        if _is_elevated(login_user):
            names = await MasterDataDao.get_all_customer_names()
        else:
            names = await MasterDataDao.get_customer_names_for_user(login_user.user_id)
        return resp_200(names)
    except Exception as e:
        logger.exception('Failed to get customers for user %s', login_user.user_id)
        return resp_500(str(e))


@router.get('/history')
async def list_history(
    login_user: UserPayload = Depends(UserPayload.get_login_user),
    page_num: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
):
    """List historical submissions. Admin/管理层 see all, others see own only."""
    try:
        filter_user_id = None if _is_elevated(login_user) else login_user.user_id

        items, total = await CostBudgetDao.list_records(
            user_id=filter_user_id, page_num=page_num, page_size=page_size,
        )
        return resp_200({
            'data': [item.dict() for item in items],
            'total': total,
            'page_num': page_num,
            'page_size': page_size,
        })
    except Exception as e:
        return resp_500(str(e))
