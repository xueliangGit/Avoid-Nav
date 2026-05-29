# 高德导航 URI 修复（延后）

> 状态：**待处理**。问题已定位，方案分阶段确定，但需要手机 + 桌面双端测试才能落实。

---

## 问题

点"开始导航"跳转 `https://uri.amap.com/navigation?...` 后，**PC 高德网页版无法显示路线**（页面打开了但路线区空白）。

## 根因（已定位）

参考高德官方 URI API 文档：https://lbs.amap.com/api/uri-api/guide/travel/route

1. **`via` 途经点最多 1 个**——文档明确写："最多只支持添加一个途径点"。当前 `buildAmapNavUri` 传 14 个，被高德拒绝整个 via 参数。
2. **非官方参数被吃掉**——`policy / callnative / coordinate / src` 不在文档参数列表里，可能导致高德 web 解析失败或忽略主参数。
3. 仅 `from / to / via / mode` 是 navigation URI 的合法参数。

---

## 方案

### 第 1 步（5 分钟）：清理参数，PC 网页能显示

修改 `src/lib/navigation.ts`：

```typescript
export function buildAmapNavUri({ start, end, waypoints }: BuildNavUriInput): string {
  const fmt = (p: { lng: number; lat: number; name?: string }) => {
    const name = (p as any).name ? `,${(p as any).name}` : '';
    return `${p.lng.toFixed(6)},${p.lat.toFixed(6)}${name}`;
  };
  const params = new URLSearchParams();
  params.set('from', fmt(start));
  params.set('to', fmt(end));
  params.set('mode', 'car');

  // 文档明确：via 最多 1 个
  if (waypoints.length > 0) {
    params.set('via', fmt(waypoints[0]));
  }

  return `https://uri.amap.com/navigation?${params.toString()}`;
}
```

**代价**：1 个途经点不够锁定整条避让路径，高德 web 按它自己算法走，**不能完美复现避让方案**。但至少页面能显示了。

### 第 2 步（未来，30-60 分钟）：移动端用 App URI scheme（多途经点）

PC 网页就接受参考路径就行；移动端走专门的 URI scheme，多途经点可用：

- **Android**：`androidamap://route?sourceApplication=avoid-nav&slat=&slon=&sname=&dlat=&dlon=&dname=&dev=0&t=0`
  - 文档：https://lbs.amap.com/api/amap-mobile/guide/android/route
  - 但同样有"途径点最多 1 个"限制（待复测验证）
- **iOS**：`iosamap://path?...`，结构类似

如果 URI scheme 也只支持 1 途径点，**真正能完整复现避让方案的只有：**

(a) 我们自己页面提供 H5 内嵌的导航（用 AMap.Driving JS API + GPS 跟踪），**不离开浏览器**
(b) 让用户保存截图/路线方案到剪贴板，手动比对

### 第 3 步（再未来）：PC 显示二维码

PC 端用户点"开始导航" → 不直接跳 web，而是**弹一个二维码**，扫码进入移动端 URI scheme 在手机上打开高德 App 导航。

这样的设计也能给 PC 端用户一个清晰的"接下来怎么做"路径。

---

## 测试清单（实施时跑一遍）

- [ ] PC Chrome：点"开始导航"，跳到高德网页版**能看到路线**（从起点到终点的紫色线条）
- [ ] PC Chrome：传 1 个途经点时，途经点确实出现在路径上
- [ ] iPhone Safari：点"开始导航"，自动唤起高德 App 并开始导航
- [ ] iPhone 没装高德：fallback 到 web 也能显示
- [ ] Android Chrome：自动唤起高德 App
- [ ] Android 没装高德：fallback 到 web 也能显示
- [ ] 起点/终点名字含中文：URL encode 正常，高德端显示中文

---

## 关联代码

- `src/lib/navigation.ts` - 改这里
- `src/components/Map/MapContainer.tsx:393` - `handleStartNavigation` 调用方，可能需要调整 waypoints 选择策略（如果 via 只剩 1 个，要挑"路径中点"而不是 RDP 关键点列表的第一个）
- `src/lib/utils/path-keypoints.ts` - `extractKeyPoints` 不需要改，但只取首个相当于浪费

---

## 关联其它待办

- 第 3 步的二维码需要新增 `qrcode` 依赖或用 web 服务生成
- 如果走第 2 步 (a)：相当于做"App 内模拟导航"，是一个独立大功能（参考前面讨论的 "B App 内模拟导航" 方案）
