"""Generate Markdown from biz tables and sync to knowledge base (赛乐文档中心).

Handles:
  - Markdown generation for follow_up / bom / sample tables
  - Upload to knowledge base with customer_name / factory_article_no tags
  - Update on edit (delete old + upload new)
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


def build_follow_up_markdown(fu: dict) -> str:
    """Build Markdown for a follow-up record."""
    art = fu.get('factory_article_no') or ''
    lines = [
        f'# 跟单表 - {art}',
        '',
        '## 基本信息',
        '',
        '| 字段 | 值 |',
        '| --- | --- |',
    ]
    field_map = [
        ('factory_article_no', '厂款号'),
        ('customer_article_no', '客户款号'),
        ('customer_name', '客户'),
        ('brand', '品牌'),
        ('season', '季节'),
        ('po_number', 'PO号'),
        ('color', '颜色'),
        ('size', '尺码'),
        ('product_desc', '产品描述'),
        ('product_family', '产品族'),
        ('product_category', '产品大类'),
        ('process_type', '加工工艺'),
        ('material_group', '物料分组'),
        ('material_name', '物料名称'),
    ]
    for key, label in field_map:
        val = fu.get(key)
        if val:
            lines.append(f'| {label} | {val} |')

    images = fu.get('style_images') or []
    idx = fu.get('primary_image_idx', 0) or 0
    if images:
        lines.extend(['', '## 款式图', ''])
        if 0 <= idx < len(images):
            lines.append(f'![首图]({images[idx]})')
        for i, img in enumerate(images):
            if i != idx:
                lines.append(f'![款式图{i + 1}]({img})')

    return '\n'.join(lines)


def build_bom_markdown(bom: dict, details: list[dict]) -> str:
    """Build Markdown for a BOM record with details."""
    art = bom.get('factory_article_no') or ''
    ver = bom.get('version') or ''
    lines = [
        f'# BOM表 - {art} ({ver})',
        '',
        '## 表头',
        '',
        '| 字段 | 值 |',
        '| --- | --- |',
    ]
    for key, label in [
        ('factory_article_no', '厂款号'), ('customer_article_no', '客款号'),
        ('color_group', '颜色组'), ('size_group', '尺码组'),
        ('stage', '阶段'), ('pattern_maker', '版师'),
        ('contract_no', '订单合同号'), ('material_group', '物料分组'),
    ]:
        val = bom.get(key)
        if val:
            lines.append(f'| {label} | {val} |')

    if details:
        lines.extend([
            '', '## 物料明细', '',
            '| 部位 | 物料名称 | 物料编码 | 颜色 | 门幅 | 克重 | 用量 | 方向 |',
            '| --- | --- | --- | --- | --- | --- | --- | --- |',
        ])
        for d in details:
            row = [
                d.get('position') or '',
                (d.get('material_name') or '')[:30],
                d.get('material_code') or '',
                d.get('color') or '',
                d.get('width') or '',
                d.get('weight') or '',
                d.get('check_usage') or '',
                d.get('direction') or '',
            ]
            lines.append('| ' + ' | '.join(row) + ' |')

    return '\n'.join(lines)


def build_sample_markdown(sample: dict, ratios: list[dict], materials: list[dict]) -> str:
    """Build Markdown for a sample order record."""
    art = sample.get('factory_article_no') or ''
    lines = [
        f'# 打样单 - {art}',
        '',
        '## 基本信息',
        '',
        '| 字段 | 值 |',
        '| --- | --- |',
    ]
    for key, label in [
        ('order_code', '单据编号'), ('customer_name', '客户'),
        ('factory_article_no', '厂款号'), ('customer_article_no', '客款号'),
        ('sample_type', '打样类型'), ('dev_type', '开发类型'),
        ('season', '季节'), ('process_type', '加工工艺'),
        ('sample_qty', '样衣数量'), ('color', '颜色'), ('size', '尺码'),
        ('required_date', '需求日期'), ('expected_delivery', '预计交样日期'),
        ('pattern_maker', '版师'), ('bom_version', 'BOM版本'),
    ]:
        val = sample.get(key)
        if val:
            lines.append(f'| {label} | {val} |')

    images = sample.get('style_images') or []
    idx = sample.get('primary_image_idx', 0) or 0
    if images:
        lines.extend(['', '## 款式图', ''])
        if 0 <= idx < len(images):
            lines.append(f'![首图]({images[idx]})')

    if ratios:
        lines.extend([
            '', '## 打样配比', '',
            '| 颜色 | 尺码 | 数量 | 单位 | 备注 |',
            '| --- | --- | --- | --- | --- |',
        ])
        for r in ratios:
            row = [
                r.get('color') or '', r.get('size') or '',
                str(r.get('quantity') or ''), r.get('unit') or '',
                r.get('remark') or '',
            ]
            lines.append('| ' + ' | '.join(row) + ' |')

    if materials:
        lines.extend([
            '', '## 物料明细', '',
            '| 物料名称 | 规格 | 颜色 | 克重 | 状态 | 部位 |',
            '| --- | --- | --- | --- | --- | --- |',
        ])
        for m in materials:
            row = [
                (m.get('material_name') or '')[:30],
                m.get('spec') or '', m.get('color') or '',
                m.get('gram_weight') or '', m.get('material_status') or '',
                m.get('position') or '',
            ]
            lines.append('| ' + ' | '.join(row) + ' |')

    return '\n'.join(lines)


def _build_tags(fu_data: dict, source_type: str, form_type: str) -> dict:
    return {
        'customer_name': fu_data.get('customer_name', ''),
        'factory_article_no': fu_data.get('factory_article_no', ''),
        'customer_article_no': fu_data.get('customer_article_no', ''),
        'po_number': fu_data.get('po_number', ''),
        'source_type': source_type,
        'form_type': form_type,
    }


async def sync_three_tables_to_knowledge(
    follow_up_id: int,
    knowledge_id: Optional[int] = None,
    user_id: Optional[int] = None,
) -> dict:
    """Generate Markdown for all three tables and upload to knowledge base.

    Returns dict of {form_type: file_id} for successfully uploaded docs.
    """
    from mep.database.models.biz_tables import (
        BizFollowUpDao, BizBomDao, BizBomDetailDao,
        BizSampleDao, BizSampleRatioDao, BizSampleMaterialDao,
    )
    from mep.api.v1.sales_order_process import _save_to_knowledge

    if knowledge_id is None:
        from mep.api.v1.order_assistant import _get_order_knowledge_id
        knowledge_id = await _get_order_knowledge_id()

    fu = await BizFollowUpDao.get_by_id(follow_up_id)
    if not fu:
        logger.error('BizFollowUp %d not found', follow_up_id)
        return {}

    fu_dict = fu.dict() if hasattr(fu, 'dict') else fu.__dict__
    art = fu_dict.get('factory_article_no') or str(follow_up_id)
    results = {}

    # Follow-up Markdown
    md_fu = build_follow_up_markdown(fu_dict)
    tags_fu = _build_tags(fu_dict, 'follow_up', '跟单表')
    fid = await _save_to_knowledge(knowledge_id, f'跟单表_{art}.md', md_fu.encode('utf-8'), tags_fu, user_id)
    if fid:
        results['follow_up'] = fid

    # BOM Markdown
    bom = await BizBomDao.get_by_follow_up(follow_up_id)
    if bom:
        bom_dict = bom.dict() if hasattr(bom, 'dict') else bom.__dict__
        details = await BizBomDetailDao.list_by_bom(bom.id)
        details_dicts = [d.dict() if hasattr(d, 'dict') else d.__dict__ for d in details]
        md_bom = build_bom_markdown(bom_dict, details_dicts)
        tags_bom = _build_tags(fu_dict, 'bom', 'BOM表')
        fid = await _save_to_knowledge(knowledge_id, f'BOM表_{art}.md', md_bom.encode('utf-8'), tags_bom, user_id)
        if fid:
            results['bom'] = fid

    # Sample Markdown
    sample = await BizSampleDao.get_by_follow_up(follow_up_id)
    if sample:
        sample_dict = sample.dict() if hasattr(sample, 'dict') else sample.__dict__
        ratios = await BizSampleRatioDao.list_by_sample(sample.id)
        materials = await BizSampleMaterialDao.list_by_sample(sample.id)
        ratios_dicts = [r.dict() if hasattr(r, 'dict') else r.__dict__ for r in ratios]
        mats_dicts = [m.dict() if hasattr(m, 'dict') else m.__dict__ for m in materials]
        md_sample = build_sample_markdown(sample_dict, ratios_dicts, mats_dicts)
        tags_sample = _build_tags(fu_dict, 'sample', '打样单')
        fid = await _save_to_knowledge(
            knowledge_id, f'打样单_{art}.md', md_sample.encode('utf-8'), tags_sample, user_id,
        )
        if fid:
            results['sample'] = fid

    logger.info('Synced three tables to knowledge for follow_up=%d: %s', follow_up_id, results)
    return results
