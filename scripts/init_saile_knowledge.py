#!/usr/bin/env python3
"""
创建知识库「赛乐文档中心」。
在项目根目录执行（需能连接 MEP 后端配置与数据库）：
  export PYTHONPATH="${PYTHONPATH}:$(pwd)/src/backend"
  python scripts/init_saile_knowledge.py
"""
import os
import sys

# 确保可导入 mep
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_BACKEND = os.path.join(ROOT, "src", "backend")
if SRC_BACKEND not in sys.path:
    sys.path.insert(0, SRC_BACKEND)

def main():
    from mep.api.services.knowledge import KnowledgeService
    from mep.knowledge.domain.models.knowledge import KnowledgeCreate, KnowledgeDao, KnowledgeTypeEnum
    from mep.llm.domain.services import LLMService

    try:
        from mep.open_endpoints.domain.utils import get_default_operator
        login_user = get_default_operator()
    except Exception as e:
        print("无法获取默认操作员，请确保已配置 default_operator。错误:", e)
        return 1

    knowledge_llm = LLMService.get_knowledge_llm()
    embedding_model_id = getattr(knowledge_llm, "embedding_model_id", None) or (knowledge_llm or {}).get("embedding_model_id")
    if not embedding_model_id:
        print("未配置知识库默认嵌入模型，请在 系统配置 -> 知识库模型 中配置。")
        return 1

    existing = KnowledgeDao.get_knowledge_by_name("赛乐文档中心", login_user.user_id)
    if existing:
        print(f"知识库「赛乐文档中心」已存在，ID: {existing.id}")
        return 0

    create = KnowledgeCreate(
        name="赛乐文档中心",
        description="赛乐文档中心知识库，用于赛乐助手检索。",
        type=KnowledgeTypeEnum.NORMAL.value,
        model=str(embedding_model_id),
    )
    try:
        from unittest.mock import MagicMock
        request = MagicMock()
        kb = KnowledgeService.create_knowledge(request, login_user, create)
        print(f"已创建知识库「赛乐文档中心」，ID: {kb.id}")
        return 0
    except Exception as e:
        print("创建知识库失败:", e)
        return 1

if __name__ == "__main__":
    sys.exit(main())
