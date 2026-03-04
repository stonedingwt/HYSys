"""
Sales order processing pipeline endpoint.
Called from workflow to execute the full flow:
  1. Receive file URL (PDF)
  2. Call PaddleOCR HTTP service for text extraction
  3. Use LLM to structure OCR text into table JSON
  4. Parse structured tables into order data
  5. Write to database
  6. Generate packing list
  7. Save files to document center (MinIO)
"""

import asyncio
import json
import logging
import os
import re
import tempfile
from typing import Optional

import httpx
from fastapi import APIRouter, Body
from pydantic import BaseModel

from mep.common.schemas.api import resp_200, resp_500

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/sales-order', tags=['sales_order_process'])


STRUCTURE_PROMPT = """你是一个文档解析助手。请将以下OCR识别的文本转换为标准表格JSON格式。

规则：
1. 识别文档中的所有表格区域，每个表格作为一个独立JSON对象
2. 每个对象包含 "Headers"（列名数组）和 "Rows"（行数据二维数组）
3. 键值对格式的内容保持两列结构：键名放第一列，值放第二列
4. 保持原始数据不做修改，只返回JSON数组
5. 数字准确性至关重要：
   - 仔细区分 6 和 9（特别是数量、日期、编号中的数字）
   - 仔细区分 8 和 3、1 和 7、0 和 O
   - EAN条码通常为13位数字，以 87 开头
   - 日期格式通常为 DD.MM.YYYY
6. 此类文档通常包含以下表格区域，请确保完整识别并提取每个区域：
   a) Supplier 信息表 - 键值对格式，第一个 Header 为 "Supplier"，包含：
      Date, Supplier, Supplier no, Factory, Factory no, Buying group, Country of origin, Port of loading, Payment 等
   b) Article Information 表 - 键值对格式，第一个 Header 含 "Article Information"，包含：
      Article description, Material group, Generic article no., Season, Composition code, Colour, Sub-Brand 等
   c) Ordered pieces per size 表 - 第一个 Header 含 "Ordered pieces per size"，三列：Article, EAN, 数量
   d) HS code / 运输信息表 - 第一个 Header 含 "HS code"，键值对格式，包含：
      Cargo delivery date, Shipment method, Delivery terms, DC date, Presentation date
   e) Target group 表 - 键值对格式，包含 Theme, Segment
   f) Sales Prices 表 - 三列：Country, Price, Currency
   g) Position 明细表 - 多列表格，Headers 必须包含原始列名：
      Position, Article, Description, Order Qty, Tot.Pieces, Price unit Buying, DC, Warehouse, Flow, Destination, Packing Code
      **极其重要**：
      - Description 列包含类似 "产品名称, 颜色, 尺码" 的文本（如 "Maui V front dot uf, Mint, H75"）
      - Order Qty 和 Tot.Pieces 是两个**不同的数字列**，Order Qty 是订单数量，Tot.Pieces 是总件数
      - 如果 Description 列的值看起来是数字而不是文本描述，说明列对齐有误，请检查并修正
      - 每一行的列数必须与 Headers 数量完全一致，缺失的值用 null 填充
      - 请确保提取每一行数据，不要遗漏任何行
7. **重要**：如果文档包含多个不同的Article（多个款式），必须提取每一个款式的所有表格区域。
   不要只提取第一个款式就停止，务必提取全部内容。
8. **重要**：请完整提取所有数据，不要省略或截断。即使数据很多，也要全部输出。
9. **关于 Total/合计行**：表格底部的 Total 行（合计/汇总行）**不要**作为数据行提取。只提取明细数据行，跳过所有包含 "Total" 字样的汇总行。
10. **关于跨页表格延续**：如果文本从表格数据中间开始（没有列标题行，只有数据行），这是上一页表格的延续。
    请使用以下默认列名作为 Headers：Position, Article, Description, Order Qty, Tot.Pieces, Price unit Buying, DC, Warehouse, Flow, Destination, Packing Code
    并完整提取所有数据行，不要遗漏。

OCR文本：
{ocr_text}

请返回JSON数组格式（不要其他说明文字）：
[{{"Headers": [...], "Rows": [[...], ...]}}]"""

EXTRACT_FIELDS_PROMPT = """请从以下文档全文中提取关键订单信息。仔细阅读全文，这些字段可能分布在文档的不同位置。只返回JSON。

需要提取的字段（如果找不到某个字段，值设为null）：
1. po_number: 订单号（查找 Ordernumber / PO Nº / PO Number / Order number）
2. total_amount: 总金额（查找 Total amount / Gross Amount，包含数字和货币单位）
3. total_quantity: 总件数（查找 Total pieces / Total Units，只要数字）
4. generic_article_no: 通用货号（查找 Generic article no. / Generic article number）
5. cargo_delivery_date: 交货日期（查找 Cargo delivery date，保持原始日期格式如 DD.MM.YYYY）
6. presentation_date: 展示日期（查找 Presentation date，保持原始日期格式）
7. article_description: 产品描述（查找 Article description）
8. delivery_terms: 交货条款（查找 Delivery terms，如 FOB / CIF / EXW / DDP 等）
9. buying_price: 采购单价（查找 Price unit Buying / Buying price，只要数字）
10. supplier_no: 供应商编号（查找 Supplier no / Supplier number）
11. date_of_issue: 签发日期（查找 Date / D. of Issue / Date of issue / Orderdatum，保持原始日期格式如 DD.MM.YYYY）
12. payment_terms: 付款条款（查找 Payment / Payment Terms / Payment conditions）
13. customer_name: 客户名称（查找 Agent / Customer / Buyer / hunkem，如 HKM / Hunkemöller）
14. article_count: 文档中有多少个不同的Article/款式（数一下文档中独立出现的Article Information区段数量或Position表中不同Description首段的数量）

特别注意数字准确性：
- 仔细区分 6 和 9（上下文语义判断：如果周围数字连续递增如 75/80/85，不要误读为 65/80/85）
- 日期中的数字要准确：如 09.01.2026 不要读成 06.01.2026
- EAN条码为13位数字

文本：
{ocr_text}

返回格式：{{"po_number":"...","total_amount":"...","total_quantity":"...","generic_article_no":"...","cargo_delivery_date":"...","presentation_date":"...","article_description":"...","delivery_terms":"...","buying_price":"...","supplier_no":"...","date_of_issue":"...","payment_terms":"...","customer_name":"...","article_count":"..."}}"""


class ProcessRequest(BaseModel):
    file_url: str
    file_name: Optional[str] = None
    knowledge_id: Optional[int] = None
    user_id: Optional[int] = None


_TABLE_CONTINUATION_HINT = (
    '[注意：以下内容是上一页 Position 明细表的延续，列标题为: '
    'Position, Article, Description, Order Qty, Tot.Pieces, '
    'Price unit Buying, DC, Warehouse, Flow, Destination, Packing Code]\n'
)

_SECTION_KEYWORDS = (
    'Supplier', 'Article Information', 'Ordered pieces per size',
    'HS code', 'Sales Prices', 'Target group', 'Position',
    'Pagina', 'hunkem',
)


def _looks_like_table_continuation(chunk: str) -> bool:
    """Check if a chunk is likely a continuation of a position detail table."""
    text = re.sub(r'^---\s*Page\s*\d+\s*---\s*\n?', '', chunk.strip())
    if not text:
        return False
    lines = [ln.strip() for ln in text.split('\n')[:8] if ln.strip()]
    if not lines:
        return False
    for line in lines[:3]:
        if any(kw.lower() in line.lower() for kw in _SECTION_KEYWORDS):
            return False
    numeric_start = sum(1 for ln in lines[:5] if re.match(r'^\d+\s', ln))
    return numeric_start >= 2


def _split_ocr_text(text: str, max_chars: int = 4000) -> list[str]:
    """Split OCR text into chunks at page boundaries to keep LLM calls manageable.

    Each page is sent as a separate chunk when possible to avoid data loss from
    LLM output truncation. Pages are only merged when they are very small.
    Continuation pages (table data without headers) get a context hint prepended.
    """
    pages = re.split(
        r'(?=hunkem[oö]ller\s*\n\s*Pagina\s*:|---\s*Page\s*\d|'
        r'\f|Pagina\s*:\s*\d+|\nPage\s+\d+\s+of\s+\d+|'
        r'(?:^|\n)(?=Position\s+Article\s+Description)|'
        r'\n(?=Supplier\s*\n)|'
        r'\n(?=Article\s+Information))',
        text, flags=re.IGNORECASE,
    )
    pages = [p for p in pages if p.strip()]
    if not pages:
        if len(text) <= max_chars:
            return [text]
        mid = len(text) // 2
        nl = text.rfind('\n', 0, mid + 500)
        if nl > mid - 500:
            return [text[:nl], text[nl:]]
        return [text[:max_chars], text[max_chars:]]

    chunks: list[str] = []
    current = ''
    for page in pages:
        if not current:
            current = page
            continue
        combined_len = len(current) + len(page)
        if combined_len > max_chars:
            chunks.append(current)
            current = page
        elif len(current) < 800 and combined_len <= max_chars:
            current += page
        else:
            chunks.append(current)
            current = page
    if current:
        chunks.append(current)

    if not chunks:
        return [text[:max_chars]]

    result: list[str] = [chunks[0]]
    for chunk in chunks[1:]:
        if _looks_like_table_continuation(chunk):
            result.append(_TABLE_CONTINUATION_HINT + chunk)
        else:
            result.append(chunk)
    return result


def _clean_llm_json(text: str) -> str:
    """Strip markdown code fences and leading/trailing whitespace from LLM output."""
    text = text.strip()
    if text.startswith('```'):
        text = text.split('\n', 1)[-1]
        if text.endswith('```'):
            text = text[:-3].strip()
    start = text.find('[')
    end = text.rfind(']')
    if start != -1 and end != -1:
        return text[start:end + 1]
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        return '[' + text[start:end + 1] + ']'
    return text


PADDLEOCR_URL = os.environ.get('PADDLEOCR_URL', 'http://localhost:8400')
PADDLEOCR_TIMEOUT = int(os.environ.get('PADDLEOCR_TIMEOUT', '900'))


async def _call_paddleocr(file_url: str) -> Optional[str]:
    """Call PaddleOCR HTTP server to extract text from PDF/image.

    Downloads the file to a local temp path, then POSTs the path to
    the PaddleOCR FastAPI service running on the same host.
    """
    from urllib.parse import urlparse

    tmp_path = None
    try:
        parsed = urlparse(file_url)
        url_path = parsed.path.lower()
        if url_path.endswith('.pdf'):
            suffix = '.pdf'
        elif any(url_path.endswith(ext) for ext in ('.jpg', '.jpeg', '.png', '.bmp')):
            suffix = '.' + url_path.rsplit('.', 1)[-1]
        else:
            suffix = '.pdf'

        logger.info('Downloading file for OCR: %s', file_url[:120])
        http_client = await _get_shared_http_client()
        resp = await http_client.get(file_url)
        resp.raise_for_status()

        tmp_path = f'/tmp/ocr_input_{os.getpid()}_{id(file_url)}{suffix}'
        with open(tmp_path, 'wb') as f:
            f.write(resp.content)
        logger.info('Downloaded %d bytes -> %s', len(resp.content), tmp_path)

        ocr_client = httpx.AsyncClient(timeout=httpx.Timeout(PADDLEOCR_TIMEOUT, connect=30))
        try:
            logger.info('Calling PaddleOCR HTTP /ocr for %s (timeout=%ds)', tmp_path, PADDLEOCR_TIMEOUT)
            ocr_resp = await ocr_client.post(
                f'{PADDLEOCR_URL}/ocr',
                json={'input_data': tmp_path, 'output_mode': 'simple'},
            )
            ocr_resp.raise_for_status()
            data = ocr_resp.json()
        finally:
            await ocr_client.aclose()

        if 'error' in data:
            logger.error('PaddleOCR returned error: %s', str(data['error'])[:300])
            return None

        text = data.get('text', '')
        if text and text.strip():
            elapsed = data.get('elapsed', '?')
            pages = data.get('pages', '?')
            logger.info('OCR completed: %d chars, %s pages, %ss', len(text), pages, elapsed)
            return text

        logger.warning('PaddleOCR returned empty text')
        return None

    except httpx.TimeoutException:
        logger.error('PaddleOCR HTTP call timed out after %ds for %s', PADDLEOCR_TIMEOUT, file_url[:80])
        return None
    except Exception as e:
        logger.exception('PaddleOCR HTTP call failed: %s', e)
        return None
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


_llm_config_cache: Optional[dict] = None
_shared_http_client: Optional[httpx.AsyncClient] = None


async def _get_shared_http_client() -> httpx.AsyncClient:
    """Get or create a shared httpx client for reuse across calls."""
    global _shared_http_client
    if _shared_http_client is None or _shared_http_client.is_closed:
        _shared_http_client = httpx.AsyncClient(timeout=300)
    return _shared_http_client


async def _get_llm_config() -> dict:
    """Load LLM config from database (workflow_llm model_id -> llm_model -> llm_server)."""
    global _llm_config_cache
    if _llm_config_cache:
        return _llm_config_cache

    try:
        from sqlmodel import text
        from mep.core.database.manager import get_sync_db_session

        with get_sync_db_session() as session:
            cfg_row = session.execute(
                text("SELECT value FROM config WHERE `key` = 'workflow_llm' LIMIT 1")
            ).first()
            if not cfg_row:
                return {}
            model_id = json.loads(cfg_row[0]).get('model_id')
            if not model_id:
                return {}

            model_row = session.execute(
                text("SELECT model_name, server_id FROM llm_model WHERE id = :mid"),
                params={'mid': model_id},
            ).first()
            if not model_row:
                return {}
            model_name, server_id = model_row

            server_row = session.execute(
                text("SELECT type, config FROM llm_server WHERE id = :sid"),
                params={'sid': server_id},
            ).first()
            if not server_row:
                return {}
            server_type, server_config_str = server_row
            server_config = json.loads(server_config_str) if server_config_str else {}

            api_key = server_config.get('openai_api_key') or server_config.get('api_key', '')

            api_base_map = {
                'qwen': 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                'openai': server_config.get('openai_api_base', 'https://api.openai.com/v1'),
                'openai_compatible': server_config.get('openai_api_base', server_config.get('base_url', '')),
            }
            api_base = api_base_map.get(server_type, server_config.get('openai_api_base', ''))

            _llm_config_cache = {
                'api_base': api_base.rstrip('/'),
                'api_key': api_key,
                'model': model_name,
            }
            return _llm_config_cache
    except Exception as e:
        logger.exception('Failed to load LLM config from database')
        return {}


async def _call_llm(prompt: str) -> Optional[str]:
    """Call the configured LLM for text structuring."""
    try:
        llm_config = await _get_llm_config()
        if not llm_config:
            logger.error('No LLM configured in database')
            return None

        api_base = llm_config['api_base']
        api_key = llm_config['api_key']
        model = llm_config['model']

        headers = {'Content-Type': 'application/json'}
        if api_key:
            headers['Authorization'] = f'Bearer {api_key}'

        payload = {
            'model': model,
            'messages': [{'role': 'user', 'content': prompt}],
            'temperature': 0.1,
            'max_tokens': 8192,
        }

        client = await _get_shared_http_client()
        resp = await client.post(
            f'{api_base}/chat/completions',
            headers=headers,
            json=payload,
        )
        if resp.status_code != 200:
            logger.error('LLM returned %d: %s', resp.status_code, resp.text[:300])
        resp.raise_for_status()
        data = resp.json()
        return data['choices'][0]['message']['content']

    except Exception as e:
        logger.exception('LLM call failed')
        return None


async def _save_to_minio(
    content: bytes,
    object_name: str,
    content_type: str = 'application/octet-stream',
) -> Optional[str]:
    """Upload content to MinIO and return the URL."""
    try:
        from mep.core.storage.minio.minio_manager import get_minio_storage
        minio = await get_minio_storage()
        import io
        minio.put_object_sync(
            bucket_name=minio.bucket,
            object_name=object_name,
            file=io.BytesIO(content),
            file_name=object_name,
        )
        return f'/api/v1/filelib/download/{object_name}'
    except Exception as e:
        logger.exception('MinIO upload failed')
        return None


async def _save_to_knowledge(
    knowledge_id: int,
    file_name: str,
    file_content: bytes,
    tags: dict,
    user_id: Optional[int] = None,
) -> Optional[int]:
    """Save file to knowledge base with tags."""
    try:
        from mep.knowledge.domain.models.knowledge_file import KnowledgeFile, KnowledgeFileDao
        from mep.core.storage.minio.minio_manager import get_minio_storage_sync
        import io
        from datetime import datetime

        from mep.knowledge.domain.models.knowledge_file import ParseType
        db_file = KnowledgeFile(
            knowledge_id=knowledge_id,
            file_name=file_name,
            file_size=len(file_content),
            user_id=user_id,
            status=2,
            parse_type=ParseType.UN_ETL4LM.value,
        )
        db_file = KnowledgeFileDao.add_file(db_file)

        ext = file_name.rsplit('.', 1)[-1] if '.' in file_name else 'bin'
        object_name = f'original/{db_file.id}.{ext}'
        db_file.object_name = object_name

        user_metadata = {}
        for k, v in tags.items():
            if v:
                user_metadata[k] = {
                    'field_value': str(v),
                    'updated_at': int(datetime.now().timestamp()),
                    'field_type': 'string',
                }
        db_file.user_metadata = user_metadata
        KnowledgeFileDao.update(db_file)

        minio = get_minio_storage_sync()
        minio.put_object_sync(
            bucket_name=minio.bucket,
            object_name=object_name,
            file=io.BytesIO(file_content),
            content_type='text/markdown' if file_name.endswith('.md') else 'application/octet-stream',
        )

        logger.info('Saved file to knowledge base: %s (id=%d, object=%s)', file_name, db_file.id, object_name)
        return db_file.id
    except Exception as e:
        logger.exception('Knowledge base save failed')
        return None


@router.post('/process')
async def process_sales_order(req: ProcessRequest):
    """Full pipeline: OCR -> Structure -> Parse -> DB -> Packing List -> Doc Center."""
    try:
        file_url = req.file_url
        file_name = req.file_name or file_url.rsplit('/', 1)[-1] or 'order.pdf'

        # Step 1: OCR with multi-model fallback
        logger.info('Step 1: OCR with fallback for %s', file_url)
        try:
            from mep.core.ai.model_registry import call_ocr_with_fallback, call_llm_with_fallback
            ocr_text = await call_ocr_with_fallback(file_url)
        except Exception:
            logger.warning('Multi-model OCR unavailable, falling back to direct PaddleOCR')
            ocr_text = await _call_paddleocr(file_url)
        if not ocr_text:
            return resp_500(message='PaddleOCR failed to extract text from the file')

        # Step 2+3: LLM structuring + field extraction (parallel) with fallback
        logger.info('Step 2+3: Structuring OCR text and extracting fields with LLM (parallel)')
        chunks = _split_ocr_text(ocr_text, max_chars=4000)
        logger.info('Split OCR text into %d chunks (total %d chars)', len(chunks), len(ocr_text))

        async def _llm_call(prompt: str):
            try:
                return await call_llm_with_fallback(prompt)
            except Exception:
                return await _call_llm(prompt)

        structure_coros = [
            _llm_call(STRUCTURE_PROMPT.format(ocr_text=chunk))
            for chunk in chunks
        ]
        field_coro = _llm_call(
            EXTRACT_FIELDS_PROMPT.format(ocr_text=ocr_text[:12000]),
        )
        all_results = await asyncio.gather(
            *structure_coros, field_coro, return_exceptions=True,
        )

        structure_results = all_results[:-1]
        fields_result = all_results[-1]

        all_tables: list = []
        for i, chunk_result in enumerate(structure_results):
            if isinstance(chunk_result, Exception):
                logger.warning('LLM call failed for chunk %d: %s', i, chunk_result)
                continue
            if not chunk_result:
                logger.warning('LLM returned empty result for chunk %d', i)
                continue
            cleaned = _clean_llm_json(chunk_result)
            try:
                tables = json.loads(cleaned)
                if isinstance(tables, list):
                    all_tables.extend(tables)
                    logger.info('Chunk %d: extracted %d tables', i, len(tables))
                elif isinstance(tables, dict):
                    all_tables.append(tables)
                    logger.info('Chunk %d: extracted 1 table', i)
            except json.JSONDecodeError:
                logger.warning('Failed to parse LLM output for chunk %d: %s...', i, cleaned[:200])

        if not all_tables:
            return resp_500(message='LLM failed to structure OCR text')
        logger.info('Total tables extracted: %d from %d chunks', len(all_tables), len(chunks))
        tables_json_str = json.dumps(all_tables, ensure_ascii=False)

        extra_fields = {}
        fields_str = fields_result if isinstance(fields_result, str) else None
        if fields_str:
            try:
                fields_str = fields_str.strip()
                if fields_str.startswith('```'):
                    fields_str = fields_str.split('\n', 1)[-1]
                    if fields_str.endswith('```'):
                        fields_str = fields_str[:-3].strip()
                start = fields_str.find('{')
                end = fields_str.rfind('}')
                if start != -1 and end != -1:
                    extra_fields = json.loads(fields_str[start:end + 1])
            except Exception:
                logger.warning('Failed to parse extra fields JSON')
        if extra_fields:
            logger.info('Extra fields extracted: %s', {k: v for k, v in extra_fields.items() if v})

        # Step 3.5: Apply customer-specific parse rules if available
        customer_name = extra_fields.get('customer_name', '')
        if customer_name:
            try:
                from mep.database.models.parse_rule import ParseRuleDao
                rule = await ParseRuleDao.get_rule_for_customer(customer_name)
                if rule and rule.field_mapping:
                    logger.info('Applying parse rule "%s" for customer %s', rule.rule_name, customer_name)
                    for src_field, tgt_field in rule.field_mapping.items():
                        if src_field in extra_fields and tgt_field not in extra_fields:
                            extra_fields[tgt_field] = extra_fields[src_field]
                if rule and rule.regex_rules:
                    import re as _re
                    for field_name, pattern in rule.regex_rules.items():
                        match = _re.search(pattern, ocr_text[:8000])
                        if match and field_name not in extra_fields:
                            extra_fields[field_name] = match.group(1) if match.lastindex else match.group(0)
            except Exception:
                logger.exception('Parse rule lookup failed for %s', customer_name)

        # Step 3.6: Record prompt version usage
        try:
            from mep.database.models.parse_rule import PromptVersionDao
            pv = await PromptVersionDao.get_active_prompt('structure_prompt')
            if pv:
                await PromptVersionDao.record_usage(pv.id, success=bool(all_tables))
        except Exception:
            pass

        # Step 4: Parse and import
        logger.info('Step 4: Parsing and importing orders')
        from mep.core.documents.parser import OrderParser
        parser = OrderParser()
        orders = parser.parse(tables_json_str, extra_fields)
        if not orders:
            return resp_500(message='No orders could be parsed from the document')

        source_url = file_url

        for order in orders:
            order['source_file_url'] = source_url

        from mep.database.models.sales_order import SalesOrderDao
        header_ids = await SalesOrderDao.import_orders(orders)

        # Step 5: Generate combined packing list for all orders from this file
        logger.info('Step 5: Generating packing lists')
        packing_results = []
        all_orders_for_packing = []
        all_lines_for_packing = []
        for hid in header_ids:
            try:
                header = await SalesOrderDao.get_header(hid)
                lines = await SalesOrderDao.get_lines(hid)
                if not header or not lines:
                    continue
                all_orders_for_packing.append(header.dict())
                all_lines_for_packing.append([l.dict() for l in lines])
            except Exception:
                logger.exception('Failed to load data for header %d', hid)

        if all_orders_for_packing:
            try:
                customer = (all_orders_for_packing[0].get('customer_name') or '').upper()
                from mep.core.documents.packing_list import (
                    generate_hkm_packing_list_combined,
                    generate_generic_packing_list,
                )
                from mep.database.models.packing_spec import PackingSpecDao
                specs = await PackingSpecDao.find_by_customer(customer)
                specs_dict = [s.dict() for s in specs] if specs else []

                if 'HKM' in customer:
                    excel_bytes = generate_hkm_packing_list_combined(
                        all_orders_for_packing, all_lines_for_packing,
                        customer_specs=specs_dict,
                    )
                else:
                    flat_lines = [ln for lines in all_lines_for_packing for ln in lines]
                    excel_bytes = generate_generic_packing_list(
                        all_orders_for_packing[0], flat_lines,
                        customer_specs=specs_dict,
                    )

                po = all_orders_for_packing[0].get('po', '') or str(header_ids[0])
                packing_obj_name = f'sales_order/packing_list_{po}.xlsx'
                packing_url = await _save_to_minio(
                    excel_bytes, packing_obj_name,
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                )
                if packing_url:
                    for hid in header_ids:
                        await SalesOrderDao.update_header(hid, {'packing_list_url': packing_url})
                    packing_results.append({
                        'header_ids': header_ids,
                        'packing_list_url': packing_url,
                    })
            except Exception:
                logger.exception('Packing list generation failed')

        # Step 6: Save to document center (knowledge base)
        logger.info('Step 6: Saving to document center')
        doc_center_results = []
        target_knowledge_id = req.knowledge_id
        if not target_knowledge_id:
            try:
                from mep.core.database.manager import get_sync_db_session
                from sqlmodel import text as sql_text
                with get_sync_db_session() as session:
                    row = session.execute(
                        sql_text("SELECT value FROM config WHERE `key` = 'order_assistant_config' LIMIT 1")
                    ).first()
                    if row:
                        cfg = json.loads(row[0])
                        target_knowledge_id = cfg.get('knowledge_id')
            except Exception:
                pass
            if not target_knowledge_id:
                target_knowledge_id = 1

        if target_knowledge_id:
            from mep.api.v1.order_assistant import _build_order_markdown
            for order_dict, lines_dict in zip(all_orders_for_packing,
                                               [l_list for l_list in all_lines_for_packing]):
                po = order_dict.get('po', '') or ''
                customer = order_dict.get('customer_name', '')
                article = order_dict.get('generic_article_no', '') or ''
                tags = {
                    'file_name': file_name,
                    'customer_name': customer,
                    'order_number': po,
                    'article_no': article,
                    'source_type': 'sales_order',
                }

                md_text = _build_order_markdown(order_dict, lines_dict, file_name)
                md_bytes = md_text.encode('utf-8')
                md_name = f'{po or os.path.splitext(file_name)[0]}.md'
                md_file_id = await _save_to_knowledge(
                    target_knowledge_id, md_name, md_bytes, tags, req.user_id,
                )
                if md_file_id:
                    doc_center_results.append({'file': md_name, 'file_id': md_file_id})
                    logger.info('Saved structured MD to knowledge base: %s (file_id=%d)', md_name, md_file_id)

                # Save source file (download and re-upload)
                try:
                    async with httpx.AsyncClient(timeout=60) as client:
                        resp = await client.get(file_url)
                        if resp.status_code == 200:
                            src_file_id = await _save_to_knowledge(
                                target_knowledge_id, file_name,
                                resp.content, tags, req.user_id,
                            )
                            if src_file_id:
                                doc_center_results.append({'file': file_name, 'file_id': src_file_id})
                except Exception:
                    logger.warning('Failed to save source file to knowledge base')

        result = {
            'header_ids': header_ids,
            'order_count': len(header_ids),
            'packing_lists': packing_results,
            'doc_center': doc_center_results,
            'message': f'成功解析并导入 {len(header_ids)} 个订单',
        }

        logger.info('Processing complete: %s', result['message'])
        return resp_200(result)

    except Exception as e:
        logger.exception('Sales order processing failed')
        return resp_500(message=str(e))
