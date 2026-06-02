---
phase: 17-file
plan: "01"
subsystem: test-infrastructure
tags: [tdd, wave-0, red-light, parsers, nfr-09]
dependency_graph:
  requires: []
  provides: [FILE-02-red-stubs, FILE-03-red-stubs, FILE-04-red-stubs, FILE-05-red-stubs, NFR-09-path-D]
  affects: [src/lib/parsers/, src/store/chat.test.ts]
tech_stack:
  added: []
  patterns: [vitest-vi-mock-factory, ts-expect-error-wave0-stub, tdd-red-light]
key_files:
  created:
    - src/lib/parsers/docx.test.ts
    - src/lib/parsers/xlsx.test.ts
    - src/lib/parsers/pdf.test.ts
    - src/lib/parsers/pptx.test.ts
  modified:
    - src/store/chat.test.ts
decisions:
  - "Wave 0 红灯策略：@ts-expect-error 让 tsc 通过，vitest 层面保留 Failed to resolve import 红灯（不用 describe.skip）"
  - "vi.mock 工厂形式（非 vi.hoisted）确保 pdfjs-dist GlobalWorkerOptions + getDocument 在 import 前提升"
  - "chat.test.ts 路径 D 作为 describe 嵌套在现有 HIST-01/02 describe 块末尾（与 A/B/C 同层级）"
metrics:
  duration: "~15min"
  completed: "2026-06-02T15:31:42Z"
  tasks_completed: 2
  files_modified: 5
---

# Phase 17 Plan 01: Wave 0 测试脚手架（红灯）Summary

**一句话：** TDD Wave 0 脚手架——4 个解析器测试 stub（docx/xlsx/pdf/pptx）全部以 vitest "Failed to resolve import" 红灯运行，chat.test.ts 新增 NFR-09 路径 D 守门断言（derivedText 不进序列化）全绿。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | 新建 4 个解析器测试 stub（红灯） | b64c497 | src/lib/parsers/{docx,xlsx,pdf,pptx}.test.ts（新建） |
| 2 | 扩展 chat.test.ts 新增 NFR-09 路径 D | fd0c72a | src/store/chat.test.ts（+39 行） |

## What Was Built

### Task 1：4 个解析器测试 stub（Wave 0 红灯）

**新建 `src/lib/parsers/` 目录**，在其中建立 4 个 TDD 测试文件：

- **`docx.test.ts`**（FILE-02）：`vi.mock('mammoth')` + 3 个用例（文本返回/超长截断/lazy 验证）。`import { parseDocx } from './docx'` Wave 2 前不存在 → 红灯。
- **`xlsx.test.ts`**（FILE-03）：`vi.mock('xlsx')` + 3 个用例（多 sheet 表头/单 sheet CSV/行数截断提示）。`import { parseXlsx } from './xlsx'` Wave 2 前不存在 → 红灯。
- **`pdf.test.ts`**（FILE-04）：`vi.mock('pdfjs-dist', ...)` **工厂形式**（`GlobalWorkerOptions + getDocument`，见 17-RESEARCH.md L730-745）+ 3 个用例（正常页拼接/扫描件 `PDF_NO_TEXT_LAYER` 错误/workerSrc 设置验证）。`import { parsePdf } from './pdf'` Wave 2 前不存在 → 红灯。
- **`pptx.test.ts`**（FILE-05）：`vi.mock('jszip')` 含 3 slide + notesSlide1 的 files map + 3 个用例（数字排序 slide1<slide2<slide10/<a:t> 文本提取/演讲者备注 `[Slide N 备注]` 前缀）。`import { parsePptx } from './pptx'` Wave 2 前不存在 → 红灯。

**红灯验证：**
```
npm test -- --run src/lib/parsers/ 输出：
 FAIL  src/lib/parsers/docx.test.ts — "Failed to resolve import './docx'"
 FAIL  src/lib/parsers/pdf.test.ts  — "Failed to resolve import './pdf'"
 FAIL  src/lib/parsers/pptx.test.ts — "Failed to resolve import './pptx'"
 FAIL  src/lib/parsers/xlsx.test.ts — "Failed to resolve import './xlsx'"
 Test Files  4 failed (4)
```

### Task 2：NFR-09 路径 D 守门断言

在 `src/store/chat.test.ts` 的 `HIST-01/02` describe 块末尾（路径 C 之后）新增：

```typescript
describe('NFR-09 路径 D：文档附件 derivedText 不进序列化', () => {
  it('文档附件 derivedText 不出现在 serializeForStorage 结果', ...)
  it('kind:document 附件标记不出现在序列化消息内容', ...)
})
```

**守门逻辑：** user message.content 只存原始 prompt，`derivedText` 只活在内存附件 store + `finalPrompt`。断言 `allContent` 不含 `derivedText`、`'kind:document'`、`fileKind`、`sizeBytes`——一旦未来实现误把文档内容写进 messages，测试立即变红。

**绿灯验证：** `npm test -- --run src/store/chat.test.ts` → 20/20 tests pass。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tsc 因 import 不存在模块报 TS2307，阻断 Task 2 chat.test.ts 验证**

- **Found during:** Task 1 实现后验证
- **Issue:** `npm test` 脚本为 `tsc --noEmit && vitest run`，tsc 因 `Cannot find module './docx'` 等报错，阻断所有测试（包括 chat.test.ts）
- **Fix:** 在每个 import 不存在模块的行加 `// @ts-expect-error — Wave 0 stub：实现文件在 Wave 2 之前不存在（TDD 红灯）`；对 `await import('mammoth'/'xlsx'/'pdfjs-dist')` 调用也加相同注释。tsc 通过后，vitest 层面仍保留 "Failed to resolve import" 红灯（红灯语义不变）。
- **Files modified:** 全部 4 个解析器测试文件
- **Commit:** b64c497（随 Task 1 一并提交）

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| 4 个测试文件存在 | `ls src/lib/parsers/*.test.ts` | 4 files |
| 解析器测试红灯 | `npm test -- --run src/lib/parsers/` | 4 FAIL（"Failed to resolve import"）|
| chat.test.ts 全绿 | `npm test -- --run src/store/chat.test.ts` | 20/20 pass |
| 路径 D 关键词 | `grep -c "路径 D\|derivedText" chat.test.ts` | 9 matches |
| pdfjs-dist mock 工厂 | `grep "pdfjs-dist" pdf.test.ts` | 6 matches（包含 vi.mock 工厂）|

## Known Stubs

这些文件**本身就是 stub**（Wave 0 TDD 设计）：
- `src/lib/parsers/docx.test.ts` — 实现文件 `./docx` Wave 2 建立
- `src/lib/parsers/xlsx.test.ts` — 实现文件 `./xlsx` Wave 2 建立
- `src/lib/parsers/pdf.test.ts`  — 实现文件 `./pdf` Wave 2 建立
- `src/lib/parsers/pptx.test.ts` — 实现文件 `./pptx` Wave 2 建立

红灯 → 绿灯 的时机：Plan 17-03（Wave 2 解析器实现）完成后。

## Self-Check: PASSED

- FOUND: src/lib/parsers/docx.test.ts
- FOUND: src/lib/parsers/xlsx.test.ts
- FOUND: src/lib/parsers/pdf.test.ts
- FOUND: src/lib/parsers/pptx.test.ts
- FOUND: commit b64c497
- FOUND: commit fd0c72a
