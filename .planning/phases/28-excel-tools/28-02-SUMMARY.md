---
phase: 28-excel-tools
plan: "02"
subsystem: agent/excel-tools
tags:
  - excel
  - merge
  - remove-duplicates
  - undo
  - snapshot
  - wave2
dependency_graph:
  requires:
    - "Phase 28 Plan 01：合约骨架（operationLog.ts kinds/interfaces/switch cases 已在位）"
  provides:
    - "EXCEL-11 merge_cells 全链路：adapter(mergeCells+restoreMergeState) + ToolDef + 注册"
    - "EXCEL-12 remove_duplicates 全链路：adapter(removeDuplicatesRange) + ToolDef + 注册"
    - "integration.test.ts Phase 28 merge_cells 守门用例从 skipped_error 变绿为 rolled_back"
    - "contract.test.ts Phase 28 merge_cells/remove_duplicates integrationTest: true"
    - "CONTRACT.md Phase 28 两行 status: done"
  affects:
    - "src/adapters/ExcelAdapter.ts（+171 行，3 个新方法）"
    - "src/agent/tools/write/excel.ts（+107 行，2 个 ToolDef）"
    - "src/agent/tools/index.ts（import + 数组注册）"
    - "src/agent/contract.test.ts（2 行 integrationTest: false→true）"
    - "src/agent/operationLog.integration.test.ts（merge_cells 守门用例期望更新）"
    - ".planning/phases/08-foundation-a-f/CONTRACT.md（2 行 status: done）"
    - "src/agent/tools/index.test.ts（工具计数 20→22）"
    - "src/agent/tools/read/tools.test.ts（工具计数 20→22，writeToolNames 扩充）"
tech_stack:
  added: []
  patterns:
    - "快照式 undo（sortRange 模式镜像）：先 readRangeValuesSnapshot → 执行操作 → 返回快照"
    - "Record 签名 inverse（D-18 硬约束）：(args: Record<string, unknown>) → 防 Phase 5 翻车"
    - "超限 tooLarge=true → noop_inverse（诚实不可撤销，不中断 agent）"
    - "isSetSupported('ExcelApi', '1.9') 门控（excelFindAndReplace 先例）"
    - "restoreMergeState 双路分支：merge undo = unmerge + snapshot 写回；unmerge undo = 重新 merge"
    - "removeDuplicates 返回 proxy 对象需 load+sync（Pitfall 4，cast 绕 TS 类型不精确）"
key_files:
  created: []
  modified:
    - src/adapters/ExcelAdapter.ts
    - src/agent/tools/write/excel.ts
    - src/agent/tools/index.ts
    - src/agent/contract.test.ts
    - src/agent/operationLog.integration.test.ts
    - .planning/phases/08-foundation-a-f/CONTRACT.md
    - src/agent/tools/index.test.ts
    - src/agent/tools/read/tools.test.ts
decisions:
  - "restoreMergeState merge undo 路径：unmerge + range.values = snapshot 双步（数据安全硬门，还原非左上单元格被清空的值）"
  - "removeDuplicatesRange 复用 restoreRangeValuesSnapshot inverse（不新建 reverse case）"
  - "removeDuplicates Office.js 返回 proxy：cast 绕过 TS 类型不精确，load(['removed','uniqueRemaining']) + sync"
metrics:
  duration: "约 6 分钟"
  completed_date: "2026-06-06"
  tasks_completed: 2
  files_modified: 8
---

# Phase 28 Plan 02：EXCEL-11/12 实现（Wave 2）Summary

**一句话：** ExcelAdapter 新增快照式 mergeCells/restoreMergeState/removeDuplicatesRange 三方法，配套 mergeCellsTool + removeDuplicatesTool ToolDef + excelWriteTools 注册，merge_cells/remove_duplicates integration 守门全部变绿，bundle 实测 82.48 KB gzip。

## 执行结果

### Task 1：ExcelAdapter 新增 3 个方法

**Commit：** 69b4364

**新增方法（ExcelAdapter.ts Phase 28 Wave 2 节，L1780-末）：**

1. **`async mergeCells`（L1792）：** 快照式写方法，镜像 sortRange。
   - merge 路径先 readRangeValuesSnapshot（merge 会永久清空非左上单元格值）
   - unmerge 路径也快照（结构统一，供 restoreMergeState 双路处理）
   - 超限 isTooLarge → tooLarge=true（仍执行，不中断）
   - 返回 `{ snapshot, snapshotAddress, tooLarge }`

2. **`async restoreMergeState`（L1843）：** inverse，Record 签名（D-18 硬约束）。
   - merge undo = range.unmerge() + await ctx.sync() + range.values = snapshot + await ctx.sync()（双步，数据安全硬门）
   - unmerge undo = range.merge(across)（无值丢失，只需重新合并）

3. **`async removeDuplicatesRange`（L1884）：** 快照式写方法 + ExcelApi 1.9 门控。
   - isSetSupported('ExcelApi', '1.9') 门控，不支持则抛 HostApiError（诚实拒绝）
   - 先快照（超限仍执行，标 tooLarge=true）
   - removeDuplicates 返回 proxy，cast + load(['removed','uniqueRemaining']) + sync（Pitfall 4）
   - 返回 `{ snapshot, snapshotAddress, tooLarge, removed, uniqueRemaining }`

**integration.test.ts 更新：** merge_cells 守门用例期望从 `skipped_error` 改为 `rolled_back`（adapter 已实现）

### Task 2：ToolDef 定义 + 注册 + 合约状态更新

**Commit：** ad2dacd

**tools/write/excel.ts 新增（L648-末）：**

- **`mergeCellsTool`（L654）：** `name: 'merge_cells'`，kind: 'write'，快照式。
  - parameters: address（required）、operation（enum: merge/unmerge，required）、across（可选）
  - humanLabel：中文（「合并单元格 A1:C1」/「取消合并 A1:C1」）
  - reverse：tooLarge→noop_inverse，否则 restore_merge_state（含 snapshot）
  - postState.kind: 'excel_merge'

- **`removeDuplicatesTool`（L706）：** `name: 'remove_duplicates'`，kind: 'write'，快照式。
  - parameters: address（required）、columns（可选数组）、includes_header（可选，snake_case）
  - humanLabel：中文（「删除 A1:D100 内的重复行」）
  - reverse：tooLarge→noop_inverse，否则 restore_range_values_snapshot（复用既有 case）
  - postState.kind: 'excel_snapshot'

**tools/index.ts：** import + excelWriteTools 注册（Phase 28 Wave 2 注释，batchWrite 前）

**contract.test.ts：** merge_cells + remove_duplicates 两行 `integrationTest: false → true`

**CONTRACT.md Phase 28 段：** merge_cells + remove_duplicates 两行 `status: planned → done，integration_test: false → true`

**工具数量守门（Rule 1 auto-fix）：** tools/index.test.ts + tools/read/tools.test.ts Excel 工具计数 20 → 22，writeToolNames 集合加入 merge_cells/remove_duplicates

## Wave 2 验收结果

| 验收项 | 结果 |
|--------|------|
| `npx tsc --noEmit` | ✅ 编译通过 |
| `grep -c "async mergeCells" ExcelAdapter.ts` | ✅ 1 |
| `grep -c "async restoreMergeState" ExcelAdapter.ts` | ✅ 1（L1843，Record 签名） |
| `grep -c "async removeDuplicatesRange" ExcelAdapter.ts` | ✅ 1 |
| `grep "'merge_cells'" tools/write/excel.ts` | ✅ 1 |
| `grep "'remove_duplicates'" tools/write/excel.ts` | ✅ 1 |
| `grep -c "mergeCellsTool" tools/index.ts` | ✅ 2（import + 数组） |
| `grep -c "removeDuplicatesTool" tools/index.ts` | ✅ 2（import + 数组） |
| `contract.test.ts merge_cells integrationTest` | ✅ true |
| `contract.test.ts remove_duplicates integrationTest` | ✅ true |
| `CONTRACT.md merge_cells status` | ✅ done |
| `CONTRACT.md remove_duplicates status` | ✅ done |
| `npm test -- --run contract.test.ts` | ✅ 9/9 通过 |
| `npm test -- --run operationLog.integration.test.ts` | ✅ 54/54 通过 |
| `merge_cells` integration 守门用例 | ✅ rolled_back |
| `remove_duplicates` integration 守门用例 | ✅ rolled_back |
| 完整 `npm test`（1115 测试） | ✅ 81 文件全通过，尾部 3 retry 噪音（已知） |
| `npm run build && npm run size` | ✅ 82.48 KB gzip（≤100 KB 门控通过） |
| restoreMergeState 签名 Record | ✅ `(args: Record<string, unknown>): Promise<void>` |
| 参数键 snake_case | ✅ address/operation/across/includes_header（无驼峰） |
| humanLabel 中文 | ✅ 合并单元格/取消合并/删除…内的重复行 |

## Bundle 实测数值

```
Size limit:   100 kB
Size:         82.48 kB gzipped
Loading time: 1.7 s    on slow 3G
```

两个新工具的代码完全进入懒加载 chunk（ExcelAdapter 和 tools），不影响 main 初始 bundle。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 工具数量守门断言需随新工具更新**

- **Found during：** Task 2 全套测试
- **Issue：** tools/index.test.ts 和 tools/read/tools.test.ts 断言 Excel 工具数量 = 20，新增 2 个工具后变 22 导致测试失败；writeToolNames 集合也缺少两新工具，kind 守门误报
- **Fix：** 两文件工具计数 20 → 22，描述更新为 Phase 28，writeToolNames 加入 merge_cells/remove_duplicates
- **Files modified：** src/agent/tools/index.test.ts，src/agent/tools/read/tools.test.ts
- **Commit：** ad2dacd（含在 Task 2 提交中）

## Known Stubs

无。两工具完整实现（adapter + ToolDef + 注册），无任何 TODO/placeholder/hardcoded empty。

## Threat Flags

本 plan 未引入新网络端点、auth 路径、文件访问模式或 schema 变化。merge/undo 数据路径满足 T-28-02-1 至 T-28-02-5 所有缓解措施（见 threat_model）。

## Self-Check: PASSED

文件存在检查：
- ✅ src/adapters/ExcelAdapter.ts — 含 async mergeCells（L1792）/ async restoreMergeState（L1843）/ async removeDuplicatesRange（L1884）
- ✅ src/agent/tools/write/excel.ts — 含 export const mergeCellsTool（L654）/ export const removeDuplicatesTool（L706）
- ✅ src/agent/tools/index.ts — import 含 mergeCellsTool/removeDuplicatesTool；excelWriteTools 数组含两工具
- ✅ src/agent/contract.test.ts — merge_cells/remove_duplicates integrationTest: true
- ✅ src/agent/operationLog.integration.test.ts — merge_cells 守门用例期望 rolled_back
- ✅ .planning/phases/08-foundation-a-f/CONTRACT.md — 两行 status: done

Commit 存在检查：
- ✅ 69b4364 — feat(28-02): ExcelAdapter 新增 mergeCells + restoreMergeState + removeDuplicatesRange
- ✅ ad2dacd — feat(28-02): mergeCellsTool + removeDuplicatesTool 全链路：ToolDef、注册、合约状态
