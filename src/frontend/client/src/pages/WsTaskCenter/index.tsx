import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ListChecks, Star, AlertTriangle, Clock, CheckCircle2,
  RefreshCw, Plus, MoreHorizontal, X,
} from 'lucide-react';

interface Task {
  id: number;
  task_number: string;
  task_name: string;
  task_type: string;
  status: string;
  priority: number;
  assignee_id: number | null;
  creator_id: number | null;
  due_date: string | null;
  description: string;
  is_focused: number;
  create_time: string;
  update_time: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '待处理', color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  in_progress: { label: '进行中', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  done: { label: '已完成', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
  overdue: { label: '已逾期', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
  cancelled: { label: '已取消', color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800/50' },
};

const PRIORITY_MAP: Record<number, { label: string; color: string }> = {
  0: { label: '普通', color: 'text-gray-500' },
  1: { label: '重要', color: 'text-orange-500' },
  2: { label: '紧急', color: 'text-red-500' },
};

async function dbFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`/api/db${path}`, opts);
  return r.json();
}

export default function WsTaskCenter() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTask, setNewTask] = useState({ task_name: '', task_type: '', description: '', priority: 0 });

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const data = await dbFetch(`/task/list?${params}`);
      setTasks(data.items || []);
      setTotal(data.total || 0);
    } catch { setTasks([]); }
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const stats = useMemo(() => ({
    total,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    focused: tasks.filter(t => t.is_focused === 1).length,
  }), [tasks, total]);

  const handleToggleFocus = async (task: Task) => {
    await dbFetch(`/task/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_focused: task.is_focused === 1 ? 0 : 1 }),
    });
    loadTasks();
  };

  const handleStatusChange = async (task: Task, newStatus: string) => {
    await dbFetch(`/task/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    loadTasks();
  };

  const handleCreateTask = async () => {
    const num = `TASK-${Date.now().toString(36).toUpperCase()}`;
    await dbFetch('/task/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newTask, task_number: num, status: 'pending' }),
    });
    setShowCreate(false);
    setNewTask({ task_name: '', task_type: '', description: '', priority: 0 });
    loadTasks();
  };

  const formatTime = (t: string) => {
    if (!t) return '-';
    return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const statCards = [
    { key: null, label: '全部', value: stats.total, Icon: ListChecks, color: 'text-primary' },
    { key: 'pending', label: '待处理', value: stats.pending, Icon: Clock, color: 'text-yellow-500' },
    { key: 'in_progress', label: '进行中', value: stats.in_progress, Icon: AlertTriangle, color: 'text-blue-500' },
    { key: 'done', label: '已完成', value: stats.done, Icon: CheckCircle2, color: 'text-green-500' },
    { key: 'focused', label: '已关注', value: stats.focused, Icon: Star, color: 'text-amber-500' },
  ];

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-5 pt-5 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold dark:text-gray-100">任务中心</h1>
            <span className="text-sm text-gray-400">共 {total} 个任务</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => loadTasks()} className="inline-flex items-center px-3 py-1.5 text-xs border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
              <RefreshCw className="w-3.5 h-3.5 mr-1" />刷新
            </button>
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center px-3 py-1.5 text-xs bg-primary text-white rounded-md hover:opacity-90">
              <Plus className="w-3.5 h-3.5 mr-1" />新建任务
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          {statCards.map(s => (
            <div
              key={s.label}
              className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm dark:border-gray-700 ${statusFilter === s.key ? 'border-primary bg-primary/5' : ''}`}
              onClick={() => setStatusFilter(s.key)}
            >
              <div className="flex items-center gap-2">
                <s.Icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs text-gray-500 dark:text-gray-400">{s.label}</span>
              </div>
              <div className="text-2xl font-bold mt-1 dark:text-gray-100">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-[480px] shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold dark:text-gray-100">新建任务</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500">任务名称 *</label>
                <input className="w-full mt-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-gray-100" placeholder="请输入任务名称"
                  value={newTask.task_name} onChange={e => setNewTask({ ...newTask, task_name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-500">任务类型</label>
                <input className="w-full mt-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-gray-100" placeholder="如：开发、测试、设计"
                  value={newTask.task_type} onChange={e => setNewTask({ ...newTask, task_type: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-500">描述</label>
                <textarea className="w-full mt-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm h-20 dark:bg-gray-700 dark:text-gray-100" placeholder="任务描述"
                  value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-500">优先级</label>
                <select className="w-full mt-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-gray-100"
                  value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: Number(e.target.value) })}>
                  <option value={0}>普通</option>
                  <option value={1}>重要</option>
                  <option value={2}>紧急</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border rounded-lg dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
              <button onClick={handleCreateTask} disabled={!newTask.task_name.trim()} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50">创建</button>
            </div>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">加载中...</div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <ListChecks className="w-10 h-10 mb-2 opacity-30" />
            <span>暂无任务</span>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => {
              const st = STATUS_MAP[task.status] || STATUS_MAP.pending;
              const pr = PRIORITY_MAP[task.priority] || PRIORITY_MAP[0];
              return (
                <div
                  key={task.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border dark:border-gray-700 cursor-pointer transition-all hover:shadow-sm ${selectedTask?.id === task.id ? 'border-primary bg-primary/5' : ''}`}
                  onClick={() => setSelectedTask(task)}
                >
                  <button onClick={e => { e.stopPropagation(); handleToggleFocus(task); }} className="shrink-0">
                    <Star className={`w-4 h-4 ${task.is_focused ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-mono">{task.task_number}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${pr.color}`}>{pr.label}</span>
                    </div>
                    <div className="font-medium text-sm mt-0.5 truncate dark:text-gray-100">{task.task_name}</div>
                    {task.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{task.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                    <span className="text-xs text-gray-400">{formatTime(task.create_time)}</span>
                    <div className="relative group">
                      <MoreHorizontal className="w-4 h-4 text-gray-400" />
                      <div className="absolute right-0 top-5 hidden group-hover:block bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg p-1 z-10 min-w-[100px]">
                        {task.status !== 'in_progress' && (
                          <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-gray-300"
                            onClick={e => { e.stopPropagation(); handleStatusChange(task, 'in_progress'); }}>开始处理</button>
                        )}
                        {task.status !== 'done' && (
                          <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-gray-300"
                            onClick={e => { e.stopPropagation(); handleStatusChange(task, 'done'); }}>标记完成</button>
                        )}
                        {task.status !== 'cancelled' && (
                          <button className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            onClick={e => { e.stopPropagation(); handleStatusChange(task, 'cancelled'); }}>取消任务</button>
                        )}
                      </div>
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

      {/* Detail slide-over */}
      {selectedTask && (
        <div className="fixed inset-0 z-40" onClick={() => setSelectedTask(null)}>
          <div className="absolute right-0 top-0 h-full w-[400px] bg-white dark:bg-gray-800 shadow-2xl border-l dark:border-gray-700"
            onClick={e => e.stopPropagation()}>
            <div className="p-5 h-full overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono text-gray-400">{selectedTask.task_number}</span>
                <button onClick={() => setSelectedTask(null)}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
              </div>
              <h2 className="text-lg font-semibold mb-2 dark:text-gray-100">{selectedTask.task_name}</h2>
              <div className="flex gap-2 mb-4">
                <span className={`text-xs px-2 py-1 rounded-full ${STATUS_MAP[selectedTask.status]?.bg} ${STATUS_MAP[selectedTask.status]?.color}`}>
                  {STATUS_MAP[selectedTask.status]?.label}
                </span>
                <span className={`text-xs px-2 py-1 ${PRIORITY_MAP[selectedTask.priority]?.color}`}>
                  {PRIORITY_MAP[selectedTask.priority]?.label}
                </span>
              </div>
              {selectedTask.task_type && <div className="text-sm mb-2 dark:text-gray-300"><span className="text-gray-400">类型：</span>{selectedTask.task_type}</div>}
              {selectedTask.description && (
                <div className="mb-4">
                  <div className="text-sm text-gray-400 mb-1">描述</div>
                  <p className="text-sm bg-gray-50 dark:bg-gray-700 p-3 rounded-lg dark:text-gray-200">{selectedTask.description}</p>
                </div>
              )}
              <div className="space-y-2 text-sm dark:text-gray-300">
                <div><span className="text-gray-400">创建时间：</span>{formatTime(selectedTask.create_time)}</div>
                <div><span className="text-gray-400">更新时间：</span>{formatTime(selectedTask.update_time)}</div>
                {selectedTask.due_date && <div><span className="text-gray-400">截止日期：</span>{formatTime(selectedTask.due_date)}</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
