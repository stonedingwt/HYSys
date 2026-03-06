import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Database, Table2, Columns3, Search } from "lucide-react";

interface ColumnInfo {
    name: string;
    type: string;
    nullable: boolean;
    key: string;
    default: string | null;
    comment: string;
}

interface TableInfo {
    table_name: string;
    comment: string;
    row_count: number;
    columns: ColumnInfo[];
}

const TABLE_GROUPS: Record<string, { label: string; match: (name: string) => boolean }> = {
    "master": { label: "主数据 (master_*)", match: (n) => n.startsWith("master_") },
    "biz": { label: "业务流程 (biz_*)", match: (n) => n.startsWith("biz_") },
    "sys": { label: "系统配置 (sys_*)", match: (n) => n.startsWith("sys_") },
    "org": { label: "组织结构", match: (n) => n === "organization" },
    "platform": { label: "平台核心表", match: (n) => {
        const platformTables = [
            "assistant","assistantlink","auditlog","chatmessage","component","config",
            "dict_category","dict_item","evaluation","finetune","flow","flowversion",
            "group","groupresource","invitecode","knowledge","knowledgefile",
            "linsight_execute_task","linsight_session_version","linsight_sop","linsight_sop_record",
            "llm_model","llm_server","markappuser","markrecord","marktask",
            "message_session","modeldeploy","presettrain","qaknowledge","recallchunk",
            "role","roleaccess","scheduled_task","scheduled_task_log","server","sftmodel",
            "share_link","t_gpts_tools","t_gpts_tools_type","t_report","t_variable_value",
            "tag","taglink","template","user","user_link","user_organization","usergroup","userrole"
        ];
        return platformTables.includes(n);
    }},
    "other": { label: "其他", match: () => true },
};

export default function DatabaseManage() {
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetch("/api/db/meta/tables")
            .then(async (r) => {
                if (!r.ok) {
                    const txt = await r.text();
                    throw new Error(`HTTP ${r.status}: ${txt.substring(0, 200)}`);
                }
                const text = await r.text();
                try {
                    return JSON.parse(text);
                } catch (parseErr: any) {
                    throw new Error(
                        `JSON解析失败 (${text.length}字符, 前50: ${text.substring(0, 50)}): ${parseErr.message}`
                    );
                }
            })
            .then((data) => {
                setTables(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch((e) => {
                setError("加载失败: " + e.message);
                setLoading(false);
            });
    }, []);

    const toggleTable = (name: string) => {
        setExpandedTables((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
        });
    };

    const toggleGroup = (group: string) => {
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(group)) next.delete(group); else next.add(group);
            return next;
        });
    };

    const filteredTables = useMemo(() => {
        if (!search.trim()) return tables;
        const q = search.trim().toLowerCase();
        return tables.filter(
            (t) =>
                t.table_name.toLowerCase().includes(q) ||
                t.comment.toLowerCase().includes(q) ||
                t.columns.some((c) => c.name.toLowerCase().includes(q) || c.comment.toLowerCase().includes(q))
        );
    }, [tables, search]);

    const grouped = useMemo(() => {
        const result: Record<string, TableInfo[]> = {};
        const assigned = new Set<string>();
        const groupOrder = Object.keys(TABLE_GROUPS);

        for (const key of groupOrder) {
            const { match } = TABLE_GROUPS[key];
            const matched = filteredTables.filter((t) => !assigned.has(t.table_name) && match(t.table_name));
            if (matched.length > 0) {
                result[key] = matched;
                matched.forEach((t) => assigned.add(t.table_name));
            }
        }
        return result;
    }, [filteredTables]);

    const totalRows = tables.reduce((s, t) => s + t.row_count, 0);

    const keyBadge = (key: string) => {
        if (key === "PRI") return <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded">PK</span>;
        if (key === "MUL") return <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">IDX</span>;
        if (key === "UNI") return <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded">UNI</span>;
        return null;
    };

    if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">加载中...</div>;
    if (error) return <div className="flex items-center justify-center h-64 text-red-500">{error}</div>;

    return (
        <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
                <Database className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">数据库管理</h2>
                <span className="text-sm text-muted-foreground">
                    共 {tables.length} 张表 · {totalRows.toLocaleString()} 行数据
                </span>
            </div>

            <div className="mb-4 flex items-center gap-2">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="搜索表名、字段名或说明..."
                        className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                {search && (
                    <span className="text-sm text-muted-foreground">
                        找到 {filteredTables.length} 张表
                    </span>
                )}
            </div>

            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                <strong>命名规则：</strong>
                <span className="ml-1">
                    master_* = 主数据 | biz_* = 业务流程 | sys_* = 系统配置
                </span>
            </div>

            {Object.entries(grouped).map(([groupKey, groupTables]) => {
                const groupDef = TABLE_GROUPS[groupKey];
                const isCollapsed = collapsedGroups.has(groupKey);
                const groupRowCount = groupTables.reduce((s, t) => s + t.row_count, 0);

                return (
                    <div key={groupKey} className="mb-4">
                        <div
                            className="flex items-center gap-2 mb-2 cursor-pointer select-none"
                            onClick={() => toggleGroup(groupKey)}
                        >
                            {isCollapsed
                                ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            }
                            <Table2 className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-semibold">{groupDef?.label || groupKey}</h3>
                            <span className="text-xs text-muted-foreground">
                                ({groupTables.length} 表 · {groupRowCount.toLocaleString()} 行)
                            </span>
                        </div>

                        {!isCollapsed && (
                            <div className="border rounded-lg overflow-hidden ml-2">
                                {groupTables.map((table, idx) => (
                                    <div key={table.table_name} className={idx > 0 ? "border-t" : ""}>
                                        <div
                                            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => toggleTable(table.table_name)}
                                        >
                                            {expandedTables.has(table.table_name)
                                                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                            }
                                            <code className="text-sm font-mono font-medium text-primary">{table.table_name}</code>
                                            {table.comment && <span className="text-xs text-muted-foreground">{table.comment}</span>}
                                            <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                                                {table.row_count.toLocaleString()} 行 · {table.columns.length} 列
                                            </span>
                                        </div>

                                        {expandedTables.has(table.table_name) && (
                                            <div className="px-4 pb-3">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="text-left text-muted-foreground border-b">
                                                            <th className="pb-2 pl-6 font-medium w-[220px]">字段名</th>
                                                            <th className="pb-2 font-medium w-[180px]">类型</th>
                                                            <th className="pb-2 font-medium w-[50px]">索引</th>
                                                            <th className="pb-2 font-medium w-[50px]">可空</th>
                                                            <th className="pb-2 font-medium">说明</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {table.columns.map((col) => (
                                                            <tr key={col.name} className="border-b last:border-0 hover:bg-muted/30">
                                                                <td className="py-1.5 pl-6">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Columns3 className="w-3 h-3 text-muted-foreground shrink-0" />
                                                                        <code className="text-xs font-mono">{col.name}</code>
                                                                    </div>
                                                                </td>
                                                                <td className="py-1.5">
                                                                    <span className="text-xs text-muted-foreground font-mono">{col.type}</span>
                                                                </td>
                                                                <td className="py-1.5">{keyBadge(col.key)}</td>
                                                                <td className="py-1.5">
                                                                    <span className={`text-xs ${col.nullable ? "text-muted-foreground" : "text-orange-600 font-medium"}`}>
                                                                        {col.nullable ? "是" : "否"}
                                                                    </span>
                                                                </td>
                                                                <td className="py-1.5 text-xs text-muted-foreground">{col.comment}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
