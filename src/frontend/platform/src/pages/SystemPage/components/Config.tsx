import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import yaml from "js-yaml";
import { Button } from "../../../components/mep-ui/button";
import { Input, Textarea } from "../../../components/mep-ui/input";
import { Switch } from "../../../components/mep-ui/switch";
import { Label } from "../../../components/mep-ui/label";
import { RadioGroup, RadioGroupItem } from "../../../components/mep-ui/radio-group";
import { getSysConfigApi, setSysConfigApi, testKingdeeConnectionApi } from "../../../controllers/API/user";
import { captureAndAlertRequestErrorHoc } from "../../../controllers/request";
import { locationContext } from "@/contexts/locationContext";
import { useToast } from "@/components/mep-ui/toast/use-toast";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "../../../components/mep-ui/accordion";
import {
    BookOpen,
    Building2,
    CheckCircle2,
    ChevronDown,
    Database,
    FileText,
    Globe,
    KeyRound,
    LayoutList,
    Loader2,
    Lock,
    MessageSquare,
    Plug,
    RotateCcw,
    Save,
    Settings,
    Sparkles,
    Workflow,
    XCircle,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface ConfigSection {
    key: string;
    icon: React.ReactNode;
    label: string;
    description: string;
    fields: ConfigField[];
}

interface ConfigField {
    /** dot-separated YAML path, e.g. "knowledges.etl4lm.url" */
    path: string;
    label: string;
    description?: string;
    type: "text" | "number" | "boolean" | "textarea" | "password";
    placeholder?: string;
}

// ============================================================
// Schema – describes every editable field
// ============================================================

const buildSections = (t: (k: string) => string): ConfigSection[] => [
    {
        key: "knowledges",
        icon: <Database className="w-4 h-4" />,
        label: "知识库配置",
        description: "知识库文档解析模型服务配置",
        fields: [
            { path: "knowledges.etl4lm.url", label: "ETL4LM 服务地址", type: "text", placeholder: "http://192.168.106.12:8180/v1/etl4llm/predict", description: "文档解析模型服务地址，包括OCR、版式分析、表格识别等" },
            { path: "knowledges.etl4lm.timeout", label: "ETL4LM 超时(秒)", type: "number", description: "文档解析服务超时时间" },
            { path: "knowledges.etl4lm.ocr_sdk_url", label: "OCR SDK 地址", type: "text", placeholder: "留空使用内置OCR", description: "高精度OCR SDK服务地址，为空则使用轻量OCR模型" },
        ],
    },
    {
        key: "llm_request",
        icon: <Sparkles className="w-4 h-4" />,
        label: "LLM 请求配置",
        description: "技能 LLM 组件模型访问的超时配置",
        fields: [
            { path: "llm_request.request_timeout", label: "请求超时(秒)", type: "number", description: "LLM 请求的超时时间" },
            { path: "llm_request.max_retries", label: "最大重试次数", type: "number", description: "LLM 请求失败后的重试次数" },
        ],
    },
    {
        key: "default_operator",
        icon: <Globe className="w-4 h-4" />,
        label: "默认操作者",
        description: "免登录链接及访客访问配置",
        fields: [
            { path: "default_operator.user", label: "默认用户 ID", type: "number", description: "免登录链接行为记录的目标用户ID" },
            { path: "default_operator.enable_guest_access", label: "允许访客访问", type: "boolean", description: "免登录链接是否可访问" },
        ],
    },
    {
        key: "password_conf",
        icon: <Lock className="w-4 h-4" />,
        label: "密码安全策略",
        description: "密码有效期及登录错误封禁配置",
        fields: [
            { path: "password_conf.password_valid_period", label: "密码有效期(天)", type: "number", description: "密码超过该天数必须修改，0 为不限制" },
            { path: "password_conf.login_error_time_window", label: "错误时间窗口(分)", type: "number", description: "在该时间窗口内超过最大错误次数将封禁用户" },
            { path: "password_conf.max_error_times", label: "最大错误次数", type: "number", description: "超过后封禁用户，0 为不限制" },
        ],
    },
    {
        key: "system_login_method",
        icon: <KeyRound className="w-4 h-4" />,
        label: "登录方式",
        description: "多点登录及第三方登录配置",
        fields: [
            { path: "system_login_method.allow_multi_login", label: "允许多点登录", type: "boolean", description: "是否允许同一账号多端登录" },
            { path: "system_login_method.admin_username", label: "管理员用户名", type: "text", description: "第三方登录注册的管理员用户名" },
        ],
    },
    {
        key: "use_captcha",
        icon: <FileText className="w-4 h-4" />,
        label: "验证码",
        description: "登录页面验证码开关",
        fields: [
            { path: "use_captcha", label: "启用验证码", type: "boolean", description: "登录页面是否需要输入验证码" },
        ],
    },
    {
        key: "dialog_tips",
        icon: <MessageSquare className="w-4 h-4" />,
        label: "对话提示",
        description: "会话窗口底部提示文案",
        fields: [
            { path: "dialog_tips", label: "提示文案", type: "text", placeholder: "内容由AI生成，仅供参考！", description: "会话窗口底部显示的提示信息" },
        ],
    },
    {
        key: "env",
        icon: <Settings className="w-4 h-4" />,
        label: "环境配置",
        description: "Office 地址、注册开关、文件上传限制等",
        fields: [
            { path: "env.office_url", label: "OnlyOffice 地址", type: "text", placeholder: "http://IP:8701", description: "OnlyOffice 组件地址（浏览器需可直接访问）" },
            { path: "env.show_github_and_help", label: "显示 GitHub/帮助链接", type: "boolean", description: "是否在前端显示 GitHub 和帮助链接" },
            { path: "env.enable_registration", label: "开启注册", type: "boolean", description: "是否允许新用户注册" },
            { path: "env.uploaded_files_maximum_size", label: "上传大小限制(MB)", type: "number", description: "前端上传文件的最大限制" },
            { path: "env.dialog_quick_search", label: "快捷搜索地址", type: "text", placeholder: "http://www.baidu.com/s?wd=", description: "聊天窗口快捷搜索引擎地址" },
            { path: "env.websocket_url", label: "WebSocket 地址", type: "text", placeholder: "留空使用默认", description: "当网关不支持同端口混合 HTTP/WS 时使用" },
        ],
    },
    {
        key: "workflow",
        icon: <Workflow className="w-4 h-4" />,
        label: "工作流配置",
        description: "工作流运行步数与超时设置",
        fields: [
            { path: "workflow.max_steps", label: "最大运行步数", type: "number", description: "工作流节点运行的最大步数，防止死循环" },
            { path: "workflow.timeout", label: "超时时间(分钟)", type: "number", description: "等待用户输入的超时时间" },
        ],
    },
    {
        key: "linsight",
        icon: <Sparkles className="w-4 h-4" />,
        label: "灵境配置",
        description: "灵境模块的 Token、步数、重试等配置",
        fields: [
            { path: "linsight.tool_buffer", label: "工具消息 Token 上限", type: "number", description: "历史记录中工具消息的最大 Token，超过后将总结历史" },
            { path: "linsight.max_steps", label: "最大执行步数", type: "number", description: "单个任务最大执行步数，防止死循环" },
            { path: "linsight.retry_num", label: "模型调用重试次数", type: "number", description: "任务执行中模型调用的重试次数" },
            { path: "linsight.retry_sleep", label: "重试间隔(秒)", type: "number", description: "模型调用重试之间的间隔时间" },
            { path: "linsight.max_file_num", label: "SOP 最大文件数", type: "number", description: "生成 SOP 时 prompt 放的用户文件数量" },
            { path: "linsight.max_knowledge_num", label: "SOP 最大知识库数", type: "number", description: "生成 SOP 时 prompt 放的知识库最大数量" },
            { path: "linsight.file_content_length", label: "文件截断字符数", type: "number", description: "拆分二级任务时读取文件内容的最大字符数" },
            { path: "linsight.default_temperature", label: "默认温度", type: "number", description: "灵境模型默认温度值" },
            { path: "linsight.retry_temperature", label: "重试温度", type: "number", description: "JSON 格式失败重试时的温度值" },
        ],
    },
    {
        key: "kingdee",
        icon: <Building2 className="w-4 h-4" />,
        label: "金蝶K3Cloud配置",
        description: "金蝶K3Cloud ERP系统接口凭证配置",
        fields: [
            { path: "kingdee.base_url", label: "API 地址", type: "text", placeholder: "http://122.195.141.186:1188/K3Cloud/Kingdee.BOS.WebApi", description: "金蝶K3Cloud WebApi 服务地址" },
            { path: "kingdee.acct_id", label: "账套 ID", type: "text", placeholder: "请输入金蝶账套ID", description: "金蝶K3Cloud 登录账套标识" },
            { path: "kingdee.username", label: "用户名", type: "text", placeholder: "请输入金蝶用户名", description: "金蝶K3Cloud 登录用户名" },
            { path: "kingdee.password", label: "密码", type: "password", placeholder: "请输入金蝶密码", description: "金蝶K3Cloud 登录密码" },
            { path: "kingdee.lcid", label: "语言 ID", type: "number", description: "语言标识，2052 为简体中文" },
        ],
    },
];

// ============================================================
// Helpers – deep get / set on plain objects
// ============================================================

function deepGet(obj: any, path: string): any {
    return path.split(".").reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

function deepSet(obj: any, path: string, value: any): any {
    const clone = JSON.parse(JSON.stringify(obj));
    const keys = path.split(".");
    let cur = clone;
    for (let i = 0; i < keys.length - 1; i++) {
        if (cur[keys[i]] == null) cur[keys[i]] = {};
        cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    return clone;
}

// ============================================================
// Component
// ============================================================

export default function Config() {
    const { toast, message } = useToast();
    const { reloadConfig } = useContext(locationContext);
    const { t } = useTranslation();

    const [configObj, setConfigObj] = useState<Record<string, any>>({});
    const [rawYaml, setRawYaml] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Track which accordion sections are open
    const [openSections, setOpenSections] = useState<string[]>(["knowledges", "env"]);

    // Kingdee connection test
    const [testingKingdee, setTestingKingdee] = useState(false);
    const [kingdeeTestResult, setKingdeeTestResult] = useState<{ success: boolean; message: string } | null>(null);

    const sections = useMemo(() => buildSections(t), [t]);

    // Load config from backend
    useEffect(() => {
        captureAndAlertRequestErrorHoc(
            getSysConfigApi().then((jsonstr: string) => {
                setRawYaml(jsonstr);
                try {
                    const parsed = yaml.load(jsonstr) as Record<string, any>;
                    setConfigObj(parsed || {});
                } catch {
                    setConfigObj({});
                }
                setLoading(false);
            })
        );
    }, []);

    // Update a single field
    const updateField = (path: string, value: any) => {
        setConfigObj((prev) => deepSet(prev, path, value));
    };

    // Save config
    const handleSave = async () => {
        setSaving(true);
        try {
            const yamlStr = yaml.dump(configObj, {
                indent: 2,
                lineWidth: -1,
                noRefs: true,
                quotingType: '"',
                forceQuotes: false,
            });
            await captureAndAlertRequestErrorHoc(
                setSysConfigApi({ data: yamlStr }).then(() => {
                    message({
                        variant: "success",
                        title: t("prompt"),
                        description: t("saved"),
                    });
                    setRawYaml(yamlStr);
                    reloadConfig();
                })
            );
        } catch {
            toast({
                variant: "error",
                title: t("prompt"),
                description: "保存失败",
            });
        }
        setSaving(false);
    };

    // Test Kingdee connection
    const handleTestKingdee = async () => {
        setTestingKingdee(true);
        setKingdeeTestResult(null);
        try {
            const result = await testKingdeeConnectionApi({
                base_url: deepGet(configObj, "kingdee.base_url") || "",
                acct_id: deepGet(configObj, "kingdee.acct_id") || "",
                username: deepGet(configObj, "kingdee.username") || "",
                password: deepGet(configObj, "kingdee.password") || "",
                lcid: deepGet(configObj, "kingdee.lcid") || 2052,
            });
            if (result) {
                setKingdeeTestResult(result);
            }
        } catch (e: any) {
            setKingdeeTestResult({
                success: false,
                message: typeof e === "string" ? e : (e?.message || "网络请求失败"),
            });
        }
        setTestingKingdee(false);
    };

    // Reset to last saved state
    const handleReset = () => {
        try {
            const parsed = yaml.load(rawYaml) as Record<string, any>;
            setConfigObj(parsed || {});
        } catch {
            setConfigObj({});
        }
        message({
            variant: "success",
            title: t("prompt"),
            description: "已恢复到上次保存的配置",
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-sm text-muted-foreground">加载配置中…</div>
            </div>
        );
    }

    return (
        <div className="max-w-[960px] mx-auto pb-10">
            {/* Header – sticky so save is always reachable */}
            <div className="sticky top-0 z-10 flex items-center justify-between pt-6 pb-4 mb-2 bg-background-main-content">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">{t("system.parameterConfig")}</h2>
                    <p className="text-sm text-muted-foreground mt-1">管理系统运行参数，修改后点击保存生效</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="h-9 px-4 gap-1.5"
                        onClick={handleReset}
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        重置
                    </Button>
                    <Button
                        className="h-9 px-6 gap-1.5 text-white"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        <Save className="w-3.5 h-3.5" />
                        {saving ? "保存中…" : t("save")}
                    </Button>
                </div>
            </div>

            {/* Sections */}
            <Accordion
                type="multiple"
                value={openSections}
                onValueChange={setOpenSections}
                className="space-y-3"
            >
                {sections.map((section) => (
                    <AccordionItem
                        key={section.key}
                        value={section.key}
                        className="border rounded-lg bg-background-login dark:bg-gray-900/50 px-5 overflow-hidden"
                    >
                        <AccordionTrigger className="hover:no-underline py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary">
                                    {section.icon}
                                </div>
                                <div className="text-left">
                                    <div className="font-medium text-sm">{section.label}</div>
                                    <div className="text-xs text-muted-foreground font-normal">{section.description}</div>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-5">
                            <div className="grid gap-5 pt-1">
                                {section.fields.map((field) => (
                                    <FieldRow
                                        key={field.path}
                                        field={field}
                                        value={deepGet(configObj, field.path)}
                                        onChange={(v) => updateField(field.path, v)}
                                    />
                                ))}
                                {/* Login method section: third-party SSO config */}
                                {section.key === "system_login_method" && (
                                    <LoginMethodPanel
                                        configObj={configObj}
                                        updateField={updateField}
                                    />
                                )}
                                {/* Kingdee section: connection test */}
                                {section.key === "kingdee" && (
                                    <div className="mt-2 pt-4 border-t border-border">
                                        <div className="flex items-center gap-3 px-3">
                                            <Button
                                                variant="outline"
                                                className="h-9 px-4 gap-1.5"
                                                onClick={handleTestKingdee}
                                                disabled={testingKingdee}
                                            >
                                                {testingKingdee ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Plug className="w-3.5 h-3.5" />
                                                )}
                                                {testingKingdee ? "测试中…" : "测试连接"}
                                            </Button>
                                            {kingdeeTestResult && (
                                                <div className={`flex items-center gap-1.5 text-sm ${kingdeeTestResult.success ? "text-green-600" : "text-red-600"}`}>
                                                    {kingdeeTestResult.success ? (
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4" />
                                                    )}
                                                    <span>{kingdeeTestResult.message}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
}

// ============================================================
// FieldRow – renders the correct input for each field type
// ============================================================

function FieldRow({
    field,
    value,
    onChange,
}: {
    field: ConfigField;
    value: any;
    onChange: (v: any) => void;
}) {
    const id = `cfg-${field.path}`;

    const labelBlock = (
        <div className="min-w-0">
            <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
                {field.label}
            </Label>
            {field.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{field.description}</p>
            )}
        </div>
    );

    if (field.type === "boolean") {
        const checked = value === true || value === "true" || value === "True";
        return (
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 py-3 px-3 rounded-md hover:bg-accent/30 transition-colors">
                {labelBlock}
                <Switch
                    id={id}
                    checked={checked}
                    onCheckedChange={(c) => onChange(c)}
                />
            </div>
        );
    }

    if (field.type === "number") {
        return (
            <div className="grid grid-cols-[1fr_180px] items-center gap-x-4 py-3 px-3 rounded-md hover:bg-accent/30 transition-colors">
                {labelBlock}
                <Input
                    id={id}
                    type="number"
                    className="h-8 text-right"
                    value={value ?? ""}
                    placeholder={field.placeholder}
                    onChange={(e) => {
                        const v = e.target.value;
                        onChange(v === "" ? "" : Number(v));
                    }}
                />
            </div>
        );
    }

    if (field.type === "textarea") {
        return (
            <div className="py-3 px-3 rounded-md hover:bg-accent/30 transition-colors">
                {labelBlock}
                <Textarea
                    id={id}
                    className="mt-2"
                    value={value ?? ""}
                    placeholder={field.placeholder}
                    onChange={(e) => onChange(e.target.value)}
                />
            </div>
        );
    }

    // text / password – horizontal grid matching other field types
    return (
        <div className="grid grid-cols-[1fr_320px] items-center gap-x-4 py-3 px-3 rounded-md hover:bg-accent/30 transition-colors">
            {labelBlock}
            <Input
                id={id}
                type={field.type === "password" ? "password" : "text"}
                className="h-8"
                value={value ?? ""}
                placeholder={field.placeholder}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}

// ============================================================
// SSO Login Provider Definitions
// ============================================================

interface SSOProvider {
    key: string;
    label: string;
    description: string;
    fields: { path: string; label: string; placeholder?: string; description?: string }[];
}

const SSO_PROVIDERS: SSOProvider[] = [
    {
        key: "dingtalk",
        label: "钉钉登录",
        description: "通过钉钉扫码或授权进行登录",
        fields: [
            { path: "system_login_method.dingtalk.app_key", label: "App Key", placeholder: "钉钉应用的 AppKey", description: "钉钉开放平台应用凭证" },
            { path: "system_login_method.dingtalk.app_secret", label: "App Secret", placeholder: "钉钉应用的 AppSecret", description: "钉钉开放平台应用密钥" },
            { path: "system_login_method.dingtalk.corp_id", label: "Corp ID", placeholder: "企业的 CorpId", description: "钉钉企业标识" },
            { path: "system_login_method.dingtalk.callback_url", label: "回调地址", placeholder: "https://your-domain.com/api/v1/auth/dingtalk/callback", description: "钉钉授权后的回调URL" },
        ],
    },
    {
        key: "wecom",
        label: "企业微信登录",
        description: "通过企业微信扫码或授权进行登录",
        fields: [
            { path: "system_login_method.wecom.corp_id", label: "Corp ID", placeholder: "企业微信的 CorpID", description: "企业微信企业标识" },
            { path: "system_login_method.wecom.agent_id", label: "Agent ID", placeholder: "企业微信应用的 AgentId", description: "企业微信自建应用ID" },
            { path: "system_login_method.wecom.secret", label: "Secret", placeholder: "企业微信应用的 Secret", description: "企业微信自建应用密钥" },
            { path: "system_login_method.wecom.callback_url", label: "回调地址", placeholder: "https://your-domain.com/api/v1/auth/wecom/callback", description: "企业微信授权后的回调URL" },
        ],
    },
    {
        key: "feishu",
        label: "飞书登录",
        description: "通过飞书扫码或授权进行登录",
        fields: [
            { path: "system_login_method.feishu.app_id", label: "App ID", placeholder: "飞书应用的 App ID", description: "飞书开放平台应用凭证" },
            { path: "system_login_method.feishu.app_secret", label: "App Secret", placeholder: "飞书应用的 App Secret", description: "飞书开放平台应用密钥" },
            { path: "system_login_method.feishu.callback_url", label: "回调地址", placeholder: "https://your-domain.com/api/v1/auth/feishu/callback", description: "飞书授权后的回调URL" },
        ],
    },
    {
        key: "aad",
        label: "Azure AD 登录",
        description: "通过 Microsoft Azure Active Directory 进行登录",
        fields: [
            { path: "system_login_method.aad.client_id", label: "Client ID", placeholder: "Azure AD 应用的 Application (client) ID", description: "Azure AD 应用注册的客户端ID" },
            { path: "system_login_method.aad.client_secret", label: "Client Secret", placeholder: "Azure AD 应用的客户端密钥", description: "Azure AD 应用注册的客户端密钥" },
            { path: "system_login_method.aad.tenant_id", label: "Tenant ID", placeholder: "Azure AD 的 Directory (tenant) ID", description: "Azure AD 租户标识" },
            { path: "system_login_method.aad.callback_url", label: "回调地址", placeholder: "https://your-domain.com/api/v1/auth/aad/callback", description: "Azure AD 授权后的回调URL" },
        ],
    },
];

// ============================================================
// LoginMethodPanel – third-party SSO login configuration
// ============================================================

function LoginMethodPanel({
    configObj,
    updateField,
}: {
    configObj: Record<string, any>;
    updateField: (path: string, value: any) => void;
}) {
    const currentType = deepGet(configObj, "system_login_method.sso_type") || "none";
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<any>(null);
    const { toast } = useToast();

    const handleSyncUsers = async () => {
        setSyncing(true);
        setSyncResult(null);
        try {
            const res = await fetch('/api/v1/sso/sync-users', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            const result = data?.data;
            setSyncResult(result);
            if (result?.error) {
                toast({ title: '同步失败', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '同步完成', description: `总计 ${result?.total ?? 0} 人，新建 ${result?.created ?? 0}，已存在 ${result?.existed ?? 0}` });
            }
        } catch (e: any) {
            toast({ title: '同步失败', description: e.message || '网络错误', variant: 'destructive' });
        }
        setSyncing(false);
    };

    const handleSSOTypeChange = (newType: string) => {
        // Set the new type
        updateField("system_login_method.sso_type", newType);
        // Set gateway_login based on whether an SSO is selected
        updateField("system_login_method.gateway_login", newType !== "none");
    };

    return (
        <div className="mt-1">
            {/* Separator */}
            <div className="border-t border-border mb-4 -mx-3" />

            <div className="px-3">
                <Label className="text-sm font-medium">第三方登录方式</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-4">
                    选择一种第三方登录方式进行配置，同时仅可启用一种
                </p>

                {/* Provider radio cards */}
                <RadioGroup
                    value={currentType}
                    onValueChange={handleSSOTypeChange}
                    className="grid gap-3"
                >
                    {/* None option */}
                    <label
                        htmlFor="sso-none"
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            currentType === "none"
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/40"
                        }`}
                    >
                        <RadioGroupItem value="none" id="sso-none" />
                        <div>
                            <div className="text-sm font-medium">不启用</div>
                            <div className="text-xs text-muted-foreground">仅使用系统账号密码登录</div>
                        </div>
                    </label>

                    {/* Provider options */}
                    {SSO_PROVIDERS.map((provider) => (
                        <div key={provider.key}>
                            <label
                                htmlFor={`sso-${provider.key}`}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                    currentType === provider.key
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/40"
                                }`}
                            >
                                <RadioGroupItem value={provider.key} id={`sso-${provider.key}`} />
                                <div className="flex-1">
                                    <div className="text-sm font-medium">{provider.label}</div>
                                    <div className="text-xs text-muted-foreground">{provider.description}</div>
                                </div>
                            </label>

                            {/* Expanded config fields when selected */}
                            {currentType === provider.key && (
                                <div className="ml-7 mt-2 mb-1 p-4 bg-accent/20 rounded-lg border border-dashed border-border space-y-4">
                                    <p className="text-xs font-medium text-muted-foreground mb-3">
                                        请填写 {provider.label} 的配置参数：
                                    </p>
                                    {provider.fields.map((field) => (
                                        <div key={field.path}>
                                            <Label htmlFor={`cfg-${field.path}`} className="text-sm font-medium">
                                                {field.label}
                                            </Label>
                                            {field.description && (
                                                <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">{field.description}</p>
                                            )}
                                            <Input
                                                id={`cfg-${field.path}`}
                                                type="text"
                                                className="h-8 mt-1"
                                                value={deepGet(configObj, field.path) ?? ""}
                                                placeholder={field.placeholder}
                                                onChange={(e) => updateField(field.path, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                    {/* 同步用户按钮 */}
                                    <div className="pt-3 border-t border-dashed border-border">
                                        <div className="flex items-center gap-3">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={syncing}
                                                onClick={handleSyncUsers}
                                                className="flex items-center gap-1.5"
                                            >
                                                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                                {syncing ? '同步中...' : '同步用户'}
                                            </Button>
                                            <span className="text-xs text-muted-foreground">从{provider.label.replace('登录', '')}同步用户到系统</span>
                                        </div>
                                        {syncResult && !syncResult.error && (
                                            <div className="mt-2 text-xs px-3 py-2 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 flex items-center gap-1.5">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                总计 {syncResult.total} 人，新建 {syncResult.created}，已存在 {syncResult.existed}{syncResult.skipped ? `，跳过 ${syncResult.skipped}` : ''}
                                            </div>
                                        )}
                                        {syncResult?.error && (
                                            <div className="mt-2 text-xs px-3 py-2 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 flex items-center gap-1.5">
                                                <XCircle className="w-3.5 h-3.5" />
                                                {syncResult.error}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </RadioGroup>
            </div>
        </div>
    );
}
