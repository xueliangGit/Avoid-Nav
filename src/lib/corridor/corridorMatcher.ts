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
 * 针对长距离跨区出行，动态拟合安全走廊通道链并生成引导途经点
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

  // 3. 判断偏东还是偏西（以经度 116.45 为分界线）
  const isWesternBias = (start.lng + end.lng) / 2 <= 116.45;
  const anchors: CorridorAnchor[] = [];
  let corridorName = '';

  // 4. 南北向长途大跨度拓扑装配
  if (fromRegion === 'north' && toRegion === 'south') {
    if (isWesternBias) {
      corridorName = '北外环-西外环跨区安全走廊 (北向南)';
      // 关键几何判断：起点若在昌平中东部（lng >= 116.28，如名佳花园/北七家），
      // 必须先加北六环横向接驳点，避免车辆在昌平城区/北清路横切撞进探头密集区
      if (start.lng >= 116.28) {
        anchors.push(SAFE_ANCHORS.NORTH_6TH_XIAOTANGSHAN);
      }
      anchors.push(SAFE_ANCHORS.WEST_6TH_DAJUESI);
      anchors.push(SAFE_ANCHORS.WEST_6TH_QINGLONGHU);
    } else {
      corridorName = '东外环跨区安全走廊 (北向南)';
      anchors.push(SAFE_ANCHORS.EAST_6TH_XUXINZHUANG);
    }
  } else if (fromRegion === 'south' && toRegion === 'north') {
    if (isWesternBias) {
      corridorName = '西外环-北外环跨区安全走廊 (南向北)';
      anchors.push(SAFE_ANCHORS.WEST_6TH_QINGLONGHU);
      anchors.push(SAFE_ANCHORS.WEST_6TH_DAJUESI);
      // 终点若在昌平中东部（lng >= 116.28），引导从西六环转入北六环向东疏解
      if (end.lng >= 116.28) {
        anchors.push(SAFE_ANCHORS.NORTH_6TH_XIAOTANGSHAN);
      }
    } else {
      corridorName = '东外环跨区安全走廊 (南向北)';
      anchors.push(SAFE_ANCHORS.EAST_6TH_XUXINZHUANG);
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
