import RBush from 'rbush';

interface PointItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  data: {
    lng: number;
    lat: number;
    type: string;
    risk: number;
  };
}

export class SpatialIndex {
  private tree: RBush<PointItem>;

  constructor() {
    this.tree = new RBush<PointItem>();
  }

  load(points: any[]) {
    if (!points || !Array.isArray(points)) return;
    
    const items: PointItem[] = points.map(p => ({
      minX: p[0],
      minY: p[1],
      maxX: p[0],
      maxY: p[1],
      data: {
        lng: p[0],
        lat: p[1],
        type: p[2],
        risk: p[3]
      }
    }));
    this.tree.clear();
    this.tree.load(items);
  }

  search(lng: number, lat: number, radiusKm: number) {
    // 1度约 111km，500m 约为 0.0045度
    const degreeDiff = radiusKm / 111;
    const results = this.tree.search({
      minX: lng - degreeDiff,
      minY: lat - degreeDiff,
      maxX: lng + degreeDiff,
      maxY: lat + degreeDiff
    });
    
    return results.map((item: any) => item.data);
  }
}

export const spatialIndex = new SpatialIndex();
