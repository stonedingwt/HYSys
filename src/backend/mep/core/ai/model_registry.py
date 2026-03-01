"""Multi-model intelligent scheduling engine.

Three-tier OCR fallback:
  L1: PaddleOCR (local, free, fast)
  L2: qwen-vl-ocr (DashScope, per-page vision OCR)
  L3: qwen-vl-max (DashScope, full-page understanding)

LLM tier:
  T1: qwen-max (text structuring, low cost)
  T2: qwen-plus (fallback)
  T3: qwen-turbo (fast, cheapest)

Auto-discovery: calls DashScope /models to find available models.
Quality scoring: tracks success/failure per model and auto-selects best.
"""

import json
import logging
import time
from dataclasses import dataclass, field
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

OCR_TIERS = [
    {'name': 'paddleocr', 'type': 'local', 'priority': 1},
    {'name': 'qwen-vl-ocr', 'type': 'dashscope_vision', 'priority': 2},
    {'name': 'qwen-vl-max', 'type': 'dashscope_vision', 'priority': 3},
]

LLM_TIERS = [
    {'name': 'qwen-max', 'type': 'dashscope_text', 'max_tokens': 8192, 'priority': 1},
    {'name': 'qwen-plus', 'type': 'dashscope_text', 'max_tokens': 8192, 'priority': 2},
    {'name': 'qwen-turbo', 'type': 'dashscope_text', 'max_tokens': 8192, 'priority': 3},
]


@dataclass
class ModelScore:
    model_name: str
    successes: int = 0
    failures: int = 0
    avg_latency_ms: float = 0.0
    last_used: float = 0.0
    last_error: str = ''

    @property
    def score(self) -> float:
        total = self.successes + self.failures
        if total == 0:
            return 0.5
        return self.successes / total


_scores: dict[str, ModelScore] = {}


def record_success(model_name: str, latency_ms: float):
    s = _scores.setdefault(model_name, ModelScore(model_name=model_name))
    s.successes += 1
    s.last_used = time.time()
    total = s.successes + s.failures
    s.avg_latency_ms = ((s.avg_latency_ms * (total - 1)) + latency_ms) / total


def record_failure(model_name: str, error: str = ''):
    s = _scores.setdefault(model_name, ModelScore(model_name=model_name))
    s.failures += 1
    s.last_used = time.time()
    s.last_error = error[:200]


def get_model_scores() -> dict[str, dict]:
    return {
        k: {'score': v.score, 'successes': v.successes, 'failures': v.failures,
             'avg_latency_ms': round(v.avg_latency_ms, 1), 'last_error': v.last_error}
        for k, v in _scores.items()
    }


def best_llm_model() -> str:
    """Select the best performing LLM from available tiers."""
    best = None
    best_score = -1.0
    for tier in LLM_TIERS:
        name = tier['name']
        ms = _scores.get(name)
        score = ms.score if ms else 0.5
        if score > best_score:
            best_score = score
            best = name
    return best or 'qwen-max'


async def discover_models(api_key: str) -> list[str]:
    """Query DashScope /models endpoint to discover available models."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f'{DASHSCOPE_BASE}/models',
                headers={'Authorization': f'Bearer {api_key}'},
            )
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get('id', '') for m in data.get('data', [])]
                logger.info('Discovered %d models from DashScope', len(models))
                return models
    except Exception:
        logger.exception('Model discovery failed')
    return []


async def call_ocr_with_fallback(file_url: str) -> Optional[str]:
    """Try OCR tiers in order: PaddleOCR → qwen-vl-ocr → qwen-vl-max."""
    for tier in OCR_TIERS:
        name = tier['name']
        t0 = time.time()
        try:
            if tier['type'] == 'local':
                from mep.api.v1.sales_order_process import _call_paddleocr
                result = await _call_paddleocr(file_url)
            else:
                result = await _call_vision_ocr(file_url, name)

            elapsed = (time.time() - t0) * 1000
            if result and result.strip():
                record_success(name, elapsed)
                logger.info('OCR success with %s (%.0fms, %d chars)', name, elapsed, len(result))
                return result
            record_failure(name, 'empty result')
        except Exception as e:
            record_failure(name, str(e))
            logger.warning('OCR tier %s failed: %s', name, str(e)[:200])
    return None


async def call_llm_with_fallback(prompt: str, max_tokens: int = 8192) -> Optional[str]:
    """Try LLM tiers in score order with automatic failover."""
    sorted_tiers = sorted(LLM_TIERS, key=lambda t: -(_scores.get(t['name'], ModelScore(t['name'])).score))

    for tier in sorted_tiers:
        name = tier['name']
        t0 = time.time()
        try:
            result = await _call_dashscope_text(prompt, name, max_tokens)
            elapsed = (time.time() - t0) * 1000
            if result:
                record_success(name, elapsed)
                return result
            record_failure(name, 'empty result')
        except Exception as e:
            record_failure(name, str(e))
            logger.warning('LLM tier %s failed: %s', name, str(e)[:200])
    return None


async def _call_vision_ocr(file_url: str, model: str) -> Optional[str]:
    """Call a DashScope vision model for OCR."""
    from mep.api.v1.sales_order_process import _get_llm_config
    config = await _get_llm_config()
    if not config:
        return None

    api_key = config['api_key']
    payload = {
        'model': model,
        'messages': [{
            'role': 'user',
            'content': [
                {'type': 'image_url', 'image_url': {'url': file_url}},
                {'type': 'text', 'text': '请识别并提取图片中的所有文字内容，保持原始格式和排版。'},
            ],
        }],
        'max_tokens': 4096,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f'{DASHSCOPE_BASE}/chat/completions',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}',
            },
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data['choices'][0]['message']['content']


async def _call_dashscope_text(prompt: str, model: str, max_tokens: int = 8192) -> Optional[str]:
    """Call a DashScope text model."""
    from mep.api.v1.sales_order_process import _get_llm_config
    config = await _get_llm_config()
    if not config:
        return None

    api_key = config['api_key']
    payload = {
        'model': model,
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.1,
        'max_tokens': min(max_tokens, 8192),
    }
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f'{DASHSCOPE_BASE}/chat/completions',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}',
            },
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data['choices'][0]['message']['content']
