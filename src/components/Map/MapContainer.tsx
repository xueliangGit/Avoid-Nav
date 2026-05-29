'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAMap } from '@/hooks/useAMap';
import { useRoutePlanner } from '@/hooks/useRoutePlanner';
import type {
  PlaceItem,
  Waypoint,
  ManualAvoidArea,
  LngLat,
} from '@/lib/types';
import ControlPanel, { type InteractionMode, type RouteInfo } from './ControlPanel';
import DebugPanel from './DebugPanel';

// 高德 AutoComplete 选择事件 payload 的最小契约
interface AutoCompleteSelectEvent {
  poi?: {
    name?: string;
    location?: { lng: number; lat: number };
    adcode?: string;
  };
}

// 高德 Map click 事件最小契约
interface AMapClickEvent {
  lnglat: { lng: number; lat: number };
}

// AMap.PlaceSearch 反查地址回调 payload 最小契约
interface RegeocodeResult {
  regeocode?: {
    formattedAddress?: string;
  };
}

const MAP_CONTAINER_ID = 'container';

const makeId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const MapContainer = () => {
  const { AMap, map, ready, userLocation, error } = useAMap(MAP_CONTAINER_ID);

  // 起终点 & 输入状态
  const [start, setStart] = useState<PlaceItem | null>(null);
  const [end, setEnd] = useState<PlaceItem | null>(null);

  // 途经点 / 手动避让区 / 忽略风险
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [manualAvoidAreas, setManualAvoidAreas] = useState<ManualAvoidArea[]>([]);
  const [ignoredRiskIds, setIgnoredRiskIds] = useState<Set<string>>(new Set());

  // 当前地图点击模式
  const [mode, setMode] = useState<InteractionMode>('none');
  // 最新 mode（避免闭包陷阱）
  const modeRef = useRef<InteractionMode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // —— 路线规划 hook ——
  const plannerInput = useMemo(
    () => ({ start, end, waypoints, ignoredRiskIds, manualAvoidAreas }),
    [start, end, waypoints, ignoredRiskIds, manualAvoidAreas]
  );

  const {
    planning,
    status,
    routeRisks,
    avoidedRisks,
    logs,
    routeInfo,
    plan,
  } = useRoutePlanner(AMap, map, plannerInput);

  // —— 绑定 AutoComplete（在 AMap & map 就绪后） ——
  const autoCompleteRefs = useRef<{ start: unknown; end: unknown }>({
    start: null,
    end: null,
  });

  useEffect(() => {
    if (!ready || !AMap || !map) return;
    // 高德 AMap 对象通过 hook 注入，运行时类型由 @types/amap-js-api 提供
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const A = AMap as any;

    const autoStart = new A.AutoComplete({ input: 'start-input' });
    const autoEnd = new A.AutoComplete({ input: 'end-input' });

    const onStartSelect = (e: AutoCompleteSelectEvent) => {
      if (e.poi?.location && e.poi.name) {
        setStart({
          lng: e.poi.location.lng,
          lat: e.poi.location.lat,
          name: e.poi.name,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (map as any).setCenter([e.poi.location.lng, e.poi.location.lat]);
      }
    };
    const onEndSelect = (e: AutoCompleteSelectEvent) => {
      if (e.poi?.location && e.poi.name) {
        setEnd({
          lng: e.poi.location.lng,
          lat: e.poi.location.lat,
          name: e.poi.name,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (map as any).setCenter([e.poi.location.lng, e.poi.location.lat]);
      }
    };

    autoStart.on('select', onStartSelect);
    autoEnd.on('select', onEndSelect);

    autoCompleteRefs.current = { start: autoStart, end: autoEnd };

    return () => {
      autoStart.off?.('select', onStartSelect);
      autoEnd.off?.('select', onEndSelect);
    };
  }, [ready, AMap, map]);

  // —— 地图点击：根据 mode 决定行为 ——
  useEffect(() => {
    if (!ready || !AMap || !map) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const A = AMap as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const M = map as any;

    const placeSearch = new A.PlaceSearch({});

    const reverseGeocode = (lnglat: LngLat): Promise<string> => {
      return new Promise((resolve) => {
        try {
          const geocoder = new A.Geocoder();
          geocoder.getAddress(
            [lnglat.lng, lnglat.lat],
            (status: string, result: RegeocodeResult) => {
              if (status === 'complete' && result?.regeocode?.formattedAddress) {
                resolve(result.regeocode.formattedAddress);
              } else {
                resolve(`${lnglat.lng.toFixed(5)}, ${lnglat.lat.toFixed(5)}`);
              }
            }
          );
        } catch {
          // PlaceSearch.searchNearBy 作为兜底
          placeSearch.searchNearBy?.(
            '',
            [lnglat.lng, lnglat.lat],
            200,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (status: string, result: any) => {
              const poi = result?.poiList?.pois?.[0];
              if (status === 'complete' && poi?.name) resolve(poi.name);
              else resolve(`${lnglat.lng.toFixed(5)}, ${lnglat.lat.toFixed(5)}`);
            }
          );
        }
      });
    };

    const onClick = async (e: AMapClickEvent) => {
      const currentMode = modeRef.current;
      if (currentMode === 'none') return;
      const point: LngLat = { lng: e.lnglat.lng, lat: e.lnglat.lat };

      if (currentMode === 'add-waypoint') {
        const name = await reverseGeocode(point);
        setWaypoints((prev) => [
          ...prev,
          { id: makeId('wp'), lng: point.lng, lat: point.lat, name },
        ]);
      } else if (currentMode === 'add-avoid') {
        const label = `避让区 ${Date.now().toString().slice(-4)}`;
        setManualAvoidAreas((prev) => [
          ...prev,
          { id: makeId('avoid'), lng: point.lng, lat: point.lat, label },
        ]);
      }
      // 单次点击后退出模式
      setMode('none');
    };

    M.on('click', onClick);
    return () => {
      M.off('click', onClick);
    };
  }, [ready, AMap, map]);

  // —— 自动用 userLocation 填充起点（仅在 start 仍为空时） ——
  useEffect(() => {
    if (userLocation && !start) {
      setStart({ lng: userLocation.lng, lat: userLocation.lat, name: '我的位置' });
    }
  }, [userLocation, start]);

  // —— 回调 ——
  const handleUseMyLocation = useCallback(() => {
    if (!userLocation) return;
    setStart({ lng: userLocation.lng, lat: userLocation.lat, name: '我的位置' });
  }, [userLocation]);

  const handleRemoveWaypoint = useCallback((id: string) => {
    setWaypoints((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const handleRemoveAvoidArea = useCallback((id: string) => {
    setManualAvoidAreas((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleToggleAddWaypoint = useCallback(() => {
    setMode((m) => (m === 'add-waypoint' ? 'none' : 'add-waypoint'));
  }, []);

  const handleToggleAddAvoid = useCallback(() => {
    setMode((m) => (m === 'add-avoid' ? 'none' : 'add-avoid'));
  }, []);

  const handleToggleIgnoreRisk = useCallback((id: string) => {
    setIgnoredRiskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handlePlan = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const A = AMap as any;
    if (!A) return;

    let s = start;
    let e = end;

    // 兜底：如果用户输入了文字但没从下拉中选择，
    // 用 PlaceSearch 把文字解析成第一个匹配的 POI。
    const startInput = document.getElementById('start-input') as HTMLInputElement | null;
    const endInput = document.getElementById('end-input') as HTMLInputElement | null;
    const startText = startInput?.value?.trim() ?? '';
    const endText = endInput?.value?.trim() ?? '';

    const lookup = (keyword: string): Promise<PlaceItem | null> =>
      new Promise((resolve) => {
        try {
          const ps = new A.PlaceSearch({ city: '北京', pageSize: 1, extensions: 'base' });
          ps.search(keyword, (status: string, result: any) => {
            const poi = result?.poiList?.pois?.[0];
            if (status === 'complete' && poi?.location) {
              resolve({
                lng: poi.location.lng,
                lat: poi.location.lat,
                name: poi.name ?? keyword,
              });
            } else {
              resolve(null);
            }
          });
        } catch {
          resolve(null);
        }
      });

    if (!s && startText) {
      s = await lookup(startText);
      if (s) setStart(s);
    }
    if (!e && endText) {
      e = await lookup(endText);
      if (e) setEnd(e);
    }

    if (!s || !e) {
      // eslint-disable-next-line no-console
      console.warn('[规划] 起点或终点未设置', { s, e });
      return;
    }

    // 直接把最新的 s/e 传给 plan 作为 override，避免依赖 setState 后才同步的 inputRef
    void plan({ start: s, end: e });
  }, [AMap, start, end, plan]);

  const handleClearStart = useCallback(() => setStart(null), []);
  const handleClearEnd = useCallback(() => setEnd(null), []);

  const handleSwapEndpoints = useCallback(() => {
    setStart(end);
    setEnd(start);
  }, [start, end]);

  // 点击风险点 → 飞到地图位置 + 闪烁圆环
  const handleFocusRisk = useCallback(
    (risk: { lng: number; lat: number; name: string }) => {
      if (!AMap || !map) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const A = AMap as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const M = map as any;

      M.setZoomAndCenter?.(16, [risk.lng, risk.lat]) ??
        M.setCenter([risk.lng, risk.lat]);

      const circle = new A.Circle({
        center: [risk.lng, risk.lat],
        radius: 60,
        strokeColor: '#fbbf24',
        strokeWeight: 3,
        strokeOpacity: 0.9,
        fillColor: '#fbbf24',
        fillOpacity: 0.25,
        zIndex: 5000,
      });
      M.add(circle);

      let pulses = 0;
      const maxPulses = 6;
      const interval = window.setInterval(() => {
        pulses += 1;
        const visible = pulses % 2 === 0;
        circle.setOptions?.({
          strokeOpacity: visible ? 0.9 : 0,
          fillOpacity: visible ? 0.25 : 0,
        });
        if (pulses >= maxPulses) {
          window.clearInterval(interval);
          M.remove(circle);
        }
      }, 350);
    },
    [AMap, map],
  );

  // 地图的鼠标样式根据 mode 改变（视觉提示）
  const mapCursor =
    mode === 'add-waypoint'
      ? 'crosshair'
      : mode === 'add-avoid'
      ? 'crosshair'
      : 'default';

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-900 overflow-hidden text-slate-200">
      {/* 左侧控制面板 */}
      <ControlPanel
        start={start}
        end={end}
        waypoints={waypoints}
        manualAvoidAreas={manualAvoidAreas}
        avoidedRisks={avoidedRisks}
        routeRisks={routeRisks}
        ignoredRiskIds={ignoredRiskIds}
        routeInfo={routeInfo as RouteInfo | null}
        planning={planning}
        status={status}
        hasUserLocation={!!userLocation}
        mode={mode}
        onUseMyLocation={handleUseMyLocation}
        onRemoveWaypoint={handleRemoveWaypoint}
        onRemoveAvoidArea={handleRemoveAvoidArea}
        onToggleAddWaypoint={handleToggleAddWaypoint}
        onToggleAddAvoid={handleToggleAddAvoid}
        onPlan={handlePlan}
        onToggleIgnoreRisk={handleToggleIgnoreRisk}
        onFocusRisk={handleFocusRisk}
        onSwapEndpoints={handleSwapEndpoints}
        onClearStart={handleClearStart}
        onClearEnd={handleClearEnd}
      />

      {/* 右侧日志面板 */}
      <DebugPanel logs={logs} />

      {/* 模式提示条 */}
      {mode !== 'none' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1900] pointer-events-none">
          <div className="bg-amber-500/90 text-slate-900 text-xs font-black px-4 py-2 rounded-full shadow-2xl backdrop-blur">
            {mode === 'add-waypoint' ? '点击地图添加途经点' : '点击地图标记避让区'}
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1900] pointer-events-none">
          <div className="bg-red-600/90 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-2xl">
            地图加载失败: {error}
          </div>
        </div>
      )}

      {/* 地图容器 */}
      <div
        id={MAP_CONTAINER_ID}
        className="flex-1 w-full h-full"
        style={{ cursor: mapCursor }}
      />

      <style jsx global>{`
        .amap-sug-result {
          z-index: 9999 !important;
          border: none !important;
          border-radius: 24px !important;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5) !important;
          padding: 16px !important;
          background: #0f172a !important;
          color: white !important;
        }
        .auto-item {
          padding: 14px 20px !important;
          font-size: 14px !important;
          color: #f1f5f9 !important;
          font-weight: 800 !important;
          cursor: pointer !important;
          border-radius: 16px !important;
        }
        .auto-item:hover {
          background-color: #1e293b !important;
          color: #60a5fa !important;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default MapContainer;
