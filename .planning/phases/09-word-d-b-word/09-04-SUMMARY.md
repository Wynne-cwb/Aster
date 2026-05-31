---
phase: 09-word-d-b-word
plan: "04"
subsystem: word-write-tools
tags: [word, adapter, inverse, undo, D-17, Record-signature]
dependency_graph:
  requires: ["09-03"]
  provides: ["WORD-01", "WORD-02"]
  affects: ["src/adapters/WordAdapter.ts", "src/agent/tools/write/word.ts", "src/agent/tools/index.ts", "src/agent/contract.test.ts", ".planning/phases/08-foundation-a-f/CONTRACT.md"]
tech_stack:
  added: []
  patterns: ["before-image + Record-arg inverse", "dual-index+fingerprint location", "uniqueLocalId disambiguation (D-01/D-04)", "only-if-present write"]
key_files:
  created: []
  modified:
    - src/adapters/WordAdapter.ts
    - src/agent/tools/write/word.ts
    - src/agent/tools/index.ts
    - src/agent/contract.test.ts
    - src/agent/tools/index.test.ts
    - src/agent/tools/read/tools.test.ts
    - .planning/phases/08-foundation-a-f/CONTRACT.md
decisions:
  - "setCharacterFormat + restoreRangeFont: null 属性条件跳过写回（D-07 best-effort），避免 TypeScript 类型错误和 Word 未知行为"
  - "setParaFormat indent 字段 → firstLineIndent API 映射（D-06）"
  - "uniqueLocalId 消歧：supportsUniqueId 门控前置（WordApi 1.6 运行时检测），与 09-03 统一"
metrics:
  duration: "~25 min"
  completed_date: "2026-05-31"
  tasks_completed: 2
  files_modified: 7
---

# Phase 9 Plan 04: set_word_character_format + set_word_paragraph_format Summary

WORD-01（set_word_character_format）+ WORD-02（set_word_paragraph_format）两个简单逆向 Word write tool，含 before-image adapter 方法 + inverse adapter 方法 + ToolDef + 注册 + 合约标志位翻转。两个 D-17 integration 守门测试从 skipped_error 翻为 rolled_back（GREEN）。

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | WordAdapter.ts 新增 4 个方法 | abb9cd1 | src/adapters/WordAdapter.ts |
| 2 | ToolDef + 注册 + 标志位翻转 | 12f2723 | word.ts, index.ts, contract.test.ts, CONTRACT.md |

## What Was Built

### Task 1: WordAdapter.ts 4 个新方法

**setCharacterFormat(args: Record)**
- 写前读 before-image `{ bold, italic, underline, size, color, name }`
- uniqueLocalId 消歧（D-01/D-04）：WordApi 1.6 运行时门控，index 不匹配时全文遍历找 uid
- only-if-present 写入策略（传什么改什么）
- 返回 `{ beforeImage, afterText }`，afterText 供 inverse 段落定位

**restoreRangeFont(args: Record) — D-17 Record 签名**
- 双重定位：index 快路径 + 内容指纹降级遍历（防 index drift）
- D-07：null 属性条件跳过写回（避免覆盖 Word 混合状态）

**setParaFormat(args: Record)**
- 写前读 before-image `{ lineSpacing, spaceBefore, spaceAfter, alignment, indent, leftIndent }`
- indent 字段映射 firstLineIndent（D-06）
- 同样支持 uniqueLocalId 消歧

**restoreParagraphFormat(args: Record) — D-17 Record 签名**
- 双重定位（同 restoreRangeFont 范式）
- before.indent → para.firstLineIndent（D-06 映射）

### Task 2: ToolDef + 注册 + 标志位

- `setWordCharacterFormat` ToolDef：reverse.tool = 'restore_range_font'，Record args
- `setWordParagraphFormat` ToolDef：reverse.tool = 'restore_paragraph_format'，Record args
- tools/index.ts：buildToolsForHost('word') wordWriteTools 追加 2 个工具（总计 12 个 Word 工具）
- contract.test.ts：WORD-01/WORD-02 两行 integrationTest: false → true
- CONTRACT.md：WORD-01/WORD-02 两行 integration_test: false→true，status: planned→done

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 工具数量断言计数更新**
- **Found during:** Task 2
- **Issue:** src/agent/tools/index.test.ts 和 src/agent/tools/read/tools.test.ts 中 `buildToolsForHost('word')` 返回工具数量断言为 10，加了 2 个新工具后变为 12
- **Fix:** 两处测试断言更新为 12，并更新注释和测试描述
- **Files modified:** src/agent/tools/index.test.ts, src/agent/tools/read/tools.test.ts
- **Commit:** 12f2723

### Pre-existing Out-of-Scope Failures

- **retry.test.ts** (`fn 抛 NetworkError：重试最多 3 次`) 在修改前就已失败（flaky test）。已验证：`git stash` 后仍然失败。范围外，记录但不修复。

## Verification Results

```
npx tsc --noEmit                    → TypeScript compilation completed (no errors)
npm run test -- contract            → 9/9 passed
npm run test -- operationLog.integration → 10/13 passed (3 RED = apply_paragraph_style / find_and_replace / insert_table，wave 4-6 实现，预期 RED)
set_word_character_format test      → rolled_back (GREEN)
set_word_paragraph_format test      → rolled_back (GREEN)
```

## Known Stubs

None. 两个工具均完整实现，无 placeholder/hardcoded 空值。

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. 纯 in-process Office.js API 调用。符合 STRIDE 威胁模型：
- T-9-06 (paragraphIndex 越界)：已实现 index < 0 || index >= paras.items.length 检查 → HostApiError NOT_FOUND
- T-9-07 (位置签名风险)：Record 签名 + integration test 守门，已满足 D-17/D-18 三步门

## Self-Check: PASSED
