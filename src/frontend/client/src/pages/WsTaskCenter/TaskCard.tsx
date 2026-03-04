import { Star, Clock } from 'lucide-react';
import type { Task } from './types';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  in_progress: { label: '进行中', color: 'text-white', bg: 'bg-amber-500' },
  done: { label: '已完成', color: 'text-white', bg: 'bg-green-500' },
};

const PRIORITY_COLORS: Record<string, { text: string; bg: string }> = {
  '普通': { text: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700' },
  '中': { text: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  '高': { text: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  '紧急': { text: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
};

interface Props {
  task: Task;
  selected: boolean;
  onSelect: () => void;
  onToggleFocus: () => void;
}

function formatDate(t: string) {
  if (!t) return '-';
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function isOverdue(task: Task) {
  return task.due_date && task.status === 'in_progress' && new Date(task.due_date) < new Date();
}

export default function TaskCard({ task, selected, onSelect, onToggleFocus }: Props) {
  const st = STATUS_MAP[task.status] || STATUS_MAP.in_progress;
  const priorityStyle = PRIORITY_COLORS[task.priority_label] || PRIORITY_COLORS['普通'];
  const overdue = isOverdue(task);
  const tags = task.tags?.length ? task.tags : [];

  return (
    <div
      onClick={onSelect}
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3 cursor-pointer transition-all hover:shadow-sm ${selected ? 'ring-2 ring-primary/30 border-primary/30' : ''}`}
    >
      {/* Title line: number + status badges */}
      <div className="flex items-start justify-between gap-1.5 mb-1">
        <span className="text-sm font-semibold dark:text-gray-100 flex-1 min-w-0 truncate leading-5">
          {task.task_number}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {tags.slice(0, 2).map((tag, i) => (
            <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 whitespace-nowrap max-w-[80px] truncate">
              {tag}
            </span>
          ))}
          {task.is_focused && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-medium">重点</span>
          )}
          <span className={`text-[9px] px-1.5 py-0.5 rounded ${st.bg} ${st.color}`}>{st.label}</span>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1.5">{task.description}</p>
      )}

      {/* Priority + Focus */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityStyle.bg} ${priorityStyle.text}`}>
            优先级 · {task.priority_label}
          </span>
          {overdue && (
            <span className="text-[10px] px-1 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">超期</span>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onToggleFocus(); }}
          className="flex items-center gap-0.5 text-[11px] text-gray-400 hover:text-amber-500 transition-colors"
        >
          <Star className={`w-3 h-3 ${task.is_focused ? 'fill-amber-400 text-amber-400' : ''}`} />
          <span>关注</span>
        </button>
      </div>

      {/* Timestamps */}
      <div className="flex items-center gap-0.5 text-[10px] text-gray-400 flex-wrap">
        <Clock className="w-2.5 h-2.5 shrink-0" />
        <span>更新：{formatDate(task.update_time)}</span>
        <span className="mx-0.5">·</span>
        <span>创建：{formatDate(task.create_time)}</span>
      </div>
    </div>
  );
}
