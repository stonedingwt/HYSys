import { useContext, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { MoonStar, Sun } from 'lucide-react';
import { getBysConfigApi } from '~/api/apps';
import type { ContextType } from '~/common';
import { Banner } from '~/components/Banners';
import ChatHistoryDrawer from '~/components/ChatHistoryDrawer';
import { MobileNav, Nav } from '~/components/Nav';
import { useAgentsMap, useAssistantsMap, useAuthContext, useFileMap, useSearch } from '~/hooks';
import { ThemeContext } from '~/hooks/ThemeContext';
import { mepConfState } from '~/pages/appChat/store/atoms';
import {
  AgentsMapContext,
  AssistantsMapContext,
  FileMapContext,
  SearchContext,
  SetConvoProvider,
} from '~/Providers';

const DEFAULT_LOGO_LIGHT = __APP_ENV__.MEP_HOST + '/assets/mep/login-logo-small.png';
const DEFAULT_LOGO_DARK = __APP_ENV__.MEP_HOST + '/assets/mep/logo-small-dark.png';

function getLogoUrl(slotKey: string, fallback: string): string {
  const custom = (window as any).ThemeStyle?.logos?.[slotKey];
  return custom || fallback;
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
              {/* 页面头部黑色banner */}
              <Banner onHeightChange={setBannerHeight} />
              <div className="flex flex-col" style={{ height: `calc(100dvh - ${bannerHeight}px)` }}>
                {/* Header bar - hidden on mobile (<768px), MobileNav handles mobile */}
                <div className="hidden md:flex justify-between h-[64px] bg-white dark:bg-gray-900 relative z-[21] flex-shrink-0 border-b border-gray-100 dark:border-gray-800">
                  <div className="w-[200px] min-w-[140px] lg:min-w-[184px] flex items-center justify-center h-full">
                    <a href={__APP_ENV__.BASE_URL + '/'} className="flex items-center gap-2">
                      <img src={getLogoUrl('login-logo-small', DEFAULT_LOGO_LIGHT)} className="w-[62px] rounded dark:hidden" alt="" />
                      <img src={getLogoUrl('logo-small-dark', DEFAULT_LOGO_DARK)} className="w-[62px] rounded hidden dark:block" alt="" />
                      <span className="text-[18px] font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap">元境</span>
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
                    <span className="hidden lg:inline text-lg font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">扬州赛乐服饰有限公司</span>
                  </div>
                </div>
                {/* Main content area */}
                <div className="flex flex-1 overflow-hidden">
                  <div className="relative z-0 flex h-full w-full overflow-hidden">
                    {/* 会话列表 */}
                    <Nav navVisible={navVisible} setNavVisible={setNavVisible} />
                    {/* 会话消息面板区(路由) */}
                    <div className="relative flex h-full max-w-full flex-1 flex-col overflow-hidden">
                      <MobileNav setNavVisible={setNavVisible} />
                      <Outlet context={{ navVisible, setNavVisible, showChatHistory, setShowChatHistory } satisfies ContextType} />
                    </div>
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