# Phase 15: VIS — 视觉看图 - Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 13 new/modified files
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/agent/tools/read/vision.ts` | read tool (ToolDef) | request-response | `src/agent/tools/read/ppt.ts` | exact |
| `src/store/attachments.ts` | store (Zustand slice) | event-driven | `src/store/providers.ts` | role-match (无 persist) |
| `src/providers/aihubmix-vision.ts` | provider client | request-response | self (扩展现有文件) | self-extension |
| `src/adapters/DocumentAdapter.ts` | type contract | N/A | self (扩展 ReadableQuery union) | self-extension |
| `src/adapters/PptAdapter.ts` | adapter (read case) | request-response | existing cases in same file | exact (case 追加) |
| `src/adapters/ExcelAdapter.ts` | adapter (read case) | request-response | existing cases in same file | exact (case 追加) |
| `src/adapters/WordAdapter.ts` | adapter (read case) | request-response | existing cases in same file | exact (case 追加) |
| `src/agent/tools/index.ts` | tool registry | N/A | self (PPT_TOOLS set + buildToolsForHost) | self-extension |
| `src/components/InputBar.tsx` | UI component | event-driven | self (回形针按钮区域激活) | self-extension |
| `src/store/chat.ts` | store (sendMessage) | event-driven | self (sendMessage 链路扩展) | self-extension |
| `src/store/chat.test.ts` | test (serialize guard) | N/A | self (L204-224 白名单测试扩展) | self-extension |
| `src/providers/aihubmix-vision.test.ts` | test | N/A | `src/store/providers.test.ts` | role-match |
| `src/store/attachments.test.ts` | test | N/A | `src/store/selection.test.ts` | role-match |

---

## Pattern Assignments

### `src/agent/tools/read/vision.ts` （新建，read tool）

**Analog:** `src/agent/tools/read/ppt.ts`

**Imports pattern** (ppt.ts L13-14):
```typescript
import type { ToolDef, ToolResult } from '../index';
import { wrapReadResult } from '../../read-result';
```

**Core ToolDef pattern** (ppt.ts L95-123，getShape 为最近 analog):
```typescript
export const getShape: ToolDef<GetShapeArgs> = {
  name: 'get_shape',
  description: '读取指定幻灯片（1-based）上指定形状（shapeId）的内容...',
  parameters: {
    type: 'object',
    properties: {
      slideIndex: { type: 'number', description: '...' },
      shapeId:    { type: 'string', description: '...' },
    },
    required: ['slideIndex', 'shapeId'],
  },
  humanLabel: ({ slideIndex }) => `读取了第 ${slideIndex} 张幻灯片的某个形状`,
  kind: 'read',
  async execute({ slideIndex, shapeId }, ctx): Promise<ToolResult> {
    const r = await ctx.adapter.read({ kind: 'get_shape', slideIndex, shapeId });
    return wrapReadResult(r, {
      result_type: 'document_content',
      source: `slide_${slideIndex}.shape_${shapeId}`,
    });
  },
};
```

**New file 照此范式，差异点：**
- `name: 'get_shape_image'`
- `parameters.properties` 只含可选 `focus?: string`，`required: []`
- `humanLabel: ({ focus }) => focus ? \`正在看这张图（${focus}）…\` : '正在看这张图…'`
- `execute` 调 `ctx.adapter.read({ kind: 'get_shape_image', focus })`，再 `wrapReadResult(r, { result_type: 'document_content', source: 'selection.image' })`
- **注意：** vision base64 在 adapter 内消费，ToolResult.data 只含 `{ vision_result: string }`，不含 base64。wrapReadResult 对 ok=true 路径做 JSON.stringify + applySizeCap，无需特殊处理。

---

### `src/store/attachments.ts` （新建，Zustand 内存 slice）

**Analog:** `src/store/providers.ts`（Zustand create 范式）；关键差别：**本 store 无 persist middleware**。

**Imports pattern** (providers.ts L20):
```typescript
import { create } from 'zustand';
```

**Core Zustand create pattern** (providers.ts 简化版，无 persist):
```typescript
// 照此格式，不加 persist middleware（满足 NFR-09）
export const useAttachmentStore = create<AttachmentState>((set) => ({
  images: [],
  addImages: (imgs) => set((s) => ({ images: [...s.images, ...imgs] })),
  clearImages: () => set({ images: [] }),
  removeImage: (id) => set((s) => ({ images: s.images.filter((i) => i.id !== id) })),
}));
```

**Interface 定义范式** (providers.ts 风格):
```typescript
export interface AttachedImage {
  id: string;
  base64: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  fileName: string;
  sizeBytes: number;
}

interface AttachmentState {
  images: AttachedImage[];
  addImages: (imgs: AttachedImage[]) => void;
  clearImages: () => void;
  removeImage: (id: string) => void;
}
```

**反模式（永不做）：**
- 不加 `persist(...)` 包裹——base64 写 localStorage = NFR-09 硬违约 + storage quota 炸
- 不加 `subscribe`/`getState` 在 localStorage 的任何 side effect

---

### `src/providers/aihubmix-vision.ts` （修改，扩展多图 + focus）

**文件已存在，自扩展。** 现有代码（L1-71）为单图 `analyze()` 签名。

**现有 analyze 签名** (L26-32):
```typescript
export class AihubmixVisionClient {
  async analyze(
    userText: string,
    imageBase64: string,
    mimeType: string,
    config: VisionConfig,
  ): Promise<VisionResult>
```

**现有 fetch + 错误处理模式** (L35-69，照此复制到新 analyzeImages):
```typescript
let resp: Response;
try {
  resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,  // apiKey 仅在 header，不进 body（T-01-04）
    },
    body: JSON.stringify({ model: AIHUBMIX_VISION_MODEL, stream: false, messages: [...] }),
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

**扩展方向：**
1. 新增 `VisionImage` interface: `{ base64: string; mimeType: string }`
2. 新增 `analyzeImages(userText, images: VisionImage[], config): Promise<VisionResult>` —— content array 格式：`[{ type:'text', text:userText }, ...images.map(i => ({ type:'image_url', image_url:{ url: \`data:${i.mimeType};base64,${i.base64}\` } }))]`
3. 现有 `analyze` 改为：`return this.analyzeImages(userText, [{ base64: imageBase64, mimeType }], config)` —— 向后兼容
4. 现有 imports (`mapHttpError`, `NetworkError`, `AIHUBMIX_VISION_MODEL`) 不变

---

### `src/adapters/DocumentAdapter.ts` （修改，ReadableQuery union 新增 kind）

**文件已存在，自扩展。** 在 `ReadableQuery` 判别联合（L164-179）末尾追加一个变体：

**现有 ReadableQuery union 模式** (L164-179):
```typescript
export type ReadableQuery =
  | { kind: 'selection_detail' }
  | { kind: 'list_slides' }
  | { kind: 'get_slide'; slideIndex: number }
  | { kind: 'list_shapes_on_slide'; slideIndex: number }
  | { kind: 'get_shape'; slideIndex: number; shapeId: string }
  | { kind: 'list_worksheets' }
  | { kind: 'get_range_values'; address: string }
  | { kind: 'get_used_range_summary'; sheetName?: string }
  | { kind: 'get_paragraph_count' }
  | { kind: 'get_paragraph_at'; index: number }
  | { kind: 'get_document_outline' }
  | { kind: 'get_document_full_text' };
```

**追加内容**（放在末尾，三宿主共用同一 kind）：
```typescript
  | { kind: 'get_shape_image'; focus?: string };
```

**注意：** 文件是 0-import 纯类型文件，严禁引入任何 runtime 依赖（L8 约束）。`focus` 为可选，三宿主各自解释：PPT=选中 shape，Excel=激活 chart，Word=选区内 inline picture。

---

### `src/adapters/PptAdapter.ts` （修改，read() 追加 case）

**Analog:** 同文件内现有 `case 'list_slides':` 结构（L310-363）。

**现有 case 结构模式** (PptAdapter.ts read() 内各 case 通用骨架，L310-363):
```typescript
case 'list_slides': {
  try {
    return await PowerPoint.run(async (ctx) => {
      // ... load + sync + 数据处理
      return { ok: true, data: { ... } } satisfies ReadableResult;
    });
  } catch (err) {
    warnHostErr('list_slides', err);
    throw new HostApiError('PowerPoint list_slides 失败', err);
  }
}
```

**shape type 白名单参照** (PptAdapter.ts L39):
```typescript
// 仅 Picture / Chart 允许取图（与 TEXT_SHAPE_TYPES 互斥逻辑一致）
const TEXT_SHAPE_TYPES = new Set<string>(['GeometricShape', 'TextBox', 'Placeholder', 'Callout']);
// 取图 shape types（新增）：
const IMAGE_SHAPE_TYPES = new Set<string>(['Picture', 'Chart']);
```

**PPT-05 守则** (L318)：`getSelectedShapes()` 结果须按 `.index` 排序（绕 Web 反序 bug #3618）。

**warnHostErr 辅助函数** (L28-31):
```typescript
function warnHostErr(kind: string, err: unknown): void {
  const e = err as { code?: string; debugInfo?: { errorLocation?: string } };
  console.warn(`[Aster] PPT ${kind} 宿主报错:`, e?.code ?? '(no code)', '| loc:', e?.debugInfo?.errorLocation ?? '');
}
```

**新 case 结构（PPT，SPIKE 路径）：**
```typescript
case 'get_shape_image': {
  const focus = query.focus;
  try {
    return await PowerPoint.run(async (ctx) => {
      const selection = ctx.presentation.getSelectedShapes();
      selection.load('items/type');
      await ctx.sync();

      if (!selection.items.length) {
        return { ok: false, error: { code: 'NOT_FOUND',
          message: '请先选中一张图片或图表，或点回形针上传一张图',
          recoverable: true,
          hint: '选中图片或图表 shape 后再试，或使用回形针按钮上传图片' } };
      }

      const shape = selection.items[0];   // D-05 多选取第一张
      if (!IMAGE_SHAPE_TYPES.has(shape.type)) {
        return { ok: false, error: { code: 'UNSUPPORTED',
          message: '选中形状不是图片或图表',
          recoverable: true,
          hint: '请选中图片或图表 shape，或点回形针上传图片' } };
      }

      // SPIKE: shape.getImageAsBase64() — PowerPoint Preview API（powerpoint-js-preview）
      const imageResult = shape.getImageAsBase64();
      await ctx.sync();
      const base64 = imageResult.value;

      const cfg = ProviderRegistry.resolve('vision', getDefaultLLM) as ImageConfig;
      const userText = focus
        ? `${focus}（请从图中抽取能直接用于撰写文档的具体细节）`
        : '请客观描述图片的所有关键内容：文字、数据、人物/物品、版式结构，用于协助撰写办公文档。';
      const { content } = await new AihubmixVisionClient().analyzeImages(
        userText, [{ base64, mimeType: 'image/png' }], cfg);
      return { ok: true, data: { vision_result: content, shape_count: selection.items.length } };
    });
  } catch (err) {
    warnHostErr('get_shape_image', err);
    throw new HostApiError('PowerPoint get_shape_image 失败', err);
  }
}
```

**导入需要：** `ProviderRegistry` + `getDefaultLLM`（从 agentStore 或 providers store 取）+ `AihubmixVisionClient` + `ImageConfig`（参考 registry.ts 和 aihubmix-vision.ts 的既有 import 路径）。

---

### `src/adapters/ExcelAdapter.ts` （修改，read() 追加 case）

**Analog:** 同文件内 `case 'list_worksheets':` 结构（L191-205）。

**现有 case 结构模式** (ExcelAdapter.ts L191-205):
```typescript
case 'list_worksheets': {
  try {
    return await Excel.run(async (ctx) => {
      const ws = ctx.workbook.worksheets;
      ws.load('items/name');
      await ctx.sync();
      return { ok: true, data: { worksheets: ws.items.map((w) => w.name) } };
    });
  } catch (err) {
    throw new HostApiError('Excel list_worksheets 失败', err);
  }
}
```

**Excel 无 getSelectedChart，用 getActiveChartOrNullObject（ExcelApi 1.9）：**
```typescript
case 'get_shape_image': {
  const focus = query.focus;
  try {
    return await Excel.run(async (ctx) => {
      const chartOrNull = ctx.workbook.getActiveChartOrNullObject();
      await ctx.sync();
      if (chartOrNull.isNullObject) {
        return { ok: false, error: { code: 'NOT_FOUND',
          message: '请先点击一下图表使其激活，或点回形针上传图片',
          recoverable: true,
          hint: '单击图表后再调用此工具，或使用回形针上传图片' } };
      }
      const imageResult = chartOrNull.getImage(); // ExcelApi 1.2，返回 JPEG base64
      await ctx.sync();
      const base64 = imageResult.value;

      const cfg = ProviderRegistry.resolve('vision', getDefaultLLM) as ImageConfig;
      const userText = focus
        ? `${focus}（请从图中抽取能直接用于撰写文档的具体细节）`
        : '请客观描述图片的所有关键内容，用于协助撰写办公文档。';
      const { content } = await new AihubmixVisionClient().analyzeImages(
        userText, [{ base64, mimeType: 'image/jpeg' }], cfg);
      return { ok: true, data: { vision_result: content } };
    });
  } catch (err) {
    throw new HostApiError('Excel get_shape_image 失败', err);
  }
}
```

---

### `src/adapters/WordAdapter.ts` （修改，read() 追加 case）

**Analog:** 同文件内 `case 'get_paragraph_at':` 结构（L1538-1566）——含 ctx.sync() 两次的「queue + sync + 读 .value」模式，与 Word getBase64ImageSrc 需要的 ClientResult 模式一致。

**Word ClientResult 模式**（两次 sync）(WordAdapter.ts L1538-1566):
```typescript
case 'get_paragraph_at': {
  try {
    return await Word.run(async (ctx) => {
      const paras = ctx.document.body.paragraphs;
      paras.load('items/text');
      await ctx.sync();                           // sync 1: load
      // ... 读 .text
      return { ok: true, data: { index, text: paras.items[index].text } };
    });
  } catch (err) {
    throw new HostApiError('Word get_paragraph_at 失败', err);
  }
}
```

**Word 新 case（inline picture，WordApi 1.1）：**
```typescript
case 'get_shape_image': {
  const focus = query.focus;
  try {
    return await Word.run(async (ctx) => {
      const selection = ctx.document.getSelection();
      selection.inlinePictures.load('items');
      await ctx.sync();                              // sync 1: load inlinePictures

      if (selection.inlinePictures.items.length === 0) {
        return { ok: false, error: { code: 'NOT_FOUND',
          message: '选区内没有内嵌图片，请先选中图片，或点回形针上传图片',
          recoverable: true,
          hint: '选中文档内的内嵌图片后再试，或使用回形针上传图片' } };
      }

      const pic = selection.inlinePictures.items[0];  // D-05 取第一张
      const base64Result = pic.getBase64ImageSrc();    // ClientResult<string>，需 sync 后才可读
      await ctx.sync();                                // sync 2: 触发 ClientResult 值（Pitfall 3）
      const base64 = base64Result.value;               // 必须 sync 后读 .value

      const cfg = ProviderRegistry.resolve('vision', getDefaultLLM) as ImageConfig;
      const userText = focus
        ? `${focus}（请从图中抽取能直接用于撰写文档的具体细节）`
        : '请客观描述图片的所有关键内容，用于协助撰写办公文档。';
      const { content } = await new AihubmixVisionClient().analyzeImages(
        userText, [{ base64, mimeType: 'image/png' }], cfg);
      return { ok: true, data: { vision_result: content, pic_count: selection.inlinePictures.items.length } };
    });
  } catch (err) {
    throw new HostApiError('Word get_shape_image 失败', err);
  }
}
```

---

### `src/agent/tools/index.ts` （修改，PPT_TOOLS + buildToolsForHost）

**文件已存在，自扩展。**

**PPT_TOOLS set 模式** (L27-40)：
```typescript
const PPT_TOOLS = new Set([
  'insert_slide',
  'set_shape_property',
  // ... 现有 PPT 工具名
  'set_slide_background',
  // Phase 15 新增：
  'get_shape_image',         // <-- 追加此行（D-10/D-13 守则：PPT 工具必须在此 set 内）
]);
```

**buildToolsForHost 注册模式** (L242-295)：
```typescript
// import 行（L17 区域）追加：
import { getShapeImage } from './read/vision';

// case 'ppt'（L287-290）追加 getShapeImage：
return [
  listSlides, getSlide, listShapesOnSlide, getShape,
  getShapeImage,   // <-- 三宿主各加
  ...pptWriteTools, selectionDetail,
].map((t) => t as ToolDef);

// case 'excel'（L271-274）：
return [
  listWorksheets, getRangeValues, getUsedRangeSummary,
  getShapeImage,
  ...excelWriteTools, selectionDetail,
].map((t) => t as ToolDef);

// case 'word'（L254-258）：
return [
  getDocumentFullText, getParagraphCount, getParagraphAt, getDocumentOutline,
  getShapeImage,
  ...wordWriteTools, selectionDetail,
].map((t) => t as ToolDef);
```

**assertWriteToolRegisterable 说明**：`getShapeImage.kind = 'read'`，不走此校验（仅 write 工具校验 humanLabel）。

---

### `src/components/InputBar.tsx` （修改，激活回形针）

**文件已存在，自扩展。**

**现有禁用回形针** (L144-153，激活目标):
```typescript
<button
  type="button"
  className="tool-btn"
  aria-disabled="true"
  aria-label={t`文件上传`}
  title={t`文件上传即将开放`}
  style={{ opacity: 0.38, cursor: 'not-allowed' }}
>
  <PaperclipIcon size={15} />
</button>
```

**既有 tool-btn 按钮激活范式**（参照同文件 L127-143 GearIcon 按钮：有 onClick，无 aria-disabled，无 opacity 覆盖）：
```typescript
<button
  type="button"
  className="tool-btn"
  aria-label={t`设置`}
  onClick={() => onGoSettings()}
>
  <GearIcon size={15} strokeWidth={1.4} />
</button>
```

**激活后完整模式**（追加 useRef + 处理函数 + 替换 JSX）：
```typescript
// 在 useRef 区域（L42 textareaRef 旁）追加：
const fileInputRef = useRef<HTMLInputElement>(null);

// 在 handleKeyDown 之后追加两个处理函数：
const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
  const files = Array.from(e.target.files ?? []);
  void processImageFiles(files);
  e.target.value = ''; // 允许重复选同一文件
};

const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
  const items = Array.from(e.clipboardData?.items ?? []);
  const imageItems = items.filter(i => i.kind === 'file' && i.type.startsWith('image/'));
  if (!imageItems.length) return;
  e.preventDefault();
  const files = imageItems.map(i => i.getAsFile()).filter((f): f is File => f !== null);
  void processImageFiles(files);
};

// JSX：将禁用按钮替换为：
<button
  type="button"
  className="tool-btn"
  aria-label={t`上传图片`}
  title={t`上传图片`}
  onClick={() => fileInputRef.current?.click()}
>
  <PaperclipIcon size={15} />
</button>
<input
  ref={fileInputRef}
  type="file"
  accept="image/png,image/jpeg,image/webp"
  multiple
  style={{ display: 'none' }}
  onChange={handleFileSelect}
/>

// textarea（L113）追加 onPaste={handlePaste}
```

**诚实 UX 守则**（来自 InputBar.tsx L155-158 注释 + 设计系统诚实禁用范式）：非图片文件（Phase 15 之外的文件类型）→ 结构化错误「文件解析即将开放，当前可上传图片」——不冒充已支持（D-14）。

---

### `src/store/chat.ts` （修改，sendMessage 注入 vision）

**文件已存在，自扩展。**

**现有 sendMessage 结构** (L171-176):
```typescript
async sendMessage(prompt, selectionCtx, adapter) {
  // D-01：先 push user message
  get().pushMessage({ role: 'user', content: prompt, ts: Date.now() });
  // Thin delegate to agent loop
  await useAgentStore.getState().runAgent(prompt, selectionCtx, adapter);
},
```

**扩展范式**（注入点在 pushMessage 之前、runAgent 之前；用户气泡显示 original prompt）：
```typescript
async sendMessage(prompt, selectionCtx, adapter) {
  // Phase 15 新增：检查附件图，发消息前一次性调 vision
  const { images } = useAttachmentStore.getState();
  let finalPrompt = prompt;

  if (images.length > 0) {
    try {
      const cfg = ProviderRegistry.resolve('vision', getDefaultLLM) as ImageConfig;
      const visionImages = images.map(({ base64, mimeType }) => ({ base64, mimeType }));
      const userText = `请分析以下图片内容，然后回答用户的问题：${prompt}`;
      const { content } = await new AihubmixVisionClient().analyzeImages(userText, visionImages, cfg);
      // SUMMARY L67 范式：evidence 注入 prompt 头部
      finalPrompt = `[图片分析 evidence]\n${content}\n---\n${prompt}`;
    } catch {
      // vision 失败：诚实降级，不阻断（Pitfall 6 守则）
      finalPrompt = `[注：图片分析失败，将在无图情况下回答]\n${prompt}`;
    }
    // D-10：上传图内存态多轮复用——不自动清除，用户手动删（chip × 按钮）
  }

  // 用户气泡显示 original prompt（不含 evidence，base64 从未写进 content，NFR-09 天然满足）
  get().pushMessage({ role: 'user', content: prompt, ts: Date.now() });
  await useAgentStore.getState().runAgent(finalPrompt, selectionCtx, adapter);
},
```

**serializeForStorage 无需改动**（L119-131）：base64 从未写进 `Message.content`，序列化白名单天然过滤（RESEARCH §问题 4）。

---

### `src/store/chat.test.ts` （修改，NFR-09 serialize 守门扩展）

**Analog:** 同文件 L204-224 白名单测试结构，照此追加两个 it() 断言。

**现有白名单测试模式** (L204-224):
```typescript
it('serializeForStorage 白名单：只存 user|assistant 文字，每条 ≤2000 字符', () => {
  useChatStore.setState({
    messages: [
      { id: 'u1', role: 'user', content: 'a'.repeat(3000), ts: 1 },
      { id: 'a1', role: 'assistant', content: 'ok', ts: 2 },
      { id: 't1', role: 'tool', content: 'tool_result', ts: 3 },   // 期望被过滤
      { id: 'e1', role: 'error', content: 'err', ts: 4 },          // 期望被过滤
    ],
  } as never);
  useChatStore.getState().saveHistory('aster:chat:testDoc');
  const call = mockedStorage.set.mock.calls[0];
  const payload = call[1] as { messages: Array<{ role: string; content: string }> };
  const roles = payload.messages.map((m) => m.role);
  expect(roles).not.toContain('tool');
  expect(roles).not.toContain('error');
  const userMsg = payload.messages.find((m) => m.role === 'user');
  expect(userMsg?.content.length).toBeLessThanOrEqual(2000);
});
```

**追加的两个 NFR-09 守门断言（照此模式新增）：**
1. `tool` role 消息含 `base64_raw` 字段 → 序列化后所有 content 不含 `'base64'`/`'data:image'`，且 `tool` role 完全不在结果中
2. `user` role 消息 content 不含 `'base64'`/`'data:image'`（上传图路径：augmented prompt 不写进 user message.content，只传 runAgent 内部用）

---

### `src/providers/aihubmix-vision.test.ts` （新建）

**Analog:** `src/store/providers.test.ts`（Vitest + vi.stubGlobal fetch mock pattern）

**Test framework pattern** (providers.test.ts 首部模式):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.stubGlobal('fetch', vi.fn());
```

**新测试覆盖点：**
- `analyzeImages` 多图 content array 格式：text block 在前，image_url blocks 在后，各图 url 含正确 `data:${mimeType};base64,...` 前缀
- `analyze` 向后兼容：内部调 `analyzeImages`，单图路径正确拼接
- apiKey 仅在 `Authorization: Bearer ...` header，不在 body（T-01-04）
- 网络失败（fetch throw）→ `NetworkError`；HTTP 4xx → `mapHttpError` 正确 AsterError
- `stream: false` 在请求 body 中（非流式）

---

### `src/store/attachments.test.ts` （新建）

**Analog:** `src/store/selection.test.ts`（最小内存 store 测试范式）

**覆盖点：**
- `addImages` 追加，不覆盖已有图片
- `clearImages` 后 `images.length === 0`
- `removeImage(id)` 精确移除目标 id，保留其余
- **NFR-09 关键断言：** store 为纯内存态，无 persist middleware——通过验证 `localStorage.setItem` mock 从未被调用（或 `getState()` 无 `_hasHydrated` / `persist` 相关字段）

---

## Shared Patterns

### 错误返回格式（ReadableResult 失败路径）
**Source:** `src/adapters/PptAdapter.ts` read() 内各 NOT_FOUND/UNSUPPORTED case（L375-384 等）
**Apply to:** 三宿主 get_shape_image 的全部 fallback 路径
```typescript
return {
  ok: false,
  error: {
    code: 'NOT_FOUND',          // 或 'UNSUPPORTED' / 'HOST_API_FAILED'
    message: '用户可读中文错误',
    recoverable: true,
    hint: 'LLM 可读操作提示',
  },
} satisfies ReadableResult;
```

### HostApiError 包装（catch 边界）
**Source:** `src/adapters/PptAdapter.ts` L360-363、`src/adapters/WordAdapter.ts` L534
**Apply to:** 三宿主 get_shape_image 的 catch 块；不存 hostError 字段（防 stack 泄漏）
```typescript
} catch (err) {
  warnHostErr('get_shape_image', err);          // PPT 专用辅助函数
  throw new HostApiError('PPT get_shape_image 失败', err);
}
// Excel/Word 同，无 warnHostErr，直接 throw new HostApiError(...)
```

### ProviderRegistry.resolve('vision') 注入
**Source:** `src/providers/registry.ts` L112-123
**Apply to:** 三宿主 adapter 内 get_shape_image case（调 AihubmixVisionClient 前）；chat.ts sendMessage（上传图路径）
```typescript
const cfg = ProviderRegistry.resolve('vision', getDefaultLLM) as ImageConfig;
// 若 aihubmix key 未配置 → 自动 throw KeyInvalidError
// → dispatchTool catch → sanitizeFromAsterError → PERMISSION_DENIED（D-13 三类错误之三）
```

### dispatchTool sanitize 边界（自动覆盖，无需手写）
**Source:** `src/agent/tools/index.ts` L169-219
**Apply to:** get_shape_image（通过 dispatchTool 自动覆盖）
- AsterError 子类（含 KeyInvalidError）→ 只读 `.code/.message/.hint/.recoverable` 四字段
- 陌生异常 → 兜底 UNSUPPORTED + '宿主操作失败'
- 严禁读 `err.stack` / `err.toString()`（T-01-04/ERR-02）

### wrapReadResult + applySizeCap
**Source:** `src/agent/read-result.ts` L74-105
**Apply to:** `vision.ts` execute 返回路径
```typescript
return wrapReadResult(r, { result_type: 'document_content', source: 'selection.image' });
// 成功：data（含 vision_result 字符串）JSON.stringify → applySizeCap（50K token 硬上限）→ ToolResult.data
// 失败：透传 ReadableResult.error（不读 err.stack）
```

### PPT_TOOLS 守门（Phase 14 D-13）
**Source:** `src/agent/tools/index.ts` L27-40（PPT_TOOLS set），L196-199（normalizeToSnakeCase 应用）
**Apply to:** 所有 PPT 工具（含 `get_shape_image`）
- `get_shape_image` 必须加入 `PPT_TOOLS` set
- `get_shape_image` 的 schema 参数名用 snake_case（`focus`，无 camelCase 字段，加入 set 也是保险守门）

---

## No Analog Found

无完全无 analog 的文件。所有文件均有 exact、self-extension 或 role-match 级别的 analog。

---

## Metadata

**Analog search scope:** `src/agent/tools/read/`, `src/store/`, `src/adapters/`, `src/providers/`, `src/components/`, `src/agent/`
**Files scanned:** 13 (read-only)
**Pattern extraction date:** 2026-06-01
