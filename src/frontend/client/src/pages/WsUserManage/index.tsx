import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2, ChevronDown, ChevronRight, FolderTree, List, Plus, Pencil,
  Trash2, Users as UsersIcon, X, Search, ChevronLeft, ChevronRightIcon,
} from 'lucide-react';

function fetchApi(path: string, opts?: RequestInit) {
  return fetch(`/api/v1${path}`, { credentials: 'include', ...opts }).then(r => r.json()).then(r => r?.data ?? r);
}
function postApi(path: string, body: any) {
  return fetchApi(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
function putApi(path: string, body: any) {
  return fetchApi(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
function delApi(path: string) {
  return fetchApi(path, { method: 'DELETE' });
}

interface OrgNode { id: number; name: string; org_type: string; parent_id: number | null; sort_order: number; remark: string | null; children?: OrgNode[]; }
interface UserItem { user_id: number; user_name: string; email?: string; phone_number?: string; dept_id?: string; user_type?: string; delete: number; create_time: string; update_time: string; groups?: { name: string }[]; roles?: { id: number; name: string }[]; }

const USER_TYPES = [
  { value: 'local', label: '本地用户', cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  { value: 'dingtalk', label: '钉钉用户', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  { value: 'wecom', label: '企业微信用户', cls: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
  { value: 'feishu', label: '飞书用户', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' },
  { value: 'aad', label: 'AAD用户', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
];
function typeInfo(v?: string) { return USER_TYPES.find(o => o.value === v) || USER_TYPES[0]; }

/* ─── Org tree node ─── */
function TreeNode({ node, level = 0, selected, onSelect, onAdd, onEdit, onDelete }: {
  node: OrgNode; level?: number; selected: number | null;
  onSelect(id: number): void; onAdd(pid: number): void; onEdit(n: OrgNode): void; onDelete(id: number): void;
}) {
  const [open, setOpen] = useState(true);
  const has = node.children && node.children.length > 0;
  return (<div>
    <div className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer group text-sm ${selected === node.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
      style={{ paddingLeft: `${level * 16 + 8}px` }} onClick={() => onSelect(node.id)}>
      <span className="w-4 shrink-0" onClick={e => { e.stopPropagation(); setOpen(!open); }}>
        {has ? (open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : null}
      </span>
      <Building2 className="w-4 h-4 shrink-0 text-gray-400" />
      <span className="truncate flex-1">{node.name}</span>
      <span className="text-[10px] text-gray-400 shrink-0">{node.org_type === 'company' ? '公司' : '部门'}</span>
      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
        <button onClick={e => { e.stopPropagation(); onAdd(node.id); }} className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="添加子部门"><Plus className="w-3 h-3" /></button>
        <button onClick={e => { e.stopPropagation(); onEdit(node); }} className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="编辑"><Pencil className="w-3 h-3" /></button>
        <button onClick={e => { e.stopPropagation(); onDelete(node.id); }} className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-500" title="删除"><Trash2 className="w-3 h-3" /></button>
      </div>
    </div>
    {open && has && node.children!.map(c => <TreeNode key={c.id} node={c} level={level + 1} selected={selected} onSelect={onSelect} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} />)}
  </div>);
}

/* ─── Org dialog ─── */
function OrgDlg({ open, type, pid, edit, onClose, onSave }: {
  open: boolean; type: string; pid: number | null; edit: OrgNode | null; onClose(): void; onSave(d: any): void;
}) {
  const [name, setName] = useState('');
  const [remark, setRemark] = useState('');
  useEffect(() => { if (edit) { setName(edit.name); setRemark(edit.remark || ''); } else { setName(''); setRemark(''); } }, [edit, open]);
  if (!open) return null;
  return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white dark:bg-[#1B1B1B] rounded-lg shadow-xl w-[400px] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">{edit ? '编辑' : '新建'}{type === 'company' ? '公司' : '部门'}</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-4 h-4" /></button>
      </div>
      <div className="space-y-4">
        <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">名称</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" placeholder={`请输入${type === 'company' ? '公司' : '部门'}名称`} /></div>
        <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">备注</label>
          <input value={remark} onChange={e => setRemark(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" placeholder="备注（选填）" /></div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">取消</button>
        <button onClick={() => { if (!name.trim()) return; onSave({ name: name.trim(), org_type: edit ? edit.org_type : type, parent_id: edit ? edit.parent_id : pid, remark: remark.trim(), ...(edit ? { id: edit.id } : {}) }); }} className="px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90">确定</button>
      </div>
    </div>
  </div>);
}

/* ─── Create user dialog ─── */
function CreateUserDlg({ open, onClose, onCreated }: { open: boolean; onClose(): void; onCreated(): void; }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setUsername(''); setPassword(''); } }, [open]);
  if (!open) return null;
  const handleSave = async () => {
    if (!username.trim() || !password) return;
    setSaving(true);
    try {
      await postApi('/user/create', { user_name: username.trim(), password, group_roles: [{ group_id: 2, role_ids: [2] }] });
      onCreated(); onClose();
    } catch { /* ignore */ }
    setSaving(false);
  };
  return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white dark:bg-[#1B1B1B] rounded-lg shadow-xl w-[420px] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">创建用户</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-4 h-4" /></button>
      </div>
      <div className="space-y-4">
        <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">用户名</label>
          <input value={username} onChange={e => setUsername(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" placeholder="请输入用户名" /></div>
        <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">初始密码</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" placeholder="请输入密码（8位以上含大小写字母和数字）" /></div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">取消</button>
        <button disabled={saving} onClick={handleSave} className="px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50">确定</button>
      </div>
    </div>
  </div>);
}

/* ═══════════════ Main ═══════════════ */
export default function WsUserManage() {
  const [orgTree, setOrgTree] = useState<OrgNode[]>([]);
  const [orgFlat, setOrgFlat] = useState<OrgNode[]>([]);
  const [selOrg, setSelOrg] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgType, setDlgType] = useState('company');
  const [dlgPid, setDlgPid] = useState<number | null>(null);
  const [dlgEdit, setDlgEdit] = useState<OrgNode | null>(null);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKey, setSearchKey] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const [createOpen, setCreateOpen] = useState(false);

  const loadOrgs = useCallback(async () => {
    try {
      const tree = await fetchApi('/org/tree'); setOrgTree(tree ?? []);
      const flat = await fetchApi('/org/list'); setOrgFlat(flat ?? []);
    } catch { /* */ }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchApi(`/user/list?name=${encodeURIComponent(searchKey)}&page_num=${page}&page_size=${pageSize}`);
      setUsers(r?.data ?? []); setTotal(r?.total ?? 0);
    } catch { setUsers([]); }
    setLoading(false);
  }, [page, searchKey]);

  useEffect(() => { loadOrgs(); }, []);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  const orgMap = useMemo(() => {
    const m: Record<number, OrgNode> = {};
    const walk = (ns: OrgNode[]) => { for (const n of ns) { m[n.id] = n; if (n.children) walk(n.children); } };
    walk(orgTree); return m;
  }, [orgTree]);

  const addOrg = (pid: number | null, t = 'department') => { setDlgEdit(null); setDlgType(t); setDlgPid(pid); setDlgOpen(true); };
  const editOrg = (n: OrgNode) => { setDlgEdit(n); setDlgType(n.org_type); setDlgPid(n.parent_id); setDlgOpen(true); };
  const deleteOrg = async (id: number) => { if (!confirm('确定删除该组织及其所有子组织？')) return; await delApi(`/org/delete?org_id=${id}`); loadOrgs(); };
  const saveOrg = async (d: any) => { d.id ? await putApi('/org/update', d) : await postApi('/org/create', d); setDlgOpen(false); loadOrgs(); };

  const disableUser = async (uid: number, status: number) => { await postApi('/user/update', { user_id: uid, delete: status }); loadUsers(); };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="h-full overflow-hidden bg-[#f4f5f8] dark:bg-[#111] flex">
      {/* 左侧 组织架构 */}
      <div className="w-[240px] shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1B1B1B] flex flex-col h-full">
        <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">组织架构</h3>
            <div className="flex gap-1">
              <button onClick={() => setViewMode('tree')} className={`p-1 rounded ${viewMode === 'tree' ? 'bg-primary/10 text-primary' : 'text-gray-400'}`}><FolderTree className="w-3.5 h-3.5" /></button>
              <button onClick={() => setViewMode('list')} className={`p-1 rounded ${viewMode === 'list' ? 'bg-primary/10 text-primary' : 'text-gray-400'}`}><List className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <button onClick={() => addOrg(null, 'company')} className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-md border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 hover:border-primary hover:text-primary">
            <Plus className="w-3 h-3" /> 新建公司
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {viewMode === 'tree' ? (<div>
            <div className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${selOrg === null ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`} onClick={() => setSelOrg(null)}>
              <UsersIcon className="w-4 h-4" /><span>全部用户</span>
            </div>
            {orgTree.map(n => <TreeNode key={n.id} node={n} selected={selOrg} onSelect={setSelOrg} onAdd={id => addOrg(id)} onEdit={editOrg} onDelete={deleteOrg} />)}
          </div>) : (
            <table className="w-full text-xs">
              <thead><tr className="text-gray-500 border-b"><th className="text-left py-1 px-1">名称</th><th className="text-left py-1 px-1">类型</th><th className="text-left py-1 px-1">上级</th></tr></thead>
              <tbody>{orgFlat.map(o => (
                <tr key={o.id} className={`border-b cursor-pointer ${selOrg === o.id ? 'bg-primary/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`} onClick={() => setSelOrg(o.id)}>
                  <td className="py-1.5 px-1 text-gray-700 dark:text-gray-300">{o.name}</td>
                  <td className="py-1.5 px-1 text-gray-500">{o.org_type === 'company' ? '公司' : '部门'}</td>
                  <td className="py-1.5 px-1 text-gray-500">{o.parent_id ? orgMap[o.parent_id]?.name || '-' : '-'}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>

      {/* 右侧 用户列表 */}
      <div className="flex-1 flex flex-col h-full overflow-hidden p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">用户管理</h2>
          <div className="flex items-center gap-3">
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="搜索用户名..." value={searchKey} onChange={e => { setSearchKey(e.target.value); setPage(1); }}
                className="w-full pl-8 pr-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90">
              <Plus className="w-4 h-4" /> 创建
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1B1B1B]">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">用户名</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">用户类型</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">角色</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">组织/部门</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">状态</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">修改时间</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">加载中...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">暂无数据</td></tr>
              ) : users.map(u => {
                const ti = typeInfo(u.user_type);
                const isSuperAdmin = u.roles?.some(r => r.id === 1);
                return (
                  <tr key={u.user_id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">{u.user_name}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-medium ${ti.cls}`}>{ti.label}</span></td>
                    {/* 用户组列已移除，使用组织架构 */}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{(u.roles || []).map(r => r.name).join(', ') || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{u.dept_id && orgMap[Number(u.dept_id)] ? orgMap[Number(u.dept_id)].name : '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-medium ${u.delete === 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'}`}>
                        {u.delete === 0 ? '正常' : '禁用'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{u.update_time?.replace('T', ' ')?.slice(0, 19)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {isSuperAdmin ? <span className="text-gray-400 text-xs">超级管理员</span> : (
                        u.delete === 0
                          ? <button onClick={() => disableUser(u.user_id, 1)} className="text-red-500 hover:text-red-600 text-xs">禁用</button>
                          : <button onClick={() => disableUser(u.user_id, 0)} className="text-green-600 hover:text-green-700 text-xs">启用</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 mt-3 shrink-0">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" /></button>
            <span className="text-sm text-gray-500 min-w-[60px] text-center">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronRightIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" /></button>
          </div>
        )}
      </div>

      <OrgDlg open={dlgOpen} type={dlgType} pid={dlgPid} edit={dlgEdit} onClose={() => setDlgOpen(false)} onSave={saveOrg} />
      <CreateUserDlg open={createOpen} onClose={() => setCreateOpen(false)} onCreated={loadUsers} />
    </div>
  );
}
