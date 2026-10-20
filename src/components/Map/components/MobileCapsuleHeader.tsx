'use client';

import { Settings, History, Loader2, Layers } from 'lucide-react';
import type { PlaceItem } from '@/lib/types';

interface MobileCapsuleHeaderProps {
  start: PlaceItem | null;
  end: PlaceItem | null;
  planning: boolean;
  status: string | null;
  hasNewUpdate?: boolean;
  onOpenPlannerModal: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenDebug?: () => void;
}

export default function MobileCapsuleHeader({
  start,
  end,
  planning,
  status,
  hasNewUpdate = false,
  onOpenPlannerModal,
  onOpenSettings,
  onOpenHistory,
  onOpenDebug,
}: MobileCapsuleHeaderProps) {
  const startName = start?.name || '设置起点';
  const endName = end?.name || '你要去哪儿？';

  return (
    <div
      className="absolute z-[1800] pointer-events-none flex flex-col gap-2"
      style={{
        top: 'max(12px, env(safe-area-inset-top, 12px))',
        left: 'max(16px, env(safe-area-inset-left, 16px))',
        right: 'max(16px, env(safe-area-inset-right, 16px))',
      }}
    >
      {/* 顶部胶囊搜索栏 */}
      <div className="flex items-center gap-2 pointer-events-auto w-full">
        <button
          type="button"
          onClick={onOpenPlannerModal}
          className="flex-1 min-w-0 bg-surface/90 hover:bg-surface backdrop-blur-xl border border-border shadow-lg rounded-2xl py-2 px-3 flex items-center gap-2 transition text-left group overflow-hidden"
        >
          <div className="flex-1 min-w-0 flex flex-col gap-1 py-0.5">
            {/* 起点行：绿点与文字居中对齐 */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[11px] text-fg-muted font-medium truncate block leading-none">
                {startName}
              </span>
            </div>
            {/* 终点行：蓝点与文字居中对齐 */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
              <span className={`text-xs font-bold truncate block leading-none ${end ? 'text-fg' : 'text-fg-subtle'}`}>
                {endName}
              </span>
            </div>
          </div>

          {planning ? (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-500 rounded-xl text-xs font-bold shrink-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden xs:inline">计算中</span>
            </div>
          ) : (
            <div className="px-2.5 py-1 bg-blue-600 text-white rounded-xl text-xs font-black shadow-sm group-hover:bg-blue-700 transition shrink-0">
              路线
            </div>
          )}
        </button>

        {/* 快捷工具按钮 */}
        <div className="flex items-center gap-1 shrink-0 bg-surface/90 backdrop-blur-xl border border-border shadow-lg rounded-2xl p-1">
          <button
            type="button"
            onClick={onOpenSettings}
            className="relative w-7 h-7 flex items-center justify-center text-fg-2 hover:text-fg hover:bg-overlay rounded-xl transition shrink-0"
            aria-label="设置"
            title="设置"
          >
            <Settings className="w-3.5 h-3.5" />
            {hasNewUpdate && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 ring-2 ring-surface animate-pulse" />
            )}
          </button>
          <button
            type="button"
            onClick={onOpenHistory}
            className="w-7 h-7 flex items-center justify-center text-fg-2 hover:text-fg hover:bg-overlay rounded-xl transition shrink-0"
            aria-label="历史路线"
            title="历史路线"
          >
            <History className="w-3.5 h-3.5" />
          </button>
          {onOpenDebug && (
            <button
              type="button"
              onClick={onOpenDebug}
              className="w-7 h-7 flex items-center justify-center text-fg-2 hover:text-fg hover:bg-overlay rounded-xl transition shrink-0"
              aria-label="日志"
              title="日志"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 算路进行时的状态徽标 */}
      {status && (
        <div className="flex items-center px-1 pointer-events-auto">
          <span className="text-[10px] bg-indigo-600 text-white px-2.5 py-0.5 rounded-lg font-bold tracking-wider animate-pulse shadow-md">
            {status}
          </span>
        </div>
      )}
    </div>
  );
}
