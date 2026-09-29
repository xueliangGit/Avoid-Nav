# 北京避让导航：全栈技术交接文档 (2026-09-29)

## 1. 系统现状与版本基准
- **当前版本**：`v1.2.1`（Commit: `9fce912`）
- **核心数据**：6,270 处进京与环线监控点位（更新日期：2026-09-29）
- **工程框架**：Next.js 16.2.3 (Turbopack) / React 19.2 / TypeScript 6.0
- **代码规范**：全工程单文件限制在 400 行以内，集成 ESLint 9 Flat Config 校验

---

## 2. 系统核心架构与目录分工

```text
src/
├── app/                  # Next.js App Router 根布局与单页入口
├── components/
│   ├── Map/
│   │   ├── MapContainer.tsx   # 地图主容器与响应式分发 (374行)
│   │   ├── ControlPanel.tsx   # 左侧控制面板布局装配 (231行)
│   │   ├── DebugPanel.tsx     # 右侧算法日志调试面板
│   │   └── components/        # 控制面板高内聚解耦子组件
│   │       ├── EndpointInputs.tsx    # 起终点输入/互换/清除 (120行)
│   │       ├── WaypointList.tsx      # 途经点管理 (67行)
│   │       ├── AvoidAreaList.tsx     # 手动避让区与尺寸选择 (93行)
│   │       ├── RouteActionBar.tsx    # 规划/导航/分享动作条 (121行)
│   │       └── RiskDetailSection.tsx # 四类风险折叠列表 (306行)
│   ├── History/          # 历史路线抽屉、卡片与保存对话框
│   ├── shared/           # 通用组件 (更新徽标、弹窗、Toast、微信引导)
│   └── layouts/          # 桌面端 / 移动竖屏 / 移动横屏 响应式视口布局
├── hooks/                # 领域状态解耦 Hooks
│   ├── useAMap.ts                # AMap JSAPI 加载与 MassMarks 海量点渲染
│   ├── useRoutePlanner.ts        # 多轮递归规划驱动与碰撞检测 (392行)
│   ├── useAvoidState.ts          # 点位与规避规则状态管理 (74行)
│   ├── useMapInteractions.ts     # AutoComplete与地图点击逆地理编码 (167行)
│   ├── useMapRiskFocus.ts        # 风险点视口平移与脉冲光圈高亮 (58行)
│   ├── useNavigationAction.ts    # 高德 App 唤起与微信防拦截 (63行)
│   ├── useRouteSharing.ts        # 路线 Base64URL 编解码与链接同步 (120行)
│   ├── useRouteStorageActions.ts # 历史路线读写与存储配额管理 (149行)
│   ├── usePlanAction.ts          # 规划动作触发与文本防丢兜底 (86行)
│   └── useTheme.ts               # 明暗主题切换与本地持久化
└── lib/                  # 纯算法与数据契约
    ├── avoidance.ts      # 风险扫描、聚类合并与避让多边形构建 (320行)
    ├── direction.ts      # 行驶夹角计算与方向拓扑匹配
    ├── navigation.ts     # Android / iOS / Web 导航 URI 拼装
    ├── share.ts          # 路线方案状态序列化协议
    ├── spatial.ts        # RBush 空间索引初始化与快速查询
    └── changelog.ts      # 版本记录与数据新鲜度契约
```

---

## 3. 核心机制与核心数据流

### 3.1 数据更新流
1. 执行 `npm run update-data`；
2. `scripts/fetch-jinjing.js` 从数据源抓取最新点位数组写入根目录 `data.json`；
3. `scripts/preprocess.js` 自动清洗、校验坐标并映射七元组格式：`[lng, lat, aa, risk, href, name, direction]`，压缩输出至 `src/lib/refined-data.json`。

### 3.2 智能避让与规划链路
1. **空间初筛**：将 6,270 处点位注入 RBush R-Tree 树结构，空间检索耗时 < 1ms。
2. **多轮递归探测 (`useRoutePlanner.ts`)**：
   - 首次规划获取原始路线轨迹点。
   - 沿路线扫描 80 米范围内的摄像头点位。
   - 通过向量点积与方向夹角匹配，过滤合法行驶方向点。
   - 将冲突点聚类膨胀为避让多边形（Avoid Polygons），最多探测 8 轮。
3. **唤起 App 导航 (`useNavigationAction.ts`)**：
   - 抽取最终安全轨迹上的 RDP 关键拐点作为途经点。
   - 组合起终点与关键点，生成 `amapuri://` (Android) 或 `iosamap://` (iOS) URI 调起真机实时高德导航。

---

## 4. 运行环境与运维指引

### 4.1 环境变量
创建 `.env.local` 文件，配置如下参数：
```ini
NEXT_PUBLIC_AMAP_KEY=高德地图Web端开发者Key
NEXT_PUBLIC_AMAP_SECURITY_JS_CODE=高德地图32位安全密钥
```

### 4.2 运维命令清单
- **本地调试**：`npm run dev`（监听 3200 端口）。
- **静态检查**：`npm run lint`（ESLint 9 严格模式）。
- **生产构建**：`npm run build`（Turbopack + TypeScript 预检查）。
- **生产启动**：`npm run start`。

---

## 5. 后续演进建议 (Backlog)

1. **分享 Token 压缩优化**：目前 Base64URL 编码后在极端长避让区下 URL 较长，建议引入 `lz-string` 压缩将体积缩减 60%。
2. **车牌尾号限行联动**：接入北京市工作日高峰期尾号限行规则，自动计算本日受限车辆进入五环提示。
3. **多策略方案比对**：支持“避让优先”与“耗时最短”多方案路线同屏对比。
