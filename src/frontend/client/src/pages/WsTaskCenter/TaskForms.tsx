import { useEffect, useState } from 'react';
import { FileText, Trash2, ExternalLink } from 'lucide-react';
import type { TaskFormItem } from './types';
import { fetchForms, deleteForm } from './api';

interface Props {
  taskId: number;
}

export default function TaskForms({ taskId }: Props) {
  const [forms, setForms] = useState<TaskFormItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setForms(await fetchForms(taskId)); } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [taskId]);

  const handleDelete = async (formId: number) => {
    if (!confirm('确认删除此关联表单？')) return;
    await deleteForm(formId);
    load();
  };

  if (loading) return <div className="p-4 text-center text-gray-400 text-sm">加载中...</div>;
  if (forms.length === 0) return <div className="p-8 text-center text-gray-400 text-sm">暂无关联表单</div>;

  return (
    <div className="p-4 space-y-2">
      {forms.map(form => (
        <div
          key={form.id}
          className="flex items-center gap-3 p-3 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${form.is_main ? 'bg-primary/10' : 'bg-gray-100 dark:bg-gray-700'}`}>
            <FileText className={`w-4 h-4 ${form.is_main ? 'text-primary' : 'text-gray-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate dark:text-gray-100">{form.form_name}</span>
              {form.is_main && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">主表单</span>
              )}
            </div>
            <span className="text-[11px] text-gray-400">{form.form_type}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button className="p-1.5 text-gray-400 hover:text-primary rounded" title="查看">
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDelete(form.id)}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded"
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
