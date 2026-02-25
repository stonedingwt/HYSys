from typing import TYPE_CHECKING

from mep.services.credentials.service import CredentialService
from mep.services.factory import ServiceFactory

if TYPE_CHECKING:
    from mep.services.settings.service import SettingsService


class CredentialServiceFactory(ServiceFactory):
    def __init__(self):
        super().__init__(CredentialService)

    def create(self, settings_service: 'SettingsService'):
        return CredentialService(settings_service)
