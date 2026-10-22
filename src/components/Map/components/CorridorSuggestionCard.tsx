// src/components/Map/components/CorridorSuggestionCard.tsx
'use client';

import React from 'react';
import { Compass, Sparkles, X } from 'lucide-react';
import type { CorridorSuggestion } from '@/lib/corridor';

interface CorridorSuggestionCardProps {
  suggestion: CorridorSuggestion | null;
  onApply: () => void;
  onDismiss: () => void;
  /** 模式：float(悬浮于地图上方) | inline(嵌入面板结果中) */
  mode?: 'float' | 'inline';
}

export default function CorridorSuggestionCard({
  suggestion,
  onApply,
  onDismiss,
  mode = 'float',
}: CorridorSuggestionCardProps) {
  if (!suggestion) return null;

  const content = (
    <div className="bg-surface/95 dark:bg-slate-900/95 backdrop-blur-md border border-amber-500/40 rounded-2xl p-3.5 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-black text-fg flex items-center gap-1.5">
              <span>建议绕行六环安全走廊</span>
              <span className="text-[10px] bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded-full font-bold">
                {suggestion.unavoidedCount} 处无法避让
              </span>
            </div>
            <div className="text-[11px] text-fg-muted mt-0.5 line-clamp-1">
              当前道路未走六环，推荐切换至【{suggestion.corridorName}】全程避让
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-fg-subtle hover:text-fg p-1 rounded-lg hover:bg-overlay transition shrink-0"
          title="忽略"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onApply}
          className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/20 active:scale-95 transition"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>立即切换六环重新规划</span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-3 py-2 text-xs font-bold text-fg-muted hover:text-fg hover:bg-surface-2 rounded-xl transition"
        >
          保持现状
        </button>
      </div>
    </div>
  );

  if (mode === 'float') {
    return (
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1800] w-[92%] max-w-md pointer-events-auto">
        {content}
      </div>
    );
  }

  return <div className="mt-3">{content}</div>;
}
