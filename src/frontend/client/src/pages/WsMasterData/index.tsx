import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Pencil, Trash2, Search, X, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown,
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

/* ═══ Types ═══ */
interface ColDef {
  key: string; label: string; width?: string; sortable?: boolean;
  type?: 'text' | 'user' | 'select' | 'number';
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
}
interface TabDef { key: string; label: string; cols: ColDef[]; }

/* ═══ Tab configuration ═══ */
const TABS: TabDef[] = [
  {
    key: 'customer', label: '客户管理', cols: [
      { key: 'customer_code', label: '客户编码', sortable: true, required: true, placeholder: '请输入客户编码' },
      { key: 'customer_name', label: '客户名称', sortable: true, required: true, placeholder: '请输入客户名称' },
      { key: 'customer_short_name', label: '客户简称', placeholder: '请输入客户简称' },
      { key: 'customer_tags', label: '客户标签', placeholder: '多个标签用逗号分隔' },
      { key: 'customer_service_id', label: '客服', type: 'user' },
      { key: 'sample_manager_id', label: '打样负责人', type: 'user' },
      { key: 'process_manager_id', label: '工艺负责人', type: 'user' },
    ],
  },
  {
    key: 'supplier', label: '供应商管理', cols: [
      { key: 'supplier_code', label: '供应商编号', sortable: true, required: true, placeholder: '请输入供应商编号' },
      { key: 'supplier_name', label: '供应商名称', sortable: true, required: true, placeholder: '请输入供应商名称' },
      { key: 'address', label: '地址', placeholder: '请输入地址' },
      { key: 'supplier_type', label: '供应商类型', type: 'select', options: [
        { value: '原材料', label: '原材料' }, { value: '包装', label: '包装' },
        { value: '设备', label: '设备' }, { value: '服务', label: '服务' }, { value: '其他', label: '其他' },
      ]},
      { key: 'contact_name', label: '联系人姓名', placeholder: '请输入联系人' },
      { key: 'phone', label: '手机号', placeholder: '请输入手机号' },
      { key: 'wechat', label: '微信号', placeholder: '请输入微信号' },
      { key: 'qr_code', label: '小程序二维码', placeholder: '二维码链接' },
      { key: 'bound_user_id', label: '绑定用户', type: 'user' },
    ],
  },
  {
    key: 'production_line', label: '生产线管理', cols: [
      { key: 'line_name', label: '生产线名称', sortable: true, required: true, placeholder: '请输入名称' },
      { key: 'factory', label: '所属工厂', sortable: true, placeholder: '请输入工厂' },
      { key: 'manager_id', label: '负责人', type: 'user' },
      { key: 'product_family_tags', label: '产品族标签', placeholder: '多个标签用逗号分隔' },
      { key: 'priority_order', label: '优势顺序', type: 'number', sortable: true, placeholder: '数字越小越优先' },
    ],
  },
  {
    key: 'plan_manager', label: '计划管理', cols: [
      { key: 'user_id', label: '计划姓名', type: 'user', required: true },
      { key: 'factory', label: '负责工厂', sortable: true, placeholder: '请输入工厂' },
    ],
  },
  {
    key: 'warehouse_manager', label: '仓库管理', cols: [
      { key: 'user_id', label: '仓管姓名', type: 'user', required: true },
      { key: 'warehouse_name', label: '负责仓库', sortable: true, placeholder: '请输入仓库名称' },
      { key: 'factory', label: '仓库所属工厂', sortable: true, placeholder: '请输入工厂' },
    ],
  },
  {
    key: 'quality_manager', label: '质量管理', cols: [
      { key: 'user_id', label: '质量姓名', type: 'user', required: true },
      { key: 'tags', label: '标签', placeholder: '多个标签用逗号分隔' },
    ],
  },
];

/* ═══ User select ═══ */
function UserSelect({ value, onChange }: { value: number | null; onChange(v: number | null): void }) {
  const [users, setUsers] = useState<{ user_id: number; user_name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchApi('/user/list?page_num=1&page_size=200&name=').then(r => setUsers(r?.data || []));
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = useMemo(() => {
    if (!q) return users;
    return users.filter(u => u.user_name.toLowerCase().includes(q.toLowerCase()));
  }, [users, q]);

  const selected = users.find(u => u.user_id === value);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 text-sm border rounded-md cursor-pointer border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1B1B1B] text-gray-800 dark:text-gray-200 min-h-[36px] flex items-center justify-between">
        <span className={selected ? '' : 'text-gray-400'}>{selected?.user_name || '请选择用户'}</span>
        {value && <button onClick={e => { e.stopPropagation(); onChange(null); }} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>}
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full bg-white dark:bg-[#1B1B1B] border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-[200px] overflow-auto">
          <div className="sticky top-0 p-1 bg-white dark:bg-[#1B1B1B]">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索用户..." autoFocus
              className="w-full px-2 py-1 text-xs border rounded border-gray-200 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none" />
          </div>
          {filtered.map(u => (
            <div key={u.user_id} onClick={() => { onChange(u.user_id); setOpen(false); setQ(''); }}
              className={`px-3 py-1.5 text-sm cursor-pointer ${u.user_id === value ? 'bg-primary/10 text-primary' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              {u.user_name}
            </div>
          ))}
          {filtered.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">无匹配用户</div>}
        </div>
      )}
    </div>
  );
}

/* ═══ Form dialog ═══ */
function FormDialog({ open, title, cols, data, userMap, onClose, onSave }: {
  open: boolean; title: string; cols: ColDef[]; data: Record<string, any> | null;
  userMap: Record<number, string>; onClose(): void; onSave(d: Record<string, any>): void;
}) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(data ? { ...data } : {}); }, [data, open]);
  if (!open) return null;

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-[#1B1B1B] rounded-lg shadow-xl w-[520px] max-h-[80vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="space-y-4">
          {cols.map(col => (
            <div key={col.key}>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {col.label}{col.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {col.type === 'user' ? (
                <UserSelect value={form[col.key] ?? null} onChange={v => set(col.key, v)} />
              ) : col.type === 'select' ? (
                <select value={form[col.key] ?? ''} onChange={e => set(col.key, e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1B1B1B] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">请选择</option>
                  {col.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : col.type === 'number' ? (
                <input type="number" value={form[col.key] ?? ''} onChange={e => set(col.key, e.target.value ? Number(e.target.value) : null)}
                  placeholder={col.placeholder}
                  className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1B1B1B] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" />
              ) : (
                <input value={form[col.key] ?? ''} onChange={e => set(col.key, e.target.value)}
                  placeholder={col.placeholder}
                  className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1B1B1B] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">取消</button>
          <button disabled={saving} onClick={async () => {
            for (const c of cols) { if (c.required && !form[c.key]) return; }
            setSaving(true); await onSave(form); setSaving(false);
          }} className="px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50">{saving ? '保存中...' : '确定'}</button>
        </div>
      </div>
    </div>
  );
}

/* ═══ Master data table ═══ */
function MasterTable({ tab }: { tab: TabDef }) {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editData, setEditData] = useState<Record<string, any> | null>(null);
  const [userMap, setUserMap] = useState<Record<number, string>>({});
  const pageSize = 10;

  useEffect(() => {
    fetchApi('/user/list?page_num=1&page_size=500&name=').then(r => {
      const m: Record<number, string> = {};
      (r?.data || []).forEach((u: any) => { m[u.user_id] = u.user_name; });
      setUserMap(m);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchApi(`/master/${tab.key}/list?keyword=${encodeURIComponent(keyword)}&page_num=${page}&page_size=${pageSize}&sort_by=${sortBy}&sort_order=${sortOrder}`);
      setItems(r?.data || []); setTotal(r?.total || 0);
    } catch { setItems([]); }
    setLoading(false);
  }, [tab.key, keyword, page, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); setKeyword(''); setSortBy(''); setSortOrder('desc'); }, [tab.key]);

  const toggleSort = (col: string) => {
    if (sortBy === col) { setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }
    else { setSortBy(col); setSortOrder('asc'); }
    setPage(1);
  };

  const openCreate = () => { setEditData(null); setDlgOpen(true); };
  const openEdit = (item: any) => { setEditData({ ...item }); setDlgOpen(true); };
  const handleDelete = async (id: number) => {
    if (!confirm('确定删除这条记录？')) return;
    await delApi(`/master/${tab.key}/delete?id=${id}`);
    load();
  };

  const handleSave = async (data: Record<string, any>) => {
    if (data.id) {
      await putApi(`/master/${tab.key}/update`, data);
    } else {
      await postApi(`/master/${tab.key}/create`, data);
    }
    setDlgOpen(false);
    load();
  };

  const totalPages = Math.ceil(total / pageSize);

  const renderCell = (item: any, col: ColDef) => {
    const v = item[col.key];
    if (col.type === 'user') return <span>{v ? (userMap[v] || `用户#${v}`) : '-'}</span>;
    if (col.key === 'customer_tags' || col.key === 'product_family_tags' || col.key === 'tags') {
      if (!v) return <span className="text-gray-400">-</span>;
      return <div className="flex flex-wrap gap-1">{v.split(',').filter(Boolean).map((t: string, i: number) => (
        <span key={i} className="inline-flex px-1.5 py-0.5 rounded text-[11px] bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">{t.trim()}</span>
      ))}</div>;
    }
    return <span>{v ?? '-'}</span>;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="搜索..." value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }}
            className="w-full pl-8 pr-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1B1B1B] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90">
          <Plus className="w-4 h-4" /> 新增
        </button>
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1B1B1B]">
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#111]">
              {tab.cols.map(c => (
                <th key={c.key} className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap" style={c.width ? { width: c.width } : undefined}>
                  {c.sortable ? (
                    <button onClick={() => toggleSort(c.key)} className="flex items-center gap-1 hover:text-primary">
                      {c.label}
                      {sortBy === c.key ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </button>
                  ) : c.label}
                </th>
              ))}
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300 w-[100px]">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={tab.cols.length + 1} className="text-center py-10 text-gray-400">加载中...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={tab.cols.length + 1} className="text-center py-10 text-gray-400">暂无数据</td></tr>
            ) : items.map(item => (
              <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#222]">
                {tab.cols.map(c => (
                  <td key={c.key} className="px-4 py-3 text-gray-700 dark:text-gray-300">{renderCell(item, c)}</td>
                ))}
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(item)} className="text-primary hover:text-primary/80 text-xs mr-3"><Pencil className="w-3.5 h-3.5 inline mr-0.5" />编辑</button>
                  <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-600 text-xs"><Trash2 className="w-3.5 h-3.5 inline mr-0.5" />删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 0 && (
        <div className="flex items-center justify-between mt-3 shrink-0">
          <span className="text-xs text-gray-400">共 {total} 条</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" /></button>
            <span className="text-sm text-gray-500 min-w-[60px] text-center">{page} / {totalPages || 1}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" /></button>
          </div>
        </div>
      )}

      <FormDialog open={dlgOpen} title={editData?.id ? '编辑' : '新增'} cols={tab.cols}
        data={editData} userMap={userMap} onClose={() => setDlgOpen(false)} onSave={handleSave} />
    </div>
  );
}

/* ═══════════════ Main ═══════════════ */
export default function WsMasterData() {
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const currentTab = TABS.find(t => t.key === activeTab) || TABS[0];

  return (
    <div className="h-full overflow-hidden bg-[#f4f5f8] dark:bg-[#111] flex flex-col p-5">
      <div className="flex items-center gap-6 border-b border-gray-200 dark:border-gray-700 mb-4 shrink-0">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        <MasterTable key={currentTab.key} tab={currentTab} />
      </div>
    </div>
  );
}
