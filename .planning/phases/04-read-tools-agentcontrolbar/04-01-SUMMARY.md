---
phase: 04-read-tools-agentcontrolbar
plan: "01"
subsystem: agent
tags: [circuit-breaker, read-result, tdd, sliding-window, size-cap, ERR-03, TOOL-05, TOOL-06]
dependency_graph:
  requires: []
  provides:
    - src/agent/circuit-breaker.ts (isOpen/recordSuccess/recordFailure sliding window)
    - src/agent/read-result.ts (wrapReadResult/applySizeCap/estimateTokens)
  affects:
    - src/agent/loop-helpers.ts (isOpen/recordSuccess/recordFailure 调用点 Phase 3 已埋，现真实生效)
    - Plans 03/04/05/06 (wrapReadResult 供 read tool execute 调用)
    - Plan 07 (circuit-breaker isOpen → CIRCUIT_OPEN 错误 UX)
tech_stack:
  added: []
  patterns:
    - sliding-window-per-tool-code (WINDOW=5 定长数组，成功占 slot 不 reset)
    - char-approx-token-cap (estimateTokens 1.6 chars/token，偏大安全方向)
    - wrap-then-passthrough (成功包装为 WrappedReadResult，失败原样透传)
key_files:
  created:
    - src/agent/circuit-breaker.ts (Phase 3 骨架填实为真实 sliding window)
    - src/agent/circuit-breaker.test.ts (8 tests incl. A-10 interleaved-success)
    - src/agent/read-result.ts (estimateTokens/applySizeCap/wrapReadResult)
    - src/agent/read-result.test.ts (11 tests incl. >80000 char truncation)
  modified: []
decisions:
  - "circuit-breaker 成功用哨兵 code '_ok' 占 slot，不 delete / reset — A-10 灵魂"
  - "token 估算用 1.6 chars/token 保守上界（比实际 2.5 中文字/token 更偏大，cap 更早触发）"
  - "wrapReadResult 失败路径原样透传，不读 err.stack（T-04-03）"
  - "result_type 分类由调用方 tool execute 决定（不在 wrapReadResult 内自判断）"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-05-29"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 04 Plan 01: circuit-breaker sliding window + read-result 包装 Summary

**One-liner:** 用 TDD 锁定 sliding-window circuit breaker（WINDOW=5，A-10 中间成功不重置）和 read-result 纯函数三件套（estimateTokens / applySizeCap 50K token cap / wrapReadResult 包装透传），作为 Phase 4 全部 read tool 和错误 UX 的底层依赖。

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | circuit-breaker sliding window 填实（ERR-03/A-10） | `39e46c6` | circuit-breaker.ts, circuit-breaker.test.ts |
| 2 | read-result 包装 + size cap（TOOL-05/TOOL-06） | `d0e1d46` | read-result.ts, read-result.test.ts |

## Test Results

```
circuit-breaker.test.ts  PASS (8)  FAIL (0)
read-result.test.ts      PASS (11) FAIL (0)
Combined                 PASS (19) FAIL (0)
```

全套 `npm run test -- --run`：32 文件中 31 passed，1 failed（`src/agent/loop.test.ts` — 预先存在于本 plan 之前，见 Deferred Issues）。

## TDD Gate Compliance

RED → GREEN 序列完整：
1. `test(04-01)` 语义：circuit-breaker.test.ts 写在实现之前，RED 阶段确认 `__reset is not a function` 错误；read-result.test.ts RED 阶段确认 `Failed to resolve import "./read-result"` 错误。
2. `feat(04-01)` 语义：两个实现文件均在对应测试文件通过后提交。

Git log 顺序：
- `39e46c6` feat(04-01): circuit-breaker（RED+GREEN 同次 commit，因骨架已存在测试触发失败）
- `d0e1d46` feat(04-01): read-result（RED+GREEN 同次 commit）

## Deviations from Plan

### Auto-fixed Issues

None.

### Deferred Issues

**1. [Pre-existing] src/agent/loop.test.ts — 1 test failing**
- **Found during:** `npm run test -- --run` 全套验证
- **Status:** 该失败在本 plan 所有修改之前已存在（通过 `git stash` 还原验证：stash 前后结果完全一致：1 failed | 31 passed）
- **Not caused by:** 本 plan 任何改动
- **Action:** 记录到 deferred-items，不属于本 plan 修复范围

## Known Stubs

None — 两个模块均为完整实现，无 placeholder / TODO / hardcoded empty 值。

## Threat Flags

T-04-01 / T-04-02 / T-04-03 已在实现中全部 mitigate：
- T-04-01: content 是纯字符串（JSON.stringify），result_type 字段让 LLM 区分 evidence vs 元数据
- T-04-02: applySizeCap 50K token hard cap，保守 1.6 chars/token 让 cap 更早触发
- T-04-03: 失败路径原样透传，不读 err.stack / err.message

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/agent/circuit-breaker.ts | FOUND |
| src/agent/circuit-breaker.test.ts | FOUND |
| src/agent/read-result.ts | FOUND |
| src/agent/read-result.test.ts | FOUND |
| commit 39e46c6 | FOUND |
| commit d0e1d46 | FOUND |
