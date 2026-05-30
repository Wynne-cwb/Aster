# Phase 6: 多宿主 Write Tools + Killer Scenarios 重写 — Pattern Map

**Mapped:** 2026-05-30
**Files analyzed:** 15 (new/modified files)
**Analogs found:** 15 / 15

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/agent/tools/write/excel.ts` | tool (write) | CRUD + before-image | `src/agent/tools/write/excel.ts` L30-64 (setRangeValues) | exact — same file, extend pattern |
| `src/agent/tools/write/ppt.ts` | tool (write) | CRUD + before-image | `src/agent/tools/write/ppt.ts` L30-66 (insertSlide) | exact — same file, extend pattern |
| `src/agent/tools/write/word.ts` | tool (write) | CRUD + before-image | `src/agent/tools/write/word.ts` L23-52 (appendParagraph) | exact — same file, extend pattern |
| `src/adapters/ExcelAdapter.ts` | adapter (write methods) | CRUD + before-image | `src/adapters/ExcelAdapter.ts` L309-368 (setRangeValues + overwriteRange) | exact — same file, extend pattern |
| `src/adapters/PptAdapter.ts` | adapter (write methods) | CRUD + before-image | `src/adapters/PptAdapter.ts` L475-618 (insertSlideAfter + deleteSlideByTitle) | exact — same file, extend pattern |
| `src/adapters/WordAdapter.ts` | adapter (write methods) | CRUD + before-image | `src/adapters/WordAdapter.ts` L138-227 (appendParagraph + deleteParagraphByContent + readWordParagraph) | exact — same file, extend pattern |
| `src/agent/tools/index.ts` | registry | request-response | `src/agent/tools/index.ts` L193-222 (buildToolsForHost) | exact — same file, add imports + array entries |
| `src/agent/system-prompt.ts` | utility (string builder) | transform | `src/agent/system-prompt.ts` L26-45 | exact — same file, rewrite function body |
| `src/components/ChatStream.tsx` | component | event-driven | `src/components/ChatStream.tsx` L299-313 (empty-state block) | exact — same file, fill D-03 placeholder |
| `src/components/Onboarding/OnboardingModal.tsx` | component | request-response | `src/components/Onboarding/OnboardingModal.tsx` L27-64 | exact — same file, remove step state |
| `src/components/Onboarding/Step1Keys.tsx` | component | request-response | `src/components/Onboarding/Step1Keys.tsx` L25-118 | exact — same file, rename prop + add storage write |
| `src/components/Onboarding/Step2Guide.tsx` | component | — | N/A (DELETE entire file) | — |
| `manifest.xml` | config | — | `manifest.xml` L69-87 (PPT ShowTaskpane block — already single button) | exact — already the target shape, replicate for Excel/Word |
| `src/agent/tools/write/excel.test.ts` | test | — | `src/agent/operationLog.integration.test.ts` L154-174 (ExcelAdapter inverse mock pattern) | role-match |
| `src/agent/tools/write/ppt.test.ts` | test | — | `src/adapters/PptAdapter.test.ts` L28-77 (mock PPT + assert) | role-match |
| `src/agent/tools/write/word.test.ts` | test | — | `src/agent/operationLog.integration.test.ts` L119-147 (Word inverse integration) | role-match |
| `src/components/ChatStream.test.tsx` | test | — | `src/agent/system-prompt.test.ts` (host-parameterized it.each pattern) | role-match |
| `src/components/Onboarding/OnboardingModal.test.tsx` | test | — | `src/agent/system-prompt.test.ts` (simple describe/it/expect pattern) | role-match |
| `src/agent/system-prompt.test.ts` | test | — | `src/agent/system-prompt.test.ts` L1-52 | exact — same file, extend assertions |

---

## Pattern Assignments

### `src/agent/tools/write/excel.ts` — 新增 `apply_formula`, `insert_chart`, `set_cell`

**Analog:** `src/agent/tools/write/excel.ts` (setRangeValues, lines 30-64)

**Imports pattern** (lines 21-23):
```typescript
import type { ToolDef, ToolResult } from '../index';
import type { ReverseDescriptor, PostStateSnapshot } from '../../operationLog';
import type { ExcelAdapter } from '../../../adapters/ExcelAdapter';
```

**Core ToolDef pattern** (lines 30-64) — copy exact structure for each new tool:
```typescript
// setRangeValues 是完整模板，3 个新 tool 照此结构
export const setRangeValues: ToolDef<SetRangeValuesArgs> = {
  name: 'set_range_values',
  kind: 'write',                          // ← 必须，触发 assertWriteToolRegisterable 守门
  description: '向 Excel 指定区域写入二维数组。自动抓取写前快照支持撤销。',
  parameters: { type: 'object', properties: { ... }, required: [...] },
  humanLabel: ({ address }) => `写入单元格区域 ${address}`,  // ← 必须，中文，动词+对象+参数
  async execute({ address, values }, ctx): Promise<ToolResult> {
    // A-06：通过 ctx.adapter 调用，不直接引用 Excel 命名空间
    const { beforeImage } = await (ctx.adapter as ExcelAdapter).setRangeValues(address, values);
    const reverse: ReverseDescriptor = {
      tool: 'overwrite_range',
      args: { address: beforeImage.address, values: beforeImage.values },  // Record 对象，非位置参
    };
    const postState: PostStateSnapshot = {
      kind: 'excel_range',
      content: { address, values },
    };
    console.assert(reverse !== undefined, 'TOOL-04: reverse required');
    return { ok: true, data: { ... }, reverse, postState };
  },
};
```

**insert_chart 专用 reverse 结构** (RESEARCH.md lines 551-584):
```typescript
// insert_chart：reverse 句柄用 chart.name（非 before-image 覆写）
return { ok: true, data: { chartName }, mutated: { chartName }, reverse, postState };
// reverse:
const reverse: ReverseDescriptor = {
  tool: 'delete_chart_by_name',
  args: { chartName },   // ← Record<string, unknown>，chartName 来自 adapter 返回
};
const postState: PostStateSnapshot = {
  kind: 'excel_chart',
  content: { chartName, dataRange: data_range, chartType: chart_type },
};
```

**humanLabel 范例**（参照 UI-SPEC lines 221-227）:
```typescript
humanLabel: ({ data_range, chart_type }) =>
  `在当前工作表插入${chart_type === 'Bar' ? '条形图' : chart_type === 'Line' ? '折线图' : chart_type === 'Pie' ? '饼图' : '柱状图'}（数据 ${data_range}）`,

humanLabel: ({ cell, formula }) => `在 ${cell} 单元格写入公式 ${formula}`,

humanLabel: ({ cell, value }) => `将单元格 ${cell} 设为 ${String(value).slice(0, 20)}`,
```

---

### `src/agent/tools/write/ppt.ts` — 新增 `set_shape_property`, `move_shape`

**Analog:** `src/agent/tools/write/ppt.ts` (insertSlide, lines 30-66)

**Core ToolDef pattern** (lines 43-65):
```typescript
export const insertSlide: ToolDef<InsertSlideArgs> = {
  name: 'insert_slide',
  kind: 'write',
  description: '在 PPT 末尾插入新幻灯片。title 用于撤销定位。',
  parameters: { ... },
  humanLabel: ({ title }) =>
    `在幻灯片末尾插入新幻灯片「${title.slice(0, 20)}${title.length > 20 ? '…' : ''}」`,
  async execute(args, ctx): Promise<ToolResult> {
    const { afterIndex, title } = args;
    // A-06：通过 ctx.adapter 调用，不直接引用 PowerPoint 命名空间
    const { insertedIndex } = await (ctx.adapter as PptAdapter).insertSlideAfter(
      afterIndex ?? -1,
      title,
    );
    const reverse: ReverseDescriptor = {
      tool: 'delete_slide_by_title',
      args: { titleFingerprint: title },   // ← args 是 Record 对象
    };
    const postState: PostStateSnapshot = {
      kind: 'ppt_slide',
      content: { index: insertedIndex, title },
    };
    console.assert(reverse !== undefined, 'TOOL-04: reverse required');
    return { ok: true, data: { insertedIndex, title }, reverse, postState };
  },
};
```

**set_shape_property reverse 结构** (RESEARCH.md lines 587-609):
```typescript
// before-image 来自 adapter.setShapeProperty() 返回值
// reverse 包含完整 before-image 用于还原
const reverse: ReverseDescriptor = {
  tool: 'restore_shape_property',
  args: {
    slide_index,
    shape_id,
    // 全量 before-image（fill/line/width/height）
    fill_type: beforeImage.fillType,
    fill_color: beforeImage.fillColor,
    line_color: beforeImage.lineColor,
    line_weight: beforeImage.lineWeight,
    line_visible: beforeImage.lineVisible,
    width: beforeImage.width,
    height: beforeImage.height,
  },  // ← Record 对象，非位置参
};
const postState: PostStateSnapshot = {
  kind: 'ppt_shape',
  content: { slide_index, shape_id, ...appliedProps },
};
```

**humanLabel 范例**（UI-SPEC lines 221-224）:
```typescript
humanLabel: ({ slide_index, shape_id, line_color }) =>
  `将第 ${slide_index} 张幻灯片的形状「${shape_id}」边框颜色改为 ${line_color ?? '默认'}`,

humanLabel: ({ shape_id, left, top }) =>
  `将形状「${shape_id}」移动到 left=${left} top=${top}`,
```

---

### `src/agent/tools/write/word.ts` — 新增 `insert_paragraph`, `replace_paragraph`, `insert_text_at_cursor`, `replace_selection`

**Analog:** `src/agent/tools/write/word.ts` (appendParagraph, lines 23-52)

**Core ToolDef pattern** (lines 23-52):
```typescript
const HUMAN_LABEL_TEXT_CAP = 30;

export const appendParagraph: ToolDef<AppendParagraphArgs> = {
  name: 'append_paragraph',
  kind: 'write',
  description: '在 Word 文档末尾追加一段文本。优先一次回复里调多次，而不是合并成一个大段。',
  parameters: { type: 'object', properties: { text: { type: 'string', ... } }, required: ['text'] },
  humanLabel: ({ text }) =>
    `在文档末尾追加段落「${text.slice(0, HUMAN_LABEL_TEXT_CAP)}${
      text.length > HUMAN_LABEL_TEXT_CAP ? '…' : ''
    }」`,
  async execute({ text }, ctx): Promise<ToolResult> {
    // A-06：adapter method 输入 string、输出 Promise<void>；不返 proxy
    await (ctx.adapter as WordAdapter).appendParagraph(text);
    const reverse: ReverseDescriptor = {
      tool: 'delete_paragraph_by_content',
      args: { text },   // ← Record 对象，非位置参（Phase 5 UAT 最严重 bug 来源）
    };
    const postState = { kind: 'word_paragraph' as const, content: text };
    return { ok: true, data: { written: text.length }, reverse, postState };
  },
};
```

**replace_paragraph reverse 结构（before-image 模式）**:
```typescript
// before-image = 目标段的原文；inverse = 用 replaceParagraphAt 还原
const reverse: ReverseDescriptor = {
  tool: 'restore_paragraph_at',
  args: {
    index,
    expectedText: newText,   // 当前（替换后）的文本，用于定位
    restoreText: beforeImage, // before-image 原文，用于还原
  },  // ← 全 Record 对象
};
// D-11 expected_state：高风险写，支持可选 expected_state
// execute 开头检查 expected_state 与当前段落是否一致，不一致返 INVALID_ARGS error
```

**humanLabel 范例**（UI-SPEC lines 221-227）:
```typescript
humanLabel: ({ index, text }) =>
  `将第 ${Number(index) + 1} 段替换为「${String(text).slice(0, 30)}…」`,

humanLabel: ({ text }) =>
  `在光标处插入文本「${String(text).slice(0, HUMAN_LABEL_TEXT_CAP)}…」`,

humanLabel: ({ text }) =>
  `将选中内容替换为「${String(text).slice(0, HUMAN_LABEL_TEXT_CAP)}…」`,
```

---

### `src/adapters/ExcelAdapter.ts` — 新增 `insertChart`, `deleteChartByName`, `applyFormula`, `setCell`

**Analog:** `src/adapters/ExcelAdapter.ts` (setRangeValues lines 309-334 + overwriteRange lines 355-368)

**setRangeValues — before-image two-sync 范式** (lines 309-334):
```typescript
async setRangeValues(
  address: string,
  values: unknown[][],
): Promise<{ beforeImage: { address: string; values: unknown[][] } }> {
  try {
    return await Excel.run(async (ctx) => {
      const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
      // sync 1：load before-image（NFR-02 two-sync 规则）
      range.load(['values', 'address']);
      await ctx.sync();
      const beforeImage = { address: range.address as string, values: range.values as unknown[][] };
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

**overwriteRange — inverse 方法 Record 签名** (lines 355-368):
```typescript
// ⚠️ 关键：签名必须是 args: Record<string, unknown>，不能是位置参
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

**insertChart 完整实现** (RESEARCH.md lines 255-288):
```typescript
async insertChart(
  dataRange: string,
  chartType: string,
): Promise<{ chartName: string }> {
  return await Excel.run(async (ctx) => {
    const sheet = ctx.workbook.worksheets.getActiveWorksheet();
    const range = sheet.getRange(dataRange);
    const chart = sheet.charts.add(
      chartType as Excel.ChartType,
      range,
      Excel.ChartSeriesBy.auto,
    );
    chart.load(['name']);
    await ctx.sync();
    return { chartName: chart.name as string };
  });
}

// inverse — 同样用 Record 对象签名
async deleteChartByName(args: Record<string, unknown>): Promise<void> {
  const chartName = args.chartName as string;
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
}
```

**applyFormula / setCell — before-image 单单元格模式**（仿 setRangeValues，address = 单格如 "B2"）:
```typescript
// applyFormula：单格 formula 写入，before-image = 当前 values + address
// setCell：单格 value 写入，与 applyFormula 结构相同，reverse 都是 overwriteRange
async applyFormula(
  cell: string,
  formula: string,
): Promise<{ beforeImage: { address: string; values: unknown[][] } }> {
  try {
    return await Excel.run(async (ctx) => {
      const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(cell);
      range.load(['values', 'address', 'formulas']);
      await ctx.sync();
      const beforeImage = { address: range.address as string, values: range.values as unknown[][] };
      range.formulas = [[formula]];
      await ctx.sync();
      return { beforeImage };
    });
  } catch (err) {
    throw new HostApiError('Excel applyFormula 失败', err);
  }
}
```

---

### `src/adapters/PptAdapter.ts` — 新增 `setShapeProperty`, `restoreShapeProperty`, `moveShape`, `restoreShapeGeometry`

**Analog:** `src/adapters/PptAdapter.ts` (insertSlideAfter lines 475-517 + deleteSlideByTitle lines 543-618)

**deleteSlideByTitle — inverse Record 签名范式** (lines 543-545):
```typescript
// ⚠️ 关键：args: Record<string, unknown>，然后内部解构
async deleteSlideByTitle(args: Record<string, unknown>): Promise<void> {
  const titleFingerprint = args.titleFingerprint as string;
  // ... PowerPoint.run 内部实现
}
```

**PPT PowerPoint.run + before-image 范式** (lines 481-514):
```typescript
async insertSlideAfter(_afterIndex: number, title?: string): Promise<{ insertedIndex: number; title: string }> {
  try {
    return await PowerPoint.run(async (ctx) => {
      const slides = ctx.presentation.slides;
      slides.load('items');
      await ctx.sync(); // sync 1: 记录 before-state

      // ... mutation ...

      await ctx.sync(); // sync 2: 写入生效
      return { /* 仅返纯数据，不返 proxy */ };
    });
  } catch (err) {
    throw new HostApiError('PPT insertSlideAfter 失败', err);
  }
}
```

**setShapeProperty 三 sync 范式** (根据 RESEARCH.md PPT Shape API 章节):
```typescript
async setShapeProperty(
  slideIndex: number,
  shapeId: string,
  props: { fillColor?: string; lineColor?: string; lineWeight?: number; width?: number; height?: number },
  expectedState?: { fillColor?: string; lineColor?: string },
): Promise<{ beforeImage: { fillType: string; fillColor: string; lineColor: string; lineWeight: number; lineVisible: boolean; width: number; height: number } }> {
  try {
    return await PowerPoint.run(async (ctx) => {
      const slides = ctx.presentation.slides;
      slides.load('items');
      await ctx.sync(); // sync 1: load slides

      // bounds check（仿 get_shape read 范式 lines 370-400）
      const idx = slideIndex - 1;
      if (idx < 0 || idx >= slides.items.length) throw new HostApiError('...', undefined);

      const slide = slides.items[idx];
      slide.shapes.load('items/id,items/type,items/left,items/top,items/width,items/height');
      await ctx.sync(); // sync 2: load shapes

      const shape = slide.shapes.items.find((sh: { id: string }) => sh.id === shapeId);
      if (!shape) throw new HostApiError(`形状 ${shapeId} 不存在`, undefined);

      // load before-image（fill + line + geometry）
      shape.fill.load(['type', 'foregroundColor']);
      shape.lineFormat.load(['color', 'weight', 'visible']);
      await ctx.sync(); // sync 3: load before-image

      const beforeImage = {
        fillType: shape.fill.type as string,
        fillColor: shape.fill.foregroundColor as string,
        lineColor: shape.lineFormat.color as string,
        lineWeight: shape.lineFormat.weight as number,
        lineVisible: shape.lineFormat.visible as boolean,
        width: shape.width as number,
        height: shape.height as number,
      };

      // D-11 expected_state 并发防御（RESEARCH.md Pitfall 2 null guard）
      if (expectedState?.fillColor && beforeImage.fillColor !== expectedState.fillColor) {
        throw new HostApiError('并发修改冲突：fill_color 已被外部改变', undefined);
      }

      // 应用属性（RESEARCH.md PPT Shape API）
      if (props.fillColor !== undefined) shape.fill.setSolidColor(props.fillColor);
      if (props.lineColor !== undefined) shape.lineFormat.color = props.lineColor;
      if (props.lineWeight !== undefined) shape.lineFormat.weight = props.lineWeight;
      if (props.lineColor !== undefined || props.lineWeight !== undefined) shape.lineFormat.visible = true;
      if (props.width !== undefined) shape.width = props.width;
      if (props.height !== undefined) shape.height = props.height;
      await ctx.sync(); // sync 4: 写入生效

      return { beforeImage };
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('PPT setShapeProperty 失败', err);
  }
}

// inverse — Record 对象签名（必须，MEMORY[[project-adapter-inverse-signature]]）
async restoreShapeProperty(args: Record<string, unknown>): Promise<void> {
  const { slide_index, shape_id, fill_type, fill_color, line_color, line_weight, line_visible, width, height } = args as Record<string, unknown>;
  // ... PowerPoint.run 内部还原逻辑
  // fill_type === 'NoFill' 时用 shape.fill.clear()；否则 shape.fill.setSolidColor(fill_color as string)
}
```

---

### `src/adapters/WordAdapter.ts` — 新增 `insertParagraphAt`, `replaceParagraphAt`, `restoreParagraphAt`, `insertTextAtCursor`, `replaceSelection`, `readParagraphAt`

**Analog:** `src/adapters/WordAdapter.ts`
- appendParagraph (lines 138-147) — write pattern
- deleteParagraphByContent (lines 168-191) — inverse Record 签名 + normalizeText pattern
- readWordParagraph (lines 207-227) — read-for-consistency Record 签名 pattern

**⚠️ 项目地雷（MEMORY[[project-adapter-inverse-signature]]）— 必须照抄这个签名：**
```typescript
// 正确：args: Record<string, unknown>，内部解构
async deleteParagraphByContent(args: Record<string, unknown>): Promise<void> {
  const text = args.text as string;   // ← 内部解构，不是函数参数位置
  // ...
}

// 错误（Phase 5 UAT 最严重 bug 来源，已修复但需防止复发）：
// async deleteParagraphByContent(text: string): Promise<void> {  ← 位置参，replay 传对象会挂
```

**paragraph 遍历 + normalizeText 范式** (lines 168-191):
```typescript
async deleteParagraphByContent(args: Record<string, unknown>): Promise<void> {
  const text = args.text as string;
  try {
    await Word.run(async (ctx) => {
      const paras = ctx.document.body.paragraphs;
      paras.load('items/text');
      await ctx.sync();

      const normalTarget = normalizeText(text);  // ← 必须 normalizeText（\r\n 处理）
      for (let i = paras.items.length - 1; i >= 0; i--) {  // ← 从尾到头（删最近的同名段）
        if (normalizeText(paras.items[i].text) === normalTarget) {
          paras.items[i].delete();
          await ctx.sync();
          return;
        }
      }
      throw new HostApiError('Word deleteParagraphByContent: 目标段落已不存在', undefined);
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('Word deleteParagraphByContent 失败', err);
  }
}
```

**readWordParagraph — 一致性检查 Record 签名** (lines 207-227):
```typescript
// read 方法同样必须用 Record 对象签名（供 operationLog.readTargetState 调用）
async readWordParagraph(args: Record<string, unknown>): Promise<string> {
  const text = args.text as string;
  // ... Word.run 找到返段落文本，找不到返 ''
}
```

**replaceParagraphAt — index + before-image 范式** (新，依据 RESEARCH.md lines 403-409):
```typescript
async replaceParagraphAt(
  index: number,
  newText: string,
  expectedText?: string,   // D-11 expected_state 可选并发防御
): Promise<{ beforeImage: string }> {
  try {
    return await Word.run(async (ctx) => {
      const paras = ctx.document.body.paragraphs;
      paras.load('items/text');
      await ctx.sync();

      if (index < 0 || index >= paras.items.length) {
        throw new HostApiError(`段落 index=${index} 不存在`, undefined);
      }

      const currentText = normalizeText(paras.items[index].text);
      // D-11 expected_state 并发防御
      if (expectedText && normalizeText(expectedText) !== currentText) {
        throw new HostApiError('并发修改冲突：目标段落已被外部改变', undefined);
      }

      const beforeImage = paras.items[index].text as string;
      paras.items[index].insertText(newText, Word.InsertLocation.replace);
      await ctx.sync();
      return { beforeImage };
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('Word replaceParagraphAt 失败', err);
  }
}

// inverse — Record 签名（必须）
async restoreParagraphAt(args: Record<string, unknown>): Promise<void> {
  const index = args.index as number;
  const restoreText = args.restoreText as string;
  const expectedText = args.expectedText as string;  // 替换后的新文本，用于定位
  // 先用 expectedText 找到段落（比 index 更健壮），再用 insertText.replace 还原
  // 如果 index 精确定位失败，降级用 normalizeText 搜索 expectedText 定位
}
```

---

### `src/agent/tools/index.ts` — 注册新 write tools

**Analog:** `src/agent/tools/index.ts` (buildToolsForHost, lines 193-222)

**Imports pattern** (lines 12-18):
```typescript
// 新工具 import 按宿主分组，照此模式追加
import { appendParagraph } from './write/word';
import { insertSlide } from './write/ppt';
import { setRangeValues as setRangeValuesTool } from './write/excel';
// Phase 6 新增（照此模式）：
// import { insertParagraph, replaceParagraph, insertTextAtCursor, replaceSelection } from './write/word';
// import { setShapeProperty, moveShape } from './write/ppt';
// import { applyFormula, insertChart, setCell } from './write/excel';
```

**buildToolsForHost 扩展模式** (lines 193-222):
```typescript
export function buildToolsForHost(host: 'word' | 'excel' | 'ppt'): ToolDef[] {
  switch (host) {
    case 'word': {
      // 当前：[appendParagraph]
      // Phase 6：[appendParagraph, insertParagraph, replaceParagraph, insertTextAtCursor, replaceSelection]
      const wordWriteTools = [appendParagraph] as ToolDef[];
      wordWriteTools.forEach(assertWriteToolRegisterable);  // ← 必须，lint 守门
      return [
        getDocumentFullText, getParagraphCount, getParagraphAt, getDocumentOutline,
        ...wordWriteTools, selectionDetail,
      ].map((t) => t as ToolDef);
    }
    case 'excel': {
      // Phase 6：[setRangeValuesTool, applyFormula, insertChart, setCell]
      const excelWriteTools = [setRangeValuesTool] as ToolDef[];
      excelWriteTools.forEach(assertWriteToolRegisterable);
      return [ listWorksheets, getRangeValues, getUsedRangeSummary, ...excelWriteTools, selectionDetail ].map((t) => t as ToolDef);
    }
    case 'ppt': {
      // Phase 6：[insertSlide, setShapeProperty, moveShape]
      const pptWriteTools = [insertSlide] as ToolDef[];
      pptWriteTools.forEach(assertWriteToolRegisterable);
      return [ listSlides, getSlide, listShapesOnSlide, getShape, ...pptWriteTools, selectionDetail ].map((t) => t as ToolDef);
    }
  }
}
```

---

### `src/agent/system-prompt.ts` — 重写为共享+专属结构

**Analog:** `src/agent/system-prompt.ts` (全文 lines 1-45)

**日期注入模式**（保留，lines 30-33）:
```typescript
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
```

**函数签名不变**（调用方不需改，lines 26）:
```typescript
export function buildSystemPrompt(host: HostKey): string {
  // Phase 6 重写 body：shared + domain，但签名完全不变
}
```

**Phase 6 目标结构** (RESEARCH.md lines 614-633):
```typescript
// 删除的内容：「你通过用户授权的 API Key 直接调 LLM，没有后台服务器」（D-07）
// 新增的内容：per-host getDomainSegment(host) 专属段
export function buildSystemPrompt(host: HostKey): string {
  const today = ...; // 保留现有日期逻辑
  return `${SHARED_BASE(today)}\n\n${getDomainSegment(host)}`;
}

function SHARED_BASE(today: string): string {
  return `你是 Aster —— 嵌在 Microsoft Office 里的 AI 代理。
现在是 ${today}（用户本地时间）。凡涉及时间的计算，以此为"现在"，不要自行假设年份。
...`; // batch 倾向 + evidence/instruction 区分 + self-verify + 全中文
}

function getDomainSegment(host: HostKey): string {
  switch (host) {
    case 'ppt': return `[PPT 专属 5-8 行（RESEARCH.md lines 458-466）]`;
    case 'excel': return `[Excel 专属 5-8 行（RESEARCH.md lines 470-480）]`;
    case 'word': return `[Word 专属 5-8 行（RESEARCH.md lines 484-494）]`;
  }
}
```

---

### `src/components/ChatStream.tsx` — 填充 D-03 钩子 + host-specific chips

**Analog:** `src/components/ChatStream.tsx` (empty-state block, lines 299-313)

**D-03 钩子精确位置**（line 311）:
```tsx
// 当前：
{/* D-03：不渲染 suggestion chips，等 Phase 6 */}

// Phase 6 替换为：
const host = adapter.capabilities().host;
// CHIPS 数据（UI-SPEC lines 150-163）+ handleChipClick（RESEARCH.md lines 659-663）
```

**现有 imports 中 useAdapter 已可用**（line 38）:
```tsx
import { useAdapter } from '../context/AdapterContext';
// adapter 变量：line 260
const adapter = useAdapter();
```

**chip UI 结构**（UI-SPEC lines 125-145）:
```tsx
// 复用现有 .btn .btn-ghost .btn-sm 类（不造新类）
<div className="suggestions">
  {chips.map((chip) => (
    <button
      key={chip.seed}
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={() => handleChipClick(chip.seed)}
    >
      {/* 可加 leftIcon + label + 右侧 arrowRight icon，UI-SPEC Deliverable 1 */}
      {chip.label}
    </button>
  ))}
</div>
```

**InputBar 填充模式** — 需要找 `setInputValue` 相关 setter（InputBar 受控值）。暂时检查：
```tsx
// D-16：chip 点击只填充，不自动 send
// InputBar 的 value setter 已存在于 chatStore 或 InputBar 本地 state
// 模式：useChatStore((s) => s.setDraft) 或类似受控 setter
// Planner 实现时确认 InputBar 受控值的 setter 名称
```

**空态 p 文案更新**（UI-SPEC Copywriting, line 241）:
```tsx
// 当前：「选中文档里的内容，告诉 Aster 你想做什么。」
// Phase 6 改为：「选中文档里的内容，或挑一个下面的例子开始。」
<p><Trans>选中文档里的内容，或挑一个下面的例子开始。</Trans></p>
```

---

### `src/components/Onboarding/OnboardingModal.tsx` — 删 step state，单步化

**Analog:** `src/components/Onboarding/OnboardingModal.tsx` (全文 lines 27-64)

**删除的内容**（对应 UI-SPEC Deliverable 2）:
```tsx
// 删除：
const [step, setStep] = useState<1 | 2>(1);    // ← 删
function goNext(): void { setStep(2); }          // ← 删
function goBack(): void { setStep(1); }          // ← 删
import Step2Guide from './Step2Guide';            // ← 删
<span className="brand-step">{step === 1 ? '01' : '02'} / 02</span>  // ← 删，单步无计数器
// step 条件渲染整块 → 删，直接渲染 <Step1Keys>
```

**保留的结构**（UI-SPEC line 197）:
```tsx
// 保留：modal-scrim + modal + modal-brand 骨架不变
return (
  <div className="modal-scrim" role="dialog" aria-modal="true" aria-labelledby="onb-modal-title">
    <div className="modal">
      <div className="modal-brand">
        <img src={logo} alt="Aster" style={{ width: 22, height: 22 }} />
        <span className="brand-name">Aster</span>
        {/* brand-step 删掉，单步无计数 */}
      </div>
      {/* 直接渲染 Step1Keys，onNext → onComplete */}
      <Step1Keys onComplete={onComplete} onSkip={handleSkip} />
    </div>
  </div>
);
```

**storage 写入时机迁移**（UI-SPEC lines 176-186）:
```tsx
// 当前：handleSkip 写 storage（line 36），handleComplete 在 Step2Guide 里写
// Phase 6：Step1Keys.handleComplete 写（Step2Guide 删了），OnboardingModal 的 handleSkip 写不变
// handleSkip 仍在 OnboardingModal 里
function handleSkip(): void {
  storage.set(STORAGE_KEYS.ONBOARDING_SEEN, true);  // ← 保留
  onSkip();
}
```

---

### `src/components/Onboarding/Step1Keys.tsx` — onNext→onComplete + 写 storage + CTA 文案

**Analog:** `src/components/Onboarding/Step1Keys.tsx` (全文 lines 25-118)

**props 接口变更**（UI-SPEC lines 183-185）:
```tsx
// 当前：
interface Step1KeysProps {
  onNext: () => void;
  onSkip: () => void;
}
// Phase 6：
interface Step1KeysProps {
  onComplete: () => void;  // ← onNext → onComplete
  onSkip: () => void;      // ← 不变
}
```

**handleNext → handleComplete 变更**（lines 32-37）:
```tsx
// 当前：
function handleNext(): void {
  setKey('deepseek', dsKey);
  setKey('aihubmix', ahmKey);
  onNext();        // ← 改为 onComplete
}
// Phase 6：
function handleComplete(): void {
  setKey('deepseek', dsKey);
  setKey('aihubmix', ahmKey);
  storage.set(STORAGE_KEYS.ONBOARDING_SEEN, true);  // ← 从 Step2Guide 迁移过来
  onComplete();
}
```

**CTA 文案变更**（UI-SPEC Copywriting line 236, lines 109-115）:
```tsx
// 当前 primary CTA（line 113）：
<button className="btn btn-primary btn-sm" onClick={handleNext}>
  <Trans>下一步</Trans>   // ← 改为
</button>
// Phase 6：
<button className="btn btn-primary btn-sm" onClick={handleComplete}>
  <Trans>开始使用</Trans>
</button>
```

**modal-sub 文案变更**（UI-SPEC Copywriting line 237，lines 44-46）:
```tsx
// 当前：「Aster 需要您提供自己的 API Key，Key 仅存储在您的浏览器本地。」
// Phase 6：「Aster 是嵌在 Office 里的 AI 代理 —— 填入你自己的 API Key 就能开始。Key 只存在你的浏览器本地。」
<p className="modal-sub">
  <Trans>Aster 是嵌在 Office 里的 AI 代理 —— 填入你自己的 API Key 就能开始。Key 只存在你的浏览器本地。</Trans>
</p>
```

**需要新增 import**:
```tsx
import { storage, STORAGE_KEYS } from '../../lib/storage';  // ← 从 Step2Guide 迁移 import
```

---

### `manifest.xml` — 三宿主各删多余按钮，已经是单按钮（D-17 现状确认）

**Analog:** `manifest.xml` lines 69-87 (PPT ShowTaskpane block — 已是单按钮目标形态)

**现状**（lines 69-87，PPT 已是目标形态）:
```xml
<!-- 单一统一入口: 打开 Aster -->
<Control xsi:type="Button" id="Aster.Open">
  <Label resid="Btn.Aster.Open.Label"/>
  <Supertip>
    <Title resid="Btn.Aster.Open.Label"/>
    <Description resid="Btn.Aster.Open.Tip"/>
  </Supertip>
  <Icon>
    <bt:Image size="16" resid="Icon.16x16"/>
    <bt:Image size="32" resid="Icon.32x32"/>
    <bt:Image size="80" resid="Icon.80x80"/>
  </Icon>
  <Action xsi:type="ShowTaskpane">
    <TaskpaneId>ButtonId1</TaskpaneId>
    <SourceLocation resid="Taskpane.Url"/>
  </Action>
</Control>
```

**检查 Excel / Word 宿主 block** — grep 输出显示 Excel L121（`AsterXL.Open`）+ Word L170（`AsterWD.Open`）各已有单按钮结构，只需确认 Label 是否已改为「打开 Aster」。
Planner 动作：确认 `Btn.Aster.Open.Label` 的 resid 对应字符串是否已为「打开 Aster」；若未更新则改 `<bt:String>` 值。

---

## Test File Pattern Assignments

### `src/agent/tools/write/excel.test.ts` (Wave 0 新建)

**Analog:** `src/agent/operationLog.integration.test.ts` lines 154-174 (Excel 集成 mock 范式)

**Mock 范式** (lines 47-68):
```typescript
function mockExcel(): ReturnType<typeof vi.fn> {
  const setValues = vi.fn();
  const range = {
    load: vi.fn(),
    address: 'Sheet1!A1:B2',
    get values(): unknown[][] { return [[0, 0]]; },
    set values(v: unknown[][]) { setValues(v); },
  };
  (global as unknown as Record<string, unknown>).Excel = {
    run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
      cb({
        workbook: { worksheets: { getActiveWorksheet: () => ({ getRange: () => range }) } },
        sync: vi.fn().mockResolvedValue(undefined),
      }),
    ),
  };
  return setValues;
}
```

**测试目标**（RESEARCH.md Validation Architecture lines 708-715）:
```typescript
// 1. insertChart 返回 chartName，reverse.tool = 'delete_chart_by_name', reverse.args 是 Record 对象
// 2. applyFormula / setCell reverse = overwrite_range，before-image 正确捕获
// 3. Wave 0 补的是 tool unit test，不是 adapter 集成（adapter 的单独在 ExcelAdapter.test.ts）
```

### `src/agent/tools/write/ppt.test.ts` (Wave 0 新建)

**Analog:** `src/adapters/PptAdapter.test.ts` lines 28-77 (PPT mock + assert 范式)

```typescript
// mock PowerPoint.run + shape.fill + shape.lineFormat
// 断言：setShapeProperty 返回 beforeImage 结构正确；reverse.args 是 Record 对象
// 断言：moveShape 返回 beforeImage 的 left/top；reverse.args 含旧 left/top
```

### `src/agent/tools/write/word.test.ts` (Wave 0 新建)

**Analog:** `src/agent/operationLog.integration.test.ts` lines 119-147 (Word inverse 集成范式)

```typescript
// mock Word.run + paragraphs.items（含 text + insertText + delete mock）
// 断言：replace_paragraph 传 expected_state mismatch → error (INVALID_ARGS)
// 断言：insert_paragraph reverse.args 是 Record 对象
```

### `src/components/ChatStream.test.tsx` (Wave 0 新建)

**Analog:** `src/agent/system-prompt.test.ts` lines 15-17 (it.each host 参数化模式)

```typescript
// it.each(['ppt', 'excel', 'word'])('host=%s → 对应 chips 渲染', (host) => {
//   render(<ChatStream> with AdapterContext providing host)
//   expect(screen.getByText('帮我做一份 Q3 销售复盘 PPT...')).toBeInTheDocument(); // ppt chip
// })
// host 未知 → 渲染无 chips，不报错
```

### `src/components/Onboarding/OnboardingModal.test.tsx` (Wave 0 新建)

**Analog:** `src/agent/system-prompt.test.ts` (简单 describe/it/expect 结构)

```typescript
// 断言 1：Step1Keys onComplete 被调用后 ONBOARDING_SEEN 已写入 storage
// 断言 2：单步化后不渲染 Step2Guide（getByText 找不到「在 XXX 中你可以」）
// 断言 3：CTA 文案是「开始使用」而非「下一步」
```

### `src/agent/system-prompt.test.ts` — 扩展现有测试（RESEARCH.md lines 708-715）

**Analog:** `src/agent/system-prompt.test.ts` 全文

**Phase 6 新增断言**（不改现有测试，追加）:
```typescript
// 断言 host-specific 领域段存在（关键短语）
it('host=ppt 含 PPT 领域指导关键词', () => {
  const prompt = buildSystemPrompt('ppt');
  expect(prompt).toContain('list_slides');
  expect(prompt).toContain('batch');
});
it('host=excel 含 Excel 领域指导关键词', () => {
  expect(buildSystemPrompt('excel')).toContain('get_used_range_summary');
});
it('host=word 含 Word 领域指导关键词', () => {
  expect(buildSystemPrompt('word')).toContain('replace_paragraph');
});
// 长度限制更新（3 宿主专属段 + 共享段，总长度可能 >1500）
// Phase 6：改为 < 3000 字符（领域指导段约 300 字/宿主，总预算留余量）
```

---

## Shared Patterns

### ⚠️ 最高优先级：inverse 方法 Record 对象签名（项目地雷，MEMORY[[project-adapter-inverse-signature]]）

**Source:** `src/adapters/WordAdapter.ts` lines 168-191 (deleteParagraphByContent)
**Apply to:** 所有新 inverse/read adapter 方法

```typescript
// 必须用 Record 对象签名（replay engine 以对象传参，位置签名致真机撤销全挂）
async anyInverseMethod(args: Record<string, unknown>): Promise<void> {
  const myParam = args.myParam as string;  // ← 内部解构，不是函数参数位置
  // ...
}

// 错误模式（绝不能这样写）：
// async anyInverseMethod(myParam: string): Promise<void> { ... }
```

**守门：** 新 inverse 方法补 `operationLog.integration.test.ts` case（现有 Excel/PPT/Word 三个 describe 各扩展）。

---

### A-06 / TOOL-07：Office.js proxy 不出 *.run 闭包

**Source:** `src/adapters/ExcelAdapter.ts` lines 309-334; `src/adapters/PptAdapter.ts` lines 481-514
**Apply to:** 所有新 adapter 方法

```typescript
// 正确：proxy 在 *.run 内消费完毕，只返纯数据
return await Excel.run(async (ctx) => {
  const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
  range.load(['values', 'address']);
  await ctx.sync();
  const pureData = { address: range.address as string, values: range.values as unknown[][] };
  // range proxy 不出闭包
  return pureData;
});

// 错误：返 proxy 对象（TOOL-07 ESLint 守门会 flag）
// return await Excel.run(async (ctx) => {
//   const range = ...;
//   return range;  // ← proxy 出了 run，后续访问会抛 OfficeExtension.Error
// });
```

---

### humanLabel 强制规范（AGENT-08 lint 守门）

**Source:** `src/agent/tools/index.ts` lines 172-179 (assertWriteToolRegisterable)
**Apply to:** 所有新 write tool

```typescript
// kind: 'write' + humanLabel 函数缺一不可，缺 humanLabel 注册时 throw
function assertWriteToolRegisterable(tool: ToolDef): void {
  if (tool.kind === 'write' && typeof tool.humanLabel !== 'function') {
    throw new Error(`TOOL-04: write tool "${tool.name}" missing humanLabel`);
  }
}
// 所有 ToolDef kind='write' 必须满足：
// 1. kind: 'write' 字段存在
// 2. humanLabel(args) => string 是函数
// 3. humanLabel 返回中文人话（动词+对象+参数，无 raw tool name，无英文参数键名）
```

---

### Error handling：HostApiError + if-rethrow 模式

**Source:** `src/adapters/WordAdapter.ts` lines 183-190; `src/adapters/PptAdapter.ts` lines 514-516
**Apply to:** 所有 adapter 方法

```typescript
// HostApiError 先 rethrow（不再包一层），其他异常 wrap 成 HostApiError
} catch (err) {
  if (err instanceof HostApiError) throw err;  // ← 先 rethrow，不双包
  throw new HostApiError('方法名 失败', err);
}
```

---

### normalizeText — Word 段落文本比对必须经此函数

**Source:** `src/adapters/WordAdapter.ts` lines 23-25
**Apply to:** 所有 Word inverse 方法中的文本比对

```typescript
function normalizeText(s: string): string {
  return s.replace(/\r\n/g, '\n').trimEnd();
}
// Word API 返回的 paragraph.text 末尾可能含 \r（段落结束标记），不 normalize 会 false-miss
```

---

### postState 快照必须随 reverse 一起返回（TOOL-04）

**Source:** `src/agent/tools/write/excel.ts` lines 55-62
**Apply to:** 所有新 write tool

```typescript
const postState: PostStateSnapshot = {
  kind: 'excel_range',  // 可以是 'excel_range' | 'excel_chart' | 'ppt_slide' | 'ppt_shape' | 'word_paragraph' (扩展 kind)
  content: { /* 写入后状态，非 before-image */ },
};
console.assert(reverse !== undefined, 'TOOL-04: reverse required');
return { ok: true, data: { ... }, reverse, postState };
// reverse + postState 缺一不可（由 operationLog.appendOperation 消费）
```

---

### Lingui `<Trans>` macro — 所有新 UI copy

**Source:** `src/components/Onboarding/Step1Keys.tsx` lines 17, 42-45, 99-104
**Apply to:** ChatStream.tsx chips、Step1Keys.tsx 文案变更

```tsx
import { Trans, useLingui } from '@lingui/react/macro';
// 静态字符串：
<Trans>开始使用</Trans>
// 含变量的字符串（通过 t 函数）：
const { t } = useLingui();
aria-label={t`DeepSeek API Key`}
```

---

## No Analog Found

无。所有 15 个文件均有直接 analog（同文件扩展或同项目 role-match）。

---

## Metadata

**Analog search scope:** `src/agent/tools/write/`, `src/adapters/`, `src/components/Onboarding/`, `src/components/`, `src/agent/`
**Files scanned:** 13 source files + 7 test files
**Pattern extraction date:** 2026-05-30
