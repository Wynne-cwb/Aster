# Spike SP-2: DeepSeek stream_options.include_usage:true 在最后 chunk 返完整 usage 字段

**Type:** ① archived（v1 已验过 / cost 砍后不消费）
**Status:** PASS（archived）
**Date:** 2026-05-29
**Source:** ROADMAP Phase 3 Week 1 Spike 段

## 验证目标
DeepSeek-V4 SSE 流末尾 chunk 是否含 `usage: { prompt_tokens, completion_tokens, total_tokens }` 字段。

## 探测方法（不跑，直接归档）
v1 Phase 02 已经实现：`src/lib/sse.ts` 的 `tryParseAndEmitUsage` 解析 chunk.usage（line 305+），v1 CostBadge 在真机里显过 ¥ 值，证明解析路径已通。

## 结论
1. 解析路径 v1 已实现并验证 — 不重跑
2. v2.0 在 /gsd-discuss-phase 3（2026-05-28，D-20 / D-21）整批砍掉 cost 功能，usage 字段不再消费
3. 类型保留兼容陌生 SSE upstream（Plan 01 已在 src/lib/sse.ts SSEUsage 上方加 @deprecated jsdoc）

## Fallback
N/A — 已 archived。如未来 Provider 强制要求 include_usage:false，再删 SSEUsage 类型 + agent loop case 'usage' continue 分支。
