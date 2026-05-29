'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Navigation,
  X,
  LocateFixed,
  Loader2,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ShieldAlert,
  MapPin,
  Search,
  ArrowDownUp,
  History,
  Save,
  ShieldOff,
  ChevronDown,
  ChevronRight,
  Share2,
} from 'lucide-react';
import type {
  PlaceItem,
  Waypoint,
  ManualAvoidArea,
  ManualAvoidSize,
  RouteRisk,
} from '@/lib/types';

export type InteractionMode = 'none' | 'add-waypoint' | 'add-avoid';

export interface RouteInfo {
  distance: number; // meters
  duration: number; // seconds
}

interface ControlPanelProps {
  // 起终点
  start: PlaceItem | null;
  end: PlaceItem | null;

  // 中间状态
  waypoints: Waypoint[];
  manualAvoidAreas: ManualAvoidArea[];

  // 风险
  avoidedRisks: RouteRisk[];
  safelyIgnoredRisks: RouteRisk[];
  routeRisks: RouteRisk[];
  ignoredRiskIds: Set<string>;
  forcedRiskIds: Set<string>;

  // 路线
  routeInfo: RouteInfo | null;

  // 规划状态
  planning: boolean;
  status: string | null;

  // 是否有用户位置（按钮可用与否）
  hasUserLocation: boolean;

  // 当前交互模式
  mode: InteractionMode;

  // 回调
  onUseMyLocation: () => void;
  onRemoveWaypoint: (id: string) => void;
  onRemoveAvoidArea: (id: string) => void;
  onToggleAddWaypoint: () => void;
  onStartAddAvoid: (size: ManualAvoidSize) => void;
  pendingAvoidSize: ManualAvoidSize;
  onPlan: () => void | Promise<void>;
  onToggleIgnoreRisk: (id: string) => void;
  onToggleForceRisk: (id: string) => void;
  onFocusRisk: (risk: RouteRisk) => void;
  onSwapEndpoints: () => void;
  onClearStart: () => void;
  onClearEnd: () => void;
  onOpenHistory: () => void;
  onSaveRoute: () => void;
  canSave: boolean;
  onStartNavigation: () => void;
  canNavigate: boolean;
  onShareRoute: () => void;
  canShare: boolean;

  // 布局模式：constrained = 桌面端固定高度容器（内部滚动）；flow = 手机端自然流式（外层滚动）
  variant?: 'constrained' | 'flow';
}

const formatDistance = (meters: number): string => {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} 公里`;
  return `${Math.round(meters)} 米`;
};

const formatDuration = (seconds: number): string => {
  const m = Math.round(seconds / 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return `${h} 小时 ${rest} 分`;
  }
  return `${m} 分钟`;
};

const ControlPanel = ({
  start,
  end,
  waypoints,
  manualAvoidAreas,
  avoidedRisks,
  safelyIgnoredRisks,
  routeRisks,
  ignoredRiskIds,
  forcedRiskIds,
  routeInfo,
  planning,
  status,
  hasUserLocation,
  mode,
  onUseMyLocation,
  onRemoveWaypoint,
  onRemoveAvoidArea,
  onToggleAddWaypoint,
  onStartAddAvoid,
  pendingAvoidSize,
  onPlan,
  onToggleIgnoreRisk,
  onToggleForceRisk,
  onFocusRisk,
  onSwapEndpoints,
  onClearStart,
  onClearEnd,
  onOpenHistory,
  onSaveRoute,
  canSave,
  onStartNavigation,
  canNavigate,
  onShareRoute,
  canShare,
  variant = 'constrained',
}: ControlPanelProps) => {
  const activeRiskIds = new Set(routeRisks.map((r) => r.id));
  const [safelyExpanded, setSafelyExpanded] = useState(false);
  const [hitExpanded, setHitExpanded] = useState(true);
  const [otherExpanded, setOtherExpanded] = useState(false);

  // input 保持非受控（让 AMap.AutoComplete 接管），仅当外部 start/end 变化时
  // 主动同步到 DOM 的 value，避免 React 因 key 变化销毁 input 导致 AutoComplete 失效。
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (startInputRef.current && start?.name !== undefined) {
      if (startInputRef.current.value !== (start?.name ?? '')) {
        startInputRef.current.value = start?.name ?? '';
      }
    } else if (startInputRef.current && !start) {
      startInputRef.current.value = '';
    }
  }, [start]);

  useEffect(() => {
    if (endInputRef.current && end?.name !== undefined) {
      if (endInputRef.current.value !== (end?.name ?? '')) {
        endInputRef.current.value = end?.name ?? '';
      }
    } else if (endInputRef.current && !end) {
      endInputRef.current.value = '';
    }
  }, [end]);

  const isFlow = variant === 'flow';
  const rootClass = isFlow
    ? 'bg-slate-950/80 backdrop-blur shadow-2xl rounded-3xl p-6 border border-white/10 flex flex-col'
    : 'bg-slate-950/80 backdrop-blur shadow-2xl rounded-3xl p-6 border border-white/10 flex flex-col max-h-full overflow-y-auto custom-scrollbar';

  return (
    <div className={rootClass}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6 px-1">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
              <Navigation className="text-white w-5 h-5 fill-current" />
            </div>
            <h2 className="font-black text-white text-lg">北京避让导航</h2>
          </div>
          <div className="flex items-center space-x-2">
            {status && (
              <span className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded-lg animate-pulse font-bold tracking-widest">
                {status}
              </span>
            )}
            <button
              type="button"
              onClick={onOpenHistory}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition"
              aria-label="历史路线"
              title="历史路线"
            >
              <History className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 起点 / 终点 */}
        <div className="space-y-3 mb-5 relative">
          <div className="relative">
            <input
              ref={startInputRef}
              id="start-input"
              type="text"
              placeholder="起点位置"
              defaultValue={start?.name ?? ''}
              className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 pl-5 pr-24 text-xs text-white font-bold focus:outline-none focus:border-blue-500/40 placeholder:text-slate-600"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
              {start && (
                <button
                  type="button"
                  onClick={onClearStart}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
                  aria-label="清除起点"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={onUseMyLocation}
                disabled={!hasUserLocation}
                className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
                aria-label="使用我的位置"
                title="使用我的位置"
              >
                <LocateFixed className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="relative">
            <input
              ref={endInputRef}
              id="end-input"
              type="text"
              placeholder="目的地"
              defaultValue={end?.name ?? ''}
              className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 pl-5 pr-12 text-xs text-white font-bold focus:outline-none focus:border-blue-500/40 placeholder:text-slate-600"
            />
            {end && (
              <button
                type="button"
                onClick={onClearEnd}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
                aria-label="清除终点"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 起终点互换按钮 - 浮在两个输入框之间 */}
          <button
            type="button"
            onClick={onSwapEndpoints}
            disabled={!start && !end}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-950 text-slate-300 hover:bg-blue-600 hover:text-white shadow-lg transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label="互换起点和终点"
            title="互换起点和终点"
          >
            <ArrowDownUp className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 途经点 */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center space-x-2">
              <MapPin className="w-3 h-3 text-amber-400" />
              <span>途经点 ({waypoints.length})</span>
            </h3>
            <button
              type="button"
              onClick={onToggleAddWaypoint}
              className={`flex items-center space-x-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition ${
                mode === 'add-waypoint'
                  ? 'bg-amber-500 text-white shadow shadow-amber-500/30'
                  : 'bg-white/5 text-amber-400 hover:bg-white/10'
              }`}
            >
              <Plus className="w-3 h-3" />
              <span>{mode === 'add-waypoint' ? '点击地图添加' : '添加途经点'}</span>
            </button>
          </div>
          {waypoints.length > 0 && (
            <div className="space-y-1.5">
              {waypoints.map((w, idx) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between bg-slate-900/60 border border-white/5 rounded-xl py-2 px-3 text-[11px]"
                >
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <span className="shrink-0 w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-black flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="truncate text-slate-200 font-semibold">{w.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveWaypoint(w.id)}
                    className="shrink-0 p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                    aria-label="删除途经点"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 手动避让区 */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center space-x-2">
              <ShieldAlert className="w-3 h-3 text-rose-400" />
              <span>手动避让区 ({manualAvoidAreas.length})</span>
            </h3>
            {mode === 'add-avoid' && (
              <span className="text-[10px] font-bold text-rose-400 animate-pulse">
                点击地图添加
              </span>
            )}
          </div>

          {/* 三档尺寸按钮 */}
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {(['small', 'medium', 'large'] as const).map((size) => {
              const labels: Record<typeof size, string> = {
                small: '小 30m',
                medium: '中 60m',
                large: '大 100m',
              };
              const active = mode === 'add-avoid' && pendingAvoidSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => onStartAddAvoid(size)}
                  className={`flex items-center justify-center space-x-1 text-[10px] font-bold py-2 rounded-lg transition ${
                    active
                      ? 'bg-rose-500 text-white shadow shadow-rose-500/30'
                      : 'bg-white/5 text-rose-400 hover:bg-white/10'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  <span>{labels[size]}</span>
                </button>
              );
            })}
          </div>
          {manualAvoidAreas.length > 0 && (
            <div className="space-y-1.5">
              {manualAvoidAreas.map((a, idx) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between bg-slate-900/60 border border-white/5 rounded-xl py-2 px-3 text-[11px]"
                >
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <span className="shrink-0 w-5 h-5 rounded-md bg-rose-500/20 text-rose-400 text-[10px] font-black flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="truncate text-slate-200 font-semibold">{a.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveAvoidArea(a.id)}
                    className="shrink-0 p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                    aria-label="删除避让区"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 规划主按钮 */}
        <button
          type="button"
          onClick={onPlan}
          disabled={planning}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-blue-900/40 hover:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
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
          className="mt-2 w-full bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 py-2.5 rounded-2xl font-black text-xs transition flex items-center justify-center space-x-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Save className="w-3.5 h-3.5" />
          <span>保存此路线</span>
        </button>

        {/* 路线信息 */}
        {routeInfo && !planning && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-3 text-center">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                距离
              </div>
              <div className="text-base font-black text-white">
                {formatDistance(routeInfo.distance)}
              </div>
            </div>
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-3 text-center">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                预计时间
              </div>
              <div className="text-base font-black text-white">
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
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-emerald-900/40 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none transition flex items-center justify-center space-x-2"
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

        {/* 已纳入避让的风险点（分两组：仍命中 / 其他） */}
        {avoidedRisks.length > 0 && (() => {
          const hitRisks: typeof avoidedRisks = [];
          const otherRisks: typeof avoidedRisks = [];
          for (const r of avoidedRisks) {
            if (activeRiskIds.has(r.id) && !ignoredRiskIds.has(r.id)) {
              hitRisks.push(r);
            } else {
              otherRisks.push(r);
            }
          }

          const renderRow = (r: typeof avoidedRisks[number]) => {
            const isIgnored = ignoredRiskIds.has(r.id);
            const isHit = activeRiskIds.has(r.id);
            const isForced = forcedRiskIds.has(r.id);
            const rowClass = isIgnored
              ? 'bg-slate-900 border-white/5 opacity-60'
              : isHit
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-emerald-500/10 border-emerald-500/30';
            const nameClass = isIgnored
              ? 'text-slate-500 line-through'
              : isHit
              ? 'text-red-400'
              : 'text-emerald-400';
            return (
              <div
                key={r.id}
                onClick={() => onFocusRisk(r)}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer hover:brightness-125 ${rowClass}`}
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/images/${r.type}.png`}
                    alt=""
                    className="w-4 h-5 object-contain shrink-0"
                  />
                  <span className={`font-bold truncate pr-2 ${nameClass}`}>
                    {r.name}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 shrink-0">
                  {isHit && !isIgnored && (
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onToggleForceRisk(r.id);
                      }}
                      className={`cursor-pointer p-2 rounded-xl transition-all ${
                        isForced
                          ? 'bg-amber-500 text-white hover:bg-amber-600'
                          : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/30'
                      }`}
                      aria-label={isForced ? '取消强化避让' : '强化避让（扩大区域）'}
                      title={isForced ? '已强化避让，点击取消' : '强化避让（按 60m 双向矩形）'}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onToggleIgnoreRisk(r.id);
                    }}
                    className={`cursor-pointer p-2 rounded-xl transition-all ${
                      isIgnored
                        ? 'bg-slate-800 text-slate-600 hover:text-slate-300'
                        : 'bg-white/5 text-blue-400 hover:bg-blue-600 hover:text-white'
                    }`}
                    aria-label={isIgnored ? '恢复避让' : '取消避让此点'}
                    title={isIgnored ? '恢复避让' : '取消避让'}
                  >
                    {isIgnored ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          };

          return (
            <div className="mt-6 flex flex-col border-t border-white/5 pt-5 space-y-3">
              {/* 仍命中（红） */}
              {hitRisks.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setHitExpanded((v) => !v)}
                    className="w-full flex items-center justify-between mb-2 px-1 group"
                  >
                    <h3 className="text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center space-x-2 group-hover:text-red-300 transition">
                      <ShieldAlert className="w-3 h-3" />
                      <span>仍命中 ({hitRisks.length})</span>
                    </h3>
                    {hitExpanded ? (
                      <ChevronDown className="w-3 h-3 text-red-400" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-red-400" />
                    )}
                  </button>
                  {hitExpanded && (
                    <div className="space-y-2 pr-1 text-[11px]">{hitRisks.map(renderRow)}</div>
                  )}
                </div>
              )}

              {/* 已绕开 / 已取消（绿色 + 灰色） */}
              {otherRisks.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setOtherExpanded((v) => !v)}
                    className="w-full flex items-center justify-between mb-2 px-1 group"
                  >
                    <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center space-x-2 group-hover:text-emerald-300 transition">
                      <Eye className="w-3 h-3" />
                      <span>已绕开 / 已取消 ({otherRisks.length})</span>
                    </h3>
                    {otherExpanded ? (
                      <ChevronDown className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-emerald-400" />
                    )}
                  </button>
                  {otherExpanded && (
                    <div className="space-y-2 pr-1 text-[11px]">{otherRisks.map(renderRow)}</div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* 安全忽略（方向不冲突，默认未避让） */}
        {safelyIgnoredRisks.length > 0 && (
          <div className="mt-4 border-t border-white/5 pt-4">
            <button
              type="button"
              onClick={() => setSafelyExpanded((v) => !v)}
              className="w-full flex items-center justify-between mb-2 px-1 group"
            >
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center space-x-2 group-hover:text-slate-300 transition">
                <ShieldOff className="w-3 h-3 text-slate-500" />
                <span>路过未避让 ({safelyIgnoredRisks.length})</span>
              </h3>
              {safelyExpanded ? (
                <ChevronDown className="w-3 h-3 text-slate-500" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-500" />
              )}
            </button>
            {safelyExpanded && (
              <>
                <p className="text-[10px] text-slate-500 mb-3 leading-relaxed px-1">
                  路过这些电子眼但方向不冲突所以未避让。如有疑虑，可点击右侧盾牌强制避让。
                </p>
                <div className="space-y-2 pr-1 custom-scrollbar text-[11px]">
                  {safelyIgnoredRisks.map((r) => {
                    const isForced = forcedRiskIds.has(r.id);
                    return (
                      <div
                        key={r.id}
                        onClick={() => onFocusRisk(r)}
                        className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer hover:brightness-125 transition ${
                          isForced
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : 'bg-slate-900/40 border-white/5'
                        }`}
                      >
                        <div className="flex items-center space-x-3 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/images/${r.type}.png`}
                            alt=""
                            className="w-4 h-5 object-contain shrink-0 opacity-70"
                          />
                          <span className={`font-semibold truncate pr-2 ${isForced ? 'text-amber-300' : 'text-slate-400'}`}>
                            {r.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onToggleForceRisk(r.id);
                          }}
                          className={`shrink-0 cursor-pointer p-2 rounded-xl transition-all ${
                            isForced
                              ? 'bg-amber-500 text-white hover:bg-amber-600'
                              : 'bg-white/5 text-slate-500 hover:bg-amber-500/30 hover:text-amber-400'
                          }`}
                          aria-label={isForced ? '取消强制避让' : '强制避让此点'}
                          title={isForced ? '取消强制避让' : '强制避让'}
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
    </div>
  );
};

export default ControlPanel;
