---
phase: 05-diff-log-undo-all-3
plan: "04"
subsystem: word-adapter-inverse
tags: [word, adapter, inverse, undo, tdd]
dependency_graph:
  requires:
    - "05-01"  # WordAdapter.test.ts inverse stubs
    - "05-02"  # operationLog.ts executeReverse scaffolding
  provides:
    - "WordAdapter.deleteParagraphByContent"
    - "normalizeText"
  affects:
    - src/adapters/WordAdapter.ts
    - src/adapters/WordAdapter.test.ts
tech_stack:
  added: []
  patterns:
    - "Word.run 闭包内从尾到头遍历段落（A-06）"
    - "normalizeText \\r\\n + trimEnd() 规范化（Pitfall 2 防 false-skip）"
key_files:
  created: []
  modified:
    - src/adapters/WordAdapter.ts
    - src/adapters/WordAdapter.test.ts
decisions:
  - "normalizeText 作 module-level 私有函数（非 class method），保持对比逻辑独立可测"
  - "deleteParagraphByContent 内层 catch 先判 HostApiError 再重新包装，防双层包装"
  - "DocumentAdapter 接口不加 deleteParagraphByContent（保持接口最小化；executeReverse 内 cast as WordAdapter）"
metrics:
  duration: "106s"
  completed: "2026-05-30"
  tasks: 1
  files: 2
---

# Phase 05 Plan 04: WordAdapter.deleteParagraphByContent inverse 方法 Summary

**One-liner:** `deleteParagraphByContent` + `normalizeText` 让 Word append_paragraph 有了精确反操作——从尾到头遍历内容指纹，消除 \r\n 格式差异，找不到目标段抛 HostApiError。

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | WordAdapter.deleteParagraphByContent + normalizeText | 0b371a9 | src/adapters/WordAdapter.ts, src/adapters/WordAdapter.test.ts |

## What Was Built

### `normalizeText(s: string): string`（module-level 私有函数）

```typescript
function normalizeText(s: string): string {
  return s.replace(/\r\n/g, '\n').trimEnd();
}
```

消除 Office.js Word 段落 text 末尾 `\r`/`\r\n` 格式差异（Pitfall 2）。不放入 class，保持对比逻辑独立。

### `deleteParagraphByContent(text: string): Promise<void>`

- `Word.run` 闭包内：`paras.load('items/text')` + `sync`
- 从尾到头 `for (i = len-1; i >= 0; i--)` 比对 `normalizeText(item.text) === normalizeText(text)`
- 找到：`items[i].delete()` + `sync`，return
- 未找到：抛 `HostApiError('Word deleteParagraphByContent: 目标段落已不存在', undefined)`
- 外层 catch：若已是 `HostApiError` 直接 re-throw；否则包成 `HostApiError('Word deleteParagraphByContent 失败', err)`
- A-06 满足：proxy 不出 `Word.run` 闭包

### 测试 — 4 个用例全 GREEN

| 用例 | 覆盖 |
|------|------|
| 找到匹配文本的段落并删除 | 基本路径 |
| 找不到目标段落 → 抛 HostApiError | 错误路径 |
| 规范化：末尾 `\r` 与不带 `\r` 等价 | Pitfall 2 防 false-skip |
| 从尾到头遍历：同名段落时删最后那个 | 尾部优先语义 |

## Verification Results

```
npx vitest run src/adapters/WordAdapter.test.ts → PASS (7) FAIL (0)
npx eslint src/adapters/WordAdapter.ts        → No issues found
npx tsc --noEmit | grep "error TS"            → (empty — no new TS errors)
grep -c "deleteParagraphByContent" WordAdapter.ts → 4 (≥1 ✓)
grep -c "normalizeText" WordAdapter.ts            → 5 (≥1 ✓)
```

## Deviations from Plan

**Auto-fixed Issues:**

**1. [Rule 2 - Missing critical handling] `HostApiError` double-wrap 防御**

- **Found during:** Task 1 实现时
- **Issue:** `Word.run` 闭包内 `throw new HostApiError(...)` 后会被外层 `catch (err)` 再次包装成 `HostApiError`，导致双层包装、message 变成 "Word deleteParagraphByContent 失败" 而非原始消息。
- **Fix:** 外层 catch 加 `if (err instanceof HostApiError) throw err;` 先判断再包装。
- **Files modified:** src/adapters/WordAdapter.ts
- **Commit:** 0b371a9

否则：无其他偏差——计划执行严格按照 PLAN.md。

## Known Stubs

None — 所有 it.todo 已展开为真实测试并通过。

## Threat Flags

No new threat surface introduced. `deleteParagraphByContent` 在 `Word.run` 闭包内操作，输入来自 operationLog 记录的原始 text（非 LLM 直接控制），与 T-05-04-01/02 已登记范围一致。

## Self-Check: PASSED

- [x] `src/adapters/WordAdapter.ts` exists with `deleteParagraphByContent` + `normalizeText`
- [x] `src/adapters/WordAdapter.test.ts` exists with 4 real test cases (not it.todo)
- [x] Commit `0b371a9` exists
- [x] All 7 tests pass (3 pre-existing appendParagraph + 4 new deleteParagraphByContent)
