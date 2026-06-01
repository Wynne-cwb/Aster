---
phase: 14-mdl-aihubmix-provider-model-casing
plan: 03
subsystem: providers
tags: [typescript, registry, vitest, image-gen, aihubmix, tdd, wave-2, model-constants]

# Dependency graph
requires:
  - "14-01 (ImageGenResult 接口契约 + fixture 结构)"
provides:
  - "ImageGenModel 接口 + IMAGE_GEN_MODELS 三项列表（doubao/gpt-image-2/gemini，D-05）"
  - "DEFAULT_IMAGE_GEN_MODEL = doubao-seedream-5.0-lite（默认路由入口）"
  - "AIHUBMIX_VISION_MODEL = 'gpt-5.4'（export const，供 vision client 导入，D-06）"
  - "AIHUBMIX_IMAGE_BASE_URL = 'https://aihubmix.com'（生图专用，无 /v1，D-07）"
  - "aihubmix-vision.ts model 字段从硬编码改为引用常量"
affects:
  - "14-05（aihubmix-image.ts 重写：消费 IMAGE_GEN_MODELS/DEFAULT_IMAGE_GEN_MODEL/AIHUBMIX_IMAGE_BASE_URL）"
  - "Phase 15 VIS（vision client 使用 gpt-5.4 model）"
  - "Phase 16 IMG（Settings picker 消费 IMAGE_GEN_MODELS 列表，D-08）"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "registry 作为 model 路由单一真相源：model id + baseURL 从 registry 常量/列表注入，不在 client 硬编码"
    - "export const 常量供跨模块消费（AIHUBMIX_VISION_MODEL 从 vision client 导入）"
    - "IMAGE_GEN_MODELS 列表 + isDefault 标记：列表即路由表，DEFAULT 用 .find() 惰性求值"

key-files:
  modified:
    - src/providers/registry.ts
    - src/providers/aihubmix-vision.ts
    - src/providers/registry.test.ts

key-decisions:
  - "D-05 落地：IMAGE_GEN_MODELS 三项（doubao 默认/gpt-image-2/gemini）+ ImageGenModel 接口，供 Phase 16 picker 直接消费"
  - "D-06 落地：AIHUBMIX_VISION_MODEL = 'gpt-5.4'（推翻 gpt-5.1，比 todos.md 的 gpt-5.2 更新一代，质量 >> 成本）"
  - "D-07 落地：AIHUBMIX_IMAGE_BASE_URL = 'https://aihubmix.com'（无 /v1），生图与 vision 的 base URL 分离，消除 Pitfall 1 双 /v1 风险"
  - "vision client 从 registry 导入 AIHUBMIX_VISION_MODEL 而非本地重复定义，无循环依赖风险（vision → registry → types，无回路）"

patterns-established:
  - "image-gen case: baseURL = AIHUBMIX_IMAGE_BASE_URL，model = DEFAULT_IMAGE_GEN_MODEL.id（列表驱动路由）"
  - "vision case: model = AIHUBMIX_VISION_MODEL（export const，单点修改，不散落硬编码）"

requirements-completed:
  - MDL-02

# Metrics
duration: 5min
completed: 2026-06-01
---

# Phase 14 Plan 03: model 清单重整 + vision 对齐 Summary

**registry.ts 新增 ImageGenModel 三项列表（D-05）+ doubao 默认路由，vision model 对齐 gpt-5.4（D-06），生图 baseURL 分离（D-07），registry.test.ts 全绿（16/16）**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-01T07:39:43Z
- **Completed:** 2026-06-01T07:44:46Z
- **Tasks:** 2 / 2
- **Files modified:** 3

## Accomplishments

- `registry.ts` 常量区重整：`AIHUBMIX_VISION_MODEL` 从 `gpt-5.1` 改为 `gpt-5.4`（export const），删除旧 `AIHUBMIX_IMAGE_MODEL` 单一常量，新增 `AIHUBMIX_IMAGE_BASE_URL = 'https://aihubmix.com'`（生图专用，无 /v1）
- `registry.ts` 新增 `export interface ImageGenModel`（含 id/label/endpointKind/authKind/isDefault）
- `registry.ts` 新增 `export const IMAGE_GEN_MODELS`（三项：doubao 默认/gpt-image-2/gemini）
- `registry.ts` 新增 `export const DEFAULT_IMAGE_GEN_MODEL`（doubao-seedream-5.0-lite）
- `registry.ts` image-gen case 改用 `AIHUBMIX_IMAGE_BASE_URL` + `DEFAULT_IMAGE_GEN_MODEL.id`
- `aihubmix-vision.ts` 导入 `AIHUBMIX_VISION_MODEL` 常量，body 的 model 从硬编码 `'gpt-4o'` 改为引用常量
- `registry.test.ts` 三处过时断言已更新（vision gpt-5.1→gpt-5.4，image-gen model+baseURL 均更新）
- `registry.test.ts` 新增 4 个 IMAGE_GEN_MODELS 用例（列表长度/默认项/DEFAULT.id/字段完整性）
- 16/16 测试全部通过

## Task Commits

1. **Task 1: 重整 registry.ts（D-05/D-06/D-07）** - `596d10b` (feat)
2. **Task 2: vision model 对齐 + registry 测试更新** - `ae0f01b` (feat)

## Files Modified

- `src/providers/registry.ts` — 常量更新 + ImageGenModel 接口 + IMAGE_GEN_MODELS 列表 + DEFAULT_IMAGE_GEN_MODEL + image-gen case 路由改动
- `src/providers/aihubmix-vision.ts` — 导入 AIHUBMIX_VISION_MODEL，body 的 model 改为引用常量（D-06）
- `src/providers/registry.test.ts` — 三处断言更新 + 新增 IMAGE_GEN_MODELS 4 用例（16/16 通过）

## Decisions Made

- **D-05 落地**：IMAGE_GEN_MODELS 三项列表结构（doubao/gpt-image-2/gemini）+ ImageGenModel 接口，为 Phase 16 picker 铺好数据结构
- **D-06 落地**：vision model = gpt-5.4（推翻旧 gpt-5.1，比 todos.md 的 gpt-5.2 更新一代，质量优先原则）
- **D-07 落地**：生图 base host 分离为 `AIHUBMIX_IMAGE_BASE_URL`（无 /v1），消除与 vision 混用的 Pitfall 1 双 /v1 风险
- **vision client 导入 registry 常量**：aihubmix-vision.ts → registry → types，无循环依赖；单点修改 AIHUBMIX_VISION_MODEL 即可同步生效

## Deviations from Plan

None — 计划完全按规格执行。

## Known Stubs

无 — 本 plan 为常量/接口更新，无运行时逻辑 stub。

## Threat Flags

无新安全面 — apiKey 仅在 registry resolve 返回的 ImageConfig.apiKey 字段，由下游 client 注入 Authorization header，不进 body（T-14-01 遵守）。

## Self-Check: PASSED

- FOUND: src/providers/registry.ts
- FOUND: src/providers/aihubmix-vision.ts
- FOUND: src/providers/registry.test.ts
- FOUND: commit 596d10b (feat registry.ts)
- FOUND: commit ae0f01b (feat vision + test)
- Tests: 16/16 PASS

---
*Phase: 14-mdl-aihubmix-provider-model-casing*
*Completed: 2026-06-01*
