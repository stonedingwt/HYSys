import { RefreshCw, Search, ListChecks } from 'lucide-react';
import type { Task } from './types';
import TaskCard from './TaskCard';

interface Props {
  tasks: Task[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  keyword: string;
  selectedId: number | undefined;
  onSearch: (kw: string) => void;
  onPageChange: (p: number) => void;
  onSelect: (task: Task) => void;
  onToggleFocus: (task: Task) => void;
  onTransfer: (task: Task) => void;
  onRefresh: () => void;
}

export default function TaskList({
  tasks, total, page, pageSize, loading, keyword,
  selectedId, onSearch, onPageChange, onSelect, onToggleFocus, onTransfer, onRefresh,
}: Props) {
  return (
    <>
      {/* Search bar */}
      <div className="px-3 py-2 flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索任务..."
            value={keyword}
            onChange={e => onSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={onRefresh}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="刷新"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">加载中...</div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <ListChecks className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-sm">暂无任务</span>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                selected={selectedId === task.id}
                onSelect={() => onSelect(task)}
                onToggleFocus={() => onToggleFocus(task)}
                onTransfer={() => onTransfer(task)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="px-3 py-2 border-t dark:border-gray-700 flex items-center justify-between text-xs text-gray-400">
          <span>共 {total} 条</span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="px-2 py-1 border rounded dark:border-gray-600 disabled:opacity-40"
            >上一页</button>
            <span className="px-2 py-1">{page}/{Math.ceil(total / pageSize)}</span>
            <button
              disabled={page * pageSize >= total}
              onClick={() => onPageChange(page + 1)}
              className="px-2 py-1 border rounded dark:border-gray-600 disabled:opacity-40"
            >下一页</button>
          </div>
        </div>
      )}
    </>
  );
}
