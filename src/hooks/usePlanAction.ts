'use client';

import { useCallback } from 'react';
import type { PlaceItem } from '@/lib/types';
import type { RoutePlanInput } from '@/hooks/useRoutePlanner';

interface UsePlanActionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AMap: any;
  start: PlaceItem | null;
  end: PlaceItem | null;
  plan: (override?: Partial<RoutePlanInput>) => Promise<boolean>;
  setStart: (item: PlaceItem | null) => void;
  setEnd: (item: PlaceItem | null) => void;
  showToast: (msg: string, variant?: 'success' | 'error') => void;
}

export function usePlanAction({
  AMap,
  start,
  end,
  plan,
  setStart,
  setEnd,
  showToast,
}: UsePlanActionProps) {
  const handlePlan = useCallback(async () => {
    if (!AMap) return;

    let s = start;
    let e = end;

    const startInput = document.getElementById('start-input') as HTMLInputElement | null;
    const endInput = document.getElementById('end-input') as HTMLInputElement | null;
    const startText = startInput?.value?.trim() ?? '';
    const endText = endInput?.value?.trim() ?? '';

    const lookup = (keyword: string): Promise<PlaceItem | null> =>
      new Promise((resolve) => {
        try {
          const ps = new AMap.PlaceSearch({ city: '北京', pageSize: 1, extensions: 'base' });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ps.search(keyword, (searchStatus: string, result: any) => {
            const poi = result?.poiList?.pois?.[0];
            if (searchStatus === 'complete' && poi?.location) {
              resolve({
                lng: poi.location.lng,
                lat: poi.location.lat,
                name: poi.name ?? keyword,
              });
            } else {
              resolve(null);
            }
          });
        } catch {
          resolve(null);
        }
      });

    // 针对手机端自动补全有时未触发做文本校验兜底
    if (startText !== (s?.name ?? '') && startText) {
      const found = await lookup(startText);
      if (found) {
        s = found;
        setStart(found);
      }
    }
    if (endText !== (e?.name ?? '') && endText) {
      const found = await lookup(endText);
      if (found) {
        e = found;
        setEnd(found);
      }
    }

    if (!s || !e) {
      showToast(!s && !e ? '请先设置起点和终点' : !s ? '请先设置起点' : '请先设置终点', 'error');
      return;
    }

    const ok = await plan({ start: s, end: e });
    if (!ok) showToast('规划失败，请检查起终点或稍后重试', 'error');
  }, [AMap, start, end, plan, setStart, setEnd, showToast]);

  return { handlePlan };
}
