---
phase: "06"
plan: "02"
subsystem: excel-adapter
tags: [excel, adapter, write-tools, inverse, before-image, chart]
dependency_graph:
  requires: ["06-01"]
  provides: ["ExcelAdapter.insertChart", "ExcelAdapter.deleteChartByName", "ExcelAdapter.applyFormula", "ExcelAdapter.setCell"]
  affects: ["src/agent/tools/write/excel.ts", "operationLog replay engine"]
tech_stack:
  added: []
  patterns: ["before-image two-sync", "Record inverse signature", "getItemOrNullObject guard"]
key_files:
  created: []
  modified:
    - src/adapters/ExcelAdapter.ts
    - src/agent/tools/write/excel.test.ts
decisions:
  - "applyFormula/setCell 的 inverse 复用已有 overwriteRange（Record 签名），无需新增 inverse 方法"
  - "deleteChartByName 用 getItemOrNullObject + isNullObject guard 防删已删（T-06-02-01）"
  - "insertChart 不做 try/catch 内 HostApiError 实例重抛，保持与 setRangeValues 一致的错误透传"
metrics:
  duration: "~10 min"
  completed: "2026-05-30"
  tasks_completed: 2
  files_changed: 2
---

# Phase 06 Plan 02: ExcelAdapter write/inverse 4 个新方法 Summary

**一句话：** ExcelAdapter 新增 insertChart（chart.name 作 inverse 句柄）、deleteChartByName（Record 签名 + getItemOrNullObject guard）、applyFormula 和 setCell（before-image two-sync 范式），全部遵循 Phase 5 D-05 规范 + Record 签名守门。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ExcelAdapter 新增 insertChart + deleteChartByName | 5fcc737 | src/adapters/ExcelAdapter.ts |
| 2 | ExcelAdapter 新增 applyFormula + setCell + 激活测试 | c65ebf8 | src/agent/tools/write/excel.test.ts |

## What Was Built

### ExcelAdapter 新增 4 个方法

**`insertChart(dataRange: string, chartType: string): Promise<{ chartName: string }>`**
- Excel.run 内：getActiveWorksheet → charts.add(chartType, range, auto) → chart.load(['name']) → sync → 返回 `{ chartName }`
- chartName 是 Excel 自动分配的稳定句柄（如"图表 1"），作为 inverse descriptor 的唯一 ID
- try/catch: HostApiError 实例重抛，否则包成 HostApiError

**`deleteChartByName(args: Record<string, unknown>): Promise<void>`**
- Record 签名守门：`const chartName = args.chartName as string`（非位置参，[[project-adapter-inverse-signature]]）
- getItemOrNullObject 防御：chart 不存在时 isNullObject=true，静默跳过（T-06-02-01）
- 适用场景：replay engine undo 回放 / 用户手动已删

**`applyFormula(cell: string, formula: string): Promise<{ beforeImage: ... }>`**
- two-sync 范式（仿 setRangeValues）：sync1 load(['values','address','formulas']) → sync2 range.formulas = [[formula]]
- beforeImage 结构供 overwriteRange（已有 inverse 方法）直接消费，无需新增 inverse

**`setCell(cell: string, value: unknown): Promise<{ beforeImage: ... }>`**
- 与 applyFormula 结构完全相同，改写 range.values = [[value]]（单格值写入）
- inverse 同样复用 overwriteRange

### 测试文件激活

- `excel.test.ts`：从 Wave 0 describe.skip 占位桩升级为真实断言（11 个测试全通过）
- 覆盖：insertChart 返回值 + deleteChartByName Record 签名 + guard 行为 + applyFormula/setCell beforeImage 结构

## Verification Results

```
✓ npm test -- --run src/agent/tools/write/excel.test.ts
  11 tests passed

✓ npm run build
  gzip 80.39 KB（≤82 KB 预算内）

✓ grep -c "getItemOrNullObject" ExcelAdapter.ts → 4（包含注释 + 实现行）
✓ grep async insertChart|deleteChartByName|applyFormula|setCell → 4 方法定义
```

## Deviations from Plan

无 — 计划完全按预期执行。

### 关键决策（Claude discretion 范围内）

1. Task 1 和 Task 2 对同一文件的修改无法 git patch 分离 → 以两次 commit 实现语义分离：adapter 实现 (feat) + 测试激活 (test)
2. applyFormula 的 range.load 包含 'formulas' 字段（参照 PATTERNS.md 示例），与 setCell 的 load(['values','address']) 略有差异 — 这是正确的：applyFormula before-image 记录当前公式内容，more informative

## Known Stubs

无 — 所有方法均完整实现，无占位符或硬编码空值。

## Threat Flags

无 — 无新增网络端点或 auth 路径。T-06-02-01（chart.name 碰撞）已由 getItemOrNullObject guard 防御。

## Self-Check: PASSED

- [x] src/adapters/ExcelAdapter.ts 存在且含 4 个新方法
- [x] src/agent/tools/write/excel.test.ts 更新（11 测试通过）
- [x] commit 5fcc737 存在（feat: adapter 实现）
- [x] commit c65ebf8 存在（test: 测试激活）
- [x] build gzip ≤82 KB 预算守住（80.39 KB）
