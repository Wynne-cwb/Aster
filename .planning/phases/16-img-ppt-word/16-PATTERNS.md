# Phase 16: IMG 图片生成插入（PPT + Word） - Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 9 个净新增/修改文件
**Analogs found:** 9 / 9

---

## File Classification

| 新增/修改文件 | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/agent/tools/write/ppt-image.ts` | tool (write) | request-response | `src/agent/tools/write/ppt.ts` `addShapeTool` (L364-420) | exact |
| `src/agent/tools/write/word-image.ts` | tool (write) | request-response | `src/agent/tools/write/word.ts` `appendParagraph` (L46-75) | exact |
| `src/adapters/PptAdapter.ts`（新增 `addImageShape`） | adapter method | request-response | `src/adapters/PptAdapter.ts` `addShape` (L1560-1643) + `deleteShapeById` (L1653-1696) | exact |
| `src/adapters/WordAdapter.ts`（新增 `insertBodyImage`） | adapter method | request-response | `src/adapters/WordAdapter.ts` 现有 write 方法 | role-match |
| `src/lib/insertImage.ts` | utility / helper | request-response | `src/agent/operationLog.ts` `appendOperation` (L180-184) + `src/adapters/PptAdapter.ts` `addShape` | role-match |
| `src/components/ImagePreviewCard.tsx` | component (UI card) | event-driven | `src/components/AgentControlBar.tsx` + `src/styles.css` `.aster-tool-card` (L473-536) | role-match |
| `src/components/Settings/SettingsPanel.tsx`（扩展生图 model picker） | component (settings form) | CRUD | `src/components/Settings/SettingsPanel.tsx` L155-200（全局选项分区） | exact |
| `src/agent/tools/index.ts`（PPT_TOOLS + buildToolsForHost） | config / registry | CRUD | `src/agent/tools/index.ts` L28-42 `PPT_TOOLS` Set + L244-297 `buildToolsForHost` | exact |
| `src/store/chat.test.ts`（扩展 NFR-09 路径 C） | test | CRUD | `src/store/chat.test.ts` L297-330 NFR-09 路径 A | exact |

---

## Pattern Assignments

---

### `src/agent/tools/write/ppt-image.ts` (tool, request-response)

**Analog:** `src/agent/tools/write/ppt.ts` — `addShapeTool` (L364-420)

**Imports pattern** (`ppt.ts` L23-25):
```typescript
import type { ToolDef, ToolResult } from '../index';
import type { ReverseDescriptor, PostStateSnapshot } from '../../operationLog';
import type { PptAdapter } from '../../../adapters/PptAdapter';
```

**ToolDef 结构 + snake_case 参数 + humanLabel 函数** (`ppt.ts` L364-419):
```typescript
export const addShapeTool: ToolDef = {
  name: 'add_shape',                     // snake_case，须加入 PPT_TOOLS Set
  kind: 'write',
  description: '...',
  parameters: {
    type: 'object',
    properties: {
      slide_index: { type: 'number', description: '幻灯片编号（1开始）' },
      // ... 其余字段同样 snake_case
    },
    required: ['slide_index', 'shape_type', 'position'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    const slide_index = a.slide_index as number;
    return `在第 ${slide_index} 张幻灯片插入形状「${...}」`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const slide_index = a.slide_index as number;
    // ... 调 adapter 方法
    const { newShapeId } = await (ctx.adapter as PptAdapter).addShape(...);
    const reverse: ReverseDescriptor = {
      tool: 'delete_shape_by_id',
      args: { slide_index, shape_id: newShapeId },  // Record 对象，非位置参
    };
    const postState: PostStateSnapshot = {
      kind: 'ppt_shape_new',
      content: { slide_index, shape_id: newShapeId },
    };
    return { ok: true, data: { slide_index, new_shape_id: newShapeId }, reverse, postState };
  },
};
```

**关键差异点（generate_ppt_image 与 add_shape 的不同）:**
- `execute` 只调 `AihubmixImageClient.generate()` → 返回 base64，**不调 adapter**（D-02 解耦）
- `reverse` 为 `undefined`（生图工具本身不写文档，reverse 在 `insertImage` helper 里手动 `appendOperation`）
- `ToolResult.data` 含 `{ base64, mimeType, prompt, preview_pending: true }`
- 工具名 `generate_ppt_image` 必须加入 `PPT_TOOLS` Set（tools/index.ts L28-42）

**诚实失败模式 — 生图失败时复用** (`ppt.ts` L79-90):
```typescript
function notEffectiveResult(what: string): ToolResult {
  return {
    ok: false,
    error: {
      code: 'HOST_API_FAILED',
      message: `${what}失败，请重试`,
      recoverable: true,
      hint: '宿主 API 操作未生效，建议重试',
    },
  };
}
```

---

### `src/agent/tools/write/word-image.ts` (tool, request-response)

**Analog:** `src/agent/tools/write/word.ts` — `appendParagraph` (L46-75) + `deleteShapeTool` (`ppt.ts` L483-515) 的 `noop_inverse` 用法

**Imports pattern** (`word.ts` L17-19):
```typescript
import type { ToolDef, ToolResult } from '../index';
import type { ReverseDescriptor } from '../../operationLog';
import type { WordAdapter } from '../../../adapters/WordAdapter';
```

**Word write tool 结构（基准）** (`word.ts` L46-75):
```typescript
export const appendParagraph: ToolDef<AppendParagraphArgs> = {
  name: 'append_paragraph',
  kind: 'write',
  description: '...',
  parameters: { ... },
  humanLabel: ({ text }) => `...「${text.slice(0, 30)}」`,
  async execute({ text }, ctx): Promise<ToolResult> {
    await (ctx.adapter as WordAdapter).appendParagraph(text);
    const reverse: ReverseDescriptor = {
      tool: 'delete_paragraph_by_content',
      args: { text },  // Record 对象（非位置参）
    };
    return { ok: true, data: { written: text.length }, reverse, postState };
  },
};
```

**noop_inverse 用法** (`ppt.ts` L502-507):
```typescript
// Word 图片插入不可自动撤销：form = noop+gate（诚实）
const reverse: ReverseDescriptor = {
  tool: 'noop_inverse',
  args: { reason: '形状完整状态（类型/位置/填充/文字/字体）无法序列化重建，此步不可自动撤销' },
};
```

**关键差异点（generate_word_image 与 appendParagraph 的不同）:**
- 与 `generate_ppt_image` 同理：`execute` 只调 `AihubmixImageClient.generate()`，不调 adapter
- Word reverse 用 `noop_inverse`（插图无法自动撤销，body 级插入无 ID 可追踪）
- 文件路径说明：`word.ts` 文件头注释 L14-15 记录了 `reverse.args 必须是 Record 对象（非位置参）` 的历史教训

---

### `src/adapters/PptAdapter.ts` — 新增 `addImageShape` 方法

**Analog:** `src/adapters/PptAdapter.ts` `addShape` (L1560-1643) + `deleteShapeById` (L1653-1696)

**addShape 方法体结构**（几何形状路径，L1614-1643）：
```typescript
async addShape(
  slideIndex: number,
  shapeType: string,
  position: { left: number; top: number; width: number; height: number },
  text?: string,
): Promise<{ newShapeId: string }> {
  try {
    return await PowerPoint.run(async (ctx) => {
      const slides = ctx.presentation.slides;
      slides.load('items');
      await ctx.sync();                              // sync 1: load slides

      const idx = slideIndex - 1;
      if (idx < 0 || idx >= slides.items.length) {
        throw new HostApiError(`PPT addShape: 第 ${slideIndex} 张 slide 不存在`, undefined);
      }
      const slide = slides.items[idx];

      // 几何形状路径（addGeometricShape）
      slide.shapes.load('items/$none');
      await ctx.sync();                              // sync 2: 获取已有形状列表

      const newShape = (slide.shapes as unknown as {
        addGeometricShape: (type: string, opts: {...}) => { load: (...) => void; id: string };
      }).addGeometricShape(shapeType, { left, top, width, height });

      newShape.load(['id', 'type']);
      await ctx.sync();                              // sync 3: 获取 shape id

      const newShapeId = newShape.id as string;
      return { newShapeId };
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('PPT addShape 失败', err);
  }
}
```

**deleteShapeById 签名（Record 对象，inverse 标准）** (L1653-1696):
```typescript
// 签名必须是 args: Record<string, unknown>（非位置参）
async deleteShapeById(args: Record<string, unknown>): Promise<void> {
  const slide_index = args.slide_index as number;
  const shape_id = args.shape_id as string;

  try {
    await PowerPoint.run(async (ctx) => {
      const slides = ctx.presentation.slides;
      slides.load('items');
      await ctx.sync();                     // sync 1

      const slide = slides.items[slide_index - 1];
      slide.shapes.load('items/id');
      await ctx.sync();                     // sync 2: 按 id 定位

      const shape = (slide.shapes.items as Array<{ id: string; delete: () => void }>)
        .find((sh) => sh.id === shape_id);
      if (!shape) throw new HostApiError(`PPT deleteShapeById: 形状 ${shape_id} 不存在`, undefined);

      shape.delete();
      await ctx.sync();
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('PPT deleteShapeById 失败', err);
  }
}
```

**`addImageShape` 的差异点（相对 addShape）:**
- 多一步 `shape.fill.setImage(base64)` + `await ctx.sync()`（写图步骤）
- 写后回读验证用**独立的 `PowerPoint.run()` 调用**（规避 PPT bug #5022 sync 挂死）
- 方法签名返回 `{ newShapeId: string }`，供 insertImage helper 写 `reverse.args.shape_id`
- 需要在 `DocumentAdapterForReplay` interface 声明对应 inverse 方法（`deleteShapeById` 已有，直接复用）

---

### `src/adapters/WordAdapter.ts` — 新增 `insertBodyImage` 方法

**Analog:** `src/adapters/WordAdapter.ts` 现有 write 方法（`appendParagraph` 实现模式）

**现有 write 方法范式**（WordAdapter 类内，以 `appendParagraph` 为参考，imports L1-20):
```typescript
import { UnsupportedOperationError, HostApiError, AsterError } from '../errors';

// Word write 方法：
async appendParagraph(text: string): Promise<void> {
  try {
    return await Word.run(async (ctx) => {
      const body = ctx.document.body;
      body.insertParagraph(text, 'End');
      await ctx.sync();
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('Word appendParagraph 失败', err);
  }
}
```

**`insertBodyImage` 目标实现形态**（参考 RESEARCH.md Code Examples）：
```typescript
// body 级（强制）：D-07 + RESEARCH.md — Office for Web range 级报 "action isn't supported"
async insertBodyImage(base64: string): Promise<{ width: number; height: number }> {
  try {
    return await Word.run(async (ctx) => {
      const picture = ctx.document.body.insertInlinePictureFromBase64(base64, 'End');
      picture.load(['width', 'height']);
      await ctx.sync();  // 回读验证图片尺寸（写后回读）
      return { width: picture.width, height: picture.height };
    });
  } catch (err) {
    if (err instanceof HostApiError) throw err;
    throw new HostApiError('Word insertBodyImage 失败', err);
  }
}
```

**关键约束：**
- `insertBodyImage` 方法名（非位置参）→ `insertImage` helper 调 `wordAdapter.insertBodyImage(base64)`
- 无 inverse adapter 方法（reverse = `noop_inverse`，已在 operationLog.ts L534-537 有通用处理逻辑）
- `DocumentAdapterForReplay` 不需要新增方法（noop_inverse 在 operationLog 的 `executeReverse` switch 中直接 throw）

---

### `src/lib/insertImage.ts` (utility, request-response)

**Analog:** `src/agent/operationLog.ts` `appendOperation` (L180-184) + `src/adapters/PptAdapter.ts` `addShape` 调用模式

**appendOperation 签名**（operationLog.ts L180-184）：
```typescript
export function appendOperation(entry: OperationLogEntry): void {
  const list = operationLogMap.get(entry.runId) ?? [];
  list.push(entry);
  operationLogMap.set(entry.runId, list);
}
```

**OperationLogEntry 完整结构**（operationLog.ts L53-69）：
```typescript
export interface OperationLogEntry {
  runId: string;
  stepIndex: number;
  toolName: string;
  args: unknown;
  humanLabel: string;
  reverse: ReverseDescriptor;
  postState?: PostStateSnapshot;
  timestamp: number;
  subOps?: Array<{ humanLabel: string; postState?: PostStateSnapshot; reverse: ReverseDescriptor }>;
}
```

**insertImage helper 应采用的 appendOperation 调用形态**（参照 RESEARCH.md Pattern 3 + operationLog D-17 守门测试 L849-864）：
```typescript
// PPT 成功插入后手动追加：
appendOperation({
  runId: opts.runId,
  stepIndex: getOperationsByRun(opts.runId).length,  // Pitfall 5 防 stepIndex 冲突
  toolName: 'generate_ppt_image',
  args: {},                                           // 不存 base64（NFR-09）
  humanLabel: opts.humanLabel,
  reverse: {
    tool: 'delete_shape_by_id',
    args: { slide_index: opts.slideIndex, shape_id: shapeId },  // Record 对象（非位置参）
  },
  postState: { kind: 'ppt_shape_new', content: { slide_index: opts.slideIndex, shape_id: shapeId } },
  timestamp: Date.now(),
});

// Word 成功插入后手动追加：
appendOperation({
  runId: opts.runId,
  stepIndex: getOperationsByRun(opts.runId).length,
  toolName: 'generate_word_image',
  args: {},
  humanLabel: opts.humanLabel,
  reverse: { tool: 'noop_inverse', args: { reason: 'Word 图片插入暂不支持自动撤销' } },
  timestamp: Date.now(),
});
```

**postState `kind` 选择**：`'ppt_shape_new'` 已在 `PostStateSnapshot` union type (operationLog.ts L43) 中声明；Word 插图无 postState（`noop_inverse` 路径不做手改防御）。

---

### `src/components/ImagePreviewCard.tsx` (component, event-driven)

**Analog:** `src/components/AgentControlBar.tsx`（loading + abort 范式）+ `src/styles.css` `.aster-tool-card` (L473-536)

**AgentControlBar Zustand selector 订阅范式**（`AgentControlBar.tsx` L44-51）：
```typescript
// 仅按字段订阅（Zustand selector pattern），不订阅整个 store
const status = useAgentStore((s) => s.agentStatus);
const currentStep = useAgentStore((s) => s.currentStep);
const abort = useAgentStore((s) => s.abort);
```

**abort 调用**（AgentControlBar.tsx L101-103）：
```typescript
<button type="button" className="btn-icon" onClick={() => abort('user')} aria-label={t`中止`}>
  <StopIcon />
</button>
```

**teal 卡片样式**（styles.css L473-484）：
```css
.aster-tool-card {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-3);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 12.5px;
  color: var(--text-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex-shrink: 0;
}
```

**soft-landing 卡片 accent 边框**（styles.css L500-503）：
```css
.aster-tool-card--soft-landing {
  border-color: var(--accent);
  background: var(--surface);
}
```

**卡片按钮区布局**（styles.css L512-516）：
```css
.aster-tool-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
```

**二级按钮（取消/重新生成）**（styles.css L525-537）：
```css
.aster-tool-card__btn-secondary {
  display: inline-flex;
  align-items: center;
  padding: 4px var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-3);
  background: transparent;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 500;
}
```

**图片预览 `<img>` 渲染方式**（CONTEXT D-01 + RESEARCH.md Pattern 4）：
```tsx
<img src={`data:${mimeType};base64,${base64}`} alt="生成图片预览" style={{ maxWidth: '100%' }} />
```

**组件使用 5 秒安抚态范式**（AgentControlBar.tsx L53-65 `setInterval` + `useEffect`）：
```typescript
const [stalled, setStalled] = useState(false);
useEffect(() => {
  if (status === 'idle') { setStalled(false); return; }
  const id = setInterval(() => {
    const ts = useAgentStore.getState().lastUpdateTs;
    setStalled(Date.now() - ts > 5000);
  }, 1000);
  return () => clearInterval(id);
}, [status]);
```

**生图独立 AbortController**（RESEARCH.md D-08）：ImagePreviewCard 需自持独立 `AbortController`（非 agentStore 的 agent loop 控制器），`generate_ppt/word_image` 工具 `execute` 收到 `ctx.signal` 时传给 `AihubmixImageClient.generate()`。

---

### `src/components/Settings/SettingsPanel.tsx` — 扩展生图 model picker

**Analog:** `src/components/Settings/SettingsPanel.tsx` L155-200（全局选项分区模式）

**全局选项分区渲染范式**（SettingsPanel.tsx L155-200）：
```tsx
{/* ③ 全局选项分区（D-26 ③） */}
<div className="aster-settings__global-options">
  <div className="aster-settings__section">
    <label className="aster-settings__toggle-row" htmlFor="setting-auto-attach">
      <span className="aster-settings__label">
        <Trans>自动附带选区内容</Trans>
      </span>
      <label className="switch" aria-label={t`自动附带选区内容`}>
        <input
          id="setting-auto-attach"
          type="checkbox"
          checked={attachEnabled}
          onChange={(e) => setAttachEnabled(e.target.checked)}
        />
        <span className="thumb" />
      </label>
    </label>
    <p className="aster-settings__hint">...</p>
  </div>
  {/* ... 更多 section */}
</div>
```

**生图 model picker 对应的实现形态**（仿 section 结构，下拉 `<select>` 替代 toggle）：
```tsx
<div className="aster-settings__section">
  <label className="aster-settings__label" htmlFor="setting-image-gen-model">
    <Trans>生图模型</Trans>
  </label>
  <select
    id="setting-image-gen-model"
    value={imageGenModel}
    onChange={(e) => setImageGenModel(e.target.value)}
    className="aster-settings__select"
  >
    {IMAGE_GEN_MODELS.map((m) => (
      <option key={m.id} value={m.id}>{m.label}</option>
    ))}
  </select>
  <p className="aster-settings__hint">
    <Trans>默认生图模型（可在预览卡内临时切换）</Trans>
  </p>
</div>
```

**`IMAGE_GEN_MODELS` 来源**（registry.ts L49-72）：
```typescript
export const IMAGE_GEN_MODELS: ImageGenModel[] = [
  { id: 'doubao-seedream-5.0-lite', label: 'Doubao SeedDream 5.0 Lite（快速默认）', endpointKind: 'predictions', authKind: 'bearer', isDefault: true },
  { id: 'gpt-image-2', label: 'GPT-Image-2（高质量）', endpointKind: 'predictions', authKind: 'bearer', isDefault: false },
  { id: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image Preview', endpointKind: 'gemini', authKind: 'goog-api-key', isDefault: false },
];
```

**持久化 model 偏好**（仿 storage.ts pattern）：
```typescript
// 读写模式（参考 registry.ts L100 + storage.ts L66-73）
const PREF_IMAGE_GEN_MODEL = 'aster:pref:image-gen-model';
const stored = storage.get<string>(PREF_IMAGE_GEN_MODEL);
const imageGenModel = stored ?? DEFAULT_IMAGE_GEN_MODEL.id;
// 保存：
storage.set(PREF_IMAGE_GEN_MODEL, selectedModelId);
```

---

### `src/agent/tools/index.ts` — PPT_TOOLS + buildToolsForHost (IMG-05)

**Analog:** `src/agent/tools/index.ts` L28-42 (`PPT_TOOLS` Set) + L244-297 (`buildToolsForHost`)

**PPT_TOOLS Set（必须加入新工具名）**（index.ts L28-42）：
```typescript
const PPT_TOOLS = new Set([
  'insert_slide',
  'set_shape_property',
  'move_shape',
  'set_shape_text',
  'set_shape_text_font',
  'add_shape',
  'copy_slide',
  'set_shape_text_alignment',
  'delete_shape',
  'rotate_shape',
  'manage_slides',
  'set_slide_background',
  'get_shape_image',
  // Phase 16 新增：
  // 'generate_ppt_image',  ← 必须加入（防 casing 静默失败，Phase 14 D-10 历史教训）
]);
```

**per-host 注册（IMG-05: Excel 不加生图工具）**（index.ts L244-297）：
```typescript
export function buildToolsForHost(host: 'word' | 'excel' | 'ppt'): ToolDef[] {
  switch (host) {
    case 'word': {
      const wordWriteTools = [
        appendParagraph, insertParagraph, /* ... 现有工具 */,
        batchWrite,
        // generateWordImageTool,  ← Phase 16 加入 Word case
      ] as ToolDef[];
      wordWriteTools.forEach(assertWriteToolRegisterable);
      return [...readTools, ...wordWriteTools, selectionDetail].map((t) => t as ToolDef);
    }
    case 'excel': {
      // ← Excel case 不加生图工具（IMG-05: Excel 无原生插图 API）
      return [...excelReadTools, ...excelWriteTools, selectionDetail].map((t) => t as ToolDef);
    }
    case 'ppt': {
      const pptWriteTools = [
        insertSlide, setShapeProperty, /* ... 现有工具 */,
        batchWrite,
        // generatePptImageTool,  ← Phase 16 加入 PPT case
      ] as ToolDef[];
      pptWriteTools.forEach(assertWriteToolRegisterable);
      return [...pptReadTools, ...pptWriteTools, selectionDetail].map((t) => t as ToolDef);
    }
  }
}
```

---

### `src/store/chat.test.ts` — 扩展 NFR-09 路径 C

**Analog:** `src/store/chat.test.ts` NFR-09 路径 A (L297-330)

**路径 A 模式（复制此结构写路径 C）**（chat.test.ts L297-330）：
```typescript
it('NFR-09 serialize-test：tool role 含 vision base64 → 序列化后 base64 不出现', () => {
  const fakeBase64 = 'data:image/png;base64,' + 'A'.repeat(500);
  useChatStore.setState({
    messages: [
      { id: 'u1', role: 'user', content: '分析这张图', ts: 1 },
      {
        id: 'tool1',
        role: 'tool',
        content: '正在看这张图…',
        toolResult: {
          ok: true,
          data: { vision_result: '图中是一张饼图', base64_raw: fakeBase64 },
        },
        ts: 2,
      },
      { id: 'a1', role: 'assistant', content: '根据图片…', ts: 3 },
    ],
  } as never);

  useChatStore.getState().saveHistory('aster:chat:vis-test');
  const call = mockedStorage.set.mock.calls[0];
  const payload = call[1] as { messages: Array<{ role: string; content: string }> };

  expect(payload.messages.every((m) => m.role !== 'tool')).toBe(true);  // tool role 不出现
  const allContent = payload.messages.map((m) => m.content).join('');
  expect(allContent).not.toContain('base64');
  expect(allContent).not.toContain('data:image');
  expect(allContent).not.toContain('A'.repeat(100));
});
```

**路径 C（image preview pending 路径，本 Phase 新增断言）的模拟结构：**
```typescript
// 路径 C：生图工具 ToolResult.data.base64 不进 serializeForStorage
it('NFR-09 路径 C: image preview pending ToolResult.data.base64 不出现在序列化结果', () => {
  const fakeBase64 = 'B'.repeat(500);
  useChatStore.setState({
    messages: [
      { id: 'u1', role: 'user', content: '生成一张落日的图', ts: 1 },
      {
        id: 'tool1',
        role: 'tool',
        content: '图片已生成，确认插入？',
        toolResult: {
          ok: true,
          data: {
            base64: fakeBase64,       // base64 在 data 里，不应序列化
            mimeType: 'image/png',
            prompt: '落日，暖色调，写实风格',
            preview_pending: true,
          },
        },
        ts: 2,
      },
      { id: 'a1', role: 'assistant', content: '图片已生成，请确认插入', ts: 3 },
    ],
  } as never);
  // ... 同路径 A：tool role 不出现，base64 字符串不出现
});
```

---

### `src/agent/operationLog.integration.test.ts` — 新增守门用例

**Analog:** `src/agent/operationLog.integration.test.ts` L849-879（D-17 add_shape + noop_inverse）

**delete_shape_by_id rolled_back 模式**（L849-864）：
```typescript
it('D-17: add_shape → delete_shape_by_id → rolled_back', async () => {
  mockPpt('');
  const adapter = new PptAdapter();
  const entry: OperationLogEntry = {
    runId: 'r10', stepIndex: 12,
    toolName: 'add_shape',
    args: { slideIndex: 1, shapeType: 'TextBox', position: {...}, text: '季度总结' },
    humanLabel: '在第 1 页插入文本框「季度总结」',
    reverse: { tool: 'delete_shape_by_id', args: { slide_index: 1, shape_id: 'new-shape-uuid' } },
    postState: { kind: 'ppt_shape_new', content: { slideIndex: 1, shapeId: 'new-shape-uuid' } },
    timestamp: 0,
  };
  const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
  expect(detail.status).toBe('rolled_back');
});
```

**noop_inverse skipped_error 模式**（L866-879）：
```typescript
it('D-17: delete_shape → noop_inverse → skipped_error（noop+gate）', async () => {
  const entry: OperationLogEntry = {
    runId: 'r10', stepIndex: 13,
    toolName: 'delete_shape',
    args: { slideIndex: 1, shapeId: 'shape-02' },
    humanLabel: '删除第 1 页形状「shape-02」',
    reverse: { tool: 'noop_inverse', args: { reason: '此步不可自动撤销' } },
    postState: { kind: 'ppt_shape', content: { slideIndex: 1, shapeId: 'shape-02' } },
    timestamp: 0,
  };
  const detail = await replayUndoSingle(entry, {} as DocumentAdapterForReplay);
  expect(detail.status).toBe('skipped_error');
});
```

**Phase 16 新增 integration 守门用例应复用这两个模式：**
- `generate_ppt_image` 手动 `appendOperation` → `delete_shape_by_id` → `rolled_back`
- `generate_word_image` 手动 `appendOperation` → `noop_inverse` → `skipped_error`

---

## Shared Patterns

### 错误处理（三类结构化错误，Phase 15 D-13 继承）
**Source:** `src/agent/tools/index.ts` L63-79 `ToolError` + `ppt.ts` L79-90 `notEffectiveResult`
**Apply to:** `ppt-image.ts`、`word-image.ts`、`insertImage.ts`
```typescript
export interface ToolError {
  code: ToolErrorCode;
  message: string;      // 中文，user-readable
  recoverable: boolean;
  hint: string;         // 中文，LLM-readable
}
// Phase 16 三类错误码：
// ① 未配 aihubmix key → code: 'PERMISSION_DENIED', recoverable: false
// ② 生成失败/超时/取消 → code: 'HOST_API_FAILED', recoverable: true
// ③ 宿主插图 API 失败 → code: 'HOST_API_FAILED', recoverable: false
```

### adapter inverse 签名（Record 对象，非位置参）
**Source:** `src/adapters/PptAdapter.ts` L1653 `deleteShapeById` 签名 + `src/agent/tools/write/word.ts` L14-15 注释
**Apply to:** `PptAdapter.addImageShape` 的 reverse 调用、`DocumentAdapterForReplay` interface 新增方法
```typescript
// 所有 inverse 方法必须收 Record<string, unknown>（非位置参）
async deleteShapeById(args: Record<string, unknown>): Promise<void> {
  const slide_index = args.slide_index as number;
  const shape_id = args.shape_id as string;
  // ...
}
```

### PPT_TOOLS Set 守门（防 casing 静默失败）
**Source:** `src/agent/tools/index.ts` L28-42 `PPT_TOOLS` Set + L44-53 `normalizeToSnakeCase`
**Apply to:** `generate_ppt_image` 工具名必须加入 PPT_TOOLS
```typescript
function normalizeToSnakeCase(args: unknown): unknown {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return args;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args as Record<string, unknown>)) {
    out[k.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`)] = v;
  }
  return out;
}
```

### localStorage 读写（storage lib 统一门）
**Source:** `src/lib/storage.ts` L61-93 + `src/providers/registry.ts` L100 `storage.get`
**Apply to:** image-gen model 持久选择（`aster:pref:image-gen-model`）
```typescript
// 约定键名格式（与 STORAGE_KEYS 体系一致）：
const PREF_IMAGE_GEN_MODEL = 'aster:pref:image-gen-model';
storage.get<string>(PREF_IMAGE_GEN_MODEL) ?? DEFAULT_IMAGE_GEN_MODEL.id;
storage.set(PREF_IMAGE_GEN_MODEL, selectedModelId);
```

### CSS teal 设计系统变量（2026-05-29 起，所有 UI 文件遵循）
**Source:** `src/styles.css` CSS 变量体系（`--accent`/`--surface`/`--text`/`--border` 等）
**Apply to:** `ImagePreviewCard.tsx`、SettingsPanel 新增 section 的 className
- 禁用硬编码 hex/px，全走 CSS 变量
- 按钮用 `.btn .btn-primary / .btn-ghost / .btn-sm`
- 图标用内联 SVG（`src/components/icons.tsx`），`stroke=currentColor`

---

## No Analog Found

本 Phase 所有文件均在 codebase 中找到贴近 analog，无「无 analog」文件。

---

## Metadata

**Analog search scope:** `src/agent/tools/write/`、`src/adapters/`、`src/agent/operationLog.ts`、`src/providers/registry.ts`、`src/providers/aihubmix-image.ts`、`src/components/`、`src/store/chat.test.ts`、`src/lib/storage.ts`
**Files scanned:** 14
**Pattern extraction date:** 2026-06-02
