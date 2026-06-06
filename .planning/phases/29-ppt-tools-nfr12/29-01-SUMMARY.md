---
phase: 29-ppt-tools-nfr12
plan: 01
subsystem: testing
tags: [operationLog, contract, integration-test, ppt, undo, replay]

requires:
  - phase: 28-excel-tools
    provides: "Phase 28 合约接线范式（CONTRACT 行 + integrationTest:true + mockExcel 工厂）；executeReverse case 'delete_shape_by_id'(L481) + 'restore_shape_property'(L375) 已实现"

provides:
  - "PostStateSnapshot.kind union 新增 ppt_table / ppt_line / ppt_shape_gradient（readTargetState 保守 default，接口/case 零改动）"
  - "CONTRACT 数组 3 条 Phase 29 行（integrationTest:true，reverseTool 全复用既有）"
  - "PhaseNum 联合类型含 29，长度断言收紧至 >= 35"
  - "integration.test.ts mockPpt 扩展：addTable/addLine vi.fn + makeShape 补 fill/lineFormat/width/height"
  - "3 个 Phase 29 守门用例（insert_ppt_table/add_line/set_shape_gradient），Wave 0 全部 rolled_back"
  - "D-17 守门通过：3 个 toolName 字面量逐字出现于 integration.test.ts"

affects:
  - "29-02-PLAN（Wave 1：insert_ppt_table + add_line ToolDef + adapter；反操作侧零接线）"
  - "29-03-PLAN（Wave 2：set_shape_gradient ToolDef + NFR-12 bundle 收口；反操作侧零接线）"

tech-stack:
  added: []
  patterns:
    - "Phase 29 种类 kind 只加 union 成员，不加 readTargetState case（保守一致，不误判手改）"
    - "Wave 0 先行：合约骨架（kind + CONTRACT + 守门）完全自洽，后续 wave 只补正向 ToolDef/adapter"
    - "三工具 undo 全复用既有反操作（delete_shape_by_id + restore_shape_property）——接口/case 零新增"

key-files:
  created: []
  modified:
    - src/agent/operationLog.ts
    - src/agent/contract.test.ts
    - src/agent/operationLog.integration.test.ts

key-decisions:
  - "Phase 29 三工具全部 integrationTest:true（Wave 0 即 rolled_back），与 Phase 28 的 skipped_error 模式不同——因为 delete_shape_by_id 和 restore_shape_property 均已完整实现"
  - "长度断言从 >= 24 收紧到 >= 35（现有 32 行 + Phase 29 三行 = 35），作为结构性守门"
  - "makeShape 统一补 fill/lineFormat/width/height，三个 mockPpt shape（shape-01/new-shape-uuid/shape-03）共用同一工厂，无需 extraProps 分叉"

patterns-established:
  - "Wave 0 骨架先行：kind union → CONTRACT 行 → integration.test 守门三步，后续 wave 仅补正向实现"

requirements-completed:
  - PPT-09
  - PPT-10
  - PPT-11

duration: 3min
completed: 2026-06-06
---

# Phase 29 Plan 01: PPT 工具补全合约骨架（Wave 0）Summary

**PostStateSnapshot.kind union 新增 ppt_table/ppt_line/ppt_shape_gradient，CONTRACT 追加 3 行（integrationTest:true），integration.test 新增 3 个 rolled_back 守门用例（全复用既有 delete_shape_by_id + restore_shape_property，Wave 0 即全绿）**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-06T08:11:58Z
- **Completed:** 2026-06-06T08:14:58Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- operationLog.ts kind union 精确插入 3 个 PPT Phase 29 kind，readTargetState/executeReverse/接口零改动，TypeScript 编译无错误
- contract.test.ts 三处对齐：PhaseNum +29、CONTRACT 追加 3 行（integrationTest:true）、长度断言从 24 上调到 35
- integration.test.ts mockPpt 扩展（addTable/addLine vi.fn + makeShape 补 fill/lineFormat/width/height）+ 3 个守门用例，Wave 0 即全部 rolled_back

## Task Commits

1. **Task 1: 扩展 operationLog.ts — 3 个新 PostStateSnapshot kind** - `0e0b1ee` (feat)
2. **Task 2: contract.test.ts + mockPpt 扩展 + 3 个守门用例** - `e3b31d2` (feat)

## Files Created/Modified

- `src/agent/operationLog.ts` — PostStateSnapshot.kind union 插入 ppt_table / ppt_line / ppt_shape_gradient（L54-56；接口/case/readTargetState 零改动）
- `src/agent/contract.test.ts` — PhaseNum +29（L18）；CONTRACT 追加 3 行（L74-76，integrationTest:true）；长度断言 24→35（L153-154）
- `src/agent/operationLog.integration.test.ts` — makeShape 补 fill/lineFormat/width/height（L189-192）；slide.shapes 补 addTable/addLine（L249-250）；文件末尾追加 Phase 29 describe 块（3 个 rolled_back 守门用例）

## Decisions Made

- Phase 29 三工具均设 integrationTest:true（Wave 0 即 rolled_back）——因为 adapter.deleteShapeById（L481）和 adapter.restoreShapeProperty（L375）均已在 Phase 28 之前实现，与 Phase 28 merge_cells 等工具须等 Wave 1 才变绿的模式不同
- 长度断言收紧至 35 而非计划中提到的 "可选 ≥27"——以 35（实际总数）作为精确守门更有价值

## Deviations from Plan

无 — 计划严格执行，无偏差。operationLog.ts、contract.test.ts、integration.test.ts 三文件改动均与计划完全一致。

## Issues Encountered

无。

## User Setup Required

无 — 纯测试代码，无外部服务配置。

## Next Phase Readiness

- **Wave 1（Plan 02）**：可直接实现 insert_ppt_table ToolDef + PptAdapter.insertTable + add_line ToolDef + PptAdapter.addLine；反操作侧（delete_shape_by_id）已就位，无需接线
- **Wave 2（Plan 03）**：可直接实现 set_shape_gradient ToolDef（降级纯色）+ NFR-12 bundle gate 全里程碑收口；反操作侧（restore_shape_property）已就位，无需接线
- Wave 0 验收 gate 已通过：67 tests passed，D-17 守门全绿，tsc 编译无错

---
*Phase: 29-ppt-tools-nfr12*
*Completed: 2026-06-06*
