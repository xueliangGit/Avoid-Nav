# 历史记录 + 多端适配 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有北京电子眼避让导航系统上加"保存路线 / 历史复用 / 多端适配（5种 layout）"。

**Architecture:** 引入 `HistoryStorage` 抽象接口 + localStorage 实现 + `useSyncExternalStore` 订阅；用 `useDeviceLayout` 探测形态分发到 3 套 layout（DesktopLayout / MobileLayout / MobileLandscapeLayout）；现有 `ControlPanel` / `DebugPanel` 拆出外层定位作为纯内容组件。

**Tech Stack:** Next.js 16、React 19、TypeScript、Tailwind v4、lucide-react、localStorage。

**Reference Spec:** `docs/superpowers/specs/2026-05-29-history-multi-device-design.md`

---

## File Structure

新增：
```
src/lib/storage/
  types.ts             SavedRoute / HistoryStorage / StorageQuotaError
  localStore.ts        LocalHistoryStorage 实现
  index.ts             导出 historyStorage 单例

src/hooks/
  useHistory.ts                 list/save/remove/rename/toggleFavorite
  useDeviceLayout.ts            探测 LayoutMode
  useApplySavedRoute.ts         一键复用：填 state + 调 plan

src/components/
  layouts/
    DesktopLayout.tsx           现有左右布局
    MobileLayout.tsx            底部 BottomSheet 布局
    MobileLandscapeLayout.tsx   左地图右侧栏
  shared/
    BottomSheet.tsx             3 档可拖拽 sheet
  History/
    HistoryDrawer.tsx           历史抽屉（桌面右侧/移动全屏）
    HistoryListItem.tsx         单条历史卡片
    SaveRouteDialog.tsx         保存对话框
```

修改：
```
src/components/Map/ControlPanel.tsx   去掉外层定位，加 onOpenHistory/onSaveRoute/canSave props
src/components/Map/DebugPanel.tsx     去掉外层定位
src/components/Map/MapContainer.tsx   按 layout 分发，串联 useHistory + useApplySavedRoute
src/app/globals.css                   100dvh 兜底、Safari 适配
```

---

## 测试策略

项目当前没有测试框架。本次 **不引入** Jest/Vitest（避免范围溢出），采用：
- **类型检查**：`npx tsc --noEmit` 在每个有代码改动的 task 之后必须通过
- **构建检查**：完成大节后跑 `npm run build`
- **运行时验证**：手动操作浏览器在 dev 上验证行为，每个 task 末尾给清单

如果未来要补单元测试，本计划中所有"纯函数 / store"都已设计为可独立测试。

---

## 任务列表

### Task 1: 存储类型与抽象接口

**Files:**
- Create: `src/lib/storage/types.ts`

- [ ] **Step 1: 写文件**

```ts
// src/lib/storage/types.ts
import type {
  PlaceItem,
  Waypoint,
  ManualAvoidArea,
} from '@/lib/types';

export interface SavedRoute {
  id: string;
  name: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;

  start: PlaceItem;
  end: PlaceItem;
  waypoints: Waypoint[];
  manualAvoidAreas: ManualAvoidArea[];
  ignoredRiskIds: string[];

  summary?: {
    distance: number;
    duration: number;
    riskCount: number;
  };
}

export type SavedRouteInput = Omit<SavedRoute, 'id' | 'createdAt' | 'updatedAt'>;
export type SavedRoutePatch = Partial<Omit<SavedRoute, 'id' | 'createdAt'>>;

export interface HistoryStorage {
  list(): SavedRoute[];
  get(id: string): SavedRoute | null;
  save(input: SavedRouteInput): SavedRoute;
  update(id: string, patch: SavedRoutePatch): SavedRoute;
  remove(id: string): void;
  subscribe(listener: () => void): () => void;
}

export class StorageQuotaError extends Error {
  constructor() {
    super('本地存储空间不足，请删除部分历史记录');
    this.name = 'StorageQuotaError';
  }
}
```

注意：list/get 等改为同步返回，便于 useSyncExternalStore 直接消费 snapshot；
内部数据已加载在内存，localStorage 只是持久化层。

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 通过（无新错误）

- [ ] **Step 3: 提交**

```bash
git add src/lib/storage/types.ts
git commit -m "feat(storage): 历史记录类型与抽象接口"
```

---

### Task 2: localStorage 实现

**Files:**
- Create: `src/lib/storage/localStore.ts`

- [ ] **Step 1: 写实现**

```ts
// src/lib/storage/localStore.ts
import {
  HistoryStorage,
  SavedRoute,
  SavedRouteInput,
  SavedRoutePatch,
  StorageQuotaError,
} from './types';

const STORAGE_KEY = 'avoid-nav:history:v1';

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readFromStorage(): SavedRoute[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedRoute[]) : [];
  } catch {
    return [];
  }
}

function writeToStorage(routes: SavedRoute[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new StorageQuotaError();
    }
    throw err;
  }
}

function sortRoutes(routes: SavedRoute[]): SavedRoute[] {
  return [...routes].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

class LocalHistoryStorage implements HistoryStorage {
  private cache: SavedRoute[] = [];
  private listeners = new Set<() => void>();
  private hydrated = false;

  private hydrate() {
    if (this.hydrated) return;
    this.cache = sortRoutes(readFromStorage());
    this.hydrated = true;
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key !== STORAGE_KEY) return;
        this.cache = sortRoutes(readFromStorage());
        this.emit();
      });
    }
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private persist() {
    writeToStorage(this.cache);
    this.cache = sortRoutes(this.cache);
    this.emit();
  }

  list(): SavedRoute[] {
    this.hydrate();
    return this.cache;
  }

  get(id: string): SavedRoute | null {
    this.hydrate();
    return this.cache.find((r) => r.id === id) ?? null;
  }

  save(input: SavedRouteInput): SavedRoute {
    this.hydrate();
    const now = Date.now();
    const route: SavedRoute = {
      ...input,
      id: genId(),
      createdAt: now,
      updatedAt: now,
    };
    this.cache = [route, ...this.cache];
    this.persist();
    return route;
  }

  update(id: string, patch: SavedRoutePatch): SavedRoute {
    this.hydrate();
    const idx = this.cache.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error(`SavedRoute not found: ${id}`);
    const next: SavedRoute = {
      ...this.cache[idx]!,
      ...patch,
      id,
      updatedAt: Date.now(),
    };
    this.cache = [...this.cache];
    this.cache[idx] = next;
    this.persist();
    return next;
  }

  remove(id: string): void {
    this.hydrate();
    const before = this.cache.length;
    this.cache = this.cache.filter((r) => r.id !== id);
    if (this.cache.length !== before) this.persist();
  }

  subscribe(listener: () => void): () => void {
    this.hydrate();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export { LocalHistoryStorage };
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 通过

- [ ] **Step 3: 提交**

```bash
git add src/lib/storage/localStore.ts
git commit -m "feat(storage): localStorage 实现"
```

---

### Task 3: 存储单例导出

**Files:**
- Create: `src/lib/storage/index.ts`

- [ ] **Step 1: 写文件**

```ts
// src/lib/storage/index.ts
import { LocalHistoryStorage } from './localStore';
import type { HistoryStorage } from './types';

export const historyStorage: HistoryStorage = new LocalHistoryStorage();

export type {
  SavedRoute,
  SavedRouteInput,
  SavedRoutePatch,
  HistoryStorage,
} from './types';

export { StorageQuotaError } from './types';
```

- [ ] **Step 2: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/lib/storage/index.ts
git commit -m "feat(storage): 导出 historyStorage 单例"
```

---

### Task 4: useHistory hook

**Files:**
- Create: `src/hooks/useHistory.ts`

- [ ] **Step 1: 写 hook**

```ts
// src/hooks/useHistory.ts
'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { historyStorage } from '@/lib/storage';
import type { SavedRoute, SavedRouteInput } from '@/lib/storage';

export interface UseHistoryResult {
  routes: SavedRoute[];
  save: (input: SavedRouteInput) => SavedRoute;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  toggleFavorite: (id: string) => void;
}

const EMPTY: SavedRoute[] = [];

export function useHistory(): UseHistoryResult {
  const routes = useSyncExternalStore(
    historyStorage.subscribe.bind(historyStorage),
    () => historyStorage.list(),
    () => EMPTY,
  );

  const save = useCallback((input: SavedRouteInput) => historyStorage.save(input), []);
  const remove = useCallback((id: string) => historyStorage.remove(id), []);
  const rename = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    historyStorage.update(id, { name: trimmed });
  }, []);
  const toggleFavorite = useCallback((id: string) => {
    const cur = historyStorage.get(id);
    if (!cur) return;
    historyStorage.update(id, { favorite: !cur.favorite });
  }, []);

  return { routes, save, remove, rename, toggleFavorite };
}
```

- [ ] **Step 2: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/hooks/useHistory.ts
git commit -m "feat(hooks): useHistory 订阅历史存储"
```

---

### Task 5: useDeviceLayout hook

**Files:**
- Create: `src/hooks/useDeviceLayout.ts`

- [ ] **Step 1: 写 hook**

```ts
// src/hooks/useDeviceLayout.ts
'use client';

import { useEffect, useState } from 'react';

export type LayoutMode =
  | 'mobile-portrait'
  | 'mobile-landscape'
  | 'tablet-portrait'
  | 'tablet-landscape'
  | 'desktop';

function detect(): LayoutMode {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  const portrait = window.matchMedia('(orientation: portrait)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  if (finePointer && w >= 1024) return 'desktop';
  if (w >= 1024) return 'desktop';
  if (w >= 768) return portrait ? 'tablet-portrait' : 'tablet-landscape';
  return portrait ? 'mobile-portrait' : 'mobile-landscape';
}

export function useDeviceLayout(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>(() => detect());

  useEffect(() => {
    let timer: number | null = null;
    const update = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setMode(detect()), 100);
    };
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    update();
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return mode;
}
```

- [ ] **Step 2: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/hooks/useDeviceLayout.ts
git commit -m "feat(hooks): useDeviceLayout 探测 5 种形态"
```

---

### Task 6: useApplySavedRoute hook

**Files:**
- Create: `src/hooks/useApplySavedRoute.ts`

- [ ] **Step 1: 写 hook**

```ts
// src/hooks/useApplySavedRoute.ts
'use client';

import { useCallback } from 'react';
import type { SavedRoute } from '@/lib/storage';
import type {
  ManualAvoidArea,
  PlaceItem,
  Waypoint,
} from '@/lib/types';

export interface ApplySetters {
  setStart: (v: PlaceItem | null) => void;
  setEnd: (v: PlaceItem | null) => void;
  setWaypoints: (v: Waypoint[]) => void;
  setManualAvoidAreas: (v: ManualAvoidArea[]) => void;
  setIgnoredRiskIds: (v: Set<string>) => void;
  plan: (override?: {
    start?: PlaceItem | null;
    end?: PlaceItem | null;
    waypoints?: Waypoint[];
    ignoredRiskIds?: Set<string>;
    manualAvoidAreas?: ManualAvoidArea[];
  }) => Promise<void>;
}

export function useApplySavedRoute(setters: ApplySetters) {
  return useCallback(
    async (route: SavedRoute) => {
      const ignored = new Set(route.ignoredRiskIds);
      setters.setStart(route.start);
      setters.setEnd(route.end);
      setters.setWaypoints(route.waypoints);
      setters.setManualAvoidAreas(route.manualAvoidAreas);
      setters.setIgnoredRiskIds(ignored);
      // 用 override 直接传，避免依赖 setState 的同步时序
      await setters.plan({
        start: route.start,
        end: route.end,
        waypoints: route.waypoints,
        manualAvoidAreas: route.manualAvoidAreas,
        ignoredRiskIds: ignored,
      });
    },
    [setters],
  );
}
```

- [ ] **Step 2: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/hooks/useApplySavedRoute.ts
git commit -m "feat(hooks): useApplySavedRoute 一键复用"
```

---

### Task 7: ControlPanel 移除外层定位 + 加新 props

**Files:**
- Modify: `src/components/Map/ControlPanel.tsx`

- [ ] **Step 1: 修改 props 接口**

在 `ControlPanelProps` 中加：

```ts
  // 新增
  onOpenHistory: () => void;
  onSaveRoute: () => void;
  canSave: boolean;
```

- [ ] **Step 2: 修改函数签名解构**

```ts
const ControlPanel = ({
  // ...原有
  onOpenHistory,
  onSaveRoute,
  canSave,
}: ControlPanelProps) => {
```

- [ ] **Step 3: 改外层包裹**

把最外层的:
```tsx
<div className="absolute top-4 left-4 z-[2000] w-96 max-h-[calc(100vh-32px)] flex flex-col pointer-events-none">
  <div className="bg-slate-950/80 backdrop-blur shadow-2xl rounded-3xl p-6 border border-white/10 pointer-events-auto flex flex-col overflow-hidden">
    ...
  </div>
</div>
```

改为只保留内层 div（让 layout 决定外层容器）：

```tsx
<div className="bg-slate-950/80 backdrop-blur shadow-2xl rounded-3xl p-6 border border-white/10 flex flex-col overflow-hidden h-full">
  ...
</div>
```

- [ ] **Step 4: 标题栏右侧加"历史"按钮**

找到现有 title 区域：
```tsx
<div className="flex items-center justify-between mb-6 px-1">
  <div className="flex items-center space-x-3">
    <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
      <Navigation className="text-white w-5 h-5 fill-current" />
    </div>
    <h2 className="font-black text-white text-lg">北京避让导航</h2>
  </div>
  {status && (...)}
</div>
```

替换为：

```tsx
<div className="flex items-center justify-between mb-6 px-1">
  <div className="flex items-center space-x-3">
    <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
      <Navigation className="text-white w-5 h-5 fill-current" />
    </div>
    <h2 className="font-black text-white text-lg">北京避让导航</h2>
  </div>
  <div className="flex items-center space-x-2">
    {status && (
      <span className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded-lg animate-pulse font-bold tracking-widest">
        {status}
      </span>
    )}
    <button
      type="button"
      onClick={onOpenHistory}
      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition"
      aria-label="历史路线"
      title="历史路线"
    >
      <History className="w-4 h-4" />
    </button>
  </div>
</div>
```

记得在 `import` 加 `History`：

```ts
import {
  Navigation,
  X,
  LocateFixed,
  Loader2,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ShieldAlert,
  MapPin,
  Search,
  ArrowDownUp,
  History,
  Save,
} from 'lucide-react';
```

- [ ] **Step 5: 在"规划路线"主按钮下方加"保存"副按钮**

找到现有：
```tsx
{/* 规划主按钮 */}
<button ... >...</button>

{/* 路线信息 */}
{routeInfo && !planning && (...)}
```

中间插入：

```tsx
<button
  type="button"
  onClick={onSaveRoute}
  disabled={!canSave || planning}
  className="mt-2 w-full bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 py-2.5 rounded-2xl font-black text-xs transition flex items-center justify-center space-x-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
>
  <Save className="w-3.5 h-3.5" />
  <span>保存此路线</span>
</button>
```

- [ ] **Step 6: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/components/Map/ControlPanel.tsx
git commit -m "refactor(control-panel): 移除外层定位，加历史/保存入口"
```

---

### Task 8: DebugPanel 移除外层定位

**Files:**
- Modify: `src/components/Map/DebugPanel.tsx`

- [ ] **Step 1: 改外层 div**

把最外层带 `absolute top-4 right-4 ...` 的那一层去掉，仅保留内容容器，加 `h-full w-full`。

- [ ] **Step 2: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/components/Map/DebugPanel.tsx
git commit -m "refactor(debug-panel): 移除外层定位"
```

---

### Task 9: BottomSheet 组件

**Files:**
- Create: `src/components/shared/BottomSheet.tsx`

- [ ] **Step 1: 写组件**

```tsx
// src/components/shared/BottomSheet.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SheetHeight = 'peek' | 'half' | 'full';

const HEIGHT_VH: Record<SheetHeight, number> = {
  peek: 14,    // 约 120px @ 800h
  half: 50,
  full: 88,
};

interface BottomSheetProps {
  height: SheetHeight;
  onHeightChange: (h: SheetHeight) => void;
  children: React.ReactNode;
}

export default function BottomSheet({ height, onHeightChange, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragOffsetVh, setDragOffsetVh] = useState(0);
  const dragStateRef = useRef<{
    startY: number;
    startVh: number;
    pointerId: number | null;
  } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragStateRef.current = {
      startY: e.clientY,
      startVh: HEIGHT_VH[height],
      pointerId: e.pointerId,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [height]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const st = dragStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    const dy = e.clientY - st.startY;
    const dvh = -(dy / window.innerHeight) * 100;
    setDragOffsetVh(dvh);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const st = dragStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    const finalVh = st.startVh + dragOffsetVh;
    const targets: SheetHeight[] = ['peek', 'half', 'full'];
    let best: SheetHeight = 'peek';
    let bestDist = Infinity;
    for (const t of targets) {
      const d = Math.abs(HEIGHT_VH[t] - finalVh);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    setDragOffsetVh(0);
    dragStateRef.current = null;
    onHeightChange(best);
  }, [dragOffsetVh, onHeightChange]);

  const currentVh = HEIGHT_VH[height] + dragOffsetVh;
  const clamped = Math.max(8, Math.min(95, currentVh));

  return (
    <div
      ref={sheetRef}
      className="fixed left-0 right-0 bottom-0 z-[2000] bg-slate-950/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl shadow-2xl flex flex-col touch-none"
      style={{
        height: `${clamped}dvh`,
        transition: dragStateRef.current ? 'none' : 'height 0.25s ease',
      }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="w-full pt-2 pb-3 flex items-center justify-center cursor-grab active:cursor-grabbing"
        role="separator"
        aria-orientation="horizontal"
      >
        <div className="w-10 h-1.5 rounded-full bg-white/30" />
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/components/shared/BottomSheet.tsx
git commit -m "feat(shared): BottomSheet 三档高度可拖"
```

---

### Task 10: HistoryListItem 组件

**Files:**
- Create: `src/components/History/HistoryListItem.tsx`

- [ ] **Step 1: 写组件**

```tsx
// src/components/History/HistoryListItem.tsx
'use client';

import { useState } from 'react';
import { Star, MoreVertical, Trash2, Pencil, Check, X } from 'lucide-react';
import type { SavedRoute } from '@/lib/storage';

interface Props {
  route: SavedRoute;
  onUse: (route: SavedRoute) => void;
  onToggleFavorite: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}

function fmtKm(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
}
function fmtMin(s: number): string {
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}时${m % 60}分` : `${m}分`;
}

export default function HistoryListItem({
  route,
  onUse,
  onToggleFavorite,
  onRename,
  onRemove,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(route.name);

  const commit = () => {
    if (draft.trim()) onRename(route.id, draft.trim());
    setEditing(false);
  };

  return (
    <div className="bg-slate-900/70 border border-white/5 rounded-2xl p-3 hover:bg-slate-900 transition">
      <div className="flex items-start justify-between gap-2 mb-2">
        <button
          type="button"
          onClick={() => onToggleFavorite(route.id)}
          className="shrink-0 p-1 -ml-1 text-slate-500 hover:text-amber-400 transition"
          aria-label={route.favorite ? '取消收藏' : '收藏'}
        >
          <Star
            className={`w-4 h-4 ${route.favorite ? 'fill-amber-400 text-amber-400' : ''}`}
          />
        </button>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit();
                  if (e.key === 'Escape') {
                    setDraft(route.name);
                    setEditing(false);
                  }
                }}
                className="flex-1 bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-blue-500/40"
                autoFocus
              />
              <button onClick={commit} className="p-1 text-emerald-400" aria-label="确认">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setDraft(route.name);
                  setEditing(false);
                }}
                className="p-1 text-slate-400"
                aria-label="取消"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <h4 className="text-xs font-bold text-white truncate">{route.name}</h4>
          )}
          <p className="text-[10px] text-slate-500 mt-1 truncate">
            {route.start.name} → {route.end.name}
          </p>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1 text-slate-500 hover:text-white transition"
            aria-label="更多"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-10 bg-slate-800 border border-white/10 rounded-xl shadow-2xl py-1 min-w-[120px]">
              <button
                onClick={() => {
                  setEditing(true);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/5 flex items-center gap-2"
              >
                <Pencil className="w-3 h-3" /> 重命名
              </button>
              <button
                onClick={() => {
                  onRemove(route.id);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
              >
                <Trash2 className="w-3 h-3" /> 删除
              </button>
            </div>
          )}
        </div>
      </div>

      {(route.waypoints.length > 0 || route.summary) && (
        <p className="text-[10px] text-slate-500 mb-2">
          {route.waypoints.length > 0 && `途经 ${route.waypoints.length} 处`}
          {route.summary && route.waypoints.length > 0 && ' · '}
          {route.summary && `${fmtKm(route.summary.distance)} / ${fmtMin(route.summary.duration)}`}
          {route.summary && ` · ${route.summary.riskCount} 处眼`}
        </p>
      )}

      <button
        type="button"
        onClick={() => onUse(route)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-[11px] font-black transition"
      >
        使用此路线
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/components/History/HistoryListItem.tsx
git commit -m "feat(history): HistoryListItem 卡片"
```

---

### Task 11: HistoryDrawer 组件

**Files:**
- Create: `src/components/History/HistoryDrawer.tsx`

- [ ] **Step 1: 写组件**

```tsx
// src/components/History/HistoryDrawer.tsx
'use client';

import { useEffect } from 'react';
import { X, ListOrdered } from 'lucide-react';
import type { SavedRoute } from '@/lib/storage';
import HistoryListItem from './HistoryListItem';

interface Props {
  open: boolean;
  variant: 'side' | 'fullscreen';
  routes: SavedRoute[];
  onClose: () => void;
  onUse: (route: SavedRoute) => void;
  onToggleFavorite: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}

export default function HistoryDrawer({
  open,
  variant,
  routes,
  onClose,
  onUse,
  onToggleFavorite,
  onRename,
  onRemove,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const containerClass =
    variant === 'side'
      ? 'fixed top-4 right-4 bottom-4 w-[360px] z-[2100] flex flex-col'
      : 'fixed inset-0 z-[2100] flex flex-col';

  return (
    <>
      <div
        className="fixed inset-0 z-[2050] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`${containerClass} bg-slate-950 ${
          variant === 'side' ? 'rounded-3xl border border-white/10 shadow-2xl' : ''
        }`}
        role="dialog"
        aria-label="历史路线"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-blue-400" />
            <h3 className="font-black text-white text-sm">历史路线 ({routes.length})</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 custom-scrollbar">
          {routes.length === 0 ? (
            <div className="text-center text-slate-500 text-xs py-12">
              还没有保存的路线
              <br />
              规划完路线后点"保存此路线"
            </div>
          ) : (
            routes.map((r) => (
              <HistoryListItem
                key={r.id}
                route={r}
                onUse={(rt) => {
                  onUse(rt);
                  onClose();
                }}
                onToggleFavorite={onToggleFavorite}
                onRename={onRename}
                onRemove={onRemove}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/components/History/HistoryDrawer.tsx
git commit -m "feat(history): HistoryDrawer 抽屉"
```

---

### Task 12: SaveRouteDialog 组件

**Files:**
- Create: `src/components/History/SaveRouteDialog.tsx`

- [ ] **Step 1: 写组件**

```tsx
// src/components/History/SaveRouteDialog.tsx
'use client';

import { useEffect, useState } from 'react';
import { X, Save, Star } from 'lucide-react';

interface Props {
  open: boolean;
  variant: 'modal' | 'sheet';
  defaultName: string;
  onClose: () => void;
  onConfirm: (name: string, favorite: boolean) => void;
  errorMessage?: string;
}

export default function SaveRouteDialog({
  open,
  variant,
  defaultName,
  onClose,
  onConfirm,
  errorMessage,
}: Props) {
  const [name, setName] = useState(defaultName);
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setFavorite(false);
    }
  }, [open, defaultName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const containerClass =
    variant === 'modal'
      ? 'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px]'
      : 'fixed left-0 right-0 bottom-0 rounded-t-3xl';

  const handleConfirm = () => {
    const t = name.trim();
    if (!t) return;
    onConfirm(t, favorite);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[2200] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`${containerClass} z-[2210] bg-slate-950 border border-white/10 shadow-2xl ${
          variant === 'modal' ? 'rounded-3xl' : ''
        } p-5`}
        role="dialog"
        aria-label="保存路线"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-white text-sm flex items-center gap-2">
            <Save className="w-4 h-4 text-emerald-400" />
            保存路线
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm();
          }}
          placeholder="路线名称"
          className="w-full bg-slate-900 border border-white/10 rounded-2xl py-3 px-4 text-xs text-white font-bold focus:outline-none focus:border-blue-500/40 mb-3"
        />

        <button
          type="button"
          onClick={() => setFavorite((v) => !v)}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl font-bold text-xs transition mb-4 ${
            favorite
              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
              : 'bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${favorite ? 'fill-amber-400' : ''}`} />
          {favorite ? '已收藏' : '加入收藏'}
        </button>

        {errorMessage && (
          <div className="text-[11px] text-red-400 mb-3 text-center">{errorMessage}</div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 py-3 rounded-2xl font-black text-xs transition"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!name.trim()}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-500 text-white py-3 rounded-2xl font-black text-xs transition"
          >
            保存
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/components/History/SaveRouteDialog.tsx
git commit -m "feat(history): SaveRouteDialog 保存对话框"
```

---

### Task 13: DesktopLayout

**Files:**
- Create: `src/components/layouts/DesktopLayout.tsx`

- [ ] **Step 1: 写组件**

```tsx
// src/components/layouts/DesktopLayout.tsx
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
      <div className="absolute top-4 left-4 z-[2000] w-96 max-h-[calc(100vh-32px)] pointer-events-auto">
        {controlPanel}
      </div>
      <div className="absolute top-4 right-4 z-[2000] w-80 h-[400px] pointer-events-auto">
        {debugPanel}
      </div>
      {mapElement}
    </div>
  );
}
```

- [ ] **Step 2: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/components/layouts/DesktopLayout.tsx
git commit -m "feat(layout): DesktopLayout"
```

---

### Task 14: MobileLayout（含 Tab 切换）

**Files:**
- Create: `src/components/layouts/MobileLayout.tsx`

- [ ] **Step 1: 写组件**

```tsx
// src/components/layouts/MobileLayout.tsx
'use client';

import { useState, type ReactNode } from 'react';
import BottomSheet, { type SheetHeight } from '@/components/shared/BottomSheet';

interface Props {
  controlPanel: ReactNode;
  debugPanel: ReactNode;
  mapElement: ReactNode;
}

type TabKey = 'control' | 'debug';

export default function MobileLayout({ controlPanel, debugPanel, mapElement }: Props) {
  const [height, setHeight] = useState<SheetHeight>('half');
  const [tab, setTab] = useState<TabKey>('control');

  return (
    <div className="relative w-full h-full">
      {mapElement}
      <BottomSheet height={height} onHeightChange={setHeight}>
        <div className="flex flex-col h-full">
          <div className="flex border-b border-white/5 px-4">
            <TabButton active={tab === 'control'} onClick={() => setTab('control')}>
              控制
            </TabButton>
            <TabButton active={tab === 'debug'} onClick={() => setTab('debug')}>
              日志
            </TabButton>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
            {tab === 'control' ? controlPanel : debugPanel}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 text-xs font-black transition border-b-2 ${
        active
          ? 'text-blue-400 border-blue-400'
          : 'text-slate-500 border-transparent hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/components/layouts/MobileLayout.tsx
git commit -m "feat(layout): MobileLayout 底部抽屉"
```

---

### Task 15: MobileLandscapeLayout

**Files:**
- Create: `src/components/layouts/MobileLandscapeLayout.tsx`

- [ ] **Step 1: 写组件**

```tsx
// src/components/layouts/MobileLandscapeLayout.tsx
'use client';

import { useState, type ReactNode } from 'react';

interface Props {
  controlPanel: ReactNode;
  debugPanel: ReactNode;
  mapElement: ReactNode;
}

type TabKey = 'control' | 'debug';

export default function MobileLandscapeLayout({
  controlPanel,
  debugPanel,
  mapElement,
}: Props) {
  const [tab, setTab] = useState<TabKey>('control');

  return (
    <div className="relative w-full h-full flex">
      <div className="flex-1 relative">{mapElement}</div>
      <div className="w-[40%] max-w-[420px] min-w-[280px] bg-slate-950/95 backdrop-blur-xl border-l border-white/10 flex flex-col">
        <div className="flex border-b border-white/5 px-3">
          <button
            type="button"
            onClick={() => setTab('control')}
            className={`px-3 py-2.5 text-[11px] font-black ${
              tab === 'control' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500'
            }`}
          >
            控制
          </button>
          <button
            type="button"
            onClick={() => setTab('debug')}
            className={`px-3 py-2.5 text-[11px] font-black ${
              tab === 'debug' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500'
            }`}
          >
            日志
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
          {tab === 'control' ? controlPanel : debugPanel}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/components/layouts/MobileLandscapeLayout.tsx
git commit -m "feat(layout): MobileLandscapeLayout"
```

---

### Task 16: 集成 — MapContainer 重构

**Files:**
- Modify: `src/components/Map/MapContainer.tsx`

- [ ] **Step 1: 在 MapContainer 顶部加导入**

```tsx
import { useDeviceLayout } from '@/hooks/useDeviceLayout';
import { useHistory } from '@/hooks/useHistory';
import { useApplySavedRoute } from '@/hooks/useApplySavedRoute';
import { StorageQuotaError, type SavedRoute } from '@/lib/storage';
import DesktopLayout from '@/components/layouts/DesktopLayout';
import MobileLayout from '@/components/layouts/MobileLayout';
import MobileLandscapeLayout from '@/components/layouts/MobileLandscapeLayout';
import HistoryDrawer from '@/components/History/HistoryDrawer';
import SaveRouteDialog from '@/components/History/SaveRouteDialog';
```

- [ ] **Step 2: 加 state**

在 `mode` state 附近加：
```tsx
const [historyOpen, setHistoryOpen] = useState(false);
const [saveOpen, setSaveOpen] = useState(false);
const [saveError, setSaveError] = useState<string | undefined>(undefined);

const layoutMode = useDeviceLayout();
const { routes, save, remove, rename, toggleFavorite } = useHistory();
```

- [ ] **Step 3: 接 useApplySavedRoute**

把 setters 用 `useMemo` 打包并 stable 化（避免 hook 引用每渲染变化）：

```tsx
const applySetters = useMemo(
  () => ({
    setStart,
    setEnd,
    setWaypoints,
    setManualAvoidAreas,
    setIgnoredRiskIds,
    plan,
  }),
  [plan],
);
const applyRoute = useApplySavedRoute(applySetters);
```

注意：`plan` 来自 `useRoutePlanner`，签名已支持 override。

- [ ] **Step 4: 加保存/打开历史的回调**

```tsx
const canSave = !!routeInfo && !planning;

const handleOpenHistory = useCallback(() => setHistoryOpen(true), []);
const handleCloseHistory = useCallback(() => setHistoryOpen(false), []);

const handleOpenSave = useCallback(() => {
  setSaveError(undefined);
  setSaveOpen(true);
}, []);
const handleCloseSave = useCallback(() => setSaveOpen(false), []);

const handleConfirmSave = useCallback(
  (name: string, favorite: boolean) => {
    if (!start || !end) return;
    try {
      save({
        name,
        favorite,
        start,
        end,
        waypoints,
        manualAvoidAreas,
        ignoredRiskIds: Array.from(ignoredRiskIds),
        summary: routeInfo
          ? {
              distance: routeInfo.distance,
              duration: routeInfo.duration,
              riskCount: avoidedRisks.filter((r) => !ignoredRiskIds.has(r.id)).length,
            }
          : undefined,
      });
      setSaveOpen(false);
    } catch (e) {
      if (e instanceof StorageQuotaError) {
        setSaveError(e.message);
      } else {
        setSaveError('保存失败');
      }
    }
  },
  [start, end, waypoints, manualAvoidAreas, ignoredRiskIds, routeInfo, avoidedRisks, save],
);

const handleUseRoute = useCallback(
  (route: SavedRoute) => {
    void applyRoute(route);
  },
  [applyRoute],
);
```

- [ ] **Step 5: 把 ControlPanel/DebugPanel 提取为本地变量**

把现有 `<ControlPanel ... />` 和 `<DebugPanel ... />` 抽出来放在 return 之前：

```tsx
const controlPanelNode = (
  <ControlPanel
    /* 所有原 props ... */
    onOpenHistory={handleOpenHistory}
    onSaveRoute={handleOpenSave}
    canSave={canSave}
  />
);

const debugPanelNode = <DebugPanel logs={logs} />;

const mapElement = (
  <div
    id={MAP_CONTAINER_ID}
    className="absolute inset-0 w-full h-full"
    style={{ cursor: mapCursor }}
  />
);
```

注意 `mapElement` 改为 `absolute inset-0`，让 layout 容器决定边界。

- [ ] **Step 6: 按 layoutMode 分发**

```tsx
const useDesktop = layoutMode === 'desktop' || layoutMode === 'tablet-landscape';

const layoutContent = useDesktop ? (
  <DesktopLayout
    controlPanel={controlPanelNode}
    debugPanel={debugPanelNode}
    mapElement={mapElement}
  />
) : layoutMode === 'mobile-landscape' ? (
  <MobileLandscapeLayout
    controlPanel={controlPanelNode}
    debugPanel={debugPanelNode}
    mapElement={mapElement}
  />
) : (
  <MobileLayout
    controlPanel={controlPanelNode}
    debugPanel={debugPanelNode}
    mapElement={mapElement}
  />
);

const drawerVariant: 'side' | 'fullscreen' = useDesktop ? 'side' : 'fullscreen';
const dialogVariant: 'modal' | 'sheet' = useDesktop ? 'modal' : 'sheet';

const defaultSaveName =
  start && end ? `${start.name} → ${end.name}` : '我的路线';
```

- [ ] **Step 7: return 结构**

```tsx
return (
  <div className="relative w-full h-full bg-slate-900 overflow-hidden text-slate-200">
    {layoutContent}

    {mode !== 'none' && (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1900] pointer-events-none">
        <div className="bg-amber-500/90 text-slate-900 text-xs font-black px-4 py-2 rounded-full shadow-2xl backdrop-blur">
          {mode === 'add-waypoint' ? '点击地图添加途经点' : '点击地图标记避让区'}
        </div>
      </div>
    )}

    {error && (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1900] pointer-events-none">
        <div className="bg-red-600/90 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-2xl">
          地图加载失败: {error}
        </div>
      </div>
    )}

    <HistoryDrawer
      open={historyOpen}
      variant={drawerVariant}
      routes={routes}
      onClose={handleCloseHistory}
      onUse={handleUseRoute}
      onToggleFavorite={toggleFavorite}
      onRename={rename}
      onRemove={remove}
    />

    <SaveRouteDialog
      open={saveOpen}
      variant={dialogVariant}
      defaultName={defaultSaveName}
      errorMessage={saveError}
      onClose={handleCloseSave}
      onConfirm={handleConfirmSave}
    />

    <style jsx global>{`
      .amap-sug-result { ... 现有样式 ... }
      .auto-item { ... }
      .custom-scrollbar::-webkit-scrollbar { width: 4px; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
    `}</style>
  </div>
);
```

注意：原本写在外层 div 上的 `flex flex-col` 不再需要——layout 自己负责定位。地图 div 也不再单独占 `flex-1`，改为 layout 内部的 absolute inset-0 / 单元格。

- [ ] **Step 8: 类型检查 + 构建检查**

```bash
npx tsc --noEmit
npm run build
```

Expected: 都通过

- [ ] **Step 9: 提交**

```bash
git add src/components/Map/MapContainer.tsx
git commit -m "feat(map): 集成历史记录、保存、多端 layout 分发"
```

---

### Task 17: 全局样式补 dvh 与 Safari 兜底

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: 替换/扩充**

```css
@import "tailwindcss";

html, body {
  height: 100%;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  /* iOS Safari 兜底 */
  min-height: -webkit-fill-available;
}

#container {
  height: 100%;
  width: 100%;
}

/* 让 100vh 在移动端使用 dvh */
@supports (height: 100dvh) {
  html, body { height: 100dvh; }
}

.amap-sug-result {
  z-index: 9999 !important;
  border: none !important;
  border-radius: 16px !important;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4) !important;
  padding: 8px !important;
  background: #0f172a !important;
  color: white !important;
}
.auto-item {
  padding: 10px 14px !important;
  font-size: 13px !important;
  color: #f1f5f9 !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  border-radius: 10px !important;
}
.auto-item:hover {
  background-color: #1e293b !important;
  color: #4f46e5 !important;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/globals.css
git commit -m "style: 100dvh 与 Safari 兜底"
```

---

### Task 18: 联调验证

无新代码，只跑验证。

- [ ] **Step 1: 类型 + 构建**

```bash
npx tsc --noEmit
npm run build
```

Expected: 全通过

- [ ] **Step 2: 启动 dev**

```bash
npx next dev -p 3200
```

- [ ] **Step 3: 桌面端验收（浏览器宽度 ≥ 1024）**

清单：
- [ ] 左面板可见，含起终点搜索、规划按钮
- [ ] 起终点都设了之后，"保存此路线"由灰变绿色可点
- [ ] 规划完出现 routeInfo 后，点保存 → 弹模态对话框、可改名字、可勾收藏
- [ ] 点头部"历史"图标 → 右侧抽屉滑出
- [ ] 抽屉里点"使用此路线" → 输入框、避让列表回填，自动重新规划
- [ ] 收藏切换、重命名、删除生效
- [ ] Esc 关闭抽屉/对话框

- [ ] **Step 4: 手机竖屏验收（DevTools iPhone 模拟）**

- [ ] 底部抽屉显示，可拖到 peek/half/full 三档
- [ ] Tab 切"控制"/"日志"
- [ ] 顶部"历史"按钮在控制面板顶部
- [ ] 历史抽屉是全屏覆盖
- [ ] 保存对话框是底部 sheet 形态

- [ ] **Step 5: 手机横屏验收（DevTools 旋转 iPhone）**

- [ ] 左地图 + 右侧栏布局
- [ ] 侧栏 Tab 切换正常

- [ ] **Step 6: 平板竖屏（768-1024，竖屏）**

- [ ] 走 MobileLayout

- [ ] **Step 7: 平板横屏（768-1024，横屏）**

- [ ] 走 DesktopLayout（左面板+右日志）

- [ ] **Step 8: 跨标签页同步测试**

- [ ] 开两个标签页 → 一个标签页保存路线 → 另一个标签页历史抽屉立即出现

- [ ] **Step 9: 配额测试（可选）**

- [ ] DevTools Application → Local Storage 手动塞满 → 触发保存 → 看到提示

- [ ] **Step 10: 验收完成提交**

```bash
# 如果联调中没有改动，跳过此步
git status
```

---

## Self-Review

### Spec coverage

| Spec 要求 | Task |
|---|---|
| SavedRoute 类型 + HistoryStorage 接口 | Task 1 |
| localStorage 实现（含 storage 事件、quota 处理） | Task 2 |
| historyStorage 单例 | Task 3 |
| useHistory（含 toggleFavorite/rename） | Task 4 |
| useDeviceLayout 5 种形态 | Task 5 |
| useApplySavedRoute（填 state + 调 plan） | Task 6 |
| ControlPanel 拆出外层定位 + 历史/保存入口 | Task 7 |
| DebugPanel 拆出外层定位 | Task 8 |
| BottomSheet 三档 | Task 9 |
| HistoryListItem | Task 10 |
| HistoryDrawer（side/fullscreen 两 variant） | Task 11 |
| SaveRouteDialog（modal/sheet 两 variant） | Task 12 |
| DesktopLayout / MobileLayout / MobileLandscapeLayout | Task 13/14/15 |
| MapContainer 串联 + 分发 | Task 16 |
| 100dvh + Safari 兜底 | Task 17 |
| 5 形态 + 跨标签页 + quota 联调 | Task 18 |

无遗漏。

### Placeholder scan

- ✅ 所有 step 都有完整代码
- ✅ "现有样式 ..." 在 Task 16 step 7 是占位说明用户保留原值，已在前文 Task 17 显式列全
- ✅ 没有 TBD / TODO / 模糊"加错误处理"

### Type consistency

- `SavedRoute / SavedRouteInput / SavedRoutePatch` 在 Task 1 定义，Task 2-4-6-10-11-12-16 均按此使用
- `LayoutMode` 5 个枚举值在 Task 5 定义，Task 16 按此分发
- `SheetHeight` 在 Task 9 定义，Task 14 使用
- `plan` 的 override 形参在现有 `useRoutePlanner.ts` 已实现，Task 6 与之对齐

### 风险点

- Task 16 改动较大（MapContainer 既要保留现有功能，又要叠 4 个新组件）。如果联调遇到问题，先回退到 Task 15 完成态再小步重做 Task 16。
- BottomSheet 的拖拽体验需要在真机测，DevTools 模拟可能不完全一致。

---

## 完成标准

按上述 18 个 Task 全部完成，且 Task 18 的所有验收清单打勾，则视为本计划完成。
