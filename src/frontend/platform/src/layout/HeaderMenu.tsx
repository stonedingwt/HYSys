import { TabIcon } from "@/components/mep-icons";
import { userContext } from "@/contexts/userContext";
import { useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";

export default function HeaderMenu({ }) {
    const { t } = useTranslation();
    const location = useLocation();
    const { user } = useContext(userContext);
    const isAdmin = useMemo(() => ['admin', 'group_admin'].includes(user.role), [user]);

    const tabClass = "group flex gap-2 items-center px-5 py-1.5 rounded-full navlink border border-slate-200 dark:border-white/[0.08] transition-all text-sm font-medium text-slate-500 hover:text-sky-600 hover:border-sky-200 dark:text-slate-400 dark:hover:text-sky-400 dark:hover:border-sky-400/20 dark:hover:bg-white/[0.04]";

    if (['/build/apps', '/build/tools', '/build/client'].includes(location.pathname.replace(__APP_ENV__.BASE_URL, ''))) {
        return (
            <div className="flex items-center gap-2 h-12">
                <NavLink to="build/apps" className={tabClass}>
                    <TabIcon className="text-slate-400 group-hover:text-sky-500 dark:group-hover:text-sky-400" />
                    <span>{t('build.app')}</span>
                </NavLink>
                <NavLink to="build/tools" className={tabClass}>
                    <TabIcon className="text-slate-400 group-hover:text-sky-500 dark:group-hover:text-sky-400" />
                    <span>{t('build.tools')}</span>
                </NavLink>
                {user.role === 'admin' && (
                    <NavLink to="build/client" className={tabClass}>
                        <TabIcon className="text-slate-400 group-hover:text-sky-500 dark:group-hover:text-sky-400" />
                        <span>{t('build.workbench')}</span>
                    </NavLink>
                )}
            </div>
        );
    }

    if (['/model/management', '/model/finetune'].includes(location.pathname.replace(__APP_ENV__.BASE_URL, ''))) {
        return (
            <div className="flex items-center gap-2 h-12">
                <NavLink to="model/management" className={tabClass}>
                    <TabIcon className="text-slate-400 group-hover:text-sky-500 dark:group-hover:text-sky-400" />
                    <span>{t('model.modelManagement')}</span>
                </NavLink>
                <NavLink to="model/finetune" className={tabClass}>
                    <TabIcon className="text-slate-400 group-hover:text-sky-500 dark:group-hover:text-sky-400" />
                    <span>{t('model.modelFineTune')}</span>
                </NavLink>
            </div>
        );
    }

    return null;
}
