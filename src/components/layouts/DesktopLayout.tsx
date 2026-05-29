'use client';

import type { ReactNode } from 'react';

interface Props {
  controlPanel: ReactNode;
  debugPanel: ReactNode;
  mapElement: ReactNode;
}

export default function DesktopLayout({ controlPanel, debugPanel, mapElement }: Props) {
  return (
    <div className="relative w-full h-full">
      <div className="absolute top-4 left-4 z-[2000] w-96 h-[calc(100vh-32px)] pointer-events-auto">
        {controlPanel}
      </div>
      <div className="absolute top-4 right-4 z-[2000] w-80 h-[400px] pointer-events-auto">
        {debugPanel}
      </div>
      {mapElement}
    </div>
  );
}
