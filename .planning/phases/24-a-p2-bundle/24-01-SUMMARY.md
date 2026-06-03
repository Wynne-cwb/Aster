---
phase: 24-a-p2-bundle
plan: "01"
subsystem: agent/design, agent/tools/read
tags: [wave0, stub, html2canvas, slide-preview, visual-check, NFR-09, PVQ-06, bundle]
dependency_graph:
  requires: [Phase 22 (ppt-tokens, geometry-check), Phase 23 (ppt-layouts)]
  provides: [html2canvas dep installed, slide-preview stub, visual-check stub, Wave 0 test skeletons]
  affects: [24-02 (slide-preview impl), 24-03 (visual-check impl)]
tech_stack:
  added: [html2canvas@1.4.1 (exact), jsdom@25.0.1 (downgrade fix)]
  patterns: [Wave 0 describe.skip, not-implemented throw stub, vi.hoisted mock]
key_files:
  created:
    - src/agent/design/slide-preview.ts
    - src/agent/design/slide-preview.test.ts
    - src/agent/tools/read/visual-check.ts
    - src/agent/tools/read/visual-check.test.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - "html2canvas version locked as exact '1.4.1' (not ^1.4.1) per CONTEXT T-24-03 supply-chain gate"
  - "jsdom downgraded ^29.1.1 → ^25.0.1 (Rule 1 fix): jsdom@29 requires Node ^20.19.0 but env is Node 20.17.0, causing ERR_REQUIRE_ESM crash (zero tests collected). jsdom@25 supports Node >=18."
  - "visualCheckSlide.execute stub signature uses async execute(_args, _ctx) — matches ToolDef<TArgs> interface exactly"
  - "Wave 0 skeletons use describe.skip (not dynamic import) — matches project precedent (attachments.test.ts STATE L112)"
metrics:
  duration: "~25 min"
  completed: "2026-06-03"
  tasks: 3
  files_changed: 6
---

# Phase 24 Plan 01: Wave 0 Scaffolding — html2canvas + Stubs + Test Skeletons Summary

Wave 0 基础搭建：安装 html2canvas、建两个最小 stub 模块、建两个 describe.skip 测试骨架，为 24-02（渲染器实现）和 24-03（视觉自查工具实现）提供明确的 GREEN 目标。

## What Was Built

### Task 1: html2canvas@1.4.1 安装
- `package.json` dependencies 新增 `"html2canvas": "1.4.1"`（精确版本锁定，非 `^1.4.1`）
- 满足 CONTEXT.md 硬约束 #8（供应链安全，RESEARCH Q1 tarball grep eval=0 审查）
- `node_modules/html2canvas/dist/html2canvas.min.js` 已安装
- 整个 `src/` 树无任何静态 `import ... from 'html2canvas'` — 0 净初始 bundle 增量

### Task 2: 被测模块最小 stub

**`src/agent/design/slide-preview.ts`**
- 导出 `SlideRenderShape` 接口（完整字段含 position/left/top/width/height/backgroundColor/fontSize 等）
- 导出 `mapShapesToRender(shapes: ShapeSpec[], containerWidthPx: number): SlideRenderShape[]`
- 函数体：`throw new Error('mapShapesToRender not implemented (Wave 0 stub — 24-02 填真身)')`
- import: `type { ShapeSpec } from './ppt-layouts'` — 无循环依赖

**`src/agent/tools/read/visual-check.ts`**
- 导出 `visualCheckSlide: ToolDef<VisualCheckArgs>`（name='visual_check_slide', kind='read'）
- execute 函数体：`throw new Error('visualCheckSlide.execute not implemented (Wave 0 stub — 24-03 填真身)')`
- import: `type { ToolDef, ToolResult } from '../index'` — 正确 ToolDef 形状

### Task 3: Wave 0 测试骨架

**`src/agent/design/slide-preview.test.ts`**（4 describe.skip 用例）
- ① happy path：scale=0.5 时坐标减半（left 48→24，width 864→432）
- ② 960 基准回归（防 720 错误基准 — 关键反回归）
- ③ 字号下限：font.size*scale < 9 → 兜底 9px
- ④ ShapeType borderRadius 分支（RoundedRectangle/Ellipse/Rectangle）

**`src/agent/tools/read/visual-check.test.ts`**（5 describe.skip 用例）
- ① 元数据：name=visual_check_slide, kind=read
- ② html2canvas mock 被调用（截图链路验证）
- ③ **NFR-09 守门（核心）**：`expect(JSON.stringify(result.data)).not.toMatch(/[A-Za-z0-9+/]{100,}/)` + `not.toHaveProperty('base64')` + `not.toHaveProperty('screenshot')`
- ④ evidence 文字拼入 result.data.summary
- ⑤ previewEl 不存在时 advisory fallback（ok:true，含「跳过」）

## Test Results

Wave 0 后 tsc 和 vitest 全绿：
- `tsc --noEmit`: 0 errors
- `vitest run`: 978 passed, 0 failed (新增 9 skipped), 11 pre-existing Wave 0 red-light failures (FILE-02/03/04/05，与本计划无关)
- 新增两个测试 suite 均为 `passed` 状态（所有 9 用例 `skipped`）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] html2canvas 版本精确锁定（`^` 前缀修正）**
- **Found during:** Task 1
- **Issue:** `npm install html2canvas@1.4.1` 将版本写为 `"^1.4.1"`（带 caret），不满足 CONTEXT.md T-24-03 供应链安全「精确版本锁定」硬约束
- **Fix:** 手动编辑 `package.json` 改为 `"1.4.1"`（无 caret）
- **Files modified:** package.json
- **Commit:** eb7331c

**2. [Rule 1 - Bug] jsdom@29.1.1 与 Node 20.17.0 ESM 不兼容（测试环境崩溃）**
- **Found during:** Task 3 验证阶段
- **Issue:** `jsdom@29.1.1` requires Node `^20.19.0 || ^22.13.0 || >=24.0.0`，但开发/CI 环境是 Node 20.17.0。`@exodus/bytes@1.15.1`（ESM-only）被 `html-encoding-sniffer@6.0.0` 的 CJS require 调用，产生 `ERR_REQUIRE_ESM`，导致 vitest 无法收集任何测试文件（"0 tests collected"）。此问题在 html2canvas 安装之前就已存在（State 中声称的 "989 tests" 实际无法被验证）。
- **Fix:** `npm install jsdom@25.0.1 --save-dev`，降级到 `^25.0.1`（Node >=18，兼容 Node 20.17.0）
- **Files modified:** package.json, package-lock.json
- **Commit:** 2471174

## Unskip Guide for Subsequent Plans

- **24-02 解除 skip**：`src/agent/design/slide-preview.test.ts` 中 `describe.skip` → `describe`（1 处）。实现 `mapShapesToRender` 真身后所有 4 用例应变绿。
- **24-03 解除 skip**：`src/agent/tools/read/visual-check.test.ts` 中 `describe.skip` → `describe`（1 处）。需按真实 `registerPreviewElement` getter 注入机制调整 mock setup（见文件注释）。

## Threat Surface Scan

无新增网络端点、auth 路径或 schema 变更。html2canvas 仅以 dependency 身份安装，尚无代码路径触达（所有截图逻辑在后续 plan 实现）。T-24-03 供应链威胁通过精确版本锁定已缓解。

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/agent/design/slide-preview.ts | FOUND |
| src/agent/tools/read/visual-check.ts | FOUND |
| src/agent/design/slide-preview.test.ts | FOUND |
| src/agent/tools/read/visual-check.test.ts | FOUND |
| commit eb7331c (html2canvas install) | FOUND |
| commit ebc3f7b (stubs) | FOUND |
| commit 1ae1b1e (test skeletons) | FOUND |
| commit 2471174 (jsdom fix) | FOUND |
| html2canvas static import in src/ | NONE (confirmed) |
| tsc --noEmit errors | 0 |
| vitest new suites failed | 0 |
