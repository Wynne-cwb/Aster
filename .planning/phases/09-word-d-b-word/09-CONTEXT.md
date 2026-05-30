# Phase 9: Word 精准写 (D + B-Word) - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning
**Mode:** `--auto`（用户离开，Claude 替用户按推荐默认填灰区；所有「替用户拍」项已标【待用户复核】）

<domain>
## Phase Boundary

Phase 9 在既有 agent loop / adapter / operationLog 基础上，给 **Word 宿主** 加 5 个 write 工具 + 1 项选区精度能力，让 agent 能改字体/段落格式/套样式/查替换/建表格，且**多个相同文本段落时能精准定位到正确那一段**。

**WHAT 已被 `CONTRACT.md` 锁定**（工具名 / 参数摘要 / undo 三分类 / reverse_tool 名 / integration_test 守门）——本次 discuss 只锁 **HOW**（定位算法、before-image 粒度、快照范围、表格逆向定位、降级行为、守门接线）。

**不在本阶段**：Excel/PPT 工具（Phase 10）、批量 batch（Phase 11）、UI 打磨（Phase 12）、绝对字符偏移定位（WSEL-D1 → v2.2）、文字高亮/列表/批注/edit_table/页眉页脚（WORD-D1/D2 → v2.2）。

**Requirements covered:** WSEL-01, WORD-01, WORD-02, WORD-03, WORD-04, WORD-05

**5 个工具（CONTRACT.md 锁定）：**
| tool | undo_type | reverse_tool |
|---|---|---|
| set_word_character_format | 简单逆向 | restore_range_font |
| set_word_paragraph_format | 简单逆向 | restore_paragraph_format |
| apply_paragraph_style | 简单逆向 | restore_paragraph_style |
| find_and_replace | 快照式 | restore_range_snapshot |
| insert_table | 简单逆向 | delete_table_by_marker |
</domain>

<decisions>
## Implementation Decisions

> 灰区均 `--auto` 由 Claude 取推荐默认。**标【待用户复核】= Claude 替用户拍的判断**（team-lead 点名关注的三处：S5 降级、find_and_replace 快照范围、表格逆向定位 都在此列）。

### G-A 选区精度 + Spike S5 降级（WSEL-01 / D feature）

- **D-01 定位锚点**：`paragraphIndex`（0-based，必填）为主锚——与现有 `get_paragraph_at` / `replace_paragraph` 的索引语义一致；`uniqueLocalId`（WordApi 1.6）为**可选消歧/校验位**。`selection_detail` read tool 扩展返回值加 `{ paragraphIndex, uniqueLocalId }`（当前仅返 `charCount + text`，见 `WordAdapter.read` 的 `selection_detail` case）。
- **D-02 Spike S5 不阻塞规划/执行**【待用户复核】：S5（`isSetSupported('WordApi','1.6')` + `uniqueLocalId` 在 Office for Web 可用性）需真机 Office host 才能验，Claude 无法自跑（memory `feedback_self_run_spikes`）。**决策：不前置阻塞**——实现里做**运行时 `isSetSupported('WordApi','1.6')` 门控 + 降级路径**，降级路径本身就是安全网，无需等 spike 通过才动工。研究评 S5 为 **HIGH 信心**（WordApi 1.6 2022 GA）。真机确认列为 Phase 9 收尾 UAT 项。
- **D-03 降级行为**【待用户复核，team-lead 点名】：
  - 支持 uniqueLocalId（Web 正常路径）→ 用 paragraphIndex 命中后用 uniqueLocalId 校验/消歧。
  - **不支持 / desktop 返 null（#4258）→ 降级为 `paragraphIndex + 内容指纹` 定位**（复用现有 `replaceParagraphAt` / `restoreParagraphAt` 的 index→内容指纹双重定位范式）。v2.1 仅验 Web，降级可接受。
  - `selection_detail` 在 unsupported 时返 `uniqueLocalId: null`（仍返 paragraphIndex，agent 仍可按 index 定位）。
- **D-04 定位失败处理**：paragraphIndex 越界 / uniqueLocalId 与 index 都对不上 → 工具返 `NOT_FOUND`（recoverable，hint 提示先 `get_paragraph_count`/`get_document_outline`）。**绝不静默改错段**（SC#1 的核心：改第二段而非第一个同名段）。

### G-B 简单逆向三工具 before-image（WORD-01 / WORD-02 / WORD-03）

- **D-05 作用域 = 整段**：character/paragraph format 作用于 `paragraphIndex` 指定段落的整个 range（不做任意字符子区间——绝对字符偏移 WSEL-D1 已 defer v2.2）。SC#1「把第二段加粗并改 14 号字」= 对整第二段操作。
- **D-06 before-image 属性包快照**：写前读原值存 reverse.args（Record 对象）：
  - character → `{ bold, italic, underline, size, color, name }`
  - paragraph → `{ lineSpacing, spaceBefore, spaceAfter, alignment, indent }`
  - style → **同时存 `style`（名）+ `styleBuiltIn`**（研究明确：apply_paragraph_style 还原需两者都存）
  - inverse 还原整个属性包。
- **D-07 混合格式段已知限制**【待用户复核】：同段内字符格式不一致时 Word `font.*` 返 `null`。本阶段按 CONTRACT 锁定的「简单逆向」做 **best-effort 还原**（snapshot 属性包→restore 属性包；null 表示「混合/继承」按原样写回）。记为**已知限制**，不阻塞、不升级为快照式（避免范围蔓延）。
- **D-08 styleName 校验（locale-safe）**：`apply_paragraph_style` 仅接受 `Word.BuiltInStyleName` enum 值；工具层 allowlist 校验，非法值在调 Word **之前**拒掉（防中文 locale 样式名 crash，PITFALLS §W3 / 成功标准 #3）。

### G-C find_and_replace 快照范围（WORD-04）

- **D-09 快照粒度 = 受影响段落整段 before-image**【待用户复核，team-lead 点名】：替换前枚举所有匹配，按 `paragraphIndex → 该段原整段文本` 存 before-image 列表。**不用全文单块快照**（理由：Word 用 `body.insertText(..., replace)` 还原全文会毁掉其余段落的格式/结构与表格）。undo（`restore_range_snapshot`）按段还原这些段的文本。与 Excel `sort_range` 的「写前 readSnapshot」范式同构。
- **D-10 上限 + 超限行为**【待用户复核】：受影响段落数 ≤ 上限（**建议 200 段，planner 按实测定**）→ 快照式 undo；超限 → **noop+gate**（执行替换但 warn「改动过大，无法自动撤销」，不中断 agent），与 Excel sort_range 超限同范式（PITFALLS）。
- **D-11 search 选项透传**：`matchCase` / `matchWholeWord` 透传给 Word `body.search` 的 `searchOptions`。
- **D-12 返回替换数**：execute 返 `{ replaced: N }`，humanLabel 显示「将 N 处『X』替换为『Y』」（满足 SC#4「本次改动卡显示改动数」）。

### G-D insert_table 逆向定位（WORD-05）

- **D-13 marker 机制 = 插入时内容指纹**【待用户复核，team-lead 点名】：插入后把「定位锚」写进 reverse.args（Record 对象）——`{ contentFingerprint（cells 内容拼接 / 或首行+首列）, rows, cols, afterParagraphIndex }`。`delete_table_by_marker` 遍历 `body.tables`，按指纹（内容 + 行列数）匹配那张表并 `.delete()`。范式与现有 `deleteParagraphByContent`（按内容指纹定位）一致。
- **D-14 空表后备**：`content` 省略（空 3×3 表）时指纹退化为「行列数 + `afterParagraphIndex` 锚后第一个匹配尺寸的表」位置匹配；**定位不到 → `skipped_error` 诚实标「此步无法自动撤销」**（不 crash、绝不删错表）。SC#5（3×3 表 undo 后消失）在有 content 或位置可定位时满足。
- **D-15 插入位置 + 填充**：`afterParagraphIndex` 提供 → 该段后插入；省略 → 文档末尾。`content[][]` 提供则填值，否则空表。

### G-E undo 基础设施扩展 + D-17 守门（贯穿 5 工具，**数据安全硬门，不软化**）

- **D-16 reverse tool 名严格对齐**：必须与 `src/agent/contract.test.ts` 的 CONTRACT 行**逐字一致**——`restore_range_font` / `restore_paragraph_format` / `restore_paragraph_style` / `restore_range_snapshot` / `delete_table_by_marker`。`operationLog.ts` 加对应 `DocumentAdapterForReplay` 方法声明 + `executeReverse` switch case。
- **D-17 adapter inverse/read 签名一律 `(args: Record<string, unknown>)`**（memory `project_adapter_inverse_signature` 硬约束；Phase 5 位置签名致真机撤销全挂的翻车点）。
- **D-18 D-17 守门做成每工具显式 plan 任务**（acceptance_criteria 必含**三步**，缺一 CI 挂）：
  1. `src/agent/contract.test.ts` 对应行 `integrationTest: false → true`；
  2. `src/agent/operationLog.integration.test.ts` 追加「**真 `WordAdapter` 实例经 `replayUndoSingle` → `rolled_back` 且 adapter 收到 Record 对象**」守门用例（且工具名字符串出现在文件内——`contract.test.ts` 用 `fs.readFileSync` 断言此点，见其第 114-137 行 D-17 硬卡）；
  3. `.planning/phases/08-foundation-a-f/CONTRACT.md` 对应行 `status: planned→done` + `integration_test: false→true`。
- **D-19 postState 手改侦测取保守路径**：新工具的 `PostStateSnapshot` 若需新 `kind`（如 `word_range_format` / `word_snapshot` / `word_table`），`readTargetState` 对其**返 `undefined`（保守视为一致，正常回滚）**——**不盲加比对规则**（memory `project_adapter_inverse_signature` 明示：盲加 read 比对会误判全部手改）。undo 守门聚焦「reverse Record 签名路径可用 → rolled_back」这条硬路径（D-17）。新 kind 仅供 integration test 断言形状。

### Claude's Discretion（planner/researcher 可定）
- find_and_replace 快照上限的**具体数字**（D-10，按 Word API 实测定）。
- insert_table marker 指纹的**具体字段组合**（D-13，researcher 查 `Word.Table` API 后定最稳的指纹）。
- 新 `PostStateSnapshot.kind` 的**命名**（D-19）。
- 5 工具的 humanLabel 文案、参数 description 中文措辞。

### Folded Todos
无折叠。唯一匹配的 `builtin-model-dropdown.md`（score 0.4，仅命中关键词「phase」）为误匹配，与 Word 精准写无关，见 Deferred。
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 9 地基（最高优先，规划必须逐行对齐）
- `.planning/phases/08-foundation-a-f/CONTRACT.md` §"Phase 9 Word 工具" — 5 工具的参数摘要 / undo 三分类 / reverse_tool 名 / 使用说明（实现时改 status + integration_test 的步骤）+ Undo 三分类判定标准表。**这是 Phase 9 的合约真相源。**
- `src/agent/contract.test.ts` — CONTRACT 常量第 35-39 行（Phase 9 五行）+ 第 114-137 行 D-17 硬卡（`fs.readFileSync` 断言工具名出现在 integration.test.ts）。reverse tool 名以此文件为逐字真相。

### 里程碑研究（roadmapper 已消化大部分）
- `.planning/research/SUMMARY.md` §"Features ... D — Word 选区精度"（uniqueLocalId / text fingerprint / compareLocationWith / desktop null 降级）、§"B-Word 合并后工具表"、§"Spikes required"（S5 = WordApi 1.6 isSetSupported，HIGH）、§"Top risks"（find_and_replace 快照、W3 中文样式名 crash）。
- `.planning/research/FEATURES.md` — B-Word 工具 triage 明细（5 个 do-now + defer 清单）。
- `.planning/research/PITFALLS.md` — §W1 段落 index drift、§W3 中文样式名 locale crash、find_and_replace 不可逆分类、快照上限范式。
- `.planning/research/ARCHITECTURE.md` — §"每 feature 集成点" B-Word 行（新建 `tools/write/word.ts` ToolDef + WordAdapter inverse + operationLog executeReverse case + integration test）。

### 项目记忆（约束 — Word undo 是历史翻车区）
- memory `project_adapter_inverse_signature` — inverse/read 方法收 Record 对象（非位置参）；每个新 inverse 配 `operationLog.integration.test` 守门；手改侦测 read 方法保守 undefined（D-17/D-19 依据）。
- memory `feedback_recurring_failure_add_gate` — 同故障复发 ≥2 次加结构性守门（D-18 依据）。
- memory `project_quality_over_cost` — 质量 >> 成本，但 **undo 守门是数据安全硬门，不软化**（D-18 边界）。

### REQUIREMENTS
- `.planning/REQUIREMENTS.md` §"B 能力补全 · Word"（WORD-01..05）+ §"D Word 选区精度"（WSEL-01）+ 顶部「Undo 约定」段。
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/adapters/WordAdapter.ts` — **核心改动文件**。已有 `Word.run` 闭包范式、`normalizeText`、before-image（`replaceParagraphAt` 返 `{beforeImage}`）、index→内容指纹双重定位（`restoreParagraphAt`，防 index drift）、`read()` 的 `selection_detail` case（D-01 在此扩 paragraphIndex+uniqueLocalId）。新增 5 工具的 adapter 写入方法 + 5 个 inverse 方法（签名 Record，D-17）。
- `src/agent/tools/write/word.ts` — 已有 5 个 ToolDef 范式（reverse descriptor 字面量 + postState）。新增 5 个 Word write ToolDef 照此范式（reverse.args 必 Record 对象，文件头注释已点名 `project-adapter-inverse-signature`）。
- `src/agent/operationLog.ts` — `DocumentAdapterForReplay` 接口（加 5 个新 inverse 方法声明）+ `executeReverse` switch（加 5 个 case）+ `PostStateSnapshot.kind` union（按需扩，D-19）+ `readTargetState`/`isTargetStateConsistent`（新 kind 走保守 undefined）。
- `src/agent/operationLog.integration.test.ts` — D-18 守门测试范式：`mockWord(...)` + 真 `WordAdapter` 实例 + `replayUndoSingle` 断言 `rolled_back` + 收 Record 对象。每工具加一条。
- `src/agent/tools/read/word.ts` — `selection_detail` 无独立 read ToolDef（getSelection 走 UI）；WSEL-01 经 adapter `read({kind:'selection_detail'})` 返回值扩展实现。确认 agent 调用入口（可能复用现有 read tool 或新增 detail tool — planner 定）。
- `src/agent/tools/index.ts` — `buildToolsForHost('word')` 注册新工具（host 隔离已保证）。

### Established Patterns
- adapter 方法在 `Word.run` 闭包内、输入输出纯数据（A-06）；proxy 不出闭包；错误包 `HostApiError`（构造器不存 hostError，防 stack 泄漏）。
- inverse 收 Record 对象；before-image 写前读、存 reverse.args。
- 定位防 index drift：先 index 快路径，不匹配降级内容指纹遍历（`restoreParagraphAt` 已示范）。
- 工具 reverse descriptor 是字面量；OperationLog 真实回放消费。

### Integration Points
- 新建：`tools/write/word.ts` 内新增 5 个 ToolDef（同文件追加）。
- 改：`WordAdapter.ts`（5 写方法 + 5 inverse + selection_detail 扩展）、`operationLog.ts`（接口 + executeReverse + kind）、`contract.test.ts`（5 行 integrationTest→true）、`operationLog.integration.test.ts`（5 守门用例）、`CONTRACT.md`（5 行 status→done）、`tools/index.ts`（注册）。
- 可能改：`WordAdapter.read.test.ts`（selection_detail 扩展单测）、`tools/write/word.test.ts`（5 工具单测）。
</code_context>

<specifics>
## Specific Ideas

ROADMAP Phase 9 五条成功标准（反推 must_haves，planner 须逐条覆盖）：
1. 「把第二段加粗并改 14 号字」→ `set_word_character_format` 改的是第二段而非第一个同名段（paragraphIndex + uniqueLocalId 定位生效）。
2. 「把所有正文段落改为 1.5 倍行距、段前 6pt」→ `set_word_paragraph_format` 参数化单工具调用完成。
3. 「把选中段落套用标题 1 样式」→ `apply_paragraph_style` 用 `Word.BuiltInStyleName` enum，不因语言版本 crash。
4. 「把全文所有『公司』替换成『企业』」→ 改动卡显示改动数 + undo 后文字全部还原（find_and_replace 快照式 undo 生效）。
5. 插入 3×3 表格 → undo 后表格消失（delete_table_by_marker 逆向生效）；每个新 inverse 有 `operationLog.integration.test` 守门。
</specifics>

<deferred>
## Deferred Ideas

- **绝对字符偏移定位（WSEL-D1）** → v2.2（Office.js 无原生 char-offset API，issue #390）。本阶段用 paragraphIndex + uniqueLocalId 折中。
- **文字高亮色 / 项目符号·编号列表 / 批注（WORD-D1）、edit_table / insert_image / 页眉页脚（WORD-D2）** → v2.2。
- **混合格式段的精确 per-run 还原**（D-07 已知限制）→ 若 best-effort 还原真机不满意，可在 v2.2 评估升级为 run-level 快照式。

### Reviewed Todos (not folded)
- `builtin-model-dropdown.md`（DeepSeek + AiHubMix 内置 model 下拉）—— score 0.4 但仅命中关键词「phase」的误匹配，属 Provider/model 配置范畴，与 Phase 9 Word 写工具无关。**不纳入本阶段**（与 08-CONTEXT 同结论）。
</deferred>

---

*Phase: 09-word-d-b-word*
*Context gathered: 2026-05-30*
