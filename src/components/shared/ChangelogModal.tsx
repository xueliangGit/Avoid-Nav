'use client';

import { useEffect, useMemo } from 'react';
import { X, History, Database, Sparkles, CheckCircle2, Calendar } from 'lucide-react';
import { CHANGELOG_LIST, getDataMeta } from '@/lib/changelog';

interface ChangelogModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ChangelogModal({ open, onClose }: ChangelogModalProps) {
  const meta = useMemo(() => getDataMeta(), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const fullDateStr = meta.updatedAt
    ? new Date(meta.updatedAt).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '未知';

  return (
    <>
      <div
        className="fixed inset-0 z-[2200] bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed inset-x-4 top-[8%] bottom-[8%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[520px] z-[2250] bg-surface rounded-3xl border border-border shadow-2xl flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border-soft shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-fg text-base">更新记录与数据状态</h3>
              <p className="text-xs text-fg-muted">查看点位新鲜度与程序功能演进</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-overlay text-fg-muted hover:text-fg transition"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 滚动内容区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* 当前数据元信息概览卡片 */}
          <div className="p-4 rounded-2xl bg-surface-2 border border-border-soft space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-fg">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Database className="w-4 h-4" />
                当前运行数据集
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px]">
                已生效
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-surface p-3 rounded-xl border border-border-soft">
                <div className="text-[10px] text-fg-muted">已载入监控点位</div>
                <div className="text-lg font-black text-fg mt-0.5 font-mono">
                  {meta.pointCount.toLocaleString()} <span className="text-xs font-normal text-fg-muted">处</span>
                </div>
              </div>
              <div className="bg-surface p-3 rounded-xl border border-border-soft">
                <div className="text-[10px] text-fg-muted">数据同步时间</div>
                <div className="text-xs font-bold text-fg mt-1.5 truncate" title={fullDateStr}>
                  {fullDateStr}
                </div>
              </div>
            </div>
          </div>

          {/* 更新日志时间线 */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-fg-subtle uppercase tracking-wider">历史变更记录</h4>
            <div className="space-y-5 border-l-2 border-border-soft ml-2 pl-4">
              {CHANGELOG_LIST.map((item, idx) => {
                const isData = item.type === 'data';
                return (
                  <div key={idx} className="relative space-y-1.5">
                    {/* 时间轴小圆点 */}
                    <div
                      className={`absolute -left-[23px] top-1 w-3 h-3 rounded-full border-2 border-surface ${
                        isData ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-blue-500'
                      }`}
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                          isData
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {item.version}
                      </span>
                      <span className="text-xs font-bold text-fg">{item.title}</span>
                      <span className="text-[10px] text-fg-subtle ml-auto flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3" />
                        {item.date}
                      </span>
                    </div>
                    <ul className="space-y-1 text-xs text-fg-muted pt-1">
                      {item.details.map((desc, dIdx) => (
                        <li key={dIdx} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/70 shrink-0 mt-0.5" />
                          <span>{desc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-4 border-t border-border-soft bg-surface-2/50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition"
          >
            我知道了
          </button>
        </div>
      </div>
    </>
  );
}
