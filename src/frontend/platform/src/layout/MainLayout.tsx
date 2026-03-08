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
import { BookOpen, CalendarClock, ChevronDown, ChevronsLeft, ChevronsRight, GanttChartIcon, Globe, Lock, MoonStar, Sun } from "lucide-react";
import { Suspense, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { darkContext } from "../contexts/darkContext";
import { userContext } from "../contexts/userContext";
import { getSysConfigApi, logoutApi } from "../controllers/API/user";
import { captureAndAlertRequestErrorHoc } from "../controllers/request";
import { User } from "../types/api/user";
import { getLogoUrl } from "../util/logoUtils";
import yaml from "js-yaml";
import HeaderMenu from "./HeaderMenu";

type SidebarMode = 'expanded' | 'icon';

export default function MainLayout() {
    const { dark, setDark } = useContext(darkContext);
    const { appConfig } = useContext(locationContext);
    const { user, setUser } = useContext(userContext);
    const { language, languageNames, options, changLanguage, t } = useLanguage(user);

    const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => {
        return (localStorage.getItem('platform-sidebar') as SidebarMode) || 'expanded';
    });
    const isExpanded = sidebarMode === 'expanded';
    const sidebarWidth = isExpanded ? 240 : 64;

    useEffect(() => {
        localStorage.setItem('platform-sidebar', sidebarMode);
    }, [sidebarMode]);

    const handleLogout = () => {
        bsConfirm({
            title: `${t('prompt')}!`,
            desc: `${t('menu.logoutContent')}？`,
            okTxt: t('system.confirm'),
            onOk(next) {
                captureAndAlertRequestErrorHoc(logoutApi()).then(_ => {
                    setUser(null);
                    localStorage.removeItem('isLogin');
                });
                next();
            }
        });
    };

    const navigator = useNavigate();
    const JumpResetPage = () => {
        localStorage.setItem('account', user.user_name);
        navigator('/reset');
    };

    const isAdmin = useMemo(() => ['admin', 'group_admin'].includes(user.role), [user]);
    const isMenu = (menu) => user.web_menu.includes(menu) || user.role === 'admin';

    const [menuConfig, setMenuConfig] = useState<Record<string, { enabled: boolean; customName?: string }>>({});
    useEffect(() => {
        getSysConfigApi().then((res: any) => {
            try {
                const raw = typeof res === 'string' ? res : res?.data ?? '';
                const parsed = (yaml.load(raw) as Record<string, any>) || {};
                const mc = parsed.menu_config || {};
                const normalized: Record<string, { enabled: boolean; customName?: string }> = {};
                for (const [k, v] of Object.entries(mc)) {
                    if (typeof v === 'boolean') normalized[k] = { enabled: v };
                    else if (v && typeof v === 'object') normalized[k] = { enabled: (v as any).enabled !== false, customName: (v as any).customName };
                    else normalized[k] = { enabled: true };
                }
                setMenuConfig(normalized);
            } catch { /* ignore */ }
        }).catch(() => { /* ignore */ });
    }, []);

    const menuLabel = (key: string, i18nKey: string) => menuConfig[key]?.customName || t(i18nKey);
    const menuEnabled = (key: string) => { const entry = menuConfig[key]; return entry ? entry.enabled !== false : true; };

    const navLinkClass = "navlink flex items-center w-full h-10 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors";

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-[#030712]">
            {/* Sidebar */}
            <aside
                className="flex flex-col h-full bg-white/80 dark:bg-[rgba(10,15,30,0.7)] dark:backdrop-blur-[40px] dark:saturate-[180%] border-r border-slate-200/60 dark:border-white/[0.06] flex-shrink-0 transition-[width] duration-200 ease-out overflow-hidden"
                style={{ width: sidebarWidth }}
            >
                {/* Logo */}
                <div className={`flex items-center flex-shrink-0 h-14 ${isExpanded ? 'px-4' : 'justify-center px-2'}`}>
                    <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
                        <img src={getLogoUrl('login-logo-small')} className={`rounded dark:hidden ${isExpanded ? 'w-7' : 'w-7'}`} alt="" />
                        <img src={getLogoUrl('logo-small-dark')} className={`rounded hidden dark:block ${isExpanded ? 'w-7' : 'w-7'}`} alt="" />
                        {isExpanded && (
                            <span className="text-[15px] font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap tracking-tight">
                                {(window as any).ThemeStyle?.branding?.systemName || '元境'}
                            </span>
                        )}
                    </Link>
                </div>

                {/* Navigation */}
                <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-0.5 ${isExpanded ? 'px-3' : 'px-2'}`}>
                    {appConfig.benchMenu && menuEnabled('frontend') && (
                        <a href="/" target="_blank" className={navLinkClass} style={isExpanded ? { padding: '0 12px' } : { justifyContent: 'center' }} title={!isExpanded ? menuLabel('frontend', 'menu.workspace') : undefined}>
                            <ApplicationIcon className="h-[18px] w-[18px] shrink-0" />
                            {isExpanded && <span className="ml-3 text-[13px] truncate">{menuLabel('frontend', 'menu.workspace')}</span>}
                        </a>
                    )}
                    {isMenu('board') && menuEnabled('board') && (
                        <NavLink to="/dashboard" className={navLinkClass} style={isExpanded ? { padding: '0 12px' } : { justifyContent: 'center' }} title={!isExpanded ? menuLabel('board', 'menu.dashboard') : undefined}>
                            <DashboardIcon className="h-[18px] w-[18px] shrink-0" />{isExpanded && <span className="ml-3 text-[13px] truncate">{menuLabel('board', 'menu.dashboard')}</span>}
                        </NavLink>
                    )}
                    {isMenu('build') && menuEnabled('build') && (
                        <NavLink to="/build" className={navLinkClass} style={isExpanded ? { padding: '0 12px' } : { justifyContent: 'center' }} title={!isExpanded ? menuLabel('build', 'menu.skills') : undefined}>
                            <TechnologyIcon className="h-[18px] w-[18px] shrink-0" />{isExpanded && <span className="ml-3 text-[13px] truncate">{menuLabel('build', 'menu.skills')}</span>}
                        </NavLink>
                    )}
                    {isMenu('knowledge') && menuEnabled('knowledge') && (
                        <NavLink to="/filelib" className={navLinkClass} style={isExpanded ? { padding: '0 12px' } : { justifyContent: 'center' }} title={!isExpanded ? menuLabel('knowledge', 'menu.knowledge') : undefined}>
                            <KnowledgeIcon className="h-[18px] w-[18px] shrink-0" />{isExpanded && <span className="ml-3 text-[13px] truncate">{menuLabel('knowledge', 'menu.knowledge')}</span>}
                        </NavLink>
                    )}
                    {user.role === 'admin' && menuEnabled('dataset') && (
                        <NavLink to="/dataset" className={navLinkClass} style={isExpanded ? { padding: '0 12px' } : { justifyContent: 'center' }} title={!isExpanded ? menuLabel('dataset', 'menu.dataset') : undefined}>
                            <DatasetIcon className="h-[18px] w-[18px] shrink-0" />{isExpanded && <span className="ml-3 text-[13px] truncate">{menuLabel('dataset', 'menu.dataset')}</span>}
                        </NavLink>
                    )}
                    {isMenu('model') && menuEnabled('model') && (
                        <NavLink to="/model" className={navLinkClass} style={isExpanded ? { padding: '0 12px' } : { justifyContent: 'center' }} title={!isExpanded ? menuLabel('model', 'menu.models') : undefined}>
                            <ModelIcon className="h-[18px] w-[18px] shrink-0" />{isExpanded && <span className="ml-3 text-[13px] truncate">{menuLabel('model', 'menu.models')}</span>}
                        </NavLink>
                    )}
                    {isMenu('evaluation') && menuEnabled('evaluation') && (
                        <NavLink to="/evaluation" className={navLinkClass} style={isExpanded ? { padding: '0 12px' } : { justifyContent: 'center' }} title={!isExpanded ? menuLabel('evaluation', 'menu.evaluation') : undefined}>
                            <EvaluatingIcon className="h-[18px] w-[18px] shrink-0" />{isExpanded && <span className="ml-3 text-[13px] truncate">{menuLabel('evaluation', 'menu.evaluation')}</span>}
                        </NavLink>
                    )}
                    {menuEnabled('annotation') && (
                        <NavLink to="/label" className={navLinkClass} style={isExpanded ? { padding: '0 12px' } : { justifyContent: 'center' }} title={!isExpanded ? menuLabel('annotation', 'menu.annotation') : undefined}>
                            <LabelIcon className="h-[18px] w-[18px] shrink-0" />{isExpanded && <span className="ml-3 text-[13px] truncate">{menuLabel('annotation', 'menu.annotation')}</span>}
                        </NavLink>
                    )}
                    {isAdmin && menuEnabled('log') && (
                        <NavLink to="/log" className={navLinkClass} style={isExpanded ? { padding: '0 12px' } : { justifyContent: 'center' }} title={!isExpanded ? menuLabel('log', 'menu.log') : undefined}>
                            <LogIcon className="h-[18px] w-[18px] shrink-0" />{isExpanded && <span className="ml-3 text-[13px] truncate">{menuLabel('log', 'menu.log')}</span>}
                        </NavLink>
                    )}
                    {isAdmin && (
                        <NavLink to="/sys" className={navLinkClass} style={isExpanded ? { padding: '0 12px' } : { justifyContent: 'center' }} title={!isExpanded ? menuLabel('system', 'menu.system') : undefined}>
                            <SystemIcon className="h-[18px] w-[18px] shrink-0" />{isExpanded && <span className="ml-3 text-[13px] truncate">{menuLabel('system', 'menu.system')}</span>}
                        </NavLink>
                    )}
                    {isAdmin && menuEnabled('data_dict') && (
                        <NavLink to="/data-dict" className={navLinkClass} style={isExpanded ? { padding: '0 12px' } : { justifyContent: 'center' }} title={!isExpanded ? menuLabel('data_dict', '数据字典') : undefined}>
                            <BookOpen className="h-[18px] w-[18px] shrink-0" />{isExpanded && <span className="ml-3 text-[13px] truncate">{menuLabel('data_dict', '数据字典')}</span>}
                        </NavLink>
                    )}
                    {isAdmin && menuEnabled('scheduled_task') && (
                        <NavLink to="/scheduled-tasks" className={navLinkClass} style={isExpanded ? { padding: '0 12px' } : { justifyContent: 'center' }} title={!isExpanded ? menuLabel('scheduled_task', 'menu.scheduledTask') : undefined}>
                            <CalendarClock className="h-[18px] w-[18px] shrink-0" />{isExpanded && <span className="ml-3 text-[13px] truncate">{menuLabel('scheduled_task', 'menu.scheduledTask')}</span>}
                        </NavLink>
                    )}
                </nav>

                {/* User area */}
                <div className={`flex-shrink-0 border-t border-slate-100 dark:border-white/[0.06] p-2 ${isExpanded ? '' : 'flex flex-col items-center'}`}>
                    {isExpanded ? (
                        <div className="flex items-center h-10 px-2 gap-2">
                            <div className="w-7 h-7 rounded-full bg-cyan-500 text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
                                {(user.user_name || 'U').substring(0, 2).toUpperCase()}
                            </div>
                            <SelectHover
                                triagger={
                                    <span className="text-[13px] cursor-pointer text-ellipsis overflow-hidden whitespace-nowrap text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
                                        {user.user_name} <ChevronDown className="inline-block w-3 h-3 mt-[-1px] text-slate-400" />
                                    </span>
                                }>
                                {isMenu('frontend') && <SelectHoverItem onClick={() => window.open('/')}><GanttChartIcon className="w-4 h-4 mr-1.5 text-slate-400" /><span>{t('menu.workspace')}</span></SelectHoverItem>}
                                <SelectHoverItem onClick={JumpResetPage}><Lock className="w-4 h-4 mr-1.5 text-slate-400" /><span>{t('menu.changePwd')}</span></SelectHoverItem>
                                <SelectHoverItem onClick={() => {
                                    const keys = Object.keys(options);
                                    const idx = keys.indexOf(language);
                                    changLanguage(keys[(idx + 1) % keys.length]);
                                }}>
                                    <Globe className="w-4 h-4 mr-1.5 text-slate-400" /><span>{languageNames[language]}</span>
                                </SelectHoverItem>
                                <SelectHoverItem onClick={handleLogout}><QuitIcon className="w-4 h-4 mr-1.5 text-slate-400" /><span>{t('menu.logout')}</span></SelectHoverItem>
                            </SelectHover>
                        </div>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-cyan-500 text-white flex items-center justify-center text-xs font-medium cursor-pointer" title={user.user_name}>
                            {(user.user_name || 'U').substring(0, 2).toUpperCase()}
                        </div>
                    )}
                </div>

                {/* Collapse toggle */}
                <div className={`flex items-center border-t border-slate-100 dark:border-white/[0.06] h-10 flex-shrink-0 ${isExpanded ? 'px-3 justify-end' : 'justify-center'}`}>
                    <button
                        onClick={() => setSidebarMode(isExpanded ? 'icon' : 'expanded')}
                        className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-cyan-400 dark:hover:bg-white/[0.06] transition-colors duration-150 cursor-pointer"
                        title={isExpanded ? '收起侧边栏' : '展开侧边栏'}
                    >
                        {isExpanded ? <ChevronsLeft className="w-4 h-4" /> : <ChevronsRight className="w-4 h-4" />}
                    </button>
                </div>
            </aside>

            {/* Main area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top bar */}
                <div className="flex items-center justify-between h-12 px-4 flex-shrink-0 bg-white/80 dark:bg-[rgba(10,15,30,0.7)] dark:backdrop-blur-[40px] dark:saturate-[180%] border-b border-slate-200/60 dark:border-white/[0.06]">
                    <div className="flex-1">
                        <HeaderMenu />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-cyan-400 dark:hover:bg-white/[0.06] transition-colors duration-150 cursor-pointer"
                            onClick={() => setDark(!dark)}
                            title={dark ? '切换到白天模式' : '切换到黑夜模式'}
                        >
                            {dark ? <Sun className="w-4 h-4" /> : <MoonStar className="w-4 h-4" />}
                        </button>
                        {isExpanded && (
                            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                {(window as any).ThemeStyle?.branding?.companyName || ''}
                            </span>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-transparent">
                    <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingIcon /></div>}>
                        <Outlet />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}

const useLanguage = (user: User) => {
    const [language, setLanguage] = useState('zh-Hans');
    useEffect(() => {
        const lang = user.user_id ? localStorage.getItem('i18nextLng') : null;
        if (lang) setLanguage(lang === 'zh' ? 'zh-Hans' : lang);
    }, [user]);

    const { t } = useTranslation();
    const changLanguage = (ln: string) => {
        setLanguage(ln);
        localStorage.setItem('i18nextLng', ln);
        localStorage.removeItem('lang');
        document.cookie = `lang=${ln}; path=/; expires=${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()}`;
        i18next.changeLanguage(ln);
    };
    return {
        language,
        languageNames: { "zh-Hans": '中文', "en-US": 'English', ja: '日本語', vi: 'Tiếng Việt' },
        options: { "zh-Hans": '中文', "en-US": 'English', ja: '日本語', vi: 'Tiếng Việt' },
        changLanguage,
        t
    };
};
