import { useForm } from 'react-hook-form';
import React, { useState, useEffect } from 'react';
import type { TLoginUser, TStartupConfig } from '~/data-provider/data-provider/src';
import type { TAuthContext } from '~/common';
import { useResendVerificationEmail, useGetStartupConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';

type TLoginFormProps = {
  onSubmit: (data: TLoginUser) => void;
  startupConfig: TStartupConfig;
  error: Pick<TAuthContext, 'error'>['error'];
  setError: Pick<TAuthContext, 'setError'>['setError'];
};

const LoginForm: React.FC<TLoginFormProps> = ({ onSubmit, startupConfig, error, setError }) => {
  const localize = useLocalize();
  const {
    register,
    getValues,
    handleSubmit,
    formState: { errors },
  } = useForm<TLoginUser>();
  const [showResendLink, setShowResendLink] = useState<boolean>(false);

  const { data: config } = useGetStartupConfig();
  const useUsernameLogin = config?.ldap?.username;

  useEffect(() => {
    if (error && error.includes('422') && !showResendLink) {
      setShowResendLink(true);
    }
  }, [error, showResendLink]);

  const resendLinkMutation = useResendVerificationEmail({
    onMutate: () => {
      setError(undefined);
      setShowResendLink(false);
    },
  });

  if (!startupConfig) {
    return null;
  }

  const renderError = (fieldName: string) => {
    const errorMessage = errors[fieldName]?.message;
    return errorMessage ? (
      <span role="alert" className="mt-1 text-sm text-red-500 dark:text-red-900">
        {String(errorMessage)}
      </span>
    ) : null;
  };

  const handleResendEmail = () => {
    const email = getValues('email');
    if (!email) {
      return setShowResendLink(false);
    }
    resendLinkMutation.mutate({ email });
  };

  return (
    <>
      {showResendLink && (
        <div className="mt-2 rounded-md border border-cyan-500 bg-cyan-500/10 px-3 py-2 text-sm text-slate-600 dark:text-slate-200">
          {localize('com_auth_email_verification_resend_prompt')}
          <button
            type="button"
            className="ml-2 text-cyan-600 hover:underline dark:text-cyan-400"
            onClick={handleResendEmail}
            disabled={resendLinkMutation.isLoading}
          >
            {localize('com_auth_email_resend_link')}
          </button>
        </div>
      )}
      <form
        className="grid gap-3"
        aria-label="Login form"
        method="POST"
        onSubmit={handleSubmit((data) => onSubmit(data))}
      >
        <div className="grid">
          <input
            type="text"
            id="email"
            autoComplete={useUsernameLogin ? 'username' : 'email'}
            aria-label={localize('com_auth_email')}
            {...register('email', {
              required: localize('com_auth_email_required'),
              maxLength: { value: 120, message: localize('com_auth_email_max_length') },
              pattern: {
                value: useUsernameLogin ? /\S+/ : /\S+/,
                message: localize('com_auth_email_pattern'),
              },
            })}
            aria-invalid={!!errors.email}
            className="h-12 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] dark:bg-white/[0.05] px-4 text-slate-900 dark:text-slate-100 focus:border-cyan-500 dark:focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all"
            placeholder="请输入用户名"
          />
          {renderError('email')}
        </div>
        <div className="grid">
          <input
            type="password"
            id="password"
            autoComplete="current-password"
            aria-label={localize('com_auth_password')}
            {...register('password', {
              required: localize('com_auth_password_required'),
              minLength: { value: 8, message: localize('com_auth_password_min_length') },
              maxLength: { value: 128, message: localize('com_auth_password_max_length') },
            })}
            aria-invalid={!!errors.password}
            className="h-12 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] dark:bg-white/[0.05] px-4 text-slate-900 dark:text-slate-100 focus:border-cyan-500 dark:focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all"
            placeholder={localize('com_auth_password')}
          />
          {renderError('password')}
        </div>
        {startupConfig.passwordResetEnabled && (
          <a
            href="/forgot-password"
            className="inline-flex p-1 text-sm font-medium text-cyan-600 transition-colors hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
          >
            {localize('com_auth_password_forgot')}
          </a>
        )}
        <button
          aria-label={localize('com_auth_continue')}
          data-testid="login-button"
          type="submit"
          className="h-12 mt-5 w-full rounded-lg bg-cyan-500 hover:bg-cyan-600 dark:bg-gradient-to-r dark:from-cyan-400 dark:to-cyan-500 dark:hover:from-cyan-400/90 dark:hover:to-cyan-500/90 text-white text-sm font-medium shadow-sm hover:shadow-md transition-all duration-150 active:scale-[0.98] cursor-pointer"
        >
          {localize('com_auth_continue')}
        </button>
      </form>
    </>
  );
};

export default LoginForm;
