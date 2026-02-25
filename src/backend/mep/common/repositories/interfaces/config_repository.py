from abc import ABC

from mep.common.models.config import Config
from mep.common.repositories.interfaces.base_repository import BaseRepository


class ConfigRepository(BaseRepository[Config, str], ABC):
    """Configure warehouse interfaces"""
    pass
