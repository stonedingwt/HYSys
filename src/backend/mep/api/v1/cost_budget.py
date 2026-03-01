"""
API endpoints for Kingdee Production Cost Budget automation.
"""

import json
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

from mep.common.schemas.api import resp_200, resp_500
from mep.database.models.cost_budget import CostBudgetRecord, CostBudgetDao

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/cost-budget', tags=['cost_budget'])


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
async def save_budget(req: CostBudgetSubmitRequest, request: Request):
    """Save a quote to DB without triggering Kingdee RPA."""
    try:
        task_id = str(uuid.uuid4()).replace('-', '')[:16]

        user_id = None
        try:
            from mep.user.service.user_service import UserPayload
            payload = UserPayload.from_request(request)
            user_id = payload.user_id
        except Exception:
            pass

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
    """Mark a quote as final and trigger Kingdee RPA automation."""
    try:
        record = await CostBudgetDao.get_by_id(record_id)
        if not record:
            return resp_500('记录不存在')

        task_id = str(uuid.uuid4()).replace('-', '')[:16]
        await CostBudgetDao.mark_final_quote(record_id, task_id)

        form_data = {
            'factory_article_no': record.factory_article_no,
            'order_type': record.order_type,
            'currency': record.currency,
            'pricing_date': record.pricing_date,
            'bom_version': record.bom_version,
            'quote_date': record.quote_date,
            'quote_quantity': record.quote_quantity,
            'quote_size': record.quote_size,
            'customer': record.customer,
            'season': record.season,
            'quote_type': record.quote_type,
            'production_location': record.production_location,
            'brand': record.brand,
            'product_family': record.product_family,
            'material_costs': json.loads(record.material_costs) if record.material_costs else [],
            'accessory_costs': json.loads(record.accessory_costs) if record.accessory_costs else [],
            'packaging_costs': json.loads(record.packaging_costs) if record.packaging_costs else [],
            'secondary_costs': json.loads(record.secondary_costs) if record.secondary_costs else [],
            'other_costs': json.loads(record.other_costs) if record.other_costs else [],
            'sewing_gst': record.sewing_gst,
            'hour_conversion': record.hour_conversion,
            'cutting_price': record.cutting_price,
            'capital_rate': record.capital_rate,
            'profit_rate': record.profit_rate,
            'final_price_rmb': record.final_price_rmb,
        }

        from mep.worker.kingdee.kingdee_rpa_worker import kingdee_budget_task
        kingdee_budget_task.delay(task_id, form_data)

        logger.info('Queued Kingdee RPA task %s for record %s', task_id, record_id)
        return resp_200({'task_id': task_id, 'message': '已标记为最终报价，正在提交到金蝶...'})

    except Exception as e:
        logger.exception('Failed to mark final quote')
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


@router.get('/history')
async def list_history(
    request: Request,
    page_num: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
):
    """List historical submissions with pagination."""
    try:
        user_id = None
        try:
            from mep.user.service.user_service import UserPayload
            payload = UserPayload.from_request(request)
            user_id = payload.user_id
        except Exception:
            pass

        items, total = await CostBudgetDao.list_records(
            user_id=user_id, page_num=page_num, page_size=page_size,
        )
        return resp_200({
            'data': [item.dict() for item in items],
            'total': total,
            'page_num': page_num,
            'page_size': page_size,
        })
    except Exception as e:
        return resp_500(str(e))
