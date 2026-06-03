# Phase 23: A P1 主力——盖印章工具 + 版式库 + prompt 重写 - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning
**Source:** Team Lead pre-research + discuss-p23（v2.3 milestone autonomous step，task #4 harvest）——决策已锁，无需再开 discuss-phase（沿用 Phase 20/21/22 同款「Team Lead 锁决策」范式）。
**依赖:** Phase 22（PVQ-01/02 基座就位：`ppt-tokens.ts` 结构 token + `geometry-check.ts` 四项确定性自查 + `check_slide_layout` read 工具，963 tests green、bundle 80.61KB）。

<domain>
## Phase Boundary

把 PPT 产出从「文字对但粗糙」升级到「版面规范、整齐专业、可继续编辑」。三件事：① **PVQ-03 盖印章 write 工具** `apply_slide_layout`（一个 tool call = 一整页原生形状，顺手治「工具卡片太多」痛点，完整 undo 合约）；② **PVQ-04 版式库**（开发期 CSS 导坐标固化成紧凑数据，内嵌进工具，6 套版式）；③ **PVQ-05 PPT 领域段 system prompt 重写**（机制就位后下沉冗余规则、保抗幻觉与精确描述、加判断级指引）。

**In scope（PVQ-03 + PVQ-04 + PVQ-05）:**
- **PVQ-03**: 新增 `apply_slide_layout` write ToolDef（`src/agent/tools/write/ppt.ts`）+ 新 adapter 方法 `PptAdapter.applySlideLayout(...)`（单 `PowerPoint.run` 一次性建整页）+ 完整 undo 合约（reverse 收 Record 对象、新 `PostStateSnapshot` kind `ppt_layout` + humanLabel、入 `PPT_TOOLS` set 做 casing 归一化、`operationLog.integration.test.ts` 守门用例、`contract.test.ts` CONTRACT 补行）。
- **PVQ-04**: 新建 `src/agent/design/ppt-layouts.ts`——6 套版式（封面 / 大数字KPI / 两栏对比 / 时间线 / 图文左右 / 要点列表）的**结构定义 + 固化 960×540pt 坐标**（开发期 CSS 导出 + pt/px 换算 + 字体回退校准的产物，固化为紧凑数据/参数化函数），复用 Phase 22 `ppt-tokens.ts`（字号阶梯 / 页边距 / 网格 / 兜底单色 / 涨跌语义色）。每版式 content schema 字段 + 商务密实推导的 caps。
- **PVQ-05**: 重写 `getDomainSegment('ppt')`（`src/agent/system-prompt.ts`）——删冗余机制规则（现 #6「版式意识/拿坐标推算重叠」+ #8「宪法式自查清单」），保 #10（CTX-06 抗幻觉，仅 renumber），修 stale #9（图片功能已可用），加判断级指引 + 硬底线 + 配色判断指引。

**Out of scope（本 phase 明确不碰）:**
- ❌ **不做自渲染预览 / html2canvas**（PVQ-06，Phase 24）。
- ❌ **不动 Phase 22 已交付模块的行为**：`ppt-tokens.ts` / `geometry-check.ts` / `check_slide_layout` read 工具——只 **import 复用**，不改其逻辑（apply_slide_layout 复用纯函数 `checkSlideLayout`/`formatViolations` 做内部自查）。
- ❌ **不新增图片生成/检索工具**：图文左右版式的图片位走 **autonomous-insert**——apply_slide_layout 返回图片位坐标，AI 在同一 loop 用既有 `generate_ppt_image` / `search_and_insert_stock_image` 直插（memory `image_insert_autonomous`），本 phase 不新建图像工具。
- ❌ **不锁配色 / 不内置 palette**（配色不锁死，用户 2026-06-03；见 D-23-04）。
- ❌ **不做 Task Pane 新面板 UI**——apply_slide_layout 的可视化 = 既有 DiffLog 写操作卡片（一个 humanLabel/一张卡），不加面板 chrome（见 D-23-09 UI 评估）。
- ❌ **不做 slide 重排 / 精确位置插入**：`slides.add()` 在 Office.js Web 只追加到末尾（与现 `insert_slide` 一致），apply_slide_layout 同样建新页到末尾（见 D-23-02）。
- ❌ **不做 4:3 deck 运行时检测降级**：版式坐标固定 16:9（960×540），4:3 deck 为已知限制，攒 UAT（见 D-23-08）。

**工程性质:** 1 个新纯数据模块（ppt-layouts）+ 1 个新 adapter 方法 + 1 个新 write 工具 + undo 接线 + prompt 重写。**0 净新增运行时依赖**，全部落懒加载 agent chunk（`write/ppt.ts` / `PptAdapter.ts` / `design/*` 都不在初始入口）→ 预期初始 bundle ~0 增量（baseline 80.61KB gzip，gate ≤82KB）。⚠️ 本 phase 是 v2.3 最可能加 KB 的 phase（固化坐标数据）——坐标数据必须**紧凑**（参数化函数 + 复用 ppt-tokens 网格，而非全展开字面量），动 bundle 前先 `npm run build` 再 `npm run size`（memory `project_bundle_size_guard`）。
</domain>

<decisions>
## Implementation Decisions（全部 LOCKED，除 D-23-01 标注的「Lead 复核点」）

### D-23-01 ⚠️ 架构选 **(B) create+fill**（创建新页 + 填充；reverse = 删整页）—— Lead 复核点
**Lead 在 task 中显式把此选择委派给 planner（"you must MAKE + justify"），discuss-p23 倾向 (B)。本 planner 选 (B)，理由如下；并标注与两处既有 artifact 的偏差供 Lead 复核（见「Deviations」）。**

- **(A) ADDITIVE**（往目标 `slide_index` 加形状，reverse = 批量删 newShapeIds，仿 `add_shape`→`delete_shape_by_id`）：
  - 需新 reverse 工具 `delete_shapes_by_ids` + 新 adapter inverse 方法 + 新 `executeReverse` case + 新 `DocumentAdapterForReplay` 方法（reverse 接线面更大）。
  - 需「目标页非空 → fail-closed」前置守门防版式盖到已有内容堆叠 → 实际上只能盖到**空页** → 等价于「先 insert_slide 再填」少了建页。
  - reverse = N 次删形状，**可部分失败**（删了 5 个 host 报错剩 3 个孤儿形状），需 batch_reverse 三态兜底，更脆。
- **(B) CREATE+FILL（本 phase 采用）**：工具内部 `slides.add()` 建新页 + 一次性填好整页所有形状；reverse = **删除整张新页**。
  - **reverse 复用 `copy_slide` 全套机制**：`reverse.tool = 'delete_slide_by_index'`（已在 `operationLog.executeReverse` L467-470 + `DocumentAdapterForReplay.deleteSlideByIndex` L163-164 + `PptAdapter.deleteSlideByIndex` L2437-2480 接线，index+ID 双定位 D-16）。**operationLog.ts 唯一改动 = 给 `PostStateSnapshot.kind` 加 `'ppt_layout'`**（readTargetState/isTargetStateConsistent 走 default 安全侧，无需新 case；与 `ppt_shape_new` 同款保守路径）。
  - reverse **原子**（一次 `slide.delete()`），不可能留孤儿形状；**按构造永不动任何既有内容**（新页是空的）。
  - 契合「盖印章 = 一个 call = 一整页」语义；建 deck 的主流用法就是生成新页。
  - 把 STATE.md line 170 设想的「agent 先 insert_slide 再 apply 到 slide_index」两步**融合为一次原子调用**，reverse 更简、撤销更稳，仍满足「绝不毁已有内容」硬合约。
- **撤销合约硬要求（两方案都满足，(B) 满足得更彻底）**：**绝不清空/覆盖目标页任何既有内容**——因 `delete_shape`（删既有形状）是 noop+gate 不可撤销（`ppt.ts` L483-515），覆盖即撤不回（STATE.md line 170 锁定的根因）。(B) 新页无既有内容 → 天然满足。
- **新页位置**：`slides.add()` 追加到末尾（Office.js Web GA 无精确插入 API，与现 `insertSlideAfter` L696-744 行为一致）。humanLabel/返回数据用新页 1-based index。

### D-23-02 `apply_slide_layout` adapter 方法 = 单 `PowerPoint.run` 建整页
- 新增 `PptAdapter.applySlideLayout(shapeSpecs, opts?)`，签名返回 `{ capturedIndex: number; capturedId: string; slideIndex: number; newShapeIds: string[] }`。
- 单 run 内：① `slides.add()`（仿 `insertSlideAfter` L702-738）② 重新 load + PPT-05 排序取末页 `newSlide` ③ `newSlide.shapes.load(['id','index'])`（捕双定位指纹，仿 `copySlide` L1854-1861）④ 逐 spec `addTextBox`/`addGeometricShape`（仿 `addShape` L1584-1637）+ 设 text/font(size,bold,color,name)/fill.setSolidColor/lineFormat/对齐 ⑤ 各 shape `.load(['id'])` → sync → 收 `newShapeIds`。
- **A-06**：proxy 不出 run 闭包；catch → `HostApiError`，不存 hostError。
- ⚠️ 真机 UAT 项：`slides.add()` 后同 run 内对新页 `addGeometricShape`/设属性在 Office for Web 是否稳定（`insertSlideAfter` 已证 `addTextBox` 在新页可用，几何形状 + fill/font 待 UAT 复测；攒 v2.3 末 UAT）。
- **shape spec 形状**：`{ shapeType: 'TextBox'|'Rectangle'|...; rect: {left,top,width,height}; text?; font?: {size?,bold?,color?,name?}; fillColor?; lineColor?; lineWeight?; align? }`（pt 单位，960×540 空间）。

### D-23-03 undo 接线（完整合约，memory `adapter_inverse_signature` + `recurring_failure_add_gate`）
- **reverse**：`{ tool: 'delete_slide_by_index', args: { capturedIndex, capturedId } }`（**Record 对象，非位置参**；复用既有 inverse，无新 adapter inverse 方法）。
- **postState**：新 kind `'ppt_layout'`，`content = { slideIndex, capturedId, newShapeIds }`（newShapeIds 供 evidence/返回；capturedId+slideIndex 给 reverse 映射对账）。`operationLog.ts` `PostStateSnapshot.kind` 联合加 `'ppt_layout'`（L34-46）。
- **humanLabel**：`(args) => 新建第 N 张幻灯片并套用「<版式中文名>」版式（<元素数> 个元素）`（N + 元素数 execute 后回填进 data，humanLabel 据 args.layout 给版式名 + 概述；与既有 write 工具 humanLabel 风格一致）。
- **PPT_TOOLS set**：`apply_slide_layout` 必须加入 `tools/index.ts` L31-47 `PPT_TOOLS`（顶层 args casing 归一化；memory `project_ppt_officejs_gotchas`，否则 camel/snake 静默失败）。⚠️ `normalizeToSnakeCase`（L49-58）**只归一化顶层 key、不递归** → 嵌套 `content` 子字段保持原样 → 工具读 content 子字段要按 schema 直接读（content 字段名用简单 snake/无歧义命名，必要处 snake/camel 双键容错）。
- **`operationLog.integration.test.ts` 守门用例（硬 CI gate，D-23-07）**：仿 `copy_slide → delete_slide_by_index → rolled_back`（该文件 L927-942）+ `mockPpt`（L140-216 已有 `slide-uuid-copy` id + `del`）。entry `toolName:'apply_slide_layout'`、reverse `delete_slide_by_index { capturedIndex:0, capturedId:'slide-uuid-copy' }`、postState kind `'ppt_layout'`；断言 `rolled_back` + `del` 被调一次。
- **`contract.test.ts` CONTRACT 补行**：加 `{ toolName:'apply_slide_layout', host:'ppt', undoType:'简单逆向', reverseTool:'delete_slide_by_index', phase:23, integrationTest:true }`；`PhaseNum` 类型 `9|10|11` → 扩到含 `23`（CONTRACT 长度 24→25，仍满足 `>=24`；D-17 扫描要求 `'apply_slide_layout'` 出现在 integration.test.ts，由守门用例满足）。

### D-23-04 配色不锁死（用户 2026-06-03）—— apply_slide_layout 形状颜色全参数化
- apply_slide_layout 的所有形状颜色 = **AI 按客户/内容意图传入 hex**（args `accent_color?` + 必要处 per-role 覆盖）；`DEFAULT_ACCENT`（teal `#009887`/`#4FC9B8`）**仅作 AI 未给时的兜底单色**。**绝不内置 palette 数组**（`ppt-layouts.ts` 同 `ppt-tokens.ts` 物理隔离面板 CSS）。
- **涨跌 green/red** = 独立 `SEMANTIC`（success/error）语义 token（大数字KPI 的 delta 用），不挤占配色预算。
- **唯一颜色护栏 = 对比度自查**（D-23-05 内部 geometry-check）；和谐护栏放弃（用户已知接受）。

### D-23-05 自查集成 = apply_slide_layout **内部自动跑** `checkSlideLayout`（复用 Phase 22 纯函数）
- 工具建好整页后，用它**自己刚摆的**固化 rects + AI 文本 + AI 颜色构造 `ShapeBox[]` + `TextBoxAnnotation[]`，调纯函数 `checkSlideLayout(shapes, {canvas: DEFAULT_CANVAS_PT, annotations})` + `formatViolations(report)`，把 `summary` 放进工具结果 `data.layout_check` 作 evidence（零额外 round-trip、纯计算、无 Office.js）。AI 同一 tool-result 即可见自查反馈并自纠（缩短文本 / 调颜色）。
- 价值点：①**溢出**——AI 给的文本超出固化槽位容量（固化坐标本身按构造干净，溢出主要来自过长文本）；②**对比**——AI 给的字色 vs 工具刷的底色（仅对工具同时掌控 fg+bg 的形状传 annotation，如 KPI 色块上的白字；底色未知的形状 → 诚实降级 undetermined，D-22-05）。
- 独立 `check_slide_layout` read 工具（Phase 22）保留——供手改后/任意页**复查**。

### D-23-06 6 套版式 + content schema + caps（商务密实，PVQ-04）
- 新建 `src/agent/design/ppt-layouts.ts`：导出 6 个版式定义（紧凑数据 + 参数化生成函数），**复用 `ppt-tokens.ts`**（`FONT_LADDER_PT`/`MARGINS_PT`/`GAP_PT`/`gridFull`/`gridTwoColumn`/`DEFAULT_CANVAS_PT`/`DEFAULT_ACCENT`/`SEMANTIC`/`Rect`）。坐标固化 @960×540（开发期 CSS 导出产物 + pt/px + 字体回退校准的固化值，注释标 provenance + 「初值待 UAT 调」）。
- 6 版式 + content schema（字段 + 商务密实 caps，初值）：
  1. **封面 `cover`**：`{ title, subtitle?, footer? }`。大标题（FONT title）+ 副标 + 脚注。
  2. **大数字KPI `kpi`**：`{ title?, kpis: Array<{ value, label, delta?, delta_direction?: 'up'|'down' }> }` **弹性 1–4**（cap 4，渲染传入数量，绕「单巨数 vs 多 KPI band」二选一，UD1 默认）。每 KPI = 大数字（FONT kpi）+ 标签（caption）+ 可选 delta（SEMANTIC 上涨绿/下跌红）。等分栏。
  3. **两栏对比 `two_column`**：`{ title, left: { heading, bullets: string[] }, right: { heading, bullets: string[] } }`（用 `gridTwoColumn`；bullets cap ~6/栏）。
  4. **时间线 `timeline`**：`{ title, events: Array<{ time, label }> }`（cap ~5；水平连接线 + 节点点 + 时间/标签）。
  5. **图文左右 `image_text`**：`{ title, bullets: string[], image_side?: 'left'|'right' }`（一侧文本、另一侧 = **图片位**，返回其 rect 走 autonomous-insert；bullets cap ~5）。
  6. **要点列表 `bullet_list`**：`{ title, bullets: Array<{ heading?, text }> }`（单栏密实，cap ~6–8）。
- **caps 行为**：超 cap 数组 `slice` 截断 + 在 `data` 里 note（不静默丢、不 fail；过长文本由 D-23-05 溢出自查抓）。
- **每版式标题**：断言式结论句承载在标题文本框（prompt 教 AI 写洞察标题，工具不强制内容）。

### D-23-07 测试覆盖（结构性守门，memory `recurring_failure_add_gate`）
- `ppt-layouts.test.ts`：每版式（给样例 content）产出的所有 shape rect **全在 960×540 画布内且不互相重叠**（用 Phase 22 `checkSlideLayout` 跑自己产出断言 0 overlap/0 out_of_bounds，dogfood 几何自查）；caps 截断生效；KPI 弹性 1/2/3/4 都产出对应数量；配色参数化（传入 accent_color 生效、缺省回退 DEFAULT_ACCENT）；**无 palette 数组导出**（配色不锁死结构守门）。
- `write/ppt` 工具测（沿用既有 ppt write 工具 mock 范式）：`apply_slide_layout` execute（mock adapter.applySlideLayout 返 ids）→ 返回含 reverse `delete_slide_by_index`（Record 对象）+ postState kind `'ppt_layout'` + data.layout_check（含「版面自查」）；humanLabel 含版式名。
- **`operationLog.integration.test.ts` 守门用例**（D-23-03，硬 gate）。
- **`contract.test.ts`** CONTRACT 补行 + PhaseNum 扩（D-23-03）。
- **PPT host 工具计数 22→23**：`tools/read/tools.test.ts` + `tools/index.test.ts`（L70 `toHaveLength(22)`）两处断言同步 +1；并加 `expect(names).toContain('apply_slide_layout')`。
- `system-prompt.test.ts`（PVQ-05 守门，D-23-08）：断言 PPT 段不含坐标脑补表述、保留抗幻觉锚点、无 stale 图片文案、提及 apply_slide_layout。

### D-23-08 PVQ-05 PPT 段 prompt 重写（精确删冗余，保精确描述，memory `precision_over_brevity`）
改 `getDomainSegment('ppt')`（`system-prompt.ts` L65-75，现 #1–#10）：
- **删 #6**（「版式意识/用 list_shapes 返回坐标推算空间位置再落点」）——已被 apply_slide_layout 机制保证（PVQ-03）。
- **删 #8**（「宪法式自查/每次 batch 后 list_shapes_on_slide 查重叠溢出」）——已被 `check_slide_layout`/几何自查机制保证（满足 Phase 22 SC#3 + PVQ-02 SC#3）。
- **保 #10**（CTX-06 抗幻觉「文档现状权威/旧读数早已过时」）——**绝不删**，仅 renumber（与坐标/自查解耦，Phase 21 已加，STATE.md line 169 跨 phase 提醒）。
- **修 stale #9**（「图片/背景功能 v2.1 暂不可用…图片功能即将开放」）——**已过时**（v2.2 已交付 `generate_ppt_image` + Pexels 图库插入）。改为：图片**现已可用**——可生图（`generate_ppt_image`）/检索图库（`search_and_insert_stock_image`）并自动插入；图文左右版式的图片位走 autonomous-insert（同一轮直接生/取图填入返回的图片位坐标，不留空给用户）。
- **加判断级指引**（只留「只有模型能判断的」+ 硬底线）：① 用 `apply_slide_layout` 一次建好整页（选合适版式：封面/大数字KPI/两栏对比/时间线/图文左右/要点列表）；② **配色由你按客户/内容意图定**（商务密实、克制、保证对比；涨跌用语义绿红），AI 自主选 hex（D-23-04）；③ 故事线（金字塔：一个核心结论→3–5 支撑）/ 标题写成断言式洞察句（含数字/结论）；④ 硬底线：可编辑优先（产原生形状非图片）/ 收到自查反馈（apply_slide_layout 结果里的版面自查 + check_slide_layout）就改 / 诚实边界。
- ⚠️ **删的是冗余机制规则、不是精确描述**：边界/禁则/判断标准（标题质量定义、每页容量、左对齐正文等仍是模型判断项的）保留并保持精确无歧义（不怕长）。真机 A/B「模型到底照没照做」攒 v2.3 末 UAT。
- **不动 Lingui**：`getDomainSegment` 返回纯模板字符串（非 `t\`\``宏），改它**无需** `npm run extract`（memory `i18n_extract_and_test_noise`）。

### D-23-09 UI 评估（UI hint: yes → 结论 = 无新面板 UI）
- apply_slide_layout 是 write 工具，产出经既有 DiffLog/SummaryModal 渲染：**单个 humanLabel = 一张写操作卡**（reverse 是整页删除的单一操作 → 一条 operationLog entry，**无 subOps**，不需 DiffLogPanel 改动）。沿用既有 write-tool UX，**不加面板 chrome**。
- ⚠️ **生成的 6 版式是「幻灯片成品」（商务密实、AI freehand 配色），与 Aster 面板自身 UI（teal 克制）是两套设计语境**——`aster-design-system` skill 治理**面板**、**不**治理生成的幻灯片；本 phase **不**加载该 skill（无真实面板 UI 改动，memory `aster-design-system` 适用范围）。

### D-23-10 计划结构 + 工程约束
- **2 个 plan**：
  - **23-01**（PVQ-03 + PVQ-04，紧耦合核心）：ppt-layouts.ts → applySlideLayout adapter → apply_slide_layout 工具 + 注册 + PPT_TOOLS + operationLog kind → 测试（ppt-layouts/工具/integration 守门/contract/计数）→ 最终验证。
  - **23-02**（PVQ-05，文件不相交）：system-prompt.ts PPT 段重写 + system-prompt.test 守门。
- **wave**：23-01 wave 1；23-02 wave 2（`depends_on: [23-01]`——文件虽不相交，prompt 描述需对齐已落地工具语义；亦可并行，保守串行）。
- **bundle**：全落懒加载 chunk，预期 ~0 初始增量；坐标数据紧凑；动 bundle 前先 `build` 再 `size`；gate ≤82KB（baseline 80.61KB）。0 净新增运行时依赖。
- **现有 963 测全 green**；tsc 0。

### Claude's Discretion（实现细节，planner/executor 定，全为初值待 UAT 调）
- 6 版式的精确固化 rect 值（CSS 导出 provenance 注释 + 「初值待 UAT 调」）；各 cap 具体数（~5/~6/~8 初值）；KPI delta 渲染样式；时间线节点画法（用小 Ellipse + 细 Rectangle 连接线）。
- apply_slide_layout args schema 的 content 字段命名 + 校验/截断措辞；`data` 返回结构（slide_index / new_shape_ids / image_slots / layout_check）。
- prompt 重写后 PPT 段的具体中文措辞与编号。
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 源码（直接新建 / 改动）
- **新建** `src/agent/design/ppt-layouts.ts`（PVQ-04；6 版式定义 + 固化坐标，复用 ppt-tokens）。
- `src/agent/tools/write/ppt.ts` — 现 9 个 PPT write 工具；**新增** `apply_slide_layout` ToolDef。范式参照同文件 `insertSlide`（L91-125，postState/reverse 范式）+ `addShapeTool`（L364-420）+ `copySlideTool`（L665-700，reverse=`delete_slide_by_index`{capturedIndex,capturedId}）。**新 import**：`{ checkSlideLayout, formatViolations, type ShapeBox, type TextBoxAnnotation } from '../../design/geometry-check'` + `{ DEFAULT_CANVAS_PT } from '../../design/ppt-tokens'` + ppt-layouts。
- `src/adapters/PptAdapter.ts` — **新增** `applySlideLayout(...)` 方法。范式参照 `insertSlideAfter`（L696-744，slides.add+reload+addTextBox）+ `addShape`（L1560-1643，addTextBox/addGeometricShape）+ `copySlide`（L1809-1867，capture id+index）+ `setShapeProperty`（L865，fill.setSolidColor）+ `setShapeTextFont`（L1385，font 设置）。**复用既有** `deleteSlideByIndex`（L2437-2480）作 inverse，**不新增 inverse 方法**。
- `src/agent/operationLog.ts` — `PostStateSnapshot.kind` 联合（L34-46）**加 `'ppt_layout'`**；`executeReverse` `delete_slide_by_index` case（L467-470）+ `DocumentAdapterForReplay.deleteSlideByIndex`（L163-164）**复用不改**。readTargetState/isTargetStateConsistent **不需加 case**（default 安全侧，仿 `ppt_shape_new`）。
- `src/agent/tools/index.ts` — `PPT_TOOLS` set（L31-47）**加 `'apply_slide_layout'`**；`buildToolsForHost('ppt')`（L294-312）write 列表加 `applySlideLayoutTool`；import 行加它。`normalizeToSnakeCase`（L49-58）只归一化顶层 key。
- `src/agent/system-prompt.ts` — `getDomainSegment('ppt')`（L65-75）PVQ-05 重写（删 #6/#8、保 #10、修 stale #9、加判断指引）。

### 源码（read_first / 参照复用，不改逻辑）
- `src/agent/design/ppt-tokens.ts`（Phase 22）— `FONT_LADDER_PT`/`MARGINS_PT`/`GAP_PT`/`gridFull`/`gridTwoColumn`/`DEFAULT_CANVAS_PT`(960×540)/`DEFAULT_ACCENT`/`SEMANTIC`/`type Rect`/`type Canvas`。
- `src/agent/design/geometry-check.ts`（Phase 22）— `checkSlideLayout`/`formatViolations`/`type ShapeBox`/`type TextBoxAnnotation`/`type LayoutReport`（apply_slide_layout 内部自查复用）。
- `src/agent/tools/write/ppt-image.ts` + `search-stock-image.ts` — `generate_ppt_image` / `search_and_insert_stock_image`（autonomous-insert 目标工具，含 slide_index + position）；read_first 确认 position 入参支持（用于图文左右图片位填充）。
- `src/agent/operationLog.integration.test.ts` — `copy_slide` 守门 L927-942（apply_slide_layout 守门用例的 analog）+ `mockPpt` L140-216（`slide-uuid-copy` id + `del`）。
- `src/agent/contract.test.ts` — CONTRACT 表 L33-62（补 apply_slide_layout 行）+ D-17 扫描 L116-139 + 长度守门 L142-144。

### 测试（直接新建 / 改）
- **新建** `src/agent/design/ppt-layouts.test.ts`。
- `src/agent/tools/write/ppt.test.ts`（或同款 write 工具测文件）— apply_slide_layout execute/reverse/postState/humanLabel 断言。
- `src/agent/operationLog.integration.test.ts` — apply_slide_layout 守门用例。
- `src/agent/contract.test.ts` — CONTRACT 补行 + PhaseNum 扩。
- `src/agent/tools/read/tools.test.ts` + `src/agent/tools/index.test.ts` — PPT 计数 22→23 + name 断言。
- `src/agent/system-prompt.test.ts` — PVQ-05 守门。

### 项目约束 / memory
- `.planning/STATE.md` line 170（A 系列 discuss 代码级补齐：撤销合约「绝不毁已有内容」+ 早期锁 A，本 phase 偏差见 Deviations）、line 173（配色不锁死）、line 167（商务密实）、line 169（跨 phase system-prompt 提醒）、line 179（Phase 22 须知：apply_slide_layout 颜色全参数化收 hex、删 #6/#8 保 #10）。
- `.planning/REQUIREMENTS.md` PVQ-03/04/05；`.planning/ROADMAP.md` Phase 23 SC 1–5。
- memory：`adapter_inverse_signature`（inverse 收 Record 对象，非位置参——硬卡）、`recurring_failure_add_gate`（undo 守门结构性 gate）、`project_ppt_officejs_gotchas`（snake/camel 归一化 + 写后回读/web 静默 no-op）、`image_insert_autonomous`（生图/图库 loop 内直插、返 shape_id）、`browser_image_gen_gotchas`（生图工具 timeoutMs 120s，本 phase 不新建图像工具仅引用）、`project_bundle_size_guard`（先 build 再 size）、`precision_over_brevity`（删冗余不删精确）、`i18n_extract_and_test_noise`（system-prompt 非 Lingui 宏，无需 extract；「N failed」才是真失败）、`quality_over_cost`（质量优先，但 undo/bundle/P95 仍硬卡）。
- `./CLAUDE.md` §发布授权（本 phase 不部署）；§UI 设计系统（面板 UI 不动；生成成品 token 物理隔离——D-23-09 不加载 aster-design-system）。
</canonical_refs>

<deferred>
## Deferred Ideas
- **6 版式固化坐标 / cap / 字号初值真机调参** → 攒 v2.3 末 UAT（真机看商务密实成品观感再收敛）。
- **`slides.add()` + 同 run 几何形状/fill/font 在 Office for Web 稳定性** → v2.3 末真机 UAT 复测（`addTextBox` 已证，几何形状待验）。
- **坐标基准 720 vs 960 真机确认** → 延续 Phase 22 D-22-02 defer（偏差只改 `DEFAULT_CANVAS_PT` 单常量）。
- **4:3 deck（720×540pt）检测降级/告警** → 已知限制，defer（Office.js Web 无 GA slide-size 读 API；坐标固定 16:9）。
- **apply_slide_layout 精确位置插入 / slide 重排** → defer（slides.add 只追加末尾，与 insert_slide 一致）。
- **PVQ-05 prompt A/B「模型照没照做」迭代收敛** → 真机验证，攒 v2.3 末 UAT。
- **per-deck 品牌色 theme override UX（UD2）** → 已被「配色不锁死/AI freehand」取代（D-23-04），无独立 UX 需求。
</deferred>

<deviations>
## ⚠️ Deviations from existing artifacts（供 Lead 复核）
1. **架构 (B) create+fill vs STATE.md line 170 + ROADMAP SC#2 字面「批量删 newShapeIds」**：
   - STATE.md line 170 早期锁 (A) additive（reverse=批量删 newShapeIds，「撤销合约定死，直接照办」）；ROADMAP Phase 23 SC#2 字面亦写「批量删除该页新建的所有形状（记录全部 newShapeId）」。
   - discuss-p23 harvest（晚于 line 170）**重新开放**此点为 planner 决策并倾向 (B)；Lead task 显式委派「pick one + justify」。本 planner 选 (B)。
   - **SC#2 的 intent 全部满足**（undo-safe 撤销合约、reverse 收 Record 对象、新 PostStateSnapshot kind+humanLabel、入 PPT_TOOLS、operationLog.integration.test 守门）——只有**机制**从「批量删 newShapeIds」改为「删整张新页（复用 delete_slide_by_index）」，且 (B) 撤销更原子、更稳、新接线更少。
   - **✅ Lead 裁定（2026-06-03 plan-review）：接受 (B) create+fill**。ROADMAP Phase 23 SC#2 已同步更新为 (B) 措辞（删整张新页 via `delete_slide_by_index`，复用 copy_slide 已验证 inverse），intent 全满足、无遗留偏差。STATE.md line 170 措辞由 Lead 收口。本 deviation 已解决，保留记录供追溯。
</deviations>

---

*Phase: 23-apply-slide-layout-prompt-rewrite*
*Context gathered: 2026-06-03 via Team Lead pre-research + discuss-p23（autonomous milestone step，task #4 harvest）*
