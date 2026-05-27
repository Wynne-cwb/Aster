---
phase: 02-provider-settings-onboarding-ux
plan: "02"
subsystem: api
tags: [sse, streaming, localstorage, office-js, fetch, readablestream, deepseek]

requires:
  - phase: 02-01
    provides: "AsterError 错误类层级（8 个子类），包括 RateLimitError / ContentFilterError / ModelNotFoundError / ImageQuotaError"

provides:
  - "streamSSE 异步生成器：原生 fetch + ReadableStream SSE 解析，yield SSEDelta / SSEUsage"
  - "mapHttpError：8 类 HTTP 状态 → AsterError 子类映射（401/402/404/422/400/429/503 + 兜底）"
  - "storage 工具：partitioned localStorage get/set/remove + partitionKey 前缀逻辑"
  - "STORAGE_KEYS 常量：5 个键名（PROVIDERS / KEY_PREFIX / ONBOARDING_SEEN / SELECTION_AUTO_ATTACH / DEFAULT_PROVIDER）"

affects:
  - src/providers/openai-compat.ts（Wave 2，import streamSSE）
  - src/store/providers.ts（Wave 3，import storage）
  - src/providers/registry.ts
  - 所有 LLM 调用路径

tech-stack:
  added: []
  patterns:
    - "SSE 解析：native fetch + ReadableStream，无 SDK，stream_options.include_usage 内部注入"
    - "Storage 隔离：所有 localStorage 访问经 storage.ts，prefixedKey 确保 partitionKey 前缀"
    - "apiKey 安全：从 body 副本提取到 Authorization header，请求体 JSON 不含 apiKey（T-02-04）"
    - "错误映射：mapHttpError 固定中文 message，不插入凭证变量（T-02-05）"

key-files:
  created:
    - src/lib/sse.ts
    - src/lib/sse.test.ts
    - src/lib/storage.ts
    - src/lib/storage.test.ts

key-decisions:
  - "streamSSE 内部注入 stream_options.include_usage:true，调用方无需传入（避免遗漏导致 0 token 徽章）"
  - "apiKey 从 body 副本提取，注入 Authorization header，发送的 JSON 不含 apiKey（T-02-04）"
  - "storage.ts 安全 fallback：Office 未定义时直接用 rawKey，兼容测试环境"
  - "mapHttpError 400/422 都检查 content_policy/filter 关键词，兜底走对应类"

patterns-established:
  - "SSE 流解析模式：buf 累加 + split('\\n') + pop() 残留，startsWith('data:') 过滤，[DONE] 触发 return"
  - "localStorage 访问模式：所有访问经 storage.ts，其他文件禁止直接调用 localStorage.*"
  - "错误隔离模式：mapHttpError message 使用固定字符串，不插入用户提供的任何变量"

requirements-completed: [PROV-06, PROV-08, KEY-01, KEY-05, NFR-03]

duration: 25min
completed: 2026-05-27
---

# Phase 2 Plan 02: SSE 解析器 + partitioned localStorage Storage 工具

**原生 fetch + ReadableStream 的 SSE 流式解析器（streamSSE + mapHttpError），以及 Office.context.partitionKey 隔离的 localStorage 工具（storage + STORAGE_KEYS），共 33 个测试全绿**

## Performance

- **Duration:** 25 min
- **Started:** 2026-05-27T15:19:28Z
- **Completed:** 2026-05-27T15:44:00Z
- **Tasks:** 2（各含 RED + GREEN 两阶段）
- **Files modified:** 4

## Accomplishments

- `src/lib/sse.ts`：40 行左右原生 fetch + ReadableStream SSE 解析器，服务 Phase 2+ 所有 LLM 流式调用
- `src/lib/storage.ts`：partitionKey 前缀工具 + STORAGE_KEYS 常量，统一 localStorage 访问入口
- 两个测试文件：33 个新测试覆盖全部核心行为，加上基线 82 个共 115 个测试全绿
- 安全约束全部落地：apiKey 不进请求体 JSON（T-02-04），message 不含凭证（T-02-05），localStorage 访问独占 storage.ts

## Task Commits

TDD 模式，每个任务含 RED（测试）和 GREEN（实现）两次提交：

1. **Task 1 RED: SSE 解析器失败测试** - `33c0a63` (test)
2. **Task 1 GREEN: SSE 解析器实现** - `080d1f7` (feat)
3. **Task 2 RED: Storage 工具失败测试** - `1f210cf` (test)
4. **Task 2 GREEN: Storage 工具实现** - `32ac0f7` (feat)

## Files Created/Modified

- `src/lib/sse.ts` — streamSSE 异步生成器 + mapHttpError 8 类错误映射
- `src/lib/sse.test.ts` — 18 个测试（正常流/keep-alive/abort/401/stream_options/apiKey 安全）
- `src/lib/storage.ts` — partitioned localStorage 工具 + STORAGE_KEYS 常量
- `src/lib/storage.test.ts` — 15 个测试（partitionKey 有值/无值/Office 未定义 + 常量完整性）

## streamSSE 类型签名

```typescript
export interface SSEDelta { type: 'delta'; content: string; }
export interface SSEUsage { type: 'usage'; promptTokens: number; completionTokens: number; totalTokens: number; }
export type SSEEvent = SSEDelta | SSEUsage;

export async function* streamSSE(
  url: string,
  body: object,     // 含 apiKey / model / messages 等；apiKey 内部提取，不进请求体
  signal: AbortSignal,
): AsyncGenerator<SSEEvent>
```

## mapHttpError 覆盖的 HTTP 状态

| 状态 | 错误类 | 备注 |
|------|--------|------|
| 401 | `KeyInvalidError` | billing 类，不重试 |
| 402 | `QuotaExceededError` | billing 类，不重试 |
| 404 | `ModelNotFoundError` | — |
| 422 | `ContextTooLongError` / `ContentFilterError` | 含 content_policy/filter 关键词时走 ContentFilterError |
| 400 | `ContentFilterError` / `NetworkError` | 同上 |
| 429 | `RateLimitError(retryAfterSeconds?)` | retryAfterSeconds 来自 Retry-After header |
| 503 | `NetworkError` | 可重试 |
| 其他 | `NetworkError` | 兜底 |

## STORAGE_KEYS 键名列表

| 常量 | 值 | 用途 |
|------|----|------|
| `PROVIDERS` | `aster:providers` | Provider 配置列表 |
| `KEY_PREFIX` | `aster:keys:` | API Key 前缀（+ providerId） |
| `ONBOARDING_SEEN` | `aster:onboarding:seen` | Onboarding 已看标记 |
| `SELECTION_AUTO_ATTACH` | `aster:selection:autoAttach` | 选区自动附带开关 |
| `DEFAULT_PROVIDER` | `aster:providers:default` | 默认 Provider ID |

## 测试覆盖

- **sse.test.ts：** 18 个测试（streamSSE 6 个 + mapHttpError 12 个）
- **storage.test.ts：** 15 个测试（partitionKey 有值 5 个 + 无值 3 个 + Office 未定义 1 个 + STORAGE_KEYS 6 个）
- **全套回归：** 115 个测试全绿（基线 82 + 新增 33）

## Decisions Made

- `streamSSE` 内部强制注入 `stream_options: { include_usage: true }`，调用方不需关心，防止遗漏导致成本徽章永远 0 token
- `apiKey` 在 `streamSSE` 内从 body 副本提取，发送的请求体 JSON 不含 `apiKey` 字段（对应威胁 T-02-04）
- `storage.ts` 容忍 `Office` 未定义（测试环境），直接使用 rawKey；生产环境 Office.onReady 后才调用，安全
- `mapHttpError` 的 400 和 422 都检查 `content_policy`/`filter` 关键词，因 DeepSeek 内容过滤的具体状态码未在官方文档明确

## Deviations from Plan

无 — 计划按规格执行，两个任务均采用 TDD 流程（RED → GREEN），无需 REFACTOR 阶段。

## Issues Encountered

RTK 代理缓存导致 `npx vitest run` 的输出显示旧日志；改用 `node node_modules/vitest/vitest.mjs run` 直接调用绕过。非代码问题，不影响实现。

## Threat Surface Scan

本 plan 创建的两个工具文件：
- `sse.ts`：向 Provider API 发送 HTTP 请求（已有威胁模型覆盖 T-02-04/T-02-05）
- `storage.ts`：读写 localStorage（已有威胁模型覆盖 T-02-06/T-02-08）

无超出计划 `<threat_model>` 范围的新信任边界或安全面。

## Next Phase Readiness

- Wave 2（02-03 / 02-04）可直接 `import { streamSSE } from '../lib/sse'` 和 `import { storage, STORAGE_KEYS } from '../lib/storage'`
- `mapHttpError` 与 `RateLimitError.retryAfterSeconds` 已为 Wave 3 的指数退避（PROV-09）做好接口准备
- 无阻塞项

---
*Phase: 02-provider-settings-onboarding-ux*
*Completed: 2026-05-27*
