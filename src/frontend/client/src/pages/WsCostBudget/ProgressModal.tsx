import { useEffect, useRef, useState } from 'react';
import { X, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { getTaskStatus } from './api';

interface Props {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
}

export default function ProgressModal({ open, taskId, onClose }: Props) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('准备中...');
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open || !taskId) return;
    setProgress(0);
    setMessage('准备中...');
    setDone(false);
    setFailed(false);

    const poll = async () => {
      try {
        const data = await getTaskStatus(taskId);
        setProgress(data.progress);
        setMessage(data.message);
        if (data.progress >= 100) {
          setDone(true);
          if (timerRef.current) clearInterval(timerRef.current);
        } else if (data.progress < 0) {
          setFailed(true);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } catch {
        /* retry next tick */
      }
    };

    poll();
    timerRef.current = setInterval(poll, 2000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [open, taskId]);

  if (!open) return null;

  const pct = Math.max(0, Math.min(100, progress));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-[#1B1B1B] rounded-xl shadow-2xl w-[520px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">金蝶自动化执行进度</h3>
          {(done || failed) && (
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-8 space-y-6">
          {/* Status icon */}
          <div className="flex justify-center">
            {failed ? (
              <XCircle className="w-16 h-16 text-red-500" />
            ) : done ? (
              <CheckCircle2 className="w-16 h-16 text-green-500" />
            ) : (
              <Loader2 className="w-16 h-16 text-primary animate-spin" />
            )}
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>执行进度</span>
              <span>{failed ? '失败' : `${pct}%`}</span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${failed ? 'bg-red-500' : done ? 'bg-green-500' : 'bg-primary'}`}
                style={{ width: `${failed ? 100 : pct}%` }}
              />
            </div>
          </div>

          {/* Message */}
          <p className={`text-sm text-center ${failed ? 'text-red-600' : done ? 'text-green-600' : 'text-gray-600 dark:text-gray-400'}`}>
            {message}
          </p>

          {/* Steps timeline */}
          <div className="text-xs text-gray-400 space-y-1.5 max-h-[160px] overflow-y-auto">
            {pct >= 10 && <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> 登录金蝶云星空</div>}
            {pct >= 20 && <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> 打开生产成本预算表</div>}
            {pct >= 40 && <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> 填写表头信息</div>}
            {pct >= 44 && <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> 获取车缝GST</div>}
            {pct >= 52 && <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> 面料成本</div>}
            {pct >= 58 && <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> 辅料成本</div>}
            {pct >= 64 && <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> 包装成本</div>}
            {pct >= 70 && <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> 二道工序成本</div>}
            {pct >= 78 && <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> 其他成本</div>}
            {pct >= 88 && <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> 合计</div>}
            {pct >= 93 && <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> 保存成功</div>}
            {pct >= 100 && <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> 提交成功，等待审批</div>}
          </div>
        </div>

        {/* Footer */}
        {(done || failed) && (
          <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={onClose}
              className="px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90">
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
