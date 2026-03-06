# Router for base api
from fastapi import APIRouter

from mep.api.v1 import (assistant_router, audit_router, chat_router, component_router,
                            endpoints_router, evaluation_router, flows_router,
                            group_router, mark_router,
                            report_router, skillcenter_router, tag_router,
                            user_router, validate_router, variable_router, workflow_router,
                            workstation_router, tool_router, invite_code_router,
                            scheduled_task_router, organization_router,
                            master_data_router,
                            data_dict_router,
                            sso_auth_router,
                            sso_sync_router,
                            task_center_router,
                            biz_forms_router,
                            parse_rules_router,
                            message_center_router)
from mep.chat_session.api.router import router as session_router
from mep.finetune.api.finetune import router as finetune_router
from mep.finetune.api.server import router as server_router
from mep.knowledge.api.router import qa_router, knowledge_router
from mep.llm.api.router import router as llm_router
from mep.open_endpoints.api.endpoints.llm import router as llm_router_rpc
from mep.open_endpoints.api.router import (assistant_router_rpc, chat_router_rpc, flow_router,
                                               knowledge_router_rpc, workflow_router_rpc,
                                               filelib_router_rpc)
from mep.share_link.api.router import router as share_link_router
from mep.linsight.api.router import router as linsight_router
try:
    from mep.telemetry_search.api.router import router as telemetry_search_router
except (ImportError, ModuleNotFoundError):
    telemetry_search_router = None

# Use stub telemetry dashboard router when telemetry_search module is not available
if telemetry_search_router is None:
    from mep.api.telemetry_stub import router as telemetry_search_router

router = APIRouter(prefix='/api/v1', )
router.include_router(chat_router)
router.include_router(endpoints_router)
router.include_router(validate_router)
router.include_router(flows_router)
router.include_router(skillcenter_router)
router.include_router(knowledge_router)
router.include_router(server_router)
router.include_router(user_router)
router.include_router(qa_router)
router.include_router(variable_router)
router.include_router(report_router)
router.include_router(finetune_router)
router.include_router(component_router)
router.include_router(assistant_router)
router.include_router(group_router)
router.include_router(audit_router)
router.include_router(evaluation_router)
router.include_router(tag_router)
router.include_router(llm_router)
router.include_router(workflow_router)
router.include_router(mark_router)
router.include_router(workstation_router)
router.include_router(linsight_router)
router.include_router(tool_router)
router.include_router(invite_code_router)
router.include_router(session_router)
router.include_router(share_link_router)
router.include_router(scheduled_task_router)
router.include_router(organization_router)
router.include_router(master_data_router)
router.include_router(data_dict_router)
router.include_router(sso_auth_router)
router.include_router(sso_sync_router)
router.include_router(task_center_router)
router.include_router(biz_forms_router)
router.include_router(parse_rules_router)
router.include_router(message_center_router)
router.include_router(telemetry_search_router)

router_rpc = APIRouter(prefix='/api/v2', )
router_rpc.include_router(knowledge_router_rpc)
router_rpc.include_router(filelib_router_rpc)
router_rpc.include_router(chat_router_rpc)
router_rpc.include_router(flow_router)
router_rpc.include_router(assistant_router_rpc)
router_rpc.include_router(workflow_router_rpc)
router_rpc.include_router(llm_router_rpc)

# Utility routes mounted at /api (no /v1 prefix)
from mep.api.v1.db_meta import router as db_meta_router

router_util = APIRouter(prefix='/api')
router_util.include_router(db_meta_router)
