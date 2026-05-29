'use client';

import { useEffect } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export type ToastVariant = 'success' | 'error';

interface ToastProps {
  open: boolean;
  message: string;
  variant?: ToastVariant;
  duration?: number; // ms，默认 2000
  onClose: () => void;
}

export default function Toast({ open, message, variant = 'success', duration = 2000, onClose }: ToastProps) {
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(id);
  }, [open, duration, onClose]);

  if (!open) return null;

  const Icon = variant === 'success' ? CheckCircle2 : AlertCircle;
  const colorClass = variant === 'success' ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="fixed left-1/2 top-6 -translate-x-1/2 z-[3000] pointer-events-none">
      <div className="bg-slate-950/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl px-4 py-3 flex items-center space-x-2 min-w-[200px]">
        <Icon className={`w-4 h-4 shrink-0 ${colorClass}`} />
        <span className="text-xs text-white font-bold">{message}</span>
      </div>
    </div>
  );
}
