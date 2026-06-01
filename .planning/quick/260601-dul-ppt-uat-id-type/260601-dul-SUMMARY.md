---
quick_id: 260601-dul
slug: ppt-uat-id-type
description: PPT 真机 UAT 两修复：选区带选中形状 id/type + 三工具写后回读假失败修复
date: 2026-06-01
status: complete
---

# Quick Task 260601-dul — SUMMARY

两修复分别原子 commit，已完成。**未 push、未 phase.complete**（TL 收尾统一做）。

## 修复 1：PPT 选区带出选中形状 id/type（commit `4381e01`）

- `PptSelectionContext`（DocumentAdapter.ts）新增可选字段 `selectedShapeId` / `selectedShapeIds` / `selectedShapeType`。
- `PptAdapter.getSelection()` 在 slide 信息基础上额外读 `ctx.presentation.getSelectedShapes()`（**API 已核实**：PowerPointApi 1.5，与既有 `getSelectedSlides()` 同接口同 API 集；`ShapeScopedCollection.items` 是 `Shape[]`，id/type 已在 codebase 多处使用）。
- typeof 守门 + try/catch 双层降级：旧 API 集无该方法 / 读形状失败 / 无选中形状 → 一律不带 shape 字段、不崩，agent 回退原 list 行为（fail-open，零回归）。
- `selection_detail` 工具复用 getSelection，经 `wrapReadResult` JSON.stringify 自然把新字段带给 agent。
- system-prompt PPT 领域指导第 7 条：有 `selectedShapeId` 优先用它定位，别 list 全部猜（保留 list_shapes_on_slide / set_shape_text 关键词，system-prompt 断言不破）。
- 测试（PptAdapter.read.test.ts 新增 4 条）：选 1/多形状带出 id/type；只选 slide 不带；旧 API 集降级不崩。

## 修复 2：写后回读「假失败」修复（commit `a8bad44`）

- 根因核实：alignment/background/rotation 三工具写后回读用 `after === target`，网页版回读 `horizontalAlignment`/`fill.type` 不可靠（写成功却回读 null/读不到）→ 误判 effective:false → 假失败。**非大小写问题，是回读不可靠**（枚举规范值确为大写）。
- 新判定（PptAdapter.ts 加 `eqCI` + `isWriteEffectiveStr` + `isRotationEffective`）：仅当「回读非空 && 回读==写前旧值 && 旧值≠目标」三者同时成立才判 no-op→false；回读 null/读不到、回读==目标、回读≠旧值一律 true。
  - 对齐：before/after = 写前/写后 `horizontalAlignment`，大小写不敏感。
  - 背景：before/after = 写前/写后 `fill.type`，target='Solid'（type 读不到也算成功）。
  - 旋转：数值版容差 0.5，复用 `rotationsClose`（含 360 环绕）；回读/写前任一 null 判生效。
- 测试（PptAdapter.test.ts 新增 3 条，三工具各一）：写成功+回读 null → effective:true（核心新增，修假失败）。既有「真 no-op→false」「回读==target→true」全部保留 GREEN。

## 收尾验证

- `npm test`：**59 文件 / 771 tests passed，0 failed**。尾部 3 个 errors = `retry.test.ts` NetworkError 未处理 rejection 噪音（已知非真失败）。
- `npm run typecheck`：干净（0 error）。
- `npm run build`：成功。main `gzip 75.13 KB`；PptAdapter 懒加载 `gzip 5.78 KB`（不在主路径）。
- `npm run size`（build 后 fresh dist）：**75.01 KB gzipped ≤ 82 KB** ✓。

## 诚实交代 / 待办

- 三工具假失败修复、选区 id/type 均为 **adapter 级 mock 单测**验证；**仍需真机 UAT 复测**：① 选中形状说「这个形状」时 agent 是否用 selectedShapeId 直接定位（不再把旋转猜成图片）；② 对齐/背景/旋转真机生效时不再报假失败，且真 no-op 仍诚实退。
- 未 push（线上无更新）、未 phase.complete。TL 统一收尾。
