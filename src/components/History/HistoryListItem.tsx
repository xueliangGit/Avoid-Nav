'use client';

import { useState } from 'react';
import { Star, MoreVertical, Trash2, Pencil, Check, X } from 'lucide-react';
import type { SavedRoute } from '@/lib/storage';

interface Props {
  route: SavedRoute;
  onUse: (route: SavedRoute) => void;
  onToggleFavorite: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}

function fmtKm(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
}
function fmtMin(s: number): string {
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}时${m % 60}分` : `${m}分`;
}

export default function HistoryListItem({
  route,
  onUse,
  onToggleFavorite,
  onRename,
  onRemove,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(route.name);

  const commit = () => {
    if (draft.trim()) onRename(route.id, draft.trim());
    setEditing(false);
  };

  return (
    <div className="bg-slate-900/70 border border-white/5 rounded-2xl p-3 hover:bg-slate-900 transition">
      <div className="flex items-start justify-between gap-2 mb-2">
        <button
          type="button"
          onClick={() => onToggleFavorite(route.id)}
          className="shrink-0 p-1 -ml-1 text-slate-500 hover:text-amber-400 transition"
          aria-label={route.favorite ? '取消收藏' : '收藏'}
        >
          <Star
            className={`w-4 h-4 ${route.favorite ? 'fill-amber-400 text-amber-400' : ''}`}
          />
        </button>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit();
                  if (e.key === 'Escape') {
                    setDraft(route.name);
                    setEditing(false);
                  }
                }}
                className="flex-1 bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-blue-500/40"
                autoFocus
              />
              <button onClick={commit} className="p-1 text-emerald-400" aria-label="确认">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setDraft(route.name);
                  setEditing(false);
                }}
                className="p-1 text-slate-400"
                aria-label="取消"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <h4 className="text-xs font-bold text-white truncate">{route.name}</h4>
          )}
          <p className="text-[10px] text-slate-500 mt-1 truncate">
            {route.start.name} → {route.end.name}
          </p>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1 text-slate-500 hover:text-white transition"
            aria-label="更多"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-10 bg-slate-800 border border-white/10 rounded-xl shadow-2xl py-1 min-w-[120px]">
              <button
                onClick={() => {
                  setEditing(true);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/5 flex items-center gap-2"
              >
                <Pencil className="w-3 h-3" /> 重命名
              </button>
              <button
                onClick={() => {
                  onRemove(route.id);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
              >
                <Trash2 className="w-3 h-3" /> 删除
              </button>
            </div>
          )}
        </div>
      </div>

      {(route.waypoints.length > 0 || route.summary) && (
        <p className="text-[10px] text-slate-500 mb-2">
          {route.waypoints.length > 0 && `途经 ${route.waypoints.length} 处`}
          {route.summary && route.waypoints.length > 0 && ' · '}
          {route.summary && `${fmtKm(route.summary.distance)} / ${fmtMin(route.summary.duration)}`}
          {route.summary && ` · ${route.summary.riskCount} 处眼`}
        </p>
      )}

      <button
        type="button"
        onClick={() => onUse(route)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-[11px] font-black transition"
      >
        使用此路线
      </button>
    </div>
  );
}
