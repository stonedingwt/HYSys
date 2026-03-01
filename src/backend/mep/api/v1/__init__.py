from mep.api.v1.assistant import router as assistant_router
from mep.api.v1.audit import router as audit_router
from mep.api.v1.chat import router as chat_router
from mep.api.v1.component import router as component_router
from mep.api.v1.endpoints import router as endpoints_router
from mep.api.v1.evaluation import router as evaluation_router
from mep.api.v1.flows import router as flows_router
from mep.api.v1.invite_code import router as invite_code_router
from mep.api.v1.mark_task import router as mark_router
from mep.api.v1.report import router as report_router
from mep.api.v1.skillcenter import router as skillcenter_router
from mep.api.v1.tag import router as tag_router
from mep.api.v1.usergroup import router as group_router
from mep.api.v1.validate import router as validate_router
from mep.api.v1.variable import router as variable_router
from mep.api.v1.workflow import router as workflow_router
from mep.api.v1.workstation import router as workstation_router
from mep.api.v1.scheduled_task import router as scheduled_task_router
from mep.api.v1.organization import router as organization_router
from mep.api.v1.master_data import router as master_data_router
from mep.api.v1.sales_order import router as sales_order_router
from mep.api.v1.sales_order_process import router as sales_order_process_router
from mep.api.v1.order_assistant import router as order_assistant_router
from mep.api.v1.packing_spec import router as packing_spec_router
from mep.api.v1.data_dict import router as data_dict_router
from mep.api.v1.sso_auth import router as sso_auth_router
from mep.api.v1.sso_sync import router as sso_sync_router
from mep.api.v1.task_center import router as task_center_router
from mep.api.v1.cost_budget import router as cost_budget_router
from mep.api.v1.biz_forms import router as biz_forms_router
from mep.api.v1.parse_rules import router as parse_rules_router
from mep.tool.api.tool import router as tool_router
from mep.user.api.user import router as user_router

__all__ = [
    'chat_router',
    'endpoints_router',
    'validate_router',
    'flows_router',
    'skillcenter_router',
    'user_router',
    'variable_router',
    'report_router',
    'component_router',
    'assistant_router',
    'evaluation_router',
    'group_router',
    'audit_router',
    'tag_router',
    'workflow_router',
    'mark_router',
    'workstation_router',
    "tool_router",
    "invite_code_router",
    "scheduled_task_router",
    "organization_router",
    "master_data_router",
    "sales_order_router",
    "sales_order_process_router",
    "order_assistant_router",
    "packing_spec_router",
    "data_dict_router",
    "sso_auth_router",
    "sso_sync_router",
    "task_center_router",
    "cost_budget_router",
    "biz_forms_router",
    "parse_rules_router",
]
