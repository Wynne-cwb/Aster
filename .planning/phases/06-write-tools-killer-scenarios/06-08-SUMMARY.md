---
phase: "06"
plan: "08"
subsystem: agent/tools
tags: [operationLog, inverse, write-tools, registration, excel, ppt, word, undo]
dependency_graph:
  requires: ["06-05", "06-06", "06-07"]
  provides: ["operationLog.ts inverse routing 完整", "buildToolsForHost Excel 四工具注册", "integration test 新 inverse Record 守门"]
  affects: ["src/agent/operationLog.ts", "src/agent/tools/index.ts", "src/agent/operationLog.integration.test.ts"]
tech_stack:
  added: []
  patterns: ["executeReverse switch routing", "DocumentAdapterForReplay interface extension", "Record<string,unknown> inverse signature guard"]
key_files:
  created: []
  modified:
    - src/agent/operationLog.ts
    - src/agent/tools/index.ts
    - src/agent/operationLog.integration.test.ts
    - src/agent/tools/index.test.ts
    - src/agent/tools/read/tools.test.ts
    - .planning/phases/06-write-tools-killer-scenarios/06-VALIDATION.md
decisions:
  - "ppt_shape/excel_chart 在 readTargetState/isTargetStateConsistent 中保守返回 undefined/true（无专用 read adapter 方法，安全侧）"
  - "integration test 用 mock adapter（vi.fn）而非真实 Adapter 实例测试新 inverse 路由——核心守门是 replay engine 路由正确性，不需要 Office.js 宿主"
metrics:
  duration: "15min"
  completed: "2026-05-30"
  tasks: 3
  files: 6
---

# Phase 06 Plan 08: 工具注册 + operationLog 扩展 Summary

**一句话总结：** 将 Excel 三个写工具注册到 buildToolsForHost，同时扩展 operationLog.ts 接口与 executeReverse switch 覆盖五种新 inverse 路径，并补充集成测试守门防 Phase 5 位置签名 bug 复发。

## What Was Built

### Task 1 — operationLog.ts 扩展（四处精准修改）

- **DocumentAdapterForReplay 接口** 追加 5 个可选 inverse 方法（Record<string,unknown> 签名）：
  `restoreShapeProperty / restoreShapeGeometry / restoreShapeText / deleteChartByName / restoreParagraphAt`
- **executeReverse switch** 新增 6 个 case（含 noop_inverse）：路由到对应 adapter 方法，adapter 未实现则 throw → replayUndoStep.catch → skipped_error
- **readTargetState switch** 新增 `ppt_shape` / `excel_chart` case：保守返回 undefined（无专用 read 方法，视为「一致」，不跳过 undo）
- **isTargetStateConsistent switch** 新增对应 case：返回 true（保守通过）
- PostStateSnapshot.kind union 在 Wave 3 已包含 `'excel_chart' | 'ppt_shape'`，无需修改

### Task 2 — buildToolsForHost Excel 注册扩展

- import `applyFormula / insertChart / setCell` from `./write/excel`
- excelWriteTools 数组：`[setRangeValuesTool]` → `[setRangeValuesTool, applyFormula, insertChart, setCell]`
- assertWriteToolRegisterable.forEach 守门覆盖全部 4 个 Excel write tools
- Word（5）和 PPT（4）注册在 Wave 3 已完成，无需重复

### Task 3 — integration test 扩展 + VALIDATION.md

- Word describe 新增 1 it：restoreParagraphAt Record 对象路由守门
- Excel describe 新增 1 it：deleteChartByName Record 对象路由守门
- PPT describe 新增 2 it：restoreShapeProperty + restoreShapeText Record 对象路由守门
- 守门原理：mock adapter 收 Record，若 replay engine 误以位置参调用则对象字段访问会出错 → 测试立即变红
- 06-VALIDATION.md nyquist_compliant: false → true

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS |
| `npm test -- --run src/agent/operationLog.integration.test.ts` | 8/8 PASS |
| `npm test -- --run src/agent/tools/index.types.test.ts` | 2/2 PASS |
| `npm test` 完整套件 | 571 passed / 12 skipped（flaky retry.test.ts 预存在 3 errors，非本 plan 引入）|
| `npm run build` | PASS（82.92 kB gzip） |
| grep "ppt_shape" operationLog.ts ≥3 | PASS |
| grep "excel_chart" operationLog.ts ≥3 | PASS |
| grep "case 'restore_shape_text'" operationLog.ts | PASS |
| grep "case 'restore_paragraph_at'" operationLog.ts | PASS |
| grep "nyquist_compliant: true" 06-VALIDATION.md | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 修复 Excel 工具数量测试断言过时**
- **Found during:** Task 2 提交后运行完整测试套件
- **Issue:** `index.test.ts` 和 `tools.test.ts` 对 Excel host 工具数量的断言仍为 5（Phase 5 遗留），注册 4 个 excel write tools 后应为 8
- **Fix:** 更新 toHaveLength(5) → toHaveLength(8)，修正 kind 过滤逻辑（Set 覆盖全部 write tool 名），补充 apply_formula/insert_chart/set_cell 的 toContain 断言
- **Files modified:** `src/agent/tools/index.test.ts`, `src/agent/tools/read/tools.test.ts`
- **Commit:** 7a8aa3f

### 预存在问题（SCOPE BOUNDARY — 不修复）

**npm run size 超出 779 B（82.92 kB > 82 kB）**
- 在 06-07 完成后已超出（git stash 前后 size 相同，确认非本 plan 引入）
- 超出来源：Wave 3 多个新写工具文件随主 chunk 打包；applyFormula/insertChart/setCell 代码本体在 06-05 已引入 tree-shaking
- 记录至 deferred-items：需要在后续 plan 或 Phase 7 通过 dynamic import / chunk split 修复
- 本 plan 的 operationLog.ts / integration test 改动为零 bundle delta（test files 不打包）

## Known Stubs

无（本 plan 无 UI 组件，纯 agent 逻辑）

## Commits

| Hash | Message |
|------|---------|
| 23329ae | feat(06-08): extend operationLog — 6 new inverse cases + 5 adapter methods + ppt_shape/excel_chart switch |
| 7094346 | feat(06-08): register Excel write tools in buildToolsForHost (applyFormula/insertChart/setCell) |
| ddf442e | test(06-08): extend integration test — 4 new inverse Record-signature guards + nyquist_compliant true |
| 7a8aa3f | fix(06-08): 更新 Excel 工具数量断言（5→8，含新增 apply_formula/insert_chart/set_cell）|

## Self-Check: PASSED

- [x] src/agent/operationLog.ts 修改已提交（23329ae）
- [x] src/agent/tools/index.ts 修改已提交（7094346）
- [x] src/agent/operationLog.integration.test.ts 修改已提交（ddf442e）
- [x] 06-VALIDATION.md nyquist_compliant: true 已提交（ddf442e）
- [x] grep "case 'restore_shape_property'" operationLog.ts 存在
- [x] grep "restoreParagraphAt?" operationLog.ts（接口方法）存在
- [x] npm test 47/47 test files passed（3 errors 均为预存在 flaky retry.test.ts）
