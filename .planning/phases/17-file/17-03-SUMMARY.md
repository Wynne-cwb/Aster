---
phase: 17-file
plan: 03
subsystem: parsers
tags: [file-parsers, mammoth, sheetjs, jszip, lazy-load, tdd]
dependency_graph:
  requires: [17-01, 17-02]
  provides: [parseDocx, parseXlsx, parsePptx, parseText]
  affects: [src/lib/parsers/]
tech_stack:
  added: []
  patterns: [await-import-lazy-load, regex-xml-extract]
key_files:
  created:
    - src/lib/parsers/docx.ts
    - src/lib/parsers/xlsx.ts
    - src/lib/parsers/pptx.ts
    - src/lib/parsers/text.ts
  modified:
    - src/lib/parsers/docx.test.ts
    - src/lib/parsers/xlsx.test.ts
    - src/lib/parsers/pptx.test.ts
decisions:
  - "pptx 用正则提取 <a:t> 而非 DOMParser：jsdom 测试环境下 application/xml 命名空间解析失败，正则方案在浏览器+jsdom 两套环境均可靠"
metrics:
  duration: ~10min
  completed: 2026-06-02
  tasks_completed: 2
  files_changed: 7
---

# Phase 17 Plan 03: 四个文档解析器实现 Summary

**一句话：** mammoth/SheetJS/jszip+正则/File.text() 四个解析器，await import() 懒加载，9 个测试从红转绿，初始 bundle 0 增量。

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | parseDocx（mammoth）+ parseXlsx（SheetJS）| `839da82` | docx.ts, xlsx.ts, docx.test.ts, xlsx.test.ts |
| 2 | parsePptx（jszip+正则）+ parseText（零库）| `c2c9172` | pptx.ts, text.ts, pptx.test.ts |

## Tests Turned Green

- `src/lib/parsers/docx.test.ts` — 3 tests 转绿（mammoth extractRawText + 超长截断 + 懒加载）
- `src/lib/parsers/xlsx.test.ts` — 3 tests 转绿（多 sheet CSV + 单 sheet + 行数截断）
- `src/lib/parsers/pptx.test.ts` — 3 tests 转绿（数字序排序 + a:t 提取 + 演讲者备注）
- 全量：849 tests passed（从 840 增至 849）

## What Was Built

### docx.ts（D-06）
`parseDocx(file: File): Promise<string>` — mammoth `extractRawText` + `await import('mammoth')` 懒加载。输出纯文本（非 HTML），无需 sanitize。超长 >300000 字符软截断 + 中文提示。

### xlsx.ts（D-07）
`parseXlsx(file: File): Promise<string>` — SheetJS `await import('xlsx')` 懒加载。多 sheet 全转 CSV，每 sheet 前缀 `=== Sheet: X ===`。单 sheet 最大 1000 行截断，全文最大 300000 字符截断。

### pptx.ts（D-09）
`parsePptx(file: File): Promise<string>` — jszip `await import('jszip')` 懒加载解压 pptx。slide 按数字序排序（正则提取数字，parseInt 比较）。`DRAWINGML_T_RE` 正则提取 `<a:t>` 文本节点（方案见下方 Deviations）。演讲者备注（`notesSlides/notesSlideN.xml`）支持，`[Slide N 备注]` 前缀。超长截断。

### text.ts（D-10）
`parseText(file: File): Promise<string>` — `File.text()` 零库。超长截断。

## @ts-expect-error 清理

- `docx.test.ts`：已删除 Wave 0 @ts-expect-error 行 ✓
- `xlsx.test.ts`：已删除 Wave 0 @ts-expect-error 行 ✓
- `pptx.test.ts`：已删除 Wave 0 @ts-expect-error 行 ✓
- `npm run typecheck`（tsc --noEmit）：exit 0 ✓

## Lazy Load 确认

| 文件 | 懒加载模式 | 验证 |
|------|-----------|------|
| docx.ts | `await import('mammoth')` | grep 确认 |
| xlsx.ts | `await import('xlsx')` | grep 确认 |
| pptx.ts | `await import('jszip')` | grep 确认 |
| text.ts | File.text()，无外部依赖 | n/a |

初始 bundle 0 增量（解析库仅在调用时懒加载，Vite 自动分 chunk）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pptx.ts: jszip API 调用方式**
- **Found during:** Task 2 第一次测试运行
- **Issue:** PLAN 代码样本中 `JSZip.loadAsync(arrayBuffer)` 是静态调用，但 jszip 真实 API 和 mock 都要求 `new JSZip().loadAsync(data)` 实例方法
- **Fix:** 改为 `new JSZip().loadAsync(arrayBuffer)`
- **Files modified:** src/lib/parsers/pptx.ts
- **Commit:** c2c9172

**2. [Rule 1 - Bug] pptx.ts: DOMParser 命名空间 XML 在 jsdom 下解析失败**
- **Found during:** Task 2 第二次测试运行（第一次 jszip API 修复后）
- **Issue:** 计划使用 `DOMParser.parseFromString(xml, 'application/xml')` + `querySelectorAll('t')`（RESEARCH 方案）。在真实浏览器下可行，但 jsdom 对 `application/xml` 的命名空间 XML 返回 parsererror，导致 `querySelectorAll('t')` 返回 0 个节点，文本提取失败
- **Fix:** 改用正则 `DRAWINGML_T_RE = /<a:t[^>]*>([^<]*)<\/a:t>/g` 直接从 XML 字符串提取 `<a:t>` 内容。此方案在浏览器和 jsdom 两套环境均可靠，且更简洁（无 DOM 对象创建开销）
- **Impact:** pptx.ts 不再使用 DOMParser（改用纯字符串处理）。文本提取语义等价。RESEARCH 提到的「若遇命名空间误匹配，改用 getElementsByTagNameNS」备注不再适用
- **Files modified:** src/lib/parsers/pptx.ts
- **Commit:** c2c9172

## Threat Flags

无新增网络端点或 trust boundary 穿越。解析器输入来自用户文件（已有 T-17-03-01/02 覆盖），正则方案不引入新安全面。

## Self-Check: PASSED

- [x] src/lib/parsers/docx.ts 存在
- [x] src/lib/parsers/xlsx.ts 存在
- [x] src/lib/parsers/pptx.ts 存在
- [x] src/lib/parsers/text.ts 存在
- [x] commit 839da82 存在（Task 1）
- [x] commit c2c9172 存在（Task 2）
- [x] 全量 849 测试通过
- [x] typecheck exit 0
