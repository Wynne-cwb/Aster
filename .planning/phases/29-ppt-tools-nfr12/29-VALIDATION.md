---
phase: 29
slug: ppt-tools-nfr12
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-06
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> 来源：29-RESEARCH.md §Validation Architecture（Vitest 基建已就绪，仅追加用例，无框架安装）。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest（`vitest.config.ts` 已存在） |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run src/agent/contract.test.ts src/agent/operationLog.integration.test.ts` |
| **Full suite command** | `npm test -- --run`（脚本 = `tsc --noEmit && vitest run`，先类型检查再跑） |
| **Estimated runtime** | ~30-60 秒（全套） |

⚠️ memory `i18n_extract_and_test_noise`：「N failed」才是真失败；尾部 3 个 retry errors 是噪音，不算红。

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run src/agent/contract.test.ts src/agent/operationLog.integration.test.ts`
- **After every plan wave:** Run `npm test -- --run`（全套绿）
- **Before `/gsd-verify-work`:** 全套绿 + `npm run build && npm run size`（≤100KB gzip）+ 真机 UAT（U-1~U-5）
- **Max feedback latency:** 60 秒

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 29-W0 | 00 | 0 | 合约 | — | CONTRACT 加 3 行 + PhaseNum 加 29 + D-17 toolName 字面量 | unit/type | `npm test -- --run src/agent/contract.test.ts` | ✅ 加行/改类型 | ⬜ pending |
| 29-W0 | 00 | 0 | PPT-09/10/11 | — | integration 守门桩（每工具 ≥1 正向 rolled_back + 降级断言） | integration | `npm test -- --run src/agent/operationLog.integration.test.ts` | ❌ Wave 0 新建 | ⬜ pending |
| 29-T09 | — | 1 | PPT-09 | T-29-V5 | insert_ppt_table 原生 addTable → 写后回读 shape count；门控/回读失败 → notEffectiveResult 诚实失败（网格模拟 D-29-01 = 真机证伪原生后的 follow-up，本 phase 不实现——前提「web 不支持原生建表」已被 RESEARCH 文档级推翻，触发条件不成立）；undo=delete_shape_by_id | integration | `npm test -- --run src/agent/operationLog.integration.test.ts` | ❌ Wave 0 新建 | ⬜ pending |
| 29-T10 | — | 1 | PPT-10 | T-29-V5 | add_line(addLine 1.4) → 写后回读 count；箭头无 API → 诚实告知；不支持→诚实拒绝（D-29-03）；undo=delete_shape_by_id | integration | 同上 | ❌ Wave 0 新建 | ⬜ pending |
| 29-T11 | — | 2 | PPT-11 | T-29-V5 | set_shape_gradient 降级纯色 setSolidColor + 告知文案含「纯色代替」（D-29-02 诚实降级）；写前读 before-image fill；undo=restore_shape_property（读不回→noop+gate） | integration | 同上 | ❌ Wave 0 新建 | ⬜ pending |
| 29-NFR | — | 2 | NFR-12 | — | 全里程碑 build 后 main-*.js gzip ≤100KB；先 build 再 size | manual/CI | `npm run build && npm run size` | ✅ .size-limit.json 已配 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/agent/contract.test.ts` — CONTRACT 数组加 3 行（`phase: 29`）；扩 `PhaseNum` 联合类型加 `29`；长度断言（当前 `≥24`，实际数组 31 行 → 加 3 = 34；plan 决定是否上调到 `≥34` 收紧守门）
- [ ] `src/agent/operationLog.ts` — `PostStateSnapshot.kind` union 加 3 个（建议 `ppt_table`/`ppt_line`/`ppt_shape_gradient`）；`readTargetState` 对新 kind 保守返 `undefined`（D-29-05/06，不盲加 read 比对）；`executeReverse` 大概率 **0 新 case**（复用 `delete_shape_by_id` / `restore_shape_property`）
- [ ] `src/agent/operationLog.integration.test.ts` — 追加 3-5 个守门用例（每工具 ≥1 正向 `rolled_back` 断言 + 降级路径断言）；mockPpt 扩 `addTable`/`addLine` mock（参照现有 mockPpt）；**3 个新 toolName 字面量须出现在本文件**满足 D-17 fs.readFileSync 硬卡
- [ ] `src/agent/tools/index.ts` — `PPT_TOOLS` Set 加 3 个新工具名（否则 camel/snake 静默丢参 no-op）

*框架已就绪：Vitest + contract.test + integration.test 基建完整，仅需追加用例，无框架安装。*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 三工具真机 web 写操作真生效（addTable/addLine 写后回读 count 增加；setSolidColor 回读 fill.type） | PPT-09/10/11 | Claude 跑不了真机 Office for Web（memory `feedback_self_run_spikes`）；网页版可能静默 no-op，单元测试用 mock 宿主无法证伪真机生效 | UAT U-1~U-4（真机 PowerPoint for Web）：插 3×4 表格 / 两形状间加箭头线 / 标题设渐变背景 → 验生效 + undo 还原；箭头无 API → 验诚实告知；渐变 → 验降级纯色 + 告知文案 |
| main bundle gzip ≤100KB（全里程碑累积） | NFR-12 | size-limit 需真实 build 产物（陈旧 dist 假绿，memory `project_bundle_size_guard`） | `npm run build && npm run size` → 看 `main-*.js` gzip 实测值（基线 82.47KB / gate 100KB / 余 ~17.5KB） |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references（contract.test + integration.test 守门桩）
- [ ] No watch-mode flags（用 `--run`）
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter（plan-checker 确认后置位）

**Approval:** pending
