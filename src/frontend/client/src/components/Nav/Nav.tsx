import { memo } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
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
          'flex flex-col h-full overflow-hidden flex-shrink-0',
          'bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl',
          'border-r border-slate-200/60 dark:border-white/[0.06]',
          'transition-[width] duration-200 ease-out',
        )}
        style={{ width: isSmallScreen ? (navVisible ? 280 : 0) : width }}
      >
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
        <div className={cn(
          'flex items-center h-10 flex-shrink-0 border-t border-slate-100 dark:border-white/[0.06]',
          isExpanded ? 'px-3 justify-end' : 'justify-center',
        )}>
          <button
            onClick={toggleMode}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-cyan-400 dark:hover:bg-white/[0.06] transition-colors duration-150 cursor-pointer"
            title={isExpanded ? '收起侧边栏' : '展开侧边栏'}
          >
            {isExpanded ? <ChevronsLeft className="w-4 h-4" /> : <ChevronsRight className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isSmallScreen && navVisible && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20"
          onClick={() => setNavVisible(false)}
        />
      )}
    </>
  );
};

export default memo(Nav);
