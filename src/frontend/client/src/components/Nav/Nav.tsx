import { memo, useCallback, useEffect, useState } from 'react';
import {
  useAuthContext,
  useLocalStorage,
  useLocalize,
  useMediaQuery,
} from '~/hooks';
import { cn } from '~/utils';
import AccountSettings from './AccountSettings';
import NavToggle from './NavToggle';
import NewChat from './NewChat';

const Nav = ({
  navVisible,
  setNavVisible,
}: {
  navVisible: boolean;
  setNavVisible: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const localize = useLocalize();
  const { isAuthenticated } = useAuthContext();

  const [navWidth, setNavWidth] = useState('260px');
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const [newUser, setNewUser] = useLocalStorage('newUser', true);
  const [isToggleHovering, setIsToggleHovering] = useState(false);

  useEffect(() => {
    if (isSmallScreen) {
      const savedNavVisible = localStorage.getItem('navVisible');
      if (savedNavVisible === null) {
        toggleNavVisible();
      }
      setNavWidth('320px');
    } else {
      setNavWidth('260px');
    }
  }, [isSmallScreen]);

  const toggleNavVisible = () => {
    setNavVisible((prev: boolean) => {
      localStorage.setItem('navVisible', JSON.stringify(!prev));
      return !prev;
    });
    if (newUser) {
      setNewUser(false);
    }
  };

  const itemToggleNav = () => {
    if (isSmallScreen) {
      toggleNavVisible();
    }
  };

  return (
    <>
      <div
        data-testid="nav"
        className={
          'nav active max-w-[320px] flex-shrink-0 overflow-x-hidden md:max-w-[200px] bg-[#F9FBFF] dark:bg-gray-900'
        }
        style={{
          width: navVisible ? (isSmallScreen ? navWidth : '200px') : '0px',
          visibility: navVisible ? 'visible' : 'hidden',
          transition: 'width 0.2s, visibility 0.2s',
        }}
      >
        <div className="h-full w-[320px] md:w-[200px]">
          <div className="flex h-full min-h-0 flex-col">
            <div
              className={cn(
                'flex h-full min-h-0 flex-col transition-opacity',
                isToggleHovering && !isSmallScreen ? 'opacity-50' : 'opacity-100',
              )}
            >
              <div
                className={cn(
                  'scrollbar-trigger relative h-full w-full flex-1 items-start border-white/20',
                )}
              >
                <nav
                  id="chat-history-nav"
                  aria-label={localize('com_ui_chat_history')}
                  className="flex h-full w-full flex-col px-2 pb-3.5"
                >
                  <NewChat
                    toggleNav={itemToggleNav}
                    isSmallScreen={isSmallScreen}
                  />
                  <div className="flex-1" />
                  <AccountSettings />
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
      <NavToggle
        isHovering={isToggleHovering}
        setIsHovering={setIsToggleHovering}
        onToggle={toggleNavVisible}
        navVisible={navVisible}
        className="fixed left-0 top-1/2 z-40 hidden md:flex"
      />
      {isSmallScreen && (
        <div
          id="mobile-nav-mask-toggle"
          role="button"
          tabIndex={0}
          className={`nav-mask ${navVisible ? 'active' : ''}`}
          onClick={toggleNavVisible}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              toggleNavVisible();
            }
          }}
          aria-label="Toggle navigation"
        />
      )}
    </>
  );
};

export default memo(Nav);
