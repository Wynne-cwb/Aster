---
phase: 28
slug: excel-tools
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-06
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 28 = 3 个 Excel write 工具（merge_cells / remove_duplicates / create_pivot_table）的合约补全 + undo 接线。验证三件事：**正向生效 + undo 忠实还原 + 降级诚实**。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest（既有；`src/agent/contract.test.ts` + `src/agent/operationLog.integration.test.ts`） |
| **Config file** | `vitest.config.ts`（既有，无需 Wave 0 安装） |
| **Quick run command** | `npm test -- contract.test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30–60 秒 |
| **Bundle gate** | `npm run build && npm run size`（先 build 再 size，禁止测陈旧 dist；gate = initial main-*.js ≤100KB gzip） |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- contract.test`（结构守门快路径）
- **After every plan wave:** Run `npm test`（含 operationLog.integration.test 真 adapter 守门）
- **Before `/gsd-verify-work`:** 全套 `npm test` 绿 + `npm run build && npm run size` ≤100KB
- **Max feedback latency:** ~60 秒

---

## Per-Task Verification Map

> 逐任务映射由 planner 在 PLAN.md 任务 acceptance_criteria 落地；执行期回填本表。

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 28-W0 | 守门桩 | 0 | EXCEL-11/12/13 | — | CONTRACT 3 行 + contract.test 3 行先红 | unit | `npm test -- contract.test` | ✅ | ⬜ pending |
| 28-W1-merge | merge_cells | 1 | EXCEL-11 | — | merge 丢值快照式还原；超限 noop+gate 不中断 | integration | `npm test -- operationLog.integration` | ✅ | ⬜ pending |
| 28-W1-dedup | remove_duplicates | 1 | EXCEL-12 | — | 删重可撤销（快照还原）；超限 noop+gate | integration | `npm test -- operationLog.integration` | ✅ | ⬜ pending |
| 28-W2-pivot | create_pivot_table | 2 | EXCEL-13 | — | 建表+删表可逆；isSetSupported+try/catch 降级诚实 | integration | `npm test -- operationLog.integration` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/agent/contract.test.ts` — 新增 3 个工具的 CONTRACT 常量行（先红：CONTRACT.md 未补行时断言失败）
- [ ] `src/agent/operationLog.integration.test.ts` — 3 个新 toolName 字面量出现（D-17 fs.readFileSync 硬卡）+ 守门用例桩
- [ ] 框架已存在（Vitest），无需安装

*既有测试基建（contract.test.ts + operationLog.integration.test.ts）覆盖全部 phase 守门需求。*

---

## Manual-Only Verifications

> 真机 Office for Web Excel UAT —— 自动化测试用 mock/真 adapter 单元层守门，但「网页版写操作实际生效 + undo 真机忠实 + 降级诚实」需真机确认（memory `feedback_self_run_spikes`：真机必须的列 UAT）。

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 合并 A1:C1 → undo 后 B1/C1 原值恢复 | EXCEL-11 | 网页版写操作静默 no-op 风险需真机验；快照式还原忠实度 | 见 28-CONTEXT.md §UAT 种子 1–3 |
| 删 A1:D100 重复行 → undo 全行（含重复）恢复；>10k 单元格超限降级 | EXCEL-12 | removeDuplicates 物理删除 + 快照还原需真机验 | 见 28-CONTEXT.md §UAT 种子 4–6 |
| 用 A1:D50 建透视表到 F1（行=地区/值=销售额）→ undo 删表 | EXCEL-13 | pivot 字段配置 Web 真机表现（research MEDIUM 置信）+ 降级诚实 | 见 28-CONTEXT.md §UAT 种子 7–8 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
