'use client';

import { ShieldCheck, ShieldAlert, CheckCircle2, ChevronRight } from 'lucide-react';
import type { RouteInfo } from '../ControlPanel';

interface RouteResultSummaryProps {
  routeInfo: RouteInfo;
  avoidedRiskCount: number;
  unavoidedRiskCount: number;
  onViewDetails?: () => void;
}

const formatDistance = (meters: number): string => {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} 公里`;
  return `${Math.round(meters)} 米`;
};

const formatDuration = (seconds: number): string => {
  const mins = Math.round(seconds / 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hours} 小时 ${remainMins} 分钟`;
  }
  return `${mins} 分钟`;
};

export default function RouteResultSummary({
  routeInfo,
  avoidedRiskCount,
  unavoidedRiskCount,
  onViewDetails,
}: RouteResultSummaryProps) {
  const isSafe = unavoidedRiskCount === 0;

  return (
    <div className="mt-5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* 1. 结果状态醒目横幅 */}
      <div
        className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
          isSafe
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {isSafe ? (
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0 animate-pulse">
              <ShieldAlert className="w-5 h-5 text-red-500 dark:text-red-400" />
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 font-black text-xs leading-tight">
              {isSafe ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>规划成功 · 全程避让</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>规划完成 · 存在未避让风险</span>
                </>
              )}
            </div>
            <div className="text-[11px] font-medium opacity-85 mt-0.5 truncate">
              {isSafe
                ? avoidedRiskCount > 0
                  ? `已安全绕开全部 ${avoidedRiskCount} 处监控`
                  : '路线畅通，沿途未检测到冲突监控'
                : `仍有 ${unavoidedRiskCount} 处监控无法绕开${avoidedRiskCount > 0 ? `（已绕开 ${avoidedRiskCount} 处）` : ''}`}
            </div>
          </div>
        </div>

        {onViewDetails && (
          <button
            type="button"
            onClick={onViewDetails}
            className="text-[11px] font-bold text-fg-muted hover:text-fg flex items-center gap-0.5 shrink-0 px-2 py-1 rounded-lg hover:bg-overlay transition"
          >
            <span>明细</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* 2. 距离与预计时间指标卡 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-2/60 border border-border-soft rounded-2xl p-3 text-center">
          <div className="text-[10px] uppercase tracking-widest text-fg-subtle font-bold mb-1">
            总里程
          </div>
          <div className="text-base font-black text-fg">
            {formatDistance(routeInfo.distance)}
          </div>
        </div>
        <div className="bg-surface-2/60 border border-border-soft rounded-2xl p-3 text-center">
          <div className="text-[10px] uppercase tracking-widest text-fg-subtle font-bold mb-1">
            预计耗时
          </div>
          <div className="text-base font-black text-fg">
            {formatDuration(routeInfo.duration)}
          </div>
        </div>
      </div>
    </div>
  );
}
