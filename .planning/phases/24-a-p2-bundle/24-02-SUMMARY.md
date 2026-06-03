---
phase: 24-a-p2-bundle
plan: "02"
subsystem: agent/design, agent/tools
tags: [slide-preview, coordinate-mapping, pure-function, visual-check-config, PVQ-06, NFR-11, wave2]
dependency_graph:
  requires: [24-01 (slide-preview stub, test skeletons), Phase 22 (ppt-tokens DEFAULT_CANVAS_PT), Phase 23 (ppt-layouts ShapeSpec)]
  provides: [mapShapesToRender pure fn (960-base), PVQ06_VISUAL_CHECK_ENABLED flag, slide-preview 4 GREEN tests]
  affects: [24-03 (visual-check tool impl, imports PVQ06_VISUAL_CHECK_ENABLED), SlidePreviewPanel (consumes SlideRenderShape)]
tech_stack:
  added: []
  patterns: [pure-function coordinate mapper, compile-time feature flag, scale=containerWidthPx/960]
key_files:
  created:
    - src/agent/tools/visual-check-config.ts
  modified:
    - src/agent/design/slide-preview.ts
    - src/agent/design/slide-preview.test.ts
decisions:
  - "scale = containerWidthPx / DEFAULT_CANVAS_PT.widthPt (960) — no 720 hardcode anywhere"
  - "Font size floor at 9px post-scale (unreadable below ~9px in preview panel)"
  - "Slide content colors physically isolated from panel CSS vars: fallback is #222222, not --text"
  - "PVQ06_VISUAL_CHECK_ENABLED defaults true (rollout active) — flip to false for geometry-check fallback"
  - "No React import in slide-preview.ts — pure data mapper, zero side effects"
metrics:
  duration: "~15 min"
  completed: "2026-06-03"
  tasks: 2
  files_changed: 3
---

# Phase 24 Plan 02: Coordinate Mapper Implementation + Degradation Flag Summary

mapShapesToRender 纯函数（scale = containerWidthPx / 960）填真身 + slide-preview 4 用例解除 skip 转 GREEN + PVQ06_VISUAL_CHECK_ENABLED 降级路径 flag。

## What Was Built

### Task 1: slide-preview.ts stub → 真身 + 解除测试 skip

**`src/agent/design/slide-preview.ts`**（stub 替换为真实实现）

核心逻辑：
```typescript
const scale = containerWidthPx / DEFAULT_CANVAS_PT.widthPt; // = containerWidthPx / 960
```

- 坐标映射：`left/top/width/height` = `s.rect.* × scale`，精度保留 2 位（`Math.round(n * 100) / 100`）
- 字号下限：`Math.max((s.font?.size ?? 14) * scale, 9)` — scale 后过小时兜底 9px
- borderRadius 分支：RoundedRectangle → `${Math.max(Math.round(4 * scale), 2)}px`，Ellipse → `'50%'`，其余 → `undefined`
- 颜色：slide content 颜色来自 ShapeSpec（`s.font?.color ?? '#222222'`，`s.fillColor ?? 'transparent'`），物理隔离于面板 teal CSS 变量
- 零 React import，零副作用，可单测

**`src/agent/design/slide-preview.test.ts`**（describe.skip → describe，4 用例 GREEN）

| 用例 | 输入 | 断言 | 结果 |
|------|------|------|------|
| ① happy path scale=0.5 | rect{left:48,top:36,width:864,height:468}, containerWidth=480 | left=24, top=18, width=432, height=234 | GREEN |
| ② 960 基准回归（anti-720） | 同 shape, containerWidth=960 (scale=1.0) | left=48, width=864 | GREEN |
| ③ 字号下限 | font.size=4, scale=0.5 → 4×0.5=2 < 9 | fontSize=9 | GREEN |
| ④ borderRadius 分支 | RoundedRectangle/Ellipse/Rectangle | /px$/ / '50%' / undefined | GREEN |

### Task 2: visual-check-config.ts — 降级路径 flag

**`src/agent/tools/visual-check-config.ts`**（新建，22 行）

```typescript
export const PVQ06_VISUAL_CHECK_ENABLED = true;
```

- 默认 `true`（铺开路径，工具 advisory 可用）
- 完整降级操作说明：改 `false` → 工具不注册 → Phase 22 几何自查兜底（check_slide_layout）
- 3 个 UAT 可调项注释：(a) 保真度门槛 = 人眼粗粒度，(b) 触发 = on-demand，(c) 渲染 = visible
- 不从外部输入读取，编译期常量，git 追踪变更

## Test Results

- Node 版本：v22.22.1
- `tsc --noEmit`：0 errors
- `vitest run`：993 passed（989 原有 + 4 新激活），0 failed
- `slide-preview` 专项：4 passed，0 failed，0 skipped

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — `mapShapesToRender` 已从 stub 替换为完整实现，4 用例全绿。`PVQ06_VISUAL_CHECK_ENABLED` 是编译期常量，非 stub。

## Threat Surface Scan

无新增网络端点、auth 路径或 schema 变更。`mapShapesToRender` 输出仅为本地 style 描述对象，不外发（T-24-04: accept）。`PVQ06_VISUAL_CHECK_ENABLED` 为编译期常量，无外部篡改面（T-24-05: accept）。

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/agent/design/slide-preview.ts | FOUND |
| src/agent/design/slide-preview.test.ts | FOUND |
| src/agent/tools/visual-check-config.ts | FOUND |
| commit c1f7d94 (mapShapesToRender impl + unskip) | FOUND |
| commit 93edab7 (visual-check-config.ts) | FOUND |
| describe.skip in test file (code) | NONE (confirmed — only comment) |
| DEFAULT_CANVAS_PT.widthPt usage | FOUND (line 46) |
| 720 hardcode in slide-preview.ts | NONE (confirmed) |
| React import in slide-preview.ts | NONE (confirmed) |
| not-implemented stub text | NONE (confirmed) |
| tsc --noEmit errors | 0 |
| vitest passed | 993 |
| package.json modified | NONE (confirmed unchanged) |
