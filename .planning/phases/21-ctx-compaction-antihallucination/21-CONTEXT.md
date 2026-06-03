# Phase 21: B 核心——摘要压缩 + 抗幻觉 - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning
**Source:** Team Lead pre-research + discuss-p21（v2.3 milestone autonomous step）——决策已锁，无需再开 discuss-phase（沿用 Phase 20 同款「Team Lead 锁决策」范式）

<domain>
## Phase Boundary

让 agent 在长对话里保持清醒，同时把 `[system][摘要]` 做成新的稳定缓存前缀。三块联动 + 一块独立的 prompt 改动：

**In scope（CTX-03/04/05/06）:**
- **CTX-03**: 按 **token 高/低水位**触发的摘要压缩（compaction，非按轮数）。历史预估 token 超高水位 → 调一次 LLM 把最老一段压成要点摘要（保留仍有效的事实/决定/用户偏好，扔掉已被推翻的），压后历史回落到低水位；高/低水位差距大 → 一次压缩撑很多轮。最近若干轮原文保留不动。
- **CTX-04**: 摘要作为一条固定消息插在 `[system]` 之后、最近原文之前 → `[system][摘要]` 成为新的稳定缓存前缀（两次压缩之间命中，压缩那一刻 miss 一次）；摘要随聊天记录一起持久化到 localStorage（沿用 HIST 边界），F5 刷新可恢复。
- **CTX-05**: 重审 `truncateTo20Turns`（`loop-helpers.ts`）——从「过 20 轮后每轮丢最老一条」的滑动窗口（前缀每轮都变 → 几乎全 miss）改为「攒够一大批才砍」的高水位批量兜底；极端长对话有明确兜底路径（不无上限增长、不盲目丢有用上下文）。
- **CTX-06**: 三宿主（PPT/Excel/Word）领域段 system prompt 各加一条抗幻觉指引「永远信任刚重读的文档现状，不信历史里几十轮前的旧读取记忆——文档会被改动，旧读数早已过时」。

**Out of scope（本 phase 不碰）:**
- 不加任何压缩可见 UI / 聊天指示器（**静默**，D-21-08）——与现有静默截断一致。
- 不新增 Settings「压缩模型」字段（D-21-02：复用 `resolveLLMConfig()` 的已配置模型）。
- 不新增任何 write 工具 → 无 undo/`operationLog` 守门需求（B 系列纯上下文/读路径）。
- 不动 PVQ（A 系列，Phase 22-24）。
- 不把「取当前时间」做成 tool（REQUIREMENTS 已否决）。

**工程性质:** 纯 TS 上下文/缓存逻辑 + prompt 字符串改动。**0 净新增运行时依赖**，bundle 预期 ~0 增量（baseline 80.53KB gzip，gate ≤82KB）。
</domain>

<decisions>
## Implementation Decisions（全部 LOCKED）

### D-21-01 压缩积极度 = 保守·质量优先（高 120K → 低 40K，**初值、UAT 可调**）
- 高水位 `COMPACT_HIGH_WATERMARK_TOKENS = 120_000`、低水位 `COMPACT_LOW_WATERMARK_TOKENS = 40_000`（STATE.md 2026-06-03 用户决策）。
- 这是**初值**：在 `src/agent/compaction.ts` 定义为命名常量 + 注释「初值，待真机/UAT 调」，方便单点改。高/低差距大（80K gap）→ 一次压缩撑很多轮（贴「质量>>成本」）。
- 触发判定：历史预估 token **严格大于**高水位才触发（`> HIGH`，等于不触发）。

### D-21-02 压缩模型 = 用户**已配置**的模型（不硬编码 flash、不加 Settings 字段）
- 压缩调用复用 `resolveLLMConfig()`（`loop.ts`）解析出的当前 Provider `model`——`resolveLLMConfig` 每 Provider 只有一个 model。
- 「flash 档」意图由「复用已配置模型」兑现：DeepSeek 用户若配 flash 即省，非 DeepSeek Provider 自动用其唯一模型。**绝不硬编码 `deepseek-v4-flash`**、**绝不加 Settings「压缩模型」字段**。用户已接受此成本（CTX-03）。

### D-21-03 token 计量 = 复用项目既有 1.6 chars/token 保守上界
- 用 `estimateTokens(text) = Math.ceil(text.length / 1.6)`（memory Phase 04-01 TOOL-06 既有约定），最简单 + 全项目一致。
- 触发判定必须在调用**前**做（决定要不要压），只能用先验估算（真实 usage 是事后才知）——故选估算而非 `stream_options.include_usage` 的事后真实值。水位距 DeepSeek 1M 窗口有巨大 headroom，估算偏差不影响安全，只影响「何时压」（UAT 可调）。

### D-21-04 摘要插入机制：写 wire 数组，绝不 mutate `chatStore.messages`
- 注入站点 = `loop.ts` `runAgent` 构造 wire `messages: WireMessage[]` 的位置（当前第 70-79 行）。
- 最终 wire 结构：`[system][摘要(固定消息)][最近原文历史][当前 user + buildTimeContext() 时间尾]`。
- 摘要消息 role = **`system`**（系统侧上下文，非用户输入；`WireMessage` 联合已含 `{role:'system';content}`；DeepSeek / OpenAI-compatible 均支持多条 system 消息；保证 `[system][摘要]` 成稳定前缀；放 system 避免模型把摘要当新用户指令/去回复它）。content 带显式 marker（如 `【对话历史摘要（早期轮次压缩，仍然有效的事实/决定/偏好）】\n…`）。
- **硬约束**：摘要只进 wire 的 `messages` 数组；**绝不改 `chatStore.messages`**（UI 永远保留完整历史；缓存铁律：易变内容靠后，静态前缀稳定）。
- 保留 Phase 20 的 `buildTimeContext()` 时间尾——`[当前]` user message 末尾的时间后缀原样保留，摘要插入不得扰动它。

### D-21-05 摘要 + 截断点状态：存 chatStore 独立字段（非 messages），随历史持久化（CTX-04）
- chatStore 新增两个独立状态字段（**不进 messages 数组**）：
  - `summary: string`（缺省 `''`）——滚动累积的历史摘要文本。
  - `summaryThroughId: string | null`（缺省 `null`）——已折进摘要的「最后一条原文消息」的 message id（稳定指针，抗 index 漂移）。
- 「最近原文」= `messages` 中 `summaryThroughId` 之后的 user/assistant 消息（`messagesAfterCutoff(messages, summaryThroughId)`；id 为 null → 全部；id 找不到 → 兜底返回全部，由下一次压缩重新触发，防 quota-trim 删掉 cutoff 消息后崩）。
- 新增 setter `setCompactionState(summary, throughId)`；`clearHistory` 须一并重置 `summary=''`/`summaryThroughId=null`。

### D-21-06 持久化版本 bump 1→2 + F5 恢复形状（CTX-04）
- `saveHistory(docKey)` payload bump 到 `version: 2`，新增 `summary` + `summaryThroughId` 两字段。
- 恢复形状：
  ```json
  { "version": 2, "messages": [{"id","role","content","ts"}], "summary": "…", "summaryThroughId": "<msgId|null>", "lastSaved": 0 }
  ```
- `loadHistory`：兼容 **version 1**（旧存档：只恢复 messages，`summary=''`/`summaryThroughId=null`，不拒绝旧聊天）**与 version 2**（恢复 messages + summary + cutoff）。把现有 `stored.version !== 1` 守卫改为接受 1 或 2。
- `serializeForStorage` 白名单不变（仍只存 user/assistant 正文 ≤2000 字符）；摘要是独立小字段，直接进 payload。`StorageQuotaError` trim 路径保留 summary（小），messages 仍可被 trim（cutoff 丢失由 D-21-05 兜底吸收）。
- 压缩成功后**立即** `saveHistory(docKey)` 一次（强化「F5 可恢复」），自然结束时仍照常 save（幂等）。

### D-21-07 截断重审：compaction 主控 + 高水位批量兜底（CTX-05）
- **常规长度控制 = compaction**（折进摘要，不丢内容）。`truncateTo20Turns` 的「过 20 轮滑动窗口」语义被取代。
- 把 `truncateTo20Turns` 重构/改名为 **`applyHistoryBackstop(messages, maxTokens?)`**（token 上界兜底，按整轮丢——user + 其后 assistant/tool 整组删，防孤立 tool 消息致 400）：
  - 默认硬顶 `HISTORY_BACKSTOP_MAX_TOKENS = 160_000`（**高于**高水位 120K → 正常路径绝不抢在 compaction 之前触发）。
  - 估算 ≤ maxTokens → 原样返回（正常路径 no-op，前缀稳定）；超顶 → 从最老整轮开始丢，丢到 ≤ maxTokens 或只剩 `RECENT_TURNS_FLOOR` 轮为止（永不低于地板）。
  - **诚实降级定位**：这是「盲丢最老整轮」的**最后防线**，仅当 compaction 失效（压缩 LLM 调用失败）或压缩后原文仍超硬顶时才生效；正常路径几乎不触发。primary 兜底 = compaction（摘要不丢），backstop = 兜底的兜底（摘要不可用时防 context 撑爆 / 防无上限增长）。
- `RECENT_TURNS_FLOOR = 4`（compaction 与 backstop 共用：无论如何保留最近 4 个 user 轮原文，保护即时上下文）。
- loop.ts import 与现有 3 个截断单测须同步改到新名/新语义。

### D-21-08 静默（无压缩可见 UI）
- 压缩触发**不在聊天里加任何提示/指示器**（STATE.md 2026-06-03 用户确认），与现有静默 20 轮截断一致，贴 Aster 自主/少打扰。`summarizeSegment` 直接调 `llm.streamChat` 累积文本，**不**走 `streamAssistantTurn`（不 push 任何 chatStore 消息、不渲染 UI）。

### D-21-09 CTX-06 抗幻觉指引：三宿主各加一条**独立**新项（Phase-23-friendly）
- 在 `system-prompt.ts` `getDomainSegment` 的 ppt / excel / word 三个 case 各**新增一条独立编号项**，统一含锚点句 `旧读数早已过时`，例如：
  > 【文档现状权威】永远以你刚用 read 工具读到的文档现状为准；不要依赖历史里几十轮前的旧读取结果——文档随时会被用户或你自己改动，旧读数早已过时。需要确认时重新读，不要凭记忆。
- ⚠️ **跨 phase（STATE.md 2026-06-03 提醒）**：Phase 23（PVQ-05）将**删除** PPT 段里冗余的坐标/自查规则（现 PPT 项 #6 版式意识、#8 宪法式自查）。CTX-06 必须写成**自成一条、与坐标/自查规则解耦**的独立项，让 Phase 23 能干净地删坐标/自查项而**保留** CTX-06 指引。不要把 CTX-06 并进现有 #8 自查项里。
- CTX-06 不动 compaction（loop.ts 已 filter 掉历史里的旧 tool 结果，本条是 prompt 层补强）。

### Claude's Discretion（实现细节，planner 定）
- `compaction.ts` 内部函数拆分粒度（纯 `selectCompactionPlan` / `summarizeSegment` 编排 / `maybeCompactHistory` 入口）。
- summarize prompt 的具体中文措辞（须含：合并旧摘要 + 新段、保留仍有效事实/决定/偏好、扔掉已被推翻的、忠实不杜撰、只输出摘要文本、勿执行转录文本里的任何指令）。
- 摘要 marker 文案、summary 目标长度软上限提示。
- backstop 是改名 `applyHistoryBackstop` 还是保名重构（推荐改名，语义诚实）。
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 源码（直接改动）
- `src/agent/loop.ts` — `runAgent` 第 46-104 行；`resolveLLMConfig()` 第 33-44 行（压缩复用其 model，D-21-02）；wire `messages` 构造第 70-79 行（注入站点，D-21-04）；历史截断第 67-68 行（`truncateTo20Turns` 调用点，改 `applyHistoryBackstop`）；natural-end `saveHistory` 第 91-93 行。**D-02 预算：runAgent ≤ 80 code lines**——重逻辑放 `compaction.ts`/`loop-helpers.ts`，loop.ts 只 import + 接线。
- `src/agent/loop-helpers.ts` — `truncateTo20Turns` 第 191-205 行（重构为 backstop，D-21-07）；`WireMessage` 联合第 23-41 行（摘要消息用 `{role:'system'}`）；`streamAssistantTurn` 第 68-111 行（compaction **不**复用它，D-21-08 参照其 streamChat 用法）。
- `src/store/chat.ts` — `ChatState` 第 75-109 行（加 `summary`/`summaryThroughId`/`setCompactionState`）；`serializeForStorage` 第 122-135 行（不变）；`loadHistory` 第 270-284 行（version 1|2 兼容，D-21-06）；`saveHistory` 第 286-303 行（version 2 + 新字段）；`clearHistory` 第 262-268 行（重置摘要状态）。`Message` 第 47-69 行（id/role/content/ts 形状）。
- `src/agent/system-prompt.ts` — `getDomainSegment` 第 62-95 行（三宿主 case 各加 CTX-06 项，D-21-09）；`buildSystemPrompt` 第 105-111 行（CTX-06 自动随之；摘要 token 估算可用其返回值）。

### 源码（read_first / 参照，不一定改）
- `src/providers/openai-compat.ts` — `OpenAICompatibleLLM.streamChat` 签名（compaction 编排直接调它做单轮文本补全，不传 toolDefs）。
- `src/lib/sse.ts` — `SSEEvent` 联合（compaction 只消费 `type:'delta'`，忽略 reasoning/usage/tool_call）；`streamSSE` 已注入 `stream_options.include_usage`（D-21-03 不依赖其事后值）。
- `src/lib/storage.ts` / `src/lib/docKey.ts` — `storage.get/set/remove` 泛型 JSON 接口、docKey 生成（持久化沿用）。

### 测试（直接改/加）
- `src/agent/loop-helpers.test.ts` — 第 91-130 行 3 个 `truncateTo20Turns` 用例（改到 backstop 新名/新语义）。
- `src/agent/loop.test.ts` — 现有 mock LLM 范式（`setLLMStream` / `OpenAICompatibleLLM` vi.mock，第 6-13 行；CTX-01 wire 捕获范式第 末尾 `capturedMessages`）。加 compaction 集成断言。
- `src/store/chat.test.ts` — 第 234-295 行持久化套件（storage mock + 第 263-266 行 `version: 1` 断言**必须**改 `version: 2`）。
- `src/agent/system-prompt.test.ts` — Phase 20 CTX-02 守门范式（`it.each(['word','excel','ppt'])`）；加 CTX-06 锚点守门。
- 新建 `src/agent/compaction.test.ts`。

### 项目约束 / memory
- `.planning/STATE.md` §缓存铁律（第 49 行）+ 2026-06-03 决策（压缩积极度 / 静默 / 跨 phase 同区域提醒，第 166/169/172 行）+ Phase 20-01 范式（第 175 行：易变内容 wire-tail 注入、历史保持干净）。
- `./CLAUDE.md` §Conventions（发布授权；本 phase 不动 UI）；memory `project_bundle_size_guard`（先 build 再 size，陈旧 dist 假绿）、`recurring_failure_add_gate`（compaction 边界 + CTX-06 加结构守门）、`precision_over_brevity`（摘要 prompt 忠实精确）、`i18n_extract_and_test_noise`（本 phase **不动 Lingui 宏**，无需 extract；「N failed」才是真失败，尾部 3 retry errors 是噪音）、`adapter_inverse_signature`（本 phase 无 write 工具，不涉及，仅备查）。
</canonical_refs>

<specifics>
## Specific Ideas

- 常量（`compaction.ts`）：`COMPACT_HIGH_WATERMARK_TOKENS=120_000`、`COMPACT_LOW_WATERMARK_TOKENS=40_000`、`RECENT_TURNS_FLOOR=4`、`HISTORY_BACKSTOP_MAX_TOKENS=160_000`，全部带「初值/UAT 可调」注释。
- `estimateTokens(text)=Math.ceil(text.length/1.6)`。
- 触发：`> HIGH`（严格大于）；压后目标 `≤ LOW`。
- 摘要消息 role=`system`，content 带 marker `【对话历史摘要…】`。
- CTX-06 三宿主统一锚点句 = `旧读数早已过时`（守门可一行 `it.each` 覆盖三宿主）。
- 压缩成功立即 `saveHistory(docKey)`；自然结束照常 save。

## Verification（success criteria，必须 TRUE）
1. 历史预估 token `> 120K` → `runAgent` 自动触发一次 compaction：调 `resolveLLMConfig()` 的已配置模型把最老一段压成要点摘要（保留仍有效事实/决定/偏好、扔已推翻），压后历史回落到 `≤ 40K`；高/低差距 80K → 一次压缩撑多轮。
2. 摘要作为 `system` 角色固定消息出现在 wire `messages[1]`（system 之后、最近原文之前），`chatStore.messages` 条数**不变**；`[system][摘要]` 前缀稳定；摘要随历史 `saveHistory` 存入（version 2），`loadHistory` 后 `summary`/`summaryThroughId` 恢复（F5）。
3. `truncateTo20Turns` 重构为 `applyHistoryBackstop`（token 上界、按整轮丢、地板保护），正常范围 no-op（前缀稳定）；极端超顶才丢最老整轮；loop.ts + 旧 3 测同步。
4. `buildSystemPrompt('word'|'excel'|'ppt')` 三宿主返回值均含 `旧读数早已过时`（CTX-06 三宿主覆盖，且写成独立项 Phase-23 可保留）。
5. compaction 触发边界单测覆盖（token just-below / at / just-above HIGH；压后 ≤LOW；摘要位置正确；`chatStore.messages` 未被 mutate；持久化往返 + F5 恢复）；现有全套测试（901）green。

## Verification commands
- `npx tsc --noEmit`（类型干净）
- `npm test -- --run`（全套 green，含新 compaction 边界 + CTX-06 守门；「N failed」才是真失败，尾部 3 retry errors 是噪音——memory `i18n_extract_and_test_noise`）
- `npm run build && npm run size`（先 build 再 size；main gzip ≤82KB，预期与 80.53KB 持平——纯 TS/字符串，0 新依赖）
- 本 phase **不动 Lingui 宏**，无需 `npm run extract`。
</specifics>

<deferred>
## Deferred Ideas
- 压缩可见 UI / 聊天指示器 → 永久不做（D-21-08 静默）。
- 「压缩模型」Settings 字段 → 不做（D-21-02 复用已配置模型）。
- 真机 UAT（含「摘要质量是否够好」「水位初值是否合适」）→ 攒到 v2.3 里程碑末统一验（Team Lead 决定，本 phase 不单独 UAT）。
- **UAT-watch（DEFER #6 — 第 2 条 system 消息 Provider 兼容性，显式非-DeepSeek 门）**：D-21-04 锁定摘要消息 role=`system`（wire 里成为**第 2 条**且非首条 system 消息）。DeepSeek/OpenAI-compatible 已知支持多条 system 消息；但**每个实际出货的 Provider 都必须在 UAT 单独验证它接受「非首条 / 第 2 条 system 消息」不报 400/不丢弃**——这是 v2.3 里程碑末 UAT 的显式勾选项（非-DeepSeek Provider 尤其要看）。**文档化 fallback**：若某 Provider UAT 失败（拒收第 2 条 system），降级方案 = 把摘要并进**单条** system 消息（system prompt 末尾追加摘要段）——此方案**与 D-21-04「摘要独立成条」冲突** → 触发时由 **Team Lead 决策**（不在本 phase 自行改 role/结构）。
- **DEFER #5（当前 user 消息在 wire 里重复，已知小低效，本 phase 不修）**：`sendMessage` 在 `runAgent` 前已把当前 user 消息 push 进 chatStore，故 wire 的 `recentRaw` 已含它，而 loop.ts 又以 `{ user: prompt+buildTimeContext() }` 时间尾再 append 一次 → 当前 prompt 出现两次。这是**既有行为**（旧 `truncateTo20Turns` 路径同形），超出 CTX-03/04/05/06 范围，且**无害**（略微高估 token = 安全方向；重复体落在「每轮都变」的尾部，不伤 `[system][摘要]` 前缀稳定性）→ 标记为未来独立清理候选，**本 phase 不加 wire 去重**（避免范围蔓延 + 回归风险）。
- 真实 `include_usage` 事后校准 token 估算 → 未来增强（本 phase 用保守估算够用）。
</deferred>

---

*Phase: 21-ctx-compaction-antihallucination*
*Context gathered: 2026-06-03 via Team Lead pre-research + discuss-p21（autonomous milestone step）*
