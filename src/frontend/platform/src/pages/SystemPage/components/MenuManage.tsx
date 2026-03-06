import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/mep-ui/button";
import { Input } from "@/components/mep-ui/input";
import { Switch } from "@/components/mep-ui/switch";
import { Label } from "@/components/mep-ui/label";
import { useToast } from "@/components/mep-ui/toast/use-toast";
import { getSysConfigApi, setSysConfigApi } from "@/controllers/API/user";
import { captureAndAlertRequestErrorHoc } from "@/controllers/request";
import yaml from "js-yaml";
import {
    LayoutDashboard,
    Blocks,
    BookOpen,
    Database,
    Cpu,
    FlaskConical,
    Tags,
    ScrollText,
    Settings,
    Monitor,
    Save,
    RotateCcw,
    Pencil,
    Check,
    X,
    CalendarClock,
    LayoutGrid,
    MessageSquarePlus,
    Bot,
    FileText,
    ListChecks,
    Bell,
    FileSpreadsheet,
} from "lucide-react";

// ============================================================
// Menu item definitions
// ============================================================

interface MenuItem {
    key: string;
    labelKey: string;
    fallbackLabel: string;
    icon: React.ReactNode;
    panel: "admin" | "workspace";
    fixed?: boolean;
}

const ADMIN_MENUS: MenuItem[] = [
    { key: "board", labelKey: "menu.dashboard", fallbackLabel: "看板", icon: <LayoutDashboard className="w-4 h-4" />, panel: "admin" },
    { key: "build", labelKey: "menu.skills", fallbackLabel: "构建", icon: <Blocks className="w-4 h-4" />, panel: "admin" },
    { key: "knowledge", labelKey: "menu.knowledge", fallbackLabel: "知识", icon: <BookOpen className="w-4 h-4" />, panel: "admin" },
    { key: "dataset", labelKey: "menu.dataset", fallbackLabel: "数据集", icon: <Database className="w-4 h-4" />, panel: "admin" },
    { key: "model", labelKey: "menu.models", fallbackLabel: "模型", icon: <Cpu className="w-4 h-4" />, panel: "admin" },
    { key: "evaluation", labelKey: "menu.evaluation", fallbackLabel: "评测", icon: <FlaskConical className="w-4 h-4" />, panel: "admin" },
    { key: "annotation", labelKey: "menu.annotation", fallbackLabel: "标注", icon: <Tags className="w-4 h-4" />, panel: "admin" },
    { key: "log", labelKey: "menu.log", fallbackLabel: "审计", icon: <ScrollText className="w-4 h-4" />, panel: "admin" },
    { key: "system", labelKey: "menu.system", fallbackLabel: "系统", icon: <Settings className="w-4 h-4" />, panel: "admin", fixed: true },
    { key: "data_dict", labelKey: "menu.dataDict", fallbackLabel: "数据字典", icon: <BookOpen className="w-4 h-4" />, panel: "admin" },
    { key: "scheduled_task", labelKey: "menu.scheduledTask", fallbackLabel: "定时任务", icon: <CalendarClock className="w-4 h-4" />, panel: "admin" },
];

const WORKSPACE_MENUS: MenuItem[] = [
    { key: "frontend", labelKey: "menu.workspace", fallbackLabel: "工作台入口", icon: <Monitor className="w-4 h-4" />, panel: "workspace" },
    { key: "ws_apps", labelKey: "menu.wsApps", fallbackLabel: "应用中心", icon: <LayoutGrid className="w-4 h-4" />, panel: "workspace" },
    { key: "ws_new_chat", labelKey: "menu.wsNewChat", fallbackLabel: "AI助手", icon: <MessageSquarePlus className="w-4 h-4" />, panel: "workspace" },
    { key: "ws_task_center", labelKey: "menu.taskCenter", fallbackLabel: "任务中心", icon: <ListChecks className="w-4 h-4" />, panel: "workspace" },
    { key: "ws_message_center", labelKey: "menu.messageCenter", fallbackLabel: "消息中心", icon: <Bell className="w-4 h-4" />, panel: "workspace" },
    { key: "ws_personal_knowledge", labelKey: "menu.wsPersonalKnowledge", fallbackLabel: "个人知识库", icon: <FileText className="w-4 h-4" />, panel: "workspace" },
];

// ============================================================
// Types
// ============================================================

interface MenuConfigEntry {
    enabled: boolean;
    customName?: string;
}

type MenuConfigMap = Record<string, MenuConfigEntry | boolean>;

/** Normalize legacy boolean-only entries to the new shape */
function normalizeEntry(val: any): MenuConfigEntry {
    if (typeof val === "boolean") return { enabled: val };
    if (val && typeof val === "object") return { enabled: val.enabled !== false, customName: val.customName };
    return { enabled: true };
}

// ============================================================
// Component
// ============================================================

export default function MenuManage() {
    const { t } = useTranslation();
    const { message } = useToast();

    const [loading, setLoading] = useState(true);
    const [configStr, setConfigStr] = useState("");
    const [menuConfig, setMenuConfig] = useState<Record<string, MenuConfigEntry>>({});
    const [changed, setChanged] = useState(false);

    useEffect(() => {
        getSysConfigApi().then((res: any) => {
            const raw = typeof res === "string" ? res : res?.data ?? "";
            setConfigStr(raw);
            try {
                const parsed = (yaml.load(raw) as Record<string, any>) || {};
                const mc: MenuConfigMap = parsed.menu_config || {};
                const normalized: Record<string, MenuConfigEntry> = {};
                for (const [k, v] of Object.entries(mc)) {
                    normalized[k] = normalizeEntry(v);
                }
                setMenuConfig(normalized);
            } catch {
                setMenuConfig({});
            }
            setLoading(false);
        });
    }, []);

    const updateEntry = (key: string, patch: Partial<MenuConfigEntry>) => {
        setMenuConfig((prev) => ({
            ...prev,
            [key]: { ...getEntry(key), ...patch },
        }));
        setChanged(true);
    };

    const getEntry = (key: string): MenuConfigEntry => {
        return menuConfig[key] || { enabled: true };
    };

    const handleSave = () => {
        try {
            const parsed = (yaml.load(configStr) as Record<string, any>) || {};
            parsed.menu_config = menuConfig;
            const newYaml = yaml.dump(parsed, { lineWidth: -1 });
            captureAndAlertRequestErrorHoc(
                setSysConfigApi({ data: newYaml }).then(() => {
                    setConfigStr(newYaml);
                    setChanged(false);
                    message({ variant: "success", title: "保存成功", description: "菜单配置已更新" });
                })
            );
        } catch {
            message({ variant: "error" as any, title: "保存失败", description: "配置格式错误" });
        }
    };

    const handleReset = () => {
        setMenuConfig({});
        setChanged(true);
    };

    const isEnabled = (key: string, fixed?: boolean) => {
        if (fixed) return true;
        return getEntry(key).enabled !== false;
    };

    const getCustomName = (key: string) => getEntry(key).customName || "";

    if (loading) return <div className="p-6 text-muted-foreground text-sm">加载中...</div>;

    return (
        <div className="w-full h-full px-2 pt-4 relative">
            <div className="max-w-[900px]">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-base font-semibold">菜单管理</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            管理管理端和工作台侧边栏菜单的显示、隐藏与自定义名称
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="gap-1" onClick={handleReset}>
                            <RotateCcw className="w-3.5 h-3.5" />
                            重置默认
                        </Button>
                        <Button size="sm" className="gap-1" disabled={!changed} onClick={handleSave}>
                            <Save className="w-3.5 h-3.5" />
                            保存
                        </Button>
                    </div>
                </div>

                {/* Admin panel menus */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <Settings className="w-4 h-4 text-primary" />
                        <h4 className="text-sm font-semibold">管理端菜单</h4>
                        <span className="text-xs text-muted-foreground ml-1">（左侧导航栏）</span>
                    </div>
                    <div className="border rounded-lg divide-y">
                        {ADMIN_MENUS.map((item) => (
                            <MenuRow
                                key={item.key}
                                item={item}
                                enabled={isEnabled(item.key, item.fixed)}
                                customName={getCustomName(item.key)}
                                onToggle={(v) => updateEntry(item.key, { enabled: v })}
                                onNameChange={(name) => updateEntry(item.key, { customName: name || undefined })}
                                t={t}
                            />
                        ))}
                    </div>
                </div>

                {/* Workspace menus */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Monitor className="w-4 h-4 text-primary" />
                        <h4 className="text-sm font-semibold">工作台菜单</h4>
                        <span className="text-xs text-muted-foreground ml-1">（工作台入口及功能）</span>
                    </div>
                    <div className="border rounded-lg divide-y">
                        {WORKSPACE_MENUS.map((item) => (
                            <MenuRow
                                key={item.key}
                                item={item}
                                enabled={isEnabled(item.key, item.fixed)}
                                customName={getCustomName(item.key)}
                                onToggle={(v) => updateEntry(item.key, { enabled: v })}
                                onNameChange={(name) => updateEntry(item.key, { customName: name || undefined })}
                                t={t}
                            />
                        ))}
                    </div>
                </div>

                <p className="text-xs text-muted-foreground">
                    提示：菜单配置为全局设置，影响所有用户。各角色的菜单权限仍受角色管理中的配置控制。
                </p>
            </div>
        </div>
    );
}

// ============================================================
// MenuRow – supports inline name editing
// ============================================================

function MenuRow({
    item,
    enabled,
    customName,
    onToggle,
    onNameChange,
    t,
}: {
    item: MenuItem;
    enabled: boolean;
    customName: string;
    onToggle: (v: boolean) => void;
    onNameChange: (name: string) => void;
    t: (key: string) => string;
}) {
    const defaultLabel = t(item.labelKey)?.replace(/\s+/g, "") || item.fallbackLabel;
    const displayLabel = customName || defaultLabel;

    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const startEdit = () => {
        setEditValue(customName || defaultLabel);
        setEditing(true);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const confirmEdit = () => {
        const trimmed = editValue.trim();
        // If same as default, clear custom name
        onNameChange(trimmed === defaultLabel ? "" : trimmed);
        setEditing(false);
    };

    const cancelEdit = () => {
        setEditing(false);
    };

    return (
        <div className="flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-md bg-accent/50 text-foreground">
                    {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                    {editing ? (
                        <div className="flex items-center gap-1.5">
                            <Input
                                ref={inputRef}
                                className="h-7 text-sm w-40"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") confirmEdit();
                                    if (e.key === "Escape") cancelEdit();
                                }}
                            />
                            <button
                                onClick={confirmEdit}
                                className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent text-primary"
                            >
                                <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={cancelEdit}
                                className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 group">
                            <Label className="text-sm font-medium truncate">{displayLabel}</Label>
                            {customName && (
                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0 rounded">自定义</span>
                            )}
                            <button
                                onClick={startEdit}
                                className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity"
                                title="编辑名称"
                            >
                                <Pencil className="w-3 h-3 text-muted-foreground" />
                            </button>
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {item.panel === "admin" ? "管理端" : "工作台"} · {item.key}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                {item.fixed ? (
                    <span className="text-xs text-muted-foreground bg-accent px-2 py-0.5 rounded">固定</span>
                ) : (
                    <Switch checked={enabled} onCheckedChange={onToggle} />
                )}
            </div>
        </div>
    );
}
