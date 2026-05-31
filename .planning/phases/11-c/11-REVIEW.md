---
phase: 11-c
reviewed: 2026-05-31T10:00:00Z
depth: deep
files_reviewed: 17
files_reviewed_list:
  - src/agent/tools/write/batch.ts
  - src/adapters/ExcelAdapter.ts
  - src/adapters/WordAdapter.ts
  - src/adapters/PptAdapter.ts
  - src/agent/operationLog.ts
  - src/agent/tools/index.ts
  - src/agent/loop-helpers.ts
  - src/components/DiffLogPanel.tsx
  - src/styles.css
  - src/adapters/ExcelAdapter.batch.test.ts
  - src/adapters/WordAdapter.batch.test.ts
  - src/agent/tools/write/batch.test.ts
  - src/components/DiffLogPanel.test.tsx
  - src/agent/operationLog.integration.test.ts
  - src/agent/contract.test.ts
  - src/agent/tools/index.test.ts
  - src/agent/tools/read/tools.test.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 11-C: Code Review Report

**Reviewed:** 2026-05-31
**Depth:** deep（跨文件调用链追踪）
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 11（批量操作 C）实现了 `batch_write` ToolDef、三宿主 `executeBatch` 以及 `batch_reverse` 的逆序撤销路径。整体架构设计正确——single-closure、fail-fast、Record 签名、逆序撤销均已落地。但在 per-subOp 手改检测（D-09）的数据流上存在两处结构性逻辑错误（CR-01、CR-02），在部分成功时的 `ok` 语义上存在一处可能影响熔断器的 WARNING，PPT executeBatch 违反了 BATCH-01 的 O(1) sync 原则。

**注：** 本次 review 是 advisory 性质。708 条测试通过，包含真机 ExcelAdapter 集成守门（integration.test.ts 两条批量反向测试）。以下分类基于逻辑正确性标准，不以测试是否覆盖为豁免依据。

---

## Critical Issues

### CR-01：Word batch subOps 的 per-subOp 手改检测在生产中会误判所有 subOp 为"手改过"

**File:** `src/agent/operationLog.ts:226-229` 与 `src/adapters/WordAdapter.ts:1254`

**Issue:**

`readTargetState('word_paragraph')` 的判断分支：

```typescript
return await adapter.readWordParagraph(
  typeof postState.content === 'string' ? { text: postState.content } : {},
);
```

但 `WordAdapter.executeBatch` 在所有 subOps 的 `postState` 里存的 `content` 是**对象**而非 string：

```typescript
postState: { kind: 'word_paragraph', content: { text } }       // append_paragraph
postState: { kind: 'word_paragraph', content: { index, text: newText } }  // replace_paragraph
```

因此 `typeof postState.content === 'string'` 恒 false，`readWordParagraph` 收到空参数 `{}`，`args.text === undefined`，`normalizeText(undefined)` 返回空字符串，全文段落不存在内容为 `''` 的段落，`readWordParagraph` 返回 `''`。

然后 `isTargetStateConsistent('word_paragraph')` 用 `normalize('')` vs `normalize({ text })` 做字符串比对，两者不等，判为"手改过" → `skippedManual++` → 所有 Word batch subOps 被过滤出 survivingOps，undo 什么都不撤。

**结果：** Word 宿主 batch undo 静默失效——DiffLog 显示"撤销中"但实际上零 subOp 被撤。

**Fix:**

在 `operationLog.ts` 的 `readTargetState` 中，改为从 content 对象里解包 `text` 字段：

```typescript
case 'word_paragraph':
  if (adapter.readWordParagraph) {
    let targetText: string | undefined;
    if (typeof postState.content === 'string') {
      targetText = postState.content;
    } else if (
      postState.content !== null &&
      typeof postState.content === 'object' &&
      typeof (postState.content as Record<string, unknown>).text === 'string'
    ) {
      targetText = (postState.content as Record<string, unknown>).text as string;
    }
    if (targetText !== undefined) {
      return await adapter.readWordParagraph({ text: targetText });
    }
  }
  return undefined;
```

---

### CR-02：Excel batch subOps 的 per-subOp 手改检测数据结构不匹配（两 Bug 相消，当前生产无害但架构存在隐患）

**File:** `src/adapters/ExcelAdapter.ts:1554-1557` 与 `src/agent/operationLog.ts:232-238`

**Issue:**

`ExcelAdapter.executeBatch` 返回的 subOp `postState.content` 只含 `address`：

```typescript
postState: {
  kind: 'excel_range',
  content: { address: s.proxy.address as string },   // 无 values
},
```

但 `readTargetState('excel_range')` 调用 `readExcelRange` 返回 `unknown[][]`（二维值数组），然后 `isTargetStateConsistent('excel_range')` 做：

```typescript
return JSON.stringify(current) === JSON.stringify(postState.content);
// current = [[...]]，postState.content = { address: "..." }
// 永远不等 → 所有 subOps 被标为"手改过"
```

**当前生产无害原因：** `ExcelAdapter` 没有实现 `readExcelRange` 方法，`readTargetState` 返回 `undefined` → `isTargetStateConsistent` 返回 `true`（保守通过）→ 手改检测静默跳过，undo 正常执行。

**隐患：** 一旦后续补实现 `ExcelAdapter.readExcelRange`（TOOL-04 未来路线图），手改检测会立即失效——所有 Excel batch subOps 被误判手改，undo 全部跳过。且单测 `operationLog.integration.test.ts:1057-1128` 已动态注入了 `readExcelRange` mock，其测试场景是故意构造 postState 不一致，掩盖了这个结构性问题。

**Fix:**

在 `ExcelAdapter.executeBatch` 的 subOps 组装里，将写后当前值存入 `postState.content`：

```typescript
postState: {
  kind: 'excel_range',
  content: {
    address: s.proxy.address as string,
    values: op.args.values as unknown[][],  // 写入值作为 postState 内容
  },
},
```

然后在 `readTargetState` 读到的 `current`（二维值数组）与 `postState.content.values` 比对，而非 `postState.content` 整体比对。或修改 `isTargetStateConsistent('excel_range')` 的比对逻辑，取 `(postState.content as Record<string, unknown>).values` 字段做比对。

---

## Warnings

### WR-01：部分成功的 batch 返回 `ok: true`，混淆熔断器状态

**File:** `src/agent/tools/write/batch.ts:212-214`

**Issue:**

```typescript
const partialOk = failAtIndex !== undefined; // 部分完成
return {
  ok: !partialOk || completedSubOps.length > 0,   // BUG
  ...
};
```

当 `partialOk=true`（有 op 失败）且 `completedSubOps.length > 0`（有 op 成功）时，`!partialOk || completedSubOps.length > 0 = false || true = true`，即部分失败的批量操作返回 `ok: true`。

`loop-helpers.ts:146` 对 `result.ok = true` 调用 `breaker.recordSuccess(tc.name)`，会抹去之前的失败计数，导致熔断器无法正确统计批量操作的失败率。

**Fix:**

部分成功应明确返回 `ok: false`，并在 `data` 里携带 `completed/failed` 信息供 LLM 感知：

```typescript
// 全部成功 → ok: true；部分失败 → ok: false（已执行的保留，后续用 data 告知 LLM）
ok: failAtIndex === undefined,
```

---

### WR-02：PPT `executeBatch` 在每个 op 内多次 `ctx.sync`，违反 BATCH-01 O(1) sync 原则

**File:** `src/adapters/PptAdapter.ts:2179-2229`

**Issue:**

PPT executeBatch 在开始时调用一次 `ctx.sync`（加载 slides list），但每个 `set_shape_text` op 内还有两次额外 sync：

```typescript
// slides 加载
slides.load('items');
await ctx.sync();          // sync #1

for (const op of ops) {
  if (op.tool === 'set_shape_text') {
    slide.shapes.load('items/id,items/type');
    await ctx.sync();      // sync #2（每个 set_shape_text op 一次）

    shape.textFrame.textRange.load('text');
    await ctx.sync();      // sync #3（每个 set_shape_text op 一次）

    shape.textFrame.textRange.text = newText;
    await ctx.sync();      // sync #4（每个 set_shape_text op 一次）
  }
}
```

N 个 `set_shape_text` op → 1 + 3N 次 sync（O(N)），与 BATCH-01"O(1) sync"承诺矛盾。

**背景：** PPT API 的 proxy 架构不支持像 Excel 的两阶段合并，这是 Open Q2 的已知限制（RESEARCH.md）。但注释声明"单 PowerPoint.run 闭包"并不等同于 O(1) sync，文档注释中的"D-01 D-02 BATCH-01"引用存在误导性。

**Fix:**

修正文档注释，明确 PPT executeBatch 是"单 run 闭包（共享 ctx）但非 O(1) sync（每 op 需 2-3 次 sync 因 proxy 设计限制）"，与 Excel 两阶段模型区分，并更新 BATCH-01 相关 JSDoc。

---

### WR-03：Word 和 PPT 无 `executeBatchReverse`，batch undo 降级为 O(N) 逐次调用

**File:** `src/adapters/WordAdapter.ts`、`src/adapters/PptAdapter.ts`、`src/agent/operationLog.ts:495-513`

**Issue:**

`operationLog.ts` 的 `batch_reverse` case 优先路径检测 `adapter.executeBatchReverse`：

```typescript
if ('executeBatchReverse' in adapter &&
    typeof (adapter as Record<string, unknown>).executeBatchReverse === 'function') {
  await adapter.executeBatchReverse(survivingOps);  // 单闭包
} else {
  // 降级路径：逐个 executeReverse
  for (const subOp of survivingOps) {
    await executeReverse({ tool: subOp.tool, args: subOp.args }, adapter);
  }
}
```

`WordAdapter` 和 `PptAdapter` 均未实现 `executeBatchReverse`（只有 `ExcelAdapter` 实现了），因此 Word 和 PPT 的 batch undo 始终走降级路径：N 个 subOps = N 次独立 Word.run/PowerPoint.run，每次都有网络往返开销，且无法享受 D-08 的单闭包原子性保证。

**影响：** 当 Word batch undo 中途某步宿主 API 失败（如文档并发锁定），已撤销的部分无法回滚，文档可能处于中间态。

**Fix:**（中等优先级，技术债）

为 `WordAdapter` 和 `PptAdapter` 实现 `executeBatchReverse`，对 Word 支持的 reverse 工具（`delete_paragraph_by_content`、`restore_paragraph_at` 等）在单个 `Word.run` 闭包内批量执行，末尾单次 sync 提交。PPT 同理。

---

### WR-04：`ExcelAdapter.executeBatch` 当 `op.args.values` 为 `undefined` 时静默跳过写入，导致 subOp 成功但未实际写入

**File:** `src/adapters/ExcelAdapter.ts:1529-1531`

**Issue:**

```typescript
for (const { op, proxy } of toCommit) {
  if (op.args.values !== undefined) {
    proxy.values = op.args.values as unknown[][];
  }
  // 若 values === undefined → 静默跳过，但 subOp 仍会被标为 ok: true
}
```

如果 LLM 传入的 batch op 缺少 `values` 字段，Phase 1 校验（`!op.args.address || typeof op.args.address !== 'string'`）只校验 `address`，不校验 `values`。Phase 2 跳过写入，但 subOp 仍然被加入 `toCommit` 并在结果里标 `ok: true`，返回 `humanLabel`、`reverse.args.values = undefined` 的 reverse descriptor。undo 时 `executeBatchReverse` 的 `if (!address || !values) continue` 跳过了该 op，导致"成功写入→成功撤销"的外观与"什么都没写→undo 也什么都没做"的实际完全一致，无法被发现。

**Fix:**

在 Phase 1 校验中增加 `values` 的必须性校验：

```typescript
if (!op.args.address || typeof op.args.address !== 'string') {
  failAtIndex = i;
  break;
}
if (!Array.isArray(op.args.values)) {
  failAtIndex = i;
  break;
}
```

---

## Info

### IN-01：`contract.test.ts` 的 batch 合约只注册了 `excel` 宿主，Word/PPT batch 合约缺失

**File:** `src/agent/contract.test.ts:61`

**Issue:**

```typescript
{ toolName: 'batch_write', host: 'excel', undoType: 'batch' as UndoType, reverseTool: 'batch_reverse', phase: 11, integrationTest: true },
```

`batch_write` 已注册到三宿主（`buildToolsForHost` 中 word/excel/ppt 均已添加），但合约表只记录了 `host: 'excel'`，Word 和 PPT 宿主下的 batch undo 行为（尤其降级路径）缺乏合约守门。

**建议：** 合约表补充 Word 和 PPT 条目（同 reverse tool = `batch_reverse`），并在 `operationLog.integration.test.ts` 补充 Word batch_reverse 的降级路径（无 executeBatchReverse）守门测试。

---

### IN-02：`DiffLogPanel` 的 subOps 列表用数组 index 作为 React `key`，且 batch 折叠逻辑依赖外层 `expanded` 状态

**File:** `src/components/DiffLogPanel.tsx:334-338`

**Issue:**

```tsx
{entry.subOps.map((subOp, i) => (
  <li key={i} className="batch-sub-op">
```

用数组下标 `i` 做 `key` 是 React 反模式：若 subOps 被过滤（如手改检测后 UI 刷新）会导致 diff 错误。subOp 目前没有唯一 id 字段，但 `humanLabel` + index 组合可作为稳定 key。

另外，`entry.subOps` 的渲染条件 `expanded && entry.subOps.length > 0` 与外层 `.tool-group__head` 的折叠状态耦合，若将来 per-entry 折叠（而非整组折叠）则需重构。

**建议：** key 改为 `${entry.stepIndex}-${i}` 以减少跨 entry 碰撞风险；或在 `OperationLogEntry.subOps` 上加 `id` 字段。

---

## 附：重点关注项检验结论

| 关注项 | 结论 |
|---|---|
| Undo 逆序正确性 | **通过**：operationLog.ts 在 `batch_reverse` 中明确 `.reverse()` 后传给 adapter；ExcelAdapter.executeBatchReverse 注释"已逆序，直接执行"。无双重逆序。 |
| BATCH-01 单闭包 Excel | **通过**：ExcelAdapter.executeBatch 用单个 Excel.run + 2 次 sync（Phase 1 + Phase 2）。 |
| BATCH-01 单闭包 PPT | **未达标（WR-02）**：PPT 每 op 3 次 sync，O(N)。 |
| fail-fast（BATCH-02） | **通过**：Excel 通过 isNullObject 检测失败；Word/PPT 通过 per-op try/catch 立即 break。 |
| reverse.args Record 签名 | **通过**：所有宿主 subOp reverse.args 均为对象（非位置参）。 |
| 双重 reverse 修复确认 | **通过**：eb218f2 fix 已生效——operationLog 负责逆序（`.reverse()`），executeBatchReverse 直接按传入顺序执行，无二次逆序。 |
| per-subOp 手改防御（Excel 生产）| **当前无害**：ExcelAdapter 无 readExcelRange → 手改检测静默跳过（CR-02 为潜在架构缺陷，非当前生产 bug）。 |
| per-subOp 手改防御（Word 生产）| **存在 bug（CR-01）**：readTargetState 对 object content 传 `{}` 给 readWordParagraph，手改检测在 WordAdapter 存在该方法时会全部误判 skippedManual。 |
| 新 runtime 依赖 | **无**：package.json 未变更，所有新代码均依赖已有模块。 |

---

_Reviewed: 2026-05-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
