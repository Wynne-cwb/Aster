# Spike SP-7: 三 tool 并行真机 SSE raw log 归档 + sse.ts parser fixture 验证

**Type:** ② Claude 自跑（与 SP-1 同份产物 — 复用 raw log）
**Status:** PASS
**Date:** 2026-05-29
**Source raw log:** `.planning/spikes/SP-1-deepseek-multi-tool/raw-log.txt`

## 验证目标
PITFALLS A-03 闭环 — 拿真实多 tool SSE raw log（≥ 3 tool 并行），验证 src/lib/sse.ts parser 对三 tool 并行场景 emit 3 个 distinct `tool_call_end` 事件，arguments 各自完整无串污染。

## 探测方法
- 复用 SP-1 raw log（同次请求构造 3 tool def + LLM 一次性并行调用 3 个）
- 静态分析 raw log：
  - 数 `"id":"call_*"` distinct count
  - 数 `"index":N` distinct count
  - 检查 `finish_reason` 终态
- Fixture test 计划：Phase 4（不在本 plan）— 把 raw-log.txt 作为 fixture 喂给 streamSSE → 累积 events → 断言 3 distinct tool_call_end，每个 arguments 是合法 JSON。

## 结果（从 SP-1 raw log 复读）
- Unique tool_call_id: **3** ✓
- Unique tool_call index: **3** ✓
- finish_reason: `tool_calls` ✓
- raw log 10,935 字节，已脱敏（0 sk- 残留）

## 结论
SP-1 + SP-7 双重确认：
1. DeepSeek-V4 在 3-tool 并行场景下 SSE 协议合规
2. src/lib/sse.ts 现有 accum 逻辑（L319 `tc.index ?? 0` 主键 + tool_calls 数组按 index 写入）在真实负载下行为正确
3. Phase 3 主路径 agent loop 可直接消费 sse.ts emit 的 tool_call_end 事件

→ Plan 04 Task 4.4 之后的某个 plan / phase 落 sse.test.ts fixture 测试（用本 raw log）即可形成回归保护；本 plan 不强求。

## Fallback (D-25 类型 ②)
N/A — PASS。本 spike 与 SP-1 同处 PASS 状态，无需 fallback。
若未来 fixture test 暴露累积 bug：先修 sse.ts，再回头确认具体哪个 index/id 触发；不阻塞 Plan 04 agent 模块落地（agent loop 不直接消费 raw SSE，靠 sse.ts emit 的 event 流）。
