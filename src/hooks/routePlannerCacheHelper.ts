// src/hooks/routePlannerCacheHelper.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CachedRoutePlan } from '@/lib/storage/routeCacheTypes';
import type { LngLat, RouteRisk } from '@/lib/types';

interface StateSetters {
  setRouteRisks: (risks: RouteRisk[]) => void;
  setAvoidedRisks: (risks: RouteRisk[]) => void;
  setSafelyIgnoredRisks: (risks: RouteRisk[]) => void;
  setDeadRisks: (risks: RouteRisk[]) => void;
  setRoutePath: (pts: LngLat[]) => void;
  setRouteInfo: (info: { distance: number; duration: number } | null) => void;
}

/**
 * 将缓存的规划路线与避让多边形恢复渲染到高德地图和 React 状态
 */
export function hydrateCachedPlanToMap(
  AMap: any,
  map: any,
  cache: CachedRoutePlan,
  overlayContainer: any[],
  setters: StateSetters,
): void {
  if (!AMap || !map) return;

  // 1. 恢复 React 状态数据
  setters.setRouteRisks(cache.routeRisks || []);
  setters.setAvoidedRisks(cache.avoidedRisks || []);
  setters.setSafelyIgnoredRisks(cache.safelyIgnoredRisks || []);
  setters.setDeadRisks(cache.deadRisks || []);
  setters.setRoutePath(cache.routePath || []);
  setters.setRouteInfo(cache.routeInfo || null);

  // 2. 在地图上还原避让多边形包围盒
  const newOverlays: any[] = [];
  if (cache.finalPolygons && cache.finalPolygons.length > 0) {
    for (const polyPath of cache.finalPolygons) {
      const poly = new AMap.Polygon({
        path: polyPath.map(([lng, lat]) => new AMap.LngLat(lng, lat)),
        fillColor: '#ef4444',
        fillOpacity: 0.18,
        strokeColor: '#ef4444',
        strokeWeight: 1,
      });
      map.add(poly);
      newOverlays.push(poly);
    }
  }

  // 3. 在地图上还原路线折线轨迹
  if (cache.routePath && cache.routePath.length > 1) {
    const linePath = cache.routePath.map((p) => new AMap.LngLat(p.lng, p.lat));
    const polyline = new AMap.Polyline({
      map,
      path: linePath,
      strokeColor: '#2563eb',
      strokeOpacity: 0.9,
      strokeWeight: 6,
      lineJoin: 'round',
      lineCap: 'round',
      showDir: true,
      zIndex: 50,
    });
    newOverlays.push(polyline);

    // 平滑自适应最佳视口
    try {
      map.setFitView(newOverlays, false, [60, 40, 100, 40]);
    } catch {
      // 容错处理
    }
  }

  // 存入清理容器以便下次规划时统一清除
  overlayContainer.push(...newOverlays);
}
