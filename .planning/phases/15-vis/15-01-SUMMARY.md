---
phase: 15-vis
plan: "01"
subsystem: providers
tags: [aihubmix, vision, typescript, vitest, office-addin]

requires:
  - phase: 14-mdl-aihubmix-provider-model-casing
    provides: AihubmixVisionClient（单图）+ AIHUBMIX_VISION_MODEL const + registry.resolve('vision') 路径

provides:
  - VisionImage interface { base64, mimeType } — 多图入参类型（Phase 15 下游 Plan 02/03 引用）
  - AihubmixVisionClient.analyzeImages(userText, images: VisionImage[], config) — 多图方法
  - analyze() 向后兼容（内部委托给 analyzeImages）
  - DocumentAdapter.ReadableQuery 新增 get_shape_image kind（{ kind, focus?: string }）
  - Wave 0 测试脚手架：aihubmix-vision.test.ts（5 用例全 PASS）+ attachments.test.ts（占位）

affects:
  - 15-02（read tool 实现：消费 analyzeImages 签名 + get_shape_image ReadableQuery kind）
  - 15-03（attachments store：attachments.test.ts 解除 skip 后变绿）
  - 15-04（sendMessage 注入：消费 analyzeImages 多图方法）
  - 三宿主 Adapter（PptAdapter/ExcelAdapter/WordAdapter 需实现 get_shape_image case）

tech-stack:
  added: []
  patterns:
    - "analyzeImages 模式：text block 在前、image_url blocks 在后（OpenAI 多图最佳实践）"
    - "向后兼容委托模式：analyze() 内部调 analyzeImages([single image])，调用方零改动"
    - "Wave 0 脚手架模式：describe.skip 占位 + WAVE_0_PLACEHOLDER 确保 CI 不报 0 tests"

key-files:
  created:
    - src/providers/aihubmix-vision.test.ts
    - src/store/attachments.test.ts
  modified:
    - src/providers/aihubmix-vision.ts
    - src/adapters/DocumentAdapter.ts

key-decisions:
  - "analyzeImages 不暴露 focus 参数——focus 由调用方（read tool ToolDef.execute）在 userText 内拼接后传入，签名保持简洁"
  - "attachments.test.ts 用 describe.skip 而非动态 import——避免 tsc Module Not Found 错误（Wave 0 tsc 必须干净）"
  - "VisionImage interface export——下游 Plan 02/03 可直接 import 类型，无需重新声明"
  - "apiKey 仅放 Authorization header，body JSON.stringify 不含 apiKey（T-15-01/T-01-04 安全守门，5 个测试断言覆盖）"

patterns-established:
  - "多图 vision 调用：analyzeImages(userText, VisionImage[], VisionConfig) → VisionResult"
  - "ReadableQuery union 扩展：在末尾追加新 kind，加注 VIS/FILE 需求标注"

requirements-completed:
  - VIS-01
  - VIS-02
  - FILE-06
  - NFR-09

duration: 4min
completed: "2026-06-02"
---

# Phase 15 Plan 01: 类型合约地基 Summary

**VisionImage 多图接口 + analyzeImages() 方法 + DocumentAdapter get_shape_image kind + Wave 0 测试脚手架（5 用例全 PASS）**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-02T01:42:19Z
- **Completed:** 2026-06-02T01:46:14Z
- **Tasks:** 2
- **Files modified:** 4（2 改动 + 2 新建）

## Accomplishments

- `AihubmixVisionClient.analyzeImages()` 多图方法上线：content array 格式正确（text 先、image_url 后），apiKey 仅在 header（T-01-04），stream: false，网络/HTTP 错误正确抛出
- `analyze()` 向后兼容：内部委托给 `analyzeImages`，Phase 14 所有现有调用方零改动
- `DocumentAdapter.ReadableQuery` 追加 `{ kind: 'get_shape_image'; focus?: string }` 变体，下游 Plan 02 三宿主 adapter 可直接实现此 case
- Wave 0 测试脚手架建立：`aihubmix-vision.test.ts` 5 个测试全 PASS，`attachments.test.ts` 占位 (describe.skip) 待 Plan 03 解除

## Task Commits

1. **Task 1: 扩展 AihubmixVisionClient 支持多图** - `455cdae` (feat)
2. **Task 2: 追加 get_shape_image kind + Wave 0 测试脚手架** - `5115193` (feat)

## Files Created/Modified

- `src/providers/aihubmix-vision.ts` — 新增 VisionImage interface + analyzeImages() 多图方法；analyze() 改为委托给 analyzeImages
- `src/adapters/DocumentAdapter.ts` — ReadableQuery union 末尾追加 `get_shape_image` kind（VIS-01）
- `src/providers/aihubmix-vision.test.ts` — 新建 Wave 0 测试（5 用例：多图格式/apiKey T-01-04/stream:false/NetworkError/向后兼容），全 PASS
- `src/store/attachments.test.ts` — 新建 Wave 0 占位脚手架（describe.skip + WAVE_0_PLACEHOLDER），Plan 03 完成后解除 skip

## Decisions Made

1. **analyzeImages 不暴露 focus 参数**：focus 由调用方在 `userText` 内拼接后传入（"请按 focus 描述图片"），analyzeImages 签名保持 `(userText, images, config)`，不引入可选第 4 参数。这符合 PLAN.md 的接口定义，且对 analyze() 向后兼容最友好。

2. **attachments.test.ts 用 describe.skip 而非动态 import**：原计划的动态 import (`import('../store/attachments').catch(...)`) 在 tsc strict 模式下报 `Cannot find module` 错误（tsc 静态分析路径，即使有 `.catch()`）。改用 `describe.skip` 记录待实现的断言，`WAVE_0_PLACEHOLDER` 用例确保 CI 不报 "0 tests"，语义等价但 tsc 干净。

3. **VisionImage interface 导出**：下游 Plan 02（read tool）和 Plan 03（attachments store/sendMessage）均需要此类型，export 避免重复声明。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] attachments.test.ts 动态 import 导致 tsc Module Not Found 错误**
- **Found during:** Task 2（建立 Wave 0 测试脚手架）
- **Issue:** 计划中的 `import('../store/attachments').catch(() => null)` 在 tsc strict 模式下报错（路径不存在），导致 `npm test` 中 tsc 编译阶段失败
- **Fix:** 改用 `describe.skip` + TODO 注释记录待实现断言，`WAVE_0_PLACEHOLDER` 占位用例确保文件有效
- **Files modified:** `src/store/attachments.test.ts`
- **Verification:** `npm test -- --run src/providers/aihubmix-vision.test.ts` 5 PASS；全量 `npm test -- --run` 797 passed
- **Committed in:** `5115193`（Task 2 commit）

---

**Total deviations:** 1 auto-fixed (Rule 1 - tsc 编译阻断)
**Impact on plan:** 测试脚手架语义完整保留（Wave 0 占位 + Plan 03 解除 skip 路径明确）；零功能影响。

## Issues Encountered

无其他阻断性问题。全量测试 797 passed + 5 skipped（Wave 0 describe.skip 用例），3 个尾部 errors 是 retry.test.ts 已知测试框架噪音（项目既有，非本 Plan 引入）。

## Known Stubs

- **src/store/attachments.test.ts（describe.skip 块）**：5 个 skip 用例是完整断言占位（addImages/removeImage/clearImages/no-persist）。待 Plan 03 创建 `attachments.ts` 后解除 skip 并补全断言。这是计划内 Wave 0 设计，不影响 Plan 01 的目标完成。

## Threat Flags

无新增安全面（只改接口类型 + 测试文件）。T-15-01（apiKey 仅 header）已在测试中断言 `JSON.stringify(body)` 不含 apiKey，结构性守门就位。

## Next Phase Readiness

**Plan 02 可立即开始**（read tool 实现），依赖项全部就绪：
- `analyzeImages(userText, VisionImage[], config)` 签名已确定（可 import 并调用）
- `DocumentAdapter.ReadableQuery` 已含 `get_shape_image` kind
- 三宿主 adapter 实现 `case 'get_shape_image'` 时对照此接口即可

**Plan 03 可立即开始**（attachments store），依赖项就绪：
- `VisionImage` 接口已导出（attachments.ts 的 `AttachedImage.mimeType` 字段对齐 vision 格式）
- `attachments.test.ts` Wave 0 脚手架就位，实现完成后直接解除 skip

## Self-Check: PASSED

- FOUND: src/providers/aihubmix-vision.ts
- FOUND: src/adapters/DocumentAdapter.ts
- FOUND: src/providers/aihubmix-vision.test.ts
- FOUND: src/store/attachments.test.ts
- FOUND: .planning/phases/15-vis/15-01-SUMMARY.md
- FOUND commit: 455cdae (Task 1)
- FOUND commit: 5115193 (Task 2)

---
*Phase: 15-vis*
*Completed: 2026-06-02*
