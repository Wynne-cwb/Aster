---
phase: 05-diff-log-undo-all-3
plan: "02"
subsystem: agent-operation-log
tags:
  - tdd
  - wave-1
  - operation-log
  - replay-engine
  - undo-all
  - map-refactor
dependency_graph:
  requires:
    - "05-01 Wave 0 test stubs (operationLog.test.ts it.todo stubs)"
  provides:
    - operationLog Map<runId> store
    - PostStateSnapshot interface (kind literal union)
    - replayUndoAll() + UndoResult (D-11 continue-on-error)
    - getWriteOpsByRun() filter
    - DocumentAdapterForReplay minimal interface
  affects:
    - src/agent/operationLog.ts (full refactor)
    - src/agent/tools/index.ts (PostStateSnapshot type aligned)
tech_stack:
  added: []
  patterns:
    - "Map<string, T[]> module-level store (circuit-breaker 同款范式)"
    - "D-11 continue-on-error: replayUndoStep try/catch 不 rethrow"
    - "A-06 守门: operationLog.ts 内无 Word/Excel/PowerPoint 命名空间"
    - "TDD RED/GREEN: it.todo 展开 → 6 fail → 7 pass"
key_files:
  created: []
  modified:
    - src/agent/operationLog.ts
    - src/agent/operationLog.test.ts
    - src/agent/tools/index.ts
decisions:
  - "DocumentAdapterForReplay 最小接口定义在 operationLog.ts（非 DocumentAdapter.ts），避免 agent→adapter 反向依赖方向混乱；Wave 2-3 各 adapter 实现时再对接"
  - "readTargetState 返回 undefined 时（adapter 未实现 read 方法）视为一致，保守通过 — Wave 2-3 之前 replay 仍可工作"
  - "PostStateSnapshot.kind 精确为字面量联合类型（word_paragraph|excel_range|ppt_slide），tools/index.ts 通过 re-export 统一来源"
  - "it.todo 逆序测试发现测试逻辑写反（第一次 rejectedValue → step2 先撤 → step2=skipped_error），修正后 7/7 pass"
metrics:
  duration: "20min"
  completed_date: "2026-05-30"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 05 Plan 02: OperationLog Map<runId> 重构 + Replay Engine Summary

Map<runId> 重构 + D-11 continue-on-error replay engine — 三个旧导出名签名不变，新增 replayUndoAll / getWriteOpsByRun / UndoResult / DocumentAdapterForReplay，eslint A-06 守门通过。

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| RED | operationLog Wave1 failing tests | `20e89e7` | 展开 5 个 it.todo → 实测断言（Map<runId> / replayUndoAll 逆序 / skipped_manual / D-11） |
| 1 | OperationLog 重构为 Map<runId> + replay engine | `3b8eeac` | operationLog.ts 全量重构：Map store / PostStateSnapshot / replayUndoAll / UndoResult / DocumentAdapterForReplay |
| 2 | ToolResult.postState 类型对齐 | `1f6c64e` | tools/index.ts 改为 import + re-export PostStateSnapshot from operationLog（统一字面量联合类型） |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] it.todo 展开后测试逻辑写反**
- **Found during:** TDD GREEN 阶段运行测试
- **Issue:** D-11 测试中期望 step2（逆序第一个撤销）= `rolled_back`，step1 = `skipped_error`；但逻辑是第一次 rejectedValue 打中的是逆序第一个（step2），应为 `skipped_error`
- **Fix:** 修正测试断言（step2=skipped_error，step1=rolled_back），符合 D-11 语义
- **Files modified:** `src/agent/operationLog.test.ts`
- **Commit:** `3b8eeac`（GREEN commit 内含测试修正）

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run src/agent/operationLog.test.ts` | 7 pass / 0 fail |
| `npx eslint src/agent/operationLog.ts --max-warnings=0` | ESLint: No issues found (A-06 clean) |
| `grep -c "export function append\|getOps\|__reset" operationLog.ts` | 3 (三个旧导出名保留) |
| `grep postState src/agent/tools/index.ts` | 含 postState 字段（PostStateSnapshot re-export） |
| `npx tsc --noEmit` (exclude copyStepLog) | 0 errors |
| loop.test.ts AGENT-02 失败 | 预存在 flaky（与本 plan 无关，已确认 git stash 前后同样失败） |

## Known Stubs

本 plan 新增的 `DocumentAdapterForReplay` 接口中以下方法是 Wave 2-3 占位：
- `deleteParagraphByContent` — Wave 3 WordAdapter 实现
- `readWordParagraph` — Wave 3 WordAdapter 实现
- `overwriteRange` / `readExcelRange` — Wave 2 ExcelAdapter 实现
- `deleteSlideByTitle` / `readPptSlideTitle` — Wave 2c PptAdapter 实现

replay engine 在 adapter 未实现 read 方法时保守通过（视为一致），Wave 2-3 实现后才有完整的手动改防御能力。

## Threat Flags

无新增威胁面。

T-05-02-02 mitigated: `npx eslint src/agent/operationLog.ts` 通过，无 Word/Excel/PowerPoint 命名空间出现在 replay engine 内。

## Self-Check: PASSED

- [x] `src/agent/operationLog.ts` 存在且已重构
- [x] `src/agent/operationLog.test.ts` 7/7 pass
- [x] Task 1 commit `3b8eeac` 存在
- [x] Task 2 commit `1f6c64e` 存在
- [x] RED commit `20e89e7` 存在
- [x] `npx eslint src/agent/operationLog.ts` 无 A-06 violation
- [x] `npx tsc --noEmit` 无新 error（copyStepLog 缺失为 Wave 0 预期）
- [x] 三个旧导出名（appendOperation / getOperationsByRun / __resetOperationLogForTest）签名不变
