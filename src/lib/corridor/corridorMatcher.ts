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

/**
 * 针对长距离跨区出行，动态拟合全六环（北/东/南/西）闭环骨干安全通道并生成引导途经点
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

  // 2. 仅针对直线距离 ≥ 25km 的跨大区出行生效（杜绝短途折返）
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

  // 3. 北向南跨区长途调度（如昌平/顺义 -> 大兴/房山/通州）
  if (fromRegion === 'north' && toRegion === 'south') {
    // 若起点在昌平中东部（lng >= 116.36，如名佳花园/北七家/小汤山）或顺义/朝阳东：
    // 强烈优先走【东六环 + 南六环走廊】！
    // 根本原因：从北七家向西去西六环需横穿京藏高速史各庄/北清路，必撞密集探头且多绕25公里；
    // 走东六环转南六环，经酸枣岭一路高速向南向西，完全远离城区拥堵与探头。
    if (start.lng >= 116.36) {
      corridorName = '东六环-南六环跨区安全走廊 (北向南)';
      if (start.lng < 116.55) {
        anchors.push(SAFE_ANCHORS.NORTH_6TH_SUANZAOLING);
      }
      anchors.push(SAFE_ANCHORS.EAST_6TH_XUXINZHUANG);
      // 南段按终点位置精准接驳南六环
      if (end.lng <= 116.45) {
        anchors.push(SAFE_ANCHORS.SOUTH_6TH_CIGEZHUANG);
      } else {
        anchors.push(SAFE_ANCHORS.SOUTH_6TH_CHANGZIYING);
      }
    } else {
      // 起点在西北部（昌平老城、南口、海淀山后）：走【西六环 + 南六环走廊】
      corridorName = '西六环-南六环跨区安全走廊 (北向南)';
      anchors.push(SAFE_ANCHORS.WEST_6TH_DAJUESI);
      anchors.push(SAFE_ANCHORS.WEST_6TH_QINGLONGHU);
      // 关键补齐：南六环接驳（若终点在大兴南部如野生动物园）
      if (end.lng >= 116.2) {
        anchors.push(SAFE_ANCHORS.SOUTH_6TH_CIGEZHUANG);
      }
    }
  } else if (fromRegion === 'south' && toRegion === 'north') {
    // 4. 南向北跨区长途调度（如野生动物园/大兴/房山 -> 昌平/顺义）
    if (end.lng >= 116.36) {
      // 终点在昌平东部或顺义：走【南六环 + 东六环走廊】
      corridorName = '南六环-东六环跨区安全走廊 (南向北)';
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
      // 终点在西北部：走【南六环 + 西六环走廊】
      corridorName = '南六环-西六环跨区安全走廊 (南向北)';
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
    waypoints,
    reason: `检测到 ${distKm.toFixed(1)}km 长途跨区，已自动激活【${corridorName}】`,
  };
}
