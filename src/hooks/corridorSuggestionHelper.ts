// src/hooks/corridorSuggestionHelper.ts
import { isRouteFollowingCorridor, matchSafetyCorridor } from '@/lib/corridor';
import type { CorridorSuggestion } from '@/lib/corridor';
import type { LngLat, RouteRisk } from '@/lib/types';
import type { RoutePlanInput } from './routePlannerTypes';

interface CheckCorridorInput {
  current: RoutePlanInput;
  finalPts: LngLat[];
  finalRisks: RouteRisk[];
  deadRisksCount: number;
}

/**
 * 在多轮规避规划结束后，智能研判是否向用户推荐切换六环安全走廊：
 * 1. 规避探测完毕后仍有未避让风险点 (finalRisks > 0 或 deadRisks > 0)
 * 2. 当前规划道路没有走六环走廊 (未经过六环特征关键锚点)
 * 3. 起终点符合跨区长途条件且有匹配的六环走廊
 */
export function checkAndBuildCorridorSuggestion(
  input: CheckCorridorInput,
): CorridorSuggestion | null {
  const { current, finalPts, finalRisks, deadRisksCount } = input;

  // 1. 严格计算真正无法避开的在用冲突监控：
  // 默认情况下失效点(deadRisks)已停拍不构成违章风险，绝不能算作未避让；
  // 只有当用户主动勾选了 avoidDeadPoints 时，才把 deadRisks 计入未避让
  const unavoidedCount = current.avoidDeadPoints
    ? finalRisks.length + deadRisksCount
    : finalRisks.length;

  // 如果当前路线已经全程避让成功（0 处在用冲突），100% 绝对不弹出六环推荐
  if (unavoidedCount === 0) {
    return null;
  }

  // 2. 检查起终点是否符合跨区走六环条件
  const match = matchSafetyCorridor({
    start: current.start,
    end: current.end,
    userWaypoints: current.waypoints,
  });

  if (!match.matched || !match.anchors || match.anchors.length === 0) {
    return null;
  }

  // 3. 检查当前规划的路线是否已经实际沿用了该六环走廊
  const alreadyUsedCorridor = isRouteFollowingCorridor(finalPts, match.anchors);
  if (alreadyUsedCorridor) {
    return null;
  }

  // 4. 满足全部条件，生成走廊建议
  return {
    corridorName: match.corridorName || '六环跨区安全走廊',
    reason: match.reason || '当前路线存在无法避让的监控，建议绕行六环安全走廊',
    waypoints: match.waypoints,
    unavoidedCount,
  };
}
