---
phase: 09-word-d-b-word
plan: "03"
subsystem: adapters
tags: [word, office-js, selection, paragraphIndex, uniqueLocalId, wsel-01]

requires:
  - phase: 09-word-d-b-word/09-01
    provides: Wave 0 RED 骨架（selection_detail WSEL-01 测试骨架）

provides:
  - WordAdapter.read selection_detail 返回 paragraphIndex（0-based 文本指纹快路径）
  - WordAdapter.read selection_detail 返回 uniqueLocalId（WordApi 1.6 支持时）
  - D-03 降级：不支持 WordApi 1.6 时 uniqueLocalId 为 null
  - D-04：跨段落 selection → paragraphIndex:-1 + selectionSpansMultipleParagraphs:true

affects:
  - 09-word-d-b-word/09-04
  - 09-word-d-b-word/09-05
  - Phase 10 Excel/PPT 工具（selection_detail 扩展字段可供所有宿主消费）

tech-stack:
  added: []
  patterns:
    - "isSetSupported('WordApi','1.6') 运行时门控：typeof Office !== 'undefined' 防 test 环境崩溃"
    - "文本指纹快路径（normalizeText 消除末尾 \\r\\n 格式差异）定位 paragraphIndex"
    - "paras.load('items/text,items/uniqueLocalId') 按能力条件加载字段"

key-files:
  created: []
  modified:
    - src/adapters/WordAdapter.ts
    - src/adapters/WordAdapter.read.test.ts

key-decisions:
  - "文本指纹快路径（非 compareLocationWith）：无需额外 sync，v2.1 仅验 Web，接受单段去重取第一个"
  - "typeof Office !== 'undefined' 门控前置：防止 test 环境 Office 未 mock 时崩溃"
  - "旧 selection_detail describe 的 mock 补充 body.paragraphs + Office（Rule 1 Bug Fix）：新实现需要 body.paragraphs，旧 mock 缺失导致 2 个既有测试崩溃"
  - "WSEL-01 降级测试改用独立 Word/Office mock（不复用 mockWordForRead）：mockWordForRead 内部总返回 isSetSupported=true，会覆盖降级设置"

requirements-completed:
  - WSEL-01

duration: 15min
completed: 2026-05-31
---

# Phase 9 Plan 03: WSEL-01 selection_detail 扩展 Summary

**selection_detail 扩展返回 paragraphIndex（文本指纹快路径）+ uniqueLocalId（WordApi 1.6 门控），含跨段落标记与 D-03 降级路径，Wave 0 的 2 个 RED 测试全部变绿**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-31T00:51:00Z
- **Completed:** 2026-05-31T00:52:49Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- 扩展 `WordAdapter.ts` selection_detail case：加入 `paragraphIndex`（0-based 文本指纹）+ `uniqueLocalId`（WordApi 1.6 门控）
- D-03 降级：`isSetSupported('WordApi','1.6') === false` 时 `uniqueLocalId` 为 `null`
- D-04：selection 跨段落或为段落子集时（文本指纹无精确匹配），返回 `paragraphIndex:-1` + `selectionSpansMultipleParagraphs:true`
- Wave 0 骨架的 2 个 RED selection_detail 测试变绿；全 20 个 WordAdapter.read 测试通过；全套 677 个测试（含预期 RED 的 5 个 inverse integration tests）无新增失败

## Task Commits

1. **Task 1: 扩展 WordAdapter.ts selection_detail case** - `3553f22` (feat)
2. **Task 2: 绿化 selection_detail 测试** - `b93d864` (test)

**Plan metadata:** `（待 final commit）`

## Files Created/Modified

- `src/adapters/WordAdapter.ts` - selection_detail case 扩展（paragraphIndex + uniqueLocalId + isSetSupported 门控）
- `src/adapters/WordAdapter.read.test.ts` - WSEL-01 扩展测试绿化 + 旧 mock 补充 body.paragraphs

## Decisions Made

- **文本指纹快路径**（非 compareLocationWith）：不需要额外 sync，单段文本精确匹配取第一个 index，简单可靠；v2.1 仅验 Web，v2.2 再考虑升级
- **typeof Office !== 'undefined' 门控前置**：防止 test 环境 Office 未 mock 时 `Office.context?.requirements` 访问崩溃
- **降级测试用独立 mock**：`mockWordForRead` 内部总覆盖 `Office.isSetSupported=true`，降级测试必须完全独立设置 `Word`/`Office`，不调用 `mockWordForRead`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 旧 selection_detail describe mock 缺 body.paragraphs**

- **Found during:** Task 2（绿化测试）
- **Issue:** 新实现需要 `ctx.document.body.paragraphs`，但旧的 `selection_detail` describe beforeEach mock（非 WSEL-01 块）的 ctx 没有 `body` 属性，导致 2 个原本通过的测试抛 `Word selection_detail 失败`
- **Fix:** 在旧 `selection_detail` describe 的 beforeEach 中补充 `body.paragraphs`，同时补充 `Office.context.requirements.isSetSupported = false`（使旧测试不依赖 uniqueLocalId 行为）；`无选区` 测试的覆盖 mock 同步补充 `body.paragraphs`
- **Files modified:** `src/adapters/WordAdapter.read.test.ts`
- **Verification:** 全 20 个 WordAdapter.read 测试通过
- **Committed in:** `b93d864`（Task 2 commit）

---

**Total deviations:** 1 auto-fixed（Rule 1 - Bug）
**Impact on plan:** 必要修复，维持既有测试绿色。无 scope creep。

## Issues Encountered

无。

## Known Stubs

无——所有返回字段均有真实逻辑（文本指纹匹配 / isSetSupported 门控），无 hardcoded 空值或 placeholder。

## Threat Surface Scan

`selection_detail` 读取段落集合与 uniqueLocalId，均为文档内只读操作，不新增网络端点或 auth 路径。T-9-04/T-9-05 已在 PLAN.md 的 threat_model 中覆盖，无新增 threat surface。

## Next Phase Readiness

- Wave 2 完成：`selection_detail` 可返回精确段落定位信息，供后续 Word write tool 精确定位使用
- 5 个 Word inverse integration tests 预期保持 RED（Wave 3-6 完成后才变绿）
- 下一步：09-04（Word write tools 实现）

## Self-Check: PASSED

- `src/adapters/WordAdapter.ts` — FOUND
- `src/adapters/WordAdapter.read.test.ts` — FOUND
- `3553f22` — FOUND
- `b93d864` — FOUND

---
*Phase: 09-word-d-b-word*
*Completed: 2026-05-31*
