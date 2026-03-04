"""LangChain tool: query sales orders with built-in permission filtering."""

from __future__ import annotations

import logging
from typing import Optional, Type

from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field
from sqlmodel import select, col, func

from mep_langchain.gpts.tools.biz_query.formatter import auto_format

logger = logging.getLogger(__name__)


class QuerySalesOrdersInput(BaseModel):
    keyword: Optional[str] = Field(default=None, description='通用搜索关键词，同时在PO号、合同参考号、款号、产品描述中模糊匹配。当用户给出一个订单编号/数字但不确定具体是哪个字段时优先使用此参数')
    customer_name: Optional[str] = Field(default=None, description='客户名称（模糊匹配）')
    po: Optional[str] = Field(default=None, description='PO采购订单号（模糊匹配）')
    generic_article_no: Optional[str] = Field(default=None, description='通用款号/Generic article no.（模糊匹配）')
    reference: Optional[str] = Field(default=None, description='合同参考号/Reference（模糊匹配）')
    date_from: Optional[str] = Field(default=None, description='签发日期起始，格式 yyyy-MM-dd')
    date_to: Optional[str] = Field(default=None, description='签发日期截止，格式 yyyy-MM-dd')
    page: int = Field(default=1, description='页码，默认1')
    page_size: int = Field(default=50, description='每页条数，默认50，最大100')


class QuerySalesOrdersTool(BaseTool):
    name: str = 'query_sales_orders'
    description: str = (
        '查询销售订单数据。支持通用关键词搜索（同时匹配PO号、合同参考号、款号、产品描述），'
        '也可按客户名称、PO号、合同参考号、款号、签发日期等条件精确筛选。'
        '当用户提供一个订单号/编号时，建议优先使用keyword参数进行跨字段搜索。'
        '自动根据当前用户权限过滤数据，只返回用户有权限查看的订单。'
    )
    args_schema: Type[BaseModel] = QuerySalesOrdersInput

    user_id: int = 0
    user_name: str = ''

    def _run(
        self,
        keyword: Optional[str] = None,
        customer_name: Optional[str] = None,
        po: Optional[str] = None,
        generic_article_no: Optional[str] = None,
        reference: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> str:
        from mep.core.biz.permission_context import resolve_permission_context_sync
        from mep.database.models.assistant_query_log import log_query_sync
        from mep.database.models.sales_order import SalesOrderHeader
        from mep.core.database import get_sync_db_session

        page_size = min(page_size, 100)

        perm = resolve_permission_context_sync(self.user_id, self.user_name)

        if not perm.has_full_access and not perm.accessible_customers:
            return '您没有权限查看任何客户的销售订单数据。如需访问，请联系管理员分配相应权限。'

        if customer_name and not perm.has_full_access:
            matched = [c for c in perm.accessible_customers if customer_name.lower() in c.lower()]
            if not matched:
                return f'您没有权限查看客户"{customer_name}"的销售订单。您可查看的客户：{", ".join(perm.accessible_customers)}'

        try:
            with get_sync_db_session() as session:
                stmt = select(SalesOrderHeader)
                count_stmt = select(func.count()).select_from(SalesOrderHeader)

                allowed = perm.customer_filter_list()
                if allowed is not None:
                    stmt = stmt.where(SalesOrderHeader.customer_name.in_(allowed))
                    count_stmt = count_stmt.where(SalesOrderHeader.customer_name.in_(allowed))

                if keyword:
                    from sqlalchemy import or_
                    kw_filter = or_(
                        col(SalesOrderHeader.po).contains(keyword),
                        col(SalesOrderHeader.reference).contains(keyword),
                        col(SalesOrderHeader.generic_article_no).contains(keyword),
                        col(SalesOrderHeader.article_description).contains(keyword),
                    )
                    stmt = stmt.where(kw_filter)
                    count_stmt = count_stmt.where(kw_filter)

                if customer_name:
                    stmt = stmt.where(col(SalesOrderHeader.customer_name).contains(customer_name))
                    count_stmt = count_stmt.where(col(SalesOrderHeader.customer_name).contains(customer_name))
                if po:
                    stmt = stmt.where(col(SalesOrderHeader.po).contains(po))
                    count_stmt = count_stmt.where(col(SalesOrderHeader.po).contains(po))
                if generic_article_no:
                    stmt = stmt.where(col(SalesOrderHeader.generic_article_no).contains(generic_article_no))
                    count_stmt = count_stmt.where(col(SalesOrderHeader.generic_article_no).contains(generic_article_no))
                if reference:
                    stmt = stmt.where(col(SalesOrderHeader.reference).contains(reference))
                    count_stmt = count_stmt.where(col(SalesOrderHeader.reference).contains(reference))
                if date_from:
                    stmt = stmt.where(SalesOrderHeader.date_of_issue >= date_from)
                    count_stmt = count_stmt.where(SalesOrderHeader.date_of_issue >= date_from)
                if date_to:
                    stmt = stmt.where(SalesOrderHeader.date_of_issue <= date_to)
                    count_stmt = count_stmt.where(SalesOrderHeader.date_of_issue <= date_to)

                total = session.exec(count_stmt).one()

                stmt = stmt.order_by(col(SalesOrderHeader.id).desc())
                stmt = stmt.offset((page - 1) * page_size).limit(page_size)
                items = session.exec(stmt).all()

            headers = ['ID', '客户', 'PO', '参考号', '款号', '总金额', '币种', '总件数', '签发日期', '交货日期']
            rows = []
            for h in items:
                amt = h.total_amount or '-'
                try:
                    amt = f'{float(amt):,.2f}' if amt != '-' else '-'
                except (ValueError, TypeError):
                    pass
                doi = h.date_of_issue.strftime('%Y-%m-%d') if h.date_of_issue else '-'
                cdd = h.cargo_delivery_date.strftime('%Y-%m-%d') if h.cargo_delivery_date else '-'
                rows.append([
                    h.id, h.customer_name or '-', h.po or '-',
                    h.reference or '-',
                    h.generic_article_no or '-',
                    amt,
                    h.currency or '-',
                    h.total_pieces or '-',
                    doi,
                    cdd,
                ])

            result = auto_format(
                headers, rows,
                title='销售订单查询结果',
                data_type='sales_order',
                summary_prefix=f'共找到 {total} 条销售订单（当前第 {page} 页，显示 {len(rows)} 条）。' if total > 0 else '',
            )

            log_query_sync(
                user_id=self.user_id,
                user_name=self.user_name,
                query_text=f'keyword={keyword}, customer={customer_name}, po={po}, ref={reference}, article={generic_article_no}',
                query_type='sales_order',
                tool_name=self.name,
                query_params={
                    'keyword': keyword, 'customer_name': customer_name, 'po': po,
                    'reference': reference, 'generic_article_no': generic_article_no,
                    'date_from': date_from, 'date_to': date_to,
                    'page': page, 'page_size': page_size,
                },
                result_summary=f'返回 {len(rows)}/{total} 条销售订单',
                permission_scope=f'full_access={perm.has_full_access}, customers={len(perm.accessible_customers)}',
            )

            return result

        except Exception as e:
            logger.exception('query_sales_orders failed')
            return f'查询销售订单时出错：{e}'
