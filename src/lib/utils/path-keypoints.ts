import { rdp, type Point } from './rdp';

/**
 * 自适应 RDP：从路径中抽取最多 maxPoints 个"形状关键点"
 * 不返回起点和终点（调用方自己处理）
 *
 * 策略：
 * - 以 initialEpsilon 起跑，结果点数 > maxPoints+2（含起终）就把 epsilon 翻倍重跑
 * - 最多迭代 12 次（足够把 epsilon 从 0.0001° ≈ 11m 调到 0.4° ≈ 44km）
 * - 路径少于 3 点直接返回空（起终点本身高德会处理）
 */
export function extractKeyPoints(
  path: Point[],
  maxPoints: number = 14,
  initialEpsilon: number = 0.0005, // ≈ 55m
): Point[] {
  if (path.length < 3) return [];

  let epsilon = initialEpsilon;
  let result = rdp(path, epsilon);

  // 目标：result.length - 2 (去掉首尾) <= maxPoints
  for (let i = 0; i < 12 && result.length - 2 > maxPoints; i += 1) {
    epsilon *= 1.6;
    result = rdp(path, epsilon);
  }

  // 去掉首尾，保留中间的关键点
  return result.slice(1, -1);
}
