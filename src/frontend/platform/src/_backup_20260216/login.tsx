import { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from 'react-i18next';
import json from "../../../package.json";
import { Button } from "../../components/mep-ui/button";
import { Input } from "../../components/mep-ui/input";
import { useToast } from "@/components/mep-ui/toast/use-toast";
import { useLocation, useNavigate } from 'react-router-dom';
import { getCaptchaApi, loginApi } from "../../controllers/API/user";
import { captureAndAlertRequestErrorHoc } from "../../controllers/request";
import LoginBridge from './loginBridge';
import { handleEncrypt, handleLdapEncrypt } from './utils';
import { locationContext } from '@/contexts/locationContext';
import { ldapLoginApi } from '@/controllers/API/pro';
import { getLogoUrl } from '@/util/logoUtils';
import { QRCodeSVG } from 'qrcode.react';
import { ScanLine, KeyRound } from "lucide-react";

export const LoginPage = () => {
    const { t } = useTranslation();
    const { message } = useToast()
    const navigate = useNavigate()
    const { appConfig } = useContext(locationContext)
    const isLoading = false

    const mailRef = useRef(null)
    const pwdRef = useRef(null)

    // QR code scan login mode
    const [qrMode, setQrMode] = useState(false)

    useLoginError()

    // captcha
    const captchaRef = useRef(null)
    const [captchaData, setCaptchaData] = useState({ captcha_key: '', user_capthca: false, captcha: '' });

    useEffect(() => {
        fetchCaptchaData();
    }, []);

    const fetchCaptchaData = () => {
        getCaptchaApi().then(setCaptchaData)
    };

    const [isLDAP, setIsLDAP] = useState(false)
    const handleLogin = async () => {
        const error = []
        const [mail, pwd] = [mailRef.current.value, pwdRef.current.value]
        if (!mail) error.push(t('login.pleaseEnterAccount'))
        if (!pwd) error.push(t('login.pleaseEnterPassword'))
        if (captchaData.user_capthca && !captchaRef.current.value) error.push(t('login.pleaseEnterCaptcha'))
        if (error.length) return message({
            title: `${t('prompt')}`,
            variant: 'warning',
            description: error
        })

        const encryptPwd = isLDAP ? await handleLdapEncrypt(pwd) : await handleEncrypt(pwd)
        captureAndAlertRequestErrorHoc(
            (isLDAP
                ? ldapLoginApi(mail, encryptPwd)
                : loginApi(mail, encryptPwd, captchaData.captcha_key, captchaRef.current?.value)
            ).then((res: any) => {
                window.self === window.top ? localStorage.removeItem('ws_token') : localStorage.setItem('ws_token', res.access_token)
                localStorage.setItem('isLogin', '1')
                const pathname = localStorage.getItem('LOGIN_PATHNAME')
                if (pathname) {
                    localStorage.removeItem('LOGIN_PATHNAME')
                    location.href = pathname
                } else {
                    const path = import.meta.env.DEV ? '/admin' : '/workspace/'
                    const rootUrl = `${location.origin}${__APP_ENV__.BASE_URL}${path}`
                    location.href = `${__APP_ENV__.BASE_URL}${location.pathname}` === '/' ? rootUrl : location.href
                }
            }), (error) => {
                if (error.indexOf('过期') !== -1) {
                    localStorage.setItem('account', mail)
                    navigate('/reset', { state: { noback: true } })
                }
            })

        fetchCaptchaData()
    }

    // Whether SSO QR login has a real auth URL
    const hasSsoUrl = appConfig.ssoType && appConfig.ssoType !== 'none' && !!appConfig.ssoAuthUrl

    return <div className='w-full h-full bg-background-dark'>
        <div className='fixed z-10 sm:w-[1280px] w-full sm:h-[720px] h-full translate-x-[-50%] translate-y-[-50%] left-[50%] top-[50%] border rounded-lg shadow-xl overflow-hidden bg-background-login'>
            {/* ====== Flex container: left 50% + right 50% ====== */}
            <div className="flex w-full h-full">
                {/* ---- Left panel: logo area (50%) ---- */}
                <div className='hidden sm:flex w-1/2 h-full items-center justify-center p-[8px]'>
                    <div className="w-[60%] aspect-[3/5] relative rounded-lg overflow-hidden">
                        <img
                            src={getLogoUrl('login-logo-big')}
                            alt="logo_picture"
                            className='w-full h-full object-contain dark:hidden'
                        />
                        <img
                            src={getLogoUrl('login-logo-dark')}
                            alt="logo_picture"
                            className='w-full h-full object-contain hidden dark:block'
                        />
                    </div>
                </div>

                {/* ---- Right panel: login form (50%) ---- */}
                <div className='w-full sm:w-1/2 h-full flex items-center justify-center relative bg-background-login'>
                    {/* QR toggle button – always visible, top-right */}
                    <button
                        onClick={() => setQrMode(!qrMode)}
                        className="absolute right-[16px] top-[16px] w-[40px] h-[40px] flex items-center justify-center rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all group z-10"
                        title={qrMode ? "账号密码登录" : "扫码登录"}
                    >
                        {qrMode
                            ? <KeyRound className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            : <ScanLine className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        }
                    </button>

                    {/* Main content area */}
                    <div className="w-full max-w-[320px] px-[20px]">
                        {/* Company name / slogan */}
                        <div className="mb-[48px]">
                            <span className='block w-fit m-auto font-medium text-[18px] text-tx-color'>{t('login.slogen')}</span>
                        </div>

                        {qrMode ? (
                            /* ============ QR Code Scan Login ============ */
                            <div className="flex flex-col items-center">
                                {hasSsoUrl ? (
                                    <>
                                        <div className="bg-white p-4 rounded-xl shadow-sm border border-border">
                                            <QRCodeSVG
                                                value={appConfig.ssoAuthUrl}
                                                size={180}
                                                level="M"
                                                includeMargin={false}
                                            />
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-4">
                                            请使用 <span className="font-medium text-foreground">{appConfig.ssoLabel}</span> 扫码登录
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            扫描二维码后将自动完成登录
                                        </p>
                                        <Button
                                            variant="outline"
                                            className="mt-6 h-[40px] text-sm gap-2"
                                            onClick={() => { window.location.href = appConfig.ssoAuthUrl; }}
                                        >
                                            直接跳转到{appConfig.ssoLabel}授权
                                        </Button>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center py-8 text-center">
                                        <ScanLine className="w-12 h-12 text-muted-foreground/40 mb-4" />
                                        <p className="text-sm text-muted-foreground">
                                            暂未配置第三方扫码登录
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            请在 系统管理 → 系统配置 → 登录方式 中启用
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* ============ Username / Password Login ============ */
                            <div className="grid gap-[12px]">
                                <div className="grid">
                                    <Input
                                        id="email"
                                        className='h-[48px] dark:bg-login-input'
                                        ref={mailRef}
                                        placeholder={t('login.account')}
                                        type="text"
                                        autoCapitalize="none"
                                        autoComplete="username"
                                        autoCorrect="off"
                                    />
                                </div>
                                <div className="grid">
                                    <Input
                                        id="pwd"
                                        className='h-[48px] dark:bg-login-input'
                                        ref={pwdRef}
                                        placeholder={t('login.password')}
                                        type="password"
                                        onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                                </div>
                                {
                                    captchaData.user_capthca && (<div className="flex items-center gap-4">
                                        <Input
                                            type="text"
                                            ref={captchaRef}
                                            placeholder={t('login.pleaseEnterCaptcha')}
                                            className="form-input px-4 py-2 border border-gray-300 focus:outline-none"
                                        />
                                        <img
                                            src={'data:image/jpg;base64,' + captchaData.captcha}
                                            alt="captcha"
                                            onClick={fetchCaptchaData}
                                            className="cursor-pointer h-10 bg-gray-100 border border-gray-300"
                                            style={{ width: '120px' }}
                                        />
                                    </div>
                                    )
                                }
                                <Button
                                    className='h-[48px] mt-[32px] dark:bg-button'
                                    disabled={isLoading} onClick={handleLogin} >{t('login.loginButton')}</Button>
                                {appConfig.isPro && <LoginBridge onHasLdap={setIsLDAP} />}
                            </div>
                        )}
                    </div>

                    {/* Version tag – bottom right */}
                    <div className="absolute right-[16px] bottom-[16px]">
                        <span className="text-sm text-gray-400">v{json.version}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
};




export const useLoginError = () => {
    const location = useLocation();
    const { toast } = useToast();
    const { t } = useTranslation();

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const code = queryParams.get('status_code')
        if (code) {
            toast({
                variant: 'error',
                description: t('errors.' + code)
            })
        }
    }, [location])
}