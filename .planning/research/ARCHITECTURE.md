# Architecture Research — Aster v2.1

**Domain:** Office.js Add-in (PPT / Excel / Word) — Agent deepening & polish  
**Researched:** 2026-05-30  
**Overall confidence:** HIGH (based on actual codebase inspection + Office.js official docs)

---

## Summary: How A–F Fit the Existing Architecture

A–F are all "layered on top of the existing skeleton"—none require an architecture pivot or new runtime dependencies.

- **A (system prompt deepening + preference injection):** Changes only in `src/agent/system-prompt.ts`, signature unchanged, loop.ts is fully transparent. Preference injection needs a new preference Zustand slice (or extend providerStore), read inside `buildSystemPrompt`. The `not.toContain` detechnicalization tests only need their expected values updated—no structural test changes.
- **B (new write tools):** Each write tool is an independent `ToolDef` object (name / description / parameters / humanLabel / execute / kind='write'), appended to the appropriate host array in `buildToolsForHost()`. The adapter layer needs corresponding new methods, and OperationLog inverse paths need new `case` entries in `executeReverse`. Tool-count explosion (token cost) is the largest cross-cutting risk for this milestone.
- **C (batch write):** The cleanest placement is a new `batch_write` tool accepting `{ ops: Array<{tool, args}> }`, serially/parallel-dispatching existing tool execute functions inside `execute`, with OperationLog recording one batch entry containing all sub-op reverses, and DiffLogPanel rendering a single expandable batch card.
- **D (Word selection coordinates):** Use `paragraph.uniqueLocalId` (WordApi 1.6) + `range.compareLocationWith()` inside a single `Word.run` to locate the 0-based paragraph index of the selection, returning `{ index, uniqueLocalId, text }` for precise LLM targeting.
- **E (UI polish):** The "本次改动" card following the current loop is the core structural problem—needs `DiffLogPanel` moved from the tail `completedRunIds.map` render into the message stream inline. Other Markdown polish, lighter read-tool cards, skeleton screen, and loading bubble are pure CSS/new components with no data-flow impact.
- **F (chat history persistence):** key = `aster:chat:${docKey}` where `docKey` is derived from `Office.context.document.url` (stable for Office for Web when file is not renamed/moved). 20-turn cap is enforced in wire message construction, not the UI message store.

---

## Current Architecture Map (relevant subsystems, file paths)

### Agent Loop

- `src/agent/loop.ts` — ≤80-line while runner. Per turn: `streamAssistantTurn` → `runOneToolCall[]`. `buildToolsForHost(host)` called once at loop entry, constructing toolDefs array for the LLM.
- `src/agent/loop-helpers.ts` — turn-level helpers. Inside `runOneToolCall`: dispatch → dual-path push (wire + UI) → `appendOperation` (only when result has `reverse`).

### Tool Registry

- `src/agent/tools/index.ts` — `buildToolsForHost(host)` returns `ToolDef[]` per host; `dispatchTool` is the sole sanitize boundary; `assertWriteToolRegisterable` guards write tools (must have humanLabel).
- `src/agent/tools/write/word.ts` — 5 Word write tools (appendParagraph / insertParagraph / replaceParagraph / insertTextAtCursor / replaceSelection).
- `src/agent/tools/write/excel.ts` — 4 Excel write tools (setRangeValues / applyFormula / insertChart / setCell).
- `src/agent/tools/write/ppt.ts` — 4 PPT write tools (insertSlide / setShapeProperty / moveShape / setShapeText).
- `src/agent/tools/read/word.ts` / `read/excel.ts` / `read/ppt.ts` — read tools calling adapter.read().
- `src/agent/tools/common.ts` — `selectionDetail`, shared across hosts.

### System Prompt

- `src/agent/system-prompt.ts` — `buildSystemPrompt(host)` = `getSharedBase(today,clock,weekday,hostLabel)` + `getDomainSegment(host)`. Signature accepts only `host`; runtime reads current date.
- Test guard: `src/agent/system-prompt.test.ts` — `not.toContain` tests ensure detechnicalized content is absent from the prompt.

### OperationLog & Undo

- `src/agent/operationLog.ts` — `Map<runId, OperationLogEntry[]>`, in-memory only. `appendOperation` / `getWriteOpsByRun` / `replayUndoAll` / `replayUndoSingle`. `executeReverse` switches on `reverse.tool`—every new write tool's inverse tool name must be registered here.
- `DocumentAdapterForReplay` interface defines inverse method signatures for each adapter (Record object args, not positional params).

### Adapter Layer

- `src/adapters/WordAdapter.ts` — `Word.run` closures encapsulate all proxy lifecycle; inputs/outputs are plain data (A-06 constraint). Implements inverse methods (deleteParagraphByContent / restoreParagraphAt etc).
- `src/adapters/ExcelAdapter.ts` / `src/adapters/PptAdapter.ts` — same pattern.
- `src/adapters/DocumentAdapter.ts` — base interface: `read(query: ReadableQuery)` / `insert()` / `capabilities()`.

### Zustand Stores

- `src/store/chat.ts` — pure message store (messages array) + thin delegate (sendMessage → agentStore.runAgent).
- `src/agent/agentStore.ts` — agent state machine (idle/running/paused/soft-landing); `completedRunIds` list consumed by DiffLogPanel.
- `src/store/providers.ts` — Provider config + API Key storage (partitioned localStorage).

### UI Components

- `src/components/ChatStream.tsx` — message stream renderer. `completedRunIds.map` renders `DiffLogPanel` at the tail of the stream (current behavior). `MergedToolGroup` merges consecutive regular tool cards.
- `src/components/DiffLogPanel.tsx` — lazy chunk, receives `runId`, calls `getWriteOpsByRun` directly from operationLog (not through a store).
- `src/components/AgentControlBar.tsx` — running-state UI.

---

## Per-Feature Integration (A / B / C / D / E / F)

### A — Per-host system prompt deepening + user preference injection

**Existing hook point:**  
`buildSystemPrompt(host: HostKey): string` in `src/agent/system-prompt.ts`

**Integration approach:**
1. Expand `getDomainSegment(host)` content—add more host-specific guidance lines per v2.1 requirements, drawing from Skills research materials distilled into strings. Written directly into the file (D-09 principle: zero bundle, zero runtime dependency). No loadable Skill system.
2. User preference injection: extend `buildSystemPrompt` signature to `buildSystemPrompt(host, opts?: { userPrefs?: string })`. The preference string is conditionally appended to `getSharedBase` output as a `【用户偏好】...` block.
3. Preference persistence: new `preferenceStore` (Zustand), or add an `aster:prefs` key to providerStore's localStorage, with structure `{ writingStyle?: string, domain?: string, customHint?: string }`, loaded during `main.tsx` hydrate.
4. `agentStore.runAgent` calls `loop.ts`, which calls `buildSystemPrompt`—inject current preferences by adding `prefs?: string` to loop parameters, consumed inside `buildSystemPrompt`.

**Modified files:**
- `src/agent/system-prompt.ts` (expand getDomainSegment; support opts.userPrefs)
- `src/agent/system-prompt.test.ts` (update/add not.toContain assertions; no structural changes)
- `src/store/preferences.ts` (NEW — preference slice) or extend `src/store/providers.ts`
- `src/components/Settings/SettingsPanel.tsx` (NEW — preference input UI)
- `src/agent/loop.ts` (pass prefs to buildSystemPrompt)
- `src/agent/agentStore.ts` (runAgent reads prefs store)

**Critical constraint:**  
The `not.toContain` test guards remain unchanged structurally—user preference content is natural-language text (no forbidden technical terms like "API Key" or "backend server"), so no test structure modification needed. Only add new test cases for the preference block.

---

### B — New Office.js write tools

**Existing contract (every write tool must satisfy):**
1. Implement `ToolDef<TArgs>` interface: `name / description / parameters(JSON Schema) / humanLabel(args) / execute(args, ctx) / kind='write'`
2. Inside `execute`, call via `ctx.adapter as SpecificAdapter` (never directly reference Word/Excel/PowerPoint namespace)
3. Return `ToolResult` containing `reverse: ReverseDescriptor` (`{ tool: string, args: Record<string,unknown> }` — Record object, not positional params) + `postState: PostStateSnapshot`
4. Adapter layer: same-named method implemented in the Adapter class, pure data in/out, proxy never exits Word.run closure (A-06)
5. `DocumentAdapterForReplay` interface: add corresponding inverse method signature
6. `operationLog.executeReverse` switch: add corresponding case
7. `buildToolsForHost()`: append tool to the corresponding host case array
8. `assertWriteToolRegisterable(tool)` auto-validates humanLabel at registration time (no modification needed)

**Every new inverse must add an operationLog.integration.test gate** (project memory: `project_adapter_inverse_signature`).

**Modified files (Word example pattern):**
- `src/adapters/WordAdapter.ts` (new adapter method + inverse adapter method)
- `src/agent/tools/write/word.ts` (new ToolDef)
- `src/agent/operationLog.ts` (DocumentAdapterForReplay interface + executeReverse case)
- `src/agent/tools/index.ts` (buildToolsForHost word case array append)
- `src/agent/operationLog.integration.test.ts` (new inverse gate test)

Excel and PPT follow the identical pattern, replacing files with corresponding adapter/tool files.

**v2.1 post-triage candidate tool categories:**
- Word: character format (bold/italic/fontSize/color), paragraph alignment, style application, lists, table operations
- Excel: cell format (numberFormat/fillColor), sort, filter, conditional format, pivot table
- PPT: shape add/delete, rotation, background, table

---

### C — Batch write operations

**Design principle:** Batching is an LLM-side capability optimization (reduce tool call roundtrips), not an adapter-level API change.

**Placement:**  
New `batch_write` ToolDef, parameter `{ ops: Array<{ tool: string, args: Record<string,unknown> }> }`. Inside `execute`, serially call `dispatchTool(op, ctx, allToolsForHost)` for each sub-op, collecting each sub-op's `reverse` and `postState`.

**OperationLog interaction:**  
Two strategies; Strategy 2 is recommended:

- **Strategy 1 (N entries):** Each sub-op calls `appendOperation` independently with incrementing stepIndex. DiffLogPanel naturally renders N independently-undoable rows. Batch value is only reducing LLM tool call roundtrips + reducing MergedToolGroup card count; finest-grain undo.
- **Strategy 2 (1 batch entry) [RECOMMENDED]:** `batch_write`'s reverse is `{ tool: 'batch_reverse', args: { ops: [{tool, args}] } }`. `appendOperation` records one batch entry containing all sub-op reverses. `executeReverse` adds `case 'batch_reverse'` that serially executes all sub-reverses in reverse order. DiffLogPanel shows "批量改动 N 处" collapsible summary card, with sub-op humanLabels listed inside.

Strategy 2 matches the "batch undo as a unit" user mental model, and DiffLogPanel doesn't need to distinguish which steps belong to "the same batch"—the batch's `humanLabel` is generated by `humanLabel(args)` (e.g., "批量操作 3 步：写入 A1:B3、写入公式 C1、插入图表").

**postState (D-11 manual-edit defense):** Each sub-op's postState is embedded inside the batch entry's content field (`Array<{postState, reverse}>`). `replayUndoStep` on batch_reverse iterates sub-entries doing `readTargetState` + `isTargetStateConsistent` per sub-entry.

**New files:**
- `src/agent/tools/write/batch.ts` (batch_write ToolDef)

**Modified files:**
- `src/agent/tools/index.ts` (add batch_write to all three host cases in buildToolsForHost)
- `src/agent/operationLog.ts` (extend PostStateSnapshot.kind; add batch_reverse executeReverse case; extend OperationLogEntry with optional subOps field)
- `src/components/DiffLogPanel.tsx` (support entry.subOps nested rendering)

---

### D — Word selection coordinate/location

**Background:** When a document has multiple paragraphs with identical text, the LLM calling `replace_paragraph` or `replace_selection` based only on text content will target the wrong paragraph. Goal: `selection_detail` read tool returns the 0-based paragraph index and `uniqueLocalId` of the selection, enabling the LLM to target precisely.

**Office.js API path (MEDIUM confidence — API existence confirmed):**
1. `Word.Paragraph.uniqueLocalId` (WordApi 1.6) — session-unique GUID; differs across sessions and coauthors
2. `range.compareLocationWith(paragraphRange)` — returns `LocationRelation` (Inside / Contains / Equal / Before / After), used to find which paragraph contains the selection

**Implementation strategy (extend WordAdapter.read case 'selection_detail'):**

```typescript
// Inside Word.run:
const selection = ctx.document.getSelection();
selection.load('text');
const allParagraphs = ctx.document.body.paragraphs;
allParagraphs.load('items/text,items/uniqueLocalId');
await ctx.sync();

let paragraphIndex = -1;
let uniqueLocalId = '';
// Fast path: text-fingerprint match (handles most non-duplicate cases)
for (let i = 0; i < allParagraphs.items.length; i++) {
  if (allParagraphs.items[i].text.trim() === selection.text.trim()) {
    paragraphIndex = i;
    uniqueLocalId = allParagraphs.items[i].uniqueLocalId;
    break;
  }
}
// Fallback: compareLocationWith (handles duplicates)
if (paragraphIndex === -1) {
  const selRange = selection.getRange();
  for (let i = 0; i < allParagraphs.items.length; i++) {
    const pRange = allParagraphs.items[i].getRange();
    const rel = selRange.compareLocationWith(pRange);
    await ctx.sync();
    if (rel.value === 'Inside' || rel.value === 'Equal') {
      paragraphIndex = i;
      uniqueLocalId = allParagraphs.items[i].uniqueLocalId;
      break;
    }
  }
}
```

**Return value extension (selection_detail result):**
```typescript
// Current
{ kind: 'word', charCount: number, text: string }
// v2.1 extended
{ kind: 'word', charCount: number, text: string, paragraphIndex: number, uniqueLocalId: string }
```

**Modified files:**
- `src/adapters/WordAdapter.ts` (extend `case 'selection_detail'` to compute paragraphIndex + uniqueLocalId)
- `src/adapters/WordAdapter.read.test.ts` (add selection_detail coordinate path tests)
- Optionally: `src/adapters/DocumentAdapter.ts` (extend ReadableResult type if a precise word_selection type exists)

**Limitation of uniqueLocalId:** Documented as "differs across sessions and coauthors" — resets each Office.js session. Safe to use within a single agent run (read → subsequent write targeting paragraphIndex + uniqueLocalId within the same loop). Cannot be relied on across F's persisted sessions.

**Office.js API requirement check:** `paragraph.uniqueLocalId` requires WordApi 1.6. Current project targets Office for Web (latest 2 Edge/Chrome versions), which supports WordApi 1.6 (GA in 2022). HIGH confidence this is available.

---

### E — UI Polish

#### E1: "本次改动" card following the current loop (most structurally complex)

**Current architecture:**  
`ChatStream.tsx` tail:
```tsx
{completedRunIds.map((runId) => (
  <Suspense key={runId}><DiffLogPanel runId={runId} /></Suspense>
))}
```
All DiffLogPanels render at the bottom of the message stream, spatially unrelated to the message group of their corresponding loop.

**Target behavior:** After each loop completes, "本次改动 N 处" card appears immediately after the last message of that loop.

**Implementation approach:**  
Move `DiffLogPanel` from tail rendering into the message stream inline. During message stream traversal, detect "the last message of a completed run" and insert DiffLogPanel after it.

Determination logic: `message.agentRunId` is available on messages. When the message sequence transitions from `runId=X` to `runId=Y` (or reaches end of sequence), and `completedRunIds.includes(X)`, insert `<DiffLogPanel runId={X} />` at that transition point.

```tsx
// ChatStream.tsx message rendering logic change:
const groupedNodes: ReactElement[] = [];
let pendingRunId: string | null = null;

// helper called before each non-tool-of-same-run message or at end
const flushDiffPanel = (runId: string | null): void => {
  if (runId && completedRunIds.includes(runId)) {
    groupedNodes.push(
      <Suspense key={`diff-${runId}`}><DiffLogPanel runId={runId} /></Suspense>
    );
  }
};

for (const m of messages) {
  const msgRunId = m.agentRunId ?? null;
  if (pendingRunId && pendingRunId !== msgRunId) {
    flushDiffPanel(pendingRunId);
  }
  pendingRunId = msgRunId;
  // ... render message ...
}
flushDiffPanel(pendingRunId); // flush at end of stream

// Remove the old completedRunIds.map block
```

**New/modified components:**
- `src/components/ChatStream.tsx` (modify message stream traversal; remove tail completedRunIds.map)

DiffLogPanel itself needs no changes (it only cares about runId, not where it's rendered).

#### E2: Markdown overall optimization

- `src/styles.css`: add table borders (`table { border-collapse: collapse } td, th { border: 1px solid var(--border) }`), blockquote style, code block overflow handling.
- `src/components/ChatBubble.tsx`: verify `react-markdown` `remarkPlugins` list is complete (`remark-gfm` already present).
- No new dependencies, pure CSS + parameter adjustments.

#### E3: Lighter read-tool cards

- `src/components/ChatStream.tsx` `ToolResultCard`: read tools (successful `message.toolResult?.ok && !result.reverse`, i.e., no reverse field) use a lighter style—no border, smaller font, gray text.
- `src/styles.css`: add `.aster-tool-card--read` modifier.

#### E4: Skeleton screen + loading bubble

- Skeleton screen: `src/components/ChatStream.tsx` already has empty-state logo + chips. During `agentStatus !== 'idle'`, render simple skeleton bars (3 `div.skeleton-line`).
- Loading bubble: when `agentStore.currentPhase === 'thinking'`, render a `div.msg-ai.msg-loading` (3-dot animation) at the end of the message stream. `currentPhase` state already exists; just add component render condition.
- New component: `src/components/LoadingBubble.tsx` (or inline in ChatStream).

---

### F — Chat history persistence

#### F1: Office.js document identity mechanism

**Analysis (MEDIUM confidence for stability, HIGH confidence for API existence):**  
Office.js does not expose a stable global document GUID. Two available APIs:
- Sync: `Office.context.document.url` — string or null (no await needed, but may be transiently null during Office for Web async initialization)
- Async: `Office.context.document.getFilePropertiesAsync(callback)` — `asyncResult.value.url`

`url` is the file path/SharePoint URL, like `https://example.sharepoint.com/.../MyFile.docx` or a desktop local path. For Office for Web (Aster v2.1 primary target), the URL is relatively stable—unchanged as long as the file is not renamed or moved.

**Recommended docKey construction:**
```typescript
// src/lib/docKey.ts (NEW)
export async function getDocKey(): Promise<string> {
  return new Promise((resolve) => {
    // Try sync first
    if (Office.context.document.url) {
      resolve(hashUrl(Office.context.document.url));
      return;
    }
    // Async fallback
    Office.context.document.getFilePropertiesAsync((result) => {
      const url = result.value?.url;
      resolve(url ? hashUrl(url) : 'aster:chat:unsaved');
    });
  });
}

function hashUrl(url: string): string {
  // Take last 80 chars of url, btoa, replace special chars
  return 'aster:chat:' + btoa(url.slice(-80)).replace(/[+/=]/g, '_');
}
```

**Calling timing in main.tsx:**
```typescript
await Office.onReady();
hydrateFromStorage();               // existing providers/prefs hydrate
const docKey = await getDocKey();
useChatStore.getState().loadHistory(docKey);
```

**Known limitations (should be confirmed during Phase 8 design):**
1. `url === null` or `getFilePropertiesAsync` fails → key = `'aster:chat:unsaved'`; multiple unsaved documents share this key (low risk, since switching unsaved documents refreshes the Task Pane)
2. Rename/move file → docKey changes, old chat history "lost" (acceptable degradation—not data corruption)
3. Cross-browser (Edge → Chrome) → localStorage not shared (project design constraint)
4. Host isolation: Word / Excel / PPT each have independent localStorage partitions; chat for same file in different hosts is independent (expected behavior)

**Spike required (confirm before Phase 8 implementation):**  
Real-device test `Office.context.document.url` return value format on Office for Web / Chrome, confirming stability.

#### F2: 20-turn cap interaction with message store

**Key distinction:**
- `chatStore.messages` (UI layer): retains all messages including tool role messages, for complete DiffLogPanel/UI display
- `loop.ts` `messages: WireMessage[]` (LLM wire layer): only what is sent to the LLM, needs 20-turn (user + assistant dialogue turns, excluding tool turns) cap enforcement

**20-turn truncation location:**  
In `loop.ts` wire messages construction (each `runAgent` call), reconstruct wire messages from chatStore history (historical user/assistant pairs), truncate to the most recent 20 turns, then prepend system prompt + current user prompt. Tool messages do not count toward "turns" but are included in wire messages (LLM needs to see tool results).

Precise implementation: count user+assistant pair count; when exceeding 20 pairs, truncate from the earliest user message (keeping the most recent 20 pairs). `role: 'tool'` wire messages accompany their corresponding assistant turn; truncating by run boundary is cleanest (remove the entire assistant + tool results batch for the oldest run).

**Persistence + restore path:**
- Store: after `chatStore.sendMessage` completes (or `agentStore.endRun`), serialize `messages` (UI layer, all roles) to `localStorage[docKey]`, structure `{ version: 1, messages: Message[], lastSaved: number }`
- Restore: in `main.tsx Office.onReady` after hydration (alongside `hydrateFromStorage()`), call `chatStore.loadHistory(docKey)` to read and set messages
- Clear: `chatStore.clearHistory()` already exists; extend to also delete the localStorage key

**Modified files:**
- `src/store/chat.ts` (new `loadHistory(docKey)` + `saveHistory(docKey)` + `clearHistory` extension)
- `src/agent/loop.ts` or `agentStore.ts` (wire messages construction with history + 20-turn truncation)
- `src/main.tsx` (load chat history during hydrate)
- `src/lib/storage.ts` (new chat key constant)
- `src/lib/docKey.ts` (NEW)

---

## Cross-cutting Risk: Tool Count / Token Cost Explosion (B's primary threat)

### Problem scale

Each ToolDef's JSON Schema sent to the LLM consumes approximately **200–500 tokens** (name + description + parameters schema). Current three-host tool counts:
- Word: 9 tools (4 read + 5 write + 1 common)
- Excel: 7 tools (3 read + 4 write + 1 common)
- PPT: 8 tools (4 read + 4 write + 1 common)

B plans to add ~15–30 tools post-triage, plus C's batch_write. Total tools per host may reach 25–45.

**25 tools × 350 tokens/tool = 8,750 tokens of tool schema overhead** (sent every turn of every loop). For DeepSeek-V4-Flash (384K max output, 1M context), the context window itself is not the bottleneck, but **token cost scales linearly**, directly impacting user economics.

**Larger risk: model accuracy degradation.** Industry experience (multiple consistent sources): when tool count exceeds 15–20, LLM starts "guessing" tools rather than precisely selecting, especially for tools with complex parameters. Anything with more than 3–4 params causes the model to guess instead of asking. Experts recommend no more than **10–15 tools at a time**.

### Mitigation strategies (recommended)

**Strategy 1 (RECOMMENDED): Parametrized consolidation**

Merge multiple tools of the same operation category into one "descriptive" tool, distinguished by an `operation` parameter:

```typescript
// Replaces bold_selection / italic_selection / set_font_size as 3 separate tools
{
  name: 'set_word_character_format',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['bold', 'italic', 'underline', 'set_font_size', 'set_font_color'],
        description: '格式操作类型'
      },
      value: { type: ['string', 'number'], description: '参数值（字号 14 / 颜色 #FF0000）' },
      paragraph_index: { type: 'number', description: '目标段落（省略则为当前选区）' }
    },
    required: ['operation']
  }
}
```

3–5 atomic operations become 1 tool. Token cost drops from 5×350=1750 to 1×450=450 (including enum descriptions).

**Strategy 2: Minimize tool descriptions**

Existing tool descriptions are already short. Continue:
- Remove repeated information from `description` that's already in `parameters.property.description`
- `humanLabel` is never sent to LLM (only shown in UI)—this is the existing architecture; ensure it's not mixed into `description`

**Strategy 3 (not recommended for v2.1): Dynamic tool filtering**

Based on current task context (reading user prompt keywords), send only a subset of tools to the LLM. High implementation complexity, and conflicts with Aster's "all tools available within a run" design (LLM may need to switch tools mid-run). Defer to v2.2+ evaluation.

**Practical recommendation (v2.1 B phase):**
1. B's triage targets ≤20 new tools across all three hosts (≤8 net new per host)
2. For same operation category (font/alignment/style), prioritize parametrized consolidation—don't atomize by operation
3. Each tool's `description` field kept to ≤50 characters
4. After phase completion, run a `buildToolsForHost` token-count test (calculate total toolDefs JSON character count as proxy metric, gate ≤15KB per host)

---

## Batch (C) ↔ OperationLog ↔ Diff Card Interaction

### Complete data flow

```
LLM emits batch_write({ ops: [{tool:'set_range_values',args:{...}}, ...] })
  ↓
dispatchTool(batch_write, ctx, tools)
  ↓ (inside execute)
for op of ops: dispatchTool(op.tool, ctx, tools) → collect reverse[]
  ↓
appendOperation({
  runId, stepIndex, toolName: 'batch_write',
  humanLabel: '批量执行 3 步操作',
  reverse: { tool: 'batch_reverse', args: { ops: [{tool,args}, ...] } },
  postState: { kind: 'batch', content: [{postState1}, {postState2}] },  // new kind
  subOps: [{ humanLabel: '写入 A1:B3', ...}, ...]   // for DiffLogPanel display
})
  ↓
UI: loop-helpers pushMessage({ role:'tool', humanLabel:'批量执行 3 步', ... })
  → ChatStream.tsx renders single ToolResultCard (1 message, no merging needed)
  ↓ (run completes)
DiffLogPanel({ runId }) reads getWriteOpsByRun → 1 batch entry
  → renders "本次改动 1 处" (or "本次批量改动 3 处" based on subOps length)
  → expand: each row shows a sub-op humanLabel
  → "撤销该步" → replayUndoSingle(batchEntry) → executeReverse → case 'batch_reverse'
    → reverse-order sub-reverse execution
```

### OperationLog type extensions

`PostStateSnapshot.kind` needs new `'batch'`:

```typescript
export interface PostStateSnapshot {
  kind: 'word_paragraph' | 'excel_range' | 'excel_chart' | 'ppt_slide' | 'ppt_shape' | 'batch';
  content: unknown; // when batch: { subOps: Array<{postState, reverse, humanLabel}> }
}

// OperationLogEntry extension (optional field for DiffLogPanel)
export interface OperationLogEntry {
  // ... existing fields ...
  subOps?: Array<{ humanLabel: string; postState?: PostStateSnapshot; reverse: ReverseDescriptor }>;
}
```

### DiffLogPanel rendering extension

```tsx
// In DiffLogPanel, when entry.subOps exists, render nested list:
{entry.subOps && entry.subOps.length > 0 && expanded && (
  <ul className="batch-sub-ops">
    {entry.subOps.map((subOp, i) => (
      <li key={i} className="batch-sub-op">{subOp.humanLabel}</li>
    ))}
  </ul>
)}
```

---

## Per-Document Chat Persistence Keying (F) — Office.js Document Identity Mechanism

**Conclusion:** Office.js does not expose a stable document GUID. `Office.context.document.url` is the only usable document identifier. It is relatively stable for Office for Web (no rename/move), unavailable for unsaved documents.

**Specific APIs (HIGH confidence for existence):**
- Sync: `Office.context.document.url` — string or null; no await required; may be transiently null during Office for Web async initialization
- Async: `Office.context.document.getFilePropertiesAsync(callback)` — `asyncResult.value.url`

Neither provides a stable unique identifier beyond the URL. The URL may be unavailable for unsaved documents.

**Confirmed unavailable:** Microsoft has confirmed via GitHub issue #1098 that there is no prescribed Document API interface in the current Office.js context to get the GUID of the document the add-in is open in.

**Recommended approach:** Async fallback `getDocKey()` as described in §F1 above. Store under `aster:chat:{hash}` key. Accept URL-based keying with documented graceful degradation.

---

## Suggested Build Order (dependency-ordered, Phase 8 grain hints)

```
Phase 8a — Foundation refactor (no new features, all prerequisites for B/C/D safe landing)
  8a-1: B tool registry triage + parametrized design (spec for all A–F)
        → Output: final tool list per host (count ≤ 25), parametrized consolidation design
        → Dependency: none; MUST precede mass tool addition
  8a-2: F (chat persistence) — docKey spike + chatStore loadHistory/saveHistory
        → Dependency: none (isolated feature); do early because it touches chat store init path
  8a-3: A (system prompt deepening) — getDomainSegment expansion + preferenceStore + buildSystemPrompt signature extension
        → Dependency: none (self-contained); do early so subsequent killer scenario tests benefit

Phase 8b — Word tool completion (D + B-Word)
  8b-1: D (Word selection coordinates) — WordAdapter selection_detail coordinate extension
        → Dependency: 8a-1 (confirm selection_detail is in post-triage tool list)
  8b-2: B-Word (new Word write tools per triage list)
        → Dependency: 8a-1 (tool design finalized); each tool independently testable
        → Critical: every new inverse must simultaneously add operationLog.integration.test gate

Phase 8c — Excel + PPT tool completion
  8c-1: B-Excel (new Excel write tools)
  8c-2: B-PPT (new PPT write tools)
  → Dependency: 8b-2 complete (same pattern; can be parallel but serial avoids integration test interference)

Phase 8d — Batch operations (C)
  8d-1: batch_write ToolDef + operationLog batch_reverse + DiffLogPanel subOps extension
        → Dependency: 8b/8c complete (batch needs to reference already-registered tool execute functions)
        → Critical: most complex single point; needs careful testing for partial failure (what if a sub-op fails mid-batch?)

Phase 8e — UI polish (E)
  8e-1: DiffLogPanel position fix (E1 — follow current loop)
        → Dependency: none (pure UI, doesn't affect data path); best after 8d to test batch card visual together
  8e-2: Markdown optimization + lighter read-tool card (E2/E3)
        → Dependency: none
  8e-3: Skeleton screen + loading bubble (E4)
        → Dependency: none; do last (pure UX polish)

Phase 8f — UAT + Release
  → Kill-scenario coverage for all A–F features
```

**Critical dependency constraints:**
- 8a-1 (triage) MUST precede 8b/8c/8d (tool design determines batch interface)
- 8d (batch) MUST come after 8b/8c (batch internally calls other tool execute functions)
- 8e-1 (DiffLogPanel position) is independent of the data path; can run parallel to 8b/8c but parallel execution may cause UI test interference

---

## Sources (confidence levels)

| Source | Confidence | Used for |
|---|---|---|
| `src/agent/loop.ts` / `loop-helpers.ts` (actual code) | HIGH | Agent loop architecture |
| `src/agent/tools/index.ts` (actual code) | HIGH | Tool registry + dispatch |
| `src/agent/system-prompt.ts` (actual code) | HIGH | System prompt structure |
| `src/agent/operationLog.ts` (actual code) | HIGH | OperationLog + undo |
| `src/adapters/WordAdapter.ts` (actual code) | HIGH | Word adapter + inverse |
| `src/components/ChatStream.tsx` / `DiffLogPanel.tsx` (actual code) | HIGH | UI component architecture |
| `src/store/chat.ts` / `agentStore.ts` (actual code) | HIGH | Store architecture |
| [Microsoft Learn — Word.Paragraph class](https://learn.microsoft.com/en-us/javascript/api/word/word.paragraph?view=word-js-preview) | HIGH | `uniqueLocalId` (WordApi 1.6) |
| [Microsoft Learn — Word.Range class](https://learn.microsoft.com/en-us/javascript/api/word/word.range?view=word-js-preview) | HIGH | `compareLocationWith` (WordApi 1.3) |
| [Microsoft Learn — Office.Document interface](https://learn.microsoft.com/en-us/javascript/api/office/office.document?view=common-js-preview) | HIGH | `url` + `getFilePropertiesAsync` |
| [OfficeDev/office-js Issue #1098](https://github.com/OfficeDev/office-js/issues/1098) | HIGH | Confirmed: no document GUID from Office.js |
| [OfficeDev/office-js Issue #4078](https://github.com/OfficeDev/office-js/issues/4078) | HIGH | `getOoxml` paraId unstable; use `uniqueLocalId` |
| [MCP Tool Schema Bloat — Layered System](https://layered.dev/mcp-tool-schema-bloat-the-hidden-token-tax-and-how-to-fix-it/) | MEDIUM | Tool schema token cost measurements (200–800 tokens/tool) |
| [I Reduced My MCP Tools from 96 to 10 — Alma Tuck](https://almatuck.com/articles/reduced-mcp-tools-96-to-10-strap-pattern) | MEDIUM | STRAP parametrized consolidation strategy |
| [MCP Token Optimization — StackOne](https://www.stackone.com/blog/mcp-token-optimization/) | MEDIUM | 10–15 tools at a time rule of thumb |

---

*Research completed: 2026-05-30. Targeted at Phase 8 roadmapper.*
