'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAMap } from '@/hooks/useAMap';
import { useRoutePlanner } from '@/hooks/useRoutePlanner';
import { useDeviceLayout } from '@/hooks/useDeviceLayout';
import { useTheme } from '@/hooks/useTheme';
import { useAvoidState } from '@/hooks/useAvoidState';
import { useMapInteractions } from '@/hooks/useMapInteractions';
import { useMapRiskFocus } from '@/hooks/useMapRiskFocus';
import { useNavigationAction } from '@/hooks/useNavigationAction';
import { useRouteSharing } from '@/hooks/useRouteSharing';
import { useRouteStorageActions } from '@/hooks/useRouteStorageActions';
import { usePlanAction } from '@/hooks/usePlanAction';
import Toast, { type ToastVariant } from '@/components/shared/Toast';
import WechatGuide from '@/components/shared/WechatGuide';
import type { ManualAvoidSize, RingFilter } from '@/lib/types';
import ControlPanel, { type InteractionMode, type RouteInfo } from './ControlPanel';
import DebugPanel from './DebugPanel';
import DesktopLayout from '@/components/layouts/DesktopLayout';
import MobileLayout from '@/components/layouts/MobileLayout';
import MobileLandscapeLayout from '@/components/layouts/MobileLandscapeLayout';
import HistoryDrawer from '@/components/History/HistoryDrawer';
import SettingsDrawer from '@/components/shared/SettingsDrawer';
import SaveRouteDialog from '@/components/History/SaveRouteDialog';
import ChangelogModal from '@/components/shared/ChangelogModal';

const MAP_CONTAINER_ID = 'container';

const MapContainer = () => {
  // 六环内外筛选与避让设置
  const [ringFilter, setRingFilter] = useState<RingFilter>('all');
  const [avoidDeadPoints, setAvoidDeadPoints] = useState(false);
  const [riskAvoidSize, setRiskAvoidSize] = useState<ManualAvoidSize>('medium');

  // 路线参数状态
  const {
    start,
    end,
    waypoints,
    manualAvoidAreas,
    ignoredRiskIds,
    forcedRiskIds,
    setStart,
    setEnd,
    setWaypoints,
    setManualAvoidAreas,
    setIgnoredRiskIds,
    setForcedRiskIds,
    handleClearStart,
    handleClearEnd,
    handleSwapEndpoints,
    handleRemoveWaypoint,
    handleRemoveAvoidArea,
    handleToggleIgnoreRisk,
    handleToggleForceRisk,
  } = useAvoidState();

  // 主题与地图底图
  const { theme, isDark, setTheme } = useTheme();
  const { AMap, map, ready, userLocation, error } = useAMap(MAP_CONTAINER_ID, ringFilter, isDark);

  // 交互模式与弹窗控制
  const [mode, setMode] = useState<InteractionMode>('none');
  const [pendingAvoidSize, setPendingAvoidSize] = useState<ManualAvoidSize>('medium');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);

  // 提示信息
  const [toast, setToast] = useState<{ open: boolean; message: string; variant: ToastVariant }>({
    open: false,
    message: '',
    variant: 'success',
  });
  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    setToast({ open: true, message, variant });
  }, []);
  const closeToast = useCallback(() => setToast((t) => ({ ...t, open: false })), []);

  const layoutMode = useDeviceLayout();

  // 路线规划引擎
  const plannerInput = useMemo(
    () => ({
      start,
      end,
      waypoints,
      ignoredRiskIds,
      forcedRiskIds,
      manualAvoidAreas,
      riskAvoidSize,
      ringFilter,
      avoidDeadPoints,
    }),
    [start, end, waypoints, ignoredRiskIds, forcedRiskIds, manualAvoidAreas, riskAvoidSize, ringFilter, avoidDeadPoints],
  );

  const {
    planning,
    status,
    routeRisks,
    avoidedRisks,
    safelyIgnoredRisks,
    deadRisks,
    routePath,
    logs,
    routeInfo,
    plan,
  } = useRoutePlanner(AMap, map, plannerInput);

  // 地图交互事件绑定
  useMapInteractions({
    AMap,
    map,
    ready,
    mode,
    pendingAvoidSize,
    setMode,
    setStart,
    setEnd,
    setWaypoints,
    setManualAvoidAreas,
  });

  const { handleFocusRisk } = useMapRiskFocus(AMap, map);

  const {
    canNavigate,
    wechatGuideOpen,
    setWechatGuideOpen,
    handleStartNavigation,
  } = useNavigationAction({
    start,
    end,
    routePath,
    planning,
  });

  const { canShare, handleShareRoute } = useRouteSharing({
    start,
    end,
    waypoints,
    manualAvoidAreas,
    ignoredRiskIds,
    forcedRiskIds,
    ready,
    AMap,
    map,
    plan,
    setStart,
    setEnd,
    setWaypoints,
    setManualAvoidAreas,
    setIgnoredRiskIds,
    setForcedRiskIds,
    showToast,
  });

  const {
    routes,
    historyOpen,
    saveOpen,
    saveError,
    canSave,
    handleOpenSave,
    handleCloseSave,
    handleOpenHistory,
    handleCloseHistory,
    handleConfirmSave,
    handleUseRoute,
    handleRemoveHistory,
    toggleFavorite,
    rename,
  } = useRouteStorageActions({
    start,
    end,
    waypoints,
    manualAvoidAreas,
    ignoredRiskIds,
    forcedRiskIds,
    routeInfo: routeInfo as RouteInfo | null,
    avoidedRisks,
    planning,
    plan,
    setStart,
    setEnd,
    setWaypoints,
    setManualAvoidAreas,
    setIgnoredRiskIds,
    setForcedRiskIds,
    showToast,
  });

  const { handlePlan } = usePlanAction({
    AMap,
    start,
    end,
    plan,
    setStart,
    setEnd,
    showToast,
  });

  // 初始化定位默认填入起点
  useEffect(() => {
    if (userLocation && !start) {
      setStart({ lng: userLocation.lng, lat: userLocation.lat, name: '我的位置' });
    }
  }, [userLocation, start, setStart]);

  const handleUseMyLocation = useCallback(() => {
    if (!userLocation) return;
    setStart({ lng: userLocation.lng, lat: userLocation.lat, name: '我的位置' });
  }, [userLocation, setStart]);

  const handleToggleAddWaypoint = useCallback(() => {
    setMode((m) => (m === 'add-waypoint' ? 'none' : 'add-waypoint'));
  }, []);

  const handleStartAddAvoid = useCallback((size: ManualAvoidSize) => {
    setPendingAvoidSize(size);
    setMode((m) => (m === 'add-avoid' && pendingAvoidSize === size ? 'none' : 'add-avoid'));
  }, [pendingAvoidSize]);

  const mapCursor = mode !== 'none' ? 'crosshair' : 'default';
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
      deadRisks={deadRisks}
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
      onOpenSettings={() => setSettingsOpen(true)}
      onOpenChangelog={() => setChangelogOpen(true)}
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

  const drawerVariant = useDesktop ? 'side' : 'fullscreen';
  const dialogVariant = useDesktop ? 'modal' : 'sheet';
  const defaultSaveName = start && end ? `${start.name} → ${end.name}` : '我的路线';

  return (
    <div className="relative w-full h-full bg-surface-2 overflow-hidden text-fg-2">
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

      <SettingsDrawer
        open={settingsOpen}
        variant={drawerVariant}
        riskAvoidSize={riskAvoidSize}
        onChangeRiskAvoidSize={setRiskAvoidSize}
        ringFilter={ringFilter}
        onChangeRingFilter={setRingFilter}
        avoidDeadPoints={avoidDeadPoints}
        onChangeAvoidDeadPoints={setAvoidDeadPoints}
        theme={theme}
        onChangeTheme={setTheme}
        onClose={() => setSettingsOpen(false)}
      />

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

      <WechatGuide open={wechatGuideOpen} onClose={() => setWechatGuideOpen(false)} />
      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </div>
  );
};

export default MapContainer;
