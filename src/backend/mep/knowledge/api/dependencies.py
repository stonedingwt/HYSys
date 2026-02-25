from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from mep.common.dependencies.core_deps import get_db_session
from mep.knowledge.domain.repositories.implementations.knowledge_file_repository_impl import \
    KnowledgeFileRepositoryImpl
from mep.knowledge.domain.repositories.implementations.knowledge_repository_impl import KnowledgeRepositoryImpl
from mep.knowledge.domain.repositories.interfaces.knowledge_file_repository import KnowledgeFileRepository
from mep.knowledge.domain.repositories.interfaces.knowledge_repository import KnowledgeRepository
from mep.knowledge.domain.services.knowledge_file_service import KnowledgeFileService
from mep.knowledge.domain.services.knowledge_service import KnowledgeService


async def get_knowledge_repository(
        session: AsyncSession = Depends(get_db_session),
) -> KnowledgeRepository:
    """DapatkanKnowledgeRepositoryInstance Dependencies"""
    return KnowledgeRepositoryImpl(session)


async def get_knowledge_file_repository(
        session: AsyncSession = Depends(get_db_session),
) -> 'KnowledgeFileRepository':
    """DapatkanKnowledgeFileRepositoryInstance Dependencies"""

    return KnowledgeFileRepositoryImpl(session)


async def get_knowledge_service(
        knowledge_repository: KnowledgeRepository = Depends(get_knowledge_repository),
        knowledge_file_repository: KnowledgeFileRepository = Depends(get_knowledge_file_repository),
) -> 'KnowledgeService':
    """DapatkanKnowledgeServiceInstance Dependencies"""
    return KnowledgeService(knowledge_repository=knowledge_repository,
                            knowledge_file_repository=knowledge_file_repository)


async def get_knowledge_file_service(
        knowledge_repository: KnowledgeRepository = Depends(get_knowledge_repository),
        knowledge_file_repository: KnowledgeFileRepository = Depends(get_knowledge_file_repository),
) -> 'KnowledgeFileService':
    """DapatkanKnowledgeFileServiceInstance Dependencies"""
    return KnowledgeFileService(
        knowledge_repository=knowledge_repository,
        knowledge_file_repository=knowledge_file_repository,
    )
