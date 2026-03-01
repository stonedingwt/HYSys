"""REST API for business forms (follow_up / bom / sample).

Provides CRUD endpoints for the three core business tables used
by the Order Tracking Assistant upgrade.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from mep.common.dependencies.user_deps import UserPayload
from mep.common.schemas.api import resp_200, resp_500

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/biz-forms', tags=['biz_forms'])


# ---------------------------------------------------------------------------
# Follow-up endpoints
# ---------------------------------------------------------------------------

@router.get('/follow-up/{item_id}')
async def get_follow_up(item_id: int):
    from mep.database.models.biz_tables import BizFollowUpDao
    item = await BizFollowUpDao.get_by_id(item_id)
    if not item:
        return resp_200({'error': 'not found'})
    return resp_200(item.dict())


@router.get('/follow-up/by-task/{task_id}')
async def get_follow_up_by_task(task_id: int):
    from mep.database.models.biz_tables import BizFollowUpDao
    item = await BizFollowUpDao.get_by_task_id(task_id)
    if not item:
        return resp_200(None)
    return resp_200(item.dict())


@router.get('/follow-up')
async def list_follow_ups(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    customer_name: str = '',
    po_number: str = '',
):
    from mep.database.models.biz_tables import BizFollowUpDao
    items, total = await BizFollowUpDao.list_all(
        page=page, page_size=page_size,
        customer_name=customer_name, po_number=po_number,
    )
    return resp_200({
        'items': [i.dict() for i in items],
        'total': total,
        'page': page,
        'page_size': page_size,
    })


class FollowUpUpdate(BaseModel):
    data: dict


@router.put('/follow-up/{item_id}')
async def update_follow_up(item_id: int, body: FollowUpUpdate):
    from mep.database.models.biz_tables import BizFollowUpDao
    from mep.core.biz.auto_extract import check_completeness
    data = body.data
    status, pending = check_completeness(data, 'follow_up')
    data['completeness'] = status
    data['pending_fields'] = pending
    item = await BizFollowUpDao.update(item_id, data)
    if not item:
        return resp_200({'error': 'not found'})

    # Re-sync to knowledge base after edit
    try:
        from mep.core.biz.knowledge_sync import sync_three_tables_to_knowledge
        await sync_three_tables_to_knowledge(item_id)
    except Exception:
        logger.exception('Knowledge re-sync failed for follow_up %d', item_id)

    # Sync primary image to Kingdee if changed
    if 'primary_image_idx' in data or 'style_images' in data:
        try:
            from mep.core.biz.image_sync import sync_follow_up_primary_image
            await sync_follow_up_primary_image(item_id)
        except Exception:
            logger.exception('Primary image sync to Kingdee failed for follow_up %d', item_id)

    return resp_200(item.dict())


# ---------------------------------------------------------------------------
# BOM endpoints
# ---------------------------------------------------------------------------

@router.get('/bom/by-follow-up/{follow_up_id}')
async def get_bom_by_follow_up(follow_up_id: int):
    from mep.database.models.biz_tables import BizBomDao, BizBomDetailDao
    bom = await BizBomDao.get_by_follow_up(follow_up_id)
    if not bom:
        return resp_200(None)
    details = await BizBomDetailDao.list_by_bom(bom.id)
    return resp_200({
        'header': bom.dict(),
        'details': [d.dict() for d in details],
    })


@router.get('/bom/{item_id}')
async def get_bom(item_id: int):
    from mep.database.models.biz_tables import BizBomDao, BizBomDetailDao
    bom = await BizBomDao.get_by_id(item_id)
    if not bom:
        return resp_200({'error': 'not found'})
    details = await BizBomDetailDao.list_by_bom(bom.id)
    return resp_200({
        'header': bom.dict(),
        'details': [d.dict() for d in details],
    })


class BomUpdate(BaseModel):
    header: dict
    details: list[dict]


@router.put('/bom/{item_id}')
async def update_bom(item_id: int, body: BomUpdate):
    from mep.database.models.biz_tables import BizBomDao, BizBomDetailDao
    from mep.core.biz.auto_extract import check_completeness
    header_data = body.header
    status, pending = check_completeness(header_data, 'bom')
    header_data['completeness'] = status
    header_data['pending_fields'] = pending
    bom = await BizBomDao.update(item_id, header_data)
    if not bom:
        return resp_200({'error': 'not found'})
    details = await BizBomDetailDao.replace_all(item_id, body.details)

    # Re-sync to knowledge base
    if bom.follow_up_id:
        try:
            from mep.core.biz.knowledge_sync import sync_three_tables_to_knowledge
            await sync_three_tables_to_knowledge(bom.follow_up_id)
        except Exception:
            logger.exception('Knowledge re-sync failed for bom %d', item_id)

    return resp_200({
        'header': bom.dict(),
        'details': [d.dict() for d in details],
    })


# ---------------------------------------------------------------------------
# Sample endpoints
# ---------------------------------------------------------------------------

@router.get('/sample/by-follow-up/{follow_up_id}')
async def get_sample_by_follow_up(follow_up_id: int):
    from mep.database.models.biz_tables import (
        BizSampleDao, BizSampleRatioDao, BizSampleMaterialDao,
    )
    sample = await BizSampleDao.get_by_follow_up(follow_up_id)
    if not sample:
        return resp_200(None)
    ratios = await BizSampleRatioDao.list_by_sample(sample.id)
    materials = await BizSampleMaterialDao.list_by_sample(sample.id)
    return resp_200({
        'header': sample.dict(),
        'ratios': [r.dict() for r in ratios],
        'materials': [m.dict() for m in materials],
    })


@router.get('/sample/{item_id}')
async def get_sample(item_id: int):
    from mep.database.models.biz_tables import (
        BizSampleDao, BizSampleRatioDao, BizSampleMaterialDao,
    )
    sample = await BizSampleDao.get_by_id(item_id)
    if not sample:
        return resp_200({'error': 'not found'})
    ratios = await BizSampleRatioDao.list_by_sample(sample.id)
    materials = await BizSampleMaterialDao.list_by_sample(sample.id)
    return resp_200({
        'header': sample.dict(),
        'ratios': [r.dict() for r in ratios],
        'materials': [m.dict() for m in materials],
    })


class SampleUpdate(BaseModel):
    header: dict
    ratios: list[dict] = []
    materials: list[dict] = []


@router.put('/sample/{item_id}')
async def update_sample(item_id: int, body: SampleUpdate):
    from mep.database.models.biz_tables import (
        BizSampleDao, BizSampleRatioDao, BizSampleMaterialDao,
    )
    from mep.core.biz.auto_extract import check_completeness
    header_data = body.header
    status, pending = check_completeness(header_data, 'sample')
    header_data['completeness'] = status
    header_data['pending_fields'] = pending
    sample = await BizSampleDao.update(item_id, header_data)
    if not sample:
        return resp_200({'error': 'not found'})
    ratios = await BizSampleRatioDao.replace_all(item_id, body.ratios)
    materials = await BizSampleMaterialDao.replace_all(item_id, body.materials)

    # Re-sync to knowledge base
    if sample.follow_up_id:
        try:
            from mep.core.biz.knowledge_sync import sync_three_tables_to_knowledge
            await sync_three_tables_to_knowledge(sample.follow_up_id)
        except Exception:
            logger.exception('Knowledge re-sync failed for sample %d', item_id)

    return resp_200({
        'header': sample.dict(),
        'ratios': [r.dict() for r in ratios],
        'materials': [m.dict() for m in materials],
    })


# ---------------------------------------------------------------------------
# Completeness check + sample task creation trigger
# ---------------------------------------------------------------------------

@router.post('/check-completeness/{follow_up_id}')
async def check_and_maybe_create_sample_task(follow_up_id: int):
    """Check if all three tables are complete and return status.

    Frontend calls this to show "confirm to create sample task" dialog.
    """
    from mep.database.models.biz_tables import (
        BizFollowUpDao, BizBomDao, BizSampleDao,
    )
    fu = await BizFollowUpDao.get_by_id(follow_up_id)
    bom = await BizBomDao.get_by_follow_up(follow_up_id)
    sample = await BizSampleDao.get_by_follow_up(follow_up_id)

    result = {
        'follow_up': {
            'completeness': fu.completeness if fu else 'missing',
            'pending_fields': fu.pending_fields if fu else [],
        },
        'bom': {
            'completeness': bom.completeness if bom else 'missing',
            'pending_fields': bom.pending_fields if bom else [],
        },
        'sample': {
            'completeness': sample.completeness if sample else 'missing',
            'pending_fields': sample.pending_fields if sample else [],
        },
        'all_complete': (
            fu and fu.completeness == 'complete'
            and bom and bom.completeness == 'complete'
            and sample and sample.completeness == 'complete'
        ),
    }
    return resp_200(result)


@router.post('/create-sample-task/{follow_up_id}')
async def create_sample_task(
    follow_up_id: int,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """Create a sampling task after user confirms data completeness.

    Assigns to sample_manager_id from master_customer.
    """
    from mep.database.models.biz_tables import BizFollowUpDao, BizSampleDao
    from mep.database.models.task_center import (
        Task, TaskDao, TaskUpdateLog, TaskUpdateLogDao,
        TaskForm, TaskFormDao, generate_task_number,
    )
    from mep.database.models.master_data import MasterDataDao
    from mep.user.domain.models.user import UserDao
    from mep.core.dingtalk.dingtalk_message import async_send_dingtalk_message

    fu = await BizFollowUpDao.get_by_id(follow_up_id)
    sample = await BizSampleDao.get_by_follow_up(follow_up_id)
    if not fu or not sample:
        return resp_500(message='跟单表或打样单数据不存在')

    customer_name = fu.customer_name or ''
    article = fu.factory_article_no or ''

    # Find sample_manager_id from master_customer
    assignee_id = None
    customer = await MasterDataDao.get_customer_by_name(customer_name)
    if customer and customer.sample_manager_id:
        assignee_id = customer.sample_manager_id

    task_number = await generate_task_number()
    task = Task(
        task_number=task_number,
        task_name=f"打样 - {customer_name} {article}",
        task_type='打样任务',
        status='待打样',
        priority_label='普通',
        assignee_id=assignee_id,
        creator_id=login_user.user_id if login_user else None,
        description=f'打样任务 - 客户: {customer_name}, 厂款号: {article}',
        main_form_type='sample',
        main_form_id=sample.id,
        tags=[customer_name, article],
    )
    task = await TaskDao.create_task(task)

    await TaskFormDao.add_form(TaskForm(
        task_id=task.id, form_type='sample', form_id=sample.id,
        form_name=f'打样单 {article}', is_main=True,
    ))

    await TaskUpdateLogDao.add_log(TaskUpdateLog(
        task_id=task.id,
        log_type='system',
        content=f'打样任务创建: {task_number} - {customer_name} {article}',
        user_id=login_user.user_id if login_user else None,
        user_name=login_user.user_name if login_user else 'system',
    ))

    # DingTalk notification to sample manager
    if assignee_id:
        try:
            assignee_user = await UserDao.aget_user(assignee_id)
            if assignee_user and assignee_user.user_name:
                await async_send_dingtalk_message(
                    user_list=[assignee_user.user_name],
                    link='https://ai.noooyi.com/workspace/task-center',
                    title='新打样任务',
                    message_content=(
                        f"客户: {customer_name}<br/>"
                        f"厂款号: {article}<br/>"
                        f"任务编号: {task_number}"
                    ),
                    message_type='task',
                )
        except Exception:
            logger.exception('DingTalk notification failed for sample task %s', task_number)

    return resp_200({
        'task_number': task_number,
        'task_id': task.id,
        'assignee_id': assignee_id,
    })


# ---------------------------------------------------------------------------
# Kingdee sync endpoints
# ---------------------------------------------------------------------------

@router.post('/sync-bom-kingdee/{bom_id}')
async def sync_bom_to_kingdee_api(bom_id: int):
    """Sync a BOM record to Kingdee K3Cloud via Web API."""
    try:
        from mep.core.biz.kingdee_sync import sync_bom_to_kingdee
        result = await sync_bom_to_kingdee(bom_id)
        return resp_200(result)
    except Exception as e:
        logger.exception('Kingdee BOM sync API error for bom %d', bom_id)
        return resp_500(message=str(e))


@router.post('/sync-sample-kingdee/{sample_id}')
async def sync_sample_to_kingdee_api(sample_id: int):
    """Sync a sample order to Kingdee K3Cloud via Web API."""
    try:
        from mep.core.biz.kingdee_sync import sync_sample_to_kingdee
        result = await sync_sample_to_kingdee(sample_id)
        return resp_200(result)
    except Exception as e:
        logger.exception('Kingdee sample sync API error for sample %d', sample_id)
        return resp_500(message=str(e))


# ---------------------------------------------------------------------------
# Model scores monitoring endpoint
# ---------------------------------------------------------------------------

@router.get('/model-scores')
async def get_model_scores():
    """Return current AI model performance scores."""
    from mep.core.ai.model_registry import get_model_scores as _get_scores
    return resp_200(_get_scores())
