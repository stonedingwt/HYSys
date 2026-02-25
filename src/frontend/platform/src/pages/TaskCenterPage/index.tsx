import { useEffect, useMemo, useState, useCallback } from "react";
import {
    ListChecks, Star, AlertTriangle, Clock, CheckCircle2,
    ChevronRight, Filter, RefreshCw, Plus, MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/mep-ui/button";

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

interface TaskListResponse {
    items: Task[];
    total: number;
    page: number;
    page_size: number;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: "待处理", color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-900/20" },
    in_progress: { label: "进行中", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
    done: { label: "已完成", color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
    overdue: { label: "已逾期", color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
    cancelled: { label: "已取消", color: "text-gray-500", bg: "bg-gray-50 dark:bg-gray-800/50" },
};

const PRIORITY_MAP: Record<number, { label: string; color: string }> = {
    0: { label: "普通", color: "text-gray-500" },
    1: { label: "重要", color: "text-orange-500" },
    2: { label: "紧急", color: "text-red-500" },
};

export default function TaskCenterPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [newTask, setNewTask] = useState({ task_name: "", task_type: "", description: "", priority: 0 });

    const loadTasks = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), page_size: "20" });
            if (statusFilter) params.set("status", statusFilter);
            const r = await fetch(`/api/db/task/list?${params}`);
            const data: TaskListResponse = await r.json();
            setTasks(data.items || []);
            setTotal(data.total || 0);
        } catch { setTasks([]); }
        setLoading(false);
    }, [page, statusFilter]);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    const stats = useMemo(() => {
        return {
            total,
            pending: tasks.filter((t) => t.status === "pending").length,
            in_progress: tasks.filter((t) => t.status === "in_progress").length,
            done: tasks.filter((t) => t.status === "done").length,
            focused: tasks.filter((t) => t.is_focused === 1).length,
        };
    }, [tasks, total]);

    const handleToggleFocus = async (task: Task) => {
        await fetch(`/api/db/task/${task.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_focused: task.is_focused === 1 ? 0 : 1 }),
        });
        loadTasks();
    };

    const handleStatusChange = async (task: Task, newStatus: string) => {
        await fetch(`/api/db/task/${task.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
        });
        loadTasks();
    };

    const handleCreateTask = async () => {
        const num = `TASK-${Date.now().toString(36).toUpperCase()}`;
        await fetch("/api/db/task/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...newTask, task_number: num, status: "pending" }),
        });
        setShowCreate(false);
        setNewTask({ task_name: "", task_type: "", description: "", priority: 0 });
        loadTasks();
    };

    const formatTime = (t: string) => {
        if (!t) return "-";
        return new Date(t).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    };

    return (
        <div className="h-full relative px-2 py-2 bg-[#f5f5f5] dark:bg-background-main">
            <div className="w-full h-full bg-white dark:bg-background-main-content rounded-[10px] overflow-hidden flex flex-col">
                <div className="p-5 pb-0 shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <ListChecks className="w-5 h-5 text-primary" />
                            <h1 className="text-lg font-semibold">任务中心</h1>
                            <span className="text-sm text-muted-foreground">共 {total} 个任务</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => loadTasks()}>
                                <RefreshCw className="w-3.5 h-3.5 mr-1" />刷新
                            </Button>
                            <Button size="sm" onClick={() => setShowCreate(true)}>
                                <Plus className="w-3.5 h-3.5 mr-1" />新建任务
                            </Button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-5 gap-3 mb-4">
                        {[
                            { key: null, label: "全部", value: stats.total, icon: ListChecks, color: "text-primary" },
                            { key: "pending", label: "待处理", value: stats.pending, icon: Clock, color: "text-yellow-500" },
                            { key: "in_progress", label: "进行中", value: stats.in_progress, icon: AlertTriangle, color: "text-blue-500" },
                            { key: "done", label: "已完成", value: stats.done, icon: CheckCircle2, color: "text-green-500" },
                            { key: "focused", label: "已关注", value: stats.focused, icon: Star, color: "text-amber-500" },
                        ].map((s) => (
                            <div
                                key={s.label}
                                className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${statusFilter === s.key ? "border-primary bg-primary/5" : "border-border"}`}
                                onClick={() => setStatusFilter(s.key as string | null)}
                            >
                                <div className="flex items-center gap-2">
                                    <s.icon className={`w-4 h-4 ${s.color}`} />
                                    <span className="text-xs text-muted-foreground">{s.label}</span>
                                </div>
                                <div className="text-2xl font-bold mt-1">{s.value}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Create Task Modal */}
                {showCreate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                        <div className="bg-white dark:bg-background-main-content rounded-xl p-6 w-[480px] shadow-xl">
                            <h3 className="text-lg font-semibold mb-4">新建任务</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-sm text-muted-foreground">任务名称 *</label>
                                    <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="请输入任务名称"
                                        value={newTask.task_name} onChange={(e) => setNewTask({ ...newTask, task_name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground">任务类型</label>
                                    <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="如：开发、测试、设计"
                                        value={newTask.task_type} onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground">描述</label>
                                    <textarea className="w-full mt-1 px-3 py-2 border rounded-lg text-sm h-20" placeholder="任务描述"
                                        value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground">优先级</label>
                                    <select className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                                        value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: Number(e.target.value) })}>
                                        <option value={0}>普通</option>
                                        <option value={1}>重要</option>
                                        <option value={2}>紧急</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-5">
                                <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
                                <Button onClick={handleCreateTask} disabled={!newTask.task_name.trim()}>创建</Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Task List */}
                <div className="flex-1 overflow-y-auto px-5 pb-5">
                    {loading ? (
                        <div className="flex items-center justify-center h-40 text-muted-foreground">加载中...</div>
                    ) : tasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                            <ListChecks className="w-10 h-10 mb-2 opacity-30" />
                            <span>暂无任务</span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {tasks.map((task) => {
                                const st = STATUS_MAP[task.status] || STATUS_MAP.pending;
                                const pr = PRIORITY_MAP[task.priority] || PRIORITY_MAP[0];
                                return (
                                    <div
                                        key={task.id}
                                        className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${selectedTask?.id === task.id ? "border-primary bg-primary/5" : "border-border"}`}
                                        onClick={() => setSelectedTask(task)}
                                    >
                                        <button onClick={(e) => { e.stopPropagation(); handleToggleFocus(task); }}
                                            className="shrink-0">
                                            <Star className={`w-4 h-4 ${task.is_focused ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground font-mono">{task.task_number}</span>
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${pr.color} bg-opacity-10`}>{pr.label}</span>
                                            </div>
                                            <div className="font-medium text-sm mt-0.5 truncate">{task.task_name}</div>
                                            {task.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>}
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className={`text-xs px-2 py-1 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                                            <span className="text-xs text-muted-foreground">{formatTime(task.create_time)}</span>
                                            <div className="relative group">
                                                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                                <div className="absolute right-0 top-5 hidden group-hover:block bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-1 z-10 min-w-[100px]">
                                                    {task.status !== "in_progress" && (
                                                        <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted rounded"
                                                            onClick={(e) => { e.stopPropagation(); handleStatusChange(task, "in_progress"); }}>开始处理</button>
                                                    )}
                                                    {task.status !== "done" && (
                                                        <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted rounded"
                                                            onClick={(e) => { e.stopPropagation(); handleStatusChange(task, "done"); }}>标记完成</button>
                                                    )}
                                                    {task.status !== "cancelled" && (
                                                        <button className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-muted rounded"
                                                            onClick={(e) => { e.stopPropagation(); handleStatusChange(task, "cancelled"); }}>取消任务</button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination */}
                    {total > 20 && (
                        <div className="flex items-center justify-center gap-2 mt-4">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
                            <span className="text-sm text-muted-foreground">第 {page} 页</span>
                            <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>下一页</Button>
                        </div>
                    )}
                </div>

                {/* Task Detail Slide-over */}
                {selectedTask && (
                    <div className="fixed inset-0 z-40" onClick={() => setSelectedTask(null)}>
                        <div className="absolute right-0 top-0 h-full w-[400px] bg-white dark:bg-background-main-content shadow-2xl border-l"
                            onClick={(e) => e.stopPropagation()}>
                            <div className="p-5 h-full overflow-y-auto">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-mono text-muted-foreground">{selectedTask.task_number}</span>
                                    <button onClick={() => setSelectedTask(null)} className="text-muted-foreground hover:text-foreground">✕</button>
                                </div>
                                <h2 className="text-lg font-semibold mb-2">{selectedTask.task_name}</h2>
                                <div className="flex gap-2 mb-4">
                                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_MAP[selectedTask.status]?.bg} ${STATUS_MAP[selectedTask.status]?.color}`}>
                                        {STATUS_MAP[selectedTask.status]?.label}
                                    </span>
                                    <span className={`text-xs px-2 py-1 ${PRIORITY_MAP[selectedTask.priority]?.color}`}>
                                        {PRIORITY_MAP[selectedTask.priority]?.label}
                                    </span>
                                </div>
                                {selectedTask.task_type && <div className="text-sm mb-2"><span className="text-muted-foreground">类型：</span>{selectedTask.task_type}</div>}
                                {selectedTask.description && (
                                    <div className="mb-4">
                                        <div className="text-sm text-muted-foreground mb-1">描述</div>
                                        <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedTask.description}</p>
                                    </div>
                                )}
                                <div className="space-y-2 text-sm">
                                    <div><span className="text-muted-foreground">创建时间：</span>{formatTime(selectedTask.create_time)}</div>
                                    <div><span className="text-muted-foreground">更新时间：</span>{formatTime(selectedTask.update_time)}</div>
                                    {selectedTask.due_date && <div><span className="text-muted-foreground">截止日期：</span>{formatTime(selectedTask.due_date)}</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
