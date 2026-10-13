'use client';

import { Navigation, Save, Share2, ShieldAlert, ShieldCheck, ChevronUp } from 'lucide-react';
import type { RouteInfo } from '../ControlPanel';

interface MobileRouteSummaryBarProps {
  routeInfo: RouteInfo | null;
  planning: boolean;
  canSave: boolean;
  canNavigate: boolean;
  canShare: boolean;
  avoidedRiskCount: number;
  unavoidedRiskCount?: number;
  onStartNavigation: () => void;
  onSaveRoute: () => void;
  onShareRoute: () => void;
  onExpandDetails: () => void;
}

const formatDistance = (meters: number): string => {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}公里`;
  return `${Math.round(meters)}米`;
};

const formatDuration = (seconds: number): string => {
  const mins = Math.round(seconds / 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hours}时${remainMins}分`;
  }
  return `${mins}分钟`;
};

export default function MobileRouteSummaryBar({
  routeInfo,
  planning,
  canSave,
  canNavigate,
  canShare,
  avoidedRiskCount,
  unavoidedRiskCount = 0,
  onStartNavigation,
  onSaveRoute,
  onShareRoute,
  onExpandDetails,
}: MobileRouteSummaryBarProps) {
  if (!routeInfo && !planning) {
    return null;
  }

  const hasUnavoided = unavoidedRiskCount > 0;

  return (
    <div className="absolute bottom-4 left-3 right-3 z-[1800] pointer-events-auto">
      <div
        className={`bg-surface/95 backdrop-blur-xl border shadow-2xl rounded-3xl p-3.5 flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-300 transition-colors ${
          hasUnavoided
            ? 'border-red-500/40 ring-1 ring-red-500/20'
            : 'border-emerald-500/30'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          {/* 左侧路线数据概要 */}
          <button
            type="button"
            onClick={onExpandDetails}
            className="flex-1 flex items-center gap-2.5 text-left group"
          >
            <div className="flex flex-col min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-fg leading-tight">
                  {routeInfo ? formatDuration(routeInfo.duration) : '--'}
                </span>
                <span className="text-xs font-semibold text-fg-muted">
                  {routeInfo ? formatDistance(routeInfo.distance) : ''}
                </span>
              </div>
              <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                {hasUnavoided ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-red-600 dark:text-red-400 bg-red-500/15 border border-red-500/30 px-1.5 py-0.5 rounded-md animate-pulse">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    未避开 {unavoidedRiskCount} 处监控
                  </span>
                ) : avoidedRiskCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    已避开 {avoidedRiskCount} 处监控
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-fg-muted bg-surface-2 px-1.5 py-0.5 rounded-md">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    无风险点干扰
                  </span>
                )}
                {hasUnavoided && avoidedRiskCount > 0 && (
                  <span className="inline-flex items-center text-[10px] font-bold text-emerald-600/90 dark:text-emerald-400/90">
                    (已绕开 {avoidedRiskCount} 处)
                  </span>
                )}
                <span className="text-[11px] font-semibold text-blue-500 flex items-center group-hover:underline">
                  详情 <ChevronUp className="w-3 h-3 ml-0.5" />
                </span>
              </div>
            </div>
          </button>

          {/* 右侧核心动作组 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {canSave && (
              <button
                type="button"
                onClick={onSaveRoute}
                className="p-2.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-2xl border border-emerald-500/20 transition"
                aria-label="保存路线"
                title="保存路线"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
            )}
            {canShare && (
              <button
                type="button"
                onClick={onShareRoute}
                className="p-2.5 text-fg-2 hover:text-fg bg-overlay-soft hover:bg-overlay rounded-2xl transition"
                aria-label="分享路线"
                title="分享路线"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canNavigate && (
              <button
                type="button"
                onClick={onStartNavigation}
                className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs px-4 py-2.5 rounded-2xl shadow-lg shadow-blue-500/25 flex items-center gap-1.5 transition"
              >
                <Navigation className="w-3.5 h-3.5 fill-current" />
                <span>导航</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
