---
phase: 17-file
plan: "04"
subsystem: parsers
tags: [pdf, pdfjs-dist, worker, file-parsing, lazy-load, fallback]
dependency_graph:
  requires: [17-01, 17-02]
  provides: [parsePdf, pdf.worker.min.mjs]
  affects: [src/lib/parsers/pdf.ts, public/pdf.worker.min.mjs]
tech_stack:
  added: [pdfjs-dist 5.7.284 (lazy)]
  patterns: [await-import-lazy-load, worker-public-fallback, pdf-text-extraction]
key_files:
  created:
    - src/lib/parsers/pdf.ts
    - public/pdf.worker.min.mjs
  modified:
    - src/lib/parsers/pdf.test.ts
decisions:
  - "new URL worker 方案在 Vite 7 + pdfjs 懒加载组合下未 emit worker chunk；触发 public/ fallback"
  - "workerSrc 改为静态路径 '/Aster/pdf.worker.min.mjs'（/Aster/ = GitHub Pages base）"
  - "Test 2 mockReturnValueOnce 双次调用 bug 用二次 mock 修复（Rule 1）"
metrics:
  duration: "~10 min"
  completed: "2026-06-03"
  tasks: 2
  files: 3
requirements:
  - FILE-04
---

# Phase 17 Plan 04: PDF 解析器（pdfjs-dist + worker）Summary

**One-liner:** pdfjs-dist 5.7.284 懒加载解析器，public/ worker fallback 替代 new URL emit，扫描件诚实报错，3 测试全绿，78.58 KB ≤ 82KB gate。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | 实现 parsePdf（pdfjs-dist + worker） | 3c6340a | src/lib/parsers/pdf.ts, src/lib/parsers/pdf.test.ts |
| 2 | 验证 worker emit + 执行 public/ fallback | 1ba1561 | src/lib/parsers/pdf.ts（fallback 路径），public/pdf.worker.min.mjs |

## Implementation Summary

### parsePdf（src/lib/parsers/pdf.ts）

- `await import('pdfjs-dist')` 懒加载，Vite 自动分 chunk（初始 0 增量）
- `GlobalWorkerOptions.workerSrc = '/Aster/pdf.worker.min.mjs'`（public/ fallback 路径）
- `getDocument({ data }).promise → numPages 逐页 getPage → getTextContent → items[].str 拼接`
- 扫描件检测（D-08）：`fullText.trim()` 全空 → `throw Error { code: 'PDF_NO_TEXT_LAYER', message: '这个 PDF 没有可提取的文字（可能是扫描件），暂不支持 OCR' }`
- MAX_CHARS = 300_000 软截断（D-04），超出明确提示用户

### Worker 配置：new URL 方案 vs public/ fallback

**验证过程（Task 2）：**

1. 首先尝试 `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href`
2. 运行 `npm run build`：构建成功，但 `ls dist/assets/ | grep worker` 无输出
3. 原因：pdfjs-dist 通过 `await import()` 懒加载，Vite 在静态分析阶段无法确定 `new URL` 的宿主模块路径，未将 worker 作为静态资产 emit

**执行 fallback（RESEARCH Pitfall 1）：**

```bash
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/
# Vite build 自动将 public/ 文件复制到 dist/
```

- `public/pdf.worker.min.mjs` → `dist/pdf.worker.min.mjs`（Vite 标准 public 处理）
- 静态路径 `/Aster/pdf.worker.min.mjs` 正确指向 GitHub Pages 部署路径
- `dist/pdf.worker.min.mjs` 已确认存在（1.2MB，原始大小）

### NFR-10 验证

```
npm run size：78.58 KB gzip ≤ 82 KB gate
```

pdfjs-dist 完全懒加载，初始 bundle 0 增量。

## Test Results

```
src/lib/parsers/pdf.test.ts：3 tests passed
全量：852 tests passed (70 files)
```

- Test 1：正常 PDF → 拼接多页文本（含 '测试文本'）
- Test 2：扫描件（空 items）→ throw Error with code='PDF_NO_TEXT_LAYER'
- Test 3：GlobalWorkerOptions.workerSrc 被赋值（typeof string）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test 2 的 mockReturnValueOnce 双重调用问题**
- **Found during:** Task 1 测试执行
- **Issue:** Wave 0 测试文件 pdf.test.ts 中 Test 2 对同一次 `mockReturnValueOnce` 进行了两次 `parsePdf` 调用（第 55 行和第 56 行），但 `mockReturnValueOnce` 只覆盖一次调用。第一次消耗 mock（扫描件，抛错），第二次用默认 mock（有文本，不抛错），导致 `rejects.toMatchObject` 断言失败。
- **Fix:** 在 Test 2 第二次 `parsePdf` 调用前重新设置一次 `mockReturnValueOnce`，确保两次断言都对应扫描件路径。
- **Files modified:** src/lib/parsers/pdf.test.ts
- **Commit:** 3c6340a

**2. [Plan-driven Deviation] Worker fallback 触发（Task 2 分支 2b）**
- **Found during:** Task 2 build 验证
- **Issue:** `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href` 在 Vite 7 + pdfjs-dist 懒加载（`await import()`）组合下未触发 worker emit（Pitfall 1 预警场景）。
- **Fix:** 执行计划预定的 fallback 方案：worker 复制到 public/，用静态路径 `/Aster/pdf.worker.min.mjs`
- **Files modified:** src/lib/parsers/pdf.ts（workerSrc 改为静态路径），public/pdf.worker.min.mjs（新增）
- **Commit:** 1ba1561
- **Build 验证：** dist/pdf.worker.min.mjs 已确认存在

## Known Stubs

无。pdf.ts 实现完整，无占位符。

## Phase 19 真机验证事项

以下项目需在 Phase 19 UAT 真机环境验证（已拍板延后）：

| 验证项 | 风险点 | fallback 备案 |
|--------|--------|---------------|
| `/Aster/pdf.worker.min.mjs` 在 GitHub Pages + Office for Web iframe CSP 下可加载 | worker 可能被 iframe CSP `worker-src` 限制拦截 | Phase 19 评估：诚实提示该宿主暂不支持 PDF / 降级纯文本提取 |
| pdfjs-dist 在 Office for Web webview 中正常初始化 | webview 可能限制某些 JS API | Phase 19 评估 |

## Threat Flags

无新增威胁面（D-08 扫描件检测、MAX_CHARS 截断、pdfjs 锁版本等均按 threat_model 实施）。

## Self-Check: PASSED

- src/lib/parsers/pdf.ts: FOUND
- public/pdf.worker.min.mjs: FOUND
- dist/pdf.worker.min.mjs: FOUND（npm run build 后）
- commit 3c6340a: FOUND
- commit 1ba1561: FOUND
- npm run size: 78.58 KB ≤ 82KB gate: PASSED
- npm test: 852 passed: PASSED
- typecheck: exit 0: PASSED
