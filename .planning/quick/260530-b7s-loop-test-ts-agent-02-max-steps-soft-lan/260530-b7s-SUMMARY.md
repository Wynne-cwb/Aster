---
quick_id: 260530-b7s
type: quick
phase: quick
plan: 260530-b7s
subsystem: agent/loop
tags: [test-fix, circuit-breaker, agent-loop, vitest]
dependency_graph:
  requires: []
  provides: [passing AGENT-02 soft-landing test]
  affects: [src/agent/loop.test.ts]
tech_stack:
  added: []
  patterns: [per-turn unique tool name to bypass circuit-breaker in tests]
key_files:
  modified:
    - src/agent/loop.test.ts
decisions:
  - "AGENT-02 mock 改为每轮 yield 不同名（missing_tool_0…N），绕过熔断器 THRESHOLD=3"
  - "beforeEach 补 circuitBreaker.__reset() 保证跨测试隔离"
metrics:
  duration: "~2min"
  completed: "2026-05-30T00:08:45Z"
  tasks_completed: 1
  files_modified: 1
---

# Quick 260530-b7s: 修复 AGENT-02 max_steps soft-landing 测试

**One-liner:** 用 per-turn 唯一工具名绕过熔断器 THRESHOLD=3，修复 AGENT-02 soft-landing 断言，同步补 `circuitBreaker.__reset()` 防跨测试泄漏。

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | 修复 AGENT-02 mock 并补 beforeEach breaker.__reset() | 9cffdbc | src/agent/loop.test.ts |

## What Was Done

Phase 4 引入熔断器（circuit-breaker.ts，WINDOW=5/THRESHOLD=3）后，AGENT-02 的旧 mock 每轮
yield 同一个工具名 `nonexistent`，第 4 轮触发 `isOpen('nonexistent') = true` → `abort('circuit')`
→ `agentStatus` 变 `'idle'`，永远到不了 soft-landing。

**修复（三处改动）：**

1. 新增 `import * as circuitBreaker from './circuit-breaker'`
2. `beforeEach` 末尾补 `circuitBreaker.__reset()` — 防止熔断器状态跨测试泄漏
3. AGENT-02 `it` 回调改用 `mockImplementation` 闭包：每次 `streamChat()` 调用递增 `turn`，
   yield `missing_tool_0`…`missing_tool_N`。每个名字最多积 1 次 NOT_FOUND，不达 THRESHOLD，
   熔断器不触发，循环跑满 20 步，`pushSoftLanding` 触发，`agentStatus = 'soft-landing'`。

未修改任何生产代码（loop.ts / loop-helpers.ts / circuit-breaker.ts / agentStore.ts / tools/）。

## Verification Results

### loop.test.ts（目标文件）

```
PASS (4) FAIL (0)
```

- AGENT-01 × 2: PASS
- AGENT-02 × 1 (soft-landing + ctrl.signal.aborted === false): PASS
- AGENT-13 × 1: PASS

### 全量 vitest run（回归检查）

```
Test Suites: 161 passed, 161 total
Tests:       511 passed, 511 total
Failed:      0
```

无新增失败，无回归。

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] src/agent/loop.test.ts modified (3 precise changes applied)
- [x] Commit 9cffdbc exists and contains only test file changes
- [x] No production files modified
- [x] loop.test.ts: 4/4 passed
- [x] Full suite: 511/511 passed, 0 failed
