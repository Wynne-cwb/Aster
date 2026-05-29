---
phase: 05-diff-log-undo-all-3
plan: "05"
subsystem: adapters/excel-inverse
tags: [excel, adapter, inverse, before-image, tdd]
dependency_graph:
  requires: ["05-02"]
  provides: ["ExcelAdapter.setRangeValues", "ExcelAdapter.overwriteRange"]
  affects: ["src/agent/operationLog.ts", "05-07"]
tech_stack:
  added: []
  patterns: ["two-sync pattern", "DocumentAdapterForReplay interface"]
key_files:
  created: []
  modified:
    - src/adapters/ExcelAdapter.ts
    - src/adapters/ExcelAdapter.test.ts
decisions:
  - "overwriteRange 签名遵循 DocumentAdapterForReplay 接口约定（args: Record<string, unknown>），不用二参数签名，确保 operationLog.executeReverse 直接传 reverse.args 不需解包"
metrics:
  duration: "5min"
  completed_date: "2026-05-29"
  tasks_completed: 1
  files_modified: 2
requirements:
  - TOOL-03
  - AGENT-10
  - AGENT-11
---

# Phase 05 Plan 05: ExcelAdapter setRangeValues + overwriteRange Summary

## One-liner

ExcelAdapter 新增两 sync 范式 before-image 写操作（setRangeValues）和 args-record 签名 inverse 覆写（overwriteRange），满足 operationLog replay engine 约定。

## What Was Built

### setRangeValues(address: string, values: unknown[][]): Promise<{ beforeImage: { address: string; values: unknown[][] } }>

- 在 Excel.run 闭包内执行两 sync（NFR-02 A-06 two-sync 守则）
- sync 1：`range.load(['values', 'address'])` → 读取 before-image（address 是 server 端属性，必须 sync 后才可读）
- sync 2：`range.values = values` → 覆写目标 range
- 返回 `{ beforeImage: { address, values } }`，由 write tool（05-07）存入 operationLog 的 reverse.args

### overwriteRange(args: Record<string, unknown>): Promise<void>

- 签名遵循 `DocumentAdapterForReplay.overwriteRange` 接口约定（args 对象形式）
- 内部解包 `args.address + args.values`
- 单次 sync：直接覆写，不抓 before-image（是 inverse 方法，其结果不需再 undo）
- 由 `operationLog.executeReverse('overwrite_range', adapter)` 直接传 `reverse.args` 调用

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| `5788940` | test (RED) | 展开 Wave 0 it.todo stubs 为真实 mock 测试（8 setRangeValues + 6 overwriteRange 测试，全部 RED） |
| `f51c594` | feat (GREEN) | 实现 setRangeValues + overwriteRange，10 测试全 GREEN |
| `2d31c6c` | fix | Rule 1 Bug 修复：overwriteRange 签名对齐 DocumentAdapterForReplay，更新测试 |

## TDD Gate Compliance

- RED gate commit: `5788940` — `test(05-05): add failing tests...`（方法未实现，TypeError）
- GREEN gate commit: `f51c594` — `feat(05-05): implement ExcelAdapter...`（10 测试 PASS）
- REFACTOR：顺带发现 Rule 1 Bug，修复 commit `2d31c6c`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] overwriteRange 签名与 DocumentAdapterForReplay 接口不匹配**

- **Found during:** GREEN 实现后，检查 operationLog.ts executeReverse 调用点
- **Issue:** operationLog.ts 声明 `overwriteRange?: (args: Record<string, unknown>) => Promise<void>`，但初始实现为 `overwriteRange(address: string, values: unknown[][])`。运行时 `adapter.overwriteRange(reverse.args)` 会把对象传给 `address` 参数，`values` 为 undefined，导致覆写错误 range 或写入 null。
- **Fix:** 修改签名为 `overwriteRange(args: Record<string, unknown>)` 并内部解包 `args.address + args.values`，与 `DocumentAdapterForReplay` 接口约定完全对齐。
- **Files modified:** `src/adapters/ExcelAdapter.ts`, `src/adapters/ExcelAdapter.test.ts`
- **Commit:** `2d31c6c`

## Verification Results

```
npx vitest run src/adapters/ExcelAdapter.test.ts → PASS (10) FAIL (0)
grep -c "setRangeValues|overwriteRange" src/adapters/ExcelAdapter.ts → 7（≥2 ✓）
npx tsc --noEmit → 无 error TS
npx eslint src/adapters/ExcelAdapter.ts → 无 error
```

## Threat Surface Scan

无新增网络端点/auth 路径/文件访问/schema 变更。

`overwriteRange` values 参数来自 before-image（write tool 执行前抓取的原始 cell 值），非 LLM 直接控制（T-05-05-01 已在计划中覆盖）。

## Self-Check

- [x] `src/adapters/ExcelAdapter.ts` 存在，包含 setRangeValues + overwriteRange
- [x] commit `5788940`, `f51c594`, `2d31c6c` 均在 git log
- [x] 10 个测试全 PASS
