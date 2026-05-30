---
phase: 6
slug: write-tools-killer-scenarios
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-30
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 06-RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already configured) |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15-30 seconds (unit suite) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite green + `npm run build && npm run size` (initial main-*.js ≤ 82KB gzip)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

> Task IDs (`6-NN-MM`) are assigned by the planner; the rows below map each phase requirement / locked decision to its automated guard. Executors attach the matching `<automated>` verify per task.

| Requirement / Decision | Behavior | Test Type | Automated Command | File Exists | Status |
|------------------------|----------|-----------|-------------------|-------------|--------|
| TOOL-03 (insert_chart) | insertChart returns stable chartName; reverse = delete chart by name (`getItemOrNullObject(name).delete()`) | unit | `npm test -- --run src/agent/tools/write/excel.test.ts` | ❌ W0 | ⬜ pending |
| TOOL-03 (apply_formula/set_cell) | before-image overwrite reverse (same paradigm as set_range_values) | unit | `npm test -- --run src/agent/tools/write/excel.test.ts` | ❌ W0 | ⬜ pending |
| TOOL-03 (set_shape_property/move_shape) | before-image capture (old fill/line/size/left/top) + write + reverse descriptor shape correct | unit | `npm test -- --run src/agent/tools/write/ppt.test.ts` | ❌ W0 | ⬜ pending |
| TOOL-03 (insert/replace_paragraph, insert_text_at_cursor, replace_selection) | before-image text overwrite, precise-locate by content fingerprint; optional expected_state mismatch → error | unit | `npm test -- --run src/agent/tools/write/word.test.ts` | ❌ W0 | ⬜ pending |
| TOOL-03 + ONB-02 (humanLabel/reverse) | every new write tool passes `assertWriteToolRegisterable` (Chinese humanLabel + reverse mandatory) | unit | `npm test -- --run src/agent/tools/index.types.test.ts` | ✅ existing | ⬜ pending |
| inverse signature (project landmine) | new inverse adapter methods accept `Record<string,unknown>` (NOT positional); replay calls succeed | integration | `npm test -- --run src/agent/operationLog.integration.test.ts` | ✅ existing (extend cases) | ⬜ pending |
| ONB-03 (chips) | host='ppt' → PPT chips; host='excel' → Excel chips; host='word' → Word chips; unknown host → no chips; click fills InputBar (no auto-send) | unit | `npm test -- --run src/components/ChatStream.test.tsx` | ❌ W0 | ⬜ pending |
| D-18 (single-step onboarding) | Step1 complete → calls onComplete + writes ONBOARDING_SEEN; Step2Guide deleted, no references remain | unit | `npm test -- --run src/components/Onboarding/OnboardingModal.test.tsx` | ❌ W0 | ⬜ pending |
| System prompt rewrite (D-06/07/08) | buildSystemPrompt(host) returns shared base + correct per-host domain segment; no tech-architecture leakage; date injected | unit | `npm test -- --run src/agent/system-prompt.test.ts` | ❌ W0 (extend if exists) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/agent/tools/write/excel.test.ts` — insert_chart / apply_formula / set_cell inverse
- [ ] `src/agent/tools/write/ppt.test.ts` — set_shape_property / move_shape before-image + inverse
- [ ] `src/agent/tools/write/word.test.ts` — insert_paragraph / replace_paragraph / insert_text_at_cursor / replace_selection inverse + expected_state mismatch
- [ ] `src/components/ChatStream.test.tsx` — host-specific chips render + fill-on-click
- [ ] `src/components/Onboarding/OnboardingModal.test.tsx` — single-step flow + ONBOARDING_SEEN write
- [ ] `src/agent/system-prompt.test.ts` — shared + per-host segment assembly (create or extend)

Existing guards (no Wave 0 work needed, extend cases only):
- `src/agent/tools/index.types.test.ts` — humanLabel/reverse TS enforcement (Phase 3/5)
- `src/agent/operationLog.integration.test.ts` — inverse signature guard (Phase 5; add new-tool cases)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 4 killer scenarios run end-to-end on real Office hosts | TOOL-03 / SC1-4 | Office.js write paths (charts.add, shape fill/line, paragraph replace) cannot be exercised in Vitest — need real PPT/Excel/Word for Web | D-12 three-host smoke UAT checkpoint: run each ROADMAP demo prompt; verify new write tools write correctly + Phase 5 undo/diff-log still works under new destructive writes |
| Ribbon → 1 button「打开 Aster」sideload | ONB-03 / D-17 | manifest.xml change requires real sideload to validate across 3 hosts | Re-sideload manifest on PPT/Excel/Word for Web; confirm single button opens Task Pane |
| Single-step onboarding → main transition (D-21 bug check) | D-18/D-21 | UI transition + RoamingSettings/localStorage interplay on real host | After Step1 complete, confirm clean entry to main chat (no stuck modal) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (excel/ppt/word write tests + chips + onboarding tests)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter (Plan 06-08 Task 3 确认所有任务有 automated verify)

**Approval:** pending
