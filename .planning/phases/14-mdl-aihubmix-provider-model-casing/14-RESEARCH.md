# Phase 14: MDL — AiHubMix Provider 重写 + model 修正 + PPT casing 根治 — Research

**Researched:** 2026-06-01
**Domain:** AiHubMix 生图三路 wire format 解析 / model registry 重构 / PPT tool dispatch 层 casing 归一化
**Confidence:** HIGH（wire format 由 spike 011 真机实测锁定；代码改动范围由完整代码库阅读确认）

---

<user_constraints>
## User Constraints（来自 CONTEXT.md）

### Locked Decisions

**生图 provider 返回契约（MDL-01）**
- D-01: provider 永远只返回裸 base64（不带 `data:...;base64,` 前缀）+ 独立 mimeType。返回形状 `{ base64: string; mimeType: string }`。
- D-02: doubao 签名 URL 立刻 fetch→转 base64→丢弃 URL（TTL 风险，eager 转换最安全）。
- D-03: gpt-image-2/gemini 已直接返回 base64；gemini 解析跳过 `thoughtSignature`（~1.5M 字符），只取 `inlineData.data`。
- D-04（澄清）: 内部统一为裸 base64 + 独立 mimeType，不是 data URL 字符串。

**model 清单结构 + vision id（MDL-02）**
- D-05: 带 metadata 的三生图 model 列表，每项含 id/label/端点形态/鉴权方式/是否默认。默认生图 = `doubao-seedream-5.0-lite`。
- D-06: 默认 vision = `gpt-5.4`（推翻旧常量 `gpt-5.1`）。
- D-07: 生图 model 可用性以 spike 真打为准；doubao 不在 `/v1/models` 清单里是因为走 predictions 独立目录，不代表不可用。
- D-08: 数据结构供 Phase 16 Settings picker 读，但本阶段不做 picker UI。

**PPT casing 中央归一化（MDL-03）**
- D-09: PPT 所有工具 schema 统一成 snake_case。
- D-10: dispatchTool（`src/agent/tools/index.ts`）入口加中央 normalize，把任意 casing 折成 canonical snake_case。execute 函数只读 snake_case。
- D-11: 删除 `ppt.ts` 里所有散落的双键容错（`pickSlideIndex`/`pickShapeId`/`pickSourceIndex`/`pickTargetIndex`）。
- D-12: `src/agent/tools/dispatch.test.ts` 对每个 PPT 工具喂 snake_case 与 camelCase 两种入参，都 assert 命中同一参数。
- D-13（范围）: 范围限 PPT，normalize 因挂在 dispatchTool 天然对 Word/Excel 也生效，但不主动重排 Word/Excel schema。

**三路 smoke test 验证策略**
- D-14: 执行期由 Claude 用 `.env.local` 的 `AIHUBMIX_API_KEY` 一次性真打三路生图，录制响应 fixture。
- D-15: fixture-based 单测当永久 CI 守门；CI 永不打真 API。
- D-16: fixture 不含密钥、不含完整 3MB base64（截断/占位即可，只验解析路径命中正确字段）。

**Claude's Discretion（以下由 Claude 定）**
- 旧 `ImageGenResult.usage` 直接删（cost 功能 v2.0 已砍）。
- gemini JSON 数组多 chunk 的遍历方式（取第一个含 `inlineData` 的 part）。
- doubao fetch 转 base64 的具体实现。
- 三路解析器的代码组织（switch 分发 vs 三个 parser 函数）。
- 中央 normalize 的实现位置/写法（dispatchTool 内联 vs 抽 helper）。
- 错误映射沿用现有 mapHttpError / NetworkError / AsterError 体系。

### Deferred Ideas（OUT OF SCOPE）
- Settings 里「多模态/生图 model 可选」picker UI — 归 Phase 16（IMG-04）。
- doubao 签名 URL 是否可直接交给 Office.js（省 3MB base64）— 本阶段 base64-only。
- gemini `web_search` tool / `imageConfig` 高级参数暴露 — 按需后续。
- Word/Excel schema casing 主动统一 — normalize 已覆盖，但不主动重排。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MDL-01 | 重写 `aihubmix-image.ts`：三路 response 解析器 + 内部统一为裸 base64 + 两套鉴权 + gemini 跳过 thoughtSignature | spike 011 锁定全部字段路径；本文 §三路解析器实现 + §doubao fetch 转 base64 |
| MDL-02 | 修正 model 清单：区分 vision（gpt-5.4）与三生图 model；默认生图 = doubao-seedream-5.0-lite；三路 smoke test 守门 | 本文 §ImageGenModel 列表结构 + §registry 改动 + §Validation Architecture |
| MDL-03 | PPT casing 中央归一化：dispatch 层 normalize + 删散落双键容错 + 守门用例 | 本文 §PPT casing 根治 + §dispatchTool normalize 实现 + §Validation Architecture |
</phase_requirements>

---

## Summary

Phase 14 是纯底层管道工程——不暴露任何新的 UI，不改 agent loop，不新增 tool；工作量集中在三个有边界的代码面：（1）完整重写 `src/providers/aihubmix-image.ts`，把旧 gpt-image-1/OpenAI `/images/generations` 形态换成按 model 分发的三路解析器；（2）重整 `registry.ts` 的 model 常量与 image-gen 路由，铺带 metadata 的生图 model 列表；（3）在 `dispatchTool` 入口加一行 args normalize，删 `ppt.ts` 里的散落双键容错，并在 `dispatch.test.ts` 补 PPT casing 守门用例。

所有 wire format 和字段路径已由 spike 011 真机实测锁定（2026-06-01），本阶段实现可以直接照单抄，**无需重跑任何真实 API 调用**（真打三路 smoke + 录 fixture 是执行期一次性任务，不是研究期任务）。

**一句话行动指令：** 按 spike 011 字段路径写三路解析函数，把旧 `ImageGenResult.b64_json/usage` 接口换成 `{ base64, mimeType }`，在 dispatchTool 入口加 camel→snake normalize helper，删 ppt.ts 双键容错，补守门用例，录 fixture 后挂 fixture-based CI 测试。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 三路生图 response 解析 | Provider 层（aihubmix-image.ts） | — | 纯 fetch + JSON 解析，与 Office.js / UI 完全无关 |
| doubao URL→base64 fetch 转换 | Provider 层（aihubmix-image.ts 内） | — | 转换在 provider 内完成，调用方只见 base64 |
| model 路由 + 鉴权 header 选择 | Provider 层（registry.ts + aihubmix-image.ts） | — | 按 model id 分发逻辑天然在 provider 层 |
| model 常量 + metadata 列表 | Registry（registry.ts） | — | 单一真相源，供 resolver 路由 + Phase 16 picker 消费 |
| vision model 对齐 | Vision 客户端（aihubmix-vision.ts）+ Registry | — | 改 body 内硬编码 model 字段 + 常量同步 |
| PPT tool args casing 归一化 | Agent dispatch 层（tools/index.ts dispatchTool） | — | 唯一执行入口，天然的横切位置；所有三宿主共用 |
| PPT tool schema snake_case 统一 | Tool 定义层（tools/write/ppt.ts） | — | schema 是给 LLM 看的，需统一成一种命名 |
| Casing 守门用例 | Test 层（dispatch.test.ts） | — | 覆盖 dispatch 边界，防回归 |

---

## Standard Stack

本阶段是**纯代码重构，0 净新增运行时依赖**。所有改动在已有文件内，用 native fetch，沿用现有 `mapHttpError`/`NetworkError`/AsterError 体系。

[VERIFIED: 代码库阅读]

| 技术 | 版本 | 用途 | 确认状态 |
|------|------|------|----------|
| Native `fetch` + `Response` | 浏览器内置 | doubao URL fetch 转 base64 + 三路 HTTP 请求 | VERIFIED: 现有 image/vision client 已用此模式 |
| `mapHttpError` / `NetworkError` | 现有 `src/lib/sse.ts` | 非 200 → AsterError / fetch throw | VERIFIED: aihubmix-vision.ts 已用 |
| `vitest@^2.0.0` | `^2.0.0` | fixture-based 单测 / dispatch 守门用例 | VERIFIED: package.json devDependencies |

**无需安装任何新包。**

---

## Architecture Patterns

### System Architecture Diagram

生图调用路径（Phase 14 改动后）：

```
调用方 (Phase 16 insert tool / smoke test)
        │
        │ generateImage(prompt, modelId, config)
        ▼
  AihubmixImageClient.generate()
        │
        ├─ model 是 doubao 系? ──→ buildDoubaoRequest()
        │      POST /v1/models/doubao/.../predictions  Bearer header
        │      response: { output: [{url}] }
        │      └─→ fetchUrlToBase64(url)  ──→ { base64, mimeType:'image/png' }
        │
        ├─ model 是 openai 系? ──→ buildGptImage2Request()
        │      POST /v1/models/openai/gpt-image-2/predictions  Bearer header
        │      response: { output: { b64_json:[{bytesBase64, mimeType}] } }
        │      └─→ { base64: bytesBase64, mimeType:'image/png' }
        │
        └─ model 是 gemini 系? ──→ buildGeminiRequest()
               POST /gemini/v1beta/models/gemini-.../streamGenerateContent  x-goog-api-key header
               response: JSON数组  candidates[0].content.parts[].inlineData
               └─→ 遍历 parts，跳过 thoughtSignature，取 inlineData.data
               └─→ { base64: inlineData.data, mimeType: inlineData.mimeType }
                                   │
                                   ▼
                         返回 { base64: string, mimeType: string }
                         （裸 base64，无 data: 前缀）

dispatchTool 入口（tools/index.ts）
        │ call.arguments（LLM 产生，casing 不确定）
        ▼
  normalizePptArgs(args)   ← Phase 14 新增
        │ camelCase key → snake_case key
        ▼
  def.execute(normalizedArgs, ctx)
        │ 只读 snake_case
        ▼
  PptAdapter 方法
```

### 推荐项目结构（改动文件清单）

```
src/
├── providers/
│   ├── aihubmix-image.ts   ← 完整重写（MDL-01）
│   ├── aihubmix-vision.ts  ← 小改：model 硬编码 gpt-4o → gpt-5.4（MDL-02）
│   ├── registry.ts         ← 改常量 + 加 IMAGE_GEN_MODELS 列表（MDL-02）
│   ├── types.ts            ← 改 ImageProvider 接口返回形状（MDL-01）
│   └── registry.test.ts    ← 更新断言（gpt-5.1→gpt-5.4，image-gen 默认 model）
│
├── agent/tools/
│   ├── index.ts            ← 加 normalizePptArgs + 在 dispatchTool 调用（MDL-03）
│   ├── write/ppt.ts        ← 删 pick* helpers + 统一 camel schema → snake（MDL-03）
│   └── dispatch.test.ts    ← 新增 PPT casing 守门用例（MDL-03）
│
└── providers/__fixtures__/  ← 新建目录，存三路 response fixture（MDL-01 执行期）
    ├── doubao-response.json
    ├── gpt-image-2-response.json
    └── gemini-response.json
```

---

## 三路解析器详细实现指南

### 1. 新接口定义（`types.ts` 改动）

当前 `ImageProvider.generate()` 返回 `{ b64_json: string; usage?: ... }`，要改成：

```typescript
// src/providers/types.ts — 修改后
export interface ImageGenResult {
  base64: string;       // 裸 base64，不带 data: 前缀（D-01）
  mimeType: string;     // 'image/png' | 'image/jpeg' | string
}

export interface ImageProvider {
  generate(
    prompt: string,
    config: ImageConfig,
    options?: ImageGenOptions,
  ): Promise<ImageGenResult>;
}

export interface ImageGenOptions {
  size?: string;
  quality?: 'high' | 'medium' | 'low' | 'auto';
}
```

`usage` 字段直接删除（D-11 Claude's Discretion：cost v2.0 已砍）。[VERIFIED: CLAUDE.md §project_aster_cost_removed]

### 2. ImageGenModel 列表（`registry.ts` 新增）

```typescript
// src/providers/registry.ts — 新增

export interface ImageGenModel {
  id: string;
  label: string;
  endpointKind: 'predictions' | 'gemini';   // 决定 URL 模板和 body 结构
  authKind: 'bearer' | 'goog-api-key';      // 决定 Authorization header 形式
  isDefault: boolean;
}

export const IMAGE_GEN_MODELS: ImageGenModel[] = [
  {
    id: 'doubao-seedream-5.0-lite',
    label: 'Doubao SeedDream 5.0 Lite（快速默认）',
    endpointKind: 'predictions',
    authKind: 'bearer',
    isDefault: true,
  },
  {
    id: 'gpt-image-2',
    label: 'GPT-Image-2（高质量）',
    endpointKind: 'predictions',
    authKind: 'bearer',
    isDefault: false,
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    label: 'Gemini 3.1 Flash Image Preview',
    endpointKind: 'gemini',
    authKind: 'goog-api-key',
    isDefault: false,
  },
];

export const DEFAULT_IMAGE_GEN_MODEL =
  IMAGE_GEN_MODELS.find((m) => m.isDefault)!;

// 推翻旧常量
// 旧: const AIHUBMIX_VISION_MODEL = 'gpt-5.1'
// 新:
const AIHUBMIX_VISION_MODEL = 'gpt-5.4';   // D-06，gpt-5.4 更强且已 /v1/models 确认

// 旧: const AIHUBMIX_IMAGE_MODEL = 'gpt-image-2' (单一常量)
// 新: 改用 IMAGE_GEN_MODELS 列表，resolve('image-gen') 返回 DEFAULT_IMAGE_GEN_MODEL.id
```

**D-07 注意事项：** `doubao-seedream-5.0-lite` 不在 `/v1/models` 清单里，这是预期行为——它走 predictions 独立目录，spike 011 真打拿到 HTTP 200，可用。[VERIFIED: spike 011 findings.md]

### 3. registry.ts 的 `image-gen` case 改动

当前 `image-gen` case 直接硬编码 `AIHUBMIX_IMAGE_MODEL = 'gpt-image-2'`。Phase 14 改为：

```typescript
case 'image-gen': {
  const apiKey = storage.get<string>(STORAGE_KEYS.KEY_PREFIX + AIHUBMIX_PROVIDER_ID);
  if (!apiKey) throw new KeyInvalidError('aihubmix Key 未配置');
  return {
    providerId: `${AIHUBMIX_PROVIDER_ID}-image`,
    baseURL: AIHUBMIX_BASE_URL,    // 注意：仍是 https://aihubmix.com（非 /v1 子路径）
    apiKey,
    model: DEFAULT_IMAGE_GEN_MODEL.id,   // 'doubao-seedream-5.0-lite'
  } satisfies ImageConfig;
}
```

**baseURL 警告：** spike 011 确认 base host 是 `https://aihubmix.com`（无 `/v1` 后缀）。现有常量 `AIHUBMIX_BASE_URL = 'https://api.aihubmix.com/v1'` 是旧值且带子路径，会导致 URL 拼接错误。需新增：

```typescript
const AIHUBMIX_IMAGE_BASE_URL = 'https://aihubmix.com';  // 生图专用（无 /v1 后缀）
// 旧 AIHUBMIX_BASE_URL 保留给 vision（chat/completions 仍走 api.aihubmix.com/v1）
```

[VERIFIED: spike 011 findings.md — "Base host: https://aihubmix.com"]

### 4. aihubmix-image.ts 完整重写

#### 4a. URL 路径模板（按 model 分发）

```
doubao:  POST https://aihubmix.com/v1/models/doubao/{modelId}/predictions
gpt-image-2: POST https://aihubmix.com/v1/models/openai/gpt-image-2/predictions
gemini:  POST https://aihubmix.com/gemini/v1beta/models/{modelId}:streamGenerateContent
```

[VERIFIED: spike 011 findings.md]

#### 4b. 鉴权 header（两套）

```typescript
// Bearer（doubao / gpt-image-2）
headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }

// x-goog-api-key（gemini）
headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }
```

[VERIFIED: spike 011 findings.md]

#### 4c. 请求体结构（三套）

```typescript
// doubao
body: JSON.stringify({
  input: {
    prompt,
    size: '2K',
    sequential_image_generation: 'disabled',
    stream: false,
    response_format: 'url',
    watermark: true,
  }
})

// gpt-image-2
body: JSON.stringify({
  input: {
    prompt,
    size: '1024x1024',
    n: 1,
    quality: 'high',
    moderation: 'low',
    background: 'auto',
  }
})

// gemini
body: JSON.stringify({
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: {
    responseModalities: ['TEXT', 'IMAGE'],
    imageConfig: { aspectRatio: '1:1', imageSize: '1k' },
  }
})
```

[VERIFIED: spike 011 findings.md]

#### 4d. Response 解析器（三套字段路径）

```
doubao:      body.output[0].url            → string (签名 URL)
gpt-image-2: body.output.b64_json[0].bytesBase64  → string (base64 PNG)
             body.output.b64_json[0].mimeType      → 'png'（须转 'image/png'）
gemini:      body[N].candidates[0].content.parts[M].inlineData.data   → string (base64 jpeg)
             body[N].candidates[0].content.parts[M].inlineData.mimeType → 'image/jpeg'
             ⚠ 跳过含 thoughtSignature 的 part（~1.5M 字符，D-03）
```

[VERIFIED: spike 011 findings.md — 真机实测响应结构]

#### 4e. doubao URL → base64 转换（D-02，Claude's Discretion 实现）

推荐用 `arrayBuffer` 路径（比 `FileReader` 简洁，浏览器完全支持）：

```typescript
// [ASSUMED] 此实现 Claude 自定，无需用户确认（D-02 只要求 eager 转换）
async function fetchUrlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  let resp: Response;
  try {
    resp = await fetch(url);
  } catch {
    throw new NetworkError('doubao 图片 URL fetch 失败');
  }
  if (!resp.ok) throw new NetworkError(`doubao 图片 URL 获取失败（${resp.status}）`);

  const contentType = resp.headers.get('content-type') ?? 'image/png';
  const mimeType = contentType.split(';')[0].trim();
  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // btoa 只接受 Latin-1，需逐字节转字符串
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return { base64: btoa(binary), mimeType };
}
```

**注意：** doubao 的图片 URL 是 TOS (ByteDance) 签名 URL，不存在跨域问题（直接 fetch，非浏览器→浏览器跨站）。[ASSUMED: 基于 TOS signed URL 行为推断，spike 011 拿到 URL 但未测试从浏览器 fetch 该 URL 的 CORS 情况]

**风险缓解：** 如果 TOS URL 有 CORS 限制（该 URL 的响应头缺 `Access-Control-Allow-Origin`），浏览器侧 fetch 会失败。预防措施：捕获 `NetworkError` 并在 error message 中提示「图片 URL 下载失败，可能 CORS 限制」，让用户切换到 gpt-image-2 或 gemini（两者直接返回 base64，无 CORS 问题）。

#### 4f. gemini 多 chunk 遍历（D-03，Claude's Discretion 实现）

Gemini 响应是 JSON 数组（多个 chunk），图片在其中一个 chunk 的某个 part 里：

```typescript
// [ASSUMED] 此 Claude 自定
function parseGeminiResponse(chunks: unknown[]): { base64: string; mimeType: string } {
  for (const chunk of chunks as Array<{ candidates?: Array<{ content?: { parts?: Array<{
    inlineData?: { data: string; mimeType: string };
    thoughtSignature?: string;
  }> } }> }>) {
    const parts = chunk.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      // 跳过只有 thoughtSignature 的 part（D-03）
      if (part.inlineData) {
        return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType };
      }
    }
  }
  throw new NetworkError('gemini 响应未找到 inlineData 图片数据');
}
```

[VERIFIED: spike 011 findings.md — 响应是 JSON 数组；thoughtSignature 在同一 part 里]

#### 4g. 完整函数骨架

```typescript
// src/providers/aihubmix-image.ts — 重写后骨架（Source: spike 011 + 现有模式）
import { mapHttpError } from '../lib/sse';
import { NetworkError } from '../errors';
import type { ImageConfig } from './types';

export interface ImageGenResult {
  base64: string;    // 裸 base64，不带 data: 前缀（D-01）
  mimeType: string;  // 'image/png' | 'image/jpeg' | string
}

export class AihubmixImageClient {
  async generate(
    prompt: string,
    config: ImageConfig,   // config.model 决定走哪条路
    options?: { size?: string; quality?: 'high' | 'medium' | 'low' | 'auto' },
  ): Promise<ImageGenResult> {
    const modelId = config.model;  // e.g. 'doubao-seedream-5.0-lite'

    if (modelId.startsWith('doubao')) {
      return this._generateDoubao(prompt, config.baseURL, config.apiKey, options);
    }
    if (modelId.startsWith('gpt-image')) {
      return this._generateGptImage2(prompt, config.baseURL, config.apiKey, options);
    }
    if (modelId.startsWith('gemini')) {
      return this._generateGemini(prompt, modelId, config.baseURL, config.apiKey);
    }
    throw new NetworkError(`未知生图 model: ${modelId}`);
  }

  private async _generateDoubao(...): Promise<ImageGenResult> { ... }
  private async _generateGptImage2(...): Promise<ImageGenResult> { ... }
  private async _generateGemini(...): Promise<ImageGenResult> { ... }
}
```

**安全约束（T-01-04）：** apiKey 仅放 `Authorization` / `x-goog-api-key` header，不进 request body、不进 error.message。[VERIFIED: 现有代码约束，CLAUDE.md §Security]

---

## PPT Casing 根治实现指南

### 现状摸底（VERIFIED: 代码库阅读）

`src/agent/tools/write/ppt.ts` 中存在两种命名风格混用的问题：

**snake_case schema（正确，执行层直接读）：**
- `set_shape_property`：`slide_index`, `shape_id`, `fill_color`, `line_color`
- `move_shape`：`slide_index`, `shape_id`, `left`, `top`
- `set_shape_text`：`slide_index`, `shape_id`, `text`

**camelCase schema（需改）：**
- `set_shape_text_font`：`slideIndex`, `shapeId`, `font`
- `add_shape`：`slideIndex`, `shapeType`, `position`
- `set_shape_text_alignment`：`slideIndex`, `shapeId`, `alignment`
- `delete_shape`：`slideIndex`, `shapeId`
- `rotate_shape`：`slideIndex`, `shapeId`, `rotation`
- `manage_slides`：`operation`, `slideIndex`
- `set_slide_background`：`slideIndex`, `color`
- `copy_slide`：`sourceIndex`, `targetIndex`

**散落双键容错 helper（删除目标，D-11）：**
```typescript
function pickSlideIndex(args) { return (args.slideIndex ?? args.slide_index) as number; }
function pickShapeId(args) { return (args.shapeId ?? args.shape_id) as string; }
function pickSourceIndex(args) { return (args.sourceIndex ?? args.source_index) as number; }
function pickTargetIndex(args) { return (args.targetIndex ?? args.target_index) as number | undefined; }
```

这 4 个 helper 调用点分布在 `setShapeTextFontTool`、`addShapeTool`、`setShapeTextAlignmentTool`、`deleteShapeTool`、`rotateShapeTool`、`manageSlidesTool`、`setSlideBackgroundTool`、`copySlideTool` 的 `humanLabel` 和 `execute` 中，共约 20 处。

### D-10: dispatchTool 中央 normalize 实现

**位置：** `src/agent/tools/index.ts`，在 `def.execute(call.arguments, ctx)` 调用前。

**实现策略（Claude's Discretion）：** 内联一个小 helper，仅在 ppt host 相关工具时触发，对 args 做一次 key 映射。

```typescript
// 推荐实现（内联于 dispatchTool，或抽为 tools/index.ts 内部 helper）
// [ASSUMED] 此实现 Claude 自定
function normalizeToSnakeCase(args: unknown): unknown {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return args;
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(args as Record<string, unknown>)) {
    // camelCase → snake_case（只处理一级 key，嵌套 object 原样保留）
    const snakeKey = key.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`);
    result[snakeKey] = val;
  }
  return result;
}
```

**调用位置：** 在 `dispatchTool` 中，`def.execute` 之前：

```typescript
// dispatchTool 内，在 Promise.race 之前
const normalizedArgs = normalizeToSnakeCase(call.arguments);
return await Promise.race([def.execute(normalizedArgs as never, ctx), timeout]);
```

**范围说明（D-13）：** `dispatchTool` 是三宿主共用入口，normalize 天然覆盖 Word/Excel，但 Word/Excel 工具的 execute 函数本就用 camelCase 读参数——normalize 后他们的 `args.someParam` 会变成 `args.some_param` 导致读不到值。

**正确处理方式有两种，选其一：**

方案 A（推荐，最简）：**只对 PPT 工具 normalize**——判断工具名是否在 ppt 工具列表里，是才 normalize。

```typescript
const PPT_TOOLS = new Set([
  'insert_slide', 'set_shape_property', 'move_shape', 'set_shape_text',
  'set_shape_text_font', 'add_shape', 'copy_slide', 'set_shape_text_alignment',
  'delete_shape', 'rotate_shape', 'manage_slides', 'set_slide_background',
]);

const normalizedArgs = PPT_TOOLS.has(call.name)
  ? normalizeToSnakeCase(call.arguments)
  : call.arguments;
```

方案 B：全工具 normalize，同步把 Word/Excel 工具 execute 也改成读 snake_case。D-13 明确说不主动重排 Word/Excel，故**推荐方案 A**。

[CITED: CONTEXT.md D-13 — 范围限 PPT]

### D-09: ppt.ts schema 统一 snake_case

需要修改 `parameters` 定义中的 key 名称（这是 JSON schema，发给 LLM），以及 `execute` 函数里的解构。

以 `set_shape_text_font` 为例：

```typescript
// 改前（camelCase schema）
parameters: {
  properties: {
    slideIndex: { type: 'number', description: '幻灯片编号（1开始）' },
    shapeId: { type: 'string', description: '形状 ID' },
    font: { ... }
  },
  required: ['slideIndex', 'shapeId', 'font'],
}
// execute 读 args.slideIndex / args.shapeId

// 改后（snake_case schema，与 normalize 后一致）
parameters: {
  properties: {
    slide_index: { type: 'number', description: '幻灯片编号（1开始）' },
    shape_id: { type: 'string', description: '形状 ID' },
    font: { ... }
  },
  required: ['slide_index', 'shape_id', 'font'],
}
// execute 读 args.slide_index / args.shape_id
```

**涉及 schema 改动的工具（9 个）：** `set_shape_text_font`, `add_shape`, `set_shape_text_alignment`, `delete_shape`, `rotate_shape`, `manage_slides`, `set_slide_background`, `copy_slide`（`sourceIndex`→`source_index`, `targetIndex`→`target_index`）。

**不改的工具（已是 snake_case）：** `insert_slide`, `set_shape_property`, `move_shape`, `set_shape_text`。

### D-11: 删除 pick* helper 后的 execute 改动

删除 4 个 `pick*` helper 后，原来调用它们的地方改成直接读 snake_case key：

```typescript
// 改前
const slideIndex = pickSlideIndex(a);
const shapeId = pickShapeId(a);

// 改后（schema 已是 snake_case + dispatchTool normalize 保证入参是 snake_case）
const slide_index = a.slide_index as number;
const shape_id = a.shape_id as string;
```

### D-12: dispatch.test.ts 守门用例设计

守门用例需验证：对每个 PPT 工具，分别用 camelCase 入参和 snake_case 入参调用 dispatchTool，两次调用都应触达 execute 并读到正确的参数值。

```typescript
// dispatch.test.ts 新增 describe 块
describe('dispatchTool — PPT casing 归一化（D-12）', () => {
  it.each([
    ['set_shape_text_font', { slideIndex: 2, shapeId: 's1', font: {} }, { slide_index: 2, shape_id: 's1', font: {} }],
    ['set_shape_text_alignment', { slideIndex: 1, shapeId: 's2', alignment: 'Left' }, { slide_index: 1, shape_id: 's2', alignment: 'Left' }],
    ['delete_shape', { slideIndex: 3, shapeId: 's3' }, { slide_index: 3, shape_id: 's3' }],
    ['rotate_shape', { slideIndex: 1, shapeId: 's1', rotation: 45 }, { slide_index: 1, shape_id: 's1', rotation: 45 }],
    ['manage_slides', { operation: 'delete', slideIndex: 2 }, { operation: 'delete', slide_index: 2 }],
    ['set_slide_background', { slideIndex: 1, color: '#FF0000' }, { slide_index: 1, color: '#FF0000' }],
    ['copy_slide', { sourceIndex: 1 }, { source_index: 1 }],
    ['add_shape', { slideIndex: 1, shapeType: 'Rectangle', position: { left:0,top:0,width:100,height:100 } },
                  { slide_index: 1, shape_type: 'Rectangle', position: { left:0,top:0,width:100,height:100 } }],
  ])('%s：camelCase 与 snake_case 入参都命中正确 args', async (toolName, camelArgs, expectedSnakeArgs) => {
    // tool mock：execute 捕获 args 并 resolve ok:true
    let capturedArgs: unknown;
    const mockTool: ToolDef = {
      name: toolName, description: '', parameters: {},
      humanLabel: () => '',
      kind: 'write',
      async execute(args) { capturedArgs = args; return { ok: true }; },
    };
    // camelCase 入参
    await dispatchTool({ id: 'c1', name: toolName, arguments: camelArgs }, makeCtx(), [mockTool]);
    expect(capturedArgs).toMatchObject(expectedSnakeArgs);
    // snake_case 入参（normalize 应为幂等）
    await dispatchTool({ id: 'c2', name: toolName, arguments: expectedSnakeArgs }, makeCtx(), [mockTool]);
    expect(capturedArgs).toMatchObject(expectedSnakeArgs);
  });
});
```

---

## Don't Hand-Roll

| 问题 | 不要自己造 | 用现有 | 原因 |
|------|-----------|--------|------|
| HTTP 错误映射 | 自定义错误解析 | `mapHttpError(status, body)` | 已经覆盖 401/402/403/404/422/429/503 所有 AsterError 子类；apiKey 脱敏逻辑完备 |
| fetch throw 分类 | 自己判断 TypeError | `classifyFetchThrow(err, url)` | 三条信号（TypeError + onLine + https）区分 CORS 失败 vs 真网络断 |
| 测试框架 | 引入 Jest / 新库 | `vitest@^2.0.0` (已安装) | 现有 dispatch.test.ts、registry.test.ts 全用 vitest；0 新依赖 |
| 字节→base64 | 第三方 base64 库 | 原生 `btoa()` + `Uint8Array` | 浏览器内置，零依赖，够用 |

---

## Runtime State Inventory

> 本阶段是纯代码重构，无 rename/refactor/migration 场景，故跳过此节。
> 无运行时存储状态涉及（不改 localStorage key、不改聊天历史结构、不改 manifest）。

---

## Common Pitfalls

### Pitfall 1: baseURL 混淆（aihubmix.com vs api.aihubmix.com/v1）
**What goes wrong:** 现有 `AIHUBMIX_BASE_URL = 'https://api.aihubmix.com/v1'` 是旧值，只适合 `/chat/completions`（vision 客户端用）。生图 predictions 端点的 base host 是 `https://aihubmix.com`（无 `/v1`），gemini 端点是 `https://aihubmix.com/gemini/v1beta/...`。若直接复用旧 BASE_URL 拼接 predictions 路径，会得到 `https://api.aihubmix.com/v1/v1/models/...` 的双重 `/v1`，返回 404。
**Why it happens:** 两个不同端点族（predictions vs chat/completions）挂在同一个 provider 下，base host 不同。
**How to avoid:** 新增 `AIHUBMIX_IMAGE_BASE_URL = 'https://aihubmix.com'`，专门给 image client 用；保留旧 `AIHUBMIX_BASE_URL` 给 vision client。
**Warning signs:** HTTP 404 或 URL 中出现双重 `/v1`。

[VERIFIED: spike 011 findings.md — base host 明确是 https://aihubmix.com]

### Pitfall 2: gpt-image-2 的 output 是对象非数组
**What goes wrong:** doubao 的 `output` 是**数组** `[{url}]`，gpt-image-2 的 `output` 是**对象** `{b64_json:[...], urls:[]}`。若用同一个 `output[0]` 解析 gpt-image-2，会得到 undefined。
**Why it happens:** 两个 predictions 模型都走 `/predictions` 但 output 结构完全不同——spike 011 特别标注此陷阱。
**How to avoid:** 三路解析器各自独立，不共用 `output` 路径。
**Warning signs:** 静默返回空 base64 字符串（`output[0]` 在对象上返回 undefined，`undefined?.bytesBase64` 不报错）。

[VERIFIED: spike 011 findings.md — "output 是对象...跟 doubao 的 output:[...] 结构不一致"]

### Pitfall 3: gemini thoughtSignature 误当图片
**What goes wrong:** gemini response part 里同时有 `inlineData`（真实图片）和 `thoughtSignature`（~1.5M 字符 base64 思考签名）。若直接取 `parts[0]` 而 parts[0] 是只含 thoughtSignature 的 part，会返回 null base64，或拿到思考签名字节（极大）。
**Why it happens:** gemini 流式 JSON 数组里的 part 结构，有的 part 只有 thoughtSignature，有的 part 只有 inlineData。
**How to avoid:** 遍历所有 chunks 的所有 parts，**找到含 `inlineData` 字段的那个 part**，而不是简单取第一个。
**Warning signs:** 返回的 base64 字符串极长（>1M 字符）但解码后不是有效图片，或 base64 为空。

[VERIFIED: spike 011 findings.md — "注意巨大的 thoughtSignature（~1.5M 字符），解析时要跳过"]

### Pitfall 4: doubao URL fetch 的 CORS 风险
**What goes wrong:** doubao 返回的是 TOS 火山存储的签名 URL（host: `ark-acg-cn-beijing.tos-cn-beijing.volces.com`）。如果该域名的 CORS 头不允许来自 Office Task Pane 的 origin（`https://outlook.office.com` / `https://excel.officeapps.live.com` 等），浏览器侧 fetch 会抛 TypeError（CORS 拦截）。
**Why it happens:** 第三方存储 URL 的 CORS 策略不受 Aster 控制；TOS 签名 URL 通常是 public-read 但 CORS 配置未知。
**How to avoid:** fetch 用 try/catch 捕获 TypeError，映射为 `NetworkError`（hint 中提示「可能 CORS 限制，建议切换 gpt-image-2 或 gemini」）。不要让 CORS 错误静默或 crash。
**Warning signs:** fetch 抛 `TypeError: Failed to fetch`，navigator.onLine 为 true。

[ASSUMED: 基于 spike 011 响应中的 URL domain 推断；CORS 行为未实测]

### Pitfall 5: 中央 normalize 影响 Word/Excel 工具
**What goes wrong:** normalizeToSnakeCase 如果对所有 tools 无条件执行，Word 工具（如 `appendParagraph`）的 execute 里读 `args.afterParagraphIndex` 会因 normalize 后变成 `args.after_paragraph_index` 而读不到值，返回 undefined，导致静默错误。
**Why it happens:** Word/Excel 工具的 schema 和 execute 目前全部用 camelCase，normalize 后 key 名改变了。
**How to avoid:** normalize **仅对 PPT 工具触发**（D-13 已决策），用 `PPT_TOOLS` set 判断工具名，非 PPT 工具原样透传。
**Warning signs:** Word/Excel 工具 execute 读到 undefined args，测试失败。

[VERIFIED: 代码库阅读，word.ts/excel.ts 全用 camelCase 解构]

### Pitfall 6: registry.test.ts 断言过时
**What goes wrong:** 修改 `AIHUBMIX_VISION_MODEL = 'gpt-5.4'`（改前 `gpt-5.1`）和 `image-gen` 的默认 model 后，`registry.test.ts` 里的 `expect(result).toEqual({ model: 'gpt-5.1' })` 和 `model: 'gpt-image-2'` 断言会失败。
**How to avoid:** 同步更新 `registry.test.ts`（这是执行清单里的一项任务，不是意外）。

[VERIFIED: registry.test.ts L91/L110 — 断言了旧 model 值]

---

## Code Examples

### 三路解析器 switch 组织（推荐）

```typescript
// Source: spike 011 findings.md + 现有 aihubmix-image.ts 模式
export class AihubmixImageClient {
  async generate(
    prompt: string,
    config: ImageConfig,
  ): Promise<ImageGenResult> {
    const modelId = config.model;
    if (modelId.startsWith('doubao')) return this._doubao(prompt, modelId, config.baseURL, config.apiKey);
    if (modelId.startsWith('gpt-image')) return this._gptImage2(prompt, modelId, config.baseURL, config.apiKey);
    if (modelId.startsWith('gemini')) return this._gemini(prompt, modelId, config.baseURL, config.apiKey);
    throw new NetworkError(`未知生图 model: ${modelId}`);
  }
}
```

### doubao 请求 URL 拼接（关键细节）

```typescript
// Source: spike 011 findings.md
// modelId = 'doubao-seedream-5.0-lite'
const url = `${base}/v1/models/doubao/${modelId}/predictions`;
// → https://aihubmix.com/v1/models/doubao/doubao-seedream-5.0-lite/predictions
```

### gemini 请求 URL 拼接

```typescript
// Source: spike 011 findings.md
// modelId = 'gemini-3.1-flash-image-preview'
const url = `${base}/gemini/v1beta/models/${modelId}:streamGenerateContent`;
// → https://aihubmix.com/gemini/v1beta/models/gemini-3.1-flash-image-preview:streamGenerateContent
```

### normalizeToSnakeCase helper

```typescript
// Source: D-10（Claude's Discretion 实现）
// 仅对顶层 key 做 camel→snake，值不递归（position 等嵌套 object 原样保留）
function normalizeToSnakeCase(args: unknown): unknown {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return args;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args as Record<string, unknown>)) {
    out[k.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`)] = v;
  }
  return out;
}
```

**幂等性：** snake_case key 经 normalize 后不变（`slide_index` → `slide_index`），保证 snake_case 入参也正确。

---

## State of the Art

| 旧状态 | Phase 14 后状态 | 影响 |
|--------|----------------|------|
| `aihubmix-image.ts` 写 gpt-image-1 + OpenAI `/images/generations` | 三路解析器（doubao/gpt-image-2/gemini）+ `/predictions` + gemini 端点 | MDL-01 解锁所有下游生图工具 |
| `AIHUBMIX_VISION_MODEL = 'gpt-5.1'` | `gpt-5.4` | 视觉质量提升，无接口变化 |
| `AIHUBMIX_IMAGE_MODEL = 'gpt-image-2'`（单一常量） | `IMAGE_GEN_MODELS` 三项列表，默认 `doubao-seedream-5.0-lite` | Phase 16 picker 数据就绪 |
| `ImageGenResult = { b64_json, usage }` | `ImageGenResult = { base64, mimeType }` | Office.js 三宿主插图 API 直接消费 |
| PPT casing 双键容错 pick* helpers | dispatch 层中央 normalize | 单一归一化点，防 v2.2 PPT 生图工具重蹈覆辙 |
| `aihubmix-vision.ts` body 内 `model:'gpt-4o'` | `model: AIHUBMIX_VISION_MODEL`（`gpt-5.4`） | vision 质量对齐决策 D-06 |

**已废弃：**
- `ImageGenResult.b64_json` 字段：改名 `base64`（语义更清晰，Office.js 直接喂）
- `ImageGenResult.usage` 字段：删除（cost v2.0 已砍，memory `project_aster_cost_removed`）
- `gpt-image-1` 端点（`/images/generations`）：完全替换，不再使用
- `pick*` 4 个 casing 容错 helper：功能转移到 dispatchTool 中央 normalize

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | doubao TOS 签名 URL 支持从浏览器 Task Pane origin 的 CORS fetch | §doubao fetch 转 base64 + Pitfall 4 | 若 CORS 失败，doubao 路径在浏览器侧完全不可用；需切换默认 model 到 gpt-image-2，或引入 CORS proxy（触发无后台原则重评） |
| A2 | `normalizeToSnakeCase` 只做一级 key 映射（不递归嵌套 object）不会破坏 PPT 工具 `position`/`font` 等嵌套参数 | §normalizeToSnakeCase | 若某 PPT 工具的嵌套 object key 也是 camelCase（如 `position.leftOffset`），normalize 后嵌套 key 不变，execute 读不到。检查所有 PPT execute 函数的嵌套读取确认无 camelCase 嵌套 key。 |
| A3 | `btoa()` 在 Office for Web 的 Task Pane WebView 中可用且无编码问题（处理二进制图片字节） | §doubao fetch 转 base64 4e | Office for Web 用 Edge/Chrome WebView，`btoa` 是标准 Web API，应无问题。但 `btoa` 只接受 Latin-1，需先做 `Uint8Array` → `String.fromCharCode` 转换，否则 multi-byte 字节会报 `InvalidCharacterError`。 |

**A1 的缓解方案已内置：** Pitfall 4 的 `try/catch` + 用户 hint 提示切换 model。

---

## Open Questions

1. **doubao URL CORS 行为**
   - What we know: spike 011 从 Node.js curl 拿到了 URL，URL host 是 ByteDance TOS 存储（`ark-acg-cn-beijing.tos-cn-beijing.volces.com`），签名 URL 通常是 public-read。
   - What's unclear: 该域名的 CORS 头是否允许来自 Office 宿主 origin（`https://excel.officeapps.live.com` 等）的 fetch。
   - Recommendation: 执行期 smoke test 时顺带测一次浏览器侧 fetch URL（而非 Node.js curl）；若失败，返回清晰 NetworkError hint，文档标注「doubao 仅桌面版/CLI 可用」，或切换默认 model 为 gpt-image-2。**不阻塞 MDL-01 实现**（提供错误处理路径即可）。

2. **mimeType 规范化**
   - What we know: gpt-image-2 响应里 `mimeType` 字段值是 `'png'`（非 `'image/png'`）；gemini 是 `'image/jpeg'`（完整 MIME 类型）。
   - What's unclear: Office.js 插图 API 接受哪种格式（是否需要完整 MIME type）。
   - Recommendation: 在 provider 内部统一规范化，`'png'` → `'image/png'`，`'jpeg'` → `'image/jpeg'`。Phase 16 插图时喂标准 MIME type 更安全。

---

## Environment Availability

本阶段是纯代码重构，无需新外部工具。执行期 smoke test 需要：

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `AIHUBMIX_API_KEY` in `.env.local` | D-14 三路真打 + fixture 录制 | ✓（用户已有，spike 011 已用） | n/a | 无 fallback（需真 Key） |
| `vitest` | 测试运行 | ✓ | `^2.0.0`（package.json） | n/a |
| `npm test` | CI 全量测试门 | ✓ | n/a | n/a |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^2.0.0 + jsdom |
| Config file | `vitest.config.ts`（项目根，environment: 'jsdom', globals: true） |
| Quick run command | `npx vitest run src/providers/ src/agent/tools/` |
| Full suite command | `npm test`（`tsc --noEmit && vitest run`） |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| MDL-01 doubao | doubao 解析器从 `output[0].url` 取 URL，fetch→base64，返回 `{ base64, mimeType }` | unit (fixture) | `npx vitest run src/providers/aihubmix-image.test.ts` | ❌ Wave 0 新建 |
| MDL-01 gpt-image-2 | gpt-image-2 解析器从 `output.b64_json[0].bytesBase64` 取 base64，mimeType 规范化 `'png'→'image/png'` | unit (fixture) | 同上 | ❌ Wave 0 新建 |
| MDL-01 gemini | gemini 解析器遍历 chunks/parts，找到 `inlineData`，跳过 `thoughtSignature` | unit (fixture) | 同上 | ❌ Wave 0 新建 |
| MDL-01 结果形状 | 三路 provider 返回值都是 `{ base64: string, mimeType: string }`，base64 不含 `data:` 前缀 | unit (fixture) | 同上 | ❌ Wave 0 新建 |
| MDL-01 安全 | apiKey 不出现在 error.message，不进 request body | unit | 同上 | ❌ Wave 0 新建 |
| MDL-02 registry | `resolve('vision')` 返回 `model:'gpt-5.4'`；`resolve('image-gen')` 返回 `model:'doubao-seedream-5.0-lite'` | unit | `npx vitest run src/providers/registry.test.ts` | ✅ 需更新断言 |
| MDL-02 IMAGE_GEN_MODELS | 列表含三个 model，`isDefault` 恰好一个为 true，默认是 doubao | unit | `npx vitest run src/providers/registry.test.ts` | ✅ 需新增用例 |
| MDL-03 normalize | PPT 工具 camelCase 入参经 dispatchTool normalize 后 execute 收到 snake_case args | unit | `npx vitest run src/agent/tools/dispatch.test.ts` | ✅ 需新增 describe 块 |
| MDL-03 snake 幂等 | PPT 工具 snake_case 入参经 normalize 后不变（幂等） | unit | 同上 | ✅ 同一 test case 的第二次 assert |
| MDL-03 Word 不受影响 | Word 工具 args 经 dispatchTool 不被 normalize 影响（camelCase 保持原样）| unit | `npx vitest run src/agent/tools/dispatch.test.ts` | ✅ 需新增用例 |
| bundle gate | initial main-*.js ≤ 82KB gzip | build check | `npm run build && npm run size` | ✅ 现有 CI gate |

### fixture 设计（MDL-01，D-14/D-15/D-16）

**执行期任务（executor 用 `.env.local` AIHUBMIX_API_KEY 一次性真打）：**

```
src/providers/__fixtures__/
├── doubao-response.json       — { "output": [{ "url": "<截断，占位>" }] }
├── gpt-image-2-response.json  — { "output": { "b64_json": [{ "bytesBase64": "<截断4字符>", "mimeType": "png" }] } }
└── gemini-response.json       — 多 chunk JSON 数组，含 inlineData + thoughtSignature
                                 实际 base64 截断为 4 字符占位，thoughtSignature 截断
```

**fixture-based 单测结构：**

```typescript
// src/providers/aihubmix-image.test.ts — Wave 0 新建
import doubaoFixture from './__fixtures__/doubao-response.json';
import gptImage2Fixture from './__fixtures__/gpt-image-2-response.json';
import geminiFixture from './__fixtures__/gemini-response.json';

// mock fetch：对 predictions/gemini URL 返回对应 fixture
vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
  if (url.includes('doubao')) return { ok:true, headers:{ get: ()=>'image/png' },
    arrayBuffer: async () => new ArrayBuffer(0), json: async () => doubaoFixture };
  if (url.includes('gpt-image-2')) return { ok:true, json: async () => gptImage2Fixture };
  if (url.includes('gemini')) return { ok:true, json: async () => geminiFixture };
}));
```

**D-16 fixture 截断原则：** base64 字段保留 4 字符（够验路径命中），不存完整 3MB 图片。`url` 字段替换为占位符 `<truncated-for-ci>`（fetch 会被 mock，URL 内容不重要）。

### Sampling Rate

- **Per task commit:** `npx vitest run src/providers/ src/agent/tools/`（仅 provider + tool 目录，约 5s）
- **Per wave merge:** `npm test`（全量 tsc + vitest，约 30s）
- **Phase gate:** 全量 `npm test` green + `npm run build && npm run size`（bundle ≤82KB）before `/gsd-verify-work`

### Wave 0 Gaps（执行前必须新建）

- [ ] `src/providers/__fixtures__/doubao-response.json` — fixture（真打后录制）
- [ ] `src/providers/__fixtures__/gpt-image-2-response.json` — fixture（真打后录制）
- [ ] `src/providers/__fixtures__/gemini-response.json` — fixture（真打后录制）
- [ ] `src/providers/aihubmix-image.test.ts` — 三路解析器单测（MDL-01）
- [ ] `src/providers/registry.test.ts` — 更新 vision/image-gen model 断言（MDL-02）
- [ ] `src/agent/tools/dispatch.test.ts` — 新增 PPT casing 守门 describe 块（MDL-03）

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | 否 | n/a（生图不涉及用户认证） |
| V3 Session Management | 否 | n/a |
| V4 Access Control | 否 | n/a |
| V5 Input Validation | 是 | apiKey 只进 header，不进 body（T-01-04）；model id 由内部 switch 分发，不拼用户输入到 URL |
| V6 Cryptography | 否 | 不新增加密逻辑 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| apiKey 泄露到 error.message | Information Disclosure | `mapHttpError` 固定字面量 message，不插变量；`sanitizeErrBody` 剥 `sk-` 值 [VERIFIED: sse.ts L96-107] |
| apiKey 出现在 request body | Information Disclosure | apiKey 仅注入 `Authorization` / `x-goog-api-key` header（T-01-04）[VERIFIED: 现有 aihubmix-image.ts 模式] |
| doubao URL 含签名参数被记录到日志/聊天历史 | Information Disclosure | URL 在 provider 内部立即 fetch→base64→丢弃，不进任何持久化存储（D-02）[CITED: CONTEXT.md D-02] |

---

## Project Constraints（from CLAUDE.md）

以下约束对本阶段实现有直接影响：

| 约束 | 影响 |
|------|------|
| **无后台硬约束**：所有 LLM/图像调用从浏览器直连 Provider | 三路生图 fetch 全在 `aihubmix-image.ts` 浏览器端执行，无 proxy |
| **Bundle ≤82KB gzip CI gate** | 本阶段 0 净新增运行时依赖；改动纯在现有文件，不增 chunk |
| **apiKey 永不进 body/error.message** | 三路请求 headers 严格区分 Bearer vs x-goog-api-key；错误 message 用固定字面量 |
| **P95 端到端 ≤10s** | 默认 doubao（数秒响应 + URL→base64 fetch）；gpt-image-2 high ~90s 不作默认（D-05 已决策） |
| **Cost 功能已砍** | `ImageGenResult.usage` 字段删除，不保留任何 token 计量 |
| **质量 >> token 成本** | vision 选 gpt-5.4（更强），不因成本降格 |

---

## Sources

### Primary（HIGH confidence）

- `[VERIFIED: .planning/spikes/011-image-gen-api-formats/findings.md]` — 三生图 model 真机 API 实测，端点/鉴权/request body/response 字段路径全部锁定
- `[VERIFIED: src/providers/aihubmix-image.ts]` — 当前实现（gpt-image-1 旧形态），完整重写基准
- `[VERIFIED: src/providers/registry.ts]` — 当前 model 常量（vision=gpt-5.1, image=gpt-image-2）
- `[VERIFIED: src/providers/aihubmix-vision.ts]` — vision 客户端，body 硬编码 gpt-4o，需对齐
- `[VERIFIED: src/providers/types.ts]` — ImageProvider 接口，返回形状需改
- `[VERIFIED: src/agent/tools/index.ts]` — dispatchTool 结构，normalize 落点
- `[VERIFIED: src/agent/tools/write/ppt.ts]` — pick* helpers + camelCase schema 分布
- `[VERIFIED: src/agent/tools/dispatch.test.ts]` — 现有守门用例结构
- `[VERIFIED: src/providers/registry.test.ts]` — 现有断言（过时 model 值）
- `[VERIFIED: src/lib/sse.ts]` — mapHttpError/NetworkError/sanitizeErrBody 可复用
- `[VERIFIED: package.json]` — vitest@^2.0.0 已安装，无需新依赖

### Secondary（MEDIUM confidence）

- `[CITED: .planning/research/SUMMARY.md]` — v2.2 研究基线，Provider 重写必须最先
- `[CITED: .planning/REQUIREMENTS.md]` — MDL-01/02/03 完整需求文本
- `[CITED: CONTEXT.md D-01..D-16]` — 所有锁定决策

### Tertiary（LOW confidence / ASSUMED）

- A1: doubao TOS URL 的 CORS 行为（未从浏览器侧实测，spike 011 用 curl）
- A3: `btoa()` + `Uint8Array` 在 Office Task Pane WebView 的二进制 base64 编码行为

---

## Metadata

**Confidence breakdown:**
- 三路 wire format（字段路径 / URL / 鉴权）：HIGH — spike 011 真机实测锁定
- 代码改动范围与文件：HIGH — 完整代码库阅读确认
- PPT casing 问题分布：HIGH — 读取了 ppt.ts 每个工具定义
- doubao URL→base64 fetch 在 Office for Web CORS：LOW — 未从浏览器侧验证
- fixture 录制方式：HIGH — vitest mock fetch 是标准模式

**Research date:** 2026-06-01
**Valid until:** 2026-07-01（spike 011 锁定的 wire format 除非 aihubmix API 大版本升级否则不会失效；doubao CORS A1 假设建议在执行期第一个 smoke test 验证）
