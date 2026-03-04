"""Auto data validation and repair for biz tables.

Checks completeness & format, auto-retries with stronger models on failure.
Sends DingTalk notification when all auto-repair attempts are exhausted.
"""

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

FORMAT_RULES = {
    'po_number': {'pattern': r'^[\w\-/]+$', 'desc': 'PO号格式不正确'},
    'factory_article_no': {'pattern': r'^[\w\-./]+$', 'desc': '厂款号格式不正确'},
    'color': {'pattern': r'.+', 'desc': '颜色不能为空'},
    'size': {'pattern': r'.+', 'desc': '尺码不能为空'},
    'season': {'pattern': r'^(SS|AW|FW|Spring|Summer|Autumn|Winter|春|夏|秋|冬).*$', 'desc': '季节格式不正确', 'optional': True},
}


def validate_follow_up(data: dict) -> list[dict]:
    """Validate follow-up table data, return list of issues."""
    issues = []
    for field_name, rule in FORMAT_RULES.items():
        val = data.get(field_name)
        if not val or not str(val).strip():
            if not rule.get('optional'):
                issues.append({'field': field_name, 'issue': 'missing', 'desc': f'{field_name} 缺失'})
            continue
        if rule.get('pattern') and not re.match(rule['pattern'], str(val), re.I):
            issues.append({'field': field_name, 'issue': 'format', 'desc': rule['desc']})
    return issues


def validate_bom(header: dict, details: list[dict]) -> list[dict]:
    """Validate BOM data."""
    issues = []
    if not header.get('factory_article_no'):
        issues.append({'field': 'factory_article_no', 'issue': 'missing', 'desc': '厂款号缺失'})
    for i, d in enumerate(details):
        if not d.get('material_name'):
            issues.append({'field': f'details[{i}].material_name', 'issue': 'missing', 'desc': f'第{i+1}行物料名称缺失'})
    return issues


def validate_sample(header: dict) -> list[dict]:
    """Validate sample order data."""
    issues = []
    if not header.get('factory_article_no'):
        issues.append({'field': 'factory_article_no', 'issue': 'missing', 'desc': '厂款号缺失'})
    if not header.get('customer_name'):
        issues.append({'field': 'customer_name', 'issue': 'missing', 'desc': '客户名称缺失'})
    return issues


async def auto_repair_field(
    field_name: str,
    ocr_text: str,
    current_value: Optional[str] = None,
    max_retries: int = 2,
) -> Optional[str]:
    """Try to repair a missing/invalid field using stronger LLM models.

    Uses the multi-model engine to escalate through model tiers.
    """
    from mep.core.ai.model_registry import call_llm_with_fallback

    prompt = (
        f"从以下OCR文本中提取 '{field_name}' 字段的值。\n"
        f"只返回提取到的值，不要其他解释。如果无法提取，返回空字符串。\n\n"
        f"OCR文本片段:\n{ocr_text[:3000]}"
    )
    if current_value:
        prompt += f"\n\n当前值 (可能不正确): {current_value}"

    for attempt in range(max_retries):
        result = await call_llm_with_fallback(prompt)
        if result and result.strip() and result.strip() != '""' and result.strip() != "''":
            cleaned = result.strip().strip('"').strip("'")
            if cleaned:
                logger.info('Auto-repaired %s = %s (attempt %d)', field_name, cleaned[:50], attempt + 1)
                return cleaned

    return None


async def validate_and_repair(
    follow_up_id: int,
    ocr_text: str = '',
    notify_on_failure: bool = True,
) -> dict:
    """Full validation + auto-repair cycle for a follow-up record and linked tables.

    Returns: {repaired: [field_names], remaining_issues: [issues]}
    """
    from mep.database.models.biz_tables import BizFollowUpDao, BizBomDao, BizBomDetailDao, BizSampleDao
    from mep.core.biz.auto_extract import check_completeness

    fu = await BizFollowUpDao.get_by_id(follow_up_id)
    if not fu:
        return {'repaired': [], 'remaining_issues': [{'desc': 'follow_up not found'}]}

    fu_dict = fu.dict() if hasattr(fu, 'dict') else fu.__dict__
    issues = validate_follow_up(fu_dict)
    repaired = []

    if issues and ocr_text:
        update_data = {}
        for issue in issues[:5]:
            fname = issue['field']
            new_val = await auto_repair_field(fname, ocr_text, fu_dict.get(fname))
            if new_val:
                update_data[fname] = new_val
                repaired.append(fname)

        if update_data:
            status, pending = check_completeness({**fu_dict, **update_data}, 'follow_up')
            update_data['completeness'] = status
            update_data['pending_fields'] = pending
            await BizFollowUpDao.update(follow_up_id, update_data)

    # Validate BOM
    bom_issues = []
    try:
        bom = await BizBomDao.get_by_follow_up(follow_up_id)
        if bom:
            bom_dict = bom.dict() if hasattr(bom, 'dict') else bom.__dict__
            details = await BizBomDetailDao.list_by_bom(bom.id)
            details_list = [d.dict() if hasattr(d, 'dict') else d.__dict__ for d in details]
            bom_issues = validate_bom(bom_dict, details_list)
    except Exception:
        logger.exception('BOM validation failed')

    # Validate sample
    sample_issues = []
    try:
        sample = await BizSampleDao.get_by_follow_up(follow_up_id)
        if sample:
            sample_dict = sample.dict() if hasattr(sample, 'dict') else sample.__dict__
            sample_issues = validate_sample(sample_dict)
    except Exception:
        logger.exception('Sample validation failed')

    remaining = [i for i in issues if i['field'] not in repaired]
    all_remaining = remaining + bom_issues + sample_issues

    if all_remaining and notify_on_failure:
        await _notify_repair_failure(fu_dict, all_remaining)

    return {'repaired': repaired, 'remaining_issues': all_remaining}


async def _notify_repair_failure(fu_data: dict, issues: list[dict]):
    """Send DingTalk notification when auto-repair exhausts all options."""
    try:
        from mep.database.models.master_data import MasterDataDao
        from mep.user.domain.models.user import UserDao
        from mep.core.dingtalk.dingtalk_message import async_send_dingtalk_message

        customer_name = fu_data.get('customer_name', '')
        article = fu_data.get('factory_article_no', '')
        issue_desc = '; '.join(i['desc'] for i in issues[:5])

        customer = await MasterDataDao.get_customer_by_name(customer_name) if customer_name else None
        if customer and customer.customer_service_id:
            user = await UserDao.aget_user(customer.customer_service_id)
            if user and user.user_name:
                await async_send_dingtalk_message(
                    user_list=[user.user_name],
                    link='https://ai.noooyi.com/workspace/task-center',
                    title='数据自动修复失败',
                    message_content=(
                        f"客户: {customer_name}<br/>"
                        f"款号: {article}<br/>"
                        f"待修复: {issue_desc}<br/>"
                        f"请手动补全数据"
                    ),
                    message_type='task',
                )
    except Exception:
        logger.exception('Failed to send repair failure notification')
