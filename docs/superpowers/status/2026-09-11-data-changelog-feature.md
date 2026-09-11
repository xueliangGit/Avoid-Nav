# 数据新鲜度标识与更新记录功能落档

## 1. 背景与目标
在数据源定时刷新（最新包含 6,189 处监控点位）后，前端用户界面需要具备直观的数据新鲜度标识与变更记录查看能力，以便确认当前避让点位的有效性及版本演进。

## 2. 架构设计与文件拆分
遵循单一职责与高内聚组件设计原则，避免在控制面板中堆砌大文件：

- **数据层契约**：[`src/lib/changelog.ts`](file:///Users/xuxueliang/work/xxl/myProject/src/lib/changelog.ts)
  - 导出 `getDataMeta()`：动态读取精炼数据集的 `updatedAt`、`points.length` 及数据源类型。
  - 维护 `CHANGELOG_LIST`：记录每次监控点位变更（新增、失效、转正）及主要功能版本历史。
- **徽标组件**：[`src/components/shared/UpdateBadge.tsx`](file:///Users/xuxueliang/work/xxl/myProject/src/components/shared/UpdateBadge.tsx)
  - 放置于标题栏旁边，展示呼吸光点与 `6,189 点位 · 09-11` 胶囊徽标，点击唤起弹窗。
- **更新弹窗**：[`src/components/shared/ChangelogModal.tsx`](file:///Users/xuxueliang/work/xxl/myProject/src/components/shared/ChangelogModal.tsx)
  - 包含当前运行数据集概览卡片（点位数、精确同步时间戳）与时间线形式的历史变更记录，支持 ESC / 遮罩点击退出。
- **页面集成**：
  - [`src/components/Map/ControlPanel.tsx`](file:///Users/xuxueliang/work/xxl/myProject/src/components/Map/ControlPanel.tsx)：接收 `onOpenChangelog` 并渲染 `UpdateBadge`。
  - [`src/components/Map/MapContainer.tsx`](file:///Users/xuxueliang/work/xxl/myProject/src/components/Map/MapContainer.tsx)：管理 `changelogOpen` 模态状态并挂载 `ChangelogModal`。

## 3. 移动端适配与样式修复
- **标题栏防挤压重构**：将 `UpdateBadge` 置于主标题正下方，主标题与右侧状态/操作按键各占水平端，杜绝窄屏下与状态按钮挤压重叠；`UpdateBadge` 内部增加 `whitespace-nowrap` 与 `shrink-0`。
- **按钮重叠根因修复**：将“规划主按钮”与“保存此路线”放入独立的 `space-y-2.5 shrink-0` 容器，明确各元素 block 盒模型与间距，消除 WebKit 对直接 flex 子项 button 的尺寸计算异常，并优化浅色主题下保存按钮的对比度。

## 4. 验证情况
- 运行 `npm run build`，Turbopack 编译及 TypeScript 静态检查全量通过。
