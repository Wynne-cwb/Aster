---
phase: 27-word-tools
plan: "02"
subsystem: adapters / tools / replay-engine
tags: [word, undo, adapter, word-06, word-07, word-08, wave-2, highlight, list, comment]
dependency_graph:
  requires:
    - "27-01 (合约骨架：operationLog.ts kind/interface/switch，integration.test.ts mock 路径契约)"
  provides:
    - "WordAdapter.ts WORD-06 highlightColor 折入：setCharacterFormat 4 处 + restoreRangeFont null 写回"
    - "WordAdapter.ts WORD-07 setWordListFormat 方法（isSetSupported WordApi 1.3 门控）"
    - "WordAdapter.ts WORD-08 insertWordComment（[Aster] 前缀，写后回读 id）+ deleteCommentById（body.comments）"
    - "word.ts setWordListFormat ToolDef（noop_inverse）+ insertWordComment ToolDef（delete_comment_by_id）"
    - "index.ts 注册 WORD-07/08"
    - "integration.test.ts set_word_character_format 用例 highlightColor null 写回断言（WARNING 2 闭合）"
  affects:
    - "src/adapters/WordAdapter.ts"
    - "src/agent/tools/write/word.ts"
    - "src/agent/tools/index.ts"
    - "src/agent/operationLog.integration.test.ts"
tech_stack:
  added: []
  patterns:
    - "WORD-06 highlightColor 折入：loadStr 扩展 + before-image 扩展 + only-if-present（null 不跳过，Pitfall 3）+ restoreRangeFont null 写回（as unknown as string 兜底 @types/office-js 类型限制）"
    - "WORD-07 noop+gate：setWordListFormat adapter 正常执行 startNewList，undo = noop_inverse（GitHub #6525 无法可靠还原原列表态）"
    - "WORD-08 insertWordComment 写后回读 comment.id（R3 验证）+ deleteCommentById 读 ctx.document.body.comments（BLOCKER 2 路径自洽）"
key_files:
  modified:
    - "src/adapters/WordAdapter.ts（L484 font 类型扩展，L497 loadStr 加 highlightColor，L532 before-image 加 highlightColor，L549 only-if-present，L612-617 restoreRangeFont null 写回，L1185-1370 三个新方法）"
    - "src/agent/tools/write/word.ts（L212 font 接口加 highlightColor，L669-799 WORD-07/08 ToolDef 追加）"
    - "src/agent/tools/index.ts（L13 import 加 setWordListFormat/insertWordComment，L284-285 wordWriteTools 注册）"
    - "src/agent/operationLog.integration.test.ts（L444 set_word_character_format 用例扩展 highlightColor null 写回断言）"
    - "src/agent/tools/index.test.ts（Word 工具计数 19→21）"
    - "src/agent/tools/read/tools.test.ts（Word 工具计数 19→21）"
decisions:
  - "WORD-06 highlightColor 折入 set_word_character_format：复用 restoreRangeFont inverse，省 1 合约行 + bundle（D-18 STRAP）"
  - "restoreRangeFont highlightColor 写回：用 as unknown as string 绕过 @types/office-js 将 highlightColor 定义为 string（不可 null）的类型限制；null 在运行时是有效的移除高亮语义（Pitfall 3）"
  - "WORD-07 noop+gate 维持不变：Word Online lists.getById #6525 依然无法绕过；noop_inverse 诚实降级"
  - "WORD-08 deleteCommentById 路径钉死 ctx.document.body.comments（与 Plan 01 mock 路径一致，BLOCKER 2）"
  - "auto-fix：index.test.ts + tools.test.ts 工具计数 19→21（Rule 1，新增工具后计数断言失败）"
metrics:
  duration: "~25 min"
  completed: "2026-06-06"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 6
---

# Phase 27 Plan 02: WORD-06/07/08 实现 Summary

## One-liner

Wave 2 adapter 实现：WORD-06 highlightColor 折入 setCharacterFormat（4 处 + restoreRangeFont null 写回），WORD-07 setWordListFormat（noop+gate），WORD-08 insertWordComment（[Aster] 前缀）+ deleteCommentById（body.comments BLOCKER 2 路径自洽）；integration 测试 insert_word_comment 从 skipped_error 升为 rolled_back。

## Tasks Completed

| Task | 描述 | Commit | 关键文件 |
|------|------|--------|---------|
| 1 | WORD-06 折入 + WORD-07/08 adapter 方法 | b79200c | src/adapters/WordAdapter.ts |
| 2 | WORD-07/08 ToolDef + index.ts 注册 + WORD-06 null 写回断言 | 0e90352 | word.ts / index.ts / integration.test.ts |

## WORD-06 折入详情（src/adapters/WordAdapter.ts）

**4 处改动：**

1. **loadStr 扩展**：两个分支（supportsUniqueId true/false）末尾均加 `,items/font/highlightColor`
2. **before-image 加字段**：`beforeImage.highlightColor = f.highlightColor`（null = 无高亮，也要存）
3. **only-if-present 写入**：`if (font.highlightColor !== undefined) f.highlightColor = font.highlightColor as unknown as string`（null 不跳过，Pitfall 3）
4. **restoreRangeFont 恢复块**：`if (before.highlightColor !== undefined) f.highlightColor = before.highlightColor as unknown as string`（null 写回表示移除高亮，与 bold/italic null-guard 行为不同）

**类型兜底：** `@types/office-js` 将 `Font.highlightColor` 定义为 `string`（非 nullable），但运行时 null 是有效写法（移除高亮）。用 `as unknown as string` 绕过，保留语义正确性。

**SetWordCharacterFormatArgs.font 接口扩展**（src/agent/tools/write/word.ts）：加 `highlightColor?: string | null`。

## WORD-07 setWordListFormat 详情

**adapter 方法**（~L1185-1244）：
- `isSetSupported('WordApi', '1.3')` 门控，不支持 → 抛 HostApiError
- `para.startNewList()` + `list.setLevelBullet`/`setLevelNumbering`（DefinitelyTyped #72801 兜底：`(Word as unknown as Record...).ListBullet`）
- undo 由 word.ts 层决定（noop_inverse），adapter 只负责执行写操作

**ToolDef**（src/agent/tools/write/word.ts ~L677-730）：
- name: `set_word_list_format`，kind: `write`
- reverse: `{ tool: 'noop_inverse', args: { reason: '列表格式转换无法自动撤销…（Word Online 列表 API 限制）' } }`
- humanLabel: 中文，`'将第 N 段改为项目符号/编号列表'`

## WORD-08 insertWordComment + deleteCommentById 详情

**insertWordComment 方法**（~L1246-1330）：
- `isSetSupported('WordApi', '1.4')` 门控，不支持 → 抛 HostApiError
- `COMMENT_PREFIX = '[Aster] '`，批注内容 = `[Aster] ${commentText}`（G-A 透明性要求）
- 写后回读 `comment.id`（R3 验证）；id 为空 → 抛 HostApiError

**deleteCommentById 方法**（~L1332-1370）：
- ⚠️ **路径钉死（BLOCKER 2）**：读 `ctx.document.body.comments`（`(ctx.document.body as unknown as { comments: Word.CommentCollection }).comments`）
- 与 Plan 01 mockWordRich 挂载路径 `ctx.document.body.comments` 字面量完全一致
- 遍历找 id 匹配项 → `target.delete()`；找不到 → 抛 HostApiError

**ToolDef**（src/agent/tools/write/word.ts ~L735-799）：
- name: `insert_word_comment`，kind: `write`
- reverse: `{ tool: 'delete_comment_by_id', args: { commentId: result.commentId } }`
- humanLabel: 中文，`'给第 N 段插入批注「…」'`

## index.ts 注册

```typescript
// L13: import 行加入
import { ..., setWordListFormat, insertWordComment } from './write/word';

// L284-285: wordWriteTools 数组加入
setWordListFormat, // Phase 27 WORD-07
insertWordComment, // Phase 27 WORD-08
```

## Integration Test 用例状态（完整 Phase 27 状态）

| 工具名 | 状态 | 说明 |
|--------|------|------|
| `set_word_list_format` | `skipped_error` | noop_inverse 正确抛错，WORD-07 预期路径 |
| `insert_word_comment` | `rolled_back` ✓ | Wave 2 新变绿，deleteCommentById 读 body.comments 自洽 |
| `set_word_header_footer` | `skipped_error` | Wave 3 未实现，预期 RED |
| `edit_table_cell` | `skipped_error` | Wave 3 未实现，预期 RED |
| `set_word_character_format` | `rolled_back` ✓ | 含 highlightColor '#FFFF00' → null 写回断言（WARNING 2 闭合） |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 工具数量计数测试需要更新（19 → 21）**
- **Found during:** Task 2 完成后全套测试
- **Issue:** `index.test.ts` 和 `tools/read/tools.test.ts` 中 Word 工具计数硬编码为 19，添加 WORD-07/08 后变为 21
- **Fix:** 两文件计数断言更新为 21，注释补充 Phase 27 说明
- **Files modified:** `src/agent/tools/index.test.ts`，`src/agent/tools/read/tools.test.ts`
- **Commit:** 37a892b

**2. [Rule 1 - Bug] @types/office-js Font.highlightColor 类型限制（string，非 nullable）**
- **Found during:** Task 1 TypeScript 编译（2 处 TS2322 错误）
- **Issue:** `@types/office-js` 将 `Font.highlightColor` 定义为 `string`，不接受 `string | null`；但运行时 null 是有效的移除高亮写法
- **Fix:** 两处使用 `as unknown as string` 兜底（only-if-present 写入 + restoreRangeFont 恢复块），保留语义正确性
- **Files modified:** `src/adapters/WordAdapter.ts`（2 处 as unknown as string）

## Known Stubs

无已知 stub。WORD-07/08 adapter 方法均执行真实写操作（无 placeholder）。

## Threat Flags

无新增 threat surface（WORD-07/08 均在 Word.run 闭包内操作，proxy 不出闭包，符合 A-06）。T-27-02-1/2/3/4/5 在 PLAN.md threat_model 中已登记。

## Self-Check: PASSED

- [x] `src/adapters/WordAdapter.ts` 存在（已修改）
- [x] `src/agent/tools/write/word.ts` 存在（已修改）
- [x] `src/agent/tools/index.ts` 存在（已修改）
- [x] `src/agent/operationLog.integration.test.ts` 存在（已修改）
- [x] commit b79200c 存在（Task 1）
- [x] commit 0e90352 存在（Task 2）
- [x] commit 37a892b 存在（auto-fix 计数测试）
- [x] `npx tsc --noEmit` 退出 0
- [x] `grep -c 'highlightColor' src/adapters/WordAdapter.ts` 输出 ≥ 4（非注释行 6）
- [x] `grep -c 'async setWordListFormat\|async insertWordComment\|async deleteCommentById' src/adapters/WordAdapter.ts` 输出 3
- [x] `grep -c 'body.comments' src/adapters/WordAdapter.ts` 输出 ≥ 1（BLOCKER 2 路径自洽）
- [x] integration.test.ts `insert_word_comment` → `rolled_back` ✓
- [x] integration.test.ts `set_word_list_format` → `skipped_error` ✓
- [x] integration.test.ts `set_word_character_format` → `rolled_back`（含 highlightColor null 写回断言）✓
- [x] contract.test.ts 9/9 PASS（D-17 守门通过）
