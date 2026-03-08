import { memo, useCallback, useEffect, useState } from 'react';
import { Trash2, MessageCircle } from 'lucide-react';

interface ConvItem {
  chat_id: string;
  flow_name: string;
  create_time: string;
}

interface Props {
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  refreshKey: number;
  useDirectMode?: boolean;
}

const API_BASE = (globalThis as any).__APP_ENV__?.BASE_URL ?? '';

const ConversationList = memo(({ currentId, onSelect, onNew, refreshKey, useDirectMode }: Props) => {
  const [items, setItems] = useState<ConvItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const flowTypeParam = useDirectMode ? '&flow_type=15' : '';
      const res = await fetch(`${API_BASE}/api/v1/chat/list?page=1&limit=50${flowTypeParam}`, { credentials: 'include' });
      const data = await res.json();
      const list: ConvItem[] = Array.isArray(data) ? data : data?.data ?? [];
      setItems(list.filter((c) => c.chat_id));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [useDirectMode]);

  useEffect(() => {
    fetchList();
  }, [fetchList, refreshKey]);

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (!confirm('确定删除该对话？')) return;
      try {
        await fetch(`${API_BASE}/api/v1/chat/${id}`, { method: 'DELETE', credentials: 'include' });
        setItems((prev) => prev.filter((c) => c.chat_id !== id));
      } catch { /* ignore */ }
    },
    [],
  );

  const formatDate = (d: string) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return '今天';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return '昨天';
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin">
        {loading && items.length === 0 && (
          <div className="text-center text-gray-400 text-xs py-8">加载中...</div>
        )}
        {!loading && items.length === 0 && (
          <div className="text-center text-gray-400 text-xs py-8">暂无对话</div>
        )}
        {items.map((conv) => {
          const active = conv.chat_id === currentId;
          return (
            <div
              key={conv.chat_id}
              onClick={() => onSelect(conv.chat_id)}
              className={`group flex items-center gap-2.5 px-3 py-2.5 mb-0.5 rounded-lg cursor-pointer transition-colors
                ${active
                  ? 'bg-navy-50 dark:bg-navy-900/20 text-navy-600 dark:text-navy-400'
                  : 'hover:bg-gray-100 dark:hover:bg-navy-800 text-gray-700 dark:text-gray-300'
                }`}
            >
              <MessageCircle className={`flex-shrink-0 h-4 w-4 ${active ? 'text-navy-500' : 'text-gray-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate leading-tight">
                  {conv.flow_name || '新对话'}
                </div>
                <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                  {formatDate(conv.create_time)}
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(e, conv.chat_id)}
                className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100
                  text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
});

ConversationList.displayName = 'ConversationList';
export default ConversationList;
