---
phase: 12-ui-e
plan: "01"
subsystem: ui
tags: [react-markdown, xss, security, urlTransform, safeUrlTransform]

# Dependency graph
requires:
  - phase: 12-ui-e plan 00
    provides: safeUrlTransform util (created and tested in Wave 0)
provides:
  - ChatBubble ReactMarkdown with urlTransform={safeUrlTransform} (UI-01 P0 XSS fix)
  - LLM-generated javascript:/data:/vbscript: URIs blocked at render time
affects: [12-02, 12-03, 13-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "urlTransform allowlist pattern: safeUrlTransform as sole transform (D-03 — no composition with defaultUrlTransform)"

key-files:
  created: []
  modified:
    - src/components/ChatBubble.tsx

key-decisions:
  - "D-03 enforced: urlTransform = safeUrlTransform alone (no defaultUrlTransform composition) — allowlist is sole truth, behavior predictable"

patterns-established:
  - "P0 security fixes land as minimal 2-line diffs: import + prop. No structural changes to ChatBubble."

requirements-completed: [UI-01]

# Metrics
duration: 3min
completed: 2026-05-31
---

# Phase 12 Plan 01: UI-01 P0 XSS Fix Summary

**Wired safeUrlTransform into ChatBubble's ReactMarkdown via urlTransform prop, blocking javascript:/data:/vbscript: URIs from LLM-generated Markdown (CVE-2025-24981 class defense)**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-31T~
- **Completed:** 2026-05-31
- **Tasks:** 1
- **Files modified:** 1 (ChatBubble.tsx only)

## Accomplishments
- Added `import { safeUrlTransform } from '../utils/safeUrlTransform'` to ChatBubble.tsx
- Added `urlTransform={safeUrlTransform}` prop to the `<ReactMarkdown>` component in the assistant bubble
- All 5 UI-01 DOM-level tests (UI-01-A/B/C/D/E) now GREEN: javascript:/data:/vbscript: URIs produce empty href, https: links pass through
- messages.po unchanged after `npm run extract` (import-only change, no Trans/t macro line shifts)
- tsc clean; 729 tests pass; only 2 expected-RED stubs (UI-02-A, UI-05-A) remain for plan 12-03

## Task Commits

1. **Task 1: wire safeUrlTransform into ChatBubble ReactMarkdown** - `5d78347` (feat)

## Files Created/Modified
- `src/components/ChatBubble.tsx` - Added safeUrlTransform import + urlTransform prop on ReactMarkdown (2-line minimal diff)

## Decisions Made
- D-03 enforced: urlTransform = safeUrlTransform alone (no defaultUrlTransform composition). The allowlist in safeUrlTransform.ts is the sole truth; behavior is fully predictable and testable.

## Deviations from Plan

None - plan executed exactly as written. Minimum 2-line diff applied as specified.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None introduced in this plan. ChatStream UI-02-A / UI-05-A stubs pre-exist from plan 12-00 and are documented as intended-RED until plan 12-03.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan closes threat T-12-01 (Tampering/EoP via javascript: URI in ReactMarkdown) and T-12-02 (API Key disclosure via javascript: exec). Both threats now mitigated.

## Next Phase Readiness
- UI-01 security gate closed. ChatBubble ReactMarkdown now safe for LLM-generated content.
- Plan 12-02 (loading bubble / typing indicator) can proceed immediately.
- Plan 12-03 (ChatStream UI-02/UI-05 stubs → green) can proceed after 12-02.

## Self-Check

- [x] `grep -c "urlTransform" src/components/ChatBubble.tsx` = 1
- [x] `grep -c "safeUrlTransform" src/components/ChatBubble.tsx` = 2 (import + prop)
- [x] Commit 5d78347 exists
- [x] 5 UI-01 ChatBubble tests PASS (0 fail)
- [x] messages.po UNCHANGED after extract
- [x] tsc clean, 729 tests pass, only expected stubs RED

## Self-Check: PASSED

---
*Phase: 12-ui-e*
*Completed: 2026-05-31*
