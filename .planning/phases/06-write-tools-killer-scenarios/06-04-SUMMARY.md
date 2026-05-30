---
phase: "06"
plan: "04"
subsystem: adapters
tags: [word, write-tools, inverse, record-signature, normalize-text]
dependency_graph:
  requires: ["06-01"]
  provides: ["WordAdapter.insertParagraphAt", "WordAdapter.replaceParagraphAt", "WordAdapter.restoreParagraphAt", "WordAdapter.insertTextAtCursor", "WordAdapter.replaceSelection", "WordAdapter.restoreSelection"]
  affects: ["src/agent/tools/write/word.ts", "operationLog replay engine"]
tech_stack:
  added: []
  patterns: ["before-image inverse", "Record<string,unknown> adapter signature", "dual-strategy paragraph location (index + content fingerprint)", "normalizeText comparison"]
key_files:
  created: []
  modified:
    - src/adapters/WordAdapter.ts
decisions:
  - "restoreSelection 直接抛 HostApiError（T-06-04-03 accept）：replace_selection 的 inverse 路径复杂，降级为 non-undoable，DiffLog 标注用户知情"
  - "restoreParagraphAt 双策略定位：index 快速路径 + 内容指纹降级遍历（防 Phase 5 Pitfall 3 index 漂移）"
  - "insertParagraphAt 末尾/中间分支：末尾走 body.insertParagraph(end)，中间走 para.insertParagraph(before)"
metrics:
  duration: "2min 18sec"
  completed_date: "2026-05-30"
  tasks: 2
  files_changed: 1
---

# Phase 06 Plan 04: WordAdapter Write/Inverse 方法扩展 Summary

**One-liner:** WordAdapter 新增 5 个 write/inverse 方法（insertParagraphAt + replaceParagraphAt + restoreParagraphAt + insertTextAtCursor + replaceSelection），全部遵循 Record 签名守门 + normalizeText 内容指纹定位范式，作为 Wave 3 Word write tools 的 adapter 层基础。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1+2 | WordAdapter 新增 5 个 write/inverse 方法 | 7358a75 | src/adapters/WordAdapter.ts (+228 lines) |

## Implementation Notes

### Task 1: insertParagraphAt + replaceParagraphAt + restoreParagraphAt

**insertParagraphAt(beforeIndex, text)**
- 末尾插入（beforeIndex === paras.items.length）→ `ctx.document.body.insertParagraph(text, end)`
- 中间插入 → `paras.items[beforeIndex].insertParagraph(text, before)`
- 越界 → HostApiError（tool execute 层回 NOT_FOUND）
- inverse 复用现有 `deleteParagraphByContent({ text })`

**replaceParagraphAt(index, newText, expectedText?)**
- 完全按 RESEARCH.md 范式实现：before-image + D-11 expected_state 并发防御
- `normalizeText(expectedText) !== normalizeText(currentText)` → HostApiError('并发修改冲突')
- 写入 `paras.items[index].insertText(newText, Word.InsertLocation.replace)`

**restoreParagraphAt(args: Record<string, unknown>)**
- 双策略定位防 index 漂移（Phase 5 Pitfall 3 防御）：
  1. index 快速路径：检查 `normalizeText(paras.items[index].text) === normalizeText(expectedText)`
  2. 降级遍历：遍历全文找 expectedText 内容指纹
- 找不到 → HostApiError（replay engine 标 skipped_error）

### Task 2: insertTextAtCursor + replaceSelection + restoreSelection

**insertTextAtCursor(text)**
- `ctx.document.getSelection().insertText(text, Word.InsertLocation.after)`（已在 WordAdapter.insert 中验证）
- 返 `{ insertedText: text }`

**replaceSelection(newText)**
- sel.load('text') → sync → 抓 beforeImage → insertText(replace)
- 返 `{ beforeImage }`

**restoreSelection(args: Record<string, unknown>)**
- T-06-04-03 accept：直接抛 HostApiError('replace_selection inverse 暂不支持自动回滚')
- replay engine 标 skipped_error；DiffLog 展示「无法自动回滚此步」

## Verification Results

```
grep -c "insertParagraphAt|replaceParagraphAt|restoreParagraphAt" src/adapters/WordAdapter.ts
→ 9 ✓（≥6）

grep -c "Record<string, unknown>" src/adapters/WordAdapter.ts
→ 4 方法签名（restoreParagraphAt + restoreSelection + deleteParagraphByContent + readWordParagraph）≥3 ✓

grep -c "insertText" src/adapters/WordAdapter.ts
→ 11 ✓（replaceParagraphAt 核心写入处存在）

npm run build → ✓（main-*.js 80.38 KB ≤ 82 KB）
npm test --run src/agent/tools/write/word.test.ts → 6 passed | 7 skipped ✓
全套测试 → 541 passed | 28 skipped（retry.test.ts 3 flaky 为预存在，非本次回归）
```

## Deviations from Plan

### 合并 commit

Task 1 和 Task 2 均只修改 `src/adapters/WordAdapter.ts` 一个文件，两个 task 语义连贯（同一 adapter 扩展目标），合并为单一 feat commit。

### restoreSelection 新增（Rule 2 - 缺失关键功能）

Plan 提到 `replaceSelection` inverse 在 tool level 处理 reverse descriptor 降级，但 adapter 层需要提供明确的错误路径供 replay engine 消费。按 T-06-04-03 accept 决策新增 `restoreSelection(args: Record<string, unknown>)` 方法，直接抛 HostApiError 作为正式降级实现，而非静默失败。这也保持与 `restoreParagraphAt` 的签名一致性，方便 replay engine 统一调用。

## Known Stubs

无。所有实现均为功能完整的生产代码。`restoreSelection` 的 HostApiError 是已知降级行为（T-06-04-03 accept），不是 stub。

## Threat Flags

无新增安全相关 surface。所有新方法均在现有 Word.run 闭包模式内实现，proxy 不出 Word.run（A-06 合规）。

## Self-Check: PASSED

- [x] `src/adapters/WordAdapter.ts` 修改已提交（commit 7358a75）
- [x] commit 7358a75 存在：`git log --oneline | grep 7358a75` ✓
- [x] build 通过（80.38 KB ≤ 82 KB）
- [x] 测试无新增 FAIL
