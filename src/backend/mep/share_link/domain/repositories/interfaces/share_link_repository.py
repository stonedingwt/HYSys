from abc import ABC

from mep.common.repositories.interfaces.base_repository import BaseRepository
from mep.share_link.domain.models.share_link import ShareLink


class ShareLinkRepository(BaseRepository[ShareLink, str], ABC):
    """Shared Link Warehouse Interface"""
    pass
