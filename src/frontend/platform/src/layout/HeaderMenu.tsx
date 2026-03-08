import { TabIcon } from "@/components/mep-icons";
import { userContext } from "@/contexts/userContext";
import { useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";

export default function HeaderMenu({ }) {
    const { t } = useTranslation()
    const location = useLocation();

    const { user } = useContext(userContext);
    // 系统管理员(超管、组超管)
    const isAdmin = useMemo(() => {
        return ['admin', 'group_admin'].includes(user.role)
    }, [user])

    if (['/build/apps', '/build/tools', '/build/client'].includes(location.pathname.replace(__APP_ENV__.BASE_URL, ''))) {
        return <div className="build-tab flex justify-end h-[56px] items-center relative pr-4">
            <div className="px-3">
                <NavLink to={'build/apps'} className="group flex gap-2 items-center px-6 py-1.5 rounded-full navlink border border-slate-200 dark:border-navy-600 transition-all">
                    <TabIcon className="text-gray-400 group-hover:text-navy-600 dark:group-hover:text-cyan-400"></TabIcon>
                    <span className="text-sm font-medium text-gray-500 group-hover:text-primary dark:text-gray-400 dark:group-hover:text-blue-400">{t('build.app')}</span>
                </NavLink>
            </div>
            <div className="px-3">
                <NavLink to={'build/tools'} className="group flex gap-2 items-center px-6 py-1.5 rounded-full navlink border border-slate-200 dark:border-navy-600 transition-all">
                    <TabIcon className="text-gray-400 group-hover:text-navy-600 dark:group-hover:text-cyan-400"></TabIcon>
                    <span className="text-sm font-medium text-gray-500 group-hover:text-primary dark:text-gray-400 dark:group-hover:text-blue-400">{t('build.tools')}</span>
                </NavLink>
            </div>
            {user.role === 'admin' && <div className="px-3">
                <NavLink to={'build/client'} className="group flex gap-2 items-center px-6 py-1.5 rounded-full navlink border border-slate-200 dark:border-navy-600 transition-all">
                    <TabIcon className="text-gray-400 group-hover:text-navy-600 dark:group-hover:text-cyan-400"></TabIcon>
                    <span className="text-sm font-medium text-gray-500 group-hover:text-primary dark:text-gray-400 dark:group-hover:text-blue-400">{t('build.workbench')}</span>
                </NavLink>
            </div>}
        </div>
    }

    if (['/model/management', '/model/finetune'].includes(location.pathname.replace(__APP_ENV__.BASE_URL, ''))) {
        return <div className="build-tab flex justify-end h-[56px] items-center relative pr-4">
            <div className="px-3">
                <NavLink to={'model/management'} className="group flex gap-2 items-center px-6 py-1.5 rounded-full navlink border border-slate-200 dark:border-navy-600 transition-all">
                    <TabIcon className="text-gray-400 group-hover:text-navy-600 dark:group-hover:text-cyan-400"></TabIcon>
                    <span className="text-sm font-medium text-gray-500 group-hover:text-primary dark:text-gray-400 dark:group-hover:text-blue-400">{t('model.modelManagement')}</span>
                </NavLink>
            </div>
            <div className="px-3">
                <NavLink to={'model/finetune'} className="group flex gap-2 items-center px-6 py-1.5 rounded-full navlink border border-slate-200 dark:border-navy-600 transition-all">
                    <TabIcon className="text-gray-400 group-hover:text-navy-600 dark:group-hover:text-cyan-400"></TabIcon>
                    <span className="text-sm font-medium text-gray-500 group-hover:text-primary dark:text-gray-400 dark:group-hover:text-blue-400">{t('model.modelFineTune')}</span>
                </NavLink>
            </div>
        </div>
    }

    return null;
};
