import type { LngLat, PlaceItem } from './types';

export type NavPlatform = 'android' | 'ios' | 'web';

export function detectPlatform(): NavPlatform {
  if (typeof navigator === 'undefined') return 'web';
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  return 'web';
}

interface NamedPoint {
  lng: number;
  lat: number;
  name?: string;
}

interface BuildNavUriInput {
  start: PlaceItem;
  end: PlaceItem;
  /** 中间途经点（自动 RDP 关键点 + 用户手动避让区） */
  waypoints: (LngLat & { name?: string })[];
  platform: NavPlatform;
}

const MAX_MOBILE_VIA = 14; // 留 2 个余量

function fmtCoord(n: number): string {
  return n.toFixed(6);
}

/**
 * Android: amapuri://route/plan/?...
 * 多途经点：vian=N&vialons=lng1|lng2|...&vialats=lat1|lat2|...&vianames=n1|n2|...
 */
function buildAndroidUri(start: PlaceItem, end: PlaceItem, vias: NamedPoint[]): string {
  const params: string[] = [
    `slat=${fmtCoord(start.lat)}`,
    `slon=${fmtCoord(start.lng)}`,
    `sname=${encodeURIComponent(start.name)}`,
    `dlat=${fmtCoord(end.lat)}`,
    `dlon=${fmtCoord(end.lng)}`,
    `dname=${encodeURIComponent(end.name)}`,
    `dev=0`,
    `t=0`,
  ];

  if (vias.length > 0) {
    const lons = vias.map((p) => fmtCoord(p.lng)).join('|');
    const lats = vias.map((p) => fmtCoord(p.lat)).join('|');
    const names = vias.map((p, i) => encodeURIComponent(p.name || `途经点${i + 1}`)).join('|');
    params.push(`vian=${vias.length}`);
    params.push(`vialons=${lons}`);
    params.push(`vialats=${lats}`);
    params.push(`vianames=${names}`);
  }

  return `amapuri://route/plan/?${params.join('&')}`;
}

/**
 * iOS: iosamap://path?...
 * 参数同 Android。
 */
function buildIosUri(start: PlaceItem, end: PlaceItem, vias: NamedPoint[]): string {
  const params: string[] = [
    `sourceApplication=${encodeURIComponent('avoid-nav-beijing')}`,
    `slat=${fmtCoord(start.lat)}`,
    `slon=${fmtCoord(start.lng)}`,
    `sname=${encodeURIComponent(start.name)}`,
    `dlat=${fmtCoord(end.lat)}`,
    `dlon=${fmtCoord(end.lng)}`,
    `dname=${encodeURIComponent(end.name)}`,
    `dev=0`,
    `t=0`,
  ];

  if (vias.length > 0) {
    const lons = vias.map((p) => fmtCoord(p.lng)).join('|');
    const lats = vias.map((p) => fmtCoord(p.lat)).join('|');
    const names = vias.map((p, i) => encodeURIComponent(p.name || `途经点${i + 1}`)).join('|');
    params.push(`vian=${vias.length}`);
    params.push(`vialons=${lons}`);
    params.push(`vialats=${lats}`);
    params.push(`vianames=${names}`);
  }

  return `iosamap://path?${params.join('&')}`;
}

/**
 * 桌面 / 兜底：https://uri.amap.com/navigation
 * 高德官方限制：via 最多 1 个 —— 取传入列表的中点（最具代表性的"过哪一带"）作为唯一途经点。
 */
function buildWebUri(start: PlaceItem, end: PlaceItem, vias: NamedPoint[]): string {
  const fmt = (p: NamedPoint | PlaceItem) => {
    const name = 'name' in p && p.name ? `,${p.name}` : '';
    return `${fmtCoord(p.lng)},${fmtCoord(p.lat)}${name}`;
  };
  const params = new URLSearchParams();
  params.set('from', fmt(start));
  params.set('to', fmt(end));
  params.set('mode', 'car');

  if (vias.length > 0) {
    // 取中点位置最具代表性
    const mid = vias[Math.floor(vias.length / 2)]!;
    params.set('via', fmt({ ...mid, name: mid.name || '途经点' }));
  }

  return `https://uri.amap.com/navigation?${params.toString()}`;
}

export function buildAmapNavUri({ start, end, waypoints, platform }: BuildNavUriInput): string {
  const capped = waypoints.slice(0, MAX_MOBILE_VIA);

  switch (platform) {
    case 'android':
      return buildAndroidUri(start, end, capped);
    case 'ios':
      return buildIosUri(start, end, capped);
    case 'web':
    default:
      return buildWebUri(start, end, capped);
  }
}
