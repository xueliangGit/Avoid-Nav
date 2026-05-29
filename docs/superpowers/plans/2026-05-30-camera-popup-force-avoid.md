# 地图电子眼点击弹窗 + 强制避让（待实施）

> 状态：**计划保存**。需求场景已明确，方案设计完成。等需要时直接照此文档实现。
> 上次开始过实现（2026-05-30），改了一半被回退，本文档复刻当时的设计。

---

## 用户场景

用户想把某个电子眼**强制加进避让**，但这个电子眼不在控制面板的列表里——典型情况：

- 双向监控由于修路 / GPS 偏差，实际位置偏离路径中心线
- 算法没把它扫成"路过"（不在 `safelyIgnoredRisks` 也不在 `avoidedRisks`）
- 用户在地图上**眼睛能看见**电子眼图标，想点一下加进 `forcedRiskIds`

---

## 现状

- `useAMap.ts` 渲染 11w 个 `LabelMarker`，每个 marker 已有 `click` handler
- 当前 click → 调高德原生 `InfoWindow` 显示一个 HTML 弹窗（只含"查看详细报告"按钮）
- 这个弹窗**与 React 状态完全脱钩**，没法触发 `setForcedRiskIds`

---

## 设计：B 路 - 让 useAMap 暴露 click 事件，弹窗改为 React 组件

### 分层

| 模块 | 职责 |
|---|---|
| `useAMap` | 渲染图层 / 转发 marker click 给外部 callback，**不再**自己弹 InfoWindow |
| `MapContainer` | 持有"当前选中相机" + 屏幕坐标 state，渲染 `<CameraPopup>` 浮层 |
| `CameraPopup`（新组件） | 显示相机名 + 详情链接 + "加入避让 / 取消避让"按钮 |

### useAMap 改动

#### 1. 新增类型

```ts
export interface CameraClickPayload {
  camera: CameraPoint & { id: string };
  screen: { x: number; y: number }; // 容器坐标
}
```

#### 2. 接口扩展

```ts
export interface UseAMapResult {
  AMap: any;
  map: any;
  ready: boolean;
  userLocation: LngLat | null;
  error: string | null;
  setOnCameraClick: (handler: ((p: CameraClickPayload) => void) | null) => void;
}
```

#### 3. 实现要点

```ts
const cameraClickHandlerRef = useRef<((p: CameraClickPayload) => void) | null>(null);

const setOnCameraClick = useCallback((handler) => {
  cameraClickHandlerRef.current = handler;
}, []);
```

为什么用 ref + setter：避免 callback 变化时重新加载 11w marker。

#### 4. marker click handler 改写

```ts
labelMarker.on('click', (e: any) => {
  const handler = cameraClickHandlerRef.current;
  if (!handler) return;
  const data = e.target.getExtData() as CameraPoint;
  const pos = e.target.getPosition?.();
  if (!pos) return;
  // 高德 LngLat 转屏幕容器坐标
  const screenPx = mapInstance.lngLatToContainer?.(pos);
  const screen = screenPx
    ? { x: screenPx.x ?? screenPx.getX?.() ?? 0, y: screenPx.y ?? screenPx.getY?.() ?? 0 }
    : { x: 0, y: 0 };
  handler({
    camera: {
      ...data,
      id: `${data.lng},${data.lat}`,
    },
    screen,
  });
});
```

#### 5. 删除的内容

- `AMap.InfoWindow` 插件（PLUGINS 数组移除）
- `infoWindow = new AMapLib.InfoWindow(...)` 实例化
- `buildPopupHtml` 工具函数
- `POPUP_BASE_URL` 常量（如果详情链接逻辑搬到 React 组件里）

---

### 新组件 CameraPopup

**文件**：`src/components/Map/CameraPopup.tsx`

**props**：

```ts
interface CameraPopupProps {
  camera: CameraPoint & { id: string };
  screen: { x: number; y: number }; // 容器坐标
  isForced: boolean;
  onToggleForce: (id: string) => void;
  onClose: () => void;
}
```

**渲染**：

```tsx
'use client';

import { ShieldAlert, X, ExternalLink } from 'lucide-react';
import type { CameraPoint } from '@/lib/types';

const DETAIL_BASE = 'https://www.jinjing365.com/wap';

export default function CameraPopup({ camera, screen, isForced, onToggleForce, onClose }: CameraPopupProps) {
  return (
    <div
      style={{ left: screen.x, top: screen.y - 12, transform: 'translate(-50%, -100%)' }}
      className="absolute z-[2500] bg-slate-950/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-3 min-w-[200px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-white text-xs truncate">{camera.name}</h4>
          {camera.direction && (
            <p className="text-[10px] text-slate-400 mt-0.5">方向：{camera.direction}</p>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onToggleForce(camera.id)}
        className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition mb-2 ${
          isForced
            ? 'bg-amber-500 text-white hover:bg-amber-600'
            : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
        }`}
      >
        <ShieldAlert className="w-3.5 h-3.5" />
        <span>{isForced ? '已加入强制避让' : '加入强制避让'}</span>
      </button>

      {camera.href && (
        <a
          href={`${DETAIL_BASE}${camera.href}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1 text-[10px] text-blue-400 hover:text-blue-300"
        >
          <ExternalLink className="w-3 h-3" /> 查看详细报告
        </a>
      )}

      {/* 下方小三角指向相机 */}
      <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent border-t-slate-950/95" />
    </div>
  );
}
```

---

### MapContainer 串联

```ts
const [selectedCamera, setSelectedCamera] = useState<{
  camera: CameraPoint & { id: string };
  screen: { x: number; y: number };
} | null>(null);

useEffect(() => {
  setOnCameraClick((payload) => setSelectedCamera(payload));
  return () => setOnCameraClick(null);
}, [setOnCameraClick]);

// 在地图空白处点击时关闭弹窗
useEffect(() => {
  if (!map) return;
  const onMapClick = () => setSelectedCamera(null);
  map.on('click', onMapClick);
  return () => map.off('click', onMapClick);
}, [map]);

// 渲染
{selectedCamera && (
  <CameraPopup
    camera={selectedCamera.camera}
    screen={selectedCamera.screen}
    isForced={forcedRiskIds.has(selectedCamera.camera.id)}
    onToggleForce={handleToggleForceRisk}
    onClose={() => setSelectedCamera(null)}
  />
)}
```

**注意**：CameraPopup 用绝对定位，要确保它在地图容器**内部**（不是 MapContainer 最外层），否则 screen 坐标对不上。可能需要把它放在 `MapWrapper` 的子节点位置，或者让坐标基于 viewport（用 `position: fixed`）。

---

## 边角问题清单

1. **平移地图后弹窗位置不动**：当前实现"点击瞬间的屏幕坐标"放一次，地图平移后弹窗会留在原位。两种处理：
   - (a) 接受这个行为（用户平移后弹窗失效，体验勉强）
   - (b) 弹窗保存 lng/lat，每次 `map.on('movechange', ...)` 重新计算 screen 坐标。代价是性能（监听地图移动事件每帧重算）。
   - **推荐 (b)** —— 高德地图平移触发频次不算高，每次只是一次坐标转换。

2. **缩放级别低时弹窗指向不准**：缩放变化时小三角偏离 marker。同样靠监听 `zoomchange` 重算。

3. **多个相机叠在一起**：高德 LabelsLayer 会自动 collision-cull，但点击时可能命中下层的。可以接受。

4. **数据一致性**：CameraPoint 的 id 用 `${lng},${lat}` 与 `RouteRisk.id` 一致，确保 `forcedRiskIds.has(id)` 能正确匹配。

5. **flow 模式（手机）下的弹窗位置**：手机 BottomSheet 会盖住下半屏，弹窗如果出现在屏幕下方会被遮。可以让弹窗根据 screen.y 自适应朝上 / 朝下显示。

---

## 实施工作量

- useAMap 改动：~30 行
- CameraPopup 新建：~80 行
- MapContainer 串联：~25 行
- 边角问题 (b) 监听 movechange：~10 行

**总计约 150 行新代码，2 小时左右**。

---

## 与其他功能的关系

- `forcedRiskIds` 集合已存在（commit 14bdabe 引入）
- `handleToggleForceRisk` 回调已在 MapContainer 实现
- `buildPolygonsFromRisks` 已经处理 forced 集合用双向 60×60 polygon
- **本计划只补"从地图入口添加进 forced 集合"，没有任何后端逻辑改动**

---

## 与"红色行强制避让按钮"的关系

红色行按钮（2026-05-30 实施）解决的是 **"已在 avoidedRisks 列表但算法避不开"** 的场景。

本计划解决的是 **"根本没在任何列表里"** 的场景（电子眼位置偏离路径）。

**两者互补不冲突**。
