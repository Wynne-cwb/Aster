---
status: partial
phase: 10-excel-ppt-b-excel-b-ppt
source: [10-VERIFICATION.md]
started: 2026-05-31T00:00:00Z
updated: 2026-05-31T00:00:00Z
---

## Current Test

[awaiting human testing on real Office for Web hosts (Chrome/Edge)]

## Tests

### 1. Spike S7 — add_shape / addTextBox 实际绕过 Office.js #2775
expected: 在 PPT 当前幻灯片用 agent 调用 add_shape 插入文本框写「季度总结」，文本框成功出现且不触发 #2775（插入后不丢失选中形状 / 不报错）；undo 后该文本框消失。代码层 countBefore/countAfter 校验 + deleteShapeById 逆向已实现并 integration GREEN；真机是否真正绕过 #2775 待确认。
result: [pending]

### 2. Spike S1 — rotate_shape 的 shape.rotation 真机可读写
expected: 在真实 Office for Web PowerPoint 上 rotate_shape 旋转形状，before-image 能读到 rotation（happy-path → undo 还原角度）；若不可读则降级 noop+gate 并显示「此操作不可自动撤销」warn，agent 不中断。确认真机走 happy-path 还是降级路径。
result: [pending]

### 3. Spike S2 — set_slide_background 的 slide.background.fill 真机可读（PowerPointApi 1.10）
expected: set_slide_background 设置幻灯片背景色，before-image 能读到原背景（happy-path → undo 还原）；若 API 1.10 不可读则降级 noop+gate warn，agent 不中断。确认真机走 happy-path 还是降级路径。
result: [pending]

### 4. Spike S4 — set_shape_text_alignment 的 paragraphFormat.alignment 真机可读写
expected: set_shape_text_alignment 设置段落对齐，before-image 能读到原 alignment（happy-path → undo 还原）；若不可读则降级 noop+gate warn，agent 不中断。确认真机走 happy-path 还是降级路径。
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
