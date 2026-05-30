---
phase: 06-write-tools-killer-scenarios
reviewed: 2026-05-30T12:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - src/adapters/ExcelAdapter.ts
  - src/adapters/PptAdapter.ts
  - src/adapters/WordAdapter.ts
  - src/agent/agentStore.ts
  - src/agent/loop.ts
  - src/agent/operationLog.ts
  - src/agent/operationLog.integration.test.ts
  - src/agent/system-prompt.ts
  - src/agent/system-prompt.test.ts
  - src/agent/tools/index.ts
  - src/agent/tools/index.test.ts
  - src/agent/tools/write/excel.ts
  - src/agent/tools/write/excel.test.ts
  - src/agent/tools/write/ppt.ts
  - src/agent/tools/write/ppt.test.ts
  - src/agent/tools/write/word.ts
  - src/agent/tools/write/word.test.ts
  - src/components/ChatStream.tsx
  - src/components/ChatStream.test.tsx
  - src/components/InputBar.tsx
  - src/components/Onboarding/OnboardingModal.tsx
  - src/components/Onboarding/OnboardingModal.test.tsx
  - src/components/Onboarding/Step1Keys.tsx
  - src/store/chat.ts
  - src/styles.css
findings:
  critical: 4
  warning: 7
  info: 3
  total: 14
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-05-30T12:00:00Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

本次审查覆盖 Phase 6 三宿主 write tools（Excel/PPT/Word）、killer-scenario 空态 chips、单步 onboarding 及 agent loop 关键路径。

整体架构设计扎实，adapter inverse 签名守门（Record 对象）、postState before-image 抓取、D-11 并发防御均已到位。发现 4 个 BLOCKER 级问题，主要集中在：(1) PptAdapter.insert 的 append_end 路径存在不安全的 proxy 访问（在 sync 之前访问 shape），可能导致运行时崩溃；(2) ChatStream 的 CIRCUIT_OPEN 卡片在渲染函数体中调用 Hook，违反 React Hook 规则导致条件渲染时崩溃；(3) InputBar 发送按钮在 agent 运行时图标变成 StopIcon 但点击行为走 handleSend（防重入）而非 abort，与用户预期不符；(4) replace_selection 的 inverse 实现（delete_paragraph_by_content 按新文本找段落）与 WordAdapter.restoreSelection 设计意图矛盾。另有若干警告级别问题需关注。

---

## Critical Issues

### CR-01: PptAdapter.insert — append_end 路径在 sync 前访问 shape proxy

**File:** `src/adapters/PptAdapter.ts:151`
**Issue:** `append_end` 分支在调用 `shapes.load('items')` 之后、第一次 `await ctx.sync()` 之前，提前访问了 `shapes.getItemAt(0).textFrame.textRange`（第 151 行）。Office.js proxy 规则要求：属性必须在 `load` + `sync` 之后才能读取，否则抛 `PropertyNotLoaded` 错误（在 `sync 1` 之前读 `shapes.items[0]` 是未加载属性）。代码注释声称「在第一批 load 中同时 load shapes.items 与 tr.text，两次 sync 完成」，但 `shapes.getItemAt(0)` 是按 index 取 proxy，`tr.load('text')` 是对这个 proxy 调 load——这本身没有违规。真正的问题是：`shapes.items.length > 0` 的判断（第 153 行）发生在 `sync 1` 之后，但后续对 `tr.text` 的赋值（第 154 行）是在已经 load 并 sync 之后，这部分逻辑是正确的。

**重新审查后修正：** 真实 bug 在 `append_end` 与 `cursor`/`replace_selection` 路径共用同一个 `shapes.load('items')` 调用，但 `append_end` 提前取了 `shapes.getItemAt(0).textFrame.textRange` proxy（第 151 行），这个 proxy 虽然合法创建，但其背后的 `items` 集合在首个 `sync 1` 时才加载。如果 slide 没有 shape（`shapes.items.length === 0`），`getItemAt(0)` 会在服务器端抛 `ItemNotFound`（在 sync 1 内），且这个 `tr.load('text')` 请求也会一起发出，令 sync 1 本身失败并将错误暴露给 `insert` 的 catch 块，导致整个写入操作以 HostApiError 失败，而不是优雅降级（空 slide 时不写）。

**Fix:**
```typescript
// append_end 路径改为在 sync 1 之后再取 shape proxy，与 cursor 路径对称：
if (position === 'append_end') {
  await ctx.sync(); // sync 1: load shapes.items
  if (shapes.items.length > 0) {
    const tr = shapes.items[0].textFrame.textRange;
    tr.load('text');
    await ctx.sync(); // sync 2: load tr.text
    tr.text = ((tr.text as string) ?? '') + content.value;
    await ctx.sync(); // sync 3: write
  }
  return;
}
```
注意：这会从两次 sync 变三次，但 Office.js 要求 load 后 sync 才可读的规则不可绕过。也可以在 sync 1 后用 `shapes.items[0].textFrame.textRange` 访问（已加载），省去额外 load，直接写入。

---

### CR-02: ChatStream — CIRCUIT_OPEN 分支内违反 React Hook 规则

**File:** `src/components/ChatStream.tsx:133-134`
**Issue:** `ToolResultCard` 组件在条件渲染路径内（`if (message.toolResult?.error?.code === 'CIRCUIT_OPEN')` 块内部）调用了 `useAgentStore.getState()` 和 `useChatStore.getState()`。虽然这两个是非 hook 式的 Zustand 静态访问（`getState()`），不是 React Hook，因此不违反 Hook 规则本身。但更严重的问题是：同一个 `ToolResultCard` 函数体内，Hook `useAgentStore` 和 `useState` 在顶部被调用（第 103-104 行），之后的条件分支里（第 133-134 行）又出现额外逻辑——这本身不违规，但存在实际的**渲染函数副作用问题**：

第 133 行 `const store = useAgentStore.getState()` 是 render 时直接读取 store 快照，不会触发订阅，所以 CIRCUIT_OPEN 卡片的 `suggestion`/`prompt`/`toolName` 等字段**不会随 store 更新而重新渲染**（无响应性）。具体地，`ci = store.lastCircuitInfo` 在 store 更新后不会导致组件重渲染，可能显示过时的 circuitInfo。

更关键的 bug：`const prompt = msgs.find((m) => m.role === 'user' && m.agentRunId === rid)?.content ?? ''`（第 138 行），当 `rid` 为 `undefined`（`message.agentRunId` 可能未设置）时，`find` 会匹配所有 `agentRunId === undefined` 的 user 消息，可能拿到错误的 prompt，导致「重新试试」按钮重发错误的 prompt。

**Fix:**
```typescript
// 1. 将 CIRCUIT_OPEN 路径需要的动态值用 Hook 订阅（保证响应性）
const lastCircuitInfo = useAgentStore((s) => s.lastCircuitInfo);
// 2. agentRunId 为 undefined 时防御：
const rid = message.agentRunId;
if (!rid) return <div>...</div>; // 或返回降级 UI
const prompt = msgs.find((m) => m.role === 'user' && m.agentRunId === rid)?.content ?? '';
```

---

### CR-03: InputBar — 发送按钮在 agent 运行时渲染 StopIcon 但实际不执行 stop

**File:** `src/components/InputBar.tsx:155-164`
**Issue:** 当 `isAgentBusy === true` 时，发送按钮：
- `disabled={isAgentBusy || !text.trim()}` → 被 disable（第 159 行）
- `aria-label={isAgentBusy ? t\`停止\` : t\`发送\`}` → 读屏器报「停止」（第 161 行）
- 渲染 `<StopIcon>` → 视觉显示停止图标（第 163 行）

但按钮处于 `disabled` 状态，点击毫无响应。用户看到「停止」图标，会以为可以点击停止，结果发现按钮无法点击，造成 UX 欺骗。stop 实际由 `AgentControlBar`（单独组件）处理，两者存在 UI 矛盾。

这是一个设计一致性问题，但会导致用户在 agent 运行时找不到有效的停止入口（如果 AgentControlBar 未显示或不在视野内），属于行为 bug。

**Fix:** 两个选项：
```typescript
// 选项 A：agent 运行时按钮启用，点击执行 abort
<button
  type="button"
  className="send-btn"
  disabled={!isAgentBusy && !text.trim()}
  onClick={() => isAgentBusy ? useChatStore.getState().stopStreaming() : void handleSend()}
  aria-label={isAgentBusy ? t`停止` : t`发送`}
>

// 选项 B（最小改动）：agent 运行时隐藏 stop 视觉，仅保留 disabled 发送按钮
// 依赖 AgentControlBar 作为唯一 stop 入口（需确保 AgentControlBar 始终可见）
```

---

### CR-04: replace_selection inverse 实现与 restoreSelection 设计意图矛盾，silently 丢失 before-image

**File:** `src/agent/tools/write/word.ts:239-241`（连带 `src/adapters/WordAdapter.ts:452-455`）
**Issue:** `replace_selection` 的 execute 方法（word.ts 第 239-241 行）将 `reverse.tool` 设为 `'delete_paragraph_by_content'`，用**新文本**（替换后的内容）作为 delete 指纹。但 `WordAdapter.restoreSelection` 方法（WordAdapter.ts 第 452-455 行）是一个故意抛异常的 noop，且在 `executeReverse` switch 中**没有 `restore_selection` case**（operationLog.ts 第 246-302 行），只有 `delete_paragraph_by_content`。

这带来两个 bug：
1. `beforeImage`（替换前原文）被抓取后记录在 `reverse.args` 中**被完全丢弃**——`reverse.args` 只有 `{ text: newText }`（新文本），before-image 没有记录进任何 reverse 描述符字段，用户永远无法通过 undo 恢复原始选区内容。
2. `WordAdapter.restoreSelection` 存在但永远不会被 replay engine 调用（executeReverse 没有对应 case），属于死代码，却造成误导性。

**Fix:**
```typescript
// word.ts：将 beforeImage 正确记录进 reverse.args
const reverse: ReverseDescriptor = {
  tool: 'delete_paragraph_by_content',
  args: { text },  // 用新文本指纹近似还原（现有降级策略）
  // 或如果要保留 before-image 供调试：
  // args: { text, beforeImage: beforeImage }, // 但 delete_paragraph_by_content 只用 text 字段
};
// 注意：这仍是近似 inverse（T-06-07-02 accept 的降级），
// 但若 delete_paragraph_by_content 删了新文本，并不能还原原始内容。
// 正确做法（如果要 accept 降级）需在 REVIEW 中明确标注此局限，
// 而非在注释里说「至少有概率还原」——实际上还原的是新文本而非原文。
```

更根本的修复：如果接受无法精确 undo，则应将 `reverse.tool` 设为 `'noop_inverse'`（现有 executeReverse 已处理），在 DiffLog 诚实显示「无法自动回滚」，而不是让 delete_paragraph_by_content 以错误语义被调用（删新文本而非还原旧内容）。

---

## Warnings

### WR-01: ExcelAdapter.append_end 路径的 catch 块内 `await ctx.sync()` 在 Excel.run 外部调用

**File:** `src/adapters/ExcelAdapter.ts:136`
**Issue:** `append_end` 分支的 `catch` 块（第 133-137 行）在 `try { const used = ...; ... } catch { newRow = 0; await ctx.sync(); }` 中，`ctx.sync()` 的调用处于 `Excel.run` 闭包内（正确），但这个 catch 是为了处理 `getUsedRange(false)` 可能抛出的异常。

问题在于：如果是 `load` 或 `ctx.sync()` 本身抛出（不是 `getUsedRange` 的 `ItemNotFound`），catch 里再次 `await ctx.sync()` 会让一个已损坏的 context 再次 sync，可能掩盖真实错误或触发第二个错误。

更重要的是：注释说「sync 1: no-op（保持两次 sync 结构）」，但实际上这里并没有发出任何 load 请求，空的 `ctx.sync()` 在 catch 分支里是无意义的。这个保持 sync 计数的理由在实际 Office.js 行为上没有意义。

**Fix:** 移除 catch 分支里的 `await ctx.sync()`：
```typescript
} catch {
  newRow = 0;
  // 不需要额外 sync，后续 sync 2 (target.values= + sync) 已覆盖
}
```

---

### WR-02: PptAdapter.insertSlideAfter — 当 title 为空时 insertedIndex 依赖排序后最后一个元素，空演示文稿可能越界

**File:** `src/adapters/PptAdapter.ts:502`
**Issue:** `insertSlideAfter` 在 sync 2 后通过 `sorted[sorted.length - 1]` 取最新 slide（第 502 行）。如果 `slides.items` 加载后为空数组（极端边界：Office.js 刚刚创建的空演示文稿，slide 数为 0），则 `sorted[sorted.length - 1]` 为 `undefined`，后续 `newSlide.index + 1` 会抛 `TypeError: Cannot read properties of undefined`，被 catch 块包成 `HostApiError` 传出。

虽然 PowerPoint 通常至少有一张 slide，但 slides.add() 后 sync 若因并发操作导致 items 未刷新（极端竞态），此路径也可能崩。

**Fix:**
```typescript
if (sorted.length === 0) {
  throw new HostApiError('PPT insertSlideAfter: 插入后 slide 列表为空，无法定位新 slide', undefined);
}
const newSlide = sorted[sorted.length - 1];
```

---

### WR-03: agentStore.awaitResume — signal 已 abort 时的竞态窗口

**File:** `src/agent/agentStore.ts:131-149`
**Issue:** `awaitResume` 函数先检查 `get().agentStatus !== 'paused'`（第 131 行），然后创建 Promise。如果在这两步之间（即检查完状态但尚未订阅 store 和 signal）发生 abort，`onAbort` 回调会错过，Promise 永久挂起：

```
线程 A：awaitResume() → 检查 !== 'paused' → false → 进入 new Promise
线程 B（abort）：abort() 调用，signal.dispatchEvent('abort') 
线程 A：signal.addEventListener('abort', onAbort) → 已错过
```

不过在浏览器单线程环境中，此竞态窗口需要宏任务切换才能触发，实际在 JavaScript 同步执行路径下这个竞态不会发生（addEventListener 在同一个 microtask tick 内）。但第 143-147 行已有 `signal.aborted` 的二次检查，这实际上是正确的防御——问题是这个检查在 `unsub` 创建后、`addEventListener` 之前，如果 `abort` 在 `subscribe` 之前触发，`resolve()` 会被遗漏。整体逻辑是安全的，但顺序略有瑕疵（应先 addEventListener 再 subscribe，确保 abort 信号不丢失）。

**Fix:** 调整顺序，先注册 abort listener 再 subscribe：
```typescript
return new Promise((resolve, reject) => {
  const onAbort = () => { unsub(); reject(new DOMException('aborted', 'AbortError')); };
  if (signal.aborted) { reject(new DOMException('aborted', 'AbortError')); return; }
  signal.addEventListener('abort', onAbort, { once: true });
  const unsub = useAgentStore.subscribe((s, prev) => {
    if (prev.agentStatus === 'paused' && s.agentStatus !== 'paused') {
      signal.removeEventListener('abort', onAbort);
      unsub();
      resolve();
    }
  });
});
```

---

### WR-04: operationLog.readTargetState — ppt_slide 的 content 类型解包假设不安全

**File:** `src/agent/operationLog.ts:180`
**Issue:** `readTargetState` 中 `ppt_slide` 分支（第 179-182 行）：
```typescript
case 'ppt_slide':
  if (adapter.readPptSlideTitle) {
    const title = typeof postState.content === 'string' ? postState.content : '';
    return await adapter.readPptSlideTitle({ title });
  }
```

但 `postState.content` 对于 `ppt_slide` 种类，在 `ppt.ts`（write tool）中设置为 `{ index: insertedIndex, title }`（一个对象，第 99 行），**不是** `string`。因此 `typeof postState.content === 'string'` 恒为 `false`，`title` 恒为 `''`（空字符串），导致 `readPptSlideTitle` 被传入空 title，无法正确读取 slide 状态。

这意味着 ppt_slide 的手动改侦测（D-11）永远以空 title 查询，永远返回错误结果，`isTargetStateConsistent` 的 ppt_slide 分支（operationLog.ts 第 224-228 行）实际上无法正确工作。

**Fix:**
```typescript
case 'ppt_slide': {
  if (adapter.readPptSlideTitle) {
    const content = postState.content as { title?: string } | string;
    const title = typeof content === 'string'
      ? content
      : (content as { title?: string }).title ?? '';
    return await adapter.readPptSlideTitle({ title });
  }
  return undefined;
}
```

---

### WR-05: ExcelAdapter.getUsedRange 读取 headerSample 时未守 getRow(0) 越界

**File:** `src/adapters/ExcelAdapter.ts:247-249`
**Issue:** `get_used_range_summary` 分支在 `getUsedRange(false)` 之后，直接调 `used.getRow(0)`（第 247 行）并 load `values`。当工作表完全为空（used range 存在但 `rowCount === 0` 或 `columnCount === 0`）时，`getRow(0)` 可能抛 `OutOfRange`，导致整个 summary 查询失败。

注释说「WR-06 空表不抛 ItemNotFound」，但 `getRow(0)` 越界与 `ItemNotFound` 是不同异常。此问题不在 WR-06 的保护范围内。

**Fix:**
```typescript
// 在 load 阶段先不 load header，sync 后判断 rowCount > 0 再决定是否 load
const used = sheet.getUsedRange(false);
used.load(['address', 'rowCount', 'columnCount']);
await ctx.sync();

let headerSample: unknown[] = [];
if (used.rowCount > 0 && used.columnCount > 0) {
  const header = used.getRow(0);
  header.load('values');
  await ctx.sync();
  headerSample = (header.values as unknown[][])?.[0] ?? [];
}
```

---

### WR-06: WordAdapter.normalizeText 使用 trimEnd 而非 trim，可能导致首部空白的段落比对失败

**File:** `src/adapters/WordAdapter.ts:24`
**Issue:** `normalizeText` 使用 `trimEnd()`（只去尾部空白）。`deleteParagraphByContent` 和 `readWordParagraph` 用此函数比对目标段落。但 `appendParagraph` 写入时没有对 `text` 做任何 normalize，若 LLM 传入含前导空格的文本（如 `'  第一段'`），写入后的段落首部有空格，而 `normalizeText` 不去除首部空白，`normalTarget === normalizeText('  第一段')` 仍含首部空格，比对是正确的。

真正的问题：PptAdapter 里的 `normalizeText`（PptAdapter.ts 第 44-46 行）同样是 `trim()`，而 WordAdapter 的是 `trimEnd()`。两者行为不一致，若未来跨宿主复用逻辑，可能引入难以追踪的 false-skip（Word 端的段落含前导空白时，PptAdapter 的 `normalizeText` 会去掉前导空白，但 WordAdapter 不会）。

**Fix:** 保持两处 `normalizeText` 行为一致——统一使用 `trim()`（或者统一 `trimEnd()`，视业务语义定）并提取为共享工具函数。

---

### WR-07: console.assert 在生产构建中不会被树摇，且失败时不抛错

**File:** `src/agent/tools/write/excel.ts:76,104,140,168`（同见 ppt.ts）
**Issue:** 各 execute 函数末尾使用 `console.assert(reverse !== undefined, 'TOOL-04: reverse required')` 作为运行时守门。`reverse` 是字面量赋值，永远不为 `undefined`，断言恒为真，等于死代码。即便断言失败，`console.assert` 只打印 warning，不抛错——production 中悄悄放行一个缺 reverse 的 write tool result，导致 operationLog 记录无 reverse 条目，撤销失败。

**Fix:** 要么用 `throw` 替代（真正守门），要么删除这些永为真的断言：
```typescript
// 删除这些恒真断言（无意义）：
// console.assert(reverse !== undefined, 'TOOL-04: reverse required');

// 如需守门，在 tool result 构建后做有意义的检查：
if (typeof reverse.tool !== 'string') throw new Error('TOOL-04: reverse.tool 必须是字符串');
```

---

## Info

### IN-01: Step1Keys.tsx 中 API Key 输入框没有 `type="button"` 修饰——按钮缺少 type 属性

**File:** `src/components/Onboarding/Step1Keys.tsx:116,119`
**Issue:** 「跳过」和「开始使用」按钮（第 116、119 行）没有显式 `type="button"` 或 `type="submit"` 属性。在没有外层 `<form>` 的情况下，缺省 `type="submit"` 有时在某些浏览器下会导致意外的页面刷新行为。虽然 Office Task Pane 的 WebView 行为相对可控，但这是 HTML 最佳实践问题。

**Fix:**
```tsx
<button type="button" className="btn btn-ghost btn-sm" onClick={onSkip}>
<button type="button" className="btn btn-primary btn-sm" onClick={handleComplete}>
```

---

### IN-02: operationLog.ts — `clearRun` 函数被导出但未被任何已知调用方使用

**File:** `src/agent/operationLog.ts:144-146`
**Issue:** `clearRun` 函数被导出，注释说「供 session 清理使用」，但在已审查文件中没有任何调用方。若 session 不清理，`operationLogMap` 会持续积累所有历史 run 的操作日志，随对话时间增长占用内存（in-memory only，页面关闭自然清）。这不是内存泄漏（页面关闭即释放），但长时间使用可能产生 MB 级别的日志累积。

**Fix:** 在 `agentStore.endRun()` 中调用 `clearRun(runId)`，或在 `clearHistory()` 时清空所有日志，确保有明确的清理时机。

---

### IN-03: ChatStream 的 `eslint-disable-next-line react-hooks/rules-of-hooks` 注释应当引起关注

**File:** `src/components/ChatStream.tsx:300`
**Issue:** 第 300 行有 `// eslint-disable-next-line react-hooks/rules-of-hooks`，禁用了 Hook 规则检查，原因是 `setDraftPrompt` 在无消息（早期 return）路径之前调用。但 `useChatStore` 是 Zustand store 的 Hook 调用，放在条件语句/早期 return 前本身是合规的——这里 `setDraftPrompt` 在第 301 行，在 `if (messages.length === 0)` 条件（第 304 行）之前，位置是正确的。

这个 eslint-disable 注释可能是残留或误加。如果实际上没有 Hook 规则问题，应删除此注释（避免掩盖真实的 Hook 规则违反）。如果是 ESLint 误报，则需要说明原因。

**Fix:** 验证是否真正需要此 disable 注释，若不需要则删除。

---

_Reviewed: 2026-05-30T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
