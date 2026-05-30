# Phase 10: Excel + PPT 工具完整 (B-Excel + B-PPT) - Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 8 modified files（全部 additive，无新建文件）
**Analogs found:** 8 / 8

---

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/adapters/ExcelAdapter.ts` | adapter/service | CRUD + request-response | 同文件 `insertChart`+`deleteChartByName`（before-image+inverse 对）+ `overwriteRange`（Record 签名）+ `setRangeValues`（two-sync） | exact — 同文件内已有完整三范式 |
| `src/adapters/PptAdapter.ts` | adapter/service | CRUD + request-response | 同文件 `setShapeProperty`+`restoreShapeProperty`（四 sync + before-image）+ `setShapeText`+`restoreShapeText`（TEXT_SHAPE_TYPES）+ `deleteSlideByTitle`（指纹定位）| exact — 同文件内已有完整范式 |
| `src/agent/operationLog.ts` | service + interface | event-driven (undo) | 同文件 `DocumentAdapterForReplay` 接口（lines 83–106）+ `executeReverse` switch（lines 247–307）+ `noop_inverse` case（lines 300–303）| exact — 同文件追加 |
| `src/agent/tools/write/excel.ts` | tool/controller | request-response | 同文件 `insertChart` ToolDef（lines 106–139）+ `setCell` ToolDef（lines 141–166）| exact — 同文件追加 |
| `src/agent/tools/write/ppt.ts` | tool/controller | request-response | 同文件 `setShapeProperty` ToolDef（lines 114–182）+ `setShapeText` ToolDef（lines 240–276）| exact — 同文件追加 |
| `src/agent/operationLog.integration.test.ts` | test (integration) | event-driven (undo) | 同文件 `deleteChartByName` 守门测试（lines 193–217）+ `restoreShapeProperty` 守门测试（lines 249–277）| exact — 同文件追加 |
| `src/agent/contract.test.ts` | test (contract) | — | 同文件 Phase 10 十八行声明（lines 41–59，已存在，integrationTest: false → true）| exact — 翻标志位 |
| `src/agent/tools/index.ts` | registry | request-response | 同文件 `case 'excel'` 数组（line 207）+ `case 'ppt'` 数组（line 215）| exact — 数组追加 |

---

## CRITICAL 横切约束（所有文件适用，执行时不可绕过）

### 硬约束 1：Record 签名（D-18 — 数据安全硬门）

**Source:** `src/adapters/ExcelAdapter.ts` lines 362–375 (`overwriteRange`) + `src/adapters/PptAdapter.ts` lines 791–870 (`restoreShapeProperty`)

**所有 inverse/read/snapshot adapter 方法签名必须是：**
```typescript
async xxxMethod(args: Record<string, unknown>): Promise<void> {
  const field1 = args.field1 as Type1;  // 方法体第一行解包
  const field2 = args.field2 as Type2;
  // ...
}
```

历史教训（Phase 5 真机翻车）：位置签名 `(address: string)` 收到 replay engine 传来的对象 → 调用方法时 TypeError → 全部 inverse 被误判 `skipped_error`，单测全绿只有 integration test 能守住。

### 硬约束 2：reverse tool 名逐字对齐 contract.test.ts

**Source:** `src/agent/contract.test.ts` lines 41–59（Phase 10 十八行，已锁定）

| 工具名 | undoType | reverse tool 名（逐字不可改） |
|--------|----------|------------------------------|
| `format_excel_range` | 简单逆向 | `restore_range_format` |
| `set_column_row_size` | 简单逆向 | `restore_column_row_size` |
| `sort_range` | 快照式 | `restore_range_values_snapshot` |
| `set_auto_filter` | 简单逆向 | `restore_auto_filter` |
| `excel_find_and_replace` | 快照式 | `restore_range_values_snapshot` |
| `add_conditional_format` | 简单逆向 | `restore_conditional_format` |
| `create_table` | 简单逆向 | `delete_table_by_name` |
| `freeze_panes` | 简单逆向 | `restore_freeze_panes` |
| `manage_worksheet` | 快照式 | `restore_worksheet_snapshot` |
| `set_chart_title` | 简单逆向 | `restore_chart_title` |
| `set_shape_text_font` | 简单逆向 | `restore_shape_font` |
| `set_shape_text_alignment` | 简单逆向 | `restore_shape_alignment` |
| `add_shape` | 简单逆向 | `delete_shape_by_id` |
| `delete_shape` | noop+gate | `noop_inverse` |
| `rotate_shape` | 简单逆向 | `restore_shape_rotation` |
| `set_slide_background` | 简单逆向 | `restore_slide_background` |
| `manage_slides` | noop+gate | `noop_inverse` |
| `copy_slide` | 简单逆向 | `delete_slide_by_index` |

### 硬约束 3：D-17 四步守门（每工具必须全部完成）

**Source:** `src/agent/contract.test.ts` lines 114–137 (`fs.readFileSync` 硬卡)

每个工具完成时必须同时满足四步：
1. `contract.test.ts` 对应行 `integrationTest: false → true`
2. `operationLog.integration.test.ts` 追加守门用例（`toolName` 字符串字面量出现在文件内）
3. `CONTRACT.md` 对应行 `status: planned → done` + `integration_test: false → true`
4. noop+gate 工具额外验证 `executeReverse(noop_inverse)` → `skipped_error` 路径

---

## Pattern Assignments

### Pattern A：Excel.run 两 sync 简单逆向（EXCEL-01/02/04/07/08/10 共用）

**Analog:** `src/adapters/ExcelAdapter.ts` lines 316–341 (`setRangeValues` + `overwriteRange`)

**ExcelAdapter write 方法模板（两 sync）：**
```typescript
// src/adapters/ExcelAdapter.ts lines 316-341
async setRangeValues(
  address: string,
  values: unknown[][],
): Promise<{ beforeImage: { address: string; values: unknown[][] } }> {
  try {
    return await Excel.run(async (ctx) => {
      const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
      // sync 1：load before-image（address 是 server 端属性，必须 sync 后才可读）
      range.load(['values', 'address']);
      await ctx.sync();

      const beforeImage = {
        address: range.address as string,
        values: range.values as unknown[][],
      };

      // sync 2：覆写 range
      range.values = values;
      await ctx.sync();

      return { beforeImage };
    });
  } catch (err) {
    throw new HostApiError('Excel setRangeValues 失败', err);
  }
}
```

**ExcelAdapter inverse 方法模板（Record 签名）：**
```typescript
// src/adapters/ExcelAdapter.ts lines 362-375
async overwriteRange(args: Record<string, unknown>): Promise<void> {
  const address = args.address as string;
  const values = args.values as unknown[][];
  try {
    await Excel.run(async (ctx) => {
      const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
      range.values = values;
      await ctx.sync();
    });
  } catch (err) {
    throw new HostApiError('Excel overwriteRange 失败', err);
  }
}
```

**适用于：**
- `EXCEL-01`：`formatExcelRange` (write) + `restoreRangeFormat` (inverse) — 多属性 before-image，参见 §EXCEL-01 具体适配
- `EXCEL-02`：`setColumnRowSize` (write) + `restoreColumnRowSize` (inverse)
- `EXCEL-04`：`setAutoFilter` (write) + `restoreAutoFilter` (inverse)
- `EXCEL-07`：`createTable` (write) + `deleteTableByName` (inverse)
- `EXCEL-08`：`freezePanes` (write) + `restoreFreezePanes` (inverse)
- `EXCEL-10`：`setChartTitle` (write) + `restoreChartTitle` (inverse) — 复用 `insertChart`/`deleteChartByName` 定位范式

---

### Pattern B：insertChart + deleteChartByName（按名定位 + getItemOrNullObject 防御）

**Analog:** `src/adapters/ExcelAdapter.ts` lines 399–454

**`insertChart` — 写后 load name，捕获稳定句柄：**
```typescript
// src/adapters/ExcelAdapter.ts lines 399-421
async insertChart(dataRange: string, chartType: string): Promise<{ chartName: string }> {
  try {
    return await Excel.run(async (ctx) => {
      const sheet = ctx.workbook.worksheets.getActiveWorksheet();
      const range = sheet.getRange(dataRange);
      const chart = sheet.charts.add(
        chartType as Excel.ChartType,
        range,
        Excel.ChartSeriesBy.auto,
      );
      // load name 后 sync — name 是 server 端属性，sync 后才可读
      chart.load(['name']);
      await ctx.sync();
      return { chartName: chart.name as string };
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('Excel insertChart 失败', err);
  }
}
```

**`deleteChartByName` — getItemOrNullObject 防御（按名删除）：**
```typescript
// src/adapters/ExcelAdapter.ts lines 435-454
async deleteChartByName(args: Record<string, unknown>): Promise<void> {
  const chartName = args.chartName as string;
  try {
    await Excel.run(async (ctx) => {
      const sheet = ctx.workbook.worksheets.getActiveWorksheet();
      const chart = sheet.charts.getItemOrNullObject(chartName);
      chart.load('isNullObject');
      await ctx.sync();
      if (!chart.isNullObject) {
        chart.delete();
        await ctx.sync();
      }
      // chart 已不存在 → 静默跳过（replay engine 处理 skipped_error）
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('Excel deleteChartByName 失败', err);
  }
}
```

**适用于：**
- `EXCEL-07`：`createTable` (write, 写后 load name) + `deleteTableByName` (inverse, 完全复用此 getItemOrNullObject 范式)
- `EXCEL-10`：`setChartTitle` (write, sync 1 定位图表 + sync 2 load before-title + sync 3 write) + `restoreChartTitle` (inverse, 按 chartName 找到图表 → chart.title.text = beforeTitle)

---

### Pattern C：快照式 undo（sort_range / excel_find_and_replace / manage_worksheet）

**Analog 参照：** Phase 9 Word `find_and_replace` 同构范式（RESEARCH.md §Pattern 2）

**快照写方法（ExcelAdapter）：**
```typescript
// 写前先读 range.values + cellCount（参照 RESEARCH.md lines 888-898）
async readRangeValuesSnapshot(address: string): Promise<{ address: string; snapshot: unknown[][] }> {
  return await Excel.run(async (ctx) => {
    const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
    range.load(['values', 'address', 'cellCount']);
    await ctx.sync();
    if ((range.cellCount as number) > SNAPSHOT_LIMIT) {
      throw new SnapshotTooLargeError(range.cellCount as number);  // 超限 → noop+gate
    }
    return { address: range.address as string, snapshot: range.values as unknown[][] };
  });
}
```

**快照 inverse 方法（Record 签名）：**
```typescript
// args: { address: string, snapshot: unknown[][] }
// 复用 overwriteRange 范式（range.values = snapshot，单次 sync）
async restoreRangeValuesSnapshot(args: Record<string, unknown>): Promise<void> {
  const address = args.address as string;
  const snapshot = args.snapshot as unknown[][];
  // 内部: Excel.run → range.values = snapshot → sync（与 overwriteRange 完全同构）
}
```

**超限降级 noop+gate（写在 ToolDef.execute 内）：**
```typescript
// 超限时 reverse 改写为 noop_inverse（执行仍继续，但标注不可撤销）
const reverse: ReverseDescriptor = {
  tool: 'noop_inverse',
  args: { reason: '区域过大（超过 10,000 单元格），无法自动撤销' },
};
```

**SNAPSHOT_LIMIT = 10,000 单元格**（D-07，PITFALLS E4：Office for Web 5MB API 响应上限）

**适用于：**
- `EXCEL-03`：`sort_range` — 写前 readRangeValuesSnapshot，执行 range.sort.apply(sortFields)
- `EXCEL-05`：`excel_find_and_replace` — 写前 readRangeValuesSnapshot(usedRange)，执行 replaceAll
- `EXCEL-09`：`manage_worksheet` — 元数据快照（不含内容）：add 逆向 = deleteByName；rename 逆向 = 改回旧名

**EXCEL-03/05 共享 reverse 名注意（D-20）：** 两个工具的 reverse.tool 都是 `restore_range_values_snapshot`，operationLog.ts 只需一个 case + 一个 adapter 方法，但 `operationLog.integration.test.ts` 必须各有一条独立守门用例（两个 `toolName` 字符串都要出现在文件内）。

---

### Pattern D：PPT 四 sync + TEXT_SHAPE_TYPES 守门（PPT-01/02/05）

**Analog:** `src/adapters/PptAdapter.ts` lines 647–769 (`setShapeProperty`) + lines 1014–1078 (`setShapeText`)

**PPT write 方法四 sync 模板：**
```typescript
// src/adapters/PptAdapter.ts lines 670-764（setShapeProperty 核心结构）
return await PowerPoint.run(async (ctx) => {
  // sync 1: load slides
  const slides = ctx.presentation.slides;
  slides.load('items');
  await ctx.sync();

  // bounds check
  const idx = slideIndex - 1;
  if (idx < 0 || idx >= slides.items.length) {
    throw new HostApiError(`PPT xxx: 第 ${slideIndex} 张 slide 不存在`, undefined);
  }

  // sync 2: load shapes（含 id + type 做 fail-closed 守门）
  const slide = slides.items[idx];
  slide.shapes.load('items/id,items/type');
  await ctx.sync();

  // 定位 shape，fail-closed TEXT_SHAPE_TYPES 守门
  const shape = (slide.shapes.items as Array<{id: string; type: string; ...}>)
    .find((sh) => sh.id === shapeId);
  if (!shape) throw new HostApiError(`PPT xxx: 形状 ${shapeId} 不存在`, undefined);
  if (!TEXT_SHAPE_TYPES.has(shape.type)) throw new HostApiError(`...不支持文本编辑...`, undefined);

  // sync 3: load before-image（具体属性按工具定）
  shape.textFrame.textRange.font.load(['bold', 'italic', 'color', 'size', 'name']);
  await ctx.sync();
  const beforeFont = { bold: shape.textFrame.textRange.font.bold as boolean | null, ... };

  // sync 4: 写入
  if (font.bold !== undefined) shape.textFrame.textRange.font.bold = font.bold;
  await ctx.sync();

  return { beforeFont };
});
```

**TEXT_SHAPE_TYPES 白名单（PptAdapter.ts line 38，禁止 inline 重复定义）：**
```typescript
// src/adapters/PptAdapter.ts line 38（只读，不在新方法内重定义）
const TEXT_SHAPE_TYPES = new Set<string>(['GeometricShape', 'TextBox', 'Placeholder', 'Callout']);
```

**适用于：**
- `PPT-01`：`setShapeTextFont` — sync 3 load font，before-image = { bold, italic, underline, color, size, name }；inverse `restoreShapeFont`
- `PPT-02`：`setShapeTextAlignment` — spike S4 门控，sync 3 load paragraphFormat.alignment，try/catch 降级；inverse `restoreShapeAlignment`
- `PPT-05`：`rotateShape` — spike S1 门控，sync 3 load rotation，try/catch 降级；inverse `restoreShapeRotation`

---

### Pattern E：PPT inverse 方法（restoreShapeProperty 范式）

**Analog:** `src/adapters/PptAdapter.ts` lines 791–871 (`restoreShapeProperty`)

**PPT inverse 方法模板（Record 签名，两 sync）：**
```typescript
// src/adapters/PptAdapter.ts lines 791-871（restoreShapeProperty 完整范式）
async restoreShapeProperty(args: Record<string, unknown>): Promise<void> {
  const slide_index = args.slide_index as number;
  const shape_id = args.shape_id as string;
  // ... 解包其余字段 ...

  try {
    await PowerPoint.run(async (ctx) => {
      // sync 1: load slides
      const slides = ctx.presentation.slides;
      slides.load('items');
      await ctx.sync();

      const idx = slide_index - 1;
      if (idx < 0 || idx >= slides.items.length) {
        throw new HostApiError(`PPT restoreXxx: 第 ${slide_index} 张 slide 不存在`, undefined);
      }

      // sync 2: load shapes（只 load 还原所需属性）
      const slide = slides.items[idx];
      slide.shapes.load('items/id,...');
      await ctx.sync();

      const shape = (slide.shapes.items as Array<{id: string; ...}>)
        .find((sh) => sh.id === shape_id);
      if (!shape) {
        throw new HostApiError(`PPT restoreXxx: 形状 ${shape_id} 已不存在`, undefined);
      }

      // 写入还原值（单次 sync）
      shape.xxx = before_xxx;
      await ctx.sync();
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('PPT restoreXxx 失败', err);
  }
}
```

**适用于：**
- `restoreShapeFont(args)` — args: { slide_index, shape_id, before_font: {...} }
- `restoreShapeAlignment(args)` — args: { slide_index, shape_id, before_alignment }
- `restoreShapeRotation(args)` — args: { slide_index, shape_id, before_rotation }

---

### Pattern F：PPT add_shape — addGeometricShape/addTextBox + shapeId 捕获 + #2775 防御

**Analog:** `src/adapters/PptAdapter.ts` lines 484–540 (`insertSlideAfter` 捕获 slide 指纹范式) + RESEARCH.md §PPT-03

**几何形状路径（addGeometricShape）：**
```typescript
// 参照 RESEARCH.md lines 588-603
const shape = slide.shapes.addGeometricShape(
  shapeType as PowerPoint.GeometricShapeType,
  { left, top, width, height },
);
shape.load(['id']);
await ctx.sync();  // load id（server 端属性）
const newShapeId = shape.id as string;
// 文字写入走 TEXT_SHAPE_TYPES 守门路径（复用 setShapeText 范式）
```

**文本框路径（addTextBox + #2775 count 校验）：**
```typescript
// 参照 RESEARCH.md lines 612-630
// 先记录 count before
slide.shapes.load('items/$none');
await ctx.sync();
const countBefore = slide.shapes.items.length;

const textbox = slide.shapes.addTextBox(text ?? '', { left, top, width, height });
textbox.load(['id']);
await ctx.sync();

// 校验 count（#2775 防御：addTextBox 可能静默删除选中形状）
slide.shapes.load('items/$none');
await ctx.sync();
const countAfter = slide.shapes.items.length;
if (countAfter < countBefore) {
  throw new HostApiError('PPT addTextBox: 插入后 shape 数量减少，可能触发 #2775 bug', undefined);
}
const newShapeId = textbox.id as string;
```

**inverse `deleteShapeById`（按 ID 精确删除）：**
```typescript
// args: { slide_index, shape_id }
// 遍历 shapes.items.find(sh => sh.id === shape_id)，找到 → delete，找不到 → 静默（或 HostApiError）
```

---

### Pattern G：PPT copy_slide — slide.copy() + 双定位指纹

**Analog:** `src/adapters/PptAdapter.ts` lines 542–628 (`deleteSlideByTitle` 指纹定位范式)

**deleteSlideByTitle 指纹定位（可参考的核心结构）：**
```typescript
// src/adapters/PptAdapter.ts lines 555-625（deleteSlideByTitle）
// 范式：先 index 快路径 → 不匹配降级 title 指纹遍历 → 找不到 → HostApiError
```

**copy_slide 双定位（D-16 — capturedId 优先）：**
```typescript
// 参照 RESEARCH.md lines 738-751
// 写后：重 load slides，找 targetIndex 处的新 slide，load id
newSlide.load(['id', 'index']);
await ctx.sync();
const capturedId = newSlide.id as string;
const capturedIndex = newSlide.index as number;
// reverse.args = { capturedIndex, capturedId }
```

**inverse `deleteSlideByIndex`：**
```typescript
// args: { capturedIndex, capturedId }
// 实现：优先 slides.items.find(s => s.id === capturedId)
// 找不到 → 按 capturedIndex + title 指纹后备（deleteSlideByTitle 同范式）
// 都找不到 → throw HostApiError（replay engine 标 skipped_error，诚实告知）
```

---

### Pattern H：noop+gate（delete_shape / manage_slides / 快照超限降级）

**Analog:** `src/agent/operationLog.ts` lines 300–303 (`noop_inverse` case 已实现)

**ToolDef.execute 中构建 noop reverse：**
```typescript
// 正向照常执行删除操作，仅 reverse = noop_inverse
const reverse: ReverseDescriptor = {
  tool: 'noop_inverse',
  args: { reason: '形状完整状态（类型/填充/文字/字体）无法序列化重建，此步不可自动撤销' },
};
// operationLog.ts executeReverse（已实现，无需修改）：
// case 'noop_inverse':
//   throw new Error(`noop_inverse: 此操作不支持自动回滚（${String(reverse.args.reason ?? '')}）`);
//   // → replayUndoStep.catch → skipped_error → DiffLog「此步无法自动撤销」
```

**适用于：**
- `PPT-04` `delete_shape`：照常执行 shape.delete()，reverse = noop_inverse
- `PPT-06` `manage_slides(delete)`：照常执行 slide.delete()，reverse = noop_inverse
- `EXCEL-03/05` 超限降级：仍执行排序/替换，但 reverse 改为 noop_inverse + reason

---

### Pattern I：spike 门控（PPT-02/05/08 运行时降级）

**Analog：** 参照 RESEARCH.md §Pattern 4（D-10/D-11 指令）

**PPT-02 `set_shape_text_alignment`（spike S4 门控）：**
```typescript
// 参照 RESEARCH.md lines 558-569
try {
  shape.textFrame.textRange.paragraphFormat.load('alignment');
  await ctx.sync();
  const beforeAlignment = shape.textFrame.textRange.paragraphFormat.alignment as string;
  // happy-path：写入 + 返回 { beforeAlignment }
  shape.textFrame.textRange.paragraphFormat.alignment = alignment;
  await ctx.sync();
  return { beforeAlignment };
} catch {
  // spike 未通过：降级信号（ToolDef 收到 null 时构建 noop_inverse）
  return { beforeAlignment: null };
}
```

**ToolDef.execute 降级判断（适用于 PPT-02/05/08）：**
```typescript
const result = await adapter.setShapeTextAlignment(slide_index, shape_id, alignment);
if (result.beforeAlignment === null) {
  // 降级 noop+gate
  reverse = { tool: 'noop_inverse', args: { reason: 'paragraphFormat.alignment 不可读（spike S4 未通过）' } };
} else {
  // happy-path 简单逆向
  reverse = { tool: 'restore_shape_alignment', args: { slide_index, shape_id, before_alignment: result.beforeAlignment } };
}
```

---

### Pattern J：ToolDef 结构（excel.ts + ppt.ts 新工具范式）

**Analog 1（简单逆向）:** `src/agent/tools/write/excel.ts` lines 106–139 (`insertChart`) + lines 141–166 (`setCell`)

**insert_chart ToolDef（最接近 10 个新 Excel ToolDef 的模板）：**
```typescript
// src/agent/tools/write/excel.ts lines 106-139
export const insertChart: ToolDef<InsertChartArgs> = {
  name: 'insert_chart',
  kind: 'write',
  description: '...',
  parameters: { type: 'object', properties: { ... }, required: [...] },
  humanLabel: ({ data_range, chart_type }) => `...`,   // 必须是 function（assertWriteToolRegisterable 守门）
  async execute({ data_range, chart_type }, ctx): Promise<ToolResult> {
    const { chartName } = await (ctx.adapter as ExcelAdapter).insertChart(data_range, chart_type ?? 'ColumnClustered');
    const reverse: ReverseDescriptor = {
      tool: 'delete_chart_by_name',
      args: { chartName },          // Record 对象字面量，非位置参
    };
    const postState: PostStateSnapshot = {
      kind: 'excel_chart',          // 新工具用新 kind（D-21 保守 undefined）
      content: { chartName, dataRange: data_range, chartType: chart_type },
    };
    return { ok: true, data: { chartName }, reverse, postState };
  },
};
```

**Analog 2（noop+gate，参照 ppt.ts）：** `src/agent/tools/write/ppt.ts` lines 114–182 (`setShapeProperty`)（完整的 reverse Record 字面量 + postState 范式）

**新 PostStateSnapshot kind（D-21 保守路径）：**
```typescript
// operationLog.ts lines 34-37（现有 union，Phase 10 扩展）
// 现有：'word_paragraph' | 'excel_range' | 'excel_chart' | 'ppt_slide' | 'ppt_shape'
// 新增 kind 命名建议（planner 定具体名称）：
//   excel_range_format / excel_snapshot / excel_worksheet / excel_filter /
//   excel_conditional_format / excel_table / excel_freeze / excel_chart_title /
//   ppt_shape_font / ppt_shape_alignment / ppt_shape_rotation / ppt_slide_background
// readTargetState switch 不为新 kind 加 case → 走 default: return undefined（保守通过）
```

---

### Pattern K：operationLog.ts 接口 + executeReverse 扩展

**Analog:** `src/agent/operationLog.ts` lines 83–106 (接口) + lines 247–307 (executeReverse switch)

**接口扩展范式（紧接 line 105 `restoreParagraphAt` 之后追加）：**
```typescript
// 格式与现有方法声明完全一致（全部 optional + Record 签名 + JSDoc 注工具名）
/** Excel inverse：还原单元格格式（format_excel_range）*/
restoreRangeFormat?: (args: Record<string, unknown>) => Promise<void>;
/** Excel inverse：还原列宽/行高（set_column_row_size）*/
restoreColumnRowSize?: (args: Record<string, unknown>) => Promise<void>;
/** Excel inverse/snapshot：覆写 range values（sort_range / excel_find_and_replace）*/
restoreRangeValuesSnapshot?: (args: Record<string, unknown>) => Promise<void>;
/** Excel inverse：还原自动筛选（set_auto_filter）*/
restoreAutoFilter?: (args: Record<string, unknown>) => Promise<void>;
/** Excel inverse：还原条件格式（add_conditional_format）*/
restoreConditionalFormat?: (args: Record<string, unknown>) => Promise<void>;
/** Excel inverse：按名删除表格（create_table）*/
deleteTableByName?: (args: Record<string, unknown>) => Promise<void>;
/** Excel inverse：还原冻结窗格（freeze_panes）*/
restoreFreezePanes?: (args: Record<string, unknown>) => Promise<void>;
/** Excel inverse/snapshot：还原工作表元数据（manage_worksheet）*/
restoreWorksheetSnapshot?: (args: Record<string, unknown>) => Promise<void>;
/** Excel inverse：还原图表标题（set_chart_title）*/
restoreChartTitle?: (args: Record<string, unknown>) => Promise<void>;
/** PPT inverse：还原形状字体（set_shape_text_font）*/
restoreShapeFont?: (args: Record<string, unknown>) => Promise<void>;
/** PPT inverse：还原文字对齐（set_shape_text_alignment）*/
restoreShapeAlignment?: (args: Record<string, unknown>) => Promise<void>;
/** PPT inverse：按 ID 删除形状（add_shape）*/
deleteShapeById?: (args: Record<string, unknown>) => Promise<void>;
/** PPT inverse：还原形状旋转（rotate_shape）*/
restoreShapeRotation?: (args: Record<string, unknown>) => Promise<void>;
/** PPT inverse：还原幻灯片背景（set_slide_background）*/
restoreSlideBackground?: (args: Record<string, unknown>) => Promise<void>;
/** PPT inverse：按 index+ID 双定位删除复制的幻灯片（copy_slide）*/
deleteSlideByIndex?: (args: Record<string, unknown>) => Promise<void>;
```

**executeReverse case 扩展范式（复用 lines 294–299 格式，紧接 `restore_paragraph_at` 之后）：**
```typescript
// src/agent/operationLog.ts lines 294-299（模板 case）
case 'restore_paragraph_at':
  if (!adapter.restoreParagraphAt) {
    throw new Error(`adapter 未实现 restoreParagraphAt（tool=${reverse.tool}）`);
  }
  await adapter.restoreParagraphAt(reverse.args);
  break;

// Phase 10 追加 15 个 case，格式完全一致：
case 'restore_range_format':
  if (!adapter.restoreRangeFormat) {
    throw new Error(`adapter 未实现 restoreRangeFormat（tool=${reverse.tool}）`);
  }
  await adapter.restoreRangeFormat(reverse.args);
  break;
// ... 其余 14 个 case 同格式（case 字符串逐字 = CONTRACT reverse 名）
// noop_inverse case 已存在（line 300）——不重复添加
```

---

### Pattern L：operationLog.integration.test.ts 守门范式

**Analog:** `src/agent/operationLog.integration.test.ts` lines 193–217 (`deleteChartByName` 守门) + lines 249–277 (`restoreShapeProperty` 守门) + lines 283–311 (`restoreShapeText` 守门)

**简单逆向守门模板（mock adapter 模式）：**
```typescript
// src/agent/operationLog.integration.test.ts lines 193-217
it('单步撤销 insert_chart：deleteChartByName 收 Record 对象（不抛 TypeError）', async () => {
  const deleteChartByNameFn = vi.fn(async (_args: Record<string, unknown>): Promise<void> => {});
  const mockAdapter: DocumentAdapterForReplay = {
    deleteChartByName: deleteChartByNameFn,
  };

  const entry: OperationLogEntry = {
    runId: 'run-it',
    stepIndex: 0,
    toolName: 'insert_chart',            // ← D-17 硬卡：此字符串必须出现在本文件
    args: { data_range: 'A1:B10', chart_type: 'ColumnClustered' },
    humanLabel: '插入柱状图（A1:B10）',
    reverse: { tool: 'delete_chart_by_name', args: { chartName: '图表_run-it_0' } },
    postState: { kind: 'excel_chart', content: { chartName: '图表_run-it_0' } },
    timestamp: 0,
  };

  const detail = await replayUndoSingle(entry, mockAdapter);

  expect(detail.status).toBe('rolled_back');
  expect(deleteChartByNameFn).toHaveBeenCalledTimes(1);
  const receivedArgs = deleteChartByNameFn.mock.calls[0][0] as Record<string, unknown>;
  expect(typeof receivedArgs).toBe('object');
  expect(receivedArgs.chartName).toBe('图表_run-it_0');
});
```

**Phase 10 每个工具的守门用例必须：**
1. `vi.fn(async (_args: Record<string, unknown>): Promise<void> => {})` mock 签名
2. `toolName` 字段填对应工具名（字符串字面量，D-17 `fs.readFileSync` 硬卡扫描目标）
3. `reverse.tool` 逐字对齐 CONTRACT（参见硬约束 2 表格）
4. 断言 `detail.status === 'rolled_back'`
5. 断言 mock fn 被调用 1 次
6. 断言 `receivedArgs` 是 object + 验证关键字段值

**noop+gate 守门（额外断言 skipped_error）：**
```typescript
// 适用于 delete_shape / manage_slides / 快照超限降级
const entry = { ..., toolName: 'delete_shape', reverse: { tool: 'noop_inverse', args: { reason: '...' } } };
const detail = await replayUndoSingle(entry, mockAdapter);
expect(detail.status).toBe('skipped_error');   // noop_inverse → throw → skipped_error（非 rolled_back）
```

**D-20 共享 reverse 名双守门：**
```typescript
// sort_range 和 excel_find_and_replace 各需一条用例
// 两个 toolName 字符串都要出现在文件内（D-17 逐工具扫描）：
it('单步撤销 sort_range：...', async () => {
  // toolName: 'sort_range' ← 第一条
});
it('单步撤销 excel_find_and_replace：...', async () => {
  // toolName: 'excel_find_and_replace' ← 第二条
});
// 共用 reverse.tool: 'restore_range_values_snapshot'，但 toolName 字段不同
```

---

### Pattern M：tools/index.ts 注册

**Analog:** `src/agent/tools/index.ts` lines 206–212 (excel case) + lines 214–220 (ppt case)

```typescript
// src/agent/tools/index.ts lines 206-220
case 'excel': {
  const excelWriteTools = [setRangeValuesTool, applyFormula, insertChart, setCell] as ToolDef[];
  excelWriteTools.forEach(assertWriteToolRegisterable);
  return [
    listWorksheets, getRangeValues, getUsedRangeSummary,
    ...excelWriteTools, selectionDetail,
  ].map((t) => t as ToolDef);
}
case 'ppt': {
  const pptWriteTools = [insertSlide, setShapeProperty, moveShape, setShapeText] as ToolDef[];
  pptWriteTools.forEach(assertWriteToolRegisterable);
  return [
    listSlides, getSlide, listShapesOnSlide, getShape,
    ...pptWriteTools, selectionDetail,
  ].map((t) => t as ToolDef);
}
```

**Phase 10 适配：**
- `excelWriteTools` 数组追加 10 个新工具（`formatExcelRange, setColumnRowSize, sortRange, setAutoFilter, excelFindAndReplace, addConditionalFormat, createTable, freezePanes, manageWorksheet, setChartTitle`）
- `pptWriteTools` 数组追加 8 个新工具（`setShapeTextFont, setShapeTextAlignment, addShape, deleteShape, rotateShape, manageSlides, copySlide, setSlideBackground`）
- import 从对应 write 文件头部追加（`'./write/excel'` 和 `'./write/ppt'`）
- `assertWriteToolRegisterable` 守门自动覆盖所有新工具（每个 ToolDef 必须有 `humanLabel` function）

---

## Shared Patterns

### S1. Record 签名约束（D-18 — 数据安全硬门）

**Source:** `src/adapters/ExcelAdapter.ts` lines 349–361（JSDoc 注释）+ `src/adapters/PptAdapter.ts` lines 778–790（`⚠️ 签名必须是` JSDoc）

**Apply to:** 所有 15 个 inverse/snapshot adapter 方法 + 所有 18 个 ToolDef 的 `reverse.args`

历史教训（Phase 5 翻车，直接写在 ExcelAdapter/PptAdapter JSDoc 内）：位置签名收到对象时全部 undo 静默失败。

### S2. HostApiError 错误包装

**Source:** `src/adapters/ExcelAdapter.ts` lines 338–340, 417–419 + `src/adapters/PptAdapter.ts` lines 765–769, 866–869

**Apply to:** 所有 adapter 方法（write + inverse）

```typescript
// 外层 try/catch：内部 HostApiError 先 re-throw，陌生异常再包装
} catch (err) {
  if (err instanceof HostApiError) throw err;
  throw new HostApiError('Excel/PPT xxx 失败', err);
}
```

### S3. assertWriteToolRegisterable（注册守门）

**Source:** `src/agent/tools/index.ts` lines 207–208, 215–216

**Apply to:** 所有加入 excelWriteTools/pptWriteTools 数组的新 ToolDef

每个新 ToolDef 的 `humanLabel` 必须是 function（不能是 string），否则守门抛 Error。

### S4. D-17 四步守门（每工具完成时同时完成）

**Source:** `src/agent/contract.test.ts` lines 114–137

**Apply to:** 所有 18 个 Phase 10 工具

详见「硬约束 3」，缺任何一步 CI 立即挂。

### S5. A-06 约束：operationLog.ts 不引用 Office 命名空间

**Source:** `src/agent/operationLog.ts` lines 78–81（注释说明）

`executeReverse` switch 内只调用 adapter 方法，不直接引用 Excel/PowerPoint/Word 命名空间。

---

## Per-Tool Quick Reference

| 工具 | AdapterWrite 方法 | AdapterInverse 方法 | reverse.tool（逐字） | undo 类型 | 最近似 Analog |
|------|-------------------|---------------------|---------------------|-----------|--------------|
| EXCEL-01 format_excel_range | `formatExcelRange` | `restoreRangeFormat` | `restore_range_format` | 简单逆向 | `setRangeValues` + `overwriteRange` |
| EXCEL-02 set_column_row_size | `setColumnRowSize` | `restoreColumnRowSize` | `restore_column_row_size` | 简单逆向 | `setRangeValues` + `overwriteRange` |
| EXCEL-03 sort_range | `sortRange` | `restoreRangeValuesSnapshot` | `restore_range_values_snapshot` | 快照式 | Phase 9 find_and_replace |
| EXCEL-04 set_auto_filter | `setAutoFilter` | `restoreAutoFilter` | `restore_auto_filter` | 简单逆向 | `setRangeValues` + `overwriteRange` |
| EXCEL-05 excel_find_and_replace | `excelFindAndReplace` | `restoreRangeValuesSnapshot`（共享） | `restore_range_values_snapshot` | 快照式 | Phase 9 find_and_replace |
| EXCEL-06 add_conditional_format | `addConditionalFormat` | `restoreConditionalFormat` | `restore_conditional_format` | 简单逆向 | `insertChart` + `deleteChartByName` |
| EXCEL-07 create_table | `createTable` | `deleteTableByName` | `delete_table_by_name` | 简单逆向 | `insertChart` + `deleteChartByName` |
| EXCEL-08 freeze_panes | `freezePanes` | `restoreFreezePanes` | `restore_freeze_panes` | 简单逆向 | `setRangeValues` + `overwriteRange` |
| EXCEL-09 manage_worksheet | `manageWorksheet` | `restoreWorksheetSnapshot` | `restore_worksheet_snapshot` | 快照式（元数据） | Phase 9 find_and_replace（轻量版） |
| EXCEL-10 set_chart_title | `setChartTitle` | `restoreChartTitle` | `restore_chart_title` | 简单逆向 | `insertChart` + `deleteChartByName` |
| PPT-01 set_shape_text_font | `setShapeTextFont` | `restoreShapeFont` | `restore_shape_font` | 简单逆向 | `setShapeProperty` + `restoreShapeProperty` |
| PPT-02 set_shape_text_alignment | `setShapeTextAlignment` | `restoreShapeAlignment` | `restore_shape_alignment` | 简单逆向(spike S4) | `setShapeText` + `restoreShapeText` |
| PPT-03 add_shape | `addShape` | `deleteShapeById` | `delete_shape_by_id` | 简单逆向 | `insertSlideAfter`（captureId）+ `deleteSlideByTitle`（ID 定位） |
| PPT-04 delete_shape | `deleteShape` | — | `noop_inverse` | noop+gate | `noop_inverse` case（operationLog.ts line 300） |
| PPT-05 rotate_shape | `rotateShape` | `restoreShapeRotation` | `restore_shape_rotation` | 简单逆向(spike S1) | `setShapeProperty` + `restoreShapeProperty` |
| PPT-06 manage_slides | `manageSlides` | — | `noop_inverse` | noop+gate | `noop_inverse` case（operationLog.ts line 300） |
| PPT-07 copy_slide | `copySlide` | `deleteSlideByIndex` | `delete_slide_by_index` | 简单逆向 | `insertSlideAfter` + `deleteSlideByTitle`（改为 ID 优先） |
| PPT-08 set_slide_background | `setSlideBackground` | `restoreSlideBackground` | `restore_slide_background` | 简单逆向(spike S2) | `setShapeProperty` + `restoreShapeProperty` |

---

## No Analog Found

无。所有 18 工具在本 codebase 中都有同文件内的直接范式可复用。

---

## Metadata

**Analog search scope:** `src/adapters/ExcelAdapter.ts`（20.9KB）、`src/adapters/PptAdapter.ts`（43KB）、`src/agent/operationLog.ts`（14.8KB）、`src/agent/tools/write/excel.ts`（6.4KB）、`src/agent/tools/write/ppt.ts`（11.3KB）、`src/agent/operationLog.integration.test.ts`（14KB）、`src/agent/contract.test.ts`、`src/agent/tools/index.ts`

**Files scanned:** 8 source files + Phase 9 PATTERNS.md（结构参照）

**Pattern extraction date:** 2026-05-31

**Critical path note:** D-18 Record 签名约束是本 phase 最重要的横切约束——Phase 5 真机 UAT 历史翻车点。本 phase 新增 15 个 inverse 方法，任何一个签名偏离 `(args: Record<string, unknown>)` 约束都会导致该工具 undo 路径静默失败（skipped_error 而非 rolled_back）。integration test 是唯一能在真机前守住这条路径的防线，每工具必须补。
