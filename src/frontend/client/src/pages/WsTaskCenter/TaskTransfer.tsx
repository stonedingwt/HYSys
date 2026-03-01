import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus } from 'lucide-react';
import type { TransferableUser } from './types';
import { fetchTransferableUsers, transferTask } from './api';

interface Props {
  taskId: number;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TaskTransfer({ taskId, open, onClose, onSuccess }: Props) {
  const [users, setUsers] = useState<TransferableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected(null);
    fetchTransferableUsers(taskId)
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [open, taskId]);

  const handleTransfer = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await transferTask(taskId, selected);
      onSuccess();
      onClose();
    } catch (e: any) {
      alert(e.message || '转交失败');
    }
    setSubmitting(false);
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl p-5 w-[90vw] max-w-[400px] shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold dark:text-gray-100">转交任务</h3>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        <p className="text-xs text-gray-400 mb-3">选择同角色的用户进行转交：</p>

        {loading ? (
          <div className="text-center text-gray-400 py-6 text-sm">加载中...</div>
        ) : users.length === 0 ? (
          <div className="text-center text-gray-400 py-6 text-sm">暂无可转交的用户</div>
        ) : (
          <div className="max-h-[240px] overflow-y-auto space-y-1">
            {users.map(u => (
              <div
                key={u.user_id}
                onClick={() => setSelected(u.user_id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${selected === u.user_id
                  ? 'bg-primary/10 ring-1 ring-primary/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                  {u.user_name.slice(0, 1).toUpperCase()}
                </div>
                <span className="text-sm dark:text-gray-200">{u.user_name}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 text-xs border rounded-lg dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            取消
          </button>
          <button
            onClick={handleTransfer}
            disabled={!selected || submitting}
            className="px-4 py-1.5 text-xs bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? '转交中...' : '确认转交'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
