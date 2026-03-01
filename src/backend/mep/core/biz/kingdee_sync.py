"""Sync BOM and Sample data to Kingdee K3Cloud via Web API.

Form IDs:
  BOM:     ENG_BOM
  Sample:  PAEZ_MES000069

Uses KingdeeApiClient.save() → submit() pattern.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

BOM_FORM_ID = 'ENG_BOM'
SAMPLE_FORM_ID = 'PAEZ_MES000069'


def _build_bom_payload(bom: dict, details: list[dict]) -> dict:
    """Map biz_bom + biz_bom_detail → Kingdee ENG_BOM save payload."""
    entry_rows = []
    for i, d in enumerate(details):
        entry_rows.append({
            'FEntryID': 0,
            'FMaterialIDNew': {'FNumber': d.get('material_code', '')},
            'FMaterialName': d.get('material_name', ''),
            'FUnitID': {'FNumber': d.get('unit', 'Pcs')},
            'FNumerator': d.get('check_usage', '1'),
            'FDenominator': '1',
            'FMaterialType': {'FNumber': d.get('inventory_category', '')},
            'FFixScrapRate': 0,
            'FReplaceType': 'A',
            'FPositionNo': d.get('position', ''),
            'FWidthDecNew': d.get('width', ''),
            'FWeightDec': d.get('weight', ''),
            'FSupplierID': {'FNumber': d.get('supplier_code', '')},
            'FMaterialDirection': d.get('direction', ''),
        })

    return {
        'IsAutoSubmitAndAudit': False,
        'IsVerifyBaseDataField': False,
        'Model': {
            'FID': 0,
            'FBOMCategory': '1',
            'FMaterialID': {'FNumber': bom.get('factory_article_no', '')},
            'FAuxPropID': {},
            'FUnitID': {'FNumber': 'Pcs'},
            'FCHILDQTY': 1,
            'FVersion': bom.get('version', 'V1.0'),
            'FDocumentStatus': 'Z',
            'FDescription': bom.get('material_group', ''),
            'FTreeEntity': entry_rows,
        },
    }


def _build_sample_payload(sample: dict, ratios: list[dict]) -> dict:
    """Map biz_sample → Kingdee PAEZ_MES000069 save payload."""
    ratio_entries = []
    for r in ratios:
        ratio_entries.append({
            'FEntryID': 0,
            'F_PAEZ_Color': r.get('color', ''),
            'F_PAEZ_Size': r.get('size', ''),
            'F_PAEZ_Unit': r.get('unit', '件'),
            'F_PAEZ_Qty': r.get('quantity', 0),
            'F_PAEZ_Remark': r.get('remark', ''),
        })

    return {
        'IsAutoSubmitAndAudit': False,
        'Model': {
            'FID': 0,
            'FBillNo': sample.get('order_code', ''),
            'F_PAEZ_Customer': {'FNumber': sample.get('customer_name', '')},
            'F_PAEZ_FactoryStyleNo': sample.get('factory_article_no', ''),
            'F_PAEZ_CustomerStyleNo': sample.get('customer_article_no', ''),
            'F_PAEZ_SampleType': sample.get('sample_type', ''),
            'F_PAEZ_DevType': sample.get('dev_type', ''),
            'F_PAEZ_Season': sample.get('season', ''),
            'F_PAEZ_ProcessType': sample.get('process_type', ''),
            'F_PAEZ_SampleQty': sample.get('sample_qty', 0),
            'F_PAEZ_RequiredDate': str(sample.get('required_date', '')) if sample.get('required_date') else '',
            'F_PAEZ_ExpectedDelivery': str(sample.get('expected_delivery', '')) if sample.get('expected_delivery') else '',
            'F_PAEZ_BOMVersion': sample.get('bom_version', 'V1.0'),
            'F_PAEZ_PatternMaker': sample.get('pattern_maker', ''),
            'FEntity': ratio_entries,
        },
    }


async def sync_bom_to_kingdee(bom_id: int) -> dict:
    """Save a BOM to Kingdee K3Cloud."""
    from mep.database.models.biz_tables import BizBomDao, BizBomDetailDao
    from mep.core.kingdee.kingdee_api import get_kingdee_api_client

    bom = await BizBomDao.get_by_id(bom_id)
    if not bom:
        return {'success': False, 'error': 'BOM not found'}

    details = await BizBomDetailDao.list_by_bom(bom_id)
    bom_dict = bom.dict() if hasattr(bom, 'dict') else bom.__dict__
    details_dicts = [d.dict() if hasattr(d, 'dict') else d.__dict__ for d in details]

    payload = _build_bom_payload(bom_dict, details_dicts)

    try:
        client = await get_kingdee_api_client()
        result = await client.save(BOM_FORM_ID, payload)
        logger.info('BOM %d synced to Kingdee: %s', bom_id, str(result)[:200])

        # Update bom with kingdee sync status
        await BizBomDao.update(bom_id, {'kingdee_sync_status': 'saved', 'kingdee_sync_result': str(result)[:500]})

        return {'success': True, 'result': result}
    except Exception as e:
        logger.exception('Failed to sync BOM %d to Kingdee', bom_id)
        await BizBomDao.update(bom_id, {'kingdee_sync_status': 'error', 'kingdee_sync_result': str(e)[:500]})
        return {'success': False, 'error': str(e)}


async def sync_sample_to_kingdee(sample_id: int) -> dict:
    """Save a sample order to Kingdee K3Cloud."""
    from mep.database.models.biz_tables import BizSampleDao, BizSampleRatioDao
    from mep.core.kingdee.kingdee_api import get_kingdee_api_client

    sample = await BizSampleDao.get_by_id(sample_id)
    if not sample:
        return {'success': False, 'error': 'Sample not found'}

    ratios = await BizSampleRatioDao.list_by_sample(sample_id)
    sample_dict = sample.dict() if hasattr(sample, 'dict') else sample.__dict__
    ratios_dicts = [r.dict() if hasattr(r, 'dict') else r.__dict__ for r in ratios]

    payload = _build_sample_payload(sample_dict, ratios_dicts)

    try:
        client = await get_kingdee_api_client()
        result = await client.save(SAMPLE_FORM_ID, payload)
        logger.info('Sample %d synced to Kingdee: %s', sample_id, str(result)[:200])

        await BizSampleDao.update(sample_id, {'kingdee_sync_status': 'saved', 'kingdee_sync_result': str(result)[:500]})
        return {'success': True, 'result': result}
    except Exception as e:
        logger.exception('Failed to sync sample %d to Kingdee', sample_id)
        await BizSampleDao.update(sample_id, {'kingdee_sync_status': 'error', 'kingdee_sync_result': str(e)[:500]})
        return {'success': False, 'error': str(e)}
