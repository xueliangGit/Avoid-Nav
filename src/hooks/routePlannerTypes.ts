// src/hooks/routePlannerTypes.ts
import type { AvoidSize } from '@/lib/avoidance';
import type { CorridorSuggestion } from '@/lib/corridor';
import type {
  DebugLog,
  LngLat,
  ManualAvoidArea,
  PlaceItem,
  RingFilter,
  RouteRisk,
  Waypoint,
} from '@/lib/types';

export interface RoutePlanInput {
  start: PlaceItem | null;
  end: PlaceItem | null;
  waypoints: Waypoint[];
  ignoredRiskIds: Set<string>;
  forcedRiskIds: Set<string>;
  manualAvoidAreas: ManualAvoidArea[];
  /** 自动风险点避让矩形尺寸，默认 medium */
  riskAvoidSize: AvoidSize;
  /** 六环内外筛选：仅避让六环内/外/全部 */
  ringFilter: RingFilter;
  /** 失效点(aa=4)是否也自动避让，默认 false */
  avoidDeadPoints: boolean;
  /** 是否强制全量重算跳过缓存，默认 false */
  forceFresh?: boolean;
}

export interface RoutePlanState {
  planning: boolean;
  status: string | null;
  routeRisks: RouteRisk[];
  avoidedRisks: RouteRisk[];
  safelyIgnoredRisks: RouteRisk[];
  /** 路线上的失效点(默认不避让)，供用户手动选择是否避让 */
  deadRisks: RouteRisk[];
  routePath: LngLat[];
  logs: DebugLog[];
  routeInfo: { distance: number; duration: number } | null;
  /** 当前路线是否由历史缓存秒开提供 */
  fromCache: boolean;
  /** 缓存时效提示信息 */
  cacheNotice: string | null;
  /** 智能六环走廊绕行建议 */
  corridorSuggestion: CorridorSuggestion | null;
}

export interface UseRoutePlannerResult extends RoutePlanState {
  /** 采纳并应用六环走廊建议 */
  applyCorridorSuggestion: () => Promise<void>;
  /** 忽略/关闭走廊建议 */
  dismissCorridorSuggestion: () => void;
  /** 返回是否最终生成了可用路线 */
  plan: (override?: Partial<RoutePlanInput>) => Promise<boolean>;
  clearLogs: () => void;
}
