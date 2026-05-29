import RBush from 'rbush';
import type { CameraPoint, RawCameraTuple } from './types';

interface IndexedNode {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  point: CameraPoint;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function tupleToCamera(tuple: RawCameraTuple): CameraPoint {
  const [lng, lat, type, risk, href, name, direction] = tuple;
  return { lng, lat, type, risk, href, name, direction };
}

export class SpatialIndex {
  private tree: RBush<IndexedNode>;
  private loaded: boolean;

  constructor() {
    this.tree = new RBush<IndexedNode>();
    this.loaded = false;
  }

  load(points: RawCameraTuple[]): void {
    this.tree.clear();
    const nodes: IndexedNode[] = points.map((tuple) => {
      const point = tupleToCamera(tuple);
      return {
        minX: point.lng,
        minY: point.lat,
        maxX: point.lng,
        maxY: point.lat,
        point,
      };
    });
    this.tree.load(nodes);
    this.loaded = true;
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  search(lng: number, lat: number, radiusKm: number): CameraPoint[] {
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(toRadians(lat)) || 1);

    const candidates = this.tree.search({
      minX: lng - lngDelta,
      minY: lat - latDelta,
      maxX: lng + lngDelta,
      maxY: lat + latDelta,
    });

    const result: CameraPoint[] = [];
    for (const node of candidates) {
      if (haversineKm(lng, lat, node.point.lng, node.point.lat) <= radiusKm) {
        result.push(node.point);
      }
    }
    return result;
  }
}

export const spatialIndex = new SpatialIndex();
