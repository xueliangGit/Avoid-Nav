# 明暗主题切换实现计划

## Context

当前 UI 写死深色:组件硬编码 `bg-slate-*` / `text-white` / `border-white/N`(约 **206 处**,集中在 `ControlPanel.tsx` 97 处、`SettingsDrawer.tsx` 32 处),地图底图固定浅色 `amap://styles/normal`(深色面板 + 浅色地图混搭),无 theme context、无持久化。

本次按已确认的三项决策实现主题切换:
- **默认跟随系统**(`prefers-color-scheme`),用户可手动覆盖为浅色/深色,选择持久化到 localStorage。
- **CSS 变量语义色板**(Tailwind v4 CSS-first,非逐组件 `dark:` 变体)。
- **仅中性色适配**:风险/状态色(红=命中、绿=已避让、黄=途经/强制、蓝=主按钮)两主题下保持不变;只有中性的背景/文字/边框随主题翻转。

关键约束:**深色 token 值必须与改造前的硬编码 slate 完全一致**,保证深色观感零回归。

技术栈确认:Tailwind **v4**(`@import "tailwindcss"` + `@tailwindcss/postcss@4.2`)。`tailwind.config.js` 的 `darkMode`/`theme` 键在 v4 基本失效,改用 CSS 内 `@theme inline` + `.dark` 类驱动。

---

## 一、语义 token 与映射表

在 `.dark` 类挂到 `<html>` 时切深色。**深色值 = 当前硬编码值**;浅色值为新增。

| 用途 | token(生成的类) | 深色值(=现状) | 浅色值 |
|------|------------------|----------------|--------|
| 面板主底 | `surface` | `#020617` slate-950 | `#ffffff` |
| 卡片/输入底 | `surface-2` | `#0f172a` slate-900 | `#f1f5f9` slate-100 |
| 抬升块 | `surface-3` | `#1e293b` slate-800 | `#e2e8f0` slate-200 |
| 徽章底(已关闭) | `surface-4` | `#334155` slate-700 | `#cbd5e1` slate-300 |
| 主文字 | `fg` | `#ffffff` | `#0f172a` slate-900 |
| 次文字 | `fg-2` | `#e2e8f0` slate-200 | `#1e293b` slate-800 |
| 弱化文字 | `fg-muted` | `#94a3b8` slate-400 | `#64748b` slate-500 |
| 更弱文字 | `fg-subtle` | `#64748b` slate-500 | `#94a3b8` slate-400 |
| 占位/最弱 | `fg-faint` | `#475569` slate-600 | `#cbd5e1` slate-300 |
| 悬浮叠加(弱) | `overlay-soft` | `rgba(255,255,255,.05)` | `rgba(15,23,42,.04)` |
| 悬浮叠加 | `overlay` | `rgba(255,255,255,.10)` | `rgba(15,23,42,.07)` |
| 叠加(强) | `overlay-strong` | `rgba(255,255,255,.15)` | `rgba(15,23,42,.10)` |
| 叠加(重·抓手) | `overlay-heavy` | `rgba(255,255,255,.30)` | `rgba(15,23,42,.20)` |
| 细边框 | `border-soft` | `rgba(255,255,255,.05)` | `rgba(15,23,42,.08)` |
| 边框 | `border` | `rgba(255,255,255,.10)` | `rgba(15,23,42,.12)` |

**类替换规则**(对全部 12 个组件文件机械执行):
- `bg-slate-950` → `bg-surface`;带透明度保留修饰符:`bg-slate-950/80` → `bg-surface/80`、`/95` 同理(v4 token 是真实颜色,opacity 修饰符可用)。
- `bg-slate-900` → `bg-surface-2`(`/80 /60 /40` 保留)。`bg-slate-800` → `bg-surface-3`;`bg-slate-700` → `bg-surface-4`。
- 叠加类**不再用 opacity 修饰符**(白底改黑底,alpha 不同),整体换成实心 token:`bg-white/5` → `bg-overlay-soft`、`bg-white/10`/`hover:bg-white/10` → `bg-overlay`(hover 版 `hover:bg-overlay`)、`bg-white/15` → `bg-overlay-strong`、`bg-white/30` → `bg-overlay-heavy`。
- `border-white/5` → `border-border-soft`;`border-white/10` → `border-border`。
- `text-white`/`hover:text-white` → `text-fg`/`hover:text-fg`;`text-slate-200`/`-300` → `text-fg-2`;`text-slate-400` → `text-fg-muted`;`text-slate-500` → `text-fg-subtle`;`text-slate-600`(含 `placeholder:`) → `text-fg-faint`。
- **不动**:`blue-* / emerald-* / red-* / rose-* / amber-* / teal-* / indigo-*`、`bg-black/40` 遮罩、渐变。

---

## 二、`src/app/globals.css` 改动

在 `@import "tailwindcss";` 之后加入(完整块):

```css
@custom-variant dark (&:where(.dark, .dark *));

:root {
  --surface:#fff; --surface-2:#f1f5f9; --surface-3:#e2e8f0; --surface-4:#cbd5e1;
  --fg:#0f172a; --fg-2:#1e293b; --fg-muted:#64748b; --fg-subtle:#94a3b8; --fg-faint:#cbd5e1;
  --overlay-soft:rgba(15,23,42,.04); --overlay:rgba(15,23,42,.07);
  --overlay-strong:rgba(15,23,42,.10); --overlay-heavy:rgba(15,23,42,.20);
  --border-soft:rgba(15,23,42,.08); --border:rgba(15,23,42,.12);
  --sug-bg:#fff; --sug-fg:#0f172a; --sug-hover-bg:#f1f5f9; --sug-hover-fg:#2563eb;
  --scrollbar:rgba(15,23,42,.18);
}
.dark {
  --surface:#020617; --surface-2:#0f172a; --surface-3:#1e293b; --surface-4:#334155;
  --fg:#fff; --fg-2:#e2e8f0; --fg-muted:#94a3b8; --fg-subtle:#64748b; --fg-faint:#475569;
  --overlay-soft:rgba(255,255,255,.05); --overlay:rgba(255,255,255,.10);
  --overlay-strong:rgba(255,255,255,.15); --overlay-heavy:rgba(255,255,255,.30);
  --border-soft:rgba(255,255,255,.05); --border:rgba(255,255,255,.10);
  --sug-bg:#0f172a; --sug-fg:#f1f5f9; --sug-hover-bg:#1e293b; --sug-hover-fg:#4f46e5;
  --scrollbar:rgba(255,255,255,.15);
}

@theme inline {
  --color-surface:var(--surface); --color-surface-2:var(--surface-2);
  --color-surface-3:var(--surface-3); --color-surface-4:var(--surface-4);
  --color-fg:var(--fg); --color-fg-2:var(--fg-2); --color-fg-muted:var(--fg-muted);
  --color-fg-subtle:var(--fg-subtle); --color-fg-faint:var(--fg-faint);
  --color-overlay-soft:var(--overlay-soft); --color-overlay:var(--overlay);
  --color-overlay-strong:var(--overlay-strong); --color-overlay-heavy:var(--overlay-heavy);
  --color-border-soft:var(--border-soft); --color-border:var(--border);
}
```

- `html, body` 增加 `background:var(--surface-2); color:var(--fg);` 作为兜底底色。
- 现有 `.amap-sug-result` / `.auto-item` / `.custom-scrollbar` 的硬编码颜色改用变量:`background:var(--sug-bg)`、`color:var(--sug-fg)`、hover 用 `--sug-hover-bg/--sug-hover-fg`、scrollbar thumb 用 `var(--scrollbar)`。

---

## 三、主题状态 + 防闪烁(FOUC)

**新增 `src/lib/theme.ts`**:`type Theme='light'|'dark'|'system'`;`getStoredTheme()`(localStorage key `avoid-nav:theme:v1`,非法值回退 `system`)、`setStoredTheme`、`systemPrefersDark()`、`resolveIsDark(t)`、`applyTheme(t)`(`document.documentElement.classList.toggle('dark', resolveIsDark(t))`)。

**新增 `src/hooks/useTheme.ts`**(`'use client'`):
- `useState<Theme>('system')` + `useState(isDark)`;挂载后 `getStoredTheme()` 同步并 `applyTheme`。
- 监听 `matchMedia('(prefers-color-scheme: dark)')` 的 `change`,仅当当前为 `system` 时重新 apply。
- `setTheme(t)`:写存储 + 更新 state + applyTheme。
- 返回 `{ theme, isDark, setTheme }`。

**`src/app/layout.tsx`**:`<html lang="zh-CN" suppressHydrationWarning>`,加 `<head>`,内放阻塞内联脚本(首屏 paint 前定类,避免闪白):

```tsx
<script dangerouslySetInnerHTML={{ __html:
  `(function(){try{var t=localStorage.getItem('avoid-nav:theme:v1')||'system';`
  + `var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);`
  + `if(d)document.documentElement.classList.add('dark')}catch(e){}})()` }} />
```

---

## 四、设置面板入口

**`src/components/shared/SettingsDrawer.tsx`**:Props 增 `theme: Theme` + `onChangeTheme: (t: Theme)=>void`;新增「外观主题」`<section>`,3 个按钮(浅色/深色/跟随系统,lucide `Sun`/`Moon`/`Monitor`),复用现有 button-group 样式(active = `bg-blue-600/20 border-blue-500/60 text-fg`)。该文件 32 处中性类一并按映射表替换。

---

## 五、地图底图联动

**`src/hooks/useAMap.ts`**:签名加第三参 `isDark: boolean`;
- 初始化 `mapStyle: isDark ? 'amap://styles/dark' : 'amap://styles/normal'`(用挂载时首值)。
- 新增 `useEffect([isDark])`:`(mapInstanceRef.current as any)?.setMapStyle?.(isDark ? 'amap://styles/dark' : 'amap://styles/normal')`(`setMapStyle` 无类型声明,需 any-cast;AMap 2.0 运行时支持)。

**`src/components/Map/MapContainer.tsx`**:
- `const { theme, isDark, setTheme } = useTheme();`
- `useAMap(MAP_CONTAINER_ID, ringFilter, isDark)`。
- `<SettingsDrawer ... theme={theme} onChangeTheme={setTheme} />`。
- **删除** `<style jsx global>` 里与 globals.css 重复的 `.amap-sug-result`/`.auto-item`/`.custom-scrollbar` 规则(它们带更高优先级的硬编码深色,会覆盖 globals 的变量版),让 globals.css 变量版生效。
- 自身 4 处中性类按映射表替换(如根 `bg-slate-900` → `bg-surface-2`)。

---

## 六、逐文件改动清单

**逻辑改动**:`src/lib/theme.ts`(新)、`src/hooks/useTheme.ts`(新)、`src/app/layout.tsx`、`src/app/globals.css`、`src/hooks/useAMap.ts`、`src/components/Map/MapContainer.tsx`、`src/components/shared/SettingsDrawer.tsx`。

**纯机械中性类→token 替换**(按 §一 规则,无逻辑变动):`Map/ControlPanel.tsx`(97)、`History/HistoryListItem.tsx`(19)、`History/SaveRouteDialog.tsx`(18)、`Map/DebugPanel.tsx`(9)、`History/HistoryDrawer.tsx`(8)、`shared/WechatGuide.tsx`(5)、`layouts/MobileLandscapeLayout.tsx`(5)、`shared/Toast.tsx`(3)、`shared/BottomSheet.tsx`(3)、`layouts/MobileLayout.tsx`(3)。`SettingsDrawer.tsx`/`MapContainer.tsx` 的中性类随其逻辑改动一并替换。

`tailwind.config.js` 无需改(v4 自动探测内容)。

---

## 七、验证

1. `npx tsc --noEmit` 零报错。
2. 起 dev(需先 `fnm use` 切 Node 版本,见记忆 node-dev-env)`npm run dev`。
3. 手动核对:
   - 刷新无闪白(FOUC)——深色/浅色首屏即正确。
   - 设置面板切 浅色/深色/跟随系统;切「跟随系统」后改系统外观,UI 实时跟随。
   - 地图底图随主题切换(深色用 dark 样式)。
   - 浅色下:面板、输入框、历史卡片、AutoComplete 下拉、滚动条均可读;风险色(红/绿/黄)仍清晰。
   - 选择刷新后保持(localStorage)。
   - 深色观感与改造前一致(回归检查 ControlPanel 主面板)。
4. 真机(手机)复看浅色可读性 + 底图切换。
