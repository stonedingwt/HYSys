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
                <div className="hidden md:flex justify-between h-[64px] bg-white dark:bg-gray-900 relative z-[21] flex-shrink-0 border-b border-gray-100 dark:border-gray-800">
                  <div className="w-[200px] min-w-[140px] lg:min-w-[184px] flex items-center justify-center h-full">
                    <a href={__APP_ENV__.BASE_URL + '/'} className="flex items-center gap-2">
                      <img src={getLogoUrl('login-logo-small', DEFAULT_LOGO_LIGHT)} className="w-[62px] rounded dark:hidden" alt="" />
                      <img src={getLogoUrl('logo-small-dark', DEFAULT_LOGO_DARK)} className="w-[62px] rounded hidden dark:block" alt="" />
                      <span className="text-[18px] font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap">{(window as any).ThemeStyle?.branding?.systemName || '元境'}</span>
                    </a>
                  </div>
                  <div className="flex-grow" />
                  <div className="flex items-center gap-3 mr-4 lg:mr-6">
                    <button
                      className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      onClick={toggleTheme}
                      title={isDark ? '切换到白天模式' : '切换到黑夜模式'}
                    >
                      {isDark
                        ? <Sun className="w-5 h-5 text-yellow-400" />
                        : <MoonStar className="w-5 h-5 text-gray-500" />
                      }
                    </button>
                    <span className="hidden lg:inline text-lg font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{(window as any).ThemeStyle?.branding?.companyName || ''}</span>
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
                <div className="md:hidden flex-shrink-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 safe-area-bottom">
                  <div className="flex items-center justify-around h-14">
                    {MOBILE_TABS.map(tab => {
                      const isActive = activeTab === tab.key;
                      const showBadge = tab.key === 'tasks' && badgeCount > 0;
                      return (
                        <button
                          key={tab.key}
                          className="relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors"
                          onClick={() => navigate(tab.path)}
                        >
                          <div className="relative">
                            <tab.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`} />
                            {showBadge && (
                              <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
                                {badgeCount > 99 ? '99+' : badgeCount}
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] leading-tight ${isActive ? 'text-primary font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
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
