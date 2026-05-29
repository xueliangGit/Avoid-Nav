import type { LngLat, PlaceItem } from './types';

export type NavPlatform = 'amap-app' | 'amap-web';

export function detectPlatform(): NavPlatform {
  if (typeof navigator === 'undefined') return 'amap-web';
  const ua = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  return isMobile ? 'amap-app' : 'amap-web';
}

interface BuildNavUriInput {
  start: PlaceItem;
  end: PlaceItem;
  waypoints: LngLat[]; // 中间点（自动 + 用户）
  platform: NavPlatform;
}

/**
 * 高德移动 App URI:  androidamap://route?... 和 iosamap://path?... 共用 amap://？非也，
 * 实际两端都接受 https://uri.amap.com/navigation?...，会唤起 App，没装也能 fallback 到 web。
 * 因此移动端也用 https URI，省去做平台分发。
 *
 * 高德官方途经点参数 via=lng1,lat1;lng2,lat2;...
 * 最多 16 个途经点。
 */
export function buildAmapNavUri({ start, end, waypoints }: BuildNavUriInput): string {
  const fmt = (p: { lng: number; lat: number }) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;
  const params = new URLSearchParams();
  params.set('from', `${fmt(start)},${start.name}`);
  params.set('to', `${fmt(end)},${end.name}`);
  params.set('mode', 'car');
  params.set('policy', '1'); // 1=躲避拥堵
  params.set('src', 'avoid-nav-beijing');
  params.set('coordinate', 'gaode');
  params.set('callnative', '1'); // 移动端自动唤起 App

  const capped = waypoints.slice(0, 16);
  if (capped.length > 0) {
    params.set('via', capped.map(fmt).join(';'));
  }

  return `https://uri.amap.com/navigation?${params.toString()}`;
}
