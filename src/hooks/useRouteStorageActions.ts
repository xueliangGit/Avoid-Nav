'use client';

import { useCallback, useState } from 'react';
import { useHistory } from '@/hooks/useHistory';
import { useApplySavedRoute } from '@/hooks/useApplySavedRoute';
import { StorageQuotaError, type SavedRoute } from '@/lib/storage';
import type {
  ManualAvoidArea,
  PlaceItem,
  RouteRisk,
  Waypoint,
} from '@/lib/types';
import type { RouteInfo } from '@/components/Map/ControlPanel';
import type { RoutePlanInput } from '@/hooks/useRoutePlanner';

interface UseRouteStorageActionsProps {
  start: PlaceItem | null;
  end: PlaceItem | null;
  waypoints: Waypoint[];
  manualAvoidAreas: ManualAvoidArea[];
  ignoredRiskIds: Set<string>;
  forcedRiskIds: Set<string>;
  routeInfo: RouteInfo | null;
  avoidedRisks: RouteRisk[];
  planning: boolean;
  plan: (override?: Partial<RoutePlanInput>) => Promise<boolean>;
  setStart: (item: PlaceItem | null) => void;
  setEnd: (item: PlaceItem | null) => void;
  setWaypoints: (w: Waypoint[]) => void;
  setManualAvoidAreas: (m: ManualAvoidArea[]) => void;
  setIgnoredRiskIds: (ids: Set<string>) => void;
  setForcedRiskIds: (ids: Set<string>) => void;
  showToast: (msg: string, variant?: 'success' | 'error') => void;
}

export function useRouteStorageActions({
  start,
  end,
  waypoints,
  manualAvoidAreas,
  ignoredRiskIds,
  forcedRiskIds,
  routeInfo,
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
}: UseRouteStorageActionsProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);

  const { routes, save, remove, rename, toggleFavorite } = useHistory();

  const applyRoute = useApplySavedRoute({
    setStart,
    setEnd,
    setWaypoints,
    setManualAvoidAreas,
    setIgnoredRiskIds,
    setForcedRiskIds,
    plan,
  });

  const canSave = !!routeInfo && !planning;

  const handleOpenSave = useCallback(() => {
    setSaveError(undefined);
    setSaveOpen(true);
  }, []);

  const handleCloseSave = useCallback(() => setSaveOpen(false), []);
  const handleOpenHistory = useCallback(() => setHistoryOpen(true), []);
  const handleCloseHistory = useCallback(() => setHistoryOpen(false), []);

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

  const handleRemoveHistory = useCallback(
    (id: string) => {
      const target = routes.find((r) => r.id === id);
      remove(id);
      showToast(target ? `已删除：${target.name}` : '已删除');
    },
    [remove, routes, showToast],
  );

  return {
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
  };
}
