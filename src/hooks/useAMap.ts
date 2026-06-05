'use client';

import { useEffect, useRef, useState } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import rawData from '@/lib/refined-data.json';
import { spatialIndex } from '@/lib/spatial';
import type { LngLat, RawCameraTuple, RefinedData, RingFilter } from '@/lib/types';

export interface UseAMapResult {
  AMap: any;
  map: any;
  ready: boolean;
  userLocation: LngLat | null;
  error: string | null;
}

const INITIAL_CENTER: [number, number] = [116.397428, 39.90923];
const INITIAL_ZOOM = 11;
const MAP_STYLE = 'amap://styles/normal';
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

function buildPopupHtml(name: string, href: string): string {
  return `
    <div style="padding:12px;min-width:200px;font-family:sans-serif;color:#1e293b;">
      <h4 style="margin:0 0 8px 0;font-size:14px;font-weight:800;">${name}</h4>
      <a href="${POPUP_BASE_URL}${href}" target="_blank" rel="noreferrer"
         style="display:block;width:100%;text-align:center;background:#2563eb;color:#fff;padding:8px;border-radius:8px;font-size:12px;text-decoration:none;font-weight:bold;">
        查看详细报告 &#8599;
      </a>
    </div>
  `;
}

export function useAMap(containerId: string, ringFilter: RingFilter = 'all'): UseAMapResult {
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
          mapStyle: MAP_STYLE,
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
        for (const tuple of data.points as RawCameraTuple[]) {
          const [lng, lat, type, , href, name] = tuple;
          if (typeof lng !== 'number' || typeof lat !== 'number') continue;
          if (Number.isNaN(lng) || Number.isNaN(lat)) continue;
          massData.push({
            lnglat: [lng, lat],
            style: styleIndexOf(type),
            name: name || '',
            href: href || '',
            _aa: String(type), // 保留 aa 字段用于六环筛选
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
          infoWindow.setContent(buildPopupHtml(d.name ?? '', d.href ?? ''));
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
  }, [containerId]);

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
