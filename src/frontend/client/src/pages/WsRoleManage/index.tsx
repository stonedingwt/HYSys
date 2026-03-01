import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ChevronDown, Plus, Pencil, Trash2, Search, Shield,
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
  { id: 'ws_new_chat', label: '赛乐助手', desc: '创建新对话，使用赛乐助手' },
  { id: 'ws_order_assistant', label: '跟单助手', desc: '上传和解析客户销售订单' },
  { id: 'ws_task_center', label: '任务中心', desc: '查看和管理待办任务' },
  { id: 'ws_message_center', label: '消息中心', desc: '查看通知和消息' },
  { id: 'ws_user_manage', label: '用户管理', desc: '查看和管理用户列表、组织架构' },
  { id: 'ws_role_manage', label: '角色管理', desc: '查看和管理角色权限' },
  { id: 'ws_master_data', label: '主数据管理', desc: '管理客户、供应商、生产线等主数据' },
  { id: 'ws_sales_order', label: '销售订单', desc: '查看和管理销售订单数据' },
  { id: 'ws_packing_spec', label: '装箱单规格', desc: '管理装箱单规格配置参数' },
  { id: 'ws_data_dict', label: '数据字典', desc: '管理数据字典分类和字典项' },
];

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
      setMenuPerms(['ws_apps', 'ws_new_chat', 'ws_ningyi_assistant', 'frontend']);
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
  const [loading, setLoading] = useState(true);
  const [showGroupDd, setShowGroupDd] = useState(false);

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

  const selectedGroupName = groups.find(g => g.id === selGroup)?.group_name || '选择用户组';

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
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">角色管理</h2>
          <div className="relative">
            <button onClick={() => setShowGroupDd(!showGroupDd)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              <Shield className="w-3.5 h-3.5 text-gray-400" />
              <span className="max-w-[140px] truncate">{selectedGroupName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            {showGroupDd && (<>
              <div className="fixed inset-0 z-40" onClick={() => setShowGroupDd(false)} />
              <div className="absolute top-full left-0 mt-1 w-[200px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 py-1">
                {groups.map(g => (
                  <div key={g.id} onClick={() => { setSelGroup(g.id); setShowGroupDd(false); }}
                    className={`px-3 py-2 text-sm cursor-pointer ${selGroup === g.id ? 'bg-primary/10 text-primary font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    {g.group_name}
                  </div>
                ))}
              </div>
            </>)}
          </div>
        </div>
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
    </div>
  );
}
