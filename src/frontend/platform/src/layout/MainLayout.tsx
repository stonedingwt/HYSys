import {
    ApplicationIcon,
    EvaluatingIcon,
    KnowledgeIcon,
    LabelIcon,
    LogIcon,
    ModelIcon,
    QuitIcon,
    SystemIcon,
    TechnologyIcon
} from "@/components/mep-icons";
import { LoadingIcon } from "@/components/mep-icons/loading";
import { DatasetIcon } from "@/components/mep-icons/menu/dataset";
import { DashboardIcon } from "@/components/mep-icons/menu/system";
import { bsConfirm } from "@/components/mep-ui/alertDialog/useConfirm";
import { SelectHover, SelectHoverItem } from "@/components/mep-ui/select/hover";
import { locationContext } from "@/contexts/locationContext";
import i18next from "i18next";
import { BookOpen, CalendarClock, Check, ChevronDown, GanttChartIcon, Globe, Lock, MoonStar, Sun } from "lucide-react";
import { Suspense, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Separator } from "../components/mep-ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/mep-ui/tooltip";
import { darkContext } from "../contexts/darkContext";
import { userContext } from "../contexts/userContext";
import { getSysConfigApi, logoutApi } from "../controllers/API/user";
import { captureAndAlertRequestErrorHoc } from "../controllers/request";
import { User } from "../types/api/user";
import { getLogoUrl } from "../util/logoUtils";
import yaml from "js-yaml";
import HeaderMenu from "./HeaderMenu";

export default function MainLayout() {
    const { dark, setDark } = useContext(darkContext);
    const { appConfig } = useContext(locationContext)
    // 角色
    const { user, setUser } = useContext(userContext);
    const { language, languageNames, options, changLanguage, t } = useLanguage(user)

    const handleLogout = () => {
        bsConfirm({
            title: `${t('prompt')}!`,
            desc: `${t('menu.logoutContent')}？`,
            okTxt: t('system.confirm'),
            onOk(next) {
                captureAndAlertRequestErrorHoc(logoutApi()).then(_ => {
                    setUser(null)
                    localStorage.removeItem('isLogin')
                })
                next()
            }
        })
    }

    // 重置密码
    const navigator = useNavigate()
    const JumpResetPage = () => {
        localStorage.setItem('account', user.user_name)
        navigator('/reset')
    }

    // 系统管理员(超管、组超管)
    const isAdmin = useMemo(() => {
        return ['admin', 'group_admin'].includes(user.role)
    }, [user])

    const isMenu = (menu) => {
        return user.web_menu.includes(menu) || user.role === 'admin'
    }

    // Load menu_config from system config for custom names & visibility
    const [menuConfig, setMenuConfig] = useState<Record<string, { enabled: boolean; customName?: string }>>({})
    useEffect(() => {
        getSysConfigApi().then((res: any) => {
            try {
                const raw = typeof res === 'string' ? res : res?.data ?? ''
                const parsed = (yaml.load(raw) as Record<string, any>) || {}
                const mc = parsed.menu_config || {}
                const normalized: Record<string, { enabled: boolean; customName?: string }> = {}
                for (const [k, v] of Object.entries(mc)) {
                    if (typeof v === 'boolean') normalized[k] = { enabled: v }
                    else if (v && typeof v === 'object') normalized[k] = { enabled: (v as any).enabled !== false, customName: (v as any).customName }
                    else normalized[k] = { enabled: true }
                }
                setMenuConfig(normalized)
            } catch { /* ignore */ }
        }).catch(() => { /* ignore */ })
    }, [])

    /** Get display name for a menu key. Uses customName from menu_config if set, otherwise falls back to i18n */
    const menuLabel = (key: string, i18nKey: string) => {
        const entry = menuConfig[key]
        if (entry?.customName) return entry.customName
        return t(i18nKey)
    }

    /** Check if a menu is enabled in menu_config (default true) */
    const menuEnabled = (key: string) => {
        const entry = menuConfig[key]
        return entry ? entry.enabled !== false : true
    }

    return <div className="flex">
        <div className="bg-background-main w-full h-screen">
            <div className="flex justify-between h-[56px] bg-white dark:bg-navy-900 relative z-[21] border-b border-slate-200/60 dark:border-navy-700/60 shadow-[0_1px_3px_rgba(12,26,46,0.04)]">
                <div className="w-[200px] min-w-[184px] flex items-center justify-center h-full">
                    <Link to='/' className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
                        <img src={getLogoUrl('login-logo-small')} className="w-[56px] rounded dark:hidden" alt="" />
                        <img src={getLogoUrl('logo-small-dark')} className="w-[56px] rounded hidden dark:block" alt="" />
                        <span className="text-[17px] font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap tracking-tight">{(window as any).ThemeStyle?.branding?.systemName || '元境'}</span>
                        <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 rounded">AI</span>
                    </Link>
                </div>
                <div className="flex-grow">
                    {/* spacer */}
                </div>
                <div>
                    <HeaderMenu />
                </div>
                <div className="flex items-center gap-3 mr-6">
                    <button
                        className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-navy-50 dark:hover:bg-navy-800 transition-all duration-150 active:scale-95"
                        onClick={() => setDark(!dark)}
                        title={dark ? '切换到白天模式' : '切换到黑夜模式'}
                    >
                        {dark
                            ? <Sun className="w-[18px] h-[18px] text-yellow-400" />
                            : <MoonStar className="w-[18px] h-[18px] text-slate-400" />
                        }
                    </button>
                    <span className="text-sm font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">{(window as any).ThemeStyle?.branding?.companyName || ''}</span>
                </div>
            </div>
            <div className="flex" style={{ height: "calc(100vh - 56px)" }}>
                <div className="relative z-10 bg-white dark:bg-navy-900 h-full w-[200px] min-w-[184px] px-2 flex justify-between text-center border-r border-slate-200/60 dark:border-navy-700/60">
                    <nav className="w-full pt-2 space-y-0.5">
                        {appConfig.benchMenu && menuEnabled('frontend') && (
                            <a
                                href="/"
                                target="_blank"
                                className="navlink flex items-center w-full px-4 h-10 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-navy-50 dark:hover:bg-navy-800 transition-colors"
                            >
                                <ApplicationIcon className="h-5 w-5 shrink-0" />
                                <span className="ml-3 text-[13px] truncate">
                                    {menuLabel('frontend', 'menu.workspace')}
                                </span>
                            </a>
                        )}
                        {
                            isMenu('board') && menuEnabled('board') &&
                            <NavLink to='/dashboard' className="navlink flex items-center w-full px-4 h-10 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-navy-50 dark:hover:bg-navy-800 transition-colors">
                                <DashboardIcon className="h-5 w-5 shrink-0" /><span className="ml-3 text-[13px] truncate">{menuLabel('board', 'menu.dashboard')}</span>
                            </NavLink>
                        }
                        {
                            isMenu('build') && menuEnabled('build') &&
                            <NavLink to='/build' className="navlink flex items-center w-full px-4 h-10 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-navy-50 dark:hover:bg-navy-800 transition-colors">
                                <TechnologyIcon className="h-5 w-5 shrink-0" /><span className="ml-3 text-[13px] truncate">{menuLabel('build', 'menu.skills')}</span>
                            </NavLink>
                        }
                        {
                            isMenu('knowledge') && menuEnabled('knowledge') &&
                            <NavLink to='/filelib' className="navlink flex items-center w-full px-4 h-10 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-navy-50 dark:hover:bg-navy-800 transition-colors">
                                <KnowledgeIcon className="h-5 w-5 shrink-0" /><span className="ml-3 text-[13px] truncate">{menuLabel('knowledge', 'menu.knowledge')}</span>
                            </NavLink>
                        }
                        {
                            user.role === 'admin' && menuEnabled('dataset') &&
                            <NavLink to='/dataset' className="navlink flex items-center w-full px-4 h-10 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-navy-50 dark:hover:bg-navy-800 transition-colors">
                                <DatasetIcon className="h-5 w-5 shrink-0" /><span className="ml-3 text-[13px] truncate">{menuLabel('dataset', 'menu.dataset')}</span>
                            </NavLink>
                        }
                        {
                            isMenu('model') && menuEnabled('model') &&
                            <NavLink to='/model' className="navlink flex items-center w-full px-4 h-10 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-navy-50 dark:hover:bg-navy-800 transition-colors">
                                <ModelIcon className="h-5 w-5 shrink-0" /><span className="ml-3 text-[13px] truncate">{menuLabel('model', 'menu.models')}</span>
                            </NavLink>
                        }
                        {
                            isMenu('evaluation') && menuEnabled('evaluation') &&
                            <NavLink to='/evaluation' className="navlink flex items-center w-full px-4 h-10 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-navy-50 dark:hover:bg-navy-800 transition-colors">
                                <EvaluatingIcon className="h-5 w-5 shrink-0" /><span className="ml-3 text-[13px] truncate">{menuLabel('evaluation', 'menu.evaluation')}</span>
                            </NavLink>
                        }
                        {
                            menuEnabled('annotation') &&
                            <NavLink to='/label' className="navlink flex items-center w-full px-4 h-10 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-navy-50 dark:hover:bg-navy-800 transition-colors">
                                <LabelIcon className="h-5 w-5 shrink-0" /><span className="ml-3 text-[13px] truncate">{menuLabel('annotation', 'menu.annotation')}</span>
                            </NavLink>
                        }
                        {
                            isAdmin && menuEnabled('log') &&
                            <NavLink to='/log' className="navlink flex items-center w-full px-4 h-10 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-navy-50 dark:hover:bg-navy-800 transition-colors">
                                <LogIcon className="h-5 w-5 shrink-0" /><span className="ml-3 text-[13px] truncate">{menuLabel('log', 'menu.log')}</span>
                            </NavLink>
                        }
                        {
                            isAdmin &&
                            <NavLink to='/sys' className="navlink flex items-center w-full px-4 h-10 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-navy-50 dark:hover:bg-navy-800 transition-colors">
                                <SystemIcon className="h-5 w-5 shrink-0" /><span className="ml-3 text-[13px] truncate">{menuLabel('system', 'menu.system')}</span>
                            </NavLink>
                        }
                        {
                            isAdmin && menuEnabled('data_dict') &&
                            <NavLink to='/data-dict' className="navlink flex items-center w-full px-4 h-10 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-navy-50 dark:hover:bg-navy-800 transition-colors">
                                <BookOpen className="h-5 w-5 shrink-0" /><span className="ml-3 text-[13px] truncate">{menuLabel('data_dict', '数据字典')}</span>
                            </NavLink>
                        }
                        {
                            isAdmin && menuEnabled('scheduled_task') &&
                            <NavLink to='/scheduled-tasks' className="navlink flex items-center w-full px-4 h-10 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-navy-50 dark:hover:bg-navy-800 transition-colors">
                                <CalendarClock className="h-5 w-5 shrink-0" /><span className="ml-3 text-[13px] truncate">{menuLabel('scheduled_task', 'menu.scheduledTask')}</span>
                            </NavLink>
                        }
                    </nav>
                    <div className="absolute left-0 bottom-0 w-[196px] p-2">
                        <div className="border-t border-slate-200/60 dark:border-navy-700/60 pt-3">
                            <div className="flex items-center h-8 px-2">
                                <img className="h-7 w-7 rounded-full mr-3 ring-2 ring-navy-100 dark:ring-navy-700" src={getLogoUrl('user-avatar')} alt="" />
                                <SelectHover
                                    triagger={
                                        <span className="leading-8 text-[13px] mr-4 max-w-36 cursor-pointer text-ellipsis overflow-hidden whitespace-nowrap text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
                                            {user.user_name} <ChevronDown className="inline-block w-3.5 h-3.5 mt-[-1px] text-slate-400" />
                                        </span>
                                    }>
                                    {isMenu('frontend') && <SelectHoverItem onClick={() => window.open('/')}><GanttChartIcon className="w-4 h-4 mr-1.5 text-slate-400" /><span>{t('menu.workspace')}</span></SelectHoverItem>}
                                    <SelectHoverItem onClick={JumpResetPage}><Lock className="w-4 h-4 mr-1.5 text-slate-400" /><span>{t('menu.changePwd')}</span></SelectHoverItem>
                                    <SelectHoverItem onClick={() => {
                                        const keys = Object.keys(options)
                                        const idx = keys.indexOf(language)
                                        const nextLang = keys[(idx + 1) % keys.length]
                                        changLanguage(nextLang)
                                    }}>
                                        <Globe className="w-4 h-4 mr-1.5 text-slate-400" /><span>{languageNames[language]}</span>
                                    </SelectHoverItem>
                                    <SelectHoverItem onClick={handleLogout}><QuitIcon className="w-4 h-4 mr-1.5 text-slate-400" /><span>{t('menu.logout')}</span></SelectHoverItem>
                                </SelectHover>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex-1 bg-slate-50 dark:bg-navy-950 rounded-tl-xl w-[calc(100vw-200px)] overflow-hidden">
                    <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingIcon /></div>}>
                        <Outlet />
                    </Suspense>
                </div>
            </div>
        </div>
    </div >
};

const useLanguage = (user: User) => {
    const [language, setLanguage] = useState('zh-Hans')
    useEffect(() => {
        const lang = user.user_id ? localStorage.getItem('i18nextLng') : null
        if (lang) {
            setLanguage(lang === 'zh' ? 'zh-Hans' : lang)
        }
    }, [user])

    const { t } = useTranslation()
    const changLanguage = (ln: string) => {
        setLanguage(ln)
        localStorage.setItem('i18nextLng', ln)
        // workspace
        localStorage.removeItem('lang')
        document.cookie = `lang=${ln}; path=/; expires=${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()}`;
        i18next.changeLanguage(ln)
    }
    return {
        language,
        languageNames: { "zh-Hans": '中文', "en-US": 'English', ja: '日本語', vi: 'Tiếng Việt' },
        options: { "zh-Hans": '中文', "en-US": 'English', ja: '日本語', vi: 'Tiếng Việt' },
        changLanguage,
        t
    }
}