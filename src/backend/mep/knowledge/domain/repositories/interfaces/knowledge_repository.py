from abc import ABC

from mep.common.repositories.interfaces.base_repository import BaseRepository
from mep.knowledge.domain.models.knowledge import Knowledge


class KnowledgeRepository(BaseRepository[Knowledge, int], ABC):
    """Knowledge Base Repository Interface"""
    pass
