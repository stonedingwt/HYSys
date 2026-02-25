"""
Stub implementation for telemetry dashboard when mep.telemetry_search module is unavailable.
Provides basic CRUD for dashboards with in-memory storage and pre-initialized default dashboard.
"""

import copy as copy_module
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix='/telemetry', tags=['telemetry'])

# In-memory dashboard store (per-worker process)
_dashboards: dict[str, dict] = {}

# Fixed UUIDs for default dashboards so all workers share the same IDs
_DEFAULT_DASHBOARD_ID = '00000000-0000-0000-0000-000000000001'


def _now() -> str:
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def _make_resp(data, status_code=200, status_message='success'):
    return JSONResponse(content={
        'status_code': status_code,
        'status_message': status_message,
        'data': data,
    })


def _init_default_dashboards():
    """Create pre-initialized default dashboards on first load."""
    if _DEFAULT_DASHBOARD_ID in _dashboards:
        return

    now = _now()
    _dashboards[_DEFAULT_DASHBOARD_ID] = {
        'id': _DEFAULT_DASHBOARD_ID,
        'title': '系统概览',
        'description': '系统运行状态概览看板',
        'status': 'published',
        'dashboard_type': 'custom',
        'layout_config': {'layouts': []},
        'style_config': {'theme': 'light'},
        'create_time': now,
        'update_time': now,
        'is_default': True,
        'user_name': 'admin',
        'write': True,
        'components': [],
    }


# Initialize on module load
_init_default_dashboards()


@router.get('/dashboard')
async def dashboard_list(request: Request):
    """List all dashboards.

    Frontend interceptor unwraps response.data.data, then getDashboards() does res.data.filter(...).
    So backend must return {"data": [items]} wrapped in the standard response, making the interceptor
    return {"data": [items]}, then res.data = [items] for the .filter() call.
    """
    _init_default_dashboards()
    items = sorted(_dashboards.values(), key=lambda d: d.get('create_time', ''), reverse=True)
    for item in items:
        item['write'] = True
    return _make_resp({'data': items})


@router.get('/dashboard/dataset/list')
async def dataset_list(request: Request):
    return _make_resp([])


@router.get('/dashboard/dataset/field/enums')
async def field_enums(request: Request):
    return _make_resp([])


@router.get('/dashboard/{dashboard_id}')
async def dashboard_get(dashboard_id: str):
    _init_default_dashboards()
    dashboard = _dashboards.get(dashboard_id)
    if not dashboard:
        return _make_resp(None, status_code=404, status_message='Dashboard not found')
    dashboard['write'] = True
    return _make_resp(dashboard)


@router.post('/dashboard')
async def dashboard_create(request: Request):
    body = await request.json()
    dashboard_id = str(uuid.uuid4())
    now = _now()
    dashboard = {
        'id': dashboard_id,
        'title': body.get('title', '未命名看板'),
        'description': body.get('description', ''),
        'status': 'draft',
        'dashboard_type': 'custom',
        'layout_config': body.get('layout_config', {'layouts': []}),
        'style_config': body.get('style_config', {'theme': 'light'}),
        'create_time': now,
        'update_time': now,
        'is_default': len(_dashboards) == 0,
        'user_name': 'admin',
        'write': True,
        'components': [],
    }
    _dashboards[dashboard_id] = dashboard
    return _make_resp(dashboard)


@router.put('/dashboard/{dashboard_id}')
async def dashboard_update(dashboard_id: str, request: Request):
    _init_default_dashboards()
    dashboard = _dashboards.get(dashboard_id)
    if not dashboard:
        return _make_resp(None, status_code=404, status_message='Dashboard not found')
    body = await request.json()
    for field in ('title', 'description', 'layout_config', 'style_config', 'components'):
        if field in body:
            dashboard[field] = body[field]
    dashboard['update_time'] = _now()
    dashboard['write'] = True
    return _make_resp(dashboard)


@router.delete('/dashboard/{dashboard_id}')
async def dashboard_delete(dashboard_id: str):
    if dashboard_id in _dashboards:
        del _dashboards[dashboard_id]
    return _make_resp(None)


@router.post('/dashboard/{dashboard_id}/title')
async def dashboard_update_title(dashboard_id: str, request: Request):
    _init_default_dashboards()
    dashboard = _dashboards.get(dashboard_id)
    if not dashboard:
        return _make_resp(None, status_code=404, status_message='Dashboard not found')
    body = await request.json()
    dashboard['title'] = body.get('title', dashboard['title'])
    dashboard['update_time'] = _now()
    dashboard['write'] = True
    return _make_resp(dashboard)


@router.post('/dashboard/{dashboard_id}/default')
async def dashboard_set_default(dashboard_id: str):
    _init_default_dashboards()
    for d in _dashboards.values():
        d['is_default'] = False
    if dashboard_id in _dashboards:
        _dashboards[dashboard_id]['is_default'] = True
        _dashboards[dashboard_id]['write'] = True
        return _make_resp(_dashboards[dashboard_id])
    return _make_resp(None, status_code=404, status_message='Dashboard not found')


@router.post('/dashboard/{dashboard_id}/copy')
async def dashboard_copy(dashboard_id: str, request: Request):
    _init_default_dashboards()
    original = _dashboards.get(dashboard_id)
    if not original:
        return _make_resp(None, status_code=404, status_message='Dashboard not found')
    body = await request.json()
    new_id = str(uuid.uuid4())
    now = _now()
    new_dashboard = {
        **original,
        'id': new_id,
        'title': body.get('new_title', original['title'] + ' (副本)'),
        'create_time': now,
        'update_time': now,
        'is_default': False,
        'status': 'draft',
        'write': True,
        'components': copy_module.deepcopy(original.get('components', [])),
        'layout_config': copy_module.deepcopy(original.get('layout_config', {'layouts': []})),
    }
    _dashboards[new_id] = new_dashboard
    return _make_resp(new_dashboard)


@router.post('/dashboard/{dashboard_id}/status')
async def dashboard_publish(dashboard_id: str, request: Request):
    _init_default_dashboards()
    dashboard = _dashboards.get(dashboard_id)
    if not dashboard:
        return _make_resp(None, status_code=404, status_message='Dashboard not found')
    body = await request.json()
    dashboard['status'] = body.get('status', 'published')
    dashboard['update_time'] = _now()
    dashboard['write'] = True
    return _make_resp(dashboard)


@router.post('/dashboard/component/query')
async def component_query(request: Request):
    """Stub: return empty query results."""
    return _make_resp({'value': [], 'dimensions': []})
