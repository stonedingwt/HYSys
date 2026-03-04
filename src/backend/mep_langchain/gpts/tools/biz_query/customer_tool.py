"""LangChain tool: query customer master data with permission filtering."""

from __future__ import annotations

import logging
from typing import Optional, Type

from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field

from mep_langchain.gpts.tools.biz_query.formatter import auto_format

logger = logging.getLogger(__name__)


class QueryCustomersInput(BaseModel):
    customer_name: Optional[str] = Field(default=None, description='客户名称（模糊匹配）')
    customer_code: Optional[str] = Field(default=None, description='客户编码（模糊匹配）')


class QueryCustomersTool(BaseTool):
    name: str = 'query_customers'
    description: str = (
        '查询客户基本信息，包括编码、名称、标签、负责人等。'
        '自动根据当前用户权限过滤，普通用户只能查看自己负责的客户。'
    )
    args_schema: Type[BaseModel] = QueryCustomersInput

    user_id: int = 0
    user_name: str = ''

    def _run(
        self,
        customer_name: Optional[str] = None,
        customer_code: Optional[str] = None,
    ) -> str:
        from mep.core.biz.permission_context import resolve_permission_context_sync
        from mep.database.models.assistant_query_log import log_query_sync
        from mep.database.models.master_data import Customer
        from mep.core.database import get_sync_db_session
        from sqlmodel import select, col

        perm = resolve_permission_context_sync(self.user_id, self.user_name)

        if not perm.has_full_access and not perm.accessible_customers:
            return '您没有权限查看客户数据。如需访问，请联系管理员分配相应权限。'

        try:
            with get_sync_db_session() as session:
                stmt = select(Customer)

                allowed = perm.customer_filter_list()
                if allowed is not None:
                    stmt = stmt.where(Customer.customer_name.in_(allowed))

                if customer_name:
                    stmt = stmt.where(col(Customer.customer_name).contains(customer_name))
                if customer_code:
                    stmt = stmt.where(col(Customer.customer_code).contains(customer_code))

                stmt = stmt.order_by(col(Customer.customer_name).asc()).limit(100)
                items = session.exec(stmt).all()

            from mep.user.domain.models.user import UserDao
            user_cache: dict[int, str] = {}

            def _user_name_sync(uid: Optional[int]) -> str:
                if not uid:
                    return '-'
                if uid not in user_cache:
                    u = UserDao.get_user_by_id(uid)
                    user_cache[uid] = u.user_name if u else str(uid)
                return user_cache[uid]

            headers = ['编码', '名称', '简称', '标签', '客服负责人', '打样负责人']
            rows = []
            for c in items:
                rows.append([
                    c.customer_code or '-',
                    c.customer_name or '-',
                    c.customer_short_name or '-',
                    c.customer_tags or '-',
                    _user_name_sync(c.customer_service_id),
                    _user_name_sync(c.sample_manager_id),
                ])

            result = auto_format(headers, rows, title='客户信息查询结果', data_type='customer')

            log_query_sync(
                user_id=self.user_id,
                user_name=self.user_name,
                query_text=f'customer_name={customer_name}, code={customer_code}',
                query_type='customer',
                tool_name=self.name,
                query_params={'customer_name': customer_name, 'customer_code': customer_code},
                result_summary=f'返回 {len(rows)} 条客户记录',
                permission_scope=f'full_access={perm.has_full_access}, customers={len(perm.accessible_customers)}',
            )

            return result

        except Exception as e:
            logger.exception('query_customers failed')
            return f'查询客户数据时出错：{e}'
