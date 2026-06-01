# Architecture Research — Aster v2.2 多模态四件套

**Domain:** Office.js Add-in 多模态集成 (PPT/Excel/Word, no-backend, BYO Key)
**Researched:** 2026-06-01
**Confidence:** HIGH (基于真实代码库完整阅读 + spike 011 实测锁定格式)

---

## 一、现有架构地图（v2.2 前基线）

```
┌──────────────────────── Task Pane (浏览器 WebView) ─────────────────────────┐
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  ChatStream  │  │  InputBar   │  │AgentControlBar│  │  DiffLogPanel   │  │
│  │  .tsx        │  │  .tsx       │  │  .tsx         │  │  .tsx (lazy)    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬────────┘  └──────────────────┘  │
│         │                │                │                                  │
├─────────┴────────────────┴────────────────┴──────────────────────────────────┤
│                     Zustand Stores                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  chatStore  │  │ agentStore  │  │ providerStore│  │ preferencesStore │   │
│  │ messages[]  │  │ runAgent()  │  │ providers[]  │  │ userPrefs        │   │
│  │ sendMessage │  │ abort()     │  │ getKey()     │  │                  │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘  └──────────────────┘   │
│         │                │                │                                  │
├─────────┴────────────────┴────────────────┘──────────────────────────────────┤
│                     Agent Layer                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  loop.ts (≤80 lines while-runner, max_steps=20, AbortController)    │    │
│  │  loop-helpers.ts  (streamAssistantTurn / runOneToolCall / truncate)  │    │
│  └──────────┬────────────────────────────────┬─────────────────────────┘    │
│             │                                │                               │
│  ┌──────────┴──────────┐      ┌──────────────┴───────────┐                   │
│  │  tools/index.ts     │      │  operationLog.ts          │                   │
│  │  buildToolsForHost  │      │  Map<runId, entries[]>    │                   │
│  │  dispatchTool       │      │  replayUndoAll            │                   │
│  │  assertWriteTool    │      │  executeReverse (switch)  │                   │
│  └──────────┬──────────┘      └───────────────────────────┘                   │
│             │                                                                 │
│  ┌──────────┴──────────────────────────────────────────────────────────┐     │
│  │  tools/read/{ppt,excel,word}.ts  +  tools/write/{ppt,excel,word}.ts │     │
│  │  tools/write/batch.ts  +  tools/common.ts (selectionDetail)         │     │
│  └──────────┬──────────────────────────────────────────────────────────┘     │
│             │                                                                 │
├─────────────┴─────────────────────────────────────────────────────────────────┤
│                     Adapter Layer                                              │
│  ┌─────────────┐  ┌───────────────┐  ┌──────────────────────────────────┐    │
│  │ PptAdapter  │  │ ExcelAdapter  │  │         WordAdapter               │    │
│  │ .ts         │  │ .ts           │  │         .ts                       │    │
│  └──────┬──────┘  └───────┬───────┘  └──────────────────┬───────────────┘    │
│         │                 │                              │                    │
├─────────┴─────────────────┴──────────────────────────────┴────────────────────┤
│                     Provider Layer                                             │
│  ┌──────────────────┐  ┌────────────────────┐  ┌────────────────────────────┐ │
│  │ openai-compat.ts │  │ aihubmix-vision.ts │  │   aihubmix-image.ts        │ │
│  │ (LLM streaming)  │  │ (已有，未接 agent)  │  │ (已有，wire format 需重写)  │ │
│  └──────────────────┘  └────────────────────┘  └────────────────────────────┘ │
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  registry.ts — ProviderRegistry.resolve(taskKind) 路由表                  │  │
│  │  taskKind: 'chat' | 'short-task' | 'vision' | 'image-gen' | 'stock-image'│  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────┘
                              ↓ fetch (browser, no backend)
         ┌────────────────────┬────────────────────┬─────────────────────┐
         │ api.deepseek.com   │ api.aihubmix.com   │ unsplash/pexels API │
         │ (LLM text/chat)    │ /v1 + /gemini/v1beta│ (stock images)     │
         └────────────────────┴────────────────────┴─────────────────────┘
```

---

## 二、v2.2 各特性集成点分析

### MM-01 视觉看图（Vision Evidence）

**核心问题：** 是一个独立的 READ TOOL（返回文字 evidence 给 loop），而不是消息内容层的 image_url augmentation。

**理由：** loop.ts 的 `WireMessage` 类型当前只有 `content: string`，把图片 base64 直接塞进用户/assistant 消息需要改动 wire message 结构和 `streamAssistantTurn` 调用。Read tool 路径完全复用现有 `ToolDef` + `dispatchTool` + `wrapReadResult` 框架，zero 结构变更，只需新增一个 read tool + adapter 方法。

**数据流：**
```
LLM 调用 analyze_image({ slide_index:1, shape_id:'xxx', question:'描述内容' })
  ↓ dispatchTool
  ↓ execute: 1. adapter.getShapeImageBytes(slideIndex, shapeId) → base64
             2. AihubmixVisionClient.analyze(question, base64, mimeType, config)
             3. return wrapReadResult({ ok:true, data: { analysis: visionResult.content } },
                  { result_type:'document_content', source:`slide_${n}.shape_${id}.vision` })
  ↓ loop-helpers.runOneToolCall → messages.push({role:'tool', content: JSON.stringify(result)})
  ↓ LLM 收到 vision evidence，继续下一步
```

**三宿主图片字节提取 — 是本特性难度最高的部分：**

Office.js 没有直接的 `shape.getImageAsBase64()` API。三宿主实现路径各不同：

| 宿主 | 图片来源 | Office.js 路径 | 置信度 |
|------|---------|---------------|--------|
| PPT | Picture shape（图片占位符）| `shape.image.getBase64ImageData()` (PowerPointApi 1.5) | MEDIUM — API 存在但真机 Web 端未验 |
| PPT | Chart shape | `shape.getAsImage()` 或 `presentation.getAsImage()` 截图路径 | LOW — Office.js 截图 API 兼容性不稳 |
| Excel | 图表 (Chart) | `chart.getImage()` (ExcelApi 1.2) → 返回 base64 | MEDIUM — 已有记录 |
| Word | InlinePicture | `inlinePicture.getBase64ImageData()` (WordApi 1.1) | HIGH — API 稳定 |

**实现建议：** 短期内仅支持 PPT Picture shape + Word InlinePicture（最高把握），Excel chart 和 PPT chart 标为 "LOW — 退化到不支持"，工具描述里注明。

**新增的 ReadableQuery kind（需改 `src/adapters/DocumentAdapter.ts`）：**
```typescript
| { kind: 'get_shape_image'; slideIndex: number; shapeId: string }  // PPT
| { kind: 'get_inline_picture_image'; index: number }               // Word
| { kind: 'get_chart_image'; sheetName: string; chartName: string } // Excel
```

**Provider 路由：**
`aihubmix-vision.ts` 客户端已存在，已会发 `POST /chat/completions` + `image_url` content block（gpt-4o，非流式）。它当前完全独立，从未被 agent loop 调用。

接入点：`src/providers/registry.ts` 的 `case 'vision'` 已存在，返回 `ImageConfig`（baseURL / apiKey / model）。vision read tool 的 `execute` 里直接 `new AihubmixVisionClient().analyze(...)` 即可，不需要通过 registry（因为 registry 是给 loop.ts 的 LLM 文字 provider 用的，vision 是单次非流式调用，直接构造客户端更直接）。

**文件变更（MM-01）：**

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/adapters/DocumentAdapter.ts` | 改 | ReadableQuery 加 `get_shape_image` / `get_inline_picture_image` / `get_chart_image` |
| `src/adapters/PptAdapter.ts` | 改 | `read()` switch 加 `get_shape_image` case，调 `shape.image.getBase64ImageData()` |
| `src/adapters/WordAdapter.ts` | 改 | `read()` switch 加 `get_inline_picture_image` case |
| `src/adapters/ExcelAdapter.ts` | 改 | `read()` switch 加 `get_chart_image` case (可选/LOW confidence) |
| `src/agent/tools/read/ppt.ts` | 改 | 新增 `analyzeImageOnSlide` ToolDef（kind:'read'） |
| `src/agent/tools/read/word.ts` | 改 | 新增 `analyzeInlinePicture` ToolDef |
| `src/agent/tools/index.ts` | 改 | `buildToolsForHost` 三个 case 各加 vision read tool |
| `src/providers/aihubmix-vision.ts` | 改 | model 更新从 gpt-4o → gpt-5.1（配合 MM-05 registry 修正） |

---

### MM-02 文件附件解析（Attachment Parse → Context）

**设计边界：** 附件 vs agent 自取文档是两条独立路径，UX 边界必须清晰。

| 路径 | 触发 | 内容 | 在 messages 里的位置 |
|------|------|------|---------------------|
| Agent read tools | LLM 主动调用（loop 内） | 当前打开文档的实时内容 | `role:'tool'` result |
| 文件附件 | 用户点 paperclip 上传 | 外部文件解析出的文本 | `role:'user'` content 的一部分（注入 prompt），或独立的 system-level context message |

**推荐设计：附件注入为 user message 的附加上下文，不进 agent tool loop。**

理由：附件解析是一次性、同步的（解析完成才发送），不需要 LLM 多步迭代。把解析文本拼到 user prompt 前/后是最简路径，符合 chatStore 现有的 `sendMessage(prompt, ...)` 模式。

**数据流：**
```
用户点 paperclip → 选文件 → FileReader.readAsArrayBuffer
  ↓ (按文件类型懒加载解析器)
  ├── .docx → mammoth (lazy import)
  ├── .xlsx → SheetJS (lazy import from cdn.sheetjs.com)
  ├── .pdf  → pdfjs-dist (lazy import, worker)
  ├── .pptx → jszip DIY (lazy import) 或 @jvmr/pptx-to-html
  └── 图片 (.jpg/.png/.gif) → 不解析文本，base64 存进 attachments[]，vision read tool 消费
  ↓
解析出 parsedText (string, ≤10000字符 soft cap, applySizeCap 复用)
  ↓
InputBar 本地 state: attachments: Array<{ name, parsedText, base64?, mimeType? }>
  ↓ 用户点发送
augmentedPrompt = `[附件：${name}]\n${parsedText}\n\n${userText}`
chatStore.sendMessage(augmentedPrompt, selectionCtx, adapter)
```

**chatStore.Message 无需结构性改动。** 附件文本注入 user prompt 字符串即可，持久化时同样序列化为 `role:'user'` 文本（2000 字符 cap 照旧）。

**图片附件的特殊处理：** 如果用户上传图片文件（不是解析文件内容，而是要让 AI 看图），有两种选择：
1. 简单：base64 拼入 user prompt，通过 vision read tool 消费（但 read tool 需要 Office 文档上下文，图片附件是独立的）
2. 推荐（稍复杂）：图片附件直接触发 `AihubmixVisionClient.analyze` 一次性调用（不走 agent loop），把 vision 结果作为 system context 注入。这与 MM-01 的 read-tool 路径是互补的，都用同一个 vision 客户端。

**InputBar 改动：**
- 激活 `PaperclipIcon` 按钮（当前 `aria-disabled="true"`）
- 新增 `<input type="file">` 隐藏元素
- 新增本地 state `attachments[]`
- 文件解析进度显示（loading 态，文件名 + spinner）

**文件变更（MM-02）：**

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/components/InputBar.tsx` | 改 | 激活 paperclip，添加 file input + 本地 attachments state，拼 augmentedPrompt |
| `src/lib/fileParser.ts` | 新增 | 懒加载各格式解析器，统一返回 `{ text: string }` |
| `src/agent/read-result.ts` | 复用 | `applySizeCap` 直接复用于 parsedText 截断 |

---

### MM-03 图片生成并插入（Insert Generated Image）

**这是集成复杂度最高的特性**（原因见§五）。

#### (a) base64 vs URL 统一表示

Spike 011 已锁定三模型的 response 格式：
- doubao → `output[].url`（签名 URL，有时效）
- gpt-image-2 → `output.b64_json[].bytesBase64`（base64 PNG，3MB）
- gemini → `candidates[].content.parts[].inlineData.data`（base64 JPEG）

**内部统一为 base64 data URL 字符串（`data:<mimeType>;base64,<data>`）。**

理由：Office.js 的 PPT `shapes.addImage()` 和 Word `body.insertInlinePictureFromBase64()` 都吃 base64；如果把 URL 直接传给 Office，需要 Office 内部 fetch，这会在 Office for Web 的 CORS 沙箱里出问题。doubao 的 URL 需要在 Tool execute 里由 Aster 的浏览器 fetch 一次，转成 base64，然后再调 Office.js。

**统一转换逻辑（在 `aihubmix-image.ts` 重写里实现）：**
```typescript
// doubao: fetch URL → ArrayBuffer → base64
// gpt-image-2: bytesBase64 已是 base64，只需加 prefix
// gemini: inlineData.data 已是 base64，只需加 prefix
export interface ImageGenResult {
  dataUrl: string;  // data:image/png;base64,... 或 data:image/jpeg;base64,...
  mimeType: 'image/png' | 'image/jpeg';
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number } | null;
}
```

#### (b) `aihubmix-image.ts` 重写（MM-05 配套）

当前文件写的是旧 `gpt-image-1` + `/images/generations` 端点，与 spike 011 完全不同。需要完整重写。

**新 API 分发逻辑（按 model 字符串路由）：**
```typescript
export type ImageModel =
  | 'doubao-seedream-5.0-lite'
  | 'gpt-image-2'
  | 'gemini-3.1-flash-image-preview';

export class AihubmixImageClient {
  async generate(prompt: string, model: ImageModel, config: ImageGenConfig): Promise<ImageGenResult> {
    switch (model) {
      case 'doubao-seedream-5.0-lite': return this.callDoubao(prompt, config);
      case 'gpt-image-2': return this.callGptImage2(prompt, config);
      case 'gemini-3.1-flash-image-preview': return this.callGemini(prompt, config);
    }
  }
  private async callDoubao(...): Promise<ImageGenResult> {
    // POST https://aihubmix.com/v1/models/doubao/doubao-seedream-5.0-lite/predictions
    // Authorization: Bearer <KEY>
    // body: { input: { prompt, size:"2K", response_format:"url", watermark:true } }
    // response: { output: [{ url }] }
    // 额外步骤: fetch(url) → ArrayBuffer → base64
  }
  private async callGptImage2(...): Promise<ImageGenResult> {
    // POST https://aihubmix.com/v1/models/openai/gpt-image-2/predictions
    // Authorization: Bearer <KEY>
    // body: { input: { prompt, size:"1024x1024", quality:"high", n:1 } }
    // response: { output: { b64_json: [{ bytesBase64, mimeType:"png" }], urls:[] } }
  }
  private async callGemini(...): Promise<ImageGenResult> {
    // POST https://aihubmix.com/gemini/v1beta/models/gemini-3.1-flash-image-preview:streamGenerateContent
    // x-goog-api-key: <KEY>  (注意: 非 Bearer!)
    // body: { contents:[{role:"user",parts:[{text:prompt}]}], generationConfig:{responseModalities:["TEXT","IMAGE"],...} }
    // response: JSON 数组，取 candidates[0].content.parts[].inlineData.data（跳过 thoughtSignature）
  }
}
```

**两套鉴权（关键差异）：**
- doubao + gpt-image-2：`Authorization: Bearer <aihubmix-key>`
- gemini：`x-goog-api-key: <aihubmix-key>`（注意仍是同一个 aihubmix key，只是 header 名不同）

因此 `ImageGenConfig` 只需一个 `apiKey` 字段，`callGemini` 内部选用 `x-goog-api-key` header 即可。

#### (c) `insert_generated_image` Write Tool 设计

这是一个 write tool，写入 PPT/Word（Excel 不支持）。

```typescript
// src/agent/tools/write/image.ts（新增）
interface InsertGeneratedImageArgs {
  prompt: string;
  model: 'doubao-seedream-5.0-lite' | 'gpt-image-2' | 'gemini-3.1-flash-image-preview';
  slide_index?: number;  // PPT only，不传则当前 slide
  position?: 'inline' | 'append';  // Word only
}
```

**execute 内部流程：**
```
1. ProviderRegistry.resolve('image-gen') → ImageConfig（含 apiKey）
2. new AihubmixImageClient().generate(prompt, model, config) → ImageGenResult.dataUrl
3. 从 dataUrl 提取 rawBase64（去 data:image/xxx;base64, 前缀）
4. ctx.adapter 转型为 PptAdapter 或 WordAdapter
5. 调 adapter.insertImageFromBase64(rawBase64, ...) → 返回 { shapeId, slideIndex }
6. return ToolResult { ok:true, reverse: { tool:'delete_image_by_id', args:{...} }, postState:{...} }
```

**ToolResult.reverse — 图片插入的 undo 策略：**

插入图片的逆操作是按形状 ID 删除（PPT）或按段落 marker 删除（Word）。这与 `add_shape` 的逆操作模式完全相同（已有 `deleteShapeById`），可以复用。

- PPT：`reverse = { tool: 'delete_shape_by_id', args: { slide_index, shape_id } }`
  → 复用 `DocumentAdapterForReplay.deleteShapeById`（v2.1 已实现！）
- Word：`reverse = { tool: 'delete_inline_picture_by_marker', args: { marker } }`
  → 需新增 `deleteInlinePictureByMarker` adapter 方法

**postState：** 新增 `'ppt_inserted_image' | 'word_inserted_image'` kind，内容存 `{ shapeId, slideIndex }` 或 `{ marker }`，供手改检测（插图被用户手动删了 → undo 时 not found → skipped_error，属于 acceptable）。

**Office.js 插图 API：**
```typescript
// PPT: PowerPointApi 1.5
await PowerPoint.run(async (ctx) => {
  const slide = ctx.presentation.slides.getItemAt(slideIndex - 1);
  const shape = slide.shapes.addImage(base64);  // 返回 Shape proxy
  shape.load('id');
  await ctx.sync();
  return shape.id;  // 用于 reverse
});

// Word: WordApi 1.1
await Word.run(async (ctx) => {
  ctx.document.body.insertInlinePictureFromBase64(base64, Word.InsertLocation.end);
  await ctx.sync();
  // Word inline picture 无直接 stable ID，用 bookmark 或 paragraphIndex 作 marker
});
```

**非流式生成 → loading UX hook：**

图片生成是一次性整块返回（doubao 数秒，gpt-image-2 high 质量约 90s+）。现有 agentStore 的 `phase` 状态（'thinking' | 'reading' | 'writing' | 'idle'）已用于 AgentControlBar。

需要新增一个 phase 值或利用现有：
- 推荐：在 `loop-helpers.ts` 的 `runOneToolCall` 里，识别 `tc.name === 'insert_generated_image'` 时调 `agentStore.setPhase('generating')` 而非 'writing'。这样 AgentControlBar 可以显示「正在生成图片…」文案。
- `generating` phase 需在 `agentStore.ts` 的 phase union 类型里加一个值。

**文件变更（MM-03 + MM-05）：**

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/providers/aihubmix-image.ts` | 重写 | 三模型分发 + 两套鉴权 + URL→base64 转换 + 统一 ImageGenResult |
| `src/providers/registry.ts` | 改 | `image-gen` case 支持 model 参数；`ImageConfig` 可能加 `model` 字段 |
| `src/providers/types.ts` | 改 | `ImageConfig.model` 由调用方传入（而非 registry 硬编码），或新增 `imageModel` 字段 |
| `src/agent/tools/write/image.ts` | 新增 | `insert_generated_image` ToolDef |
| `src/adapters/PptAdapter.ts` | 改 | 新增 `insertImageFromBase64(base64, slideIndex?) → {shapeId}` |
| `src/adapters/WordAdapter.ts` | 改 | 新增 `insertInlinePictureFromBase64WithMarker(base64, position) → {marker}` |
| `src/adapters/DocumentAdapter.ts` | 改 | 可选：新增 `get_shape_image` query + image write 签名 |
| `src/agent/operationLog.ts` | 改 | PostStateSnapshot.kind 加 `'ppt_inserted_image'|'word_inserted_image'`；`DocumentAdapterForReplay` 加 `deleteInlinePictureByMarker?` |
| `src/agent/tools/index.ts` | 改 | PPT/Word case 各加 `insertGeneratedImage` |
| `src/agent/agentStore.ts` | 改 | phase union 加 `'generating'` |
| `src/agent/operationLog.integration.test.ts` | 改 | 新增图片插入 inverse gate 测试 |

---

### MM-04 公开图库检索插入（Stock Image Insert）

**设计：** 作为独立 read+write 两步 tool，或一个端到端 tool（推荐后者简化 LLM 工具选择）。

**推荐：单个 `search_and_insert_stock_image` write tool，内部封装搜索+选第一张+插入。**

理由：图库检索+插入是一个原子用户意图（"插入一张会议照片"），分成两步会让 LLM 多调一次 tool，增加 step 消耗。如果需要用户选择，可以返回候选列表让用户确认（但 no-backend 约束下无交互 API），暂时直接取第一张。

**与 MM-03 的共享插入路径：**

MM-04 和 MM-03 的插入步骤完全相同（都是 base64 → Office.js insert）。

```typescript
// 共享的 insertImageBase64 helper（在 image.ts 内，不是独立模块）
// MM-03 和 MM-04 都调用它
async function insertImageBase64ToDoc(
  base64: string,
  mimeType: string,
  adapter: DocumentAdapter,
  args: { slideIndex?: number; position?: string },
): Promise<{ shapeId?: string; marker?: string }>
```

**API 选择（Q1 spike 结论前的预设计）：**
- Unsplash：Free plan 限 50 req/hour，支持中文搜索一般，需 `Authorization: Client-ID <key>` header。商用授权：图片可商用，需标注 attribution。
- Pexels：Free，无 rate limit 记录，中文搜索较好，`Authorization: <key>` header。商用授权：更宽松，attribution 可选。

**推荐 Pexels**（中文搜索质量 + 授权更宽松）。Spike Q1 仍需验证中文搜索实际质量。

**ProviderRegistry 扩展：**

当前 `stock-image` case 直接 `throw new ModelNotFoundError`。v2.2 改为返回有效的 StockImageConfig（含 apiKey + baseURL）。需在 providerStore 里增加 Pexels/Unsplash Key 的存储入口（Settings UI + storage key）。

**文件变更（MM-04）：**

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/providers/registry.ts` | 改 | `stock-image` case 改为返回有效配置 |
| `src/providers/types.ts` | 改 | 新增 `StockImageConfig`（apiKey + provider='pexels'|'unsplash'） |
| `src/providers/pexels-stock.ts` 或 `unsplash-stock.ts` | 新增 | 实现 `StockImageProvider.search()` |
| `src/agent/tools/write/image.ts` | 改 | 新增 `search_and_insert_stock_image` ToolDef，内部复用 insertImageBase64 helper |
| `src/agent/tools/index.ts` | 改 | PPT/Word case 各加 `searchAndInsertStockImage` |
| `src/store/providers.ts` 或 Settings UI | 改 | 图库 Key 存储入口 |

---

### MM-05 AiHubMix Model 修正 + Provider Registry 更新

**现状问题：**
- `registry.ts` 里 `AIHUBMIX_IMAGE_MODEL = 'gpt-image-2'`（一个 hardcode 字符串）
- `aihubmix-image.ts` 写的是旧 `/images/generations` + `gpt-image-1`
- vision model 写的是 `gpt-4o`，应更新为 `gpt-5.1`

**重构方向：**

`ProviderRegistry` 的 `image-gen` case 不再 hardcode model，改为从 providerStore 读取用户选择的 model（或保持内置默认）。但考虑 0 净新增运行时依赖约束和架构简洁性，推荐：

1. `registry.ts` 的 `image-gen` case 返回的 `ImageConfig` 新增 `model` 字段，默认值为 `'doubao-seedream-5.0-lite'`（速度最快，质量待评测）
2. `insert_generated_image` tool 的 args 里允许用户/LLM 指定 `model`，覆盖默认值
3. `aihubmix-image.ts` 重写为按 model 分发的三路适配器（见 MM-03 §b）

**文件变更（MM-05 standalone）：**

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/providers/registry.ts` | 改 | 常量更新 + `image-gen` case `ImageConfig.model` 默认值 → `'doubao-seedream-5.0-lite'`；vision model → `'gpt-5.1'` |
| `src/providers/types.ts` | 改 | `ImageConfig` 增加 `model: ImageModel` 字段 |
| `src/providers/aihubmix-image.ts` | 重写（见 MM-03） | 完整重写 |
| `src/providers/aihubmix-vision.ts` | 改 | model 字符串从 `'gpt-4o'` → `'gpt-5.1'` |

---

## 三、数据流完整图（per feature）

### MM-01 视觉 Read Tool 调用链

```
LLM → tool_call: analyze_image({slide_index:2, shape_id:'shp3', question:'...'})
  ↓ dispatchTool (loop-helpers.ts, TOOL_TIMEOUT_MS=15000)
  ↓ analyzeImageOnSlide.execute(args, ctx)
    ↓ ctx.adapter.read({ kind:'get_shape_image', slideIndex:2, shapeId:'shp3' })
    ↓ PptAdapter.read() → PowerPoint.run → shape.image.getBase64ImageData()
    ↓ returns { ok:true, data:{ base64:'...', mimeType:'image/png' } }
    ↓ new AihubmixVisionClient().analyze(question, base64, mimeType, { baseURL, apiKey })
    ↓ POST api.aihubmix.com/v1/chat/completions (gpt-5.1, non-streaming)
    ↓ returns VisionResult { content: '图片显示…' }
  ↓ wrapReadResult({ ok:true, data:{analysis:content} }, {result_type:'document_content', source:'slide_2.shp3.vision'})
  ↓ messages.push({role:'tool', content: JSON.stringify(toolResult)})
  ↓ LLM 收到 vision evidence → 继续 next step
```

### MM-03 图片生成插入调用链

```
LLM → tool_call: insert_generated_image({prompt:'现代办公场景', model:'doubao-seedream-5.0-lite', slide_index:3})
  ↓ dispatchTool
  ↓ insertGeneratedImage.execute(args, ctx)
    ↓ agentStore.setPhase('generating')
    ↓ ProviderRegistry.resolve('image-gen') → ImageConfig {apiKey, baseURL:'https://aihubmix.com', model}
    ↓ AihubmixImageClient.generate(prompt, 'doubao-seedream-5.0-lite', config)
      ↓ POST https://aihubmix.com/v1/models/doubao/doubao-seedream-5.0-lite/predictions
      ↓ response: { output:[{url:'https://ark-acg-cn-beijing.tos-cn-beijing.volces.com/...'}] }
      ↓ fetch(url) → ArrayBuffer → base64  (doubao URL→base64 转换步骤)
      ↓ return { dataUrl:'data:image/png;base64,...', mimeType:'image/png' }
    ↓ rawBase64 = dataUrl.split(',')[1]
    ↓ (ctx.adapter as PptAdapter).insertImageFromBase64(rawBase64, { slideIndex:3 })
      ↓ PowerPoint.run → slide.shapes.addImage(base64) → shape.id
    ↓ return ToolResult {
        ok: true,
        reverse: { tool:'delete_shape_by_id', args:{ slide_index:3, shape_id:'xxx' } },
        postState: { kind:'ppt_inserted_image', content:{ shapeId:'xxx', slideIndex:3 } }
      }
  ↓ appendOperation(entry) → operationLog
  ↓ messages.push({role:'tool', ...})
```

---

## 四、Provider Registry 改动（MM-05 + MM-03 + MM-04 联动）

**当前 `src/providers/types.ts` 的 `ImageConfig`：**
```typescript
interface ImageConfig {
  providerId: string;
  baseURL: string;
  apiKey: string;
  model: string;  // 当前只是字符串
}
```

**v2.2 扩展（minimally invasive）：**
```typescript
// types.ts 新增
export type ImageModel =
  | 'doubao-seedream-5.0-lite'
  | 'gpt-image-2'
  | 'gemini-3.1-flash-image-preview';

export type StockImageProvider = 'pexels' | 'unsplash';

export interface StockImageConfig {
  providerId: string;
  apiKey: string;
  provider: StockImageProvider;
}
```

`registry.ts` 的 `stock-image` case 改为返回 `StockImageConfig`，需要扩展函数返回类型（`LLMConfig | ImageConfig | StockImageConfig`）。

---

## 五、最高集成风险点分析

### Risk #1（最高）：Office.js 图片字节提取跨宿主行为（MM-01）

`shape.image.getBase64ImageData()` 在 PPT Office for Web 上的真实支持状况未经真机验证。如果这个 API 在 Web 端有 bug 或返回空，整个 vision read tool 就无法工作。这是 MM-01 的 **P0 阻塞风险**。

**缓解：** MM-01 Phase 开始前必须做真机 spike（不超过 1 天），验证至少 PPT Picture shape 的 `getBase64ImageData` 在 Office for Web Chrome 上工作。如果失败，fallback 降级：vision tool 不支持从 Office 文档直接提取图片，改为"用户通过附件上传图片"路径（MM-02 的图片上传子路径）。

### Risk #2（高）：doubao URL 时效 + fetch 额外延迟（MM-03）

doubao 返回的是有时效签名 URL（火山 TOS），需要 Aster 浏览器 fetch 一次转 base64。这意味着每次生图需要两次网络请求（predictions API + fetch URL），且如果 URL 失效（测试显示有效期未知），整个 `insert_generated_image` 会报 404。

**缓解：** `callDoubao` 里加超时（5s），fetch 失败时抛 `NetworkError`，error hint 建议用户重试或切换模型。可以在 URL 取到后立刻 fetch，不引入额外延迟。

### Risk #3（中）：gemini thoughtSignature 1.5M 字符内存压力（MM-03）

Gemini response 里有 `thoughtSignature`（约 1.5M 字符 base64），加上图片 base64（约 3.1MB decoded），在 Task Pane WebView（内存受限）里处理时可能导致 memory pressure。

**缓解：** 解析 gemini response 时立即丢弃 `thoughtSignature`（不存到任何变量）。图片 base64 用完即 GC（不存入 chatStore 或 operationLog）。

### Risk #4（中）：PPT insert_generated_image 的 undo（delete_shape_by_id 复用）

PPT `add_shape` 的 inverse（`deleteShapeById`）已实现，但 `shapes.addImage()` 返回的 shape 的 ID 类型和 `shapes.addTextBox()` 返回的 ID 可能行为不同（Office.js 有时在 add 后 sync 前 ID 不稳定）。

**缓解：** 在 `insertImageFromBase64` 里：`shape.load('id'); await ctx.sync();` 确保 ID 稳定后再 return，与现有 `deleteSlideByIndex` 的 3-sync 模式一致。

### Risk #5（低-中）：Word inline picture 无稳定 ID，undo 需 bookmark

Word `insertInlinePictureFromBase64` 不返回稳定 shape ID。当前没有 `getInlinePictures` API 可以定位刚插入的图片。需要用一个 marker 策略（如插入前后计数 paragraph index）。

**缓解：** 先做 noop+gate undo（`reverse = { tool:'noop_inverse', args:{ reason:'图片插入 Word 暂不支持自动撤销' } }`），明确告知用户手动 Ctrl+Z。这与项目已有的 `replace_selection` noop 模式一致。v2.2 后续迭代再实现真正的 Word 图片 undo。

---

## 六、新增 vs 修改模块总结表

| 模块 | 状态 | 关联特性 | 备注 |
|------|------|---------|------|
| `src/providers/aihubmix-image.ts` | **重写** | MM-03/MM-05 | 三路 model 分发，两套鉴权 |
| `src/providers/aihubmix-vision.ts` | 改（小） | MM-01/MM-05 | 仅更新 model 常量 |
| `src/providers/registry.ts` | 改 | MM-03/MM-04/MM-05 | image-gen default model；stock-image 解封 |
| `src/providers/types.ts` | 改 | MM-03/MM-04/MM-05 | `ImageModel` type；`StockImageConfig` |
| `src/providers/pexels-stock.ts` | **新增** | MM-04 | Pexels search API 客户端 |
| `src/agent/tools/read/ppt.ts` | 改 | MM-01 | 新增 `analyzeImageOnSlide` |
| `src/agent/tools/read/word.ts` | 改 | MM-01 | 新增 `analyzeInlinePicture` |
| `src/agent/tools/write/image.ts` | **新增** | MM-03/MM-04 | `insert_generated_image` + `search_and_insert_stock_image` + 共享 insertImageBase64 helper |
| `src/agent/tools/index.ts` | 改 | MM-01/MM-03/MM-04 | PPT/Word case 各加 vision + image tools |
| `src/agent/operationLog.ts` | 改 | MM-03 | PostStateSnapshot kind 新增 image 类型；DocumentAdapterForReplay 加 word image noop |
| `src/agent/agentStore.ts` | 改 | MM-03 | phase 加 `'generating'` |
| `src/adapters/DocumentAdapter.ts` | 改 | MM-01 | ReadableQuery 加 image kinds |
| `src/adapters/PptAdapter.ts` | 改 | MM-01/MM-03 | `get_shape_image` read case；`insertImageFromBase64` write method |
| `src/adapters/WordAdapter.ts` | 改 | MM-01/MM-03 | `get_inline_picture_image` read case；`insertInlinePictureFromBase64WithMarker` write method |
| `src/adapters/ExcelAdapter.ts` | 改（可选） | MM-01 | `get_chart_image` read case（LOW confidence，可 defer） |
| `src/components/InputBar.tsx` | 改 | MM-02 | 激活 paperclip；file input；attachments state；augmented prompt |
| `src/lib/fileParser.ts` | **新增** | MM-02 | 懒加载格式解析器（mammoth/SheetJS/pdfjs/jszip） |
| `src/agent/operationLog.integration.test.ts` | 改 | MM-03 | 图片插入 inverse gate 测试 |

---

## 七、建议构建顺序（依赖驱动）

```
Phase 14 — MM-05 Provider/Model 修正（无依赖，解锁所有下游）
  14-1: 重写 aihubmix-image.ts（三路分发）
  14-2: 更新 registry.ts / types.ts（model 字段；stock-image 解封）
  14-3: 真机 smoke test 三模型各生一张图

Phase 15 — MM-03 图片生成插入（依赖 Phase 14）
  15-1: Office.js 插图 spike（PPT shapes.addImage + Word insertInlinePictureFromBase64 真机验证）
  15-2: PptAdapter.insertImageFromBase64 + insert_generated_image ToolDef + PPT undo（复用 deleteShapeById）
  15-3: WordAdapter.insertInlinePictureFromBase64 + Word noop inverse
  15-4: agentStore phase 加 'generating' + AgentControlBar 文案
  15-5: 端到端真机 UAT（PPT 生图插入 + undo + Word 生图插入）

Phase 16 — MM-01 视觉看图（独立于 MM-03，仅依赖 MM-05 vision model 修正）
  16-1: Office.js 图片字节提取 spike（PptAdapter get_shape_image 真机，1 天时间盒）
  16-2: PPT Picture shape + Word InlinePicture image read → AihubmixVisionClient.analyze
  16-3: analyzeImageOnSlide + analyzeInlinePicture ToolDef 注册
  16-4: 真机 UAT（PPT 选图 + 问 AI + LLM 用 evidence 继续写内容）

Phase 17 — MM-02 文件上传解析（独立，仅依赖 InputBar 基础结构）
  17-1: fileParser.ts（mammoth/SheetJS/pdfjs 懒加载，text 提取）
  17-2: InputBar paperclip 激活 + attachments state + augmented prompt 拼接
  17-3: 图片附件（base64 注入 + 一次性 vision 调用，可选 defer）
  17-4: 真机 UAT（上传 .docx / .xlsx / .pdf + 提问文件内容）

Phase 18 — MM-04 图库检索插入（依赖 Phase 15 共享插入路径 + Q1 spike Pexels 验证）
  18-1: Q1 spike — Pexels API 中文搜索质量验证
  18-2: pexels-stock.ts + search_and_insert_stock_image tool + Settings Pexels Key
  18-3: 真机 UAT

Phase 19 — UAT + Release
```

**依赖约束：**
- Phase 14（MM-05 重写）MUST 先于 Phase 15/16（image gen + vision 都依赖重写后的 provider）
- Phase 15-2（PPT insert + undo）MUST 先于 Phase 18（MM-04 复用插入路径）
- Phase 16 与 Phase 15 独立，可并行（两人可并行，单人串行 14→16→15→17→18 也合理）
- Phase 17（MM-02）完全独立，任何时间点都可插入

---

## 八、反模式警告

### 反模式 1：把 vision 做成 user message 的 image_url augmentation

把图片 base64 直接插入 WireMessage 的 `content` 字段（OpenAI multi-content 格式）会改动 `loop-helpers.ts` 的 `streamAssistantTurn` 接口和 wire message 结构，影响面大。Read tool 路径零改 loop，是正确方向。

### 反模式 2：三个生图模型各写独立 ToolDef

会让工具数量从 1 增加到 3，LLM 需要"选模型"——这不是用户意图的一部分。应该是一个 `insert_generated_image` tool，model 作参数，或由系统提示指定默认值。

### 反模式 3：把 base64 图片数据存入 chatStore.messages

3MB 的 base64 字符串存进 chatStore 再被 localStorage 序列化会直接触发 QuotaExceeded。图片 base64 只在 tool execute 内作为临时变量存在，用完 GC，绝不 push 到 messages。

### 反模式 4：为 doubao URL 延迟 Office.js 插图

拿到 URL 后先存 state 等用户确认，然后再 fetch → base64 → insert。URL 有时效，存 state 期间可能失效。正确做法：拿到 URL 后立刻 fetch，整个过程在 `execute` 里同步完成，失败则立刻报错。

---

## 九、来源（置信度）

| 来源 | 置信度 | 用于 |
|------|--------|------|
| `src/agent/loop.ts` / `loop-helpers.ts`（实际代码） | HIGH | Agent loop 架构 |
| `src/agent/tools/index.ts`（实际代码） | HIGH | Tool registry + dispatch |
| `src/agent/operationLog.ts`（实际代码） | HIGH | OperationLog undo 模式 |
| `src/providers/registry.ts` / `aihubmix-*.ts`（实际代码） | HIGH | Provider 路由现状 |
| `src/adapters/PptAdapter.ts`（实际代码） | HIGH | PPT adapter 结构 + deleteShapeById 已实现 |
| `src/store/chat.ts`（实际代码） | HIGH | Message schema + sendMessage delegate |
| `src/components/InputBar.tsx`（实际代码） | HIGH | Paperclip disabled 状态 + attachments 路径 |
| `.planning/spikes/011-image-gen-api-formats/findings.md`（已锁定） | HIGH | 三模型 wire format + 鉴权 |
| `.planning/research/v2.1/ARCHITECTURE.md`（先前研究） | HIGH | 架构模式连续性 |
| `DocumentAdapter.ts` `ImageContent` type（实际代码） | HIGH | image insert variant 已定义（但 adapter 未实现） |
| [Microsoft Learn — PowerPoint.Shape.image](https://learn.microsoft.com/en-us/javascript/api/powerpoint/powerpoint.shape?view=powerpoint-js-preview) | MEDIUM | `getBase64ImageData` — API 存在但 Web 真机未验 |
| [Microsoft Learn — Word.InlinePicture](https://learn.microsoft.com/en-us/javascript/api/word/word.inlinepicture?view=word-js-preview) | HIGH | `getBase64ImageData` (WordApi 1.1) — 文档确认 |
| [Pexels API docs](https://www.pexels.com/api/documentation/) | MEDIUM | search endpoint + rate limits |

---

*研究范围：v2.2 多模态四件套架构集成*
*研究日期：2026-06-01*
*面向：gsd-roadmapper (Phase 14–19 规划)*
