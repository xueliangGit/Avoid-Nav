# 项目状态总览：性能优化轮次 + 遗留任务汇总

> 日期：2026-06-05
> 范围：本轮优化(已提交 `2c8b82b`)的完成项、待办项，以及 `feature/refactor` worktree 的遗留改动。

---

## 一、本轮已完成（已提交 `2c8b82b`，已推送）

| 模块 | 改动 | 关键文件 |
|------|------|----------|
| **性能** | 海量点(6030)从逐点 `LabelMarker` 改为单画布 `AMap.MassMarks` + layer 级 click，解决移动端平移/缩放卡顿 | `src/hooks/useAMap.ts` |
| **避让·聚类** | 沿路相邻(<150m)且同向的风险点合并为一个包围盒多边形；单簇跨度≤300m；孤立点保留单点矩形。降低高德 `avoidpolygons` 数量、规避 API 报错 | `src/lib/avoidance.ts`（`buildRiskPolygons`） |
| **避让·轮次** | 探测轮次 `MAX_ROUNDS` 5→8 | `src/hooks/useRoutePlanner.ts` |
| **避让·尺寸** | 自动风险点矩形三档 small/medium/large = 20/30/45m（半边长） | `src/lib/avoidance.ts`（`RISK_SIZE_HALF_M`） |
| **六环筛选** | 六环外 = `aa='6'`、六环内 = `aa≠'6'`。显示(useAMap) + 避让(avoidance) + 设置(SettingsDrawer) 三处联动 | `useAMap.ts` / `avoidance.ts` / `SettingsDrawer.tsx` |
| **失效点(aa=4)** | 默认不避让；路线命中时在面板「失效点·已停拍」列出，可逐个手动避让（复用 `forcedRiskIds`）。设置加「失效点也自动避让」开关 | `avoidance.ts`(`ScanOptions`) / `useRoutePlanner.ts`(`deadRisks`) / `ControlPanel.tsx` / `SettingsDrawer.tsx` |
| **双数据源** | `npm run update-data`(jinjing 页面) / `update-data-v2`(新 API)。`preprocess.js` 按字段自动识别新旧格式 | `scripts/fetch-jinjing.js` / `scripts/fetch-api.js` / `scripts/preprocess.js` |
| **数据映射** | `AA_MAP` 按官方 about 页面修正含义 | `scripts/preprocess.js` |
| **设置面板** | 新增 `SettingsDrawer`（避让范围 / 六环筛选 / 失效点开关），主面板更简洁。齿轮入口在 ControlPanel 标题栏 | `src/components/shared/SettingsDrawer.tsx` |
| **修复** | InfoWindow 层级被海量点画布遮挡（zIndex 2000 + isCustom:false）；失效点开关状态改用「已开启/已关闭」徽章（原滑块不显示） | `useAMap.ts` / `SettingsDrawer.tsx` |
| **清理** | 删除无引用的孤儿文件 `scripts/preprocess.ts` | — |

**验证**：`tsc --noEmit` 零报错；`update-data` / `update-data-v2` 端到端跑通(6030 条)；离线脚本复测真实路线，失效点正确检出、方向判定正确。

---

## 二、本轮待办（未完成）

### 新数据源接入（阻塞中，等接口信息）
- [ ] **填写 `fetch-api.js` 的接口地址**（`DEFAULT_API_URL` 或环境变量 `DATA_API_URL`）
- [ ] **校准 `CameraType` 枚举映射**：当前 `preprocess.js` 的 `newSourceToAa()` 用正则猜测（"进京证/高峰/失效"），需用真实接口数据核对
- [ ] **确认 `IsSixRing` 取值**：当前假设 `'1'`=六环外，待真实数据验证
- [ ] 抓一份真实数据回来统计 `CameraType` 全部取值，定稿映射规则

### 运行时验证（需真机/浏览器，无法在 CI 验证）
- [ ] MassMarks 渲染流畅度真机确认
- [ ] 聚类阈值(150m/300m)实际效果是否会误封长路 / 漏避密集段
- [ ] 三档尺寸(20/30/45)实际避让覆盖效果

### 待确认的语义
- [ ] `aa='1'`(304 条) 的真实含义仍未知（当前按"其他监控/risk2/避让"处理）

### 功能：明暗主题切换（已排期，未开始）
当前 UI 是写死的深色（硬编码 `bg-slate-*` 等，无 `dark:` 类、无 theme context），地图底图固定为浅色 `amap://styles/normal`（深色面板 + 浅色地图混搭）。
- [ ] 引入主题状态（浅色/深色/跟随系统 `prefers-color-scheme`），存入设置 + localStorage 持久化
- [ ] 全量给组件加 `dark:` 变体（或改用 CSS 变量色板），统一配色
- [ ] 地图样式随主题联动（深色用 `amap://styles/dark`）
- [ ] 设置面板 `SettingsDrawer` 增加主题切换入口
- [ ] Tailwind 配置 `darkMode` 策略（class 或 media）

---

## 三、`feature/refactor` worktree 遗留改动（未提交）

> 位置：`.worktrees/refactor-main`，分支 `feature/refactor`（该分支主体已合入 main，但以下 2 处改动**未提交、未合并**）。

| 文件 | 改动内容 | 状态 |
|------|----------|------|
| `src/hooks/useShareLink.ts` | **分享链接不再清除 URL 参数**：改用 `sessionStorage` 按 token 去重，避免刷新重复加载。原因——微信"在浏览器中打开"会复制当前 URL，清掉参数会丢失路线 | 未提交，待评审/合并 |
| `src/components/shared/WechatGuide.tsx` | 微信引导文案优化："然后再点击导航按钮" → "路线会自动带过去，再点导航即可" | 未提交，待提交 |

**待办：**
- [ ] 评审这两处改动是否要并入主线
- [ ] 决定后：在 worktree 提交并合并，或 cherry-pick 到 main，然后清理 worktree

---

## 四、历史遗留（与本轮无关，但 `openspec/tasks.md` 长期过时）

`openspec/specs/tasks.md` 仍写着早期设想（11w 数据 / Dexie.js / LabelsLayer / 证件状态侧滑菜单），**与实际实现已严重脱节**：
- 数据量实为 ~6000，非 11w
- 存储用 `localStore`（localStorage），非 Dexie.js
- 渲染已从 LabelsLayer → MassMarks
- "证件状态(无证/六环内证/有证)"侧滑菜单从未实现，被「六环筛选」部分替代

→ 已在本轮同步更新 `tasks.md`（见该文件）。
