import Cookies from 'js-cookie';
import { Check, FileText, GanttChartIcon, Globe, LogOut } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';
import { UserIcon } from '~/components/svg';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { useAuthContext } from '~/hooks/AuthContext';
import useAvatar from '~/hooks/Messages/useAvatar';
import store from '~/store';
import MyKnowledgeView from '../Chat/Input/Files/MyKnowledgeView';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '../ui';
import Settings from './Settings';

function AccountSettings({ isIconMode = false }: { isIconMode?: boolean }) {
  const localize = useLocalize();
  const [langcode, setLangcode] = useRecoilState(store.lang);
  const changeLang = useCallback(
    (value: string) => {
      let userLang = value;
      if (value === 'auto') {
        userLang = navigator.language || navigator.languages[0];
      }
      requestAnimationFrame(() => {
        document.documentElement.lang = userLang;
      });
      setLangcode(userLang);
      Cookies.set('lang', userLang, { expires: 365 });
    },
    [setLangcode],
  );

  const { user, isAuthenticated, logout } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const balanceQuery = useGetUserBalance({
    enabled: !!isAuthenticated && startupConfig?.checkBalance,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showFiles, setShowFiles] = useRecoilState(store.showFiles);
  const [showKnowledge, setShowKnowledge] = useRecoilState(store.showKnowledge);

  const avatarSrc = useAvatar(user);
  const name = user?.avatar ?? user?.username ?? '';
  const initials = (user?.name ?? user?.username ?? 'U').substring(0, 2).toUpperCase();

  return (
    <div className="flex-shrink-0 p-2">
      {/* Knowledge base button */}
      {!isIconMode && (
        <div
          className="flex items-center w-full h-9 px-3 gap-3 cursor-pointer transition-all duration-150 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-200 mb-1"
          onClick={() => setShowKnowledge(true)}
        >
          <FileText className="w-[18px] h-[18px] flex-shrink-0" />
          <span className="text-[13px] truncate">{localize('com_nav_personal_knowledge')}</span>
        </div>
      )}
      {isIconMode && (
        <div
          className="flex items-center justify-center w-10 h-10 mx-auto cursor-pointer transition-all duration-150 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-200 mb-1"
          onClick={() => setShowKnowledge(true)}
          title={localize('com_nav_personal_knowledge')}
        >
          <FileText className="w-[18px] h-[18px]" />
        </div>
      )}

      <div className="h-px bg-slate-200 dark:bg-white/[0.06] mb-2" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className={`cursor-pointer flex items-center transition-all duration-150 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg ${isIconMode ? 'w-10 h-10 justify-center mx-auto' : 'h-10 px-3 gap-3'}`}>
            <div className="w-7 h-7 rounded-full bg-cyan-500 text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
              {initials}
            </div>
            {!isIconMode && (
              <span className="text-[13px] text-slate-700 dark:text-slate-200 truncate flex-1">
                {user?.name ?? user?.username ?? localize('com_nav_user')}
              </span>
            )}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 rounded-xl" side={isIconMode ? 'right' : 'top'} align="start">
          {user?.plugins?.includes('backend') && (
            <a href="/sysadmin/" target="_blank">
              <DropdownMenuItem className="select-item text-sm font-normal gap-2">
                <GanttChartIcon className="w-4 h-4" />
                {localize('com_nav_admin_panel')}
              </DropdownMenuItem>
            </a>
          )}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="select-item text-sm font-normal gap-2">
              <Globe className="w-4 h-4" />
              {localize('com_nav_language')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-40 rounded-xl">
              <span className="text-xs text-slate-400 pl-2">{localize('com_nav_language_label')}</span>
              <DropdownMenuItem className="font-normal justify-between" onClick={() => changeLang('zh-Hans')}>
                {localize('com_nav_lang_chinese')}
                {langcode === 'zh-Hans' && <Check size={16} />}
              </DropdownMenuItem>
              <DropdownMenuItem className="font-normal justify-between" onClick={() => changeLang('en-US')}>
                {localize('com_nav_lang_english')}
                {langcode === 'en-US' && <Check size={16} />}
              </DropdownMenuItem>
              <DropdownMenuItem className="font-normal justify-between" onClick={() => changeLang('ja')}>
                {localize('com_nav_lang_japanese')}
                {langcode === 'ja' && <Check size={16} />}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem className="select-item text-sm font-normal gap-2" onClick={logout}>
            <LogOut className="w-4 h-4" />
            {localize('com_nav_log_out')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showKnowledge && <MyKnowledgeView open={showKnowledge} onOpenChange={setShowKnowledge} />}
      {showSettings && <Settings open={showSettings} onOpenChange={setShowSettings} />}
    </div>
  );
}

export default memo(AccountSettings);
