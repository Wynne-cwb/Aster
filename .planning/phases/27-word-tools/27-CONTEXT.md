# Phase 27: Word 工具补全 - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning
**Mode:** user-led discuss（team teammate）。本 phase 合约已定、绝大部分为技术事实；仅 1 处产品取向问真人（已拍板，见 G-A）。

<domain>
## Phase Boundary

Phase 27 在 v2.1 Phase 9 既有 Word write 工具范式（5 个工具 + WSEL-01 选区精度 + operationLog replay 守门）之上，给 **Word 宿主** 再补 **5 个高价值 write 工具**，让 agent 能加高亮、转列表、插批注、改页眉页脚、改表格单元格，且**全部可撤销**。

**WHAT 已被 v2.4 REQUIREMENTS + ROADMAP §Phase 27 + 既有 write 合约锁定**——本 phase discuss 不重开 WHAT，只确认灰区二分。**HOW（API 可用性裁定、inverse 实现、定位算法、默认值、降级行为、守门接线）全部是技术事实/可自决**，记录留给 research/plan，不问用户。

**5 个工具（REQUIREMENTS WORD-06~10）：**
| REQ | 能力 | 主 Office.js API（待 plan 验） | 初判 undo 分类 |
|---|---|---|---|
| WORD-06 | 文字加**高亮底色** | `Word.Font.highlightColor` | 简单逆向 |
| WORD-07 | 段落转**项目符号/编号列表** | `Word.Paragraph.startNewList` / `Word.List` / `detachFromList` | 简单逆向（高风险，可能降 noop+gate） |
| WORD-08 | 给指定文字**插入批注** | `Word.Range.insertComment`（WordApi 1.4）+ `Comment.delete` | 简单逆向（按 comment id 删） |
| WORD-09 | 编辑**页眉/页脚**文字 | `Word.Section.getHeader/getFooter` | 简单逆向（before-image 文本） |
| WORD-10 | 编辑已有**表格单元格**内容 | `Word.Body.tables` / `Table.getCell` / `TableCell.body` | 简单逆向（before-image 单元格文本） |

**不在本阶段（已 defer，见 §Deferred）：** Excel/PPT 工具（Phase 28/29）、表格结构编辑（增删行列——REQUIREMENTS WORD-10 明确只「改文字」）、本地图插入/文本框/脚注尾注/目录/分栏（v2.4 Deferred「Word 其余候选」）、页边距/纸张大小（Out of Scope，网页版平台天花板）。

**Requirements covered:** WORD-06, WORD-07, WORD-08, WORD-09, WORD-10
（NFR-12 bundle 全里程碑收口在 Phase 29，但本 phase SC#5 仍要求 build 后 main bundle ≤82KB——见 §Risks R1。）
</domain>

<decisions>
## Decisions（权威决策 + 可自决记录）

> 二分原则：**需人类拍板**（产品取向/UX 品味，无干净默认）才问真人；**可研究/可自决的技术事实**（API 可用性、inverse 实现、定位算法、默认值、casing）一律记录留给 research/plan，不问用户。

### G-A 批注 AI 署名标记（WORD-08）— ✅ 唯一人类决策，已拍板

- **背景（技术事实）：** Office for Web 的 `Range.insertComment(content)` 会自动把批注作者署名为「当前登录的 Office 账号」（即用户本人），**Aster 没有任何 API 能改写 comment 作者**。结果是 AI 生成的批注在文档里与用户手写批注**完全无法区分**。唯一可控的杠杆是**批注内容文本本身**。
- **决策（用户 2026-06-05 拍板）：** **AI 批注内容前缀一个轻量纯文本标记**，让协作/评审时能分辨「AI 建议」vs「人工批注」。
- **约束：**
  - 纯文本前缀，**无 emoji**（遵循设计系统「不用 emoji」铁律）。
  - 建议文案 `「Aster 建议：」` 或 `「[Aster] 」`——**确切措辞 = Claude's Discretion**（plan/research 定，保持克制、简短、与 teal 品牌气质一致）。
  - 标记只加在**内容**里（因 author 字段不可改）。
- **理由：** 产品定位是「AI 代理」，批注是**建议/评审**面（不同于直接文本编辑——那些直接做掉即可）；在共享/评审文档里，匿名混入用户名下的 AI 批注有真实歧义。透明/诚实是项目核心价值。两个选项都合理 → 属用户取向，故问。

### G-B 工具范式（合约已定，事实约束——非灰区）

5 个工具**逐字照搬 Phase 9 Word write 工具范式**，无任何范式创新空间：
- **D-01 inverse 收 Record 对象**（非位置参）——Phase 5 Word 位置签名致真机撤销全挂的硬教训（memory `project_adapter_inverse_signature`）。adapter inverse/write 方法签名一律 `(args: Record<string, unknown>)`，方法体第一行解包。
- **D-02 中文 humanLabel**（每个 write tool 必填，否则 `assertWriteToolRegisterable` 注册期 throw）。
- **D-03 新增 PostStateSnapshot kind**——预判 `word_highlight` / `word_list` / `word_comment` / `word_header_footer` / `word_table_cell`（确切命名 = Claude's Discretion）。新 kind 在 `readTargetState`/`isTargetStateConsistent` **走保守路径（返 undefined / default → 视为一致 → 正常回滚）**，**绝不盲加 read 比对规则**（memory 明示：盲加会误判全部手改 → undo 静默全挂）。
- **D-04 operationLog.integration.test 守门（数据安全硬门，不软化）**——每工具三步缺一 CI 挂：
  1. `src/agent/contract.test.ts` 的 `CONTRACT[]` 加一行，`integrationTest: true`；
  2. `src/agent/operationLog.integration.test.ts` 加「真 `WordAdapter` 实例 + `mockWordRich` → `replayUndoSingle` → 断言 `rolled_back` 且 adapter 收 Record 对象」守门用例（**工具名字符串必须出现在此文件**——contract.test.ts 用 `fs.readFileSync` 硬断言，见其 L118-141）；
  3. `.planning/phases/08-foundation-a-f/CONTRACT.md` 加一行，`status: done` + `integration_test: true`。
- **D-05 reverse_tool 名逐字对齐**——`contract.test.ts` 的 CONTRACT 行、`operationLog.ts` 的 `DocumentAdapterForReplay` 接口声明 + `executeReverse` switch case、tool 的 `reverse.tool` 字面量、adapter inverse 方法名，四处必须自洽。
- **D-06 定位防 index drift**——复用 `restoreParagraphAt`/`restoreRangeFont` 的「index 快路径 → 内容指纹降级遍历 → 找不到抛 HostApiError(skipped_error)」双重定位范式。**绝不静默改错段/错表/错 cell。**

### G-C casing 约定 — ⚠️ 事实更正（可自决，记给 plan）

- **现实：codebase 没有 `WORD_TOOLS` Set。** `src/agent/tools/index.ts` 只有 `PPT_TOOLS` 集合走 `normalizeToSnakeCase`。**既有 5 个 Word write 工具全部用 camelCase 原生参数**（`paragraphIndex` / `uniqueLocalId` / `searchText` / `afterParagraphIndex` / `styleName`…），**不经归一化**，且已三宿主真机 UAT 通过。
- **决策（可自决，推荐）：** 5 个新 Word 工具**沿用 camelCase 参数约定**，只要单工具内 **JSON schema ↔ adapter 解包 ↔ humanLabel 三处 casing 自洽**即可，**无需建 WORD_TOOLS set、无需归一化**。
- **理由：** team-lead 约束里的「入 WORD_TOOLS Set 且 casing 归一化」是把 PPT 教训泛化的措辞；其**真实意图**是「避免 snake/camel 不一致致静默 no-op」（memory `project_ppt_officejs_gotchas`）。Word 端用一致的 camelCase 即满足该意图，引入 set/归一化反而徒增复杂度与 bundle。若 plan 出于某理由选 snake_case，则**必须像 PPT 一样新建归一化 set + 入集**（否则 LLM 发 camelCase 静默丢参）——但不推荐。

### Claude's Discretion（research/plan 可定，不问用户）
- 5 个新 PostStateSnapshot kind 的确切命名（D-03）。
- WORD-08 批注标记的确切文案（G-A，建议 `「Aster 建议：」`，纯文本无 emoji）。
- WORD-06 高亮：**新建独立工具** vs **折进既有 `set_word_character_format` 的 `font` 对象（加 `highlightColor` 字段，复用 `restore_range_font` undo，省一个工具 + 省 bundle）**——后者更经济（D-18 STRAP「工具更少更清晰」+ R1 bundle 极紧），**推荐折入**，但 plan 拍板（折入则 contract 不新增行，只在 before-image 加 highlightColor）。
- WORD-09 页眉页脚默认作用域（建议：第一个 section + primary header/footer；firstPage/evenPages 为 edge，默认 primary）。
- WORD-10 表格定位策略（建议复用 insert_table 的 `tableIndex + contentFingerprint` 双定位）+ 工具名（`edit_table` / `set_table_cell` / 是否支持一次改多 cell）。
- WORD-07 列表：工具名 + bullet/number 参数化形状 + undo 实现（detachFromList vs 快照 vs noop+gate 降级）。
- 各工具 humanLabel 中文文案、参数 description 措辞（精确但删冗余）。

### Folded Todos
无折叠 todo 与本 phase 匹配（Word write 工具补全）。
</decisions>

<research_facts>
## 可研究/可自决事实清单（留给 gsd-plan-phase / research 验证，不问用户）

> 全部为技术事实。Office.js host API 真机可用性 Claude 无法自跑验证（memory `feedback_self_run_spikes`）——research 先查 `@types/office-js` 类型面 + 官方 docs 定 API surface + WordApi 版本，**运行时做 `isSetSupported` 门控 + 降级路径**（参 Phase 9 D-02/D-03，降级路径本身即安全网，不前置阻塞），真机确认列为收尾 UAT。

### 每工具 API 可用性 + undo 实现待验点

- **WORD-06 高亮（`Font.highlightColor`）**
  - [ ] WordApi 版本 + Office for Web 可用性（疑似 WordApi 1.1，HIGH 信心）。
  - [ ] before-image 取 `font.highlightColor` 当前值 → restore；空值/null 表「无高亮」如何写回（条件跳过 null，仿 D-07）。
  - [ ] 取色定位：作用域 = paragraphIndex 整段（仿 set_word_character_format），还是选区？默认整段。
  - [ ] **设计决策**：折进 set_word_character_format（推荐）还是独立工具（见 Discretion）。

- **WORD-07 列表（`Paragraph.startNewList` / `List` / `detachFromList`）** ⚠️ undo 最难
  - [ ] `startNewList()` / `List.setLevelBullet` / `setLevelNumbering` / `Paragraph.detachFromList()` 的 WordApi 版本（疑似 1.3）+ Office for Web 可用性。
  - [ ] before-state 捕获：段落原本是否已在某 list？list level/type？undo 时 detachFromList 能否干净还原「原本不在 list」与「原本在另一个 list」两种态。
  - [ ] **降级裁定**：若 detach 后无法精确还原原列表态 → 诚实降 **noop+gate**（不假装可撤销）。research 必出裁定。
  - [ ] bullet vs number 参数化形状。

- **WORD-08 批注（`Range.insertComment`，WordApi 1.4）**
  - [ ] `Range.insertComment(content)` 返回 `Word.Comment`，取 `.id`；`Comment.delete()` / `document.comments` 的 Office for Web 可用性（WordApi 1.4，GA 较晚，需验网页版）。
  - [ ] inverse = 按 comment id 删（`delete_comment_by_id`）；id 跨 undo 稳定性（capture at insert）。若 id 不可靠 → 降级按「批注锚文本 + 内容指纹」定位删。
  - [ ] 定位被批注的「指定文字」：选区 / paragraphIndex + 文本 search。
  - [ ] **署名标记**（G-A 已定）：内容前缀纯文本标记，写进 content。
  - [ ] author 字段不可改 = 已确认事实，无需再验。

- **WORD-09 页眉/页脚（`Section.getHeader/getFooter`）**
  - [ ] `Word.Section.getHeader(type)` / `getFooter(type)`（type=`Word.HeaderFooterType`）的 WordApi 版本（疑似 1.1）+ Office for Web 可用性 + 返回 Body 可读写。
  - [ ] before-image = 该 header/footer body 全文文本 → restore（insertText replace）。
  - [ ] 作用域默认（第一 section + primary，见 Discretion）；空页眉文档 vs 已有页眉文档两种态。
  - [ ] **写后回读验证**（R3）：网页版 header setText 可能静默 no-op，写后回读确认。

- **WORD-10 表格单元格（`Body.tables` / `Table.getCell` / `TableCell.body`）**
  - [ ] `Body.tables` 加载 + `Table.getCell(row, col)` + `TableCell.body.insertText(replace)` 的 WordApi 版本（疑似 1.3）+ Office for Web 可用性。
  - [ ] before-image = 目标 cell 原文本 → restore；定位 = tableIndex + contentFingerprint 双定位（防多表 + index drift）。
  - [ ] 越界 row/col → NOT_FOUND（recoverable，hint 先读表结构）。
  - [ ] 一次改单 cell vs 多 cell（可自决）。

### 横切技术事实
- [ ] **R1 bundle**：5 工具实现后 `npm run build` → `npm run size`，确认 main `*.js` ≤82KB gzip（余量 ~0.7KB，极紧）。Word 工具/adapter 属 agent 核心路径（非懒加载）。
- [ ] **R3 写后回读**：网页版写操作偶发静默 no-op（memory `project_excel/ppt gotchas`）——highlight / insertComment / header setText 写后回读验证生效。
- [ ] 每工具 `isSetSupported('WordApi', 'X.Y')` 门控 + unsupported 降级（参 Phase 9）。
</research_facts>

<canonical_refs>
## Canonical References（plan/research/execute 必读）

### Phase 27 范式真相源（逐行对齐）
- `src/agent/tools/write/word.ts` — **Phase 9 五工具是逐字模板**（ToolDef 结构 / reverse 字面量 Record / postState kind / 中文 humanLabel / D-08 allowlist 校验 / find_and_replace 快照+超限 noop+gate / insert_table 指纹）。新 5 工具照此追加同文件。
- `src/adapters/WordAdapter.ts` — **核心改动文件**。范式：`Word.run` 闭包内 proxy 不外泄、`normalizeText`、before-image 写前读、only-if-present 写入、inverse 收 Record + index 快路径/内容指纹降级双定位（见 `setCharacterFormat` L474 / `restoreRangeFont` L571 / `insertTable` L1080 / `deleteTableByMarker` L1148）。新增 5 写方法 + 5 inverse 方法。
- `src/agent/operationLog.ts` — `DocumentAdapterForReplay` 接口（加 inverse 方法声明）+ `executeReverse` switch（加 case）+ `PostStateSnapshot.kind` union（加 kind，L34-49）+ `readTargetState`/`isTargetStateConsistent` 新 kind 走保守 default（L221/L290）。
- `src/agent/contract.test.ts` — `CONTRACT[]`（L33-64）加行 + D-17 硬卡（L118-141，`fs.readFileSync` 断言工具名出现在 integration.test）。CONTRACT 长度守门 `>=24`（L144，新增 5 行后变 29，自动通过）。
- `src/agent/operationLog.integration.test.ts` — `mockWordRich`（L256）+ 真 `WordAdapter` + `replayUndoSingle` → `rolled_back` 守门范式（Phase 9 Word 5 例在 L398-499，照此各加一例）。
- `src/agent/tools/index.ts` — `buildToolsForHost('word')`（L275-293）的 `wordWriteTools` 数组注册新工具 + `assertWriteToolRegisterable` 校验。**注意：Word 不入 PPT_TOOLS、不归一化（G-C）。**
- `.planning/phases/08-foundation-a-f/CONTRACT.md` — 能力合约表（人读），加 Phase 27 段 + status/integration_test 翻 true。

### Phase 9 先例（同类 Word write，体例参考）
- `.planning/phases/09-word-d-b-word/09-CONTEXT.md` — Phase 9 discuss 决策体例（D-01~D-19、定位/快照/逆向定位/守门接线），本 phase 范式继承自此。

### 项目记忆（约束 — Word undo 历史翻车区）
- `project_adapter_inverse_signature` — inverse/read 收 Record 对象（非位置参）；每新 inverse 配 integration.test 守门；新 kind read 比对保守 undefined（D-01/D-03/D-04 依据）。
- `project_ppt_officejs_gotchas` / `project_excel_adapter_gotchas` — snake/camel 不一致致静默失败 + 网页版写操作静默 no-op 需写后回读验证（G-C / R3 依据）。
- `feedback_recurring_failure_add_gate` — 同故障复发≥2 次加结构性守门（D-04 依据）。
- `feedback_self_run_spikes` — host API 真机验证 Claude 不自跑，运行时门控+降级即安全网（research_facts 依据）。
- `project_quality_over_cost` — 质量 >> 成本，但 **undo 守门是数据安全硬门，不软化**（D-04 边界）。
- `project_bundle_size_guard` — CI 守 main `*.js` ≤82KB gzip；动 bundle 先 build 再 size，size 测陈旧 dist 给假绿（R1 依据）。

### REQUIREMENTS / ROADMAP
- `.planning/REQUIREMENTS.md` §「C · 工具补全 — Word」WORD-06~10（含各自 API）+ 顶部 write 工具合约段。
- `.planning/ROADMAP.md` §Phase 27（Goal + 5 条 Success Criteria，SC#5 含 integration 守门 + bundle gate）。
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets（直接复用，零范式创新）
- **before-image 写前读 + only-if-present 写入** — `WordAdapter.setCharacterFormat`（L474）/ `setParaFormat`（L630）。WORD-06/09/10 直接套。
- **inverse Record 解包 + 双定位** — `WordAdapter.restoreRangeFont`（L571）：第一行解包 Record，index 快路径 + 内容指纹降级遍历，找不到抛 HostApiError。5 个新 inverse 全照此。
- **指纹定位删除** — `WordAdapter.insertTable`（L1080）/ `deleteTableByMarker`（L1148）：内容指纹 + 行列匹配。WORD-10 表格定位、WORD-08 批注锚定位可借鉴。
- **快照式 undo + 超限 noop+gate** — `findAndReplace`（word.ts L482）：若 WORD-07 列表 undo 走快照或降级，参此结构。
- **noop+gate 诚实降级** — `replaceSelection`（word.ts L635）reverse=`noop_inverse` + reason；WORD-07 若不可逆走此。
- **守门测试夹具** — `mockWordRich`（integration.test L256）+ Phase 9 五例（L398-499）。

### Integration Points（改动清单，5 工具 × 6 处接线）
- **新建/追加**：`tools/write/word.ts`（5 ToolDef，或 WORD-06 折进现有 set_word_character_format）。
- **改 `WordAdapter.ts`**：5 写方法 + 5 inverse 方法（含 isSetSupported 门控 + 降级）。
- **改 `operationLog.ts`**：接口加 5 inverse 声明 + executeReverse 加 5 case + PostStateSnapshot 加 5 kind（read 比对走保守 default）。
- **改 `contract.test.ts`**：CONTRACT 加 5 行（integrationTest:true）。
- **改 `operationLog.integration.test.ts`**：加 5 守门用例（真 WordAdapter，工具名字符串必须出现）。
- **改 `CONTRACT.md`**：加 Phase 27 段，status/integration_test=done/true。
- **改 `tools/index.ts`**：`buildToolsForHost('word')` 注册（不入 PPT_TOOLS）。
- **可能改**：`tools/write/word.test.ts`（5 工具单测）、`WordAdapter.read.test.ts`（若新增定位 read）。

### Established Patterns
- adapter 方法在 `Word.run` 闭包内、纯数据进出（A-06）；proxy 不出闭包；错误包 `HostApiError`（不存 stack，防泄漏）。
- write tool 注册期 `assertWriteToolRegisterable` 校验 humanLabel（缺则 throw）。
- dispatchTool 15s 超时（Word 工具均同步快操作，无需 timeoutMs 覆盖；生图才覆盖）。
</code_context>

<risks>
## Risks

| # | 级别 | 风险 | 缓解 |
|---|---|---|---|
| R1 | **HIGH** | **bundle 余量仅 ~0.7KB**，5 新工具 + adapter 方法 + JSON schema 描述串（纯字符串入主包）可能撑爆 ≤82KB gate（SC#5 本 phase 即要求）。 | 实现后 `npm run build`→`npm run size`（测新 dist，非陈旧）；裁剪 description 冗余；**WORD-06 高亮折进 set_word_character_format 省一个工具**；必要时评估 NFR-12 Phase 29 终收口的取舍。 |
| R2 | MED | **WORD-07 列表 undo 最难**：detachFromList 能否干净还原原列表态（原本不在 list / 原本在另一 list）。 | research 必出裁定；若不可精确还原 → 诚实降 **noop+gate**（不假装可撤销，DiffLog 老实显示「无法自动撤销」）。 |
| R3 | MED | **网页版写操作静默 no-op**（memory gotchas）：highlightColor / insertComment / header setText 在 Office for Web 可能静默失败。 | 写后回读验证生效（如 set 后 reload 比对）；真机 UAT 坐实。 |
| R4 | MED | **WordApi 版本门控**：insertComment(1.4)/startNewList·detachFromList(1.3)/tables(1.3)/getHeader·highlightColor(1.1?) 在 Office for Web 可用性需验。 | 各做 `isSetSupported('WordApi','X.Y')` 门控 + unsupported 降级（参 Phase 9 D-02/D-03）；真机确认列 UAT。 |
| R5 | LOW | **edit_table / header 定位漂移**（多表、多 section）。 | 复用 index + 内容指纹双定位；越界/未命中 → NOT_FOUND（recoverable，不静默改错）。 |
| R6 | LOW | **comment id 跨 undo 稳定性**。 | insert 时 capture id，delete by id；id 不可靠则降级按锚文本指纹删。 |
</risks>

<uat_seeds>
## UAT 种子（真机，Word 宿主，留给里程碑收尾 UAT）

1. **WORD-06 高亮**：选中一段，让 AI「给这段加黄色高亮」→ 高亮出现；undo all → 高亮消失（rolled_back）。
2. **WORD-07 列表**：选中三段，让 AI「改成项目符号列表」→ 变 bullet 列表；undo → 还原普通段落。再验「改成编号列表」。（若 plan 裁定 noop+gate，则 undo 老实显示「无法自动撤销」即 PASS。）
3. **WORD-08 批注**：选中一句，让 AI「给这句加批注：建议改简洁」→ 批注出现且**内容带 `「Aster 建议：」` 纯文本标记**（验 G-A 署名决策）；author=当前账号；undo → 批注消失。
4. **WORD-09 页眉页脚**：让 AI「把页眉改成『公司机密』」→ 页眉文字变更；undo → 还原原页眉。验**空页眉文档 + 已有页眉文档**两种态。
5. **WORD-10 表格单元格**：文档含一张表，让 AI「把第 2 行第 3 列改成『已完成』」→ 单元格文字变更；undo → 还原原文字。验**多表文档定位正确表**。
6. **撤销守门**：每个工具 undo 后 DiffLog 显示 `rolled_back`（非 skipped_error）；`operationLog.integration.test` 5 例全绿。
7. **bundle**：build 后 main `*.js` ≤82KB gzip（`npm run size`，先 build）。
8. **casing/参数**：camelCase 参数无静默丢参/no-op（参 PPT 教训；Word 沿用 camelCase）。
</uat_seeds>

<deferred>
## Deferred Ideas（本 phase 不做）
- **表格结构编辑（增删行列/合并单元格）** → WORD-10 明确只「改文字」；结构编辑后续里程碑 triage。
- **本地图插入 / 文本框 / 脚注尾注 / 目录 / 分栏 / 样式集批量** → v2.4 REQUIREMENTS Deferred「Word 其余候选」。
- **页边距 / 纸张大小** → Out of Scope（Office.js 网页版平台天花板）。
- **批注作者字段真改** → Office.js 无 API（技术天花板）；本 phase 用内容标记折中（G-A）。
- **批注回复/解决（resolve）线程** → 超出 WORD-08「插入批注」范围，未来 triage。
</deferred>

---

*Phase: 27-word-tools*
*Context gathered: 2026-06-05（user-led discuss, team teammate）*
