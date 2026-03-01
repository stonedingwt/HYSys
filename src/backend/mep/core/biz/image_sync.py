"""Sync primary style image to Kingdee as an attachment.

When user sets a primary image on follow_up or sample,
download it and upload to the corresponding Kingdee bill.
"""

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


async def sync_primary_image_to_kingdee(
    form_id: str,
    bill_id: str,
    image_url: str,
    filename: Optional[str] = None,
) -> dict:
    """Download image from URL and upload to Kingdee bill as attachment.

    Args:
        form_id: Kingdee form ID (e.g. 'PAEZ_MES000069' for sample)
        bill_id: Kingdee bill internal ID
        image_url: URL of the image to download
        filename: Display filename, auto-derived if not provided
    """
    from mep.core.kingdee.kingdee_api import get_kingdee_api_client

    if not filename:
        filename = image_url.rsplit('/', 1)[-1].split('?')[0] or 'style_image.jpg'

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(image_url)
        resp.raise_for_status()
        file_bytes = resp.content

    if not file_bytes:
        return {'success': False, 'error': 'empty image'}

    kd_client = await get_kingdee_api_client()
    result = await kd_client.upload_attachment(
        form_id=form_id,
        bill_id=bill_id,
        file_bytes=file_bytes,
        filename=filename,
    )
    logger.info('Uploaded primary image to Kingdee: form=%s bill=%s file=%s', form_id, bill_id, filename)
    return {'success': True, 'result': result}


async def sync_follow_up_primary_image(follow_up_id: int) -> Optional[dict]:
    """Sync the primary image of a follow_up record to Kingdee.

    The follow_up's linked Kingdee product bill is looked up via
    factory_article_no → Kingdee product query.
    """
    from mep.database.models.biz_tables import BizFollowUpDao
    from mep.core.kingdee.kingdee_api import get_kingdee_api_client

    fu = await BizFollowUpDao.get_by_id(follow_up_id)
    if not fu:
        return None

    images = fu.style_images or []
    idx = fu.primary_image_idx or 0
    if not images or idx >= len(images):
        logger.info('No primary image for follow_up %d', follow_up_id)
        return None

    image_url = images[idx]
    article = fu.factory_article_no or ''

    # Query Kingdee to find the bill_id for this article
    kd_client = await get_kingdee_api_client()
    try:
        rows = await kd_client.execute_bill_query(
            form_id='SAL_SALEORDER',
            field_keys='FID',
            filter_string=f"FBillNo like '%{article}%'" if article else '',
            top_row_count=1,
        )
        if rows and rows[0]:
            bill_id = str(rows[0][0])
            return await sync_primary_image_to_kingdee(
                form_id='SAL_SALEORDER',
                bill_id=bill_id,
                image_url=image_url,
            )
    except Exception:
        logger.exception('Failed to query Kingdee for article %s', article)

    return None
