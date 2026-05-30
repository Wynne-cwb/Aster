# Phase 11: 批量操作 (C) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 11-批量操作 (C)
**Mode:** `--auto`（Claude 选推荐默认）
**Areas discussed:** 核心架构（单闭包 vs dispatch）、fail-fast 行为、跨宿主/op 边界、20 上限、OperationLog 策略、batch_reverse、手改防御、DiffLogPanel UI、合约守门、结果反馈

---

## 核心架构 — batch 执行机制

| Option | Description | Selected |
|--------|-------------|----------|
| N×dispatchTool(op) | 复用既有 dispatch，每 op 各自开 run（简单但 N 次 sync） | |
| 单 `*.run` + 单 `context.sync()` | 所有 op 排队进同一 context，O(1) sync | ✓ |

**Selected:** 单闭包单 sync（D-01）。
**Notes:** BATCH-01 字面 + ROADMAP SC#1「Office 只触发单次 context.sync」+ PITFALLS E2（sync-in-loop 渐进超时）/ E3（队列 ≤50）/ tools/index 15s 超时锁定此选择。HOW（context 共享机制：重构出 `xxxIn(context,args)` helper vs Phase-11 自持 handler 注册表）留给 research/plan。**待复核：与 Phase 9/10 冻结计划的跨阶段耦合（其适配器方法各自开 run）。**

## fail-fast 行为

| Option | Description | Selected |
|--------|-------------|----------|
| 回滚已完成的前 i-1 步 | 失败即整批撤回 | |
| 报告部分完成（前 i-1 保留、后续不执行） | 前缀保留 + 报告失败位置 | ✓ |

**Selected:** 报告部分完成（D-03）。
**Notes:** ROADMAP SC#2 字面锁定「前 4 步保留、第 5-10 步不执行、报告失败位置」。**待复核：单 sync 下提交机制** — 失败若在 sync 前则天然只提交前缀；若在 sync 当下则 Office.js 批内回滚粒度不确定，回退两阶段（读/校验一次 sync + 写合法前缀一次 sync）。research 必查。

## 跨宿主 / op 边界

| Option | Description | Selected |
|--------|-------------|----------|
| 允许跨宿主批量 | 一 batch 含多宿主 op | |
| 单宿主、仅本宿主 write 工具、拒嵌套/read | Office 单 host 单 session | ✓ |

**Selected:** 单宿主（D-04 + D-05）。
**Notes:** 跨宿主在 Office 架构上物理不可能（buildToolsForHost 只暴露当前宿主工具）。拒嵌套 batch_write（防递归）、拒 read 工具。

## 20 上限语义

| Option | Description | Selected |
|--------|-------------|----------|
| 静默截断到 20 | 超出丢弃 | |
| 超限整批拒绝 INVALID_ARGS | ops.length>20 不执行任何 op | ✓ |

**Selected:** 超限整批拒（D-06）。
**Notes:** 20 呼应 max_steps=20（唯一失控防御）+ < Office 50-job 队列（20 ops ≈ 40 jobs）。PITFALLS「no silent caps」。

## OperationLog 策略

| Option | Description | Selected |
|--------|-------------|----------|
| Strategy 1 — N 条独立条目 | 每 op 一条，最细粒度 undo | |
| Strategy 2 — 1 条 batch 条目 | subOps + batch_reverse 逆序，原子 undo | ✓ |

**Selected:** Strategy 2（D-07/D-08/D-09）。
**Notes:** BATCH-02 锁定。batch_reverse 逆序 continue-on-error；per-subOp 手改防御；reverse.args = Record 对象（memory 铁律）；撤销侧也单闭包（D-08，机制同 D-01 留 research）。

## DiffLogPanel 批量卡 UI（`--skip-ui`）

| Option | Description | Selected |
|--------|-------------|----------|
| 复用 .tool-group，subOps 只读列表、整批原子 undo | 无 per-subOp 撤销，不单独 UI-SPEC | ✓ |
| per-subOp 单独撤销按钮 | Strategy-1 思路 | |

**Selected:** 复用既有范式、整批原子 undo（D-10）。
**Notes:** **待团队 lead 复核 3 子点**：(1) per-subOp 撤销=NO（贴合「一键 undo 整批」）；(2) 顶部计数「本次改动 M 处」=条目数 vs batch 行「批量改动 N 处」=子操作数，确认不误解；(3) humanLabel 文案。照 aster-design-system。

## 合约守门

**Selected:** batch_write 进 CONTRACT.md + contract.test.ts + operationLog.integration.test.ts（真 adapter 逆序守门）（D-11）。
**Notes:** 08:D-16/D-17 硬卡延续，数据安全门不软化。

## 结果反馈

**Selected:** 精简汇总 + per-op 状态（D-12，PITFALLS C4）。

## Claude's Discretion

- D-02（三宿主注册 + Excel 主验）、D-10.3（humanLabel 文案）、D-12（结果格式）、D-01 的 (A)/(B) 实现路径 = research/plan 定。

## Deferred Ideas

- per-subOp 单独撤销（Strategy 1）；跨宿主/混 read batch（架构不可能）。
- Reviewed-not-folded：`builtin-model-dropdown.md`（误报，与批量无关）。
</content>
