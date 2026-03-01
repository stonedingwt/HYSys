import { useState } from 'react';
import {
  Star, Clock, MessageSquare, FileText, History,
  UserPlus, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import type { Task } from './types';
import { toggleFocus, updateTask } from './api';
import TaskChat from './TaskChat';
import TaskForms from './TaskForms';
import TaskTimeline from './TaskTimeline';
import TaskTransfer from './TaskTransfer';
import BizFormEditor from './BizFormEditor';
import { ClipboardList } from 'lucide-react';

const TABS = [
  { key: 'chat', label: '聊天', Icon: MessageSquare },
  { key: 'biz', label: '业务数据', Icon: ClipboardList },
  { key: 'forms', label: '表单', Icon: FileText },
  { key: 'logs', label: '日志', Icon: History },
] as const;

type TabKey = typeof TABS[number]['key'];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  in_progress: { label: '进行中', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/30' },
  done: { label: '已完成', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/30' },
  '销售订单下单': { label: '销售订单下单', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/30' },
  'TP数据采集': { label: 'TP数据采集', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/30' },
  '大货数据更新': { label: '大货数据更新', color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/30' },
  '跟单任务结束': { label: '跟单任务结束', color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-700/50' },
};

const DEFAULT_STATUS = { label: '', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/30' };

function isOverdue(task: Task) {
  return task.due_date && task.status === 'in_progress' && new Date(task.due_date) < new Date();
}

interface Props {
  task: Task;
  isAdmin: boolean;
  onRefresh: () => void;
}

export default function TaskDetail({ task, isAdmin, onRefresh }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('chat');
  const [showTransfer, setShowTransfer] = useState(false);

  const st = STATUS_MAP[task.status] || { ...DEFAULT_STATUS, label: task.status || '未知' };
  const overdue = isOverdue(task);

  const canTransfer = isAdmin || (task.assignee_id !== null);

  const handleToggleFocus = async () => {
    await toggleFocus(task.id);
    onRefresh();
  };

  const handleStatusChange = async (newStatus: string) => {
    await updateTask(task.id, { status: newStatus });
    onRefresh();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
            <span className="text-xs font-mono text-gray-400 truncate">{task.task_number}</span>
            {overdue && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-0.5">
                <AlertTriangle className="w-3 h-3" /> 超期
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={handleToggleFocus} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="关注">
              <Star className={`w-4 h-4 ${task.is_focused ? 'fill-amber-400 text-amber-400' : 'text-gray-400'}`} />
            </button>
            {canTransfer && (
              <button
                onClick={() => setShowTransfer(true)}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-primary"
                title="转交"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            )}
            {task.status === 'in_progress' && (
              <button
                onClick={() => handleStatusChange('done')}
                className="ml-1 px-2.5 py-1 text-[11px] bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3" /> 完成
              </button>
            )}
          </div>
        </div>

        <h2 className="text-sm font-semibold dark:text-gray-100 mb-1">{task.task_name}</h2>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span>类型: {task.task_type}</span>
          <span>优先级: {task.priority_label}</span>
          {task.due_date && (
            <span className="flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              截止: {new Date(task.due_date).toLocaleDateString('zh-CN')}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex border-b dark:border-gray-700">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <tab.Icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={`flex-1 ${activeTab === 'chat' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
        {activeTab === 'chat' && <TaskChat task={task} />}
        {activeTab === 'biz' && <BizFormEditor taskId={task.id} />}
        {activeTab === 'forms' && <TaskForms taskId={task.id} />}
        {activeTab === 'logs' && <TaskTimeline taskId={task.id} />}
      </div>

      {/* Transfer dialog */}
      <TaskTransfer
        taskId={task.id}
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        onSuccess={onRefresh}
      />
    </div>
  );
}
