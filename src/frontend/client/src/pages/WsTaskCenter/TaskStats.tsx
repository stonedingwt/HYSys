import { useState } from 'react';
import { ChevronDown, Maximize2 } from 'lucide-react';
import type { TaskStats } from './types';

interface Props {
  stats: TaskStats | null;
  progress: number;
  statusFilter: string | null;
  onFilterChange: (status: string | null) => void;
  isAdmin: boolean;
}

interface StatItem {
  key: string | null;
  label: string;
  numColor: string;
  bg: string;
  border: string;
  activeBorder: string;
}

const STAT_ROW1: StatItem[] = [
  { key: null,          label: '总任务数', numColor: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-950/40',     border: 'border-blue-100 dark:border-blue-900/50',   activeBorder: 'ring-blue-400/60' },
  { key: 'in_progress', label: '进行中',   numColor: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40',   border: 'border-amber-100 dark:border-amber-900/50', activeBorder: 'ring-amber-400/60' },
  { key: 'done',        label: '已完成',   numColor: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/40',   border: 'border-green-100 dark:border-green-900/50', activeBorder: 'ring-green-400/60' },
];

const STAT_ROW2: StatItem[] = [
  { key: 'risk',    label: '风险任务', numColor: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-100 dark:border-orange-900/50', activeBorder: 'ring-orange-400/60' },
  { key: 'focused', label: '重点关注', numColor: 'text-rose-600 dark:text-rose-400',     bg: 'bg-rose-50 dark:bg-rose-950/40',     border: 'border-rose-100 dark:border-rose-900/50',   activeBorder: 'ring-rose-400/60' },
];

export default function TaskStatsPanel({ stats, progress, statusFilter, onFilterChange }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const getValue = (key: string | null) => {
    if (!stats) return 0;
    if (key === null) return stats.total;
    return (stats as any)[key] ?? 0;
  };

  const handleClick = (key: string | null) => {
    if (key === 'focused' || key === 'risk') return;
    if (key === statusFilter) onFilterChange(null);
    else onFilterChange(key);
  };

  const card = (s: StatItem) => {
    const clickable = s.key !== 'focused' && s.key !== 'risk';
    const isActive = s.key === statusFilter || (s.key === null && statusFilter === null);
    return (
      <div
        key={s.label}
        onClick={() => handleClick(s.key)}
        className={[
          'rounded-xl border px-3 py-2.5 transition-all',
          s.bg, s.border,
          clickable ? 'cursor-pointer hover:shadow-sm' : 'cursor-default',
          isActive ? `ring-2 ${s.activeBorder} shadow-sm` : '',
        ].join(' ')}
      >
        <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">{s.label}</div>
        <div className={`text-2xl font-bold leading-tight ${s.numColor}`}>{getValue(s.key)}</div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-semibold dark:text-gray-100">任务统计</h2>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {STAT_ROW1.map(card)}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {STAT_ROW2.map(card)}
          </div>

          {/* Progress */}
          <div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1.5">任务完成进度</div>
            <div className="flex items-center">
              <span className="text-[10px] text-gray-400 w-6 shrink-0">0%</span>
              <div className="flex-1 relative h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible mx-1">
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(progress, 2)}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white dark:border-gray-800 shadow-sm transition-all duration-500"
                  style={{ left: `${Math.max(progress, 1)}%` }}
                />
                <div
                  className="absolute top-full mt-0.5 text-[10px] text-blue-500 font-medium -translate-x-1/2 transition-all duration-500"
                  style={{ left: `${Math.max(progress, 1)}%` }}
                >
                  {progress}%
                </div>
              </div>
              <span className="text-[10px] text-gray-400 w-8 text-right shrink-0">100%</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
