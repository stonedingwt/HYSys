"""Parsing rules and prompt version management.

Stores customer-specific parsing rules and versioned prompts,
allowing human maintenance when customer formats change.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, Integer, String, Text, JSON, Boolean, text
from sqlmodel import Field, select, col, func

from mep.common.models.base import SQLModelSerializable
from mep.core.database import get_async_db_session


class ParseRule(SQLModelSerializable, table=True):
    """Customer-specific parsing rules for OCR/LLM extraction."""
    __tablename__ = 'parse_rule'
    __table_args__ = {'comment': '解析规则 - 客户级别的解析配置'}

    id: Optional[int] = Field(default=None, primary_key=True)
    customer_name: str = Field(sa_column=Column(
        String(200), index=True, nullable=False, comment='客户名称'))
    rule_name: str = Field(sa_column=Column(
        String(200), nullable=False, comment='规则名称'))
    file_type: str = Field(default='pdf', sa_column=Column(
        String(50), nullable=False, server_default=text("'pdf'"), comment='文件类型 (pdf/tp/excel)'))
    ocr_model: Optional[str] = Field(default='paddleocr', sa_column=Column(
        String(100), nullable=True, comment='优先使用的OCR模型'))
    llm_model: Optional[str] = Field(default='qwen-max', sa_column=Column(
        String(100), nullable=True, comment='优先使用的LLM模型'))
    pre_process: Optional[dict] = Field(default=None, sa_column=Column(
        JSON, nullable=True, comment='预处理配置 (旋转/裁切等)'))
    field_mapping: Optional[dict] = Field(default=None, sa_column=Column(
        JSON, nullable=True, comment='字段映射配置 {源字段: 目标字段}'))
    regex_rules: Optional[dict] = Field(default=None, sa_column=Column(
        JSON, nullable=True, comment='正则提取规则 {字段名: 正则表达式}'))
    is_active: bool = Field(default=True, sa_column=Column(
        Boolean, nullable=False, server_default=text('1'), comment='是否启用'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), comment='更新时间'))


class PromptVersion(SQLModelSerializable, table=True):
    """Versioned prompt templates for LLM structuring."""
    __tablename__ = 'prompt_version'
    __table_args__ = {'comment': 'Prompt版本管理 - LLM提示词版本化存储'}

    id: Optional[int] = Field(default=None, primary_key=True)
    prompt_name: str = Field(sa_column=Column(
        String(200), index=True, nullable=False, comment='提示词名称'))
    version: str = Field(sa_column=Column(
        String(50), nullable=False, comment='版本号'))
    content: str = Field(sa_column=Column(
        Text, nullable=False, comment='提示词内容'))
    model_name: Optional[str] = Field(default=None, sa_column=Column(
        String(100), nullable=True, comment='关联模型名称'))
    is_active: bool = Field(default=True, sa_column=Column(
        Boolean, nullable=False, server_default=text('1'), comment='是否为当前活跃版本'))
    performance_score: Optional[float] = Field(default=None, sa_column=Column(
        String(20), nullable=True, comment='质量评分 0-1'))
    usage_count: int = Field(default=0, sa_column=Column(
        Integer, nullable=False, server_default=text('0'), comment='使用次数'))
    success_count: int = Field(default=0, sa_column=Column(
        Integer, nullable=False, server_default=text('0'), comment='成功次数'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), comment='更新时间'))


class ParseRuleDao:

    @classmethod
    async def get_rule_for_customer(cls, customer_name: str, file_type: str = 'pdf') -> Optional[ParseRule]:
        if not customer_name:
            return None
        async with get_async_db_session() as session:
            return (await session.exec(
                select(ParseRule).where(
                    ParseRule.customer_name == customer_name,
                    ParseRule.file_type == file_type,
                    ParseRule.is_active == True,
                ).order_by(col(ParseRule.id).desc())
            )).first()

    @classmethod
    async def list_rules(cls, page: int = 1, page_size: int = 20, keyword: str = ''):
        async with get_async_db_session() as session:
            stmt = select(ParseRule)
            count_stmt = select(func.count()).select_from(ParseRule)
            if keyword:
                stmt = stmt.where(col(ParseRule.customer_name).contains(keyword))
                count_stmt = count_stmt.where(col(ParseRule.customer_name).contains(keyword))
            total = (await session.exec(count_stmt)).one()
            stmt = stmt.order_by(col(ParseRule.id).desc()).offset((page - 1) * page_size).limit(page_size)
            items = (await session.exec(stmt)).all()
            return items, total

    @classmethod
    async def create_rule(cls, data: dict) -> ParseRule:
        async with get_async_db_session() as session:
            rule = ParseRule(**data)
            session.add(rule)
            await session.commit()
            await session.refresh(rule)
            return rule

    @classmethod
    async def update_rule(cls, rule_id: int, data: dict) -> Optional[ParseRule]:
        async with get_async_db_session() as session:
            item = (await session.exec(select(ParseRule).where(ParseRule.id == rule_id))).first()
            if not item:
                return None
            for k, v in data.items():
                if k not in ('id', 'create_time', 'update_time') and hasattr(item, k):
                    setattr(item, k, v)
            session.add(item)
            await session.commit()
            await session.refresh(item)
            return item

    @classmethod
    async def delete_rule(cls, rule_id: int) -> bool:
        async with get_async_db_session() as session:
            from sqlmodel import delete
            result = await session.exec(delete(ParseRule).where(ParseRule.id == rule_id))
            await session.commit()
            return True


class PromptVersionDao:

    @classmethod
    async def get_active_prompt(cls, prompt_name: str) -> Optional[PromptVersion]:
        async with get_async_db_session() as session:
            return (await session.exec(
                select(PromptVersion).where(
                    PromptVersion.prompt_name == prompt_name,
                    PromptVersion.is_active == True,
                ).order_by(col(PromptVersion.id).desc())
            )).first()

    @classmethod
    async def list_versions(cls, prompt_name: str = '', page: int = 1, page_size: int = 20):
        async with get_async_db_session() as session:
            stmt = select(PromptVersion)
            count_stmt = select(func.count()).select_from(PromptVersion)
            if prompt_name:
                stmt = stmt.where(PromptVersion.prompt_name == prompt_name)
                count_stmt = count_stmt.where(PromptVersion.prompt_name == prompt_name)
            total = (await session.exec(count_stmt)).one()
            stmt = stmt.order_by(col(PromptVersion.id).desc()).offset((page - 1) * page_size).limit(page_size)
            items = (await session.exec(stmt)).all()
            return items, total

    @classmethod
    async def create_version(cls, data: dict) -> PromptVersion:
        async with get_async_db_session() as session:
            pv = PromptVersion(**data)
            session.add(pv)
            await session.commit()
            await session.refresh(pv)
            return pv

    @classmethod
    async def update_version(cls, version_id: int, data: dict) -> Optional[PromptVersion]:
        async with get_async_db_session() as session:
            item = (await session.exec(select(PromptVersion).where(PromptVersion.id == version_id))).first()
            if not item:
                return None
            for k, v in data.items():
                if k not in ('id', 'create_time', 'update_time') and hasattr(item, k):
                    setattr(item, k, v)
            session.add(item)
            await session.commit()
            await session.refresh(item)
            return item

    @classmethod
    async def record_usage(cls, version_id: int, success: bool):
        async with get_async_db_session() as session:
            item = (await session.exec(select(PromptVersion).where(PromptVersion.id == version_id))).first()
            if item:
                item.usage_count += 1
                if success:
                    item.success_count += 1
                session.add(item)
                await session.commit()
