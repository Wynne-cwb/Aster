---
phase: 04-read-tools-agentcontrolbar
plan: "04"
subsystem: adapter
tags: [office-js, powerpoint, read-tools, ppt-adapter, tdd]

requires:
  - phase: 04-02
    provides: ReadableQuery/ReadableResult/ReadToolError 类型契约 + PptAdapter stub read()
  - phase: 04-01
    provides: read-result.ts + circuit-breaker.ts

provides:
  - PptAdapter.read() 5 kind 完整实现（list_slides, get_slide, list_shapes_on_slide, get_shape, selection_detail）
  - PptAdapter.read.test.ts mock 单测套件（22 个测试）

affects:
  - 04-07（PPT read tool ToolDef 注册，依赖 PptAdapter.read 5 kind 可用）
  - Phase 6（PPT write tools；read chain 提供位置信息 left/top/width/height 为「左下角那张图」推断铺路）

tech-stack:
  added: []
  patterns:
    - "PPT 多对象一次 load + 多轮 sync（3 轮：slides → shapes → textRange.text）"
    - "PPT-05 守则：.sort((a,b)=>a.index-b.index) 绕 Web 反序 bug #3618"
    - "list_shapes_on_slide metadata-only（不 load 文本），与 get_slide 区分 document_content vs metadata"
    - "bounds check 越界返 NOT_FOUND，不抛（T-04-12）"
    - "selection_detail 复用现有 getSelection() 语义（0 重复代码）"

key-files:
  created:
    - src/adapters/PptAdapter.read.test.ts
  modified:
    - src/adapters/PptAdapter.ts

key-decisions:
  - "list_slides 分 3 轮 sync（slides items → shapes items → textRange.text），比单轮 sync 代码更清晰；RESEARCH Assumption A4 验证：无批量 title API，逐 slide load shapes[0] 不可避免"
  - "list_shapes_on_slide 不 load 文本（metadata only），与 get_slide（document_content）严格区分；Phase 6 位置推断使用 metadata，避免把正文发 LLM"
  - "get_shape 用 Array.find(sh => sh.id === shapeId) 精确匹配，找不到返 NOT_FOUND；不用 getItemById 避免 Office.js 抛错分支"
  - "selection_detail 直接调 this.getSelection()，0 重复 PowerPoint.run 代码"

patterns-established:
  - "PPT read kind 的 3 轮 sync 模式可复用于其他需要层级 load 的 PPT read 场景"

requirements-completed: [TOOL-01, TOOL-02]

duration: 7min
completed: "2026-05-29"
---

# Phase 4 Plan 04: PptAdapter.read() Summary

**PptAdapter.read() 5 kind 实现：list_slides batch + PPT-05 排序、get_slide/get_shape 越界 NOT_FOUND、list_shapes_on_slide metadata-only（22 mock 单测全绿）**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-29T03:18:59Z
- **Completed:** 2026-05-29T03:25:34Z
- **Tasks:** 1（TDD：RED + GREEN，无需 REFACTOR）
- **Files modified:** 2

## Accomplishments

- `PptAdapter.read()` 替换桩实现，switch 覆盖 5 个 kind
- `list_slides` batch 一次返全部 slide `{index, title}`，PPT-05 守则按 `.index` 升序排列（绕 Web 反序 bug #3618），title 取 shapes[0] textRange.text 首行
- `get_slide` / `list_shapes_on_slide` / `get_shape` 越界/找不到返 `NOT_FOUND`（ok:false，不抛）；`get_shape` 通过 `Array.find` 精确匹配 shapeId
- `list_shapes_on_slide` 严格 metadata-only（含 `left,top,width,height`，不含 text），为 Phase 6 「图片放置推断」铺路
- 22 个 mock 单测全绿；TypeScript 无报错；ESLint 无报错；bundle 77.26 KB（低于 80 KB 预算）

## Task Commits

TDD 两步提交（RED → GREEN）：

1. **RED: test(04-04): add failing tests for PptAdapter.read() 5 kinds** - `1973415`
2. **GREEN: feat(04-04): implement PptAdapter.read() 5 kinds** - `d52fe4c`

## Files Created/Modified

- `src/adapters/PptAdapter.read.test.ts` — 新建：mock Office PowerPoint.run；22 个单测覆盖 5 kind + 越界 NOT_FOUND + index 排序 + HostApiError 抛错路径
- `src/adapters/PptAdapter.ts` — 改动：`read()` 桩替换为真实 switch 实现（+243 行实现，-13 行桩）

## Decisions Made

- `list_slides` 分 3 轮 sync（slides.items → shapes.items → textRange.text），而非尝试单轮 load 所有层级——PPT proxy 必须先 sync 取 items 再对 items 逐个 load 下层，无法跳层。3 轮 sync 可接受（RESEARCH Assumption A4 验证）。
- `list_shapes_on_slide` metadata-only，不 load `textFrame.textRange.text`——严格区分 metadata 与 document_content，遵 T-04-10 防 document_content 不必要暴露。
- `get_shape` 用 `Array.find` 而非 `shapes.getItemById`——避免 Office.js 找不到时抛异常的隐患，改为纯 JS find 判 null 再返 NOT_FOUND，控制流更清晰。

## Deviations from Plan

无 — 计划执行完全按规范，无需自动修正。

## Issues Encountered

无。

## Next Phase Readiness

- PptAdapter.read() 5 kind 已可用，Plan 04-07（PPT read ToolDef 注册）可直接依赖
- `list_shapes_on_slide` 返回 `{left, top, width, height}` 位置信息，Phase 6「图片放置推断」read chain 可用
- 已知遗留（非本 plan 范围）：`src/agent/loop.test.ts` AGENT-02 1 个预存在失败（Phase 3 遗留），retry.test.ts unhandled rejection 是已知跨文件 mock 问题，均不属本 plan 引入

---

## Self-Check

- [x] `src/adapters/PptAdapter.read.test.ts` 存在
- [x] `src/adapters/PptAdapter.ts` 存在
- [x] RED commit 1973415 存在
- [x] GREEN commit d52fe4c 存在
- [x] 22 个测试全绿
- [x] 无新类型错误（tsc --noEmit 通过）
- [x] bundle 77.26 KB（< 80 KB 预算）

## Self-Check: PASSED

*Phase: 04-read-tools-agentcontrolbar*
*Completed: 2026-05-29*
