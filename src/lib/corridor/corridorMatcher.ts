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

/** 判定当前路线是否已经实际沿用了该走廊骨干 */
export function isRouteFollowingCorridor(
  path: LngLat[],
  anchors: CorridorAnchor[],
): boolean {
  if (!path || path.length === 0 || !anchors || anchors.length === 0) {
    return false;
  }
  return anchors.some((anchor) =>
    path.some((p) => {
      const dLng = (p.lng - anchor.lng) * 85;
      const dLat = (p.lat - anchor.lat) * 111;
      return Math.hypot(dLng, dLat) < 3.5;
    }),
  );
}

/**
 * 针对跨区长途或东西横跨出行，动态拟合全六环（北/东/南/西）闭环骨干安全通道
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
  const deltaLng = Math.abs(end.lng - start.lng);

  const anchors: CorridorAnchor[] = [];
  let corridorName = '';

  // 场景 1：北部东西向横跨（海淀山后/永丰/航天城 <-> 昌平中东部/名佳花园/北七家/顺义）
  // 北清路地面监控密集，北六环为天然无探头快速横跨动脉（两点直线跨度 ≥ 10km）
  const isNorthernEastWest =
    start.lat >= 40.02 &&
    end.lat >= 40.02 &&
    deltaLng >= 0.12 &&
    ((start.lng <= 116.3 && end.lng >= 116.36) ||
      (start.lng >= 116.36 && end.lng <= 116.3));

  if (isNorthernEastWest) {
    corridorName = '北六环横向安全走廊';
    if (start.lng < end.lng) {
      // 西向东（如永丰 -> 名佳花园）：引导上北六环小汤山互通向东
      anchors.push(SAFE_ANCHORS.NORTH_6TH_XIAOTANGSHAN);
    } else {
      // 东向西（如名佳花园 -> 永丰）：引导沿北六环小汤山 -> 沙阳路向西下
      anchors.push(SAFE_ANCHORS.NORTH_6TH_XIAOTANGSHAN);
      anchors.push(SAFE_ANCHORS.NORTH_6TH_SHAYANG);
    }
  } else if (
    // 场景 2：南部东西向横跨（房山良乡 <-> 大兴黄村/亦庄）
    start.lat <= 39.85 &&
    end.lat <= 39.85 &&
    deltaLng >= 0.12 &&
    ((start.lng <= 116.22 && end.lng >= 116.32) ||
      (start.lng >= 116.32 && end.lng <= 116.22))
  ) {
    corridorName = '南六环横向安全走廊';
    anchors.push(SAFE_ANCHORS.SOUTH_6TH_CIGEZHUANG);
  } else if (
    // 场景 3：南北向纵向大跨区（如昌平/顺义 <-> 大兴/房山/野生动物园，直距 ≥ 25km）
    distKm >= 25 &&
    ((fromRegion === 'north' && toRegion === 'south') ||
      (fromRegion === 'south' && toRegion === 'north'))
  ) {
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
    } else {
      // 南向北
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
  }

  if (anchors.length === 0) {
    return {
      matched: false,
      waypoints: [],
      reason: '当前出行无需启用六环骨干走廊',
    };
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
    reason: `检测到出行跨越特征，推荐切换至【${corridorName}】彻底规避`,
  };
}
