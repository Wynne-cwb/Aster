---
phase: "02"
plan: "04"
subsystem: providers
tags: [llm-client, streaming, retry, queue, aihubmix, openai-compat]
dependency_graph:
  requires:
    - "02-01"  # src/errors/index.ts
    - "02-02"  # src/lib/sse.ts (streamSSE, mapHttpError)
    - "02-03"  # src/providers/types.ts (LLMProvider, LLMConfig, ChatMessage)
  provides:
    - "OpenAICompatibleLLM.streamChat (src/providers/openai-compat.ts)"
    - "AihubmixVisionClient.analyze (src/providers/aihubmix-vision.ts)"
    - "AihubmixImageClient.generate (src/providers/aihubmix-image.ts)"
    - "singleFlight, setupVisibilityAbort (src/providers/queue.ts)"
    - "withRetry (src/providers/retry.ts)"
  affects:
    - "02-05"  # chatStore.sendMessage 使用 OpenAICompatibleLLM + setupVisibilityAbort
tech_stack:
  added: []
  patterns:
    - "TDD RED/GREEN: 测试文件先写，实现文件后写"
    - "模块级 Map<string, Promise<void>> 实现单飞队列"
    - "指数退避 + Retry-After header 尊重"
    - "billing 类错误不重试（KeyInvalidError/QuotaExceededError/ImageQuotaError）"
    - "AbortError 静默处理（用户停止或 Task Pane 隐藏）"
    - "apiKey 仅进 Authorization header，不进请求体 JSON（T-01-04）"
key_files:
  created:
    - src/providers/queue.ts
    - src/providers/retry.ts
    - src/providers/openai-compat.ts
    - src/providers/aihubmix-vision.ts
    - src/providers/aihubmix-image.ts
    - src/providers/queue.test.ts
    - src/providers/retry.test.ts
    - src/providers/providers.test.ts
  modified: []
decisions:
  - "setupVisibilityAbort 放在 queue.ts 而非 openai-compat.ts：openai-compat 只接受 AbortSignal，chatStore (02-05) 持有 AbortController，职责分离避免循环依赖"
  - "withRetry 包裹在 singleFlight 内部：429 重试等待发生在队列内，不阻塞其他 Provider 的请求"
  - "aihubmix-vision 不走 streamSSE（非流式）：视觉请求用普通 fetch + JSON 响应，无需 SSE 解析器"
  - "providers.test.ts 使用 stub global fetch 而非 vi.mock sse 模块：避免 Vitest ESM 模块 mock 的 require 兼容性问题"
metrics:
  duration: "约 15 分钟"
  completed_date: "2026-05-27"
  tasks_completed: 2
  files_created: 8
---

# Phase 02 Plan 04: Provider 客户端实现 Summary

**一句话总结：** OpenAICompatibleLLM（singleFlight + withRetry + streamSSE）、AihubmixVisionClient（gpt-4o，非流式）、AihubmixImageClient（gpt-image-1，input_tokens/output_tokens）三个客户端，配合单飞队列和指数退避基础设施，完整覆盖 PROV-02/03/07/09 需求。

## 交付内容

### 核心实现文件

| 文件 | 职责 | 关键接口 |
|------|------|---------|
| `src/providers/openai-compat.ts` | DeepSeek + 自定义 Provider 通用 LLM 客户端，实现 LLMProvider 接口 | `OpenAICompatibleLLM.streamChat(messages, config, signal): AsyncGenerator<SSEEvent>` |
| `src/providers/aihubmix-vision.ts` | aihubmix 视觉分析客户端，POST /chat/completions，非流式 | `AihubmixVisionClient.analyze(userText, imageBase64, mimeType, config): Promise<VisionResult>` |
| `src/providers/aihubmix-image.ts` | aihubmix 图像生成客户端，POST /images/generations | `AihubmixImageClient.generate(prompt, size, quality, config): Promise<ImageGenResult>` |
| `src/providers/queue.ts` | 单飞队列 + visibilitychange abort | `singleFlight<T>(providerId, fn): Promise<T>` / `setupVisibilityAbort(controller): () => void` |
| `src/providers/retry.ts` | 指数退避重试 | `withRetry<T>(fn): Promise<T>` |

### 职责说明

**singleFlight**：模块级 `Map<string, Promise<void>>` 维护同 Provider 的"飞行中"状态。相同 `providerId` 的第二个请求等第一个完成后才发（排队，非去重）。是「排队」而非「去重」——第二个请求等第一个完成后发新请求。

**setupVisibilityAbort**：Task Pane 隐藏时触发 `controller.abort()`，防止后台 LLM 调用继续耗费用户 token。设计在 `queue.ts` 而不在 `openai-compat.ts` 的原因：`openai-compat` 只接受 `AbortSignal`，不持有 `AbortController`；让 `chatStore`（02-05）调用 `setupVisibilityAbort` 避免循环依赖。

**withRetry**：最多重试 3 次，初始延时 1s，指数翻倍，上限 30s，加 ±10% jitter。`RateLimitError.retryAfterSeconds` 存在时优先遵守。billing 类错误（`KeyInvalidError` / `QuotaExceededError` / `ImageQuotaError`）立即抛出，绝不重试。

### setupVisibilityAbort 在 store 层调用的设计原因

`openai-compat.ts` 只接受 `AbortSignal`（而非 `AbortController`），因此不能调用 `setupVisibilityAbort`。将 `setupVisibilityAbort` 放在 `chatStore.sendMessage`（02-05）中调用：
1. 避免 `openai-compat` 依赖 DOM API（关注点分离）
2. `chatStore` 持有 `AbortController`，负责请求生命周期管理
3. 无循环依赖：`queue.ts` → 无依赖；`openai-compat.ts` → `queue.ts`；`chatStore` → `openai-compat.ts` + `queue.ts`

### 测试覆盖

| 测试文件 | 测试数 | 覆盖内容 |
|---------|------|---------|
| `queue.test.ts` | 9 | singleFlight 串行化/并发/错误恢复；setupVisibilityAbort 监听器注册/触发/cleanup |
| `retry.test.ts` | 9 | RateLimitError 最多 3 次；Retry-After 尊重；NetworkError 重试；billing 类不重试；成功直返 |
| `providers.test.ts` | 8 | AihubmixVisionClient 请求体结构 + apiKey 不进 body；AihubmixImageClient input_tokens 解析；OpenAICompatibleLLM singleFlight 路径 + AbortError 静默 |

**总计：26 个新测试，全绿。整体 162 个测试全通过（基线 136 + 新增 26）。**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 测试文件 `providers.test.ts` vi.mock 模式调整**

- **Found during:** Task 2 GREEN 阶段
- **Issue:** 初始 `vi.mock('../lib/sse', () => ({ mapHttpError: vi.fn(...require('../errors')...) }))` 在 ESM 模块环境下 `require` 不可用，导致 `mapHttpError` mock 抛出 `Cannot find module '../errors'`
- **Fix:** 改用 `stub global fetch` 策略测试 aihubmix 客户端（直接控制 fetch 响应），用 `importActual` 保留真实 `mapHttpError`；对 openai-compat 测试同样用 stub fetch（返回有效 SSE 流）而非 mock sse 模块
- **Files modified:** `src/providers/providers.test.ts`
- **Commit:** c3c29ba

**2. [Rule 1 - Bug] AbortError 测试使用 `Error.name='AbortError'` 而非 `DOMException`**

- **Found during:** Task 2 GREEN 阶段
- **Issue:** 在 Vitest 的 jsdom 环境中，`DOMException` 通过 mock generator `throw` 抛出后，某些路径检测有不一致性
- **Fix:** 改用 `const err = new Error('aborted'); err.name = 'AbortError'` — openai-compat 的检测条件 `e instanceof Error && e.name === 'AbortError'` 对此完全兼容
- **Files modified:** `src/providers/providers.test.ts`
- **Commit:** c3c29ba

## Self-Check

验证文件存在：
- src/providers/queue.ts — FOUND
- src/providers/retry.ts — FOUND
- src/providers/openai-compat.ts — FOUND
- src/providers/aihubmix-vision.ts — FOUND
- src/providers/aihubmix-image.ts — FOUND
- src/providers/queue.test.ts — FOUND
- src/providers/retry.test.ts — FOUND
- src/providers/providers.test.ts — FOUND

验证 commits：
- Task 1: 1995556 (feat(02-04): 实现单飞队列...)
- Task 2: c3c29ba (feat(02-04): 实现三个 Provider 客户端...)

测试结果：162 passed，0 failed

## Self-Check: PASSED
