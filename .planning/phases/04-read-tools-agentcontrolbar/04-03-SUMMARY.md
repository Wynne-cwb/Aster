---
phase: 04-read-tools-agentcontrolbar
plan: "03"
subsystem: adapters
tags: [word-adapter, read-tools, office-js, tdd]
dependency_graph:
  requires: [04-02]
  provides: [WordAdapter.read() 5 kinds实现]
  affects: [src/agent/tools/read/word.ts, loop-helpers read dispatch]
tech_stack:
  added: []
  patterns: [Word.run 闭包纯数据进出 SP-A, styleBuiltIn outline, NOT_FOUND 越界返回]
key_files:
  created:
    - src/adapters/WordAdapter.read.test.ts
  modified:
    - src/adapters/WordAdapter.ts
decisions:
  - "get_paragraph_at 越界（index<0 或 index>=length）返 NOT_FOUND，不抛异常（T-04-09）"
  - "get_document_outline 用 styleBuiltIn 匹配 /^Heading(\\d)$/ 而非本地化 .style（RESEARCH Pitfall 5）"
  - "get_document_full_text adapter 不截断，size cap 由上层 tool execute wrapReadResult 处理（T-04-08）"
  - "selection_detail 直接委托 this.getSelection()，复用现有路径，不重开 Word.run"
  - "每 case 各自独立 try/catch → HostApiError，与 getSelection() 风格一致（SP-A）"
metrics:
  duration: "3m 23s"
  completed: "2026-05-29"
  tasks_completed: 1
  files_created: 1
  files_modified: 1
---

# Phase 4 Plan 03: WordAdapter.read() 5 kinds 实现 Summary

**One-liner:** WordAdapter.read() switch 覆盖 5 个 Word read kind，用 styleBuiltIn 抽 outline、bounds check 返 NOT_FOUND、selection_detail 委托 getSelection()，18 个 mock 单测全绿。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | WordAdapter.read 失败测试 | 8651dc2 | src/adapters/WordAdapter.read.test.ts |
| 1 (GREEN) | WordAdapter.read() 5 kind 实现 | 6ddb96c | src/adapters/WordAdapter.ts |

## Implementation Details

### WordAdapter.read() switch（src/adapters/WordAdapter.ts L154-249）

| kind | 实现路径 | 返回形态 |
|------|----------|----------|
| `get_paragraph_count` | `paragraphs.load('items/text')` → `paras.items.length` | `{ok:true, data:{count:N}}` |
| `get_paragraph_at` | `load('items/text')` → bounds check → `paras.items[index].text` | `{ok:true, data:{index,text}}` 或 NOT_FOUND |
| `get_document_outline` | `load('items/text,items/styleBuiltIn')` → filter `/^Heading(\d)$/` | `{ok:true, data:{outline:[{level,text,paragraphIndex}]}}` |
| `get_document_full_text` | `body.load('text')` → `body.text` | `{ok:true, data:{text}}` |
| `selection_detail` | `await this.getSelection()` | `{ok:true, data:SelectionContext}` |
| default | — | `{ok:false, error:{code:'UNSUPPORTED'}}` |

### 安全约束落地

- **T-04-06（A-06）：** 每 case 均在 Word.run 闭包内 `.load()` → `await ctx.sync()` → 取 plain value 返出；proxy 对象绝不返出闭包。
- **T-04-07：** catch → `throw new HostApiError('Word <kind> 失败', err)`，HostApiError 构造器不存 hostError（防 stack 泄漏）。
- **T-04-08：** `get_document_full_text` adapter 层不截断；size cap 由上层 wrapReadResult（Plan 01）处理。
- **T-04-09：** `get_paragraph_at` index 越界（负数或 >= length）返 `{ok:false, error:{code:'NOT_FOUND'}}` 不抛，不越界访问 items[]。

## Test Coverage

**文件：** `src/adapters/WordAdapter.read.test.ts`（392 行，18 个断言）

| describe | 测试用例数 | 关键断言 |
|----------|-----------|----------|
| get_paragraph_count | 3 | count 返回、Word.run 调用、抛错→HostApiError |
| get_paragraph_at | 5 | index=0/2 正常、999 越界 NOT_FOUND、-1 越界、抛错 |
| get_document_outline | 4 | 3 个 Heading 提取、空 outline、非 Heading 不入列、抛错 |
| get_document_full_text | 3 | text 返回、sync 调用、抛错 |
| selection_detail | 2 | 有选区 word kind、无选区 none kind |
| default UNSUPPORTED | 1 | list_slides → UNSUPPORTED，不抛 |

## Verification Results

- `npx vitest run src/adapters/WordAdapter.read.test.ts`: **18 PASS, 0 FAIL**
- `npm run test -- --run`: **340 passed, 1 failed**（唯一失败 = loop.test.ts AGENT-02，Phase 3 预存在失败，未引入新失败）
- `npx tsc --noEmit`: 通过，0 类型错误
- `npm run build`: 通过，bundle 76.78 KB gzip（预算 ≤80 KB）
- `npx eslint src/adapters/WordAdapter.ts`: No issues found

## Deviations from Plan

None — 计划完全按预期执行。

## Threat Flags

None — 新增 read 路径均在既有 Word.run 闭包边界内，无新网络端点或新 trust boundary。

## Self-Check: PASSED

- [x] `src/adapters/WordAdapter.read.test.ts` 存在（392 行）
- [x] `src/adapters/WordAdapter.ts` 含 `async read(query:` 方法（L154）
- [x] commit 8651dc2 存在（test RED）
- [x] commit 6ddb96c 存在（feat GREEN）
- [x] `grep styleBuiltIn src/adapters/WordAdapter.ts` ≥1 命中
- [x] `grep -c ".style\b" src/adapters/WordAdapter.ts` = 0（无本地化 .style）
- [x] 5 个 kind 全在 WordAdapter.ts 中命中
