import { useRef, useState } from "react";
import { Button } from "@/components/mep-ui/button";
import { Label } from "@/components/mep-ui/label";
import { uploadLibFile, saveThemeApi } from "@/controllers/API";
import { useToast } from "@/components/mep-ui/toast/use-toast";
import { ImagePlus, RotateCcw, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";

// ============================================================
// Logo slot definitions
// ============================================================

interface LogoSlot {
    key: string;
    label: string;
    description: string;
    /** Recommended dimensions, e.g. "410 x 120 px" */
    size: string;
    /** Supported file formats description */
    formats: string;
    defaultPath: string;
    accept: string;
    /** Aspect hint for preview: "wide" | "square" | "tall" */
    aspect: "wide" | "square" | "tall";
}

const LOGO_SLOTS: LogoSlot[] = [
    {
        key: "login-logo-small",
        label: "导航栏 Logo",
        description: "管理端和工作台页面左上角导航栏 Logo（浅色模式）",
        size: "410 x 120 px",
        formats: "PNG、JPG、SVG",
        defaultPath: "/assets/mep/login-logo-small.png",
        accept: "image/png,image/jpeg,image/svg+xml",
        aspect: "wide",
    },
    {
        key: "logo-small-dark",
        label: "导航栏 Logo（暗色）",
        description: "管理端和工作台页面左上角导航栏 Logo（暗色模式）",
        size: "342 x 108 px",
        formats: "PNG、JPG、SVG",
        defaultPath: "/assets/mep/logo-small-dark.png",
        accept: "image/png,image/jpeg,image/svg+xml",
        aspect: "wide",
    },
    {
        key: "login-logo-big",
        label: "登录页大图",
        description: "登录页面左侧展示大图（浅色模式）",
        size: "840 x 1408 px",
        formats: "PNG、JPG、SVG",
        defaultPath: "/assets/mep/login-logo-big.png",
        accept: "image/png,image/jpeg,image/svg+xml",
        aspect: "tall",
    },
    {
        key: "login-logo-dark",
        label: "登录页大图（暗色）",
        description: "登录页面左侧展示大图（暗色模式）",
        size: "420 x 704 px",
        formats: "PNG、JPG、SVG",
        defaultPath: "/assets/mep/login-logo-dark.png",
        accept: "image/png,image/jpeg,image/svg+xml",
        aspect: "tall",
    },
    {
        key: "favicon",
        label: "浏览器图标",
        description: "浏览器标签页显示的小图标（favicon）",
        size: "48 x 48 px",
        formats: "ICO、PNG、SVG",
        defaultPath: "/assets/mep/favicon.ico",
        accept: "image/x-icon,image/png,image/svg+xml",
        aspect: "square",
    },
    {
        key: "logo-report",
        label: "报告 Logo",
        description: "导出报告中使用的 Logo 图片",
        size: "395 x 395 px",
        formats: "PNG、JPG、SVG",
        defaultPath: "/assets/mep/logo.jpeg",
        accept: "image/png,image/jpeg,image/svg+xml",
        aspect: "wide",
    },
    {
        key: "user-avatar",
        label: "默认用户头像",
        description: "用户未设置头像时的默认头像",
        size: "64 x 64 px",
        formats: "PNG、JPG、SVG",
        defaultPath: "/assets/user.png",
        accept: "image/png,image/jpeg,image/svg+xml",
        aspect: "square",
    },
];

// ============================================================
// LogoConfig Component
// ============================================================

export type LogoMap = Record<string, string>;

interface LogoConfigProps {
    logos: LogoMap;
    onLogosChange: (logos: LogoMap) => void;
}

export default function LogoConfig({ logos, onLogosChange }: LogoConfigProps) {
    const { t } = useTranslation();
    const { message } = useToast();

    const handleUpload = async (slotKey: string, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        try {
            const resp = await uploadLibFile(formData, {}, "icon", null);
            const filePath: string = resp?.file_path || resp?.data?.file_path || "";
            if (filePath) {
                const newLogos = { ...logos, [slotKey]: filePath };
                onLogosChange(newLogos);
                message({
                    variant: "success",
                    title: "上传成功",
                    description: "Logo 已更新，保存后生效",
                });
            }
        } catch (e) {
            message({
                variant: "error" as any,
                title: "上传失败",
                description: String(e),
            });
        }
    };

    const handleReset = (slotKey: string) => {
        const newLogos = { ...logos };
        delete newLogos[slotKey];
        onLogosChange(newLogos);
    };

    return (
        <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {LOGO_SLOTS.map((slot) => (
                    <LogoCard
                        key={slot.key}
                        slot={slot}
                        customUrl={logos[slot.key]}
                        onUpload={(file) => handleUpload(slot.key, file)}
                        onReset={() => handleReset(slot.key)}
                    />
                ))}
            </div>
        </div>
    );
}

// ============================================================
// LogoCard – single logo upload card
// ============================================================

function LogoCard({
    slot,
    customUrl,
    onUpload,
    onReset,
}: {
    slot: LogoSlot;
    customUrl?: string;
    onUpload: (file: File) => void;
    onReset: () => void;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const displayUrl = customUrl || slot.defaultPath;
    const isCustom = !!customUrl;

    const aspectClass =
        slot.aspect === "tall"
            ? "h-[120px]"
            : slot.aspect === "square"
            ? "h-[80px] w-[80px]"
            : "h-[60px]";

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onUpload(file);
        e.target.value = "";
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith("image/")) onUpload(file);
    };

    return (
        <div
            className={`relative group border rounded-lg p-4 transition-all ${
                dragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
            }`}
            onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
        >
            {/* Custom badge */}
            {isCustom && (
                <span className="absolute top-2 right-2 text-[10px] bg-primary text-white px-1.5 py-0.5 rounded-full font-medium">
                    自定义
                </span>
            )}

            {/* Preview area */}
            <div className="flex items-center justify-center mb-3 bg-accent/30 rounded-md p-3 min-h-[80px]">
                <img
                    src={displayUrl}
                    alt={slot.label}
                    className={`object-contain max-w-full ${aspectClass}`}
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = slot.defaultPath;
                    }}
                />
            </div>

            {/* Info */}
            <div className="mb-3">
                <Label className="text-sm font-medium">{slot.label}</Label>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {slot.description}
                </p>
                <p className="text-[11px] text-primary/70 mt-1 font-medium">
                    建议尺寸：{slot.size}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                    支持格式：{slot.formats}
                </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1"
                    onClick={() => fileRef.current?.click()}
                >
                    <Upload className="w-3 h-3" />
                    {isCustom ? "重新上传" : "上传替换"}
                </Button>
                {isCustom && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1 text-muted-foreground"
                        onClick={onReset}
                    >
                        <RotateCcw className="w-3 h-3" />
                        恢复
                    </Button>
                )}
            </div>

            <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept={slot.accept}
                onChange={handleFileSelect}
            />
        </div>
    );
}
