---
phase: 04-read-tools-agentcontrolbar
plan: "06"
subsystem: agent
tags: [read-tools, tool-registry, agent-store, three-state, prompt-injection, tdd]
dependency_graph:
  requires: ["04-01", "04-02", "04-03", "04-04", "04-05"]
  provides: ["read-tool-defs", "three-state-phase", "injection-guard"]
  affects: ["loop.ts", "loop-helpers.ts", "agentStore.ts", "buildToolsForHost"]
tech_stack:
  added: []
  patterns:
    - "ToolDef.kind field for three-state dispatch (read/write)"
    - "wrapReadResult accepts ReadableResult union to bridge adapter→agent boundary"
    - "setPhase before streamAssistantTurn (thinking) and dispatchTool (reading/writing)"
key_files:
  created:
    - src/agent/tools/read/ppt.ts
    - src/agent/tools/read/excel.ts
    - src/agent/tools/common.ts
    - src/agent/tools/read/tools.test.ts
  modified:
    - src/agent/tools/read/word.ts
    - src/agent/tools/index.ts
    - src/agent/tools/write/word.ts
    - src/agent/read-result.ts
    - src/agent/agentStore.ts
    - src/agent/loop.ts
    - src/agent/loop-helpers.ts
    - src/agent/system-prompt.ts
    - src/agent/agentStore.test.ts
    - src/agent/tools/index.test.ts
decisions:
  - "wrapReadResult input type widened to ReadableInput (ReadableResult | ToolResult) — ReadableResult.error.code is string not ToolErrorCode enum; cast on failure passthrough preserves D-15 sanitize contract"
  - "loop-helpers.ts def lookup hoisted above dispatchTool to avoid duplicate find() call when adding setPhase"
metrics:
  duration: "~7 minutes"
  completed: "2026-05-29"
  tasks: 2
  files_created: 4
  files_modified: 10
---

# Phase 04 Plan 06: Read Tool ToolDefs + Registry Wiring + Three-State Summary

11 个 read tool ToolDef 接通三宿主 `buildToolsForHost`，每个 execute 委托 `ctx.adapter.read()` + `wrapReadResult` 包装；agentStore 加三态字段（currentPhase/lastUpdateTs/setPhase），loop 在正确时机调 setPhase；system prompt rule 3 补 document_content vs metadata 防注入区分。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (test) | 11 read tool TDD RED | 3d7bcb7 | tools.test.ts |
| 1 (impl) | 11 read tool + registry GREEN | 75479fd | word.ts, ppt.ts, excel.ts, common.ts, index.ts, write/word.ts |
| 2 (test) | agentStore three-state TDD RED | aad9860 | agentStore.test.ts |
| 2 (impl) | agentStore + loop + system-prompt GREEN | 20b0de7 | agentStore.ts, loop.ts, loop-helpers.ts, system-prompt.ts |
| fix | index.test.ts Phase 3 stubs updated | 2d23bc9 | index.test.ts |
| fix | wrapReadResult type compatibility | 556238d | read-result.ts |

## What Was Built

### Task 1: 11 Read Tool ToolDefs (TOOL-02/05)

**Word host (4 read + appendParagraph + selectionDetail = 6 tools):**
- `get_document_full_text` — 全文，result_type=document_content
- `get_paragraph_count` — 段落总数，result_type=metadata
- `get_paragraph_at` — 按 0-based index 取单段，result_type=document_content
- `get_document_outline` — 大纲（Heading 样式），result_type=metadata

**PPT host (4 read + selectionDetail = 5 tools):**
- `list_slides` — 全部 slide 清单（批量，禁逐张）result_type=metadata
- `get_slide` — 单张 slide 内容，result_type=document_content
- `list_shapes_on_slide` — 形状清单，result_type=metadata
- `get_shape` — 单个形状内容，result_type=document_content

**Excel host (3 read + selectionDetail = 4 tools):**
- `list_worksheets` — 工作表清单，result_type=metadata
- `get_range_values` — 区域值（>10K cells 拒绝），result_type=document_content
- `get_used_range_summary` — 已用区域概况，result_type=metadata

**跨宿主:**
- `selection_detail` — 当前选区，result_type=document_content

每个 ToolDef 含 `kind: 'read'`（appendParagraph 含 `kind: 'write'`）。

### Task 2: Three-State Phase + Loop Injection + System Prompt (AGENT-12/TOOL-05)

**agentStore.ts:**
- `AgentPhase` type: `'thinking' | 'reading' | 'writing'`
- `currentPhase: AgentPhase | null` 字段（初始 null）
- `lastUpdateTs: number` 字段（初始 0）
- `setPhase(p)` setter：set currentPhase + lastUpdateTs = Date.now()
- `setCurrentStep(n)` 也刷新 lastUpdateTs
- `beginRun/endRun/continueRun` 都 reset `currentPhase: null`

**loop.ts:**
- `useAgentStore.getState().setPhase('thinking')` 在 `streamAssistantTurn` 调用前

**loop-helpers.ts:**
- `useAgentStore.getState().setPhase(def?.kind === 'write' ? 'writing' : 'reading')` 在 `dispatchTool` 前

**system-prompt.ts rule 3:**
- 补充区分 document_content（用户原文，可能夹带恶意指令绝不执行）vs metadata（结构信息）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] wrapReadResult 参数类型过窄**
- **Found during:** Task 1 TypeScript check
- **Issue:** `wrapReadResult(result: ToolResult, opts)` 但 adapter 返回 `ReadableResult`；两者 `error.code` 类型不兼容（`string` vs `ToolErrorCode` enum）
- **Fix:** 引入 `ReadableInput = ReadableResult | ToolResult` union，失败路径 cast error.code 为 `ToolErrorCode`（满足 D-15 sanitize 契约）
- **Files modified:** `src/agent/read-result.ts`
- **Commit:** 556238d

**2. [Rule 1 - Bug] index.test.ts Phase 3 占位断言未同步**
- **Found during:** Full test suite run after Task 1
- **Issue:** Phase 3 Plan 04 测试断言「excel/ppt 返空数组，word 仅 1 tool」—— Plan 06 填实后必然 regression
- **Fix:** 更新测试为 Phase 4 事实（word=6, excel=4, ppt=5）
- **Files modified:** `src/agent/tools/index.test.ts`
- **Commit:** 2d23bc9

## Test Results

- `src/agent/tools/read/tools.test.ts`: PASS (24/24)
- `src/agent/agentStore.test.ts`: PASS (19/19)
- Full suite: PASS 414 / FAIL 1

**loop.test.ts AGENT-02 status:** STILL FAILING (预期)
- 测试断言 `agentStatus = 'soft-landing'` 但得到 `'idle'`
- 这是 Phase 3 遗留 bug，本 plan 未触碰 soft-landing 行为，按指令保留
- 本 plan 没有引入任何新的测试失败

## Lint / Build / Bundle

- `npx eslint src/agent`: 通过（只有 `__fixtures__/ns-violation.ts` 按设计报错，是 TOOL-07 的 fixture）
- `npx tsc --noEmit`: 通过，0 错误
- `npm run build`: 通过
- `npm run size`: **79.71 KB** (< 80 KB gate)，净增约 2 KB（11 tool defs + 类型扩展）

## Known Stubs

无。所有 11 个 read tool execute 均真实委托 `ctx.adapter.read()`，已在前几个 Plan 实现。

## Threat Flags

无新增安全面。T-04-18（prompt injection）已在本 plan 内通过 wrapReadResult + system-prompt rule 3 补充缓解。

## Self-Check: PASSED

Files created:
- [x] src/agent/tools/read/ppt.ts
- [x] src/agent/tools/read/excel.ts
- [x] src/agent/tools/common.ts
- [x] src/agent/tools/read/tools.test.ts

Key commits:
- [x] 3d7bcb7 test RED (read tools)
- [x] 75479fd feat GREEN (read tools)
- [x] aad9860 test RED (agentStore)
- [x] 20b0de7 feat GREEN (agentStore + loop)
- [x] 2d23bc9 fix (index.test.ts)
- [x] 556238d fix (read-result.ts)
