# Phase 15: VIS — 视觉看图 - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 15 交付 **Aster 的全部「看图」能力**——让 agent 能把图片当 evidence 来读、据图作答（典型场景：用户给一张图，让 Aster 基于这张图生成对应文档/文案）。两个图片来源，**都走已就位的 aihubmix-vision 客户端、返回文本**给主 agent，图片 base64 不进主 LLM（DeepSeek）消息层：

1. **文档选中图（VIS-01/02）** — agent 通过新增 `get_shape_image` read tool，取**当前打开文档里、用户选中**的图片/图表 base64（PPT 图片/图表 shape、Excel 图表、Word inline picture），内部调 vision 返回文本。取图为执行期真机 spike。
2. **用户上传图（FILE-06，本次从 Phase 17 前移）** — 激活 InputBar 现有那个**禁用的回形针按钮**，让用户经按钮选图或 **Ctrl+V 粘贴**上传图片（多张、png/jpg/webp），一次性调 vision、结果作 evidence 注入。

**关键范围变更（discuss-phase 15 用户拍板）：** 原路线图把「上传图」放 Phase 17（FILE-06）。本次讨论中用户指出核心场景是「用户传图 → 基于图生成文档」，且 FILE-06 纯走 vision、零解析库依赖，与 VIS 同属「视觉」。故 **FILE-06 前移至 Phase 15**，Phase 15 = 所有看图；Phase 17 收窄为 docx/xlsx/pdf/pptx 的懒加载**文本解析**（需解析库、bundle 预算那套）。REQUIREMENTS §Traceability 已同步（15:3→4 / 17:8→7，总数仍 22）。

**不在本阶段（下游）：** 生图插入（Phase 16）、docx/xlsx/pdf/pptx 文本解析（Phase 17）、图库检索（Phase 18）。Phase 15 只「看图」，不生图、不解析文档文件。

</domain>

<decisions>
## Implementation Decisions

### 架构：视觉怎么接进 agent（上游 research/SUMMARY 锁定 + 本次确认）
- **D-01（视觉 = read-tool + 一次性调用两条路，都返回文本）:** 文档选中图走 `get_shape_image` **read tool**（agent 主动调）；用户上传图走 **一次性 vision 调用**（用户发消息时触发，结果作 evidence 注入 prompt）。两条都接已存在的 `AihubmixVisionClient`，**返回文本**给主 agent；图片 base64 **不进主 LLM 消息层**（主 LLM = DeepSeek，本就不多模态）。`loop.ts` 核心零/极小改动。〔research/SUMMARY.md L65「Vision = READ TOOL，非消息层 image_url augmentation，零改 loop.ts」+ L67「图片附件走 vision client 一次性调用」〕
- **D-02（视觉模型 = aihubmix-vision / gpt-5.4，不验 DeepSeek）:** 视觉一律走 `aihubmix-vision`（OpenAI `image_url` content part，客户端已存在、Phase 14 已对齐 `gpt-5.4`）。**不验 DeepSeek-V4 原生多模态**——spike 004 已 FAIL（官方文档无 vision endpoint），用户明确省此 spike。〔14-CONTEXT D-06；spikes/004〕

### 看图返回什么给主 agent（Q1，用户交 Claude 定）
- **D-03（带可选 focus 参数）:** `get_shape_image`（及上传图的 vision 调用）**带一个可选 focus/question 参数**：主 agent 把「用户想从图里知道什么」作为 focus 传给 vision，做**针对性**作答；不传则让 vision 出**通用客观描述**。
  - **理由：** 用户核心场景是「基于这张图生成文档/文案」——agent 需要从图里抽出**能直接拿来写**的具体细节（图表数值、照片内容、版式），focus 让 agent 精确问 vision 它要写什么，比固定通用描述实用。质量优先（memory `project_quality_over_cost`）。

### 来源 ① 文档选中图（VIS-01）
- **D-04（支持范围，Q2）:** PPT 图片 shape + **图表 shape** / Excel **图表** / Word **inline picture**。圈选单元格/幻灯片区域截图**不做**（取图 API 复杂、spike 风险大，Q2 未选）。
- **D-05（多选取第一张，Q2）:** 选中多个 shape → **取第一张图** + 提示「已看第 1 张」。
- **D-06（触发=纯 agent 自决，不改选区胶囊，Q3）:** 不改现有 SelectionPill。agent 在用户问题涉及选中图时**自行决定**调 `get_shape_image`。现有 `SelectionContext.selectedShapeType`（PPT）已能让 agent 知道选中的是图片/图表。看图时用 humanLabel 体系给气泡文案（如「正在看这张图…」，沿用现有 tool humanLabel）。
- **D-07（取图 = 执行期 spike gate）:** PPT/Excel/Word 取选中图为 base64（`shape.image.getBase64ImageData()` / Excel `chart.getImage*` / Word inline picture base64）在 **Office for Web 真机**验证；失败 fallback **引导点回形针上传这张图**（本阶段已交付上传，fallback 不再尴尬引用未来阶段）。

### 来源 ② 用户上传图（FILE-06，前移）
- **D-08（激活现有回形针 + 粘贴，不做拖拽，UQ1）:** 激活 `InputBar.tsx:144-153` 现有那个 `aria-disabled` 的回形针按钮（现 title=「文件上传即将开放」）→ 接 file input + **Ctrl+V 粘贴图片**支持。**不做拖拽**（Office for Web 宿主/浏览器 drag-drop 不稳，用户明确不做）。
- **D-09（多张 + 格式，UQ2）:** 一条消息支持**多张**图片（OpenAI `image_url` content array 多图）；格式 png/jpg/webp；单图大小设合理上限防 vision 超限。
- **D-10（本会话内可多轮复用，内存态，UQ3 + NFR-09）:** 上传图在**本会话刷新前可多轮追问复用**（内存态 store）；**绝不写 localStorage**；刷新即丢并明确告知用户。贴合「基于这张图反复改文档」。
- **D-11（Phase 15 回形针只接图片）:** 本阶段回形针 `accept` 限**图片**（image/png,image/jpeg,image/webp）；用户若选**非图片文件** → 结构化错误诚实提示「文件解析即将开放」（Phase 17）。Phase 17 再把回形针推广到 docx/xlsx/pdf/pptx + 加附件 chip「仅供 AI 阅读」+ FILE-07 边界。

### NFR-09 硬约束（base64 永不进持久化历史）
- **D-12（serialize 守门）:** base64 图片字节**永不**写入 persisted 聊天历史。
  - 文档选中图路径**天然满足**（base64 只活在 tool 执行内，从不进 message）。
  - 上传图路径：持久化的只有**用户文本 + vision 文本结果**；原图 base64 只在内存态附件 store，**不入** `serializeForStorage`。
  - **加 serialize-test 守门**：扩展现有 `src/store/chat.test.ts` 白名单测试，断言任何附带的多模态/附件 base64 在序列化时被剥离（结构性守门 = memory `feedback_recurring_failure_add_gate`）。

### 失败 & 边界 UX（Q4，结构化错误 + 诚实引导）
- **D-13（三类结构化错误，沿用 `{code,message,recoverable,hint}`）:**
  - 选区不是图（文字/空选区）→「请先选中一张图片或图表，或点回形针上传一张图」
  - 取图 API 失败（spike 风险）→「当前无法读取选中图（宿主限制），可点回形针上传这张图」
  - 没配 aihubmix key（vision 需 aihubmix key）→「请先在设置里填 aihubmix Key」
- **D-14（诚实不撒谎）:** 非图片文件上传（Phase 15 阶段）→「文件解析即将开放，当前可上传图片」——诚实标注「开发中」，不冒充已支持（memory：诚实失败、不假成功）。

### Claude's Discretion
- `focus` 参数的具体 prompt 措辞；单图大小上限阈值；多图时 vision content array 的组织（一次调用塞多张 vs 多次）。
- 上传图内存态 store 的结构（放 chatStore 旁的独立内存 slice，还是消息上的 transient 字段）；vision 结果注入 sendMessage 的具体形态（augmented prompt 前缀 vs 独立 evidence 消息）——倾向沿用「附件文本拼到 prompt 头部」范式（SUMMARY L67）。
- `get_shape_image` 的代码组织（adapter `ReadableQuery` 新增 `get_shape_image` kind + read ToolDef）；三宿主取图的具体 Office.js API 选择（spike 决定）。
- 缩略图预览 UI（composer 里上传图的 chip/缩略图）——可能值得单独跑 `/gsd-ui-phase`。

### Folded Todos / Requirements
- **FILE-06（图片上传附件 → aihubmix-vision）整条从 Phase 17 前移至 Phase 15**（本次讨论核心范围变更）。Phase 15 同时交付「上传图」的最小入口（激活回形针 + 粘贴 + 多图 + 内存态），Phase 17 复用此入口推广到文档类型。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求 + 路线（标准对照）
- `.planning/REQUIREMENTS.md` — VIS-01 / VIS-02 / **FILE-06**（已前移 Phase 15）/ NFR-09 完整需求文 + VIS 段「范围更新」note + §Traceability。
- `.planning/ROADMAP.md` §Phase 15 — Goal + 4 条 Success Criteria（本 CONTEXT 标准对照）；§Phase 17 已收窄（FILE-06 移出）。

### 视觉架构真相源（最重要）
- `.planning/research/SUMMARY.md` — **L65「Vision = READ TOOL，非消息层 image_url augmentation，零改 loop.ts」**、L67「图片附件走 vision client 一次性调用 / 解析文本拼到 sendMessage prompt 头部」、L43「选区驱动半隐式 / 无单独上传按钮」、L54「不做 Copilot 式全自动 context 包含（成本不可控）」、L18/L74「base64 进 history = 配额炸 + 重放死循环，设计契约」、L77「DeepSeek-V4 vision 仅文本，fallback aihubmix」。
- `.planning/phases/14-mdl-aihubmix-provider-model-casing/14-CONTEXT.md` — 上游地基决策：D-06 默认 vision model = `gpt-5.4`（`/v1/models` 已确认）；vision client 由 `resolve('vision')` 提供；apiKey 仅进 header（T-01-04）；错误沿用 `mapHttpError`/`NetworkError`/AsterError。
- `.planning/spikes/004-deepseek-multimodal/findings.md` — DeepSeek-V4 非原生多模态（FAIL，不止损）→ 视觉锁 aihubmix-vision 的根据。

### 改动/消费目标代码（scout 实证，file:line）
- `src/providers/aihubmix-vision.ts` — **要消费的 vision 客户端**：`AihubmixVisionClient.analyze(userText, imageBase64, mimeType, config) → { content: string }`（L26-71）；裸 base64 入参，内部拼 `data:${mimeType};base64,...`（L52）；**目前未被 agent loop 调用**（Phase 14 建好未接线）。focus 参数 + 多图需扩展其签名。
- `src/providers/registry.ts` — `resolve('vision')` 返回 `ImageConfig`（model=`gpt-5.4`，L112-123）。
- `src/agent/tools/read/ppt.ts` / `excel.ts` / `word.ts` — read tool 范式（schema + `kind:'read'` + `execute → wrapReadResult`）；`get_shape_image` 照此新增。
- `src/agent/tools/index.ts` — `dispatchTool`（L169-219，15s 超时 + sanitize allowlist）、`ToolResult`（L84-104）、`buildToolsForHost`（L242-295，新工具在此按宿主注册）、Phase 14 中央 `normalizeToSnakeCase`（PPT）。
- `src/adapters/DocumentAdapter.ts` — `SelectionContext`（L16-33，PPT 含 `selectedShapeId`/`selectedShapeType`）、`ReadableQuery` 判别联合（L164-179，**新增 `get_shape_image` kind 处**）、`ReadableResult`（L210-212）、adapter 接口（L231-266）。三宿主 `PptAdapter`/`ExcelAdapter`/`WordAdapter` 各实现 `read()` + `getSelection()`。
- `src/agent/loop.ts` + `src/agent/loop-helpers.ts` — `WireMessage`（L23-41，**目前 content 全是纯 string**）、消息装配（loop.ts L70-77）、单模型 per-run（loop.ts L33-44 `resolveLLMConfig`，无 per-turn 切模型）。上传图注入点参考此处。
- `src/store/chat.ts` — `saveHistory` / `serializeForStorage`（L111-131）/ `StorableMessage`（`{id,role,content,ts}`，仅 user|assistant、content≤2000 字）—— **NFR-09 守门落点**。`src/store/chat.test.ts`（L204-224 白名单测试，**扩展断言剥离 base64**）。
- `src/components/InputBar.tsx` — **L144-153 现有禁用回形针**（`aria-disabled`、title=「文件上传即将开放」、opacity 0.38、无 onClick）= 上传入口激活点（D-08）。
- `src/components/SelectionPill.tsx` — 选区胶囊 + `attachEnabled`（眼睛 toggle，与 SettingsPanel 双向绑定）；D-06 不改它。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`AihubmixVisionClient`（`src/providers/aihubmix-vision.ts`）**：Phase 14 已建好、已对齐 gpt-5.4、OpenAI image_url 格式正确——**Phase 15 的主要工作是「接线」而非重建**（接进 read tool + 上传路径）。需扩展签名以支持可选 focus + 多图。
- **read tool 范式 + `wrapReadResult` + `dispatchTool`**：11 个现有 read tool（PPT/Excel/Word）可照抄结构；`get_shape_image` 是第 12 个 read tool。
- **`ProviderRegistry.resolve('vision')`**：vision 配置注入路径已就位（含未配 key 抛 `KeyInvalidError`）。
- **错误体系 `mapHttpError`/`NetworkError`/AsterError + dispatch sanitize 边界**：D-13 结构化错误沿用，apiKey 不泄露。
- **InputBar 禁用回形针 + 诚实禁用范式**：上传入口已预留位（激活即可，符合设计系统「诚实禁用→开放」）。

### Established Patterns
- **图片 base64 不进 message / 不进 history 是设计契约**（不是事后补丁）——read-tool 模式天然隔离 base64 在 tool 执行内。
- **附件内容注入 = augmented user prompt**（SUMMARY L67 / FILE-07 范式）：上传图的 vision 结果文本沿用此注入方式。
- **主 LLM 单模型 per-run、不多模态**：所以视觉必须走独立 aihubmix-vision 调用，不能指望主模型看图。
- **PPT 工具 snake_case + 中央 normalize（Phase 14 D-10）**：`get_shape_image` 若是 PPT 工具，schema 用 snake_case。

### Integration Points
- `get_shape_image`：新增 `ReadableQuery` kind（`src/adapters/DocumentAdapter.ts`）+ 三宿主 `read()` 各加取图 case + read ToolDef 注册进 `buildToolsForHost`。
- 上传图：InputBar 回形针 onClick + 粘贴 handler → 内存态附件 store → 发消息时一次性调 vision → 结果注入 prompt（sendMessage 链路）。
- NFR-09 守门：`serializeForStorage`（`src/store/chat.ts`）+ `chat.test.ts` 扩展。

</code_context>

<specifics>
## Specific Ideas

- **用户原话场景：** 「客户可能传一张图给 Aster，然后用户意图类似于基于这张图生成对应的文档」——这是 Phase 15 的北极星场景，驱动了 D-03（focus 参数，要抽可写细节）和 FILE-06 前移（上传是核心入口）。
- **「看图不只是文档里的图，还可能是用户自己上传的图」**（用户讨论中点出的关键认知）——直接导致 FILE-06 从 Phase 17 前移、Phase 15 重新定义为「所有看图」。
- **粘贴优先于拖拽**：用户要 Ctrl+V 粘贴（截图即贴，体验好且 iframe 内可靠），明确不做拖拽。
- **多图**：用户要一次能传多张（vs MVP 单张推荐），planner 需处理 vision 多图 content array。

</specifics>

<deferred>
## Deferred Ideas

- **拖拽上传** — 用户明确不做（Office for Web 宿主/浏览器 drag-drop 不稳）。
- **圈选单元格/幻灯片区域截图当图看** — Q2 未选，取图 API 复杂、spike 风险大；未来按需。
- **docx/xlsx/pdf/pptx 文本解析 + 附件 chip「仅供 AI 阅读」+ FILE-07 完整边界** — Phase 17（复用 Phase 15 的回形针上传入口）。
- **生图插入（Phase 16）、图库检索（Phase 18）** — 各自阶段。
- **DeepSeek-V4 原生多模态验证** — VIS-D1，v2.2 跳过（未来扩用户/降本时重评）。

### Reviewed Todos (not folded)
- **`builtin-model-dropdown`（high，todo.match-phase 命中 0.6）** — 与 VIS 无关（是 Provider model 下拉），且 STATE 已记其「陈旧/已由 v2.0 CARRY-02 交付」。**不折入 Phase 15**；留待清理。

</deferred>

---

*Phase: 15-vis*
*Context gathered: 2026-06-01*
