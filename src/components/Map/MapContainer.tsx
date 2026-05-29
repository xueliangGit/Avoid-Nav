'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAMap } from '@/hooks/useAMap';
import { useRoutePlanner } from '@/hooks/useRoutePlanner';
import { useDeviceLayout } from '@/hooks/useDeviceLayout';
import { useHistory } from '@/hooks/useHistory';
import { useApplySavedRoute } from '@/hooks/useApplySavedRoute';
import { useShareLink } from '@/hooks/useShareLink';
import { StorageQuotaError, type SavedRoute } from '@/lib/storage';
import { extractKeyPoints } from '@/lib/utils/path-keypoints';
import { buildAmapNavUri, detectPlatform } from '@/lib/navigation';
import { buildShareUrl, encodeShare } from '@/lib/share';
import Toast, { type ToastVariant } from '@/components/shared/Toast';
import type {
  PlaceItem,
  Waypoint,
  ManualAvoidArea,
  ManualAvoidSize,
  LngLat,
} from '@/lib/types';
import ControlPanel, { type InteractionMode, type RouteInfo } from './ControlPanel';
import DebugPanel from './DebugPanel';
import DesktopLayout from '@/components/layouts/DesktopLayout';
import MobileLayout from '@/components/layouts/MobileLayout';
import MobileLandscapeLayout from '@/components/layouts/MobileLandscapeLayout';
import HistoryDrawer from '@/components/History/HistoryDrawer';
import SaveRouteDialog from '@/components/History/SaveRouteDialog';

interface AutoCompleteSelectEvent {
  poi?: {
    name?: string;
    location?: { lng: number; lat: number };
    adcode?: string;
  };
}

interface AMapClickEvent {
  lnglat: { lng: number; lat: number };
}

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

  const [start, setStart] = useState<PlaceItem | null>(null);
  const [end, setEnd] = useState<PlaceItem | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [manualAvoidAreas, setManualAvoidAreas] = useState<ManualAvoidArea[]>([]);
  const [ignoredRiskIds, setIgnoredRiskIds] = useState<Set<string>>(new Set());
  const [forcedRiskIds, setForcedRiskIds] = useState<Set<string>>(new Set());

  const [mode, setMode] = useState<InteractionMode>('none');
  const modeRef = useRef<InteractionMode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // 待添加的避让区尺寸（仅在 mode === 'add-avoid' 时有意义）
  const [pendingAvoidSize, setPendingAvoidSize] = useState<ManualAvoidSize>('medium');
  const pendingAvoidSizeRef = useRef<ManualAvoidSize>(pendingAvoidSize);
  useEffect(() => {
    pendingAvoidSizeRef.current = pendingAvoidSize;
  }, [pendingAvoidSize]);

  // 历史 / 保存 UI 局部状态
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);

  // Toast 状态
  const [toast, setToast] = useState<{ open: boolean; message: string; variant: ToastVariant }>(
    { open: false, message: '', variant: 'success' }
  );
  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    setToast({ open: true, message, variant });
  }, []);
  const closeToast = useCallback(() => setToast((t) => ({ ...t, open: false })), []);

  const layoutMode = useDeviceLayout();
  const { routes, save, remove, rename, toggleFavorite } = useHistory();

  const plannerInput = useMemo(
    () => ({ start, end, waypoints, ignoredRiskIds, forcedRiskIds, manualAvoidAreas }),
    [start, end, waypoints, ignoredRiskIds, forcedRiskIds, manualAvoidAreas]
  );

  const {
    planning,
    status,
    routeRisks,
    avoidedRisks,
    safelyIgnoredRisks,
    routePath,
    logs,
    routeInfo,
    plan,
  } = useRoutePlanner(AMap, map, plannerInput);

  // 一键复用 hook
  const applySetters = useMemo(
    () => ({
      setStart,
      setEnd,
      setWaypoints,
      setManualAvoidAreas,
      setIgnoredRiskIds,
      setForcedRiskIds,
      plan,
    }),
    [plan],
  );
  const applyRoute = useApplySavedRoute(applySetters);

  // —— 绑定 AutoComplete（在 AMap & map 就绪后） ——
  const autoCompleteRefs = useRef<{ start: unknown; end: unknown }>({
    start: null,
    end: null,
  });

  useEffect(() => {
    if (!ready || !AMap || !map) return;
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
        const size = pendingAvoidSizeRef.current;
        const sizeLabel = size === 'small' ? '小' : size === 'large' ? '大' : '中';
        const label = `避让区 ${sizeLabel}·${Date.now().toString().slice(-4)}`;
        setManualAvoidAreas((prev) => [
          ...prev,
          { id: makeId('avoid'), lng: point.lng, lat: point.lat, label, size },
        ]);
      }
      setMode('none');
    };

    M.on('click', onClick);
    return () => {
      M.off('click', onClick);
    };
  }, [ready, AMap, map]);

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

  const handleStartAddAvoid = useCallback((size: ManualAvoidSize) => {
    setPendingAvoidSize(size);
    setMode((m) => (m === 'add-avoid' && pendingAvoidSizeRef.current === size ? 'none' : 'add-avoid'));
  }, []);

  const handleToggleIgnoreRisk = useCallback((id: string) => {
    setIgnoredRiskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // 取消"忽略"时不需要清 forced；切到忽略时也保留 forced 状态（不冲突）
  }, []);

  const handleToggleForceRisk = useCallback((id: string) => {
    setForcedRiskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // 强制避让 = 把它从 ignored 中移除（避免互相打架）
    setIgnoredRiskIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handlePlan = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const A = AMap as any;
    if (!A) return;

    let s = start;
    let e = end;

    const startInput = document.getElementById('start-input') as HTMLInputElement | null;
    const endInput = document.getElementById('end-input') as HTMLInputElement | null;
    const startText = startInput?.value?.trim() ?? '';
    const endText = endInput?.value?.trim() ?? '';

    const lookup = (keyword: string): Promise<PlaceItem | null> =>
      new Promise((resolve) => {
        try {
          const ps = new A.PlaceSearch({ city: '北京', pageSize: 1, extensions: 'base' });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      showToast(!s && !e ? '请先设置起点和终点' : !s ? '请先设置起点' : '请先设置终点', 'error');
      return;
    }

    const ok = await plan({ start: s, end: e });
    if (!ok) showToast('规划失败，请检查起终点或稍后重试', 'error');
  }, [AMap, start, end, plan, showToast]);

  const handleClearStart = useCallback(() => setStart(null), []);
  const handleClearEnd = useCallback(() => setEnd(null), []);

  const handleSwapEndpoints = useCallback(() => {
    setStart(end);
    setEnd(start);
  }, [start, end]);

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

  // —— 分享路线 ——
  const canShare = !!start && !!end;
  const handleShareRoute = useCallback(async () => {
    if (!start || !end) return;
    const token = encodeShare({
      s: start,
      e: end,
      w: waypoints,
      m: manualAvoidAreas,
      i: Array.from(ignoredRiskIds),
      f: Array.from(forcedRiskIds),
    });
    const url = buildShareUrl(token);

    // 优先 navigator.share（移动），失败 fallback 到剪贴板
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: '北京避让导航 - 路线方案', url });
        return;
      }
    } catch {
      // 用户取消分享、或浏览器报错 → fallback
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('链接已复制，粘贴给好友即可');
    } catch {
      // 极端情况：剪贴板权限不可用，直接弹链接到 prompt
      window.prompt('复制此链接分享：', url);
    }
  }, [start, end, waypoints, manualAvoidAreas, ignoredRiskIds, forcedRiskIds, showToast]);

  // —— 接收分享链接：挂载时恢复状态，等地图就绪后再触发规划 ——
  const pendingSharedPlanRef = useRef<null | (() => void)>(null);

  useShareLink(
    useCallback(
      (state) => {
        setStart(state.s);
        setEnd(state.e);
        setWaypoints(state.w);
        setManualAvoidAreas(state.m);
        setIgnoredRiskIds(new Set(state.i));
        setForcedRiskIds(new Set(state.f));
        // 暂存规划闭包，等 AMap/map ready 后执行
        pendingSharedPlanRef.current = () => {
          void plan({
            start: state.s,
            end: state.e,
            waypoints: state.w,
            manualAvoidAreas: state.m,
            ignoredRiskIds: new Set(state.i),
            forcedRiskIds: new Set(state.f),
          });
        };
        showToast('已加载分享的路线，地图就绪后自动规划...');
      },
      [plan, showToast],
    ),
  );

  // 地图就绪后，如果有待执行的分享规划，触发一次
  useEffect(() => {
    if (!ready || !AMap || !map) return;
    const fn = pendingSharedPlanRef.current;
    if (!fn) return;
    pendingSharedPlanRef.current = null;
    fn();
  }, [ready, AMap, map]);

  // —— 导航跳转 ——
  const canNavigate = !!start && !!end && !planning && routePath.length > 1;

  const handleStartNavigation = useCallback(() => {
    if (!start || !end || routePath.length < 2) return;

    // 用户手动避让区也作为途经点（紧跟在自动关键点前面，保证一定被尊重）
    const manualPoints = manualAvoidAreas.map((a) => ({ lng: a.lng, lat: a.lat }));
    // 自动关键点配额：16 - 手动避让区数量，至少留 4
    const autoBudget = Math.max(4, 16 - manualPoints.length);
    const autoPoints = extractKeyPoints(routePath, autoBudget);

    // 顺序：手动避让区 + 自动关键点（合并后再次裁剪到 16）
    const waypoints = [...manualPoints, ...autoPoints].slice(0, 16);

    const uri = buildAmapNavUri({
      start,
      end,
      waypoints,
      platform: detectPlatform(),
    });

    // eslint-disable-next-line no-console
    console.log('[导航] waypoints =', waypoints.length, '路径点 =', routePath.length, 'URI =', uri);
    window.open(uri, '_blank');
  }, [start, end, routePath, manualAvoidAreas]);

  // —— 历史 / 保存 回调 ——
  const canSave = !!routeInfo && !planning;

  const handleOpenHistory = useCallback(() => setHistoryOpen(true), []);
  const handleCloseHistory = useCallback(() => setHistoryOpen(false), []);

  const handleOpenSave = useCallback(() => {
    setSaveError(undefined);
    setSaveOpen(true);
  }, []);
  const handleCloseSave = useCallback(() => setSaveOpen(false), []);

  const handleConfirmSave = useCallback(
    (name: string, favorite: boolean) => {
      if (!start || !end) return;
      try {
        save({
          name,
          favorite,
          start,
          end,
          waypoints,
          manualAvoidAreas,
          ignoredRiskIds: Array.from(ignoredRiskIds),
          forcedRiskIds: Array.from(forcedRiskIds),
          summary: routeInfo
            ? {
                distance: routeInfo.distance,
                duration: routeInfo.duration,
                riskCount: avoidedRisks.filter((r) => !ignoredRiskIds.has(r.id)).length,
              }
            : undefined,
        });
        setSaveOpen(false);
        showToast(`已保存：${name}`);
      } catch (e) {
        if (e instanceof StorageQuotaError) {
          setSaveError(e.message);
        } else {
          setSaveError('保存失败');
        }
      }
    },
    [start, end, waypoints, manualAvoidAreas, ignoredRiskIds, forcedRiskIds, routeInfo, avoidedRisks, save, showToast],
  );

  const handleUseRoute = useCallback(
    (route: SavedRoute) => {
      void applyRoute(route);
      showToast(`已加载：${route.name}`);
    },
    [applyRoute, showToast],
  );

  // 包一层删除：toast 提示
  const handleRemoveHistory = useCallback(
    (id: string) => {
      const target = routes.find((r) => r.id === id);
      remove(id);
      showToast(target ? `已删除：${target.name}` : '已删除');
    },
    [remove, routes, showToast],
  );

  // 地图鼠标样式
  const mapCursor =
    mode === 'add-waypoint'
      ? 'crosshair'
      : mode === 'add-avoid'
      ? 'crosshair'
      : 'default';

  // —— 子节点 & layout 选择 ——
  const useDesktop = layoutMode === 'desktop' || layoutMode === 'tablet-landscape';
  const panelVariant: 'constrained' | 'flow' =
    useDesktop || layoutMode === 'mobile-landscape' ? 'constrained' : 'flow';

  const controlPanelNode = (
    <ControlPanel
      start={start}
      end={end}
      waypoints={waypoints}
      manualAvoidAreas={manualAvoidAreas}
      avoidedRisks={avoidedRisks}
      safelyIgnoredRisks={safelyIgnoredRisks}
      routeRisks={routeRisks}
      ignoredRiskIds={ignoredRiskIds}
      forcedRiskIds={forcedRiskIds}
      routeInfo={routeInfo as RouteInfo | null}
      planning={planning}
      status={status}
      hasUserLocation={!!userLocation}
      mode={mode}
      onUseMyLocation={handleUseMyLocation}
      onRemoveWaypoint={handleRemoveWaypoint}
      onRemoveAvoidArea={handleRemoveAvoidArea}
      onToggleAddWaypoint={handleToggleAddWaypoint}
      onStartAddAvoid={handleStartAddAvoid}
      pendingAvoidSize={pendingAvoidSize}
      onPlan={handlePlan}
      onToggleIgnoreRisk={handleToggleIgnoreRisk}
      onToggleForceRisk={handleToggleForceRisk}
      onFocusRisk={handleFocusRisk}
      onSwapEndpoints={handleSwapEndpoints}
      onClearStart={handleClearStart}
      onClearEnd={handleClearEnd}
      onOpenHistory={handleOpenHistory}
      onSaveRoute={handleOpenSave}
      canSave={canSave}
      onStartNavigation={handleStartNavigation}
      canNavigate={canNavigate}
      onShareRoute={handleShareRoute}
      canShare={canShare}
      variant={panelVariant}
    />
  );

  const debugPanelNode = <DebugPanel logs={logs} variant={panelVariant} />;

  const mapElement = (
    <div
      id={MAP_CONTAINER_ID}
      className="absolute inset-0 w-full h-full"
      style={{ cursor: mapCursor }}
    />
  );

  const layoutContent = useDesktop ? (
    <DesktopLayout
      controlPanel={controlPanelNode}
      debugPanel={debugPanelNode}
      mapElement={mapElement}
    />
  ) : layoutMode === 'mobile-landscape' ? (
    <MobileLandscapeLayout
      controlPanel={controlPanelNode}
      debugPanel={debugPanelNode}
      mapElement={mapElement}
    />
  ) : (
    <MobileLayout
      controlPanel={controlPanelNode}
      debugPanel={debugPanelNode}
      mapElement={mapElement}
    />
  );

  const drawerVariant: 'side' | 'fullscreen' = useDesktop ? 'side' : 'fullscreen';
  const dialogVariant: 'modal' | 'sheet' = useDesktop ? 'modal' : 'sheet';
  const defaultSaveName = start && end ? `${start.name} → ${end.name}` : '我的路线';

  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden text-slate-200">
      {layoutContent}

      {mode !== 'none' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1900] pointer-events-none">
          <div className="bg-amber-500/90 text-slate-900 text-xs font-black px-4 py-2 rounded-full shadow-2xl backdrop-blur">
            {mode === 'add-waypoint' ? '点击地图添加途经点' : '点击地图标记避让区'}
          </div>
        </div>
      )}

      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1900] pointer-events-none">
          <div className="bg-red-600/90 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-2xl">
            地图加载失败: {error}
          </div>
        </div>
      )}

      <HistoryDrawer
        open={historyOpen}
        variant={drawerVariant}
        routes={routes}
        onClose={handleCloseHistory}
        onUse={handleUseRoute}
        onToggleFavorite={toggleFavorite}
        onRename={rename}
        onRemove={handleRemoveHistory}
      />

      <SaveRouteDialog
        open={saveOpen}
        variant={dialogVariant}
        defaultName={defaultSaveName}
        errorMessage={saveError}
        onClose={handleCloseSave}
        onConfirm={handleConfirmSave}
      />

      <Toast
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        onClose={closeToast}
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
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default MapContainer;
