import React, { memo, useMemo } from 'react';
import { Table2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HtmlCardMeta {
  title?: string;
  type?: string;
  count?: number;
}

const TYPE_LABELS: Record<string, string> = {
  sales_order: '销售订单',
  customer: '客户信息',
  supplier: '供应商',
  production_line: '产线',
  generic: '数据',
};

const HtmlCardBlock = memo(({ children }: { children: React.ReactNode }) => {
  const raw = String(children).trim();
  const navigate = useNavigate();

  const { meta, html } = useMemo(() => {
    const firstNewline = raw.indexOf('\n');
    if (firstNewline === -1) return { meta: {} as HtmlCardMeta, html: raw };
    const metaLine = raw.slice(0, firstNewline).trim();
    const htmlBody = raw.slice(firstNewline + 1).trim();
    let parsed: HtmlCardMeta = {};
    try {
      parsed = JSON.parse(metaLine);
    } catch {
      // not valid JSON — treat the whole thing as HTML
    }
    return { meta: parsed, html: Object.keys(parsed).length > 0 ? htmlBody : raw };
  }, [raw]);

  const typeLabel = TYPE_LABELS[meta.type || ''] || TYPE_LABELS.generic;

  const handleOpen = () => {
    try {
      sessionStorage.setItem('__ws_data_view_html', html);
      sessionStorage.setItem('__ws_data_view_title', meta.title || '数据详情');
    } catch { /* quota exceeded — will show fallback */ }
    navigate('/ws-data-view');
  };

  return (
    <div className="my-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Table2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {meta.title || '查询结果'}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {typeLabel}{meta.count != null ? ` · ${meta.count} 条记录` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={handleOpen}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          查看详情
        </button>
      </div>
    </div>
  );
});

export default HtmlCardBlock;
