'use client';

import { Settings, History, Loader2, Layers } from 'lucide-react';
import type { PlaceItem } from '@/lib/types';
import UpdateBadge from '@/components/shared/UpdateBadge';

interface MobileCapsuleHeaderProps {
  start: PlaceItem | null;
  end: PlaceItem | null;
  planning: boolean;
  status: string | null;
  onOpenPlannerModal: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenChangelog?: () => void;
  onOpenDebug?: () => void;
}

export default function MobileCapsuleHeader({
  start,
  end,
  planning,
  status,
  onOpenPlannerModal,
  onOpenSettings,
  onOpenHistory,
  onOpenChangelog,
  onOpenDebug,
}: MobileCapsuleHeaderProps) {
  const startName = start?.name || '设置起点';
  const endName = end?.name || '你要去哪儿？';

  return (
    <div className="absolute top-3 left-3 right-3 z-[1800] pointer-events-none flex flex-col gap-2">
      {/* 顶部胶囊搜索栏 */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={onOpenPlannerModal}
          className="flex-1 bg-surface/90 hover:bg-surface backdrop-blur-xl border border-border shadow-xl rounded-2xl py-2.5 px-3.5 flex items-center gap-3 transition text-left group"
        >
          <div className="flex flex-col items-center justify-center shrink-0 w-3.5 py-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="w-0.5 h-3 bg-border my-0.5" />
            <span className="w-2 h-2 rounded-full bg-blue-600" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-fg-muted font-medium truncate leading-tight">
              {startName}
            </div>
            <div className={`text-xs font-bold truncate leading-tight mt-0.5 ${end ? 'text-fg' : 'text-fg-subtle'}`}>
              {endName}
            </div>
          </div>

          {planning ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 text-blue-500 rounded-xl text-xs font-bold shrink-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>计算中</span>
            </div>
          ) : (
            <div className="px-2.5 py-1 bg-blue-600 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 group-hover:bg-blue-700 transition shrink-0">
              路线
            </div>
          )}
        </button>

        {/* 快捷工具按钮 */}
        <div className="flex items-center gap-1 shrink-0 bg-surface/90 backdrop-blur-xl border border-border shadow-xl rounded-2xl p-1">
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 text-fg-2 hover:text-fg hover:bg-overlay rounded-xl transition"
            aria-label="设置"
            title="设置"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onOpenHistory}
            className="p-2 text-fg-2 hover:text-fg hover:bg-overlay rounded-xl transition"
            aria-label="历史路线"
            title="历史路线"
          >
            <History className="w-4 h-4" />
          </button>
          {onOpenDebug && (
            <button
              type="button"
              onClick={onOpenDebug}
              className="p-2 text-fg-2 hover:text-fg hover:bg-overlay rounded-xl transition"
              aria-label="日志"
              title="日志"
            >
              <Layers className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 状态徽标与点位信息 */}
      <div className="flex items-center justify-between px-1 pointer-events-auto">
        <div className="flex items-center gap-2">
          {onOpenChangelog && <UpdateBadge onClick={onOpenChangelog} />}
          {status && (
            <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-lg font-bold tracking-wider animate-pulse shadow-md">
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
