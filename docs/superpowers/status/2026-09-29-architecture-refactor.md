# 2026-09-29 架构解耦与工程规范重构落档

## 1. 架构解耦与文件拆分（Anti-Fat-File 治理）
彻底消除项目中超过 700 行的“巨石大文件”，所有组件和 Hook 均被严格拆分并限制在 **200~400 行以内**：

### 1.1 `ControlPanel.tsx` 拆分（761 行 → 231 行）
将原本混合在一个文件中的输入、途经点、避让区、动作栏、风险列表抽离为 5 个高内聚子组件，归放于 `src/components/Map/components/`：
- **`EndpointInputs.tsx` (120行)**：起终点输入框非受控同步、我的位置定位、起终点互换与清除。
- **`WaypointList.tsx` (67行)**：途经点列表渲染、序号徽标与删除。
- **`AvoidAreaList.tsx` (93行)**：手动避让区列表渲染、三档尺寸选择（小 30m / 中 60m / 大 100m）。
- **`RouteActionBar.tsx` (121行)**：路线规划主按钮、耗时距离概览、保存、高德导航与路线分享按钮。
- **`RiskDetailSection.tsx` (306行)**：四种风险分类折叠列表（仍命中、已绕开/取消、路过未避让、失效停拍点）、类型小图标与强化/恢复避让交互。
- **`ControlPanel.tsx` (231行)**：精简为容器布局组件，负责标题栏、状态徽标与上述子组件组装。

### 1.2 `MapContainer.tsx` 拆分（765 行 → 374 行）
将地图图层生命周期、事件绑定与交互逻辑解耦为领域 Hook：
- **`useAvoidState.ts` (74行)**：管理起点、终点、途经点、避让区、忽略/强制点位集合与状态变更动作。
- **`useMapInteractions.ts` (167行)**：负责高德 AutoComplete 自动补全挂载与地图点击事件（逆地理编码拾取途经点/避让区）。
- **`useMapRiskFocus.ts` (58行)**：点击风险点时的高德视口聚焦、黄色脉冲光圈绘制与定时清理（修复了 `??` 未使用表达式语法隐患）。
- **`useNavigationAction.ts` (63行)**：负责高德导航 App Deep Link 构建、微信内置浏览器防拦截与引导遮罩控制。
- **`useRouteSharing.ts` (120行)**：负责 Base64URL 路线方案编码、URL 参数构建与好友打开链接时的自动恢复规划。
- **`useRouteStorageActions.ts` (149行)**：负责历史记录抽屉、保存路线弹窗、收藏、重命名、删除及 LocalStorage 配额提示。
- **`usePlanAction.ts` (86行)**：负责地址输入框文本防丢校验、关键词兜底搜索与发起路线规划。

---

## 2. 工程规范与代码质量修复
1. **ESLint 基础设施完善**：
   - 修复 Next.js 16 移除 `next lint` 导致的执行报错问题，引入现代 ESLint 9 Flat Config 机制（`eslint.config.mjs`）。
   - 配置 `@next/eslint-plugin-next` 与 `typescript-eslint` 严格检查。
   - `package.json` 中的 `lint` 指令更新为 `eslint src`，执行结果 0 错误通过。
2. **死代码与无用变量清理**：
   - 清理 `BottomSheet.tsx`、`ChangelogModal.tsx`、`useTheme.ts` 和 `useRoutePlanner.ts` 中的未引用变量与无用导入。

---

## 3. 验证情况
- **代码规范检查**：`npm run lint` 验证通过（0 errors）。
- **构建测试**：`npm run build` 验证通过，Turbopack 编译及 TypeScript 静态检查全量通过。
- **单文件行数核验**：全工程单文件最大行数为 392 行，全部达标。
