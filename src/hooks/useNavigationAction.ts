'use client';

import { useCallback, useState } from 'react';
import { generateNavWaypoints } from '@/lib/navigation/navWaypointHelper';
import { buildAmapNavUri, detectPlatform, isWechat } from '@/lib/navigation';
import type { LngLat, ManualAvoidArea, PlaceItem, RingFilter, RouteRisk, Waypoint } from '@/lib/types';

interface UseNavigationActionProps {
  start: PlaceItem | null;
  end: PlaceItem | null;
  routePath: LngLat[];
  planning: boolean;
  avoidedRisks?: RouteRisk[];
  manualAvoidAreas?: ManualAvoidArea[];
  waypoints?: Waypoint[];
  ringFilter?: RingFilter;
}

export function useNavigationAction({
  start,
  end,
  routePath,
  planning,
  avoidedRisks = [],
  manualAvoidAreas = [],
  waypoints = [],
  ringFilter = 'inside',
}: UseNavigationActionProps) {
  const [wechatGuideOpen, setWechatGuideOpen] = useState(false);

  const canNavigate = !!start && !!end && !planning && routePath.length > 1;

  const handleStartNavigation = useCallback(() => {
    if (!start || !end || routePath.length < 2) return;

    if (isWechat()) {
      setWechatGuideOpen(true);
      return;
    }

    const platform = detectPlatform();

    // 差量精准途经点（六环外0点，迎风取辅路入口，出环前关门锚点保障绝对安全）
    const autoPoints = generateNavWaypoints({
      routePath,
      avoidedRisks,
      manualAvoidAreas,
      waypoints,
      ringFilter,
      maxWaypoints: 14,
    });

    const uri = buildAmapNavUri({
      start,
      end,
      waypoints: autoPoints,
      platform,
    });

    if (platform === 'web') {
      window.open(uri, '_blank');
    } else {
      // 移动端使用 deep link 唤起高德地图 App
      window.location.href = uri;
    }
  }, [start, end, routePath, avoidedRisks, manualAvoidAreas, waypoints, ringFilter]);

  return {
    canNavigate,
    wechatGuideOpen,
    setWechatGuideOpen,
    handleStartNavigation,
  };
}
