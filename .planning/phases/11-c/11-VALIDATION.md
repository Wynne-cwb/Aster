---
phase: 11
slug: c
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 11-RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest（已配置） |
| **Config file** | `vitest.config.ts`（项目根） |
| **Quick run command** | `npm test -- --run src/agent/operationLog.integration.test.ts src/agent/contract.test.ts` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~30 秒（全套）；守门子集 ~5 秒 |

---

## Sampling Rate

- **After every task commit:** `npm test -- --run src/agent/operationLog.integration.test.ts src/agent/contract.test.ts`（D-17 undo 硬卡守门）
- **After every plan wave:** `npm test -- --run`（全套）
- **Before `/gsd-verify-work`:** 全套必须绿
- **Max feedback latency:** ~30 秒

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| BATCH-01 | 20 op 上限——超限整批拒绝 INVALID_ARGS | unit | `npm test -- --run src/agent/tools/write/batch.test.ts` | ❌ W0 | ⬜ pending |
| BATCH-01 | D-05 校验：拒绝 read 工具 / 嵌套 batch_write / 非本宿主工具 | unit | `npm test -- --run src/agent/tools/write/batch.test.ts` | ❌ W0 | ⬜ pending |
| BATCH-01 | 单闭包单 sync（Excel：phase1 预校验 + phase2 写 = O(1) 2 次 sync，非 N 次） | integration（真 adapter + mock Office） | `npm test -- --run src/adapters/ExcelAdapter.batch.test.ts` | ❌ W0 | ⬜ pending |
| BATCH-01 | fail-fast 部分完成：第 i 个 op 非法时 ops[0..i-1] 保留、i+ 不执行 | integration | `npm test -- --run src/adapters/ExcelAdapter.batch.test.ts` | ❌ W0 | ⬜ pending |
| BATCH-02 | batch entry 1 条记录入 OperationLog（含 subOps + postState.kind='batch'） | unit | `npm test -- --run src/agent/operationLog.test.ts` | ✅（加 batch case） | ⬜ pending |
| BATCH-02 | batch_reverse 逆序执行所有 subOp（A3→A2→A1）→ 全部 rolled_back | integration（D-11/D-17 硬卡，真 adapter 非 mock） | `npm test -- --run src/agent/operationLog.integration.test.ts` | ✅（加 batch case） | ⬜ pending |
| BATCH-02 | batch_reverse 各 subOp reverse.args 是 Record 对象被正确消费（非位置参） | integration | `npm test -- --run src/agent/operationLog.integration.test.ts` | ✅（加 batch case） | ⬜ pending |
| BATCH-02 | batch_reverse per-subOp 手改防御（D-11）：手改 subOp 跳过、其余照撤 | integration | `npm test -- --run src/agent/operationLog.integration.test.ts` | ✅（加 batch case） | ⬜ pending |
| BATCH-02 | DiffLogPanel batch 卡头「批量改动 N 处」+ 展开列 subOp humanLabel | unit（React render） | `npm test -- --run src/components/DiffLogPanel.test.tsx` | ❌ W0 | ⬜ pending |
| BATCH-01/02 | 合约表完整（batch_write 行 + integrationTest CI 守门 + UndoType 含 'batch'） | unit（contract.test.ts 自动） | `npm test -- --run src/agent/contract.test.ts` | ✅（加 batch 行） | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/agent/tools/write/batch.test.ts` — BATCH-01 校验逻辑（20 cap、D-05 校验、INVALID_ARGS 返回格式）
- [ ] `src/adapters/ExcelAdapter.batch.test.ts` — BATCH-01 单闭包 sync 计数（断言 2 次 sync 非 N 次）+ fail-fast 部分完成
- [ ] `src/components/DiffLogPanel.test.tsx` — BATCH-02 batch 卡 humanLabel + subOps 列表渲染（若已有则追加 case）
- [ ] `src/agent/operationLog.integration.test.ts` — 追加 batch_reverse 逆序守门 case（文件已存在）
- [ ] `src/agent/contract.test.ts` — 追加 batch_write 行 + 扩展 UndoType 含 `'batch'`（文件已存在）

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UAT-1：batch_write 格式化 10 个区域 → Office 只触发单次 context.sync（Excel：≤2 次，预校验+写） | BATCH-01 / SC#1 | 真机 Office for Web 才有真实 Office.js host + sync 行为；vitest mock 只能断言 sync 调用计数，不能证明真机生效 | Office for Web（Chrome + Edge）sideload → agent 对话「给 A1:E20 加数字格式 + 排序 + 高亮前 5」→ DevTools Network 观察 host XHR 次数 = O(1)；DiffLogPanel 显示「批量改动 N 处」（非 N 张卡） |
| UAT-2：对「批量改动 N 处」一键 undo → 全部还原 | BATCH-02 / SC#3 | 真机文档状态还原需真 Office host | 点 batch 卡「撤销该步」（或「撤销本次所有」）→ 全部 N 处改动还原到批前状态 |
| UAT-3：批内第 i 步失败 → 前 i-1 步保留、i+ 不执行、报告失败位置 | BATCH-01 / SC#2 | 真机失败语义（非法 range 在 sync 抛）需真 host | 构造批内第 5 步非法（如非法 range 地址）→ 前 4 步保留 + 第 5 步报告失败 + 第 6-10 步不执行（不静默续写） |
| UAT-4：DiffLogPanel 批量卡展开显示每个 subOp humanLabel | BATCH-02 / SC#4 | 真机渲染 + 交互 | 展开「批量改动 N 处」卡 → 逐行显示每个 subOp 的 humanLabel |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (batch.test.ts / ExcelAdapter.batch.test.ts / DiffLogPanel.test.tsx)
- [ ] No watch-mode flags（全用 `--run`）
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter（实现后由 executor/verifier 置位）

**Approval:** pending
