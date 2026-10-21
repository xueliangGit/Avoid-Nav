import { LocalHistoryStorage } from './localStore';
import type { HistoryStorage } from './types';

export const historyStorage: HistoryStorage = new LocalHistoryStorage();

export type {
  SavedRoute,
  SavedRouteInput,
  SavedRoutePatch,
  HistoryStorage,
} from './types';

export { StorageQuotaError } from './types';
export * from './routeCacheTypes';
export * from './routeCachePolicy';
export * from './routeCacheStorage';
