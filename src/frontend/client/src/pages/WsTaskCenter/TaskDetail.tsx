import { useState } from 'react';
import { Star } from 'lucide-react';
import type { Task } from './types';
import { toggleFocus } from './api';
import TaskChat from './TaskChat';
import TaskTransfer from './TaskTransfer';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  in_progress: { label: '进行中', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/30' },
  done: { label: '已完成', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/30' },
  '销售订单下单': { label: '销售订单下单', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/30' },
  'TP数据采集': { label: 'TP数据采集', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/30' },
  '大货数据更新': { label: '大货数据更新', color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/30' },
  '跟单任务结束': { label: '跟单任务结束', color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-700/50' },
};

const DEFAULT_STATUS = { label: '', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/30' };

interface Props {
  task: Task;
  isAdmin: boolean;
  onRefresh: () => void;
}

export default function TaskDetail({ task, isAdmin, onRefresh }: Props) {
  const [showTransfer, setShowTransfer] = useState(false);

  const st = STATUS_MAP[task.status] || { ...DEFAULT_STATUS, label: task.status || '未知' };

  const handleToggleFocus = async () => {
    await toggleFocus(task.id);
    onRefresh();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header: status + task name + action buttons */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
        <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${st.bg} ${st.color}`}>
          {st.label}
        </span>
        <h2 className="text-sm font-semibold dark:text-gray-100 truncate flex-1 min-w-0">
          {task.task_name}
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          {task.status && task.status !== 'done' && task.status !== '跟单任务结束' && (
            <span className="text-[11px] px-2.5 py-1 rounded bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 whitespace-nowrap">
              {task.status}
            </span>
          )}
          <button
            onClick={handleToggleFocus}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="关注"
          >
            <Star className={`w-4 h-4 ${task.is_focused ? 'fill-amber-400 text-amber-400' : 'text-gray-400'}`} />
          </button>
        </div>
      </div>

      {/* Chat: fills all remaining space */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <TaskChat task={task} />
      </div>

      <TaskTransfer
        taskId={task.id}
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        onSuccess={onRefresh}
      />
    </div>
  );
}
