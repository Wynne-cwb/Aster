# Project Research Summary — Aster v2.0 Office 智能代理

**Project:** Aster v2.0 (vision pivot: 单步 AI 工具 → Office 内嵌智能代理)
**Domain:** Multi-step LLM agent in browser-only Office.js Add-in, BYO Key, no backend, Chinese-first
**Researched:** 2026-05-28
**Confidence:** HIGH (4 个研究文件高度一致；v1 代码已实地读，行业 agent loop 共识 ReAct 收敛；DeepSeek + aihubmix OpenAI-compat tools schema 都有官方文档支持)

---

## Executive Summary

Aster v2.0 把 v1「AI writer」单步工具改造成「AI worker」智能代理——在用户当前打开的单文档内自主跑多步 tool call，用户可暂停 / 看 step log / 一键 undo。**4 个研究文件高度一致地指向同一套架构**：在现有 v1 基座（React 19 + Vite 7 + Zustand 5 + native fetch+SSE + OpenAI-compat Provider + 三宿主 Adapter）之上加 **3 个新 `src/agent/*` 模块** 和 **每宿主 Adapter 加 `read()` 方法**——**0 净新增运行时依赖**。Bundle 预算从 ~63 KB 涨到 ~70 KB gzipped，远低于 1 MB 上限。

**推荐路线（4 文件一致 + 已 RESOLVED）：** Agent loop 是行业 ReAct 共识的 50 行 while 循环——**不引 LangChain.js / Vercel AI SDK Agent / OpenAI SDK / MCP / XState**（每个都被 STACK/ARCH 单独驳回过：浏览器侧 BYO Key 不是一等公民、抽象掉 Q9/Q10/Q11 要定制的行为、+34-101 KB 包同样的东西）。Tool 调用走 OpenAI `tools` + `tool_calls` schema（DeepSeek-V4 + aihubmix 原生支持，128 函数，并行 tool calls）。状态用 Zustand 扩展 + AbortController；undo 自写 `OperationLog` + 反向操作（**Office.js 无 transaction API** 是 HIGH-confidence 硬约束，issue #2543 多年未解，native Ctrl+Z 在 add-in 写入后被禁用）；token 计数走 Provider SSE `stream_options.include_usage`（不装 tokenizer，DeepSeek tokenizer 不是 OpenAI 的，估值反而偏差）。

**最大风险（PITFALLS top 3）：** (1) **A-04 隐私 + A-05 prompt injection** ——Q10 把全文读取闸门打开后，user-added 恶意 Provider 一句 prompt 全文外发 = 开源信任崩塌；必须 allowlist + 新 Provider 默认 fullDocAccess=OFF + system prompt 把 read tool 结果标 `untrusted_document_content`；(2) **A-01 成本 cap 后置** ——若每步算完才检查 ¥10，DeepSeek-V4-pro 单步可花 ¥1.5+，重试乘数 = 真烧爆；必须 **pre-call gate**（估算 max output × 单价，超 cap 直接 abort）；(3) **A-06 Office.js proxy 跨 await 边界失效**——agent loop 天然有「读 → LLM 思考几秒 → 写」长 await，旧 ctx 已死；adapter 接口必须强制「pure data in / pure data out」（每个 tool 自己开闭一次 `*.run`，绝不导出 proxy 给 store）。

---

## Key Findings

### Recommended Stack (from STACK.md, HIGH)

**净新增运行时依赖：0 个。** v1 已锁的 React 19 / Vite 7 / Zustand 5 / native fetch+SSE / 自写 CSS / Office.js CDN / partitioned localStorage / DeepSeek + aihubmix OpenAI-compat / mammoth+xlsx+pdfjs 全部保留。

**v2 新增的 6 项决策：**

- **Agent loop**: 自写 ~50 行 while-loop runner — 行业 ReAct/four-phase 是共识，框架（LangChain.js +37-101 KB / Vercel AI SDK Agent / OpenAI SDK + 34 KB）的「省事」前提是有 server，无后台架构下框架价值蒸发 60%；且抽象掉 Q9/Q10/Q11 要定制的行为
- **Tool 线协议**: OpenAI `tools` + `tool_calls` schema — DeepSeek-V4 + aihubmix 原生支持，128 函数，并行 tool calls，v1 SSE adapter 一字不改可直接跑
- **状态机**: 沿用 Zustand + AbortController — 5 状态 / 8 转换远低于 XState 收益门槛
- **Diff log + Undo all**: 自写 `OperationLog` + 反向操作 — Office.js 无 transaction API（issue #2543），native Ctrl+Z 在 add-in 写入后被禁用
- **Token 计数**: SSE `stream_options.include_usage` — DeepSeek tokenizer ≠ OpenAI，装 gpt-tokenizer (~50 KB) 估值系统性偏差
- **Markdown 渲染**: v1 已规划的 `react-markdown` + `remark-gfm`（~3 KB）在 v2 chat UI 正式接入，lazy import

**Bundle 预算**: v1 ~63-68 KB → v2 ~67-73 KB gzipped，剩余 93%+ headroom。

### Expected Features (from FEATURES.md, HIGH/MEDIUM)

**MVP table-stakes (P1, 全部从 Q9/Q10/Q11 锁定衍生)：**

- A1 Multi-step agent loop + max_steps=20 fail-safe
- A2 Tool result feedback (structured `{code, message, recoverable, hint}` per Q11)
- Q11 max-2-retry per tool / circuit breaker
- **Read tools** (Q10 default-on)：`get_selection_metadata` / `get_presentation_outline` + `get_slide_shapes` (PPT) / `get_sheet_schema` + `get_range_values` (Excel) / `get_document_outline` + `get_paragraph_range` (Word) / `get_document_full_text`
- **Write tools P1**：`insert_slide` + `set_shape_text` + `set_shape_property` + `move_shape` (PPT) / `set_range_values` + `apply_formula` + `insert_chart` (Excel) / `insert_paragraph` + `replace_paragraph` (Word)
- **Control UX (Q9 衍生)**：always-visible pause + live cost meter + ¥10 cap + step-by-step diff log + **one-click undo all** + max_steps=20
- **Privacy UX (Q10 衍生)**：Onboarding 新增「全文读取授权」步 + Settings「关闭文档全文发送」单 opt-out + Provider 切换警示 + Privacy doc 重写
- **v1 转嫁 (Phase 2.2)**：FU-01 选区 bug / FU-02 model 下拉 UX / FU-03 copy → copy step log

**Differentiator (Aster 护城河)：**

- **Shape-level 精细操作** (`set_shape_property` / `move_shape`) — Copilot Agent Mode 不暴露 shape-level UX；中文用户「把那个图调小一点」是高频但未被任何竞品覆盖的窄缝
- **BYO Key + 无后台跑代理** — Copilot 必须企业订阅 + 数据走 MS cloud；Aster 唯一「数据从浏览器直连 Provider 跑代理」
- **DeepSeek-V4 中文质量** — Copilot 中文调优一般，WPS AI 锁定 WPS
- **开源 agent loop** — 用户可审 prompt / tool list / loop 逻辑
- **可中断 + 一键 undo all** — Copilot Agent Mode 改完依赖 OneDrive 版本历史；Aster in-product undo

**Defer (v2.1+)：** Resume from checkpoint / reorder_paragraphs / Multi-agent spawn / Cross-session memory / Image gen tool (聚合 v1 F4 + Q1) / Per-action consent

**Anti-features (永不做)：** 跨文档 agent (Q7 锁) / 跨应用 agent (Q7 锁) / VBA 代码生成 / Whole-deck redesign / RAG / 跨应用编排 / Floating badge UX (Microsoft 自己 May 2026 已 rollback) / Auto-execute YOLO 模式 / Per-action consent (BYO Key 无后台架构下 = 用户疲劳)

### Architecture Approach (from ARCHITECTURE.md, HIGH)

「**Agent loop = 不是重写，是包一层**」——v1 `chatStore.sendMessage` + `streamSSE` 已经是「LLM → tool_call_end → adapter.insert」一次迭代，v2 在外面套 `while (!done && step<20)` + 把 tool 结果当 `role:'tool'` 消息回灌即可。

**新增模块 (`src/agent/*`)：**

- `src/agent/loop.ts` — runAgent(prompt, ctx, adapter, signal) — 50 行 while + step + dispatch
- `src/agent/tools/index.ts` — buildToolsForHost / dispatchTool (centralized registry)
- `src/agent/tools/common.ts` — selection_detail
- `src/agent/tools/read/{ppt,excel,word}.ts` — per-host read tools
- `src/agent/tools/write/{ppt,excel,word}.ts` — per-host write tools
- `src/agent/operationLog.ts` — OperationLog + reverse() (Q9 undo all)
- `src/agent/circuit-breaker.ts` — 同 tool name × error code >2 次 → CircuitOpenError (Q11)
- `src/agent/cost-cap.ts` — 累加 + pre-call gate (A-01) → CostCapExceededError (Q9)
- `src/agent/agentStore.ts` — Zustand: agentStatus / currentStep / runningCostCny / pause/resume/abort

**v1 文件改动 (MODIFIED, 增量小)：**

| 文件 | 改动 |
|---|---|
| `src/adapters/*` | 接口加 `read(query: ReadableQuery): Promise<ReadableResult>`；每个 write tool 包成「ToolDef + 在 invoke 返回 `{result, reverse}`」 |
| `src/lib/sse.ts` | 扩 `delta.tool_calls[]` 按 **`index` 主键**累积（DeepSeek 在某些 chunk 漏 id；aihubmix 上游可能一次性 args）；加 `stream_options.include_usage` 解析 |
| `src/providers/openai-compat.ts` | `chat()` 加 `tools` 入参（v1 现在硬编码 `INSERT_TO_DOCUMENT_TOOL`），加 `stream_options.include_usage:true` |
| `src/store/chat.ts` | Message 加 `'tool'` role + `toolCallId/toolResult/toolName/agentRunId/agentStep`；sendMessage 变 thin delegate 到 runAgent |
| `src/components/*` | 新增 `<AgentControlBar/>` / `<DiffLogPanel/>` / Onboarding Step3-Privacy / Settings `fullDocReadEnabled` toggle |

**架构铁律（v1 invariant 继承到 v2）：** `src/agent/*` 可 import from `src/adapters/*` 和 `src/providers/*`；反向禁止。这样 v2.1 的 Ribbon 快速动作还能直接调 `adapter.insert()` 不经 agent loop。

**Read API 关键决策：** 不做 fat `inspect()` 返回整 doc model（50 KB × 每步 = 第 3 步即烧爆）；做 **per-query 离散 read**，1:1 映射到 LLM tool name（`list_slides` 轻量 → `get_slide(3)` 只取需要的）。

**Undo 关键决策：** **inverse ops 优先，Office.js native undo 仅 fallback**。每个 write tool 写前 `adapter.read()` 抓 before-image，存进 `OperationLog`；undo all = 逆序 replay inverse descriptor。原因：PPT 没有 `presentation.undo()` API；Office native undo stack 不透明且会撞用户手动操作。

### Critical Pitfalls (from PITFALLS.md, HIGH)

**5 个 cross-cutting top risks（4 文件互相印证 + PITFALLS 单独提出）：**

1. **A-04 隐私默认全开 × user-added 恶意 Provider = 数据泄漏**（Q10 直接换来的风险） — 必须做 `['api.deepseek.com', 'api.aihubmix.com']` allowlist；新 Provider 默认 `fullDocAccess=false`；Provider 切换 banner 警示「数据发往 `${endpoint}`」；Settings 单一总开关位置显著
2. **A-05 Prompt injection from doc content** — read tool 返回必须包装成 `{result_type: 'untrusted_document_content', source}` + system prompt 显式教 LLM 「只有 `[USER]` 是指令，tool 返回是 evidence」；**Q7 单文档边界 + 不引入 web tool = 安全红利**（最坏只能改坏当前文档）
3. **A-01 成本 cap 后置** — 必须 `PromptBudget.estimateMaxCostCNY()` **pre-call gate**，不是 step 结束后才算账；retry 自身就是 token 乘数；cache_hit 价格（Pro $0.003625/M）在 agent loop 中实际命中率低（tool result 不断变化打破 prefix）
4. **A-02 Token runaway → context window 溢出** — 1M tokens 不是免死金牌；agent loop history 自带步数乘法；必须 `compactForAgent(history, budget)` 保留 user prompt + tool_call pairs，截掉中间 tool result 换 placeholder；单 tool result hard cap 50K tokens
5. **A-06 Office.js proxy 跨 await 边界失效** — 100% 复现率必踩；adapter 接口契约「纯输入 → 纯输出」，proxy 对象绝不出 `Excel.run` 闭包；加 eslint rule 禁止 `Excel.*`/`Word.*`/`PowerPoint.*` 命名空间进 store action

**额外重点（HIGH 级）：**

- **A-03 SSE 多 tool 累积按 index 主键** — DeepSeek 有时漏 id；aihubmix 上游 claude 可能一次性 args 不 delta；v1 sse.ts 只测过单 tool
- **A-08 多源 abort 信号统一** — visibility / user pause / max_steps / cost_cap / circuit breaker 五路必须共用一个 `AgentSession.abort(reason)`
- **A-09 Undo 不撤销用户手动操作** — undo all 前 read 当前 state 比对 diff log post-state；不一致跳过并提示「Step X 你已手动改过，未回滚」
- **A-11 Diff log 写 localStorage 撑爆 5MB** — diff log 默认内存 only，session 结束就丢；A-15 刷新中途用 sessionStorage 兜底（单 tab 级、5MB 独立配额）
- **A-12 Agent thinking 干等 30 秒被用户当卡死** — UI 每步必须有差异化文案「读取 slide 5 / LLM 思考 / 修改 slide 5」不是统一 spinner
- **A-13 Diff log 必须人话** — 每个 tool 强制 export `humanLabel(args) => string`，缺 humanLabel 编译失败

完整 30 条 pitfall + Phase × Pitfall 责任地图见 PITFALLS.md。

---

## Implications for Roadmap

**Pivotal observation：** 3 个文件各自提了不同的 phase 编号方案（STACK 没编 phase / FEATURES 提 Phase 3-9 / ARCHITECTURE 提 Phase 3-7）。Synthesizer 视角下合理收敛为 **Phase 3-7（共 5 个 phase）+ 0 个独立 spike phase**——Phase 3 第一周以 spike 子任务方式跑（不独立切 phase）。

收敛依据：

- **FEATURES Phase 3-9（独立 spike + 控制 UX + polish）** vs **ARCHITECTURE Phase 3-7（loop + read 集成 + diff/undo + 多宿主 + UAT）**：FEATURES 把 control UX 拆成独立 Phase 8 是错的——ARCHITECTURE 正确指出 **Phase 5 diff log + undo 必须先于 Phase 6 多宿主 destructive 写操作**（不然第一次 PPT new_slide 出错没法收尾）。
- **PITFALLS 责任地图把 Phase 3 + 4 的 critical/high 坑列得很满**——意味着 Phase 3 是「地基 + 失控控制 + 隐私」三件并行，不是单纯 loop 骨架。**Phase 4 control UX 必须先于 Phase 3 loop 写完** 就开始 spec UX（否则 Phase 3 接口被回头改）。
- **Spike list 去重后只剩 7 项**（详见 §Research Flags），都可以在 Phase 3 第一周用 1-2 天跑完，不值得切独立 phase。

### Phase 3: Agent Loop 地基 + Privacy 授权 + 第一个跑通 demo（Word）

**Rationale:** 4 个文件一致认为 agent loop + 错误协议 + 隐私授权是「不上线就没法测任何东西」的最小可运行集。FEATURES Phase 4 + ARCHITECTURE Phase 3 + PITFALLS Phase 3 责任高度重合。Phase 3 demo 选 Word 是因为 Word agent 链路最短（read paragraph → LLM → replace paragraph），不需要 shape mutation 等复杂 API；可以在 Phase 3 收尾就让用户在 Word 里跑「3 段润色」demo。

**Spike 子任务（Phase 3 day 1-3，不切独立 phase）：**

- **SP-1** DeepSeek-V4 streaming `tool_calls` delta 实测（id 漏发？index 主键？）
- **SP-2** DeepSeek `stream_options.include_usage` 是否在最后 chunk 返 usage
- **SP-3** aihubmix passthrough `tool_calls` + `usage` 是否如实透传（尤其切 claude / Doubao 时）
- **SP-4** Office.js 三宿主 reverse 操作实测（delete_slide / 撤销格式化）—— 直接决定 Phase 5 diff log 接口
- **SP-5** PPT `slide.delete()` API 可用性 + Web 反向排序 bug
- **SP-6** Office.js context proxy 跨 await 行为最终验证（A-06 攻防）
- **SP-7** 真机三 tool 并行调用 SSE raw log（A-03 攻防）

**Deliverables:**

- `src/agent/loop.ts` 50 行 while runner + max_steps=20 + cost cap pre-call gate + AbortController 单源
- `src/agent/circuit-breaker.ts`（tool name × error code 维度 / sliding window 5 调用内 ≥3 次同 code）
- `src/agent/cost-cap.ts` + `src/providers/pricing.ts` estimateMaxCostCNY
- `src/agent/agentStore.ts` Zustand (agentStatus / currentStep / runningCostCny / pause/resume/abort)
- `src/store/chat.ts` Message 加 `'tool'` role + toolCallId/toolResult/agentRunId
- `src/lib/sse.ts` 扩 `delta.tool_calls[]` 按 index 累积 + `include_usage` 解析
- `src/providers/openai-compat.ts` 接 `tools` 入参 + sanitization 包装（A-19 防内部状态泄漏）
- `src/components/Onboarding/Step3Privacy.tsx`（Q10 一次性授权 step）
- `src/components/Settings/...` 加 `fullDocReadEnabled` toggle
- `src/store/providers.ts` ProviderConfig 加 `fullDocAccess`（默认 false 给 user-added；内置 DeepSeek/aihubmix hardcode true via allowlist）
- WordAdapter 加一个新 write tool `append_paragraph` + 配套 reverse
- Word read tool `get_paragraph_count`（metadata，不需 privacy gate）
- system prompt 加固（A-05 prompt injection 防御 + A-07 batch tool 倾向）
- Demo flow: Word 「写 3 段关于 X 的内容」→ LLM 顺序调 `append_paragraph` 3 次
- Phase 2.2 转嫁的 **FU-01 首次取选区 bug** 在此 phase 修（不修后续 read tool 都受污染）

**Avoids pitfalls:** A-01/A-02/A-03/A-04/A-05/A-06/A-08/A-09/A-10/A-11/A-13/A-14/A-15/A-16/A-17/A-19/A-23/A-26/A-30

### Phase 4: Read Tools 全套 + Privacy 落地验证（PPT 接入第一个读 demo）

**Rationale:** ARCHITECTURE 把 read tools 单切一 phase 是对的——Phase 3 验证「LLM 能调 tool 写文档」后，Phase 4 验证「LLM 能调 tool 读文档再写」这一更复杂链路。Privacy 在 Phase 3 已埋开关但 Phase 4 才大规模行使，UAT 必须在此 phase 跑「opt-out=on 时所有 content read 返 PRIVACY_BLOCKED 且 network panel 不漏」。

**Deliverables:**

- 全部 3 个 Adapter 实现 `read(query: ReadableQuery): Promise<ReadableResult>`
- Read tools 全套：`selection_detail` / `list_slides` / `get_slide` / `list_shapes_on_slide` / `list_worksheets` / `get_range_values` / `get_used_range_summary` (with size cap, A-24) / `get_paragraph_at` / `get_paragraph_count` / `get_document_outline` / `get_document_full_text`
- Read tool 包装统一为 `{result_type: 'untrusted_document_content'|'metadata', content, source}` (A-05)
- Privacy gate 落到每个 content-level read（metadata read 不 gate）
- Tool error 结构化 schema 完成（`{code, message, recoverable, hint}` Q11）
- `<AgentControlBar/>` 接入（实时 cost meter + step ticker + pause/abort + 差异化阶段文案 A-12）
- Demo flow: PPT 「在最长那张 slide 后插入一张总结要点」→ list_slides → get_slide(longest) → write tool
- Phase 2.2 转嫁的 **FU-02 model 下拉 UX** 重设计（v2 model 切换更频繁）

**Avoids pitfalls:** A-04 / A-05 / A-07 / A-12 / A-18 / A-21 / A-29 / A-24

### Phase 5: Diff Log + Undo All（跨 3 宿主验证）

**Rationale:** 必须先于 Phase 6 大规模 write tools——Phase 6 一上来就要 PPT new_slide / Excel apply_formula / Word replace_paragraph 这些 destructive 操作，没 undo 第一次出错用户就流失。Phase 5 既验证 inverse op 模型在三宿主可行（SP-4/SP-5 实测有底），也帮用户建立「agent 是兜底的」trust。

**Deliverables:**

- `src/agent/operationLog.ts` + reverse() 接口（adapter 写 tool 必返 `{result, reverse}`，TS 强制）
- `<DiffLogPanel/>` 组件（折叠列表 + 人话 humanLabel A-13 + per-step undo + undo all + 跳过冲突提示 A-09）
- 三宿主每个 write tool 实测 reverse（delete_slide / undo set_range_values via before-image / undo replace_paragraph）
- A-09 用户手动改防御：undo 前 read 当前 state 比对 post-state，不一致跳过 + UI 标「未回滚」
- A-15 sessionStorage 写 diff log（刷新中途的「我撤回 / 我保留」恢复对话）
- A-11 storage quota guard `setItem` try/catch + 超 80% 清 LRU
- Phase 2.2 转嫁的 **FU-03 copy chat history** 扩展为 copy step log（schema-aware）

**Avoids pitfalls:** A-09 / A-11 / A-15

### Phase 6: 多宿主 Write Tools + Killer Scenarios 重写

**Rationale:** Phase 5 undo 兜底就位后，可以放心铺开 destructive 写 tool。FEATURES 提的 4 个 killer scenario（PPT topic→deck / Excel 清洗+图+洞察 / Word 整篇润色 / PPT shape 精细化）正好对应 v1 杀手场景在代理形态下的重写。

**Deliverables:**

- PPT write tools 全套：`insert_slide` / `set_shape_text` / `insert_text_box` / **`set_shape_property` (差异化护城河)** / `move_shape` / `insert_image_on_slide`（聚合 v1 F4 multimodal）
- Excel write tools：`set_range_values` / `apply_formula` / `insert_chart` / `set_cell`
- Word write tools：`insert_text_at_cursor` / `replace_selection` / `replace_paragraph`
- system prompt batch-tool 倾向引导（A-07 防 step runaway）
- Killer scenario empty-state chip（替代 v1 Ribbon 6 按钮设计——Ribbon 在 v2 只做「打开 Task Pane + seed prompt」）
- A-23 write tool 返 `{ok, mutated: {...}}` + post-write self-verify

**Avoids pitfalls:** A-07 / A-22 / A-23 / A-24 / A-25

### Phase 7: UAT + Privacy Doc + Sideload Release Prep

**Rationale:** Phase 3-6 都按 demo 收尾，但没经过中文职场用户真实 8-15 步任务的 end-to-end 验证；Phase 7 把 v2 第一次完整 release path 走通。Q8 决定 v2 第一个 release 是用户首次见到 Aster（v1 不发），所以 Phase 7 也是开源仓库 README/Privacy doc 第一次正式产出。

**Deliverables:**

- 4 个 killer scenario UAT（topic→deck / 数据清洗+图+洞察 / 整篇润色 / shape 精细化）
- 隐私 doc 重写（`PRIVACY.md`）+ README 第一次正式版（Q10 Q11 都要文档化）
- Privacy edge case 验证：opt-out=on 完整链路 + 切非 allowlist Provider 二次确认
- A-21 各 user-pickable model 的 tool calling 兼容性测试按钮（aihubmix 上游 claude-opus / Doubao）
- Sideload manifest 在 Office for Web Edge/Chrome 三宿主全验
- Cost cap ¥10 实际表现复盘（默认值是否合理）+ 默认 model 是 Pro 还是 Flash（cost-quality 权衡）
- 开源仓库正式发布（main 分支 + manifest URL，无 tag 但有 README）

**Avoids pitfalls:** A-04 / A-05 / A-18 关 doc 文案 / A-21 model 兼容

### Phase Ordering Rationale

- **Phase 3 必须先有 Privacy 授权 + 错误协议 + cost cap**：Q9/Q10/Q11 锁定的「衍生责任」全部是 Phase 3 范围。漏一个，Phase 4 读 tool 一上线就翻车（A-04 数据泄漏 / A-01 烧钱）
- **Phase 4 必须先于 Phase 5**：Phase 5 inverse op 写完才能逆序回放，但 inverse op 实现自身需要 Phase 4 的 `adapter.read()` 抓 before-image
- **Phase 5 必须先于 Phase 6**：Phase 6 一上来就铺 destructive 写 tool，没 undo 第一次出错就流失用户
- **Phase 6 必须先于 Phase 7**：Phase 7 UAT killer scenario 需要 Phase 6 全套写 tool 就位
- **Phase 2.2 转嫁三件嵌入分布**：FU-01 进 Phase 3 (read 污染防御)；FU-02 进 Phase 4 (model 切换更频繁)；FU-03 进 Phase 5 (扩展为 copy step log)

### Research Flags

**Phases needing deeper research during planning (`/gsd-research-phase`)：**

- **Phase 3:** 7 个 spike 子任务集中爆发（DeepSeek SSE delta 行为 / Office.js native undo 三宿主一致性 / proxy lifecycle 攻防 / cost cap pre-call estimate 精度）。建议第一周即跑 spike，写 phase plan 前完成
- **Phase 5:** PPT slide.delete() 在 PowerPoint.run 的实测可达性 + Web 反向排序 bug（SP-5 提前到 Phase 3 跑，结果决定 Phase 5 是否需要架构 pivot to「PPT 不支持 undo」降级）
- **Phase 6:** Shape mutation API 1.4+ 三宿主一致性（FEATURES Phase 3 spike 列出）；中文用户「左下角那个图」类指代语义的 LLM 解析率（不是 spike 而是 prompt 工程 + UAT）

**Phases with standard patterns (skip `/gsd-research-phase`)：**

- **Phase 4 read tools 本身：** Office.js paragraphs/ranges/slides 都是 v1 已用过的 API surface，read 路径无新东西
- **Phase 7：** 已经是 polish + release，没新研究

---

## Q9/Q10/Q11 Derived Deliverables 完整清单（PROMOTE → REQUIREMENTS.md）

REQUIREMENTS.md 须把以下条目逐条 promote 为 numbered Fn (建议 A1-A5 系列)：

**A1 系列（Q9 失控控制衍生）：**

1. `A1.1` Multi-step agent loop runner (max_steps=20 硬上限不可绕过)
2. `A1.2` Always-visible pause button (Task Pane 顶部，agent run 期间常驻)
3. `A1.3` Live running cost meter (¥X / ¥10.00 实时滚动 + 超阈值变红)
4. `A1.4` ¥10 cost cap **pre-call gate**（不是 post-call）+ Settings 可调（¥1-50）
5. `A1.5` Step-by-step diff log panel (跑完显示 N 步卡片 + humanLabel 人话 + 单步撤销 + 整体 undo all)
6. `A1.6` One-click undo all（inverse op 逆序回放 + 用户手动改防御 + 冲突跳过提示）
7. `A1.7` Max-steps 软着陆 (hit 20 时 「Aster 觉得这事还没干完，要继续吗？」 而不是默 abort)
8. `A1.8` Pause 与 abort 双语义按钮（暂停 = 停下一步保 in-flight；中止 = 停 + 显示 undo all）

**A2 系列（Q11 错误恢复衍生）：**

9. `A2.1` Tool error 结构化 schema (`code` 枚举 / `message` 中文 / `recoverable` / `hint` LLM 可读 / 不含路径 Key 等内部状态)
10. `A2.2` Circuit breaker per (tool name × error code), sliding window 5 调用内 ≥3 同 code 失败强制 abort
11. `A2.3` 「Agent gave up」UX (强制 abort 后红色卡片说明试过 X/Y/Z 都失败 + LLM 给的建议)

**A3 系列（Q10 隐私衍生）：**

12. `A3.1` Onboarding 新增「全文读取授权」step (一次性勾选 + localStorage 持久化 + Settings 可重置)
13. `A3.2` Settings 「关闭文档全文发送」单一 opt-out toggle (位置显著，不埋 advanced)
14. `A3.3` Provider allowlist (`api.deepseek.com`, `api.aihubmix.com` 默认 fullDocAccess=true；user-added 默认 false 需单独开)
15. `A3.4` Provider 切换 banner 「数据发往 `${endpoint}`」3 秒提示
16. `A3.5` README + 新增 `PRIVACY.md` 重写（旧 KEY-03 文案 superseded）

**A4 Read/Write Tool 集合（Q10 默认全开 + Q7 单文档边界）：**

17. `A4.1` 三宿主 `adapter.read(query)` 接口实现（per-query 离散 reads，禁 fat inspect()）
18. `A4.2` Read tools 全套（含 get_document_full_text Q10 核心行为）
19. `A4.3` Write tools P1（含 set_shape_property 差异化护城河）
20. `A4.4` 每个 write tool 必须配 `reverse()`（TS 强制，缺则不让注册）
21. `A4.5` 每个 tool 必须 export `humanLabel(args) => string`（lint 强制）
22. `A4.6` Read tool result 包装 `{result_type: 'untrusted_document_content'|'metadata', content, source}` (prompt injection 防御)
23. `A4.7` Read tool size cap：单 result 50K tokens hard cap + Excel >10K cells 拒绝 full mode

**A5 v1 转嫁三件（Phase 2.2 嵌入）：**

24. `A5.1` FU-01 首次取选区 bug 修复（在 read tools 上线前）
25. `A5.2` FU-02 model 下拉 UX 优化（v2 切换更频繁）
26. `A5.3` FU-03 copy chat history 扩展为 schema-aware copy step log

**非功能（v1 N1-N5 继承）：**

27. `N1` 跨平台 API 子集（Web/Windows 共同支持）
28. `N2` 初始 JS ≤ 1 MB gzipped（v2 实测目标 ~70 KB）
29. `N3` 性能 P95 ≤ 10s 单 step / 首 token ≤ 2s
30. `N4` API Key 永不上传 Aster 自有服务器
31. `N5` 隐私透明（已被 A3 系列细化）

**Mental Model Framing（FEATURES § 1 § 9 重点，必须进 REQUIREMENTS scoping）：**

- v2 是 「AI worker」不是「AI writer」——中文用户对前者无 ChatGPT/WPS AI 心智锚定，**教育成本 = 最贵设计预算**
- Onboarding 第二步必须有动画/GIF 示意「跑完会这样汇报」（不是文字说明）
- 「undo all」是兜底而非常规——UX 必须 secondary (灰按钮 + 二次确认)，不和主流程混
- max_steps 上限用户不该意识到；hit 时软着陆「Aster 觉得这事还没干完...」
- step 摘要必须中文化「读取了第 3 张幻灯片的形状清单」而非「called get_slide_shapes(slide_id=3)」

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Agent loop pattern 是 Oracle/SitePoint 2026 综述行业共识；DeepSeek + aihubmix tool calling OpenAI-compat 是官方文档（HIGH on protocol）；Office.js 无 transaction API 是 GitHub issue #2543 多年未解（HIGH on negative result） |
| Features | HIGH/MEDIUM | Competitor 视角（Cursor / Cline / Claude Code / Copilot Agent Mode GA Apr 2026 / Devin / Gamma）行业 agent UX patterns HIGH；中文 office worker specifically 的偏好（extrapolation from WPS AI + DeepSeek 社区）MEDIUM；Office.js read/write API surface HIGH（官方 doc） |
| Architecture | HIGH | v1 codebase 实地读完；layering invariant 已在 v1 ARCH 立过沿用；Message schema evolution 是 TS 类型 widening 不破现存数据；diff log strategy MEDIUM（Office.js 三宿主 undo 行为需 spike 验证，但 inverse op 路线已是行业唯一可靠选择） |
| Pitfalls | HIGH | v1 现有约束 HIGH（代码读完）；Office.js context.sync 语义 HIGH；DeepSeek-V4/aihubmix tool calling 协议层 HIGH，具体 quirks LOW（需 SP-1 至 SP-3 实测） |

**Overall confidence: HIGH** — 4 个文件结论高度一致 + 无后端架构把不确定面收得很窄 + 0 净新增运行时依赖让回滚成本低。最不确定的几个点（Office.js native undo / aihubmix 上游模型差异 / DeepSeek streaming tool_calls delta 细节）都收敛到 SP-1 至 SP-7 的 spike 内，Phase 3 第一周可消化。

### Gaps to Address（不阻塞 ROADMAP，但 REQUIREMENTS 阶段需明确）

- **Open Question OQ1：** v2 是否保留 v1 的 `confirm / auto` insert mode toggle？agent loop 默认 inline 执行；建议 v2.0 砍掉 confirm/auto 二模式（保留 v1 用户体感 = 反而矛盾），换成 Settings「每步前问我」可选 toggle（FEATURES P2 stretch）
- **Open Question OQ2：** Cost cap ¥10 hardcoded vs Settings 可调？建议默认 hardcode + Settings 可调（A1.4 已 promoted）
- **Open Question OQ3：** Tool role 消息在 chat UI 默认折叠还是展开？建议 collapsed by default + 可单条展开（不打断阅读 + debug 仍可见）
- **Open Question OQ4：** Phase 5 spike SP-5 (PPT slide.delete()) 提前到 Phase 3 day 1-3 跑 —— 若 PPT 不可靠 reverse，整个 PPT undo 路线需走 snapshot fallback，Phase 5 接口要预留
- **Q9 cost cap 数字调研：** 建议默认 ¥10 / agent run，但需用户访谈验证（中文白领对一次 agent 跑的心理价位）
- **Q-S5/Q-S6（STACK §11）：** DeepSeek thinking mode (`reasoning_effort: "high"`) token 成本影响 + strict mode A/B —— 都属于 Phase 7 release 前的 tune，不阻塞早 phase
- **Image generation tool 何时引入：** v2.0 stretch 还是 v2.1？FEATURES 列在 Stretch；建议进 v2.0 stretch 但只在 PPT host 暴露（用户在「主题→deck」killer scenario 体验完整）

---

## Sources

详细参考来源见原始 4 个文件：

### Primary (HIGH confidence)

- `.planning/research/STACK.md` — v2.0 增量栈 6 决策 + Phase 0 spike 4 项
- `.planning/research/FEATURES.md` — 47 KB Agent UX patterns + read/write tool inventory + anti-features + Chinese office worker lens
- `.planning/research/ARCHITECTURE.md` — 52 KB v1 codebase 集成路径 + Message schema evolution + 7 个 Q1-Q9 设计决策 + 6 个 anti-patterns
- `.planning/research/PITFALLS.md` — 56 KB 30 条 pitfalls (CRITICAL 6 / HIGH 9 / MEDIUM 11 / LOW 4) + Phase × Pitfall 责任地图 + Top 3 killer
- `.planning/PROJECT.md` — Q7-Q11 RESOLVED + v1 已交付清单 + 硬约束
- v1 实地代码：`src/store/chat.ts` / `src/lib/sse.ts` / `src/adapters/*` / `src/providers/*` / `src/lib/storage.ts`

### Secondary (MEDIUM confidence — aggregated by 4 research files)

**Agent industry pattern (HIGH on pattern, MEDIUM on specifics)：** Oracle Developers AI Agent Loop / SitePoint Agentic Design Patterns 2026 / Microsoft Copilot Agent Mode GA April 22 2026 / Cursor 2026 Composer + Agent Mode / Cline v3.78 cost UX / Claude Code Changelog 2026 / Devin Release Notes 2026 / Gamma App 2026

**Office.js API (HIGH from official docs)：** PowerPoint.Slide/Shape class / Excel.Chart class / Work with shapes / Excel ranges / Word Paragraph / GitHub OfficeDev/office-js#2543 (undo unavailable) / OfficeDev/office-js#6513 (Office.js stability)

**DeepSeek + AiHubMix (HIGH on protocol, LOW on tool calling quirks)：** DeepSeek API Tool Calls guide / DeepSeek V4 Preview Release / DeepSeek API Streaming events / AiHubMix Documentation Hub / OpenAI Chat Completions Function Calling guide / OpenAI Streaming Events Reference (`stream_options.include_usage`)

**Privacy / Prompt Injection (MEDIUM)：** Protecto.ai LLM User Consent / arXiv 2026 Contextualized Privacy Defense / EU AI Act 2026 / OWASP LLM Top 10 (LLM01 Prompt Injection) / Microsoft Copilot agent design "untrusted content" labeling pattern

### Tertiary (LOW confidence — needs spike validation)

- DeepSeek streaming `tool_calls` delta 与 OpenAI 标准对齐度（SP-1）
- DeepSeek `stream_options.include_usage` 在最后 chunk 返 `usage`（SP-2）
- aihubmix passthrough usage 透传一致性 + 切上游模型 tool calling 兼容（SP-3 + A-21）
- Office.js 三宿主 native undo 可达性（SP-4）
- PPT `slide.delete()` API 在 PowerPoint.run 实测（SP-5）

---

*Research synthesized: 2026-05-28*
*Ready for REQUIREMENTS.md: yes — promote A1-A5 numbered 列表 + Mental Model Framing 进 Active Requirements*
*Ready for ROADMAP.md: yes after REQUIREMENTS — Phase 3-7 收敛已就位，spike 子任务列表已去重至 7 项*
