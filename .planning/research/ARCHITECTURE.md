# Architecture Research — v2.0 Agent Loop Integration into Aster

**Domain:** Multi-step LLM agent loop integrated into existing Office.js Add-in (single-doc, no-backend, BYO Key)
**Researched:** 2026-05-28
**Confidence:** HIGH on integration points (read existing code directly); MEDIUM on diff log strategy (Office.js undo semantics not fully verifiable from training data, see §Diff Log)

---

## Executive Summary

The existing v1 codebase is closer to an agent runtime than it looks. Three things already exist that were designed for single-step but **work as agent primitives with minor extension**:

1. **`chatStore.sendMessage` + `streamSSE` already do `LLM → tool_call_end → adapter.insert`** — that is one iteration of an agent loop. v2 needs to wrap this in a `while (!done && step < 20)` and feed tool results back as a `role: 'tool'` message. The state machine should live in **a new `src/agent/loop.ts`**, NOT inside `chatStore.sendMessage`, because chatStore's current responsibility is "one prompt → one assistant turn" and overloading it with multi-step orchestration mixes concerns badly. Concrete reasoning in §Q1.
2. **`DocumentAdapter.insert(InsertableContent)` is already a typed-discriminated-union tool surface.** v2 just needs the dual: `DocumentAdapter.read(ReadableQuery)` returning `ReadableResult`. Per-host inspect() returning an entire doc model is the wrong granularity (blows token budget); per-query reads matching specific LLM tool names is right. Concrete schema in §Q3.
3. **`Message.toolCalls[]` already exists on the assistant message.** v2 adds `Message.toolResults[]` AND a new `role: 'tool'` message variant for what gets sent BACK to the LLM. Backward-compat for rendering: existing user/assistant/error rendering paths unchanged; new `tool` role gets a collapsed "AI 调用了 X" card. Concrete schema in §Q2.

The agent loop is **not** a rewrite — it's a wrapper around the existing primitives plus four new modules: `src/agent/loop.ts`, `src/agent/tools/`, `src/agent/diff-log.ts`, `src/agent/circuit-breaker.ts`. The diff log requires recording every `adapter.insert/write*` mutation in a ring buffer; undo replays inverse ops in reverse order rather than relying on Office.js's native undo stack (which is unreliable across hosts — see §Diff Log).

The riskiest pieces are **pptx new-slide insert via base64** (already half-built in v1 PptAdapter as `slides` content kind, untested with multi-step LLM-generated outlines) and **diff log inverse ops for slides** (delete-slide vs re-insert-template). Both are flagged for Phase 3 spike.

---

## System Overview (v2 layering on top of v1)

```
┌─────────────────────────────────────────────────────────────────┐
│                         React UI Layer                          │
│  ChatStream (modified) │ AgentControlBar (NEW) │ DiffLogPanel  │
│                          (pause/cost/abort)    │   (NEW)        │
├─────────────────────────────────────────────────────────────────┤
│                     Zustand Store Layer                         │
│  chatStore (extended)  │  agentStore (NEW)  │ providerStore    │
│   — messages w/ tool   │   — loop state     │  (extended:      │
│     role + tool_calls  │   — pause/cost     │   privacy opt)   │
│     + tool_results     │   — diff log ref   │                  │
├─────────────────────────────────────────────────────────────────┤
│                  Agent Orchestration Layer (NEW)                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ src/agent/loop.ts   ── runAgent(prompt, ctx)              │ │
│  │   while !done && step<20:                                 │ │
│  │     LLM stream → either text-only stop                    │ │
│  │                    or tool_calls →                        │ │
│  │                      circuit-breaker check →              │ │
│  │                      tools.dispatch(name, args) →         │ │
│  │                      record to diff-log →                 │ │
│  │                      push role:'tool' message →           │ │
│  │                      continue                             │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐ │
│  │ tools/       │ │ diff-log.ts  │ │ circuit-breaker.ts      │ │
│  │ registry.ts  │ │ (ring buf +  │ │ (per-tool failure       │ │
│  │ (read+write) │ │  inverse ops)│ │  count, abort >2)       │ │
│  └──────────────┘ └──────────────┘ └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                    Existing v1 Primitives (REUSED)              │
│  ┌──────────────────┐ ┌────────────────┐ ┌──────────────────┐  │
│  │ openai-compat.ts │ │ sse.ts         │ │ adapters/        │  │
│  │ (streamChat)     │ │ (SSE parser    │ │ (Ppt/Excel/Word) │  │
│  │                  │ │  w/ tool_call) │ │ + .read() (NEW)  │  │
│  └──────────────────┘ └────────────────┘ └──────────────────┘  │
│  ┌──────────────────┐ ┌────────────────┐ ┌──────────────────┐  │
│  │ providers/       │ │ providers/     │ │ providers/       │  │
│  │ registry.ts      │ │ queue.ts       │ │ retry.ts         │  │
│  └──────────────────┘ └────────────────┘ └──────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                     Office Host (Office.js)                     │
└─────────────────────────────────────────────────────────────────┘
```

Layering rule (enforced by review): **`src/agent/*` may import from `src/adapters/` and `src/providers/`; the reverse is forbidden.** This keeps adapters and providers reusable for any future non-agent path (e.g. v2.1 "quick action" Ribbon buttons can call `adapter.insert()` directly without going through the loop).

---

## Component Responsibilities (NEW vs MODIFIED)

| Component | File | Status | Responsibility |
|---|---|---|---|
| Agent loop state machine | `src/agent/loop.ts` | **NEW** | `runAgent(prompt, selectionCtx, signal)` — owns the `while` loop, step counter, tool dispatch, message-history maintenance |
| Tool registry | `src/agent/tools/index.ts` | **NEW** | `dispatch(toolName, args, hostCtx)` → typed result; exports OpenAI tool-schema array for LLM |
| Read tools | `src/agent/tools/read/*.ts` | **NEW** | `get_document_outline`, `get_slide`, `get_selection_detail`, `get_range_values`, `get_paragraph_at`, `list_slides` — per-host implementations |
| Write tools | `src/agent/tools/write/*.ts` | **NEW** | Extends existing `insert_to_document` to: `insert_text`, `replace_text`, `new_slide`, `insert_image`, `apply_formula`, `set_range_values` |
| Diff log | `src/agent/diff-log.ts` | **NEW** | Ring buffer (max 50 entries/run) of `{tool, args, inverseOp, timestamp}`; `replayInverseAll()` for undo |
| Circuit breaker | `src/agent/circuit-breaker.ts` | **NEW** | Per-tool-name fail counter; >2 same-tool failures → throw `CircuitOpenError` to abort loop |
| Cost cap | `src/agent/cost-cap.ts` | **NEW** | Tracks accumulated cost across loop iterations; >¥10 → throw `CostCapExceededError` |
| Privacy gate | inside tools/read/*.ts | **NEW logic** | Each read tool checks `privacyStore.fullDocReadEnabled`; if off, return abbreviated `{kind:'metadata-only'}` result |
| **Modified:** chatStore | `src/store/chat.ts` | **MODIFIED** | `Message.role` adds `'tool'`; `Message` adds optional `toolResults[]`; `sendMessage` delegates to `runAgent` instead of inlining one-shot LLM call |
| **Modified:** DocumentAdapter | `src/adapters/DocumentAdapter.ts` | **MODIFIED** | Interface adds `read(query: ReadableQuery): Promise<ReadableResult>`; adds richer `InsertableContent` variants; insert/read return discriminated `OperationResult` instead of `Promise<void>` (for structured error feedback) |
| **Modified:** openai-compat | `src/providers/openai-compat.ts` | **MODIFIED** | `streamChat` accepts a `tools: ToolDef[]` param (currently hardcoded to `[INSERT_TO_DOCUMENT_TOOL]`); accepts `messages` that include `role:'tool'` and `tool_call_id` |
| **Modified:** SSE parser | `src/lib/sse.ts` | UNCHANGED | Already handles multi-tool via `accum.Map<index,...>`. No change needed — already supports multiple parallel tool_calls per LLM turn. |
| Agent control bar | `src/components/AgentControlBar.tsx` | **NEW** | Always-visible during agent run: pause/resume + running cost meter + step counter + abort |
| Diff log panel | `src/components/DiffLogPanel.tsx` | **NEW** | Post-run collapsible list of each tool + result + per-step undo + "undo all this run" |
| Privacy onboarding step | `src/components/Onboarding/Step3Privacy.tsx` | **NEW** | Q10 mandated: explicit full-doc-read consent checkbox before first run |
| Privacy settings | `src/components/Settings/SettingsPanel.tsx` | **MODIFIED** | Add single `fullDocReadEnabled` toggle |

---

## TypeScript Interface Sketches

### Message schema evolution (Q2)

```typescript
// src/store/chat.ts — current Message stays backward-compatible
export interface Message {
  id: string;
  // NEW: 'tool' role added; existing user/assistant/error unchanged
  role: 'user' | 'assistant' | 'tool' | 'error';
  content: string;
  isStreaming?: boolean;
  tokenCount?: number;
  costCny?: number | null;
  errorCode?: string;
  retryPrompt?: string;

  // EXISTING (v1): assistant message accumulates tool_calls
  toolCalls?: ToolCall[];

  // NEW (v2): tool-role message pairs back to assistant tool_call by id
  toolCallId?: string;          // matches some prior assistant.toolCalls[i].id
  toolName?: string;            // for UI display only ("AI 调用了 get_slide")
  toolResult?: ToolResult;      // structured result (also serialized into content for LLM)
  toolStepIndex?: number;       // 1-based, for diff log + UI numbering

  // NEW (v2): agent-loop metadata on assistant messages
  agentRunId?: string;          // groups all messages in one runAgent() invocation
  agentStep?: number;           // step within the run
}

// EXTENDED tool-call shape — was single 'insert_to_document', now generic
export interface ToolCall {
  id: string;
  name: string;                 // was hardcoded 'insert_to_document'; now any tool from registry
  arguments: Record<string, unknown>;  // schema-validated by tool dispatcher, not chatStore
  status: 'pending' | 'accepted' | 'rejected' | 'executed' | 'failed';
  //                                            ^^^^^^^^^^^^^^^^^^^^^^^
  //                                            NEW for agent loop:
  //                                            'executed' = ran successfully, result fed back to LLM
  //                                            'failed'   = ran but errored, error fed back to LLM
}

// NEW
export interface ToolResult {
  ok: boolean;
  // On success: tool-specific payload (e.g. slide content for read, write-confirmation for write)
  data?: unknown;
  // On failure: Q11 mandated structured error
  error?: ToolError;
}

// NEW — Q11 structured error
export interface ToolError {
  code: 'INVALID_ARGS' | 'NOT_FOUND' | 'PERMISSION_DENIED'
      | 'HOST_API_FAILED' | 'PRIVACY_BLOCKED' | 'CIRCUIT_OPEN'
      | 'COST_CAP_EXCEEDED' | 'STEP_LIMIT' | 'UNSUPPORTED';
  message: string;              // Chinese, user-readable
  recoverable: boolean;         // hint to LLM: can it retry with different args?
  hint?: string;                // LLM-readable hint: "尝试先调用 list_slides 获取可用 slideIndex"
}
```

**Backward compat for v1 rendering:** `ChatBubble` already switches on `role`. Adding a new role doesn't break — existing `user | assistant | error` paths render unchanged. The new `'tool'` role renders as a small collapsed card "AI 调用了 `get_slide(index=3)` · 用时 120ms" with click-to-expand result. The existing `assistant.toolCalls[]` rendering (preview card + accept/reject) stays for **confirm mode**, but in v2 agent loops it's replaced by a "view diff log" affordance when run completes.

### DocumentAdapter read API (Q3)

**Decision: per-tool reads, NOT a fat `inspect()` returning full doc model.** Rationale: a full PPT doc model with 50 slides serialized as JSON is ~50KB per query; the LLM sees it every step → cost cap hit by step 3. Per-tool reads let the LLM call `list_slides()` (lightweight summary), then `get_slide(3)` (only the one it needs).

```typescript
// src/adapters/DocumentAdapter.ts — ADD to interface
export interface DocumentAdapter {
  // ... existing getSelection / onSelectionChanged / capabilities / insert ...

  // NEW: typed read queries
  read(query: ReadableQuery): Promise<ReadableResult>;
}

// Discriminated union mirroring tool names 1:1 (so dispatcher is trivial)
export type ReadableQuery =
  // host-agnostic
  | { kind: 'selection_detail' }                          // richer than getSelection
  // PPT
  | { kind: 'list_slides' }
  | { kind: 'get_slide'; slideIndex: number }
  | { kind: 'list_shapes_on_slide'; slideIndex: number }
  | { kind: 'get_shape'; slideIndex: number; shapeId: string }
  // Excel
  | { kind: 'list_worksheets' }
  | { kind: 'get_range_values'; address: string }
  | { kind: 'get_used_range_summary'; sheetName?: string }  // rowCount/colCount/firstRowSample
  // Word
  | { kind: 'get_paragraph_at'; index: number }
  | { kind: 'get_paragraph_count' }
  | { kind: 'get_document_outline' }                       // headings hierarchy
  ;

export type ReadableResult =
  | { ok: true; data: unknown }
  | { ok: false; error: ToolError };
```

**Privacy gate lives inside each read implementation.** Example for `get_paragraph_at`:

```typescript
// src/adapters/WordAdapter.ts (extension)
async read(query: ReadableQuery): Promise<ReadableResult> {
  // Privacy: any read tool that returns user content (not metadata) must gate
  const privacy = useProviderStore.getState();
  const contentReadAllowed = privacy.fullDocReadEnabled;

  switch (query.kind) {
    case 'get_paragraph_count':
      // metadata only — always allowed
      return Word.run(async ctx => { /* count */ });

    case 'get_paragraph_at':
      if (!contentReadAllowed) {
        return { ok: false, error: {
          code: 'PRIVACY_BLOCKED',
          message: '用户已关闭"文档全文发送"，无法读取段落正文',
          recoverable: false,
          hint: '只能使用 get_paragraph_count 等元数据级工具',
        }};
      }
      // proceed
      return Word.run(async ctx => { /* return text */ });
  }
}
```

The Q10 opt-out is **a single store toggle (`fullDocReadEnabled`)**. When off: metadata-level reads still work (`list_slides`, `get_paragraph_count`, `list_worksheets`); content-level reads return `PRIVACY_BLOCKED`. The LLM sees this error and either gives up or asks the user to enable the toggle. This is more honest than silently truncating reads. See §Q8.

### Tool registry (Q4)

**Decision: single `src/agent/tools/index.ts` registry, but tool implementations live per-host under `src/agent/tools/read/{ppt,excel,word}.ts` and `src/agent/tools/write/{ppt,excel,word}.ts`.** Centralized registration, decentralized implementation.

```typescript
// src/agent/tools/index.ts
import type { DocumentAdapter } from '../../adapters/DocumentAdapter';
import type { ToolResult, ToolError } from '../../store/chat';

export interface ToolDef {
  name: string;
  description: string;
  parameters: object;                  // JSON schema for LLM
  // Validation + execution; throws nothing — wraps internally
  execute(args: unknown, ctx: ToolExecContext): Promise<ToolResult>;
}

export interface ToolExecContext {
  adapter: DocumentAdapter;
  diffLog: DiffLog;                    // tool can record mutation here
  runId: string;
  stepIndex: number;
  signal: AbortSignal;                 // pause/abort
}

// Single source of truth: assemble by host
export function buildToolsForHost(host: 'ppt' | 'excel' | 'word'): ToolDef[] {
  return [
    ...COMMON_TOOLS,                   // selection_detail, etc.
    ...(host === 'ppt'   ? PPT_TOOLS   : []),
    ...(host === 'excel' ? EXCEL_TOOLS : []),
    ...(host === 'word'  ? WORD_TOOLS  : []),
  ];
}

// Dispatch (called by agent loop after parsing tool_call_end from SSE)
export async function dispatchTool(
  call: { name: string; arguments: unknown },
  ctx: ToolExecContext,
  tools: ToolDef[],
): Promise<ToolResult> {
  const def = tools.find(t => t.name === call.name);
  if (!def) {
    return { ok: false, error: {
      code: 'NOT_FOUND',
      message: `工具 ${call.name} 不存在`,
      recoverable: false,
      hint: '请只调用 tools 列表里声明的工具名',
    }};
  }
  try {
    return await def.execute(call.arguments, ctx);
  } catch (e) {
    // Last-resort wrap; tools should normally return { ok: false } themselves
    return { ok: false, error: {
      code: 'HOST_API_FAILED',
      message: e instanceof Error ? e.message : 'tool 执行失败',
      recoverable: true,
      hint: 'Office.js 调用可能瞬时失败，可重试一次',
    }};
  }
}
```

**Why centralized registry + decentralized impl:** The OpenAI `tools` array sent to the LLM must be assembled in one place (otherwise hosts would inadvertently expose tools they don't implement). But each tool's host-specific Office.js code wants to live next to the adapter that supports it. The compromise: `index.ts` only does plumbing; per-host files own implementation.

### Agent loop (Q1)

```typescript
// src/agent/loop.ts
import { useChatStore } from '../store/chat';
import { useProviderStore } from '../store/providers';
import { useAgentStore } from './agentStore';
import { OpenAICompatibleLLM } from '../providers/openai-compat';
import { ProviderRegistry } from '../providers/registry';
import { buildToolsForHost, dispatchTool } from './tools';
import { DiffLog } from './diff-log';
import { CircuitBreaker } from './circuit-breaker';
import { CostCap } from './cost-cap';
import type { ChatMessage } from '../providers/types';
import type { Message } from '../store/chat';

const MAX_STEPS = 20;                  // Q9 hard cap

export async function runAgent(
  userPrompt: string,
  selectionCtx: SelectionContext | undefined,
  adapter: DocumentAdapter,
  signal: AbortSignal,
): Promise<void> {
  const runId = crypto.randomUUID();
  const diffLog = new DiffLog(runId);
  const breaker = new CircuitBreaker(2);     // Q11: >2 same-tool failures → abort
  const costCap = new CostCap(10.0);         // ¥10 per prompt run

  const tools = buildToolsForHost(adapter.capabilities().host);
  const toolDefs = tools.map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  useAgentStore.getState().beginRun(runId, diffLog);

  // Build initial message list with system prompt + user
  const messages: ChatMessage[] = buildInitialMessages(userPrompt, selectionCtx, adapter);
  // Push user message into chatStore (visible immediately)
  useChatStore.getState().pushMessage({ role: 'user', content: userPrompt, agentRunId: runId });

  for (let step = 1; step <= MAX_STEPS; step++) {
    if (signal.aborted) break;
    useAgentStore.getState().setCurrentStep(step);

    // Pause check (Q9: user can pause mid-loop)
    await useAgentStore.getState().awaitResume(signal);
    if (signal.aborted) break;

    // Create an assistant message that will be streamed into
    const assistantMsgId = crypto.randomUUID();
    useChatStore.getState().pushMessage({
      id: assistantMsgId, role: 'assistant', content: '', isStreaming: true,
      agentRunId: runId, agentStep: step,
    });

    // Stream LLM with current message history + tools
    const llmConfig = ProviderRegistry.resolve('chat', () => /* default provider */) as LLMConfig;
    const llm = new OpenAICompatibleLLM();

    const toolCallsThisTurn: ToolCall[] = [];
    let assistantText = '';
    let usage: SSEUsage | undefined;

    for await (const event of llm.streamChat(messages, llmConfig, signal, toolDefs)) {
      if (event.type === 'delta') {
        assistantText += event.content;
        useChatStore.getState().appendDeltaToMessage(assistantMsgId, event.content);
      } else if (event.type === 'tool_call_end') {
        const parsedArgs = safeParse(event.arguments);
        if (!parsedArgs) continue;
        toolCallsThisTurn.push({
          id: event.id, name: event.name, arguments: parsedArgs, status: 'pending',
        });
      } else if (event.type === 'usage') {
        usage = event;
      }
    }

    useChatStore.getState().finalizeMessage(assistantMsgId, { isStreaming: false, usage, toolCalls: toolCallsThisTurn });

    // Cost-cap check (Q9): includes prior steps' cost
    if (usage) {
      const stepCost = calcCostCny(usage, llmConfig.providerId, llmConfig.model);
      costCap.add(stepCost);
      useAgentStore.getState().setRunningCost(costCap.total());
      if (costCap.exceeded()) {
        useChatStore.getState().pushMessage({
          role: 'error', content: '本次运行成本已超出 ¥10 上限，已自动停止',
          errorCode: 'COST_CAP_EXCEEDED', agentRunId: runId,
        });
        break;
      }
    }

    // Append assistant message into message history (with tool_calls for OpenAI wire format)
    messages.push(toOpenAIAssistantWireMessage(assistantText, toolCallsThisTurn));

    // No tool calls? Agent finished talking — exit loop
    if (toolCallsThisTurn.length === 0) break;

    // Execute each tool call sequentially (parallel later — simpler debug for v1)
    let abortedDueToCircuit = false;
    for (const tc of toolCallsThisTurn) {
      if (signal.aborted) break;
      if (breaker.isOpen(tc.name)) {
        // Q11: same tool failed >2 → abort, don't let LLM keep trying
        const error: ToolError = {
          code: 'CIRCUIT_OPEN',
          message: `工具 ${tc.name} 连续失败 2 次以上，已强制停止`,
          recoverable: false,
        };
        useChatStore.getState().pushMessage({
          role: 'tool', toolCallId: tc.id, toolName: tc.name,
          toolResult: { ok: false, error }, content: JSON.stringify({ ok: false, error }),
          agentRunId: runId, agentStep: step,
        });
        messages.push(toOpenAIToolWireMessage(tc.id, { ok: false, error }));
        abortedDueToCircuit = true;
        break;
      }

      const result = await dispatchTool(tc, {
        adapter, diffLog, runId, stepIndex: step, signal,
      }, tools);

      // Record outcome for circuit breaker (only count actionable failures, not user pause)
      if (result.ok) breaker.recordSuccess(tc.name);
      else if (result.error?.code !== 'CIRCUIT_OPEN') breaker.recordFailure(tc.name);

      // Push role:'tool' message into chatStore (visible to user) AND into LLM history
      useChatStore.getState().pushMessage({
        role: 'tool', toolCallId: tc.id, toolName: tc.name, toolResult: result,
        content: JSON.stringify(result), agentRunId: runId, agentStep: step,
      });
      messages.push(toOpenAIToolWireMessage(tc.id, result));
    }
    if (abortedDueToCircuit) break;
  }

  useAgentStore.getState().endRun(runId);
}
```

**Why a new module, not chatStore extension:** `chatStore.sendMessage` is ~150 lines and already mixes streaming, error mapping, and abort. Adding a loop inside doubles complexity and breaks all current tests. The clean cut: `chatStore` owns the message *array* (pushMessage / appendDelta / finalizeMessage become simple Zustand actions); `agent/loop.ts` owns the *orchestration*. This also makes the agent loop testable without React — just call `runAgent(prompt, ctx, mockAdapter, signal)` in a vitest. Existing `chatStore.sendMessage` becomes a one-liner that delegates to `runAgent` (or is removed entirely once UI calls `runAgent` directly via a thin store action).

---

## Per-question answers

### Q1: Agent loop placement — `src/agent/loop.ts`

Trade-offs:

| Location | Pro | Con | Verdict |
|---|---|---|---|
| Inside `chatStore.ts` | No new module; UI already wired to chatStore | Doubles complexity of an already-large file; mixes orchestration with state; harder to test (Zustand requires React in some test setups) | **No** |
| New `src/agent/loop.ts` | Single responsibility; testable standalone; future Ribbon-button paths can call it without React | New module + new tests | **YES** |
| Inside `src/providers/` as smart provider wrapper | Hides loop from chatStore | Wrong layer — agent loop calls **tools** (adapter), not just LLM; provider layer must not know about adapters (existing architectural invariant from v1 ARCHITECTURE.md) | **No** |

### Q2: Message schema — add `'tool'` role + `toolCallId`/`toolResult`/`toolName`

Already detailed in §Interface Sketches. Migration consideration: **none for stored data** because v1 doesn't persist messages (PRD says in-memory only, confirmed in chatStore.ts L9 "messages 仅存于内存"). The schema change is purely a TypeScript type widening; existing v1 messages remain valid as a subset of the new shape. **One subtle thing:** v1 `ToolCall.name` is the literal `'insert_to_document'`; v2 widens to `string`. Anywhere that switch-cases `ToolCall.name === 'insert_to_document'` (currently `ChatBubble.tsx` doesn't — it just renders args generically; `chatStore.acceptToolCall` does — replace with name-dispatch).

### Q3: Read API — `adapter.read(query: ReadableQuery)` per-query, NOT fat `inspect()`

Reasoning given in §Interface Sketches. Bonus: this maps 1:1 to LLM tool names so the dispatcher is `tools[name].execute(args, ctx) → adapter.read({kind: name, ...args})` in most cases. Only ones that write or do composite ops (e.g. `new_slide_from_outline` which generates pptx + calls `adapter.insert({type:'slides', base64})`) need bespoke logic.

### Q4: Tool registry — single `src/agent/tools/index.ts`, host-sharded implementations

Detailed in §Tool registry above. Concrete layout:

```
src/agent/tools/
├── index.ts                   # buildToolsForHost, dispatchTool, registry types
├── common.ts                  # selection_detail (works on all hosts)
├── read/
│   ├── ppt.ts                 # list_slides, get_slide, get_shape, ...
│   ├── excel.ts               # get_range_values, list_worksheets, ...
│   └── word.ts                # get_paragraph_at, get_paragraph_count, get_document_outline
└── write/
    ├── ppt.ts                 # new_slide, replace_slide_text, insert_image_on_slide
    ├── excel.ts               # apply_formula, set_range_values, set_cell
    └── word.ts                # insert_text_at_cursor, replace_selection, append_paragraph
```

### Q5: Diff log + undo — in-memory ring buffer, inverse ops, fall back to Office.js native undo

**Storage: in-memory only** (matches v1 chat persistence model — Q8 says no release notes for v1, no need to introduce IndexedDB now). One DiffLog per agent run; max 50 entries (more than that means agent is misbehaving — circuit-breaker should have caught it). On tab close: lost. Acceptable — undo's purpose is "I just watched the agent do something dumb, undo this run" not "undo from 3 days ago".

**Replay strategy: inverse ops PREFERRED, Office.js native undo as fallback.** Reasoning:

1. **Office.js native undo (`document.undo()`)** does exist in Word and Excel but the behavior is "undo the last user-visible thing in the Office undo stack." This is **unreliable for our case** because:
   - PPT has no documented `presentation.undo()` API.
   - The Office undo stack may interleave with user manual actions between agent steps if they didn't pause first.
   - Calling `undo()` 7 times after 7 tool calls may undo more than 7 things, or fewer if Office coalesced operations.
2. **Inverse ops** record the *delta* of each mutation:
   - `insert_text_at_cursor(text)` → inverse: `delete_range(insertedRange)`
   - `replace_selection(newText)` → inverse: `replace_range(insertedRange, oldText)` — requires capturing oldText BEFORE write
   - `new_slide(index, content)` → inverse: `delete_slide(insertedSlideIndex)` — requires capturing the index it actually landed at
   - `set_range_values(address, values)` → inverse: `set_range_values(address, oldValues)` — capture before-image

Implementation: every write tool, before calling `adapter.insert`, reads the pre-state via `adapter.read(...)` and stores `(toolName, args, inverseDescriptor)` in diff log. Undo replays inverse descriptors in **reverse order**. The descriptors are themselves expressed as `InsertableContent` so adapter.insert handles them.

**Spike risk:** PPT new_slide inverse op needs `slide.delete()` API confirmed working in PowerPoint.run. Flag for Phase 3 spike (see Build Order).

### Q6: Pause/resume state — `src/agent/agentStore.ts` (new), NOT chatStore

Pause is an orthogonal concern to message storage. Keeping it in chatStore would couple "I have a message" with "I am paused" — wrong layering.

```typescript
// src/agent/agentStore.ts
interface AgentState {
  currentRunId: string | null;
  isPaused: boolean;
  currentStep: number;
  runningCostCny: number;
  abortController: AbortController | null;
  currentDiffLog: DiffLog | null;

  beginRun(runId: string, diffLog: DiffLog): void;
  endRun(runId: string): void;
  pause(): void;
  resume(): void;
  abort(): void;
  setCurrentStep(n: number): void;
  setRunningCost(c: number): void;
  awaitResume(signal: AbortSignal): Promise<void>;
}
```

`awaitResume` is the pause primitive — `runAgent` calls it at each loop iteration. If `isPaused=false` it resolves immediately; otherwise returns a Promise that resolves on `resume()` or rejects on `abort()` (via signal).

**What's pausable (granularity):**
- Between LLM stream and tool dispatch: ALWAYS (cheap — `await awaitResume()` between steps)
- Mid-LLM-stream: YES via existing `AbortController` (abort + restart next step). But "pause" semantically wants to *keep* the partial response, not throw it away. So: pause **does not abort** the current SSE stream; it lets it complete to natural stop, then pauses BEFORE next step's LLM call.
- Mid-tool-exec: NO. A tool call to `adapter.insert` is atomic in `Office.run`. Pause requests during tool exec just wait until the tool returns.

URL state: **no.** Office.js nulls pushState (noted in v1 ARCHITECTURE.md L981), and pause doesn't survive tab close anyway.

### Q7: Cost meter — extend `CostBadge` for per-step + new `AgentControlBar` for running total

Two consumers:
- **Per-step cost** (existing CostBadge attached to each assistant message): unchanged. Already shows per-message `tokenCount + costCny`. v2 keeps this on assistant messages (not on tool messages — tools don't cost LLM tokens by themselves).
- **Running total during agent run** (new): lives in `AgentControlBar` reading from `agentStore.runningCostCny`. Updates every LLM step. Shows "本次运行: ¥3.47 / ¥10.00" with progress bar.

¥10 cap check: lives in **`src/agent/cost-cap.ts`**, called from `runAgent` after each `usage` event (see code in §Agent loop above). Throws `CostCapExceededError` which agent loop catches → pushes error message → breaks loop. UI's only job is to display the running value; enforcement is in the loop.

### Q8: Privacy opt-out wiring — single `fullDocReadEnabled` toggle gates content-level read tools only

Decision matrix for what the toggle controls:

| Behavior | When toggle ON (default per Q10) | When toggle OFF |
|---|---|---|
| `getSelection()` (existing) | Returns full selection metadata (slideIndex, charCount, address) | UNCHANGED — metadata only, no content |
| Selection content attached to user prompt (existing `attachEnabled`) | Existing behavior — only attached when `attachEnabled` true | UNCHANGED — orthogonal toggle |
| `adapter.read({kind:'get_paragraph_count'})` etc. (metadata-level reads) | Allowed | Allowed |
| `adapter.read({kind:'get_paragraph_at'})` etc. (content reads) | Allowed | Returns `PRIVACY_BLOCKED` error → LLM sees it, falls back to metadata or asks user |
| Full-doc snapshot sent in initial system prompt | **Never** (would always send too much) — agent reads on demand via tools | N/A |

**So:** the toggle stops the **content read tools** from returning text, but does NOT stop the existing `attachEnabled` selection-attach behavior (different feature, different consent). Documenting both toggles separately in Settings + Onboarding is mandatory per Q10's "重写 Privacy doc" requirement.

The toggle lives in `useProviderStore` (or a new sibling `useSettingsStore`; v1 already mixes `attachEnabled` and `autoInsertMode` into providerStore, so keeping in providerStore is consistent — call it `fullDocReadEnabled`).

### Q9: Build order — Phase 3 → Phase 7

Existing Phase 0/1/2/2.1 deliver: spike, foundation, Provider abstraction, three-host adapters with insert(text), SSE w/ tool_calls, cost badge, selection pill, Onboarding (without privacy step).

What v2 needs, in dependency order:

```
Phase 3: Agent loop foundation (DEMO: 2-step agent in Word, write-only)
  Deps on: Phase 2.1 (existing chatStore, openai-compat, adapter.insert)
  Deliverables:
    - src/agent/loop.ts (runAgent skeleton w/ MAX_STEPS=20)
    - src/agent/tools/index.ts + write/word.ts (one new write tool: append_paragraph)
    - src/agent/circuit-breaker.ts
    - src/agent/agentStore.ts (pause/abort/cost only — no diff log yet)
    - chatStore: add 'tool' role, refactor pushMessage/appendDelta/finalizeMessage actions
    - openai-compat: accept dynamic `tools` param (instead of hardcoded INSERT_TO_DOCUMENT_TOOL)
    - Demo flow: in Word, user says "写3段关于X的内容" → LLM calls append_paragraph 3x sequentially
  Spike sub-items:
    - SP-1: Verify DeepSeek-v4 handles role:'tool' + tool_call_id in subsequent turns (most OpenAI-compat providers do; quick test)
    - SP-2: Confirm Office.js doesn't choke on rapid sequential Word.run() calls (no API rate limit)
  Out of scope this phase: read tools, diff log, undo, multi-host

Phase 4: Read tools + privacy (DEMO: agent decides which slide to edit by inspecting)
  Deps on: Phase 3
  Deliverables:
    - adapter.read(query) implementation on all 3 hosts (read schema in §Q3)
    - src/agent/tools/read/{ppt,excel,word}.ts (full set of read tools)
    - Privacy toggle in Settings + Onboarding Step 3
    - PRIVACY_BLOCKED ToolError path
    - Demo flow: PPT, "在最长的那张 slide 后插入一张新 slide 总结要点" — agent calls list_slides, get_slide(longest), then write tool
  Spike sub-items:
    - SP-3: How verbose is LLM with read tools? Cost cap survives "exploratory" agents?
    - SP-4: Confirm read tools don't double-count selection (selection_detail vs attached selection)

Phase 5: Diff log + undo all (DEMO: post-run "撤销本次所有" works in all 3 hosts)
  Deps on: Phase 4 (and a stable write-tool set)
  Deliverables:
    - src/agent/diff-log.ts (ring buffer + InverseDescriptor)
    - Inverse op support in each write tool (capture before-image)
    - DiffLogPanel component (collapsed list + per-step undo + undo all)
    - Adapter.delete-style operations for PPT slide undo (NEW adapter method)
  Spike sub-items:
    - SP-5: PPT slide.delete() availability + ordering vs spike #3618 (Web reverse-order bug)
    - SP-6: Excel range "before image" capture cost on large ranges
  Risk: HIGH — this is where PPT undo will hit Office.js gaps

Phase 6: Multi-tool write set + killer scenarios as agent flows
  Deps on: Phase 5 (need undo before unleashing destructive multi-step writes)
  Deliverables:
    - PPT: new_slide, replace_slide_text, insert_image (image tool wraps aihubmix image-gen)
    - Excel: apply_formula, set_range_values, set_cell
    - Word: replace_selection, insert_text_at_cursor
    - Rewrite v1 杀手场景 (主题→大纲 / 配图 / 公式生成 / 润色 / 长文) as agent prompts
    - Killer-scenario "shortcut" chips in empty state (replaces v1 Ribbon design — Ribbon now opens task pane and seeds a prompt)
  Spike sub-items:
    - SP-7: Multi-tool parallel dispatch (LLM may return 2 tool_calls in one turn). v3 simplification: dispatch sequentially. Confirm DeepSeek doesn't insist on parallelism.

Phase 7: UAT + Phase 2.2 embedded follow-ups + sideload release prep
  Deps on: Phase 6
  Deliverables:
    - FU-01 (首次取选区 bug): retest under agent flow
    - FU-02 (model 下拉 UX): redesign in v2 Settings (more model variants needed for agent: pro vs flash routing)
    - FU-03 (copy chat history): now includes tool messages — needs schema-aware copy
    - Privacy doc rewrite (Q10 mandate)
    - README rewrite — first-ever published doc since Q8 said v1 had none
    - Sideload manifest verification on Office for Web Edge/Chrome
    - Cost cap default re-evaluation: ¥10 reasonable in practice? Bump or surface in Settings?
```

Each phase ships a runnable demo because each adds one capability dimension. Notably **Phase 3 ships a working agent in one host** (Word) before adding read tools — this validates the loop + circuit breaker + pause UX without the complexity of read-and-decide flows. The user can dogfood Phase 3 end of week 1.

---

## Data Flow

### Flow 1: Agent loop happy path (multi-step)

```
[User types "在 slide 3 后加一张总结" → InputBar.handleSend]
         │
         ▼
chatStore.sendMessage(prompt, selectionCtx)
         │  (becomes a thin delegate)
         ▼
agent/loop.ts: runAgent(prompt, ctx, adapter, signal)
         │
         ├── beginRun(runId) → agentStore
         ├── push user message to chatStore (immediate UI)
         │
         ▼
   ┌─ Step 1 ───────────────────────────────────────────┐
   │  build tools[] for host=ppt                        │
   │  openai-compat.streamChat(messages, tools)         │
   │    → SSE: assistant text + tool_call_end           │
   │    → LLM emits tool_calls: [list_slides]           │
   │  push assistant msg (toolCalls=[list_slides])      │
   │  dispatchTool('list_slides', {}) → adapter.read    │
   │  push tool msg (role:'tool', result={slides:[…]})  │
   │  messages.push(assistantWire + toolWire)           │
   │  costCap.add(stepUsage)                            │
   └────────────────────────────────────────────────────┘
         │
         ▼ (awaitResume check)
   ┌─ Step 2 ───────────────────────────────────────────┐
   │  streamChat with new tool result in history        │
   │    → LLM emits tool_calls: [new_slide(after=3,…)]  │
   │  dispatchTool('new_slide', {…})                    │
   │    → adapter.insert({type:'slides', base64})       │
   │    → diffLog.record({op, inverse:delete_slide(4)}) │
   │  push tool msg with success                        │
   └────────────────────────────────────────────────────┘
         │
         ▼ (awaitResume check)
   ┌─ Step 3 ───────────────────────────────────────────┐
   │  streamChat                                        │
   │    → LLM emits text "已添加总结 slide" + no tool   │
   │  break loop                                        │
   └────────────────────────────────────────────────────┘
         │
         ▼
endRun() → DiffLogPanel renders "本次 3 步操作 [undo all]"
```

### Flow 2: Pause mid-run

```
[Agent in Step 5, currently dispatching new_slide]
         │
[User clicks Pause button in AgentControlBar]
         │
         ▼
agentStore.pause() → isPaused = true
         │
[adapter.insert (new_slide) completes — atomic in PowerPoint.run]
         │
         ▼
runAgent loop reaches top of next iteration
         │
agentStore.awaitResume(signal) ──┐
         │                       │
         │  (Promise hangs)      │
         │                       │
[User clicks Resume]             │
         │                       │
agentStore.resume()──────────────┘
         │
runAgent continues to Step 6 LLM stream
```

### Flow 3: Tool failure → LLM recovery

```
[Step 4: dispatchTool('new_slide', {after_index: 99})]
         │
adapter.insert({type:'slides', …}) throws HostApiError
         │
tool wrapper catches → returns { ok: false, error: {
  code:'HOST_API_FAILED',
  message:'幻灯片索引 99 超出范围（共 7 张）',
  recoverable: true,
  hint:'请先调用 list_slides 确认索引',
}}
         │
breaker.recordFailure('new_slide')  → count=1 (under limit)
         │
push tool msg (role:'tool', toolResult={ok:false,error:…})
messages.push(toolWire with serialized error JSON)
         │
         ▼
[Step 5: LLM sees the error in history]
LLM emits tool_calls: [list_slides]  → recovers per Q11
[Step 6: LLM emits new_slide with corrected index → succeeds]
```

### Flow 4: Circuit breaker abort

```
[Step 4: dispatchTool('apply_formula', {formula:'=BADSYNTAX(...'})]
  → failure #1 for apply_formula
[Step 5: LLM retries with slight variation, still bad]
  → failure #2 for apply_formula
[Step 6: LLM tries apply_formula again]
  breaker.isOpen('apply_formula') → true
  → push tool msg with CIRCUIT_OPEN error (NOT calling adapter)
  → break loop  (don't even feed back to LLM — Q11 says Aster forces abort)
```

### Flow 5: Cost cap

```
[Steps 1-7 accumulate cost: ¥1.20 + ¥1.80 + ¥1.50 + ¥1.30 + ¥1.40 + ¥1.50 + ¥1.40 = ¥10.10]
After Step 7 usage event:
  costCap.add(¥1.40) → total=¥10.10
  costCap.exceeded() → true
  push error message "本次成本超 ¥10 已停止"
  break loop
  agentStore.endRun() — DiffLogPanel shows partial run
```

### Flow 6: Undo all

```
[User clicks "撤销本次所有操作" in DiffLogPanel]
         │
         ▼
diffLog.replayInverseAll() — iterates entries in REVERSE order
  for entry of reversed(entries):
    await adapter.insert(entry.inverseDescriptor)
         │
         ▼
each inverse op is itself an InsertableContent variant
  (new_slide → SlidesContent with type='delete_slide'… new variant needed)
  (replace_text → TextContent with mode='replace_range', value=oldText)
         │
         ▼
DiffLogPanel marks all entries as "undone", disables button
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Putting the agent loop inside chatStore.sendMessage

**What people do:** "It's already there, just add a while loop."
**Why wrong:** chatStore becomes a 400-line file with three concerns (UI state, streaming, orchestration). Cannot test loop without Zustand+React. Mixed abstraction levels.
**Instead:** New `src/agent/loop.ts` module. chatStore becomes a passive message-array store.

### Anti-Pattern 2: Full-doc snapshot in system prompt

**What people do:** Serialize entire PPT/Excel/Word into the system prompt at agent start.
**Why wrong:** Burns token budget on context the LLM doesn't need. ¥10 cap hit in 2 steps for a 30-slide deck.
**Instead:** Empty system prompt; LLM must use read tools to discover the doc. Slower first step, much cheaper overall.

### Anti-Pattern 3: Office.js native undo for diff log

**What people do:** Call `document.undo()` N times after run.
**Why wrong:** Office's undo stack is opaque, interleaved with user actions, PPT lacks the API. Will undo wrong things in 10% of runs.
**Instead:** Inverse ops recorded in DiffLog as InsertableContent. Replay in reverse.

### Anti-Pattern 4: Auto-routing tool failures to a different Provider

**What people do:** "Provider X failed → silently retry with Provider Y."
**Why wrong:** Same anti-pattern as v1 (existing ARCHITECTURE.md anti-pattern #5). LLM's reasoning continuity breaks; user doesn't know whose Key got charged.
**Instead:** Tool failures stay within the same Provider's loop. Q11: structured error pushed back to LLM for self-recovery; circuit breaker for permanent stop.

### Anti-Pattern 5: Tool dispatcher importing from adapter and provider simultaneously

**What people do:** `src/agent/tools/write/excel.ts` imports both `ExcelAdapter` and `aihubmix-image.ts` directly.
**Why wrong:** Breaks the architectural invariant (adapter ↛ provider, provider ↛ adapter). Tools at the agent layer DO orchestrate both, but should go through ProviderRegistry, not direct provider import.
**Instead:** Tool receives `adapter` and `providerRegistry` via `ToolExecContext`. The image-gen tool calls `ProviderRegistry.resolve('image-gen')` then the resulting client, never directly imports `aihubmix-image.ts`.

### Anti-Pattern 6: Parallel tool_call execution in v2.0

**What people do:** LLM returns 3 tool_calls in one turn → dispatch all in parallel.
**Why wrong:** Office.js host context (`PowerPoint.run`/`Excel.run`/`Word.run`) is not safely concurrent across calls. Two parallel `Excel.run` blocks on the same workbook can race. Also impossible to record diff log in deterministic order.
**Instead:** Sequential dispatch in v2.0. If LLM returns N tool_calls in one turn, execute them in order. Tools that don't write (reads) could be parallelized in v2.1+ but Phase 6 doesn't need it.

### Anti-Pattern 7: Storing diff log to localStorage

**What people do:** "What if user closes tab mid-run? Persist diff log."
**Why wrong:** Inverse ops reference live Office object state (slide indexes, range addresses) that may be invalid after tab reopen. Cross-session undo would silently corrupt docs.
**Instead:** In-memory only. Tab close = run lost. The user-visible "undo all" only works within the same session, which is the only safe scope anyway.

---

## Integration Points

### External Services (unchanged from v1)

| Service | Integration | Notes for v2 |
|---|---|---|
| DeepSeek `/chat/completions` | OpenAI-compatible SSE | v2 adds dynamic `tools` array; verify provider handles `role:'tool'` + multi-turn (HIGH likelihood per spec but spike-confirm SP-1) |
| aihubmix image-gen | REST POST | Triggered from inside `insert_image` write tool (not directly from chatStore) |
| aihubmix vision | OpenAI vision messages | v2 may not need until v2.1 — read tools handle most "see the doc" needs without vision |

### Internal Boundaries (NEW)

| Boundary | Communication | Notes |
|---|---|---|
| agent/loop ↔ chatStore | Direct store mutations (`pushMessage`, `appendDelta`, etc.) | Loop is the writer; UI is the reader |
| agent/loop ↔ agentStore | Direct store mutations | Loop drives step counter, cost, pause state |
| agent/loop ↔ tools/registry | Direct function call (`dispatchTool`) | Loop passes adapter via ToolExecContext |
| tools/* ↔ adapters | Through `ToolExecContext.adapter` (DI) | Tools never import a specific adapter; only `DocumentAdapter` interface |
| tools/* ↔ providers | Through `ProviderRegistry` | For image-gen and vision tools that need an LLM/image call |
| AgentControlBar ↔ agentStore | Zustand selector hooks | Reads `currentStep`, `isPaused`, `runningCostCny` |
| DiffLogPanel ↔ agentStore | Zustand selector for `currentDiffLog` ref | DiffLog itself is a class, not Zustand state — the store just holds a reference |

---

## Scaling Considerations

| Scale | Adjustments |
|---|---|
| Solo dev usage (now) | No changes. Single user per browser. |
| 100 OSS users | No changes. Same as v1 — no backend, BYO Key |
| Edge case: agent run with 20 steps × 2 KB messages | Total ~40 KB in messages array. Fine for browser memory. |
| Edge case: 50-slide PPT inspected via read tools | Each `get_slide` ~2-5 KB; LLM context likely reads ~10 slides max per run. Within 1M token DeepSeek-V4 context. |

### First bottleneck: LLM cost

¥10 cap is a soft mitigation. Real bottleneck: a chatty agent with verbose reads can hit ¥3-5 in normal use. Mitigate by:
1. Defaulting to `deepseek-v4-flash` for tool-dispatch turns (Pro only when reasoning needed).
2. Compacting tool results — read tools should return JSON without prose. E.g. `list_slides` returns `[{i:1,title:"X"},...]` not `"There are 7 slides. Slide 1 is titled X..."`.

### Second bottleneck: diff log inverse ops for slides

PPT `slide.delete()` — Phase 5 spike SP-5 confirms availability or escalates to "PPT undo all not supported in v2.0, only Word/Excel."

---

## Sources

This research synthesizes the existing Aster codebase (read directly) with documented Office.js Add-in patterns from v1.0 research. No new external sources were needed since the question is integration-of-existing rather than ecosystem-discovery.

Key existing files referenced:

- `src/store/chat.ts` — current chat store + ToolCall shape
- `src/store/providers.ts` — provider store + attachEnabled/autoInsertMode pattern (reference for new `fullDocReadEnabled`)
- `src/providers/openai-compat.ts` — streamChat needing tools-param widening
- `src/providers/types.ts` — ChatMessage needs `role:'tool'` widening + `tool_call_id` field
- `src/providers/queue.ts` — singleFlight + visibilityAbort reused unchanged by agent loop
- `src/lib/sse.ts` — already emits `tool_call_end` per-index (multi-tool capable)
- `src/adapters/DocumentAdapter.ts` — interface to extend with `read()`
- `src/adapters/{PptAdapter,ExcelAdapter,WordAdapter}.ts` — host-specific implementations referenced for read-API design
- `src/components/ChatBubble.tsx` — message rendering needing 'tool' role branch
- `src/components/Settings/SettingsPanel.tsx` — where `fullDocReadEnabled` toggle lands
- `src/errors/index.ts` — error class pattern to follow for new `CostCapExceededError`, `CircuitOpenError`, `PrivacyBlockedError`
- `.planning/PROJECT.md` — Q7-Q11 locked decisions
- `.planning/research/v1.0/ARCHITECTURE.md` — v1 layering rules (adapter↛provider, etc.) preserved in v2

---

## Open Questions for Spec Stage (not blocking roadmap)

- **OQ1:** Should v2 ditch the existing `confirm`/`auto` insert mode toggle, since agent loops execute writes inline without intermediate user accept/reject? Or keep `confirm` as "agent pauses before each write tool"?
- **OQ2:** Cost cap ¥10 hardcoded vs settable? Recommended hardcode for v2.0 (one less Settings row) and revisit if users complain.
- **OQ3:** Should `tool` role messages be filterable/hidden in chat UI by default (collapsed cards), or always shown inline? Recommended: always shown, collapsible per-message.
- **OQ4:** Phase 5 (diff log) blocked by PPT slide.delete() API availability — Phase 3 spike SP-5 should check this earlier than Phase 5 to allow architectural pivot if missing.
