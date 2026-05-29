import type { CameraPoint, LngLat, RouteRisk } from './types';
import { checkDirectionConflict, computeBearing, getDirAngle } from './direction';
import { spatialIndex } from './spatial';

// 默认避让矩形：沿电子眼朝向 30m，垂直 20m
const ALONG_HALF_M = 15;
const ACROSS_HALF_M = 10;
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

// 默认无方向 → 退化为方形（小尺寸）
function defaultSquarePolygon(lng: number, lat: number): [number, number][] {
  const dLat = metersToDegLat(ACROSS_HALF_M);
  const dLng = metersToDegLng(ACROSS_HALF_M, lat);
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
    return defaultSquarePolygon(lng, lat);
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

export function scanPathRisks(
  pathPoints: LngLat[],
  scanRadiusKm: number = DEFAULT_SCAN_RADIUS_KM,
  onIgnore?: (camera: CameraPoint, carAngle: number, targetAngle: number | null) => void,
): Map<string, RouteRisk> {
  const risks = new Map<string, RouteRisk>();
  if (pathPoints.length < 2) return risks;

  const probe = (sampleLng: number, sampleLat: number, carAngle: number) => {
    const candidates = spatialIndex.search(sampleLng, sampleLat, scanRadiusKm);
    for (const camera of candidates) {
      const id = toRiskId(camera.lng, camera.lat);
      if (risks.has(id)) continue;

      const check = checkDirectionConflict(carAngle, camera.direction);
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

