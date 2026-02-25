from mep.services.factory import ServiceFactory
from mep.services.session.service import SessionService

# if TYPE_CHECKING:
#     from mep.services.cache.service import BaseCacheService


class SessionServiceFactory(ServiceFactory):

    def __init__(self):
        super().__init__(SessionService)

    def create(self):
        return SessionService()
