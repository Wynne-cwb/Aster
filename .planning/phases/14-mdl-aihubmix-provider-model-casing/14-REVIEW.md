---
phase: 14-mdl-aihubmix-provider-model-casing
reviewed: 2026-06-01T10:30:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/agent/tools/dispatch.test.ts
  - src/agent/tools/index.ts
  - src/agent/tools/write/ppt.test.ts
  - src/agent/tools/write/ppt.ts
  - src/providers/__fixtures__/doubao-response.json
  - src/providers/__fixtures__/gemini-response.json
  - src/providers/__fixtures__/gpt-image-2-response.json
  - src/providers/aihubmix-image.test.ts
  - src/providers/aihubmix-image.ts
  - src/providers/aihubmix-vision.ts
  - src/providers/providers.test.ts
  - src/providers/registry.test.ts
  - src/providers/registry.ts
  - src/providers/types.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-06-01T10:30:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 14 引入了三路生图解析器（doubao URL→base64、gpt-image-2 b64_json、gemini inlineData）、PPT 工具入口 camelCase→snake_case 归一化（`normalizeToSnakeCase`），以及 `AIHUBMIX_VISION_MODEL` 更新为 `gpt-5.4`。

安全面：无 API Key 泄露到 fixture、错误 message、request body，硬性约束均符合（T-14-01/T-02-09）。fixture 文件干净，无真实凭证。

主要缺陷集中在：gemini 路径缺少 mimeType 兜底（与 gpt-image-2 路径防御级别不一致）、`parseGeminiChunks` 测试 fixture 未能覆盖「thoughtSignature 单独 part」跳过路径、`StorageQuotaError` 在 `mapAsterCodeToToolErrorCode` 中静默走 default 路径但 dispatch 测试无覆盖、`batch_write` 未在 `PPT_TOOLS` 集合中注册（对 batch_write 传入 PPT camelCase 参数时 normalize 失效）。

---

## Warnings

### WR-01: `parseGeminiChunks` 返回 mimeType 无 fallback，与 gpt-image-2 路径防御不一致

**File:** `src/providers/aihubmix-image.ts:227-232`

**Issue:** `_generateGptImage2` 路径在取 `mimeType` 时有完整兜底（`first.mimeType ?? 'png'` + `normalizeMimeType()`），而 `parseGeminiChunks` 直接返回 `part.inlineData.mimeType` 无任何 fallback。若真实 API 响应省略了 `mimeType` 字段（运行时为 `undefined`），返回值违反 `ImageGenResult.mimeType: string` 合约，下游拼 `data:${mimeType};base64,` 会得到 `data:undefined;base64,…`，导致图片预览损坏。

Spike 011 记录 gemini 返回 `image/jpeg`，但这是「已观察到的值」而非 API 保证字段。

**Fix:**
```typescript
// parseGeminiChunks 返回时加 mimeType 兜底
if (part.inlineData?.data) {
  return {
    base64: part.inlineData.data,
    mimeType: part.inlineData.mimeType ?? 'image/jpeg', // gemini 通常返回 jpeg，fallback 与 spike 一致
  };
}
```

---

### WR-02: `gemini-response.json` fixture 结构与真实 API 不符，导致「跳过 thoughtSignature-only part」路径未被测试

**File:** `src/providers/__fixtures__/gemini-response.json:8-13`

**Issue:** Spike 011 findings.md 明确记录真实 API 返回的 chunk 结构是 `parts: [{ thoughtSignature: "...", inlineData: {...} }]`（两者同 part）。Fixture 与真实结构一致，`parseGeminiChunks` 的注释说「跳过只含 thoughtSignature 的 part」，但真实 API 响应中 thoughtSignature 和 inlineData 始终同 part 出现，「thoughtSignature 单独 part 先于 inlineData part」的场景从未在 spike 中出现。

这导致 `aihubmix-image.test.ts` 中 D-03 测试断言「跳过 thoughtSignature」的注释说明与 fixture 实际覆盖路径不符——测试从未真正覆盖「part.inlineData 为 undefined → 跳过」的逻辑分支。同时 `parseGeminiChunks` 函数注释"跳过只含 thoughtSignature 的 part"是对当前 fixture 结构的误导性描述。

**Fix:** 修正函数注释，准确反映真实响应结构（thoughtSignature 与 inlineData 同 part 存在，代码通过检查 `part.inlineData?.data` 来忽略 thoughtSignature 字段）：
```typescript
// gemini 真实响应：thoughtSignature 与 inlineData 通常在同一 part 中。
// 找到含 inlineData.data 的 part 即返回；text-only part（finishReason chunk）被跳过。
if (part.inlineData?.data) {
```
如需保留「thoughtSignature-only part 跳过」测试守门，在 fixture 中增加第二个 chunk 测试用例：
```json
[
  { "candidates": [{ "content": { "parts": [{ "thoughtSignature": "<sig>" }] } }] },
  { "candidates": [{ "content": { "parts": [{ "inlineData": { "data": "iVBO", "mimeType": "image/jpeg" } }] } }] }
]
```

---

### WR-03: `batch_write` 注册到 PPT host 但不在 `PPT_TOOLS` 集合中，camelCase normalize 失效

**File:** `src/agent/tools/index.ts:27-40` 和 `src/agent/tools/index.ts:284`

**Issue:** `PPT_TOOLS` 集合（12 个工具名）定义了哪些工具在 `dispatchTool` 入口做 camelCase→snake_case 归一化。`buildToolsForHost('ppt')` 把 `batchWrite`（工具名 `batch_write`）注册进 PPT host，但 `batch_write` 不在 `PPT_TOOLS` 集合内。

若 LLM 在 PPT host 发出 `batch_write` 调用并传入 camelCase 参数（`stepIndex` / `toolName` 等），dispatch 层不会 normalize，参数原样传入 `batchWrite.execute`。Word/Excel host 没有此问题（`batch_write` 不依赖 snake_case），但 PPT host 存在隐患，且当 Phase 16 更新批量 PPT 工具时极易踩坑。

注释说明「v2.2 新增 PPT 工具时，在此集合加入工具名」，但对三宿主通用的 `batch_write` 没有说明是否需要加入。

**Fix:** 在 `PPT_TOOLS` 集合中加入 `batch_write`，或在注释中明确说明 `batch_write` 不需要 normalize（需确认 batch_write execute 的参数名是否已是 snake_case）：
```typescript
// 若 batch_write 的参数名不含 camelCase，可不加入，但需注释说明：
// 'batch_write' 不在此集合：其参数（steps/tool_name 等）已是 snake_case，无需归一化。
```

---

### WR-04: `StorageQuotaError`（code `STORAGE_QUOTA`）在 `mapAsterCodeToToolErrorCode` 静默走 default，dispatch 测试无覆盖

**File:** `src/agent/tools/index.ts:132-148`

**Issue:** `errors/index.ts` 定义了 `StorageQuotaError`（code `STORAGE_QUOTA`），且 `isAsterErrorWithMeta` 守卫对其返回 `true`（它具有 `recoverable` + `hint` 字段）。当 `StorageQuotaError` 被工具 execute 抛出时，`dispatchTool` 会走 `sanitizeFromAsterError` 路径，再调用 `mapAsterCodeToToolErrorCode('STORAGE_QUOTA')`。

`STORAGE_QUOTA` 不在 switch 的任何 case 中，静默走 default → `'UNSUPPORTED'`。行为上 `recoverable=false` 是一致的，但结果是用户看到「宿主操作失败」而非存储相关提示，LLM 收到 `UNSUPPORTED` 而非更准确的错误码，无法区分「存储满了」和「操作不支持」。`dispatch.test.ts` 的 it.each 表格未覆盖 `StorageQuotaError` 和 `ImageQuotaError`。

**Fix:** 在 switch 中显式处理，并在 dispatch.test.ts 补测试：
```typescript
case 'STORAGE_QUOTA': return 'HOST_API_FAILED'; // 或新增 'STORAGE_FULL' code（若 Phase 16+ 需要）
case 'IMAGE_QUOTA':   return 'PERMISSION_DENIED'; // 已有 case，但补全注释
```
dispatch.test.ts 补测：
```typescript
['StorageQuotaError', () => new StorageQuotaError(), 'HOST_API_FAILED'],
['ImageQuotaError',   () => new ImageQuotaError('配额'), 'PERMISSION_DENIED'],
```

---

## Info

### IN-01: `gemini-response.json` fixture 中 mimeType 为 `image/png` 但 spike 实测为 `image/jpeg`，注释说明不准确

**File:** `src/providers/aihubmix-image.test.ts:77-78`

**Issue:** 测试注释"真打录制（2026-06-01）：gemini 此次返回 image/png"与 spike 011 findings.md 记录的真实响应（mimeType `image/jpeg`）不一致。fixture 本身可以选任意值，但注释声称「真打录制」让人误以为 fixture 忠实于真实响应。

**Fix:** 修正注释，说明 fixture 使用 png 是为了 CI 简化，实际 API 返回 `image/jpeg`：
```typescript
// fixture 使用 image/png 便于 CI；真实 API（spike 011 实测）返回 image/jpeg
expect(result.mimeType).toBe('image/png');
```

---

### IN-02: `ToolErrorCode` 类型中 `INVALID_PARAM` 未出现在 `mapAsterCodeToToolErrorCode` 返回值中，易误导维护者

**File:** `src/agent/tools/index.ts:63`

**Issue:** `INVALID_PARAM` 作为 `ToolErrorCode` 联合类型成员，由 `word.ts` 等工具的 execute 函数直接构造（不走 `mapAsterCodeToToolErrorCode`），是合法用法。但 `mapAsterCodeToToolErrorCode` 的 switch 永远不会返回 `INVALID_PARAM`，维护者查 switch 时会困惑此 code 来自哪里。

**Fix:** 在 `mapAsterCodeToToolErrorCode` 函数注释中说明 `INVALID_PARAM` 的来源：
```typescript
/**
 * ...
 * 注意：'INVALID_PARAM' code 由工具 execute 直接构造（如 word.ts allowlist 校验），
 * 不通过 AsterError → 此函数映射路径产生。
 */
```

---

### IN-03: `aihubmix-image.ts` doubao URL 构造中 `doubao` 前缀在路径中重复，缺少注释说明这是 aihubmix 的 vendor 命名空间约定

**File:** `src/providers/aihubmix-image.ts:48`

**Issue:** 生成的路径为 `/v1/models/doubao/doubao-seedream-5.0-lite/predictions`——路径中 `doubao` 出现两次（vendor 前缀 + model ID）。这是正确的（spike 011 实测确认），但没有注释说明此 `doubao/` 是 aihubmix 的 vendor 命名空间前缀（并非路径错误）。对比 gpt-image-2 路径 `/v1/models/openai/gpt-image-2/predictions` 有相同模式（vendor=openai, model=gpt-image-2），但在 doubao 处尤其不直观。

**Fix:** 加注释：
```typescript
// aihubmix vendor 命名空间路由：/v1/models/{vendor}/{modelId}/predictions
// doubao vendor prefix + model ID（doubao-seedream-5.0-lite）正确重复，spike 011 实测确认
const url = `${base}/v1/models/doubao/${modelId}/predictions`;
```

---

_Reviewed: 2026-06-01T10:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
