'use client';

import { useCallback, useEffect, useRef } from 'react';

export type SheetHeight = 'peek' | 'half' | 'full';

const HEIGHT_VH: Record<SheetHeight, number> = {
  peek: 14,
  half: 50,
  full: 88,
};

const MAX_VH = 88;

interface BottomSheetProps {
  height: SheetHeight;
  onHeightChange: (h: SheetHeight) => void;
  children: React.ReactNode;
}

export default function BottomSheet({ height, onHeightChange, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    startY: number;
    startTranslateY: number;
    lastY: number;
    lastTime: number;
    velocity: number;
    pointerId: number | null;
  } | null>(null);

  // 计算某个档位对应的 translateY (单位 px)
  const getTargetTranslateY = useCallback((h: SheetHeight) => {
    if (typeof window === 'undefined') return 0;
    const vh = window.innerHeight;
    const sheetHeightPx = (vh * MAX_VH) / 100;
    const visiblePx = (vh * HEIGHT_VH[h]) / 100;
    return Math.max(0, sheetHeightPx - visiblePx);
  }, []);

  // 同步外部状态 height 到 DOM
  useEffect(() => {
    if (dragStateRef.current || !sheetRef.current) return;
    const ty = getTargetTranslateY(height);
    sheetRef.current.style.transition = 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)';
    sheetRef.current.style.transform = `translate3d(0, ${ty}px, 0)`;
  }, [height, getTargetTranslateY]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!sheetRef.current) return;
    const vh = window.innerHeight;
    const sheetHeightPx = (vh * MAX_VH) / 100;
    const currentVisiblePx = (vh * HEIGHT_VH[height]) / 100;
    const currentTranslateY = Math.max(0, sheetHeightPx - currentVisiblePx);

    dragStateRef.current = {
      startY: e.clientY,
      startTranslateY: currentTranslateY,
      lastY: e.clientY,
      lastTime: Date.now(),
      velocity: 0,
      pointerId: e.pointerId,
    };

    sheetRef.current.style.transition = 'none';
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [height]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const st = dragStateRef.current;
    if (!st || st.pointerId !== e.pointerId || !sheetRef.current) return;

    const now = Date.now();
    const dt = now - st.lastTime;
    if (dt > 16) {
      st.velocity = (e.clientY - st.lastY) / dt;
      st.lastY = e.clientY;
      st.lastTime = now;
    }

    const deltaY = e.clientY - st.startY;
    let nextY = st.startTranslateY + deltaY;

    // 顶部与底部弹性阻尼限制
    const vh = window.innerHeight;
    const maxTranslate = (vh * (MAX_VH - HEIGHT_VH.peek)) / 100;
    if (nextY < 0) {
      nextY = nextY * 0.25;
    } else if (nextY > maxTranslate) {
      nextY = maxTranslate + (nextY - maxTranslate) * 0.25;
    }

    sheetRef.current.style.transform = `translate3d(0, ${nextY}px, 0)`;
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const st = dragStateRef.current;
    if (!st || st.pointerId !== e.pointerId || !sheetRef.current) return;

    const vh = window.innerHeight;
    const deltaY = e.clientY - st.startY;
    const currentTranslate = st.startTranslateY + deltaY;
    const currentVisibleVh = MAX_VH - (currentTranslate / vh) * 100;
    const velocity = st.velocity;

    dragStateRef.current = null;

    let target: SheetHeight = height;

    // 轻扫速度判定
    if (velocity < -0.45) {
      target = height === 'peek' ? 'half' : 'full';
    } else if (velocity > 0.45) {
      target = height === 'full' ? 'half' : 'peek';
    } else {
      // 距离就近吸附
      const candidates: SheetHeight[] = ['peek', 'half', 'full'];
      let bestDist = Infinity;
      for (const cand of candidates) {
        const dist = Math.abs(HEIGHT_VH[cand] - currentVisibleVh);
        if (dist < bestDist) {
          bestDist = dist;
          target = cand;
        }
      }
    }

    const finalTranslateY = getTargetTranslateY(target);
    sheetRef.current.style.transition = 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)';
    sheetRef.current.style.transform = `translate3d(0, ${finalTranslateY}px, 0)`;
    onHeightChange(target);
  }, [height, getTargetTranslateY, onHeightChange]);

  return (
    <div
      ref={sheetRef}
      className="fixed left-0 right-0 bottom-0 z-[2000] bg-surface/95 backdrop-blur-xl border-t border-border rounded-t-3xl shadow-2xl flex flex-col will-change-transform"
      style={{
        height: `${MAX_VH}dvh`,
        transform: typeof window !== 'undefined' ? `translate3d(0, ${getTargetTranslateY(height)}px, 0)` : undefined,
      }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="w-full pt-2.5 pb-3.5 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
        role="separator"
        aria-orientation="horizontal"
      >
        <div className="w-12 h-1.5 rounded-full bg-overlay-heavy/80 hover:bg-overlay-heavy transition-colors" />
      </div>
      <div
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
        style={{
          maxHeight: `calc(${HEIGHT_VH[height]}dvh - 28px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
