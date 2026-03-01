import { LogOut, User as UserIcon, Shield, Fingerprint, ChevronRight } from 'lucide-react';
import { useRecoilValue } from 'recoil';
import { useAuthContext } from '~/hooks/AuthContext';
import store from '~/store';

const ROLE_LABELS: Record<string, string> = {
  admin: '系统管理员',
  group_admin: '组管理员',
  user: '普通用户',
};

const PROVIDER_LABELS: Record<string, string> = {
  dingtalk: '钉钉',
  wecom: '企业微信',
  feishu: '飞书',
  local: '本地账号',
};

export default function WsProfile() {
  const { user, logout } = useAuthContext();
  const currentUser = useRecoilValue(store.user);

  const displayName = user?.name || user?.username || '未知用户';
  const initials = displayName.substring(0, 2).toUpperCase();
  const roleName = ROLE_LABELS[user?.role ?? ''] || user?.role || '用户';
  const provider = user?.provider || 'local';
  const providerLabel = PROVIDER_LABELS[provider] || provider;
  const userId = currentUser?.id || user?.id || '-';

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
      {/* Profile card */}
      <div className="bg-white dark:bg-gray-800 px-5 pt-8 pb-6">
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {initials}
          </div>
          <h2 className="mt-4 text-xl font-semibold dark:text-gray-100">{displayName}</h2>
          <span className="mt-1 px-3 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium">
            {roleName}
          </span>
        </div>
      </div>

      {/* Info list */}
      <div className="mt-3 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
        <InfoRow
          icon={<UserIcon className="w-5 h-5 text-blue-500" />}
          label="用户名"
          value={displayName}
        />
        <InfoRow
          icon={<Shield className="w-5 h-5 text-orange-500" />}
          label="角色"
          value={roleName}
        />
        <InfoRow
          icon={<Fingerprint className="w-5 h-5 text-green-500" />}
          label={providerLabel + ' ID'}
          value={String(userId)}
        />
      </div>

      {/* Logout */}
      <div className="mt-3 bg-white dark:bg-gray-800">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-4 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">退出登录</span>
        </button>
      </div>

      <div className="py-6 text-center text-xs text-gray-400">
        v1.0.0_beta
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center px-5 py-4">
      <div className="shrink-0">{icon}</div>
      <span className="ml-3 text-sm text-gray-500 dark:text-gray-400 w-20">{label}</span>
      <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 text-right truncate">{value}</span>
      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 ml-1 shrink-0" />
    </div>
  );
}
