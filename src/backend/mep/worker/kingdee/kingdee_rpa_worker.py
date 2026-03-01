"""
Celery task for executing Kingdee Cloud RPA automation.
Runs Playwright in headless mode inside the Celery worker process.
"""

import json
import logging
import time
import traceback

from mep.core.logger import trace_id_var
from mep.worker.main import mep_celery

logger = logging.getLogger(__name__)

DEFAULT_KINGDEE_CONFIG = {
    'url': 'http://122.195.141.186:1188/k3cloud',
    'account_set': '赛乐测试账套',
    'username': 'test',
    'password': '123456',
}


def _load_kingdee_config() -> dict:
    """Load Kingdee connection config from database, fallback to defaults."""
    try:
        from mep.core.database.manager import get_sync_db_session
        from sqlmodel import text

        with get_sync_db_session() as session:
            row = session.execute(
                text("SELECT value FROM config WHERE `key` = 'kingdee_config' LIMIT 1")
            ).first()
            if row:
                return json.loads(row[0])
    except Exception:
        logger.warning('Failed to load kingdee_config from DB, using defaults')
    return DEFAULT_KINGDEE_CONFIG


@mep_celery.task(acks_late=True, time_limit=600, soft_time_limit=540)
def kingdee_budget_task(task_id: str, form_data: dict) -> dict:
    """Execute the full Kingdee cost budget RPA flow.

    Args:
        task_id: Unique task identifier for progress tracking.
        form_data: All form fields collected from the frontend.

    Returns:
        Dict with status and message.
    """
    trace_id_var.set(f'kingdee_rpa_{task_id}')
    logger.info('Starting Kingdee RPA task %s', task_id)

    from mep.core.kingdee.progress_callback import RedisProgressCallback
    from mep.core.kingdee.kingdee_rpa import KingdeeRPA

    callback = RedisProgressCallback(task_id)
    rpa = KingdeeRPA(progress_callback=callback)

    try:
        callback.update(2, '初始化浏览器...')
        rpa.start_browser(headless=True)

        config = _load_kingdee_config()
        rpa.execute_full_flow(config, form_data)

        _update_record_status(task_id, 'success')
        return {'status': 'success', 'message': '预算表已提交成功，等待审批'}

    except Exception as e:
        error_msg = f'自动化执行失败: {str(e)}'
        logger.exception('Kingdee RPA task %s failed', task_id)
        screenshot = rpa.take_screenshot('error')
        callback.update(-1, error_msg)
        _update_record_status(task_id, 'failed', error_msg)
        return {'status': 'failed', 'error': error_msg}

    finally:
        rpa.close_browser()


def _update_record_status(task_id: str, status: str, error_msg: str = None):
    """Update the CostBudgetRecord status in DB."""
    try:
        from mep.core.database.manager import get_sync_db_session
        from sqlmodel import text

        with get_sync_db_session() as session:
            if error_msg:
                session.execute(
                    text("UPDATE cost_budget_record SET status = :status, error_message = :err WHERE task_id = :tid"),
                    params={'status': status, 'err': error_msg, 'tid': task_id},
                )
            else:
                session.execute(
                    text("UPDATE cost_budget_record SET status = :status WHERE task_id = :tid"),
                    params={'status': status, 'tid': task_id},
                )
            session.commit()
    except Exception:
        logger.warning('Failed to update record status for task %s', task_id, exc_info=True)
