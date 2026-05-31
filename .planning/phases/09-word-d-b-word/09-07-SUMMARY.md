---
phase: 09-word-d-b-word
plan: "07"
subsystem: agent
tags: [word, office-js, table, undo, inverse, integration-test, contract]

requires:
  - phase: 09-06
    provides: findAndReplace + restoreRangeSnapshot; Phase 9 四工具 contract done

provides:
  - WordAdapter.insertTable: D-15 afterParagraphIndex 路由 + D-13 内容指纹生成
  - WordAdapter.deleteTableByMarker: D-17 Record 签名 + D-14 诚实定位失败处理
  - insertTable ToolDef: reverse.tool='delete_table_by_marker', args=Record
  - Phase 9 合约完整收尾: 5 行全 status:done + integration_test:true

affects: [phase-10-excel-ppt, operationLog-integration-tests, contract-test]

tech-stack:
  added: []
  patterns:
    - "buildTableFingerprint: firstRow.join('|') + '__Rx' + C（C 从 values[0].length 推导，Word.Table 无 columnCount 属性）"
    - "insertTable 两次 sync：插入时一次、读 values 生成指纹时一次（同一 Word.run 闭包内）"
    - "deleteTableByMarker：遍历 body.tables 按 rowCount + values 列推导 + fingerprint 三重匹配"

key-files:
  created: []
  modified:
    - src/adapters/WordAdapter.ts
    - src/agent/tools/write/word.ts
    - src/agent/tools/write/word.test.ts
    - src/agent/tools/index.ts
    - src/agent/tools/index.test.ts
    - src/agent/tools/read/tools.test.ts
    - src/agent/contract.test.ts
    - .planning/phases/08-foundation-a-f/CONTRACT.md

key-decisions:
  - "Word.Table 无 columnCount 属性（仅 rowCount）：buildTableFingerprint 从 values[0].length 推导列数，保证插入时生成指纹与删除时匹配指纹完全一致"
  - "buildTableFingerprint 模块级私有函数（与 normalizeText 同层），不是类方法"
  - "insertTable 方法：D-17 Record 签名；load 仅 values+rowCount（不需要 columnCount）；rows/cols 直接从 args 取"

patterns-established:
  - "Phase 9 insert_table TDD: RED（集成测试预先存在）→ GREEN（adapter 实现后翻绿）"
  - "Word inverse 签名守门：真 WordAdapter + mock Office.js → 不能用 mock adapter（位置签名 bug 无法被 mock 捕获）"

requirements-completed:
  - WORD-05

duration: 20min
completed: 2026-05-31
---

# Phase 09 Plan 07: insert_table + deleteTableByMarker (WORD-05) Summary

**insert_table ToolDef with content-fingerprint-based undo (delete_table_by_marker): Word.Table.values[0].length substitutes missing columnCount API; Phase 9 contract finalized with all 5 rows done/integrationTest:true**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-31T01:30Z (approx)
- **Completed:** 2026-05-31T01:50Z (approx)
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- WordAdapter.insertTable: D-15 afterParagraphIndex 路由（paragraph.insertTable After / body.insertTable End），D-13 两次 sync 生成内容指纹，T-9-16 越界检查
- WordAdapter.deleteTableByMarker: D-17 Record 签名，遍历 body.tables 按行列数 + 指纹三重匹配，D-14 定位失败 → throw HostApiError（skipped_error，不删错表）
- buildTableFingerprint: 模块级辅助函数，firstRow.join('|') + '__RxC'（C 从 values[0].length 推导，Word.Table 无 columnCount API）
- insertTable ToolDef: reverse.tool='delete_table_by_marker', reverse.args=Record 对象（D-17），postState.kind='word_table'
- 5 个 Phase 9 Word inverse 集成测试全绿（之前 1 RED）
- Phase 9 contract 收尾：contract.test.ts 5 行全 integrationTest:true，CONTRACT.md 5 行全 done

## Task Commits

1. **Task 1: WordAdapter insertTable + deleteTableByMarker** - `695e1e9` (feat)
2. **Task 2: insertTable ToolDef + Phase 9 contract finalization** - `4d8c46d` (feat)

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified

- `src/adapters/WordAdapter.ts` — 新增 buildTableFingerprint 模块级函数 + insertTable + deleteTableByMarker 方法
- `src/agent/tools/write/word.ts` — 新增 insertTable ToolDef（InsertTableArgs interface + execute）
- `src/agent/tools/write/word.test.ts` — 更新 import，替换 TODO placeholder 为真实断言
- `src/agent/tools/index.ts` — 注册 insertTable；wordWriteTools 现有 10 个 write tool
- `src/agent/tools/index.test.ts` — 更新工具数量断言 14 → 15
- `src/agent/tools/read/tools.test.ts` — 更新工具数量断言 14 → 15
- `src/agent/contract.test.ts` — insert_table integrationTest: false → true（Phase 9 全部 5 行 true）
- `.planning/phases/08-foundation-a-f/CONTRACT.md` — insert_table status: planned → done, integration_test: false → true

## Decisions Made

- **Word.Table 无 columnCount 属性**：PLAN.md 代码片段使用了 `table.columnCount`，但 @types/office-js `Word.Table` 类型只有 `rowCount`（无 `columnCount`）。解决方案：buildTableFingerprint 改为 `(values, rows)` 两参数签名，内部用 `values[0]?.length` 推导列数。这样生成指纹（insert 时）和匹配指纹（delete 时）完全一致，无需从 API 读取列数。
- **deleteTableByMarker 列数匹配**：用 `(tableValues[0] ?? []).length` 获取当前表格列数，与 `args.cols` 比较，替代原先无效的 `table.columnCount`。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Word.Table 无 columnCount 属性导致 TypeScript 编译报 3 个 TS2339 错误**
- **Found during:** Task 1（实现 insertTable + deleteTableByMarker）
- **Issue:** PLAN.md 代码片段使用 `table.columnCount` 和 `table.load('values,rowCount,columnCount')`，但 @types/office-js `Word.Table` 类型定义中不存在 `columnCount` 属性（只有 `rowCount`），导致 `npx tsc --noEmit` 报 3 处 TS2339 错误
- **Fix:** (a) buildTableFingerprint 签名改为 `(values, rows)` 两参数，列数从 `values[0].length` 内部推导；(b) insertTable 中 load 改为 `'values,rowCount'`，直接用 `args.cols`；(c) deleteTableByMarker 中 load 改为 `'items/rowCount,items/values'`，用 `(tableValues[0] ?? []).length` 获取列数
- **Files modified:** `src/adapters/WordAdapter.ts`
- **Verification:** `npx tsc --noEmit` 通过（0 errors）；集成测试 `insert_table` GREEN（rolled_back）
- **Committed in:** 695e1e9（Task 1 commit 内）

---

**Total deviations:** 1 auto-fixed（Rule 1 — Bug: TypeScript API 类型不匹配）
**Impact on plan:** Auto-fix 修正了 PLAN.md 伪代码中的错误 API 假设。逻辑上完全等价（列数从 values 推导 = 从 API 读取，且更可靠）。无范围蔓延。

## Issues Encountered

- `Word.Table` 缺少 `columnCount` 属性（只有方法参数名叫 `columnCount`，非对象属性）。PLAN.md 研究代码片段基于不准确的假设。通过 `values[0].length` 推导解决，是比读 API 更直接可靠的方法。

## Known Stubs

None — insertTable execute 路径完整，reverse.args 包含真实指纹，无硬编码空值。

## Threat Flags

None — 无新增网络端点或信任边界。T-9-15/T-9-16/T-9-17 均在实现中处理（指纹匹配诚实/越界检查/D-17 Record 签名）。

## Next Phase Readiness

- Phase 9 全部需求完成（WSEL-01, WORD-01~05），合约收尾确认
- Phase 10 Excel + PPT 工具可以启动（Phase 9 → Phase 10 依赖已满足）
- operationLog.integration.test.ts 5 个 Phase 9 守门测试全绿，可作为 Phase 10 守门范本

---

*Phase: 09-word-d-b-word*
*Completed: 2026-05-31*
