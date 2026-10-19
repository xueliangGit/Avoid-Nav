'use client';

import { useEffect, useRef, useState } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import rawData from '@/lib/refined-data.json';
import { spatialIndex } from '@/lib/spatial';
import type { LngLat, RefinedData, RingFilter } from '@/lib/types';

export interface UseAMapResult {
  AMap: any;
  map: any;
  ready: boolean;
  userLocation: LngLat | null;
  error: string | null;
}

const INITIAL_CENTER: [number, number] = [116.397428, 39.90923];
const INITIAL_ZOOM = 11;
const POPUP_BASE_URL = 'https://www.jinjing365.com/wap';

const PLUGINS = [
  'AMap.Geolocation',
  'AMap.Driving',
  'AMap.AutoComplete',
  'AMap.PlaceSearch',
  'AMap.Geocoder',
  'AMap.InfoWindow',
  'AMap.Polygon',
  'AMap.Marker',
  'AMap.Circle',
];

const TYPE_NAMES: Record<string, { label: string; color: string }> = {
  '5': { label: '六环内双拍 (进京证+高峰)', color: '#e11d48' },
  '2': { label: '新增 / 实锤高风险点', color: '#dc2626' },
  '3': { label: '仅限早晚高峰 (五环内)', color: '#d97706' },
  '1': { label: '常规综合监控', color: '#2563eb' },
  '6': { label: '六环外监控 (外证即可)', color: '#059669' },
  '4': { label: '已拆除 / 已停拍', color: '#64748b' },
};

function buildPopupHtml(
  name: string,
  href: string,
  type?: string,
  picCount: number = 0,
  direction?: string
): string {
  const typeInfo = TYPE_NAMES[String(type)] || { label: '交通监控点', color: '#2563eb' };
  const targetHref = href
    ? href.startsWith('http')
      ? href
      : `${POPUP_BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`
    : '#';

  const picBadge =
    picCount > 0
      ? `<div style="display:inline-block;margin-top:6px;padding:2px 8px;border-radius:6px;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;font-size:11px;font-weight:700;">
           🖼️ 车友违章截图: ${picCount} 张
         </div>`
      : '';

  const dirBadge = direction
    ? `<div style="display:inline-block;margin-top:6px;margin-right:6px;padding:2px 8px;border-radius:6px;background:#f1f5f9;border:1px solid #e2e8f0;color:#334155;font-size:11px;font-weight:600;">
         🚗 朝向: ${direction}
       </div>`
    : '';

  return `
    <div style="padding:14px;min-width:240px;max-width:300px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${typeInfo.color};"></span>
        <span style="font-size:11px;font-weight:800;color:${typeInfo.color};">${typeInfo.label}</span>
      </div>
      <h4 style="margin:0 0 4px 0;font-size:13px;font-weight:700;line-height:1.4;color:#1e293b;">${name}</h4>
      <div style="margin-bottom:10px;">
        ${dirBadge}
        ${picBadge}
      </div>
      ${
        targetHref !== '#'
          ? `<a href="${targetHref}" target="_blank" rel="noreferrer"
               style="display:block;width:100%;text-align:center;box-sizing:border-box;background:#2563eb;color:#ffffff;padding:8px 12px;border-radius:10px;font-size:12px;text-decoration:none;font-weight:700;box-shadow:0 2px 6px rgba(37,99,235,0.25);">
               查看现场照片与车友讨论 &#8599;
             </a>`
          : ''
      }
    </div>
  `;
}

export function useAMap(containerId: string, ringFilter: RingFilter = 'all', isDark: boolean = false): UseAMapResult {
  const [AMap, setAMap] = useState<any>(null);
  const [map, setMap] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [userLocation, setUserLocation] = useState<LngLat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const didInitRef = useRef(false);
  const mapInstanceRef = useRef<any>(null);
  const massMarksRef = useRef<any>(null);
  const allMassDataRef = useRef<any[]>([]);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    const data = rawData as unknown as RefinedData;
    if (data.points) {
      spatialIndex.load(data.points);
    }

    (window as any)._AMapSecurityConfig = {
      securityJsCode: process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE,
    };

    let cancelled = false;

    AMapLoader.load({
      key: process.env.NEXT_PUBLIC_AMAP_KEY as string,
      version: '2.0',
      plugins: PLUGINS,
    })
      .then((AMapLib: any) => {
        const mapInstance = new AMapLib.Map(containerId, {
          zoom: INITIAL_ZOOM,
          center: INITIAL_CENTER,
          mapStyle: isDark ? 'amap://styles/dark' : 'amap://styles/normal',
        });
        mapInstanceRef.current = mapInstance;

        const infoWindow = new AMapLib.InfoWindow({
          offset: new AMapLib.Pixel(0, -30),
          zIndex: 2000, // 高于 MassMarks(1000)，确保弹窗不被遮挡
          isCustom: false,
        });

        // —— 海量点渲染：用 MassMarks(单画布)替代逐点 LabelMarker ——
        // 5000+ 个 LabelMarker(各带 DOM/监听)在手机端平移缩放时会严重卡顿；
        // MassMarks 走 canvas 批量渲染 + 单个 layer 级 click 监听，几乎零卡顿。
        const ICON_TYPES = ['1', '2', '3', '4', '5', '6'];
        const massStyles = ICON_TYPES.map((t) => ({
          url: `/images/${t}.png`,
          size: new AMapLib.Size(20, 25),
          anchor: new AMapLib.Pixel(10, 25), // bottom-center
        }));
        const styleIndexOf = (type: string): number => {
          const i = ICON_TYPES.indexOf(String(type));
          return i >= 0 ? i : 1; // 缺省回退到 2.png
        };

        const massData: any[] = [];
        for (const tuple of data.points as any[]) {
          const [lng, lat, type, , href, name, direction, picCount] = tuple;
          if (typeof lng !== 'number' || typeof lat !== 'number') continue;
          if (Number.isNaN(lng) || Number.isNaN(lat)) continue;
          massData.push({
            lnglat: [lng, lat],
            style: styleIndexOf(type),
            name: name || '',
            href: href || '',
            _aa: String(type), // 保留 aa 字段用于六环筛选
            _type: String(type),
            _direction: direction || '',
            _picCount: Number(picCount) || 0,
          });
        }
        allMassDataRef.current = massData;

        const massMarks = new AMapLib.MassMarks(massData, {
          zIndex: 1000,
          zooms: [3, 20],
          style: massStyles,
        });
        massMarks.on('click', (e: any) => {
          const d = e.data ?? {};
          infoWindow.setContent(
            buildPopupHtml(
              d.name ?? '',
              d.href ?? '',
              d._type,
              d._picCount,
              d._direction
            )
          );
          infoWindow.open(mapInstance, d.lnglat);
        });
        massMarks.setMap(mapInstance);
        massMarksRef.current = massMarks;

        const geolocation = new AMapLib.Geolocation({
          enableHighAccuracy: true,
          timeout: 10000,
          buttonPosition: 'RB',
        });
        mapInstance.addControl(geolocation);

        setAMap(AMapLib);
        setMap(mapInstance);

        geolocation.getCurrentPosition((status: string, result: any) => {
          if (cancelled) return;
          if (status === 'complete' && result?.position) {
            setUserLocation({
              lng: result.position.lng,
              lat: result.position.lat,
            });
          }
          setReady(true);
        });
      })
      .catch((e: any) => {
        setError(e?.message || 'Failed to load AMap');
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [containerId, isDark]);

  // 主题切换时实时切换地图底图样式（不重建实例）
  useEffect(() => {
    const mapInstance = mapInstanceRef.current;
    if (!mapInstance) return;
    // setMapStyle 无 TS 声明，any-cast；AMap 2.0 运行时支持
    (mapInstance as any)?.setMapStyle?.(isDark ? 'amap://styles/dark' : 'amap://styles/normal');
  }, [isDark]);

  // 六环筛选变化时更新 massMarks 数据（增量更新，不重建实例）
  useEffect(() => {
    const mm = massMarksRef.current;
    if (!mm) return;
    const allData = allMassDataRef.current;
    if (allData.length === 0) return;
    // 六环外 = aa='6'，六环内 = aa≠'6'
    const filtered =
      ringFilter === 'all'
        ? allData
        : ringFilter === 'inside'
        ? allData.filter((d) => d._aa !== '6')
        : allData.filter((d) => d._aa === '6');
    mm.setData(filtered);
  }, [ringFilter]);

  return { AMap, map, ready, userLocation, error };
}
