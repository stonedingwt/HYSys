"""LangChain tool: query master data (suppliers, production lines, etc.)."""

from __future__ import annotations

import logging
from typing import Optional, Type

from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field

from mep_langchain.gpts.tools.biz_query.formatter import auto_format

logger = logging.getLogger(__name__)

ENTITY_CHOICES = {
    'supplier': '供应商',
    'production_line': '产线',
    'plan_manager': '计划主管',
    'warehouse_manager': '仓库主管',
    'quality_manager': '质量主管',
}


class QueryMasterDataInput(BaseModel):
    entity: str = Field(
        description=(
            '要查询的主数据类型，可选值：'
            'supplier（供应商）、production_line（产线）、'
            'plan_manager（计划主管）、warehouse_manager（仓库主管）、'
            'quality_manager（质量主管）'
        ),
    )
    keyword: Optional[str] = Field(default=None, description='搜索关键字（模糊匹配名称、编码等字段）')


class QueryMasterDataTool(BaseTool):
    name: str = 'query_master_data'
    description: str = (
        '查询公司主数据信息，包括供应商、产线、计划主管、仓库主管、质量主管等。'
        '用户可指定数据类型和搜索关键词进行查询。'
    )
    args_schema: Type[BaseModel] = QueryMasterDataInput

    user_id: int = 0
    user_name: str = ''

    def _run(self, entity: str, keyword: Optional[str] = None) -> str:
        from mep.core.biz.permission_context import resolve_permission_context_sync
        from mep.database.models.assistant_query_log import log_query_sync
        from mep.database.models.master_data import (
            Supplier, ProductionLine, PlanManager, WarehouseManager, QualityManager,
        )
        from mep.core.database import get_sync_db_session
        from sqlmodel import select, col
        from sqlalchemy import or_

        if entity not in ENTITY_CHOICES:
            return f'不支持的数据类型：{entity}。可选类型：{", ".join(f"{k}({v})" for k, v in ENTITY_CHOICES.items())}'

        perm = resolve_permission_context_sync(self.user_id, self.user_name)

        model_map = {
            'supplier': Supplier,
            'production_line': ProductionLine,
            'plan_manager': PlanManager,
            'warehouse_manager': WarehouseManager,
            'quality_manager': QualityManager,
        }
        search_fields_map = {
            'supplier': ['supplier_code', 'supplier_name', 'contact_name', 'address'],
            'production_line': ['line_name', 'factory', 'product_family_tags'],
            'plan_manager': ['factory'],
            'warehouse_manager': ['warehouse_name', 'factory'],
            'quality_manager': ['tags'],
        }

        model = model_map[entity]
        entity_label = ENTITY_CHOICES[entity]

        try:
            with get_sync_db_session() as session:
                stmt = select(model)

                if keyword:
                    search_fields = search_fields_map.get(entity, [])
                    conditions = [col(getattr(model, f)).contains(keyword) for f in search_fields if hasattr(model, f)]
                    if conditions:
                        stmt = stmt.where(or_(*conditions))

                if entity == 'supplier' and not perm.has_full_access:
                    stmt = stmt.where(
                        or_(
                            Supplier.bound_user_id == perm.user_id,
                            Supplier.bound_user_id.is_(None),
                        )
                    )

                stmt = stmt.order_by(col(model.id).desc()).limit(100)
                items = session.exec(stmt).all()

            headers_map = {
                'supplier': ['编码', '名称', '类型', '联系人', '电话', '地址'],
                'production_line': ['产线名称', '工厂', '产品族标签', '优先级'],
                'plan_manager': ['用户ID', '工厂'],
                'warehouse_manager': ['用户ID', '仓库名称', '工厂'],
                'quality_manager': ['用户ID', '负责标签'],
            }
            headers = headers_map[entity]

            rows = []
            for item in items:
                if entity == 'supplier':
                    rows.append([item.supplier_code, item.supplier_name, item.supplier_type or '-',
                                 item.contact_name or '-', item.phone or '-', item.address or '-'])
                elif entity == 'production_line':
                    rows.append([item.line_name, item.factory or '-',
                                 item.product_family_tags or '-', item.priority_order or '-'])
                elif entity == 'plan_manager':
                    rows.append([item.user_id, item.factory or '-'])
                elif entity == 'warehouse_manager':
                    rows.append([item.user_id, item.warehouse_name or '-', item.factory or '-'])
                elif entity == 'quality_manager':
                    rows.append([item.user_id, item.tags or '-'])

            result = auto_format(headers, rows, title=f'{entity_label}查询结果', data_type=entity)

            log_query_sync(
                user_id=self.user_id,
                user_name=self.user_name,
                query_text=f'entity={entity}, keyword={keyword}',
                query_type='master_data',
                tool_name=self.name,
                query_params={'entity': entity, 'keyword': keyword},
                result_summary=f'返回 {len(rows)} 条{entity_label}记录',
                permission_scope=f'full_access={perm.has_full_access}',
            )

            return result

        except Exception as e:
            logger.exception('query_master_data failed')
            return f'查询{entity_label}数据时出错：{e}'
