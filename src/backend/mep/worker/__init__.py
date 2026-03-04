# register tasks
from mep.worker.knowledge.file_worker import file_copy_celery, parse_knowledge_file_celery, \
    retry_knowledge_file_celery
from mep.worker.knowledge.rebuild_knowledge_worker import rebuild_knowledge_celery
from mep.worker.telemetry.mid_table import sync_mid_user_increment, sync_mid_knowledge_increment, \
    sync_mid_app_increment, sync_mid_user_interact_dtl
from mep.worker.test.test import add
from mep.worker.workflow.tasks import execute_workflow, continue_workflow, stop_workflow
from mep.worker.scheduled_task.tasks import check_scheduled_tasks, run_scheduled_task
from mep.worker.kingdee.kingdee_rpa_worker import kingdee_budget_task, sync_final_quotes_to_kingdee
