import { useEffect, useState } from 'react';
import {
  GitCommitHorizontal, FileEdit, ArrowRightLeft, MessageSquare, Settings,
} from 'lucide-react';
import type { TaskLog } from './types';
import { fetchLogs } from './api';

const LOG_TYPE_ICON: Record<string, typeof FileEdit> = {
  form_update: FileEdit,
  status_change: ArrowRightLeft,
  message: MessageSquare,
  system: Settings,
};

const LOG_TYPE_COLOR: Record<string, string> = {
  form_update: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  status_change: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  message: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  system: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

function formatTime(t: string) {
  const d = new Date(t);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}小时前`;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface Props {
  taskId: number;
}

export default function TaskTimeline({ taskId }: Props) {
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchLogs(taskId)
      .then(res => setLogs(res.items))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) return <div className="p-4 text-center text-gray-400 text-sm">加载中...</div>;
  if (logs.length === 0) return <div className="p-8 text-center text-gray-400 text-sm">暂无更新记录</div>;

  return (
    <div className="p-4">
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[18px] top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-700" />

        <div className="space-y-4">
          {logs.map(log => {
            const Icon = LOG_TYPE_ICON[log.log_type] || GitCommitHorizontal;
            const colorClass = LOG_TYPE_COLOR[log.log_type] || LOG_TYPE_COLOR.system;

            return (
              <div key={log.id} className="flex gap-3 relative">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-sm dark:text-gray-200">{log.content || '未知操作'}</p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                    {log.user_name && <span>{log.user_name}</span>}
                    <span>{formatTime(log.create_time)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
