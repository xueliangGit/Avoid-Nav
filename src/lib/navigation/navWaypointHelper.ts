import type { LngLat, ManualAvoidArea, RingFilter, RouteRisk, Waypoint } from '../types';
import { spatialIndex } from '../spatial';
import { rdp } from '../utils/rdp';

export interface GenerateNavWaypointsParams {
  routePath: LngLat[];
  avoidedRisks: RouteRisk[];
  manualAvoidAreas?: ManualAvoidArea[];
  waypoints?: Waypoint[];
  ringFilter: RingFilter;
  maxWaypoints?: number;
}

export interface NavWaypointItem {
  lng: number;
  lat: number;
  name: string;
}

/** 计算两点之间的大致球面距离（米） */
function getDistanceM(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 判断某坐标是否处于六环内监控/敏感管控带周边（3.5km 辐射圈内） */
function isNearControlZone(point: LngLat, ringFilter: RingFilter): boolean {
  if (ringFilter === 'all') {
    const nearby = spatialIndex.search(point.lng, point.lat, 3.5);
    return nearby.length > 0;
  }
  const nearby = spatialIndex.search(point.lng, point.lat, 3.5);
  return nearby.some((c) => c.type !== '6');
}

interface CandidatePoint {
  index: number;
  lng: number;
  lat: number;
  name: string;
  isUserP0?: boolean;
}

/**
 * 决策拐点精准提取器（零直道冗余）
 * 核心优化原则：
 * 1. 废除所有直线上按固定距离生硬打点的逻辑：直道上没有分流风险，坚决 0 打点
 * 2. 仅在真正的决策拐点（路口转向、匝道分流）打点，确保高德转向路径与规划完全一致
 * 3. 敏感管控区（六环内及走廊）：抓取关键转折路口（1.2km 防抖合并），杜绝上六环高速
 * 4. 远郊自由安全区：大幅稀疏，仅保留超过 20km 的干道大转折点，直路一律不打点
 * 5. 用户手动添加的点（P0）绝对优先保留
 */
export function generateNavWaypoints({
  routePath,
  manualAvoidAreas = [],
  waypoints = [],
  ringFilter,
  maxWaypoints = 14,
}: GenerateNavWaypointsParams): NavWaypointItem[] {
  if (routePath.length < 2) return [];

  const candidates: CandidatePoint[] = [];

  // 1. 用户主动设置的途经点（P0 保留）
  for (const wp of waypoints) {
    let nearestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < routePath.length; i++) {
      const d = getDistanceM(routePath[i]!, wp);
      if (d < minDist) {
        minDist = d;
        nearestIdx = i;
      }
    }
    candidates.push({
      index: nearestIdx,
      lng: wp.lng,
      lat: wp.lat,
      name: wp.name || '途经点',
      isUserP0: true,
    });
  }

  // 2. 用户手动避让区（P0 保留）：在路径上找最近的实际绕行点
  for (const area of manualAvoidAreas) {
    let nearestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < routePath.length; i++) {
      const d = getDistanceM(routePath[i]!, area);
      if (d < minDist) {
        minDist = d;
        nearestIdx = i;
      }
    }
    const pt = routePath[nearestIdx]!;
    candidates.push({
      index: nearestIdx,
      lng: pt.lng,
      lat: pt.lat,
      name: area.label ? `避开:${area.label}` : '手动避让点',
      isUserP0: true,
    });
  }

  // 3. 几何决策拐点提取（仅在道路发生实质性转向/变向处采点，直道上绝对不采点）
  // 敏感管控区精度约 150m (0.0014°)，远郊安全区精度约 800m (0.0075°)
  const rdpSensitive = rdp(routePath, 0.0014);
  const rdpSafe = rdp(routePath, 0.0075);

  const keyIndices = new Map<number, boolean>(); // index -> isSensitive

  for (const rp of rdpSensitive) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < routePath.length; i++) {
      const d = getDistanceM(routePath[i]!, rp);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
        if (d < 10) break;
      }
    }
    const isSensitive = isNearControlZone(routePath[bestIdx]!, ringFilter);
    if (isSensitive) {
      keyIndices.set(bestIdx, true);
    }
  }

  // 远郊安全区仅保留大跨度骨干转折点
  for (const rp of rdpSafe) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < routePath.length; i++) {
      const d = getDistanceM(routePath[i]!, rp);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
        if (d < 15) break;
      }
    }
    const isSensitive = isNearControlZone(routePath[bestIdx]!, ringFilter);
    if (!isSensitive && !keyIndices.has(bestIdx)) {
      keyIndices.set(bestIdx, false);
    }
  }

  for (const [idx, isSensitive] of keyIndices.entries()) {
    const pt = routePath[idx]!;
    candidates.push({
      index: idx,
      lng: pt.lng,
      lat: pt.lat,
      name: isSensitive ? '避让地面走廊' : '骨干道路转折',
    });
  }

  // 4. 按路径自然顺序排序
  candidates.sort((a, b) => a.index - b.index);

  // 5. 过滤起终点盲区（距起点或终点小于 350 米不打点，由起终点接管）
  const validCandidates = candidates.filter((c) => {
    if (c.isUserP0) return true;
    const distToStart = getDistanceM(routePath[0]!, c);
    const distToEnd = getDistanceM(routePath[routePath.length - 1]!, c);
    return distToStart >= 350 && distToEnd >= 350;
  });

  // 6. 动态防抖去密（敏感区保持 1.2km 间距，远郊保持 10km 间距，消除直道和微弯冗余）
  const deduped: CandidatePoint[] = [];
  for (const item of validCandidates) {
    if (deduped.length === 0) {
      deduped.push(item);
      continue;
    }

    const prev = deduped[deduped.length - 1]!;
    const distFromPrev = getDistanceM(prev, item);
    const isSensitive = isNearControlZone(item, ringFilter);
    const minSpacing = isSensitive ? 1200 : 10000;

    if (item.isUserP0 || distFromPrev >= minSpacing) {
      deduped.push(item);
    }
  }

  // 7. 截取最多 maxWaypoints 并规范命名（通常精简为 3~6 个核心决策点）
  return deduped.slice(0, maxWaypoints).map((p, i) => ({
    lng: p.lng,
    lat: p.lat,
    name: p.name || `关键点${i + 1}`,
  }));
}
