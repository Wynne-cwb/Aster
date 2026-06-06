# Phase 27: Word 工具补全 - Research

**Researched:** 2026-06-06
**Domain:** Office.js Word API（5 个新 write 工具：高亮/列表/批注/页眉页脚/表格单元格）
**Confidence:** HIGH（API surface 全部经官方文档核实；undo 裁定基于 API 语义分析 + 官方 issue 验证）

---

<user_constraints>
## User Constraints（来自 27-CONTEXT.md）

### Locked Decisions

- **G-A 批注署名（WORD-08）：** AI 批注内容前缀纯文本标记，无 emoji，建议 `「Aster 建议：」` 或 `「[Aster] 」`，确切措辞 Claude's Discretion
- **G-B 合约范式（D-01~D-06）：** 5 工具逐字照搬 Phase 9 Word write 工具范式（inverse 收 Record 对象、中文 humanLabel、PostStateSnapshot kind、integration.test 守门、reverse 名四处对齐、定位双重定位防 drift）
- **G-C casing：** camelCase，不建 WORD_TOOLS Set，不归一化

### Claude's Discretion

- WORD-06：折入 `set_word_character_format` vs 独立工具（CONTEXT 推荐折入）
- WORD-07：工具名 + bullet/number 参数化形状 + undo 实现（detachFromList / noop+gate）
- WORD-08：批注标记确切文案
- WORD-09：默认作用域（建议第一 section + primary）
- WORD-10：定位策略 + 工具名 + 单/多 cell 建议
- 5 个 PostStateSnapshot kind 确切命名

### Deferred Ideas（本 phase 不做）

- 表格结构编辑（增删行列/合并单元格）
- 本地图插入/文本框/脚注/目录/分栏/样式集批量
- 页边距/纸张大小（Office.js 网页版天花板）
- 批注作者字段真改（技术天花板）
- 批注回复/解决线程
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WORD-06 | 用户能让 agent 给选中/指定文字加高亮底色，并可撤销 | `Font.highlightColor` WordApi 1.1，Office for Web 支持；折入 set_word_character_format 方案可行 |
| WORD-07 | 用户能让 agent 把段落转成项目符号/编号列表，并可撤销 | `startNewList`/`detachFromList` WordApi 1.3，Office for Web 支持；undo 裁定为 noop+gate（见下分析） |
| WORD-08 | 用户能让 agent 给指定文字插入批注，并可撤销 | `Range.insertComment`/`Comment.delete`/`Comment.id` 全为 WordApi 1.4，Office for Web 支持 |
| WORD-09 | 用户能让 agent 编辑页眉/页脚文字，并可撤销 | `Section.getHeader`/`getFooter` WordApi 1.1，Office for Web 支持 |
| WORD-10 | 用户能让 agent 编辑已有表格单元格内容，并可撤销 | `Body.tables`/`Table.getCell`/`TableCell` WordApi 1.3，Office for Web 支持 |
</phase_requirements>

---

## Summary

Phase 27 在 Phase 9 既有 5 个 Word write 工具基础上，新增 5 个高价值工具。核心研究发现如下：

**WORD-06 高亮**（`Font.highlightColor`）属于 **WordApi 1.1**，Office for Web 完全支持。推荐设计裁定：**折入既有 `set_word_character_format` 的 `font` 对象**，加一个可选字段 `highlightColor`，复用 `restore_range_font` inverse，省一个工具、省 bundle、不新增 CONTRACT 行。

**WORD-07 列表**（`startNewList`/`detachFromList`/`setLevelBullet`/`setLevelNumbering`）均属 **WordApi 1.3**，Office for Web 理论支持，但存在重大已知问题：`lists.getById()` 在 Word Online 上无条件失败（GitHub issue #6525），且原列表态（附加到已有列表 vs 不在列表中）在 detachFromList 后**无法可靠还原**。**裁定：WORD-07 undo 降级为 noop+gate**，诚实显示「无法自动撤销」，不假装可逆。

**WORD-08 批注**（`Range.insertComment`/`Comment.id`/`Comment.delete`）均属 **WordApi 1.4**，Office for Web 支持，但有已知 bug：通过 API 插入的批注在 Word for Web 中不立即显示，需刷新才可见（GitHub issue #5323）。inverse 用 `comment.id`（插入时 capture）按 id 删除，id 稳定性 HIGH。

**WORD-09 页眉页脚**（`Section.getHeader(type)`/`getFooter(type)`）属 **WordApi 1.1**，Office for Web 支持，返回 `Word.Body` 可读写。before-image 取 body.text 全文，restore 用 `insertText(beforeText, 'Replace')`。默认作用域：第一 section + primary。

**WORD-10 表格单元格**（`Body.tables`/`Table.getCell`/`TableCell.body`/`TableCell.value`）均属 **WordApi 1.3**，Office for Web 支持。before-image 取 `cell.value`（纯文本）或 `body.paragraphs` 文本，restore 写回。定位：tableIndex + contentFingerprint 双定位（复用 deleteTableByMarker 范式）。

**Primary recommendation:** 5 工具按 Phase 9 范式顺序实现；WORD-06 折入 set_word_character_format（省 1 合约行 + bundle）；WORD-07 诚实 noop+gate；bundle 余量 17.5KB gzip（100KB 门控，现 82.48KB），R1 风险已大幅缓解。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Font.highlightColor 写入/读取 | API/Host（Word.run 闭包内） | — | Office.js proxy 不出闭包（A-06） |
| Paragraph.startNewList / List.setLevelBullet | API/Host | — | 同上 |
| Range.insertComment / Comment.delete | API/Host | — | 同上 |
| Section.getHeader/getFooter 写文本 | API/Host | — | 同上 |
| Table.getCell / TableCell.value 写入 | API/Host | — | 同上 |
| inverse 方法（before-image restore） | adapter（WordAdapter.ts） | operationLog.ts | adapter 负责 Word.run 实现；operationLog 负责调度 |
| ToolDef / humanLabel / postState | tools/write/word.ts | tools/index.ts 注册 | Word 工具层，camelCase，不入 PPT_TOOLS |

---

## 每工具详细裁定

---

### WORD-06：文字高亮（highlightColor）

#### API Surface

| 属性 | 类型签名 | WordApi 版本 | Office for Web |
|------|---------|-------------|----------------|
| `Font.highlightColor` | `string`（`#RRGGBB` / 颜色名 / `null` 表无高亮 / `""` 表混合） | **WordApi 1.1** | **支持** |

[VERIFIED: learn.microsoft.com/word/word.font - highlightColor Remarks "API set: WordApi 1.1"]

**Desktop 限制：** Office for Windows Desktop 只支持 15 个标准颜色名（Yellow/Lime/Turquoise/Pink/Blue/Red/DarkBlue/Teal/Green/Purple/DarkRed/Olive/Gray/LightGray/Black），非标准色会被就近转换。Office for Web 无此限制，可接受任意 `#RRGGBB`。

#### 设计裁定：折入 set_word_character_format（推荐）

**推荐：折入**，原因：
1. `highlightColor` 本质是 font 属性之一，与 bold/italic/color/size/name 同级
2. `restoreRangeFont` 已有 before-image 机制，只需在快照里加 `highlightColor` 字段
3. 省一个工具定义、省一条 CONTRACT 行、省 ~0.5KB gzip
4. 不新增 PostStateSnapshot kind（复用 `word_char_format`）
5. D-18 STRAP「工具更少更清晰」原则 + R1 bundle 充裕但节省仍是好习惯

**折入实现要点：**
- `SetWordCharacterFormatArgs.font` 加 `highlightColor?: string | null`
- `setCharacterFormat` 的 loadStr 加 `items/font/highlightColor`
- before-image 的 `beforeImage` 加 `highlightColor: f.highlightColor`
- only-if-present 写入：`if (font.highlightColor !== undefined) f.highlightColor = font.highlightColor as string`
- `restoreRangeFont` 的恢复逻辑加：`if (before.highlightColor !== undefined) f.highlightColor = before.highlightColor as string`（null 写回表示移除高亮，不需要 null-guard 跳过）

**参数形状（折入后无需新参数，只扩展现有 font 对象）：**
```typescript
// 已有工具，扩展 font 对象
font: {
  bold?: boolean;
  italic?: boolean;
  underline?: string;
  size?: number;
  color?: string;
  name?: string;
  highlightColor?: string | null;  // 新增：null 表示移除高亮
}
```

#### before-image 策略

- `f.highlightColor` 读值：`string`（`#RRGGBB`）/ `null`（无高亮）/ `""`（混合）
- 还原时：直接写回 `before.highlightColor`（包括 `null` — 写 null 表移除高亮，这是有意义的）
- 不同于 bold/italic 的「null = 混合态跳过」——高亮 null 有明确语义（无高亮），应写回

#### isSetSupported 门控

```typescript
// highlightColor 是 WordApi 1.1，现有代码基本无需额外门控（1.1 是所有 Word for Web 支持的基础）
// 可在 setCharacterFormat loadStr 时确认，1.1 不需要 isSetSupported 检查
```

#### 降级路径

WordApi 1.1 是 Office for Web 最低支持集，几乎不会不支持。实现时仍可加 try/catch 包 HostApiError，返回 `ok: false` + `UNSUPPORTED`。

---

### WORD-07：段落转列表（startNewList / List / detachFromList）

#### API Surface

| 方法/属性 | WordApi 版本 | Office for Web |
|---------|-------------|----------------|
| `Paragraph.startNewList()` | **WordApi 1.3** | **支持（但有 Word Online bug）** |
| `Paragraph.detachFromList()` | **WordApi 1.3** | **支持（但有 Word Online bug）** |
| `Paragraph.list` / `listOrNullObject` | **WordApi 1.3** | **支持** |
| `Paragraph.listItem` / `listItemOrNullObject` | **WordApi 1.3** | **支持** |
| `List.setLevelBullet(level, listBullet, ...)` | **WordApi 1.3** | **支持** |
| `List.setLevelNumbering(level, listNumbering, ...)` | **WordApi 1.3** | **支持** |
| `List.id` | **WordApi 1.3** | **支持（但 `lists.getById()` 在 Word Online 失败）** |

[VERIFIED: learn.microsoft.com/word/word.paragraph, word.list]
[CITED: github.com/OfficeDev/office-js/issues/6525 — lists.getById() 在 Word Online 无条件失败]

#### 核心 undo 裁定：noop+gate

**分析：**

1. **before-state 捕获**：可以通过 `para.listOrNullObject` + `para.listItemOrNullObject.level` 读取段落的「是否在 list」「list id」「level」。理论上可以区分「原本不在 list」和「原本在 list id=X level=Y」两种状态。

2. **还原「原本不在 list」**：调用 `detachFromList()` 即可从列表移除。看似可逆。

3. **还原「原本在另一个 list」**：需要把段落重新附加到原来的 list（用 `para.attachToList(listId, level)`），但 `lists.getById(listId)` 在 **Word Online 无条件失败**（GitHub issue #6525，2024+，已知 bug，未修复）。这意味着在 Office for Web（Aster MVP 主目标平台）上，无法通过 list id 还原已有列表状态。

4. **独立工具能力**：即使「原本不在 list」的还原是可行的（detachFromList），但「原本在另一个 list」的还原在 Office for Web 上失败——这意味着 undo 只能在一种 before-state 下可靠，另一种失败。这违反「不假装可撤销」原则。

5. **结论：** 裁定降级为 **noop+gate**。

```
实现时诚实降级：
  reverse = { tool: 'noop_inverse', args: { reason: '列表格式转换无法自动撤销，请手动操作' } }
  data.applied 仍返回真实转换数（与 find_and_replace 超限路径一致）
```

**参数形状（camelCase）：**
```typescript
interface SetWordListFormatArgs {
  paragraphIndex: number;           // 目标段落（0-based）
  uniqueLocalId?: string;           // 消歧
  listType: 'bullet' | 'number';    // bullet=项目符号 number=编号
  bulletStyle?: string;             // 可选 bullet 样式：'Solid'|'Hollow'|'Square'|'Arrow'|'Checkmark'
  numberStyle?: string;             // 可选 number 样式：'Arabic'|'UpperRoman'|'LowerRoman'|'UpperLetter'|'LowerLetter'
  level?: number;                   // 列表层级（0-based，默认 0）
}
// 工具名候选：set_word_list_format
// humanLabel: ({ paragraphIndex, listType }) => `将第 ${paragraphIndex+1} 段改为${listType==='bullet'?'项目符号':'编号'}列表`
```

**isSetSupported 门控：**
```typescript
if (!Office.context?.requirements?.isSetSupported('WordApi', '1.3')) {
  return { ok: false, error: { code: 'UNSUPPORTED', message: '当前 Word 版本不支持列表操作（需要 WordApi 1.3）', recoverable: false } };
}
```

**Word Online `lists.getById` 已知 bug：**
- 不要在 inverse 中使用 `lists.getById()`——noop+gate 已规避此风险
- write 方向只用 `startNewList()`，不依赖 getById

---

### WORD-08：插入批注（insertComment）

#### API Surface

| 方法/属性 | WordApi 版本 | Office for Web |
|---------|-------------|----------------|
| `Range.insertComment(content: string): Word.Comment` | **WordApi 1.4** | **支持（有 display bug）** |
| `Word.Comment.id: string` | **WordApi 1.4** | **支持** |
| `Word.Comment.delete(): void` | **WordApi 1.4** | **支持** |
| `Word.Comment.authorName` / `authorEmail` | **WordApi 1.4** | **支持（作者 = 当前登录账号，不可改）** |
| `context.document.comments` collection | **WordApi 1.4** | **支持** |

[VERIFIED: learn.microsoft.com/word/word.comment, word.range]

**已知 bug（Office for Web）：** 通过 API 插入的批注在 Word for Web 上不立即显示，需要浏览器刷新才可见（GitHub issue #5323，2025-01 报告，仍存在）。真机 UAT 需验证这是否影响 Aster 场景（批注 DiffLog 可显示成功，用户手动刷新即可见）。

#### inverse 实现：按 comment.id 删

- insert 时在同一 Word.run 闭包内读 `comment.id`（插入后 load 再 sync）
- inverse args: `{ commentId: string }`
- inverse 方法：遍历 `ctx.document.body.getComments()` 找 id 匹配项调 `.delete()`（或直接通过 document level comments collection）
- **id 稳定性评估：** HIGH——id 在同一 session 内不变，跨 sync 稳定

**降级：id 不可靠时（防御）**
- 若遍历 comments 找不到对应 id，抛 HostApiError → skipped_error（诚实标注，不误删）
- 不需要实现锚文本+内容指纹降级（id 足够可靠）

#### 定位「指定文字」策略

LLM 通过 `paragraphIndex` + 段落文本 search 定位：
```typescript
interface InsertWordCommentArgs {
  paragraphIndex: number;    // 目标段落（0-based）
  searchText: string;        // 批注锚文本（在该段落内搜索）
  commentText: string;       // 批注内容（代码里自动加前缀）
  uniqueLocalId?: string;    // 消歧
}
```

**说明：** `searchText` 若提供，在目标段落内用 `body.search()` 或 `para.search()` 找到 range 再 insertComment；若省略，对整个段落 range insertComment。

#### 批注文案前缀（G-A 裁定）

**裁定：使用 `[Aster] ` 前缀**（方括号格式，比全角书名号括起来更简洁、跨语言通用；无 emoji）

```typescript
const COMMENT_PREFIX = '[Aster] ';
// 实际写入：`[Aster] ${commentText}`
```

备选：`Aster 建议：`——两个都符合约束，选 `[Aster] ` 因为更短更克制。

#### isSetSupported 门控

```typescript
if (!Office.context?.requirements?.isSetSupported('WordApi', '1.4')) {
  return { ok: false, error: { code: 'UNSUPPORTED', message: '当前 Word 版本不支持批注操作（需要 WordApi 1.4）', recoverable: false } };
}
```

#### 写后回读验证

插入后在同一闭包内 load comment.id 并 sync——若 id 为空/undefined，判定为静默失败，返回 error。

---

### WORD-09：页眉页脚编辑（Section.getHeader/getFooter）

#### API Surface

| 方法/属性 | WordApi 版本 | Office for Web |
|---------|-------------|----------------|
| `Section.getHeader(type): Word.Body` | **WordApi 1.1** | **支持** |
| `Section.getFooter(type): Word.Body` | **WordApi 1.1** | **支持** |
| `type` 枚举值 | `"Primary"` / `"FirstPage"` / `"EvenPages"` | — |
| `document.sections` collection | **WordApi 1.1** | **支持** |
| `Body.text` (read) | **WordApi 1.1** | **支持** |
| `Body.insertText(text, location)` | **WordApi 1.1** | **支持（但需写后回读验证）** |

[VERIFIED: learn.microsoft.com/word/word.section - getHeader/getFooter "API set: WordApi 1.1"]

#### before-image 策略

- 写前读 `headerOrFooterBody.text`（全文纯文本）
- restore：`body.insertText(beforeText, Word.InsertLocation.replace)`
- 注意：`text` 属性是纯文本，不含样式——还原时样式丢失（可接受，WORD-09 只要求「改文字」）

#### 默认作用域裁定

- **默认**：第一个 section（`ctx.document.sections.getFirst()`） + `"Primary"` type
- `firstPage`/`evenPages` 为 edge case，通过 `headerFooterType` 参数支持但不默认

#### 空页眉/已有页眉两种态

- 空页眉：`body.text` = `""` 或 `"\r"`（Word 空段落末尾有 `\r`）→ before-image 存空串
- before-image `""` 时，restore 写回 `""` 等效 `insertText("", replace)`（清空页眉）
- 判断「是否原本为空」：`normalizeText(beforeText) === ""`

#### 写后回读验证（R3）

```typescript
// 写入后同一 Word.run 内再次读取
headerBody.load('text');
await ctx.sync();
const afterText = headerBody.text;
// 若 normalizeText(afterText) !== normalizeText(newText)，判定 no-op，返回 error
```

#### 参数形状（camelCase）

```typescript
interface SetWordHeaderFooterArgs {
  text: string;                           // 新页眉/页脚文字
  headerOrFooter: 'header' | 'footer';    // 编辑页眉还是页脚
  type?: 'Primary' | 'FirstPage' | 'EvenPages';  // 默认 'Primary'
  sectionIndex?: number;                  // 默认 0（第一 section）
}
// 工具名候选：set_word_header_footer
// humanLabel: ({ headerOrFooter, text }) => `将${headerOrFooter==='header'?'页眉':'页脚'}改为「${text.slice(0,20)}」`
```

#### isSetSupported 门控

WordApi 1.1 是基础集，无需特殊门控。正常 try/catch 包 HostApiError。

---

### WORD-10：表格单元格编辑（Table.getCell / TableCell）

#### API Surface

| 方法/属性 | WordApi 版本 | Office for Web |
|---------|-------------|----------------|
| `Body.tables: Word.TableCollection` | **WordApi 1.3** | **支持** |
| `Table.getCell(rowIndex, cellIndex): Word.TableCell` | **WordApi 1.3** | **支持** |
| `Table.getCellOrNullObject(rowIndex, cellIndex)` | **WordApi 1.3** | **支持** |
| `TableCell.body: Word.Body` | **WordApi 1.3** | **支持** |
| `TableCell.value: string`（读写，纯文本） | **WordApi 1.3** | **支持** |
| `Table.rowCount: number` | **WordApi 1.3** | **支持** |
| `Table.values: string[][]`（读取所有单元格文本） | **WordApi 1.3** | **支持** |

[VERIFIED: learn.microsoft.com/word/word.tablecell - "API set: WordApi 1.3"]
[VERIFIED: learn.microsoft.com/word/word.table - TableCollection, getCell]

#### before-image 策略

- 写前读 `cell.value`（纯文本）存为 before-image
- restore：`cell.value = beforeValue`（直接赋值写回）
- 注意：`cell.value` 设置时等效 `body.insertText(text, 'replace')`，会覆盖单元格全部文本

#### 定位策略：tableIndex + contentFingerprint 双定位

复用 Phase 9 `deleteTableByMarker`/`insertTable` 的指纹范式：
1. **tableIndex 快路径**：`body.tables.items[tableIndex]`，验证 `table.values` 指纹
2. **内容指纹降级**：遍历 `body.tables.items`，按 `rowCount + values + fingerprint` 找到目标表格
3. 找不到 → 抛 `HostApiError`（NOT_FOUND recoverable）→ DiffLog 显示「表格定位失败」

#### 越界检查

```typescript
// 先 load table.rowCount + table.values
const totalRows = table.rowCount;
const totalCols = (table.values[0] ?? []).length;
if (rowIndex < 0 || rowIndex >= totalRows || colIndex < 0 || colIndex >= totalCols) {
  throw new HostApiError(`editTableCell: 坐标越界 row=${rowIndex} col=${colIndex}（共 ${totalRows}×${totalCols}）`, undefined);
}
```

#### 单 cell vs 多 cell

**裁定：单次只改一个 cell**（WORD-10 范围是「改文字」，多 cell 复杂性倍增，LLM 可多次调用）

#### 参数形状（camelCase）

```typescript
interface EditTableCellArgs {
  tableIndex: number;            // 目标表格编号（0-based），必填
  rowIndex: number;              // 目标行编号（0-based），必填
  columnIndex: number;           // 目标列编号（0-based），必填
  text: string;                  // 新单元格文字，必填
  tableFingerprint?: string;     // 可选内容指纹（防 index drift，强烈建议 LLM 提供）
}
// 工具名候选：edit_table_cell
// humanLabel: ({ tableIndex, rowIndex, columnIndex, text }) => `将表格 ${tableIndex+1} 第 ${rowIndex+1} 行第 ${columnIndex+1} 列改为「${text.slice(0,20)}」`
```

**注意 camelCase 一致性：** `columnIndex`（不用 `colIndex` 或 `col_index`）——schema / adapter 解包 / humanLabel 三处统一。

#### isSetSupported 门控

```typescript
if (!Office.context?.requirements?.isSetSupported('WordApi', '1.3')) {
  return { ok: false, error: { code: 'UNSUPPORTED', message: '当前 Word 版本不支持表格操作（需要 WordApi 1.3）', recoverable: false } };
}
```

---

## 横切技术事实

### R1 Bundle 评估（按 100KB 重估）

**当前状态（实测）：**
- main 初始 bundle：**82.48 KB gzip**（`npm run size` 2026-06-06 实测）
- CI gate 门控：**100 KB gzip**（`.size-limit.json` limit="100 KB"，2026-06-05 上调）
- **余量：约 17.5 KB gzip**

[VERIFIED: .size-limit.json limit="100 KB"; npm run build + size 实测]

**27-CONTEXT.md R1「余量 ~0.7KB / HIGH」已过时**——实际余量充裕。新 5 工具 + adapter 方法估算增量：
- WORD-06 折入（不新增工具 TS 代码，只扩展现有方法）：~0.3 KB gzip
- WORD-07~10 四个工具（ToolDef + adapter write/inverse）：估算 ~4–6 KB gzip
- operationLog.ts 新增 kind + case + 接口声明：~0.5 KB gzip
- **总预计增量：~5–7 KB gzip**，目标 87–90 KB，仍在 100 KB 门控内

**R1 风险等级更新：从 HIGH 降为 LOW**（余量充裕，WORD-06 折入进一步节省）。但仍需实现后 `npm run build && npm run size` 验证（不能测陈旧 dist）。

### R3 写后回读（网页版 no-op 防御）

| 工具 | 写后回读 | 验证点 |
|------|---------|--------|
| WORD-06 highlightColor | 同闭包读 `f.highlightColor` 比对 | 若 `#RRGGBB` 值变空 → 失败 |
| WORD-07（noop+gate） | 不适用（操作仍执行，只是 undo 降级） | — |
| WORD-08 insertComment | 同闭包读 `comment.id` | id 为空 → 失败；注意 display bug（UAT 要求刷新） |
| WORD-09 header/footer | 同闭包写后读 `body.text` 比对 | `normalizeText` 后比对，不一致 → 失败 |
| WORD-10 cell value | 同闭包写后读 `cell.value` 比对 | 不一致 → 失败 |

### R4 isSetSupported 门控范式

参考 Phase 9 `setCharacterFormat` 中的 `supportsUniqueId` 检测模式：

```typescript
// WordApi 1.1（highlightColor, getHeader/getFooter）：基础集，无需特殊门控
// WordApi 1.3（startNewList/detachFromList, tables/getCell/TableCell）：
const supportsListApi = typeof Office !== 'undefined' &&
  Office.context?.requirements?.isSetSupported('WordApi', '1.3') === true;

// WordApi 1.4（insertComment/Comment.delete）：
const supportsCommentApi = typeof Office !== 'undefined' &&
  Office.context?.requirements?.isSetSupported('WordApi', '1.4') === true;

// 不支持时：return { ok: false, error: { code: 'UNSUPPORTED', ... , recoverable: false } }
```

### G-C casing 确认

- 5 工具全部沿用 **camelCase** 参数名（`paragraphIndex` / `uniqueLocalId` / `headerOrFooter` / `tableIndex` / `rowIndex` / `columnIndex`）
- **不建 WORD_TOOLS Set，不归一化**
- JSON schema 属性名 = adapter 解包变量名 = humanLabel 引用名：三处必须自洽

---

## undo 分类一览表

| WORD | 工具名（建议） | undo 分类 | reverseTool | PostStateSnapshot kind（建议） |
|------|-------------|----------|------------|-------------------------------|
| WORD-06 | （折入 set_word_character_format） | 简单逆向 | `restore_range_font`（复用） | `word_char_format`（复用） |
| WORD-07 | `set_word_list_format` | **noop+gate** | `noop_inverse` | `word_list_format` |
| WORD-08 | `insert_word_comment` | 简单逆向 | `delete_comment_by_id` | `word_comment` |
| WORD-09 | `set_word_header_footer` | 简单逆向 | `restore_word_header_footer` | `word_header_footer` |
| WORD-10 | `edit_table_cell` | 简单逆向 | `restore_table_cell` | `word_table_cell` |

**关于 PostStateSnapshot kind 命名：** 新 4 个 kind（WORD-07/08/09/10）在 `readTargetState`/`isTargetStateConsistent` 中走保守 `default`（返回 undefined/true），绝不盲加 read 比对规则（D-03 硬约束）。

---

## 合约接线清单（5 工具 × 6 处）

| 改动位置 | 改动内容 |
|---------|---------|
| `tools/write/word.ts` | WORD-06 折入（扩展现有工具）；WORD-07~10 追加 4 个 ToolDef |
| `WordAdapter.ts` | WORD-06 扩展 setCharacterFormat + restoreRangeFont；WORD-07~10 各加 1 write + 1 inverse 方法 |
| `operationLog.ts` | PostStateSnapshot.kind union 加 4 个；DocumentAdapterForReplay 接口加 4 个 inverse 方法声明；executeReverse 加 4 个 case |
| `contract.test.ts` | CONTRACT[] 加 4 行（integrationTest: true）；CONTRACT 长度守门从 ≥24 → ≥28 |
| `operationLog.integration.test.ts` | 加 4 个守门用例（真 WordAdapter + mockWordRich + replayUndoSingle → rolled_back/skipped_error）；4 个工具名字符串必须出现在文件中 |
| `tools/index.ts` | buildToolsForHost('word') 的 wordWriteTools 加 4 个新工具（不加 WORD-06，它已在原工具里）；不入 PPT_TOOLS |
| `CONTRACT.md`（.planning）| 加 Phase 27 段 + 5 条 status/integration_test |

**WORD-07 noop+gate 特别处理：**
- CONTRACT 行：`undoType: 'noop+gate'`, `reverseTool: 'noop_inverse'`
- integration.test 用例：验证 `replayUndoSingle` → `skipped_error`（因 noop_inverse throw）

---

## Don't Hand-Roll

| Problem | 不要自建 | 用 existing | Why |
|---------|---------|-------------|-----|
| table 指纹生成 | 自写 hash | `buildTableFingerprint`（已在 WordAdapter.ts L38） | Phase 9 已实现，直接复用 |
| 段落双重定位 | 自写定位逻辑 | `restoreRangeFont` 模式（index + normalizeText 遍历） | Phase 9 已验证，逐字复用 |
| noop+gate 结构 | 自创格式 | `replaceSelection` 范式（noop_inverse + reason 字符串） | Phase 9 已定义，逐字复用 |
| 超限快照降级 | 自写降级 | `findAndReplace` D-10 路径 | Phase 9 已定义，WORD-07 直接照搬 |

---

## Common Pitfalls

### Pitfall 1：WORD-07 在 Word Online 上 lists.getById 失败
**什么出错：** 如果 inverse 尝试用 list id 还原原列表，`ctx.document.body.lists.getById(id)` 在 Word Online 无条件抛 GeneralException。
**为何发生：** Word Online 的 List API 支持不完整（已知 bug，GitHub #6525）。
**怎么避免：** 裁定 noop+gate，完全不在 inverse 中使用 getById。

### Pitfall 2：WORD-08 批注在 Word for Web 不立即显示
**什么出错：** insertComment 调用成功（id 有值），但批注在 Word for Web 界面上不可见，需刷新页面。
**为何发生：** Word Online 的批注渲染 bug（GitHub #5323，2025-01，仍存在）。
**怎么避免：** 实现时写后回读 comment.id 确认插入成功；UAT 预期：批注功能正常，但 Word for Web 需刷新才可见——这是平台 bug，不是 Aster bug。

### Pitfall 3：高亮 null 写回语义
**什么出错：** 把 null before-image 当 undefined 跳过写回，结果 undo 后高亮没有移除。
**为何发生：** `Font.highlightColor = null` 是有效写法（移除高亮），不是「混合态跳过」。
**怎么避免：** `restoreRangeFont` 对 `highlightColor` 不做 null-guard 跳过——null 要写回。

### Pitfall 4：TableCell.value vs body.insertText 语义
**什么出错：** 若单元格内有多段落，`cell.value` 只取第一段文本；`body.insertText(..., 'Replace')` 替换全部内容（包括多段）。
**为何发生：** `value` 是首段的快捷属性。
**怎么避免：** WORD-10 before-image 读 `cell.value`（与写入语义对齐），restore 也用 `cell.value = before`。MVP 场景（单元格改文字）无需处理多段落。

### Pitfall 5：Word.Table 无 columnCount 属性
**什么出错：** 试图用 `table.columnCount` 获取列数抛 undefined。
**为何发生：** Word.Table 只有 `rowCount`，列数需从 `values[0].length` 推导（Phase 9 已记录此 gotcha）。
**怎么避免：** 复用 `buildTableFingerprint` 内部已处理此逻辑，不要绕过。

### Pitfall 6：isSetSupported 在非 Office 环境返回 undefined
**什么出错：** `Office.context?.requirements?.isSetSupported('WordApi', '1.3')` 在单元测试环境返回 undefined 而不是 false。
**为何发生：** 测试 mock 中 `Office.context.requirements` 未定义。
**怎么避免：** 判断写 `=== true`（严格），undefined 视为不支持；mock 环境通过 `mockWordRich` 已处理。

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest（项目已配置） |
| Config file | `vite.config.ts`（vitest 配置内联） |
| Quick run command | `npm run test -- --run src/agent/operationLog.integration.test.ts` |
| Full suite command | `npm run test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WORD-06 | highlightColor 折入 set_word_character_format，undo → rolled_back | integration | `npm run test -- --run src/agent/operationLog.integration.test.ts` | ✅ （追加用例） |
| WORD-07 | set_word_list_format undo → skipped_error（noop_inverse throw） | integration | 同上 | ✅（追加用例） |
| WORD-08 | insert_word_comment undo → rolled_back（comment 被删除） | integration | 同上 | ✅（追加用例） |
| WORD-09 | set_word_header_footer undo → rolled_back（页眉还原） | integration | 同上 | ✅（追加用例） |
| WORD-10 | edit_table_cell undo → rolled_back（cell 文字还原） | integration | 同上 | ✅（追加用例） |
| CONTRACT D-17 | 5 工具名出现在 integration.test.ts | CI | `npm run test -- --run src/agent/contract.test.ts` | ✅ |
| NFR bundle | main bundle ≤ 100 KB gzip | CI | `npm run build && npm run size` | ✅ |

### 各工具 undo 验证维度

**WORD-06（折入）：**
- mockWordRich 包含段落 + 已知 font 状态
- entry: `set_word_character_format` + `{ index, expectedText, before: { highlightColor: null, bold: false, ... } }`
- 断言：`replayUndoSingle` → `rolled_back`；`adapter.restoreRangeFont` 被以 Record 对象调用（不抛 TypeError）

**WORD-07（noop+gate）：**
- entry: `set_word_list_format` + `reverse: { tool: 'noop_inverse', args: { reason: '...' } }`
- 断言：`replayUndoSingle` → `skipped_error`（noop_inverse 抛 Error）

**WORD-08（insert_word_comment）：**
- mockWordRich 包含 mock Comment（带 id + delete spy）
- entry: `insert_word_comment` + `reverse: { tool: 'delete_comment_by_id', args: { commentId: 'xxx' } }`
- 断言：`replayUndoSingle` → `rolled_back`；comment.delete spy 被调用

**WORD-09（set_word_header_footer）：**
- mockWordRich 扩展：需 mock sections + getHeader/getFooter 返回 Body（text 可读写）
- entry: `set_word_header_footer` + `reverse: { tool: 'restore_word_header_footer', args: { type: 'Primary', sectionIndex: 0, beforeText: '旧页眉' } }`
- 断言：`replayUndoSingle` → `rolled_back`

**WORD-10（edit_table_cell）：**
- 复用 `mockWordRich` 的 `tables` fixture（已有 table mock 结构）
- entry: `edit_table_cell` + `reverse: { tool: 'restore_table_cell', args: { tableIndex: 0, tableFingerprint: '...', rowIndex: 0, columnIndex: 0, beforeValue: '原内容' } }`
- 断言：`replayUndoSingle` → `rolled_back`

### Sampling Rate

- **Per task commit（每个计划完成）：** `npm run test -- --run src/agent/operationLog.integration.test.ts src/agent/contract.test.ts`
- **Per wave merge：** `npm run test -- --run`（全套绿）
- **Phase gate（before /gsd-verify-work）：** 全套绿 + `npm run build && npm run size` 确认 ≤ 100 KB

### Wave 0 Gaps

- [ ] `operationLog.integration.test.ts` — 追加 4 个守门用例（WORD-07/08/09/10；WORD-06 折入已有用例扩展）
- [ ] `mockWordRich` fixture 扩展 — 需增加 comments mock（带 id + delete spy）和 sections/header/footer mock
- [ ] `WordAdapter.ts` — 5 个 write 方法 + 5 个 inverse 方法（WORD-07 只有 write，inverse = noop）
- [ ] `operationLog.ts` — 4 个 PostStateSnapshot kind + 4 个接口声明 + 4 个 executeReverse case

---

## Environment Availability

本 phase 纯代码改动，无外部服务依赖。

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Office.js CDN | Runtime（真机） | — | WordApi 1.1~1.4 均 GA | isSetSupported 门控 + 优雅降级 |
| Vitest | CI 守门 | ✓ | （项目已配置） | — |
| size-limit | bundle CI | ✓ | limit=100KB | — |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Font.highlightColor` = WordApi 1.1，Office for Web 支持 | WORD-06 | 已 VERIFIED（官方文档 highlightColor Remarks: "API set: WordApi 1.1"）；风险极低 |
| A2 | `lists.getById()` 在 Word Online 无条件失败（GitHub #6525）导致 WORD-07 必须 noop+gate | WORD-07 | [CITED: github.com/OfficeDev/office-js/issues/6525]；若 Microsoft 已修复则 WORD-07 可升级为真正可逆；UAT 验证时检查 |
| A3 | `Comment.id` 在 insert 后同一 Word.run 内稳定，可用于 inverse | WORD-08 | [ASSUMED]（无官方明确说明 id 跨 sync 的生命周期保证）；若不稳定则降级锚文本+内容指纹；真机 UAT 验证 |
| A4 | `Body.insertText(text, 'Replace')` 能正确替换 header/footer 内容 | WORD-09 | [ASSUMED]（官方 Section 示例用 `insertText(text, 'End')`，`'Replace'` 等价于 `'replace'`）；若不支持则改用 `clear()` + `insertText` |
| A5 | `TableCell.value = text` 直接赋值等效替换单元格文本 | WORD-10 | [VERIFIED: "Specifies the text of the cell"，可读写]；行为是替换全部文本；低风险 |
| A6 | 批注 display bug（issue #5323）不影响 Aster 功能正确性（只是 Word for Web 的显示延迟） | WORD-08 | [CITED]；若 UAT 判定为阻塞问题，需告知用户刷新；不影响 DiffLog 显示 |
| A7 | main bundle 增量 ~5-7 KB gzip（WORD-07~10 四工具 + adapter） | R1 | [ASSUMED]（基于 Phase 9 五工具 ~3 KB 增量的类比估算）；必须实现后实测验证 |

---

## Open Questions

1. **WORD-07 lists.getById bug 是否已修复（2026-06）**
   - 已知：GitHub issue #6525 于 2024 报告，截止 research 日期未找到修复记录
   - 不确定：Microsoft 可能在 2026-06 的 Office for Web 版本中已修复
   - 建议：Phase 收尾 UAT 验证 Word Online 上能否调 `lists.getById()`；若已修复，WORD-07 undo 可从 noop+gate 升级为真正可逆（但这是 bonus，不是 v2.4 承诺）

2. **WORD-08 comment display bug（issue #5323）UAT 影响程度**
   - 已知：2025-01 报告，API 插入的批注在 Word for Web 需刷新才可见
   - 不确定：当前（2026-06）是否仍存在，或 Office for Web 是否修复
   - 建议：UAT-08 步骤包含「验证刷新前后批注可见性」

3. **WORD-09 header/footer `insertText(..., 'Replace')` 行为**
   - 已知：Word.Body 的 `insertText` 官方示例用 `'End'`，`'Replace'` 是枚举值之一
   - 不确定：header/footer Body 的 insertText 是否支持 `'Replace'` location（body body 支持，header/footer body 理论也支持）
   - 建议：Wave 0 spike 在真机验证；降级方案 = `clear()` + `insertText(text, 'Start')`

---

## Sources

### Primary（HIGH confidence）
- [Word.Font class — highlightColor](https://learn.microsoft.com/en-us/javascript/api/word/word.font?view=word-js-preview) — highlightColor Remarks: WordApi 1.1
- [Word.Section class — getHeader/getFooter](https://learn.microsoft.com/en-us/javascript/api/word/word.section?view=word-js-preview) — WordApi 1.1
- [Word.List class — setLevelBullet/setLevelNumbering](https://learn.microsoft.com/en-us/javascript/api/word/word.list?view=word-js-preview) — WordApi 1.3
- [Word.Paragraph class — startNewList/detachFromList](https://learn.microsoft.com/en-us/javascript/api/word/word.paragraph?view=word-js-preview) — WordApi 1.3
- [Word.Comment class — id/delete/authorName](https://learn.microsoft.com/en-us/javascript/api/word/word.comment?view=word-js-preview) — WordApi 1.4
- [Word.TableCell class — body/value](https://learn.microsoft.com/en-us/javascript/api/word/word.tablecell?view=word-js-preview) — WordApi 1.3
- [Word API requirement sets table](https://learn.microsoft.com/en-us/javascript/api/requirement-sets/word/word-api-requirement-sets?view=common-js-preview) — WordApi 1.1~1.9 + WordApiDesktop 可用性矩阵

### Secondary（MEDIUM confidence）
- [GitHub OfficeDev/office-js #6525 — lists.getById() 在 Word Online 失败](https://github.com/OfficeDev/office-js/issues/6525) — 2024 报告，WORD-07 noop+gate 裁定依据
- [GitHub OfficeDev/office-js #5323 — Comment 不立即显示（Word for Web）](https://github.com/OfficeDev/office-js/issues/5323) — 2025-01 报告，WORD-08 UAT 注意事项

### Tertiary（LOW confidence）
- [DefinitelyTyped #72801 — @types/office-js listItem 类型不完整](https://github.com/DefinitelyTyped/DefinitelyTyped/issues/72801) — 提示 list 相关 TS 类型可能需要 `as any` 规避

---

## Metadata

**Confidence breakdown:**
- WORD-06 API surface: HIGH — 官方文档直接核实 highlightColor = WordApi 1.1
- WORD-07 API surface: HIGH — 官方文档核实；undo 裁定 noop+gate: HIGH（Word Online bug 已 cited）
- WORD-08 API surface: HIGH — 官方文档核实；id 稳定性: MEDIUM（无官方保证，但合理推断）
- WORD-09 API surface: HIGH — 官方文档核实；insertText('Replace') 行为: MEDIUM
- WORD-10 API surface: HIGH — 官方文档核实
- bundle 估算: LOW（基于类比，需实测）

**Research date:** 2026-06-06
**Valid until:** 2026-07-06（30 天，API surface 稳定；Word Online bug 状态可能变化）
