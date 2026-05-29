# Phase 5: Diff Log + Undo All 跨 3 宿主 - Pattern Map

**Mapped:** 2026-05-30
**Files analyzed:** 15 (8 modified, 7 new)
**Analogs found:** 15 / 15（全部有强分析；本 phase 是「实现」非「探索」，所有新文件都有同仓既有范式可抄）

> 所有引用行号基于映射时的源文件状态。executor 落地前以 read_first 实读为准。

---

## File Classification

| New/Modified File | New/Mod | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|---------|------|-----------|----------------|---------------|
| `src/agent/operationLog.ts` | modified | store/utility（纯内存 Map + replay engine） | event-driven（每 write 步 append）+ batch（逆序 replay） | 自身（Phase 3 骨架）+ `circuit-breaker.ts`（模块级 Map 状态 + reset-for-test 范式） | exact |
| `src/agent/agentStore.ts` | modified | store（Zustand） | event-driven（undo action） | 自身（已有 action set/get 范式） | exact |
| `src/agent/tools/write/word.ts` | modified | tool（write） | request-response | 自身（append_paragraph 已完整） | exact |
| `src/agent/tools/write/ppt.ts` | new | tool（write） | request-response | `write/word.ts` appendParagraph ToolDef | exact |
| `src/agent/tools/write/excel.ts` | new | tool（write） | request-response | `write/word.ts` appendParagraph ToolDef | exact |
| `src/agent/tools/index.ts` | modified | registry/type（ToolResult 扩 postState + buildToolsForHost 注册 + lint enforce 支撑） | request-response | 自身 | exact |
| `src/adapters/WordAdapter.ts` | modified | adapter（inverse 写方法 deleteParagraphByContent） | file-I/O（Office.js write） | 自身 `appendParagraph` + `read('get_paragraph_*')` | exact |
| `src/adapters/PptAdapter.ts` | modified | adapter（insertSlideAfter + deleteSlideByTitle） | file-I/O | 自身 `read('list_slides')`（TEXT_SHAPE_TYPES + .sort + 三 sync 范式） | exact |
| `src/adapters/ExcelAdapter.ts` | modified | adapter（setRangeValues before-image + overwriteRange） | file-I/O | 自身 `read('get_range_values')` + `insert()` two-sync | exact |
| `src/components/DiffLogPanel.tsx` | new | component | event-driven（订阅 store + 触发 undo） | `ChatStream.tsx` `MergedToolGroup`（折叠卡 + tool-group）+ `OnboardingModal.tsx`（modal-scrim） | exact（视觉）+ role-match（逻辑） |
| `src/components/ChatStream.tsx` | modified | component（挂载点） | event-driven | 自身（render 分发 + lazy 挂点） | exact |
| `src/lib/storage.ts` | modified | utility（setItem quota guard） | request-response | 自身 + `src/errors/index.ts` AsterError 子类 | exact |
| `src/lib/copyStepLog.ts` | new | utility（纯函数 dump + 脱敏 + clipboard） | transform + batch | `src/lib/debugReport.ts`（5 节 dump + redact + copyToClipboard + 懒加载） | exact |
| `eslint.config.js` | modified | config（humanLabel/reverse enforce flip） | n/a | 自身（D-13 已埋占位 + flip 步骤注释） | exact |
| 新增测试 `*.test.ts`（operationLog / copyStepLog / WordAdapter / ExcelAdapter / word(扩展)） | new/mod | test | n/a | `operationLog.test.ts` / `storage.test.ts` / `word.test.ts` / `index.types.test.ts` | exact |

> 注：`src/lib/storage.test.ts` 与 `src/agent/operationLog.test.ts` **已存在**（不是新建）——本 phase 是**扩展**它们（storage 加 quota guard 用例；operationLog 改 Map<runId> CRUD + replay 用例）。RESEARCH「Wave 0 Gaps」标的 ❌ 应理解为「缺对应新行为的用例」，文件本身在。

---

## Pattern Assignments

### `src/agent/operationLog.ts` (store/utility, event-driven + batch)

**Analog:** 自身（Phase 3 骨架）+ `src/agent/circuit-breaker.ts`（模块级 Map 状态机范式）

**现有骨架全文**（`operationLog.ts` 1-40）——重构基线，保留 `ReverseDescriptor` / `OperationLogEntry` / `appendOperation` / `__resetOperationLogForTest` 的导出名（loop-helpers + 测试都在调）：
```typescript
const operationLog: OperationLogEntry[] = [];                       // → 改为 Map<string, OperationLogEntry[]>
export function appendOperation(entry: OperationLogEntry): void {   // 签名不变，内部改 Map.get/push/set
  operationLog.push(entry);
}
export function getOperationsByRun(runId: string): OperationLogEntry[] {  // 保留兼容；新增 getWriteOpsByRun 过滤 reverse
  return operationLog.filter((o) => o.runId === runId);
}
export function __resetOperationLogForTest(): void { operationLog.length = 0; }  // → operationLogMap.clear()
```

**关键约束 — 导出名向后兼容：** `loop-helpers.ts:18,155` 调 `appendOperation`，`operationLog.test.ts` 调 `getOperationsByRun` + `__resetOperationLogForTest`。重构 Map 后这三个名**必须保留**（签名可不变），否则连带改 loop-helpers + 旧测试。RESEARCH Pattern 1 建议新增 `getWriteOpsByRun(runId)` / `clearRun(runId)` 而非替换 `getOperationsByRun`。

**模块级 Map + reset-for-test 范式**（抄 `circuit-breaker.ts`——同样是 agent 层模块级可变状态 + 测试 reset）：
```typescript
// circuit-breaker.ts 范式：模块级 Map<string, ...> + 纯函数 record/query/reset
// operationLog.ts 照此：const operationLogMap = new Map<string, OperationLogEntry[]>();
//                       export function __resetOperationLogForTest(): void { operationLogMap.clear(); }
```

**replay engine（新增）：** 见 RESEARCH Pattern 3（`replayUndoAll` / `replayUndoStep`）。`UndoResult` 三态结构（`rolledBack` / `skippedManualChange` / `skippedHostError` + `details[]`）直接对齐 UI-SPEC「Undo-all 总结 modal 三态文案」。**D-11 continue-on-error 靠 `replayUndoStep` 内 try/catch 不 rethrow 实现**（RESEARCH L514-532）。

**Office namespace 边界（关键 — eslint 守门）：** `eslint.config.js:107-118` 禁止 `src/agent/**` 出现 `Word`/`Excel`/`PowerPoint` 全局。所以 **replay engine 绝不能直接调 Office.js**——必须通过 `adapter` 的 inverse 方法。`replayUndoStep(entry, adapter)` 签名收 `DocumentAdapter`，调 `adapter.read(...)` 比对 + `adapter.deleteParagraphByContent(...)` 等 inverse 方法。

---

### `src/agent/tools/write/word.ts` (tool, request-response) — 改 reverse 精确定位

**Analog:** 自身（已是完整 ToolDef 模板）

**当前 execute + reverse**（`word.ts:38-46`）——把 `delete_last_paragraph` 改为精确定位，并加 `postState`：
```typescript
async execute({ text }, ctx): Promise<ToolResult> {
  await (ctx.adapter as WordAdapter).appendParagraph(text);
  const reverse: ReverseDescriptor = {
    tool: 'delete_last_paragraph',   // ← 改为 'delete_paragraph_by_content', args: { text }
    args: {},
  };
  return { ok: true, data: { written: text.length }, reverse };  // ← 加 postState（见下）
}
```
目标形态见 RESEARCH「Code Examples」L854-865：`reverse: { tool:'delete_paragraph_by_content', args:{text} }` + `postState: { kind:'word_paragraph', content:text }`。

**连带改测试** `word.test.ts:82`——当前 assert `reverse).toEqual({ tool: 'delete_last_paragraph', args: {} })`，必须同步改为 `delete_paragraph_by_content` + `args:{text}`，并新增 `result.reverse !== undefined` + `postState` 断言（TOOL-04 验收）。

---

### `src/agent/tools/write/ppt.ts` / `excel.ts` (tool, request-response) — 新建

**Analog:** `src/agent/tools/write/word.ts` 全文（`appendParagraph` ToolDef 结构）

**ToolDef 模板（抄 word.ts:22-47 全套字段）：**
```typescript
export const appendParagraph: ToolDef<AppendParagraphArgs> = {
  name: 'append_paragraph',
  kind: 'write',                                    // ← 必须 'write'（loop setPhase + lint enforce 范围）
  description: '...优先一次回复里调多次...',           // LLM 可读
  parameters: { type: 'object', properties: {...}, required: [...] },
  humanLabel: ({ text }) => `在文档末尾追加段落「${text.slice(0, 30)}…」`,  // 截断 + 省略号范式
  async execute({ text }, ctx): Promise<ToolResult> {
    await (ctx.adapter as WordAdapter).appendParagraph(text);   // A-06：adapter 输入纯数据/输出 void|纯数据
    const reverse: ReverseDescriptor = { tool:'...', args:{...} };
    return { ok: true, data: {...}, reverse };
  },
};
```
- **excel.ts `set_range_values`：** execute 调 `(ctx.adapter as ExcelAdapter).setRangeValues(address, values)` 拿 `beforeImage`，reverse = `{ tool:'overwrite_range', args:{ address:beforeImage.address, values:beforeImage.values } }`，postState = `{ kind:'excel_range', content:{ address, values } }`（RESEARCH L874-885）。
- **ppt.ts `insert_slide`：** execute 调 `(ctx.adapter as PptAdapter).insertSlideAfter(...)` 拿 `{ insertedIndex, title }`，reverse = `{ tool:'delete_slide_by_title', args:{ titleFingerprint:title } }`，postState = `{ kind:'ppt_slide', content:{ index, title } }`。

**注册到 registry**（`tools/index.ts:173-191` `buildToolsForHost`）——把新 write tool 加进对应 host 分支：
```typescript
case 'excel':
  return [ listWorksheets, getRangeValues, getUsedRangeSummary, selectionDetail,
           setRangeValues /* 新增 */ ].map((t) => t as ToolDef);
case 'ppt':
  return [ listSlides, getSlide, listShapesOnSlide, getShape, selectionDetail,
           insertSlide /* 新增 */ ].map((t) => t as ToolDef);
```
**同时把 inverse 方法注册成可被 replay 调用的 reverse tool**——reverse descriptor 的 `tool` 名（`delete_paragraph_by_content` / `overwrite_range` / `delete_slide_by_title`）需有一个 replay 期的「reverse 执行器」映射到 adapter inverse 方法。这是 Claude's Discretion 的落地点（RESEARCH Open Question 3 + Pattern 3 `executeReverse`）。

---

### `src/adapters/WordAdapter.ts` (adapter, file-I/O) — 新增 deleteParagraphByContent

**Analog:** 自身 `appendParagraph`（`WordAdapter.ts:129-138`）+ `read('get_paragraph_count')`（154-167，`paras.load('items/text')` + 遍历）

**Office.js 写方法范式**（抄 `appendParagraph:129-138`——A-06 边界注释 + try/catch → HostApiError）：
```typescript
async appendParagraph(text: string): Promise<void> {
  try {
    await Word.run(async (ctx) => {
      ctx.document.body.insertParagraph(text, Word.InsertLocation.end);
      await ctx.sync();
    });
  } catch (err) {
    throw new HostApiError('Word append_paragraph 失败', err);  // 构造器不存 hostError（防 stack 泄漏）
  }
}
```

**遍历段落定位范式**（抄 `read('get_paragraph_count'):158-163`——`paras.load('items/text')` + sync + items 访问）。`deleteParagraphByContent` 见 RESEARCH Pattern 2 Word L280-298：尾到头遍历 `paras.items`，`normalizeText` 比对，`paras.items[i].delete()` + sync。**normalizeText**（L301-303）= `s.replace(/\r\n/g,'\n').trimEnd()`——防 Pitfall 2 false-skip。

---

### `src/adapters/PptAdapter.ts` (adapter, file-I/O) — 新增 insertSlideAfter + deleteSlideByTitle

**Analog:** 自身 `read('list_slides')`（`PptAdapter.ts:191-245`）——三 sync + `.sort((a,b)=>a.index-b.index)`（PPT-05 守则）+ `TEXT_SHAPE_TYPES` 过滤 + title 抽取

**title 抽取 + 排序范式**（抄 `list_slides:198-234`，**必须复用**，deleteSlideByTitle 的指纹比对靠它）：
```typescript
const TEXT_SHAPE_TYPES = new Set<string>(['GeometricShape','TextBox','Placeholder','Callout']);  // 模块级（line 38）
const sorted = [...slides.items].sort((a, b) => a.index - b.index);   // PPT-05 绕 Web 反序 bug #3618
for (const slide of sorted) slide.shapes.load('items/type');          // sync 2
// ... sync 3 load 文本形状 textRange.text
// title = 第一个文本形状首行 .split('\n')[0].trim()
```
- `warnHostErr(kind, err)`（line 27-30）+ `throw new HostApiError(...)` 错误范式照搬。
- `insertSlideAfter` / `deleteSlideByTitle` 完整草图见 RESEARCH Pattern 2 PPT L394-455。**undo all 用自有 OperationLog 逆序遍历（不调 getSelectedSlides）绕排序不确定性**（SP-5 策略 / D-05）。

---

### `src/adapters/ExcelAdapter.ts` (adapter, file-I/O) — 新增 setRangeValues + overwriteRange

**Analog:** 自身 `read('get_range_values')`（`ExcelAdapter.ts:191-229`，`range.load(['cellCount',...])` + 两 sync）+ `insert()` two-sync（102-151）

**two-sync 写 + before-image 抓取范式**（抄 `get_range_values` 的 `getRange` + `range.load(['values','address'])` + `insert()` 的 sync1-load / sync2-write 节律）：
```typescript
// ExcelAdapter two-sync 守则（line 96-101 注释强制）：load → sync 1 → write → sync 2
const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
range.load(['values', 'address']); await ctx.sync();   // sync 1: 抓 before-image
const beforeImage = { address: range.address, values: range.values };
range.values = values; await ctx.sync();               // sync 2: 覆写
```
完整 `setRangeValues` / `overwriteRange` 见 RESEARCH Pattern 2 Excel L330-353。错误包 `HostApiError('Excel ... 失败', err)`（照 `read` 各 case）。比对规范化（空单元格 null/0/"" 归一）见 RESEARCH A2 + Pitfall 2——Wave 0 单测覆盖。

---

### `src/components/DiffLogPanel.tsx` (component, event-driven) — 新建

**Analog:** `ChatStream.tsx` `MergedToolGroup`（213-254，折叠卡 + tool-group 范式）+ `OnboardingModal.tsx`（modal-scrim 二次确认）+ `InputBar.tsx`（copy 反馈 — 不在本组件，但 modal 焦点逻辑同源）

**折叠卡范式**（抄 `MergedToolGroup:223-254`——`.tool-group` 容器 + `.tool-group__head` + `.tool-group__count` + `.tool-group__list > li` + `.wb-action-head` + `ChevronDownIcon className={isOpen?'is-up':''}`）：
```tsx
<div className="tool-group">   {/* UI-SPEC: 必须加 flex-shrink:0，否则被 .aster-messages flex column 压扁 */}
  <div className="tool-group__head">
    <ChevronDownIcon size={11} className={expanded ? 'is-up' : ''} />
    <span className="tool-group__count"><Trans>本次改动 {N} 处</Trans></span>
  </div>
  <ul className="tool-group__list">
    {writeEntries.map((e) => (
      <li key={...} className={isUndone ? 'is-undone' : isErr ? 'is-error' : undefined}>
        <span className="wb-action-target">{e.humanLabel}</span>
        <button className="btn btn-ghost btn-sm" onClick={...}><Trans>撤销该步</Trans></button>
      </li>
    ))}
  </ul>
</div>
```

**二次确认 / 总结 modal 范式**（抄 `OnboardingModal.tsx:48-49`——`.modal-scrim role="dialog" aria-modal="true"` + `.modal`，内含 `.modal-title` / `.modal-body` / `.modal-foot`；ghost「取消」+ teal `.btn-primary`「确认撤销」gap 16px）：
```tsx
<div className="modal-scrim" role="dialog" aria-modal="true" aria-labelledby="...">
  <div className="modal"> ... </div>
</div>
```

**结构草图 + 状态机**（expanded / confirming / undoResult 三态）见 RESEARCH Pattern 4 L546-585 + UI-SPEC「Component Inventory」表。

**bundle 守门（NFR-05 — 极紧）：** UI-SPEC 建议 `React.lazy(() => import('./DiffLogPanel'))` + `<Suspense>`，把 panel + undo UI 移出初始 main chunk（run 完成才需要）。挂载在 ChatStream 末尾。

**runId 隔离（Pitfall 3）：** props 收 `runId`，只调 `getWriteOpsByRun(runId)`——绝不订阅全局，防多轮混渲。

---

### `src/components/ChatStream.tsx` (component) — 挂载 DiffLogPanel

**Analog:** 自身（render 分发循环 315-346 + 末尾 return 347-352）

挂点：在 `nodes` 数组末尾、`agentStatus === 'idle'` 且该 runId write ops > 0 时追加 `<DiffLogPanel runId={runId}/>`。RESEARCH Open Question 2：`agentStore` 需加 `completedRunIds: string[]`（endRun 时 push），或从 `messages` 的 `agentRunId` 字段重建 runId 集合（`ChatStream.tsx:134-135` 已有从 messages 按 `agentRunId` 过滤的范式可抄）。

---

### `src/lib/storage.ts` (utility, request-response) — setItem quota guard

**Analog:** 自身 `set()`（`storage.ts:68-70` 裸调）+ `src/errors/index.ts` AsterError 子类（如 `UnsupportedOperationError:207-213`，recoverable + hint 字面量范式）

**当前裸 set**（`storage.ts:67-70`）——包 try/catch：
```typescript
set(rawKey: string, value: unknown): void {
  localStorage.setItem(prefixedKey(rawKey), JSON.stringify(value));   // ← 包 try/catch
}
```

**新建 StorageQuotaError**（抄 `errors/index.ts` AsterError 子类范式——`public readonly recoverable` + `public readonly hint` 字面量 + `super(message, code, category)`，见 `UnsupportedOperationError:207-213`）。完整实现见 RESEARCH Pattern 6 L640-661：检测 `err instanceof DOMException && (err.name==='QuotaExceededError' || err.code===22)` → throw `StorageQuotaError`；其它错误原样 rethrow。**不做 LRU 清除**（D-14）。

**测试** 扩 `storage.test.ts`（已存在，169 行）——加用例：`vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => { throw new DOMException(...) })` → `expect(() => storage.set(...)).toThrow(StorageQuotaError)`（RESEARCH L894-899）。注意现有测试用 `vi.stubGlobal('localStorage', mock)`，新用例需 spy 让 mock setItem 抛 DOMException。

---

### `src/lib/copyStepLog.ts` (utility, transform + batch) — 新建

**Analog:** `src/lib/debugReport.ts` 全文（5 节 Markdown dump + redact + `copyToClipboard` + 懒加载）

**dump 范式**（抄 `debugReport.ts:28-50` `buildDebugReport` 的 `sections.push(...)` + `buildChatSection:215-248` 的 messages 遍历）：
```typescript
// buildChatSection 范式：遍历 useChatStore.getState().messages，按 role 格式化行
for (const msg of messages) {
  const time = formatTime(msg.ts ?? 0);
  let line = `[${time} ${msg.role}] ${content}`;
  if (msg.role === 'tool') line += ` | toolName=${msg.toolName} ok=${msg.toolResult?.ok}`;
}
```
copyStepLog = 三角色（user/assistant/tool）+ tool name + humanLabel + result，时间序 dump（D-19）。Markdown 默认 + JSON 备选（D-20）。

**clipboard 范式（直接复用，不重写）：** `copyToClipboard`（`debugReport.ts:261-282`）已实现 `navigator.clipboard.writeText` 主 + `textarea+execCommand` fallback + 失败静默。UI-SPEC「Interaction Contract」明确「复用 `debugReport.ts` `copyToClipboard`」——`import { copyToClipboard } from './debugReport'`，不再造。

**脱敏（D-21 / Pitfall 5 / 安全约束）：** 抄 `debugReport.ts` 安全注释（line 9-13「绝不调 getKey()、绝不读 aster:keys:*、只输出 id 列表」）。`debugReport.test.ts:91-96` 已有脱敏断言范式：写入 `'sk-SECRET-abc123'` → `expect(report).not.toContain('sk-SECRET-abc123')`——copyStepLog.test.ts 照搬。

**懒加载（NFR-05）：** UI-SPEC + 记忆 [[project_bundle_size_guard]]——`InputBar.tsx:69-77` 的 `handleCopyDebug` 已是范式（`const { ... } = await import('../lib/debugReport')` onClick 时才加载）。copyStepLog 同样懒加载，0 初始体积。新「复制操作记录」按钮直接并列 `InputBar.tsx:120-128` 的「复制调试信息」按钮（同 `.tool-btn` + 2s `copied` 反馈 + `ClipboardIcon`/`CheckIcon`）。

---

### `eslint.config.js` (config) — humanLabel/reverse enforce flip

**Analog:** 自身（D-13 已埋占位 + 详细 flip 步骤注释，`eslint.config.js:50-71`）

**当前占位**（line 62）+ flip 步骤（line 67-71 注释逐字给了三步）：
```javascript
'aster/require-human-label': 'off', // 占位 — 自写 plugin 尚未发布，留 key 备 Phase 5 flip
// flip：1. 新建 local plugin rule 'require-human-label'
//       2. AST visitor 检查 typeAnnotation.typeName==='ToolDef' 且 init.properties 不含 humanLabel
//       3. 把 'off' 改为 'error'
```
**双轨主守门是 TS**（`index.types.test.ts` — `@ts-expect-error` 反例 + `ToolDef.humanLabel` 必填字段，`tools/index.ts:63`）。`humanLabel` 已是 TS 硬强制。**reverse 强制是新的**——`ToolResult.reverse?` 仍可选（`tools/index.ts:49`），write tool 缺 reverse TS 表达不出（kind 与 reverse 解耦）。RESEARCH Pattern 5 L613-619 建议：**runtime assert + 测试断言**（每个 write/*.test.ts assert `result.reverse !== undefined`）作守门，而非纯类型。Claude's Discretion 落地。

---

## Shared Patterns

### A-06 Office namespace 边界（最强守门 — 影响所有 adapter inverse + replay engine）
**Source:** `eslint.config.js:106-119`（`no-restricted-globals` 禁 `Word`/`Excel`/`PowerPoint` 于 `src/agent/**` + `src/store/**`）+ 各 adapter「proxy 不出 *.run 闭包」注释
**Apply to:** `operationLog.ts`（replay engine 必须经 adapter，不直接碰 Office.js）、所有 adapter inverse 方法（各自开闭一次 `*.run`，输入/输出纯数据）、新 write tool（execute 通过 `ctx.adapter as XxxAdapter` 调，不碰 proxy）
```typescript
// adapter inverse 方法：在自己的 *.run 闭包内开闭一次，输入纯数据、输出 void|纯数据
async deleteParagraphByContent(text: string): Promise<void> {
  await Word.run(async (ctx) => { ...; await ctx.sync(); });  // proxy 生命周期不出闭包
}
```

### 错误处理 — HostApiError 包裹（adapter 层）+ sanitize 边界（dispatch 层）
**Source:** `src/errors/index.ts` `HostApiError:188-198`（构造器**不存** hostError，防 stack 跨边界）+ `tools/index.ts:115-161` `dispatchTool` sanitize
**Apply to:** 所有 adapter inverse 方法（catch → `throw new HostApiError('...失败', err)`）；replay engine 的 reverse 执行 try/catch（D-11：报错标 `skipped_error` 继续，不 rethrow）
```typescript
} catch (err) {
  throw new HostApiError('Word deleteParagraphByContent 失败', err);  // 调试靠 console.warn，不挂实例字段
}
```

### AsterError 子类范式（业务异常）
**Source:** `src/errors/index.ts`（10 个子类，`public readonly recoverable` + `public readonly hint` 中文字面量 + `super(message, code, category)`）
**Apply to:** `storage.ts` 新 `StorageQuotaError`（category `'adapter'`，code `'STORAGE_QUOTA'`，hint 字面量「浏览器存储空间已满…」）

### 折叠卡 + modal 视觉范式（teal 克制 — 零新组件）
**Source:** `ChatStream.tsx` `MergedToolGroup:213-254`（`.tool-group`/`.wb-action-head`/`ChevronDownIcon.is-up`）+ `OnboardingModal.tsx:48-49`（`.modal-scrim`/`.modal`）+ `InputBar.tsx:120-128`（copy 按钮 2s 反馈）
**Apply to:** `DiffLogPanel.tsx`（汇总卡 + 二次确认/总结 modal）+ copy 按钮
**关键坑（UI-SPEC + 记忆）：** 汇总卡容器必须 `flex-shrink: 0`（被 `.aster-messages` flex column 压扁——真机 UAT 踩过）；`.is-undone` / `.badge-success`/`warning`/`error` 部分类需按 design 包补 CSS；dark 主题逐项 QA（绿/琥珀对比度）。所有 UI 改动走 `Skill("aster-design-system")`。

### Lingui i18n（zh-CN）
**Source:** `ChatStream.tsx:37,228`（`import { Trans } from '@lingui/react/macro'` + `<Trans>{N} 项操作</Trans>`）+ `InputBar.tsx:19,33`（`useLingui` + `t\`...\``）
**Apply to:** DiffLogPanel 全部字串、copy 按钮 label、modal 文案。动态量词（N 处 / X 步）用 Lingui plural/占位符。落地后跑 `npm run` lingui extract（参考最近 commit `lingui extract`）。

### Vitest 单测范式
**Source:** `word.test.ts`（ToolDef mock adapter + makeCtx + execute 断言）+ `storage.test.ts`（vi.stubGlobal mock + describe 分组）+ `operationLog.test.ts`（beforeEach `__resetOperationLogForTest`）+ `index.types.test.ts`（`@ts-expect-error` type-only 验收）
**Apply to:** 所有新/扩展测试
```typescript
// word.test.ts mock adapter 范式（adapter inverse 测试照此 mock Office.js 写方法）
function makeCtx(adapter): ToolExecContext {
  return { adapter, runId: 'r1', stepIndex: 1, signal: new AbortController().signal };
}
beforeEach(() => { __resetOperationLogForTest(); });  // operationLog Map<runId> CRUD 测试
```

### loop 集成点（reverse 落 OperationLog）— 已就位，本 phase 微调 postState 透传
**Source:** `loop-helpers.ts:117-161` `runOneToolCall`——L154-159 已在 `result.reverse && def` 时调 `appendOperation`
**Apply to:** 本 phase 需让 `appendOperation` 多收 `postState`（从 `result.postState` 透传）。RESEARCH Open Question 3 建议：`postState?: PostStateSnapshot` 加进 `ToolResult`（`tools/index.ts:45-50`），write tool execute 返回，`loop-helpers.ts:155-158` 透传给 `appendOperation`——operationLog.ts 不需知道各宿主 read API（保 A-06 边界）。
```typescript
// loop-helpers.ts:154-159 现状（加 postState: result.postState）：
if (result.reverse && def) {
  appendOperation({
    runId, stepIndex: step, toolName: tc.name, args: tc.arguments,
    humanLabel, reverse: result.reverse, /* postState: result.postState, */ timestamp: Date.now(),
  });
}
```

---

## No Analog Found

无。所有 15 个文件均有同仓既有强范式可抄——本 phase 是「实现 / 升级既有骨架」，不是引入新架构域。RESEARCH 自评「没有架构层的不确定性——工作是『实现』而非『探索』」（SP-4/SP-5 真机 PASS）。唯一需 Claude's Discretion 设计而非抄的点：

| 设计点 | 不是「无范式」，是「需决策具体形态」 | 参考 |
|--------|------------------------------------|------|
| reverse 执行器映射（reverse.tool 名 → adapter inverse 方法） | RESEARCH Pattern 3 `executeReverse` + Open Question 3 | replay engine 内 switch on `reverse.tool` |
| `completedRunIds` 来源（DiffLogPanel 挂载需要） | RESEARCH Open Question 2 | agentStore 加字段 或 从 messages.agentRunId 重建 |
| reverse 必填的 enforce 写法（TS 表达不出 kind↔reverse） | RESEARCH Pattern 5 + D-15 | runtime assert + 每个 write test 断言 |

---

## Metadata

**Analog search scope:** `src/agent/`（operationLog / tools / loop / agentStore / errors 邻接）、`src/adapters/`（三宿主 + DocumentAdapter）、`src/components/`（ChatStream / InputBar / Onboarding）、`src/lib/`（storage / debugReport）、`eslint.config.js`、`src/store/chat.ts`
**Files scanned (read full):** 18 源文件 + 4 测试 + 1 config
**Pattern extraction date:** 2026-05-30
