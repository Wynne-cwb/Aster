---
phase: 04-read-tools-agentcontrolbar
plan: "02"
subsystem: adapters
tags: [types, interface, eslint, tool-contract]
dependency_graph:
  requires: [04-01]
  provides: [ReadableQuery, ReadableResult, read-interface, TOOL-07-rule]
  affects: [04-03, 04-04, 04-05, 04-06]
tech_stack:
  added: []
  patterns: [discriminated-union, interface-first, eslint-files-override]
key_files:
  created:
    - src/agent/__fixtures__/ns-violation.ts
  modified:
    - src/adapters/DocumentAdapter.ts
    - src/adapters/PptAdapter.ts
    - src/adapters/ExcelAdapter.ts
    - src/adapters/WordAdapter.ts
    - src/adapters/DocumentAdapter.test.ts
    - src/components/ChatStream.test.tsx
    - src/components/ContextCard.test.tsx
    - src/components/SelectionPill.test.tsx
    - eslint.config.js
decisions:
  - "[04-02] ReadToolError 用 type-only 复制而非 import ToolError，防 adapter→agent 反向依赖（0-import 约束）"
  - "[04-02] Assumption A3 验证通过：no-restricted-globals 正常拦截 PowerPoint.run（成员访问的基础标识符），无需改用 no-restricted-syntax"
  - "[04-02] ns-violation.ts fixture 不加 ignores，日常 lint src/agent 时会拦截 fixture，证明 rule 真生效；CI grep -v __fixtures__ 可过滤统计摘要"
metrics:
  duration: "7 minutes"
  completed: "2026-05-29"
  tasks_completed: 2
  files_changed: 9
---

# Phase 4 Plan 02: ReadableQuery/ReadableResult 契约类型 + TOOL-07 lint rule Summary

建立整个 Phase 4 read tool 的契约前提：DocumentAdapter 接口第 5 方法 `read(query: ReadableQuery): Promise<ReadableResult>`（12 种 kind 覆盖三宿主），以及 TOOL-07 ESLint rule 在编译期阻止 Office namespace 泄漏到 agent/store 层。

## What Was Built

### Task 1: ReadableQuery / ReadableResult 类型 + read() 接口方法（TOOL-01）

在 `src/adapters/DocumentAdapter.ts` 新增（0 运行时 import 约束全程保持）：

- `ReadableQuery`：12 变体 discriminated union（判别字段 `kind`），与 SelectionContext 同款风格
  - 跨宿主：`selection_detail`
  - PPT（4 种）：`list_slides` / `get_slide` / `list_shapes_on_slide` / `get_shape`
  - Excel（3 种）：`list_worksheets` / `get_range_values` / `get_used_range_summary`
  - Word（4 种）：`get_paragraph_count` / `get_paragraph_at` / `get_document_outline` / `get_document_full_text`
- `ReadToolError`：与 `ToolError` 形态对齐（type-only 复制，防反向依赖）
- `ReadableResult = { ok: true; data: unknown } | { ok: false; error: ReadToolError }`
- `DocumentAdapter` 接口第 5 方法：`read(query: ReadableQuery): Promise<ReadableResult>`

### Task 2: TOOL-07 Office namespace eslint rule（新建 + 冒烟 fixture）

- `eslint.config.js` 末尾追加独立 `files-override` block：禁止 `PowerPoint`/`Excel`/`Word` 全局命名空间出现在 `src/agent/**` 与 `src/store/**`
- `src/adapters/*Adapter.ts` 不在 `files` 匹配内，天然不受限（合法使用）
- `src/agent/__fixtures__/ns-violation.ts`：冒烟 fixture，故意违例，验证 rule 真生效
- Assumption A3 验证：`no-restricted-globals` 正常拦截 `PowerPoint.run`（无需改 `no-restricted-syntax`）

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: ReadableQuery types + read() | `6bb103c` | DocumentAdapter.ts + 3 Adapter stubs + 4 test files |
| Task 2: TOOL-07 eslint rule | `4d14f92` | eslint.config.js + ns-violation.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Adapter 类缺 read() stub 实现**
- **Found during:** Task 1 (tsc --noEmit 检查)
- **Issue:** 新增 `read()` 接口方法后，三个现有 Adapter 类（PptAdapter/ExcelAdapter/WordAdapter）和多个测试文件的 mock stub 未实现此方法，导致 tsc TS2420/TS2741 错误
- **Fix:** 在 PptAdapter/ExcelAdapter/WordAdapter 各加 `read()` stub（返回 `{ ok: false, error: { code: 'UNSUPPORTED' } }`），Plan 04-03/04/05 补充真实实现；更新 DocumentAdapter.test.ts 和三个组件测试文件的 mock stub
- **Files modified:** src/adapters/PptAdapter.ts, ExcelAdapter.ts, WordAdapter.ts, DocumentAdapter.test.ts, ChatStream.test.tsx, ContextCard.test.tsx, SelectionPill.test.tsx
- **Commit:** `6bb103c`（与 Task 1 合并）

## Verification Results

- `npx tsc --noEmit`: TypeScript compilation completed (0 errors)
- `npm run test -- --run`: 322 passed, 1 failed (loop.test.ts — pre-existing failure, not introduced here)
- `npm run build`: build in 1.19s, main bundle 76.36 KB gzipped (< 80KB budget)
- TOOL-07 lint smoke: fixture correctly flagged; real agent/store code clean; adapter excluded

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| src/adapters/PptAdapter.ts | `read()` returns `UNSUPPORTED` | Plan 04-04 实现真实 PPT read |
| src/adapters/ExcelAdapter.ts | `read()` returns `UNSUPPORTED` | Plan 04-05 实现真实 Excel read |
| src/adapters/WordAdapter.ts | `read()` returns `UNSUPPORTED` | Plan 04-03 实现真实 Word read |

以上 stub 是预期设计（interface-first）：接口契约先于实现。Plan 03/04/05 会用 switch 填实。

## Threat Flags

无新的 trust boundary surface 引入。TOOL-07 rule 是现有 T-04-04 威胁的编译期缓解措施。

## Self-Check: PASSED

- `src/adapters/DocumentAdapter.ts` 存在，含 ReadableQuery 12 变体 ✓
- `src/agent/__fixtures__/ns-violation.ts` 存在 ✓
- commit `6bb103c` 存在 ✓
- commit `4d14f92` 存在 ✓
- tsc 无新错误 ✓
- 测试无新失败 ✓
- build 通过，bundle 在预算内 ✓
