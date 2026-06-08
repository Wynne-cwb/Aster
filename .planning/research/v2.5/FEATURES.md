# Feature Research: WPS JSAPI Capability Map (v2.5 滩头堡)

**Domain:** WPS Windows 桌面专业版 JSAPI — per-host capability map for Aster port
**Researched:** 2026-06-08
**Confidence:** MEDIUM (API paths from official docs; real-machine behavior tagged [needs real-machine])
**Builds on:** WPS-01 Report (25-WPS-01-REPORT.md) — does not repeat architecture/compat findings

---

## 1. WPS JSAPI API-Level Working Model

### 1.1 Object Model Shape: VBA-Style Synchronous-Looking, Actually Async IPC

WPS JSAPI runs in a **separate process** from the WPS host (IPC bridge). All property accesses and method calls return Promises and must be `await`ed. The pattern:

```javascript
await instance.ready()
const app = instance.Application   // synchronous-looking but returns proxy
const pres = await app.ActivePresentation  // IPC call → Promise
const slides = await pres.Slides           // IPC call → Promise
const count = await slides.Count           // IPC call → value
```

This is fundamentally different from Office.js `*.run()` + `load()`/`sync()`. There is no batch-load optimization. Each property access is a round-trip IPC call. **Implication for adapter rewrite:** every Aster adapter method needs to be restructured as a sequential async chain rather than a batch-load/sync block.

### 1.2 Host Identification (replaces `Office.onReady` + `Office.context.host`)

In desktop JSAPI add-ins (wpsjs), host type is identified via:

```javascript
const app = wps.WpsApplication()   // or Application global
const hostName = Application.Name
// Returns: "金山文字" | "金山表格" | "金山演示"
```

The three component namespaces:
- **金山演示 (PPT):** `app.ActivePresentation.Slides.*`
- **金山表格 (Excel):** `app.ActiveWorkbook.Sheets.*`
- **金山文字 (Word):** `app.ActiveDocument.*`

This replaces `Office.onReady → info.host → createAdapter(host)` in `src/main.tsx`.

### 1.3 Sync vs Async

All JSAPI operations are async Promises (IPC). There is **no synchronous path** and no equivalent of Office.js's `run()` closure that ensures a single sync context. Each await is a separate IPC round-trip — this matters for performance in write-heavy operations like `applyFormula` across many cells.

### 1.4 Selection Access Pattern

```javascript
// PPT: current slide
const slide = await app.ActivePresentation.SlideShowWindow.View.Slide
const slideId = await slide.SlideID
const slideIndex = await slide.SlideIndex

// Excel: selected range
const sel = await app.ActiveWorkbook.ActiveSheet.UsedRange  // or Selection

// Word: selection
const sel = await app.ActiveDocument.ActiveWindow.Selection
const text = await sel.Text
```

---

## 2. Per-Host Capability Map

### Tags
- **DIRECT** — WPS JSAPI has a near-direct equivalent (same semantics, different syntax)
- **NEEDS-REWORK** — capability exists but requires significant adaptation (different object path, different parameter shape, extra steps)
- **NO-API** — no documented JSAPI equivalent found; [needs real-machine] to confirm absence
- **[needs real-machine]** — WPS-02 must verify before treating as confirmed

---

### 2.1 金山演示 (PPT / KingSoft Presentation)

API access root: `app.ActivePresentation` → `SlideShowWindow.View.Slide` for current slide

| Aster Operation | WPS JSAPI Equivalent | Status | Confidence | Notes |
|----------------|---------------------|--------|------------|-------|
| `list_slides` — get slide count | `app.ActivePresentation.Slides.Count` | **DIRECT** | HIGH | Returns Number. Enumeration requires `Slides.Item(i)` loop (1-based). |
| `get_slide` — read shapes/text | `Slide.Shapes.Item(i).TextFrame.TextRange.Text` | **DIRECT** | MEDIUM | Access chain: `Slides.Item(idx).Shapes.Item(i).TextFrame.TextRange.Text`. Shape type via `.ShapeType`. Position: `.Left/.Top/.Width/.Height`. |
| `getSelection` — selected slide/shape | `app.ActivePresentation.SlideShowWindow.View.Slide` + `.SlideID`/`.SlideIndex` | **DIRECT** | MEDIUM | Current slide selection. Shape selection access path not fully documented — [needs real-machine]. |
| `insertSlideAfter` | `app.ActivePresentation.Slides.AddSlide(Index)` | **DIRECT** | HIGH | `AddSlide(Index, CustomLayout?, LayoutUrl?, LayoutIndex?)`. Index = position to insert after. Blank slide when no layout params. |
| `setShapeText` | `Slide.Shapes.Item(i).TextFrame.TextRange.Text = "..."` | **DIRECT** | MEDIUM | Text assignment via TextRange. Font via `.Font.*`. [needs real-machine] for exact setter pattern in async context. |
| `setShapeProperty` — fill color | `Shape.Fill.ForeColor = '#rrggbb'`; `Shape.Fill.BackColor` | **DIRECT** | MEDIUM | `FillFormat` object has `ForeColor`, `BackColor`, `Transparency`, `Type`. Solid fill via `.Solid` method (documented but not in code example). |
| `setShapeProperty` — alignment | `Shape.TextFrame.TextRange.ParagraphFormat.Alignment` | **NEEDS-REWORK** | LOW | ParagraphFormat.Alignment exists per docs. Exact constant values for left/center/right [needs real-machine]. |
| `move_shape` | `Shape.Left = x; Shape.Top = y` | **DIRECT** | MEDIUM | Position settable. `Shape.Width`, `Shape.Height` also settable. |
| `addImageShape` — insert image | `Slide.Shapes.AddPicture(FileName, LinkToFile, SaveWithDocument, Left, Top, Width, Height, Scale)` | **DIRECT** | MEDIUM | For base64 images: unclear if FileName accepts data URIs — [needs real-machine]. May need to write to WPS FileSystem first. |
| `addTable` | **NO DIRECT `AddTable` on Shapes** — not in documented `Shapes` methods | **NO-API** | MEDIUM | Official `Shapes` docs list: `AddPicture`, `AddTextbox`, `AddMediaObject`, `ReplacePicture`, `Item`. No `AddTable` found. [needs real-machine] to confirm absence; VBA has `Shapes.AddTable(Rows, Cols, Left, Top, Width, Height)`. |
| `addLine` | **NO documented `AddLine`/`AddConnector` on Shapes** | **NO-API** | MEDIUM | Not listed in official Shapes doc. VBA equivalent exists. [needs real-machine] to confirm. |
| `gradient fill` | `Shape.Fill.OneColorGradient(Style, Variant, Degree)` / `TwoColorGradient` / `PresetGradient` | **NEEDS-REWORK** | MEDIUM | Methods documented by name in FillFormat but not shown in code examples on solution.wps.cn. WPS mirrors VBA model — likely exists but [needs real-machine] to confirm parameter acceptance. |
| `deleteSlide` | `app.ActivePresentation.Slides.Item(idx).Delete()` | **DIRECT** | MEDIUM | Slide.Delete() documented. |
| `copy_slide` (D-03 gain) | **NO direct method on Slides or SlideRange** — `Slide.Copy()`/`Duplicate()`/`MoveTo()` documented by name but not in Slides.AddSlide code path | **NEEDS-REWORK** | LOW | WPS-01 noted VBA model supports this. Official Slides API docs (Jun 2025 search) confirm: **no direct `copy_slide` or `Duplicate` method exposed in JSAPI** — only `AddSlide`. Workaround: `AddSlide` + manually copy shapes. [needs real-machine] to attempt `Slide.Copy()` or `Slide.Duplicate()`. |
| `read slide background color` (D-03) | `app.ActivePresentation.SlideMaster.Background.Fill` + `.ForeColor`/`.BackColor`/`.Type` | **NEEDS-REWORK** | MEDIUM | FillFormat.Type + ForeColor accessible via code example in docs. Individual slide background vs master [needs real-machine]. |
| PPT `getImageAsBase64` (D-03) | `app.ActivePresentation.GetActiveShapeImg()` or similar | **NEEDS-REWORK** | LOW | `GetActiveShapeImg()` documented on Presentation object. Whether it returns base64 for the selected image shape [needs real-machine]. |

**PPT Gap Summary:**
- `AddTable`, `AddLine`, `AddConnector` not in official Shapes docs — likely require [needs real-machine] to find or implement as workaround
- `copy_slide` has no clean JSAPI path, needs workaround
- Gradient fill methods exist by name but lack code examples

---

### 2.2 金山表格 (Excel / KingSoft Spreadsheets)

API access root: `app.ActiveWorkbook` → `.ActiveSheet` (or `.Sheets.Item(name)`)

| Aster Operation | WPS JSAPI Equivalent | Status | Confidence | Notes |
|----------------|---------------------|--------|------------|-------|
| `getSelection` | `app.ActiveWorkbook.ActiveSheet.Selection` or `ActiveCell` | **DIRECT** | MEDIUM | Selection object available. Range address via `.Address`. [needs real-machine] for exact property shape. |
| `get_range_values` | `sheet.Range("A1:C3").Value` or `.Value2` | **DIRECT** | HIGH | `Range.Value`, `Range.Value2` documented. `.Formula` also available. |
| `list_worksheets` | `app.ActiveWorkbook.Sheets` → iterate `.Name` per sheet | **DIRECT** | HIGH | `Workbook.Sheets` + `Worksheet.Name`. Count via `.Count`. |
| `setCell` — write cell value | `sheet.Range("A1").Value = val` | **DIRECT** | HIGH | Standard Range.Value assignment. |
| `applyFormula` | `sheet.Range("A1").Formula = "=SUM(B1:B5)"` | **DIRECT** | HIGH | `Range.Formula` writable. |
| `formatExcelRange` — number format | `sheet.Range("A1:B3").NumberFormat = "0.00%"` | **DIRECT** | HIGH | `Range.NumberFormat` documented. |
| `formatExcelRange` — column width | `sheet.Range("A:A").ColumnWidth = 20` | **DIRECT** | HIGH | `Range.ColumnWidth` documented. |
| `sort` | `sheet.Range("A1:D10").Sort(...)` | **DIRECT** | HIGH | `Range.Sort` documented. Exact parameter shape for multi-key sort [needs real-machine]. |
| `filter` | `sheet.Range("A1:D1").AutoFilter(...)` or `sheet.AutoFilter` | **DIRECT** | MEDIUM | `Worksheet.AutoFilter` and `Range.AutoFilter` documented. Filter criteria shape [needs real-machine]. |
| `find/replace` | `sheet.Range("A1:Z100").Find(...)` / `.Replace(...)` | **DIRECT** | HIGH | `Range.Find`, `Range.Replace` documented. |
| `conditional format` | `sheet.Range("A1:A10").ConditionalFormats` | **DIRECT** | MEDIUM | `Range.ConditionalFormats` documented. Add/format type API [needs real-machine]. |
| `createTable` | `sheet.ListObjects.Add(...)` | **DIRECT** | MEDIUM | `Worksheet.ListObjects` documented. `.Add()` for creating tables. Exact parameter shape [needs real-machine]. |
| `freeze panes` | `sheet.FreezePanes` | **DIRECT** | MEDIUM | `Worksheet.FreezePanes` documented (boolean or cell reference). Exact setter API [needs real-machine]. |
| `mergeCells` | `sheet.Range("A1:B2").Merge()` | **DIRECT** | HIGH | `Range.Merge`, `Range.UnMerge`, `Range.MergeCells` all documented. |
| `removeDuplicates` | `sheet.Range("A1:D100").RemoveDuplicates(...)` | **DIRECT** | HIGH | `Range.RemoveDuplicates` explicitly documented. |
| `pivotTable` (D-03 gain) | `sheet.PivotTables` collection → `.Add(...)` | **NEEDS-REWORK** | MEDIUM | `Worksheet.PivotTables` documented. WPS-01 notes WPS 表格 JSAPI has explicit PivotTable support (bbs.wps.cn/topic/40878). Exact `Add(source, dest, name)` signature [needs real-machine]. |

**Excel Gap Summary:** Excel is the strongest host — nearly all operations have DIRECT equivalents. PivotTable is the one area requiring real-machine validation for exact API shape.

---

### 2.3 金山文字 (Word / KingSoft Writer)

API access root: `app.ActiveDocument` + `app.ActiveDocument.ActiveWindow.Selection`

| Aster Operation | WPS JSAPI Equivalent | Status | Confidence | Notes |
|----------------|---------------------|--------|------------|-------|
| `getSelection` | `app.ActiveDocument.ActiveWindow.Selection` → `.Text`, `.Start`, `.End` | **DIRECT** | MEDIUM | Selection object documented with Text, Start, End properties. |
| `read paragraphs` | `app.ActiveDocument.Paragraphs` → iterate `.Item(i).Range.Text` | **DIRECT** | MEDIUM | Paragraphs collection documented: Count, Item, Add, First, Last, Range, Style. |
| `appendParagraph` | `sel.TypeText("...")` + `sel.TypeParagraph()` OR `doc.Paragraphs.Add()` | **DIRECT** | MEDIUM | Selection.TypeText + TypeParagraph documented. InsertParagraphAfter also available. |
| `replaceParagraphAt` | `doc.Paragraphs.Item(idx).Range.Text = "..."` | **NEEDS-REWORK** | MEDIUM | Paragraph.Range.Text assignment — [needs real-machine] to confirm setter semantics (VBA-style assignment may work). |
| `setCharacterFormat` — font/bold/italic | `Selection.Font.Bold = true` / `.Size = 14` / `.Color = '#rrggbb'` | **DIRECT** | MEDIUM | Font object accessible via Selection.Font. Exact property names [needs real-machine]. |
| `setParagraphFormat` — alignment/spacing | `para.ParagraphFormat.Alignment = ...` / `.SpaceBefore = ...` | **DIRECT** | MEDIUM | ParagraphFormat documented with Alignment, SpaceBefore, SpaceAfter, LeftIndent. |
| `applyStyle` | `para.Style = "Heading 1"` or style name | **DIRECT** | MEDIUM | Paragraph.Style settable. WPS style names in Chinese locale (e.g. "标题 1") vs English — [needs real-machine]. |
| `find/replace` | `doc.Content.Find.Execute(...)` or `Selection.Find` | **DIRECT** | MEDIUM | Find object: Text, Replacement, Forward, MatchCase, MatchWholeWord, Wrap, Execute documented. |
| `insertTable` | `doc.Tables.Add(Range, NumRows, NumCols)` or `Selection`-based | **DIRECT** | MEDIUM | Tables collection documented. Add method signature [needs real-machine]. |
| `highlight` | `Selection.Font.Highlight = true` (or color enum) | **NEEDS-REWORK** | LOW | Highlight is a Font property in VBA. WPS JSAPI Font object properties [needs real-machine] — not in documented list seen. |
| `lists` — bullet/numbered | `para.ListFormat` → `.ApplyListTemplate(...)` | **NEEDS-REWORK** | LOW | ListFormat documented on Paragraphs. Exact method to apply list style [needs real-machine]. Word Online had lists API issues (#6525) — WPS may differ. |
| `insertComment` | `doc.Comments.Add(Range, Text)` | **DIRECT** | MEDIUM | Comments.Add documented. Author, Range, Text properties on Comment object. |
| `header/footer` | `doc.Sections.Item(1).Headers` / `.Footers` → access Range → TypeText | **NEEDS-REWORK** | MEDIUM | HeadersFooters on Document documented. Exact write path [needs real-machine]. |
| `table cell edit` | `doc.Tables.Item(i).Cell(row, col).Range.Text = "..."` | **DIRECT** | MEDIUM | Table.Cell(row, col) documented. Range.Text on Cell. |
| `Word PageSetup margins` (D-03 gain) | `doc.PageSetup.TopMargin = 72` / `.BottomMargin` / `.LeftMargin` / `.RightMargin` | **DIRECT** | HIGH | PageSetup documented: TopMargin, BottomMargin, LeftMargin, RightMargin, PaperSize, Orientation, PageWidth, PageHeight. **This is a genuine D-03 gain — Office for Web cannot do this.** |

**Word Gap Summary:** Most operations have paths. The weakest areas are `highlight` and `lists` — both were problematic in Office.js too. `insertComment` path looks clean. PageSetup is a confirmed D-03 gain.

---

## 3. UNDO Strategy — Critical Architecture Decision

### 3.1 Verdict: JSAPI Operations Do NOT Enter WPS Native Undo Stack

**CONFIRMED (multiple sources, HIGH confidence):**

1. WPS community explicitly documents: *"我们在用wpsjs-api操作表格的时候，WPS自带的撤销恢复按钮并不会有记录"* — JSAPI writes do not appear in WPS native Ctrl+Z undo stack. (Source: bbs.wps.cn community report, WPS-01 followup search)

2. `Workbook.ClearTransactions()` and `HasTransactions()` are documented but **no `Application.Undo()` or `Workbook.Undo()` method exists** in the WPS JSAPI. (Source: solution.wps.cn/docs/client/api/Excel/Workbook.html — complete method list confirmed)

3. For Word (`ActiveDocument.Undo`): also not found in any official documentation or community search. The WPS WebOffice SDK page for Document lists `Undo` as a method name in passing, but no method signature or code example is available — [needs real-machine] but likely the same limitation.

4. Root cause: WPS JSAPI runs out-of-process via IPC. The JS layer cannot directly manipulate the WPS native undo history stack. This is architectural, not a gap in a specific version.

### 3.2 Implication for Aster

**Aster's `operationLog` inverse engine MUST be ported, not replaced.**

- The native undo stack is not a viable substitute because JSAPI writes don't enter it.
- Aster's existing model (snapshot/inverse ops stored in `operationLog`, replayed on "undo all") is exactly the right architecture for WPS.
- Each WPS adapter method needs:
  - A **write path** (WPS JSAPI call)
  - An **inverse method** that reverses the effect using WPS JSAPI (read current state → store as snapshot → write previous state on inverse)
- The `operationLog.integration.test` gate pattern should be reproduced for WPS adapter methods.

### 3.3 WPS-Specific Undo Constraints

| Constraint | Impact |
|-----------|--------|
| No `Application.Undo()` | Cannot use single-step native undo as fallback |
| `Workbook.ClearTransactions()` exists | Can be called after a write to prevent user confusion (Ctrl+Z would show no native undo anyway) — optional housekeeping |
| `HasTransactions()` exists | Could be used as a write-completion signal (if has transactions → write landed) — LOW reliability |
| Batch undo via `undoRecord` | **Known bug as of 2025-11-25**: `undoRecord` returns empty — confirmed by WPS staff response on bbs.wps.cn. Do NOT rely on this. |

### 3.4 Recommendation

Port `operationLog` inverse engine as-is. For WPS adapters, implement inverse methods using the same contract (Record object signature, not positional params — the Phase 5 lesson). Do NOT attempt to use WPS native undo. Mark `[needs real-machine]` on which inverse operations are cleanest to implement first (snapshot-restore being simplest for the beachhead).

---

## 4. D-03 Desktop-Only Gains — WPS-02 Checklist

Each item below maps directly to a WPS-02 checklist probe item:

| D-03 Gain | API Path (WPS JSAPI) | Aster Value | WPS-02 Probe | Confidence |
|-----------|---------------------|-------------|--------------|------------|
| **Word PageSetup margins/paper** | `doc.PageSetup.TopMargin/BottomMargin/LeftMargin/RightMargin/PaperSize/Orientation` | HIGH — blocked by Office for Web | Probe 3-4: set margin, verify change | HIGH (documented) |
| **PPT read slide background color** | `SlideMaster.Background.Fill.ForeColor` / individual slide `.Background.Fill` | MEDIUM | Probe 3-2: read current BG color | MEDIUM |
| **Excel PivotTable** | `sheet.PivotTables.Add(source, dest, name)` → field assignment | HIGH — v2.4 had API risk on Office for Web | Probe 3-5: create pivot table via API | MEDIUM |
| **PPT AddTable** | `Shapes.AddTable(...)` — not in official docs, must probe | MEDIUM | Probe 3-6: attempt AddTable call | LOW (not documented) |
| **PPT AddLine/AddConnector** | `Shapes.AddLine(...)` / `Shapes.AddConnector(...)` — not in official docs | MEDIUM | Probe 3-7: attempt AddLine call | LOW (not documented) |
| **PPT gradient fill** | `Shape.Fill.OneColorGradient(Style, Variant, Degree)` / `TwoColorGradient` | MEDIUM — v2.4 degraded to solid | Probe 3-8: apply gradient, verify render | MEDIUM |
| **PPT copy_slide** | `Slide.Duplicate()` or `Slide.Copy()` — not confirmed in JSAPI | HIGH — blocked by Office for Web | Probe 3-1: attempt Slide.Duplicate | LOW |
| **PPT take image as base64** | `app.ActivePresentation.GetActiveShapeImg()` | MEDIUM | Probe 3-3: select image shape, call GetActiveShapeImg | LOW-MEDIUM |
| **PPT SmartArt/animation/transition** | VBA model supports; WPS JSAPI subset unknown | LOW for v2.5 beachhead | Probe 3-9 (optional) | LOW |

**Key D-03 insight:** Word PageSetup is the most confidently available gain (documented API, no caveats). Excel PivotTable is next (documented PivotTables collection). PPT gains (AddTable, AddLine, copy_slide) are all [needs real-machine] — the official Shapes docs don't list these methods, suggesting they may be undocumented or require a different access pattern.

---

## 5. First-Host Beachhead Recommendation

### 5.1 Recommendation: START WITH EXCEL (金山表格)

**Rationale:**

| Criterion | PPT | Excel | Word |
|-----------|-----|-------|------|
| JSAPI API coverage (Aster ops) | MEDIUM — 4 operations unconfirmed (AddTable/AddLine/gradient/copy_slide) | HIGH — all core ops have documented paths | MEDIUM — highlight/lists weak |
| Critical uncertainties | AddTable/AddLine not in docs (high risk) | Only PivotTable signature TBD (low risk) | Style names in ZH locale, highlight/lists risky |
| Inverse/undo complexity | MEDIUM (snapshot-restore viable) | LOW (Range.Value = snapshot → restore) | MEDIUM (paragraph range restore) |
| D-03 upside | Moderate (gradient, copy_slide uncertain) | High (PivotTable confirmed in docs) | High (PageSetup confirmed) |
| Beachhead tool scope | 14 operations, 4 unconfirmed | 15 operations, 1 needs-real-machine | 15 operations, 3 weak |
| Chinese workplace value | PPT = high visibility but risky | Excel = highest daily-use frequency | Word = high but PageSetup is edge case |

**Excel wins on:** fewest unconfirmed API gaps, clearest inverse paths (Range.Value snapshot is trivial), highest documentation confidence, most operations fully DIRECT. The single unknown (PivotTable.Add signature) is low-risk because the object exists and is documented — it's just a parameter question.

**PPT risks the beachhead on:** `AddTable` and `AddLine` are not in the official `Shapes` documentation at all. If these don't exist in the JSAPI, two of Aster's v2.4 new PPT tools are dead on arrival. These should be WPS-02 probes, not assumptions.

**Word risks the beachhead on:** Chinese locale style names (the `applyStyle` path that uses "Heading 1" would need to become "标题 1"), and the `highlight` / `lists` operations that were already troubled in Office.js are high-risk rewrites.

### 5.2 Beachhead Scope for Excel

Based on the capability map, the Excel beachhead can deliver these operations with HIGH confidence:

**Phase 1 (certain — all DIRECT):**
- `getSelection`, `get_range_values`, `list_worksheets`
- `setCell`, `applyFormula`
- `formatExcelRange` (number format + column width)
- `find/replace`
- `mergeCells` / `removeDuplicates`

**Phase 2 (verify pattern first, then implement):**
- `sort`, `filter`, `conditional format`, `createTable`, `freeze panes`
- `pivotTable` (after WPS-02 confirms PivotTable.Add signature)

**Undo inverse coverage:** All Excel inverses are snapshot-restore (`Range.Value` read → save → restore), which is the simplest inverse category. No operation-specific inverse logic needed for Phase 1.

---

## 6. Feature Prioritization for Beachhead

### Table Stakes (beachhead must have)

| Feature | Why Essential | Complexity | Notes |
|---------|--------------|------------|-------|
| `wpsjs` shell (ribbon.xml + publish.xml) | Entry point — nothing works without it | LOW | wpsjs CLI scaffold, replaces manifest.xml |
| Host identification via `Application.Name` | Gates which adapter loads | LOW | Replaces Office.onReady + Office.context.host |
| CEF localStorage persistence | Key storage, chat history — core to UX | LOW | Already has undefined-partitionKey fallback in storage.ts |
| SSE direct-connect (fetch + ReadableStream) | Core AI capability — no backend fallback | MEDIUM | WPS-02 must confirm CSP doesn't block |
| React 19 UI in CEF | Chat panel, all existing UI | LOW | CEF = Chromium, high confidence |
| operationLog inverse engine (WPS port) | Undo-all — hardcoded into Aster's UX contract | HIGH | No native undo available |
| Excel adapter read ops | Agent needs document context | MEDIUM | DIRECT API paths |
| Excel adapter write ops | Agent must be able to act | MEDIUM | DIRECT API paths |

### Differentiators (beachhead should have, after stakes)

| Feature | Value | Complexity | Notes |
|---------|-------|------------|-------|
| PivotTable creation via WPS JSAPI | D-03 gain — unblocks high-demand Excel task | MEDIUM | Need WPS-02 confirm first |
| Word PageSetup margins | D-03 gain — Office for Web can't do this | LOW-MEDIUM | API documented with confidence |
| PPT gradient fill | Unblocks v2.4 workaround | MEDIUM | [needs real-machine] |

### Anti-Features

| Feature | Why Avoid | Alternative |
|---------|-----------|------------|
| Relying on WPS native Ctrl+Z undo | JSAPI writes don't enter native undo stack — confirmed | Port operationLog inverse engine |
| `AddTable`/`AddLine` in PPT without WPS-02 probe | Not in official Shapes docs — building on unconfirmed API wastes sprint | Probe in WPS-02 first, defer PPT beachhead |
| `undoRecord` batch undo API | Known bug as of 2025-11-25 (WPS staff confirmed empty) | Custom operationLog |
| Three-host simultaneous beachhead | Triples risk and scope — any host failure blocks milestone | Single-host (Excel) first, expand after WPS-02 |
| COM add-in for undo integration | Requires C#/.NET, breaks web-only architecture | operationLog inverse in JSAPI layer |

---

## 7. Feature Dependencies

```
WPS-02 real-machine verification (CEF/CORS/localStorage green)
    └──gates──> wpsjs shell build
                    └──gates──> host identification
                                    └──gates──> Excel adapter (read)
                                                    └──gates──> Excel adapter (write)
                                                                    └──gates──> operationLog inverse (Excel)
                                                                                    └──gates──> agent loop in CEF

WPS-02 PivotTable.Add probe (3-5)
    └──gates──> Excel PivotTable write tool

WPS-02 probe 3-6/3-7 (AddTable/AddLine in PPT)
    └──gates──> PPT beachhead scope decision

WPS-02 probe 3-4 (Word PageSetup)
    └──gates──> Word PageSetup as D-03 gain
```

### Dependency Notes

- **CEF/CORS requires WPS-02 first:** If `fetch` to DeepSeek is blocked by WPS container CSP, the entire no-backend value proposition fails in WPS. This is the highest-priority WPS-02 probe (§5 1-2 in WPS-01 report).
- **operationLog requires adapter:** The inverse engine can't be tested without working write ops to invert.
- **PPT beachhead deferred from Excel:** PPT Shapes API has too many undocumented operations (AddTable/AddLine) to commit to before WPS-02.

---

## 8. MVP Definition

### Beachhead Launch (v2.5 target — Excel only)

- [ ] WPS-02 go/no-go green (CEF, CORS, localStorage, 3 hosts read/write basic)
- [ ] `wpsjs` shell: ribbon.xml + publish.xml + wpsjs CLI build
- [ ] Host identification (`Application.Name` → `createWpsAdapter(host)`)
- [ ] Excel adapter: all Phase 1 DIRECT operations (read + write)
- [ ] operationLog inverse engine ported (Excel range snapshot-restore)
- [ ] React UI + SSE streaming confirmed working in CEF
- [ ] localStorage Key persistence confirmed working in CEF

### Add After Beachhead Validates (v2.5 follow-on or WPS-D1)

- [ ] Excel Phase 2 ops (sort/filter/conditional format/createTable/freeze/pivot)
- [ ] Word adapter (PageSetup D-03 gain motivates this second)
- [ ] PPT adapter (only after WPS-02 confirms AddTable/AddLine existence)

### Future (WPS-D1 full milestone)

- [ ] Three-host parity with Office for Web
- [ ] D-03 gains: PPT copy_slide, PPT take image, PPT SmartArt/animation
- [ ] wpsjs publish pipeline for users (replace GitHub Pages manifest sideload)

---

## Sources

**WPS Official API Docs (solution.wps.cn — MEDIUM confidence, async behavior unconfirmed)**
- [PPT Slides collection](https://solution.wps.cn/docs/client/api/PPT/Slides.html)
- [PPT Shapes collection](https://solution.wps.cn/docs/client/api/PPT/Shapes.html)
- [PPT Slide object](https://solution.wps.cn/docs/client/api/PPT/Slide.html)
- [PPT FillFormat object](https://solution.wps.cn/docs/client/api/PPT/FillFormat.html)
- [PPT TextFrame object](https://solution.wps.cn/docs/client/api/PPT/TextFrame.html)
- [ET Worksheet object](https://solution.wps.cn/docs/client/api/ET/Worksheet.html)
- [ET Range object](https://solution.wps.cn/docs/client/api/ET/Range.html)
- [ET Workbook object](https://solution.wps.cn/docs/client/api/ET/Workbook.html)
- [WPS Word Selection object](https://solution.wps.cn/docs/client/api/WPS/Selection.html)
- [WPS Word Document object](https://solution.wps.cn/docs/client/api/WPS/Document.html)
- [WPS Word Paragraphs object](https://solution.wps.cn/docs/client/api/WPS/Paragraphs.html)
- [WPS Word Find object](https://solution.wps.cn/docs/client/api/WPS/Find.html)
- [WPS Word Table object](https://solution.wps.cn/docs/client/api/WPS/Table.html)
- [WPS Word PageSetup object](https://solution.wps.cn/docs/client/api/WPS/PageSetup.html)
- [WPS Word Comments object](https://solution.wps.cn/docs/client/api/WPS/Comments.html)

**WPS Community / Developer Evidence**
- [WPS 表格 JSAPI 帮助更新 (bbs.wps.cn/topic/40878)](https://bbs.wps.cn/topic/40878) — PivotTable confirmed in 表格 JSAPI
- [WPS 加载项话题 (bbs.wps.cn)](https://bbs.wps.cn/topics/tag/1970?sort=hot) — undoRecord bug, JSAPI ops not in undo stack
- [WPS 加载项开发详解 (CSDN)](https://blog.csdn.net/wpsdev/article/details/124707775) — out-of-process IPC model
- [wps.WpsApplication() host identification (bbs community)](https://bbs.wps.cn/topics/tag/10158)

**Built on WPS-01 Report**
- [25-WPS-01-REPORT.md](.planning/phases/25-wps-spike-gate/25-WPS-01-REPORT.md) — architecture findings, sideload mechanism, compatibility matrix

---
*Feature research for: Aster v2.5 WPS 滩头堡 — WPS JSAPI capability map*
*Researched: 2026-06-08*
