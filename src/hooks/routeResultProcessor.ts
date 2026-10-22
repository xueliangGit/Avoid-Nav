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
