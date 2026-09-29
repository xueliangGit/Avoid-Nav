'use client';

import { ShieldAlert, Plus, Trash2 } from 'lucide-react';
import type { ManualAvoidArea, ManualAvoidSize } from '@/lib/types';
import type { InteractionMode } from '../ControlPanel';

interface AvoidAreaListProps {
  manualAvoidAreas: ManualAvoidArea[];
  mode: InteractionMode;
  pendingAvoidSize: ManualAvoidSize;
  onStartAddAvoid: (size: ManualAvoidSize) => void;
  onRemoveAvoidArea: (id: string) => void;
}

const SIZE_LABELS: Record<ManualAvoidSize, string> = {
  small: '小 30m',
  medium: '中 60m',
  large: '大 100m',
};

const SIZES: ManualAvoidSize[] = ['small', 'medium', 'large'];

export default function AvoidAreaList({
  manualAvoidAreas,
  mode,
  pendingAvoidSize,
  onStartAddAvoid,
  onRemoveAvoidArea,
}: AvoidAreaListProps) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-[10px] font-black text-fg-subtle uppercase tracking-widest flex items-center space-x-2">
          <ShieldAlert className="w-3 h-3 text-rose-400" />
          <span>手动避让区 ({manualAvoidAreas.length})</span>
        </h3>
        {mode === 'add-avoid' && (
          <span className="text-[10px] font-bold text-rose-400 animate-pulse">
            点击地图添加
          </span>
        )}
      </div>

      {/* 三档尺寸按钮 */}
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        {SIZES.map((size) => {
          const active = mode === 'add-avoid' && pendingAvoidSize === size;
          return (
            <button
              key={size}
              type="button"
              onClick={() => onStartAddAvoid(size)}
              className={`flex items-center justify-center space-x-1 text-[10px] font-bold py-2 rounded-lg transition ${
                active
                  ? 'bg-rose-500 text-white shadow shadow-rose-500/30'
                  : 'bg-overlay-soft text-rose-400 hover:bg-overlay'
              }`}
            >
              <Plus className="w-3 h-3" />
              <span>{SIZE_LABELS[size]}</span>
            </button>
          );
        })}
      </div>

      {manualAvoidAreas.length > 0 && (
        <div className="space-y-1.5">
          {manualAvoidAreas.map((a, idx) => (
            <div
              key={a.id}
              className="flex items-center justify-between bg-surface-2/60 border border-border-soft rounded-xl py-2 px-3 text-[11px]"
            >
              <div className="flex items-center space-x-2 overflow-hidden">
                <span className="shrink-0 w-5 h-5 rounded-md bg-rose-500/20 text-rose-400 text-[10px] font-black flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="truncate text-fg-2 font-semibold">{a.label}</span>
              </div>
              <button
                type="button"
                onClick={() => onRemoveAvoidArea(a.id)}
                className="shrink-0 p-1 rounded-md text-fg-subtle hover:text-red-400 hover:bg-red-500/10 transition"
                aria-label="删除避让区"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
