import { useContext, useEffect, useState, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useRecoilState, useSetRecoilState } from 'recoil';
import {
  MoonStar, Sun, MessageSquare, ListChecks, Bell, User,
  Sparkles, LayoutGrid, Menu, X,
} from 'lucide-react';
import { getBysConfigApi } from '~/api/apps';
import type { ContextType } from '~/common';
import { Banner } from '~/components/Banners';
import ChatHistoryDrawer from '~/components/ChatHistoryDrawer';
import { Nav } from '~/components/Nav';
import { useAgentsMap, useAssistantsMap, useAuthContext, useFileMap, useSearch } from '~/hooks';
import { ThemeContext } from '~/hooks/ThemeContext';
import { mepConfState } from '~/pages/appChat/store/atoms';
import store from '~/store';
import HYSysLogo from '~/components/svg/HYSysLogo';
import {
  AgentsMapContext,
  AssistantsMapContext,
  FileMapContext,
  SearchContext,
  SetConvoProvider,
} from '~/Providers';

type AppMode = 'ai' | 'workspace';
type SidebarMode = 'expanded' | 'icon' | 'hidden';

const MOBILE_TABS = [
  { key: 'ai', label: 'AI', icon: Sparkles, path: '/c/new' },
  { key: 'tasks', label: '任务', icon: ListChecks, path: '/ws-task-center' },
  { key: 'notifications', label: '通知', icon: Bell, path: '/ws-message-center' },
  { key: 'profile', label: '我的', icon: User, path: '/ws-profile' },
] as const;

function getActiveTab(pathname: string): string {
  if (pathname.startsWith('/c/') || pathname.startsWith('/linsight')) return 'ai';
  if (pathname.startsWith('/ws-task-center')) return 'tasks';
  if (pathname.startsWith('/ws-message-center')) return 'notifications';
  if (pathname.startsWith('/ws-profile')) return 'profile';
  return 'tasks';
}

export default function Root() {
  const [bannerHeight, setBannerHeight] = useState(0);
  const [appMode, setAppMode] = useState<AppMode>(() => {
    const saved = localStorage.getItem('hysys-app-mode');
    return (saved as AppMode) || 'workspace';
  });
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => {
    const saved = localStorage.getItem('sidebarMode');
    return (saved as SidebarMode) || 'expanded';
  });
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const { isAuthenticated } = useAuthContext();
  const assistantsMap = useAssistantsMap({ isAuthenticated });
  const agentsMap = useAgentsMap({ isAuthenticated });
  const fileMap = useFileMap({ isAuthenticated });
  const search = useSearch({ isAuthenticated });
  const { theme, setTheme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = getActiveTab(location.pathname);
  const setTaskBadge = useSetRecoilState(store.taskBadgeCount);
  const [badgeCount, setBadgeCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    const loadBadge = () => {
      fetch('/api/v1/task-center/stats')
        .then(r => r.json())
        .then(res => {
          const count = res?.data?.in_progress ?? 0;
          setBadgeCount(count);
          setTaskBadge(count);
        })
        .catch(() => {});
    };
    loadBadge();
    const timer = setInterval(loadBadge, 60_000);
    return () => clearInterval(timer);
  }, [isAuthenticated, setTaskBadge]);

  useEffect(() => {
    localStorage.setItem('hysys-app-mode', appMode);
  }, [appMode]);

  useEffect(() => {
    localStorage.setItem('sidebarMode', sidebarMode);
  }, [sidebarMode]);

  const switchMode = useCallback((mode: AppMode) => {
    setAppMode(mode);
    if (mode === 'ai') {
      navigate('/c/new');
    } else {
      if (location.pathname.startsWith('/c/')) {
        navigate('/ws-task-center');
      }
    }
  }, [navigate, location.pathname]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        if (appMode === 'workspace') {
          setSidebarMode(prev => prev === 'hidden' ? 'expanded' : prev === 'expanded' ? 'icon' : 'expanded');
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [appMode]);

  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  const navVisible = sidebarMode !== 'hidden';
  const setNavVisible = (val: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof val === 'function' ? val(navVisible) : val;
    setSidebarMode(resolved ? 'expanded' : 'hidden');
  };

  useConfig();

  if (!isAuthenticated) return null;

  return (
    <SetConvoProvider>
      <SearchContext.Provider value={search}>
        <FileMapContext.Provider value={fileMap}>
          <AssistantsMapContext.Provider value={assistantsMap}>
            <AgentsMapContext.Provider value={agentsMap}>
              <Banner onHeightChange={setBannerHeight} />
              <div
                className="flex flex-col bg-slate-50 dark:bg-[#0B1120] ambient-bg"
                style={{ height: `calc(100dvh - ${bannerHeight}px)` }}
              >
                {/* ====== Global Top Bar (56px) ====== */}
                <header className="hidden md:flex items-center justify-between h-14 px-5 flex-shrink-0 z-40 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/[0.06]">
                  {/* Left: Logo */}
                  <div className="flex items-center gap-4 min-w-0">
                    <HYSysLogo size={28} variant="text" />
                  </div>

                  {/* Center: Mode Switcher */}
                  <div className="flex items-center bg-slate-100 dark:bg-white/[0.06] rounded-xl p-1 gap-0.5">
                    <button
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                        appMode === 'ai'
                          ? 'bg-white dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                      onClick={() => switchMode('ai')}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>AI 模式</span>
                    </button>
                    <button
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                        appMode === 'workspace'
                          ? 'bg-white dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                      onClick={() => switchMode('workspace')}
                    >
                      <LayoutGrid className="w-4 h-4" />
                      <span>工作台</span>
                    </button>
                  </div>

                  {/* Right: Theme + Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-sky-400 dark:hover:bg-white/[0.06] transition-colors duration-150 cursor-pointer"
                      onClick={toggleTheme}
                      title={isDark ? '切换到白天模式' : '切换到黑夜模式'}
                    >
                      {isDark ? <Sun className="w-4.5 h-4.5" /> : <MoonStar className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </header>

                {/* Mobile top bar */}
                <header className="md:hidden flex items-center justify-between h-12 px-4 flex-shrink-0 z-40 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/[0.06]">
                  <HYSysLogo size={24} variant="text" />
                  <div className="flex items-center gap-1">
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
                      onClick={toggleTheme}
                    >
                      {isDark ? <Sun className="w-4 h-4" /> : <MoonStar className="w-4 h-4" />}
                    </button>
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
                      onClick={() => setShowMobileMenu(!showMobileMenu)}
                    >
                      {showMobileMenu ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                    </button>
                  </div>
                </header>

                {/* Mobile drawer overlay */}
                {showMobileMenu && (
                  <>
                    <div className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={() => setShowMobileMenu(false)} />
                    <div className="md:hidden fixed top-12 left-0 right-0 bottom-0 z-50 bg-white dark:bg-[#0B1120] overflow-y-auto">
                      <Nav
                        navVisible={true}
                        setNavVisible={() => setShowMobileMenu(false)}
                        sidebarMode="expanded"
                        setSidebarMode={setSidebarMode}
                      />
                    </div>
                  </>
                )}

                {/* ====== Main Content ====== */}
                <div className="flex-1 flex overflow-hidden relative">
                  {/* Workspace Mode: sidebar + content */}
                  {appMode === 'workspace' && (
                    <>
                      {/* Desktop sidebar */}
                      <div className="hidden md:block flex-shrink-0 relative z-30">
                        <Nav
                          navVisible={navVisible}
                          setNavVisible={setNavVisible}
                          sidebarMode={sidebarMode}
                          setSidebarMode={setSidebarMode}
                        />
                      </div>
                      {/* Page content */}
                      <div className="flex-1 min-w-0 overflow-hidden bg-slate-50 dark:bg-transparent">
                        <Outlet context={{ navVisible, setNavVisible, showChatHistory, setShowChatHistory } satisfies ContextType} />
                      </div>
                    </>
                  )}

                  {/* AI Mode: full-screen chat */}
                  {appMode === 'ai' && (
                    <div className="flex-1 min-w-0 overflow-hidden bg-slate-50 dark:bg-transparent animate-mode-switch">
                      <Outlet context={{ navVisible: false, setNavVisible, showChatHistory, setShowChatHistory } satisfies ContextType} />
                    </div>
                  )}
                </div>

                {/* ====== Mobile Bottom Tab Bar ====== */}
                <div
                  className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur-xl border-t border-slate-200/60 dark:border-white/[0.06]"
                  style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                >
                  <div className="flex items-center justify-around h-[52px]">
                    {MOBILE_TABS.map(tab => {
                      const isActive = activeTab === tab.key;
                      const showBadge = tab.key === 'tasks' && badgeCount > 0;
                      return (
                        <button
                          key={tab.key}
                          className="relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all duration-150 active:scale-95 cursor-pointer"
                          onClick={() => navigate(tab.path)}
                        >
                          <div className="relative">
                            <tab.icon className={`w-[18px] h-[18px] transition-colors ${isActive ? 'text-sky-500 dark:text-sky-400' : 'text-slate-400 dark:text-slate-500'}`} />
                            {showBadge && (
                              <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
                                {badgeCount > 99 ? '99+' : badgeCount}
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] leading-tight transition-colors ${isActive ? 'text-sky-500 dark:text-sky-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                            {tab.label}
                          </span>
                          {isActive && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-sky-500 dark:bg-sky-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </AgentsMapContext.Provider>
          </AssistantsMapContext.Provider>
        </FileMapContext.Provider>
        <ChatHistoryDrawer open={showChatHistory} onClose={() => setShowChatHistory(false)} />
      </SearchContext.Provider>
    </SetConvoProvider>
  );
}

const useConfig = () => {
  const [_, setConfig] = useRecoilState(mepConfState);
  useEffect(() => {
    getBysConfigApi().then(res => {
      setConfig(res.data);
    });
  }, []);
};
