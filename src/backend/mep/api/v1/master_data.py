from typing import Optional

from fastapi import APIRouter, Query

from mep.common.schemas.api import resp_200, resp_500
from mep.database.models.master_data import MasterDataDao, MODEL_MAP

router = APIRouter(prefix='/master', tags=['master_data'])

VALID_ENTITIES = list(MODEL_MAP.keys())


@router.get('/{entity}/list')
async def list_items(
    entity: str,
    keyword: str = Query('', description='Search keyword'),
    page_num: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort_by: str = Query('', description='Sort field'),
    sort_order: str = Query('desc', description='Sort order: asc or desc'),
):
    if entity not in VALID_ENTITIES:
        return resp_500(f'Invalid entity: {entity}')
    try:
        items, total = await MasterDataDao.list_items(
            entity, keyword, page_num, page_size, sort_by, sort_order)
        return resp_200({
            'data': [item.dict() for item in items],
            'total': total,
            'page_num': page_num,
            'page_size': page_size,
        })
    except Exception as e:
        return resp_500(str(e))


@router.post('/{entity}/create')
async def create_item(entity: str, data: dict):
    if entity not in VALID_ENTITIES:
        return resp_500(f'Invalid entity: {entity}')
    try:
        data.pop('id', None)
        data.pop('create_time', None)
        data.pop('update_time', None)
        item = await MasterDataDao.create_item(entity, data)
        return resp_200(item.dict() if item else None)
    except Exception as e:
        return resp_500(str(e))


@router.put('/{entity}/update')
async def update_item(entity: str, data: dict):
    if entity not in VALID_ENTITIES:
        return resp_500(f'Invalid entity: {entity}')
    item_id = data.pop('id', None)
    if not item_id:
        return resp_500('Missing id')
    try:
        data.pop('create_time', None)
        data.pop('update_time', None)
        item = await MasterDataDao.update_item(entity, item_id, data)
        return resp_200(item.dict() if item else None)
    except Exception as e:
        return resp_500(str(e))


@router.delete('/{entity}/delete')
async def delete_item(entity: str, id: int = Query(...)):
    if entity not in VALID_ENTITIES:
        return resp_500(f'Invalid entity: {entity}')
    try:
        ok = await MasterDataDao.delete_item(entity, id)
        return resp_200({'success': ok})
    except Exception as e:
        return resp_500(str(e))
