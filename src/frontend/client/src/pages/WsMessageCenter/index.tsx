import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell, CheckCheck, Trash2, RefreshCw, X,
  AlertCircle, Info, CheckCircle2, Megaphone,
} from 'lucide-react';

interface Notification {
  id: number;
  title: string;
  content: string;
  notify_type: string;
  priority: string;
  is_read: number;
  receiver_id: number | null;
  sender_name: string | null;
  related_task_id: number | null;
  related_url: string | null;
  create_time: string;
  update_time: string;
}

const TYPE_MAP: Record<string, { label: string; Icon: typeof Bell; color: string; bg: string }> = {
  system: { label: '系统通知', Icon: Megaphone, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  task: { label: '任务通知', Icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  alert: { label: '告警通知', Icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
  info: { label: '信息通知', Icon: Info, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
};

const PRIORITY_COLOR: Record<string, string> = {
  low: 'border-l-gray-300',
  normal: 'border-l-blue-400',
  high: 'border-l-orange-400',
  urgent: 'border-l-red-500',
};

async function dbFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`/api/db${path}`, opts);
  return r.json();
}

export default function WsMessageCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [readFilter, setReadFilter] = useState<string | null>(null);
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20' });
      if (typeFilter) params.set('notify_type', typeFilter);
      if (readFilter !== null) params.set('is_read', readFilter);
      const data = await dbFetch(`/notification/list?${params}`);
      setNotifications(data.items || []);
      setTotal(data.total || 0);
    } catch { setNotifications([]); }
    setLoading(false);
  }, [page, typeFilter, readFilter]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  const handleMarkRead = async (notif: Notification) => {
    if (notif.is_read) return;
    await dbFetch(`/notification/${notif.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: 1 }),
    });
    loadNotifications();
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    await Promise.all(unread.map(n =>
      dbFetch(`/notification/${n.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: 1 }),
      })
    ));
    loadNotifications();
  };

  const handleDelete = async (id: number) => {
    await dbFetch(`/notification/${id}`, { method: 'DELETE' });
    setSelectedNotif(null);
    loadNotifications();
  };

  const handleSelect = (notif: Notification) => {
    setSelectedNotif(notif);
    handleMarkRead(notif);
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

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-5 pt-5 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
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
              className="inline-flex items-center px-3 py-1.5 text-xs border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 dark:border-gray-700 dark:text-gray-300 disabled:opacity-40">
              <CheckCheck className="w-3.5 h-3.5 mr-1" />全部已读
            </button>
            <button onClick={() => loadNotifications()} className="inline-flex items-center px-3 py-1.5 text-xs border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
              <RefreshCw className="w-3.5 h-3.5 mr-1" />刷新
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${typeFilter === null ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            onClick={() => setTypeFilter(null)}
          >全部</button>
          {Object.entries(TYPE_MAP).map(([key, val]) => (
            <button
              key={key}
              className={`px-3 py-1.5 text-xs rounded-full border transition-all flex items-center gap-1 ${typeFilter === key ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              onClick={() => setTypeFilter(key)}
            >
              <val.Icon className="w-3 h-3" />{val.label}
            </button>
          ))}
          <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
          <button
            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${readFilter === '0' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            onClick={() => setReadFilter(readFilter === '0' ? null : '0')}
          >仅未读</button>
        </div>
      </div>

      {/* List + Detail */}
      <div className="flex-1 flex overflow-hidden">
        <div className={`${selectedNotif ? 'w-1/2 border-r dark:border-gray-700' : 'w-full'} overflow-y-auto px-5 pb-5`}>
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">加载中...</div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Bell className="w-10 h-10 mb-2 opacity-30" />
              <span>暂无消息</span>
            </div>
          ) : (
            <div className="space-y-1">
              {notifications.map(notif => {
                const tm = TYPE_MAP[notif.notify_type] || TYPE_MAP.info;
                return (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border-l-[3px] ${PRIORITY_COLOR[notif.priority] || PRIORITY_COLOR.normal} ${
                      selectedNotif?.id === notif.id ? 'bg-primary/5' : notif.is_read ? 'bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800' : 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}
                    onClick={() => handleSelect(notif)}
                  >
                    <div className={`shrink-0 mt-0.5 p-1.5 rounded-lg ${tm.bg}`}>
                      <tm.Icon className={`w-4 h-4 ${tm.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${notif.is_read ? 'text-gray-400' : 'dark:text-gray-100'}`}>{notif.title}</span>
                        {!notif.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                      </div>
                      {notif.content && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{notif.content}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] ${tm.color}`}>{tm.label}</span>
                        {notif.sender_name && <span className="text-[10px] text-gray-400">来自 {notif.sender_name}</span>}
                        <span className="text-[10px] text-gray-400">{formatTime(notif.create_time)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {total > 20 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-xs border rounded-md disabled:opacity-40 dark:border-gray-700 dark:text-gray-300">上一页</button>
              <span className="text-sm text-gray-400">第 {page} 页</span>
              <button disabled={page * 20 >= total} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-xs border rounded-md disabled:opacity-40 dark:border-gray-700 dark:text-gray-300">下一页</button>
            </div>
          )}
        </div>

        {selectedNotif && (
          <div className="w-1/2 overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <span className={`text-xs px-2 py-1 rounded-full ${TYPE_MAP[selectedNotif.notify_type]?.bg} ${TYPE_MAP[selectedNotif.notify_type]?.color}`}>
                {TYPE_MAP[selectedNotif.notify_type]?.label || selectedNotif.notify_type}
              </span>
              <div className="flex items-center gap-2">
                <button className="text-xs text-red-500 hover:underline flex items-center gap-1" onClick={() => handleDelete(selectedNotif.id)}>
                  <Trash2 className="w-3 h-3" />删除
                </button>
                <button onClick={() => setSelectedNotif(null)}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
              </div>
            </div>
            <h2 className="text-lg font-semibold mb-2 dark:text-gray-100">{selectedNotif.title}</h2>
            <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
              {selectedNotif.sender_name && <span>来自：{selectedNotif.sender_name}</span>}
              <span>{formatTime(selectedNotif.create_time)}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${selectedNotif.priority === 'urgent' ? 'bg-red-100 text-red-600' : selectedNotif.priority === 'high' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                {selectedNotif.priority === 'urgent' ? '紧急' : selectedNotif.priority === 'high' ? '重要' : selectedNotif.priority === 'normal' ? '普通' : '低'}
              </span>
            </div>
            <div className="text-sm leading-relaxed bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg whitespace-pre-wrap dark:text-gray-200">
              {selectedNotif.content || '无内容'}
            </div>
            {selectedNotif.related_url && (
              <a href={selectedNotif.related_url} className="text-sm text-primary hover:underline mt-3 inline-block" target="_blank" rel="noreferrer">
                查看详情 →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
