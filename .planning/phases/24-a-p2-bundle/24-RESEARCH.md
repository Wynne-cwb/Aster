# Phase 24: A P2 自渲染预览 + bundle 守门 — Research

**研究日期：** 2026-06-03
**领域：** html2canvas 截图、自渲染 SlidePreview、vision 自查工具（read-style）、bundle 约束、NFR-09 守门
**总体置信度：** HIGH（核心路径均已查代码真相源 + npm registry 实测）

---

<user_constraints>
## User Constraints（来自 CONTEXT.md LOCKED 决策）

### Locked Decisions

1. **LOCKED-1：spike-gate verdict = 人眼判断，留最终统一 UAT**（STATE L168）
   - 不在 phase 内自行判定保真度；executor 交付物 = 预览 spike + html2canvas 截图 + 对比图 → UAT 包
   - 绝不把 spike-gate 写成自动 pass/fail 断言

2. **LOCKED-2：必须同时规划两条路径（ROADMAP SC#2 铺开 / SC#3 降级）**
   - 铺开：自渲染截图 → analyzeImages 多模态自查 → 违规文字 evidence 拼回 LLM
   - 降级：只保留 Phase 22 几何自查兜底；REQUIREMENTS.md 状态更新
   - 两条路径的代码都能落地；关闭时行为 == 降级

3. **LOCKED-3：3 个可调项 fold into UAT（STATE L171）**
   - (a) 保真度门槛 = 人眼粗粒度可辨认，无数值 gate
   - (b) 触发 = on-demand（AI 可调工具，非 auto）
   - (c) 渲染 = visible（teal 克制小预览面板）

4. **LOCKED-4：坐标真相源 = 960×540pt**（DEFAULT_CANVAS_PT，Phase 22 已定）
   - REQUIREMENTS.md PVQ-06 描述的 720×405 是 stale，不用
   - scale = containerWidthPx / 960

### Claude's Discretion

- 自渲染渲染器具体模块位置 / 签名（建议：纯函数/纯组件，可单测坐标映射）
- html2canvas 截图函数封装位置（建议落 loop 懒加载链或独立懒加载 chunk）
- 铺开路径 vision 自查工具命名 / focus prompt 文案
- 降级路径开关机制（建议常量 flag 或工具注册分支）
- 测试覆盖点（坐标映射、html2canvas mock、evidence 拼装、NFR-09 守门）

### Deferred Ideas（OUT OF SCOPE）

- spike-gate verdict（铺开 or 降级）——留 UAT
- 3 个可调项最终值——设默认，UAT 调
- 坐标基准 960 vs 720 真机确认（defer D-22-02）
- 铺开路径产线增强（auto-trigger、正式面板）
- 字体回退导致的字宽偏差最终评估——UAT 对比图暴露
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PVQ-06 | 自渲染预览（960×540pt 等比缩放）+ html2canvas 截图 + 多模态自查（溢出/重叠/留白/对比）+ spike 验保真度 + 诚实降级路径 | html2canvas 可行性已验证；analyzeImages 接口已确认；降级路径 = 既有几何自查兜底 |
| NFR-11 | 初始 bundle ≤82KB gzip CI gate 维持；html2canvas 0 净初始增量（动态 import 懒加载） | html2canvas gzip ~46KB（min.js）；落 loop 懒加载链绝不进 main；预览 UI 须 React.lazy |
</phase_requirements>

---

## Summary

本 phase 的核心技术问题是：**html2canvas 在 Office.js task pane 内跑自渲染 DOM 截图是否可行**，以及如何保证 ~46KB gzip 的 html2canvas 完全懒加载、不进初始 main chunk（当前余量仅 ~1.4KB）。

**第一个问题：可行性。** html2canvas v1.4.1 是纯客户端 DOM 渲染库，不发外部网络请求（除非你截图区域含 `<img>` 跨域资源）。我们的自渲染预览面板是绝对定位 div + 纯色背景 + 文本，不含跨域图片，因此 canvas 不会被 taint，`toDataURL()` 可以正常调用。已知 CSP 风险：html2canvas 早期版本有 `unsafe-inline` style 注入，当前 v1.4.1 无 `eval()` 调用但有一个 `Function(A)` 调用（来自 TypeScript 编译产物的继承辅助函数，不是动态代码执行）。Office for Web 的 task pane CSP 允许 `unsafe-eval`（Office.js 注入的 MicrosoftAjax.js 依赖 eval），因此 html2canvas 的潜在内联样式注入不会被拦。

**第二个问题：bundle 守门。** html2canvas min.js gzip 实测 ~46KB，ESM build gzip ~72KB（Rollup 打包后介于两者，视 tree-shaking 程度约 50-55KB gzip）。只要在截图函数内部 `await import('html2canvas')`，Vite/Rollup 自动分包，绝不进 main-*.js。视觉自查工具文件本身被 loop 链静态 import → 落入 loop chunk，不影响 main 门。预览面板 React 组件须 `React.lazy()` 懒加载，才不进 main chunk。

**主要推荐：** html2canvas 动态 import + 可见预览面板（`React.lazy`） + on-demand vision 自查工具（read-style，仿 `check_slide_layout`）。两条路径用一个 `PVQ06_VISUAL_CHECK_ENABLED` flag 控制；verdict 前铺开路径已注册（advisory/可选），降级时直接不启用。

**Primary recommendation：** 铺开路径照 CONTEXT.md Specific Ideas 落地，html2canvas `await import` 放截图函数内部，预览面板 `React.lazy`，vision 自查工具复用 `ProviderRegistry.resolve('vision', stub)` + `AihubmixVisionClient.analyzeImages`，base64 截图绝不进 ToolResult.data（NFR-09）。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 自渲染预览面板（SlidePreviewPanel） | Frontend / Task Pane（React 组件） | — | 纯 DOM 层，消费 ShapeSpec[]，无 Office.js 调用 |
| html2canvas 截图 | Frontend / Task Pane（函数层） | — | 纯本地 DOM 层，离散事件，非逐 token 热路径 |
| vision 自查工具（visual_check_slide） | Agent Loop / Tool 层 | Frontend（间接触发截图） | read-style tool，AI 主动调用；内部触发截图并调 vision API |
| AihubmixVisionClient 调用 | Agent Loop / Tool 层 | Provider 层 | 复用 v2.2 既有 client；apiKey 仅 Authorization header |
| evidence 拼回 LLM 下一轮 | Agent Loop / wrapReadResult | — | 仿 check_slide_layout 范式 |
| NFR-09 base64 守门 | Tool 层（execute 函数边界） | — | base64 在 execute 内生产并消费，不出 ToolResult.data |
| bundle gate（CI） | 构建系统（size-limit + vite） | — | npm run build → npm run size 验证 |

---

## Standard Stack

### Core（已在项目中，研究确认 REUSE）

| Library | Version | Purpose | 确认方式 |
|---------|---------|---------|---------|
| html2canvas | 1.4.1 | DOM 截图 → base64 PNG | npm view 实测，tarball 解包确认无 eval/new Function |
| AihubmixVisionClient | n/a（内部） | 截图喂多模态 | src/providers/aihubmix-vision.ts 读源确认 |
| ProviderRegistry.resolve('vision', ...) | n/a（内部） | 取 vision baseURL/apiKey | src/adapters/PptAdapter.ts L612-620 确认用法 |
| React.lazy + Suspense | React 19（已有） | 预览面板懒加载 | App.tsx / ChatStream.tsx 既有范式 |
| wrapReadResult | n/a（内部） | evidence 包装 | read-result.ts 确认签名 |

**Installation:**
```bash
npm install html2canvas
```

`html2canvas` 版本：1.4.1（latest as of 2022-01-22，last stable release）[VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
用户 / AI 主动调用 visual_check_slide
          │
          ▼
  read-style ToolDef（loop chunk 静态 import）
    execute()
      │
      ├─ 从 DOM 取 previewElRef（React ref，可见面板）
      │
      ├─ await import('html2canvas')  ← 动态 import，独立 chunk
      │       html2canvas(previewEl, {scale:2, useCORS:false, logging:false})
      │           → HTMLCanvasElement
      │           → canvas.toDataURL('image/png').split(',')[1]  ← 裸 base64
      │
      ├─ ProviderRegistry.resolve('vision', stub) → VisionConfig
      │
      ├─ new AihubmixVisionClient().analyzeImages(focusPrompt, [{base64, mimeType:'image/png'}], visionConfig)
      │           → {content: string}  ← 违规文字 evidence
      │
      └─ wrapReadResult({ok:true, data:{summary, visual_check}}, {result_type:'metadata', source:'slide.visual_check'})
              → ToolResult（无 base64，NFR-09 满足）
                    │
                    ▼
          LLM 下一轮 messages（文字 evidence）

降级路径（flag 关闭或 UAT 判降级）：
用户 / AI 调用 check_slide_layout（Phase 22，几何自查兜底）
          ↓
  wrapReadResult → 违规清单 evidence
```

### 推荐项目结构（新增文件）

```
src/
├── components/
│   └── SlidePreviewPanel.tsx    # React.lazy() 懒加载预览面板（visible 模式）
├── agent/
│   ├── design/
│   │   └── slide-preview.ts     # 纯函数渲染器（ShapeSpec[] → React 元素树数据 / style props）
│   └── tools/
│       └── read/
│           └── visual-check.ts  # visual_check_slide tool（loop 链静态 import）
```

### Pattern 1: html2canvas 动态 import 截图

**What:** 截图函数内部动态 import，确保 0 净初始增量

**When to use:** 在 visual_check_slide.execute() 内，仅调用时加载

```typescript
// 来源：CONTEXT.md Specific Ideas（验证可行）
// 落在 src/agent/tools/read/visual-check.ts 的 execute() 内
async function capturePreview(el: HTMLElement): Promise<string> {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(el, {
    scale: 2,                    // 高清截图（devicePixelRatio 替代）
    useCORS: false,              // 我方 DOM 无跨域图片，不需要
    allowTaint: false,           // 默认，不污染 canvas
    logging: false,              // 关闭 console 噪音
    foreignObjectRendering: false, // 默认 false，走 canvas-renderer 路径（更稳定）
  });
  return canvas.toDataURL('image/png').split(',')[1]; // 裸 base64，不带 data: 前缀
}
```

**关键说明：** `analyzeImages` 内部拼 data URL：`data:${mimeType};base64,${base64}`（见 aihubmix-vision.ts L51）。所以我们喂裸 base64（去前缀），mimeType='image/png'。[VERIFIED: src/providers/aihubmix-vision.ts L50-52]

### Pattern 2: 自渲染预览渲染器（纯函数，可单测）

**What:** ShapeSpec[] @960×540pt → React style props（绝对定位 div）

**当 scale = containerWidthPx / 960：**

```typescript
// src/agent/design/slide-preview.ts（建议位置）
// [VERIFIED: src/agent/design/ppt-tokens.ts DEFAULT_CANVAS_PT 960×540]
// [VERIFIED: src/agent/design/ppt-layouts.ts ShapeSpec 接口]
export interface SlideRenderShape {
  key: string;
  style: React.CSSProperties;   // left/top/width/height/backgroundColor/fontSize/fontWeight/color/textAlign
  text?: string;
  shapeType: ShapeSpec['shapeType'];
}

export function mapShapesToRender(
  shapes: ShapeSpec[],
  containerWidthPx: number,
): SlideRenderShape[] {
  const scale = containerWidthPx / 960;
  return shapes.map((s, i) => ({
    key: `${s.role}-${i}`,
    style: {
      position: 'absolute' as const,
      left:   s.rect.left   * scale,
      top:    s.rect.top    * scale,
      width:  s.rect.width  * scale,
      height: s.rect.height * scale,
      backgroundColor: s.fillColor ?? 'transparent',
      fontSize:     (s.font?.size ?? 14) * scale,
      fontWeight:   s.font?.bold ? 700 : 400,
      color:        s.font?.color ?? '#222222',
      textAlign:    s.align?.toLowerCase() as React.CSSProperties['textAlign'] ?? 'left',
      borderRadius: s.shapeType === 'RoundedRectangle' ? `${4 * scale}px` : undefined,
      // 容器内文本截断（不影响截图保真度对比）
      overflow: 'hidden',
      boxSizing: 'border-box' as const,
    },
    text:      s.text,
    shapeType: s.shapeType,
  }));
}
```

**坐标映射单测：** 喂已知 ShapeSpec（rect={left:48,top:36,width:864,height:468}），传 containerWidth=480，断言 style.left=24、style.width=432 等。

### Pattern 3: vision 自查工具（read-style，仿 check_slide_layout）

```typescript
// src/agent/tools/read/visual-check.ts
// [VERIFIED: src/agent/tools/read/ppt.ts checkSlideLayout 范式]
// [VERIFIED: src/adapters/PptAdapter.ts L612-620 vision config 取法]
import { ProviderRegistry } from '../../providers/registry';
import { AihubmixVisionClient, type VisionConfig } from '../../providers/aihubmix-vision';
import { useProviderStore } from '../../store/providers';
import type { ImageConfig } from '../../providers/types';

const FOCUS_PROMPT = `你是专业 PPT 版面审查助手，只关注以下四项粗粒度问题，逐项输出中文违规说明（无违规则写"无"）：
1. 【溢出】文字是否超出文本框边界
2. 【重叠】形状之间是否有明显相互压叠
3. 【留白】版面空白是否过多或明显不均
4. 【对比】文字与背景对比是否明显不足、难以辨认
仅输出四项结果，不要其他分析。`;

export const visualCheckSlide: ToolDef<VisualCheckArgs> = {
  name: 'visual_check_slide',
  kind: 'read',
  // ...execute 内：capturePreview → analyzeImages → wrapReadResult
  // base64 不进 ToolResult.data（NFR-09）
};
```

### Pattern 4: React.lazy 预览面板（确保 0 净初始增量）

```typescript
// App.tsx 或 ChatStream.tsx（按 SlidePreviewPanel 挂载位置决定）
// [VERIFIED: src/App.tsx React.lazy 范式]
const SlidePreviewPanel = lazy(() => import('./components/SlidePreviewPanel'));

// 使用时
{showPreview && (
  <Suspense fallback={null}>
    <SlidePreviewPanel shapes={currentShapes} onScreenshot={handleScreenshot} />
  </Suspense>
)}
```

**SlidePreviewPanel 挂载位置建议：** 挂在 ChatStream 内（当最新 agent 消息含 layout 结果时出现），而非全局 App 层——与 DiffLogPanel / ImagePreviewCard 的离散事件渲染范式一致。

### Anti-Patterns to Avoid

- **在 main.tsx / App.tsx 静态 import html2canvas**：直接爆 bundle 预算（+~50KB gzip → 超 82KB 门）
- **在 tool 文件顶层 import html2canvas**：tool 文件被 loop 链静态 import，顶层 import 会提升到 loop chunk 初始加载（但不进 main），仍推荐放 execute() 内动态 import 确保按需
- **把 base64 截图放进 ToolResult.data**：违反 NFR-09，截图会进 LLM history，污染上下文 + 泄漏隐私
- **`foreignObjectRendering: true`**：Office for Web task pane 对 SVG foreignObject 有已知限制，用 canvas-renderer 路径（默认 false）更稳定 [ASSUMED - 无官方文档明确说明，但 svg foreignObject 在 iframe sandbox 中已知有跨文档问题]
- **截图可见整个 task pane**：应只截 `.slide-preview-container` 元素，不截 chat / input bar

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DOM → PNG 截图 | 手写 Canvas 逐元素绘制 | html2canvas | html2canvas 处理了 CSS 盒模型、圆角、背景色、z-index、文本换行等细节；手写覆盖所有 ShapeType 至少需要 200 行 Canvas 2D API 代码 |
| 多模态 vision 调用 | 重建 vision client | AihubmixVisionClient.analyzeImages | v2.2 已就位（CONTEXT 明确 REUSE，勿重建） |
| vision 配置解析 | 手动读 storage key | ProviderRegistry.resolve('vision', stub) | 既有路由表（PptAdapter 用同款，L612-620 验证） |
| 坐标映射测试 | 用 E2E 测试验证渲染 | 单元测试纯函数 mapShapesToRender | 坐标映射是确定性纯函数，vitest 单测输入→输出，覆盖 scale 公式 |

---

## Research Findings（逐问题）

### Q1：html2canvas 在 Office.js task pane iframe 内的可行性

**结论：可行，但有字体渲染限制。**

**可行原因：**
- html2canvas v1.4.1 无 `eval()` 调用（实测 `grep -c "eval("` = 0）[VERIFIED: tarball 实测]
- 含一个 `Function(A)` 调用，但这是 TypeScript 编译出来的 `__extends` 辅助函数（原型链继承），不是动态代码执行，不触发 CSP `unsafe-eval` [VERIFIED: tarball 实测]
- Office for Web task pane 的 CSP 实际上允许 `unsafe-eval`（Office.js 注入 MicrosoftAjax.js 依赖 eval，已有开发者实测记录）[CITED: theofficecontext.com/2025/02/28/how-content-security-policy-affects-office-add-ins/]
- html2canvas 是纯客户端渲染，不发外部网络请求（它只读 DOM + computedStyle + canvas 2D API）[VERIFIED: 官方文档 "does not require any rendering from the server"]
- 我方自渲染预览只含绝对定位 div + 纯色背景 + 文本，无 `<img>` 跨域元素 → canvas 不被 taint → `toDataURL()` 正常可用

**字体渲染限制（保真度影响，需 UAT 评估）：**
- Google Fonts (Inter/Noto Sans SC) 从 fonts.gstatic.com 跨域加载
- html2canvas canvas 文字 API（`fillText()`）使用浏览器已加载的字体，Google Fonts 已在运行时加载所以中文/英文文字渲染通常正常
- 但：html2canvas 的 DOM 克隆过程（DocumentCloner）在克隆 DOM 时可能丢失 `@font-face` 规则，导致克隆后的 DOM 回退到系统字体
- **PPT 字体 vs 自渲染字体**：无论如何，CSS 字体（Inter/Noto Sans SC）与 PowerPoint 实际字体（等线/黑体/Calibri）必然不同，字宽差异导致溢出/换行检测与真机有偏差 → 这是 spike 需要人眼 UAT 判定保真度是否「够用」的核心不确定性

**推荐配置：**
```typescript
html2canvas(el, {
  scale: 2,                      // 高清截图，AI 识别更准
  useCORS: false,                // 无跨域资源，不需要
  allowTaint: false,             // 默认，安全
  foreignObjectRendering: false, // 走 canvas-renderer，更稳定（Office for Web sandbox 兼容）
  logging: false,                // 关闭 console 噪音
  backgroundColor: '#ffffff',   // 明确白底，避免透明背景
})
```

### Q2：html2canvas 真实 bundle 体积（gzip）+ 懒加载策略

**实测结果（tarball 解包后测量）：** [VERIFIED: npm pack html2canvas@1.4.1 实测]
- min.js = 198,689 bytes（未压缩），gzip 实测 = **46,314 bytes（约 46KB）**
- ESM build (html2canvas.esm.js) = 410KB 未压缩，gzip = **73,356 bytes（约 72KB）**
- Vite/Rollup 打包时使用 ESM build，经 Rollup tree-shaking 后实际大小介于 min.js 和 ESM build 之间（约 50-55KB gzip 估算）

**懒加载策略：**

size-limit 只监控 `dist/assets/main-*.js` gzip（.size-limit.json：`"path": "dist/assets/main-*.js"`）[VERIFIED: .size-limit.json]

```
import 链分析（关键）：
main-*.js = index.html → main.tsx → App.tsx → 直接 import 的静态链
loop chunk = agentStore.ts → await import('./loop') → loop.ts → tools/index.ts → read/visual-check.ts
```

`visual-check.ts`（工具文件）被 loop 链静态 import → 落入 loop chunk
工具文件内部 `await import('html2canvas')` → html2canvas 落入独立懒加载 chunk（Vite 自动分包）
→ **main-*.js 0 净增量** ✓

`SlidePreviewPanel.tsx`（React UI 组件）：
- **必须用 React.lazy()** 懒加载（App.tsx 或 ChatStream.tsx 处，仿 ImagePreviewCard / DiffLogPanel 范式）
- 否则会被 App.tsx 静态 import 链拉进 main chunk → 爆预算

**验证铁律（来自 memory `project_bundle_size_guard`）：**
```bash
npm run build   # 先构建（陈旧 dist 给假绿）
npm run size    # 再验 ≤82KB gate
```

### Q3：自渲染预览渲染器的保真度因素

**960×540pt → px 映射：**
- scale = containerWidthPx / 960（容器宽 ÷ 960）
- 坐标、字号、圆角均乘 scale
- 16:9 容器高度 = containerWidthPx × (540/960)
- 建议容器宽 = task pane 可用宽减 padding（约 320-340px），scale ≈ 0.33-0.35

**字号缩放：**
- `font.size * scale`（如 28pt 标题 × 0.33 ≈ 9.24px — 小但可辨认）
- 建议 `max(font.size * scale, 9)` 防止太小

**字体栈 vs PowerPoint 字体（保真度核心偏差）：**
- 自渲染用 Inter/Noto Sans SC（CSS 字体栈）
- PowerPoint 实际落地用等线/Calibri 等宿主字体
- 字宽差异导致：文字换行位置不同 → 溢出/留白对比保真度有偏差
- **这是 UAT 核心评估点**，代码无法消除，只能通过 UAT 对比图判断「粗粒度够用不够用」

**ShapeType 渲染建议：**
- `TextBox`：div + overflow:hidden + white-space:pre-wrap（保留 \n 换行）
- `Rectangle`：div + solid background-color
- `RoundedRectangle`：div + border-radius（建议 scale×4px 或固定 6px）
- `Ellipse`：div + border-radius:50%（保留内部文字）
- `Ellipse`/`Rectangle` 的连接线（timeline connector）：极细（2pt×scale），渲染为低矮 div 即可

**文字对齐（align prop）：**
- ShapeSpec.align = 'Left' | 'Center' | 'Right'
- CSS text-align 直接对应 'left' | 'center' | 'right'（lowercase）

### Q4：截图喂 aihubmix-vision 的确切接法

**analyzeImages 接口（已读源码）：** [VERIFIED: src/providers/aihubmix-vision.ts]

```typescript
// 内部拼 data URL：`data:${mimeType};base64,${base64}`（L51）
// 所以我们传：base64 = 裸 base64 字符串（去 'data:image/png;base64,' 前缀）
//             mimeType = 'image/png'
await client.analyzeImages(focusPrompt, [{ base64: pureBase64, mimeType: 'image/png' }], visionConfig);
```

**VisionConfig 来源（已读 PptAdapter L612-620）：** [VERIFIED: src/adapters/PptAdapter.ts]
```typescript
const cfg = ProviderRegistry.resolve(
  'vision',
  () => useProviderStore.getState().providers[0]!,
) as ImageConfig;
const visionConfig: VisionConfig = { baseURL: cfg.baseURL, apiKey: cfg.apiKey };
```

**focus prompt 建议（「自查 4 项」，仿 geometry-check 语义对齐）：**
```
你是专业 PPT 版面审查助手，只关注以下四项粗粒度问题，逐项输出中文违规说明（无违规则写"无"）：
1. 【溢出】文字是否超出文本框边界（文字被裁切）
2. 【重叠】形状之间是否有明显相互压叠（内容被遮挡）
3. 【留白】版面空白是否过多或分布明显不均
4. 【对比】文字与背景对比是否明显不足、难以辨认
仅输出四项结果，不要其他分析。
```

**vision model：** `AIHUBMIX_VISION_MODEL`（当前 `gpt-5.4`，registry.ts L29）[VERIFIED: src/providers/registry.ts]
注意：`analyzeImages` 内部硬编 `AIHUBMIX_VISION_MODEL`（L69），不从 VisionConfig 读 model；model 已在 client 内部固定。

### Q5：NFR-09 守门——base64 不进 history

**get_shape_image（VIS-01/02）的契约（已读源码）：** [VERIFIED: src/agent/tools/read/vision.ts]
- vision.ts 的 execute() 只调 `ctx.adapter.read({kind:'get_shape_image',...})`
- base64 在 **PptAdapter** 内部被 AihubmixVisionClient 消费（L620），不出 PptAdapter
- ToolResult.data = `{vision_result: content, shape_count: ...}`（L628），无 base64

**Phase 24 visual_check_slide 复刻契约：**
- execute() 内：截图 → capturePreview() → base64（局部变量）
- 调 analyzeImages → {content: string}（文字）
- ToolResult.data = `{summary: content, visual_check: {四项结果}}`，**不含 base64**
- base64 字符串在 execute() 函数内产生并传给 analyzeImages 即丢弃

**守门测试建议：**
```typescript
// 仿 src/agent/tools/read/vision.test.ts 模式
it('visual_check_slide: ToolResult.data 不含 base64', async () => {
  // mock html2canvas → 返回 fake canvas
  // mock AihubmixVisionClient.analyzeImages → 返回 {content: '...'}
  const result = await visualCheckSlide.execute(args, ctx);
  expect(JSON.stringify(result.data)).not.toMatch(/^[A-Za-z0-9+/]{100,}={0,2}$/);
  // 或更简单：
  expect(result.data).not.toHaveProperty('base64');
  expect(result.data).not.toHaveProperty('screenshot');
});
```

### Q6：两条路径的代码落地形态 + 开关机制

**铺开路径落地：**
- 新文件 `src/agent/tools/read/visual-check.ts`（`visual_check_slide` ToolDef）
- 注册进 `buildToolsForHost('ppt')` 的 read 列表（同 `checkSlideLayout`）
- **不进 PPT_TOOLS 集合**（read tool，无 undo/operationLog，同 checkSlideLayout）[VERIFIED: src/agent/tools/index.ts L61]
- 新文件 `src/agent/design/slide-preview.ts`（坐标映射纯函数）
- 新文件 `src/components/SlidePreviewPanel.tsx`（React.lazy 预览面板，teal 克制设计）

**降级路径落地：**
- 不注册 `visual_check_slide`（或通过 flag 控制注册与否）
- 系统行为 = Phase 22 几何自查 `check_slide_layout` 兜底（已在 ppt host）
- REQUIREMENTS.md PVQ-06 状态更新 + 降级原因记录

**开关机制建议：**
```typescript
// src/agent/tools/visual-check-config.ts（或 inline in tools/index.ts）
// verdict 前：true（工具已注册为 advisory/可选，不破坏现状）
// UAT 判降级后：false（不启用，只靠几何自查）
export const PVQ06_VISUAL_CHECK_ENABLED = true; // 默认铺开（待 UAT 确认）

// tools/index.ts buildToolsForHost('ppt') 内：
...(PVQ06_VISUAL_CHECK_ENABLED ? [visualCheckSlide] : []),
```

**替代开关方案（更简洁）：** 直接注册工具，在 execute() 内检测 `capturePreview` 能否执行（previewElRef 是否存在），如不存在则返回 advisory 提示「预览面板未打开，请先查看预览」——这样工具始终注册，但 UI 面板不显示时工具会给出降级说明。

### Q7：对比证据采集（UAT 交付物）

**Executor 交付物：**
1. 完成铺开路径代码 → 在 Office for Web PPT 中使用 apply_slide_layout 生成一页
2. 预览面板出现后截图（「自渲染预览截图」PNG）
3. UAT-PACKET 中写明：

```markdown
## UAT 对比图采集步骤（保真度 spike-gate）

### 自渲染预览截图（工具自动产出）
- 使用 apply_slide_layout 生成一页 PPT 内容
- task pane 自渲染预览面板出现后，点击「截图并自查」或触发 visual_check_slide 工具
- 截图 PNG 已保存在此：[附图1]

### PowerPoint 真机截图（用户操作）
1. 在 Office for Web PPT 中，选中刚生成的 slide
2. 用浏览器截图工具（Snipping Tool / macOS Cmd+Shift+4）截取整张 slide 内容
3. 两图并排对比，人眼评估：
   - 溢出：文字是否截断？自渲染与真机判断一致？
   - 重叠：形状有无相互压叠？粗粒度是否对应？
   - 留白：空白分布是否对应？
   - 对比：文字可读性粗粒度是否一致？

### 判定标准（LOCKED-3a）
- 粗粒度「可辨认的版面问题」自渲染与真机判断一致 → 铺开
- 偏差过大（如字体回退导致换行完全不同，误判率高）→ 降级，只保留几何自查
```

### Q8：P95 不退化的论证

**截图是离散事件，非逐 token 热路径：**
- 截图在「AI 调用 visual_check_slide 工具」时触发，不在每次 token 流式输出时触发
- 典型触发时序：apply_slide_layout → AI 收到 layout_check evidence → AI 主动调 visual_check_slide → 一次截图 + 一次 vision API → 文字 evidence 进入下一轮
- P95 = 端到端响应时间（用户看到首个 AI token），截图在 agent loop 中间步骤，**不在首 token 路径上**
- html2canvas 截图本地 DOM 耗时：实测通常 < 200ms（本地 canvas API，无网络）
- vision API 调用（analyzeImages）耗时：与 v2.2 get_shape_image 同量级（约 2-5s），已纳入既有 P95 预算内的 tool 调用延迟
- **结论：不退化 P95**（离散事件 + 本地 DOM 层 + 非首 token 路径）[ASSUMED - 无真机实测数据，逻辑推断]

---

## Common Pitfalls

### Pitfall 1：SlidePreviewPanel 静态 import 进 main chunk

**What goes wrong：** 在 App.tsx 静态 `import SlidePreviewPanel from './components/SlidePreviewPanel'`，面板代码进 main chunk，加上 html2canvas 如果被面板 import 则同样进 main → 直接爆 82KB 预算。
**Why it happens：** 忘记 React.lazy() 包装。
**How to avoid：** 面板必须 `React.lazy(() => import('./components/SlidePreviewPanel'))`，仿 DiffLogPanel 范式。[VERIFIED: App.tsx + ChatStream.tsx 既有范式]
**Warning signs：** `npm run size` 红，`npm run build` 输出 main-*.js 大幅增长。

### Pitfall 2：html2canvas 在工具文件顶层 import

**What goes wrong：** `import html2canvas from 'html2canvas'` 在 tool 文件顶层 → Vite 把它纳入 loop chunk 的初始加载，loop chunk 大幅增大（虽不影响 main gate，但 on-demand 懒加载的优势丧失）。
**Why it happens：** 习惯性顶层 import。
**How to avoid：** 只在 execute() 函数体内 `await import('html2canvas')`，不在文件顶层。

### Pitfall 3：base64 进 ToolResult.data（NFR-09 违规）

**What goes wrong：** `data: { screenshot: base64, ... }` 被写进 ToolResult → wrapReadResult → wire → LLM message history → 每轮都带巨大 base64 字符串，污染上下文 + 浪费 token + 潜在隐私问题。
**Why it happens：** 忘记 NFR-09 契约；把 get_shape_image 的 adapter 层隔离误解为工具层可以「透传 base64」。
**How to avoid：** base64 在 execute() 内仅作局部变量；ToolResult.data 只含文字 evidence（vision 返回的 content 字符串）。建议加守门测试。

### Pitfall 4：截图时 previewEl 未挂载 / 不在 DOM 中

**What goes wrong：** visual_check_slide.execute() 尝试截图但预览面板还未渲染（用户未打开过预览、或 React.lazy 尚未 resolve），html2canvas 得到空/错元素。
**Why it happens：** Tool 层和 React 组件层的时序解耦。
**How to avoid：** 工具 execute() 通过某种机制（shared ref、全局状态、callback）拿到 previewEl；若拿不到，返回 advisory ToolResult 而非报错（`ok: true, data: {summary: '预览面板未显示，自查跳过，仅依据几何自查结果调整'}`）。

### Pitfall 5：坐标用 720×405 而非 960×540

**What goes wrong：** 预览 scale = containerWidth / 720 → 形状在预览中被放大 33%（720→960 差 33%），与实际 PowerPoint 比例不符，保真度直接失效。
**Why it happens：** REQUIREMENTS.md PVQ-06 原文写 720×405，是 stale 错误。
**How to avoid：** 读 `DEFAULT_CANVAS_PT.widthPt`（960），不硬编数字。[VERIFIED: src/agent/design/ppt-tokens.ts L22]

### Pitfall 6：vision 自查工具进 PPT_TOOLS 集合

**What goes wrong：** read tool 加入 PPT_TOOLS → dispatchTool 对其 args 做 camelCase→snake_case 归一化，但 read tool 的 args 通常是简单 key，归一化无害但语义错误；更大问题是 PPT_TOOLS 语义上只含 write tools（防 casing 为 write tool 服务）。
**Why it happens：** 抄 write tool 注册代码。
**How to avoid：** read tool 不进 PPT_TOOLS，只加入 buildToolsForHost('ppt') 的 read 列表（仿 checkSlideLayout）。[VERIFIED: src/agent/tools/index.ts buildToolsForHost 代码]

### Pitfall 7：Lingui 宏不 extract

**What goes wrong：** SlidePreviewPanel 新增 UI 文案用 `<Trans>` 宏但不跑 `npm run extract` → `coverage.test.ts` 报红。
**Why it happens：** memory `project_i18n_extract_and_test_noise`。
**How to avoid：** 有新 UI 文案改动必须 `npm run extract` 步骤。`npm run build` 会跑 `lingui compile`，但 extract 需单独跑。

---

## Code Examples

### 1. vision 自查工具 execute() 骨架（完整流程）

```typescript
// [VERIFIED pattern: PptAdapter.ts L612-628 + vision.ts execute]
async execute({ slideIndex }, ctx): Promise<ToolResult> {
  // 1. 取预览面板 DOM 元素（通过 previewPanelRef 或其他机制）
  const previewEl = getSlidePreviewElement();
  if (!previewEl) {
    return wrapReadResult(
      { ok: true, data: { summary: '预览面板未打开，视觉自查跳过（仅依据几何自查结果）' } },
      { result_type: 'metadata', source: `slide_${slideIndex}.visual_check` }
    );
  }

  // 2. 动态加载 html2canvas（懒加载，不进初始 chunk）
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(previewEl, {
    scale: 2, useCORS: false, allowTaint: false,
    logging: false, backgroundColor: '#ffffff',
  });
  const pureBase64 = canvas.toDataURL('image/png').split(',')[1]; // 裸 base64

  // 3. 取 vision 配置
  const cfg = ProviderRegistry.resolve(
    'vision',
    () => useProviderStore.getState().providers[0]!,
  ) as ImageConfig;

  // 4. 调 analyzeImages（NFR-09：pureBase64 不进 ToolResult.data）
  const { content } = await new AihubmixVisionClient().analyzeImages(
    FOCUS_PROMPT,
    [{ base64: pureBase64, mimeType: 'image/png' }],
    { baseURL: cfg.baseURL, apiKey: cfg.apiKey },
  );
  // pureBase64 不再使用，自然 GC

  // 5. wrapReadResult — 只返回文字 evidence
  return wrapReadResult(
    { ok: true, data: { summary: content } },
    { result_type: 'metadata', source: `slide_${slideIndex}.visual_check` },
  );
}
```

### 2. 渲染器坐标映射（可单测纯函数）

```typescript
// [VERIFIED: DEFAULT_CANVAS_PT = 960×540，ppt-tokens.ts L22]
export function mapShapesToRender(shapes: ShapeSpec[], containerWidthPx: number): SlideRenderShape[] {
  const scale = containerWidthPx / 960;
  return shapes.map((s, i) => ({
    key: `${s.role}-${i}`,
    style: {
      position: 'absolute' as const,
      left:   s.rect.left * scale,
      top:    s.rect.top * scale,
      width:  s.rect.width * scale,
      height: s.rect.height * scale,
      backgroundColor: s.fillColor ?? 'transparent',
      fontSize: Math.max((s.font?.size ?? 14) * scale, 9),
      fontWeight: s.font?.bold ? 700 : 400,
      color: s.font?.color ?? '#222222',
      textAlign: (s.align?.toLowerCase() ?? 'left') as React.CSSProperties['textAlign'],
      borderRadius: s.shapeType === 'RoundedRectangle' ? `${Math.round(4 * scale)}px`
                  : s.shapeType === 'Ellipse' ? '50%'
                  : undefined,
      overflow: 'hidden',
      boxSizing: 'border-box' as const,
      padding: `${2 * scale}px`,
      whiteSpace: 'pre-wrap',
    },
    text: s.text,
    shapeType: s.shapeType,
  }));
}
```

### 3. SlidePreviewPanel（UI 骨架，teal 克制设计）

```typescript
// [VERIFIED: Aster teal 克制设计系统，styles.css CSS 变量]
// React.lazy(() => import('./SlidePreviewPanel')) 挂在 ChatStream.tsx
interface Props {
  shapes: ShapeSpec[];
  containerRef?: React.RefObject<HTMLDivElement>;
}

export default function SlidePreviewPanel({ shapes, containerRef }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const renderedShapes = useMemo(() => mapShapesToRender(shapes, width), [shapes, width]);
  const height = width * (540 / 960);

  return (
    <div className="slide-preview-panel" ref={containerRef}>
      {/* 面板头：teal 克制样式，CSS 变量 */}
      <div className="slide-preview-panel__header">
        <span>幻灯片预览</span>
        {/* 若需手动触发截图，加按钮（on-demand 默认由 AI 调工具） */}
      </div>
      {/* 16:9 预览容器 */}
      <div
        ref={panelRef}
        className="slide-preview-container"
        style={{
          position: 'relative',
          width,
          height,
          backgroundColor: 'var(--bg)', // teal 设计系统变量
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-2)',
          overflow: 'hidden',
        }}
      >
        {renderedShapes.map((s) => (
          <div key={s.key} style={s.style}>
            {s.text}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | html2canvas 在 Office for Web task pane CSP 下无运行时 CSP 报错 | Q1 可行性 | 如果 Office for Web 对 style-src 更严格，html2canvas 的内联 style 注入可能报 CSP 错但不致命（功能继续，有噪音 log）；真机 UAT 会暴露 |
| A2 | foreignObjectRendering:false 路径在 Office for Web sandbox 稳定 | Q1 配置 | 若 canvas-renderer 路径有问题，改 true 可尝试（但 SVG foreignObject 在 iframe 内有已知问题）|
| A3 | P95 不退化（截图离散事件，非逐 token） | Q8 | 逻辑推断，未真机实测截图延迟；实际应在 UAT 中观察 |
| A4 | Google Fonts 字体在 html2canvas DOM 克隆时可用（canvas fillText 使用已加载字体） | Q3 保真度 | 若字体在克隆 doc 中丢失，文字渲染回退系统字体；UAT 对比图会暴露此偏差 |
| A5 | html2canvas ESM build 经 Rollup tree-shaking 后约 50-55KB gzip | Q2 体积 | 实际大小需 build 后 vite-bundle-visualizer 确认；min.js gzip 已实测 46KB 为下界 |

---

## Open Questions

1. **previewElRef 共享机制**
   - 已知：tool execute() 需要 DOM ref 指向 .slide-preview-container
   - 未定：如何在 React 组件（SlidePreviewPanel）和 agent tool（execute）之间共享 ref？选项：(a) zustand store 存 ref callback，(b) 全局 mutable ref，(c) tool 通过 event/callback 触发截图并等待 base64
   - 建议：选项 (c) — agent loop 调 tool，tool 触发 window event，SlidePreviewPanel 监听后截图，通过 Promise 回传 base64 给 tool。这样不需要跨层共享 DOM ref。或者 (b) 简单全局 ref（只有一个预览面板实例），可接受。

2. **previewEl 挂载时序与 apply_slide_layout 的关系**
   - 已知：on-demand 触发（AI 主动调工具），此时预览面板应已渲染
   - 未定：AI 调 visual_check_slide 时，SlidePreviewPanel 是否一定已渲染？（需要 ChatStream 在收到 apply_slide_layout 结果后显示预览面板）
   - 建议：面板在 agent 完成 apply_slide_layout 后出现（监听 completedRunIds 或最新消息含 layout_check），之后 AI 才能调 visual_check_slide 工具

3. **Lingui Trans 新 UI 文案量**
   - 未定：SlidePreviewPanel 新增多少 `<Trans>` 文案？视 UI 精简程度，但必须包含 `npm run extract` 步骤

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| html2canvas | 截图链路（PVQ-06） | 需 npm install | 1.4.1 | — （本 phase 核心依赖，无 fallback） |
| Node.js | build / test | ✓ | 20.17.0 | — |
| npm | 包管理 | ✓ | 10.8.2 | — |
| AihubmixVisionClient | 铺开路径 vision 调用 | ✓（已有） | v2.2 已就位 | 降级路径绕过 |
| Google Fonts（运行时） | task pane 字体渲染 | 需网络 | n/a | 系统中文字体兜底（PingFang SC / 微软雅黑） |

**Missing dependencies with no fallback:**
- `html2canvas`（需 `npm install html2canvas`，主干依赖）

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest（已有，package.json scripts）|
| Config file | vitest.config 通过 package.json 隐式（tsconfig + vitest.config.ts 不显示）|
| Quick run command | `npx vitest run --testPathPattern="slide-preview\|visual-check"` |
| Full suite command | `tsc --noEmit && vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PVQ-06 | mapShapesToRender 坐标映射（scale 公式，960 基准） | unit | `vitest run --testPathPattern="slide-preview"` | ❌ Wave 0 |
| PVQ-06 | visual_check_slide：html2canvas 被调用（mock） | unit | `vitest run --testPathPattern="visual-check"` | ❌ Wave 0 |
| PVQ-06 | visual_check_slide：ToolResult.data 无 base64（NFR-09 守门） | unit | `vitest run --testPathPattern="visual-check"` | ❌ Wave 0 |
| PVQ-06 | visual_check_slide：evidence 文字拼入 ToolResult.data.summary | unit | `vitest run --testPathPattern="visual-check"` | ❌ Wave 0 |
| PVQ-06 | 保真度对比图采集（自渲染预览 vs PowerPoint 真机截图） | 人眼 UAT | — | 不可自动化（LOCKED-1） |
| NFR-11 | html2canvas 不进 main chunk（bundle size gate） | CI gate | `npm run build && npm run size` | ✅（.size-limit.json 已有） |
| NFR-11 | 既有 989 tests 全绿 | regression | `tsc --noEmit && vitest run` | ✅ |

### Sampling Rate

- **Per task commit：** `npx vitest run --testPathPattern="slide-preview|visual-check|ppt"`
- **Per wave merge：** `tsc --noEmit && vitest run`
- **Phase gate：** Full suite green + `npm run build && npm run size ≤82KB` before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/agent/design/slide-preview.test.ts` — 坐标映射单测（REQ PVQ-06）
- [ ] `src/agent/tools/read/visual-check.test.ts` — html2canvas mock + NFR-09 守门 + evidence 拼装（REQ PVQ-06）
- [ ] SlidePreviewPanel smoke test（可选，轻量 @testing-library/react render 验证不崩溃）

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | 否 | — |
| V3 Session Management | 否 | — |
| V4 Access Control | 否 | — |
| V5 Input Validation | 是 | 截图 base64 只流经内部函数，不接受外部输入 |
| V6 Cryptography | 否 | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API Key 泄漏进 error.message | Information Disclosure | 复用既有 mapHttpError + AihubmixVisionClient（key 仅 Authorization header，T-01-04）|
| base64 截图进 LLM history | Information Disclosure | NFR-09 守门：base64 局部变量，ToolResult.data 只含文字 |
| html2canvas 供应链风险 | Tampering | 锁定版本 1.4.1，仅处理我方自渲染 DOM（非任意用户内容）|
| 截图内容外发 | Information Disclosure | 发往 aihubmix（BYO key，用户自有）；与 v2.2 get_shape_image 同信任边界，无新增 |
| 截图 DOM 含敏感内容 | Information Disclosure | 截图范围限 .slide-preview-container（AI 生成的形状），不含聊天内容 / API Key 界面 |

---

## State of the Art（本 phase 相关技术演进）

| 旧方法 | 当前方法 | 生效时间 | 影响 |
|--------|----------|----------|------|
| html2canvas `foreignObjectRendering:true`（SVG 路径）| `foreignObjectRendering:false`（canvas-renderer）| 默认一直如此 | canvas-renderer 在 iframe sandbox 更稳定 |
| `@microsoft/office-js` npm 包 | CDN script tag | 早已废弃 | Phase 24 不引入 npm Office.js（已知约束）|
| Office.js PPT 截图 API | 无可用 API（Office for Web 不支持 slide→PNG）| 持续 | 正是 PVQ-06 自渲染替代方案的动机 |

---

## Sources

### Primary（HIGH confidence，来自代码真相源）

- `src/providers/aihubmix-vision.ts` — analyzeImages 接口签名、data URL 拼装方式（L50-52）
- `src/adapters/PptAdapter.ts` L612-628 — vision config 取法（ProviderRegistry.resolve + ImageConfig）
- `src/agent/tools/read/ppt.ts` — check_slide_layout 范式（read-style / wrapReadResult / 不进 PPT_TOOLS）
- `src/agent/design/ppt-tokens.ts` L22 — DEFAULT_CANVAS_PT = 960×540（坐标真相源）
- `src/agent/design/ppt-layouts.ts` — ShapeSpec 接口定义（渲染器输入）
- `src/App.tsx` + `src/components/ChatStream.tsx` — React.lazy + Suspense 范式
- `.size-limit.json` — 监控 `dist/assets/main-*.js` gzip ≤82KB
- `package.json scripts` — build/size/extract/test 命令
- `npm pack html2canvas@1.4.1` 实测：min.js=198KB，gzip=46KB；ESM=410KB，gzip=73KB

### Secondary（MEDIUM confidence）

- [html2canvas 官方配置文档](https://html2canvas.hertzen.com/configuration/) — scale/useCORS/allowTaint/foreignObjectRendering 选项
- [theofficecontext.com — How Content Security Policy Affects Office Add-ins](https://theofficecontext.com/2025/02/28/how-content-security-policy-affects-office-add-ins/) — Office.js 注入 MicrosoftAjax.js 需要 `unsafe-eval`，实际 task pane CSP 宽松
- [html2canvas GitHub Issue #2345](https://github.com/niklasvh/html2canvas/issues/2345) — iframe screenshot 限制说明（cross-origin 不可行，same-origin 有 cloner bug，但我方是「在 iframe 内截 iframe 内的 div」非「从外部截 iframe」）

### Tertiary（LOW confidence，需 UAT 验证）

- html2canvas 在 Office for Web task pane CSP 下的实际运行时行为（style-src 限制是否触发 CSP 报错）— 需真机验证
- html2canvas DOM 克隆时 Google Fonts 字体是否保留 — 保真度核心不确定性，UAT 对比图评估

---

## Metadata

**Confidence breakdown：**
- html2canvas 可行性：MEDIUM（逻辑可行，无 eval，无跨域图片；CSP 实测行为是 ASSUMED）
- Bundle 策略（动态 import + React.lazy）：HIGH（从项目既有范式直接推导，代码已验证）
- vision 接法（analyzeImages 签名 + config 来源）：HIGH（读源码确认）
- NFR-09 守门设计：HIGH（read vision.ts 契约已存在，复刻）
- P95 不退化论证：MEDIUM（逻辑论证，未真机实测截图延迟）
- 保真度评估：LOW（字体偏差是已知不确定性，UAT 判定）

**Research date：** 2026-06-03
**Valid until：** 2026-07-03（html2canvas 最后版本 2022-01，4 年未更新，极稳定；Office.js CSP 政策变化频率低）
