// src/lib/corridor/corridorMatcher.ts
import type { LngLat, Waypoint } from '@/lib/types';
import { SAFE_ANCHORS } from './corridorData';
import type {
  CorridorAnchor,
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

/** 判定当前路线是否已经实际沿用了该走廊骨干（检测路线是否经过走廊关键锚点） */
export function isRouteFollowingCorridor(
  path: LngLat[],
  anchors: CorridorAnchor[],
): boolean {
  if (!path || path.length === 0 || !anchors || anchors.length === 0) {
    return false;
  }
  // 路线如果经过了该走廊中的任意一个关键锚点（3.5km 空间窗口），视为已走六环走廊
  return anchors.some((anchor) =>
    path.some((p) => {
      const dLng = (p.lng - anchor.lng) * 85;
      const dLat = (p.lat - anchor.lat) * 111;
      return Math.hypot(dLng, dLat) < 3.5;
    }),
  );
}

/**
 * 针对长距离跨区出行，动态拟合全六环（北/东/南/西）闭环骨干安全通道
 */
export function matchSafetyCorridor(input: CorridorMatcherInput): CorridorMatchResult {
  const { start, end, userWaypoints = [] } = input;
  if (!start || !end) {
    return { matched: false, waypoints: [] };
  }

  // 用户若已手动设置途经点，优先遵循用户意图
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

  // 仅针对直线距离 ≥ 25km 的跨大区出行生效
  if (
    distKm < 25 ||
    fromRegion === toRegion ||
    fromRegion === 'central' ||
    toRegion === 'central'
  ) {
    return {
      matched: false,
      waypoints: [],
      reason: '当前为中短途或城区出行，无需启用长途走廊锚定',
    };
  }

  const anchors: CorridorAnchor[] = [];
  let corridorName = '';

  // 北向南跨区长途调度（昌平/顺义 -> 大兴/房山/通州）
  if (fromRegion === 'north' && toRegion === 'south') {
    if (start.lng >= 116.36) {
      corridorName = '东六环-南六环跨区安全走廊';
      if (start.lng < 116.55) {
        anchors.push(SAFE_ANCHORS.NORTH_6TH_SUANZAOLING);
      }
      anchors.push(SAFE_ANCHORS.EAST_6TH_XUXINZHUANG);
      if (end.lng <= 116.45) {
        anchors.push(SAFE_ANCHORS.SOUTH_6TH_CIGEZHUANG);
      } else {
        anchors.push(SAFE_ANCHORS.SOUTH_6TH_CHANGZIYING);
      }
    } else {
      corridorName = '西六环-南六环跨区安全走廊';
      anchors.push(SAFE_ANCHORS.WEST_6TH_DAJUESI);
      anchors.push(SAFE_ANCHORS.WEST_6TH_QINGLONGHU);
      if (end.lng >= 116.2) {
        anchors.push(SAFE_ANCHORS.SOUTH_6TH_CIGEZHUANG);
      }
    }
  } else if (fromRegion === 'south' && toRegion === 'north') {
    // 南向北跨区长途调度（野生动物园/大兴/房山 -> 昌平/顺义）
    if (end.lng >= 116.36) {
      corridorName = '南六环-东六环跨区安全走廊';
      if (start.lng <= 116.45) {
        anchors.push(SAFE_ANCHORS.SOUTH_6TH_CIGEZHUANG);
      } else {
        anchors.push(SAFE_ANCHORS.SOUTH_6TH_CHANGZIYING);
      }
      anchors.push(SAFE_ANCHORS.EAST_6TH_XUXINZHUANG);
      if (end.lng < 116.55) {
        anchors.push(SAFE_ANCHORS.NORTH_6TH_SUANZAOLING);
      }
    } else {
      corridorName = '南六环-西六环跨区安全走廊';
      if (start.lng >= 116.2) {
        anchors.push(SAFE_ANCHORS.SOUTH_6TH_CIGEZHUANG);
      }
      anchors.push(SAFE_ANCHORS.WEST_6TH_QINGLONGHU);
      anchors.push(SAFE_ANCHORS.WEST_6TH_DAJUESI);
    }
  }

  if (anchors.length === 0) {
    return { matched: false, waypoints: [] };
  }

  const waypoints: Waypoint[] = anchors.map((a, idx) => ({
    id: `corridor-anchor-${idx}`,
    lng: a.lng,
    lat: a.lat,
    name: a.name,
  }));

  return {
    matched: true,
    corridorName,
    anchors,
    waypoints,
    reason: `跨区直距 ${distKm.toFixed(1)}km，可经由【${corridorName}】全程避让`,
  };
}
