import type { LngLat, ManualAvoidArea, RingFilter, RouteRisk, Waypoint } from '../types';
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

interface CandidatePoint {
  index: number;
  lng: number;
  lat: number;
  name: string;
  isUserP0?: boolean;
}

/**
 * 智能因果决策导航途经点引擎
 * 核心智能判断逻辑：
 * 1. 【因果溯源，只打关键分流点】：
 *    只有真正因规避监控而发生航向偏离、存在被高德诱导上高速/主路风险的区间，才智能打点；
 *    纯直道、自然顺行公路上，智能判定为高德天然最优路线，坚决 0 打点。
 * 2. 【避让风险群空间聚类】：
 *    将密集的避让监控点（如北六环沿线一整排探头）聚类为一个冲突带，
 *    在规划路线上只提取绕行该冲突带的 1~2 个关键分流转折点，一锤定音锁死地面走廊。
 * 3. 【出环关门智能研判】：
 *    由内向外驶出六环时，在最后一个地面走廊交界处智能落入关门锚点，封死出环前的最后一公里。
 * 4. 【用户意志 P0 绝对优先】：
 *    手动添加的避让区和途经点 100% 保留。
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

  // 1. 用户主动设置的途经点与避让区（P0 绝对保留）
  const candidates: CandidatePoint[] = [];

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

  // 2. 智能筛选当前生效的规避探头（六环内模式下只看内环管控探头）
  const effectiveRisks = avoidedRisks.filter((r) => {
    if (ringFilter === 'inside') return r.type !== '6';
    if (ringFilter === 'outside') return r.type === '6';
    return true;
  });

  // 若无任何避让探头，且无手动项：智能判定“路线完全天然合法，直道与弯道均无需干预”，0 点直达
  if (effectiveRisks.length === 0 && candidates.length === 0) {
    return [];
  }

  // 3. 风险群聚类（将相距 2.5km 以内的探头合并为一个冲突带）
  // 对路线进行高精 RDP 拐点提取（约 150m 精度，抓取真实路口分流与转弯）
  const rdpCorners = rdp(routePath, 0.0014);
  const rdpIndexSet = new Set<number>();
  for (const corner of rdpCorners) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < routePath.length; i++) {
      const d = getDistanceM(routePath[i]!, corner);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
        if (d < 10) break;
      }
    }
    rdpIndexSet.add(bestIdx);
  }

  // 找到每个有效避让点在路径上投影的最优对应点
  const riskPathIndices: number[] = [];
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
    // 只有路径真正靠近过该探头影响域（2.5km内）才算有效绕行
    if (minDist <= 2500) {
      riskPathIndices.push(nearestIdx);
    }
  }

  riskPathIndices.sort((a, b) => a - b);

  // 4. 将规避区域划分为连续的避让冲突区间 [startIdx, endIdx]
  const evasionZones: { start: number; end: number }[] = [];
  for (const idx of riskPathIndices) {
    // 寻找避让区间（前后各延伸 1.5km）
    let startIdx = idx;
    let endIdx = idx;
    let accumulated = 0;

    while (startIdx > 0 && accumulated < 1500) {
      startIdx--;
      accumulated += getDistanceM(routePath[startIdx]!, routePath[startIdx + 1]!);
    }

    accumulated = 0;
    while (endIdx < routePath.length - 1 && accumulated < 1500) {
      endIdx++;
      accumulated += getDistanceM(routePath[endIdx - 1]!, routePath[endIdx]!);
    }

    if (evasionZones.length === 0) {
      evasionZones.push({ start: startIdx, end: endIdx });
    } else {
      const lastZone = evasionZones[evasionZones.length - 1]!;
      if (startIdx <= lastZone.end) {
        // 重叠合并
        lastZone.end = Math.max(lastZone.end, endIdx);
      } else {
        evasionZones.push({ start: startIdx, end: endIdx });
      }
    }
  }

  // 5. 【智能提取决策点】：只在每一个规避区间内，挑选 1~2 个最关键的 RDP 转折路口
  // 区间之外的纯直道和自然山路弯道，1 个点都不加！
  let maxEvasionIndex = -1;

  for (const zone of evasionZones) {
    maxEvasionIndex = Math.max(maxEvasionIndex, zone.end);

    // 在该避让区间内寻找真正的决策拐点
    const cornersInZone: number[] = [];
    for (let i = zone.start; i <= zone.end; i++) {
      if (rdpIndexSet.has(i)) {
        cornersInZone.push(i);
      }
    }

    if (cornersInZone.length === 0) {
      // 若避让区间内没有大转弯（如一条直的辅路避开主路），在区间中段抓 1 个辅路点即可
      const mid = Math.floor((zone.start + zone.end) / 2);
      candidates.push({
        index: mid,
        lng: routePath[mid]!.lng,
        lat: routePath[mid]!.lat,
        name: '避让辅路通道',
      });
    } else {
      // 区间内只取相距 >= 1.5km 的核心转折点，通常最多提取 1~2 个
      let lastCornerIdx = -1;
      for (const cornerIdx of cornersInZone) {
        if (
          lastCornerIdx === -1 ||
          getDistanceM(routePath[lastCornerIdx]!, routePath[cornerIdx]!) >= 1500
        ) {
          candidates.push({
            index: cornerIdx,
            lng: routePath[cornerIdx]!.lng,
            lat: routePath[cornerIdx]!.lat,
            name: '避让分流转折',
          });
          lastCornerIdx = cornerIdx;
        }
      }
    }
  }

  // 6. 【出环关门智能研判】：若最后一个避让区后面还有较长行程（出环长途），
  // 在刚离开最后一个避让区的地面交界处落 1 个关门点，锁死出环走廊
  if (maxEvasionIndex > 0 && maxEvasionIndex < routePath.length - 1) {
    let distToEnd = 0;
    for (let i = maxEvasionIndex; i < routePath.length - 1; i++) {
      distToEnd += getDistanceM(routePath[i]!, routePath[i + 1]!);
    }

    if (distToEnd > 2000) {
      // 沿路向前 600m 找到出口交界点
      let gateIdx = maxEvasionIndex;
      let walked = 0;
      while (gateIdx < routePath.length - 2 && walked < 600) {
        gateIdx++;
        walked += getDistanceM(routePath[gateIdx - 1]!, routePath[gateIdx]!);
      }
      candidates.push({
        index: gateIdx,
        lng: routePath[gateIdx]!.lng,
        lat: routePath[gateIdx]!.lat,
        name: '出环安全通道',
      });
    }
  }

  // 7. 排序与盲区过滤（距起终点小于 350m 排除）
  candidates.sort((a, b) => a.index - b.index);

  const validCandidates = candidates.filter((c) => {
    if (c.isUserP0) return true;
    const distToStart = getDistanceM(routePath[0]!, c);
    const distToEnd = getDistanceM(routePath[routePath.length - 1]!, c);
    return distToStart >= 350 && distToEnd >= 350;
  });

  // 8. 1.2km 防抖去密，截取最多 maxWaypoints（通常仅产生 3~5 个高价值点）
  const deduped: CandidatePoint[] = [];
  for (const item of validCandidates) {
    if (deduped.length === 0) {
      deduped.push(item);
      continue;
    }

    const prev = deduped[deduped.length - 1]!;
    const distFromPrev = getDistanceM(prev, item);

    if (item.isUserP0 || distFromPrev >= 1200) {
      deduped.push(item);
    }
  }

  return deduped.slice(0, maxWaypoints).map((p, i) => ({
    lng: p.lng,
    lat: p.lat,
    name: p.name || `关键点${i + 1}`,
  }));
}
