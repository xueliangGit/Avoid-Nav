'use client';

import { useCallback, useRef, useState } from 'react';
import { manualAreaToPolygon, pointToAvoidPolygon, scanPathRisks } from '@/lib/avoidance';
import type {
  DebugLog,
  LngLat,
  ManualAvoidArea,
  PlaceItem,
  RouteRisk,
  Waypoint,
} from '@/lib/types';

export interface RoutePlanInput {
  start: PlaceItem | null;
  end: PlaceItem | null;
  waypoints: Waypoint[];
  ignoredRiskIds: Set<string>;
  forcedRiskIds: Set<string>;
  manualAvoidAreas: ManualAvoidArea[];
}

export interface RoutePlanState {
  planning: boolean;
  status: string | null;
  routeRisks: RouteRisk[];
  avoidedRisks: RouteRisk[];
  safelyIgnoredRisks: RouteRisk[];
  routePath: LngLat[];
  logs: DebugLog[];
  routeInfo: { distance: number; duration: number } | null;
}

export interface UseRoutePlannerResult extends RoutePlanState {
  /** 返回是否最终生成了可用路线 */
  plan: (override?: Partial<RoutePlanInput>) => Promise<boolean>;
  clearLogs: () => void;
}

const MAX_ROUNDS = 5;
const MAX_AVOID_POLYGONS = 40;
const ROUND_DELAY_MS = 1200;

interface PathPoint extends LngLat {}

function nowStamp(): string {
  return new Date().toLocaleTimeString();
}

function buildLog(round: number, message: string, type: DebugLog['type']): DebugLog {
  return { round, message, type, timestamp: nowStamp() };
}

function collectPathPoints(route: any): PathPoint[] {
  const pts: PathPoint[] = [];
  if (!route?.steps) return pts;
  for (const step of route.steps) {
    if (!step?.path) continue;
    for (const p of step.path) {
      pts.push({ lng: p.lng, lat: p.lat });
    }
  }
  return pts;
}

function buildPolygonsFromRisks(
  risks: RouteRisk[],
  ignored: Set<string>,
  forced: Set<string>,
  manual: ManualAvoidArea[],
): [number, number][][] {
  const polygons: [number, number][][] = [];

  for (const area of manual) {
    polygons.push(manualAreaToPolygon(area.lng, area.lat, area.size ?? 'medium'));
    if (polygons.length >= MAX_AVOID_POLYGONS) return polygons;
  }

  for (const r of risks) {
    if (ignored.has(r.id)) continue;
    // 强制避让的点忽略方向（按双向处理），其余按方向矩形
    const isForced = forced.has(r.id);
    polygons.push(pointToAvoidPolygon(r.lng, r.lat, isForced ? undefined : r.direction));
    if (polygons.length >= MAX_AVOID_POLYGONS) break;
  }

  return polygons;
}

function toLngLatArray(AMap: any, polygons: [number, number][][]): any[][] {
  return polygons.map((path) => path.map(([lng, lat]) => new AMap.LngLat(lng, lat)));
}

export function useRoutePlanner(
  AMap: any,
  map: any,
  input: RoutePlanInput,
): UseRoutePlannerResult {
  const [planning, setPlanning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [routeRisks, setRouteRisks] = useState<RouteRisk[]>([]);
  const [avoidedRisks, setAvoidedRisks] = useState<RouteRisk[]>([]);
  const [safelyIgnoredRisks, setSafelyIgnoredRisks] = useState<RouteRisk[]>([]);
  const [routePath, setRoutePath] = useState<LngLat[]>([]);
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(
    null,
  );

  const drivingRef = useRef<any>(null);
  const polygonOverlaysRef = useRef<any[]>([]);
  const inputRef = useRef<RoutePlanInput>(input);
  inputRef.current = input;

  const appendLog = useCallback((round: number, message: string, type: DebugLog['type']) => {
    setLogs((prev) => [...prev, buildLog(round, message, type)]);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const clearOverlays = useCallback(() => {
    if (drivingRef.current?.clear) {
      drivingRef.current.clear();
    }
    drivingRef.current = null;
    for (const poly of polygonOverlaysRef.current) {
      if (poly?.setMap) poly.setMap(null);
    }
    polygonOverlaysRef.current = [];
  }, []);

  const probeRoute = useCallback(
    (
      start: LngLat,
      end: LngLat,
      waypoints: Waypoint[],
      polygons: [number, number][][],
    ): Promise<PathPoint[]> => {
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
          (s: string, r: any) => {
            if (s !== 'complete' || !r?.routes?.[0]) {
              resolve([]);
              return;
            }
            resolve(collectPathPoints(r.routes[0]));
          },
        );
      });
    },
    [AMap],
  );

  const plan = useCallback(async (override?: Partial<RoutePlanInput>): Promise<boolean> => {
    const current = { ...inputRef.current, ...(override ?? {}) } as RoutePlanInput;
    if (!AMap || !map || !current.start || !current.end) return false;

    setPlanning(true);
    setStatus('Round 1');
    setLogs([]);
    appendLog(0, '启动全自动规避引擎...', 'info');

    clearOverlays();

    const master = new Map<string, RouteRisk>();
    let lastPath: PathPoint[] = [];
    let success = false;

    try {
      for (let i = 0; i < MAX_ROUNDS; i++) {
        setStatus(`Round ${i + 1}`);
        if (i > 0) {
          await new Promise((res) => setTimeout(res, ROUND_DELAY_MS));
        }

        const polygons = buildPolygonsFromRisks(
          Array.from(master.values()),
          current.ignoredRiskIds,
          current.forcedRiskIds,
          current.manualAvoidAreas,
        );

        const points = await probeRoute(
          current.start,
          current.end,
          current.waypoints,
          polygons,
        );

        if (points.length === 0) {
          appendLog(i + 1, '路线规划失败', 'error');
          break;
        }

        lastPath = points;

        const roundRisks = scanPathRisks(points, 0.08, (cam, car, target) => {
          const id = `${cam.lng},${cam.lat}`;
          if (current.forcedRiskIds.has(id)) {
            // 用户强制避让 → 即便方向不冲突也加入 master
            if (!master.has(id)) {
              master.set(id, {
                id,
                lng: cam.lng,
                lat: cam.lat,
                name: cam.name,
                type: cam.type,
                risk: cam.risk,
                href: cam.href,
                direction: cam.direction,
              });
              appendLog(i + 1, `[强制避让] ${cam.name}`, 'success');
            }
          } else {
            appendLog(
              i + 1,
              `[安全忽略] ${cam.name} (行驶 ${car}° vs 监控 ${target ?? '?'}°)`,
              'ignore',
            );
          }
        });

        let foundNew = false;
        roundRisks.forEach((risk, key) => {
          if (current.ignoredRiskIds.has(key)) return;
          if (!master.has(key)) {
            master.set(key, risk);
            foundNew = true;
            appendLog(i + 1, `[发现风险] ${risk.name}`, 'success');
          }
        });

        if (!foundNew) {
          appendLog(i + 1, '路径已安全规避', 'success');
          break;
        }
      }

      const masterList = Array.from(master.values());
      setAvoidedRisks(masterList);

      setStatus('Finalizing...');

      const finalPolygons = buildPolygonsFromRisks(
        masterList,
        current.ignoredRiskIds,
        current.forcedRiskIds,
        current.manualAvoidAreas,
      );

      const driving = new AMap.Driving({
        map,
        policy: AMap.DrivingPolicy.LEAST_TIME,
      });
      drivingRef.current = driving;

      if (finalPolygons.length > 0) {
        driving.setAvoidPolygons(toLngLatArray(AMap, finalPolygons));
        for (const polyPath of finalPolygons) {
          const poly = new AMap.Polygon({
            path: polyPath.map(([lng, lat]) => new AMap.LngLat(lng, lat)),
            fillColor: '#ef4444',
            fillOpacity: 0.18,
            strokeColor: '#ef4444',
            strokeWeight: 1,
          });
          map.add(poly);
          polygonOverlaysRef.current.push(poly);
        }
      }

      await new Promise<void>((resolve) => {
        const opts: any = {};
        if (current.waypoints.length > 0) {
          opts.waypoints = current.waypoints.map(
            (w) => new AMap.LngLat(w.lng, w.lat),
          );
        }
        driving.search(
          new AMap.LngLat(current.start!.lng, current.start!.lat),
          new AMap.LngLat(current.end!.lng, current.end!.lat),
          opts,
          (s: string, r: any) => {
            if (s === 'complete' && r?.routes?.[0]) {
              const route = r.routes[0];
              const finalPts = collectPathPoints(route);
              const safelyIgnoredMap = new Map<string, RouteRisk>();
              const finalRiskMap = scanPathRisks(finalPts, 0.08, (cam) => {
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
              });
              const finalRisks: RouteRisk[] = [];
              finalRiskMap.forEach((risk, key) => {
                if (!current.ignoredRiskIds.has(key)) finalRisks.push(risk);
              });
              setRouteRisks(finalRisks);
              setSafelyIgnoredRisks(Array.from(safelyIgnoredMap.values()));
              setRoutePath(finalPts);
              setRouteInfo({
                distance: route.distance ?? 0,
                duration: route.time ?? 0,
              });
              appendLog(
                MAX_ROUNDS + 1,
                `路线完成：${(route.distance / 1000).toFixed(1)}km / ${Math.round(route.time / 60)}分钟`,
                'info',
              );
              success = true;
            } else {
              appendLog(MAX_ROUNDS + 1, '最终路线渲染失败', 'error');
            }
            resolve();
          },
        );
      });
    } finally {
      setStatus(null);
      setPlanning(false);
    }
    return success;
  }, [AMap, map, appendLog, clearOverlays, probeRoute]);

  return {
    planning,
    status,
    routeRisks,
    avoidedRisks,
    safelyIgnoredRisks,
    routePath,
    logs,
    routeInfo,
    plan,
    clearLogs,
  };
}
