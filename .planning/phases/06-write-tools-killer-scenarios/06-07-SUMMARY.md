---
phase: "06"
plan: "07"
subsystem: agent-tools
tags: [word, write-tools, tool-def, inverse, before-image, d11-concurrent-defense]
dependency_graph:
  requires: ["06-04"]
  provides: ["insert_paragraph", "replace_paragraph", "insert_text_at_cursor", "replace_selection"]
  affects: ["src/agent/tools/write/word.ts", "src/agent/tools/index.ts"]
tech_stack:
  added: []
  patterns: ["before-image inverse", "delete_paragraph_by_content 降级 inverse", "Record 对象 args 签名"]
key_files:
  created: []
  modified:
    - src/agent/tools/write/word.ts
    - src/agent/tools/index.ts
    - src/agent/tools/write/word.test.ts
    - src/agent/tools/index.test.ts
    - src/agent/tools/read/tools.test.ts
decisions:
  - "replace_selection inverse 使用 delete_paragraph_by_content 近似（非 noop_inverse）：至少有概率还原，失败 → skipped_error"
  - "insertParagraph / insertTextAtCursor 的 data 统一用 { written: length }（精简 bundle）"
  - "replaceParagraph / replaceSelection 的 data 统一用 { written: length }（bundle 守住 82KB）"
metrics:
  duration: "~11min"
  completed: "2026-05-30"
  tasks: 2
  files: 5
---

# Phase 6 Plan 07: Word Write Tools 四个新 ToolDef — SUMMARY

**一句话**：在 Word 宿主实现 insert_paragraph / replace_paragraph / insert_text_at_cursor / replace_selection 四个 ToolDef，replace_paragraph 含 D-11 expected_text 并发防御，replace_selection 使用 delete_paragraph_by_content 近似 inverse（非 noop_inverse），全部符合 [[project-adapter-inverse-signature]] Record 对象签名守门。

## What Was Built

4 个新 Word write tools 加进 `src/agent/tools/write/word.ts`，并注册进 `buildToolsForHost('word')`：

| Tool | Adapter 方法 | Inverse 策略 | D-11 |
|------|-------------|-------------|------|
| `insert_paragraph` | `insertParagraphAt(before_index, text)` | `delete_paragraph_by_content`（内容指纹） | — |
| `replace_paragraph` | `replaceParagraphAt(index, text, expected_text?)` | `restore_paragraph_at`（before-image） | ✓ optional `expected_text` |
| `insert_text_at_cursor` | `insertTextAtCursor(text)` | `delete_paragraph_by_content`（近似） | — |
| `replace_selection` | `replaceSelection(text)` | `delete_paragraph_by_content`（降级近似） | — |

全部工具：
- `kind: 'write'`，`humanLabel` 含中文截断（HUMAN_LABEL_TEXT_CAP=30）
- `postState: { kind: 'word_paragraph', content: text }` 供 replayUndoAll 对比手动改
- `reverse.args` 全为 Record 对象（非位置参，[[project-adapter-inverse-signature]] 守门）

## Commits

| Hash | 描述 |
|------|------|
| b00f1a9 | feat(06-07): word.ts 新增 insertParagraph / replaceParagraph ToolDef |
| 3ffbac6 | feat(06-07): word.ts 新增 insertTextAtCursor / replaceSelection ToolDef + 注册 + 测试 |
| 1618ab6 | fix(06-07): 更新 buildToolsForHost 工具数量断言（word 10 / ppt 9） |

## Test Results

- `word.test.ts`：14/14 PASS（0 skipped，Wave 0 describe.skip 全部解锁）
- `index.types.test.ts`：2/2 PASS
- `index.test.ts`：9/9 PASS
- `read/tools.test.ts`：24/24 PASS
- 全套：47 test files passed / 567 passed / 12 skipped（retry.test.ts 预存在 flaky，单跑 9/9 PASS，非本次回归）

## Bundle Size

82.00 KB = 82 KB limit（精确守住，零超出）

关键措施：精简 description 字符串 + data 字段统一用 `{ written: length }` 而非 `{ beforeLength, replacedWith }` 复合对象。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ToolResult 无 mutated 独立字段**
- **Found during:** Task 1 TypeScript 编译
- **Issue:** PLAN.md 提到 `mutated` 字段放在 ToolResult 返回值，但 ToolResult interface 无此字段
- **Fix:** 将 mutated 信息（replacedWith、beforeLength 等）合并进 `data` 字段（LLM 通过 data 获取 self-verify 信息，符合 D-10），统一精简为 `{ written: length }`
- **Files modified:** `src/agent/tools/write/word.ts`

**2. [Rule 1 - Bug] bundle 超出 50 字节（82.05KB > 82KB）**
- **Found during:** Task 2 build 验证
- **Issue:** 新增 4 个 write tools + 注册代码推 bundle 超出 50B
- **Fix:** 逐步精简各工具 description 字符串 + 统一 data 为 `{ written: length }`，恢复至 82.00KB
- **Files modified:** `src/agent/tools/write/word.ts`

**3. [Rule 1 - Bug] buildToolsForHost 工具数量测试断言过时**
- **Found during:** Task 2 全套测试
- **Issue:** `index.test.ts` + `tools.test.ts` 中 word 预期 6 个（现在 10 个）；PPT 预期 6 个（Phase 06-06 已变 9 个，但当时未更新测试）
- **Fix:** 更新 word 6→10，PPT 6→9；PPT kind 测试从单个 insert_slide 扩展到 4 个 write tools
- **Files modified:** `src/agent/tools/index.test.ts`, `src/agent/tools/read/tools.test.ts`

## Known Stubs

无。所有 4 个工具均完整实现，直接委托已存在的 WordAdapter 方法（Phase 04 + 06-04 已交付）。

## Threat Flags

无新增安全相关表面（T-06-07-01/02/03 均已在 PLAN 的 threat_model 中评估）。

## Self-Check: PASSED

- src/agent/tools/write/word.ts: FOUND
- src/agent/tools/index.ts: FOUND
- src/agent/tools/write/word.test.ts: FOUND
- Commit b00f1a9: FOUND
- Commit 3ffbac6: FOUND
- Commit 1618ab6: FOUND
