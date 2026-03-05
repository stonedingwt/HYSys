import { Star, Clock, MessageSquare } from 'lucide-react';
import type { Task } from './types';

const PRIORITY_COLORS: Record<string, { text: string; bg: string }> = {
  '普通': { text: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700' },
  '中': { text: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  '高': { text: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  '紧急': { text: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
};

interface Props {
  task: Task;
  selected: boolean;
  isLastStage?: boolean;
  onSelect: () => void;
  onToggleFocus: () => void;
}

function formatDate(t: string) {
  if (!t) return '-';
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isOverdue(task: Task) {
  return task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();
}

export default function TaskCard({ task, selected, isLastStage, onSelect, onToggleFocus }: Props) {
  const priorityStyle = PRIORITY_COLORS[task.priority_label] || PRIORITY_COLORS['普通'];
  const overdue = isOverdue(task);
  const isDone = task.status === 'done' || isLastStage;
  const displayTime = task.latest_message_time || task.update_time;

  return (
    <div
      onClick={onSelect}
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3 cursor-pointer transition-all hover:shadow-sm ${selected ? 'ring-2 ring-primary/30 border-primary/30' : ''}`}
    >
      {/* Row 1: task number + stage badge */}
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-sm font-semibold dark:text-gray-100 truncate">{task.task_number}</span>
          {task.is_focused && (
            <Star className="w-3 h-3 shrink-0 fill-amber-400 text-amber-400" />
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {overdue && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">超期</span>
          )}
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${isDone ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'}`}>
            {task.status === 'done' ? '已完成' : (task.status === 'in_progress' ? '进行中' : task.status)}
          </span>
        </div>
      </div>

      {/* Row 2: task name */}
      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate mb-1.5">{task.task_name}</p>

      {/* Row 3: latest message */}
      <div className="flex items-start gap-1.5 mb-1.5 min-h-[28px]">
        <MessageSquare className="w-3 h-3 shrink-0 text-gray-300 dark:text-gray-600 mt-0.5" />
        <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 flex-1 leading-[14px]">
          {task.latest_message || task.description || '暂无对话消息'}
        </p>
      </div>

      {/* Row 4: priority + focus */}
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityStyle.bg} ${priorityStyle.text}`}>
          {task.priority_label}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onToggleFocus(); }}
          className="text-gray-400 hover:text-amber-500 transition-colors"
        >
          <Star className={`w-3 h-3 ${task.is_focused ? 'fill-amber-400 text-amber-400' : ''}`} />
        </button>
      </div>

      {/* Row 5: timestamps */}
      <div className="flex items-center gap-0.5 text-[10px] text-gray-400 flex-wrap">
        <Clock className="w-2.5 h-2.5 shrink-0" />
        <span>更新：{formatDate(displayTime)}</span>
        <span className="mx-0.5">·</span>
        <span>创建：{formatDate(task.create_time)}</span>
      </div>
    </div>
  );
}
