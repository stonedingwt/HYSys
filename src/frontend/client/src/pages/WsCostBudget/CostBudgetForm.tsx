import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { getConfig } from './api';

interface CostLine { name?: string; unit_price?: string }
interface OtherCostLine { cost_type: string; unit_price: string }

export interface CostBudgetFormData {
  factory_article_no: string;
  order_type: string;
  currency: string;
  pricing_date: string;
  bom_version: string;
  quote_date: string;
  quote_quantity: number | '';
  quote_size: string;
  customer: string;
  season: string;
  quote_type: string;
  production_location: string;
  brand: string;
  product_family: string;
  material_costs: CostLine[];
  accessory_costs: CostLine[];
  packaging_costs: CostLine[];
  secondary_costs: CostLine[];
  other_costs: OtherCostLine[];
  sewing_gst: string;
  hour_conversion: string;
  cutting_price: string;
  capital_rate: string;
  profit_rate: string;
  final_price_rmb: string;
}

const EMPTY_FORM: CostBudgetFormData = {
  factory_article_no: '', order_type: 'FOB', currency: '', pricing_date: '',
  bom_version: '', quote_date: '', quote_quantity: '', quote_size: '',
  customer: '', season: '春季', quote_type: '无打样报价',
  production_location: '赛乐', brand: '', product_family: '',
  material_costs: [], accessory_costs: [], packaging_costs: [],
  secondary_costs: [],
  other_costs: [
    { cost_type: '水电费', unit_price: '' },
    { cost_type: '管理运营费', unit_price: '' },
    { cost_type: '运费', unit_price: '' },
    { cost_type: '测试费', unit_price: '' },
    { cost_type: '样品费', unit_price: '' },
  ],
  sewing_gst: '', hour_conversion: '', cutting_price: '',
  capital_rate: '', profit_rate: '', final_price_rmb: '',
};

const inputCls = 'w-full px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary';
const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
const selectCls = inputCls;

interface Props {
  onSubmit: (data: CostBudgetFormData) => void;
  submitting: boolean;
}

export default function CostBudgetForm({ onSubmit, submitting }: Props) {
  const [form, setForm] = useState<CostBudgetFormData>({ ...EMPTY_FORM });
  const [cfg, setCfg] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('material');

  useEffect(() => { getConfig().then(setCfg).catch(() => {}); }, []);

  const set = (k: keyof CostBudgetFormData, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const updateCostLine = (type: 'material_costs' | 'accessory_costs' | 'packaging_costs' | 'secondary_costs', idx: number, field: string, val: string) => {
    setForm(prev => {
      const arr = [...(prev[type] as CostLine[])];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...prev, [type]: arr };
    });
  };

  const addCostLine = (type: 'material_costs' | 'accessory_costs' | 'packaging_costs' | 'secondary_costs') => {
    setForm(prev => ({ ...prev, [type]: [...(prev[type] as CostLine[]), { name: '', unit_price: '' }] }));
  };

  const removeCostLine = (type: 'material_costs' | 'accessory_costs' | 'packaging_costs' | 'secondary_costs', idx: number) => {
    setForm(prev => ({ ...prev, [type]: (prev[type] as CostLine[]).filter((_, i) => i !== idx) }));
  };

  const updateOtherCost = (idx: number, val: string) => {
    setForm(prev => {
      const arr = [...prev.other_costs];
      arr[idx] = { ...arr[idx], unit_price: val };
      return { ...prev, other_costs: arr };
    });
  };

  const costTabs = [
    { key: 'material', label: '面料成本', field: 'material_costs' as const },
    { key: 'accessory', label: '辅料成本', field: 'accessory_costs' as const },
    { key: 'packaging', label: '包装成本', field: 'packaging_costs' as const },
    { key: 'secondary', label: '二道工序成本', field: 'secondary_costs' as const },
    { key: 'other', label: '其他成本', field: null },
    { key: 'summary', label: '合计', field: null },
  ];

  const handleSubmit = () => {
    const missing: string[] = [];
    if (!form.factory_article_no) missing.push('厂款号');
    if (!form.pricing_date) missing.push('核价日期');
    if (!form.quote_date) missing.push('报价日期');
    if (missing.length > 0) {
      alert(`请填写必填项：${missing.join('、')}`);
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Basic Info */}
      <div className="bg-white dark:bg-[#1B1B1B] rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">基本信息</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>厂款号 <span className="text-red-500">*</span></label>
            <input className={inputCls} value={form.factory_article_no} onChange={e => set('factory_article_no', e.target.value)} placeholder="输入厂款号" />
          </div>
          <div>
            <label className={labelCls}>订单类型 <span className="text-red-500">*</span></label>
            <select className={selectCls} value={form.order_type} onChange={e => set('order_type', e.target.value)}>
              {(cfg?.order_types || ['FOB', '内销（OEM）', '内销', '内销3%']).map((o: string) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>币种</label>
            <input className={inputCls} value={form.currency} onChange={e => set('currency', e.target.value)} placeholder="自动加载，可修改" />
          </div>
          <div>
            <label className={labelCls}>核价日期 <span className="text-red-500">*</span></label>
            <input type="date" className={inputCls} value={form.pricing_date} onChange={e => set('pricing_date', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>BOM版本</label>
            <input className={inputCls} value={form.bom_version} onChange={e => set('bom_version', e.target.value)} placeholder="BOM版本" />
          </div>
          <div>
            <label className={labelCls}>报价日期 <span className="text-red-500">*</span></label>
            <input type="date" className={inputCls} value={form.quote_date} onChange={e => set('quote_date', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>报价数量</label>
            <input type="number" className={inputCls} value={form.quote_quantity} onChange={e => set('quote_quantity', e.target.value ? Number(e.target.value) : '')} placeholder="数量" />
          </div>
          <div>
            <label className={labelCls}>报价尺码</label>
            <input className={inputCls} value={form.quote_size} onChange={e => set('quote_size', e.target.value)} placeholder="尺码" />
          </div>
        </div>
      </div>

      {/* Section 2: Related Info */}
      <div className="bg-white dark:bg-[#1B1B1B] rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">关联信息</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>客户</label>
            <input className={inputCls} value={form.customer} onChange={e => set('customer', e.target.value)} placeholder="客户名称" />
          </div>
          <div>
            <label className={labelCls}>季节</label>
            <select className={selectCls} value={form.season} onChange={e => set('season', e.target.value)}>
              {(cfg?.seasons || ['春季', '夏季', '秋季', '冬季']).map((s: string) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>报价类型</label>
            <select className={selectCls} value={form.quote_type} onChange={e => set('quote_type', e.target.value)}>
              {(cfg?.quote_types || ['无打样报价', '打样报价']).map((t: string) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>预计生产地</label>
            <select className={selectCls} value={form.production_location} onChange={e => set('production_location', e.target.value)}>
              {(cfg?.production_locations || ['赛乐', '外协', '越南']).map((l: string) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>品牌</label>
            <input className={inputCls} value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="品牌" />
          </div>
          <div>
            <label className={labelCls}>产品族</label>
            <input className={inputCls} value={form.product_family} onChange={e => set('product_family', e.target.value)} placeholder="产品族" />
          </div>
        </div>
      </div>

      {/* Section 3: Cost Detail Tabs */}
      <div className="bg-white dark:bg-[#1B1B1B] rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700 px-5 pt-4">
          <div className="flex gap-1">
            {costTabs.map(tab => (
              <button key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm rounded-t-md transition-colors ${activeTab === tab.key
                  ? 'bg-primary text-white font-medium'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}>{tab.label}</button>
            ))}
          </div>
        </div>
        <div className="p-5">
          {/* Material/Accessory/Packaging/Secondary tabs */}
          {(['material', 'accessory', 'packaging', 'secondary'] as const).map(tabKey => {
            const tabDef = costTabs.find(t => t.key === tabKey)!;
            if (activeTab !== tabKey || !tabDef.field) return null;
            const lines = form[tabDef.field] as CostLine[];
            return (
              <div key={tabKey}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-400">{tabDef.label}明细（每行填写物料名称和单价）</p>
                  <button onClick={() => addCostLine(tabDef.field!)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                    <Plus className="w-3.5 h-3.5" /> 添加行
                  </button>
                </div>
                {lines.length === 0 ? (
                  <p className="text-xs text-gray-400 py-6 text-center">暂无明细，点击"添加行"开始填写</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-[#222] text-xs">
                        <th className="text-left px-3 py-2 font-medium text-gray-500 w-8">#</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">物料名称</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-500 w-[160px]">单价</th>
                        <th className="w-[50px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, i) => (
                        <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                          <td className="px-3 py-1.5">
                            <input className={inputCls} value={line.name || ''} onChange={e => updateCostLine(tabDef.field!, i, 'name', e.target.value)} placeholder="物料名称" />
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="number" className={inputCls} value={line.unit_price || ''} onChange={e => updateCostLine(tabDef.field!, i, 'unit_price', e.target.value)} placeholder="单价" />
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <button onClick={() => removeCostLine(tabDef.field!, i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}

          {/* Other costs tab */}
          {activeTab === 'other' && (
            <div>
              <p className="text-xs text-gray-400 mb-3">其他成本（固定五项）</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-[#222] text-xs">
                    <th className="text-left px-3 py-2 font-medium text-gray-500 w-8">#</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">费用类型</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 w-[200px]">费用单价</th>
                  </tr>
                </thead>
                <tbody>
                  {form.other_costs.map((item, i) => (
                    <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{item.cost_type}</td>
                      <td className="px-3 py-1.5">
                        <input type="number" className={inputCls} value={item.unit_price} onChange={e => updateOtherCost(i, e.target.value)} placeholder="填写单价" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary tab */}
          {activeTab === 'summary' && (
            <div>
              <p className="text-xs text-gray-400 mb-3">合计信息</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>含烫画确认车缝GST</label>
                  <input className={inputCls} value={form.sewing_gst} onChange={e => set('sewing_gst', e.target.value)} placeholder="车缝GST" />
                </div>
                <div>
                  <label className={labelCls}>小时换算</label>
                  <input className={inputCls} value={form.hour_conversion} onChange={e => set('hour_conversion', e.target.value)} placeholder="小时换算" />
                </div>
                <div>
                  <label className={labelCls}>裁剪工价</label>
                  <input className={inputCls} value={form.cutting_price} onChange={e => set('cutting_price', e.target.value)} placeholder="裁剪工价" />
                </div>
                <div>
                  <label className={labelCls}>资金占用率</label>
                  <input className={inputCls} value={form.capital_rate} onChange={e => set('capital_rate', e.target.value)} placeholder="资金占用率 %" />
                </div>
                <div>
                  <label className={labelCls}>利润率</label>
                  <input className={inputCls} value={form.profit_rate} onChange={e => set('profit_rate', e.target.value)} placeholder="利润率 %" />
                </div>
                <div>
                  <label className={labelCls}>最终成交价（人民币）</label>
                  <input className={inputCls} value={form.final_price_rmb} onChange={e => set('final_price_rmb', e.target.value)} placeholder="最终成交价" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button onClick={handleSubmit} disabled={submitting || !form.factory_article_no}
          className="px-6 py-2.5 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {submitting ? '保存中...' : '保存报价'}
        </button>
      </div>
    </div>
  );
}
