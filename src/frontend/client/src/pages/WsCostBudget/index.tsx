import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, XCircle, Loader2, FileSpreadsheet, Star, Plus, ArrowLeft } from 'lucide-react';
import CostBudgetForm, { type CostBudgetFormData } from './CostBudgetForm';
import { saveBudget, markFinalQuote, getHistory } from './api';

const STATUS_BADGE: Record<string, { cls: string; icon: any; label: string }> = {
  draft:    { cls: 'bg-gray-100 text-gray-600',     icon: FileSpreadsheet, label: '草稿' },
  pending:  { cls: 'bg-yellow-100 text-yellow-700', icon: Clock,           label: '待同步' },
  running:  { cls: 'bg-blue-100 text-blue-700',     icon: Loader2,         label: '同步中' },
  success:  { cls: 'bg-green-100 text-green-700',   icon: CheckCircle2,    label: '已同步' },
  failed:   { cls: 'bg-red-100 text-red-700',       icon: XCircle,         label: '同步失败' },
};

export default function WsCostBudget() {
  const [view, setView] = useState<'history' | 'form'>('history');
  const [submitting, setSubmitting] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const loadHistory = useCallback(async () => {
    try {
      const r = await getHistory(page, pageSize);
      setHistory(r?.data || []);
      setTotal(r?.total || 0);
    } catch { setHistory([]); }
  }, [page]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleSave = async (data: CostBudgetFormData) => {
    setSubmitting(true);
    try {
      await saveBudget(data);
      setView('history');
      loadHistory();
    } catch (e: any) {
      alert('保存失败: ' + (e.message || '未知错误'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalQuote = async (recordId: number) => {
    if (!confirm('确认标记为最终报价？标记后将在定时任务中自动同步到金蝶。')) return;
    try {
      await markFinalQuote(recordId);
      loadHistory();
    } catch (e: any) {
      alert('操作失败: ' + (e.message || '未知错误'));
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  if (view === 'form') {
    return (
      <div className="h-full overflow-hidden bg-[#f4f5f8] dark:bg-[#111] flex flex-col">
        <div className="flex items-center gap-3 px-6 py-4 shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1B1B1B]">
          <button
            onClick={() => setView('history')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> 返回
          </button>
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">新建报价</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <CostBudgetForm onSubmit={handleSave} submitting={submitting} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden bg-[#f4f5f8] dark:bg-[#111] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1B1B1B]">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">报价助手</h2>
        </div>
        <button
          onClick={() => setView('form')}
          className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> 新建报价
        </button>
      </div>

      {/* History table */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white dark:bg-[#1B1B1B] rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#222] border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">厂款号</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">订单类型</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">客户</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">报价日期</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">最终报价</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">同步状态</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">创建时间</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">操作</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">暂无记录</td></tr>
                ) : history.map(item => {
                  const badge = STATUS_BADGE[item.status] || STATUS_BADGE.draft;
                  const Icon = badge.icon;
                  const isFinal = !!item.is_final_quote;
                  const canMarkFinal = !isFinal && item.status === 'draft';
                  return (
                    <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors">
                      <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{item.factory_article_no}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.order_type}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.customer || '-'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.quote_date}</td>
                      <td className="px-4 py-3">
                        {isFinal ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                            <Star className="w-3 h-3 fill-current" /> 最终报价
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${badge.cls}`}>
                          <Icon className="w-3 h-3" /> {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{item.create_time?.slice(0, 19).replace('T', ' ')}</td>
                      <td className="px-4 py-3">
                        {canMarkFinal && (
                          <button
                            onClick={() => handleFinalQuote(item.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                          >
                            <Star className="w-3 h-3" /> 标记最终报价
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-400">共 {total} 条</span>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </button>
                <span className="text-sm text-gray-500 min-w-[60px] text-center">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
