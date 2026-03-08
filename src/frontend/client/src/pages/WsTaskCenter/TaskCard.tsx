import { Star, Clock, MessageSquare, UserRoundPlus } from 'lucide-react';
import type { Task } from './types';

const PRIORITY_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  '普通': { label: '普通', dot: 'bg-gray-400',   text: 'text-gray-500 dark:text-gray-400', bg: '' },
  '中':   { label: '中',   dot: 'bg-yellow-400', text: 'text-yellow-600 dark:text-yellow-400', bg: '' },
  '高':   { label: '高',   dot: 'bg-orange-400', text: 'text-orange-600 dark:text-orange-400', bg: '' },
  '紧急': { label: '紧急', dot: 'bg-red-500',    text: 'text-red-600 dark:text-red-400', bg: '' },
};

interface Props {
  task: Task;
  selected: boolean;
  onSelect: () => void;
  onToggleFocus: () => void;
  onTransfer: () => void;
}

function timeAgo(t: string) {
  if (!t) return '-';
  const now = Date.now();
  const then = new Date(t).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isOverdue(task: Task) {
  return task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();
}

export default function TaskCard({ task, selected, onSelect, onToggleFocus, onTransfer }: Props) {
  const prio = PRIORITY_CONFIG[task.priority_label] || PRIORITY_CONFIG['普通'];
  const overdue = isOverdue(task);
  const isDone = task.status === 'done';
  const displayTime = task.latest_message_time || task.update_time;

  const stageBg = isDone
    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
    : 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400';

  const borderLeft = isDone
    ? 'border-l-emerald-400'
    : overdue
      ? 'border-l-red-400'
      : task.priority_label === '紧急'
        ? 'border-l-red-400'
        : task.priority_label === '高'
          ? 'border-l-orange-400'
          : 'border-l-sky-400';

  return (
    <div
      onClick={onSelect}
      className={[
        'group relative rounded-xl border border-l-[3px] p-3 cursor-pointer transition-all duration-200',
        'bg-white dark:bg-navy-800/80',
        'border-gray-100 dark:border-navy-600/60',
        borderLeft,
        'hover:shadow-md hover:border-gray-200 dark:hover:border-navy-600',
        selected ? 'ring-2 ring-navy-500/30 shadow-md border-navy-500/20' : '',
      ].join(' ')}
    >
      {/* Row 1: header */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 shrink-0">{task.task_number}</span>
        <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate min-w-0 flex-1 leading-tight">
          {task.task_name}
        </h3>

        {/* priority dot */}
        {task.priority_label !== '普通' && (
          <span className="flex items-center gap-0.5 shrink-0" title={`优先级: ${prio.label}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
            <span className={`text-[9px] font-medium ${prio.text}`}>{prio.label}</span>
          </span>
        )}

        {/* focus */}
        <button
          onClick={e => { e.stopPropagation(); onToggleFocus(); }}
          className={`p-0.5 rounded shrink-0 transition-colors ${task.is_focused ? '' : 'opacity-0 group-hover:opacity-100'}`}
          title={task.is_focused ? '取消重点' : '标为重点'}
        >
          <Star className={`w-3.5 h-3.5 ${task.is_focused ? 'fill-amber-400 text-amber-400' : 'text-gray-300 hover:text-amber-400 dark:text-gray-600 dark:hover:text-amber-400'}`} />
        </button>

        {/* transfer */}
        <button
          onClick={e => { e.stopPropagation(); onTransfer(); }}
          className="p-0.5 rounded shrink-0 opacity-0 group-hover:opacity-100 transition-colors text-gray-300 hover:text-navy-500 dark:text-gray-600 dark:hover:text-navy-400"
          title="转交任务"
        >
          <UserRoundPlus className="w-3.5 h-3.5" />
        </button>

        {/* overdue */}
        {overdue && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0 bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400 font-medium">超期</span>
        )}

        {/* stage */}
        <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium shrink-0 whitespace-nowrap ${stageBg}`}>
          {task.status === 'done' ? '已完成' : (task.status === 'in_progress' ? '进行中' : task.status)}
        </span>
      </div>

      {/* Row 2: latest message */}
      <div className="flex items-start gap-1.5 mb-2">
        <MessageSquare className="w-3 h-3 shrink-0 text-gray-300 dark:text-gray-600 mt-[1px]" />
        <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 flex-1 leading-4">
          {task.latest_message || task.description || '暂无对话消息'}
        </p>
      </div>

      {/* Row 3: meta */}
      <div className="flex items-center text-[10px] text-gray-400 dark:text-gray-500">
        <Clock className="w-2.5 h-2.5 shrink-0 mr-1" />
        <span className="truncate">{timeAgo(displayTime)}</span>
        <span className="mx-1">·</span>
        <span className="truncate">创建 {timeAgo(task.create_time)}</span>
        {task.tags?.length ? (
          <>
            <span className="mx-1">·</span>
            {task.tags.slice(0, 2).map((tag, i) => (
              <span key={i} className="inline-flex items-center mr-1 px-1.5 py-0 rounded bg-gray-100 dark:bg-navy-700 text-gray-500 dark:text-gray-400 truncate max-w-[80px]">
                {tag}
              </span>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}
