import { Button } from "@/components/mep-ui/button";
import { saveThemeApi } from "@/controllers/API";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import Example from "./Example";
import HSLitem from "./HSLitem";
import LogoConfig, { LogoMap } from "./LogoConfig";
import { RadioGroup, RadioGroupItem } from "@/components/mep-ui/radio";
import { Label } from "@/components/mep-ui/label";
import { useTranslation } from "react-i18next";

// Default theme configuration
const defaultTheme = {
    '--background': { h: 0, s: 0, l: 1 },
    '--foreground': { h: 222.2, s: 0.474, l: 0.112 },
    '--muted': { h: 210, s: 0.4, l: 0.98 },
    '--muted-foreground': { h: 215.4, s: 0.163, l: 0.469 },
    '--popover': { h: 0, s: 0, l: 1 },
    '--popover-foreground': { h: 222.2, s: 0.474, l: 0.112 },
    '--card': { h: 0, s: 0, l: 1 },
    '--card-foreground': { h: 222.2, s: 0.474, l: 0.112 },
    '--border': { h: 214.3, s: 0.218, l: 0.914 },
    '--input': { h: 223, s: 0.48, l: 0.44 },
    '--primary': { h: 220, s: 0.98, l: 0.45 },
    '--primary-foreground': { h: 210, s: 0.4, l: 0.98 },
    '--secondary': { h: 210, s: 0.4, l: 0.961 },
    '--secondary-foreground': { h: 222.2, s: 0.474, l: 0.112 },
    '--accent': { h: 210, s: 0.3, l: 0.961 },
    '--accent-foreground': { h: 222.2, s: 0.474, l: 0.112 },
    '--destructive': { h: 0, s: 1, l: 0.5 },
    '--destructive-foreground': { h: 210, s: 0.4, l: 0.98 },
    '--black-button': { h: 0, s: 0, l: 0.07 },
};

// Theme key mappings for internationalization
const themeKeys = {
    "--primary": "theme.primary",
    "--primary-foreground": "theme.primaryForeground",
    "--background": "theme.background",
    "--foreground": "theme.foreground",
    "--muted": "theme.muted",
    "--muted-foreground": "theme.mutedForeground",
    "--card": "theme.card",
    "--card-foreground": "theme.cardForeground",
    "--popover": "theme.popover",
    "--popover-foreground": "theme.popoverForeground",
    "--border": "theme.border",
    "--input": "theme.input",
    "--secondary": "theme.secondary",
    "--secondary-foreground": "theme.secondaryForeground",
    "--accent": "theme.accent",
    "--accent-foreground": "theme.accentForeground",
    "--destructive": "theme.destructive",
    "--destructive-foreground": "theme.destructiveForeground",
    "--ring": "theme.ring",
    "--radius": "theme.radius",
    "--warning": "theme.warning",
    "--warning-foreground": "theme.warningForeground",
    '--black-button': 'theme.blackButton',
};

export default function Theme() {
    const [theme, setTheme] = useState(Object.keys(window.ThemeStyle.comp).length ? window.ThemeStyle.comp : { ...defaultTheme });
    const [bg, setBg] = useState(window.ThemeStyle.bg || 'logo')
    const [logos, setLogos] = useState<LogoMap>(window.ThemeStyle.logos || {})
    const { t } = useTranslation()

    // Persist full ThemeStyle (comp + bg + logos)
    const persistAll = (comp: any, bgVal: string, logosVal: LogoMap) => {
        window.ThemeStyle = { comp, bg: bgVal, logos: logosVal }
        saveThemeApi(JSON.stringify({ comp, bg: bgVal, logos: logosVal }))
    }

    const applyTheme = (theme) => {
        Object.keys(theme).forEach(key => {
            document.documentElement.style.setProperty(key, handleHSLtoStr(theme[key]));
        });
        setTheme(theme);
        persistAll(theme, bg, logos)
    };

    // hsl -> '220 98% 95%'
    const handleHSLtoStr = (hsl) => {
        return `${hsl.h} ${hsl.s * 100}% ${hsl.l * 100}%`
    }

    const handleHSLChange = (name, hsl) => {
        const newTheme = {
            ...theme,
            [name]: hsl,
        };
        setTheme(newTheme);
        document.documentElement.style.setProperty(name, handleHSLtoStr(hsl));
        persistAll(newTheme, bg, logos)
    };

    const handleLogosChange = (newLogos: LogoMap) => {
        setLogos(newLogos)
        persistAll(theme, bg, newLogos)
    }

    return <div className="border-t bg-accent overflow-auto" style={{ height: 'calc(100vh - 64px - 48px)' }}>
        <div className="flex justify-center">
            <div className="w-96 py-4 pr-8 border-r ">
                <p className="flex justify-between items-center mb-4">
                    <span className="text-lg">{t('theme.colorConfig')}</span>
                    <Button className="right" variant="link" onClick={e => applyTheme({ ...defaultTheme })}><RefreshCw className="mr-1 size-4" />{t('theme.restoreDefault')}</Button>
                </p>
                <div className="grid grid-cols-2 gap-2 gap-x-8 my-8">
                    {
                        Object.keys(theme).map(key => {
                            return <HSLitem key={key} label={t(themeKeys[key])} name={key} value={theme[key]} onChange={handleHSLChange} />
                        })
                    }
                </div>
                <p className="flex justify-between items-center mb-4">
                    <span className="text-lg">{t('theme.workflowBackgroundConfig')}</span>
                </p>
                <RadioGroup value={bg} onValueChange={(val) => {
                    setBg(val)
                    persistAll(theme, val, logos)
                }}
                    className="flex space-x-2 h-[20px] mt-4 mb-6">
                    <div>
                        <Label className="flex justify-center">
                            <RadioGroupItem className="mr-2" value="logo" />{t('theme.mepLogo')}
                        </Label>
                    </div>
                    <div>
                        <Label className="flex justify-center">
                            <RadioGroupItem className="mr-2" value="gradient" />{t('theme.themeColorGradientEffect')}
                        </Label>
                    </div>
                </RadioGroup>
            </div>
            <div className="px-4 py-4 bg-card">
                <p className="text-xl mb-4">{t('theme.componentPreview')}</p>
                <div>
                    {/* Component list */}
                    <Example />
                </div>
            </div>
        </div>
        {/* Logo configuration section */}
        <div className="max-w-[960px] mx-auto py-6 px-4">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="text-lg font-medium">Logo 与图标配置</p>
                    <p className="text-sm text-muted-foreground mt-1">上传自定义 Logo 替换系统默认图片，支持拖拽上传</p>
                </div>
                {Object.keys(logos).length > 0 && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleLogosChange({})}>
                        <RefreshCw className="w-3.5 h-3.5" />
                        全部恢复默认
                    </Button>
                )}
            </div>
            <LogoConfig logos={logos} onLogosChange={handleLogosChange} />
        </div>
    </div>
};
