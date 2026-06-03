# Phase 24: A P2 自渲染预览 + bundle 守门 — Pattern Map

**生成日期：** 2026-06-03
**分析文件数：** 9 个（新增/修改）
**找到 analog：** 9 / 9

---

## 文件分类

| 新增/修改文件 | 角色 | 数据流 | 最近 Analog | 匹配质量 |
|---|---|---|---|---|
| `src/agent/design/slide-preview.ts` | utility（纯函数） | transform | `src/agent/design/geometry-check.ts` | exact（同目录纯函数，ppt-tokens import，可单测） |
| `src/components/SlidePreviewPanel.tsx` | component | event-driven | `src/components/ChatStream.tsx`（Suspense 挂载点） + `src/components/DiffLogPanel`（lazy chunk） | role-match |
| `src/agent/tools/read/visual-check.ts` | tool（read-style） | request-response | `src/agent/tools/read/ppt.ts`（checkSlideLayout） + `src/agent/tools/read/vision.ts` | exact（同目录 read tool，wrapReadResult，不进 PPT_TOOLS） |
| `src/agent/design/slide-preview.test.ts` | test | — | `src/agent/design/geometry-check.test.ts` | exact（同目录纯函数单测，vitest describe/it/expect） |
| `src/agent/tools/read/visual-check.test.ts` | test | — | `src/agent/tools/read/vision.test.ts` | exact（同目录 read tool 单测，vi.fn mock，5 用例结构） |
| `src/agent/tools/index.ts`（修改） | registry | — | 自身（buildToolsForHost ppt case，checkSlideLayout 注册行） | exact |
| `src/components/ChatStream.tsx`（修改） | component | event-driven | 自身（ImagePreviewCard / DiffLogPanel lazy 挂载块） | exact |
| `package.json`（修改） | config | — | 自身（html2canvas 依赖项添加） | exact |
| i18n catalog（`npm run extract` 产物） | config | — | 自身（既有 Lingui 宏 extract 流程） | exact |

---

## Pattern Assignments

### `src/agent/design/slide-preview.ts`（utility，transform）

**Analog：** `src/agent/design/geometry-check.ts`（纯函数，ppt-tokens import，可单测，零 React/网络）

**Imports 范式**（geometry-check.ts 第 1–11 行）：

```typescript
// 只 import ppt-tokens 常量/类型，零其他依赖
import {
  DEFAULT_CANVAS_PT, MARGINS_PT, OVERLAP_MIN_PT, OVERFLOW_TOLERANCE_PT, TEXT_METRICS,
  type Canvas,
} from './ppt-tokens';
```

slide-preview.ts **照此模式**：只 import ppt-tokens 的 `DEFAULT_CANVAS_PT`（960×540 坐标真相源）和 ppt-layouts 的 `ShapeSpec` 类型，不 import React（渲染器只产出数据/style 对象，不含 JSX）。

**核心函数范式**（geometry-check.ts 第 170–187 行，顶层聚合函数）：

```typescript
export function checkSlideLayout(
  shapes: ShapeBox[],
  opts?: { canvas?: Canvas; annotations?: TextBoxAnnotation[] },
): LayoutReport {
  const canvas = opts?.canvas ?? DEFAULT_CANVAS_PT;
  // ...
  return { canvas, violations, notes };
}
```

slide-preview.ts **照此范式**：顶层导出纯函数 `mapShapesToRender(shapes: ShapeSpec[], containerWidthPx: number): SlideRenderShape[]`，以 `DEFAULT_CANVAS_PT.widthPt`（960）为坐标基准，不内部硬编任何数字。

**坐标映射核心逻辑**（来自 RESEARCH.md Pattern 2，已验证 ppt-tokens L22 基准）：

```typescript
// scale = containerWidthPx / DEFAULT_CANVAS_PT.widthPt
// 即：containerWidthPx / 960
const scale = containerWidthPx / DEFAULT_CANVAS_PT.widthPt;
// 每个 shape：
{
  left:   s.rect.left   * scale,
  top:    s.rect.top    * scale,
  width:  s.rect.width  * scale,
  height: s.rect.height * scale,
  fontSize: Math.max((s.font?.size ?? 14) * scale, 9), // 下限 9px
  borderRadius: s.shapeType === 'RoundedRectangle' ? `${Math.round(4 * scale)}px`
              : s.shapeType === 'Ellipse' ? '50%'
              : undefined,
}
```

**「照着改什么」**：用 geometry-check.ts 的「纯函数、零副作用、只 import ppt-tokens、export 顶层聚合函数」结构，替换检查逻辑为 960→px 坐标映射逻辑。不需要 React.CSSProperties 类型 import（可用 `as const` 内联，或让 SlidePreviewPanel 接收纯数字/字符串的 style 描述对象）。

---

### `src/components/SlidePreviewPanel.tsx`（component，event-driven）

**Analog 1（懒加载 chunks 范式）：** `src/components/ChatStream.tsx` 第 35–57 行

```typescript
// Phase 16 IMG-03：ImagePreviewCard — lazy chunk
const ImagePreviewCard = lazy(() =>
  import('./ImagePreviewCard').then((m) => ({ default: m.ImagePreviewCard }))
);
// Phase 18 LIB-03：StockImageResultCard — lazy chunk
const StockImageResultCard = lazy(() =>
  import('./StockImageResultCard').then((m) => ({ default: m.StockImageResultCard }))
);
// DiffLogPanel — lazy chunk（只在 run 完成后渲染）
const DiffLogPanel = lazy(() => import('./DiffLogPanel'));
```

**Analog 2（Suspense 使用范式）：** `src/App.tsx` 第 99–113 行

```typescript
<div className={`settings-overlay${showSettings ? ' is-open' : ''}`}>
  {showSettings && (
    <Suspense fallback={null}>
      <SettingsPanel ... />
    </Suspense>
  )}
</div>
```

**Analog 3（ChatStream.tsx 中 ImagePreviewCard 挂载点，第 241–251 行）**：

```typescript
{imageResult && (
  <Suspense fallback={null}>
    <ImagePreviewCard
      base64={imageResult.base64}
      mimeType={imageResult.mimeType}
      host={host}
    />
  </Suspense>
)}
```

**Lingui 范式**（App.tsx 第 21–22 行 + 内联文案）：

```typescript
import { Trans, useLingui } from '@lingui/react/macro';
// ...
<Trans>请先配置 API Key</Trans>
```

**CSS 变量范式**（从 UI-SPEC.md 定义的 CSS 类名 + styles.css 既有变量体系）：

```css
/* UI-SPEC.md 定义的新 CSS 类（写入 src/styles.css）*/
.slide-preview-panel { background: var(--bg); border: 1px solid var(--border); ... }
.slide-preview-panel__header { background: var(--surface-2); height: 28px; }
.slide-preview-panel__title { font-size: var(--fs-12); color: var(--text-2); }
.slide-preview-container { background: #ffffff; position: relative; overflow: hidden; }
```

**「照着改什么」**：
1. 在 ChatStream.tsx 顶部添加 `const SlidePreviewPanel = lazy(() => import('./SlidePreviewPanel'))` — 与 DiffLogPanel lazy 同行风格。
2. 在 ToolResultCard 渲染路径或 ChatStream 主流中，当 agent 消息包含 layout 结果时条件渲染 `<Suspense fallback={null}><SlidePreviewPanel .../></Suspense>`，与 imageResult 的挂载模式一致。
3. SlidePreviewPanel 内部：import `mapShapesToRender`（纯数据函数），用 `useRef<HTMLDivElement>` 持有 `.slide-preview-container` 引用（供 visual_check_slide 工具截图），用 `useState` 持 containerWidth，用 `useMemo` 缓存 `mapShapesToRender` 结果。
4. 文案走 `<Trans>` 宏（Lingui），修改后必须 `npm run extract`。
5. 所有面板 chrome 颜色用 CSS 变量，幻灯片内容颜色用 ShapeSpec 数据（物理隔离，不混用 `--accent`/`--bg` 给内容着色）。

---

### `src/agent/tools/read/visual-check.ts`（tool，read-style，request-response）

**Analog 1（read tool 整体结构）：** `src/agent/tools/read/ppt.ts` 第 136–183 行（`checkSlideLayout`）

```typescript
// checkSlideLayout 是 read-style advisory tool 的完整样板：
export const checkSlideLayout: ToolDef<CheckLayoutArgs> = {
  name: 'check_slide_layout',
  kind: 'read',               // ← read tool，非 write；无 undo/operationLog/reverse
  async execute({ slideIndex, textBoxes }, ctx): Promise<ToolResult> {
    // ... 纯计算逻辑 ...
    return wrapReadResult(
      { ok: true, data: { ...report, summary: formatViolations(report) } },
      { result_type: 'metadata', source: `slide_${slideIndex}.layout_check` },
    );
  },
};
```

**Analog 2（vision 调用 + NFR-09 契约）：** `src/providers/aihubmix-vision.ts` 第 44–85 行 + `src/adapters/PptAdapter.ts`（ProviderRegistry.resolve 用法，已在 RESEARCH.md Q4 L397–403 给出片段）

```typescript
// VisionConfig 来源（PptAdapter.ts L612-620，已在 RESEARCH.md 验证）：
const cfg = ProviderRegistry.resolve(
  'vision',
  () => useProviderStore.getState().providers[0]!,
) as ImageConfig;
const visionConfig: VisionConfig = { baseURL: cfg.baseURL, apiKey: cfg.apiKey };

// analyzeImages 接口（aihubmix-vision.ts L44-85）：
// - images: VisionImage[] = [{ base64: 裸base64字符串, mimeType: 'image/png' }]
// - 内部拼 data URL：`data:${mimeType};base64,${base64}`（L51）
// - 返回 { content: string }（违规文字 evidence）
const { content } = await new AihubmixVisionClient().analyzeImages(
  FOCUS_PROMPT,
  [{ base64: pureBase64, mimeType: 'image/png' }],
  { baseURL: cfg.baseURL, apiKey: cfg.apiKey },
);
```

**Analog 3（wrapReadResult 签名）：** `src/agent/read-result.ts` 第 74–105 行

```typescript
export function wrapReadResult(
  result: ReadableInput,
  opts: { result_type: ReadResultType; source: string },
): ToolResult { ... }
```

**Imports 范式**（ppt.ts read tools 第 13–17 行）：

```typescript
import type { ToolDef, ToolResult } from '../index';
import { wrapReadResult } from '../../read-result';
// visual-check.ts 额外需要：
import { ProviderRegistry } from '../../../providers/registry';
import { AihubmixVisionClient } from '../../../providers/aihubmix-vision';
import type { VisionConfig } from '../../../providers/aihubmix-vision';
import type { ImageConfig } from '../../../providers/types';
import { useProviderStore } from '../../../store/providers';
```

**关键约束（来自 ppt.ts + index.ts 的 PPT_TOOLS 集合）**：`visual_check_slide` 是 read tool，`kind: 'read'`，**不进 PPT_TOOLS 集合**（PPT_TOOLS 仅 write tool camelCase 归一化用）。不加 `reverse`/`postState`。

**NFR-09 契约**（vision.ts 第 39–43 行 + RESEARCH.md Q5）：

```typescript
// base64 在 execute() 内产生并传给 analyzeImages，之后不再使用
const pureBase64 = canvas.toDataURL('image/png').split(',')[1]; // 局部变量
const { content } = await client.analyzeImages(FOCUS_PROMPT, [{ base64: pureBase64, mimeType: 'image/png' }], visionConfig);
// pureBase64 至此生命周期结束，不写入 ToolResult.data
return wrapReadResult(
  { ok: true, data: { summary: content } },   // 只含文字，无 base64
  { result_type: 'metadata', source: `slide_${slideIndex}.visual_check` },
);
```

**html2canvas 动态 import 范式**（来自 pdf.ts 第 17–18 行 + RESEARCH.md Pattern 1）：

```typescript
// pdf.ts 的 await import 范式（execute() 内部动态加载）：
const pdfjsLib = await import('pdfjs-dist');
// visual-check.ts 照此范式：
const { default: html2canvas } = await import('html2canvas');
const canvas = await html2canvas(previewEl, {
  scale: 2, useCORS: false, allowTaint: false, logging: false, backgroundColor: '#ffffff',
});
```

**「照着改什么」**：完整复制 checkSlideLayout 的 ToolDef 结构（name/description/parameters/humanLabel/kind/'read'/execute），替换 execute 内容为「取 DOM ref → 动态 import html2canvas → 截图 → ProviderRegistry.resolve('vision') → analyzeImages → wrapReadResult（不含 base64）」。名称用 `visual_check_slide`。

---

### `src/agent/design/slide-preview.test.ts`（test，unit）

**Analog：** `src/agent/design/geometry-check.test.ts`（全文，110 行）

**测试结构范式**（geometry-check.test.ts 第 1–10 行）：

```typescript
import { describe, it, expect } from 'vitest';
import { wcagContrastRatio, estimateTextBox, checkSlideLayout, formatViolations, type ShapeBox } from './geometry-check';

// 辅助工厂函数（让测试数据干净）
const box = (id: string, left: number, top: number, width: number, height: number): ShapeBox => ({ id, left, top, width, height });

describe('功能域名称（PVQ-XX）', () => {
  it('happy path：正常输入的预期输出', () => { ... });
  it('edge case：边界值或异常输入', () => { ... });
});
```

**关键测试回归点**（geometry-check.test.ts 第 63–69 行，960 基准守门）：

```typescript
it('③ 越界 edge：框超出 960 画布右缘 → 报（用默认 canvas 960×540，不是 720）', () => {
  const r = checkSlideLayout([box('s', 900, 50, 200, 100)]);
  expect(r.violations.some((v) => v.kind === 'out_of_bounds')).toBe(true);
});
it('③ 关键回归：右半屏 (left=700,width=200→右缘 900) 在 960 画布内不越界', () => {
  const r = checkSlideLayout([box('s', 700, 50, 200, 100)]);
  expect(r.violations.filter((v) => v.kind === 'out_of_bounds')).toHaveLength(0);
});
```

**「照着改什么」**：slide-preview.test.ts 用相同 vitest describe/it/expect 结构，测 `mapShapesToRender`：
- happy：喂已知 ShapeSpec（left=48, top=36, width=864, height=468 @960pt），containerWidth=480（scale=0.5），断言 style.left=24、style.width=432。
- 坐标基准 960 回归：验证同一 shape 在 containerWidth=320 时 scale=320/960≈0.333，数值正确。
- 字号下限：font.size=4 × scale=0.5 = 2 < 9，断言 fontSize=9（Math.max 兜底）。
- ShapeType 分支：RoundedRectangle → borderRadius 有值；Ellipse → '50%'；Rectangle → undefined。

---

### `src/agent/tools/read/visual-check.test.ts`（test，unit）

**Analog：** `src/agent/tools/read/vision.test.ts`（全文，42 行）

**测试结构范式**（vision.test.ts 第 1–12 行）：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getShapeImage } from './vision';

describe('getShapeImage ToolDef', () => {
  it('name=get_shape_image, kind=read', () => {
    expect(getShapeImage.name).toBe('get_shape_image');
    expect(getShapeImage.kind).toBe('read');
  });

  it('execute 调 adapter.read({ kind: "get_shape_image", focus })', async () => {
    const read = vi.fn().mockResolvedValue({ ok: true, data: { vision_result: 'x' } });
    await getShapeImage.execute({ focus: '图表数值' }, { adapter: { read } } as never);
    expect(read).toHaveBeenCalledWith({ kind: 'get_shape_image', focus: '图表数值' });
  });
  // ... 5 用例
});
```

**「照着改什么」**：visual-check.test.ts 用同结构，核心 5 用例：
1. `name === 'visual_check_slide'，kind === 'read'`
2. html2canvas 动态 import 被 mock（`vi.mock('html2canvas', ...)`），验证 execute 内部被调用
3. **NFR-09 守门**：mock html2canvas + AihubmixVisionClient，执行后断言 `JSON.stringify(result.data)` 不含长 base64 字符串（`not.toMatch(/[A-Za-z0-9+/]{100,}/)`）
4. evidence 文字拼入：mock analyzeImages 返回 `{ content: '溢出：无；重叠：无' }`，断言 `result.data.summary` 含该文字
5. previewEl 不存在时返回 advisory ToolResult（ok: true，data.summary 含「跳过」）

---

### `src/agent/tools/index.ts`（修改 — read 工具注册）

**Analog（精确定位）：** 同文件，第 310 行（PPT host read tools 列表）

```typescript
// 第 310 行（现有）：
return [
  listSlides, getSlide, listShapesOnSlide, getShape, checkSlideLayout, // Phase 22 PVQ-02：新增版面自查 read 工具（checkSlideLayout, 不进 PPT_TOOLS 归一化集）
  getShapeImage,
  ...pptWriteTools, selectionDetail,
].map((t) => t as ToolDef);
```

**「照着改什么」**：
1. 在文件顶部 import 块添加 `import { visualCheckSlide } from './read/visual-check';`（仿第 22 行 `import { getShapeImage } from './read/vision'` 的位置和风格）。
2. 在 ppt case 的 read 列表中追加 `visualCheckSlide`，仿 `checkSlideLayout` 的行内注释风格：`visualCheckSlide, // Phase 24 PVQ-06：visual_check_slide read tool（不进 PPT_TOOLS，see LOCKED-2）`
3. **不修改 PPT_TOOLS 集合**（read tool 不需要 camelCase 归一化）。
4. 若使用 `PVQ06_VISUAL_CHECK_ENABLED` 开关：`...(PVQ06_VISUAL_CHECK_ENABLED ? [visualCheckSlide] : [])` 与 pptWriteTools spread 同风格。

---

### `src/components/ChatStream.tsx`（修改 — SlidePreviewPanel 挂载点）

**Analog（精确定位）：** 同文件，第 45–57 行（ImagePreviewCard / DiffLogPanel lazy 声明）+ 第 241–251 行（Suspense 条件挂载）

```typescript
// 顶部 lazy 声明（第 45–57 行风格）：
const DiffLogPanel = lazy(() => import('./DiffLogPanel'));
// 添加：
const SlidePreviewPanel = lazy(() => import('./SlidePreviewPanel'));

// 条件挂载（第 241–251 行风格）：
{imageResult && (
  <Suspense fallback={null}>
    <ImagePreviewCard base64={imageResult.base64} mimeType={imageResult.mimeType} host={host} />
  </Suspense>
)}
// 照此添加：
{layoutShapes && (
  <Suspense fallback={null}>
    <SlidePreviewPanel shapes={layoutShapes} containerRef={previewPanelRef} />
  </Suspense>
)}
```

**「照着改什么」**：
1. 顶部 lazy 声明块新增 `const SlidePreviewPanel = lazy(() => import('./SlidePreviewPanel'))`。
2. 确定 `layoutShapes`（当前消息 toolResult 中含 apply_slide_layout 产物的 shapes 数组）的提取逻辑，仿 `imageResult` 的提取模式（第 121–129 行 `const imageResult = ((): ... => { ... })()`）。
3. 在 ToolResultCard 渲染尾部（第 264 行 `</>` 之前）添加 SlidePreviewPanel 的 Suspense 块，条件：layoutShapes 非空。

---

## Shared Patterns（跨文件共用）

### 懒加载范式（所有 new chunk 必须遵守）

**来源：** `src/lib/parsers/pdf.ts` 第 18 行（await import 函数内部）+ `src/components/ChatStream.tsx` 第 45–56 行（React.lazy）

**apply to：** html2canvas import（在 visual-check.ts execute 内）、SlidePreviewPanel（ChatStream.tsx React.lazy）

```typescript
// 1. 函数内动态 import（用于第三方库）
async function capturePreview(el: HTMLElement): Promise<string> {
  const { default: html2canvas } = await import('html2canvas'); // 动态 import，只有此行触发加载
  // ...
}

// 2. React.lazy（用于组件）
const SlidePreviewPanel = lazy(() => import('./SlidePreviewPanel')); // 不进 main chunk
```

**验证命令：** `npm run build && npm run size`（先 build 再 size，陈旧 dist 给假绿）

---

### wrapReadResult evidence 范式

**来源：** `src/agent/tools/read/ppt.ts` 第 175–182 行

```typescript
return wrapReadResult(
  { ok: true, data: { ...report, summary: formatViolations(report) } },
  { result_type: 'metadata', source: `slide_${slideIndex}.layout_check` },
);
```

**apply to：** `visual_check_slide.execute()` 的返回值（result_type='metadata'，source=`slide_${slideIndex}.visual_check`）

---

### NFR-09 base64 不出 ToolResult 契约

**来源：** `src/agent/tools/read/vision.ts`（base64 在 adapter 层消费，不出 ToolResult.data）+ `src/providers/aihubmix-vision.ts` 第 50–53 行（analyzeImages 内部拼 data URL）

```typescript
// aihubmix-vision.ts 内部拼 data URL（L51）：
// 调用方传裸 base64（去 'data:image/png;base64,' 前缀），mimeType='image/png'
const imageBlocks = images.map(({ base64, mimeType }) => ({
  type: 'image_url' as const,
  image_url: { url: `data:${mimeType};base64,${base64}` },
}));
```

**apply to：** visual-check.ts execute()：pureBase64 仅作局部变量传 analyzeImages，不写入 data；visual-check.test.ts 守门测试验证 `result.data` 不含 base64。

---

### ToolDef read-style 不进 PPT_TOOLS

**来源：** `src/agent/tools/index.ts` 第 31–48 行（PPT_TOOLS 集合注释）+ 第 310 行（checkSlideLayout 不在集合内但在 read 列表）

```typescript
// PPT_TOOLS 仅含 write tools（camelCase 归一化服务于 write tool 参数）
const PPT_TOOLS = new Set([
  'insert_slide', 'set_shape_property', ..., 'apply_slide_layout',
  // checkSlideLayout 不在此；visual_check_slide 同样不在此
]);
// read tools 直接加在 return 数组里，不加入 PPT_TOOLS
return [
  listSlides, getSlide, listShapesOnSlide, getShape, checkSlideLayout,
  getShapeImage,
  ...pptWriteTools, selectionDetail,
].map((t) => t as ToolDef);
```

**apply to：** visual_check_slide 注册时只进 ppt case return 数组，不进 PPT_TOOLS 集合。

---

### Lingui Trans 宏 + npm run extract

**来源：** `src/App.tsx` 第 21–22 行 + 第 78 行

```typescript
import { Trans, useLingui } from '@lingui/react/macro';
// ...
<Trans>请先配置 API Key</Trans>
```

**apply to：** SlidePreviewPanel.tsx 内的所有 UI 文案（「幻灯片预览」「截图自查中…」「自查失败」「关闭预览」）。每次修改含 Trans 宏的文件后必须运行 `npm run extract`，否则 `coverage.test.ts` 报红。

---

### ProviderRegistry.resolve vision 配置取法

**来源：** `src/providers/registry.ts` 第 113–123 行（vision case）+ RESEARCH.md Q4 引用 PptAdapter.ts L612-620

```typescript
// ProviderRegistry.resolve('vision', getDefaultLLMFn) → ImageConfig
static resolve(taskKind: TaskKind, getDefaultLLM: () => ProviderConfig): LLMConfig | ImageConfig {
  // ...
  case 'vision': {
    const apiKey = storage.get<string>(STORAGE_KEYS.KEY_PREFIX + AIHUBMIX_PROVIDER_ID);
    if (!apiKey) throw new KeyInvalidError('...');
    return { providerId: '...', baseURL: AIHUBMIX_BASE_URL, apiKey, model: AIHUBMIX_VISION_MODEL };
  }
}
// 调用侧（PptAdapter.ts L612-620，来自 RESEARCH.md Q4）：
const cfg = ProviderRegistry.resolve(
  'vision',
  () => useProviderStore.getState().providers[0]!,
) as ImageConfig;
const visionConfig: VisionConfig = { baseURL: cfg.baseURL, apiKey: cfg.apiKey };
```

**apply to：** visual-check.ts execute() 内取 vision config。apiKey 仅经 Authorization header，不进 body/error.message（T-01-04 安全约束）。

---

## No Analog Found

无。所有文件均找到质量满足要求的 analog。

---

## Metadata

**Analog 搜索范围：** `src/agent/design/`、`src/agent/tools/read/`、`src/agent/tools/index.ts`、`src/components/ChatStream.tsx`、`src/App.tsx`、`src/lib/parsers/`、`src/providers/aihubmix-vision.ts`、`src/providers/registry.ts`、`src/agent/read-result.ts`
**已读文件数：** 14 个
**Pattern 提取日期：** 2026-06-03
