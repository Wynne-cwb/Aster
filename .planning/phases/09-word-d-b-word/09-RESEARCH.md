# Phase 9: Word 精准写 (D + B-Word) — Research

**Researched:** 2026-05-30
**Domain:** Word JS API 1.1–1.6，段落格式 / 字符格式 / 样式 / 查替换 / 表格，OperationLog inverse 基础设施
**Confidence:** HIGH（5 个核心 API 域全部由 Microsoft Learn 官方文档直接验证；Undo 基础设施由代码审计验证）

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**G-A 选区精度（WSEL-01 / D feature）**
- D-01：`paragraphIndex`（0-based，必填）为主锚；`uniqueLocalId`（WordApi 1.6）为可选消歧/校验位
- D-02：S5 不阻塞——运行时 `isSetSupported('WordApi','1.6')` 门控 + 降级路径，不前置 spike
- D-03：不支持 / desktop 返 null → 降级为 `paragraphIndex + 内容指纹` 定位；`selection_detail` 在 unsupported 时返 `uniqueLocalId: null`
- D-04：定位失败 → 返 `NOT_FOUND`（recoverable），绝不静默改错段

**G-B 简单逆向三工具（WORD-01 / WORD-02 / WORD-03）**
- D-05：作用域 = 整段（paragraphIndex 指定段落的整个 range）
- D-06：before-image 属性包：character → `{bold,italic,underline,size,color,name}`；paragraph → `{lineSpacing,spaceBefore,spaceAfter,alignment,indent}`；style → **同时存 `style`（名）+ `styleBuiltIn`**
- D-07：混合格式段 best-effort 还原（null 属性按原样写回），已知限制不升级
- D-08：`apply_paragraph_style` 仅接 `Word.BuiltInStyleName` enum 值，工具层 allowlist 校验，非法值在调 Word **之前**拒掉

**G-C find_and_replace 快照（WORD-04）**
- D-09：快照粒度 = 受影响段落整段 before-image 列表（按 paragraphIndex → 该段原文本）
- D-10：受影响段落数 ≤ 上限（planner 按实测定，建议 200）→ 快照式 undo；超限 → noop+gate + warn
- D-11：`matchCase` / `matchWholeWord` 透传给 `body.search` 的 searchOptions
- D-12：execute 返 `{ replaced: N }`，humanLabel 显示替换数

**G-D insert_table 逆向（WORD-05）**
- D-13：marker = 插入时内容指纹 `{ contentFingerprint, rows, cols, afterParagraphIndex }`，`delete_table_by_marker` 按指纹遍历 `body.tables` 匹配删除
- D-14：空表后备 → 行列数 + 位置锚匹配；定位不到 → `skipped_error`
- D-15：`afterParagraphIndex` 提供 → 该段后插入；省略 → 文档末尾

**G-E Undo 基础设施（贯穿 5 工具）**
- D-16：reverse tool 名逐字对齐 CONTRACT：`restore_range_font` / `restore_paragraph_format` / `restore_paragraph_style` / `restore_range_snapshot` / `delete_table_by_marker`
- D-17：inverse 签名一律 `(args: Record<string, unknown>)`（硬约束，Phase 5 教训）
- D-18：D-17 守门做成每工具显式 plan 任务，acceptance 三步缺一 CI 挂
- D-19：新 `PostStateSnapshot.kind` 的 `readTargetState` 返 `undefined`（保守）

### Claude's Discretion
- find_and_replace 快照上限的具体数字（D-10）
- insert_table marker 指纹的具体字段组合（D-13）
- 新 `PostStateSnapshot.kind` 命名（D-19）
- 5 工具的 humanLabel 文案、参数 description 中文措辞

### Deferred Ideas (OUT OF SCOPE)
- 绝对字符偏移定位 WSEL-D1 → v2.2
- 文字高亮 / 项目符号·编号列表 / 批注（WORD-D1）→ v2.2
- edit_table / insert_image / 页眉页脚（WORD-D2）→ v2.2
- 混合格式段精确 per-run 还原 → v2.2 评估
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WSEL-01 | `selection_detail` read tool 返回 `paragraphIndex` + `uniqueLocalId`（WordApi 1.6，isSetSupported 门控），精准定位多相同文本段落 | §Q4 uniqueLocalId API 详解 + §Q5 selection_detail 扩展方案 |
| WORD-01 | `set_word_character_format` 设置字符格式（加粗/斜体/下划线/字号/颜色/字体名），简单逆向 `restore_range_font` | §Q1 Font read/write API 详解 |
| WORD-02 | `set_word_paragraph_format` 设置段落格式（对齐/行距/段前后距/缩进），简单逆向 `restore_paragraph_format` | §Q2 段落格式 API 详解 |
| WORD-03 | `apply_paragraph_style` 套用内置样式（`Word.BuiltInStyleName` enum），locale-safe，简单逆向 `restore_paragraph_style` | §Q3 locale-safe 样式 API |
| WORD-04 | `find_and_replace` 全文查找替换，快照式 undo `restore_range_snapshot`，返替换数 | §Q6 body.search API |
| WORD-05 | `insert_table` 插入表格并填内容，简单逆向 `delete_table_by_marker` | §Q7 Table API + marker 方案 |
</phase_requirements>

---

## Summary

Phase 9 在现有 agent loop / adapter / operationLog 基础上，向 Word 宿主新增 5 个 write tool + 扩展 `selection_detail` read。所有 API 均在 Word JS API 1.1–1.6 范围内，Office for Web 完全支持，无新增运行时依赖。

核心风险集中在两点：一是 `find_and_replace` 的快照式 undo——需枚举所有匹配段落存 before-image，超限降级 noop+gate；二是 `insert_table` 的逆向定位——Word.Table 无 uniqueLocalId，需用内容指纹 + 行列数 + 位置锚组合标记。`uniqueLocalId` (WordApi 1.6) 已于 2023-08 GA，Office for Web 完全支持，不需前置 spike。

undo 基础设施扩展路径清晰：5 个新的 `DocumentAdapterForReplay` 方法声明 + 5 个 `executeReverse` case + 可选的新 `PostStateSnapshot.kind`（readTargetState 保守返 undefined）。每个 inverse 必须有 `operationLog.integration.test` 守门（D-17/D-18），这是本阶段最重要的数据安全硬门。

**Primary recommendation:** 按 Word.run 单闭包范式逐工具实现，adapter 方法读写分离（写前先读原值存 before-image），inverse 签名严格 `Record<string, unknown>`。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| paragraphIndex 定位 + uniqueLocalId 消歧 | API / Backend (WordAdapter) | — | Office.js Word.run 闭包内 proxy 操作，不触碰浏览器/DOM 层 |
| set_word_character_format 写入 + before-image | API / Backend (WordAdapter) | — | paragraph.font.* read+write 在 Word.run 闭包内完成 |
| set_word_paragraph_format 写入 + before-image | API / Backend (WordAdapter) | — | paragraph.lineSpacing/spaceBefore 等在闭包内 |
| apply_paragraph_style（locale-safe）| API / Backend (WordAdapter) | — | styleBuiltIn enum 校验在 tool 层，写入在 adapter 层 |
| find_and_replace 快照枚举 + 文本替换 | API / Backend (WordAdapter) | — | body.search → RangeCollection，逐 range 操作 |
| insert_table + marker 生成 | API / Backend (WordAdapter) | — | body.insertTable + table.values 在闭包内 |
| OperationLog inverse 路由 | API / Backend (operationLog.ts) | — | executeReverse switch，不接触 Office 命名空间 |
| tool schema allowlist 校验（BuiltInStyleName）| Frontend (ToolDef.execute) | — | 在调 adapter 之前，tool 层先做参数校验 |
| selection_detail read（WSEL-01）| API / Backend (WordAdapter.read) | — | selection_detail case 扩展，getRange().compareLocationWith |

---

## Standard Stack

### Core（全部已安装，0 净新增）

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Office.js CDN | `https://appsforoffice.microsoft.com/lib/1/hosted/office.js` | Word JS API runtime（Word.run, paragraph.font, body.search 等）| CDN 版本带安全修复，npm 包已废弃 |
| `@types/office-js` | latest (devDep) | TypeScript 类型（Word.Font, Word.BuiltInStyleName, Word.Table 等）| Microsoft 维护，严格模式下捕获 proxy 使用错误 |
| TypeScript 5.7+ | `^5.7` | 语言 | strict 模式下 null/undefined 检查对 mixed-format null 有实际防护作用 |
| Vitest | 已安装 | 单测 + integration test | 项目统一测试框架 |

**Version verification:** 所有库均已安装，版本已通过 package.json 审计。[VERIFIED: codebase]

**安装命令：** 无（0 净新增依赖）。

---

## Architecture Patterns

### System Architecture Diagram

```
Agent Loop (loop.ts)
    │
    ├─► ToolDef.execute (tools/write/word.ts — 5 new tools)
    │       │
    │       ├─ [apply_paragraph_style] allowlist check (BuiltInStyleName) ──► HostApiError if invalid
    │       │
    │       └─► WordAdapter.method(args)
    │               │
    │               └─ Word.run(async ctx => {
    │                       paras.load(...)
    │                       ctx.sync()           ← read 原值（before-image）
    │                       para.font.* = ...    ← write
    │                       ctx.sync()           ← 生效
    │                   })
    │                   returns { beforeImage / snapshot / tableMarker }
    │
    ├─► OperationLogEntry { reverse: { tool, args: Record }, postState? }
    │
    └─► ToolResult { ok, data, reverse, postState }

undo path:
replayUndoSingle(entry, adapter)
    │
    └─► executeReverse(reverse, adapter)
            │
            ├─ 'restore_range_font'       → adapter.restoreRangeFont(args)
            ├─ 'restore_paragraph_format' → adapter.restoreParagraphFormat(args)
            ├─ 'restore_paragraph_style'  → adapter.restoreParagraphStyle(args)
            ├─ 'restore_range_snapshot'   → adapter.restoreRangeSnapshot(args)
            └─ 'delete_table_by_marker'   → adapter.deleteTableByMarker(args)
                    │
                    └─ Word.run 闭包 → 还原操作 → ctx.sync()
```

### Recommended Project Structure

```
src/
├── adapters/
│   └── WordAdapter.ts          ← 改：+setCharacterFormat / +setParaFormat /
│                                        +applyParaStyle / +findAndReplace /
│                                        +insertTable (write) +
│                                        restoreRangeFont / restoreParagraphFormat /
│                                        restoreParagraphStyle / restoreRangeSnapshot /
│                                        deleteTableByMarker (inverse，Record 签名) +
│                                        selection_detail 扩展（paragraphIndex+uniqueLocalId）
├── agent/
│   ├── operationLog.ts         ← 改：DocumentAdapterForReplay +5 方法声明 +
│   │                                   executeReverse +5 case +
│   │                                   PostStateSnapshot.kind 可选扩展
│   ├── operationLog.integration.test.ts  ← 改：+5 守门测试（每工具一条）
│   ├── contract.test.ts        ← 改：5 行 integrationTest: false → true
│   └── tools/
│       ├── write/
│       │   └── word.ts         ← 改：+5 ToolDef（复用现有范式）
│       └── index.ts            ← 改：buildToolsForHost('word') 注册 5 新工具
└── planning/phases/08-foundation-a-f/
    └── CONTRACT.md             ← 改：5 行 status: planned → done + integration_test → true
```

---

## Research Findings by Question

### Q1: Word.Font read/write — before-image 属性包

**API 路径：** `paragraph.font`（只读属性，返回 `Word.Font` 对象；对象本身属性可写）

**Phase 9 所需属性（全部 WordApi 1.1）：**

| 属性 | 类型 | API Set | 混合格式时返回 |
|------|------|---------|--------------|
| `bold` | `boolean` | WordApi 1.1 | `null`（混合）|
| `italic` | `boolean` | WordApi 1.1 | `null`（混合）|
| `underline` | `Word.UnderlineType \| "Mixed" \| "None" \| "Single" \| ...` | WordApi 1.1 | `"Mixed"` |
| `size` | `number` | WordApi 1.1 | `null`（混合）|
| `color` | `string`（`#RRGGBB` 或颜色名） | WordApi 1.1 | 空字符串或 `null`（混合；具体行为见 Pitfalls）|
| `name` | `string` | WordApi 1.1 | `null`（混合）|

[VERIFIED: learn.microsoft.com/javascript/api/word/word.font]

**混合格式的 `null` 语义（D-07）：**

文档明确说明：`bold`、`italic`、`size`、`name` 等 boolean/number 属性在"部分文本有属性、部分没有"时返回 `null`。`underline` 在混合时返回字符串 `"Mixed"`（而非 `null`）。

D-07 决策（best-effort 还原）的实现：写回 before-image 时，`null` 属性直接 `font.bold = null` 是 valid 的 Word JS API 操作，表示"重置为继承"。**这个行为需要 UAT 验证**，因为 TypeScript 类型上 `bold: boolean`，但 Word JS API 实际上接受 `null` 作为"清除覆盖"语义。[ASSUMED: null write-back behavior — 需 UAT 验证]

**before-image 读取范式（paragraph 上的 font）：**

```typescript
// Source: Microsoft Learn Word.Font / Word.Paragraph
// 在 Word.run 闭包内
para.font.load('bold,italic,underline,size,color,name');
await ctx.sync();
const beforeImage = {
  bold: para.font.bold,         // boolean | null
  italic: para.font.italic,     // boolean | null
  underline: para.font.underline, // string (UnderlineType | "Mixed")
  size: para.font.size,         // number | null
  color: para.font.color,       // string | null
  name: para.font.name,         // string | null
};
```

**write 范式（还原时同样适用）：**

```typescript
// Source: Microsoft Learn Word.Font examples
para.font.bold = beforeImage.bold;     // null = 清除覆盖
para.font.italic = beforeImage.italic;
para.font.underline = beforeImage.underline as Word.UnderlineType;
para.font.size = beforeImage.size;
para.font.color = beforeImage.color;
para.font.name = beforeImage.name;
await ctx.sync();
```

**`underline` 的特殊处理：** `Word.UnderlineType` enum 包含 `"Mixed"` / `"None"` / `"Single"` / `"Double"` / `"Word"` 等。写入时，应将存储的 `"Mixed"` 原样写回（Word 接受此值表示混合下划线状态）。[ASSUMED: "Mixed" is writable — 需 UAT 验证]

---

### Q2: Word 段落格式 — 精确 API

**全部 WordApi 1.1，全部 read+write，单位均为磅（points）：**

| 属性 | 类型 | 单位 | 说明 |
|------|------|------|------|
| `lineSpacing` | `number` | points | 行距（Word UI 显示值 ÷ 12 不适用；直接是磅值，如 1.5 倍行距 = 18pt 对于 12pt 字体）|
| `spaceBefore` | `number` | points | 段前距 |
| `spaceAfter` | `number` | points | 段后距 |
| `alignment` | `Word.Alignment \| "Left" \| "Centered" \| "Right" \| "Justified" \| "Mixed" \| "Unknown"` | enum | 对齐方式 |
| `firstLineIndent` | `number` | points | 首行缩进（正值）/ 悬挂缩进（负值）|
| `leftIndent` | `number` | points | 左缩进 |
| `rightIndent` | `number` | points | 右缩进（v2.1 暂不暴露，参数化合并入 indent 后备）|

[VERIFIED: learn.microsoft.com/javascript/api/word/word.paragraph]

**before-image 读取：**

```typescript
// Source: Microsoft Learn Word.Paragraph
para.load('lineSpacing,spaceBefore,spaceAfter,alignment,firstLineIndent,leftIndent');
await ctx.sync();
const beforeImage = {
  lineSpacing: para.lineSpacing,       // number | null（混合段落）
  spaceBefore: para.spaceBefore,
  spaceAfter: para.spaceAfter,
  alignment: para.alignment,           // "Mixed" 或具体枚举值
  indent: para.firstLineIndent,        // D-06 约定名为 indent，存 firstLineIndent
  leftIndent: para.leftIndent,
};
```

**注意：** CONTEXT.md D-06 约定 before-image 字段名为 `indent`，这对应 `paragraph.firstLineIndent`（最常用的缩进属性）。planner 须在 args schema 明确 `indent` 映射 `firstLineIndent`，避免歧义。[ASSUMED: indent → firstLineIndent 是正确映射；v2.1 不暴露 rightIndent]

**行距换算参考（供 humanLabel 显示）：**

Word UI 中"1.5 倍行距"= `lineSpacing = 18`（假设基础字号 12pt）。实际上 `lineSpacing` 存储的是绝对磅值，不是倍数。若 agent 需要设置"1.5 倍行距"，需要先读字号再换算，或在 tool description 注明接受磅值（成功标准 #2 直接接受 1.5 倍行距字面值，planner 须决定参数策略）。[ASSUMED: 成功标准 #2 的「1.5 倍行距」指以倍数传参，tool 内部换算]

---

### Q3: apply_paragraph_style — locale-safe 路径

**`paragraph.style`（string，WordApi 1.1）：** 使用本地化样式名。中文 Office 下"正文"、"标题 1"等才有效；英文 Office 下无效 → locale crash（PITFALLS §W3）。**Phase 9 禁止在工具层接受此形式的用户输入。**

**`paragraph.styleBuiltIn`（`Word.BuiltInStyleName` enum，WordApi 1.3）：** 跨 locale 可移植。枚举值为 Pascal 字符串，如 `"Heading1"` / `"Normal"` / `"Quote"` 等。

[VERIFIED: learn.microsoft.com/javascript/api/word/word.builtinstylename]

**Phase 9 可用的关键 BuiltInStyleName 值（WordApi 1.3）：**

```
"Heading1" / "Heading2" / ... / "Heading9"   — 标题 1–9
"Normal"                                      — 正文
"NoSpacing"                                   — 无间距
"Title"                                       — 标题
"Subtitle"                                    — 副标题
"Quote"                                       — 引用
"IntenseQuote"                               — 明显引用
"ListParagraph"                              — 列表段落
"Caption"                                    — 题注
"Strong" / "Emphasis" / "IntenseEmphasis"   — 加粗/强调/明显强调
"BookTitle"                                  — 书名
"Other"                                       — 混合或列表外样式（只读）
```

**allowlist 校验实现（tool 层，调 Word 之前）：**

```typescript
// Source: Microsoft Learn Word.BuiltInStyleName
const VALID_BUILTIN_STYLES = new Set([
  'Heading1','Heading2','Heading3','Heading4','Heading5',
  'Heading6','Heading7','Heading8','Heading9',
  'Normal','NoSpacing','Title','Subtitle',
  'Quote','IntenseQuote','ListParagraph','Caption',
  'Strong','Emphasis','IntenseEmphasis','BookTitle',
  // 扩展需要时加，不用穷举全部（gridTable/listTable 系列太多）
]);
if (!VALID_BUILTIN_STYLES.has(args.styleName)) {
  return { ok: false, error: { code: 'INVALID_PARAM', message: `未知样式名：${args.styleName}。可用值：Heading1–9, Normal, Quote 等`, recoverable: true } };
}
```

**before-image 同时存两者（D-06）：**

```typescript
// Source: Microsoft Learn Word.Paragraph
para.load('style,styleBuiltIn');
await ctx.sync();
const beforeImage = {
  style: para.style,            // 本地化名，还原时可能无效，但保留作参考
  styleBuiltIn: para.styleBuiltIn, // 跨 locale 名，undo 优先用此
};
// write:
para.styleBuiltIn = args.styleName as Word.BuiltInStyleName;
// restore (inverse):
// 优先用 styleBuiltIn 还原；若 styleBuiltIn === "Other"（自定义样式），回退用 style
if (args.styleBuiltIn !== 'Other') {
  para.styleBuiltIn = args.styleBuiltIn as Word.BuiltInStyleName;
} else {
  para.style = args.style as string;
}
```

[VERIFIED: learn.microsoft.com/javascript/api/word/word.paragraph — styleBuiltIn, style]

---

### Q4: paragraph.uniqueLocalId（WordApi 1.6）

**属性：** `paragraph.uniqueLocalId: string`（readonly）

**返回值：** 标准 GUID 格式（8-4-4-4-12），不含花括号

**API set：** WordApi 1.6

**Office for Web 支持：** Supported（官方表格显示 Word 1.6 on the web = Supported）[VERIFIED: learn.microsoft.com/javascript/api/requirement-sets/word/word-api-requirement-sets]

**WordApi 1.6 GA 日期：** 官方文档显示对应 Office 版本 Build 16731.20234（2023-08）

**跨 session 行为：** ID 在不同 session 之间不同（"differs across sessions and coauthors"），仅在同一 Word.run 调用期间稳定。也就是说：一次 agent turn 内读到的 uniqueLocalId 在下一次 Word.run 中可能已经变化。[VERIFIED: Microsoft Learn Word.Paragraph.uniqueLocalId]

**Desktop Word 问题（GitHub issue #4258）：** Desktop Word 下 `uniqueLocalId` 返回 `null`。v2.1 目标平台为 Office for Web，此问题可降级处理（D-03）。

**isSetSupported 运行时门控（D-02）：**

```typescript
// Source: Microsoft Learn / Office.js CDN pattern
const supportsUniqueLocalId = Office.context.requirements.isSetSupported('WordApi', '1.6');
// 在 Word.run 闭包内：
if (supportsUniqueLocalId) {
  para.load('text,uniqueLocalId');
} else {
  para.load('text');
}
await ctx.sync();
const uniqueLocalId = supportsUniqueLocalId ? para.uniqueLocalId : null;
```

**消歧逻辑（D-03 快路径 + 降级）：**

```typescript
// Source: CONTEXT.md D-03 + SUMMARY.md §D
// 工具调用时：paragraphIndex 是主锚，uniqueLocalId 是可选校验位
// 快路径：paragraphIndex 命中 + uniqueLocalId 校验
if (
  uniqueLocalId !== null &&
  args.uniqueLocalId !== undefined &&
  paras.items[index].uniqueLocalId !== args.uniqueLocalId
) {
  // uniqueLocalId 不匹配 → 可能发生 index drift
  // 降级：全文遍历找 uniqueLocalId 匹配的段落
  const target = paras.items.find(p => p.uniqueLocalId === args.uniqueLocalId);
  if (!target) return NOT_FOUND;
  // 用 target 继续
}
// 降级路径（不支持 uniqueLocalId 或 desktop null）：
// paragraphIndex + 内容指纹（复用 restoreParagraphAt 已有范式）
```

**uniqueLocalId 仅在 session 内有效的含义：** 工具 execute 时读 uniqueLocalId 存入 reverse.args，然后立即在同一 agent turn 的后续工具调用中消费该 ID（undo 时 ID 仍在同一 session）。这个用法是合理的。跨 session（刷新页面后）undo 本来就不支持（OperationLog in-memory）。

---

### Q5: selection_detail 扩展（WSEL-01）

**现有代码（WordAdapter.read 的 'selection_detail' case）：**

```typescript
// src/adapters/WordAdapter.ts 第 543-565 行（当前）
const selection = ctx.document.getSelection();
selection.load('text');
await ctx.sync();
// 返回 { kind: 'word', charCount, text }
```

**扩展目标：** 增加 `paragraphIndex` + `uniqueLocalId`

**实现方案（在同一 Word.run 闭包内）：**

```typescript
// Source: Microsoft Learn — body.paragraphs, range.compareLocationWith
const selection = ctx.document.getSelection();
const body = ctx.document.body;
const paras = body.paragraphs;

const supportsUniqueId = Office.context.requirements.isSetSupported('WordApi', '1.6');
const paraLoadStr = supportsUniqueId ? 'items/text,items/uniqueLocalId' : 'items/text';
selection.load('text');
paras.load(paraLoadStr);
await ctx.sync();

const text = selection.text;
if (text.length === 0) return { ok: true, data: { kind: 'none' } };

// 计算 paragraphIndex：比较 selection.getRange() 与各段落位置
// 策略：先 load paragraphs，再做 compareLocationWith
// 注意：compareLocationWith 需要额外 sync，成本较高
// 快路径：用文本指纹匹配（多段同名时需要 compareLocationWith）
let paragraphIndex = -1;
let uniqueLocalId: string | null = null;

for (let i = 0; i < paras.items.length; i++) {
  const paraText = normalizeText(paras.items[i].text);
  const selText = normalizeText(text);
  if (paraText === selText) {
    paragraphIndex = i;
    uniqueLocalId = supportsUniqueId ? paras.items[i].uniqueLocalId : null;
    break; // 取第一个匹配（简单情况）
  }
}
// 若需精确消歧（多个相同文本段落）→ 用 compareLocationWith
// compareLocationWith 需要额外 Word.run 或同一闭包内的第二次 sync
// v2.1 简化：返回 paragraphIndex = 第一个文本匹配的段落 index
// agent 可用 uniqueLocalId（如果不为 null）做进一步核验
```

**注意：compareLocationWith 的正确用法（多段同名时）：**

```typescript
// Source: Microsoft Learn Word.Range.compareLocationWith (WordApi 1.3)
// 需要先 getRange() 再 compareLocationWith，必须在 Word.run 内
const selRange = ctx.document.getSelection();
// selRange.load('text') — 已 sync
// 然后对每个段落：
const paraRange = paras.items[i].getRange();
const result = selRange.compareLocationWith(paraRange);
await ctx.sync(); // 额外一次 sync
// result.value === Word.LocationRelation.Inside / Equal / Contains ...
```

CompareLocationWith 方法返回 `OfficeExtension.ClientResult<Word.LocationRelation>`，值域：`"AdjacentBefore" | "AdjacentAfter" | "Inside" | "Contains" | "Unrelated" | "Equal"`。`"Inside"` 或 `"Equal"` 表示 selection 在该段落内。[VERIFIED: learn.microsoft.com/javascript/api/word/word.range]

**性能权衡：** selection 与所有段落逐一 compareLocationWith 需要 N 次 sync（每次 compareLocationWith 返回 ClientResult，需 sync 才能读值）。优化方案：先文本指纹快路径；仅在多段同名时才触发 compareLocationWith。**这意味着简单文档下 selection_detail 无额外 sync，复杂文档下最多额外 1–2 次 sync（不超过 2 次）。**

[CITED: Microsoft Learn Word.Range.compareLocationWith]

---

### Q6: find_and_replace — body.search API

**方法签名：**

```typescript
// Source: Microsoft Learn Word.Body.search / Word.Range.search
body.search(
  searchText: string,
  searchOptions?: Word.SearchOptions | {
    ignorePunct?: boolean;
    ignoreSpace?: boolean;
    matchCase?: boolean;
    matchSoundsLike?: boolean;
    matchWholeWord?: boolean;
    matchWildcards?: boolean;
  }
): Word.RangeCollection
```

**返回值：** `Word.RangeCollection`——包含所有匹配 Range 的集合（load 后 `items` 为 `Word.Range[]`）

**API set：** WordApi 1.1（search 基础功能）

[VERIFIED: learn.microsoft.com/javascript/api/word/word.body / word.range]

**实现流程（D-09 快照 + D-12 替换数）：**

```typescript
// Source: Microsoft Learn Word.Body.search, Word.Range
await Word.run(async ctx => {
  // Step 1: 枚举所有匹配
  const results = ctx.document.body.search(args.searchText, {
    matchCase: args.matchCase ?? false,
    matchWholeWord: args.matchWholeWord ?? false,
  });
  results.load('items/text,items/paragraphs'); // 获取匹配文本 + 所在段落
  const paras = ctx.document.body.paragraphs;
  paras.load('items/text');
  await ctx.sync();

  // Step 2: 按段落 index 构建 before-image（D-09：整段原文本）
  const affectedParaIndices = new Set<number>();
  for (const range of results.items) {
    // 找到匹配所在段落的 index
    for (let i = 0; i < paras.items.length; i++) {
      if (normalizeText(paras.items[i].text).includes(normalizeText(range.text))) {
        affectedParaIndices.add(i);
        break;
      }
    }
  }
  // 超限检查（D-10）
  if (affectedParaIndices.size > SNAPSHOT_LIMIT) {
    return { ok: true, data: { replaced: 0, warning: '改动超过上限，此次替换无法自动撤销' }, reverse: { tool: 'noop_inverse', args: { reason: '超出快照上限' } } };
  }
  const snapshot = [...affectedParaIndices].map(i => ({
    paragraphIndex: i,
    text: paras.items[i].text,
  }));

  // Step 3: 执行替换
  let replacedCount = 0;
  for (const range of results.items) {
    range.insertText(args.replaceText, Word.InsertLocation.replace);
    replacedCount++;
  }
  await ctx.sync();

  // reverse.args 包含 snapshot（Record 对象）
  return { replaced: replacedCount, snapshot };
});
```

**关键细节：**

1. `body.search` 返回的 `Range` 对象上可直接 `.insertText(newText, 'Replace')` 做单次替换。[CITED: Microsoft Learn Word.Range.insertText]

2. **段落归属确认方案：** 上面用"文本包含"判断所属段落，这是近似方法（同名段落时可能错归）。更精确：`range.paragraphs.getFirst()` 获取 Range 所在的第一个段落，但需要额外 load + sync。v2.1 采用近似方案（Word 的替换范围通常不跨段落），记为已知限制。[ASSUMED: 近似段落归属方案对 v2.1 场景足够；跨段落替换极少见]

3. **快照上限建议（Claude's Discretion D-10）：** 建议 **100 段**（而非 200）。理由：每段 before-image 约 100–500 字符，100 段约 10–50KB，安全边界内；200 段在极端长文档下 before-image 可能超大。planner 可根据实测调整。

4. **`restore_range_snapshot` inverse 实现：** 按 snapshot 列表逆序（或正序均可，因为替换不改变段落 index 顺序），对每个 `{paragraphIndex, text}` 调用现有 `restoreParagraphAt` 模式（index + 内容指纹双重定位）恢复原文。与 Excel `sort_range` 的 `restore_range_values_snapshot` 范式同构。

---

### Q7: insert_table + delete_table_by_marker

**body.insertTable 签名：**

```typescript
// Source: Microsoft Learn Word.Body.insertTable / Word.Table class (WordApi 1.3)
body.insertTable(
  rowCount: number,
  columnCount: number,
  insertLocation: Word.InsertLocation | "Start" | "End" | "Before" | "After",
  values?: string[][]
): Word.Table
```

- `insertLocation` 在 `body` 上有效值：`"Start"` / `"End"`（不能是 `"Before"` / `"After"`）
- 在 `paragraph` 上有效值：`"Before"` / `"After"`（在指定段落前后插入）
- `values`：可选的二维字符串数组填充内容

[VERIFIED: Microsoft Learn Word.Body 方法表 / Word.Table class — API set WordApi 1.3]

**Word.Table.delete() 方法：**

```typescript
// Source: Microsoft Learn Word.Table class
table.delete(): void
```

删除整张表格。[VERIFIED: Microsoft Learn Word.Table.delete]

**Word.Table 有无稳定 ID：** Word.Table **无** `uniqueLocalId` 属性（`uniqueLocalId` 仅在 Word.Paragraph 上，WordApi 1.6）。body.tables 集合按位置排序（`body.tables.items` 为当前文档内所有表格，顺序与文档顺序一致）。[VERIFIED: Microsoft Learn Word.Table 属性列表]

**body.tables 遍历：**

```typescript
// Source: Microsoft Learn Word.Body.tables
const tables = ctx.document.body.tables;
tables.load('items/rowCount,items/columnCount,items/values');
await ctx.sync();
// tables.items: Word.Table[]（顺序与文档中顺序一致）
```

**D-13 marker 方案（推荐）：**

delete_table_by_marker 的逻辑：

```typescript
// 在 Word.run 闭包内，restoreRangeSnapshot → deleteTableByMarker
// reverse.args = {
//   contentFingerprint: string,  // 首行首列文本（或前 N 个非空单元格拼接）
//   rows: number,
//   cols: number,
//   afterParagraphIndex?: number, // 位置锚（可选）
// }
const tables = ctx.document.body.tables;
tables.load('items/rowCount,items/columnCount,items/values');
await ctx.sync();

for (const table of tables.items) {
  const fp = buildFingerprint(table); // 首行首列或前 3 个非空单元格拼接
  if (
    table.rowCount === args.rows &&
    table.columnCount === args.cols &&
    fp === args.contentFingerprint
  ) {
    table.delete();
    await ctx.sync();
    return;
  }
}
throw new HostApiError('deleteTableByMarker: 找不到目标表格', undefined);
```

**指纹字段推荐（Claude's Discretion D-13）：**

```typescript
// 指纹 = 首行所有单元格文本拼接（用 '|' 分隔）+ 行列数
// 理由：首行通常是表头，内容唯一性高；纯空表退化为 `||rows×cols`
function buildFingerprint(values: string[][], rows: number, cols: number): string {
  const firstRow = values[0] ?? [];
  return firstRow.join('|') + `__${rows}x${cols}`;
}
```

对于空表（`content` 省略时），指纹退化为 `"||...|__3x3"`（全空格），此时退化为"行列数 + 位置锚（afterParagraphIndex）"匹配第一个满足尺寸的表格（D-14）。

**插入后立即读取 values（D-13 fingerprint 生成时机）：**

```typescript
// body.insertTable 返回 Word.Table proxy
const table = body.insertTable(rows, cols, 'End', content ?? undefined);
table.load('values,rowCount,columnCount');
await ctx.sync();
// 生成指纹
const fingerprint = buildFingerprint(table.values, table.rowCount, table.columnCount);
// reverse.args = { contentFingerprint: fingerprint, rows, cols, afterParagraphIndex }
```

**段落位置锚（`afterParagraphIndex` 对应 paragraph.insertTable）：**

```typescript
// 提供 afterParagraphIndex 时：在指定段落后插入
paras.load('items/text');
await ctx.sync();
const anchorPara = paras.items[afterParagraphIndex];
if (!anchorPara) throw new HostApiError('afterParagraphIndex 越界', undefined);
const table = anchorPara.insertTable(rows, cols, 'After', content ?? undefined);
```

---

### Q8: operationLog 接线

**DocumentAdapterForReplay 需新增的 5 个方法声明：**

```typescript
// 在 operationLog.ts 的 DocumentAdapterForReplay 接口中新增：
/** Word inverse：还原段落字体格式（set_word_character_format） */
restoreRangeFont?: (args: Record<string, unknown>) => Promise<void>;
/** Word inverse：还原段落格式（set_word_paragraph_format） */
restoreParagraphFormat?: (args: Record<string, unknown>) => Promise<void>;
/** Word inverse：还原段落样式（apply_paragraph_style） */
restoreParagraphStyle?: (args: Record<string, unknown>) => Promise<void>;
/** Word inverse：按段落快照还原（find_and_replace） */
restoreRangeSnapshot?: (args: Record<string, unknown>) => Promise<void>;
/** Word inverse：按 marker 删除表格（insert_table） */
deleteTableByMarker?: (args: Record<string, unknown>) => Promise<void>;
```

**executeReverse 新增 5 个 case：**

```typescript
// 在 executeReverse switch 中追加：
case 'restore_range_font':
  if (!adapter.restoreRangeFont) throw new Error('adapter 未实现 restoreRangeFont');
  await adapter.restoreRangeFont(reverse.args);
  break;
case 'restore_paragraph_format':
  if (!adapter.restoreParagraphFormat) throw new Error('adapter 未实现 restoreParagraphFormat');
  await adapter.restoreParagraphFormat(reverse.args);
  break;
case 'restore_paragraph_style':
  if (!adapter.restoreParagraphStyle) throw new Error('adapter 未实现 restoreParagraphStyle');
  await adapter.restoreParagraphStyle(reverse.args);
  break;
case 'restore_range_snapshot':
  if (!adapter.restoreRangeSnapshot) throw new Error('adapter 未实现 restoreRangeSnapshot');
  await adapter.restoreRangeSnapshot(reverse.args);
  break;
case 'delete_table_by_marker':
  if (!adapter.deleteTableByMarker) throw new Error('adapter 未实现 deleteTableByMarker');
  await adapter.deleteTableByMarker(reverse.args);
  break;
```

**PostStateSnapshot.kind 扩展（D-19 保守路径）：**

新 kind 命名建议：
- `'word_char_format'`（set_word_character_format）
- `'word_para_format'`（set_word_paragraph_format）
- `'word_style'`（apply_paragraph_style）
- `'word_snapshot'`（find_and_replace）
- `'word_table'`（insert_table）

`readTargetState` 对所有 5 个新 kind 返回 `undefined`（保守通过，不加比对规则）。原有 kind 不受影响。

**Union type 扩展：**

```typescript
export interface PostStateSnapshot {
  kind: 'word_paragraph' | 'excel_range' | 'excel_chart' | 'ppt_slide' | 'ppt_shape'
      | 'word_char_format' | 'word_para_format' | 'word_style' | 'word_snapshot' | 'word_table';
  content: unknown;
}
```

`isTargetStateConsistent` 的 default case 已返回 `true`，新 kind 自动通过。无需额外修改。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 段落文本替换 | 自己操作 insertText 逻辑 | `Word.Range.insertText(text, 'Replace')` | Word JS API 原生方法，维护 undo 栈 |
| 全文查找 | 手动遍历所有段落文本 | `body.search(text, searchOptions)` | API 返回所有 Range，支持 matchCase/matchWholeWord |
| 表格插入 | 手动构建 OOXML 段落 | `body.insertTable(rows, cols, loc, values)` | API 直接支持，values 可选 |
| before-image 快照格式化 | 自定义序列化格式 | Record<string, unknown>（plain JSON）| operationLog.executeReverse 直接传 args，JSON.stringify 安全 |
| locale-safe 样式名 | 手动字符串映射表 | `Word.BuiltInStyleName` enum + `paragraph.styleBuiltIn` | 官方跨 locale 方案，已枚举全部内置样式 |
| selection → paragraphIndex 映射 | 手动 DOM 操作 | `body.paragraphs.load` + 文本指纹 + `compareLocationWith` | 唯一 Office.js 合规方案，no DOM access |
| 表格逆向定位 | 随机 ID 生成 + 存储 | 内容指纹（首行文本 + 行列数）| Word.Table 无 uniqueLocalId，指纹是唯一可序列化的 stable marker |

**Key insight:** Word JS API 是唯一合规的文档操作路径，任何绕过 Word.run 闭包的操作都会破坏 Office.js 代理模型（A-06）。

---

## Common Pitfalls

### Pitfall 1: paragraph.font.* 在混合格式段返回 null，写回 null 行为未文档化

**What goes wrong:** before-image 存了 `bold: null`，undo 时 `para.font.bold = null` 可能 TypeScript 类型报错或 Word 静默忽略。

**Why it happens:** Word.Font 属性类型声明为 `boolean`，但官方文档描述"返回 null 表示混合"，类型不一致。

**How to avoid:** 在 inverse 方法中对 null 值做条件处理——如果 `bold === null`，不写 `font.bold`（保留当前状态）或写 `font.bold = null as unknown as boolean`（强制类型断言）。真机 UAT 验证此行为。

**Warning signs:** TypeScript 编译报类型错误 `Type 'null' is not assignable to type 'boolean'`。

### Pitfall 2: lineSpacing 单位是磅值（绝对值），不是倍数

**What goes wrong:** 成功标准 #2「把所有正文段落改 1.5 倍行距」传参 `lineSpacing: 1.5` → Word 设置为 1.5pt 行距（几乎不可见），而非 18pt（12pt 字体的 1.5 倍）。

**Why it happens:** Word JS API `paragraph.lineSpacing` 存储绝对磅值（与 Word 内部表示一致），不是用户界面显示的倍数。

**How to avoid:** tool schema 说明「lineSpacing 单位为磅，1.5 倍行距 ≈ 18 对于 12pt 字体」；或工具接受倍数后在 adapter 内换算（需要先读 `paragraph.font.size`）。v2.1 推荐直接接受磅值参数，agent 靠 system prompt guidance 换算。[ASSUMED: agent 可正确处理磅值 vs 倍数]

**Warning signs:** 用户设置"1.5 倍行距"后 Word 文档行距变得极小。

### Pitfall 3: body.insertTable 的 insertLocation 约束

**What goes wrong:** `body.insertTable(3, 3, 'Before', ...)` 抛 `InvalidArgument`——`body` 上不支持 `'Before'` / `'After'`，只支持 `'Start'` / `'End'`。

**Why it happens:** `'Before'` / `'After'` 在 `paragraph.insertTable` 上有效，在 `body.insertTable` 上无效。

**How to avoid:** `afterParagraphIndex` 省略时用 `body.insertTable(rows, cols, 'End', values)`；有 afterParagraphIndex 时用 `paras.items[i].insertTable(rows, cols, 'After', values)`。

**Warning signs:** 运行时 `InvalidArgument` 错误。

### Pitfall 4: find_and_replace 段落归属用文本包含判断的边缘案例

**What goes wrong:** 搜索词"公司"出现在标题"公司简介"中，匹配 Range 所在段落被错误判断为包含文字"公司"的第一个段落，而非实际段落。

**Why it happens:** 用"段落文本包含搜索词"来确定段落归属是近似方法，当搜索词出现在多个段落时可能错归。

**How to avoid:** v2.1 采用近似方案（可接受），记为已知限制。精确方案需 `range.paragraphs.getFirst()` + 额外 sync。如需要精确，planner 可在 Wave 1 实现精确路径。

**Warning signs:** undo 后某个段落文本没有还原（被错误记录 before-image）。

### Pitfall 5: delete_table_by_marker 空表的指纹退化（D-14）

**What goes wrong:** 插入空 3×3 表格，指纹为 `"||__3x3"`，若文档中有多张 3×3 空表，`delete_table_by_marker` 删除第一张（可能是错误的那张）。

**Why it happens:** 空表无法用内容区分，只能用位置锚（`afterParagraphIndex`）。

**How to avoid:** D-14 方案——空表时回退为「尺寸 + afterParagraphIndex 锚后第一个匹配尺寸的表」定位。若仍定位不到 → `skipped_error`（诚实标注，不删错表）。

**Warning signs:** undo 后文档中多一张表格（删错了另一张）。

### Pitfall 6: selection_detail paragraphIndex 为 -1 时的处理

**What goes wrong:** selection 跨段落选中时（如从第 2 段选到第 3 段），文本指纹匹配失败，`paragraphIndex` = -1，工具收到 -1 调用 `paras.items[-1]` 是 `undefined`。

**Why it happens:** selection 文本 ≠ 任何单个段落的完整文本（选中是段落子集或跨段落）。

**How to avoid:** 当 paragraphIndex = -1 时，selection_detail 返回 `{ paragraphIndex: -1, uniqueLocalId: null }`，并在 data 中加注 `selectionSpansMultipleParagraphs: true`；write tools 收到 paragraphIndex = -1 时返回 `NOT_FOUND`（hint：请先定位到单一段落内）。

**Warning signs:** agent 报 NOT_FOUND 错误，或调用工具时 paragraphIndex 为 -1。

### Pitfall 7: W3 中文样式名 locale crash（已由 D-08 防御）

**What goes wrong:** agent 传 `styleName: "标题1"` → `paragraph.style = "标题1"` 在英文 Office 报 `ItemNotFound`。

**Why it happens:** `paragraph.style` 是 locale-dependent 字符串，"标题1"只在中文 Office 有效。

**How to avoid:** D-08 已锁定——工具层 allowlist 校验（`VALID_BUILTIN_STYLES` Set）+ 使用 `paragraph.styleBuiltIn` 而非 `paragraph.style`。

**Warning signs:** `ItemNotFound` 错误，特别是在非中文 locale 环境下。

---

## Code Examples

### set_word_character_format — write + before-image

```typescript
// Source: Microsoft Learn Word.Font, Word.Paragraph
// WordAdapter.setCharacterFormat 范式
async setCharacterFormat(args: Record<string, unknown>): Promise<{ beforeImage: Record<string, unknown> }> {
  const index = args.paragraphIndex as number;
  const font = args.font as { bold?: boolean; italic?: boolean; underline?: string; size?: number; color?: string; name?: string };
  return await Word.run(async ctx => {
    const paras = ctx.document.body.paragraphs;
    paras.load('items/text,items/uniqueLocalId,items/font/bold,items/font/italic,items/font/underline,items/font/size,items/font/color,items/font/name');
    await ctx.sync();
    // 定位 + 校验（D-04）
    const target = locateParagraph(paras.items, index, args.uniqueLocalId as string | undefined);
    if (!target) throw new HostApiError('段落不存在或 uniqueLocalId 不匹配', undefined);
    // before-image
    const beforeImage = {
      bold: target.font.bold, italic: target.font.italic,
      underline: target.font.underline, size: target.font.size,
      color: target.font.color, name: target.font.name,
    };
    // write（只写传入的属性，undefined 属性跳过）
    if (font.bold !== undefined) target.font.bold = font.bold;
    if (font.italic !== undefined) target.font.italic = font.italic;
    if (font.underline !== undefined) target.font.underline = font.underline as Word.UnderlineType;
    if (font.size !== undefined) target.font.size = font.size;
    if (font.color !== undefined) target.font.color = font.color;
    if (font.name !== undefined) target.font.name = font.name;
    await ctx.sync();
    return { beforeImage };
  });
}
```

### restoreRangeFont — inverse（Record 签名，D-17）

```typescript
// Source: Microsoft Learn Word.Font
// WordAdapter.restoreRangeFont — D-17 Record 签名守门
async restoreRangeFont(args: Record<string, unknown>): Promise<void> {
  const index = args.index as number;
  const expectedText = args.expectedText as string; // 写后文本，用于定位
  const before = args.before as Record<string, unknown>; // before-image
  await Word.run(async ctx => {
    const paras = ctx.document.body.paragraphs;
    paras.load('items/text');
    await ctx.sync();
    // 精确定位（index + 内容指纹，复用 restoreParagraphAt 范式）
    let targetIndex = -1;
    if (index >= 0 && index < paras.items.length &&
        normalizeText(paras.items[index].text) === normalizeText(expectedText)) {
      targetIndex = index;
    }
    if (targetIndex === -1) {
      for (let i = 0; i < paras.items.length; i++) {
        if (normalizeText(paras.items[i].text) === normalizeText(expectedText)) {
          targetIndex = i; break;
        }
      }
    }
    if (targetIndex === -1) throw new HostApiError('restoreRangeFont: 目标段落未找到', undefined);
    // 还原 font（null 属性条件写回）
    const font = paras.items[targetIndex].font;
    if (before.bold !== null && before.bold !== undefined) font.bold = before.bold as boolean;
    if (before.italic !== null && before.italic !== undefined) font.italic = before.italic as boolean;
    if (before.underline !== undefined) font.underline = before.underline as Word.UnderlineType;
    if (before.size !== null && before.size !== undefined) font.size = before.size as number;
    if (before.color !== null && before.color !== undefined) font.color = before.color as string;
    if (before.name !== null && before.name !== undefined) font.name = before.name as string;
    await ctx.sync();
  });
}
```

### apply_paragraph_style — allowlist + styleBuiltIn 写入

```typescript
// Source: Microsoft Learn Word.BuiltInStyleName, Word.Paragraph.styleBuiltIn
// tool execute 层：
const VALID_BUILTIN_STYLES = new Set([
  'Heading1','Heading2','Heading3','Heading4','Heading5',
  'Heading6','Heading7','Heading8','Heading9',
  'Normal','NoSpacing','Title','Subtitle',
  'Quote','IntenseQuote','ListParagraph','Caption',
  'Strong','Emphasis','IntenseEmphasis','BookTitle',
]);
if (!VALID_BUILTIN_STYLES.has(args.styleName as string)) {
  return { ok: false, error: { code: 'INVALID_PARAM', message: `未知内置样式：${args.styleName}`, recoverable: true } };
}
// adapter 层：
para.load('style,styleBuiltIn');
await ctx.sync();
const beforeImage = { style: para.style, styleBuiltIn: para.styleBuiltIn };
para.styleBuiltIn = args.styleName as Word.BuiltInStyleName;
await ctx.sync();
```

### integration test 守门范式（D-18，每工具一条）

```typescript
// Source: operationLog.integration.test.ts 现有范式（扩展）
it('单步撤销 set_word_character_format：restoreRangeFont 收 Record 对象 → rolled_back', async () => {
  const restoreRangeFontFn = vi.fn(async (_args: Record<string, unknown>): Promise<void> => {});
  const mockAdapter: DocumentAdapterForReplay = { restoreRangeFont: restoreRangeFontFn };
  const entry: OperationLogEntry = {
    runId: 'run-it', stepIndex: 0,
    toolName: 'set_word_character_format',  // ← D-17 硬卡：此字符串必须出现在本文件中
    args: { paragraphIndex: 1, font: { bold: true } },
    humanLabel: '将第 2 段设为加粗',
    reverse: {
      tool: 'restore_range_font',
      args: { index: 1, expectedText: '当前段落文本', before: { bold: false, italic: false } },
    },
    postState: { kind: 'word_char_format', content: { index: 1 } },
    timestamp: 0,
  };
  const detail = await replayUndoSingle(entry, mockAdapter);
  expect(detail.status).toBe('rolled_back');
  expect(restoreRangeFontFn).toHaveBeenCalledTimes(1);
  const receivedArgs = restoreRangeFontFn.mock.calls[0][0] as Record<string, unknown>;
  expect(typeof receivedArgs).toBe('object');
  expect(receivedArgs.index).toBe(1);
  expect((receivedArgs.before as Record<string, unknown>).bold).toBe(false);
});
```

---

## Runtime State Inventory

> 本阶段为纯代码新增（WordAdapter + operationLog + ToolDef），无 rename/refactor 操作。

**不适用（greenfield 工具添加，无运行时状态迁移）。**

---

## Environment Availability

> 本阶段 0 净新增外部依赖，仅依赖 Office.js CDN 和现有工具链。

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest / build | ✓ | 已安装（项目正常运行中）| — |
| Vitest | integration test 守门 | ✓ | 已安装 | — |
| Office.js CDN | Word JS API | ✓（via CDN，不需本地安装）| WordApi 1.6 Supported on Web | — |
| Word for Web（UAT）| WSEL-01 uniqueLocalId 真机验证 | 需用户手动验证 | Office 最新 Web 版 | 降级路径（D-03）已实现 |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest（已安装，项目统一框架）|
| Config file | `vitest.config.ts`（项目根目录）|
| Quick run command | `npm run test -- operationLog.integration` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WSEL-01 | selection_detail 返回 paragraphIndex + uniqueLocalId | unit | `npm run test -- WordAdapter.read` | ✅（WordAdapter.read.test.ts 需追加 case）|
| WORD-01 | set_word_character_format undo → restoreRangeFont 收 Record → rolled_back | integration | `npm run test -- operationLog.integration` | ✅（integration.test.ts 追加）|
| WORD-02 | set_word_paragraph_format undo → restoreParagraphFormat 收 Record → rolled_back | integration | 同上 | ✅（integration.test.ts 追加）|
| WORD-03 | apply_paragraph_style undo → restoreParagraphStyle 收 Record → rolled_back | integration | 同上 | ✅（integration.test.ts 追加）|
| WORD-04 | find_and_replace undo → restoreRangeSnapshot 收 Record → rolled_back | integration | 同上 | ✅（integration.test.ts 追加）|
| WORD-05 | insert_table undo → deleteTableByMarker 收 Record → rolled_back | integration | 同上 | ✅（integration.test.ts 追加）|
| D-08 | apply_paragraph_style 非法 styleName 被拒绝（在调 Word 之前）| unit | `npm run test -- word.write` | ❌ Wave 0（tools/write/word.test.ts 追加）|
| D-17 | contract.test.ts integrationTest: true 行对应 integration.test.ts 有 toolName 字符串 | CI | `npm run test -- contract` | ✅（已有 D-17 硬卡逻辑）|

### Sampling Rate

- **Per task commit:** `npm run test -- operationLog.integration` + `npm run test -- contract`
- **Per wave merge:** `npm run test`（全套）
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/agent/tools/write/word.test.ts` — 追加 D-08 allowlist 拒绝测试（apply_paragraph_style 非法样式名）
- [ ] `src/adapters/WordAdapter.read.test.ts` — 追加 selection_detail 扩展（paragraphIndex + uniqueLocalId）单测（mockWord 需含 uniqueLocalId 字段）
- [ ] `src/agent/operationLog.integration.test.ts` — 追加 5 条守门测试（D-17/D-18 硬门）
- [ ] `src/agent/contract.test.ts` — 5 行 integrationTest: false → true（实现完成后）

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | BuiltInStyleName allowlist 校验（D-08）；paragraphIndex 越界检查；find_and_replace 快照超限 noop+gate |
| V6 Cryptography | no | — |

### Known Threat Patterns for Word JS API + agent loop

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 超大 find_and_replace（替换超限制段落）导致 before-image 内存溢出 | DoS | 快照上限 100 段（D-10），超限 noop+gate，不中断 agent |
| paragraphIndex 越界访问 `paras.items[-1]` | Tampering | 越界检查返回 NOT_FOUND（D-04），不访问数组 |
| 非法 styleName 绕过 allowlist 导致 Word locale crash | Tampering | D-08 在调 Word 之前 allowlist 校验，返回 INVALID_PARAM |
| delete_table_by_marker 删错表格（内容指纹碰撞）| Tampering | 空表退化为尺寸+位置锚；定位不到 → skipped_error（不删）|
| reverse.args 位置参而非 Record 对象（Phase 5 教训）| Elevation of Privilege | D-17 硬约束 + D-18 三步守门 + contract.test.ts D-17 硬卡 |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `paragraph.style = "标题1"`（locale-dependent）| `paragraph.styleBuiltIn = "Heading1"`（WordApi 1.3）| 2017（WordApi 1.3 GA）| 中文 locale 用户不再崩溃 |
| `@microsoft/office-js` npm 包 | Office.js CDN（`appsforoffice.microsoft.com`）| 2022（npm 包废弃）| 平台自动推安全修复 |
| 位置参数 inverse `(text: string)` | `(args: Record<string, unknown>)` | Phase 5 UAT 教训 | undo 不再全挂 |

**Deprecated/outdated:**

- `paragraph.style` 直接接受中文样式名：会在非中文 Office 崩溃，Phase 9 禁用（改用 styleBuiltIn）
- `@microsoft/office-js` npm 包：官方已废弃，CDN 才会收到安全更新

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `font.bold = null` 在 Word JS API 中等同于"清除覆盖/继承"（而非报错或静默忽略）| Q1 混合格式 null 写回 | D-07 best-effort 还原可能不彻底；需 UAT 验证后决定是否改为"跳过 null 属性"策略 |
| A2 | `font.underline = "Mixed"` 是可写的（写回混合状态）| Q1 underline 混合值 | 若不可写，undo 时 underline 丢失；需 UAT 验证 |
| A3 | lineSpacing: 成功标准 #2「1.5 倍行距」指以倍数传参，tool 内部换算（先读字号）| Q2 行距单位 | 若 agent 或用户理解为磅值，会设置错误行距；tool description 必须明确 |
| A4 | body.search 返回的 Range.insertText(replaceText, 'Replace') 可直接替换匹配文本 | Q6 替换操作 | 若 Range 为 read-only 或 insertText 语义不同，替换失败；WordApi 1.1 文档隐含此用法 |
| A5 | find_and_replace 段落归属用文本包含判断对 v2.1 场景足够（搜索词不跨段落）| Q6 段落归属 | 若用户搜索的词恰好跨段，快照错归；已标为已知限制 |
| A6 | insert_table 后立即 `table.load('values')` 能在同一 Word.run 闭包内读取 values（无需额外 sync）| Q7 指纹生成时机 | 若 values 需要额外 sync，需要两次 sync；标准 Word JS API 模式应支持单闭包两次 sync |

**已标注 [ASSUMED] 的条目需要 UAT 验证（A1, A2, A3）或有明确已知限制（A4–A6）。其余研究结论均有官方文档支持（[VERIFIED] 或 [CITED]）。**

---

## Open Questions

1. **lineSpacing 参数语义（A3）**
   - What we know: Word JS API `paragraph.lineSpacing` 接受磅值（绝对值，非倍数）
   - What's unclear: 成功标准 #2 写「1.5 倍行距」——是工具接受倍数后内部换算，还是直接接受磅值？
   - Recommendation: tool schema 接受磅值（直接映射 API），description 给出换算公式示例（`18pt ≈ 1.5× for 12pt font`）。planner 最终决定。

2. **insert_table after_paragraph_index 时的 insertLocation**
   - What we know: `paragraph.insertTable` 支持 `'Before'` / `'After'`；`body.insertTable` 支持 `'Start'` / `'End'`
   - What's unclear: D-15 约定「afterParagraphIndex 提供 → 该段后插入」——应用 `paras.items[i].insertTable(rows, cols, 'After', values)` 还是 paragraph.getRange().insertTable？
   - Recommendation: 用 `paras.items[afterParagraphIndex].insertTable(rows, cols, 'After', values)`，这是最直接的路径。planner 确认。

3. **selection_detail 跨段落选中时 paragraphIndex 的处理**
   - What we know: selection 跨多段时文本指纹匹配失败（选中文本 ≠ 单一段落完整文本）
   - What's unclear: 返回 `-1` 还是返回「第一个包含选中文本的段落 index」还是报错？
   - Recommendation: 返回 `{ paragraphIndex: -1, selectionSpansMultipleParagraphs: true }`；write tools 收到 -1 时返回 NOT_FOUND + hint。

---

## Sources

### Primary (HIGH confidence)
- [Microsoft Learn — Word.Font class](https://learn.microsoft.com/en-us/javascript/api/word/word.font?view=word-js-preview) — bold/italic/underline/size/color/name 属性，混合格式 null 语义，WordApi 1.1
- [Microsoft Learn — Word.Paragraph class](https://learn.microsoft.com/en-us/javascript/api/word/word.paragraph?view=word-js-preview) — uniqueLocalId（WordApi 1.6），style/styleBuiltIn，lineSpacing/spaceBefore/spaceAfter/alignment/firstLineIndent/leftIndent（全部 WordApi 1.1）
- [Microsoft Learn — Word.BuiltInStyleName enum](https://learn.microsoft.com/en-us/javascript/api/word/word.builtinstylename?view=word-js-preview) — 全部枚举值，WordApi 1.3，locale-safe 语义
- [Microsoft Learn — Word.Table class](https://learn.microsoft.com/en-us/javascript/api/word/word.table?view=word-js-preview) — delete()，values，rowCount，columnCount，body.tables，WordApi 1.3
- [Microsoft Learn — Word.Body class](https://learn.microsoft.com/en-us/javascript/api/word/word.body?view=word-js-preview) — insertTable(rowCount, columnCount, insertLocation, values?)，search(searchText, searchOptions)，tables 集合，WordApi 1.1/1.3
- [Microsoft Learn — Word.Range class](https://learn.microsoft.com/en-us/javascript/api/word/word.range?view=word-js-preview) — compareLocationWith(range) → LocationRelation，search()，paragraphs，WordApi 1.1/1.3
- [Microsoft Learn — Word JS API requirement sets](https://learn.microsoft.com/en-us/javascript/api/requirement-sets/word/word-api-requirement-sets?view=word-js-preview) — WordApi 1.6 Office for Web = Supported，GA 对应 Build 16731.20234（2023-08）
- Aster codebase — `src/adapters/WordAdapter.ts`（现有 normalizeText，restoreParagraphAt 范式，Word.run 闭包），`src/agent/operationLog.ts`（DocumentAdapterForReplay 接口，executeReverse switch），`src/agent/operationLog.integration.test.ts`（D-18 守门范式），`src/agent/contract.test.ts`（D-17 硬卡逻辑），`src/agent/tools/write/word.ts`（ToolDef 范式，Record args 约定）

### Secondary (MEDIUM confidence)
- [OfficeDev/office-js GitHub issue #4258](https://github.com/OfficeDev/office-js/issues/4258) — uniqueLocalId 在 Desktop Word 返回 null（已验证，降级 D-03 依据）
- `.planning/research/PITFALLS.md` — §W1 段落 index drift，§W3 中文样式名 locale crash，find_and_replace 不可逆分类（已验证，作为设计依据）
- `.planning/research/SUMMARY.md` — §D Word 选区精度，§B-Word 合并后工具表（已验证，作为设计背景）

### Tertiary (LOW confidence)
- [ASSUMED] `font.bold = null`（写回 null）等同于"清除字体格式覆盖"而非报错 — 需真机 UAT 验证（A1）
- [ASSUMED] `font.underline = "Mixed"` 可写 — 需真机 UAT 验证（A2）

---

## Metadata

**Confidence breakdown:**
- Standard stack（API 基础）: HIGH — 全部 Microsoft Learn 官方文档直接验证，API set 版本明确
- OperationLog 接线方案: HIGH — 代码审计确认，接口扩展路径清晰
- uniqueLocalId 可用性（Office for Web）: HIGH — 官方 requirement set 表格明确显示 Supported
- font null 写回行为: LOW — 仅文档描述，未实测（A1/A2）
- find_and_replace 段落归属近似方案: MEDIUM — 已知边界条件，v2.1 可接受

**Research date:** 2026-05-30
**Valid until:** 2026-07-30（Word JS API 稳定，30 天内无影响）
