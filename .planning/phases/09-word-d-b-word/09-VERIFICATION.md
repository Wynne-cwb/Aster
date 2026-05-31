---
phase: 09-word-d-b-word
verified: 2026-05-31T01:41:58Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "uniqueLocalId 真机验证：在 Office for Web 中打开 Word 文档，多段文字相同，选中第二段后调 selection_detail，确认返回 paragraphIndex 和非空 uniqueLocalId"
    expected: "data.uniqueLocalId 不为 null（WordApi 1.6 在 Office for Web 上支持）；精确定位到第二段而非第一段"
    why_human: "uniqueLocalId = Office.context.requirements.isSetSupported('WordApi','1.6') 运行时门控，jsdom 环境下 Office 全局不存在，supportsUniqueId 始终 false，单测无法覆盖真机行为"
  - test: "undo 真机验证：在 Office for Web 中执行 find_and_replace（把某个词替换），点击 DiffLogPanel 撤销该步，确认文字全部还原"
    expected: "undo 后所有被替换的文字全部恢复为原文；DiffLogPanel 步骤行显示「已撤销」状态"
    why_human: "快照式 undo 路径（restoreRangeSnapshot）只能在真实 Word.run 环境中验证写回是否生效；单测 mock insertText fn，无法验证 Office 实际写回"
---

# Phase 9: Word D+B-Word Verification Report

**Phase Goal:** agent 在 Word 里能改字体/段落格式/套样式/查替换/建表格，且多个相同文本段落时能精准定位到正确的那一段。
**Verified:** 2026-05-31T01:41:58Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | agent 收到「把第二段加粗并改为 14 号字」时能调用 set_word_character_format 且改第二段而非第一个同名段落（paragraphIndex + uniqueLocalId 定位生效） | ✓ VERIFIED (unit) / ? HUMAN (real-machine uniqueLocalId) | WordAdapter.setCharacterFormat: supportsUniqueId 门控 → 找到 uniqueLocalId 不匹配时全文遍历 (WordAdapter.ts:504-519)；selection_detail 返回 paragraphIndex + uniqueLocalId (WordAdapter.ts:1280-1353)；真机 uniqueLocalId 实际返回值需人工确认（见 Human Verification #1） |
| 2 | agent 可一步完成段落格式批量设置（set_word_paragraph_format 参数化单工具） | ✓ VERIFIED | setWordParagraphFormat ToolDef 实现完整，支持 lineSpacing/spaceBefore/spaceAfter/alignment/indent/leftIndent 六属性 only-if-present 写入 (word.ts:313-375)；adapter.setParaFormat 实现完整 (WordAdapter.ts:626-703) |
| 3 | agent 可套用「标题 1」样式（apply_paragraph_style 用 Word.BuiltInStyleName enum，不因语言版本 crash） | ✓ VERIFIED | applyParagraphStyle ToolDef 在工具层做 VALID_BUILTIN_STYLES allowlist 校验，非法 styleName 返 INVALID_PARAM 不调 Word.run (word.ts:428-438)；adapter.applyParagraphStyle 使用 para.styleBuiltIn = styleName as Word.BuiltInStyleName（locale-safe，不用 para.style）(WordAdapter.ts:833) |
| 4 | find_and_replace 执行后「本次改动」卡显改动数，undo 后文字全部还原（快照式 undo） | ✓ VERIFIED (unit) / ? HUMAN (real undo) | data.replaced = result.replacedCount（真实替换数，SC#4，word.ts:515+539）；DiffLogPanel「本次改动 N 处」显示 write op 步数（N=writeOps.length）；restoreRangeSnapshot Record 签名守门测试 GREEN (operationLog.integration.test.ts:315-333)；真机 undo 实际写回需人工确认（见 Human Verification #2） |
| 5 | insert_table 插入 3×3 表格后 undo 表格消失（delete_table_by_marker 逆向）；每个新 inverse 有 operationLog.integration.test 守门 | ✓ VERIFIED | deleteTableByMarker Record 签名 + 内容指纹三重匹配 (WordAdapter.ts:1144-1178)；集成守门测试 GREEN（`insert_table: 真 WordAdapter.deleteTableByMarker 收 Record 对象 → rolled_back`，line 335-360）；全套 677 测试 0 失败 |

**Score:** 5/5 truths verified (unit level)

---

### D-17 Critical Guard: Inverse Method Signature Verification

每个 Phase 9 inverse 方法签名单独核查（项目 #1 历史故障防御）：

| Inverse Method | Signature | First-Line Destructure | Integration Test | Status |
|---------------|-----------|----------------------|-----------------|--------|
| `restoreRangeFont` | `args: Record<string, unknown>` | `const index = args.index as number` | GREEN (line 255-273) | ✓ VERIFIED |
| `restoreParagraphFormat` | `args: Record<string, unknown>` | `const index = args.index as number` | GREEN (line 275-293) | ✓ VERIFIED |
| `restoreParagraphStyle` | `args: Record<string, unknown>` | `const index = args.index as number` | GREEN (line 295-313) | ✓ VERIFIED |
| `restoreRangeSnapshot` | `args: Record<string, unknown>` | `const snapshot = args.snapshot as Array<...>` | GREEN (line 315-333) | ✓ VERIFIED |
| `deleteTableByMarker` | `args: Record<string, unknown>` | `const contentFingerprint = args.contentFingerprint as string` | GREEN (line 335-360) | ✓ VERIFIED |

所有 inverse 方法均使用 Record 对象签名并在方法体第一行解包，不使用位置参数。Phase 5 真机 undo 全挂教训已结构性守门。

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `src/adapters/WordAdapter.ts` | 5 个新方法：setCharacterFormat / setParaFormat / applyParagraphStyle / findAndReplace / insertTable + 5 个 inverse 方法 | ✓ VERIFIED | 所有方法存在、实质性实现（各方法 40-100+ 行），无 stub；双重定位范式（index 快路径 + 内容指纹降级）防 index drift |
| `src/agent/tools/write/word.ts` | 5 个新 ToolDef：setWordCharacterFormat / setWordParagraphFormat / applyParagraphStyle / findAndReplace / insertTable | ✓ VERIFIED | 全部存在，reverse.args 均为 Record 对象，reverse.tool 与 CONTRACT.md 逐字对齐 |
| `src/agent/tools/index.ts` | buildToolsForHost('word') 注册 10 个 write tools（含 Phase 9 新增 5 个） | ✓ VERIFIED | wordWriteTools 数组：appendParagraph + insertParagraph + replaceParagraph + insertTextAtCursor + replaceSelection + setWordCharacterFormat + setWordParagraphFormat + applyParagraphStyle + findAndReplace + insertTable（line 197-204） |
| `src/agent/operationLog.ts` | executeReverse 路由 5 个 Phase 9 case | ✓ VERIFIED | 5 个 case 均存在（line 315-344），以 reverse.args 传入（非位置参） |
| `src/agent/contract.test.ts` | Phase 9 五行 integrationTest: true | ✓ VERIFIED | 全部 5 行 integrationTest: true（line 35-39） |
| `.planning/phases/08-foundation-a-f/CONTRACT.md` | Phase 9 五行 status: done, integration_test: true | ✓ VERIFIED | 全部 5 行 status: done, integration_test: true（CONTRACT.md line 20-24） |
| `src/agent/operationLog.integration.test.ts` | 5 个 Phase 9 守门测试，使用真 WordAdapter 实例，status === 'rolled_back' | ✓ VERIFIED | 5 个测试全 GREEN（line 255-360），每个测试 `new WordAdapter()`，expect(detail.status).toBe('rolled_back') |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `set_word_character_format` ToolDef | `WordAdapter.setCharacterFormat` | adapter 委托 + before-image | ✓ WIRED | word.ts:268 `(ctx.adapter as WordAdapter).setCharacterFormat({...})` |
| `set_word_character_format` tool | `restore_range_font` inverse | reverse.args Record | ✓ WIRED | word.ts:274-280 `tool: 'restore_range_font', args: { index, expectedText, before }` |
| `restore_range_font` reverse tool | `WordAdapter.restoreRangeFont` | operationLog executeReverse case | ✓ WIRED | operationLog.ts:315-320 `case 'restore_range_font': adapter.restoreRangeFont(reverse.args)` |
| `set_word_paragraph_format` ToolDef | `WordAdapter.setParaFormat` | adapter 委托 | ✓ WIRED | word.ts:353 |
| `apply_paragraph_style` ToolDef | allowlist 校验 + `WordAdapter.applyParagraphStyle` | VALID_BUILTIN_STYLES.has() guard | ✓ WIRED | word.ts:427-454 |
| `find_and_replace` ToolDef | `WordAdapter.findAndReplace` → snapshot | adapter 返回 snapshot + overLimit | ✓ WIRED | word.ts:501-543 |
| `insert_table` ToolDef | `WordAdapter.insertTable` → contentFingerprint → `delete_table_by_marker` reverse | D-13 指纹生成 + reverse.args | ✓ WIRED | word.ts:594-620 |
| `selection_detail` read tool | `WordAdapter.read({ kind: 'selection_detail' })` → paragraphIndex + uniqueLocalId | WordApi 1.6 门控 | ✓ WIRED (code) / ? HUMAN (real uniqueLocalId value) | WordAdapter.ts:1286-1352 |
| `buildToolsForHost('word')` | 5 个 Phase 9 write tools 注册 | tools/index.ts switch case 'word' | ✓ WIRED | index.ts:197-209 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `setCharacterFormat` | `beforeImage` | Word.run → para.font 属性读取 | 写前读 bold/italic/underline/size/color/name | ✓ FLOWING |
| `findAndReplace` | `snapshot` | Word.run → body.search + paragraphs 文本 | 受影响段落 before-image 列表 | ✓ FLOWING |
| `insertTable` | `contentFingerprint` | Word.run 两次 sync → table.values | 读取真实表格首行内容生成指纹 | ✓ FLOWING |
| `selection_detail` (WordAdapter) | `paragraphIndex + uniqueLocalId` | Word.run → paras + selection.text | paragraphIndex: 文本指纹匹配；uniqueLocalId: WordApi 1.6 门控 | ✓ FLOWING (unit) / ? uniqueLocalId 真机 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 所有 677 单元测试通过 | `npx vitest run` | PASS (677) FAIL (0) | ✓ PASS |
| operationLog 集成测试 13 个全绿 | `npx vitest run src/agent/operationLog.integration.test.ts` | PASS (13) FAIL (0) | ✓ PASS |
| contract.test.ts 9 个全绿 | `npx vitest run src/agent/contract.test.ts` | PASS (9) FAIL (0) | ✓ PASS |
| Phase 9 词汇出现在 integration.test.ts（D-17 fs scan） | contract.test.ts line 114-137 fs.readFileSync 扫描 | 5 个 toolName 均出现 | ✓ PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| WSEL-01 | selection_detail 返回 paragraphIndex + uniqueLocalId（WordApi 1.6 门控） | ✓ SATISFIED (code) / ? HUMAN (uniqueLocalId 真机值) | WordAdapter.ts:1286-1352 实现；spike S5 真机需人工确认 |
| WORD-01 | set_word_character_format（加粗/斜体/下划线/字号/颜色/字体名，简单逆向） | ✓ SATISFIED | ToolDef + adapter 实现完整；restoreRangeFont Record 签名守门通过 |
| WORD-02 | set_word_paragraph_format（行距/段前后距/对齐/缩进，简单逆向）★超高频 | ✓ SATISFIED | ToolDef + adapter 实现完整；restoreParagraphFormat Record 签名守门通过 |
| WORD-03 | apply_paragraph_style（BuiltInStyleName，locale-safe，简单逆向）★超高频 | ✓ SATISFIED | VALID_BUILTIN_STYLES allowlist 校验；para.styleBuiltIn 写入（不用 para.style）；守门通过 |
| WORD-04 | find_and_replace（快照式 undo，replacedCount 真实替换数）★超高频 | ✓ SATISFIED | 快照上限 100，超限 noop+gate 但仍执行替换；data.replaced 真实计数；守门通过 |
| WORD-05 | insert_table（简单逆向 delete_table_by_marker，内容指纹） | ✓ SATISFIED | buildTableFingerprint cols 从 values[0].length 推导（Word.Table 无 columnCount 属性）；守门通过 |

**Requirements coverage: 6/6 (WSEL-01 + WORD-01..05) ✓ all satisfied at code level**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | — |

无 TODO/FIXME/placeholder，无空返回 stub，无硬编码空数组/空对象作数据源。

### Human Verification Required

#### 1. uniqueLocalId 真机验证（Spike S5 — WSEL-01 关键路径）

**Test:** 在 Office for Web 中打开一个包含多段相同文本的 Word 文档（例如两段都是「测试段落」），用 Aster task pane 选中第二段，调用 selection_detail 工具（或观察 agent 在执行 set_word_character_format 时的定位行为）
**Expected:** 返回的 data.uniqueLocalId 不为 null；agent 对「把第二段加粗」的请求能准确操作第二段而非第一段
**Why human:** uniqueLocalId 依赖 `Office.context.requirements.isSetSupported('WordApi','1.6')` 运行时门控——jsdom 单测环境下 Office 全局不存在，supportsUniqueId 始终 false，单测只能验证降级路径（仅 paragraphIndex）。true 精确定位路径需真机 Office for Web 验证（Spike S5 门控）。

**注：** 代码已正确处理两种路径（1.6 支持 → uniqueLocalId 精确消歧；1.6 不支持 → 仅 index 快路径）。此项仅需确认 Office for Web 实际返回 uniqueLocalId 值，不影响当前阶段进入 Phase 10。

#### 2. find_and_replace + undo 真机验证

**Test:** 在 Office for Web 中打开 Word 文档，包含多次重复的某个词（如「测试」出现 5 次），向 agent 发送「把文档中所有的『测试』替换为『验证』」，观察 DiffLogPanel 显示，然后点击撤销
**Expected:** 替换成功后 DiffLogPanel 显示「将「测试」替换为「验证」」条目；点撤销后文档中所有「验证」恢复为「测试」
**Why human:** restoreRangeSnapshot 中的 `paras.items[i].insertText(originalText, Word.InsertLocation.replace)` 实际写回效果只能在真实 Word.run 环境中确认；单测 mock 的 insertText 为 vi.fn()，不验证写回结果。

---

### Gaps Summary

无 gaps。5/5 must-have truths 在代码层全部 VERIFIED：
- D-17 签名守门：5 个 inverse 方法全部使用 `Record<string, unknown>` 签名
- CONTRACT.md：5 行全 `status: done, integration_test: true`
- contract.test.ts：5 行全 `integrationTest: true`，fs.readFileSync D-17 硬卡通过
- 集成测试：5 个 Phase 9 守门测试全绿（真 WordAdapter + mock Office.js）
- 全套 677 测试 0 失败

**状态为 `human_needed`** 是因为 2 个真机验证项（WSEL-01 uniqueLocalId 真机值 + undo 真机写回效果）按验证规程属于「人工必做」类别——不是代码缺陷，而是 Office.js 运行时行为必须在真实 Office for Web 中确认。进入 Phase 10 无需等待这两项，可在 Phase 13（UAT/Release）一并验证。

---

*Verified: 2026-05-31T01:41:58Z*
*Verifier: Claude (gsd-verifier)*
