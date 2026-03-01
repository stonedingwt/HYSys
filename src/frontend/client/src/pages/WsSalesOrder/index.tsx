import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pencil, X, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon,
  ArrowUpDown, ArrowUp, ArrowDown, Download, Filter, FilterX, FileSpreadsheet, ExternalLink,
} from 'lucide-react';

function fetchApi(path: string, opts?: RequestInit) {
  return fetch(`/api/v1${path}`, { credentials: 'include', ...opts }).then(r => r.json()).then(r => r?.data ?? r);
}
function putApi(path: string, body: any) {
  return fetchApi(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

interface ColDef { key: string; label: string; width?: number; type?: 'text' | 'number' | 'link'; hidden?: boolean; }

const HEADER_COLS: ColDef[] = [
  { key: 'customer_name', label: 'Customer name', width: 150 },
  { key: 'po', label: 'PO', width: 110 },
  { key: 'generic_article_no', label: 'Generic article no', width: 140 },
  { key: 'total_amount', label: 'Total amount', width: 120, type: 'number' },
  { key: 'total_pieces', label: 'Total pieces', width: 110, type: 'number' },
  { key: 'currency', label: 'Currency', width: 90 },
  { key: 'country', label: 'Country', width: 100 },
  { key: 'brand', label: 'Brand', width: 100 },
  { key: 'season', label: 'Season', width: 90 },
  { key: 'date_of_issue', label: 'D.ofissue', width: 110 },
  { key: 'cargo_delivery_date', label: 'Cargo delivery date', width: 150 },
  { key: 'presentation_date', label: 'Presentation date', width: 140 },
  { key: 'article_description', label: 'Article description', width: 160 },
  { key: 'factory', label: 'Factory', width: 120 },
  { key: 'delivery_at', label: 'Delivery At', width: 130 },
  { key: 'payment_terms', label: 'Payment Terms', width: 130 },
  { key: 'delivery_terms', label: 'Delivery Terms', width: 130 },
  { key: 'reference', label: 'Reference', width: 120 },
];

const VISIBLE_HEADER_COLS = HEADER_COLS.filter(c => !c.hidden);

const LINE_COLS: ColDef[] = [
  { key: 'article', label: 'Article', width: 110 },
  { key: 'colour', label: 'Colour', width: 100 },
  { key: 'size', label: 'Size', width: 80 },
  { key: 'quantity', label: 'Quantity', width: 100, type: 'number' },
  { key: 'tot_pieces', label: 'Tot.Pieces', width: 110, type: 'number' },
  { key: 'price_unit_buying', label: 'PriceUnit Buying', width: 140, type: 'number' },
  { key: 'position', label: 'Position', width: 110 },
  { key: 'description', label: 'Description', width: 160 },
  { key: 'dc', label: 'DC', width: 80 },
  { key: 'warehouse', label: 'Warehouse', width: 120 },
  { key: 'flow', label: 'Flow', width: 100 },
  { key: 'destination', label: 'Destination', width: 130 },
  { key: 'ean', label: 'EAN', width: 140 },
];

function buildFilterParams(filters: Record<string, string>) {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(filters)) {
    if (v) parts.push(`f_${k}=${encodeURIComponent(v)}`);
  }
  return parts.join('&');
}

function EditDialog({ open, title, cols, data, onClose, onSave }: {
  open: boolean; title: string; cols: ColDef[]; data: Record<string, any> | null;
  onClose(): void; onSave(d: Record<string, any>): void;
}) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(data ? { ...data } : {}); }, [data, open]);
  if (!open) return null;
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-[#1B1B1B] rounded-lg shadow-xl w-[640px] max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {cols.filter(c => c.type !== 'link').map(col => (
            <div key={col.key}>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{col.label}</label>
              <input
                type={col.type === 'number' ? 'number' : 'text'}
                value={form[col.key] ?? ''}
                onChange={e => set(col.key, col.type === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value)}
                className="w-full px-3 py-1.5 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
          <button disabled={saving} onClick={async () => {
            setSaving(true); await onSave(form); setSaving(false);
          }} className="px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50">{saving ? '保存中...' : '确定'}</button>
        </div>
      </div>
    </div>
  );
}

function LineItems({ headerId }: { headerId: number }) {
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchApi(`/sales-order/lines?header_id=${headerId}`)
      .then(data => { setLines(Array.isArray(data) ? data : []); })
      .catch(() => setLines([]))
      .finally(() => setLoading(false));
  }, [headerId]);

  const handleSave = async (d: Record<string, any>) => {
    await putApi('/sales-order/update-line', d);
    setEditOpen(false);
    const data = await fetchApi(`/sales-order/lines?header_id=${headerId}`);
    setLines(Array.isArray(data) ? data : []);
  };

  const lineTableWidth = LINE_COLS.reduce((s, c) => s + (c.width || 120), 0) + 80;

  return (
    <div className="bg-blue-50/50 dark:bg-[#1a1a2a] border-t border-gray-200 dark:border-gray-700">
      <div className="px-6 py-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">明细行</p>
        {loading ? (
          <p className="text-xs text-gray-400 py-3">加载中...</p>
        ) : lines.length === 0 ? (
          <p className="text-xs text-gray-400 py-3">暂无明细行</p>
        ) : (
          <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
            <table className="text-xs" style={{ minWidth: `${lineTableWidth}px` }}>
              <thead>
                <tr className="bg-gray-100 dark:bg-[#252535]">
                  {LINE_COLS.map(c => (
                    <th key={c.key} className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap"
                      style={{ width: c.width, minWidth: c.width }}>{c.label}</th>
                  ))}
                  <th className="text-center px-3 py-2 font-medium text-gray-600 dark:text-gray-300 w-[80px]">操作</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => (
                  <tr key={line.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-white/60 dark:hover:bg-[#222] transition-colors">
                    {LINE_COLS.map(c => (
                      <td key={c.key} className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap"
                        style={{ width: c.width, minWidth: c.width }}>
                        <span className="block truncate" style={{ maxWidth: (c.width || 120) - 24 }} title={line[c.key] ?? ''}>{line[c.key] ?? '-'}</span>
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => { setEditData({ ...line }); setEditOpen(true); }}
                        className="text-primary hover:text-primary/80 text-xs"><Pencil className="w-3 h-3 inline mr-0.5" />编辑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <EditDialog open={editOpen} title="编辑明细行" cols={LINE_COLS} data={editData}
        onClose={() => setEditOpen(false)} onSave={handleSave} />
    </div>
  );
}

export default function WsSalesOrder() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<Record<string, any> | null>(null);
  const pageSize = 15;
  const tableRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = useMemo(() => Object.values(filters).filter(Boolean).length, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fp = buildFilterParams(filters);
      const r = await fetchApi(`/sales-order/list?page_num=${page}&page_size=${pageSize}&sort_by=${sortBy}&sort_order=${sortOrder}${fp ? '&' + fp : ''}`);
      setItems(r?.data || []); setTotal(r?.total || 0);
    } catch { setItems([]); }
    setLoading(false);
  }, [filters, page, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortOrder('asc'); }
    setPage(1);
  };

  const setFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => { setFilters({}); setPage(1); };

  const handleExport = async () => {
    setExporting(true);
    try {
      const fp = buildFilterParams(filters);
      const url = `/api/v1/sales-order/export?sort_by=${sortBy}&sort_order=${sortOrder}${fp ? '&' + fp : ''}`;
      const resp = await fetch(url, { credentials: 'include' });
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'sales_orders.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { /* ignore */ }
    setExporting(false);
  };

  const handleDownloadOrder = async (headerId: number, po: string) => {
    try {
      const resp = await fetch(`/api/v1/sales-order/download?header_id=${headerId}`, { credentials: 'include' });
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `order_${po || headerId}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { /* ignore */ }
  };

  const handleDownloadPackingList = async (headerId: number, po: string) => {
    try {
      const resp = await fetch(`/api/v1/sales-order/packing-list?header_id=${headerId}`, { credentials: 'include' });
      if (!resp.ok) return;
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `packing_list_${po || headerId}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { /* ignore */ }
  };

  const handleHeaderSave = async (d: Record<string, any>) => {
    await putApi('/sales-order/update-header', d);
    setEditOpen(false);
    load();
  };

  const totalPages = Math.ceil(total / pageSize);
  const totalWidth = VISIBLE_HEADER_COLS.reduce((sum, c) => sum + (c.width || 120), 0) + 220;

  return (
    <div className="h-full overflow-hidden bg-[#f4f5f8] dark:bg-[#111] flex flex-col p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">销售订单</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'border-primary text-primary bg-primary/5 dark:bg-primary/10'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            筛选{activeFilterCount > 0 && <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-primary text-white">{activeFilterCount}</span>}
          </button>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-red-500 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700" title="清除所有筛选">
              <FilterX className="w-4 h-4" /> 清除
            </button>
          )}
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
            <Download className="w-4 h-4" /> {exporting ? '导出中...' : '导出'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div ref={tableRef} className="flex-1 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1B1B1B] scrollbar-thin" style={{ scrollbarWidth: 'thin' }}>
        <table className="text-sm" style={{ minWidth: `${totalWidth}px` }}>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#222]">
              <th className="w-[40px] min-w-[40px] px-2 py-2.5 sticky left-0 z-20 bg-gray-50 dark:bg-[#222]"></th>
              <th className="text-center px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 w-[180px] min-w-[180px] sticky left-[40px] z-20 bg-gray-50 dark:bg-[#222] border-r border-gray-200 dark:border-gray-700">操作</th>
              {VISIBLE_HEADER_COLS.map(c => (
                <th key={c.key} className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap"
                  style={{ width: c.width, minWidth: c.width }}>
                  <button onClick={() => toggleSort(c.key)} className="flex items-center gap-1 hover:text-primary transition-colors">
                    <span className="truncate">{c.label}</span>
                    {sortBy === c.key ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 shrink-0 text-primary" /> : <ArrowDown className="w-3 h-3 shrink-0 text-primary" />) : <ArrowUpDown className="w-3 h-3 shrink-0 opacity-30" />}
                  </button>
                </th>
              ))}
            </tr>
            {showFilters && (
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-[#1a1a1a]">
                <th className="w-[40px] min-w-[40px] sticky left-0 z-20 bg-gray-50/50 dark:bg-[#1a1a1a]"></th>
                <th className="w-[180px] min-w-[180px] sticky left-[40px] z-20 bg-gray-50/50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-gray-700"></th>
                {VISIBLE_HEADER_COLS.map(c => (
                  <th key={c.key} className="px-2 py-1.5" style={{ width: c.width, minWidth: c.width }}>
                    <input type="text" value={filters[c.key] || ''} onChange={e => setFilter(c.key, e.target.value)}
                      placeholder="筛选..."
                      className="w-full px-2 py-1 text-xs border rounded border-gray-200 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-gray-400 dark:placeholder:text-gray-500" />
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={VISIBLE_HEADER_COLS.length + 2} className="text-center py-16 text-gray-400">加载中...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={VISIBLE_HEADER_COLS.length + 2} className="text-center py-16 text-gray-400">暂无数据</td></tr>
            ) : items.map(item => {
              const isExpanded = expandedId === item.id;
              return (
                <Fragment key={item.id}>
                  <tr
                    className={`border-b transition-colors cursor-pointer ${
                      isExpanded
                        ? 'bg-blue-50 dark:bg-[#1a1a2a] border-gray-200 dark:border-gray-700'
                        : 'hover:bg-gray-50 dark:hover:bg-[#222] border-gray-100 dark:border-gray-800'
                    }`}
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    <td className={`w-[40px] min-w-[40px] px-2 py-2.5 text-center sticky left-0 z-10 ${isExpanded ? 'bg-blue-50 dark:bg-[#1a1a2a]' : 'bg-white dark:bg-[#1B1B1B]'}`}>
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-primary inline" />
                        : <ChevronRightIcon className="w-4 h-4 text-gray-400 inline" />}
                    </td>
                    <td className={`px-3 py-2.5 text-center w-[180px] min-w-[180px] sticky left-[40px] z-10 border-r border-gray-100 dark:border-gray-800 ${isExpanded ? 'bg-blue-50 dark:bg-[#1a1a2a]' : 'bg-white dark:bg-[#1B1B1B]'}`} onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleDownloadPackingList(item.id, item.po)}
                          className="text-green-600 hover:text-green-700 text-xs font-medium flex items-center gap-0.5" title="下载装箱单">
                          <FileSpreadsheet className="w-3.5 h-3.5" /><span className="hidden xl:inline">装箱单</span>
                        </button>
                        <button onClick={() => handleDownloadOrder(item.id, item.po)}
                          className="text-gray-500 hover:text-primary text-xs" title="下载订单">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { setEditData({ ...item }); setEditOpen(true); }}
                          className="text-primary hover:text-primary/80 text-xs" title="编辑">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {item.packing_list_url && (
                          <a href={item.packing_list_url} target="_blank" rel="noreferrer"
                            className="text-gray-500 hover:text-blue-600 text-xs" title="查看装箱单"
                            onClick={e => e.stopPropagation()}>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    {VISIBLE_HEADER_COLS.map(c => (
                      <td key={c.key} className="px-3 py-2.5 text-gray-700 dark:text-gray-300 whitespace-nowrap"
                        style={{ width: c.width, minWidth: c.width }}>
                        <span className="block truncate text-sm" style={{ maxWidth: (c.width || 120) - 24 }} title={item[c.key] ?? ''}>
                          {item[c.key] ?? '-'}
                        </span>
                      </td>
                    ))}
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={VISIBLE_HEADER_COLS.length + 2} className="p-0">
                        <LineItems headerId={item.id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 shrink-0">
        <span className="text-xs text-gray-400">共 {total} 条{activeFilterCount > 0 && `（已筛选 ${activeFilterCount} 个字段）`}</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700">
            <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
          <span className="text-sm text-gray-500 min-w-[60px] text-center">{page} / {totalPages || 1}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700">
            <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      <EditDialog open={editOpen} title="编辑订单" cols={HEADER_COLS} data={editData}
        onClose={() => setEditOpen(false)} onSave={handleHeaderSave} />
    </div>
  );
}
