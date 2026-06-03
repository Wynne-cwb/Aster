---
phase: 21-ctx-compaction-antihallucination
plan: 02
subsystem: agent
tags: [system-prompt, anti-hallucination, ctx-06, vitest]

# Dependency graph
requires:
  - phase: 08-foundation
    provides: getDomainSegment 三宿主 case（ppt/excel/word）领域指导段结构
provides:
  - "getDomainSegment 三宿主各加一条独立「文档现状权威」抗幻觉项（统一锚点句「旧读数早已过时」）"
  - "system-prompt.test.ts CTX-06 三宿主守门断言（it.each 含锚点句 + 独立项标签）"
affects: [23-pvq-stamp-tool-layout-prompt]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "抗幻觉指引写成自成一条、与坐标/自查规则解耦的独立项（Phase-23-friendly）：Phase 23 删 PPT 冗余坐标/自查项时 CTX-06 可干净保留"
    - "结构性 test 守门：it.each 三宿主一行覆盖锚点句，防 Phase 23 误删"

key-files:
  created: []
  modified:
    - src/agent/system-prompt.ts
    - src/agent/system-prompt.test.ts

key-decisions:
  - "三宿主统一锚点句「旧读数早已过时」+ 独立项标签「文档现状权威」，守门据此断言 — D-21-09"
  - "各自独立成条（PPT #10 / Excel #7 / Word #8），不并进现有自查/坐标项，确保 Phase 23（PVQ-05）能删 PPT #6/#8 冗余项而保留本条"

patterns-established:
  - "prompt 层补强抗幻觉：永远信任刚 read 的文档现状，不依赖历史里几十轮前旧读取记忆（文档会被改动，旧读数过时）"

requirements-completed: [CTX-06]

# Metrics
duration: ~8min
completed: 2026-06-03
---

# Phase 21 Plan 02: CTX-06 三宿主抗幻觉指引 Summary

**给 PPT/Excel/Word 三宿主 system prompt 领域段各加一条独立「文档现状权威」抗幻觉项（统一锚点句「旧读数早已过时」），让模型永远信任刚重读的文档现状、不依赖历史里几十轮前的旧读取记忆；写成与坐标/自查规则解耦的独立条目，使 Phase 23（PVQ-05）能干净删 PPT 冗余坐标/自查规则而保留此指引。**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-03
- **Completed:** 2026-06-03
- **Tasks:** 3（1 prompt 改动 + 1 守门测试 + 1 验证，验证与 Plan 01 Task 6 合并执行）
- **Files modified:** 2

## Accomplishments
- **CTX-06 三宿主独立项**：`getDomainSegment` ppt case 追加 #10、excel case 追加 #7、word case 追加 #8，统一含锚点句「旧读数早已过时」+ 标签「文档现状权威」，措辞按宿主微调（幻灯片/单元格/段落会被改动）
- **CTX-06 守门**：`system-prompt.test.ts` 新增 describe，`it.each(['word','excel','ppt'])` 两组断言（含「旧读数早已过时」+「文档现状权威」），防 Phase 23 删 PPT 坐标/自查项时误删 CTX-06
- 未动现有编号项（PPT #6 版式意识 / #8 宪法式自查保留待 Phase 23 处理）、未动 getSharedBase/buildTimeContext/buildPrefBlock/buildSystemPrompt/HOST_LABEL

## Task Commits

1. **Task 1+2: 三宿主 system prompt 加抗幻觉独立项 + 守门（CTX-06）** - `744fcb5` (feat) — prompt 改动 + 守门测试一并提交（同文件域、原子）

Task 3（最终验证）与 Plan 01 Task 6 合并执行，无独立文件改动。

## Files Created/Modified
- `src/agent/system-prompt.ts` - getDomainSegment 三宿主各追加一条 CTX-06「文档现状权威」独立项
- `src/agent/system-prompt.test.ts` - CTX-06 三宿主守门 describe（it.each 含锚点句 + 标签）

## Decisions Made
None beyond plan — 决策均为计划内锁定（D-21-09）。

## Deviations from Plan
None — 严格按计划追加三条独立项 + 守门，未动现有项。Task 1+2 因同属 system-prompt 文件域且测试随实现立即变绿，合并为单次原子提交（GSD 原子提交以「逻辑可验证单元」为粒度）。

## Issues Encountered
- 同 Plan 01：`npm test` 尾部 3 个 `retry.test.ts` 噪音 errors（无关）。

## Verification（合并 Plan 01 Task 6）
- `npx tsc --noEmit` → exit 0（纯字符串改动，类型无影响）
- `npx vitest run src/agent/system-prompt.test.ts` → **34 tests passed**（含 CTX-06 三宿主守门）
- `grep -c '旧读数早已过时' src/agent/system-prompt.ts` → 3；`grep -c '文档现状权威'` → 3
- `npm test -- --run` → 933 passed（含 CTX-06 守门）
- `npm run build && npm run size` → 80.6 KB ≤ 82 KB（纯字符串，0 增量）
- Success criteria 1-4 全部 TRUE

## User Setup Required
None。

## Next Phase Readiness
- CTX-06 交付，prompt 层抗幻觉补强就位；独立项解耦设计为 Phase 23（PVQ-05 删 PPT 冗余坐标/自查规则）预留干净删除路径。
- 真机 UAT（指引是否有效降低旧读数幻觉）攒到 v2.3 里程碑末统一验。

---
*Phase: 21-ctx-compaction-antihallucination (Plan 02)*
*Completed: 2026-06-03*
