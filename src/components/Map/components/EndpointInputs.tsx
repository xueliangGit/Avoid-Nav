'use client';

import { useEffect, useRef } from 'react';
import { X, LocateFixed, ArrowDownUp } from 'lucide-react';
import type { PlaceItem } from '@/lib/types';

interface EndpointInputsProps {
  start: PlaceItem | null;
  end: PlaceItem | null;
  hasUserLocation: boolean;
  onUseMyLocation: () => void;
  onSwapEndpoints: () => void;
  onClearStart: () => void;
  onClearEnd: () => void;
}

export default function EndpointInputs({
  start,
  end,
  hasUserLocation,
  onUseMyLocation,
  onSwapEndpoints,
  onClearStart,
  onClearEnd,
}: EndpointInputsProps) {
  // input 保持非受控（让 AMap.AutoComplete 接管），仅当外部 start/end 变化时
  // 主动同步到 DOM 的 value，避免 React 因 key 变化销毁 input 导致 AutoComplete 失效。
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (startInputRef.current && start?.name !== undefined) {
      if (startInputRef.current.value !== (start?.name ?? '')) {
        startInputRef.current.value = start?.name ?? '';
      }
    } else if (startInputRef.current && !start) {
      startInputRef.current.value = '';
    }
  }, [start]);

  useEffect(() => {
    if (endInputRef.current && end?.name !== undefined) {
      if (endInputRef.current.value !== (end?.name ?? '')) {
        endInputRef.current.value = end?.name ?? '';
      }
    } else if (endInputRef.current && !end) {
      endInputRef.current.value = '';
    }
  }, [end]);

  return (
    <div className="space-y-3 mb-5 relative">
      <div className="relative">
        <input
          ref={startInputRef}
          id="start-input"
          type="text"
          placeholder="起点位置"
          defaultValue={start?.name ?? ''}
          className="w-full bg-surface-2 border border-border-soft rounded-2xl py-4 pl-5 pr-24 text-xs text-fg font-bold focus:outline-none focus:border-blue-500/40 placeholder:text-fg-faint"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
          {start && (
            <button
              type="button"
              onClick={onClearStart}
              className="p-1.5 rounded-lg bg-overlay-soft hover:bg-overlay text-fg-muted hover:text-fg transition"
              aria-label="清除起点"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={onUseMyLocation}
            disabled={!hasUserLocation}
            className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
            aria-label="使用我的位置"
            title="使用我的位置"
          >
            <LocateFixed className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="relative">
        <input
          ref={endInputRef}
          id="end-input"
          type="text"
          placeholder="目的地"
          defaultValue={end?.name ?? ''}
          className="w-full bg-surface-2 border border-border-soft rounded-2xl py-4 pl-5 pr-12 text-xs text-fg font-bold focus:outline-none focus:border-blue-500/40 placeholder:text-fg-faint"
        />
        {end && (
          <button
            type="button"
            onClick={onClearEnd}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-overlay-soft hover:bg-overlay text-fg-muted hover:text-fg transition"
            aria-label="清除终点"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* 起终点互换按钮 - 浮在两个输入框之间 */}
      <button
        type="button"
        onClick={onSwapEndpoints}
        disabled={!start && !end}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-surface-3 border-2 border-surface text-fg-2 hover:bg-blue-600 hover:text-white shadow-lg transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
        aria-label="互换起点和终点"
        title="互换起点和终点"
      >
        <ArrowDownUp className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
