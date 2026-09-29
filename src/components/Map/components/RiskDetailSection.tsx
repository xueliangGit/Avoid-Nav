'use client';

import { useState } from 'react';
import {
  ShieldAlert,
  Eye,
  EyeOff,
  ShieldOff,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { RouteRisk } from '@/lib/types';

interface RiskDetailSectionProps {
  avoidedRisks: RouteRisk[];
  safelyIgnoredRisks: RouteRisk[];
  deadRisks: RouteRisk[];
  routeRisks: RouteRisk[];
  ignoredRiskIds: Set<string>;
  forcedRiskIds: Set<string>;
  onToggleIgnoreRisk: (id: string) => void;
  onToggleForceRisk: (id: string) => void;
  onFocusRisk: (risk: RouteRisk) => void;
}

export default function RiskDetailSection({
  avoidedRisks,
  safelyIgnoredRisks,
  deadRisks,
  routeRisks,
  ignoredRiskIds,
  forcedRiskIds,
  onToggleIgnoreRisk,
  onToggleForceRisk,
  onFocusRisk,
}: RiskDetailSectionProps) {
  const activeRiskIds = new Set(routeRisks.map((r) => r.id));
  const [safelyExpanded, setSafelyExpanded] = useState(false);
  const [hitExpanded, setHitExpanded] = useState(true);
  const [otherExpanded, setOtherExpanded] = useState(false);

  const hitRisks: RouteRisk[] = [];
  const otherRisks: RouteRisk[] = [];
  for (const r of avoidedRisks) {
    if (activeRiskIds.has(r.id) && !ignoredRiskIds.has(r.id)) {
      hitRisks.push(r);
    } else {
      otherRisks.push(r);
    }
  }

  const renderRow = (r: RouteRisk) => {
    const isIgnored = ignoredRiskIds.has(r.id);
    const isHit = activeRiskIds.has(r.id);
    const isForced = forcedRiskIds.has(r.id);
    const rowClass = isIgnored
      ? 'bg-surface-2 border-border-soft opacity-60'
      : isHit
      ? 'bg-red-500/10 border-red-500/30'
      : 'bg-emerald-500/10 border-emerald-500/30';
    const nameClass = isIgnored
      ? 'text-fg-subtle line-through'
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
                ? 'bg-surface-3 text-fg-faint hover:text-fg-2'
                : 'bg-overlay-soft text-blue-400 hover:bg-blue-600 hover:text-white'
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
    <>
      {/* 已纳入避让的风险点（分两组：仍命中 / 其他） */}
      {avoidedRisks.length > 0 && (
        <div className="mt-6 flex flex-col border-t border-border-soft pt-5 space-y-3">
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
      )}

      {/* 安全忽略（方向不冲突，默认未避让） */}
      {safelyIgnoredRisks.length > 0 && (
        <div className="mt-4 border-t border-border-soft pt-4">
          <button
            type="button"
            onClick={() => setSafelyExpanded((v) => !v)}
            className="w-full flex items-center justify-between mb-2 px-1 group"
          >
            <h3 className="text-[10px] font-black text-fg-subtle uppercase tracking-widest flex items-center space-x-2 group-hover:text-fg-2 transition">
              <ShieldOff className="w-3 h-3 text-fg-subtle" />
              <span>路过未避让 ({safelyIgnoredRisks.length})</span>
            </h3>
            {safelyExpanded ? (
              <ChevronDown className="w-3 h-3 text-fg-subtle" />
            ) : (
              <ChevronRight className="w-3 h-3 text-fg-subtle" />
            )}
          </button>
          {safelyExpanded && (
            <>
              <p className="text-[10px] text-fg-subtle mb-3 leading-relaxed px-1">
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
                          : 'bg-surface-2/40 border-border-soft'
                      }`}
                    >
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <img
                          src={`/images/${r.type}.png`}
                          alt=""
                          className="w-4 h-5 object-contain shrink-0 opacity-70"
                        />
                        <span className={`font-semibold truncate pr-2 ${isForced ? 'text-amber-300' : 'text-fg-muted'}`}>
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
                            : 'bg-overlay-soft text-fg-subtle hover:bg-amber-500/30 hover:text-amber-400'
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

      {/* 失效点(已停拍) - 路线命中但默认不避让，可手动选择避让 */}
      {deadRisks.length > 0 && (
        <div className="mt-4 border-t border-border-soft pt-4">
          <h3 className="text-[10px] font-black text-fg-subtle uppercase tracking-widest flex items-center space-x-2 mb-2 px-1">
            <ShieldOff className="w-3 h-3 text-fg-subtle" />
            <span>失效点·已停拍 ({deadRisks.length})</span>
          </h3>
          <p className="text-[10px] text-fg-subtle mb-3 leading-relaxed px-1">
            路线经过这些已停拍的点位，默认不避让。如不放心，可点击右侧盾牌单独避让。
          </p>
          <div className="space-y-2 pr-1 custom-scrollbar text-[11px]">
            {deadRisks.map((r) => {
              const isForced = forcedRiskIds.has(r.id);
              return (
                <div
                  key={r.id}
                  onClick={() => onFocusRisk(r)}
                  className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer hover:brightness-125 transition ${
                    isForced
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-surface-2/40 border-border-soft'
                  }`}
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <img
                      src={`/images/${r.type}.png`}
                      alt=""
                      className="w-4 h-5 object-contain shrink-0 opacity-50"
                    />
                    <span className={`font-semibold truncate pr-2 ${isForced ? 'text-amber-300' : 'text-fg-muted'}`}>
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
                        : 'bg-overlay-soft text-fg-subtle hover:bg-amber-500/30 hover:text-amber-400'
                    }`}
                    aria-label={isForced ? '取消避让' : '避让此失效点'}
                    title={isForced ? '取消避让' : '避让此失效点'}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
