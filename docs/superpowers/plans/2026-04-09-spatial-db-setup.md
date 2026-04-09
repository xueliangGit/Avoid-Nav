# 空间索引与数据库定义实施计划

> **对于代理工人：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 任务接任务地实施此计划。步骤使用复选框 (`- [ ]`) 语法进行跟踪。

**目标：** 创建 `src/lib/db.ts` 和 `src/lib/index.ts`，用于管理风险点数据和空间查询。

**架构：**
* `db.ts`：使用 Dexie (IndexedDB 包装器) 定义本地数据库架构。
* `index.ts`：使用 RBush 实现 R-Tree 空间索引，用于高效的半径搜索。

**技术栈：** TypeScript, Dexie, RBush.

---

### 任务 1：创建 `src/lib/db.ts`
**文件：**
- 创建：`src/lib/db.ts`

- [ ] **步骤 1：定义 AvoidNavDB 类**
```typescript
import Dexie, { type Table } from 'dexie';

export interface RiskPoint {
  id?: number;
  lng: number;
  lat: number;
  type: string;
  risk: number;
}

export class AvoidNavDB extends Dexie {
  riskPoints!: Table<RiskPoint>;

  constructor() {
    super('AvoidNavDB');
    this.version(1).stores({
      riskPoints: '++id, lng, lat, type, risk'
    });
  }
}

export const db = new AvoidNavDB();
```

---

### 任务 2：创建 `src/lib/index.ts`
**文件：**
- 创建：`src/lib/index.ts`

- [ ] **步骤 1：实现 SpatialIndex 类**
```typescript
import RBush from 'rbush';

interface PointItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  data: {
    lng: number;
    lat: number;
    type: string;
    risk: number;
  };
}

export class SpatialIndex {
  private tree: RBush<PointItem>;

  constructor() {
    this.tree = new RBush<PointItem>();
  }

  load(points: any[]) {
    const items: PointItem[] = points.map(p => ({
      minX: p[0],
      minY: p[1],
      maxX: p[0],
      maxY: p[1],
      data: {
        lng: p[0],
        lat: p[1],
        type: p[2],
        risk: p[3]
      }
    }));
    this.tree.clear();
    this.tree.load(items);
  }

  search(lng: number, lat: number, radiusKm: number) {
    // 1度约 111km，500m 约为 0.0045度
    const degreeDiff = radiusKm / 111;
    const results = this.tree.search({
      minX: lng - degreeDiff,
      minY: lat - degreeDiff,
      maxX: lng + degreeDiff,
      maxY: lat + degreeDiff
    });
    
    return results.map(item => item.data);
  }
}

export const spatialIndex = new SpatialIndex();
```
