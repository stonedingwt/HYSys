import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import {
  ApiErrorWatcher,
  Login,
  Registration,
  RequestPasswordReset,
  ResetPassword,
  TwoFactorScreen,
  VerifyEmail,
} from '~/components/Auth';
import Sop from '~/components/Sop';
import WebView from '~/components/WebView';
import { AuthContextProvider } from '~/hooks/AuthContext';
import AppChat from '~/pages/appChat';
import AgentCenter from '~/pages/apps';
import { lazy, Suspense } from 'react';
import Share from '~/pages/share';
import ChatRoute from './ChatRoute';
const WsUserManage = lazy(() => import('~/pages/WsUserManage'));
const WsRoleManage = lazy(() => import('~/pages/WsRoleManage'));
const WsMasterData = lazy(() => import('~/pages/WsMasterData'));
const WsSalesOrder = lazy(() => import('~/pages/WsSalesOrder'));
const WsTaskCenter = lazy(() => import('~/pages/WsTaskCenter'));
const WsMessageCenter = lazy(() => import('~/pages/WsMessageCenter'));
const WsOrderAssistant = lazy(() => import('~/pages/WsOrderAssistant'));
const WsPackingSpec = lazy(() => import('~/pages/WsPackingSpec'));
const WsProfile = lazy(() => import('~/pages/WsProfile'));
const WsCostBudget = lazy(() => import('~/pages/WsCostBudget'));
const WsDataView = lazy(() => import('~/pages/WsDataView'));
const WsAssistant = lazy(() => import('~/pages/WsAssistant'));
import LoginLayout from './Layouts/Login';
import StartupLayout from './Layouts/Startup';
import Root from './Root';
import RouteErrorBoundary from './RouteErrorBoundary';
// import ShareRoute from './ShareRoute';
import Page404 from '~/pages/Page404';

const AuthLayout = () => (
  <AuthContextProvider>
    <Outlet />
    <ApiErrorWatcher />
  </AuthContextProvider>
);

const baseConfig = {
  //@ts-ignore
  basename: __APP_ENV__.BASE_URL
}

export const router = createBrowserRouter([
  // {
  //   path: 'share/:shareId',
  //   element: <ShareRoute />,
  //   errorElement: <RouteErrorBoundary />,
  // },
  {
    path: '/',
    element: <StartupLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: 'register',
        element: <Registration />,
      },
      {
        path: 'forgot-password',
        element: <RequestPasswordReset />,
      },
      {
        path: 'reset-password',
        element: <ResetPassword />,
      },
    ],
  },
  {
    path: 'verify',
    element: <VerifyEmail />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    element: <AuthLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: __APP_ENV__.MEP_HOST,
        element: <LoginLayout />,
        children: [
          {
            path: 'login',
            element: <Login />,
          },
          {
            path: 'login/2fa',
            element: <TwoFactorScreen />,
          },
        ],
      },
      // 提示词管理
      // dashboardRoutes,
      {
        path: '/',
        element: <Root />, // 包含会话列表
        children: [
          {
            index: true,
            element: <Navigate to="/ws-task-center" replace={true} />,
          },
          {
            path: 'c/:conversationId?',
            element: <ChatRoute />,
          },
          {
            path: 'linsight/:conversationId?',
            element: <Sop />,
          },
          {
            path: 'linsight/case/:sopId',
            element: <Sop />,
          },
          {
            path: 'apps',
            element: <AgentCenter />,
          },
          {
            path: 'chat/:conversationId/:fid/:type',
            element: <AppChat />,
          },
          {
            path: 'ws-users',
            element: <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">加载中...</div>}><WsUserManage /></Suspense>,
          },
          {
            path: 'ws-roles',
            element: <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">加载中...</div>}><WsRoleManage /></Suspense>,
          },
          {
            path: 'ws-master-data',
            element: <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">加载中...</div>}><WsMasterData /></Suspense>,
          },
          {
            path: 'ws-sales-order',
            element: <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">加载中...</div>}><WsSalesOrder /></Suspense>,
          },
          {
            path: 'ws-order-assistant',
            element: <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">加载中...</div>}><WsOrderAssistant /></Suspense>,
          },
          {
            path: 'ws-packing-spec',
            element: <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">加载中...</div>}><WsPackingSpec /></Suspense>,
          },
          {
            path: 'ws-task-center',
            element: <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">加载中...</div>}><WsTaskCenter /></Suspense>,
          },
          {
            path: 'ws-message-center',
            element: <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">加载中...</div>}><WsMessageCenter /></Suspense>,
          },
          {
            path: 'ws-profile',
            element: <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">加载中...</div>}><WsProfile /></Suspense>,
          },
          {
            path: 'ws-cost-budget',
            element: <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">加载中...</div>}><WsCostBudget /></Suspense>,
          },
          {
            path: 'ws-data-view',
            element: <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">加载中...</div>}><WsDataView /></Suspense>,
          },
          {
            path: 'ws-assistant',
            element: <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">加载中...</div>}><WsAssistant /></Suspense>,
          },
          {
            path: 'share/:token',
            element: <Share />,
          },
          {
            path: 'share/:token/:vid',
            element: <Share />,
          },
        ],
      },
    ],
  },
  {
    path: '/html',
    element: <WebView />,
  },
  {
    path: '/404',
    element: <Page404 />,
    errorElement: <RouteErrorBoundary />,
  },
  { path: "*", element: <Navigate to="/404" replace /> }
], baseConfig);
