# Phase 10: Excel + PPT 工具完整 (B-Excel + B-PPT) — Research

**Researched:** 2026-05-31
**Domain:** Excel JS API 1.1–1.8 + PowerPoint JS API 1.4/1.10，10 Excel write tools + 8 PPT write tools，OperationLog inverse 基础设施扩展
**Confidence:** HIGH（所有 18 工具的 Office.js API 调用由 Microsoft Learn 官方文档 + Context7 直接验证；undo 策略由代码审计 + PITFALLS.md 高置信研究支撑；3 个 spike 工具运行时门控路径已设计完毕）

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**G-A 命名真相源裁决**
- D-01: 工具名/reverse 名一律以 `src/agent/contract.test.ts`（第 41-59 行）+ `CONTRACT.md` 为逐字真相源
- D-02: contract.test.ts 是 CI 守门，逐字对齐是硬约束

**G-B manage_worksheet 范围**
- D-03: `manage_worksheet` operation 枚举限定 `add | rename`，绝不含 `delete`/`copy`
- D-04: 工具名/reverse/undoType 仍逐字保持 CONTRACT CI（`manage_worksheet` / `restore_worksheet_snapshot` / 快照式），仅收窄枚举
- D-05: `copy` 不进 v2.1

**G-C Excel 快照式 undo**
- D-06: 快照粒度 = 受影响区域 2D values before-image；写前 `readRangeValuesSnapshot(address)` 读全量 `range.values`
- D-07: 快照上限 ≤ 10,000 单元格，超限 noop+gate + warn「区域过大，无法自动撤销」
- D-08: 排序还原可能破坏行相对引用公式（已知限制，写进 description，不阻塞）
- D-09: `restore_range_values_snapshot` 只还原 values，不含 formats

**G-D PPT 3 个 spike 门控工具**
- D-10: spike 不前置阻塞；运行时 isSetSupported + try/catch 读 before-image；读不到降级 noop+gate
- D-11: CONTRACT 声明的「简单逆向」= happy-path；integration.test 守门验简单逆向路径；运行时若读不到 → noop_inverse + reason
- D-12: PPT-08 只写纯色填充（setSolidColor），绝不实现读主题色/读背景 read 工具

**G-E PPT noop+gate 工具**
- D-13: noop+gate = 执行 + warn 不中断；executeReverse noop_inverse throw → skipped_error
- D-14: `manage_slides` v2.1 只暴露 `operation='delete'`

**G-F add_shape + copy_slide**
- D-15: add_shape 文本框前 deselect + 校验 count；几何形状走 addGeometricShape；捕获新 shapeId
- D-16: copy_slide reverse 名 `delete_slide_by_index`，内部 index+ID/title 指纹双定位

**G-G undo 基础设施 + D-17 守门（硬门，不软化）**
- D-17: operationLog.ts 加 15 个新方法 + 15 个 executeReverse case
- D-18: inverse/read/snapshot 签名一律 `(args: Record<string, unknown>)`（硬约束）
- D-19: 每工具显式守门四步，缺一 CI 挂
- D-20: restore_range_values_snapshot 被 EXCEL-03/05 共享，各需独立 integration.test 用例
- D-21: 新 PostStateSnapshot.kind → readTargetState 返 undefined（保守）

### Claude's Discretion（planner/researcher 定）
- Excel 快照上限的具体数字（D-07）
- format_excel_range 的 before-image 属性包具体字段组合
- add_conditional_format rule 参数结构 + restore 索引漂移防御
- copy_slide 双定位指纹具体字段
- 新 PostStateSnapshot.kind 命名
- 18 工具的 humanLabel 文案、description 措辞
- wave 切分与并行度

### Deferred Ideas (OUT OF SCOPE)
- merge_cells / remove_duplicates / create_pivot_table → v2.2
- delete_worksheet → Out of Scope 永久不做
- manage_worksheet copy operation → v2.2
- manage_slides reorder → v2.1 不做
- set_shape_fill_advanced / add_line → v2.2
- insert_table_ppt (spike S3) → v2.2
- PPT 动画/转场/SmartArt/套主题/读背景色主题色 → Out of Scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXCEL-01 | `format_excel_range` 设置单元格格式（数字格式/字体/填充/边框/对齐），简单逆向 `restore_range_format` | §Excel-01 工具实现说明；`range.format.*` API 已验证 |
| EXCEL-02 | `set_column_row_size` 设置列宽/行高/autoFit，简单逆向 `restore_column_row_size` | §Excel-02 工具实现说明；`column.width`/`row.height`/`autofitColumns()` 已验证 |
| EXCEL-03 | `sort_range` 按列排序，快照式 undo `restore_range_values_snapshot`，≤10,000 单元格 | §Excel-03；`range.sort.apply()` 清空原生撤销栈已官方文档确认 |
| EXCEL-04 | `set_auto_filter` 应用/清除自动筛选，简单逆向 `restore_auto_filter` | §Excel-04；`sheet.autoFilter.apply/remove` 已验证 |
| EXCEL-05 | `excel_find_and_replace` 查找替换，快照式 undo `restore_range_values_snapshot` | §Excel-05；`range.replaceAll` + snapshot 路径已设计 |
| EXCEL-06 | `add_conditional_format` 添加条件格式（色阶/数据条/高亮），简单逆向 `restore_conditional_format` | §Excel-06；`range.conditionalFormats.add` 已验证 |
| EXCEL-07 | `create_table` 把区域建成表格，简单逆向 `delete_table_by_name` | §Excel-07；`sheet.tables.add` + `getItemOrNullObject` 已验证 |
| EXCEL-08 | `freeze_panes` 冻结首行/首列/指定窗格，简单逆向 `restore_freeze_panes` | §Excel-08；`worksheet.freezePanes.*` 已验证 |
| EXCEL-09 | `manage_worksheet` 新增/重命名工作表（operation: add/rename），快照式 `restore_worksheet_snapshot` | §Excel-09；`worksheets.add`/`worksheet.name=` 已验证；delete 已锁定不做 |
| EXCEL-10 | `set_chart_title` 修改图表标题，简单逆向 `restore_chart_title` | §Excel-10；`chart.title.text` read/write 已验证，复用 deleteChartByName 定位范式 |
| PPT-01 | `set_shape_text_font` 设置形状文字字体（字体名/字号/颜色/加粗/斜体），简单逆向 `restore_shape_font` | §PPT-01；`textRange.font.*` 已验证，复用 TEXT_SHAPE_TYPES 守门 |
| PPT-02 | `set_shape_text_alignment` 设置文字段落对齐（spike S4 门控），简单逆向 `restore_shape_alignment` | §PPT-02；spike 门控路径 + 降级设计；`textRange.paragraphFormat.alignment` 需真机 |
| PPT-03 | `add_shape` 新增几何形状/文本框（addTextBox 前 deselect 绕 #2775），简单逆向 `delete_shape_by_id` | §PPT-03；addGeometricShape / addTextBox API + deselect 方案已设计 |
| PPT-04 | `delete_shape` 删除形状（noop+gate），reverse `noop_inverse` | §PPT-04；noop+gate 路径已在代码中存在（CR-04 范式） |
| PPT-05 | `rotate_shape` 旋转形状（spike S1 门控），简单逆向 `restore_shape_rotation` | §PPT-05；spike 门控 + `shape.rotation` 可写性需真机 |
| PPT-06 | `manage_slides` 删除幻灯片（noop+gate），reverse `noop_inverse` | §PPT-06；noop+gate；v2.1 只暴露 delete operation |
| PPT-07 | `copy_slide` 复制幻灯片，简单逆向 `delete_slide_by_index`（index+ID/title 双定位） | §PPT-07；`slide.copy()` API + 指纹双定位设计 |
| PPT-08 | `set_slide_background` 设置幻灯片背景纯色（spike S2 门控），简单逆向 `restore_slide_background` | §PPT-08；`background.fill.setSolidColor` + try/catch before-image 方案 |
</phase_requirements>

---

## Summary

Phase 10 在 Phase 9 已建立的 Word undo 范式基础上，向 Excel 宿主新增 10 个 write tool + 向 PPT 宿主新增 8 个 write tool，合计 18 工具。所有 API 均在 Excel JS API 1.1–1.8 / PowerPoint JS API 1.4–1.10 范围内，Office for Web 完全支持，0 净新增运行时依赖。

**Excel 10 工具**覆盖四大类：①单元格格式化（format_excel_range、set_column_row_size）；②数据操作（sort_range、set_auto_filter、excel_find_and_replace）；③结构管理（add_conditional_format、create_table、freeze_panes、manage_worksheet）；④图表（set_chart_title）。快照式 undo 用于 sort/find_replace（range.sort.apply 清空原生撤销栈，官方文档明确记录），manage_worksheet 用轻量元数据快照（非整表内容）。上限 10,000 单元格防止超出 Office for Web 5MB API 响应限制。

**PPT 8 工具**分三类：①字体/对齐（set_shape_text_font 简单逆向，set_shape_text_alignment spike S4 门控）；②形状增删旋转（add_shape 含 deselect 绕 #2775，delete_shape noop+gate，rotate_shape spike S1 门控）；③幻灯片管理（manage_slides noop+gate，copy_slide 双定位，set_slide_background spike S2 门控）。三个 spike 门控工具全部采用运行时 isSetSupported + try/catch before-image + 降级 noop+gate 模式，不阻塞规划和实现。

undo 基础设施扩展路径清晰：`operationLog.ts` 加 15 个 `DocumentAdapterForReplay` 方法声明 + 15 个 `executeReverse` case；`ExcelAdapter.ts` 加 10 write + 9 inverse/snapshot 方法；`PptAdapter.ts` 加 8 write + 6 inverse 方法。每个 inverse 必须配 `operationLog.integration.test` 守门，用真实 adapter 实例（非 mock），Record 签名严格执行。

**Primary recommendation:** Wave 0 先建 undo 基础设施骨架（接口/case/测试桩）；Wave 1 并行实现 Excel 7 个简单逆向工具；Wave 2 Excel 快照式 + manage_worksheet；Wave 3 PPT 简单逆向；Wave 4 PPT spike 门控 + noop+gate。每工具完成后立即执行 D-19 四步守门。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| format_excel_range（写格式 + before-image） | API/Backend (ExcelAdapter) | — | range.format.* read/write 在 Excel.run 闭包内 |
| set_column_row_size（列宽行高 + before-image） | API/Backend (ExcelAdapter) | — | column.width/row.height 在 Excel.run 闭包内 |
| sort_range（快照式 + sort.apply） | API/Backend (ExcelAdapter) | — | 先 readRangeValuesSnapshot，再 range.sort.apply |
| set_auto_filter（筛选 + before-image） | API/Backend (ExcelAdapter) | — | sheet.autoFilter.apply/remove |
| excel_find_and_replace（快照式 + replaceAll） | API/Backend (ExcelAdapter) | — | 先读 used range values，再 replaceAll |
| add_conditional_format（规则 + index 反向） | API/Backend (ExcelAdapter) | — | conditionalFormats.add/clearAll |
| create_table（建表 + 按名删除） | API/Backend (ExcelAdapter) | — | tables.add + getItemOrNullObject |
| freeze_panes（冻结 + before-image） | API/Backend (ExcelAdapter) | — | worksheet.freezePanes.* |
| manage_worksheet（add/rename + 元数据快照） | API/Backend (ExcelAdapter) | — | worksheets.add / worksheet.name= |
| set_chart_title（图表标题 + before-image） | API/Backend (ExcelAdapter) | — | chart.title.text，复用 deleteChartByName 定位范式 |
| set_shape_text_font（字体 + before-image） | API/Backend (PptAdapter) | — | textRange.font.* + TEXT_SHAPE_TYPES 守门 |
| set_shape_text_alignment（spike S4 门控） | API/Backend (PptAdapter) | — | textRange.paragraphFormat.alignment，运行时门控 |
| add_shape（几何/文本框 + shapeId 捕获） | API/Backend (PptAdapter) | — | addGeometricShape/addTextBox，deselect 绕 #2775 |
| delete_shape（noop+gate） | API/Backend (PptAdapter) | — | shape.delete()，执行 + warn |
| rotate_shape（spike S1 门控） | API/Backend (PptAdapter) | — | shape.rotation，运行时门控 |
| manage_slides（noop+gate，delete） | API/Backend (PptAdapter) | — | slide.delete()，执行 + warn |
| copy_slide（slide.copy + 双定位逆向） | API/Backend (PptAdapter) | — | slide.copy() + id/index 双定位 |
| set_slide_background（spike S2 门控） | API/Backend (PptAdapter) | — | background.fill.setSolidColor，before-image try/catch |
| undo 路由（executeReverse switch） | API/Backend (operationLog.ts) | — | 不引用 Office 命名空间（A-06） |
| tool schema 参数校验（工具层 allowlist） | Frontend (ToolDef.execute) | — | 调 adapter 前先校验参数合法性 |

---

## Standard Stack

### Core（所有为现有 stack，0 净新增）

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Office.js (CDN) | hosted/office.js | Excel/PPT JS API | 官方 CDN，平台感知加载，不 npm 安装（官方弃用 npm 包） |
| @types/office-js | latest | TypeScript 类型 | Excel.run / PowerPoint.run / RangeFormat / Chart / Worksheet / Slide 全套类型 |
| ExcelAdapter.ts | (项目内) | Excel write + inverse | 已有 Excel.run 闭包范式、两 sync 规则、HostApiError 包装 |
| PptAdapter.ts | (项目内) | PPT write + inverse | 已有 PowerPoint.run 闭包范式、TEXT_SHAPE_TYPES、deleteSlideByTitle 等 |
| operationLog.ts | (项目内) | undo 引擎 + executeReverse | DocumentAdapterForReplay 接口 + replayUndoSingle |

**Installation:** 无需安装新包。所有改动在现有文件中。[VERIFIED: codebase audit]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 原生 range.sort.apply | 手动排序算法 | 原生 API 更可靠，但会清空撤销栈（必须快照式 undo） |
| conditionalFormats.clearAll + 重建 | 按 index 删除单条规则 | clearAll + 重建 在多规则场景更稳定，防索引漂移 |
| slide.copy() 后 load id | insertSlidesFromBase64 | copy() 更简单，id/index 双定位防漂移已够 |

---

## Per-Tool Implementation Notes（18 工具逐一）

### EXCEL-01: `format_excel_range` — 简单逆向

**Office.js API:**
```typescript
// 写格式（Excel.run 闭包内）
const range = sheet.getRange(address);
// before-image: load 格式属性（sync 1）
range.format.load(['numberFormat', 'fill/color', 'font/bold', 'font/color', 'font/size', 'font/name',
                   'horizontalAlignment', 'verticalAlignment', 'wrapText', 'borders/items']);
await ctx.sync();
// 读取 before-image，存 reverse.args
// 写入（sync 2）
if (numberFormat) range.numberFormat = [[numberFormat]]; // 注：numberFormat 是 2D 数组
if (fill?.color) range.format.fill.color = fill.color;
if (font?.bold !== undefined) range.format.font.bold = font.bold;
if (font?.color) range.format.font.color = font.color;
if (font?.size) range.format.font.size = font.size;
if (font?.name) range.format.font.name = font.name;
if (alignment) range.format.horizontalAlignment = alignment as Excel.HorizontalAlignment;
await ctx.sync();
```
[CITED: docs.microsoft.com/office/dev/add-ins/excel/excel-add-ins-ranges-set-format]

**Before-image 属性包（Claude's Discretion 填充）:** 推荐最稳子集：
- `numberFormat`（string，单元格级别，range.numberFormat[0][0] 取第一格）
- `fill.color`（string | null）
- `font.bold`（boolean | null）
- `font.color`（string | null）
- `font.size`（number | null）
- `font.name`（string | null）
- `horizontalAlignment`（string）

**注意:** `range.format.numberFormat` 和 `range.numberFormat` 是两个不同属性——`range.format.numberFormat` 是已废弃的单值，`range.numberFormat` 是 2D 数组，写入时必须用 2D 数组格式（`[[format_string]]` 或与 range 同维数组）。[CITED: docs.sheetjs.com 验证]

**borders 读写复杂度:** `range.format.borders` 包含 6 个边（insideHorizontal/insideVertical/diagonalUp/diagonalDown/edgeLeft/edgeRight/edgeTop/edgeBottom）；MVP 阶段只支持 edgeLeft/edgeRight/edgeTop/edgeBottom + insideHorizontal/insideVertical，各有 color/style/weight 三个属性。before-image 可先不含 borders（将工具 description 标注「border 支持基本四边」）。

**Inverse adapter 方法签名:**
```typescript
async restoreRangeFormat(args: Record<string, unknown>): Promise<void>
// args: { address, numberFormat?, fillColor?, fontBold?, fontColor?, fontSize?, fontName?, horizontalAlignment? }
```

**reverse tool name:** `restore_range_format`（逐字对齐 contract.test.ts 第 41 行）

**PostStateSnapshot kind:** `excel_range_format`（新 kind，readTargetState 返 undefined，D-21）

---

### EXCEL-02: `set_column_row_size` — 简单逆向

**Office.js API:**
```typescript
// target = 'column' | 'row'，indices = 列索引（0-based）或行索引（0-based）数组
// size = number（点数）| 'autoFit'
const sheet = ctx.workbook.worksheets.getActiveWorksheet();
if (target === 'column') {
  const col = sheet.getRange(`${colLetter}:${colLetter}`);
  col.load(['format/columnWidth']);
  await ctx.sync(); // sync 1: load before-image
  const beforeWidth = col.format.columnWidth;
  if (size === 'autoFit') col.format.autofitColumns();
  else col.format.columnWidth = size;
  await ctx.sync(); // sync 2: write
}
// row 同理，getRange(`${rowNum}:${rowNum}`)，format.rowHeight / autofitRows()
```
[CITED: docs.microsoft.com/office/dev/add-ins/excel/excel-add-ins-ranges-set-format - autofitColumns/autofitRows]

**多 indices 处理:** 对每个 index 逐一 load before-image，组成数组存入 reverse.args.beforeSizes（`[{index, size}]`）。

**Inverse adapter 方法签名:**
```typescript
async restoreColumnRowSize(args: Record<string, unknown>): Promise<void>
// args: { target: 'column'|'row', beforeSizes: Array<{index: number, size: number}> }
```

**reverse tool name:** `restore_column_row_size`（contract.test.ts 第 42 行）

---

### EXCEL-03: `sort_range` — 快照式

**Office.js API:**
```typescript
// 写前先 readRangeValuesSnapshot
const range = sheet.getRange(address);
range.load(['values', 'cellCount']);
await ctx.sync(); // sync 1: load before-image + cellCount 判断
if (range.cellCount > SNAPSHOT_LIMIT) {
  // 超限 → noop+gate，仍执行排序但 reverse = { tool: 'noop_inverse', args: { reason: '...' } }
}
const snapshot = range.values as unknown[][];
// 写排序（不需要第二次 load，直接 apply）
range.sort.apply(sortFields); // sortFields: Array<{ key: number, ascending: boolean }>
await ctx.sync(); // sync 2: apply sort
```
[CITED: docs.microsoft.com/office/dev/add-ins/excel/excel-add-ins-tables - Sort Data in an Excel Table]

**range.sort.apply 清空原生撤销栈:** Microsoft 官方文档明确记录 sort 操作会清空 Ctrl+Z 的原生撤销栈（PITFALLS E1；Aster 自建 undo 不受影响，但用户 Ctrl+Z fallback 归零）。[CITED: docs.microsoft.com/office/dev/add-ins/excel/excel-add-ins-undo-capabilities]

**快照上限推荐:** 10,000 单元格（PITFALLS E4：Office for Web 5MB API 响应上限；50,000 行 × 10 列 2D JSON 易超限；10,000 单元格约 = 200KB JSON，安全余量充分）。[CITED: PITFALLS.md §E4]

**sort.apply 参数：**
- `sortFields: Array<{ key: number; ascending: boolean }>` — key 是列相对索引（0-based，相对于 address 区域左侧）

**Inverse adapter 方法签名:**
```typescript
async restoreRangeValuesSnapshot(args: Record<string, unknown>): Promise<void>
// args: { address: string, snapshot: unknown[][] }
// 内部: range.values = snapshot，单次 sync
```

**reverse tool name:** `restore_range_values_snapshot`（contract.test.ts 第 43/45 行，EXCEL-03/05 共享）

---

### EXCEL-04: `set_auto_filter` — 简单逆向

**Office.js API:**
```typescript
// before-image: 读取 autoFilter 当前状态
const sheet = ctx.workbook.worksheets.getActiveWorksheet();
// 读 autoFilter 是否存在（load isDataFiltered）
sheet.autoFilter.load(['isDataFiltered', 'address', 'enabled']);
await ctx.sync(); // sync 1

// 写入：apply（带 criteria）或 remove
if (enabled) {
  sheet.autoFilter.apply(range, columnIndex, criteria);
} else {
  sheet.autoFilter.remove();
}
await ctx.sync(); // sync 2
```
[CITED: docs.microsoft.com/office/dev/add-ins/excel/excel-add-ins-worksheets - Apply/Remove AutoFilter]

**before-image 字段:** `{ hadFilter: boolean, address?: string, isDataFiltered?: boolean }`。inverse 逻辑：had filter → `autoFilter.apply(address, 0, {})` 仅恢复 filter 框（不恢复筛选条件，因为 before-image 读取筛选条件的 API 较复杂）；had no filter → `autoFilter.remove()`。这是合理的 best-effort（工具 description 需标注「undo 后仅恢复筛选框，不恢复筛选条件」）。[ASSUMED: autoFilter criteria before-image 可能需要 getFilterColumnCollection，待 planner 决定是否完整实现]

**Inverse adapter 方法签名:**
```typescript
async restoreAutoFilter(args: Record<string, unknown>): Promise<void>
// args: { hadFilter: boolean, address?: string }
```

**reverse tool name:** `restore_auto_filter`（contract.test.ts 第 44 行）

---

### EXCEL-05: `excel_find_and_replace` — 快照式

**Office.js API:**
```typescript
// 快照粒度：address 指定时读该区域；否则读 usedRange
const targetRange = address
  ? sheet.getRange(address)
  : sheet.getUsedRange(false); // false = 空表不抛
targetRange.load(['values', 'cellCount', 'address']);
await ctx.sync(); // sync 1: load before-image

if (range.cellCount > SNAPSHOT_LIMIT) { /* noop+gate */ }
const snapshot = targetRange.values as unknown[][];
const snapshotAddress = targetRange.address as string;

// 执行替换（replaceAll 是 ExcelApi 1.9）
const replaceResult = targetRange.replaceAll(searchText, replaceText, {
  completeMatch: matchWholeWord ?? false,
  matchCase: matchCase ?? false,
});
await ctx.sync(); // sync 2
// replaceResult.count 是替换次数
```
[ASSUMED: range.replaceAll 返回 ReplaceAllResult，需用 replaceResult.load('count') 再 sync 读取；ExcelApi 1.9 is available on Office for Web]

**注意:** `range.replaceAll` 在 ExcelApi 1.9（Office for Web 支持），不在 1.1 核心集。需用 `isSetSupported('ExcelApi', '1.9')` 门控，或直接假设 Office for Web 支持（CONTEXT D-10 镜像：运行时门控）。[ASSUMED: ExcelApi 1.9 on Office for Web availability — 高置信但需 isSetSupported 验证]

**快照上限:** 与 sort_range 共用 10,000 单元格上限（D-07）。

**reverse tool name:** `restore_range_values_snapshot`（与 EXCEL-03 共享；D-20 要求两条独立 integration.test 用例）

---

### EXCEL-06: `add_conditional_format` — 简单逆向

**Office.js API:**
```typescript
// 支持三种 rule type：cellValue（高亮）/ colorScale（色阶）/ dataBar（数据条）
const cf = range.conditionalFormats.add(Excel.ConditionalFormatType.cellValue);
cf.cellValue.format.font.color = rule.format.fontColor;
cf.cellValue.format.fill.color = rule.format.fillColor;
cf.cellValue.rule = { formula1: rule.value, operator: rule.operator };
await ctx.sync();
```
[CITED: docs.microsoft.com/office/dev/add-ins/excel/excel-add-ins-conditional-formatting]

**逆向策略 — 索引漂移防御（Claude's Discretion 决策）:**
推荐 **clearAll + 重建全部** 方式（非 delete_at_index）：
- before-image = 该 range 的所有现有条件格式（全 load + 序列化）
- inverse `restoreConditionalFormat`：先 `range.conditionalFormats.clearAll()`，再按 before-image 逐条重建
- 理由：单 index 删除在「同一 agent run 内连续添加多个条件格式」场景下 index 漂移严重（PITFALLS E6/T4）；clearAll + 重建是幂等的安全路径

before-image 序列化复杂度：MVP 阶段只序列化 cellValue + colorScale + dataBar 三种类型的核心属性，跳过 topBottom / aboveAverage / iconSet 等（写进 description）。

**Inverse adapter 方法签名:**
```typescript
async restoreConditionalFormat(args: Record<string, unknown>): Promise<void>
// args: { address: string, beforeFormats: ConditionalFormatSnapshot[] }
// ConditionalFormatSnapshot = { type: string, rule?: object, format?: object }
```

**reverse tool name:** `restore_conditional_format`（contract.test.ts 第 46 行）

---

### EXCEL-07: `create_table` — 简单逆向

**Office.js API:**
```typescript
const table = sheet.tables.add(address, hasHeaders ?? false);
if (tableName) table.name = tableName;
table.load(['name']);
await ctx.sync(); // load name（server-side property）
const resolvedName = table.name as string; // 用 Excel 分配的名（可能是 '表 1' 等默认名）
```
[CITED: docs.microsoft.com/office/dev/add-ins/excel/excel-add-ins-tables - Create a table]

**Inverse:** `delete_table_by_name` — 复用 `getItemOrNullObject` 防御（ExcelAdapter.deleteChartByName 同范式）：
```typescript
const table = sheet.tables.getItemOrNullObject(tableName);
table.load('isNullObject');
await ctx.sync();
if (!table.isNullObject) { table.delete(); await ctx.sync(); }
```

**Inverse adapter 方法签名:**
```typescript
async deleteTableByName(args: Record<string, unknown>): Promise<void>
// args: { tableName: string }
```

**reverse tool name:** `delete_table_by_name`（contract.test.ts 第 47 行）

---

### EXCEL-08: `freeze_panes` — 简单逆向

**Office.js API:**
```typescript
const fp = sheet.freezePanes;
// before-image: load location
fp.load(['location', 'frozenRows', 'frozenColumns']); // ExcelApi 1.2+
await ctx.sync(); // sync 1
const beforeLocation = fp.location as string;
const beforeRows = fp.frozenRows as number;
const beforeColumns = fp.frozenColumns as number;

// 写入
if (freezeRows > 0 && freezeColumns > 0) {
  fp.freezeAt(sheet.getCell(freezeRows, freezeColumns)); // freezeAt
} else if (freezeRows > 0) {
  fp.freezeRows(freezeRows);
} else if (freezeColumns > 0) {
  fp.freezeColumns(freezeColumns);
} else {
  fp.unfreeze();
}
await ctx.sync(); // sync 2
```
[CITED: docs.microsoft.com/office/dev/add-ins/excel - Add Freeze Header UI and Logic]

**Inverse adapter 方法签名:**
```typescript
async restoreFreezePanes(args: Record<string, unknown>): Promise<void>
// args: { frozenRows: number, frozenColumns: number }
// 0,0 = unfreeze；>0 = freezeRows/freezeColumns/freezeAt
```

**reverse tool name:** `restore_freeze_panes`（contract.test.ts 第 48 行）

---

### EXCEL-09: `manage_worksheet` — 快照式（元数据快照）

**Office.js API — add:**
```typescript
// operation='add'
const sheets = ctx.workbook.worksheets;
const newSheet = sheets.add(sheetName); // sheetName 是期望的名称
newSheet.load(['name']);
await ctx.sync();
const resolvedName = newSheet.name as string; // Excel 可能加序号
// 快照 = { operation: 'add', sheetName: resolvedName }（「该表名先前不存在」）
```

**Office.js API — rename:**
```typescript
// operation='rename'
const sheet = ctx.workbook.worksheets.getItem(sheetName); // 旧名
sheet.load(['name']);
await ctx.sync(); // sync 1: 确认存在 + 读旧名
const oldName = sheet.name as string;
sheet.name = newName;
await ctx.sync(); // sync 2
// 快照 = { operation: 'rename', oldName, newName }
```
[CITED: docs.microsoft.com/office/dev/add-ins/excel/excel-add-ins-worksheets - Add/Rename worksheet]

**Inverse — add 逆向 = 删除刚建的表（按 resolvedName）:**
- `sheet.delete()` — 注意：worksheets.delete() 会清空原生撤销栈（Pitfall E1），但 Aster 自建 undo 不依赖原生撤销栈，问题不大
- 用 getItemOrNullObject 防御

**Inverse — rename 逆向 = 改回 oldName**

**Inverse adapter 方法签名:**
```typescript
async restoreWorksheetSnapshot(args: Record<string, unknown>): Promise<void>
// args: { operation: 'add'|'rename', sheetName?: string, oldName?: string, newName?: string }
// add 逆向：删除 sheetName 对应的新表（getItemOrNullObject + delete）
// rename 逆向：getItem(newName).name = oldName
```

**reverse tool name:** `restore_worksheet_snapshot`（contract.test.ts 第 49 行）

**关键约束 (D-03):** operation 枚举 = `add | rename` 只；绝不含 delete/copy。工具 schema 用 enum 限制。

---

### EXCEL-10: `set_chart_title` — 简单逆向

**Office.js API:**
```typescript
// 按名称找图表（复用 deleteChartByName 的定位范式）
const chart = sheet.charts.getItemOrNullObject(chartName);
chart.load('isNullObject');
await ctx.sync(); // sync 1
if (chart.isNullObject) throw new HostApiError('图表不存在', undefined);
chart.title.load('text');
await ctx.sync(); // sync 2: load before-image
const beforeTitle = chart.title.text as string;
chart.title.text = title;
await ctx.sync(); // sync 3: write
```
[CITED: Context7 /officedev/office-js-docs-pr - Setup Excel Chart Environment: chart.title.text]

**Inverse adapter 方法签名:**
```typescript
async restoreChartTitle(args: Record<string, unknown>): Promise<void>
// args: { chartName: string, beforeTitle: string }
```

**reverse tool name:** `restore_chart_title`（contract.test.ts 第 50 行）

---

### PPT-01: `set_shape_text_font` — 简单逆向

**Office.js API:**
```typescript
// 复用 PptAdapter setShapeText 的 4-sync 范式 + TEXT_SHAPE_TYPES 守门
const shape = ...; // 定位 shape（同 setShapeText 2-sync 定位）
if (!TEXT_SHAPE_TYPES.has(shape.type)) throw HostApiError(...);

// sync 3: load before-image（font 属性）
shape.textFrame.textRange.font.load(['bold', 'italic', 'underline', 'color', 'size', 'name']);
await ctx.sync();
const beforeFont = { bold, italic, underline, color, size, name };

// 写入
if (font.bold !== undefined) shape.textFrame.textRange.font.bold = font.bold;
if (font.color) shape.textFrame.textRange.font.color = font.color;
if (font.size) shape.textFrame.textRange.font.size = font.size;
if (font.name) shape.textFrame.textRange.font.name = font.name;
await ctx.sync(); // sync 4
```
[CITED: Context7 /officedev/office-js-docs-pr - Create and Format a Geometric Shape with Text in PowerPoint: braces.textFrame.textRange.font.color]

**Inverse adapter 方法签名:**
```typescript
async restoreShapeFont(args: Record<string, unknown>): Promise<void>
// args: { slide_index, shape_id, before_font: { bold?, italic?, underline?, color?, size?, name? } }
```

**reverse tool name:** `restore_shape_font`（contract.test.ts 第 52 行）

---

### PPT-02: `set_shape_text_alignment` — 简单逆向（spike S4 门控）

**目标 API:**
```typescript
// textRange.paragraphFormat.alignment（PPT JS API，具体 requirement set 待 spike 确认）
shape.textFrame.textRange.paragraphFormat.load('alignment');
// 写入
shape.textFrame.textRange.paragraphFormat.alignment = alignment; // 'Left'|'Center'|'Right'|'Justify'
```
[ASSUMED: `textRange.paragraphFormat.alignment` 的读写性在 Office for Web 未经真机验证；spike S4 门控]

**运行时门控实现（D-10/D-11）:**
```typescript
// 运行时读 before-image
try {
  shape.textFrame.textRange.paragraphFormat.load('alignment');
  await ctx.sync();
  const beforeAlignment = shape.textFrame.textRange.paragraphFormat.alignment;
  // happy-path: 简单逆向
} catch {
  // 降级: noop+gate
  return { reverse: { tool: 'noop_inverse', args: { reason: 'paragraphFormat.alignment 不可读（spike S4 未通过）' } } };
}
```

**integration.test 守门:** 测试 happy-path（读得到 → rolled_back）。运行时降级由真机 UAT（ROADMAP SC#5）验证。

**Inverse adapter 方法签名:**
```typescript
async restoreShapeAlignment(args: Record<string, unknown>): Promise<void>
// args: { slide_index, shape_id, before_alignment: string }
```

**reverse tool name:** `restore_shape_alignment`（contract.test.ts 第 53 行）

---

### PPT-03: `add_shape` — 简单逆向

**Office.js API — 几何形状:**
```typescript
const slide = slides.items[slideIndex - 1];
const shape = slide.shapes.addGeometricShape(
  shapeType as PowerPoint.GeometricShapeType,
  { left, top, width, height }
);
shape.load(['id']);
await ctx.sync(); // load id（server-side property，sync 后才可读）
const newShapeId = shape.id as string;
// 写入文字（如有）
if (text) {
  if (TEXT_SHAPE_TYPES.has(shape.type)) {
    shape.textFrame.textRange.text = text;
    await ctx.sync();
  }
}
```
[CITED: Context7 /officedev/office-js-docs-pr - Create and bind a geometric shape in PowerPoint]

**Office.js API — 文本框（addTextBox，绕 #2775）:**
```typescript
// D-15: 文本框前必须 deselect 所有形状（绕 GitHub #2775：addTextBox 静默删选中形状）
// deselect workaround: 在闭包外先用 Office.context.document.goToByIdAsync 跳到一个空区域，
// 或 ctx.presentation.getSelectedSlides() 后无法直接 deselect；
// 实际可行方案：load shapes count before，addTextBox，再 load count after，count++ 校验

// 先记录当前 shape 数量
slide.shapes.load('items/$none'); // load items but not properties（count only）
await ctx.sync();
const countBefore = slide.shapes.items.length;

const textbox = slide.shapes.addTextBox(text ?? '', { left, top, width, height });
textbox.load(['id']);
await ctx.sync();

// 校验 shape count（#2775 防御）
slide.shapes.load('items/$none');
await ctx.sync();
const countAfter = slide.shapes.items.length;
if (countAfter < countBefore) {
  throw new HostApiError('PPT addTextBox: 插入后 shape 数量减少，可能触发 #2775 bug', undefined);
}
const newShapeId = textbox.id as string;
```
[CITED: Context7 /officedev/office-js-docs-pr - Create a Text Box Shape in PowerPoint; PITFALLS P2 #2775]

**注意:** Office.js PPT 无原生「取消选中所有形状」API；count 校验是检测 #2775 触发的最可靠方法。如果检测到 count 减少，应抛 HostApiError，执行失败优于静默数据丢失。

**Inverse adapter 方法签名:**
```typescript
async deleteShapeById(args: Record<string, unknown>): Promise<void>
// args: { slide_index, shape_id }
// 内部：找到 shape.id === shape_id，shape.delete()，getItemOrNullObject 防御
```
[CITED: Context7 /officedev/office-js-docs-pr - Delete all shapes from a slide using PowerPoint JavaScript API]

**reverse tool name:** `delete_shape_by_id`（contract.test.ts 第 54 行）

---

### PPT-04: `delete_shape` — noop+gate

**正向执行（照常删除）:**
```typescript
shape.delete();
await ctx.sync();
```

**reverse descriptor:**
```typescript
{ tool: 'noop_inverse', args: { reason: '形状完整状态（类型/填充/文字/字体）无法序列化重建，此步不可自动撤销' } }
```

**D-13 行为:** executeReverse noop_inverse case → throw → skipped_error → DiffLog「此步无法自动撤销」

**reverse tool name:** `noop_inverse`（contract.test.ts 第 55 行）

**integration.test 守门:** 验证 `executeReverse({tool:'noop_inverse', args:{reason:'...'}}, adapter)` → throw → replayUndoSingle 返回 `{ status: 'skipped_error' }`。

---

### PPT-05: `rotate_shape` — 简单逆向（spike S1 门控）

**目标 API:**
```typescript
// shape.rotation — GitHub issue #3022 指此属性在 Office for Web 的可写性待确认
shape.load(['rotation']);
await ctx.sync(); // load before-image
const beforeRotation = shape.rotation as number;
shape.rotation = rotation; // degrees
await ctx.sync();
```
[ASSUMED: `shape.rotation` 在 Office for Web 的写入支持需 spike S1 真机验证]

**运行时门控（同 PPT-02）:**
```typescript
try {
  shape.load(['rotation']);
  await ctx.sync();
  const beforeRotation = shape.rotation;
  shape.rotation = rotation;
  await ctx.sync();
  // happy-path
} catch {
  // 降级: noop+gate
}
```

**Inverse adapter 方法签名:**
```typescript
async restoreShapeRotation(args: Record<string, unknown>): Promise<void>
// args: { slide_index, shape_id, before_rotation: number }
```

**reverse tool name:** `restore_shape_rotation`（contract.test.ts 第 56 行）

---

### PPT-06: `manage_slides` — noop+gate

**正向执行（v2.1 只支持 operation='delete'，D-14）:**
```typescript
const slide = slides.items[slideIndex - 1];
slide.delete();
await ctx.sync();
```

**reverse descriptor:**
```typescript
{ tool: 'noop_inverse', args: { reason: '幻灯片内容无法通过 Office.js 序列化导出，此步不可自动撤销' } }
```

**参数 schema:** `{ operation: 'delete', slideIndex: number }`（operation enum 限定 'delete'；reorder 不在 v2.1）

**reverse tool name:** `noop_inverse`（contract.test.ts 第 58 行）

---

### PPT-07: `copy_slide` — 简单逆向

**Office.js API — slide.copy():**
```typescript
// PPT JS API 1.4+: Slide.copy()
const sourceSlide = slides.items[sourceIndex - 1];
// PPT-05 守则：sortedByIndex
sourceSlide.copy();
// copy() 把新 slide 插入到 sourceSlide 之后（或末尾，实现依赖 Office 版本）
// load 新增后的 slides 列表，找到新 slide
slides.load('items');
await ctx.sync(); // 重新 load 后找 targetIndex 处的 slide

// 捕获新 slide 的 id + index 指纹（双定位，D-16）
const sorted = [...slides.items].sort((a, b) => a.index - b.index);
const newSlide = sorted[targetIndex - 1]; // targetIndex 是期望插入位置
newSlide.load(['id', 'index']);
await ctx.sync();
const capturedId = newSlide.id as string;
const capturedIndex = newSlide.index as number;
```
[ASSUMED: PPT JS API Slide.copy() 行为在 Office for Web 具体插入位置需 UAT 验证；id 属性已在 PPT API docs 中记录]

**copy_slide 双定位指纹（D-16）:**
- `reverse.args.capturedIndex`：捕获时的 index（0-based）
- `reverse.args.capturedId`：捕获时的 slide.id（唯一标识符，不随 slide 顺序变化）
- `deleteSlideByIndex` 实现：优先按 capturedId 找 slide（遍历 `slides.items.find(s => s.id === id)`）；找到 → 删；找不到 → 按 capturedIndex + title 指纹后备；都找不到 → skipped_error

**Inverse adapter 方法签名:**
```typescript
async deleteSlideByIndex(args: Record<string, unknown>): Promise<void>
// args: { capturedIndex: number, capturedId: string }
// 实现：优先 id 定位，后备 index，都失败 → throw HostApiError
```

**reverse tool name:** `delete_slide_by_index`（contract.test.ts 第 59 行）

---

### PPT-08: `set_slide_background` — 简单逆向（spike S2 门控）

**Office.js API — 写（PPT API 1.10）:**
```typescript
// background.fill.setSolidColor(hex) 在 PPT API 1.10
const slide = slides.items[slideIndex - 1];
slide.background.fill.setSolidColor(color); // color = '#RRGGBB'
await ctx.sync();
```

**Before-image 读取（spike S2 — 结果不确定）:**
```typescript
try {
  slide.background.fill.load(['type', 'foregroundColor']); // 尝试读取
  await ctx.sync();
  const beforeColor = slide.background.fill.foregroundColor as string | null;
  // happy-path: 简单逆向
} catch {
  // 降级: noop+gate（读不到 background before-image）
}
```
[ASSUMED: slide.background.fill.foregroundColor 可读性在 Office for Web 未经验证（PITFALLS P5）；spike S2 门控]

**D-12:** 只写纯色填充（setSolidColor），不实现读主题色/读背景色的 read 工具。

**Inverse adapter 方法签名:**
```typescript
async restoreSlideBackground(args: Record<string, unknown>): Promise<void>
// args: { slide_index, before_color: string | null }
// before_color = null 时：slide.background.fill.clear()（恢复无背景/默认背景）
```

**reverse tool name:** `restore_slide_background`（contract.test.ts 第 57 行）

---

## Architecture Patterns

### System Architecture Diagram

```
[ToolDef.execute(args)]
       |
       v
[ctx.adapter method call (纯数据 in/out, A-06)]
       |
       +---> [ExcelAdapter.xxx() / PptAdapter.xxx()]
       |           |
       |           +---> [Excel.run() / PowerPoint.run() 闭包]
       |           |           |
       |           |           +---> load → sync 1 (before-image read)
       |           |           +---> write
       |           |           +---> sync 2 (write confirm)
       |           |           +---> return { beforeImage / snapshot }
       |           |
       |           +---> return { beforeImage / snapshot }
       |
       v
[ToolDef: build reverse descriptor + postState]
       |
       v
[OperationLog.appendOperation(entry)]
       |
       v
[replayUndoSingle(entry, adapter)]
       |
       +---> readTargetState (postState check, 保守 undefined)
       +---> executeReverse(reverse, adapter)
                   |
                   v
            [switch(reverse.tool) → adapter.restoreXxx(args)]
                   |
                   +---> rolled_back / skipped_error / skipped_manual
```

### Recommended Project Structure — Phase 10 文件改动

```
src/
├── adapters/
│   ├── ExcelAdapter.ts       # 加 10 write + 9 inverse/snapshot 方法
│   └── PptAdapter.ts         # 加 8 write + 6 inverse 方法
├── agent/
│   ├── operationLog.ts       # DocumentAdapterForReplay +15 + executeReverse +15 case + kind union
│   ├── contract.test.ts      # 18 行 integrationTest false→true（实现后逐步翻）
│   ├── operationLog.integration.test.ts  # ≥18 守门用例（+3 noop+gate）
│   └── tools/
│       ├── write/
│       │   ├── excel.ts      # +10 ToolDef（EXCEL-01..10）
│       │   └── ppt.ts        # +8 ToolDef（PPT-01..08）
│       └── index.ts          # buildToolsForHost('excel'/'ppt') 注册新工具
└── (可能新增/修改)
    ├── adapters/ExcelAdapter.test.ts
    └── adapters/PptAdapter.test.ts
```

### Pattern 1: 简单逆向（前 before-image，后 inverse）

适用于 EXCEL-01/02/04/07/08/10 + PPT-01/03/05/07/08（spike happy-path）

```typescript
// 1. execute() 调用 adapter write 方法，获取 before-image
const { beforeImage } = await (ctx.adapter as ExcelAdapter).setRangeFormat(address, format);

// 2. 构建 reverse descriptor（Record 对象，非位置参）
const reverse: ReverseDescriptor = {
  tool: 'restore_range_format',
  args: { address: beforeImage.address, numberFormat: beforeImage.numberFormat, ... }
};

// 3. adapter inverse 方法签名（硬约束 D-18）
async restoreRangeFormat(args: Record<string, unknown>): Promise<void> {
  const address = args.address as string;
  // ...
}
```
[Source: 现有 ExcelAdapter.overwriteRange / PptAdapter.restoreShapeProperty — Record 签名范式]

### Pattern 2: 快照式（写前 readSnapshot，inverse 覆写）

适用于 EXCEL-03/05/09

```typescript
// ExcelAdapter: 写前读快照
async readRangeValuesSnapshot(address: string): Promise<{ address: string; snapshot: unknown[][] }> {
  return await Excel.run(async (ctx) => {
    const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
    range.load(['values', 'address', 'cellCount']);
    await ctx.sync();
    if (range.cellCount > SNAPSHOT_LIMIT) {
      throw new SnapshotTooLargeError(range.cellCount);
    }
    return { address: range.address as string, snapshot: range.values as unknown[][] };
  });
}

// execute() 调用流程
const { address: snapshotAddress, snapshot } = await adapter.readRangeValuesSnapshot(address);
// ... 执行写操作 ...
const reverse: ReverseDescriptor = {
  tool: 'restore_range_values_snapshot',
  args: { address: snapshotAddress, snapshot }
};

// executeReverse case
case 'restore_range_values_snapshot':
  await adapter.restoreRangeValuesSnapshot(reverse.args);
  break;
```
[Source: 现有 Phase 9 Word find_and_replace 快照式范式，同构]

### Pattern 3: noop+gate（执行 + warn，不阻塞）

适用于 PPT-04/06 + 快照超限降级

```typescript
// execute() 中
const reverse: ReverseDescriptor = {
  tool: 'noop_inverse',
  args: { reason: '此操作不可自动撤销：...' }
};
// 操作照常执行，仅 reverse = noop_inverse

// operationLog.ts executeReverse（已存在）
case 'noop_inverse':
  throw new Error(`noop_inverse: 此操作不支持自动回滚（${String(reverse.args.reason ?? '')}）`);
  // → replayUndoStep catch → skipped_error → DiffLog「此步无法自动撤销」
```
[Source: 现有 operationLog.ts line 300-303 — noop_inverse case 已实现]

### Pattern 4: spike 门控（运行时 isSetSupported + try/catch）

适用于 PPT-02/05/08

```typescript
async setShapeTextAlignment(slideIndex: number, shapeId: string, alignment: string): Promise<{
  beforeAlignment: string | null; // null = 降级到 noop
}> {
  return await PowerPoint.run(async (ctx) => {
    // ... 定位 shape ...
    try {
      shape.textFrame.textRange.paragraphFormat.load('alignment');
      await ctx.sync();
      const beforeAlignment = shape.textFrame.textRange.paragraphFormat.alignment as string;
      // happy-path: 写入
      shape.textFrame.textRange.paragraphFormat.alignment = alignment;
      await ctx.sync();
      return { beforeAlignment };
    } catch {
      // spike 未通过：仍执行（如可能），降级信号
      return { beforeAlignment: null };
    }
  });
}

// execute() 根据 beforeAlignment 决定 reverse
const reverse: ReverseDescriptor = beforeAlignment === null
  ? { tool: 'noop_inverse', args: { reason: 'paragraphFormat.alignment 不可读，此步不可自动撤销' } }
  : { tool: 'restore_shape_alignment', args: { slide_index, shape_id, before_alignment: beforeAlignment } };
```

### Anti-Patterns to Avoid

- **位置参数 inverse 方法:** `restoreRangeFormat(address, numberFormat, fillColor)` — 绝对禁止；必须用 `(args: Record<string, unknown>)` 签名（Phase 5 教训）
- **在 inverse 中用 mock 替代真实 adapter:** integration.test 必须用真实 ExcelAdapter/PptAdapter 实例
- **在 Excel.run 循环中 sync:** 多 index 操作（如 set_column_row_size 多列）不要在循环内 sync；批量 load → 单次 sync
- **PPT addTextBox 不 deselect:** 会触发 #2775 静默删除选中形状
- **sort_range 不存快照直接执行:** sort.apply 清空原生撤销栈，不存快照则永久不可还原
- **manage_worksheet 含 delete operation:** Out of Scope，工具 schema enum 必须排除

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 单元格格式 before-image 读取 | 手写 range.load 列表 | 参照 setShapeProperty 四 sync 范式 | 属性列表已经验证，照用 |
| range.sort 快照 | 自己实现排序算法排列逆序 | readRangeValuesSnapshot + restore | sort.apply 比手写更可靠；快照比逆序算法更精确 |
| shape ID 捕获 | 用 title/text 字段做 ID | shape.load(['id']) + sync 后读取 | shape.id 是稳定 UUID；title 可重复 |
| 条件格式逆向 | 记录规则 index 单条删除 | clearAll + 全量重建 | 多规则并发时 index 漂移；clearAll 是幂等的安全路径 |
| slide copy 后定位 | 纯 index 定位 | index + id 双定位 | slide 操作可能改变其他 slide 的 index（PITFALLS P4）|

---

## Spike-Gated Fallback Decision Tree

### S1: `rotate_shape`（shape.rotation 可写性，GitHub #3022）

```
运行时:
  try { shape.load(['rotation']); sync; shape.rotation = value; sync }
    ├── 成功: before_rotation 捕获 → 简单逆向 restore_shape_rotation ✓
    └── 异常: before_rotation = null → noop_inverse + reason（warn 不中断）

integration.test 守门验: happy-path（模拟读得到 → rolled_back）
真机 UAT（ROADMAP SC#5 verdict 记录点）:
  - 测 rotate_shape → undo → 旋转角度恢复
  - 若失败 → spike S1 结论 = noop+gate（记录在 STATE.md）
```

### S2: `set_slide_background`（slide.background.fill 可读性，PPT API 1.10）

```
运行时:
  setSolidColor(color) 写入 [可靠，PPT API 1.10 官方记录]
  try { background.fill.load(['type', 'foregroundColor']); sync }
    ├── 成功 + foregroundColor 非 null: 简单逆向 restore_slide_background ✓
    ├── 成功但 foregroundColor = null（默认/主题背景）: before_color=null → reverse = clear()
    └── 异常: noop_inverse + reason

isSetSupported 门控: Office.context.requirements.isSetSupported('PowerPointApi', '1.10')
  - 不支持 1.10 → 跳过写入 + return noop+gate（不应到达，Office for Web 一般支持 1.10）
```

### S4: `set_shape_text_alignment`（textRange.paragraphFormat.alignment 读写性）

```
运行时:
  try { paragraphFormat.load('alignment'); sync; paragraphFormat.alignment = value; sync }
    ├── 成功: before_alignment 捕获 → 简单逆向 restore_shape_alignment ✓
    └── 异常 / alignment 为 undefined: noop_inverse + reason

integration.test 守门验: 假设 happy-path（构造 mock alignment → rolled_back）
真机 UAT: 测 set_shape_text_alignment → undo → 对齐方式恢复
```

**S7: `add_shape` addTextBox #2775 deselect（不是真正 spike，是已知 bug 防御）:**
```
实现时 count before / addTextBox / count after
count_after < count_before → throw HostApiError（明确失败，不静默丢数据）
count_after >= count_before → 正常捕获 shapeId → 简单逆向
```

---

## Excel Snapshot Cap Recommendation

**推荐上限: 10,000 单元格**

**依据:**
- Office for Web Excel API 响应上限: 5MB（PITFALLS E4，CITED: learn.microsoft.com/office/dev/add-ins/testing/application-specific-api-error-handling）
- 50,000 行 × 10 列 2D JSON（每格平均 20 bytes）= 10MB，超限
- 10,000 单元格 × 200 bytes（估算含 JSON overhead）= 2MB，安全余量充分
- 与 `src/adapters/ExcelAdapter.ts` 已有 `CELL_LIMIT = 10_000` 常量对齐（line 166）

**实现:**
```typescript
const SNAPSHOT_LIMIT = 10_000; // 与现有 CELL_LIMIT 对齐
if (range.cellCount > SNAPSHOT_LIMIT) {
  // 超限降级：仍执行操作，但 reverse = noop_inverse
  return { snapshot: null, tooLarge: true };
}
```

**超限行为:** `reverse = { tool: 'noop_inverse', args: { reason: `区域有 ${cellCount} 个单元格（超过 10,000 上限），无法自动撤销` } }`

---

## Common Pitfalls

### Pitfall 1: range.sort.apply 清空原生撤销栈（Excel E1）
**What goes wrong:** 调用 sort 后用户 Ctrl+Z 失效
**Why it happens:** Microsoft 官方文档记录 sort/worksheet.copy/protect 等 API 会清空 Office 原生撤销栈
**How to avoid:** Aster 自建 undo 不依赖原生撤销栈，影响限于用户 Ctrl+Z 失去 fallback；在工具 description 中告知用户「此操作会影响 Excel 自带的撤销历史」
**Warning signs:** 用户反馈「排序后 Ctrl+Z 无效」
[CITED: PITFALLS.md §E1]

### Pitfall 2: Office for Web 5MB API 响应上限（Excel E4）
**What goes wrong:** sort_range / excel_find_and_replace 对大区域快照，readRangeValuesSnapshot 超 5MB 抛 GeneralException
**Why it happens:** Office for Web 有 5MB API 响应体上限（PITFALLS E4）
**How to avoid:** SNAPSHOT_LIMIT = 10,000 单元格（前置 cellCount 检查，超限直接降级 noop+gate，不等到 API 抛异常）
**Warning signs:** 用户操作大表格排序返回 HostApiError
[CITED: PITFALLS.md §E4]

### Pitfall 3: addTextBox 静默删除选中形状（PPT P2，#2775）
**What goes wrong:** PPT Web 端调用 addTextBox 后，原本选中的形状消失
**Why it happens:** Office.js 已知 bug #2775（GitHub OfficeDev/office-js/issues/2775）
**How to avoid:** 插入前 count before，插入后 count after，count 减少 → throw HostApiError；不静默接受数据丢失
**Warning signs:** 新 shape 添加成功但 count <= countBefore

### Pitfall 4: copy_slide 后用 title 定位 → 删错 slide（PPT P4）
**What goes wrong:** copy_slide reverse 按 title 找 slide，复制出的 slide 与原 slide 同 title，误删原 slide
**Why it happens:** duplicate_slide 结果与原 slide title 相同（PITFALLS P4）
**How to avoid:** D-16 double-fingerprint：捕获新 slide 的 id + index；deleteSlideByIndex 实现内部优先 id 匹配，不用 title
**Warning signs:** copy_slide undo 删除了错误的 slide

### Pitfall 5: 排序区域含合并单元格（Excel E5）
**What goes wrong:** sort_range 对含合并单元格的区域抛 GeneralException
**Why it happens:** Office.js range.sort.apply 不支持合并单元格区域（PITFALLS E5）
**How to avoid:** 工具 description 标注限制；不在代码中前置检测（过于复杂）；让 HostApiError 自然冒泡
**Warning signs:** sort_range 对某区域始终失败

### Pitfall 6: manage_worksheet delete operation 误入（D-03 / Out of Scope）
**What goes wrong:** 若 operation 枚举不严格，LLM 可能传入 'delete'，导致整表永久丢失
**Why it happens:** CONTRACT.md 第 38 行参数摘要列了 delete/copy，但 D-03 已裁决不含 delete
**How to avoid:** 工具 schema 用 enum: ['add', 'rename'] 硬限制；工具 description 明确标注「不支持 delete（见 Out of Scope）」
**Warning signs:** manage_worksheet(operation='delete') 工具调用

### Pitfall 7: inverse adapter 位置参签名（D-18 硬约束）
**What goes wrong:** `restoreRangeFormat(address, numberFormat)` 位置参 → replay engine 传 Record 对象 → undefined
**Why it happens:** Phase 5 教训（memory project_adapter_inverse_signature）
**How to avoid:** 所有 15 个新 inverse 方法签名一律 `(args: Record<string, unknown>)`；contract.test.ts D-17 守门 + integration.test 真实 adapter 实例验证
**Warning signs:** undo 执行后参数全为 undefined，HostApiError

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest（已配置，package.json 中 `test: vitest`） |
| Config file | vite.config.ts（vitest 配置内联） |
| Quick run command | `npm run test -- src/agent/operationLog.integration.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXCEL-01 | format_excel_range write → undo → format restored | integration | `npm run test -- operationLog.integration.test.ts` | ❌ Wave 0 |
| EXCEL-02 | set_column_row_size write → undo → size restored | integration | same | ❌ Wave 0 |
| EXCEL-03 | sort_range (≤10K cells) write → undo → values restored | integration | same | ❌ Wave 0 |
| EXCEL-04 | set_auto_filter write → undo → filter cleared | integration | same | ❌ Wave 0 |
| EXCEL-05 | excel_find_and_replace write → undo → values restored | integration | same | ❌ Wave 0（EXCEL-05 独立用例，D-20） |
| EXCEL-06 | add_conditional_format write → undo → cf cleared | integration | same | ❌ Wave 0 |
| EXCEL-07 | create_table write → undo → table deleted | integration | same | ❌ Wave 0 |
| EXCEL-08 | freeze_panes write → undo → panes restored | integration | same | ❌ Wave 0 |
| EXCEL-09 | manage_worksheet add → undo → sheet deleted | integration | same | ❌ Wave 0（add/rename 各一条） |
| EXCEL-10 | set_chart_title write → undo → title restored | integration | same | ❌ Wave 0 |
| PPT-01 | set_shape_text_font write → undo → font restored | integration | same | ❌ Wave 0 |
| PPT-02 | set_shape_text_alignment happy-path → undo → alignment restored | integration | same | ❌ Wave 0（spike S4 happy-path） |
| PPT-03 | add_shape write → undo → shape deleted | integration | same | ❌ Wave 0 |
| PPT-04 | delete_shape → executeReverse noop_inverse → skipped_error | integration | same | ❌ Wave 0 |
| PPT-05 | rotate_shape happy-path → undo → rotation restored | integration | same | ❌ Wave 0（spike S1 happy-path） |
| PPT-06 | manage_slides delete → executeReverse noop_inverse → skipped_error | integration | same | ❌ Wave 0 |
| PPT-07 | copy_slide write → undo → slide deleted by id+index | integration | same | ❌ Wave 0 |
| PPT-08 | set_slide_background happy-path → undo → color restored | integration | same | ❌ Wave 0（spike S2 happy-path） |
| D-07 超限 | sort_range > 10K cells → noop_inverse → skipped_error | integration | same | ❌ Wave 0 |
| noop-gate 通用 | executeReverse(noop_inverse) → throw → skipped_error | unit | `npm run test -- operationLog.integration.test.ts` | ❌ Wave 0 |

**D-17/D-19 守门关键约束:**
- integration.test 必须用真实 ExcelAdapter / PptAdapter 实例（非 mock）
- 每个 toolName 字符串必须出现在 `operationLog.integration.test.ts` 文件内（contract.test.ts 第 114-137 行 fs.readFileSync 硬卡）
- EXCEL-03 和 EXCEL-05 共享 `restore_range_values_snapshot` case，但各需独立用例（D-20）

### Sampling Rate

- **Per task commit:** `npm run test -- src/agent/operationLog.integration.test.ts --reporter=verbose`（只跑 integration test，速度快）
- **Per wave merge:** `npm run test`（全套）
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps（必须在 Wave 0 建立，其余 wave 依赖）

- [ ] `src/agent/operationLog.integration.test.ts` — 追加 18 条工具守门用例框架（先写 `.todo` 桩，Wave 1-4 逐步实现），确保每个 toolName 在文件内存在（D-17 硬卡）
- [ ] `src/agent/contract.test.ts` — 18 行 `integrationTest: false`（已存在，Wave 1-4 逐步翻 true）
- [ ] `src/agent/operationLog.ts` — DocumentAdapterForReplay 接口加 15 个新方法声明骨架 + executeReverse 加 15 个 case（Wave 0 建骨架，Wave 1-4 填充 adapter 实现）

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | tool schema enum 限制 operation 枚举（manage_worksheet: add/rename，manage_slides: delete）；address 格式校验 |
| V2 Authentication | no | API Key 无新增路径 |
| V4 Access Control | no | Office.js host isolation（buildToolsForHost 已按 host 隔离） |
| V6 Cryptography | no | 无新增密码学操作 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| manage_worksheet(operation='delete') 绕过 Out of Scope | Elevation of Privilege | enum: ['add', 'rename'] 硬限制；D-03 裁决 |
| 大 snapshot 内存炸弹（sort_range 超 5MB 区域） | Denial of Service | SNAPSHOT_LIMIT = 10,000 cells 前置检查 |
| addTextBox #2775 静默删数据 | Tampering | count before/after 校验；count 减少 → throw |
| noop_inverse reason 含 XSS（内容出现在 DiffLog UI） | Injection | reason 字段在 DiffLogPanel 用 React 渲染（不 dangerouslySetInnerHTML），XSS 不成立 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `range.replaceAll` 在 ExcelApi 1.9，Office for Web 支持 | EXCEL-05 | 若不支持需改用 body.search + 逐 range replace，工作量+1 |
| A2 | `textRange.paragraphFormat.alignment` 读写可行（PPT spike S4） | PPT-02 | 降级 noop+gate，功能 degraded 但不 block；TRUE 路径需真机 UAT |
| A3 | `shape.rotation` 在 Office for Web 可写（PPT spike S1，issue #3022） | PPT-05 | 降级 noop+gate；TRUE 路径需真机 UAT |
| A4 | `slide.background.fill.foregroundColor` 在 Office for Web 可读（PPT spike S2） | PPT-08 | 降级 noop+gate；before-image 读不到时还原颜色失败 |
| A5 | `slide.copy()` 在 PPT JS API 可用，且新 slide 有 `.id` 属性 | PPT-07 | 若 copy() 不存在需用 insertSlidesFromBase64 替代，实现大幅复杂化 |
| A6 | `autoFilter` before-image 不需要完整 criteria 序列化（best-effort） | EXCEL-04 | inverse 还原筛选框但不还原筛选条件；用户可接受（description 标注） |

---

## Open Questions

1. **EXCEL-05 range.replaceAll 可用性**
   - What we know: ExcelApi 1.9 包含 replaceAll；官方文档有记录
   - What's unclear: Office for Web 具体版本支持日期；是否需 isSetSupported 门控
   - Recommendation: planner 在 Wave 2 任务中加 `isSetSupported('ExcelApi', '1.9')` 门控；不支持时降级为 body.search 遍历替换

2. **PPT slide.copy() API 行为**
   - What we know: Slide.copy() 存在于 PPT JS API；insertSlidesFromBase64 已验证
   - What's unclear: copy() 后新 slide 插入的精确位置（源 slide 之后 vs 末尾）
   - Recommendation: planner 的 Wave 3 任务：实现后验证 insertedIndex，copy 总是追加末尾则 targetIndex 参数语义需调整

3. **add_conditional_format before-image 的全量序列化复杂度**
   - What we know: conditionalFormats 包含多种类型（cellValue/colorScale/dataBar/topBottom 等）
   - What's unclear: 非 MVP 类型的序列化方案
   - Recommendation: MVP 只序列化 cellValue/colorScale/dataBar；before-image 中其余类型标 `{ type: 'unknown', raw: true }` 并在 clearAll 中一并清除（接受 best-effort）

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Office.js (CDN) | Excel/PPT write APIs | ✓ | hosted/1.x (platform-aware) | — |
| ExcelApi 1.8 | create_table, conditionalFormats | ✓ (Office for Web) | 1.8 GA | — |
| PowerPointApi 1.4 | addGeometricShape, shape.left/top | ✓ (Office for Web) | 1.4 GA | — |
| PowerPointApi 1.10 | slide.background.fill | ✓ (assumed, spike S2) | 1.10 | noop+gate |
| ExcelApi 1.9 | range.replaceAll | ✓ (assumed, isSetSupported) | 1.9 | body.search 遍历 |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @microsoft/office-js npm | CDN script tag | 官方宣布弃用 npm 包 | 不用 npm 包 |
| 位置参数 inverse 方法 | Record<string, unknown> 签名 | Phase 5 教训 | 硬约束，所有 15 个新 inverse 遵循 |
| integration.test mock adapter | 真实 ExcelAdapter/PptAdapter 实例 | Phase 9 范式确立 | mock 抓不到 Record 签名错配 |

---

## Sources

### Primary (HIGH confidence)
- Context7 `/officedev/office-js-docs-pr` — Excel range format/sort/autoFilter/table/freeze/chart API
- Context7 `/officedev/office-js-docs-pr` — PowerPoint shapes addGeometricShape/addTextBox/delete/background
- `src/adapters/ExcelAdapter.ts` — 现有 Excel.run 闭包范式、two-sync 规则、overwriteRange/deleteChartByName inverse 范式（代码审计）
- `src/adapters/PptAdapter.ts` — TEXT_SHAPE_TYPES 守门、setShapeProperty/restoreShapeProperty、deleteSlideByTitle 范式（代码审计）
- `src/agent/operationLog.ts` — DocumentAdapterForReplay 接口、executeReverse switch、noop_inverse case（代码审计）
- `.planning/phases/08-foundation-a-f/CONTRACT.md` — 18 工具能力合约表
- `src/agent/contract.test.ts` 第 41-59 行 — 工具名/reverse 名/undo 类型 CI 真相源

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` — Excel E1/E4/E5/E6 + PPT P1/P2/P4/P5 — 从代码审计 + 官方文档汇编
- `.planning/phases/09-word-d-b-word/09-RESEARCH.md` — Phase 9 Word undo 基础设施范式（可复用结构）
- OfficeDev/office-js issues #2775（addTextBox #2775 bug）— [CITED]
- learn.microsoft.com/office/dev/add-ins/excel/excel-add-ins-undo-capabilities — sort 清空撤销栈官方确认

### Tertiary (LOW confidence)
- A1-A6 见 Assumptions Log — 需真机 UAT 或 isSetSupported 运行时验证

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 所有 API 已在官方 docs 中验证
- Architecture: HIGH — 直接从现有 adapter/operationLog 代码审计
- Per-tool Office.js calls: HIGH (简单逆向) / MEDIUM (快照式) / ASSUMED (3 spike 工具)
- Pitfalls: HIGH — 直接引用 PITFALLS.md 高置信研究 + 代码审计
- Validation architecture: HIGH — 基于现有 Vitest + integration.test 基础设施

**Research date:** 2026-05-31
**Valid until:** 2026-07-31（Office.js CDN API 稳定；spike 工具运行时结论需 UAT 更新）
