---
phase: 14-mdl-aihubmix-provider-model-casing
verified: 2026-06-01T08:45:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
deferred: []
human_verification: []
---

# Phase 14: MDL — AiHubMix Provider 重写 + model 修正 + PPT casing 根治 Verification Report

**Phase Goal:** 重写 aihubmix-image.ts 为三模型三路 response 解析（base64 统一 + 两套鉴权 + gemini 端点族），修正 model 清单，PPT 工具 casing 中央归一化——解锁所有下游 image/vision 工具。
**Verified:** 2026-06-01T08:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                           | Status     | Evidence                                                                                                                                                                                                       |
|----|-------------------------------------------------------------------------------------------------|------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | 三路解析器各自正确解析 response，统一返回裸 base64 + 独立 mimeType（{ base64, mimeType }）      | ✓ VERIFIED | `aihubmix-image.ts` 实现三路 dispatch（doubao/gpt-image/gemini）；5 个 fixture-based 单测全绿；doubao URL→fetch→base64，gpt-image-2 bytesBase64，gemini inlineData.data，均不含 data: 前缀                         |
| 2  | doubao 签名 URL 在 provider 内立即 fetch→base64→丢弃，不外泄                                   | ✓ VERIFIED | `fetchUrlToBase64()` helper 在 `_generateDoubao` 内部即调用；URL 不赋任何外部变量、不返回；注释明确标注 D-02                                                                                                    |
| 3  | gemini 跳过 thoughtSignature，仅取 inlineData.data                                              | ✓ VERIFIED | `parseGeminiChunks()` 仅对 `part.inlineData?.data` 判断；gemini fixture 同时含 thoughtSignature 和 inlineData，测试断言取到 inlineData（iVBO）                                                                   |
| 4  | registry/pricing 区分视觉 model 与三生图 model，默认生图 = doubao-seedream-5.0-lite             | ✓ VERIFIED | `AIHUBMIX_VISION_MODEL='gpt-5.4'`；`IMAGE_GEN_MODELS` 含三项，仅 doubao `isDefault:true`；`DEFAULT_IMAGE_GEN_MODEL.id='doubao-seedream-5.0-lite'`；registry.test.ts 16 个断言全绿                               |
| 5  | PPT 工具 camelCase/snake_case 入参经 dispatch 层中央归一化，execute 只收 snake_case              | ✓ VERIFIED | `normalizeToSnakeCase()` 在 dispatchTool 内对 `PPT_TOOLS` 集合成员执行；ppt.ts 无任何 camelCase 双键容错残留；dispatch.test.ts PPT casing 守门 8 个 it.each 用例全绿；Word 工具 camelCase 不受影响              |
| 6  | 全量 npm test 791/791 通过，bundle ≤ 82KB gzip                                                  | ✓ VERIFIED | `npm test` 输出：60 test files passed，791 tests passed（3 个 retry errors 是已知噪音，非真失败）；`npm run build && npm run size`：75.03 KB ≤ 82 KB gate                                                        |
| 7  | apiKey 仅进 header，不入 body/error.message；CI 永不打真 API（fixture 守门）                    | ✓ VERIFIED | 三路 fetch body 均无 apiKey 字段；NetworkError 消息为固定字面量；aihubmix-image.test.ts 全程 `vi.stubGlobal('fetch', vi.fn())` mock，apiKey 用 `'test-key-not-real'`；fixture 不含任何密钥或完整 base64 原文     |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact                                             | Expected                                   | Status      | Details                                                                                     |
|------------------------------------------------------|--------------------------------------------|-------------|---------------------------------------------------------------------------------------------|
| `src/providers/aihubmix-image.ts`                   | 三路 response 解析器（MDL-01）              | ✓ VERIFIED  | 248 行，实现 doubao/gpt-image-2/gemini 三路，含 `fetchUrlToBase64`、`parseGeminiChunks`、`normalizeMimeType` helper |
| `src/providers/registry.ts`                          | model 清单修正（MDL-02）                    | ✓ VERIFIED  | `AIHUBMIX_VISION_MODEL='gpt-5.4'`，`IMAGE_GEN_MODELS` 三项，`DEFAULT_IMAGE_GEN_MODEL` 导出  |
| `src/providers/types.ts`                             | `ImageGenResult` 裸 base64 契约（D-01/D-04）| ✓ VERIFIED  | `ImageGenResult.base64` JSDoc 注明"裸 base64，不带 data: 前缀（D-01/D-04）"                 |
| `src/providers/aihubmix-vision.ts`                   | vision client 对齐 gpt-5.4（D-06）          | ✓ VERIFIED  | `import { AIHUBMIX_VISION_MODEL } from './registry'`，body 内用 `AIHUBMIX_VISION_MODEL`     |
| `src/agent/tools/index.ts`                           | 中央归一化（D-10/D-13）                     | ✓ VERIFIED  | `normalizeToSnakeCase()` + `PPT_TOOLS` Set（12 工具），dispatchTool 内条件调用              |
| `src/agent/tools/write/ppt.ts`                       | 散落双键容错已删（D-11），schema 统一 snake  | ✓ VERIFIED  | grep 无 `pickSlideIndex/pickShapeId/args.slideIndex??args.slide_index` 残留；所有工具仅读 snake_case |
| `src/providers/__fixtures__/doubao-response.json`    | fixture 守门，CI 不打真 API（D-15/D-16）    | ✓ VERIFIED  | 含 `output[0].url` 占位 URL，不含密钥                                                        |
| `src/providers/__fixtures__/gpt-image-2-response.json`| 同上                                       | ✓ VERIFIED  | 含 `output.b64_json[0].bytesBase64='iVBO'`（4 字符截断），mimeType='png'                    |
| `src/providers/__fixtures__/gemini-response.json`    | 同上，含 thoughtSignature + inlineData      | ✓ VERIFIED  | JSON 数组，同一 part 内同时有 `thoughtSignature` 和 `inlineData.data='iVBO'`                 |
| `src/providers/aihubmix-image.test.ts`               | 三路解析器 fixture-based 单测（MDL-01）     | ✓ VERIFIED  | 5 个测试：doubao/gpt-image-2/gemini 各一路，三路无 data: 前缀断言，T-14-01 apiKey 安全断言   |
| `src/providers/registry.test.ts`                     | vision/image-gen model 断言（MDL-02）       | ✓ VERIFIED  | `IMAGE_GEN_MODELS` 含三项、唯一 default 为 doubao、每项含必要 metadata 字段，16 个测试全绿   |
| `src/agent/tools/dispatch.test.ts`                   | PPT casing 守门（D-12）                     | ✓ VERIFIED  | `describe('dispatchTool — PPT casing 归一化（D-12）')` 块：8 工具 camel/snake 双向测试、Word 不受影响测试、嵌套 position 不变测试 |

---

### Key Link Verification

| From                              | To                                        | Via                                   | Status     | Details                                          |
|-----------------------------------|-------------------------------------------|---------------------------------------|------------|--------------------------------------------------|
| `registry.ts` → `aihubmix-vision.ts` | `AIHUBMIX_VISION_MODEL`                | import                                | ✓ WIRED    | vision.ts: `import { AIHUBMIX_VISION_MODEL }`，body 内直接用 |
| `aihubmix-image.ts`               | `types.ts` `ImageGenResult`              | return `{ base64, mimeType }` 对象    | ✓ WIRED    | 三路方法返回值均符合接口契约                      |
| `dispatchTool` → `normalizeToSnakeCase` | PPT_TOOLS 条件                       | `PPT_TOOLS.has(call.name)` 条件分支   | ✓ WIRED    | 仅 PPT 工具触发，Word/Excel 不受影响（D-13）      |
| `ppt.ts` execute 函数             | 中央 normalize 后的 snake_case args       | dispatchTool 调用链                   | ✓ WIRED    | ppt.ts 全部 execute 函数只读 snake_case，无双键容错 |
| `registry.ts` `resolve('image-gen')` | `DEFAULT_IMAGE_GEN_MODEL.id`           | `model: DEFAULT_IMAGE_GEN_MODEL.id`   | ✓ WIRED    | resolve 返回的 ImageConfig.model 为 doubao-seedream-5.0-lite |

---

### Data-Flow Trace (Level 4)

本阶段产物为 Provider 客户端和 Registry 配置层，无直接 JSX 渲染动态数据。data-flow 在 provider→tool→agent loop 链路，下游 Phase 15/16 才接入 tool。以下仅验证 provider 层数据出口：

| Artifact                   | Data Variable         | Source                              | Produces Real Data          | Status       |
|----------------------------|-----------------------|-------------------------------------|-----------------------------|--------------|
| `aihubmix-image.ts`        | `{ base64, mimeType }` | doubao predictions / gpt-image-2 predictions / gemini streamGenerateContent | 真打三路 HTTP 200（D-14 录制 fixture 确认） | ✓ FLOWING    |
| `registry.ts`              | `ImageConfig.model`   | `DEFAULT_IMAGE_GEN_MODEL.id`（常量） | 静态常量路由，非 DB，符合 no-backend 设计 | ✓ FLOWING    |

---

### Behavioral Spot-Checks

| Behavior                              | Command                                                                          | Result                                          | Status   |
|---------------------------------------|----------------------------------------------------------------------------------|-------------------------------------------------|----------|
| 三路解析器 fixture 单测全绿            | `npx vitest run src/providers/aihubmix-image.test.ts src/providers/registry.test.ts src/agent/tools/dispatch.test.ts` | 3 files, 47 tests passed, 1.58s                | ✓ PASS   |
| 全量测试套件                          | `npm test`                                                                        | 60 files, 791 tests passed（3 retry errors = 已知噪音）| ✓ PASS   |
| bundle size gate                      | `npm run build && npm run size`                                                  | 75.03 KB ≤ 82 KB limit                          | ✓ PASS   |
| 0 净新增运行时依赖                    | `grep "^import" src/providers/aihubmix-image.ts`                                 | 仅 `../lib/sse`、`../errors`、`./types`（项目内部）| ✓ PASS   |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                 | Status      | Evidence                                                                 |
|-------------|-------------|-----------------------------------------------------------------------------|-------------|--------------------------------------------------------------------------|
| MDL-01      | 14-01~14-05  | 三路 response 解析器重写，base64 统一，两套鉴权，gemini 端点族，跳过 thoughtSignature | ✓ SATISFIED | `aihubmix-image.ts` 完整实现；5 个 fixture 单测覆盖三路 + 安全约束        |
| MDL-02      | 14-02~14-03  | model 清单修正（vision gpt-5.4 + 三生图 model + 默认 doubao）                | ✓ SATISFIED | `registry.ts` IMAGE_GEN_MODELS / AIHUBMIX_VISION_MODEL；registry.test.ts 16 测 |
| MDL-03      | 14-04        | PPT casing 中央归一化，删散落双键容错，加守门用例                             | ✓ SATISFIED | `dispatchTool` 中央 normalize；ppt.ts 无容错残留；dispatch.test.ts 11 守门测试 |

所有三个需求（MDL-01/MDL-02/MDL-03）均在 REQUIREMENTS.md Traceability 表中标记为 Complete。

---

### Anti-Patterns Found

无阻断性反模式。以下是扫描结果：

| File                              | Pattern                        | Severity | Impact                    |
|-----------------------------------|--------------------------------|----------|---------------------------|
| `src/providers/retry.test.ts`     | 3 个 timeout retry errors（已知）| Info     | 噪音，非真失败；MEMORY 已记录 |

无 TODO/FIXME 遗留、无空实现、无硬编码 empty 返回、无 apiKey 泄漏到 error 的路径。

---

### Human Verification Required

无需人工验证项。

真打验证（D-14）已在执行阶段完成（三路 HTTP 200，记录于 14-VALIDATION.md 和各 SUMMARY），产物为截断 fixture，CI 永续守门。

---

### Gaps Summary

无 gaps。Phase 14 所有 Success Criteria 均通过代码库证据验证：

1. **SC-1（三路解析 + 裸 base64 契约）**：`aihubmix-image.ts` 三路实现实质，fixture 单测覆盖，真打 HTTP 200 已录制。
2. **SC-2（model 清单）**：`registry.ts` IMAGE_GEN_MODELS 三项、vision gpt-5.4、默认 doubao，registry 测试全绿。
3. **SC-3（PPT casing 归一化 + 守门）**：`index.ts` 中央 normalize，ppt.ts 无双键容错，dispatch.test.ts 守门到位。
4. **SC-4（测试 + bundle）**：791/791 green，75.03 KB ≤ 82 KB。

---

_Verified: 2026-06-01T08:45:00Z_
_Verifier: Claude (gsd-verifier)_
