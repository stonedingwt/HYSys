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
import { CalendarClock, Check, ChevronDown, GanttChartIcon, Globe, Lock, MoonStar, Sun } from "lucide-react";
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
            <div className="flex justify-between h-[64px] bg-background-main relative z-[21]">
                <div className="w-[200px] min-w-[184px] flex items-center justify-center h-full">
                    <Link to='/' className="flex items-center gap-2">
                        <img src={getLogoUrl('login-logo-small')} className="w-[62px] rounded dark:hidden" alt="" />
                        <img src={getLogoUrl('logo-small-dark')} className="w-[62px] rounded hidden dark:block" alt="" />
                        <span className="text-[18px] font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap">元境</span>
                    </Link>
                </div>
                <div className="flex-grow">
                    {/* spacer */}
                </div>
                <div>
                    <HeaderMenu />
                </div>
                <div className="flex items-center gap-3 mr-6">
                    {/* Day/Night theme toggle */}
                    <button
                        className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent transition-colors"
                        onClick={() => setDark(!dark)}
                        title={dark ? '切换到白天模式' : '切换到黑夜模式'}
                    >
                        {dark
                            ? <Sun className="w-5 h-5 text-yellow-400" />
                            : <MoonStar className="w-5 h-5 text-muted-foreground" />
                        }
                    </button>
                    <span className="text-lg font-medium text-muted-foreground whitespace-nowrap">扬州赛乐服饰有限公司</span>
                </div>
            </div>
            <div className="flex" style={{ height: "calc(100vh - 64px)" }}>
                <div className="relative z-10 bg-background-main h-full w-[200px] min-w-[184px] px-3  shadow-x1 flex justify-between text-center ">
                    <nav className="">
                        {appConfig.benchMenu && menuEnabled('frontend') && (
                            <a
                                href="/workspace/"
                                target="_blank"
                                className={`navlink inline-flex  w-full px-6  h-12 mb-[3.5px]`}
                            >
                                <ApplicationIcon className="h-6 w-6 my-[12px]" />
                                <span className="mx-[14px] max-w-[100px] text-[14px] leading-[48px]">
                                    {menuLabel('frontend', 'menu.workspace')}
                                </span>
                            </a>
                        )}
                        {/* 任务中心和消息中心已移至工作台 */}
                        {
                            isMenu('board') && menuEnabled('board') && <>
                                <NavLink to='/dashboard ' className={`navlink inline-flex  w-full px-6  h-12 mb-[3.5px]`}>
                                    <DashboardIcon className="h-6 w-6 my-[12px]" /><span className="mx-[14px] max-w-[100px] text-[14px] leading-[48px]">{menuLabel('board', 'menu.dashboard')}</span>
                                </NavLink>
                            </>
                        }
                        {
                            isMenu('build') && menuEnabled('build') &&
                            <NavLink to='/build' className={`navlink inline-flex  w-full px-6  h-12 mb-[3.5px]`} >
                                <TechnologyIcon className="h-6 w-6 my-[12px]" /><span className="mx-[14px] max-w-[100px] text-[14px] leading-[48px]">{menuLabel('build', 'menu.skills')}</span>
                            </NavLink>
                        }
                        {
                            isMenu('knowledge') && menuEnabled('knowledge') &&
                            <NavLink to='/filelib' className={`navlink inline-flex  w-full px-6  h-12 mb-[3.5px]`}>
                                <KnowledgeIcon className="h-6 w-6 my-[12px]" /><span className="mx-[14px] max-w-[100px] text-[14px] leading-[48px]">{menuLabel('knowledge', 'menu.knowledge')}</span>
                            </NavLink>
                        }
                        {
                            user.role === 'admin' && menuEnabled('dataset') && <>
                                <NavLink to='/dataset' className={`navlink inline-flex  w-full px-6  h-12 mb-[3.5px]`}>
                                    <DatasetIcon className="h-6 w-6 my-[12px]" /><span className="mx-[14px] max-w-[100px] text-[14px] leading-[48px]">{menuLabel('dataset', 'menu.dataset')}</span>
                                </NavLink>
                            </>
                        }
                        {
                            isMenu('model') && menuEnabled('model') &&
                            <NavLink to='/model' className={`navlink inline-flex  w-full px-6  h-12 mb-[3.5px]`}>
                                <ModelIcon className="h-6 w-6 my-[12px]" /><span className="mx-[14px] max-w-[100px] text-[14px] leading-[48px]">{menuLabel('model', 'menu.models')}</span>
                            </NavLink>
                        }
                        {
                            isMenu('evaluation') && menuEnabled('evaluation') &&
                            <NavLink to='/evaluation' className={`navlink inline-flex  w-full px-6  h-12 mb-[3.5px]`}>
                                <EvaluatingIcon className="h-6 w-6 my-[12px]" /><span className="mx-[14px] max-w-[100px] text-[14px] leading-[48px]">{menuLabel('evaluation', 'menu.evaluation')}</span>
                            </NavLink>
                        }
                        {
                            menuEnabled('annotation') &&
                            <NavLink to='/label' className={`navlink inline-flex  w-full px-6  h-12 mb-[3.5px]`}>
                                <LabelIcon className="h-6 w-6 my-[12px]" /><span className="mx-[14px] max-w-[100px] text-[14px] leading-[48px]">{menuLabel('annotation', 'menu.annotation')}</span>
                            </NavLink>
                        }
                        {
                            isAdmin && menuEnabled('log') && <>
                                <NavLink to='/log' className={`navlink inline-flex  w-full px-6  h-12 mb-[3.5px]`}>
                                    <LogIcon className="h-6 w-6 my-[12px]" /><span className="mx-[14px] max-w-[100px] text-[14px] leading-[48px]">{menuLabel('log', 'menu.log')}</span>
                                </NavLink>
                            </>
                        }
                        {
                            isAdmin && <>
                                <NavLink to='/sys' className={`navlink inline-flex  w-full px-6  h-12 mb-[3.5px]`}>
                                    <SystemIcon className="h-6 w-6 my-[12px]" /><span className="mx-[14px] max-w-[100px] text-[14px] leading-[48px]">{menuLabel('system', 'menu.system')}</span>
                                </NavLink>
                            </>
                        }
                        {
                            isAdmin && menuEnabled('scheduled_task') &&
                            <NavLink to='/scheduled-tasks' className={`navlink inline-flex  w-full px-6  h-12 mb-[3.5px]`}>
                                <CalendarClock className="h-6 w-6 my-[12px]" /><span className="mx-[14px] max-w-[100px] text-[14px] leading-[48px]">{menuLabel('scheduled_task', 'menu.scheduledTask')}</span>
                            </NavLink>
                        }
                    </nav>
                    <div className="absolute left-0 bottom-0 w-[196px] p-2">
                        {/* User avatar + dropdown with language switcher between changePwd and logout */}
                        <div className="flex items-center h-7 my-4">
                            <img className="h-7 w-7 rounded-2xl mr-4" src={getLogoUrl('user-avatar')} alt="" />
                            <SelectHover
                                triagger={
                                    <span className="leading-8 text-[14px] mr-8 max-w-40 cursor-pointer text-ellipsis overflow-hidden whitespace-nowrap">
                                        {user.user_name} <ChevronDown className="inline-block mt-[-2px]" />
                                    </span>
                                }>
                                {isMenu('frontend') && <SelectHoverItem onClick={() => window.open('/workspace/')}><GanttChartIcon className="w-4 h-4 mr-1" /><span>{t('menu.workspace')}</span></SelectHoverItem>}
                                <SelectHoverItem onClick={JumpResetPage}><Lock className="w-4 h-4 mr-1" /><span>{t('menu.changePwd')}</span></SelectHoverItem>
                                {/* Language switcher - between changePwd and logout */}
                                <SelectHoverItem onClick={() => {
                                    const keys = Object.keys(options)
                                    const idx = keys.indexOf(language)
                                    const nextLang = keys[(idx + 1) % keys.length]
                                    changLanguage(nextLang)
                                }}>
                                    <Globe className="w-4 h-4 mr-1" /><span>{languageNames[language]}</span>
                                </SelectHoverItem>
                                <SelectHoverItem onClick={handleLogout}><QuitIcon className="w-4 h-4 mr-1" /><span>{t('menu.logout')}</span></SelectHoverItem>
                            </SelectHover>
                        </div>
                    </div>
                </div>
                <div className="flex-1 bg-background-main-content rounded-lg w-[calc(100vw-200px)]">
                    <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingIcon /></div>}>
                        <Outlet />
                    </Suspense>
                </div>
            </div>
        </div>

        {/* Mobile: removed blocking overlay to support mobile access */}
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