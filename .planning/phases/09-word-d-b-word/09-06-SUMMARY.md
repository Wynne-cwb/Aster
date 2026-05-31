---
phase: 09-word-d-b-word
plan: "06"
subsystem: word-tools
tags: [word, undo, snapshot, find-replace, WORD-04]
dependency_graph:
  requires: [09-05]
  provides: [find_and_replace-tool, restoreRangeSnapshot-adapter]
  affects: [operationLog-replay, contract-test, word-adapter]
tech_stack:
  added: []
  patterns: [snapshot-undo, noop+gate, Record-signature-D17]
key_files:
  created: []
  modified:
    - src/adapters/WordAdapter.ts
    - src/agent/tools/write/word.ts
    - src/agent/tools/write/word.test.ts
    - src/agent/tools/index.ts
    - src/agent/tools/index.test.ts
    - src/agent/tools/read/tools.test.ts
    - src/agent/contract.test.ts
    - .planning/phases/08-foundation-a-f/CONTRACT.md
decisions:
  - "restoreRangeSnapshot 信任 paragraphIndex 做快路径（find_and_replace 不增删段落，index 稳定）；不用内容指纹匹配（替换后文本已变）"
  - "超限路径（overLimit:true）仍执行 Step 3 替换（D-10 noop+gate = 已执行但无法撤销），data.replaced 返回真实替换数（SC#4）"
  - "空快照（overLimit 路径）传入 restoreRangeSnapshot 时直接 return 不走 Word.run（优化路径）"
metrics:
  duration: ~10min
  completed: "2026-05-31"
  tasks_completed: 2
  files_modified: 8
---

# Phase 09 Plan 06: find_and_replace (WORD-04) Summary

**One-liner:** find_and_replace 快照式 undo via restoreRangeSnapshot，超限 noop+gate 仍执行替换返真实 replacedCount。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | WordAdapter.ts 新增 findAndReplace + restoreRangeSnapshot | 2e6d972 | src/adapters/WordAdapter.ts |
| 2 | findAndReplace ToolDef + 测试更新 + 注册 + 标志位翻转 | 68fd38a | word.ts, word.test.ts, index.ts, index.test.ts, tools.test.ts, contract.test.ts, CONTRACT.md |

## What Was Built

**findAndReplace（WordAdapter 方法）**
- Step 1: `body.search(searchText, { matchCase, matchWholeWord })`（D-11 参数透传）
- Step 2: 计算受影响段落集合（normalizeText 近似段落归属，A5 已知限制）
- Step 2b: 超限判定（FIND_AND_REPLACE_SNAPSHOT_LIMIT=100，D-10）；超限时 snapshot=[]，但仍继续 Step 3
- Step 3: 无论是否超限，都执行 `range.insertText(replaceText, replace)` 替换循环
- 返回 `{ snapshot, replacedCount, overLimit }`，replacedCount 始终是真实替换数

**restoreRangeSnapshot（WordAdapter inverse 方法）**
- 签名 `(args: Record<string, unknown>): Promise<void>`（D-17 Record-signature）
- 空快照早返回（overLimit 路径无需还原）
- 按 snapshot 数组逐段以 paragraphIndex 快路径还原（find_and_replace 不增删段落，index 稳定）
- index 越界时跳过（诚实处理，不 crash）

**findAndReplace ToolDef（word.ts）**
- name: `find_and_replace`，kind: `write`
- 正常路径（未超限）：reverse.tool = `restore_range_snapshot`，args.snapshot = before-image
- 超限路径（D-10 noop+gate）：reverse.tool = `noop_inverse`，data.replaced = 真实替换数（SC#4）
- humanLabel: `将「{searchText}」替换为「{replaceText}」`（30 字截断）

**注册与测试**
- index.ts: wordWriteTools 新增 findAndReplace（Word 工具总数 13 → 14）
- word.test.ts: TODO placeholder → `findAndReplace.name === 'find_and_replace'` 断言
- index.test.ts + tools.test.ts: 工具数量断言 13 → 14
- contract.test.ts: integrationTest false → true（D-17 硬卡）
- CONTRACT.md: status planned → done，integration_test false → true

## Success Criteria Verification

- [x] find_and_replace tool 实现 + 注册（snapshot 在写前由 adapter 捕获）
- [x] restore_range_snapshot inverse: Record-object args（D-17 第一行解包）
- [x] integration test GREEN via 真 WordAdapter（rolled_back）— operationLog.integration.test.ts line 315
- [x] CONTRACT.md row: status=done, integration_test=true
- [x] contract.test.ts row: integrationTest=true（D-17 硬卡通过）
- [x] tsc --noEmit 通过
- [x] 只有 insert_table inverse test 仍 RED（Wave 6 预期，符合计划说明）

## Test Results

- 677 tests total, 676 passed, 1 failed
- 1 expected failure: `insert_table` (Wave 6 实现，预期 RED)
- `find_and_replace` integration test: PASSED (rolled_back) ✓
- `contract.test.ts` (9 tests): all PASSED ✓

## Deviations from Plan

**Auto-fix（Rule 2）：** 工具数量断言更新（13→14）

`index.test.ts` 和 `tools.test.ts` 有工具数量硬编码断言，追加 findAndReplace 后从 13 变为 14，同步更新这两个测试文件的断言。属于必要的测试维护，不影响功能逻辑。

无其他偏差。计划按原始规格执行。

## Known Stubs

无。find_and_replace 的 replacedCount 是真实替换计数（非占位），snapshot 是真实 before-image。

## Threat Flags

无新增威胁面（T-9-12 DoS 防御已落地：FIND_AND_REPLACE_SNAPSHOT_LIMIT=100，超限放弃快照不构建大内存 before-image）。

## Self-Check

- [x] src/adapters/WordAdapter.ts 存在 findAndReplace + restoreRangeSnapshot 方法
- [x] src/agent/tools/write/word.ts 包含 find_and_replace ToolDef
- [x] contracts.test.ts find_and_replace 行 integrationTest=true
- [x] CONTRACT.md find_and_replace 行 status=done
- [x] Commits: 2e6d972 (Task 1), 68fd38a (Task 2)

## Self-Check: PASSED
