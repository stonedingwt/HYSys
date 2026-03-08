import { TranslationKeys, useLocalize } from '~/hooks';
import { TStartupConfig } from '~/data-provider/data-provider/src';
import SocialLoginRender from './SocialLoginRender';
import { getLogoUrl, getCompanyName } from '~/utils/logoUtils';

const ErrorRender = ({ children }: { children: React.ReactNode }) => (
  <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50">
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-lg border border-red-500/40 bg-red-500/10 backdrop-blur-sm px-4 py-2 text-sm text-red-600 dark:text-red-400 shadow-lg"
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
          <a className="font-semibold text-cyan-600 hover:underline" href="/forgot-password">
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

  const companyName = getCompanyName() || (window as any).ThemeStyle?.branding?.companyName || '';

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-cyan-50/20 to-slate-100 dark:bg-[#030712] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_20%_80%,rgba(6,182,212,0.12),transparent_50%)] dark:opacity-100 opacity-60" style={{ animation: 'aurora-drift-1 25s ease-in-out infinite' }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_80%_20%,rgba(34,211,238,0.1),transparent_45%)] dark:opacity-100 opacity-50" style={{ animation: 'aurora-drift-2 30s ease-in-out infinite' }} />
      </div>

      <DisplayError />

      <div className="fixed z-10 sm:w-[1280px] w-full sm:h-[720px] h-full sm:-translate-x-1/2 sm:-translate-y-1/2 sm:left-1/2 sm:top-1/2 sm:border sm:border-slate-200/40 dark:sm:border-white/[0.08] sm:rounded-2xl sm:shadow-2xl overflow-hidden bg-white/90 dark:bg-[rgba(10,15,30,0.7)] dark:backdrop-blur-[40px] dark:saturate-[180%]">
        {/* Left: Logo area (desktop only) */}
        <div className="w-1/2 h-full m-0 hidden sm:flex flex-col relative z-20 pt-20 pl-20">
          <img
            src={getLogoUrl('login-logo-big')}
            alt="logo"
            className="object-cover max-w-[360px] dark:hidden"
          />
          <img
            src={getLogoUrl('login-logo-dark')}
            alt="logo"
            className="object-cover max-w-[360px] hidden dark:block"
          />
        </div>

        {/* Right: Form area */}
        <div className="sm:absolute sm:w-full sm:h-full z-10 sm:top-0 h-full">
          <div className="sm:w-1/2 w-full sm:ml-auto px-5 sm:px-[100px] py-10 sm:py-[60px] bg-white/90 dark:bg-[rgba(10,15,30,0.7)] dark:backdrop-blur-[40px] dark:saturate-[180%] relative h-full flex flex-col">
            <div className="flex flex-col items-center gap-6 mt-5 sm:mt-10 flex-1">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-center text-slate-700 dark:text-slate-200">
                {companyName || startupConfig?.appTitle || 'HYSys'}
              </h2>

              {isFetching ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-8 h-8 border-2 border-slate-300 border-t-cyan-500 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="w-full max-w-[300px]">
                  {!hasStartupConfigError && header && (
                    <h1
                      className="mb-6 text-center text-lg font-semibold text-slate-600 dark:text-slate-300"
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
