# Phase 9: Word 精准写 (D + B-Word) - Pattern Map

**Mapped:** 2026-05-30
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/adapters/WordAdapter.ts` | adapter/service | CRUD + request-response | `src/adapters/WordAdapter.ts` (existing methods) | exact — 同文件内已有直接范式 |
| `src/agent/tools/write/word.ts` | tool/controller | request-response | `src/agent/tools/write/word.ts` (existing ToolDefs) | exact — 同文件追加 |
| `src/agent/operationLog.ts` | service + interface | event-driven (undo) | `src/agent/operationLog.ts` (existing interface+switch) | exact — 同文件追加 |
| `src/agent/operationLog.integration.test.ts` | test (integration) | event-driven (undo) | `src/agent/operationLog.integration.test.ts` (existing guard tests) | exact — 同文件追加 |
| `src/agent/contract.test.ts` | test (contract) | — | `src/agent/contract.test.ts` (existing CONTRACT array) | exact — 翻标志位 |
| `src/agent/tools/index.ts` | registry | request-response | `src/agent/tools/index.ts` `buildToolsForHost('word')` | exact — 数组追加 |
| `.planning/phases/08-foundation-a-f/CONTRACT.md` | docs | — | 同文件 Phase 9 行 | exact — 翻 status/integration_test 字段 |
| `src/adapters/WordAdapter.read.test.ts` / `src/agent/tools/write/word.test.ts` | test (unit) | — | `operationLog.integration.test.ts` mockWord 工厂 | role-match |

---

## Pattern Assignments

### `src/adapters/WordAdapter.ts` — 5 write methods + 5 inverse methods + selection_detail 扩展

---

#### A. Word.run 闭包范式（所有 adapter 方法基础模板）

**Analog:** `WordAdapter.replaceParagraphAt` (lines 284–319) + `WordAdapter.restoreParagraphAt` (lines 337–384)

**Word.run 单闭包范式（write 方法）:**
```typescript
// src/adapters/WordAdapter.ts lines 289-319
async replaceParagraphAt(index: number, newText: string, expectedText?: string): Promise<{ beforeImage: string }> {
  try {
    return await Word.run(async (ctx) => {
      const paras = ctx.document.body.paragraphs;
      paras.load('items/text');
      await ctx.sync();

      if (index < 0 || index >= paras.items.length) {
        throw new HostApiError(`replaceParagraphAt: index=${index} 不存在（共 ${paras.items.length} 段）`, undefined);
      }

      const currentText = normalizeText(paras.items[index].text);
      // ... 写操作 ...
      await ctx.sync();
      return { beforeImage };
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('Word replaceParagraphAt 失败', err);
  }
}
```

**关键点：**
- `HostApiError` 构造器第二参不存 hostError（ERR-02 防 stack 泄漏）
- 内部 HostApiError 先 re-throw，再用外层 catch 包陌生异常
- proxy 不出 `Word.run` 闭包，入参/出参纯数据（A-06）

---

#### B. Index + 内容指纹双重定位范式（防 index drift）

**Analog:** `WordAdapter.restoreParagraphAt` (lines 337–384) — Phase 9 所有 inverse 方法均复用此范式

```typescript
// src/adapters/WordAdapter.ts lines 343-384
async restoreParagraphAt(args: Record<string, unknown>): Promise<void> {
  const index = args.index as number;
  const restoreText = args.restoreText as string;
  const expectedText = args.expectedText as string;

  try {
    await Word.run(async (ctx) => {
      const paras = ctx.document.body.paragraphs;
      paras.load('items/text');
      await ctx.sync();

      const normalExpected = normalizeText(expectedText);

      // 策略 1：先尝试 index 快速定位
      let targetIndex = -1;
      if (
        index >= 0 &&
        index < paras.items.length &&
        normalizeText(paras.items[index].text) === normalExpected
      ) {
        targetIndex = index;
      }

      // 策略 2：index 不匹配，降级遍历（防 index 漂移）
      if (targetIndex === -1) {
        for (let i = 0; i < paras.items.length; i++) {
          if (normalizeText(paras.items[i].text) === normalExpected) {
            targetIndex = i;
            break;
          }
        }
      }

      if (targetIndex === -1) {
        throw new HostApiError('restoreParagraphAt: 未找到目标段落', undefined);
      }

      paras.items[targetIndex].insertText(restoreText, Word.InsertLocation.replace);
      await ctx.sync();
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('Word restoreParagraphAt 失败', err);
  }
}
```

**Phase 9 适配：** 5 个 inverse 方法（restoreRangeFont / restoreParagraphFormat / restoreParagraphStyle / restoreRangeSnapshot / deleteTableByMarker）均使用 `args.index + args.expectedText` 双重定位（或其等价形式）。字段名与各自 before-image 语义对齐。

---

#### C. Record 签名守门（D-17 硬约束）

**Analog:** `WordAdapter.deleteParagraphByContent` (lines 168–191) — 文件内注释直接点名此约束

```typescript
// src/adapters/WordAdapter.ts lines 168-191
// 签名遵循 DocumentAdapterForReplay.deleteParagraphByContent 接口约定：
//   args: Record<string, unknown>  → args.text as string
// 这样 operationLog.executeReverse 可直接传 reverse.args 对象（不拆参），
// （Phase 5 真机 UAT 实证：旧 `(text: string)` 位置签名收到 replay 传来的对象
//  → normalizeText 对对象调用 .replace 抛 TypeError → 全部 inverse 被误判 skipped_error）
async deleteParagraphByContent(args: Record<string, unknown>): Promise<void> {
  const text = args.text as string;
  // ...
}
```

**Phase 9 规则：** 所有 5 个 inverse 方法签名必须是 `(args: Record<string, unknown>): Promise<void>`，方法体第一行从 args 解包具体字段。

---

#### D. before-image 读取 + write 模式（set_word_character_format 范式）

**Analog:** `WordAdapter.replaceParagraphAt` before-image 模式 (line 309) + RESEARCH.md Q1 代码示例

新增方法的 before-image 范式（在 `Word.run` 闭包内，`ctx.sync()` 之后读，写之前存）：
```typescript
// 模式：paras.load(...) → sync → 读原值 → 写新值 → sync → 返 { beforeImage }
const para = paras.items[targetIndex];
para.font.load('bold,italic,underline,size,color,name');
await ctx.sync();
const beforeImage = {
  bold: para.font.bold,
  italic: para.font.italic,
  underline: para.font.underline,
  size: para.font.size,
  color: para.font.color,
  name: para.font.name,
};
// write ...
await ctx.sync();
return { beforeImage };
```

---

#### E. selection_detail 扩展（paragraphIndex + uniqueLocalId）

**Analog:** `WordAdapter.read` `'selection_detail'` case (lines 543–566) — 直接在此 case 内扩展

```typescript
// src/adapters/WordAdapter.ts lines 543-566（现有，待扩展）
case 'selection_detail': {
  try {
    return await Word.run(async (ctx) => {
      const selection = ctx.document.getSelection();
      selection.load('text');
      await ctx.sync();
      const text = selection.text;
      if (text.length === 0) {
        return { ok: true, data: { kind: 'none' } } satisfies ReadableResult;
      }
      return {
        ok: true,
        data: { kind: 'word', charCount: text.length, text },
      } satisfies ReadableResult;
    });
  } catch (err) {
    throw new HostApiError('Word selection_detail 失败', err);
  }
}
```

**扩展目标：** 在同一 `Word.run` 闭包内增加 `body.paragraphs.load(...)` + `isSetSupported('WordApi','1.6')` 门控读取 `paragraphIndex` + `uniqueLocalId`，返回值增加这两个字段。详见 RESEARCH.md Q4/Q5。

---

### `src/agent/tools/write/word.ts` — 5 个新 ToolDef

---

#### A. ToolDef 结构范式（before-image → reverse Record args）

**Analog:** `replaceParagraph` ToolDef (lines 126–170) — 最接近 Phase 9 三个简单逆向工具

```typescript
// src/agent/tools/write/word.ts lines 126-170
export const replaceParagraph: ToolDef<ReplaceParagraphArgs> = {
  name: 'replace_paragraph',
  kind: 'write',
  description: '替换 Word 文档指定段落（index，0-based）的文本。',
  parameters: {
    type: 'object',
    properties: {
      index: { type: 'number', description: '目标段落编号（0-based）' },
      text: { type: 'string', description: '替换后的新文本' },
    },
    required: ['index', 'text'],
  },
  humanLabel: ({ index, text }) =>
    `将第 ${Number(index) + 1} 段替换为「${String(text).slice(0, HUMAN_LABEL_TEXT_CAP)}...」`,
  async execute({ index, text, expected_text }, ctx): Promise<ToolResult> {
    const { beforeImage } = await (ctx.adapter as WordAdapter).replaceParagraphAt(index, text, expected_text);
    const reverse: ReverseDescriptor = {
      tool: 'restore_paragraph_at',
      args: {
        index,
        expectedText: text,       // 替换后（当前）的文本，用于定位
        restoreText: beforeImage, // before-image，用于还原
      },  // Record 对象（[[project-adapter-inverse-signature]]）
    };
    const postState = { kind: 'word_paragraph' as const, content: text };
    return { ok: true, data: { index, written: text.length }, reverse, postState };
  },
};
```

**Phase 9 适配规则：**
- `reverse.args` 必须是字面量对象（含 before-image 字段），不是位置参
- `postState.kind` 改为对应 Phase 9 新 kind（如 `'word_char_format'`）
- adapter 方法名从 `replaceParagraphAt` 改为对应新方法名
- `humanLabel` 必须是 function（`assertWriteToolRegisterable` 守门）

---

#### B. ToolDef postState 快照式范式（find_and_replace）

**Analog:** `appendParagraph` ToolDef (lines 46–75) — postState + reverse 组合

```typescript
// src/agent/tools/write/word.ts lines 62-74
async execute({ text }, ctx): Promise<ToolResult> {
  await (ctx.adapter as WordAdapter).appendParagraph(text);
  const reverse: ReverseDescriptor = {
    tool: 'delete_paragraph_by_content',
    args: { text },
  };
  const postState = { kind: 'word_paragraph' as const, content: text };
  return { ok: true, data: { written: text.length }, reverse, postState };
},
```

**Phase 9 适配（find_and_replace）：** `reverse.args` 包含 `snapshot` 数组（整段 before-image 列表），`postState.kind` 为 `'word_snapshot'`，`data` 含 `{ replaced: N }`。

---

#### C. 文件头注释引用 [[project-adapter-inverse-signature]]

**Analog:** `src/agent/tools/write/word.ts` lines 14–15

```typescript
// reverse.args 必须是 Record 对象（非位置参）——
//   见 [[project-adapter-inverse-signature]]：Phase 5 真机 UAT 实证，位置签名致撤销全挂。
```

**Phase 9：** 新增的 5 个 ToolDef 的 `reverse.args` 注释均引用此说明（参照现有 `insertParagraph` 的注释风格，lines 112–113）。

---

### `src/agent/operationLog.ts` — 接口 + executeReverse + kind

---

#### A. DocumentAdapterForReplay 方法声明范式

**Analog:** `operationLog.ts` lines 83–106

```typescript
// src/agent/operationLog.ts lines 83-106（现有接口，追加 5 个方法）
export interface DocumentAdapterForReplay {
  /** Word inverse：按内容精确删除段落（TOOL-04） */
  deleteParagraphByContent?: (args: Record<string, unknown>) => Promise<void>;
  // ...（现有 8 个方法）...
  /** Word inverse：按位置 index 还原替换前的段落文本 */
  restoreParagraphAt?: (args: Record<string, unknown>) => Promise<void>;
}
```

**Phase 9 追加格式（紧接 `restoreParagraphAt` 后）：**
```typescript
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

**规则：** 全部 optional（`?:`），签名 `(args: Record<string, unknown>) => Promise<void>`，JSDoc 注明对应的 write tool 名。

---

#### B. executeReverse switch case 范式

**Analog:** `operationLog.ts` lines 247–307 — `restore_paragraph_at` case 是最直接模板（lines 294–299）

```typescript
// src/agent/operationLog.ts lines 294-299
case 'restore_paragraph_at':
  if (!adapter.restoreParagraphAt) {
    throw new Error(`adapter 未实现 restoreParagraphAt（tool=${reverse.tool}）`);
  }
  await adapter.restoreParagraphAt(reverse.args);
  break;
```

**Phase 9 追加 5 个 case（格式一致）：** 检查 adapter method 是否存在 → throw Error（不是 HostApiError）→ await → break。

---

#### C. PostStateSnapshot.kind 扩展

**Analog:** `operationLog.ts` lines 34–37

```typescript
// src/agent/operationLog.ts lines 34-37（现有 union，待扩展）
export interface PostStateSnapshot {
  kind: 'word_paragraph' | 'excel_range' | 'excel_chart' | 'ppt_slide' | 'ppt_shape';
  content: unknown;
}
```

**Phase 9 扩展（追加 5 个 kind）：**
```typescript
kind: 'word_paragraph' | 'excel_range' | 'excel_chart' | 'ppt_slide' | 'ppt_shape'
    | 'word_char_format' | 'word_para_format' | 'word_style' | 'word_snapshot' | 'word_table';
```

**D-19 保守路径：** `readTargetState` 的 switch 不为新 kind 加 case，全部走 `default: return undefined`（已存在，自动通过）。`isTargetStateConsistent` 的 `default: return true` 同样已存在，新 kind 自动通过。

---

### `src/agent/operationLog.integration.test.ts` — 5 个守门测试

---

#### A. mock adapter 签名守门范式（最重要的守门模式）

**Analog:** `operationLog.integration.test.ts` lines 124–153（`restoreParagraphAt` 守门测试）

```typescript
// src/agent/operationLog.integration.test.ts lines 124-153
it('单步撤销 replace_paragraph：restoreParagraphAt 收 Record 对象（不抛 TypeError）', async () => {
  const restoreParagraphAtFn = vi.fn(async (_args: Record<string, unknown>): Promise<void> => {});
  const mockAdapter: DocumentAdapterForReplay = {
    restoreParagraphAt: restoreParagraphAtFn,
  };

  const entry: OperationLogEntry = {
    runId: 'run-it',
    stepIndex: 0,
    toolName: 'replace_paragraph',    // ← D-17 硬卡：此字符串必须出现在本文件
    args: { index: 1, new_text: '新段落' },
    humanLabel: '替换第 1 段落为「新段落」',
    reverse: { tool: 'restore_paragraph_at', args: { index: 1, expectedText: '新段落', restoreText: '原段落' } },
    postState: { kind: 'word_paragraph', content: '新段落' },
    timestamp: 0,
  };

  const detail = await replayUndoSingle(entry, mockAdapter);

  expect(detail.status).toBe('rolled_back');
  expect(restoreParagraphAtFn).toHaveBeenCalledTimes(1);
  const receivedArgs = restoreParagraphAtFn.mock.calls[0][0] as Record<string, unknown>;
  expect(typeof receivedArgs).toBe('object');
  expect(receivedArgs.index).toBe(1);
  expect(receivedArgs.restoreText).toBe('原段落');
});
```

**Phase 9 每工具一条，严格遵循此结构：**
1. `vi.fn()` 包 mock adapter 方法，签名 `(_args: Record<string, unknown>): Promise<void>`
2. `OperationLogEntry.toolName` 字段填对应工具名（D-17 硬卡：`contract.test.ts` 用 `fs.readFileSync` 断言此字符串出现在本文件）
3. `reverse.tool` 字段填对应 reverse tool 名（严格对齐 CONTRACT.md）
4. 断言 `detail.status === 'rolled_back'`
5. 断言 mock fn 被调用 1 次
6. 断言 `receivedArgs` 是 object + 验证具体字段值

---

#### B. mockWord 工厂（integration test 基础设施）

**Analog:** `operationLog.integration.test.ts` lines 33–45

```typescript
// src/agent/operationLog.integration.test.ts lines 33-45
function mockWord(paragraphTexts: string[]): Array<{ text: string; delete: ReturnType<typeof vi.fn> }> {
  const items = paragraphTexts.map((text) => ({ text, delete: vi.fn() }));
  (global as unknown as Record<string, unknown>).Word = {
    InsertLocation: { end: 'End' },
    run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
      cb({
        document: { body: { paragraphs: { load: vi.fn(), items } } },
        sync: vi.fn().mockResolvedValue(undefined),
      }),
    ),
  };
  return items;
}
```

**Phase 9 扩展 mockWord：** 需要在 `items` 元素中增加 `font` / `lineSpacing` / `spaceBefore` / `spaceAfter` / `alignment` / `firstLineIndent` / `leftIndent` / `style` / `styleBuiltIn` 字段，以及 `tables` 集合 mock，供 5 个新 write method 的单元测试使用。`afterEach` 的 `delete global.Word` 已存在（line 108），新测试无需重复。

---

#### C. deleteChartByName 守门（模仿对象 — mock adapter 模式）

**Analog:** `operationLog.integration.test.ts` lines 193–217（Excel deleteChartByName 守门）

```typescript
// lines 193-217（最简 mock adapter 模式，Phase 9 Word 守门完全复用此结构）
it('单步撤销 insert_chart：deleteChartByName 收 Record 对象（不抛 TypeError）', async () => {
  const deleteChartByNameFn = vi.fn(async (_args: Record<string, unknown>): Promise<void> => {});
  const mockAdapter: DocumentAdapterForReplay = { deleteChartByName: deleteChartByNameFn };
  // ...entry 构造 + replayUndoSingle + 三个 expect...
});
```

---

### `src/agent/contract.test.ts` — 5 行 integrationTest: false → true

**Analog:** `contract.test.ts` lines 35–39（Phase 9 五行现有声明）

```typescript
// src/agent/contract.test.ts lines 35-39（实现完成后逐行改 false → true）
{ toolName: 'set_word_character_format', host: 'word', undoType: '简单逆向', reverseTool: 'restore_range_font', phase: 9, integrationTest: false },
{ toolName: 'set_word_paragraph_format', host: 'word', undoType: '简单逆向', reverseTool: 'restore_paragraph_format', phase: 9, integrationTest: false },
{ toolName: 'apply_paragraph_style', host: 'word', undoType: '简单逆向', reverseTool: 'restore_paragraph_style', phase: 9, integrationTest: false },
{ toolName: 'find_and_replace', host: 'word', undoType: '快照式', reverseTool: 'restore_range_snapshot', phase: 9, integrationTest: false },
{ toolName: 'insert_table', host: 'word', undoType: '简单逆向', reverseTool: 'delete_table_by_marker', phase: 9, integrationTest: false },
```

**规则（D-18 三步门）：** 每个 `false → true` 改动必须同时满足：
1. `operationLog.integration.test.ts` 中 `toolName` 字符串字面量已出现（D-17 硬卡，`contract.test.ts` lines 114-137 用 `fs.readFileSync` 验证）
2. `WordAdapter.ts` 对应 inverse 方法已实现
3. `CONTRACT.md` 对应行 `status: planned → done`

---

### `src/agent/tools/index.ts` — buildToolsForHost('word') 注册 5 新工具

**Analog:** `tools/index.ts` lines 193–205

```typescript
// src/agent/tools/index.ts lines 193-205（现有 word 注册，追加 5 个工具）
case 'word': {
  const wordWriteTools = [
    appendParagraph, insertParagraph, replaceParagraph,
    insertTextAtCursor, replaceSelection,
  ] as ToolDef[];
  wordWriteTools.forEach(assertWriteToolRegisterable);
  return [
    getDocumentFullText, getParagraphCount, getParagraphAt, getDocumentOutline,
    ...wordWriteTools, selectionDetail,
  ].map((t) => t as ToolDef);
}
```

**Phase 9 适配：** 在 `wordWriteTools` 数组追加 5 个新工具（`setWordCharacterFormat, setWordParagraphFormat, applyParagraphStyle, findAndReplace, insertTable`）。`assertWriteToolRegisterable` 守门自动覆盖。import 在文件顶部从 `'./write/word'` 追加。

---

### 测试文件：`src/adapters/WordAdapter.read.test.ts` / `src/agent/tools/write/word.test.ts`

---

#### A. WordAdapter.read.test.ts — selection_detail 扩展单测

无现有同名文件可直接参照，但 mockWord 工厂提供了 Office.js mock 基础设施（lines 33–45）。单测模式：

```typescript
// 模式：参照 integration test 的 mockWord，mock 返回含 paragraphs 的 ctx
// 断言：selection_detail 返回 { paragraphIndex: N, uniqueLocalId: 'xxx' | null }
```

---

#### B. word.test.ts — D-08 allowlist 拒绝测试（apply_paragraph_style）

**Analog:** 无现有 word.test.ts（RESEARCH.md 标注 Wave 0 Gap）。模式参照 `contract.test.ts` 中对 `toolName` 的字符串断言风格 + `tools/index.ts` 的 `dispatchTool` 调用路径。

核心测试内容（RESEARCH.md Q3 allowlist 代码）：
```typescript
// 调用 apply_paragraph_style，传入非法 styleName（如 "标题1"）
// 断言：工具返回 { ok: false, error: { code: 'INVALID_PARAM' } }（在调 Word 之前拦截）
// 断言：mockWord.run 未被调用（Word API 未触及）
```

---

## Shared Patterns

### S1. Record 签名约束（D-17 — 数据安全硬门，最重要）

**Source:** `src/adapters/WordAdapter.ts` lines 155–167（JSDoc 注释） + `src/agent/tools/write/word.ts` lines 14–15（文件头注释）

**Apply to:** 所有 5 个 inverse adapter 方法 + 所有 5 个 ToolDef 的 `reverse.args`

```typescript
// 签名：(args: Record<string, unknown>) => Promise<void>
// 方法体第一行解包：const field = args.field as Type;
// ToolDef reverse.args：字面量 Record 对象，不用变量展开
```

历史教训（直接写在代码注释里）：Phase 5 位置签名 `(text: string)` 收到 `executeReverse` 传来的对象，`normalizeText` 对对象调 `.replace` 抛 TypeError，全部 inverse 被误判 `skipped_error`。

---

### S2. HostApiError 错误包装

**Source:** `src/adapters/WordAdapter.ts` lines 53–55, 143–146, 183–190

**Apply to:** 所有 adapter 方法

```typescript
// 外层 try/catch：
try {
  return await Word.run(async (ctx) => {
    // ... 内部对 HostApiError 直接 re-throw ...
    if (err instanceof HostApiError) throw err;
  });
} catch (err) {
  if (err instanceof HostApiError) throw err;  // 内层已包装的不再重包
  throw new HostApiError('Word xxx 失败', err); // 陌生异常包装，第二参传 err（不存 stack）
}
```

---

### S3. normalizeText 内容指纹

**Source:** `src/adapters/WordAdapter.ts` lines 23–25

**Apply to:** 所有涉及段落文本比对的 adapter 方法（inverse 定位、before-image 匹配）

```typescript
function normalizeText(s: string): string {
  return s.replace(/\r\n/g, '\n').trimEnd();
}
```

Word API 返回的段落 text 末尾可能含 `\r`，normalizeText 消除差异，防 false-skip。

---

### S4. assertWriteToolRegisterable（注册守门）

**Source:** `src/agent/tools/index.ts` lines 172–178

**Apply to:** 所有加入 `wordWriteTools` 数组的新 ToolDef

每个新 ToolDef 必须有 `humanLabel` 函数，否则 `assertWriteToolRegisterable` 抛 Error，构建阶段即失败。

---

### S5. D-17 三步守门（每工具必须完整）

**Source:** `src/agent/contract.test.ts` lines 114–137（fs.readFileSync 硬卡）

**Apply to:** 5 个 Phase 9 工具，实现完成时三步同时完成：

1. `operationLog.integration.test.ts` 中 `toolName` 字符串字面量出现（D-17 硬卡扫描目标）
2. `contract.test.ts` 对应行 `integrationTest: false → true`
3. `CONTRACT.md` 对应行 `status: planned → done` + `integration_test: false → true`

---

## No Analog Found

无。所有文件在本 codebase 中都有直接的同文件内或同类型文件内的最佳模拟。

---

## Metadata

**Analog search scope:** `src/adapters/`, `src/agent/`, `src/agent/tools/write/`, `src/agent/tools/`

**Files scanned:** 5 source files（WordAdapter.ts, tools/write/word.ts, operationLog.ts, operationLog.integration.test.ts, contract.test.ts, tools/index.ts）

**Pattern extraction date:** 2026-05-30

**Critical path note:** D-17 Record 签名约束是本 phase 最重要的横切约束——Phase 5 真机 UAT 历史翻车点，任何 inverse 方法签名偏离此约束会导致全部 Word undo 静默失败（skipped_error 而非 rolled_back），且单测全绿（只有 integration test 能守住）。
