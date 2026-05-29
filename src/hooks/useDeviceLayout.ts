'use client';

import { useEffect, useState } from 'react';

export type LayoutMode =
  | 'mobile-portrait'
  | 'mobile-landscape'
  | 'tablet-portrait'
  | 'tablet-landscape'
  | 'desktop';

function detect(): LayoutMode {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  const portrait = window.matchMedia('(orientation: portrait)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  if (finePointer && w >= 1024) return 'desktop';
  if (w >= 1024) return 'desktop';
  if (w >= 768) return portrait ? 'tablet-portrait' : 'tablet-landscape';
  return portrait ? 'mobile-portrait' : 'mobile-landscape';
}

export function useDeviceLayout(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>(() => detect());

  useEffect(() => {
    let timer: number | null = null;
    const update = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setMode(detect()), 100);
    };
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    update();
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return mode;
}
