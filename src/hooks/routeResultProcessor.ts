// src/hooks/routeResultProcessor.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { scanPathRisks } from '@/lib/avoidance';
import type { LngLat, RouteRisk } from '@/lib/types';
import type { RoutePlanInput } from './routePlannerTypes';
import { collectPathPoints } from './routePlannerPathHelper';

export interface ProcessRouteResultOutput {
  finalPts: LngLat[];
  finalRisks: RouteRisk[];
  safelyIgnoredRisks: RouteRisk[];
  deadRisks: RouteRisk[];
  distance: number;
  duration: number;
}

/**
 * 解析并扫描高德路线的终态监控风险分布
 */
export function processDrivingRouteResult(
  route: any,
  current: RoutePlanInput,
): ProcessRouteResultOutput {
  const finalPts = collectPathPoints(route);
  const safelyIgnoredMap = new Map<string, RouteRisk>();
  const deadMap = new Map<string, RouteRisk>();

  const finalRiskMap = scanPathRisks(
    finalPts,
    0.08,
    (cam) => {
      const id = `${cam.lng},${cam.lat}`;
      if (current.forcedRiskIds.has(id)) return;
      if (safelyIgnoredMap.has(id)) return;
      safelyIgnoredMap.set(id, {
        id,
        lng: cam.lng,
        lat: cam.lat,
        name: cam.name,
        type: cam.type,
        risk: cam.risk,
        href: cam.href,
        direction: cam.direction,
      });
    },
    current.ringFilter ?? 'all',
    {
      avoidDeadPoints: current.avoidDeadPoints ?? false,
      forcedIds: current.forcedRiskIds,
      onDead: (cam) => {
        const id = `${cam.lng},${cam.lat}`;
        if (current.ignoredRiskIds.has(id) || deadMap.has(id)) return;
        deadMap.set(id, {
          id,
          lng: cam.lng,
          lat: cam.lat,
          name: cam.name,
          type: cam.type,
          risk: cam.risk,
          href: cam.href,
          direction: cam.direction,
        });
      },
    },
  );

  const finalRisks: RouteRisk[] = [];
  finalRiskMap.forEach((risk, key) => {
    if (!current.ignoredRiskIds.has(key)) finalRisks.push(risk);
  });

  return {
    finalPts,
    finalRisks,
    safelyIgnoredRisks: Array.from(safelyIgnoredMap.values()),
    deadRisks: Array.from(deadMap.values()),
    distance: route.distance ?? 0,
    duration: route.time ?? 0,
  };
}

/**
 * 降级保底渲染：当避让多边形过多导致高德物理断路时，
 * 立即释放多边形并重新搜索一条连通的基础路线，确保 100% 不白屏报错
 */
export function renderFallbackRoute(
  AMap: any,
  map: any,
  current: RoutePlanInput,
  opts: any,
): Promise<{ route: any; result: ProcessRouteResultOutput } | null> {
  return new Promise((resolve) => {
    const fallbackDriving = new AMap.Driving({
      policy: AMap.DrivingPolicy.LEAST_TIME,
      map,
      showTraffic: true,
      autoFitView: true,
    });
    fallbackDriving.search(
      new AMap.LngLat(current.start!.lng, current.start!.lat),
      new AMap.LngLat(current.end!.lng, current.end!.lat),
      opts,
      (fbStatus: string, fbResult: any) => {
        if (fbStatus === 'complete' && fbResult?.routes?.[0]) {
          const route = fbResult.routes[0];
          const result = processDrivingRouteResult(route, current);
          resolve({ route, result });
        } else {
          resolve(null);
        }
      },
    );
  });
}
