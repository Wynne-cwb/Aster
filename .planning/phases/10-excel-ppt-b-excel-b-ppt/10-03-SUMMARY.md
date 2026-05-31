---
phase: 10-excel-ppt-b-excel-b-ppt
plan: "03"
subsystem: excel-adapter-wave2
tags: [excel, adapter, snapshot, undo, tools, wave2]
dependency_graph:
  requires: [10-02]
  provides: [EXCEL-03, EXCEL-05, EXCEL-09, EXCEL-10]
  affects: [operationLog.integration.test, contract.test, CONTRACT.md]
tech_stack:
  added: [readRangeValuesSnapshot, restoreRangeValuesSnapshot, sortRange, excelFindAndReplace, manageWorksheet, restoreWorksheetSnapshot, setChartTitle, restoreChartTitle]
  patterns: [snapshot-undo, noop+gate, D-03-enum-guard, D-20-dual-gate, 3-sync-before-image]
key_files:
  created: []
  modified:
    - src/adapters/ExcelAdapter.ts
    - src/agent/tools/write/excel.ts
    - src/agent/tools/index.ts
    - src/agent/contract.test.ts
    - src/agent/operationLog.integration.test.ts
    - src/agent/tools/index.test.ts
    - src/agent/tools/read/tools.test.ts
    - .planning/phases/08-foundation-a-f/CONTRACT.md
decisions:
  - "readRangeValuesSnapshot 设为 private 方法（仅供 sortRange/excelFindAndReplace 内部使用，不对外暴露）"
  - "excelFindAndReplace replaceAll 返回值用 unknown cast 处理 TS 类型不精确（Office.js types 未覆盖 ExcelApi 1.9 replaceAll）"
  - "sortRange/excelFindAndReplace 超限时 tooLarge=true + noop_inverse，仍执行操作（D-07：warn 不中断 agent）"
  - "mockExcel() 扩展 charts/worksheets 集合 mock 以支持 set_chart_title/manage_worksheet 集成测试"
  - "Rule 1 auto-fix：更新 index.test.ts + read/tools.test.ts 中 excel 工具硬编码数量（8→18）"
metrics:
  duration: "~11 minutes"
  completed: "2026-05-31"
  tasks_completed: 2
  files_modified: 8
---

# Phase 10 Plan 03: Excel Wave 2 (EXCEL-03/05/09/10) Summary

Wave 2 完成 Excel 剩余 4 个工具：快照式 sort_range + excel_find_and_replace、元数据快照 manage_worksheet、简单逆向 set_chart_title。

## What Was Built

### Task 1: ExcelAdapter.ts — 8 个新方法

| 方法 | 类型 | 功能 |
|------|------|------|
| `readRangeValuesSnapshot` (private) | 辅助 | 读取 range 值快照，超 10,000 单元格抛 isTooLarge 错误 |
| `restoreRangeValuesSnapshot` | inverse (Record) | EXCEL-03/05 共享 inverse，直接覆写 range.values（D-20） |
| `sortRange` | write | sort.apply，超限 tooLarge=true，仍执行排序（D-07） |
| `excelFindAndReplace` | write | replaceAll ExcelApi 1.9，unknown cast 处理 TS 类型 |
| `manageWorksheet` | write | add/rename 枚举硬限（TypeScript + 运行时双重守门，D-03） |
| `restoreWorksheetSnapshot` | inverse (Record) | add → delete；rename → 改回 oldName |
| `setChartTitle` | write | 三 sync（isNullObject + before-image + write） |
| `restoreChartTitle` | inverse (Record) | getItemOrNullObject 防御，已删图表静默跳过 |

mockExcel() 扩展：添加 `charts.getItemOrNullObject`、`worksheets.add`、`worksheets.getItem`、`worksheets.getItemOrNullObject`、`range.cellCount`、`range.getUsedRange` 等 mock 支持。

### Task 2: ToolDef + 注册 + D-17 四步守门

**4 个 ToolDef 新增：**
- `sort_range`（EXCEL-03）：description 标注"会清空 Excel 自带撤销历史"（D-08），超限 noop_inverse
- `excel_find_and_replace`（EXCEL-05）：D-20 独立守门，共享 `restore_range_values_snapshot` inverse
- `manage_worksheet`（EXCEL-09）：schema `enum: ['add', 'rename']`（D-03），description 标注"delete 不在范围"，execute 运行时双重守门
- `set_chart_title`（EXCEL-10）：三 sync before-image + `restore_chart_title` inverse

**D-17 四步守门完成：**
1. contract.test.ts：EXCEL-03/05/09/10 → `integrationTest: true`（Excel 10 行全部 true）
2. operationLog.integration.test.ts：4 条守门 GREEN（真 ExcelAdapter + mockExcel + 断言 rolled_back）
3. CONTRACT.md：4 行 status → done，integration_test → true
4. D-20 特别验证：`sort_range` 和 `excel_find_and_replace` 各有独立 integration test 用例

## Gate Status

| 工具 | integration gate | 状态 |
|------|-----------------|------|
| sort_range（EXCEL-03） | D-17/D-20 | GREEN ✓ |
| excel_find_and_replace（EXCEL-05） | D-17/D-20 独立 | GREEN ✓ |
| manage_worksheet（EXCEL-09） | D-17 | GREEN ✓ |
| set_chart_title（EXCEL-10） | D-17 | GREEN ✓ |
| PPT tools (10-04/05) | — | RED（预期，不在本计划范围）|

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 更新 excel 工具计数断言**
- **Found during:** Task 2 执行后 npm test
- **Issue:** `src/agent/tools/index.test.ts` 和 `src/agent/tools/read/tools.test.ts` 硬编码 Excel 工具数量为 8，新增 4 个工具后变 18 → 测试失败
- **Fix:** 更新两个测试文件的计数断言（8→18），同时更新 `read/tools.test.ts` 中 `writeToolNames` 集合加入 Wave 1a + Wave 2 的 10 个新工具
- **Files modified:** `src/agent/tools/index.test.ts`, `src/agent/tools/read/tools.test.ts`
- **Commit:** d5e3a00

**2. [Rule 1 - Bug] excelFindAndReplace replaceAll 类型修复**
- **Found during:** Task 1 TypeScript 编译
- **Issue:** `targetRange.replaceAll()` 在 `@types/office-js` 中返回 `ClientResult<number>`（没有 `.load()` 方法），与实际 ExcelApi 1.9 行为不符
- **Fix:** 用 `unknown cast` 绕过 TS 类型检查，定义内联 interface 类型
- **Files modified:** `src/adapters/ExcelAdapter.ts`
- **Commit:** 6ebf319

**3. [Rule 2 - Missing Mock] 扩展 mockExcel() 支持 Wave 2 adapter 方法**
- **Found during:** Task 1 完成后，`set_chart_title` 和 `manage_worksheet` 集成测试仍 skipped_error
- **Issue:** mockExcel() 缺少 `charts.getItemOrNullObject`、`worksheets.add/getItem/getItemOrNullObject`、`range.cellCount`、`getUsedRange` 等 mock
- **Fix:** 扩展 mockExcel() 添加所需 mock 对象
- **Files modified:** `src/agent/operationLog.integration.test.ts`
- **Commit:** 6ebf319

## Known Stubs

None — 所有工具方法完整实现，无占位符。

## Threat Surface Scan

No new network endpoints or trust boundary changes introduced. ExcelAdapter methods operate within Office.js sandbox. T-10-08（快照上限）和 T-10-09（manage_worksheet 枚举守门）均已按 threat_model 实施缓解。

## Self-Check: PASSED

- src/adapters/ExcelAdapter.ts — 8 个新方法存在 ✓
- src/agent/tools/write/excel.ts — 4 个新 ToolDef 存在 ✓
- src/agent/tools/index.ts — 4 个工具已注册 ✓
- contract.test.ts — Excel 10 行 integrationTest: true ✓
- CONTRACT.md — 4 行 status: done ✓
- npm run build 通过，main bundle 74.70 kB gzip（≤82KB 守门）✓
- EXCEL-03/05/09/10 integration gates GREEN ✓
- PPT gates RED（预期）✓
- manage_worksheet = add/rename ONLY ✓（schema enum + runtime guard）
