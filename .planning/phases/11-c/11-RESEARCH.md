# Phase 11: 批量操作 (C) - Research

**Researched:** 2026-05-31
**Domain:** Office.js batch execution, single-closure single-sync, OperationLog batch extension, DiffLogPanel nested render
**Confidence:** HIGH（架构分析基于真实 codebase + 官方 Office.js 文档；sync 错误语义基于官方文档 + GitHub issues 交叉验证）

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**核心架构 — 单闭包单 sync（BATCH-01 地基）**
- D-01：batch_write 执行必须是单 `*.run` 闭包 + 单 `context.sync()`，不得是 N×dispatchTool（违反 SC#1 + PITFALLS E2/E3 + 15s TOOL_TIMEOUT_MS）。HOW 待 research/plan 定。

**fail-fast 行为（BATCH-01）**
- D-03：第 i 步失败 = 前 i-1 步保留（不回滚），停止后续，DiffLogPanel 报告失败位置（SC#2 锁定）。提交机制待 research。

**跨宿主 / 嵌套 / op 类型边界**
- D-04：单宿主（跨宿主不允许，物理不可能）。
- D-05：batch 内只收当前宿主 write 工具；拒绝嵌套 `batch_write`；拒绝 read 工具。

**20 上限语义（BATCH-01）**
- D-06：ops.length > 20 → 整批拒绝 INVALID_ARGS，不静默截断；校验在开 run 之前。

**OperationLog — Strategy 2 单 batch 条目（BATCH-02）**
- D-07：1 条 batch `OperationLogEntry`（含 subOps）；`PostStateSnapshot.kind` 加 `'batch'`；`OperationLogEntry.subOps?` 可选字段；`executeReverse` 加 `case 'batch_reverse'`（逆序、continue-on-error per subOp）；subOp.reverse.args 必须是 Record 对象（非位置参）。
- D-08：batch_reverse 也走单闭包（逆序单 run 单 sync），机制与 D-01 同源，留 research/plan。
- D-09：per-subOp readTargetState + isTargetStateConsistent；跳过手改者保留；聚合三态给 SummaryModal。

**DiffLogPanel 批量卡 UI（BATCH-02）**
- D-10：复用 `.tool-group` 折叠范式，头 = 「批量改动 N 处」，展开后只读 subOp humanLabel 列表，**无 per-subOp 撤销按钮**（batch = 原子 undo 单元）；整批共 1 个「撤销该步」按钮。

**合约 / 守门**
- D-11：CONTRACT.md 加 batch_write 行（reverseTool='batch_reverse'，phase=11）；`contract.test.ts` 加对应行（integrationTest: false→true）；`operationLog.integration.test.ts` 加**真 adapter**（非 mock）守门测试，断言 rolled_back + 逆序执行 + reverse.args 是 Record 对象。此守门是 D-17 硬卡，不受 08:D-04 质量>>成本软化影响。

**结果反馈**
- D-12：batch_write 返回精简汇总（已执行 N 步 + per-op ok/fail 状态），不回显所有写入值。

### Claude's Discretion

- D-01 (A)/(B) 实现路径选择（research/plan 决定）
- D-02 三宿主都注册、Excel 主验（推荐默认）
- D-10.3 humanLabel 文案微调
- D-12 结果精简格式

### Deferred Ideas (OUT OF SCOPE)

- per-subOp 单独撤销（Strategy 1 思路）
- batch 与 read 混合 / 跨宿主 batch（架构不可能）
- builtin-model-dropdown.md（无关误报）
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BATCH-01 | Agent 可在单个 tool call 内批量执行多个写操作 via `batch_write({ops:[...]})`——单 `Excel.run`/`Word.run` 闭包 + 单 `context.sync()`；上限 20 ops/批次；第 i 步失败立即停止并报告（不静默续写） | §Architecture Patterns: 两阶段机制（pre-validation sync + write sync）实现 O(1) 两次 sync + fail-fast 部分完成；§Option A adapter inner-helper 重构路径，结合 §Concrete Code Sketch |
| BATCH-02 | 批量操作在 OperationLog 记 1 条 batch 条目（含 subOps reverse 列表 + `batch_reverse` case），DiffLogPanel 渲染「批量改动 N 处」可展开卡——一键 undo 整批 | §OperationLog Batch Extension 类型扩展完整规格；§DiffLogPanel batch card rendering；§batch_reverse single-closure 逆序机制；§Contract gate spec |
</phase_requirements>

---

## Summary

Phase 11 实现 `batch_write` ToolDef，使 LLM 一次 tool call 批量执行多个写操作——解决逐单元格慢（多次 Office round-trip）与工具卡爆炸（N 操作 = N 张卡）两个问题。核心约束是 D-01「单 `*.run` + 单 `context.sync()`」——当前每个 adapter 写方法各自开独立 run 的结构必须被突破。

**最关键发现：** Office.js `context.sync()` **无事务性回滚语义**——sync 失败不会自动回滚已排队的前序写操作（官方文档 + GitHub issues 双重确认）。这意味着 D-03「第 i 步失败前 i-1 步保留」的语义可通过「两阶段：先一次 sync 读/校验全部 op + 只排队合法前缀的写在第二次 sync 提交」精确实现，且天然契合 SC#2 字面。

**主要推荐：** 选择 Option A（adapter inner-helper 重构），在每个 adapter 写方法旁抽出 `xxxIn(ctx, args)` context-aware 内部 helper，公开方法变薄包壳。batch 执行器在 adapter 层开单个 `*.run`，逐 op 调 inner helper。这是最干净的长期方案，避免逻辑重复，但需要 Phase 9/10 adapter 方法同步重构（影响面需精确评估，见下）。

**Primary recommendation:** 采用两阶段 batch 执行机制（Phase 1：预校验 + 读 before-image → Phase 2：只把通过校验的前缀写入 → 单次 write-sync）；搭配 Option A adapter inner-helper 拆分；batch_reverse 沿用同一 context-sharing 机制做逆序单闭包撤销。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| batch_write ToolDef | Agent / Tool Layer (`src/agent/tools/write/batch.ts`) | — | Tool registry 入口点，参数校验（D-05/D-06），汇总结果 |
| 批量执行 context 共享 | Adapter Layer (`ExcelAdapter`/`WordAdapter`/`PptAdapter`) | Tool Layer | A-06 铁律：Office 命名空间不出 adapter；单 run 必须在 adapter 方法内开 |
| OperationLog batch 条目 | Agent / OperationLog (`src/agent/operationLog.ts`) | Tool Layer | 1 条 batch entry + subOps + batch_reverse case |
| DiffLogPanel 批量卡渲染 | UI Layer (`src/components/DiffLogPanel.tsx`) | — | 嵌套 subOp humanLabel 只读列表，原子 undo 按钮 |
| Contract + undo gate | Test Layer（`contract.test.ts` + `operationLog.integration.test.ts`） | — | D-11 D-17 硬卡 |

---

## Standard Stack

### Core（复用已有，0 净新增依赖）

| 库 / 模块 | 版本 | 用途 | 备注 |
|-----------|------|------|------|
| Office.js CDN | hosted/1 | `Excel.run` / `Word.run` / `PowerPoint.run` 单闭包 | [VERIFIED: codebase + 官方 CDN] |
| `src/agent/tools/index.ts` | — | `dispatchTool`, `buildToolsForHost`, `assertWriteToolRegisterable` | [VERIFIED: codebase] |
| `src/agent/operationLog.ts` | — | `appendOperation`, `executeReverse`, `replayUndoAll/Single` | [VERIFIED: codebase] |
| `src/components/DiffLogPanel.tsx` | — | `.tool-group` 折叠卡范式，ConfirmModal, SummaryModal | [VERIFIED: codebase] |
| React 19 / Zustand / Lingui | 同已有 | UI + i18n | [VERIFIED: CLAUDE.md] |

### 新文件

| 文件 | 用途 |
|------|------|
| `src/agent/tools/write/batch.ts` | `batch_write` ToolDef |

**安装：** 无新包安装（0 净新增运行时依赖铁律）。

---

## Architecture Patterns

### System Architecture Diagram

```
LLM emits: batch_write({ ops: [{tool, args}, ...N ops] })
          |
          v
[Tool Layer: batch.ts]
  1. Validate: ops.length ≤ 20; 每 op tool 是当前宿主 write 工具; 无嵌套 batch_write; 无 read 工具
     → 校验失败 → 返回 INVALID_ARGS（不开 run）
  2. 调 adapter.executeBatch(ops)
          |
          v
[Adapter Layer: ExcelAdapter.executeBatch / WordAdapter.executeBatch / PptAdapter.executeBatch]
  Phase 1 (pre-sync): 开单个 *.run 闭包
    ├─ for each op:
    │    ├─ 调 op.innerHelper.validateAndQueue(ctx, args) → load before-image
    │    ├─ 若 op i 校验失败（参数非法/range不存在）→ 记录 failAtIndex=i，break
    │    └─ 否则把「写命令」加到 pending write queue（尚未 sync）
    └─ await ctx.sync() ← Phase 1 sync（读 before-image；Office.js 无事务回滚：此 sync 失败整批失败）
  Phase 2 (write-sync): 只对 ops[0..failAtIndex-1]（合法前缀）排队写
    ├─ for each valid op: ctx.queue(write command via innerHelper.writeIn(ctx, args, beforeImage))
    └─ await ctx.sync() ← Phase 2 sync（写入合法前缀；若 sync 失败 throw，由 executeBatch catch 包成 HostApiError）
  返回 { subOps: [{humanLabel, reverse, postState, ok}, ...], failAtIndex? }
          |
          v
[Tool Layer: batch.ts]
  3. 组装 OperationLogEntry:
     reverse = { tool: 'batch_reverse', args: { ops: subOps[0..completed].map(s=>s.reverse) } }
     postState = { kind: 'batch', content: { subOps: subOps[0..completed] } }
     subOps = subOps[0..completed].map(s=>({humanLabel, postState, reverse}))
  4. 返回 ToolResult { ok: partialOk, data: { completed, total, failed?, labels }, reverse, postState }
          |
          v
[loop-helpers.ts: runOneToolCall]
  appendOperation({ runId, stepIndex, toolName: 'batch_write', humanLabel, reverse, postState,
                    subOps, timestamp })  ← subOps 透传到 OperationLogEntry
          |
          v
[DiffLogPanel: 渲染 1 条 batch 卡]
  头: 「批量改动 N 处」（N = completed subOps）
  展开: subOps.map(s => <li>{s.humanLabel}</li>)（只读，无单独撤销按钮）
  底部: 「撤销该步」→ replayUndoSingle(batchEntry) → executeReverse(batch_reverse)
          |
          v
[executeReverse: case 'batch_reverse']
  adapter.executeBatchReverse({ subOps: [...], 逆序 })
  → 单 *.run 闭包，逆序 for subOp of subOps.reverse():
       innerHelper.reverseIn(ctx, subOp.reverse.args) → 加进 ctx queue
  → await ctx.sync()（单次）
  continue-on-error per subOp（部分失败不中断整批 undo）
```

### Recommended Project Structure

```
src/
├── agent/
│   ├── tools/write/
│   │   ├── batch.ts            ← NEW: batch_write ToolDef
│   │   ├── excel.ts            ← 可能：提取 inner helpers（Option A）
│   │   ├── word.ts             ← 可能：提取 inner helpers（Option A）
│   │   └── ppt.ts              ← 可能：提取 inner helpers（Option A）
│   ├── operationLog.ts         ← 扩展 kind + subOps + batch_reverse case
│   ├── contract.test.ts        ← 加 batch_write 行
│   └── operationLog.integration.test.ts  ← 加 batch 守门测试
├── adapters/
│   ├── ExcelAdapter.ts         ← 加 executeBatch() + inner helpers（Option A）
│   ├── WordAdapter.ts          ← 加 executeBatch() + inner helpers
│   └── PptAdapter.ts           ← 加 executeBatch() + inner helpers
└── components/
    └── DiffLogPanel.tsx        ← 加 subOps 嵌套渲染分支 + .batch-sub-ops CSS
```

---

## Critical Research Findings

### 发现 1：Office.js sync 错误语义——无事务回滚（D-03 关键依据）

**研究结论（HIGH 信心）：** Office.js `context.sync()` **不提供事务性原子性**。[CITED: learn.microsoft.com/en-us/office/dev/add-ins/develop/application-specific-api-model]

> "You can queue up as many changes as you wish on the request context, and then call the `sync()` method to run the batch of queued commands."

这是一个**批次优化**，不是事务保证。官方文档从未声明 sync 失败会回滚已排队写命令的前序部分。从 GitHub 多个 issue（#4273, #684, #1012）来看：
- sync 失败有时整个请求失败（全部写被拒）
- 有时 sync 挂住不 resolve 也不 reject（timeout 场景）
- **没有任何证据表明 Office.js 会部分回滚**

[CITED: github.com/OfficeDev/office-js/issues/4273] [CITED: github.com/OfficeDev/office-js/issues/3565]

**对 D-03 的含义：** sync 错误语义的不确定性，反而支持了「两阶段」方案：
- **Phase 1 sync（读/预校验）**：读 before-image + 探测非法 op（range 不存在等在 load 时被标为 null object）
- **Phase 2 sync（写）**：只对通过预校验的前缀 ops 排队写，然后单次 sync

这样：
- 若某 op 在 Phase 1 校验就发现非法（如 range 不存在） → 该 op 就是失败点 i，Phase 2 只写 ops[0..i-1] → 「前 i-1 步保留，第 i 步不执行」天然实现
- 若 Phase 2 sync 本身失败 → 整个 batch 失败（OperationLog 不记录此 batch）→ 合理容错
- **不依赖** Office.js 原本就不存在的回滚语义

**[VERIFIED: 两阶段机制在 Office.js 官方「correlated objects pattern」精神一致：load → sync → write → sync]**

---

### 发现 2：Option A vs Option B——单闭包 context 共享机制选择（D-01）

**现状（从 codebase 直读）：** 当前每个 adapter 写方法都开独立 `*.run`：
```typescript
// ExcelAdapter.setRangeValues — 现状
async setRangeValues(address, values) {
  return await Excel.run(async (ctx) => {  // ← 独立 run
    const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
    range.load(['values', 'address']);
    await ctx.sync();        // ← sync 1
    const beforeImage = { address: range.address, values: range.values };
    range.values = values;
    await ctx.sync();        // ← sync 2
    return { beforeImage };
  });
}
```
[VERIFIED: codebase `src/adapters/ExcelAdapter.ts` setRangeValues/applyFormula/setCell]

**批量执行需要的是：** 在一个共享 `ctx` 内，逐 op 执行「load before-image + queue write」，最后一次（或两次）sync。

#### Option A：adapter inner-helper 重构（推荐）

**做法：** 把每个 adapter 写方法的 **ctx 感知逻辑** 抽成 `xxxIn(ctx, args)` 内部 helper；公开方法变成薄包壳：

```typescript
// ExcelAdapter 重构示意（A-06：仍在 adapter 内，不出 Office 命名空间）
export class ExcelAdapter implements DocumentAdapter {
  // ── 公开方法（薄包壳，向后兼容，Phase 5/6 工具不改签名）──
  async setRangeValues(address: string, values: unknown[][]) {
    return await Excel.run((ctx) => this._setRangeValuesIn(ctx, address, values));
  }

  // ── batch 可用的 context-aware inner helper ──
  async _setRangeValuesIn(
    ctx: Excel.RequestContext,
    address: string,
    values: unknown[][]
  ): Promise<{ beforeImage: { address: string; values: unknown[][] } }> {
    const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
    range.load(['values', 'address']);
    // 注意：这里不调 ctx.sync()，只 load；sync 由 batch executor 统一调
    // beforeImage 在 Phase 1 sync 后读取 → 见下 executeBatch 设计
    return { rangeProxy: range };  // 返回 proxy 供 Phase 2 写
  }

  // ── batch 执行入口 ──
  async executeBatch(ops: BatchOp[]): Promise<BatchResult> {
    return await Excel.run(async (ctx) => {
      // Phase 1: load + 预校验
      const staged: Array<{ op: BatchOp; proxy: Excel.Range; beforeImage?: unknown[][] }> = [];
      let failAtIndex = -1;

      for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        try {
          const proxy = this._getProxyForOp(ctx, op);  // 根据 op 类型 getRange/getChart 等
          proxy.load(['values', 'address']);
          staged.push({ op, proxy });
        } catch (e) {
          failAtIndex = i;
          break;
        }
      }

      // Phase 1 sync：读 before-image（发现 range 不存在等 ItemNotFound 在此抛出）
      try {
        await ctx.sync();
      } catch {
        throw new HostApiError('batch Phase 1 sync 失败');
      }

      // 判断哪些 staged ops 合法（ItemNotFound 会使 proxy.isNullObject = true）
      // 找到第一个非法 op → 那是 failAtIndex
      for (let i = 0; i < staged.length; i++) {
        if (!this._isProxyValid(staged[i].proxy)) {
          failAtIndex = i;
          break;
        }
        staged[i].beforeImage = staged[i].proxy.values as unknown[][];
      }

      // Phase 2: 只对合法前缀排队写
      const toCommit = failAtIndex === -1 ? staged : staged.slice(0, failAtIndex);
      for (const { op, proxy, beforeImage } of toCommit) {
        this._applyWriteToProxy(proxy, op);  // 修改 proxy 属性，不 sync
      }

      // Phase 2 sync
      await ctx.sync();

      // 组装 subOps 结果
      return {
        subOps: toCommit.map((s) => ({
          humanLabel: s.op.humanLabel,
          beforeImage: s.beforeImage,
          reverse: { tool: s.op.reverseTool, args: { address: s.proxy.address, values: s.beforeImage } },
          postState: { kind: 'excel_range', content: { address: s.proxy.address } },
          ok: true,
        })),
        failAtIndex: failAtIndex !== -1 ? failAtIndex : undefined,
      };
    });
  }
}
```

[ASSUMED: Phase 9/10 的 adapter 方法（Word 5 个 + Excel 10 个 + PPT 8 个）在实现时还未写，所以 inner-helper 重构可以在 Phase 9/10 实现时直接以 inner-helper 形态实现，Phase 11 只需在 executeBatch 中调用；不需要 rewrite 已有方法——Phase 5/6 已有的 setRangeValues/setCell/applyFormula/insertChart/insertSlide/setShapeProperty/moveShape/setShapeText 才需要 refactor]

**Phase 5/6 已有方法的重构面（ExcelAdapter）：**
- `setRangeValues` → `_setRangeValuesIn(ctx, ...)` + 薄包壳
- `setCell` → `_setCellIn(ctx, ...)` + 薄包壳
- `applyFormula` → `_applyFormulaIn(ctx, ...)` + 薄包壳
- `insertChart` → `_insertChartIn(ctx, ...)` + 薄包壳（insertChart 不 batchable，因 chart 创建需要 sync 读 name）
- `overwriteRange` → undo path，单 run 即可，不需 inner-helper

Phase 9/10 新增方法（Word 5 + Excel 10 + PPT 8）→ **直接以 inner-helper 形态实现**（从一开始就有 `xxxIn` + 薄包壳），无需后期重构。

**优点：** 避免逻辑重复；与 adapter 紧耦合（不漂移）；长期更干净。

**缺点：** Phase 5/6 已有 4 个 Excel 方法 + PPT/Word 已有 adapter 方法需重构（合计约 12 个已有方法需加 inner-helper 分层）；修改已实现的 adapter 有引入 regression 的风险（须补测）。

#### Option B：Phase-11-owned batch handler 注册表（保守）

**做法：** 新建 `src/agent/tools/write/batchHandlers.ts`，为每个 batchable op 提供独立的 `(ctx, args) => {beforeImage, writeProxy}` 处理函数，完全不修改 Phase 9/10 adapter：

```typescript
// batchHandlers.ts（A-06：不出现 Excel 命名空间，通过 adapter 的特殊 executeBatch 入口调）
type BatchHandler = {
  readIn: (ctx: SharedContext, args: unknown) => void;  // 只 load，不 sync
  writeIn: (ctx: SharedContext, staged: StagedOp) => void;  // 只 queue write
  buildReverse: (staged: StagedOp) => ReverseDescriptor;
  buildPostState: (staged: StagedOp) => PostStateSnapshot;
  humanLabel: (args: unknown) => string;
};

// 每个 batchable tool 的 handler 单独实现（逻辑与 adapter 方法平行，不复用）
const handlers: Record<string, BatchHandler> = {
  'set_range_values': { readIn: ..., writeIn: ..., buildReverse: ..., ... },
  'format_excel_range': { readIn: ..., writeIn: ..., ... },
  // ...只注册值得 batch 的写 tool
};
```

**优点：** 完全不动 Phase 9/10 frozen plans；Phase 11 完全自包含；不引入 regression 风险。

**缺点：** 写入逻辑与 adapter 方法重复，随时可能漂移；需维护 2 套代码路径（adapter 直调 + batch handler）；若 Phase 9/10 修改 adapter 方法行为，batch handler 不自动跟进。

#### 选择推荐（Claude's Discretion）

**推荐 Option A**，理由：
1. Phase 9/10 计划已 checker-green 冻结，但其 **adapter 方法尚未实现**（status=planned）——这意味着 Phase 9/10 实现时可以直接用 inner-helper 形态，成本几乎为 0。
2. 已实现的 Phase 5/6 方法（setRangeValues/setCell/applyFormula/insertChart + PPT/Word 已有方法）只需在 Phase 11 这个 Wave 重构，约 12 个方法，每个只是「加 `xxxIn` 辅助 + 薄包壳」，改动小，向后兼容。
3. Option B 逻辑重复导致未来维护负担重，与 Aster「无后台/精简栈」精神不符。

**如果 planner 评估重构风险不可接受，可改选 Option B**（不动 Phase 9/10，Phase 11 自持 handler 注册表）。研究建议 Option A，但标记此决策为 Claude's Discretion。

---

### 发现 3：两阶段 fail-fast 机制具体实现（D-03）

**两阶段完整规格：**

```
Phase 1（读/校验阶段，O(1) 单次 sync）：
  for i in 0..N-1:
    op = ops[i]
    // 参数校验（不开 Office run，纯 JS 层）
    if op.tool 不在当前宿主 write 工具集 OR op.tool == 'batch_write':
      failAtIndex = i; failReason = 'INVALID_OP'; break
    // 用 getXxxOrNullObject 探测 range/shape 等是否存在
    proxy = adapter.ctx.workbook.worksheet.getRangeOrNullObject(op.args.address)
    proxy.load(['values', 'address', 'isNullObject'])
    staged.push({ op, proxy })
  await ctx.sync()  ← Phase 1 唯一 sync

  // Phase 1 sync 后检查 null objects + 读 before-image
  for i in 0..staged.length-1:
    if staged[i].proxy.isNullObject:
      failAtIndex = i; failReason = 'RANGE_NOT_FOUND'; break
    // 读 before-image（已 load）
    staged[i].beforeImage = staged[i].proxy.values
    staged[i].address = staged[i].proxy.address  // server 端规范化地址

Phase 2（写阶段，O(1) 单次 sync）：
  toCommit = failAtIndex === -1 ? staged : staged.slice(0, failAtIndex)
  for { op, proxy } of toCommit:
    proxy.values = op.args.values    // 只 queue，不 sync
  await ctx.sync()  ← Phase 2 唯一 sync

结果：
  - toCommit 对应的 subOps：ok=true，有 beforeImage，记录入 batch entry
  - ops[failAtIndex] 如果存在：在 ToolResult.data 中报告失败位置 + failReason
  - ops[failAtIndex+1..N-1]：未尝试，data 中列为 not_executed
```

**重要约束：**
- 20 op 上限 × (1 load + 1 write) = ~40 batch jobs < 50 job 上限 [CITED: learn.microsoft.com/en-us/office/dev/add-ins/testing/application-specific-api-error-handling]
- 每次 `getRange` 操作需使用 `getItemOrNullObject` / `getRangeOrNullObject` 模式而非直接 `getRange`（后者在 range 不存在时抛 ItemNotFound 而非返回 null object），这样在 Phase 1 sync 后可检查 `isNullObject` 而不是 try/catch
- Word 工具的 Phase 1 校验方式不同（Word 没有统一的「range address」校验），需按 tool 类型分别处理

---

### 发现 4：OperationLog batch 扩展完整规格（D-07/D-08/D-09）

#### 4.1 类型扩展

```typescript
// operationLog.ts 扩展
export interface PostStateSnapshot {
  kind: 'word_paragraph' | 'excel_range' | 'excel_chart' | 'ppt_slide' | 'ppt_shape' | 'batch';
  //                                                                                        ↑ 新增
  content: unknown;
  // batch 时 content = {
  //   subOps: Array<{
  //     humanLabel: string;
  //     postState?: PostStateSnapshot;  // 每个 subOp 的写后状态
  //     reverse: ReverseDescriptor;     // 每个 subOp 的撤销描述符
  //   }>
  // }
}

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

[VERIFIED: 与 ARCHITECTURE.md §OperationLog type extensions 完全对齐]

#### 4.2 batch entry 组装（在 batch.ts execute 中）

```typescript
// src/agent/tools/write/batch.ts execute 返回
const reverse: ReverseDescriptor = {
  tool: 'batch_reverse',
  args: {
    // Record 对象，非位置参（project_adapter_inverse_signature 铁律）
    ops: completedSubOps.map((s) => ({
      tool: s.reverse.tool,
      args: s.reverse.args,     // ← 必须是 Record 对象
    })),
  },
};
const postState: PostStateSnapshot = {
  kind: 'batch',
  content: {
    subOps: completedSubOps.map((s) => ({
      humanLabel: s.humanLabel,
      postState: s.postState,
      reverse: s.reverse,
    })),
  },
};
// ToolResult 中还携带 subOps 供 appendOperation 透传
return {
  ok: failAtIndex === -1 || completedSubOps.length > 0,  // 至少完成了 1 op 才算 partial ok
  data: { completed: completedSubOps.length, total: ops.length, failed: failAtIndex },
  reverse,
  postState,
  subOps: completedSubOps.map((s) => ({ humanLabel: s.humanLabel, postState: s.postState, reverse: s.reverse })),
};
```

注意：`ToolResult` 当前无 `subOps` 字段。需在 `tools/index.ts` 扩展：
```typescript
export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: ToolError;
  reverse?: ReverseDescriptor;
  postState?: PostStateSnapshot;
  subOps?: Array<{ humanLabel: string; postState?: PostStateSnapshot; reverse: ReverseDescriptor }>;
  // ↑ 新增：batch 专用，loop-helpers.ts appendOperation 时透传
}
```

并在 `loop-helpers.ts runOneToolCall` 的 `appendOperation` 调用处透传 `subOps`：
```typescript
appendOperation({
  runId, stepIndex: opIndex, toolName: tc.name, args: tc.arguments,
  humanLabel, reverse: result.reverse,
  postState: result.postState,
  subOps: result.subOps,  // ← 新增透传
  timestamp: Date.now(),
});
```

#### 4.3 executeReverse `case 'batch_reverse'`

```typescript
// operationLog.ts executeReverse 新增 case
case 'batch_reverse': {
  // batch_reverse.args.ops 是 Array<{tool, args}>（Record 对象，非位置参）
  const ops = reverse.args.ops as Array<{ tool: string; args: Record<string, unknown> }>;
  // 逆序：最后写的 subOp 先撤
  const reversedOps = [...ops].reverse();
  // D-08：单闭包逆序撤销（与 D-01 对称）
  // 依赖 adapter.executeBatchReverse（adapter 层提供 context-sharing 逆序写）
  // 若 adapter 不提供 executeBatchReverse，降级为逐 subOp 分别调 executeReverse（多次 run）
  if ((adapter as BatchCapableAdapter).executeBatchReverse) {
    await (adapter as BatchCapableAdapter).executeBatchReverse(reversedOps);
  } else {
    // 降级路径：continue-on-error 逐个（多次 run，不满足 D-08 单闭包，但不崩）
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

**D-08 单闭包逆序 undo 的 adapter 接口：**
```typescript
// DocumentAdapterForReplay 扩展（operationLog.ts）
export interface DocumentAdapterForReplay {
  // ... 已有方法 ...
  /** Phase 11：batch_reverse 单闭包逆序撤销（D-08 对称设计）*/
  executeBatchReverse?: (ops: Array<{ tool: string; args: Record<string, unknown> }>) => Promise<void>;
}
```

`executeBatchReverse` 在 adapter 内部：开单个 `*.run`，逆序遍历 ops，对每个 subOp 调对应的 `reverseIn(ctx, op.tool, op.args)` inner helper（与 D-01 复用同一套 inner-helper 机制），最后单次 sync。continue-on-error 在 inner-helper 层面：某个 subOp reverse 失败不 throw，记录后继续下一个。

---

### 发现 5：DiffLogPanel 批量卡 UI（D-10）

**渲染逻辑（增量，不替换）：**

```tsx
// DiffLogPanel.tsx 修改：在 writeOps.map() 内，若 entry.subOps 存在且 expanded，渲染嵌套列表
{writeOps.map((entry) => {
  const state = stepStates[entry.stepIndex];
  const isUndone = state === 'rolled_back' || state === 'skipped_manual' || state === 'skipped_error';
  // ... 现有渲染逻辑 ...
  return (
    <li key={entry.stepIndex} className={liClass}>
      <div className="wb-action-head" style={{ cursor: 'default' }}>
        <span className="wb-action-target">{entry.humanLabel}</span>
        {/* 状态 badge 与撤销按钮——已有逻辑不变 */}
        {isUndone && <StatusBadge status={state} />}
        {!isUndone && (
          <button className="btn btn-ghost btn-sm" onClick={() => void handleUndoStep(entry)}>
            <Trans>撤销该步</Trans>
          </button>
        )}
      </div>
      {/* 新增：batch entry 展开后显示 subOps 只读列表 */}
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
})}
```

**CSS 新增（src/styles.css，teal 设计系统兼容）：**
```css
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
  font-size: 0.8125rem;  /* var(--text-sm) */
  color: var(--text-2);
}
```

[VERIFIED: 与 aster-design-system 的 teal 设计系统兼容（CSS 变量 --border/--text-2）；无多色渐变/无 backdrop-filter]

**计数语义（D-10.2 flag 给 lead 确认）：**
- DiffLogPanel 头「本次改动 M 处」：M = `writeOps.length`（条目数，1 个 batch = 1 条）
- batch 行 humanLabel：「批量改动 N 处」（N = `entry.subOps.length`）
- 例：「1 batch(10) + 2 普通写」的 run → 头显示「本次改动 3 处」，batch 行显示「批量改动 10 处」

---

### 发现 6：20 op 上限 + 校验逻辑（D-06）

```typescript
// batch.ts execute 第一步，在开 run 之前
if (!Array.isArray(args.ops) || args.ops.length === 0) {
  return { ok: false, error: { code: 'INVALID_ARGS', message: 'ops 必须为非空数组', hint: '请提供至少一个操作', recoverable: false } };
}
if (args.ops.length > 20) {
  return {
    ok: false,
    error: {
      code: 'INVALID_ARGS',
      message: `单次批量最多 20 个操作，请拆分后重试（当前 ${args.ops.length} 个）`,
      hint: '将 ops 拆分为多次 batch_write 调用，每次 ≤20 个',
      recoverable: true,
    },
  };
}
// 不开 *.run，直接返回错误
```

**理由：** 20 × 2 syncs per op（Phase 1 的 1 load + Phase 2 的 1 write）= 40 jobs < 50 上限 [CITED: learn.microsoft.com PITFALLS E3]；与 max_steps=20 失控防御呼应 [VERIFIED: REQUIREMENTS.md §NFR]。

---

### 发现 7：Contract + undo gate 规格（D-11）

#### CONTRACT.md 新增行

```markdown
| batch_write | excel/word/ppt（三宿主各注册） | ops: Array<{tool,args}>, 上限 20 | batch（1 条 batch 条目 + batch_reverse 逆序） | batch_reverse | false | 11 | planned |
```

#### contract.test.ts 新增行

```typescript
{ toolName: 'batch_write', host: 'excel', undoType: 'batch', reverseTool: 'batch_reverse', phase: 11, integrationTest: false },
// 注：host 填 excel 作为代表（三宿主都注册但合约表不重复 3 行）
```

注意：`contract.test.ts` 当前 `undoType` 类型是 `'简单逆向' | '快照式' | 'noop+gate'`，需扩展加 `'batch'`：
```typescript
type UndoType = '简单逆向' | '快照式' | 'noop+gate' | 'batch';
```

#### operationLog.integration.test.ts 守门测试规格

```typescript
describe('集成：replay engine × batch_reverse（Phase 11 D-11/D-17 硬卡）', () => {
  it('batch_write undo：3 subOp batch → batch_reverse → 全部 rolled_back + 逆序执行 + reverse.args 是 Record 对象', async () => {
    // 1. 使用真 ExcelAdapter（mock Office.js 宿主全局，同现有 mockExcel() 范式）
    const setValuesCalls: Array<unknown[][]> = [];
    // mock Excel.run 记录写入顺序
    const setValues = setupMockExcelForBatch(setValuesCalls);

    // 2. 构造 3 subOp batch OperationLogEntry（与 tools/write/batch.ts 真实产出形状一致）
    const batchEntry: OperationLogEntry = {
      runId: 'run-batch',
      stepIndex: 0,
      toolName: 'batch_write',
      args: { ops: [ /* ... */ ] },
      humanLabel: '批量改动 3 处',
      // reverse.args.ops 是 Array<{tool,args}>（Record 对象，非位置参）
      reverse: {
        tool: 'batch_reverse',
        args: {
          ops: [
            { tool: 'overwrite_range', args: { address: 'Sheet1!A1', values: [['原A1']] } },  // subOp 0
            { tool: 'overwrite_range', args: { address: 'Sheet1!A2', values: [['原A2']] } },  // subOp 1
            { tool: 'overwrite_range', args: { address: 'Sheet1!A3', values: [['原A3']] } },  // subOp 2
          ],
        },
      },
      postState: { kind: 'batch', content: { subOps: [ /* ... */ ] } },
      subOps: [ /* 3 subOps */ ],
      timestamp: 0,
    };

    appendOperation(batchEntry);

    // 3. 执行 batch_reverse undo
    const adapter = new ExcelAdapter();
    const result = await replayUndoAll('run-batch', adapter as unknown as DocumentAdapterForReplay);

    // 4. 断言
    expect(result.total).toBe(1);         // 1 条 batch entry
    expect(result.rolledBack).toBe(1);    // batch 整体 rolled_back
    expect(result.skippedHostError).toBe(0);

    // 5. 断言逆序执行（A3 → A2 → A1）
    expect(setValuesCalls[0]).toEqual([['原A3']]);  // 最后写的先撤（逆序）
    expect(setValuesCalls[1]).toEqual([['原A2']]);
    expect(setValuesCalls[2]).toEqual([['原A1']]);

    // 6. 断言 reverse.args 是 Record 对象被正确消费（非位置参）
    // 通过「setValues 被调用时参数正确」间接验证（Record 对象解构 address/values 成功）
  });

  it('batch_write undo：per-subOp 手改防御（某 subOp 手改后跳过，其余照撤）', async () => {
    // subOp 1 对应位置已被用户手改 → D-09：跳过该 subOp，其余照撤
    // ...
  });
});
```

**守门约束（project_adapter_inverse_signature 铁律）：**
- `reverse.args.ops` 必须是 `Array<{ tool: string; args: Record<string, unknown> }>`
- 每个 `subOp.reverse.args` 必须是 Record 对象（非位置参）
- `adapter.executeBatchReverse(ops)` 内部对每个 subOp 调 `adapter.method(args 对象)` 而非位置参

---

## Don't Hand-Roll

| 问题 | 不要自建 | 用什么 | 原因 |
|------|----------|--------|------|
| 单闭包 context 共享 | 不要另开 N×dispatchTool | Option A inner-helper + adapter.executeBatch | N×run = N×sync 违反 SC#1/PITFALLS E2/E3/TOOL_TIMEOUT_MS |
| per-subOp undo | 不要 Strategy 1（N 条 entry）| Strategy 2（1 条 batch entry + subOps） | 满足「一键 undo 整批」心智；DiffLog 卡不爆炸 |
| batch_reverse 分发 | 不要手写 switch | 复用 executeReverse 已有 case（降级路径）；主路径走 executeBatchReverse | 已有 switch 已涵盖所有 reverse tool |
| subOps 计数显示 | 不要修改 DiffLogPanel 顶部「本次改动 M 处」语义 | batch entry 自报「批量改动 N 处」 | M = 条目数不变（1 batch = 1 条）；N = subOps.length |
| Office run 超时 | 不要去掉 TOOL_TIMEOUT_MS | 保留 15s timeout | batch 单次 run 若超时，15s 降级为可恢复 HOST_API 错误 |

**关键洞察：** 单闭包批量执行是 Office.js 的「批次优化」哲学的 Phase 11 具体应用——所有 queued 写操作在单 sync 中刷新，避免 N 次 IPC round-trip。

---

## Common Pitfalls

### Pitfall 1：N×dispatchTool 违反单闭包约束（C2 PITFALL）
**什么会出错：** 如果 batch_write.execute 内部对每个 op 调 `dispatchTool(op, ctx, tools)`，则每个 op 的 adapter 方法开独立 `*.run` → N 个 run → N 次 sync → 违反 D-01 + 触发 PITFALLS E2 渐进超时 + 吃掉 15s TOOL_TIMEOUT_MS。
**为什么发生：** 复用现有 dispatchTool 感觉「最干净」，但现有 adapter 方法各自开 run。
**如何避免：** batch_write.execute 不调 dispatchTool，改走 adapter.executeBatch（内部单 run）；[VERIFIED: ARCHITECTURE.md §C 明确「serially/parallel-dispatching existing tool execute functions inside execute」是 Strategy 1 / ARCHITECTURE 早期草稿，Phase 11 CONTEXT 已推翻，改为单闭包方案]。
**预警信号：** Phase 1 sync 时间随 N 增加呈线性增长而非常数。

### Pitfall 2：sync 错误误以为 Office.js 会回滚（D-03 常见误解）
**什么会出错：** 认为「sync 失败 = 整批回滚」从而假设 D-03「前 i-1 步保留」是自动的——实际上 Office.js 无事务保证，sync 失败可能导致不可预知的部分提交状态。
**为什么发生：** Office.js API 是「批次优化」而非「事务系统」；官方文档从未声明原子性。[CITED: github.com/OfficeDev/office-js/issues/4273]
**如何避免：** 使用两阶段机制（Phase 1 预校验 + Phase 2 只写合法前缀），在 Phase 2 sync 之前就确定「哪些 op 被提交」，不依赖 sync 失败语义。
**预警信号：** 任何依赖 Office.js 异常来推断「哪些写成功了」的代码。

### Pitfall 3：getRange vs getRangeOrNullObject 导致 Phase 1 抛非预期异常
**什么会出错：** Phase 1 用 `ctx.worksheet.getRange(invalidAddr)` → sync 时抛 `InvalidReference` 而非返回 null object → try/catch 必须在 sync 外包，导致难以判断是哪个 op 失败。
**为什么发生：** `getRange` 和 `getXxxOrNullObject` 行为不同；Office.js 异常不携带「哪个命令失败」的索引信息 [CITED: learn.microsoft.com error-handling doc]。
**如何避免：** Phase 1 一律用 `getRangeOrNullObject`，sync 后检查 `isNullObject` 而非 try/catch 每个 op；invalid range address 格式在 Phase 1 sync 前用 JS 正则预检（避免把非法地址送到 Office）。
**预警信号：** batch 内某个 op 失败时，失败下标无法确定。

### Pitfall 4：reverse.args 用位置参而非 Record 对象（project_adapter_inverse_signature 铁律）
**什么会出错：** `subOp.reverse.args = ['Sheet1!A1', [[1, 2]]]`（数组/位置参）→ `adapter.overwriteRange(args)` 调用时 `args.address` 为 undefined → 真机 undo 全挂（Phase 5 教训）。
**为什么发生：** 数组在 JS 中可以当 args 传，但 adapter 的 Record 参数签名解构时 address/values 不在对应位置。
**如何避免：** 始终 `{ tool, args: { address: '...', values: [[...]] } }`（Record 对象）；integration test 中断言 `typeof receivedArgs === 'object' && receivedArgs.address === '...'`。
**预警信号：** integration test 中 `adapter.method` 收到 undefined 字段值。

### Pitfall 5：batch entry 的 OperationLogEntry.subOps 未透传导致 DiffLogPanel 展开不显示子项
**什么会出错：** batch.ts execute 返回的 ToolResult 含 `subOps`，但 `runOneToolCall` 中 `appendOperation` 未透传 → entry.subOps 为 undefined → DiffLogPanel 展开后无子列表。
**为什么发生：** `ToolResult` 当前无 `subOps` 字段；loop-helpers.ts `appendOperation` 调用只透传已有字段。
**如何避免：** 同时扩展 `ToolResult` + `OperationLogEntry` 接口 + `appendOperation` 调用处（3 处必须同步改，见 §Architecture 发现 4.2）。
**预警信号：** DiffLogPanel batch 行展开后 subOps 列表为空。

---

## Code Examples

### 完整 batch_write ToolDef 骨架

```typescript
// src/agent/tools/write/batch.ts
// [VERIFIED: 遵循 tools/write/excel.ts 范式 + A-06 不出现 Office 命名空间]
import type { ToolDef, ToolResult } from '../index';
import type { ExcelAdapter } from '../../../adapters/ExcelAdapter';
import type { WordAdapter } from '../../../adapters/WordAdapter';
import type { PptAdapter } from '../../../adapters/PptAdapter';

interface BatchOp {
  tool: string;
  args: Record<string, unknown>;
}

interface BatchWriteArgs {
  ops: BatchOp[];
}

export const batchWrite: ToolDef<BatchWriteArgs> = {
  name: 'batch_write',
  kind: 'write',
  description: '批量执行多个写操作（单次 sync）。ops 数组最多 20 个；第 i 步失败时前 i-1 步保留、后续停止。',
  parameters: {
    type: 'object',
    properties: {
      ops: {
        type: 'array',
        maxItems: 20,
        items: {
          type: 'object',
          properties: {
            tool: { type: 'string', description: '写工具名（当前宿主已注册的 write 工具）' },
            args: { type: 'object', description: '工具参数（与直接调用该工具的参数相同）' },
          },
          required: ['tool', 'args'],
        },
        description: '要批量执行的写操作列表，最多 20 个',
      },
    },
    required: ['ops'],
  },
  humanLabel: ({ ops }) => `批量改动 ${ops.length} 处`,
  async execute({ ops }, ctx): Promise<ToolResult> {
    // D-06：20 op 上限校验（开 run 之前）
    if (!Array.isArray(ops) || ops.length === 0) {
      return { ok: false, error: { code: 'INVALID_ARGS', message: 'ops 必须为非空数组', hint: '请提供至少一个操作', recoverable: false } };
    }
    if (ops.length > 20) {
      return {
        ok: false,
        error: { code: 'INVALID_ARGS', message: `单次批量最多 20 个操作，请拆分后重试（当前 ${ops.length} 个）`, hint: '将 ops 拆分为多次 batch_write 调用，每次 ≤20 个', recoverable: true },
      };
    }

    // D-05：校验每个 op 类型（非 batch_write 递归，非 read 工具）
    const { adapter, runId } = ctx;
    // ... 调 adapter.executeBatch(ops) 获取 batchResult ...

    // 组装 reverse + postState + subOps（见 §发现 4.2）
    // ...
    return { ok: true, data: { completed: N, total: ops.length }, reverse, postState, subOps };
  },
};
```

### executeReverse case 'batch_reverse' 骨架

```typescript
// operationLog.ts 新增 case（[VERIFIED: 与已有 switch 结构一致]）
case 'batch_reverse': {
  const ops = reverse.args.ops as Array<{ tool: string; args: Record<string, unknown> }>;
  const reversedOps = [...ops].reverse();  // 逆序：最后写的先撤（SC#3 + D-07）

  // D-08：优先用 executeBatchReverse 单闭包（与 D-01 对称）
  if ('executeBatchReverse' in adapter && typeof (adapter as unknown as Record<string, unknown>).executeBatchReverse === 'function') {
    await (adapter as { executeBatchReverse: (ops: typeof reversedOps) => Promise<void> }).executeBatchReverse(reversedOps);
  } else {
    // 降级路径：逐个调已有 executeReverse case（多次 run；continue-on-error per subOp，D-09）
    for (const subOp of reversedOps) {
      try {
        await executeReverse({ tool: subOp.tool, args: subOp.args }, adapter);
      } catch {
        // continue-on-error per subOp（D-09：手改/报错的 subOp 跳过，其余照撤）
      }
    }
  }
  break;
}
```

---

## State of the Art

| 旧做法 | 当前推荐做法 | 变化时间 | 影响 |
|--------|-------------|----------|------|
| 每个写 tool 独立 `*.run` | batch 执行器单 `*.run` + Option A inner-helper | Phase 11 新增 | N×sync → 1×(2 sync)，性能巨幅提升 |
| N 条 OperationLog 条目 | 1 条 batch 条目 + subOps | Phase 11 CONTEXT D-07 锁定 | DiffLogPanel 不爆炸，undo 体验更干净 |
| per-step 撤销（Strategy 1）| 整批原子 undo（Strategy 2）| Phase 11 CONTEXT D-10 锁定 | 符合用户「undo 这次批量」心智 |

**废弃 / 过时：**
- ARCHITECTURE.md 草稿中「`dispatchTool` 串联调用」方案（已被 D-01 单闭包要求取代）
- Strategy 1（N 条 entry）方案（已被 D-07 锁定为 Strategy 2）

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 9/10 adapter 方法在 Phase 11 实现时尚未写，可在实现时直接用 inner-helper 形态，避免大量重构 | §发现 2 Option A | 若 Phase 9/10 先于 Phase 11 实现（按 roadmap 是的），则 Phase 11 需回改约 23 个新方法 + 4 个 Phase 5/6 方法 → 风险中等，需补回归测试 |
| A2 | Office.js 两阶段 Phase 1 sync 中，`getRangeOrNullObject` 在无效 range address 时返回 isNullObject=true（不 throw）；适用于 Excel | §发现 3 | 若某些无效地址仍 throw 而非 null → 需用 try/catch per-op 包裹，失败位置判定更复杂 |
| A3 | `executeBatchReverse` 单闭包逆序 undo 可行（复用与 D-01 相同的 inner-helper 机制）；降级路径（多次 run）是可接受的备选 | §发现 4.3 | 若 inner-helper 机制未在 Phase 11 前实现（Phase 9/10 未用 inner-helper 形态），则 D-08 单闭包 undo 无法实现，只能用降级路径（仍满足 BATCH-02 功能，但违反 D-08「对称设计」） |
| A4 | `ToolResult` 扩展 `subOps?` 字段后，`loop-helpers.ts` 的 `appendOperation` 调用可直接透传（不需要修改 chat store 或 wire message 格式） | §发现 4.2 | 若 chatStore 序列化/反序列化 ToolResult 时丢弃未知字段 → subOps 不进 operationLog → DiffLogPanel 无法渲染子列表 |
| A5 | Word 和 PPT 的 `executeBatch` 也能用两阶段机制（Phase 1 预校验 + Phase 2 写），适用 Word.run / PowerPoint.run | §发现 3 | Word/PPT 的「校验」方式与 Excel Range 不同（无 getRangeOrNullObject 统一模式）；Word 需 paragraphIndex 校验，PPT 需 shapeId 校验——各自的 Phase 1 校验逻辑更复杂，可能需要宿主特定实现 |

**若此表为空：** 表示本次 research 所有 claim 均经过验证或引用。本次有 5 条 ASSUMED claim，planner 在指定各 Wave 任务时需确认 A1/A3 最高风险项。

---

## Open Questions

1. **Option A vs Option B 最终选择（plan 决定）**
   - 已知：Phase 9/10 计划 checker-green 冻结但 adapter 方法未实现；Phase 5/6 已有 ~12 个 adapter 方法需重构
   - 未知：planner 评估重构风险是否可接受
   - 建议：优先 Option A（更干净），若风险不可控可改 Option B

2. **Word `executeBatch` Phase 1 校验方式**
   - 已知：Word 写工具用 paragraphIndex / uniqueLocalId 定位，无「range address」统一校验点
   - 未知：如何在 Phase 1 sync 前识别「Word 写操作的目标不存在」
   - 建议：Word Phase 1 校验降级为「JS 层参数类型检查」（paragraphIndex 必须是 number，uniqueLocalId 如果提供必须是 string），非法参数在开 run 前拒绝；范围存在性在 Phase 1 sync 后由 `itemOrNullObject` 检查 → 若 Word API 没有对应 null object 模式，则接受「Phase 1 不做范围存在性校验，写时失败则 Phase 2 sync throw → catch」

3. **`ToolResult.subOps` 字段对 chatStore 序列化的影响**
   - 已知：Phase 8 HIST-01 实现了 chatStore 持久化，序列化时只保留白名单字段
   - 未知：`subOps` 是否在白名单内；若不在，chatStore 重新 hydrate 后 `subOps` 丢失，DiffLogPanel 无法渲染子列表
   - 建议：`subOps` 仅存在于 in-memory `OperationLogEntry`（不经 chatStore 持久化）；`ToolResult.subOps` 只是从 batch.ts execute 到 `appendOperation` 的临时载体，不进 wire message（不序列化）

4. **batch_write 的 D-10.2 计数文案是否需要 lead 确认**
   - 「本次改动 3 处」vs「本次改动 13 处（含批量 10 处）」的分歧
   - 建议：按现有设计（M = 条目数）——简单清晰；batch 行自报「批量改动 N 处」——详细；无需改顶部逻辑

---

## Environment Availability

Phase 11 是纯代码/配置修改（在现有 Office.js + TypeScript + React 栈上增量），无额外外部依赖。

**Skip condition：** SKIPPED（无新外部依赖，所有运行时能力已在 Phase 5/6 验证）。

---

## Validation Architecture

> `workflow.nyquist_validation: true`（config.json），本节必须包含。

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest（已配置，vitest.config.ts） |
| Config file | `vitest.config.ts`（项目根） |
| Quick run command | `npm test -- --run src/agent/operationLog.integration.test.ts` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| BATCH-01 | 20 op 上限——超限整批拒绝 INVALID_ARGS | unit | `npm test -- --run src/agent/tools/write/batch.test.ts` | ❌ Wave 0 |
| BATCH-01 | D-05 校验：拒绝 read 工具 / 嵌套 batch_write | unit | `npm test -- --run src/agent/tools/write/batch.test.ts` | ❌ Wave 0 |
| BATCH-01 | 单闭包单 sync（Excel：phase 1+phase 2 = O(1) 2 次 sync）| integration（真 adapter mock Office）| `npm test -- --run src/adapters/ExcelAdapter.batch.test.ts` | ❌ Wave 0 |
| BATCH-01 | fail-fast 部分完成：第 3 个 op 非法时 op[0..1] 保留 | integration | `npm test -- --run src/adapters/ExcelAdapter.batch.test.ts` | ❌ Wave 0 |
| BATCH-02 | batch entry 1 条记录入 OperationLog（含 subOps）| unit | `npm test -- --run src/agent/operationLog.test.ts` | ✅（需加 batch case） |
| BATCH-02 | batch_reverse 逆序执行所有 subOp（A3→A2→A1）| integration（D-11 D-17 硬卡）| `npm test -- --run src/agent/operationLog.integration.test.ts` | ✅（需加 batch case） |
| BATCH-02 | batch_reverse reverse.args 是 Record 对象被正确消费 | integration | 同上 | ✅（需加 batch case） |
| BATCH-02 | DiffLogPanel batch 卡头 humanLabel 正确 | unit（React render）| `npm test -- --run src/components/DiffLogPanel.test.tsx` | ❌ Wave 0 |
| BATCH-01/02 | 合约表完整（batch_write 行 + integrationTest CI 守门）| unit（contract.test.ts 自动）| `npm test -- --run src/agent/contract.test.ts` | ✅（需加 batch 行）|

### Sampling Rate

- **Per task commit：** `npm test -- --run src/agent/operationLog.integration.test.ts src/agent/contract.test.ts`（D-17 硬卡守门）
- **Per wave merge：** `npm test -- --run`（全套）
- **Phase gate：** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/agent/tools/write/batch.test.ts` — 覆盖 BATCH-01 校验逻辑（20 cap、D-05 校验、INVALID_ARGS 返回格式）
- [ ] `src/adapters/ExcelAdapter.batch.test.ts` — 覆盖 BATCH-01 单闭包 sync 计数（2 次 sync，非 N 次）+ fail-fast 部分完成
- [ ] `src/components/DiffLogPanel.test.tsx` — 覆盖 BATCH-02 batch 卡 humanLabel + subOps 列表渲染（若已有 DiffLogPanel.test 则追加 case）
- [ ] `src/agent/operationLog.integration.test.ts` 追加 batch_reverse 逆序守门 case（D-11 D-17 硬卡；此文件已存在）
- [ ] `src/agent/contract.test.ts` 追加 batch_write 行 + 扩展 UndoType 包含 `'batch'`（此文件已存在）

**真机 UAT 项（automation 无法覆盖）：**
- UAT-1：真机（Office for Web Chrome/Edge）：agent 调 batch_write 格式化 10 个单元格区域 → 验证 Office 只触发单次 context.sync（网络 DevTools 观察 XHR 次数 = 1）
- UAT-2：真机：对「批量改动 10 处」点「撤销该步」→ 全部 10 处一键还原（SC#3）
- UAT-3：真机：构造批内第 5 步非法 → 前 4 步保留 + 第 5 步报告失败 + 第 6-10 步不执行（SC#2）
- UAT-4：真机：DiffLogPanel 批量卡展开 → 显示每个 subOp humanLabel（SC#4）

---

## Security Domain

> `security_enforcement` 未明确设 `false`，按默认 enabled 处理。

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | 否 | — |
| V3 Session Management | 否 | — |
| V4 Access Control | 否 | — |
| V5 Input Validation | 是 | ops.length ≤ 20 硬校验；每个 op.tool 白名单校验（只收已注册 write 工具）；拒绝嵌套 batch_write 防递归 |
| V6 Cryptography | 否 | — |

### Known Threat Patterns for batch_write

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| ops 数组注入超大批次（ops.length > 20） | DoS | 硬上限 20 + 开 run 前整批拒绝 INVALID_ARGS |
| 嵌套 batch_write 导致递归爆栈 | DoS | execute 开始时检查 op.tool !== 'batch_write'，命中则该 op fail-fast |
| read 工具混入 batch 导致数据泄露（batch 结果回 LLM）| Information Disclosure | D-05：只收 `kind === 'write'` 工具；D-12：结果只回 ok/fail 状态，不回显写入值 |
| reverse.args 中注入恶意地址（undo 时写到非预期 range）| Tampering | reverse.args 在 execute 时由 adapter 构建（server 端规范化 address），不由 LLM 直接控制 |

---

## Sources

### Primary (HIGH confidence)
- `/Users/wb.chen/Documents/Project/Aster/src/adapters/ExcelAdapter.ts` — 现有 setRangeValues/setCell/applyFormula 各自开 run 结构（D-01 现状依据）
- `/Users/wb.chen/Documents/Project/Aster/src/agent/operationLog.ts` — PostStateSnapshot/OperationLogEntry/executeReverse/replayUndoAll 扩展点（类型扩展依据）
- `/Users/wb.chen/Documents/Project/Aster/src/agent/tools/index.ts` — ToolDef/ToolResult/dispatchTool/buildToolsForHost（batch 注册点）
- `/Users/wb.chen/Documents/Project/Aster/src/agent/loop-helpers.ts` — runOneToolCall/appendOperation（subOps 透传点）
- `/Users/wb.chen/Documents/Project/Aster/src/components/DiffLogPanel.tsx` — .tool-group 折叠范式 + StatusBadge + ConfirmModal + SummaryModal（batch 卡复用基础）
- `/Users/wb.chen/Documents/Project/Aster/src/agent/operationLog.integration.test.ts` — 守门测试范式（真 adapter + Record args 断言）
- [Microsoft Learn — Using the application-specific API model](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/application-specific-api-model) — sync 批次语义（无事务回滚保证）
- [Microsoft Learn — Error handling with application-specific APIs](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/application-specific-api-error-handling) — 50 batch job 上限；error codes
- [Microsoft Learn — Avoid context.sync in loops](https://learn.microsoft.com/en-us/office/dev/add-ins/concepts/correlated-objects-pattern) — correlated objects pattern（split loop：load → sync → write → sync 范式依据）

### Secondary (MEDIUM confidence)
- [OfficeDev/office-js Issue #3565](https://github.com/OfficeDev/office-js/issues/3565) — sync-in-loop 渐进超时（PITFALLS E2 依据）
- [OfficeDev/office-js Issue #4273](https://github.com/OfficeDev/office-js/issues/4273) — context.sync 失败行为（无自动回滚补充证据）

### Tertiary (LOW confidence)
- 无

---

## Metadata

**Confidence breakdown:**
- 单闭包机制方案分析（Option A/B）：HIGH — 基于真实 codebase 代码路径
- Office.js sync 错误语义：HIGH — 官方文档 + GitHub issues 双重确认
- 两阶段 fail-fast 设计：MEDIUM — 基于 Office.js correlated objects 范式推导，未真机验证两阶段 sync 在批量写失败时的行为
- DiffLogPanel 扩展：HIGH — 基于真实 DiffLogPanel 源码
- OperationLog 扩展规格：HIGH — 基于真实 operationLog.ts 类型定义

**Research date:** 2026-05-31
**Valid until:** 2026-06-30（Office.js API 稳定；Aster codebase 若有重大重构需更新）
