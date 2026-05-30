---
phase: 10
slug: excel-ppt-b-excel-b-ppt
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 10-RESEARCH.md §"Validation Architecture". Undo 守门是数据安全硬门（D-17/D-19，不软化）。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` / `vite.config.ts`（现有，无需 Wave 0 安装） |
| **Quick run command** | `npm test -- src/agent/contract.test.ts src/agent/operationLog.integration.test.ts` |
| **Full suite command** | `npm test` |
| **Bundle gate** | `npm run build && npm run size`（NFR-06 ≤82 KB gzip；动 bundle 前先 build 再 size，陈旧 dist 给假绿） |
| **Estimated runtime** | ~30–60 秒（单元 + integration），build+size ~30 秒 |

---

## Sampling Rate

- **After every task commit:** Run quick command（contract + integration 守门）
- **After every plan wave:** Run full suite `npm test`
- **After any adapter/tool/bundle change:** `npm run build && npm run size`（bundle ≤82 KB）
- **Before `/gsd-verify-work`:** Full suite green + bundle green
- **Max feedback latency:** ~60 秒

---

## Validation Architecture（18 工具 undo 守门，按 undo 三分类）

> 每个新 inverse 必须配 `operationLog.integration.test.ts` 守门，**用真 `ExcelAdapter`/`PptAdapter` 实例（非 mock）**——mock 抓不到 Record 签名错配（memory project_adapter_inverse_signature；Phase 5 翻车点）。reverse 名逐字对齐 `contract.test.ts` 第 41-59 行。

| undo 类型 | 工具 | 验证模式（自动） |
|-----------|------|------------------|
| 简单逆向 | format_excel_range / set_column_row_size / set_auto_filter / add_conditional_format / create_table / freeze_panes / set_chart_title / set_shape_text_font / add_shape / copy_slide | 真 adapter 写入 → `replayUndoSingle` → `status==='rolled_back'` 且 inverse 收到 Record 对象；before-image 还原后状态 == 写前 |
| 简单逆向（spike 门控） | set_shape_text_alignment (S4) / rotate_shape (S1) / set_slide_background (S2) | happy-path：isSetSupported=true + 可读 → 真 adapter 简单逆向 → rolled_back（integration.test 验此路径）；运行时不支持 → noop+gate 降级（真机 UAT 验 spike 结论） |
| 快照式 | sort_range / excel_find_and_replace | 写前 `readRangeValuesSnapshot` 存 2D values → restore 往返：snapshot 还原后 `range.values` == 写前；共享 reverse `restore_range_values_snapshot`，**两工具各一条 integration.test 用例**（D-20，toolName 字符串都要出现在文件内满足 D-17 fs.readFileSync）；超限（>10,000 单元格）→ noop+gate |
| 快照式（元数据） | manage_worksheet（add\|rename only） | add → snapshot「表先前不存在」→ inverse 删表；rename → snapshot 旧名 → inverse 改回；真 adapter 往返验 rolled_back |
| noop+gate | delete_shape / manage_slides(delete) / 超限降级 | `executeReverse({tool:'noop_inverse'})` → throw → `status==='skipped_error'`（非 rolled_back）；DiffLog 显示「此步无法自动撤销」；agent 不中断 |

**D-17 四步守门（每工具 acceptance_criteria 必含，缺一 CI 挂）：**
1. `src/agent/contract.test.ts` 对应行 `integrationTest: false→true`；
2. `src/agent/operationLog.integration.test.ts` 追加真 adapter 守门用例（toolName 字符串出现在文件内）；
3. `.planning/phases/08-foundation-a-f/CONTRACT.md` 对应行 `status: planned→done` + `integration_test: false→true`；
4. noop+gate 三类验「→ skipped_error」路径。

---

## Per-Task Verification Map

> Task ID 由 planner 产出后填充；此处给验证类型映射（按 wave）。所有 18 工具的 undo 守门都有自动 integration.test 覆盖；spike 工具的 spike verdict 为 manual（真机 UAT）。

| Wave | Requirement | Test Type | Automated Command | Status |
|------|-------------|-----------|-------------------|--------|
| 0 | undo 基础设施（operationLog 接口/case/kind 扩展 + 测试桩） | unit | `npm test -- src/agent/operationLog.test.ts src/agent/contract.test.ts` | ⬜ pending |
| 1 | EXCEL-01/02/04/06/07/08/10（简单逆向 7 工具） | unit + integration | quick command | ⬜ pending |
| 2 | EXCEL-03/05/09（快照式 sort/find-replace + manage_worksheet） | unit + integration | quick command | ⬜ pending |
| 3 | PPT-01/03/07（简单逆向 font/add_shape/copy_slide） | unit + integration | quick command | ⬜ pending |
| 4 | PPT-02/05/08（spike 门控）+ PPT-04/06（noop+gate） | unit + integration（happy-path/skipped_error） | quick command | ⬜ pending |
| all | NFR-06 bundle ≤82 KB | manual/CI | `npm run build && npm run size` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/agent/operationLog.ts` — `DocumentAdapterForReplay` 接口加 15 方法声明 + `executeReverse` 15 case + `PostStateSnapshot.kind` 扩展（保守 undefined readTargetState）
- [ ] `src/agent/operationLog.integration.test.ts` — 18 工具守门用例骨架（先红：adapter 方法未实现 → 测试失败）
- [ ] `src/agent/contract.test.ts` — 现有，无需新建（实现时逐行翻 integrationTest）

*现有 vitest 基础设施覆盖全部 Phase 10 测试需求，无需新框架安装。*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Spike S1 `shape.rotation` 可写 | PPT-05 | 需真机 Office for Web（Claude 无法自跑 spike） | 真机：rotate_shape 旋转形状 45° → undo → 角度还原；不支持则 DiffLog 标 noop+gate |
| Spike S2 `slide.background.fill` 可读 | PPT-08 | 需真机 PPT API 1.10 on Web | 真机：set_slide_background 改背景色 → undo → 背景还原；读不到则 noop+gate |
| Spike S4 `textRange.paragraphFormat.alignment` 可读写 | PPT-02 | 需真机 Office for Web | 真机：set_shape_text_alignment 改对齐 → undo → 还原；不支持则 noop+gate |
| Spike S7 addTextBox deselect 绕 #2775 | PPT-03 | 需真机 Web PPT | 真机：选中形状后 add_shape(textbox) → 原形状未被静默删除（count 校验） |
| 各工具真机 undo 还原 | EXCEL-01..10 / PPT-01..08 | 真机 Office host 行为 | 三宿主 Office for Web（Chrome/Edge）UAT：每工具写入 → undo → 状态还原 / noop+gate warn 正确 |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers operationLog 接口扩展 + 18 守门骨架
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter（planner/checker 通过后）

**Approval:** pending
</content>
