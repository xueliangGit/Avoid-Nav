'use client';

import { useEffect } from 'react';
import { X, ListOrdered } from 'lucide-react';
import type { SavedRoute } from '@/lib/storage';
import HistoryListItem from './HistoryListItem';

interface Props {
  open: boolean;
  variant: 'side' | 'fullscreen';
  routes: SavedRoute[];
  onClose: () => void;
  onUse: (route: SavedRoute) => void;
  onToggleFavorite: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}

export default function HistoryDrawer({
  open,
  variant,
  routes,
  onClose,
  onUse,
  onToggleFavorite,
  onRename,
  onRemove,
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
        aria-label="历史路线"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-blue-400" />
            <h3 className="font-black text-white text-sm">历史路线 ({routes.length})</h3>
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

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 custom-scrollbar">
          {routes.length === 0 ? (
            <div className="text-center text-slate-500 text-xs py-12">
              还没有保存的路线
              <br />
              规划完路线后点&quot;保存此路线&quot;
            </div>
          ) : (
            routes.map((r) => (
              <HistoryListItem
                key={r.id}
                route={r}
                onUse={(rt) => {
                  onUse(rt);
                  onClose();
                }}
                onToggleFavorite={onToggleFavorite}
                onRename={onRename}
                onRemove={onRemove}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
