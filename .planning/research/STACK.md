# Stack Research — Aster v2.1「从能用到好用」

**Project:** Aster v2.1  
**Researched:** 2026-05-30  
**Type:** SUBSEQUENT MILESTONE (capability deepening on shipped v2.0 base)  
**Confidence:** HIGH for "what stays"; MEDIUM for bundle impacts; MEDIUM-HIGH for Office.js API availability

---

## Summary

- **react-markdown + remark-gfm are already installed** (`package.json` deps confirmed). ChatBubble already wires them. Feature E (Markdown table-border polish) needs only CSS changes in `styles.css` — zero new deps.
- **Zustand persist middleware is included in the zustand package** (no separate install). Feature F (chat history persistence) can use it OR reuse the existing `src/lib/storage.ts` pattern already in the codebase. The `storage.ts` approach avoids introducing the persist middleware at all — recommended given the custom partitionKey behavior required.
- **Feature C (batch write) does not need any new library.** Native Office.js batching — queuing multiple property sets inside one `Excel.run` / `Word.run` closure and calling `context.sync()` once — is the official recommended pattern (Microsoft Learn, Sept 2025). The current adapter architecture already does this correctly for single ops; batch paths just need a new adapter method accepting multi-op arrays.
- **Feature B (~60 write tools) is gated by API availability, not bundle.** All target APIs (Word.Font/Paragraph/List/Table, Excel conditional-format/sort/filter/pivot, PPT shape-add/rotate/background/table) exist in Office.js. PPT rotation and table support landed in PowerPointApi 1.4/1.8 respectively. The only caution: PPT `shape.rotation` was previously missing (GitHub issue #3022) — verify in spike that it is available on Office for Web (Edge/Chrome latest).
- **Feature D (Word selection precision)** should use `paragraph.uniqueLocalId` (WordApi 1.6) as the stable paragraph identifier. Known bug: returns `null` on desktop Word — acceptable given v2.1 targets Office for Web only.
- **No new runtime deps needed for A–F** (0 net-new, constraint satisfied). The only potential addition is `zustand/middleware` `persist` which is already inside the `zustand` package — not an extra install.

---

## Recommended Additions / Changes

| Tech | Version | Purpose | Why | Bundle impact (gzip) | Lazy? |
|------|---------|---------|-----|----------------------|-------|
| `zustand/middleware` `persist` | built-in (zustand ^5.x already installed) | Feature F: auto-hydrate chat history from localStorage | Already in `zustand` package — zero install cost. `partialize` option lets us exclude streaming state, tool results, etc. See caveat below on custom storage. | **0 KB added** (already in bundle or tree-shaken in) | No (hydrates on store init) |
| CSS-only table borders in `styles.css` | n/a | Feature E: Markdown table borders | `react-markdown + remark-gfm` already installed and wired in ChatBubble. Tables render without borders because no CSS rule targets `.bubble-ai table`. Add `border-collapse: collapse` + cell border rules to the `.bubble-ai` scope. | **0 KB** | No |
| `paragraph.uniqueLocalId` (WordApi 1.6) | Office.js CDN (no install) | Feature D: disambiguate duplicate text in Word | Native API on `Word.Paragraph`; returns a session-stable GUID. Already accessible via the CDN Office.js. No adapter changes needed beyond loading the property in `read()`. | **0 KB** | No |
| Native Office.js batch write path | Office.js CDN (no install) | Feature C: batch operations | Multiple property-sets queued in one `Excel.run`/`Word.run` closure, single `context.sync()` at end — the canonical Microsoft pattern. No library needed. | **0 KB** | No |

**Nothing else needed.** Every v2.1 A–F feature is deliverable with the existing stack.

---

## Already In Stack (package.json audit)

| Package | Status | Notes |
|---------|--------|-------|
| `react-markdown@^9.0.0` | **INSTALLED** (dependencies) | ChatBubble already imports it |
| `remark-gfm@^4.0.0` | **INSTALLED** (dependencies) | Already passed as remarkPlugins in ChatBubble |
| `zustand@^5.0.0` | **INSTALLED** (dependencies) | `persist` middleware is in `zustand/middleware` — same package |
| `@lingui/react@^5.0.0` | **INSTALLED** | No change needed |
| `@lingui/macro@^5.0.0` | **INSTALLED** | No change needed |
| React 19, TypeScript 5.7, Vite 7 | **INSTALLED** | No change needed |
| `src/lib/storage.ts` | **EXISTS** (custom, partitioned localStorage) | Already handles `Office.context.partitionKey`; preferred over zustand persist for chat history — see Feature F notes |
| `STORAGE_KEYS` constants | **EXISTS** in `src/lib/storage.ts` | Need to add `CHAT_HISTORY` and `USER_PREFERENCES` keys |

**Not installed and not needed for v2.1:**
- mammoth, SheetJS, pdfjs-dist — still lazy-loadable for v2.2 file upload; not needed in v2.1
- shiki — still optional for code highlighting; not needed in v2.1
- Any new component library — confirmed not needed

---

## Per-Feature Stack Notes

### A — 能力变聪明 (per-host system prompts + user preferences)

**What's needed:** Pure TypeScript changes — no new deps.

- `src/agent/system-prompt.ts` already has `getSharedBase` + `getDomainSegment` architecture (Phase 6). Deepen the three `getDomainSegment` strings with richer domain guidance.
- **Skills design patterns extracted** (four URLs studied):
  - **PPT (ppt-creator + anthropic PPTX SKILL):** Key patterns — (1) assert-style slide titles (claims, not topics), (2) verify after create (generate → inspect → fix loop), (3) explicit prohibition: no accent lines under titles, no centered body text, (4) content-informed color palette with one dominant color, (5) every slide needs a visual element. For Aster domain segment: reinforce `list_shapes_on_slide` before editing, batch emit multiple `insert_slide` calls, assert-style title guidance, 3-5 bullets per slide rule.
  - **Excel (excel-analysis):** Key patterns — (1) read first (`get_used_range_summary`) before transforming, (2) progressive: explore → transform → output, (3) chunked reading for large files, (4) write results back (洞察写到空白单元格 already in domain segment). For Aster: reinforce column-by-column vs block reads, explicit pivot/conditional-format sequencing.
  - **Word (content-writer):** Key patterns — (1) lead with biggest impact, (2) every paragraph earns its place, (3) active voice / present tense, (4) replace vague language with specific numbers. For Aster: complement existing `replace_paragraph` guidance with "preserve original argument, only change language register" instruction.
- **User preferences injection:** Add `STORAGE_KEYS.USER_PREFERENCES` to `src/lib/storage.ts`. Read in `buildSystemPrompt()` and append a `【用户偏好】` block if non-empty. String is stored as plain text — no parsing. Zero bundle impact.

### B — 能力补全 (more write tools, ~60 candidates)

**What's needed:** New `ToolDef` entries + new adapter methods. No new deps.

**Office.js API availability (verified):**

| Category | APIs Available | Requirement Set | Confidence |
|----------|---------------|-----------------|------------|
| Word: font bold/italic/color/size | `paragraph.getRange().font.*` | WordApi 1.1 | HIGH |
| Word: paragraph alignment | `paragraph.alignment` (enum) | WordApi 1.1 | HIGH |
| Word: paragraph style name | `paragraph.styleBuiltIn` / `paragraph.style` | WordApi 1.1/1.3 | HIGH |
| Word: paragraph indent/spacing | `paragraph.leftIndent`, `paragraph.lineSpacing` | WordApi 1.1 | HIGH |
| Word: list operations | `Word.List` class, `insertParagraph` into list | WordApi 1.3 | HIGH |
| Word: table operations | `Word.Table` class, `addTable`, cell manipulation | WordApi 1.3 | HIGH |
| Excel: cell number format | `range.numberFormat` | ExcelApi 1.1 | HIGH |
| Excel: sort | `range.sort.apply()` | ExcelApi 1.2 | HIGH |
| Excel: auto-filter | `worksheet.autoFilter.apply()` | ExcelApi 1.2 | HIGH |
| Excel: conditional formatting | `range.conditionalFormats.add()` | ExcelApi 1.6 | HIGH |
| Excel: pivot table (create) | `worksheet.pivotTables.add()` | ExcelApi 1.8 | MEDIUM |
| PPT: add geometric shape | `slide.shapes.addGeometricShape()` | PowerPointApi 1.4 | HIGH |
| PPT: delete shape | `shape.delete()` | PowerPointApi 1.4 | HIGH |
| PPT: move/resize shape | `shape.left/top/height/width` | PowerPointApi 1.4 | HIGH |
| PPT: shape fill color | `shape.fill.setSolidColor()` | PowerPointApi 1.4 | HIGH |
| PPT: shape rotation | `shape.rotation` | PowerPointApi 1.4+ | MEDIUM — known GitHub issue #3022 (historical gap); verify on Office for Web in spike |
| PPT: add text box | `slide.shapes.addTextBox()` | PowerPointApi 1.4 | HIGH |
| PPT: slide background | `slide.background` property | PowerPointApi 1.4 | MEDIUM — verify exact writable API in spike |
| PPT: table (add/cells) | `slide.shapes.addTable()` / `shape.getTable()` | PowerPointApi 1.8 | MEDIUM — newer requirement set, verify on Office for Web |

**Important constraint for all B tools:** Each new `ToolDef` must follow the `inverse op / reverse / postState` pattern from `src/agent/operationLog.ts`. For font/paragraph writes: before-image must capture the previous font/paragraph state. For Excel conditional-format: delete by ID on undo. For PPT shape-add: `shape.delete()` on inverse.

**Triage recommendation (priority for v2.1):**
- Highest ROI: Word font (bold/color/size), Word paragraph alignment + style, Excel number-format + sort, PPT shape fill + add-textbox — these are universally useful and low-complexity inverse ops.
- Defer or spike-gate: Excel pivot (complex inverse), PPT table (PowerPointApi 1.8 — newer requirement set), PPT rotation (known historical issue).

### C — 批量操作 (batch write path)

**What's needed:** New adapter methods + a batch tool-calling convention. No new deps.

**Office.js batching is native and free.** The pattern:
```typescript
// Inside Excel.run (single round-trip):
await Excel.run(async (ctx) => {
  const ws = ctx.workbook.worksheets.getActiveWorksheet();
  for (const op of ops) {
    const range = ws.getRange(op.address);
    range.values = op.values;   // queued, not sent yet
  }
  await ctx.sync();              // ONE round-trip for all ops
});
```
This is the official "write data in arrays, assign once to target range" best practice (Microsoft Learn performance guide, Sept 2025 update). No library needed.

**Key Office.js batch constraint:** Max ~50 queued batch jobs before queue overflow. For very large writes (>5 MB payload) split into chunks with intermediate context.sync() calls. The `set_range_values` tool already handles single-range bulk writes — the batch path needs to accept an array of `{address, values}` pairs and dispatch them in one `Excel.run`.

**Implementation path:** Add `batchSetRangeValues(ops: Array<{address: string, values: unknown[][]}>) ` to `ExcelAdapter`. Add a new `batch_set_range_values` ToolDef in `write/excel.ts`. Parallel for Word: `batchReplaceParagraph` accepting an array of `{index, text}` pairs. The `OperationLog` approach: one batch op = one log entry with an array of before-images.

**Tool card UX:** Batch ops should appear as a single `MergedToolGroup` card (already exists in ChatStream) — no UI changes needed beyond correct humanLabel like `「批量更新 N 个单元格」`.

### D — Word 选区精度 (selection location info)

**What's needed:** Extend `get_paragraph_at` read tool to return `uniqueLocalId`. No new deps.

**`paragraph.uniqueLocalId`** (WordApi 1.6) returns a session-stable GUID in `"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"` format. This is the correct API for disambiguating paragraphs with identical text.

**Known bug:** Returns `null` on desktop Word (GitHub issue #4258). Acceptable for v2.1 (targets Office for Web only). Add graceful fallback: if `uniqueLocalId` is null, fall back to `{index, text_preview}` disambiguation hint.

**Implementation:** In `WordAdapter.read()` for `get_paragraph_at`, load `uniqueLocalId` alongside `text`. Return it in the result object. Update `getDocumentOutline` similarly to include IDs in the outline. The LLM can then reference `uniqueLocalId` in `replace_paragraph` args for disambiguation.

**Alternative considered:** `paragraph.getRange(Word.RangeLocation.whole)` + character offset — not available directly; `Range` has no numeric `offset` property. `compareLocationWith` exists but only gives relative ordering, not absolute position. `uniqueLocalId` is the right answer.

### E — UI 打磨 (Markdown polish + UI improvements)

**What's needed:** CSS changes + React component additions. No new deps.

**Markdown table borders:** `react-markdown` + `remark-gfm` already installed and wired in `ChatBubble.tsx`. Tables render with no borders because `styles.css` has no table rules inside `.bubble-ai`. Fix:
```css
.bubble-ai table {
  border-collapse: collapse;
  width: 100%;
  font-size: var(--fs-12);
}
.bubble-ai th,
.bubble-ai td {
  border: 1px solid var(--border);
  padding: var(--space-1) var(--space-2);
  text-align: left;
}
.bubble-ai th {
  background: var(--surface-2);
  font-weight: 600;
}
```
CSS vars already in `styles.css` (`--border`, `--surface-2`, etc.) — use them.

**Lighter read-tool cards:** Current `.aster-tool-card` has border + padding. "No border, smaller footprint" means removing `border: 1px solid var(--border)` and tightening padding in `styles.css`. No component logic change.

**First-paint skeleton:** Add a CSS skeleton shimmer (pure CSS + keyframes, no library) for the chat area before first message. Approximately 10 lines CSS.

**AI loading bubble:** When `agentStatus === 'thinking'`, render a `<div className="bubble bubble-ai loading-bubble">` with 3-dot pulsing animation (pure CSS). Wire into `ChatStream.tsx` — show after last message while `isStreaming`.

**「本次改动」卡跟随当次 loop:** Currently `DiffLogPanel` renders after all messages via `completedRunIds` map at the bottom of `ChatStream`. To make it appear inline after each run's last message, restructure the message rendering loop to inject `DiffLogPanel` immediately after detecting a run completion boundary. `DiffLogPanel` is already a lazy chunk — still lazy-load via `Suspense`. No new deps, restructure existing logic.

### F — 聊天记录持久化 (localStorage chat history)

**What's needed:** Add storage logic to `useChatStore`. Reuse `src/lib/storage.ts`. No new deps.

**Approach decision — zustand persist middleware vs. manual storage:**

The project has a custom `src/lib/storage.ts` that handles `Office.context.partitionKey` prefixing. This is essential — without it, different Office hosts (PPT/Excel/Word on Office for Web) write to different localStorage partitions and share nothing. The `zustand/middleware` `persist` uses a `createJSONStorage` adapter but does not know about `Office.context.partitionKey` by default.

**Recommended approach: Manual storage (reuse `src/lib/storage.ts`)**
- `useChatStore` already has `clearHistory()` — extend it to also call `storage.remove(STORAGE_KEYS.CHAT_HISTORY)`.
- Add `persistHistory()` action: called after each message push, serializes messages to `storage.set(STORAGE_KEYS.CHAT_HISTORY, messages)`.
- Add `loadHistory()` action: called in `main.tsx` after `Office.onReady`.
- Keep it simple: persist only `role='user'` and `role='assistant'` messages (filter out `role='tool'` — these are execution artifacts, not conversational context). This aligns with the "~20-turn context cap, tool turns not counted" requirement.

**~20-turn context cap for LLM:** In `loop.ts`, when building `messages: WireMessage[]`, filter the persisted chat history to the last 20 user+assistant turns before prepending them to the wire messages array. Tool messages are already pushed inline during the run and don't need to come from history.

**Per-document storage (research):** Office.js `document.settings` API would be ideal (ties history to the file) but is explicitly unsuitable (CLAUDE.md: "Key would travel with file — security disaster", though for chat history security is not the concern — the limitation is it doesn't persist across browser sessions and has quota limits). Using `partitioned localStorage` already gives per-browser-per-host isolation. True per-document isolation would require document-specific keys (e.g., `aster:chat:{documentId}`) — but there is no stable cross-session document ID in Office.js without custom bindings. **Decision: per-host isolation (PPT/Excel/Word separate) via partitionKey is sufficient for v2.1. Per-document isolation is a v2.2+ concern.**

**Storage quota:** Chat history (text only, no tool results, 20-turn cap) is roughly 20 x 2 x ~500 chars = ~20 KB uncompressed. Well within localStorage quota (~5 MB typical). `storage.ts` already handles `QuotaExceededError`.

**If zustand persist is chosen instead:** Import `{ persist, createJSONStorage }` from `'zustand/middleware'` — already in the package, 0 KB added. But must provide a custom storage implementation that wraps `storage.ts` to apply the partitionKey prefix. More boilerplate than the manual approach for this specific use case.

---

## What NOT to Add

| Package | Reason |
|---------|--------|
| **`immer`** | No immutable update complexity in v2.1; Zustand's `set()` is sufficient |
| **`dexie` / `idb` (IndexedDB)** | localStorage is sufficient for 20-turn x text-only history (~20 KB); IndexedDB is v2.2+ if history grows to include attachments/images |
| **`diff` / `jsdiff`** | DiffLogPanel already exists and uses OperationLog; no new diffing library needed |
| **`shiki` / `prism`** | Not needed for v2.1; code blocks in agent replies are infrequent; still defer to v2.2 or when user requests |
| **`@microsoft/office-js` npm** | Officially deprecated; CDN-only confirmed |
| **`xstate` / any state machine library** | Agent loop is stable (<=80-line while runner); adding a state machine framework would violate 0-net-new-deps and the "loop is too simple to need a framework" design decision |
| **`TanStack Query`** | Still deferred; no backend, no cacheable GETs in v2.1 |
| **Any new UI component library** (Fluent, shadcn, AntD) | Permanently rejected; self-written CSS design system is the v2.0+ standard |
| **`react-virtuoso` / any virtualizer** | Chat history is capped at 20 turns; no virtualization needed |
| **`zustand/middleware` persist** (if using manual storage) | Included in zustand package but unnecessary if manual storage.ts approach chosen — use that instead for partitionKey correctness |

---

## Open Questions (for requirements / spike)

1. **PPT `shape.rotation`:** Confirm this property is writable on Office for Web (latest Edge/Chrome) — GitHub issue #3022 flagged it as missing historically, docs now list it. Spike: set `shape.rotation = 45` and verify no error.
2. **PPT `slide.background` writable API:** Docs show `slide.background` (type `SlideBackground`) but exact writable API for setting solid fill color vs image fill needs spike verification. Likely `slide.background.fill.setSolidColor(color)` but verify.
3. **PPT table (PowerPointApi 1.8):** Verify `slide.shapes.addTable(rowCount, colCount)` is available on Office for Web (Edge/Chrome latest). PowerPointApi 1.8 is a newer requirement set — check `Office.context.requirements.isSetSupported('PowerPointApi', '1.8')` in spike.
4. **Excel pivot table create (ExcelApi 1.8):** `worksheet.pivotTables.add()` exists in the API but creating a pivot programmatically is complex (must configure hierarchies). Confirm this is high enough priority to include in v2.1 triage vs. defer to v2.2.
5. **`paragraph.uniqueLocalId` on Office for Web:** Confirmed to work on web (bug only affects desktop). But verify in spike that `WordApi 1.6` is `isSetSupported` in Office for Web (Edge/Chrome latest).
6. **Chat history ~20-turn context cap:** Confirm whether 20 turns means 20 user messages (20 user + up to 20 assistant = 40 messages) or 20 message-pairs. This affects the slice logic in `loop.ts`. Define precisely in requirements.
7. **User preferences UX:** Feature A preferences — is this a new Settings panel section, or an inline preference chip in the input bar? The storage approach is the same either way, but UI entry point needs spec before implementation.
8. **「本次改动」卡 inline placement:** The current `completedRunIds` approach renders DiffLogPanel after ALL messages at the bottom. Restructuring to inject inline requires knowing the run boundary from the messages array. Confirm the agentRunId is reliably set on all messages in a run (check `loop-helpers.ts` push logic).

---

## Sources

| Source | Confidence | Used for |
|--------|-----------|---------|
| `/Users/wb.chen/Documents/Project/Aster/package.json` | HIGH | Confirmed installed deps (react-markdown, remark-gfm, zustand) |
| `/Users/wb.chen/Documents/Project/Aster/src/components/ChatBubble.tsx` | HIGH | Confirmed react-markdown already wired |
| `/Users/wb.chen/Documents/Project/Aster/src/agent/system-prompt.ts` | HIGH | Existing system prompt architecture |
| `/Users/wb.chen/Documents/Project/Aster/src/lib/storage.ts` | HIGH | Existing storage pattern + partitionKey handling |
| `/Users/wb.chen/Documents/Project/Aster/src/store/chat.ts` | HIGH | Chat store architecture (no persist today) |
| [Microsoft Learn — Excel JavaScript API performance optimization](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/performance) (updated 2025-09-19) | HIGH | Batch write pattern, context.sync recommendations |
| [Microsoft Learn — Work with shapes using the PowerPoint JavaScript API](https://learn.microsoft.com/en-us/office/dev/add-ins/powerpoint/shapes) (updated 2025-05-06) | HIGH | PPT shape add/delete/move/fill/rotation/table APIs |
| [Microsoft Learn — Word.Paragraph class](https://learn.microsoft.com/en-us/javascript/api/word/word.paragraph?view=word-js-preview) | HIGH | `uniqueLocalId` property (WordApi 1.6) |
| [GitHub OfficeDev/office-js Issue #4258 — uniqueLocalId null on desktop](https://github.com/OfficeDev/office-js/issues/4258) | HIGH | Known bug: `uniqueLocalId` returns null on desktop Word |
| [GitHub OfficeDev/office-js Issue #390 — Range disambiguation](https://github.com/OfficeDev/office-js/issues/390) | MEDIUM | Historical context on Word range location limitations |
| [GitHub OfficeDev/office-js Issue #3022 — PPT rotation parity](https://github.com/OfficeDev/office-js/issues/3022) | MEDIUM | Historical gap on PPT shape rotation (flagged as spike needed) |
| [Microsoft Learn — Apply conditional formatting (Excel)](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/excel-add-ins-conditional-formatting) | HIGH | Conditional formatting API availability |
| [Microsoft Learn — Work with PivotTables (Excel)](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/excel-add-ins-pivottables) | HIGH | PivotTable API availability and complexity |
| [Zustand docs — Persisting store data](https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data) | HIGH (official) | persist middleware API, partialize option |
| [skills.sh/daymade ppt-creator](https://www.skills.sh/daymade/claude-code-skills/ppt-creator) | MEDIUM | PPT agent design patterns (Pyramid Principle, assert-style titles, quality gating) |
| [GitHub anthropics/skills — pptx/SKILL.md](https://raw.githubusercontent.com/anthropics/skills/main/skills/pptx/SKILL.md) | HIGH | PPT design patterns (verify-after-create loop, visual completeness rule, anti-patterns) |
| [skills.sh/davila7 excel-analysis](https://www.skills.sh/davila7/claude-code-templates/excel-analysis) | MEDIUM | Excel analysis design patterns (read-first, progressive transform) |
| [skills.sh/shubhamsaboo content-writer](https://www.skills.sh/shubhamsaboo/awesome-llm-apps/content-writer) | MEDIUM | Content writing patterns (active voice, preserve argument structure) |
| [PowerPoint JavaScript API requirement sets](https://learn.microsoft.com/en-us/javascript/api/requirement-sets/powerpoint/powerpoint-api-requirement-sets) | HIGH | Requirement set version verification (1.4/1.6/1.8) |
