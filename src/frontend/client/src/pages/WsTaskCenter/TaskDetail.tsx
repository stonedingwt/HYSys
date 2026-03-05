import { useCallback, useEffect, useState } from 'react';
import { Star, ChevronLeft, ChevronRight, FileSearch } from 'lucide-react';
import type { Task, TaskStages } from './types';
import { toggleFocus, fetchTaskStages, changeTaskStage, updateTask } from './api';
import TaskChat from './TaskChat';
import TaskTransfer from './TaskTransfer';

const PRIORITY_COLORS: Record<string, { text: string; bg: string }> = {
  '普通': { text: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-700 dark:text-gray-300' },
  '中': { text: 'text-yellow-700', bg: 'bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300' },
  '高': { text: 'text-orange-700', bg: 'bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300' },
  '紧急': { text: 'text-red-700', bg: 'bg-red-100 dark:bg-red-900/30 dark:text-red-300' },
};

interface Props {
  task: Task;
  isAdmin: boolean;
  onRefresh: () => void;
}

export default function TaskDetail({ task, isAdmin, onRefresh }: Props) {
  const [showTransfer, setShowTransfer] = useState(false);
  const [stages, setStages] = useState<TaskStages | null>(null);
  const [switching, setSwitching] = useState(false);
  const [showForms, setShowForms] = useState(false);

  const loadStages = useCallback(async () => {
    try { setStages(await fetchTaskStages(task.id)); } catch {}
  }, [task.id, task.status]);

  useEffect(() => { loadStages(); }, [loadStages]);

  const handleToggleFocus = async () => {
    await toggleFocus(task.id);
    onRefresh();
  };

  const handleStageChange = async (direction: 'next' | 'prev') => {
    if (switching) return;
    setSwitching(true);
    try {
      await changeTaskStage(task.id, direction);
      onRefresh();
      loadStages();
    } catch (err: any) {
      alert(err?.message || '阶段切换失败');
    }
    setSwitching(false);
  };

  const isDone = stages?.is_last || task.status === 'done';
  const priorityStyle = PRIORITY_COLORS[task.priority_label] || PRIORITY_COLORS['普通'];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
        {/* Left: status + priority */}
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${isDone ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
          {isDone ? '已完成' : '进行中'}
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${priorityStyle.bg} ${priorityStyle.text}`}>
          {task.priority_label}
        </span>

        {/* Center: task name */}
        <h2 className="text-sm font-semibold dark:text-gray-100 truncate flex-1 min-w-0 text-center">
          {task.task_name}
        </h2>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setShowForms(!showForms)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <FileSearch className="w-3.5 h-3.5" />
            任务追溯
          </button>

          <button
            onClick={handleToggleFocus}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title={task.is_focused ? '取消重点' : '标为重点'}
          >
            <Star className={`w-4 h-4 ${task.is_focused ? 'fill-amber-400 text-amber-400' : 'text-gray-400'}`} />
          </button>

          {/* Stage switch */}
          {stages && stages.stages.length > 0 && (
            <div className="flex items-center gap-0.5 ml-1 border-l border-gray-200 dark:border-gray-600 pl-1.5">
              <button
                disabled={switching || !stages || stages.current_index <= 0}
                onClick={() => handleStageChange('prev')}
                className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                title="上一阶段"
              >
                <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap min-w-[60px] text-center" title={`${stages.current_index + 1}/${stages.stages.length}`}>
                {stages.current || task.status}
              </span>
              <button
                disabled={switching || !stages || stages.current_index >= stages.stages.length - 1}
                onClick={() => handleStageChange('next')}
                className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                title="下一阶段"
              >
                <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Forms panel (traceability) */}
      {showForms && (
        <FormsPanel taskId={task.id} onClose={() => setShowForms(false)} />
      )}

      {/* Chat */}
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

function FormsPanel({ taskId, onClose }: { taskId: number; onClose: () => void }) {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('./api').then(({ fetchForms }) => {
      fetchForms(taskId).then(f => { setForms(f || []); setLoading(false); }).catch(() => setLoading(false));
    });
  }, [taskId]);

  return (
    <div className="shrink-0 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-2 max-h-[120px] overflow-y-auto">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">关联单据</span>
        <button onClick={onClose} className="text-[10px] text-gray-400 hover:text-gray-600">收起</button>
      </div>
      {loading ? (
        <p className="text-[11px] text-gray-400">加载中...</p>
      ) : forms.length === 0 ? (
        <p className="text-[11px] text-gray-400">暂无关联单据</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {forms.map(f => (
            <span key={f.id} className={`text-[11px] px-2 py-1 rounded border ${f.is_main ? 'border-primary/40 bg-primary/5 text-primary' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}>
              {f.form_name || f.form_type}
              {f.is_main && <span className="text-[9px] ml-1 opacity-60">主</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
