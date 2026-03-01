/**
 * Tabbed editor for the three business forms: follow_up, bom, sample.
 * Shown in task detail when the task has biz form associations.
 */
import { useEffect, useState } from 'react';
import { Save, AlertCircle, CheckCircle2, ClipboardCheck } from 'lucide-react';
import StyleImageGallery from './StyleImageGallery';
import {
  fetchFollowUpByTask,
  fetchBomByFollowUp,
  fetchSampleByFollowUp,
  updateFollowUp,
  updateBom,
  updateSample,
  checkCompleteness,
  createSampleTask,
} from './bizApi';

interface Props {
  taskId: number;
}

type Tab = 'follow_up' | 'bom' | 'sample';

function FieldRow({ label, value, onChange, readonly }: {
  label: string; value: string; onChange?: (v: string) => void; readonly?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <label className="w-24 text-sm text-gray-500 dark:text-gray-400 text-right shrink-0">{label}</label>
      {readonly ? (
        <span className="text-sm dark:text-gray-100">{value || '-'}</span>
      ) : (
        <input
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          className="flex-1 text-sm px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
        />
      )}
    </div>
  );
}

function PendingBadge({ fields }: { fields: string[] }) {
  if (!fields?.length) return null;
  return (
    <div className="flex items-center gap-1 text-amber-500 text-xs">
      <AlertCircle className="w-3.5 h-3.5" />
      <span>待补全: {fields.join(', ')}</span>
    </div>
  );
}

export default function BizFormEditor({ taskId }: Props) {
  const [tab, setTab] = useState<Tab>('follow_up');
  const [followUp, setFollowUp] = useState<any>(null);
  const [bom, setBom] = useState<any>(null);
  const [bomDetails, setBomDetails] = useState<any[]>([]);
  const [sample, setSample] = useState<any>(null);
  const [sampleRatios, setSampleRatios] = useState<any[]>([]);
  const [sampleMaterials, setSampleMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadAll();
  }, [taskId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const fu = await fetchFollowUpByTask(taskId);
      if (!fu) { setLoading(false); return; }
      setFollowUp(fu);

      if (fu.id) {
        const [bomRes, sampleRes] = await Promise.all([
          fetchBomByFollowUp(fu.id).catch(() => null),
          fetchSampleByFollowUp(fu.id).catch(() => null),
        ]);
        if (bomRes) {
          setBom(bomRes.header);
          setBomDetails(bomRes.details || []);
        }
        if (sampleRes) {
          setSample(sampleRes.header);
          setSampleRatios(sampleRes.ratios || []);
          setSampleMaterials(sampleRes.materials || []);
        }
      }
    } catch (e) {
      console.error('Failed to load biz forms', e);
    }
    setLoading(false);
  };

  const saveFollowUp = async () => {
    if (!followUp?.id) return;
    setSaving(true);
    try {
      const updated = await updateFollowUp(followUp.id, followUp);
      setFollowUp(updated);
      setMsg('跟单表已保存');
      setTimeout(() => setMsg(''), 2000);
    } catch (e: any) { setMsg('保存失败: ' + e.message); }
    setSaving(false);
  };

  const saveBom = async () => {
    if (!bom?.id) return;
    setSaving(true);
    try {
      const res = await updateBom(bom.id, bom, bomDetails);
      setBom(res.header);
      setBomDetails(res.details || []);
      setMsg('BOM表已保存');
      setTimeout(() => setMsg(''), 2000);
    } catch (e: any) { setMsg('保存失败: ' + e.message); }
    setSaving(false);
  };

  const saveSample = async () => {
    if (!sample?.id) return;
    setSaving(true);
    try {
      const res = await updateSample(sample.id, sample, sampleRatios, sampleMaterials);
      setSample(res.header);
      setSampleRatios(res.ratios || []);
      setSampleMaterials(res.materials || []);
      setMsg('打样单已保存');
      setTimeout(() => setMsg(''), 2000);
    } catch (e: any) { setMsg('保存失败: ' + e.message); }
    setSaving(false);
  };

  const handleCreateSampleTask = async () => {
    if (!followUp?.id) return;
    try {
      const check = await checkCompleteness(followUp.id);
      if (!check.all_complete) {
        setMsg('数据不完整，请先补全所有必填字段');
        return;
      }
      if (!confirm('确认创建打样任务？')) return;
      const res = await createSampleTask(followUp.id);
      setMsg(`打样任务已创建: ${res.task_number}`);
    } catch (e: any) { setMsg('创建失败: ' + e.message); }
  };

  const updateField = (setter: Function, obj: any, key: string, value: any) => {
    setter({ ...obj, [key]: value });
  };

  if (loading) return <div className="p-4 text-center text-gray-400 text-sm">加载业务表单...</div>;
  if (!followUp) return <div className="p-8 text-center text-gray-400 text-sm">暂无关联业务数据</div>;

  const tabs: { key: Tab; label: string; status: string }[] = [
    { key: 'follow_up', label: '跟单表', status: followUp?.completeness },
    { key: 'bom', label: 'BOM表', status: bom?.completeness },
    { key: 'sample', label: '打样单', status: sample?.completeness },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-3 border-b dark:border-gray-700">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1.5 ${
              tab === t.key
                ? 'bg-white dark:bg-gray-800 border border-b-0 dark:border-gray-700 text-blue-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {t.label}
            {t.status === 'complete' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
            {t.status === 'incomplete' && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={handleCreateSampleTask}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 mb-1"
        >
          <ClipboardCheck className="w-4 h-4" />
          创建打样任务
        </button>
      </div>

      {/* Status message */}
      {msg && (
        <div className="px-4 py-2 text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400">
          {msg}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {tab === 'follow_up' && followUp && (
          <div className="space-y-4">
            <PendingBadge fields={followUp.pending_fields} />
            <StyleImageGallery
              images={followUp.style_images || []}
              primaryIndex={followUp.primary_image_idx || 0}
              onChange={(imgs, idx) => setFollowUp({ ...followUp, style_images: imgs, primary_image_idx: idx })}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              {[
                ['厂款号', 'factory_article_no'],
                ['客户款号', 'customer_article_no'],
                ['客户', 'customer_name'],
                ['品牌', 'brand'],
                ['季节', 'season'],
                ['PO号', 'po_number'],
                ['颜色', 'color'],
                ['尺码', 'size'],
                ['产品族', 'product_family'],
                ['产品大类', 'product_category'],
                ['加工工艺', 'process_type'],
                ['物料分组', 'material_group'],
              ].map(([label, key]) => (
                <FieldRow
                  key={key}
                  label={label}
                  value={followUp[key] || ''}
                  onChange={(v) => updateField(setFollowUp, followUp, key, v)}
                />
              ))}
            </div>
            <FieldRow
              label="产品描述"
              value={followUp.product_desc || ''}
              onChange={(v) => updateField(setFollowUp, followUp, 'product_desc', v)}
            />
            <button
              onClick={saveFollowUp}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存跟单表'}
            </button>
          </div>
        )}

        {tab === 'bom' && bom && (
          <div className="space-y-4">
            <PendingBadge fields={bom.pending_fields} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              {[
                ['厂款号', 'factory_article_no'],
                ['客款号', 'customer_article_no'],
                ['颜色组', 'color_group'],
                ['尺码组', 'size_group'],
                ['阶段', 'stage'],
                ['版本号', 'version'],
                ['版师', 'pattern_maker'],
                ['合同号', 'contract_no'],
                ['物料分组', 'material_group'],
              ].map(([label, key]) => (
                <FieldRow
                  key={key}
                  label={label}
                  value={bom[key] || ''}
                  onChange={(v) => updateField(setBom, bom, key, v)}
                />
              ))}
            </div>
            {bomDetails.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 dark:text-gray-200">物料明细 ({bomDetails.length})</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800">
                        {['部位', '物料名称', '物料编码', '颜色', '门幅', '克重', '用量', '方向'].map(h => (
                          <th key={h} className="px-2 py-1.5 text-left border dark:border-gray-700">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bomDetails.map((d, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          {['position', 'material_name', 'material_code', 'color', 'width', 'weight', 'check_usage', 'direction'].map(k => (
                            <td key={k} className="px-2 py-1 border dark:border-gray-700">
                              <input
                                value={d[k] || ''}
                                onChange={(e) => {
                                  const newDetails = [...bomDetails];
                                  newDetails[i] = { ...newDetails[i], [k]: e.target.value };
                                  setBomDetails(newDetails);
                                }}
                                className="w-full bg-transparent outline-none text-xs dark:text-gray-100"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <button
              onClick={saveBom}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存BOM表'}
            </button>
          </div>
        )}

        {tab === 'sample' && sample && (
          <div className="space-y-4">
            <PendingBadge fields={sample.pending_fields} />
            <StyleImageGallery
              images={sample.style_images || []}
              primaryIndex={sample.primary_image_idx || 0}
              onChange={(imgs, idx) => setSample({ ...sample, style_images: imgs, primary_image_idx: idx })}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              {[
                ['单据编号', 'order_code'],
                ['客户', 'customer_name'],
                ['厂款号', 'factory_article_no'],
                ['客款号', 'customer_article_no'],
                ['打样类型', 'sample_type'],
                ['开发类型', 'dev_type'],
                ['季节', 'season'],
                ['加工工艺', 'process_type'],
                ['样衣数量', 'sample_qty'],
                ['颜色', 'color'],
                ['尺码', 'size'],
                ['版师', 'pattern_maker'],
                ['BOM版本', 'bom_version'],
              ].map(([label, key]) => (
                <FieldRow
                  key={key}
                  label={label}
                  value={sample[key]?.toString() || ''}
                  onChange={(v) => updateField(setSample, sample, key, v)}
                />
              ))}
            </div>
            {sampleRatios.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 dark:text-gray-200">打样配比 ({sampleRatios.length})</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800">
                        {['颜色', '尺码', '数量', '单位', '备注'].map(h => (
                          <th key={h} className="px-2 py-1.5 text-left border dark:border-gray-700">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sampleRatios.map((r, i) => (
                        <tr key={i}>
                          {['color', 'size', 'quantity', 'unit', 'remark'].map(k => (
                            <td key={k} className="px-2 py-1 border dark:border-gray-700">
                              <input
                                value={r[k]?.toString() || ''}
                                onChange={(e) => {
                                  const nr = [...sampleRatios];
                                  nr[i] = { ...nr[i], [k]: e.target.value };
                                  setSampleRatios(nr);
                                }}
                                className="w-full bg-transparent outline-none text-xs dark:text-gray-100"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <button
              onClick={saveSample}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存打样单'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
