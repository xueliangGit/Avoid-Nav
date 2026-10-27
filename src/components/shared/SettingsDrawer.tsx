'use client';

import { useEffect } from 'react';
import { X, Settings, Check, Sun, Moon, Monitor, FileText, ChevronRight, HelpCircle } from 'lucide-react';
import type { ManualAvoidSize, RingFilter } from '@/lib/types';
import type { Theme } from '@/lib/theme';
import { getDataMeta } from '@/lib/changelog';

interface Props {
  open: boolean;
  variant: 'side' | 'fullscreen';
  riskAvoidSize: ManualAvoidSize;
  onChangeRiskAvoidSize: (size: ManualAvoidSize) => void;
  ringFilter: RingFilter;
  onChangeRingFilter: (filter: RingFilter) => void;
  avoidDeadPoints: boolean;
  onChangeAvoidDeadPoints: (v: boolean) => void;
  theme: Theme;
  onChangeTheme: (t: Theme) => void;
  onClose: () => void;
  onOpenChangelog?: () => void;
  hasNewUpdate?: boolean;
  onOpenHelp?: () => void;
}

const SIZE_LABELS: Record<ManualAvoidSize, { label: string; desc: string }> = {
  small: { label: '小 40m', desc: '窄路 / 点位精准' },
  medium: { label: '中 60m', desc: '常规道路（推荐）' },
  large: { label: '大 90m', desc: '宽主路 / 多车道' },
};

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
];

export default function SettingsDrawer({
  open,
  variant,
  riskAvoidSize,
  onChangeRiskAvoidSize,
  ringFilter,
  onChangeRingFilter,
  avoidDeadPoints,
  onChangeAvoidDeadPoints,
  theme,
  onChangeTheme,
  onClose,
  onOpenChangelog,
  hasNewUpdate,
  onOpenHelp,
}: Props) {
  const meta = getDataMeta();
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
        className={`${containerClass} bg-surface ${
          variant === 'side' ? 'rounded-3xl border border-border shadow-2xl' : ''
        }`}
        role="dialog"
        aria-label="设置"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-soft">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-400" />
            <h3 className="font-black text-fg text-sm">设置</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-fg-muted hover:text-fg hover:bg-overlay-soft transition"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 custom-scrollbar">
          {/* 点位数据与更新（置顶首项） */}
          {onOpenChangelog && (
            <section>
              <h4 className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-3">
                点位数据与更新
              </h4>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenChangelog();
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-border-soft bg-overlay-soft hover:bg-overlay text-left transition group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-fg">更新日志与点位说明</span>
                      {hasNewUpdate && (
                        <span className="w-2 h-2 rounded-full bg-red-500 ring-2 ring-red-400/30 animate-pulse" />
                      )}
                    </div>
                    <span className="text-[10px] text-fg-muted mt-0.5 truncate">
                      已收录 {meta.pointCount.toLocaleString()} 处点位 · 更新于 {meta.formattedDate}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-fg-subtle group-hover:text-fg group-hover:translate-x-0.5 transition shrink-0" />
              </button>
            </section>
          )}

          {/* 使用帮助与指南 */}
          {onOpenHelp && (
            <section>
              <h4 className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-3">
                帮助与避让指南
              </h4>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenHelp();
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-border-soft bg-overlay-soft hover:bg-overlay text-left transition group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 group-hover:bg-amber-600 group-hover:text-white transition shrink-0">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-fg">使用帮助与常见问题</span>
                    <span className="text-[10px] text-fg-muted mt-0.5 truncate">
                      高架桥与主辅路上下道说明 · 避让规则 · 导航须知
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-fg-subtle group-hover:text-fg group-hover:translate-x-0.5 transition shrink-0" />
              </button>
            </section>
          )}

          {/* 外观主题 */}
          <section>
            <h4 className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-3">
              外观主题
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
                const active = theme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChangeTheme(value)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition ${
                      active
                        ? 'bg-blue-600/20 border-blue-500/60 text-fg'
                        : 'bg-overlay-soft border-border-soft text-fg-muted hover:bg-overlay hover:text-fg'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-black">{label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 避让范围 */}
          <section>
            <h4 className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-3">
              自动避让范围
            </h4>
            <p className="text-[11px] text-fg-muted mb-3 leading-relaxed">
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
                        ? 'bg-blue-600/20 border-blue-500/60 text-fg'
                        : 'bg-overlay-soft border-border-soft text-fg-muted hover:bg-overlay hover:text-fg'
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
            <h4 className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-3">
              六环范围筛选
            </h4>
            <p className="text-[11px] text-fg-muted mb-3 leading-relaxed">
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
                        : 'bg-overlay-soft border-border-soft text-fg-muted hover:bg-overlay hover:text-fg'
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
            <h4 className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-3">
              失效点(已停拍)
            </h4>
            <button
              type="button"
              onClick={() => onChangeAvoidDeadPoints(!avoidDeadPoints)}
              className={`w-full flex items-center justify-between gap-3 py-3 px-3 rounded-xl border transition text-left ${
                avoidDeadPoints
                  ? 'bg-emerald-600/15 border-emerald-500/50'
                  : 'bg-overlay-soft border-border-soft hover:bg-overlay'
              }`}
            >
              <div className="flex flex-col">
                <span className="text-xs font-black text-fg">失效点也自动避让</span>
                <span className="text-[10px] mt-0.5 text-fg-muted leading-relaxed">
                  关闭时仍会在路线命中处列出，可逐个手动选择避让
                </span>
              </div>
              {/* 明确的开/关徽章，不依赖滑块位移，确保一眼可见 */}
              <span
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black ${
                  avoidDeadPoints
                    ? 'bg-emerald-500 text-white'
                    : 'bg-surface-4 text-fg-2'
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

          {/* 探头图例速查 */}
          <section>
            <h4 className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-3">
              点位图例与限行说明
            </h4>
            <div className="space-y-2 p-3 rounded-2xl bg-overlay-soft border border-border-soft text-xs">
              <div className="flex items-center gap-2.5">
                <img src="/images/2.png" alt="常规" className="w-4 h-5 object-contain" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-fg">常规进京证监控</span>
                    <span className="text-[10px] font-bold text-red-500">高风险</span>
                  </div>
                  <span className="text-[11px] text-fg-muted">六环内常规抓拍进京证</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 pt-1.5 border-t border-border-soft">
                <img src="/images/5.png" alt="双拍" className="w-4 h-5 object-contain" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-fg">进京证+高峰双拍</span>
                    <span className="text-[10px] font-bold text-rose-500">极高风险</span>
                  </div>
                  <span className="text-[11px] text-fg-muted">重点路口，进京证与早晚高峰兼拍</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 pt-1.5 border-t border-border-soft">
                <img src="/images/1.png" alt="高峰" className="w-4 h-5 object-contain" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-fg">仅早晚高峰监控</span>
                    <span className="text-[10px] font-bold text-blue-500">中风险</span>
                  </div>
                  <span className="text-[11px] text-fg-muted">仅限工作日早晚高峰 (五环内)</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 pt-1.5 border-t border-border-soft">
                <img src="/images/6.png" alt="六环外" className="w-4 h-5 object-contain" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-fg">六环外监控</span>
                    <span className="text-[10px] font-bold text-emerald-500">低风险</span>
                  </div>
                  <span className="text-[11px] text-fg-muted">办六环外证即可，不消耗内环次数</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 pt-1.5 border-t border-border-soft">
                <img src="/images/4.png" alt="已停拍" className="w-4 h-5 object-contain" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-fg">已拆除 / 已停拍</span>
                    <span className="text-[10px] font-bold text-slate-400">已失效</span>
                  </div>
                  <span className="text-[11px] text-fg-muted">已核实停拍，系统默认不绕路</span>
                </div>
              </div>
            </div>
            <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
              💡 <strong>高架与主辅路说明：</strong>由于地图为二维坐标，无法自动区分高架桥上与地面辅路/上下道。如确认走地面不抓拍，可在规划后点击探头选择【忽略此点】。
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
