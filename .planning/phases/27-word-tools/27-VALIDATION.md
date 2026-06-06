---
phase: 27
slug: word-tools
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-06
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npx vitest run src/agent/operationLog.integration.test.ts src/agent/contract.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30–60 seconds |
| **Bundle gate** | `npm run build && npm run size` (size-limit, main-*.js ≤100 KB gzip) |

---

## Sampling Rate

- **After every task commit:** Run quick run command (contract + integration守门)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green AND `npm run build && npm run size` passes (≤100KB gzip)
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Filled per-task by planner/executor. Each new Word write tool MUST have an
> `operationLog.integration.test` undo round-trip case (real WordAdapter + mockWordRich →
> replayUndoSingle → assert `rolled_back` / for noop+gate tools assert honest `noop_inverse`).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner) | | | WORD-06 | — | before-image highlightColor round-trip restore | integration | `npx vitest run src/agent/operationLog.integration.test.ts` | ❌ W0 | ⬜ pending |
| (filled by planner) | | | WORD-07 | — | noop+gate: DiffLog 显示「无法自动撤销」(honest) | integration | `npx vitest run src/agent/operationLog.integration.test.ts` | ❌ W0 | ⬜ pending |
| (filled by planner) | | | WORD-08 | — | delete-by-comment-id round-trip restore | integration | `npx vitest run src/agent/operationLog.integration.test.ts` | ❌ W0 | ⬜ pending |
| (filled by planner) | | | WORD-09 | — | before-image header/footer text round-trip restore | integration | `npx vitest run src/agent/operationLog.integration.test.ts` | ❌ W0 | ⬜ pending |
| (filled by planner) | | | WORD-10 | — | before-image cell text round-trip restore | integration | `npx vitest run src/agent/operationLog.integration.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No new framework install — vitest infrastructure already exists (Phase 9 Word tools tested here).
- [ ] `src/agent/operationLog.integration.test.ts` — extend `mockWordRich` fixture for the 5 new tools' read/write/inverse surface.

*Existing infrastructure covers all phase requirements — no Wave 0 framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 高亮在真机出现并 undo 消失 | WORD-06 | Office for Web host API 真机行为不可单测 | UAT 种子 1（27-CONTEXT.md） |
| 列表转换 + noop+gate undo 老实显示「无法自动撤销」 | WORD-07 | Word Online lists.getById 行为需真机 | UAT 种子 2 |
| 批注插入带 `[Aster] ` 标记、author=当前账号、undo 删除 | WORD-08 | insertComment 真机署名 + display bug 需真机 | UAT 种子 3 |
| 页眉/页脚文字变更 + undo（空/已有两态） | WORD-09 | header/footer setText 网页版 no-op 风险需真机 | UAT 种子 4 |
| 多表文档按行列定位正确表 + undo | WORD-10 | 表格定位真机行为 | UAT 种子 5 |

*真机 UAT 留给里程碑收尾（host API 真机不可自跑，参 memory `feedback_self_run_spikes`）；单测层覆盖 undo round-trip + 守门。*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
