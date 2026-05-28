# Phase 3: Agent Loop 地基 + Privacy 授权 + Word 多步 demo - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

让 Aster 第一次跑起一个真正的 multi-step agent，并把后续 phase 都依赖的「失控控制 / 错误协议 / 选区修复」三件套地基打满。

**这个 phase 交付：**

1. **Agent loop 地基**：`src/agent/*` 新模块（loop / agentStore / circuit-breaker 骨架 / operationLog 骨架）；chatStore.sendMessage 降级为 thin-delegate 到 `agentStore.runAgent`；max_steps=20 硬上限 + 软着陆提示；单一 `AgentSession.abort(reason)` 入口
2. **错误协议结构化 + sanitized**：四字段 `{code, message, recoverable, hint}` schema + allowlist 兜底占位 sanitization（防 LLM 看到 stack/Key/路径）
3. **Word demo 跑通**：WordAdapter 加 `append_paragraph` write tool + reverse descriptor + humanLabel；在 Word 真机里用 ROADMAP 固定 prompt「写 3 段关于跨境电商物流的内容」跑通 agent loop
4. **AgentControlBar 完整版**（cost meter 砍后剩三件）：pause + abort 双交互按钮 + step counter + max_steps=20 软着陆卡片
5. **CARRY-01**：v1 首次取选区 bug 修复（Phase 4 read tool 上线前的前置依赖）
6. **v1 cost 功能回滚**：拆 v1 已交付的 CostBadge / pricing.ts / Message.costCny / 8 条相关 vitest
7. **7 项 spike 三类分工跑完**

**这个 phase 不交付（Out of scope，避免 scope creep）：**

- 不做：Read tools 全套（PPT/Excel/Word 各家的 list_* / get_*）—— Phase 4
- 不做：Write tools 多宿主铺开（PPT new_slide / Excel apply_formula 等 destructive）—— Phase 6
- 不做：DiffLogPanel UI 卡片真实回放 + undo all —— Phase 5（Phase 3 只埋 OperationLog 写入接口骨架）
- 不做：Circuit breaker 完整 sliding window —— Phase 4 落 ERR-03 时做（Phase 3 只埋骨架）
- 不做：Step 差异化文案（「读取 slide 5 / LLM 思考中」）—— Phase 4 AgentControlBar 扩展
- 不做：Read tool size cap / `untrusted_document_content` 包装 —— Phase 4
- 不做：Onboarding 第 3 步 Step3Privacy —— **永久砍**（见 decisions）

</domain>

<decisions>
## Implementation Decisions

### 全 phase 约束（适用所有 plan）

- **D-01:** Phase 3 主路径 = chatStore 降级为纯 message store，`sendMessage` 转为 thin-delegate 到 `agentStore.runAgent(prompt, ctx, adapter)`。**Agent loop 是唯一路径**，不留双模式 toggle，不留单独 entry。
- **D-02:** 净新增运行时依赖 = **0**。手写 `src/agent/loop.ts` ≤ 80 行 while runner；状态机走 Zustand + AbortController（不引 XState）；token 估算/计数不写（cost 已砍，不需要 tokenizer）。
- **D-03:** Bundle 实测目标 ≤ ~70KB gzipped（NFR-02）。Phase 3 新增模块全 import 进主 chunk；任何超过 5KB gzipped 的新依赖都要 challenge。
- **D-04:** 每个 plan 提交一个 commit；plan 内若分 task 也允许多 commit，但每条 task 必须能独立通过 build + vitest。
- **D-05:** UI 改动一律走 `src/styles.css` 的 CSS 变量与 `src/components/icons.tsx` 的内联 SVG；不引入图标库 / 不上 emoji（CLAUDE.md §UI 设计系统）。
- **D-06:** Phase 3 所有 plan 的 acceptance_criteria 必须包含**真机 UAT 重测项**——Word 真机里 sideload Aster 跑通 demo prompt 才算 done。

### Agent loop（AGENT-01 / -02 / -13）

- **D-07:** 新增模块结构：
  - `src/agent/loop.ts` — `runAgent(prompt, ctx, adapter, signal)` 50 行 while 循环 + step counter + max_steps=20 fail-safe
  - `src/agent/agentStore.ts` — Zustand: `agentStatus` / `currentStep` / `runningTools` / `pause()` / `resume()` / `abort(reason)`
  - `src/agent/circuit-breaker.ts` — **骨架**：接口签名 + dispatch 层调用点；sliding window 完整实现留 Phase 4 ERR-03
  - `src/agent/operationLog.ts` — **骨架**：append 接口；reverse() 描述符类型；DiffLogPanel 真实回放留 Phase 5
  - `src/agent/tools/index.ts` — `buildToolsForHost(host)` / `dispatchTool(name, args)` 工具注册表
  - `src/agent/tools/write/word.ts` — `append_paragraph` 单 tool 完整实现 + humanLabel + reverse descriptor
  - `src/agent/tools/read/word.ts` — `get_paragraph_count` 占位（Phase 4 才真正消费，Phase 3 只为骨架完整）
- **D-08:** chatStore 改动：
  - `Message` 类型加 `'tool'` role + `toolCallId` / `toolResult` / `toolName` / `agentRunId` / `agentStep` 字段
  - `costCny` / `tokenCount` 字段**删除**（cost 全砍）
  - `toolCalls` v1 字段保留（v1 confirm/auto 路径砍掉后这字段仍可用，agent loop 用同一份结构记录每步 tool call）
  - `acceptToolCall` / `rejectToolCall` 方法**删除**（confirm/auto 模式砍掉）
- **D-09:** max_steps=20 软着陆：hit 20 时不直接 abort，而是 push 一条「Aster 觉得这事还没干完，要继续吗？」消息 + 两按钮「继续 20 步」「停下」。继续选项重置 step counter（同一 agentRunId 内可累计 ≥20 步）。
- **D-10:** 单一 `AgentSession.abort(reason)` 统一 4 路 abort 信号：visibility / user pause / max_steps / circuit breaker。**cost cap 路径砍掉**，原计划的 5 路减 1 路。

### Word demo（AGENT-08 + 验收）

- **D-11:** Word demo 验收 = ROADMAP 固定 prompt「写 3 段关于跨境电商物流的内容」单次跑通即 PASS。LLM 调 `append_paragraph` 几次都接受（只要 > 1 次、Word 文档真的多了多段）。
- **D-12:** WordAdapter 新增 `append_paragraph(text: string)` write tool：
  - 直接调 `Word.run(async ctx => { ctx.document.body.insertParagraph(text, Word.InsertLocation.end); await ctx.sync() })`
  - 返回 `{ result: { ok: true }, reverse: { tool: 'delete_last_paragraph', args: {} } }`（Phase 5 才真正实现 reverse 执行）
  - humanLabel(args) = `在文档末尾追加段落「${args.text.slice(0,30)}${args.text.length>30?'...':''}」`
- **D-13:** AGENT-08（缺 humanLabel TS/lint 编译失败）→ Phase 3 只**写好** eslint rule + tool registry 类型守卫，但 enforce 暂不阻断（Phase 3 只 1 个 write tool，强制有点早）；Phase 5 多 tool 上线时 flip 开关。eslint rule 文件 + 注释解释此 phase 不 enforce 的原因要落地。

### 错误协议（ERR-01 / ERR-02）

- **D-14:** Tool error schema = `{ code: ErrorCode, message: string, recoverable: boolean, hint: string }`，code 枚举（9 → 8 条）：`INVALID_ARGS / NOT_FOUND / PERMISSION_DENIED / HOST_API_FAILED / PRIVACY_BLOCKED / CIRCUIT_OPEN / STEP_LIMIT / UNSUPPORTED`。**去掉** `COST_CAP_EXCEEDED`（cost 全砍）。
- **D-15:** Sanitization = **严格 allowlist + 兜底占位**：
  - 每个 `AsterError` 子类在定义时必须预写 `code` / `message` / `hint` / `recoverable` 四字段（中文 message + 中文 hint）
  - tool dispatch 层 catch 后**只取**这四字段构造 toolResult；原始 `error.message` / `error.stack` / 其它字段完全不接触
  - 作者忘写 hint 时，dispatch 层自动填占位 `'发生错误，请重试'`
  - 陌生异常（非 AsterError）统一兜底为 `{ code: 'UNSUPPORTED', message: '宿主操作失败', hint: '发生错误，请重试', recoverable: false }`
- **D-16:** ERR-01/02 的 vitest 覆盖：构造一个会抛带 stack + 绝对路径 + 假 Key 片段的 mock tool，验证 LLM 看到的 toolResult 不含 `__dirname` / `process.env` / `sk-` 模式 / `/Users/` 路径片段。

### Privacy 全套砍掉（PROJECT.md Q10 衍生 superseded）

- **D-17:** **PRIV-01..05 全部砍掉**。Phase 3 不实现：
  - 不做：Onboarding Step3Privacy.tsx（Onboarding 仍是 2 步）
  - 不做：Settings 「关闭文档全文发送」opt-out toggle
  - 不做：Provider allowlist（`api.deepseek.com` / `api.aihubmix.com`）
  - 不做：ProviderConfig 不加 `fullDocAccess` 字段
  - 不做：Provider 切换 banner
  - 不做：Phase 7 PRIVACY.md
- **D-18:** 唯一保留的隐私相关动作：v1 选区胶囊 + CARRY-01 选区 bug 修复（D-22）—— 不在 PRIV 范围，是 v1 选区数据流。
- **D-19:** REQUIREMENTS.md 的 PRIV-01..05 五条改 status="砍"或转 v2.1+ 评估。理由：早期用户 = 项目作者自己 + 亲人，不需要复杂授权 UX。Phase 4 read tools 直接默认全开，无 privacy gate。

### Cost 全套砍掉（含 v1 回滚）

- **D-20:** **AGENT-03 / -04 / -05 / -06 全部砍掉**。Phase 3 不实现：cost meter / pre-call gate / Settings 可调 cost cap / SSE include_usage 解析消费。`max_steps=20` 是 Phase 3 **唯一**失控防御。
- **D-21:** **v1 已交付的 cost 显示一并拆**（新增 1 个 plan）：
  - 删 `src/components/CostBadge.tsx` 整组件
  - 删 `src/providers/pricing.ts` 整文件（含 PROVIDER_PRICING / CNY_PER_USD / calcCostCny）
  - `src/store/chat.ts` Message 类型移除 `costCny` / `tokenCount` 字段（如已废弃 D-08 已包含）
  - `src/components/ChatBubble.tsx` 移除 CostBadge 嵌点
  - `src/lib/sse.ts` `SSEUsage` 事件类型保留（陌生 sse 兼容性），但 chatStore 不再消费
  - 删 8 条相关 vitest：`CostBadge.test.tsx` / `pricing.test.ts` / chatStore 内 cost 路径测试 / G-04 回归
  - v1 COST-01 / COST-02 在 REQUIREMENTS.md 标 status="砍"

### CARRY-01 首次取选区 bug 修复

- **D-22:** 修复策略归 Claude's Discretion（planner 看 `App.tsx` / `useAdapter` / Adapter `onSelectionChanged` 一眼就能定）。**约束**：必须在 Phase 4 read tool 上线前修完；vitest 覆盖三宿主首次 mount 立即取到选区（PPT 已选中 slide / Excel 已选 range / Word 已选段都要测）；UAT 重测三宿主真机首次打开 Task Pane 看胶囊立即显示。
- **D-23:** 可能的修复路径（仅参考，planner 拍板）：
  - 路径 A：组件 mount 时主动调一次 `adapter.getSelection()` 灌初值
  - 路径 B：`adapter.onSelectionChanged(callback)` 注册时立即同步 trigger 一次 callback
  - 路径 C：Office.onReady 后立刻取选区灌 chatStore initial state
  - planner 倾向 A（最小侵入 / 单点修），但要看 v1 现有 selection 流向决定

### Spike SP-1..SP-7 三类分工

- **D-24:** 三类拆分（用户偏好「Claude 能自跑的别动手 + v1 验过的别重跑」）：

  **类型 ①：已 v1 验过 / 砍掉 → 直接归档不跑**
  - SP-2 include_usage 返 usage：v1 Phase 02 已验（`sse.ts` 在解析 `chunk.usage`，CostBadge 真机显过 ¥），且 cost 砍后不需要 → **归档**
  - SP-6 Office.js proxy 跨 await 失效：PITFALLS A-06 已知 100% 复现，v1 三宿主 adapter 已按 pure data in/out 写过（`await Word.run / Excel.run / PowerPoint.run` 闭环）→ **归档**

  **类型 ②：Claude 自跑（用户提供 `.env.local` Key）**
  - SP-1 DeepSeek tool_calls delta 多 tool 累积验证：构造让 LLM 一次返 3 tool_call 的 prompt → 抓 SSE raw → 验证 `sse.ts` accum Map 按 index 主键累积无串污染。需要 `DEEPSEEK_API_KEY`。
  - SP-3 aihubmix passthrough：经 aihubmix 调 gpt-4o（或用户指定的 claude-opus / Doubao）发 tool_call → 验证上游透传是否 OpenAI 标准。需要 `AIHUBMIX_API_KEY` + 用户指定上游 model。
  - SP-7 三 tool 并行 SSE raw log 归档：跟 SP-1 同一份产物，脱敏后存 `.planning/spikes/00X-{slug}/`。

  **类型 ③：用户真机操作（Claude 写探测代码，用户在 sideloaded Aster 跑）**
  - SP-4 Office.js 三宿主 reverse 操作可达性：Claude 在 spike 分支提供探测代码（嵌进 Task Pane 临时按钮），用户在 PPT/Excel/Word 真机点几下 + console 截图发回。
  - SP-5 PPT `slide.delete()` 真机可用性 + Web 反向排序 bug：同上，PPT 真机跑 delete + 验证排序。
- **D-25:** Spike 失败 fallback 按分工各归各人：
  - 类型 ② 失败：Claude 直接写 fallback 决策（如 SP-3 aihubmix 不透传 → Phase 3 demo 仅支持 DeepSeek，Phase 4 read tools 也仅 DeepSeek，aihubmix LLM 转 Phase 7 model 兼容测试再处理）
  - 类型 ③ 失败：用户告知结果，Claude 提议 fallback 用户确认（如 SP-5 slide.delete 不可用 → Phase 5 PPT undo 改走 snapshot fallback）
  - **不预设全部 fallback**，分工明确后落到能判断的人手里
- **D-26:** Spike 跑的时间窗 = Phase 3 第一周 day 1-3。类型 ① 立刻归档；类型 ② 用户给 Key 后 Claude 当天跑完；类型 ③ 用户在 Phase 3 第一周内挑时间。任意类型 ② / ③ 失败 + Claude 评估「影响 Phase 3 主路径接口」时 → 停下来讨论。

### Claude's Discretion

下列 planner 根据代码 + RESEARCH.md + PATTERNS.md 拍板，不需要本 phase 用户预决：

- **CARRY-01 具体修复路径**（D-22 / D-23 三选一 + 单元测试覆盖策略）
- **Demo system prompt 初稿**：教 LLM 怎么知道要调 `append_paragraph`、batch tool 倾向、`untrusted_document_content` 概念引入（Phase 4 才用但 system prompt 可以提前埋）；Phase 3 UAT 跑出来再迭代
- **humanLabel eslint rule 写法**：rule 文件 + 注释解释 Phase 3 不 enforce 但 Phase 5 flip 开关的原因
- **新增 `src/agent/*` 模块的内部数据结构**：tool registry 的 Map 形态、agentStore 的 Zustand selectors、ToolResult 的 TypeScript 类型 widening
- **AgentControlBar 的视觉细节**：按 CLAUDE.md §UI 设计系统的 token 选色 / 间距；玻璃拟态 vs 实色 background
- **max_steps 软着陆卡片的具体文案**：保持「Aster 觉得这事还没干完，要继续吗？」气质，但具体措辞 planner 写
- **Onboarding 第二步 GIF 示意「跑完会这样汇报」（ONB-01）** → **不在 Phase 3 范围**，原属 Phase 6 ONB-01；Phase 3 不动 Onboarding

### Folded Todos

无 todo 折入本 phase。

`builtin-model-dropdown.md` 已 tag `resolves_phase: 4`（归 Phase 4 CARRY-02），`copy-chat-history.md` 已 tag `resolves_phase: 5`（归 Phase 5 CARRY-03）—— 两者都不属 Phase 3 范围。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents（researcher / planner / executor）MUST 读这些文件，决策依据全在里面。**

### 项目级（必读）
- `.planning/ROADMAP.md` — Phase 3 段（goal / 7 条 SC / 7 项 spike / 3 条 Risk / 3 条 Anti-Patterns）。**注意 ROADMAP SC2/SC3/SC4 涉及 cost 的描述已 superseded by 本 CONTEXT D-20**
- `.planning/REQUIREMENTS.md` — AGENT-01/02/08/13 + ERR-01/02 + CARRY-01 + NFR-02 为本 phase 范围；其余 AGENT-03/04/05/06 + PRIV-01..05 + ERR-01 中 COST_CAP_EXCEEDED 已 superseded
- `.planning/PROJECT.md` — Core Value / 5 条硬约束（无后台 / Bundle / Performance / Security / Compatibility）；Q10 衍生 PRIV-* 全部被本 CONTEXT D-17 推翻
- `CLAUDE.md` — §技术栈表 / §UI 设计系统 / §发布授权 / DeepSeek+aihubmix API 与单价表（cost 砍后单价表不再消费，但 spike SP-3 可能用作上游 model 选项参考）

### 研究产出（必读）
- `.planning/research/SUMMARY.md` — Phase 3 deliverables 列表 + 7 项 spike 原始出处 + Q9/Q10/Q11 衍生 deliverables 全清单（PRIV-* + AGENT-cost 在此 superseded）
- `.planning/research/ARCHITECTURE.md` — v1 codebase 集成路径 + Message schema evolution + 7 个 Q1-Q9 设计决策 + 6 个 anti-patterns（AP-1/AP-2/AP-3 在 ROADMAP 已显式提醒）
- `.planning/research/PITFALLS.md` — 30 条 pitfall 全表 + Phase × Pitfall 责任地图（A-06 SP-6 已归档 / A-04+A-05 隐私 砍后不消费 / A-01 cost 砍后不消费 / A-07/A-08/A-12/A-13 Phase 3 行使 / A-09/A-11/A-15 Phase 5 行使）
- `.planning/research/FEATURES.md` — Agent UX patterns / read+write tool inventory / anti-features

### Phase 2 已交付上游产物（Phase 3 直接消费）
- `.planning/phases/02-provider-settings-onboarding-ux/02-CONTEXT.md` — Phase 02 D-01..D-17 决策（D-15 选区胶囊 / D-16 adapter.insert 最小 text 写回 / D-17 cost 徽章 → 本 phase D-21 拆）
- `.planning/phases/02-provider-settings-onboarding-ux/02-RESEARCH.md` — Provider 抽象 / SSE / 错误类层级研究
- `.planning/phases/02-provider-settings-onboarding-ux/02-PATTERNS.md` — Phase 02 文件→pattern 映射（本 phase 改动多文件复用此映射）
- `.planning/phases/02.1-gap-closure-02-uat/02.1-CONTEXT.md` — Phase 02.1 D-01..D-35 决策；G-05 tool-call 写文档（D-16..D-24）在本 phase **部分推翻**（D-19 confirm/auto toggle 砍掉，详见本 phase D-01/D-08）

### 关键源文件（plan 的 read_first 候选）

**Agent loop 新增模块的归宿：**
- `src/agent/loop.ts`（新增）
- `src/agent/agentStore.ts`（新增）
- `src/agent/circuit-breaker.ts`（新增骨架）
- `src/agent/operationLog.ts`（新增骨架）
- `src/agent/tools/index.ts`（新增）
- `src/agent/tools/write/word.ts`（新增）
- `src/agent/tools/read/word.ts`（新增）

**v1 改动文件：**
- `src/store/chat.ts` — sendMessage 改 thin-delegate + Message 类型加 'tool' role + 删 cost 字段 + 删 acceptToolCall/rejectToolCall
- `src/store/providers.ts` — 删 `autoInsertMode` / `setAutoInsertMode` / `AUTO_INSERT_MODE` storage key（v1 confirm/auto toggle 砍）
- `src/components/InputBar.tsx` — sendMessage 调用点改走 agentStore.runAgent
- `src/components/ChatStream.tsx` — 渲染 role='tool' 消息（折叠卡片，showLabel = humanLabel(args)）
- `src/components/ChatBubble.tsx` — 移除 CostBadge 嵌点；移除 confirm/auto 预览卡 D-20 路径
- `src/components/SettingsPanel.tsx` — 移除「AI 自动写文档」开关（D-19 G-05 砍）
- `src/lib/sse.ts` — 保留 tool_calls 多 index 累积逻辑（v1 已实现，SP-1 验证）；保留 SSEUsage 类型不消费
- `src/providers/openai-compat.ts` — INSERT_TO_DOCUMENT_TOOL 移除（v1 hardcode 单 tool，v2 agent loop 由 tool registry 动态构建）；`chat()` 加 `tools` 入参由 caller 传
- `src/adapters/WordAdapter.ts` — 加 `append_paragraph` write tool 接口（不在 `insert()` 内，单独 method 或 tool registry）
- `src/adapters/{Ppt,Excel,Word}Adapter.ts` — capabilities() 加 agent 时代标识（待 planner 决定具体字段）
- `src/components/Onboarding/OnboardingModal.tsx` — 不动（仍 2 步）
- `src/components/CostBadge.tsx` — **删**
- `src/providers/pricing.ts` — **删**

**新增 UI 组件：**
- `src/components/AgentControlBar.tsx`（新增，Phase 3 完整版）
- `src/components/AgentControlBar.test.tsx`（新增）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/lib/sse.ts` — **v1 已实现 tool_calls 按 index 累积**（accum Map + tool_call_delta + tool_call_end）。SP-1 多 tool 验证就是验这块。`sanitizeErrBody` 函数（剥 sk- 与 apiKey 字段）作为辅助防护保留，不替代 D-15 sanitize allowlist。
- `src/providers/openai-compat.ts` — `streamChat` 已支持 tools 入参 + tool-call 能力探测（D-18 G-05 setSupportsToolCall）；v1 hardcode 单个 `INSERT_TO_DOCUMENT_TOOL`，v2 改由 agent tool registry 传入。
- `src/store/providers.ts` — `setSupportsToolCall` 已实现（探测失败的 Provider 标记 supportsToolCall=false）；agent loop 启动前可消费这个标识。`autoInsertMode` / `setAutoInsertMode` / AUTO_INSERT_MODE storage key 在本 phase 删除。
- `src/adapters/{Ppt,Excel,Word}Adapter.ts` — 三宿主骨架 + `getSelection()` + `onSelectionChanged()` 真实可用；`insert({type:'text'})` v1 已实现。CARRY-01 修复在此层。
- `src/errors/index.ts` — 已有 8 类错误类（KeyInvalidError / QuotaExceededError / ContextTooLongError / NetworkError / RateLimitError / ContentFilterError / ModelNotFoundError / HostApiError + UnsupportedOperationError）。本 phase 在每类 ensure 四字段（code/message/recoverable/hint）齐全；不齐的补；新增 `CircuitOpenError` 与 `StepLimitError`。
- `src/lib/storage.ts` — partitioned localStorage 工具完整可用；新增 storage key（如 spike findings 缓存）经此工具走。
- `src/components/icons.tsx` — 内联 SVG 图标系统；AgentControlBar 的暂停 / 中止 / step counter 用此添加。
- `src/styles.css` — CSS 变量驱动 light/dark；AgentControlBar 视觉走此 token 系统（CLAUDE.md §UI 设计系统）。

### Established Patterns

- **Office.js CDN，不进 bundle**；`Office.context.partitionKey` localStorage 分区（KEY-01 v1 已落）
- **主题随 Office 宿主**：`main.tsx` 读 `officeTheme` 设 `#root` data-theme；新 UI 两套主题都顾到
- **所有 UI 字符串用 Lingui macro 包裹**（zh-CN only）
- **LLM 调用用原生 fetch + ReadableStream**，不引 SDK
- **Adapter 接口契约「纯数据进 / 纯数据出」**：proxy 对象绝不出 `Word.run` / `Excel.run` / `PowerPoint.run` 闭包；SP-6 已知行为 + v1 已防御（本 phase 加 eslint rule 进一步守门，配合 [[feedback-recurring-failure-add-gate]]）
- **每个 plan 一个 commit + 真机 UAT 重测**（v1 Phase 02 跌过的坑，本 phase D-06 强制）

### Integration Points

- **InputBar `handleSend`** → 调 agentStore.runAgent（本 phase D-01）
- **agentStore.runAgent** → 内部调 `src/agent/loop.ts` `runAgent()` 函数
- **loop.ts step 内** → 调 `openai-compat.streamChat` (LLM call) + `dispatchTool(name, args)` (tool call)
- **dispatchTool** → 经 tool registry 路由到 adapter 的对应方法（如 `append_paragraph` → WordAdapter.appendParagraph）
- **AgentControlBar** → 订阅 agentStore，渲染 status + step counter + max_steps 软着陆卡片
- **ChatStream** → 渲染 role='user' / 'assistant' / 'tool' / 'error' 四类消息；role='tool' 用 humanLabel(args) 展示中文人话

</code_context>

<specifics>
## Specific Ideas

- **用户对「不打扰」气质有非常强的偏好** —— 这一次讨论砍掉 PRIV-* 全套 + cost 功能全套，理由都是「自用工具不需要复杂 UX」。planner 在 Phase 3 任何 UI 改动前都先想想：这是给用户**信任 Aster** 的功能，还是给企业法务团队看的功能？后者别做。详见 [[project-aster-privacy-simplified]] / [[project-aster-cost-removed]]。
- **「美观优先」气质继续**：AgentControlBar 玻璃拟态 / 渐变 accent / 暂停按钮 hover 状态都要顾到；不要回退到「灰底白字的企业 UI」。详见 [[feedback-beauty-over-fluent]]。
- **Word demo 验收 prompt 是 ROADMAP 那句原文**：「写 3 段关于跨境电商物流的内容」。Plan 阶段不要改这句；UAT 阶段保留这句作为 SC1 回归验收脚本。
- **Spike 三类分工是本 phase 的关键工程节奏**：第一周 day 1-3 类型 ① 立即归档 + 类型 ② Claude 自跑（待用户提供 Key）+ 类型 ③ 用户挑时间跑。Plan 阶段把 spike 当 task 而非独立 plan（ROADMAP 已要求 embedded）。
- **agent loop 任何「失控防御」缺失都比「失误」更可怕** —— max_steps=20 是 Phase 3 唯一防线（cost 砍后），plan 阶段必须把 max_steps 测试用作 acceptance criteria 之一（构造一个能让 LLM 一直循环的场景验证软着陆触发）。
- **chatStore 改动跨多文件**：sendMessage thin-delegate + Message 类型字段增删 + acceptToolCall/rejectToolCall 删除 = 牵动 ChatStream / ChatBubble / InputBar / SettingsPanel / 多条测试。planner 把这条改动单独切成一个 plan，避免和「新增 agent loop」混进同一 commit。
- **v1 cost 回滚也是单独 plan**（D-21）：拆 CostBadge / pricing.ts / 8 测试是个独立工作面，不混入 agent loop / agent UI / spike。
- **Pause/abort 语义按 AGENT-12 双语义**：暂停 = 停下一步、保留 in-flight tool 跑完；中止 = 立刻 + 显示 undo all 兜底（Phase 3 undo all 还没真实回放，按钮点出占位 toast「Phase 5 上线」即可）。

</specifics>

<deferred>
## Deferred Ideas

### Phase 4+ 回头消费
- **AGENT-03 实时 cost meter** → 永久砍，不消费（cost 全砍）
- **AGENT-04 SSE include_usage 解析** → 永久砍，不消费
- **AGENT-05 ¥10 cost cap pre-call gate** → 永久砍，不消费
- **AGENT-06 Settings 可调 cost cap slider** → 永久砍，不消费
- **PRIV-01..05 隐私授权全套** → 永久砍，扩用户范围 / OSS 公开后再评估（见 [[project-aster-privacy-simplified]]）
- **read tool `untrusted_document_content` 包装** → Phase 4 落（system prompt 在 Phase 3 demo 可以提前埋伏笔，但 read tool 全量上线在 Phase 4）
- **Circuit breaker 完整 sliding window** → Phase 4 ERR-03 落（Phase 3 只埋骨架接口 + dispatch 调用点）
- **DiffLogPanel 真实回放 / undo all** → Phase 5（Phase 3 只埋 OperationLog 写入接口骨架）
- **humanLabel eslint enforce** → Phase 5 多 tool 上线时 flip 开关（Phase 3 rule 写好但不阻断）
- **Step 差异化文案（「读取 slide 5 / LLM 思考 / 修改 slide 5」）** → Phase 4 AgentControlBar 扩展（Phase 3 step counter 是数字+总数，没文案）
- **ONB-01 Onboarding 第二步 GIF 示意「跑完会这样汇报」** → Phase 6（本 phase 不动 Onboarding）

### v2.1+ 评估
- **Resume from checkpoint**（agent run 中途刷新可恢复）— FUT-03
- **Per-action consent UX** — FUT-04（永不做）
- **Multi-agent spawn** — FUT-05
- **Cross-session memory** — FUT-06

### Reviewed Todos（not folded）
- `builtin-model-dropdown.md` — Phase 02.1 UAT 反馈，已 tag `resolves_phase: 4`（归 CARRY-02），**不并入** Phase 3
- `copy-chat-history.md` — Phase 02.1 UAT 反馈，已 tag `resolves_phase: 5`（归 CARRY-03，扩展为 schema-aware copy step log），**不并入** Phase 3

### 推到 plan 阶段决定（Claude's Discretion，不写死）
- CARRY-01 选区 bug 具体修复路径（D-22 / D-23 三选一）
- Demo system prompt 初稿
- humanLabel eslint rule 具体写法 + 不 enforce 注释
- max_steps 软着陆卡片具体文案
- AgentControlBar 玻璃拟态 / 渐变 / 间距细节

</deferred>

---

*Phase: 03-agent-loop-privacy-word-demo*
*Context gathered: 2026-05-28 via /gsd-discuss-phase 3*
