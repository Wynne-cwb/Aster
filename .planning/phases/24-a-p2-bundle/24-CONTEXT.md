# Phase 24: A P2 自渲染预览 + bundle 守门 — Context

**Gathered:** 2026-06-03
**Status:** Ready for planning
**Source:** Discuss harvest (Phase 20-24，task #7 已完成) — 本 CONTEXT 由 Team Lead 交接的 LOCKED 决策 + planner 代收的代码级事实物化而成（discuss-phase 已做，无需再开 discuss TeamMate）。

<domain>
## Phase Boundary

milestone v2.3「精装与定力」的**最后一个实现 phase**（A 系列 P2）。目标：

> **Spike 验自渲染预览保真度** —— 在 task pane 用绝对定位 div 按 16:9 等比缩放重建 slide 预览，用 `html2canvas`（动态 import 懒加载）截图；**保真度够用则**接入「自渲染截图 → 多模态自查（搭 v2.2 aihubmix-vision）→ 违规文字反馈拼回 LLM 下一轮 messages」闭环；**不够用则诚实降级**，仅保留 Phase 22 几何自查兜底。全程 bundle CI gate（initial main ≤82KB gzip）维持。

**关键性质：这是 spike phase + 分支路径（铺开/降级）+ 新 UI + 全项目最紧 bundle 约束（余量 ~1.4KB）→ 高风险 phase。**

### 本 phase 在做 / 不在做

**在做（executor 的明确交付物）：**
1. 自渲染预览 spike：ShapeSpec[]（960×540pt 坐标）→ 绝对定位 div、按 16:9 等比缩放铺满容器、坐标按 960×540 映射的渲染器（纯数据→DOM，可单测）。
2. `html2canvas` 截图链路：**动态 import 懒加载**，把自渲染预览 div 截成 PNG base64。
3. **对比证据采集**：截「自渲染预览截图 vs PowerPoint 真机截图」对比图，放进**最终统一 UAT 包**，由用户人眼判定「铺开 or 降级」。
4. **铺开路径代码**（落地但 verdict 走 UAT 后启用）：自渲染截图 base64 → 复用 `AihubmixVisionClient.analyzeImages` → 「自查 4 项」(溢出/重叠/留白/对比) focus prompt → 文字违规反馈 → 拼入 LLM 下一轮 messages 作 evidence；Office for Web PPT 真机端到端可用。
5. **降级路径代码 + 文档**（落地但 verdict 走 UAT 后回退）：诚实记录降级原因、仅留 Phase 22 PVQ-02 几何自查兜底、REQUIREMENTS.md 状态更新机制 + 告知用户的话术。
6. bundle CI gate 维持：`html2canvas` 0 净初始增量；build→size 验证 ≤82KB；undo gate / P95 三项 CI gate 全绿。

**不在做（边界）：**
- **绝不在 phase 内自行判定保真度够不够用，绝不中途打断用户。** verdict = 人眼判断（LOCKED #1），结构上无法自动化 → 留最终统一 UAT。
- 不把 spike-gate 人眼判定写成自动 pass/fail 测试或断言——它是 UAT 证据采集，不是 assertion。
- 不新增 PPT write 工具（不涉及新 inverse；但既有 undo gate 不能破）。
- 不重建 vision provider（v2.2 已就位，REUSE）。
- 不动 Phase 22 geometry-check.ts / Phase 23 ppt-layouts.ts 的既有逻辑（可 import 复用，不改既有契约）。

</domain>

<decisions>
## Implementation Decisions（LOCKED — 来自 discuss harvest，DO NOT re-litigate）

### LOCKED-1：spike-gate verdict = 人眼判断，留最终统一 UAT（STATE L168）
- 结构上无法自动化。Executor 的交付 = 建好自渲染预览 spike + html2canvas 截图链路 + **截「自渲染预览 vs PowerPoint 真机截图」对比图**，放进最终 UAT 包由用户定「铺开 or 降级」。
- **PLAN 必须让这条对比证据成为 executor 的明确交付物**（如一个产出对比图/截图的步骤或脚本/UI 动作，外加 UAT-PACKET 条目说明如何采集 PowerPoint 端截图）。
- 绝不在 phase 内自行判定够不够用，也不中途打断用户。

### LOCKED-2：必须同时规划两条路径（ROADMAP SC#2 铺开 / SC#3 降级）
- **铺开**：自渲染截图喂多模态（搭 v2.2 aihubmix-vision），用「自查 4 项」清单输出违规文字反馈，evidence 拼进 LLM 下一轮 messages，Office for Web PPT 真机端到端。
- **降级**：诚实记录原因、仅留 Phase 22 几何自查兜底、REQUIREMENTS.md 更新状态。
- **两条路径的代码都应能落地**，verdict 走 UAT 后由后续 follow-up 选择启用/回退。即铺开路径默认**不破坏现状**——它是一个可被启用/关闭的能力，关闭时系统行为 == 降级（只剩几何自查）。

### LOCKED-3：3 个可调项 fold into UAT — 不写死，设默认值 + 留观察空间（STATE L171）
planner 定的默认值（不阻塞，UAT 可调）：

| 可调项 | 默认值（本 phase 定） | 理由 / 留的观察空间 |
|--------|----------------------|---------------------|
| (a) 保真度门槛 | **人眼粗粒度可辨认**：溢出/重叠/留白/对比四项能从「自渲染 vs PowerPoint」对比图中辨认出来即「够用」。**无数值 gate**。 | 定性、UAT 判定；不写自动断言。UAT 可上调（如要求像素级）或下调。 |
| (b) vision 自查触发 = auto / on-demand | **on-demand**：作为 AI 可主动调用的工具（仿 `check_slide_layout` 既有范式），默认不在每次 apply_slide_layout 后 auto 触发。 | 省 vision API 往返 & 延迟、不污染每次生成；架构留 auto-trigger 开关（一个 flag/分支），UAT 若判定「该自动」可翻成 auto（产线目标可能是 auto，初值 on-demand 先验证）。 |
| (c) 预览渲染 = visible / offscreen | **visible**：teal 克制小预览面板（离散事件渲染，非逐 token），既满足 spike 人眼对比、又契合 UI hint=yes、还可作产品雏形。 | html2canvas 截可见面板。UAT 若判定面板干扰可改 offscreen（detached/hidden 容器仅供截图）。**渲染是离散事件（出一页 layout 时），不在 LLM 流式热路径上 → 不碰 P95。** |

### LOCKED-4：坐标真相源 = 960×540pt（Phase 22 DEFAULT_CANVAS_PT）
- ⚠️ **ROADMAP SC#1 文字里写的「720×405pt」是 STALE**（与 Phase 22 已改的 `DEFAULT_CANVAS_PT = 960×540` 不一致；二者同为 16:9）。Phase 22 ppt-tokens.ts 注释明确：720×405 是旧 10in 残留的错误基准，用它会让右半屏形状全被误判越界。
- 预览 div 按 **16:9 等比缩放铺满容器**，坐标按 **960×540** 映射（缩放因子 = 容器宽 / 960）。
- 计划里以 **960×540** 为准；CONTEXT 已注明此处 ROADMAP 文字 stale（REQUIREMENTS.md PVQ-06 描述同写 720×405，同 stale）。

### 配色不锁死（D-22-01，承接 A 系列）
- 自渲染预览渲染 ShapeSpec 的颜色时，**用 AI 实际传入的 hex**（缺省回退 `DEFAULT_ACCENT.light`）；不引入任何固定调色板。
- 预览面板**自身 UI**（边框/背景/控件）走 Aster teal 克制设计系统 CSS 变量，与「被渲染的幻灯片内容颜色」物理隔离（同 ppt-tokens 与面板 --accent 的隔离纪律）。

### Claude's Discretion（技术实现细节，planner 自定）
- 自渲染预览渲染器的具体模块位置/签名（建议：纯函数/纯组件 `renderSlidePreview(shapes: ShapeSpec[], canvas, scale)` 或等价，data→DOM，可单测）。
- html2canvas 截图函数的封装位置（建议落在 agent loop 懒加载 chunk 内或独立懒加载模块，绝不进 main chunk）。
- 铺开路径 vision 自查工具的命名 / focus prompt 文案（中文，「自查 4 项」对齐 geometry-check 的 overflow/overlap/留白/contrast 语义）。
- 降级路径的开关机制（建议：一个明确的常量/flag 或 feature 分支，关 = 只剩几何自查）。
- 测试覆盖点（渲染器坐标映射、html2canvas 调用被 mock、vision 自查 evidence 拼装、NFR-09 base64 不入 history 的守门）。

</decisions>

<hard_constraints>
## HARD constraints the plan MUST honor（memory-backed gates）

1. **bundle ≤82KB gzip initial main**（当前 **80.6KB**，余量仅 ~1.4KB — 本 phase 最紧约束）：
   - `html2canvas`（~50KB+ gzip）**必须动态 import 懒加载**（`await import('html2canvas')`，仅在截图函数内部），**0 净初始增量**。
   - 项目既有懒加载范式：parsers（docx/xlsx/pdf/pptx via `await import()`）、loop（`agentStore` → `await import('./loop')`）、UI（`React.lazy` ImagePreviewCard/StockImageResultCard/DiffLogPanel/SettingsPanel）。html2canvas + 截图/vision 自查逻辑应落在 **loop 懒加载 chunk** 或独立懒加载 chunk，**绝不被 main 静态 import 链触达**。
   - 验证铁律：**先 `npm run build` 再 `npm run size`**（陈旧 dist 给假绿，memory `project_bundle_size_guard`）。size-limit 监控 `dist/assets/main-*.js` gzip。
   - 若预览面板是 React UI 挂在 App，**必须 `React.lazy` + 动态 import**，否则进 main chunk 爆预算。

2. **undo 守门硬卡**：`operationLog.integration.test` 必须保持绿。本 phase 不新增 write 工具 → 无新 inverse；但既有的不能破。

3. **P95 端到端不退化**：截图在本地 DOM 层 + 离散事件触发（出 layout 时，非逐 token），不在 LLM 流式热路径上；vision 自查若 on-demand 则仅 AI 主动调时才发生。plan 要在 must_haves/verification 说明「为何不退化」。

4. **新 UI 必须遵循 teal 克制设计系统**（UI hint=yes）：预览面板是新 UI → 走 `src/styles.css` CSS 变量 + 内联 SVG 图标（`src/components/icons.tsx`），不用组件库、不用 emoji。规划 UI 任务时先 `Skill("aster-design-system")`。

5. **Lingui**：新 UI 文案动 `@lingui/macro` → 计划里必须含 `npm run extract` 步骤（否则 `coverage.test.ts` 红，memory `project_i18n_extract_and_test_noise`）。`npm run build` 会跑 `lingui compile`。

6. **NFR-09（承接 v2.2）**：自渲染截图的 base64 **绝不进聊天历史 / Message.content**——只把 vision 返回的**文字** evidence 拼入 messages。镜像 `get_shape_image`（vision.ts）的契约：base64 在功能层被 vision 消费即弃，不入 history。建议加守门测试。

7. **所有现有测试 green**（当前 baseline **989 passed**）。

8. **安全 threat model**（security_enforcement=on，每个 PLAN 需 `<threat_model>` 块）：
   - API key 泄漏 → 复用既有 vision client（key 仅 Authorization header，不进 body / error.message，T-01-04）。
   - base64 截图泄漏进 history → NFR-09 守门（见 #6）。
   - `html2canvas` 新依赖供应链 → 懒加载、只处理我方自渲染的 DOM（非任意用户内容）；锁版本。
   - 截图内容外发 → 发往 aihubmix（BYO key，用户自有），与现有 vision 同隐私面，无新增信任边界。

</hard_constraints>

<canonical_refs>
## Canonical References

**Downstream agents（researcher / pattern-mapper / planner / checker）MUST read these before researching/planning/implementing。**

### 本 phase 规格
- `.planning/ROADMAP.md` → 「### Phase 24」 — Goal / Depends on / 5 Success Criteria / 两条路径。⚠️ SC#1 的「720×405pt」是 STALE，以 960×540 为准（见 LOCKED-4）。
- `.planning/REQUIREMENTS.md` → PVQ-06（自渲染预览 + 多模态自查；描述里 720×405 同 stale）、NFR-11（bundle ≤82KB gzip CI gate；html2canvas 必须懒加载）。
- `.planning/STATE.md` → decision log L164-171 / L202（本 CONTEXT 的 LOCKED 决策来源）+ L179 Phase 22 完成簿记 + L181 Phase 23 完成簿记。

### Phase 22 deliverables（BUILD ON — import 复用，勿改既有契约）
- `src/agent/design/ppt-tokens.ts` — `DEFAULT_CANVAS_PT = {widthPt:960, heightPt:540}`、`FONT_LADDER_PT`、`MARGINS_PT`、`GAP_PT`、`DEFAULT_ACCENT`、`SEMANTIC`、`gridFull`/`gridTwoColumn`、`TEXT_METRICS`、类型 `Canvas`/`Rect`。
- `src/agent/design/geometry-check.ts` — 确定性 4 项自查（overflow/overlap/out_of_bounds/contrast）：`checkSlideLayout(shapes, {canvas, annotations})`、`formatViolations(report)`、`wcagContrastRatio`、`estimateTextBox`、类型 `ShapeBox`/`TextBoxAnnotation`/`LayoutReport`/`Violation`。这是降级路径的兜底；铺开路径的「自查 4 项」语义与之对齐（溢出/重叠/留白/对比）。
- `src/agent/tools/read/ppt.ts` → `check_slide_layout`（read tool，`kind:'read'`，**不进 PPT_TOOLS、无 undo/operationLog**）——evidence-into-next-round 范式样板：`adapter.read({kind:'list_shapes_on_slide'})` → 跑纯自查 → `wrapReadResult(..., {result_type:'metadata'})`（含 `summary`）→ wire tool-message。**铺开路径的 vision 自查工具应仿此范式**（read-style、advisory、evidence 拼回、双键容错）。

### Phase 23 deliverables（数据源 — 自渲染预览消费其输出）
- `src/agent/design/ppt-layouts.ts` — `buildLayout(layout, content, colors, canvas) → LayoutResult{shapes: ShapeSpec[], imageSlots, capNotes}`；`ShapeSpec{role, shapeType, rect, text?, font?{size,bold,color,name}, fillColor?, lineColor?, lineWeight?, align?, bgForContrast?}`；`LAYOUT_NAMES`/`LAYOUT_LABELS`。**自渲染预览渲染器的输入应是 ShapeSpec[]（或其结构子集）@960×540pt** —— 渲染 AI 刚盖印章的同一份 ShapeSpec，与 PowerPoint 实际落地结果对比 = 直接测量保真度。
- `src/agent/tools/write/ppt.ts` → `apply_slide_layout`（已内部自动跑 `checkSlideLayout` → `data.layout_check` evidence + `image_slots`）—— 铺开路径可挂接的天然触发点（若日后改 auto-trigger）。

### v2.2 vision base（REUSE — 绝不重建）
- `src/providers/aihubmix-vision.ts` → `AihubmixVisionClient.analyzeImages(userText, images: VisionImage[], config: {baseURL, apiKey}) → {content: string}`。`VisionImage = {base64, mimeType}`。**铺开路径直接用这个方法**：把自渲染截图打成 `{base64, mimeType:'image/png'}`，userText = 「自查 4 项」focus prompt。model = `AIHUBMIX_VISION_MODEL`（registry，当前 gpt-5.4）。
- `src/agent/tools/read/vision.ts` → `get_shape_image`(VIS-01/02) —— base64 在功能层被 vision 消费、不出现在 ToolResult.data/不入 history 的 **NFR-09 契约样板**。
- `src/providers/registry.ts` → `AIHUBMIX_VISION_MODEL` + baseURL/key 解析路径（vision config 来源）。

### 构建 / bundle / i18n / 设计系统
- `.size-limit.json` — `dist/assets/main-*.js` gzip limit `82 KB`。`package.json` scripts：`build`=`lingui compile --typescript && vite build`、`size`=`size-limit`、`extract`=`lingui extract`、`test`=`tsc --noEmit && vitest run`。
- `vite.config.ts` — `manualChunks`（markdown/react 已拆）；base `/Aster/`。
- `Skill("aster-design-system")` — teal 克制 token / 组件类名 / 反模式（构建/改任何 UI 前必加载）。
- `src/styles.css`（CSS 变量真相源）+ `src/components/icons.tsx`（内联 SVG）+ `src/App.tsx`（`React.lazy` + 动态 import 范式）。
- `Skill("office-addin-browser-uat")` — Office for Web 真机验证 recipe（铺开路径端到端 + 对比图采集会用到）。

</canonical_refs>

<specifics>
## Specific Ideas

- **自渲染预览渲染器**：纯数据→DOM。输入 `ShapeSpec[]`（rect@960×540pt + text + font{size,bold,color} + fillColor + align）。容器 16:9，`scale = containerWidthPx / 960`，每个 div `left/top/width/height = rect.* * scale`、字号 `font.size * scale`。颜色用 ShapeSpec 的 hex（缺省 DEFAULT_ACCENT.light）。坐标映射逻辑可单测（喂已知 ShapeSpec，断言 div 的 style 数值）。
- **html2canvas 截图**：`const { default: html2canvas } = await import('html2canvas'); const canvas = await html2canvas(previewEl, {...}); const base64 = canvas.toDataURL('image/png').split(',')[1];`（裸 base64，去 `data:` 前缀，喂 VisionImage）。仅在截图函数内动态 import。
- **铺开路径 vision 自查**（on-demand 默认）：一个 AI 可调的 read-style 工具（建议名如 `visual_check_slide` / `preview_self_check`），execute 内：取当前 slide 的 ShapeSpec（或刚 stamp 的 layout）→ 自渲染→html2canvas 截图→`analyzeImages(focusPrompt, [{base64, mimeType:'image/png'}], visionConfig)`→把 `result.content` 文字经 `wrapReadResult` 成 evidence。focus prompt 让模型只看「溢出/重叠/留白/对比」四项并输出违规文字。base64 绝不进 ToolResult.data（NFR-09）。
- **对比图采集（UAT 交付物）**：spike 步骤产出自渲染预览截图（PNG），并在 UAT-PACKET 写明：用户在 Office for Web PPT 真机对同一 layout 截图，两图并排 → 人眼判溢出/重叠/留白/对比是否粗粒度一致。
- **降级开关**：建议一个明确常量/flag（如 `PVQ06_VISUAL_CHECK_ENABLED`）或工具是否注册的分支。verdict 前默认值由 planner 定（建议铺开工具**已注册但属 advisory/可选**，不破坏既有；UAT 判降级则不启用/移除注册，系统回落到纯几何自查）。

</specifics>

<deferred>
## Deferred Ideas（攒到 v2.3 末统一 UAT，不在本 phase 判定）

- **spike-gate verdict**（保真度够不够用、铺开 or 降级）——人眼判断，最终统一 UAT（LOCKED-1）。
- **3 个可调项最终值**（保真度门槛 / auto vs on-demand / visible vs offscreen）——本 phase 设默认，UAT 调（LOCKED-3）。
- **坐标基准 960 vs 720 真机确认**（承接 Phase 22 D-22-02 DEFER）——若某版本 Office.js 报别的基准，只改 `DEFAULT_CANVAS_PT` 单常量。
- **铺开路径若 UAT 通过的产线增强**：on-demand → auto-trigger（apply_slide_layout 后自动视觉自查）、预览面板从 spike 雏形 → 正式产品面板。
- **字体回退导致的自渲染 vs 真机字宽偏差**（CSS 字体栈 ≠ PowerPoint 字体）——对比图会暴露，UAT 评估是否影响保真度判定。

</deferred>

---

*Phase: 24-a-p2-bundle*
*Context gathered: 2026-06-03 — 物化自 discuss harvest（Phase 20-24，task #7）+ Team Lead LOCKED 决策 + planner 代收代码级事实*
