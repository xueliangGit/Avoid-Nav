'use client';

import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('../components/Map/MapContainer'), {
  ssr: false,
  loading: () => <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>地图加载中...</div>
});

export default function Home() {
  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }} className="relative">
      {/* SEO 语义化隐藏元素（爬虫可索引，视觉隐藏不影响地图操作） */}
      <h1 className="sr-only">
        北京避让导航 - 进京证与交通违章探头智能规避路线规划
      </h1>
      <section className="sr-only" aria-label="应用功能介绍">
        <p>
          北京避让导航是一款专业的自驾行车辅助路线规划工具。收录了北京地区 6,290 余处电子眼监控、早晚高峰限行抓拍以及进京证探头点位。
        </p>
        <p>
          通过高德地图多边形智能避让算法与车辆行驶方向冲突判定，自动生成避开抓拍的最佳自驾行车路线，并支持一键唤起高德地图 App 实时导航。
        </p>
      </section>

      <MapContainer />
    </main>
  );
}
