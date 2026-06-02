# Phase 16: IMG — 图片生成插入（PPT + Word） - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

PPT / Word 的「生成一张图并插入」**write tool**：agent 调已建好的生图 provider（`AihubmixImageClient`）→ **预览后用户确认再插入**（非直接插入）→ 插入到当前 slide（PPT）/ body（Word）→ 可撤销、生图 model 可选、可一键重新生成。Excel 明确 out-of-scope（无原生插图 API），在工具/文案层诚实表达。产出**可复用 insert helper** 供 Phase 18（图库检索）复用。

**In scope:** IMG-01（PPT 生图插入 + undo via `deleteShapeById`）、IMG-02（Word 生图插入 + `noop_inverse` 诚实标注）、IMG-03（预览确认 + 生成中 loading）、IMG-04（model 可选 + 重新生成）、IMG-05（Excel 诚实 out-of-scope）。

**Out of scope（新能力，属其它 phase）:** 公开图库检索（Phase 18 LIB）；文件上传解析（Phase 17 FILE）；视觉看图（Phase 15 已交付）；chat LLM model 下拉选择（todo，非生图范围，见 Deferred）。

</domain>

<decisions>
## Implementation Decisions

### 预览-确认交互形态（IMG-03，全新交互范式）
- **D-01（预览容器 = 聊天气泡内 teal 预览卡）:** 生图预览（图 + 「确认插入 / 重新生成 / 取消」按钮）嵌在 AI 回复气泡下方的预览卡里，复用现有 teal 卡片样式，与 DiffLogPanel 等现有 UI 一致。不用居中 Modal（Task Pane ~320px 窄、打断对话流），不用 Task Pane 独立预览区（抢占聊天空间）。
  - **缩略图渲染：** `<img src="data:${mimeType};base64,${base64}">`（provider 返回裸 base64 + 独立 mimeType，预览时自己拼 data URL —— Phase 14 D-01/D-04）。
- **D-02（生图与插入彻底解耦，loop.ts 零改动）:** 生图工具**只产出预览、无副作用**即返回；agent 本轮 loop 正常结束并提示「图生好了，确认插入？」。**插入是预览卡按钮触发的独立动作**，完全脱离 agent loop。
  - **关键约束：** 插入动作执行后必须**手动把这步写入 `operationLog`**（带 `humanLabel` + `reverse` descriptor），让「撤销该步 / Undo All」照常工作（IMG-01 PPT 用 `deleteShapeById`，IMG-02 Word 用 `noop_inverse`）。
  - **理由：** 不动 loop 最干净，符合 Phase 15「loop.ts 核心零/极小改动」价值；避免给 loop 加「人类介入暂停」新状态（复杂度高）。推翻了「暂停 loop 等确认」备选。
  - **下游注意：** 因为插入不经 `dispatchTool` 标准路径，要确保它仍走 Phase 14 D-10 的中央 `normalizeToSnakeCase` 等价路径 / 或直接调 adapter 方法（adapter inverse 签名收 `Record` 对象，非位置参 —— memory `project_adapter_inverse_signature`）。

### 生图 prompt 处理（IMG-04 相关，质量决策）
- **D-03（agent 智能增强中文 prompt）:** agent 把用户的简短描述（「生成一张落日的图」）**扩写成更具体的中文 prompt**（主体 / 风格 / 构图等），**保留用户原意**，再喂给生图 model。不做原话直传（简短描述出图质量差），不翻译成英文（doubao/gemini 中文 prompt 支持已足够好，翻译可能失真用户意图）。
  - **理由：** 用户核心场景是「生成能直接用的配图」，质量优先（memory `project_quality_over_cost`：质量 >> 成本 & 包体积）。

### model 切换 + 重新生成（IMG-04）
- **D-04（model 切换双落点：Settings + 预览卡内联）:** Settings 里有生图 model picker 选**持久默认**（读 Phase 14 已建好的 `IMAGE_GEN_MODELS` 注册表，3 model + metadata）；预览卡里也能**临时切 model 重生**（「这张不行，换 gpt-image-2 试」）。最灵活。
- **D-05（「重新生成」= 同 prompt 重 roll、替换）:** 一键再试**同 prompt**（生图有随机性），新图**替换**预览卡里旧图；可配合 D-04 预览卡内联切 model 一起用。符合 IMG-04「最低成本再试路径」。不做多候选并排堆叠（占空间 + 多张 base64 内存压力大，与 NFR-09 内存态谨慎）。
  - **澄清：** 「可编辑 prompt 再生」不作默认交付，归 Claude discretion（若预览卡空间允许、低成本可加 prompt 文本框作增强项）。

### 插入位置 / 尺寸（IMG-01 / IMG-02）
- **D-06（PPT = 当前 slide 居中 + 按比例合理默认尺寸，Claude 定）:** 图插到当前 slide 居中，按图比例给不超出 slide 的合理默认大小；用户事后可在 PPT 里自行拖拽调整。不做 agent 语义放置（定位 API spike 风险、易错），不做预览卡指定位置/尺寸（Task Pane 窄、过度工程）。
- **D-07（Word = body 级追加，已锁）:** `body.insertInlinePictureFromBase64`（body 级，**非 range** —— Office for Web 已知 bug 强制 body 级，ROADMAP IMG-02 锁定）。

### 生成中 loading + 取消（IMG-03）
- **D-08（「生成中」态 + 可取消）:** 预览卡/气泡显示「生成中」态（生图不可流式、一次性整块返回；doubao 几秒，gpt-image-2 high ~90s+），用户可**取消**（AbortController）。沿用现有 loading 范式 + AgentControlBar 停止能力。不做「仅 loading 不可取消」（90s+ 卡死无解）。

### Excel out-of-scope（IMG-05，诚实表达）
- **D-09（per-host 不注册该工具 + agent 诚实告知）:** 生图插入工具**只在 PPT / Word 宿主注册**，Excel 宿主下 agent 的工具表里**不含**该工具；用户在 Excel 里要求生图插入时，agent 诚实回答「Excel 无原生插图 API，暂不支持插图」。不假装支持（memory：诚实失败、不假成功 = `project_ppt_officejs_gotchas` / Phase 15 D-14）。

### Claude's Discretion
- 三类结构化错误沿用 Phase 15 D-13 范式 `{code,message,recoverable,hint}`，本阶段三类 = ①未配 aihubmix key（生图需 aihubmix key）②生成失败/超时（含取消）③宿主插图 API 失败（PPT spike 风险 → fallback 诚实提示）。
- insert helper 抽象形态（独立 `insertImage(host, base64, mimeType, opts)` helper，供 IMG-01/02 与 Phase 18 LIB 共用）；helper 与 operationLog 记录的衔接方式。
- 预览卡组件结构、按钮布局、生成中骨架/spinner 选型（遵循 `aster-design-system` skill）。
- prompt 增强的具体措辞 / system prompt 注入方式；增强是 agent 在 tool 入参里自己写好 prompt，还是工具内部再加工。
- gemini 解析跳过 `thoughtSignature`（~1.5M 字符）只取 `inlineData.data` —— Phase 14 provider 已处理；本阶段直接用 provider 返回的 `{base64,mimeType}`。
- doubao fetch→base64 已在 provider 内完成（Phase 14 D-02），本阶段插入层零感知 URL。

### Folded Todos
- **`builtin-model-dropdown.md`（DeepSeek + AiHubMix 内置 model 下拉）的「生图 model 下拉」部分** 折入本阶段 = D-04 的 Settings 生图 model picker。Phase 14 D-08 明确把此 picker UI 留给 Phase 16，本阶段用 `IMAGE_GEN_MODELS` 注册表渲染下拉。（其「chat LLM model 下拉」部分超出生图范围，见 Deferred。）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents（researcher / planner）MUST read these before planning or implementing.**

### 需求 + roadmap（WHAT 锁定）
- `.planning/ROADMAP.md` §Phase 16（L130–141）— Goal / IMG-01..05 / Success Criteria / spike 要求 / 依赖 Phase 14
- `.planning/ROADMAP.md` §Cross-cutting constraints（L126）— base64 不进 message/serialize、apiKey 仅 header、三类结构化错误、PPT 取图 fallback、零新增依赖、bundle ≤82KB
- `.planning/REQUIREMENTS.md` IMG-01..05（L29–33）

### 生图 provider 契约 + wire format（已实测，直接用）
- `.planning/spikes/011-image-gen-api-formats/findings.md` — 三 model 三套 wire format 真机实测（doubao predictions/URL、gpt-image-2 predictions/base64、gemini streamGenerateContent/base64）；插入层不直接碰，但理解 provider 行为必读
- `.planning/phases/14-mdl-aihubmix-provider-model-casing/14-CONTEXT.md` — D-01/02/04（provider 返 `{base64,mimeType}` 裸 base64、doubao URL 内部转换）、D-05/08（`IMAGE_GEN_MODELS` 注册表 + 默认 doubao + 留给 Phase 16 的 picker）、D-09/10（PPT casing 中央 `normalizeToSnakeCase`，新工具用 snake_case）
- `src/providers/aihubmix-image.ts` — `AihubmixImageClient.generate(prompt, config, options)` 已建好（**尚未接进 agent loop**），返回 `ImageGenResult`
- `src/providers/registry.ts` L38–76, L125–136 — `IMAGE_GEN_MODELS` 列表 + `ImageGenModel` 接口（id/label/endpointKind/authKind/isDefault）+ `image-gen` taskKind 路由（默认 doubao、apiKey via `AIHUBMIX_PROVIDER_ID`）

### 插入 / undo / 工具注册范式（净新增代码的对照样板）
- `src/agent/tools/index.ts` L115–122 — `ToolDef` 接口（name/description/parameters/humanLabel/execute/kind）
- `src/agent/tools/write/ppt.ts` L364–420 — `add_shape` execute + `reverse:{tool:'delete_shape_by_id', args:{slide_index, shape_id}}`（IMG-01 undo 复用样板）；L463–507 — `noop_inverse` 用法（IMG-02 Word undo 样板）
- `src/agent/tools/write/word.ts` L46–75 — Word write tool 样板 + reverse.args 必须 Record 对象（**非位置参** —— memory `project_adapter_inverse_signature`）
- `src/adapters/PptAdapter.ts` L1653–1694 — `deleteShapeById(args: Record)` 实现；**PPT 插图 adapter 方法净新增**（spike 决定 `addImageFromBase64` BETA vs `setSelectedDataAsync` GA）
- `src/adapters/WordAdapter.ts` — **Word 插图 `insertInlinePictureFromBase64` 净新增**（body 级）
- `src/agent/operationLog.ts` L53–69, L174, L456–457 — `OperationLogEntry` 结构 + inverse replay 调用签名 `adapter[method](reverse.args)`（全 dict，非展开）；D-02 解耦插入需手动 `appendOperation`

### UI / 设计系统
- `aster-design-system` skill（自动加载）— teal 克制设计 token + 卡片/按钮组件类名 + 反模式（预览卡 + Settings picker 遵循）
- `.planning/design/aster-redesign/`（设计真相源；以 `src/styles.css` 为像素级真相）

### 项目硬约束 / 记忆
- memory `project_ppt_officejs_gotchas` — PPT snake_case 参数、网页版写操作静默 no-op 需写后回读验证（spike「写后回读」要求的来源）
- memory `project_adapter_inverse_signature` — inverse/read 方法收 Record 对象，新 inverse 补 `operationLog.integration.test` 守门
- memory `project_quality_over_cost` — 质量 >> 成本 & 包体积（prompt 增强、默认更强 model 的依据）；但 undo 守门 / bundle gate / P95 仍硬卡

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets（直接复用，不重造）
- **`AihubmixImageClient`**（`src/providers/aihubmix-image.ts`）：生图客户端已建好，返回 `{base64, mimeType}` 裸 base64 —— 插入层直接喂。**仅差「接进 agent loop」**。
- **`IMAGE_GEN_MODELS` + registry `image-gen` 路由**（`src/providers/registry.ts`）：model 注册表 + metadata + 默认 doubao + apiKey 解析全就绪 —— Settings picker（D-04）直接读这个列表渲染。
- **`add_shape` / `deleteShapeById` 范式**（ppt.ts + PptAdapter.ts）：IMG-01 的 PPT undo 直接复用 `delete_shape_by_id` reverse（创建时捕获 shape id 写 `reverse.args`）。
- **`noop_inverse` 范式**（ppt.ts L463–507 + operationLog 替换分支）：IMG-02 的 Word undo 直接复用，humanLabel 照常显示、DiffLog 标「此操作不支持自动撤销」。
- **DiffLogPanel + AgentControlBar**：插入后照常进 DiffLog 可撤；AgentControlBar 停止能力供 D-08 取消生成复用。
- **teal 卡片样式 + 三类结构化错误 `{code,message,recoverable,hint}`**（Phase 15 D-13）：预览卡 + 错误 UX 复用。

### Established Patterns（约束 / 必须遵循）
- **adapter inverse 签名收 `Record` 对象、非位置参**（memory `project_adapter_inverse_signature`）—— 新增插图 adapter 方法 + 其 inverse 都遵守，并补 `operationLog.integration.test` 守门。
- **PPT 工具 schema 用 snake_case + 中央 `normalizeToSnakeCase`**（Phase 14 D-09/10）—— 新生图工具入参用 snake_case。
- **per-host 工具注册**（现有架构按宿主装工具表）—— IMG-05 Excel 不注册该工具（D-09）。
- **网页版写操作可能静默 no-op**（memory `project_ppt_officejs_gotchas`）—— PPT 插图必须**写后回读验证**（spike 强制项，防 v2.1「假成功」重演）。
- **base64 永不进 `serializeForStorage` / message.content**（Phase 15 D-12 / NFR-09）—— 预览/插入全程 base64 只活在内存态 + 插入 API 入参，扩展 serialize 守门测试断言被剥离。

### Integration Points（净新增代码连接点）
- **生图工具接进 agent**：新增 PPT/Word 生图 write tool（`generate_*_image` 类）注册到对应宿主工具表，调 `AihubmixImageClient`（registry `image-gen` 路由）。
- **预览卡 → 插入动作 → operationLog**（D-02 解耦）：预览卡按钮调 insert helper（直接 adapter 调用）→ 成功后手动 `appendOperation`（带 reverse）。
- **PptAdapter / WordAdapter 新增插图方法**：`addImageFromBase64`（PPT，spike 定 API）/ `insertInlinePictureFromBase64`（Word body 级）+ 各自 inverse（PPT `deleteShapeById` 复用 / Word `noop_inverse`）。
- **Settings 生图 model picker**（D-04）：SettingsPanel 新增下拉读 `IMAGE_GEN_MODELS`，存默认 model 到 provider config。
- **insert helper 抽象**（criterion 4）：供 IMG-01/02 + Phase 18 LIB 共用的统一插图入口。

</code_context>

<specifics>
## Specific Ideas

- 预览卡按钮文案：「确认插入 / 重新生成 / 取消」（D-01）。
- 重新生成 = 同 prompt 重 roll、新图**替换**预览（D-05），不堆叠候选。
- model 切换示意场景：「这张不行，换 gpt-image-2 试」—— 预览卡内联切 model + 重生（D-04 + D-05）。
- gpt-image-2 high 质量 ~90s+，是「可取消」必要性的具体来源（D-08）。
- 默认生图 model = `doubao-seedream-5.0-lite`（最快，满足 P95≤10s；Phase 14 D-05）。

</specifics>

<deferred>
## Deferred Ideas

- **可编辑 prompt 再生**（预览卡加 prompt 文本框改了再生）：本阶段「重新生成」只交付同 prompt 重 roll（D-05）；编辑式再生归 Claude discretion 的可选增强，非硬交付。
- **agent 语义放置插图位置**（「插到右下角」算坐标）：定位 API spike 风险，本阶段 PPT 固定居中（D-06）；若未来需要再开 phase。
- **多候选并排选图**：占空间 + 多张 base64 内存压力，本阶段不做（D-05）。

### Reviewed Todos (not folded)
- **`builtin-model-dropdown.md` 的「chat LLM（DeepSeek）model 下拉」部分**：超出 Phase 16 生图范围。本阶段只折入其「生图 model 下拉」部分（见 Folded Todos）；chat LLM model 选择下拉是独立 UX 改进，留待后续 UI/Settings 相关 phase 或 backlog。

</deferred>

---

*Phase: 16-img-ppt-word*
*Context gathered: 2026-06-02*
