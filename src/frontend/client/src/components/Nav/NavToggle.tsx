import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocalize } from '~/hooks';
import { TooltipAnchor } from '~/components/ui';
import { cn } from '~/utils';

export default function NavToggle({
  onToggle,
  navVisible,
  isHovering,
  setIsHovering,
  side = 'left',
  className = '',
  translateX = true,
}: {
  onToggle: () => void;
  navVisible: boolean;
  isHovering: boolean;
  setIsHovering: (isHovering: boolean) => void;
  side?: 'left' | 'right';
  className?: string;
  translateX?: boolean;
}) {
  const localize = useLocalize();
  const showLeft = side === 'left' ? navVisible : !navVisible;
  const Icon = showLeft ? ChevronLeft : ChevronRight;

  return (
    <div
      className={cn(
        className,
        '-translate-y-1/2 transition-transform',
        navVisible && translateX ? 'translate-x-[250px]' : 'translate-x-0',
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <TooltipAnchor
        side={side === 'right' ? 'left' : 'right'}
        aria-label={side === 'left' ? localize('com_ui_chat_history') : localize('com_ui_controls')}
        aria-expanded={navVisible}
        aria-controls={side === 'left' ? 'chat-history-nav' : 'controls-nav'}
        id={`toggle-${side}-nav`}
        onClick={(e) => {
          onToggle(e);
          setIsHovering(false);
        }}
        role="button"
        description={navVisible ? localize('com_nav_close_sidebar') : localize('com_nav_open_sidebar')}
        className="flex items-center justify-center"
        tabIndex={0}
      >
        <div
          className="flex h-6 w-5 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:shadow dark:border-slate-600 dark:bg-slate-800"
          style={{ transition: 'box-shadow 0.2s ease' }}
        >
          <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-400" />
        </div>
      </TooltipAnchor>
    </div>
  );
}
