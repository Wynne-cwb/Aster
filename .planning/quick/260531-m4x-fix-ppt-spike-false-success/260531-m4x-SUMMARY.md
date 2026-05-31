---
quick_id: 260531-m4x
slug: fix-ppt-spike-false-success
description: 修复 3 个 PPT spike 工具网页版「假成功」（对齐/旋转/背景）
date: 2026-05-31
status: complete
commits:
  - 58152a9 fix(10-PPT-spike): 对齐换正确属性 horizontalAlignment + 三工具写后回读验证 + 背景换 setSolidFill
  - d0d1dfc fix(10-PPT-spike): 工具层 effective 门控诚实失败 + 修 rotate_shape humanLabel undefined bug
  - 3a0bf09 test(10-PPT-spike): 写后回读验证守门 — 假成功被 effective 拦成诚实失败
---

# Quick Task 260531-m4x — Summary

## 做了什么

修复真机 UAT 暴露的 PPT spike 工具「报成功 ✅ 但实际没生效」诚实底线问题。

### A. 对齐换正确 API
- `paragraphFormat.alignment`（Office.js `ParagraphFormat` **无此属性**，写入静默无效）
  → `paragraphFormat.horizontalAlignment`（枚举 `ParagraphHorizontalAlignment`）。
- `setShapeTextAlignment` + `restoreShapeAlignment` 同步改；加 alignment 值归一化（left→Left）。

### B. 写后回读验证（三工具共同的诚实底线）
- `setShapeTextAlignment` / `rotateShape` / `setSlideBackground` 写入 + sync 后**回读目标属性**与意图值归一化比对，
  返回显式 `effective` 信号：
  - 对齐：回读 `horizontalAlignment === target`。
  - 旋转：回读 `shape.rotation` 数值比对（容差 0.5，含 360 环绕）。
  - 背景：回读 `fill.type === 'Solid'`。
- 工具层 `!effective` → `{ ok:false, error:UNSUPPORTED「此操作在网页版 PowerPoint 未生效（可能仅桌面版支持）」}`，
  **不带 reverse/postState** → 不记 undo、不报 ✅、熔断器记 failure。

### 附带：背景 API 修正（规格外发现）
- `SlideBackgroundFill` **无** `setSolidColor`/`foregroundColor`/`clear`（那是 `ShapeFill` 的成员）——
  旧代码 cast 假类型调不存在方法 → try/catch 吞掉 → 背景从未改却仍报 ✅。
  改 `fill.setSolidFill({color})` 写、`fill.type`+`getSolidFillOrNullObject().color` 读、`background.reset()` 还原。

### C. rotate_shape humanLabel undefined bug
- 真机「将第 **undefined** 张幻灯片形状「**undefined**」旋转至 45°」：schema 用 camelCase（slideIndex/shapeId），
  LLM 受 sibling 工具影响传 snake_case → 取错键。humanLabel + execute 键名容错（两种命名都读）；同族对齐/背景工具一并加固。

### D. 测试守门
- `ppt.test.ts`：三工具 effective true/false 门控 + rotate 键名容错（结构性 gate，杜绝假成功复发）。
- `PptAdapter.test.ts`：adapter 级写后回读验证（「setter 不改值」mock 模拟网页版 no-op）。
- `operationLog.integration.test.ts`：mock 同步新 API（horizontalAlignment、setSolidFill、reset），restore 路径保持绿。

## 验证结果
- `npm test`：**758 passed, 0 failed**（含 `tsc --noEmit` 通过）；尾部 3 个 retry.test.ts errors = 已知噪音。
- `npm run build`：成功，main gzip 75.13 kB。
- `npm run size`：75.01 kB ≤ 82 kB ✓。

## ⚠️ 诚实交代（automated 测不出的部分）
- 「网页版到底哪几个能真生效」automated 无法验证——需 TL 部署后真机 UAT 复测。
- 本次只保证：① 不再假成功（写后回读验证拦截 no-op→诚实失败）；② 对齐/背景换成了正确的 Office.js API。
- 若真机发现某工具仍 no-op，现在会**诚实报失败**（而非假 ✅），符合诚实底线。

## E. PPT 工具 snake/camel 键名不一致 — 真功能性 bug（TL 追加，部署前必修）

初版只在 rotate/对齐/背景做了键名容错；TL 证实这是**全局真 bug**（不只 humanLabel）：

- **根因**：部分 PPT 工具 schema 用 camelCase（slideIndex/shapeId/sourceIndex/targetIndex），sibling
  工具（move_shape/set_shape_text/set_shape_property）用 snake_case。`dispatchTool` **不做 JSON-schema
  校验**（已核 src/agent/tools/index.ts：直接 `def.execute(call.arguments)`），故 LLM 传 snake_case 时
  required 检查不拦截、直达 execute → camelCase 解构得 `undefined` → 操作失败。rotate_shape 真机失败即此。
- **本次修复**：给全部 5 个受影响 camelCase 工具加同款双键容错（`args.camel ?? args.snake`），humanLabel +
  execute 都改：`set_shape_text_font`、`add_shape`、`copy_slide`、`delete_shape`、`manage_slides`
  （连同已修的 rotate/对齐/背景，PPT camelCase 工具全覆盖）。
- **守门**：ppt.test.ts 新增 6 用例锁住「snake_case key → execute 拿到正确值、非 undefined、ok:true」+ camelCase 不回归。
- **结构性根治建议（v2.2）**：snake/camel 双键容错是创可贴；根治应**统一 PPT 工具 casing**（全 snake_case，
  对齐 Word/Excel 工具约定），或在 **dispatch 层做中央 args 归一化**（camel↔snake 统一后再喂 execute），
  避免每个新 PPT 工具都要手动记得加容错。

## 未做 / 交接
- **未 push、未 phase.complete**（TL 收尾统一做）。
- 规格 2 处 API 判断与 @types/office-js 不符（背景 setSolidColor 不存在、对齐属性在 paragraphFormat 非 TextRange 直属）——已按验证过的正确 API 实施，详见提交说明。
- snake/camel 中央归一化（v2.2 结构性根治）——见上 §E。
