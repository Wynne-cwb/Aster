---
phase: 9
slug: word-d-b-word
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 09-RESEARCH.md §Validation Architecture + §Security Domain.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest（已安装，项目统一框架）|
| **Config file** | `vitest.config.ts`（项目根）|
| **Quick run command** | `npm run test -- operationLog.integration contract` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~quick <10s / full ~按现有套件 |

---

## Sampling Rate

- **After every task commit:** `npm run test -- operationLog.integration contract`
- **After every plan wave:** `npm run test`（全套）
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 秒（quick）

---

## Per-Task Verification Map

| Requirement | Behavior | Threat Ref | Test Type | Automated Command | File Exists | Status |
|-------------|----------|------------|-----------|-------------------|-------------|--------|
| WSEL-01 | selection_detail 返回 paragraphIndex + uniqueLocalId（unsupported→null 降级）| — | unit | `npm run test -- WordAdapter.read` | ✅（追加 case）| ⬜ pending |
| WORD-01 | set_word_character_format undo → restoreRangeFont 收 Record → rolled_back | T-9 EoP | integration | `npm run test -- operationLog.integration` | ✅（追加）| ⬜ pending |
| WORD-02 | set_word_paragraph_format undo → restoreParagraphFormat 收 Record → rolled_back | T-9 EoP | integration | 同上 | ✅（追加）| ⬜ pending |
| WORD-03 | apply_paragraph_style undo → restoreParagraphStyle 收 Record → rolled_back | T-9 EoP | integration | 同上 | ✅（追加）| ⬜ pending |
| WORD-03 | 非法 styleName 在调 Word 之前被 allowlist 拒（locale-safe）| V5 Tampering | unit | `npm run test -- word` | ❌ W0（追加）| ⬜ pending |
| WORD-04 | find_and_replace undo → restoreRangeSnapshot 收 Record → rolled_back；改动数返回 | DoS（超限 noop+gate）| integration | 同上 | ✅（追加）| ⬜ pending |
| WORD-05 | insert_table undo → deleteTableByMarker 收 Record → rolled_back；定位不到 skipped_error | Tampering（删错表）| integration | 同上 | ✅（追加）| ⬜ pending |
| D-17 硬门 | contract.test.ts integrationTest:true 行 → 对应 toolName 出现在 integration.test.ts | EoP | CI | `npm run test -- contract` | ✅（已有 fs.readFileSync 硬卡）| ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/agent/operationLog.integration.test.ts` — 追加 5 条守门测试（D-17/D-18 硬门：真 WordAdapter × replayUndoSingle → rolled_back + 收 Record 对象）
- [ ] `src/adapters/WordAdapter.read.test.ts` — 追加 selection_detail 扩展单测（paragraphIndex + uniqueLocalId；mockWord 含 uniqueLocalId 字段 + unsupported→null 降级）
- [ ] `src/agent/tools/write/word.test.ts` — 追加 D-08 allowlist 拒绝测试（apply_paragraph_style 非法 styleName）+ 5 工具 reverse/postState 形状测试
- [ ] `src/agent/contract.test.ts` — 5 行 `integrationTest: false → true`（实现完成后翻转，缺 integration 守门则 D-17 硬卡挂）

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| uniqueLocalId 在 Office for Web 真机可用 + 多同名段精准定位（SC#1）| WSEL-01 / Spike S5 | Office.js 宿主行为无法单测，需真机 | `office-addin-browser-uat` skill：Word for Web sideload → 造 2 个同文本段 → 「把第二段加粗」→ 验改第二段 |
| font.bold=null / underline="Mixed" 写回语义（A1/A2）| WORD-01 | Word JS API 混合格式写回行为未文档化 | 真机：对混合格式段加粗→undo→验还原；若不彻底，inverse 改「跳过 null 属性」策略 |
| apply_paragraph_style 在非中文 Office 不 crash（SC#3）| WORD-03 | locale 行为需真机 | 真机：套用「标题 1」→ 验 styleBuiltin 路径不抛 |
| find_and_replace undo 全文还原（SC#4）| WORD-04 | 真实文档替换+撤销链 | 真机：全文「公司」→「企业」→ 改动卡显示数 → undo → 文字全还原 |
| insert_table undo 后表格消失（SC#5）| WORD-05 | 真实表格插入+逆向 | 真机：插 3×3 表 → undo → 表消失 |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references（4 个测试文件追加）
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s（quick）
- [ ] `nyquist_compliant: true` set in frontmatter（planner/executor 完成后）

**Approval:** pending
