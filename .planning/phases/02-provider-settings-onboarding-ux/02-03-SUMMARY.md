---
phase: 02-provider-settings-onboarding-ux
plan: "03"
subsystem: providers
tags:
  - provider-registry
  - pricing
  - types
  - tdd
dependency_graph:
  requires:
    - "02-01: src/errors/index.ts (ModelNotFoundError, KeyInvalidError)"
    - "02-02: src/lib/sse.ts (SSEEvent), src/lib/storage.ts (storage, STORAGE_KEYS)"
  provides:
    - "src/providers/types.ts: TaskKind, LLMConfig, ImageConfig, LLMProvider, ImageProvider, StockImageProvider, ProviderConfig"
    - "src/providers/registry.ts: ProviderRegistry.resolve(taskKind, getDefaultLLM)"
    - "src/providers/pricing.ts: calcCostCny, CNY_PER_USD"
  affects:
    - "02-04: src/providers/openai-compat.ts — implements LLMProvider"
    - "02-05: src/store/chat.ts — ProviderRegistry.resolve('chat')"
    - "02-06: src/components/CostBadge.tsx — calcCostCny(usage, providerId)"
tech_stack:
  added:
    - "src/providers/types.ts (新文件，纯类型)"
    - "src/providers/registry.ts (新文件，ProviderRegistry 类)"
    - "src/providers/pricing.ts (新文件，calcCostCny 函数)"
    - "src/providers/registry.test.ts (新文件，12 个测试)"
    - "src/providers/pricing.test.ts (新文件，9 个测试)"
  patterns:
    - "依赖注入替代直接 import store（getDefaultLLM 函数参数，避免循环依赖）"
    - "TDD RED→GREEN 流程（测试先行）"
    - "exhaustive switch + never 类型守卫（TaskKind 全覆盖）"
key_files:
  created:
    - src/providers/types.ts
    - src/providers/registry.ts
    - src/providers/pricing.ts
    - src/providers/registry.test.ts
    - src/providers/pricing.test.ts
decisions:
  - "ProviderRegistry.resolve 用函数注入 getDefaultLLM，避免 store 循环依赖"
  - "apiKey 空字符串（''）与 null 均视为未配置，统一抛 KeyInvalidError（T-02-12 安全约束）"
  - "ImageConfig 与 LLMConfig 保持字段同构，便于泛型处理（虽然当前 v1 分别使用）"
metrics:
  duration: "约 15 分钟"
  completed: "2026-05-27T15:30:31Z"
  tasks_completed: 2
  files_created: 5
  tests_added: 21
  tests_total: 136
---

# Phase 02 Plan 03: Provider 接口契约 + 路由 + 定价 Summary

**一句话总结：** TypeScript 纯类型契约（types.ts）+ 依赖注入 ProviderRegistry 路由（registry.ts）+ DeepSeek 人民币成本计算（pricing.ts），TDD 全覆盖 21 个测试。

## 完成内容

### Task 1: src/providers/types.ts（PROV-01）

纯类型文件（0 运行时 import），定义整个 Provider 层的接口契约：

- **TaskKind**：`'chat' | 'short-task' | 'vision' | 'image-gen' | 'stock-image'`（5 个字面量）
- **LLMConfig / ImageConfig**：Provider 客户端运行时配置（providerId / baseURL / apiKey / model）
- **LLMProvider / ImageProvider / StockImageProvider**：三个 Provider 接口
- **ChatMessage**：OpenAI-compatible 消息格式
- **ProviderConfig**：用户存储的 Provider 配置（不含 apiKey）

commit: `c469bc6`

### Task 2: registry.ts + pricing.ts + 测试（PROV-04 / COST-01 / COST-02）

**registry.ts — ProviderRegistry.resolve()**

路由规则（无 fallback，PROV-04）：

| taskKind | 路由目标 | 结果类型 |
|---|---|---|
| chat / short-task | getDefaultLLM() → storage 读 Key | LLMConfig |
| vision | aihubmix-vision，model=gpt-4o | ImageConfig |
| image-gen | aihubmix-image，model=gpt-image-1 | ImageConfig |
| stock-image | 无配置 → ModelNotFoundError | — |
| 未知 | exhaustive never → ModelNotFoundError | — |

内置常量：
- `AIHUBMIX_BASE_URL = 'https://api.aihubmix.com/v1'`
- `AIHUBMIX_VISION_MODEL = 'gpt-4o'`
- `AIHUBMIX_IMAGE_MODEL = 'gpt-image-1'`

**pricing.ts — calcCostCny()**

- `CNY_PER_USD = 7.25`（固定汇率，D-17）
- `deepseek-v4-flash`：$0.14/$0.28 per 1M tokens
- `deepseek-v4-pro`：$1.74/$3.48 per 1M tokens
- 自定义 Provider → 返回 `null`（不显示价格，COST-02）

TDD commits: RED `bf907cd` → GREEN `6cafe92`

## 测试结果

```
Tests: 21 new, 136 total (0 failed)
TypeScript: 0 errors
```

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

- RED gate commit: `bf907cd` — `test(02-03): 添加 ProviderRegistry 和 pricing 失败测试`
- GREEN gate commit: `6cafe92` — `feat(02-03): 实现 ProviderRegistry 路由和 calcCostCny 定价`
- REFACTOR: 不需要（代码已足够清晰）

## Known Stubs

None — 本计划为纯逻辑层（types + routing + pricing），无 UI 组件，无 stub。

## Threat Flags

无新增 security surface（本计划为纯内部路由逻辑，无新网络端点、无新 auth 路径）。

apiKey 安全已在实现中处理（T-02-09 / T-02-12）：
- apiKey 从 storage 读取后仅存在内存对象中，不序列化到日志
- KeyInvalidError message 只说明状态，不含 Key 原文

## Self-Check: PASSED

- [x] `src/providers/types.ts` 存在
- [x] `src/providers/registry.ts` 存在
- [x] `src/providers/pricing.ts` 存在
- [x] `src/providers/registry.test.ts` 存在
- [x] `src/providers/pricing.test.ts` 存在
- [x] commit `c469bc6` 存在（Task 1）
- [x] commit `bf907cd` 存在（TDD RED）
- [x] commit `6cafe92` 存在（TDD GREEN）
- [x] 136 tests passed (0 failed)
