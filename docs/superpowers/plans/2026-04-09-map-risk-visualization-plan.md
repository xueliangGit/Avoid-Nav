# 地图风险可视化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建一个展示风险点的高德地图容器，支持多级风险颜色区分及自动定位。

**Architecture:** 组件化架构。`MapContainer` 封装地图逻辑，`page.tsx` 作为容器。数据通过 `LabelsLayer` 高效渲染。

**Tech Stack:** Next.js, TypeScript, @amap/amap-jsapi-loader, Vanilla CSS

---

### 任务 1: 创建 MapContainer 组件

**Files:**
- Create: `src/components/Map/MapContainer.tsx`

- [ ] **步骤 1: 编写基础 MapContainer.tsx 实现**
  - 定义地图加载逻辑。
  - 处理安全密钥配置。
  - 初始化 LabelsLayer 和 Geolocation。
  - 渲染 `refined-data.json` 中的点。

```tsx
'use client';

import { useEffect, useRef } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import rawData from '@/lib/refined-data.json';

const MapContainer = () => {
  const mapRef = useRef<any>(null);

  useEffect(() => {
    // 安全密钥配置
    (window as any)._AMapSecurityConfig = {
      securityJsCode: process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE,
    };

    AMapLoader.load({
      key: process.env.NEXT_PUBLIC_AMAP_KEY!,
      version: '2.0',
      plugins: ['AMap.LabelsLayer', 'AMap.Geolocation'],
    }).then((AMap) => {
      const map = new AMap.Map('container', {
        zoom: 11,
        center: [116.397428, 39.90923],
      });
      mapRef.current = map;

      // 1. 初始化 LabelsLayer
      const labelsLayer = new AMap.LabelsLayer({
        zooms: [3, 20],
        zIndex: 1000,
        collision: false,
      });
      map.add(labelsLayer);

      // 2. 准备点位数据
      const markers: any[] = [];
      rawData.points.forEach((point: any) => {
        const [lng, lat, type, risk] = point;
        
        let color = '#800080'; // 紫色 (其他)
        if (risk === 3) color = '#FF0000'; // 红色
        else if (risk === 2) color = '#0000FF'; // 蓝色
        else if (risk === 1) color = '#FFA500'; // 橙色

        const labelMarker = new AMap.LabelMarker({
          name: type,
          position: [lng, lat],
          zIndex: risk,
          icon: {
            type: 'image',
            image: `https://a.amap.com/jsapi_demos/static/demo-center/marker/marker.png`, // 临时使用
            size: [25, 34],
            anchor: 'bottom-center',
          },
          text: {
            content: '', // 可根据需要添加文字
          }
        });

        // 如果要实现圆形渲染，高德 LabelsLayer 通常使用 icon 配合简单的 svg 或图片
        // 这里我们通过 LabelMarker 的 icon 样式来实现
        markers.push(labelMarker);
      });
      labelsLayer.add(markers);

      // 3. 初始化 Geolocation
      const geolocation = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 10000,
        offset: [10, 20],
        zoomToAccuracy: true,
        position: 'RB',
      });
      map.addControl(geolocation);
      geolocation.getCurrentPosition();

    }).catch(e => {
      console.error(e);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
      }
    };
  }, []);

  return <div id="container" style={{ width: '100%', height: '100%' }}></div>;
};

export default MapContainer;
```

- [ ] **步骤 2: 验证文件创建成功**
  - 使用 `ls` 检查文件路径。

### 任务 2: 创建首页 (page.tsx)

**Files:**
- Create: `src/app/page.tsx`

- [ ] **步骤 1: 编写 page.tsx 实现**
  - 将 `MapContainer` 引入页面。
  - 确保页面高度为 `100vh`。

```tsx
import MapContainer from '@/components/Map/MapContainer';

export default function Home() {
  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <MapContainer />
    </main>
  );
}
```

- [ ] **步骤 2: 验证页面文件成功**
  - 使用 `ls` 检查文件路径。

### 任务 3: 整体集成与测试

- [ ] **步骤 1: 检查样式覆盖**
  - 确保没有外部 CSS 导致 100vh 被缩减（如 body margin）。
- [ ] **步骤 2: 运行编译检查**
  - `npm run build` (模拟) 或检查类型。
