---
phase: 05-diff-log-undo-all-3
plan: "06"
subsystem: adapters
tags: [ppt, inverse, undo, title-fingerprint, tdd]
dependency_graph:
  requires:
    - "05-02"  # operationLog Wave 1（DocumentAdapterForReplay 接口定义）
  provides:
    - "PptAdapter.insertSlideAfter"
    - "PptAdapter.deleteSlideByTitle"
  affects:
    - "src/adapters/PptAdapter.ts"
    - "src/adapters/PptAdapter.test.ts"
tech_stack:
  added: []
  patterns:
    - "PPT 三 sync 范式（list_slides 模式复用）"
    - "title 指纹定位（D-06，index 漂移免疫）"
    - "从后往前遍历删除（T-05-06-01 同名安全侧）"
    - "args: Record<string, unknown> 签名（DocumentAdapterForReplay 接口约定）"
key_files:
  created: []
  modified:
    - src/adapters/PptAdapter.ts
    - src/adapters/PptAdapter.test.ts
decisions:
  - "insertSlideAfter PoC 实现：slides.add() 追加到末尾（Office.js 无精确 after 参数），Phase 6 升级精确插入"
  - "deleteSlideByTitle 签名采用 args: Record<string, unknown>（与 DocumentAdapterForReplay 接口一致，replay engine 直接传 reverse.args）"
  - "从后往前遍历（T-05-06-01）：同名 slide 时删最靠后的，安全侧"
  - "normalizeText 独立函数（trim + \\r\\n 归一），与 operationLog.isTargetStateConsistent ppt_slide 规则对齐"
metrics:
  duration: "4 min"
  completed_date: "2026-05-30"
  tasks_completed: 1
  files_modified: 2
---

# Phase 05 Plan 06: PptAdapter insertSlideAfter + deleteSlideByTitle Summary

**One-liner:** title 指纹定位的 PPT inverse 路径——insertSlideAfter（三 sync + add() + title 提取）和 deleteSlideByTitle（三 sync + 从后往前遍历 + HostApiError），与 DocumentAdapterForReplay 接口对齐。

## What Was Built

Wave 2c：PptAdapter 新增两个方法，完成 PPT undo inverse 路径的核心实现。

### `insertSlideAfter(_afterIndex, _title?)`

- 在 PowerPoint.run 闭包内执行（A-06）
- 三 sync 范式（PPT-05 TEXT_SHAPE_TYPES 过滤）：
  - sync 1：`slides.load('items')` 记录 insert 前总数
  - `slides.add()` 追加到末尾（PoC；Office.js 无精确 after 参数）
  - sync 2：重新 load slides.items + shapes.items/type
  - sync 3：文本形状 textRange.load('text')
- 取 sorted 最后一张 = 新 slide，提取 title 指纹（第一个文本形状首行 trim）
- 返回 `{ insertedIndex: number; title: string }` 供 OperationLog postState + reverse.args

### `deleteSlideByTitle(args: Record<string, unknown>)`

- 签名遵循 `DocumentAdapterForReplay.deleteSlideByTitle` 接口约定（args 对象，args.titleFingerprint）
- 三 sync list_slides 范式，复用 TEXT_SHAPE_TYPES 过滤
- 从后往前遍历 sorted（T-05-06-01：同名 slide 删最靠后的，安全侧）
- 未找到 → `throw new HostApiError('PPT deleteSlideByTitle: 目标 slide 已不存在', undefined)`
- catch 包：`if (err instanceof HostApiError) throw err; else throw new HostApiError(...)`

### `normalizeText(s: string): string`

- 模块级辅助函数（`s.replace(/\r\n/g, '\n').trim()`）
- 与 `operationLog.isTargetStateConsistent` ppt_slide 规则一致

## TDD Execution

| Phase | Commit | Status |
|-------|--------|--------|
| RED   | 9c3acc2 | 10 tests failing（`is not a function`）|
| GREEN | 20a6e0a | 10 tests passing |
| REFACTOR | — | 不需要（代码清晰，注释齐全）|

## Test Coverage

10 个 mock 单测（`npx vitest run src/adapters/PptAdapter.test.ts`）：

**insertSlideAfter（3 个）：**
- slides.add() 调用次数 + 返回结构 `{ insertedIndex, title }`
- PowerPoint.run 报错 → HostApiError
- 新 slide 含文本形状时 title 为首行（取 `\n` 前内容）

**deleteSlideByTitle（5 个）：**
- 找到匹配 title → slide.delete() 调用一次
- 找不到 → throw HostApiError
- 多张 slide 从后往前遍历（重名删最后一个）
- PowerPoint.run 报错 → HostApiError
- trim 比对（带空格首行 + 多行文本）

**structural smoke（2 个）：**
- PptAdapter 可实例化
- capabilities() 返回 ppt host + slides

## Verification Results

```
npx vitest run src/adapters/PptAdapter.test.ts  → PASS (10) FAIL (0)
npx tsc --noEmit                                → 无 error TS
npx eslint src/adapters/PptAdapter.ts           → 无 error
npm run build && npm run size                   → 81.23 KB ≤ 82 KB ✓
grep -c "insertSlideAfter|deleteSlideByTitle" PptAdapter.ts → 5 occurrences ≥ 2 ✓
```

## Deviations from Plan

### 接口签名调整

**发现于：** Task 1 实现阶段

**情况：** plan 的 `<behavior>` 中 `deleteSlideByTitle` 签名写为 `deleteSlideByTitle(titleFingerprint: string): Promise<void>`，但 `operationLog.ts` 中 `DocumentAdapterForReplay` 接口定义（第 92-93 行）及 `executeReverse` 的调用方式（`adapter.deleteSlideByTitle(reverse.args)`，第 241 行）均使用 `args: Record<string, unknown>`。

**修正：** 以 `DocumentAdapterForReplay` 接口为准（与 `overwriteRange` 等一致），签名改为 `deleteSlideByTitle(args: Record<string, unknown>): Promise<void>`，内部提取 `args.titleFingerprint as string`。

**影响：** 测试文件中的调用同步更新为 `adapter.deleteSlideByTitle({ titleFingerprint: '...' })`。

这是 Rule 1（bug fix）：计划中的签名与已实现接口不一致，保持与接口约定一致是正确行为。

## Known Stubs

无。两个方法均完整实现（insertSlideAfter 的 `_afterIndex` 参数在 PoC 阶段忽略，已在注释中明确"Phase 6 升级精确插入"，这是有意设计而非功能缺失）。

## Threat Flags

无新增安全相关表面（方法在 PowerPoint.run 闭包内，proxy 不出闭包；titleFingerprint 来自 insertSlideAfter 返回的真实 Office.js title，不经 LLM 构造）。

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/adapters/PptAdapter.ts | FOUND |
| src/adapters/PptAdapter.test.ts | FOUND |
| .planning/phases/05-diff-log-undo-all-3/05-06-SUMMARY.md | FOUND |
| RED commit 9c3acc2 | FOUND |
| GREEN commit 20a6e0a | FOUND |
