---
phase: 07-uat-sideload-release-prep
reviewed: 2026-05-30T00:00:00Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - src/providers/probeToolCall.ts
  - src/providers/probeToolCall.test.ts
  - src/agent/agentStore.ts
  - src/agent/agentStore.test.ts
  - src/components/Settings/ProviderForm.tsx
  - src/components/Settings/ProviderList.tsx
  - src/components/ErrorBubble.tsx
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 07 Wave 1–2: Code Review Report

**Reviewed:** 2026-05-30
**Depth:** deep (cross-file call-chain tracing)
**Files Reviewed:** 7
**Status:** issues_found — 1 BLOCKER must be fixed before real-machine UAT touches edit-mode provider testing

---

## Summary

Review covers the A-21 tool-call compatibility probe (`probeToolCall.ts`), the pre-flight guard in `agentStore.ts`, the test button in `ProviderForm.tsx`, the badge three-state in `ProviderList.tsx`, the UNSUPPORTED entry in `ErrorBubble.tsx`, and the agent-positioning README rewrite.

**Most dimensions are sound:**
- Security: API Key is never logged, echoed, or surfaced in error messages — T-07-01 satisfied throughout. `sse.ts` extracts `apiKey` from the body object and puts it in `Authorization: Bearer`, keeping the wire body clean.
- Pre-flight guard: `=== false` (strict) correctly passes `null`/`undefined`; guard fires before `beginRun`; UNSUPPORTED error copy reads `gpt-5.1` (not gpt-4o). ✓
- Unsaved-provider safety: `!provider?.id` guard is present; no `?? 'temp'` fallback; `aria-disabled="true"` + `onClick={e.preventDefault()}` pattern for the new-provider branch. ✓
- Badge three-state: `=== true / === false` (neither renders on `undefined`/`null`). ✓
- README: no phantom refs (REL-01/03/04, NFR-06 all gone), no Fluent UI claim, bundle ~73.3 KB, honest "作者自用+开源" framing, privacy section present. ✓
- Test coverage: pre-flight three-state (`false`/`null`/`undefined`) all exercised; probe three-state exercised including timeout path. ✓

**One BLOCKER found** in `ProviderForm.tsx`: the second condition of the empty-key guard is dead code, leaving a path where the probe fires with an empty API key, receives a 401, and permanently writes `supportsToolCall = false` to a valid provider.

---

## Critical Issues

### CR-01: Probe fires with empty `apiKey` in edit mode — permanently marks valid provider as not-supported

**File:** `src/components/Settings/ProviderForm.tsx:100–122`

**Issue:**

The `apiKey` form field is initialized to `''` by design (security: never pre-filled). In edit mode the user sees the provider form with a blank key field. The guard at line 103 is **dead code**:

```ts
if (!provider?.id) return;                    // line 102 — OK: guards on unsaved provider
if (!apiKey.trim() && !provider.id) return;  // line 103 — BUG: second condition always false
```

Because execution can only reach line 103 when `provider?.id` is already truthy (guaranteed by line 102), `!provider.id` is always `false`. The compound `&&` never evaluates to `true`. The intended guard (abort probe if no key available) silently provides zero protection.

**Concrete failure path:**

1. User has a saved custom provider with a valid API key stored in localStorage.
2. User opens ProviderForm to edit (e.g., change the model).
3. `apiKey` state = `''` (form starts blank — intentional, security).
4. User clicks "测试 tool calling" without entering a key.
5. `config.apiKey = ''.trim() = ''` → `streamSSE` sends `Authorization: Bearer ` (empty bearer).
6. Provider returns 401. `mapHttpError(401)` → `KeyInvalidError`. Error propagates through `streamChat`'s re-throw path.
7. `probeToolCallSupport` catch block: not AbortError → **`return false`**.
8. `handleTestToolCall`: `result === false` → **`setSupportsToolCall(provider.id, false)`** → written to localStorage.
9. Provider now permanently marked as not-supporting tool calls.
10. Next `runAgent` call hits the pre-flight guard, pushes UNSUPPORTED error, returns — **valid provider is silently blocked forever** (until the user re-opens the form and clicks test again with a key entered).

Note: `probeToolCallSupport` treats *all* non-abort errors as `false` (line 89: "4xx 等其他网络错误：视为不支持"), which is what makes a 401 indistinguishable from a genuine "provider doesn't support tool calling" response.

**Fix:**

Fall back to the stored key when the form field is empty, and bail out if no key is available at all:

```ts
const handleTestToolCall = async () => {
  if (!provider?.id) return;

  // Resolve effective key: form field takes priority (user may be updating it),
  // fall back to the stored key (edit mode — field intentionally starts blank).
  const storedKey = useProviderStore.getState().getKey(provider.id);
  const effectiveApiKey = apiKey.trim() || storedKey || '';
  if (!effectiveApiKey) return; // No key at all — can't probe meaningfully

  setTestState('loading');
  const config = {
    providerId: provider.id,
    baseURL: isBuiltIn ? (provider.baseURL ?? '') : baseURL.trim(),
    apiKey: effectiveApiKey,
    model: model.trim(),
  };
  const result = await probeToolCallSupport(config);
  // … rest unchanged
};
```

---

## Warnings

### WR-01: Dead guard condition (`!provider.id`) gives false assurance

**File:** `src/components/Settings/ProviderForm.tsx:103`

**Issue:**

```ts
if (!apiKey.trim() && !provider.id) return;
```

The `!provider.id` sub-expression is unreachable (line 102 already returns if `provider?.id` is falsy). The dead condition misleads readers into believing there is a "no key + no id" protection that doesn't exist.

**Fix:** Remove the dead line after applying the CR-01 fix above. The `effectiveApiKey` guard in the CR-01 fix fully replaces it.

---

### WR-02: `<Trans>` wrapping a ternary expression — Lingui won't extract either string

**File:** `src/components/Settings/ProviderForm.tsx:235`

**Issue:**

```tsx
<Trans>{testState === 'loading' ? '测试中...' : '测试 tool calling'}</Trans>
```

Lingui's `<Trans>` macro extracts *static* strings at compile time. A ternary expression inside `<Trans>` is treated as a single interpolated slot (`{0}`), not as two extractable strings. Neither `'测试中...'` nor `'测试 tool calling'` will appear in `messages.po`.

The strings render correctly in zh-CN v1 (the ternary evaluates to the right string at runtime), so there is no visible breakage today. But when the English catalog is added for v1.1, these two strings will be missing and will display raw Chinese regardless of locale.

**Fix:**

```tsx
{testState === 'loading' ? <Trans>测试中...</Trans> : <Trans>测试 tool calling</Trans>}
```

---

## Info

### IN-01: Safety-net AbortError catch returns `false` for `decided=true` case

**File:** `src/providers/probeToolCall.ts:84–85`

**Issue:**

```ts
if (e instanceof Error && e.name === 'AbortError') {
  return decided ? false : null;  // should be: decided ? true : null  (for tool_call path)
}
```

When `decided = true` means "we saw a `tool_call_delta`" (correct decision: `true`), the safety net returns `false` instead of the actual result. In practice this path is **unreachable**: the `return true` / `return false` statements at lines 61/67 execute synchronously before any microtask can re-throw the AbortError into the `catch`, so the safety net never fires with `decided = true`.

The code is correct in production. It is semantically inaccurate as a defensive safety net — if the runtime behavior changes (e.g., AbortError propagation rules differ in a future engine), the wrong value would be returned.

**Fix (optional, low priority):**

```ts
// Capture the actual decision before abort
let decidedValue: boolean = false; // true=supported, false=unsupported

// … inside the loop, before setting decided=true:
decidedValue = (event.type === 'tool_call_delta' || event.type === 'tool_call_end');
decided = true;
controller.abort();
return decidedValue;

// … in catch:
if (e instanceof Error && e.name === 'AbortError') {
  return decided ? decidedValue : null;
}
```

---

## Dimension Checklist

| Dimension | Status | Notes |
|-----------|--------|-------|
| Security — API Key leak | ✓ CLEAN | No log/echo of Key in any path reviewed |
| Pre-flight correctness | ✓ CLEAN | Strict `=== false`; guard before `beginRun`; copy uses `gpt-5.1` |
| Unsaved-provider safety | ✓ CLEAN | `!provider?.id` guard; no `?? 'temp'`; aria-disabled pattern correct |
| Probe logic (decided sentinel) | ✓ CLEAN | `tool_call_delta`/`tool_call_end` → `true`; `delta` → `false`; timeout → `null` |
| Probe with empty key (edit mode) | ✗ **BLOCKER CR-01** | Dead guard; probe fires with empty auth; corrupts `supportsToolCall` |
| Design compliance | WARN WR-02 | `<Trans>` ternary; rest (btn-ghost/btn-sm, badge-success/badge-error) correct |
| Lingui wrapping | WARN WR-02 | Two strings not extractable |
| README accuracy | ✓ CLEAN | No phantom refs; correct bundle size; honest framing; privacy section kept |
| Circular-dep guard | ✓ CLEAN | `useChatStore` dynamic import in `agentStore.runAgent` is sound |

---

## UAT Safety Assessment

**Not safe for unguided edit-mode UAT** due to CR-01.

**Safe for:** New provider setup (user enters API key in the form → probe uses it → correct result).

**Unsafe for:** Editing an existing provider without re-entering the API key → triggers the empty-key probe → corrupts `supportsToolCall = false` → agent silently blocked on next run.

**Recommended action before UAT:** Apply the CR-01 fix (3-line change). WR-01 is then auto-resolved. WR-02 is a Lingui extraction issue with zero runtime impact in zh-CN v1 — can be deferred to v1.1 i18n prep.

---

_Reviewed: 2026-05-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
