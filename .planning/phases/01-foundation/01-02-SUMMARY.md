---
phase: 01-foundation
plan: "02"
subsystem: adapters/errors
tags: [types, contracts, error-handling, tdd, discriminated-union]
dependency_graph:
  requires: []
  provides:
    - DocumentAdapter interface (跨宿主契约)
    - SelectionContext discriminated union
    - InsertableContent discriminated union
    - AdapterCapabilities interface
    - AsterError 错误类层级
  affects:
    - Phase 1 Plan 03: adapter 骨架 import DocumentAdapter
    - Phase 1 Plan 04-06: shell/ribbon import AdapterCapabilities
    - Phase 2: Provider 调用抛 KeyInvalidError/QuotaExceededError/NetworkError/ContextTooLongError
tech_stack:
  added: []
  patterns:
    - TDD (RED→GREEN per task)
    - Discriminated union with kind/type literal fields
    - Error class hierarchy with new.target.name
    - Object.setPrototypeOf for ES5 instanceof compatibility
key_files:
  created:
    - src/adapters/DocumentAdapter.ts
    - src/adapters/DocumentAdapter.test.ts
    - src/errors/index.ts
    - src/errors/index.test.ts
    - tsconfig.json
    - package.json
    - vitest.config.ts
  modified: []
decisions:
  - "SelectionContext 含 none 变体（D-16：getSelection 无选中时不抛错）"
  - "AsterError 使用 Object.setPrototypeOf 确保 ES5 target 下 instanceof 正确工作"
  - "HostApiError 带可选 hostError 字段存储原始 Office.js 错误（调试用，不暴露给用户）"
  - "vitest.config.ts 独立配置隔离 worktree 与 parent repo 的 vite.config.ts 冲突"
metrics:
  duration_minutes: 6
  completed_date: "2026-05-27T07:31:10Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 7
  files_modified: 0
  tests_added: 47
---

# Phase 1 Plan 02: Core Type Contracts Summary

**One-liner:** DocumentAdapter discriminated union 接口契约 + AsterError 6 子类错误层级，纯类型/无运行时依赖，tsc strict 通过，47 个 vitest 测试绿灯。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | DocumentAdapter 接口 + discriminated unions | b96fc2b | src/adapters/DocumentAdapter.ts |
| 2 | 类型化错误类层级 | 378b195 | src/errors/index.ts |

## What Was Built

### Task 1: DocumentAdapter 接口 + discriminated unions (b96fc2b)

**SelectionContext** — 4 变体 discriminated union（判别字段 `kind`）：
- `{ kind: 'ppt'; slideIndex: number; slideCount: number }` — PPT「第 N 张 slide」
- `{ kind: 'excel'; address: string }` — Excel「选中区域 A1:C10」
- `{ kind: 'word'; charCount: number }` — Word「选中 N 字」
- `{ kind: 'none' }` — 空态（D-16，getSelection 无选中时返回）

**InsertableContent** — 7 变体 discriminated union（判别字段 `type`）：
`text` / `paragraphs` / `bullets` / `formula` / `range-values` / `slides` / `image`

**AdapterCapabilities** — `{ supportedInserts, supportsSelectionEvents, host }`

**DocumentAdapter 接口** — `getSelection()` / `onSelectionChanged()` / `capabilities()` / `insert()`

### Task 2: 类型化错误类层级 (378b195)

**AsterError** 基类：`code: string`（readonly）+ `category: 'provider' | 'adapter'`（readonly），`new.target.name` 保证子类 name 正确，`Object.setPrototypeOf` 确保 instanceof 在 ES5 下工作。

**Provider 层**（category='provider'）：
| 类 | code | Phase 2 UX |
|-----|------|-----------|
| KeyInvalidError | KEY_INVALID | 去设置更新 Key |
| QuotaExceededError | QUOTA | 前往 Provider 充值 |
| ContextTooLongError | CONTEXT | 裁剪文件 / 切换更大 context 模型 |
| NetworkError | NETWORK | 检查网络连接后重试 |

**Adapter 层**（category='adapter'）：
| 类 | code | 用途 |
|-----|------|------|
| HostApiError | HOST_API | Office.js API 失败（带 hostError 字段） |
| UnsupportedOperationError | UNSUPPORTED | Phase 1 adapter 桩方法占位 |

## Verification Results

```
tsc --noEmit: 0 errors
vitest: 47 tests passed (2 test files)
  - DocumentAdapter.test.ts: 18 tests
  - errors/index.test.ts: 29 tests
```

所有 acceptance criteria grep 通过：
- `interface DocumentAdapter` ✓
- `onSelectionChanged` ✓
- InsertableContent type 变体 >= 7 ✓
- SelectionContext kind 变体 4 个 ✓
- `class AsterError extends Error` ✓
- `extends AsterError` 子类 >= 6 ✓
- code 字符串 6 个 ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest.config.ts 独立配置**
- **Found during:** Task 1 RED 阶段
- **Issue:** worktree 内运行 vitest 时，工具从 parent repo 加载 `/Users/wb.chen/Documents/Project/Aster/vite.config.ts`，该文件使用了 `vite-plugin-office-addin`（`officeAddin is not a function` 错误），导致测试无法启动
- **Fix:** 在 worktree 根目录创建 `vitest.config.ts` 独立配置，指定 `environment: 'node'` 和 include glob，覆盖 parent repo 的 vite.config
- **Files modified:** vitest.config.ts（新建）
- **Commit:** f500815（RED 阶段提交）

### TDD Clarification

Task 1 的 import type 语句在 vitest 运行时被擦除（TypeScript 类型导入），所以 RED 阶段通过 `tsc --noEmit` 报 `TS2307 Cannot find module` 来确认 RED 状态，而非通过 vitest 运行时失败——这是纯类型契约测试的正常模式。Task 2 的错误类测试因为是值导入，vitest 运行时直接报 `Cannot find module` 确认了 RED。

## Known Stubs

无 UI 渲染路径，本 plan 全部为纯类型/类定义，无需 stub 追踪。

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: info_disclosure | src/errors/index.ts | KeyInvalidError 等错误类 message 在 Phase 2 实例化时须遵守"禁含 Key 原文"约束（T-01-04）。已在基类注释和 KeyInvalidError 注释中标注；测试中有安全测试验证。 |

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/adapters/DocumentAdapter.ts exists | FOUND |
| src/errors/index.ts exists | FOUND |
| Commit f500815 (test RED DocumentAdapter) | FOUND |
| Commit b96fc2b (feat GREEN DocumentAdapter) | FOUND |
| Commit 5d6f9b8 (test RED errors) | FOUND |
| Commit 378b195 (feat GREEN errors) | FOUND |
| tsc --noEmit: 0 errors | PASSED |
| vitest: 47/47 tests passed | PASSED |
