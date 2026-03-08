import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell, CheckCheck, RefreshCw, X, ArrowLeft,
  AlertCircle, Info, CheckCircle2, Megaphone, MessageSquare,
  ArrowRightCircle, BellRing,
} from 'lucide-react';

const AppChat = lazy(() => import('~/pages/appChat'));

interface Message {
  id: number;
  task_id: string;
  message_type: string;
  message_content: string;
  update_by: string;
  is_read: number;
  create_time: string;
  is_task_related: boolean;
  task_db_id: number | null;
  task_name: string | null;
  chat_id: string | null;
  agent_id: string | null;
  task_status: string | null;
}

interface ApiMsgType {
  label: string;
  value: string;
  is_task_related: boolean;
}

interface FilterBtn {
  key: string;
  label: string;
  filterParam: { field: 'message_type' | 'is_read'; value: string };
}

const ICON_LOOKUP: Record<string, typeof Bell> = {
  '任务创建': CheckCircle2,
  '风险提示': AlertCircle,
  '信息更新': MessageSquare,
  '状态更新': ArrowRightCircle,
  '信息提示': Info,
};

const COLOR_LOOKUP: Record<string, { color: string; bg: string }> = {
  '任务创建': { color: 'text-navy-600', bg: 'bg-navy-50 dark:bg-navy-900/20' },
  '风险提示': { color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
  '信息更新': { color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/20' },
  '状态更新': { color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  '信息提示': { color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
};

const FALLBACK_TYPES: ApiMsgType[] = [
  { label: '任务创建', value: '任务创建', is_task_related: true },
  { label: '风险提示', value: '风险提示', is_task_related: true },
  { label: '信息更新', value: '信息更新', is_task_related: true },
  { label: '状态更新', value: '状态更新', is_task_related: true },
  { label: '信息提示', value: '信息提示', is_task_related: false },
];

const DEFAULT_ICON = Megaphone;
const DEFAULT_COLOR = { color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-navy-700/30' };

function getIcon(label: string) { return ICON_LOOKUP[label] || DEFAULT_ICON; }
function getColor(label: string) { return COLOR_LOOKUP[label] || DEFAULT_COLOR; }

async function apiFetch<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1/message-center${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
  });
  const json = await res.json();
  if (json.status_code === 200) return json.data;
  throw new Error(json.status_message || 'Request failed');
}

export default function WsMessageCenter() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Message | null>(null);
  const [apiTypes, setApiTypes] = useState<ApiMsgType[] | null>(null);

  useEffect(() => {
    apiFetch<ApiMsgType[]>('/types')
      .then(data => setApiTypes(data && data.length > 0 ? data : FALLBACK_TYPES))
      .catch(() => setApiTypes(FALLBACK_TYPES));
  }, []);

  const filterButtons = useMemo<FilterBtn[]>(() => {
    const types = apiTypes || FALLBACK_TYPES;
    const btns: FilterBtn[] = types.map(t => ({
      key: `type_${t.value}`,
      label: t.label,
      filterParam: { field: 'message_type', value: t.value },
    }));
    btns.push({
      key: 'unread',
      label: '未读',
      filterParam: { field: 'is_read', value: '0' },
    });
    return btns;
  }, [apiTypes]);

  const styleByValue = useMemo(() => {
    const map: Record<string, { label: string }> = {};
    for (const t of (apiTypes || FALLBACK_TYPES)) {
      map[t.value] = { label: t.label };
    }
    return map;
  }, [apiTypes]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20' });
      if (activeFilter) {
        const btn = filterButtons.find(b => b.key === activeFilter);
        if (btn) params.set(btn.filterParam.field, btn.filterParam.value);
      }
      const data = await apiFetch<{ items: Message[]; total: number }>(`/list?${params}`);
      setMessages(data.items || []);
      setTotal(data.total || 0);
    } catch { setMessages([]); }
    setLoading(false);
  }, [page, activeFilter, filterButtons]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const unreadCount = useMemo(() => messages.filter(m => !m.is_read).length, [messages]);

  const handleMarkRead = async (msg: Message) => {
    if (msg.is_read) return;
    await apiFetch(`/read/${msg.id}`, { method: 'PUT' });
    loadMessages();
  };

  const handleMarkAllRead = async () => {
    await apiFetch('/read-all', { method: 'PUT' });
    loadMessages();
  };

  const handleSelect = (msg: Message) => {
    setSelected(msg);
    handleMarkRead(msg);
  };

  const handleFilterClick = (key: string) => {
    setActiveFilter(prev => prev === key ? null : key);
    setPage(1);
  };

  const formatTime = (t: string) => {
    if (!t) return '-';
    const d = new Date(t);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return '刚刚';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}天前`;
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getMsgDisplay = (messageType: string) => {
    const mapped = styleByValue[messageType];
    const label = mapped?.label || messageType;
    return { label, Icon: getIcon(label), ...getColor(label) };
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-transparent">
      {/* Header */}
      <div className="px-5 pt-5 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-navy-500" />
            <h1 className="text-lg font-semibold dark:text-gray-100">消息中心</h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                {unreadCount}
              </span>
            )}
            <span className="text-sm text-gray-400">共 {total} 条消息</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleMarkAllRead} disabled={unreadCount === 0}
              className="inline-flex items-center px-3 py-1.5 text-xs border rounded-md hover:bg-gray-50 dark:hover:bg-white/[0.04] dark:border-white/[0.08] dark:text-gray-300 disabled:opacity-40">
              <CheckCheck className="w-3.5 h-3.5 mr-1" />全部已读
            </button>
            <button onClick={() => loadMessages()} className="inline-flex items-center px-3 py-1.5 text-xs border rounded-md hover:bg-gray-50 dark:hover:bg-white/[0.04] dark:border-white/[0.08] dark:text-gray-300">
              <RefreshCw className="w-3.5 h-3.5 mr-1" />刷新
            </button>
          </div>
        </div>

        {/* Filters — dynamically from data dictionary */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${activeFilter === null ? 'border-navy-500 bg-navy-500/10 text-navy-600 dark:border-cyan-400/60 dark:bg-cyan-400/10 dark:text-cyan-400' : 'border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04]'}`}
            onClick={() => { setActiveFilter(null); setPage(1); }}
          >全部</button>
          {filterButtons.map((f) => {
            const isUnread = f.key === 'unread';
            const BtnIcon = isUnread ? BellRing : getIcon(f.label);
            const btnColor = isUnread ? 'text-purple-600' : getColor(f.label).color;
            return (
              <button
                key={f.key}
                className={`px-3 py-1.5 text-xs rounded-full border transition-all flex items-center gap-1 ${activeFilter === f.key ? 'border-navy-500 bg-navy-500/10 text-navy-600 dark:border-cyan-400/60 dark:bg-cyan-400/10 dark:text-cyan-400' : 'border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04]'}`}
                onClick={() => handleFilterClick(f.key)}
              >
                <BtnIcon className={`w-3 h-3 ${btnColor}`} />{f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List + Detail */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: message list */}
        <div className={`${selected ? 'w-[340px] shrink-0 border-r dark:border-white/[0.06]' : 'w-full'} overflow-y-auto px-5 pb-5`}>
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">加载中...</div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Bell className="w-10 h-10 mb-2 opacity-30" />
              <span>暂无消息</span>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map(msg => {
                const disp = getMsgDisplay(msg.message_type);
                const MsgIcon = disp.Icon;
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border-l-[3px] ${
                      msg.is_task_related ? 'border-l-navy-400' : 'border-l-gray-300'
                    } ${
                      selected?.id === msg.id ? 'bg-navy-500/5 dark:bg-white/[0.06]' : msg.is_read ? 'bg-transparent hover:bg-gray-50 dark:hover:bg-white/[0.04]' : 'bg-navy-50/50 dark:bg-white/[0.04] hover:bg-navy-50 dark:hover:bg-white/[0.06]'
                    }`}
                    onClick={() => handleSelect(msg)}
                  >
                    <div className={`shrink-0 mt-0.5 p-1.5 rounded-lg ${disp.bg}`}>
                      <MsgIcon className={`w-4 h-4 ${disp.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium truncate ${msg.is_read ? 'text-gray-400' : 'dark:text-gray-100'}`}>
                          {msg.task_name || disp.label}
                        </span>
                        {!msg.is_read && <span className="w-2 h-2 rounded-full bg-navy-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{msg.message_content}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] ${disp.color}`}>{disp.label}</span>
                        {msg.task_id && <span className="text-[10px] text-gray-400">{msg.task_id}</span>}
                        <span className="text-[10px] text-gray-400">{formatTime(msg.create_time)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {total > 20 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-xs border rounded-md disabled:opacity-40 dark:border-white/[0.08] dark:text-gray-300">上一页</button>
              <span className="text-sm text-gray-400">第 {page} 页</span>
              <button disabled={page * 20 >= total} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-xs border rounded-md disabled:opacity-40 dark:border-white/[0.08] dark:text-gray-300">下一页</button>
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        {selected && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {selected.is_task_related && selected.chat_id && selected.agent_id ? (
              <>
                <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b dark:border-white/[0.06] bg-white dark:bg-white/[0.03]">
                  <button
                    onClick={() => setSelected(null)}
                    className="md:hidden p-1 rounded hover:bg-gray-100 dark:hover:bg-white/[0.04]"
                  >
                    <ArrowLeft className="w-4 h-4 text-gray-500" />
                  </button>
                  {selected.task_status && (
                    <span className="text-[11px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap bg-navy-50 text-navy-600 dark:bg-navy-900/30 dark:text-navy-400">
                      {selected.task_status}
                    </span>
                  )}
                  <h2 className="text-sm font-semibold dark:text-gray-100 truncate flex-1 min-w-0">
                    {selected.task_name || selected.task_id}
                  </h2>
                  <button onClick={() => setSelected(null)}>
                    <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden bg-navy-50 dark:bg-white/[0.03]">
                  <Suspense
                    fallback={
                      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm h-full bg-navy-50 dark:bg-white/[0.03]">
                        <div className="flex flex-col items-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-2 border-navy-600 border-t-transparent mb-3" />
                          <span>加载智能体对话...</span>
                        </div>
                      </div>
                    }
                  >
                    <AppChat
                      chatId={selected.chat_id}
                      flowId={selected.agent_id}
                      flowType="10"
                      embedded
                    />
                  </Suspense>
                </div>
              </>
            ) : (
              <div className="overflow-y-auto p-5">
                <div className="flex items-center justify-between mb-4">
                  {(() => { const d = getMsgDisplay(selected.message_type); return (
                    <span className={`text-xs px-2 py-1 rounded-full ${d.bg} ${d.color}`}>{d.label}</span>
                  ); })()}
                  <button onClick={() => setSelected(null)}>
                    <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
                <h2 className="text-lg font-semibold mb-2 dark:text-gray-100">
                  {selected.task_name || getMsgDisplay(selected.message_type).label}
                </h2>
                <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
                  {selected.update_by && <span>来自：{selected.update_by}</span>}
                  <span>{formatTime(selected.create_time)}</span>
                  {selected.task_id && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400">{selected.task_id}</span>}
                </div>
                <div className="text-sm leading-relaxed bg-gray-50 dark:bg-white/[0.04] p-4 rounded-lg whitespace-pre-wrap dark:text-gray-200">
                  {selected.message_content || '无内容'}
                </div>
                {selected.is_task_related && selected.task_db_id && (
                  <a
                    href={`/ws-task-center?task=${selected.task_db_id}`}
                    className="text-sm text-navy-600 hover:underline mt-3 inline-block"
                  >
                    前往任务中心查看 →
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
