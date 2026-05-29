import type { LngLat } from './types';

// 方位角语义：正北=0°，顺时针
// "西向东" = 车头朝东 = 90°
// "南向北" = 车头朝北 = 0°（用 360 等价表达便于差值计算亦可）
// "东向西" = 车头朝西 = 270°
// "北向南" = 车头朝南 = 180°
const DIRECTION_MAP: Record<string, number> = {
  '西向东': 90,
  '南向北': 0,
  '东向西': 270,
  '北向南': 180,
};

const CONFLICT_THRESHOLD_DEG = 45;

export interface DirectionCheck {
  conflict: boolean;
  carAngle: number;
  targetAngle: number | null;
  reason: string;
}

export function getDirAngle(dirStr: string): number | null {
  if (!dirStr) return null;
  if (dirStr in DIRECTION_MAP) return DIRECTION_MAP[dirStr]!;
  return null;
}

function angleDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export function checkDirectionConflict(carAngle: number, dirStr?: string): DirectionCheck {
  if (!dirStr) {
    return { conflict: true, carAngle, targetAngle: null, reason: '未识别' };
  }
  if (dirStr.includes('双向')) {
    return { conflict: true, carAngle, targetAngle: null, reason: '双向' };
  }
  const targetAngle = getDirAngle(dirStr);
  if (targetAngle === null) {
    return { conflict: true, carAngle, targetAngle: null, reason: '未识别' };
  }
  const diff = angleDiff(carAngle, targetAngle);
  if (diff <= CONFLICT_THRESHOLD_DEG) {
    return { conflict: true, carAngle, targetAngle, reason: `方向冲突(差${diff.toFixed(0)}°)` };
  }
  return { conflict: false, carAngle, targetAngle, reason: `方向不冲突(差${diff.toFixed(0)}°)` };
}

export function computeBearing(p1: LngLat, p2: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}
