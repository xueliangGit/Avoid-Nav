'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAMap } from '@/hooks/useAMap';
import { useRoutePlanner } from '@/hooks/useRoutePlanner';
import CorridorSuggestionCard from './components/CorridorSuggestionCard';
import { useDeviceLayout } from '@/hooks/useDeviceLayout';
import { useTheme } from '@/hooks/useTheme';
import { useAvoidState } from '@/hooks/useAvoidState';
import { useMapInteractions } from '@/hooks/useMapInteractions';
import { useMapRiskFocus } from '@/hooks/useMapRiskFocus';
import { useNavigationAction } from '@/hooks/useNavigationAction';
import { useRouteSharing } from '@/hooks/useRouteSharing';
import { useRouteStorageActions } from '@/hooks/useRouteStorageActions';
import { usePlanAction } from '@/hooks/usePlanAction';
import { useChangelogNotice } from '@/hooks/useChangelogNotice';
import { routeCacheStorage, evaluateRouteCache } from '@/lib/storage';
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
import MapLegend from './components/MapLegend';

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
  const { hasNewUpdate, markAsSeen } = useChangelogNotice();

  const handleOpenChangelog = useCallback(() => {
    markAsSeen();
    setChangelogOpen(true);
  }, [markAsSeen]);

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
    fromCache: _fromCache,
    cacheNotice,
    corridorSuggestion,
    applyCorridorSuggestion,
    dismissCorridorSuggestion,
    plan,
  } = useRoutePlanner(AMap, map, plannerInput);

  // 当选择的点位命中历史规划时，自动秒开展示；若过时则后台自动刷新
  const lastAutoPlannedKeyRef = useRef<string>('');
  useEffect(() => {
    if (!AMap || !map || !start || !end || planning) return;

    const currentKey = `${start.lng.toFixed(5)},${start.lat.toFixed(5)}->${end.lng.toFixed(5)},${end.lat.toFixed(5)}`;
    if (lastAutoPlannedKeyRef.current === currentKey) return;

    const cached = routeCacheStorage.find(plannerInput);
    if (cached) {
      const evaluation = evaluateRouteCache(cached);
      // 未跨越早晚高峰临界时段时，直接自动秒开展示
      if (evaluation.status !== 'EXPIRED_PEAK') {
        lastAutoPlannedKeyRef.current = currentKey;
        void plan();
      }
    }
  }, [AMap, map, start, end, planning, plannerInput, plan]);

  // 缓存命中时向用户给出轻量反馈
  const prevCacheNoticeRef = useRef<string | null>(null);
  useEffect(() => {
    if (cacheNotice && cacheNotice !== prevCacheNoticeRef.current) {
      showToast(cacheNotice, 'success');
    }
    prevCacheNoticeRef.current = cacheNotice;
  }, [cacheNotice, showToast]);

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

  const [mobilePlannerOpen, setMobilePlannerOpen] = useState(false);
  const { handleFocusRisk: rawFocusRisk } = useMapRiskFocus(AMap, map);

  const handleFocusRisk = useCallback(
    (risk: import('@/lib/types').RouteRisk) => {
      // 点击避让点时，聚焦到地图位置并自动收起移动端弹窗，让用户清晰看到位置
      rawFocusRisk(risk);
      setMobilePlannerOpen(false);
    },
    [rawFocusRisk],
  );

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

  // 规划完成后提供直观明确的结果反馈（成功避开数量 / 未避开风险警示）
  const prevPlanningRef = useRef(planning);
  useEffect(() => {
    if (prevPlanningRef.current && !planning && routeInfo) {
      const unavoidedCount = routeRisks.filter((r) => !ignoredRiskIds.has(r.id)).length;
      const avoidedCount = avoidedRisks.length;
      if (unavoidedCount > 0) {
        showToast(
          `⚠️ 规划完成，注意！仍有 ${unavoidedCount} 处监控无法避开`,
          'error',
        );
      } else if (avoidedCount > 0) {
        showToast(`🎉 路线规划成功！已绕开全部 ${avoidedCount} 处监控`, 'success');
      } else {
        showToast('🎉 路线规划成功！全程畅通无冲突监控', 'success');
      }
    }
    prevPlanningRef.current = planning;
  }, [planning, routeInfo, routeRisks, avoidedRisks, ignoredRiskIds, showToast]);

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
      onOpenChangelog={handleOpenChangelog}
      hasNewUpdate={hasNewUpdate}
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
      start={start}
      end={end}
      planning={planning}
      status={status}
      routeInfo={routeInfo as RouteInfo | null}
      avoidedRiskCount={avoidedRisks.length}
      unavoidedRiskCount={routeRisks.filter((r) => !ignoredRiskIds.has(r.id)).length}
      hasNewUpdate={hasNewUpdate}
      canSave={canSave}
      canNavigate={canNavigate}
      canShare={canShare}
      modalOpen={mobilePlannerOpen}
      onModalOpenChange={setMobilePlannerOpen}
      onPlan={handlePlan}
      onStartNavigation={handleStartNavigation}
      onSaveRoute={handleOpenSave}
      onShareRoute={handleShareRoute}
      onOpenSettings={() => setSettingsOpen(true)}
      onOpenHistory={handleOpenHistory}
      onOpenChangelog={handleOpenChangelog}
    />
  );

  const drawerVariant = useDesktop ? 'side' : 'fullscreen';
  const dialogVariant = useDesktop ? 'modal' : 'sheet';
  const defaultSaveName = start && end ? `${start.name} → ${end.name}` : '我的路线';

  return (
    <div className="relative w-full h-full bg-surface-2 overflow-hidden text-fg-2">
      {layoutContent}
      <MapLegend />

      {/* 智能六环走廊绕行推荐卡片 */}
      <CorridorSuggestionCard
        suggestion={corridorSuggestion}
        onApply={applyCorridorSuggestion}
        onDismiss={dismissCorridorSuggestion}
        mode="float"
      />

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
        onOpenChangelog={handleOpenChangelog}
        hasNewUpdate={hasNewUpdate}
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
