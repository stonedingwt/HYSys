import { userContext } from "@/contexts/userContext";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "../../components/mep-ui/tabs";
import Config from "./components/Config";
import DatabaseManage from "./components/DatabaseManage";
import MenuManage from "./components/MenuManage";
import Roles from "./components/Roles";
import Theme from "./theme";
import Users from "./components/Users";

export default function index() {
    const { user } = useContext(userContext);
    const [searchParams] = useSearchParams();
    const initialTab = searchParams.get('tab') || 'user';

    const { t } = useTranslation()
    return <div className="h-full relative px-2 py-2 bg-[#f5f5f5] dark:bg-background-main">
        <div className="w-full h-full px-2 pt-4 bg-white dark:bg-background-main-content rounded-[10px] overflow-hidden flex flex-col">

        <Tabs defaultValue={initialTab} className="w-full flex-1 flex flex-col min-h-0">
            <TabsList className="shrink-0">
                <TabsTrigger value="user" className="roundedrounded-xl">{t('system.userManagement')}</TabsTrigger>
                <TabsTrigger value="role">{t('system.roleManagement')}</TabsTrigger>
                {user.role === 'admin' && <TabsTrigger value="menu">菜单管理</TabsTrigger>}
                {user.role === 'admin' && <TabsTrigger value="system">{t('system.systemConfiguration')}</TabsTrigger>}
                {user.role === 'admin' && <TabsTrigger value="database">数据库管理</TabsTrigger>}
                {user.role === 'admin' && <TabsTrigger value="theme">{t('system.themeColor')}</TabsTrigger>}
            </TabsList>
            <TabsContent value="user" className="flex-1 overflow-y-auto min-h-0">
                <Users></Users>
            </TabsContent>
            <TabsContent value="role" className="flex-1 overflow-y-auto min-h-0">
                <Roles></Roles>
            </TabsContent>
            <TabsContent value="menu" className="flex-1 overflow-y-auto min-h-0">
                <MenuManage />
            </TabsContent>
            <TabsContent value="system" className="flex-1 overflow-y-auto min-h-0">
                <Config></Config>
            </TabsContent>
            <TabsContent value="database" className="flex-1 overflow-y-auto min-h-0">
                <DatabaseManage />
            </TabsContent>
            <TabsContent value="theme" className="flex-1 overflow-y-auto min-h-0">
                <Theme></Theme>
            </TabsContent>
        </Tabs>
    </div></div>
};
