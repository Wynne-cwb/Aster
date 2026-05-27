# Phase 2: Provider 抽象 + Settings + Onboarding + 错误 UX — Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 25 (新建/修改)
**Analogs found:** 23 / 25

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/sse.ts` | utility | streaming | `src/adapters/PptAdapter.ts` (async/await, error wrap) | partial |
| `src/lib/storage.ts` | utility | request-response | `src/adapters/ExcelAdapter.ts` (try/catch, typed return) | partial |
| `src/providers/types.ts` | model | — | `src/adapters/DocumentAdapter.ts` (pure types, 0 imports) | exact |
| `src/providers/registry.ts` | service | request-response | `src/adapters/index.ts` (factory/switch + error throw) | role-match |
| `src/providers/openai-compat.ts` | service | streaming | `src/adapters/PptAdapter.ts` (Office.js async pattern, error wrap) | partial |
| `src/providers/aihubmix-vision.ts` | service | request-response | `src/adapters/WordAdapter.ts` (async method, HostApiError wrap) | partial |
| `src/providers/aihubmix-image.ts` | service | request-response | `src/adapters/ExcelAdapter.ts` (async method, error wrap) | partial |
| `src/providers/queue.ts` | utility | event-driven | `src/adapters/ExcelAdapter.ts` (module-level state, cleanup) | partial |
| `src/providers/retry.ts` | utility | request-response | `src/adapters/PptAdapter.ts` (try/catch + AsterError subclass) | partial |
| `src/providers/pricing.ts` | utility | transform | `src/components/formatSelection.ts` (pure fn, typed input) | role-match |
| `src/store/chat.ts` | store | streaming | `src/context/AdapterContext.ts` (React context export pattern) | partial |
| `src/store/providers.ts` | store | CRUD | `src/context/AdapterContext.ts` (React context export pattern) | partial |
| `src/errors/index.ts` | model | — | `src/errors/index.ts` itself (extend existing 4 classes) | exact |
| `src/components/icons.tsx` | component | — | `src/components/icons.tsx` itself (add 8 icons to existing file) | exact |
| `src/components/ChatBubble.tsx` | component | request-response | `src/components/ContextCard.tsx` (useAdapter, CSS var, Lingui) | role-match |
| `src/components/ErrorBubble.tsx` | component | request-response | `src/components/ContextCard.tsx` (CSS var + state + Lingui) | role-match |
| `src/components/CostBadge.tsx` | component | transform | `src/components/ContextCard.tsx` (display-only, CSS var) | role-match |
| `src/components/SelectionPill.tsx` | component | event-driven | `src/components/ContextCard.tsx` (onSelectionChanged pattern) | exact |
| `src/components/Settings/SettingsPanel.tsx` | component | request-response | `src/components/InputBar.tsx` (CSS shell + Lingui + disabled states) | role-match |
| `src/components/Settings/ProviderList.tsx` | component | CRUD | `src/components/ChatStream.tsx` (useAdapter pattern, host switch) | role-match |
| `src/components/Settings/ProviderForm.tsx` | component | CRUD | `src/components/InputBar.tsx` (form + Lingui + textarea/button patterns) | role-match |
| `src/components/Onboarding/OnboardingModal.tsx` | component | request-response | `src/components/ChatStream.tsx` (host-conditional rendering) | role-match |
| `src/components/Onboarding/Step1Keys.tsx` | component | CRUD | `src/components/InputBar.tsx` (form fields + Lingui + inline text) | role-match |
| `src/components/Onboarding/Step2Guide.tsx` | component | request-response | `src/components/ChatStream.tsx` (useAdapter + host switch + Trans) | exact |
| `src/App.tsx` | component | event-driven | `src/App.tsx` itself (extend existing shell with state) | exact |
| `src/adapters/PptAdapter.ts` | adapter | request-response | `src/adapters/PptAdapter.ts` itself (replace insert stub) | exact |
| `src/adapters/ExcelAdapter.ts` | adapter | request-response | `src/adapters/ExcelAdapter.ts` itself (replace insert stub) | exact |
| `src/adapters/WordAdapter.ts` | adapter | request-response | `src/adapters/WordAdapter.ts` itself (replace insert stub) | exact |

---

## Pattern Assignments

### `src/lib/sse.ts` (utility, streaming)

**Analog:** `src/adapters/PptAdapter.ts` — async generator error-wrapping pattern

**Imports pattern** (PptAdapter.ts lines 13-19):
```typescript
import type {
  DocumentAdapter,
  SelectionContext,
  InsertableContent,
  AdapterCapabilities,
} from './DocumentAdapter';
import { UnsupportedOperationError, HostApiError } from '../errors';
```
For `sse.ts`, equivalent pattern:
```typescript
import { KeyInvalidError, QuotaExceededError, ContextTooLongError, NetworkError,
  RateLimitError, ContentFilterError, ModelNotFoundError, ImageQuotaError } from '../errors';
```

**Error wrapping pattern** (PptAdapter.ts lines 58-61):
```typescript
} catch (err) {
  throw new HostApiError('PowerPoint getSelection 失败', err);
}
```
For `sse.ts`, `mapHttpError` maps `resp.status` to the correct AsterError subclass. Never embed the API key in the message string (T-01-04).

**Core pattern** — async generator (`src/lib/sse.ts` has no analog; use RESEARCH.md shape verbatim):
```typescript
export async function* streamSSE(
  url: string,
  body: object,
  signal: AbortSignal,
): AsyncGenerator<SSEEvent> { ... }
```
Key conventions from RESEARCH.md:
- `stream_options: { include_usage: true }` injected inside the function, never by caller.
- Skip lines not starting with `data:` (handles `: keep-alive`).
- `[DONE]` triggers `return` (generator close).
- Usage chunk detected by `chunk.usage && chunk.usage.total_tokens != null`.

---

### `src/lib/storage.ts` (utility, request-response)

**Analog:** `src/adapters/ExcelAdapter.ts` — try/catch with typed return, module-level stateless utility

**Try/catch returning typed value** (ExcelAdapter.ts lines 26-46):
```typescript
async getSelection(): Promise<SelectionContext> {
  try {
    return await Excel.run(async (ctx) => {
      const range = ctx.workbook.getSelectedRange();
      range.load('address');
      await ctx.sync();
      if (!range.address) {
        return { kind: 'none' } satisfies SelectionContext;
      }
      return { kind: 'excel', address: range.address } satisfies SelectionContext;
    });
  } catch (err) {
    throw new HostApiError('Excel getSelection 失败', err);
  }
}
```
For `storage.ts`, the `get<T>` function catches `JSON.parse` errors and returns `null` (never throws). The `key()` helper reads `Office.context.partitionKey` — available after `Office.onReady`, so `storage` is only called from within Office-ready React components or stores initialized post-onReady.

**Module-level key convention** (from RESEARCH.md, enforced project-wide):
```
aster:providers          ProviderConfig[]
aster:keys:{providerId}  string  (API key, stored separately from config)
aster:onboarding:seen    boolean
aster:selection:autoAttach  boolean
aster:providers:default  string
```

---

### `src/providers/types.ts` (model, pure types)

**Analog:** `src/adapters/DocumentAdapter.ts` — pure types file, 0 runtime imports, JSDoc for every export

**File header pattern** (DocumentAdapter.ts lines 1-9):
```typescript
/**
 * DocumentAdapter — 跨宿主底座契约（FOUND-03/FOUND-04/NFR-04/NFR-05）
 *
 * 本文件为纯类型文件（0 import，无运行时逻辑）。
 * ...
 */
```

**Discriminated union pattern** (DocumentAdapter.ts lines 17-52):
```typescript
export type PptSelectionContext = {
  kind: 'ppt';
  slideIndex: number;
  slideCount: number;
};
// ... other variants
export type SelectionContext =
  | PptSelectionContext
  | ExcelSelectionContext
  | WordSelectionContext
  | NoneSelectionContext;
```
For `types.ts`, export `LLMProvider`, `ImageProvider`, `StockImageProvider` interfaces; `LLMConfig`, `ImageConfig` types; `TaskKind` union type. No runtime logic, no imports from project files.

---

### `src/providers/registry.ts` (service, request-response)

**Analog:** `src/adapters/index.ts` — factory pattern with switch + UnsupportedOperationError

**Factory/switch pattern** (`src/adapters/index.ts` — read from filesystem):
```typescript
export function createAdapter(host: Office.HostType): DocumentAdapter {
  switch (host) {
    case Office.HostType.PowerPoint: return new PptAdapter();
    case Office.HostType.Excel:      return new ExcelAdapter();
    case Office.HostType.Word:       return new WordAdapter();
    default:
      throw new UnsupportedOperationError(`不支持的宿主: ${host}`);
  }
}
```
For `registry.ts`, `ProviderRegistry.resolve(taskKind)` uses the same switch-then-throw pattern. Replace `UnsupportedOperationError` with `ModelNotFoundError` for unknown taskKind. No auto-fallback (PROV-04).

**Error class import pattern** (ExcelAdapter.ts lines 17-18):
```typescript
import { UnsupportedOperationError, HostApiError } from '../errors';
```

---

### `src/providers/openai-compat.ts` (service, streaming)

**Analog:** `src/adapters/PptAdapter.ts` — class implementing an interface, all methods async, error wrapped into typed AsterError

**Class structure** (PptAdapter.ts lines 21-103):
```typescript
export class PptAdapter implements DocumentAdapter {
  async getSelection(): Promise<SelectionContext> {
    try {
      return await PowerPoint.run(async (ctx) => { ... });
    } catch (err) {
      throw new HostApiError('PowerPoint getSelection 失败', err);
    }
  }
  // ... other methods
}
```
For `openai-compat.ts`, `OpenAICompatibleLLM` implements `LLMProvider`. The `streamChat()` method:
1. Calls `singleFlight(config.providerId, () => streamSSE(...))` from `./queue`.
2. Wraps any non-AsterError in `NetworkError`.
3. Never embeds `config.apiKey` in error messages (T-01-04).

**AbortController cleanup pattern** (RESEARCH.md, no existing analog — use `visibilitychange` listener with cleanup returned as a function, mirroring ContextCard's `useEffect` cleanup):
```typescript
// From ContextCard.tsx lines 29-53 — the cleanup pattern
useEffect(() => {
  const unsub = adapter.onSelectionChanged(async () => { ... });
  return () => {
    unsub();
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
  };
}, [adapter, i18n]);
```
For `openai-compat.ts` or the Zustand store's `sendMessage`, the `setupVisibilityAbort` cleanup function must be called in `finally {}`.

---

### `src/providers/aihubmix-vision.ts` and `src/providers/aihubmix-image.ts` (service, request-response)

**Analog:** `src/adapters/WordAdapter.ts` — simple async method, single `try/catch`, error wrapped into typed AsterError

**Simple async method pattern** (WordAdapter.ts lines 23-44):
```typescript
async getSelection(): Promise<SelectionContext> {
  try {
    return await Word.run(async (ctx) => {
      const selection = ctx.document.getSelection();
      selection.load('text');
      await ctx.sync();
      const charCount = selection.text.length;
      if (charCount === 0) return { kind: 'none' } satisfies SelectionContext;
      return { kind: 'word', charCount } satisfies SelectionContext;
    });
  } catch (err) {
    throw new HostApiError('Word getSelection 失败', err);
  }
}
```
For `aihubmix-vision.ts`: `chat(messages, config)` calls `fetch` (non-streaming), parses JSON response. For `aihubmix-image.ts`: `generate(prompt, size, quality, config)` calls `POST /images/generations`, extracts `data[0].b64_json`. Both wrap errors using `mapHttpError` from `../lib/sse`.

---

### `src/providers/queue.ts` (utility, event-driven)

**Analog:** `src/adapters/ExcelAdapter.ts` — module-level state (handlerResult), cleanup function returned

**Module-level mutable state pattern** (ExcelAdapter.ts lines 53-79):
```typescript
onSelectionChanged(callback: () => void): () => void {
  let handlerResult: OfficeExtension.EventHandlerResult<...> | null = null;
  Excel.run(async (ctx) => {
    const worksheet = ctx.workbook.worksheets.getActiveWorksheet();
    handlerResult = worksheet.onSelectionChanged.add(async () => { callback(); });
    await ctx.sync();
  }).catch(() => {});
  return () => {
    if (handlerResult !== null) {
      const result = handlerResult;
      Excel.run(async (ctx) => {
        result.remove();
        await ctx.sync();
      }).catch(() => {});
    }
  };
}
```
For `queue.ts`, `inFlight: Map<string, Promise<void>>` is module-level (not component-level). The pattern mirrors ExcelAdapter's module-scoped `handlerResult`: state lives outside any class instance, cleaned up after use.

---

### `src/providers/retry.ts` (utility, request-response)

**Analog:** `src/errors/index.ts` — AsterError subclass instanceof check

**AsterError instanceof pattern** (errors/index.ts lines 50-54):
```typescript
export class KeyInvalidError extends AsterError {
  constructor(message: string) {
    super(message, 'KEY_INVALID', 'provider');
  }
}
```
For `retry.ts`, `withRetry` catches and checks `e instanceof RateLimitError || e instanceof NetworkError`. Never retry `KeyInvalidError`, `QuotaExceededError`, `ImageQuotaError` (billing class). See RESEARCH.md §指数退避实现 for the full implementation shape.

---

### `src/providers/pricing.ts` (utility, transform)

**Analog:** `src/components/formatSelection.ts` — pure function, typed input, exhaustive switch

**Pure function pattern** (formatSelection.ts lines 18-38):
```typescript
export function formatSelection(sel: SelectionContext, i18n: I18n): string {
  switch (sel.kind) {
    case 'ppt': return i18n._(msg`第 ${sel.slideIndex} 张 slide`);
    // ...
    default: {
      const _exhaustive: never = sel;
      return i18n._(msg`未选中内容`);
    }
  }
}
```
For `pricing.ts`, `calcCostCny(usage, providerId)` returns `number | null` (null for custom providers). No i18n needed; this is a calculation utility. The `PROVIDER_PRICING` constant map and `CNY_PER_USD = 7.25` are module-level constants, not exported.

---

### `src/store/chat.ts` and `src/store/providers.ts` (store, streaming / CRUD)

**Analog:** `src/context/AdapterContext.ts` — React-layer state with typed interface, exported hook

**Context/hook export pattern** (AdapterContext.ts lines 7-28):
```typescript
import { createContext, useContext } from 'react';
import type { DocumentAdapter } from '../adapters';

export const AdapterContext = createContext<DocumentAdapter | null>(null);

export function useAdapter(): DocumentAdapter {
  const adapter = useContext(AdapterContext);
  if (!adapter) {
    throw new Error('useAdapter 必须在 AdapterContext.Provider 内调用');
  }
  return adapter;
}
```
For Zustand stores, the pattern becomes:
```typescript
import { create } from 'zustand';
// ... interface definition
export const useChatStore = create<ChatState>((set, get) => ({ ... }));
// Named selector exports for performance (avoids full re-render on unrelated state change)
export const useMessages = () => useChatStore((s) => s.messages);
export const useIsStreaming = () => useChatStore((s) => s.isStreaming);
```

**Store initialization hook** — `providerStore` must be hydrated from `storage` after `Office.onReady`. Mirror `main.tsx`'s `Office.onReady` callback pattern (main.tsx lines 44-64): store hydration happens inside the callback, before `root.render`.

---

### `src/errors/index.ts` — Phase 2 additions (model)

**Analog:** `src/errors/index.ts` itself — copy existing AsterError subclass pattern exactly

**Existing subclass pattern** (errors/index.ts lines 50-54 / 61-65 / 72-76 / 83-87):
```typescript
export class KeyInvalidError extends AsterError {
  constructor(message: string) {
    super(message, 'KEY_INVALID', 'provider');
  }
}
```
Phase 2 adds 4 new classes following the same structure:
- `RateLimitError` — code `'RATE_LIMIT'`, additional `retryAfterSeconds?: number` field
- `ContentFilterError` — code `'FILTER'`
- `ModelNotFoundError` — code `'MODEL'`
- `ImageQuotaError` — code `'IMAGE_QUOTA'`

All use `category: 'provider'`. Keep the T-01-04 security comment.

---

### `src/components/icons.tsx` — Phase 2 additions

**Analog:** `src/components/icons.tsx` itself — copy `base` spread pattern exactly

**Icon pattern** (icons.tsx lines 9-17, 19-29):
```typescript
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function SettingsIcon(): ReactElement {
  return (
    <svg {...base}>
      <line x1="4" y1="8" x2="20" y2="8" />
      <circle cx="9" cy="8" r="2.4" />
    </svg>
  );
}
```
Phase 2 appends 8 icons: `StopIcon`, `InsertIcon`, `RetryIcon`, `XIcon`, `AlertIcon`, `PlusIcon`, `TrashIcon`, `CheckIcon`. All use `{...base}`, all return `ReactElement`, all named exports.

---

### `src/components/ChatBubble.tsx` (component, request-response)

**Analog:** `src/components/ContextCard.tsx` — CSS class + Lingui + conditional class

**CSS conditional class pattern** (ContextCard.tsx lines 57-63):
```typescript
return (
  <div className={`aster-context${isPulsing ? ' is-pulsing' : ''}`}>
    <span className="aster-context__icon"><ChevronIcon /></span>
    <span className="aster-context__text">{ctx}</span>
  </div>
);
```
For `ChatBubble.tsx`, the conditional is `role === 'user' | 'assistant' | 'error'`:
```tsx
<div className={`aster-bubble aster-bubble--${message.role}`}>
```
User bubbles have no `react-markdown`; assistant bubbles use `<ReactMarkdown remarkPlugins={[remarkGfm]}>`. Error bubbles render `<ErrorBubble>` instead.

**Lingui import pattern** (InputBar.tsx line 13 / ContextCard.tsx line 13):
```typescript
import { useLingui } from '@lingui/react/macro';
// or
import { Trans } from '@lingui/react/macro';
```
Use `<Trans>` for static strings in JSX; use `const { t } = useLingui()` for strings passed as props/attributes.

---

### `src/components/ErrorBubble.tsx` (component, request-response)

**Analog:** `src/components/ContextCard.tsx` — state + CSS + Lingui + icon

**State + effect pattern** (ContextCard.tsx lines 22-54):
```typescript
const [ctx, setCtx] = useState<string>(() => t`未选中内容`);
const [isPulsing, setIsPulsing] = useState(false);
const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  // ... subscription + cleanup
  return () => {
    unsub();
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
  };
}, [adapter, i18n]);
```
For `ErrorBubble.tsx`, no `useEffect` needed (pure display). Props are `{ errorCode: string, message: string, retryPrompt?: string, onRetry: () => void, onSettings: (anchor?: string) => void }`. CTA button for deep-link calls `onSettings('deepseek-key')` — the string is the Settings anchor ID (D-12).

**Icon usage pattern** (ContextCard.tsx lines 58-60, icons.tsx):
```typescript
import { ChevronIcon } from './icons';
// ...
<span className="aster-context__icon"><ChevronIcon /></span>
```
For `ErrorBubble.tsx`, import `AlertIcon`, `RetryIcon` from `./icons`.

---

### `src/components/CostBadge.tsx` (component, transform)

**Analog:** `src/components/ContextCard.tsx` — small display component, CSS class, no side effects

**Small display component pattern** (ContextCard.tsx lines 56-64, stripped down for CostBadge):
```typescript
export default function CostBadge({ tokenCount, costCny }: Props): ReactElement {
  const { t } = useLingui();
  // costCny === null means custom provider — show only token count
  const label = costCny != null
    ? t`本次：${tokenCount} token · 约 ¥${costCny.toFixed(4)}`
    : t`本次：${tokenCount} token`;
  return <span className="aster-cost-badge">{label}</span>;
}
```
Add `.aster-cost-badge` to `styles.css` using existing token variables (`--text-3`, `--sp-1`, `--r-pill`, `font-size: 11px`).

---

### `src/components/SelectionPill.tsx` (component, event-driven)

**Analog:** `src/components/ContextCard.tsx` — exact same pattern: useAdapter + onSelectionChanged + cleanup

**Full useAdapter + subscription pattern** (ContextCard.tsx lines 29-54):
```typescript
const adapter = useAdapter();
const { t, i18n } = useLingui();
const [ctx, setCtx] = useState<string>(() => t`未选中内容`);

useEffect(() => {
  void adapter.getSelection().then((sel) => {
    setCtx(formatSelection(sel, i18n));
  });

  const unsub = adapter.onSelectionChanged(async () => {
    const sel = await adapter.getSelection();
    setCtx(formatSelection(sel, i18n));
    // ... pulse state update
  });

  return () => {
    unsub();
    // ... cleanup timers
  };
}, [adapter, i18n]);
```
`SelectionPill` adds: a `×` button calling `onDismiss` prop (removes current selection from the message), and reads `autoAttach` from `providerStore` to conditionally render. When global autoAttach switch is off, the pill hides itself.

---

### `src/components/Settings/SettingsPanel.tsx` (component, request-response)

**Analog:** `src/App.tsx` — top-level shell with layout sections

**Shell layout pattern** (App.tsx lines 23-47):
```typescript
return (
  <div className="aster-shell">
    <div className="aster-topbar">
      <ContextCard />
      <button className="aster-iconbtn" ... ><SettingsIcon /></button>
    </div>
    <div className="aster-chat"><ChatStream /></div>
    <InputBar />
  </div>
);
```
For `SettingsPanel.tsx`, the same three-section structure:
```tsx
<div className="aster-settings">
  {/* 顶部：返回按钮 + 标题 */}
  <div className="aster-settings__header">
    <button className="aster-iconbtn" onClick={onClose} aria-label={t`返回`}>
      <ChevronIcon />
    </button>
    <span className="aster-settings__title"><Trans>设置</Trans></span>
  </div>
  {/* 内容（可滚动） */}
  <div className="aster-settings__body">
    <ProviderList />
    {/* 其他设置项 */}
  </div>
</div>
```
CSS for the overlay uses `transform: translateX(100%)` → `translateX(0)` with `var(--dur)` and `var(--ease)` (see RESEARCH.md §设置页 UI 架构). Add `.aster-settings-overlay` and `.aster-settings-overlay.is-open` to `styles.css`.

**Lingui import** (InputBar.tsx line 13):
```typescript
import { useLingui } from '@lingui/react/macro';
```

---

### `src/components/Settings/ProviderForm.tsx` (component, CRUD)

**Analog:** `src/components/InputBar.tsx` — form structure: container + field + toolbar

**Form container pattern** (InputBar.tsx lines 19-51):
```typescript
return (
  <div className="aster-inputbar">
    <div className="aster-composer">
      <textarea className="aster-field" disabled rows={2} placeholder={t`输入消息…`} />
      <div className="aster-composer__toolbar">
        <button className="aster-iconbtn" disabled ...><UploadIcon /></button>
        <button className="aster-send" disabled ...><SendIcon /></button>
      </div>
    </div>
  </div>
);
```
For `ProviderForm.tsx`, three fields (`baseURL`, `apiKey`, `model`) each as `<input className="aster-field">` (not textarea). Submit button uses `.aster-send` brand gradient. Disabled state uses `opacity: 0.55; cursor: not-allowed` (matches existing `.aster-send:disabled`). Inline privacy text below Key field uses `--text-3` / `font-size: 12px`.

**Disabled / not-allowed CSS** (styles.css lines 138-140):
```css
.aster-iconbtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

### `src/components/Onboarding/OnboardingModal.tsx` (component, request-response)

**Analog:** `src/components/ChatStream.tsx` — host-conditional rendering + Trans/useLingui

**Host-conditional render pattern** (ChatStream.tsx lines 14-33):
```typescript
function usageExamples(host: 'ppt' | 'excel' | 'word'): ReactElement[] {
  switch (host) {
    case 'ppt': return [<Trans key="ppt-1">...</Trans>, ...];
    case 'excel': return [...];
    case 'word': return [...];
  }
}
export default function ChatStream(): React.ReactElement {
  const host = useAdapter().capabilities().host;
  const examples = usageExamples(host);
  // ...
}
```
`OnboardingModal` uses the same `useAdapter().capabilities().host` call to determine which feature card to show in Step 2 (D-03). Modal overlay uses `position: absolute; inset: 0; z-index: 50` (Task Pane-bounded, cannot exceed iframe, RESEARCH.md Pitfall 6).

---

### `src/components/Onboarding/Step2Guide.tsx` (component, request-response)

**Analog:** `src/components/ChatStream.tsx` — exact pattern: useAdapter + capabilities().host + Trans

**Trans import + host switch** (ChatStream.tsx lines 9-10, 14-32, 35-37):
```typescript
import { Trans } from '@lingui/react/macro';
import type { ReactElement } from 'react';
import { useAdapter } from '../context/AdapterContext';
// ...
const host = useAdapter().capabilities().host;
const examples = usageExamples(host); // switch on 'ppt' | 'excel' | 'word'
```
`Step2Guide` uses the same approach: `switch(host)` returns a single `ReactElement` (one feature card per host, D-03).

---

### `src/App.tsx` — Phase 2 modifications

**Analog:** `src/App.tsx` itself — add `useState` for settings visibility, wire up gear button

**Current shell pattern** (App.tsx lines 20-48):
```typescript
export default function App(): React.ReactElement {
  const { t } = useLingui();
  return (
    <div className="aster-shell">
      <div className="aster-topbar">
        <ContextCard />
        <button className="aster-iconbtn" disabled aria-label={t`设置即将开放`}>
          <SettingsIcon />
        </button>
      </div>
      <div className="aster-chat"><ChatStream /></div>
      <InputBar />
    </div>
  );
}
```
Phase 2 changes: remove `disabled` from gear button; add `useState(false)` for `showSettings`; add `useState(false)` for `showOnboarding`; render `<SettingsPanel>` overlay and `<OnboardingModal>` conditionally. On mount, check `storage.get('aster:onboarding:seen')` to set `showOnboarding`.

---

### `src/adapters/PptAdapter.ts`, `ExcelAdapter.ts`, `WordAdapter.ts` — insert() implementation

**Analog:** Each file itself — replace the `insert()` stub, keeping all other methods identical

**Existing stub pattern** (PptAdapter.ts lines 100-103):
```typescript
async insert(_content: InsertableContent): Promise<void> {
  throw new UnsupportedOperationError('PPT 写回在 Phase 4 实现');
}
```
Phase 2 replaces with the real implementation for `type === 'text'` only, throwing `UnsupportedOperationError` for all other types. Follow the two-sync rule (ExcelAdapter.ts comment lines 6-8): `load → sync → write → sync`. Wrap the whole body in `try/catch(err) { throw new HostApiError('...', err); }` matching the existing `getSelection()` pattern.

---

## Shared Patterns

### Lingui String Wrapping
**Source:** `src/components/InputBar.tsx` (line 13), `src/components/ContextCard.tsx` (line 13), `src/components/ChatStream.tsx` (line 9)
**Apply to:** All new React components (Settings/*, Onboarding/*, ChatBubble, ErrorBubble, CostBadge, SelectionPill)

Rule: `<Trans>` for JSX text nodes; `const { t } = useLingui()` for prop strings (aria-label, placeholder, title). Never hardcode bare Chinese strings in TSX/TS files outside of Lingui macros.

```typescript
// JSX text node
import { Trans } from '@lingui/react/macro';
<span><Trans>发送</Trans></span>

// prop string
import { useLingui } from '@lingui/react/macro';
const { t } = useLingui();
<button aria-label={t`发送`}>
```

### CSS Variables (No Hardcoded Colors/Spacing)
**Source:** `src/styles.css` (lines 10-37 tokens, 39-63 light, 65-89 dark)
**Apply to:** All new CSS classes added to `src/styles.css` for Phase 2 components

New classes must use only existing tokens. Key tokens for new UI:
- Colors: `var(--text-1)`, `var(--text-2)`, `var(--text-3)`, `var(--surface)`, `var(--border)`, `var(--brand)`
- Error/warning color: add `--error: #ef4444` / `--error-bg: rgba(239, 68, 68, 0.1)` to both `[data-theme]` blocks
- Spacing: `var(--sp-1)` through `var(--sp-6)` (4px increments)
- Radius: `var(--r-sm)`, `var(--r-md)`, `var(--r-lg)`, `var(--r-pill)`
- Animation: `var(--dur)` / `var(--ease)` for all transitions

### Error Class Construction (Security Constraint T-01-04)
**Source:** `src/errors/index.ts` (lines 8, 43)
**Apply to:** All `src/providers/*.ts` files, `src/lib/sse.ts`

```typescript
// CORRECT: generic message, no credentials
throw new KeyInvalidError('DeepSeek API Key 无效');

// WRONG: never embed the key
throw new KeyInvalidError(`API Key ${apiKey} 无效`); // T-01-04 violation
```

### Office.js Async Pattern (two-sync rule)
**Source:** `src/adapters/ExcelAdapter.ts` (lines 6-8 comment, lines 26-46)
**Apply to:** `src/adapters/ExcelAdapter.ts` insert() implementation

```typescript
// load → sync → write → sync (maximum 2 syncs per write operation)
const range = ctx.workbook.getSelectedRange();
range.load('address');
await ctx.sync();           // sync 1: load
range.values = [[content.value]];
await ctx.sync();           // sync 2: write
```

### useAdapter Hook
**Source:** `src/context/AdapterContext.ts` (lines 22-28)
**Apply to:** `SelectionPill.tsx`, `Step2Guide.tsx`, `OnboardingModal.tsx`, `ProviderList.tsx`

```typescript
import { useAdapter } from '../../context/AdapterContext';
const adapter = useAdapter();
const host = adapter.capabilities().host;
```

### SVG Icon Pattern
**Source:** `src/components/icons.tsx` (lines 9-17)
**Apply to:** All 8 new icons added to `src/components/icons.tsx`

```typescript
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true };
export function XIcon(): ReactElement {
  return <svg {...base}><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>;
}
```

### Disabled State (Honest "Not Yet Available")
**Source:** `src/components/InputBar.tsx` (lines 23-48), `src/styles.css` (lines 138-145)
**Apply to:** Any Phase 2 UI control that is not yet functional

```typescript
<button className="aster-iconbtn" disabled aria-label={t`即将开放`} title={t`即将开放`}>
```
```css
.aster-iconbtn:disabled { opacity: 0.5; cursor: not-allowed; }
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/providers/queue.ts` | utility | event-driven | No queue/concurrency control pattern exists in codebase; use RESEARCH.md shape (module-level `Map<string, Promise>`) |
| `src/lib/sse.ts` | utility | streaming | No streaming consumer pattern exists; use RESEARCH.md `streamSSE` async generator shape verbatim |

---

## Metadata

**Analog search scope:** `src/adapters/`, `src/components/`, `src/context/`, `src/errors/`, `src/`, root
**Files scanned:** 13
**Key conventions enforced project-wide:**
1. All UI strings via Lingui macros (`<Trans>` / `t` / `msg`)
2. All colors/spacing via CSS variables from `src/styles.css`
3. All icons inline SVG in `src/components/icons.tsx`, `stroke=currentColor`
4. Error message strings never contain API keys (T-01-04)
5. Office.js always accessed via adapter interface, never directly in components
6. No LLM SDK imports (ESLint PROV-10; `no-restricted-imports`)
7. `storage.*` is the only localStorage access point (never raw `localStorage`)
8. Zustand stores export named selector hooks for granular subscriptions

**Pattern extraction date:** 2026-05-27
