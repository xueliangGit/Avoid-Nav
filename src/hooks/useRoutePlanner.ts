'use client';

import { useCallback, useRef, useState } from 'react';
import { scanPathRisks } from '@/lib/avoidance';
import type { AvoidSize } from '@/lib/avoidance';
import { evaluateRouteCache, routeCacheStorage } from '@/lib/storage';
import { hydrateCachedPlanToMap } from './routePlannerCacheHelper';
import {
  MAX_ROUNDS,
  ROUND_DELAY_MS,
  buildLog,
  buildPolygonsFromRisks,
  collectPathPoints,
  probeRoutePath,
  toLngLatArray,
} from './routePlannerPathHelper';
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
  /** 自动风险点避让矩形尺寸，默认 medium */
  riskAvoidSize: AvoidSize;
  /** 六环内外筛选：仅避让六环内/外/全部 */
  ringFilter: import('@/lib/types').RingFilter;
  /** 失效点(aa=4)是否也自动避让，默认 false */
  avoidDeadPoints: boolean;
  /** 是否强制全量重算跳过缓存，默认 false */
  forceFresh?: boolean;
}

export interface RoutePlanState {
  planning: boolean;
  status: string | null;
  routeRisks: RouteRisk[];
  avoidedRisks: RouteRisk[];
  safelyIgnoredRisks: RouteRisk[];
  /** 路线上的失效点(默认不避让)，供用户手动选择是否避让 */
  deadRisks: RouteRisk[];
  routePath: LngLat[];
  logs: DebugLog[];
  routeInfo: { distance: number; duration: number } | null;
  /** 当前路线是否由历史缓存秒开提供 */
  fromCache: boolean;
  /** 缓存时效提示信息 */
  cacheNotice: string | null;
}

export interface UseRoutePlannerResult extends RoutePlanState {
  /** 返回是否最终生成了可用路线 */
  plan: (override?: Partial<RoutePlanInput>) => Promise<boolean>;
  clearLogs: () => void;
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
  const [deadRisks, setDeadRisks] = useState<RouteRisk[]>([]);
  const [routePath, setRoutePath] = useState<LngLat[]>([]);
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(
    null,
  );
  const [fromCache, setFromCache] = useState(false);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);

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

  const plan = useCallback(async (override?: Partial<RoutePlanInput>): Promise<boolean> => {
    const current = { ...inputRef.current, ...(override ?? {}) } as RoutePlanInput;
    if (!AMap || !map || !current.start || !current.end) return false;

    // 1. 检查是否存在可复用的历史规划缓存
    const isForceFresh = Boolean(override?.forceFresh);
    if (!isForceFresh) {
      const cached = routeCacheStorage.find(current);
      if (cached) {
        const evaluation = evaluateRouteCache(cached);
        if (evaluation.status === 'FRESH') {
          // 完全新鲜：0毫秒秒开还原并直接返回
          clearOverlays();
          setPlanning(false);
          setStatus(null);
          setFromCache(true);
          setCacheNotice(evaluation.reason || '已秒开历史路线');
          hydrateCachedPlanToMap(AMap, map, cached, polygonOverlaysRef.current, {
            setRouteRisks,
            setAvoidedRisks,
            setSafelyIgnoredRisks,
            setDeadRisks,
            setRoutePath,
            setRouteInfo,
          });
          appendLog(0, `⚡ ${evaluation.reason || '已秒开恢复历史路线'}`, 'success');
          return true;
        }

        if (evaluation.status === 'STALE') {
          // 时间久了：先秒开旧路线防白屏，同时后台无缝自动刷新最新路况
          clearOverlays();
          setFromCache(true);
          setCacheNotice(evaluation.reason || '路况变化中，正在自动刷新...');
          hydrateCachedPlanToMap(AMap, map, cached, polygonOverlaysRef.current, {
            setRouteRisks,
            setAvoidedRisks,
            setSafelyIgnoredRisks,
            setDeadRisks,
            setRoutePath,
            setRouteInfo,
          });
          appendLog(
            0,
            `⚡ 规划于 ${evaluation.ageMinutes} 分钟前，正在自动刷新最新路况...`,
            'info',
          );
        } else if (evaluation.status === 'EXPIRED_PEAK') {
          appendLog(0, `⚠️ ${evaluation.reason}`, 'ignore');
        }
      }
    }

    setPlanning(true);
    setStatus(`规避分析 (1/${MAX_ROUNDS})`);
    setLogs([]);
    setDeadRisks([]);
    appendLog(0, '启动全自动规避引擎...', 'info');

    clearOverlays();

    const master = new Map<string, RouteRisk>();
    let success = false;

    try {
      for (let i = 0; i < MAX_ROUNDS; i++) {
        setStatus(`规避分析 (${i + 1}/${MAX_ROUNDS})`);
        if (i > 0) {
          await new Promise((res) => setTimeout(res, ROUND_DELAY_MS));
        }

        const polygons = buildPolygonsFromRisks(
          Array.from(master.values()),
          current.ignoredRiskIds,
          current.forcedRiskIds,
          current.manualAvoidAreas,
          current.riskAvoidSize ?? 'medium',
        );

        const points = await probeRoutePath(
          AMap,
          current.start,
          current.end,
          current.waypoints,
          polygons,
        );

        if (points.length === 0) {
          appendLog(i + 1, '路线规划失败', 'error');
          break;
        }

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
        }, current.ringFilter ?? 'all', {
          avoidDeadPoints: current.avoidDeadPoints ?? false,
          forcedIds: current.forcedRiskIds,
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

      setStatus('渲染最优路线');

      const finalPolygons = buildPolygonsFromRisks(
        masterList,
        current.ignoredRiskIds,
        current.forcedRiskIds,
        current.manualAvoidAreas,
        current.riskAvoidSize ?? 'medium',
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
              const deadMap = new Map<string, RouteRisk>();
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
              }, current.ringFilter ?? 'all', {
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
              });
              const finalRisks: RouteRisk[] = [];
              finalRiskMap.forEach((risk, key) => {
                if (!current.ignoredRiskIds.has(key)) finalRisks.push(risk);
              });
              setRouteRisks(finalRisks);
              setSafelyIgnoredRisks(Array.from(safelyIgnoredMap.values()));
              setDeadRisks(Array.from(deadMap.values()));
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
              setFromCache(false);
              setCacheNotice(null);

              // 自动持久化到规划缓存
              try {
                routeCacheStorage.save(current, {
                  routeInfo: {
                    distance: route.distance ?? 0,
                    duration: route.time ?? 0,
                  },
                  routePath: finalPts,
                  avoidedRisks: masterList,
                  routeRisks: finalRisks,
                  safelyIgnoredRisks: Array.from(safelyIgnoredMap.values()),
                  deadRisks: Array.from(deadMap.values()),
                  finalPolygons,
                });
              } catch {
                // 安全容错
              }
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
  }, [AMap, map, appendLog, clearOverlays]);

  return {
    planning,
    status,
    routeRisks,
    avoidedRisks,
    safelyIgnoredRisks,
    deadRisks,
    routePath,
    logs,
    routeInfo,
    fromCache,
    cacheNotice,
    plan,
    clearLogs,
  };
}
