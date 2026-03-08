import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Plus, Pencil, Trash2, Search, Users, UserPlus, X,
} from 'lucide-react';

function fetchApi(path: string, opts?: RequestInit) {
  return fetch(`/api/v1${path}`, { credentials: 'include', ...opts }).then(r => r.json()).then(r => r?.data ?? r);
}
function postApi(path: string, body: any) {
  return fetchApi(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
function patchApi(path: string, body: any) {
  return fetchApi(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
function delApi(path: string) {
  return fetchApi(path, { method: 'DELETE' });
}

interface RoleItem { id: number; role_name: string; create_time: string; }
interface GroupItem { id: number; group_name: string; }

const WS_MENUS = [
  { id: 'ws_apps', label: '应用中心', desc: '查看和使用应用中心' },
  { id: 'ws_new_chat', label: 'AI助手', desc: '创建新对话' },
  { id: 'ws_task_center', label: '任务中心', desc: '查看和管理待办任务' },
  { id: 'ws_message_center', label: '消息中心', desc: '查看通知和消息' },
  { id: 'ws_user_manage', label: '用户管理', desc: '查看和管理用户列表、组织架构' },
  { id: 'ws_role_manage', label: '角色管理', desc: '查看和管理角色权限' },
  { id: 'ws_data_dict', label: '数据字典', desc: '管理数据字典分类和字典项' },
];

/* ─── 成员管理弹窗 ─── */
function MembersDialog({ role, onClose }: { role: RoleItem | null; onClose(): void }) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [keyword, setKeyword] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<any>(null);

  const loadMembers = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    try {
      const res = await fetchApi(`/user/list?page_num=1&page_size=200&role_id=${role.id}`);
      setMembers(res?.data || []);
    } catch { /* */ }
    setLoading(false);
  }, [role]);

  useEffect(() => {
    if (role) { setMode('list'); setKeyword(''); setSelected(new Set()); loadMembers(); }
  }, [role, loadMembers]);

  const searchCandidates = async (name: string) => {
    setSearchLoading(true);
    try {
      const res = await fetchApi(`/user/list?page_num=1&page_size=50&name=${encodeURIComponent(name)}`);
      const memberIds = new Set(members.map(m => m.user_id));
      setCandidates((res?.data || []).filter((u: any) => !memberIds.has(u.user_id)));
    } catch { /* */ }
    setSearchLoading(false);
  };

  const handleSearch = (val: string) => {
    setKeyword(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchCandidates(val), 300);
  };

  const switchToAdd = () => {
    setMode('add'); setKeyword(''); setSelected(new Set()); setCandidates([]);
    searchCandidates('');
  };

  const toggleSelect = (uid: number) => {
    setSelected(prev => { const s = new Set(prev); s.has(uid) ? s.delete(uid) : s.add(uid); return s; });
  };

  const handleAdd = async () => {
    if (!role || selected.size === 0) return;
    setSaving(true);
    try {
      for (const uid of selected) {
        const candidate = candidates.find((u: any) => u.user_id === uid);
        const ids = (candidate?.roles || []).map((r: any) => String(r.id));
        if (!ids.includes(String(role.id))) ids.push(String(role.id));
        await postApi('/user/role_add', { user_id: uid, role_id: ids });
      }
      setMode('list'); loadMembers();
    } catch { /* */ }
    setSaving(false);
  };

  const handleRemove = async (user: any) => {
    if (!role) return;
    try {
      const ids = (user.roles || []).map((r: any) => String(r.id)).filter(id => id !== String(role.id));
      await postApi('/user/role_add', { user_id: user.user_id, role_id: ids });
      loadMembers();
    } catch { /* */ }
  };

  if (!role) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[500px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Users className="w-5 h-5" /> {role.role_name} — 成员管理
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {mode === 'list' ? (<>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">共 {members.length} 名成员</span>
              <button onClick={switchToAdd} className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-md border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                <UserPlus className="w-3.5 h-3.5" /> 添加成员
              </button>
            </div>
            <div className="border rounded-md border-gray-200 dark:border-gray-700 overflow-hidden">
              {loading ? (
                <div className="text-center py-10 text-gray-400 text-sm">加载中...</div>
              ) : members.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">暂无成员，点击上方"添加成员"</div>
              ) : members.map((u: any) => (
                <div key={u.user_id} className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{u.user_name}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {(u.roles || []).filter((r: any) => r.id !== role.id).map((r: any) => r.name).join(', ')}
                    </span>
                  </div>
                  <button onClick={() => handleRemove(u)} disabled={u.roles?.some((r: any) => r.id === 1)}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 flex items-center gap-0.5">
                    <X className="w-3 h-3" /> 移除
                  </button>
                </div>
              ))}
            </div>
          </>) : (<>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setMode('list')} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">← 返回</button>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">搜索并选择要添加的用户</span>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={keyword} onChange={e => handleSearch(e.target.value)} autoFocus placeholder="搜索用户名"
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="border rounded-md border-gray-200 dark:border-gray-700 max-h-[240px] overflow-y-auto">
              {searchLoading ? (
                <div className="text-center py-8 text-gray-400 text-sm">搜索中...</div>
              ) : candidates.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">暂无可添加的用户</div>
              ) : candidates.map((u: any) => (
                <div key={u.user_id} onClick={() => toggleSelect(u.user_id)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b last:border-b-0 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${selected.has(u.user_id) ? 'bg-primary/5' : ''}`}>
                  <input type="checkbox" checked={selected.has(u.user_id)} readOnly className="accent-primary w-4 h-4 rounded" />
                  <span className="text-sm flex-1 truncate text-gray-800 dark:text-gray-200">{u.user_name}</span>
                  <span className="text-xs text-gray-400">{(u.roles || []).map((r: any) => r.name).join(', ')}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setMode('list')} className="px-4 py-1.5 text-sm border rounded-md border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">取消</button>
              <button disabled={selected.size === 0 || saving} onClick={handleAdd}
                className="px-4 py-1.5 text-sm rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50">
                {saving ? '添加中...' : `确定添加 (${selected.size})`}
              </button>
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

/* ─── Edit role panel ─── */
function EditRolePanel({ role, groupId, onBack }: { role: Partial<RoleItem>; groupId: number; onBack(): void }) {
  const [name, setName] = useState(role.role_name || '');
  const [saving, setSaving] = useState(false);
  const [menuPerms, setMenuPerms] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (role.id) {
      fetchApi(`/role_access/list?role_id=${role.id}&page_size=200&page_num=1`).then((res: any) => {
        const perms: string[] = [];
        (res?.data || res || []).forEach((it: any) => {
          if (it.type === 99) perms.push(String(it.third_id));
        });
        setMenuPerms(perms);
        setLoaded(true);
      });
    } else {
      setMenuPerms(['ws_apps', 'ws_new_chat', 'frontend']);
      setLoaded(true);
    }
  }, [role.id]);

  const toggleMenu = (id: string) => {
    setMenuPerms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      let roleId = role.id;
      if (!roleId) {
        const res = await postApi('/role/add', { group_id: groupId, role_name: name.trim(), remark: '' });
        roleId = res?.id ?? res;
      } else {
        await patchApi(`/role/${roleId}`, { role_name: name.trim(), remark: '' });
      }
      const allPerms = [...menuPerms];
      if (!allPerms.includes('frontend')) allPerms.push('frontend');
      await postApi('/role_access/refresh', { role_id: roleId, access_id: allPerms, type: 99 });
      onBack();
    } catch { /* */ }
    setSaving(false);
  };

  if (!loaded) {
    return <div className="flex items-center justify-center h-64 text-gray-400">加载中...</div>;
  }

  return (
    <div className="max-w-[640px] mx-auto h-full overflow-y-auto pb-24">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
        <ArrowLeft className="w-4 h-4" /> 返回角色列表
      </button>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-6">{role.id ? '编辑角色' : '创建角色'}</h2>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">角色名称</label>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={50}
          className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" placeholder="请输入角色名称" />
      </div>

      <div className="mb-6">
        <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">工作台菜单权限</h3>
        <p className="text-xs text-gray-400 mb-4">设置该角色可以查看哪些工作台菜单</p>
        <div className="space-y-2">
          {WS_MENUS.map(menu => {
            const checked = menuPerms.includes(menu.id);
            return (
              <label key={menu.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? 'border-primary/40 bg-primary/5' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleMenu(menu.id)}
                  className="accent-primary w-4 h-4 rounded shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{menu.label}</div>
                  <div className="text-xs text-gray-400">{menu.desc}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button onClick={onBack} className="px-8 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">取消</button>
        <button disabled={saving} onClick={handleSave} className="px-8 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
      </div>
    </div>
  );
}

/* ═══════════════ Main ═══════════════ */
export default function WsRoleManage() {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selGroup, setSelGroup] = useState<number | null>(null);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const allRolesRef = useRef<RoleItem[]>([]);
  const [searchKey, setSearchKey] = useState('');
  const [editRole, setEditRole] = useState<Partial<RoleItem> | null>(null);
  const [memberRole, setMemberRole] = useState<RoleItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/group/list').then((res: any) => {
      const gs = (res?.records || res || []).map((g: any) => ({ id: g.id, group_name: g.group_name }));
      setGroups(gs);
      if (gs.length > 0) setSelGroup(gs[0].id);
    });
  }, []);

  const loadRoles = useCallback(async () => {
    if (!selGroup) return;
    setLoading(true);
    try {
      const res = await fetchApi(`/group/roles?keyword=&group_id=${selGroup}`);
      const arr = res?.data || res || [];
      setRoles(arr); allRolesRef.current = arr;
    } catch { setRoles([]); }
    setLoading(false);
  }, [selGroup]);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  const handleSearch = (v: string) => {
    setSearchKey(v);
    if (!v) { setRoles(allRolesRef.current); return; }
    setRoles(allRolesRef.current.filter(r => r.role_name.toUpperCase().includes(v.toUpperCase())));
  };

  const handleDelete = async (r: RoleItem) => {
    if (!confirm(`确定删除角色【${r.role_name}】？`)) return;
    await delApi(`/role/${r.id}`);
    loadRoles();
  };

  if (editRole) {
    return (
      <div className="h-full overflow-hidden bg-[#f4f5f8] dark:bg-[#111] p-6">
        <EditRolePanel role={editRole} groupId={selGroup!} onBack={() => { setEditRole(null); loadRoles(); }} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden bg-[#f4f5f8] dark:bg-[#111] flex flex-col p-5">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">角色管理</h2>
        <div className="flex items-center gap-3">
          <div className="relative w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="搜索角色名..." value={searchKey} onChange={e => handleSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <button onClick={() => setEditRole({})} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90">
            <Plus className="w-4 h-4" /> 创建角色
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1B1B1B]">
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">角色名称</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">创建时间</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="text-center py-10 text-gray-400">加载中...</td></tr>
            ) : roles.length === 0 ? (
              <tr><td colSpan={3} className="text-center py-10 text-gray-400">暂无角色</td></tr>
            ) : roles.map(r => (
              <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">{r.role_name}</td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.create_time?.replace('T', ' ')?.slice(0, 19)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setMemberRole(r)} className="text-blue-600 hover:text-blue-700 text-xs mr-4">
                    <Users className="w-3.5 h-3.5 inline mr-1" />成员
                  </button>
                  <button onClick={() => setEditRole(r)} className="text-primary hover:text-primary/80 text-xs mr-4">
                    <Pencil className="w-3.5 h-3.5 inline mr-1" />编辑
                  </button>
                  <button disabled={[1, 2].includes(r.id)} onClick={() => handleDelete(r)}
                    className="text-red-500 hover:text-red-600 text-xs disabled:opacity-40 disabled:cursor-not-allowed">
                    <Trash2 className="w-3.5 h-3.5 inline mr-1" />删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MembersDialog role={memberRole} onClose={() => setMemberRole(null)} />
    </div>
  );
}
