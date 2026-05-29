# Phase 4: Read Tools 全套 + AgentControlBar 步骤文案 - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

让 LLM 能「先看再做」——三宿主只读接口 + 11 个离散 read tools 全部上线，Phase 3 埋的 Error 协议骨架（circuit-breaker）真正流转生效，AgentControlBar 加「步骤差异化文案」+ 5 秒无更新 debug 入口，并落 CARRY-02 model 下拉。

**这个 phase 交付：**

1. **`adapter.read(query)` 三宿主只读接口（TOOL-01）** — per-query 离散 read，禁 fat `inspect()` 返整 doc model
2. **11 个 read tools 全套（TOOL-02）** — 跨宿主 `selection_detail`；PPT `list_slides`/`get_slide`/`list_shapes_on_slide`/`get_shape`；Excel `list_worksheets`/`get_range_values`/`get_used_range_summary`；Word `get_paragraph_count`/`get_paragraph_at`/`get_document_outline`/`get_document_full_text`
3. **read 防 prompt injection 包装 + size cap（TOOL-05/06）** — `{result_type:'document_content'|'metadata', content, source}` 包装；>10K cells 拒绝 full 强制 summary；>50K tokens 截断带 `truncated:true`
4. **纯数据进出强制（TOOL-07）** — eslint 禁 `Excel.*`/`Word.*`/`PowerPoint.*` 命名空间出 `*.run` 闭包（Phase 3 已埋 rule，本 phase 确保覆盖 read tool）
5. **Circuit breaker 真正生效（ERR-03）** — Phase 3 骨架 `isOpen()` 永返 false，本 phase 填 sliding window：(tool name × error code) 最近 5 次内 ≥3 次同 code 失败 → `CIRCUIT_OPEN` 强制 abort
6. **「Agent gave up」红卡（ERR-04）** — 熔断 abort 后红色卡片说明 + 「重新试试」入口
7. **AgentControlBar 步骤差异化文案 + 5 秒卡住入口（AGENT-12）** — 读/LLM 思考/写 三态文案；5 秒无 UI 更新触发安抚 + 当前在等什么
8. **CARRY-02 model 下拉** — 内置 DeepSeek/AiHubMix 的 model 字段改固定 select；自定义 Provider 保留手动输入

**这个 phase 不交付（Out of scope，避免 scope creep）：**

- 不做：Write tools 多宿主铺开（PPT new_slide / Excel apply_formula / Word replace_paragraph）—— Phase 6
- 不做：DiffLogPanel UI 卡片 + undo all 真实回放 —— Phase 5（read tool 是 Phase 5 inverse op 抓 before-image 的前提，但 inverse 回放本身是 Phase 5）
- 不做：OperationLog 完整 reverse 实现 —— Phase 5
- 不做：「测试 tool calling」按钮 / A-21 model 兼容性矩阵 —— Phase 7
- 不做：图片上传 → 多模态视觉 model 看图说话 → 文字喂回 DeepSeek 的视觉预处理流程 —— **新能力，deferred 到 Phase 6 / 专门多模态 phase**（见 Deferred Ideas）
- 不做：生图 / 视觉识别真实消费 —— Phase 6（本 phase 仅更新 registry 过时常量）
- 不做：Privacy opt-out 路径 / Provider 切换 banner —— PRIV-* 在 /gsd-discuss-phase 3 整批砍

</domain>

<decisions>
## Implementation Decisions

### 读取步骤的 UI 露出 + 文案（AGENT-12 / ONB-02 flavor / SC1 / SC3）

- **D-01:** **read 步骤也进聊天折叠卡，默认折成一行。** 复用 Phase 3 已有的 `role='tool'` 折叠卡渲染（ChatStream 现成路径），文案走 `humanLabel(args)` 中文人话「读取了第 5 张幻灯片的形状清单」。默认折叠只占一行，点击展开看 read 结果。与 write tool 一致 + 透明可回看 + 不太刷屏。**不走** bar-only 或「结束汇总卡」方案。
- **D-02:** **AgentControlBar 顶部固定 bar 显示当前 step 差异化文案（A-12 三态区分）。** 「读取 / LLM 思考中 / 写入」三类各自不同文案（如「步骤 3/?: 正在读取第 5 张幻灯片…」「正在思考…」「正在写入…」），不是统一 spinner。Phase 3 已落的 pause/abort/step counter 不动。
- **D-03:** **5 秒无 UI 更新 debug 入口 = 安抚文案 + 当前在等什么。** agent 5 秒没动静时露一行「还在跑，正在等 LLM 思考… / 正在读取大区域…」让用户知道是慢不是死；**不加**额外「复制日志」按钮（copy step log 是 Phase 5 CARRY-03）、**不加**「中止」高亮强引导（abort 一直在顶部 bar，够用）。文案语气随三态（读/思考/写）。

### 错误恢复 UX（ERR-03 / ERR-04）

- **D-04:** **Circuit breaker 完整 sliding window（填 Phase 3 骨架）。** 维度 = (tool name × error code)，最近 5 次调用内 ≥3 次**同 code**失败 → `isOpen()` 返 true → 强制 abort。**中间穿插成功不重置 counter**（PITFALLS A-10）。`src/agent/circuit-breaker.ts` 的 `recordSuccess`/`recordFailure`/`isOpen` 从骨架填实，loop/dispatch 调用点 Phase 3 已埋。
- **D-05:** **「Agent gave up」红卡 = 只说明 + 「重新试试」。** 熔断强制 abort 后红色卡片说明「试了 X 次都失败（如 write_locked），建议 Y」——X 来自 circuit log 计数，Y 来自 LLM 最后一次给的建议。提供一个「重新试试」入口（重开一轮 agent run）。**不给「撤销本次」按钮**——undo all 真实回放是 Phase 5，本 phase 给了只能出占位 toast，与用户「诚实禁用 / 不造假功能」偏好冲突。

### CARRY-02 model 下拉（含 folded todo `builtin-model-dropdown`）

- **D-06:** **内置 Provider model 字段改固定清单 `<select>` 下拉；自定义 Provider 保留手动 `<input>` 输入。** ProviderForm 里 `isBuiltIn` 分支：内置走 select，自定义走现有 text input（已锁，SC6）。理由：v2 高频切 model（pro vs flash 路由），下拉一点即换不用手打字符串。
- **D-07:** **下拉清单内容：**
  - **DeepSeek agent 下拉**：`deepseek-v4-pro` / `deepseek-v4-flash`
  - **AiHubMix agent 下拉**：`gpt-5.1` / `gemini-3.5-flash`（会 tool calling 的多模态聊天 model，能驱动 agent loop）
- **D-08:** **架构意图锁定：主 agent LLM 始终是 DeepSeek。** AiHubMix 的角色是视觉 + 生图辅助，不是 agent 主脑（用户明确：「主要的 LLM 还是 DeepSeek」）。AiHubMix agent 下拉存在仅为「用户想把 AiHubMix 设为默认 LLM」的可能性兜底，默认路径仍是 DeepSeek 驱动。
- **D-09:** **顺手更新 `registry.ts` 过时常量（低风险，真实消费留 Phase 6）：**
  - `AIHUBMIX_VISION_MODEL`：`gpt-4o` → `gpt-5.1`（备选 `gemini-3.5-flash`）
  - `AIHUBMIX_IMAGE_MODEL`：`gpt-image-1` → `gpt-image-2`（备选 `gemini-3.1-flash-image-preview`）
  - **仅改常量**，vision/image-gen 调用路径本 phase 不接（Phase 6）。

### 全 phase 约束（沿用 Phase 3，适用所有 plan）

- **D-10:** 净新增运行时依赖 = **0**（NFR-02）；bundle 实测维持 ~70KB 基线（Phase 3 落 75.82KB ≤ 80KB safety），新增 read tool / circuit-breaker / 文案逻辑全进主 chunk，超 5KB gzipped 新依赖要 challenge。
- **D-11:** UI 改动一律走 `src/styles.css` CSS 变量 + `src/components/icons.tsx` 内联 SVG；不引图标库 / 不上 emoji；两套主题（light/dark）都顾到（CLAUDE.md §UI 设计系统 / [[feedback-beauty-over-fluent]]）。
- **D-12:** read result size cap：单 result 50K tokens hard cap（超则截断带 `truncated:true`）；Excel `get_range_values` 选区 >10K cells 拒绝 full mode、返 error 引导走 `get_used_range_summary`（TOOL-06 / A-24）。截断/拒绝的具体 token 估算方式与 UX 提示 = Claude's Discretion。
- **D-13:** read tool schema 显式倾向 batch（`list_slides` 一次性返全部，禁止设计成 `get_slide_one_by_one` 逐张拉），避免 LLM 把任务拆成 20 个 micro call 触发 max_steps 软着陆（A-07）。system prompt batch 倾向 Phase 3 已埋，本 phase read tool schema 配合。

### Claude's Discretion

planner 根据 research + 现有代码拍板，不需用户预决：

- read tool 接口（`ReadableQuery` / `ReadableResult` 类型形态、`adapter.read()` 各宿主实现内部结构）
- read 折叠卡展开后显示什么（结构化预览 vs raw content 截断）
- size cap 的 token 估算实现（字符数近似 vs 真 tokenizer——cost 砍后无 tokenizer，倾向字符近似）+ 截断后给 LLM/用户看到的提示文案
- circuit breaker sliding window 内部数据结构（Phase 3 已留 `_failureCounts` Map 形态）
- 三态差异化文案 + 5 秒安抚的具体措辞（保持「不打扰」气质 + ONB-02 中文人话）
- 「Agent gave up」红卡的视觉细节（红色 accent 走 CSS token，玻璃拟态延续）
- ProviderForm select 的具体交互（受控 select / 内置 vs 自定义分支渲染）
- read result 包装 `{result_type, content, source}` 的 source 字段取值约定

### Folded Todos

- **`builtin-model-dropdown.md`**（Phase 02.1 UAT 反馈，已 tag `resolves_phase: 4`）→ **折入 CARRY-02 / D-06~D-07**。原问题：内置 Provider 的 model 靠手打字符串、易错、切换麻烦；本 phase 改固定 select 下拉解决。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents（researcher / planner / executor）MUST 读这些，决策依据全在里面。**

### 项目级（必读）
- `.planning/ROADMAP.md` — Phase 4 段（goal / 6 条 SC / 4 条 Risk A-04/A-05/A-07/A-12/A-21 / Out of scope）。**注意 SC3 步骤文案 / SC5 circuit breaker / SC6 model 下拉直接对应本 CONTEXT D-02/D-04/D-06**
- `.planning/REQUIREMENTS.md` — 本 phase 范围 = AGENT-12 / ERR-03 / ERR-04 / TOOL-01 / TOOL-02 / TOOL-05 / TOOL-06 / TOOL-07 / CARRY-02；§Traceability 确认归属；PRIV-* 全砍（read 默认全开）
- `.planning/PROJECT.md` — Core Value / 5 条硬约束（无后台 / Bundle / Performance / Security / Compatibility）；Q7 单文档边界（read 只在当前打开的单文档内）
- `CLAUDE.md` — §技术栈表 / §UI 设计系统（CSS 变量 + 内联 SVG，红卡 accent / 三态文案视觉）/ §发布授权 / DeepSeek+AiHubMix API（model 清单参考）

### 研究产出（必读）
- `.planning/research/PITFALLS.md` — **A-10 circuit breaker 中间成功不重置（D-04 核心）** / A-07 step runaway（D-13 batch 倾向）/ A-12 干等被当卡死（D-02/D-03）/ A-24 Excel 100K 行 OOM（D-12 size cap）/ A-05 prompt injection（TOOL-05 包装）
- `.planning/research/ARCHITECTURE.md` — v1 集成路径 + Message schema + anti-patterns（AP-2 全文 snapshot 进 system prompt → read tool 按需获取就是其解药）
- `.planning/research/FEATURES.md` — read tool inventory（11 个 tool 的出处）+ Agent UX patterns

### Phase 3 上游产物（Phase 4 直接消费）
- `.planning/phases/03-agent-loop-privacy-word-demo/03-CONTEXT.md` — Phase 3 全部 D-01..D-26；尤其 D-07（模块结构）/ D-14~D-16（错误协议四字段 + sanitize allowlist，ERR-03/04 在其上扩展）/ D-13（humanLabel eslint rule，Phase 5 flip，但 read tool 也要 humanLabel）
- `.planning/phases/03-agent-loop-privacy-word-demo/03-RESEARCH.md` — agent loop / tool registry / sse.ts 多 tool 累积研究
- `.planning/phases/03-agent-loop-privacy-word-demo/03-PATTERNS.md` — 文件→pattern 映射

### 关键源文件（plan 的 read_first 候选）

**read tool 新增的归宿：**
- `src/adapters/DocumentAdapter.ts` — 加 `read(query: ReadableQuery): Promise<ReadableResult>` 接口（现接口只有 getSelection/onSelectionChanged/capabilities/insert）
- `src/adapters/{Ppt,Excel,Word}Adapter.ts` — 各宿主实现 `read()` + 11 个 read tool 的 adapter 层操作（纯数据进出，proxy 不出 `*.run`）
- `src/agent/tools/read/word.ts` — Phase 3 占位 `get_paragraph_count`（现 execute 返 UNSUPPORTED），本 phase 填实 + 加 Word 其余 read tools
- `src/agent/tools/read/{ppt,excel}.ts`（新增）— PPT/Excel read tools
- `src/agent/tools/index.ts` — `buildToolsForHost` 现 excel/ppt 返空数组，本 phase 接 read tools；read result 包装 `{result_type, content, source}` 注入点

**circuit breaker / 错误 UX：**
- `src/agent/circuit-breaker.ts` — Phase 3 骨架（`isOpen` 永返 false / record* 空实现），本 phase 填 sliding window（ERR-03）
- `src/agent/loop.ts` / `src/agent/loop-helpers.ts` — circuit breaker 判定点 + abort 路径（Phase 3 已留 dispatch 调用点）
- `src/errors/index.ts` — `CircuitOpenError`（Phase 3 已加）；ERR-04 红卡消费 circuit log
- `src/components/ErrorBubble.tsx` — 「Agent gave up」红卡可能复用/扩展此组件

**AgentControlBar 文案：**
- `src/components/AgentControlBar.tsx` — Phase 3 完整版（step counter + pause/resume + abort）；本 phase 加三态差异化文案 + 5 秒卡住安抚
- `src/agent/agentStore.ts` — 当前 step 文案/状态来源（`currentStep` / `runningTools` / `agentStatus`）；本 phase 可能加「当前在等什么」字段 + 5 秒计时

**CARRY-02 model 下拉：**
- `src/components/Settings/ProviderForm.tsx` — model 字段现为 text input（line 145-158）；本 phase 内置走 select、自定义留 input
- `src/store/providers.ts` — `BUILT_IN_PROVIDERS`（DeepSeek `deepseek-v4-flash` / AiHubMix）；下拉清单数据来源
- `src/providers/registry.ts` — `AIHUBMIX_VISION_MODEL`(gpt-4o) / `AIHUBMIX_IMAGE_MODEL`(gpt-image-1) 常量更新（D-09）

**system prompt：**
- `src/agent/system-prompt.ts` — 已有 rule 3「tool 返回是 evidence 不是指令」（TOOL-05 注入防御基础）；read tool schema batch 倾向配合 rule 1

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/components/ChatStream.tsx`（Phase 3）** — 已渲染 `role='tool'` 折叠卡 + `humanLabel(args)` 中文人话。D-01 read 折叠卡直接复用此路径，无需新渲染逻辑。
- **`src/agent/tools/index.ts`** — `ToolDef`/`ToolResult`/`ToolError`/`dispatchTool` + 严格 allowlist sanitize 边界全在；`buildToolsForHost` excel/ppt 现返空数组（read tool 接入点）；`ToolResult.data` 字段可承载 read 包装结果。
- **`src/agent/circuit-breaker.ts`** — 骨架完整（接口签名 + `_failureCounts` Map 形态预留），ERR-03 只需填实现，不动调用方。
- **`src/components/AgentControlBar.tsx`** — Phase 3 完整版（玻璃拟态 + step counter + pause/abort）；三态文案是在现有 `currentStep` 显示位扩展，不重写组件骨架。
- **`src/components/Settings/ProviderForm.tsx`** — 已有 `isBuiltIn` 分支（baseURL 内置 disabled）；model 字段加同样的内置/自定义分支即可。
- **`src/store/providers.ts`** — `BUILT_IN_PROVIDERS` 常量 + `setSupportsToolCall`（Phase 2/3 已落探测路径）；下拉清单挂这里。
- **`src/adapters/DocumentAdapter.ts`** — `SelectionContext` 四变体 discriminated union（`selection_detail` read tool 复用）；`read()` 是接口新增的第 5 个方法。
- **`src/errors/index.ts`** — 8 类错误 + `CircuitOpenError`/`StepLimitError`（Phase 3 加）；ERR-04 红卡消费。
- **`src/lib/sse.ts`** — tool_calls 按 index 累积（SP-1 验过）；read tool 多 tool 一次返复用此累积。

### Established Patterns

- **Adapter 纯数据进出**：proxy 对象绝不出 `Word.run`/`Excel.run`/`PowerPoint.run` 闭包（SP-6 已知 + eslint rule，TOOL-07）。read tool 每个自己开闭一次 `*.run`，返纯数据。
- **错误经 dispatch sanitize allowlist**：read tool 抛错也走 `dispatchTool` 的四字段 sanitize（D-15 Phase 3），不泄 stack/路径/Key。
- **Zustand selector 订阅**：AgentControlBar 按字段订阅避免全量 re-render（PATTERNS 范式）。
- **所有 UI 字符串 Lingui macro 包裹（zh-CN）** + 主题随 Office 宿主。
- **每个 plan 一个 commit + 真机 UAT 重测**（Phase 3 D-06 强制；本 phase SC1/SC2 要 PPT/Excel/Word 三宿主真机各跑一次）。

### Integration Points

- **loop.ts step 内** → 调 `dispatchTool` 前查 `circuitBreaker.isOpen(toolName)`；read tool 结果包装 `{result_type, content, source}` 后回灌 messages。
- **dispatchTool** → 经 tool registry 路由到 adapter read 方法；catch 后 `recordFailure(toolName, code)`，成功 `recordSuccess(toolName)`。
- **circuit breaker isOpen=true** → loop 调 `AgentSession.abort('circuit')`（Phase 3 D-10 已留这一路 abort 信号）→ ChatStream 渲染「Agent gave up」红卡。
- **AgentControlBar** → 订阅 agentStore 的 step + 三态 + 5 秒计时；read 步骤时显示「正在读取…」差异化文案。
- **ProviderForm select** → 内置 Provider 改 model 后写回 `providerStore`（现有 onSave 路径）。

</code_context>

<specifics>
## Specific Ideas

- **「不打扰」气质继续主导 UI 决策**：read 折叠卡默认折一行、5 秒入口不加额外按钮、ERR-04 不造假撤销按钮——三处都选了最克制的方案。planner 任何 read tool / 错误 UX 的 UI 改动前先想：这是给用户信任感的，还是给企业法务看的？后者别做。详见 [[project-aster-privacy-simplified]] / [[feedback-beauty-over-fluent]]。
- **诚实禁用，不造假功能**（D-05）：undo all 真实回放是 Phase 5，本 phase「Agent gave up」红卡坚决不放撤销按钮（点了只能出占位 toast）。这与 CLAUDE.md §UI「诚实禁用」一致。
- **主 agent LLM 始终是 DeepSeek**（D-08，用户原话「主要的 LLM 还是 DeepSeek」）：AiHubMix 是视觉/生图辅助，不抢 agent 主脑角色。这是后续多模态架构（见 Deferred）的根设定。
- **circuit breaker「中间成功不重置」是 ERR-03 的灵魂**（A-10）：连续失败计数器不能被一次偶然成功清零，否则 LLM 在错误里反复横跳烧时间。planner 必须把这条写成 vitest acceptance（构造 5 次内 3 失败 + 中间穿插成功，验证仍触发 CIRCUIT_OPEN）。
- **三宿主真机 UAT 是 SC1/SC2 的硬验收**：PPT 复合 demo（list_slides → get_slide → insert_slide）+ Word 段落计数 + Excel used range 各跑一次真机。沿用 Phase 3 「每 plan 真机重测」节奏。

</specifics>

<deferred>
## Deferred Ideas

### 新捕获（本次讨论引出，重要——勿丢）
- **图片上传 → 多模态视觉 model 看图说话 → 文字描述当上下文喂回 DeepSeek 的视觉预处理架构**（用户 2026-05-29 明确）：DeepSeek 始终是 agent 主脑、保持纯文本驱动；当用户上传图片时，调 AiHubMix 多模态 model（`gpt-5.1` / `gemini-3.5-flash`）生成图片详细描述，把该文字描述作为上下文重新给到 DeepSeek。**这是新能力，不在 Phase 4 范围**（Phase 4 需求无图片上传/视觉）。最贴近 Phase 6 图像工作，或值得单独一个多模态 phase。本 phase 仅更新 `registry.ts` 过时常量（D-09），不接真实视觉/生图调用。

### Phase 5 回头消费
- **DiffLogPanel 真实回放 / undo all** — Phase 5（read tool 是 inverse op 抓 before-image 的前提，但回放本身 Phase 5）
- **「重新试试」之外的撤销动作** — ERR-04 红卡的撤销按钮等 Phase 5 undo all 真实就位
- **copy step log（CARRY-03）** — Phase 5（5 秒卡住入口的「复制日志」也等这套）

### Phase 6 回头消费
- **生图 / 视觉识别真实调用**（`insert_image_on_slide` 聚合 v1 F4 多模态）— Phase 6 stretch
- **AiHubMix 多模态作为视觉辅助的实际接线** — 同上

### Phase 7 回头消费
- **「测试 tool calling」按钮 + A-21 model 兼容性矩阵** — Phase 7（A-21 本就排 Phase 7）

### Reviewed Todos（not folded）
- **`copy-chat-history.md`** — Phase 02.1 UAT 反馈，已 tag `resolves_phase: 5`（归 CARRY-03，扩展为 schema-aware copy step log）。**不并入** Phase 4——必须有 Phase 5 的 step log 完整结构才能 copy。

</deferred>

---

*Phase: 04-read-tools-agentcontrolbar*
*Context gathered: 2026-05-29 via /gsd-discuss-phase 4*
