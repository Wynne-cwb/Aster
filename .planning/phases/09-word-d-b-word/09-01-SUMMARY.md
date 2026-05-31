---
phase: "09-word-d-b-word"
plan: "01"
subsystem: "test-infrastructure"
tags: [word, undo, integration-test, tdd, wave-0, d17]
dependency_graph:
  requires:
    - "08-foundation-a-f/CONTRACT.md (Phase 9 工具合约声明)"
    - "src/agent/operationLog.ts (DocumentAdapterForReplay 接口)"
    - "src/adapters/WordAdapter.ts (真 adapter 实例)"
  provides:
    - "D-17 toolName 字符串字面量预埋（5 个 Phase 9 工具名）"
    - "5 条 Word inverse 守门测试（真 WordAdapter + mockWordRich）"
    - "WSEL-01 selection_detail 扩展骨架（计划 03 实现后变绿）"
    - "D-08 allowlist + 形状测试骨架（计划 04-07 实现后变绿）"
    - "PostStateSnapshot.kind 联合类型扩展（5 个新 kind）"
    - "DocumentAdapterForReplay 接口扩展（5 个 optional 方法）"
    - "executeReverse switch 扩展（5 个新 case）"
  affects:
    - "src/agent/contract.test.ts (D-17 硬卡扫描 operationLog.integration.test.ts)"
tech_stack:
  added: []
  patterns:
    - "mockWordRich 扩展工厂（font/style/tables/search 全字段 mock）"
    - "真 WordAdapter + mock Office.js 宿主守门范式（append_paragraph 锚点）"
    - "placeholder GREEN 测试（expect(true).toBe(true)）保持 CI 不引入新 RED"
key_files:
  modified:
    - "src/agent/operationLog.integration.test.ts"
    - "src/agent/operationLog.ts"
    - "src/adapters/WordAdapter.read.test.ts"
    - "src/agent/tools/write/word.test.ts"
decisions:
  - "Phase 9 Wave 0 守门测试严格遵循「真 WordAdapter + mock Office.js」范式，不使用 vi.fn() mock adapter（项目 #1 历史故障守门）"
  - "PostStateSnapshot.kind 和 DocumentAdapterForReplay 接口在 operationLog.ts 中提前扩展，确保 tsc --noEmit 通过（adapter as unknown as DocumentAdapterForReplay 不需要额外 cast）"
  - "executeReverse switch 提前追加 5 个 case，确保未知 reverse.tool 不走 default → 抛错信息更精准（'adapter 未实现 xxx' 而非 '未知 reverse tool'）"
  - "WSEL-01 selection_detail 骨架在已有文件追加 describe，不创建新文件（文件已存在）"
  - "word.test.ts Phase 9 骨架 8 条全绿（placeholder），不引入新的 CI RED"
metrics:
  duration: "5 分钟（279 秒）"
  completed_date: "2026-05-31"
  tasks_completed: 2
  files_modified: 4
---

# Phase 09 Plan 01: Phase 9 Wave 0 测试骨架（RED 状态）Summary

**一句话：** Phase 9 Wave 0 完成——5 个 Word inverse 守门测试（真 WordAdapter + mockWordRich）预埋 D-17 toolName 字面量，并在 operationLog.ts 中前置扩展接口/switch，确保 tsc 通过，守门正确 RED 等待 Wave 2-7 实现后变绿。

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `9f6e11e` | test(09-01): Phase 9 Wave 0 — 5 Word inverse 守门测试骨架（RED）+ postState/接口扩展 |
| Task 2 | `253f557` | test(09-01): Phase 9 Wave 0 — WSEL-01 + D-08 + 形状测试骨架（RED/GREEN placeholder） |

## What Was Built

### Task 1: 5 条 Word inverse 守门测试（真 WordAdapter，RED 骨架）

**修改文件：**
- `src/agent/operationLog.integration.test.ts` — 追加 `mockWordRich` 工厂 + 5 条 Phase 9 守门测试
- `src/agent/operationLog.ts` — `PostStateSnapshot.kind` 扩展 + `DocumentAdapterForReplay` 接口扩展 + `executeReverse` switch 扩展

**mockWordRich 工厂** 提供：
- 每段落带 `font`（全字段属性包）、`lineSpacing`、`spaceBefore`、`spaceAfter`、`alignment`、`firstLineIndent`、`leftIndent`、`style`、`styleBuiltIn`、`uniqueLocalId`
- `body.tables`（带 rowCount/columnCount/values/delete）
- `body.search()`（返回含 insertText 的 searchResults）
- `body.insertTable()`（返回完整表格对象）

**5 条守门测试**（全部 RED，预期状态）：
| toolName | reverse_tool | 状态 |
|----------|-------------|------|
| `set_word_character_format` | `restore_range_font` | RED（adapter 方法未实现）|
| `set_word_paragraph_format` | `restore_paragraph_format` | RED |
| `apply_paragraph_style` | `restore_paragraph_style` | RED |
| `find_and_replace` | `restore_range_snapshot` | RED |
| `insert_table` | `delete_table_by_marker` | RED |

每条测试均用 `new WordAdapter()`（真 adapter）+ `mockWordRich`，严格遵循 `append_paragraph` 守门范式（lines 154-166 锚点）。Wave 0 时因 adapter 方法未实现，executeReverse 抛 "adapter 未实现 xxx" → `skipped_error` 而非 `rolled_back`（预期 RED）。

**D-17 硬卡预埋验证：**
```
grep -c "set_word_character_format|..." src/agent/operationLog.integration.test.ts
→ 5（5 个 toolName 字符串字面量，contract.test.ts fs.readFileSync 扫描可找到）
```

### Task 2: WordAdapter.read.test.ts + word.test.ts 骨架

**修改文件：**
- `src/adapters/WordAdapter.read.test.ts` — 追加 WSEL-01 selection_detail 扩展 2 条骨架（RED）
- `src/agent/tools/write/word.test.ts` — 追加 D-08 allowlist 3 条 + 形状测试 5 条骨架（GREEN placeholder）

**WSEL-01 骨架**（RED，计划 03 实现后变绿）：
- `selection_detail 返回 paragraphIndex + uniqueLocalId`
- `不支持 WordApi 1.6 时 uniqueLocalId 返 null（降级 D-03）`

**word.test.ts Phase 9 骨架**（全部 GREEN，计划 04-07 替换）：
- D-08 allowlist 3 条：apply_paragraph_style 非法/合法 styleName 验证
- reverse/postState 形状 5 条：5 个 Phase 9 工具的 reverse.tool 验证

## Verification Results

```bash
# D-17 字符串字面量（5 个）
grep -c "set_word_character_format|..." src/agent/operationLog.integration.test.ts → 5 ✓

# 真 WordAdapter 实例（代码行，不含注释）
grep "new WordAdapter" → 7 个代码行（原有 2 条 + 新增 5 条） ✓

# TypeScript 编译
npx tsc --noEmit → TypeScript compilation completed ✓

# 守门测试 RED 状态（预期）
5 条守门：skipped_error（adapter 未实现，Wave 0 正确 RED）✓

# word.test.ts placeholder 全绿
8 条 Phase 9 骨架：全部 PASS ✓
```

## Deviations from Plan

### 计划外变更

**1. [Rule 2 - 编译前置] 在 operationLog.ts 提前扩展接口和 switch**

- **Found during:** Task 1（测试骨架需引用新的 postState.kind 和 reverse.tool）
- **Issue:** 计划描述用 `adapter as unknown as DocumentAdapterForReplay` 绕过编译，但 `postState.kind: 'word_char_format'` 等 5 个新 kind 在 `PostStateSnapshot.kind` 联合类型中不存在，会导致 TS 编译错误
- **Fix:** 在 `operationLog.ts` 中前置扩展：(1) `PostStateSnapshot.kind` 联合类型追加 5 个新 kind；(2) `DocumentAdapterForReplay` 接口追加 5 个 optional 方法；(3) `executeReverse` switch 追加 5 个新 case
- **Files modified:** `src/agent/operationLog.ts`
- **Commit:** `9f6e11e`

**2. [Rule 3 - 文件已存在] 追加而非新建 WordAdapter.read.test.ts / word.test.ts**

- **Found during:** Task 2 开始前
- **Issue:** 计划描述「创建新文件」，但两个文件均已存在（分别有 Phase 4 和 Phase 6 的测试内容）
- **Fix:** 在各文件末尾追加 Phase 9 describe 块，保留现有测试不变
- **Files modified:** `src/adapters/WordAdapter.read.test.ts`、`src/agent/tools/write/word.test.ts`

## Known Stubs

无——Wave 0 测试骨架是有意设计的 RED/placeholder，不是意外 stub。占位符已用 TODO(计划 0X) 注释明确标注实现时机。

## Threat Flags

无新的安全相关 surface——本计划仅修改测试文件和接口声明，不引入新的网络端点、认证路径或数据流。

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `src/agent/operationLog.integration.test.ts` | FOUND |
| `src/adapters/WordAdapter.read.test.ts` | FOUND |
| `src/agent/tools/write/word.test.ts` | FOUND |
| `.planning/phases/09-word-d-b-word/09-01-SUMMARY.md` | FOUND |
| Commit `9f6e11e` (Task 1) | FOUND |
| Commit `253f557` (Task 2) | FOUND |
