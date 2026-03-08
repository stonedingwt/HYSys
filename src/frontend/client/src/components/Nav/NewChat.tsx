import { useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, MessageSquarePlus, Users, Shield, ListChecks, Bell } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { useGetBsConfig } from '~/data-provider';
import type { TMessage } from '~/data-provider/data-provider/src';
import { Constants, QueryKeys } from '~/data-provider/data-provider/src';
import { useLocalize, useNewConvo } from '~/hooks';
import store from '~/store';
import { cn } from '~/utils';

interface MenuConfigEntry {
  enabled: boolean;
  customName?: string;
}

function useMenuConfig() {
  const [menuConfig, setMenuConfig] = useState<Record<string, MenuConfigEntry>>({});
  useEffect(() => {
    fetch('/api/v1/config', { credentials: 'include' })
      .then(res => res.json())
      .then(res => {
        try {
          const raw = res?.data ?? '';
          if (typeof raw === 'string' && raw.includes('menu_config')) {
            const lines = raw.split('\n');
            let inMenuConfig = false;
            let indent = 0;
            const mc: Record<string, MenuConfigEntry> = {};
            let currentKey = '';
            for (const line of lines) {
              if (line.trim() === 'menu_config:') { inMenuConfig = true; indent = line.indexOf('menu_config'); continue; }
              if (inMenuConfig) {
                if (line.trim() === '' || (!line.startsWith(' '.repeat(indent + 1)) && !line.startsWith('\t'))) {
                  if (line.trim() && !line.startsWith(' ') && !line.startsWith('\t')) { inMenuConfig = false; continue; }
                }
                const keyMatch = line.match(/^\s{2,}(\w+):/);
                if (keyMatch) {
                  const k = keyMatch[1];
                  if (k === 'enabled' && currentKey) {
                    mc[currentKey] = mc[currentKey] || { enabled: true };
                    mc[currentKey].enabled = line.includes('true');
                  } else if (k === 'customName' && currentKey) {
                    mc[currentKey] = mc[currentKey] || { enabled: true };
                    const val = line.split('customName:')[1]?.trim().replace(/^['"]|['"]$/g, '');
                    if (val) mc[currentKey].customName = val;
                  } else {
                    currentKey = k;
                    mc[k] = { enabled: true };
                    if (line.includes('enabled:')) mc[k].enabled = line.includes('true');
                  }
                }
              }
            }
            setMenuConfig(mc);
          }
        } catch { /* ignore */ }
      })
      .catch(() => { /* ignore */ });
  }, []);
  return menuConfig;
}

export default function NewChat({
  index = 0,
  toggleNav,
  subHeaders,
  isSmallScreen,
  isIconMode = false,
}: {
  index?: number;
  toggleNav: () => void;
  subHeaders?: React.ReactNode;
  isSmallScreen: boolean;
  isIconMode?: boolean;
}) {
  const queryClient = useQueryClient();
  const { newConversation: newConvo } = useNewConvo(index);
  const { data: bsConfig } = useGetBsConfig();

  const navigate = useNavigate();
  const location = useLocation();
  const localize = useLocalize();
  const menuConfig = useMenuConfig();
  const currentUser = useRecoilValue(store.user);
  const taskBadgeCount = useRecoilValue(store.taskBadgeCount);
  const userPlugins = currentUser?.plugins ?? [];
  const isAdmin = currentUser?.role === 'admin';

  const { conversation } = store.useCreateConversationAtom(index);

  const clickHandler = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button === 0 && !(event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      newConvo();
      navigate('/c/new');
      toggleNav();
      queryClient.setQueryData<TMessage[]>(
        [QueryKeys.messages, conversation?.conversationId ?? Constants.NEW_CONVO],
        [],
      );
    }
  }, [newConvo, navigate, toggleNav, queryClient, conversation]);

  const isActive = (path: string) => location.pathname.startsWith(path);

  const menuLabel = (key: string, defaultLabel: string) => menuConfig[key]?.customName || defaultLabel;

  const menuEnabled = (key: string) => {
    const entry = menuConfig[key];
    const globalEnabled = entry ? entry.enabled !== false : true;
    if (!globalEnabled) return false;
    if (isAdmin) return true;
    return userPlugins.includes(key);
  };

  const navItemClass = (active: boolean) => cn(
    'flex items-center cursor-pointer transition-all duration-150 rounded-lg group',
    isIconMode ? 'w-10 h-10 justify-center mx-auto' : 'w-full h-10 px-3 gap-3',
    active
      ? 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400 font-medium'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
  );

  const items = [
    { key: 'ws_apps', icon: LayoutGrid, path: '/apps', label: localize('com_nav_app_center') },
    { key: 'ws_new_chat', icon: MessageSquarePlus, path: '/ws-assistant', label: localize('com_nav_start_new_chat') },
    { key: 'ws_task_center', icon: ListChecks, path: '/ws-task-center', label: '任务中心', badge: taskBadgeCount },
    { key: 'ws_message_center', icon: Bell, path: '/ws-message-center', label: '消息中心' },
  ];

  const adminItems = [
    { key: 'ws_user_manage', icon: Users, path: '/ws-users', label: localize('com_nav_user_manage') },
    { key: 'ws_role_manage', icon: Shield, path: '/ws-roles', label: localize('com_nav_role_manage') },
  ];

  return (
    <div className={cn('flex flex-col gap-0.5', isIconMode ? 'px-2 pt-3' : 'px-3 pt-3')}>
      {items.filter(i => menuEnabled(i.key)).map(item => (
        <div
          key={item.key}
          className={navItemClass(isActive(item.path))}
          onClick={() => { navigate(item.path); toggleNav(); }}
          title={isIconMode ? menuLabel(item.key, item.label) : undefined}
        >
          <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
          {!isIconMode && (
            <>
              <span className="text-[13px] truncate flex-1">{menuLabel(item.key, item.label)}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </>
          )}
          {isIconMode && item.badge != null && item.badge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </div>
      ))}

      {/* Divider */}
      {adminItems.some(i => menuEnabled(i.key)) && (
        <div className={cn('my-2', isIconMode ? 'mx-1' : 'mx-0')}>
          <div className="h-px bg-slate-200 dark:bg-slate-700/50" />
        </div>
      )}

      {adminItems.filter(i => menuEnabled(i.key)).map(item => (
        <div
          key={item.key}
          className={navItemClass(isActive(item.path))}
          onClick={() => { navigate(item.path); toggleNav(); }}
          title={isIconMode ? menuLabel(item.key, item.label) : undefined}
        >
          <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
          {!isIconMode && (
            <span className="text-[13px] truncate flex-1">{menuLabel(item.key, item.label)}</span>
          )}
        </div>
      ))}

      <div id="create-convo-btn" className="opacity-0 h-0" onClick={clickHandler} />
      {subHeaders}
    </div>
  );
}
