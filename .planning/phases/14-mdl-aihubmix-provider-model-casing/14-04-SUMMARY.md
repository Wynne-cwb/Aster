---
phase: 14-mdl-aihubmix-provider-model-casing
plan: 04
subsystem: agent-tools
tags: [ppt, snake_case, casing, normalize, dispatch, test, guardian]

# Dependency graph
requires:
  - phase: 14-mdl-aihubmix-provider-model-casing
    provides: plan 02 ppt.ts 全 snake_case schema + 删除 pick* helpers

provides:
  - dispatchTool 内 PPT_TOOLS Set（12 个工具名）+ normalizeToSnakeCase helper（模块级）
  - PPT 工具入口中央 camelCase→snake_case 归一化（D-10），Word/Excel 工具透传原样（D-13）
  - dispatch.test.ts PPT casing 守门 describe 块（D-12）：8 个 PPT 工具 it.each + Word 不受影响 + position 嵌套不变

affects:
  - PPT 工具调用链（LLM → dispatchTool → ppt.ts execute）：LLM 传 camelCase 或 snake_case 均正确路由
  - v2.2 新增 PPT 工具：必须将工具名加入 PPT_TOOLS Set，否则 dispatch.test.ts 守门提醒

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PPT 工具 camelCase→snake_case 归一化：PPT_TOOLS.has(call.name) 条件 + normalizeToSnakeCase 一级 key 映射"
    - "normalizeToSnakeCase 幂等：snake_case 入参经过后不变（key.replace(/([A-Z])/g, m => '_' + m.toLowerCase()) 天然幂等）"
    - "守门用例 it.each：[工具名, camelCase 入参, 期望 snake_case] 三元组参数化"

key-files:
  created: []
  modified:
    - src/agent/tools/index.ts
    - src/agent/tools/dispatch.test.ts

key-decisions:
  - "D-10 落地：dispatchTool 内插入中央 normalize，PPT 工具入口唯一 casing 归一化点"
  - "D-13 落地：normalize 作用域严格限制 PPT_TOOLS Set，Word/Excel 工具 args 原样透传"
  - "D-12 落地：dispatch.test.ts 守门用例覆盖 8 个 PPT 工具 camelCase + snake_case 双向 + 幂等"
  - "normalizeToSnakeCase 只做一级 key（不递归），保留 position.left/font.size 等嵌套 key 完整"

patterns-established:
  - "v2.2 新增 PPT 工具：工具名加 PPT_TOOLS Set + dispatch.test.ts 守门用例同步补充"
  - "one-level normalize 范式：适用于所有嵌套 object value 需原样保留的场景"

requirements-completed:
  - MDL-03

# Metrics
duration: 4min
completed: 2026-06-01
---

# Phase 14 Plan 04: dispatchTool PPT-only normalize + casing 守门用例 Summary

**dispatchTool 入口插入 PPT_TOOLS 集合 + normalizeToSnakeCase 中央「总闸」，配合 dispatch.test.ts PPT casing 守门 describe 块，永久防止 v2.2 新增 PPT 生图工具重蹈 casing 覆辙**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-01T08:07:24Z
- **Completed:** 2026-06-01T08:11:11Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `src/agent/tools/index.ts`：模块级新增 `PPT_TOOLS` Set（12 个工具名）+ `normalizeToSnakeCase` helper（一级 key 映射，幂等）
- `dispatchTool` 内 `Promise.race` 前插入条件 normalize：`PPT_TOOLS.has(call.name)` 触发 → `normalizeToSnakeCase(call.arguments)`，否则原样透传
- `src/agent/tools/dispatch.test.ts`：追加 `describe('dispatchTool — PPT casing 归一化（D-12）')` 块，含：
  - `it.each`：8 个 PPT 工具的 camelCase→snake_case + snake_case 幂等（各两次 dispatch assert）
  - Word 工具不受 PPT normalize 影响保护用例（D-13）
  - `position` 嵌套 object key 不被 normalize 改动的 A2 风险缓解用例
- 全部 136/136 agent tools 测试通过（含新增 26 个 dispatch 测试）

## Task Commits

1. **Task 1: 在 dispatchTool 插入 PPT-only normalize（D-10/D-13）** - `2a3432c` (feat)
2. **Task 2: dispatch.test.ts PPT casing 守门用例（D-12）** - `e0c4a4f` (test)

## Files Created/Modified

- `src/agent/tools/index.ts` - 新增 PPT_TOOLS Set（L27-40）+ normalizeToSnakeCase helper（L44-51）+ dispatchTool 内 normalize 条件分支（L197-200）
- `src/agent/tools/dispatch.test.ts` - 追加 PPT casing 守门 describe 块（L203-314，112 行新增）

## Decisions Made

- D-10 + D-13 联合落地：PPT_TOOLS Set 将作用域精确限定在 PPT 工具，完全规避 Word/Excel camelCase args 被误 normalize 的 Pitfall（14-PATTERNS.md §Critical Pitfalls 3 号风险）
- `normalizeToSnakeCase` 放在模块级（非 dispatchTool 内部）：避免每次调用重新分配函数对象，符合 JavaScript 惯例

## Deviations from Plan

无。计划执行完全按设计完成，无需任何偏差处理。

## Issues Encountered

无。两个 Task 均一次执行完成，tsc 无报错，vitest 全绿。

## Known Stubs

无。本 plan 为纯逻辑层（normalize + 守门测试），无 UI 渲染、无数据源依赖，无 stub。

## Threat Flags

无。`normalizeToSnakeCase` 是纯 key 重命名，不引入新 I/O、不处理 secrets、不改变参数值。threat_model 评估为 accept（见 PLAN.md STRIDE 表）。

## Next Phase Readiness

- Plan 14-04 完成：dispatchTool 已有中央 normalize「总闸」
- Phase 14 MDL-03 完整交付：ppt.ts snake_case schema（14-02）+ dispatch 层 normalize（14-03/04）三层均已到位
- Phase 14 剩余：Plan 05（aihubmix-image.ts 三路解析器重写）+ Plan 06（三路 smoke test + fixture CI）

---
*Phase: 14-mdl-aihubmix-provider-model-casing*
*Completed: 2026-06-01*

## Self-Check: PASSED

- src/agent/tools/index.ts — FOUND
- src/agent/tools/dispatch.test.ts — FOUND
- .planning/phases/14-mdl-aihubmix-provider-model-casing/14-04-SUMMARY.md — FOUND
- commit 2a3432c — FOUND
- commit e0c4a4f — FOUND
