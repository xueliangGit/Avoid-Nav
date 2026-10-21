// src/hooks/routePlannerPathHelper.ts
import { buildRiskPolygons, manualAreaToPolygon } from '@/lib/avoidance';
import type { AvoidSize } from '@/lib/avoidance';
import type { DebugLog, LngLat, ManualAvoidArea, RouteRisk, Waypoint } from '@/lib/types';

export const MAX_ROUNDS = 8;
export const MAX_AVOID_POLYGONS = 40;
export const ROUND_DELAY_MS = 800;

export function buildLog(round: number, message: string, type: DebugLog['type']): DebugLog {
  const timestamp = new Date().toLocaleTimeString();
  return { round, message, type, timestamp };
}

export function collectPathPoints(route: any): LngLat[] {
  const pts: LngLat[] = [];
  if (!route?.steps) return pts;
  for (const step of route.steps) {
    if (!step?.path) continue;
    for (const p of step.path) {
      pts.push({ lng: p.lng, lat: p.lat });
    }
  }
  return pts;
}

export function buildPolygonsFromRisks(
  risks: RouteRisk[],
  ignored: Set<string>,
  forced: Set<string>,
  manual: ManualAvoidArea[],
  size: AvoidSize,
): [number, number][][] {
  const polygons: [number, number][][] = [];

  for (const area of manual) {
    polygons.push(manualAreaToPolygon(area.lng, area.lat, area.size ?? 'medium'));
    if (polygons.length >= MAX_AVOID_POLYGONS) return polygons;
  }

  // 风险点先聚类合并成尽量少的包围盒，避免多边形过多触发高德 API 报错
  const active = risks.filter((r) => !ignored.has(r.id));
  const riskPolygons = buildRiskPolygons(active, forced, size);
  for (const poly of riskPolygons) {
    polygons.push(poly);
    if (polygons.length >= MAX_AVOID_POLYGONS) break;
  }

  return polygons;
}

export function toLngLatArray(AMap: any, polygons: [number, number][][]): any[][] {
  return polygons.map((path) => path.map(([lng, lat]) => new AMap.LngLat(lng, lat)));
}

/** 探测路径，支持 10021 QPS 限制指数退避重试 */
export async function probeRoutePath(
  AMap: any,
  start: LngLat,
  end: LngLat,
  waypoints: Waypoint[],
  polygons: [number, number][][],
  attempt = 0,
): Promise<LngLat[]> {
  return new Promise((resolve) => {
    const driving = new AMap.Driving({ policy: AMap.DrivingPolicy.LEAST_TIME });
    if (polygons.length > 0) {
      driving.setAvoidPolygons(toLngLatArray(AMap, polygons));
    }
    const opts: any = {};
    if (waypoints.length > 0) {
      opts.waypoints = waypoints.map((w) => new AMap.LngLat(w.lng, w.lat));
    }
    driving.search(
      new AMap.LngLat(start.lng, start.lat),
      new AMap.LngLat(end.lng, end.lat),
      opts,
      async (s: string, r: any) => {
        if (s === 'complete' && r?.routes?.[0]) {
          resolve(collectPathPoints(r.routes[0]));
          return;
        }
        const isQpsLimit =
          r?.info === 'CUQPS_HAS_EXCEEDED_THE_LIMIT' ||
          r?.infocode === '10021' ||
          (typeof r === 'string' && r.includes('10021'));
        if (isQpsLimit && attempt < 3) {
          await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
          const retryPoints = await probeRoutePath(AMap, start, end, waypoints, polygons, attempt + 1);
          resolve(retryPoints);
          return;
        }
        resolve([]);
      },
    );
  });
}
