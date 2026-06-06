# Phase 28: Excel 工具补全 - Research

**Researched:** 2026-06-06
**Domain:** Office.js ExcelApi（3 个新 Excel write 工具：merge_cells / remove_duplicates / create_pivot_table）
**Confidence:** HIGH（API 可用性全部经官方 Microsoft Learn 文档核实；undo 设计基于 codebase 实测 + API 语义分析）

---

<user_constraints>
## User Constraints（来自 28-CONTEXT.md）

### Locked Decisions（全部技术 default，无需用户拍板）

- **D-EX11 merge_cells（EXCEL-11）：** 单工具 + operation 枚举 `{ address, operation: 'merge'|'unmerge', across?: boolean }`；undo 快照式（值 2D + 地址）；解 merge 路径 undo = 重新 merge；resolveRange 路由。
- **D-EX12 remove_duplicates（EXCEL-12）：** 快照式 undo，复用 `readRangeValuesSnapshot` + `restoreRangeValuesSnapshot`；SNAPSHOT_LIMIT=10_000 超限 → noop+gate；参数 `{ address, columns?, includesHeader? }`；isSetSupported('ExcelApi','1.9') 门控。
- **D-EX13 create_pivot_table（EXCEL-13）：** 双层门控（静态验证 + 运行时 isSetSupported('ExcelApi','1.8') + try/catch）；可用 → undo = delete_pivot_table_by_name（简单逆向，镜像 delete_table_by_name）；不可用 → 诚实 noop+gate；字段配置深度 planner discretion（依 R1 结果）。
- **D-GATE 守门四步：** CONTRACT.md 3 行 / contract.test.ts 3 行 / operationLog.ts 扩展 / operationLog.integration.test.ts 守门用例。缺一 CI 挂。

### Claude's Discretion（planner/researcher 可定）

- 三工具最终 snake_case 名 + reverse 工具名（推荐沿用 deferred 命名 `merge_cells`/`remove_duplicates`/`create_pivot_table`）
- merge_cells 的 reverse 名（推荐 `restore_merge_state`，新增 `PostStateSnapshot.kind`；或评估复用 `restore_range_values_snapshot` + 额外 unmerge 步骤 — researcher 已分析，见 R3 章节）
- 新 `PostStateSnapshot.kind` 命名（推荐 `excel_merge`、`excel_pivot`）
- pivot 字段配置深度最稳 API 子集（依赖 R1 结果，researcher 已给出推荐）
- 三工具 humanLabel 中文文案
- wave 切分建议

### Deferred Ideas（本 phase 完全不做）

- Word / PPT 工具（Phase 27 / 29 各自负责）
- batch_write（Phase 11 已交付）、UI 打磨
- Excel 其余 deferred 候选（数据验证下拉/分类汇总/迷你图/命名区域/保护工作表/超链接/批注等）
- NFR-12 全里程碑 bundle 收口（Phase 29 末位）
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXCEL-11 | 用户能让 agent 合并/取消合并单元格，并可撤销 | `Range.merge(across?)` / `Range.unmerge()` ExcelApi 1.2，Office for Web 支持；undo 需快照式（merge 丢值） |
| EXCEL-12 | 用户能让 agent 删除区域内重复行，并可撤销 | `Range.removeDuplicates(columns, includesHeader)` ExcelApi 1.9，Office for Web 支持；复用 `restoreRangeValuesSnapshot` |
| EXCEL-13 | 用户能让 agent 创建数据透视表，并可撤销；plan-phase 必验 Web 可用性 | `Worksheet.pivotTables.add(name, source, destination)` ExcelApi 1.8，Office for Web **支持**（见 R1 verdict）；undo = delete |
</phase_requirements>

---

## Summary

Phase 28 在 Phase 10 既有 10 个 Excel write 工具基础上，新增 3 个高价值工具。核心研究发现：

**R1 EXCEL-13 透视表 API（ExcelApi 1.8）在 Office for Web 可用性 — VERDICT: 可用。** Microsoft Learn 官方平台可用性矩阵明确列出 ExcelApi 1.8「Office on the web: Supported」，`pivotTables.add` + 字段 hierarchy 配置 API（`rowHierarchies.add`/`dataHierarchies.add`/`columnHierarchies.add`）全部属于 ExcelApi 1.8，文档中有完整代码示例。OLAP 和 Power Pivot 不支持，但结构化数据透视表全链路（add + 配置字段 + delete）官方明确支持 Web。运行时双层门控（isSetSupported + try/catch）仍必须实现作为安全网。

**R2 EXCEL-12 removeDuplicates（ExcelApi 1.9）Web 可用性 — 可用。** 官方平台矩阵列出 ExcelApi 1.9「Office on the web: Supported」，`Range.removeDuplicates(columns, includesHeader)` 返回 `RemoveDuplicatesResult { removed, uniqueRemaining }` 字段经文档确认。ExcelAdapter.ts:1336 的 `replaceAll` 已有 isSetSupported('ExcelApi','1.9') 门控先例，`remove_duplicates` 直接镜像。

**R3 EXCEL-11 merge/unmerge 语义 + undo — 推荐新建 `restore_merge_state` reverse。** `Range.merge(across)` 属于 ExcelApi 1.2（Office for Web 稳定），across=true 逐行横向合并，across=false/缺省整块合一；合并后非左上单元格值被 Excel 永久清空（语义经官方文档验证）。因此 merge 路径的 undo 需要快照 2D values + 地址 + 原 across 参数，inverse 先 unmerge 再 `range.values = snapshot`。unmerge 路径的 undo 需重新 merge（记录 address + across）。两路统一用新 reverse 工具 `restore_merge_state`（新 PostStateSnapshot.kind `excel_merge`）更清晰，不强塞进 `restore_range_values_snapshot`（避免 executeReverse switch 产生混乱 + 两路语义不同）。

**R4 Bundle 基线 82.48 KB gzip（100 KB gate，余量 17.52 KB）。** 三工具代码预估增量约 2-4 KB gzip（适配器新增方法 + ToolDef），pivot 工具最重但字段配置 API 调用简单；不需懒加载。

**R5 CONTRACT 接线：** 现有 CONTRACT 共 29 行（Phase 9×5 + Phase 10×15 + Phase 11×1 + Phase 23×1 + Phase 27×4 实际入 contract.test.ts），contract.test.ts:145 守门 `>=24` 加 3 行后 32 行仍通过。D-17 `fs.readFileSync` 硬卡：3 个新 toolName 逐字出现在 operationLog.integration.test.ts 才能过 CI。

**Primary recommendation:** 按 Wave 0（合约守门桩）→ Wave 1（merge_cells + remove_duplicates）→ Wave 2（create_pivot_table）顺序实现；EXCEL-13 Web 已证可用，实现完整字段配置子集（rowFields/dataFields/columnFields）。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Range.merge/unmerge 写入 | API/Host（Excel.run 闭包内） | — | A-06：Office.js proxy 不出闭包 |
| Range.removeDuplicates 写入 | API/Host（Excel.run 闭包内） | — | 同上 |
| Worksheet.pivotTables.add + 字段配置 | API/Host（Excel.run 闭包内） | — | 同上 |
| 写前值快照（merge/remove_duplicates） | adapter（ExcelAdapter.ts）| operationLog.ts | 快照式 undo，adapter 负责 Excel.run 实现 |
| inverse 方法（restore_merge_state/restore_range_values_snapshot/delete_pivot_table_by_name） | adapter（ExcelAdapter.ts） | operationLog.ts | adapter 实现；operationLog executeReverse 调度 |
| ToolDef / humanLabel / postState | tools/write/excel.ts | tools/index.ts 注册 | Excel 工具层，snake_case，入 excelWriteTools 数组 |
| 运行时门控（isSetSupported） | adapter 方法开头 | — | 不支持 → throw HostApiError，executeReverse 降级 skipped_error |
| 合约守门（CONTRACT.md / contract.test.ts） | CI（Vitest）| — | D-17 硬卡，防「合约 true 但无守门用例」 |

---

## Standard Stack

### Core（沿用 Phase 10 已落地范式）

| Library / API | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| `Office.js` CDN | ExcelApi 1.8（pivot）/ 1.9（removeDuplicates）/ 1.2（merge） | Excel 宿主 API | 唯一接口，类型由 `@types/office-js` 提供 |
| `ExcelAdapter.ts` | 当前 codebase | 三工具 adapter 方法 + inverse | 既有模式，所有 Excel write 工具都在这里 |
| `operationLog.ts` | 当前 codebase | executeReverse switch 扩展 + DocumentAdapterForReplay 接口 | 反操作调度层 |
| `tools/write/excel.ts` | 当前 codebase | ToolDef 定义（参数 schema + execute + reverse descriptor） | Phase 10 既有 Excel 工具所在文件 |
| `tools/index.ts` | 当前 codebase | `buildToolsForHost('excel')` excelWriteTools 数组注册 | 工具注册点 |

### 三工具 API 要求集确认

| 工具 | Office.js API | 要求集 | Office for Web | 信心 |
|------|--------------|--------|----------------|------|
| merge_cells（merge 路径） | `Range.merge(across?)` | ExcelApi 1.2 | 支持 | HIGH [CITED: Microsoft Learn ExcelApi requirement sets] |
| merge_cells（unmerge 路径） | `Range.unmerge()` | ExcelApi 1.2 | 支持 | HIGH [CITED: 同上] |
| remove_duplicates | `Range.removeDuplicates(columns, includesHeader)` | ExcelApi 1.9 | 支持 | HIGH [CITED: Microsoft Learn ExcelApi 1.9 requirement set] |
| create_pivot_table（建表） | `Worksheet.pivotTables.add(name, source, destination)` | ExcelApi 1.8 | 支持 | HIGH [CITED: Microsoft Learn ExcelApi requirement sets 平台矩阵] |
| create_pivot_table（字段配置） | `rowHierarchies.add` / `dataHierarchies.add` / `columnHierarchies.add` | ExcelApi 1.8 | 支持 | HIGH [CITED: Microsoft Learn - Work with PivotTables] |
| create_pivot_table（删表 undo） | `pivotTables.getItem(name).delete()` | ExcelApi 1.8 | 支持 | HIGH [CITED: 同上] |

**安装：** 无需新安装依赖（全部用 Office.js CDN runtime + 既有 `@types/office-js`）。

---

## R1 — EXCEL-13 透视表 API 在 Office for Web 可用性 【CRITICAL verdict】

### Verdict: **Web 可用** ✓

**证据链：**

1. **Microsoft Learn 官方平台矩阵**（更新 2025-11-12）明确列出：
   - ExcelApi 1.8 → Office on the web: **Supported**
   - ExcelApi 1.8 → Office on Windows Microsoft 365: Version 1808 (Build 10730.20102)
   - [CITED: https://learn.microsoft.com/en-us/javascript/api/requirement-sets/excel/excel-api-requirement-sets]

2. **Microsoft Learn PivotTable 文档**（更新 2026-06-05，即本次研究当天）中，`pivotTables.add` + `rowHierarchies.add` + `dataHierarchies.add` + `columnHierarchies.add` + `pivotTables.getItem(name).delete()` 全部标注 `[API set: ExcelApi 1.8]`，文档包含可在 Office for Web 运行的完整代码示例。
   - [CITED: https://learn.microsoft.com/en-us/office/dev/add-ins/excel/excel-add-ins-pivottables]

3. **限制（已知）：** OLAP PivotTables 和 Power Pivot 不支持（官方 Note 说明）。结构化数据（普通数据区域/Table）透视表全链路可用。

### 两分支规划建议（依 D-13a/D-13b）

**分支 A — 实现（推荐，因 R1 verdict = 可用）：**
- 实现完整 `create_pivot_table`，支持参数 `{ sourceRange, destination, name?, rowFields?, columnFields?, dataFields? }`
- 按字段名用 `pivotTable.hierarchies.getItem(fieldName)` 定位各 hierarchy，再 add 到对应集合
- undo = `delete_pivot_table_by_name`（简单逆向，镜像 `delete_table_by_name`）
- 运行时门控仍必须：`isSetSupported('ExcelApi','1.8')` + try/catch → 降级 noop+gate（安全网）

**分支 B — 降级（若真机 UAT 证伪 R1）：**
- `noop+gate`：工具执行但 reverse = `noop_inverse`，明确错误信息「当前 Office for Web 不支持创建数据透视表」
- 不静默假成功（ROADMAP SC#3 诚实降级 PASS 判据）

### PITFALLS E6 确认：pivot undo 设计成立

透视表字段重排/样式无法逐项 undo（PITFALLS E6 已知），但「删除整张透视表」完全可逆（`delete()` 是幂等操作）。工具级 undo = 删表（够用，D-13b 设计成立）。

**注意：** 透视表的 `name` 参数会成为 reverse.args.pivotTableName，实现时需在 `pivotTables.add` 返回后 load `['name']` + ctx.sync() 读取实际名称（Excel 可能对重名做重命名）。镜像 `create_table` → `delete_table_by_name` 的现有范式即可（ExcelAdapter.ts:1223 附近）。

---

## R2 — EXCEL-12 removeDuplicates（ExcelApi 1.9）Web 可用性

### Verdict: **Web 可用** ✓

**证据：**
- Microsoft Learn 平台矩阵：ExcelApi 1.9 → Office on the web: **Supported**
- [CITED: https://learn.microsoft.com/en-us/javascript/api/requirement-sets/excel/excel-api-requirement-sets]
- `Range.removeDuplicates(columns: number[], includesHeader: boolean)` 官方文档确认参数形状和返回值
- [CITED: https://learn.microsoft.com/en-us/office/dev/add-ins/excel/excel-add-ins-ranges-remove-duplicates]

**返回值字段确认：**

```typescript
// RemoveDuplicatesResult — 两字段均已确认
interface RemoveDuplicatesResult {
  removed: number;         // 被删除的重复行数
  uniqueRemaining: number; // 删除后剩余的唯一行数
}
// [CITED: Microsoft Learn ExcelApi 1.9 requirement set]
```

**门控先例（ExcelAdapter.ts:1336）：**

```typescript
// 现有 replaceAll 门控模式（直接复用）：
if (!Office.context.requirements.isSetSupported('ExcelApi', '1.9')) {
  // 降级：诚实拒绝（明确错误，不静默假成功）
  throw new HostApiError('当前 Excel 版本不支持删除重复行（需要 ExcelApi 1.9）', undefined);
}
// 执行：Range.removeDuplicates(columns, includesHeader)
```

**快照复用确认：**
- `readRangeValuesSnapshot` (ExcelAdapter.ts:1235) + `restoreRangeValuesSnapshot` (ExcelAdapter.ts:1265) 已实现，签名 `(args: Record<string, unknown>)` 合规
- `restore_range_values_snapshot` case 已在 operationLog.ts:431 存在，无需新增 case
- `DocumentAdapterForReplay.restoreRangeValuesSnapshot` 接口声明已在 operationLog.ts:144 存在

---

## R3 — EXCEL-11 merge/unmerge 语义 + undo 忠实度

### API 语义确认

**`Range.merge(across?: boolean)`** [ExcelApi 1.2]
- `across = false`（缺省）：将整个 Range 合并为一个单元格（整块合一）
- `across = true`：逐行横向合并（每行各自合并为一个单元格，保持多行）
- **合并后非左上单元格的值被永久清空**（Excel 原生语义，API 层面无法绕过）
- [CITED: https://learn.microsoft.com/en-us/javascript/api/excel/excel.range?view=excel-js-preview]

**`Range.unmerge()`** [ExcelApi 1.2]
- 将合并区域拆回独立单元格
- 拆分后的非左上单元格值为空（unmerge 本身不还原值）
- [CITED: 同上]

### undo 交互分析（merge 路径）

merge 前：`A1='标题', B1='X', C1='Y'` → merge 后：`A1:C1 合并='标题', B1/C1 空`

忠实 undo 需要：
1. 执行前快照 `{ address: 'A1:C1', snapshot: [['标题','X','Y']], across: false }`
2. undo 时：`range.unmerge()` → `range.values = [['标题','X','Y']]`（覆写还原被清空的值）

**验证：** unmerge 后写 `range.values` 能覆写全部单元格（经 ExcelAdapter.ts sort_range + restore_range_values_snapshot 已证实的范式：range.values = 2D array 可按格覆写）。[VERIFIED: ExcelAdapter.ts:1265 restoreRangeValuesSnapshot 既有实现]

### undo 交互分析（unmerge 路径）

unmerge 前：`A1:C3 合并='内容'` → unmerge 后：9 个独立空单元格（除左上）

undo 需要：
1. 执行前快照 `{ address: 'A1:C3', across: false }` （注意：across 参数要还原正确合并形态）
2. undo 时：`range.merge(across)` 重新合并（unmerge 无值丢失，undo 只需重新 merge，不需写 values）

### 推荐 reverse 设计：新建 `restore_merge_state`（不复用 `restore_range_values_snapshot`）

**分析：**
- merge 路径 undo = unmerge + values 覆写（两步操作，`restore_range_values_snapshot` 只覆写 values，不 unmerge）
- unmerge 路径 undo = 重新 merge（完全不涉及 values）
- 两路语义不同，强行复用 `restore_range_values_snapshot` 会让 executeReverse 的 case 字面量不清晰

**推荐设计：**

```typescript
// reverse tool 名：restore_merge_state
// args 形状（Record<string, unknown>，D-18 签名约束）：
// {
//   address: string;        // range 地址（server 端规范化）
//   operation: 'merge' | 'unmerge'; // 执行时的 operation
//   across: boolean;        // merge(across) 参数（unmerge undo 重新 merge 时用）
//   snapshot?: unknown[][]  // merge 路径执行前 2D 值快照（unmerge 路径无需）
// }
//
// executeReverse logic：
// case 'restore_merge_state':
//   if operation === 'merge':
//     range.unmerge(); await ctx.sync(); range.values = snapshot; await ctx.sync();
//   if operation === 'unmerge':
//     range.merge(across); await ctx.sync();
```

**PostStateSnapshot.kind：** 新增 `'excel_merge'`（保守路径：readTargetState default → undefined，不加比对规则）

**PITFALLS E5 — 合并单元格 + sort GeneralException：**
- 合并区含合并单元格时调用 `sort.apply` 会抛 `GeneralException`（已知 Excel 限制）
- 处理方式：写进 `merge_cells` 工具 description 提示 AI，不做防御性拦截
- 例：description 末尾加「注意：已合并的区域无法排序，排序前请先取消合并」

### 快照上限 + 超限处理

merge_cells 涉及的合并区通常较小（如标题行 A1:D1）。即便大区域（如 A1:Z1000 = 26000 单元格）超过 SNAPSHOT_LIMIT=10_000 也走 noop+gate（merge 操作仍执行，但标注不可自动撤销）。mirror `sortRange` 超限逻辑（ExcelAdapter.ts:1306-1313）。

---

## R4 — Bundle 影响评估

### 实测基线（2026-06-06，Phase 27 完成后）

```
main-*.js gzip: 82.48 KB
Size limit:     100 KB (NFR-12，2026-06-05 Phase 26 用户上调，REQUIREMENTS.md 已更新)
余量:           17.52 KB gzip
```

**⚠️ 重要澄清：** 28-CONTEXT.md `HARD CONSTRAINTS` 中写 `≤82KB` 是陈旧值（Phase 26 拍板前的旧 gate）。**以 100 KB 为准**（REQUIREMENTS.md NFR-12 2026-06-05 已更新；size-limit 配置当前 gate = 100 KB）。余量从 ~0.7 KB 扩大至 17.52 KB，充裕。

**[VERIFIED: npm run size 实测输出 2026-06-06]**

### 三工具增量估算

| 工具 | adapter 方法（新增/复用） | ToolDef 代码 | executeReverse case | 预估增量（gzip） |
|------|--------------------------|-------------|---------------------|-----------------|
| merge_cells | 新增 `mergeCells` + `restoreMergeState`（~60 行） | ~30 行 | 1 个新 case | ~0.8 KB |
| remove_duplicates | 新增 `removeDuplicatesRange`（~50 行，快照复用现有方法） | ~25 行 | 无（复用现有 `restore_range_values_snapshot` case） | ~0.6 KB |
| create_pivot_table | 新增 `createPivotTable` + `deletePivotTableByName`（~80 行） | ~40 行 | 1 个新 case | ~1.2 KB |
| **合计** | — | — | — | **~2.6 KB**（远低于 17.52 KB 余量） |

**结论：不需懒加载。** ExcelAdapter.ts 本就按 host 运行时按需加载（Vite code split，dist/assets/ExcelAdapter-*.js 独立 chunk），ToolDef 虽在主路径（tools/index.ts），增量 2.6 KB 远在预算内。

---

## R5 — CONTRACT.md / contract.test.ts 接线细节

### 现有合约状态

- **CONTRACT.md** 位置：`.planning/phases/08-foundation-a-f/CONTRACT.md`
- **现有行数**（contract.test.ts CONTRACT 数组）：Phase 9×5 + Phase 10×15 + Phase 11×1 + Phase 23×1 + Phase 27×4 = **29 行**（contract.test.ts:149 守门 `>=24`，加 3 行后 32 行，仍通过）[VERIFIED: contract.test.ts 逐行计数]

### 三工具推荐合约参数

| toolName | host | undoType | reverseTool | phase | integrationTest |
|----------|------|----------|-------------|-------|-----------------|
| `merge_cells` | `excel` | `快照式` | `restore_merge_state` | `28` | `false` → 实现后改 `true` |
| `remove_duplicates` | `excel` | `快照式` | `restore_range_values_snapshot` | `28` | `false` → 实现后改 `true` |
| `create_pivot_table` | `excel` | `简单逆向`（可用时）/ `noop+gate`（降级） | `delete_pivot_table_by_name`（可用时）/ `noop_inverse`（降级） | `28` | `false` → 实现后改 `true` |

**注意：** `create_pivot_table` 的 undoType/reverseTool 在运行时根据 isSetSupported 判断，CONTRACT 行应填写「正向实现」路径（`简单逆向` + `delete_pivot_table_by_name`），因为 R1 verdict = 可用。

### contract.test.ts 接线模板（三行，mirror Phase 27 行 64-68）

```typescript
// ─── Phase 28 Excel 工具补全 ───
{ toolName: 'merge_cells', host: 'excel', undoType: '快照式', reverseTool: 'restore_merge_state', phase: 28, integrationTest: false },
{ toolName: 'remove_duplicates', host: 'excel', undoType: '快照式', reverseTool: 'restore_range_values_snapshot', phase: 28, integrationTest: false },
{ toolName: 'create_pivot_table', host: 'excel', undoType: '简单逆向', reverseTool: 'delete_pivot_table_by_name', phase: 28, integrationTest: false },
```

**PhaseNum type 需扩展：** contract.test.ts:18 `type PhaseNum = 9 | 10 | 11 | 23 | 27`，需加 `| 28`。

### operationLog.ts 扩展清单

**1. PostStateSnapshot.kind 新增（operationLog.ts:38-50 union）：**

```typescript
// Phase 28 新增：3 个 Excel 工具补全 kind
| 'excel_merge'   // merge_cells 快照（readTargetState 走保守 default → undefined）
| 'excel_pivot'   // create_pivot_table 简单逆向（readTargetState 走保守 default → undefined）
// remove_duplicates 复用现有 'excel_snapshot' kind（restore_range_values_snapshot 同 sort_range）
```

**2. DocumentAdapterForReplay 接口新增（operationLog.ts:104+ 区域）：**

```typescript
// Phase 28 Excel 工具补全 inverse 方法
/** Excel inverse：还原合并状态（merge_cells → restore_merge_state）*/
restoreMergeState?: (args: Record<string, unknown>) => Promise<void>;
/** Excel inverse：按名称删除透视表（create_pivot_table → delete_pivot_table_by_name）*/
deletePivotTableByName?: (args: Record<string, unknown>) => Promise<void>;
// remove_duplicates 复用现有 restoreRangeValuesSnapshot（无需新增）
```

**3. executeReverse switch 新增 case（operationLog.ts:390+ 区域，mirror Phase 10 范式）：**

```typescript
// Phase 28 Wave 0：2 个新 case（remove_duplicates 复用 restore_range_values_snapshot，无新 case）
case 'restore_merge_state':
  if (!adapter.restoreMergeState) throw new Error(`adapter 未实现 restoreMergeState（tool=${reverse.tool}）`);
  await adapter.restoreMergeState(reverse.args);
  break;
case 'delete_pivot_table_by_name':
  if (!adapter.deletePivotTableByName) throw new Error(`adapter 未实现 deletePivotTableByName（tool=${reverse.tool}）`);
  await adapter.deletePivotTableByName(reverse.args);
  break;
```

### D-17 硬卡（fs.readFileSync 校验）

以下 3 个字符串字面量**必须**逐字出现在 `operationLog.integration.test.ts` 文件中（contract.test.ts:140 扫描）：
- `'merge_cells'`
- `'remove_duplicates'`
- `'create_pivot_table'`

Wave 0 守门任务：先让守门用例以 `skipped_error`（adapter 未实现）通过，toolName 字符串出现即满足 D-17。

---

## 额外确认 — casing / adapter 签名 / batch

### tools/index.ts casing 归一化机制

**确认：** Excel 工具**没有** `EXCEL_TOOLS` Set（仅 PPT 工具有 `PPT_TOOLS` Set 做 camelCase→snake 归一化，tools/index.ts:34）。[VERIFIED: tools/index.ts:1-52]

- Word 工具（Phase 27 确认）：不建 `WORD_TOOLS` Set，camelCase，不归一化
- Excel 工具（本次确认）：不建 `EXCEL_TOOLS` Set
- **因此：** Excel write 工具参数键应直接用 snake_case（与 LLM dispatch 参数一致），无需归一化转换

**建议：** 三工具参数全部用 snake_case（`source_range`, `destination`, `row_fields`, `data_fields` 等），与 PPT 工具形成 casing 同构（PPT 工具参数经 PPT_TOOLS 归一化，Excel 无 Set 但约定 snake_case）。

### adapter 签名硬约束（memory project_adapter_inverse_signature）

所有 inverse 方法签名必须：`(args: Record<string, unknown>)`（非位置参）。[VERIFIED: ExcelAdapter.ts:1265 restoreRangeValuesSnapshot、:1482 restoreWorksheetSnapshot 等现有方法全部合规]

新增 3 个 inverse 方法需遵循：
- `restoreMergeState(args: Record<string, unknown>): Promise<void>`
- `deletePivotTableByName(args: Record<string, unknown>): Promise<void>`
- `restoreRangeValuesSnapshot`（已有，无需新增）

### resolveRange helper 路由（memory project_excel_adapter_gotchas）

`merge_cells` / `remove_duplicates` / `create_pivot_table` 的 address 参数（如 `A1:D50`、`Sheet1!A1:D50`）**必须经 `resolveRange(ctx, address)` 路由**（ExcelAdapter.ts:57），不能直接 `ctx.workbook.worksheets.getActiveWorksheet().getRange(address)` —— 后者拒绝「表名!A1」格式。[VERIFIED: ExcelAdapter.ts:57 resolveRange helper 文档注释]

### batch 纳入建议

三工具是否纳入 batch：**非硬性需求，planner 酌情决定**。Phase 11 batch_write 支持所有 write 工具通过 `executeBatch` 路由（按 `op.tool` 分派），`merge_cells`/`remove_duplicates`/`create_pivot_table` 注册进 `excelWriteTools` 后即可在 batch 中使用，**无需额外适配**。

---

## Architecture Patterns

### System Architecture Diagram

```
LLM tool_call
     │
     ▼
dispatchTool (tools/index.ts)
     │ snake_case 参数（Excel 无 TOOLS Set，直接透传）
     ▼
ToolDef.execute (tools/write/excel.ts)
     │ 调 adapter 方法（通过 ctx.adapter as ExcelAdapter）
     ├─── merge_cells → adapter.mergeCells(address, operation, across?)
     │         │ 先 readRangeValuesSnapshot → 执行 merge/unmerge → 返回快照
     ├─── remove_duplicates → adapter.removeDuplicatesRange(address, columns?, includesHeader?)
     │         │ isSetSupported('ExcelApi','1.9') 门控 → 先快照 → 执行 → 返回 RemoveDuplicatesResult
     └─── create_pivot_table → adapter.createPivotTable(sourceRange, destination, name?, rowFields?, ...)
               │ isSetSupported('ExcelApi','1.8') 门控 + try/catch → 执行 + 配置字段 → 返回 pivotName
     │
     ▼
ToolResult { ok, data, reverse, postState }
     │
     ▼
operationLog.appendOperation
     │
     ▼  (undo 时)
executeReverse(reverse, adapter)
     ├─── 'restore_merge_state' → adapter.restoreMergeState(args)
     │         │ merge 路径：unmerge + range.values = snapshot
     │         │ unmerge 路径：range.merge(across)
     ├─── 'restore_range_values_snapshot' → adapter.restoreRangeValuesSnapshot(args)（复用）
     │         │ range.values = snapshot（还原被删重复行）
     └─── 'delete_pivot_table_by_name' → adapter.deletePivotTableByName(args)
               │ worksheet.pivotTables.getItem(name).delete()
```

### Recommended Project Structure（仅新增文件/改动点）

```
src/adapters/ExcelAdapter.ts    ← 新增 mergeCells / restoreMergeState
                                   新增 removeDuplicatesRange（内部调 readRangeValuesSnapshot）
                                   新增 createPivotTable / deletePivotTableByName
src/agent/operationLog.ts       ← PostStateSnapshot.kind 加 'excel_merge'/'excel_pivot'
                                   DocumentAdapterForReplay 加 restoreMergeState / deletePivotTableByName
                                   executeReverse switch 加 2 个新 case
src/agent/contract.test.ts      ← CONTRACT 数组加 3 行 + PhaseNum type 加 28
src/agent/tools/write/excel.ts  ← 新增 mergeCellsTool / removeDuplicatesTool / createPivotTableTool ToolDef
src/agent/tools/index.ts        ← excelWriteTools 数组加 3 个新 ToolDef
src/agent/operationLog.integration.test.ts ← 新增 3 个守门用例（含 3 个 toolName 字面量）
.planning/phases/08-foundation-a-f/CONTRACT.md ← 新增 Phase 28 区块（3 行）
```

### Pattern 1: 快照式 + resolveRange（EXCEL-11/12 共同模式）

```typescript
// Source: ExcelAdapter.ts:1280-1328 sortRange / excelFindAndReplace 既有实现
async removeDuplicatesRange(
  address: string,
  columns?: number[],
  includesHeader?: boolean,
): Promise<{ snapshot: unknown[][] | null; snapshotAddress: string; tooLarge: boolean; removed: number; uniqueRemaining: number }> {
  // 1. 门控
  if (!Office.context.requirements.isSetSupported('ExcelApi', '1.9')) {
    throw new HostApiError('当前 Excel 版本不支持删除重复行（需要 ExcelApi 1.9）', undefined);
  }
  // 2. 先快照（mirror sortRange 超限逻辑）
  let snapshot: unknown[][] | null = null;
  let snapshotAddress = address;
  let tooLarge = false;
  try {
    const result = await this.readRangeValuesSnapshot(address);
    snapshot = result.snapshot;
    snapshotAddress = result.address;
  } catch (err) {
    if ((err as Error & { isTooLarge?: boolean }).isTooLarge) tooLarge = true;
    else tooLarge = true;
  }
  // 3. 执行 removeDuplicates
  return await Excel.run(async (ctx) => {
    const range = resolveRange(ctx, address);
    const result = range.removeDuplicates(columns ?? [], includesHeader ?? true);
    result.load(['removed', 'uniqueRemaining']);
    await ctx.sync();
    return { snapshot, snapshotAddress, tooLarge, removed: result.removed as number, uniqueRemaining: result.uniqueRemaining as number };
  });
}
```

### Pattern 2: 简单逆向 + 字段配置（EXCEL-13）

```typescript
// Source: Microsoft Learn - Work with PivotTables using the Excel JavaScript API
// (https://learn.microsoft.com/en-us/office/dev/add-ins/excel/excel-add-ins-pivottables)
async createPivotTable(opts: {
  sourceRange: string;
  destination: string;
  name?: string;
  rowFields?: string[];
  dataFields?: string[];
  columnFields?: string[];
}): Promise<{ pivotTableName: string }> {
  if (!Office.context.requirements.isSetSupported('ExcelApi', '1.8')) {
    throw new HostApiError('当前 Excel 版本不支持创建数据透视表（需要 ExcelApi 1.8）', undefined);
  }
  try {
    return await Excel.run(async (ctx) => {
      const ws = ctx.workbook.worksheets.getActiveWorksheet();
      const pivotTable = ws.pivotTables.add(opts.name ?? 'Aster透视表', opts.sourceRange, opts.destination);
      pivotTable.load(['name']);
      await ctx.sync(); // sync 1: 建表 + 读 name
      const pivotTableName = pivotTable.name as string;
      // 字段配置（每个字段先 getItem 再 add 到对应 hierarchy 集合）
      if (opts.rowFields?.length) {
        for (const f of opts.rowFields) {
          pivotTable.rowHierarchies.add(pivotTable.hierarchies.getItem(f));
        }
      }
      if (opts.dataFields?.length) {
        for (const f of opts.dataFields) {
          pivotTable.dataHierarchies.add(pivotTable.hierarchies.getItem(f));
        }
      }
      if (opts.columnFields?.length) {
        for (const f of opts.columnFields) {
          pivotTable.columnHierarchies.add(pivotTable.hierarchies.getItem(f));
        }
      }
      await ctx.sync(); // sync 2: 提交字段配置
      return { pivotTableName };
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('Excel createPivotTable 失败', err);
  }
}
```

### Anti-Patterns to Avoid

- **直接 getRange 不经 resolveRange：** `worksheet.getRange('Sheet1!A1:D50')` 在 Office for Web 抛 InvalidArgument。
- **pivot 字段用 index 而非 name：** `pivotTable.hierarchies.getItemAt(0)` 顺序不稳定，应用字段列名名称 `getItem(fieldName)`。
- **merge 前不快照就执行：** 合并后非左上值永久清空，undo 无从还原。
- **inverse 方法用位置参：** `restoreMergeState(address: string, snapshot: unknown[][])` 触发 Phase 5 翻车点，必须用 `(args: Record<string, unknown>)`。
- **contract.test.ts integrationTest 改 true 但没加守门用例：** D-17 fs.readFileSync 硬卡 CI 挂。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 透视表字段层级关系 | 自己实现 hierarchy tree | `pivotTable.hierarchies.getItem(name)` + `rowHierarchies.add` | API 已封装 hierarchy 移动语义（添加到新 category 自动从旧 category 移除） |
| 重复行检测算法 | 自己写比较逻辑 | `Range.removeDuplicates(columns, includesHeader)` | Office.js 内置实现更高效且与 Excel 语义一致 |
| 合并单元格状态读取 | 自己遍历 Range 判断 | `Range.getMergedAreasOrNullObject()` | API 提供现成方法（注意：返回 top-left cell 所在合并区） |
| 快照存储 | 自建 IndexedDB 缓存 | `reverse.args` 直接序列化到 OperationLogEntry | in-memory 已够用（PITFALLS A-11 硬约束） |

---

## Common Pitfalls

### Pitfall 1: merge 后 values 永久丢失（CRITICAL for undo）
**What goes wrong:** 执行 `Range.merge()` 后，非左上单元格值在 Excel 内核层被清空。即使不调用 unmerge，再次 load values 也得不到原值。
**Why it happens:** Excel 合并语义 = 仅保留左上值，其余清空（UI 行为和 API 行为一致）。
**How to avoid:** **必须在 merge 前 readRangeValuesSnapshot**，将完整 2D values 存入 reverse.args.snapshot。
**Warning signs:** undo 后 B1/C1 等非左上单元格显示空值。

### Pitfall 2: isSetSupported 在测试环境缺失
**What goes wrong:** 集成测试的 Excel global mock 通常不包含 `Office.context.requirements.isSetSupported`，导致 removeDuplicates / createPivotTable 门控调用抛 TypeError。
**Why it happens:** mockExcel 工厂只 mock `Excel.run`，未设置 `Office` 全局对象。
**How to avoid:** 参照 Phase 27 的 `mockOfficeSupportsAll()` 工厂（operationLog.integration.test.ts:364），在需要门控的测试用例开头调用，并在 afterEach 清理。

### Pitfall 3: pivotTable name 不稳定（重复 add 同名透视表）
**What goes wrong:** Excel 对同名透视表可能自动改名（如 `Aster透视表` → `Aster透视表1`），导致 reverse.args.pivotTableName 与实际名称不符，delete undo 失败。
**Why it happens:** `pivotTables.add` 的 name 参数是期望名，实际名由 Excel 决定。
**How to avoid:** add 后 `pivotTable.load(['name'])` + `await ctx.sync()`，用 server 端规范化的 `pivotTable.name` 作为 reverse.args.pivotTableName（同 create_table → delete_table_by_name 范式）。

### Pitfall 4: removeDuplicates 返回值 load 顺序
**What goes wrong:** `range.removeDuplicates(...)` 返回的 `RemoveDuplicatesResult` 是 proxy 对象，需要 `result.load(['removed','uniqueRemaining'])` + `await ctx.sync()` 才能读取字段值，直接访问得到 undefined。
**Why it happens:** Office.js lazy evaluation（所有 proxy 属性都需 load + sync）。
**How to avoid:** 模仿 ExcelAdapter.ts:1398-1401 `replaceResult.load('count'); await ctx.sync(); count = replaceResult.count` 范式。

### Pitfall 5: 合并单元格区域 + sort GeneralException（PITFALLS E5）
**What goes wrong:** 对含合并单元格的区域调用 `sort.apply` 抛 `GeneralException`。
**Why it happens:** Excel 内核限制：合并区域不支持排序。
**How to avoid:** 在 `merge_cells` 工具 description 中提示 AI「已合并的区域无法排序，排序前请先取消合并」。不做防御性拦截（拦截会掩盖用户错误，不符合「诚实」原则）。

### Pitfall 6: pivot 字段名大小写敏感
**What goes wrong:** `pivotTable.hierarchies.getItem('Farm')` 大小写必须与数据列头完全匹配，不匹配抛 InvalidArgument。
**Why it happens:** Excel PivotTable hierarchy 名称精确匹配。
**How to avoid:** 在 create_pivot_table 工具 description 中提示 AI「rowFields/dataFields 中的字段名必须与源数据列头完全匹配（区分大小写）」。

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 用 VBA/COM 建 pivot | Office.js ExcelApi 1.8 JS API | 2018（ExcelApi 1.8 GA） | Web 支持，无需 VBA 运行时 |
| `@microsoft/office-js` npm 包 | CDN script tag | 已弃用，官方明确 deprecated | npm 包无平台感知，CDN 包有 |
| ExcelApi 1.9 `replaceAll` 前只能遍历 | ExcelApi 1.9 `Range.removeDuplicates` 内置 | 2019（ExcelApi 1.9 GA） | 无需手写比较算法 |

**已废弃：**
- `@microsoft/office-js` npm 包：官方 deprecated，只用 CDN

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pivotTable.rowHierarchies.add` / `dataHierarchies.add` 传 hierarchy 对象（非字符串）在 Web 可用 | R1, Code Examples | 若 Web 仅支持空 pivot 框（add 通但字段 add 报错），需收窄到「建空框 + 提示手动配置」 |
| A2 | merge 后 `range.values = snapshot` 可完整还原非左上单元格值（不受 merge 状态干扰） | R3 | 若 unmerge 后 values 写回被 Excel 拒绝，需找替代 API（如 cell-by-cell 写入） |
| A3 | `removeDuplicates` 的 `removed`/`uniqueRemaining` 字段在 ExcelApi 1.9 Web 上可正确 load | R2 | 若 load 不到字段，humanLabel 无法显示正确数字（需降级为固定文本） |

**高置信度结论（不在假设 log 内）：** ExcelApi 1.2/1.8/1.9 在 Office for Web 的支持状态，已由官方文档平台矩阵明确确认，非假设。

---

## Open Questions

1. **pivot 字段配置 — hierarchies 在 add 后立即可用吗？**
   - What we know: `pivotTables.add(name, source, destination)` 完成后，hierarchy 集合应该反映 source 数据列头
   - What's unclear: 是否需要额外 sync 才能调用 `hierarchies.getItem(fieldName)`，还是一个 Excel.run 闭包内 add + 字段配置可以连续完成？
   - Recommendation: 实现时在 add + sync1 后立即配置字段，若报错再加 extra sync + load hierarchies

2. **merge_cells 的 across 参数在 undo 时是否足够还原合并形态？**
   - What we know: across=true 逐行合并，across=false 整块合并
   - What's unclear: 若原区域是混合合并（部分行合并/部分不合并），单一 across 参数无法还原
   - Recommendation: Phase 28 MVP 仅支持同构合并（单一 operation=merge + across 参数），description 注明「只支持整块或逐行横向合并，不支持混合合并状态」

---

## Environment Availability

Step 2.6: SKIPPED（Phase 28 是纯 Office.js API + 代码变更，无外部 CLI/服务/数据库依赖，所有 API 通过 Office.js CDN 运行时提供）

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest（项目已配置，见 vitest.config.ts） |
| Config file | `vitest.config.ts`（已存在） |
| Quick run command | `npm test -- --reporter=verbose src/agent/contract.test.ts src/agent/operationLog.integration.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXCEL-11 | merge_cells 正向 + undo 忠实还原值 | integration | `npm test -- operationLog.integration.test.ts` | ❌ Wave 0 新建 |
| EXCEL-11 | merge_cells noop+gate 超限路径 | integration | 同上 | ❌ Wave 0 新建 |
| EXCEL-12 | remove_duplicates 正向 + undo 还原 | integration | 同上 | ❌ Wave 0 新建 |
| EXCEL-12 | remove_duplicates 超限 noop+gate | integration | 同上 | ❌ Wave 0 新建 |
| EXCEL-13 | create_pivot_table 正向 + undo delete | integration | 同上 | ❌ Wave 0 新建 |
| EXCEL-13 | create_pivot_table 降级路径（isSetSupported false）| integration | 同上 | ❌ Wave 0 新建 |
| D-GATE | CONTRACT 数组长度 >= 24（+3 后 32） | unit | `npm test -- contract.test.ts` | ✅ 已存在，加 3 行后自动通过 |
| D-17 | 3 个 toolName 出现在 integration.test.ts | unit | 同上 | ❌ Wave 0 新建守门用例后满足 |

### Sampling Rate

- **Per task commit:** `npm test -- src/agent/contract.test.ts src/agent/operationLog.integration.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/agent/operationLog.integration.test.ts` — 追加 6 个守门用例（每工具 2 个：正向 `rolled_back` + 降级/超限 `skipped_error`）
- [ ] `src/agent/contract.test.ts` — CONTRACT 数组加 3 行 + PhaseNum type 加 `| 28`
- [ ] `operationLog.ts` — PostStateSnapshot.kind / DocumentAdapterForReplay / executeReverse 扩展（Wave 0 骨架先 RED，Wave 1-2 实现变绿）

### integration.test.ts 守门用例接线模板（mock 需扩展）

```typescript
// mockExcel 需扩展：加 merge/unmerge mock + removeDuplicates mock + pivotTables mock
// 参照 Phase 27 mockOfficeSupportsAll() 设置 Office.context.requirements

// merge_cells 正向 undo 守门
it('单步撤销 merge_cells（merge 路径）：restoreMergeState 收 Record 对象 → rolled_back', async () => {
  mockOfficeSupportsAll();
  // mock Excel global 含 range.unmerge + range.values setter
  const adapter = new ExcelAdapter();
  const entry: OperationLogEntry = {
    runId: 'run-28', stepIndex: 0, toolName: 'merge_cells', /* ... */
    reverse: { tool: 'restore_merge_state', args: { address: 'Sheet1!A1:C1', operation: 'merge', across: false, snapshot: [['标题','X','Y']] } },
    postState: { kind: 'excel_merge', content: { address: 'Sheet1!A1:C1', operation: 'merge' } },
    timestamp: 0, args: {}, humanLabel: '合并单元格 A1:C1',
  };
  const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
  expect(detail.status).toBe('rolled_back'); // Wave 0 时为 skipped_error（adapter 未实现）→ RED
});
```

---

## Security Domain

本 phase 无新认证/会话/加密表面。ASVS 适用项：

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes（轻度）| address 字符串经 resolveRange 验证；字段名传给 Office.js API，异常由 HostApiError 包装 |
| V6 Cryptography | no | — |

无新 threat pattern（API Key 不涉及，无后台，所有调用在 Excel.run 闭包内）。

---

## Sources

### Primary（HIGH confidence）

- [Microsoft Learn — Excel JavaScript API requirement sets（含平台矩阵）](https://learn.microsoft.com/en-us/javascript/api/requirement-sets/excel/excel-api-requirement-sets) — ExcelApi 1.2/1.8/1.9 在 Office for Web 全部 Supported
- [Microsoft Learn — Work with PivotTables using the Excel JavaScript API](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/excel-add-ins-pivottables) — pivotTables.add + hierarchy 配置全链路代码示例，更新日期 2026-06-05
- [Microsoft Learn — Remove duplicates using the Excel JavaScript API](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/excel-add-ins-ranges-remove-duplicates) — removeDuplicates 参数 + RemoveDuplicatesResult 字段
- [Microsoft Learn — Excel.Range class（merge/unmerge）](https://learn.microsoft.com/en-us/javascript/api/excel/excel.range?view=excel-js-preview) — ExcelApi 1.2，merge/unmerge 参数
- `src/adapters/ExcelAdapter.ts`（VERIFIED codebase）— resolveRange:57, readRangeValuesSnapshot:1235, restoreRangeValuesSnapshot:1265, SNAPSHOT_LIMIT:1223, isSetSupported门控:1336
- `src/agent/operationLog.ts`（VERIFIED codebase）— PostStateSnapshot.kind:38-50, DocumentAdapterForReplay:104-179, executeReverse:390-571
- `src/agent/contract.test.ts`（VERIFIED codebase）— CONTRACT 数组 29 行，守门断言，D-17 fs.readFileSync:123-145
- `.planning/phases/08-foundation-a-f/CONTRACT.md`（VERIFIED codebase）— 格式模板，Phase 27 区块格式参考

### Secondary（MEDIUM confidence）

- GitHub OfficeDev/office-js issue #6405（Range.merge 行为 bug 报告，2025-12-29）— Web/Desktop/Mac 全平台报告，说明 merge API 在 Web 真机存在已知 bug（影响特定场景），建议 UAT 时关注
- GitHub OfficeDev/office-js issue #3611（getMergedAreasOrNullObject 只返回 top-left 所在 merge） — 影响 merge 状态读取（Phase 28 undo 走 snapshot 不依赖 getMergedAreas，受影响小）

### Tertiary（LOW confidence / 不直接使用）

- 各种 WebSearch 结果（已通过官方文档交叉验证，未标注 ASSUMED 的结论已升级为 CITED）

---

## Metadata

**Confidence breakdown:**
- ExcelApi 1.8/1.9/1.2 在 Office for Web 支持状态: HIGH — 官方平台矩阵直接确认
- merge undo 快照语义: HIGH — API 文档 + codebase restoreRangeValuesSnapshot 范式验证
- pivot 字段配置完整链路: HIGH（建表）/ MEDIUM（字段配置在 Web 真机可用性，文档有示例但待真机验证）
- CONTRACT 接线细节: HIGH — codebase 逐行确认
- Bundle 影响: HIGH — npm run build + size 实测

**Research date:** 2026-06-06
**Valid until:** 2026-07-06（ExcelApi 平台矩阵每季更新，30 天内稳定）
