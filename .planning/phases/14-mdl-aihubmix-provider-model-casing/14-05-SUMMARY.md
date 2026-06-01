---
phase: 14-mdl-aihubmix-provider-model-casing
plan: 05
subsystem: providers
tags: [typescript, aihubmix, image-gen, vitest, fixture, tdd, wave-3, MDL-01]

# Dependency graph
requires:
  - "14-01 (ImageGenResult 接口契约 + fixture 结构 + 测试脚手架)"
  - "14-03 (IMAGE_GEN_MODELS / AIHUBMIX_IMAGE_BASE_URL 常量)"
provides:
  - "AihubmixImageClient.generate(prompt, config, options?) 三路解析实现（MDL-01）"
  - "doubao: output[0].url → fetchUrlToBase64 → { base64, mimeType }（D-02 eager 转换）"
  - "gpt-image-2: output.b64_json[0].bytesBase64，mimeType 规范化 png→image/png"
  - "gemini: 遍历 chunks/parts 找 inlineData.data，跳过 thoughtSignature（D-03）"
  - "aihubmix-image.test.ts 从红变绿（5/5 用例通过，MDL-01 CI 守门）"
affects:
  - "Phase 15 VIS（vision read tool 可消费 ImageGenResult 接口）"
  - "Phase 16 IMG（生图插入工具消费 { base64, mimeType }）"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "三路 model 分发（startsWith 前缀判断）：doubao / gpt-image-2 / gemini 各自独立解析路径"
    - "arrayBuffer → Uint8Array → btoa（浏览器标准 base64 编码，CHUNK=8192 防 call stack 溢出）"
    - "gemini multi-chunk 遍历：for chunk / for part，找 part.inlineData?.data（跳过 thoughtSignature）"
    - "normalizeMimeType：'png'→'image/png'，字典映射 + 兜底 image/${raw}"
    - "TDD Wave 0 → Wave 3：测试先行（14-01 红），实现后绿（14-05）"

key-files:
  created: []
  modified:
    - src/providers/aihubmix-image.ts
    - src/providers/__fixtures__/doubao-response.json
    - src/providers/providers.test.ts

key-decisions:
  - "D-01/D-02 落地：provider 只返回裸 base64 + mimeType；doubao URL 在 fetchUrlToBase64 内消费，不外泄"
  - "D-03 落地：gemini 遍历 parts 找 inlineData.data，而非直接取 parts[0]；thoughtSignature 自动跳过"
  - "doubao fixture URL 改为含 doubao 关键词（https://doubao-truncated-for-ci.example.com）：修复 fetch mock URL 分发（D-16 兼容）"
  - "providers.test.ts 旧三个 AihubmixImageClient 测试（gpt-image-1 四参数签名）更新为新接口（Rule 1 自动修复）"
  - "providers.test.ts vision 断言 gpt-4o → gpt-5.4（Plan 03 D-06 遗留断言，Rule 1 自动修复）"

patterns-established:
  - "三路 private method 分发：_generateDoubao / _generateGptImage2 / _generateGemini（可扩展）"
  - "内部 helper 函数三件套：fetchUrlToBase64 / parseGeminiChunks / normalizeMimeType（模块内聚）"
  - "apiKey 安全模式：仅进 Authorization Bearer 或 x-goog-api-key header，三路 body 均不含 apiKey 字段"

requirements-completed:
  - MDL-01
  - MDL-02

# Metrics
duration: 15min
completed: 2026-06-01T08:12:23Z
---

# Phase 14 Plan 05: aihubmix-image.ts 完整重写 — 三路解析器 Summary

**三路解析器实现（doubao URL fetch / gpt-image-2 b64_json / gemini inlineData），两套鉴权，apiKey 仅进 header；aihubmix-image.test.ts 5 用例从红变绿（MDL-01）**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-01T07:57:00Z
- **Completed:** 2026-06-01T08:12:23Z
- **Tasks:** 1 / 1
- **Files modified:** 3

## Accomplishments

- `aihubmix-image.ts` 完整重写为三路解析器（删除旧 gpt-image-1 / `/images/generations` / `b64_json` / `usage` 全部旧字段）
- **doubao 路径**：`generate` → `_generateDoubao` → POST predictions → `output[0].url` → `fetchUrlToBase64(url)` → `{ base64, mimeType }`（D-02 eager 转换）
- **gpt-image-2 路径**：POST predictions → `output.b64_json[0].bytesBase64`（Pitfall 2：output 是对象非数组），mimeType 规范化 `'png'→'image/png'`
- **gemini 路径**：POST `gemini/v1beta/.../streamGenerateContent`，`x-goog-api-key` 鉴权 → JSON 数组多 chunk 遍历 → 找 `inlineData.data` part（D-03 跳过 thoughtSignature）
- `fetchUrlToBase64`：arrayBuffer → Uint8Array → btoa，CHUNK=8192 防 call stack
- `parseGeminiChunks`：遍历 chunks/parts，`part.inlineData?.data` 条件判断
- `normalizeMimeType`：字典映射 + `image/${raw}` 兜底
- `aihubmix-image.test.ts` 5/5 全绿（Wave 0 → Wave 3 完成）
- `providers.test.ts` 更新 4 个失效测试（旧接口 3 个 + vision gpt-4o 1 个）
- 791/791 全量测试通过，0 类型错误

## Task Commits

1. **Task 1: 完整重写 aihubmix-image.ts — 三路解析器 + 两套鉴权（MDL-01）** - `7355ae7` (feat)

## Files Created/Modified

- `src/providers/aihubmix-image.ts` — 完整重写：三路 private method + 三个 helper + ImageProvider 接口实现
- `src/providers/__fixtures__/doubao-response.json` — 修复占位 URL（改为含 doubao 关键词，fix fetch mock 分发）
- `src/providers/providers.test.ts` — 更新 4 个失效断言（旧 generate 签名 × 3 + vision model 名称 × 1）

## Decisions Made

- **D-01/D-02 完全落地**：provider 返回 `{ base64, mimeType }`，裸 base64 无 data: 前缀；doubao URL 在 `fetchUrlToBase64` 内消费后丢弃，不进任何持久化存储
- **doubao fixture URL 设计**：占位 URL 改为 `https://doubao-truncated-for-ci.example.com/image.png`（含 doubao 关键词），确保 fetch mock 中 URL 分发逻辑正确命中图片 URL 分支

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] doubao fixture URL 不含 doubao 关键词导致 fetch mock 分发失败**
- **Found during:** Task 1 — 运行测试时 2/5 失败
- **Issue:** `doubao-response.json` 中 `url: "<truncated-for-ci>"` 不含 `doubao` 关键词；测试 mock 中图片 URL fetch 分支以 `url.includes('doubao')` 判断，占位 URL 不命中，抛 `Unexpected URL in test`
- **Fix:** 将 fixture URL 改为 `https://doubao-truncated-for-ci.example.com/image.png`（语义清晰，含 doubao 关键词）
- **Files modified:** `src/providers/__fixtures__/doubao-response.json`
- **Commit:** 7355ae7

**2. [Rule 1 - Bug] providers.test.ts 旧 AihubmixImageClient 测试使用旧四参数签名（gpt-image-1 形态）**
- **Found during:** Task 1 — tsc 报 9 个类型错误
- **Issue:** `providers.test.ts` 中 3 个测试使用旧 `generate(prompt, size, quality, config)` 签名 + 旧字段 `b64_json`/`usage`；加上 vision 断言 `model='gpt-4o'`（Plan 03 已改为 `gpt-5.4`）
- **Fix:** 更新 4 个失效测试（新 generate 签名 + `base64`/`mimeType` 断言 + vision model 名称）
- **Files modified:** `src/providers/providers.test.ts`
- **Commit:** 7355ae7（同一 commit）

## Known Stubs

无 — 三路解析器完整实现，无 hardcode 空值或占位逻辑。fixture 中截断的 base64（`iVBO`/`/9j/`）是 CI 守门设计（D-16），不是运行时 stub。

## Threat Flags

无新安全面 — 所有改动均在 provider 内部：
- apiKey 仅进 `Authorization: Bearer ${apiKey}` 或 `'x-goog-api-key': apiKey` header（T-14-01 遵守）
- doubao 图片 URL 在 `fetchUrlToBase64` 内作为函数参数使用，函数返回 base64 后 URL 超出作用域（T-14-02 遵守）
- `mapHttpError` 固定字面量 message，不插变量（apiKey 不进 error.message）

## Self-Check: PASSED

- FOUND: src/providers/aihubmix-image.ts
- FOUND: src/providers/__fixtures__/doubao-response.json
- FOUND: src/providers/providers.test.ts
- FOUND: commit 7355ae7
- aihubmix-image.test.ts: 5/5 PASS (green from red)
- All providers tests: 58/58 PASS
- Full test suite: 791/791 PASS
- tsc --noEmit: 0 errors

---
*Phase: 14-mdl-aihubmix-provider-model-casing*
*Completed: 2026-06-01*
