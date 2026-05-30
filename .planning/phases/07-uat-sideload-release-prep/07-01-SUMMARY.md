---
phase: 07-uat-sideload-release-prep
plan: "01"
subsystem: providers
tags: [tool-calling, probe, agentStore, ErrorBubble, testing]

requires:
  - phase: 06
    provides: agentStore.runAgent, OpenAICompatibleLLM.streamChat, SSEEvent types

provides:
  - probeToolCallSupport(config) → boolean|null (A-21 tool-call compatibility probe)
  - agentStore pre-flight guard (supportsToolCall===false → block runAgent)
  - UNSUPPORTED error code in ERROR_UI_MAP (ErrorBubble)
  - agentStore.test.ts A-21 three-case coverage
  - ProviderForm + ProviderList test stubs (describe.skip, ready for Plan 02)

affects: [07-02, 07-03]

tech-stack:
  added: []
  patterns:
    - "decided sentinel (W4): explicit boolean flag to distinguish settled-decision
      abort vs timeout abort in probe function"
    - "Post-loop signal.aborted check: use !decided && controller.signal.aborted
      to detect timeout when streamChat silently swallows AbortError"
    - "Dynamic import for useChatStore in agentStore.ts to avoid circular dep
      with chat.ts (which already imports agentStore)"
    - "describe.skip pattern for Plan-N+1 test stubs (ProviderForm/ProviderList)"

key-files:
  created:
    - src/providers/probeToolCall.ts
    - src/providers/probeToolCall.test.ts
    - src/components/Settings/ProviderList.test.tsx
  modified:
    - src/agent/agentStore.ts
    - src/agent/agentStore.test.ts
    - src/components/ErrorBubble.tsx
    - src/components/Settings/ProviderForm.test.tsx

key-decisions:
  - "Post-loop signal.aborted check instead of catch-block for timeout-null:
    streamChat catches and swallows AbortError, so probeToolCallSupport's catch
    block never sees it. Fix: check !decided && controller.signal.aborted after
    the for-await loop exits normally."
  - "Dynamic import for useChatStore in agentStore.ts to avoid circular
    dependency: chat.ts statically imports agentStore, adding the reverse
    static import would create a cycle."
  - "A-21 pre-flight guard implemented in Plan 01 (not deferred to Plan 02):
    agentStore.test.ts requires guard to be active ('立即生效'), so guard
    must exist for tests to pass."

patterns-established:
  - "decided sentinel: when aborting a stream midway after detecting a result,
    set decided=true BEFORE calling controller.abort() to avoid null ambiguity"
  - "Probe bypasses singleFlight/withRetry wrappers via streamChat, but those
    are mocked as passthroughs in tests — clean isolation"

requirements-completed:
  - ERR-04
  - NFR-04
  - NFR-05

duration: 11min
completed: 2026-05-30
---

# Phase 07 Plan 01: A-21 Wave 0 — Tool-Call Probe + Pre-Flight Guard Summary

**probeToolCallSupport() with decided-sentinel three-state logic, agentStore pre-flight guard blocking supportsToolCall===false runs, UNSUPPORTED in ErrorBubble**

## Performance

- **Duration:** 11 min
- **Started:** 2026-05-30T08:19:13Z
- **Completed:** 2026-05-30T08:30:13Z
- **Tasks:** 2
- **Files modified:** 7 (2 created new, 1 created new test, 4 modified)

## Accomplishments
- `probeToolCallSupport(config)` → `boolean | null` probe function with decided-sentinel (W4) correctly distinguishing tool-call-support true/false/null(timeout) via SSEEvent type discrimination
- A-21 pre-flight guard in `agentStore.runAgent`: explicitly blocks `supportsToolCall === false`, allows `null`/`undefined` (RESEARCH Pitfall 2 strict equality)
- `UNSUPPORTED` error code added to `ERROR_UI_MAP` with settings deep-link to model-input
- 5 new probe unit tests + 3 new agentStore pre-flight tests (all active, no skip)
- ProviderForm and ProviderList test stubs ready for Plan 02 implementation (describe.skip)

## Task Commits

1. **Task 1: probeToolCall.ts + 单测** - `3a20750` (feat)
2. **Task 2: ErrorBubble UNSUPPORTED + agentStore guard + test stubs** - `f94e173` (feat)

## Files Created/Modified

- `src/providers/probeToolCall.ts` — A-21 probe function with decided sentinel and post-loop abort check
- `src/providers/probeToolCall.test.ts` — 5 tests: true/false/null + tool_call_end + empty stream
- `src/agent/agentStore.ts` — Added useProviderStore import + A-21 pre-flight guard in runAgent
- `src/agent/agentStore.test.ts` — Added vi.mock('./loop') + 3 A-21 pre-flight cases
- `src/components/ErrorBubble.tsx` — UNSUPPORTED entry in ERROR_UI_MAP
- `src/components/Settings/ProviderForm.test.tsx` — describe.skip block for Plan-02 test button
- `src/components/Settings/ProviderList.test.tsx` — New file with describe.skip for badge three-state

## Decisions Made

- Used `!decided && controller.signal.aborted` post-loop check for timeout→null path (streamChat swallows AbortError; catch block unreachable via that path)
- Dynamic import `await import('../store/chat')` for useChatStore in agentStore.ts to avoid circular dependency with chat.ts
- Implemented agentStore pre-flight guard in Plan 01 (not deferred to Plan 02) because tests must pass per "立即生效" requirement

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] post-loop signal.aborted check for timeout→null path**
- **Found during:** Task 1 (probeToolCallSupport implementation)
- **Issue:** Plan's implementation uses catch block to return null on AbortError, but `OpenAICompatibleLLM.streamChat` silently swallows AbortError in its own try/catch (returns without re-throwing). The `for await` loop in probeToolCallSupport sees the generator as normally terminated, never reaching the catch block. Without fix, 10s timeout returns `false` instead of `null`.
- **Fix:** Added `if (!decided && controller.signal.aborted) return null;` after the for-await loop exits. The catch block is kept as a safety net for direct streamSSE usage paths.
- **Files modified:** src/providers/probeToolCall.ts
- **Verification:** Timeout test case returns `null`; all 5 probe tests green
- **Committed in:** 3a20750 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Implemented agentStore pre-flight guard**
- **Found during:** Task 2 (writing agentStore A-21 tests)
- **Issue:** Plan's `files_modified` list omits `agentStore.ts`, but the plan's success criteria require agentStore A-21 tests to be "immediately active" (not describe.skip) and fully green. These tests verify that `supportsToolCall===false` blocks runAgent — which requires the guard to exist.
- **Fix:** Added pre-flight guard in `agentStore.runAgent` with `useProviderStore` static import and `useChatStore` dynamic import (to avoid circular dep with chat.ts which already imports agentStore).
- **Files modified:** src/agent/agentStore.ts
- **Verification:** All 22 agentStore tests green (3 new A-21 cases pass)
- **Committed in:** f94e173 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 missing critical functionality)
**Impact on plan:** Both auto-fixes required for correctness. No scope creep beyond plan intent.

## Known Stubs

- `src/components/Settings/ProviderForm.test.tsx` describe.skip: Plan 02 will implement the test button UI; stubs are intentional placeholders
- `src/components/Settings/ProviderList.test.tsx` describe.skip: Plan 02 will implement the badge UI; stubs are intentional placeholders

## Issues Encountered

**Pre-existing test failures** (not introduced by this plan):
- `src/providers/retry.test.ts`: "fn 抛 NetworkError：重试最多 3 次" — pre-existing flaky timeout test, confirmed failing on commit 76d7331 (before any Plan 07-01 work)
- `src/i18n/coverage.test.ts`: messages.po catalog coverage — pre-existing, confirmed failing at commit 76d7331 state; requires `npm run extract` from a prior change

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The probe function (`probeToolCallSupport`) sends HTTP requests to the user's configured Provider — same trust boundary as existing `streamChat` calls. `apiKey` is never logged per T-07-01 (catch block doesn't log `e.message`; only the `decided` sentinel and return value flow out).

## Next Phase Readiness

- Plan 02 can immediately add ProviderForm test button UI: `describe.skip` blocks ready to activate
- Plan 02 can immediately add ProviderList badge UI: `describe.skip` blocks ready to activate
- `probeToolCallSupport` is callable from ProviderForm; signature and behavior verified

---
*Phase: 07-uat-sideload-release-prep*
*Completed: 2026-05-30*
