"""
Scheduled Task Scheduler
定时任务调度服务 - 以celery beat定时检查任务并触发执行
"""
from datetime import datetime

from loguru import logger


def _parse_cron(expression: str):
    """Parse a cron expression and check if current minute matches.
    Format: minute hour day_of_month month day_of_week
    Supports: * (any), */N (every N), N (exact), N,M (list), N-M (range)
    """
    now = datetime.now()
    parts = expression.strip().split()
    if len(parts) != 5:
        return False

    fields = [now.minute, now.hour, now.day, now.month, now.isoweekday() % 7]
    maxvals = [59, 23, 31, 12, 6]

    for i, (part, current, maxval) in enumerate(zip(parts, fields, maxvals)):
        if not _matches_field(part, current, maxval):
            return False
    return True


def _matches_field(pattern: str, value: int, max_val: int) -> bool:
    """Check if a cron field pattern matches a value"""
    for token in pattern.split(','):
        token = token.strip()
        if token == '*':
            return True
        if '/' in token:
            base, step = token.split('/', 1)
            step = int(step)
            if base == '*':
                if value % step == 0:
                    return True
            else:
                base_val = int(base)
                if value >= base_val and (value - base_val) % step == 0:
                    return True
        elif '-' in token:
            low, high = token.split('-', 1)
            if int(low) <= value <= int(high):
                return True
        else:
            if int(token) == value:
                return True
    return False


def check_and_dispatch_tasks():
    """Check all enabled tasks and dispatch those that are due"""
    try:
        from mep.database.models.scheduled_task import ScheduledTaskDao
        from mep.worker.scheduled_task.tasks import run_scheduled_task

        tasks = ScheduledTaskDao.get_enabled_tasks()
        now = datetime.now()

        for task in tasks:
            try:
                if not task.cron_expression:
                    continue
                if not _parse_cron(task.cron_expression):
                    continue
                # Avoid double-triggering within the same minute
                if task.last_run_time and (now - task.last_run_time).total_seconds() < 55:
                    continue
                logger.info(f"Dispatching scheduled task {task.id}: {task.name}")
                run_scheduled_task.delay(task.id)
            except Exception as e:
                logger.error(f"Error checking task {task.id}: {e}")

    except Exception as e:
        logger.error(f"Error in check_and_dispatch_tasks: {e}")
