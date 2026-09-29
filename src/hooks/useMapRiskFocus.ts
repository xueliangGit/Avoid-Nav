'use client';

import { useCallback } from 'react';
import type { LngLat } from '@/lib/types';

interface FocusablePoint extends LngLat {
  name?: string;
}

export function useMapRiskFocus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AMap: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any,
) {
  const handleFocusRisk = useCallback(
    (point: FocusablePoint) => {
      if (!AMap || !map) return;

      if (typeof map.setZoomAndCenter === 'function') {
        map.setZoomAndCenter(16, [point.lng, point.lat]);
      } else if (typeof map.setCenter === 'function') {
        map.setCenter([point.lng, point.lat]);
      }

      const circle = new AMap.Circle({
        center: [point.lng, point.lat],
        radius: 60,
        strokeColor: '#fbbf24',
        strokeWeight: 3,
        strokeOpacity: 0.9,
        fillColor: '#fbbf24',
        fillOpacity: 0.25,
        zIndex: 5000,
      });

      map.add(circle);

      let pulses = 0;
      const maxPulses = 6;
      const interval = window.setInterval(() => {
        pulses += 1;
        const visible = pulses % 2 === 0;
        circle.setOptions?.({
          strokeOpacity: visible ? 0.9 : 0,
          fillOpacity: visible ? 0.25 : 0,
        });
        if (pulses >= maxPulses) {
          window.clearInterval(interval);
          map.remove(circle);
        }
      }, 350);
    },
    [AMap, map],
  );

  return { handleFocusRisk };
}
