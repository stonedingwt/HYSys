import { useContext, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from 'react-i18next';
import json from "../../../package.json";
import { Button } from "../../components/mep-ui/button";
import { Input } from "../../components/mep-ui/input";
import { useToast } from "@/components/mep-ui/toast/use-toast";
import { useLocation, useNavigate } from 'react-router-dom';
import { getCaptchaApi, loginApi } from "../../controllers/API/user";
import { captureAndAlertRequestErrorHoc } from "../../controllers/request";
import { handleEncrypt } from './utils';
import { locationContext } from '@/contexts/locationContext';
import { getLogoUrl } from '@/util/logoUtils';

const isDingTalkApp = /DingTalk/i.test(navigator.userAgent);

function destroyDtLoginElements() {
    const root = document.getElementById('dt-qr-root')
    if (root) root.remove()
    document.querySelectorAll('iframe').forEach(iframe => {
        try {
            const src = iframe.src || ''
            if (src.includes('dingtalk') || src.includes('login.dingtalk')) {
                iframe.remove()
            }
        } catch { /* cross-origin */ }
    })
}

export const LoginPage = () => {
    const { t } = useTranslation();
    const { message } = useToast()
    const navigate = useNavigate()
    const { appConfig } = useContext(locationContext)
    const isLoading = false

    const mailRef = useRef(null)
    const pwdRef = useRef(null)

    const isAdminLogin = true
    const hasSsoUrl = appConfig.ssoType && appConfig.ssoType !== 'none' && !!appConfig.ssoAuthUrl
    const qrMode = false
    const [dtReady, setDtReady] = useState(false)
    const [dtAutoRedirecting, setDtAutoRedirecting] = useState(false)
    const dtContainerRef = useRef<HTMLDivElement>(null)

    useLoginError()

    const captchaRef = useRef(null)
    const [captchaData, setCaptchaData] = useState({ captcha_key: '', user_capthca: false, captcha: '' });

    useEffect(() => {
        fetchCaptchaData();
    }, []);

    // DingTalk in-app auto-login: redirect to OAuth2 URL directly
    useEffect(() => {
        if (!isDingTalkApp || isAdminLogin || !hasSsoUrl || appConfig.ssoType !== 'dingtalk') return
        const params = new URLSearchParams(window.location.search)
        if (params.get('status_code') || params.get('error')) return

        try {
            const ssoUrl = new URL(appConfig.ssoAuthUrl)
            const clientId = ssoUrl.searchParams.get('client_id') || ''
            const redirectUri = ssoUrl.searchParams.get('redirect_uri') || ''
            if (!clientId || !redirectUri) return
            setDtAutoRedirecting(true)
            window.location.href = `https://login.dingtalk.com/oauth2/auth?redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&client_id=${clientId}&scope=openid&prompt=auto`
        } catch { /* ignore */ }
    }, [isAdminLogin, hasSsoUrl, appConfig])

    const cleanupDtLogin = useCallback(() => {
        if (dtContainerRef.current) dtContainerRef.current.innerHTML = ''
        destroyDtLoginElements()
        setDtReady(false)
    }, [])

    useEffect(() => {
        if (!qrMode) {
            cleanupDtLogin()
        }
    }, [qrMode, cleanupDtLogin])

    // PC browser: show DingTalk QR code login (skip if in DingTalk app)
    useEffect(() => {
        if (isDingTalkApp) return
        if (!qrMode || !hasSsoUrl || appConfig.ssoType !== 'dingtalk') return
        let ssoUrl: URL
        try { ssoUrl = new URL(appConfig.ssoAuthUrl) } catch { return }
        const clientId = ssoUrl.searchParams.get('client_id') || ''
        const redirectUri = ssoUrl.searchParams.get('redirect_uri') || ''
        if (!clientId || !redirectUri) return

        const doInit = () => {
            const el = dtContainerRef.current
            if (!el || !(window as any).DTFrameLogin) return
            destroyDtLoginElements()
            const wrapper = document.createElement('div')
            wrapper.id = 'dt-qr-root'
            el.innerHTML = ''
            el.appendChild(wrapper)
            try {
                (window as any).DTFrameLogin(
                    { id: 'dt-qr-root', width: 300, height: 300 },
                    { redirect_uri: encodeURIComponent(redirectUri), client_id: clientId, scope: 'openid', response_type: 'code', prompt: 'auto' },
                    (result: any) => { window.location.href = result.redirectUrl },
                    (errorMsg: string) => { console.error('DingTalk login error:', errorMsg) },
                )
                setDtReady(true)
            } catch (e) { console.error('DTFrameLogin init error:', e) }
        }

        const scriptId = 'dt-login-sdk'
        let script = document.getElementById(scriptId) as HTMLScriptElement | null
        if (!script) {
            script = document.createElement('script')
            script.id = scriptId
            script.src = 'https://g.alicdn.com/dingding/h5-dingtalk-login/0.21.0/ddlogin.js'
            script.onload = () => setTimeout(doInit, 50)
            document.head.appendChild(script)
        } else {
            setTimeout(doInit, 50)
        }

        return () => {
            destroyDtLoginElements()
            if (dtContainerRef.current) dtContainerRef.current.innerHTML = ''
        }
    }, [qrMode, hasSsoUrl, appConfig])

    const fetchCaptchaData = () => {
        getCaptchaApi().then(setCaptchaData)
    };

    const ssoLabels: Record<string, string> = { dingtalk: '钉钉', wecom: '企业微信', feishu: '飞书', aad: 'Azure AD' }
    const ssoLabel = appConfig.ssoLabel || ssoLabels[appConfig.ssoType] || '第三方'

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

        const encryptPwd = await handleEncrypt(pwd)
        captureAndAlertRequestErrorHoc(
            loginApi(mail, encryptPwd, captchaData.captcha_key, captchaRef.current?.value)
            .then((res: any) => {
                localStorage.setItem('ws_token', res.access_token)
                localStorage.setItem('isLogin', '1')
                const pathname = localStorage.getItem('LOGIN_PATHNAME')
                if (pathname) {
                    localStorage.removeItem('LOGIN_PATHNAME')
                    location.href = pathname
                } else if (isAdminLogin) {
                    location.href = `${location.origin}${__APP_ENV__.BASE_URL}/build`
                } else {
                    location.href = `${location.origin}/`
                }
            }), (error) => {
                if (error.indexOf('过期') !== -1) {
                    localStorage.setItem('account', mail)
                    navigate('/reset', { state: { noback: true } })
                }
            })

        fetchCaptchaData()
    }

    // DingTalk in-app: show auto-redirecting state
    if (isDingTalkApp && dtAutoRedirecting) {
        return <div className='w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center'>
            <div className="text-center">
                <div className="w-10 h-10 border-3 border-slate-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-base text-slate-400">正在通过钉钉登录...</p>
            </div>
        </div>
    }

    return <div className='w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800'>
        <div className='fixed z-10 sm:w-[1280px] w-full sm:h-[720px] h-full sm:translate-x-[-50%] sm:translate-y-[-50%] sm:left-[50%] sm:top-[50%] sm:border sm:border-slate-200/50 dark:sm:border-slate-600/50 sm:rounded-2xl sm:shadow-2xl overflow-hidden bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl'>
            <div className='w-1/2 h-full m-0 hidden sm:block relative z-20 pt-20 pl-20'>
                <img src={getLogoUrl('login-logo-big')} alt="logo_picture" className='object-cover dark:hidden' />
                <img src={getLogoUrl('login-logo-dark')} alt="logo_picture" className='object-cover hidden dark:block' />
            </div>
            <div className='sm:absolute sm:w-full sm:h-full z-10 sm:top-0 h-full'>
                <div className='sm:w-1/2 w-full sm:ml-auto px-[20px] sm:px-[100px] py-[40px] sm:py-[60px] bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl relative h-full flex flex-col'>
                    <div className="flex flex-col items-center gap-[24px] mt-[20px] sm:mt-[40px] flex-1">
                        <h2 className="text-xl sm:text-2xl font-semibold text-center text-slate-700 dark:text-slate-200">
                            {(window as any).ThemeStyle?.branding?.companyName || t('login.slogen')}
                        </h2>

                        {isAdminLogin ? (
                            <div className="grid gap-[12px] w-full max-w-[300px]">
                                <div className="grid">
                                    <Input id="email" className='h-[48px] rounded-lg border-slate-200 dark:border-slate-600 dark:bg-slate-800 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all' ref={mailRef} placeholder={t('login.account')} type="text" autoCapitalize="none" autoComplete="username" autoCorrect="off" />
                                </div>
                                <div className="grid">
                                    <Input id="pwd" className='h-[48px] rounded-lg border-slate-200 dark:border-slate-600 dark:bg-slate-800 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all' ref={pwdRef} placeholder={t('login.password')} type="password" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                                </div>
                                {captchaData.user_capthca && (<div className="flex items-center gap-4">
                                    <Input type="text" ref={captchaRef} placeholder={t('login.pleaseEnterCaptcha')} className="form-input px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none" />
                                    <img src={'data:image/jpg;base64,' + captchaData.captcha} alt="captcha" onClick={fetchCaptchaData} className="cursor-pointer h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg" style={{ width: '120px' }} />
                                </div>)}
                                <Button className='h-[48px] mt-[32px] bg-sky-500 hover:bg-sky-600 text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-150 active:scale-[0.98]' disabled={isLoading} onClick={handleLogin}>{t('login.loginButton')}</Button>
                            </div>
                        ) : hasSsoUrl ? (
                            <div className="flex flex-col items-center w-full max-w-[340px]">
                                <p className="text-sm text-muted-foreground mb-3">
                                    使用 <span className="font-medium text-foreground">{ssoLabel}</span> APP扫码登录
                                </p>
                                <div ref={dtContainerRef} className="flex items-center justify-center" style={{ minHeight: 300, minWidth: 300 }} />
                                {!dtReady && <div className="text-sm text-muted-foreground">加载中...</div>}
                                <p className="text-xs text-muted-foreground mt-2">
                                    使用{ssoLabel}APP扫描上方二维码完成登录
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center w-full max-w-[340px] py-10">
                                <p className="text-sm text-muted-foreground text-center">
                                    扫码登录功能未配置，请联系管理员
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="text-right py-2">
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

        // Handle status_code param (may be i18n key or Chinese message)
        const code = queryParams.get('status_code')
        if (code) {
            const hasCJK = /[\u4e00-\u9fff]/.test(code)
            toast({
                variant: 'error',
                description: hasCJK ? code : t('errors.' + code)
            })
            window.history.replaceState({}, '', location.pathname)
        }

        // Handle legacy ?error= param
        const errParam = queryParams.get('error')
        if (errParam) {
            const hasCJK = /[\u4e00-\u9fff]/.test(errParam)
            toast({
                variant: 'error',
                description: hasCJK ? errParam : `登录失败: ${errParam}`
            })
            window.history.replaceState({}, '', location.pathname)
        }
    }, [location])
}
