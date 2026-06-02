---
phase: 17-file
plan: "02"
subsystem: attachments-store
tags: [file-parsing, store-evolution, backward-compat, tdd]
dependency_graph:
  requires: [17-01]
  provides: [Attachment-discriminated-union, parse-library-deps]
  affects: [src/store/chat.ts, src/components/InputBar.tsx]
tech_stack:
  added:
    - mammoth@^1.12.0 (docx parser, lazy-load)
    - xlsx@0.20.3 (SheetJS from cdn.sheetjs.com tgz, xlsx parser, lazy-load)
    - pdfjs-dist@^5.7.284 (pdf parser, worker separate file, lazy-load)
    - jszip@^3.10.1 (pptx parser via DOMParser, lazy-load)
  patterns:
    - Zustand discriminated union store (AttachedImage | AttachedDocument)
    - Backward-compat deprecated API shim (addImages/clearImages/removeImage)
    - Selector-stable pattern: read s.attachments then filter in component (avoids infinite re-render)
key_files:
  created: []
  modified:
    - src/store/attachments.ts
    - src/store/attachments.test.ts
    - src/store/chat.ts
    - src/store/chat.test.ts
    - src/components/InputBar.tsx
    - src/lib/parsers/docx.test.ts
    - src/lib/parsers/pdf.test.ts
    - src/lib/parsers/xlsx.test.ts
    - src/i18n/locales/zh-CN/messages.po
    - package.json
    - package-lock.json
decisions:
  - "addImages 接受 Omit<AttachedImage,'kind'>[] 为向后兼容参数，内部自动补 kind:'image'"
  - "InputBar 用 s.attachments 然后组件内 filter 而非 selector 内调 getImages()——避免每次 filter 返回新数组导致 Zustand selector 无限重渲染"
  - "messages.po 行号偏移单独 commit（chore 类型，不含逻辑变更）"
metrics:
  duration_minutes: ~20
  completed_date: "2026-06-02"
  tasks_completed: 2
  files_changed: 11
---

# Phase 17 Plan 02: 安装解析库 + Attachment 判别联合 store Summary

**一句话:** 安装 mammoth/xlsx(CDN tgz)/pdfjs-dist/jszip 四个懒加载解析库 + 把 `AttachedImage[]` 演进为 `Attachment` 判别联合 store，向后兼容 Phase 15 全部调用点。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | 安装 4 个解析库 | 90e3f2a | package.json, package-lock.json |
| 2 | 演进 attachments.ts 为 Attachment 判别联合 store（TDD） | 7415737 | attachments.ts, attachments.test.ts, chat.ts, chat.test.ts, InputBar.tsx, parser tests |
| - | Lingui messages.po 行号更新 | 325e224 | messages.po |

## Installed Library Versions

| 库 | 版本 | 安装方式 | 用途 |
|----|------|----------|------|
| mammoth | ^1.12.0 | npm install | docx → 纯文本（≥1.11.0 修 CVE-2025-11849）|
| xlsx | 0.20.3 | cdn.sheetjs.com tgz | xlsx → CSV（非 npm 废弃包）|
| pdfjs-dist | ^5.7.284 | npm install | pdf → 文本（worker 独立文件）|
| jszip | ^3.10.1 | npm install | pptx → 文本（jszip + DOMParser）|

## npm audit Summary

```
5 vulnerabilities (4 moderate, 1 critical)
```

**关键说明：** 全部 5 个漏洞均在 esbuild→vite→vitest 开发工具链（`@vitest/mocker` 依赖旧 vite；esbuild ≤0.24.2 dev server CORS）。
- 与本 plan 新安装的 mammoth/xlsx/pdfjs-dist/jszip **完全无关**
- mammoth ≥1.11.0 已修复 CVE-2025-11849（T-17-02-01 mitigate 通过）
- SheetJS 从 CDN tgz 安装，非废弃 npm 包（T-17-02-02 mitigate 通过）
- fix 需要 `vitest@4.1.8`（breaking change），延后 v2.2 dev 工具链升级时处理

## Store Shape Changes

### Before (Phase 15)

```typescript
export interface AttachedImage {
  id: string; base64: string; mimeType: ...; fileName: string; sizeBytes: number;
}
interface AttachmentState {
  images: AttachedImage[];
  addImages(imgs: AttachedImage[]): void;
  clearImages(): void;
  removeImage(id: string): void;
}
```

### After (Phase 17 Wave 1)

```typescript
export interface AttachedImage { kind: 'image'; id: string; base64: string; mimeType: ...; fileName: string; sizeBytes: number; visionEvidence?: string; }
export interface AttachedDocument { kind: 'document'; id: string; fileName: string; sizeBytes: number; fileKind: FileKind; status: ParseStatus; derivedText?: string; truncated?: boolean; errorMessage?: string; }
export type Attachment = AttachedImage | AttachedDocument;

interface AttachmentState {
  attachments: Attachment[];
  // 新 API
  addAttachment(a: Attachment): void;
  updateAttachment(id: string, patch: Partial<AttachedDocument> | Partial<AttachedImage>): void;
  removeAttachment(id: string): void;
  clearAttachments(): void;
  getImages(): AttachedImage[];
  getDocuments(): AttachedDocument[];
  // 向后兼容（Wave 3 迁移后废弃）
  addImages(imgs: Omit<AttachedImage, 'kind'>[]): void;
  clearImages(): void;
  removeImage(id: string): void;
}
```

## Test Results

```
attachments.test.ts: 13/13 passed (8 新 API + 5 向后兼容)
全套: 840/840 passed
注：4 个 parser 测试文件（docx/xlsx/pdf/pptx）报「模块找不到」——Wave 2 实现文件尚未创建，属于 17-01 预置红灯，正常状态
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 安装库后 parser 测试 `@ts-expect-error` 失效（TS2578）**
- **Found during:** Task 2（运行 TDD 红灯时）
- **Issue:** 17-01 阶段 docx/pdf/xlsx 测试中的 `// @ts-expect-error — xxx 在 Wave 2 安装前不存在` 注释在库安装后变成 Unused directive，触发 tsc TS2578 错误
- **Fix:** 删除 docx.test.ts(1)、pdf.test.ts(2)、xlsx.test.ts(3) 中共 6 个过时注释
- **Files modified:** src/lib/parsers/docx.test.ts, pdf.test.ts, xlsx.test.ts
- **Commit:** 7415737（同 Task 2 主 commit）

**2. [Rule 1 - Bug] InputBar selector 无限重渲染（Maximum update depth exceeded）**
- **Found during:** Task 2 GREEN 阶段，InputBar.test.tsx 14 个用例全崩
- **Issue:** 将 `s.images` 改为 `s.getImages()` 后，每次 render Zustand selector 调 `filter()` 返回新数组引用 → React 认为 state 变化 → 无限重渲染
- **Fix:** 改为 `const attachments = useAttachmentStore((s) => s.attachments)` 然后在组件体内 `attachments.filter((a): a is AttachedImage => a.kind === 'image')`（attachments 数组引用稳定）
- **Files modified:** src/components/InputBar.tsx
- **Commit:** 7415737

**3. [Rule 2 - Missing functionality] Lingui messages.po 行号偏移**
- **Found during:** Task 2 提交后，i18n/coverage.test.ts 报 diff
- **Issue:** InputBar 新增 4 行注释导致所有 Lingui `t` 宏引用行号移位；messages.po 记录的是旧行号
- **Fix:** `npm run extract` 更新行号，单独 commit
- **Files modified:** src/i18n/locales/zh-CN/messages.po
- **Commit:** 325e224

## Threat Surface Scan

无新增网络端点、无新增 auth 路径、无新增文件写操作。

已按 threat register 验证：
- T-17-02-01（mammoth CVE）: mammoth ^1.12.0，audit gate 通过（漏洞非新安装库引入）
- T-17-02-02（SheetJS CDN）: package.json xlsx = cdn.sheetjs.com URL，非 npm registry
- T-17-02-03（persist）: store 无 persist middleware，NFR-09 守门绿
- T-17-02-04（derivedText → localStorage）: 无 persist，路径 D 守门在 17-01 已加（chat.test.ts）

## Self-Check

- [x] src/store/attachments.ts: FOUND
- [x] src/store/attachments.test.ts: FOUND
- [x] .planning/phases/17-file/17-02-SUMMARY.md: FOUND
- [x] Commit 90e3f2a (Task 1): FOUND
- [x] Commit 7415737 (Task 2): FOUND
- [x] Commit 325e224 (messages.po): FOUND
- [x] 840/840 tests pass (4 parser stubs fail as expected — Wave 2)

**Self-Check: PASSED**
