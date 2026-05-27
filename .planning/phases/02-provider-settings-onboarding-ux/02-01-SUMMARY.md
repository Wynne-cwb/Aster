---
phase: 02-provider-settings-onboarding-ux
plan: "01"
subsystem: errors-icons-eslint
tags: [errors, icons, eslint, phase2-foundation, tdd]
dependency_graph:
  requires: []
  provides:
    - src/errors/index.ts (RateLimitError, ContentFilterError, ModelNotFoundError, ImageQuotaError)
    - src/components/icons.tsx (8 new Phase 2 icons)
    - eslint.config.js (PROV-10 lint rules)
  affects:
    - src/providers/openai-compat.ts (Wave 2 — imports new error classes)
    - src/lib/sse.ts (Wave 1 — imports ImageQuotaError)
tech_stack:
  added:
    - eslint@^9 (flat config)
    - "@typescript-eslint/eslint-plugin@^8"
    - "@typescript-eslint/parser@^8"
  patterns:
    - TDD RED/GREEN cycle for error class expansion
    - ESLint flat config with no-restricted-syntax + no-restricted-imports
key_files:
  created:
    - eslint.config.js
  modified:
    - src/errors/index.ts
    - src/errors/index.test.ts
    - src/components/icons.tsx
    - package.json
    - package-lock.json
decisions:
  - "ESLint 从零安装（项目此前无 ESLint），使用 flat config (eslint@^9) 对齐 Vite 7 生态"
  - "no-restricted-syntax 用正则 Literal 节点拦截 deepseek-chat/deepseek-reasoner 字面量"
  - "icons.tsx 中 StopIcon 使用 fill=currentColor stroke=none（实心方块语义）"
metrics:
  duration: "~15 min"
  completed: "2026-05-27"
  tasks_completed: 3
  files_changed: 6
  tests_before: 64
  tests_after: 82
---

# Phase 02 Plan 01: 错误类补齐 + Phase 2 图标 + ESLint 规则 Summary

**一句话总结：** 扩展错误类层级至 8 个子类（含 retryAfterSeconds 字段的 RateLimitError），新增 8 个内联 SVG 图标，并安装 ESLint 配置 PROV-10 规则阻断 legacy 模型名与 LLM SDK 导入。

## What Was Built

### Task 1: 补齐 4 个 Phase 2 错误类

文件：`src/errors/index.ts`, `src/errors/index.test.ts`

新增 4 个错误子类，全部继承 AsterError，含 T-01-04 安全约束注释（message 禁止嵌入 API Key）：

| 类名 | code | 新增字段 | HTTP 触发 |
|------|------|----------|-----------|
| RateLimitError | RATE_LIMIT | retryAfterSeconds?: number | 429 |
| ContentFilterError | FILTER | — | 400/422 content_policy |
| ModelNotFoundError | MODEL | — | 404 |
| ImageQuotaError | IMAGE_QUOTA | — | aihubmix billing 错误 |

TDD 流程：RED (18 失败) → GREEN (47 全通过)，commit: `34410ab`

### Task 2: 新增 8 个 UI 图标

文件：`src/components/icons.tsx`

新增 8 个 Lucide 风内联 SVG 图标，全部遵循 `{...base}` spread + `stroke=currentColor` 规范：

| 图标 | 用途 |
|------|------|
| StopIcon | 流式生成停止（实心方块，fill=currentColor） |
| InsertIcon | 插入到文档（PANE-04） |
| RetryIcon | 失败重试（D-11） |
| XIcon | 关闭/删除（选区胶囊 D-15） |
| AlertIcon | 错误气泡前缀（D-10） |
| PlusIcon | Settings 新增 Provider |
| TrashIcon | Settings 删除 Provider |
| CheckIcon | Onboarding 步骤完成 |

TypeScript 编译 0 错误，commit: `17e46ea`

### Task 3: ESLint 配置 PROV-10 规则

文件：`eslint.config.js`, `package.json`（新安装 ESLint）

**偏差记录 [Rule 3 - Blocking]:** 项目此前无 ESLint 安装，需先安装才能创建配置。自动安装 eslint@^9 + @typescript-eslint 插件，使用 flat config。

两条规则：
- `no-restricted-syntax`: 阻止 `deepseek-chat` / `deepseek-reasoner` 字面量（2026-07-24 已退役）
- `no-restricted-imports`: 阻止导入 `openai` / `@anthropic-ai/*` / `ai` / `@ai-sdk/*`（无后台约束，原生 fetch）

规则验证：项目内临时测试文件触发 `no-restricted-imports` 报错 ✓，`deepseek-chat` 触发 `no-restricted-syntax` 报错 ✓，commit: `d70a651`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 项目无 ESLint 安装**
- **Found during:** Task 3
- **Issue:** `eslint.config.js` 需要依赖 ESLint，但项目 `package.json` 中无 ESLint，`node_modules` 中也不存在
- **Fix:** 安装 `eslint@^9`, `@typescript-eslint/eslint-plugin@^8`, `@typescript-eslint/parser@^8` 作为 devDependencies
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** d70a651

## Test Results

```
PASS (82) FAIL (0)  ← 最终全量测试
```

- 基线：64 个测试
- Task 1 新增：18 个测试（RateLimitError/ContentFilterError/ModelNotFoundError/ImageQuotaError）
- 最终：82 个测试全部通过，0 回归

## TDD Gate Compliance

- RED gate: `test(02-01)` 写在实现前，确认 18 个测试失败
- GREEN gate: `feat(02-01)` 实现后全部 47 个错误类测试通过

## Self-Check: PASSED

- [x] src/errors/index.ts 包含 8 个错误子类（FOUND）
- [x] src/components/icons.tsx 包含 12 个图标（FOUND）
- [x] eslint.config.js 包含两条 PROV-10 规则（FOUND）
- [x] .planning/phases/02-provider-settings-onboarding-ux/02-01-SUMMARY.md（FOUND）
- [x] commit 34410ab（错误类）存在
- [x] commit 17e46ea（图标）存在
- [x] commit d70a651（ESLint）存在
- [x] vitest 82 个测试全绿
