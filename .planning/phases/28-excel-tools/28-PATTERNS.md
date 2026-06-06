# Phase 28: Excel 工具补全 - Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 7 个待改文件
**Analogs found:** 7 / 7

---

## File Classification

| 新增/修改文件 | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/adapters/ExcelAdapter.ts` | adapter / service | CRUD + snapshot | 同文件 `sortRange`(1293) / `createTable`(1085) / `deleteTableByName`(1114) | exact |
| `src/agent/tools/write/excel.ts` | tool definition | request-response | 同文件 `sortRangeTool`(400) / `createTableTool`(356) | exact |
| `src/agent/tools/index.ts` | registry / config | — | 同文件 `excelWriteTools` 数组(299-307) | exact |
| `src/agent/operationLog.ts` | orchestrator | event-driven | 同文件 Phase 27 新 case(547-564) / Phase 10 case(422-458) | exact |
| `src/agent/contract.test.ts` | test / contract | — | 同文件 Phase 27 行(64-68) + 守门断言(149) | exact |
| `.planning/phases/08-foundation-a-f/CONTRACT.md` | config / docs | — | 同文件 Phase 27 区块(82-91) | exact |
| `src/agent/operationLog.integration.test.ts` | test / integration | — | 同文件 `sort_range` 守门用例(1089-1103) / `set_range_values` 守门(844-863) | exact |

---

## Pattern Assignments

---

### `src/adapters/ExcelAdapter.ts`（adapter，CRUD + snapshot）

#### merge_cells 两个新方法（`mergeCells` + `restoreMergeState`）

**Analog 1 — 快照式写方法：** `sortRange`（lines 1293-1329）

```typescript
// ExcelAdapter.ts:1293-1329 — sortRange 快照式模式（merge_cells 照搬）
async sortRange(
  address: string,
  sortFields: Array<{ key: number; ascending: boolean }>,
): Promise<{ snapshot: unknown[][] | null; snapshotAddress: string; tooLarge: boolean }> {
  let snapshot: unknown[][] | null = null;
  let snapshotAddress = address;
  let tooLarge = false;

  try {
    const result = await this.readRangeValuesSnapshot(address);   // 先快照（line 1303）
    snapshot = result.snapshot;
    snapshotAddress = result.address;
  } catch (err) {
    if ((err as Error & { isTooLarge?: boolean }).isTooLarge) {
      tooLarge = true;   // 超限 → 仍执行，但标注不可撤销（line 1307）
    } else {
      tooLarge = true;
    }
  }

  try {
    await Excel.run(async (ctx) => {
      const range = resolveRange(ctx, address);   // resolveRange 路由（line 1319）
      range.sort.apply(sortFields);
      await ctx.sync();
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('Excel sortRange 失败', err);   // HostApiError 包装（line 1325）
  }

  return { snapshot, snapshotAddress, tooLarge };
}
```

**新工具如何照搬：** `mergeCells` = 先 `readRangeValuesSnapshot(address)`（merge 路径）→ 再 `Excel.run` 内 `resolveRange(ctx, address)` + `range.merge(across)` / `range.unmerge()`。超限走 tooLarge=true 同模式。

---

**Analog 2 — Record 签名 inverse 方法：** `restoreRangeValuesSnapshot`（lines 1265-1278）

```typescript
// ExcelAdapter.ts:1265-1278 — inverse 方法标准签名范式
async restoreRangeValuesSnapshot(args: Record<string, unknown>): Promise<void> {
  const address = args.address as string;   // 从 Record 解包
  const snapshot = args.snapshot as unknown[][];
  try {
    await Excel.run(async (ctx) => {
      const range = resolveRange(ctx, address);   // resolveRange 路由
      range.values = snapshot;   // 覆写值
      await ctx.sync();
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('Excel restoreRangeValuesSnapshot 失败', err);
  }
}
```

**新工具如何照搬：** `restoreMergeState(args: Record<string, unknown>)` 签名完全一致。实现逻辑：
- `args.operation === 'merge'` → `range.unmerge()` + sync + `range.values = args.snapshot` + sync
- `args.operation === 'unmerge'` → `range.merge(args.across as boolean)` + sync

---

**Analog 3 — 简单逆向 + load name 范式：** `createTable` / `deleteTableByName`（lines 1085-1132）

```typescript
// ExcelAdapter.ts:1085-1104 — createTable：add + load name + sync 读取 server 端规范化名称
async createTable(address: string, hasHeaders: boolean, tableName?: string): Promise<{ resolvedName: string }> {
  try {
    return await Excel.run(async (ctx) => {
      const sheet = ctx.workbook.worksheets.getActiveWorksheet();
      const table = sheet.tables.add(address, hasHeaders ?? false);
      if (tableName) table.name = tableName;
      table.load(['name']);      // sync 前必须 load
      await ctx.sync();
      return { resolvedName: table.name as string };   // server 端 name
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('Excel createTable 失败', err);
  }
}

// ExcelAdapter.ts:1114-1132 — deleteTableByName：getItemOrNullObject 防御范式
async deleteTableByName(args: Record<string, unknown>): Promise<void> {
  const tableName = args.tableName as string;
  try {
    await Excel.run(async (ctx) => {
      const sheet = ctx.workbook.worksheets.getActiveWorksheet();
      const table = sheet.tables.getItemOrNullObject(tableName);
      table.load('isNullObject');
      await ctx.sync();
      if (!table.isNullObject) {
        table.delete();
        await ctx.sync();
      }
      // 表格已不存在 → 静默跳过
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('Excel deleteTableByName 失败', err);
  }
}
```

**新工具如何照搬：**
- `createPivotTable`：`ws.pivotTables.add(name, sourceRange, destination)` + `pivotTable.load(['name'])` + `ctx.sync()` → 读取 server 端 `pivotTable.name` → 返回 `{ pivotTableName }`。
- `deletePivotTableByName(args: Record<string, unknown>)`：`ws.pivotTables.getItem(args.pivotTableName)` + `.delete()` + sync。镜像 `deleteTableByName`，差异：pivot 用 `getItem`（无 `getItemOrNullObject`），需 try/catch 静默已删除情况。

---

**Analog 4 — isSetSupported 门控先例：** `excelFindAndReplace`（lines 1346-1409，门控在 1382-1385 附近内联）

```typescript
// ExcelAdapter.ts:1382-1396 — isSetSupported 门控 + 版本注释（remove_duplicates 照搬）
// ExcelApi 1.9 replaceAll 门控（research RESEARCH.md R2 对应行）：
if (!Office.context.requirements.isSetSupported('ExcelApi', '1.9')) {
  throw new HostApiError('当前 Excel 版本不支持删除重复行（需要 ExcelApi 1.9）', undefined);
}
// 门控通过后执行主逻辑（ExcelApi 1.9 API）
```

**新工具如何照搬：**
- `removeDuplicatesRange`：`isSetSupported('ExcelApi', '1.9')` 门控，通过后执行快照 + `range.removeDuplicates(columns, includesHeader)`。
- `createPivotTable`：`isSetSupported('ExcelApi', '1.8')` + 整个 `Excel.run` 包在 try/catch 内。

---

**Analog 5 — resolveRange helper：** lines 57-72

```typescript
// ExcelAdapter.ts:57-72 — resolveRange：支持 Sheet1!A1 格式路由
function resolveRange(ctx, address: string): Excel.Range {
  const bangIdx = address.indexOf('!');
  if (bangIdx === -1) {
    return ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
  }
  // sheet-qualified 格式 → getItem(sheetName).getRange(localAddr)
  const sheetName = ...; // 去引号 + 转义
  return ctx.workbook.worksheets.getItem(sheetName).getRange(localAddr);
}
```

**新工具如何照搬：** `merge_cells` / `remove_duplicates` 的 `address` 参数全部经 `resolveRange(ctx, address)` 路由，绝不直接 `ws.getRange(address)`。

---

**Analog 6 — SNAPSHOT_LIMIT + SnapshotTooLargeError：** lines 1222-1253

```typescript
// ExcelAdapter.ts:1223 — 上限常量
private static readonly SNAPSHOT_LIMIT = 10_000;

// ExcelAdapter.ts:1235-1253 — readRangeValuesSnapshot（内部辅助，非 Record 签名）
private async readRangeValuesSnapshot(address: string): Promise<{ address: string; snapshot: unknown[][] }> {
  return await Excel.run(async (ctx) => {
    const range = resolveRange(ctx, address);
    range.load(['values', 'address', 'cellCount']);
    await ctx.sync();
    if ((range.cellCount as number) > ExcelAdapter.SNAPSHOT_LIMIT) {
      const err = new Error(`区域过大：${range.cellCount as number} 个单元格，超过快照上限 ${ExcelAdapter.SNAPSHOT_LIMIT}`);
      (err as Error & { isTooLarge: boolean }).isTooLarge = true;
      throw err;
    }
    return { address: range.address as string, snapshot: range.values as unknown[][] };
  });
}
```

**新工具如何照搬：** `mergeCells` / `removeDuplicatesRange` 都调 `this.readRangeValuesSnapshot(address)` 先快照。超限 catch isTooLarge → tooLarge=true。

---

### `src/agent/tools/write/excel.ts`（ToolDef 定义，request-response）

#### 快照式 ToolDef 完整模板 — `sortRangeTool`（lines 400-455）

```typescript
// src/agent/tools/write/excel.ts:400-455 — 快照式 ToolDef 完整结构
export const sortRangeTool: ToolDef = {
  name: 'sort_range',
  kind: 'write',
  description:
    '对指定 range 按给定列排序。' +
    '注意：超过 10,000 单元格时将无法自动撤销。',
  parameters: {
    type: 'object',
    properties: {
      address: { type: 'string', description: '排序范围，如 A1:E500' },
      sortFields: { type: 'array', ... },
    },
    required: ['address', 'sortFields'],
  },
  humanLabel: (args: unknown) => {
    const { address } = args as { address: string; ... };
    return `对 ${address} 按第 X 列排序`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const { address, sortFields } = args as { address: string; sortFields: ... };
    const { snapshot, snapshotAddress, tooLarge } = await (ctx.adapter as ExcelAdapter).sortRange(address, sortFields);
    // tooLarge 分支决定 reverse 工具
    const reverse: ReverseDescriptor = tooLarge
      ? { tool: 'noop_inverse', args: { reason: `区域过大，无法自动撤销` } }
      : { tool: 'restore_range_values_snapshot', args: { address: snapshotAddress, snapshot } };
    const postState: PostStateSnapshot = {
      kind: 'excel_snapshot',   // 已有 kind，remove_duplicates 复用
      content: { address, tooLarge },
    };
    return { ok: true, data: { address, tooLarge }, reverse, postState };
  },
};
```

**三工具 ToolDef 如何照搬：**

| 工具 | reverse tool（正常路径） | reverse tool（超限/降级） | postState.kind | 关键 data 字段 |
|------|--------------------------|--------------------------|---------------|----------------|
| `merge_cells` | `restore_merge_state` | `noop_inverse`（超限） | `'excel_merge'`（新） | `{ address, operation }` |
| `remove_duplicates` | `restore_range_values_snapshot` | `noop_inverse`（超限） | `'excel_snapshot'`（复用） | `{ address, removed, uniqueRemaining }` |
| `create_pivot_table` | `delete_pivot_table_by_name` | `noop_inverse`（API 不可用） | `'excel_pivot'`（新） | `{ pivotTableName }` |

**简单逆向 ToolDef 模板 — `createTableTool`（lines 356-394）**

```typescript
// src/agent/tools/write/excel.ts:374-393 — 简单逆向：execute → adapter 方法 → server 端名称 → reverse
async execute(args, ctx): Promise<ToolResult> {
  const { address, hasHeaders, tableName } = args as { address: string; ... };
  const { resolvedName } = await (ctx.adapter as ExcelAdapter).createTable(address, hasHeaders ?? false, tableName);
  const reverse: ReverseDescriptor = {
    tool: 'delete_table_by_name',
    args: { tableName: resolvedName },   // server 端规范化名称，不用用户传入
  };
  const postState: PostStateSnapshot = { kind: 'excel_table', content: { tableName: resolvedName } };
  return { ok: true, data: { tableName: resolvedName }, reverse, postState };
},
```

**`create_pivot_table` 照搬差异：** `args.pivotTableName`（server 端 load 后的名称），`tool: 'delete_pivot_table_by_name'`。

---

### `src/agent/tools/index.ts`（registry，config）

#### `excelWriteTools` 数组注册模板（lines 298-313）

```typescript
// src/agent/tools/index.ts:298-313 — Excel 注册点（三工具加在 batchWrite 前面）
case 'excel': {
  const excelWriteTools = [
    setRangeValuesTool, applyFormula, insertChart, setCell,
    formatExcelRangeTool, setColumnRowSizeTool, setAutoFilterTool,
    addConditionalFormatTool, createTableTool, freezePanesTool,
    sortRangeTool, excelFindAndReplaceTool, manageWorksheetTool, setChartTitleTool,
    // ↑ Phase 10 既有工具
    // Phase 28 新增三工具（加在 batchWrite 前面）：
    mergeCellsTool, removeDuplicatesTool, createPivotTableTool,
    batchWrite,   // Phase 11 BATCH-01 追加
  ] as ToolDef[];
  excelWriteTools.forEach(assertWriteToolRegisterable);   // 注册守门
  return [
    listWorksheets, getRangeValues, getUsedRangeSummary,
    getShapeImage,
    ...excelWriteTools, selectionDetail,
  ].map((t) => t as ToolDef);
}
```

**关键注意：**
- Excel 工具**没有 `EXCEL_TOOLS` Set**（只有 PPT 有 `PPT_TOOLS`，见 index.ts:34）。
- 因此 Excel 工具参数**直接用 snake_case**（`source_range`、`destination`、`row_fields`、`data_fields`），无需归一化。
- 三工具的 ToolDef import 加在 `import { setRangeValues as ...` 那行（index.ts:15）。

---

### `src/agent/operationLog.ts`（orchestrator，event-driven）

#### 1. `PostStateSnapshot.kind` union 扩展（lines 34-52）

```typescript
// operationLog.ts:34-52 — kind union 当前末尾（Phase 27 之后）
| 'word_list_format' | 'word_comment' | 'word_header_footer' | 'word_table_cell'
| 'batch';   // ← 当前最后一行

// Phase 28 新增（在 'batch' 前插入）：
| 'excel_merge'   // merge_cells 快照（readTargetState default → undefined，不加比对规则）
| 'excel_pivot'   // create_pivot_table 简单逆向（同保守路径）
// remove_duplicates 复用现有 'excel_snapshot'（无需新增）
```

#### 2. `DocumentAdapterForReplay` 接口新增方法（lines 104-180，在 Phase 27 区块之后追加）

```typescript
// operationLog.ts:170-179 — Phase 27 末尾（参照格式）
/** Word inverse：还原表格单元格内容（edit_table_cell） */
restoreTableCell?: (args: Record<string, unknown>) => Promise<void>;
/** Phase 11：batch_reverse ... */
executeBatchReverse?: ...;

// Phase 28 新增（接在 Phase 27 区块后面）：
// ─── Phase 28 Excel 工具补全 inverse 方法 ───
/** Excel inverse：还原合并状态（merge_cells → restore_merge_state）*/
restoreMergeState?: (args: Record<string, unknown>) => Promise<void>;
/** Excel inverse：按名称删除透视表（create_pivot_table → delete_pivot_table_by_name）*/
deletePivotTableByName?: (args: Record<string, unknown>) => Promise<void>;
// remove_duplicates 复用现有 restoreRangeValuesSnapshot（已在 line 144，无需新增）
```

#### 3. `executeReverse` switch 新增 case（参照 Phase 27 case 范式，lines 547-564）

```typescript
// operationLog.ts:547-564 — Phase 27 case 范式（逐字照搬格式）
case 'delete_comment_by_id':
  if (!adapter.deleteCommentById) {
    throw new Error(`adapter 未实现 deleteCommentById（tool=${reverse.tool}）`);
  }
  await adapter.deleteCommentById(reverse.args);
  break;

// Phase 28 新增 2 个 case（加在 Phase 27 block 之后，noop_inverse 之前）：
case 'restore_merge_state':
  if (!adapter.restoreMergeState) throw new Error(`adapter 未实现 restoreMergeState（tool=${reverse.tool}）`);
  await adapter.restoreMergeState(reverse.args);
  break;
case 'delete_pivot_table_by_name':
  if (!adapter.deletePivotTableByName) throw new Error(`adapter 未实现 deletePivotTableByName（tool=${reverse.tool}）`);
  await adapter.deletePivotTableByName(reverse.args);
  break;
// 注意：restore_range_values_snapshot case 已在 line 431，remove_duplicates 复用，无需新增
```

---

### `src/agent/contract.test.ts`（test / contract）

#### CONTRACT 数组新增 3 行 + PhaseNum type 扩展

```typescript
// contract.test.ts:18 — 当前 PhaseNum（需加 | 28）
type PhaseNum = 9 | 10 | 11 | 23 | 27;   // 改为：
type PhaseNum = 9 | 10 | 11 | 23 | 27 | 28;

// contract.test.ts:64-68 — Phase 27 行格式（完全照搬格式）
{ toolName: 'set_word_list_format', host: 'word', undoType: 'noop+gate', reverseTool: 'noop_inverse', phase: 27, integrationTest: true },
{ toolName: 'insert_word_comment', host: 'word', undoType: '简单逆向', reverseTool: 'delete_comment_by_id', phase: 27, integrationTest: true },
{ toolName: 'set_word_header_footer', host: 'word', undoType: '简单逆向', reverseTool: 'restore_word_header_footer', phase: 27, integrationTest: true },
{ toolName: 'edit_table_cell', host: 'word', undoType: '简单逆向', reverseTool: 'restore_table_cell', phase: 27, integrationTest: true },

// Phase 28 新增 3 行（Wave 0 先 integrationTest: false，Wave 1-2 改 true）：
// ─── Phase 28 Excel 工具补全 ───
{ toolName: 'merge_cells', host: 'excel', undoType: '快照式', reverseTool: 'restore_merge_state', phase: 28, integrationTest: false },
{ toolName: 'remove_duplicates', host: 'excel', undoType: '快照式', reverseTool: 'restore_range_values_snapshot', phase: 28, integrationTest: false },
{ toolName: 'create_pivot_table', host: 'excel', undoType: '简单逆向', reverseTool: 'delete_pivot_table_by_name', phase: 28, integrationTest: false },
```

**守门断言影响：**
- `CONTRACT.length >= 24`（line 150）：29 行 + 3 行 = 32 行，仍通过。
- `noop+gate` 工具 reverseTool 必须是 `noop_inverse`（line 97）：三新工具均非 noop+gate，自动通过。
- D-17 `fs.readFileSync` 硬卡（line 140）：`integrationTest: false` 时**不扫描** integration 文件（Wave 0 时安全）。改为 true 时必须同步补守门用例。

---

### `.planning/phases/08-foundation-a-f/CONTRACT.md`（config / docs）

#### Phase 27 区块格式模板（lines 82-91）

```markdown
## Phase 27：Word 工具补全

| 工具名 | Host | undo 分类 | reverseTool | integration_test | status |
|--------|------|----------|------------|-----------------|--------|
| set_word_list_format | word | noop+gate | noop_inverse | true | done |
| insert_word_comment | word | 简单逆向 | delete_comment_by_id | true | done |
```

**Phase 28 新增区块格式（照搬）：**

```markdown
## Phase 28：Excel 工具补全

| 工具名 | Host | undo 分类 | reverseTool | integration_test | status |
|--------|------|----------|------------|-----------------|--------|
| merge_cells | excel | 快照式 | restore_merge_state | false | planned |
| remove_duplicates | excel | 快照式 | restore_range_values_snapshot | false | planned |
| create_pivot_table | excel | 简单逆向 | delete_pivot_table_by_name | false | planned |
```

---

### `src/agent/operationLog.integration.test.ts`（test / integration）

#### 守门用例模板 1：真 ExcelAdapter 快照式（`sort_range` 范式，lines 1089-1103）

```typescript
// operationLog.integration.test.ts:1089-1103 — sort_range 快照式守门用例（直接照搬）
it('D-17/D-20: sort_range → restore_range_values_snapshot → rolled_back', async () => {
  mockExcel();   // mock Excel global，使 Excel.run 可用
  const adapter = new ExcelAdapter();
  const entry: OperationLogEntry = {
    runId: 'r10', stepIndex: 7,
    toolName: 'sort_range',
    args: { address: 'A1:E500', key: [{ column: 1, ascending: false }] },
    humanLabel: '对 A1:E500 按第 2 列降序排序',
    reverse: { tool: 'restore_range_values_snapshot', args: { address: 'A1:E500', snapshot: [['a', 'b']] } },
    postState: { kind: 'excel_snapshot', content: { address: 'A1:E500' } },
    timestamp: 0,
  };
  const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
  expect(detail.status).toBe('rolled_back');
});
```

**三工具守门用例如何对应：**

| 工具 | toolName 字面量 | reverse.tool | postState.kind | Wave 0 期望状态 |
|------|----------------|-------------|----------------|-----------------|
| merge_cells（merge 路径） | `'merge_cells'` | `'restore_merge_state'` | `'excel_merge'` | `skipped_error`（adapter 未实现）→ Wave 1 改 `rolled_back` |
| remove_duplicates | `'remove_duplicates'` | `'restore_range_values_snapshot'` | `'excel_snapshot'` | `rolled_back`（复用已有 case） |
| create_pivot_table | `'create_pivot_table'` | `'delete_pivot_table_by_name'` | `'excel_pivot'` | `skipped_error`（adapter 未实现）→ Wave 2 改 `rolled_back` |
| merge_cells（超限 noop 路径） | `'merge_cells'` | `'noop_inverse'` | `'excel_merge'` | `skipped_error`（noop_inverse 永远 throw） |
| remove_duplicates（超限） | `'remove_duplicates'` | `'noop_inverse'` | `'excel_snapshot'` | `skipped_error` |
| create_pivot_table（降级）| `'create_pivot_table'` | `'noop_inverse'` | `'excel_pivot'` | `skipped_error` |

**`mockOfficeSupportsAll()` 工厂复用（line 364）：**

```typescript
// operationLog.integration.test.ts:364-367 — isSetSupported 需要的 mock（remove_duplicates/create_pivot_table 门控测试必须调）
function mockOfficeSupportsAll(): void {
  (global as unknown as Record<string, unknown>).Office = {
    context: { requirements: { isSetSupported: (_set: string, _ver: string) => true } },
  };
}
// 用法：在需要门控的用例开头调 mockOfficeSupportsAll()；afterEach 已有 delete global.Office 清理
```

**D-17 硬卡满足方式：** 6 个守门用例（每工具 2 个）中，3 个 toolName 字面量 `'merge_cells'`、`'remove_duplicates'`、`'create_pivot_table'` 逐字出现在文件内，Wave 0 即满足扫描。

---

## Shared Patterns

### 快照式 undo 双步（ExcelAdapter 内部）
**Source:** `ExcelAdapter.ts:1293-1329` (`sortRange`)
**Apply to:** `mergeCells`, `removeDuplicatesRange`

```typescript
// 1. 先快照（超限 catch isTooLarge → tooLarge=true，继续执行）
try {
  const { snapshot, address } = await this.readRangeValuesSnapshot(address);
} catch (err) {
  if ((err as Error & { isTooLarge?: boolean }).isTooLarge) tooLarge = true;
  else tooLarge = true;
}
// 2. 执行写操作（Excel.run + resolveRange）
// 3. 返回 { snapshot, snapshotAddress, tooLarge }
```

### tooLarge 分支 → noop_inverse
**Source:** `tools/write/excel.ts:440-448` (`sortRangeTool.execute`)
**Apply to:** `mergeCellsTool.execute`, `removeDuplicatesTool.execute`

```typescript
const reverse: ReverseDescriptor = tooLarge
  ? { tool: 'noop_inverse', args: { reason: `区域过大（超过 10,000 单元格），无法自动撤销` } }
  : { tool: 'restore_merge_state', args: { address: snapshotAddress, snapshot, operation, across } };
```

### server 端 load name 后用于 reverse.args
**Source:** `tools/write/excel.ts:380-387` (`createTableTool.execute`)
**Apply to:** `createPivotTableTool.execute`

```typescript
const { resolvedName } = await adapter.createTable(...);
const reverse = { tool: 'delete_table_by_name', args: { tableName: resolvedName } };
// ↓ create_pivot_table 对应：
const { pivotTableName } = await adapter.createPivotTable(...);
const reverse = { tool: 'delete_pivot_table_by_name', args: { pivotTableName } };
```

### executeReverse case 格式（单行守门 + await）
**Source:** `operationLog.ts:423-430` (Phase 10 Wave 0 case 格式)
**Apply to:** `restore_merge_state` case, `delete_pivot_table_by_name` case

```typescript
case 'restore_merge_state':
  if (!adapter.restoreMergeState) throw new Error(`adapter 未实现 restoreMergeState（tool=${reverse.tool}）`);
  await adapter.restoreMergeState(reverse.args);
  break;
```

### isSetSupported 门控（adapter 方法开头）
**Source:** `ExcelAdapter.ts:1382-1385` (excelFindAndReplace 内 replaceAll 门控)
**Apply to:** `removeDuplicatesRange`（1.9）, `createPivotTable`（1.8）

```typescript
if (!Office.context.requirements.isSetSupported('ExcelApi', '1.9')) {
  throw new HostApiError('当前 Excel 版本不支持删除重复行（需要 ExcelApi 1.9）', undefined);
}
```

---

## No Analog Found

无。本 phase 所有 7 个待改文件均在既有 codebase 中有精确 analog。

---

## 关键 Analog 风险（Patterns 分析中额外发现）

1. **`remove_duplicates` 守门用例在 Wave 0 即应为 `rolled_back`（非 skipped_error）**：`restoreRangeValuesSnapshot` case 在 operationLog.ts:431 已存在，`ExcelAdapter.restoreRangeValuesSnapshot` 在 line 1265 已实现，`mockExcel()` 已 mock `range.values setter`。因此 Wave 0 追加 `remove_duplicates` integration 用例时，期望状态直接是 `rolled_back`（不需等 Wave 1）。RESEARCH.md 中「Wave 0 时为 skipped_error」的描述适用于 `merge_cells` / `create_pivot_table`，**不适用于 `remove_duplicates`**。

2. **`create_pivot_table` 的 `deletePivotTableByName` 应用 `getItem`（非 `getItemOrNullObject`）**：pivot tables 集合无 `getItemOrNullObject`（不同于 tables 集合），需 try/catch 静默已删场景（区别于 `deleteTableByName` 使用 `isNullObject` 判断的范式）。

3. **`merge_cells` args 形状比 `sort_range` 多两字段**：reverse.args 需携带 `{ address, operation, across, snapshot? }`——`operation` 和 `across` 字段是 `restore_merge_state` 两路分支的判据，adapter 实现时从 `args` Record 解包。

---

## Metadata

**Analog search scope:** `src/adapters/ExcelAdapter.ts`, `src/agent/operationLog.ts`, `src/agent/contract.test.ts`, `src/agent/tools/write/excel.ts`, `src/agent/tools/index.ts`, `src/agent/operationLog.integration.test.ts`, `.planning/phases/08-foundation-a-f/CONTRACT.md`
**Files scanned:** 7
**Pattern extraction date:** 2026-06-06
