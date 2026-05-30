# Phase 11: 批量操作 (C) - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning
**Mode:** `--auto`（Claude 选推荐默认；逐条 log 见 `### 自动决策日志`，所有"待复核"项已在汇报中 flag 给 team-lead）

<domain>
## Phase Boundary

agent 在**单次 tool call**内批量执行多个写操作，解决两个真问题：(1) 逐单元格/逐段落操作慢（多次 Office round-trip）；(2) 工具卡片爆炸（10 个操作 = 10 张卡）。整批操作在 OperationLog 记**1 条 batch 条目**，DiffLogPanel 渲染**1 张「批量改动 N 处」可展开卡**，支持**一键 undo 整批**。

**交付 = 2 个需求：**
- **BATCH-01**：`batch_write({ops:[...]})` 单 tool call 批量执行 → **单 `Excel.run`/`Word.run`/`PowerPoint.run` 闭包 + 单 `context.sync()`**；上限 **20 ops/批次**；**第 i 步失败立即停止并报告（fail-fast，不静默续写）**。
- **BATCH-02**：OperationLog 记 **1 条 batch 条目**（含 subOps reverse 列表 + `batch_reverse` case）；DiffLogPanel 渲染「批量改动 N 处」可展开卡；**一键 undo 整批**（逆序逐个还原 subOps）。

**在 scope（HOW 待 research/plan 定）：**
- 新 `batch_write` ToolDef（`src/agent/tools/write/batch.ts`），注册进三宿主 `buildToolsForHost`。
- 单闭包单 sync 的批量 dispatch 机制（C batch Strategy 2，ARCHITECTURE.md 核心地基）。
- OperationLog 扩展：`PostStateSnapshot.kind` 加 `'batch'`、`OperationLogEntry.subOps?` 字段、`executeReverse` 加 `case 'batch_reverse'`（逆序逐个调 subOp.reverse）。
- DiffLogPanel 扩展：`entry.subOps` 嵌套渲染（既有 `.tool-group` 折叠范式增量，**不单独生成 UI-SPEC**，照 aster-design-system）。
- 合约/守门：CONTRACT.md 加 batch_write 行 + `contract.test.ts` 行 + `operationLog.integration.test.ts` 守门测试（D-17 硬卡）。

**Out of scope（不做 / 后续）：**
- 不新增 agent loop 框架（在既有 loop.ts/loop-helpers.ts/dispatch 上加）。
- 不做跨宿主批量（Office 架构上单 host 单 session，物理不可能 — 见 D-04）。
- 不新增运行时依赖（native fetch / 0 净新增依赖铁律）。
- B 工具本身的实现（Phase 9/10 负责；本阶段只 dispatch 它们已注册的 execute / 适配器逻辑）。

</domain>

<decisions>
## Implementation Decisions

> 编号 D-01.. 为本阶段（Phase 11）局部编号。引用 Phase 8 决策时写全（如 08:D-17）。

### 核心架构 — 单闭包单 sync（BATCH-01 地基）

- **D-01 单 `*.run` 闭包 + 单 `context.sync()`（锁定，非可选）。** batch_write 的执行**不是** N×`dispatchTool(op)`（那会开 N 个 run / N 次 sync，违反 BATCH-01 字面 + ROADMAP SC#1「Office 只触发单次 context.sync」+ 撞 PITFALLS E2「sync-in-loop 在 Office for Web 渐进超时」+ E3「队列 ≤50 jobs」+ tools/index.ts 的 15s `TOOL_TIMEOUT_MS`）。必须开**一个**宿主 run，把所有 op 的「读 before-image + 写」排队进同一 context，单次（或 load/write 两次，O(1) 非 O(N)）sync。
  - **HOW 留给 research/plan**（discuss 不越界定实现）：批量执行器需把每个 op 的写逻辑在**共享 context** 内调用。候选：(A) 把 Phase 5/6 既有 + Phase 9/10 适配器写方法重构出 `xxxIn(context, args)` 内部 helper（公开方法 = 薄 `*.run` 包壳调 helper），批量执行器开一个 run 逐个调 helper；(B) Phase 11 自持一个「batch op handler 注册表」(tool name → `(context,args)=>{reverse,postState}`)，只覆盖值得批量的 op，不回改 9/10。
  - **⚠ 待复核（跨阶段耦合）**：Phase 9/10 计划已 checker-green 冻结，其适配器方法各自开 `*.run`，**当前不支持 context 共享**。research 须确认最小重构面；planner 须决定走 (A) 回改/统一 helper 形态，还是 (B) Phase-11 自持 handler 注册表。倾向 **(A) 长期更干净**（避免逻辑重复 + 与适配器漂移），但 (B) 不动冻结计划、更内聚。**此点是 Phase 11 最大不确定性，已 flag。**

- **D-02 批量价值与测试焦点 = Excel 优先。** 杀手场景（ROADMAP SC#1 + Phase 13 Excel 杀手场景）都是 Excel：「格式化 10 个区域」「数字格式 + 排序 + 高亮前 5」。PITFALLS C2 也明确「Excel batch 必须单 Excel.run」。batch_write 三宿主都注册（ARCHITECTURE「add batch_write to all three host cases」），但**主验证 + 性能收益在 Excel**；Word/PPT 批量按同一单闭包范式支持，UAT 以 Excel 为主验。

### fail-fast 行为（BATCH-01）—— 团队 lead 点名灰区

- **D-03 第 i 步失败 = 报告「部分完成」，前 i-1 步保留、不回滚（SC#2 锁定）。** ROADMAP SC#2 字面：「第 5 步失败时，前 4 步的改动保留、第 5-10 步不执行，DiffLogPanel 报告失败位置（不静默跳过继续写入）」。故**不**回滚已完成步骤；停止后续；前 i-1 步作为 batch 条目正常入 OperationLog（仍可一键 undo），op i 标失败并报告位置，op i+1..N 不尝试。
  - **⚠ 待复核（与单 sync 的张力 — research 必查）**：单闭包单 sync 下，Office.js 把命令排队、`sync()` 才提交。若 op i 的失败发生在 sync **之前**（参数校验 / before-image 读取阶段）→ 天然「只提交前缀」：把 1..(i-1) 排队、遇 op i 失败就停止排队、只 sync 成功前缀（= fail-fast + 部分完成 + O(1) sync，自洽）。若失败发生在 `sync()` **当下**（如非法 range 地址在 sync 才抛）→ Office.js 对「批内中途失败是否回滚整个已排队前缀」的语义不确定（PITFALLS 未定）。**回退方案**：两阶段——先一次 sync 读/校验全部 op（拿 before-image + 探测非法 op），再只把合法前缀的写在第二次 sync 提交（仍 O(1) 两次 sync）。research 须实测/查证 Office.js 批内 sync 错误粒度，planner 据此定最终机制。**「报告部分完成」结论锁定，提交机制待 research。**

### 跨宿主 / 嵌套 / op 类型边界 —— 团队 lead 点名灰区

- **D-04 batch 单宿主（跨宿主不允许，且物理不可能）。** Add-in 一次只跑在一个宿主（`buildToolsForHost(host)`：Excel session 的 LLM 只看见 Excel 工具 + batch_write）。一个 batch 内的 ops 只能是**当前宿主已注册的 write 工具**。跨宿主批量在 Office 架构上不可能（单 host 单 session），明确 out of scope。`batch_write` 三宿主都注册，但每个实例只 dispatch 本宿主工具。
- **D-05 batch 内只收 write 工具、拒绝嵌套 batch_write、拒绝 read 工具。** op 必须是本宿主 `kind:'write'` 工具；`batch_write` 套 `batch_write` → 拒（防递归）；read 工具不进 batch（batch 是写优化）。未知/非法 tool name → 该 op 即 fail-fast 触发点（按 D-03 处理，含 dispatch.ts 既有 NOT_FOUND 语义）。

### 20 上限语义（BATCH-01）—— 团队 lead 点名灰区

- **D-06 硬上限 20 ops/单次 batch_write 调用，超限整批拒绝（不静默截断）。** 语义 = `ops[]` 数组长度 ≤ 20。`ops.length > 20` → 整个 batch_write 返回 `INVALID_ARGS`（中文 message：「单次批量最多 20 个操作，请拆分后重试」），**不执行任何 op**（PITFALLS「no silent caps」原则）。校验在开 run 之前。
  - 理由：20 与 `max_steps=20` 失控防御呼应（memory `project_cost_removed`：max_steps=20 是唯一失控防御）；且远低于 Office「队列 ≤50 jobs」（PITFALLS E3）——20 ops ×（before-image load + write）≈ 40 jobs < 50，留余量。
  - 注：20 上限是**单次 call** 的，不跨 run 累计；run 整体安全仍由 loop 的 max_steps=20 兜。

### OperationLog —— Strategy 2 单 batch 条目（BATCH-02）

- **D-07 一条 batch `OperationLogEntry`（Strategy 2，锁定）。** 不是每 op 一条。扩展（照 ARCHITECTURE.md §Batch↔OperationLog）：
  - `PostStateSnapshot.kind` 加 `'batch'`，content = `{ subOps: Array<{ humanLabel, postState, reverse }> }`。
  - `OperationLogEntry` 加可选 `subOps?: Array<{ humanLabel; postState?; reverse: ReverseDescriptor }>`（供 DiffLogPanel 嵌套渲染）。
  - batch 条目的 `reverse = { tool: 'batch_reverse', args: { ops: [{tool,args}, ...] } }`。
  - `executeReverse` 加 `case 'batch_reverse'`：**逆序**遍历 subOps，逐个调既有 `executeReverse(subOp.reverse, adapter)` 复用现有分发；**continue-on-error per subOp**（某 subOp 手改/报错则跳过、其余照撤，呼应 D-11 三态语义）。
  - **铁律（memory `project_adapter_inverse_signature`）**：subOp.reverse.args 必须是 **Record 对象**（非位置参），否则真机 undo 全挂（Phase 5 教训）。batch_reverse 内对每个 subOp 用 `adapter.method(args 对象)` 调。
- **D-08 batch_reverse 也走单闭包（撤销侧对称）。** 整批 undo 也应在一个宿主 run 内逆序执行所有 subOp 的 reverse + 单 sync（与正向 D-01 对称，避免 N 次 sync）。⚠ 机制同 D-01 留给 research/plan（executeReverse 当前每 case 各自开 run；batch_reverse 单闭包逆序同样需 context 共享，与 D-01 (A)/(B) 同源）。
- **D-09 D-11 手改防御（per-subOp）。** batch 条目的 postState.kind='batch' 内每个 subOp 带自己的 postState。undo 时对每个 subOp 各自 `readTargetState + isTargetStateConsistent`，手改过的 subOp 跳过保留、其余照撤。聚合状态：DiffLogPanel 批量卡是**1 行 1 个 undo 按钮**（原子 undo 单元，见 D-10），内部 per-subOp 三态聚合后给一个总结（撤 X 步 / 跳过手改 Y 步 / 报错 Z 步，复用既有 SummaryModal 三态文案）。

### DiffLogPanel 批量卡 UI（BATCH-02）—— `--skip-ui`，待复核

- **D-10 复用既有 `DiffLogPanel` + `.tool-group` 折叠范式，不单独生成 UI-SPEC。** `OperationLogEntry.subOps` 存在时：卡头 = 「批量改动 N 处」（N = subOps.length），展开后逐行列每个 subOp 的 `humanLabel`（只读，**无 per-subOp 撤销按钮**）。整批共用 1 个「撤销该步」按钮 + 参与底部「撤销本次所有操作」。沿用 `.tool-group`/`.tool-group__list`/`.badge` 类与 aster-design-system；如需嵌套样式仅加轻量 `.batch-sub-ops`。
  - **⚠ 待复核（团队 lead 复核此处 UI 决策）**：
    1. **per-subOp 撤销按钮？** 推荐 **NO** — batch = 原子 undo 单元（贴合用户心智 + BATCH-02「一键 undo 整批」）。若产品想要「展开后可单撤某 subOp」则需 Strategy-1 思路改动，不在当前锁定内。
    2. **顶部计数语义**：DiffLogPanel 头「本次改动 M 处」M = 条目数（1 个 batch 算 1 条）；batch 行内自报「批量改动 N 处」（N = 实际子操作数）。即一个含「1 batch(10) + 2 普通写」的 run 顶部显示「本次改动 3 处」、batch 行显示「批量改动 10 处」。照 ARCHITECTURE.md 流程图，可接受，但 flag 给团队 lead 确认计数文案不引起误解。
    3. **humanLabel 文案**：batch 卡头建议「批量改动 {N} 处」；如需更富信息可「批量改动 N 处：写入 A1:B3、设格式 C1:C10…」（前 2-3 个 subOp label + 省略号）。planner 可微调。

### 合约 / 守门（D-16/D-17 硬卡延续）

- **D-11 batch_write 入合约表 + contract.test + undo 守门（D-17 硬卡）。** 照 08:D-16/D-17：
  - `.planning/phases/08-foundation-a-f/CONTRACT.md` 加 batch_write 行：undo_type = `batch（1 条 batch 条目 + batch_reverse 逆序）`、reverse_tool = `batch_reverse`、phase = 11。
  - `src/agent/contract.test.ts` 加对应行（integrationTest: false → 实现后 true）。
  - `src/agent/operationLog.integration.test.ts` 加守门测试：**用真 adapter（非 mock，照 Phase 9/10 范式）**构造多 subOp batch → batch_reverse undo → 断言全部 `rolled_back` + subOps **逆序**执行 + reverse.args 是 Record 对象被正确消费。这是**数据安全门，不走 08:D-04 质量>>成本软化**（08:D-06 边界：undo 守门硬卡）。
- **D-12 batch tool 结果反馈精简（PITFALLS C4）。** batch_write 返回的 `data` 精简汇总（如「已执行 N 步：[labels]」+ 每 op ok/fail 状态供 fail-fast 报告），不回显所有写入值（避免 batch 结果撑爆 LLM context）。token 不设硬 gate（08:D-04/D-18），但精简是合理默认。

### Claude's Discretion（planner 可在实现细节微调）

- D-02（三宿主都注册、Excel 主验）、D-10.3（humanLabel 文案）、D-12（结果精简格式）为推荐默认。
- D-01 的 (A)/(B) 实现路径选择 = research/plan 决定（discuss 不越界定 HOW）。

### Folded Todos

无。（cross_reference_todos 命中 1 条 `builtin-model-dropdown.md`，score 0.4，但仅命中 "phase" 关键词、与批量操作无关 → 误报，不 fold，记入 Deferred。）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents（researcher / planner）MUST read these before planning or implementing.**

### 批量架构地基（最核心）
- `.planning/research/ARCHITECTURE.md` §C「Batch write operations」+ §「Batch (C) ↔ OperationLog ↔ Diff Card Interaction」+ §「OperationLog type extensions」+ §「DiffLogPanel rendering extension」 — Strategy 2 单 batch 条目设计 + 完整数据流 + 类型扩展样板（PostStateSnapshot.kind='batch'、subOps 字段、batch_reverse case、DiffLogPanel 嵌套渲染）。**单闭包单 sync 是此处与 PITFALLS 的核心地基。**
- `.planning/research/PITFALLS.md` §「Batch Operations (Feature C) Pitfalls」(C1 部分失败 / C2 单 Excel.run 单 sync / C3 一条 batch 条目原子 undo / C4 结果精简) + §Excel Quirks (E2 sync-in-loop 渐进超时 / E3 队列 ≤50 jobs / E5 merge 阻塞 sort) — fail-fast + sync 边界 + 20 上限上界依据。

### 工具合约 / undo 守门（D-16/D-17）
- `.planning/phases/08-foundation-a-f/CONTRACT.md` — 工具注册表 + undo 三分类 + Phase 9/10 各工具 reverse_tool（batch dispatch 复用这些 reverse）+ 使用说明（实现后改 status/integrationTest + 加 operationLog.integration.test）。
- `.planning/phases/08-foundation-a-f/08-CONTEXT.md` §「能力合约」D-16/D-17/D-18/D-19 — 合约双保险、undo 守门硬卡、token 门已去、B 工具裁剪已锁。

### 既有代码（实现锚点）
- `src/agent/operationLog.ts` — `OperationLogEntry`/`PostStateSnapshot`/`ReverseDescriptor`/`executeReverse`/`replayUndoAll`/`replayUndoSingle`/`DocumentAdapterForReplay`（batch 扩展点：kind 加 'batch'、subOps 字段、batch_reverse case、逆序 continue-on-error）。
- `src/agent/loop-helpers.ts` `runOneToolCall` — dispatch + 双路径 push + `appendOperation`（仅 result.reverse 时）；`stepIndex = getOperationsByRun(runId).length`（batch 是 1 条，占 1 个 opIndex）。
- `src/agent/tools/index.ts` — `ToolDef`/`ToolResult`/`dispatchTool`（15s TOOL_TIMEOUT_MS）/`buildToolsForHost`（batch_write 注册进三宿主）/`assertWriteToolRegisterable`。
- `src/agent/tools/write/excel.ts` — write tool execute 范式（execute → `ctx.adapter.method()` 各自开 `Excel.run`；before-image → reverse(overwrite_range) + postState）。**这是 D-01「各自开 run」现状的证据，单闭包需突破此。**
- `src/components/DiffLogPanel.tsx` — `.tool-group` 折叠卡 + per-step 撤销 + ConfirmModal + SummaryModal 三态（batch 卡复用此）。
- `src/agent/contract.test.ts` + `src/agent/operationLog.integration.test.ts` — 守门范式（真 adapter、reverse.args Record 对象、逆序断言）。

### 项目铁律
- `./CLAUDE.md` — 无后台 / 纯静态 / bundle ≤82KB / 0 净新增依赖 / native fetch / teal 设计 / storage.* / 发布授权。
- `.claude/skills/aster-design-system`（构建/改 DiffLogPanel UI 时自动加载）— teal token + 组件类名 + 反模式。
- ROADMAP.md Phase 11 §「Success Criteria」4 条（SC#1 单 sync + 批量卡；SC#2 fail-fast 部分完成；SC#3 一键 undo 整批；SC#4 展开见 subOp humanLabel）。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`executeReverse` switch（operationLog.ts）**：batch_reverse 只是新加一个 case，**复用**既有各 reverse case 分发逐个撤 subOp（逆序）。
- **`DiffLogPanel` `.tool-group` 折叠 + StatusBadge + Summary/ConfirmModal**：batch 卡是 subOps 嵌套渲染的增量，三态文案/modal 全复用。
- **`dispatchTool` NOT_FOUND / sanitize 边界**：batch 内未知 tool name 走既有 NOT_FOUND 语义触发 fail-fast。
- **`appendOperation` + `stepIndex = getOperationsByRun().length`**：batch 是 1 条 entry，自然占 1 个唯一 opIndex（DiffLogPanel React key / per-step 撤销键），无碰撞。

### Established Patterns
- **A-06 铁律**：operationLog / batch_write ToolDef **不出现** Word/Excel/PowerPoint 全局命名空间；所有宿主调用走 `ctx.adapter`。单闭包批量执行器须在 adapter 层（而非 tool 层）开 run。
- **write tool 现状 = 每方法各自开 `*.run` + 各自 sync**（excel.ts 证）→ 这是 D-01 单闭包要突破的结构；research 须定 context 共享机制。
- **reverse.args = Record 对象（非位置参）**：batch subOp reverse 必须遵守（memory `project_adapter_inverse_signature`）。
- **undo 守门 = 真 adapter integration test**（非 mock），照 Phase 9/10。

### Integration Points
- `buildToolsForHost`：三宿主 case 数组各 append `batch_write`（含 `assertWriteToolRegisterable`）。
- `operationLog.ts`：`PostStateSnapshot.kind` 并集加 'batch'；`OperationLogEntry` 加 `subOps?`；`executeReverse` 加 `case 'batch_reverse'`；`DocumentAdapterForReplay` 可能加批量执行所需的方法签名。
- `loop-helpers.ts runOneToolCall`：batch_write 返回 `result.reverse`（batch_reverse）+ `result.postState`（kind='batch'）+ result 上携带 subOps → `appendOperation` 透传 subOps 到 entry。
- `DiffLogPanel.tsx`：渲染分支 `entry.subOps && expanded` → `.batch-sub-ops` 列表。
- 新文件 `src/agent/tools/write/batch.ts`。

</code_context>

<specifics>
## Specific Ideas

- **杀手验证场景（Excel，ROADMAP SC#1 + Phase 13）**：一次对话「给 A1:E20 加数字格式 + 排序 + 高亮前 5 名」→ batch_write 单次 sync 生效 → DiffLogPanel「批量改动 N 处」→ undo 全部还原。这是 batch 的标杆 demo，plan 的成功标准应可被它端到端检验。
- **fail-fast 演示**：构造批内第 i 步非法（如非法 range / 不存在的 tool name）→ 前 i-1 步保留 + 报告失败位置 + 后续不执行（SC#2）。
- **batch_reverse 逆序**：3 subOp batch（写 A1 → 写 A2 → 写 A3）undo 时按 A3→A2→A1 逆序还原（守门测试断言顺序）。

</specifics>

<deferred>
## Deferred Ideas

- **per-subOp 单独撤销（Strategy 1 思路）**：当前锁定 batch = 原子 undo 单元（D-10）。若未来产品要「展开后单撤某一子操作」，是独立增量，不在 Phase 11。
- **batch 与 read 混合 / 跨宿主 batch**：架构上不可能（D-04），永久 out。

### Reviewed Todos (not folded)
- **`builtin-model-dropdown.md`（DeepSeek + AiHubMix 内置 model 下拉）** — cross_reference_todos 命中（score 0.4）但仅命中 "phase" 关键词，与批量操作无关，**误报不 fold**。归 Provider/Settings UX 范畴，与 Phase 11 无关。

</deferred>

---

### 自动决策日志（`--auto`，供复核）

- [auto] 核心架构 — Q:「batch 执行 = N×dispatch 还是单闭包?」→ 选「单 `*.run` + 单 `context.sync()`」（D-01；BATCH-01 字面 + SC#1 + PITFALLS E2/E3 锁定；HOW 留 research）。
- [auto] fail-fast — Q:「前 i-1 步回滚还是报告部分完成?」→ 选「报告部分完成、前 i-1 保留」（D-03；SC#2 字面锁定；sync 提交机制留 research）。
- [auto] 跨宿主 — Q:「batch 内允许跨宿主吗?」→ 选「单宿主（跨宿主物理不可能）」（D-04）。
- [auto] op 边界 — Q:「batch 收什么?」→ 选「仅本宿主 write 工具、拒嵌套 batch、拒 read」（D-05）。
- [auto] 上限 — Q:「20 上限语义?」→ 选「ops.length ≤ 20，超限整批拒 INVALID_ARGS、不静默截断」（D-06；呼应 max_steps=20 + <50 jobs）。
- [auto] OperationLog — Q:「N 条还是 1 条?」→ 选「Strategy 2：1 条 batch 条目 + subOps + batch_reverse 逆序 continue-on-error」（D-07；BATCH-02 锁定）。
- [auto] undo 单闭包 — Q:「batch_reverse 也单闭包?」→ 选「是，逆序单 run 单 sync」（D-08；与 D-01 对称，机制留 research）。
- [auto] 手改防御 — Q:「per-subOp 还是整批?」→ 选「per-subOp readTargetState + 跳过手改，聚合给总结」（D-09）。
- [auto] UI — Q:「批量卡形态?」→ 选「复用 DiffLogPanel `.tool-group`，subOps 只读列表、无 per-subOp 撤销、整批原子 undo，不单独 UI-SPEC」（D-10；待团队 lead 复核 3 个 UI 子点）。
- [auto] 守门 — Q:「batch 进合约 + 守门?」→ 选「CONTRACT 行 + contract.test 行 + operationLog.integration.test 真 adapter 逆序守门」（D-11；D-17 硬卡延续）。
- [auto] 结果反馈 — Q:「batch 结果回显?」→ 选「精简汇总 + per-op 状态」（D-12；PITFALLS C4）。

*Phase: 11-c*
*Context gathered: 2026-05-31*
</content>
</invoke>
