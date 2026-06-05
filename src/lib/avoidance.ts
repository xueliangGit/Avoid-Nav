import type { CameraPoint, LngLat, RingFilter, RouteRisk } from './types';
import { checkDirectionConflict, computeBearing, getDirAngle } from './direction';
import { spatialIndex } from './spatial';

// 单向避让矩形：沿朝向 50m × 垂直 50m（覆盖单方向车道）
const ALONG_HALF_M = 25;
const ACROSS_HALF_M = 25;
// 双向/无方向：60m × 60m 方形（覆盖左右两侧主路 + 辅路）
const OMNI_HALF_M = 30;
// 手动避让区三档尺寸（方形半边长，米）
export const MANUAL_SIZE_HALF_M = {
  small: 15,
  medium: 30,
  large: 50,
} as const;
// 自动风险点避让矩形三档尺寸（半边长，米）；medium 等于原固定值
export const RISK_SIZE_HALF_M = {
  small: 20,
  medium: 30,
  large: 45,
} as const;
export type AvoidSize = 'small' | 'medium' | 'large';
// 聚类合并参数：仅把沿路紧挨着的同向风险点合并成一个包围盒
const CLUSTER_GAP_M = 150; // 相邻两点间距 < 此值才并入同簇
const MAX_CLUSTER_SPAN_M = 300; // 单簇包围盒最大边长，超出则强制拆分（防止误封长路）
const DEFAULT_SCAN_RADIUS_KM = 0.12;
const SAMPLE_STEP_KM = 0.04;

// 1° 纬度 ≈ 111000m；1° 经度 ≈ 111000 * cos(lat) m
function metersToDegLat(m: number): number {
  return m / 111000;
}
function metersToDegLng(m: number, lat: number): number {
  return m / (111000 * Math.cos((lat * Math.PI) / 180));
}

// 把方位角(北=0,顺时针)转成弧度，并返回沿向量、垂直向量（单位 m → deg 已外部处理）
function bearingVectors(bearingDeg: number, lat: number, alongM: number, acrossM: number) {
  const rad = (bearingDeg * Math.PI) / 180;
  // 单位向量：沿方位角 (sin θ, cos θ) 表示 (E, N)；按米转度
  const eAlong = Math.sin(rad);
  const nAlong = Math.cos(rad);
  // 垂直向量：方位角 + 90°
  const radPerp = rad + Math.PI / 2;
  const eAcross = Math.sin(radPerp);
  const nAcross = Math.cos(radPerp);

  const dLatPerM = metersToDegLat(1);
  const dLngPerM = metersToDegLng(1, lat);

  return {
    along: { dLng: eAlong * alongM * dLngPerM, dLat: nAlong * alongM * dLatPerM },
    across: { dLng: eAcross * acrossM * dLngPerM, dLat: nAcross * acrossM * dLatPerM },
  };
}

// 默认无方向（双向） → 方形，覆盖左右两侧车道
function defaultSquarePolygon(
  lng: number,
  lat: number,
  halfM: number = OMNI_HALF_M,
): [number, number][] {
  const dLat = metersToDegLat(halfM);
  const dLng = metersToDegLng(halfM, lat);
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
  ];
}

// 手动避让区：固定方形，按 size 缩放
export function manualAreaToPolygon(
  lng: number,
  lat: number,
  size: 'small' | 'medium' | 'large' = 'medium',
): [number, number][] {
  const halfM = MANUAL_SIZE_HALF_M[size];
  const dLat = metersToDegLat(halfM);
  const dLng = metersToDegLng(halfM, lat);
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
  ];
}

// 沿方向构造矩形：中心 (lng,lat)，沿方位角 ±alongHalfM，垂直 ±acrossHalfM
export function pointToAvoidPolygon(
  lng: number,
  lat: number,
  direction?: string,
  alongHalfM: number = ALONG_HALF_M,
  acrossHalfM: number = ACROSS_HALF_M,
): [number, number][] {
  const bearing = direction ? getDirAngle(direction) : null;
  if (bearing === null) {
    return defaultSquarePolygon(lng, lat, acrossHalfM);
  }
  const { along, across } = bearingVectors(bearing, lat, alongHalfM, acrossHalfM);
  // 4 角：中心 ± along ± across
  const corner = (signA: number, signC: number): [number, number] => [
    lng + signA * along.dLng + signC * across.dLng,
    lat + signA * along.dLat + signC * across.dLat,
  ];
  return [
    corner(+1, +1),
    corner(+1, -1),
    corner(-1, -1),
    corner(-1, +1),
  ];
}

interface RiskLike {
  id: string;
  lng: number;
  lat: number;
  direction?: string;
}

// 一簇风险点的外扩包围盒（轴对齐，4 顶点）
function bboxPolygon(cluster: RiskLike[], halfM: number): [number, number][] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const p of cluster) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  const midLat = (minLat + maxLat) / 2;
  const padLat = metersToDegLat(halfM);
  const padLng = metersToDegLng(halfM, midLat);
  return [
    [minLng - padLng, minLat - padLat],
    [maxLng + padLng, minLat - padLat],
    [maxLng + padLng, maxLat + padLat],
    [minLng - padLng, maxLat + padLat],
  ];
}

// 簇内某点到目标点的最小距离（米）
function minDistToClusterM(cluster: RiskLike[], p: RiskLike): number {
  let min = Infinity;
  for (const c of cluster) {
    const d = distanceKm({ lng: c.lng, lat: c.lat }, { lng: p.lng, lat: p.lat }) * 1000;
    if (d < min) min = d;
  }
  return min;
}

// 把 p 并入 cluster 后包围盒的最大边长（米）
function spanAfterAddM(cluster: RiskLike[], p: RiskLike): number {
  const lngs = [...cluster.map((c) => c.lng), p.lng];
  const lats = [...cluster.map((c) => c.lat), p.lat];
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const midLat = (minLat + maxLat) / 2;
  const widthM = (Math.max(...lngs) - Math.min(...lngs)) * 111000 * Math.cos((midLat * Math.PI) / 180);
  const heightM = (maxLat - minLat) * 111000;
  return Math.max(widthM, heightM);
}

/**
 * 把风险点聚类成尽量少的避让多边形：
 * - 仅合并「同向 + 沿路紧挨（间距 < CLUSTER_GAP_M）」的点；单簇跨度 ≤ MAX_CLUSTER_SPAN_M。
 * - 孤立点保持原来的单点矩形（带方向更精确），不被放大。
 * 这样既大幅减少多边形数量（规避高德 avoidpolygons 上限/报错），又不会把稀疏长路误封死。
 */
export function buildRiskPolygons(
  risks: RiskLike[],
  forced: Set<string>,
  size: AvoidSize = 'medium',
): [number, number][][] {
  const halfM = RISK_SIZE_HALF_M[size];

  // 按方向分桶（强制避让点忽略方向，按双向/omni 处理）
  const buckets = new Map<string, RiskLike[]>();
  for (const r of risks) {
    const key = forced.has(r.id) ? 'omni' : r.direction || 'omni';
    const arr = buckets.get(key);
    if (arr) arr.push(r);
    else buckets.set(key, [r]);
  }

  const polygons: [number, number][][] = [];
  for (const [key, pts] of buckets) {
    // 贪心聚类
    const clusters: RiskLike[][] = [];
    for (const p of pts) {
      let placed = false;
      for (const c of clusters) {
        if (minDistToClusterM(c, p) <= CLUSTER_GAP_M && spanAfterAddM(c, p) <= MAX_CLUSTER_SPAN_M) {
          c.push(p);
          placed = true;
          break;
        }
      }
      if (!placed) clusters.push([p]);
    }

    for (const c of clusters) {
      if (c.length === 1) {
        const isOmni = key === 'omni';
        polygons.push(
          pointToAvoidPolygon(c[0]!.lng, c[0]!.lat, isOmni ? undefined : key, halfM, halfM),
        );
      } else {
        polygons.push(bboxPolygon(c, halfM));
      }
    }
  }
  return polygons;
}

function toRiskId(lng: number, lat: number): string {
  return `${lng},${lat}`;
}

function cameraToRisk(camera: CameraPoint): RouteRisk {
  return {
    id: toRiskId(camera.lng, camera.lat),
    lng: camera.lng,
    lat: camera.lat,
    name: camera.name,
    type: camera.type,
    risk: camera.risk,
    href: camera.href,
    direction: camera.direction,
  };
}

function distanceKm(a: LngLat, b: LngLat): number {
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

export interface ScanOptions {
  /** 失效点(aa=4)是否也自动避让，默认 false */
  avoidDeadPoints?: boolean;
  /** 已强制避让的点 id 集合（失效点若被强制，则照常避让） */
  forcedIds?: Set<string>;
  /** 失效点在路线上(方向冲突)但未避让时的上报回调，供 UI 列出供用户选择 */
  onDead?: (camera: CameraPoint, carAngle: number, targetAngle: number | null) => void;
}

export function scanPathRisks(
  pathPoints: LngLat[],
  scanRadiusKm: number = DEFAULT_SCAN_RADIUS_KM,
  onIgnore?: (camera: CameraPoint, carAngle: number, targetAngle: number | null) => void,
  ringFilter: RingFilter = 'all',
  opts: ScanOptions = {},
): Map<string, RouteRisk> {
  const risks = new Map<string, RouteRisk>();
  if (pathPoints.length < 2) return risks;

  // 六环筛选：六环外 = aa='6'，六环内 = aa≠'6'
  const inRingFilter = (camera: CameraPoint): boolean => {
    if (ringFilter === 'inside') return camera.type !== '6';
    if (ringFilter === 'outside') return camera.type === '6';
    return true;
  };

  const probe = (sampleLng: number, sampleLat: number, carAngle: number) => {
    const candidates = spatialIndex.search(sampleLng, sampleLat, scanRadiusKm);
    for (const camera of candidates) {
      if (!inRingFilter(camera)) continue;
      const id = toRiskId(camera.lng, camera.lat);
      if (risks.has(id)) continue;

      const isDead = camera.type === '4';
      const forced = opts.forcedIds?.has(id) ?? false;
      const check = checkDirectionConflict(carAngle, camera.direction);

      // 失效点：默认不纳入避让；仅当路线方向冲突时上报，供用户手动选择是否避让
      if (isDead && !opts.avoidDeadPoints && !forced) {
        if (check.conflict && opts.onDead) opts.onDead(camera, check.carAngle, check.targetAngle);
        continue;
      }

      if (check.conflict) {
        risks.set(id, cameraToRisk(camera));
      } else if (onIgnore) {
        onIgnore(camera, check.carAngle, check.targetAngle);
      }
    }
  };

  for (let i = 0; i < pathPoints.length - 1; i += 1) {
    const current = pathPoints[i]!;
    const next = pathPoints[i + 1]!;
    const carAngle = computeBearing(current, next);

    const segmentLen = distanceKm(current, next);
    const samples = Math.max(1, Math.ceil(segmentLen / SAMPLE_STEP_KM));
    for (let s = 0; s < samples; s += 1) {
      const t = s / samples;
      const sampleLng = current.lng + (next.lng - current.lng) * t;
      const sampleLat = current.lat + (next.lat - current.lat) * t;
      probe(sampleLng, sampleLat, carAngle);
    }
  }
  const last = pathPoints[pathPoints.length - 1]!;
  const prev = pathPoints[pathPoints.length - 2]!;
  probe(last.lng, last.lat, computeBearing(prev, last));

  return risks;
}

