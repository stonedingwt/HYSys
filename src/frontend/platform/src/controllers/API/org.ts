import axios from "../request";

export interface OrgNode {
    id: number;
    name: string;
    org_type: string;
    parent_id: number | null;
    sort_order: number;
    remark: string | null;
    children?: OrgNode[];
    create_time?: string;
    update_time?: string;
}

export function getOrgTreeApi(): Promise<OrgNode[]> {
    return axios.get('/api/v1/org/tree');
}

export function getOrgListApi(): Promise<OrgNode[]> {
    return axios.get('/api/v1/org/list');
}

export function createOrgApi(data: {
    name: string;
    org_type: string;
    parent_id: number | null;
    sort_order?: number;
    remark?: string;
}): Promise<any> {
    return axios.post('/api/v1/org/create', data);
}

export function updateOrgApi(data: {
    id: number;
    name?: string;
    org_type?: string;
    parent_id?: number | null;
    sort_order?: number;
    remark?: string;
}): Promise<any> {
    return axios.put('/api/v1/org/update', data);
}

export function deleteOrgApi(orgId: number): Promise<any> {
    return axios.delete(`/api/v1/org/delete?org_id=${orgId}`);
}

export function setUserOrgApi(userId: number, orgId: number): Promise<any> {
    return axios.post('/api/v1/org/set_user_org', { user_id: userId, org_id: orgId });
}

export function getUserOrgsApi(userId: number): Promise<OrgNode[]> {
    return axios.get(`/api/v1/org/user_orgs?user_id=${userId}`);
}

export function getOrgUserCountsApi(): Promise<Record<string, { direct: number; total: number }>> {
    return axios.get('/api/v1/org/user_counts');
}
