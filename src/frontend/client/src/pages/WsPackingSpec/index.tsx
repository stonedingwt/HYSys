import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Pencil, Trash2, X, Save, Loader2, RefreshCw,
  ChevronLeft, ChevronRight, Search, Package,
} from 'lucide-react';

interface PackingSpec {
  id: number;
  customer_name?: string;
  customer_id?: number;
  article_no?: string;
  box_carton?: string;
  box_max?: number;
  box_volume?: number;
  net_weight?: number;
  gross_weight?: number;
  bag_size?: string;
  box_height?: number;
  remark?: string;
  create_time?: string;
  update_time?: string;
}

interface CustomerOption {
  id: number;
  customer_code: string;
  customer_name: string;
  short_name: string;
}

const EMPTY_SPEC: Omit<PackingSpec, 'id'> = {
  customer_name: '',
  customer_id: undefined,
  article_no: '',
  box_carton: '',
  box_max: 50,
  box_volume: undefined,
  net_weight: undefined,
  gross_weight: undefined,
  bag_size: '',
  box_height: undefined,
  remark: '',
};

const FIELDS: { key: keyof PackingSpec; label: string; type: 'text' | 'number' | 'customer'; width: string; placeholder?: string }[] = [
  { key: 'customer_name', label: '客户名称', type: 'customer', width: '200px', placeholder: '选择客户' },
  { key: 'article_no', label: '款号', type: 'text', width: '120px', placeholder: '货号/款号' },
  { key: 'box_carton', label: '纸箱尺寸', type: 'text', width: '120px', placeholder: '如 59*39*30' },
  { key: 'box_max', label: '每箱最大数', type: 'number', width: '90px' },
  { key: 'box_volume', label: '体积(m³)', type: 'number', width: '90px' },
  { key: 'net_weight', label: '净重(kg)', type: 'number', width: '80px' },
  { key: 'gross_weight', label: '毛重(kg)', type: 'number', width: '80px' },
  { key: 'bag_size', label: '胶袋尺寸', type: 'text', width: '100px' },
  { key: 'box_height', label: '箱高(cm)', type: 'number', width: '80px' },
  { key: 'remark', label: '备注', type: 'text', width: '150px' },
];

const PAGE_SIZE = 20;

export default function WsPackingSpec() {
  const [specs, setSpecs] = useState<PackingSpec[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<PackingSpec>>({});
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<Partial<PackingSpec>>({ ...EMPTY_SPEC });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/v1/packing-specs/customers', { credentials: 'include' })
      .then(r => r.json())
      .then(j => setCustomers(j?.data || []))
      .catch(() => {});
  }, []);

  const loadSpecs = useCallback(async (pg?: number, q?: string) => {
    const p = pg ?? page;
    const qs = new URLSearchParams();
    qs.set('page_num', String(p));
    qs.set('page_size', String(PAGE_SIZE));
    qs.set('sort_by', 'id');
    qs.set('sort_order', 'desc');
    const term = q ?? search;
    if (term) qs.set('customer_name', term);

    try {
      const resp = await fetch(`/api/v1/packing-specs?${qs}`, { credentials: 'include' });
      const json = await resp.json();
      setSpecs(json?.data?.list || []);
      setTotal(json?.data?.total || 0);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadSpecs(); }, []);

  const handleSearch = () => {
    setPage(1);
    setLoading(true);
    loadSpecs(1, search);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    setLoading(true);
    loadSpecs(p);
  };

  const startEdit = (spec: PackingSpec) => {
    setEditingId(spec.id);
    setEditForm({ ...spec });
    setCreating(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const resp = await fetch(`/api/v1/packing-specs/${editingId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const json = await resp.json();
      if (json?.status_code === 200) {
        setEditingId(null);
        setEditForm({});
        loadSpecs();
      } else {
        alert(json?.status_message || '保存失败');
      }
    } catch { alert('网络错误'); }
    setSaving(false);
  };

  const startCreate = () => {
    setCreating(true);
    setCreateForm({ ...EMPTY_SPEC });
    setEditingId(null);
  };

  const cancelCreate = () => {
    setCreating(false);
    setCreateForm({ ...EMPTY_SPEC });
  };

  const saveCreate = async () => {
    setSaving(true);
    try {
      const resp = await fetch('/api/v1/packing-specs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const json = await resp.json();
      if (json?.status_code === 200) {
        setCreating(false);
        setCreateForm({ ...EMPTY_SPEC });
        loadSpecs();
      } else {
        alert(json?.status_message || '创建失败');
      }
    } catch { alert('网络错误'); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    try {
      const resp = await fetch(`/api/v1/packing-specs/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await resp.json();
      if (json?.status_code === 200) {
        setDeleteConfirm(null);
        loadSpecs();
      } else {
        alert(json?.status_message || '删除失败');
      }
    } catch { alert('网络错误'); }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const renderInput = (
    field: typeof FIELDS[number],
    form: Partial<PackingSpec>,
    setForm: (f: Partial<PackingSpec>) => void,
  ) => {
    if (field.type === 'customer') {
      return (
        <select
          value={form.customer_id ?? ''}
          onChange={e => {
            const cid = e.target.value ? Number(e.target.value) : undefined;
            const cust = customers.find(c => c.id === cid);
            setForm({ ...form, customer_id: cid, customer_name: cust?.short_name || '' });
          }}
          className="w-full text-xs px-2 py-1.5 rounded border border-blue-300 dark:border-blue-600 bg-white dark:bg-[#222] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="">请选择客户</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>
              {c.short_name || c.customer_name} ({c.customer_code})
            </option>
          ))}
        </select>
      );
    }
    const val = form[field.key as keyof PackingSpec];
    return (
      <input
        type={field.type}
        value={val ?? ''}
        placeholder={field.placeholder}
        onChange={e => {
          const v = field.type === 'number'
            ? (e.target.value === '' ? undefined : Number(e.target.value))
            : e.target.value;
          setForm({ ...form, [field.key]: v });
        }}
        className="w-full text-xs px-2 py-1.5 rounded border border-blue-300 dark:border-blue-600 bg-white dark:bg-[#222] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
        step={field.type === 'number' ? 'any' : undefined}
      />
    );
  };

  return (
    <div className="h-full overflow-hidden bg-[#f4f5f8] dark:bg-[#111] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a2e] shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-5 h-5" />装箱单规格配置
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">管理不同客户/款号的装箱单规格参数（纸箱尺寸、装箱数、重量等）</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="搜索客户名称..."
              className="text-xs pl-8 pr-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#222] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary w-48"
            />
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <button onClick={handleSearch}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />搜索
          </button>
          <button onClick={startCreate}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md bg-primary text-white hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" />新增规格
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-[#1a1a2e] rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#222] border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-[50px]">ID</th>
                  {FIELDS.map(f => (
                    <th key={f.key} className="px-3 py-2.5 text-left font-medium text-gray-500" style={{ minWidth: f.width }}>
                      {f.label}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-[100px]">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {/* Create row */}
                {creating && (
                  <tr className="bg-blue-50/50 dark:bg-blue-900/10">
                    <td className="px-3 py-2 text-gray-400">新</td>
                    {FIELDS.map(f => (
                      <td key={f.key} className="px-3 py-2">
                        {renderInput(f, createForm, setCreateForm)}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <button onClick={saveCreate} disabled={saving}
                          className="flex items-center gap-0.5 text-green-600 hover:text-green-800 transition-colors disabled:opacity-50"
                          title="保存">
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={cancelCreate}
                          className="text-gray-400 hover:text-red-500 transition-colors" title="取消">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Data rows */}
                {loading && specs.length === 0 ? (
                  <tr>
                    <td colSpan={FIELDS.length + 2} className="py-10 text-center text-gray-400">
                      <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />加载中...
                    </td>
                  </tr>
                ) : specs.length === 0 ? (
                  <tr>
                    <td colSpan={FIELDS.length + 2} className="py-10 text-center text-gray-400">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />暂无规格数据，点击"新增规格"添加
                    </td>
                  </tr>
                ) : specs.map(spec => {
                  const isEditing = editingId === spec.id;
                  return (
                    <tr key={spec.id}
                      className={`hover:bg-gray-50 dark:hover:bg-[#222] transition-colors ${isEditing ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}`}>
                      <td className="px-3 py-2 text-gray-400">{spec.id}</td>
                      {FIELDS.map(f => (
                        <td key={f.key} className="px-3 py-2">
                          {isEditing ? (
                            renderInput(f, editForm, setEditForm)
                          ) : (
                            <span className="text-gray-700 dark:text-gray-200">
                              {spec[f.key as keyof PackingSpec] ?? '-'}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <button onClick={saveEdit} disabled={saving}
                              className="flex items-center gap-0.5 text-green-600 hover:text-green-800 transition-colors disabled:opacity-50"
                              title="保存">
                              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={cancelEdit}
                              className="text-gray-400 hover:text-red-500 transition-colors" title="取消">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : deleteConfirm === spec.id ? (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleDelete(spec.id)}
                              className="text-xs text-red-600 hover:text-red-800 font-medium transition-colors">
                              确认
                            </button>
                            <button onClick={() => setDeleteConfirm(null)}
                              className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => startEdit(spec)}
                              className="text-blue-500 hover:text-blue-700 transition-colors" title="编辑">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteConfirm(spec.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors" title="删除">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a1a2e]">
              <span className="text-xs text-gray-400">
                共 {total} 条，第 {page}/{totalPages} 页
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => handlePageChange(1)} disabled={page <= 1}
                  className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  首页
                </button>
                <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1}
                  className="p-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pg: number;
                  if (totalPages <= 5) pg = i + 1;
                  else if (page <= 3) pg = i + 1;
                  else if (page >= totalPages - 2) pg = totalPages - 4 + i;
                  else pg = page - 2 + i;
                  return (
                    <button key={pg} onClick={() => handlePageChange(pg)}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                        pg === page
                          ? 'bg-primary text-white border-primary'
                          : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}>
                      {pg}
                    </button>
                  );
                })}
                <button onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}
                  className="p-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handlePageChange(totalPages)} disabled={page >= totalPages}
                  className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  末页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
