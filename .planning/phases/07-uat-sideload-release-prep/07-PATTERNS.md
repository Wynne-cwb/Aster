# Phase 7: UAT + Sideload Release Prep — Pattern Map

**Mapped:** 2026-05-30
**Files analyzed:** 6 (code files; README.md and ROADMAP.md are docs, noted separately)
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/providers/probeToolCall.ts` (NEW) | service / utility | request-response (single-shot fetch via AsyncGenerator) | `src/providers/openai-compat.ts` | exact — same `streamChat` API, same SSEEvent consumer pattern |
| `src/providers/probeToolCall.test.ts` (NEW) | test | — | `src/providers/openai-compat.test.ts` | exact — same vi.mock(sse)/vi.mock(queue)/vi.mock(retry) pattern |
| `src/components/Settings/ProviderForm.tsx` (MODIFY) | component | request-response (button → async probe → write-back) | `src/components/Settings/ProviderForm.tsx` (itself, existing patterns) | self-analog — btn/btn-ghost/btn-sm + useState + aster-form-field |
| `src/components/Settings/ProviderList.tsx` (MODIFY) | component | CRUD / display | `src/components/Settings/ProviderList.tsx` (itself, badge lines) | self-analog — badge / badge-success / badge-accent className pattern |
| `src/agent/agentStore.ts` (MODIFY) | store / state-machine | event-driven (guard before side-effect) | `src/agent/agentStore.ts` (itself, existing guards in `runAgent`) | self-analog — Zustand `get()` guard + early return |
| `src/store/providers.ts` (VERIFY) | store | CRUD | `src/store/providers.ts` (already exists at lines 185-191) | self-analog — `setSupportsToolCall` signature confirmed |

---

## Pattern Assignments

### `src/providers/probeToolCall.ts` (NEW — service, request-response)

**Analog:** `src/providers/openai-compat.ts`

**Imports pattern** (openai-compat.ts lines 19-34):
```typescript
import type { LLMProvider, LLMConfig, ChatMessage } from './types';
import type { SSEEvent } from '../lib/sse';
import type { OpenAIToolWire } from './openai-compat';   // reuse existing wire type
import { OpenAICompatibleLLM } from './openai-compat';
import { useProviderStore } from '../store/providers';
```

**Core pattern — consume AsyncGenerator from `streamChat`** (openai-compat.ts lines 37-69):
```typescript
// streamChat returns AsyncGenerator<SSEEvent>; probe iterates it and
// early-returns on the FIRST decisive event.
const llm = new OpenAICompatibleLLM();
const gen = llm.streamChat(messages, config, signal, tools);
for await (const event of gen) {
  // SSEEvent union discriminated by `.type` field — confirmed in src/lib/sse.ts line 82:
  //   SSEEvent = SSEDelta | ReasoningDelta | SSEUsage | ToolCallDelta | ToolCallEnd
  //
  // Probe decision logic:
  //   type === 'tool_call_delta'  → true  (first tool_calls chunk arrived)
  //   type === 'tool_call_end'    → true  (finish_reason='tool_calls' flush)
  //   type === 'delta'            → false (got text, no tool call; model answered without calling)
  // AbortController abort() exits the generator via the caller's signal.
}
```

**VERIFIED SSEEvent discriminant fields** (src/lib/sse.ts lines 27-82):

| type | Fields | Probe meaning |
|---|---|---|
| `'delta'` | `content: string` | Model answered with text; no tool call → `false` |
| `'tool_call_delta'` | `index, id?, name?, argumentsChunk` | Tool call streaming in → `true` |
| `'tool_call_end'` | `index, id, name, arguments` | Tool call complete (finish_reason=tool_calls) → `true` |
| `'reasoning_delta'` | `content` | DeepSeek thinking; ignore in probe |
| `'usage'` | `promptTokens, completionTokens, totalTokens` | Ignore in probe |

**AbortError / error handling pattern** (openai-compat.ts lines 50-68):
```typescript
try {
  // ... generator consume loop ...
} catch (e) {
  if (e instanceof Error && e.name === 'AbortError') {
    return null; // timeout abort → caller interprets as "network issue, don't write back"
  }
  // 4xx with tool keyword: openai-compat passive detection already wrote false
  // to providerStore; probe returns false for any other error too.
  return false;
} finally {
  clearTimeout(timer);
}
```

**Write-back pattern** — call `setSupportsToolCall` (providers.ts lines 185-191):
```typescript
// Signature (VERIFIED):
setSupportsToolCall(providerId: string, supports: boolean): void
// Implementation: map providers, patch matching id, set() + storage.set()

// Call site in probe:
useProviderStore.getState().setSupportsToolCall(config.providerId, result);
```

**D-03: isBuiltIn skip** — probe should NOT be called for built-in providers. Guard in ProviderForm (the caller), not inside probeToolCall itself. probeToolCall is a pure function; caller decides when to invoke.

**VERIFIED `OpenAIToolWire` type** (openai-compat.ts lines 26-29):
```typescript
export interface OpenAIToolWire {
  type: 'function';
  function: { name: string; description: string; parameters: object };
}
```

**VERIFIED `LLMConfig` type** (types.ts lines 34-39):
```typescript
export interface LLMConfig {
  providerId: string;
  baseURL: string;
  apiKey: string;
  model: string;
}
```

**VERIFIED `ProviderConfig.supportsToolCall`** (types.ts lines 123-132):
```typescript
interface ProviderConfig {
  // ...
  supportsToolCall?: boolean | null;
  // null = 未探测 / true = 支持 / false = 曾探测失败
}
```

---

### `src/providers/probeToolCall.test.ts` (NEW — test)

**Analog:** `src/providers/openai-compat.test.ts`

**Test file structure — imports + mock setup** (openai-compat.test.ts lines 1-57):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mock streamSSE FIRST (before importing the module under test)
vi.mock('../lib/sse', async () => {
  const actual = await vi.importActual<typeof import('../lib/sse')>('../lib/sse');
  return {
    ...actual,
    streamSSE: vi.fn(async function* mockStreamSSE(_url: string, body: unknown) {
      capturedBodies.push(body);
      // yield events to simulate provider responses
    }),
  };
});

// 2. Mock singleFlight + withRetry as passthroughs
vi.mock('./queue', async () => {
  const actual = await vi.importActual<typeof import('./queue')>('./queue');
  return { ...actual, singleFlight: vi.fn(async (_id, fn) => await fn()) };
});
vi.mock('./retry', async () => {
  const actual = await vi.importActual<typeof import('./retry')>('./retry');
  return { ...actual, withRetry: vi.fn(async (fn) => await fn()) };
});

// 3. Import module under test AFTER mocks
import { OpenAICompatibleLLM } from './openai-compat';
import { useProviderStore } from '../store/providers';

// 4. Reset store state in beforeEach
beforeEach(() => {
  useProviderStore.setState({
    providers: [{ id: 'deepseek', name: 'DeepSeek', baseURL: '...', model: '...', isBuiltIn: true }],
    defaultLLMProviderId: 'deepseek',
  } as never);
});
```

**Test case pattern for probeToolCall.test.ts** — mock streamSSE to yield specific events:
```typescript
// To test "returns true when tool_call_delta received":
streamSSE: vi.fn(async function* () {
  yield { type: 'tool_call_delta', index: 0, argumentsChunk: '' };
});

// To test "returns false when only delta received (text answer)":
streamSSE: vi.fn(async function* () {
  yield { type: 'delta', content: 'I cannot use tools.' };
});

// To test "returns null on abort (timeout)":
// Yield nothing; AbortController aborts before generator ends.
```

**Three cases to cover per RESEARCH.md Wave 0 Gaps:**
1. `true` — `tool_call_delta` or `tool_call_end` received before any `delta`
2. `false` — only `delta` content received (no tool call)
3. `null` — AbortError thrown (10s timeout simulated via AbortController.abort())

---

### `src/components/Settings/ProviderForm.tsx` (MODIFY — component, request-response)

**Analog:** The file itself — existing patterns at lines 160-241.

**`isBuiltIn` guard pattern** (ProviderForm.tsx lines 46, 120-136, 165):
```typescript
const isBuiltIn = provider?.isBuiltIn ?? false;

// Conditional rendering for custom-only fields:
{!isBuiltIn && (
  <div className="aster-form-field">
    ...
  </div>
)}

// Conditional rendering for built-in select vs custom text input:
{isBuiltIn ? (
  <div className="select-wrap">
    <select className="input select" ...>...</select>
    <span className="select-caret"><ChevronDownIcon size={14} /></span>
  </div>
) : (
  <input ref={modelRef} type="text" className="input" ... />
)}
```

**Button pattern** (ProviderForm.tsx lines 228-237):
```typescript
// Ghost secondary button (used for Cancel — copy for test button):
<button
  type="button"
  className="btn btn-ghost btn-sm"
  onClick={onCancel}
>
  <Trans>取消</Trans>
</button>

// Primary submit button:
<button type="submit" className="btn btn-primary btn-sm">
  <Trans>保存</Trans>
</button>
```

**New test button — insert after model field (line 194), before apiKey field (line 196)**:
```tsx
// D-01: Test button only for non-built-in providers (or built-in with custom model)
// D-03: Built-in providers hardcode supportsToolCall=true, skip test
{!isBuiltIn && (
  <div className="aster-form-field">
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={handleTestToolCall}
      disabled={testState === 'loading' || !apiKey.trim()}
    >
      {testState === 'loading' ? '测试中...' : '测试 tool calling'}
    </button>
    {testState === 'supported' && (
      <span className="badge badge-success">✓ 支持</span>
    )}
    {testState === 'unsupported' && (
      <span className="badge badge-accent">✗ 不支持</span>
    )}
  </div>
)}
```

**`useState` pattern for async operation state** (ProviderForm.tsx line 52):
```typescript
// Existing pattern — boolean/string local state for loading/error:
const [errors, setErrors] = useState<Record<string, string>>({});

// New test state — add alongside existing useState declarations:
type TestState = 'idle' | 'loading' | 'supported' | 'unsupported';
const [testState, setTestState] = useState<TestState>('idle');
```

**Form field wrapper pattern** (ProviderForm.tsx lines 121-136):
```tsx
<div className="aster-form-field">
  <label className="aster-form-label" htmlFor="pf-name">
    <Trans>名称</Trans>
  </label>
  <input
    id="pf-name"
    type="text"
    className={`input${errors.name ? ' input--error' : ''}`}
    value={name}
    onChange={(e) => setName(e.target.value)}
    placeholder={t`自定义 Provider 名称`}
  />
  {errors.name && <p className="aster-form-error">{errors.name}</p>}
</div>
```

---

### `src/components/Settings/ProviderList.tsx` (MODIFY — component, display/CRUD)

**Analog:** The file itself — existing badge lines 83-90.

**VERIFIED badge className body** (ProviderList.tsx lines 83-90):
```tsx
{provider.isBuiltIn && (
  <span className="badge badge-accent">
    <Trans>默认</Trans>
  </span>
)}
{hasKey
  ? <span className="badge badge-success"><Trans>已配 Key</Trans></span>
  : <span className="badge"><Trans>未配 Key</Trans></span>
}
```

**Three existing badge classes (VERIFIED):**
- `badge` — neutral/grey (e.g., "未配 Key")
- `badge badge-success` — green (e.g., "已配 Key")
- `badge badge-accent` — teal/accent (e.g., "默认")

**New badge for supportsToolCall — map to existing classes per RESEARCH.md:**

| `supportsToolCall` value | Badge text | className |
|---|---|---|
| `undefined` / `null` | 未测试 | `badge` (grey) |
| `true` | ✓ tool call | `badge badge-success` |
| `false` | ✗ 不支持 | `badge badge-accent` OR new `badge-error` |

**NOTE on `badge-error`:** RESEARCH.md Open Question 2 — it is UNKNOWN whether `badge-error` exists in `src/styles.css`. Planner must check `src/styles.css` before using it. Safe fallback: `badge badge-accent` for `false` state. If planner adds `badge-error`, add it as a CSS variable in `src/styles.css` following the `--accent` token system.

**Insert pattern — add supportsToolCall badge alongside existing badges in `pname-line` div** (ProviderList.tsx lines 81-91):
```tsx
<div className="pname-line">
  <span className="pname">{provider.name}</span>
  {provider.isBuiltIn && <span className="badge badge-accent"><Trans>默认</Trans></span>}
  {hasKey
    ? <span className="badge badge-success"><Trans>已配 Key</Trans></span>
    : <span className="badge"><Trans>未配 Key</Trans></span>}
  {/* ADD: supportsToolCall badge — only show if not undefined (i.e., has been tested) */}
  {provider.supportsToolCall === true && (
    <span className="badge badge-success">✓ tool call</span>
  )}
  {provider.supportsToolCall === false && (
    <span className="badge badge-accent">✗ 不支持</span>
  )}
</div>
```

**Zustand selector pattern** (ProviderList.tsx lines 36-39):
```typescript
// Read from store with selector (reactive):
const providers = useProviderStore((s) => s.providers);
// providers array already has supportsToolCall field per ProviderConfig type.
// No new selector needed — field is already in the array element.
```

---

### `src/agent/agentStore.ts` (MODIFY — store/state-machine, event-driven guard)

**Analog:** The file itself — `runAgent` at lines 175-188.

**VERIFIED `runAgent` current implementation** (agentStore.ts lines 175-188):
```typescript
async runAgent(prompt, selectionCtx, adapter) {
  const runId = crypto.randomUUID();
  const controller = get().beginRun(runId);
  try {
    // Dynamic import to keep loop.ts out of initial chunk (bundle guard)
    const { runAgent: runAgentLoop } = await import('./loop');
    await runAgentLoop(prompt, selectionCtx, adapter, controller.signal, runId);
  } finally {
    // Fallback endRun — loop exits or soft-lands
    if (get().agentStatus !== 'soft-landing') {
      get().endRun();
    }
  }
},
```

**Pre-flight guard insertion point — BEFORE `beginRun` call** (insert at line 175, before line 176):
```typescript
async runAgent(prompt, selectionCtx, adapter) {
  // A-21 pre-flight: only block if supportsToolCall is explicitly false
  // null / undefined = not tested → allow through (RESEARCH Pitfall 2: strict === false)
  const providerStore = useProviderStore.getState();
  const currentProvider = providerStore.providers.find(
    (p) => p.id === providerStore.defaultLLMProviderId,
  );
  if (currentProvider?.supportsToolCall === false) {
    // Push error to chat; do NOT call beginRun, do NOT fire any LLM call
    // Error message from CONTEXT.md D-02 + §Specifics (gpt-4o → gpt-5.1 per BUILTIN_MODEL_OPTIONS):
    useChatStore.getState().pushMessage({
      role: 'error',
      content: '当前 Provider/Model 不支持 tool calling，请切到 DeepSeek-V4 或 gpt-5.1',
      errorCode: 'UNSUPPORTED',
    });
    return;
  }

  const runId = crypto.randomUUID();
  const controller = get().beginRun(runId);
  // ... rest unchanged ...
```

**Existing guard pattern for `get()` reads** (agentStore.ts lines 116, 124-127):
```typescript
pause() {
  if (get().agentStatus === 'running') set({ agentStatus: 'paused' });
},
abort(reason) {
  set({ lastAbortReason: reason, agentStatus: 'idle' });
  get().controller?.abort();
},
```

**Note on `useChatStore` import:** Check `src/store/chat.ts` for the actual `pushMessage` signature before inserting. RESEARCH.md line 137-142 references `chat.ts` lines 137-142 as the `sendMessage` thin-delegate path. `agentStore.ts` may need a new import for `useChatStore`.

**Test case to add in `agentStore.test.ts`** (following existing pattern at agentStore.test.ts lines 1-16):
```typescript
// New describe block — mirrors existing structure:
describe('agentStore A-21 pre-flight拦截', () => {
  it('supportsToolCall===false → runAgent 推 error 并 return（不 beginRun）', async () => {
    // Setup providerStore with supportsToolCall:false
    // Call runAgent
    // Assert agentStatus remains 'idle' (beginRun not called)
    // Assert error message pushed to chatStore
  });

  it('supportsToolCall===null → runAgent 放行（未测试状态不拦截）', async () => { ... });
  it('supportsToolCall===undefined → runAgent 放行', async () => { ... });
});
```

---

### `src/store/providers.ts` — `setSupportsToolCall` (VERIFY only, no modification needed)

**VERIFIED signature** (providers.ts lines 109-110, 185-191):
```typescript
// Interface declaration (line 109-110):
setSupportsToolCall(providerId: string, supports: boolean): void;

// Implementation (lines 185-191):
setSupportsToolCall(providerId, supports) {
  const updated = get().providers.map((p) =>
    p.id === providerId ? { ...p, supportsToolCall: supports } : p,
  );
  set({ providers: updated });
  storage.set(STORAGE_KEYS.PROVIDERS, updated);
},
```

**VERIFIED `BUILTIN_MODEL_OPTIONS`** (providers.ts lines 30-34):
```typescript
export const BUILTIN_MODEL_OPTIONS: Record<string, string[]> = {
  deepseek: ['deepseek-v4-pro', 'deepseek-v4-flash'],
  aihubmix: ['gpt-5.1', 'gemini-3.5-flash'],
};
```

D-03 internal logic: built-in providers (`isBuiltIn: true`) map to `deepseek` and `aihubmix` ids. Both appear in `BUILTIN_MODEL_OPTIONS`. All models in this list are hardcoded `supportsToolCall=true`. The test button should not appear for built-in providers — guard on `!isBuiltIn` in ProviderForm.

---

## Shared Patterns

### CSS Design System (teal quiet) — applies to ProviderForm and ProviderList UI changes
**Source:** `src/styles.css` (verified via CLAUDE.md §UI 设计系统 + skill aster-design-system)
**Apply to:** Any new UI element in ProviderForm.tsx and ProviderList.tsx

Rules:
- Use existing CSS variables: `--accent`, `--surface`, `--text`, `--border`
- New button: `className="btn btn-ghost btn-sm"` — matches existing Cancel button in ProviderForm footer
- New badge: reuse `badge`, `badge-success`, `badge-accent` classNames (VERIFIED in ProviderList.tsx)
- No inline color values; no backdrop-filter; no gradients
- Both `[data-theme="light"]` and `[data-theme="dark"]` must work (tokens already defined)

### Error handling — applies to probeToolCall.ts
**Source:** `src/providers/openai-compat.ts` lines 50-68
```typescript
catch (e) {
  if (e instanceof Error && e.name === 'AbortError') {
    return; // Silent for user cancel / visibility hide
  }
  if (e instanceof AsterError) throw e;
  throw new NetworkError('网络请求异常，请检查连接');
}
```
Probe variant: AbortError → `return null` (timeout; don't write back). Other errors → `return false` (treat as not supported).

### `type="button"` on non-submit buttons — applies to test button in ProviderForm.tsx
**Source:** `src/components/Settings/ProviderForm.tsx` line 229
```tsx
<button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
```
The test button MUST have `type="button"` to prevent form submission. This is the existing pattern for the Cancel button.

### Zustand `useStore.getState()` cross-store read — applies to agentStore.ts
**Source:** `src/providers/openai-compat.ts` lines 81-83
```typescript
const providers = useProviderStore.getState().providers;
const me = providers.find((p) => p.id === config.providerId);
const shouldAttachTools = me?.supportsToolCall !== false;
```
Pattern: inside a Zustand action or non-component code, use `.getState()` (not hook) to read another store.

### Lingui i18n — applies to any new user-visible strings
**Source:** `src/components/Settings/ProviderForm.tsx` lines 20-21, 107, 116
```tsx
import { Trans, useLingui } from '@lingui/react/macro';
const { t } = useLingui();

// Static strings:
<Trans>编辑 Provider</Trans>

// Dynamic template strings:
placeholder={t`自定义 Provider 名称`}
```
Any new string in ProviderForm or ProviderList must be wrapped with `<Trans>` or `t\`\``.

---

## Docs Files (No Code Analog)

| File | Role | Notes |
|---|---|---|
| `README.md` (rewrite) | documentation | Pure authoring task. No code analog. Follow CONTEXT.md D-06~D-10 and RESEARCH.md "README 重写内容框架". |
| `.planning/ROADMAP.md` (cleanup) | documentation | Apply diff from RESEARCH.md "ROADMAP 文档残留修正清单" table. Seven specific line-level changes. |

---

## No Analog Found

None. All code files have strong analogs within the existing codebase.

---

## Assumptions Resolved by This Mapping

| # | RESEARCH.md Assumption | Status | Resolution |
|---|---|---|---|
| A1 | `SSEEvent` has `type: 'delta' \| 'finish'` and `finishReason` field | CORRECTED | Real fields: `type` discriminant is `'delta' \| 'tool_call_delta' \| 'tool_call_end' \| 'reasoning_delta' \| 'usage'`. No `'finish'` type and no `finishReason` field. `finish_reason='tool_calls'` is handled internally by `streamSSE` which emits `tool_call_end`. Probe must detect `type === 'tool_call_delta'` or `type === 'tool_call_end'` for `true`, and `type === 'delta'` for `false`. |
| — | `setSupportsToolCall` signature | VERIFIED | `setSupportsToolCall(providerId: string, supports: boolean): void` at providers.ts lines 185-191 |
| — | `BUILTIN_MODEL_OPTIONS` content | VERIFIED | `{ deepseek: ['deepseek-v4-pro', 'deepseek-v4-flash'], aihubmix: ['gpt-5.1', 'gemini-3.5-flash'] }` |
| — | badge classes in ProviderList | VERIFIED | `badge`, `badge badge-success`, `badge badge-accent` — three classes confirmed at lines 83-90 |
| — | `isBuiltIn` field accessible in ProviderForm | VERIFIED | `const isBuiltIn = provider?.isBuiltIn ?? false` at line 46 |

---

## Metadata

**Analog search scope:** `src/providers/`, `src/components/Settings/`, `src/agent/`, `src/store/`, `src/lib/`
**Files read:** 8 source files + 2 test files
**Pattern extraction date:** 2026-05-30
