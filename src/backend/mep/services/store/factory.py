from typing import TYPE_CHECKING

from mep.services.factory import ServiceFactory
from mep.services.store.service import StoreService

if TYPE_CHECKING:
    from mep.services.settings.service import SettingsService


class StoreServiceFactory(ServiceFactory):
    def __init__(self):
        super().__init__(StoreService)

    def create(self, settings_service: 'SettingsService'):
        return StoreService(settings_service)
