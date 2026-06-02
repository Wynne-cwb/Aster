---
phase: 16-img-ppt-word
plan: "02"
subsystem: adapter
tags: [ppt-image, word-image, insert-image, office-js, IMG-01, IMG-02, addGeometricShape, insertInlinePictureFromBase64]

requires:
  - phase: 16-img-ppt-word
    plan: "01"
    provides: operationLog.integration.test.ts Phase 16 守门用例（generate_ppt/word_image inverse replay）+ ppt-image/word-image 工具存根
  - phase: 14-mdl-provider
    provides: AihubmixImageClient.generate（返回裸 base64）— 本 plan 不直接调用，由 Plan 16-03 工具层接入

provides:
  - PptAdapter.addImageShape（GA 路线 addGeometricShape('Rectangle') + fill.setImage + 独立 run 回读）
  - WordAdapter.insertBodyImage（body 级 insertInlinePictureFromBase64 + 回读 width/height）
  - src/lib/insertImage.ts 统一插图 helper（PPT/Word 双 host 重载 + 手动 appendOperation）
  - PPT 插图 GA 路线真机 spike 结论（裸 base64 可用 + bug #5022 已规避 + Word body 级可用）

affects: [16-03, 16-04, 16-05, 18-lib]

tech-stack:
  added: []
  patterns:
    - "PPT 插图 GA 路线：addGeometricShape('Rectangle', opts) + shape.fill.setImage(裸base64)，避开 BETA addPicture 与 Web 失效的 setSelectedDataAsync"
    - "PPT 写后回读用独立 PowerPoint.run（隔离 sync 闭包，规避 bug #5022 插图后 sync 卡死）；回读 shape.id 不存在则抛 HostApiError 诚实失败"
    - "Word 强制 body 级 insertInlinePictureFromBase64（'End'），规避 range 级 Web bug #3434"
    - "insertImage helper 函数重载：host 字面量类型决定 adapter 类型与 opts 形状（ppt 必填 slideIndex）"
    - "D-02 解耦：插图脱离 dispatchTool 路径，成功后手动 appendOperation（stepIndex=getOperationsByRun().length 防冲突）"

key-files:
  created:
    - src/lib/insertImage.ts
  modified:
    - src/adapters/PptAdapter.ts
    - src/adapters/WordAdapter.ts

key-decisions:
  - "PPT addImageShape 保持 GA 实现（addGeometricShape + fill.setImage 裸 base64 + 独立 run 回读），真机 spike PASS 无需 fallback"
  - "fill.setImage / insertInlinePictureFromBase64 接受裸 base64（无 data: 前缀）——真机实测确认，helper 透传裸格式不拼前缀（推翻 RESEARCH A5 的 data URL 假设分支）"
  - "bug #5022 由两次独立 PowerPoint.run 规避（第一次创建+填充，第二次回读）——真机实测 setImage sync 不卡死"
  - "reverse.args 全部 Record 对象（snake_case：slide_index/shape_id）；postState.content 用 camelCase（slideIndex/shapeId）与 D-17 analog + integration 守门一致"
  - "错误路径不读 err.message，用字面量（T-16-05 防 apiKey 从错误链泄漏）；PPT/Word 插图失败均返回 code:'HOST_API_FAILED' recoverable:false"
  - "insertImage.ts 当前未被任何模块引用（Plan 16-03 预览卡按钮才接入），不进 main bundle —— 符合 Wave 划分预期"

requirements-completed:
  - IMG-01
  - IMG-02

metrics:
  duration: ~20min
  tasks: 2
  files: 3
  tests: 816 passed / 7 skipped（尾部 3 retry errors 是已知噪音，非失败）
  bundle: main 78.03 KB gzip（≤82KB 门内；insertImage 未引用未进 main）
completed: 2026-06-02
---

# Phase 16 Plan 02: PPT/Word adapter 插图方法 + insertImage helper Summary

**交付 Phase 16 核心工程基础：`PptAdapter.addImageShape`（GA 路线 + 独立 run 回读规避 bug #5022）、`WordAdapter.insertBodyImage`（body 级规避 bug #3434）、`src/lib/insertImage.ts` 统一插图入口（手动 appendOperation，供 Plan 16-03/04/05 + Phase 18 LIB 复用）；真机 spike 锁定裸 base64 + bug 规避有效。**

## 完成内容

### Task 1：PptAdapter.addImageShape + WordAdapter.insertBodyImage（commit 4d369eb）

- **`PptAdapter.addImageShape(slideIndex, base64, opts)`**（PptAdapter.ts L1659）：
  - GA 路线：第一次 `PowerPoint.run` 内 `addGeometricShape('Rectangle', opts)` → `shape.load(['id'])` → sync 取 id → `shape.fill.setImage(base64)` → sync 写入。
  - 写后回读用**第二次独立 `PowerPoint.run`**（隔离 sync 闭包，规避 bug #5022）：load `slide.shapes.items/id` → 检查 `some(s => s.id === newShapeId)`；未找到抛 `HostApiError('PPT 图片插入未生效（回读验证失败），请重试')`（T-16-04 诚实失败）。
  - 错误包装字面量 message（T-16-05），不 interpolate `err.message`。
- **`WordAdapter.insertBodyImage(base64)`**（WordAdapter.ts L1782）：
  - body 级 `ctx.document.body.insertInlinePictureFromBase64(base64, 'End')`（D-07，规避 range 级 bug #3434）→ `picture.load(['width','height'])` → sync 回读尺寸 → 返回 `{ width, height }`。
- 两个方法均**不加入** `DocumentAdapterForReplay` interface：`addImageShape` 的 inverse 复用已有 `deleteShapeById`；`insertBodyImage` 的 inverse 是 `noop_inverse`（operationLog 通用处理）。

### Task 2：src/lib/insertImage.ts 统一插图 helper（commit 04795ea）

- 函数重载：`insertImage('ppt', PptAdapter, base64, mimeType, opts & {slideIndex})` 与 `insertImage('word', WordAdapter, base64, mimeType, opts)`。
- **PPT 分支**：居中默认位置（D-06：720×540pt slide，图 480×360pt，left=120/top=90）→ 调 `addImageShape` → 成功后手动 `appendOperation`（`reverse.tool='delete_shape_by_id'`，args 是 `{slide_index, shape_id}` Record 对象；`postState.kind='ppt_shape_new'`，content `{slideIndex, shapeId}` camelCase）。
- **Word 分支**：调 `insertBodyImage` → 手动 `appendOperation`（`reverse.tool='noop_inverse'`）。
- `stepIndex = getOperationsByRun(runId).length`（Pitfall 5 防 stepIndex 冲突）；`args: {}` 不存 base64（NFR-09）；错误路径不读 `err.message`（T-16-05），统一返回 `code:'HOST_API_FAILED' recoverable:false`。

## 真机 Spike 结论（2026-06-02，用户在 Office for Web 实测）

这是本 plan 的 human-verify checkpoint，用户在真机 devtools console 执行验证代码，结论锁定：

### PPT — GA 路线全过 ✅
- `addGeometricShape('Rectangle')` 创建成功，`shape.id = 2`（id 可回读）。
- `shape.fill.setImage(裸base64)` → `await ctx.sync()` **无卡死** → 确认 **`fill.setImage` 接受裸 base64**（无 `data:` 前缀），且 **bug #5022 已被「独立 PowerPoint.run 回读」规避**。
- 第二个独立 run 回读 `verified = true`（shape 确实在 slide 上）。

### Word — body 级可用 ✅
- `body.insertInlinePictureFromBase64(裸base64, 'End')` → `pic.width/height = 0.75 / 0.75`（1px=0.75pt，非零即成功）→ body 级正常，规避了 range 级 bug #3434。

### 对实现的影响
1. **`addImageShape` 保持当前 GA 实现，无需 fallback**（不进诚实失败分支）。
2. **`insertImage` helper 透传裸 base64**（不拼 `data:image/png;base64,` 前缀）——推翻了 RESEARCH Assumption A5 的「可能需要 data URL」分支与 Open Question 1 的 fallback 拼接逻辑：实测裸格式即可用，PPT/Word 两宿主一致。

## Deviations from Plan

无 —— 计划按原文执行。Task 1/2 实现与 PLAN.md 的 action 描述、acceptance_criteria 完全一致。真机 spike 结论落在计划预设的「裸 base64 / 无卡死 / GA 成功」最优路径上，未触发任何 fallback 分支（PLAN 中预留的 data URL 拼接、回读改属性、诚实失败 fallback 均未启用）。

注：`src/agent/operationLog.integration.test.ts` 的 Phase 16 守门用例（`generate_ppt_image → rolled_back`、`generate_word_image → skipped_error`）在 Plan 16-01 Wave 0 已建好，本 plan 的 adapter + helper 实现使其语义闭环（reverse.args Record 形状、postState.content camelCase 均与守门用例一致）。

## 验证

- `npm test -- --run src/agent/operationLog.integration.test.ts` → 36/36 passed（含 Phase 16 两条守门用例）。
- `npm test -- --run`（全量）→ **816 passed / 7 skipped**；尾部 3 个 retry errors 是已知噪音（project_i18n_extract_and_test_noise），0 真失败。
- `npm run build` → tsc 无 TypeScript 错误，vite build 成功，main chunk 78.03 KB gzip（≤82KB 门内）。
- 真机 spike PPT/Word 均 PASS（见上「真机 Spike 结论」）。

## Acceptance Criteria 核对

| 准则 | 结果 |
|------|------|
| `grep -c "addImageShape" PptAdapter.ts` ≥2 | ✅ 3 |
| `grep -c "insertBodyImage" WordAdapter.ts` ≥2 | ✅ 2 |
| `grep -c "setImage" PptAdapter.ts` ≥1 | ✅ 2 |
| `grep -c "insertInlinePictureFromBase64" WordAdapter.ts` ≥1 | ✅ 3 |
| `grep -c "export async function insertImage"` ≥1 | ✅ 3（重载） |
| `grep -c "appendOperation" insertImage.ts` ≥2 | ✅ 4 |
| `grep -F -c "delete_shape_by_id" insertImage.ts` ≥1 | ✅ 2 |
| `grep -F -c "noop_inverse" insertImage.ts` ≥1 | ✅ 2 |
| `grep -F -c "args: {}" insertImage.ts` ≥1 | ✅ 2 |
| operationLog.integration.test 退出 0 | ✅ |
| build 无 TS error | ✅ |

## 后续 Plan 衔接

- **16-03**：`generate_ppt_image` / `generate_word_image` 工具填充实现（调 AihubmixImageClient）+ 注册进 PPT_TOOLS Set / buildToolsForHost + ImagePreviewCard 预览卡按钮调用本 plan 的 `insertImage`。
- **16-04**：Settings 生图 model picker + `aster:pref:image-gen-model` 持久化。
- **18-lib**：Pexels 图库检索选中插入复用 `insertImage` helper。

## Self-Check: PASSED

- 创建文件全部存在：src/lib/insertImage.ts、src/adapters/PptAdapter.ts、src/adapters/WordAdapter.ts、16-02-SUMMARY.md
- commits 全部存在：4d369eb（Task 1）、04795ea（Task 2）
