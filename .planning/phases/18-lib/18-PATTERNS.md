# Phase 18: LIB（公开图库检索，Pexels BYO key） - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 8 个净新增/修改文件（含 1 个 DELETE + 2 个守门测试）
**Analogs found:** 8 / 8

---

## File Classification

| 新增/修改文件 | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/providers/pexels-client.ts` | provider client | request-response | `src/providers/aihubmix-image.ts` | exact |
| `src/agent/tools/write/search-stock-image.ts` | tool (write) | request-response | `src/agent/tools/write/ppt-image.ts` (PPT) + `src/agent/tools/write/word-image.ts` (Word) | exact |
| `src/providers/registry.ts` (修改 L142-143) | config / registry | CRUD | `src/providers/registry.ts` L112-140（vision/image-gen case） | exact |
| `src/lib/storage.ts` (修改 L19-47) | config / utility | CRUD | `src/lib/storage.ts` L44-46（PREF_IMAGE_GEN_MODEL 新增范式） | exact |
| `src/components/Settings/SettingsPanel.tsx` (修改) | component (settings form) | CRUD | `src/components/Settings/SettingsPanel.tsx` L85-93（image-gen picker state）+ L192-213（pref-section 渲染） | exact |
| `src/agent/tools/index.ts` (修改 PPT_TOOLS + buildToolsForHost) | config / registry | CRUD | `src/agent/tools/index.ts` L30-45（PPT_TOOLS Set）+ L254-312（buildToolsForHost） | exact |
| DELETE `src/lib/insertImage.ts` | utility (zero callers) | — | — | — |
| `src/agent/operationLog.integration.test.ts` (新增守门) | test | CRUD | `src/agent/operationLog.integration.test.ts` L1216-1255（Phase 16 生图守门） | exact |
| `src/store/chat.test.ts` (新增 NFR-09 路径 E，若 result 携 base64) | test | CRUD | `src/store/chat.test.ts` L368-398（NFR-09 路径 C） | exact |

---

## Pattern Assignments

---

### `src/providers/pexels-client.ts` (provider client, request-response)

**Analog:** `src/providers/aihubmix-image.ts`（整个文件）

**Imports pattern** (`aihubmix-image.ts` L16-18):
```typescript
import { mapHttpError } from '../lib/sse';
import { NetworkError } from '../errors';
import type { ImageGenResult, ImageConfig, ImageProvider } from './types';
```

**Pexels client 应使用的 imports（对照调整）:**
```typescript
import { NetworkError } from '../errors';
// 不需要 mapHttpError（Pexels 错误走自定义字面量）；不需要 ImageProvider 接口（另建 PexelsProvider 接口）
```

**fetch client 结构**（`aihubmix-image.ts` L26-45，仿照但不改 Bearer）:
```typescript
// 仿照 class 结构：export class PexelsClient
// 核心 search 方法：
async search(query: string, opts: PexelsSearchOpts): Promise<PexelsPhoto[]> {
  const url = `${baseURL}/search?query=...&per_page=...&page=...&locale=zh-CN`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: {
        Authorization: apiKey,  // ⚠️ Pexels 裸 key，不加 Bearer 前缀（D-10 gotcha）
        // 对照 aihubmix-image.ts L62: Authorization: `Bearer ${apiKey}` — Pexels 去掉 Bearer
      },
      signal: opts.signal,  // 透传 signal（仿 aihubmix-image.ts L74: signal: options?.signal）
    });
  } catch {
    throw new NetworkError('Pexels 检索请求网络失败');
  }
  // ...
}
```

**🔴 鉴权 gotcha 对照（必读）:**
```typescript
// aihubmix-image.ts L62（勿复制此行到 pexels-client）：
Authorization: `Bearer ${apiKey}`

// pexels-client.ts 正确写法（裸 key，D-10）：
Authorization: apiKey
```

**URL→base64 helper**（无独立 `fetchUrlToBase64` 函数存在于 codebase，需在 pexels-client 内写等价实现，仿 aihubmix-image.ts 中各 `_generate*` 的 fetch-blob 逻辑）:
```typescript
// 仿照思路（aihubmix-image.ts 中各方法的 resp→json→base64 流程，改为 resp→blob→base64）：
async function fetchImageToBase64(url: string, signal?: AbortSignal): Promise<string> {
  let resp: Response;
  try {
    resp = await fetch(url, { signal });
  } catch {
    throw new NetworkError('Pexels 图片 fetch 失败');
  }
  if (!resp.ok) throw new NetworkError(`Pexels 图片 HTTP ${resp.status}`);
  const blob = await resp.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);  // 裸 base64
    reader.onerror = () => reject(new NetworkError('Pexels 图片 base64 转换失败'));
    reader.readAsDataURL(blob);
  });
}
```

**PexelsPhoto 接口建议（Claude discretion）:**
```typescript
export interface PexelsPhoto {
  id: number;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    tiny: string;
  };
  photographer: string;
  photographer_url: string;
  url: string;
  alt: string;
}
```

---

### `src/agent/tools/write/search-stock-image.ts` (tool, request-response)

**Analog（PPT 路径）:** `src/agent/tools/write/ppt-image.ts`（整个文件 = 最直接模板）

**Analog（Word 路径）:** `src/agent/tools/write/word-image.ts`（整个文件）

**文件头注释范式**（`ppt-image.ts` L1-20）:
```typescript
/**
 * src/agent/tools/write/search-stock-image.ts — search_and_insert_stock_image 工具（LIB-01/02）
 *
 * 产品方向（Q1=B，2026-06-02 用户拍板）：
 *   loop 内自动检索 Pexels + 选首张 + fetch full-res → 裸 base64 → 直插当前 slide/body。
 *   返回 shape_id（PPT）供 AI 自主排版；chat 内署名 note（LIB-03）。
 *   不走 insertImage helper（D-02 reconcile）。
 *
 * 撤销：PPT = delete_shape_by_id（Record 对象）；Word = noop_inverse。
 * per-host：PPT/Word 注册，Excel 不注册（D-11）。
 */
```

**ToolDef 结构 + timeoutMs + snake_case 参数**（`ppt-image.ts` L37-62）:
```typescript
const IMAGE_GEN_TIMEOUT_MS = 120_000;  // ppt-image.ts L37（沿用同一常量）

export const searchAndInsertStockImageTool: ToolDef = {
  name: 'search_and_insert_stock_image',  // snake_case，须加入 PPT_TOOLS Set
  kind: 'write',
  timeoutMs: IMAGE_GEN_TIMEOUT_MS,  // ppt-image.ts L45：覆盖默认 15s
  description: '...',  // 指引 AI 传英文 query（D-04），说明自动选首张插入
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '英文检索词（请翻译用户意图为英文，如 seaside sunset）' },
      slide_index: { type: 'number', description: '插入到第几张幻灯片（1开始，仅 PPT 有效）' },
      page: { type: 'number', description: '检索页码（1开始，默认 1；用于换一张时翻页）' },
    },
    required: ['query'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    return `搜索并插入图库图片：${String(a.query ?? '').slice(0, 20)}`;
  },
  // ...
};
```

**PPT execute 路径 — 从 registry 读 key + 调 pexels client + 调 adapter**（仿 `ppt-image.ts` L63-187）:
```typescript
async execute(args, ctx): Promise<ToolResult> {
  const a = args as Record<string, unknown>;
  const query = a.query as string;
  const slideIndex = typeof a.slide_index === 'number' && a.slide_index >= 1 ? a.slide_index : 1;

  // 读 Pexels API key（仿 ppt-image.ts L89-116 的 registry.resolve → KeyInvalidError 处理）
  let apiKey: string;
  try {
    const cfg = ProviderRegistry.resolve('stock-image', () => { throw new Error('unused'); });
    apiKey = (cfg as { apiKey: string }).apiKey;
  } catch (err) {
    if (err instanceof KeyInvalidError) {
      return { ok: false, error: { code: 'PERMISSION_DENIED', message: 'Pexels Key 未配置，请在设置中填写图库 Key', recoverable: false, hint: '前往设置 → 图库 → 填写 Pexels API Key' } };
    }
    return { ok: false, error: { code: 'HOST_API_FAILED', message: '图库配置解析失败', recoverable: false, hint: '检查图库 Provider 配置' } };
  }

  // 检索 + 选首张 + fetch base64
  // ...（参照 ppt-image.ts L118-137 的生图调用 + 错误包装模式）

  // 插入（直接调 adapter，仿 ppt-image.ts L139-160）
  let newShapeId: string;
  try {
    const inserted = await (ctx.adapter as PptAdapter).addImageShape(slideIndex, base64, DEFAULT_IMAGE_POSITION);
    newShapeId = inserted.newShapeId;
  } catch (err) {
    console.error('[search_and_insert_stock_image] PPT 插入失败', err);
    return { ok: false, error: { code: 'HOST_API_FAILED', message: 'PPT 图片插入失败，请重试', recoverable: true, hint: '宿主插图 API 失败' } };
  }

  // reverse + postState（完全仿 ppt-image.ts L162-186）
  const reverse: ReverseDescriptor = {
    tool: 'delete_shape_by_id',
    args: { slide_index: slideIndex, shape_id: newShapeId },  // Record 对象，snake_case
  };
  const postState: PostStateSnapshot = {
    kind: 'ppt_shape_new',
    content: { slideIndex, shapeId: newShapeId },  // camelCase content（守门一致）
  };

  return {
    ok: true,
    data: {
      shape_id: newShapeId,   // AI 自主排版用（ppt-image.ts L177 同款）
      slide_index: slideIndex,
      photographer: photo.photographer,          // LIB-03 署名
      photographer_url: photo.photographer_url,  // LIB-03 链接
      photo_url: photo.url,
      thumbnail_url: photo.src.tiny,  // Pexels 远程 URL（不是 base64，可直接 <img src>）
      inserted: true,
    },
    reverse,
    postState,
  };
}
```

**Word execute 路径 — noop_inverse**（仿 `word-image.ts` L128-162）:
```typescript
// Word 路径：调 WordAdapter.insertBodyImage(base64) → noop_inverse
const reverse: ReverseDescriptor = {
  tool: 'noop_inverse',
  args: { reason: 'Word 图片插入暂不支持自动撤销' },  // word-image.ts L149
};
return { ok: true, data: { photographer, photographer_url, inserted: true, thumbnail_url: photo.src.tiny }, reverse };
```

**⚠️ 关键差异点（相对 ppt-image.ts）：**
- 数据源：不调 `AihubmixImageClient`，改调 `PexelsClient.search()` → 选首张 → `fetchImageToBase64(photo.src.large)`
- 返回 `data` 不含 `thumbnail`（base64）：Pexels 缩略图用远程 URL `photo.src.tiny`（`thumbnail_url`）不是 base64，天然避免 NFR-09 风险
- `data.photographer` + `data.photographer_url` 供 chat 署名 note（LIB-03）
- `data.photo_url` 供署名链接（Pexels attribution 要求 chat 内显示即可，D-07）

---

### `src/providers/registry.ts` — 修改 `stock-image` case (L142-143)

**Analog:** `src/providers/registry.ts` L112-140（`vision` case 和 `image-gen` case）

**vision case（L112-123，标准 key 读取 + KeyInvalidError 范式）:**
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
```

**image-gen case（L125-140，带 storage.get PREF override）:**
```typescript
case 'image-gen': {
  const apiKey = storage.get<string>(STORAGE_KEYS.KEY_PREFIX + AIHUBMIX_PROVIDER_ID);
  if (!apiKey) {
    throw new KeyInvalidError('aihubmix Key 未配置，请在设置中填写 aihubmix Key');
  }
  const preferredModel = storage.get<string>(STORAGE_KEYS.PREF_IMAGE_GEN_MODEL);
  const modelId = preferredModel ?? DEFAULT_IMAGE_GEN_MODEL.id;
  return {
    providerId: `${AIHUBMIX_PROVIDER_ID}-image`,
    baseURL: AIHUBMIX_IMAGE_BASE_URL,
    apiKey,
    model: modelId,
  } satisfies ImageConfig;
}
```

**stock-image case 填实形态（仿 vision case，不含 model override）:**
```typescript
case 'stock-image': {
  // D-09：读 Pexels API Key（STORAGE_KEYS.PEXELS_API_KEY = 'aster:keys:pexels'）
  const apiKey = storage.get<string>(STORAGE_KEYS.PEXELS_API_KEY);
  if (!apiKey) {
    throw new KeyInvalidError('Pexels Key 未配置，请在设置中填写图库 Key');
  }
  // D-09：baseURL 设计为可配（Cloudflare Worker 兜底切换口）
  const PEXELS_BASE_URL = 'https://api.pexels.com/v1';
  return {
    providerId: 'pexels',
    baseURL: PEXELS_BASE_URL,
    apiKey,
    model: '',  // Pexels 无 model 概念，占位符
  } satisfies ImageConfig;
}
```

**当前 stub 位置（L142-143，替换点）:**
```typescript
case 'stock-image':
  throw new ModelNotFoundError('stock-image Provider 未配置（v1 不含图库）');
```

---

### `src/lib/storage.ts` — 新增 `PEXELS_API_KEY` (L19-47)

**Analog:** `src/lib/storage.ts` L44-46（PREF_IMAGE_GEN_MODEL 新增范式）

**现有 STORAGE_KEYS 末尾（L44-47，落脚点）:**
```typescript
  /** Phase 16 IMG-04 (D-04)：用户持久选择的生图 model ID（string，来自 IMAGE_GEN_MODELS）。
   *  缺省时 registry image-gen resolve 回退到 DEFAULT_IMAGE_GEN_MODEL（doubao-seedream-5.0-lite）。*/
  PREF_IMAGE_GEN_MODEL: 'aster:pref:image-gen-model',
} as const;
```

**新增写法（在 `PREF_IMAGE_GEN_MODEL` 后追加，仿 KEY_PREFIX L23 约定）:**
```typescript
  /** Phase 18 LIB-01（D-08）：用户 BYO Pexels API Key（string）。
   *  registry stock-image resolve 读此 key；缺失时抛 KeyInvalidError（引导去 Settings）。
   *  沿用 KEY_PREFIX = 'aster:keys:' 约定（非 PREF 前缀：这是 key，非 pref）。 */
  PEXELS_API_KEY: 'aster:keys:pexels',
```

---

### `src/components/Settings/SettingsPanel.tsx` — 新增 Pexels API Key pref-section

**Analog（state + storage 读写）:** `src/components/Settings/SettingsPanel.tsx` L85-93（image-gen model picker state）

**image-gen model picker state 范式（L85-93，直接照抄 + 改 key 名）:**
```typescript
// L85-93（照抄此块，key 名改为 PEXELS_API_KEY，state 改为 string）：
const [imageGenModel, setImageGenModelState] = useState<string>(
  () => storage.get<string>(STORAGE_KEYS.PREF_IMAGE_GEN_MODEL) ?? DEFAULT_IMAGE_GEN_MODEL.id,
);
const setImageGenModel = (modelId: string): void => {
  storage.set(STORAGE_KEYS.PREF_IMAGE_GEN_MODEL, modelId);
  setImageGenModelState(modelId);
};
```

**对应 Pexels key state 写法:**
```typescript
const [pexelsApiKey, setPexelsApiKeyState] = useState<string>(
  () => storage.get<string>(STORAGE_KEYS.PEXELS_API_KEY) ?? '',
);
const setPexelsApiKey = (key: string): void => {
  if (key) storage.set(STORAGE_KEYS.PEXELS_API_KEY, key);
  else storage.remove(STORAGE_KEYS.PEXELS_API_KEY);
  setPexelsApiKeyState(key);
};
```

**Analog（渲染 pref-section）:** `src/components/Settings/SettingsPanel.tsx` L192-213（生图 model 下拉）+ L219-244（自定义偏好 textarea）

**生图 model 下拉 section（L192-213，结构模板）:**
```tsx
<div className="aster-settings__section">
  <label className="aster-settings__label" htmlFor="setting-image-gen-model">
    <Trans>生图模型</Trans>
  </label>
  <select
    id="setting-image-gen-model"
    className="aster-settings__select"
    value={imageGenModel}
    onChange={(e) => setImageGenModel(e.target.value)}
    aria-label={t`生图模型`}
  >
    {IMAGE_GEN_MODELS.map((m) => (
      <option key={m.id} value={m.id}>{m.label}</option>
    ))}
  </select>
  <p className="aster-settings__hint">
    <Trans>默认生图模型。预览卡内可临时切换不保存。</Trans>
  </p>
</div>
```

**自定义偏好 textarea section（L219-244，密码态输入框参考）:**
```tsx
<textarea
  className="aster-settings__pref-input"
  placeholder={...}
  maxLength={500}
  value={rawInput}
  onChange={(e) => setPrefs(e.target.value)}
  aria-label={t`自定义偏好`}
/>
```

**Pexels API Key pref-section 应采用的形态（`<input type="password">` 或可切显隐）:**
```tsx
{/* Phase 18 LIB-01（D-08）— 图库 / Pexels API Key */}
<div className="aster-settings__section">
  <label className="aster-settings__label" htmlFor="setting-pexels-key">
    <Trans>图库 / Pexels API Key</Trans>
  </label>
  <input
    id="setting-pexels-key"
    type="password"
    className="aster-settings__pref-input"
    placeholder={t`粘贴 Pexels API Key`}
    value={pexelsApiKey}
    onChange={(e) => setPexelsApiKey(e.target.value)}
    aria-label={t`Pexels API Key`}
    autoComplete="off"
  />
  <p className="aster-settings__hint">
    <Trans>用于从 Pexels 免费图库检索正版图片插入 PPT / Word。在 pexels.com/api 免费申请。</Trans>
  </p>
</div>
```

**追加位置：** 在生图 model 下拉 section（L192-213）之后、自定义偏好 textarea（L219-244）之前。

**i18n 提醒：** 所有 `<Trans>` 宏新增后**必须运行 `npm run extract`**（否则 coverage.test.ts 变红，参见 memory `project_i18n_extract_and_test_noise`）。

---

### `src/agent/tools/index.ts` — PPT_TOOLS Set + buildToolsForHost

**Analog（精确 file:line）:**
- `PPT_TOOLS` Set 定义：`src/agent/tools/index.ts` L30-45
- `buildToolsForHost` 函数：`src/agent/tools/index.ts` L254-312
- `generatePptImageTool` import 已在 L16
- `generateWordImageTool` import 已在 L17

**PPT_TOOLS Set（L30-45，在此追加新工具名）:**
```typescript
const PPT_TOOLS = new Set([
  // ... 现有 14 条（L31-44）...
  'generate_ppt_image', // Phase 16 IMG-01（L44）
  // Phase 18 新增（必须加入，否则 normalizeToSnakeCase 不处理其参数，casing 静默失败）：
  // 'search_and_insert_stock_image',
]);
```

**buildToolsForHost — word case（L257-273，在 generateWordImageTool 后加）:**
```typescript
case 'word': {
  const wordWriteTools = [
    // ... 现有工具 ...
    generateWordImageTool, // Phase 16 IMG-02（L264）
    // Phase 18 新增（在 generateWordImageTool 后）：
    // searchAndInsertStockImageTool,
    batchWrite,
  ] as ToolDef[];
```

**buildToolsForHost — ppt case（L291-308，在 generatePptImageTool 后加）:**
```typescript
case 'ppt': {
  const pptWriteTools = [
    // ... 现有工具 ...
    generatePptImageTool, // Phase 16 IMG-01（L299）
    // Phase 18 新增（在 generatePptImageTool 后）：
    // searchAndInsertStockImageTool,
    batchWrite,
  ] as ToolDef[];
```

**buildToolsForHost — excel case（L274-290）:** 不修改（D-11，Excel 不注册图库工具）。

---

### DELETE `src/lib/insertImage.ts`

**验证：零运行时调用方（已确认）**

搜索结果表明 `src/lib/insertImage.ts` 只在以下位置以注释/JSDoc 形式被引用，**无任何 `import` 语句**：
- `src/agent/tools/write/ppt-image.ts` L12（注释）
- `src/agent/tools/write/word-image.ts` L10（注释）
- `src/agent/operationLog.integration.test.ts` L1235（注释）
- `src/adapters/PptAdapter.ts` L1657（JSDoc `@returns` 注释）

**删除操作：** 直接删除文件。需同步清理上述 4 处注释中的 JSDoc/注释 wording（将「insertImage helper」相关描述改为中性描述，不影响运行时逻辑）。

---

### `src/agent/operationLog.integration.test.ts` — 新增 search_and_insert_stock_image 守门

**Analog（精确 file:line）:** `src/agent/operationLog.integration.test.ts` L1215-1255（Phase 16 生图守门块）

**PPT 路径守门（照抄 L1223-1241，改 toolName + humanLabel）:**
```typescript
it('Phase 18: search_and_insert_stock_image (PPT) → delete_shape_by_id → rolled_back', async () => {
  mockPpt('');
  const adapter = new PptAdapter();
  const entry: OperationLogEntry = {
    runId: 'r18-ppt', stepIndex: 0,
    toolName: 'search_and_insert_stock_image',  // D-17 硬卡：字面量必须出现在本文件
    args: {},
    humanLabel: '搜索并插入图库图片到第 1 页',
    reverse: { tool: 'delete_shape_by_id', args: { slide_index: 1, shape_id: 'new-shape-uuid' } },
    postState: { kind: 'ppt_shape_new', content: { slideIndex: 1, shapeId: 'new-shape-uuid' } },
    timestamp: 0,
  };
  const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
  expect(detail.status).toBe('rolled_back');
});
```

**Word 路径守门（照抄 L1243-1254，改 toolName）:**
```typescript
it('Phase 18: search_and_insert_stock_image (Word) → noop_inverse → skipped_error', async () => {
  const entry: OperationLogEntry = {
    runId: 'r18-word', stepIndex: 0,
    toolName: 'search_and_insert_stock_image',
    args: {},
    humanLabel: '搜索并插入图库图片到 Word 文档',
    reverse: { tool: 'noop_inverse', args: { reason: 'Word 图片插入暂不支持自动撤销' } },
    timestamp: 0,
  };
  const detail = await replayUndoSingle(entry, {} as DocumentAdapterForReplay);
  expect(detail.status).toBe('skipped_error');
});
```

**追加位置：** 在 L1255（Phase 16 守门块 `});` 结束后）新建 `describe('集成：Phase 18 图库工具 inverse replay 守门', ...)`。

**D-17 硬卡说明：** `src/agent/operationLog.integration.test.ts` L376 和 L644-645 注释说明「toolName 字符串字面量必须出现在本文件，contract.test.ts fs.readFileSync 扫描」——新工具名 `'search_and_insert_stock_image'`（或最终命名）必须以字面量字符串出现。

---

### `src/store/chat.test.ts` — NFR-09 路径 E（若 result 携带 base64）

**说明：** 与 Phase 16 生图工具不同，`search_and_insert_stock_image` 的 `data` 字段返回的是 Pexels 远程 URL（`thumbnail_url: photo.src.tiny`），**不是 base64**。因此只要保持 `data.thumbnail_url` 为 URL 字符串而非 base64，不会触发 NFR-09 base64 泄漏风险，理论上不需要新路径守门。

**但若实现中 `data` 任何字段携带 base64（如复用了 `data.thumbnail: base64` 结构），则参照 `src/store/chat.test.ts` L368-398（路径 C）新增路径 E：**

```typescript
// 路径 E 模板（仅在 data 含 base64 时启用）：
it('NFR-09 路径 E: 图库插入 ToolResult.data（如有 base64 字段）不出现在序列化结果', () => {
  // 参照路径 C（L371-398）：构造含 thumbnail base64 的 tool message → saveHistory → 断言 tool role 不出现
});
```

**`serializeForStorage` 白名单（`src/store/chat.ts` L122-135）** 已天然过滤 tool role，无需修改：
```typescript
// chat.ts L122-135（现有，不需修改）：
function serializeForStorage(messages: Message[]): StorableMessage[] {
  return messages
    .filter(
      (m): m is Message & { role: 'user' | 'assistant' } =>
        (m.role === 'user' || m.role === 'assistant') && !m.isStreaming,
    )
    // ...
}
```

---

### 可选 `src/components/StockImageResultCard.tsx`（Claude discretion，D-06 只读署名卡）

**Analog:** `src/components/ImagePreviewCard.tsx`（整个文件，28 行）

**ImagePreviewCard 只读卡结构（L1-40，完整文件）:**
```tsx
export function ImagePreviewCard({ base64, mimeType, host }: ImagePreviewCardProps): ReactElement {
  const hostLabel = host === 'ppt' ? '已插入到 PPT' : '已插入到 Word';
  return (
    <div className="aster-tool-card img-result-card">
      <img
        src={`data:${mimeType};base64,${base64}`}  // 生图用 base64
        alt="已插入的生成图片"
        className="img-result-card__thumb"
      />
      <div className="img-result-card__label">{hostLabel}</div>
    </div>
  );
}
```

**StockImageResultCard 对应写法（缩略图改用 Pexels 远程 URL，D-06）:**
```tsx
export function StockImageResultCard({ thumbnailUrl, photographer, photographerUrl, photoUrl, host }: Props): ReactElement {
  const hostLabel = host === 'ppt' ? '已插入到 PPT' : '已插入到 Word';
  return (
    <div className="aster-tool-card img-result-card">
      <img
        src={thumbnailUrl}   // Pexels 远程 URL（不是 base64，无 CORS 限制于 <img src>）
        alt="已插入的图库图片"
        className="img-result-card__thumb"
      />
      <div className="img-result-card__label">{hostLabel}</div>
      <div className="img-result-card__attribution">
        照片来自 <a href={photoUrl} target="_blank" rel="noopener noreferrer">Pexels</a>
        {' · 摄影师 '}
        <a href={photographerUrl} target="_blank" rel="noopener noreferrer">{photographer}</a>
      </div>
    </div>
  );
}
```

---

## Shared Patterns

### 三态结构化错误（Phase 15 D-13 继承）
**Source:** `src/agent/tools/index.ts` L66-82 `ToolError` interface
**Apply to:** `search-stock-image.ts`（所有 error return 分支）
```typescript
// 三类错误 code（D-13）：
// ① 未配 Pexels key → code: 'PERMISSION_DENIED', recoverable: false
// ② Pexels 429 速率超限 → code: 'HOST_API_FAILED', recoverable: true
// ③ 无结果 → ok: true, data: { results: 0 }（让 AI 换 query，不算错误）
// ④ CORS/网络失败 → code: 'HOST_API_FAILED', recoverable: true
// ⑤ 插入失败 → code: 'HOST_API_FAILED', recoverable: true
```

### loop-helpers appendOperation 自动路径
**Source:** `src/agent/loop-helpers.ts` L157-170
**Apply to:** `search-stock-image.ts`（execute 返回 reverse + postState，loop-helpers 自动调 appendOperation）
```typescript
// loop-helpers.ts L157-170：
if (result.reverse && def) {
  const opIndex = getOperationsByRun(runId).length;
  appendOperation({
    runId, stepIndex: opIndex, toolName: tc.name, args: tc.arguments,
    humanLabel, reverse: result.reverse,
    postState: result.postState,
    subOps: result.subOps,
    timestamp: Date.now(),
  });
}
// 关键：只要 execute 返回 result.reverse 不为 undefined，loop-helpers 自动记录——不需手动调 appendOperation
```

### adapter inverse 签名（Record 对象，非位置参）
**Source:** `src/adapters/PptAdapter.ts` L1653（`deleteShapeById` 签名）
**Apply to:** `search-stock-image.ts` PPT reverse.args 格式
```typescript
// delete_shape_by_id 消费约定（memory: project_adapter_inverse_signature）：
reverse: { tool: 'delete_shape_by_id', args: { slide_index: slideIndex, shape_id: newShapeId } }
// args 必须是 Record 对象 snake_case，不能用位置参（如 [1, 'shape-id']）
```

### apiKey 安全约束（T-14-01）
**Source:** `src/providers/aihubmix-image.ts` L5-7（安全注释）+ L62（header 写法）
**Apply to:** `pexels-client.ts`（apiKey 仅进 header，不进 body/error，不 interpolate）
```typescript
// T-14-01 约束：
// ✓ headers: { Authorization: apiKey }
// ✗ body: JSON.stringify({ apiKey })       — 不进 body
// ✗ message: `${err.message} key=${apiKey}` — 不进 error message
```

### PPT_TOOLS Set 守门（Phase 14 D-10）
**Source:** `src/agent/tools/index.ts` L29-45（PPT_TOOLS）+ L47-56（normalizeToSnakeCase）
**Apply to:** `search_and_insert_stock_image` 工具名必须加入 PPT_TOOLS（否则 LLM 传 camelCase 参数时 normalizeToSnakeCase 不处理，静默失败）

### CSS teal 设计系统（2026-05-29 起）
**Source:** `src/styles.css` CSS 变量体系
**Apply to:** `StockImageResultCard.tsx`（可选），SettingsPanel 新增 section 的 className
- 卡片用 `.aster-tool-card`（`styles.css` 已有，ImagePreviewCard.tsx L31 范例）
- 按钮用 `.btn .btn-ghost .btn-sm`；input 用 `.aster-settings__pref-input`
- 禁止硬编码 hex/px，全走 CSS 变量

---

## Exact File:Line 速查（planner 关键锚点）

| 关键点 | 文件 | 行号 |
|---|---|---|
| `stock-image` stub（填实点） | `src/providers/registry.ts` | L142-143 |
| vision case 样板（key 读取范式） | `src/providers/registry.ts` | L112-123 |
| image-gen case 样板（带 pref override） | `src/providers/registry.ts` | L125-140 |
| `STORAGE_KEYS` 末尾（追加 PEXELS_API_KEY 点） | `src/lib/storage.ts` | L44-47 |
| `KEY_PREFIX = 'aster:keys:'` 约定 | `src/lib/storage.ts` | L23 |
| imageGenModel state（D-08 写法模板） | `src/components/Settings/SettingsPanel.tsx` | L85-93 |
| image-gen pref-section（section 结构模板） | `src/components/Settings/SettingsPanel.tsx` | L192-213 |
| pref-input 文本输入范式 | `src/components/Settings/SettingsPanel.tsx` | L219-244 |
| `PPT_TOOLS` Set（追加新工具名点） | `src/agent/tools/index.ts` | L30-45 |
| `buildToolsForHost` word case | `src/agent/tools/index.ts` | L256-273 |
| `buildToolsForHost` ppt case | `src/agent/tools/index.ts` | L291-308 |
| `generatePptImageTool` import | `src/agent/tools/index.ts` | L16 |
| `generateWordImageTool` import | `src/agent/tools/index.ts` | L17 |
| loop-helpers appendOperation 调用 | `src/agent/loop-helpers.ts` | L157-170 |
| `serializeForStorage` 白名单（NFR-09） | `src/store/chat.ts` | L122-135 |
| NFR-09 路径 C（测试模板） | `src/store/chat.test.ts` | L368-398 |
| Phase 16 生图守门（Phase 18 测试模板） | `src/agent/operationLog.integration.test.ts` | L1215-1255 |
| D-17 toolName 字面量扫描说明 | `src/agent/operationLog.integration.test.ts` | L376, L644-645 |
| `IMAGE_GEN_TIMEOUT_MS = 120_000` | `src/agent/tools/write/ppt-image.ts` | L37 |
| PPT reverse 范式（delete_shape_by_id + postState） | `src/agent/tools/write/ppt-image.ts` | L162-186 |
| Word noop_inverse reverse 范式 | `src/agent/tools/write/word-image.ts` | L147-149 |
| `TaskKind` 含 `'stock-image'` | `src/providers/types.ts` | L24 |
| `StockImageProvider` 接口（可参考） | `src/providers/types.ts` | L110-119 |
| `ImagePreviewCard` 只读卡（署名卡模板） | `src/components/ImagePreviewCard.tsx` | L23-40 |
| `insertImage.ts` 零 import 确认 | `src/lib/insertImage.ts` | 整个文件（建议删除） |

---

## No Analog Found

Phase 18 所有文件均在 codebase 中找到贴近 analog，无「无 analog」文件。

唯一外部参考：Pexels API 鉴权格式（`Authorization: <raw key>` 无 Bearer 前缀）无法从 codebase 验证，见 D-10 gotcha 说明——已在本文档 `pexels-client.ts` 节明确标注。

---

## Metadata

**Analog search scope:** `src/agent/tools/write/`、`src/providers/`、`src/lib/storage.ts`、`src/components/Settings/`、`src/agent/tools/index.ts`、`src/agent/loop-helpers.ts`、`src/store/chat.ts`、`src/agent/operationLog.integration.test.ts`、`src/store/chat.test.ts`、`src/components/ImagePreviewCard.tsx`
**Files scanned:** 13
**Pattern extraction date:** 2026-06-03
