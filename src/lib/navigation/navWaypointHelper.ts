import type { LngLat, ManualAvoidArea, RingFilter, RouteRisk, Waypoint } from '../types';

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

/** 沿着路径从指定索引向指定方向累积行进目标距离（米），返回目标索引 */
function walkPathIndex(
  path: LngLat[],
  startIdx: number,
  targetMeters: number,
  direction: 'upstream' | 'downstream',
): number {
  let accumulated = 0;
  let currentIdx = startIdx;
  const step = direction === 'upstream' ? -1 : 1;

  while (
    (direction === 'upstream' ? currentIdx > 0 : currentIdx < path.length - 1) &&
    accumulated < targetMeters
  ) {
    const nextIdx = currentIdx + step;
    accumulated += getDistanceM(path[currentIdx]!, path[nextIdx]!);
    currentIdx = nextIdx;
  }

  return currentIdx;
}

interface CandidatePoint {
  index: number;
  lng: number;
  lat: number;
  name: string;
  isUserP0?: boolean;
}

/**
 * 差量精准导航途经点生成器
 * 1. 优先保留用户手动设置的途经点与避让区（P0）
 * 2. 仅对实际发生规避的探头进行迎风回退（180m），锁定主路下辅路的分流匝道
 * 3. 严格保障出六环前安全：出环方向前向延展 700m 打下【出环关门锚点】，防止提前并回高速主线
 * 4. 800m 间距去密聚类，杜绝高频报点轰炸
 */
export function generateNavWaypoints({
  routePath,
  avoidedRisks,
  manualAvoidAreas = [],
  waypoints = [],
  ringFilter,
  maxWaypoints = 14,
}: GenerateNavWaypointsParams): NavWaypointItem[] {
  if (routePath.length < 2) return [];

  // 全程无任何避让且无用户手动点：0 途经点，直达
  if (avoidedRisks.length === 0 && manualAvoidAreas.length === 0 && waypoints.length === 0) {
    return [];
  }

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

  // 3. 过滤需要处理的避让探头（六环内模式下仅处理六环内探头）
  const effectiveRisks = avoidedRisks.filter((r) => {
    if (ringFilter === 'inside') return r.type !== '6';
    if (ringFilter === 'outside') return r.type === '6';
    return true;
  });

  let maxInsideRiskIdx = -1;

  for (const risk of effectiveRisks) {
    let nearestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < routePath.length; i++) {
      const d = getDistanceM(routePath[i]!, risk);
      if (d < minDist) {
        minDist = d;
        nearestIdx = i;
      }
    }

    // 仅当路径与探头距离处于规避辐射范围内（500米以内）才提取
    if (minDist <= 500) {
      if (nearestIdx > maxInsideRiskIdx) {
        maxInsideRiskIdx = nearestIdx;
      }

      // 迎风回退 180 米抓取主路下辅路的匝道分流切入口，防止物理隔离无法下道
      const upstreamIdx = walkPathIndex(routePath, nearestIdx, 180, 'upstream');
      const targetPoint = routePath[upstreamIdx]!;

      candidates.push({
        index: upstreamIdx,
        lng: targetPoint.lng,
        lat: targetPoint.lat,
        name: `避让辅路入口`,
      });
    }
  }

  // 4. 【出环关门锚点（Exit Gatekeeper）】：保障出六环前全程安全
  // 若最后一个内环避让点之后还有超过 1200 米的行程，向前延展 700 米设置关门锚点
  // 强行锁死辅路/地面通行走廊，阻止高德在出六环前提前并上有抓拍的高速主路
  if (maxInsideRiskIdx >= 0 && maxInsideRiskIdx < routePath.length - 1) {
    let distToEnd = 0;
    for (let i = maxInsideRiskIdx; i < routePath.length - 1; i++) {
      distToEnd += getDistanceM(routePath[i]!, routePath[i + 1]!);
    }

    if (distToEnd > 1200) {
      const gateIdx = walkPathIndex(routePath, maxInsideRiskIdx, 700, 'downstream');
      if (gateIdx < routePath.length - 2) {
        const gatePoint = routePath[gateIdx]!;
        candidates.push({
          index: gateIdx,
          lng: gatePoint.lng,
          lat: gatePoint.lat,
          name: '出环安全通道',
        });
      }
    }
  }

  // 5. 按路径自然顺序排序
  candidates.sort((a, b) => a.index - b.index);

  // 6. 过滤起终点盲区（距起点或终点小于 250 米不打点，起终点自带）
  const validCandidates = candidates.filter((c) => {
    if (c.isUserP0) return true;
    const distToStart = getDistanceM(routePath[0]!, c);
    const distToEnd = getDistanceM(routePath[routePath.length - 1]!, c);
    return distToStart >= 250 && distToEnd >= 250;
  });

  // 7. 800米最小间距去密合并（防导航语音轰炸）
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

  // 8. 截取最多 maxWaypoints 并规范命名
  return deduped.slice(0, maxWaypoints).map((p, i) => ({
    lng: p.lng,
    lat: p.lat,
    name: p.name || `关键点${i + 1}`,
  }));
}
