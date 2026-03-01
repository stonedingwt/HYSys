import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload, FolderOpen, FileText, FileSpreadsheet, Play, X, CheckCircle2,
  AlertCircle, Loader2, ChevronDown, Eye, Clock, RefreshCw, XCircle,
  ChevronLeft, ChevronRight, RotateCcw, Ban, ArrowUpDown, ArrowUp, ArrowDown,
  Copy, Download,
} from 'lucide-react';

type FileType = 'tp' | 'sales_order' | 'unknown';

interface PendingFile {
  id: string;
  file: File;
  type: FileType;
}

interface HistoryItem {
  id: number;
  batch_id: string;
  file_name: string;
  file_url?: string;
  file_type: string;
  status: string;
  error_message?: string;
  result_summary?: string;
  create_time?: string;
}

const TP_KEYWORDS = ['tp', 'techpack', 'tech_pack', 'tech-pack', 'tech pack'];
const SO_KEYWORDS = ['po', 'order', 'sales', '订单', '销售', 'hkm', 'supplier'];

function detectType(name: string): FileType {
  const lower = name.toLowerCase();
  const ext = lower.includes('.') ? '.' + lower.split('.').pop() : '';
  if (TP_KEYWORDS.some(k => lower.includes(k))) return 'tp';
  if (SO_KEYWORDS.some(k => lower.includes(k))) return 'sales_order';
  if (ext === '.pdf') return 'sales_order';
  if (['.xlsx', '.xls', '.csv'].includes(ext)) return 'tp';
  return 'unknown';
}

const TYPE_LABELS: Record<string, string> = {
  tp: 'TP文件', sales_order: '销售订单', unknown: '未识别',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending:            { label: '等待解析',   color: 'text-gray-400',   icon: Clock },
  processing:         { label: '解析中',     color: 'text-blue-500',   icon: Loader2 },
  success:            { label: '解析成功',   color: 'text-green-600',  icon: CheckCircle2 },
  failed:             { label: '解析失败',   color: 'text-red-500',    icon: XCircle },
  upload_failed:      { label: '上传失败',   color: 'text-red-500',    icon: AlertCircle },
  cancelled:          { label: '已取消',     color: 'text-gray-400',   icon: Ban },
  skipped_duplicate:  { label: '重复跳过',   color: 'text-amber-500',  icon: Copy },
};

const STATUS_TABS = [
  { key: '', label: '全部' },
  { key: 'processing', label: '解析中' },
  { key: 'success', label: '成功' },
  { key: 'failed', label: '失败' },
  { key: 'skipped_duplicate', label: '重复' },
  { key: 'cancelled', label: '已取消' },
];

function formatTime(s?: string) {
  if (!s) return '-';
  try {
    const d = new Date(s);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return s; }
}

function parseHeaderIds(resultSummary?: string): number[] {
  if (!resultSummary) return [];
  try {
    const data = JSON.parse(resultSummary);
    if (Array.isArray(data?.header_ids)) return data.header_ids;
  } catch { /* ignore */ }
  return [];
}

async function downloadFile(url: string, filename: string) {
  try {
    const resp = await fetch(url, { credentials: 'include' });
    if (!resp.ok) return;
    const blob = await resp.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch { /* ignore */ }
}

const PAGE_SIZE = 15;

export default function WsOrderAssistant() {
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [globalType, setGlobalType] = useState<FileType | ''>('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [errorModal, setErrorModal] = useState<{ name: string; error: string } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<number | null>(null);
  const pollingBatchesRef = useRef<Set<string>>(new Set());

  const buildQuery = useCallback((page: number, status?: string, sBy?: string, sOrd?: string) => {
    const p = new URLSearchParams();
    p.set('page_num', String(page));
    p.set('page_size', String(PAGE_SIZE));
    p.set('sort_by', sBy ?? sortBy);
    p.set('sort_order', sOrd ?? sortOrder);
    const st = status ?? statusFilter;
    if (st) p.set('status', st);
    return p.toString();
  }, [sortBy, sortOrder, statusFilter]);

  const loadHistory = useCallback(async (page?: number, status?: string, sBy?: string, sOrd?: string) => {
    const pg = page ?? historyPage;
    try {
      const resp = await fetch(`/api/v1/order-assistant/parsing-logs?${buildQuery(pg, status, sBy, sOrd)}`, {
        credentials: 'include',
      });
      const json = await resp.json();
      const items: HistoryItem[] = json?.data?.list || [];
      const total: number = json?.data?.total || 0;
      setHistory(items);
      setHistoryTotal(total);

      const activeBatches = new Set<string>();
      for (const item of items) {
        if (item.status === 'pending' || item.status === 'processing') {
          activeBatches.add(item.batch_id);
        }
      }
      if (activeBatches.size > 0) {
        for (const b of activeBatches) pollingBatchesRef.current.add(b);
        startPolling();
      }
    } catch { /* ignore */ } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, buildQuery]);

  useEffect(() => {
    loadHistory();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const pollOnce = useCallback(async () => {
    if (pollingBatchesRef.current.size === 0) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }
    let anyChanged = false;
    const done: string[] = [];
    for (const batchId of Array.from(pollingBatchesRef.current)) {
      try {
        const resp = await fetch(`/api/v1/order-assistant/parsing-logs/${batchId}`, {
          credentials: 'include',
        });
        const json = await resp.json();
        const items: HistoryItem[] = json?.data || [];
        if (!items.length) continue;

        setHistory(prev => {
          const existingIds = new Set(items.map(i => i.id));
          const others = prev.filter(h => !existingIds.has(h.id) && h.batch_id !== batchId);
          const negatives = prev.filter(h => h.id < 0 && h.batch_id === batchId);
          const merged = negatives.length > 0
            ? [...items, ...others]
            : [...others.filter(h => h.batch_id !== batchId), ...items, ...others.filter(h => h.batch_id === batchId ? false : true)];
          const unique = new Map<number, HistoryItem>();
          for (const it of [...items, ...others]) unique.set(it.id, it);
          return Array.from(unique.values()).sort((a, b) => {
            if (sortBy === 'id') return sortOrder === 'desc' ? b.id - a.id : a.id - b.id;
            return sortOrder === 'desc' ? b.id - a.id : a.id - b.id;
          });
        });

        anyChanged = true;
        if (items.every(i => ['success', 'failed', 'upload_failed', 'cancelled'].includes(i.status))) {
          done.push(batchId);
        }
      } catch { /* ignore */ }
    }
    for (const b of done) pollingBatchesRef.current.delete(b);
    if (pollingBatchesRef.current.size === 0 && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, [sortBy, sortOrder]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = window.setInterval(pollOnce, 3000);
  }, [pollOnce]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const items: PendingFile[] = Array.from(files)
      .filter(f => f.size > 0)
      .map(f => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        type: detectType(f.name),
      }));
    if (items.length) setPending(prev => [...prev, ...items]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removePending = (id: string) => setPending(prev => prev.filter(i => i.id !== id));
  const changePendingType = (id: string, type: FileType) =>
    setPending(prev => prev.map(i => i.id === id ? { ...i, type } : i));

  const startProcessing = async () => {
    if (!pending.length || uploading) return;
    const hasUnknown = pending.some(f => (globalType || f.type) === 'unknown');
    if (hasUnknown) {
      alert('部分文件类型未识别，请手动选择文件类型后再开始处理');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const fd = new FormData();
    const fileTypes: string[] = [];
    for (const item of pending) {
      fd.append('files', item.file);
      fileTypes.push(globalType || item.type);
    }
    fd.append('file_types', JSON.stringify(fileTypes));

    try {
      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/v1/order-assistant/process');
        xhr.withCredentials = true;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error('响应解析失败')); }
        };
        xhr.onerror = () => reject(new Error('网络错误'));
        xhr.ontimeout = () => reject(new Error('上传超时'));
        xhr.timeout = 600000;
        xhr.send(fd);
      });

      const data = result?.data;
      if (data?.batch_id) {
        setPending([]);
        if (data.uploaded > 0) {
          pollingBatchesRef.current.add(data.batch_id);
          startPolling();
        }
        setHistoryPage(1);
        setStatusFilter('');
        loadHistory(1, '');

        const msgs: string[] = [];
        if (data.duplicate > 0) {
          const dupFiles = (data.results || [])
            .filter((r: any) => r.status === 'duplicate')
            .map((r: any) => r.file_name);
          msgs.push(`${data.duplicate} 个文件内容重复，已跳过:\n${dupFiles.join('\n')}`);
        }
        if (data.updated > 0) {
          msgs.push(`${data.updated} 个文件已更新，将重新解析并覆盖旧数据`);
        }
        if (msgs.length > 0) {
          alert(msgs.join('\n\n'));
        }
      } else {
        alert(result?.status_message || '提交失败');
      }
    } catch (err: any) {
      alert(err.message || '上传失败');
    }

    setUploading(false);
    setUploadProgress(0);
  };

  const cancelItem = async (logId: number) => {
    try {
      await fetch(`/api/v1/order-assistant/parsing-logs/${logId}/cancel`, {
        method: 'POST', credentials: 'include',
      });
      loadHistory();
    } catch { /* ignore */ }
  };

  const retryItem = async (logId: number) => {
    try {
      const resp = await fetch(`/api/v1/order-assistant/parsing-logs/${logId}/retry`, {
        method: 'POST', credentials: 'include',
      });
      const json = await resp.json();
      if (json?.data?.log_id) {
        const item = history.find(h => h.id === logId);
        if (item) {
          pollingBatchesRef.current.add(item.batch_id);
          startPolling();
        }
      }
      loadHistory();
    } catch { /* ignore */ }
  };

  const handleSort = (field: string) => {
    let newOrder: 'asc' | 'desc' = 'asc';
    if (sortBy === field) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    setSortBy(field);
    setSortOrder(newOrder);
    setHistoryPage(1);
    loadHistory(1, undefined, field, newOrder);
  };

  const handleStatusFilter = (st: string) => {
    setStatusFilter(st);
    setHistoryPage(1);
    loadHistory(1, st);
  };

  const handlePageChange = (page: number) => {
    setHistoryPage(page);
    loadHistory(page);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const totalPages = Math.max(1, Math.ceil(historyTotal / PAGE_SIZE));
  const isPolling = pollingBatchesRef.current.size > 0;

  return (
    <div className="h-full overflow-hidden bg-[#f4f5f8] dark:bg-[#111] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a2e] shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">跟单助手</h1>
          <p className="text-xs text-gray-500 mt-0.5">上传TP文件或销售订单PDF，系统自动识别并解析</p>
        </div>
        <div className="flex items-center gap-2">
          {pending.length > 0 && (
            <span className="text-xs text-gray-500 mr-2">{pending.length} 个文件待处理</span>
          )}
          <button
            onClick={startProcessing}
            disabled={uploading || pending.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {uploading ? '上传中...' : '开始处理'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Upload area */}
        <div
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#1a1a2e] p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">拖拽文件到此处，或点击选择文件</p>
          <p className="text-xs text-gray-400 mb-4">支持 PDF（销售订单）、Excel/CSV（TP文件），可多选</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              <FileText className="w-4 h-4" />选择文件
            </button>
            <button onClick={e => { e.stopPropagation(); folderRef.current?.click(); }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              <FolderOpen className="w-4 h-4" />选择文件夹
            </button>
          </div>
          <input ref={fileRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv" className="hidden"
            onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={folderRef} type="file"
            /* @ts-ignore */ webkitdirectory="" directory="" multiple className="hidden"
            onChange={e => {
              if (e.target.files?.length) {
                const valid = Array.from(e.target.files).filter(f => {
                  const ext = f.name.toLowerCase().split('.').pop() || '';
                  return ['pdf', 'xlsx', 'xls', 'csv'].includes(ext);
                });
                if (valid.length) addFiles(valid);
              }
              e.target.value = '';
            }} />
        </div>

        {/* Upload progress bar */}
        {uploading && (
          <div className="bg-white dark:bg-[#1a1a2e] rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-blue-600 font-medium flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />上传中...
              </span>
              <span className="text-gray-500 tabular-nums">{uploadProgress}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {/* Pending files queue */}
        {pending.length > 0 && (
          <div className="bg-white dark:bg-[#1a1a2e] rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-[#222] border-b border-gray-200 dark:border-gray-700">
              <span className="text-xs font-medium text-gray-500">待上传文件</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">批量类型：</span>
                {(['', 'tp', 'sales_order'] as const).map(t => (
                  <button key={t || 'auto'} onClick={() => setGlobalType(t as FileType | '')}
                    className={`px-2.5 py-0.5 text-xs rounded-full border transition-colors ${
                      globalType === t
                        ? 'bg-primary text-white border-primary'
                        : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}>
                    {t === '' ? '自动' : TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {pending.map(item => (
                <div key={item.id}
                  className="grid grid-cols-[1fr_120px_40px] gap-2 px-4 py-2.5 items-center text-xs hover:bg-gray-50 dark:hover:bg-[#222] transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.file.name.toLowerCase().endsWith('.pdf')
                      ? <FileText className="w-4 h-4 text-red-400 shrink-0" />
                      : <FileSpreadsheet className="w-4 h-4 text-green-500 shrink-0" />}
                    <span className="truncate text-gray-700 dark:text-gray-200" title={item.file.name}>{item.file.name}</span>
                    <span className="text-gray-400 shrink-0">({(item.file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  <div className="relative">
                    <select value={globalType || item.type}
                      onChange={e => changePendingType(item.id, e.target.value as FileType)}
                      disabled={!!globalType}
                      className="w-full appearance-none text-xs px-2 py-1 pr-6 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#333] text-gray-700 dark:text-gray-200 disabled:opacity-60">
                      <option value="tp">TP文件</option>
                      <option value="sales_order">销售订单</option>
                      <option value="unknown">未识别</option>
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                  </div>
                  <div className="flex justify-center">
                    <button onClick={() => removePending(item.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processing history */}
        <div className="bg-white dark:bg-[#1a1a2e] rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-[#222] border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-500">处理记录</span>
              <span className="text-xs text-gray-400">共 {historyTotal} 条</span>
            </div>
            <div className="flex items-center gap-2">
              {isPolling && (
                <span className="flex items-center gap-1 text-xs text-blue-500">
                  <Loader2 className="w-3 h-3 animate-spin" />同步中
                </span>
              )}
              <button onClick={() => { setHistoryLoading(true); loadHistory(); }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                <RefreshCw className={`w-3 h-3 ${historyLoading ? 'animate-spin' : ''}`} />刷新
              </button>
            </div>
          </div>

          {/* Status filter tabs */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 dark:border-gray-800">
            {STATUS_TABS.map(tab => (
              <button key={tab.key} onClick={() => handleStatusFilter(tab.key)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  statusFilter === tab.key
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {historyLoading && history.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-xs">
              <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />加载中...
            </div>
          ) : history.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-xs">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />暂无处理记录
            </div>
          ) : (
            <>
              {/* Column headers with sort */}
              <div className="grid grid-cols-[1fr_90px_110px_90px_180px] gap-2 px-4 py-2 text-xs font-medium text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <button className="flex items-center gap-1 hover:text-gray-600 transition-colors text-left"
                  onClick={() => handleSort('file_name')}>
                  文件名 <SortIcon field="file_name" />
                </button>
                <button className="flex items-center gap-1 hover:text-gray-600 transition-colors text-left"
                  onClick={() => handleSort('file_type')}>
                  类型 <SortIcon field="file_type" />
                </button>
                <button className="flex items-center gap-1 hover:text-gray-600 transition-colors text-left"
                  onClick={() => handleSort('status')}>
                  状态 <SortIcon field="status" />
                </button>
                <button className="flex items-center gap-1 hover:text-gray-600 transition-colors text-left"
                  onClick={() => handleSort('create_time')}>
                  时间 <SortIcon field="create_time" />
                </button>
                <span>操作</span>
              </div>

              {/* Rows */}
              <div className="max-h-[calc(100vh-580px)] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {history.map(item => {
                  const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                  const Icon = sc.icon;
                  const isSpinner = item.status === 'processing' || item.status === 'pending';
                  const canCancel = item.status === 'pending' || item.status === 'processing';
                  const canRetry = item.status === 'failed' || item.status === 'upload_failed' || item.status === 'cancelled';
                  const isFailed = item.status === 'failed' || item.status === 'upload_failed';
                  const isDuplicate = item.status === 'skipped_duplicate';
                  const isSuccess = item.status === 'success';
                  const isSalesOrder = item.file_type === 'sales_order';
                  const headerIds = isSuccess && isSalesOrder ? parseHeaderIds(item.result_summary) : [];
                  return (
                    <div key={`${item.batch_id}-${item.id}`}
                      className="grid grid-cols-[1fr_90px_110px_90px_180px] gap-2 px-4 py-2.5 items-center text-xs hover:bg-gray-50 dark:hover:bg-[#222] transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        {item.file_name?.toLowerCase().endsWith('.pdf')
                          ? <FileText className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          : <FileSpreadsheet className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                        <span className="truncate text-gray-700 dark:text-gray-200" title={item.file_name}>
                          {item.file_name}
                        </span>
                      </div>
                      <span className="text-gray-500">{TYPE_LABELS[item.file_type] || item.file_type}</span>
                      <div className={`flex items-center gap-1 ${sc.color}`}>
                        <Icon className={`w-3 h-3 ${isSpinner ? 'animate-spin' : ''}`} />
                        <span>{sc.label}</span>
                      </div>
                      <span className="text-gray-400">{formatTime(item.create_time)}</span>
                      <div className="flex items-center gap-1.5">
                        {headerIds.length > 0 && (
                          <>
                            <button
                              onClick={() => headerIds.forEach(hid =>
                                downloadFile(`/api/v1/sales-order/download?header_id=${hid}`, `order_${hid}.csv`)
                              )}
                              className="flex items-center gap-0.5 text-blue-600 hover:text-blue-800 transition-colors"
                              title="下载销售订单">
                              <Download className="w-3 h-3" /><span>订单</span>
                            </button>
                            <button
                              onClick={() => headerIds.forEach(hid =>
                                downloadFile(`/api/v1/sales-order/packing-list?header_id=${hid}`, `packing_list_${hid}.xlsx`)
                              )}
                              className="flex items-center gap-0.5 text-green-600 hover:text-green-800 transition-colors"
                              title="下载装箱单">
                              <FileSpreadsheet className="w-3 h-3" /><span>装箱单</span>
                            </button>
                          </>
                        )}
                        {isFailed && item.error_message && (
                          <button onClick={() => setErrorModal({ name: item.file_name, error: item.error_message! })}
                            className="flex items-center gap-0.5 text-red-500 hover:text-red-700 transition-colors"
                            title="查看日志">
                            <Eye className="w-3 h-3" />
                          </button>
                        )}
                        {isDuplicate && item.error_message && (
                          <button onClick={() => setErrorModal({ name: item.file_name, error: item.error_message! })}
                            className="flex items-center gap-0.5 text-amber-500 hover:text-amber-700 transition-colors"
                            title="查看重复详情">
                            <Eye className="w-3 h-3" />
                          </button>
                        )}
                        {canRetry && (
                          <button onClick={() => retryItem(item.id)}
                            className="flex items-center gap-0.5 text-blue-500 hover:text-blue-700 transition-colors"
                            title="重新解析">
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                        {canCancel && (
                          <button onClick={() => cancelItem(item.id)}
                            className="flex items-center gap-0.5 text-gray-400 hover:text-red-500 transition-colors"
                            title="取消">
                            <Ban className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a1a2e]">
                  <span className="text-xs text-gray-400">
                    第 {historyPage}/{totalPages} 页
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handlePageChange(1)} disabled={historyPage <= 1}
                      className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      首页
                    </button>
                    <button onClick={() => handlePageChange(historyPage - 1)} disabled={historyPage <= 1}
                      className="p-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let page: number;
                      if (totalPages <= 5) {
                        page = i + 1;
                      } else if (historyPage <= 3) {
                        page = i + 1;
                      } else if (historyPage >= totalPages - 2) {
                        page = totalPages - 4 + i;
                      } else {
                        page = historyPage - 2 + i;
                      }
                      return (
                        <button key={page} onClick={() => handlePageChange(page)}
                          className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                            page === historyPage
                              ? 'bg-primary text-white border-primary'
                              : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}>
                          {page}
                        </button>
                      );
                    })}
                    <button onClick={() => handlePageChange(historyPage + 1)} disabled={historyPage >= totalPages}
                      className="p-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handlePageChange(totalPages)} disabled={historyPage >= totalPages}
                      className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      末页
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Error log modal */}
      {errorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setErrorModal(null)}>
          <div className="bg-white dark:bg-[#1a1a2e] rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">解析失败日志</h3>
                <p className="text-xs text-gray-500 mt-0.5">{errorModal.name}</p>
              </div>
              <button onClick={() => setErrorModal(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <pre className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg whitespace-pre-wrap break-words font-mono leading-relaxed">
                {errorModal.error}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
