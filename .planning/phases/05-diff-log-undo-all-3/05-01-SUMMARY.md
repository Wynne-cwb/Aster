---
phase: 05-diff-log-undo-all-3
plan: "01"
subsystem: test-infrastructure
tags:
  - tdd
  - wave-0
  - test-stubs
  - operation-log
  - adapter-inverse
  - security-gate
dependency_graph:
  requires: []
  provides:
    - operationLog Wave1 failing test stubs (Map<runId> + replayUndoAll)
    - copyStepLog 脱敏守门框架 (T-05-01-01)
    - WordAdapter deleteParagraphByContent inverse stubs
    - ExcelAdapter setRangeValues/overwriteRange stubs
    - PptAdapter insertSlideAfter/deleteSlideByTitle stubs
  affects:
    - src/agent/tools/write/word.ts (reverse descriptor 更新)
    - src/agent/tools/index.ts (PostStateSnapshot + ToolResult.postState 新增)
tech_stack:
  added:
    - PostStateSnapshot interface (ToolResult 扩展，Phase 5 TOOL-04)
  patterns:
    - it.todo 占位 = Wave 0 stubs；Wave N 实现后展开
    - vi.fn() mock Office.js API（不调真实 Office）
    - 脱敏测试断言 not.toMatch(/sk-[A-Za-z0-9]+/)
key_files:
  created:
    - src/lib/copyStepLog.test.ts
    - src/adapters/ExcelAdapter.test.ts
    - src/adapters/PptAdapter.test.ts
  modified:
    - src/agent/tools/write/word.test.ts
    - src/agent/operationLog.test.ts
    - src/lib/storage.test.ts
    - src/adapters/WordAdapter.test.ts
    - src/agent/tools/write/word.ts
    - src/agent/tools/index.ts
decisions:
  - "reverse 从 delete_last_paragraph → delete_paragraph_by_content（精确按内容定位，TOOL-04）"
  - "postState 快照加进 ToolResult 接口（PostStateSnapshot），供 Wave 1 replayUndoAll 对比手动改（D-11）"
  - "Wave 0 stubs 全部用 it.todo 占位（编译通过，测试不 fail），Wave N 实现时展开"
  - "copyStepLog.test.ts 脱敏断言 T-05-01-01 在 Wave 0 就建立，Wave 5 实现时必须通过"
metrics:
  duration: "6min"
  completed_date: "2026-05-30"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 10
---

# Phase 05 Plan 01: Wave 0 测试 Stubs Summary

Wave 0 测试先行——在所有实现 plan 执行前建好测试框架，reverse 断言同步更新为精确 `delete_paragraph_by_content`，并为 6 个测试文件建立 it.todo stubs，后续 Wave 1-3 代码落地后直接 RED→GREEN。

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | word.test + operationLog Wave1 todos + copyStepLog 脱敏框架 | `3723f4e` | word.test.ts reverse 断言更新 + postState 新增；operationLog.test.ts 追加 5 个 it.todo；copyStepLog.test.ts 新建（4 个 it.todo + 脱敏守门） |
| 2 | storage quota guard + adapter inverse stubs | `9a5fae5` | storage.test.ts 追加 quota guard todos；WordAdapter.test.ts 追加 deleteParagraphByContent todos；ExcelAdapter.test.ts + PptAdapter.test.ts 新建（inverse stubs） |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] 新增 PostStateSnapshot 接口 + ToolResult.postState 字段**
- **Found during:** Task 1
- **Issue:** word.ts 需要在 execute 返回中加 `postState` 字段，但 `ToolResult` 接口中没有该字段，会导致 TypeScript 编译错误
- **Fix:** 在 `src/agent/tools/index.ts` 的 `ToolResult` 接口中新增可选 `postState?: PostStateSnapshot` 字段，并定义 `PostStateSnapshot` 接口
- **Files modified:** `src/agent/tools/index.ts`
- **Commit:** `3723f4e`

**2. [Rule 1 - Bug] word.ts reverse descriptor 同步更新为精确 delete_paragraph_by_content**
- **Found during:** Task 1
- **Issue:** 测试断言改为 `delete_paragraph_by_content`，但 word.ts 实现仍返回 `delete_last_paragraph`，导致 word.test.ts 失败（RED→不应该失败于错误原因）
- **Fix:** 同步更新 word.ts 的 reverse descriptor + args + postState 快照（实现与测试断言对齐）
- **Files modified:** `src/agent/tools/write/word.ts`
- **Commit:** `3723f4e`

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run src/agent/tools/write/word.test.ts` | 6 pass / 0 fail |
| `npx vitest run src/agent/operationLog.test.ts` | 1 pass / 0 fail (5 todo) |
| `npx vitest run src/lib/storage.test.ts` | 17 pass / 0 fail (2 todo) |
| `npx vitest run src/adapters/PptAdapter.test.ts` | 2 pass / 0 fail (4 todo) |
| `npx vitest run src/adapters/WordAdapter.test.ts` | 5 pass / 0 fail (3 todo) |
| `npx vitest run src/adapters/ExcelAdapter.test.ts` | 2 pass / 0 fail (3 todo) |
| `npx tsc --noEmit \| grep "error TS"` | 0 errors（copyStepLog 模块缺失为预期，已排除） |
| 4 个新文件存在 | copyStepLog.test.ts + ExcelAdapter.test.ts + PptAdapter.test.ts ✓ |

## Known Stubs

这些 stubs 是 Wave 0 预期设计，不阻塞本 plan 目标：

| Stub | File | Reason |
|------|------|--------|
| buildStepLog import（注释掉） | `src/lib/copyStepLog.test.ts` | Wave 5 实现 copyStepLog.ts 后取消注释；4 个 it.todo 脱敏守门框架已就位 |
| StorageQuotaError（2 个 it.todo） | `src/lib/storage.test.ts` | Wave 1b 实现 StorageQuotaError 后展开 |
| deleteParagraphByContent（3 个 it.todo） | `src/adapters/WordAdapter.test.ts` | Wave 3 实现 WordAdapter.deleteParagraphByContent 后展开 |
| setRangeValues/overwriteRange（3 个 it.todo） | `src/adapters/ExcelAdapter.test.ts` | Wave 2 实现后展开 |
| insertSlideAfter/deleteSlideByTitle（4 个 it.todo） | `src/adapters/PptAdapter.test.ts` | Wave 2c 实现后展开 |
| replayUndoAll（5 个 it.todo） | `src/agent/operationLog.test.ts` | Wave 1 实现 Map<runId> 重构后展开 |

## Threat Flags

无新增威胁面（仅测试文件，不产生 network/auth/存储路径变化）。

T-05-01-01 脱敏守门已就位：`copyStepLog.test.ts` 含 `not.toMatch(/sk-[A-Za-z0-9]+/)` 断言，Wave 5 实现时必须通过。

## Self-Check: PASSED

- [x] `src/lib/copyStepLog.test.ts` 存在
- [x] `src/adapters/ExcelAdapter.test.ts` 存在
- [x] `src/adapters/PptAdapter.test.ts` 存在
- [x] `src/adapters/WordAdapter.test.ts` 存在（追加 inverse stubs）
- [x] Task 1 commit `3723f4e` 存在
- [x] Task 2 commit `9a5fae5` 存在
- [x] word.test.ts 6/6 pass
- [x] TS 编译无错误（copyStepLog 缺失为预期）
