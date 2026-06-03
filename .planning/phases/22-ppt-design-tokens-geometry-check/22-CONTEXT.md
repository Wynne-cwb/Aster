# Phase 22: A P0 基座——设计 token + 几何自查 - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning
**Source:** Team Lead pre-research + discuss-p22（v2.3 milestone autonomous step）——决策已锁，无需再开 discuss-phase（沿用 Phase 20/21 同款「Team Lead 锁决策」范式）。⚠️ PVQ-01 已被用户于 2026-06-03 **推翻原「固定 teal 调色板 + 3-5 色」**，改为「配色不锁死」（见 D-22-01）。

<domain>
## Phase Boundary

把 PPT 设计规范的**代码化基础**建起来：① 集中**结构** token 模块（PVQ-01），② 确定性几何自查（PVQ-02）从代码层面消除「LLM 拿坐标脑补重叠/溢出」。本 phase = **纯机制**，零 UI、零新增 write 工具、零网络、零新增运行时依赖。

**In scope（PVQ-01 + PVQ-02）:**
- **PVQ-01**: 新建 `src/agent/design/ppt-tokens.ts`，集中存**结构** token——字号阶梯（标题/副标/正文/脚注/大数字 KPI，**商务密实**偏紧凑）、统一页边距、两套基础网格布局（整页 / 左右两栏）、默认画布尺寸。⚠️ **不内置固定调色板**（配色不锁死，D-22-01）：只保留 teal `#009887`/dark `#4FC9B8` 作**缺省/兜底**单色 + 涨跌绿/红独立 success/error 语义色。结构 token 全为「**建议初值，待真机/UAT 调**」。
- **PVQ-02**: 新建 `src/agent/design/geometry-check.ts`（纯 TS、确定性、零网络零依赖）——拿每个元素的 `{left,top,width,height}` 算出版面问题，输出**违规清单**（advisory evidence，**非硬阻断**，D-22-03）。四项：① 文本溢出（保守上界宽高 > 文本框）② 矩形重叠（相交边长 > 2pt）③ 越界（超画布或到边缘 < 页边距 token）④ 对比不足（文字/背景 WCAG）。
- **证据接线**: 新增 READ 工具 `check_slide_layout`（D-22-04），agent 调用后返回确定性违规清单 → 走既有 read-tool → wire tool-message 路径成为下一轮 evidence（PVQ-02 SC#3 的「可拼入 messages」由此机制天然满足）。

**Out of scope（本 phase 明确不碰）:**
- ❌ **不碰 `system-prompt.ts`**（D-22-07）——PVQ-02 SC#3「system prompt 不再有脑补坐标表述」由 **Phase 23（PVQ-05）整体重写**统一满足；本 phase 只建机制，靠工具 `description` 自我广告即可被 LLM 发现调用。避免 system-prompt.ts 三方反复改（Phase 21 CTX-06 刚加 #10、Phase 23 删 #6/#8）。
- ❌ **不建 `apply_slide_layout` 盖印章 write 工具**（PVQ-03，Phase 23）；本 phase 无任何 write 工具 → **无 undo/`operationLog` 守门需求**。
- ❌ **不建版式库 CSS 导坐标**（PVQ-04，Phase 23）。
- ❌ **不动 adapter**（D-22-04：`check_slide_layout` 复用既有 `adapter.read({kind:'list_shapes_on_slide'})`，PptAdapter.ts 一字不改）。
- ❌ **不锁配色 / 不做和谐护栏**（配色不锁死，用户已知接受；对比度自查是唯一颜色护栏，D-22-01/05）。
- ❌ **不做自渲染预览 / html2canvas**（PVQ-06，Phase 24）。

**工程性质:** 纯 TS 模块 + 一个 read 工具注册。**0 净新增运行时依赖**，落在懒加载 agent chunk → 预期初始 bundle ~0 增量（baseline 80.6KB gzip，gate ≤82KB）。
</domain>

<decisions>
## Implementation Decisions（全部 LOCKED）

### D-22-01 ppt-tokens.ts = **结构 token only，配色不锁死**（PVQ-01，用户 2026-06-03 推翻原调色板锁定）
- ⚠️ 用户**推翻** PVQ-01 原文「teal 主色 + 固定强调色、共 3-5 色」硬锁。新方向（STATE.md 2026-06-03 决策）：**不内置固定调色板、不锁单一 palette**；配色由 AI 按客户/内容意图**自由生成 hex**（freehand），`ppt-tokens.ts` 只固化**结构**。
- `ppt-tokens.ts` 存：
  - **字号阶梯**（pt，**商务密实**偏紧凑——咨询/财报汇报风、信息密度高）：`FONT_LADDER_PT = { title, subtitle, heading, body, caption, kpi }`（初值见 §Specifics；标题 > 副标 > 正文 > 脚注 单调递减，kpi 最大；全部「初值待 UAT 调」注释）。
  - **统一页边距**：`MARGINS_PT = { x, y }`（商务密实偏小）+ 元素间距 `GAP_PT`。
  - **两套网格布局**：`gridFull(canvas)` 整页单栏 + `gridTwoColumn(canvas)` 左右两栏——**写成接收 canvas 的纯函数返回区域矩形**（不硬编死坐标，随 canvas 自适应，规避 720/960 baseline 陷阱，见 D-22-02）。
  - **默认/兜底单色**：`DEFAULT_ACCENT = { light: '#009887', dark: '#4FC9B8' }`——**唯一缺省色**，仅在 AI 无配色意图信号时回退；注释写明「非调色板，AI 按客户意图自由生成 hex，此为兜底」。
  - **涨跌语义色**：`SEMANTIC = { success: '<绿>', error: '<红>' }`——**独立**于配色，不挤占任何「配色预算」。
- **后果（用户已知接受）**：放弃和谐护栏 → 几何自查「对比度」项（按 AI 实际所选色算 WCAG）成为**唯一颜色护栏**（兜不可读，兜不了「整体不协调」）→ D-22-05 对比度自查 + 诚实降级份量上升。
- **此调性仅指「生成的幻灯片成品」**；Aster 面板自身 UI 仍 teal 克制不变（memory `feedback_beauty_over_fluent`/`aster-design-system` 不受影响）。这些 token 与面板 `--accent` CSS 变量系统**物理隔离**，**绝不复用面板 CSS 变量**。

### D-22-02 ⚠️ 坐标基准 = **canvas 作参数 + 默认 960×540pt**（#1 陷阱，必须钉死）
- **陷阱**：REQUIREMENTS / PVQ-02 写「基准 16:9 = 720×405pt」，但 **Office.js PowerPoint Shape.left/top/width/height 是 points，标准宽屏 16:9 = 13.333in×7.5in = 72pt/in → 960×540pt**。`list_shapes_on_slide` 报的就是这个 pt 空间。若几何自查用 720×405 当画布，**右半屏每个形状都会被误判越界**——每条溢出/越界/重叠判定全错。
- **决策**：
  1. 几何自查纯函数**绝不内部硬编码画布**——`canvas: { widthPt, heightPt }` 作**显式参数**。
  2. `ppt-tokens.ts` 默认 `DEFAULT_CANVAS_PT = { widthPt: 960, heightPt: 540 }`（= Office.js 实际 pt 空间；标准宽屏）。注释钉死「720×405 是 REQUIREMENTS 的笔误/旧 10in 4:3 残留，**Office.js point 几何下错误**；本默认 = 960×540」。
  3. 网格布局函数（D-22-01）接收 canvas → 区域随画布缩放，非默认画布也正确。
  4. **真机确认（攒到 v2.3 末 UAT）**：插一张满宽形状，读 `left+width` 应 ≈ 960（非 720）；若某 Provider/版本 Office.js 报别的基准 → 改 `DEFAULT_CANVAS_PT` 单一常量即可。Office.js 若未来出 slide-size 读 API → 在 `check_slide_layout` 工具里接入实读 dims（当前 web 无 GA API，故默认常量 + UAT 确认 + 参数化三保险）。
- **不 blind-hardcode 720**：这是 Team Lead 点名的 load-bearing 决策。

### D-22-03 几何自查 = **advisory evidence，非硬阻断**（PVQ-02 + Phase 22 SC#3 LOCKED）
- 自查输出**违规清单**（结构化数据），作为下一轮 evidence 喂回 LLM 自主重排——**绝不**阻断/否决任何写操作，**绝不**自动改文档。LLM 拿到清单后**自主决定**改不改、怎么改。
- 纯 TS、确定性、零网络零依赖。同一输入恒定同一输出（可单测、可缓存友好）。

### D-22-04 证据接线机制 = **新增 READ 工具 `check_slide_layout`**（非 auto-inject）
- **决策**：新增一个 read-style 工具 `check_slide_layout`，agent 主动调用，返回确定性违规清单。
- **理由（vs auto-run-after-write + inject）**：
  1. 最贴合 Aster 既有「LLM 驱动 tool-call + read 工具返 evidence」架构（read-result.ts `result_type:'metadata'` 范式现成）。
  2. 工具结果 → loop 推成 tool-role 消息 → 下一轮 LLM 看到 = **PVQ-02 SC#3「可拼入 messages 作 evidence」天然满足**，无需新接线。
  3. auto-inject 需在每次 PPT write 后插桩 + 判断「何时该查」+ 往 wire 注非工具消息，侵入 loop.ts、破坏「工具调用对称性」、更难测；read 工具零侵入、可独立单测、LLM 自主择时调用（更符合 advisory 定位）。
- **注册**：进 `buildToolsForHost('ppt')` 的 **read 工具列表**（`listSlides/getSlide/listShapesOnSlide/getShape` 旁），`kind:'read'`。**不进 `PPT_TOOLS` write set**（那是 write 工具 casing 归一化集合）、**无 undo / 无 `operationLog` / 无 `PostStateSnapshot`**（非 mutating）。
- **零 adapter 改动**：工具 execute 复用既有 `ctx.adapter.read({ kind:'list_shapes_on_slide', slideIndex })` 取几何（该 read 已 load `{id,type,left,top,width,height}`，PptAdapter.ts L455 实证），再跑纯 `checkSlideLayout(...)`，`wrapReadResult` 包成 `metadata`。`ReadRequest` 联合**不新增 kind**。

### D-22-05 对比度自查 ④ 输入 = **AI 所选 hex 色对 + 诚实降级**（唯一颜色护栏）
- 「按 AI 实际所选色算 WCAG」：颜色由 AI 通过工具入参 `textBoxes[].{foreground,background}` 供入（AI freehand 选的 hex，它自己知道）。纯 TS 确定性算对比比值（非 LLM 肉眼判断）。
- **诚实降级分支（MUST，无假阳性）**：某色对缺 `background`（PPT web `background.fill` 读不稳，memory `project_ppt_officejs_gotchas` / Phase 10 spike S2）或 hex 非法/解析失败 → 该条标 `contrast: 'undetermined'`（advisory 提示「背景色未知，无法判对比」），**绝不报为违规**（不造假阳性）。无任何 `textBoxes` → 对比项整体跳过 + 诚实说明「未提供配色信息，未做对比检查」。
- **不读文档实际颜色**（web fill 读不稳，需 spike）→ 本 phase 显式 defer；AI 控/知自己选的色，供入即可。Phase 23 `apply_slide_layout` 知道自己刷的 hex，可自然喂入此项（纯函数 `checkContrast(pairs)` 复用）。

### D-22-06 溢出自查 ① 输入 = **文档读几何 + AI 供文本/字号 + 保守上界**
- `list_shapes_on_slide` 只 load 几何**不 load 文本**（T-04-10 守则）→ 溢出需 AI 供 `textBoxes[].{shapeId, text, fontSizePt}`；文本框 w/h 用文档读到的真实几何（按 shapeId 关联）。
- **保守上界宽度启发**（over-estimate = 安全方向，宁多报）：逐字 advance —— CJK ≈ `fontSizePt × 1.0`（全角方块），拉丁/数字/空格 ≈ `fontSizePt × 0.6`（保守偏大；真均值更小）。行高 ≈ `fontSizePt × 1.3`。按框宽折行算需求行数 → 需求高度 > 框高（+ 容差 token）即报溢出；单个 CJK 字宽 > 框宽（退化）也报。阈值/容差/乘数全为 `ppt-tokens.ts` 命名常量「初值待 UAT 调」。
- 无对应 `textBoxes` 条目的形状 → ① 不查该形状（诚实，不臆测文本）。②（重叠）③（越界）**不需要文本/颜色**，全用文档读几何 + canvas/margins token，恒定运行。

### D-22-07 **不碰 system-prompt.ts**（Phase-23-friendly 排序）
- 本 phase **不编辑 `system-prompt.ts`**。PVQ-02 SC#3「system prompt 不再有『让 LLM 拿坐标脑补重叠』表述」由 **Phase 23 PVQ-05** 整体重写时统一删除现 PPT 段 #6（版式意识/拿坐标推算）+ #8（宪法式自查清单）来满足——这是 Team Lead 明确排序（避免 system-prompt.ts 三方反复改：Phase 21 CTX-06 刚加 #10「文档现状权威」、Phase 23 删 #6/#8）。
- **机制可用性不依赖 prompt**：`check_slide_layout` 的 `description` 字段（随 tools 进静态 wire 前缀）已能让 LLM 发现并调用本工具；Phase 23 prompt 重写再主动引导「排版后自查、收到反馈就改」。本 phase 工具 description 写清用途即可。
- ⚠️ Phase 23 planner 须知：删 #6/#8 时**保留** Phase 21 的 #10「文档现状权威」抗幻觉项（已与坐标/自查解耦）。

### D-22-08 测试覆盖（结构性守门，memory `recurring_failure_add_gate`）
- `geometry-check.test.ts`：四项各 **happy-path + edge-case**（① 溢出 fits/overflows；② 重叠 disjoint/相交>2pt 边界；③ 越界 within/超画布或入边距；④ 对比 高对比通过/低对比违规 + 大字 3:1 阈值边界）+ WCAG 相对亮度 helper 已知对（黑/白=21、白/白=1）+ 文本宽度估算（CJK vs 拉丁保守性）+ `checkSlideLayout` 聚合 + `formatViolations` 锚点串。
- **对比度诚实降级专测**（MUST）：bg 缺失/非法 → `undetermined`、**非违规**（无假阳性）。
- `ppt-tokens.test.ts`：字号阶梯单调（title>subtitle>body>caption、kpi 最大）、margins/gap 存在、`gridFull`/`gridTwoColumn` 对 960×540 与另一 canvas 返回正确区域（区域在画布内、不互相溢出）、`DEFAULT_ACCENT` 存在、`SEMANTIC` 存在、**断言无固定调色板数组**（配色不锁死结构守门）。
- `check_slide_layout` 工具集成测（沿用 vision.test.ts/tools.test.ts mock 范式）：mock `adapter.read` 返 shapes → 工具返 `result_type:'metadata'` 包装的违规报告；`kind==='read'`；name 正确。
- **PPT host 工具计数 21→22**：`src/agent/tools/read/tools.test.ts`（L212）+ `src/agent/tools/index.test.ts`（L69）两处断言同步 +1。

### D-22-09 计划结构 + 工程约束
- **1 个 plan，5 个 task**（PVQ-01 与 PVQ-02 紧耦合：geometry-check import tokens、工具 import 两者，顺序推进；仿 Phase 20 单 plan 多 task 范式）：
  1. `ppt-tokens.ts`（PVQ-01）
  2. `geometry-check.ts` 纯模块（PVQ-02 ①②③④ + WCAG + 文本估算 + `checkSlideLayout` + `formatViolations`）
  3. `check_slide_layout` read 工具 + 注册进 `buildToolsForHost('ppt')`
  4. 测试（ppt-tokens.test / geometry-check.test / 工具集成 / 计数 +1）
  5. 最终验证（tsc + test + build + size）
- **bundle**：纯 TS 落懒加载 agent chunk，预期 ~0 初始增量；**动 bundle 前先 `npm run build` 再 `npm run size`**（陈旧 dist 假绿，memory `project_bundle_size_guard`）；gate ≤82KB（baseline 80.6KB）。
- **read 工具入参 casing**：沿用既有 read 工具 camelCase（`slideIndex`，与 `listShapesOnSlide` 一致；read 工具**不进** `PPT_TOOLS` 不做归一化）；`textBoxes[]` 条目内部 `shapeId` 读取做 snake/camel 双键容错（memory `project_ppt_officejs_gotchas` 防 LLM 传 `shape_id`）。
- 本 phase **不动 Lingui 宏**（零 UI 字符串）→ 无需 `npm run extract`。

### Claude's Discretion（实现细节，planner/executor 定，全为初值）
- 字号阶梯具体 pt 值、margins/gap/容差具体 pt、文本宽度乘数（CJK/拉丁）、行高乘数——全部 `ppt-tokens.ts` 命名常量 + 「初值待 UAT 调」注释。
- 违规清单 JSON 形状 + `formatViolations` 中文措辞（须含每条：类型 + 涉及 shapeId + 量化（如「超框 N pt」「对比 X:1 < 阈值」）+ 建议方向）。
- `geometry-check.ts` 内部函数拆分粒度（`checkOverflow`/`checkOverlap`/`checkOutOfBounds`/`checkContrast`/`wcagContrastRatio`/`estimateTextBox` + 顶层 `checkSlideLayout`）。
- 工具 `description` 具体文案（讲清「确定性版面自查、返回违规清单供你修正」）。
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 源码（直接新建 / 改动）
- **新建** `src/agent/design/ppt-tokens.ts`（PVQ-01；`design/` 目录此前不存在，本 phase 创建）。
- **新建** `src/agent/design/geometry-check.ts`（PVQ-02 纯模块）。
- `src/agent/tools/read/ppt.ts` — 现有 4 PPT read ToolDef（`listSlides/getSlide/listShapesOnSlide/getShape`）；**新增** `checkSlideLayout` ToolDef（`name:'check_slide_layout'`, `kind:'read'`, execute 复用 `wrapReadResult`）。范式照搬同文件 `listShapesOnSlide`（execute 调 `ctx.adapter.read`）。
- `src/agent/tools/index.ts` — `buildToolsForHost('ppt')`（L294-312）read 工具列表加 `checkSlideLayout`；import 行加它。**不动** `PPT_TOOLS` set（read 工具不入）。
- `src/agent/read-result.ts` — `wrapReadResult(result, {result_type, source})` + `estimateTokens`（已导出，若需 token 估算复用之，勿重定义，memory Phase 21 范式）。`result_type:'metadata'`（违规清单是可信结构信息，非 document_content）。

### 源码（read_first / 参照，不改）
- `src/adapters/PptAdapter.ts` — `list_shapes_on_slide` 读 handler **L432-483**（已 `slide.shapes.load('items/id,items/type,items/left,items/top,items/width,items/height')`，返 `{ slideIndex, shapes:[{id,type,left,top,width,height}] }`，单位 = **points**）；`moveShape` L1105 / `restoreShapeGeometry` L1168（几何写回参照，本 phase 不写）。**本 phase 一字不改此文件**（D-22-04）。
- `src/adapters/DocumentAdapter.ts` — `ReadRequest` 联合 L165-179（`{ kind:'list_shapes_on_slide'; slideIndex:number }` 已有，**不新增 kind**）；`ReadableResult` 形状。
- `src/agent/tools/read/vision.test.ts` + `src/agent/tools/read/tools.test.ts` — read 工具单测 mock 范式（`adapter:{read:vi.fn()}`、`makeCtx`、`buildToolsForHost` 计数断言）。
- `src/agent/system-prompt.ts` — **本 phase 不改**（D-22-07）；现 PPT 段 #6/#8（脑补坐标/自查清单）留给 Phase 23 PVQ-05 删，#10（CTX-06 文档现状权威）保留。

### 测试（直接新建 / 改）
- **新建** `src/agent/design/ppt-tokens.test.ts`、`src/agent/design/geometry-check.test.ts`。
- `src/agent/tools/read/tools.test.ts` — PPT 计数 L212 `21→22` + 可加 `check_slide_layout` name/execute 断言。
- `src/agent/tools/index.test.ts` — PPT 计数 L69 `21→22`。

### 项目约束 / memory
- `.planning/STATE.md` 2026-06-03 决策：「配色不锁死」（推翻 PVQ-01 调色板）、「PVQ 成品调性=商务密实」、「A 系列 discuss 代码级补齐」、「跨 phase 同区域提醒（system-prompt.ts）」。
- `.planning/REQUIREMENTS.md` PVQ-01（已更新含配色不锁死）+ PVQ-02。
- `./CLAUDE.md` §发布授权（本 phase 不部署）；§UI 设计系统（**面板 UI 不动**，生成成品 token 物理隔离）。
- memory：`project_bundle_size_guard`（先 build 再 size）、`recurring_failure_add_gate`（四查 + 降级各加结构守门）、`project_ppt_officejs_gotchas`（snake/camel 容错；web fill 读不稳 → 对比诚实降级）、`precision_over_brevity`（违规清单措辞精确量化）、`i18n_extract_and_test_noise`（不动 Lingui；「N failed」才是真失败，尾部 3 retry errors 是噪音）、`adapter_inverse_signature`（本 phase 无 write/inverse，仅备查）。
</canonical_refs>

<specifics>
## Specific Ideas（初值，全部 `ppt-tokens.ts` 命名常量 + 「初值待 UAT 调」注释）

- **字号阶梯（商务密实，pt）**：`FONT_LADDER_PT = { title: 28, subtitle: 18, heading: 16, body: 14, caption: 11, kpi: 40 }`（标题>副标>heading>正文>脚注 单调；kpi 最大；偏紧凑高密度）。
- **页边距/间距（商务密实偏小，pt）**：`MARGINS_PT = { x: 48, y: 36 }`、`GAP_PT = 16`（基于 960×540 默认画布；非默认画布按比例可推）。
- **画布**：`DEFAULT_CANVAS_PT = { widthPt: 960, heightPt: 540 }`（Office.js point 空间，**非** 720×405，见 D-22-02）。
- **缺省/兜底单色**：`DEFAULT_ACCENT = { light: '#009887', dark: '#4FC9B8' }`（唯一兜底，非调色板）。
- **涨跌语义色**：`SEMANTIC = { success: '#0E9F6E', error: '#E02424' }`（独立，初值）。
- **网格**：`gridFull(canvas)` → `{ titleBand, content }` 区域矩形；`gridTwoColumn(canvas)` → `{ titleBand, left, right }`（含 GAP_PT 间隔）。纯函数，区域全在 `[margin, canvas-margin]` 内。
- **几何阈值**：重叠相交边长 `> OVERLAP_MIN_PT(=2)` 才报；越界到边缘 `< MARGINS_PT` 报；溢出容差 `OVERFLOW_TOLERANCE_PT(=2)`。
- **WCAG**：正文阈值 4.5:1；大字阈值 3:1，大字 = `fontSizePt ≥ 18 || (fontSizePt ≥ 14 && bold)`（标准 WCAG large-text 定义；REQUIREMENTS「≥18pt 加粗」表述以此精确化）。
- **文本宽度乘数**：CJK `1.0`、拉丁/数字/空格 `0.6`、行高 `1.3`（保守上界）。

## Verification（success criteria，必须 TRUE — 对齐 ROADMAP Phase 22 SC，含配色不锁死修正）
1. `src/agent/design/ppt-tokens.ts` 存在并含：字号阶梯（标题/副标/正文/脚注/kpi pt 值）、统一页边距 + 间距、两套网格布局（整页/左右两栏，canvas 参数化纯函数）、默认画布 960×540、**缺省/兜底单色 teal + 涨跌语义色**；**无固定调色板数组**（配色不锁死）；代码无散落硬编码字号/页边距重复值。
2. `geometry-check.ts` 几何自查接收元素列表 `{left,top,width,height}[]` + **canvas 参数**（默认 960×540，非硬编 720），确定性输出违规清单，覆盖四项：① 文本溢出（保守上界）② 矩形重叠（相交边长 >2pt）③ 越界（超画布或到边缘 < 页边距）④ 对比不足（WCAG <4.5:1 正文 / <3:1 大字；**bg 不可读→诚实降级 undetermined，不假阳性**）。
3. `check_slide_layout` read 工具注册进 `buildToolsForHost('ppt')`（kind:'read'、不进 PPT_TOOLS、无 undo），复用 `adapter.read({kind:'list_shapes_on_slide'})` 无新 adapter kind；工具结果经既有 read-tool → wire tool-message 路径 = 下一轮 evidence。**本 phase 不改 system-prompt.ts**（SC「prompt 不再脑补」由 Phase 23 PVQ-05 满足，本 phase 记为显式排序 defer）。
4. 几何自查纯 TS、零网络零依赖；单测覆盖四项各 happy + edge + 对比诚实降级 + ppt-tokens 结构 + 工具集成 + PPT 计数 21→22；现有 933 测全 green；tsc 0；bundle ≤82KB（先 build 再 size）。

## Verification commands
- `npx tsc --noEmit`（类型干净）
- `npm test -- --run`（全套 green，含新几何/token/工具守门；「N failed」才是真失败，尾部 3 retry errors 是噪音——memory `i18n_extract_and_test_noise`）
- `npm run build && npm run size`（先 build 再 size；main gzip ≤82KB，预期与 80.6KB 持平——纯 TS、0 新依赖、懒加载 chunk）
- 本 phase **不动 Lingui 宏**，无需 `npm run extract`。
</specifics>

<deferred>
## Deferred Ideas
- **读文档实际颜色做对比**（vs AI 供入色对）→ defer：PPT web `background.fill` 读不稳（需 spike），D-22-05 用 AI 供入色 + 诚实降级，本 phase 不读实际 fill。
- **坐标基准真机确认（720 vs 960）** → 攒到 v2.3 末 UAT：插满宽形状读 `left+width` 应 ≈960；若某版本 Office.js 报别的基准 → 改 `DEFAULT_CANVAS_PT` 单常量。Office.js 若出 slide-size 读 API → `check_slide_layout` 接实读 dims（当前 web 无 GA API）。
- **几何阈值/字号/边距/乘数初值调参** → 攒到 v2.3 末 UAT（真机看商务密实成品观感再收敛）。
- **system-prompt.ts PPT 段脑补坐标/自查规则删除** → Phase 23 PVQ-05 整体重写（D-22-07）。
- **apply_slide_layout 自动喂对比/溢出色与文本给 check_slide_layout** → Phase 23（apply_slide_layout 知道自己刷的 hex/文本，可自然喂入；本 phase 纯函数已为其预留 `checkContrast(pairs)` / 文本估算复用接口）。
</deferred>

---

*Phase: 22-ppt-design-tokens-geometry-check*
*Context gathered: 2026-06-03 via Team Lead pre-research + discuss-p22（autonomous milestone step）*
