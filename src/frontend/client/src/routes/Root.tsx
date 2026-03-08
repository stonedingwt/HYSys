import { useContext, useEffect, useState, useCallback } from 'react';
import { Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { MoonStar, Sun, Menu, X } from 'lucide-react';
import { getBysConfigApi } from '~/api/apps';
import type { ContextType } from '~/common';
import { Banner } from '~/components/Banners';
import ChatHistoryDrawer from '~/components/ChatHistoryDrawer';
import { Nav } from '~/components/Nav';
import FloatingDock, { MobileDock } from '~/components/Nav/FloatingDock';
import CommandPalette from '~/components/CommandPalette';
import { useAgentsMap, useAssistantsMap, useAuthContext, useFileMap, useSearch } from '~/hooks';
import { ThemeContext } from '~/hooks/ThemeContext';
import { mepConfState } from '~/pages/appChat/store/atoms';
import store from '~/store';
import { getLogoUrl, getSystemName, getCompanyName } from '~/utils/logoUtils';
import {
  AgentsMapContext,
  AssistantsMapContext,
  FileMapContext,
  SearchContext,
  SetConvoProvider,
} from '~/Providers';

export default function Root() {
  const [bannerHeight, setBannerHeight] = useState(0);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  const { isAuthenticated } = useAuthContext();
  const assistantsMap = useAssistantsMap({ isAuthenticated });
  const agentsMap = useAgentsMap({ isAuthenticated });
  const fileMap = useFileMap({ isAuthenticated });
  const search = useSearch({ isAuthenticated });
  const { theme, setTheme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const navigate = useNavigate();
  const location = useLocation();
  const setTaskBadge = useSetRecoilState(store.taskBadgeCount);

  useEffect(() => {
    if (!isAuthenticated) return;
    const loadBadge = () => {
      fetch('/api/v1/task-center/stats')
        .then(r => r.json())
        .then(res => {
          const count = res?.data?.in_progress ?? 0;
          setTaskBadge(count);
        })
        .catch(() => {});
    };
    loadBadge();
    const timer = setInterval(loadBadge, 60_000);
    return () => clearInterval(timer);
  }, [isAuthenticated, setTaskBadge]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  const navVisible = true;
  const setNavVisible = (_val: boolean | ((prev: boolean) => boolean)) => {};

  useConfig();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <SetConvoProvider>
      <SearchContext.Provider value={search}>
        <FileMapContext.Provider value={fileMap}>
          <AssistantsMapContext.Provider value={assistantsMap}>
            <AgentsMapContext.Provider value={agentsMap}>
              <Banner onHeightChange={setBannerHeight} />
              <div
                className="flex flex-col bg-slate-50 dark:bg-[#030712] ambient-bg"
                style={{ height: `calc(100dvh - ${bannerHeight}px)` }}
              >
                {/* ====== Transparent Top Bar (48px) ====== */}
                <header className="hidden md:flex items-center justify-between h-12 px-5 flex-shrink-0 z-40 bg-transparent">
                  {/* Left: Logo */}
                  <div className="flex items-center gap-2.5 min-w-0 cursor-pointer" onClick={() => navigate('/')}>
                    <img src={getLogoUrl('login-logo-small')} className="w-7 h-7 rounded object-contain dark:hidden" alt="" />
                    <img src={getLogoUrl('logo-small-dark')} className="w-7 h-7 rounded object-contain hidden dark:block" alt="" />
                    <span className="text-[15px] font-semibold text-slate-800 dark:text-slate-100 tracking-tight whitespace-nowrap">
                      {getSystemName()}
                    </span>
                  </div>

                  {/* Center: spacer */}
                  <div className="flex-1" />

                  {/* Right: Company name + Theme */}
                  <div className="flex items-center gap-3">
                    {getCompanyName() && (
                      <span className="text-xs font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {getCompanyName()}
                      </span>
                    )}
                    <button
                      className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100/60 dark:hover:text-cyan-400 dark:hover:bg-white/[0.06] transition-colors duration-150 cursor-pointer"
                      onClick={toggleTheme}
                      title={isDark ? '切换到白天模式' : '切换到黑夜模式'}
                    >
                      {isDark ? <Sun className="w-4.5 h-4.5" /> : <MoonStar className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </header>

                {/* Mobile top bar */}
                <header className="md:hidden flex items-center justify-between h-12 px-4 flex-shrink-0 z-40 bg-white/80 dark:bg-[#030712]/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/[0.06]">
                  <div className="flex items-center gap-2" onClick={() => navigate('/')}>
                    <img src={getLogoUrl('login-logo-small')} className="w-6 h-6 rounded object-contain dark:hidden" alt="" />
                    <img src={getLogoUrl('logo-small-dark')} className="w-6 h-6 rounded object-contain hidden dark:block" alt="" />
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
                      {getSystemName()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
                      onClick={toggleTheme}
                    >
                      {isDark ? <Sun className="w-4 h-4" /> : <MoonStar className="w-4 h-4" />}
                    </button>
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
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
                    <div className="md:hidden fixed top-12 left-0 right-0 bottom-0 z-50 bg-white dark:bg-[#030712] overflow-y-auto">
                      <Nav
                        navVisible={true}
                        setNavVisible={() => setShowMobileMenu(false)}
                        sidebarMode="expanded"
                        setSidebarMode={() => {}}
                      />
                    </div>
                  </>
                )}

                {/* ====== Full-Screen Spatial Workspace ====== */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <Outlet context={{ navVisible, setNavVisible, showChatHistory, setShowChatHistory } satisfies ContextType} />
                </div>

                {/* ====== Floating Dock (Desktop) ====== */}
                <FloatingDock onCommandPalette={() => setCmdOpen(true)} />

                {/* ====== Mobile Bottom Tab Bar ====== */}
                <MobileDock />
              </div>

              {/* ====== Command Palette ====== */}
              <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
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
