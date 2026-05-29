'use client';

import { useEffect, useRef, useState } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import rawData from '@/lib/refined-data.json';
import { spatialIndex } from '@/lib/spatial';
import type { LngLat, RawCameraTuple, RefinedData } from '@/lib/types';

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
  'AMap.LabelsLayer',
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

export function useAMap(containerId: string): UseAMapResult {
  const [AMap, setAMap] = useState<any>(null);
  const [map, setMap] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [userLocation, setUserLocation] = useState<LngLat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const didInitRef = useRef(false);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    const data = rawData as RefinedData;
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
        });

        const labelsLayer = new AMapLib.LabelsLayer({
          zooms: [3, 20],
          zIndex: 1000,
          collision: false,
        });
        mapInstance.add(labelsLayer);

        const markers: any[] = [];
        for (const tuple of data.points as RawCameraTuple[]) {
          const [lng, lat, type, risk, href, name, direction] = tuple;
          if (typeof lng !== 'number' || typeof lat !== 'number') continue;
          if (Number.isNaN(lng) || Number.isNaN(lat)) continue;

          const labelMarker = new AMapLib.LabelMarker({
            name: name || '',
            position: [lng, lat],
            zIndex: risk || 1,
            extData: { name, type, risk, href, direction, lng, lat },
            icon: {
              type: 'image',
              image: `/images/${type || '1'}.png`,
              size: [20, 25],
              anchor: 'bottom-center',
            },
          });

          labelMarker.on('click', (e: any) => {
            const data = e.target.getExtData();
            infoWindow.setContent(buildPopupHtml(data.name ?? '', data.href ?? ''));
            infoWindow.open(mapInstance, e.target.getPosition());
          });

          markers.push(labelMarker);
        }
        labelsLayer.add(markers);

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

  return { AMap, map, ready, userLocation, error };
}
