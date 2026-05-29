---
phase: "05-diff-log-undo-all-3"
plan: "07"
subsystem: "agent/tools"
tags: ["write-tools", "tool-04", "reverse-descriptor", "post-state", "bundle"]
dependency_graph:
  requires:
    - "05-04 (WordAdapter.deleteParagraphByContent)"
    - "05-05 (ExcelAdapter.setRangeValues / overwriteRange)"
    - "05-06 (PptAdapter.insertSlideAfter / deleteSlideByTitle)"
  provides:
    - "ppt.ts insert_slide write tool (reverse=delete_slide_by_title)"
    - "excel.ts set_range_values write tool (reverse=overwrite_range, before-image)"
    - "assertWriteToolRegisterable TOOL-04 注册层守门"
    - "loop-helpers postState 透传链路闭合"
  affects:
    - "src/agent/tools/index.ts (buildToolsForHost)"
    - "src/agent/loop-helpers.ts (appendOperation)"
tech_stack:
  added: []
  patterns:
    - "write tool ToolDef 模板：execute → reverse + postState → OperationLog"
    - "assertWriteToolRegisterable：注册层 throw 守门（不是 console.assert）"
    - "before-image 策略：setRangeValues 抓取写前快照作 reverse.args（D-05）"
    - "title 指纹策略：insertSlide 以 title 定位而非 index（D-06）"
key_files:
  created:
    - src/agent/tools/write/ppt.ts
    - src/agent/tools/write/excel.ts
  modified:
    - src/agent/tools/index.ts
    - src/agent/loop-helpers.ts
    - src/agent/tools/read/tools.test.ts
    - src/agent/tools/index.test.ts
decisions:
  - "assertWriteToolRegisterable 使用 throw Error 而非 console.assert（TOOL-04 语义要求：注册时阻断）"
  - "description 字符串精简以保 bundle ≤82 kB gate（新工具字面量进 main chunk）"
  - "已有测试（tools.test.ts / index.test.ts）数量断言和 kind 断言随新 write tool 注册一起更新（Rule 1 auto-fix）"
metrics:
  duration: "~30 min"
  completed: "2026-05-30"
  tasks_completed: 2
  files_modified: 6
  files_created: 2
---

# Phase 05 Plan 07: 三宿主 Write Tool PoC + assertWriteToolRegisterable + postState 透传 Summary

三宿主 write tool 数据链路全闭合：ppt.ts insert_slide（title 指纹 reverse）+ excel.ts set_range_values（before-image reverse）+ TOOL-04 注册层 throw 守门 + loop-helpers postState 透传到 OperationLog。

## What Was Built

### Task 1: ppt.ts insert_slide + excel.ts set_range_values write tools

**ppt.ts** (`src/agent/tools/write/ppt.ts`)
- `InsertSlideArgs = { afterIndex?: number; title: string; bullets?: string[] }`
- `humanLabel`: `在幻灯片末尾插入新幻灯片「{title}」`（截 20 字）
- `execute`: 调 `(ctx.adapter as PptAdapter).insertSlideAfter(afterIndex ?? -1, title)`
- `reverse`: `{ tool: 'delete_slide_by_title', args: { titleFingerprint: title } }` — title 指纹定位（D-06，不受 index 漂移）
- `postState`: `{ kind: 'ppt_slide', content: { index: insertedIndex, title } }`

**excel.ts** (`src/agent/tools/write/excel.ts`)
- `SetRangeValuesArgs = { address: string; values: unknown[][] }`
- `humanLabel`: `写入单元格区域 ${address}`
- `execute`: 调 `(ctx.adapter as ExcelAdapter).setRangeValues(address, values)`，拿 `{ beforeImage }`
- `reverse`: `{ tool: 'overwrite_range', args: { address: beforeImage.address, values: beforeImage.values } }` — before-image 精确定位（D-05）
- `postState`: `{ kind: 'excel_range', content: { address, values } }`

word.ts 的 reverse 在 Phase 5 Plan 01 已改为 `delete_paragraph_by_content`，此 Plan 确认 6/6 tests GREEN。

### Task 2: buildToolsForHost 注册 + assertWriteToolRegisterable + postState 透传

**index.ts**
- 新增 `assertWriteToolRegisterable(tool: ToolDef): void`：`tool.kind === 'write' && typeof tool.humanLabel !== 'function'` → `throw new Error(...)`（TOOL-04 注册层阻断）
- `buildToolsForHost` case 'excel' 加 `setRangeValuesTool`；case 'ppt' 加 `insertSlide`；三宿主各自调用 guard
- `assertWriteToolRegisterable` 在文件中出现 4 次（定义 + 3 次调用），满足 ≥2 约束

**loop-helpers.ts**
- `appendOperation` 调用增加 `postState: result.postState`（Phase 5 数据链路闭合）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 已有测试断言与新 write tool 注册冲突**
- **Found during:** Task 2 测试运行
- **Issue:** `src/agent/tools/read/tools.test.ts` 和 `src/agent/tools/index.test.ts` 有断言说 excel/ppt 所有工具 `kind === 'read'`，且工具数量固定（excel=4, ppt=5）
- **Fix:** 更新数量断言（excel 4→5, ppt 5→6）；kind 断言改为按 name 分组（read/write 分别断言）
- **Files modified:** `src/agent/tools/read/tools.test.ts`, `src/agent/tools/index.test.ts`
- **Commit:** 0702b55

**2. [Rule 3 - Bundle] 新工具字面量让 bundle 超 82 KB gate**
- **Found during:** Task 2 build 验证
- **Issue:** 初始 build 82.21 KB（超出 0.21 KB）；精简后逐步到 81.93 KB
- **Fix:** 精简 description 字符串（ppt/excel 各节省约 40B）；内联 HUMAN_LABEL_TITLE_CAP 常量；统一缩短 console.assert 消息
- **Files modified:** `src/agent/tools/write/ppt.ts`, `src/agent/tools/write/excel.ts`
- **Commit:** 0702b55（同 Task 2 commit）

## Verification Results

| Check | Result |
|-------|--------|
| `grep -c "delete_paragraph_by_content" word.ts` | 2 ✓ |
| `grep -c "insert_slide\|delete_slide_by_title" ppt.ts` | 2 ✓ |
| `grep -c "set_range_values\|overwrite_range" excel.ts` | 2 ✓ |
| `grep "postState" loop-helpers.ts` 含 `result.postState` | ✓ |
| `grep -c "assertWriteToolRegisterable" index.ts` | 4 ≥2 ✓ |
| `npx vitest run src/agent/tools/` | 57 pass / 0 fail ✓ |
| `npx eslint src/agent/tools/` | 0 errors 0 warnings ✓ |
| `npx tsc --noEmit` | 0 errors ✓ |
| `npm run build && npm run size` | 81.93 KB ≤ 82 KB ✓ |
| A-06 office namespace 守门（write tools 不直接引用 Word/Excel/PowerPoint） | ✓ |
| TOOL-04 assertWriteToolRegisterable throw（非 console.assert） | ✓ |

**预存在 flaky：** `src/agent/loop.test.ts` 的 `soft landing` 测试在 baseline（git stash）也失败，与本 plan 无关，不处理。

## Known Stubs

- `bullets` 参数在 `ppt.ts`：接收但不写入 slide（PoC 阶段注释说明 Phase 6 实现）。不影响本 plan 目标（insert_slide + reverse 数据链路），已在 description 中注明。

## Threat Flags

无新增安全面。所有新 Office.js 调用均通过 adapter 隔离（A-06），write tool 不直接引用 PowerPoint/Excel 命名空间（T-05-07-01 mitigated）。postState 仅记录操作目标数据（text/address/title），不记录整个文档（T-05-07-02 mitigated）。

## Self-Check: PASSED

Files exist:
- FOUND: src/agent/tools/write/ppt.ts
- FOUND: src/agent/tools/write/excel.ts
- FOUND: .planning/phases/05-diff-log-undo-all-3/05-07-SUMMARY.md

Commits exist:
- FOUND: 658407e (feat(05-07): 新建 ppt.ts insert_slide + excel.ts)
- FOUND: 0702b55 (feat(05-07): assertWriteToolRegisterable + postState 透传)
