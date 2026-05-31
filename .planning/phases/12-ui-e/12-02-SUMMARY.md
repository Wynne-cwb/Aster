---
phase: 12-ui-e
plan: "02"
subsystem: ui
tags: [message-schema, zustand, loop-helpers, skeleton, css-animation, index-html]

requires:
  - phase: 12-00
    provides: Phase 12 pattern map + research (12-PATTERNS.md, 12-RESEARCH.md)

provides:
  - Message.kind optional field in chat.ts (single source of truth for read/write classification)
  - loop-helpers propagates def?.kind into every pushMessage call for tool messages
  - index.html #root shimmer skeleton with inline CSS (sk-shimmer + prefers-reduced-motion + dark)

affects: [12-03, 12-04, 12-05]

tech-stack:
  added: []
  patterns:
    - "D-18 APPROVED EXCEPTION: hardcoded hex in index.html inline skeleton (CSS vars not loaded before Office.onReady)"
    - "D-19: single-hue luminance gradient (not brand multi-color gradient) — does not violate no-gradient rule"
    - "Skeleton overwrites automatically by React.createRoot — no JS removal needed"

key-files:
  created: []
  modified:
    - src/store/chat.ts
    - src/agent/loop-helpers.ts
    - index.html

key-decisions:
  - "D-18: Inline skeleton hex grays are the sole project-wide approved exception to no-hardcoded-hex rule; CSS vars unavailable before styles.css loads"
  - "D-19: Shimmer single-hue grey gradient is NOT a brand multi-color gradient, does not violate the no-gradient rule"
  - "kind field added as optional (not required) — only tool role messages carry it; user/assistant/error roles leave it undefined"

patterns-established:
  - "Message.kind pattern: optional field on Message interface, written once at push time (loop-helpers), read by ChatStream (12-03)"
  - "Skeleton pre-JS: inline <style> + HTML inside #root, React.createRoot auto-overwrites — no cleanup JS"

requirements-completed:
  - UI-05
  - UI-06

duration: 8min
completed: 2026-05-31
---

# Phase 12 Plan 02: Message.kind Data Layer + index.html Shimmer Skeleton Summary

**Message.kind optional field on `Message` interface + def?.kind propagated in loop-helpers + CSS shimmer skeleton in index.html with dark/reduced-motion branches, zero JS bundle impact**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-31T~05:00Z
- **Completed:** 2026-05-31T~05:08Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `src/store/chat.ts` Message interface gains `kind?: 'read' | 'write'` as the single source of truth for tool message read/write classification (UI-05 data layer)
- `src/agent/loop-helpers.ts` pushMessage call propagates `kind: def?.kind` — def already resolved at L143, zero extra lookup cost; `} as never` cast preserved
- `index.html` #root replaced with shimmer skeleton: inline `<style>` with sk-shimmer keyframes + `#root-skeleton` HTML + `prefers-color-scheme: dark` branch + `prefers-reduced-motion: reduce` branch; React.createRoot auto-overwrites on mount (D-19)
- APPROVED EXCEPTION (D-18) comment present; build PASS; size 74.69 KB gzip (≤82 KB guard PASS)
- tsc 0 errors; vitest 729 passed, 2 expected-RED stubs (UI-02-A, UI-05-A — implemented in 12-03), 0 unexpected failures

## Task Commits

1. **Task 1: Message.kind 字段 + loop-helpers kind 写入（UI-05 数据层）** - `4f9e2e4` (feat)
2. **Task 2: index.html 首屏 CSS shimmer 骨架屏（UI-06）** - `c2840dc` (feat)

## Files Created/Modified

- `src/store/chat.ts` — Message interface: added `kind?: 'read' | 'write'` optional field after `agentStep?: number`
- `src/agent/loop-helpers.ts` — runOneToolCall pushMessage call: added `kind: def?.kind` line before `} as never` cast
- `index.html` — Replaced empty `<div id="root"></div>` with skeleton containing inline `<style>` + `#root-skeleton` HTML divs

## Decisions Made

- D-18: Hardcoded hex inside index.html inline `<style>` is the sole project-approved exception to the no-hardcoded-hex rule; CSS variables from `styles.css` are not loaded until after `Office.onReady` completes, so they cannot be referenced here. Neutral grey values only (no brand color).
- D-19: Shimmer animation uses a single-hue luminance gradient (#f3f2ee → #e9e7e0 → #f3f2ee in light; equivalent dark) — this is explicitly NOT a brand multi-color gradient and does not violate the "no gradient" design rule.
- kind field is optional (not required) on Message — only tool-role messages carry it; user/assistant/error messages leave it undefined without breaking existing code.

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched exact diffs specified in PLAN.md and 12-PATTERNS.md. `} as never` cast preserved. D-18 comment included verbatim. All acceptance criteria met.

## Issues Encountered

None. Two expected-RED stubs in test suite (UI-02-A and UI-05-A) correspond to ChatStream typing bubble and read-card class features implemented in 12-03 — documented as known in PLAN.md critical_rules §4.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| UI-02-A: `.bubble-typing` not rendered | `src/components/ChatStream.tsx` | ChatStream typing bubble JSX not yet added — implemented in 12-03 |
| UI-05-A: `.aster-tool-card--read` not applied | `src/components/ChatStream.tsx` | ToolResultCard `cardClass` logic not yet extended — implemented in 12-03 |

Both stubs are intentional pre-conditions for Plan 12-03. The `kind` data layer (this plan) is complete; the UI rendering layer (12-03) consumes it.

## Next Phase Readiness

- `Message.kind` field ready for ChatStream (12-03) to read and apply `aster-tool-card--read` CSS modifier
- Shimmer skeleton is fully self-contained and live; no further work needed for UI-06
- 12-03 can proceed immediately to implement typing bubble (UI-02), DiffLogPanel inline boundary (UI-03), and read-card styling (UI-05 render layer)

## Self-Check

Checking files exist and commits recorded...

---
*Phase: 12-ui-e*
*Completed: 2026-05-31*
