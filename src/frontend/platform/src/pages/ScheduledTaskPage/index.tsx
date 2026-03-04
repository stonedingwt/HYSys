import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/mep-ui/button";
import { Input } from "@/components/mep-ui/input";
import { SearchInput } from "@/components/mep-ui/input";
import { Switch } from "@/components/mep-ui/switch";
import { Label } from "@/components/mep-ui/label";
import { useToast } from "@/components/mep-ui/toast/use-toast";
import AutoPagination from "@/components/mep-ui/pagination/autoPagination";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableFooter,
} from "@/components/mep-ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/mep-ui/dialog";
import { bsConfirm } from "@/components/mep-ui/alertDialog/useConfirm";
import { captureAndAlertRequestErrorHoc } from "@/controllers/request";
import { userContext } from "@/contexts/userContext";
import {
    getScheduledTasksApi,
    createScheduledTaskApi,
    updateScheduledTaskApi,
    deleteScheduledTaskApi,
    toggleScheduledTaskApi,
    runScheduledTaskApi,
    getScheduledTaskLogsApi,
    getWorkflowListApi,
    ScheduledTask,
    ScheduledTaskLog,
} from "@/controllers/API/scheduled_task";
import {
    Plus,
    Play,
    Pencil,
    Trash2,
    Clock,
    FileText,
    ChevronLeft,
    CheckCircle2,
    XCircle,
    Loader2,
    Mail,
    RefreshCw,
    CalendarClock,
} from "lucide-react";

const CRON_PRESETS = [
    { label: "每分钟", value: "* * * * *" },
    { label: "每小时", value: "0 * * * *" },
    { label: "每天 00:00", value: "0 0 * * *" },
    { label: "每天 09:00", value: "0 9 * * *" },
    { label: "每天 18:00", value: "0 18 * * *" },
    { label: "工作日 09:00", value: "0 9 * * 1-5" },
    { label: "每周一 09:00", value: "0 9 * * 1" },
    { label: "每月1日 00:00", value: "0 0 1 * *" },
];

function StatusBadge({ status }: { status: string }) {
    if (status === "success") return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="w-3 h-3" />成功
        </span>
    );
    if (status === "failed") return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="w-3 h-3" />失败
        </span>
    );
    if (status === "running") return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <Loader2 className="w-3 h-3 animate-spin" />执行中
        </span>
    );
    return <span className="text-xs text-muted-foreground">-</span>;
}

function formatDateTime(dt: string | null | undefined) {
    if (!dt) return "-";
    try {
        return new Date(dt).toLocaleString("zh-CN");
    } catch { return dt; }
}

export default function ScheduledTaskPage() {
    const { t } = useTranslation();
    const { message } = useToast();
    const { user } = useContext(userContext);
    const [view, setView] = useState<"list" | "logs">("list");
    const [logTaskId, setLogTaskId] = useState<number | null>(null);
    const [logTaskName, setLogTaskName] = useState("");

    return (
        <div className="h-full relative px-2 py-2 bg-[#f5f5f5] dark:bg-background-main">
            <div className="w-full h-full px-4 pt-4 pb-2 bg-white dark:bg-background-main-content rounded-[10px] overflow-y-auto scrollbar-hide">
                {view === "list" ? (
                    <TaskList
                        onViewLogs={(taskId, taskName) => {
                            setLogTaskId(taskId);
                            setLogTaskName(taskName);
                            setView("logs");
                        }}
                    />
                ) : (
                    <TaskLogs
                        taskId={logTaskId}
                        taskName={logTaskName}
                        onBack={() => setView("list")}
                    />
                )}
            </div>
        </div>
    );
}

// ======================================================================
// Task List
// ======================================================================

function TaskList({ onViewLogs }: { onViewLogs: (taskId: number, taskName: string) => void }) {
    const { message } = useToast();
    const [tasks, setTasks] = useState<ScheduledTask[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [keyword, setKeyword] = useState("");
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editTask, setEditTask] = useState<Partial<ScheduledTask> | null>(null);

    const loadTasks = (p = page, kw = keyword) => {
        setLoading(true);
        getScheduledTasksApi({ page_num: p, page_size: 20, keyword: kw }).then((res: any) => {
            setTasks(res?.data || []);
            setTotal(res?.total || 0);
        }).catch(() => { }).finally(() => setLoading(false));
    };

    useEffect(() => { loadTasks(1); }, []);

    const handleSearch = (kw: string) => {
        setKeyword(kw);
        setPage(1);
        loadTasks(1, kw);
    };

    const handleToggle = (taskId: number, enabled: boolean) => {
        captureAndAlertRequestErrorHoc(
            toggleScheduledTaskApi(taskId, enabled).then(() => {
                loadTasks();
                message({ variant: "success", title: enabled ? "已启用" : "已禁用" });
            })
        );
    };

    const handleDelete = (task: ScheduledTask) => {
        bsConfirm({
            title: "确认删除",
            desc: `确定要删除定时任务 "${task.name}" 吗？删除后不可恢复。`,
            okTxt: "删除",
            onOk(next) {
                captureAndAlertRequestErrorHoc(
                    deleteScheduledTaskApi(task.id).then(() => {
                        loadTasks();
                        message({ variant: "success", title: "删除成功" });
                    })
                );
                next();
            },
        });
    };

    const handleRunNow = (task: ScheduledTask) => {
        bsConfirm({
            title: "手动执行",
            desc: `确定要立即执行任务 "${task.name}" 吗？`,
            okTxt: "执行",
            onOk(next) {
                captureAndAlertRequestErrorHoc(
                    runScheduledTaskApi(task.id).then(() => {
                        message({ variant: "success", title: "已提交执行", description: "任务已提交后台执行" });
                        setTimeout(() => loadTasks(), 2000);
                    })
                );
                next();
            },
        });
    };

    const openCreate = () => {
        setEditTask(null);
        setDialogOpen(true);
    };
    const openEdit = (task: ScheduledTask) => {
        setEditTask(task);
        setDialogOpen(true);
    };

    return (
        <>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-base font-semibold flex items-center gap-2">
                        <CalendarClock className="w-5 h-5 text-primary" />
                        定时任务
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">管理定时自动调用工作流的任务，支持Cron表达式调度和失败邮件通知</p>
                </div>
                <div className="flex items-center gap-2">
                    <SearchInput placeholder="搜索任务名称" onChange={(e) => handleSearch(e.target.value)} />
                    <Button size="sm" className="gap-1" onClick={openCreate}>
                        <Plus className="w-4 h-4" />新建任务
                    </Button>
                </div>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]">状态</TableHead>
                        <TableHead>任务名称</TableHead>
                        <TableHead>关联工作流</TableHead>
                        <TableHead>Cron表达式</TableHead>
                        <TableHead>邮件通知</TableHead>
                        <TableHead>最近执行</TableHead>
                        <TableHead>最近状态</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tasks.length === 0 && !loading && (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                                暂无定时任务，点击"新建任务"开始
                            </TableCell>
                        </TableRow>
                    )}
                    {tasks.map((task) => (
                        <TableRow key={task.id}>
                            <TableCell>
                                <Switch
                                    checked={task.enabled}
                                    onCheckedChange={(v) => handleToggle(task.id, v)}
                                />
                            </TableCell>
                            <TableCell>
                                <div className="font-medium">{task.name}</div>
                                {task.description && <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{task.description}</div>}
                            </TableCell>
                            <TableCell>
                                {task.workflow_id?.startsWith('__system:') ? (
                                    <span className="inline-flex items-center gap-1 text-sm text-amber-700 dark:text-amber-400">
                                        <Clock className="w-3.5 h-3.5" />{task.workflow_name || '系统内置'}
                                    </span>
                                ) : (
                                    <span className="text-sm">{task.workflow_name || task.workflow_id}</span>
                                )}
                            </TableCell>
                            <TableCell>
                                <code className="text-xs bg-accent/50 px-1.5 py-0.5 rounded">{task.cron_expression}</code>
                            </TableCell>
                            <TableCell>
                                {task.notify_on_failure ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                        <Mail className="w-3 h-3" />已配置
                                    </span>
                                ) : (
                                    <span className="text-xs text-muted-foreground">未配置</span>
                                )}
                            </TableCell>
                            <TableCell className="text-xs">{formatDateTime(task.last_run_time)}</TableCell>
                            <TableCell><StatusBadge status={task.last_run_status || ""} /></TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="立即执行" onClick={() => handleRunNow(task)}>
                                        <Play className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="查看日志" onClick={() => onViewLogs(task.id, task.name)}>
                                        <FileText className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="编辑" onClick={() => openEdit(task)}>
                                        <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" title="删除" onClick={() => handleDelete(task)}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={8} className="text-right">
                            <AutoPagination page={page} pageSize={20} total={total} onChange={(p) => { setPage(p); loadTasks(p); }} />
                        </TableCell>
                    </TableRow>
                </TableFooter>
            </Table>

            <TaskDialog
                open={dialogOpen}
                task={editTask}
                onClose={() => setDialogOpen(false)}
                onSaved={() => { setDialogOpen(false); loadTasks(); }}
            />
        </>
    );
}

// ======================================================================
// Task Create/Edit Dialog
// ======================================================================

function TaskDialog({
    open,
    task,
    onClose,
    onSaved,
}: {
    open: boolean;
    task: Partial<ScheduledTask> | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { message } = useToast();
    const isEdit = !!task?.id;

    const [form, setForm] = useState<Partial<ScheduledTask>>({});
    const [workflows, setWorkflows] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [showEmail, setShowEmail] = useState(false);

    useEffect(() => {
        if (open) {
            setForm(task ? { ...task } : {
                name: "", workflow_id: "", workflow_name: "", cron_expression: "0 9 * * *",
                description: "", enabled: true, notify_on_failure: false, notify_email: "",
                smtp_server: "", smtp_port: 465, smtp_account: "", smtp_password: "",
            });
            setShowEmail(task?.notify_on_failure || false);
            getWorkflowListApi({ page_num: 1, page_size: 500 }).then((res: any) => {
                setWorkflows(res?.data || []);
            });
        }
    }, [open, task]);

    const updateForm = (key: string, value: any) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const isSystemTask = form.workflow_id?.startsWith('__system:');

    const handleSave = () => {
        if (!form.name?.trim()) return message({ variant: "error" as any, title: "请输入任务名称" });
        if (!form.workflow_id && !isSystemTask) return message({ variant: "error" as any, title: "请选择工作流" });
        if (!form.cron_expression?.trim()) return message({ variant: "error" as any, title: "请输入Cron表达式" });

        setSaving(true);
        const api = isEdit
            ? updateScheduledTaskApi({ ...form, id: task!.id! } as any)
            : createScheduledTaskApi(form);

        captureAndAlertRequestErrorHoc(
            api.then(() => {
                message({ variant: "success", title: isEdit ? "更新成功" : "创建成功" });
                onSaved();
            })
        ).finally(() => setSaving(false));
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-[600px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "编辑定时任务" : "新建定时任务"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    {/* Task Name */}
                    <div className="space-y-1">
                        <Label className="text-sm font-medium">任务名称 <span className="text-red-500">*</span></Label>
                        <Input value={form.name || ""} onChange={(e) => updateForm("name", e.target.value)} placeholder="输入任务名称" />
                    </div>

                    {/* Workflow Selection */}
                    <div className="space-y-1">
                        <Label className="text-sm font-medium">关联工作流 {!isSystemTask && <span className="text-red-500">*</span>}</Label>
                        {isSystemTask ? (
                            <div className="flex h-9 w-full items-center rounded-md border border-input bg-accent/30 px-3 text-sm text-muted-foreground">
                                {form.workflow_name || '系统内置任务'}
                            </div>
                        ) : (
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={form.workflow_id || ""}
                                onChange={(e) => {
                                    const wf = workflows.find(w => w.id === e.target.value);
                                    updateForm("workflow_id", e.target.value);
                                    updateForm("workflow_name", wf?.name || "");
                                }}
                            >
                                <option value="">请选择工作流</option>
                                {workflows.map((wf) => (
                                    <option key={wf.id} value={wf.id}>{wf.name}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Cron Expression */}
                    <div className="space-y-1">
                        <Label className="text-sm font-medium">
                            Cron表达式 <span className="text-red-500">*</span>
                            <span className="text-xs text-muted-foreground ml-2">格式: 分 时 日 月 周</span>
                        </Label>
                        <Input
                            value={form.cron_expression || ""}
                            onChange={(e) => updateForm("cron_expression", e.target.value)}
                            placeholder="0 9 * * *"
                        />
                        <div className="flex flex-wrap gap-1 mt-1">
                            {CRON_PRESETS.map((p) => (
                                <button
                                    key={p.value}
                                    type="button"
                                    className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                                        form.cron_expression === p.value
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-accent/50 hover:bg-accent border-transparent"
                                    }`}
                                    onClick={() => updateForm("cron_expression", p.value)}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <Label className="text-sm font-medium">描述</Label>
                        <Input value={form.description || ""} onChange={(e) => updateForm("description", e.target.value)} placeholder="任务描述(可选)" />
                    </div>

                    {/* Enable Toggle */}
                    <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">启用任务</Label>
                        <Switch checked={form.enabled !== false} onCheckedChange={(v) => updateForm("enabled", v)} />
                    </div>

                    {/* Email notification */}
                    <div className="border rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium flex items-center gap-1.5">
                                <Mail className="w-4 h-4 text-muted-foreground" />
                                失败邮件通知
                            </Label>
                            <Switch
                                checked={form.notify_on_failure || false}
                                onCheckedChange={(v) => {
                                    updateForm("notify_on_failure", v);
                                    setShowEmail(v);
                                }}
                            />
                        </div>
                        {showEmail && (
                            <div className="space-y-2 pl-1">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">通知邮箱(多个用逗号分隔)</Label>
                                    <Input value={form.notify_email || ""} onChange={(e) => updateForm("notify_email", e.target.value)} placeholder="admin@example.com" className="h-8 text-sm" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">SMTP服务器</Label>
                                        <Input value={form.smtp_server || ""} onChange={(e) => updateForm("smtp_server", e.target.value)} placeholder="smtp.example.com" className="h-8 text-sm" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">端口</Label>
                                        <Input type="number" value={form.smtp_port || 465} onChange={(e) => updateForm("smtp_port", parseInt(e.target.value))} className="h-8 text-sm" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">SMTP账户</Label>
                                        <Input value={form.smtp_account || ""} onChange={(e) => updateForm("smtp_account", e.target.value)} placeholder="sender@example.com" className="h-8 text-sm" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">SMTP密码/授权码</Label>
                                        <Input type="password" value={form.smtp_password || ""} onChange={(e) => updateForm("smtp_password", e.target.value)} placeholder="********" className="h-8 text-sm" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>取消</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                        {isEdit ? "保存" : "创建"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ======================================================================
// Task Logs
// ======================================================================

function TaskLogs({
    taskId,
    taskName,
    onBack,
}: {
    taskId: number | null;
    taskName: string;
    onBack: () => void;
}) {
    const [logs, setLogs] = useState<ScheduledTaskLog[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [selectedLog, setSelectedLog] = useState<ScheduledTaskLog | null>(null);

    const loadLogs = (p = page) => {
        setLoading(true);
        getScheduledTaskLogsApi({ task_id: taskId || undefined, page_num: p, page_size: 20 })
            .then((res: any) => {
                setLogs(res?.data || []);
                setTotal(res?.total || 0);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadLogs(1); }, [taskId]);

    return (
        <>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" className="gap-1" onClick={onBack}>
                        <ChevronLeft className="w-4 h-4" />返回
                    </Button>
                    <div>
                        <h3 className="text-base font-semibold flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary" />
                            执行日志 {taskName && `- ${taskName}`}
                        </h3>
                    </div>
                </div>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => loadLogs(page)}>
                    <RefreshCw className="w-3.5 h-3.5" />刷新
                </Button>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[60px]">ID</TableHead>
                        <TableHead>任务名称</TableHead>
                        <TableHead>工作流</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>开始时间</TableHead>
                        <TableHead>结束时间</TableHead>
                        <TableHead>耗时</TableHead>
                        <TableHead>触发方式</TableHead>
                        <TableHead className="text-right">详情</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logs.length === 0 && !loading && (
                        <TableRow>
                            <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                                暂无执行日志
                            </TableCell>
                        </TableRow>
                    )}
                    {logs.map((log) => (
                        <TableRow key={log.id}>
                            <TableCell className="text-xs text-muted-foreground">{log.id}</TableCell>
                            <TableCell className="text-sm">{log.task_name}</TableCell>
                            <TableCell className="text-sm">{log.workflow_name || log.workflow_id}</TableCell>
                            <TableCell><StatusBadge status={log.status} /></TableCell>
                            <TableCell className="text-xs">{formatDateTime(log.start_time)}</TableCell>
                            <TableCell className="text-xs">{formatDateTime(log.end_time)}</TableCell>
                            <TableCell className="text-xs">{log.duration_ms != null ? `${(log.duration_ms / 1000).toFixed(1)}s` : "-"}</TableCell>
                            <TableCell>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    log.triggered_by === "manual"
                                        ? "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                        : "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                }`}>
                                    {log.triggered_by === "manual" ? "手动" : "定时"}
                                </span>
                            </TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedLog(log)}>
                                    查看
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={9} className="text-right">
                            <AutoPagination page={page} pageSize={20} total={total} onChange={(p) => { setPage(p); loadLogs(p); }} />
                        </TableCell>
                    </TableRow>
                </TableFooter>
            </Table>

            {/* Log detail dialog */}
            <Dialog open={!!selectedLog} onOpenChange={(v) => !v && setSelectedLog(null)}>
                <DialogContent className="max-w-[550px]">
                    <DialogHeader>
                        <DialogTitle>日志详情 #{selectedLog?.id}</DialogTitle>
                    </DialogHeader>
                    {selectedLog && (
                        <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-2">
                                <div><span className="text-muted-foreground">任务:</span> {selectedLog.task_name}</div>
                                <div><span className="text-muted-foreground">工作流:</span> {selectedLog.workflow_name || selectedLog.workflow_id}</div>
                                <div><span className="text-muted-foreground">状态:</span> <StatusBadge status={selectedLog.status} /></div>
                                <div><span className="text-muted-foreground">触发:</span> {selectedLog.triggered_by === "manual" ? "手动" : "定时"}</div>
                                <div><span className="text-muted-foreground">开始:</span> {formatDateTime(selectedLog.start_time)}</div>
                                <div><span className="text-muted-foreground">结束:</span> {formatDateTime(selectedLog.end_time)}</div>
                                <div colSpan={2}><span className="text-muted-foreground">耗时:</span> {selectedLog.duration_ms != null ? `${(selectedLog.duration_ms / 1000).toFixed(1)}s` : "-"}</div>
                            </div>
                            {selectedLog.result && (
                                <div>
                                    <Label className="text-muted-foreground text-xs">执行结果</Label>
                                    <div className="mt-1 p-2 bg-accent/30 rounded text-xs whitespace-pre-wrap max-h-[150px] overflow-y-auto">{selectedLog.result}</div>
                                </div>
                            )}
                            {selectedLog.error_message && (
                                <div>
                                    <Label className="text-muted-foreground text-xs">错误信息</Label>
                                    <div className="mt-1 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-700 dark:text-red-400 whitespace-pre-wrap max-h-[200px] overflow-y-auto">{selectedLog.error_message}</div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
