# Phase 27: Word 工具补全 - Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 5 个改动点（word.ts 追加 ToolDef / WordAdapter.ts 新增方法 / operationLog.ts 接口+switch / contract.test.ts CONTRACT 行 / integration.test.ts 守门例 / tools/index.ts 注册）
**Analogs found:** 6 / 6（全部有精确 role-match analog，来自 Phase 9 既有 Word write 工具）

---

## File Classification

| 新增/修改文件 | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/agent/tools/write/word.ts` | tool-def | request-response | 同文件 `setWordCharacterFormat`（L231）/ `replaceSelection`（L635）/ `insertTable`（L566）| exact |
| `src/adapters/WordAdapter.ts` | adapter | request-response (Office.js Word.run) | 同文件 `setCharacterFormat`（L474）/ `restoreRangeFont`（L571）/ `insertTable`（L1071）/ `deleteTableByMarker`（L1148）| exact |
| `src/agent/operationLog.ts` | replay-engine | event-driven | 同文件 Phase 9 block（L34-49 kind union / L102-170 接口 / L382-412 switch case / L274 default）| exact |
| `src/agent/contract.test.ts` | test (contract) | — | 同文件 `CONTRACT[]` L35-39（Phase 9 Word 5 行）/ L118-141（D-17 fs.readFileSync 守门）| exact |
| `src/agent/operationLog.integration.test.ts` | test (integration) | — | 同文件 L256-303（`mockWordRich`）/ L398-503（Phase 9 5 例）| exact |
| `src/agent/tools/index.ts` | registration | — | 同文件 L276-292（`buildToolsForHost('word')` wordWriteTools 数组）| exact |

---

## Pattern Assignments

---

### 1. `src/agent/tools/write/word.ts` — 追加 4 个新 ToolDef（WORD-07/08/09/10）+ 扩展 WORD-06

#### Analog 1a：简单逆向 ToolDef 范式（`setWordCharacterFormat`，L231-290）

**文件：** `src/agent/tools/write/word.ts`，L231–290

**接口声明模式**（L206-222，以 `SetWordCharacterFormatArgs` 为例）：
```typescript
interface SetWordCharacterFormatArgs {
  paragraphIndex: number;
  uniqueLocalId?: string;
  font: {
    bold?: boolean | null;
    italic?: boolean | null;
    underline?: string;
    size?: number | null;
    color?: string | null;
    name?: string | null;
  };
}
```

**ToolDef 结构 + humanLabel + execute 模式**（L231-290）：
```typescript
export const setWordCharacterFormat: ToolDef<SetWordCharacterFormatArgs> = {
  name: 'set_word_character_format',
  kind: 'write',
  description: '设置 Word 指定段落的字符格式（...）。传哪些属性改哪些，其余不变。',
  parameters: {
    type: 'object',
    properties: {
      paragraphIndex: { type: 'number', description: '目标段落编号（0-based）' },
      uniqueLocalId: { type: 'string', description: '段落唯一 ID（可选，精确消歧）' },
      font: {
        type: 'object',
        description: '字符格式属性（传哪些改哪些，未传的不变）',
        properties: {
          bold: { type: 'boolean', description: '加粗' },
          // ... 各 font 属性
        },
      },
    },
    required: ['paragraphIndex', 'font'],
  },
  humanLabel: ({ paragraphIndex, font }) => {
    const props = Object.entries(font as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k)
      .join('/');
    return `将第 ${Number(paragraphIndex) + 1} 段字符格式改为 ${props}`;
  },
  async execute({ paragraphIndex, uniqueLocalId, font }, ctx): Promise<ToolResult> {
    // A-06：adapter 委托；before-image 由 adapter 内部 Word.run 读取
    const result = await (ctx.adapter as WordAdapter).setCharacterFormat({
      paragraphIndex,
      uniqueLocalId,
      font,
    });
    // before-image inverse = restore_range_font（精确 index + 内容指纹双重定位）
    const reverse: ReverseDescriptor = {
      tool: 'restore_range_font',          // ← CONTRACT.md 逐字对齐
      args: {
        index: paragraphIndex,
        expectedText: result.afterText,
        before: result.beforeImage,
      }, // Record 对象（[[project-adapter-inverse-signature]]）
    };
    const postState = { kind: 'word_char_format' as const, content: { index: paragraphIndex } };
    return {
      ok: true,
      data: { paragraphIndex, modified: Object.keys(font as Record<string, unknown>).length },
      reverse,
      postState,
    };
  },
};
```

**新工具照此改什么：**
- WORD-08/09/10 三个简单逆向工具照此完整结构；只替换：`name`、`description`、`parameters.properties`、`humanLabel` 函数体、adapter 方法调用名、`reverse.tool` 字面量、`postState.kind`。

---

#### Analog 1b：noop+gate ToolDef 范式（`replaceSelection`，L635-666）

**文件：** `src/agent/tools/write/word.ts`，L635–666

```typescript
export const replaceSelection: ToolDef<ReplaceSelectionArgs> = {
  name: 'replace_selection',
  kind: 'write',
  description: '将 Word 当前选中内容替换为新文本。...',
  parameters: { /* ... */ },
  humanLabel: ({ text }) =>
    `将选中内容替换为「${String(text).slice(0, HUMAN_LABEL_TEXT_CAP)}...」`,
  async execute({ text }, ctx): Promise<ToolResult> {
    await (ctx.adapter as WordAdapter).replaceSelection(text);
    // CR-04：noop_inverse —— 诚实标注「无法自动撤销」
    const reverse: ReverseDescriptor = {
      tool: 'noop_inverse',
      args: { reason: 'replace_selection 无法精确还原原始选区内容' },  // Record 对象
    };
    const postState = { kind: 'word_paragraph' as const, content: text };
    return {
      ok: true,
      data: { written: String(text).length },
      reverse,
      postState,
    };
  },
};
```

**新工具照此改什么（WORD-07 `set_word_list_format`）：**
- `tool: 'noop_inverse'`，`args: { reason: '列表格式转换无法自动撤销，请手动操作' }`
- adapter 调用仍执行真实列表转换（操作仍做，只是 undo 降级）
- `postState.kind: 'word_list_format' as const`

---

#### Analog 1c：快照式 noop+gate 超限降级模式（`findAndReplace`，L509-524）

**文件：** `src/agent/tools/write/word.ts`，L509–524

```typescript
// D-10: 超限降级（noop+gate）。
// 注意：替换已在 adapter 内部执行（Step 3），这里只是把 reverse 标为 noop_inverse。
if (result.overLimit) {
  return {
    ok: true,
    data: {
      replaced: result.replacedCount,
      warning: '受影响段落超过 100 个，替换已执行但无法自动撤销',
    },
    reverse: {
      tool: 'noop_inverse',
      args: { reason: '替换段落数超 100，无法自动撤销' }, // Record 对象
    },
    postState: { kind: 'word_snapshot' as const, content: { snapshottedParagraphs: 0 } },
  };
}
```

**新工具照此改什么：** WORD-07 write 操作照常执行，直接返回 noop+gate（不需要 overLimit 条件判断，一律 noop）。

---

#### Analog 1d：insert_table ToolDef（指纹 reverse.args，L566-621）

**文件：** `src/agent/tools/write/word.ts`，L566–621

```typescript
export const insertTable: ToolDef<InsertTableArgs> = {
  name: 'insert_table',
  kind: 'write',
  // ...
  humanLabel: ({ rows, cols }) => `插入 ${Number(rows)}×${Number(cols)} 表格`,
  async execute({ rows, cols, afterParagraphIndex, content }, ctx): Promise<ToolResult> {
    const result = await (ctx.adapter as WordAdapter).insertTable({
      rows, cols, afterParagraphIndex, content,
    });
    // D-17：reverse.args 必须是 Record 对象（非位置参）
    const reverse: ReverseDescriptor = {
      tool: 'delete_table_by_marker',
      args: {
        contentFingerprint: result.contentFingerprint,
        rows: result.rows,
        cols: result.cols,
        afterParagraphIndex: result.afterParagraphIndex,
      },
    };
    const postState = {
      kind: 'word_table' as const,
      content: { rows, cols, fingerprint: result.contentFingerprint },
    };
    return { ok: true, data: { rows, cols, inserted: true }, reverse, postState };
  },
};
```

**新工具照此改什么：** WORD-10 `edit_table_cell` adapter 返回 `{ beforeValue, tableFingerprint }`，`reverse.args` = `{ tableIndex, tableFingerprint, rowIndex, columnIndex, beforeValue }`，`postState.kind: 'word_table_cell' as const`。

---

### 2. `src/adapters/WordAdapter.ts` — 新增 write + inverse 方法

#### Analog 2a：`setCharacterFormat` — 写前读 before-image + only-if-present 写入（L474-555）

**文件：** `src/adapters/WordAdapter.ts`，L474–555

**签名模式**（D-17 硬约束）：
```typescript
async setCharacterFormat(
  args: Record<string, unknown>,
): Promise<{ beforeImage: Record<string, unknown>; afterText: string }> {
  // D-17: 第一行解包，不用位置参
  const index = args.paragraphIndex as number;
  const uniqueLocalId = args.uniqueLocalId as string | undefined;
  const font = args.font as { bold?: boolean | null; /* ... */ };
```

**before-image 写前读 + only-if-present 写入**（L529-549）：
```typescript
// before-image（D-06）：写前读取全部字体属性
const beforeImage: Record<string, unknown> = {
  bold: f.bold,
  italic: f.italic,
  underline: f.underline,
  size: f.size,
  color: f.color,
  name: f.name,
};
const afterText = normalizeText(para.text); // 用于 inverse 段落定位

// only-if-present 写入（未传的属性不变）
if (font.bold !== undefined) f.bold = font.bold as boolean;
if (font.italic !== undefined) f.italic = font.italic as boolean;
if (font.underline !== undefined) f.underline = font.underline as Word.UnderlineType;
if (font.size !== undefined) f.size = font.size as number;
if (font.color !== undefined) f.color = font.color as string;
if (font.name !== undefined) f.name = font.name as string;
await ctx.sync();

return { beforeImage, afterText };
```

**错误处理**（L551-554）：
```typescript
} catch (err) {
  if (err instanceof HostApiError) throw err;
  throw new HostApiError('Word setCharacterFormat 失败', err);
}
```

**WORD-06 折入改动：**
- 在 `loadStr` 末尾加 `,items/font/highlightColor`
- `beforeImage` 加 `highlightColor: f.highlightColor`
- only-if-present 加 `if (font.highlightColor !== undefined) f.highlightColor = font.highlightColor as string`（注意：null 是有意义语义——移除高亮，不做 null-guard 跳过，与 D-07 的 bold/italic null-guard 不同）

---

#### Analog 2b：`restoreRangeFont` — inverse 收 Record + 双重定位（L571-619）

**文件：** `src/adapters/WordAdapter.ts`，L571–619

```typescript
async restoreRangeFont(args: Record<string, unknown>): Promise<void> {
  // D-17: 第一行解包，不用位置参
  const index = args.index as number;
  const expectedText = args.expectedText as string;
  const before = args.before as Record<string, unknown>;

  try {
    await Word.run(async (ctx) => {
      const paras = ctx.document.body.paragraphs;
      paras.load('items/text');
      await ctx.sync();

      // 策略 1：index 快路径
      let targetIndex = -1;
      if (
        index >= 0 &&
        index < paras.items.length &&
        normalizeText(paras.items[index].text) === normalizeText(expectedText)
      ) {
        targetIndex = index;
      }
      // 策略 2：降级遍历（防 index drift）
      if (targetIndex === -1) {
        for (let i = 0; i < paras.items.length; i++) {
          if (normalizeText(paras.items[i].text) === normalizeText(expectedText)) {
            targetIndex = i;
            break;
          }
        }
      }
      if (targetIndex === -1) {
        throw new HostApiError('restoreRangeFont: 目标段落未找到', undefined);
      }

      const f = paras.items[targetIndex].font;
      // D-07：null 属性条件跳过（不写 null，保留 Word 混合状态）
      if (before.bold !== null && before.bold !== undefined) f.bold = before.bold as boolean;
      if (before.italic !== null && before.italic !== undefined) f.italic = before.italic as boolean;
      if (before.underline !== undefined) f.underline = before.underline as Word.UnderlineType;
      if (before.size !== null && before.size !== undefined) f.size = before.size as number;
      if (before.color !== null && before.color !== undefined) f.color = before.color as string;
      if (before.name !== null && before.name !== undefined) f.name = before.name as string;
      await ctx.sync();
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('Word restoreRangeFont 失败', err);
  }
}
```

**新 inverse 方法照此改什么：**
- WORD-06 折入：在 `restoreRangeFont` 的恢复块末尾加一行 `if (before.highlightColor !== undefined) f.highlightColor = before.highlightColor as string`（highlightColor null 要写回，不跳过）
- WORD-08 `deleteCommentById`：第一行解包 `commentId`；遍历 `ctx.document.body.comments` 找 id 匹配项调 `.delete()`；找不到抛 HostApiError
- WORD-09 `restoreWordHeaderFooter`：解包 `{ type, sectionIndex, beforeText }`；`sections.items[sectionIndex]`；`section.getHeader(type)` 或 `getFooter(type)`；`body.insertText(beforeText, Word.InsertLocation.replace)`；找不到抛 HostApiError
- WORD-10 `restoreTableCell`：解包 `{ tableIndex, tableFingerprint, rowIndex, columnIndex, beforeValue }`；双重定位（index + fingerprint 遍历）；`cell.value = beforeValue`；找不到抛 HostApiError

---

#### Analog 2c：`deleteTableByMarker` — 指纹遍历定位删除（L1148-1183）

**文件：** `src/adapters/WordAdapter.ts`，L1148–1183

```typescript
async deleteTableByMarker(args: Record<string, unknown>): Promise<void> {
  // D-17: 第一行解包，不用位置参
  const contentFingerprint = args.contentFingerprint as string;
  const rows = args.rows as number;
  const cols = args.cols as number;

  try {
    await Word.run(async (ctx) => {
      const tables = ctx.document.body.tables;
      // 注：Word.Table 无 columnCount 属性，列数通过 values[0].length 推导
      tables.load('items/rowCount,items/values');
      await ctx.sync();

      for (const table of tables.items) {
        const tableValues = table.values as string[][];
        const tableRows = table.rowCount;
        const tableCols = (tableValues[0] ?? []).length; // 从 values 推导列数
        const fp = buildTableFingerprint(tableValues, tableRows);
        if (tableRows === rows && tableCols === cols && fp === contentFingerprint) {
          table.delete();
          await ctx.sync();
          return; // 找到并删除成功
        }
      }

      // D-14: 定位不到 → throw（被 replayUndoStep catch → skipped_error）
      throw new HostApiError(
        `deleteTableByMarker: 找不到目标表格（fingerprint=${contentFingerprint} rows=${rows} cols=${cols}）`,
        undefined,
      );
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('Word deleteTableByMarker 失败', err);
  }
}
```

**新工具照此改什么（WORD-10 `restoreTableCell`）：**
- load `'items/rowCount,items/values'`；遍历找 fingerprint 匹配表格；再 `table.getCellOrNullObject(rowIndex, columnIndex)` load + sync；`cell.value = beforeValue`；找不到任一步 → 抛 HostApiError

---

#### Analog 2d：`insertTable` — write 方法结构 + isSetSupported 门控模式（L1071-1133）

**文件：** `src/adapters/WordAdapter.ts`，L1071–1133

**isSetSupported 门控写法（参考 `setCharacterFormat` L491-494）：**
```typescript
const supportsUniqueId =
  typeof Office !== 'undefined' &&
  Office.context?.requirements?.isSetSupported('WordApi', '1.6') === true;
```

**新 write 方法的门控模式（WORD-07/08/10）：**
```typescript
// 在 Word.run 外、Word.run 开头均可放
const supports = typeof Office !== 'undefined' &&
  Office.context?.requirements?.isSetSupported('WordApi', '1.3') === true; // 或 '1.4'
if (!supports) {
  return { ok: false, error: { code: 'UNSUPPORTED',
    message: '当前 Word 版本不支持此操作（需要 WordApi 1.3）', recoverable: false } };
}
```

---

### 3. `src/agent/operationLog.ts` — 接口声明 + switch case + PostStateSnapshot kind

#### Analog 3a：PostStateSnapshot kind union 扩展模式（L34-49）

**文件：** `src/agent/operationLog.ts`，L34–49

```typescript
export interface PostStateSnapshot {
  kind:
    | 'word_paragraph' | 'excel_range' | 'excel_chart' | 'ppt_slide' | 'ppt_shape'
    // Phase 9 Wave 0：5 个新 Word write tool postState kind
    | 'word_char_format' | 'word_para_format' | 'word_style' | 'word_snapshot' | 'word_table'
    // Phase 10 Wave 0：15 个新 Excel + PPT write tool postState kind（保守路径，readTargetState 不加新 case）
    | 'excel_range_format' | /* ... */
    // Phase 23 新增：...走 default 安全侧
    | 'ppt_layout'
    // Phase 11 新增：batch 整体快照 kind
    | 'batch';
  content: unknown;
}
```

**Phase 27 追加模式（照此在末尾 `| 'batch'` 之前插入新行）：**
```typescript
    // Phase 27 新增：Word 工具补全 5 个 kind（readTargetState/isTargetStateConsistent 走保守 default）
    | 'word_list_format' | 'word_comment' | 'word_header_footer' | 'word_table_cell'
```

---

#### Analog 3b：DocumentAdapterForReplay 接口声明扩展模式（L102-135）

**文件：** `src/agent/operationLog.ts`，L102–135

```typescript
export interface DocumentAdapterForReplay {
  // ... 已有方法 ...
  // Phase 9 Wave 0：5 个新 inverse 方法（计划 02 加接口声明，04-07 加 adapter 实现）
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

**Phase 27 追加模式（在 Phase 9 block 后紧接着加注释块）：**
```typescript
  // ─── Phase 27 Word 工具补全 inverse 方法 ───
  /** Word inverse：按 comment id 删除批注（insert_word_comment） */
  deleteCommentById?: (args: Record<string, unknown>) => Promise<void>;
  /** Word inverse：还原页眉/页脚文字（set_word_header_footer） */
  restoreWordHeaderFooter?: (args: Record<string, unknown>) => Promise<void>;
  /** Word inverse：还原表格单元格内容（edit_table_cell） */
  restoreTableCell?: (args: Record<string, unknown>) => Promise<void>;
```
（注：WORD-06 折入不新增接口，WORD-07 noop+gate 不新增接口）

---

#### Analog 3c：executeReverse switch case 扩展模式（L382-412）

**文件：** `src/agent/operationLog.ts`，L382–412

```typescript
// Phase 9 Wave 0：5 个新 case
case 'restore_range_font':
  if (!adapter.restoreRangeFont) {
    throw new Error(`adapter 未实现 restoreRangeFont（tool=${reverse.tool}）`);
  }
  await adapter.restoreRangeFont(reverse.args);
  break;
```

**Phase 27 追加模式（WORD-08/09/10 各一个 case，照此完整复制，替换名字）：**
```typescript
// Phase 27 Wave X：Word 工具补全 3 个新 case
case 'delete_comment_by_id':
  if (!adapter.deleteCommentById) {
    throw new Error(`adapter 未实现 deleteCommentById（tool=${reverse.tool}）`);
  }
  await adapter.deleteCommentById(reverse.args);
  break;
case 'restore_word_header_footer':
  if (!adapter.restoreWordHeaderFooter) {
    throw new Error(`adapter 未实现 restoreWordHeaderFooter（tool=${reverse.tool}）`);
  }
  await adapter.restoreWordHeaderFooter(reverse.args);
  break;
case 'restore_table_cell':
  if (!adapter.restoreTableCell) {
    throw new Error(`adapter 未实现 restoreTableCell（tool=${reverse.tool}）`);
  }
  await adapter.restoreTableCell(reverse.args);
  break;
```

---

#### Analog 3d：readTargetState + isTargetStateConsistent 保守 default（L274-276 / L320-322）

**文件：** `src/agent/operationLog.ts`，L274–276 & L320–322

```typescript
// readTargetState switch 末尾 default（L274-276）：
default:
  return undefined;

// isTargetStateConsistent switch 末尾 default（L320-322）：
default:
  return true;
```

**Phase 27 新 kind 处理：** 不加任何新 case——4 个新 kind（`word_list_format` / `word_comment` / `word_header_footer` / `word_table_cell`）全部走 `default`，`readTargetState` 返回 `undefined`，`isTargetStateConsistent` 返回 `true`（保守通过，绝不盲加 read 比对规则）。

---

### 4. `src/agent/contract.test.ts` — CONTRACT 行追加

#### Analog 4a：Phase 9 CONTRACT 行（L35-39）

**文件：** `src/agent/contract.test.ts`，L33–64

```typescript
const CONTRACT: ContractEntry[] = [
  // ─── Phase 9 Word 工具 ───
  { toolName: 'set_word_character_format', host: 'word', undoType: '简单逆向', reverseTool: 'restore_range_font', phase: 9, integrationTest: true },
  { toolName: 'set_word_paragraph_format', host: 'word', undoType: '简单逆向', reverseTool: 'restore_paragraph_format', phase: 9, integrationTest: true },
  { toolName: 'apply_paragraph_style', host: 'word', undoType: '简单逆向', reverseTool: 'restore_paragraph_style', phase: 9, integrationTest: true },
  { toolName: 'find_and_replace', host: 'word', undoType: '快照式', reverseTool: 'restore_range_snapshot', phase: 9, integrationTest: true },
  { toolName: 'insert_table', host: 'word', undoType: '简单逆向', reverseTool: 'delete_table_by_marker', phase: 9, integrationTest: true },
```

**Phase 27 追加 4 行（照此格式，紧接 Phase 9 block 之后加 Phase 27 注释块）：**
```typescript
  // ─── Phase 27 Word 工具补全 ───
  { toolName: 'set_word_list_format', host: 'word', undoType: 'noop+gate', reverseTool: 'noop_inverse', phase: 27, integrationTest: true },
  { toolName: 'insert_word_comment', host: 'word', undoType: '简单逆向', reverseTool: 'delete_comment_by_id', phase: 27, integrationTest: true },
  { toolName: 'set_word_header_footer', host: 'word', undoType: '简单逆向', reverseTool: 'restore_word_header_footer', phase: 27, integrationTest: true },
  { toolName: 'edit_table_cell', host: 'word', undoType: '简单逆向', reverseTool: 'restore_table_cell', phase: 27, integrationTest: true },
```

注意：CONTRACT 数组长度守门（L144）现为 `>=24`，加 4 行后为 30，自动通过。需同步更新守门注释说明新长度（非强制，但保持注释准确）。`PhaseNum` 类型（L18）需追加 `| 27`。

#### Analog 4b：D-17 fs.readFileSync 硬断言块（L118-141）

**文件：** `src/agent/contract.test.ts`，L118–141

```typescript
it('integrationTest: true 的工具 toolName 必须出现在 operationLog.integration.test.ts 文件内（D-17 硬卡）', () => {
  const implementedTools = CONTRACT.filter((c) => c.integrationTest === true);
  // ...
  const integrationTestContent: string = fs.readFileSync(integrationTestPath, 'utf-8');
  implementedTools.forEach(({ toolName }) => {
    expect(
      integrationTestContent,
      `D-17: ${toolName} 标记 integrationTest:true 但 operationLog.integration.test.ts 中找不到 '${toolName}'`
    ).toContain(toolName);
  });
});
```

**影响：** 4 个新工具名（`set_word_list_format` / `insert_word_comment` / `set_word_header_footer` / `edit_table_cell`）的字符串字面量必须出现在 `operationLog.integration.test.ts` 中，否则此测试挂。

---

### 5. `src/agent/operationLog.integration.test.ts` — 守门用例追加

#### Analog 5a：`mockWordRich` 夹具（L256-304）

**文件：** `src/agent/operationLog.integration.test.ts`，L256–304

```typescript
function mockWordRich(opts?: {
  paragraphTexts?: string[];
  tables?: Array<{ rowCount: number; columnCount: number; values: string[][]; delete: ReturnType<typeof vi.fn> }>;
}): {
  paraItems: Array<Record<string, unknown>>;
  tableItems: Array<{ rowCount: number; columnCount: number; values: string[][]; delete: ReturnType<typeof vi.fn> }>;
} {
  const texts = opts?.paragraphTexts ?? ['原段落文本', '第二段'];
  const paraItems = texts.map((text) => ({
    text,
    uniqueLocalId: 'uid-' + text,
    font: { bold: false, italic: false, underline: 'None', size: 12, color: '#000000', name: 'Calibri' },
    lineSpacing: 12, spaceBefore: 0, spaceAfter: 0, alignment: 'Left',
    firstLineIndent: 0, leftIndent: 0,
    style: 'Normal', styleBuiltIn: 'Normal',
    load: vi.fn(),
    insertText: vi.fn(),
    getRange: vi.fn(() => ({ insertTable: vi.fn() })),
    insertTable: vi.fn(),
  }));
  const tableItems = opts?.tables ?? [];
  (global as unknown as Record<string, unknown>).Word = {
    InsertLocation: { end: 'End', replace: 'Replace', after: 'After', start: 'Start' },
    run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
      cb({
        document: {
          body: {
            paragraphs: { load: vi.fn(), items: paraItems },
            tables: { load: vi.fn(), items: tableItems },
            search: vi.fn(() => searchResults),
            insertTable: vi.fn(() => ({
              load: vi.fn(), rowCount: 3, columnCount: 3,
              values: [['a', 'b', 'c'], ['', '', ''], ['', '', '']],
              delete: vi.fn(),
            })),
          },
        },
        sync: vi.fn().mockResolvedValue(undefined),
      }),
    ),
  };
  return { paraItems, tableItems };
}
```

**Phase 27 需扩展 mockWordRich：**
- WORD-08 用例需要 `document.body.comments`（或 `document.comments`）mock，含数组 `items: [{ id: 'cmt-1', delete: vi.fn() }]`，以及 `body.getRange`/`body.search` 返回支持 `insertComment()` 的 range mock
- WORD-09 用例需要 `document.sections`，含 `getFirst()` 返回 `{ getHeader(type): Body, getFooter(type): Body }`，Body 带 `{ load, text: '旧页眉', insertText: vi.fn() }`
- WORD-10 用例复用现有 `tables` fixture，确保 `table.getCell(row, col)` 可访问（或 `getCellOrNullObject`），返回 `{ load: vi.fn(), value: '原内容', body: { insertText: vi.fn() } }`
- 可新建 `mockWordRich27` 函数扩展这三类 mock，也可以给现有 `mockWordRich` opts 加可选字段（推荐后者，保持夹具统一）

---

#### Analog 5b：Phase 9 五个守门用例结构（L398-503）

**文件：** `src/agent/operationLog.integration.test.ts`，L398–503

以 `set_word_character_format` 为模板（L398-416）：
```typescript
it('单步撤销 set_word_character_format：真 WordAdapter.restoreRangeFont 收 Record 对象 → rolled_back', async () => {
  mockWordRich({ paragraphTexts: ['原段落文本', '第二段'] });
  const adapter = new WordAdapter();   // ← 真 adapter（捕获 Phase 5 签名 bug）
  const entry: OperationLogEntry = {
    runId: 'run-w1', stepIndex: 0,
    toolName: 'set_word_character_format',   // ← D-17 硬卡：字符串必须出现在本文件
    args: { paragraphIndex: 0, font: { bold: true } },
    humanLabel: '将第 1 段设为加粗',
    reverse: {
      tool: 'restore_range_font',
      args: { index: 0, expectedText: '原段落文本', before: { bold: false, italic: false, underline: 'None', size: 12, color: '#000000', name: 'Calibri' } },
    },
    postState: { kind: 'word_char_format', content: { index: 0 } },
    timestamp: 0,
  };
  const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
  expect(detail.status).toBe('rolled_back');
});
```

**Phase 27 四个新用例照此结构，各自替换：**

**WORD-07 `set_word_list_format`（noop+gate → skipped_error）：**
```typescript
it('单步撤销 set_word_list_format：noop_inverse → skipped_error', async () => {
  mockWordRich({ paragraphTexts: ['段落文本'] });
  const adapter = new WordAdapter();
  const entry: OperationLogEntry = {
    runId: 'run-w27-1', stepIndex: 0,
    toolName: 'set_word_list_format',   // ← D-17 硬卡：字符串必须出现在本文件
    args: { paragraphIndex: 0, listType: 'bullet' },
    humanLabel: '将第 1 段改为项目符号列表',
    reverse: {
      tool: 'noop_inverse',
      args: { reason: '列表格式转换无法自动撤销，请手动操作' },
    },
    postState: { kind: 'word_list_format', content: { index: 0 } },
    timestamp: 0,
  };
  const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
  expect(detail.status).toBe('skipped_error'); // noop_inverse 抛 Error → skipped_error
});
```

**WORD-08 `insert_word_comment`（简单逆向 → rolled_back，delete spy 被调用）：**
```typescript
it('单步撤销 insert_word_comment：真 WordAdapter.deleteCommentById 收 Record 对象 → rolled_back', async () => {
  // 需要 mockWordRich 扩展：document.comments（含 id + delete spy）
  const deleteCommentFn = vi.fn();
  mockWordRich({ /* ...扩展包含 comments */ });
  const adapter = new WordAdapter();
  const entry: OperationLogEntry = {
    runId: 'run-w27-2', stepIndex: 0,
    toolName: 'insert_word_comment',   // ← D-17 硬卡：字符串必须出现在本文件
    args: { paragraphIndex: 0, searchText: '测试文本', commentText: '建议修改' },
    humanLabel: '给「测试文本」插入批注',
    reverse: {
      tool: 'delete_comment_by_id',
      args: { commentId: 'cmt-1' },
    },
    postState: { kind: 'word_comment', content: { commentId: 'cmt-1' } },
    timestamp: 0,
  };
  const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
  expect(detail.status).toBe('rolled_back');
});
```

**WORD-09 `set_word_header_footer`（简单逆向 → rolled_back）：**
```typescript
it('单步撤销 set_word_header_footer：真 WordAdapter.restoreWordHeaderFooter 收 Record 对象 → rolled_back', async () => {
  // 需要 mockWordRich 扩展：document.sections + getHeader(type) 返回 Body
  mockWordRich({ /* ...扩展包含 sections + header body */ });
  const adapter = new WordAdapter();
  const entry: OperationLogEntry = {
    runId: 'run-w27-3', stepIndex: 0,
    toolName: 'set_word_header_footer',   // ← D-17 硬卡：字符串必须出现在本文件
    args: { headerOrFooter: 'header', text: '新页眉' },
    humanLabel: '将页眉改为「新页眉」',
    reverse: {
      tool: 'restore_word_header_footer',
      args: { type: 'Primary', sectionIndex: 0, headerOrFooter: 'header', beforeText: '旧页眉' },
    },
    postState: { kind: 'word_header_footer', content: { type: 'Primary', sectionIndex: 0 } },
    timestamp: 0,
  };
  const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
  expect(detail.status).toBe('rolled_back');
});
```

**WORD-10 `edit_table_cell`（简单逆向 → rolled_back，复用 tables fixture）：**
```typescript
it('单步撤销 edit_table_cell：真 WordAdapter.restoreTableCell 收 Record 对象 → rolled_back', async () => {
  const tableCellMock = { load: vi.fn(), value: '原内容', body: { insertText: vi.fn() } };
  mockWordRich({
    tables: [{ rowCount: 2, columnCount: 2,
      values: [['原内容', 'B'], ['C', 'D']], delete: vi.fn(),
      getCell: vi.fn(() => tableCellMock), getCellOrNullObject: vi.fn(() => tableCellMock) }],
  });
  const adapter = new WordAdapter();
  const entry: OperationLogEntry = {
    runId: 'run-w27-4', stepIndex: 0,
    toolName: 'edit_table_cell',   // ← D-17 硬卡：字符串必须出现在本文件
    args: { tableIndex: 0, rowIndex: 0, columnIndex: 0, text: '新内容' },
    humanLabel: '将表格 1 第 1 行第 1 列改为「新内容」',
    reverse: {
      tool: 'restore_table_cell',
      args: { tableIndex: 0, tableFingerprint: '原内容|B__2x2', rowIndex: 0, columnIndex: 0, beforeValue: '原内容' },
    },
    postState: { kind: 'word_table_cell', content: { tableIndex: 0, rowIndex: 0, columnIndex: 0 } },
    timestamp: 0,
  };
  const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
  expect(detail.status).toBe('rolled_back');
});
```

---

### 6. `src/agent/tools/index.ts` — wordWriteTools 注册

#### Analog 6a：`buildToolsForHost('word')` wordWriteTools 数组（L276-292）

**文件：** `src/agent/tools/index.ts`，L276–292

```typescript
case 'word': {
  const wordWriteTools = [
    appendParagraph, insertParagraph, replaceParagraph,
    insertTextAtCursor, replaceSelection,
    setWordCharacterFormat, setWordParagraphFormat, // Phase 9 WORD-01/WORD-02
    applyParagraphStyle, // Phase 9 WORD-03
    findAndReplace, // Phase 9 WORD-04
    insertTable, // Phase 9 WORD-05
    generateWordImageTool, // Phase 16 IMG-02
    searchAndInsertStockImageWordTool, // Phase 18 LIB-02
    batchWrite, // Phase 11 BATCH-01
  ] as ToolDef[];
  wordWriteTools.forEach(assertWriteToolRegisterable);
  return [
    getDocumentFullText, getParagraphCount, getParagraphAt, getDocumentOutline,
    getShapeImage,
    ...wordWriteTools, selectionDetail,
  ].map((t) => t as ToolDef);
}
```

**Phase 27 改动：** 在 `batchWrite` 之前（或之后）追加 4 个新工具，逐行加注释：
```typescript
    setWordListFormat, // Phase 27 WORD-07
    insertWordComment, // Phase 27 WORD-08
    setWordHeaderFooter, // Phase 27 WORD-09
    editTableCell, // Phase 27 WORD-10
```

注意：
- **不建 WORD_TOOLS Set，不归一化**（G-C 决策）
- WORD-06 折入 `setWordCharacterFormat`，不新增注册
- 4 个新工具均不进 `PPT_TOOLS`（Word 工具和 PPT_TOOLS 互不相干）
- `assertWriteToolRegisterable` 在注册期会校验 `humanLabel`，必须是 function，否则 throw

---

## Shared Patterns

### 签名规范（D-17 / D-01 硬约束）

**来源：** `src/adapters/WordAdapter.ts` L474-478、L571-575、L1071-1083、L1148-1152

**适用：** 所有新 write 方法 + 所有新 inverse 方法

```typescript
// write 方法签名：
async newWriteMethod(
  args: Record<string, unknown>,
): Promise<{ beforeImage: Record<string, unknown>; /* ...其他返回字段 */ }> {
  // D-17: 方法体第一行解包，不用位置参
  const param1 = args.param1 as TypeA;
  const param2 = args.param2 as TypeB;
  // ...
}

// inverse 方法签名：
async newInverseMethod(args: Record<string, unknown>): Promise<void> {
  // D-17: 第一行解包，不用位置参
  const field1 = args.field1 as TypeA;
  // ...
}
```

---

### Word.run 闭包 + HostApiError 封装（A-06）

**来源：** `src/adapters/WordAdapter.ts` L488-554（setCharacterFormat 完整实现）

**适用：** 所有新 adapter 方法

```typescript
try {
  return await Word.run(async (ctx) => {
    // 所有 Office.js proxy 操作在此闭包内
    // proxy 对象（paragraphs.items[i], table 等）绝不出 Word.run 闭包
    // ...
    await ctx.sync();
    return { /* 纯数据 */ };
  });
} catch (err) {
  if (err instanceof HostApiError) throw err;
  throw new HostApiError('Word Xxx 方法名失败', err);
}
```

---

### normalizeText 段落文本归一化

**来源：** `src/adapters/WordAdapter.ts` L23-30（模块私有函数，文件头部）

**适用：** 所有新 inverse 方法中的段落文本比对（`normalizeText(paras.items[i].text) === normalizeText(expectedText)`）

---

### buildTableFingerprint（D-13 Don't Hand-Roll）

**来源：** `src/adapters/WordAdapter.ts` L38-50（模块私有函数）

**适用：** WORD-10 `editTableCell` write 方法（生成 before fingerprint）+ `restoreTableCell` inverse 方法（遍历匹配）

```typescript
// buildTableFingerprint 已实现，直接复用：
const fingerprint = buildTableFingerprint(table.values as string[][], table.rowCount);
```

---

### ToolDef const 命名约定

**来源：** `src/agent/tools/write/word.ts` 全文（camelCase 导出名 ↔ snake_case tool.name）

**适用：** 4 个新 ToolDef 的 const 命名：
- `setWordListFormat` → `name: 'set_word_list_format'`
- `insertWordComment` → `name: 'insert_word_comment'`
- `setWordHeaderFooter` → `name: 'set_word_header_footer'`
- `editTableCell` → `name: 'edit_table_cell'`

---

## No Analog Found

所有文件均有精确 analog（Phase 9 既有 Word write 工具）。无未有先例的范式，全部照抄/扩展。

唯一新 Office.js API（无现有 adapter 方法 analog）：
| 方法/属性 | 首次引入 | 建议参考 |
|---|---|---|
| `Section.getHeader/getFooter` → `Body.insertText` | WORD-09 | 照 `insertTable` `Word.run` 闭包结构 + `body.insertText(text, 'Replace')` |
| `Range.insertComment` / `Comment.id` / `Comment.delete` | WORD-08 | 无 analog；照 `Word.run` 标准闭包结构；comment.id 在同一闭包 load+sync 后读取 |
| `Paragraph.startNewList` / `List.setLevelBullet` | WORD-07 | 写法照 `Word.run` 标准结构；undo 直接 noop+gate，不实现 inverse |
| `Body.tables` / `Table.getCell` / `TableCell.value` | WORD-10 | `deleteTableByMarker` 的 `tables.load('items/rowCount,items/values')` + 遍历已有先例 |

---

## Metadata

**Analog search scope:** `src/agent/tools/write/word.ts`、`src/adapters/WordAdapter.ts`、`src/agent/operationLog.ts`、`src/agent/contract.test.ts`、`src/agent/operationLog.integration.test.ts`、`src/agent/tools/index.ts`
**Files scanned:** 6
**Pattern extraction date:** 2026-06-06
