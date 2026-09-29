'use client';

import { Navigation, Loader2, Search, Save, Share2 } from 'lucide-react';
import type { RouteInfo } from '../ControlPanel';

interface RouteActionBarProps {
  planning: boolean;
  routeInfo: RouteInfo | null;
  canSave: boolean;
  canNavigate: boolean;
  canShare: boolean;
  onPlan: () => void | Promise<void>;
  onSaveRoute: () => void;
  onStartNavigation: () => void;
  onShareRoute: () => void;
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

export default function RouteActionBar({
  planning,
  routeInfo,
  canSave,
  canNavigate,
  canShare,
  onPlan,
  onSaveRoute,
  onStartNavigation,
  onShareRoute,
}: RouteActionBarProps) {
  return (
    <>
      {/* 规划与操作按钮区 */}
      <div className="space-y-2.5 shrink-0">
        <button
          type="button"
          onClick={onPlan}
          disabled={planning}
          className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-blue-900/30 hover:bg-blue-700 disabled:bg-surface-3 disabled:text-fg-subtle disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2 shrink-0"
        >
          {planning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span>{planning ? 'AI 深度避让中...' : '规划路线'}</span>
        </button>

        <button
          type="button"
          onClick={onSaveRoute}
          disabled={!canSave || planning}
          className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 py-2.5 rounded-2xl font-bold text-xs transition flex items-center justify-center space-x-1.5 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        >
          <Save className="w-3.5 h-3.5" />
          <span>保存此路线</span>
        </button>
      </div>

      {/* 路线信息 */}
      {routeInfo && !planning && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="bg-surface-2/60 border border-border-soft rounded-2xl p-3 text-center">
            <div className="text-[10px] uppercase tracking-widest text-fg-subtle font-bold mb-1">
              距离
            </div>
            <div className="text-base font-black text-fg">
              {formatDistance(routeInfo.distance)}
            </div>
          </div>
          <div className="bg-surface-2/60 border border-border-soft rounded-2xl p-3 text-center">
            <div className="text-[10px] uppercase tracking-widest text-fg-subtle font-bold mb-1">
              预计时间
            </div>
            <div className="text-base font-black text-fg">
              {formatDuration(routeInfo.duration)}
            </div>
          </div>
        </div>
      )}

      {/* 开始导航 + 分享（路线规划完成后显示） */}
      {routeInfo && !planning && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onStartNavigation}
            disabled={!canNavigate}
            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-emerald-900/40 disabled:from-surface-3 disabled:to-surface-3 disabled:text-fg-subtle disabled:cursor-not-allowed disabled:shadow-none transition flex items-center justify-center space-x-2"
          >
            <Navigation className="w-4 h-4 fill-current" />
            <span>开始导航</span>
          </button>
          <button
            type="button"
            onClick={onShareRoute}
            disabled={!canShare}
            className="shrink-0 px-4 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-blue-200 rounded-2xl font-black text-sm border border-blue-500/30 hover:border-blue-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center"
            aria-label="分享路线方案"
            title="分享路线方案（含避让设置）"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}
