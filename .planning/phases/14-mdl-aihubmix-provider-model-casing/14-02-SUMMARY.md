---
phase: 14-mdl-aihubmix-provider-model-casing
plan: 02
subsystem: agent-tools
tags: [ppt, snake_case, casing, schema, refactor, dispatch]

# Dependency graph
requires:
  - phase: 14-mdl-aihubmix-provider-model-casing
    provides: plan 01 TDD 测试脚手架 + Wave 1 基础

provides:
  - ppt.ts 所有 PPT 工具 schema 统一为 snake_case（9 个工具改完）
  - 删除 4 个双键容错 pick* helpers（pickSlideIndex/pickShapeId/pickSourceIndex/pickTargetIndex）
  - execute 函数直接读 snake_case key，无双键容错逻辑
  - ppt.test.ts 同步更新，126/126 测试通过

affects:
  - 14-03（dispatchTool 中央 normalize 将兜 LLM 传来的 camelCase → snake_case）
  - 14-04（dispatch.test.ts PPT casing 守门用例需与此 snake_case schema 一致）
  - PPT 工具调用链（dispatchTool → ppt.ts execute）

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PPT 工具 execute 函数直接读 snake_case key（a.slide_index as number），无双键容错"
    - "camelCase 兼容由 dispatchTool 中央 normalize 统一处理（非工具层自兜）"

key-files:
  created: []
  modified:
    - src/agent/tools/write/ppt.ts
    - src/agent/tools/write/ppt.test.ts

key-decisions:
  - "D-11: 删除 ppt.ts 内所有散落双键容错（pick* helpers）——归一化移到 Plan 14-03 的 dispatchTool 中央 normalize"
  - "D-09: PPT 工具 schema 全部统一 snake_case——与 memory project_ppt_officejs_gotchas 一致"
  - "测试同步更新：260531-m4x 旧 camelCase 容错测试改为 snake_case（camelCase 兼容改由 dispatch 层负责）"

patterns-established:
  - "PPT 工具 schema key 命名约定：全部 snake_case（slide_index/shape_id/source_index/target_index/shape_type）"
  - "PPT 工具 execute 只读 snake_case——依赖上游 dispatchTool normalize，不在工具层双读"

requirements-completed:
  - MDL-03

# Metrics
duration: 7min
completed: 2026-06-01
---

# Phase 14 Plan 02: PPT Tools snake_case Schema Unification Summary

**删除 4 个 pick* 双键容错 helper + 9 个 PPT 工具 schema 全部统一为 snake_case，ppt.ts execute 直接读 snake_case key，为 Plan 14-03 dispatchTool 中央 normalize 做好对齐**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-01T07:29:00Z
- **Completed:** 2026-06-01T07:36:34Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- 删除 `pickSlideIndex`/`pickShapeId`/`pickSourceIndex`/`pickTargetIndex` 四个双键容错 helper 函数（约 12 行）
- 9 个工具的 parameters.properties key 名全部从 camelCase 改为 snake_case（slideIndex→slide_index, shapeId→shape_id, shapeType→shape_type, sourceIndex→source_index, targetIndex→target_index）
- 9 个工具的 required 数组同步更新
- 9 个工具的 humanLabel 和 execute 函数内读参数改为直接读 snake_case key
- ppt.test.ts 同步更新：旧 camelCase 容错测试改为 snake_case，全部 126/126 测试通过

## Task Commits

1. **Task 1: 删除 pick* helpers + 统一 ppt.ts 为 snake_case schema（D-09/D-11）** - `8e663d1` (refactor)

**Plan metadata:** _(docs commit to follow)_

## Files Created/Modified

- `src/agent/tools/write/ppt.ts` - 删除 pick* helpers；9 个工具 schema + execute 改为 snake_case
- `src/agent/tools/write/ppt.test.ts` - 旧 camelCase 容错测试同步改为 snake_case（camelCase 兼容移至 dispatch 层）

## Decisions Made

- `[Rule 1 - Bug] ppt.test.ts 旧测试用 camelCase 键传给 execute 导致 slide_index=undefined`：删除 pick* helpers 后，旧测试 `{ slideIndex: 1 }` 传给 execute 会得 undefined。因为 camelCase 兼容已按 D-10/D-11/D-13 设计移到 Plan 14-03 的 dispatchTool 中央 normalize，所以正确做法是把这些旧测试改成 snake_case。同时删除「humanLabel camelCase 仍正常」和「camelCase 原生 schema 仍正常透传」这两个基于旧设计的测试。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ppt.test.ts 旧 camelCase 容错测试在删除 pick* helpers 后失败**
- **Found during:** Task 1（统一 snake_case + 删 pick* 后运行测试发现 7 个失败）
- **Issue:** `set_shape_text_alignment`/`rotate_shape`/`set_slide_background` 的旧 `260531-m4x` 守门测试用 `{ slideIndex, shapeId }` 传给 execute，删 pick* 后得 undefined；`add_shape` 测试用 `shapeType` 未改 `shape_type`；「camelCase 仍正常」类测试基于旧双键容错设计
- **Fix:** 将失败测试中的 camelCase 参数全部改为 snake_case；删除「humanLabel camelCase 仍正常」和「camelCase 原生 schema 仍正常透传」两个测试（这两个测试的「camelCase 兼容」已移到 Plan 14-03 dispatchTool 层守门）
- **Files modified:** src/agent/tools/write/ppt.test.ts
- **Verification:** 126/126 tests pass
- **Committed in:** 8e663d1（与 Task 1 同 commit）

---

**Total deviations:** 1 auto-fixed（Rule 1 - Bug）
**Impact on plan:** 必要修正，测试同步反映新接口设计。camelCase 兼容测试移到 Plan 14-04（dispatch.test.ts PPT casing 守门）。

## Issues Encountered

无。Task 1 一次执行完成，tsc 对 ppt.ts 无报错。

## User Setup Required

None - 纯代码重构，无外部服务配置需要。

## Next Phase Readiness

- Plan 14-02 完成：ppt.ts execute 全部只读 snake_case key，pick* helpers 已删除
- Plan 14-03 就绪：dispatchTool 可以安全加中央 normalize（normalizeToSnakeCase）作「总闸」，保证 LLM 传 camelCase 也能正确路由
- Plan 14-04 就绪：dispatch.test.ts 可以加 PPT casing 守门用例，喂 camelCase 入参验证 dispatchTool 中央 normalize 后 execute 收到 snake_case

---
*Phase: 14-mdl-aihubmix-provider-model-casing*
*Completed: 2026-06-01*

## Self-Check: PASSED

- src/agent/tools/write/ppt.ts — FOUND
- .planning/phases/14-mdl-aihubmix-provider-model-casing/14-02-SUMMARY.md — FOUND
- commit 8e663d1 — FOUND
