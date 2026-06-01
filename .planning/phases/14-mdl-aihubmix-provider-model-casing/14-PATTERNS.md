# Phase 14: MDL — AiHubMix Provider 重写 + model 修正 + PPT casing 根治 - Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 10 (6 modify/rewrite + 1 new test + 3 new fixtures)
**Analogs found:** 9 / 10 (fixtures 无直接 analog，用 RESEARCH.md 设计)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/providers/aihubmix-image.ts` | provider client | request-response (3-path) | `src/providers/aihubmix-vision.ts` | role-match (同为 non-streaming fetch provider) |
| `src/providers/registry.ts` | registry / config | CRUD | `src/providers/registry.ts` (self) | exact (直接改常量 + 新增 export) |
| `src/providers/aihubmix-vision.ts` | provider client | request-response | `src/providers/aihubmix-image.ts` (当前) | exact (同文件系列，改单字段) |
| `src/providers/types.ts` | types / interface | — | `src/providers/types.ts` (self) | exact (直接改 ImageProvider + ImageGenResult) |
| `src/agent/tools/index.ts` | dispatch / middleware | request-response | `src/agent/tools/index.ts` (self) | exact (在 dispatchTool 内插 normalize) |
| `src/agent/tools/write/ppt.ts` | tool definition | request-response | `src/agent/tools/write/ppt.ts` (self) | exact (删 pick* helpers，改 schema key) |
| `src/providers/aihubmix-image.test.ts` | test (fixture-based) | — | `src/providers/openai-compat.test.ts` | role-match (vi.stubGlobal fetch mock 模式) |
| `src/providers/registry.test.ts` | test (unit) | — | `src/providers/registry.test.ts` (self) | exact (更新现有断言 + 新增 IMAGE_GEN_MODELS case) |
| `src/agent/tools/dispatch.test.ts` | test (unit) | — | `src/agent/tools/dispatch.test.ts` (self) | exact (extend 现有 describe 块) |
| `src/providers/__fixtures__/*.json` | fixture (data) | — | none | no analog (执行期真打录制) |

---

## Pattern Assignments

### `src/providers/aihubmix-image.ts` (provider client, request-response)

**Analog:** `src/providers/aihubmix-vision.ts`（完整重写对照文件）+ `src/providers/aihubmix-image.ts`（当前文件，重写起点）

**Imports pattern** (`src/providers/aihubmix-vision.ts` lines 1-14):
```typescript
/**
 * 安全：
 * - apiKey 仅放 Authorization header，不进请求 body
 * - apiKey 不出现在 error.message（T-01-04）
 */
import { mapHttpError } from '../lib/sse';
import { NetworkError } from '../errors';
```

**当前 image client 的核心结构** (`src/providers/aihubmix-image.ts` lines 35-87):
```typescript
export class AihubmixImageClient {
  async generate(
    prompt: string,
    size: ImageSize,
    quality: ImageQuality,
    config: ImageGenConfig,
  ): Promise<ImageGenResult> {
    const url = `${config.baseURL.replace(/\/$/, '')}/images/generations`;

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size, quality }),
      });
    } catch {
      throw new NetworkError('aihubmix 生图请求网络失败');
    }

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw mapHttpError(resp.status, errBody);
    }

    const json = await resp.json() as { data?: Array<{ b64_json?: string }>; usage?: {...} };
    const b64_json = json.data?.[0]?.b64_json ?? '';
    return { b64_json, usage };
  }
}
```

**重写后的新签名契约**（改前 `b64_json` + `usage` → 改后 `base64` + `mimeType`，D-01）：
- 三路 fetch 各自独立的 `try/catch` → `NetworkError`，`!resp.ok` → `mapHttpError(resp.status, errBody)`
- gemini 鉴权：`'x-goog-api-key': config.apiKey`（不走 `Authorization: Bearer`）
- URL 拼接（不复用旧 `AIHUBMIX_BASE_URL`，需新常量 `AIHUBMIX_IMAGE_BASE_URL = 'https://aihubmix.com'`）：
  - doubao: `` `${base}/v1/models/doubao/${modelId}/predictions` ``
  - gpt-image-2: `` `${base}/v1/models/openai/gpt-image-2/predictions` ``
  - gemini: `` `${base}/gemini/v1beta/models/${modelId}:streamGenerateContent` ``

**vision client fetch+parse 模式**（最近的 non-streaming fetch analog，`src/providers/aihubmix-vision.ts` lines 32-69）：
```typescript
let resp: Response;
try {
  resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model: 'gpt-4o', stream: false, messages: [...] }),
  });
} catch {
  throw new NetworkError('aihubmix 视觉请求网络失败');
}

if (!resp.ok) {
  const errBody = await resp.json().catch(() => ({}));
  throw mapHttpError(resp.status, errBody);
}

const json = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
const content = json.choices?.[0]?.message?.content ?? '';
return { content };
```

**mapHttpError + NetworkError 来源** (`src/lib/sse.ts` lines 120-155):
```typescript
export function mapHttpError(
  status: number,
  errBody: unknown,
  retryAfterSeconds?: number,
): AsterError {
  switch (status) {
    case 401: return new KeyInvalidError('API Key 无效，请前往设置更新 Key');
    case 403: return new KeyInvalidError('API Key 权限不足或已被吊销，请前往设置更新 Key');
    case 402: return new QuotaExceededError('账户余额不足，请前往 Provider 充值');
    case 404: return new ModelNotFoundError('模型不存在，请在设置中检查模型名称');
    case 429: return new RateLimitError('请求过快，稍后自动重试', retryAfterSeconds);
    case 503: return new NetworkError('服务繁忙，稍后自动重试');
    default:  return new NetworkError('网络错误，请检查连接');
  }
}
```

**安全约束**（T-01-04，贯穿所有三路请求）：
- `apiKey` 仅注入 `Authorization: Bearer ${apiKey}` 或 `'x-goog-api-key': apiKey` header
- 不进 request body，不进 error.message（`mapHttpError` 只用固定字面量）
- doubao URL 在 provider 内立即 fetch→base64→丢弃，不进任何持久化存储

---

### `src/providers/registry.ts` (registry, config)

**Analog:** `src/providers/registry.ts`（直接改动，参照现有 `case 'vision'` 和 `case 'image-gen'` 结构）

**现有 vision/image-gen resolve 模式** (lines 68-102):
```typescript
case 'vision': {
  const apiKey = storage.get<string>(STORAGE_KEYS.KEY_PREFIX + AIHUBMIX_PROVIDER_ID);
  if (!apiKey) {
    throw new KeyInvalidError('aihubmix Key 未配置，请在设置中填写 aihubmix Key');
  }
  return {
    providerId: `${AIHUBMIX_PROVIDER_ID}-vision`,
    baseURL: AIHUBMIX_BASE_URL,
    apiKey,
    model: AIHUBMIX_VISION_MODEL,
  } satisfies ImageConfig;
}

case 'image-gen': {
  const apiKey = storage.get<string>(STORAGE_KEYS.KEY_PREFIX + AIHUBMIX_PROVIDER_ID);
  if (!apiKey) {
    throw new KeyInvalidError('aihubmix Key 未配置，请在设置中填写 aihubmix Key');
  }
  return {
    providerId: `${AIHUBMIX_PROVIDER_ID}-image`,
    baseURL: AIHUBMIX_BASE_URL,  // ← 此行改为 AIHUBMIX_IMAGE_BASE_URL
    apiKey,
    model: AIHUBMIX_IMAGE_MODEL,  // ← 此行改为 DEFAULT_IMAGE_GEN_MODEL.id
  } satisfies ImageConfig;
}
```

**改动清单（对照现有 lines 24-32）**：
```typescript
// 旧（lines 25-31）
const AIHUBMIX_BASE_URL = 'https://api.aihubmix.com/v1';
const AIHUBMIX_VISION_MODEL = 'gpt-5.1';  // → 改为 'gpt-5.4'（D-06）
const AIHUBMIX_IMAGE_MODEL = 'gpt-image-2';  // → 删除，改用 IMAGE_GEN_MODELS 列表

// 新增（D-05，供 Phase 16 picker 消费 + 本阶段 image-gen resolve 路由）
const AIHUBMIX_IMAGE_BASE_URL = 'https://aihubmix.com';  // 生图专用，无 /v1 后缀

export interface ImageGenModel {
  id: string;
  label: string;
  endpointKind: 'predictions' | 'gemini';
  authKind: 'bearer' | 'goog-api-key';
  isDefault: boolean;
}

export const IMAGE_GEN_MODELS: ImageGenModel[] = [ /* 三项：doubao/gpt-image-2/gemini */ ];
export const DEFAULT_IMAGE_GEN_MODEL = IMAGE_GEN_MODELS.find((m) => m.isDefault)!;
```

**KeyInvalidError 空 key 守门模式**（现有 lines 56-59，复用无改动）：
```typescript
if (!apiKey) {
  throw new KeyInvalidError('aihubmix Key 未配置，请在设置中填写 aihubmix Key');
}
```

---

### `src/providers/aihubmix-vision.ts` (provider client, request-response)

**改动范围极小**：仅 line 44，把 `model: 'gpt-4o'` 改为 `model: AIHUBMIX_VISION_MODEL`（从 registry 导入常量，D-06）。

**现有 body 注入模式** (`src/providers/aihubmix-vision.ts` lines 43-54):
```typescript
body: JSON.stringify({
  model: 'gpt-4o',         // ← 改为: model: AIHUBMIX_VISION_MODEL
  stream: false,
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: userText },
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
    ],
  }],
}),
```

**注意**：需从 registry 导入 `AIHUBMIX_VISION_MODEL`，或重构为常量局部化。避免 circular import（registry 导入 types，vision 导入 sse/errors，无循环风险）。

---

### `src/providers/types.ts` (types/interface)

**改动：** `ImageProvider.generate()` 返回形状 + `ImageGenResult` 接口定义（D-01）

**现有 ImageProvider 接口** (lines 89-99):
```typescript
export interface ImageProvider {
  generate(
    prompt: string,
    size: string,
    quality: 'high' | 'medium' | 'low' | 'auto',
    config: ImageConfig,
  ): Promise<{
    b64_json: string;
    usage?: { input_tokens: number; output_tokens: number; total_tokens: number };
  }>;
}
```

**改后（D-01，usage 删除，b64_json → base64 + mimeType）**：
```typescript
export interface ImageGenResult {
  base64: string;    // 裸 base64，不带 data: 前缀（D-01）
  mimeType: string;  // 'image/png' | 'image/jpeg' | string
}

export interface ImageProvider {
  generate(
    prompt: string,
    config: ImageConfig,
    options?: { size?: string; quality?: 'high' | 'medium' | 'low' | 'auto' },
  ): Promise<ImageGenResult>;
}
```

`ImageConfig` 和 `LLMConfig` 接口结构（lines 34-50）不改，`model: string` 字段继续支持动态 modelId。

---

### `src/agent/tools/index.ts` (dispatch/middleware, request-response)

**Analog:** `src/agent/tools/index.ts`（直接修改，在 `dispatchTool` 内插 normalize）

**现有 dispatchTool 核心结构** (lines 139-185)：

```typescript
export async function dispatchTool(
  call: ToolCallInvocation,
  ctx: ToolExecContext,
  tools: ToolDef[],
): Promise<ToolResult> {
  const def = tools.find((t) => t.name === call.name);
  if (!def) { /* NOT_FOUND error */ }

  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new HostApiError('工具调用超时，宿主无响应')),
        TOOL_TIMEOUT_MS,  // 15_000 ms
      );
    });
    try {
      return await Promise.race([def.execute(call.arguments as never, ctx), timeout]);
      //                                    ↑ Phase 14 改为: normalizedArgs as never
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  } catch (err) {
    if (isAsterErrorWithMeta(err)) {
      return { ok: false, error: sanitizeFromAsterError(err) };
    }
    // 陌生异常兜底
    return { ok: false, error: { code: 'UNSUPPORTED', message: '宿主操作失败', ... } };
  }
}
```

**normalize 插入点**：在 `Promise.race([def.execute(...)...])` 之前插入，**仅对 PPT 工具**（D-13，防影响 Word/Excel camelCase 参数）：

```typescript
// Phase 14 新增（D-10）：PPT 工具入口中央 normalize（camelCase → snake_case）
const PPT_TOOLS = new Set([
  'insert_slide', 'set_shape_property', 'move_shape', 'set_shape_text',
  'set_shape_text_font', 'add_shape', 'copy_slide', 'set_shape_text_alignment',
  'delete_shape', 'rotate_shape', 'manage_slides', 'set_slide_background',
]);

function normalizeToSnakeCase(args: unknown): unknown {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return args;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args as Record<string, unknown>)) {
    out[k.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`)] = v;
  }
  return out;
}

// 在 Promise.race 前：
const normalizedArgs = PPT_TOOLS.has(call.name)
  ? normalizeToSnakeCase(call.arguments)
  : call.arguments;
return await Promise.race([def.execute(normalizedArgs as never, ctx), timeout]);
```

**关键约束**：helper `normalizeToSnakeCase` 只做**一级 key** 映射，嵌套 object 的 key（如 `position.left`、`font.size`）原样保留（A2 风险缓解）。

---

### `src/agent/tools/write/ppt.ts` (tool definition, request-response)

**Analog:** `src/agent/tools/write/ppt.ts`（直接修改）

**散落 pick* helpers 现状** (lines 79-90)，Phase 14 全删：
```typescript
// 以下 4 个 helper 全部删除（D-11）
function pickSlideIndex(args: Record<string, unknown>): number {
  return (args.slideIndex ?? args.slide_index) as number;
}
function pickShapeId(args: Record<string, unknown>): string {
  return (args.shapeId ?? args.shape_id) as string;
}
function pickSourceIndex(args: Record<string, unknown>): number {
  return (args.sourceIndex ?? args.source_index) as number;
}
function pickTargetIndex(args: Record<string, unknown>): number | undefined {
  return (args.targetIndex ?? args.target_index) as number | undefined;
}
```

**camelCase schema 工具（9 个需改）** — 以 `setShapeTextFontTool` 为代表（lines 327-372）：
```typescript
// 改前：schema 用 camelCase，execute 调 pickSlideIndex/pickShapeId
parameters: {
  properties: {
    slideIndex: { type: 'number', description: '幻灯片编号（1开始）' },  // → slide_index
    shapeId: { type: 'string', description: '形状 ID' },               // → shape_id
    font: { type: 'object', ... },
  },
  required: ['slideIndex', 'shapeId', 'font'],  // → ['slide_index', 'shape_id', 'font']
},
humanLabel: (args) => {
  const a = args as Record<string, unknown>;
  return `修改第 ${pickSlideIndex(a)} ...形状「${pickShapeId(a)}」文字字体`;  // → a.slide_index, a.shape_id
},
async execute(args, ctx) {
  const a = args as Record<string, unknown>;
  const slideIndex = pickSlideIndex(a);  // → const slide_index = a.slide_index as number
  const shapeId = pickShapeId(a);        // → const shape_id = a.shape_id as string
  ...
}
```

**已正确 snake_case 工具（4 个，不改）** — `set_shape_property` (lines 154-222) 作为样板：
```typescript
parameters: {
  properties: {
    slide_index: { type: 'number', description: '幻灯片编号（1开始）' },
    shape_id: { type: 'string', description: '形状 ID，来自 list_shapes_on_slide' },
    fill_color: { type: 'string', description: '填充色 #RRGGBB' },
  },
  required: ['slide_index', 'shape_id'],
},
humanLabel: ({ slide_index, shape_id, fill_color, ... }) => { ... },
async execute(args, ctx) {
  const { slide_index, shape_id, fill_color, ... } = args;  // 直接解构，无容错
  ...
}
```

**reverse ReverseDescriptor args 格式**（保持不变，现有工具已用 snake_case，如 lines 200-213）：
```typescript
const reverse: ReverseDescriptor = {
  tool: 'restore_shape_property',
  args: {
    slide_index,   // 已是 snake_case，Phase 14 后 execute 变量名对齐
    shape_id,
    fill_type: beforeImage.fillType,
    fill_color: beforeImage.fillColor,
    ...
  },
};
```

---

### `src/providers/aihubmix-image.test.ts` (test, fixture-based)

**Analog:** `src/providers/openai-compat.test.ts`（vi.mock 模式）+ `src/agent/tools/dispatch.test.ts`（describe/it.each 结构）

**fetch global mock 模式** (`src/providers/openai-compat.test.ts` lines 1-14)：
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const capturedBodies: unknown[] = [];
vi.mock('../lib/sse', async () => {
  const actual = await vi.importActual<typeof import('../lib/sse')>('../lib/sse');
  return { ...actual, streamSSE: vi.fn(async function* mockStreamSSE(...) { ... }) };
});
```

**新文件的 fetch stub 模式**（参照 RESEARCH.md §fixture-based 单测结构，适配三路 URL 分发）：
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import doubaoFixture from './__fixtures__/doubao-response.json';
import gptImage2Fixture from './__fixtures__/gpt-image-2-response.json';
import geminiFixture from './__fixtures__/gemini-response.json';

// mock fetch：按 URL 分发对应 fixture
vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
  if (url.includes('doubao')) {
    // doubao 路径需两次 fetch（1. predictions API 拿 URL；2. fetch URL 转 base64）
    // predictions 调用
    if (url.includes('predictions')) {
      return { ok: true, json: async () => doubaoFixture };
    }
    // 图片 URL fetch 调用
    return {
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => new ArrayBuffer(4),  // 4 bytes 占位
    };
  }
  if (url.includes('gpt-image-2')) return { ok: true, json: async () => gptImage2Fixture };
  if (url.includes('gemini')) return { ok: true, json: async () => geminiFixture };
  throw new Error(`Unexpected URL in test: ${url}`);
}));
```

**describe/it 结构**（参照 `dispatch.test.ts` lines 38-61）：
```typescript
describe('AihubmixImageClient — 三路解析器（MDL-01）', () => {
  it('doubao: 从 output[0].url fetch 转 base64，返回 { base64, mimeType }', async () => { ... });
  it('gpt-image-2: 从 output.b64_json[0].bytesBase64 取 base64，mimeType 规范化', async () => { ... });
  it('gemini: 跳过 thoughtSignature，从 inlineData.data 取 base64', async () => { ... });
  it('三路返回值 base64 不含 data: 前缀', async () => { ... });
  it('apiKey 不出现在 error.message（T-01-04）', async () => { ... });
});
```

---

### `src/providers/registry.test.ts` (test, unit)

**Analog:** `src/providers/registry.test.ts`（直接扩展）

**现有 mock storage + vi.mocked 模式** (lines 12-33)：
```typescript
vi.mock('../lib/storage', () => ({
  storage: { get: vi.fn() },
  STORAGE_KEYS: {
    KEY_PREFIX: 'aster:keys:',
    PROVIDERS: 'aster:providers',
    ...
  },
}));

import { storage } from '../lib/storage';
import { ProviderRegistry } from './registry';

// 在 test 内
vi.mocked(storage.get).mockReturnValue('sk-aihubmix-key');
const result = ProviderRegistry.resolve('vision', mockGetConfig);
expect(result).toEqual({ providerId: 'aihubmix-vision', ... model: 'gpt-5.1' });
```

**需更新的断言** (lines 91-117)：
```typescript
// 旧（line 101）：model: 'gpt-5.1'  → 新：model: 'gpt-5.4'（D-06）
// 旧（line 113）：model: 'gpt-image-2'  → 新：model: 'doubao-seedream-5.0-lite'（D-05）
// 旧（line 98）：baseURL: 'https://api.aihubmix.com/v1'（image-gen 行）
//               → 新：baseURL: 'https://aihubmix.com'（AIHUBMIX_IMAGE_BASE_URL）
```

**新增 IMAGE_GEN_MODELS 用例**（在现有 describe 块内追加）：
```typescript
it('IMAGE_GEN_MODELS 含三个 model，isDefault 恰好一个为 true，默认是 doubao', () => {
  expect(IMAGE_GEN_MODELS).toHaveLength(3);
  const defaults = IMAGE_GEN_MODELS.filter((m) => m.isDefault);
  expect(defaults).toHaveLength(1);
  expect(defaults[0].id).toBe('doubao-seedream-5.0-lite');
});
```

---

### `src/agent/tools/dispatch.test.ts` (test, unit)

**Analog:** `src/agent/tools/dispatch.test.ts`（直接扩展，追加 describe 块）

**现有 makeCtx + mock ToolDef 模式** (lines 18-36)：
```typescript
const mockAdapter = {
  capabilities: () => ({ host: 'word' as const, ... }),
  getSelection: async () => ({ kind: 'none' as const }),
  onSelectionChanged: () => () => {},
  insert: async () => {},
} as unknown as DocumentAdapter;

function makeCtx() {
  return {
    adapter: mockAdapter,
    runId: 'r1',
    stepIndex: 1,
    signal: new AbortController().signal,
  };
}
```

**现有 inline mock ToolDef + dispatchTool 调用模式** (lines 39-53)：
```typescript
const tool: ToolDef = {
  name: 'fail_invalid',
  description: '',
  parameters: {},
  humanLabel: () => '',
  async execute() { throw new HostApiError('...'); },
};
const result = await dispatchTool(
  { id: 'c1', name: 'fail_invalid', arguments: {} },
  makeCtx(),
  [tool],
);
expect(result.ok).toBe(false);
```

**PPT casing 守门用例模式**（D-12，在现有文件追加新 describe 块）：
```typescript
describe('dispatchTool — PPT casing 归一化（D-12）', () => {
  it.each([
    ['set_shape_text_font', { slideIndex: 2, shapeId: 's1', font: {} }, { slide_index: 2, shape_id: 's1', font: {} }],
    ['set_shape_text_alignment', { slideIndex: 1, shapeId: 's2', alignment: 'Left' }, { slide_index: 1, shape_id: 's2', alignment: 'Left' }],
    ['delete_shape', { slideIndex: 3, shapeId: 's3' }, { slide_index: 3, shape_id: 's3' }],
    // ... 其余 PPT 工具
  ])('%s：camelCase 与 snake_case 入参都命中正确 args', async (toolName, camelArgs, expectedSnakeArgs) => {
    let capturedArgs: unknown;
    const mockTool: ToolDef = {
      name: toolName, description: '', parameters: {},
      humanLabel: () => '',
      kind: 'write',
      async execute(args) { capturedArgs = args; return { ok: true }; },
    };
    // camelCase 入参 → normalize → execute 收到 snake_case
    await dispatchTool({ id: 'c1', name: toolName, arguments: camelArgs }, makeCtx(), [mockTool]);
    expect(capturedArgs).toMatchObject(expectedSnakeArgs);
    // snake_case 入参 → normalize 幂等 → execute 仍收到 snake_case
    await dispatchTool({ id: 'c2', name: toolName, arguments: expectedSnakeArgs }, makeCtx(), [mockTool]);
    expect(capturedArgs).toMatchObject(expectedSnakeArgs);
  });

  it('Word 工具不受 PPT normalize 影响（camelCase 保持原样，D-13）', async () => {
    let capturedArgs: unknown;
    const wordTool: ToolDef = {
      name: 'append_paragraph', description: '', parameters: {},
      humanLabel: () => '',
      kind: 'write',
      async execute(args) { capturedArgs = args; return { ok: true }; },
    };
    const wordArgs = { afterParagraphIndex: 2, text: 'hello' };
    await dispatchTool({ id: 'c1', name: 'append_paragraph', arguments: wordArgs }, makeCtx(), [wordTool]);
    expect(capturedArgs).toMatchObject(wordArgs);  // camelCase 保持原样
  });
});
```

---

### `src/providers/__fixtures__/*.json` (fixture data)

**No analog**（新建目录，内容由执行期真打录制）

**Fixture 设计规范** (D-16，RESEARCH.md §fixture 设计)：

```json5
// doubao-response.json — doubao 路径（output 是数组，每项 {url}）
{ "output": [{ "url": "<truncated-for-ci>" }] }

// gpt-image-2-response.json — gpt-image-2 路径（output 是对象，非数组）
// 关键：output 是对象不是数组（Pitfall 2），b64_json 截断为 4 字符
{ "output": { "b64_json": [{ "bytesBase64": "iVBO", "mimeType": "png" }], "urls": [] } }

// gemini-response.json — gemini 路径（JSON 数组，含 thoughtSignature + inlineData）
// 关键：thoughtSignature 截断，只需结构正确，inlineData.data 为 4 字符占位
[
  { "candidates": [{ "content": { "parts": [{ "thoughtSignature": "<trunc>" }] } }] },
  { "candidates": [{ "content": { "parts": [{ "inlineData": { "data": "/9j/", "mimeType": "image/jpeg" } }] } }] }
]
```

---

## Shared Patterns

### 错误处理（所有 provider client 文件）
**Source:** `src/lib/sse.ts` lines 120-155 (`mapHttpError`) + lines 60-62 (`NetworkError`)
**Apply to:** `aihubmix-image.ts`（三路各自的 `try/catch` + `!resp.ok` 块）
```typescript
// fetch throw → NetworkError
try {
  resp = await fetch(url, { ... });
} catch {
  throw new NetworkError('<操作>网络失败');
}
// HTTP 错误 → mapHttpError
if (!resp.ok) {
  const errBody = await resp.json().catch(() => ({}));
  throw mapHttpError(resp.status, errBody);
}
```

### apiKey 安全约束（所有 provider client 文件）
**Source:** `src/providers/aihubmix-image.ts` lines 11-12 / `src/providers/aihubmix-vision.ts` lines 11-12
**Apply to:** `aihubmix-image.ts` 三路请求 headers
```typescript
// Bearer 模式（doubao / gpt-image-2）
Authorization: `Bearer ${config.apiKey}`
// Google 模式（gemini）
'x-goog-api-key': config.apiKey
// 两种模式都：不进 body，不进 error.message（T-01-04）
```

### vi.mock storage（所有 registry 相关测试）
**Source:** `src/providers/registry.test.ts` lines 19-30
**Apply to:** `registry.test.ts` 新增用例（复用现有 mock，无需重写）
```typescript
vi.mock('../lib/storage', () => ({
  storage: { get: vi.fn() },
  STORAGE_KEYS: { KEY_PREFIX: 'aster:keys:', ... },
}));
```

### `satisfies ImageConfig` 类型守门（registry.ts）
**Source:** `src/providers/registry.ts` lines 78-79 / 91-92
**Apply to:** `image-gen` case 改动后的 return 语句（保持 `satisfies` 检查）
```typescript
return {
  providerId: `${AIHUBMIX_PROVIDER_ID}-image`,
  baseURL: AIHUBMIX_IMAGE_BASE_URL,
  apiKey,
  model: DEFAULT_IMAGE_GEN_MODEL.id,
} satisfies ImageConfig;
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/providers/__fixtures__/doubao-response.json` | fixture data | — | 生图 fixture 目录尚不存在；内容由执行期真打录制，无历史 analog |
| `src/providers/__fixtures__/gpt-image-2-response.json` | fixture data | — | 同上 |
| `src/providers/__fixtures__/gemini-response.json` | fixture data | — | 同上；gemini 响应是 JSON 数组（多 chunk），结构特殊，无类似 fixture |

三个 fixture 的结构已在 RESEARCH.md §fixture 设计（D-14/D-15/D-16）中完整规定，Planner 直接引用。

---

## Critical Pitfalls for Planner

以下是代码库读取确认的、最高优先级注意点：

1. **baseURL 双 `/v1` 陷阱**：现有 `AIHUBMIX_BASE_URL = 'https://api.aihubmix.com/v1'` 仅适用于 vision（`/chat/completions`）。生图 base host 是 `https://aihubmix.com`（不含 `/v1`）。两个常量必须分开，`image-gen` case 用新的 `AIHUBMIX_IMAGE_BASE_URL`。

2. **gpt-image-2 output 是对象非数组**：`output.b64_json[0].bytesBase64`，不是 `output[0].bytesBase64`。与 doubao 的 `output[0].url` 路径完全不同。三路解析器必须各自独立。

3. **PPT normalize 作用域限制**：`normalizeToSnakeCase` 必须只对 `PPT_TOOLS` 集合内的工具生效（D-13）。Word/Excel 工具（`append_paragraph` 等）全用 camelCase，normalize 会破坏它们的 execute 参数读取，产生静默 undefined。

4. **registry.test.ts 现有断言过时**：line 101 `model: 'gpt-5.1'`、line 113 `model: 'gpt-image-2'`、image-gen 的 `baseURL: 'https://api.aihubmix.com/v1'` 三处必须同步更新，否则改完 registry 后 CI 立即红。

5. **gemini thoughtSignature 不是图片**：解析时遍历所有 chunks 的所有 parts，找到含 `inlineData` 字段的 part；不能直接取 `parts[0]`（可能是只含 `thoughtSignature` 的 part）。

---

## Metadata

**Analog search scope:** `src/providers/`, `src/agent/tools/`, `src/lib/sse.ts`
**Files scanned:** 10 (aihubmix-image.ts, aihubmix-vision.ts, registry.ts, registry.test.ts, types.ts, sse.ts, tools/index.ts, tools/dispatch.test.ts, tools/write/ppt.ts, providers/openai-compat.test.ts)
**Pattern extraction date:** 2026-06-01
