---
phase: 07-uat-sideload-release-prep
fixed_at: 2026-05-30T17:10:00+08:00
review_path: .planning/phases/07-uat-sideload-release-prep/07-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-05-30T17:10:00+08:00
**Source review:** `.planning/phases/07-uat-sideload-release-prep/07-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (CR-01, WR-01, WR-02; IN-01 deferred per team-lead instruction)
- Fixed: 3
- Skipped: 0

---

## Fixed Issues

### CR-01 + WR-01: Empty-key probe guard + honest-disable test button

**Files modified:** `src/components/Settings/ProviderForm.tsx`, `src/components/Settings/ProviderForm.test.tsx`
**Commit:** `2951dc6`
**Applied fix:**

- Replaced dead compound guard `if (!apiKey.trim() && !provider.id) return;` with two clean guards:
  ```ts
  if (!provider?.id) return;   // unsaved provider — no real id
  if (!apiKey.trim()) return;  // no key entered — cannot probe (don't fire empty-Bearer request)
  ```
  This eliminates the dead-code `!provider.id` condition (WR-01) and closes the path where the probe fires with an empty API key, receives a 401, and permanently writes `supportsToolCall=false` (CR-01).

- Restructured the test button from a 2-state ternary to a 3-state tree:
  1. `!provider?.id` → `aria-disabled="true"` + title `"保存后可测试"` + `onClick={e.preventDefault()}`
  2. `provider?.id && !apiKey.trim()` → `aria-disabled="true"` + title `"输入 Key 后可测试"` + `onClick={e.preventDefault()}`
  3. `provider?.id && apiKey.trim()` → clickable, `disabled={testState === 'loading'}`

- **Security note:** `getKey()` from `providers.ts` was NOT introduced into the UI layer (T-02-18 constraint respected). The guard simply requires the user to re-enter their key in the form field before testing — this is both secure and user-friendly since the probe needs a live key.

- Updated `ProviderForm.test.tsx`:
  - Added `fireEvent` import
  - Updated comment on "已保存 Provider 渲染按钮" test to note CR-01 initial state
  - Added new test: saved provider + empty key → `aria-disabled="true"` + title `"输入 Key 后可测试"`
  - Added CR-01 regression guard test: `fireEvent.click` on aria-disabled button → `probeToolCallSupport` NOT called

---

### WR-02: Split `<Trans>` ternary for Lingui extraction

**Files modified:** `src/components/Settings/ProviderForm.tsx` (already applied in CR-01 commit), `src/i18n/locales/zh-CN/messages.po`
**Commit:** `d2ea295`
**Applied fix:**

Changed the test button's loading/idle label from:
```tsx
<Trans>{testState === 'loading' ? '测试中...' : '测试 tool calling'}</Trans>
```
to per-branch `<Trans>` macros in the clickable branch:
```tsx
{testState === 'loading' ? <Trans>测试中...</Trans> : <Trans>测试 tool calling</Trans>}
```

Ran `npm run extract` to update messages.po:
- Old `{0}` interpolation placeholder marked as obsolete `#~`
- `"测试中..."` extracted as a new independent catalog entry
- `"输入 Key 后可测试"` extracted as a new catalog entry (from the new no-key disabled button)

---

## Deferred (not in scope)

### IN-01: Safety-net AbortError returns `false` for `decided=true` case

**File:** `src/providers/probeToolCall.ts:84`
**Reason:** Deferred by team-lead instruction. The abort-safety-net path is unreachable in production (synchronous `return true/false` at lines 61/67 execute before any microtask can re-throw AbortError into the catch). The probe logic is verified-green and was not modified.

---

## Gate Results

| Gate | Result | Detail |
|------|--------|--------|
| `npm test` (tsc + vitest) | ✅ PASS | 49 test files, 601 tests passed |
| `retry.test.ts` | ✅ 9/9 (known flaky — unhandled rejections only) | All 9 assertions pass |
| `npm run build` | ✅ PASS | Built in 1.63s, no new warnings |
| `npm run size` | ✅ 73.42 KB gzipped (≤82 KB) | No bundle regression |
| `getKey()` not in UI | ✅ CONFIRMED | Only `setSupportsToolCall` accessed via `getState()` |
| `git push` | ✅ NOT DONE | As instructed |

---

_Fixed: 2026-05-30T17:10:00+08:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
