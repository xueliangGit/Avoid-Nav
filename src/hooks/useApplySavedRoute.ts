'use client';

import { useCallback } from 'react';
import type { SavedRoute } from '@/lib/storage';
import type {
  ManualAvoidArea,
  PlaceItem,
  Waypoint,
} from '@/lib/types';

export interface ApplySetters {
  setStart: (v: PlaceItem | null) => void;
  setEnd: (v: PlaceItem | null) => void;
  setWaypoints: (v: Waypoint[]) => void;
  setManualAvoidAreas: (v: ManualAvoidArea[]) => void;
  setIgnoredRiskIds: (v: Set<string>) => void;
  setForcedRiskIds: (v: Set<string>) => void;
  plan: (override?: {
    start?: PlaceItem | null;
    end?: PlaceItem | null;
    waypoints?: Waypoint[];
    ignoredRiskIds?: Set<string>;
    forcedRiskIds?: Set<string>;
    manualAvoidAreas?: ManualAvoidArea[];
  }) => Promise<void>;
}

export function useApplySavedRoute(setters: ApplySetters) {
  return useCallback(
    async (route: SavedRoute) => {
      const ignored = new Set(route.ignoredRiskIds);
      const forced = new Set(route.forcedRiskIds ?? []);
      setters.setStart(route.start);
      setters.setEnd(route.end);
      setters.setWaypoints(route.waypoints);
      setters.setManualAvoidAreas(route.manualAvoidAreas);
      setters.setIgnoredRiskIds(ignored);
      setters.setForcedRiskIds(forced);
      await setters.plan({
        start: route.start,
        end: route.end,
        waypoints: route.waypoints,
        manualAvoidAreas: route.manualAvoidAreas,
        ignoredRiskIds: ignored,
        forcedRiskIds: forced,
      });
    },
    [setters],
  );
}
