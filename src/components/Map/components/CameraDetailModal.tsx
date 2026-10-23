// src/components/Map/components/CameraDetailModal.tsx
'use client';

import React, { useState } from 'react';
import { X, ExternalLink, Loader2 } from 'lucide-react';

interface CameraDetailModalProps {
  open: boolean;
  url: string | null;
  title: string;
  onClose: () => void;
}

export default function CameraDetailModal({
  open,
  url,
  title,
  onClose,
}: CameraDetailModalProps) {
  const [loading, setLoading] = useState(true);

  if (!open || !url) return null;

  return (
    <div className="fixed inset-0 z-[3500] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* 弹窗容器 */}
      <div className="relative bg-surface dark:bg-slate-900 border border-border rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl h-[90vh] sm:h-[85vh] overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* 顶部标题栏 */}
        <div className="px-4 py-3 border-b border-border-soft flex items-center justify-between shrink-0 bg-surface-2/60">
          <div className="flex items-center gap-2 overflow-hidden mr-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <h3 className="text-sm font-bold text-fg truncate" title={title}>
              {title} - 监控详情
            </h3>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-fg-subtle hover:text-fg hover:bg-surface-3 rounded-lg transition"
              title="在新标签页中打开原网页"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-fg-subtle hover:text-fg hover:bg-surface-3 rounded-lg transition"
              title="关闭详情"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 网页主体 iframe */}
        <div className="relative flex-1 w-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-fg-muted z-10 bg-surface/80 backdrop-blur-sm">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              <span className="text-xs font-medium">正在安全加载详情网页...</span>
            </div>
          )}

          <iframe
            src={url}
            title={title}
            className="w-full h-full border-0"
            // 安全沙箱：允许脚本、同源资源、表单和弹窗，严格禁止 allow-top-navigation 防篡改顶层页面
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={() => setLoading(false)}
          />
        </div>
      </div>
    </div>
  );
}
