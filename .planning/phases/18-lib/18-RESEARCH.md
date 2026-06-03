# Phase 18: LIB — 公开图库检索（Pexels, BYO key） - Research

**Researched:** 2026-06-03
**Domain:** Pexels REST API + Phase 16 插图基础设施复用 + BYO key 存储 + 图库 write-tool 接入 agent loop
**Confidence:** HIGH（核心 API 合约已文档核实 + 代码核查完整）

---

<user_constraints>
## User Constraints（来自 CONTEXT.md）

### Locked Decisions

- **D-01（`search_stock_image` = loop 内 write tool，照抄 Phase 16 生图范式）**：AI 自动选首张 → fetch full-res → 裸 base64 → 插入当前 slide/body → 返回 shape_id。ToolDef 范式 = `generate_ppt_image`/`generate_word_image` 直接照抄。
- **D-02（undo/operationLog = 标准 write-tool reverse 路径，不用 `insertImage` helper）**：PPT reverse = `delete_shape_by_id`（Record 对象，snake_case）；Word reverse = `noop_inverse`。`src/lib/insertImage.ts` 建议删除（Q1=B 下无调用方）。
- **D-03（插入字节获取 = fetch Pexels full-res URL → 裸 base64）**：复用 `fetchUrlToBase64` 或等价小函数；选 `large` 或 `large2x` 尺寸。
- **D-04（AI 转英文搜，locale 仍 zh-CN）**：工具 description 明确指引 AI 传英文 query；`locale=zh-CN` 影响元数据排序。
- **D-05（换一张 = AI 翻页或重新检索）**：工具返候选游标或 AI 重调带 `page` 参数。
- **D-06（chat 内只读展示，无网格手动选）**：可选只读结果卡（仿 Phase 16 ImagePreviewCard 只读态）；缩略图用 Pexels 远程 URL 渲染 `<img src>`，无需 base64。
- **D-07（署名 = chat 内 text note + 可点链接，不叠水印）**：每张插入配署名「照片来自 Pexels · 摄影师 [name]（链接 → photographer_url/url）」。
- **D-08（独立 Settings 字段，Q3=A）**：新增 `STORAGE_KEYS.PEXELS_API_KEY`（字面 `'aster:keys:pexels'`，沿用 KEY_PREFIX）；`type="password"` 或可切显隐输入框；pref-section 范式仿 image-gen model picker。
- **D-09（填实 registry `stock-image` case）**：读 `PEXELS_API_KEY`，缺失 → `KeyInvalidError`；返回 config（baseURL 可配，默认 `'https://api.pexels.com/v1'`，留 Cloudflare Worker 切换口）。
- **D-10（新建 `src/providers/pexels-client.ts`，0 净新增依赖）**：native fetch；**Pexels 用 `Authorization: <API_KEY>`（裸 key，不加 Bearer！）**；apiKey 仅进 header，不进 body/error。
- **D-11（Excel 不注册工具 + 诚实提示）**。
- **D-12（per_page 10–15，planner 定）**。
- **D-13（三态结构化错误）**：未配 key → PERMISSION_DENIED；429 → HOST_API_FAILED 可恢复；无结果 → 友好提示可恢复；CORS/网络 → HOST_API_FAILED 可恢复；插入失败同 Phase 16。
- **D-14（NFR-09：插入用 base64 不进持久化历史）**：base64 只活在工具 execute 内；缩略图用远程 URL。
- **D-15（bundle ≤82KB gzip + teal UI + 中文）**：native fetch 零依赖，近零 bundle 增量；先 build 再 size。

### Claude's Discretion（planner 可定）

- 工具命名（`search_stock_image` vs `search_and_insert_stock_image`）
- `timeoutMs` 具体值（≥几十秒，覆盖 Pexels 检索 + full-res fetch）
- per_page 数量、full-res 取哪个尺寸（`large` vs `large2x`）
- `fetchUrlToBase64` 复用 vs 新写等价函数
- D-05「换一张」最简实现（工具返候选游标 vs AI 重调带 `page`）
- D-06 只读结果卡做不做 / 形态
- `insertImage.ts` helper 删除 vs 保留不动
- pexels client 代码组织 + `PexelsPhoto` 类型字段
- Settings 输入框显隐切换 / 是否加「测试 Key」按钮
- registry baseURL 可配的具体机制

### Deferred Ideas（OUT OF SCOPE）

- 缩略图网格手动选 UX（Q1=B 否决）
- Unsplash 备选接入（LIB-D1 deferred）
- 内置共享 Pexels key（永不做）
- 多变体并排选图
- 图片字节进持久化历史（NFR-09 反向约束）
- Excel 插入图片（无原生 API）
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIB-01 | Pexels 检索 — Settings 新增 BYO Pexels API key 字段；native fetch + `Authorization` header + `locale=zh-CN` | Pexels API 合约已核实（`Authorization: <KEY>`，无 Bearer）；STORAGE_KEYS 新增 `PEXELS_API_KEY`；Settings pref-section 范式已存在 |
| LIB-02 | 检索结果 → AI 自动选首张插入（复用 Phase 16 adapter 插图方法 + reverse 范式） | `generate_ppt_image`/`generate_word_image` 作为完整范式样板；`addImageShape` / `insertBodyImage` adapter 方法已交付；`fetchUrlToBase64` 可复用 |
| LIB-03 | chat 内显示 Pexels 摄影师署名 + 链接；不叠水印 | Pexels attribution 政策宽松（chat 内署名即满足）；photo.photographer + photo.photographer_url + photo.url 字段已核实 |
</phase_requirements>

---

## Summary

Phase 18 是 Phase 16 的「换数据源」版本——**核心插图路径（adapter 方法 + reverse/undo + loop-helpers appendOperation）完全复用，新增工作主要集中在 Pexels REST client、BYO key Settings 字段、URL→base64 转换、署名展示**四块。

Phase 16 已实测确认：`addImageShape`（PPT，GA 路线 addGeometricShape+fill.setImage）+ `insertBodyImage`（Word body 级）接受**裸 base64**；reverse 走 `delete_shape_by_id`（PPT）/ `noop_inverse`（Word）；loop-helpers 据 execute 返回的 `reverse` + `postState` 自动 `appendOperation`——Phase 18 完全照此路线。

Pexels API 合约已核实（`Authorization: <API_KEY>`，无 Bearer 前缀；200 req/h；`GET /v1/search` 返 `photos[].src.{large,large2x,medium,tiny,...}` + 摄影师信息）。关键风险点：① Pexels `api.pexels.com` API 调用 CORS 在 Office Web iframe 未真机实测（Phase 19 UAT 项）；② `images.pexels.com` CDN full-res `fetch→blob→base64` 有独立 CORS 风险（CDN 可能不带 ACAO header）。两处均已设计为可通过切换 baseURL 平滑切到 Cloudflare Worker 代理。

**Primary recommendation：** 照 `ppt-image.ts` 直接抄写新工具，主要改写三处：① 读 Pexels key → 调 pexels client 检索 → 选首张；② `fetch(photo.src.large) → blob → base64`（复用 `fetchUrlToBase64`）；③ 插入同 Phase 16 adapter 路线。Auth header 用裸 key（不加 `Bearer`）是唯一需要格外注意的 gotcha。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pexels 检索 API 调用 | Agent Loop（工具层 execute） | Provider（PexelsClient） | 工具调用 client.search()，结果（照片列表）留在 execute 内存态 |
| URL→base64 转换（full-res fetch） | Agent Loop 工具层 execute | Provider 工具函数 fetchUrlToBase64 | 需 AbortSignal 支持；从 execute 内调用 |
| 图片插入（PPT + Word） | Adapter 层（PptAdapter / WordAdapter） | — | 复用 Phase 16 已交付 addImageShape / insertBodyImage |
| undo reverse | operationLog replay engine + Adapter 层 | — | PPT: delete_shape_by_id；Word: noop_inverse；已有完整实现 |
| BYO key 存储 | 浏览器 partitioned localStorage（via storage lib） | — | STORAGE_KEYS.PEXELS_API_KEY = 'aster:keys:pexels' |
| Settings UI（key 输入框） | Frontend（React，SettingsPanel.tsx） | — | pref-section 范式，teal 克制 UI |
| 署名展示（chat 内） | Frontend（ChatBubble / ToolResultCard） | — | text note + 链接，仅 chat 内展示，不进文档 |
| 只读结果缩略图卡（可选） | Frontend（React 组件，仿 ImagePreviewCard 只读态） | — | 缩略图用远程 URL，不需 base64，CORS 不受限（img src 展示） |
| baseURL 路由（直连 vs Worker） | Provider（pexels-client.ts + registry） | — | baseURL 可配，默认直连，失败切 Worker 只改 baseURL |

---

## Standard Stack

### Core（全部已在 codebase，Phase 18 净新增 = 0 运行时依赖）

| 库/模块 | 版本/位置 | 用途 | 备注 |
|---------|----------|------|------|
| Pexels REST API | `https://api.pexels.com/v1` | 检索公开图库 | native fetch，0 SDK |
| `PptAdapter.addImageShape` | `src/adapters/PptAdapter.ts` ~L1659 | PPT 插图 | Phase 16 已交付；接受裸 base64；返回 `{newShapeId}` |
| `WordAdapter.insertBodyImage` | `src/adapters/WordAdapter.ts` ~L1785 | Word 插图 | Phase 16 已交付；接受裸 base64；body 级 |
| `fetchUrlToBase64` | `src/providers/aihubmix-image.ts` | 远程 URL → 裸 base64 | Phase 16 已建；透传 `signal` |
| `ProviderRegistry` + `stock-image` stub | `src/providers/registry.ts` L142–143 | 路由 Pexels 配置 | 填实 stub；缺 key → KeyInvalidError |
| `storage.get/set` + `STORAGE_KEYS` | `src/lib/storage.ts` | BYO key 读写 | 新增 `PEXELS_API_KEY = 'aster:keys:pexels'` |
| `appendOperation` + `OperationLogEntry` | `src/agent/operationLog.ts` | undo 记录 | loop-helpers 据 reverse/postState 自动调用，无需手动 |
| `KeyInvalidError` | `src/errors/index` | key 未配置错误 | 现有错误体系，D-13 沿用 |

### 净新增文件（估算 bundle 增量）

| 新增 | 估算 gzip 增量 | 备注 |
|------|---------------|------|
| `src/providers/pexels-client.ts`（native fetch） | ~1 KB | search + PexelsPhoto 类型 |
| `src/agent/tools/write/ppt-stock.ts`（或同名） | ~2 KB | 照抄 ppt-image.ts，替换数据源 |
| `src/agent/tools/write/word-stock.ts` | ~1.5 KB | 照抄 word-image.ts |
| Settings pref-section（新增约 20 行 TSX） | ~0.5 KB | 嵌入现有 SettingsPanel |
| 可选只读结果卡（复用 ImagePreviewCard 或内联） | ~1 KB | 无额外依赖 |
| **合计** | **~6 KB** | 远低于 82KB CI gate（当前 79.81KB，余量约 2KB；planner 需 build 后实测 size） |

> ⚠️ 当前 bundle 79.81 KB gzip，余量仅约 2 KB（门槛 82 KB）。planner 执行前先 `npm run build && npm run size` 确认基线。6 KB 估算是乐观值，实际可能更高（含 Lingui 宏字符串开销）。若超门，考虑把 pexels-client 改为懒加载路径（首次调用工具时才 import）。

---

## Architecture Patterns

### System Architecture Diagram

```
用户输入「帮我配一张海边日落的照片」
         │
         ▼
┌─────────────────────────────────────────────────┐
│  Agent Loop（loop.ts）                           │
│  search_stock_image tool 被 LLM 调               │
│  args: { query:"seaside sunset",                  │
│           slide_index:1, page:1 }                 │
│                                                   │
│  execute():                                       │
│    1. registry.resolve('stock-image')             │
│       → 读 STORAGE_KEYS.PEXELS_API_KEY           │
│       → 缺失 → 抛 KeyInvalidError                │
│         → return PERMISSION_DENIED 错误           │
│                                                   │
│    2. PexelsClient.search(query, {locale,         │
│         per_page:10, page:1, signal})             │
│       → fetch api.pexels.com/v1/search           │
│         Authorization: <RAW_KEY>（无 Bearer）      │
│       → 200 → photos[]                            │
│       → 429 → HOST_API_FAILED（可恢复）           │
│       → 0 results → 友好提示（可恢复）            │
│                                                   │
│    3. AI 选首张（可依 alt 质量排序，非机械 [0]）   │
│                                                   │
│    4. fetchUrlToBase64(photo.src.large, signal)   │
│       → fetch images.pexels.com/...              │
│       → blob → base64（裸，无 data: 前缀）        │
│       ⚠️ CORS 风险面②（见 Deferred）             │
│                                                   │
│    5. adapter.addImageShape(slideIndex,           │
│         base64, DEFAULT_IMAGE_POSITION)           │
│       → 返回 { newShapeId }                       │
│                                                   │
│    6. 返回 ToolResult {                           │
│         ok: true,                                 │
│         data: { shape_id, slide_index,            │
│                 photo_url, photographer,          │
│                 photographer_url, alt,            │
│                 thumbnail_url },                  │
│         reverse: { tool:'delete_shape_by_id',     │
│                    args:{ slide_index, shape_id }},│
│         postState: { kind:'ppt_shape_new',        │
│                       content:{ slideIndex,        │
│                                 shapeId } }        │
│       }                                           │
│  loop-helpers → appendOperation（单一 undo 记录） │
└───────────────┬─────────────────────────────────-┘
                │  ToolResult.data 含 photo 元数据
                ▼
┌─────────────────────────────────────────────────┐
│  ChatBubble + ToolResultCard                     │
│  - 可选只读缩略图卡（<img src=thumbnail_url>，   │
│    Pexels 远程 URL，<img> 不受 CORS 限制）         │
│  - 署名 text note：「照片来自 Pexels · 摄影师     │
│    [name]（链接 → photographer_url）」            │
│  - 无确认/选择/重新检索按钮                        │
└─────────────────────────────────────────────────┘
                │  用户可继续：「换一张 / 移到右边」
                ▼
  AI 重调 search_stock_image（带 page:2 翻页）
  或调 move_shape / set_shape_property 排版
```

### Recommended Project Structure（净新增文件）

```
src/
├── providers/
│   └── pexels-client.ts        # 新建：Pexels REST client
│                               #   search(query, opts) → PexelsPhoto[]
│                               #   PexelsPhoto 类型
├── agent/tools/write/
│   ├── ppt-stock.ts            # 新建：search_and_insert_stock_image PPT 版
│   └── word-stock.ts           # 新建：search_and_insert_stock_image Word 版
└── components/Settings/
    └── SettingsPanel.tsx       # 修改：新增「图库 / Pexels API Key」pref-section
```

（可复用：`aihubmix-image.ts::fetchUrlToBase64` / `storage.ts::STORAGE_KEYS` / `registry.ts::stock-image case`）

### Pattern 1: Pexels Client（裸 key 鉴权，0 SDK）

```typescript
// Source: Pexels API docs — https://www.pexels.com/api/documentation/
// [VERIFIED: WebFetch pexels.com/api/documentation/]
// 关键：Authorization: <API_KEY>（无 "Bearer " 前缀——与 aihubmix/DeepSeek 不同）

export interface PexelsPhoto {
  id: number;
  url: string;                    // Pexels 图片页
  photographer: string;
  photographer_url: string;
  alt: string;
  src: {
    original: string;
    large2x: string;              // ~1880px，适合高清展示
    large: string;                // ~940px，推荐插图用
    medium: string;               // ~350px
    small: string;                // ~130px
    portrait: string;
    landscape: string;
    tiny: string;                 // ~280px，推荐缩略图用
  };
}

export interface PexelsSearchOpts {
  per_page?: number;              // 默认 15，最大 80
  page?: number;                  // 默认 1
  locale?: string;                // 'zh-CN' 等
  orientation?: 'landscape' | 'portrait' | 'square';
  size?: 'large' | 'medium' | 'small';
  signal?: AbortSignal;
}

export async function searchPexels(
  query: string,
  apiKey: string,
  baseURL: string,
  opts: PexelsSearchOpts = {},
): Promise<PexelsPhoto[]> {
  const params = new URLSearchParams({
    query,
    per_page: String(opts.per_page ?? 10),
    page: String(opts.page ?? 1),
    ...(opts.locale && { locale: opts.locale }),
    ...(opts.orientation && { orientation: opts.orientation }),
    ...(opts.size && { size: opts.size }),
  });

  let resp: Response;
  try {
    resp = await fetch(`${baseURL}/search?${params}`, {
      headers: {
        'Authorization': apiKey,  // 裸 key，无 "Bearer " 前缀！（D-10 gotcha）
      },
      signal: opts.signal,
    });
  } catch {
    throw new NetworkError('Pexels 检索网络失败');
  }

  // 429 Rate Limit：X-Ratelimit-Remaining 降为 0
  if (resp.status === 429) {
    throw new RateLimitError('Pexels 检索过于频繁，请稍后再试');
  }
  if (!resp.ok) {
    throw mapHttpError(resp.status, {});
  }

  const data = await resp.json() as { photos: PexelsPhoto[]; total_results: number };
  return data.photos ?? [];
}
```

### Pattern 2: search_stock_image PPT 工具（照抄 ppt-image.ts）

```typescript
// Source: 直接类比 src/agent/tools/write/ppt-image.ts（Phase 16 实测验证）
// 主要改写点：① 读 Pexels key → searchPexels → 选首张 ② fetchUrlToBase64 ③ 同 Phase 16 插入路线

const STOCK_IMAGE_TIMEOUT_MS = 60_000; // 检索+fetch full-res，比生图快但仍需覆盖 CDN fetch

export const searchAndInsertStockImagePptTool: ToolDef = {
  name: 'search_and_insert_stock_image',  // 命名 planner 定
  kind: 'write',
  timeoutMs: STOCK_IMAGE_TIMEOUT_MS,
  description: '从 Pexels 图库检索免费正版照片并自动插入当前 PPT 幻灯片（居中）。' +
    'query 参数请用英文关键词（如用户说"海边日落"则传 "seaside sunset"）。' +
    '插入后可用 move_shape/set_shape_property 调整位置与大小。',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '英文图片搜索关键词（如 "seaside sunset", "office meeting"）' },
      slide_index: { type: 'number', description: '插入到第几张幻灯片（1 开始）。默认 1。' },
      page: { type: 'number', description: '检索结果翻页（1 开始，用于「换一张」）。默认 1。' },
    },
    required: ['query'],
  },
  // ... execute 实现：
  // 1. registry.resolve('stock-image') → 读 PEXELS_API_KEY，缺失 → PERMISSION_DENIED
  // 2. searchPexels(query, apiKey, baseURL, { per_page:10, page, locale:'zh-CN', signal })
  // 3. photos[0]（可选：按 alt 相关性选最匹配）→ 无结果 → 友好错误
  // 4. fetchUrlToBase64(photo.src.large, signal) → base64（复用 aihubmix-image.ts 中现有函数）
  // 5. adapter.addImageShape(slideIndex, base64, DEFAULT_IMAGE_POSITION)
  // 6. 返回 { ok:true, data:{ shape_id, photo_url, photographer, photographer_url, alt,
  //          thumbnail_url:photo.src.tiny }, reverse, postState }
};
```

### Pattern 3: registry `stock-image` case 填实

```typescript
// Source: 类比 src/providers/registry.ts L125–140 image-gen case
case 'stock-image': {
  const apiKey = storage.get<string>(STORAGE_KEYS.PEXELS_API_KEY);
  if (!apiKey) {
    throw new KeyInvalidError('Pexels Key 未配置，请在设置中填写图库 Key');
  }
  // baseURL 可配：默认直连；CORS 失败后切 Cloudflare Worker 时只改此值
  const baseURL = storage.get<string>(STORAGE_KEYS.PEXELS_BASE_URL_OVERRIDE)
    ?? PEXELS_DEFAULT_BASE_URL;  // 'https://api.pexels.com/v1'
  return {
    providerId: 'pexels',
    baseURL,
    apiKey,
    model: '',  // 图库无 model 概念
  } satisfies ImageConfig;
}
```

### Pattern 4: Settings pref-section（仿 image-gen model picker）

```typescript
// Source: 类比 src/components/Settings/SettingsPanel.tsx L192–213（已核查）
// 新增在 「生图模型」section 之后：

const [pexelsKey, setPexelsKeyState] = useState<string>(
  () => storage.get<string>(STORAGE_KEYS.PEXELS_API_KEY) ?? '',
);
const setPexelsKey = (key: string): void => {
  storage.set(STORAGE_KEYS.PEXELS_API_KEY, key);
  setPexelsKeyState(key);
};

// JSX：
<div className="aster-settings__section">
  <label className="aster-settings__label" htmlFor="setting-pexels-key">
    <Trans>图库 Key（Pexels）</Trans>
  </label>
  <input
    id="setting-pexels-key"
    type="password"  // 或 text + 显隐切换按钮（planner 定）
    className="aster-settings__pref-input"
    value={pexelsKey}
    onChange={(e) => setPexelsKey(e.target.value)}
    placeholder="your-pexels-api-key"
    aria-label={t`Pexels API Key`}
  />
  <p className="aster-settings__hint">
    <Trans>在 pexels.com/api 申请免费 Key，填入后可在对话中搜索并插入正版图片</Trans>
  </p>
</div>
```

### Anti-Patterns to Avoid

- **`Authorization: Bearer <key>`** — Pexels 用裸 key（无 `Bearer` 前缀），与 aihubmix/DeepSeek 不同。照抄 `sse.ts` 的 Bearer 范式会导致 401。[VERIFIED: WebFetch pexels.com/api/documentation/]
- **`fetch(photo.src.original)`** — `original` 可能数 MB，拖慢 fetch 撑 P95。改用 `large`（~940px）或 `large2x`（~1880px）。
- **调用 `insertImage.ts` helper** — D-02 明确：该 helper 为已否决的手动 appendOperation 路径设计，在 loop 工具里用会重复记录。Phase 18 直接调 adapter 方法，走标准 write-tool reverse 路径。
- **将 full-res base64 放入 `data.*` 字段后不做 NFR-09 白名单保护** — chat.ts serialize 白名单必须过滤 base64 字段；缩略图改用 `thumbnail_url`（远程 URL 字符串，不是 base64）。
- **`<img>` 缩略图用 base64** — 缩略图展示直接用 `photo.src.tiny`（远程 URL），`<img src>` 显示不受 CORS 限制，无需 base64 转换。
- **PPT 工具不加入 `PPT_TOOLS` Set** — 会导致 LLM 的 camelCase 参数没被 normalize，触发 casing 静默失败（Phase 14 D-10 复发）。

---

## Pexels API Exact Contract

> [VERIFIED: WebFetch pexels.com/api/documentation/]

### `GET /v1/search` 请求参数

| 参数 | 类型 | 是否必填 | 默认 | 说明 |
|------|------|---------|------|------|
| `query` | string | **必填** | — | 英文搜索词（D-04：AI 传英文） |
| `per_page` | integer | 可选 | 15 | 最大 80 |
| `page` | integer | 可选 | 1 | 翻页 |
| `locale` | string | 可选 | — | `zh-CN` 等（影响元数据，不影响关键词匹配） |
| `orientation` | string | 可选 | — | `landscape` / `portrait` / `square` |
| `size` | string | 可选 | — | `large`（≥24MP）/ `medium`（≥12MP）/ `small`（≥4MP） |
| `color` | string | 可选 | — | 颜色过滤（命名色或 hex） |

**鉴权：** `Authorization: <API_KEY>`（裸 key，**不加** `Bearer`）。

### `GET /v1/search` 响应 JSON

```json
{
  "total_results": 1234,
  "page": 1,
  "per_page": 10,
  "photos": [
    {
      "id": 12345678,
      "width": 6016,
      "height": 4016,
      "url": "https://www.pexels.com/photo/...",
      "photographer": "John Doe",
      "photographer_url": "https://www.pexels.com/@johndoe",
      "photographer_id": 9876543,
      "avg_color": "#3B5271",
      "alt": "Beautiful seaside sunset photo",
      "src": {
        "original": "https://images.pexels.com/photos/12345678/pexels-photo-12345678.jpeg",
        "large2x": "https://images.pexels.com/photos/12345678/pexels-photo-12345678.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "large": "https://images.pexels.com/photos/12345678/pexels-photo-12345678.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
        "medium": "https://images.pexels.com/photos/12345678/pexels-photo-12345678.jpeg?auto=compress&cs=tinysrgb&h=350&w=350",
        "small": "https://images.pexels.com/photos/12345678/pexels-photo-12345678.jpeg?auto=compress&cs=tinysrgb&h=130&w=130",
        "portrait": "https://images.pexels.com/photos/.../pexels-photo.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
        "landscape": "https://images.pexels.com/photos/.../pexels-photo.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
        "tiny": "https://images.pexels.com/photos/12345678/pexels-photo-12345678.jpeg?auto=compress&cs=tinysrgb&dpr=1&fit=crop&h=200&w=280"
      }
    }
  ],
  "next_page": "https://api.pexels.com/v1/search/?page=2&per_page=10&query=seaside+sunset"
}
```

### Rate Limit

| 项目 | 值 |
|------|----|
| 默认限额 | **200 req/h**，20,000 req/月 |
| 可申请提升 | 是（Pexels 开发者申请） |
| 响应头（仅 2xx） | `X-Ratelimit-Limit`, `X-Ratelimit-Remaining`, `X-Ratelimit-Reset` |
| 超限响应 | `HTTP 429`（工具须处理 → HOST_API_FAILED 可恢复） |

### 错误响应形态

Pexels 官方文档未明确记录错误响应 JSON 结构（仅记录状态码）。实践中：
- `401` — key 无效
- `429` — 超限
- `4xx` — 参数错误（通常附带简短 message）
- 建议：`resp.ok` 为 false 时直接按状态码映射错误，不依赖响应 JSON。

### 图片尺寸选择建议

| 用途 | 推荐尺寸 key | 典型分辨率 | 说明 |
|------|------------|-----------|------|
| 插入 PPT/Word（主路） | `large` | ~940px 宽 | 够清晰、文件不过大；fetch 速度可控 |
| 高清插入（planner 可选） | `large2x` | ~1880px 宽 | 更清晰但文件更大 |
| 缩略图展示（chat 内） | `tiny` | ~280px 宽 | `<img src>` 展示，不需 fetch→base64 |
| **避免** | `original` | 原始分辨率，数 MB | 拖慢 fetch，撑 P95 |

---

## CORS Double-Surface Risk Documentation

> 本阶段按直连实现；Phase 19 UAT 验证；失败后切 Worker 代理。

### 风险面一：`api.pexels.com` API 调用 CORS

- **场景：** `fetch('https://api.pexels.com/v1/search', {headers:{Authorization:'<KEY>'}})` 在 Office for Web Task Pane iframe 内执行
- **已知信息：** STACK.md + SUMMARY.md 记录「Pexels API 被大量 browser-side 应用直接调用」，MEDIUM 信心；但 Office Web Task Pane iframe 的 CSP/CORS 环境比普通浏览器页面更严格，未真机实测。[ASSUMED — 未在 Office Web iframe 验证]
- **Preflight 风险：** `Authorization` 是非简单头，会触发 CORS preflight（OPTIONS）。Pexels 需在 ACAO + Access-Control-Allow-Headers 中允许 `Authorization`——大概率是的，但未真机确认。

### 风险面二：`images.pexels.com` CDN full-res fetch→blob→base64

- **场景：** `fetch(photo.src.large)` → `blob()` → `FileReader.readAsDataURL()`（在 Task Pane iframe 内）
- **已知信息：** CDN 域名与 API 域名不同（`images.pexels.com`）；CDN 可能不带 `Access-Control-Allow-Origin` 响应头。`<img src>` 展示**不**受 CORS 限制，但 `fetch→blob` 受限。[ASSUMED — 未核实 images.pexels.com CORS headers]
- **严重程度：** 比风险面一更高——即使 API 调用通过，CDN fetch 失败也会导致插图功能完全无法工作。

### 设计预留（D-09 / D-03）

- **已预留**：`registry.ts` 的 `stock-image` case 中 baseURL **可配**（默认 `https://api.pexels.com/v1`，可 storage override）；`fetchUrlToBase64` 也通过统一入口调用 → CORS 失败后**只需把 baseURL 指向 Cloudflare Worker**，不改工具/UI 逻辑。
- **Worker 兜底设计**：API proxy = Worker 代理 `GET /api.pexels.com/v1/search`；图片 proxy = Worker 代理 `GET /images.pexels.com/*`（作为 base64 返回）。planner 本阶段不必实现，记录设计点即可。
- **Phase 19 UAT 验证项**（最高优先级）：在 Office for Web（Edge/Chrome 最新两版）实测两个 fetch 均通过。

---

## Don't Hand-Roll

| 问题 | 不要自己造 | 用现有 | 原因 |
|------|-----------|--------|------|
| URL → 裸 base64 转换 | 不要重写编解码 | `fetchUrlToBase64`（aihubmix-image.ts）| Phase 16 已建，透传 signal，doubao URL 场景实测稳定 |
| PPT undo（删除 shape） | 不要写新 inverse 实现 | `deleteShapeById`（PptAdapter.ts L1653）| 已有 + integration test 守门 |
| Word undo 不可能性 | 不要假装可以 undo | `noop_inverse` + skipped_error 诚实标注 | Phase 16 已验 |
| operationLog 自动追加 | 不要手动 appendOperation | loop-helpers 据 execute 返回的 reverse/postState 自动调用 | 这是 D-02 核心——execute 返 reverse descriptor，loop-helpers 处理，无需工具内手动调用 |
| Pexels SDK | 不要装 `pexels` npm 包 | native fetch，30 行实现完整 search | 0 净新增依赖约束（D-10） |
| Auth header 复用 | 不要照抄 sse.ts 的 Bearer 模式 | 手写 `Authorization: apiKey`（无前缀）| Pexels 鉴权与 OpenAI 兼容 API 不同 |

---

## Common Pitfalls

### Pitfall 1: `Authorization: Bearer <KEY>` 错误格式（最重要！）
**什么出错：** Pexels 返回 `401 Unauthorized`，虽然 key 本身有效。
**为何发生：** `src/lib/sse.ts` 中所有 LLM API 调用用 `Authorization: Bearer ${apiKey}`——但 Pexels 文档明确使用 `Authorization: ${apiKey}`（无 `Bearer` 前缀），是标准 API key auth 而非 Bearer token 模式。[VERIFIED: pexels.com/api/documentation/]
**如何避免：** pexels-client.ts 中写死 `headers: { 'Authorization': apiKey }`，不使用 `Bearer` 前缀，不复用 sse.ts 的 Bearer 拼接。
**预警信号：** search 返回 401 但 key 是从 pexels.com 申请的有效 key。

### Pitfall 2: `photo.src.original` 拖慢 fetch / 撑 P95
**什么出错：** full-res fetch 超时；或图片插入 PPT 体积过大。
**为何发生：** `original` 是原始分辨率，可能 5–20 MB；fetch 时间不可控。
**如何避免：** 使用 `photo.src.large`（~940px，通常 < 500 KB）或 `large2x`（~1880px）。timeoutMs 覆盖默认 15s，但仍需选合理尺寸。

### Pitfall 3: full-res CDN fetch CORS 失败（CORS 风险面二）
**什么出错：** `fetch(photo.src.large)` 在 Office Web iframe 抛 CORS 错误，但 `<img src=photo.src.tiny>` 缩略图正常显示。
**为何发生：** `<img>` 标签 = 简单请求，不触发 CORS；`fetch()` = 非简单请求，需 ACAO 响应头。
**如何避免（本阶段）：** 捕获 fetch 错误，返回 `HOST_API_FAILED`（可恢复），hint 告知「图库图片获取失败」；Phase 19 UAT 暴露后按 D-09 切 Worker 代理。
**预警信号：** 缩略图（img src）在 chat 内正常显示，但点击 execute 插入时失败。

### Pitfall 4: PPT 工具忘记加入 `PPT_TOOLS` Set（casing 静默失败）
**什么出错：** LLM 传 camelCase 参数（如 `slideIndex`）没有被 normalize，`args.slide_index` 为 undefined。
**为何发生：** Phase 14 D-10 中央归一化：只有在 `PPT_TOOLS` Set 里的工具名才会被 `normalizeToSnakeCase` 处理。
**如何避免：** 新增 PPT 工具时一定加入 `PPT_TOOLS`（`src/agent/tools/index.ts` L28–42）。

### Pitfall 5: 429 未处理导致工具崩溃
**什么出错：** Pexels 返回 429，工具抛未捕获错误，agent loop 显示「工具执行失败」而不是可恢复的「请稍后重试」。
**为何发生：** fetch `resp.ok` 检查将 429 归入同一「失败」桶，若不单独处理 429 就会走通用错误路径。
**如何避免：** 在 `resp.ok` 检查前先判 `resp.status === 429`，返回 `HOST_API_FAILED { recoverable: true }`。还可读 `X-Ratelimit-Reset` 头给用户「X 秒后重试」提示。

### Pitfall 6: `insertImage.ts` helper 误用
**什么出错：** 工具 execute 调了 `insertImage()` helper → 手动 appendOperation → loop-helpers 又据 reverse descriptor appendOperation → 同一步操作记两条 undo 记录，stepIndex 冲突。
**为何发生：** `insertImage.ts` 是为 Phase 16 D-02 解耦（UI 按钮触发）设计的，已被 Q1=B 反转废弃。文件头注释已说明「Q1=B 后可删」。
**如何避免：** loop 内工具**不调 insertImage helper**；直接调 adapter 方法，由 execute 返回 reverse descriptor，loop-helpers 自动 appendOperation。（D-02 reconcile）

### Pitfall 7: Lingui 宏字符串忘跑 extract
**什么出错：** `npm test` 报 `coverage.test.ts` 失败（未提取的宏字符串 mismatch）。
**为何发生：** Settings 新增 Lingui `<Trans>` 宏字符串后，若未运行 `npm run extract`，Lingui catalog 不同步。
**如何避免：** 每次改 UI 动 Lingui 宏后立即 `npm run extract`（memory: `project_i18n_extract_and_test_noise`）。

---

## Runtime State Inventory

> Phase 18 是净新增功能，不涉及运行时状态重命名。

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| 存储数据 | 无（Pexels key 是新增 storage key，无迁移） | 仅新增 STORAGE_KEYS.PEXELS_API_KEY |
| 活动服务配置 | 无 | — |
| OS 注册状态 | 无 | — |
| 密钥/环境变量 | 新增 `aster:keys:pexels` localStorage key（BYO，用户自填） | 仅代码新增，非迁移 |
| 构建产物 | 无 | — |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Pexels API（`api.pexels.com`） | LIB-01/02 | ✓（公开 API，注册即可申请 key） | n/a | — |
| `AihubmixImageClient::fetchUrlToBase64` | LIB-02（URL→base64） | ✓（`src/providers/aihubmix-image.ts`，Phase 16 已建） | 当前代码 | 新建等价函数（~10 行） |
| Office for Web（Edge/Chrome 最新两版） | LIB-02 真机 UAT | ✓（MVP 兼容矩阵） | — | — |
| Node.js + npm | 单测运行 | ✓ | v22.21.1 | — |
| Vitest | 测试框架 | ✓（已有 `vitest.config.ts`） | 既有 | — |
| Pexels API Key（开发测试用） | spike / dev 本地验证 | ⚠（需用户提供 `.env.local`，memory: `self_run_spikes`） | — | 可用 mock 跑单测；真机需真实 key |

**无阻塞缺失依赖。**

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest（已有 `vitest.config.ts`） |
| Config file | `vitest.config.ts`（项目根） |
| Quick run command | `npm test -- --run src/agent/operationLog.integration.test.ts` |
| Full suite command | `npm test -- --run` |
| 当前测试套件规模 | 857 tests（Phase 17 完成后，全量约数十秒） |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIB-01 | `pexels-client.search()` 构造正确的 `Authorization: <KEY>`（无 Bearer）| unit | `npm test -- --run src/providers/pexels-client.test.ts` | ❌ Wave 0 新建 |
| LIB-01 | `pexels-client.search()` 缺 key 时抛 `KeyInvalidError`（由 registry case 处理） | unit | `npm test -- --run src/providers/registry.test.ts` | ✅ 现有 `registry.test.ts` 需追加 stock-image 有 key / 无 key 分支 |
| LIB-01 | `STORAGE_KEYS.PEXELS_API_KEY` 新增 + `storage.get/set` 正常读写 | unit | `npm test -- --run src/providers/registry.test.ts` | ✅ 仿 vision/image-gen case 追加 |
| LIB-01 | Settings pref-section 新增字段存储 round-trip（写入 storage，re-read 一致） | unit | `npm test -- --run src/components/Settings/SettingsPanel.test.ts` | ⚠ 需确认 SettingsPanel.test.ts 已覆盖 pref-section（260531-b5o 有冒烟测试，追加 pexels key 存储断言） |
| LIB-02 | PPT `search_and_insert_stock_image` 工具：无 Pexels key → `PERMISSION_DENIED`（不可恢复） | unit | `npm test -- --run src/agent/tools/write/ppt-stock.test.ts` | ❌ Wave 0 新建 |
| LIB-02 | PPT `search_and_insert_stock_image` 工具：返回 `reverse.tool='delete_shape_by_id'`、`reverse.args` 为 Record 对象（snake_case）| unit | `npm test -- --run src/agent/tools/write/ppt-stock.test.ts` | ❌ Wave 0 新建 |
| LIB-02 | PPT `search_and_insert_stock_image` 工具：返回 `postState.kind='ppt_shape_new'`，content 为 camelCase `{slideIndex, shapeId}` | unit | `npm test -- --run src/agent/tools/write/ppt-stock.test.ts` | ❌ Wave 0 新建 |
| LIB-02 | Word `search_and_insert_stock_image` 工具：`reverse.tool='noop_inverse'`（Word 诚实标注） | unit | `npm test -- --run src/agent/tools/write/word-stock.test.ts` | ❌ Wave 0 新建 |
| LIB-02 | `operationLog.integration.test.ts` 守门：图库插入 PPT reverse → `delete_shape_by_id` → `rolled_back`（类比 Phase 16 L1223 图像守门） | integration | `npm test -- --run src/agent/operationLog.integration.test.ts -t "Phase 18"` | ❌ Wave 0 追加（project_adapter_inverse_signature 铁律） |
| LIB-02 | Excel `buildToolsForHost` 不含 `search_and_insert_stock_image`（D-11 per-host 守门） | unit | `npm test -- --run src/agent/tools/tools-host.test.ts` | ✅ 已有 tools-host.test.ts，追加断言 |
| LIB-02 | NFR-09：`search_and_insert_stock_image` ToolResult.data 不含 base64 字段（thumbnail_url 是 URL 字符串，非 base64） | unit | `npm test -- --run src/store/chat.test.ts -t "NFR-09"` | ✅ 追加路径 D（图库工具，仿路径 C）|
| LIB-03 | 工具 `data` 返回 `photographer`/`photographer_url`/`photo_url` 字段（署名数据） | unit | `npm test -- --run src/agent/tools/write/ppt-stock.test.ts` | ❌ Wave 0 包含（ppt-stock.test.ts） |

### Phase 16 测试模式类比

| Phase 18 守门项 | Phase 16 类比 | 文件位置 |
|----------------|--------------|---------|
| ppt-stock.test.ts — reverse descriptor 形状 | ppt-image.test.ts | `src/agent/tools/write/ppt-image.test.ts`（已有，复用 mock 结构） |
| word-stock.test.ts — noop_inverse reverse | word-image.test.ts | `src/agent/tools/write/word-image.test.ts`（已有，复用 mock 结构） |
| operationLog.integration — 图库 PPT 守门 | Phase 16 L1223 `generate_ppt_image` 守门 | `src/agent/operationLog.integration.test.ts` L1220 |
| registry.test.ts — stock-image 有 key 路径 | image-gen 有 key 路径 | `src/providers/registry.test.ts` L125–151 |
| NFR-09 路径 D | NFR-09 路径 C（image preview） | `src/store/chat.test.ts` |

### Sampling Rate

- **每 task commit：** `npm test -- --run`（全量，本项目无 wave 分支，857+ tests，约数十秒）
- **每 wave merge：** 同上（全量）
- **Phase gate（`/gsd-verify-work` 前）：** 全量绿 + bundle CI gate（`npm run build && npm run size`）+ `npm run extract`（Lingui catalog 同步）+ 本地 dev 实测图库检索（有真实 Pexels key）

### Wave 0 Gaps

- [ ] `src/providers/pexels-client.test.ts` — 覆盖 LIB-01：auth header 无 Bearer、query 参数构建、429 处理、fetchUrlToBase64 调用（mock `fetch`）
- [ ] `src/agent/tools/write/ppt-stock.test.ts` — 覆盖 LIB-02：无 key → PERMISSION_DENIED；reverse.args 为 Record snake_case；postState 形状；data.photographer 存在；data 无 base64 字段（NFR-09）
- [ ] `src/agent/tools/write/word-stock.test.ts` — 覆盖 LIB-02：Word noop_inverse；data 无 base64
- [ ] `src/agent/operationLog.integration.test.ts` — 追加 Phase 18 守门 describe block（`search_and_insert_stock_image` PPT → `delete_shape_by_id` → `rolled_back`；Word → `noop_inverse` → `skipped_error`）
- [ ] `src/providers/registry.test.ts` — 追加 `stock-image` 有 key case（返回 config 含 `providerId:'pexels'`）；`PEXELS_API_KEY` 缺失 → KeyInvalidError（已有 ModelNotFoundError stub 测试，需替换为实际实现后的 KeyInvalidError 测试）
- [ ] `src/store/chat.test.ts` — 追加 NFR-09 路径 D：图库工具 result 含 `thumbnail_url`（URL 字符串）+ 无 `base64` 字段，serialize 后 localStorage 内容不包含 base64 pattern

*Vitest 框架已存在，无需安装。以上为新增 / 追加测试文件。*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Pexels query 参数经 `encodeURIComponent`；provider 错误 message 用字面量（不 interpolate err.message 防 key 泄漏，继承 T-14-01）|
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Pexels API key 泄漏进错误消息 | Information Disclosure | T-14-01 继承：error.message 用字面量中文，不 interpolate err.message；apiKey 仅进 `Authorization` header，不进 request body |
| base64 图片数据进 localStorage（NFR-09 违反） | Information Disclosure | ToolResult.data 用 `thumbnail_url`（URL 字符串，非 base64）；chat.ts serialize 白名单过滤 base64；unit test 守门（路径 D）|
| Pexels API key 进聊天历史 / LLM 上下文 | Information Disclosure | key 只在 registry.resolve → pexels-client 内部流转，不进 ToolResult.data，不进 Message.content |
| 恶意图片 URL 注入（通过 query 参数） | Tampering | query 经 `encodeURIComponent`；URL 来自 Pexels 可信域（photos[] 结构化，非用户直传 URL）|

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pexels `api.pexels.com/v1/search` 在 Office for Web Task Pane iframe 内不被 CORS 拦截（Authorization preflight 通过） | CORS Double-Surface Risk | 功能完全无法工作（API 调用失败）；触发 Cloudflare Worker fallback，本阶段需额外工作 |
| A2 | Pexels `images.pexels.com` CDN 支持 `Access-Control-Allow-Origin: *`，`fetch→blob→base64` 在 Task Pane iframe 内不被 CORS 拦截 | CORS Double-Surface Risk | full-res 图片无法 fetch；插图功能完全无法工作；触发 Worker 图片代理，比 A1 失败代价更高 |
| A3 | `fetchUrlToBase64`（`aihubmix-image.ts`）可直接用于 Pexels full-res URL（两者均为普通 HTTPS GET，函数已接受任意 URL） | Pattern 2 / D-03 | 若 Pexels CDN 需要额外 headers（如 Referer），需扩展函数；影响 D-03 实现 |
| A4 | Pexels API 返回的 `photos[].alt` 字段足够 AI 做质量排序（D-01「可依 alt 相关性选最匹配」） | D-01 | 若 alt 质量差，AI 只能机械取 `photos[0]`；用户体验降级但不影响功能正确性 |
| A5 | 当前 bundle 基线为 79.81 KB gzip（Phase 17 完成后）；Phase 18 净增约 6 KB，仍在 82 KB 门槛内 | Standard Stack（bundle 估算） | 若超 82 KB，需将 pexels-client 改为懒加载路径（首次调用工具时才 import），或精简 Settings 字段实现 |

**A1 + A2 是最高风险 assumption**，均为「Phase 19 UAT 最高风险项」的直接原因。Phase 19 UAT 是唯一验证路径。

---

## Open Questions

1. **Pexels CDN CORS（images.pexels.com）**
   - 已知：`<img src>` 展示不受限制；`fetch→blob` 受限
   - 未知：`images.pexels.com` 是否带 `Access-Control-Allow-Origin: *`
   - 建议：Phase 18 按直连实现，Phase 19 UAT 实测；plan 中注明「若 CDN fetch 被 CORS 拦，退路 = 缩略图改 canvas 重绘（可能也不行），最终回到 Worker 代理」

2. **`fetchUrlToBase64` 复用 vs 新写**
   - 已知：`aihubmix-image.ts` 中的 `fetchUrlToBase64` 已测试稳定（doubao URL 场景）
   - 未知：planner 倾向复用还是在 pexels-client 内写等价小函数（隔离依赖）
   - 建议：复用为优先（已有 signal 支持、符合 D-03）；若 planner 担心 aihubmix-image.ts 导出接口污染，可提取到 `src/lib/fetchToBase64.ts` 共享

3. **bundle 余量**
   - 已知：Phase 17 完成后 79.81 KB；门槛 82 KB；余量约 2.2 KB
   - 未知：Phase 18 实际增量（估算 ~6 KB，但 Lingui 宏 + React 组件可能更高）
   - 建议：planner 第一步 `npm run build && npm run size` 确认当前基线，若余量不足立即将 pexels-client 改为懒加载

---

## State of the Art

| 旧做法 | 当前做法 | 变更时间 | 影响 |
|--------|---------|---------|------|
| Phase 16 CONTEXT 原始 D-02「生图与插入解耦，insertImage helper」 | 2026-06-02 Q1=B 反转：loop 内 write tool 直接插入，reverse 走标准路径，insertImage helper 废弃 | 2026-06-02 | Phase 18 全程用 write-tool 路径，insertImage.ts 建议删除 |
| REQUIREMENTS.md LIB-02「检索结果缩略图网格 → 选中插入」 | 2026-06-02 Q1=B 反转：AI 自动选首张直插，无网格手动选 | 2026-06-02 | search_stock_image 是 write tool，不是 read tool |
| `Authorization: Bearer <KEY>`（OpenAI compat 范式） | Pexels 用 `Authorization: <KEY>`（裸 key，无 Bearer） | Pexels API 设计 | 不能复用 sse.ts 的 Bearer 鉴权模式 |

**废弃 / 过时：**
- `src/lib/insertImage.ts`：为 Q1=A（grid-select）设计，Q1=B 后无调用方，建议 Phase 18 删除（D-02 建议）。

---

## Sources

### Primary（HIGH confidence — 代码直读 + 官方文档核实）

- `src/agent/tools/write/ppt-image.ts`（完整文件直读）— `search_stock_image` PPT 范式样板；timeoutMs / snake_case / reverse/postState 完整实现
- `src/agent/tools/write/word-image.ts`（完整文件直读）— Word 范式样板；noop_inverse
- `src/providers/registry.ts` L85–151（直读）— `stock-image` stub 填实位置；image-gen case 作为类比
- `src/lib/storage.ts`（完整文件直读）— STORAGE_KEYS 约定、KEY_PREFIX = `'aster:keys:'`、partitioned localStorage
- `src/components/Settings/SettingsPanel.tsx` L80–248（直读）— image-gen model picker pref-section 范式（仿照点）
- `src/agent/operationLog.integration.test.ts` L1220–1255（直读）— Phase 16 generate_ppt/word_image 守门范式（Phase 18 直接类比）
- `src/providers/registry.test.ts`（直读头部 + stock-image 部分）— 现有 stock-image 测试形态（从 ModelNotFoundError 改为 KeyInvalidError）
- [Pexels API Documentation](https://www.pexels.com/api/documentation/) — `Authorization: <KEY>` 裸格式已核实；`/v1/search` 参数完整列表；响应 JSON 结构；200 req/h rate limit；X-Ratelimit headers [VERIFIED: WebFetch]

### Secondary（MEDIUM confidence）

- `.planning/research/STACK.md`（Pexels vs Unsplash 对比，CORS 理由，Attribution 宽松说明）
- `.planning/research/SUMMARY.md`（L33 Pexels 选型；L68/L108–111 CORS spike 风险；L76 Cloudflare Worker 逃生路线）
- `.planning/phases/16-img-ppt-word/16-RESEARCH.md`（Phase 16 完整研究，Phase 18 的直接模板）
- `.planning/phases/16-img-ppt-word/16-VALIDATION.md`（validation 格式模板）

### Tertiary（LOW confidence — 假设，需 Phase 19 UAT 验证）

- Pexels `api.pexels.com` 在 Office Web Task Pane iframe 内无 CORS 拦截（大量 browser-side 调用证据，但 Task Pane iframe 未真机实测）
- Pexels `images.pexels.com` CDN 带 `Access-Control-Allow-Origin: *`（未专门核实 CDN CORS headers）

---

## Metadata

**Confidence breakdown:**
- Pexels API 合约（auth header、响应字段、rate limit）: HIGH — 官方文档 WebFetch 核实
- Phase 16 插图基础设施复用（adapter 方法、reverse 范式、loop-helpers）: HIGH — 代码直读，Phase 16 已实测
- registry / storage / Settings 集成点: HIGH — 代码直读，完整类比
- Pexels CORS 在 Office Web iframe: LOW（ASSUMED）— Phase 19 UAT 验证
- bundle 增量估算: MEDIUM — 基于代码规模估算，需 build 后实测

**Research date:** 2026-06-03
**Valid until:** 2026-07-03（Pexels API 合约稳定；Office.js 版本变化可能影响 CORS 行为）
