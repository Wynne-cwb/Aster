# Phase 15: VIS — 视觉看图 - Research

**Researched:** 2026-06-01
**Domain:** Office.js 图片取图 API + aihubmix-vision 接线 + 用户上传图 UX + NFR-09 序列化守门
**Confidence:** MEDIUM（取图 API 部分 LOW，因三宿主 Web 支持存在已知问题和 preview 状态）

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01** 视觉 = read-tool + 一次性调用两条路，都返回文本：文档选中图走 `get_shape_image` **read tool**；用户上传图走**一次性 vision 调用**（发消息时触发，结果作 evidence 注入 prompt）。两条都接 `AihubmixVisionClient`，**图片 base64 不进主 LLM 消息层**，`loop.ts` 核心零/极小改动。
- **D-02** 视觉模型 = aihubmix-vision / gpt-5.4，不验 DeepSeek（spike 004 已 FAIL）。
- **D-03** `get_shape_image` + 上传图 vision 调用均带可选 **focus** 参数：主 agent 传「用户想从图里知道什么」，不传则通用客观描述。质量优先。
- **D-04** 支持范围：PPT 图片 shape + 图表 shape / Excel 图表 / Word inline picture。圈选区域截图不做。
- **D-05** 多选取第一张 + 提示「已看第 1 张」。
- **D-06** 触发 = 纯 agent 自决，不改现有 SelectionPill。
- **D-07** 取图 = 执行期 spike gate；失败 fallback 引导点回形针上传这张图。
- **D-08** 激活现有 InputBar 禁用回形针 + Ctrl+V 粘贴。不做拖拽。
- **D-09** 多张图片 + 格式 png/jpg/webp；单图大小设合理上限。
- **D-10** 上传图本会话内存态复用；绝不写 localStorage；刷新即丢。
- **D-11** Phase 15 回形针只接图片；非图片文件 → 结构化错误「文件解析即将开放」。
- **D-12** serialize 守门：base64 永不写入 persisted 聊天历史；加 serialize-test。
- **D-13** 三类结构化错误 `{code,message,recoverable,hint}`：① 选区不是图 ② 取图 API 失败 ③ 没配 aihubmix key。
- **D-14** 诚实不撒谎：非图片文件上传 → 「文件解析即将开放，当前可上传图片」。

### Claude's Discretion
- `focus` 参数的具体 prompt 措辞；单图大小上限阈值；多图 vision content array 组织（一次调用 vs 多次）。
- 上传图内存态 store 的结构；vision 结果注入 sendMessage 的具体形态（augmented prompt 前缀 vs 独立 evidence 消息）。
- `get_shape_image` 代码组织；三宿主取图的具体 Office.js API 选择（spike 决定）。
- 缩略图预览 UI（composer 里上传图的 chip/缩略图）。

### Deferred Ideas (OUT OF SCOPE)
- 拖拽上传（Office for Web 宿主不稳）。
- 圈选单元格/幻灯片区域截图当图看。
- docx/xlsx/pdf/pptx 文本解析（Phase 17）。
- DeepSeek-V4 原生多模态验证（VIS-D1）。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIS-01 | agent 可「看」当前选中的图片/图表作 evidence — 新增 `get_shape_image` read tool（三宿主取图：PPT shape image / Excel chart / Word inline picture），选区驱动半隐式触发 | §问题 1 API 表 + §架构模式 Pattern 1 |
| VIS-02 | 视觉走 aihubmix-vision（OpenAI image_url content part 格式，已存在客户端）；取图/调用失败给结构化错误（沿用 `{code,message,recoverable,hint}`）。**不验 DeepSeek-V4 原生多模态** | §Standard Stack + §问题 3 + §问题 6 |
| FILE-06 | 图片附件 → 走 aihubmix-vision（激活 InputBar 回形针 + Ctrl+V 粘贴，多张，内存态，绝不持久化） | §问题 2 + §问题 4 + §NFR-09 守门 |
| NFR-09 | base64 图片字节**永不**写入 persisted 聊天历史；加 serialize-test 守门 | §问题 4 + §Validation Architecture |
</phase_requirements>

---

## Summary

Phase 15 是「接线」phase，不是从零造——`AihubmixVisionClient` 已就位（Phase 14 建好），`resolve('vision')` 路由已就位，主要工作是：① 建第 12 个 read tool `get_shape_image` 并接进三宿主 adapter；② 激活 InputBar 回形针入口、添加内存态附件 store、发消息时一次性调 vision；③ 扩展 `aihubmix-vision.ts` 支持多图 + focus 参数；④ 加 NFR-09 serialize-test 守门。

**最高风险**：三宿主取图 API 的 Office for Web 支持状况——PPT `shape.getImageAsBase64()` 是 **Preview API**（未 GA），Excel `chart.getImage()` 是 **ExcelApi 1.2** 稳定 API（Web 理论可用但有已知 chart-type 限制），Word `InlinePicture.getBase64ImageSrc()` 是 **WordApi 1.1** 稳定 API（文档声明 Web 支持）。PPT 路径风险最高，必须 spike 开工验。Clipboard/粘贴路径在 Office for Web iframe 内 `navigator.clipboard.read` 受 Permissions Policy 限制，但 `document.addEventListener('paste', event => event.clipboardData.files)` 的 DataTransfer 同步事件模式有更好的 iframe 兼容性，需真机验证。

**Primary recommendation:** PPT 取图以 `shape.getImageAsBase64()` 为主尝试，失败即回退「引导点回形针上传」；粘贴优先用 `paste` 事件的 `clipboardData.items` 同步路径；多图一次调用 vision（content array 多 `image_url` block）；vision 结果以 augmented prompt 头部注入 loop（不改 WireMessage schema）。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 取选中图 base64（VIS-01） | API/Backend（Office.js adapter 层） | — | Office.js run-context 必须在 adapter 内执行，不能跨出 *.run 闭包 |
| 调 vision 客户端 | Browser/Client（aihubmix-vision.ts） | — | 无后台，浏览器直连 aihubmix；同现有 read tool execute |
| focus 参数传递 | API/Backend（read tool ToolDef） | — | agent 在 ToolDef.execute 内决策并传 focus 给 vision 客户端 |
| 用户上传图（FILE-06）— 文件选取/粘贴 | Browser/Client（InputBar.tsx） | — | DOM 事件 + file input，纯 UI 层 |
| 上传图内存态 store | Browser/Client（独立内存 slice 或 chatStore 旁） | — | 内存态，不持久化，React 状态管理 |
| 发消息时 vision 预处理 | Browser/Client（sendMessage 链路） | — | 在 sendMessage 调 runAgent 前调 vision，把文本结果注入 prompt |
| NFR-09 序列化守门 | Browser/Client（chat.ts serializeForStorage） | — | serialize 层白名单过滤，守门在 storage 边界 |

---

## Standard Stack

### Core（全部既有，Phase 15 复用）

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `AihubmixVisionClient` | 内部（src/providers/aihubmix-vision.ts） | vision 调用 | Phase 14 已建好、已对齐 gpt-5.4，Phase 15 主要接线 |
| `ProviderRegistry.resolve('vision')` | 内部（src/providers/registry.ts L112-123） | 注入 VisionConfig | 已就位，包含 KeyInvalidError 路径 |
| `AIHUBMIX_VISION_MODEL = 'gpt-5.4'` | 内部 const | vision model id | Phase 14 `/v1/models` 实测确认可用 [VERIFIED: Phase 14 spike] |

### Supporting（Phase 15 新增运行时 0 依赖）

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| 原生 `FileReader` / `arrayBuffer()` | 浏览器内置 | File → base64 转换 | 用户从 file input 选图 |
| 原生 `paste` DOM event `clipboardData` | 浏览器内置 | Ctrl+V 粘贴取图 | clipboard 图片 |
| `Office.js` CDN | CDN | PPT/Excel/Word 取图 API | 见 §问题 1 |

**零新增 npm 依赖**（本 phase 不引入任何新库）。

### Version Verification
```bash
# 无新 npm 包需要验版本
# AihubmixVisionClient 和 registry 已在 src/providers/ 就位
```

---

## Architecture Patterns

### System Architecture Diagram

```
用户操作
  ├── 选中文档图片/图表 + 发消息
  │     └── agent loop → 调 get_shape_image read tool
  │           └── adapter.read({ kind: 'get_shape_image', ... })
  │                 ├── PowerPoint.run → shape.getImageAsBase64() [SPIKE]
  │                 ├── Excel.run → chart.getImage() [ExcelApi 1.2]
  │                 └── Word.run → inlinePicture.getBase64ImageSrc() [WordApi 1.1]
  │                       └── base64 → AihubmixVisionClient.analyze(focus, base64, mime, cfg)
  │                             └── POST /chat/completions (gpt-5.4, image_url content)
  │                                   └── vision 文本 → ToolResult.data → LLM wire → 主 agent 回答
  │
  └── 用户点回形针 / Ctrl+V 粘贴图片
        └── InputBar → 附件内存 store（images: AttachedImage[]）
              └── sendMessage(prompt, sel, adapter)
                    └── [发消息前] 若有附件图：一次性调 AihubmixVisionClient（多图 content array）
                          └── vision 文本拼到 prompt 头部 → runAgent(augmentedPrompt, ...)
                                └── 主 LLM 只看 augmented 文本，不见 base64
```

**NFR-09 守门位置：** `serializeForStorage` 在 `chat.ts`，只存 `user|assistant` role 的纯文本 `content`，base64 永不落入 `StorableMessage.content`（因 base64 从未写进 `Message.content`，而是存在独立内存 store，在 vision 调用完毕后即被文本替代进入 prompt）。

### Recommended Project Structure（Phase 15 新增/改动文件）

```
src/
├── providers/
│   └── aihubmix-vision.ts       # 扩展：支持多图 images[] + 可选 focus
├── adapters/
│   ├── DocumentAdapter.ts       # 新增 ReadableQuery kind: 'get_shape_image'
│   ├── PptAdapter.ts            # 新增 case 'get_shape_image'（SPIKE）
│   ├── ExcelAdapter.ts          # 新增 case 'get_shape_image'（chart.getImage）
│   └── WordAdapter.ts           # 新增 case 'get_shape_image'（getBase64ImageSrc）
├── agent/tools/
│   ├── read/
│   │   └── vision.ts            # 新增：getShapeImage ToolDef（第 12 个 read tool）
│   └── index.ts                 # 更新 buildToolsForHost（三宿主注册 get_shape_image）
│                                #      PPT_TOOLS set 添加 'get_shape_image'
├── store/
│   ├── attachments.ts           # 新增：内存态附件 store（AttachedImage[]）
│   ├── chat.ts                  # 更新 sendMessage：调 vision 注入 + NFR-09 守门不变
│   └── chat.test.ts             # 扩展白名单断言
└── components/
    └── InputBar.tsx             # 激活回形针：onClick + file input + paste handler
```

### Pattern 1: get_shape_image read tool（照抄现有 read tool 范式）

```typescript
// Source: src/agent/tools/read/ppt.ts（照此范式）
// src/agent/tools/read/vision.ts

interface GetShapeImageArgs {
  focus?: string;   // 可选，主 agent 决定是否传
}

export const getShapeImage: ToolDef<GetShapeImageArgs> = {
  name: 'get_shape_image',
  description:
    '读取当前文档选中的图片或图表，调用视觉分析返回文字描述作为 evidence。' +
    '有 focus 参数时按问题针对性描述；无则客观描述。' +
    '无选中图 / 宿主不支持时返回错误提示。',
  parameters: {
    type: 'object',
    properties: {
      focus: {
        type: 'string',
        description: '可选。想从图里了解什么——如「图表中的数值」「产品名称和价格」，不填则通用描述',
      },
    },
    required: [],
  },
  humanLabel: ({ focus }) => focus ? `正在看这张图（${focus}）…` : '正在看这张图…',
  kind: 'read',
  async execute({ focus }, ctx): Promise<ToolResult> {
    const r = await ctx.adapter.read({ kind: 'get_shape_image', focus });
    return wrapReadResult(r, { result_type: 'document_content', source: 'selection.image' });
  },
};
```

### Pattern 2: adapter 层取图（PPT — SPIKE 决定 API）

```typescript
// PPT adapter 内 case 'get_shape_image'
// 注意：shape.getImageAsBase64() 是 PowerPoint Preview API（未 GA）
// 执行期 spike 验证；失败走 fallback error

case 'get_shape_image': {
  const focus = query.focus;
  try {
    return await PowerPoint.run(async (ctx) => {
      const selection = ctx.presentation.getSelectedShapes();
      selection.load('items');
      await ctx.sync();

      // D-05: 多选取第一张
      const shapes = selection.items;
      if (!shapes.length) {
        return { ok: false, error: { code: 'NOT_FOUND', message: '请先选中一张图片或图表', recoverable: true, hint: '选中图片或图表 shape 再试，或点回形针上传图片' } };
      }
      const shape = shapes[0];
      shape.load('type');
      await ctx.sync();

      // 仅 Picture/Chart 类型支持取图（非文字 shape）
      const IMAGE_SHAPE_TYPES = new Set(['Picture', 'Chart']);
      if (!IMAGE_SHAPE_TYPES.has(shape.type)) {
        return { ok: false, error: { code: 'UNSUPPORTED', message: '选中形状不是图片或图表', recoverable: true, hint: '请选中图片或图表 shape，或点回形针上传图片' } };
      }

      // SPIKE: shape.getImageAsBase64() — PowerPoint Preview API
      const imageResult = shape.getImageAsBase64();
      await ctx.sync();
      const base64 = imageResult.value;
      const mimeType = 'image/png'; // Preview API 返回 PNG

      // 调 vision client
      const cfg = ProviderRegistry.resolve('vision', getDefaultLLM) as ImageConfig;
      const userText = focus ?? '请客观描述这张图片的内容和关键细节';
      const { content } = await new AihubmixVisionClient().analyze(userText, base64, mimeType, cfg);
      return { ok: true, data: { vision_result: content, shape_count: shapes.length } };
    });
  } catch (err) {
    throw new HostApiError('PPT get_shape_image 失败', err);
  }
}
```

### Pattern 3: aihubmix-vision 签名扩展（最小改动，向后兼容）

```typescript
// 扩展 src/providers/aihubmix-vision.ts

export interface VisionImage {
  base64: string;
  mimeType: string;
}

export class AihubmixVisionClient {
  // 现有单图签名（向后兼容，内部走 analyze 多图版）
  async analyze(
    userText: string,
    imageBase64: string,
    mimeType: string,
    config: VisionConfig,
  ): Promise<VisionResult> {
    return this.analyzeImages(userText, [{ base64: imageBase64, mimeType }], config);
  }

  // 新增多图版
  async analyzeImages(
    userText: string,
    images: VisionImage[],  // 支持多张
    config: VisionConfig,
  ): Promise<VisionResult> {
    const url = `${config.baseURL.replace(/\/$/, '')}/chat/completions`;
    const imageBlocks = images.map(({ base64, mimeType }) => ({
      type: 'image_url' as const,
      image_url: { url: `data:${mimeType};base64,${base64}` },
    }));

    // OpenAI multi-content format: text first, then images
    const content = [
      { type: 'text' as const, text: userText },
      ...imageBlocks,
    ];
    // ... rest same as current analyze()
  }
}
```

### Pattern 4: 上传图内存态 store（独立 slice，不污染 chatStore）

```typescript
// src/store/attachments.ts（新建）
// 独立内存 slice，不持久化，与 chatStore 解耦

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

export const useAttachmentStore = create<AttachmentState>((set) => ({
  images: [],
  addImages: (imgs) => set((s) => ({ images: [...s.images, ...imgs] })),
  clearImages: () => set({ images: [] }),
  removeImage: (id) => set((s) => ({ images: s.images.filter((i) => i.id !== id) })),
}));
// 注：store 为内存态，无 persist middleware，满足 NFR-09
```

### Pattern 5: sendMessage augmented prompt 注入（D-10 + SUMMARY L67 范式）

```typescript
// src/store/chat.ts sendMessage 扩展
// 发消息前：若有附件图，一次性调 vision，把结果拼到 prompt 头部

async sendMessage(prompt, selectionCtx, adapter) {
  // 新增：检查附件图
  const { images, clearImages } = useAttachmentStore.getState();
  let finalPrompt = prompt;

  if (images.length > 0) {
    try {
      const cfg = ProviderRegistry.resolve('vision', getDefaultLLM) as ImageConfig;
      const userText = `用户上传了 ${images.length} 张图片。请分析图片内容，然后回答用户的问题：${prompt}`;
      const visionImages = images.map(({ base64, mimeType }) => ({ base64, mimeType }));
      const { content } = await new AihubmixVisionClient().analyzeImages(userText, visionImages, cfg);
      // evidence 注入 prompt 头部（SUMMARY L67 范式）
      finalPrompt = `[图片 evidence]\n${content}\n\n[用户问题]\n${prompt}`;
    } catch (err) {
      // vision 失败：诚实标注，不阻断发送
      finalPrompt = `[注：图片分析失败，将在无图情况下回答]\n${prompt}`;
    } finally {
      // D-10: 用完即清（一次性消费），图片从内存移除
      // 注：不清可实现「多轮复用」——按 D-10「本会话内可多轮复用」保留
      // 用户明确不要复用时才 clearImages()
    }
  }

  get().pushMessage({ role: 'user', content: prompt, ts: Date.now() });
  await useAgentStore.getState().runAgent(finalPrompt, selectionCtx, adapter);
}
```

### Pattern 6: InputBar 回形针激活 + 粘贴

```typescript
// src/components/InputBar.tsx 改造

// 回形针按钮：从 aria-disabled 变为真实可点击
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

// paste handler（绑定在 textarea 或容器上）
const handlePaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  const imageItems = Array.from(items).filter(i => i.type.startsWith('image/'));
  if (!imageItems.length) return;
  e.preventDefault(); // 防止粘贴文字路径
  void handleImageFiles(imageItems.map(i => i.getAsFile()).filter(Boolean) as File[]);
};
```

### Anti-Patterns to Avoid

- **base64 写入 Message.content**：永远不做。base64 进 chatStore 消息体 → 序列化 → localStorage → 配额炸 + LLM 重放死循环（设计契约，SUMMARY L18/L74）。
- **per-turn 切模型**：loop.ts 是单模型 per-run 架构（WireMessage.content 全是纯 string），不支持 per-turn 切 vision。vision 必须在 read tool execute 或 sendMessage 预处理中完成，不在主 LLM 消息流中。
- **PPT get_shape_image 在 PPT_TOOLS set 外**：必须加入 `PPT_TOOLS`，否则 normalizeToSnakeCase 不生效（Phase 14 D-10/D-13 守则）。
- **vision 错误透传 err.stack**：沿用 sanitize 边界，只读 AsterError 子类四字段，不读 err.stack。
- **navigator.clipboard.read 作为粘贴主路径**：Office for Web iframe 受 Permissions Policy 限制；优先用同步 `paste` 事件的 `clipboardData.items`。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| vision 调用（多图、鉴权、错误处理） | 自写 fetch 逻辑 | `AihubmixVisionClient.analyzeImages()` | 已就位，Phase 14 对齐 gpt-5.4，安全：apiKey 仅在 header |
| vision config 注入 | 自己读 storage 取 aihubmix key | `ProviderRegistry.resolve('vision', getDefaultLLM)` | 已就位，含 KeyInvalidError 路径 |
| tool 执行错误序列化 | 自写 try/catch | `dispatchTool` + `sanitizeFromAsterError` | 已有 allowlist sanitize 边界；不读 err.stack |
| read 结果大小保护 | 自写 token 估算 | `wrapReadResult + applySizeCap` | 已就位，50K token 硬上限 |
| vision 结果持久化 | 把 base64 或 vision 结果写 localStorage | `useAttachmentStore`（内存）+ prompt 头部注入 | NFR-09 设计契约 |

---

## 问题 1：三宿主取选中图为 base64 的确切 API

### PPT：`shape.getImageAsBase64()` — PREVIEW API（最高风险）

**API 名：** `PowerPoint.Shape.getImageAsBase64(options?: PowerPoint.ShapeGetImageOptions): OfficeExtension.ClientResult<string>`

**Requirement set：** `powerpoint-js-preview`（**Preview 状态，未 GA**）[CITED: learn.microsoft.com/en-us/javascript/api/powerpoint/powerpoint.shape?view=powerpoint-js-preview]

**返回：** Base64 编码的 PNG 字符串

**已知问题：**
- Shape.getImageAsBase64 在 Mac/Windows 生成图片存在跨平台不一致（issue #6266）[CITED: github.com/OfficeDev/office-js/issues/6266]
- 为 Preview API，不建议生产使用——但 Aster 的 spike 策略（开工先真机验，失败即 fallback）与此匹配

**Office for Web 支持：** 文档标注 Preview，需真机 spike 验证 Web 行为。

**图表 shape（PPT Chart）：** 图表 shape 类型为 `'Chart'`，不在 `TEXT_SHAPE_TYPES` 集合中（`GeometricShape/TextBox/Placeholder/Callout`）。`shape.getImageAsBase64()` 对图表 shape 是否有效需 spike 验——文档未明确区分 Picture 和 Chart shape。

**D-05 多选取第一张：** 从 `ctx.presentation.getSelectedShapes()` 取 `items[0]`，判断 `shape.type` 是否为 `'Picture'` 或 `'Chart'`，非此类型返回 UNSUPPORTED 错误并给 hint 引导点回形针。[VERIFIED: PptAdapter.ts L181-185 selectedShapeIds/Type 已就位]

**Fallback（D-07）：** getImageAsBase64 抛错 → HostApiError → wrapReadResult 返 NOT_FOUND/UNSUPPORTED → agent 在回复中引导「请点回形针上传这张图」。

**spike 验收标准：**
- Office for Web (Edge/Chrome) 中，PPT 选中一张图片 shape，调 `shape.getImageAsBase64()`，能拿到非空 base64 字符串。
- 失败：标注「PPT Web 取图不可用」，所有 PPT get_shape_image 调用返回 fallback 错误。

### Excel：`chart.getImage()` — ExcelApi 1.2（稳定）

**API 名：** `Excel.Chart.getImage(width?: number, height?: number, fittingMode?): OfficeExtension.ClientResult<string>`

**Requirement set：** `ExcelApi 1.2`（**稳定 API，已 GA**）[CITED: learn.microsoft.com/en-us/javascript/api/excel/excel.chart?view=excel-js-preview]

**返回：** Base64 JPEG 字符串

**已知问题：**
- `chart.getImage()` 可用，但 2024 年前后有报告 size 参数被忽略（issue #3980）[CITED: github.com/OfficeDev/office-js/issues/3980]——无参数调用仍正常
- 某些特殊图表类型（Pareto、Funnel、含自定义的常见图表）在 Excel Online 报错（issue #83）

**Office for Web 支持：** ExcelApi 1.2 在 Excel for Web 支持。

**如何取选中图表：** Excel JS API **没有** `getSelectedChart()` 或 `getActiveChart()` 方法 [CITED: learn.microsoft.com Q&A: how-to-get-selected-chart-element-in-excel-js-api]。推荐做法是监听 `chart.onActivated` 事件，但 agent loop 是单次调用模式不适合持久订阅。**实际可行方案：** 在 `get_shape_image` execute 时通过 `ctx.workbook.getActiveChartOrNullObject()` 尝试获取当前激活的图表（ExcelApi 1.9 GA）。若图表已被点选激活，此 API 可用；若未激活（用户只是在单元格范围内操作），则返回 null。

**spike 验收标准：**
- 用户在 Excel for Web 点击一张图表使其激活，agent 调 `get_shape_image`，能通过 `ctx.workbook.getActiveChartOrNullObject()` 拿到 chart 并调 `chart.getImage()` 返回 base64。
- 失败：若 `getActiveChartOrNullObject()` 返回 null → UNSUPPORTED 错误提示「请先点击一下图表使其激活，或点回形针上传图片」。

### Word：`InlinePicture.getBase64ImageSrc()` — WordApi 1.1（稳定）

**API 名：** `Word.InlinePicture.getBase64ImageSrc(): OfficeExtension.ClientResult<string>`

**Requirement set：** `WordApi 1.1`（**稳定 API，已 GA**）[CITED: learn.microsoft.com/en-us/javascript/api/word/word.inlinepicture?view=word-js-preview]

**重要澄清：** 文档页上 `getBase64ImageSrc` 方法的 remarks 标注 `WordApi 1.1`（而不是 `WordApiDesktop 1.1`）。之前 WebSearch 摘要中「desktop only」结论是**错误的**——`imageFormat` 属性才是 `WordApiDesktop 1.1`，`getBase64ImageSrc()` 方法本身是 `WordApi 1.1`，应该在 Word for Web 也可用。[VERIFIED: 官方文档页 Method Details 段落]

**如何取选中 inline picture：**
```typescript
// 获取文档中的 inlinePictures（选区内 or 全文档首张图）
// Word 无「取当前选区 inline picture」的直接 API；
// 需通过 ctx.document.getSelection() 获取 Range，再访问 range.inlinePictures
const selection = ctx.document.getSelection();
selection.inlinePictures.load('items');
await ctx.sync();
if (selection.inlinePictures.items.length === 0) { /* 无图 */ }
const pic = selection.inlinePictures.items[0];
const base64Result = pic.getBase64ImageSrc();
await ctx.sync();
const base64 = base64Result.value;
```

**嵌入式（非 inline）图片：** Word 的图片可分为 inline（正文流中）和 floating（锚定 text box 中）。`InlinePictureCollection` 只覆盖 inline 图片；floating 图片需通过 `shapes` 访问（`WordApi 1.3+`），但 floating picture 的 base64 获取 API 不在 WordApi 1.1 中。**Phase 15 范围：仅 inline picture，与 D-04 一致。**

**Office for Web 支持：** WordApi 1.1 支持 Word for Web。

**spike 验收标准：**
- 用户在 Word for Web 选中一张内嵌图片，agent 调 `get_shape_image`，能通过 `selection.inlinePictures.items[0].getBase64ImageSrc()` 返回 base64。

---

## 问题 2：Office iframe 内 Ctrl+V 粘贴图片 + file input 上传

### 粘贴路径：同步 `paste` 事件（推荐，不受 iframe Permissions Policy 限制）

Office Task Pane 跑在 Office 控制的 iframe 内。`navigator.clipboard.read()` 等异步 Clipboard API 需要 `clipboard-read` Permissions Policy，而 Office 的 Task Pane iframe 不开放此 permission——会报 DOMException。[CITED: github.com/OfficeDev/office-js/issues/1991]

**可靠做法**：监听 `document`（或 `textarea`）的 `paste` 事件，从同步 `event.clipboardData.items` 取图：

```typescript
const handlePaste = (e: ClipboardEvent) => {
  const items = Array.from(e.clipboardData?.items ?? []);
  const imageItems = items.filter(item => item.kind === 'file' && item.type.startsWith('image/'));
  if (!imageItems.length) return;
  e.preventDefault();
  const files = imageItems.map(i => i.getAsFile()).filter((f): f is File => f !== null);
  void processImageFiles(files);
};
```

`clipboardData.items` 是同步 API（DataTransfer），**不受 iframe clipboard Permissions Policy 限制**，是粘贴图片在 Task Pane 内最可靠的路径。[CITED: web.dev/patterns/clipboard/paste-images]

**需真机验证**：Office for Web 的 `paste` 事件在 Task Pane 内是否正常触发（目前无明确文档保证，需 spike）。

### file input 路径

标准浏览器 `<input type="file" accept="image/..." multiple>` 在 Task Pane 内无特殊 Office 限制，可正常使用。`File` 对象转 base64：

```typescript
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]); // 去掉 data:...;base64, 前缀
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

**mimeType 推断：** 直接从 `file.type` 获取（`image/png`、`image/jpeg`、`image/webp`）。

### 单图大小上限（Claude's Discretion）

建议：**5 MB per image**（约 6.7 MB base64）。理由：
- aihubmix gpt-5.4 context 窗口大，不是瓶颈
- 大图增加传输时间，超过 P95 = 10s 的 NFR
- 多张图时更需要控制总体积
- 实现：`if (file.size > 5 * 1024 * 1024)` 拦截并提示「图片过大，请选择 5MB 以下的图片」

### 非图片文件拦截（D-11/D-14）

file input 的 `accept` 属性限制为 `image/png,image/jpeg,image/webp`。即使绕过 accept，在 `onChange` 中对 `file.type` 做二次检查，非图片 → 返回错误「文件解析即将开放，当前可上传图片」（D-11 诚实提示）。

---

## 问题 3：aihubmix-vision 多图 + focus 参数扩展

### OpenAI multi-image content array 格式（已验证）

单次调用塞多张图的正确格式（OpenAI Chat Completions wire format）[CITED: developers.openai.com/api/docs/guides/images-vision]：

```json
{
  "model": "gpt-5.4",
  "stream": false,
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "用户的 focus 问题或通用描述指令" },
      { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } },
      { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } }
    ]
  }]
}
```

**最佳实践：** text 放在 image 之前（模型按顺序处理，先看到 prompt 再看图效果更好）。多图时建议在 text 中标注「图 1:」「图 2:」。

**一次调用 vs 多次调用（Claude's Discretion）：**
- **一次调用塞多张**（推荐）：更少 API 往返，token 成本可控（约合计几百 token），vision 能跨图对比。
- 多次调用：仅在图数量极多（>5 张）或单图 focus 完全独立时考虑。
- Phase 15：一次调用，content array 按上述格式。

**每次请求图片上限：** OpenAI 限制约 10 张/次。Phase 15 多图上限可设 **5 张**（合理保守，单次 vision 对话已足够）。

### analyze() 最小扩展方案

现有 `analyze(userText, imageBase64, mimeType, config)` 签名向后兼容：内部调新的 `analyzeImages(userText, [{base64, mimeType}], config)`。调用方无需改动现有单图调用。

**focus 参数 prompt 措辞建议（Claude's Discretion）：**
```
有 focus 时：userText = `${focus}（请从图中抽取能直接用于撰写文档的具体细节）`
无 focus 时：userText = `请客观描述图片的所有关键内容：文字、数据、人物/物品、版式结构，用于协助撰写办公文档。`
```
理由：「能直接用于撰写文档的具体细节」对齐用户核心场景（基于图生成文档）；"客观描述"要求 vision 给足够丰富的 evidence 而非主观解读。

---

## 问题 4：NFR-09 序列化守门做法

### 当前 serializeForStorage 机制（已验证）

`src/store/chat.ts:119-131` [VERIFIED: 代码已读]:
```typescript
function serializeForStorage(messages: Message[]): StorableMessage[] {
  return messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && !m.isStreaming)
    .map(m => ({ id: m.id, role: m.role, content: m.content.slice(0, 2000), ts: m.ts }));
}
```

`StorableMessage` = `{id, role: 'user'|'assistant', content: string, ts?}`，**只存纯文本 content**。

### 为什么 base64 自然不入 storage

两条路径 base64 从未写入 `Message.content`：

1. **文档选中图（VIS-01）路径**：base64 在 `adapter.read()` 内被 vision 消费，`ToolResult.data` 只含 `{ vision_result: string }`（纯文本），通过 `wrapReadResult → ToolResult.data`，最终写入 `tool` role 消息的 `toolResult` 字段（非 `content`）。`serializeForStorage` 过滤掉 `tool` role，所以连 toolResult 也进不了 storage。

2. **用户上传图（FILE-06）路径**：base64 存在 `useAttachmentStore.images[]`，vision 调用发生在 `sendMessage` 调 `runAgent` 之前，vision 文本结果拼到 `finalPrompt`（augmented prompt 头部），用户看到的 `Message.content = prompt`（原始文本），`finalPrompt` 仅在 `runAgent` 内部用作 wire messages，**不写进 chatStore 消息**。

### 结论：现有 serializeForStorage 已天然满足 NFR-09

**但仍需加 serialize-test 守门**（memory `feedback_recurring_failure_add_gate`），防止未来改动破坏此保证。

### chat.test.ts 白名单测试扩展（结构性守门）

在现有 `serializeForStorage 白名单` 测试（L204-224）之后增加：

```typescript
it('serializeForStorage 不存储 base64 数据：vision tool result 中的 base64 被过滤', () => {
  const base64Payload = 'data:image/png;base64,' + 'A'.repeat(1000); // 模拟 base64
  useChatStore.setState({
    messages: [
      { id: 'u1', role: 'user', content: '分析这张图', ts: 1 },
      {
        id: 'tool1', role: 'tool', content: '正在看这张图…',
        toolResult: { ok: true, data: { vision_result: '图中是一张饼图', base64_raw: base64Payload } },
        ts: 2,
      },
      { id: 'a1', role: 'assistant', content: '根据图片，图中显示...', ts: 3 },
    ],
  } as never);

  useChatStore.getState().saveHistory('aster:chat:testDoc');
  const call = mockedStorage.set.mock.calls[0];
  const payload = call[1] as { messages: Array<{ role: string; content: string }> };
  const allContent = payload.messages.map(m => m.content).join('');
  expect(allContent).not.toContain('base64');
  expect(allContent).not.toContain('data:image');
  // tool role 完全不在序列化结果中
  expect(payload.messages.every(m => m.role !== 'tool')).toBe(true);
});

it('serializeForStorage 不存储附件 store 中的 base64（上传图路径）', () => {
  // 上传图路径：finalPrompt 有 vision 文本，但 user message.content = 原始 prompt
  // 验证 user message content 不含 base64
  useChatStore.setState({
    messages: [
      { id: 'u1', role: 'user', content: '基于这张图写一份报告', ts: 1 },
      { id: 'a1', role: 'assistant', content: '好的，根据图片内容...', ts: 2 },
    ],
  } as never);

  useChatStore.getState().saveHistory('aster:chat:testDoc');
  const call = mockedStorage.set.mock.calls[0];
  const payload = call[1] as { messages: Array<{ role: string; content: string }> };
  const allContent = payload.messages.map(m => m.content).join('');
  expect(allContent).not.toContain('base64');
  expect(allContent).not.toContain('data:image');
});
```

---

## 问题 5：vision 结果注入 sendMessage 链路

**推荐：augmented user prompt 前缀**（SUMMARY L67 范式，不改 loop.ts / WireMessage）

**理由：**
- WireMessage.content 目前是纯 string（loop-helpers.ts L23-41），修改为 multi-content array 会破坏大量逻辑（DeepSeek reasoning_content 字段、tool_calls 组装等）。
- augmented prompt 头部注入无需改 loop.ts，与现有「FILE-07 附件内容注入」范式一致。
- vision 返回文本 evidence 已经是高质量摘要，注入 prompt 头部对 LLM 效果良好。

**注入格式（Claude's Discretion 建议）：**
```
[图片分析 evidence]
{vision_text_result}
---
{original_user_prompt}
```

**注入点：** `chat.ts sendMessage` 中，`get().pushMessage(...)` 之后、`useAgentStore.getState().runAgent(finalPrompt, ...)` 之前。用户气泡显示 `original_user_prompt`（不含 evidence），`finalPrompt` 传给 agent。

**对话历史截断**：`truncateTo20Turns` 在 loop.ts 只过滤 `user|assistant` role，augmented prompt 作为 user message 正常入历史，vision evidence 随 user message 一起进入 20 turn 窗口——这是可接受的行为（evidence 让下轮对话有上下文）。

**loop.ts 零改动**：runAgent 签名是 `(userPrompt: string, ...)` 接纯 string，augmented prompt 在外部组装后传入，内部无感知。

---

## 问题 6：错误体系（D-13）

沿用现有 `{code, message, recoverable, hint}` + `mapHttpError/NetworkError/HostApiError/KeyInvalidError` 链路（Phase 14 已验证）。

三类结构化错误的推荐实现：

| 场景 | code | message | recoverable | hint |
|------|------|---------|-------------|------|
| 选区不是图（文字/空选区） | `UNSUPPORTED` | 请先选中一张图片或图表，或点回形针上传一张图 | `true` | 选中图片或图表 shape 后再试，或使用回形针按钮上传图片 |
| 取图 API 失败（宿主限制/spike 失败） | `HOST_API_FAILED` | 当前无法读取选中图（宿主限制），可点回形针上传这张图 | `true` | 改用 InputBar 回形针按钮上传图片，绕过宿主限制 |
| 没配 aihubmix key | `PERMISSION_DENIED` | 请先在设置里填写 aihubmix Key | `false` | 打开设置面板，在 aihubmix 栏填入 API Key |

`KeyInvalidError` 由 `ProviderRegistry.resolve('vision', ...)` 抛出，通过 `dispatchTool → sanitizeFromAsterError` 自动映射为 `PERMISSION_DENIED`，无需额外处理。

---

## Common Pitfalls

### Pitfall 1：PPT shape.getImageAsBase64 是 Preview API
**What goes wrong：** 调用后 Office for Web 报 API not available 或方法不存在。
**Why it happens：** `getImageAsBase64` 是 `powerpoint-js-preview` requirement set，未在 GA API 中。
**How to avoid：** 开工第一个 task 是 spike，真机验失败即走 fallback（返 UNSUPPORTED 错误），不影响其他宿主。
**Warning signs：** `shape.getImageAsBase64 is not a function` 或 `GeneralException` 在 PowerPoint.run 中。

### Pitfall 2：Excel 无「取当前选中图表」直接 API
**What goes wrong：** 没有 getSelectedChart，迭代全部 chart 再猜哪个被选中。
**Why it happens：** Excel JS API 的 selection 模型只暴露 range，不暴露 chart selection 状态。
**How to avoid：** 用 `ctx.workbook.getActiveChartOrNullObject()`（ExcelApi 1.9）——用户点击图表后图表会进入「激活」状态，此 API 可取到。spike 验此路径是否在 Excel for Web 可用。
**Warning signs：** 图表未被点选激活（用户在单元格操作后）→ 返回 null → UNSUPPORTED 提示「请先点击图表使其激活」。

### Pitfall 3：Word getBase64ImageSrc 需要 ctx.sync() 两次
**What goes wrong：** 直接读 `base64Result.value` 拿到空值。
**Why it happens：** `getBase64ImageSrc()` 返回 `OfficeExtension.ClientResult<string>`，值在 `ctx.sync()` 后才可读。
**How to avoid：** 先 `getBase64ImageSrc()` 入队，然后 `await ctx.sync()`，再读 `.value`（同现有 `estimateTokens` 读法）。

### Pitfall 4：navigator.clipboard.read 在 Task Pane iframe 被 Permissions Policy 阻断
**What goes wrong：** Ctrl+V 粘贴时 `navigator.clipboard.read()` 抛 DOMException「Clipboard API blocked due to permissions policy」。
**Why it happens：** Office Web 的 Task Pane iframe 不开放 `clipboard-read` permission。
**How to avoid：** 用同步 `paste` 事件的 `clipboardData.items`，不走 `navigator.clipboard`。

### Pitfall 5：PPT 工具未加入 PPT_TOOLS set 导致 camelCase args 不 normalize
**What goes wrong：** get_shape_image 的 args 里有 camelCase 字段（如 `slideIndex`），到 PPT adapter 取不到值。
**Why it happens：** `dispatchTool` 只对 `PPT_TOOLS` 集合内的工具做 `normalizeToSnakeCase`。
**How to avoid：** 在 `src/agent/tools/index.ts` 的 `PPT_TOOLS` set 中加入 `'get_shape_image'`（Phase 14 D-13 守则）。`get_shape_image` 的 schema 参数用 snake_case（`focus`，不含 camelCase 字段）即可，加入 PPT_TOOLS 也是保险。

### Pitfall 6：上传图 vision 调用在 sendMessage 中失败时需诚实降级不阻断
**What goes wrong：** vision 调用失败后整个 sendMessage 抛错，用户消息没法发出。
**Why it happens：** 把 vision 调用放在 sendMessage 主路径上，不处理异常。
**How to avoid：** vision 调用用 try/catch 包裹；失败时在 finalPrompt 头部加 `[注：图片分析失败]` 前缀，继续 runAgent（诚实降级）。

---

## Code Examples

### 现有 analyze() 签名（Phase 14 已建好）
```typescript
// Source: src/providers/aihubmix-vision.ts L26-71
export class AihubmixVisionClient {
  async analyze(
    userText: string,
    imageBase64: string,
    mimeType: string,
    config: VisionConfig,
  ): Promise<VisionResult>
}
```

### 现有 resolve('vision') 路由（Phase 14 已建好）
```typescript
// Source: src/providers/registry.ts L112-123
case 'vision': {
  const apiKey = storage.get<string>(STORAGE_KEYS.KEY_PREFIX + AIHUBMIX_PROVIDER_ID);
  if (!apiKey) throw new KeyInvalidError('aihubmix Key 未配置，请在设置中填写 aihubmix Key');
  return {
    providerId: `${AIHUBMIX_PROVIDER_ID}-vision`,
    baseURL: AIHUBMIX_BASE_URL,
    apiKey,
    model: AIHUBMIX_VISION_MODEL, // = 'gpt-5.4'
  } satisfies ImageConfig;
}
```

### 现有 read tool 范式（照抄）
```typescript
// Source: src/agent/tools/read/ppt.ts L95-123
export const getShape: ToolDef<GetShapeArgs> = {
  name: 'get_shape', kind: 'read',
  async execute({ slideIndex, shapeId }, ctx): Promise<ToolResult> {
    const r = await ctx.adapter.read({ kind: 'get_shape', slideIndex, shapeId });
    return wrapReadResult(r, { result_type: 'document_content', source: `slide_${slideIndex}.shape_${shapeId}` });
  },
};
```

### 现有 ExcelAdapter read 结构（新 case 模板）
```typescript
// Source: src/adapters/ExcelAdapter.ts L183-314（read 方法完整看到）
case 'get_shape_image': {
  try {
    return await Excel.run(async (ctx) => {
      const chartOrNull = ctx.workbook.getActiveChartOrNullObject();
      await ctx.sync();
      if (chartOrNull.isNullObject) {
        return { ok: false, error: { code: 'NOT_FOUND', message: '请先点击一下图表使其激活', recoverable: true, hint: '点击图表后再试，或点回形针上传图片' } };
      }
      const imageResult = chartOrNull.getImage();
      await ctx.sync();
      // 调 vision ...
    });
  } catch (err) {
    throw new HostApiError('Excel get_shape_image 失败', err);
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `deepseek-chat`/`deepseek-reasoner` 模型名 | `deepseek-v4-pro` / `deepseek-v4-flash` | 2026-07-24（旧名废弃）| Phase 15 不用 DeepSeek 做 vision，无影响 |
| `gpt-5.1` vision model | `gpt-5.4` | Phase 14 D-06（2026-06-01 /v1/models 验）| registry 已更新为 gpt-5.4 |
| `@microsoft/office-js` npm | CDN script tag | deprecated | Aster 已使用 CDN，无影响 |
| Word `imageFormat` = `WordApiDesktop 1.1` | Word `getBase64ImageSrc()` = `WordApi 1.1` | （一直如此，澄清易混淆项）| Word for Web 应可用 |

**废弃/过时：**
- `shape.image.getBase64ImageData()`：此方法名**不存在**，正确名称是 `shape.getImageAsBase64()`（Preview API）。
- `InlinePicture.getBase64ImageData()`：同样**不是正确 API 名**，正确名是 `getBase64ImageSrc()`（WordApi 1.1）。

---

## Runtime State Inventory

> Phase 15 是功能新增（接线），非 rename/refactor/migration。

此 phase 无 rename/refactor 场景，Runtime State Inventory 不适用。

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Office.js CDN | 三宿主 read API | ✓ | CDN hosted | — |
| aihubmix API endpoint | AihubmixVisionClient | ✓（需用户配置 key）| gpt-5.4 | KeyInvalidError → 提示用户填 key |
| PowerPoint `shape.getImageAsBase64` | PPT VIS-01 | 需 spike | Preview API | fallback：引导回形针上传 |
| Excel `chart.getImage` + `getActiveChartOrNullObject` | Excel VIS-01 | ✓ ExcelApi 1.2/1.9 | GA | 若 null → 提示点击激活图表 |
| Word `InlinePicture.getBase64ImageSrc` | Word VIS-01 | ✓（理论，WordApi 1.1）| GA | 需 spike 确认 Word for Web |
| `paste` event `clipboardData.items` | FILE-06 粘贴路径 | ✓（同步 DataTransfer API）| 浏览器内置 | 若不触发 → 引导用 file input |

**需 spike 验证的依赖（优先级排序）：**
1. PPT `shape.getImageAsBase64()` — Preview API，风险最高，开工第一 spike
2. Word `InlinePicture.getBase64ImageSrc()` — WordApi 1.1 理论可用，确认 Word for Web 真机
3. Excel `ctx.workbook.getActiveChartOrNullObject()` — ExcelApi 1.9，确认图表激活状态真机行为
4. `paste` 事件在 Task Pane — 确认 clipboard paste 在 Office for Web iframe 触发

---

## Validation Architecture

nyquist_validation = true（config.json 已确认）。

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest（项目现有） |
| Config file | vite.config.ts（vitest 配置内嵌）|
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test -- --run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIS-01 | get_shape_image read tool 调 adapter.read + wrapReadResult | unit | `npm test -- --run src/agent/tools/read/vision.test.ts` | ❌ Wave 0 |
| VIS-01 | PptAdapter case 'get_shape_image' 正确路径（mock Office API）| unit | `npm test -- --run src/adapters/PptAdapter.read.test.ts` | ✅（扩展）|
| VIS-01 | ExcelAdapter case 'get_shape_image' 正确路径 | unit | `npm test -- --run src/adapters/ExcelAdapter.read.test.ts` | ✅（扩展）|
| VIS-01 | WordAdapter case 'get_shape_image' 正确路径 | unit | `npm test -- --run src/adapters/WordAdapter.read.test.ts` | ✅（扩展）|
| VIS-02 | AihubmixVisionClient.analyzeImages 多图 content array 格式 | unit | `npm test -- --run src/providers/aihubmix-vision.test.ts` | ❌ Wave 0 |
| VIS-02 | ProviderRegistry.resolve('vision') KeyInvalidError | unit | 已有 registry 测试（扩展）| ✅（扩展）|
| VIS-02 | dispatchTool PPT_TOOLS 含 get_shape_image | unit | `npm test -- --run src/agent/tools/tools.test.ts` | ✅（扩展）|
| FILE-06 | useAttachmentStore 内存 slice，无 persist | unit | `npm test -- --run src/store/attachments.test.ts` | ❌ Wave 0 |
| FILE-06 | sendMessage 有附件时调 vision + augmented prompt | unit | `npm test -- --run src/store/chat.test.ts` | ✅（扩展）|
| NFR-09 | serializeForStorage 不存 base64（vision tool result）| unit | `npm test -- --run src/store/chat.test.ts` | ✅（扩展）|
| NFR-09 | serializeForStorage 不存附件 store base64 | unit | `npm test -- --run src/store/chat.test.ts` | ✅（扩展）|
| VIS-01 PPT spike | Office for Web 真机取 PPT 图片 shape base64 | manual（spike） | 需真机 | ❌ spike |
| VIS-01 Excel spike | Office for Web 真机取激活图表 base64 | manual（spike） | 需真机 | ❌ spike |
| VIS-01 Word spike | Office for Web 真机取 inline picture base64 | manual（spike） | 需真机 | ❌ spike |
| FILE-06 paste spike | Office for Web Task Pane paste 事件触发 | manual（spike）| 需真机 | ❌ spike |

### Sampling Rate
- Per task commit: `npm test -- --run`
- Per wave merge: `npm test -- --run --coverage`
- Phase gate: Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/agent/tools/read/vision.test.ts` — covers VIS-01 get_shape_image ToolDef
- [ ] `src/providers/aihubmix-vision.test.ts` — covers VIS-02 analyzeImages 多图格式
- [ ] `src/store/attachments.test.ts` — covers FILE-06 内存态 store
- [ ] PPT/Excel/Word Adapter 扩展 `get_shape_image` case（现有文件追加）
- [ ] `src/store/chat.test.ts` 扩展 NFR-09 serialize-test 守门（现有文件追加）

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | aihubmix key 仅从 storage 读取进 header，不经 Aster 服务器；KeyInvalidError 路径已就位 |
| V5 Input Validation | yes | 图片 MIME type 白名单（image/png,jpeg,webp）；非图片文件拦截 |
| V6 Cryptography | no | — |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| base64 数据进 localStorage 持久化 | Information Disclosure | NFR-09 serialize 白名单守门 + chat.test.ts 结构性守门 |
| apiKey 泄露进 ToolResult / error.message | Information Disclosure | dispatchTool sanitize 边界（不读 err.stack/err.message on non-AsterError），AsterError 子类只传中文字面量 |
| 大图撑爆内存/触发 quota | Denial of Service | 5MB per image 上限；vision token 消耗预警（quality > cost 原则，但上限防 DoS）|
| 非图片文件伪装图片 MIME | Tampering | MIME type 双重检查（file input accept + onChange 内 file.type 验证） |
| vision 内容注入（图片中嵌入 prompt injection）| Elevation of Privilege | vision 结果走 augmented prompt 前缀（evidence 块），不直接执行；sanitize 注入边界（沿用 v2.0 机制）|

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Word.InlinePicture.getBase64ImageSrc()` 在 Word for Web 可用（WordApi 1.1）| 问题 1 Word 段 | 若仅 desktop，Word VIS-01 需改为 fallback 引导上传；spike 验证 |
| A2 | `paste` 事件的 `clipboardData.items` 在 Office for Web Task Pane iframe 可触发（同步 DataTransfer 不受 Permissions Policy 限制）| 问题 2 粘贴段 | 若不可用，粘贴路径废弃，只留 file input 上传；spike 验证 |
| A3 | `Excel.Workbook.getActiveChartOrNullObject()` 在用户点击图表后能正确返回激活的图表 | 问题 1 Excel 段 | 若在 Excel for Web 行为不稳定，需改为「枚举工作表所有图表让 agent 选」方案 |
| A4 | gpt-5.4 支持 OpenAI multi-content image_url array（多图）| 问题 3 | 若不支持，退化为单图路径（每图单独调 vision） |
| A5 | aihubmix `gpt-5.4` vision 调用的 mimeType 接受 `image/jpeg` 和 `image/webp`（不仅 png）| 问题 3 | 若只接受 png，需在上传时统一 canvas 转 png |

**如果此表为空则所有 claim 均已验证——本 phase 有 5 个 ASSUMED 项需 spike 确认。**

---

## Open Questions

1. **PPT shape.getImageAsBase64 在 Office for Web 实际行为**
   - What we know: Preview API，文档已标注「不建议生产使用」
   - What's unclear: 在 Office for Web (Edge/Chrome) 中是否能正常返回 PNG base64
   - Recommendation: 开工 spike P0（第一个 task），失败立即走 fallback

2. **Excel getActiveChartOrNullObject 在「未激活图表」状态下的稳定性**
   - What we know: ExcelApi 1.9 GA；文档记录此方法存在
   - What's unclear: 用户在普通单元格操作后（非点击图表状态），getActiveChart 返回 null 的行为是否稳定
   - Recommendation: spike 与 PPT spike 合并，同一次真机测试

3. **paste 事件在 Task Pane iframe 的触发**
   - What we know: navigator.clipboard 异步 API 被 iframe Permissions Policy 阻断；synchronous DataTransfer API 不在同一限制体系下
   - What's unclear: Office for Web 的 Task Pane iframe 是否将 paste 事件从宿主 document 透传到 iframe document
   - Recommendation: 真机验：打开 Task Pane，focus 到 textarea，Ctrl+V 粘贴截图，看 paste 事件是否触发

4. **多轮复用上传图（D-10 内存态）的 UX 细节**
   - What we know: D-10 说「本会话内可多轮复用」；clearImages 在何时调用未定义
   - What's unclear: 发一次消息后是否清除附件图？还是一直保留直到用户手动删除？
   - Recommendation: 倾向「发消息后保留，用户手动删除」（chip 上有 × 按钮）；也可简化为「发消息后清除」（更简单）。Planner 决策。

---

## Sources

### Primary (HIGH confidence)
- `src/providers/aihubmix-vision.ts` — 现有 vision 客户端，L26-71 签名确认
- `src/providers/registry.ts` — resolve('vision') 路由，L112-123 确认
- `src/agent/tools/index.ts` — dispatchTool + PPT_TOOLS set + buildToolsForHost，完整代码阅读
- `src/adapters/DocumentAdapter.ts` — ReadableQuery 判别联合，L164-179
- `src/store/chat.ts` — serializeForStorage 白名单机制，L119-131
- `src/adapters/ExcelAdapter.ts` — read() 方法结构，L183-314
- `src/adapters/PptAdapter.ts` — TEXT_SHAPE_TYPES，getSelection selectedShapeType 实现
- [Excel.Chart.getImage() — Microsoft Learn](https://learn.microsoft.com/en-us/javascript/api/excel/excel.chart?view=excel-js-preview) — ExcelApi 1.2，稳定
- [Word.InlinePicture.getBase64ImageSrc() — Microsoft Learn](https://learn.microsoft.com/en-us/javascript/api/word/word.inlinepicture?view=word-js-preview) — WordApi 1.1，稳定
- [PowerPoint.Shape.getImageAsBase64() — Microsoft Learn](https://learn.microsoft.com/en-us/javascript/api/powerpoint/powerpoint.shape?view=powerpoint-js-preview) — Preview API，未 GA
- [OpenAI Vision API — multi-image content array](https://developers.openai.com/api/docs/guides/images-vision) — 多图格式确认

### Secondary (MEDIUM confidence)
- [How to paste images — web.dev](https://web.dev/patterns/clipboard/paste-images) — paste event + clipboardData.items 用法
- [Excel getActiveChart Q&A — Microsoft Learn](https://learn.microsoft.com/en-us/answers/questions/5809326/how-to-get-selected-chart-element-in-excel-js-api) — 无 getSelectedChart，推荐 onActivated
- [Office.js issue #1991 — Clipboard API blocked in Task Pane iframe](https://github.com/OfficeDev/office-js/issues/1991) — navigator.clipboard 受限证据

### Tertiary (LOW confidence)
- [issue #6266 — getImageAsBase64 Mac/Win 不一致](https://github.com/OfficeDev/office-js/issues/6266) — PPT Preview API 已知 bug

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 所有库均在 Phase 14 已验证就位，本 phase 零新增依赖
- Architecture (接线路径): HIGH — 基于完整代码库阅读，范式清晰
- PPT 取图 API: LOW — Preview API，未 GA，需 spike 真机验
- Excel 取图 API: MEDIUM — getImage() GA，但 getActiveChart 路径需验
- Word 取图 API: MEDIUM — getBase64ImageSrc WordApi 1.1 声明可用，需真机确认
- Clipboard paste: MEDIUM — 同步 DataTransfer 理论不受 Permissions Policy 限制，需真机验
- NFR-09 守门: HIGH — 代码阅读确认，serialize 白名单天然过滤

**Research date:** 2026-06-01
**Valid until:** 2026-06-30（Office.js API 状态稳定，30 天内有效）
