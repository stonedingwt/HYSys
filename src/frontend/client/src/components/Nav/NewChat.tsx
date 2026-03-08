import { useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, MessageSquarePlus, Users, Shield, ShoppingCart, ListChecks, Bell, ClipboardList, Package, FileSpreadsheet } from 'lucide-react';
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
}: {
  index?: number;
  toggleNav: () => void;
  subHeaders?: React.ReactNode;
  isSmallScreen: boolean;
}) {
  const queryClient = useQueryClient();
  const { newConversation: newConvo } = useNewConvo(index);
  const { data: bsConfig } = useGetBsConfig()

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

  const menuLabel = (key: string, defaultLabel: string) => {
    const entry = menuConfig[key];
    return entry?.customName || defaultLabel;
  };

  const menuEnabled = (key: string) => {
    const entry = menuConfig[key];
    const globalEnabled = entry ? entry.enabled !== false : true;
    if (!globalEnabled) return false;
    if (isAdmin) return true;
    return userPlugins.includes(key);
  };

  const navItemClass = (active: boolean) => cn(
    'inline-flex w-full px-4 h-12 mb-[3.5px] items-center cursor-pointer transition-colors rounded-md',
    active
      ? 'bg-[#EBEFF8] dark:bg-[#2a2a3a] text-primary font-medium'
      : 'text-gray-700 dark:text-gray-300 hover:bg-[#EBEFF8] dark:hover:bg-[#2a2a3a]'
  );

  return (
    <div className="sticky left-0 right-0 top-0 z-50 bg-[#F9FBFF] dark:bg-[#1B1B1B]">
      <div className="pb-0.5 last:pb-0 pt-2" style={{ transform: 'none' }}>
        {/* Vertical navigation menu - admin-panel style */}
        <nav className="flex flex-col px-1">
          {/* 应用中心 */}
          {menuEnabled('ws_apps') && (
            <div
              className={navItemClass(isActive('/apps'))}
              onClick={() => navigate('/apps')}
            >
              <LayoutGrid className="h-5 w-5 my-[14px] flex-shrink-0" />
              <span className="mx-[14px] max-w-[140px] text-[14px] leading-[48px] truncate">{menuLabel('ws_apps', localize('com_nav_app_center'))}</span>
            </div>
          )}
          {/* 赛乐助手 */}
          {menuEnabled('ws_new_chat') && (
            <div
              className={navItemClass(isActive('/ws-assistant'))}
              onClick={() => navigate('/ws-assistant')}
            >
              <MessageSquarePlus className="h-5 w-5 my-[14px] flex-shrink-0" />
              <span className="mx-[14px] max-w-[140px] text-[14px] leading-[48px] truncate">{menuLabel('ws_new_chat', localize('com_nav_start_new_chat'))}</span>
            </div>
          )}
          {/* 任务中心 */}
          {menuEnabled('ws_task_center') && (
            <div
              className={navItemClass(isActive('/ws-task-center'))}
              onClick={() => navigate('/ws-task-center')}
            >
              <ListChecks className="h-5 w-5 my-[14px] flex-shrink-0" />
              <span className="mx-[14px] max-w-[140px] text-[14px] leading-[48px] truncate">{menuLabel('ws_task_center', '任务中心')}</span>
              {taskBadgeCount > 0 && (
                <span className="ml-auto shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[11px] font-bold text-white bg-red-500 rounded-full leading-none">
                  {taskBadgeCount > 99 ? '99+' : taskBadgeCount}
                </span>
              )}
            </div>
          )}
          {/* 消息中心 */}
          {menuEnabled('ws_message_center') && (
            <div
              className={navItemClass(isActive('/ws-message-center'))}
              onClick={() => navigate('/ws-message-center')}
            >
              <Bell className="h-5 w-5 my-[14px] flex-shrink-0" />
              <span className="mx-[14px] max-w-[140px] text-[14px] leading-[48px] truncate">{menuLabel('ws_message_center', '消息中心')}</span>
            </div>
          )}
        </nav>
        {/* Divider */}
        <div className="mx-3 my-1 h-[1px] bg-gray-200 dark:bg-gray-700"></div>
        {/* Management menus */}
        <nav className="flex flex-col px-1">
          {menuEnabled('ws_user_manage') && (
            <div
              className={navItemClass(isActive('/ws-users'))}
              onClick={() => navigate('/ws-users')}
            >
              <Users className="h-5 w-5 my-[14px] flex-shrink-0" />
              <span className="mx-[14px] max-w-[140px] text-[14px] leading-[48px] truncate">{menuLabel('ws_user_manage', localize('com_nav_user_manage'))}</span>
            </div>
          )}
          {menuEnabled('ws_role_manage') && (
            <div
              className={navItemClass(isActive('/ws-roles'))}
              onClick={() => navigate('/ws-roles')}
            >
              <Shield className="h-5 w-5 my-[14px] flex-shrink-0" />
              <span className="mx-[14px] max-w-[140px] text-[14px] leading-[48px] truncate">{menuLabel('ws_role_manage', localize('com_nav_role_manage'))}</span>
            </div>
          )}
        </nav>
      </div>
      <div id="create-convo-btn" className='opacity-0' onClick={clickHandler}></div>
      {subHeaders != null ? subHeaders : null}
    </div>
  );
}
