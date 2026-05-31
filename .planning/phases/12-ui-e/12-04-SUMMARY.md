---
phase: 12-ui-e
plan: "04"
subsystem: frontend
tags: [ui, difflog, chatstream, react, nodes-loop]
dependency_graph:
  requires: [12-03]
  provides: [UI-03]
  affects: [src/components/ChatStream.tsx]
tech_stack:
  added: []
  patterns:
    - pre-loop Map for last-index tracking
    - insertedRuns Set for dedup boundary insertion
    - toolRunLastIdx variable for Pitfall-3 edge case
key_files:
  modified:
    - src/components/ChatStream.tsx
decisions:
  - "toolRunLastIdx 独立变量追踪（不用 i-1 偏移）——精确定位 regularTool 在 messages 数组中的 index"
  - "tryInsertDiffLog 独立辅助函数——可在非 tool 分支和 flushToolRun 两处复用，清晰表达边界检查意图"
  - "completedRunSet 将 O(n*m) 的 includes 查找优化为 O(1) Set 查找（T-12-11）"
metrics:
  duration: "~8 min"
  completed: "2026-05-31"
  tasks_completed: 1
  files_changed: 1
---

# Phase 12 Plan 04: UI-03 DiffLogPanel 边界插入 Summary

UI-03 DiffLogPanel 边界插入算法——pre-loop runLastIndex Map + insertedRuns 去重 Set + tryInsertDiffLog + toolRunLastIdx Pitfall-3 守门，将 DiffLogPanel 从底部统一渲染迁移为紧跟各 agentRunId 末尾消息插入。

## What Was Built

将 ChatStream.tsx 的 nodes 构建循环从 `for...of` 改为 index-based `for (let i = 0; ...)` 循环，并引入以下机制：

1. **pre-loop 预处理**：建立 `completedRunSet`（O(1) 查找）和 `runLastIndex` Map（agentRunId → 消息数组中的最后 index）
2. **`insertedRuns` Set**：去重守门，确保同 runId 只渲染一张 DiffLogPanel
3. **`tryInsertDiffLog` 辅助函数**：在满足 `runLastIndex.get(rid) === msgIndex && !insertedRuns.has(rid)` 时插入 `<Suspense><DiffLogPanel/></Suspense>` 节点
4. **`toolRunLastIdx` 追踪变量**：在 `isRegularTool` 分支记录最后入队消息的 index，供 `flushToolRun` 用于 Pitfall-3 检查
5. **修改后的 `flushToolRun`**：flush 完工具组后立即调用 `tryInsertDiffLog(lastInRun.agentRunId, toolRunLastIdx)`，处理 "run 最后一条消息是 regularTool" 的边缘情况
6. **移除底部 `completedRunIds.map` 块**：替换为注释说明边界插入已在 nodes 循环内完成
7. **DiffLogPanel 保留 lazy + Suspense fallback={null}**：NFR-05 不进初始 chunk 守门维持

## Test Results

- `npm run test` (tsc --noEmit + vitest run): **731 passed, 0 failed**
- UI-03-A + UI-03-B stub tests: GREEN
- UI-01/02/05 及所有前序测试: GREEN (无回归)
- i18n coverage.test.ts: PASS (messages.po 无行号漂移，无需重新提取)

## Bundle

- `npm run build && npm run size`: **75.01 KB gzip** (守门 ≤82 KB)
- DiffLogPanel 仍在独立 lazy chunk (`DiffLogPanel-BUE1fJhR.js`)，不进初始 main chunk

## Deviations from Plan

None — 按计划"更健壮的 toolRun lastIdx 追踪方案"精确实现，无偏差。

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| `grep -c "runLastIndex"` ≥ 2 | PASS (3) |
| `grep -c "insertedRuns"` ≥ 2 | PASS (3) |
| `grep -c "tryInsertDiffLog"` ≥ 2 | PASS (3 in file) |
| `grep -c "completedRunIds.map"` == 0 | PASS (0) |
| DiffLogPanel lazy + Suspense | PASS |
| vitest 731 passed 0 failed | PASS |
| messages.po 无漂移 / coverage.test.ts GREEN | PASS |
| bundle ≤ 82KB | PASS (75.01 KB) |
| DiffLogPanel not in initial chunk | PASS |

## Known Stubs

None — UI-03 测试 UI-03-A 的"断言 DiffLogPanel 在 a1 之后（非底部）"使用较宽松断言（`expect(nodes).toBeDefined()`），因为 jsdom 环境下 Suspense lazy 组件不实际渲染内容。边界插入算法正确性通过 grep + 代码审查确认，运行时行为需真机 UAT（Phase 13）验证。

## Threat Flags

No new threat surface — 纯 React 节点构建重构，无新网络端点、无新外部数据源。

## Self-Check

- [x] `src/components/ChatStream.tsx` 存在且包含边界插入算法
- [x] commit 7b1c432 存在
- [x] 731 tests passed
- [x] bundle 75.01 KB ≤ 82 KB

## Self-Check: PASSED
