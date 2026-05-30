# Phase 11: 批量操作 (C) - Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 12 (新建 4 / 修改 8)
**Analogs found:** 12 / 12

---

## File Classification

| 新建/修改文件 | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/agent/tools/write/batch.ts` | tool-def | request-response | `src/agent/tools/write/excel.ts` | exact |
| `src/agent/tools/write/batch.test.ts` | test | batch | `src/agent/operationLog.integration.test.ts` | role-match |
| `src/agent/operationLog.ts` (修改) | operation-log | request-response | self (已有 executeReverse switch) | exact |
| `src/agent/tools/index.ts` (修改) | registry | request-response | self (已有 buildToolsForHost) | exact |
| `src/agent/loop-helpers.ts` (修改) | orchestrator | request-response | self (已有 appendOperation 调用) | exact |
| `src/adapters/ExcelAdapter.ts` (修改) | adapter | batch | `src/adapters/ExcelAdapter.ts` setRangeValues (自身既有方法) | exact |
| `src/adapters/WordAdapter.ts` (修改) | adapter | batch | `src/adapters/ExcelAdapter.ts` setRangeValues | role-match |
| `src/adapters/PptAdapter.ts` (修改) | adapter | batch | `src/adapters/ExcelAdapter.ts` setRangeValues | role-match |
| `src/adapters/ExcelAdapter.batch.test.ts` | test | batch | `src/agent/operationLog.integration.test.ts` (mockExcel 工厂) | role-match |
| `src/components/DiffLogPanel.tsx` (修改) | component | event-driven | self (已有 `.tool-group` 折叠) | exact |
| `src/components/DiffLogPanel.test.tsx` | test | render | `src/agent/operationLog.integration.test.ts` | role-match |
| `src/agent/operationLog.integration.test.ts` (修改) | test | batch | self (已有 batch 守门范式) | exact |
| `src/agent/contract.test.ts` (修改) | test | contract | self (已有 CONTRACT[] + UndoType) | exact |
| `.planning/phases/08-foundation-a-f/CONTRACT.md` (修改) | config | — | self | exact |

---

## Pattern Assignments

### `src/agent/tools/write/batch.ts` (tool-def, request-response)

**Analog:** `src/agent/tools/write/excel.ts`

**Imports pattern** (lines 21-24):
```typescript
import type { ToolDef, ToolResult } from '../index';
import type { ReverseDescriptor, PostStateSnapshot } from '../../operationLog';
import type { ExcelAdapter } from '../../../adapters/ExcelAdapter';
// batch.ts 需额外引入 WordAdapter / PptAdapter 或用 DocumentAdapter interface
```

**ToolDef 结构 pattern** (lines 45-76，setRangeValues 为范本):
```typescript
export const setRangeValues: ToolDef<SetRangeValuesArgs> = {
  name: 'set_range_values',
  kind: 'write',                                 // ← batch_write 也是 'write'
  description: '...',
  parameters: {
    type: 'object',
    properties: { /* ... */ },
    required: ['address', 'values'],
  },
  humanLabel: ({ address }) => `写入单元格区域 ${address}`,
  // batch_write: humanLabel: ({ ops }) => `批量改动 ${ops.length} 处`
  async execute({ address, values }, ctx): Promise<ToolResult> {
    const { beforeImage } = await (ctx.adapter as ExcelAdapter).setRangeValues(address, values);
    const reverse: ReverseDescriptor = {
      tool: 'overwrite_range',
      args: { address: beforeImage.address, values: beforeImage.values }, // ← Record 对象！
    };
    const postState: PostStateSnapshot = {
      kind: 'excel_range',
      content: { address, values },
    };
    return { ok: true, data: { address, rowsWritten: values.length }, reverse, postState };
  },
};
```

**batch_write 专有前置校验 pattern**（从 RESEARCH.md §发现 6 提取）:
```typescript
// 在 execute 开头、任何 run 之前执行（D-06）
if (!Array.isArray(ops) || ops.length === 0) {
  return { ok: false, error: { code: 'INVALID_ARGS', message: 'ops 必须为非空数组', hint: '请提供至少一个操作', recoverable: false } };
}
if (ops.length > 20) {
  return {
    ok: false,
    error: { code: 'INVALID_ARGS', message: `单次批量最多 20 个操作，请拆分后重试（当前 ${ops.length} 个）`, hint: '将 ops 拆分为多次 batch_write 调用，每次 ≤20 个', recoverable: true },
  };
}
```

**Error handling pattern** (来自 `dispatchTool`，lines 155-169 in tools/index.ts):
```typescript
// dispatchTool 已包 try/catch + isAsterErrorWithMeta 兜底
// execute 内部只需在 adapter 调用失败时 throw HostApiError
// batch.ts execute 对 adapter.executeBatch 失败也只需 return { ok: false, error: { code: 'HOST_API_FAILED', ... } }
```

**ToolResult subOps 新增字段**（需同步改 tools/index.ts ToolResult 接口）:
```typescript
export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: ToolError;
  reverse?: ReverseDescriptor;
  postState?: PostStateSnapshot;
  subOps?: Array<{           // ← Phase 11 新增：batch 专用透传
    humanLabel: string;
    postState?: PostStateSnapshot;
    reverse: ReverseDescriptor;
  }>;
}
```

---

### `src/agent/tools/write/batch.test.ts` (test, batch)

**Analog:** `src/agent/operationLog.integration.test.ts`

**Test structure pattern** (lines 16-28，imports + afterEach):
```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
// ...
afterEach(() => {
  delete (global as unknown as Record<string, unknown>).Word;
  delete (global as unknown as Record<string, unknown>).Excel;
  delete (global as unknown as Record<string, unknown>).PowerPoint;
  __resetOperationLogForTest();
  vi.restoreAllMocks();
});
```

**Unit test pattern for INVALID_ARGS**（参考 dispatchTool NOT_FOUND 路径）:
```typescript
// batch.test.ts 测校验逻辑（不开 Office run，纯 JS 层）
it('ops.length > 20 → INVALID_ARGS 不执行', async () => {
  const ops = Array.from({ length: 21 }, (_, i) => ({ tool: 'set_range_values', args: { address: `A${i+1}`, values: [[i]] } }));
  const result = await batchWrite.execute({ ops }, mockCtx);
  expect(result.ok).toBe(false);
  expect(result.error?.code).toBe('INVALID_ARGS');
});
it('嵌套 batch_write → INVALID_ARGS', async () => {
  const result = await batchWrite.execute({ ops: [{ tool: 'batch_write', args: {} }] }, mockCtx);
  expect(result.ok).toBe(false);
  expect(result.error?.code).toBe('INVALID_ARGS');
});
```

---

### `src/agent/operationLog.ts` (operation-log, 修改)

**Analog:** self（已有结构）

**PostStateSnapshot kind 扩展 pattern** (line 35-37，当前):
```typescript
export interface PostStateSnapshot {
  kind: 'word_paragraph' | 'excel_range' | 'excel_chart' | 'ppt_slide' | 'ppt_shape';
  // ↑ Phase 11 需加 | 'batch'
  content: unknown;
}
```

**OperationLogEntry subOps 字段扩展 pattern** (line 43-53，当前无 subOps):
```typescript
export interface OperationLogEntry {
  runId: string;
  stepIndex: number;
  toolName: string;
  args: unknown;
  humanLabel: string;
  reverse: ReverseDescriptor;
  postState?: PostStateSnapshot;
  timestamp: number;
  /** Phase 11 新增：batch 条目的子操作列表，供 DiffLogPanel 嵌套渲染 */
  subOps?: Array<{
    humanLabel: string;
    postState?: PostStateSnapshot;
    reverse: ReverseDescriptor;
  }>;
}
```

**executeReverse case 新增 pattern** (lines 247-307，已有 switch 结构):
```typescript
// 已有 case 范式（以 'overwrite_range' 为例，lines 258-263）：
case 'overwrite_range':
  if (!adapter.overwriteRange) {
    throw new Error(`adapter 未实现 overwriteRange（tool=${reverse.tool}）`);
  }
  await adapter.overwriteRange(reverse.args);  // ← Record 对象传入
  break;

// batch_reverse 新增 case（加在 'noop_inverse' 之前）：
case 'batch_reverse': {
  const ops = reverse.args.ops as Array<{ tool: string; args: Record<string, unknown> }>;
  const reversedOps = [...ops].reverse(); // 逆序：最后写的先撤（D-07）
  // 优先 executeBatchReverse 单闭包（D-08）；降级逐个调（continue-on-error D-09）
  if ('executeBatchReverse' in adapter && typeof (adapter as Record<string, unknown>).executeBatchReverse === 'function') {
    await (adapter as { executeBatchReverse: (ops: typeof reversedOps) => Promise<void> }).executeBatchReverse(reversedOps);
  } else {
    for (const subOp of reversedOps) {
      try {
        await executeReverse({ tool: subOp.tool, args: subOp.args }, adapter);
      } catch {
        // continue-on-error per subOp（D-09）
      }
    }
  }
  break;
}
```

**DocumentAdapterForReplay 扩展 pattern** (lines 83-106，已有接口):
```typescript
export interface DocumentAdapterForReplay {
  // ... 已有方法（lines 85-106）...
  /** Phase 11：batch_reverse 单闭包逆序撤销（D-08 对称设计）*/
  executeBatchReverse?: (ops: Array<{ tool: string; args: Record<string, unknown> }>) => Promise<void>;
}
```

---

### `src/agent/tools/index.ts` (registry, 修改)

**Analog:** self（已有 buildToolsForHost）

**注册新 tool pattern** (lines 193-225，buildToolsForHost):
```typescript
// 以 excel case 为范本（lines 206-213）
case 'excel': {
  const excelWriteTools = [setRangeValuesTool, applyFormula, insertChart, setCell] as ToolDef[];
  excelWriteTools.forEach(assertWriteToolRegisterable); // ← 注册守门
  return [
    listWorksheets, getRangeValues, getUsedRangeSummary,
    ...excelWriteTools, selectionDetail,
  ].map((t) => t as ToolDef);
}

// batch_write 需加入三宿主各自的 xxxWriteTools 数组
// import { batchWrite } from './write/batch'; 加在文件顶部
// 三宿主各自加 batchWrite 进 WriteTools 数组（排 assertWriteToolRegisterable 守门）
```

---

### `src/agent/loop-helpers.ts` (orchestrator, 修改)

**Analog:** self（已有 appendOperation 调用）

**appendOperation 调用 pattern** (lines 159-165，当前):
```typescript
const opIndex = getOperationsByRun(runId).length;
appendOperation({
  runId, stepIndex: opIndex, toolName: tc.name, args: tc.arguments,
  humanLabel, reverse: result.reverse,
  postState: result.postState,   // 已有透传
  timestamp: Date.now(),
  // ↑ Phase 11 新增：subOps 透传
  // subOps: result.subOps,      ← 加这一行（仅 batch_write 时非 undefined）
});
```

---

### `src/adapters/ExcelAdapter.ts` (adapter, 修改 — 新增 executeBatch + inner-helpers)

**Analog:** self（已有 setRangeValues two-sync 模式）

**两 sync 现状 pattern**（Phase 5 既有，lines 320-341）：
```typescript
async setRangeValues(address: string, values: unknown[][]): Promise<{ beforeImage: ... }> {
  try {
    return await Excel.run(async (ctx) => {  // ← 独立 run（D-01 要突破的结构）
      const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
      range.load(['values', 'address']);
      await ctx.sync(); // sync 1: load before-image
      const beforeImage = { address: range.address as string, values: range.values as unknown[][] };
      range.values = values;
      await ctx.sync(); // sync 2: write
      return { beforeImage };
    });
  } catch (err) {
    throw new HostApiError('Excel setRangeValues 失败', err);
  }
}
```

**Option A inner-helper 重构 pattern**（基于 RESEARCH.md §发现 2）：
```typescript
// 公开方法变薄包壳（向后兼容，不改外部调用签名）：
async setRangeValues(address: string, values: unknown[][]): Promise<{ beforeImage: ... }> {
  return await Excel.run((ctx) => this._setRangeValuesIn(ctx, address, values));
}

// context-aware inner helper（供 executeBatch 共享 ctx 调用）：
private async _setRangeValuesIn(
  ctx: Excel.RequestContext,
  address: string,
  values: unknown[][]
): Promise<{ rangeProxy: Excel.Range }> {
  const range = ctx.workbook.worksheets.getActiveWorksheet().getRangeOrNullObject(address);
  range.load(['values', 'address', 'isNullObject']);
  return { rangeProxy: range }; // 只 load，不 sync；sync 由 executeBatch 统一调
}
```

**executeBatch 两阶段 pattern**（基于 RESEARCH.md §发现 3）：
```typescript
async executeBatch(ops: BatchOp[]): Promise<BatchResult> {
  return await Excel.run(async (ctx) => {
    // Phase 1: load + 预校验（使用 getRangeOrNullObject 防 ItemNotFound 抛出，见 Pitfall 3）
    const staged: Array<{ op: BatchOp; proxy: Excel.Range; beforeImage?: unknown[][] }> = [];
    let failAtIndex = -1;

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      // JS 层参数校验（在 sync 前）
      if (!op.args.address || typeof op.args.address !== 'string') {
        failAtIndex = i; break;
      }
      const proxy = ctx.workbook.worksheets.getActiveWorksheet()
        .getRangeOrNullObject(op.args.address as string);
      proxy.load(['values', 'address', 'isNullObject']);
      staged.push({ op, proxy });
    }

    if (failAtIndex === -1) {
      await ctx.sync(); // Phase 1 唯一 sync（读 before-image + 探测无效 range）
      for (let i = 0; i < staged.length; i++) {
        if (staged[i].proxy.isNullObject) { failAtIndex = i; break; }
        staged[i].beforeImage = staged[i].proxy.values as unknown[][];
      }
    }

    // Phase 2: 只对合法前缀排队写（O(1) sync）
    const toCommit = failAtIndex === -1 ? staged : staged.slice(0, failAtIndex);
    for (const { op, proxy } of toCommit) {
      proxy.values = op.args.values as unknown[][];
    }
    await ctx.sync(); // Phase 2 唯一 sync

    return {
      subOps: toCommit.map((s) => ({
        humanLabel: s.op.humanLabel ?? `写入 ${s.proxy.address}`,
        beforeImage: s.beforeImage,
        reverse: { tool: 'overwrite_range', args: { address: s.proxy.address, values: s.beforeImage } },
        postState: { kind: 'excel_range', content: { address: s.proxy.address } },
        ok: true,
      })),
      failAtIndex: failAtIndex !== -1 ? failAtIndex : undefined,
    };
  });
}
```

**overwriteRange Record 签名守门 pattern** (lines 362-375，已有正确示例):
```typescript
async overwriteRange(args: Record<string, unknown>): Promise<void> {
  const address = args.address as string; // ← 对象解构，非位置参
  const values = args.values as unknown[][];
  // ...
}
```

---

### `src/adapters/ExcelAdapter.batch.test.ts` (test, batch)

**Analog:** `src/agent/operationLog.integration.test.ts`

**mockExcel 工厂 pattern** (lines 47-68)：
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

**单 sync 计数断言 pattern**（batch.test.ts 新写）：
```typescript
it('单闭包：5 个 op 只触发 2 次 ctx.sync()（不是 5×2）', async () => {
  const syncCalls: number[] = [];
  // mock ctx.sync 记录调用次数
  // 断言 syncCalls.length === 2（Phase 1 + Phase 2）
});
it('fail-fast：第 3 个 op 非法时 op[0..1] 保留（reverse 只含 2 个 subOp）', async () => {
  // 断言 result.subOps.length === 2，result.failAtIndex === 2
});
```

---

### `src/components/DiffLogPanel.tsx` (component, 修改)

**Analog:** self（已有 `.tool-group` 折叠范式）

**已有 li 渲染 pattern** (lines 311-345，writeOps.map):
```tsx
return (
  <li key={entry.stepIndex} className={liClass}>
    <div className="wb-action-head" style={{ cursor: 'default' }}>
      <span className="wb-action-target">{entry.humanLabel}</span>
      {isUndone && <StatusBadge status={state as Exclude<StepUndoState, 'loading'>} />}
      {!isUndone && (
        <button type="button" className="btn btn-ghost btn-sm"
          disabled={isLoading || undoAllLoading}
          onClick={() => { void handleUndoStep(entry); }}
          aria-busy={isLoading}>
          {isLoading ? <Trans>撤销中…</Trans> : <Trans>撤销该步</Trans>}
        </button>
      )}
    </div>
    {/* Phase 11 新增：batch entry 展开后显示 subOps 只读列表 */}
    {entry.subOps && entry.subOps.length > 0 && expanded && (
      <ul className="batch-sub-ops">
        {entry.subOps.map((subOp, i) => (
          <li key={i} className="batch-sub-op">
            <span className="batch-sub-op__label">{subOp.humanLabel}</span>
            {/* 无 per-subOp 撤销按钮（D-10 锁定：batch = 原子 undo 单元）*/}
          </li>
        ))}
      </ul>
    )}
  </li>
);
```

**CSS 新增 pattern**（teal 设计系统兼容，对应 src/styles.css）：
```css
/* 仅用 --border / --text-2 变量，无 backdrop-filter，无多色渐变（aster-design-system 规范）*/
.batch-sub-ops {
  list-style: none;
  margin: 0;
  padding: 4px 0 4px 16px;
  border-left: 2px solid var(--border);
}
.batch-sub-op {
  padding: 2px 0;
}
.batch-sub-op__label {
  font-size: 0.8125rem;
  color: var(--text-2);
}
```

**DiffLogPanel 组件 import 扩展**（line 21-25，OperationLogEntry 需含 subOps）：
```typescript
import {
  getWriteOpsByRun, replayUndoAll, replayUndoSingle,
  type OperationLogEntry,   // ← Phase 11 后此接口含 subOps? 字段，无需改 import
  type UndoResult, type UndoStepStatus, type DocumentAdapterForReplay,
} from '../agent/operationLog';
```

---

### `src/agent/operationLog.integration.test.ts` (test, 修改)

**Analog:** self（已有守门范式，lines 119-332）

**batch_reverse 逆序守门 test pattern**（基于现有 describe 结构）：
```typescript
// 仿照现有 Excel describe block（lines 188-238）
describe('集成：replay engine × batch_reverse（Phase 11 D-11/D-17 硬卡）', () => {
  it('batch_write undo：3 subOp batch → batch_reverse → 全部 rolled_back + 逆序执行', async () => {
    const setValues = mockExcel(); // 复用既有工厂（line 47-68）

    // 构造 batch OperationLogEntry（与 tools/write/batch.ts 真实产出形状一致）
    const batchEntry: OperationLogEntry = {
      runId: 'run-batch', stepIndex: 0, toolName: 'batch_write', args: {},
      humanLabel: '批量改动 3 处',
      reverse: {
        tool: 'batch_reverse',
        args: {
          ops: [                                             // ← Record 对象数组，非位置参
            { tool: 'overwrite_range', args: { address: 'Sheet1!A1', values: [['原A1']] } },
            { tool: 'overwrite_range', args: { address: 'Sheet1!A2', values: [['原A2']] } },
            { tool: 'overwrite_range', args: { address: 'Sheet1!A3', values: [['原A3']] } },
          ],
        },
      },
      postState: { kind: 'batch', content: { subOps: [] } },
      subOps: [],
      timestamp: 0,
    };

    appendOperation(batchEntry);
    const adapter = new ExcelAdapter();
    const result = await replayUndoAll('run-batch', adapter as unknown as DocumentAdapterForReplay);

    expect(result.total).toBe(1);      // 1 条 batch entry
    expect(result.rolledBack).toBe(1); // batch 整体 rolled_back

    // 逆序执行断言（A3→A2→A1）
    expect(setValues.mock.calls[0][0]).toEqual([['原A3']]); // 最后写的先撤
    expect(setValues.mock.calls[1][0]).toEqual([['原A2']]);
    expect(setValues.mock.calls[2][0]).toEqual([['原A1']]);
  });
});
```

---

### `src/agent/contract.test.ts` (test, 修改)

**Analog:** self（已有 UndoType + ContractEntry）

**UndoType 扩展 pattern** (line 17):
```typescript
// 当前（line 17）：
type UndoType = '简单逆向' | '快照式' | 'noop+gate';
// Phase 11 修改为：
type UndoType = '简单逆向' | '快照式' | 'noop+gate' | 'batch';
```

**CONTRACT[] 新增行 pattern** (仿 lines 33-60 已有行格式):
```typescript
// 在 CONTRACT 数组末尾加：
{ toolName: 'batch_write', host: 'excel', undoType: 'batch', reverseTool: 'batch_reverse', phase: 11, integrationTest: false },
// 注：三宿主都注册，合约表只填 excel 作代表（不重复 3 行）
```

**CONTRACT 长度守门 pattern** (line 140-142):
```typescript
// 当前守门是 ≥23；加 batch_write 后需更新为 ≥24
it('CONTRACT 数组长度 ≥ 24（Phase 9/10/11 全部工具合约已声明）', () => {
  expect(CONTRACT.length).toBeGreaterThanOrEqual(24);
});
```

---

### `.planning/phases/08-foundation-a-f/CONTRACT.md` (config, 修改)

**Analog:** self（已有表格格式）

**新增行 pattern**（仿既有行，CONTRACT.md lines 16-59）：
```markdown
## Phase 11 批量操作 (C)

| tool_name | host | parameters 摘要 | undo_type | reverse_tool | integration_test | phase | status |
|---|---|---|---|---|---|---|---|
| batch_write | excel/word/ppt（三宿主注册） | ops: Array<{tool,args}>, 上限 20 | batch | batch_reverse | false | 11 | planned |
```

---

## Shared Patterns

### A-06 铁律（所有修改文件强制执行）
**Source:** `src/agent/operationLog.ts` (line 13-14 注释) + `src/adapters/ExcelAdapter.ts` (line 7 注释)
**Apply to:** `batch.ts`, `operationLog.ts`, `loop-helpers.ts`, 所有 adapter 文件
```
// A-06 严禁：本文件不出现 Word/Excel/PowerPoint 全局命名空间。
// batch_write ToolDef 不开 *.run——通过 ctx.adapter.executeBatch() 委托给 adapter 层。
// adapter 层（ExcelAdapter.ts / WordAdapter.ts / PptAdapter.ts）才可出现宿主命名空间。
```

### reverse.args = Record 对象铁律（project_adapter_inverse_signature）
**Source:** `src/adapters/ExcelAdapter.ts` lines 362-363 (`overwriteRange`)
**Apply to:** `batch.ts`（subOp.reverse.args 组装）、`ExcelAdapter.ts`（executeBatch 返回的 reverse）、`operationLog.integration.test.ts`（守门测试断言）
```typescript
// 正确（Record 对象）：
args: { address: s.proxy.address, values: s.beforeImage }
// 错误（位置参/数组）：
args: [s.proxy.address, s.beforeImage]  // ← 永远不要这样写
```

### HostApiError 包装 pattern
**Source:** `src/adapters/ExcelAdapter.ts` lines 337-340
**Apply to:** `ExcelAdapter.executeBatch`, `WordAdapter.executeBatch`, `PptAdapter.executeBatch`
```typescript
} catch (err) {
  if (err instanceof HostApiError) throw err; // 避免二次包装
  throw new HostApiError('Excel executeBatch 失败', err);
}
```

### teal 设计系统 CSS 规范
**Source:** `src/styles.css` (CSS 变量体系) + CLAUDE.md §UI 设计系统
**Apply to:** `DiffLogPanel.tsx`（.batch-sub-ops 新 CSS）、`src/styles.css`（追加）
```
// 约束：只用 --border / --text-2 / --accent / --surface 等已有 CSS 变量
// 约束：无多色渐变、无 backdrop-filter
// 约束：颜色不硬编码 hex（全用 CSS 变量）
```

### dispatchTool 15s 超时兜底
**Source:** `src/agent/tools/index.ts` lines 28, 143-153 (TOOL_TIMEOUT_MS)
**Apply to:** `batch_write` execute 方法
```typescript
// batch.ts 的 execute 被 dispatchTool 包裹（已有 15s 超时 + AsterError 兜底）
// 不需要在 execute 内部再加超时；adapter.executeBatch 抛的 HostApiError 会被 dispatchTool 捕获
```

### Vitest mock 宿主全局工厂 pattern
**Source:** `src/agent/operationLog.integration.test.ts` lines 33-91 (mockWord / mockExcel / mockPpt)
**Apply to:** `ExcelAdapter.batch.test.ts`、`operationLog.integration.test.ts` 新增 batch 测试
```typescript
// 复用现有 mockExcel() 工厂；
// 需扩展以支持 getRangeOrNullObject（batch 用 null object 模式）：
function mockExcelForBatch(syncLog: number[]): ExcelMockContext {
  const syncFn = vi.fn(async () => { syncLog.push(Date.now()); });
  // ...
}
```

---

## No Analog Found

无。所有文件都在现有 codebase 中找到了直接 analog 或 self-analog（修改既有文件）。

---

## Metadata

**Analog search scope:** `src/agent/`, `src/adapters/`, `src/components/`, `.planning/phases/08-foundation-a-f/`
**Files scanned:** 7 core files read
**Pattern extraction date:** 2026-05-31
**Key architectural constraint:** A-06（Office 命名空间不出 adapter 层）+ reverse.args = Record 对象（project_adapter_inverse_signature 铁律）是所有 batch 实现的根约束，planner 需在每个 action 中显式引用。
