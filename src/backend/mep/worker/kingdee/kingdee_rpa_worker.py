"""
Celery task for executing Kingdee Cloud RPA automation.
Runs Playwright in headless mode inside the Celery worker process.
"""

import json
import logging
import time
import traceback
import uuid

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


def _load_llm_config_sync() -> dict:
    """Load LLM config from DB synchronously (no async needed)."""
    try:
        from mep.core.database.manager import get_sync_db_session
        from sqlmodel import text as sql_text

        with get_sync_db_session() as session:
            cfg_row = session.execute(
                sql_text("SELECT value FROM config WHERE `key` = 'workflow_llm' LIMIT 1")
            ).first()
            if not cfg_row:
                return {}
            model_id = json.loads(cfg_row[0]).get('model_id')
            if not model_id:
                return {}

            model_row = session.execute(
                sql_text("SELECT model_name, server_id FROM llm_model WHERE id = :mid"),
                params={'mid': model_id},
            ).first()
            if not model_row:
                return {}
            model_name, server_id = model_row

            server_row = session.execute(
                sql_text("SELECT type, config FROM llm_server WHERE id = :sid"),
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
            return {'api_base': api_base.rstrip('/'), 'api_key': api_key, 'model': model_name}
    except Exception:
        logger.warning('Failed to load LLM config', exc_info=True)
        return {}


def _analyze_sync_error_with_llm(record_id: int, factory_no: str, error_msg: str, form_data: dict) -> str:
    """Use LLM to analyze Kingdee sync error and suggest fixes via sync HTTP call."""
    import requests

    try:
        config = _load_llm_config_sync()
        if not config or not config.get('api_key'):
            logger.warning('No LLM config available for error analysis')
            return ''

        material_info = json.dumps(form_data.get('material_costs', []), ensure_ascii=False)
        accessory_info = json.dumps(form_data.get('accessory_costs', []), ensure_ascii=False)

        prompt = f"""你是金蝶ERP系统专家。以下是一条报价同步到金蝶失败的错误信息，请分析原因并给出具体的修复建议。

## 失败记录
- 记录ID: {record_id}
- 厂款号: {factory_no}
- BOM版本: {form_data.get('bom_version', '未知')}
- 客户: {form_data.get('customer', '未知')}

## 面料数据
{material_info}

## 辅料数据
{accessory_info}

## 错误信息
{error_msg}

## 请分析:
1. 错误的根本原因是什么？
2. 哪些字段缺失？为什么会缺失？
3. 具体的修复步骤是什么？（区分数据问题和系统问题）
4. 是否需要在金蝶端配置BOM数据？

请用JSON格式返回：
{{"root_cause": "...", "missing_fields": [...], "fix_steps": [...], "needs_kingdee_bom_config": true/false, "auto_fixable": true/false}}"""

        api_base = config['api_base']
        api_url = f"{api_base}/chat/completions"

        resp = requests.post(
            api_url,
            headers={'Authorization': f"Bearer {config['api_key']}", 'Content-Type': 'application/json'},
            json={
                'model': config.get('model', 'qwen-plus'),
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 2048,
            },
            timeout=60,
        )
        if resp.status_code == 200:
            data = resp.json()
            analysis = data.get('choices', [{}])[0].get('message', {}).get('content', '')
            if analysis:
                logger.info('LLM analysis for record %d: %s', record_id, analysis[:500])
                return analysis
        else:
            logger.warning('LLM API returned %d for record %d: %s', resp.status_code, record_id, resp.text[:200])
    except Exception as e:
        logger.warning('LLM error analysis failed for record %d: %s', record_id, e)
    return ''


def _save_error_analysis(record_id: int, analysis: str):
    """Save LLM error analysis to the record."""
    try:
        from mep.core.database.manager import get_sync_db_session
        from sqlmodel import text as sql_text

        with get_sync_db_session() as session:
            current = session.execute(
                sql_text("SELECT error_message FROM cost_budget_record WHERE id = :rid"),
                params={'rid': record_id},
            ).first()
            if current and current[0]:
                new_msg = current[0] + '\n\n--- AI分析 ---\n' + analysis
                session.execute(
                    sql_text("UPDATE cost_budget_record SET error_message = :msg WHERE id = :rid"),
                    params={'msg': new_msg[:5000], 'rid': record_id},
                )
                session.commit()
    except Exception:
        logger.warning('Failed to save error analysis for record %d', record_id, exc_info=True)


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


def _update_record_status_by_id(record_id: int, status: str, task_id: str = None, error_msg: str = None):
    """Update CostBudgetRecord by primary key."""
    try:
        from mep.core.database.manager import get_sync_db_session
        from sqlmodel import text

        with get_sync_db_session() as session:
            parts = ["status = :status"]
            params = {'status': status, 'rid': record_id}
            if task_id:
                parts.append("task_id = :tid")
                params['tid'] = task_id
            if error_msg:
                parts.append("error_message = :err")
                params['err'] = error_msg
            sql = f"UPDATE cost_budget_record SET {', '.join(parts)} WHERE id = :rid"
            session.execute(text(sql), params=params)
            session.commit()
    except Exception:
        logger.warning('Failed to update record %s', record_id, exc_info=True)


def _update_scheduled_task_log(scheduled_task_id, scheduled_log_id, status, result_msg=None, error_msg=None):
    """Update scheduled_task and scheduled_task_log after system task finishes."""
    try:
        from datetime import datetime as dt
        from mep.database.models.scheduled_task import ScheduledTaskDao, ScheduledTaskLogDao
        if scheduled_log_id:
            update_kw = {'status': status, 'end_time': dt.now()}
            if result_msg:
                update_kw['result'] = result_msg
            if error_msg:
                update_kw['error_message'] = error_msg
            ScheduledTaskLogDao.update_log(scheduled_log_id, **update_kw)
        if scheduled_task_id:
            ScheduledTaskDao.update_last_run(scheduled_task_id, status, dt.now())
    except Exception:
        logger.warning('Failed to update scheduled task log', exc_info=True)


@mep_celery.task(acks_late=True, time_limit=1800, soft_time_limit=1700)
def sync_final_quotes_to_kingdee(scheduled_task_id=None, scheduled_log_id=None) -> dict:
    """Scheduled task: find all pending final quotes and sync them to Kingdee one by one."""
    trace_id_var.set('kingdee_scheduled_sync')
    logger.info('Starting scheduled sync of final quotes to Kingdee')

    from mep.database.models.cost_budget import CostBudgetDao
    records = CostBudgetDao.get_pending_final_quotes_sync()

    if not records:
        logger.info('No pending final quotes to sync')
        _update_scheduled_task_log(scheduled_task_id, scheduled_log_id, 'success',
                                   result_msg='无待同步记录')
        return {'synced': 0, 'message': 'No pending records'}

    logger.info('Found %d pending final quote(s) to sync', len(records))
    success_count = 0
    fail_count = 0

    for record in records:
        task_id = str(uuid.uuid4()).replace('-', '')[:16]
        _update_record_status_by_id(record.id, 'running', task_id=task_id)

        try:
            from mep.core.kingdee.progress_callback import RedisProgressCallback
            from mep.core.kingdee.kingdee_rpa import KingdeeRPA

            callback = RedisProgressCallback(task_id)
            rpa = KingdeeRPA(progress_callback=callback)

            callback.update(2, '初始化浏览器...')
            rpa.start_browser(headless=True)

            config = _load_kingdee_config()
            form_data = {
                'factory_article_no': record.factory_article_no,
                'order_type': record.order_type,
                'currency': record.currency,
                'pricing_date': record.pricing_date,
                'bom_version': record.bom_version,
                'quote_date': record.quote_date,
                'quote_quantity': record.quote_quantity,
                'quote_size': record.quote_size,
                'customer': record.customer,
                'season': record.season,
                'quote_type': record.quote_type,
                'production_location': record.production_location,
                'brand': record.brand,
                'product_family': record.product_family,
                'material_costs': json.loads(record.material_costs) if record.material_costs else [],
                'accessory_costs': json.loads(record.accessory_costs) if record.accessory_costs else [],
                'packaging_costs': json.loads(record.packaging_costs) if record.packaging_costs else [],
                'secondary_costs': json.loads(record.secondary_costs) if record.secondary_costs else [],
                'other_costs': json.loads(record.other_costs) if record.other_costs else [],
                'sewing_gst': record.sewing_gst,
                'hour_conversion': record.hour_conversion,
                'cutting_price': record.cutting_price,
                'capital_rate': record.capital_rate,
                'profit_rate': record.profit_rate,
                'final_price_rmb': record.final_price_rmb,
            }

            rpa.execute_full_flow(config, form_data)
            _update_record_status_by_id(record.id, 'success', task_id=task_id)
            success_count += 1
            logger.info('Synced record %d to Kingdee successfully', record.id)

        except Exception as e:
            error_msg = f'自动化执行失败: {str(e)}'
            logger.exception('Failed to sync record %d to Kingdee', record.id)
            _update_record_status_by_id(record.id, 'failed', task_id=task_id, error_msg=error_msg)
            fail_count += 1

            try:
                analysis = _analyze_sync_error_with_llm(
                    record.id,
                    record.factory_article_no,
                    error_msg,
                    form_data,
                )
                if analysis:
                    _save_error_analysis(record.id, analysis)
            except Exception as ae:
                logger.warning('Error analysis failed for record %d: %s', record.id, ae)

        finally:
            try:
                rpa.close_browser()
            except Exception:
                pass

    result = {'synced': success_count, 'failed': fail_count, 'total': len(records)}
    logger.info('Scheduled sync complete: %s', result)

    if fail_count > 0:
        _update_scheduled_task_log(
            scheduled_task_id, scheduled_log_id, 'failed',
            error_msg=f'同步完成: 成功{success_count}条, 失败{fail_count}条')
    else:
        _update_scheduled_task_log(
            scheduled_task_id, scheduled_log_id, 'success',
            result_msg=f'同步完成: 成功{success_count}条, 共{len(records)}条')

    return result
