import { useContext, useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { MoonStar, Sun, MessageSquare, ListChecks, Bell, User } from 'lucide-react';
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

const DEFAULT_LOGO_LIGHT = '/assets/mep/login-logo-small.png';
const DEFAULT_LOGO_DARK = '/assets/mep/logo-small-dark.png';

function getLogoUrl(slotKey: string, fallback: string): string {
  const custom = (window as any).ThemeStyle?.logos?.[slotKey];
  return custom || fallback;
}

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

export default function Root() {
  const [bannerHeight, setBannerHeight] = useState(0);
  const [navVisible, setNavVisible] = useState(() => {
    const savedNavVisible = localStorage.getItem('navVisible');
    return savedNavVisible !== null ? JSON.parse(savedNavVisible) : true;
  });
  const [showChatHistory, setShowChatHistory] = useState(false);

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

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
  };

  useConfig()

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SetConvoProvider>
      <SearchContext.Provider value={search}>
        <FileMapContext.Provider value={fileMap}>
          <AssistantsMapContext.Provider value={assistantsMap}>
            <AgentsMapContext.Provider value={agentsMap}>
              <Banner onHeightChange={setBannerHeight} />
              <div className="flex flex-col" style={{ height: `calc(100dvh - ${bannerHeight}px)` }}>
                {/* Desktop header */}
                <div className="hidden md:flex justify-between h-[56px] bg-white dark:bg-navy-900 relative z-[21] flex-shrink-0 border-b border-slate-200/60 dark:border-navy-700/60 shadow-[0_1px_3px_rgba(12,26,46,0.04)]">
                  <div className="w-[200px] min-w-[140px] lg:min-w-[184px] flex items-center justify-center h-full">
                    <a href={__APP_ENV__.BASE_URL + '/'} className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
                      <img src={getLogoUrl('login-logo-small', DEFAULT_LOGO_LIGHT)} className="w-[56px] rounded dark:hidden" alt="" />
                      <img src={getLogoUrl('logo-small-dark', DEFAULT_LOGO_DARK)} className="w-[56px] rounded hidden dark:block" alt="" />
                      <span className="text-[17px] font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap tracking-tight">{(window as any).ThemeStyle?.branding?.systemName || '元境'}</span>
                      <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 rounded">AI</span>
                    </a>
                  </div>
                  <div className="flex-grow" />
                  <div className="flex items-center gap-3 mr-4 lg:mr-6">
                    <button
                      className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-navy-50 dark:hover:bg-navy-800 transition-all duration-150 active:scale-95"
                      onClick={toggleTheme}
                      title={isDark ? '切换到白天模式' : '切换到黑夜模式'}
                    >
                      {isDark
                        ? <Sun className="w-[18px] h-[18px] text-yellow-400" />
                        : <MoonStar className="w-[18px] h-[18px] text-slate-400" />
                      }
                    </button>
                    <span className="hidden lg:inline text-sm font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">{(window as any).ThemeStyle?.branding?.companyName || ''}</span>
                  </div>
                </div>

                {/* Main content area */}
                <div className="flex flex-1 overflow-hidden">
                  <div className="relative z-0 flex h-full w-full overflow-hidden">
                    {/* Desktop sidebar nav */}
                    <Nav navVisible={navVisible} setNavVisible={setNavVisible} />
                    {/* Content panel */}
                    <div className="relative flex h-full max-w-full flex-1 flex-col overflow-hidden">
                      {/* Mobile: no MobileNav header, bottom tabs handle navigation */}
                      <div className="flex-1 overflow-hidden">
                        <Outlet context={{ navVisible, setNavVisible, showChatHistory, setShowChatHistory } satisfies ContextType} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile bottom tab bar */}
                <div className="md:hidden flex-shrink-0 bg-white/80 dark:bg-navy-900/80 backdrop-blur-lg border-t border-slate-200/60 dark:border-navy-700/60 safe-area-bottom">
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
                            <tab.icon className={`w-[18px] h-[18px] transition-colors ${isActive ? 'text-navy-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'}`} />
                            {showBadge && (
                              <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
                                {badgeCount > 99 ? '99+' : badgeCount}
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] leading-tight transition-colors ${isActive ? 'text-navy-600 dark:text-cyan-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                            {tab.label}
                          </span>
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
  const [_, setConfig] = useRecoilState(mepConfState)

  useEffect(() => {
    getBysConfigApi().then(res => {
      setConfig(res.data)
    })
  }, [])
}
