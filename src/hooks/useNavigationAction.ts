'use client';

import { useCallback, useState } from 'react';
import { extractKeyPoints } from '@/lib/utils/path-keypoints';
import { buildAmapNavUri, detectPlatform, isWechat } from '@/lib/navigation';
import type { LngLat, PlaceItem } from '@/lib/types';

interface UseNavigationActionProps {
  start: PlaceItem | null;
  end: PlaceItem | null;
  routePath: LngLat[];
  planning: boolean;
}

export function useNavigationAction({
  start,
  end,
  routePath,
  planning,
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

    // 途经点 = 避让后路径上的 RDP 关键点
    const autoPoints = extractKeyPoints(routePath, 14).map((p, i) => ({
      lng: p.lng,
      lat: p.lat,
      name: `关键点${i + 1}`,
    }));

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
  }, [start, end, routePath]);

  return {
    canNavigate,
    wechatGuideOpen,
    setWechatGuideOpen,
    handleStartNavigation,
  };
}
