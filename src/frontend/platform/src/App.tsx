/**
 * MEP Application Entry Component
 * 元境应用入口组件
 */
import cloneDeep from "lodash-es/cloneDeep";
import uniqueId from "lodash-es/uniqueId";
import { Suspense, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { RouterProvider } from "react-router-dom";
import "./App.css";
import "./style/vditor.css"

import i18next from "i18next";
import { useTranslation } from "react-i18next";
import ErrorAlert from "./alerts/error";
import NoticeAlert from "./alerts/notice";
import SuccessAlert from "./alerts/success";
import { Toaster } from "./components/mep-ui/toast";
import { alertContext } from "./contexts/alertContext";
import { locationContext } from "./contexts/locationContext";
import { userContext } from "./contexts/userContext";
import { getAdminRouter, getPrivateRouter, publicRouter } from "./routes";
import { LoadingIcon } from "./components/mep-icons/loading";
import { useToast } from "./components/mep-ui/toast/use-toast";

type AlertType = 'error' | 'notice' | 'success';

interface AlertItem {
    readonly type: AlertType;
    readonly data: { title: string; list?: Array<string>; link?: string };
    readonly id: string;
}

interface AlertManagerConfig {
    errorData: { title: string; list?: Array<string>; link?: string } | null;
    errorOpen: boolean;
    noticeData: { title: string; list?: Array<string>; link?: string } | null;
    noticeOpen: boolean;
    successData: { title: string; list?: Array<string>; link?: string } | null;
    successOpen: boolean;
}

class AlertManager {
    private alerts: AlertItem[] = [];
    
    canAddAlert(newData: { title: string; list?: Array<string>; link?: string } | null): boolean {
        if (!newData) return false;
        if (this.alerts.length === 0) return true;
        const lastAlert = this.alerts[this.alerts.length - 1];
        return JSON.stringify(lastAlert.data) !== JSON.stringify(newData);
    }
    
    addAlert(type: AlertType, data: { title: string; list?: Array<string>; link?: string }): AlertItem[] {
        const newAlert: AlertItem = {
            type,
            data: cloneDeep(data),
            id: uniqueId()
        };
        this.alerts = [...this.alerts, newAlert];
        return this.alerts;
    }
    
    removeAlert(id: string): AlertItem[] {
        this.alerts = this.alerts.filter(alert => alert.id !== id);
        return this.alerts;
    }
    
    getAlerts(): AlertItem[] {
        return this.alerts;
    }
}

const alertManager = new AlertManager();

function LoadingOverlay() {
    return (
        <div className='absolute w-full h-full top-0 left-0 flex justify-center items-center z-10 bg-[rgba(255,255,255,0.6)] dark:bg-blur-shared'>
            <LoadingIcon className="w-48 text-primary" />
        </div>
    );
}

function AlertRenderer({ alert, onRemove }: { alert: AlertItem; onRemove: (id: string) => void }) {
    const alertComponents = {
        error: () => (
            <ErrorAlert
                title={alert.data.title}
                list={alert.data.list}
                id={alert.id}
                removeAlert={onRemove}
            />
        ),
        notice: () => (
            <NoticeAlert
                title={alert.data.title}
                link={alert.data.link}
                id={alert.id}
                removeAlert={onRemove}
            />
        ),
        success: () => (
            <SuccessAlert
                title={alert.data.title}
                id={alert.id}
                removeAlert={onRemove}
            />
        )
    };
    
    return <div key={alert.id}>{alertComponents[alert.type]()}</div>;
}

function useAlertSystem() {
    const {
        errorData,
        errorOpen,
        setErrorOpen,
        noticeData,
        noticeOpen,
        setNoticeOpen,
        successData,
        successOpen,
        setSuccessOpen,
    } = useContext(alertContext);
    
    const [alertsList, setAlertsList] = useState<AlertItem[]>([]);
    
    useEffect(() => {
        const config: AlertManagerConfig = {
            errorData,
            errorOpen,
            noticeData,
            noticeOpen,
            successData,
            successOpen
        };
        
        if (config.errorOpen && config.errorData && alertManager.canAddAlert(config.errorData)) {
            setErrorOpen(false);
            setAlertsList(alertManager.addAlert('error', config.errorData));
        } else if (config.noticeOpen && config.noticeData && alertManager.canAddAlert(config.noticeData)) {
            setNoticeOpen(false);
            setAlertsList(alertManager.addAlert('notice', config.noticeData));
        } else if (config.successOpen && config.successData && alertManager.canAddAlert(config.successData)) {
            setSuccessOpen(false);
            setAlertsList(alertManager.addAlert('success', config.successData));
        }
    }, [errorData, errorOpen, noticeData, noticeOpen, successData, successOpen, setErrorOpen, setNoticeOpen, setSuccessOpen]);
    
    useEffect(() => {
        window.errorAlerts = (errorList: string[]) => {
            setAlertsList(alertManager.addAlert('error', { title: '', list: errorList }));
        };
    }, []);
    
    const removeAlert = useCallback((id: string) => {
        setAlertsList(alertManager.removeAlert(id));
    }, []);
    
    return { alertsList, removeAlert };
}

function useUserAuthentication() {
    const { user, setUser } = useContext(userContext);
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey && event.keyCode === 81) {
                setUser(null);
                localStorage.setItem('UUR_INFO', '');
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [setUser]);
    
    return user;
}

function useLanguageInitialization(user: any) {
    useEffect(() => {
        const storedLang = user?.user_id ? localStorage.getItem('i18nextLng') : null;
        if (storedLang) {
            i18next.changeLanguage(storedLang === 'zh' ? 'zh-Hans' : storedLang);
        }
    }, [user]);
}

function useRouting(user: any) {
    const noAuthPages = ['chat', 'resouce'];
    const currentPath = location.pathname.replace(__APP_ENV__.BASE_URL, '').split('/')?.[1] || '';
    
    const router = useMemo(() => {
        if (user && ['admin', 'group_admin'].includes(user.role)) {
            return getAdminRouter();
        }
        return user?.user_id ? getPrivateRouter(user.web_menu) : null;
    }, [user]);
    
    const isAuthenticated = Boolean(user?.user_id || noAuthPages.includes(currentPath));
    
    return { router, isAuthenticated, currentPath };
}

function useUrlErrorHandler() {
    const { toast } = useToast();
    const { t } = useTranslation();
    
    useEffect(() => {
        if (window.url_error) {
            toast({ description: t(`errors.${window.url_error}`), variant: 'error' });
            delete window.url_error;
        }
    }, [toast, t]);
}

function AppContent() {
    const { setCurrent, setShowSideBar, setIsStackedOpen } = useContext(locationContext);
    const { alertsList, removeAlert } = useAlertSystem();
    const user = useUserAuthentication();
    const { router, isAuthenticated } = useRouting(user);
    
    useLanguageInitialization(user);
    useUrlErrorHandler();
    
    useEffect(() => {
        setCurrent(location.pathname.replace(/\/$/g, "").split("/"));
        setShowSideBar(true);
        setIsStackedOpen(true);
    }, [setCurrent, setIsStackedOpen, setShowSideBar]);
    
    const renderMainContent = () => {
        if (isAuthenticated && router) {
            return (
                <Suspense fallback={<LoadingOverlay />}>
                    <RouterProvider router={router} />
                </Suspense>
            );
        }
        
        if (user) {
            return <LoadingOverlay />;
        }
        
        return (
            <Suspense fallback={<LoadingOverlay />}>
                <RouterProvider router={publicRouter} />
            </Suspense>
        );
    };
    
    return (
        <div className="flex h-full flex-col">
            {renderMainContent()}
            <div></div>
            <div className="app-div" style={{ zIndex: 1000 }}>
                {alertsList.map(alert => (
                    <AlertRenderer key={alert.id} alert={alert} onRemove={removeAlert} />
                ))}
            </div>
            <Toaster />
        </div>
    );
}

export default AppContent;
