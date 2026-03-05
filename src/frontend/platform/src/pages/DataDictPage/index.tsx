import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Pencil, Trash2, X, Search, ChevronLeft, ChevronRight as ChevronRightIcon,
  ChevronDown, ChevronRight, FolderTree, Upload, Download, FileUp,
  ArrowUpDown, ArrowUp, ArrowDown, Filter,
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

interface CatNode {
  id: number; parent_id: number | null; cat_code: string; cat_name: string;
  sort_order: number; status: number; remark: string | null; children?: CatNode[];
}
interface DictItemRow {
  id: number; parent_id: number | null; category_id: number;
  item_label: string; item_value: string; sort_order: number;
  status: number; remark: string | null;
  parent_label?: string; parent_value?: string;
}

function CatTreeNode({ node, level = 0, selected, onSelect, onAdd, onEdit, onDelete }: {
  node: CatNode; level?: number; selected: number | null;
  onSelect(id: number): void; onAdd(pid: number): void; onEdit(n: CatNode): void; onDelete(id: number): void;
}) {
  const [open, setOpen] = useState(true);
  const has = node.children && node.children.length > 0;
  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer group text-sm ${
          selected === node.id
            ? 'bg-primary/10 dark:bg-[#2a2a3a] text-primary font-medium'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        <span className="w-4 shrink-0" onClick={e => { e.stopPropagation(); setOpen(!open); }}>
          {has ? (open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : null}
        </span>
        <FolderTree className="w-3.5 h-3.5 shrink-0 text-gray-400" />
        <span className="truncate flex-1">{node.cat_name}</span>
        <span className="text-[10px] text-gray-400 shrink-0 hidden group-hover:inline">{node.cat_code}</span>
        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 ml-1">
          <button onClick={e => { e.stopPropagation(); onAdd(node.id); }} className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="添加子分类"><Plus className="w-3 h-3" /></button>
          <button onClick={e => { e.stopPropagation(); onEdit(node); }} className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="编辑"><Pencil className="w-3 h-3" /></button>
          <button onClick={e => { e.stopPropagation(); onDelete(node.id); }} className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500" title="删除"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>
      {open && has && node.children!.map(c => (
        <CatTreeNode key={c.id} node={c} level={level + 1} selected={selected}
          onSelect={onSelect} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

function CatDialog({ open, parentId, edit, allCats, onClose, onSave }: {
  open: boolean; parentId: number | null; edit: CatNode | null;
  allCats: CatNode[]; onClose(): void; onSave(d: any): void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [remark, setRemark] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  useEffect(() => {
    if (edit) { setCode(edit.cat_code); setName(edit.cat_name); setRemark(edit.remark || ''); setSortOrder(edit.sort_order); }
    else { setCode(''); setName(''); setRemark(''); setSortOrder(0); }
  }, [edit, open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-[#1B1B1B] rounded-lg shadow-xl w-[420px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">{edit ? '编辑分类' : '新建分类'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">分类编码 <span className="text-red-500">*</span></label>
            <input value={code} onChange={e => setCode(e.target.value)} disabled={!!edit}
              className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50" placeholder="英文编码，如 gender" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">分类名称 <span className="text-red-500">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" placeholder="如：性别" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">排序</label>
            <input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">备注</label>
            <input value={remark} onChange={e => setRemark(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" placeholder="选填" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
          <button onClick={() => {
            if (!code.trim() || !name.trim()) return;
            onSave({
              cat_code: code.trim(), cat_name: name.trim(), sort_order: sortOrder,
              remark: remark.trim() || null,
              parent_id: edit ? edit.parent_id : parentId,
              ...(edit ? { id: edit.id } : {}),
            });
          }} className="px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90">确定</button>
        </div>
      </div>
    </div>
  );
}

function ItemDialog({ open, edit, categoryId, flatCats, itemsInCat, onClose, onSave }: {
  open: boolean; edit: DictItemRow | null; categoryId: number;
  flatCats: { id: number; cat_name: string; cat_code: string }[];
  itemsInCat: DictItemRow[];
  onClose(): void; onSave(d: any): void;
}) {
  const [catId, setCatId] = useState(categoryId);
  const [parentId, setParentId] = useState<number | null>(null);
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [status, setStatus] = useState(1);
  const [remark, setRemark] = useState('');
  const [allItems, setAllItems] = useState<{ catName: string; items: DictItemRow[] }[]>([]);

  useEffect(() => {
    if (edit) {
      setCatId(edit.category_id); setParentId(edit.parent_id); setLabel(edit.item_label);
      setValue(edit.item_value); setSortOrder(edit.sort_order); setStatus(edit.status);
      setRemark(edit.remark || '');
    } else {
      setCatId(categoryId); setParentId(null); setLabel(''); setValue('');
      setSortOrder(0); setStatus(1); setRemark('');
    }
  }, [edit, open, categoryId]);

  useEffect(() => {
    if (!open) return;
    Promise.all(
      flatCats.map(c =>
        fetchApi(`/data-dict/item/list?category_id=${c.id}&page_num=1&page_size=500`)
          .then(r => ({ catName: c.cat_name, items: (r?.data || []) as DictItemRow[] }))
      )
    ).then(setAllItems);
  }, [open, flatCats]);

  if (!open) return null;

  const parentOptions = itemsInCat.filter(i => !edit || i.id !== edit.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-[#1B1B1B] rounded-lg shadow-xl w-[480px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">{edit ? '编辑字典项' : '新增字典项'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">所属分类 <span className="text-red-500">*</span></label>
            <select value={catId} onChange={e => setCatId(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary">
              {flatCats.map(c => <option key={c.id} value={c.id}>{c.cat_name} ({c.cat_code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">父字典项</label>
            <select value={parentId ?? ''} onChange={e => setParentId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">无（顶级项）</option>
              {parentOptions.length > 0 && (
                <optgroup label="当前分类">
                  {parentOptions.map(i => <option key={i.id} value={i.id}>{i.item_label} ({i.item_value})</option>)}
                </optgroup>
              )}
              {allItems.filter(g => g.items.length > 0 && g.items[0].category_id !== catId).map(g => (
                <optgroup key={g.catName} label={g.catName}>
                  {g.items.filter(i => !edit || i.id !== edit?.id).map(i => (
                    <option key={i.id} value={i.id}>{i.item_label} ({i.item_value})</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">标签 <span className="text-red-500">*</span></label>
              <input value={label} onChange={e => setLabel(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" placeholder="如：男" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">值 <span className="text-red-500">*</span></label>
              <input value={value} onChange={e => setValue(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" placeholder="如：male" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">排序</label>
              <input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">状态</label>
              <select value={status} onChange={e => setStatus(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary">
                <option value={1}>启用</option>
                <option value={0}>禁用</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">备注</label>
            <input value={remark} onChange={e => setRemark(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" placeholder="选填" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
          <button onClick={() => {
            if (!label.trim() || !value.trim() || !catId) return;
            onSave({
              category_id: catId, parent_id: parentId, item_label: label.trim(),
              item_value: value.trim(), sort_order: sortOrder, status, remark: remark.trim() || null,
              ...(edit ? { id: edit.id } : {}),
            });
          }} className="px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90">确定</button>
        </div>
      </div>
    </div>
  );
}

function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose(): void; onDone(): void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setFile(null); setResult(null); } }, [open]);
  if (!open) return null;

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const resp = await fetch('/api/v1/data-dict/import', { method: 'POST', credentials: 'include', body: fd });
      const json = await resp.json();
      const data = json?.data ?? json;
      setResult(data);
      if (data?.success > 0) onDone();
    } catch { setResult({ success: 0, failed: 0, errors: ['上传失败'] }); }
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-[#1B1B1B] rounded-lg shadow-xl w-[500px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">批量导入</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4" /></button>
        </div>

        <div className="mb-4 p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <p className="font-medium">文件格式要求（CSV 或 Excel）：</p>
          <p>必填列：<code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">cat_code</code>, <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">cat_name</code>, <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">item_label</code>, <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">item_value</code></p>
          <p>可选列：<code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">parent_cat_code</code>, <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">parent_item_value</code>, <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">sort_order</code>, <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">remark</code></p>
        </div>

        {!result ? (
          <>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors border-gray-300 dark:border-gray-600 hover:border-primary dark:hover:border-primary"
            >
              <FileUp className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              {file ? (
                <p className="text-sm text-gray-700 dark:text-gray-300">{file.name} <span className="text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span></p>
              ) : (
                <p className="text-sm text-gray-400">点击或拖拽 CSV / Excel 文件到此处</p>
              )}
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
              <button disabled={!file || uploading} onClick={handleUpload}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50">
                <Upload className="w-4 h-4" /> {uploading ? '导入中...' : '开始导入'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg border p-4 space-y-2 border-gray-200 dark:border-gray-700">
              <p className="text-sm"><span className="text-green-600 font-medium">成功：{result.success} 条</span></p>
              {result.failed > 0 && <p className="text-sm"><span className="text-red-500 font-medium">失败：{result.failed} 条</span></p>}
              {result.errors.length > 0 && (
                <div className="mt-2 max-h-[120px] overflow-auto text-xs text-red-500 space-y-0.5">
                  {result.errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
            </div>
            <div className="flex justify-end mt-5">
              <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90">完成</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function flattenCats(tree: CatNode[]): { id: number; cat_name: string; cat_code: string }[] {
  const result: { id: number; cat_name: string; cat_code: string }[] = [];
  const walk = (nodes: CatNode[], prefix = '') => {
    for (const n of nodes) {
      result.push({ id: n.id, cat_name: prefix + n.cat_name, cat_code: n.cat_code });
      if (n.children?.length) walk(n.children, prefix + n.cat_name + ' / ');
    }
  };
  walk(tree);
  return result;
}

export default function DataDictPage() {
  const [catTree, setCatTree] = useState<CatNode[]>([]);
  const [selCat, setSelCat] = useState<number | null>(null);
  const [catSearch, setCatSearch] = useState('');

  const [catDlgOpen, setCatDlgOpen] = useState(false);
  const [catDlgParent, setCatDlgParent] = useState<number | null>(null);
  const [catDlgEdit, setCatDlgEdit] = useState<CatNode | null>(null);

  const [items, setItems] = useState<DictItemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);

  const [itemDlgOpen, setItemDlgOpen] = useState(false);
  const [itemDlgEdit, setItemDlgEdit] = useState<DictItemRow | null>(null);
  const [itemsInCat, setItemsInCat] = useState<DictItemRow[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [filterParentId, setFilterParentId] = useState<number | ''>('');
  const [parentFilterOptions, setParentFilterOptions] = useState<{ id: number; label: string; value: string; catName: string }[]>([]);

  const loadCats = useCallback(async () => {
    try {
      const tree = await fetchApi('/data-dict/category/tree');
      setCatTree(tree ?? []);
    } catch { /* */ }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/data-dict/item/list?category_id=${selCat || 0}&keyword=${encodeURIComponent(keyword)}&page_num=${page}&page_size=${pageSize}&sort_by=${sortBy}&sort_order=${sortOrder}`;
      if (filterParentId !== '') url += `&parent_id=${filterParentId}`;
      const r = await fetchApi(url);
      setItems(r?.data || []); setTotal(r?.total || 0);
    } catch { setItems([]); }
    setLoading(false);
  }, [selCat, keyword, page, pageSize, sortBy, sortOrder, filterParentId]);

  useEffect(() => { loadCats(); }, []);
  useEffect(() => { loadItems(); }, [loadItems]);

  useEffect(() => {
    if (selCat) {
      fetchApi(`/data-dict/item/list?category_id=${selCat}&page_num=1&page_size=500`).then(r => setItemsInCat(r?.data || []));
    } else {
      setItemsInCat([]);
    }
  }, [selCat, items]);

  useEffect(() => {
    if (flatCats.length === 0) { setParentFilterOptions([]); return; }
    const catsToLoad = selCat ? flatCats.filter(c => c.id === selCat) : flatCats;
    Promise.all(
      catsToLoad.map(c =>
        fetchApi(`/data-dict/item/list?category_id=${c.id}&page_num=1&page_size=500`)
          .then(r => ((r?.data || []) as DictItemRow[]).map(i => ({ id: i.id, label: i.item_label, value: i.item_value, catName: c.cat_name })))
      )
    ).then(groups => setParentFilterOptions(groups.flat()));
  }, [flatCats, selCat]);

  const flatCats = useMemo(() => flattenCats(catTree), [catTree]);

  const catMap = useMemo(() => {
    const m: Record<number, CatNode> = {};
    const walk = (ns: CatNode[]) => { for (const n of ns) { m[n.id] = n; if (n.children) walk(n.children); } };
    walk(catTree); return m;
  }, [catTree]);

  const filteredTree = useMemo(() => {
    if (!catSearch) return catTree;
    const q = catSearch.toLowerCase();
    const filterNodes = (nodes: CatNode[]): CatNode[] => {
      return nodes.reduce<CatNode[]>((acc, n) => {
        const childMatch = n.children ? filterNodes(n.children) : [];
        if (n.cat_name.toLowerCase().includes(q) || n.cat_code.toLowerCase().includes(q) || childMatch.length > 0) {
          acc.push({ ...n, children: childMatch.length > 0 ? childMatch : n.children });
        }
        return acc;
      }, []);
    };
    return filterNodes(catTree);
  }, [catTree, catSearch]);

  const addCat = (pid: number | null) => { setCatDlgEdit(null); setCatDlgParent(pid); setCatDlgOpen(true); };
  const editCat = (n: CatNode) => { setCatDlgEdit(n); setCatDlgParent(n.parent_id); setCatDlgOpen(true); };
  const deleteCat = async (id: number) => {
    if (!confirm('删除此分类将同时删除所有子分类和关联的字典项，确定删除？')) return;
    await delApi(`/data-dict/category/delete?id=${id}`);
    if (selCat === id) setSelCat(null);
    loadCats(); loadItems();
  };
  const saveCat = async (d: any) => {
    if (d.id) await putApi('/data-dict/category/update', d);
    else await postApi('/data-dict/category/create', d);
    setCatDlgOpen(false); loadCats();
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortOrder('asc'); }
    setPage(1);
  };

  const openCreateItem = () => { setItemDlgEdit(null); setItemDlgOpen(true); };
  const openEditItem = (item: DictItemRow) => { setItemDlgEdit(item); setItemDlgOpen(true); };
  const deleteItem = async (id: number) => {
    if (!confirm('删除此字典项将同时删除所有子项，确定删除？')) return;
    await delApi(`/data-dict/item/delete?id=${id}`); loadItems();
  };
  const saveItem = async (d: any) => {
    if (d.id) await putApi('/data-dict/item/update', d);
    else await postApi('/data-dict/item/create', d);
    setItemDlgOpen(false); loadItems();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const url = `/api/v1/data-dict/export?category_id=${selCat || 0}&keyword=${encodeURIComponent(keyword)}`;
      const resp = await fetch(url, { credentials: 'include' });
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'data_dict.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { /* */ }
    setExporting(false);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="h-full overflow-hidden bg-[#f4f5f8] dark:bg-[#111] flex rounded-lg">
      {/* 左侧 分类树 */}
      <div className="w-[260px] shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1B1B1B] flex flex-col h-full">
        <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">字典分类</h3>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder="搜索分类..."
              className="w-full pl-7 pr-3 py-1.5 text-xs border rounded-md border-gray-200 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <button onClick={() => addCat(null)}
            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-md border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 hover:border-primary hover:text-primary">
            <Plus className="w-3 h-3" /> 新建分类
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div
            className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm mb-1 ${
              selCat === null
                ? 'bg-primary/10 dark:bg-[#2a2a3a] text-primary font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            onClick={() => { setSelCat(null); setPage(1); setFilterParentId(''); }}
          >
            <FolderTree className="w-4 h-4" /><span>全部</span>
          </div>
          {filteredTree.map(n => (
            <CatTreeNode key={n.id} node={n} selected={selCat} onSelect={id => { setSelCat(id); setPage(1); setFilterParentId(''); }}
              onAdd={pid => addCat(pid)} onEdit={editCat} onDelete={deleteCat} />
          ))}
          {filteredTree.length === 0 && catTree.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">暂无分类，请先新建</p>
          )}
        </div>
      </div>

      {/* 右侧 字典项 */}
      <div className="flex-1 flex flex-col h-full overflow-hidden p-5">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {selCat && catMap[selCat] ? catMap[selCat].cat_name : '全部字典项'}
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="搜索标签/值..." value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }}
                className="w-full pl-8 pr-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <select
                value={filterParentId}
                onChange={e => { setFilterParentId(e.target.value === '' ? '' : Number(e.target.value)); setPage(1); }}
                className={`pl-7 pr-8 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary appearance-none max-w-[200px] truncate ${filterParentId !== '' ? 'ring-1 ring-primary border-primary' : ''}`}
              >
                <option value="">全部父项</option>
                {parentFilterOptions.map(p => (
                  <option key={p.id} value={p.id}>{p.label} ({p.value})</option>
                ))}
              </select>
              {filterParentId !== '' && (
                <button
                  onClick={() => { setFilterParentId(''); setPage(1); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              )}
            </div>
            <button onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              <Upload className="w-4 h-4" /> 导入
            </button>
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
              <Download className="w-4 h-4" /> {exporting ? '导出中...' : '导出'}
            </button>
            <button onClick={openCreateItem} disabled={flatCats.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50">
              <Plus className="w-4 h-4" /> 新增
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1B1B1B]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#222]">
                {!selCat && <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300 w-[120px]">分类</th>}
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                  <button onClick={() => toggleSort('item_label')} className="flex items-center gap-1 hover:text-primary">
                    标签 {sortBy === 'item_label' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                  <button onClick={() => toggleSort('item_value')} className="flex items-center gap-1 hover:text-primary">
                    值 {sortBy === 'item_value' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300 w-[100px]">父项</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300 w-[70px]">
                  <button onClick={() => toggleSort('sort_order')} className="flex items-center gap-1 hover:text-primary">
                    排序 {sortBy === 'sort_order' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300 w-[70px]">状态</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">备注</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300 w-[100px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={selCat ? 7 : 8} className="text-center py-16 text-gray-400">加载中...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={selCat ? 7 : 8} className="text-center py-16 text-gray-400">暂无数据</td></tr>
              ) : items.map(item => (
                <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors">
                  {!selCat && (
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      <span className="inline-flex px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        {catMap[item.category_id]?.cat_name || '-'}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">{item.item_label}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">{item.item_value}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {item.parent_id ? (
                      item.parent_label
                        ? <span title={`ID: ${item.parent_id}`}>{item.parent_label} <span className="text-gray-400">({item.parent_value})</span></span>
                        : `#${item.parent_id}`
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{item.sort_order}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-medium ${
                      item.status === 1
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                    }`}>
                      {item.status === 1 ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[150px]">{item.remark || '-'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEditItem(item)} className="text-primary hover:text-primary/80 text-xs mr-3">
                      <Pencil className="w-3.5 h-3.5 inline mr-0.5" />编辑
                    </button>
                    <button onClick={() => deleteItem(item.id)} className="text-red-500 hover:text-red-600 text-xs">
                      <Trash2 className="w-3.5 h-3.5 inline mr-0.5" />删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 0 && (
          <div className="flex items-center justify-between mt-3 shrink-0">
            <span className="text-xs text-gray-400">共 {total} 条</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">每页</span>
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="px-2 py-1 text-xs border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary">
                  {[15, 50, 100, 200, 500].map(n => <option key={n} value={n}>{n} 条</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </button>
                <span className="text-sm text-gray-500 min-w-[60px] text-center">{page} / {totalPages || 1}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <ChevronRightIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <CatDialog open={catDlgOpen} parentId={catDlgParent} edit={catDlgEdit}
        allCats={flatCats} onClose={() => setCatDlgOpen(false)} onSave={saveCat} />
      <ItemDialog open={itemDlgOpen} edit={itemDlgEdit} categoryId={selCat || (flatCats[0]?.id ?? 0)}
        flatCats={flatCats} itemsInCat={itemsInCat}
        onClose={() => setItemDlgOpen(false)} onSave={saveItem} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={() => { loadCats(); loadItems(); }} />
    </div>
  );
}
