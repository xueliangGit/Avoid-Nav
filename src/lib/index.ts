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
    name: string;
    href?: string;
    direction?: string;
  };
}

export class SpatialIndex {
  private tree: RBush<PointItem>;

  constructor() {
    this.tree = new RBush<PointItem>();
  }

  load(points: any[]) {
    if (!points || !Array.isArray(points)) return;
    
    // 兼容性处理：自动识别是数组格式还是对象格式
    const items: PointItem[] = points.map(p => {
      const isArray = Array.isArray(p);
      const data = isArray ? {
        lng: p[0], lat: p[1], type: p[2], risk: p[3], href: p[4], name: p[5], direction: p[6]
      } : p;

      return {
        minX: data.lng,
        minY: data.lat,
        maxX: data.lng,
        maxY: data.lat,
        data: data
      };
    });

    this.tree.clear();
    this.tree.load(items);
  }

  search(lng: number, lat: number, radiusKm: number) {
    // 1度经度约111km，1度纬度约111km
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
