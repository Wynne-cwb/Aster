# Features Research — Aster v2.1「从能用到好用」

**Domain:** Office.js AI Agent Add-in — capability deepening + polish milestone
**Researched:** 2026-05-30
**Context:** v2.0 already ships multi-step agent loop, 11 read tools, write tools
(insert_slide / set_shape_property / move_shape / set_shape_text / set_range_values /
apply_formula / insert_chart / set_cell / append_paragraph / insert_paragraph /
replace_paragraph / insert_text_at_cursor / replace_selection), teal design system,
DiffLog + Undo All.

---

## Summary

v2.1 is a "polish and deepen" milestone on top of a functioning agent. The six feature
areas (A–F) form a coherent arc: make the agent *smarter* (A), *capable of more* (B),
*faster* (C), *more precise* (D), *feel better* (E), and *remember across sessions* (F).

The most critical decision is the B triage. Research confirms that Office.js supports
the vast majority of candidate write APIs (all font/paragraph/style for Word via
WordApi 1.1-1.6; all Excel format/sort/filter/pivot/conditional-format via ExcelApi
1.2-1.9; PPT shapes/textbox/background via PowerPointApi 1.4-1.10). The three
legitimate platform blockers from todos.md (animation/transition/SmartArt/theme) are
confirmed unsupported by official API docs. The strategic triage principle for B:
"does a Chinese 职场白领 hit this every week?" — if yes, it is table-stakes.

Key insight from WPS AI / Copilot research: Chinese office users treat AI tools as
automation for *repetitive formatting and data cleaning* above all else. Financial
analysts (数字格式 + 条件格式 + 透视表), HR (Word 批量格式化), 市场/运营 (PPT 排版美化)
are the primary personas. "好用" concretely means: the agent can do a full formatting
pass in one go, not issue 30 individual tool calls.

---

## A 能力变聪明 — Per-Host System Prompts + Skills Design + 偏好注入

### Table-Stakes (must have in v2.1)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-host system prompt enrichment | v2.0 already has per-host domain segment but density is low (6 lines per host); LLM does not know when to use set_shape_text vs insert_slide in PPT, or how to chunk-read a large table in Excel | Low | Hard-code into getDomainSegment() in system-prompt.ts; zero bundle overhead (D-09 principle already established) |
| 用户自定义偏好注入 prompt | Users repeatedly type "我是财务，数字格式用 #,##0.00，颜色用公司蓝 #1F4E79" every session; this is friction that compounds | Low-Med | Settings panel new "偏好文本框"; persist to localStorage; append to buildSystemPrompt() output |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| 深化 per-host 角色设定（persona） | PPT agent knows "标题用断言式 + 每页 ≤5 点"; Excel agent knows "先 get_used_range_summary 再分块读"; Word agent knows "润色不增删论点" | Low | Translate Skills design patterns directly into getDomainSegment(); no dynamic loading system (D-09 reuse) |
| Skills 设计模式参考 | pptx SKILL "read→edit→verify 三步分离" + Excel skill "pipeline 视角 Read→Analyze→Format→Output" translate directly into system prompt guidance | Low | Pure prompt engineering, no new API |

### Anti-Features (不做)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| 动态可加载 Skill 文件系统 | D-09 explicit decision: bundle budget is tight; dynamic JSON skill loading adds network requests + complexity; conflicts with "zero dependency" principle | Hard-code domain knowledge into getDomainSegment() |
| Per-host prompt longer than 20 lines | Token waste (system prompt sent on every API call); too-long prompt dilutes task instructions | Keep 6-10 lines of high-density domain guidance using declarative sentences not explanatory ones |
| Expose system prompt to user for editing | Leaks "underlying complexity" to non-technical users; most will not know what to change | Expose only the "偏好文本框" abstraction |

### Skills Design Key Findings

Extracted from anthropics/skills pptx SKILL and excel-analysis skill — directly applicable to v2.1 per-host prompt enrichment:

**PPT domain — add to getDomainSegment('ppt'):**
1. Read-first: list_slides + list_shapes before acting (v2.0 has this; needs strengthening)
2. Embed design constraints: assertion-style titles ("华东 Q3 超目标 15%") not topic-style ("华东"); 3-5 bullets per slide max
3. Color semantic naming: think in semantic color names ("主题蓝") not just hex; helps LLM understand design intent
4. Verification mindset: check mutated field after set_shape_text; do not assume success

**Excel domain — add to getDomainSegment('excel'):**
1. Pipeline thinking: Read → Analyze → Transform → Format as four distinct steps, not mixed
2. Data quality first: dedup + type check before writing back
3. Formatting is part of delivery: insight + chart + formatting together, not "data first then format later"
4. Chunked reading enforcement: >1000 rows must chunk; prevents OOM

**Word domain — add to getDomainSegment('word'):**
1. content-writer mode: preserving intent = changing language style not arguments; no silent deletion
2. Tone awareness: recognize 正式/口语/学术 three registers; avoid defaulting to English-AI register
3. Structure-driven: get_document_outline first before operating; do not blindly start from paragraph 0

**Microsoft Copilot Agent Mode comparison (launched as "vibe working" 2026-05-28):**
- Each host has its own agent persona (Word Agent / Excel Agent / PowerPoint Agent)
- Each agent has a scoped capability set (Word: writing/polishing/summarizing; Excel: formulas/analysis/charts; PPT: creating/beautifying/reordering)
- Aster's differentiation: BYO Key + per-host persona driven by user-custom preferences, not Microsoft-fixed defaults

---

## B 能力补全 — THE TRIAGE: Office.js Write Tool 三宿主完整评估

### Overall Triage Principles

1. **Weekly operation (职场白领 does this every week) → v2.1 must-do**
2. **Monthly operation (a few times per month) → v2.1 low-priority, defer to v2.2 or later**
3. **Platform unsupported → flag and never do**
4. **High inverse/undo complexity → note in complexity column**

Complexity dimensions:
- **L (Low)** = adapter method ≤30 lines, inverse has clear before-image strategy
- **M (Medium)** = adapter method 30-80 lines, inverse needs reading complex structure for before-image
- **H (High)** = adapter method >80 lines, or inverse is unreliable, or API needs spike validation

---

### B.1 Word — v2.1 Shortlist (DO NOW)

#### Font / Character Format (range.font — WordApi 1.1, HIGH confidence)

| Tool | Frequency | Complexity | Depends on v2.0 | Notes |
|------|-----------|------------|-----------------|-------|
| `set_font_bold` | Daily | L | replace_paragraph font subset | Most frequent character operation; required for HR/reports/presentation titles |
| `set_font_italic` | Weekly | L | same | Quote/emphasis standard |
| `set_font_size` | Weekly | L | same | Adjusting heading size is basic |
| `set_font_color` | Weekly | L | same | Color emphasis is a standard职场 doc feature |
| `set_font_underline` | Weekly | L | same | High frequency in contracts/legal docs; includes UnderlineType enum |
| `set_font_name` | Weekly | L | same | Chinese font switching (微软雅黑/宋体) is common |
| `set_font_highlight` | Monthly | L | same | **Defer to v2.2** — highlighting is primarily used in review workflows |

#### Paragraph Format (paragraph / paragraphFormat — WordApi 1.1+)

| Tool | Frequency | Complexity | Depends on v2.0 | Notes |
|------|-----------|------------|-----------------|-------|
| `set_paragraph_alignment` | Daily | L | replace_paragraph | **User-named pain point**; center/left/right/justify is the highest-frequency format operation in职场 docs |
| `set_line_spacing` | Weekly | M | — | Line spacing is core to formatting documents; inverse reads lineSpacing before-image |
| `set_paragraph_spacing` | Monthly | M | — | Before/after spacing used in formatted corporate docs; inverse same |
| `set_paragraph_indent` | Monthly | M | — | 首行缩进 2 字 is the Chinese formatting standard |
| `set_paragraph_keep` | Rare | M | — | **Defer** — keepWithNext is a typographic detail; ordinary职场 users rarely touch it |

#### Styles (styleBuiltIn — WordApi 1.3+)

| Tool | Frequency | Complexity | Depends on v2.0 | Notes |
|------|-----------|------------|-----------------|-------|
| `apply_paragraph_style` | Daily | L | replace_paragraph | **User-named pain point**; Heading1-9/Normal/Quote = essential for structured职场 docs; inverse = restore_style (before-image reads styleBuiltIn) |
| `apply_named_style` | Monthly | M | — | **Defer** — named custom styles are mostly in enterprise templates; ordinary users rarely have them |
| `modify_named_style` | Very rare | H | — | **Defer** — modifying style attributes affects the whole document; inverse is complex; ordinary users never do this |

#### Structure and Objects

| Tool | Frequency | Complexity | Depends on v2.0 | Notes |
|------|-----------|------------|-----------------|-------|
| `find_and_replace` | Daily | M | — | Global find-replace is the most basic document operation; body.search + insertText; inverse = reverse replacement (record old text) |
| `insert_table` | Weekly | M | — | 职场 docs (reports/proposals) almost always have tables; body.insertTable; inverse = delete table by ID |
| `insert_hyperlink` | Monthly | L | — | Compliance/reference links; range.hyperlink assignment; inverse = clear hyperlink |
| `insert_break` | Monthly | L | — | Page break is essential for long documents; inverse = delete break in same range |
| `insert_comment` | Monthly | M | — | Insert comment for review workflow; range.insertComment; inverse = delete comment by ID |
| `insert_image` | Monthly | H | FUT-15 foundation | **Defer** — insertInlinePictureFromBase64 requires base64 data source; coupled with FUT-15 file upload; do together in v2.2 |
| `edit_table` | Monthly | H | insert_table | **Defer** — table editing API is complex (row/col add/delete/merge/style); inverse is difficult |
| `set_header_footer` | Low | M | — | **Defer** — header/footer are document-level one-time operations, not everyday chat requests |
| `toggle_track_changes` | Very rare | H | — | **Defer** — track changes API has known bug (search failure issue #5874); inverse semantics unclear |
| `set_font_super_subscript` | Very rare | L | — | **Defer** — superscript/subscript mainly for academic/math docs; rare in职场 |
| `set_font_strikethrough` | Low | L | — | **Defer** — strikethrough mainly for version annotations; track changes is more appropriate |

**Word v2.1 shortlist (11 tools):**
`set_font_bold` / `set_font_italic` / `set_font_size` / `set_font_color` / `set_font_underline` /
`set_font_name` / `set_paragraph_alignment` / `set_line_spacing` / `apply_paragraph_style` /
`find_and_replace` / `insert_table`

---

### B.2 Excel — v2.1 Shortlist (DO NOW)

#### Cell Format (range.format — ExcelApi 1.1+, HIGH confidence)

| Tool | Frequency | Complexity | Depends on v2.0 | Notes |
|------|-----------|------------|-----------------|-------|
| `set_number_format` | Daily | L | set_range_values | **Highest frequency for finance/data analysts**; currency/percentage/date/thousands-separator; numberFormat can be batched with values in same range; inverse = read before numberFormat |
| `set_cell_font` | Weekly | L | same | Bold/colored table headers are standard in data reports; range.format.font sets multiple attributes at once |
| `set_cell_fill` | Weekly | L | same | Background color highlight is the most basic Excel beautification; inverse = read before fill.color |
| `set_cell_borders` | Weekly | M | same | Table borders are almost mandatory in reports; borders API requires specifying side (top/bottom/left/right/all); inverse reads each side |
| `set_cell_alignment` | Weekly | L | same | Horizontal/vertical alignment + wrapText; right-aligning financial numbers is standard |
| `set_column_row_size` | Weekly | L | — | autofitColumns is the first step after data cleanup; inverse = record before width |
| `merge_cells` | Monthly | M | — | Merging header cells is common; inverse needs to record mergeArea + original values of each cell |

#### Data Operations (ExcelApi 1.2+, HIGH confidence)

| Tool | Frequency | Complexity | Depends on v2.0 | Notes |
|------|-----------|------------|-----------------|-------|
| `sort_range` | Daily | M | — | **Sorting is one of Excel's most frequent operations**; range.sort.apply; inverse = record before row order (restore via set_range_values); complexity M |
| `apply_filter` | Weekly | M | — | AutoFilter is a data analysis staple; worksheet.autoFilter; inverse = clearAutoFilter |
| `find_and_replace_excel` | Weekly | M | — | Bulk replace data values; range/worksheet.replace; inverse = reverse replace |
| `clear_range` | Monthly | L | set_range_values | Clear content/format; inverse = save before-image then set_range_values to restore |
| `remove_duplicates` | Monthly | M | — | Essential for data cleaning; range.removeDuplicates; inverse is difficult (data is gone); must take before-image snapshot of whole range first |
| `insert_delete_cells` | Monthly | M | — | Insert/delete rows or columns; inverse must record direction and count |

#### Structure Objects (ExcelApi 1.2-1.9)

| Tool | Frequency | Complexity | Depends on v2.0 | Notes |
|------|-----------|------------|-----------------|-------|
| `add_conditional_format` | Weekly | M | — | **Essential for data analysis/finance**; color scale/highlight rules; ExcelApi 1.6+; inverse = clear conditionalFormat by ID |
| `create_table` | Weekly | M | — | Convert range to Table object (with filter/total row); ExcelApi 1.1+; inverse = delete table by name |
| `freeze_panes` | Monthly | L | — | Freezing the first row is essential for viewing large datasets; ExcelApi 1.2+; inverse = unfreeze |
| `add_worksheet` | Monthly | L | — | Add new sheet; inverse = delete by name |
| `rename_worksheet` | Monthly | L | — | Rename; inverse = rename back to original name |
| `define_named_range` | Monthly | M | — | **Defer** — named ranges primarily serve complex formula references; rare for ordinary职场 users |
| `add_data_validation` | Monthly | M | — | **Defer** — dropdown validation is useful for template creation but not daily operation |
| `create_pivot_table` | Monthly | H | — | **Core for financial analysis** but API is complex (multi-step PivotTable configuration); inverse is difficult; recommend v2.1 simplified version (group by single column, sum only) |
| `delete_worksheet` | Monthly | L | — | **Defer** — deletion is destructive; risky for agent to do autonomously |
| `set_sheet_tab_color` | Very rare | L | — | **Defer** — purely decorative, no functional impact |

#### Chart Deepening

| Tool | Frequency | Complexity | Depends on v2.0 | Notes |
|------|-----------|------------|-----------------|-------|
| `set_chart_title` | Monthly | L | insert_chart | Current insert_chart creates titleless charts which is a pain point |
| `change_chart_type` | Monthly | M | insert_chart | "Change bar chart to line chart" is a common request |
| `set_chart_axes` | Monthly | M | insert_chart | **Defer** |
| `set_chart_legend` | Monthly | L | insert_chart | **Defer** |
| `set_chart_series_color` | Monthly | M | insert_chart | **Defer** |

**Excel v2.1 shortlist (15 tools):**
`set_number_format` / `set_cell_font` / `set_cell_fill` / `set_cell_borders` /
`set_cell_alignment` / `set_column_row_size` / `sort_range` / `apply_filter` /
`find_and_replace_excel` / `add_conditional_format` / `create_table` / `freeze_panes` /
`add_worksheet` / `rename_worksheet` / `set_chart_title`

---

### B.3 PPT — v2.1 Shortlist (DO NOW)

#### Shape Text Format (textFrame.textRange.font — PowerPointApi 1.4+)

| Tool | Frequency | Complexity | Depends on v2.0 | Notes |
|------|-----------|------------|-----------------|-------|
| `set_shape_text_font` | Weekly | M | set_shape_text | Set font/size/color/bold/italic in one call; v2.0 can only change text content; inverse needs font before-image |
| `set_shape_text_alignment` | Monthly | M | set_shape_text | PPT API paragraph alignment support is limited (ParagraphHorizontalAlignment needs testing); marked MEDIUM-risk; spike required |

#### Shape Operations (PowerPointApi 1.4+, HIGH confidence)

| Tool | Frequency | Complexity | Depends on v2.0 | Notes |
|------|-----------|------------|-----------------|-------|
| `add_shape` | Weekly | M | — | addGeometricShape; creating rectangles/circles/arrows is common for PPT layouts; inverse = delete_shape by ID; watch out for blank slide bug (existing insert_slide guarantees content is present) |
| `add_text_box` | Weekly | M | — | addTextBox; free-form text boxes are essential for PPT creation; inverse = delete by ID |
| `delete_shape` | Weekly | L | set_shape_property | **Currently missing as a forward tool** — shape.delete; v2.0 only has deleteSlideByTitle as inverse; inverse for this tool = restore shape (needs full before-image of all properties) |
| `rotate_shape` | Monthly | L | set_shape_property | shape.rotation; inverse = restore rotation |
| `add_line` | Monthly | M | — | **Defer** — shapes.addLine; useful for logic diagrams but low frequency |
| `set_shape_fill_advanced` | Monthly | H | set_shape_property | **Defer** — gradient/image fill API is complex; inverse is difficult; conflicts with v2.1 "no gradient" design principle |

#### Slide Level (PowerPointApi 1.3+)

| Tool | Frequency | Complexity | Depends on v2.0 | Notes |
|------|-----------|------------|-----------------|-------|
| `delete_slide` | Weekly | L | — | **Currently missing as a forward tool** — v2.0 deleteSlideByTitle is inverse-only; needs to be exposed as an LLM tool |
| `duplicate_slide` | Monthly | M | insert_slide | Slide duplication is common (template reuse); inverse = delete the duplicated slide by title |
| `set_slide_background` | Monthly | M | set_shape_property | PowerPointApi 1.10 slide.background; **user-named pain point "换背景"**; solid color is feasible; inverse = restore original background |
| `insert_table_ppt` | Monthly | H | — | PPT Table API (1.8/1.9); inverse is complex; recommend v2.1 basic version (insert only, no complex editing) |
| `insert_slides_from_template` | Monthly | H | — | **Defer** — insertSlidesFromBase64 requires base64 PPTX data; coupled with file upload (FUT-15); do in v2.2 |
| `insert_hyperlink_ppt` | Monthly | M | — | **Defer** — shape/text hyperlinks are rarely used in PPT workflows |
| `add_image` | Monthly | H | FUT-14/16 | **Defer** — base64 image insertion is on the same path as FUT-16 image generation insertion; do together in v2.2 |

**PPT v2.1 shortlist (9 tools):**
`set_shape_text_font` / `set_shape_text_alignment` / `add_shape` / `add_text_box` /
`delete_shape` / `rotate_shape` / `delete_slide` / `duplicate_slide` /
`set_slide_background`

(insert_table_ppt not in shortlist — recommend spike in Phase to validate feasibility; implement in v2.2 if complex)

---

### B.4 Platform Permanently Unsupported (from todos.md, confirmed by official API docs)

| Candidate Feature | Platform Status | Source |
|------------------|----------------|--------|
| PPT animation effects | ❌ Office.js API has no such interface | Official GitHub issues + docs confirmed |
| PPT slide transitions | ❌ No API | Same |
| PPT SmartArt | ❌ No API | Same |
| PPT apply theme/template | ❌ No API (issue #6185 still open as feature request) | Official GitHub issue #6185 |
| PPT read background color | ❌ Write-only; cannot reliably read | todos.md notation |
| Word page margins/orientation/paper size | ❌ pageSetup support is extremely weak | todos.md notation |

---

### B.5 Batching Impact on B Tools

Office.js batch model (queue → context.sync()) means multiple property settings within the same
Excel.run / Word.run closure can be completed in a single sync. This directly affects B tool design:

`set_cell_font` + `set_cell_fill` + `set_cell_borders` + `set_cell_alignment` + `set_number_format`
can be merged into a single `format_range` tool (one tool call sets all format properties). This
overlaps heavily with feature area C (batch operations).

Recommendation: provide `format_range` (merging font/fill/borders/alignment/numberFormat) as the
highest-frequency Excel composite tool, while keeping individual tools for fine-grained use.

---

### B Summary

| Host | v2.1 Do-Now Tools | Defer | Platform Unsupported |
|------|-------------------|-------|---------------------|
| Word | 11 | 10 | 2 (margins/paper, track changes buggy) |
| Excel | 15 | 7 | 0 |
| PPT | 9 | 5 | 6 (all todos.md-flagged ones) |
| **Total** | **35** | **22** | **8** |

35 tools is the upper bound target; actual v2.1 can further trim based on milestone work capacity.

**Core non-negotiable "super-high-frequency 10"** (daily-level operations):
Word `set_paragraph_alignment` + `apply_paragraph_style` + `find_and_replace` +
Excel `set_number_format` + `set_cell_font` + `set_cell_fill` + `sort_range` +
PPT `delete_shape` + `delete_slide` + `set_shape_text_font`

---

## C 批量操作 — What Good Batch Editing Looks Like

### Table-Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Excel `format_range` compound tool | Currently formatting a table requires 5-6 tool calls (font + fill + borders + alignment + number format), producing 5-6 tool cards; slow and noisy | M | One `format_range` tool accepts font/fill/borders/alignment/numberFormat as optional objects; one context.sync() completes all formatting; inverse = read before-image of complete format object |
| Word `format_paragraph` compound tool | Similar problem: setting font + paragraph alignment + style requires 3 tool calls | M | Merge into one tool accepting font_bold/font_size/alignment/style_built_in etc. as optional fields |
| Agent loop batch hint (system prompt reinforcement) | LLM already has "parallel tool_calls" guidance but still splits formatting operations into sequential calls | L | Add to getDomainSegment(): "when formatting multiple attributes, use format_range/format_paragraph; do not split into multiple single-attribute tool calls" |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| PPT `batch_set_shape_properties` | Modify multiple shapes' properties at once (e.g. unify all title shapes to same font size) | H | Accepts shape_id array + properties object; iterates in same PowerPoint.run closure; inverse needs before-image array for each shape; optional for v2.1 late stage |
| Excel multi-range format | Format multiple non-contiguous ranges in one call (e.g. simultaneously format header row + totals row) | H | Defer to v2.2 |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| One tool card per single-attribute operation | Card explosion; user cannot see "what's happening"; actually increases anxiety | format_range / format_paragraph merged card + humanLabel summarizing "Formatting B2:E10 (font/fill/borders)" |
| Unlimited batch (e.g. format entire workbook at once) | Exceeds 5MB API limit + user cannot review what changed | Note in tool description "range must not exceed 10000 cells"; agent chunks when exceeded |

### Office.js Batch Model Key Constraints

Verified from official docs (HIGH confidence):
- All format properties (font/fill/borders/alignment/numberFormat) can be queued in the same
  Excel.run closure and completed in a single context.sync() — this is "zero extra overhead" batching
- 5MB response limit, 5M cell read limit — format write operations are not affected, but reading
  before-images needs attention
- `suspendApiCalculationUntilNextSync()` can be used before formatting large ranges to pause
  recalculation, improving performance

---

## D Word 选区精度 — What's Needed

### Table-Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 选区段落 index | Current `selectionDetail` only returns text content + length; if "报告" appears 20 times in a document the agent will correct the wrong paragraph — this is a guaranteed bug in practice | M | Add `paragraph_index` (0-based, indicating the paragraph number where the selection starts) to selectionDetail tool return structure; WordAdapter.getSelectionDetail needs to call range.paragraphs + compare with body.paragraphs to determine index |
| `is_at_paragraph_start` / `is_at_paragraph_end` | Helps LLM understand whether selection is a whole paragraph or a fragment within a paragraph | L | Add boolean fields to selectionDetail return structure |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Intra-paragraph character offset | Completely solves the same-text ambiguity problem | H | Office.js does not natively expose character offset; requires manual calculation via paragraph.search() + Range.compareLocationWith counting n-th occurrence; too complex for v2.1; do paragraph_index first (sufficient for most cases); character offset deferred to v2.2 |
| Surrounding paragraph context | Return "selected paragraph + 1 before + 1 after" as disambiguation aid | M | Optional enhancement for v2.1 late stage; needs getSurroundingParagraph() or equivalent |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Expose absolute character offset to LLM | Office.js does not natively support this; requires complex workaround (wildcard search + compareLocationWith) that is prone to off-by-one errors; LLM may not use char offset well anyway | paragraph_index is a more natural anchor (LLM understands "paragraph 3") |
| Do nothing (maintain status quo) | Agent will incorrectly edit documents with repeated text; bad user experience | Add paragraph_index at minimum |

### Technical Feasibility (MEDIUM confidence)

In WordAdapter.getSelectionDetail():
1. Inside Word.run, get context.document.getSelection() as selectionRange
2. Load selectionRange.paragraphs + context.document.body.paragraphs
3. After context.sync(), compare body.paragraphs.items to find the index of the paragraph
   containing the selection
4. Return { text, length, paragraphIndex, isAtParagraphStart, isAtParagraphEnd }

Known limitation: when selection spans paragraphs, paragraphIndex points to the first paragraph;
this is sufficient for replace_selection use cases (users typically select single words or single
paragraphs).

---

## E UI 打磨 — Table-Stakes Polish vs Gold-Plating

### Table-Stakes (must do; omitting creates a "lacks polish" feeling)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| AI loading bubble | No response after sending a message feels like a bug; user does not know if AI is working | L | After sending, immediately insert { role: 'assistant', status: 'loading' } bubble; replace with streaming content when first token arrives; this is the standard pattern for all chat UIs |
| Markdown table borders | Tables without borders are nearly unreadable on light backgrounds; LLM frequently outputs tables (Excel analysis results / Word structures) | L | Add border-collapse + border styles to .md-body table in styles.css; pure CSS |
| Read tool card lightening | Current read tool cards have borders that take up space; one agent loop may produce 5-6 read cards that "inflate" the chat history; users feel too much noise | L | Change read tool cards to borderless, low-contrast text (--text-3 token), icon + single line; reference Linear/Notion inline activity style |
| "本次改动" card follows current loop | Current DiffLogPanel sinks to the bottom; after multiple loops, several cards pile at the bottom and cannot be associated with their triggering conversation | M | Change "本次改动" card render position to "after the user message that triggered that loop" not globally at bottom; requires associating runId with message ID in agentStore / chatStore |
| First-screen skeleton | Cold start Task Pane shows white screen for 0.5-1s; looks like a loading failure | L | Static HTML skeleton (shimmer animation CSS); replace with real content after Office.initialize completes |

### Differentiators (nice to have)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Overall Markdown polish (code blocks / lists / bold rendering) | LLM now outputs more formatted content (analysis reports / proposal text); make MD rendering feel closer to "document-like" | M | react-markdown + remark-gfm already in dependencies; mainly CSS work; code blocks with shiki syntax highlighting (lazy-loaded; must not affect bundle) |
| Micro-animation on successful operation | A brief highlight feedback when "the shape was modified" gives the user a "done" confirmation feeling | L | CSS transition + 200ms opacity flash; use sparingly; do not over-animate |

### Anti-Features (Gold-plating, do not do)

| Anti-Feature | Why Avoid |
|--------------|-----------|
| Full-screen loading overlay (modal) | Agent runs asynchronously in background; overlay would block normal Office use; AgentControlBar already shows status |
| Dynamic typewriter effect (character-by-character display) | Streaming output already has per-token progressive effect; adding typewriter creates double-layer animation conflict |
| "Thinking" long-duration loading animation (>3 seconds) | If LLM is actually waiting, show "sent, awaiting response" not make users stare at a spinner |
| Tool card hover-to-expand details | Complexity M but low return; v2.0 DiffLog already has a details panel |
| Toast notification popups | Office Task Pane space is small; toasts cover content; inline status is sufficient |

### "好用" UI Standard (based on Agent UX research)

Extracted from Microsoft Design / UX research and hatchworks agent UX patterns:
1. **Separate conversation history from action stream**: read tool cards = agent action log; should
   visually be lighter than user/AI messages; "本次改动" card is an action summary; should follow
   the triggering conversation
2. **Always interruptible**: AgentControlBar (v2.0 has this) = must always be visible; pause/abort
   cannot be hidden
3. **Intent clarity**: Chinese humanLabel (v2.0 has this) is the foundation of "好用" feeling
4. **Lightweight feedback**: success/failure inline markers (v2.0 DiffLog has this); no modal dialogs needed

---

## F 聊天记录持久化 — Table-Stakes vs Over-Engineering

### Table-Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| localStorage chat history storage | Chat disappearing after closing Task Pane / refreshing = the most common user complaint; v2.0 in-memory session is an obvious gap | M | key = aster_chat_history (global) or per-document (see below); serialize messages array (store text/role/status only; do not store raw tool result data to prevent size bloat) |
| LLM context cap at 20 turns | Prevent context overflow causing cost spikes or API errors; tool results do not count toward turns (consistent with standard agent context management) | L | In loop.ts buildMessages(): filter out tool_call/tool_result messages; count only user + assistant text messages; take most recent 20 pairs; keep all tool messages (do not trim them) |
| Clear chat history | User wants to start a fresh task; must not be forced to carry old context | L | Add "清空" button to Settings panel or chat header; clear localStorage + reset chatStore |

### Per-Document Research Findings (MEDIUM confidence, spike validation needed)

Office.js partitioned localStorage is isolated by "browser origin + partition key", not by Office
document ID. Office.context.partitionKey in PPT/Excel/Word for Web can return a partition string,
but official docs are not clear on whether this string differs between different documents.

Research conclusion:
- **Ideal approach**: use document URL hash or Office.context.document.url as key for per-document storage
- **Real risk**: Office.context.document.url may return empty string in some host/scenario combos
  (newly created unsaved documents)
- **Fallback approach**: single global key, user manually clears — better than "no persistence",
  worse than per-document
- **Recommendation**: implement global storage + clear first (low risk); spike document.url
  reliability in Phase; if reliable upgrade to per-document in same Phase without a separate Phase

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-document independent chat history | Opening A.xlsx shows A's AI conversation history; opening B.pptx shows B's | M | Depends on document.url spike; if feasible add aster_chat_${urlHash} key |
| Chat history search | Find historical operation records | H | **Defer** — over-engineering; not in v2.1 |
| Chat history export | Share AI operation records | M | **Defer** — FU-03 copy chat history already covers single-session needs |

### Anti-Features

| Anti-Feature | Why Avoid |
|--------------|-----------|
| IndexedDB (replacing localStorage) | "localStorage solves 95% of persistence needs" judgment holds; IndexedDB is only needed when history exceeds 5MB; over-engineering |
| Auto-truncate old records to 50 turns | Combined with "20 turn context cap": storage can retain 100 turns of history for user browsing; LLM context only takes most recent 20; no need to auto-truncate storage |
| Cloud sync of chat history | Conflicts with "no backend" hard constraint |
| Unlimited storage history | localStorage total 5MB limit; must discard oversized tool results at storage time (store only humanLabel, not raw data) |

### Storage Size Control (Critical Implementation Constraint)

tool_call/tool_result messages may contain large amounts of raw document data (entire range
values / full document text). When persisting:
1. **Store only user + assistant text messages** (role = 'user' | 'assistant', type = 'text')
2. **Do not persist tool-related messages to localStorage** (tool history lost on reload, but
   conversation history preserved)
3. **Truncate each message content to 2000 characters** (prevents single message bloating past 5MB limit)
4. **Estimate size before storing**; if exceeding 4MB, automatically discard the oldest 20% of messages

---

## Dependencies on Existing v2.0 Features

| v2.1 Feature | Depends on v2.0 Component | Dependency Description |
|--------------|--------------------------|----------------------|
| A — per-host prompt | system-prompt.ts buildSystemPrompt / getDomainSegment | Add content to existing function; minimal change |
| A — preference injection | chatStore / Settings UI / localStorage | Read preference text; append to buildSystemPrompt() output |
| B — all write tools | src/agent/tools/write/*.ts + corresponding Adapter | New tool files follow existing ToolDef interface + execute/humanLabel convention; Adapter adds new methods |
| B — Word font/para tools | WordAdapter.ts (has appendParagraph/replaceSelection etc.) | Add setRangeFont, setRangeParagraphFormat etc. adapter methods |
| B — Excel format tools | ExcelAdapter.ts (has setRangeValues/insertChart) | Add setRangeFormat, sortRange, applyFilter etc. |
| B — PPT shape tools | PptAdapter.ts (has setShapeProperty/moveShape) | Add addShape, addTextBox, deleteShape, setSlideBackground etc. |
| C — batch tools | B tools above | format_range is a merged wrapper over B's Excel format tools |
| D — selection precision | WordAdapter.getSelectionDetail / src/agent/tools/common.ts selectionDetail | Add paragraphIndex field to existing selectionDetail tool return |
| E — loading bubble | chatStore messages array / chat UI rendering | Add status: 'loading' message type |
| E — "本次改动" card follows loop | agentStore runId + operationLog / DiffLogPanel | Associate runId with triggering message; change render position logic |
| E — read card lightening | chat UI tool card rendering + styles.css | CSS + conditional render logic |
| F — chat history persistence | chatStore / localStorage (already used in Settings) | Add Zustand persist middleware or manual serialization to chatStore |
| F — LLM context 20-turn cap | loop.ts buildMessages / messageHistory | Filter + trim in messages construction before sending to LLM |

---

## Sources (Confidence Levels)

### HIGH confidence (official docs + code verification)

- [Word.Font class — Microsoft Learn](https://learn.microsoft.com/en-us/javascript/api/word/word.font?view=word-js-preview) — font bold/italic/size/color/underline all at WordApi 1.1
- [Word.Paragraph class — Microsoft Learn](https://learn.microsoft.com/en-us/javascript/api/word/word.paragraph?view=word-js-preview) — styleBuiltIn / alignment / lineSpacing
- [Apply conditional formatting — Excel Office.js](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/excel-add-ins-conditional-formatting) — ExcelApi 1.6+, web supported
- [Set the format of a range — Excel Office.js](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/excel-add-ins-ranges-set-format) — font/fill/borders/alignment single-sync batch formatting confirmed
- [Work with shapes — PowerPoint Office.js](https://learn.microsoft.com/en-us/office/dev/add-ins/powerpoint/shapes) — addGeometricShape/addTextBox/addLine at PowerPointApi 1.4
- [PowerPoint.Slide class](https://learn.microsoft.com/en-us/javascript/api/powerpoint/powerpoint.slide?view=powerpoint-js-preview) — background property at PowerPointApi 1.10
- [Excel JavaScript API performance optimization](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/performance) — batch context.sync pattern
- Existing v2.0 codebase src/agent/system-prompt.ts — buildSystemPrompt getDomainSegment architecture confirmed
- Existing v2.0 tool registry src/agent/tools/index.ts — current registered tool inventory confirmed

### MEDIUM confidence (cross-validated from multiple sources)

- [WPS AI official site and CSDN review](https://ai.wps.cn) — Chinese职场 AI high-frequency scenarios (number format/conditional format/pivot/sort)
- [Zhihu AI office efficiency guide 2026](https://zhuanlan.zhihu.com/p/1981744767651050678) — finance/HR/marketing scenario priorities
- [Microsoft Copilot "vibe working" launch notes 2026](https://cloudwars.com/cloud/microsoft-introduces-agent-mode-and-office-agent-in-microsoft-365-copilot-to-power-vibe-working/) — Copilot three-host per-host agent design patterns
- [anthropics/skills pptx SKILL.md](https://github.com/anthropics/skills/blob/main/skills/pptx/SKILL.md) — PPT agent design principles (read/edit/create separation, embedded design constraints, QA loop)
- [Hatchworks — Agent UX Patterns 2025](https://hatchworks.com/blog/ai-agents/agent-ux-patterns/) — conversation vs action stream separation
- [Microsoft Design — UX for Agents](https://microsoft.design/articles/ux-design-for-agents/) — transparency/interruptibility/error recovery are agent UX essentials
- [Excel ExcelApi conditional format availability](https://learn.microsoft.com/en-us/javascript/api/excel/excel.conditionalformat?view=excel-js-preview) — ExcelApi 1.6 web supported

### LOW confidence (single source, not deeply validated)

- Word set_paragraph_keep (keepWithNext/keepTogether) API availability — inferred from Word.Paragraph docs only; no explicit requirement set marking found
- PPT set_shape_text_alignment paragraphFormat support — todos.md already notes "PPT API support is limited, needs testing"; spike required before implementation
- Office.js document.url per-document storage reliability across hosts — official docs are ambiguous; requires Phase spike
- remove_duplicates inverse feasibility — range.removeDuplicates returns RemoveDuplicatesResult (contains removed count but no original data); means before-image must be manually read before calling; may have performance issues for large ranges

### GitHub Issues (known platform bugs / limitations)

- [Track changes search failing #5874](https://github.com/officedev/office-js/issues/5874) — primary reason toggle_track_changes is deferred
- [PPT addShape to blank slide bug #2172](https://github.com/OfficeDev/office-js/issues/2172) — known PPT for Web bug; add_shape must ensure slide is not completely empty
- [Word range reliable creation #390](https://github.com/OfficeDev/office-js/issues/390) — root cause of Word selection precision limitation; paragraph_index is a viable compromise
