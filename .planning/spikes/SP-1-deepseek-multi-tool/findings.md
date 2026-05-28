# Spike SP-1: DeepSeek-V4 多 tool 并行 SSE accum 验证

**Type:** ② Claude 自跑
**Status:** PASS
**Date:** 2026-05-29
**Probe model:** `deepseek-chat` (映射到 `deepseek-v4-flash` per response.model)

## 验证目标
DeepSeek-V4 同时返多个 tool_call 时，SSE `tool_calls[i].index` 主键累积是否正确（id 漏发 / 多 tool arguments 串污染验证）— PITFALLS A-03。

## 探测方法
`.planning/spikes/SP-1-deepseek-multi-tool/probe.mjs`：构造 3 个 tool（`set_title_slide_1/2/3`），引导 LLM 一次性调全部 3 个，抓 SSE raw log，统计 unique id / index / finish_reason。

## 结果
- **Unique tool_call_id:** 3 ✓
- **Unique tool_call index:** 3 ✓
- **finish_reason:** `tool_calls` ✓
- **Actual model:** `deepseek-v4-flash`（请求传 `deepseek-chat` → 平台映射）
- **Raw log size:** 10,935 bytes，0 个 `sk-` 残留（已脱敏）
- raw log: 见 `raw-log.txt`

## 结论
DeepSeek-V4 在 parallel tool_calls 路径上：
1. 每个 tool_call 用唯一 `call_XX_*` id（3 个 distinct）
2. SSE delta 用 `index` 主键区分（0/1/2）— src/lib/sse.ts L319 `tc.index ?? 0` 累积逻辑正确
3. finish_reason=tool_calls 一次性 emit 所有 tool_call_end 事件
4. PITFALLS A-03 担忧的「id 漏发 / arguments 串污染」未复现

→ Phase 3 agent loop 接口可直接消费 sse.ts emit 的 tool_call_end 事件，无需补丁。

## Fallback (D-25 类型 ②)
N/A — PASS。若未来 model 升级出现 id 漏发，再回头加 sse.ts fixture test（用本 raw-log.txt 作 fixture）。
