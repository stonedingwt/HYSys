from pathlib import Path

from mep.services.factory import ServiceFactory
from mep.services.settings.service import SettingsService


class SettingsServiceFactory(ServiceFactory):
    def __init__(self):
        super().__init__(SettingsService)

    def create(self):
        # Here you would have logic to create and configure a SettingsService
        mep_dir = Path(__file__).parent.parent.parent
        return SettingsService.load_settings_from_yaml(str(mep_dir / 'config.yaml'))
