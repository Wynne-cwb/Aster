---
phase: 14-mdl-aihubmix-provider-model-casing
plan: 01
subsystem: providers
tags: [typescript, types, vitest, fixtures, image-gen, aihubmix, tdd, wave-0]

# Dependency graph
requires: []
provides:
  - "ImageGenResult 接口契约：{ base64: string; mimeType: string }（裸 base64，D-01）"
  - "ImageProvider.generate(prompt, config, options?) 新签名（三参，D-01）"
  - "三路生图 fixture JSON（doubao/gpt-image-2/gemini，D-14/D-16）"
  - "aihubmix-image.test.ts Wave 0 测试脚手架（5 用例，D-15）"
affects:
  - "14-02（registry 常量更新）"
  - "14-05（aihubmix-image.ts 重写，实现三路解析器让测试变绿）"
  - "Phase 15 VIS（vision client 返回值下游）"
  - "Phase 16 IMG（生图插图工具消费 ImageGenResult）"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Interface-First：类型契约先行，实现在后续 plan（Wave 0 TDD 模式）"
    - "Fixture-based 单测（vi.stubGlobal fetch mock，CI 不打真 API）"
    - "D-16 fixture 截断规范（base64 = 4 字符占位，无真实 apiKey）"

key-files:
  created:
    - src/providers/__fixtures__/doubao-response.json
    - src/providers/__fixtures__/gpt-image-2-response.json
    - src/providers/__fixtures__/gemini-response.json
    - src/providers/aihubmix-image.test.ts
  modified:
    - src/providers/types.ts

key-decisions:
  - "D-01 落地：ImageGenResult = { base64: string; mimeType: string }，裸 base64 + 独立 mimeType，贴合 Office.js 三宿主插图 API"
  - "D-04 确认：裸 base64 而非 data URL；下游预览层自拼 data:${mimeType};base64,${base64}"
  - "usage 字段直接删除（v2.0 已砍全部 cost 功能，Claude's Discretion）"
  - "Wave 0 测试先行（初始红），Plan 05 实现后变绿（D-15 守门策略）"

patterns-established:
  - "Fixture JSON 结构：doubao output 是数组；gpt-image-2 output 是对象（非数组）；gemini 是 JSON 数组含 thoughtSignature + inlineData（D-03 坑体现在 fixture 结构上）"
  - "vi.stubGlobal fetch mock：按 URL 分发对应 fixture（doubao 两次 fetch：predictions + 图片 URL）"

requirements-completed:
  - MDL-01
  - MDL-02

# Metrics
duration: 2min
completed: 2026-06-01
---

# Phase 14 Plan 01: 接口契约 + Wave 0 测试脚手架 Summary

**ImageGenResult 接口改为裸 base64 + mimeType（D-01），三路 fixture JSON + vitest 脚手架建立为 Plan 05 实现守门**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-06-01T07:24:08Z
- **Completed:** 2026-06-01T07:26:00Z
- **Tasks:** 2 / 2
- **Files modified/created:** 5

## Accomplishments

- `ImageGenResult` 接口独立导出：`{ base64: string; mimeType: string }`，裸 base64（不带 `data:` 前缀），删除旧 `b64_json` + `usage` 字段
- `ImageProvider.generate()` 签名改为三参 `(prompt, config, options?)`，返回 `Promise<ImageGenResult>`
- 三个 fixture JSON 创建完毕：doubao（output 数组）、gpt-image-2（output 对象，非数组）、gemini（JSON 数组 + thoughtSignature/inlineData 结构）
- `aihubmix-image.test.ts` 5 个 Wave 0 测试用例（vi.stubGlobal fetch mock，初始为红，Plan 05 后变绿）

## Task Commits

1. **Task 1: 重写 types.ts — ImageGenResult 接口契约（D-01）** - `02873bd` (feat)
2. **Task 2: Wave 0 — 创建三路 fixture 文件 + aihubmix-image.test.ts 脚手架** - `eb95e5d` (test)

## Files Created/Modified

- `src/providers/types.ts` — 新增 `ImageGenResult` 接口，`ImageProvider.generate()` 签名更新，`b64_json`/`usage` 已删
- `src/providers/__fixtures__/doubao-response.json` — doubao 路径 fixture（output 是数组，url 截断占位）
- `src/providers/__fixtures__/gpt-image-2-response.json` — gpt-image-2 路径 fixture（output 是对象，b64_json 4 字符截断）
- `src/providers/__fixtures__/gemini-response.json` — gemini 路径 fixture（JSON 数组，含 thoughtSignature + inlineData）
- `src/providers/aihubmix-image.test.ts` — 三路解析器 5 个测试用例（Wave 0 脚手架，初始红）

## Decisions Made

- `ImageGenResult` 裸 base64 + 独立 `mimeType`（D-01/D-04）：贴合 Office.js 三宿主插图 API（Word `insertInlinePictureFromBase64`、PPT `addImageFromBase64`），下游预览层自拼 `data:${mimeType};base64,${base64}`
- `usage` 字段直接删除（不加 `@deprecated`）：v2.0 已砍全部 cost 功能（memory `project_aster_cost_removed`）
- Wave 0 测试脚手架先于实现：Interface-First 模式，Plan 05 实现后测试变绿

## Deviations from Plan

None — plan 完全按规格执行。测试文件初始为红是预期的 Wave 0 行为（非偏差）。

## Issues Encountered

- tsc 对 `aihubmix-image.test.ts` 报 14 个类型兼容性错误（旧四参签名 vs 新两参调用），这是预期的：`aihubmix-image.ts` 本体在 Plan 05 才重写；tsc 对 types.ts 本身编译通过（无 cascade 错误到其他文件）。

## Known Stubs

无 — 本 plan 为纯接口定义 + 静态 fixture 数据，无运行时逻辑。

## Next Phase Readiness

- Plan 02（registry 常量更新）可立即开始，`types.ts` 接口契约已锁定
- Plan 05（aihubmix-image.ts 重写）需要依赖本 plan 的 fixture + 测试脚手架，届时测试变绿
- Phase 15/16 的 vision/img 工具可安全依赖 `ImageGenResult { base64, mimeType }` 契约

## Self-Check: PASSED

- FOUND: src/providers/types.ts
- FOUND: src/providers/__fixtures__/doubao-response.json
- FOUND: src/providers/__fixtures__/gpt-image-2-response.json
- FOUND: src/providers/__fixtures__/gemini-response.json
- FOUND: src/providers/aihubmix-image.test.ts
- FOUND: .planning/phases/14-mdl-aihubmix-provider-model-casing/14-01-SUMMARY.md
- FOUND: commit 02873bd (feat types.ts)
- FOUND: commit eb95e5d (test fixtures + test file)

---
*Phase: 14-mdl-aihubmix-provider-model-casing*
*Completed: 2026-06-01*
