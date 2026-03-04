"""Auto-extract fields from parsed sales order data and populate biz tables.

Four extraction strategies (per the plan):
  1. Direct mapping  – fields from sales_order_header/line → biz tables  (0 token)
  2. LLM inference   – product_family, product_category, process_type…  (low token)
  3. Master data match – customer → assignee, supplier_code             (0 token)
  4. Cross-table inherit – BOM/sample inherit from follow_up            (0 token)
"""

import json
import logging
from datetime import date, datetime
from typing import Optional

logger = logging.getLogger(__name__)

# Fields considered "required" for completeness checking per table
FOLLOW_UP_REQUIRED = [
    'factory_article_no', 'customer_name', 'po_number', 'color', 'size',
]
BOM_REQUIRED = [
    'factory_article_no',
]
SAMPLE_REQUIRED = [
    'factory_article_no', 'customer_name', 'sample_type',
]


def _calc_pending(data: dict, required_fields: list[str]) -> list[str]:
    """Return list of required field names that are empty/None."""
    pending = []
    for f in required_fields:
        val = data.get(f)
        if val is None or (isinstance(val, str) and not val.strip()):
            pending.append(f)
    return pending


def _safe_date(val: Optional[str]) -> Optional[date]:
    if not val or not isinstance(val, str):
        return None
    val = val.strip()
    for fmt in ('%Y-%m-%d', '%d.%m.%Y', '%d/%m/%Y', '%Y/%m/%d'):
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    return None


async def _llm_infer_fields(article_description: str, customer_name: str = '') -> dict:
    """Use LLM to infer product_family, product_category, process_type, stage."""
    if not article_description:
        return {}
    try:
        from mep.api.v1.sales_order_process import _call_llm

        prompt = (
            "根据以下服装产品描述，推断并返回JSON对象（只返回JSON，不要其他文字）：\n"
            '{"product_family":"产品族（如针织/梭织/内衣/泳衣等）",'
            '"product_category":"产品大类（如上衣/裤子/裙子/连衣裙等）",'
            '"process_type":"加工工艺（如印花/绣花/水洗等，无法判断则为空）",'
            '"stage":"阶段（打样/大货，默认打样）",'
            '"material_group":"物料分组（如果能从描述推断）"}\n\n'
            f"产品描述: {article_description[:500]}\n"
            f"客户: {customer_name}"
        )
        result = await _call_llm(prompt)
        if not result:
            return {}
        result = result.strip()
        if result.startswith('```'):
            result = result.split('\n', 1)[-1]
            if result.endswith('```'):
                result = result[:-3].strip()
        start = result.find('{')
        end = result.rfind('}')
        if start != -1 and end != -1:
            return json.loads(result[start:end + 1])
    except Exception:
        logger.exception('LLM inference failed for auto_extract')
    return {}


async def _extract_images_from_pdf(source_url: str, max_images: int = 5) -> list[str]:
    """Extract embedded images from a PDF and upload to MinIO.

    Returns list of download URLs for extracted images.
    """
    if not source_url:
        return []
    urls: list[str] = []
    tmp_path = None
    try:
        import httpx
        import fitz
        import io

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(source_url)
            if resp.status_code != 200:
                return []
            pdf_bytes = resp.content

        tmp_path = f'/tmp/img_extract_{id(source_url)}.pdf'
        with open(tmp_path, 'wb') as f:
            f.write(pdf_bytes)

        doc = fitz.open(tmp_path)
        img_count = 0
        for page_idx in range(min(doc.page_count, 10)):
            for img_info in doc.get_page_images(page_idx, full=True):
                xref = img_info[0]
                base_img = doc.extract_image(xref)
                if not base_img or not base_img.get('image'):
                    continue
                img_bytes = base_img['image']
                ext = base_img.get('ext', 'png')
                if len(img_bytes) < 5000:
                    continue
                obj_name = f'style_images/{id(source_url)}_{page_idx}_{xref}.{ext}'
                try:
                    from mep.core.storage.minio.minio_manager import get_minio_storage_sync
                    minio = get_minio_storage_sync()
                    minio.put_object_sync(
                        bucket_name=minio.bucket,
                        object_name=obj_name,
                        file=io.BytesIO(img_bytes),
                        content_type=f'image/{ext}',
                    )
                    urls.append(f'/api/v1/filelib/download/{obj_name}')
                    img_count += 1
                    if img_count >= max_images:
                        break
                except Exception:
                    logger.warning('Failed to upload extracted image %s', obj_name)
            if img_count >= max_images:
                break
        doc.close()
    except ImportError:
        logger.debug('fitz (PyMuPDF) not available, skipping image extraction')
    except Exception:
        logger.exception('Image extraction failed')
    finally:
        if tmp_path:
            import os
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    return urls


async def populate_three_tables(
    header_id: int,
    task_id: int,
    creator_id: Optional[int] = None,
) -> dict:
    """Create follow_up + bom + sample records from a parsed sales order.

    Returns dict with keys: follow_up_id, bom_id, sample_id, pending_summary.
    """
    from mep.database.models.sales_order import SalesOrderDao
    from mep.database.models.master_data import MasterDataDao
    from mep.database.models.biz_tables import (
        BizFollowUpDao, BizBomDao, BizBomDetailDao,
        BizSampleDao, BizSampleRatioDao, BizSampleMaterialDao,
    )

    header = await SalesOrderDao.get_header(header_id)
    if not header:
        logger.error('Header %d not found', header_id)
        return {}
    lines = await SalesOrderDao.get_lines(header_id)
    h = header.dict() if hasattr(header, 'dict') else header.__dict__

    # --- 1. Direct mapping from header ---
    colors = sorted({ln.colour for ln in lines if ln.colour})
    sizes = sorted({ln.size for ln in lines if ln.size})

    # Extract style images from source PDF
    style_images: list[str] = []
    source_url = h.get('source_file_url')
    if source_url:
        try:
            style_images = await _extract_images_from_pdf(source_url)
            if style_images:
                logger.info('Extracted %d style images from %s', len(style_images), source_url[:80])
        except Exception:
            logger.exception('Style image extraction failed')

    follow_up_data = {
        'factory_article_no': h.get('generic_article_no'),
        'customer_article_no': h.get('generic_article_no'),
        'product_desc': h.get('article_description'),
        'customer_name': h.get('customer_name'),
        'brand': h.get('brand'),
        'season': h.get('season'),
        'color': ', '.join(colors) if colors else None,
        'size': ', '.join(sizes) if sizes else None,
        'po_number': h.get('po'),
        'header_id': header_id,
        'task_id': task_id,
        'creator_id': creator_id,
        'style_images': style_images,
        'primary_image_idx': 0,
    }

    # --- 2. LLM inference for derived fields ---
    inferred = await _llm_infer_fields(
        h.get('article_description', ''),
        h.get('customer_name', ''),
    )
    follow_up_data['product_family'] = inferred.get('product_family')
    follow_up_data['product_category'] = inferred.get('product_category')
    follow_up_data['process_type'] = inferred.get('process_type')
    follow_up_data['material_group'] = inferred.get('material_group')

    # --- 3. Master data match ---
    customer_name = h.get('customer_name', '')
    customer_record = await MasterDataDao.get_customer_by_name(customer_name) if customer_name else None

    # --- Pending fields & completeness ---
    pending = _calc_pending(follow_up_data, FOLLOW_UP_REQUIRED)
    follow_up_data['pending_fields'] = pending
    follow_up_data['completeness'] = 'complete' if not pending else 'incomplete'

    follow_up = await BizFollowUpDao.create(follow_up_data)
    logger.info('Created BizFollowUp id=%d for header=%d', follow_up.id, header_id)

    # --- BOM table (header) ---
    stage = inferred.get('stage', '打样')
    bom_data = {
        'factory_article_no': follow_up_data['factory_article_no'],
        'customer_article_no': follow_up_data['customer_article_no'],
        'color_group': follow_up_data['color'],
        'size_group': follow_up_data['size'],
        'stage': stage,
        'material_group': follow_up_data.get('material_group'),
        'material_name': h.get('article_description', '')[:2000] if h.get('article_description') else None,
        'version': 'V1.0',
        'contract_no': h.get('reference'),
        'task_id': task_id,
        'follow_up_id': follow_up.id,
    }
    bom_pending = _calc_pending(bom_data, BOM_REQUIRED)
    bom_data['pending_fields'] = bom_pending
    bom_data['completeness'] = 'complete' if not bom_pending else 'incomplete'
    bom = await BizBomDao.create(bom_data)
    logger.info('Created BizBom id=%d', bom.id)

    # --- BOM detail rows from order lines ---
    bom_details = []
    for ln in lines:
        desc = ln.description if hasattr(ln, 'description') else None
        bom_details.append({
            'position': ln.position if hasattr(ln, 'position') else None,
            'material_name': desc or h.get('article_description', '')[:2000],
            'color': ln.colour if hasattr(ln, 'colour') else None,
            'size': ln.size if hasattr(ln, 'size') else None,
            'check_usage': str(ln.quantity) if ln.quantity else None,
        })
    if bom_details:
        try:
            await BizBomDetailDao.replace_all(bom.id, bom_details)
            logger.info('Created %d BizBomDetail rows for bom=%d', len(bom_details), bom.id)
        except Exception:
            logger.exception('Failed to create BizBomDetail rows')

    # --- Sample table ---
    sample_data = {
        'style_images': follow_up_data.get('style_images', []),
        'primary_image_idx': 0,
        'sample_type': inferred.get('stage', '打样'),
        'dev_type': None,
        'customer_name': customer_name,
        'factory_article_no': follow_up_data['factory_article_no'],
        'customer_article_no': follow_up_data['customer_article_no'],
        'material_name': bom_data.get('material_name'),
        'process_type': follow_up_data.get('process_type'),
        'season': follow_up_data.get('season'),
        'bom_version': 'V1.0',
        'color': follow_up_data.get('color'),
        'size': follow_up_data.get('size'),
        'product_category': follow_up_data.get('product_category'),
        'pattern_maker': None,
        'required_date': _safe_date(h.get('cargo_delivery_date')),
        'apply_date': date.today(),
        'contract_no': h.get('reference'),
        'task_id': task_id,
        'follow_up_id': follow_up.id,
    }
    if customer_record and customer_record.customer_service_id:
        try:
            from mep.user.domain.models.user import UserDao
            cs_user = await UserDao.aget_user(customer_record.customer_service_id)
            if cs_user:
                sample_data['sample_applicant'] = cs_user.user_name
        except Exception:
            pass

    sample_pending = _calc_pending(sample_data, SAMPLE_REQUIRED)
    sample_data['pending_fields'] = sample_pending
    sample_data['completeness'] = 'complete' if not sample_pending else 'incomplete'
    sample = await BizSampleDao.create(sample_data)
    logger.info('Created BizSample id=%d', sample.id)

    # --- Sample ratios (one per color+size combination) ---
    ratios = []
    for ln in lines:
        if ln.colour or ln.size:
            ratios.append({
                'color': ln.colour,
                'size': ln.size,
                'unit': '件',
                'quantity': ln.quantity or ln.tot_pieces or 1,
            })
    if ratios:
        await BizSampleRatioDao.replace_all(sample.id, ratios)

    return {
        'follow_up_id': follow_up.id,
        'bom_id': bom.id,
        'sample_id': sample.id,
        'pending_summary': {
            'follow_up': pending,
            'bom': bom_pending,
            'sample': sample_pending,
        },
    }


def check_completeness(data: dict, table_type: str) -> tuple[str, list[str]]:
    """Check if a biz record has all required fields filled.

    Returns (completeness_status, pending_fields_list).
    """
    req_map = {
        'follow_up': FOLLOW_UP_REQUIRED,
        'bom': BOM_REQUIRED,
        'sample': SAMPLE_REQUIRED,
    }
    required = req_map.get(table_type, [])
    pending = _calc_pending(data, required)
    status = 'complete' if not pending else 'incomplete'
    return status, pending
