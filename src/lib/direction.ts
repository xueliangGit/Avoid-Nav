import type { LngLat } from './types';

// 方位角语义：正北=0°，顺时针
// "西向东" = 车头朝东 = 90°
// "南向北" = 车头朝北 = 0°
// "东向西" = 车头朝西 = 270°
// "北向南" = 车头朝南 = 180°
const DIRECTION_MAP: Record<string, number> = {
  西向东: 90,
  由西向东: 90,
  南向北: 0,
  由南向北: 0,
  东向西: 270,
  由东向西: 270,
  北向南: 180,
  由北向南: 180,
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

/**
 * 校验车辆行驶角度与监控探头抓拍朝向的冲突关系
 * 支持：单向、进出京、南北双向、东西双向与通用双向
 */
export function checkDirectionConflict(
  carAngle: number,
  dirStr?: string,
  name?: string,
): DirectionCheck {
  const combined = `${dirStr || ''} ${name || ''}`;

  // 1. 南北双向探头（仅抓拍 0° 南向北 与 180° 北向南）
  // 若车辆沿东西向横切（如北清路东西向跑 90°/270°），两相垂直，绝对不抓拍
  if (combined.includes('南北')) {
    const diff1 = angleDiff(carAngle, 0);
    const diff2 = angleDiff(carAngle, 180);
    const minDiff = Math.min(diff1, diff2);
    if (minDiff <= CONFLICT_THRESHOLD_DEG) {
      return {
        conflict: true,
        carAngle,
        targetAngle: diff1 < diff2 ? 0 : 180,
        reason: `南北双向冲突(差${minDiff.toFixed(0)}°)`,
      };
    }
    return {
      conflict: false,
      carAngle,
      targetAngle: null,
      reason: `南北双向横切不冲突(差${minDiff.toFixed(0)}°)`,
    };
  }

  // 2. 东西双向探头（仅抓拍 90° 西向东 与 270° 东向西）
  // 若车辆沿南北向横切，两相垂直，绝对不抓拍
  if (combined.includes('东西')) {
    const diff1 = angleDiff(carAngle, 90);
    const diff2 = angleDiff(carAngle, 270);
    const minDiff = Math.min(diff1, diff2);
    if (minDiff <= CONFLICT_THRESHOLD_DEG) {
      return {
        conflict: true,
        carAngle,
        targetAngle: diff1 < diff2 ? 90 : 270,
        reason: `东西双向冲突(差${minDiff.toFixed(0)}°)`,
      };
    }
    return {
      conflict: false,
      carAngle,
      targetAngle: null,
      reason: `东西双向横切不冲突(差${minDiff.toFixed(0)}°)`,
    };
  }

  // 3. 通用无方向或双向（无明确轴向标记者，安全优先视为冲突）
  if (!dirStr || dirStr.includes('双向')) {
    return { conflict: true, carAngle, targetAngle: null, reason: '双向或全向' };
  }

  // 4. 精准单向朝向比对
  const targetAngle = getDirAngle(dirStr);
  if (targetAngle === null) {
    return { conflict: true, carAngle, targetAngle: null, reason: '未识别朝向' };
  }
  const diff = angleDiff(carAngle, targetAngle);
  if (diff <= CONFLICT_THRESHOLD_DEG) {
    return {
      conflict: true,
      carAngle,
      targetAngle,
      reason: `方向冲突(差${diff.toFixed(0)}°)`,
    };
  }
  return {
    conflict: false,
    carAngle,
    targetAngle,
    reason: `方向不冲突(差${diff.toFixed(0)}°)`,
  };
}

export function computeBearing(p1: LngLat, p2: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
