---
phase: 24-a-p2-bundle
plan: "03"
subsystem: agent/tools/read
tags: [ppt, vision, read-tool, nfr-09, pvq-06, html2canvas]
dependency_graph:
  requires:
    - 24-01 (visual_check_slide stub + visual-check.test.ts skeleton)
    - 24-02 (PVQ06_VISUAL_CHECK_ENABLED flag in visual-check-config.ts)
    - src/providers/aihubmix-vision.ts (AihubmixVisionClient.analyzeImages)
    - src/providers/registry.ts (ProviderRegistry.resolve vision)
  provides:
    - visual_check_slide read tool (stub → real execute())
    - registerPreviewElement() export (for SlidePreviewPanel in 24-04)
    - _resetPreviewElementGetter() export (test utility)
  affects:
    - src/agent/tools/index.ts (ppt case now lists 24 tools)
    - src/agent/tools/read/tools.test.ts (tool-count 22→23→24)
    - src/agent/tools/index.test.ts (tool-count assertion 23→24)
tech_stack:
  added: []
  patterns:
    - dynamic import html2canvas inside execute() body (lazy chunk — bundle safe)
    - module-level mutable getter for previewEl injection (registerPreviewElement pattern)
    - NFR-09: base64 as local variable, consumed by analyzeImages, never in ToolResult.data
    - advisory fallback when previewEl=null (ok:true, no crash)
    - PVQ06_VISUAL_CHECK_ENABLED gate on tool registration (not on PPT_TOOLS set)
key_files:
  created: []
  modified:
    - src/agent/tools/read/visual-check.ts
    - src/agent/tools/read/visual-check.test.ts
    - src/agent/tools/index.ts
    - src/agent/tools/index.test.ts
    - src/agent/tools/read/tools.test.ts
decisions:
  - "不用 wrapReadResult 包装：测试骨架断言 result.data.summary，直接返回 {ok:true,data:{summary:content}}，NFR-09 仍满足（data 里无 base64）"
  - "tool-count 断言更新：两处（index.test.ts + tools.test.ts）从 23→24，描述从 6 read 改为 7 read"
  - "describe.skip 注释调整：移除注释里的 describe.skip 文字防止 grep 误触发"
metrics:
  duration_minutes: 12
  completed_date: "2026-06-03"
  tasks_completed: 2
  files_modified: 5
---

# Phase 24 Plan 03: visual_check_slide 真身实现 + tools/index.ts 注册 Summary

**一句话：** visual_check_slide read tool 从 Wave 0 stub 填为真身（html2canvas 动态 import → AihubmixVisionClient.analyzeImages → 文字 evidence），5 个测试用例解除 skip 并全绿，NFR-09 base64 隔离守门通过，注册进 ppt case（PVQ06_VISUAL_CHECK_ENABLED 开关控制）。

## execute() 5 步全流程

```
PATH A（previewEl 未注册）：
  _previewElementGetter() → null
  → 直接返回 {ok:true, data:{summary:'预览面板未打开，视觉自查跳过...'}}
  （不调 html2canvas，不调 vision API）

PATH B（正常截图路径）：
  1. _previewElementGetter() → HTMLElement
  2. await import('html2canvas')  [动态 import，不进 main chunk]
     html2canvas(el, {scale:2, useCORS:false, allowTaint:false, logging:false, backgroundColor:'#ffffff'})
  3. canvas.toDataURL('image/png').split(',')[1] → pureBase64  [局部变量，NFR-09]
  4. ProviderRegistry.resolve('vision', stub) → cfg → visionConfig
     new AihubmixVisionClient().analyzeImages(FOCUS_PROMPT, [{base64:pureBase64, mimeType:'image/png'}], visionConfig)
     → {content: string}  [文字 evidence]
     pureBase64 生命周期结束，不进 ToolResult
  5. return {ok:true, data:{summary: content}}
     [data 里只有 summary 文字，无 base64/screenshot 字段 — NFR-09 满足]
```

## registerPreviewElement / _resetPreviewElementGetter 共享机制

模块级可设置 getter（module-level mutable getter）设计：
- `let _previewElementGetter: () => HTMLElement | null = () => null;`
- `registerPreviewElement(getter)` — SlidePreviewPanel 挂载时调（24-04 实现）
- `_resetPreviewElementGetter()` — 测试 beforeEach 清理状态用
- 优势：比 event/callback 更简单；全局只有一个预览面板实例

SlidePreviewPanel 挂载时：`registerPreviewElement(() => previewRef.current)`
SlidePreviewPanel 卸载时：`registerPreviewElement(() => null)`

## NFR-09 守门测试绿化确认

用例 ③ 完整断言：
```
JSON.stringify(result.data) 不匹配 /[A-Za-z0-9+/]{100,}/  → PASS（data 只含 summary 短文字）
result.data 不含 'base64' 属性                              → PASS
result.data 不含 'screenshot' 属性                          → PASS
```

`pureBase64` 变量：
- 只在 `html2canvas(...).toDataURL(...).split(',')[1]` 中创建
- 只传入 `analyzeImages([{ base64: pureBase64, mimeType: 'image/png' }], ...)`
- 不出现在 `ToolResult.data` 任何字段中

## visual-check.test.ts 解除 skip 后 5 用例绿化

| # | 用例 | 状态 |
|---|------|------|
| ① | name=visual_check_slide, kind=read | GREEN |
| ② | html2canvas mock 被调用一次 | GREEN |
| ③ | NFR-09 守门：data 无超长 base64 | GREEN |
| ④ | evidence 文字拼入 result.data.summary | GREEN |
| ⑤ | previewEl=null 时 ok:true 含「跳过」 | GREEN |

**测试套件总计：998 passed，0 failed（Node v22.22.1）**

## tools/index.ts 注册位置

```typescript
// Import block (after getShapeImage):
import { visualCheckSlide } from './read/visual-check'; // Phase 24 PVQ-06
import { PVQ06_VISUAL_CHECK_ENABLED } from './visual-check-config'; // Phase 24 降级开关

// ppt case return array:
return [
  listSlides, getSlide, listShapesOnSlide, getShape, checkSlideLayout,
  ...(PVQ06_VISUAL_CHECK_ENABLED ? [visualCheckSlide] : []),  // Phase 24 PVQ-06
  getShapeImage,
  ...pptWriteTools, selectionDetail,
].map((t) => t as ToolDef);
```

- visual_check_slide **不在 PPT_TOOLS Set**（read tool，不需 camelCase 归一化）
- PPT_TOOLS 集合维持原有 14 个工具，不新增
- buildToolsForHost('ppt') 现在返回 24 个工具（7 read + 16 write + 1 selection_detail）

## 工具数量变更追踪

两处 tool-count 断言同步更新（Rule 1 auto-fix，数量不对即是 bug）：
- `src/agent/tools/index.test.ts` L64: `23` → `24`，描述 `6 read` → `7 read`，新增 `visual_check_slide` name 断言
- `src/agent/tools/read/tools.test.ts` L206: `23` → `24`，描述 `6 read` → `7 read`，新增 `visual_check_slide` name 断言

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 不用 wrapReadResult，直接返回 {ok:true, data:{summary:content}}**
- **Found during:** Task 1 implementation
- **Issue:** 计划 action 代码写了 `wrapReadResult({ok:true, data:{summary:content}}, ...)` ，但 `wrapReadResult` 会把 data 做 `JSON.stringify` 后放进 `WrappedReadResult.content`，导致 `result.data` = `{result_type, content, source, truncated}`，没有 `summary` 属性，测试用例 ④ 断言 `result.data.summary` 会失败。测试骨架（24-01 撰写的 spec）是权威，plan 的 action 代码是矛盾的。
- **Fix:** 直接返回 `{ok:true, data:{summary:content}}`，不经 wrapReadResult。NFR-09 仍然满足（data 里只有 summary 文字，无 base64）。
- **Files modified:** src/agent/tools/read/visual-check.ts
- **Commit:** b3f0cef

**2. [Rule 1 - Bug] 两处 tool-count 断言需同步更新（index.test.ts + tools.test.ts 各一处）**
- **Found during:** Task 2 全量测试
- **Issue:** 注册 visualCheckSlide 后 buildToolsForHost('ppt') 返回 24 个工具，但 index.test.ts 和 tools.test.ts 均有 `toHaveLength(23)` 断言，1 passed + 1 failed 后发现有两处需要更新。
- **Fix:** 两处均改为 24，描述从「6 read」改为「7 read」，并各自添加 `visual_check_slide` name 断言。
- **Files modified:** src/agent/tools/index.test.ts, src/agent/tools/read/tools.test.ts
- **Commit:** 7b71bd7

**3. [Rule 2 - TypeScript] 测试文件 result.data 需类型断言**
- **Found during:** Task 1 tsc check
- **Issue:** `ToolResult.data` 是 `unknown` 类型，测试用例 ④⑤ 直接访问 `.summary` 属性引发 TS2339/TS18046 错误。
- **Fix:** 添加 `result.data as { summary?: string }` 类型断言。
- **Files modified:** src/agent/tools/read/visual-check.test.ts
- **Commit:** b3f0cef

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/agent/tools/read/visual-check.ts | FOUND |
| src/agent/tools/read/visual-check.test.ts | FOUND |
| 24-03-SUMMARY.md | FOUND |
| Commit b3f0cef (Task 1) | FOUND |
| Commit 7b71bd7 (Task 2) | FOUND |
| npm test (Node v22.22.1): 998 passed, 0 failed | PASS |
| tsc --noEmit: 0 errors | PASS |
