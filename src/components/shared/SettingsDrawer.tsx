'use client';

import { useEffect } from 'react';
import { X, Settings, Check } from 'lucide-react';
import type { ManualAvoidSize, RingFilter } from '@/lib/types';

interface Props {
  open: boolean;
  variant: 'side' | 'fullscreen';
  riskAvoidSize: ManualAvoidSize;
  onChangeRiskAvoidSize: (size: ManualAvoidSize) => void;
  ringFilter: RingFilter;
  onChangeRingFilter: (filter: RingFilter) => void;
  avoidDeadPoints: boolean;
  onChangeAvoidDeadPoints: (v: boolean) => void;
  onClose: () => void;
}

const SIZE_LABELS: Record<ManualAvoidSize, { label: string; desc: string }> = {
  small: { label: '小 40m', desc: '窄路 / 点位精准' },
  medium: { label: '中 60m', desc: '常规道路（推荐）' },
  large: { label: '大 90m', desc: '宽主路 / 多车道' },
};

export default function SettingsDrawer({
  open,
  variant,
  riskAvoidSize,
  onChangeRiskAvoidSize,
  ringFilter,
  onChangeRingFilter,
  avoidDeadPoints,
  onChangeAvoidDeadPoints,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const containerClass =
    variant === 'side'
      ? 'fixed top-4 right-4 bottom-4 w-[360px] z-[2100] flex flex-col'
      : 'fixed inset-0 z-[2100] flex flex-col';

  return (
    <>
      <div
        className="fixed inset-0 z-[2050] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`${containerClass} bg-slate-950 ${
          variant === 'side' ? 'rounded-3xl border border-white/10 shadow-2xl' : ''
        }`}
        role="dialog"
        aria-label="设置"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-400" />
            <h3 className="font-black text-white text-sm">设置</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 custom-scrollbar">
          {/* 避让范围 */}
          <section>
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
              自动避让范围
            </h4>
            <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
              规划路线时，每个风险点外扩的矩形尺寸。路面较宽、避让不到位时调大。
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(['small', 'medium', 'large'] as const).map((size) => {
                const info = SIZE_LABELS[size];
                const active = riskAvoidSize === size;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onChangeRiskAvoidSize(size)}
                    className={`flex flex-col items-center py-3 rounded-xl border transition ${
                      active
                        ? 'bg-blue-600/20 border-blue-500/60 text-white'
                        : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-black">{info.label}</span>
                    <span className="text-[10px] mt-0.5 opacity-60">{info.desc}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 六环内外筛选 */}
          <section>
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
              六环范围筛选
            </h4>
            <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
              控制地图显示和避让范围。「六环外」= 仅需六环外证的区域(aa=6)，「六环内」= 除六环外以外的全部点位。
            </p>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['inside', '仅六环内', '六环外以外'],
                ['outside', '仅六环外', 'aa=6 六环外证'],
                ['all', '全部', '不限环线'],
              ] as const).map(([val, label, desc]) => {
                const active = ringFilter === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onChangeRingFilter(val as RingFilter)}
                    className={`flex flex-col items-center py-3 rounded-xl border transition ${
                      active
                        ? 'bg-emerald-600/20 border-emerald-500/60 text-white'
                        : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-black">{label}</span>
                    <span className="text-[10px] mt-0.5 opacity-60">{desc}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 失效点处理 */}
          <section>
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
              失效点(已停拍)
            </h4>
            <button
              type="button"
              onClick={() => onChangeAvoidDeadPoints(!avoidDeadPoints)}
              className={`w-full flex items-center justify-between gap-3 py-3 px-3 rounded-xl border transition text-left ${
                avoidDeadPoints
                  ? 'bg-emerald-600/15 border-emerald-500/50'
                  : 'bg-white/5 border-white/5 hover:bg-white/10'
              }`}
            >
              <div className="flex flex-col">
                <span className="text-xs font-black text-white">失效点也自动避让</span>
                <span className="text-[10px] mt-0.5 text-slate-400 leading-relaxed">
                  关闭时仍会在路线命中处列出，可逐个手动选择避让
                </span>
              </div>
              {/* 明确的开/关徽章，不依赖滑块位移，确保一眼可见 */}
              <span
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black ${
                  avoidDeadPoints
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {avoidDeadPoints ? (
                  <>
                    <Check className="w-3 h-3" />
                    已开启
                  </>
                ) : (
                  '已关闭'
                )}
              </span>
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
