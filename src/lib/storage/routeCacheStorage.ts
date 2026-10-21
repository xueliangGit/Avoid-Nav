// src/lib/storage/routeCacheStorage.ts
import type { CachedRoutePlan, RouteFingerprintInput } from './routeCacheTypes';
import { computeRouteFingerprint, isNearCoord } from './routeCachePolicy';

const CACHE_STORAGE_KEY = 'avoid-nav:route-plan-cache:v2';
const MAX_CACHE_ENTRIES = 10;

/** 压缩经纬度点，保留 6 位小数，大幅节省 localStorage 空间 */
function compressLngLats(pts: { lng: number; lat: number }[]): { lng: number; lat: number }[] {
  return pts.map((p) => ({
    lng: Number(p.lng.toFixed(6)),
    lat: Number(p.lat.toFixed(6)),
  }));
}

function readAll(): CachedRoutePlan[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list as CachedRoutePlan[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: CachedRoutePlan[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // 若超出配额，淘汰一半最老数据后再次尝试
    try {
      const halved = entries.slice(0, Math.max(1, Math.floor(entries.length / 2)));
      window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(halved));
    } catch {
      // 极端配额耗尽，静默安全忽略
    }
  }
}

class RoutePlanCacheStorage {
  private cache: CachedRoutePlan[] = [];
  private hydrated = false;

  private hydrate() {
    if (this.hydrated) return;
    this.cache = readAll().sort((a, b) => b.cachedAt - a.cachedAt);
    this.hydrated = true;
  }

  /** 根据输入条件匹配历史规划（支持 50m 容差匹配） */
  find(input: RouteFingerprintInput): CachedRoutePlan | null {
    if (!input.start || !input.end) return null;
    this.hydrate();

    const targetFp = computeRouteFingerprint(input);

    // 1. 优先精确指纹匹配
    const exact = this.cache.find((item) => item.fingerprint === targetFp);
    if (exact) return exact;

    // 2. 次选起止点 50m GPS 容差模糊匹配
    return (
      this.cache.find((item) => {
        const startNear = isNearCoord(
          item.start.lng,
          item.start.lat,
          input.start!.lng,
          input.start!.lat,
        );
        const endNear = isNearCoord(
          item.end.lng,
          item.end.lat,
          input.end!.lng,
          input.end!.lat,
        );
        if (!startNear || !endNear) return false;

        // 途经点数量必须一致
        if ((item.waypoints?.length || 0) !== (input.waypoints?.length || 0)) return false;
        return true;
      }) ?? null
    );
  }

  /** 保存一次新的规划结果（LRU 限制 10 条） */
  save(
    input: RouteFingerprintInput,
    data: Omit<CachedRoutePlan, 'id' | 'fingerprint' | 'cachedAt' | 'start' | 'end' | 'waypoints'>,
  ): CachedRoutePlan {
    this.hydrate();
    if (!input.start || !input.end) {
      throw new Error('起止点不能为空');
    }

    const fingerprint = computeRouteFingerprint(input);
    const now = Date.now();

    const entry: CachedRoutePlan = {
      id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      fingerprint,
      cachedAt: now,
      start: input.start,
      end: input.end,
      waypoints: input.waypoints || [],
      routeInfo: data.routeInfo,
      routePath: compressLngLats(data.routePath),
      avoidedRisks: data.avoidedRisks,
      routeRisks: data.routeRisks,
      safelyIgnoredRisks: data.safelyIgnoredRisks,
      deadRisks: data.deadRisks,
      finalPolygons: data.finalPolygons,
    };

    // 移除同指纹旧记录，新记录置顶
    const filtered = this.cache.filter((item) => item.fingerprint !== fingerprint);
    this.cache = [entry, ...filtered].slice(0, MAX_CACHE_ENTRIES);

    writeAll(this.cache);
    return entry;
  }

  /** 获取所有历史缓存列表 */
  list(): CachedRoutePlan[] {
    this.hydrate();
    return this.cache;
  }

  /** 清空规划缓存 */
  clear(): void {
    this.cache = [];
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CACHE_STORAGE_KEY);
    }
  }
}

export const routeCacheStorage = new RoutePlanCacheStorage();
