import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import {
  Sparkles, ListChecks, LayoutGrid, Bell, Search,
  MoreHorizontal, User,
} from 'lucide-react';
import { cn } from '~/utils';
import store from '~/store';

interface DockItem {
  key: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

const DOCK_ITEMS: DockItem[] = [
  { key: 'ai', label: 'AI 对话', icon: Sparkles, path: '/ws-assistant' },
  { key: 'tasks', label: '任务中心', icon: ListChecks, path: '/ws-task-center' },
  { key: 'apps', label: '应用中心', icon: LayoutGrid, path: '/apps' },
  { key: 'messages', label: '消息', icon: Bell, path: '/ws-message-center' },
  { key: 'profile', label: '个人', icon: User, path: '/ws-profile' },
];

function getActiveKey(pathname: string): string {
  if (pathname.startsWith('/c/') || pathname.startsWith('/chat/') || pathname.startsWith('/linsight') || pathname.startsWith('/ws-assistant')) return 'ai';
  if (pathname.startsWith('/ws-task-center')) return 'tasks';
  if (pathname.startsWith('/apps')) return 'apps';
  if (pathname.startsWith('/ws-message-center')) return 'messages';
  if (pathname.startsWith('/ws-profile') || pathname.startsWith('/ws-users') || pathname.startsWith('/ws-roles') || pathname.startsWith('/ws-data')) return 'profile';
  return 'tasks';
}

interface FloatingDockProps {
  onCommandPalette?: () => void;
}

export default function FloatingDock({ onCommandPalette }: FloatingDockProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const activeKey = getActiveKey(location.pathname);
  const taskBadgeCount = useRecoilValue(store.taskBadgeCount);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <nav
      className={cn(
        'fixed bottom-5 left-1/2 -translate-x-1/2 z-50',
        'hidden md:flex items-center gap-1 px-2 py-2',
        'bg-white/80 dark:bg-[rgba(10,15,30,0.7)]',
        'backdrop-blur-[40px] saturate-[180%]',
        'border border-slate-200/60 dark:border-white/[0.08]',
        'rounded-[28px]',
        'shadow-lg dark:shadow-dock',
        'transition-all duration-300',
      )}
    >
      {/* Search trigger */}
      <button
        onClick={onCommandPalette}
        className={cn(
          'flex items-center justify-center w-11 h-11 rounded-2xl',
          'text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400',
          'hover:bg-slate-100 dark:hover:bg-white/[0.08]',
          'transition-all duration-200 cursor-pointer',
        )}
        title="搜索 (⌘K)"
      >
        <Search className="w-[18px] h-[18px]" />
      </button>

      <div className="w-px h-6 bg-slate-200 dark:bg-white/[0.08] mx-0.5" />

      {DOCK_ITEMS.map((item) => {
        const isActive = activeKey === item.key;
        const isHovered = hoveredKey === item.key;
        const showBadge = item.key === 'tasks' && taskBadgeCount > 0;

        return (
          <div key={item.key} className="relative group">
            <button
              onClick={() => navigate(item.path)}
              onMouseEnter={() => setHoveredKey(item.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className={cn(
                'relative flex items-center justify-center w-11 h-11 rounded-2xl',
                'transition-all duration-200 cursor-pointer',
                isActive
                  ? 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/15'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08]',
                isHovered && !isActive && 'scale-110',
              )}
            >
              <item.icon className="w-[20px] h-[20px]" />
              {showBadge && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
                  {taskBadgeCount > 99 ? '99+' : taskBadgeCount}
                </span>
              )}
            </button>
            {/* Active indicator dot */}
            {isActive && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-500 dark:bg-cyan-400" />
            )}
            {/* Tooltip */}
            <div
              className={cn(
                'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1',
                'text-xs font-medium text-white bg-slate-800 dark:bg-slate-700 rounded-lg',
                'whitespace-nowrap pointer-events-none',
                'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
                'shadow-lg',
              )}
            >
              {item.label}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function MobileDock() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeKey = getActiveKey(location.pathname);
  const taskBadgeCount = useRecoilValue(store.taskBadgeCount);

  return (
    <nav
      className={cn(
        'md:hidden fixed bottom-0 left-0 right-0 z-50',
        'bg-white/90 dark:bg-[rgba(3,7,18,0.92)]',
        'backdrop-blur-xl border-t border-slate-200/60 dark:border-white/[0.06]',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-[52px]">
        {DOCK_ITEMS.slice(0, 5).map((item) => {
          const isActive = activeKey === item.key;
          const showBadge = item.key === 'tasks' && taskBadgeCount > 0;
          return (
            <button
              key={item.key}
              className="relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 cursor-pointer active:scale-95 transition-transform"
              onClick={() => navigate(item.path)}
            >
              <div className="relative">
                <item.icon className={cn('w-[18px] h-[18px] transition-colors', isActive ? 'text-cyan-500 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500')} />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
                    {taskBadgeCount > 99 ? '99+' : taskBadgeCount}
                  </span>
                )}
              </div>
              <span className={cn('text-[10px] leading-tight transition-colors', isActive ? 'text-cyan-500 dark:text-cyan-400 font-medium' : 'text-slate-400 dark:text-slate-500')}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-cyan-500 dark:bg-cyan-400" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
