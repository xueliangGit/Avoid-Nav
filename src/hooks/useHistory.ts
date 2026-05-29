'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { historyStorage } from '@/lib/storage';
import type { SavedRoute, SavedRouteInput } from '@/lib/storage';

export interface UseHistoryResult {
  routes: SavedRoute[];
  save: (input: SavedRouteInput) => SavedRoute;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  toggleFavorite: (id: string) => void;
}

const EMPTY: SavedRoute[] = [];

export function useHistory(): UseHistoryResult {
  const routes = useSyncExternalStore(
    historyStorage.subscribe.bind(historyStorage),
    () => historyStorage.list(),
    () => EMPTY,
  );

  const save = useCallback((input: SavedRouteInput) => historyStorage.save(input), []);
  const remove = useCallback((id: string) => historyStorage.remove(id), []);
  const rename = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    historyStorage.update(id, { name: trimmed });
  }, []);
  const toggleFavorite = useCallback((id: string) => {
    const cur = historyStorage.get(id);
    if (!cur) return;
    historyStorage.update(id, { favorite: !cur.favorite });
  }, []);

  return { routes, save, remove, rename, toggleFavorite };
}
