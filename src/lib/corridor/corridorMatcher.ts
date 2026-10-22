// src/lib/corridor/corridorMatcher.ts
import type { LngLat, Waypoint } from '@/lib/types';
import { CORRIDOR_SEGMENTS } from './corridorData';
import type {
  CorridorMatcherInput,
  CorridorMatchResult,
  CorridorRegion,
} from './corridorTypes';

function calcDistanceKm(a: LngLat, b: LngLat): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 判断经纬度所在的北京宏观地理大区 */
export function getBeijingRegion(coord: LngLat): CorridorRegion {
  if (coord.lat >= 40.02) return 'north';
  if (coord.lat <= 39.82) return 'south';
  if (coord.lng >= 116.56) return 'east';
  if (coord.lng <= 116.24) return 'west';
  return 'central';
}

/**
 * 针对长距离跨区出行，匹配最优安全走廊并自动生成引导途经点
 */
export function matchSafetyCorridor(input: CorridorMatcherInput): CorridorMatchResult {
  const { start, end, userWaypoints = [] } = input;
  if (!start || !end) {
    return { matched: false, waypoints: [] };
  }

  // 1. 用户若已手动设置途经点，优先遵循用户意图，不自动干预
  if (userWaypoints.length > 0) {
    return {
      matched: false,
      waypoints: [],
      reason: '检测到用户已手动设定途经点，优先采用人工自定义偏好',
    };
  }

  const distKm = calcDistanceKm(start, end);
  const fromRegion = getBeijingRegion(start);
  const toRegion = getBeijingRegion(end);

  // 2. 仅针对直线距离 ≥ 25km 的跨大区出行生效（严格杜绝短途折返跑）
  if (distKm < 25 || fromRegion === toRegion || fromRegion === 'central' || toRegion === 'central') {
    return {
      matched: false,
      waypoints: [],
      reason: '当前为中短途或城区出行，无需启用长途走廊锚定',
    };
  }

  // 3. 判断偏东还是偏西
  const isWesternBias = (start.lng + end.lng) / 2 <= 116.45;

  const targetId =
    fromRegion === 'north' && toRegion === 'south'
      ? isWesternBias
        ? 'west-outer-corridor-ns'
        : 'east-outer-corridor-ns'
      : fromRegion === 'south' && toRegion === 'north'
        ? isWesternBias
          ? 'west-outer-corridor-sn'
          : 'east-outer-corridor-sn'
        : null;

  if (!targetId) {
    return { matched: false, waypoints: [] };
  }

  const corridor = CORRIDOR_SEGMENTS.find((c) => c.id === targetId);
  if (!corridor) {
    return { matched: false, waypoints: [] };
  }

  const waypoints: Waypoint[] = corridor.anchors.map((a, idx) => ({
    id: `corridor-${corridor.id}-${idx}`,
    lng: a.lng,
    lat: a.lat,
    name: a.name,
  }));

  return {
    matched: true,
    corridor,
    waypoints,
    reason: `检测到 ${distKm.toFixed(1)}km 长途跨区，已自动激活【${corridor.name}】`,
  };
}
