---
phase: 27-word-tools
plan: "01"
subsystem: replay-engine / contract
tags: [word, undo, contract, tdd-skeleton, wave-1]
dependency_graph:
  requires: []
  provides:
    - "operationLog.ts Phase 27 骨架：kind union + 接口声明 + switch case"
    - "contract.test.ts Phase 27 CONTRACT 行 + D-17 守门"
    - "operationLog.integration.test.ts Phase 27 4 守门用例（wave 1 RED）"
    - "CONTRACT.md Phase 27 段落"
  affects:
    - "src/agent/operationLog.ts"
    - "src/agent/contract.test.ts"
    - "src/agent/operationLog.integration.test.ts"
    - ".planning/phases/08-foundation-a-f/CONTRACT.md"
tech_stack:
  added: []
  patterns:
    - "PostStateSnapshot.kind union 扩展（Phase 27 4 种 kind，走保守 default）"
    - "DocumentAdapterForReplay 接口可选方法声明"
    - "executeReverse switch case 路由（adapter 未实现 → throw → skipped_error）"
    - "mockWordRich 扩展：comments（body.comments）+ sections + table .map(getCellOrNullObject)"
key_files:
  modified:
    - "src/agent/operationLog.ts（L46 kind union，L168-177 接口声明，L537-554 switch case）"
    - "src/agent/contract.test.ts（L18 PhaseNum，L65-69 CONTRACT 4 行，L144 守门注释）"
    - "src/agent/operationLog.integration.test.ts（L256-355 mockWordRich 扩展，L551-641 4 守门用例）"
    - ".planning/phases/08-foundation-a-f/CONTRACT.md（Phase 27 段落 5 工具行）"
decisions:
  - "Wave 1 只建合约骨架；integration 4 用例预期 RED（adapter 方法 wave 2/3 实现）"
  - "comments mock 挂 ctx.document.body.comments（与 Plan 02 deleteCommentById 路径自洽）"
  - "table items 用 .map() 版本追加 getCell/getCellOrNullObject + isNullObject:false（Plan 03 防御）"
  - "新 kind 走保守 default（D-03 硬约束，不加 readTargetState/isTargetStateConsistent case）"
metrics:
  duration: "~15 min"
  completed: "2026-06-06"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 27 Plan 01: 合约骨架接线 Summary

## One-liner

Wave 1 合约骨架：operationLog.ts 注册 4 种新 kind + 3 个接口声明 + 3 个 switch case，contract.test.ts 追加 4 条 Phase 27 CONTRACT 行（D-17 守门通过），integration.test.ts 补 4 个守门用例（wave 1 预期 RED），CONTRACT.md 追加 Phase 27 段。

## Tasks Completed

| Task | 描述 | Commit | 关键文件 |
|------|------|--------|---------|
| 1 | 扩展 operationLog.ts：4 kind + 3 接口 + 3 case | e9346d1 | src/agent/operationLog.ts |
| 2 | contract.test.ts + integration.test.ts + CONTRACT.md | 5d2fac7 | 3 个文件 |

## operationLog.ts 改动详情

**修改 1：PostStateSnapshot.kind union（| 'ppt_layout' 之后、| 'batch' 之前插入）**
```typescript
// Phase 27 新增：Word 工具补全 4 个 kind（readTargetState/isTargetStateConsistent 走保守 default）
| 'word_list_format' | 'word_comment' | 'word_header_footer' | 'word_table_cell'
```

**修改 2：DocumentAdapterForReplay 接口（executeBatchReverse 之前插入）**
- `deleteCommentById?`（insert_word_comment 的 inverse）
- `restoreWordHeaderFooter?`（set_word_header_footer 的 inverse）
- `restoreTableCell?`（edit_table_cell 的 inverse）
- 注：WORD-06 折入复用 restoreRangeFont（无需新增）；WORD-07 noop+gate（无需新增）

**修改 3：executeReverse switch（noop_inverse 之前插入 3 个 case）**
- `case 'delete_comment_by_id'`
- `case 'restore_word_header_footer'`
- `case 'restore_table_cell'`
- 每个 case：adapter 方法不存在 → throw → skipped_error（安全降级）

## contract.test.ts 改动详情

- PhaseNum 类型：`9 | 10 | 11 | 23 | 27`
- CONTRACT[] 末尾追加 4 行（integrationTest: true）：
  - `set_word_list_format`（noop+gate，noop_inverse）
  - `insert_word_comment`（简单逆向，delete_comment_by_id）
  - `set_word_header_footer`（简单逆向，restore_word_header_footer）
  - `edit_table_cell`（简单逆向，restore_table_cell）
- 守门注释更新（总数 30 行，`>= 24` 自动通过）

## integration.test.ts 改动详情

**mockWordRich 扩展（BLOCKER 2/3 根因修复）：**

1. opts 新增 `comments?: Array<{ id: string; delete: ReturnType<typeof vi.fn> }>` 和 `sectionHeader?: { text: string; insertText: ReturnType<typeof vi.fn> }`

2. **comments mock 挂载路径**（跨 plan 契约钉死）：
   - `ctx.document.body.comments`（与 paragraphs/tables 同级在 body 上）
   - Plan 02 的 `deleteCommentById` 实现读 `ctx.document.body.comments`——路径字面量两 plan 完全一致
   - ⚠️ 不能挂 ctx.document 顶层

3. **sections mock** 挂 `ctx.document`（与 body 同级）：
   - 含 `getFirst()` + `items[]`，结构一致（getHeader/getFooter 均有 load/text/insertText）

4. **table cell mock**（.map() 版本替换原 `const tableItems = opts?.tables ?? [];`）：
   ```typescript
   const tableCellMockDefault = { load: vi.fn(), value: '原内容', isNullObject: false, body: { insertText: vi.fn() } };
   const tableItems = (opts?.tables ?? []).map((t) => ({
     ...t,
     getCell: vi.fn(() => tableCellMockDefault),
     getCellOrNullObject: vi.fn(() => tableCellMockDefault),
   }));
   ```
   - `isNullObject: false`：Plan 03 的 `if (cell.isNullObject)` 检查需走明确 false（不是 undefined）

**4 个 Phase 27 守门用例（wave 1 预期 RED）：**
- `set_word_list_format` → `noop_inverse` → 预期 `skipped_error`（noop 正确抛错）
- `insert_word_comment` → `delete_comment_by_id` → 预期 `rolled_back`（Wave 2 实现后变绿）
- `set_word_header_footer` → `restore_word_header_footer` → 预期 `rolled_back`（Wave 3）
- `edit_table_cell` → `restore_table_cell` → 预期 `rolled_back`（Wave 3）

## Wave 1 验收结果

```
contract.test.ts: 9/9 PASS（D-17 守门通过）✓
integration.test.ts Phase 27 用例状态（预期 RED）：
  - set_word_list_format: skipped_error ✓（noop_inverse 正确抛错）
  - insert_word_comment: skipped_error ✓（adapter 方法未实现，Wave 2 实现）
  - set_word_header_footer: skipped_error ✓（adapter 方法未实现，Wave 3 实现）
  - edit_table_cell: skipped_error ✓（adapter 方法未实现，Wave 3 实现）
```

**Wave 1 验收 gate：`npm run test -- --run src/agent/contract.test.ts` → 退出 0 ✓**

## Deviations from Plan

None — 计划完全按预期执行。

## Wave 1 RED 状态（正常）

integration.test.ts 新增的 4 个用例在 wave 1 结束时**预期为 RED/skipped_error**：
- adapter 方法（deleteCommentById / restoreWordHeaderFooter / restoreTableCell）尚未在 WordAdapter.ts 实现
- wave 2（Plan 02）将实现 `insert_word_comment` 的 adapter 方法，对应用例变绿
- wave 3（Plan 03）将实现 `set_word_header_footer` + `edit_table_cell` 的 adapter 方法，对应用例变绿
- **不在 wave 1 验收时要求 integration 全绿**——这是 Wave 2/3 的职责

## 跨 Plan Mock 契约（供 Plan 02 实现对齐）

Plan 02 的 `deleteCommentById` 实现必须读：
```typescript
ctx.document.body.comments  // ← 路径字面量，与 mockWordRich 的 body.comments 完全一致
```
不能读 `ctx.document.comments`（无此 mock）。

## Self-Check: PASSED

- [x] `src/agent/operationLog.ts` 存在（已修改）
- [x] `src/agent/contract.test.ts` 存在（已修改）
- [x] `src/agent/operationLog.integration.test.ts` 存在（已修改）
- [x] `.planning/phases/08-foundation-a-f/CONTRACT.md` 存在（已修改）
- [x] commit e9346d1 存在
- [x] commit 5d2fac7 存在
- [x] `contract.test.ts` D-17 守门：9/9 PASS
- [x] integration 4 新用例：预期 RED（skipped_error），与 wave 1 声明一致
