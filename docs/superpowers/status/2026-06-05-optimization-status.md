# 项目状态总览：性能优化轮次 + 遗留任务汇总

> 日期：2026-06-05
> 范围：本轮优化(已提交 `2c8b82b`)的完成项、待办项，以及 `feature/refactor` worktree 的遗留改动。

---

## 🔖 会话恢复速览（2026-06-05 收尾）

**Git 状态**：分支 `main`，工作区干净，本地领先 `origin/main` **3 个提交**（`f7c239a` 主题任务排期、`6969b17` 微信分享修复、`2f61a0d` 文档）→ **未推送，待用户手动 `git push`**。

**本会话做了什么**：性能(MassMarks)、避让聚类+三档尺寸、六环筛选修正(六环外=aa6/六环内=aa≠6)、失效点(aa4)可选避让+设置开关、双数据源架构、设置面板 SettingsDrawer、合并 worktree 的微信分享修复。

**下一步最该做的**：
1. 🔴 **新 API 源接入收尾** — 等用户给接口地址，然后填 `fetch-api.js` + 校准 `CameraType` 枚举（见 §二）
2. 🔵 **明暗主题切换** — 已出实施方案（`plans/2026-06-06-theme-toggle-plan.md`），待 gemini 3.5 实现（见 §二 末）
3. ✅ worktree `.worktrees/refactor-main` 已清理（含 `feature/refactor` 分支）

**关键文件**：`useAMap.ts`(渲染/六环显示)、`avoidance.ts`(聚类/扫描/尺寸)、`useRoutePlanner.ts`(规划/deadRisks)、`SettingsDrawer.tsx`(设置)、`scripts/{fetch-jinjing,fetch-api,preprocess}.js`(数据)。

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

### 功能：明暗主题切换（✅ 已出实施方案，待实现）

**完整方案见**：[`docs/superpowers/plans/2026-06-06-theme-toggle-plan.md`](../plans/2026-06-06-theme-toggle-plan.md)
**实现方**：交由 gemini 3.5 按该方案落地（省 token），本会话仅出方案。

已确认的三项决策（方案据此设计）：
- 默认**跟随系统** `prefers-color-scheme`，可手动覆盖浅/深，localStorage 持久化
- **CSS 变量语义色板**（Tailwind **v4** `@theme inline` + `.dark` 类，非逐组件 `dark:` 变体）
- **仅中性色适配**：风险/状态色（红绿黄蓝）两主题不变；深色 token 值 = 现状硬编码值，零回归

方案要点（细节在 plan 文件）：
- [ ] `globals.css` 加 `:root`/`.dark` 中性色变量 + `@theme inline` 暴露 `bg-surface`/`text-fg`/`border-border` 等
- [ ] 新增 `src/lib/theme.ts` + `src/hooks/useTheme.ts`；`layout.tsx` 加防闪烁(FOUC)内联脚本
- [ ] `useAMap.ts` 接 `isDark` 参数，`setMapStyle` 切 `amap://styles/dark`
- [ ] `SettingsDrawer.tsx` 加「外观主题」3 按钮入口（Sun/Moon/Monitor）
- [ ] 12 个组件文件机械替换 ~206 处中性类→token（最大头 ControlPanel 97 处）
- [ ] 注意：v4 下 `tailwind.config.js` 的 `darkMode` 失效，走 CSS-first；删除 MapContainer `<style jsx>` 里覆盖 globals 的重复硬编码深色规则

---

## 三、`feature/refactor` worktree 遗留改动（✅ 已合并入 main `6969b17`）

> 原位于 `.worktrees/refactor-main`（分支 `feature/refactor`）的 2 处未提交改动，已于 2026-06-05 cherry-pick 合并到 main。

| 文件 | 改动内容 | 状态 |
|------|----------|------|
| `src/hooks/useShareLink.ts` | **分享链接不再清除 URL 参数**：改用 `sessionStorage` 按 token 去重，避免刷新重复加载。原因——微信"在浏览器中打开"会复制当前 URL，清掉参数会丢失路线 | ✅ 已合并 |
| `src/components/shared/WechatGuide.tsx` | 微信引导文案优化："然后再点击导航按钮" → "路线会自动带过去，再点导航即可" | ✅ 已合并 |

**后续：**
- [x] worktree `.worktrees/refactor-main` 已清理（`feature/refactor` 分支已 `git branch -D`，主体早已合入 main）

---

## 四、历史遗留（与本轮无关，但 `openspec/tasks.md` 长期过时）

`openspec/specs/tasks.md` 仍写着早期设想（11w 数据 / Dexie.js / LabelsLayer / 证件状态侧滑菜单），**与实际实现已严重脱节**：
- 数据量实为 ~6000，非 11w
- 存储用 `localStore`（localStorage），非 Dexie.js
- 渲染已从 LabelsLayer → MassMarks
- "证件状态(无证/六环内证/有证)"侧滑菜单从未实现，被「六环筛选」部分替代

→ 已在本轮同步更新 `tasks.md`（见该文件）。
