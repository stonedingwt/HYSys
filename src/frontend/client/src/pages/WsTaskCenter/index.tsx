import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Task, TaskStats } from './types';
import { fetchTasks, fetchStats, toggleFocus } from './api';
import TaskStatsPanel from './TaskStats';
import TaskList from './TaskList';
import TaskDetail from './TaskDetail';
import TaskTransfer from './TaskTransfer';

const LEFT_MIN = 320;
const LEFT_MAX = 900;
const LEFT_DEFAULT = 460;

export default function WsTaskCenter() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT);
  const [transferTask, setTransferTask] = useState<Task | null>(null);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageSize = 20;

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setLeftWidth(Math.max(LEFT_MIN, Math.min(LEFT_MAX, x)));
    };
    const onMouseUp = () => { dragging.current = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, []);

  useEffect(() => {
    fetch('/api/v1/user/info').then(r => r.json()).then(res => {
      const role = res?.data?.role;
      if (role && (role === 'admin' || role === '1' || role.includes('admin'))) setIsAdmin(true);
    }).catch(() => {});
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTasks({
        page, page_size: pageSize,
        status: statusFilter || undefined,
        task_type: typeFilter || undefined,
        keyword: keyword || undefined,
      });
      setTasks(data.items || []);
      setTotal(data.total || 0);
    } catch { setTasks([]); }
    setLoading(false);
  }, [page, statusFilter, typeFilter, keyword]);

  const loadStats = useCallback(async () => {
    try { setStats(await fetchStats()); } catch {}
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const handleToggleFocus = async (task: Task) => {
    await toggleFocus(task.id);
    loadTasks();
    loadStats();
  };

  const handleSelectTask = (task: Task) => {
    setSelectedTask(task);
    setShowMobileDetail(true);
  };

  const handleBackFromDetail = () => {
    setShowMobileDetail(false);
    setSelectedTask(null);
    loadTasks();
    loadStats();
  };

  const progress = useMemo(() => {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.done / stats.total) * 100);
  }, [stats]);

  const listPanel = (
    <>
      <div className="shrink-0 px-3 pt-3 pb-2">
        <TaskStatsPanel
          stats={stats}
          progress={progress}
          statusFilter={statusFilter}
          onFilterChange={(s) => { setStatusFilter(s); setPage(1); }}
          isAdmin={isAdmin}
        />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <TaskList
          tasks={tasks}
          total={total}
          page={page}
          pageSize={pageSize}
          loading={loading}
          keyword={keyword}
          selectedId={selectedTask?.id}
          onSearch={setKeyword}
          onPageChange={setPage}
          onSelect={handleSelectTask}
          onToggleFocus={handleToggleFocus}
          onTransfer={(t) => setTransferTask(t)}
          onRefresh={() => { loadTasks(); loadStats(); }}
        />
      </div>
    </>
  );

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-transparent">
      {/* ── Mobile layout ── */}
      <div className="flex flex-col h-full md:hidden">
        {showMobileDetail && selectedTask ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-white/[0.03] border-b dark:border-white/[0.06] shrink-0">
              <button onClick={handleBackFromDetail}>
                <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold truncate dark:text-gray-100">{selectedTask.task_name}</h2>
                <span className="text-xs text-gray-400">{selectedTask.task_number}</span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <TaskDetail
                task={selectedTask}
                isAdmin={isAdmin}
                onRefresh={() => { loadTasks(); loadStats(); }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            {listPanel}
          </div>
        )}
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden md:flex h-full flex-row" ref={containerRef}>
        {/* Left panel */}
        <div
          className={`flex flex-col overflow-hidden shrink-0 ${
            leftCollapsed ? '' : 'border-r border-gray-200 dark:border-white/[0.06]'
          }`}
          style={{ width: leftCollapsed ? 0 : leftWidth }}
        >
          {!leftCollapsed && listPanel}
        </div>

        {/* Resize handle + collapse toggle */}
        <div
          className="flex shrink-0 relative z-20 items-center"
          style={{ width: 6, cursor: leftCollapsed ? 'default' : 'col-resize' }}
          onMouseDown={(e) => {
            if (leftCollapsed) return;
            e.preventDefault();
            dragging.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
          onDoubleClick={() => { if (!leftCollapsed) setLeftWidth(LEFT_DEFAULT); }}
        >
          <div className={`w-[2px] h-full ${leftCollapsed ? '' : 'hover:bg-blue-400 transition-colors'}`} />
          <button
            onClick={(e) => { e.stopPropagation(); setLeftCollapsed(!leftCollapsed); }}
            className="absolute top-1/2 -mt-7 -ml-1.5 w-5 h-6 flex items-center justify-center rounded-full bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08] shadow hover:shadow-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
          >
            {leftCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Right panel (Detail / Chat) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-white/[0.03]">
          {selectedTask ? (
            <TaskDetail
              task={selectedTask}
              isAdmin={isAdmin}
              onRefresh={() => { loadTasks(); loadStats(); }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
              <p className="text-sm">选择一个任务查看详情</p>
            </div>
          )}
        </div>
      </div>

      {/* Transfer modal */}
      <TaskTransfer
        taskId={transferTask?.id ?? 0}
        open={!!transferTask}
        onClose={() => setTransferTask(null)}
        onSuccess={() => { loadTasks(); loadStats(); }}
      />
    </div>
  );
}
