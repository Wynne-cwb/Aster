---
phase: 07-uat-sideload-release-prep
plan: "02"
subsystem: ui/settings
tags: [tool-calling, provider-form, provider-list, badge, testing]

requires:
  - phase: 07-01
    provides: probeToolCallSupport, agentStore pre-flight guard, describe.skip stubs

provides:
  - ProviderForm "测试 tool calling" button (saved provider clickable, unsaved aria-disabled)
  - ProviderList supportsToolCall badge three-state (badge-success/badge-error)
  - ProviderForm.test + ProviderList.test un-skipped + B2/B3 guard test

affects: []

tech-stack:
  added: []
  patterns:
    - "B2/B3 guard: handleTestToolCall gates on provider?.id before calling probe"
    - "Honest-disable pattern: unsaved provider renders aria-disabled button, not hidden"
    - "badge-error for unsupported state (confirmed in styles.css:1234)"

key-files:
  modified:
    - src/components/Settings/ProviderForm.tsx
    - src/components/Settings/ProviderList.tsx
    - src/components/Settings/ProviderForm.test.tsx
    - src/components/Settings/ProviderList.test.tsx

key-decisions:
  - "Used badge-error (confirmed exists at styles.css:1234) for supportsToolCall=false state"
  - "handleTestToolCall uses provider.id directly, no temp fallback (B2/B3 correctness)"
  - "Unsaved provider: honest-disable with aria-disabled='true' per aster-design-system"

requirements-completed:
  - ERR-04
  - NFR-04

duration: 5min
completed: 2026-05-30
---

# Phase 07 Plan 02: ProviderForm 测试按钮 + ProviderList badge 三态 Summary

**ProviderForm handleTestToolCall（B2/B3 已保存守门）+ ProviderList supportsToolCall badge-success/badge-error + 测试全激活**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-05-30
- **Tasks:** 2 (Task 1 = verify-only; Task 2 = implementation)
- **Files modified:** 4

## Accomplishments

- Task 1 (verify-only): agentStore A-21 pre-flight guard 已在 Plan 01 完成，22个测试全绿，确认无需重做
- Task 2: ProviderForm 新增 `handleTestToolCall` 函数，守门 `if (!provider?.id) return`，无任何 'temp' 兜底
- 未保存 Provider 诚实禁用按钮（`aria-disabled="true"` + `title="保存后可测试"`）
- 已保存 Provider 按钮可点击；loading/supported/unsupported 三态 badge
- ProviderList 新增 `supportsToolCall` badge：true→badge-success「✓ tool call」，false→badge-error「✗ 不支持」
- ProviderForm.test.tsx: 去掉 describe.skip，新增 B2/B3 测试 case（aria-disabled 断言）
- ProviderList.test.tsx: 去掉 describe.skip，3 个 badge 三态全绿

## Task Commits

1. **Task 2: ProviderForm button + ProviderList badge + un-skip tests** - `4fbebfb` (feat)

## Files Modified

- `src/components/Settings/ProviderForm.tsx` — handleTestToolCall + testState useState + 测试按钮区块
- `src/components/Settings/ProviderList.tsx` — supportsToolCall badge badge-success/badge-error
- `src/components/Settings/ProviderForm.test.tsx` — 去掉 describe.skip；mock probeToolCallSupport；B2/B3 case
- `src/components/Settings/ProviderList.test.tsx` — 去掉 describe.skip

## Decisions Made

- `badge-error` 已在 styles.css:1234 确认存在，直接使用（不回退到 badge-accent）
- `handleTestToolCall` 用 `provider.id` 直传，彻底消除 `'temp'` 兜底隐患
- 测试文件中 mock `probeToolCallSupport` 为 `vi.fn().mockResolvedValue(null)` 避免网络请求

## Deviations from Plan

None - plan executed exactly as written. Task 1 was verify-only as expected (agentStore guard was already done in Plan 01).

## Test Results

- All 38 tests green: 22 agentStore + 13 ProviderForm + 3 ProviderList
- Full suite: 599 tests, only known pre-existing flaky `retry.test.ts` failed (9/9 when run alone)

## Self-Check

- [x] `grep -c "handleTestToolCall" src/components/Settings/ProviderForm.tsx` = 2 ✓
- [x] `grep -n "provider?.id" src/components/Settings/ProviderForm.tsx` = lines 102, 227 ✓
- [x] `grep -c "'temp'" src/components/Settings/ProviderForm.tsx` = 0 ✓
- [x] `grep -c "badge-error" src/components/Settings/ProviderList.tsx` = 1 ✓
- [x] `grep -c "supportsToolCall === false" src/agent/agentStore.ts` = 1 ✓
- [x] Commit 4fbebfb exists ✓

## Self-Check: PASSED
