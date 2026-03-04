import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Table2 } from 'lucide-react';

const DATA_TABLE_STYLES = `
  .ws-data-view-table .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .ws-data-view-table .data-table th {
    background: #f8fafc;
    font-weight: 600;
    text-align: left;
    padding: 10px 12px;
    border-bottom: 2px solid #e2e8f0;
    white-space: nowrap;
    color: #475569;
  }
  .ws-data-view-table .data-table td {
    padding: 8px 12px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
  }
  .ws-data-view-table .data-table tbody tr:hover {
    background: #f8fafc;
  }
  .dark .ws-data-view-table .data-table th {
    background: #1e293b;
    border-bottom-color: #334155;
    color: #cbd5e1;
  }
  .dark .ws-data-view-table .data-table td {
    border-bottom-color: #1e293b;
    color: #e2e8f0;
  }
  .dark .ws-data-view-table .data-table tbody tr:hover {
    background: #1e293b;
  }
`;

export default function WsDataView() {
  const navigate = useNavigate();
  const [html, setHtml] = useState('');
  const [title, setTitle] = useState('数据详情');

  useEffect(() => {
    try {
      const storedHtml = sessionStorage.getItem('__ws_data_view_html') || '';
      const storedTitle = sessionStorage.getItem('__ws_data_view_title') || '数据详情';
      setHtml(storedHtml);
      setTitle(storedTitle);
    } catch {
      setHtml('');
    }
  }, []);

  const sanitizedHtml = useMemo(() => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const ALLOWED = new Set(['TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'DIV', 'SPAN', 'B', 'STRONG', 'EM', 'I', 'BR']);
    const walk = (node: Node) => {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as Element;
          if (!ALLOWED.has(el.tagName)) {
            el.remove();
          } else {
            const attrs = Array.from(el.attributes);
            for (const attr of attrs) {
              if (attr.name !== 'class') el.removeAttribute(attr.name);
            }
            walk(el);
          }
        }
      }
    };
    walk(doc.body);
    return doc.body.innerHTML;
  }, [html]);

  const handleExport = useCallback(() => {
    const rows: string[][] = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return;

    table.querySelectorAll('tr').forEach(tr => {
      const row: string[] = [];
      tr.querySelectorAll('th, td').forEach(cell => row.push(cell.textContent?.trim() || ''));
      rows.push(row);
    });

    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [html, title]);

  if (!html) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400">
        <Table2 className="w-12 h-12 mb-3 opacity-30" />
        <p>暂无数据</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-sm text-blue-600 hover:underline">返回</button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <style>{DATA_TABLE_STYLES}</style>

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Table2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{title}</h1>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 dark:border-gray-700 dark:text-gray-300 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          导出 CSV
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5">
        <div
          className="ws-data-view-table"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      </div>
    </div>
  );
}
