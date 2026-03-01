from mep.services import ServiceType, service_manager

from mep.services.session.service import SessionService
from mep.services.task.service import TaskService


def get_session_service() -> SessionService:
    return service_manager.get(ServiceType.SESSION_SERVICE)  # type: ignore


def get_task_service() -> TaskService:
    return service_manager.get(ServiceType.TASK_SERVICE)  # type: ignore
