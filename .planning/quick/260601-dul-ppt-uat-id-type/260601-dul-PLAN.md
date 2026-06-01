---
quick_id: 260601-dul
slug: ppt-uat-id-type
description: PPT 真机 UAT 两修复：选区带选中形状 id/type + 三工具写后回读假失败修复
date: 2026-06-01
status: in-progress
---

# Quick Task 260601-dul — PPT 真机 UAT 两修复

真机 UAT 又发现两件事（TL 已拍板修）。两修复分别原子 commit，不 push、不 phase.complete（TL 收尾统一做）。

## 修复 1：PPT 选区拿不到「选中的形状」（高价值）

**现状**：`PptAdapter.getSelection()`（line ~85）只调 `getSelectedSlides()`，只返回 `{kind:'ppt', slideIndex, slideCount}`，从不返回用户选中的是哪个形状。注释里的「T-01-06 仅读 slide 序号」是 v2.0 旧隐私限制，已过时（项目隐私模型早已简化为 agent 默认读全文）。后果：用户选中形状说「这个形状」，agent 不知指哪个 → list 全部去猜（真机把旋转猜成图片）。

**API 核实**：`@types/office-js` 确认 `ctx.presentation.getSelectedShapes()`（PowerPointApi 1.5，与已在用的 `getSelectedSlides()` 同接口同 API 集）→ 返回 `ShapeScopedCollection`，`.items` 是 `Shape[]`，Shape 的 `id`/`type` 已在 codebase 多处使用。

**做法**：
- 扩展 `PptSelectionContext`（`src/adapters/DocumentAdapter.ts:17`）加可选字段 `selectedShapeId?`/`selectedShapeIds?`/`selectedShapeType?`。
- `getSelection()` 在原 slide 信息基础上，额外读选中形状（`getSelectedShapes().load('items/id,items/type')`），有则带 id/type，没选形状（items 空）则不带 → agent 回退原行为。
- `getSelectedShapes` 在旧 API 集可能不存在 → typeof 守门 + try/catch 优雅降级，绝不让整个 getSelection 崩（不回归现有 selection_detail 测试）。
- `selection_detail` 工具复用 `getSelection`（PptAdapter.read case），SelectionContext 经 `wrapReadResult` JSON.stringify 自然带给 agent。
- system prompt（`src/agent/system-prompt.ts` PPT 领域指导第 7 条）补一句：有选中形状时优先用 selectedShapeId 定位，别 list 全部猜。

**测试**：mock `getSelectedShapes` 返回 1 个形状 → getSelection 带出 selectedShapeId；mock 返回空 → 不带（不回归）。

## 修复 2：写后回读验证「假失败」（上轮过度修正）

**现状**：alignment/background/rotation 三工具写后回读用 `after === target` 判 effective。网页版回读属性不可靠（写成功了却回读 null/读不到）→ `after !== target` → 误判 effective:false → 报假失败。真机铁证：对齐实际生效了（文字真居中），工具却报「网页版不支持」。**不是大小写问题，是回读不可靠。**

**新判定（仅确凿 no-op 才判失败）**：
- 字符串版（对齐/背景）：`effective = !( after != null && eqCI(after, before) && !eqCI(before, target) )` —— 仅当回读非空、回读==写前旧值、旧值≠目标 三者同时成立才判 no-op→false；其余（回读 null/读不到、回读==目标、回读≠旧值）一律 true。
  - 对齐：before/after = 写前/写后 `horizontalAlignment`，target=归一化枚举值，大小写不敏感。
  - 背景：before/after = 写前/写后 `fill.type`，target='Solid'（type 读回不到也算成功）。
- 数值版（旋转，容差 0.5，含 360 环绕复用 `rotationsClose`）：`effective = !( after!=null && before!=null && close(after,before) && !close(before,target) )`。

**测试（锁双向）**：① 写成功+回读==target → effective:true；② 写成功+回读 null/读不到 → effective:true（核心新增，修假失败）；③ 真 no-op：回读==旧值≠target → effective:false（保留诚实退）。三工具都覆盖。

## 收尾

- 修复 1 一个原子 commit，修复 2 一个原子 commit。
- `npm test`（0 failed；尾部恰 3 个 retry.test.ts errors 是噪音）+ `npm run build` +（build 后）`npm run size`（≤82KB gzip）。
- 大概率没动带 `<Trans>` 的 UI 文案 → 无需 `npm run extract`（system-prompt.ts 是纯字符串非 Lingui 宏）。
- 绝不 push、绝不 phase.complete。
