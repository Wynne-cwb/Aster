---
phase: 27-word-tools
plan: "03"
subsystem: adapters / tools / replay-engine
tags: [word, undo, adapter, word-09, word-10, wave-3, header-footer, table-cell, phase-close]
dependency_graph:
  requires:
    - "27-01 (合约骨架：operationLog.ts kind/interface/switch，integration.test.ts mock + 4 RED 守门用例)"
    - "27-02 (WORD-06/07/08 实现：setCharacterFormat highlightColor + setWordListFormat + insertWordComment)"
  provides:
    - "WordAdapter.ts WORD-09：setWordHeaderFooter + restoreWordHeaderFooter（L2001-2096）"
    - "WordAdapter.ts WORD-10：editTableCell + restoreTableCell（L2098-2272）"
    - "word.ts WORD-09 ToolDef setWordHeaderFooter（reverse=restore_word_header_footer）"
    - "word.ts WORD-10 ToolDef editTableCell（reverse=restore_table_cell）"
    - "index.ts 注册 WORD-09/10（wordWriteTools 数组）"
    - "Phase 27 全部 5 工具交付完毕（WORD-06 折入 + WORD-07/08 Wave 2 + WORD-09/10 Wave 3）"
  affects:
    - "src/adapters/WordAdapter.ts"
    - "src/agent/tools/write/word.ts"
    - "src/agent/tools/index.ts"
    - "src/agent/tools/index.test.ts"
    - "src/agent/tools/read/tools.test.ts"
tech_stack:
  added: []
  patterns:
    - "WORD-09 setWordHeaderFooter：sections.items[sectionIndex]，getHeader/getFooter(type as unknown as Word.HeaderFooterType)，before-image body.text，insertText(Replace)，R3 soft-warning 写后回读"
    - "WORD-09 restoreWordHeaderFooter：D-17 Record 解包，sectionIndex 越界检查，getHeader/getFooter，insertText(beforeText, Replace)"
    - "WORD-10 editTableCell：WordApi 1.3 门控，双重定位（index 快路径 + fingerprint 遍历），getCellOrNullObject + load + sync + (cell as unknown as {isNullObject:boolean}).isNullObject 检查，cell.value 读写"
    - "WORD-10 restoreTableCell：D-17 Record 解包，双重定位 mirror，cell.value = beforeValue"
    - "buildTableFingerprint：文件内私有函数，直接调用（无需 import）"
key_files:
  modified:
    - "src/adapters/WordAdapter.ts（L2001-2272 四个新方法：setWordHeaderFooter + restoreWordHeaderFooter + editTableCell + restoreTableCell，+279 行）"
    - "src/agent/tools/write/word.ts（L803-950 常量 HEADER_TEXT_CAP/CELL_TEXT_CAP + SetWordHeaderFooterArgs + setWordHeaderFooter ToolDef + EditTableCellArgs + editTableCell ToolDef，+152 行）"
    - "src/agent/tools/index.ts（import 加 setWordHeaderFooter/editTableCell，wordWriteTools 数组加 2 行）"
    - "src/agent/tools/index.test.ts（Word 工具计数 21→23，注释更新）"
    - "src/agent/tools/read/tools.test.ts（Word 工具计数 21→23，注释更新）"
decisions:
  - "WORD-09 insertText Replace 在 header/footer body：soft warning 不抛（Assumption A4 待真机 UAT 确认；降级方案=clear+insertText(start)）"
  - "WORD-10 cell.isNullObject：用 (cell as unknown as {isNullObject: boolean}).isNullObject 绕过 @types/office-js 类型限制"
  - "WordApi 1.3 门控写在 Word.run 外部（fast-fail，不浪费 Office API 调用）"
  - "Word.HeaderFooterType 枚举：用 as unknown as Word.HeaderFooterType 绕过 TS 类型（type 参数是 string，枚举值对齐即可）"
  - "auto-fix: index.test.ts + tools.test.ts 工具计数 21→23（Rule 1，新增工具后计数断言失败）"
metrics:
  duration: "~20 min"
  completed: "2026-06-06"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 5
---

# Phase 27 Plan 03: WORD-09/10 实现 + Phase 27 收尾 Summary

## One-liner

Wave 3 adapter 实现：WORD-09 setWordHeaderFooter（sections.items[i].getHeader/getFooter，before-image body.text，insertText Replace）+ WORD-10 editTableCell（WordApi 1.3 门控，双重定位 tableIndex + fingerprint，cell.value 读写）；Phase 27 全部 5 工具交付，全套 1104 测试绿，bundle 82.48 KB gzip（PASS ≤ 100 KB）。

## Tasks Completed

| Task | 描述 | Commit | 关键文件 |
|------|------|--------|---------|
| 1 | WORD-09/10 adapter 方法实现（4 个方法） | e74c92e | src/adapters/WordAdapter.ts |
| 2 | WORD-09/10 ToolDef + index.ts 注册 + 全套测试 + bundle gate 收尾 | 9661a0f | word.ts / index.ts / index.test.ts / tools.test.ts |

## WORD-09 setWordHeaderFooter + restoreWordHeaderFooter 详情

**adapter 方法位置：** `src/adapters/WordAdapter.ts` L2001-2096

**setWordHeaderFooter 实现要点：**
- `sections.items[sectionIndex]`（D-06 sectionIndex 越界检查）
- `section.getHeader(type as unknown as Word.HeaderFooterType)` / `getFooter(...)`
- `body.load('text')` → `body.text ?? ''`（before-image）
- `body.insertText(text, Word.InsertLocation.replace)`
- R3 写后回读（soft warning，不抛）—— Assumption A4：insertText Replace 在 header/footer body 的行为待真机 UAT 确认

**restoreWordHeaderFooter 实现要点：**
- D-17：第一行解包 type/sectionIndex/headerOrFooter/beforeText
- sectionIndex 越界 → 抛 HostApiError（replayUndoStep catch → skipped_error）
- `section.getHeader(...) / getFooter(...)` → `body.insertText(beforeText, Replace)`

**ToolDef（`src/agent/tools/write/word.ts` ~L817-872）：**
- name: `set_word_header_footer`，kind: `write`
- humanLabel: `` `将${headerOrFooter === 'header' ? '页眉' : '页脚'}改为「${text.slice(0, 30)}」` ``
- reverse: `{ tool: 'restore_word_header_footer', args: { type, sectionIndex, headerOrFooter, beforeText } }`
- postState: `{ kind: 'word_header_footer' as const, content: { type, sectionIndex } }`

## WORD-10 editTableCell + restoreTableCell 详情

**adapter 方法位置：** `src/adapters/WordAdapter.ts` L2098-2272

**editTableCell 实现要点：**
- WordApi 1.3 门控（`isSetSupported('WordApi', '1.3')`）
- `tables.load('items/rowCount,items/values')`（Word.Table 无 columnCount，从 values[0].length 推导）
- 双重定位（D-06）：tableIndex 快路径 + fingerprint 验证 → fingerprint 遍历 → 无 fingerprint 直接用 index
- 越界检查：rowCount + values[0].length（Pitfall 5）
- `getCellOrNullObject(row, col)` + load + sync + `(cell as unknown as { isNullObject: boolean }).isNullObject` 检查（Pitfall 4）
- before-image = `cell.value`，写入 `cell.value = text`，R3 写后回读（soft warning）

**buildTableFingerprint 复用：** 文件私有函数（L38-45），直接调用，无需 import

**restoreTableCell 实现要点：**
- D-17：第一行解包 tableIndex/tableFingerprint/rowIndex/columnIndex/beforeValue
- 双重定位（与 editTableCell 完全对称）
- getCellOrNullObject + isNullObject 检查
- `cell.value = beforeValue`

**ToolDef（`src/agent/tools/write/word.ts` ~L874-950）：**
- name: `edit_table_cell`，kind: `write`
- humanLabel: `` `将表格 ${tableIndex+1} 第 ${rowIndex+1} 行第 ${columnIndex+1} 列改为「${text.slice(0,20)}」` ``
- reverse: `{ tool: 'restore_table_cell', args: { tableIndex, tableFingerprint, rowIndex, columnIndex, beforeValue } }`
- postState: `{ kind: 'word_table_cell' as const, content: { tableIndex, rowIndex, columnIndex } }`

## index.ts 注册

```typescript
// import 行（L13）加入
import { ..., setWordHeaderFooter, editTableCell } from './write/word';

// wordWriteTools 数组（L285-286）加入
setWordHeaderFooter, // Phase 27 WORD-09
editTableCell, // Phase 27 WORD-10
```

## Integration Test 用例状态（完整 Phase 27 状态 — Wave 3 后）

| 工具名 | 状态 | 说明 |
|--------|------|------|
| `set_word_list_format` | `skipped_error` | noop_inverse 正确抛错，WORD-07 预期路径 |
| `insert_word_comment` | `rolled_back` ✓ | Wave 2 变绿，deleteCommentById 读 body.comments |
| `set_word_header_footer` | `rolled_back` ✓ | Wave 3 新变绿，restoreWordHeaderFooter 实现完毕 |
| `edit_table_cell` | `rolled_back` ✓ | Wave 3 新变绿，restoreTableCell 双定位实现完毕 |
| `set_word_character_format` | `rolled_back` ✓ | 含 highlightColor '#FFFF00' → null 写回断言 |

## 全套测试结果

```
Test Files  81 passed (81)
Tests  1104 passed (1104)
```

- tsc --noEmit 退出 0
- contract.test.ts 9/9 PASS（D-17 守门通过）
- integration.test.ts 43/43 PASS（含 Phase 27 全部 5 守门用例）

## Bundle Gate 结果

```
Size limit:   100 kB
Size:         82.48 kB gzipped
```

**PASS** — 远低于 100 KB 限制（WORD-09/10 新增代码为纯字符串/逻辑，无新 npm 依赖，增量极小）

## Phase 27 全部 5 工具交付总结

| REQ | 工具名 | Wave | undo 类型 | adapter 方法 | 状态 |
|-----|--------|------|-----------|-------------|------|
| WORD-06 | `set_word_character_format`（highlightColor 折入） | 2 | 简单逆向 | `setCharacterFormat` + `restoreRangeFont`（扩展 highlightColor） | ✓ 交付 |
| WORD-07 | `set_word_list_format` | 2 | noop+gate | `setWordListFormat` | ✓ 交付（诚实降级） |
| WORD-08 | `insert_word_comment` | 2 | 简单逆向 | `insertWordComment` + `deleteCommentById` | ✓ 交付 |
| WORD-09 | `set_word_header_footer` | 3 | 简单逆向 | `setWordHeaderFooter` + `restoreWordHeaderFooter` | ✓ 交付 |
| WORD-10 | `edit_table_cell` | 3 | 简单逆向 | `editTableCell` + `restoreTableCell` | ✓ 交付 |

Word 工具总数：21（Wave 2 后）→ **23**（Wave 3 后）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 工具数量计数测试需要更新（21 → 23）**
- **Found during:** Task 2 完成后全套测试
- **Issue:** `index.test.ts` 和 `tools/read/tools.test.ts` 中 Word 工具计数硬编码为 21，添加 WORD-09/10 后变为 23
- **Fix:** 两文件计数断言 + 描述文字更新为 23，注释补充 Phase 27 Wave 3 说明
- **Files modified:** `src/agent/tools/index.test.ts`，`src/agent/tools/read/tools.test.ts`
- **Commit:** 9661a0f（同 Task 2）

## Known Stubs

无已知 stub。WORD-09/10 adapter 方法均执行真实 Office.js API 调用（无 placeholder）。

## UAT 种子注意事项

1. **WORD-07 诚实显示**：用 AI「改成列表」→ undo 时 DiffLog 应显示「此步无法自动撤销」（skipped_error），不是 rolled_back。这是正确行为，不是 bug。

2. **WORD-08 Word for Web 批注刷新**（已知平台限制 GitHub #5323）：Office for Web 插入批注后可能需要刷新页面才可见。ToolDef description 已加「注意：Word for Web 插入的批注可能需要刷新页面才可见」。这是平台限制，非 Aster bug。

3. **WORD-09 insertText Replace 真机待验**（Assumption A4）：`body.insertText(text, Word.InsertLocation.replace)` 在 header/footer body 的行为未经真机 UAT 验证。若发现 Replace 不工作，降级方案：`body.clear()` + `body.insertText(text, Word.InsertLocation.start)`。

4. **WORD-10 WordApi 1.3 门控**：`getCellOrNullObject` 要求 WordApi 1.3；Office for Web（Edge/Chrome 最新两版）应支持，但真机 UAT 确认前保守门控。

## Threat Flags

无新增 threat surface。所有 4 个新 adapter 方法均在 Word.run 闭包内操作，proxy 不出闭包（A-06）。T-27-03-1/2/3/4/5/6 已在 PLAN.md threat_model 中登记并实现缓解措施。

## Self-Check: PASSED

- [x] `src/adapters/WordAdapter.ts` 存在，`grep -c 'async setWordHeaderFooter...' ` = 4
- [x] `src/agent/tools/write/word.ts` 含 `name: 'set_word_header_footer'` 和 `name: 'edit_table_cell'`
- [x] `src/agent/tools/index.ts` 含 `setWordHeaderFooter` 和 `editTableCell`（import + 数组）
- [x] commit e74c92e 存在（Task 1）
- [x] commit 9661a0f 存在（Task 2）
- [x] `npx tsc --noEmit` 退出 0
- [x] integration.test.ts `set_word_header_footer` → `rolled_back` ✓
- [x] integration.test.ts `edit_table_cell` → `rolled_back` ✓
- [x] 全套测试 1104/1104 PASS
- [x] bundle gate 82.48 KB ≤ 100 KB PASS
