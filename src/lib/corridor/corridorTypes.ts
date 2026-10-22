// src/lib/corridor/corridorTypes.ts
import type { PlaceItem, Waypoint } from '@/lib/types';

/** 北京大方位区域划分 */
export type CorridorRegion = 'north' | 'south' | 'east' | 'west' | 'central';

/** 安全引导锚点 */
export interface CorridorAnchor {
  name: string;
  lng: number;
  lat: number;
}

/** 安全大通道定义 */
export interface CorridorSegment {
  id: string;
  name: string;
  description: string;
  fromRegion: CorridorRegion;
  toRegion: CorridorRegion;
  anchors: CorridorAnchor[];
  minDistanceKm?: number;
}

/** 走廊匹配计算结果 */
export interface CorridorMatchResult {
  matched: boolean;
  corridorName?: string;
  waypoints: Waypoint[];
  reason?: string;
}

export interface CorridorMatcherInput {
  start: PlaceItem | null;
  end: PlaceItem | null;
  userWaypoints?: Waypoint[];
}
