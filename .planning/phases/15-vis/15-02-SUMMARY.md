---
phase: 15-vis
plan: "02"
subsystem: agent-tools, adapters
tags: [vision, read-tool, office-addin, ppt, excel, word, typescript, vitest]

requires:
  - phase: 15-vis
    plan: "01"
    provides: VisionImage interface + analyzeImages() + get_shape_image ReadableQuery kind

provides:
  - getShapeImage ToolDef（第 12 个 read tool）：kind='read', focus 可选参数
  - PptAdapter.read() case 'get_shape_image'：SPIKE 路径 + HOST_API_FAILED 结构化 fallback
  - ExcelAdapter.read() case 'get_shape_image'：getActiveChartOrNullObject + getImage
  - WordAdapter.read() case 'get_shape_image'：inlinePictures + getBase64ImageSrc（两次 sync）
  - get_shape_image 注册到 PPT_TOOLS set + 三宿主 buildToolsForHost

affects:
  - agent loop：get_shape_image 现可被 LLM 调用（三宿主均注册）
  - 15-03（上传图）：PPT_TOOLS + buildToolsForHost 已含 get_shape_image，无需再改 index.ts

tech-stack:
  added: []
  patterns:
    - "SPIKE API 转型模式：getImageAsBase64 用 as unknown as 转型 + try/catch → HOST_API_FAILED fallback"
    - "AsterError 重抛模式：adapter catch 块检查 instanceof AsterError，重抛让 dispatchTool sanitize 处理"
    - "两次 sync 模式（Pitfall 3）：Word getBase64ImageSrc 是 ClientResult，必须 sync 后读 .value"
    - "ProviderRegistry.resolve('vision', stub) 模式：vision case 不用 getDefaultLLM，传 stub 即可"

key-files:
  created:
    - src/agent/tools/read/vision.ts
    - src/agent/tools/read/vision.test.ts
  modified:
    - src/adapters/PptAdapter.ts
    - src/adapters/ExcelAdapter.ts
    - src/adapters/WordAdapter.ts
    - src/agent/tools/index.ts
    - src/agent/tools/read/tools.test.ts
    - src/agent/tools/index.test.ts

key-decisions:
  - "ProviderRegistry.resolve('vision') stub：vision case 内部不调 getDefaultLLM（只需 aihubmix key），故传 () => useProviderStore.getState().providers[0]! 作占位，运行期不会被调用"
  - "PptAdapter SPIKE fallback：catch 非 AsterError 时返回 ok:false HOST_API_FAILED（不 throw），保留结构化错误引导用户改用回形针上传（D-07/D-13/T-15-06）"
  - "ExcelAdapter/WordAdapter：catch 非 AsterError 时 throw new HostApiError（dispatchTool 再 sanitize），与其他 Excel/Word read case 一致"
  - "IMAGE_SHAPE_TYPES 声明在 PptAdapter 模块顶层（Set<string>），与 TEXT_SHAPE_TYPES 对称、互斥，fail-closed 设计"
  - "TDD 流程：先建 vision.test.ts（RED 确认 Cannot find module），再建 vision.ts（GREEN 5 pass）"

patterns-established:
  - "get_shape_image 三宿主 case 各自 try/catch，AsterError 重抛，非 AsterError 分 fallback"
  - "tools/index.ts PPT_TOOLS set 追加守门：每个 PPT 工具必须在此 set 内防 casing 覆辙"

requirements-completed:
  - VIS-01
  - VIS-02

duration: 15min
completed: "2026-06-02"
---

# Phase 15 Plan 02: get_shape_image ToolDef + 三宿主 Adapter Summary

**getShapeImage ToolDef（第 12 个 read tool）+ 三宿主 get_shape_image adapter case + PPT_TOOLS/buildToolsForHost 注册；SPIKE 失败返回 HOST_API_FAILED 结构化错误引导回形针上传**

## Performance

- **Duration:** 15 min
- **Started:** 2026-06-02T01:50:00Z（估）
- **Completed:** 2026-06-02T02:05:00Z（估）
- **Tasks:** 2
- **Files modified:** 8（2 新建 + 6 改动）

## Accomplishments

- `getShapeImage` ToolDef 上线（`src/agent/tools/read/vision.ts`）：第 12 个 read tool，kind='read'，可选 focus 参数，execute 调 adapter.read，结果经 wrapReadResult 返回，base64 不进 tool 层（NFR-09）
- TDD 流程完整：vision.test.ts（5 用例）先 RED 后 GREEN，全部通过
- **PptAdapter** 追加 `case 'get_shape_image'`：
  - 用 `getSelectedShapes()` 取选中 shape（PowerPointApi 1.5），按 type 过滤（IMAGE_SHAPE_TYPES）
  - SPIKE 路径：`shape.getImageAsBase64()`（PowerPoint Preview API，`as unknown as` 转型）
  - SPIKE 失败 fallback：catch 非 AsterError → 返回 `HOST_API_FAILED` 结构化错误引导用户点回形针（D-07/D-13/T-15-06）
  - AsterError（如 KeyInvalidError）重抛 → dispatchTool sanitize 处理
- **ExcelAdapter** 追加 `case 'get_shape_image'`：`getActiveChartOrNullObject()` (ExcelApi 1.9) + `getImage()` (ExcelApi 1.2)，未激活图表返回 NOT_FOUND
- **WordAdapter** 追加 `case 'get_shape_image'`：`inlinePictures.load` + 两次 ctx.sync（Pitfall 3 守门）+ `getBase64ImageSrc()`（WordApi 1.1），无图返回 NOT_FOUND
- `tools/index.ts` 注册：`get_shape_image` 加入 PPT_TOOLS set（D-10 守门）；三宿主 buildToolsForHost 各追加 `getShapeImage`
- tools.test.ts + index.test.ts 工具计数更新（word 16→17，excel 19→20，ppt 18→19）

## Task Commits

1. **Task 1: getShapeImage ToolDef + TDD** - `5be636a` (feat)
2. **Task 2: 三宿主 adapter + tools 注册** - `a5c02dd` (feat)

## Files Created/Modified

- `src/agent/tools/read/vision.ts` — 新建：getShapeImage ToolDef（12th read tool）
- `src/agent/tools/read/vision.test.ts` — 新建：TDD 5 用例（name/kind/execute/humanLabel×2）
- `src/adapters/PptAdapter.ts` — 追加 IMAGE_SHAPE_TYPES + case 'get_shape_image'（SPIKE 路径 + HOST_API_FAILED fallback）；新增 import（AsterError, ProviderRegistry, AihubmixVisionClient, useProviderStore, ImageConfig）
- `src/adapters/ExcelAdapter.ts` — 追加 case 'get_shape_image'（getActiveChartOrNullObject + getImage）；新增同上 import
- `src/adapters/WordAdapter.ts` — 追加 case 'get_shape_image'（inlinePictures + getBase64ImageSrc，两次 sync）；新增同上 import
- `src/agent/tools/index.ts` — 追加 import { getShapeImage }；PPT_TOOLS 加 'get_shape_image'；三宿主 buildToolsForHost 各加 getShapeImage
- `src/agent/tools/read/tools.test.ts` — 工具计数 + 名称断言更新
- `src/agent/tools/index.test.ts` — 工具计数断言更新

## Decisions Made

1. **ProviderRegistry.resolve('vision') stub 参数**：vision case 内部不调 getDefaultLLM（vision 只需 aihubmix key，走 STORAGE_KEYS.KEY_PREFIX + AIHUBMIX_PROVIDER_ID 直接读），故 getDefaultLLM 占位传 `() => useProviderStore.getState().providers[0]!`，运行期不会被调用。避免了在 adapter 引入循环依赖（adapter → agentStore → adapter）。

2. **PptAdapter fallback 不 throw（不同于 Excel/Word）**：SPIKE 路径失败返回 `ok:false HOST_API_FAILED`，而非 throw HostApiError。原因：PPT Preview API spike 失败是预期的"回形针 fallback"场景（D-07），结构化错误让 LLM 知道要引导用户上传；而 Excel/Word 失败属宿主意外错误，沿用 throw 交 dispatchTool sanitize。

3. **IMAGE_SHAPE_TYPES = Set(['Picture', 'Chart'])**：fail-closed 设计，只允许已知含图的 shape 类型取图；未知类型（包括文本框、表格、SmartArt 等）返回 UNSUPPORTED 错误，不冒险访问不支持的 API。

## Deviations from Plan

### Auto-fixed Issues

无 auto-fix。计划中工具计数测试更新（tools.test.ts + index.test.ts）属执行期应然，不计为偏差。

**Total deviations:** 0 — 计划执行完全符合。

## PPT SPIKE 注记

`shape.getImageAsBase64()` 属 PowerPoint Preview API（powerpoint-js-preview requirement set），当前 `@types/office-js` 中无此方法签名。实现使用 `as unknown as { getImageAsBase64: () => { value: string } }` 转型，并注明 SPIKE + Preview API + 失败走 catch fallback（满足 PLAN.md 要求）。

真机验证（Wave 4 UAT）将确认此 API 是否在 Office for Web 可用；若不可用，HOST_API_FAILED fallback 路径自动生效，引导用户改用回形针上传。

## getDefaultLLM 来源说明

三宿主 adapter 均新增 `import { useProviderStore } from '../store/providers'`。
`ProviderRegistry.resolve('vision', () => useProviderStore.getState().providers[0]!)` — vision case 实际不调 getDefaultLLM 函数（只需 aihubmix key），stub 函数永不被执行。
这是比在 adapter 引入 agentStore 或 loop.ts 依赖更干净的方案（避免循环依赖）。

## Known Stubs

无。三宿主 case 均已完整实现（含错误 fallback），vision 调用链已就位。

## Threat Flags

无新增安全面。Plan 已有 threat model 覆盖：
- T-15-03（信息泄露）：catch 重抛 AsterError，陌生错误返回结构化消息不泄露 stack ✓
- T-15-04（base64 不出 adapter）：ToolResult.data 只含 `{ vision_result: string }`，无 base64 字段 ✓
- T-15-06（Tampering）：getImageAsBase64 不存在 → catch → HOST_API_FAILED 结构化错误（不 throw，不泄漏原始错误）✓

## Self-Check: PASSED

- FOUND: src/agent/tools/read/vision.ts
- FOUND: src/agent/tools/read/vision.test.ts
- FOUND: src/adapters/PptAdapter.ts (contains 'get_shape_image' + 'getImageAsBase64' + 'HOST_API_FAILED')
- FOUND: src/adapters/ExcelAdapter.ts (contains 'getActiveChartOrNullObject')
- FOUND: src/adapters/WordAdapter.ts (contains 'getBase64ImageSrc')
- FOUND: src/agent/tools/index.ts (get_shape_image in PPT_TOOLS + 3x buildToolsForHost)
- FOUND commit: 5be636a (Task 1)
- FOUND commit: a5c02dd (Task 2)
- tsc --noEmit: CLEAN
- npm test -- --run: 63 passed, 802 tests passed, 5 skipped, 3 known retry.test.ts noise errors

---
*Phase: 15-vis*
*Completed: 2026-06-02*
