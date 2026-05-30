# Phase 12: UI 打磨 (E) — Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 10 (3 new, 7 modified)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/utils/safeUrlTransform.ts` (NEW) | utility | transform | `src/utils/formatTime.ts` | role-match (pure util, no deps) |
| `src/utils/safeUrlTransform.test.ts` (NEW) | test | transform | `src/agent/loop-helpers.test.ts` | role-match (vitest unit test, no render) |
| `src/components/ChatBubble.test.tsx` (NEW) | test | request-response | `src/components/ChatStream.test.tsx` | exact (jsdom + @testing-library/react + vi.mock @lingui/react/macro pattern) |
| `src/components/ChatBubble.tsx` (MODIFY) | component | request-response | itself (existing file) | exact (add urlTransform prop to existing ReactMarkdown call) |
| `src/components/ChatStream.tsx` (MODIFY) | component | event-driven | itself (existing file) | exact (extend nodes-building loop + add typing bubble JSX) |
| `src/agent/loop-helpers.ts` (MODIFY) | utility | event-driven | itself (existing file) | exact (extend pushMessage call at L149-152) |
| `src/store/chat.ts` (MODIFY) | store | CRUD | itself (existing optional fields e.g. `agentRunId?`, `toolName?`) | exact |
| `src/styles.css` (MODIFY) | config/styles | transform | itself — `.bubble-ai`, `.aster-tool-card`, `.tool-group` sections | exact |
| `index.html` (MODIFY) | config | request-response | no existing analog (inline skeleton pre-JS) | none (new inline-CSS exception) |
| `src/components/ChatStream.test.tsx` + `src/agent/loop-helpers.test.ts` (MODIFY) | test | event-driven | themselves | exact (extend existing describe blocks) |

---

## Pattern Assignments

### `src/utils/safeUrlTransform.ts` (NEW — utility, transform)

**Analog:** `src/utils/formatTime.ts`

**Imports pattern** (`formatTime.ts` lines 1–9):
```typescript
/**
 * src/utils/formatTime.ts
 * JSDoc block: purpose + phase origin comment
 */
// no imports — pure function, no external deps
```

**Core pattern** (`formatTime.ts` lines 15–23):
```typescript
export function formatTime(ts: number): string {
  if (!ts) return '';
  // ... pure transform logic, early return for invalid input
}
```

**Pattern to copy for `safeUrlTransform.ts`:**
```typescript
/**
 * src/utils/safeUrlTransform.ts
 * react-markdown urlTransform 回调——白名单放行，拦截危险协议。
 * 签名：(url: string, key: string, node: Element) => string
 * 作用于所有 URL 属性（href, src 等）。
 *
 * 危险协议（javascript:/data:/vbscript:/file:）→ 返回 '' → react-markdown 把属性设为 ''
 * → 链接退化为无 href 纯文本，不破坏可读性。
 *
 * NOTE: 返回 '' 而非 null/undefined，避免 "null" 字符串被序列化进 href。
 */
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function safeUrlTransform(url: string): string {
  if (!url) return '';
  if (
    url.startsWith('#') ||
    url.startsWith('/') ||
    url.startsWith('./') ||
    url.startsWith('../') ||
    url.startsWith('//')
  ) {
    return url;
  }
  try {
    const { protocol } = new URL(url);
    return SAFE_PROTOCOLS.has(protocol) ? url : '';
  } catch {
    return url;
  }
}
```

**Key rule:** No imports, pure function, early-return guard, TSDoc block. Follow `formatTime.ts` naming and file-level comment structure exactly.

---

### `src/utils/safeUrlTransform.test.ts` (NEW — unit test, transform)

**Analog:** `src/agent/loop-helpers.test.ts` (lines 1–83)

**Imports pattern** (`loop-helpers.test.ts` lines 9–12):
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { streamAssistantTurn, truncateTo20Turns, type WireMessage } from './loop-helpers';
import { OpenAICompatibleLLM } from '../providers/openai-compat';
import { useChatStore } from '../store/chat';
```

**Test structure pattern** (`loop-helpers.test.ts` lines 24–82):
```typescript
beforeEach(() => {
  // reset store state
  useChatStore.setState({ messages: [], ... } as never);
});

describe('functionName — purpose', () => {
  it('positive case: valid input → expected output', async () => {
    // call function
    // expect assertions
  });

  it('negative case: dangerous input → blocked', async () => {
    // ...
  });
});
```

**Pattern to copy for `safeUrlTransform.test.ts`:**
```typescript
import { describe, it, expect } from 'vitest';
import { safeUrlTransform } from './safeUrlTransform';

describe('safeUrlTransform — XSS URL 防御（UI-01）', () => {
  it('UI-01-A: javascript: 协议 → 返回空串（拦截）', () => {
    expect(safeUrlTransform('javascript:alert(1)')).toBe('');
  });
  it('UI-01-B: data: URI → 返回空串（拦截）', () => {
    expect(safeUrlTransform('data:text/html;base64,abc')).toBe('');
  });
  it('UI-01-C: https: → 原样返回（放行）', () => {
    expect(safeUrlTransform('https://example.com')).toBe('https://example.com');
  });
  it('UI-01-D: 相对路径 → 原样返回（放行）', () => {
    expect(safeUrlTransform('#section')).toBe('#section');
    expect(safeUrlTransform('/path')).toBe('/path');
  });
  it('UI-01-E: vbscript: → 返回空串（拦截）', () => {
    expect(safeUrlTransform('vbscript:msgbox(1)')).toBe('');
  });
});
```

**Key rule:** No `beforeEach` needed (pure function, no store). No `vi.mock`. Import only from vitest + the util itself.

---

### `src/components/ChatBubble.test.tsx` (NEW — component test, request-response)

**Analog:** `src/components/ChatStream.test.tsx` (entire file — this is the canonical pattern)

**Imports pattern** (`ChatStream.test.tsx` lines 17–24):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { AdapterContext } from '../context/AdapterContext';
import ChatStream from './ChatStream';
import { useChatStore } from '../store/chat';
import { useAgentStore } from '../agent/agentStore';
import type { DocumentAdapter } from '../adapters/DocumentAdapter';
import type { Message } from '../store/chat';
```

**Critical mock pattern — @lingui/react/macro** (`ChatStream.test.tsx` lines 37–44):
```typescript
// THIS MOCK IS MANDATORY — ChatBubble uses Trans via react-markdown dependency chain
vi.mock('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({
    _: (id: string) => id,
    t: (id: string) => id,
  }),
}));
```

**Test setup pattern** (`ChatStream.test.tsx` lines 126–135):
```typescript
describe('ChatStream — purpose', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [] });
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
```

**Component render helper pattern** (`ChatStream.test.tsx` lines 114–120):
```typescript
function renderChatStream(onSettings = vi.fn()) {
  return render(
    <AdapterContext.Provider value={mockAdapter}>
      <ChatStream onSettings={onSettings} />
    </AdapterContext.Provider>,
  );
}
```

**Message fixture pattern** (`ChatStream.test.tsx` lines 102–108):
```typescript
function makeAssistantMsg(id: string, content: string, isStreaming = false): Message {
  return { id, role: 'assistant', content, isStreaming };
}
```

**DOM assertion pattern for ChatBubble** (from `12-RESEARCH.md` lines 716–733):
```typescript
// Pattern verified in RESEARCH.md — render + container.querySelector for DOM-level assertion
it('UI-01-A: javascript: href 被拦截', () => {
  const { container } = render(
    <ChatBubble message={makeMsgWithContent('[点我](javascript:alert(1))')}
      onRetry={() => {}} onSettings={() => {}} />
  );
  const a = container.querySelector('a');
  expect(a?.getAttribute('href')).not.toMatch(/javascript:/i);
});
```

**ChatBubble does NOT need AdapterContext** — unlike ChatStream, ChatBubble has no `useAdapter()`. The render call is simpler:
```typescript
function renderBubble(content: string) {
  const msg: Message = { id: '1', role: 'assistant', content, isStreaming: false };
  return render(<ChatBubble message={msg} onRetry={() => {}} onSettings={() => {}} />);
}
```

**Key rule:** Must `vi.mock('@lingui/react/macro', ...)` — same pattern as `ChatStream.test.tsx` line 38. Use `container.querySelector` for DOM-level href/src assertions (not just function return values).

---

### `src/components/ChatBubble.tsx` (MODIFY — add urlTransform prop)

**Current state** (`ChatBubble.tsx` lines 86–88):
```tsx
<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {message.content}
</ReactMarkdown>
```

**Change:** Add one import + one prop to existing ReactMarkdown call:
```tsx
// Add import at top (line ~29, with other utils):
import { safeUrlTransform } from '../utils/safeUrlTransform';

// Modify line 86:
<ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={safeUrlTransform}>
  {message.content}
</ReactMarkdown>
```

**Existing import pattern** (`ChatBubble.tsx` lines 25–30):
```typescript
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../store/chat';
import ErrorBubble from './ErrorBubble';
import { formatTime } from '../utils/formatTime';
```

**Key rule:** Minimal diff — one import line added, one prop added. Do NOT change ChatBubble's `return null` for empty content (line 79–81); that behavior must be preserved (UI-02 fills the gap from ChatStream, not ChatBubble).

---

### `src/components/ChatStream.tsx` (MODIFY — UI-02 typing bubble + UI-03 DiffLogPanel boundary + UI-05 read-card class)

**Existing nodes-building loop** (`ChatStream.tsx` lines 365–395):
```typescript
const nodes: ReactElement[] = [];
let toolRun: Message[] = [];
const flushToolRun = (): void => {
  if (toolRun.length === 0) return;
  if (toolRun.length >= 2) {
    nodes.push(<MergedToolGroup key={`group-${toolRun[0].id}`} messages={toolRun} />);
  } else {
    for (const tm of toolRun) nodes.push(<ToolResultCard key={tm.id} message={tm} />);
  }
  toolRun = [];
};
for (const m of messages) {
  if (isRegularTool(m)) { toolRun.push(m); continue; }
  flushToolRun();
  if (m.role === 'tool') {
    nodes.push(<ToolResultCard key={m.id} message={m} />);
  } else {
    nodes.push(<ChatBubble key={m.id} message={m} ... />);
  }
}
flushToolRun();
```

**Existing DiffLogPanel block (to be replaced)** (`ChatStream.tsx` lines 400–406):
```tsx
{completedRunIds.map((runId) => (
  <Suspense key={runId} fallback={null}>
    <DiffLogPanel runId={runId} />
  </Suspense>
))}
```

**UI-02 typing bubble — store selector pattern** (`ChatStream.tsx` lines 272–274, existing Zustand selector usage):
```typescript
// Pattern: selector per field (not whole store object)
const messages = useMessages();
const retryMessage = useChatStore((s) => s.retryMessage);
const completedRunIds = useCompletedRunIds();
// Add similarly:
const agentStatus = useAgentStore((s) => s.agentStatus);
const currentRunId = useAgentStore((s) => s.currentRunId);
```

**UI-02 typing bubble JSX — copy `.bubble-ai` wrapper pattern** (`ChatStream.tsx` lines 84–94, ChatBubble.tsx — the `.msg.msg-ai > .bubble.bubble-ai` shell):
```tsx
// Typing bubble: reuse .msg.msg-ai > .bubble.bubble-ai shell, add .bubble-typing modifier
// Insert conditionally after `{nodes}` and before closing div:
{showTyping && (
  <div className="msg msg-ai">
    <div className="bubble bubble-ai bubble-typing" aria-label="正在思考" role="status">
      <span className="bubble-typing__dot" aria-hidden="true" />
      <span className="bubble-typing__dot" aria-hidden="true" />
      <span className="bubble-typing__dot" aria-hidden="true" />
    </div>
  </div>
)}
```

**UI-03 DiffLogPanel boundary insertion algorithm** — copy lazy+Suspense pattern from existing usage (`ChatStream.tsx` lines 46, 402–404):
```typescript
// Existing lazy + Suspense pattern (keep exactly):
const DiffLogPanel = lazy(() => import('./DiffLogPanel'));
// ...
<Suspense key={`dlp-${runId}`} fallback={null}>
  <DiffLogPanel runId={runId} />
</Suspense>

// Pre-loop setup for boundary detection:
const completedRunSet = new Set(completedRunIds);
const runLastIndex = new Map<string, number>();
messages.forEach((m, i) => {
  if (m.agentRunId && completedRunSet.has(m.agentRunId)) {
    runLastIndex.set(m.agentRunId, i);
  }
});
const insertedRuns = new Set<string>();
```

**UI-05 cardClass pattern** (`ChatStream.tsx` line 180 — existing `aster-tool-card--error` modifier pattern):
```typescript
// Existing modifier class pattern:
const cardClass = `aster-tool-card${isError ? ' aster-tool-card--error' : ''}`;

// Extended with read modifier (UI-05):
const cardClass = `aster-tool-card${isError ? ' aster-tool-card--error' : ''}${message.kind === 'read' ? ' aster-tool-card--read' : ''}`;
```

**UI-05 MergedToolGroup allRead pattern** (`ChatStream.tsx` lines 225–265 — existing `messages.every/map` usage):
```typescript
// Existing: messages.every((m) => ...) used in MergedToolGroup for is-error per item
// New: add allRead check at group level
const allRead = messages.every((m) => m.kind === 'read');
const groupClass = `tool-group${allRead ? ' tool-group--read' : ''}`;
// Apply to: <div className={groupClass}>
```

---

### `src/agent/loop-helpers.ts` (MODIFY — UI-05 write def.kind into pushed tool Message)

**Current pushMessage call** (`loop-helpers.ts` lines 143–152):
```typescript
const def = tools.find((t) => t.name === tc.name);
useAgentStore.getState().setPhase(def?.kind === 'write' ? 'writing' : 'reading'); // def already used here
// ...
chatActions().pushMessage?.({
  role: 'tool', toolCallId: tc.id, toolName: tc.name, toolResult: result,
  content: humanLabel, agentRunId: runId, agentStep: step,
} as never);
```

**Change:** Add `kind: def?.kind` to pushMessage call. `def` is already resolved at line 143, zero extra lookup cost:
```typescript
chatActions().pushMessage?.({
  role: 'tool', toolCallId: tc.id, toolName: tc.name, toolResult: result,
  content: humanLabel, agentRunId: runId, agentStep: step,
  kind: def?.kind,  // UI-05: propagate read/write kind to Message for UI降权
} as never);
```

**Existing optional field push pattern** (`loop-helpers.ts` lines 135–140 — CIRCUIT_OPEN push, same `as never` cast):
```typescript
chatActions().pushMessage?.({
  role: 'tool', toolCallId: tc.id, toolName: tc.name,
  toolResult: { ok: false, error: { ... } },
  content: errInstance.message, agentRunId: runId, agentStep: step,
} as never);
```

**Key rule:** Keep the `as never` cast (it's the established pattern for chatActions). Add `kind` as the last field before `} as never`.

---

### `src/store/chat.ts` (MODIFY — add optional `kind?` to Message interface)

**Existing optional field pattern** (`chat.ts` lines 43–63 — the Message interface):
```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'error';
  content: string;
  isStreaming?: boolean;
  ts?: number;
  errorCode?: string;
  retryPrompt?: string;
  toolCalls?: ToolCall[];
  // 'tool' role 专用（D-08 — agent loop push tool result 气泡时填）
  toolCallId?: string;
  toolName?: string;
  toolResult?: ToolResult;
  agentRunId?: string;
  agentStep?: number;
}
```

**Change:** Add one optional field at the end of the `// 'tool' role 专用` section:
```typescript
  agentRunId?: string;
  agentStep?: number;
  /** UI-05：tool 消息的 read/write 分类（来自 ToolDef.kind，loop-helpers push 时写入） */
  kind?: 'read' | 'write';
```

**Comment convention:** Inline JSDoc comment on same line or line above, same style as `/** D-11：重试时用此 prompt 重发 */`. No blank lines between grouped optional fields.

---

### `src/styles.css` (MODIFY — UI-02 dots + UI-04 table + UI-05 read variants)

**UI-02 — typing bubble CSS. Insert after `.caret` / `@keyframes blink` block** (`styles.css` lines 751–763 — the caret + blink pattern to reference for animation structure):
```css
/* === UI-02 思考气泡三点动画 === */
.bubble-typing {
  display: flex;
  align-items: center;
  gap: var(--space-1);   /* 4px between dots */
  min-height: 36px;
}
.bubble-typing__dot {
  width: 4px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--text-3);
  animation: aster-typing 0.96s ease-in-out infinite;
  flex-shrink: 0;
}
.bubble-typing__dot:nth-child(2) { animation-delay: 0.16s; }
.bubble-typing__dot:nth-child(3) { animation-delay: 0.32s; }
@keyframes aster-typing {
  0%, 100% { transform: translateY(0); opacity: 0.4; }
  50%       { transform: translateY(-4px); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .bubble-typing__dot { animation: none; opacity: 0.5; }
}
```

**Existing @keyframes pattern** (`styles.css` lines 760–763 and 798–800 — two existing animations for reference):
```css
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes aster-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}
```

**UI-04 — table CSS. Insert inside `.bubble-ai` section** (`styles.css` lines 721–750 — existing `.bubble-ai` rules to append after):
```css
/* === UI-04 表格（D-11，数值标[待复核]）=== */
.bubble-ai table {
  display: block;            /* enables overflow-x: auto on table itself */
  overflow-x: auto;
  border-collapse: collapse;
  width: 100%;
  font-size: var(--fs-13);  /* [待复核] */
  margin: var(--space-2) 0; /* 8px top/bottom */
}
.bubble-ai th,
.bubble-ai td {
  border: 1px solid var(--border);
  padding: 6px 8px;          /* [待复核] */
  text-align: left;
}
.bubble-ai th {
  background: var(--surface-2);
  font-weight: 600;
}
```

**UI-05 — read card variant CSS. Insert after `.tool-group__list > li.is-error` rule** (`styles.css` lines 894–900 — the existing tool-group section):
```css
/* === UI-05 读取工具卡降权（D-15）=== */
/* 单卡 read 变体：去边框 + --text-3 字色（write 卡保持不变）*/
.aster-tool-card--read {
  border: none;
}
.aster-tool-card--read .wb-action-head {
  color: var(--text-3);
  padding: 4px 8px;  /* 略收内距 [待复核] */
}
/* MergedToolGroup 全 read 变体：去组边框 + 头部字色降权 */
.tool-group--read {
  border: none;
}
.tool-group--read .tool-group__head {
  border-bottom: none;
  color: var(--text-3);
}
.tool-group--read .tool-group__list > li {
  border-bottom-color: transparent;
}
```

**Variable usage rule:** All colors via `var(--border)`, `var(--surface-2)`, `var(--text-3)`, `var(--fs-13)`, `var(--space-2)`. No hardcoded hex (except UI-06 which is the approved exception). Section headers use `/* === Section Name === */` convention.

---

### `index.html` (MODIFY — UI-06 shimmer skeleton)

**Current state** (`index.html` lines 18–20):
```html
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
```

**No existing analog** for inline skeleton — this is the approved exception to "no hardcoded hex" (D-18: CSS variables are unavailable before styles.css loads).

**Pattern to apply** (inline HTML + `<style>` inside `#root`, from RESEARCH.md lines 443–500):
```html
<div id="root">
  <!-- UI-06 shimmer 骨架屏：仅在 Office.onReady 前显示，React.createRoot 挂载后自动覆盖 -->
  <!-- APPROVED EXCEPTION (D-18): hardcoded hex required — styles.css + data-theme 此时尚未加载 -->
  <style>
    #root-skeleton { display: flex; flex-direction: column; padding: 12px; gap: 8px;
      background: #ffffff; height: 100vh; box-sizing: border-box; }
    .sk-header { height: 40px; border-radius: 8px; background: #f3f2ee;
      background-size: 200% 100%;
      background-image: linear-gradient(90deg, #f3f2ee 25%, #e9e7e0 50%, #f3f2ee 75%);
      animation: sk-shimmer 1.4s ease-in-out infinite; }
    .sk-bubble { height: 56px; border-radius: 12px; max-width: 85%; background: #eeeef0;
      background-size: 200% 100%;
      background-image: linear-gradient(90deg, #eeeef0 25%, #e0e0e3 50%, #eeeef0 75%);
      animation: sk-shimmer 1.4s ease-in-out infinite; }
    .sk-bubble:nth-child(2) { animation-delay: 0.2s; }
    .sk-bubble:nth-child(3) { animation-delay: 0.4s; max-width: 60%; }
    @keyframes sk-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    @media (prefers-color-scheme: dark) {
      #root-skeleton { background: #0e0e10; }
      .sk-header { background: #1f1f21;
        background-image: linear-gradient(90deg, #1f1f21 25%, #28282b 50%, #1f1f21 75%); }
      .sk-bubble { background: #1f1f23;
        background-image: linear-gradient(90deg, #1f1f23 25%, #2a2a2e 50%, #1f1f23 75%); }
    }
    @media (prefers-reduced-motion: reduce) {
      .sk-header, .sk-bubble { animation: none !important; }
    }
  </style>
  <div id="root-skeleton">
    <div class="sk-header"></div>
    <div class="sk-bubble"></div>
    <div class="sk-bubble"></div>
    <div class="sk-bubble"></div>
  </div>
</div>
```

**Key rules:**
- `<style>` goes inside `<div id="root">`, before `<script type="module" src="/src/main.tsx">` (which stays in `<body>` as-is)
- `React.createRoot(document.getElementById('root')).render(...)` automatically overwrites all children of `#root` — no JS removal needed
- shimmer = single-color luminance gradient (grey scale), NOT brand multi-color gradient — D-19 approved exception to "no gradient" rule
- `prefers-reduced-motion` media query must be INSIDE the inline `<style>` (cannot rely on styles.css which hasn't loaded yet)

---

### `src/components/ChatStream.test.tsx` (MODIFY — extend with UI-02/03/05 cases)

**Existing pattern** — append new `describe` blocks after existing ones. Copy the exact `beforeEach` / `afterEach` store reset pattern from `ChatStream.test.tsx` lines 126–135:

```typescript
describe('ChatStream — UI-02: 思考气泡（typing indicator）', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [] });
    useAgentStore.setState({
      agentStatus: 'idle',
      currentStep: 0,
      currentRunId: null,
      controller: null,
      lastAbortReason: null,
      runningTools: [],
    });
    vi.clearAllMocks();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('UI-02-A: running + 空 content isStreaming assistant → .bubble-typing 出现', async () => { ... });
  it('UI-02-B: 首 token 到达（content 非空）→ .bubble-typing 消失', async () => { ... });
  it('UI-02-C: agentStatus idle → 无 .bubble-typing 残留', async () => { ... });
});
```

**Tool message fixture** (for UI-03/05 — copy from `makeToolMsg` at `ChatStream.test.tsx` lines 293–309):
```typescript
function makeToolMsg(id, toolName, content, toolResult, agentRunId = 'r1', kind?: 'read'|'write'): Message {
  return { id, role: 'tool', content, toolCallId: `c-${id}`, toolName, toolResult,
    agentRunId, agentStep: 1, kind };
}
```

---

### `src/agent/loop-helpers.test.ts` (MODIFY — extend with UI-05 kind field case)

**Existing pattern** — append new `describe` block. Import pattern (`loop-helpers.test.ts` lines 9–12) stays the same. New test validates that `pushMessage` receives `kind`:

```typescript
describe('runOneToolCall — UI-05 kind 字段写入 Message', () => {
  it('read tool → pushMessage 收到 kind: "read"', async () => {
    // mock chatStore.pushMessage as vi.fn(), call runOneToolCall with a read ToolDef
    // assert pushMessage was called with { kind: 'read' }
  });
  it('write tool → pushMessage 收到 kind: "write"', async () => { ... });
});
```

---

## Shared Patterns

### CSS Variable Usage
**Source:** `src/styles.css` lines 44–110 (`:root` scale tokens + `[data-theme]` semantic tokens)
**Apply to:** All new CSS rules in `src/styles.css`

```css
/* Scale tokens (theme-independent) */
--space-1: 4px;  --space-2: 8px;  --radius-full: 999px;  --fs-12: 12px;  --fs-13: 13px;

/* Semantic tokens (use these for colors — always) */
--text-3: #92908a / #6e6e76   /*降权文字, 三点, read 卡 humanLabel */
--border: #e7e5df / #26262a   /* 表格 cell border, 卡边框 */
--surface-2: #f3f2ee / #1f1f21 /* 表头底, code 底 */
--bubble-ai-bg: #eeeef0 / #1f1f23 /* AI 气泡底 */
```

### Lingui Mock (required for all component tests that touch any Trans-using component)
**Source:** `src/components/ChatStream.test.tsx` lines 37–44
**Apply to:** `ChatBubble.test.tsx`

```typescript
vi.mock('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({ _: (id: string) => id, t: (id: string) => id }),
}));
```

### Store Reset Pattern
**Source:** `src/components/ChatStream.test.tsx` lines 127–131
**Apply to:** All new `describe` blocks in `ChatStream.test.tsx`

```typescript
beforeEach(() => {
  useChatStore.setState({ messages: [] });
  useAgentStore.setState({ agentStatus: 'idle', currentStep: 0, currentRunId: null,
    controller: null, lastAbortReason: null, runningTools: [] });
  vi.clearAllMocks();
});
afterEach(() => { vi.restoreAllMocks(); });
```

### Zustand Selector Subscription
**Source:** `src/components/ChatStream.tsx` lines 272–274
**Apply to:** New UI-02 selectors in `ChatStream.tsx`

```typescript
// Always subscribe per-field, not whole store object:
const agentStatus = useAgentStore((s) => s.agentStatus);
const currentRunId = useAgentStore((s) => s.currentRunId);
```

### Lazy + Suspense Boundary (DiffLogPanel)
**Source:** `src/components/ChatStream.tsx` lines 46, 402–404
**Apply to:** UI-03 inline DiffLogPanel insertion

```typescript
// Keep lazy declaration at top of file (unchanged):
const DiffLogPanel = lazy(() => import('./DiffLogPanel'));

// Insertion node (key must be unique and stable):
<Suspense key={`dlp-${runId}`} fallback={null}>
  <DiffLogPanel runId={runId} />
</Suspense>
```

### CSS Section Header Convention
**Source:** `src/styles.css` (throughout — `/* === Section === */` pattern)
**Apply to:** All new CSS blocks in `src/styles.css`

```css
/* === UI-02 思考气泡三点动画 === */
/* === UI-04 表格样式（D-11，[待复核]）=== */
/* === UI-05 读取工具卡降权（D-15）=== */
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `index.html` skeleton section | config | static-load | No pre-JS inline skeleton exists in the codebase. The `index.html` currently has `<div id="root"></div>` (empty). This is a category-novel pattern — inline HTML+CSS that must be self-sufficient before any JS runs. RESEARCH.md §UI-06 provides the complete reference implementation. |

---

## Critical Pitfalls (from RESEARCH.md — planner must reference in each plan)

| Pitfall | Plan | Guard |
|---------|------|-------|
| `urlTransform` returning `null` serializes as `"null"` string in href | Wave 0 (UI-01) | Always return `''` (empty string), never `null` |
| Typing bubble using `agentStatus !== 'idle'` (too wide — catches soft-landing) | Wave 1 (UI-02) | Strict: `agentStatus === 'running' \|\| agentStatus === 'paused'` |
| DiffLogPanel boundary misses run whose last message is a regularTool | Wave 2 (UI-03) | `flushToolRun` must check `runLastIndex` for last-in-toolRun message AFTER flush |
| Skeleton `prefers-reduced-motion` relying on `styles.css` global reset | Wave 4 (UI-06) | Must be inside inline `<style>` in index.html — styles.css is not loaded yet |
| `table { display: block }` conflicting with `border-collapse` | Wave 3 (UI-04) | Test both `display:block + overflow-x:auto` vs wrapper div; pick whichever renders correctly |

---

## Metadata

**Analog search scope:** `src/components/`, `src/utils/`, `src/agent/`, `src/store/`, `src/styles.css`, `index.html`
**Files scanned:** 10 (all read in full, no re-reads)
**Pattern extraction date:** 2026-05-31
