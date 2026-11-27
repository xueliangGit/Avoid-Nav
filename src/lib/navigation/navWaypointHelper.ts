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
    // 全部模式：全北京市监控均属管控区
    const nearby = spatialIndex.search(point.lng, point.lat, 3.5);
    return nearby.length > 0;
  }
  // 仅六环内模式：仅六环内探头(type !== '6')属于需严防被高德抄近道的敏感区
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
 * 差量精准与敏感带防偏导航途经点生成器
 * 核心原理：
 * 1. 绝对优先保留用户手动设置的途经点与避让区（P0）
 * 2. 空间敏感带感知：在六环内及六环高速走廊边缘（3.5km内有进京管控），高德极易诱导上主路/六环高速，
 *    在此区间使用精细 RDP 抽稀与最大 3.5km 间距约束，把车死死锁在规划出的地面辅路/非管制路线上。
 * 3. 远郊自由安全区（如怀柔密云深处远离六环）：大幅放宽间距（18km），绝不多插点。
 * 4. 800m 最小间距去密合并，杜绝报点轰炸，总点数严格控制在 14 个以内。
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

  // 3. 将路径划分为【敏感管控区】与【安全自由区】进行自适应采样
  // 敏感管控区（六环内及六环走廊周边）：几何精度高（epsilon ≈ 100m），最大步长 3.5km，确保高德不上高速主路
  // 安全自由区（远离六环的远郊）：几何精度低，最大步长 18km，绝不多插点
  const sampledPoints: CandidatePoint[] = [];
  let accumulatedDist = 0;

  // 使用精细 RDP 提取路径的所有主要拐点索引
  const rdpPoints = rdp(routePath, 0.001); // 约 110m 几何精度
  const rdpIndices = new Set<number>();
  for (const rp of rdpPoints) {
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
    rdpIndices.add(bestIdx);
  }

  for (let i = 1; i < routePath.length - 1; i++) {
    const pt = routePath[i]!;
    const prevPt = routePath[i - 1]!;
    accumulatedDist += getDistanceM(prevPt, pt);

    const isSensitive = isNearControlZone(pt, ringFilter);
    const maxGap = isSensitive ? 3500 : 18000; // 敏感区 3.5km 必有一点，安全区 18km
    const isRdpCorner = rdpIndices.has(i);

    // 触发采样条件：
    // a. 在敏感管控区且属于 RDP 几何拐点，且距上个采样点 >= 800米
    // b. 跨度达到最大间距（敏感区 3.5km，防止两点之间被高德拉上六环高速）
    if (
      (isSensitive && isRdpCorner && accumulatedDist >= 800) ||
      accumulatedDist >= maxGap
    ) {
      sampledPoints.push({
        index: i,
        lng: pt.lng,
        lat: pt.lat,
        name: isSensitive ? '避让地面走廊' : '骨干道路转折',
      });
      accumulatedDist = 0;
    }
  }

  candidates.push(...sampledPoints);

  // 4. 按路径自然顺序排序
  candidates.sort((a, b) => a.index - b.index);

  // 5. 过滤起终点盲区（距起点或终点小于 350 米不打点，由起终点接管）
  const validCandidates = candidates.filter((c) => {
    if (c.isUserP0) return true;
    const distToStart = getDistanceM(routePath[0]!, c);
    const distToEnd = getDistanceM(routePath[routePath.length - 1]!, c);
    return distToStart >= 350 && distToEnd >= 350;
  });

  // 6. 800米最小间距去密合并（防导航语音轰炸）
  const deduped: CandidatePoint[] = [];
  for (const item of validCandidates) {
    if (deduped.length === 0) {
      deduped.push(item);
      continue;
    }

    const prev = deduped[deduped.length - 1]!;
    const distFromPrev = getDistanceM(prev, item);

    // 用户点一律保留；自动点间距 < 800 米时合并
    if (item.isUserP0 || distFromPrev >= 800) {
      deduped.push(item);
    }
  }

  // 7. 截取最多 maxWaypoints 并规范命名
  return deduped.slice(0, maxWaypoints).map((p, i) => ({
    lng: p.lng,
    lat: p.lat,
    name: p.name || `关键点${i + 1}`,
  }));
}
