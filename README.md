# 北京避让导航 (Avoid-Nav Beijing)

基于高德地图 JS API 2.0 的北京进京证与交通监控智能避让导航应用。通过递归探测避让算法、方向感知过滤与 R-Tree 空间索引，自动规划规避限行与高风险监控点位的最佳行车路径。

## 核心特性
- **数据源与点位**：内置 6,270 处最新北京监控点位（进京证、早晚高峰、六环内外、新增点位）。
- **递归智能避让**：多轮 Driving 规划结合多边形避让算法，动态扫描路径 80m 内冲突点位。
- **方向拓扑匹配**：自动提取监控方向与车辆行驶向量，夹角判定放行无冲突的反向/横穿点位。
- **自定义避让区**：支持在地图上手动画定 30m/60m/100m 禁行避让区域。
- **高德 App 联动**：提取路径 RDP 关键途经点，支持一键唤起 Android / iOS 高德地图 App 实时导航。
- **路线短链分享**：Base64URL 序列化方案状态，支持跨设备与好友免登还原路线。
- **本地历史记录**：支持保存、重命名、置顶收藏与历史路线一键加载。
- **明暗主题适配**：浅色、深色、跟随系统无缝切换。

## 技术栈与规范
- **框架**：Next.js 16.2.3 (Turbopack) + React 19 + TypeScript 6
- **样式**：Tailwind CSS v4 + Lucide Icons
- **地图引擎**：@amap/amap-jsapi-loader + AMap JS API 2.0 (MassMarks 海量点渲染)
- **空间索引**：RBush (R-Tree 空间检索)
- **代码规范**：ESLint 9 Flat Config + 单文件 200~400 行严格架构约束

## 常用命令
```bash
# 启动本地开发服务 (端口 3200)
npm run dev

# 抓取最新点位并精炼数据
npm run update-data

# 代码规范检查
npm run lint

# 生产环境构建
npm run build

# 启动生产服务
npm run start
```

## 环境变量配置 (`.env.local`)
```ini
NEXT_PUBLIC_AMAP_KEY=你的高德地图Web端Key
NEXT_PUBLIC_AMAP_SECURITY_JS_CODE=你的高德地图安全密钥
```
