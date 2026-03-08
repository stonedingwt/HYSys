import { memo, useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useMediaQuery } from '~/hooks';
import { cn } from '~/utils';
import HYSysLogo from '~/components/svg/HYSysLogo';
import AccountSettings from './AccountSettings';
import NewChat from './NewChat';

type SidebarMode = 'expanded' | 'icon' | 'hidden';

const Nav = ({
  navVisible,
  setNavVisible,
  sidebarMode = 'expanded',
  setSidebarMode,
}: {
  navVisible: boolean;
  setNavVisible: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarMode?: SidebarMode;
  setSidebarMode?: (mode: SidebarMode) => void;
}) => {
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const isExpanded = sidebarMode === 'expanded';
  const isIcon = sidebarMode === 'icon';

  const width = isExpanded ? 260 : isIcon ? 64 : 0;

  const toggleMode = () => {
    if (isExpanded) setSidebarMode?.('icon');
    else if (isIcon) setSidebarMode?.('expanded');
    else setSidebarMode?.('expanded');
  };

  const itemToggleNav = () => {
    if (isSmallScreen) {
      setNavVisible(false);
    }
  };

  return (
    <>
      <aside
        className={cn(
          'flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden flex-shrink-0 border-r border-slate-200/60 dark:border-slate-700/30',
          'transition-[width] duration-200 ease-out',
        )}
        style={{ width: isSmallScreen ? (navVisible ? 280 : 0) : width }}
      >
        {/* Logo area */}
        <div className={cn('flex items-center flex-shrink-0 h-14', isExpanded ? 'px-4' : 'justify-center px-2')}>
          {isExpanded ? (
            <HYSysLogo size={28} variant="text" />
          ) : (
            <HYSysLogo size={28} variant="icon" />
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <NewChat
            toggleNav={itemToggleNav}
            isSmallScreen={isSmallScreen}
            isIconMode={isIcon}
          />
        </div>

        {/* User area */}
        <AccountSettings isIconMode={isIcon} />

        {/* Collapse toggle */}
        <div className={cn('flex items-center border-t border-slate-100 dark:border-slate-800 h-10 flex-shrink-0', isExpanded ? 'px-3 justify-end' : 'justify-center')}>
          <button
            onClick={toggleMode}
            className="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors duration-150"
            title={isExpanded ? '收起侧边栏' : '展开侧边栏'}
          >
            {isExpanded ? <ChevronsLeft className="w-4 h-4" /> : <ChevronsRight className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isSmallScreen && navVisible && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20"
          onClick={() => setNavVisible(false)}
        />
      )}
    </>
  );
};

export default memo(Nav);
