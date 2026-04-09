export interface Point {
  lng: number;
  lat: number;
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  let dx = lineEnd.lng - lineStart.lng;
  let dy = lineEnd.lat - lineStart.lat;

  // 线段为一个点的情况
  if (dx === 0 && dy === 0) {
    dx = point.lng - lineStart.lng;
    dy = point.lat - lineStart.lat;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // 计算投影点参数 t
  const t = ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / (dx * dx + dy * dy);

  let closestPoint: Point;
  if (t < 0) {
    closestPoint = lineStart;
  } else if (t > 1) {
    closestPoint = lineEnd;
  } else {
    closestPoint = {
      lng: lineStart.lng + t * dx,
      lat: lineStart.lat + t * dy,
    };
  }

  const pdx = point.lng - closestPoint.lng;
  const pdy = point.lat - closestPoint.lat;

  return Math.sqrt(pdx * pdx + pdy * pdy);
}

// Douglas-Peucker 算法实现
export function rdp<T extends Point>(points: T[], epsilon: number): T[] {
  if (points.length < 3) {
    return points;
  }

  let maxDistance = 0;
  let index = 0;

  const start = points[0]!;
  const end = points[points.length - 1]!;

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i]!, start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  if (maxDistance > epsilon) {
    // 递归调用
    const leftRec = rdp(points.slice(0, index + 1), epsilon);
    const rightRec = rdp(points.slice(index), epsilon);

    // 合并结果（移除重复的中心点）
    return leftRec.slice(0, leftRec.length - 1).concat(rightRec);
  } else {
    return [start, end];
  }
}
