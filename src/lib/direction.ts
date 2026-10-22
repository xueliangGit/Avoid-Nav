import type { LngLat } from './types';

// 方位角语义：正北=0°，顺时针
// "西向东" = 车头朝东 = 90°
// "南向北" = 车头朝北 = 0°
// "东向西" = 车头朝西 = 270°
// "北向南" = 车头朝南 = 180°
// 斜向：东北=45°, 东南=135°, 西南=225°, 西北=315°
const DIRECTION_MAP: Record<string, number> = {
  西向东: 90,
  由西向东: 90,
  南向北: 0,
  由南向北: 0,
  东向西: 270,
  由东向西: 270,
  北向南: 180,
  由北向南: 180,
  西南向东北: 45,
  由西南向东北: 45,
  东北向西南: 225,
  由东北向西南: 225,
  西北向东南: 135,
  由西北向东南: 135,
  东南向西北: 315,
  由东南向西北: 315,
};

const BEIJING_CENTER: LngLat = { lng: 116.397451, lat: 39.909187 };

const CONFLICT_THRESHOLD_DEG = 45;

export interface DirectionCheck {
  conflict: boolean;
  carAngle: number;
  targetAngle: number | null;
  reason: string;
}

/**
 * 从文本中提取显式方位字符串（支持正向与斜向，优先长匹配）
 */
export function extractDirection(text: string): string | null {
  if (!text) return null;
  // 优先匹配斜向（如：由西南向东北、西南向东北）
  const slantMatch = text.match(/(由?[东南西北]{2}向[东南西北]{2})/);
  if (slantMatch && slantMatch[1] && slantMatch[1] in DIRECTION_MAP) {
    return slantMatch[1];
  }
  // 匹配正向（如：由南向北、南向北）
  const directMatch = text.match(/(由?[东南西北]向[东南西北])/);
  if (directMatch && directMatch[1] && directMatch[1] in DIRECTION_MAP) {
    return directMatch[1];
  }
  return null;
}

export function getDirAngle(dirStr: string): number | null {
  if (!dirStr) return null;
  if (dirStr in DIRECTION_MAP) return DIRECTION_MAP[dirStr]!;
  const extracted = extractDirection(dirStr);
  if (extracted && extracted in DIRECTION_MAP) return DIRECTION_MAP[extracted]!;
  return null;
}

function angleDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * 校验车辆行驶角度与监控探头抓拍朝向的冲突关系
 * 支持：单向、斜向、进出京、南北双向、东西双向与通用双向
 */
export function checkDirectionConflict(
  carAngle: number,
  dirStr?: string,
  name?: string,
  location?: LngLat,
): DirectionCheck {
  const combined = `${dirStr || ''} ${name || ''}`;

  // 1. 优先提取显式单向朝向（例如名称中含有 [南向北]，即便 dirStr 是 "出京" 也以显式为准）
  const explicitDir = extractDirection(dirStr || '') || extractDirection(name || '');
  if (explicitDir && explicitDir in DIRECTION_MAP) {
    const targetAngle = DIRECTION_MAP[explicitDir]!;
    const diff = angleDiff(carAngle, targetAngle);
    if (diff <= CONFLICT_THRESHOLD_DEG) {
      return {
        conflict: true,
        carAngle,
        targetAngle,
        reason: `${explicitDir}冲突(差${diff.toFixed(0)}°)`,
      };
    }
    return {
      conflict: false,
      carAngle,
      targetAngle,
      reason: `${explicitDir}背向不冲突(差${diff.toFixed(0)}°)`,
    };
  }

  // 2. 南北双向探头（仅抓拍 0° 南向北 与 180° 北向南）
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

  // 3. 东西双向探头（仅抓拍 90° 西向东 与 270° 东向西）
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

  // 4. 放射线高速公路进出京解析（结合探头地理坐标计算背离/朝向城心角度）
  if (combined.includes('出京') || combined.includes('进京')) {
    let targetAngle: number;
    if (location && location.lng && location.lat) {
      // 出京：背离天安门中心；进京：朝向天安门中心
      targetAngle = combined.includes('出京')
        ? computeBearing(BEIJING_CENTER, location)
        : computeBearing(location, BEIJING_CENTER);
    } else {
      // 无地理信息兜底：北京北半部京藏等干线默认出京为北(0°)，进京为南(180°)
      targetAngle = combined.includes('出京') ? 0 : 180;
    }

    const diff = angleDiff(carAngle, targetAngle);
    if (diff <= CONFLICT_THRESHOLD_DEG) {
      return {
        conflict: true,
        carAngle,
        targetAngle,
        reason: `${combined.includes('出京') ? '出京' : '进京'}冲突(差${diff.toFixed(0)}°)`,
      };
    }
    return {
      conflict: false,
      carAngle,
      targetAngle,
      reason: `${combined.includes('出京') ? '出京' : '进京'}背向不冲突(差${diff.toFixed(0)}°)`,
    };
  }

  // 5. 通用无方向或全向双向（无明确轴向标记者，安全优先视为冲突）
  if (!dirStr || dirStr.includes('双向')) {
    return { conflict: true, carAngle, targetAngle: null, reason: '双向或全向' };
  }

  // 6. 其他未识别朝向
  return { conflict: true, carAngle, targetAngle: null, reason: '未识别朝向' };
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
