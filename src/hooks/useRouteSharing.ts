'use client';

import { useCallback, useEffect, useRef } from 'react';
import { buildShareUrl, encodeShare } from '@/lib/share';
import { useShareLink } from '@/hooks/useShareLink';
import type {
  ManualAvoidArea,
  PlaceItem,
  Waypoint,
} from '@/lib/types';
import type { RoutePlanInput } from '@/hooks/useRoutePlanner';

interface UseRouteSharingProps {
  start: PlaceItem | null;
  end: PlaceItem | null;
  waypoints: Waypoint[];
  manualAvoidAreas: ManualAvoidArea[];
  ignoredRiskIds: Set<string>;
  forcedRiskIds: Set<string>;
  ready: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AMap: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any;
  plan: (override?: Partial<RoutePlanInput>) => Promise<boolean>;
  setStart: (item: PlaceItem | null) => void;
  setEnd: (item: PlaceItem | null) => void;
  setWaypoints: (w: Waypoint[]) => void;
  setManualAvoidAreas: (m: ManualAvoidArea[]) => void;
  setIgnoredRiskIds: (ids: Set<string>) => void;
  setForcedRiskIds: (ids: Set<string>) => void;
  showToast: (msg: string, variant?: 'success' | 'error') => void;
}

export function useRouteSharing({
  start,
  end,
  waypoints,
  manualAvoidAreas,
  ignoredRiskIds,
  forcedRiskIds,
  ready,
  AMap,
  map,
  plan,
  setStart,
  setEnd,
  setWaypoints,
  setManualAvoidAreas,
  setIgnoredRiskIds,
  setForcedRiskIds,
  showToast,
}: UseRouteSharingProps) {
  const canShare = !!start && !!end;

  const handleShareRoute = useCallback(async () => {
    if (!start || !end) return;
    const token = encodeShare({
      s: start,
      e: end,
      w: waypoints,
      m: manualAvoidAreas,
      i: Array.from(ignoredRiskIds),
      f: Array.from(forcedRiskIds),
    });
    const url = buildShareUrl(token);

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: '北京避让导航 - 路线方案', url });
        return;
      }
    } catch {
      // 用户取消分享
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('链接已复制，粘贴给好友即可');
    } catch {
      window.prompt('复制此链接分享：', url);
    }
  }, [start, end, waypoints, manualAvoidAreas, ignoredRiskIds, forcedRiskIds, showToast]);

  const pendingSharedPlanRef = useRef<null | (() => void)>(null);

  useShareLink(
    useCallback(
      (state) => {
        setStart(state.s);
        setEnd(state.e);
        setWaypoints(state.w);
        setManualAvoidAreas(state.m);
        setIgnoredRiskIds(new Set(state.i));
        setForcedRiskIds(new Set(state.f));
        pendingSharedPlanRef.current = () => {
          void plan({
            start: state.s,
            end: state.e,
            waypoints: state.w,
            manualAvoidAreas: state.m,
            ignoredRiskIds: new Set(state.i),
            forcedRiskIds: new Set(state.f),
          });
        };
        showToast('已加载分享的路线，地图就绪后自动规划...');
      },
      [plan, showToast, setStart, setEnd, setWaypoints, setManualAvoidAreas, setIgnoredRiskIds, setForcedRiskIds],
    ),
  );

  useEffect(() => {
    if (!ready || !AMap || !map) return;
    const fn = pendingSharedPlanRef.current;
    if (!fn) return;
    pendingSharedPlanRef.current = null;
    fn();
  }, [ready, AMap, map]);

  return { canShare, handleShareRoute };
}
