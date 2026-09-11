'use client';

import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { getDataMeta } from '@/lib/changelog';

interface UpdateBadgeProps {
  onClick: () => void;
  className?: string;
}

export default function UpdateBadge({ onClick, className = '' }: UpdateBadgeProps) {
  const meta = useMemo(() => getDataMeta(), []);

  const pointText = meta.pointCount > 0 ? `${meta.pointCount.toLocaleString()} 点位` : '点位加载中';
  const dateText = meta.formattedDate || '最新';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 shrink-0 whitespace-nowrap select-none ${className}`}
      title="点击查看数据更新记录与版本历史"
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
      </span>
      <span className="font-semibold whitespace-nowrap">{pointText}</span>
      <span className="opacity-40">·</span>
      <span className="opacity-80 whitespace-nowrap">{dateText}</span>
      <Sparkles className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}
