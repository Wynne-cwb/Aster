---
phase: "08"
plan: "02"
subsystem: agent-system-prompt
tags: [tdd, wave-1, prompt-quality, contract, undo-classification, pref-injection]
dependency_graph:
  requires:
    - 08-01 (Wave 0 RED tests — system-prompt.test.ts PROMPT-01/PREF-01 RED stubs)
  provides:
    - src/agent/system-prompt.ts (三宿主深化 domain segment + buildSystemPrompt opts 签名)
    - .planning/phases/08-foundation-a-f/CONTRACT.md (Phase 9/10/11 工具能力合约表)
  affects:
    - Phase 8 Plan 03 (buildSystemPrompt opts.userPrefs 接线，PREF-01 完整实现)
    - Phase 9/10/11 (CONTRACT.md 每行工具实现时更新 status + integrationTest)
tech_stack:
  added: []
  patterns:
    - "buildPrefBlock 偏好包裹块（opts 可选参数，向后兼容）"
    - "getDomainSegment 深化：断言式标题 + 宪法式自查 + 公式优先 + 润色边界（商业可用成品水准）"
    - "CONTRACT.md 人读合约表 + contract.test.ts CI 守门双保险（D-16/D-17）"
key_files:
  created:
    - .planning/phases/08-foundation-a-f/CONTRACT.md
  modified:
    - src/agent/system-prompt.ts
    - src/agent/system-prompt.test.ts
decisions:
  - "PPT domain segment 从 6 条扩展为 9 条：断言式结论句标题 + 金字塔故事线 + 版式意识(list_shapes_on_slide) + 宪法式自查(没自查不许说做完了) + 诚实配图边界"
  - "Excel domain segment 追加公式优先原则（能用公式就不填死值）+ 成品格式化提示（让成品有可交付质感）"
  - "Word domain segment 扩展为 7 条：显式润色边界(保留原意只改语言/不增删论点/不改数字) + 宪法式自查"
  - "移除 @ts-expect-error 指令：Plan 02 签名扩展后两条 ts-expect-error 已失效，自动清除（Rule 1）"
  - "更新 Phase 6 测试断言：set_shape_property → set_shape_text + list_shapes_on_slide（Phase 8 深化工具名调整）"
metrics:
  duration: "~5m"
  completed_date: "2026-05-30"
  tasks_completed: 2
  files_changed: 3
---

# Phase 8 Plan 02: 能力合约 + system-prompt 深化 Summary

## One-liner

三宿主 domain segment 深化至商业可用成品水准（PPT 断言式标题/宪法式自查/故事线 + Excel 公式优先/成品格式化 + Word 润色边界/自查）+ buildSystemPrompt 签名扩展 opts + CONTRACT.md 23 条 Phase 9/10 工具能力合约表（undo 三分类全覆盖）。

## Completed Tasks

| # | Name | Commit | Files | Status |
|---|------|--------|-------|--------|
| 1 | system-prompt.ts 三宿主深化 + opts 签名扩展 | `7eb7289` | src/agent/system-prompt.ts, src/agent/system-prompt.test.ts | 4 RED→GREEN + 16 GREEN = 20/20 |
| 2 | 产出 CONTRACT.md 能力合约表 | `cb89464` | .planning/phases/08-foundation-a-f/CONTRACT.md | contract.test.ts 9/9 GREEN |

## Test Suite Status

```
system-prompt.test.ts:  20 tests PASSED (4 RED→GREEN)
contract.test.ts:        9 tests PASSED (全绿，含 CONTRACT.length ≥ 23 守门)
npm run build:          PASSED (gzip 73.54 KB，< 82 KB 守门)
```

**RED→GREEN 明细：**

| 测试 | 文件 | 状态 |
|------|------|------|
| host=ppt 含断言式标题指导关键词 | system-prompt.test.ts | RED→GREEN |
| host=ppt 含 verify-after-create 自查关键词 | system-prompt.test.ts | RED→GREEN |
| host=excel 含公式优先指导关键词 | system-prompt.test.ts | RED→GREEN |
| host=word 含润色边界指导关键词 | system-prompt.test.ts | RED→GREEN |
| 传入合法偏好时 prompt 含包裹块 | system-prompt.test.ts | RED→GREEN |
| 偏好块在 domain segment 之后（位置约束） | system-prompt.test.ts | RED→GREEN |

注：PREF-01 偏好注入 2 个测试（传入偏好/位置约束）在 Plan 01 SUMMARY 列为 Plan 02 GREEN 目标，此处已实现。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 移除已失效的 @ts-expect-error 指令**

- **Found during:** Task 1
- **Issue:** buildSystemPrompt 签名扩展后（加了 opts 可选参数），原来用于压制 TS2554 arg-count 错误的 `// @ts-expect-error` 指令变成"未使用的 @ts-expect-error 指令"（TS2578），导致 tsc --noEmit 报错，测试无法运行。
- **Fix:** 移除两条 @ts-expect-error 指令，调用改为正常类型安全调用。
- **Files modified:** src/agent/system-prompt.test.ts
- **Commit:** 7eb7289（含在 Task 1 commit 中）

**2. [Rule 1 - Bug] 更新 Phase 6 过时测试断言（set_shape_property）**

- **Found during:** Task 1 测试验证阶段
- **Issue:** Phase 6 遗留测试 `expect(prompt).toContain('set_shape_property')` — Phase 8 深化 PPT segment 已将 set_shape_property 替换为更语义明确的 set_shape_text（写文字专用）和 list_shapes_on_slide（版式检查），旧断言失败。
- **Fix:** 更新测试断言为 `set_shape_text` + `list_shapes_on_slide`，并更新测试描述以反映 Phase 8 深化内容。
- **Files modified:** src/agent/system-prompt.test.ts
- **Commit:** 7eb7289（含在 Task 1 commit 中）

## CONTRACT.md 合约表摘要

| 分类 | 工具数 | noop+gate | 快照式 | 简单逆向 |
|------|--------|-----------|--------|---------|
| Phase 9 Word | 5 | 0 | 1 (find_and_replace) | 4 |
| Phase 10 Excel | 10 | 0 | 3 (sort_range / excel_find_and_replace / manage_worksheet) | 7 |
| Phase 10 PPT | 8 | 2 (delete_shape / manage_slides) | 0 | 6 |
| **合计** | **23** | **2** | **4** | **17** |

v2.2 Defer 清单（D-19 锁定）：merge_cells / create_pivot_table / remove_duplicates / delete_worksheet

## Known Stubs

CONTRACT.md 内所有工具均为 `status: planned`，`integration_test: false`——这是预期状态（Phase 8 只定义合约，Phase 9/10/11 实现时逐行更新）。不是功能缺陷。

## Threat Flags

无新增安全面（CONTRACT.md 是 .planning/ 开发文档，不进生产 bundle；buildPrefBlock 内容由调用方 loop.ts 从已 sanitize 的 preferences store 读取，Plan 03 接线时落地 T-08-02-01 缓解措施）。

## Self-Check

| Item | Status |
|------|--------|
| src/agent/system-prompt.ts | FOUND |
| .planning/phases/08-foundation-a-f/CONTRACT.md | FOUND |
| system-prompt.test.ts 20/20 GREEN | PASSED |
| contract.test.ts 9/9 GREEN | PASSED |
| npm run build | PASSED |
| commit 7eb7289 | FOUND |
| commit cb89464 | FOUND |

## Self-Check: PASSED
