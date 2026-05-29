import type {
  PlaceItem,
  Waypoint,
  ManualAvoidArea,
} from '@/lib/types';

export interface SavedRoute {
  id: string;
  name: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;

  start: PlaceItem;
  end: PlaceItem;
  waypoints: Waypoint[];
  manualAvoidAreas: ManualAvoidArea[];
  ignoredRiskIds: string[];

  summary?: {
    distance: number;
    duration: number;
    riskCount: number;
  };
}

export type SavedRouteInput = Omit<SavedRoute, 'id' | 'createdAt' | 'updatedAt'>;
export type SavedRoutePatch = Partial<Omit<SavedRoute, 'id' | 'createdAt'>>;

export interface HistoryStorage {
  list(): SavedRoute[];
  get(id: string): SavedRoute | null;
  save(input: SavedRouteInput): SavedRoute;
  update(id: string, patch: SavedRoutePatch): SavedRoute;
  remove(id: string): void;
  subscribe(listener: () => void): () => void;
}

export class StorageQuotaError extends Error {
  constructor() {
    super('本地存储空间不足，请删除部分历史记录');
    this.name = 'StorageQuotaError';
  }
}
