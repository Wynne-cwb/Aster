---
title: WR-03 — SlidePreviewPanel 卸载无条件重置全局 getter（缺 identity 守卫）
captured: 2026-06-08
source: phase-24-review（v2.4 close 时从 STATE Deferred 提升为活跃 todo）
priority: low
size: quick-task
resolves_phase: TBD
resolves_req: WR-03
---

## 触发
v2.3 Phase 24 code review（`.planning/phases/24-a-p2-bundle/24-REVIEW.md` §WR-03）。当前无虚拟滚动、不触发，但存在竞态隐患。

## 问题（精确落点）
`src/agent/tools/read/visual-check.ts`（`registerPreviewElement` line 18 + `SlidePreviewPanel` 的 `useLayoutEffect` cleanup）：
- cleanup 在**每次卸载**都调 `registerPreviewElement(() => null)`，**不判断本实例是否仍是当前注册的那个 getter**。
- 若两次 `apply_slide_layout` → 两个 `SlidePreviewPanel` 顺序挂载，各自覆盖全局 getter；当**较老的面板 A 晚于较新面板 B 卸载**（hot reload / React Strict Mode 双调用 / 未来虚拟滚动），A 的 cleanup 会无条件把 getter 重置为 `null`，**打断仍挂载的 B 的注册**。

## 修复方案
identity 守卫：mount 时捕获本实例的 `getter` 引用，cleanup 时**仅当 `_previewElementGetter === getter` 才重置**（即「只有我还是当前注册者才清」）。
```ts
const getter = () => containerElRef.current;
registerPreviewElement(getter);
return () => {
  // 只在自己仍是注册者时才清，避免老面板卸载误清新面板
  if (currentGetter() === getter) registerPreviewElement(() => null);
};
```
（需给 visual-check.ts 暴露一个读当前 getter 的 helper，或改 register/unregister 配对 API）

## 关联
- 与 [[wr-02-visual-check-slideindex]] 同源（Phase 24 review，同 `visual-check.ts` 文件），可合并一个 quick task 一起修
- 当前无虚拟滚动 + 正常单面板流不触发；不阻塞。属于「为未来多面板/虚拟滚动场景预先收口」的健壮性修复
