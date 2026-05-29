---
phase: 04-read-tools-agentcontrolbar
plan: 08
subsystem: ui
tags: [react, zustand, provider, model-select, registry, lingui]

requires:
  - phase: 04-read-tools-agentcontrolbar
    provides: ProviderForm with isBuiltIn pattern, registry.ts aihubmix routing

provides:
  - BUILTIN_MODEL_OPTIONS constant in providers.ts (deepseek/aihubmix fixed lists)
  - ProviderForm isBuiltIn model branch — <select> for built-in, text input for custom
  - aihubmix default model updated to gpt-5.1 (in dropdown list)
  - registry.ts AIHUBMIX_VISION_MODEL=gpt-5.1, AIHUBMIX_IMAGE_MODEL=gpt-image-2
  - ProviderForm.test.tsx with 10 tests covering select/input branches

affects:
  - Phase 4 UAT (SC6 model dropdown true-machine verification)
  - Phase 6 (vision/image-gen paths consume AIHUBMIX_VISION_MODEL / AIHUBMIX_IMAGE_MODEL)

tech-stack:
  added: []
  patterns:
    - "ProviderForm isBuiltIn branch: <select> with BUILTIN_MODEL_OPTIONS[provider.id] ?? [model] fallback"
    - "modelRef only attached to custom text input (not built-in select) — safe null on focus"

key-files:
  created:
    - src/components/Settings/ProviderForm.test.tsx
  modified:
    - src/store/providers.ts
    - src/components/Settings/ProviderForm.tsx
    - src/providers/registry.ts
    - src/styles.css
    - src/providers/registry.test.ts
    - src/i18n/locales/zh-CN/messages.po

key-decisions:
  - "D-07 model lists: deepseek=['deepseek-v4-pro','deepseek-v4-flash'], aihubmix=['gpt-5.1','gemini-3.5-flash']"
  - "aihubmix default model gpt-image-1 → gpt-5.1 (avoid select landing outside list)"
  - "select arrow: appearance:none + cursor:pointer only; no SVG data-url (bundle savings)"
  - "D-09 constants only: vision/image-gen call paths unchanged, deferred to Phase 6"

patterns-established:
  - "BUILTIN_MODEL_OPTIONS: Record<string, string[]> pattern for provider-specific dropdowns"

requirements-completed: [CARRY-02]

duration: 7min
completed: 2026-05-29
---

# Phase 4 Plan 08: CARRY-02 Model Select Summary

**ProviderForm built-in provider model field replaced with native `<select>` dropdown (deepseek: pro/flash, aihubmix: gpt-5.1/gemini-3.5-flash) and registry.ts aihubmix constants updated to gpt-5.1/gpt-image-2**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-29T04:08:39Z
- **Completed:** 2026-05-29T04:15:38Z
- **Tasks:** 2 (+ TDD RED/GREEN cycle for Task 1)
- **Files modified:** 7

## Accomplishments

- Built-in providers (DeepSeek, AiHubMix) now show fixed model dropdown in ProviderForm; custom providers keep free-text input
- BUILTIN_MODEL_OPTIONS exported from providers.ts (deepseek: v4-pro/v4-flash, aihubmix: gpt-5.1/gemini-3.5-flash) ready for SC6 true-machine UAT
- aihubmix default model changed from gpt-image-1 to gpt-5.1 (now in dropdown list, avoids orphaned selection)
- registry.ts AIHUBMIX_VISION_MODEL (gpt-4o → gpt-5.1) and AIHUBMIX_IMAGE_MODEL (gpt-image-1 → gpt-image-2) updated; call paths untouched (Phase 6 deferred)
- 10 ProviderForm unit tests covering both select branches and the custom-provider text input fallback

## Task Commits

1. **TDD RED: ProviderForm.test.tsx (failing tests)** - `d6a995f` (test)
2. **Task 1: CARRY-02 model select + BUILTIN_MODEL_OPTIONS + aihubmix default** - `331a31a` (feat)
3. **Task 2: D-09 registry.ts constant update** - `72c0a6b` (chore)
4. **[Rule 1] Fix registry.test.ts assertions for new model values** - `7ce10d3` (fix)
5. **[Rule 1] Update messages.po line refs after ProviderForm expansion** - `5c3e6d2` (fix)
6. **CSS: simplify select arrow styles** - `11efcc8` (style)

**Plan metadata:** (docs commit follows)

_TDD tasks have multiple commits (test RED → feat GREEN + style fix)_

## Files Created/Modified

- `src/components/Settings/ProviderForm.test.tsx` - 10 tests: built-in deepseek select, built-in aihubmix select, custom provider text input (created)
- `src/store/providers.ts` - Added BUILTIN_MODEL_OPTIONS export; aihubmix model gpt-image-1 → gpt-5.1
- `src/components/Settings/ProviderForm.tsx` - isBuiltIn model branch: `<select>` vs `<input>`, import BUILTIN_MODEL_OPTIONS
- `src/providers/registry.ts` - AIHUBMIX_VISION_MODEL gpt-4o → gpt-5.1, AIHUBMIX_IMAGE_MODEL gpt-image-1 → gpt-image-2 (D-09)
- `src/styles.css` - select.aster-field--standalone: appearance:none + cursor:pointer
- `src/providers/registry.test.ts` - Updated vision/image-gen model assertions to gpt-5.1/gpt-image-2
- `src/i18n/locales/zh-CN/messages.po` - Updated line references after ProviderForm gained 18 lines

## Decisions Made

- **select arrow without SVG data-url:** Used `appearance:none` + `cursor:pointer` only for the select styling; skipping the inline SVG chevron saves ~280 B CSS with acceptable UX tradeoff in Office Task Pane (narrow context, not a full form app).
- **D-09 scope strictly constants-only:** AIHUBMIX_VISION_MODEL and AIHUBMIX_IMAGE_MODEL updated in registry.ts; aihubmix-vision.ts and aihubmix-image.ts left unchanged (Phase 6 scope).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] registry.test.ts vision/image-gen assertions used stale model values**
- **Found during:** Task 2 full test suite run
- **Issue:** registry.test.ts had `model: 'gpt-4o'` and `model: 'gpt-image-1'` in vision/image-gen expectations — direct consequence of D-09 constant change
- **Fix:** Updated test descriptions and `expect(result)` to match new constants (gpt-5.1, gpt-image-2)
- **Files modified:** src/providers/registry.test.ts
- **Verification:** `npx vitest run src/providers/registry.test.ts` → 12 PASS
- **Committed in:** `7ce10d3`

**2. [Rule 1 - Bug] messages.po line references drifted after ProviderForm gained 18 lines**
- **Found during:** Task 1 full test suite run
- **Issue:** i18n coverage test runs `lingui extract` and diffs against git — ProviderForm.tsx expanded by 18 lines (select branch + import), causing all `<Trans>` source line numbers to drift
- **Fix:** Re-ran `npm run extract` and committed updated messages.po
- **Files modified:** src/i18n/locales/zh-CN/messages.po
- **Verification:** `npx vitest run src/i18n/coverage.test.ts` → 1 PASS
- **Committed in:** separate fix commit

---

**Total deviations:** 2 auto-fixed (both Rule 1 — downstream sync after primary changes)
**Impact on plan:** Both auto-fixes were forced by D-09 constant change and ProviderForm expansion. No scope creep.

## Bundle Size Report

**Current: 80.67 KB gzipped (gate: 80 KB) — OVER by 668 B**

This is a pre-existing overage from Plan 04-07 (~80.50 KB). This plan's changes added approximately +170 B net (BUILTIN_MODEL_OPTIONS constant + select branch code). CSS select styles were minimized (no SVG data-url) to avoid further growth.

**Status:** NOT a new blocker introduced by this plan. Plan 04-07 already exceeded the gate. Recommend investigating bundle reduction before Phase 4 UAT (Plan 04-09 SC-bundle criterion).

## Issues Encountered

- messages.po update required two-step process: `npm run extract` → commit → re-run test (coverage test's `git checkout --` mechanism resets the file after test runs, so the file must already be committed for the diff to be clean)

## Known Stubs

None — ProviderForm select is fully wired (onChange → setModel → onSave path unchanged).

## Next Phase Readiness

- SC6 (model dropdown) is ready for Plan 04-09 true-machine UAT
- Phase 6 can consume updated AIHUBMIX_VISION_MODEL / AIHUBMIX_IMAGE_MODEL without changing registry.ts constants
- Bundle is 668 B over the 80 KB gate — should be investigated before Phase 5 feature additions

---
*Phase: 04-read-tools-agentcontrolbar*
*Completed: 2026-05-29*
