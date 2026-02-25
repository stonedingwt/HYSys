import axios from "../request";

export interface ScheduledTask {
    id: number;
    name: string;
    workflow_id: string;
    workflow_name?: string;
    cron_expression: string;
    description?: string;
    enabled: boolean;
    notify_on_failure: boolean;
    notify_email?: string;
    smtp_server?: string;
    smtp_port?: number;
    smtp_account?: string;
    smtp_password?: string;
    input_params?: Record<string, any>;
    user_id: number;
    create_time?: string;
    update_time?: string;
    last_run_time?: string;
    last_run_status?: string;
}

export interface ScheduledTaskLog {
    id: number;
    task_id: number;
    task_name: string;
    workflow_id: string;
    workflow_name?: string;
    status: string;
    start_time?: string;
    end_time?: string;
    duration_ms?: number;
    result?: string;
    error_message?: string;
    triggered_by: string;
}

/** List scheduled tasks */
export async function getScheduledTasksApi(params: {
    page_num?: number;
    page_size?: number;
    keyword?: string;
}): Promise<{ data: ScheduledTask[]; total: number }> {
    return await axios.get('/api/v1/scheduled_task/list', { params });
}

/** Get task detail */
export async function getScheduledTaskDetailApi(task_id: number): Promise<ScheduledTask> {
    return await axios.get('/api/v1/scheduled_task/detail', { params: { task_id } });
}

/** Create task */
export async function createScheduledTaskApi(data: Partial<ScheduledTask>): Promise<ScheduledTask> {
    return await axios.post('/api/v1/scheduled_task/create', data);
}

/** Update task */
export async function updateScheduledTaskApi(data: Partial<ScheduledTask> & { id: number }): Promise<ScheduledTask> {
    return await axios.post('/api/v1/scheduled_task/update', data);
}

/** Delete task */
export async function deleteScheduledTaskApi(task_id: number): Promise<any> {
    return await axios.post('/api/v1/scheduled_task/delete', { task_id });
}

/** Toggle enable/disable */
export async function toggleScheduledTaskApi(task_id: number, enabled: boolean): Promise<ScheduledTask> {
    return await axios.post('/api/v1/scheduled_task/toggle', { task_id, enabled });
}

/** Run task now */
export async function runScheduledTaskApi(task_id: number): Promise<any> {
    return await axios.post('/api/v1/scheduled_task/run', { task_id });
}

/** Get task logs */
export async function getScheduledTaskLogsApi(params: {
    task_id?: number;
    page_num?: number;
    page_size?: number;
    status?: string;
}): Promise<{ data: ScheduledTaskLog[]; total: number }> {
    return await axios.get('/api/v1/scheduled_task/logs', { params });
}

/** Get available workflows for scheduled task selection */
export async function getWorkflowListApi(params: {
    page_num?: number;
    page_size?: number;
    name?: string;
}): Promise<{ data: any[]; total: number }> {
    const { page_num = 1, page_size = 200, name = '' } = params;
    return await axios.get(`/api/v1/workflow/list`, { params: { page_num, page_size, name, flow_type: 10 } });
}
