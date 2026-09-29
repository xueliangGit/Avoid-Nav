'use client';

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { LngLat, ManualAvoidArea, ManualAvoidSize, PlaceItem, Waypoint } from '@/lib/types';
import type { InteractionMode } from '@/components/Map/ControlPanel';

interface AutoCompleteSelectEvent {
  poi?: {
    name?: string;
    location?: { lng: number; lat: number };
    adcode?: string;
  };
}

interface AMapClickEvent {
  lnglat: { lng: number; lat: number };
}

interface RegeocodeResult {
  regeocode?: {
    formattedAddress?: string;
  };
}

const makeId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

interface UseMapInteractionsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AMap: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any;
  ready: boolean;
  mode: InteractionMode;
  pendingAvoidSize: ManualAvoidSize;
  setMode: Dispatch<SetStateAction<InteractionMode>>;
  setStart: Dispatch<SetStateAction<PlaceItem | null>>;
  setEnd: Dispatch<SetStateAction<PlaceItem | null>>;
  setWaypoints: Dispatch<SetStateAction<Waypoint[]>>;
  setManualAvoidAreas: Dispatch<SetStateAction<ManualAvoidArea[]>>;
}

export function useMapInteractions({
  AMap,
  map,
  ready,
  mode,
  pendingAvoidSize,
  setMode,
  setStart,
  setEnd,
  setWaypoints,
  setManualAvoidAreas,
}: UseMapInteractionsProps) {
  const modeRef = useRef<InteractionMode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const pendingAvoidSizeRef = useRef<ManualAvoidSize>(pendingAvoidSize);
  useEffect(() => {
    pendingAvoidSizeRef.current = pendingAvoidSize;
  }, [pendingAvoidSize]);

  // —— 绑定输入框 AutoComplete ——
  useEffect(() => {
    if (!ready || !AMap || !map) return;

    const autoStart = new AMap.AutoComplete({ input: 'start-input' });
    const autoEnd = new AMap.AutoComplete({ input: 'end-input' });

    const onStartSelect = (e: AutoCompleteSelectEvent) => {
      if (e.poi?.location && e.poi.name) {
        setStart({
          lng: e.poi.location.lng,
          lat: e.poi.location.lat,
          name: e.poi.name,
        });
        map.setCenter?.([e.poi.location.lng, e.poi.location.lat]);
      }
    };

    const onEndSelect = (e: AutoCompleteSelectEvent) => {
      if (e.poi?.location && e.poi.name) {
        setEnd({
          lng: e.poi.location.lng,
          lat: e.poi.location.lat,
          name: e.poi.name,
        });
        map.setCenter?.([e.poi.location.lng, e.poi.location.lat]);
      }
    };

    autoStart.on('select', onStartSelect);
    autoEnd.on('select', onEndSelect);

    return () => {
      autoStart.off?.('select', onStartSelect);
      autoEnd.off?.('select', onEndSelect);
    };
  }, [ready, AMap, map, setStart, setEnd]);

  // —— 地图点击：根据 mode 决定添加途经点或避让区 ——
  useEffect(() => {
    if (!ready || !AMap || !map) return;

    const placeSearch = new AMap.PlaceSearch({});

    const reverseGeocode = (lnglat: LngLat): Promise<string> => {
      return new Promise((resolve) => {
        try {
          const geocoder = new AMap.Geocoder();
          geocoder.getAddress(
            [lnglat.lng, lnglat.lat],
            (status: string, result: RegeocodeResult) => {
              if (status === 'complete' && result?.regeocode?.formattedAddress) {
                resolve(result.regeocode.formattedAddress);
              } else {
                resolve(`${lnglat.lng.toFixed(5)}, ${lnglat.lat.toFixed(5)}`);
              }
            },
          );
        } catch {
          placeSearch.searchNearBy?.(
            '',
            [lnglat.lng, lnglat.lat],
            200,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (status: string, result: any) => {
              const poi = result?.poiList?.pois?.[0];
              if (status === 'complete' && poi?.name) resolve(poi.name);
              else resolve(`${lnglat.lng.toFixed(5)}, ${lnglat.lat.toFixed(5)}`);
            },
          );
        }
      });
    };

    const onClick = async (e: AMapClickEvent) => {
      const currentMode = modeRef.current;
      if (currentMode === 'none') return;
      const point: LngLat = { lng: e.lnglat.lng, lat: e.lnglat.lat };

      if (currentMode === 'add-waypoint') {
        const name = await reverseGeocode(point);
        setWaypoints((prev) => [
          ...prev,
          { id: makeId('wp'), lng: point.lng, lat: point.lat, name },
        ]);
      } else if (currentMode === 'add-avoid') {
        const size = pendingAvoidSizeRef.current;
        const sizeLabel = size === 'small' ? '小' : size === 'large' ? '大' : '中';
        const label = `避让区 ${sizeLabel}·${Date.now().toString().slice(-4)}`;
        setManualAvoidAreas((prev) => [
          ...prev,
          { id: makeId('avoid'), lng: point.lng, lat: point.lat, label, size },
        ]);
      }
      setMode('none');
    };

    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [ready, AMap, map, setMode, setWaypoints, setManualAvoidAreas]);
}
