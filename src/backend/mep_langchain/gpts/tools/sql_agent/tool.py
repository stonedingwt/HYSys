import logging
import re
from typing import List, Type, Optional

from langchain_community.agent_toolkits import SQLDatabaseToolkit
from langchain_community.utilities import SQLDatabase
from langchain_core.callbacks import CallbackManagerForToolRun
from langchain_core.language_models import BaseLanguageModel
from langchain_core.messages import HumanMessage
from langchain_core.tools import BaseTool
from langgraph.graph.graph import CompiledGraph
from langgraph.prebuilt import create_react_agent
from pydantic import BaseModel, Field, ConfigDict

logger = logging.getLogger(__name__)

ALLOWED_TABLES: list[str] = [
    'sales_order',
    'sales_order_detail',
    'master_customer',
    'master_supplier',
    'master_production_line',
    'master_plan_manager',
    'master_warehouse_manager',
    'master_quality_manager',
    'cost_budget_record',
]

_FORBIDDEN_SQL_PATTERN = re.compile(
    r'\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|REPLACE)\b',
    re.IGNORECASE,
)

_agent_system_prompt = """You are an autonomous agent that answers user questions by querying an SQL database through the provided tools.

IMPORTANT SECURITY RULES:
- You may ONLY query the following tables: {allowed_tables}
- ABSOLUTELY NO data-modification statements (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, REVOKE).
- All SELECT statements MUST include LIMIT (max 100 rows).
- Do NOT reveal database schema details, table structures, or internal system information to the user.
- If the user asks about tables not in the allowed list, say "该数据不在可查询范围内".

When a new question arrives, follow the steps *in order*:

1. ALWAYS call `sql_db_list_tables` first.  
   Purpose: discover what tables are available. Never skip this step.

2. Choose the table(s) that are probably relevant (ONLY from the allowed list), then call `sql_db_schema`
   once for each of those tables to obtain their schemas.

3. Write one syntactically-correct {{dialect}} SELECT statement.  
   Guidelines for this query:  
   - Return no more than 100 rows. Always include LIMIT.
   - Select only the columns needed to answer the question; avoid `SELECT *`.  
   - If helpful, add `ORDER BY` on a meaningful column so the most interesting rows appear first.  
   - Double-check the SQL before executing.

4. Execute the query with the execution tool `sql_db_query`.  
   If execution fails, inspect the error, revise the SQL, and try again.  
   Repeat until the query runs successfully or you are certain the request cannot be satisfied.

5. Read the resulting rows and craft a concise, direct answer for the user in Chinese.
   If the result set is empty, explain that no matching data was found.

Remember:  
- List tables → fetch schemas → write & verify SELECT → execute → answer.  
- Never skip steps 1 or 2.  
- Never perform DML.  
- Keep answers focused on the user's question.
- Always answer in Chinese."""


def _validate_sql(sql: str) -> str | None:
    """Return an error message if the SQL is forbidden, otherwise None."""
    match = _FORBIDDEN_SQL_PATTERN.search(sql)
    if match:
        return f'禁止执行的SQL操作: {match.group(0)}'
    return None


class SqlAgentAPIWrapper(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    llm: BaseLanguageModel = Field(description="llm to use for sql agent")
    sql_address: str = Field(description="sql database address for SQLDatabase uri")
    include_tables: List[str] = Field(default_factory=lambda: list(ALLOWED_TABLES))
    user_id: int = Field(default=0)
    user_name: str = Field(default='')

    db: Optional[SQLDatabase] = None
    agent: Optional[CompiledGraph] = None

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.llm = kwargs.get('llm')
        self.sql_address = kwargs.get('sql_address')
        self.include_tables = kwargs.get('include_tables', list(ALLOWED_TABLES))
        self.user_id = kwargs.get('user_id', 0)
        self.user_name = kwargs.get('user_name', '')

        self.db = SQLDatabase.from_uri(
            self.sql_address,
            include_tables=self.include_tables,
        )
        toolkit = SQLDatabaseToolkit(db=self.db, llm=self.llm)
        tools = toolkit.get_tools()

        allowed_str = ', '.join(self.include_tables)
        prompt = _agent_system_prompt.format(allowed_tables=allowed_str)
        prompt = prompt.replace('{{dialect}}', str(self.db.dialect))

        self.agent = create_react_agent(
            self.llm,
            tools,
            prompt=prompt,
            checkpointer=False,
        )

    def run(self, query: str) -> str:
        from mep.database.models.assistant_query_log import log_query_sync

        messages = self.agent.invoke({"messages": [HumanMessage(content=query)]})
        result = messages["messages"][-1].content

        try:
            log_query_sync(
                user_id=self.user_id,
                user_name=self.user_name,
                query_text=query,
                query_type='sql_agent',
                tool_name='sql_agent',
                result_summary=result[:500] if result else '',
                permission_scope=f'tables={",".join(self.include_tables)}',
            )
        except Exception:
            logger.debug('Failed to log SQL agent query', exc_info=True)

        return result

    def arun(self, query: str) -> str:
        return self.run(query)


class SqlAgentInput(BaseModel):
    query: str = Field(description="用户数据查询需求（需要尽可能完整、准确）")


class SqlAgentTool(BaseTool):
    name: str = "sql_agent"
    description: str = "回答与 SQL 数据库有关的问题。给定用户问题，将从数据库中获取可用的表以及对应 DDL，生成 SQL 查询语句并进行执行，最终得到执行结果。"
    args_schema: Type[BaseModel] = SqlAgentInput
    api_wrapper: SqlAgentAPIWrapper

    def _run(
            self,
            query: str,
            run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Use the tool."""
        try:
            res = self.api_wrapper.run(query)
        finally:
            if self.api_wrapper and self.api_wrapper.db:
                self.api_wrapper.db._engine.dispose()
        return res


if __name__ == '__main__':
    from langchain_openai import AzureChatOpenAI

    llm = AzureChatOpenAI()
    sql_agent_tool = SqlAgentTool(
        api_wrapper=SqlAgentAPIWrapper(
            llm=llm,
            sql_address="sqlite:///Chinook.db",
        )
    )

    result = sql_agent_tool.run("Which sales agent made the most in sales in 2009?")
    print(result)
