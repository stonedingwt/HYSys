const BASE = '/api/v1/cost-budget';

async function apiFetch<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
  });
  const json = await res.json();
  if (json.status_code === 200) return json.data;
  throw new Error(json.status_message || 'Request failed');
}

export async function saveBudget(data: any) {
  return apiFetch('/save', { method: 'POST', body: JSON.stringify(data) });
}

export async function markFinalQuote(recordId: number) {
  return apiFetch<{ task_id: string; message: string }>(`/final-quote/${recordId}`, { method: 'POST' });
}

export async function getTaskStatus(taskId: string) {
  return apiFetch<{ progress: number; message: string; task_id: string }>(`/status/${taskId}`);
}

export async function getConfig() {
  return apiFetch<{
    order_types: string[];
    seasons: string[];
    quote_types: string[];
    production_locations: string[];
    other_cost_types: string[];
  }>('/config');
}

export async function getHistory(pageNum = 1, pageSize = 15) {
  return apiFetch(`/history?page_num=${pageNum}&page_size=${pageSize}`);
}
