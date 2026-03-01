"""REST API for parsing rules and prompt version management."""

import logging
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from mep.common.schemas.api import resp_200, resp_500

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/parse-rules', tags=['parse_rules'])


# ---------------------------------------------------------------------------
# Parse Rules CRUD
# ---------------------------------------------------------------------------

class RuleBody(BaseModel):
    data: dict


@router.get('/rules')
async def list_rules(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: str = '',
):
    from mep.database.models.parse_rule import ParseRuleDao
    items, total = await ParseRuleDao.list_rules(page=page, page_size=page_size, keyword=keyword)
    return resp_200({
        'items': [i.dict() for i in items],
        'total': total,
        'page': page,
        'page_size': page_size,
    })


@router.post('/rules')
async def create_rule(body: RuleBody):
    from mep.database.models.parse_rule import ParseRuleDao
    item = await ParseRuleDao.create_rule(body.data)
    return resp_200(item.dict())


@router.put('/rules/{rule_id}')
async def update_rule(rule_id: int, body: RuleBody):
    from mep.database.models.parse_rule import ParseRuleDao
    item = await ParseRuleDao.update_rule(rule_id, body.data)
    if not item:
        return resp_200({'error': 'not found'})
    return resp_200(item.dict())


@router.delete('/rules/{rule_id}')
async def delete_rule(rule_id: int):
    from mep.database.models.parse_rule import ParseRuleDao
    await ParseRuleDao.delete_rule(rule_id)
    return resp_200({'success': True})


# ---------------------------------------------------------------------------
# Prompt Versions CRUD
# ---------------------------------------------------------------------------

class PromptBody(BaseModel):
    data: dict


@router.get('/prompts')
async def list_prompts(
    prompt_name: str = '',
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    from mep.database.models.parse_rule import PromptVersionDao
    items, total = await PromptVersionDao.list_versions(prompt_name=prompt_name, page=page, page_size=page_size)
    return resp_200({
        'items': [i.dict() for i in items],
        'total': total,
        'page': page,
        'page_size': page_size,
    })


@router.post('/prompts')
async def create_prompt(body: PromptBody):
    from mep.database.models.parse_rule import PromptVersionDao
    item = await PromptVersionDao.create_version(body.data)
    return resp_200(item.dict())


@router.put('/prompts/{version_id}')
async def update_prompt(version_id: int, body: PromptBody):
    from mep.database.models.parse_rule import PromptVersionDao
    item = await PromptVersionDao.update_version(version_id, body.data)
    if not item:
        return resp_200({'error': 'not found'})
    return resp_200(item.dict())


# ---------------------------------------------------------------------------
# Model discovery + monitoring
# ---------------------------------------------------------------------------

@router.get('/models/discover')
async def discover_models():
    """Discover available models from DashScope API."""
    from mep.core.ai.model_registry import discover_models as _discover
    from mep.api.v1.sales_order_process import _get_llm_config
    config = await _get_llm_config()
    if not config:
        return resp_200([])
    models = await _discover(config['api_key'])
    return resp_200(models)


@router.get('/models/scores')
async def model_scores():
    """Return AI model performance scores."""
    from mep.core.ai.model_registry import get_model_scores
    return resp_200(get_model_scores())
