import Cookies from 'js-cookie';
import { Check, FileText, GanttChartIcon, Globe, LogOut } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';
import { GearIcon, UserIcon } from '~/components/svg';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { useAuthContext } from '~/hooks/AuthContext';
import useAvatar from '~/hooks/Messages/useAvatar';
import store from '~/store';
import MyKnowledgeView from '../Chat/Input/Files/MyKnowledgeView';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '../ui';
import Settings from './Settings';

function AccountSettings() {
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

  return (
    <div className='mt-text-sm h-auto w-full items-center gap-2 rounded-xl p-2 text-sm'>
        <div
          className="inline-flex w-full px-4 h-12 mb-[3.5px] items-center cursor-pointer transition-all duration-150 rounded-md text-slate-400 hover:bg-navy-800 hover:text-slate-200"
          onClick={() => setShowKnowledge(true)}
        >
          <FileText className="h-5 w-5 my-[14px] flex-shrink-0" />
          <span className="mx-[14px] max-w-[140px] text-[14px] leading-[48px] truncate">{localize('com_nav_personal_knowledge')}</span>
        </div>
      <div className='h-[1px] bg-navy-700'></div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className='cursor-pointer mt-text-sm mt-2 inline-flex w-full px-4 h-12 items-center gap-2 text-sm transition-all duration-150 hover:bg-navy-800 rounded-md'>
            <div className="-ml-0.9 -mt-0.8 h-8 w-8 flex-shrink-0">
              <div className="relative flex">
                {name.length === 0 ? (
                  <div
                    className="relative flex items-center justify-center rounded-full p-1 text-white bg-gradient-to-br from-navy-500 to-navy-700 w-8 h-8 shadow-[0_0_0_1px_rgba(240,246,252,0.1)]"
                    aria-hidden="true"
                  >
                    <UserIcon />
                  </div>
                ) : (
                  <div className="w-8 h-8 min-w-6 text-white bg-primary rounded-full flex justify-center items-center text-xs">{(user?.name ?? user?.username ?? localize('com_nav_user')).substring(0, 2).toUpperCase()}</div>
                  // <img
                  //   className="rounded-full"
                  //   src={(user?.avatar ?? '') || avatarSrc}
                  //   alt={`${name}'s avatar`}
                  // />
                )}
              </div>
            </div>
            <div
              className="mt-2 grow overflow-hidden text-ellipsis whitespace-nowrap text-left text-white"
              style={{ marginTop: '0', marginLeft: '0' }}
            >
              {user?.name ?? user?.username ?? localize('com_nav_user')}
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-60 rounded-2xl'>
          {user?.plugins?.includes('backend') && <a href="/sysadmin/" target='_blank'>
            <DropdownMenuItem className='select-item text-sm font-normal'>
              <GanttChartIcon className="icon-md" />
              {localize('com_nav_admin_panel')}
            </DropdownMenuItem>
          </a>}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className='select-item text-sm font-normal'>
              <Globe className="icon-md" />
              {localize('com_nav_language')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className='w-40 rounded-2xl'>
              <span className='text-xs text-gray-400 pl-2'>{localize('com_nav_language_label')}</span>
              <DropdownMenuItem className='font-normal justify-between' onClick={() => changeLang('zh-Hans')}>
                {localize('com_nav_lang_chinese')}
                {langcode === 'zh-Hans' && <Check size={16} />}
              </DropdownMenuItem>
              <DropdownMenuItem className='font-normal justify-between' onClick={() => changeLang('en-US')}>
                {localize('com_nav_lang_english')}
                {langcode === 'en-US' && <Check size={16} />}
              </DropdownMenuItem>
              <DropdownMenuItem className='font-normal justify-between' onClick={() => changeLang('ja')}>
                {localize('com_nav_lang_japanese')}
                {langcode === 'ja' && <Check size={16} />}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {/* <DropdownMenuItem className='select-item text-sm font-normal'>
            <div className='w-full flex gap-2 items-center' onClick={() => setShowSettings(true)} >
              <GearIcon className="icon-md" aria-hidden="true" />
              {localize('com_nav_settings')}
            </div>
          </DropdownMenuItem> */}
          <DropdownMenuItem className='select-item text-sm font-normal'>
            <div className='w-full flex gap-2 items-center' onClick={logout} >
              <LogOut className="icon-md" />
              {localize('com_nav_log_out')}
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* {showFiles && <FilesView open={showFiles} onOpenChange={setShowFiles} />} */}
      {showKnowledge && <MyKnowledgeView open={showKnowledge} onOpenChange={setShowKnowledge} />}
      {showSettings && <Settings open={showSettings} onOpenChange={setShowSettings} />}
    </div>
  );
}

export default memo(AccountSettings);
