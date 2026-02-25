from typing import Optional

from mep.knowledge.domain.models.knowledge_file import KnowledgeFileBase
from pydantic import Field


class KnowledgeFileResp(KnowledgeFileBase):
    id: Optional[int] = Field(default=None)
    title: Optional[str] = Field(default=None, description="Document Summary")
