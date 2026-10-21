// src/lib/storage/routeCachePolicy.ts
import type {
  CacheEvaluation,
  CachedRoutePlan,
  RouteFingerprintInput,
} from './routeCacheTypes';

/** 缓存有效期，超过 15 分钟视为陈旧路况，需要自动刷新 */
export const CACHE_TTL_MS = 15 * 60 * 1000;

/** GPS 坐标 50 米容差判断（针对“我的位置”轻微飘移） */
export function isNearCoord(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number,
  maxMeters = 50,
): boolean {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const distance = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return distance <= maxMeters;
}

/** 规范化浮点数，保留 5 位小数（约 1 米精度）以消除微小浮动误差 */
function normCoord(n: number): string {
  return n.toFixed(5);
}

/** 计算路线输入的唯一特征签名（指纹） */
export function computeRouteFingerprint(input: RouteFingerprintInput): string {
  if (!input.start || !input.end) return '';

  const startPart = `${normCoord(input.start.lng)},${normCoord(input.start.lat)}`;
  const endPart = `${normCoord(input.end.lng)},${normCoord(input.end.lat)}`;

  const waypointsPart = (input.waypoints || [])
    .map((w) => `${normCoord(w.lng)},${normCoord(w.lat)}`)
    .sort()
    .join('|');

  const manualAreasPart = (input.manualAvoidAreas || [])
    .map((m) => `${normCoord(m.lng)},${normCoord(m.lat)}:${m.size || 'medium'}`)
    .sort()
    .join('|');

  const ignoredSet = Array.isArray(input.ignoredRiskIds)
    ? input.ignoredRiskIds
    : Array.from(input.ignoredRiskIds || []);
  const forcedSet = Array.isArray(input.forcedRiskIds)
    ? input.forcedRiskIds
    : Array.from(input.forcedRiskIds || []);

  const ignoredPart = ignoredSet.sort().join(',');
  const forcedPart = forcedSet.sort().join(',');

  const optionsPart = `${input.riskAvoidSize || 'medium'}:${input.ringFilter || 'all'}:${
    input.avoidDeadPoints ? '1' : '0'
  }`;

  return `R:[${startPart}]->[${endPart}]|W:[${waypointsPart}]|M:[${manualAreasPart}]|I:[${ignoredPart}]|F:[${forcedPart}]|O:[${optionsPart}]`;
}

/**
 * 检查当前时间与缓存时刻是否跨越了北京早晚高峰临界时段
 * 临界点：07:00, 09:00, 17:00, 20:00
 */
export function hasCrossedPeakHour(cachedAt: number, now: number): boolean {
  if (now < cachedAt) return false;

  const cachedDate = new Date(cachedAt);
  const nowDate = new Date(now);

  // 跨天直接判定跨越
  if (
    cachedDate.getFullYear() !== nowDate.getFullYear() ||
    cachedDate.getMonth() !== nowDate.getMonth() ||
    cachedDate.getDate() !== nowDate.getDate()
  ) {
    return true;
  }

  const cachedMinutes = cachedDate.getHours() * 60 + cachedDate.getMinutes();
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  // 4 个限行临界时刻的分钟数：07:00(420), 09:00(540), 17:00(1020), 20:00(1200)
  const boundaryMinutes = [7 * 60, 9 * 60, 17 * 60, 20 * 60];

  for (const b of boundaryMinutes) {
    if (cachedMinutes < b && nowMinutes >= b) {
      return true;
    }
  }

  return false;
}

/**
 * 评估缓存记录的可用性
 */
export function evaluateRouteCache(
  cache: CachedRoutePlan | null | undefined,
  now = Date.now(),
): CacheEvaluation {
  if (!cache) {
    return { status: 'NOT_FOUND', ageMinutes: 0 };
  }

  const ageMs = Math.max(0, now - cache.cachedAt);
  const ageMinutes = Math.floor(ageMs / 60000);

  // 1. 核心安全红线：跨越早晚高峰临界点，强制报废
  if (hasCrossedPeakHour(cache.cachedAt, now)) {
    return {
      status: 'EXPIRED_PEAK',
      cache,
      ageMinutes,
      reason: '已跨越早/晚高峰限行临界时段，为避免违规扣分，必须重新规划',
    };
  }

  // 2. 超时判断：超过 15 分钟，进入过期状态（可秒开但需自动刷新）
  if (ageMs >= CACHE_TTL_MS) {
    return {
      status: 'STALE',
      cache,
      ageMinutes,
      reason: `规划于 ${ageMinutes} 分钟前，路况已发生变化，正在自动刷新最新路线`,
    };
  }

  // 3. 完全新鲜
  return {
    status: 'FRESH',
    cache,
    ageMinutes,
    reason: `已秒开恢复 ${ageMinutes === 0 ? '刚刚' : `${ageMinutes}分钟前`}的路线规划`,
  };
}
