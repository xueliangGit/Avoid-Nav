'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface MobileModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  tab?: 'control' | 'debug';
  onTabChange?: (t: 'control' | 'debug') => void;
  hasDebugTab?: boolean;
}

export default function MobilePlannerModal({
  open,
  onClose,
  title,
  children,
  tab = 'control',
  onTabChange,
  hasDebugTab = false,
}: MobileModalProps) {
  return (
    <div
      className={`fixed inset-0 z-[2100] flex flex-col justify-end transition-all duration-300 ${
        open
          ? 'opacity-100 pointer-events-auto bg-black/60 backdrop-blur-sm'
          : 'opacity-0 pointer-events-none bg-black/0'
      }`}
    >
      {/* 遮罩点击关闭 */}
      <div className="flex-1 w-full" onClick={onClose} aria-hidden="true" />

      {/* 弹出层内容容器 */}
      <div
        className={`w-full max-h-[85dvh] bg-surface rounded-t-3xl border-t border-border shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* 顶部标题与关闭 */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border-soft shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-black text-fg text-base">{title}</span>
            {hasDebugTab && onTabChange && (
              <div className="flex bg-surface-2 p-0.5 rounded-xl border border-border-soft">
                <button
                  type="button"
                  onClick={() => onTabChange('control')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    tab === 'control'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-fg-subtle hover:text-fg'
                  }`}
                >
                  面板
                </button>
                <button
                  type="button"
                  onClick={() => onTabChange('debug')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    tab === 'debug'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-fg-subtle hover:text-fg'
                  }`}
                >
                  日志
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-overlay-soft hover:bg-overlay text-fg-muted hover:text-fg transition"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内部滚动区 */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
