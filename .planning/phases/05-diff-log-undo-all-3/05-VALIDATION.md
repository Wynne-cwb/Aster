---
phase: 5
slug: diff-log-undo-all-3
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts / vitest config (existing) |
| **Quick run command** | `npx vitest run <changed-file>` |
| **Full suite command** | `npm test` |
| **Bundle gate** | `npm run build && npm run size` (size-limit ≤82KB gzip — MUST build first, stale dist gives false green) |
| **Estimated runtime** | ~20-40 seconds (unit) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` on the changed module
- **After every plan wave:** Run `npm test` (full suite)
- **Before bundle-affecting commit:** `npm run build && npm run size`
- **Before `/gsd-verify-work`:** Full suite green + bundle gate green
- **Max feedback latency:** ~40 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| (filled by planner) | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements (test stubs — RESEARCH §Validation Architecture)

- [ ] `src/agent/operationLog.test.ts` — Map<runId> replay / 逆序 / per-step undo / postState 比对（纯函数，AGENT-10）
- [ ] `src/agent/copyStepLog.test.ts` — 三角色 dump + 脱敏 Key/Provider id（CARRY-03）
- [ ] `src/lib/storage.test.ts` — setItem try/catch + 超配额抛 AsterError（NFR-05 / quota guard）
- [ ] 扩展 `src/agent/tools/write/word.test.ts` — reverse.tool 改新精确定位 tool 名 + humanLabel
- [ ] 扩展 WordAdapter/ExcelAdapter/PptAdapter inverse 方法单测（纯数据进出，A-06）
- [ ] humanLabel + reverse 缺失 → 编译/lint 失败的负向断言（index.types.test.ts 扩展，D-15）

*Existing vitest infra covers framework; new files above are stubs to add in Wave 0.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 三宿主单步 inverse 闭环真机录像 | TOOL-03/04 SC1 | Office.js 真机行为只能在 Office for Web sideload 验证 | Word append→撤 / PPT insert_slide→撤 / Excel set_range_values→撤，各录屏 |
| DiffLogPanel 汇总卡 + per-step + undo all 真机 | AGENT-07/09 SC2 | 渲染 + 交互需真机 Task Pane | run agent → 展开汇总卡 → 撤某步 → undo all |
| Undo all + 手动改防御真机 | AGENT-10/11 SC3 | 需真机手改文档触发 before-image 比对 | 写 5 处→手改 1→undo all→验回 4 跳 1 + 总结弹窗 |
| copy step log 真机脱敏 | CARRY-03 SC6 | 剪贴板 + 真机会话 | 跑 agent→copy→粘贴核验三角色 + 无 Key |

*真机 UAT = office-addin-browser-uat skill recipe；这些是 Phase 5 的 checkpoint 门（autonomous:false）。*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 40s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
