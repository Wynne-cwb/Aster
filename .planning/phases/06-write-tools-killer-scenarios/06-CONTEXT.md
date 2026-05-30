# Phase 6: 多宿主 Write Tools + Killer Scenarios 重写 - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 undo 兜底（OperationLog + DiffLogPanel + 三宿主 inverse PoC）就位后，放心铺开 destructive write tool。本 phase 交付：

1. **全套 write tools 铺开**（TOOL-03 剩余）——三宿主从「每宿主 1 个 PoC」扩到全集，含差异化护城河 `set_shape_property` / `move_shape`
2. **三宿主 System Prompt 重写**——共享基座 + 三宿主专属领域模块（去技术化 + batch 倾向 + self-verify）
3. **4 个 killer scenario 按 multi-step agent 流重写**——PPT 主题→deck / Excel 清洗+图+洞察 / Word 整篇润色 / PPT shape 精细化护城河
4. **入口 UX**——空态 killer-scenario chips（替代 v1 Ribbon 6 按钮设计）+ Ribbon 精简到 1 个「打开 Aster」按钮
5. **Onboarding 轻量化**——收成单步（只留填 API Key），删 Step2Guide 功能介绍卡整步

**本 phase 不交付（Out of scope）：**

- ❌ `insert_image_on_slide`（PPT 生图 / v1 F4 多模态聚合）—— 推 v2.1（4 个 killer 无一依赖；aihubmix model 配置另有问题待修）
- ❌ `reorder_paragraphs` / `delete_paragraph` 多步（Word 危险写）—— v2.1
- ❌ ONB-01 心智锚定动画 / GIF —— 用户本次主动移除（见 D-23）
- ❌ Edge×Chrome×全新 profile 全矩阵 UAT —— Phase 7（本 phase 只做三宿主 smoke checkpoint）
- ❌ Resume from checkpoint / Multi-agent / Cross-session memory —— FUT-03/05/06
- ❌ Whole-deck redesign / theme apply —— v1 Out of Scope 继承
- ❌ 图库检索 tool（Unsplash / Pexels）—— FUT-08 / 原 Q1 推迟 v2.1
- ❌ 真正的可加载 Skill 系统（markdown 注入机制）—— 偏新能力，本 phase 只把 Skills 当「写 prompt 的参考素材」（见 D-09）

</domain>

<decisions>
## Implementation Decisions

### Write tool P1 范围（TOOL-03 铺开 + 裁剪）

- **D-01:** **PPT 护城河 shape 写工具做全套** —— `set_shape_property` 覆盖 fill 填充色 / line 边框色+粗细 / 尺寸，外加 `move_shape` 管 left/top。ROADMAP SC4「红边框 + 右移 10px」恰好需 line + move。这是 Copilot Agent Mode 不暴露的差异化「magic moment」，不能降级（边框颜色是最直观的炫点）。inverse 走「写前抓 before-image（旧 left/top/fill/line）→ 反写」，沿用 Phase 5 Excel `set_range_values` before-image 范式（D-05/D-06）。
- **D-02:** **PPT `insert_image_on_slide`（生图 / F4 多模态）不进 P1，推 v2.1**。4 个 killer scenario 无一依赖生图；aihubmix 的多模态/生图 model 配置 todos.md 已标「都是错的」，先不蹚。
- **D-03:** **Excel 写工具全做** —— `set_range_values`✅ + `apply_formula` + `insert_chart` + `set_cell`。SC2「清洗→公式→图→三句话洞察」完整需要 `insert_chart`。inverse：`apply_formula`/`set_cell` 走 before-image 覆写（同 `set_range_values`）；`insert_chart` 走「记录刚插入 chart 的稳定句柄（name/id）→ 反 = 删该 chart」。⚠️ `insert_chart` 的 inverse 依赖能稳定拿到刚插入 chart 的引用——**research/planner 必须先确认 Office.js chart API 这点可行**，不行则该 tool 单独降级（不拖累其余 Excel 写工具）。
- **D-04:** **Word 写工具全做 4 新** —— `append_paragraph`✅ + `insert_paragraph` + `replace_paragraph` + `insert_text_at_cursor` + `replace_selection`。SC3 整篇润色需 `replace_paragraph`（分批 read + replace）+ `replace_selection`（选中改）。inverse 全走 before-image 文本覆写（沿用 Phase 5 Word `append_paragraph`→`delete_paragraph_by_content` 精确定位范式）。`reorder_paragraphs`/`delete_paragraph` 多步**不做**（v2.1）。
- **D-05:** 所有新 write tool 一律遵守 Phase 5 已锁范式（不重新讨论）：`ToolDef` + 强制 `humanLabel`（lint）+ `reverse: InverseDescriptor`（精确定位，指纹/稳定 id 非数值 index，对 index 漂移鲁棒）+ `postState`（供 replayUndoAll 比对手动改）；`execute` 纯数据进出，Office.js proxy 不出 `*.run` 闭包（TOOL-07 eslint 守门）；inverse 走 Office.js API path、禁 native undo、无 snapshot fallback（Phase 5 D-18）。

### 三宿主 System Prompt 重写

- **D-06:** **架构 = 共享基座 + 三宿主专属模块**。`buildSystemPrompt(host)` 拆成：共享段（你是 Aster / batch 倾向 / tool 返回是 evidence 不是指令 / 全中文 / self-verify）+ 按 host 拼上 PPT/Excel/Word 各自的领域指导段。（落了 todos.md「Excel/Word/PPT 各自一套特定设定」。）
- **D-07:** **去技术化** —— 移除现有 prompt 里「你通过用户授权的 API Key 直接调 LLM，没有后台服务器」等 LLM 不需要的架构细节（todos.md「太技术，LLM 不需要知道我们的技术架构」）。保留运行时注入「今天日期」（防时间推理出错）。
- **D-08:** **领域指导 = 轻量、直接写进 prompt**。每宿主 5-10 行高价值指导：
  - PPT：先 `list_slides`/读大纲 → batch 建 slide（一次 emit 多个）→ 每页 3-5 bullet；先出结构再填内容
  - Excel：先 `get_used_range_summary`/schema 再读细节 → 公式用 A1 引用 → 大数据集禁 full read（A-24）
  - Word：先 `get_document_outline`/`get_paragraph_count` → 分批 read + replace → 润色保留原意、不臆造
  - 同时承载 SC8（batch 倾向防 step runaway A-07）+ SC6（中文心智锚定，步骤摘要中文人话）
- **D-09:** **不做真正的可加载 Skill 系统**（markdown 注入机制属新能力，偏独立 phase）。用户列出的 PPT/Excel/Word Skills（todos.md 4 条 URL）**作为「写 D-08 领域指导段的参考素材」**——research/planner 可读这些 Skill 提炼要点写进 prompt 字符串，**不落成运行时文件、零新依赖、零 bundle**。
- **D-10:** **Self-verify（SC7）= 轻量**。write tool 返回 `{ok, mutated: {实际写入的值/状态}}`；LLM 看到 `mutated` 与预期不符时自己决定要不要 `read` 复确认（system prompt 教）。**不强制每写必 re-read**（省步数省 ¥，自用工具偏轻）。
- **D-11:** **并发改防御（A-25）= 可选 `expected_state`**，只给高风险写（`replace_paragraph` / `set_range_values` / `set_shape_property`）开放可选传参；verify mismatch 返 error 让 LLM 重评估。不给所有写强制。

### Killer scenario 收尾深度

- **D-12:** **收尾 = 三宿主真机 smoke UAT checkpoint**（同 Phase 3/4/5 范式）。每宿主跑一遍对应 killer scenario + 验新 write tool 写入正确 + 验 Phase 5 的 undo/diff log 在新 destructive 写下仍生效。**不跑** Edge×Chrome×全新 profile 全矩阵——那是 Phase 7 的正式端到端 UAT。理由：destructive 写必须真机验证早抓 bug（Phase 5 此法抓出 6 个 gap）。
- **D-13:** **删除 ROADMAP SC1-3 的 ¥ 判据**（¥<3 / ¥<1.5 / ¥<2）。cost 跟踪 Phase 3 已整批砍（无 CostBadge），¥ 不可测、人工估也不准。step runaway 的防线仍是 **max_steps=20 软着陆**（结构性）；ROADMAP 写的步数区间（PPT 8-15 / Excel 10-18 / Word 6-12 / shape 3-6）**仅作描述性预期**，不设每场景硬步数门禁。
- **D-14:** **4 个 ROADMAP demo prompt 锁为验收基准**（「帮我做一份 Q3 销售复盘 PPT」等），每场景「必过」；planner/UAT 可额外加边界变体（更长文档 / 更多 slide）试鲁棒性。

### 入口 UX（SC5 / ONB-03）

- **D-15:** **空态 chips = 按宿主 3-4 个 host-specific chip**。ChatStream 已知当前 host（adapter），PPT host 显 PPT 场景 chip / Excel 显 Excel chip …（不跨宿主乱显）。复用现有 `.btn` / teal token + 现有空态 D-03 钩子（ChatStream.tsx 已留「等 Phase 6」位）。
- **D-16:** **chip 点击 = 填充输入框**（用户可改再发），**不直接自动 send agent run**。destructive agent 用「填充」比「直发」更稳，也贴 SC5「seed prompt」语义。
- **D-17:** **Ribbon 精简到 1 个「打开 Aster」按钮**（不是 6 个全降级、也不是按钮各带 seed）。manifest.xml 三宿主条目同步瘦身到单按钮 ShowTaskpane；seed 引导全交给空态 chips（D-15）。**需重验三宿主 sideload**（manifest 改动）。不走 ExecuteFunction 跨上下文传 seed（与「无后台 / 简单」气质冲突）。

### Onboarding 轻量化（ONB-01 移除 / ONB-02 / ONB-03）

- **D-18:** **Onboarding 收成单步**——只留 Step1 填 API Key（+ 一句话「Aster 是嵌在 Office 里的 AI 代理」）。**删 Step2Guide 功能介绍卡整步**。用户定调「Onboarding 只需引导填写 API Key，尽量轻量」——自用工具，用户即作者，不需要被 onboard；用法引导全靠空态 chips（D-15）+ agent 自身 diff log/步骤卡够清楚。
- **D-19:** **ONB-01（心智锚定动画/GIF）移除**——本 phase 不做任何 onboarding 动画。教育担子转移给空态 chips + diff log。⚠️ ONB-01 是 REQUIREMENTS 里的需求，本决策使其降级；记为 requirement 变更（见 deferred），phase transition 时反映到 REQUIREMENTS/PROJECT，不留孤儿。
- **D-20:** **ONB-02（step 摘要中文化）已由现有 `humanLabel` 体系满足**（Phase 3/4/5 每个 tool 强制中文 humanLabel）——本 phase 新增 write tool 同样强制中文 humanLabel 即自动满足，无需额外工作。
- **D-21:** **删 Step2 后重新验证 Step1→主界面跳转**——todos.md「Onboarding 设置时跳转有 BUG」在新单步流程里一并消解/验证（单步流程跳转路径更简单，原 bug 大概率随结构简化消失，但 checkpoint 要确认 Step1 完成后正常进主界面）。

### Claude's Discretion

- 各 write tool 的具体 args schema、adapter inverse 方法命名、before-image 抓取的具体 load 字段（沿用 Phase 5 范式 + SP-4 API path）
- `set_shape_property` 单 tool 多属性 vs 拆多 tool 的粒度（research 据 Office.js shape API 决定）
- PPT「左下角那张图」的识别——靠 LLM 对 `list_shapes_on_slide` 返回的 `{left, top, width, height}` 几何推理，**不造专门的空间推断 tool**（geometry 已可读，PptAdapter 现成）
- 三宿主领域指导段（D-08）的具体文案 + 从用户列的 Skills 提炼哪些要点
- 空态 chips 的具体 prompt 文案（每宿主 3-4 条）+ 视觉细节（走 `aster-design-system` skill）
- Onboarding 单步后 OnboardingModal 的结构收敛方式
- killer scenario plan 切波结构（write tools 按宿主可并行；system prompt + chips + onboarding 各自独立）

### Folded Todos

- **`todos.md`（根目录随手记）「系统 Prompt 调整」** —— 折入区域 2（D-06/D-07/D-08/D-09）：去技术化 + 三宿主各自专属设定 + 调研 PPT/Excel/Word Skills 作 prompt 参考素材。
- **`todos.md`「Onboarding 设置时跳转有 BUG」** —— 折入 D-21（删 Step2 单步化时一并验证）。
- **`todos.md`「支持 Skills」（4 条 PPT/Excel/Word skill URL）** —— 折入 D-09 作为写领域指导段的参考素材（不落运行时 Skill 系统）。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents（researcher / planner / executor）MUST 读这些，决策依据全在里面。**

### 项目级（必读）
- `.planning/ROADMAP.md` — Phase 6 段（goal / 8 条 SC / 5 条 Risk）。**注意：本 CONTEXT D-13 已删 SC1-3 的 ¥ 判据；D-19 已移除 ONB-01 动画**
- `.planning/REQUIREMENTS.md` — 本 phase 范围 = TOOL-03（剩余全套写工具铺开）+ ONB-01（本 phase 降级移除，见 D-19）/ ONB-02（humanLabel 已满足）/ ONB-03（chips + ribbon 降级）；TOOL-03 完整清单在 §50
- `.planning/PROJECT.md` — Core Value（agent 能完成绝大部分文档工作 = 杀手场景的意义）/ Q7 单文档内多步边界 / Q9 失控控制（max_steps=20 唯一防御）/ Q11 错误自决 / 5 条硬约束（无后台 / bundle ≤1MB / 性能 / Key 安全）

### 研究产出（必读）
- `.planning/research/PITFALLS.md` — **A-07 step runaway（HIGH，→ D-08 batch 倾向）/ A-22 PPT setSelectedDataAsync 与 *.run 互斥（→ 全走 *.run）/ A-23 tool 成功但产出错（→ D-10 mutated + self-verify）/ A-24 Excel 大数据 OOM（→ D-08 Excel summary 先行）/ A-25 并发改文档（→ D-11 expected_state）**
- `.planning/research/ARCHITECTURE.md` — AP-1（agent loop 不塞 chatStore）/ AP-2（空 system prompt + read tool 按需，本 phase D-06 在此基础上加领域段）/ AP-3（禁 native undo）+ inverse op 模型 + Message schema
- `.planning/research/FEATURES.md` — killer scenario UX patterns + empty-state / chip 范式 + anti-features

### Spike 真机验证（CRITICAL — inverse 可行性结论）
- `.planning/spikes/SP-4-reverse-ops/findings.md` — ✅ Word `paragraph.delete()` / Excel before-image 覆写 / PPT slides 读取的 reverse API path 全可达（新 write tool inverse 直接复用）
- `.planning/spikes/SP-5-ppt-slide-delete/findings.md` — ✅ PPT `slide.delete()` Web 真删；shape 写工具 inverse 同样走 PowerPoint.run API path

### 上游 phase 已交付（直接消费）
- `.planning/phases/05-diff-log-undo-all-3/05-CONTEXT.md` — **write tool 范式权威源**：D-05/D-06 reverse 精确定位（指纹/id 非 index）/ D-15 humanLabel+reverse lint 强制 / D-17 inverse PoC（三宿主各 1 个，本 phase 铺开剩余）/ D-18 Office.js API path 禁 native undo / TOOL-04 postState
- `.planning/phases/04-read-tools-agentcontrolbar/04-CONTEXT.md` — read tools 全套（before-image / self-verify re-read 来源）/ AgentControlBar 三态 / circuit breaker 完整 / system prompt 防注入区分（D-06 共享段继承）
- `.planning/phases/03-agent-loop-privacy-word-demo/03-CONTEXT.md` — agent loop / 错误协议四字段 schema / system prompt batch 暗示初版（D-06/D-07 在此重写）

### 关键源文件（plan 的 read_first 候选）
- `src/agent/tools/index.ts` — `ToolDef`/`ToolResult`（reverse/postState 字段已在）+ `dispatchTool` sanitize 边界 + 15s 超时 + `buildToolsForHost`（本 phase 注册全套新 write tool）+ `assertWriteToolRegisterable`（humanLabel 守门）
- `src/agent/tools/write/{word,ppt,excel}.ts` — Phase 5 PoC（append_paragraph / insert_slide / set_range_values），本 phase 在此扩全套 write tool（注释已写「Phase 6 升级」）
- `src/agent/tools/read/{word,ppt,excel}.ts` + `common.ts` — read tool（before-image / self-verify 来源）；`list_shapes_on_slide` 已返 `{id,type,left,top,width,height}`（SC4 几何推理前提）
- `src/agent/system-prompt.ts` — Phase 3 demo 版（含技术细节 + batch 暗示），本 phase 按 D-06/D-07/D-08 重写为 `buildSystemPrompt(host)` 共享+专属
- `src/adapters/{Word,Ppt,Excel}Adapter.ts` — 三宿主 read 全套 + Phase 5 inverse 写方法；本 phase 加新 write/inverse 方法（各自 *.run 闭包内开闭，A-06）
- `src/components/ChatStream.tsx` — 空态已留「D-03 不渲染 chips，等 Phase 6」钩子（本 phase D-15/D-16 在此加 host-specific chips）
- `src/components/Onboarding/{OnboardingModal,Step1Keys,Step2Guide}.tsx` — 本 phase D-18 收成单步、删 Step2Guide
- `src/commands.ts` + `manifest.xml` — ribbon 入口（本 phase D-17 精简到 1 按钮，manifest 三宿主同步）
- `todos.md`（仓库根，未跟踪）— 「系统 Prompt 调整」+「支持 Skills」（4 条 URL）+「Onboarding 跳转 bug」= D-06..D-09 / D-21 来源

### UI
- `CLAUDE.md` §UI 设计系统（teal 克制）/ §发布授权（可直接 push + Pages 部署）
- `aster-design-system` skill（chips / 单步 onboarding / 走现有 token，不另造观感）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/agent/tools/index.ts` — `ToolDef.humanLabel`（类型强制）+ `ToolResult.reverse?/postState?` + `buildToolsForHost`（per-host 注册）+ `assertWriteToolRegisterable`（write tool 缺 humanLabel 即抛）+ `dispatchTool` sanitize/15s 超时全稳。新 write tool 只需按现成范式加进对应 host 数组。
- `src/agent/tools/write/{word,ppt,excel}.ts` — 3 个 PoC write tool 是完整模板（humanLabel + reverse 精确定位 + postState + A-06 adapter 委托）。新工具照抄结构。
- `src/agent/tools/read/ppt.ts` `list_shapes_on_slide` — 已返 `{id,type,left,top,width,height}`，SC4「左下角图」靠 LLM 几何推理，**无需新 tool**。
- `src/adapters/*Adapter.ts` — Phase 4 read 全套 + Phase 5 inverse 写方法（before-image 抓取范式）= 新 write/inverse 方法的直接模板。
- `src/components/ChatStream.tsx` — 空态壳 + D-03 chips 钩子已留；`.btn`/teal token 现成（chips 复用）。
- `src/agent/system-prompt.ts` — `buildSystemPrompt(host)` 已是 host 入参签名，重写为「共享+专属」改动局部。

### Established Patterns
- Adapter「纯数据进/纯数据出」，proxy 不出 *.run（A-06 + TOOL-07 eslint 守门）—— 新 write/inverse 方法同样各自开闭一次 *.run
- write tool TS/lint 强制 humanLabel + reverse（Phase 5 D-15 已 flip enforce）—— 新工具缺则编译/lint 失败
- 每个 plan 一 commit + 三宿主真机 UAT checkpoint 收尾（D-12 继承 Phase 3/4/5 气质）
- UI 全走 styles.css CSS 变量 + Lingui macro（zh-CN）；teal 克制
- LLM 原生 fetch、0 净新增运行时依赖（NFR-02）；领域指导写进 prompt 字符串 = 零 bundle

### Integration Points
- 新 write tool → `buildToolsForHost(host)` 注册 → loop.ts 每步 `{result, reverse}` 写入 OperationLog（Phase 5 现成）→ DiffLogPanel 汇总（现成）
- 新 inverse 写方法 → OperationLog replayUndoAll 消费（Phase 5 现成，新 reverse descriptor 即插即用）
- `buildSystemPrompt(host)` 重写 → loop.ts/agentStore runAgent 调用点不变（仍按 host 取 prompt）
- 空态 chips → 填充 InputBar（D-16，不直发）→ 现有 sendMessage/runAgent 路径
- Ribbon 1 按钮 → manifest.xml ShowTaskpane（现状路径，瘦身条目）

### ⚠️ bundle 预算（紧）
- CI 守 initial main-*.js ≤ 82KB gzip；Phase 5 实测 80.26KB，headroom 很小。新 write tool（每个 ~60 行）+ 空态 chips 进主 chunk 要盯 size；领域 prompt 是字符串（零 bundle）；DiffLogPanel 已懒加载。动 bundle 前先 `npm run build` 再 `npm run size`（陈旧 dist 给假绿，见 [[project-bundle-size-guard]]）。

</code_context>

<specifics>
## Specific Ideas

- **SC4 PPT shape 护城河 = 用户首见 Aster 的「magic moment」**（边框改色 + 移位是 v1 单步模型完全做不到、Copilot Agent Mode 也不暴露的能力）。用户选了全套（颜色+边框+位置/尺寸），说明这是要打的差异化点，planner 别降级成「只移位不改色」。
- **用户持续「自用工具、砍非必要」气质再现**：本次主动砍 ONB-01 动画 + 把 Onboarding 收成单步只填 Key + 删 ¥ 判据。planner 在任何「教育/健壮性/边角 UX」前先想：这是给用户*用得顺* 的核心，还是给企业/陌生用户看的？后者别做。详见 [[project-aster-privacy-simplified]] / [[project-aster-cost-removed]]。
- **System prompt 是 killer scenario 的「大脑」**：用户主动要三宿主各自专属设定 + 调研 Skills 丰富能力（todos.md）。但用户也同意「轻量写进 prompt、不做 Skill 系统」——即要*效果*不要*架构*。提炼 Skill 要点写成 5-10 行高密度指导，比堆机制更对路。
- **insert_chart 是 Excel SC2 唯一的「能不能稳」风险点**：research 必须先验 Office.js chart API 能否稳定拿到刚插入 chart 的句柄做 inverse 删除；不行则单独降级该 tool，不拖累 set_range_values/apply_formula/set_cell。
- **teal 克制延续**：chips / 单步 onboarding 走现有 token，不另造观感。详见 [[feedback-beauty-over-fluent]] / [[project-aster-ui-redesign]]。
- **bundle 预算紧**（CI ≤82KB gzip，Phase 5 已 80.26KB）：新工具 + chips 盯 size，能懒加载的懒加载。详见 [[project-bundle-size-guard]]。
- **inverse 签名必须收 Record 对象**：[[project-adapter-inverse-signature]]——replay 用 `adapter.method(args 对象)` 调用，新 inverse/read 方法必须收 Record 对象（非位置参，Phase 5 Word 位置签名致真机撤销全挂）；新 inverse 补 `operationLog.integration.test` 守门。

</specifics>

<deferred>
## Deferred Ideas

### 本 phase 移除 / 降级（记账，phase transition 反映到 REQUIREMENTS/PROJECT）
- **ONB-01 心智锚定动画 / GIF** — 用户本次主动移除（D-19）。教育担子转给空态 chips + diff log。是 requirement 降级，未来扩用户范围 / OSS 公开后再评估是否补。
- **ROADMAP SC1-3 的 ¥ 预算判据** — 删除（D-13），cost 已不可测；不重新量化成本指标。

### 推后到 v2.1
- **`insert_image_on_slide`（PPT 生图 / v1 F4 多模态聚合）** — D-02 推 v2.1（含先修 aihubmix 多模态/生图 model 配置）
- **`reorder_paragraphs` / `delete_paragraph` 多步（Word 危险写）** — v2.1
- **shape 旋转 / 更多 shape 属性** — 视 D-01 `set_shape_property` 实现裕度，超出 fill/line/尺寸/位置 的属性推后
- **真正的可加载 Skill 系统（markdown 注入机制）** — D-09 本 phase 只把 Skills 当 prompt 参考素材；可加载机制属新能力，未来独立 phase

### Reviewed Todos（not folded — 出本 phase 范围）
- **`builtin-model-dropdown.md`**（形式化 todo，弱匹配）— CARRY-02，**已 Phase 4 交付**（model select 下拉），不并入（Phase 5 已同样判定）。
- **`todos.md` 其余 UI 项** — 出 Phase 6 范围，未折入：「工具卡太打扰/UI 更轻」「骨架屏」「发出后 AI loading 气泡」「Markdown 表格无边框」「AIHubMix 多模态/生图 model 错误」（与 D-02 推 v2.1 的生图相关，届时一起修）「聊天记录 localStorage 分文档持久化」（原 PROJECT Q2，v1.1 评估）「Word 选区只看到字符数不知内容」（read tool 增强，Phase 4 领域，可单独 quick task）。这些是 UI 打磨 / 独立功能，不混入本 phase write tools + scenarios 主线。

</deferred>

---

*Phase: 06-write-tools-killer-scenarios*
*Context gathered: 2026-05-30 via /gsd-discuss-phase 6*
