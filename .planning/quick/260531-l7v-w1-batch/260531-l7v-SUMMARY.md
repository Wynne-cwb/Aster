---
quick_id: 260531-l7v
slug: w1-batch
description: W1 部分成功 batch 抹掉熔断器失败计数修复（partialFailure 解耦）
date: 2026-05-31
status: complete
commit: 9f22588
---

# Quick Task 260531-l7v SUMMARY — W1 部分失败 batch 通知熔断器

## 完成内容（解耦方案）

1. **`src/agent/tools/index.ts`** — `ToolResult` 新增可选 `partialFailure?: boolean`
   （注释说明：与 ok / reverse / undo 解耦，仅供 loop-helpers 通知熔断器）。
2. **`src/agent/tools/write/batch.ts`**（部分失败分支）— 保留 `ok: true`，
   当 `failAtIndex !== undefined` 时加 `partialFailure: true`。
3. **`src/agent/loop-helpers.ts`**（runOneToolCall）—
   `if (result.ok && !result.partialFailure) breaker.recordSuccess(tc.name);`
   `else breaker.recordFailure(tc.name, result.error?.code ?? 'PARTIAL_BATCH_FAILURE');`
4. **`appendOperation`（L155-168）未动** — undo 记录仍 gated on `result.reverse`，
   已完成 subOp 的撤销能力不受影响（这是不把 ok 改 false 的根本原因：避免 LLM
   把部分成功当全失败而重做已完成步骤）。

## 验证

- `npx tsc --noEmit`：clean。
- `npx vitest run batch.test.ts loop-helpers.test.ts`：16 passed
  （batch 8 = 5 原 + 3 新；loop-helpers 8 = 6 原 + 2 新）。

## 守门测试
- batch.test.ts：部分失败→`ok:true`+`partialFailure:true`+`reverse`/`subOps`(len=1) 保留；
  全成功→`partialFailure` falsy；全失败（completedSubOps=0）→`ok:false` 既有行为不回归。
- loop-helpers.test.ts：黑盒真实 circuit-breaker——部分失败连 3 次（THRESHOLD）→
  `breaker.isOpen('batch_write')===true`（证明走 recordFailure）；无 partialFailure
  连 3 次→`isOpen===false`（走 recordSuccess）。

## Commit
- 代码：`9f22588` — fix(11-W1): 部分失败 batch 通知熔断器（partialFailure 解耦）

## 备注
- 未 push（按团队约定，push 由 team-lead 统一收尾）。
