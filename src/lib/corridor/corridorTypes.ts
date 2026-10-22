// src/lib/corridor/corridorTypes.ts
import type { PlaceItem, Waypoint } from '@/lib/types';

/** 北京大方位区域划分 */
export type CorridorRegion = 'north' | 'south' | 'east' | 'west' | 'central';

/** 安全大通道定义 */
export interface CorridorSegment {
  id: string;
  name: string;
  description: string;
  /** 适用出行大方向：如 north -> south */
  fromRegion: CorridorRegion;
  toRegion: CorridorRegion;
  /** 走廊上的核心安全引导锚点（经校验 100% 避开监控探头） */
  anchors: {
    name: string;
    lng: number;
    lat: number;
  }[];
  /** 触发此走廊的最小直线跨距（千米），默认 25km */
  minDistanceKm?: number;
}

/** 走廊匹配计算结果 */
export interface CorridorMatchResult {
  matched: boolean;
  corridor?: CorridorSegment;
  waypoints: Waypoint[];
  reason?: string;
}

export interface CorridorMatcherInput {
  start: PlaceItem | null;
  end: PlaceItem | null;
  userWaypoints?: Waypoint[];
}
