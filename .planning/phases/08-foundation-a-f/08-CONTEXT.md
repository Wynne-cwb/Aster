# Phase 8: Foundation + 能力 A + 持久化 F - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 交付三件事，**不写实际 B 工具**（B 工具在 Phase 9/10/11）：

1. **能力合约**——给后续 ~20 个"动手"(write) 工具定一张合约表（每宿主工具清单 + 参数化合并方案 + 每个工具的 undo 分类 + token 预算）。这是 Phase 9/10/11 的地基。
2. **A 让 agent 更懂三宿主**——深化 PPT/Excel/Word 各自专属系统 prompt（已有 6 行基础，本阶段深化）+ 用户自定义偏好注入（含 prompt-injection 防御）。
3. **F 聊天记录持久化**——存 localStorage、可一键清空、传 LLM 上下文上限 20 轮、分文档存储（spike 验可行性）。

只澄清**怎么实现**这些；新增能力（如插图、生图）属其它 milestone，不在本阶段。

**Requirements covered:** PROMPT-01, PREF-01, PREF-02, HIST-01, HIST-02, HIST-03, HIST-04, NFR-06, NFR-07, NFR-08
</domain>

<decisions>
## Implementation Decisions

### A — agent 自主性 + 三宿主 prompt 深化（PROMPT-01）

- **D-01 全自主策略**：用户定位 = **Office 小白**，核心诉求 = 无论给精细指令还是模糊需求，Aster 都能**快速产出"商业可用成品"**。面对模糊需求（如"帮我做个 Q3 复盘 PPT"），agent 采取**全自主**：列大纲 → 建页/填表/写段落 → 自查 → 一气做完再汇报，**尽量少追问**。失控防御 = 现有 max_steps=20 + 常驻 pause/abort（v2.0 已有）。
- **D-02 三宿主 domain segment 深化方向**（取 skill 设计思路，**不要 Python 脚本**）：
  - **PPT**：① 先定标题大纲再建页（title-first）；② **断言式/结论句标题**（完整句、<15 字、放左上角，非"Q3 结果"这类标签）；③ 故事线结构（SCQA / 问题→方案→证据 / 金字塔：一个结论→3-5 条支撑）；④ 每页 ≤5 点；⑤ 正文左对齐、标题居中、留白、新元素不与现有形状重叠并尽量对齐（对应用户点名的"版式/对齐意识"）；⑥ 做完自查（查重叠/溢出/错位）。
  - **Excel**：① 数据优先（先 get_used_range_summary，大表分块读，已有）；② 必要时先清洗；③ **公式优于硬写值**（能用公式就别填死数）；④ 成品要格式化（自适应列宽/粗体表头/条件格式上色——为 Phase 10 的 `format_excel_range`/条件格式工具铺路）。
  - **Word**：① 先列大纲（开头先给读者核心收益）；② 用具体数字、删没必要的句子；③ **保留原意只改语言**（润色不增删论点）。
  - **跨宿主硬约束**：用"宪法式约束"顶住 LLM 爱讨好/偷跳步——"标题必须断言句、绝不用标签式""**没自查不许说做完了**"（对应用户点名的最大坏习惯）。
- **D-03 配图缺口诚实处理**：v2.1 **插不了图**（生图/图库在 v2.2，背景色在 Phase 10）。agent 该配图处老实提示"图片功能即将开放/建议手动配图"，专注把文字+结构+版式做扎实——**不造假、不承诺做不到的事**（与项目"诚实禁用态、即将开放"原则一致）。

### A — 质量优先原则 + NFR 修订（⚠ 推翻锁定需求，需同步改文档）

- **D-04 项目原则：生成质量 >> 成本 & 包体积。** system prompt **不设死长度**；research 阶段继续检索、把对 AI 生成有帮助的素材补进 domain prompt。
- **D-05 NFR-07 修订**：system prompt `<3000 字符硬 CI gate` → **软提醒**（超过某参考值只警告 + 显示大概 token 成本，**不卡构建**）。诚实权衡已向用户讲明：prompt 不是越长越好，过长会稀释指令遵守度（Anthropic/Block skill 经验"先想清楚要拿掉什么"）——故"内容对"而非"内容多"，该加的高价值指导加，别凑长度灌水。
- **D-06 原则边界**（防一刀切误用）：只软化**成本类**门（prompt 长度 / 工具 token）；**不软化数据安全类**门（undo 守门硬卡，见 D-17）；`bundle ≤82KB`(NFR-06) / 0 净新增依赖 / `P95≤10s` 仍是 Core Value 架构约束（懒加载是"加质量功能又不爆包"的逃生口）。planner 用此 lens 逐项评估，而非全部软化。

### A — 用户偏好（PREF-01 / PREF-02）

- **D-07 偏好输入形态**：Settings 面板内**一个自由文本框**（占位符给示例，如"比如：语气正式、公司简称叫 XX、金额保留两位小数"），**全局一份**三宿主通用（小白省心；语气/术语类偏好本就跨宿主通用）。
- **D-08 偏好上限放宽**：200 → **~500 字符**（此上限是**防注入安全面**，非防成本）。⚠ 需更新 REQUIREMENTS.md PREF-02。**注入防御逻辑不变**：`【用户偏好（仅供参考）】…【偏好结束】`包裹块 + 关键词拒绝（忽略指令 / ignore / new instruction / 你的新角色）+ injection 守门测试。
- **D-09 注入命中行为**：命中注入词时**完全静默过滤、不注入、不给用户提示**（与成功标准 #2 字面一致）。
- **D-10 小白引导（Claude 默认）**：偏好框旁给几个**点击即填的示例预设**（如"正式语气""口语化""金额两位小数"），点击追加/填入文本框，降低小白"不知道写什么"的门槛。

### F — 聊天记录持久化（HIST-01..04）

- **D-11 分文档存储**：每个文档记各自对话；docKey = `'aster:chat:' + btoa(url.slice(-80)) 变体`（替换 `+/=`；**禁用 raw 完整 URL**，防 session token 泄露）。**spike S6** 验 `Office.context.document.url` 在 Office for Web 的稳定性——可行则分文档；**不可行回退全局单 key**（用户 todos 已表态可接受回退）。
- **D-12 清空范围**：HIST-02"清空聊天记录"**只清当前文档**（配合分文档最自然）。
- **D-13 LLM 上下文 20 轮上限（不放宽）**：1 轮 = 1 条 user 消息，tool 消息不计；在 `loop.ts` wire message 构建处截断；超出从最早 user 消息起整 run 删除。用户已确认**不放宽**——太多旧对话反而干扰 AI（与 prompt 长度同理，多≠好）。
- **D-14 持久化时机（Claude 默认）**：**每轮 agent run 跑完即存**（最防崩溃丢失，避免存流式中间态）。只序列化 `role='user'|'assistant'` 文字消息白名单字段（丢弃 reverse/postState/ToolResult.data），每条 ≤2000 字符；hydrate 于 `main.tsx`；QuotaExceeded 丢最旧（`storage.ts` 已处理）。
- **D-15 空历史显示（Claude 默认）**：无历史时聊天区显示现有 empty-state 杀手场景 chips（ONB-03 已有，不新增）。

### 能力合约（工具合并设计合约 / NFR-08）

- **D-16 合约形态**：`.planning` 里一份**人读的合约表**（每宿主工具清单 + 参数化合并方案 + undo 分类表）**+ 代码里一个 CI 测试核对**（人能读懂 + 机器能防漏，两边都要）。
- **D-17 undo 守门硬卡到底**：每个新写工具**必须声明 undo 类型**（简单逆向 / 快照式 / noop+gate）**+ 配 `operationLog.integration.test`**，漏了 **CI 直接挂**。这是**数据安全门，不走 D-04 质量>>成本软化**（呼应 Phase 5 Word 撤销全挂教训 + memory `project_adapter_inverse_signature` / `recurring_failure_add_gate`）。
- **D-18 NFR-08 token 门修订**：**去掉** per-host toolDefs `≤15KB` CI gate（不检查工具定义 token）。参数化合并**保留为设计原则**，但理由从"省 token"改为"**工具更少更清晰 → AI 选工具更准**"（质量收益）。⚠ 需更新 REQUIREMENTS.md NFR-08。
- **D-19 B 工具裁剪沿用已锁结论**：合约表照 REQUIREMENTS.md 已定结论填，Phase 8 **不重新 triage**——`merge_cells`/`create_pivot_table` → v2.2；`delete_worksheet` 不做；`delete_shape`/`delete_slide` = noop+gate（warn 不中断）。

### Claude's Discretion

- D-10（偏好示例预设）、D-14（持久化时机=每轮跑完即存）、D-15（空历史显示 chips）为推荐默认，planner 可在实现细节上微调。
- 合约表的具体字段 schema、CI 测试的断言形式由 planner 定。

### Folded Todos

无折叠。唯一匹配的 `builtin-model-dropdown.md` 为弱匹配且非本阶段范围，见 Deferred。

### ⚠ 需同步的文档改动（planner / 用户务必处理，否则下游会重新套上旧 gate）

- **REQUIREMENTS.md NFR-07**：<3000 字符硬 gate → 软提醒（D-05）
- **REQUIREMENTS.md PREF-02**：偏好上限 200 → ~500 字符（D-08）
- **REQUIREMENTS.md NFR-08**：去掉 per-host toolDefs ≤15KB CI gate；参数化合并保留为设计原则（D-18）
- **ROADMAP.md Phase 8 SC#5 + Phase 13 SC#5**：删去"system prompt <3000 字符（CI gate 维持）"硬性表述，改为软提醒口径
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 本里程碑研究（最重要，roadmapper 已消化大部分 Open Question）
- `.planning/research/SUMMARY.md` — v2.1 综合研究（0 净新增依赖 / B 工具 triage / undo 分类 / 7 个 spike / 各 feature 集成点）。§A、§F、§"Architecture integration" 集成点表、§Spikes 直接相关本阶段。
- `.planning/research/ARCHITECTURE.md` — 参数化工具合并策略（STRAP）、C batch Strategy 2、各 feature 新建/改动文件表。
- `.planning/research/PITFALLS.md` — §A2 prompt injection（OWASP LLM01）、§F1/F2/F4 持久化坑（raw URL/quota/序列化）、undo 不可逆分类。
- `.planning/research/FEATURES.md` — B 工具 35 do-now triage 明细 + 超高频"必做 10"。
- `.planning/research/STACK.md` — §A/§F 实现路径（storage.ts 复用、persist vs 手动 saveHistory）。

### 三宿主 Skill 设计思路（用户 todos.md 指定输入 —— ⚠ 只取设计思路，不要 Python 脚本；research 阶段继续深挖 + 可再检索补充）
- `todos.md` §"系统 Prompt 调整" — 用户列的 5 个 skill 清单原始出处。
- PPT: https://github.com/anthropics/skills/blob/main/skills/pptx/SKILL.md — 配色/视觉母题/版式/密度/**做完转图自查**。
- PPT: https://www.skills.sh/daymade/claude-code-skills/ppt-creator — 工作流（收集意图→金字塔结构→生成→评分自评）+ **断言式标题** + 证据支撑。
- PPT: https://mcpmarket.com/zh/tools/skills/gemini-ppt-slide-optimizer — （本次未深读，research 阶段补）。
- Excel: https://www.skills.sh/davila7/claude-code-templates/excel-analysis — 数据优先工作流（读→清洗→聚合→可视化）+ 成品格式化。
- Word: https://www.skills.sh/shubhamsaboo/awesome-llm-apps/content-writer — 结构优先 + 主动语态 + 具体数字 + "这段配得上它的位置吗"自查。

### Skill 设计元原则 + 业内 PPT 标题最佳实践（本次检索补充，供 prompt 深化参考）
- https://engineering.block.xyz/blog/3-principles-for-designing-agent-skills — **宪法式约束顶住 LLM 爱讨好/偷跳步** + 先想拿掉什么 + 越具体越好。
- https://slideworks.io/resources/how-to-write-action-titles-like-mckinsey — 麦肯锡 action title：标题先写、读标题即懂全 deck。
- https://bitesizebio.com/35696/assertive-slide-titles/ — Assertion-Evidence 结构。

### 项目记忆（约束）
- memory `project_adapter_inverse_signature` — inverse 方法收 Record 对象（非位置参）；每个新 inverse 配 `operationLog.integration.test` 守门（D-17 依据）。
- memory `feedback_recurring_failure_add_gate` — 同故障复发 ≥2 次加结构性守门（D-17 依据）。
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/agent/system-prompt.ts` — `getSharedBase` + `getDomainSegment(host)` + `buildSystemPrompt(host)` 已存在；三宿主各已有 6 行 domain 段。D-02 深化改 `getDomainSegment`；D-05/D-07 偏好注入要扩 `buildSystemPrompt` 签名（加 `opts?:{userPrefs?}`）。**注意**：当前 `buildSystemPrompt(host)` 在 `loop.ts:60` 调用，签名扩展需保持向后兼容或同步改 loop.ts。
- `src/lib/storage.ts` — `storage.get/set/remove` 已封装 partitionKey 前缀 + QuotaExceeded→StorageQuotaError；`STORAGE_KEYS` 常量表。F 复用：加 `CHAT_HISTORY` 常量 + docKey 拼接（D-11）。
- `src/store/chat.ts` — 纯 message store（thin-delegate 到 agentStore.runAgent）；已有 `clearHistory()`（清内存 + abort）。F 扩：`loadHistory/saveHistory` + `clearHistory` 接 localStorage + docKey；Message v2 schema 已含 role/content/ts，序列化白名单基于此。
- `src/agent/loop.ts` — wire `messages` 在 L59-62 构建（system + user）；D-13 的 20 轮截断落此处；D-05 偏好注入经 `buildSystemPrompt`。本文件 ≤80 行预算，helper 抽到 loop-helpers.ts。
- `src/components/Settings/SettingsPanel.tsx` — 三分区路由（browse/editing/creating）+ `aster-settings__global-options` 区块（已有"自动附带选区"开关样式 `section`/`toggle-row`）。D-07 偏好文本框挂此区块；D-10 预设 chips 同处。
- `src/agent/operationLog.ts` + `operationLog.integration.test.ts` — undo/reverse 基础设施 + 守门测试范式。D-16/D-17 合约的 CI 检查 + 每 inverse 守门复用此范式。
- empty-state 杀手场景 chips（ONB-03，draftPrompt 机制 `chat.ts` setDraftPrompt）— D-15 空历史复用。

### Established Patterns
- system prompt = 运行时注入日期 + 全中文 + 共享基座 + per-host domain 段（D-06..D-10 既有架构，深化不改架构）。
- adapter 方法在 `*.run` 闭包内、输入输出纯数据（A-06）；inverse 收 Record 对象。
- localStorage 一律走 `storage.*`，不直接 `localStorage.*`。
- 0 净新增运行时依赖（zustand persist 已在包内但 F 用手动 save/load 因需感知 partitionKey/docKey）。

### Integration Points
- A 新建：`src/store/preferences.ts`（偏好 store）；Settings 组件扩展。改：`system-prompt.ts`、`loop.ts`、`system-prompt.test.ts`（injection 测试必加）。
- F 新建：`src/lib/docKey.ts`。改：`store/chat.ts`、`loop.ts`（20 轮截断）、`main.tsx`（hydrate）、`storage.ts`（CHAT_HISTORY 常量）。
- 合约：`.planning/` 合约表文档 + 一个 CI 测试（核对 undo 类型声明齐全 + 工具清单一致）。
</code_context>

<specifics>
## Specific Ideas

- **用户自我定位**：Office **小白**（非重度用户）。因此核心期望是 Aster **更自主**——给一个主题就能自己列大纲、建好成品；无论精细指令或模糊需求都能快速出"商业可用文档"。这是 A 深化的北极星，比任何细操作指导都重要。
- **用户原话愿景**："给一个主题，他能够自己帮我列大纲、编写完成 PPT 同时配上对应的图片、背景等等。" → 文字/大纲/版式部分 v2.1 做；**配图/背景** = v2.2 + Phase 10（见 Deferred），agent 诚实告知缺口。
- **质量观**："生成的质量远远重要于成本及包体积"——已固化为 D-04 项目原则。
- **Skill 取材原则**：参考 PPT/Excel/Word 的 agent skill 设计思路丰富 prompt，**只取"怎么设计操作"的部分，不要脚本**；research 阶段可继续检索更多有帮助的素材。
</specifics>

<deferred>
## Deferred Ideas

- **PPT/Word 配图、生图、幻灯片背景** —— 用户在愿景里强烈希望（"配上对应的图片、背景"），但**不在 v2.1**：生图(MM-03)/图库检索(MM-04) = v2.2 独立 milestone；背景色(PPT-08 `set_slide_background`) = 本里程碑 Phase 10。**记录用户对图片能力的高优先级意愿**，供 v2.2 排序时参考。Phase 8 仅以"诚实告知缺口"处理（D-03）。
- **prompt 长度软提醒的"参考值"具体数字** —— 留给 planner 按实测定（不再是 3000 硬上限）。

### Reviewed Todos (not folded)
- `builtin-model-dropdown.md`（DeepSeek + AiHubMix 内置 model 下拉）—— 弱匹配（仅命中关键词 "phase"），且 v2.0 CARRY-02"内置 Provider model 下拉"已交付（疑似已完成），与 Phase 8（A/F/合约）无关。**不纳入本阶段**。
</deferred>

---

*Phase: 08-foundation-a-f*
*Context gathered: 2026-05-30*
