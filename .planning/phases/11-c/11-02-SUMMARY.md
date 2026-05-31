---
phase: 11-c
plan: 02
subsystem: operation-log
tags: [batch, operationLog, ToolResult, loop-helpers, type-contract, per-subOp-defence]

requires:
  - phase: 11-c
    plan: 01
    provides: "Wave 0 RED 测试骨架（9 RED）+ batch.ts 存根 + contract.test.ts batch 声明"

provides:
  - "PostStateSnapshot.kind 联合类型含 'batch'"
  - "OperationLogEntry.subOps? 字段（humanLabel/postState?/reverse per sub-op）"
  - "DocumentAdapterForReplay.executeBatchReverse? 可选方法（接收 surviving ops 含 postState?）"
  - "executeReverse case 'batch_reverse'：完整 per-subOp D-09 手改防御 + 三态聚合（rolledBack/skippedManual/skippedError）"
  - "readTargetState case 'batch' → undefined（per-subOp 在 batch_reverse 统一处理）"
  - "isTargetStateConsistent case 'batch' → true（保守通过）"
  - "ToolResult.subOps? 字段（与 OperationLogEntry.subOps 同形）"
  - "loop-helpers.ts appendOperation 调用透传 subOps: result.subOps"

affects: [11-03, 11-04, 11-05]

tech-stack:
  added: []
  patterns:
    - "per-subOp 手改防御：reversedOps → survivingOps 过滤（readTargetState + isTargetStateConsistent）→ 两条路径（executeBatchReverse 优先 / 降级逐个）均基于 survivingOps（D-09 完整覆盖）"
    - "三态聚合：case 'batch_reverse' 内 rolledBack/skippedManual/skippedError 计数 → 写入 reverse.args._batchUndoResult 供 SummaryModal"
    - "isTargetStateConsistent(current, postState) 参数顺序：current 在前，postState 在后（与计划接口示例一致；plan 的 readTargetState 返回值即 current）"

key-files:
  modified:
    - src/agent/operationLog.ts
    - src/agent/tools/index.ts
    - src/agent/loop-helpers.ts

key-decisions:
  - "isTargetStateConsistent 参数顺序确认：函数签名 (current, postState)，plan 示例 readTargetState(subOp.postState, adapter) 的返回值是 current；实现时按正确顺序调用，无需修正"
  - "executeBatchReverse? 签名携带 postState?: 方便 Wave 2 adapter 实现时知道每个 subOp 的 postState，符合 D-08/D-09 对称设计"
  - "三态计数只在 skippedManual>0 || skippedError>0 时写入 _batchUndoResult（减少无用字段污染正常 batch undo）"

metrics:
  duration: 5min
  completed: 2026-05-31
---

# Phase 11 Plan 02: Wave 1 OperationLog 类型地基 Summary

**Wave 1 类型地基：OperationLog 类型系统扩展（'batch' kind + subOps 字段 + batch_reverse per-subOp D-09 手改防御）+ ToolResult.subOps + loop-helpers 透传——建立 batch 类型契约供 Wave 2（adapter 实现）和 Wave 3（UI 渲染）使用**

## Performance

- **Duration:** 约 5 分钟
- **Started:** 2026-05-31T03:24:00Z
- **Completed:** 2026-05-31T03:29:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `PostStateSnapshot.kind` 加入 `'batch'`（联合类型扩展）
- `OperationLogEntry` 加入 `subOps?` 字段（供 DiffLogPanel 嵌套渲染 + per-subOp 手改防御）
- `DocumentAdapterForReplay` 加入 `executeBatchReverse?` 可选方法（签名含 `postState?`，接收 surviving ops）
- `readTargetState` switch 加 `case 'batch'`（返回 undefined，per-subOp 在 batch_reverse 统一处理）
- `isTargetStateConsistent` switch 加 `case 'batch'`（保守通过 true）
- `executeReverse` switch 加完整 `case 'batch_reverse'`（含 D-09 per-subOp 手改防御 + 三态聚合）
- `ToolResult` 加入 `subOps?` 字段（与 OperationLogEntry.subOps 同形）
- `loop-helpers.ts appendOperation` 调用透传 `subOps: result.subOps`
- 698 个先有测试保持 GREEN，tsc 无报错

## Task Commits

1. **Task 1: operationLog.ts 类型扩展 + batch_reverse case** - `47f05fa` (feat)
2. **Task 2: ToolResult.subOps + loop-helpers 透传** - `b97e23a` (feat)

## Files Modified

- `/Users/wb.chen/Documents/Project/Aster/src/agent/operationLog.ts` — 6 处 batch 改动（kind/'batch' + subOps 字段 + executeBatchReverse? + readTargetState case 'batch' + isTargetStateConsistent case 'batch' + case 'batch_reverse' 含 D-09 per-subOp 防御）
- `/Users/wb.chen/Documents/Project/Aster/src/agent/tools/index.ts` — ToolResult 加 subOps? 字段
- `/Users/wb.chen/Documents/Project/Aster/src/agent/loop-helpers.ts` — appendOperation 调用透传 subOps

## Wave 0 RED 测试变绿情况

本 Wave（11-02）只负责类型层，以下是各 RED 锚点的当前状态：

| 测试文件 | 测试描述 | Wave 0 状态 | Wave 1 后 | 说明 |
|----------|----------|------------|-----------|------|
| batch.test.ts | ops.length > 20 → INVALID_ARGS | RED | RED | Wave 2 batch.ts 实现后变绿 |
| batch.test.ts | 嵌套 batch_write → INVALID_ARGS | RED | RED | Wave 2 batch.ts 实现后变绿 |
| batch.test.ts | ops 为空数组 → INVALID_ARGS | RED | RED | Wave 2 batch.ts 实现后变绿 |
| ExcelAdapter.batch.test.ts | 3 op → ctx.sync 只调用 2 次 | RED | RED | Wave 2 adapter 实现后变绿 |
| ExcelAdapter.batch.test.ts | fail-fast 部分完成 | RED | RED | Wave 2 adapter 实现后变绿 |
| WordAdapter.batch.test.ts | real reverse（WARNING-1 守门）| RED | RED | Wave 2 adapter 实现后变绿 |
| WordAdapter.batch.test.ts | 不抛 unsupported | RED | RED | Wave 2 adapter 实现后变绿 |
| DiffLogPanel.test.tsx | batch 卡 humanLabel 显示 | RED | RED | Wave 3 UI 实现后变绿 |
| DiffLogPanel.test.tsx | batch subOps 列表渲染 | RED | RED | Wave 3 UI 实现后变绿 |

Wave 1 类型扩展让 Wave 2/3 可以以干净的类型合约为基础实现，**不需要再绕过 `as unknown as`**。

## Deviations from Plan

无。计划执行精确，6 处 operationLog.ts 改动和 ToolResult/loop-helpers 改动均按接口规范完成。

## Known Stubs

无新增 Stub（本 Wave 只做类型扩展，无业务逻辑存根）。

## Threat Flags

按 11-02-PLAN.md threat_model：
- T-11-W1-01 Tampering（reverse.args.ops 参数）：ops 的 Record 对象类型在签名层强制，Wave 2/5 integration test 断言。
- T-11-W1-03 Information Disclosure（subOps 透传）：subOps 仅进 in-memory OperationLogEntry（不序列化），accept。
- 无新增安全表面超出计划 threat_model 范围。

## Self-Check

- [x] src/agent/operationLog.ts 存在（6 处 batch 改动）
- [x] src/agent/tools/index.ts 存在（ToolResult.subOps? 字段）
- [x] src/agent/loop-helpers.ts 存在（subOps 透传）
- [x] commit 47f05fa 存在（operationLog.ts Task 1）
- [x] commit b97e23a 存在（ToolResult + loop-helpers Task 2）
- [x] tsc --noEmit 通过（npm test = tsc + vitest）
- [x] 698 既有测试 GREEN，9 Wave 0 RED 仍然 RED（预期）

## Self-Check: PASSED
