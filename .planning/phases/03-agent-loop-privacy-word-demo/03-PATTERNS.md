# Phase 3: Agent Loop 地基 + Word 多步 demo — Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 30(8 新增源码 + 11 新增测试 + 11 修改/删除)
**Analogs found:** 28 / 30

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/agent/loop.ts` | service | streaming + event-driven | `src/store/chat.ts` (sendMessage while/for-await SSE consumer) | role-match |
| `src/agent/agentStore.ts` | store | event-driven (Zustand state machine) | `src/store/chat.ts` (Zustand + AbortController + named selectors) | exact |
| `src/agent/circuit-breaker.ts` | utility | request-response (skeleton) | `src/providers/queue.ts` (模块级 Map state + cleanup) | role-match |
| `src/agent/operationLog.ts` | utility | request-response (in-mem append) | `src/providers/queue.ts` (模块级数组/Map + 纯函数 API) | role-match |
| `src/agent/tools/index.ts` | service | request-response (dispatch + sanitize) | `src/adapters/index.ts` (factory/switch + AsterError throw) + `src/lib/sse.ts` mapHttpError (allowlist sanitize) | partial |
| `src/agent/tools/write/word.ts` | service | request-response (ToolDef object literal) | `src/adapters/WordAdapter.ts` (Word.run try/catch + HostApiError) | partial |
| `src/agent/tools/read/word.ts` | service | request-response (placeholder ToolDef) | `src/agent/tools/write/word.ts` (本 phase 自身) | partial |
| `src/components/AgentControlBar.tsx` | component | event-driven (Zustand selector subscribe) | `src/components/SelectionPill.tsx` (Zustand selectors + 内联 SVG + 条件 null) | role-match |
| `src/agent/loop.test.ts` | test | unit | `src/lib/sse.test.ts` (mock SSE + for-await 累积事件断言) | partial |
| `src/agent/agentStore.test.ts` | test | unit | `src/adapters/DocumentAdapter.test.ts` (vi.fn stub + state transition 断言) | partial |
| `src/agent/tools/index.test.ts` | test | unit | `src/adapters/DocumentAdapter.test.ts` (interface 结构断言) | partial |
| `src/agent/tools/dispatch.test.ts` | test | unit | `src/lib/sse.test.ts` (mock 抛错 + 不含字段断言) | partial |
| `src/agent/tools/write/word.test.ts` | test | unit | `src/adapters/DocumentAdapter.test.ts` (mock adapter stub + 调用断言) | partial |
| `src/agent/operationLog.test.ts` | test | unit | `src/adapters/DocumentAdapter.test.ts` (纯函数 API 断言) | partial |
| `src/components/AgentControlBar.test.tsx` | test | component | `src/components/ChatStream.test.tsx` (RTL + jsdom + Zustand setState) | exact |
| `src/components/SelectionPill.test.tsx` | test | component | `src/components/ChatStream.test.tsx` (RTL + mock adapter) | exact |
| `src/components/ContextCard.test.tsx` | test | component | `src/components/ChatStream.test.tsx` (RTL + mock adapter) | exact |
| `src/main.test.tsx` | test | integration | `src/components/ChatStream.test.tsx` (RTL + AdapterContext.Provider) | partial |
| `src/store/chat.ts` (modify) | store | streaming → thin delegate | itself (削减 sendMessage 内 LLM/usage/tool_call 路径) | exact |
| `src/store/providers.ts` (modify) | store | CRUD (删 autoInsertMode) | itself | exact |
| `src/providers/openai-compat.ts` (modify) | service | streaming (accept dynamic tools) | itself (移除 hardcode TOOL,改入参) | exact |
| `src/adapters/WordAdapter.ts` (modify) | adapter | request-response (新增 appendParagraph method) | itself L88-115 insert() 路径 | exact |
| `src/components/ChatStream.tsx` (modify) | component | event-driven (渲染 role='tool') | itself L52-122 | exact |
| `src/components/ChatBubble.tsx` (modify) | component | request-response (删 CostBadge / ToolCallPreviewCard) | itself L1-100 | exact |
| `src/components/InputBar.tsx` (modify) | component | event-driven (handleSend 路径不变,chatStore.sendMessage thin delegate 在 store 内做) | itself L38-51 | exact |
| `src/components/Settings/SettingsPanel.tsx` (modify) | component | CRUD (删自动写文档开关) | itself | exact |
| `src/errors/index.ts` (modify) | model | — (补四字段 + 新增 2 类) | itself L50-175 (现有 8 类) | exact |
| `src/lib/sse.ts` (modify) | utility | streaming (@deprecated SSEUsage) | itself | exact |
| `src/main.tsx` (modify) | entry | request-response (CARRY-01 路径 A 预取选区) | itself L45-69 (Office.onReady 回调内 hydrate→render) | exact |
| `src/App.tsx` (modify) | component | event-driven (传 initialSelection prop) | itself L25-120 | exact |
| `src/components/CostBadge.tsx` (DELETE) | — | — | — | n/a |
| `src/providers/pricing.ts` (DELETE) | — | — | — | n/a |

---

## Pattern Assignments

### `src/agent/loop.ts` (service, streaming + event-driven)

**Analog:** `src/store/chat.ts` lines 93-265 — `sendMessage()` 的 try/for-await/finally 三段式 + AbortController 配 setupVisibilityAbort cleanup

**Imports pattern** (chat.ts lines 20-28):
```typescript
import type { SelectionContext, DocumentAdapter } from '../adapters/DocumentAdapter';
import type { LLMConfig } from '../providers/types';
import { ProviderRegistry } from '../providers/registry';
import { OpenAICompatibleLLM } from '../providers/openai-compat';
import { setupVisibilityAbort } from '../providers/queue';
import { useProviderStore } from './providers';
import { AsterError } from '../errors';
```
For `loop.ts` 对应:
```typescript
import { useChatStore } from '../store/chat';
import { useAgentStore } from './agentStore';
import { useProviderStore } from '../store/providers';
import { OpenAICompatibleLLM } from '../providers/openai-compat';
import { ProviderRegistry } from '../providers/registry';
import { buildToolsForHost, dispatchTool } from './tools';
import type { DocumentAdapter, SelectionContext } from '../adapters/DocumentAdapter';
```

**Core while/for-await pattern** (chat.ts lines 152-223 — 提取「构建 messages → streamChat → switch event type」骨架):
```typescript
const llm = new OpenAICompatibleLLM();
for await (const event of llm.streamChat(messages, config, controller.signal)) {
  if (event.type === 'delta') {
    set((s) => ({ messages: s.messages.map((m) =>
      m.id === assistantMsg.id ? { ...m, content: m.content + event.content } : m,
    )}));
  } else if (event.type === 'tool_call_end') {
    let parsedArgs: ToolCall['arguments'];
    try { parsedArgs = JSON.parse(event.arguments) as ToolCall['arguments']; }
    catch { continue; }
    // schema 校验 ... push toolCall ...
  }
}
```
**For loop.ts:** 把外层包成 `while (step < MAX_STEPS)`,内层保留同样的 `for await streamChat → switch event.type` 结构;`tool_call_end` 分支改为「累积本 turn 的 tool calls → 出 for-await 后用 `dispatchTool` 依次执行」(详见 RESEARCH.md L340-416 骨架)。

**Error/abort handling pattern** (chat.ts lines 224-264):
```typescript
} catch (e) {
  if (e instanceof Error && e.name === 'AbortError') {
    // 用户停止或 Task Pane 隐藏——保留已生成内容,不报错
    set((s) => ({ messages: s.messages.map((m) =>
      m.id === assistantMsg.id ? { ...m, isStreaming: false } : m,
    )}));
    return;
  }
  // 错误 → 替换 assistant 气泡为 error 气泡
  const errCode = (e as Record<string, string>)?.code ?? 'NETWORK';
  const safeMsg = e instanceof AsterError ? e.message : '请求遇到未知错误,请重试';
  ...
} finally {
  cleanup();           // setupVisibilityAbort cleanup,必须在 finally
  set({ isStreaming: false, abortController: null });
}
```
**For loop.ts:** AbortController **不在 loop 内创建** —— 由 `agentStore.beginRun()` 创建并持有(D-10 单一 AbortController);loop 只接受 signal 入参。同样保留 `finally { cleanup(); endRun(); }` 三段式。

**Crypto.randomUUID for runId** (chat.ts line 103, 108):
```typescript
const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: prompt };
```
loop.ts 用 `const runId = crypto.randomUUID()` 同样模式。

---

### `src/agent/agentStore.ts` (store, event-driven Zustand state machine)

**Analog:** `src/store/chat.ts` L20-338 — `useChatStore` 的 create + interface + named selector 三件套

**Zustand create + state interface pattern** (chat.ts lines 69-88):
```typescript
interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  abortController: AbortController | null;
  sendMessage(prompt: string, selectionCtx?: SelectionContext): Promise<void>;
  stopStreaming(): void;
  retryMessage(messageId: string): Promise<void>;
  clearHistory(): void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  abortController: null,
  async sendMessage(prompt, selectionCtx) { ... },
  stopStreaming() { get().abortController?.abort(); },
  ...
}));
```
**For agentStore.ts:**
```typescript
interface AgentState {
  agentStatus: 'idle' | 'running' | 'paused' | 'soft-landing';
  currentStep: number;
  currentRunId: string | null;
  controller: AbortController | null;
  lastAbortReason: 'visibility' | 'user' | 'max_steps' | 'circuit' | null;
  runningTools: Array<{ id: string; name: string }>;
  beginRun(runId: string): void;
  setCurrentStep(n: number): void;
  pause(): void;
  resume(): void;
  abort(reason: 'visibility' | 'user' | 'max_steps' | 'circuit'): void;
  awaitResume(signal: AbortSignal): Promise<void>;
  pushSoftLandingPrompt(runId: string): void;
  continueRun(runId: string): void;
  endRun(runId: string): void;
  runAgent(prompt: string, selectionCtx: SelectionContext | undefined, adapter: DocumentAdapter): Promise<void>;
}

export const useAgentStore = create<AgentState>((set, get) => ({ ... }));
```

**Named selector exports pattern** (chat.ts lines 334-338):
```typescript
/** useMessages — 仅订阅 messages 数组变化 */
export const useMessages = () => useChatStore((s) => s.messages);
export const useIsStreaming = () => useChatStore((s) => s.isStreaming);
```
**For agentStore.ts:**
```typescript
export const useAgentStatus = () => useAgentStore((s) => s.agentStatus);
export const useCurrentStep = () => useAgentStore((s) => s.currentStep);
```
AgentControlBar **必须**用这些 named selectors,不直接 `useAgentStore()` 全量订阅(详见 RESEARCH.md L564-593 Subscription pattern 反例)。

**abort 单一入口模式** (chat.ts line 267-269):
```typescript
stopStreaming() {
  get().abortController?.abort();
},
```
**For agentStore.ts (D-10 单一 abort 入口):**
```typescript
abort(reason) {
  set({ lastAbortReason: reason, agentStatus: 'idle' });
  get().controller?.abort();
},
```
visibility / user / max_steps / circuit 4 路全部调 `agentStore.abort(reason)`,不允许任何地方直接 `controller.abort()`(详见 RESEARCH.md L1064-1080)。

**awaitResume promise primitive** (无 v1 analog,使用 RESEARCH.md L1045-1058 提供的骨架):
```typescript
awaitResume(signal: AbortSignal): Promise<void> {
  if (get().agentStatus !== 'paused') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const unsub = useAgentStore.subscribe((s, prev) => {
      if (prev.agentStatus === 'paused' && s.agentStatus !== 'paused') {
        unsub(); resolve();
      }
    });
    const onAbort = () => { unsub(); reject(new DOMException('aborted', 'AbortError')); };
    signal.addEventListener('abort', onAbort, { once: true });
  });
},
```

---

### `src/agent/circuit-breaker.ts` (utility, request-response skeleton)

**Analog:** `src/providers/queue.ts` lines 12-40 — 模块级 Map + 纯函数 API

**模块级 Map state + 纯函数导出 pattern** (queue.ts lines 12-13, 19-40):
```typescript
/** 模块级单飞 Map(providerId → 当前飞行中的 Promise ticket) */
const inFlight = new Map<string, Promise<void>>();

export async function singleFlight<T>(providerId: string, fn: () => Promise<T>): Promise<T> {
  const prev = inFlight.get(providerId);
  if (prev) await prev.catch(() => {});
  // ...
}
```
**For circuit-breaker.ts (骨架):**
```typescript
/** 模块级 sliding window 状态,Phase 4 ERR-03 填充真实逻辑 */
const failureCounts = new Map<string, number[]>();   // toolName → 时间戳数组

export function recordSuccess(toolName: string): void {
  // Phase 3 no-op stub;Phase 4 重置/缩短 window
}

export function recordFailure(toolName: string): void {
  // Phase 3 no-op stub;Phase 4 push 时间戳 + 老的截断
}

export function isOpen(toolName: string): boolean {
  // Phase 3 always false(骨架不阻断);Phase 4 判 window 内 ≥N 次
  return false;
}
```
**注意:** `queue.ts` 的「防泄漏:只在当前 ticket 还是 Map 里那个时才移除」模式不直接复用,但生命周期理念(状态出模块即丢)继承。

---

### `src/agent/operationLog.ts` (utility, in-mem append-only)

**Analog:** `src/providers/queue.ts` — 模块级状态 + 纯函数 API(同 circuit-breaker)

**Pattern:**
```typescript
// Phase 3 骨架:in-memory only(PITFALLS A-11 不写 localStorage)
const operationLog: OperationLogEntry[] = [];

export function appendOperation(entry: OperationLogEntry): void {
  operationLog.push(entry);
}

export function getOperationsByRun(runId: string): OperationLogEntry[] {
  return operationLog.filter(o => o.runId === runId);
}

// Phase 5 才实现:
// export function reverseRun(runId: string, adapter: DocumentAdapter): Promise<void>
```
详见 RESEARCH.md L519-548。

**类型定义模式参考** `src/adapters/DocumentAdapter.ts` lines 17-52 discriminated union 风格(虽然 OperationLogEntry 是单一 interface,但 ReverseDescriptor 字段命名延续):
```typescript
export interface ReverseDescriptor {
  tool: string;                    // 反 tool 的 name
  args: Record<string, unknown>;
}

export interface OperationLogEntry {
  runId: string;
  stepIndex: number;
  toolName: string;
  args: unknown;
  humanLabel: string;
  reverse: ReverseDescriptor;
  timestamp: number;
}
```

---

### `src/agent/tools/index.ts` (service, dispatch + sanitize)

**Analog 1 (factory/switch):** `src/adapters/index.ts` `createAdapter()` factory pattern
**Analog 2 (sanitize 边界):** `src/lib/sse.ts` `mapHttpError` + `sanitizeErrBody` (line 251) — strict 字段筛选

**Factory pattern reference** (adapters/index.ts createAdapter):
```typescript
export function createAdapter(host: Office.HostType): DocumentAdapter {
  switch (host) {
    case Office.HostType.PowerPoint: return new PptAdapter();
    case Office.HostType.Excel: return new ExcelAdapter();
    case Office.HostType.Word: return new WordAdapter();
    default: throw new UnsupportedOperationError(`不支持的宿主: ${host}`);
  }
}
```
**For tools/index.ts `buildToolsForHost`:**
```typescript
export function buildToolsForHost(host: 'word' | 'excel' | 'ppt'): ToolDef[] {
  switch (host) {
    case 'word': return [appendParagraph /* + read tools 占位 */];
    case 'excel': return [];   // Phase 6 才填
    case 'ppt': return [];     // Phase 6 才填
  }
}
```

**Sanitize allowlist pattern** (sse.ts line 251 `sanitizeErrBody`):
```typescript
// I-09:sanitize errBody 后挂载到 error(剥除 sk- 值与 apiKey/authorization 字段名)
(err as unknown as Record<string, unknown>).errBody = sanitizeErrBody(errBody);
```
**For tools/index.ts `dispatchTool` (D-15 严格 allowlist):**
```typescript
export async function dispatchTool(
  call: { id: string; name: string; arguments: unknown },
  ctx: ToolExecContext,
  tools: ToolDef[],
): Promise<ToolResult> {
  const def = tools.find(t => t.name === call.name);
  if (!def) {
    return { ok: false, error: {
      code: 'NOT_FOUND', message: `工具 ${call.name} 不存在`,
      recoverable: false, hint: '请只调用 tools 列表里声明的工具名',
    }};
  }
  try {
    return await def.execute(call.arguments as never, ctx);
  } catch (err) {
    if (err instanceof AsterError) {
      return { ok: false, error: sanitizeFromAsterError(err) };
    }
    return { ok: false, error: {
      code: 'UNSUPPORTED', message: '宿主操作失败',
      hint: '发生错误,请重试', recoverable: false,
    }};
  }
}
```
完整骨架见 RESEARCH.md L432-511。关键:**只读 err.code / err.message / err.hint / err.recoverable 四字段**,不调 err.stack / err.toString() / err.name,陌生异常一律兜底 UNSUPPORTED + 占位 hint。

**ToolDef interface 风格** 参考 `src/providers/types.ts` `LLMProvider` interface 的「字段 + 方法签名」混合形态(types.ts 4.3K 全文件就是 interface 声明)。

---

### `src/agent/tools/write/word.ts` (service, request-response)

**Analog:** `src/adapters/WordAdapter.ts` lines 88-115 — `insert()` 方法的 `Word.run(...).await ctx.sync()` + try/catch HostApiError 模式

**Word.run try/catch pattern** (WordAdapter.ts lines 96-114):
```typescript
async insert(content: InsertableContent): Promise<void> {
  if (content.type !== 'text') {
    throw new UnsupportedOperationError(`Word Phase 2 仅支持 text 写回...`);
  }
  const position = content.position ?? 'cursor';
  try {
    await Word.run(async (ctx) => {
      switch (position) {
        case 'replace_selection':
          ctx.document.getSelection().insertText(content.value, Word.InsertLocation.replace);
          break;
        case 'append_end':
          ctx.document.body.insertText(content.value, Word.InsertLocation.end);
          break;
      }
      await ctx.sync();
    });
  } catch (err) {
    if (err instanceof UnsupportedOperationError) throw err;
    throw new HostApiError('Word text 写回失败', err);
  }
}
```
**For WordAdapter `appendParagraph` method (新增):**
```typescript
async appendParagraph(text: string): Promise<void> {
  try {
    await Word.run(async (ctx) => {
      ctx.document.body.insertParagraph(text, Word.InsertLocation.end);
      await ctx.sync();
    });
  } catch (err) {
    throw new HostApiError('Word append_paragraph 失败', err);
  }
}
```
**For tools/write/word.ts `appendParagraph` ToolDef literal:**
```typescript
import type { ToolDef, ToolResult, ReverseDescriptor } from '../index';
import type { WordAdapter } from '../../../adapters/WordAdapter';

interface AppendParagraphArgs { text: string; }

export const appendParagraph: ToolDef<AppendParagraphArgs> = {
  name: 'append_paragraph',
  description: '在文档末尾追加一段文本。优先一次调多次而不是合并成一个 tool call。',
  parameters: {
    type: 'object',
    properties: { text: { type: 'string', description: '要追加的段落文本' } },
    required: ['text'],
  },
  humanLabel: ({ text }) =>
    `在文档末尾追加段落「${text.slice(0, 30)}${text.length > 30 ? '…' : ''}」`,
  async execute({ text }, ctx): Promise<ToolResult> {
    await (ctx.adapter as WordAdapter).appendParagraph(text);
    const reverse: ReverseDescriptor = { tool: 'delete_last_paragraph', args: {} };
    return { ok: true, data: { written: text.length }, reverse };
  },
};
```

**PITFALLS A-06 边界:** ToolDef.execute 调 `ctx.adapter.appendParagraph(text)` —— 纯字符串入 / void 出,**不返回 Word.run 闭包内 proxy 对象**(详见 RESEARCH.md L645-655)。

**关键约束:** adapter method 不在 `insert()` 内分支(CONTEXT.md L201),单独 method(推荐理由见 RESEARCH.md L1357-1364)。

---

### `src/agent/tools/read/word.ts` (service, placeholder)

**Analog:** 本 phase 自身 `write/word.ts`(Phase 4 真正消费,Phase 3 只为骨架完整)

**Pattern:**
```typescript
import type { ToolDef, ToolResult } from '../index';

interface GetParagraphCountArgs { /* empty */ }

export const getParagraphCount: ToolDef<GetParagraphCountArgs> = {
  name: 'get_paragraph_count',
  description: '获取 Word 文档段落总数(Phase 4 才上线,目前是骨架占位)',
  parameters: { type: 'object', properties: {}, required: [] },
  humanLabel: () => '读取段落总数',
  async execute(_args, _ctx): Promise<ToolResult> {
    return { ok: false, error: {
      code: 'UNSUPPORTED', message: '该工具尚未在 Phase 3 启用',
      hint: '该工具计划在 Phase 4 上线', recoverable: false,
    }};
  },
};
```
**注:** Phase 3 不把此 tool 加入 `buildToolsForHost('word')` 返回数组,只在文件内 export 备用(D-07 「占位」语义)。

---

### `src/components/AgentControlBar.tsx` (component, event-driven Zustand selector)

**Analog:** `src/components/SelectionPill.tsx` — Zustand selectors + 条件 null + 内联 SVG + Lingui macro

**Selector pattern** (SelectionPill.tsx lines 27-29):
```typescript
const attachEnabled = useProviderStore((s) => s.attachEnabled);
const setAttachEnabled = useProviderStore((s) => s.setAttachEnabled);
```
**For AgentControlBar.tsx (字段级订阅,不全量):**
```typescript
const status = useAgentStore((s) => s.agentStatus);
const currentStep = useAgentStore((s) => s.currentStep);
const pause = useAgentStore((s) => s.pause);
const resume = useAgentStore((s) => s.resume);
const abort = useAgentStore((s) => s.abort);
```

**Conditional null return + className 条件类 pattern** (SelectionPill.tsx lines 56-71):
```typescript
return (
  <span className={`aster-selection-pill${attachEnabled ? '' : ' is-disabled'}`}>
    <button type="button" className="aster-selection-pill__eye"
      onClick={() => setAttachEnabled(!attachEnabled)}
      aria-label={attachEnabled ? t`关闭附带选区` : t`开启附带选区`}
      title={attachEnabled ? t`关闭附带选区` : t`开启附带选区`}
    >
      {attachEnabled ? <EyeIcon /> : <EyeOffIcon />}
    </button>
    <span className="aster-selection-pill__text">{ctx}</span>
  </span>
);
```
**For AgentControlBar.tsx:**
```typescript
import { useLingui } from '@lingui/react/macro';
import { useAgentStore } from '../agent/agentStore';
import { PauseIcon, PlayIcon, SquareIcon } from './icons';

const MAX_STEPS = 20;   // 与 loop.ts 共享常量(extract to constant 文件或 loop.ts 导出)

export default function AgentControlBar(): React.ReactElement | null {
  const { t } = useLingui();
  const status = useAgentStore((s) => s.agentStatus);
  const currentStep = useAgentStore((s) => s.currentStep);
  const pause = useAgentStore((s) => s.pause);
  const resume = useAgentStore((s) => s.resume);
  const abort = useAgentStore((s) => s.abort);

  if (status === 'idle') return null;

  return (
    <div className="aster-agent-bar">
      <span className="aster-agent-bar__step">{currentStep} / {MAX_STEPS}</span>
      <button
        type="button"
        className="aster-iconbtn"
        onClick={status === 'paused' ? resume : pause}
        aria-label={status === 'paused' ? t`继续` : t`暂停`}
        title={status === 'paused' ? t`继续` : t`暂停`}
      >
        {status === 'paused' ? <PlayIcon /> : <PauseIcon />}
      </button>
      <button
        type="button"
        className="aster-iconbtn"
        onClick={() => abort('user')}
        aria-label={t`中止`}
        title={t`中止`}
      >
        <SquareIcon />
      </button>
    </div>
  );
}
```

**Visual tokens (CLAUDE.md §UI 设计系统 + RESEARCH.md L556-562):**
- 容器:`--glass-bg`(玻璃拟态半透明)
- 暂停按钮 hover:`--brand-gradient`(紫→靛→蓝渐变 accent,只作 accent 不做大面积)
- Step counter:`--text-3` + 11px font-size(对照 CostBadge.tsx 同款小字)
- 间距:`var(--sp-1)`-`var(--sp-3)` (4-12px 节奏)
- 圆角:`var(--r-md)` 或 `var(--r-pill)` (与现有 `.aster-iconbtn` 一致)
- 过渡:`var(--dur)` / `var(--ease)` (150-300ms)

**新增 icon SVG** 需追加到 `src/components/icons.tsx`,沿用 `{...base}` spread 模式(icons.tsx lines 9-17):
```typescript
const base = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.75, strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const, 'aria-hidden': true,
};

/** 暂停(两条竖线) */
export function PauseIcon(): ReactElement {
  return (
    <svg {...base}>
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 继续(三角播放) */
export function PlayIcon(): ReactElement { /* ... 同 base spread + 三角 path */ }

/** 中止(方块,可复用 StopIcon 或新增 SquareIcon —— StopIcon 已存在,流式停止用,语义略不同;建议新增 SquareIcon 或直接复用) */
```
**注:** `StopIcon` 已在 icons.tsx line 62 存在(用于「停止生成」流式 abort)。AgentControlBar 「中止」按钮可复用 StopIcon,但语义上「中止 agent run」比「停止流」更重(会跳出 undo all toast 占位),命名建议保持 `SquareIcon` 单独导出便于将来差异化。

---

### `src/agent/loop.test.ts` (test, unit)

**Analog:** `src/lib/sse.test.ts` lines 50-185 — mock fetch + ReadableStream 构造 SSE 文本 + for-await 收集 events 后断言

**Mock 依赖 + for-await 累积事件 pattern** (sse.test.ts lines 59-82):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { streamSSE } from './sse';

describe('streamSSE', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('应 yield 两个 SSEDelta 和一个 SSEUsage(正常流)', async () => {
    const sseText = [
      'data: {"id":"1","choices":[{"delta":{"content":"Hello"}}]}',
      '',
      'data: [DONE]', '',
    ].join('\n');
    vi.mocked(fetch).mockResolvedValue(makeMockResponse(makeStream(sseText)));

    const events = [];
    for await (const event of streamSSE(/*...*/)) { events.push(event); }

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ type: 'delta', content: 'Hello' });
  });
});
```
**For loop.test.ts(覆盖 AGENT-01 / AGENT-02 / AGENT-13):**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAgent } from './loop';
import { useAgentStore } from './agentStore';
import { useChatStore } from '../store/chat';

describe('runAgent — natural stop (AGENT-01)', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], isStreaming: false, abortController: null });
    useAgentStore.setState({ agentStatus: 'idle', currentStep: 0, currentRunId: null });
  });

  it('LLM 无 tool_calls 时退出循环', async () => {
    // Mock OpenAICompatibleLLM.streamChat 返回 delta-only generator
    vi.mock('../providers/openai-compat', () => ({
      OpenAICompatibleLLM: vi.fn(() => ({
        async *streamChat() { yield { type: 'delta', content: 'done' }; }
      }))
    }));
    const mockAdapter = makeMockAdapter('word');
    const controller = new AbortController();
    await runAgent('test prompt', undefined, mockAdapter, controller.signal);
    expect(useAgentStore.getState().agentStatus).toBe('idle');
  });
});

describe('runAgent — max_steps soft landing (AGENT-02)', () => {
  it('hit 20 步时不 abort 而 push 软着陆 prompt', async () => {
    // Mock LLM 永远返 tool_call
    // ... loop 跑满 20 后,断言 chatStore 最后一条消息 toolName === 'soft-landing'
  });

  it('用户点继续 20 步时 step counter reset', async () => {
    // ...continueRun(runId) 后 currentStep 归零,agentStatus 'running'
  });
});

describe('runAgent — abort sources (AGENT-13)', () => {
  it('4 路 abort 都走 agentStore.abort(reason)', () => {
    // 各 reason 路径,断言 lastAbortReason 字段值
  });
});
```

**关键 mock 工具:** `vi.mock('../providers/openai-compat', ...)` 替换 streamChat 行为;`makeMockAdapter` 复用 `DocumentAdapter.test.ts` stubAdapter 模式(详见下方)。

---

### `src/agent/agentStore.test.ts` (test, unit)

**Analog:** `src/adapters/DocumentAdapter.test.ts` lines 124-166 — interface 实现 stub + 方法存在性 + 行为断言

**Stub interface implementation pattern** (DocumentAdapter.test.ts lines 124-141):
```typescript
describe('DocumentAdapter interface (structural check)', () => {
  it('should be implementable as an object satisfying the interface', () => {
    const stubAdapter: DocumentAdapter = {
      getSelection: () => Promise.resolve({ kind: 'none' }),
      onSelectionChanged: (_cb: () => void) => () => {},
      capabilities: () => ({ supportedInserts: [], supportsSelectionEvents: false, host: 'ppt' }),
      insert: (_content: InsertableContent) => Promise.resolve(),
    };
    expect(typeof stubAdapter.getSelection).toBe('function');
  });
});
```
**For agentStore.test.ts:**
```typescript
import { useAgentStore } from './agentStore';
import { describe, it, expect, beforeEach } from 'vitest';

describe('agentStore state transitions', () => {
  beforeEach(() => {
    useAgentStore.setState({
      agentStatus: 'idle', currentStep: 0, currentRunId: null,
      controller: null, lastAbortReason: null, runningTools: [],
    });
  });

  it('pause/resume transitions', () => {
    useAgentStore.setState({ agentStatus: 'running' });
    useAgentStore.getState().pause();
    expect(useAgentStore.getState().agentStatus).toBe('paused');
    useAgentStore.getState().resume();
    expect(useAgentStore.getState().agentStatus).toBe('running');
  });

  it('abort sources (AGENT-13): visibility / user / max_steps / circuit', () => {
    const ctrl = new AbortController();
    useAgentStore.setState({ controller: ctrl, agentStatus: 'running' });
    useAgentStore.getState().abort('user');
    expect(useAgentStore.getState().lastAbortReason).toBe('user');
    expect(useAgentStore.getState().agentStatus).toBe('idle');
    expect(ctrl.signal.aborted).toBe(true);
  });

  it('pause does not abort in-flight tool', async () => {
    // 验证 pause 不调 controller.abort();
    // awaitResume 阻塞 next step 但 in-flight Word.run promise 自然 resolve
  });
});
```

**Zustand `setState` 直接重置模式** 参考 ChatStream.test.tsx lines 122-126:
```typescript
beforeEach(() => {
  useChatStore.setState({ messages: [], isStreaming: false, abortController: null });
  vi.clearAllMocks();
});
```

---

### `src/agent/tools/index.test.ts` (test, unit)

**Analog:** `src/adapters/DocumentAdapter.test.ts` 整体结构 + `src/lib/sse.test.ts` mock + 断言风格

**ToolDef interface 断言 pattern:**
```typescript
import { describe, it, expect } from 'vitest';
import { buildToolsForHost } from './index';

describe('ToolDef interface', () => {
  it('every tool must export humanLabel function (AGENT-08)', () => {
    const wordTools = buildToolsForHost('word');
    for (const tool of wordTools) {
      expect(typeof tool.humanLabel).toBe('function');
      expect(typeof tool.humanLabel({ text: 'test' } as never)).toBe('string');
    }
  });

  it('every tool must export execute async function', () => {
    const wordTools = buildToolsForHost('word');
    for (const tool of wordTools) {
      expect(typeof tool.execute).toBe('function');
    }
  });

  it('buildToolsForHost returns array (not Map) for OpenAI tools wire compat', () => {
    expect(Array.isArray(buildToolsForHost('word'))).toBe(true);
    expect(Array.isArray(buildToolsForHost('excel'))).toBe(true);
    expect(Array.isArray(buildToolsForHost('ppt'))).toBe(true);
  });
});
```

---

### `src/agent/tools/dispatch.test.ts` (test, unit — ERR-01 / ERR-02 核心)

**Analog:** `src/lib/sse.test.ts` lines 158-170 — 「请求体不应包含 apiKey 字段」style 断言(用 `not.toMatch` / `not.toContain`)

**Sanitize 断言 pattern** (sse.test.ts lines 158-170):
```typescript
it('请求体不应包含 apiKey 字段(T-02-04)', async () => {
  // ... 跑流程 ...
  const callArgs = vi.mocked(fetch).mock.calls[0];
  const requestBody = JSON.parse(callArgs[1]?.body as string);
  expect(requestBody).not.toHaveProperty('apiKey');
  expect(JSON.stringify(requestBody)).not.toContain('secret-key-12345');
});
```
**For dispatch.test.ts (ERR-02 sanitize,完整模式见 RESEARCH.md L1281-1315):**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { dispatchTool } from './index';
import type { ToolDef } from './index';
import { HostApiError } from '../../errors';

describe('dispatchTool sanitize (ERR-02)', () => {
  const mockAdapter = makeMockAdapter('word');

  it('AsterError 子类:只取四字段,不含 stack/path/key', async () => {
    const mockTool: ToolDef = {
      name: 'mock_throw',
      description: '',
      parameters: {},
      humanLabel: () => '',
      async execute() {
        throw new HostApiError('宿主调用失败', /*hostError=*/{
          stack: 'Error at /Users/wb.chen/.../adapter.ts:142',
        });
      },
    };

    const result = await dispatchTool(
      { id: 'c1', name: 'mock_throw', arguments: {} },
      { adapter: mockAdapter, runId: 'r1', stepIndex: 1, signal: new AbortController().signal },
      [mockTool],
    );

    expect(result.ok).toBe(false);
    expect(result.error!.code).toBe('HOST_API_FAILED');
    expect(JSON.stringify(result)).not.toMatch(/__dirname/);
    expect(JSON.stringify(result)).not.toMatch(/process\.env/);
    expect(JSON.stringify(result)).not.toMatch(/sk-/);
    expect(JSON.stringify(result)).not.toMatch(/\/Users\//);
    expect(result.error!.hint).toBeTruthy();
  });

  it('陌生异常(非 AsterError)→ 兜底 UNSUPPORTED + 占位 hint', async () => {
    const mockTool: ToolDef = {
      name: 'mock_throw_raw',
      description: '', parameters: {}, humanLabel: () => '',
      async execute() {
        const err = new Error(
          '/Users/wb.chen/.../foo.ts:42 Key: sk-abc123 process.env.FOO=bar'
        );
        err.stack = 'Error: ...\n  at /Users/.../...';
        throw err;
      },
    };
    const result = await dispatchTool(
      { id: 'c1', name: 'mock_throw_raw', arguments: {} },
      { adapter: mockAdapter, runId: 'r1', stepIndex: 1, signal: new AbortController().signal },
      [mockTool],
    );
    expect(result.error!.code).toBe('UNSUPPORTED');
    expect(result.error!.message).toBe('宿主操作失败');
    expect(result.error!.hint).toBe('发生错误,请重试');
    expect(JSON.stringify(result)).not.toMatch(/\/Users\//);
    expect(JSON.stringify(result)).not.toMatch(/sk-/);
  });
});

describe('ToolError schema (ERR-01)', () => {
  it('returned error has exactly 4 fields: code, message, recoverable, hint', async () => {
    // ...断言 Object.keys(result.error).sort() 是固定 4 字段
  });

  it('code is one of 8 enums', async () => {
    const ALLOWED = ['INVALID_ARGS','NOT_FOUND','PERMISSION_DENIED','HOST_API_FAILED',
                     'PRIVACY_BLOCKED','CIRCUIT_OPEN','STEP_LIMIT','UNSUPPORTED'];
    // ...断言 result.error.code 必须 ∈ ALLOWED
  });
});
```

---

### `src/agent/tools/write/word.test.ts` (test, unit)

**Analog:** `src/adapters/DocumentAdapter.test.ts` stubAdapter pattern + `src/lib/sse.test.ts` vi.fn 断言

**Mock adapter + tool execute 调用断言 pattern:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { appendParagraph } from './word';
import type { DocumentAdapter } from '../../../adapters/DocumentAdapter';
import type { WordAdapter } from '../../../adapters/WordAdapter';

describe('appendParagraph tool', () => {
  it('humanLabel returns 中文 + 截 30 字符', () => {
    expect(appendParagraph.humanLabel({ text: '短文本' })).toMatch(/在文档末尾追加段落.短文本/);
    const long = 'a'.repeat(50);
    expect(appendParagraph.humanLabel({ text: long })).toMatch(/…/);
  });

  it('execute 调 adapter.appendParagraph 并返 ok+reverse descriptor', async () => {
    const mockAppendParagraph = vi.fn().mockResolvedValue(undefined);
    const mockAdapter = {
      appendParagraph: mockAppendParagraph,
      // ... 其它 DocumentAdapter 接口方法 stub
    } as unknown as WordAdapter;

    const result = await appendParagraph.execute(
      { text: '段落 1' },
      { adapter: mockAdapter as unknown as DocumentAdapter, runId: 'r1', stepIndex: 1,
        signal: new AbortController().signal },
    );

    expect(mockAppendParagraph).toHaveBeenCalledWith('段落 1');
    expect(result.ok).toBe(true);
    expect(result.reverse).toEqual({ tool: 'delete_last_paragraph', args: {} });
  });
});
```

---

### `src/agent/operationLog.test.ts` (test, unit)

**Analog:** `src/adapters/DocumentAdapter.test.ts` 纯函数 API 断言风格

**Pattern:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { appendOperation, getOperationsByRun } from './operationLog';

describe('operationLog skeleton', () => {
  // 模块级状态:每个 test 前需要重置(暂无 reset API,可借助 dynamic import 或在源码加 reset for test)
  it('appendOperation pushes to in-mem log', () => {
    appendOperation({
      runId: 'r1', stepIndex: 1, toolName: 'append_paragraph',
      args: { text: 'hi' }, humanLabel: '...',
      reverse: { tool: 'delete_last_paragraph', args: {} },
      timestamp: Date.now(),
    });
    const entries = getOperationsByRun('r1');
    expect(entries).toHaveLength(1);
    expect(entries[0].toolName).toBe('append_paragraph');
  });

  it('getOperationsByRun filters by runId', () => {
    // append r1 / r2 各一条;断言 getOperationsByRun('r1') 只回 r1
  });
});
```
**注:** Phase 3 骨架 in-mem 数组,无 reset 接口;test 文件可加一行 reset helper 或源码 export `__resetForTest()` 测试专用。

---

### `src/components/AgentControlBar.test.tsx` (test, component)

**Analog:** `src/components/ChatStream.test.tsx` — RTL + jsdom + Zustand setState + AdapterContext mock + Lingui mock

**Full RTL + Zustand 设置 + render 模式** (ChatStream.test.tsx lines 17-115):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { AdapterContext } from '../context/AdapterContext';
import ChatStream from './ChatStream';
import { useChatStore } from '../store/chat';
import type { DocumentAdapter } from '../adapters/DocumentAdapter';

vi.mock('./ChatBubble', () => ({ default: ({ message }: { message: Message }) => (
  <div data-testid={`bubble-${message.id}`}>{message.content}</div>
)}));

vi.mock('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({ _: (id: string) => id }),
}));

const mockAdapter: DocumentAdapter = {
  capabilities: () => ({ host: 'ppt' as const, supportsSelectionEvents: false, supportedInserts: ['text' as const] }),
  getSelection: async () => ({ kind: 'none' as const }),
  onSelectionChanged: () => () => {},
  insert: async () => {},
};

beforeEach(() => {
  useChatStore.setState({ messages: [], isStreaming: false, abortController: null });
  vi.clearAllMocks();
});
```
**For AgentControlBar.test.tsx:**
```typescript
import { useAgentStore } from '../agent/agentStore';
import AgentControlBar from './AgentControlBar';
import { render, fireEvent } from '@testing-library/react';

vi.mock('@lingui/react/macro', () => ({
  useLingui: () => ({ t: (s: TemplateStringsArray) => String.raw({ raw: s }) }),
}));

beforeEach(() => {
  useAgentStore.setState({ agentStatus: 'idle', currentStep: 0, /*...*/ });
});

describe('AgentControlBar', () => {
  it('agentStatus=idle 不渲染', () => {
    const { container } = render(<AgentControlBar />);
    expect(container.firstChild).toBeNull();
  });

  it('agentStatus=running 渲染 pause + abort + step counter', () => {
    useAgentStore.setState({ agentStatus: 'running', currentStep: 3 });
    const { container, getByLabelText } = render(<AgentControlBar />);
    expect(container.textContent).toMatch(/3 \/ 20/);
    expect(getByLabelText(/暂停/)).toBeTruthy();
    expect(getByLabelText(/中止/)).toBeTruthy();
  });

  it('点 pause 按钮 → agentStatus = paused', () => {
    useAgentStore.setState({ agentStatus: 'running', currentStep: 3 });
    const { getByLabelText } = render(<AgentControlBar />);
    fireEvent.click(getByLabelText(/暂停/));
    expect(useAgentStore.getState().agentStatus).toBe('paused');
  });

  it('点 abort 按钮 → lastAbortReason = user', () => {
    const ctrl = new AbortController();
    useAgentStore.setState({ agentStatus: 'running', controller: ctrl });
    const { getByLabelText } = render(<AgentControlBar />);
    fireEvent.click(getByLabelText(/中止/));
    expect(useAgentStore.getState().lastAbortReason).toBe('user');
  });

  it('agentStatus=soft-landing 渲染软着陆 card(可选 - 决策点在 RESEARCH §Open Q4 推荐 ChatStream 内特殊消息;若决定 AgentControlBar 内 render,在此测)', () => {
    // ...
  });
});
```

---

### `src/components/SelectionPill.test.tsx` 和 `ContextCard.test.tsx` (test, CARRY-01)

**Analog:** `src/components/ChatStream.test.tsx` RTL + AdapterContext.Provider 包裹 + mockAdapter

**完整 CARRY-01 mount 时序断言 pattern** (详见 RESEARCH.md L1454-1483):
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AdapterContext } from '../context/AdapterContext';
import SelectionPill from './SelectionPill';
import type { DocumentAdapter } from '../adapters/DocumentAdapter';

vi.mock('@lingui/react/macro', () => ({
  useLingui: () => ({ t: (s: TemplateStringsArray) => String.raw({ raw: s }), i18n: { _: (s: string) => s } }),
}));

describe('CARRY-01: SelectionPill first-mount ctx', () => {
  it('PPT host: selected slide → 首帧显示「第 3 张 slide」', async () => {
    const mockAdapter: DocumentAdapter = {
      getSelection: vi.fn().mockResolvedValue({ kind: 'ppt', slideIndex: 3, slideCount: 10 }),
      onSelectionChanged: vi.fn(() => () => {}),
      capabilities: vi.fn(() => ({ host: 'ppt', supportsSelectionEvents: true, supportedInserts: ['text'] })),
      insert: vi.fn(),
    };

    // 路径 A:模拟 main.tsx 预取选区并灌入 useSelectionStore.initial(或 props)
    const initialSelection = await mockAdapter.getSelection();
    // 假设新增 useSelectionStore 字段 initial,用 setState 注入:
    // useSelectionStore.setState({ initial: initialSelection });

    const { container } = render(
      <AdapterContext.Provider value={mockAdapter}>
        <SelectionPill />
      </AdapterContext.Provider>
    );

    expect(container.textContent).toMatch(/第 3 张 slide/);
    expect(container.textContent).not.toMatch(/未选中内容/);
  });

  it('Excel host: selected range A1:C10 → 首帧显示', async () => { /* 同 */ });
  it('Word host: selected 150 chars → 首帧显示「选中 150 字」', async () => { /* 同 */ });
});
```
**ContextCard.test.tsx 一致模式** —— 只是组件不同,断言文案差异(ContextCard 形如 `aster-context__text`,SelectionPill 形如 `aster-selection-pill__text`)。

**Lingui macro mock 替代:** SelectionPill 用 `useLingui` 拿到 `t`/`i18n`(SelectionPill.tsx line 26),test 内 mock `useLingui` 返回桩 `i18n` 对象(`{ _: (s: string) => s }` 直通)。formatSelection 是真实函数,接受 i18n 输出。

---

### `src/main.test.tsx` (test, CARRY-01 integration)

**Analog:** `src/components/ChatStream.test.tsx` — render + AdapterContext.Provider + 模拟 Office.onReady

**Pattern:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import App from './App';

describe('CARRY-01 integration: main.tsx 路径 A', () => {
  it('Office.onReady 内预取选区 → App 首帧 SelectionPill 已有 ctx', async () => {
    const mockAdapter = {
      getSelection: vi.fn().mockResolvedValue({ kind: 'word', charCount: 150 }),
      onSelectionChanged: vi.fn(() => () => {}),
      capabilities: vi.fn(() => ({ host: 'word', supportsSelectionEvents: true, supportedInserts: ['text'] })),
      insert: vi.fn(),
    };

    // 模拟 main.tsx 路径 A 顺序:hydrateFromStorage → getSelection → render
    const initialSelection = await mockAdapter.getSelection();

    // render <App initialSelection={initialSelection} /> 或注入 useSelectionStore.initial
    // 断言:首帧不出现「未选中内容」占位
  });
});
```

---

### `src/store/chat.ts` (modify, thin delegate)

**Analog:** 自身 — 削减 `sendMessage` 内 LLM streaming / usage / tool_call_end 路径,改 thin delegate;Message 类型加 'tool' role + 删 cost 字段;删 acceptToolCall/rejectToolCall。

**Message 类型修改 pattern** (chat.ts lines 50-63 当前):
```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';   // ← 加 'tool'
  content: string;
  isStreaming?: boolean;
  tokenCount?: number;                    // ← 删
  costCny?: number | null;                // ← 删
  errorCode?: string;
  retryPrompt?: string;
  toolCalls?: ToolCall[];                 // ← 保留
}
```
**改为(D-08 schema):**
```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'error';
  content: string;
  isStreaming?: boolean;
  errorCode?: string;
  retryPrompt?: string;
  // 'tool' role 专用:
  toolCallId?: string;
  toolName?: string;
  toolResult?: ToolResult;   // import type from '../agent/tools'
  agentRunId?: string;
  agentStep?: number;
  // assistant role 保留:
  toolCalls?: ToolCall[];
}
```

**sendMessage thin delegate pattern (D-01 + RESEARCH.md L823-837):**
```typescript
async sendMessage(prompt, selectionCtx) {
  // Thin delegate — 主路径只在 agentStore.runAgent
  const adapter = /* via store-level context or main.tsx wired */;
  await useAgentStore.getState().runAgent(prompt, selectionCtx, adapter);
},
```
**关键删:** L93-264 整段(LLM streaming / usage event / tool_call_end 解析路径)从 sendMessage 内删除,这块逻辑搬到 `src/agent/loop.ts`;`abortController` 字段建议保留但永远 null(便于将来兼容)或彻底删除(Open Q1,planner 决策)。

**删除方法:**
- `acceptToolCall` (lines 284-312) — 删
- `rejectToolCall` (lines 314-327) — 删
- `stopStreaming` (lines 267-269) — 改为转发到 `useAgentStore.getState().abort('user')` 或删(planner 决策)

---

### `src/store/providers.ts` (modify, 删 autoInsertMode)

**Analog:** 自身。删除清单(D-08 / D-21):
- L46-49 `AutoInsertMode` type — 删
- L62 字段 `autoInsertMode: AutoInsertMode` — 删
- L78-79 方法 `setAutoInsertMode` — 删
- L95 init `autoInsertMode: storage.get<...>(STORAGE_KEYS.AUTO_INSERT_MODE) ?? 'confirm'` — 删
- L146-149 `setAutoInsertMode` 实现 — 删
- L176, L200-201 `hydrateFromStorage` 内 `autoInsertMode` 路径 — 删
- `STORAGE_KEYS.AUTO_INSERT_MODE` 常量在 storage.ts 删除(A6 决策:残留 localStorage key 不清理)

**Hydrate 删除 pattern** (providers.ts lines 197-205 当前):
```typescript
useProviderStore.setState({
  providers: mergedProviders,
  defaultLLMProviderId: defaultId,
  attachEnabled,
  autoInsertMode,    // ← 删除此行
});
```

---

### `src/providers/openai-compat.ts` (modify, 移除 hardcode tool)

**Analog:** 自身。具体改动:
- L24-48 `INSERT_TO_DOCUMENT_TOOL` 整段常量 — 删
- L50-83 `streamChat()` 方法签名加 `tools?: ToolDef[]` 参数(从 caller 传入)
- L92-104 `_startStream` 内 `body.tools = [INSERT_TO_DOCUMENT_TOOL]` 改为 `if (shouldAttachTools && tools && tools.length > 0) body.tools = tools;`
- L21 `import { useProviderStore } from '../store/providers'` 路径保留(`setSupportsToolCall` 探测语义保留)

**Pattern modify:**
```typescript
async *streamChat(
  messages: ChatMessage[],
  config: LLMConfig,
  signal: AbortSignal,
  tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: object } }>,
): AsyncGenerator<SSEEvent> {
  // ... try/catch 不变
  // _startStream 改为接受 tools 参数
}
```
**调用方在 loop.ts:** 用 `buildToolsForHost(adapter.capabilities().host)` 拼出 OpenAI wire 格式 tools array,传给 `streamChat(messages, config, signal, toolDefs)`。

---

### `src/components/ChatStream.tsx` (modify, 渲染 role='tool')

**Analog:** 自身 — 当前 L127 `messages.map` 直接 forward 给 ChatBubble;Phase 3 需要按 role 分发。

**Modify pattern:**
```typescript
return (
  <div className="aster-messages" ref={scrollRef} onScroll={handleScroll}>
    {messages.map((m) => {
      if (m.role === 'tool') {
        return <ToolResultCard key={m.id} message={m} />;   // 新增小组件 / 内联
      }
      return (
        <ChatBubble key={m.id} message={m}
          onRetry={() => void retryMessage(m.id)} onSettings={onSettings} />
      );
    })}
  </div>
);
```
`ToolResultCard` 渲染逻辑:展示 `humanLabel(args)` 中文文案 + 默认折叠 + 点击展开看 toolResult.data / error。复用 ChatBubble.tsx L94-114 已有的 `aster-tool-card` CSS 类(Phase 3 改为 agent 时代语义)。

**软着陆消息特殊渲染** (Open Q4 推荐方案):`m.toolName === 'soft-landing'` 时 ChatStream/ToolResultCard 渲染「Aster 觉得这事还没干完...」+ 两按钮(继续 20 步 / 停下)。

---

### `src/components/ChatBubble.tsx` (modify, 删 CostBadge / Tool 路径)

**Analog:** 自身。删除清单(D-08 / D-21):
- L32 `import CostBadge from './CostBadge';` — 删
- L34 `import { InsertIcon, CheckIcon } from './icons';` — `InsertIcon` / `CheckIcon` 用否检查(ToolCallPreviewCard 删后可能不再用)
- L42-52 `positionLabel` — 删
- L56-114 `ToolCallPreviewCard` 整段 — 删
- (整文件其余位置)`AutoInsertEffect` 组件 — 删(D-08)
- (整文件其余位置)`FallbackInsertMenu` 组件 — 删(RESEARCH.md L1505 推荐完全删,planner 决策点)
- 其余位置 `<CostBadge tokenCount={...} costCny={...} />` 嵌点 — 删

**保留:** assistant `<ReactMarkdown>` 路径 + ErrorBubble 委托(role='error')。

---

### `src/adapters/WordAdapter.ts` (modify, 加 appendParagraph)

**Analog:** 自身 L88-115 — 新增方法套用同款 try/catch 包成 HostApiError 模式。

**Modify(在 class 内追加):**
```typescript
async appendParagraph(text: string): Promise<void> {
  try {
    await Word.run(async (ctx) => {
      ctx.document.body.insertParagraph(text, Word.InsertLocation.end);
      await ctx.sync();
    });
  } catch (err) {
    throw new HostApiError('Word append_paragraph 失败', err);
  }
}
```
**注:** `Word.InsertLocation.end` v1 已在 L106 用过(`append_end` 路径)→ A3 假设 verified by v1。

**类型导出:** 类内方法,WordAdapter 类层级。Phase 3 不在 `DocumentAdapter` interface 上加 `appendParagraph`(read tool 跨宿主接口归 Phase 4);用 `(ctx.adapter as WordAdapter).appendParagraph(text)` cast 调(tools/write/word.ts execute 路径)。

---

### `src/errors/index.ts` (modify, 补四字段 + 新增 2 类)

**Analog:** 自身 — 现有 8 子类(KeyInvalid / Quota / Context / Network / RateLimit / ContentFilter / ModelNotFound / ImageQuota + HostApi / Unsupported) 补 `recoverable` / `hint` 两字段。

**Existing subclass pattern** (errors/index.ts lines 50-54):
```typescript
export class KeyInvalidError extends AsterError {
  constructor(message: string) {
    super(message, 'KEY_INVALID', 'provider');
  }
}
```
**Phase 3 补四字段(详见 RESEARCH.md L735-779):**
```typescript
export class KeyInvalidError extends AsterError {
  public readonly recoverable = false;
  public readonly hint = '请前往设置更新 API Key';
  constructor(message: string) {
    super(message, 'KEY_INVALID', 'provider');
  }
}
```
8 类全部补;参考 RESEARCH.md §Deliverable 4.1 / Example B 详细每类 message/hint 中文文案。

**HostApiError 关键修改** (errors/index.ts lines 154-162):
```typescript
export class HostApiError extends AsterError {
  public readonly hostError?: unknown;   // ← 删除此字段(防 stack/path 跨边界)
  constructor(message: string, hostError?: unknown) {
    super(message, 'HOST_API', 'adapter');
    this.hostError = hostError;          // ← 删除此行
  }
}
```
**改为:**
```typescript
export class HostApiError extends AsterError {
  public readonly recoverable = true;
  public readonly hint = '宿主操作可瞬时失败,可重试一次';
  constructor(message: string, _hostError?: unknown) {
    super(message, 'HOST_API', 'adapter');
    // 不存 hostError;若调试需要,改用 console.warn 在 adapter 层直接打到 DevTools
  }
}
```
**调试 fallback:** WordAdapter 等抛 HostApiError 前 `console.warn('[Aster] Word.run failed', err)` 把原始 err 打到 DevTools(不挂在 error 实例上,不跨边界)。

**新增 2 类(RESEARCH.md L751-767):**
```typescript
export class CircuitOpenError extends AsterError {
  public readonly recoverable = false;
  public readonly hint: string;
  constructor(toolName: string) {
    // toolName 来自 tool registry 受控 string literal subset,允许 interpolation
    super(`工具 ${toolName} 连续失败,已强制停止`, 'CIRCUIT_OPEN', 'adapter');
    this.hint = '换个 tool 或换个思路再试';
  }
}

export class StepLimitError extends AsterError {
  public readonly recoverable = true;
  public readonly hint = '已达单轮上限,请确认是否继续';
  constructor() {
    super('已达单轮 20 步上限', 'STEP_LIMIT', 'adapter');
  }
}
```

**TS 抽象类约束(可选,RESEARCH.md L1247-1252):** 把 `AsterError` 改为 abstract 强制子类必须提供 `recoverable / hint`,会破坏 v1 调用点签名;Phase 3 推荐先在 Phase 3 改造 PR 内一并补齐 10 类,不必上 abstract(避免一次性改面过大)。

---

### `src/lib/sse.ts` (modify, @deprecated SSEUsage)

**Analog:** 自身。仅加注释,不删类型。

**Modify pattern(在 SSEUsage 类型上方加 jsdoc):**
```typescript
/**
 * @deprecated since v2.0 — usage 事件保留兼容 stream_options 输出格式,
 *   但 v2 chatStore / agent loop 不消费此字段(cost 全砍,无 budget 估算)。
 *   保留是为了陌生 SSE upstream 不报错;将来若 Provider 强制要求 include_usage:false 可一并移除。
 */
export interface SSEUsage {
  type: 'usage';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
```
loop.ts 在 streaming for-await switch 内 `case 'usage'` 一律 `continue` 不消费。

---

### `src/main.tsx` (modify, CARRY-01 路径 A)

**Analog:** 自身 L45-69 — Office.onReady 回调内 hydrateFromStorage → render 三段式。

**Current pattern** (main.tsx lines 45-69):
```typescript
Office.onReady((info) => {
  const adapter = createAdapter(info.host);
  hydrateFromStorage();
  const container = document.getElementById('root');
  container.dataset.theme = resolveHostTheme();
  const root = createRoot(container);
  root.render(
    <I18nProvider i18n={i18n}>
      <AdapterContext.Provider value={adapter}>
        <App />
      </AdapterContext.Provider>
    </I18nProvider>
  );
});
```
**Modify(CARRY-01 路径 A,详见 RESEARCH.md L844-868):**
```typescript
Office.onReady(async (info) => {
  const adapter = createAdapter(info.host);
  hydrateFromStorage();

  // CARRY-01 修复:root.render 前主动取一次选区,作为初值
  let initialSelection: SelectionContext = { kind: 'none' };
  try {
    initialSelection = await adapter.getSelection();
  } catch {
    // 极端情况兜底 'none',组件 onSelectionChanged 会补
  }

  const container = document.getElementById('root');
  if (!container) throw new Error('未找到 #root 容器...');
  container.dataset.theme = resolveHostTheme();

  createRoot(container).render(
    <I18nProvider i18n={i18n}>
      <AdapterContext.Provider value={adapter}>
        <App initialSelection={initialSelection} />
        {/* 或:在 root.render 前先 useSelectionStore.setState({ initial: initialSelection }) */}
      </AdapterContext.Provider>
    </I18nProvider>
  );
});
```
**Open Q2 决策:** ContextCard / SelectionPill 的 useEffect 内 `getSelection().then(setCtx)` 推荐删除(初值由 initialSelection / store.initial 提供),保留 `onSelectionChanged` 订阅。

---

### `src/App.tsx` (modify, 传 initialSelection prop)

**Analog:** 自身 L25-120 — 加 `initialSelection` prop 透传给 ContextCard / SelectionPill 或 useSelectionStore 注入。

**Modify pattern:**
```typescript
import type { SelectionContext } from './adapters/DocumentAdapter';

interface AppProps {
  initialSelection?: SelectionContext;
}

export default function App({ initialSelection }: AppProps = {}): React.ReactElement {
  // 选项 1:在 useEffect 内 useSelectionStore.setState({ initial: initialSelection }) 一次性灌
  // 选项 2:把 initialSelection 透传给 ContextCard / SelectionPill 作 useState 初值
  // 推荐选项 1 — 单点灌入,组件不增 prop drilling
}
```

---

### 删除文件

| 文件 | Action |
|---|---|
| `src/components/CostBadge.tsx` | DELETE (35 行) |
| `src/providers/pricing.ts` | DELETE (~75 行,含 PROVIDER_PRICING / CNY_PER_USD / calcCostCny) |
| `src/components/CostBadge.test.tsx` | DELETE(若存在;实测 `ls` 未列出独立测试文件,可能不存在) |
| `src/providers/pricing.test.ts` | DELETE (165 行) |

**Verify command (D-21 cleanup gate):**
```bash
npm test && grep -rn "costCny\|tokenCount\|CostBadge\|calcCostCny\|PROVIDER_PRICING\|CNY_PER_USD\|autoInsertMode\|setAutoInsertMode\|acceptToolCall\|rejectToolCall\|INSERT_TO_DOCUMENT_TOOL" src/
```
期望 0 命中(除删除 PR 中的 doc / commit message)。

---

## Shared Patterns

### 1. AsterError 子类 + 中文 message/hint
**Source:** `src/errors/index.ts` lines 50-175 (现有 8 类) + 本 phase 补全四字段
**Apply to:** `src/agent/tools/index.ts` dispatchTool catch 路径、所有新 tool execute 内 throw

```typescript
// 既有 AsterError 子类 + 本 phase 补 hint/recoverable
throw new HostApiError('Word append_paragraph 失败', err);
// dispatch 层 catch 后只取 .code/.message/.hint/.recoverable 四字段
```

**关键约束(T-01-04 + D-15):**
- message/hint 是 AsterError 子类构造时的字面量(中文),不允许 `string interpolation` 嵌入 dynamic 内容(stack / path / err.message)
- 唯一例外:`CircuitOpenError` 的 toolName interpolation,因 toolName 来自 tool registry literal subset 受控

### 2. Zustand store + named selector hook
**Source:** `src/store/chat.ts` lines 334-338 + `src/store/providers.ts` 整体
**Apply to:** `src/agent/agentStore.ts` (新建)

```typescript
import { create } from 'zustand';

interface FooState { ... }
export const useFooStore = create<FooState>((set, get) => ({ ... }));

// Named selector exports for performance
export const useFoo = () => useFooStore((s) => s.foo);
```
**禁止反例:** AgentControlBar **不要**写 `const state = useAgentStore();`(全 store 订阅,任意字段变就 re-render)。

### 3. 内联 SVG icon `{...base}` spread
**Source:** `src/components/icons.tsx` lines 9-17
**Apply to:** 本 phase 新增 PauseIcon / PlayIcon / SquareIcon (AgentControlBar 用)

```typescript
const base = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.75, strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const, 'aria-hidden': true,
};

export function PauseIcon(): ReactElement {
  return (
    <svg {...base}>
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
```
**禁止反例:** 不引 lucide-react / iconfont CDN;CSS 控色与尺寸,SVG 内只用 `currentColor`。

### 4. CSS variables 走 styles.css token 系统
**Source:** `src/styles.css` (CSS 变量驱动 `[data-theme="light|dark"]` 两套主题)
**Apply to:** `AgentControlBar` 视觉、`role='tool'` 折叠卡视觉

新增 token (若现有 token 不够):走 `src/styles.css` `:root` / `[data-theme="dark"]` 块加变量,不在组件内嵌 inline style 或硬编码 hex/px。
- 容器:`var(--glass-bg)` (现有)、`var(--surface)`
- 渐变 accent:`var(--brand-gradient)` (现有,仅作 accent)
- 文字:`var(--text-3)` (步数小字)
- 间距:`var(--sp-1)`-`var(--sp-3)`
- 圆角:`var(--r-md)` / `var(--r-pill)`

### 5. Lingui macro 包裹所有中文字符串
**Source:** `src/components/SelectionPill.tsx` line 26、`src/components/ChatStream.tsx` line 22
**Apply to:** AgentControlBar / 软着陆卡 / 新 tool 文案(humanLabel 例外 - 由 LLM/UI 共用,直接字面量)

```typescript
import { Trans, useLingui } from '@lingui/react/macro';
const { t } = useLingui();
// JSX text:<Trans>暂停</Trans>
// prop string:aria-label={t`暂停`}
```
**例外:** ToolDef.humanLabel 返回的中文字符串(`'在文档末尾追加段落「...」'`)直接字面量,不走 Lingui macro —— 原因:humanLabel 字符串同时被 chatStore Message.content 消费(JSON.stringify 进 OpenAI wire),Lingui macro 编译后是函数调用,不适合;humanLabel 本身就是「展示 + LLM 通信」双重身份,字面量更稳定。

### 6. Office.js 「pure data in / pure data out」边界
**Source:** `src/adapters/WordAdapter.ts` lines 23-44 / 88-115 (insert/getSelection 模式)
**Apply to:** `src/agent/tools/write/word.ts` execute、`src/adapters/WordAdapter.ts` appendParagraph

```typescript
async appendParagraph(text: string): Promise<void> {
  try {
    await Word.run(async (ctx) => {
      ctx.document.body.insertParagraph(text, Word.InsertLocation.end);
      await ctx.sync();
    });
  } catch (err) {
    throw new HostApiError('Word append_paragraph 失败', err);
  }
}
```
**禁止反例(PITFALLS A-06):** 不要让 `Word.Paragraph` / `Excel.Range` 等 proxy 对象作为返回值跨过 `*.run` 闭包;tool execute 函数内调 adapter method,**不允许**在 agent 层直接调 `Word.run`。

### 7. Vitest unit test 模式
**Source:** `src/lib/sse.test.ts` + `src/adapters/DocumentAdapter.test.ts`
**Apply to:** 所有新增 `*.test.ts` (loop / agentStore / tools/* / operationLog)

- `vi.stubGlobal('fetch', vi.fn())` 或 `vi.mock('module-path', () => ({...}))` mock 外部依赖
- `beforeEach { useFooStore.setState({...initial...}); vi.clearAllMocks(); }` 重置状态
- `expect(value).toBeInstanceOf(SomeError)` AsterError instanceof 断言
- `expect(JSON.stringify(result)).not.toMatch(/sk-/)` 字段不含敏感串断言(ERR-02 sanitize 核心)

### 8. Vitest component test 模式
**Source:** `src/components/ChatStream.test.tsx`
**Apply to:** `AgentControlBar.test.tsx` / `SelectionPill.test.tsx` / `ContextCard.test.tsx` / `main.test.tsx`

- `vi.mock('@lingui/react/macro', () => ({ Trans: ({children}) => <>{children}</>, useLingui: () => ({ t: ..., i18n: ... }) }))` Lingui mock
- `render(<AdapterContext.Provider value={mockAdapter}><Component /></AdapterContext.Provider>)`
- `useFooStore.setState({...})` 直接驱动状态变化
- `fireEvent.click(getByLabelText(/aria-label-text/))` 模拟点击

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/agent/loop.ts` 的 `awaitResume` promise primitive | utility | event-driven | v1 无 pause/resume 概念,RESEARCH.md L1045-1058 提供骨架(Zustand subscribe + AbortSignal 组合) |
| `src/agent/loop.ts` while runner 主循环 | service | streaming + iteration | v1 是「单 fetch 一次性」,无多步循环;RESEARCH.md L340-416 提供骨架 |

两者都不是「无 analog」而是「analog 不完整」—— v1 的 `sendMessage` 提供「streaming → switch event → store update」内层骨架,Phase 3 在外层包一个 `while (step < MAX_STEPS)` 加 pause primitive。planner 可视为「v1 sendMessage + RESEARCH.md L340-416 外层 while」组合即可。

---

## Metadata

**Analog search scope:** `src/store/`、`src/adapters/`、`src/components/`、`src/providers/`、`src/errors/`、`src/lib/`、`src/main.tsx`、`src/App.tsx`
**Files read in this mapping:** 16(chat / providers / errors / WordAdapter / sse / openai-compat / queue / storage / icons / ContextCard / SelectionPill / ChatStream + test / ChatBubble / App / main / DocumentAdapter.test / sse.test)
**Files not re-read:** 02-PATTERNS.md(上游 phase pattern map 已读,大量模式继承)
**Key cross-cutting conventions:**
1. 所有 UI 中文字符串走 Lingui macro(`<Trans>` / `t`)
2. 所有颜色/间距/圆角走 CSS 变量(`src/styles.css` token)
3. 所有图标内联 SVG 走 `src/components/icons.tsx` + `{...base}` spread
4. 所有错误走 AsterError 子类 + 四字段(code/message/recoverable/hint),中文字面量
5. 所有 Office.js 调用「pure data in/out」(A-06 边界)
6. 所有 Zustand store 用 named selector 暴露字段订阅,避免全量 re-render
7. 所有 localStorage 访问走 `src/lib/storage.ts` `storage.{get,set,remove}` 工具(不直接 raw localStorage)
8. **新增(Phase 3):** Agent 层不直接调 `Word.run` / `Excel.run` / `PowerPoint.run`,只调 adapter method;adapter method 输入纯数据 / 输出 `Promise<void>` 或 plain data

**Pattern extraction date:** 2026-05-28
