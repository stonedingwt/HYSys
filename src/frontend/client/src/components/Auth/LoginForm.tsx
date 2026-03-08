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
        <div className="mt-2 rounded-md border border-sky-500 bg-sky-500/10 px-3 py-2 text-sm text-slate-600 dark:text-slate-200">
          {localize('com_auth_email_verification_resend_prompt')}
          <button
            type="button"
            className="ml-2 text-sky-600 hover:underline dark:text-sky-400"
            onClick={handleResendEmail}
            disabled={resendLinkMutation.isLoading}
          >
            {localize('com_auth_email_resend_link')}
          </button>
        </div>
      )}
      <form
        className="mt-6"
        aria-label="Login form"
        method="POST"
        onSubmit={handleSubmit((data) => onSubmit(data))}
      >
        <div className="mb-4">
          <div className="relative">
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
              className="
                webkit-dark-styles transition-color peer w-full rounded-xl border border-slate-200 dark:border-white/[0.08]
                bg-white dark:bg-white/[0.05] px-3.5 pb-2.5 pt-3 text-slate-900 dark:text-slate-100 duration-200
                focus:border-sky-500 dark:focus:border-sky-400/50 focus:ring-2 focus:ring-sky-500/20 focus:outline-none
              "
              placeholder=" "
            />
            <label
              htmlFor="email"
              className="
                absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-white dark:bg-white/[0.05] px-2 text-sm text-slate-500 dark:text-slate-400 duration-200
                peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100
                peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-sky-600 dark:peer-focus:text-sky-400
                rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4
                "
            >
              {useUsernameLogin
                ? localize('com_auth_username').replace(/ \(.*$/, '')
                : localize('com_auth_email_address')}
            </label>
          </div>
          {renderError('email')}
        </div>
        <div className="mb-2">
          <div className="relative">
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
              className="
                webkit-dark-styles transition-color peer w-full rounded-xl border border-slate-200 dark:border-white/[0.08]
                bg-white dark:bg-white/[0.05] px-3.5 pb-2.5 pt-3 text-slate-900 dark:text-slate-100 duration-200
                focus:border-sky-500 dark:focus:border-sky-400/50 focus:ring-2 focus:ring-sky-500/20 focus:outline-none
                "
              placeholder=" "
            />
            <label
              htmlFor="password"
              className="
                absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-white dark:bg-white/[0.05] px-2 text-sm text-slate-500 dark:text-slate-400 duration-200
                peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100
                peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-sky-600 dark:peer-focus:text-sky-400
                rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4
                "
            >
              {localize('com_auth_password')}
            </label>
          </div>
          {renderError('password')}
        </div>
        {startupConfig.passwordResetEnabled && (
          <a
            href="/forgot-password"
            className="inline-flex p-1 text-sm font-medium text-sky-600 transition-colors hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
          >
            {localize('com_auth_password_forgot')}
          </a>
        )}
        <div className="mt-6">
          <button
            aria-label={localize('com_auth_continue')}
            data-testid="login-button"
            type="submit"
            className="
            w-full rounded-xl bg-sky-500 dark:bg-gradient-to-r dark:from-sky-400 dark:to-sky-500 px-4 py-3 text-sm font-medium text-white
            transition-all duration-150 hover:bg-sky-600 dark:hover:brightness-110 hover:shadow-sm active:scale-[0.98]
          "
          >
            {localize('com_auth_continue')}
          </button>
        </div>
      </form>
    </>
  );
};

export default LoginForm;
