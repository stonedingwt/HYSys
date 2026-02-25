from loguru import logger

from mep.worker.main import mep_celery


@mep_celery.task
def add(x, y):
    logger.info(f"add {x} + {y}")
    return x + y
