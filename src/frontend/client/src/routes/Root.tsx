import { useContext, useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { MoonStar, Sun, MessageSquare, ListChecks, Bell, User, Search, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { getBysConfigApi } from '~/api/apps';
import type { ContextType } from '~/common';
import { Banner } from '~/components/Banners';
import ChatHistoryDrawer from '~/components/ChatHistoryDrawer';
import { Nav } from '~/components/Nav';
import { useAgentsMap, useAssistantsMap, useAuthContext, useFileMap, useSearch } from '~/hooks';
import { ThemeContext } from '~/hooks/ThemeContext';
import { mepConfState } from '~/pages/appChat/store/atoms';
import store from '~/store';
import {
  AgentsMapContext,
  AssistantsMapContext,
  FileMapContext,
  SearchContext,
  SetConvoProvider,
} from '~/Providers';

const MOBILE_TABS = [
  { key: 'chat', label: '对话', icon: MessageSquare, path: '/c/new' },
  { key: 'tasks', label: '任务', icon: ListChecks, path: '/ws-task-center' },
  { key: 'notifications', label: '通知', icon: Bell, path: '/ws-message-center' },
  { key: 'profile', label: '我的', icon: User, path: '/ws-profile' },
] as const;

function getActiveTab(pathname: string): string {
  if (pathname.startsWith('/c/') || pathname.startsWith('/linsight')) return 'chat';
  if (pathname.startsWith('/ws-task-center')) return 'tasks';
  if (pathname.startsWith('/ws-message-center')) return 'notifications';
  if (pathname.startsWith('/ws-profile')) return 'profile';
  return 'tasks';
}

type SidebarMode = 'expanded' | 'icon' | 'hidden';

export default function Root() {
  const [bannerHeight, setBannerHeight] = useState(0);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => {
    const saved = localStorage.getItem('sidebarMode');
    return (saved as SidebarMode) || 'expanded';
  });
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [showAICopilot, setShowAICopilot] = useState(false);

  const { isAuthenticated, logout } = useAuthContext();
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
    localStorage.setItem('sidebarMode', sidebarMode);
  }, [sidebarMode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setSidebarMode(prev => prev === 'hidden' ? 'expanded' : prev === 'expanded' ? 'icon' : 'expanded');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  const navVisible = sidebarMode !== 'hidden';
  const setNavVisible = (val: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof val === 'function' ? val(navVisible) : val;
    setSidebarMode(resolved ? 'expanded' : 'hidden');
  };

  const sidebarWidth = sidebarMode === 'expanded' ? 260 : sidebarMode === 'icon' ? 64 : 0;

  useConfig();

  if (!isAuthenticated) return null;

  const pageTitle = getPageTitle(location.pathname);

  return (
    <SetConvoProvider>
      <SearchContext.Provider value={search}>
        <FileMapContext.Provider value={fileMap}>
          <AssistantsMapContext.Provider value={assistantsMap}>
            <AgentsMapContext.Provider value={agentsMap}>
              <Banner onHeightChange={setBannerHeight} />
              <div className="flex" style={{ height: `calc(100dvh - ${bannerHeight}px)` }}>
                {/* Sidebar */}
                <div className="hidden md:block flex-shrink-0 relative z-30">
                  <Nav
                    navVisible={navVisible}
                    setNavVisible={setNavVisible}
                    sidebarMode={sidebarMode}
                    setSidebarMode={setSidebarMode}
                  />
                </div>

                {/* Main area */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                  {/* Top bar — 48px */}
                  <div className="hidden md:flex items-center justify-between h-12 px-4 flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-700/40">
                    <div className="flex items-center gap-3 min-w-0">
                      <h1 className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                        {pageTitle}
                      </h1>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors duration-150"
                        onClick={toggleTheme}
                        title={isDark ? '切换到白天模式' : '切换到黑夜模式'}
                      >
                        {isDark ? <Sun className="w-4 h-4" /> : <MoonStar className="w-4 h-4" />}
                      </button>
                      <button
                        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150 ${
                          showAICopilot
                            ? 'text-sky-500 bg-sky-50 dark:text-sky-400 dark:bg-sky-500/10'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => setShowAICopilot(!showAICopilot)}
                        title="AI Copilot"
                      >
                        {showAICopilot ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Content + AI Copilot */}
                  <div className="flex-1 flex overflow-hidden">
                    {/* Page content */}
                    <div className="flex-1 min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-900">
                      <Outlet context={{ navVisible, setNavVisible, showChatHistory, setShowChatHistory } satisfies ContextType} />
                    </div>

                    {/* AI Copilot panel */}
                    {showAICopilot && (
                      <div className="hidden md:flex flex-col w-[360px] flex-shrink-0 border-l border-slate-200/60 dark:border-slate-700/40 bg-white dark:bg-slate-800 relative">
                        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-sky-400 via-sky-500 to-sky-600 opacity-60" />
                        <div className="flex items-center justify-between h-12 px-4 border-b border-slate-100 dark:border-slate-700/40">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-sky-400 animate-ai-pulse" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">AI Copilot</span>
                          </div>
                          <button
                            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            onClick={() => setShowAICopilot(false)}
                          >
                            <PanelRightClose className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-6">
                          <div className="text-center">
                            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center">
                              <Search className="w-5 h-5 text-sky-500 dark:text-sky-400" />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              AI 助手随时待命
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                              可在此处提问或查询
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile bottom tab bar */}
              <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200/60 dark:border-slate-700/40" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div className="flex items-center justify-around h-[52px]">
                  {MOBILE_TABS.map(tab => {
                    const isActive = activeTab === tab.key;
                    const showBadge = tab.key === 'tasks' && badgeCount > 0;
                    return (
                      <button
                        key={tab.key}
                        className="relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all duration-150 active:scale-95"
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
                      </button>
                    );
                  })}
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

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/apps')) return '应用中心';
  if (pathname.startsWith('/ws-assistant')) return '赛乐助手';
  if (pathname.startsWith('/ws-task-center')) return '任务中心';
  if (pathname.startsWith('/ws-message-center')) return '消息中心';
  if (pathname.startsWith('/ws-profile')) return '个人中心';
  if (pathname.startsWith('/ws-users')) return '用户管理';
  if (pathname.startsWith('/ws-roles')) return '角色管理';
  if (pathname.startsWith('/c/')) return '对话';
  if (pathname.startsWith('/chat/')) return '应用对话';
  return '';
}

const useConfig = () => {
  const [_, setConfig] = useRecoilState(mepConfState);
  useEffect(() => {
    getBysConfigApi().then(res => {
      setConfig(res.data);
    });
  }, []);
};
