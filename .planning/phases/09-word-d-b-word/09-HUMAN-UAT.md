---
status: partial
phase: 09-word-d-b-word
source: [09-VERIFICATION.md]
started: 2026-05-31T01:41:58Z
updated: 2026-05-31T01:41:58Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. uniqueLocalId 真机验证
expected: 在 Office for Web 中打开 Word 文档，多段文字相同，选中第二段后调 selection_detail，确认返回 paragraphIndex 和非空 uniqueLocalId（WordApi 1.6 在 Office for Web 上支持）；精确定位到第二段而非第一段。
result: [pending]

### 2. find_and_replace undo 真机验证
expected: 在 Office for Web 中执行 find_and_replace（替换某个词），点击 DiffLogPanel 撤销该步，确认被替换文字全部还原为原文；DiffLogPanel 步骤行显示「已撤销」状态。
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
