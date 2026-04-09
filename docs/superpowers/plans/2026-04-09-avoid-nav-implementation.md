# Avoid-Nav Beijing 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个基于 Next.js 和高德地图的北京避让导航工具，支持 11w+ 风险点位的静态规避与动态 500m 实时预警。

**Architecture:** 采用 Dexie.js 进行 IndexedDB 存储，RBush 进行内存空间索引，高德 LabelsLayer 进行 WebGL 海量点位渲染。核心逻辑包含 RDP 路径抽稀和基于行驶方向的滑动窗口探测。

**Tech Stack:** Next.js 14, TypeScript, @amap/amap-jsapi-loader, Dexie, RBush, Lucide React (图标).

---

### Task 1: 依赖安装与基础环境配置

**Files:**
- Modify: `package.json`
- Modify: `.env.local`

- [ ] **Step 1: 安装核心依赖**

Run: `npm install @amap/amap-jsapi-loader dexie rbush lucide-react`
Run: `npm install -D @types/amap-js-api`

- [ ] **Step 2: 验证环境变量**

确保 `.env.local` 包含：
```env
NEXT_PUBLIC_AMAP_KEY=4c07ceb4ce06f0f9a8973b8d6cbe621d
NEXT_PUBLIC_AMAP_SECURITY_JS_CODE=你的安全密钥
AMAP_SERVICE_KEY=7a706aacd48a04f5ac50b46381880d59
```

- [ ] **Step 3: 运行预处理脚本生成数据**

Run: `npm run preprocess`
Expected: 生成 `src/lib/refined-data.json`。

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.local
git commit -m "chore: install dependencies and setup env"
```

### Task 2: 数据存储与空间索引层 (Dexie + RBush)

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/index.ts`

- [ ] **Step 1: 定义 Dexie 数据库结构**

```typescript
import Dexie, { Table } from 'dexie';

export interface RiskPoint {
  id?: number;
  lng: number;
  lat: number;
  type: string;
  risk: number;
}

export class MyDatabase extends Dexie {
  riskPoints!: Table<RiskPoint>;

  constructor() {
    super('AvoidNavDB');
    this.version(1).stores({
      riskPoints: '++id, lng, lat, type, risk'
    });
  }
}

export const db = new MyDatabase();
```

- [ ] **Step 2: 实现 RBush 索引管理器**

```typescript
import RBush from 'rbush';

interface RBushItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
  type: string;
  risk: number;
}

export class SpatialIndex {
  private tree = new RBush<RBushItem>();

  load(points: any[]) {
    const items: RBushItem[] = points.map((p, index) => ({
      minX: p[0],
      minY: p[1],
      maxX: p[0],
      maxY: p[1],
      id: `${index}`,
      type: p[2],
      risk: p[3]
    }));
    this.tree.clear();
    this.tree.load(items);
  }

  search(lng: number, lat: number, radiusKm: number) {
    // 简单的经纬度换算，1度约 111km
    const offset = radiusKm / 111;
    return this.tree.search({
      minX: lng - offset,
      minY: lat - offset,
      maxX: lng + offset,
      maxY: lat + offset
    });
  }
}

export const spatialIndex = new SpatialIndex();
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts src/lib/index.ts
git commit -m "feat: add dexie db and rbush spatial index"
```

### Task 3: 地图基础组件与海量渲染 (LabelsLayer)

**Files:**
- Create: `src/components/Map/MapContainer.tsx`
- Create: `src/app/page.tsx`

- [ ] **Step 1: 实现基础地图加载**

使用 `@amap/amap-jsapi-loader` 加载地图，中心设为北京。

- [ ] **Step 2: 实现 LabelsLayer 渲染**

从 `refined-data.json` 加载数据，根据 `risk` 分颜色渲染图标。

- [ ] **Step 3: 实现定位功能**

集成 `AMap.Geolocation` 插件，获取当前位置并标记。

- [ ] **Step 4: Commit**

```bash
git add src/components/Map/MapContainer.tsx src/app/page.tsx
git commit -m "feat: add basic map with labels layer and geolocation"
```

### Task 4: 导航避让算法 (静态规划)

**Files:**
- Modify: `src/components/Map/MapContainer.tsx`
- Create: `src/lib/utils/rdp.ts`

- [ ] **Step 1: 实现 RDP 路径抽稀算法**

将路径点集从几千个压缩到 100 个以内。

- [ ] **Step 2: 实现规避逻辑**

调用高德 `AMap.Routing` 插件，注入从 RBush 检索到的 `avoidpolygons`。

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/rdp.ts src/components/Map/MapContainer.tsx
git commit -m "feat: implement static routing with avoidance"
```

### Task 5: 实时探测与交互浮窗 (动态预警)

**Files:**
- Modify: `src/components/Map/MapContainer.tsx`
- Create: `src/components/UI/RiskOverlay.tsx`

- [ ] **Step 1: 实现 3s 轮询探测逻辑**

根据当前经纬度和 Heading，计算前方 500m 缓冲区。

- [ ] **Step 2: 实现交互弹窗**

包含“绕行”和“忽略”按钮，触发重新规划。

- [ ] **Step 3: Commit**

```bash
git add src/components/UI/RiskOverlay.tsx src/components/Map/MapContainer.tsx
git commit -m "feat: add real-time risk probing and interaction overlay"
```
