# 历史记录 + 多端适配 — 设计文档

日期：2026-05-29
作者：xuxueliang × Claude
状态：已确认，待实现

---

## 1. 背景与目标

当前北京电子眼避让导航系统已支持起终点搜索、自动避让规划、手动途经点、手动避让区、风险点忽略。下一步要让用户能：

1. **保存规划好的路线**，下次一键复用，避免每次都重新输入起终点和忽略列表。
2. **在不同设备上获得合理的体验**：手机竖屏 / 手机横屏 / 平板竖屏 / 平板横屏 / 桌面端，各自有为该形态优化的布局。

本轮 **不** 做：账号系统、云同步、分享到第三方、唤起外部地图。这些留给后续 spec。

---

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 本地持久化：起/终点、途经点、手动避让区、忽略风险点 | 后端、登录、云同步 |
| 历史列表（不限数量）、收藏、重命名、删除、一键复用 | 分享到微信/QQ |
| 桌面、平板（横/竖）、手机（横/竖）布局 | 唤起高德/百度 app 导航 |
| `HistoryStorage` 抽象接口（为未来 cloud 实现预留） | 实际的 cloud 实现 |

---

## 3. 数据模型

### 3.1 `SavedRoute`

一条历史记录。

```ts
interface SavedRoute {
  id: string;                  // crypto.randomUUID()
  name: string;                // 默认 "起点 → 终点"，可重命名
  favorite: boolean;
  createdAt: number;           // ms
  updatedAt: number;           // ms

  // 用于一键复用的核心数据
  start: PlaceItem;
  end: PlaceItem;
  waypoints: Waypoint[];
  manualAvoidAreas: ManualAvoidArea[];
  ignoredRiskIds: string[];    // Set 序列化为 string[]

  // 缓存的结果摘要（仅展示用，复用时不直接相信，会重新规划）
  summary?: {
    distance: number;          // m
    duration: number;          // s
    riskCount: number;
  };
}
```

### 3.2 与现有类型的关系

- `PlaceItem`、`Waypoint`、`ManualAvoidArea` 直接复用 `src/lib/types.ts` 已有定义
- `ignoredRiskIds` 在内存里用 `Set<string>`，存储时序列化为数组

### 3.3 排序

`list()` 默认排序：`favorite desc, updatedAt desc`。

---

## 4. 存储抽象接口

### 4.1 接口

```ts
// src/lib/storage/types.ts
export interface HistoryStorage {
  list(): Promise<SavedRoute[]>;
  get(id: string): Promise<SavedRoute | null>;
  save(input: Omit<SavedRoute, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavedRoute>;
  update(id: string, patch: Partial<Omit<SavedRoute, 'id' | 'createdAt'>>): Promise<SavedRoute>;
  remove(id: string): Promise<void>;
  subscribe(listener: () => void): () => void;
}
```

`save` 返回完整对象（含新生成的 id/createdAt/updatedAt）以便调用方拿到 id。

### 4.2 localStorage 实现

```
key: "avoid-nav:history:v1"
value: JSON.stringify(SavedRoute[])
```

- 单 key 全表读写。规模上限 1500-5000 条，足够。
- 监听 `window` 的 `storage` 事件 → 跨标签页同步触发 listeners。
- 自身写入也手动 emit 一次 listeners（storage 事件不会触发同源同窗口）。
- 写入捕获 `QuotaExceededError`，向上抛 `StorageQuotaError`，UI 提示用户删旧记录。

### 4.3 切换路径

未来加 cloud 时新建 `cloudStore.ts` 实现同接口；`storage/index.ts` 根据登录状态返回 `localStore` 或 `cloudStore`。中间可加 `mirroredStore` 同时双写。

### 4.4 文件布局

```
src/lib/storage/
  types.ts         SavedRoute, HistoryStorage, StorageQuotaError
  localStore.ts    LocalHistoryStorage
  index.ts         export const historyStorage: HistoryStorage = new LocalHistoryStorage()
```

---

## 5. Hook 层

### 5.1 `useHistory`

```ts
function useHistory(): {
  routes: SavedRoute[];
  save: (input) => Promise<SavedRoute>;
  remove: (id: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
}
```

实现：用 `useSyncExternalStore(subscribe, getSnapshot)`，`getSnapshot` 同步返回最新缓存（localStore 内部持有内存态，避免 list() 的 Promise 在外部破坏 useSyncExternalStore 语义）。

### 5.2 `useApplySavedRoute`

```ts
// 复用一条路线
function useApplySavedRoute(setters: { setStart, setEnd, setWaypoints, setManualAvoidAreas, setIgnoredRiskIds, plan }): (route: SavedRoute) => Promise<void>
```

执行顺序：填入 5 个 state → 等下一帧 → 调 `plan({ start, end, ... })`（用现成的 override 形式，避免依赖 setState 同步）。

### 5.3 `useDeviceLayout`

```ts
type LayoutMode =
  | 'mobile-portrait'
  | 'mobile-landscape'
  | 'tablet-portrait'
  | 'tablet-landscape'
  | 'desktop';

function useDeviceLayout(): LayoutMode
```

判定规则（按顺序）：

1. `matchMedia('(pointer: fine)').matches && innerWidth >= 1024` → `desktop`
2. `innerWidth >= 1024` → `desktop`
3. `768 <= innerWidth < 1024 && portrait` → `tablet-portrait`
4. `768 <= innerWidth < 1024 && landscape` → `tablet-landscape`
5. `innerWidth < 768 && portrait` → `mobile-portrait`
6. `innerWidth < 768 && landscape` → `mobile-landscape`

`portrait` 用 `matchMedia('(orientation: portrait)').matches` 判定。

监听 `resize` + `orientationchange`，去抖 100ms。

---

## 6. 布局策略

### 6.1 模式映射

| LayoutMode | 渲染 |
|---|---|
| `desktop` | `DesktopLayout` |
| `tablet-landscape` | `DesktopLayout`（共用） |
| `tablet-portrait` | `MobileLayout` |
| `mobile-portrait` | `MobileLayout` |
| `mobile-landscape` | `MobileLandscapeLayout`（左地图 + 右抽屉） |

### 6.2 DesktopLayout

- 左侧浮窗：`ControlPanel`（现状 96 宽）
- 右侧浮窗：`DebugPanel`
- "历史" 按钮在 `ControlPanel` 顶部，点击 → `HistoryDrawer` 从右侧 360px 宽滑入

### 6.3 MobileLayout

- 全屏地图
- 底部 `BottomSheet`，3 档高度：
  - **peek**：约 120px（仅露起终点输入 + 规划按钮）
  - **half**：约 50vh
  - **full**：约 88dvh
- BottomSheet 内含 Tab：`控制` / `日志`
- 顶部条：左侧 logo + 右侧 "历史" 圆形按钮（开抽屉）+ 状态徽标
- `HistoryDrawer` 在移动端是从底部覆盖整个屏幕的全屏抽屉

### 6.4 MobileLandscapeLayout

- 左 65% 地图
- 右 35% 固定侧栏，内含 `ControlPanel` + 折叠的 `DebugPanel`
- 历史抽屉从右侧滑入覆盖侧栏

---

## 7. 组件清单

```
src/components/
  Map/MapContainer.tsx           根据 useDeviceLayout 选择 layout，注入 state + handlers
  layouts/
    DesktopLayout.tsx
    MobileLayout.tsx
    MobileLandscapeLayout.tsx
  shared/
    ControlPanel.tsx             从原 components/Map/ 移过来，去掉外层定位 div
    DebugPanel.tsx               同上
    BottomSheet.tsx              受控 sheet：value 'peek'|'half'|'full'，onChange
  History/
    HistoryDrawer.tsx            侧/底滑出
    HistoryListItem.tsx          单条卡片
    SaveRouteDialog.tsx          保存对话框（桌面=模态，移动=底部 sheet）
```

### 7.1 ControlPanel 改动

- 移除外层 `<div className="absolute top-4 left-4 z-[2000] ...">`，仅保留内部内容
- 新增 props：`onOpenHistory: () => void`, `onSaveRoute: () => void`, `canSave: boolean`
- 顶部标题栏右侧加 "历史" 圆形图标按钮
- 主按钮下方加 "保存" 副按钮（`canSave === false` 时禁用）

### 7.2 BottomSheet

- 内部用 `transform: translateY(...)` 控制位置，三档预设
- 顶部 6px 把柄区域可拖；touch start/move/end 计算位移，松手吸附到最近档
- 防穿透：sheet 区域内的滚动不冒泡到 body
- iOS 用 `100dvh` 而非 `100vh`

---

## 8. 状态流

```
MapContainer (state owner)
├── start, end, waypoints, manualAvoidAreas, ignoredRiskIds   (现状)
├── routeInfo (来自 useRoutePlanner)
├── historyOpen, saveOpen     (UI 局部 state)
│
├── useHistory() → { routes, save, remove, rename, toggleFavorite }
├── useApplySavedRoute({ setStart, ..., plan }) → applyRoute
│
└── 渲染 layout，传入：
    - 业务 state + setters
    - canSave: !!routeInfo
    - onOpenHistory, onSaveRoute
```

保存时构造 `SavedRoute`：
```ts
const summary = routeInfo ? {
  distance: routeInfo.distance,
  duration: routeInfo.duration,
  riskCount: avoidedRisks.filter(r => !ignoredRiskIds.has(r.id)).length,
} : undefined;
```

---

## 9. 历史卡片设计

```
┌─────────────────────────────────────┐
│ ⭐ 朝阳门 → 国贸                    ⋮ │
│    途经 2 处 · 6.4km / 14分 · 8 处眼│
│    [使用此路线]                      │
└─────────────────────────────────────┘
```

- 左上 ⭐ 是收藏切换；星空心实心颜色区分
- 右上 `⋮` 弹菜单：重命名 / 删除
- 整卡可点 → 等同 `[使用此路线]`
- 按 `favorite desc, updatedAt desc` 排序，favorite 在前

---

## 10. 边界情况

| 场景 | 处理 |
|---|---|
| localStorage 写满（QuotaExceeded） | 抛 `StorageQuotaError`，UI 提示"存储已满，请删除旧记录" |
| 跨标签页修改 | `storage` 事件 → 触发 listeners → useSyncExternalStore 重渲染 |
| 旋转屏幕 | layout 切换，业务 state 全保留，地图实例不重建 |
| iOS Safari `100vh` 错位 | 一律用 `100dvh`，老 iOS 兜底 `min-height: -webkit-fill-available` |
| 软键盘弹起遮挡 sheet | 输入聚焦时 sheet 自动到 `half` 档 |
| 复用一条路线但起点 POI 已被删/无效 | 仍允许填入坐标，规划失败时给"路线规划失败"日志 |
| 一条路线没规划成功就保存 | "保存"按钮禁用（`canSave = !!routeInfo`） |
| 删除当前正在用的历史 | 不影响地图 state，只从列表移除 |
| 重命名空字符串 | 校验非空，否则保留原名 |

---

## 11. 性能与可访问性

- BottomSheet 拖动用 `requestAnimationFrame` 节流
- HistoryDrawer 卡片列表大于 50 时虚拟化（用 `react-virtual`），先不做，等用户反馈
- 所有按钮加 `aria-label`，sheet 把柄加 `role="separator" aria-orientation="horizontal"`
- 历史抽屉 `Esc` 关闭，焦点陷阱

---

## 12. 实施切片

按依赖顺序，分 5 步实现，每步可独立验证：

1. **存储层**：`storage/types.ts`、`storage/localStore.ts`、`storage/index.ts` + 单元测试（手动测）
2. **Hook 层**：`useHistory.ts`、`useDeviceLayout.ts`、`useApplySavedRoute`
3. **布局重构**：`ControlPanel`、`DebugPanel` 拆出外层定位；新建 `DesktopLayout`、`MobileLayout`、`MobileLandscapeLayout`、`BottomSheet`；`MapContainer` 改为根据 layout 分发
4. **历史 UI**：`HistoryDrawer`、`HistoryListItem`、`SaveRouteDialog`，接到 hooks
5. **联调与边界**：屏幕旋转、键盘、QuotaExceeded、跨标签页

---

## 13. 不做的事（YAGNI 边界）

- 拖拽排序历史
- 历史导入/导出 JSON
- 路线缩略图（用图标 + 文字摘要够用）
- 服务端、登录、同步（独立 spec）
- 分享 / 唤起外部 app（独立 spec）
- 多语言

---

## 14. 验收标准

- 桌面端、手机竖屏、手机横屏、平板竖屏、平板横屏 5 种形态都能正常使用规划/保存/复用
- 保存的路线刷新页面后仍在
- 一键复用后能自动规划出与原路线接近的结果（途经/避让一致即可，路况差异允许）
- localStorage 满时有可见提示，不静默失败
- 跨标签页修改即时同步
