"""Task deduplication: PO-based duplicate detection + diff-based update.

Before creating a new task, check if a task with the same PO already exists.
If found, detect field-level changes and auto-update rather than creating duplicates.
"""

import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)


DIFF_FIELDS = [
    'customer_name', 'generic_article_no', 'total_amount', 'total_pieces',
    'cargo_delivery_date', 'article_description', 'brand', 'season',
]


def compute_diff(old: dict, new: dict) -> list[dict]:
    """Compare two order dicts, return list of changed fields."""
    changes = []
    for field in DIFF_FIELDS:
        old_val = str(old.get(field) or '').strip()
        new_val = str(new.get(field) or '').strip()
        if old_val != new_val:
            changes.append({
                'field': field,
                'old': old_val,
                'new': new_val,
            })
    return changes


async def find_existing_task_by_po(po: str) -> Optional[dict]:
    """Search for an existing task whose linked sales order has the same PO."""
    if not po:
        return None

    from mep.database.models.task_center import TaskDao
    from mep.database.models.sales_order import SalesOrderDao

    task = await TaskDao.find_by_po(po)
    if not task:
        return None

    header = None
    if task.main_form_id:
        header = await SalesOrderDao.get_header(task.main_form_id)

    return {
        'task': task,
        'header': header,
    }


async def handle_duplicate(
    existing_task,
    existing_header,
    new_order: dict,
    file_name: str,
) -> dict:
    """Handle duplicate PO: compare, update if changed, skip if identical.

    Returns dict with action taken.
    """
    from mep.database.models.task_center import TaskUpdateLogDao, TaskUpdateLog

    if existing_header:
        old_dict = existing_header.dict() if hasattr(existing_header, 'dict') else existing_header.__dict__
    else:
        old_dict = {}

    changes = compute_diff(old_dict, new_order)

    if not changes:
        logger.info('Duplicate PO %s: no changes detected, skipping', new_order.get('po'))
        return {
            'action': 'skipped',
            'reason': 'identical',
            'task_number': existing_task.task_number,
        }

    # Update the existing sales order header
    if existing_header:
        from mep.database.models.sales_order import SalesOrderDao
        update_data = {c['field']: c['new'] for c in changes}
        await SalesOrderDao.update_header(existing_header.id, update_data)

    # Log the changes
    change_summary = '; '.join(f"{c['field']}: {c['old'][:20]}→{c['new'][:20]}" for c in changes)
    await TaskUpdateLogDao.add_log(TaskUpdateLog(
        task_id=existing_task.id,
        log_type='system',
        content=f'数据自动更新 (来源: {file_name}): {change_summary}',
        user_id=None,
        user_name='system',
    ))

    # DingTalk notification about update
    try:
        from mep.database.models.master_data import MasterDataDao
        from mep.user.domain.models.user import UserDao
        from mep.core.dingtalk.dingtalk_message import async_send_dingtalk_message

        if existing_task.assignee_id:
            user = await UserDao.aget_user(existing_task.assignee_id)
            if user and user.user_name:
                await async_send_dingtalk_message(
                    user_list=[user.user_name],
                    link='https://ai.noooyi.com/workspace/task-center',
                    title='订单数据已更新',
                    message_content=(
                        f"任务: {existing_task.task_number}<br/>"
                        f"PO: {new_order.get('po', '')}<br/>"
                        f"变更: {change_summary}"
                    ),
                    message_type='task',
                )
    except Exception:
        logger.exception('Failed to send update notification')

    logger.info('Duplicate PO %s: updated %d fields', new_order.get('po'), len(changes))
    return {
        'action': 'updated',
        'changes': changes,
        'task_number': existing_task.task_number,
    }
