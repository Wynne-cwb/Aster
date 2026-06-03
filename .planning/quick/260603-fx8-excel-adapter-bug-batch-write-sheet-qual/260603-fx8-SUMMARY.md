---
phase: quick-260603-fx8
plan: "01"
subsystem: excel-adapter
tags: [bug-fix, batch-write, sheet-qualified-address, excel-adapter]
dependency_graph:
  requires: []
  provides:
    - resolveRange helper（ExcelAdapter.ts 模块级）
    - resolveRangeOrNull helper（executeBatch 专用）
    - executeBatch apply_formula / set_cell 分派
  affects:
    - src/adapters/ExcelAdapter.ts
    - src/adapters/ExcelAdapter.batch.test.ts
    - src/agent/operationLog.integration.test.ts
tech_stack:
  added: []
  patterns:
    - resolveRange(ctx, address) 模块级 helper，裸/Sheet!/引号表名三种格式统一解析
    - executeBatch switch(op.tool) 工具分派 + switch(writeKind) 写操作分派
key_files:
  modified:
    - src/adapters/ExcelAdapter.ts
    - src/adapters/ExcelAdapter.batch.test.ts
    - src/agent/operationLog.integration.test.ts
decisions:
  - resolveRangeOrNull 与 resolveRange 分开：executeBatch 专用 null-object 变体，避免将 getRangeOrNullObject cast 散落各处
  - executeBatch staged 数组追加 writeKind 字段（非另建 Map）：最小侵入，同时保持两阶段 sync 结构不变（D-01 铁律）
  - 测试 mock 修复用「重建完整地址」策略（getItem(sheetName).getRange(localAddr) → makeRange(sheetName!localAddr)）：保持 addressOrder 追踪语义不变，断言无需修改
metrics:
  duration: ~15min
  completed: "2026-06-03"
  tasks: 2
  files_modified: 3
---

# Quick 260603-fx8: ExcelAdapter batch write + sheet-qualified address 修复总结

**一句话：** 修复 ExcelAdapter 两个精确定位 bug — executeBatch 忽略 op.tool 导致 apply_formula/set_cell 失败（BUG 1）+ 所有 getRange 调用不支持 Sheet1!A1 格式导致跨表操作 InvalidArgument 熔断（BUG 2），同时补守门单测并修复 integration test mock。

## Bug 根因确认与修复摘要

### BUG 1：executeBatch 不区分 op.tool

**根因：** Phase 1a 只校验 `op.args.address`，所有 op 无论 `op.tool` 是什么都走同一路径；Phase 2a 只写 `proxy.values = op.args.values`。`apply_formula` 的参数是 `{cell, formula}` 没有 `address`/`values`，`set_cell` 也是 `{cell, value}`，两者都因参数校验在 Phase 1a 提前返回 `failAtIndex=0`，导致 batch 内任何位置的 apply_formula/set_cell 子操作全部失败。

**修复：**
- Phase 1a 加 `switch(op.tool)`，枚举 `set_range_values`/`apply_formula`/`set_cell` 三种合法工具，分别提取 `rangeAddress` 和 `writeKind`；`default` 走 `failAtIndex = i`（T-fx8-01 明确拒绝未知工具）
- `staged` 数组追加 `writeKind: 'values'|'formula'|'cell_value'` 字段
- Phase 2a 加 `switch(writeKind)` 分派：`'values'` → `proxy.values = values`；`'formula'` → `proxy.formulas = [[formula]]`；`'cell_value'` → `proxy.values = [[value]]`

### BUG 2：getRange 不接受 Sheet1!A1 格式

**根因：** Office.js `worksheet.getRange(address)` 只接受局部地址（`A1:B2`），不接受工作表前缀格式（`Sheet1!A1:B2`）。LLM 经常生成 sheet-qualified 地址（如用户说"把 Sheet1 的 A1 写入"），传入后 Office.js 抛 `InvalidArgument`，熔断器累计失败触发断路。

**修复：**
- 新增模块级 `resolveRange(ctx, address)` helper（位于 `columnIndexToLetter` 之后、`ExcelAdapter` class 之前）
  - 裸地址 `A1:B2` → `getActiveWorksheet().getRange("A1:B2")`
  - 普通表名 `Sheet1!A1` → `getItem("Sheet1").getRange("A1")`
  - 引号表名 `'带 空格'!A1` → `getItem("带 空格").getRange("A1")`（剥外层单引号）
  - 转义单引号 `'O''Brien'!C3` → `getItem("O'Brien").getRange("C3")`（`''`→`'`）
- 新增 `resolveRangeOrNull(ctx, address)` 变体（`getRangeOrNullObject`，executeBatch Phase 1 专用）
- 替换 15 处 `worksheet.getRange(LLM地址)` 站点

## 改动的站点（共 15 处 getRange 替换）

| 方法 | 行号（改后约） | 改动 |
|------|---------|------|
| `get_range_values` switch case | ~280 | → `resolveRange(ctx, address)` |
| `setRangeValues` | ~460 | → `resolveRange(ctx, address)` |
| `overwriteRange` | ~508 | → `resolveRange(ctx, address)` |
| `insertChart` | ~548 | → `resolveRange(ctx, dataRange)` |
| `applyFormula` | ~618 | → `resolveRange(ctx, cell)` |
| `setCell` | ~660 | → `resolveRange(ctx, cell)` |
| `formatExcelRange` | ~721 | → `resolveRange(ctx, address)`（同时去掉 `sheet` 变量） |
| `restoreRangeFormat` | ~793 | → `resolveRange(ctx, address)` |
| `addConditionalFormat` | ~990 | → `resolveRange(ctx, address)`（同时去掉 `sheet` 变量） |
| `restoreConditionalFormat` | ~1063 | → `resolveRange(ctx, address)`（同时去掉 `sheet` 变量） |
| `readRangeValuesSnapshot` | ~1258 | → `resolveRange(ctx, address)` |
| `restoreRangeValuesSnapshot` | ~1289 | → `resolveRange(ctx, address)` |
| `sortRange` | ~1340 | → `resolveRange(ctx, address)` |
| `excelFindAndReplace` address 分支 | ~1382 | → `resolveRange(ctx, address)` |
| `executeBatchReverse` | ~1750 | → `resolveRange(ctx, address)` |
| `executeBatch` Phase 1a | ~1680 | → `resolveRangeOrNull(ctx, rangeAddress)` |

**已知遗留（不改，在 SUMMARY 标记）：**
- `createTable` 的 `sheet.tables.add(address, ...)` — 不是 `getRange` API，`add` 接受 sheet-qualified 格式已有测试验证，不改
- `setColumnRowSize` 内循环构造的 `${colLetter}:${colLetter}` 格式地址 — 程序内部生成的裸地址，不来自 LLM，不需要改

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] integration test mock 未覆盖 getItem().getRange 分支**

- **Found during:** Task 2 测试运行
- **Issue:** `executeBatchReverse` 改用 `resolveRange` 后，传入 `Sheet1!A3` 格式地址走 `getItem('Sheet1').getRange('A3')` 分支，但 `mockExcelForBatchReverse` 的 worksheets 只有 `getActiveWorksheet`，没有 `getItem`，导致 1 个 integration test `skipped_error`
- **Fix:** `mockExcelForBatchReverse` 追加 `getItem(sheetName)` 返回 `{ getRange: (localAddr) => makeRange(sheetName + '!' + localAddr), ... }`，保持 addressOrder 追踪语义（断言值 `Sheet1!A3` 等不变）
- **Files modified:** `src/agent/operationLog.integration.test.ts`
- **Commit:** f67c29b

**2. [Rule 1 - Bug] mockExcel.getItem 返回对象缺 getRange 方法**

- **Found during:** Task 2 测试运行
- **Issue:** `mockExcel` 的 `worksheetsCollection.getItem` 返回 `{ load, name }` 无 `getRange`，`restoreRangeValuesSnapshot` 传入 `Sheet1!A1:Z100` 走 `getItem` 分支时 `TypeError: getRange is not a function`
- **Fix:** 改为 `getItem: vi.fn(() => ({ load, name, getRange: () => range }))`
- **Files modified:** `src/agent/operationLog.integration.test.ts`
- **Commit:** f67c29b（同批次）

## 测试结果快照

```
ExcelAdapter.batch.test.ts:   PASS (9)  ← 原有 2 + 新增 7 守门用例全绿
operationLog.integration.test.ts: PASS (47)
Full suite: 72 files / 892 tests — 全通过
尾部 3 个 retry errors = retry.test.ts 已知噪音（i18n_extract_and_test_noise）
tsc --noEmit: 0 errors
```

### 新增守门单测（7 个）

1. `apply_formula op → completed 1，formulas setter 被调用，reverse.args 是 Record（含 address+values 键）`
2. `set_cell op → completed 1，values 写为 [[value]]`
3. `set_range_values ok + unknown_tool → failAtIndex=1，fail-fast 语义`
4. `裸地址 A1 → getActiveWorksheet().getRange("A1") 被调用`
5. `Sheet1!A1 → getItem("Sheet1").getRange("A1") 被调用`
6. `'带 空格'!A1 → getItem("带 空格").getRange("A1") 被调用（外层单引号剥除）`
7. `'O''Brien'!C3 → getItem("O'Brien").getRange("C3") 被调用（''→' 转义）`

### D-01 验证

executeBatch 仍只做 2 次 ctx.sync（Phase 1 + Phase 2），batch.test.ts sync 计数断言仍绿。

## 真机验证建议

以下场景需在 Office for Web Excel 真机验证（自动化单测已覆盖逻辑，但真机 Office.js 行为需实测）：

1. **BUG 1 真机验证：** agent 发送含 `apply_formula` 和 `set_cell` 的 batch_write，确认 completed > 0，公式和值正确写入
2. **BUG 2 真机验证：** agent 在 batch_write 或单工具调用中传入 `Sheet1!A1:B10` 格式地址，确认不报 `InvalidArgument`，数据正确写入目标工作表

## Self-Check: PASSED

- `src/adapters/ExcelAdapter.ts` 存在，包含 `resolveRange` 和 `resolveRangeOrNull` 函数
- `src/adapters/ExcelAdapter.batch.test.ts` 存在，包含 `apply_formula` 守门用例
- `src/agent/operationLog.integration.test.ts` mock 已修复
- Commit `9fd0b82` 存在（Task 1）
- Commit `f67c29b` 存在（Task 2）
- tsc 0 errors，892 tests pass
