/** API layer for biz forms (follow_up / bom / sample). */

const BASE = '/api/v1/biz-forms';

async function apiFetch<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
  });
  const json = await res.json();
  if (json.status_code === 200) return json.data;
  throw new Error(json.status_message || 'Request failed');
}

// Follow-up
export const fetchFollowUpByTask = (taskId: number) =>
  apiFetch<any>(`/follow-up/by-task/${taskId}`);

export const updateFollowUp = (id: number, data: Record<string, any>) =>
  apiFetch<any>(`/follow-up/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  });

// BOM
export const fetchBomByFollowUp = (followUpId: number) =>
  apiFetch<any>(`/bom/by-follow-up/${followUpId}`);

export const updateBom = (id: number, header: Record<string, any>, details: any[]) =>
  apiFetch<any>(`/bom/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ header, details }),
  });

// Sample
export const fetchSampleByFollowUp = (followUpId: number) =>
  apiFetch<any>(`/sample/by-follow-up/${followUpId}`);

export const updateSample = (id: number, header: Record<string, any>, ratios: any[], materials: any[]) =>
  apiFetch<any>(`/sample/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ header, ratios, materials }),
  });

// Completeness check
export const checkCompleteness = (followUpId: number) =>
  apiFetch<any>(`/check-completeness/${followUpId}`, { method: 'POST' });

// Create sample task
export const createSampleTask = (followUpId: number) =>
  apiFetch<any>(`/create-sample-task/${followUpId}`, { method: 'POST' });
