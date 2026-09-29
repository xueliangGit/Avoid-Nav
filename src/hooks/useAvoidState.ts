'use client';

import { useCallback, useState } from 'react';
import type { ManualAvoidArea, PlaceItem, Waypoint } from '@/lib/types';

export function useAvoidState() {
  const [start, setStart] = useState<PlaceItem | null>(null);
  const [end, setEnd] = useState<PlaceItem | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [manualAvoidAreas, setManualAvoidAreas] = useState<ManualAvoidArea[]>([]);
  const [ignoredRiskIds, setIgnoredRiskIds] = useState<Set<string>>(new Set());
  const [forcedRiskIds, setForcedRiskIds] = useState<Set<string>>(new Set());

  const handleClearStart = useCallback(() => setStart(null), []);
  const handleClearEnd = useCallback(() => setEnd(null), []);
  const handleSwapEndpoints = useCallback(() => {
    setStart(end);
    setEnd(start);
  }, [start, end]);

  const handleRemoveWaypoint = useCallback((id: string) => {
    setWaypoints((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const handleRemoveAvoidArea = useCallback((id: string) => {
    setManualAvoidAreas((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleToggleIgnoreRisk = useCallback((id: string) => {
    setIgnoredRiskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleForceRisk = useCallback((id: string) => {
    setForcedRiskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setIgnoredRiskIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return {
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
  };
}
