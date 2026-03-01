"""
Redis-based progress callback for long-running Kingdee RPA tasks.
Stores progress percentage, message and optional screenshot bytes.
"""

import json
import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)

REDIS_KEY_PREFIX = 'kingdee_rpa'
EXPIRATION = 3600 * 24


class RedisProgressCallback:

    def __init__(self, task_id: str):
        self.task_id = task_id
        self._redis = None
        self._key = f'{REDIS_KEY_PREFIX}:{task_id}:status'
        self._screenshot_key = f'{REDIS_KEY_PREFIX}:{task_id}:screenshot'

    def _get_redis(self):
        if self._redis is None:
            from mep.core.cache.redis_manager import get_redis_client_sync
            self._redis = get_redis_client_sync()
        return self._redis

    def update(self, progress: int, message: str, screenshot: Optional[bytes] = None):
        """Update task progress in Redis.

        Args:
            progress: 0-100 for progress, -1 for failure.
            message: Human-readable status message.
            screenshot: Optional PNG screenshot bytes.
        """
        try:
            redis = self._get_redis()
            data = {
                'progress': progress,
                'message': message,
                'timestamp': time.time(),
                'task_id': self.task_id,
            }
            redis.set(self._key, data, expiration=EXPIRATION)

            if screenshot:
                redis.set(self._screenshot_key, screenshot, expiration=EXPIRATION)

        except Exception:
            logger.warning('Failed to update progress in Redis', exc_info=True)

    def get_status(self) -> Optional[dict]:
        try:
            redis = self._get_redis()
            return redis.get(self._key)
        except Exception:
            return None

    def get_screenshot(self) -> Optional[bytes]:
        try:
            redis = self._get_redis()
            return redis.get(self._screenshot_key)
        except Exception:
            return None

    def __call__(self, progress: int, message: str, screenshot: Optional[bytes] = None):
        self.update(progress, message, screenshot)
