// src/lib/storage/routeCacheTypes.ts
import type { AvoidSize } from '@/lib/avoidance';
import type {
  LngLat,
  ManualAvoidArea,
  PlaceItem,
  RingFilter,
  RouteRisk,
  Waypoint,
} from '@/lib/types';

/** 构成路线唯一性指纹的全部入参 */
export interface RouteFingerprintInput {
  start: PlaceItem | null;
  end: PlaceItem | null;
  waypoints: Waypoint[];
  manualAvoidAreas: ManualAvoidArea[];
  ignoredRiskIds: Set<string> | string[];
  forcedRiskIds: Set<string> | string[];
  riskAvoidSize?: AvoidSize;
  ringFilter?: RingFilter;
  avoidDeadPoints?: boolean;
}

/** 缓存的规划结果实体 */
export interface CachedRoutePlan {
  id: string;
  fingerprint: string;
  cachedAt: number;
  start: PlaceItem;
  end: PlaceItem;
  waypoints: Waypoint[];
  routeInfo: {
    distance: number;
    duration: number;
  };
  routePath: LngLat[];
  avoidedRisks: RouteRisk[];
  routeRisks: RouteRisk[];
  safelyIgnoredRisks: RouteRisk[];
  deadRisks: RouteRisk[];
  /** 最终避让多边形包围盒，用于地图上还原绘制 */
  finalPolygons: [number, number][][];
}

/** 缓存状态判定结果 */
export type CacheFreshnessStatus =
  | 'FRESH' // 15分钟内且未跨高峰：完全新鲜，直接秒开
  | 'STALE' // 超过15分钟但未跨高峰：较久，可秒开垫底并静默刷新
  | 'EXPIRED_PEAK' // 跨越了早晚高峰临界时段：有违规扣分风险，禁止使用旧路线，必须全新计算
  | 'NOT_FOUND'; // 未匹配到历史缓存

export interface CacheEvaluation {
  status: CacheFreshnessStatus;
  cache?: CachedRoutePlan;
  ageMinutes: number;
  reason?: string;
}
