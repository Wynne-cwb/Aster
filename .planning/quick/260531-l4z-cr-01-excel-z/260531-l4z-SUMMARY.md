---
quick_id: 260531-l4z
slug: cr-01-excel-z
description: CR-01 Excel 列索引 >Z 非法地址修复（columnIndexToLetter helper）
date: 2026-05-31
status: complete
commit: b509262
---

# Quick Task 260531-l4z SUMMARY — CR-01 Excel 列索引 >Z 非法地址修复

## 完成内容

1. **`src/adapters/ExcelAdapter.ts`**
   - 新增模块私有 `columnIndexToLetter(idx: number): string`（bijective base-26）：
     `0→A、25→Z、26→AA、27→AB、701→ZZ、702→AAA`。
   - `setColumnRowSize`（前向）与 `restoreColumnRowSize`（inverse）两处 `column`
     分支的列地址生成，从 `String.fromCharCode(65 + idx)` 改用 `columnIndexToLetter(idx)`。
   - two-sync 流程、读 before-image 失败对称性、try/catch 结构均未改动。

2. **`src/adapters/ExcelAdapter.test.ts`** — 守门测试（mock Excel，捕获 getRange 地址）：
   - `setColumnRowSize` idx=26→`AA:AA`、27→`AB:AB`、701→`ZZ:ZZ`，断言无 `'['`。
   - 单字母边界 idx=0→`A:A`、25→`Z:Z` 不回归。
   - `restoreColumnRowSize` index≥26（26、701）→ 合法多字母地址，无 `'['`。

## 验证

- `npx tsc --noEmit`：clean（无类型错误）。
- `npx vitest run src/adapters/ExcelAdapter.test.ts`：14 passed（原 10 + 新增 4）。

## Commit
- 代码：`b509262` — fix(10-CR-01): Excel 列索引>Z 生成合法多字母 A1 地址

## 备注
- 未 push（按团队约定，push 由 team-lead 统一收尾）。
