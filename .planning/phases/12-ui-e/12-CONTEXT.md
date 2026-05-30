# Phase 12: UI 打磨 (E) - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning
**Mode:** `--auto`（Claude 替挑剔的用户拍默认值；所有 UI 设计选择逐条 flag「待复核」给用户回来纠偏）

<domain>
## Phase Boundary

消除既有 Task Pane 界面的体验摩擦——在**已冻结的 teal 克制设计系统内**做精修（非新视觉方向）。六项硬范围：

1. **UI-01（P0 安全）** react-markdown `urlTransform` XSS 防御（CVE-2025-24981 同类）
2. **UI-02** 消息发出后立即显示 AI「思考中」loading 气泡（不等首 token）
3. **UI-03** 「本次改动」DiffLogPanel 卡按 `agentRunId` 边界插入消息流（跟随当次 loop，不沉底）
4. **UI-04** Markdown 渲染优化——表格加边框 + 列表/代码块一致性
5. **UI-05** 读取工具卡轻量化降权（write 卡不降权）
6. **UI-06** 首屏纯 CSS shimmer 骨架屏（Office.onReady 前，不引新库）

**不在范围（新能力 → 各自的阶段）：** 任何新视觉方向、新组件库、聊天功能增强、Settings model 下拉（误匹配的 todo，见 Deferred）、动效系统重构。

</domain>

<decisions>
## Implementation Decisions

> 约定：所有标 **【待复核】** 的是 Claude 在 `--auto` 下替用户拍的 UI 设计选择，等用户回来纠偏。标 **【硬约束】** 的不可妥协（安全/铁律）。

### UI-01 — react-markdown urlTransform XSS 防御（P0，第一优先）

- **D-01【硬约束】优先级 P0、第一行改动、独立首个 plan。** 这是安全门，不软化，必须有测试守门。
- **D-02【硬约束】落点：** `src/components/ChatBubble.tsx` 的 `<ReactMarkdown>`（assistant 气泡，唯一渲染 LLM 文本处）加 `urlTransform` prop。`react-markdown@^9` 原生支持该 prop（取代旧 `transformLinkUri`）。
- **D-03【硬约束】策略：白名单放行 + 危险协议丢弃。** 放行 `http:`/`https:`/`mailto:`/相对路径/锚点（`#`）；拦截 `javascript:`/`data:`/`vbscript:`/`file:` 等。命中危险协议时 `urlTransform` 返回 `''`（空串）→ react-markdown 丢弃该 href，链接退化为无跳转纯文本（不破坏可读性）。
  - 实现倾向：复用 react-markdown 内置 `defaultUrlTransform` 思路（它本身已过滤大部分危险协议，但显式自写一层 allowlist 更稳、可测、可读）。**【待复核】**是否额外保留内置 transform 作为兜底（推荐：自写 allowlist 为准，行为可预测）。
- **D-04【硬约束】测试守门：** 新增/扩展 `ChatBubble` 单测，至少覆盖：
  - `[x](javascript:alert(1))` → 渲染后 DOM 无 `javascript:` href（断言 anchor href 为空或无 href）
  - `[x](data:text/html;base64,...)` → 同样被拦
  - `[ok](https://example.com)` → 正常保留 href（不误杀）
  - 图片 `![](javascript:...)` 同类防御（urlTransform 默认也作用于 img src）。
  - 测试必须随 plan 一起 RED→GREEN，不是事后补。

### UI-02 — AI「思考中」loading 气泡

- **D-05【需求措辞校正】** REQUIREMENTS 写 `agentStatus==='pending'`，但现 store（`src/agent/agentStore.ts`）的 `AgentStatus` 是 `'idle'|'running'|'paused'|'soft-landing'`，**无 `'pending'`**。语义映射：「消息发出后、首 token 前」= `agentStatus === 'running'`（`beginRun` 立即置 running）**且**当前 run 尚无任何 assistant token。**不新增 store 状态**（避免状态机改动外溢）。
- **D-06【待复核】触发条件（推荐）：** 在 `ChatStream` 渲染：当 `agentStatus==='running'`（或 `'paused'`）**且** 当前 `currentRunId` 对应的最后一条 assistant 消息 `content` 为空（无 token）时，在消息流底部渲染一个「思考中」loading 气泡；首 token 到达（assistant content 非空 / isStreaming）即自动消失（交回 ChatBubble 流式气泡）。
  - 现状：空 content 的 assistant 气泡被 `ChatBubble` 返回 `null`（line 79-81），首 token 前消息流无任何 AI 反馈——这正是 UI-02 要补的缺口。
- **D-07【待复核】视觉形态（推荐：三点跳动 typing indicator）：** 复用 `.bubble-ai` 外壳，内部放三个小圆点做 staggered 跳动动画（`@keyframes`，120-320ms 区间，错峰）。点用 `--text-3` 色（克制，不喧宾夺主）。
  - 备选（未选）：单点脉冲 / shimmer 条 / 「Aster 正在思考…」纯文字。选三点是聊天界面通用心智、纯 CSS、零新依赖、与 teal 克制气质相符。
  - **【硬约束】** `prefers-reduced-motion` 下降级为静态三点或静态文字（沿用全局动效降级约定）。
  - **【待复核】** 是否在气泡内补一行极淡文字（如「正在思考」）——推荐**不加**，纯三点更克制；留给用户定。
- **D-08【关系澄清】** loading 气泡与既有 `AgentControlBar`（运行态 quiet pill / 三态 thinking/reading/writing）并存：AgentControlBar 是顶部/底部全局进度条，loading 气泡是消息流内的「这条回复正在生成」占位。两者职责不同，不冲突。**【待复核】** 是否担心信息冗余（推荐：保留两者，气泡解决「消息流空窗」，pill 解决「全局可中断状态」）。

### UI-03 — DiffLogPanel 跟随当次 loop（按 agentRunId 插入）

- **D-09【硬约束】现状问题：** `ChatStream` 当前把 `completedRunIds.map(runId => <DiffLogPanel>)` 全部渲染在 `nodes` **之后**（消息流最底部），多次 loop 的改动卡全沉底、与对应回复脱节。
- **D-10【待复核】修复方案（推荐：边界插入）：** 在 `ChatStream` 构建 `nodes` 的循环里，检测每个 `agentRunId` 的「最后一条消息」边界（下一条消息 `agentRunId` 不同 / 到达末尾），若该 runId ∈ `completedRunIds` 且有写操作，则**紧跟其后**插入 `<Suspense><DiffLogPanel runId/></Suspense>`。移除底部的统一渲染块。
  - 保留 lazy + Suspense（NFR-05，DiffLogPanel 不进初始 chunk）。
  - DiffLogPanel 内部 `getWriteOpsByRun` 已自带「0 写操作返回 null」防守，无外部 length 检查。
  - **边界判定细节【待复核】：** 用「消息数组中该 runId 的最后一条 message 之后」作为插入点。无 `agentRunId` 的旧历史消息 / 纯聊天轮次不触发（completedRunIds 只含真实 agent run）。需保证一个 runId 只插一张卡（去重）。

### UI-04 — Markdown 渲染优化（表格 + 一致性）

- **D-11【待复核】表格样式（推荐）：** 新增 `src/styles.css` 规则，全部复用现有变量：
  - `.bubble-ai table { border-collapse: collapse; width: 100%; font-size: 13px; margin: 8px 0; }`
  - `.bubble-ai th, .bubble-ai td { border: 1px solid var(--border); padding: 6px 8px; text-align: left; }`
  - `.bubble-ai th { background: var(--surface-2); font-weight: 600; }`
  - **【待复核】** 边框粗细（1px）、表头底色（`--surface-2`）、cell padding（6×8）、斑马纹（推荐**不加**斑马纹，保持克制）——这几个数值留给用户定。
- **D-12【待复核】列表/代码块一致性：** 审计现有 `.bubble-ai ul/ol/pre/code` 规则（styles.css 已有 pre/code/ul/ol），统一：列表缩进与行距、`pre` 横向滚动（长代码不撑破 350px 宽 task pane）、`code` 内联 padding。复用 `--surface-2`（已用）/`--font-mono`。不引入 shiki（按需 lazy，本阶段不接）。
- **D-13【硬约束】禁硬编码：** 所有颜色走 CSS 变量，禁散落 hex；尺寸优先复用现有 spacing/radius token。

### UI-05 — 读取工具卡轻量化降权

- **D-14【关键发现】read/write 判定单一真相源：** `ToolDef`（`src/agent/tools/index.ts`）已有 `kind?: 'read'|'write'` 字段。**推荐**：导出一个 `toolName → kind`（或一个 read 工具名 Set）的映射供 UI 查；ChatStream/ToolResultCard 据 `message.toolName` 判定。
  - 备选信号（更脆，不推荐为主）：`toolResult.reverse` 存在 = write；`toolResult.data` 形如 `{content, source}` = read。
  - **【待复核】** 落地方式：(a) 在 loop-helpers push tool 消息时把 `kind` 一并写进 `Message`（最干净，类型显式）；(b) UI 侧从注册表查。推荐 (a)——避免 UI 反查重量级注册表（注册表静态引入会破坏懒加载预算）。
- **D-15【待复核】降权程度（推荐，需用户拍）：** 读卡 = **无边框**（去掉 `.aster-tool-card` 的 border）+ humanLabel 文字用 `--text-3`（更淡）+ 更小的内边距/字号，整体「次要信息」观感。**write 卡保持不变**（边框 + 正常字色 + 正常权重）。
  - 合并卡 `MergedToolGroup`：若组内**全是 read** → 整组走轻量；含 write → 保持正常（**【待复核】** 混合组的处理：推荐按「组内任一 write 即整组正常」最简单，避免逐行差异化视觉割裂）。
  - **【待复核】** 降权幅度要不要更狠（例如读卡默认不可展开 / 折成单行无 chevron）——推荐**保留 chevron 可展开**（用户仍可查证据），只降视觉权重不砍功能。
- **D-16【待复核】** 是否给读卡一个极淡的「读取」前缀图标（如书本/眼睛 SVG）区分——推荐**不加**额外图标，靠字色+无边框已足够区分，保持克制。留给用户定。

### UI-06 — 首屏 CSS shimmer 骨架屏

- **D-17【硬约束】不引库：** 纯 CSS shimmer，0 净新增运行时依赖（铁律 + bundle ≤82KB，当前 ~74.56KB 余量小）。骨架屏写在 `index.html` 内联（HTML + 内联 `<style>`），**不进 JS bundle**（对 bundle 体积零影响）。
- **D-18【关键约束/待复核】内联样式是「禁硬编码 hex」的唯一正当例外：** 骨架屏在 `Office.onReady` 之前、`main.tsx` 导入 `styles.css` 之前、`data-theme` 设值之前就要显示，**此时 CSS 变量与主题都还不可用**。因此骨架屏必须自带内联 CSS，用中性灰（贴近 `--surface`/`--surface-2` 的 light 值，如 `#f3f2ee`/`#ffffff` 系），在 light/dark 下都不刺眼。
  - **【待复核】** 是否用 `prefers-color-scheme` media query 让骨架屏也分 light/dark（推荐：加一个 `@media (prefers-color-scheme: dark)` 覆盖中性深灰，兜住 dark 宿主首屏；成本极低）。注意：宿主主题来自 `Office.context.officeTheme` 而非系统 `prefers-color-scheme`，二者**可能不一致**——骨架屏只活几百毫秒，用系统 preference 近似可接受，flag 给用户确认。
- **D-19【待复核】布局形态（推荐）：** 模拟 task pane 骨架——顶部一条 header 占位 + 下方 2-3 条消息行 shimmer 块（高度/圆角贴近真实气泡）。`@keyframes shimmer` 做横扫高光（`background: linear-gradient(...)` + `background-position` 动画；注意这是**单色明度渐变 shimmer**，不是被禁的「多色品牌渐变」，属骨架屏行业惯例，flag 确认）。
  - **【硬约束】** React `createRoot(#root).render()` 挂载时会覆盖 `#root` 内的骨架占位 → 自动消失，无需手动移除逻辑。骨架占位放在 `<div id="root">…骨架…</div>` 内。
  - **【硬约束】** `prefers-reduced-motion` 下 shimmer 动画停掉（静态灰块）。

### Claude's Discretion（实现细节，无需用户拍）
- 测试文件组织（新 test 文件 vs 扩展现有 `ChatStream.test.tsx`/新建 `ChatBubble.test.tsx`）
- CSS 规则在 styles.css 内的物理位置（就近归到对应组件段落）
- urlTransform 函数放 ChatBubble 内联还是抽到 `src/utils/`（推荐抽 util 便于单测）
- agentRunId 边界检测的具体算法实现（Map 分组 vs 单次遍历标记 last-index）

### Folded Todos
（无——唯一匹配的 todo 经判定为误匹配，见 Deferred）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents（researcher / ui-researcher / planner）MUST read these before planning or implementing.**

### 设计系统（UI 真相源，最高优先）
- `.claude/skills/aster-design-system/SKILL.md` — teal 克制系统总纲 + 真相分层（线上 styles.css > 设计稿）
- `.claude/skills/aster-design-system/references/chat-and-bubbles.md` — 气泡/markdown-lite/空态/滚动粘底（UI-02/04 主要消费）
- `.claude/skills/aster-design-system/references/writeback-and-tool-cards.md` — 写回卡/多动作合并卡/折叠范式（UI-03/05 主要消费）
- `.claude/skills/aster-design-system/references/design-tokens.md` — 色板/双主题机制/字体/圆角/间距/动效 + 设计稿↔线上偏差清单（全部 UI 决策的变量来源）
- `src/styles.css` — **像素级真相**（已落地、已 UAT；`--accent`/`--surface`/`--surface-2`/`--text`/`--text-3`/`--border`/`--bubble-ai-bg` 等变量定义在此）

### 现有组件范式（UI-02/03/05 都是改既有组件）
- `src/components/ChatBubble.tsx` — assistant ReactMarkdown 渲染处（UI-01 落点；UI-02 空气泡 return null 现状）
- `src/components/ChatStream.tsx` — 消息流分发 + completedRunIds 渲染 + ToolResultCard/MergedToolGroup（UI-02/03/05 主战场）
- `src/components/DiffLogPanel.tsx` — 「本次改动」卡（UI-03 插入对象，按 runId）
- `src/agent/agentStore.ts` — `AgentStatus`/`currentRunId`/`completedRunIds`（UI-02/03 状态来源）
- `src/agent/tools/index.ts` — `ToolDef.kind?: 'read'|'write'`（UI-05 判定真相源）
- `src/agent/loop-helpers.ts` — push `role:'tool'` 消息处（UI-05 若选「kind 写进 Message」在此改）
- `src/store/chat.ts` — `Message` 接口（`agentRunId`/`toolName`/`toolResult`/`isStreaming`）
- `index.html` — `<div id="root">` 挂载点（UI-06 骨架屏注入处）
- `src/main.tsx` — `Office.onReady` + `createRoot().render()`（UI-06 骨架被覆盖时机）

### 需求与路线
- `.planning/REQUIREMENTS.md` §UI-01..06（L63-68）— 需求原文
- `.planning/ROADMAP.md` §Phase 12（L130-141）— Goal + 5 条 Success Criteria

### 外部
- react-markdown v9 `urlTransform` API + CVE-2025-24981（XSS via crafted URI）— researcher 用 context7 拉 react-markdown 文档确认 `urlTransform` 签名与 `defaultUrlTransform` 行为（**UI-01 必须确证当前装的 react-markdown 版本支持此 prop**）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`.bubble-ai` 系列样式**（styles.css L721+）：UI-02 loading 气泡复用外壳；UI-04 表格规则挂在 `.bubble-ai table` 下。
- **`.tool-group` / `.aster-tool-card` / `.wb-action-head/body`**（styles.css L455+/833+）：UI-05 降权改这几个类（read 变体）。
- **`ChevronDownIcon`**（icons.tsx）：read 卡若保留可展开仍用它。
- **`completedRunIds` + lazy `DiffLogPanel`**：UI-03 已有数据源与懒加载，只改插入位置。
- **`ToolDef.kind`**：UI-05 read/write 判定的现成字段，无需新造分类逻辑。
- **`prefers-reduced-motion` 全局降级**（已有约定）：UI-02 三点动画 / UI-06 shimmer 直接套。

### Established Patterns
- 状态走 Zustand selector 订阅（`useAgentStore`/`useChatStore`）——UI-02/03 新增渲染逻辑用 selector，不引 prop drilling。
- 样式全走 `src/styles.css` + CSS 变量 `[data-theme]`；禁内联 style 传色、禁硬编码 hex（**UI-06 骨架屏是唯一正当例外**，因其早于 CSS/主题加载）。
- 重量级模块懒加载守 ≤82KB（DiffLogPanel 已 lazy；UI-05 若 UI 反查工具注册表会破坏此预算 → 倾向把 `kind` 写进 Message）。
- 折叠卡范式 `wb-action-head` + `wb-action-body`，soft-landing/CIRCUIT_OPEN 为 full-width 特殊卡打断合并组。

### Integration Points
- **UI-01**：ChatBubble `<ReactMarkdown>` 加 prop（+ util + test）。
- **UI-02**：ChatStream 消息流尾部条件渲染 loading 气泡（读 agentStore + 当前 run 最后 assistant 消息）。
- **UI-03**：ChatStream `nodes` 构建循环内按 agentRunId 边界插入 DiffLogPanel（移除底部块）。
- **UI-04**：纯 styles.css 新增/调整 `.bubble-ai table/th/td` 等规则。
- **UI-05**：styles.css read 变体 + （推荐）loop-helpers push 时带 `kind` + ChatStream/ToolResultCard 据 kind 加 class。
- **UI-06**：index.html 内 `#root` 注入骨架 HTML + 内联 `<style>`。

</code_context>

<specifics>
## Specific Ideas

- 用户对 UI 极挑剔——这些都是**冻结 teal 系统内的精修**，不是新视觉方向。任何带数值/观感的选择（表格边框、loading 形态、骨架布局、读卡降权幅度）都已逐条标 **【待复核】**，等用户回来纠偏。
- UI-01 是 P0 安全门：独立首个 plan + 测试守门，不与其它需求混在一个 plan 里软化。
- bundle ≤82KB 当前余量小（~74.56KB）：本阶段净新增运行时依赖 = 0。UI-06 骨架屏在 HTML/内联 CSS，不进 JS bundle。

</specifics>

<deferred>
## Deferred Ideas

- 无新增 scope creep——讨论严守 6 项需求边界。

### Reviewed Todos (not folded)
- **`builtin-model-dropdown.md`（DeepSeek + AiHubMix 内置 model 下拉）** — `todo.match-phase` 以 0.4 分匹配，但**仅因关键词「phase」误中**。它是 Settings 的 model 选择新能力（替代手动输入 model 字符串），与 Phase 12「界面体验摩擦精修」无关，属新功能、应在自己的阶段。**不折叠**，标记已审阅。

</deferred>

---

*Phase: 12-ui-e*
*Context gathered: 2026-05-31*
