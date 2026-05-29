'use client';

import { useEffect, useState } from 'react';
import { X, Save, Star } from 'lucide-react';

interface Props {
  open: boolean;
  variant: 'modal' | 'sheet';
  defaultName: string;
  onClose: () => void;
  onConfirm: (name: string, favorite: boolean) => void;
  errorMessage?: string;
}

export default function SaveRouteDialog({
  open,
  variant,
  defaultName,
  onClose,
  onConfirm,
  errorMessage,
}: Props) {
  const [name, setName] = useState(defaultName);
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setFavorite(false);
    }
  }, [open, defaultName]);

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
    variant === 'modal'
      ? 'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px]'
      : 'fixed left-0 right-0 bottom-0 rounded-t-3xl';

  const handleConfirm = () => {
    const t = name.trim();
    if (!t) return;
    onConfirm(t, favorite);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[2200] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`${containerClass} z-[2210] bg-slate-950 border border-white/10 shadow-2xl ${
          variant === 'modal' ? 'rounded-3xl' : ''
        } p-5`}
        role="dialog"
        aria-label="保存路线"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-white text-sm flex items-center gap-2">
            <Save className="w-4 h-4 text-emerald-400" />
            保存路线
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm();
          }}
          placeholder="路线名称"
          className="w-full bg-slate-900 border border-white/10 rounded-2xl py-3 px-4 text-xs text-white font-bold focus:outline-none focus:border-blue-500/40 mb-3"
        />

        <button
          type="button"
          onClick={() => setFavorite((v) => !v)}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl font-bold text-xs transition mb-4 ${
            favorite
              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
              : 'bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${favorite ? 'fill-amber-400' : ''}`} />
          {favorite ? '已收藏' : '加入收藏'}
        </button>

        {errorMessage && (
          <div className="text-[11px] text-red-400 mb-3 text-center">{errorMessage}</div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 py-3 rounded-2xl font-black text-xs transition"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!name.trim()}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-500 text-white py-3 rounded-2xl font-black text-xs transition"
          >
            保存
          </button>
        </div>
      </div>
    </>
  );
}
