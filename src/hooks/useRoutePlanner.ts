// src/hooks/useRoutePlanner.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useRef, useState } from 'react';
import { scanPathRisks } from '@/lib/avoidance';
import type { CorridorSuggestion } from '@/lib/corridor';
import {
  evaluateRouteCache,
  routeCacheStorage,
} from '@/lib/storage';
import { hydrateCachedPlanToMap } from './routePlannerCacheHelper';
import type { DebugLog, LngLat, RouteRisk } from '@/lib/types';
import type { RoutePlanInput } from './routePlannerTypes';
export type { RoutePlanInput } from './routePlannerTypes';
import { checkAndBuildCorridorSuggestion } from './corridorSuggestionHelper';
import {
  buildLog,
  buildPolygonsFromRisks,
  MAX_ROUNDS,
  probeRoutePath,
  ROUND_DELAY_MS,
} from './routePlannerPathHelper';
import { processDrivingRouteResult, renderFallbackRoute } from './routeResultProcessor';

export function useRoutePlanner(
  AMap: any,
  map: any,
  input: RoutePlanInput,
) {
  const [planning, setPlanning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [routeRisks, setRouteRisks] = useState<RouteRisk[]>([]);
  const [avoidedRisks, setAvoidedRisks] = useState<RouteRisk[]>([]);
  const [safelyIgnoredRisks, setSafelyIgnoredRisks] = useState<RouteRisk[]>([]);
  const [deadRisks, setDeadRisks] = useState<RouteRisk[]>([]);
  const [routePath, setRoutePath] = useState<LngLat[]>([]);
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);
  const [corridorSuggestion, setCorridorSuggestion] = useState<CorridorSuggestion | null>(null);

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
          const suggestion = checkAndBuildCorridorSuggestion({
            current,
            finalPts: cached.routePath,
            finalRisks: cached.routeRisks,
            deadRisksCount: cached.deadRisks.length,
          });
          setCorridorSuggestion(suggestion);
          appendLog(0, `⚡ ${evaluation.reason || '已秒开恢复历史路线'}`, 'success');
          return true;
        }

        if (evaluation.status === 'STALE') {
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
          appendLog(0, `⚡ 规划于 ${evaluation.ageMinutes} 分钟前，正在自动刷新最新路况...`, 'info');
        } else if (evaluation.status === 'EXPIRED_PEAK') {
          appendLog(0, `⚠️ ${evaluation.reason}`, 'ignore');
        }
      }
    }

    setPlanning(true);
    setStatus(`规避分析 (1/${MAX_ROUNDS})`);
    setLogs([]);
    setDeadRisks([]);
    setCorridorSuggestion(null);
    appendLog(0, '启动全自动规避引擎...', 'info');

    clearOverlays();

    // 遵循“正常侦测优先”原则：默认仅采用当前设定的途经点
    const effectiveWaypoints = current.waypoints || [];

    const master = new Map<string, RouteRisk>();
    let newKeysThisRound: string[] = [];
    let success = false;

    try {
      for (let i = 0; i < MAX_ROUNDS; i++) {
        setStatus(`规避分析 (${i + 1}/${MAX_ROUNDS})`);
        if (i > 0) {
          await new Promise((res) => setTimeout(res, ROUND_DELAY_MS));
        }

        let roundAvoidSize: import('@/lib/avoidance').AvoidSize = current.riskAvoidSize ?? 'medium';
        if (i >= 7) {
          roundAvoidSize = 'tight';
          if (i === 7) appendLog(i + 1, '进入终极极限穿针引线 (15m)，释放微小平行支路...', 'info');
        } else if (i >= 5) {
          roundAvoidSize = roundAvoidSize === 'large' ? 'medium' : 'small';
          if (i === 5) appendLog(i + 1, '启动自适应收窄避让 (20m)，探测次级通路...', 'info');
        }

        const polygons = buildPolygonsFromRisks(
          Array.from(master.values()),
          current.ignoredRiskIds,
          current.forcedRiskIds,
          current.manualAvoidAreas,
          roundAvoidSize,
        );

        const points = await probeRoutePath(AMap, current.start, current.end, effectiveWaypoints, polygons);
        if (points.length === 0) {
          if (i === 0) {
            appendLog(1, '初始路线规划失败，请检查起终点连通性', 'error');
            break;
          }
          if (newKeysThisRound.length > 0) {
            for (const key of newKeysThisRound) master.delete(key);
          }
          appendLog(i + 1, '遇到物理唯一必经路段，已自动保留当前最大化绕行成果', 'ignore');
          break;
        }

        newKeysThisRound = [];
        const roundRisks = scanPathRisks(
          points,
          0.08,
          (cam) => {
            const id = `${cam.lng},${cam.lat}`;
            if (current.forcedRiskIds.has(id) && !master.has(id)) {
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
              newKeysThisRound.push(id);
            }
          },
          current.ringFilter ?? 'all',
          {
            avoidDeadPoints: current.avoidDeadPoints ?? false,
            forcedIds: current.forcedRiskIds,
          },
        );

        // 将本轮检测到的冲突风险加入 master 集合进行多边形动态阻断
        roundRisks.forEach((risk, key) => {
          if (current.ignoredRiskIds.has(key)) return;
          if (!master.has(key)) {
            master.set(key, risk);
            newKeysThisRound.push(key);
          }
        });

        if (newKeysThisRound.length === 0) {
          appendLog(i + 1, '当前路线已完全无冲突监控，规避已收敛', 'success');
          break;
        }

        appendLog(i + 1, `识别到 ${newKeysThisRound.length} 处新冲突，加入规避列表:`, 'warn');
        for (const key of newKeysThisRound) {
          const r = master.get(key);
          if (r) {
            const cleanName = r.name.replace(/\[\（方向待确认\）\]/g, '').trim();
            const dirLabel = r.direction ? ` [${r.direction}]` : '';
            appendLog(i + 1, `  ↳ 避让: ${cleanName}${dirLabel}`, 'warn');
          }
        }
      }

      setStatus('正在绘制最终最佳路线...');
      const masterList = Array.from(master.values());
      setAvoidedRisks(masterList);

      const finalPolygons = buildPolygonsFromRisks(
        masterList,
        current.ignoredRiskIds,
        current.forcedRiskIds,
        current.manualAvoidAreas,
        current.riskAvoidSize ?? 'medium',
      );

      const driving = new AMap.Driving({
        policy: AMap.DrivingPolicy.LEAST_TIME,
        map,
        showTraffic: true,
        autoFitView: true,
      });
      drivingRef.current = driving;

      if (finalPolygons.length > 0) {
        driving.setAvoidPolygons(
          finalPolygons.map((path) => path.map(([lng, lat]) => new AMap.LngLat(lng, lat))),
        );
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
        if (effectiveWaypoints.length > 0) {
          opts.waypoints = effectiveWaypoints.map((w) => new AMap.LngLat(w.lng, w.lat));
        }

        driving.search(
          new AMap.LngLat(current.start!.lng, current.start!.lat),
          new AMap.LngLat(current.end!.lng, current.end!.lat),
          opts,
          async (s: string, r: any) => {
            if (s === 'complete' && r?.routes?.[0]) {
              const route = r.routes[0];
              const result = processDrivingRouteResult(route, current);
              setRouteRisks(result.finalRisks);
              setSafelyIgnoredRisks(result.safelyIgnoredRisks);
              setDeadRisks(result.deadRisks);
              setRoutePath(result.finalPts);
              setRouteInfo({ distance: result.distance, duration: result.duration });
              appendLog(
                MAX_ROUNDS + 1,
                `路线完成：${(result.distance / 1000).toFixed(1)}km / ${Math.round(result.duration / 60)}分钟`,
                'info',
              );
              success = true;
              setFromCache(false);
              setCacheNotice(null);

              const suggestion = checkAndBuildCorridorSuggestion({
                current,
                finalPts: result.finalPts,
                finalRisks: result.finalRisks,
                deadRisksCount: result.deadRisks.length,
              });
              setCorridorSuggestion(suggestion);
              if (suggestion) {
                appendLog(
                  MAX_ROUNDS + 1,
                  `💡 检测到路线仍有 ${suggestion.unavoidedCount} 处监控未避开，建议绕行【${suggestion.corridorName}】`,
                  'info',
                );
              }

              try {
                routeCacheStorage.save(
                  { ...current, waypoints: effectiveWaypoints },
                  {
                    routeInfo: { distance: result.distance, duration: result.duration },
                    routePath: result.finalPts,
                    avoidedRisks: masterList,
                    routeRisks: result.finalRisks,
                    safelyIgnoredRisks: result.safelyIgnoredRisks,
                    deadRisks: result.deadRisks,
                    finalPolygons,
                  },
                );
              } catch {
                // 安全容错
              }
              resolve();
            } else if (finalPolygons.length > 0) {
              // 关键自愈兜底：带多边形被高德判定无路可走时，绝不白屏报错！
              // 立即释放多边形，渲染出一条连通基础路线，并立即激活六环建议！
              appendLog(MAX_ROUNDS + 1, '避让多边形阻断了全部连通通路，已自动释放阻断恢复基础路线', 'warn');
              clearOverlays();
              const fallback = await renderFallbackRoute(AMap, map, current, opts);
              if (fallback) {
                setRouteRisks(fallback.result.finalRisks);
                setSafelyIgnoredRisks(fallback.result.safelyIgnoredRisks);
                setDeadRisks(fallback.result.deadRisks);
                setRoutePath(fallback.result.finalPts);
                setRouteInfo({ distance: fallback.result.distance, duration: fallback.result.duration });
                success = true;
                setFromCache(false);
                setCacheNotice(null);

                const suggestion = checkAndBuildCorridorSuggestion({
                  current,
                  finalPts: fallback.result.finalPts,
                  finalRisks: fallback.result.finalRisks,
                  deadRisksCount: fallback.result.deadRisks.length,
                });
                setCorridorSuggestion(suggestion);
                if (suggestion) {
                  appendLog(
                    MAX_ROUNDS + 1,
                    `💡 地面道路已被监控完全阻断，强烈建议切换【${suggestion.corridorName}】`,
                    'info',
                  );
                }
              } else {
                appendLog(MAX_ROUNDS + 1, '起终点无法连通，请检查位置', 'error');
              }
              resolve();
            } else {
              appendLog(MAX_ROUNDS + 1, '起终点无法连通，请检查位置', 'error');
              resolve();
            }
          },
        );
      });
    } catch (err: any) {
      appendLog(MAX_ROUNDS + 1, `规划异常：${err.message || '未知错误'}`, 'error');
    } finally {
      setPlanning(false);
      setStatus(null);
    }
    return success;
  }, [AMap, map, appendLog, clearOverlays]);

  const applyCorridorSuggestion = useCallback(async () => {
    if (!corridorSuggestion) return;
    const newWaypoints = corridorSuggestion.waypoints;
    setCorridorSuggestion(null);
    await plan({ waypoints: newWaypoints, forceFresh: true });
  }, [corridorSuggestion, plan]);

  const dismissCorridorSuggestion = useCallback(() => {
    setCorridorSuggestion(null);
  }, []);

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
    corridorSuggestion,
    applyCorridorSuggestion,
    dismissCorridorSuggestion,
    plan,
    clearLogs,
  };
}
