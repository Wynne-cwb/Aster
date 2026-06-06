---
phase: 28-excel-tools
plan: "01"
subsystem: agent/operationLog
tags:
  - contract
  - undo
  - excel
  - wave0
dependency_graph:
  requires:
    - "Phase 27 Word 工具补全合约（operationLog.ts Phase 27 骨架已在位）"
  provides:
    - "Phase 28 合约骨架（2 kind + 2 接口 + 2 switch case）"
    - "D-17 守门 Wave 0 安全（integrationTest: false）"
    - "6 个守门用例桩（Wave 1/2 后变绿）"
  affects:
    - "src/agent/operationLog.ts（PostStateSnapshot.kind union 扩展）"
    - "src/agent/contract.test.ts（CONTRACT 数组 29→33 行）"
    - "src/agent/operationLog.integration.test.ts（6 个新守门用例 + mockExcel 扩展）"
    - ".planning/phases/08-foundation-a-f/CONTRACT.md（Phase 28 段落）"
tech_stack:
  added: []
  patterns:
    - "Wave 0 合约骨架先行范式（Phase 9/10/27 同款）"
    - "D-17 integrationTest: false 安全门控（Wave 0 不触发 fs.readFileSync 扫描）"
    - "D-21 保守路径约定（新 kind 不加 readTargetState case，走 default → undefined）"
key_files:
  created: []
  modified:
    - src/agent/operationLog.ts
    - src/agent/contract.test.ts
    - src/agent/operationLog.integration.test.ts
    - .planning/phases/08-foundation-a-f/CONTRACT.md
decisions:
  - "D-21 约束遵守：excel_merge / excel_pivot 两个新 kind 不在 readTargetState / isTargetStateConsistent 中新增 case，走 default → undefined/true（保守侧）"
  - "remove_duplicates 复用现有 'excel_snapshot' kind 和 'restore_range_values_snapshot' case，无需新增"
  - "Wave 0 6 个守门用例的期望状态：remove_duplicates 正向 rolled_back，其余 5 个 skipped_error（adapter 方法 Wave 1/2 实现后变绿）"
metrics:
  duration: "约 5 分钟"
  completed_date: "2026-06-06"
  tasks_completed: 2
  files_modified: 4
---

# Phase 28 Plan 01：合约骨架接线（Wave 0）Summary

**一句话：** 在 operationLog.ts 注册 excel_merge/excel_pivot 两个新 kind + 2 个接口声明 + 2 个 switch case；在 contract.test.ts 追加 3 条 Phase 28 行（integrationTest: false）；在 integration.test.ts 追加 6 个守门用例桩 + 扩展 mockExcel；更新 CONTRACT.md 人读表。Wave 0 gate 通过，1115 测试无 N failed。

## 执行结果

### Task 1：扩展 operationLog.ts

**Commit：** 5e70565

**修改内容（3 处精确插入）：**

1. **PostStateSnapshot.kind union（L49-52 新增）：**
   - `'excel_merge'` — merge_cells 快照式（unmerge + values 覆写 undo）
   - `'excel_pivot'` — create_pivot_table 简单逆向（delete undo）
   - remove_duplicates 复用已有 `'excel_snapshot'`，无需新增

2. **DocumentAdapterForReplay 接口声明（L178-183 新增）：**
   - `restoreMergeState?: (args: Record<string, unknown>) => Promise<void>`
   - `deletePivotTableByName?: (args: Record<string, unknown>) => Promise<void>`

3. **executeReverse switch case（L576-584 新增）：**
   - `case 'restore_merge_state'` — adapter 未实现时 throw → skipped_error
   - `case 'delete_pivot_table_by_name'` — adapter 未实现时 throw → skipped_error

**D-21 约束满足：** readTargetState 和 isTargetStateConsistent 中**未**新增任何 case，两个新 kind 走 default → undefined/true（保守侧）。

### Task 2：contract.test.ts + integration.test.ts + CONTRACT.md

**Commit：** 27d0614

**contract.test.ts 修改：**
- PhaseNum 类型：`9 | 10 | 11 | 23 | 27` → `9 | 10 | 11 | 23 | 27 | 28`
- CONTRACT[] 追加 3 行（integrationTest: false — D-17 Wave 0 安全）：
  - `{ toolName: 'merge_cells', phase: 28, integrationTest: false, ... }`
  - `{ toolName: 'remove_duplicates', phase: 28, integrationTest: false, ... }`
  - `{ toolName: 'create_pivot_table', phase: 28, integrationTest: false, ... }`

**integration.test.ts 修改（mockExcel 扩展）：**

range 对象追加：
- `merge: vi.fn()` — 供 merge_cells 工具
- `unmerge: vi.fn()` — 供 restore_merge_state undo
- `removeDuplicates: vi.fn(() => ({ load: vi.fn(), removed: 2, uniqueRemaining: 8 }))` — 供 remove_duplicates 工具

worksheet 对象追加：
- `pivotTables: { add: vi.fn(...), getItem: vi.fn(...) }` — 供 create_pivot_table 工具

**integration.test.ts 追加（6 个守门用例）：**

| 用例 | toolName | reverse.tool | Wave 0 期望 | 变绿时机 |
|------|----------|-------------|------------|---------|
| merge_cells 正向 | `'merge_cells'` | `restore_merge_state` | `skipped_error` | Wave 1 实现 adapter 方法后 |
| merge_cells noop | `'merge_cells'` | `noop_inverse` | `skipped_error` | 永远（noop 路径） |
| remove_duplicates 正向 | `'remove_duplicates'` | `restore_range_values_snapshot` | **`rolled_back`** | Wave 0 即绿（基建已存在） |
| remove_duplicates noop | `'remove_duplicates'` | `noop_inverse` | `skipped_error` | 永远（noop 路径） |
| create_pivot_table 正向 | `'create_pivot_table'` | `delete_pivot_table_by_name` | `skipped_error` | Wave 2 实现 adapter 方法后 |
| create_pivot_table noop | `'create_pivot_table'` | `noop_inverse` | `skipped_error` | 永远（noop 路径） |

**CONTRACT.md 追加：** Phase 28 段落（3 条工具行，status: planned，integration_test: false）

## Wave 0 验收结果

| 验收项 | 结果 |
|--------|------|
| `npm test -- --run src/agent/contract.test.ts` | ✅ 9/9 通过 |
| `npx tsc --noEmit` | ✅ 编译通过 |
| `grep -c "excel_merge" operationLog.ts` | ✅ 1（kind union 中） |
| `grep -c "excel_pivot" operationLog.ts` | ✅ 1（kind union 中） |
| `grep -c "restoreMergeState" operationLog.ts` | ✅ 2（接口 + switch） |
| `grep -c "deletePivotTableByName" operationLog.ts` | ✅ 2（接口 + switch） |
| `grep -c "case 'restore_merge_state'" operationLog.ts` | ✅ 1 |
| `grep -c "case 'delete_pivot_table_by_name'" operationLog.ts` | ✅ 1 |
| `grep -c "phase: 28" contract.test.ts` | ✅ 3 |
| `grep -c "'merge_cells'" integration.test.ts` | ✅ 2（>= 1） |
| `grep -c "'remove_duplicates'" integration.test.ts` | ✅ 2（>= 1） |
| `grep -c "'create_pivot_table'" integration.test.ts` | ✅ 2（>= 1） |
| 完整 `npm test`（1115 测试） | ✅ 81 文件全通过，尾部 3 个 retry 噪音（已知） |
| readTargetState 无新增 case | ✅ 满足 D-21 约束 |

## 当前 integration 守门用例状态（Wave 0 正确）

- `remove_duplicates` 正向撤销 → **`rolled_back`**（基建 restore_range_values_snapshot 已存在）
- `merge_cells` 正向撤销 → **`skipped_error`**（adapter.restoreMergeState Wave 1 实现后变绿）
- `create_pivot_table` 正向撤销 → **`skipped_error`**（adapter.deletePivotTableByName Wave 2 实现后变绿）
- 3 个 noop_inverse 路径 → **`skipped_error`**（永远，符合预期）

## Deviations from Plan

无 — plan 按规格执行，无偏差。

## Known Stubs

无。本 plan 为纯骨架接线（合约 + 类型 + 路由），不涉及任何 UI 渲染或数据流桩。Wave 1/2 守门用例目前为 skipped_error 是 Wave 0 的正确状态，不是 stub。

## Threat Flags

本 plan 未引入新的网络端点、auth 路径、文件访问模式或 schema 变化，无新增安全面。

## Self-Check: PASSED

文件存在检查：
- ✅ src/agent/operationLog.ts — 存在且包含 excel_merge/excel_pivot
- ✅ src/agent/contract.test.ts — 存在且 PhaseNum 含 28
- ✅ src/agent/operationLog.integration.test.ts — 存在且含 3 个 toolName 字面量 + 6 个用例
- ✅ .planning/phases/08-foundation-a-f/CONTRACT.md — 存在且含 Phase 28 段落

Commit 存在检查：
- ✅ 5e70565 — feat(28-01): 扩展 operationLog.ts
- ✅ 27d0614 — feat(28-01): contract.test.ts + integration.test.ts + CONTRACT.md

Wave 0 gate：
- ✅ `npm test -- --run src/agent/contract.test.ts` → 9/9 退出 0
- ✅ 完整 npm test → 1115 tests passed, 0 failed
