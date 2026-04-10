'use client';

import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('../components/Map/MapContainer'), {
  ssr: false,
  loading: () => <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>地图加载中...</div>
});

export default function Home() {
  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <MapContainer />
    </main>
  );
}
