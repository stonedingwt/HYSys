import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Ship, Wrench, Package, Anchor, ShieldCheck, Users,
  BarChart3, FileText, ChevronRight, Search, X,
} from 'lucide-react';
import { cn } from '~/utils';

interface SubMenu {
  key: string;
  label: string;
  description: string;
  path?: string;
}

interface BizModule {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgGradient: string;
  subMenus: SubMenu[];
}

const BIZ_MODULES: BizModule[] = [
  {
    key: 'vessel',
    label: '船舶管理',
    description: '船舶档案、证书、检验、动态跟踪',
    icon: Ship,
    color: 'text-blue-600 dark:text-blue-400',
    bgGradient: 'from-blue-500/10 to-blue-600/5 dark:from-blue-500/15 dark:to-blue-600/5',
    subMenus: [
      { key: 'vessel-list', label: '船舶档案', description: '船舶基本信息与技术参数管理' },
      { key: 'vessel-cert', label: '证书管理', description: '船舶证书到期提醒与续期跟踪' },
      { key: 'vessel-inspect', label: '检验管理', description: '年度检验、特检与PSC检查记录' },
      { key: 'vessel-track', label: '船舶动态', description: 'AIS 实时定位与航行轨迹回放' },
    ],
  },
  {
    key: 'equipment',
    label: '设备管理',
    description: '设备台账、维保计划、备件库存',
    icon: Wrench,
    color: 'text-amber-600 dark:text-amber-400',
    bgGradient: 'from-amber-500/10 to-amber-600/5 dark:from-amber-500/15 dark:to-amber-600/5',
    subMenus: [
      { key: 'equip-ledger', label: '设备台账', description: '关键设备清单与技术规格管理' },
      { key: 'equip-maint', label: '维保计划', description: '预防性维护与保养工单管理' },
      { key: 'equip-spare', label: '备件管理', description: '备件库存查询与采购申请' },
      { key: 'equip-fault', label: '故障记录', description: '设备故障报告与维修跟踪' },
    ],
  },
  {
    key: 'inventory',
    label: '库存管理',
    description: '物料管理、入库出库、盘点对账',
    icon: Package,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgGradient: 'from-emerald-500/10 to-emerald-600/5 dark:from-emerald-500/15 dark:to-emerald-600/5',
    subMenus: [
      { key: 'inv-material', label: '物料管理', description: '物料分类、编码与价格维护' },
      { key: 'inv-inout', label: '出入库', description: '入库、出库与调拨单据管理' },
      { key: 'inv-check', label: '盘点管理', description: '定期盘点与差异处理' },
      { key: 'inv-alert', label: '库存预警', description: '安全库存与补货提醒' },
    ],
  },
  {
    key: 'shipping',
    label: '航运管理',
    description: '航线规划、运价管理、运营调度',
    icon: Anchor,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgGradient: 'from-cyan-500/10 to-cyan-600/5 dark:from-cyan-500/15 dark:to-cyan-600/5',
    subMenus: [
      { key: 'ship-route', label: '航线管理', description: '航线规划、港口配置与挂靠安排' },
      { key: 'ship-freight', label: '运价管理', description: '运费报价、合约费率与附加费' },
      { key: 'ship-dispatch', label: '运营调度', description: '船期排班、货运调度与装卸计划' },
      { key: 'ship-booking', label: '订舱管理', description: '货物订舱、舱位分配与提单签发' },
    ],
  },
  {
    key: 'compliance',
    label: '体系管理',
    description: 'ISM、ISPS、MLC 安全质量体系',
    icon: ShieldCheck,
    color: 'text-violet-600 dark:text-violet-400',
    bgGradient: 'from-violet-500/10 to-violet-600/5 dark:from-violet-500/15 dark:to-violet-600/5',
    subMenus: [
      { key: 'comp-ism', label: 'ISM 安全管理', description: '安全管理体系文件与审核记录' },
      { key: 'comp-isps', label: 'ISPS 保安', description: '船舶保安计划与保安等级管理' },
      { key: 'comp-audit', label: '审核管理', description: '内外部审核计划与不符合项跟踪' },
      { key: 'comp-doc', label: '体系文件', description: '管理手册、程序文件与表单模板' },
    ],
  },
  {
    key: 'crew',
    label: '船员管理',
    description: '船员档案、证书、培训、调配',
    icon: Users,
    color: 'text-rose-600 dark:text-rose-400',
    bgGradient: 'from-rose-500/10 to-rose-600/5 dark:from-rose-500/15 dark:to-rose-600/5',
    subMenus: [
      { key: 'crew-list', label: '船员档案', description: '船员个人信息、经历与评价' },
      { key: 'crew-cert', label: '证书管理', description: '适任证书、特种证书到期提醒' },
      { key: 'crew-train', label: '培训管理', description: '培训计划、记录与考核结果' },
      { key: 'crew-assign', label: '调配管理', description: '船员上下船安排与轮换计划' },
    ],
  },
  {
    key: 'dashboard',
    label: '数据看板',
    description: '运营数据可视化与 KPI 监控',
    icon: BarChart3,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgGradient: 'from-indigo-500/10 to-indigo-600/5 dark:from-indigo-500/15 dark:to-indigo-600/5',
    subMenus: [
      { key: 'dash-ops', label: '运营总览', description: '船队运营核心 KPI 一览' },
      { key: 'dash-finance', label: '财务分析', description: '收入、成本与利润趋势图表' },
      { key: 'dash-safety', label: '安全统计', description: '事故率、PSC 缺陷率等安全指标' },
      { key: 'dash-energy', label: '能耗监控', description: '燃油消耗、碳排放与能效指标' },
    ],
  },
  {
    key: 'reports',
    label: '报表管理',
    description: '运营报表生成、导出与订阅',
    icon: FileText,
    color: 'text-slate-600 dark:text-slate-400',
    bgGradient: 'from-slate-500/10 to-slate-600/5 dark:from-slate-500/15 dark:to-slate-600/5',
    subMenus: [
      { key: 'rpt-voyage', label: '航次报告', description: '航次总结、油耗与货运报告' },
      { key: 'rpt-monthly', label: '月度报表', description: '月度运营、财务与安全汇总' },
      { key: 'rpt-custom', label: '自定义报表', description: '按需配置报表模板与字段' },
      { key: 'rpt-export', label: '导出中心', description: 'Excel/PDF 批量导出与定时订阅' },
    ],
  },
];

export default function BusinessModules() {
  const navigate = useNavigate();
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return BIZ_MODULES;
    const q = searchQuery.toLowerCase();
    return BIZ_MODULES.map((mod) => {
      const moduleMatch = mod.label.toLowerCase().includes(q) || mod.description.toLowerCase().includes(q);
      const filteredSubs = mod.subMenus.filter(
        (s) => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
      );
      if (moduleMatch) return mod;
      if (filteredSubs.length > 0) return { ...mod, subMenus: filteredSubs };
      return null;
    }).filter(Boolean) as BizModule[];
  }, [searchQuery]);

  const handleSubMenuClick = (mod: BizModule, sub: SubMenu) => {
    if (sub.path) {
      navigate(sub.path);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50/50 dark:bg-transparent pb-[72px] md:pb-[96px]">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-[28px] font-semibold text-slate-900 dark:text-gray-100 tracking-tight">
            业务模块
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-gray-400">
            航运业务全流程管理，选择模块开始工作
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索模块或功能..."
            className="w-full h-10 pl-10 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-sm text-slate-800 dark:text-gray-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400/50 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Module grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredModules.map((mod) => {
            const isExpanded = expandedModule === mod.key;
            const Icon = mod.icon;
            return (
              <div
                key={mod.key}
                className={cn(
                  'rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 overflow-hidden transition-all duration-300',
                  isExpanded && 'md:col-span-2 shadow-lg shadow-slate-200/50 dark:shadow-none',
                )}
              >
                {/* Module header */}
                <button
                  onClick={() => setExpandedModule(isExpanded ? null : mod.key)}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 md:p-5 text-left cursor-pointer transition-colors group',
                    'hover:bg-slate-50/80 dark:hover:bg-slate-700/20',
                  )}
                >
                  <div className={cn('flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center', mod.bgGradient)}>
                    <Icon className={cn('w-6 h-6', mod.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-gray-100">
                      {mod.label}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 truncate">
                      {mod.description}
                    </p>
                  </div>
                  <ChevronRight
                    className={cn(
                      'w-5 h-5 text-slate-300 dark:text-slate-600 transition-transform duration-200 flex-shrink-0',
                      isExpanded && 'rotate-90 text-slate-500 dark:text-slate-400',
                    )}
                  />
                </button>

                {/* Sub-menus */}
                <div
                  className={cn(
                    'grid transition-all duration-300 ease-in-out',
                    isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="border-t border-slate-100 dark:border-slate-700/40 px-4 md:px-5 pb-4 pt-2">
                      <div className={cn(
                        'grid gap-2',
                        isExpanded ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1',
                      )}>
                        {mod.subMenus.map((sub) => (
                          <button
                            key={sub.key}
                            onClick={() => handleSubMenuClick(mod, sub)}
                            className="flex items-start gap-3 p-3 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer group/sub"
                          >
                            <div className={cn('flex-shrink-0 w-2 h-2 rounded-full mt-1.5', mod.color.replace('text-', 'bg-').replace('-600', '-400').replace('-400', '-400'))} />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-slate-700 dark:text-gray-200 group-hover/sub:text-cyan-600 dark:group-hover/sub:text-cyan-400 transition-colors">
                                {sub.label}
                              </span>
                              <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 leading-relaxed">
                                {sub.description}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 mt-0.5 flex-shrink-0 opacity-0 group-hover/sub:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {filteredModules.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-gray-400">
              未找到匹配的模块或功能
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
