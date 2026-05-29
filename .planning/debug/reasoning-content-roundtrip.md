---
slug: reasoning-content-roundtrip
status: fix-applied-pending-uat
trigger: "Phase 4 真机 UAT 阻塞 Bug — DeepSeek V4 thinking 模式下，带 tool 结果发起的第二轮 chat/completions 返回 400：'The reasoning_content in the thinking mode must be passed back to the API.' 已 curl 实证：回传 reasoning_content 后变 200。"
created: "2026-05-29"
updated: "2026-05-29"
phase: 04-read-tools-agentcontrolbar
---

# Debug Session: reasoning-content-roundtrip

## Symptoms

- **Expected behavior**: 多步 tool-calling（read 链路）应连续跑通——首轮 LLM 发起 tool_call，喂回 tool 结果后第二轮 LLM 继续，直到给出最终答复。UAT SC1/SC2 全部依赖此能力。
- **Actual behavior**: 首轮成功（LLM 回文本 + 发起 list_slides），喂回 tool 结果的**第二轮** chat/completions 请求返回 **HTTP 400**，多步 read 链路在真机崩溃；折叠卡显示 list_slides 失败。
- **Error message**: `{"error":{"message":"The \`reasoning_content\` in the thinking mode must be passed back to the API.","type":"invalid_request_error","code":"invalid_request_error"}}`
- **Timeline**: Phase 4 真机 UAT（2026-05-29）首次以真实 DeepSeek-V4 端到端跑多步 tool calling 时暴露。单测 mock 了 SSE，从未跑过真实 thinking-mode 往返，故此前全绿。
- **Reproduction**: DeepSeek `deepseek-v4-flash`，messages 含 `assistant{content,tool_calls}` + `role:tool` 结果，再次 POST `https://api.deepseek.com/chat/completions`。curl 实测：assistant 消息**不带** reasoning_content → 400；**带** reasoning_content（任意非空字符串）→ 200。

## Root Cause (pre-identified, curl-proven)

Aster 全链路未处理 DeepSeek thinking 模式的 `reasoning_content`：
- `src/lib/sse.ts`：`streamSSE` 解析 chunk 时只读 `delta.content` 与 `delta.tool_calls`，**丢弃 `delta.reasoning_content`**；`SSEEvent` 联合类型无 reasoning 事件。
- `src/agent/loop-helpers.ts`：`WireMessage` 的 assistant 变体只有 `content` + `tool_calls`，**无 `reasoning_content` 字段**；`streamAssistantTurn`（约 87-95 行）重建并 push assistant 消息时不带 reasoning_content。

后果：发回下一轮请求时 assistant 消息缺 reasoning_content → DeepSeek 400。

## Proposed Fix Direction

1. `src/lib/sse.ts` — 解析 `delta.reasoning_content`，新增事件（如 `{type:'reasoning_delta', content}`）yield 出来；加入 `SSEEvent` 联合类型。
2. `src/agent/loop-helpers.ts` — `WireMessage` assistant 变体加 `reasoning_content?: string`；`streamAssistantTurn` 累积 reasoning delta，并在**非空时**附到 push 的 assistant 消息（非空守卫避免影响不返回 reasoning 的 Provider，如 AiHubMix gpt-5.1/gemini）。
3. 测试守门 — 补一条「reasoning_content 往返」结构性测试（sse 解析 reasoning + loop 把它带进下一轮 wire 消息），堵住「mock SSE 漏掉真实 thinking-mode 往返」这个复发盲区。

## Resolution (2026-05-29)

- **root_cause**: Aster SSE 解析与 agent loop 重建链路完全丢弃 DeepSeek thinking 模式的 `reasoning_content`，导致带 tool 结果发起的第二轮请求里 assistant 消息缺该字段，被 DeepSeek 拒为 400（curl 实证）。
- **fix**: 让 `reasoning_content` 全链路往返——`sse.ts` 解析 `delta.reasoning_content` 并新增 `reasoning_delta` 事件 yield；`loop-helpers.ts` 给 `WireMessage` assistant 变体加 `reasoning_content?`，`streamAssistantTurn` 累积 reasoning delta 并在非空时附回下一轮 wire 消息（非空守卫保护无 reasoning 的 Provider）。

### Files changed
- `src/lib/sse.ts` — 新增 `ReasoningDelta` 接口并入 `SSEEvent` 联合；chunk 类型加 `reasoning_content?`；解析到非空 reasoning 时 `yield {type:'reasoning_delta', content}`。
- `src/agent/loop-helpers.ts` — `WireMessage` assistant 变体加 `reasoning_content?: string`；`streamAssistantTurn` 累积 `reasoningContent`，push 下一轮 assistant 消息时非空才带（`...(reasoningContent ? {reasoning_content} : {})`）。
- `src/lib/sse.test.ts` — 新增 describe「reasoning_content 解析」2 测：① 多段 reasoning_delta 累积 + content 并存 ② Provider 不返回 reasoning → 无 reasoning_delta（零影响回归）。
- `src/agent/loop-helpers.test.ts`（新建）— 2 测：① reasoning_delta + tool_call_end → 下一轮 wire assistant 带 reasoning_content + tool_calls ② 无 reasoning → 非空守卫令字段保持 undefined。

### Test gate asserts（堵复发盲区）
- 解析半边：`streamSSE` 把 `delta.reasoning_content` 解析成 `reasoning_delta` 事件；不返回 reasoning 的 Provider 不产生该事件。
- loop 半边：`streamAssistantTurn` 把流式 reasoning 累积并带进**下一轮 wire assistant 消息**的 `reasoning_content`——这是 mock SSE 此前从未覆盖的真实 thinking-mode 往返路径。

### Gate results
- `npm run test`: 444 passed / 1 failed（445）。唯一 fail = `src/agent/loop.test.ts > AGENT-02 max_steps soft landing`，**预存在、与本次无关**（stash 改动后仍同样 fail，由 retry/queue 测试泄漏 mock 污染共享 OpenAICompatibleLLM mock 导致，早于 Phase 4）。新增 sse(33)/loop-helpers(2) 全绿。
- `npm run build`: 通过。
- `npm run size`: 79.13 kB gzipped ≤ 80 kB（余量 ~0.87 kB）。

### Out of scope（未做，按 orchestrator 约束）
- 不渲染 reasoning_content 到 UI。
- 不重构周边代码。
- 未 commit / push —— orchestrator 先重跑真机 UAT（SC1/SC2），再处理 commit+push 部署。

## Verification Plan

- `npm run test` / `npm run build` / `npm run size` 全绿（size ≤ 80KB）。✅（除预存在的 AGENT-02 无关 fail）
- 真机重跑 UAT SC1（PPT read 链路中文折叠卡）、SC2（三宿主 read + A-24）全 PASS。⏳ 待 orchestrator
- 全绿后 commit + push origin main 触发 Pages 部署，收尾 Phase 4。⏳ 待 orchestrator

## Current Focus

- hypothesis: assistant 消息缺 `reasoning_content` 导致 DeepSeek thinking 模式第二轮 400（curl 已证实，fix 已落地）
- next_action: orchestrator 重跑真机 UAT SC1/SC2；通过后 commit + push 触发 Pages 部署
