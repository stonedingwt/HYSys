import type { Task, TaskStats, TaskFormItem, TaskLog, TransferableUser, TaskDetail, TaskStages } from './types';

const BASE = '/api/v1/task-center';

async function apiFetch<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
  });
  const json = await res.json();
  if (json.status_code === 200) return json.data;
  throw new Error(json.status_message || 'Request failed');
}

export async function fetchTasks(params: {
  page?: number; page_size?: number;
  status?: string; task_type?: string;
  keyword?: string; sort_by?: string; sort_order?: string;
}): Promise<{ items: Task[]; total: number }> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') qs.set(k, String(v)); });
  return apiFetch(`/list?${qs}`);
}

export async function fetchStats(): Promise<TaskStats> {
  return apiFetch('/stats');
}

export async function fetchTaskDetail(taskId: number): Promise<TaskDetail> {
  return apiFetch(`/detail/${taskId}`);
}

export async function createTask(data: Record<string, any>): Promise<Task> {
  return apiFetch('/create', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTask(taskId: number, data: Record<string, any>): Promise<Task> {
  return apiFetch(`/update/${taskId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function toggleFocus(taskId: number): Promise<{ focused: boolean }> {
  return apiFetch(`/focus/${taskId}`, { method: 'POST' });
}

export async function transferTask(taskId: number, newAssigneeId: number): Promise<any> {
  return apiFetch(`/transfer/${taskId}`, {
    method: 'PUT', body: JSON.stringify({ new_assignee_id: newAssigneeId }),
  });
}

export async function fetchTransferableUsers(taskId: number): Promise<TransferableUser[]> {
  return apiFetch(`/transferable-users/${taskId}`);
}

export async function fetchForms(taskId: number): Promise<TaskFormItem[]> {
  return apiFetch(`/forms/${taskId}`);
}

export async function addForm(taskId: number, data: { form_type: string; form_id?: number; form_name: string; is_main?: boolean }): Promise<TaskFormItem> {
  return apiFetch(`/forms/${taskId}`, { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteForm(formId: number): Promise<any> {
  return apiFetch(`/forms/${formId}`, { method: 'DELETE' });
}

export async function fetchLogs(taskId: number, page = 1, pageSize = 50): Promise<{ items: TaskLog[]; total: number }> {
  return apiFetch(`/logs/${taskId}?page=${page}&page_size=${pageSize}`);
}

export async function addLog(taskId: number, data: { log_type: string; content?: string; detail?: any }): Promise<TaskLog> {
  return apiFetch(`/logs/${taskId}`, { method: 'POST', body: JSON.stringify(data) });
}

export async function fetchTaskStages(taskId: number): Promise<TaskStages> {
  return apiFetch(`/stages/${taskId}`);
}

export async function changeTaskStage(taskId: number, direction: 'next' | 'prev'): Promise<Task> {
  return apiFetch(`/stage/${taskId}`, { method: 'PUT', body: JSON.stringify({ direction }) });
}
