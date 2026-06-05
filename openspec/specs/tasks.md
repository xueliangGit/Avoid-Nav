# 任务清单：Avoid-Nav Beijing

> 最近更新：2026-06-05。详细状态见 `docs/superpowers/status/2026-06-05-optimization-status.md`。

## 第一阶段：环境与基础数据 [x]
- [x] 初始化 OpenSpec 规范文档
- [x] 初始化 Next.js 项目脚手架（Next 16 + React 19 + TS 6）
- [x] 注册高德地图 Key（Web JS API 2.0）
- [x] 数据预处理脚本 `scripts/preprocess.js`，将源数据(~6000 条)转为精炼七元组格式

## 第二阶段：数据引擎与算法 [x]
- [x] 前端离线存储（实为 `localStore`/localStorage，非 Dexie.js）—— 用于历史路线
- [x] 集成 `RBush` 空间搜索（`src/lib/spatial.ts`）
- [x] 动态规避点提取算法（`scanPathRisks` + 多轮探测）
- [x] 高德 `avoidpolygons` 动态参数注入
- [x] 沿路聚类合并多边形，规避 API 上限（`buildRiskPolygons`）

## 第三阶段：前端渲染与 UI [x]
- [x] 海量点渲染（`AMap.MassMarks`，已从 LabelsLayer 升级）
- [x] 导航面板：输入终点、规划安全路线、起终点互换
- [x] 多端布局分发（桌面 / 移动竖屏 / 移动横屏）
- [x] 历史记录、保存、分享路线、Toast 反馈
- [x] 设置面板 `SettingsDrawer`：避让范围 / 六环筛选 / 失效点开关
- [x] 一键导航：deep link 唤起高德 App + 微信环境引导
- [~] 「证件状态」配置 —— 原设想(无证/六环内证/有证)未实现，由「六环筛选」部分替代
- [ ] **明暗主题切换**(浅色/深色/跟随系统)：当前 UI 写死深色、地图固定浅色底图；需引入主题状态 + 全量 `dark:` 配色 + 地图样式联动 + 设置入口（详见 status 文档）

## 第四阶段：自动化与优化 [/]
- [x] 数据更新脚本（`update-data` 抓 jinjing 页面）
- [x] 移动端触控/卡顿优化（MassMarks）
- [x] 双数据源架构（`update-data-v2` 调新 API，preprocess 自动识别格式）
- [ ] **新 API 源接入收尾**：填接口地址 + 校准 `CameraType` 枚举映射（阻塞中，等接口信息）
- [ ] 语音播报逻辑（靠近监控点提醒）—— 提案中提及，尚未实现
- [ ] Webhook 自动推送更新数据 —— 尚未实现

## 遗留 / 待评审
- [ ] `feature/refactor` worktree 两处未提交改动（分享链接去重保留 URL 参数、微信引导文案）待评审合并
- [ ] `aa='1'` 类型真实含义待确认
