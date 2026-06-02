# Phase 16: IMG — 图片生成插入（PPT + Word） - Research

**Researched:** 2026-06-02
**Domain:** Office.js PPT/Word 插图 API + AihubmixImageClient 接入 agent loop + 预览-确认交互范式
**Confidence:** HIGH（核心 API 已文档核实 + 代码核查完整）

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01（预览容器 = 聊天气泡内 teal 预览卡）:** 预览卡嵌在 AI 回复气泡下方，复用 `.aster-tool-card` 卡片样式；不用 Modal 也不用 Task Pane 独立区域。缩略图用 `<img src="data:${mimeType};base64,${base64}">`。
- **D-02（生图与插入彻底解耦）:** 生图工具只产出预览、无副作用即返回；插入是预览卡按钮触发的独立动作，脱离 agent loop。插入后必须手动 `appendOperation`（带 humanLabel + reverse descriptor）。
- **D-03（agent 扩写中文 prompt）:** agent 把简短描述扩写成具体中文 prompt（主体/风格/构图），不翻译英文，保留用户原意。
- **D-04（model 切换双落点）:** Settings 持久默认 model picker + 预览卡内联临时切 model 重生。
- **D-05（「重新生成」= 同 prompt 重 roll + 替换）:** 新图替换旧预览，不堆叠候选。
- **D-06（PPT = 当前 slide 居中 + 比例默认尺寸）:** 不做 agent 语义放置，不做预览卡指定位置/尺寸。
- **D-07（Word = body 级追加）:** `body.insertInlinePictureFromBase64`（body 级，非 range — Office for Web 已知 bug 强制 body 级）。
- **D-08（「生成中」态 + 可取消）:** 预览卡/气泡显示生成中态，用 AbortController 取消。沿用现有 AgentControlBar 停止能力。
- **D-09（per-host 不注册该工具 + agent 诚实告知）:** 生图插入工具只在 PPT/Word 宿主注册；Excel 宿主工具表不含该工具，agent 诚实回答无法插图。

### Claude's Discretion
- 三类结构化错误沿用 Phase 15 D-13 范式 `{code,message,recoverable,hint}`：①未配 aihubmix key ②生成失败/超时（含取消）③宿主插图 API 失败。
- insert helper 抽象形态（`insertImage(host, base64, mimeType, opts)` helper，供 IMG-01/02 与 Phase 18 LIB 共用）及其与 operationLog 的衔接方式。
- 预览卡组件结构、按钮布局、生成中骨架/spinner 选型（遵循 `aster-design-system` skill）。
- prompt 增强的具体措辞；增强由 agent 在工具入参里自己扩写（不在工具内部加工）。
- doubao fetch→base64 在 provider 内完成（Phase 14 D-02），插入层零感知 URL。

### Deferred Ideas (OUT OF SCOPE)
- 可编辑 prompt 再生（预览卡加 prompt 文本框改了再生）— 本阶段只交付同 prompt 重 roll。
- agent 语义放置插图位置（「插到右下角」算坐标）。
- 多候选并排选图。
- chat LLM（DeepSeek）model 下拉选择 — 超出生图范围。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMG-01 | PowerPoint「生成一张图并插入」write tool — 接生图 provider，插入当前 slide；reverse 复用 `deleteShapeById` | PPT 插图 API 路线：`shapes.addPicture` BETA/Preview only；主路线用 `shapes.addGeometricShape(Rectangle)` + `fill.setImage(base64)` GA 路线；写后回读验证防假成功 |
| IMG-02 | Word「生成一张图并插入」write tool — `body.insertInlinePictureFromBase64`（body 级）；reverse 用 `noop_inverse` | Word API 已文档核实：`body.insertInlinePictureFromBase64(base64, 'End')` 返回 `Word.InlinePicture`；Range 路线在 Web 有已知 bug |
| IMG-03 | 生成结果预览后确认再插入 + 生成中 loading 态 | D-02 解耦架构 + `.aster-tool-card` 预览卡 + `AbortController` 取消 |
| IMG-04 | 生图 model 可选（默认 doubao）+ 「重新生成」 | `IMAGE_GEN_MODELS` 注册表已就位；`ProviderRegistry.resolve('image-gen')` 用硬编码默认；D-04 需要一个可覆盖 model 的 path |
| IMG-05 | Excel 明确 out-of-scope — 工具层不注册 + agent 诚实 | `buildToolsForHost` 仅 word/ppt case 加生图工具；Excel 工具表无此工具，agent 自然诚实 |
</phase_requirements>

---

## Summary

Phase 16 在 Phase 14 已建好的 `AihubmixImageClient`（返回 `{base64, mimeType}`）基础上，把「生成一张图并插入」能力完整接进 PPT/Word agent loop。核心工程分五块：

**第一块：PPT 插图 API 路线决策（开工 spike 最高优先级）。** 官方文档确认 `shapes.addPicture` 目前处于 **BETA/Preview only**（PowerPointApi BETA requirement set），不应在生产中使用。替代的 **GA 路线**是利用 `shapes.addGeometricShape(Rectangle)` + `shape.fill.setImage(base64)` —— `addGeometricShape` 属 PowerPointApi 1.4（Office for Web 已支持），`shape.fill.setImage` 在 PowerPointApi 1.4 GA；此路线完整返回 Shape 对象及其 `.id`，可直接供 `deleteShapeById` inverse 使用。`setSelectedDataAsync + CoercionType.Image` 在 Office for Web 已确认有 `Office.context.document` 为 undefined 的运行时报错（非 BETA，是已知 Web 限制），不能作为主路线。

**第二块：D-02 解耦插入架构。** 生图工具只调用 `AihubmixImageClient.generate()`，把结果（base64+mimeType）附在 `ToolResult.data` 里返回，不调 adapter 也不修改文档。预览卡的「确认插入」按钮触发独立的 `insertImage` helper（直接调 adapter 方法 → 写后回读验证 → 手动 `appendOperation`）。这一路径绕过了 `dispatchTool` 的 PPT casing normalize，但生图工具名本身就属 PPT 工具集需加入 `PPT_TOOLS` Set；adapter 插图方法直接用 snake_case Record 参数，没有 casing 问题。

**第三块：operationLog 手动追加路线。** `appendOperation` 是一个纯内存操作（无副作用），接受完整的 `OperationLogEntry`。非 `dispatchTool` 路径的插入（预览卡按钮触发）必须自行构造 entry 并调用 `appendOperation`，以使「撤销该步 / Undo All」照常工作。PPT reverse 用 `delete_shape_by_id`（已在 `DocumentAdapterForReplay` interface 声明，且 `operationLog.integration.test.ts` 有守门），Word reverse 用 `noop_inverse`。

**第四块：Settings 生图 model picker 和 ProviderRegistry 路线。** `ProviderRegistry.resolve('image-gen')` 目前硬编码 `DEFAULT_IMAGE_GEN_MODEL.id`（doubao）。D-04 要求 Settings 里能持久改默认 model，需要一个存储机制（最简：在 localStorage 单独存 `aster:image-gen-model`）。`IMAGE_GEN_MODELS` 列表（3 个 model）已就绪，Settings picker 直接渲染此列表即可。

**第五块：bundle 约束。** 当前 main chunk 78.03 KB gzip（≤82 KB 门）。生图工具代码 + 预览卡 UI 估计净增 3–5 KB gzip，仍在门内。`AihubmixImageClient` 已在 main chunk（Phase 14）。生图调用本身是 `fetch` + JSON，零新增运行时依赖。

**Primary recommendation:** 开工第一件事跑真机 spike——在 Office for Web 上验证 GA 路线（`addGeometricShape(Rectangle) + fill.setImage(base64)`）能否成功插入图片并回读到 shape.id；若失败则评估 BETA CDN 路线可行性。Word body 级路线已有文档背书，spike 风险低。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 生图 API 调用 | Agent Loop（工具层） | Provider（AihubmixImageClient） | 工具调用 provider.generate()，结果给 UI 层渲染预览 |
| 预览卡渲染 + 确认/取消按钮 | Frontend（React 组件，Task Pane） | — | 纯 UI 层，不涉及文档写入 |
| 图片插入（PPT + Word） | Adapter 层（PptAdapter / WordAdapter） | — | Office.js 宿主 API 调用必须在 adapter 内，维持 0-import 约束 |
| undo（deleteShapeById / noop_inverse） | Adapter 层 + operationLog replay engine | — | 已有基础设施，新 inverse 须在 DocumentAdapterForReplay interface 声明 |
| model 选择持久化 | 浏览器 localStorage（via `storage` lib） | ProviderRegistry | Settings picker 写值，registry resolve 时读值覆盖默认 model |
| base64 内存管理 | 内存态（React state，临时） | — | 永不进 message.content / serializeForStorage（NFR-09） |
| per-host 工具注册 | `buildToolsForHost`（tools/index.ts） | — | Excel case 不加生图工具，满足 IMG-05 |
| 取消生成（AbortController） | agentStore.abort('user') + 独立 imageAbortController | — | 生图不经 agent loop，需独立的 AbortController；取消态通过 agentStore 协调 UI 更新 |

---

## Standard Stack

### Core（全部已在 codebase，零新增依赖）

| 库/模块 | 版本/位置 | 用途 | 备注 |
|---------|----------|------|------|
| `AihubmixImageClient` | `src/providers/aihubmix-image.ts` | 生图 API（三路 wire format） | Phase 14 已建好，直接调用 |
| `IMAGE_GEN_MODELS` | `src/providers/registry.ts` L49–72 | model 注册表（id/label/endpointKind/authKind/isDefault） | Phase 14 已建好，Settings picker 直接渲染 |
| `ProviderRegistry.resolve('image-gen')` | `src/providers/registry.ts` L125–135 | 解析 image-gen 的 apiKey + baseURL + model | 需扩展支持读取用户选定 model 覆盖默认 |
| `appendOperation` | `src/agent/operationLog.ts` L180–183 | 手动向 operationLog 追加一条 entry | 非 dispatchTool 路径的插入动作用此函数 |
| `deleteShapeById` | `src/adapters/PptAdapter.ts` L1653 | PPT 图片 shape 的 inverse（reverse.tool = 'delete_shape_by_id'） | 已有实现，PPT 插图 reverse 直接复用 |
| `noop_inverse` | operationLog.ts L534 | Word 图片插入的诚实 undo 标注 | 已有 case，抛错 → `skipped_error` |
| `buildToolsForHost` | `src/agent/tools/index.ts` L244 | per-host 工具表构建 | 生图工具加入 word + ppt case，Excel 不加 |
| `PPT_TOOLS` Set | `src/agent/tools/index.ts` L28–42 | 中央 normalizeToSnakeCase 门控集合 | 新 PPT 生图工具名须加入此 Set |
| `storage` lib | `src/lib/storage.ts`（推断） | localStorage 读写 | model 偏好持久化 |
| `useAgentStore.abort('user')` | `src/agent/agentStore.ts` L134 | 4 路 abort 入口 | 生图取消可借用此入口或独立 ImageAbortController |

### 主要 Office.js API（PPT）

| API | Requirement Set | Web 支持 | 备注 |
|-----|----------------|---------|------|
| `slide.shapes.addGeometricShape(type, opts)` | PowerPointApi 1.4 | **GA，Office for Web 已支持** | 用 'Rectangle' 作图片容器 |
| `shape.fill.setImage(base64)` | PowerPointApi 1.4 | **GA，Office for Web 已支持** | 以 base64 字符串填充 shape fill |
| `shape.id`（load 后读取） | PowerPointApi 1.3 | GA | 供 `deleteShapeById` reverse 使用 |
| `slide.shapes.addPicture(base64, opts)` | **PowerPointApi BETA（PREVIEW ONLY）** | **不应在生产用** | 官方文档明确标注 "Do not use this API in a production environment" |
| `Office.context.document.setSelectedDataAsync + CoercionType.Image` | Common API | **Web 已知 bug** | Office.context.document 在 Web PPT 可能为 undefined；Q&A 确认失败 |

### 主要 Office.js API（Word）

| API | Requirement Set | Web 支持 | 备注 |
|-----|----------------|---------|------|
| `body.insertInlinePictureFromBase64(base64, 'End')` | WordApi 1.1 | **GA** | 返回 `Word.InlinePicture`；insertLocation = 'Start' 或 'End' |
| `range.insertInlinePictureFromBase64` | WordApi | Web 已知 bug | issue #3434 确认 Web range 路线报 "action isn't supported" |

---

## Architecture Patterns

### System Architecture Diagram

```
用户输入「帮我生成一张落日的图」
         │
         ▼
┌─────────────────────────────────────┐
│  Agent Loop（loop.ts）               │
│  generate_ppt_image tool 被 LLM 调   │
│  → execute(): 调 AihubmixImageClient │
│    .generate(enhancedPrompt, config) │
│  → 返回 ToolResult { ok:true,        │
│      data: { base64, mimeType,       │
│              previewPending: true } } │
│  loop 结束，推 assistant 消息         │
└───────────────┬─────────────────────┘
                │  ToolResult.data 含 base64（仅内存态）
                ▼
┌─────────────────────────────────────┐
│  ChatBubble + ImagePreviewCard       │
│  （React 组件，Task Pane 内渲染）     │
│  - <img src="data:mimeType;base64,…">│
│  - 「确认插入」「重新生成」「取消」   │
│                                     │
│  [取消] ──► base64 丢弃，结束        │
│  [重新生成] ──► 重新调工具，替换预览  │
│  [确认插入] ──► 调 insertImage helper │
└───────────────┬─────────────────────┘
                │  base64（内存态传入 helper）
                ▼
┌─────────────────────────────────────┐
│  insertImage(host, base64, mime, opts)│
│  （src/lib/insertImage.ts，新增）     │
│  → 调 PptAdapter.addImageShape()     │
│     或 WordAdapter.insertBodyImage() │
│  → 写后回读验证（PPT 必须）           │
│  → appendOperation({ reverse, ... }) │
│     PPT: reverse.tool='delete_shape_by_id'│
│     Word: reverse.tool='noop_inverse'│
└───────────────┬─────────────────────┘
                │  shape.id（PPT）/ void（Word）
                ▼
┌─────────────────────────────────────┐
│  DiffLogPanel（已有）                │
│  显示「插入图片 · 第 X 页」           │
│  PPT: 可撤销 → deleteShapeById       │
│  Word: noop+gate → 标不可自动撤销    │
└─────────────────────────────────────┘
```

### Recommended Project Structure（净新增文件）

```
src/
├── agent/tools/write/
│   ├── ppt-image.ts       # generate_ppt_image ToolDef（IMG-01）
│   └── word-image.ts      # generate_word_image ToolDef（IMG-02）
├── adapters/
│   ├── PptAdapter.ts      # 新增 addImageShape() 方法（addGeometricShape+fill.setImage）
│   └── WordAdapter.ts     # 新增 insertBodyImage() 方法（body.insertInlinePictureFromBase64）
├── lib/
│   └── insertImage.ts     # insert helper（供 IMG-01/02 + Phase 18 LIB 复用）
└── components/
    └── ImagePreviewCard.tsx  # 预览卡组件（含 loading/取消/重新生成/确认按钮）
```

### Pattern 1: 生图工具定义（img tool）

```typescript
// Source: 仿 src/agent/tools/write/ppt.ts L364 addShapeTool 结构
export const generatePptImageTool: ToolDef = {
  name: 'generate_ppt_image',   // snake_case，需加入 PPT_TOOLS Set
  kind: 'write',
  description: '根据描述生成一张图片并准备插入当前 PPT 幻灯片（生成后需确认插入）。描述请写具体中文，含主体/风格/构图。',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: '已扩写的中文图片描述（主体/风格/构图）' },
      model_id: { type: 'string', description: '生图 model ID（可选，默认 doubao-seedream-5.0-lite）' },
    },
    required: ['prompt'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    return `生成图片：${String(a.prompt).slice(0, 20)}…`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const prompt = a.prompt as string;
    const modelId = (a.model_id as string | undefined) ?? getPreferredImageGenModel();
    // 从 registry 解析 image-gen 配置（读 aihubmix apiKey）
    const cfg = ProviderRegistry.resolveImageGen(modelId) as ImageConfig; // 扩展版本
    const result = await new AihubmixImageClient().generate(
      prompt, cfg, {}, ctx.signal  // ctx.signal 传给 fetch 实现取消
    );
    // 不插入文档：只返回 base64（内存态，不进 message.content / serialize）
    return {
      ok: true,
      data: {
        base64: result.base64,
        mimeType: result.mimeType,
        prompt,
        preview_pending: true,   // UI 层据此渲染 ImagePreviewCard
      },
    };
    // 注意：reverse = undefined（这步本身不写文档，不需要 reverse）
  },
};
```

### Pattern 2: PPT adapter 插图方法（GA 路线）

```typescript
// Source: 官方文档 PowerPointApi 1.4 addGeometricShape + shape.fill.setImage
// 在 PptAdapter 类中新增（仿 addShape 结构）
async addImageShape(
  slideIndex: number,
  base64: string,
  opts: { left: number; top: number; width: number; height: number },
): Promise<{ newShapeId: string }> {
  try {
    return await PowerPoint.run(async (ctx) => {
      const slides = ctx.presentation.slides;
      slides.load('items');
      await ctx.sync();

      const slide = slides.items[slideIndex - 1];

      // GA 路线：addGeometricShape(Rectangle) + fill.setImage
      const shape = (slide.shapes as unknown as {
        addGeometricShape: (type: string, opts: object) => {
          load: (f: string[]) => void;
          id: string;
          fill: { setImage: (base64: string) => void };
        };
      }).addGeometricShape('Rectangle', opts);

      shape.load(['id']);
      await ctx.sync();  // sync 1: 获取 id

      // 用 base64 填充 shape fill（GA API，PowerPointApi 1.4）
      shape.fill.setImage(base64);
      await ctx.sync();  // sync 2: 写入图片

      const newShapeId = shape.id;

      // 写后回读验证（memory: project_ppt_officejs_gotchas）
      shape.load(['fill/type']);
      await ctx.sync();  // sync 3: 回读验证
      // fill.type 读到后如为 NoFill 则判定 no-op
      // （spike 真机运行时确定具体回读方案）

      return { newShapeId };
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('PPT addImageShape 失败', err);
  }
}
```

### Pattern 3: insertImage helper

```typescript
// Source: 新增 src/lib/insertImage.ts
// 供 PPT/Word 工具 + Phase 18 LIB 复用
export async function insertImage(
  host: 'ppt' | 'word',
  adapter: DocumentAdapter,
  base64: string,
  mimeType: string,
  opts: {
    slideIndex?: number;      // PPT 用（1-based）
    runId: string;
    stepIndex: number;
    humanLabel: string;
  },
): Promise<{ ok: boolean; shapeId?: string; error?: ToolError }> {
  if (host === 'ppt') {
    const pptAdapter = adapter as PptAdapter;
    // 计算居中默认位置（D-06：不超出 slide，按比例合理尺寸）
    const position = calcCenteredPosition(/* slide 尺寸默认 10 inch × 7.5 inch → 720pt × 540pt */);
    let shapeId: string;
    try {
      const result = await pptAdapter.addImageShape(opts.slideIndex!, base64, position);
      shapeId = result.newShapeId;
    } catch (err) {
      return { ok: false, error: mapToToolError(err) };
    }
    // 成功：手动追加 operationLog
    appendOperation({
      runId: opts.runId,
      stepIndex: opts.stepIndex,
      toolName: 'generate_ppt_image',
      args: {},
      humanLabel: opts.humanLabel,
      reverse: { tool: 'delete_shape_by_id', args: { slide_index: opts.slideIndex, shape_id: shapeId } },
      postState: { kind: 'ppt_shape_new', content: { slide_index: opts.slideIndex, shape_id: shapeId } },
      timestamp: Date.now(),
    });
    return { ok: true, shapeId };
  } else {
    // Word body 级
    const wordAdapter = adapter as WordAdapter;
    try {
      await wordAdapter.insertBodyImage(base64);
    } catch (err) {
      return { ok: false, error: mapToToolError(err) };
    }
    appendOperation({
      runId: opts.runId,
      stepIndex: opts.stepIndex,
      toolName: 'generate_word_image',
      args: {},
      humanLabel: opts.humanLabel,
      reverse: { tool: 'noop_inverse', args: { reason: 'Word 图片插入暂不支持自动撤销' } },
      timestamp: Date.now(),
    });
    return { ok: true };
  }
}
```

### Pattern 4: operationLog 手动追加（D-02 解耦路径）

```typescript
// Source: src/agent/operationLog.ts L180–183
// 调用方（ImagePreviewCard 确认插入后）手动追加
import { appendOperation } from '../agent/operationLog';

appendOperation({
  runId: currentRunId,          // 从 agentStore 或 props 取
  stepIndex: nextStepIndex,     // 当前 run 已有的 stepIndex + 1
  toolName: 'generate_ppt_image',
  args: {},                     // 不存 base64（NFR-09）
  humanLabel: `插入生成图片到第 ${slideIndex} 页`,
  reverse: {
    tool: 'delete_shape_by_id',
    args: { slide_index: slideIndex, shape_id: newShapeId },  // Record 对象（非位置参）
  },
  postState: { kind: 'ppt_shape_new', content: { slide_index: slideIndex, shape_id: newShapeId } },
  timestamp: Date.now(),
});
```

### Anti-Patterns to Avoid

- **存 base64 进 message.content：** base64 永远不进 `pushMessage`/`serializeForStorage`。预览卡收到的 base64 只活在 React state；确认插入后 base64 进 adapter 方法后即可丢弃。
- **用 `shapes.addPicture` BETA API：** 文档明确标注 "PREVIEW ONLY, do not use in production"，Web 可用性未保证。
- **用 `setSelectedDataAsync + CoercionType.Image`：** Web PPT 已确认 `Office.context.document` 为 undefined，直接 TypeError。
- **Word 用 range/paragraph 级插图：** issue #3434 确认 Web range 路线报 "action isn't supported by Word in a browser"。强制使用 `body.insertInlinePictureFromBase64`。
- **插入不经 operationLog：** D-02 解耦路径绕过了 `dispatchTool`，必须手动 `appendOperation`，否则 DiffLog 和 Undo All 会漏掉这步。
- **位置参（非 Record 对象）的 reverse.args：** memory `project_adapter_inverse_signature` 硬约束——所有 inverse 方法的 args 收 `Record<string, unknown>`，新 `addImageShape` reverse 同样遵守。
- **PPT 工具不加入 `PPT_TOOLS` Set：** 会导致 LLM camelCase 参数没被 normalize 就进 execute，触发 casing 静默失败（Phase 14 D-10 根治的原问题复发）。
- **省略写后回读验证（PPT）：** memory `project_ppt_officejs_gotchas` 明确 Web 写操作可能静默 no-op；PPT 插图后必须回读确认 shape 存在。

---

## Don't Hand-Roll

| 问题 | 不要自己造 | 用现有 | 原因 |
|------|-----------|------|------|
| base64 → 浏览器格式转换 | 不要写编解码 | `AihubmixImageClient` 内部已处理（doubao URL 转 base64，gemini/gpt-image-2 直接返 base64） | Phase 14 D-02 已实测稳定 |
| PPT undo（删除 shape） | 不要写新 inverse 实现 | `deleteShapeById` 已有实现（PptAdapter.ts L1653）+ integration test 守门 | 直接作为 reverse.tool 使用 |
| Word undo 不可能性 | 不要假装可以 undo | `noop_inverse` + skipped_error 诚实标注 | noop 路线已在 PPT deleteShape 工具中验证（integration test L866–878） |
| operationLog 结构 | 不要绕过 | `appendOperation` + `OperationLogEntry` 类型 | 必须进 operationLog 才能被 DiffLog 显示和 Undo All 追踪 |
| prompt 扩写的翻译 | 不要翻译成英文 | 保留中文，agent 自行扩写 | D-03：doubao/gemini 中文 prompt 支持足够，翻译可能失真用户意图 |
| 生图 SSE 流式解析 | 不要尝试流式（生图不支持） | 整块 Promise 返回 | 三路 provider 都是一次性整块 JSON 返回（不是 SSE token stream） |

---

## Runtime State Inventory

> Phase 16 是净新增功能（非 rename/refactor），不涉及运行时状态重命名。

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| 存储数据 | 无（IMAGE_GEN_MODELS 是常量，不存数据库） | — |
| 活动服务配置 | 无 | — |
| OS 注册状态 | 无 | — |
| 密钥/环境变量 | 生图 model 持久选择需新增 localStorage key（`aster:pref:image-gen-model`） | 新增：仅代码改动，非迁移 |
| 构建产物 | 无 | — |

---

## Common Pitfalls

### Pitfall 1: PPT addPicture BETA 在 Web 不可用
**什么出错：** 调用 `shapes.addPicture` 后 Office for Web 抛 `GeneralException` 或无响应（BETA Preview 无 Web GA 保证）。
**为何发生：** `addPicture` 属 PowerPointApi BETA requirement set，文档明确标注不应生产使用。
**如何避免：** 主路线用 `addGeometricShape('Rectangle', opts) + fill.setImage(base64)`（GA PowerPointApi 1.4，Office for Web 已支持）。
**预警信号：** 真机 spike 如果此路线也失败，fallback = 在 DiffLog 里诚实提示「PPT 插图在当前版本不支持，建议手动插入」（类似 Phase 15 getImageAsBase64 fallback 范式）。

### Pitfall 2: PPT context.sync() 无限挂起（issue #5022）
**什么出错：** `addGeometricShape` + `fill.setImage` + 再次 `sync` 可能在 Web 随机卡死。
**为何发生：** Office.js #5022 bug：插图后后续 sync 可能无限等待。
**如何避免：** 写后回读验证使用**独立 PowerPoint.run() 调用**（不在同一 `run` 内再次 sync 验证），隔离 sync 闭包。spike 时验证此规避手段是否有效。
**预警信号：** 真机测试时 sync 超过 TOOL_TIMEOUT_MS（当前 15s）触发 HostApiError。

### Pitfall 3: Word Range 级插图在 Web 报错
**什么出错：** 用 `selection.insertInlinePictureFromBase64` 或 `paragraph.insertInlinePictureFromBase64` 时 Office for Web 报 "The action isn't supported by Word in a browser"。
**为何发生：** issue #3434 确认 Range/Paragraph 级路线 Web 不支持。
**如何避免：** 强制 `ctx.document.body.insertInlinePictureFromBase64(base64, 'End')`（body 级）。已在 D-07 锁定。

### Pitfall 4: base64 泄漏进 message 历史
**什么出错：** gpt-image-2 生成的 base64 字符串（~100KB+）进入 localStorage → quota 炸 + LLM 重放死循环。
**为何发生：** `ToolResult.data` 里含 base64 字段，若 loop.ts 把 data 推进 message.content 就会泄漏。
**如何避免：** 生图工具的 `ToolResult.data` 里 base64 字段不由 loop.ts 渲染进 message（ChatBubble 渲染 tool result 时跳过 base64 字段）；serialize 守门测试扩展一条新断言（image preview pending 路径 base64 不出现）。

### Pitfall 5: operationLog 手动追加 stepIndex 冲突
**什么出错：** 预览卡按钮触发的 appendOperation 用了已存在的 stepIndex → DiffLog 显示两条相同编号条目。
**为何发生：** 预览卡在 agent loop 结束后触发，此时 agentStore 的 currentStep 已定格，但 operationLog 里没有「下一步」的 stepIndex。
**如何避免：** `stepIndex` 用 `(getOperationsByRun(runId).length)` 即当前 run 已有条目数（0-based 追加），确保唯一。

### Pitfall 6: 取消生成后 base64 内存未释放
**什么出错：** 用户点取消后，React state 里的 base64 字符串仍存活，被 serializeForStorage 意外序列化（若 message 结构不慎持有引用）。
**为何发生：** React state 通常随组件卸载释放；但若 base64 被提升进 chatStore message，GC 不会立即回收。
**如何避免：** base64 只在 ImagePreviewCard 组件本地 state 存储（或 Zustand imagePreviewStore 单独管理）；取消/确认后立即 clear；不进 chatStore messages。

---

## Code Examples

### Word 插图（body 级）

```typescript
// Source: https://learn.microsoft.com/en-us/javascript/api/word/word.body?view=word-js-preview
// 已由搜索核实：Word.Body.insertInlinePictureFromBase64 签名，insertLocation='End' 追加到末尾
await Word.run(async (ctx) => {
  const picture = ctx.document.body.insertInlinePictureFromBase64(
    base64,          // 裸 base64，不带 data: 前缀
    'End',           // Word.InsertLocation.end = 'End'
  );
  picture.load(['width', 'height']);  // 可选：回读验证图片尺寸
  await ctx.sync();
  // picture.width / picture.height 读到则视为插入成功
});
// CITED: learn.microsoft.com/en-us/javascript/api/word/word.body
```

### PPT 插图（GA 路线 addGeometricShape + fill.setImage）

```typescript
// Source: 官方 addGeometricShape 示例 + 推断 fill.setImage（PowerPointApi 1.4 GA）
// VERIFIED: addGeometricShape 属 PowerPointApi 1.4（Office for Web Supported）
// fill.setImage 在 shape.fill 上（Shape.fill: ShapeFill → setImage(base64)）
// SPIKE 真机验证项：此路线能否完整回读 shape.id + fill.type
await PowerPoint.run(async (ctx) => {
  const slide = ctx.presentation.getSelectedSlides().getItemAt(0);
  const shape = slide.shapes.addGeometricShape(
    'Rectangle',   // PowerPoint.GeometricShapeType.rectangle
    { left: 60, top: 60, width: 480, height: 360 },  // 居中默认（10inch slide）
  );
  shape.load('id');
  await ctx.sync();           // sync 1: 拿 shape.id
  const shapeId = shape.id;

  shape.fill.setImage(base64);  // 以 base64 填充图片
  await ctx.sync();             // sync 2: 写入
  // PPT bug #5022: 此后同一 run 内再 sync 可能卡死
  // → 写后回读用独立 PowerPoint.run() 调用
  return { newShapeId: shapeId };
});

// 写后回读（独立 run，避免 #5022 卡死）
const verified = await PowerPoint.run(async (ctx) => {
  const slide = ctx.presentation.getSelectedSlides().getItemAt(0);
  slide.shapes.load('items/id,items/fill/type');
  await ctx.sync();
  const found = slide.shapes.items.find(s => s.id === shapeId);
  return !!found;  // 找到则确认插入成功
});
// CITED: learn.microsoft.com/en-us/javascript/api/powerpoint/powerpoint.shapecollection
```

### 生图工具 ToolResult 结构（不含 reverse，因为不写文档）

```typescript
// 生图工具不写文档，不需要 reverse；插入时由 insertImage helper 追加 operationLog
return {
  ok: true,
  data: {
    // base64 + mimeType 仅供 React 预览卡渲染，不进 message.content
    base64: result.base64,       // NFR-09: UI 层消费后不持久化
    mimeType: result.mimeType,
    prompt,
    preview_pending: true,       // UI 渲染 ImagePreviewCard 的信号
  },
  // reverse: undefined（生图工具本身不写文档，无 reverse）
};
// ASSUMED: preview_pending 字段名是本 phase 新增约定，与 loop.ts 无关（loop 结束后由 ChatBubble 渲染）
```

---

## State of the Art

| 旧做法 | 当前做法 | 变更时间 | 影响 |
|--------|---------|---------|------|
| PPT 插图用 `setSelectedDataAsync + CoercionType.Image` | GA 路线：`addGeometricShape + fill.setImage` | Office.js 持续更新 | Web PPT 可靠插图 |
| PPT 插图用 `shapes.addImage`/`addPicture` BETA | 同上 GA 路线 | addPicture 至今仍 BETA | 避免生产 BETA 风险 |
| Word range 级 insertInlinePicture | `body.insertInlinePictureFromBase64('End')` | issue #3434 确认 Web bug | Web 插图不报错 |

**废弃/过时：**
- `shapes.addImage`：已从微软文档中替换为 `addPicture`（但 `addPicture` 同样是 BETA），不可在生产使用。
- `setSelectedDataAsync` + image coercion：Common API，Web PPT 已知无法使用。

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `addGeometricShape('Rectangle') + fill.setImage(base64)` 在 Office for Web 可用且能回读 shape.id | Standard Stack / Code Examples | PPT 插图 MVP 失败，需 fallback（诚实告知无法插图）；Phase 16 success criterion 1 无法达成 |
| A2 | `ProviderRegistry.resolve('image-gen')` 可以通过传入自定义 model 参数覆盖默认 doubao | Standard Stack | D-04 model 切换无法实现，需改 registry API |
| A3 | `PPT_TOOLS` Set 加入 `generate_ppt_image` 后，`normalizeToSnakeCase` 幂等处理不会破坏 base64 或 mimeType 字段 | Pattern 1 | camelCase 字段被错误 normalize；spike 时顺手验证 |
| A4 | 生图 PPT 工具的 `ToolResult.data.base64` 不会被 loop.ts 的 message 推送机制放入 assistant message.content | Pitfall 4 | base64 进 localStorage，NFR-09 违反；需在 loop.ts 或 ChatBubble 加显式过滤 |
| A5 | `shape.fill.setImage(base64)` 接受裸 base64（不带 data: 前缀） | Code Examples | 若 API 需要 data URL 格式，需在 adapter 内部加 `data:${mimeType};base64,` 拼接 |
| A6 | 当前 `ProviderRegistry.resolve('image-gen')` 内部默认 model 改动最小侵入方案为新增 localStorage key | D-04 / Standard Stack | 若需要改 registry 接口签名，影响 Phase 14 现有代码 |

---

## Open Questions

1. **PPT `fill.setImage` 接受裸 base64 还是 data URL？**
   - 已知：`AihubmixImageClient` 返回裸 base64（不带 `data:` 前缀）
   - 未知：`fill.setImage(base64)` 的第一个参数格式要求（微软文档仅说"base64-encoded image"，未明确是否需 data URL 前缀）
   - 建议：spike 时同时测试裸 base64 和 `data:image/png;base64,...` 两种格式

2. **PPT bug #5022 的规避有效性**
   - 已知：独立 PowerPoint.run() 能隔离 sync 闭包
   - 未知：真机 Web 环境下独立 run 是否确实避免了 sync 卡死
   - 建议：spike 时在 Web 测试 addGeometricShape → sync → fill.setImage → sync → 独立 run 回读，记录 sync 是否超时

3. **image-gen model 持久选择的存储键名**
   - 已知：`storage` lib 已有 `STORAGE_KEYS` 常量
   - 未知：是否有既有约定的存储键 pattern（待查 STORAGE_KEYS 定义）
   - 建议：用 `aster:pref:image-gen-model` 或类似约定，在 Wave 0 确定

4. **AbortController 与生图独立取消**
   - 已知：`AihubmixImageClient.generate` 有 `_options` 参数但未见 signal 参数（Phase 14 实现）
   - 未知：是否需要扩展 `generate(prompt, config, options, signal?)` 签名以支持取消
   - 建议：查 `aihubmix-image.ts` fetch 调用是否传 signal；若无则扩展 options 加 signal 字段

---

## Environment Availability

> Phase 16 核心是纯 Office.js 调用 + 内存态 base64 处理，无新增外部工具依赖。

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `AihubmixImageClient` | IMG-01/02/03/04 | ✓（src/providers/aihubmix-image.ts） | Phase 14 实现 | — |
| Office for Web（Edge/Chrome 最新两版） | IMG-01/02 真机 spike | ✓（MVP 兼容矩阵） | — | — |
| aihubmix API key（开发者测试用） | IMG-01/02/03/04 spike | ✓（.env.local 提供，memory: self-run-spikes） | — | — |
| Node.js + npm | 单测运行 | ✓ | v22.21.1 | — |

**无阻塞缺失依赖。**

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest（已有 vitest.config.ts） |
| Config file | `vitest.config.ts`（项目根） |
| Quick run command | `npm test -- --run src/agent/operationLog.integration.test.ts` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMG-01 | PPT 插图工具返回 preview_pending=true（不写文档） | unit | `npm test -- --run src/agent/tools/write/ppt-image.test.ts` | ❌ Wave 0 新建 |
| IMG-01 | PPT insertImage helper 调 addImageShape + appendOperation（deleteShapeById reverse） | integration | `npm test -- --run src/agent/operationLog.integration.test.ts -t "generate_ppt_image"` | ❌ Wave 0 追加用例 |
| IMG-01 | PPT 插图 inverse deleteShapeById → rolled_back（replay 路线） | integration | `npm test -- --run src/agent/operationLog.integration.test.ts` | ✅（已有 D-17 用例，新用例复用 mock） |
| IMG-02 | Word insertBodyImage + noop_inverse appendOperation | integration | `npm test -- --run src/agent/operationLog.integration.test.ts -t "generate_word_image"` | ❌ Wave 0 追加用例 |
| IMG-02 | Word noop_inverse → skipped_error（replay 诚实标注） | integration | `npm test -- --run src/agent/operationLog.integration.test.ts -t "noop_inverse"` | ✅（已有 D-17 L866 用例） |
| IMG-03 | 生图 ToolResult.data.base64 不被 serializeForStorage 持久化（NFR-09 扩展） | unit | `npm test -- --run src/store/chat.test.ts -t "NFR-09"` | ✅（有路径 A/B；需追加路径 C：image preview pending） |
| IMG-04 | IMAGE_GEN_MODELS 注册表有 3 个 model + 默认 doubao | unit | `npm test -- --run src/providers/registry.test.ts` | ✅ 或 ❌（需确认现有 registry 测试是否覆盖） |
| IMG-05 | Excel buildToolsForHost 不含 generate_ppt/word_image | unit | `npm test -- --run src/agent/tools/tools-host.test.ts` | ❌ Wave 0 新建或追加 |
| PPT spike | addGeometricShape+fill.setImage 真机 Web 成功 + shape.id 可回读 | 真机 UAT（手动） | — | — |

### Sampling Rate
- **每 task commit：** `npm test -- --run`（全量 unit + integration，~773 tests）
- **每 wave merge：** 同上（本项目无 wave 分支，每 plan commit 都跑全量）
- **Phase gate：** 全量通过 + 真机 UAT spike PASS → `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/agent/tools/write/ppt-image.test.ts` — 覆盖 IMG-01 工具单测（不写文档、返回 preview_pending）
- [ ] `src/agent/tools/write/word-image.test.ts` — 覆盖 IMG-02 工具单测
- [ ] `src/agent/operationLog.integration.test.ts` — 追加 generate_ppt_image / generate_word_image 两条 integration 守门用例（memory: project_adapter_inverse_signature）
- [ ] `src/store/chat.test.ts` — 追加 NFR-09 路径 C：image preview pending 路径 base64 不出现
- [ ] `src/agent/tools/index.test.ts` 或独立文件 — 验证 Excel host 工具表不含生图工具（IMG-05）

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | agent 扩写的 prompt 不做 HTML 注入（纯文本传 API）；provider 错误 message 来自字面量不读 err.message |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| base64 payload 进 localStorage（NFR-09 违反） | Information Disclosure | serializeForStorage 白名单只序列化 user/assistant text；tool role 自动过滤 |
| apiKey 泄漏进请求 body | Information Disclosure | T-14-01 继承：apiKey 仅进 Authorization/x-goog-api-key header，不进 body |
| LLM prompt injection via 图片描述 | Tampering | agent 扩写 prompt 是 LLM 自己生成（不是 document_content evidence），风险低；但注意 sanitizePrefs 范式 |
| 恶意 base64 payload 注入（用户伪造） | Spoofing | 生图 base64 来自 AihubmixImageClient（provider 已验证），不接受用户直传 base64 |

---

## Sources

### Primary (HIGH confidence)
- `src/providers/aihubmix-image.ts` — AihubmixImageClient 完整实现，三路 wire format（代码直接读取）
- `src/providers/registry.ts` L38–147 — IMAGE_GEN_MODELS + ProviderRegistry（代码直接读取）
- `src/agent/tools/index.ts` L28–53 — PPT_TOOLS Set + normalizeToSnakeCase + buildToolsForHost（代码直接读取）
- `src/agent/operationLog.ts` L53–184, L534–540 — OperationLogEntry 结构 + appendOperation + noop_inverse（代码直接读取）
- `src/adapters/PptAdapter.ts` L1543–1696 — addShape + deleteShapeById 完整实现（代码直接读取）
- `src/agent/operationLog.integration.test.ts` L849–879 — delete_shape_by_id + noop_inverse integration test 范式（代码直接读取）
- [Microsoft Learn: PowerPoint.ShapeCollection class — addPicture BETA 标注](https://learn.microsoft.com/en-us/javascript/api/powerpoint/powerpoint.shapecollection?view=powerpoint-js-preview) — addPicture 明确标注 "PREVIEW ONLY, do not use in production"
- [Microsoft Learn: PowerPoint JavaScript API requirement sets](https://learn.microsoft.com/en-us/javascript/api/requirement-sets/powerpoint/powerpoint-api-requirement-sets) — addGeometricShape 属 PowerPointApi 1.4，Office for Web Supported
- [Microsoft Learn: Word.Body class — insertInlinePictureFromBase64](https://learn.microsoft.com/en-us/javascript/api/word/word.body?view=word-js-preview) — body 级签名 + insertLocation = 'Start' | 'End'

### Secondary (MEDIUM confidence)
- [Microsoft Q&A: Unable to add base64 image in PPT on Web](https://learn.microsoft.com/en-us/answers/questions/1659359/unable-to-add-a-base64encoded-image-in-the-slide-o) — 确认 setSelectedDataAsync 在 Web PPT 报 TypeError
- [OfficeDev/office-js issue #3434](https://github.com/OfficeDev/office-js/issues/3434) — Word range 级 insertInlinePictureFromBase64 在 Web 报错（已引用 CONTEXT.md D-07）
- [OfficeDev/office-js issue #5022](https://github.com/OfficeDev/office-js/issues/5022) — PPT context.sync() 插图后可能无限挂起 bug

### Tertiary (LOW confidence)
- `shape.fill.setImage(base64)` 接受裸 base64 的格式假设（官方文档示例未展示完整格式，spike 时验证）

---

## Metadata

**Confidence breakdown:**
- Standard Stack（PPT/Word API 路线）: HIGH（官方文档核实 + Web 可用性矩阵核查）
- Architecture（D-02 解耦 + operationLog 手动追加）: HIGH（代码直读现有模式，直接类比 addShape）
- Pitfalls: HIGH（base64 泄漏来自 NFR-09 已有守门；PPT bug #5022 来自 GitHub issue；Word range bug #3434 来自 CONTEXT.md D-07）
- PPT GA 路线真机可用性: MEDIUM（addGeometricShape GA 已验证，fill.setImage GA 已文档确认，但真机组合未实测）

**Research date:** 2026-06-02
**Valid until:** 2026-07-02（Office.js BETA 状态每季度可能变化；addPicture GA 时间待微软公告）
