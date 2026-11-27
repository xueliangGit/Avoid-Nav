'use client';

import React from 'react';
import { Shield } from 'lucide-react';
import type { RingFilter } from '@/lib/types';

interface RingFilterSwitchProps {
  value: RingFilter;
  onChange: (value: RingFilter) => void;
  variant?: 'panel' | 'float';
}

const OPTIONS: { value: RingFilter; label: string; fullLabel: string }[] = [
  { value: 'inside', label: '六环内', fullLabel: '仅六环内' },
  { value: 'all', label: '全部', fullLabel: '全部点位' },
  { value: 'outside', label: '六环外', fullLabel: '仅六环外' },
];

export default function RingFilterSwitch({
  value,
  onChange,
  variant = 'panel',
}: RingFilterSwitchProps) {
  if (variant === 'float') {
    return (
      <div className="inline-flex items-center gap-1 bg-surface/95 backdrop-blur-xl border border-border shadow-lg rounded-2xl p-1 pointer-events-auto select-none">
        <span className="text-[11px] text-fg-muted font-bold pl-2 pr-0.5 flex items-center gap-1 shrink-0">
          <Shield className="w-3 h-3 text-blue-500" />
          范围
        </span>
        <div className="flex items-center gap-0.5 bg-overlay-soft p-0.5 rounded-xl border border-border-soft">
          {OPTIONS.map((opt) => {
            const active = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange(opt.value)}
                className={`px-2 py-0.5 rounded-lg text-xs font-black transition ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-fg-muted hover:text-fg hover:bg-overlay'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between mb-4 p-2 rounded-2xl bg-overlay-soft border border-border-soft select-none">
      <div className="flex items-center gap-1.5 pl-1.5 text-xs font-bold text-fg-muted">
        <Shield className="w-3.5 h-3.5 text-blue-500" />
        <span>显示范围</span>
      </div>
      <div className="flex items-center gap-1 bg-surface p-0.5 rounded-xl border border-border-soft text-xs shadow-inner">
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition ${
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-fg-muted hover:text-fg hover:bg-overlay'
              }`}
            >
              {opt.fullLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
