// src/components/shared/BottomSheet.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SheetHeight = 'peek' | 'half' | 'full';

const HEIGHT_VH: Record<SheetHeight, number> = {
  peek: 14,
  half: 50,
  full: 88,
};

interface BottomSheetProps {
  height: SheetHeight;
  onHeightChange: (h: SheetHeight) => void;
  children: React.ReactNode;
}

export default function BottomSheet({ height, onHeightChange, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragOffsetVh, setDragOffsetVh] = useState(0);
  const dragStateRef = useRef<{
    startY: number;
    startVh: number;
    pointerId: number | null;
  } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragStateRef.current = {
      startY: e.clientY,
      startVh: HEIGHT_VH[height],
      pointerId: e.pointerId,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [height]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const st = dragStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    const dy = e.clientY - st.startY;
    const dvh = -(dy / window.innerHeight) * 100;
    setDragOffsetVh(dvh);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const st = dragStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    const finalVh = st.startVh + dragOffsetVh;
    const targets: SheetHeight[] = ['peek', 'half', 'full'];
    let best: SheetHeight = 'peek';
    let bestDist = Infinity;
    for (const t of targets) {
      const d = Math.abs(HEIGHT_VH[t] - finalVh);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    setDragOffsetVh(0);
    dragStateRef.current = null;
    onHeightChange(best);
  }, [dragOffsetVh, onHeightChange]);

  const currentVh = HEIGHT_VH[height] + dragOffsetVh;
  const clamped = Math.max(8, Math.min(95, currentVh));

  return (
    <div
      ref={sheetRef}
      className="fixed left-0 right-0 bottom-0 z-[2000] bg-slate-950/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl shadow-2xl flex flex-col touch-none"
      style={{
        height: `${clamped}dvh`,
        transition: dragStateRef.current ? 'none' : 'height 0.25s ease',
      }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="w-full pt-2 pb-3 flex items-center justify-center cursor-grab active:cursor-grabbing"
        role="separator"
        aria-orientation="horizontal"
      >
        <div className="w-10 h-1.5 rounded-full bg-white/30" />
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}
