import { TranslationKeys, useLocalize } from '~/hooks';
import { BlinkAnimation } from './BlinkAnimation';
import { TStartupConfig } from '~/data-provider/data-provider/src';
import SocialLoginRender from './SocialLoginRender';
import { ThemeSelector } from '~/components/ui';
import { Banner } from '../Banners';
import HYSysLogo from '~/components/svg/HYSysLogo';

const ErrorRender = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-16 flex justify-center">
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-md border border-red-500 bg-red-500/10 px-3 py-2 text-sm text-slate-600 dark:text-slate-200"
    >
      {children}
    </div>
  </div>
);

function AuthLayout({
  children,
  header,
  isFetching,
  startupConfig,
  startupConfigError,
  pathname,
  error,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  isFetching: boolean;
  startupConfig: TStartupConfig | null | undefined;
  startupConfigError: unknown | null | undefined;
  pathname: string;
  error: TranslationKeys | null;
}) {
  const localize = useLocalize();

  const hasStartupConfigError = startupConfigError !== null && startupConfigError !== undefined;
  const DisplayError = () => {
    if (hasStartupConfigError) {
      return <ErrorRender>{localize('com_auth_error_login_server')}</ErrorRender>;
    } else if (error === 'com_auth_error_invalid_reset_token') {
      return (
        <ErrorRender>
          {localize('com_auth_error_invalid_reset_token')}{' '}
          <a className="font-semibold text-sky-600 hover:underline" href="/forgot-password">
            {localize('com_auth_click_here')}
          </a>{' '}
          {localize('com_auth_to_try_again')}
        </ErrorRender>
      );
    } else if (error != null && error) {
      return <ErrorRender>{localize(error)}</ErrorRender>;
    }
    return null;
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-sky-50/30 to-slate-100 dark:bg-[#0B1120]">
      {/* Aurora background overlay — dark mode only */}
      <div className="absolute inset-0 login-aurora-bg pointer-events-none dark:opacity-100 opacity-0" aria-hidden />
      <Banner />
      <DisplayError />
      <div className="absolute bottom-0 left-0 md:m-4">
        <ThemeSelector />
      </div>

      <div className="flex flex-grow items-center justify-center px-4">
        <div className="w-authPageWidth overflow-hidden bg-white/90 backdrop-blur-xl rounded-2xl shadow-modal border border-slate-200/60 dark:bg-white/[0.05] dark:backdrop-blur-xl dark:border-white/[0.08] px-6 py-6 sm:max-w-md">
          <BlinkAnimation active={isFetching}>
            <div className="mb-6 flex flex-col items-center gap-2">
              <HYSysLogo size={48} variant="icon" />
              <span className="font-display font-bold text-slate-800 dark:text-slate-100 text-lg">
                {startupConfig?.appTitle ?? 'HYSys'}
              </span>
            </div>
          </BlinkAnimation>
          {!hasStartupConfigError && !isFetching && (
            <h1
              className="mb-4 text-center text-2xl font-semibold text-slate-800 dark:text-slate-100"
              style={{ userSelect: 'none' }}
            >
              {header}
            </h1>
          )}
          {children}
          {!pathname.includes('2fa') &&
            (pathname.includes('login') || pathname.includes('register')) && (
            <SocialLoginRender startupConfig={startupConfig} />
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
