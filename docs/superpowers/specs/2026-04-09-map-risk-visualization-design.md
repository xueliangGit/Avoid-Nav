# 地图风险可视化设计文档

## 目标
实现一个基于高德地图的风险点可视化组件。该组件能够加载风险点数据，并根据风险等级进行分类显示，同时支持自动定位。

## 架构
1.  **数据层**: 
    - 使用 `src/lib/refined-data.json` 作为数据源。
    - 数据格式：`{ "points": [ [lng, lat, type, risk], ... ] }`。
2.  **组件层**:
    - `MapContainer.tsx`: 核心地图组件，负责初始化 AMap、加载插件、渲染 `LabelsLayer`。
3.  **应用层**:
    - `src/app/page.tsx`: 首页容器，全屏展示地图。

## 技术栈
- React (Next.js App Router)
- `@amap/amap-jsapi-loader` (1.0.1)
- TypeScript

## 实现细节

### MapContainer 组件
- **地图初始化**:
  - 中心点: `[116.397428, 39.90923]` (北京)。
  - 缩放级别: 11 (根据数据分布调整)。
  - 插件加载: `AMap.LabelsLayer`, `AMap.Geolocation`。
- **风险等级渲染 (`AMap.LabelsLayer`)**:
  - `risk 3`: 红色 (`#FF0000`)
  - `risk 2`: 蓝色 (`#0000FF`)
  - `risk 1`: 橙色 (`#FFA500`)
  - 其他: 紫色 (`#800080`)
  - 实现方式：创建一个 `LabelsLayer` 实例，将 `points` 映射为 `LabelMarker` 数组。每个 marker 使用简单的圆形图标（可以通过样式自定义或使用默认点样式并修改颜色）。
- **定位集成**:
  - 初始化 `AMap.Geolocation`。
  - 自动获取位置并在定位成功后将地图中心移动到当前位置。
- **环境变量**:
  - `NEXT_PUBLIC_AMAP_KEY`: 高德地图 Key。
  - `NEXT_PUBLIC_AMAP_SECURITY_JS_CODE`: 高德地图安全密钥。

### 页面布局
- `src/app/page.tsx` 设置容器样式为 `h-screen w-full` 或 `height: 100vh`。

## 验证计划
1.  **手动验证**: 检查地图是否正常加载，点位是否根据风险等级正确变色。
2.  **定位测试**: 检查是否能成功请求地理位置权限并平滑移动中心点。

## 注意事项
- 确保在加载地图前正确配置全局变量 `window._AMapSecurityConfig`。
- 处理好 React 的生命周期，避免在卸载后继续操作地图实例。
- 解决 `LabelsLayer` 加载后的回调问题。
