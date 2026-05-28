# Spike SP-3: AiHubMix passthrough tool_calls 兼容性

**Type:** ② Claude 自跑
**Status:** PASS
**Date:** 2026-05-29
**Probe model:** `gpt-4o` (响应中 actual model = `gpt-4o-2024-11-20`)

## 验证目标
AiHubMix 作为聚合 Provider，passthrough 上游模型（gpt-4o / claude / 等）时是否完整透传 OpenAI 标准 tool_calls SSE 协议（含 `tool_calls`、`finish_reason=tool_calls`、`call_*` id 格式）。

## 探测方法
`.planning/spikes/SP-3-aihubmix-passthrough/probe.mjs`：调 `https://api.aihubmix.com/v1/chat/completions`，model=gpt-4o，定义单个 `echo` tool，user 引导调一次。

## 结果
- **Has tool_calls field:** true ✓
- **finish_reason:** `tool_calls` ✓
- **Unique tool_call_id:** 1（`call_aKEz...` OpenAI 标准格式）✓
- **Actual model:** `gpt-4o-2024-11-20`（AiHubMix 路由到具体上游版本）
- **Raw log size:** 2,586 bytes，0 个 `sk-` 残留
- raw log: 见 `raw-log.txt`

## 结论
AiHubMix gpt-4o 在 tool_calling 路径上完全 OpenAI-compatible：
1. SSE chunk 格式：`data: {"id":"chatcmpl-...","choices":[{"delta":{"tool_calls":[{...}]}}]}` ✓
2. `tool_calls[].id` 用 `call_*` 前缀（与 OpenAI 一致） ✓
3. `tool_calls[].function.{name,arguments}` 嵌套结构标准 ✓
4. finish_reason 终态正确 ✓

→ Phase 3 agent loop 同 `src/providers/openai-compat.ts` 既有路径可直接服务 AiHubMix；
   v2 demo 仅 DeepSeek 即可（AiHubMix 留作 Phase 8 多 Provider UX）。

## Fallback (D-25 类型 ②)
N/A — PASS。
- 若未来某个上游 model 在 AiHubMix 上 tool_call 格式漂移（如 Anthropic Claude 通过 AiHubMix 透传时字段不一致），按 D-25 ②：转 Phase 7 兼容矩阵 + supportsToolCall 自动探测路径已就绪（src/providers/openai-compat.ts L69-75 已有 fallback）。
