---
quick_id: 260604-fzn
title: Fix UAT-1 apply_slide_layout invalid GeometricShapeType + orphan slide + guard
status: planned
date: 2026-06-04
base_commit: 420e01b
---

# Quick Task 260604-fzn — Fix UAT-1: apply_slide_layout 真机 ok=false

## Problem (UAT ① real-machine, Office for Web PowerPoint)

`apply_slide_layout` 套用 **KPI** 版式时返回 `ok=false`。AI 重试 3× 每次留下半成品孤儿页，最后熔断。

**Confirmed root cause (Team Lead):** `ppt-layouts.ts` 声明几何形状类型 `'RoundedRectangle'`，
但它 **不是合法的 Office.js `PowerPoint.GeometricShapeType`** 值（合法是 `'RoundRectangle'`，无 "ed"）。
真机 `addGeometricShape('RoundedRectangle', rect)` 抛 "invalid argument" → ok=false。
单测此前放绿是因为 mock 的 `addGeometricShape` 不校验枚举（mock-vs-real gap）。

只 KPI 失败：`'Rectangle'`/`'Ellipse'`（timeline 用）合法；纯 TextBox 版式不碰 addGeometricShape；
只有 KPI 的 `kpi_value` 圆角色块用到非法值。

## Scope (4 parts)

### Task 1 — Primary fix: 非法 GeometricShapeType 字符串（同一 bug 类）
- `src/agent/design/ppt-layouts.ts`:
  - ShapeSpec `shapeType` 类型联合 (~L31): `'RoundedRectangle'` → `'RoundRectangle'`
  - `kpi_value` 用法 (~L175): `'RoundedRectangle'` → `'RoundRectangle'`
  - 全文件扫描其余 shapeType：`'Rectangle'`(timeline_connector)、`'Ellipse'`(timeline_node) 均合法，保留。
- `src/agent/tools/write/ppt.ts` `add_shape` 工具 JSON-schema enum (~L379) — **同一 bug 类、AI 可达**：
  - `'RoundedRectangle'` → `'RoundRectangle'`
  - `'Arrow'` → `'RightArrow'`（裸 `'Arrow'` 不是合法 GeometricShapeType；合法为 RightArrow/LeftArrow/…）
- **Verify:** `npx tsc --noEmit` 通过；目标单测绿。
- **Done:** 6 版式 buildLayout 产出的 shapeType + add_shape enum 全部 ⊆ 合法 GeometricShapeType ∪ {TextBox 哨兵}。

### Task 2 — Secondary: applySlideLayout 孤儿页事务性清理
- `src/adapters/PptAdapter.ts` `applySlideLayout` (~L1884)：
  新页在 sync 2/3 已建好；若后续 fill/font/align/sync 抛错，半成品页会残留 + 重试堆积。
  Fix：sync 3 已捕获新页 `{index,id}` 双定位指纹；在 catch 路径用 **独立 PowerPoint.run**
  尽力删除该孤儿页（复用 deleteSlideByIndex 式双定位逻辑），再 re-throw 原 HostApiError。
  尽力清理——清理本身失败也不掩盖原错误，原 error info 保持完整。
- **Verify:** undo gate `operationLog.integration.test.ts` 仍绿（reverse 契约 {capturedIndex,capturedId} 不变）。
- **Done:** 失败时不再留孤儿页；成功路径返回值/reverse 不变。

### Task 3 — Structural guard (mock-vs-real gap，recurring-failure→add-gate)
- `src/agent/design/ppt-layouts.test.ts` 新增守门：硬编码合法 PowerPoint GeometricShapeType 集，
  断言 (a) ShapeSpec union 每个非 'TextBox' 值、(b) 6 版式 buildLayout 全部产出、
  (c) add_shape enum 每个非 'TextBox' 值，均 ∈ 合法集 → 非法 shapeType 字符串变测试失败，
  永不再静默真机 ok=false。
- `src/agent/operationLog.integration.test.ts` 强化 `addGeometricShape` mock：传入非法
  GeometricShapeType 字符串时 **throw**（镜像真机），mock 不再对坏 shapeType 放假绿。
- **Done:** 故意把 shapeType 改回 'RoundedRectangle' 会让新守门 + 强化 mock 同时变红。

### Task 4 — Honest comment update
- `PptAdapter.applySlideLayout` deferred-risk 注释 (~L1879-1882)：
  把 "几何形状待 v2.3 末真机复测" 更新为「UAT 已发现 + 已修（RoundRectangle 大小写）+ 孤儿页清理已加」，
  保留历史，不删。

## Constraints
- Node 22（已确认 v22.21.1）。Baseline 999 passed；目标 999 + 新增守门用例，0 failed（尾部 3 个 retry NetworkError = 已知噪音）。
- Bundle ≤82KB gzip：`npm run build` 然后 `npm run size`（改动 = 字符串 + 测试，预期 ~0 delta）。
- undo gate operationLog.integration.test 必须绿。
- 原子提交，**不 push**（Team Lead 控发布）。

## Out of scope / honesty
- 真机 ok=false 只能由 USER 在 Office for Web 重测 ① 确认。本任务交付 = 代码层根因已修 + 自动守门，
  **不声称真机已验证**。
