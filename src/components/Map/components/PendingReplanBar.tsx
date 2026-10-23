// src/components/Map/components/PendingReplanBar.tsx
'use client';

import React from 'react';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

interface PendingReplanBarProps {
  visible: boolean;
  planning: boolean;
  onReplan: () => void;
}

export default function PendingReplanBar({
  visible,
  planning,
  onReplan,
}: PendingReplanBarProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-[2500] pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-slate-900/95 backdrop-blur-md text-white border border-emerald-500/40 rounded-full px-4 py-2.5 shadow-2xl shadow-black/40 flex items-center gap-3.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>避让设置已更新</span>
        </div>
        <div className="h-3 w-px bg-white/20" />
        <button
          type="button"
          onClick={onReplan}
          disabled={planning}
          className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white text-xs font-black px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition shadow-md shadow-emerald-950/40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${planning ? 'animate-spin' : ''}`} />
          <span>{planning ? '正在规避重算...' : '立即重新规划路线'}</span>
        </button>
      </div>
    </div>
  );
}
