'use client';

import { useEffect, useRef } from 'react';
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
} from 'lucide-react';
import type {
  PlaceItem,
  Waypoint,
  ManualAvoidArea,
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
  routeRisks: RouteRisk[];
  ignoredRiskIds: Set<string>;

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
  onToggleAddAvoid: () => void;
  onPlan: () => void | Promise<void>;
  onToggleIgnoreRisk: (id: string) => void;
  onFocusRisk: (risk: RouteRisk) => void;
  onSwapEndpoints: () => void;
  onClearStart: () => void;
  onClearEnd: () => void;
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
  routeRisks,
  ignoredRiskIds,
  routeInfo,
  planning,
  status,
  hasUserLocation,
  mode,
  onUseMyLocation,
  onRemoveWaypoint,
  onRemoveAvoidArea,
  onToggleAddWaypoint,
  onToggleAddAvoid,
  onPlan,
  onToggleIgnoreRisk,
  onFocusRisk,
  onSwapEndpoints,
  onClearStart,
  onClearEnd,
}: ControlPanelProps) => {
  const activeRiskIds = new Set(routeRisks.map((r) => r.id));

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

  return (
    <div className="absolute top-4 left-4 z-[2000] w-96 max-h-[calc(100vh-32px)] flex flex-col pointer-events-none">
      <div className="bg-slate-950/80 backdrop-blur shadow-2xl rounded-3xl p-6 border border-white/10 pointer-events-auto flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6 px-1">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
              <Navigation className="text-white w-5 h-5 fill-current" />
            </div>
            <h2 className="font-black text-white text-lg">北京避让导航</h2>
          </div>
          {status && (
            <span className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded-lg animate-pulse font-bold tracking-widest">
              {status}
            </span>
          )}
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
            <button
              type="button"
              onClick={onToggleAddAvoid}
              className={`flex items-center space-x-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition ${
                mode === 'add-avoid'
                  ? 'bg-rose-500 text-white shadow shadow-rose-500/30'
                  : 'bg-white/5 text-rose-400 hover:bg-white/10'
              }`}
            >
              <Plus className="w-3 h-3" />
              <span>{mode === 'add-avoid' ? '点击地图添加' : '添加避让区'}</span>
            </button>
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

        {/* 已纳入避让的风险点 */}
        {avoidedRisks.length > 0 && (
          <div className="mt-6 flex-1 overflow-hidden flex flex-col border-t border-white/5 pt-5">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <span>路线电子眼 ({avoidedRisks.length})</span>
            </h3>
            <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
              规划路线沿途的电子眼。<span className="text-red-400 font-bold">红色</span>
              =当前路线仍命中；<span className="text-emerald-400 font-bold">绿色</span>
              =已成功绕开；<span className="text-slate-400">灰色</span>=已忽略。点击行可定位到地图。
            </p>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar text-[11px]">
              {avoidedRisks.map((r) => {
                const isIgnored = ignoredRiskIds.has(r.id);
                const isHit = activeRiskIds.has(r.id);
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
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onToggleIgnoreRisk(r.id);
                      }}
                      className={`shrink-0 cursor-pointer p-2 rounded-xl transition-all ${
                        isIgnored
                          ? 'bg-slate-800 text-slate-600 hover:text-slate-300'
                          : 'bg-white/5 text-blue-400 hover:bg-blue-600 hover:text-white'
                      }`}
                      aria-label={isIgnored ? '取消忽略' : '忽略此风险'}
                    >
                      {isIgnored ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlPanel;
