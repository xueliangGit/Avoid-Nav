import type { ManualAvoidArea, PlaceItem, Waypoint } from './types';

export const SHARE_VERSION = '1';
export const SHARE_QUERY_KEY = 'route';

export interface ShareableRouteV1 {
  v: typeof SHARE_VERSION;
  s: PlaceItem; // start
  e: PlaceItem; // end
  w: Waypoint[]; // waypoints
  m: ManualAvoidArea[]; // manualAvoidAreas
  i: string[]; // ignoredRiskIds
  f: string[]; // forcedRiskIds
}

function toBase64Url(s: string): string {
  // btoa 不支持非 latin1，先 utf8 → bytes → btoa
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const bin = atob(padded + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeShare(state: Omit<ShareableRouteV1, 'v'>): string {
  const payload: ShareableRouteV1 = { v: SHARE_VERSION, ...state };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeShare(token: string): ShareableRouteV1 | null {
  try {
    const json = fromBase64Url(token);
    const parsed = JSON.parse(json) as ShareableRouteV1;
    if (parsed.v !== SHARE_VERSION) return null;
    if (!parsed.s || !parsed.e) return null;
    if (typeof parsed.s.lng !== 'number' || typeof parsed.s.lat !== 'number') return null;
    if (typeof parsed.e.lng !== 'number' || typeof parsed.e.lat !== 'number') return null;
    parsed.w = Array.isArray(parsed.w) ? parsed.w : [];
    parsed.m = Array.isArray(parsed.m) ? parsed.m : [];
    parsed.i = Array.isArray(parsed.i) ? parsed.i : [];
    parsed.f = Array.isArray(parsed.f) ? parsed.f : [];
    return parsed;
  } catch {
    return null;
  }
}

export function buildShareUrl(token: string, baseUrl?: string): string {
  const base = baseUrl ?? (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');
  return `${base}?${SHARE_QUERY_KEY}=${token}`;
}
