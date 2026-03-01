from mep.services.manager import service_manager
from loguru import logger


def get_factories_and_deps():
    from mep.services.session import factory as session_service_factory  # type: ignore
    from mep.services.task import factory as task_factory

    return [
        (task_factory.TaskServiceFactory(), []),
        (session_service_factory.SessionServiceFactory(), []),
    ]


def teardown_services():
    """Teardown all the services."""
    try:
        service_manager.teardown()
    except Exception as exc:
        logger.exception(exc)


def initialize_session_service():
    """Initialize the session manager."""
    from mep.services.session import factory as session_service_factory  # type: ignore

    service_manager.register_factory(session_service_factory.SessionServiceFactory(), [])


def initialize_services(fix_migration: bool = False):
    """Initialize all the services needed."""
    for factory, dependencies in get_factories_and_deps():
        try:
            service_manager.register_factory(factory, dependencies=dependencies)
        except Exception as exc:
            logger.exception(exc)
            raise RuntimeError(
                'Could not initialize services. Please check your settings.') from exc
