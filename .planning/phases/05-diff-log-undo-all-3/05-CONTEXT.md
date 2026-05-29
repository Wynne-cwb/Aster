# Phase 5: Diff Log + Undo All 跨 3 宿主 - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

在 Phase 6 大规模铺开 destructive write tool 之前，把「兜底」打满——让用户首次见到 Aster 时就有 trust 担保。

**本 phase 交付：**

1. **OperationLog 真实回放**：从 Phase 3 骨架（in-memory append + ReverseDescriptor 类型）升级为按 runId 范围的逆序 replay 引擎
2. **三宿主各 1 个 write tool 的 inverse 闭环（PoC）**：Word `append_paragraph` / PPT `insert_slide` / Excel `set_range_values`，每条真机 reverse 验证（TOOL-03 子集 + TOOL-04）
3. **`<DiffLogPanel/>`**：run 完成后聊天流末尾的「本次改动 N 处」可展开汇总卡 + per-step undo + 一键「撤销本次所有操作」
4. **手动改防御**：回放前 `adapter.read()` 抓当前 state 与 post-state 比对，不一致跳过并标注
5. **humanLabel + reverse TS/lint 强制 flip 开**（Phase 3 埋的 eslint rule 本 phase 正式 enforce）
6. **CARRY-03**：copy step log（schema-aware，全量三角色 + 脱敏）
7. **localStorage quota guard 薄包装**（storage.ts setItem try/catch）

**本 phase 不交付（Out of scope）：**

- ❌ 全套 PPT/Excel/Word write tools（每宿主只验 1 个 write tool 的 inverse 闭环作为模型 PoC）—— Phase 6
- ❌ Killer scenario empty-state chip —— Phase 6
- ❌ **sessionStorage F5 刷新恢复（原 SC5）—— 用户本次 discuss 主动移除，归 v2.1+（见 D-13 / deferred）**
- ❌ Resume from checkpoint（从历史 step 重新分支）—— FUT-03

</domain>

<decisions>
## Implementation Decisions

### DiffLogPanel 形态与呈现（AGENT-07 / -09）

- **D-01:** DiffLogPanel = 聊天流末尾追加的一张可展开「本次改动 N 处」**汇总卡**，**不是**常驻底部面板、**不是**抽屉。复用现有 ChatStream `role='tool'` 折叠卡的视觉语言（teal token + 内联 SVG）。
- **D-02:** 汇总卡只在 **run 完成后**出现；run 进行中靠现有 live `role='tool'` 卡展示每步进度（Phase 4 已落 humanLabel 实时卡）。
- **D-03:** 汇总卡**只列写操作**（有 reverse descriptor 的步）；读操作（list_slides / get_* 等）不进汇总卡。
- **D-04:** 汇总卡展开后每步一行：humanLabel 中文人话 +「撤销该步」按钮；卡片底部「撤销本次所有操作」secondary 灰按钮 + 二次确认（AGENT-09，不和主流程混）。

### 撤销粒度与顺序（AGENT-09 / -10）

- **D-05:** 单步「撤销该步」= **任意步独立可撤**（不限 LIFO）。要求每个 write tool 的 reverse descriptor 升级为「**精确定位**」——能反操作*指定的那个目标*，而不是「最后一个」：
  - Word `append_paragraph` 现有 reverse `{tool:'delete_last_paragraph', args:{}}` **必须改为按目标定位**（如 `delete_paragraph_at` 或按内容/段落引用定位）
  - Excel `set_range_values` reverse 用记录的 before-image（address + values）覆写——天然支持任意顺序（SP-4 已验）
  - PPT `insert_slide` reverse = 删除「插入时记录的那张 slide」（按 slide id/index 定位，**不依赖** getSelectedSlides 返回顺序，SP-5）
- **D-06:** 任意顺序单撤必须对「**index 漂移**」鲁棒（用户/agent 在中间插删导致数值 index 失效）。倾向用**内容指纹 / 稳定对象 id** 定位目标，而非纯数值 index。每宿主稳定定位的具体手段 = researcher/planner 落地确认（SP-4 已给 API path）。
- **D-07:** 「撤销本次所有操作」的「本次」= **当前这一轮 agent run（按 runId 范围）**。undo all = 该 runId 的 OperationLog **逆序 replay** 每步 reverse。
- **D-08:** 用户连跑多轮 agent 时，**旧轮的汇总卡保留可见**，但各自的 undo all 只负责自己那一轮——不跨轮累计撤、不在新 run 开始时清旧记录。

### 手动改防御 / 比对严格度（AGENT-11）

- **D-09:** 回放每步前先 `adapter.read()` 抓当前 state，与 diff log 记录的 post-state 比对。严格度 = **「只比目标对象内容」**——严格比对*要反操作的那个目标本身*（Word 那段文本 / Excel 那片单元格值 / PPT 那张 slide 的标识），周边无关变化容忍。
- **D-10:** 目标对象内容与记录的 post-state 不一致 → **跳过该步、标记「未回滚（你已手动修改）」**。对齐 ROADMAP SC3「写 5 处、手改 1 处、undo all 回滚 4 处保留 1 处」。比对要对增量内容做合理规范化后再比，避免被 Office.js 空白/格式归一化误判为「改过」（false-skip）。
- **D-11:** undo 过程中某步的 reverse 操作**自身报错**（Office API 失败，非用户手改）→ 跳过该步标红「未能回滚」，**继续撤剩下的步**（最大努力回滚），不「遇错即停」。
- **D-12:** undo all 结束弹明确总结：「已回滚 X 步，跳过 Y 步（你已手动修改），Z 步未能回滚（宿主报错）」。

### F5 刷新恢复 / 存储兜底范围（原 SC5 / SC7 调整）

- **D-13:** **原 ROADMAP SC5「sessionStorage 兜底刷新」整条移除**（用户 discuss-phase 5 决定）。不做：sessionStorage 每步同步 / mount-check 残留 /「撤回·保留」对话框。**DiffLogPanel + OperationLog = 纯内存**；刷新即丢、不恢复（与 PITFALLS A-15「刷新 = agent session 终止不恢复」一致）。理由：自用工具，刷新中途撤回是低频边角，重跑成本低。SC5 不绑任何 AGENT-xx 需求（派生自 A-15），移除不留孤儿需求。
- **D-14:** **SC7 localStorage quota guard 瘦身为薄包装**：只给 `src/lib/storage.ts` 的 `setItem` 加 try/catch + 超配额检测，超限抛业务异常「localStorage 即将占满」（沿用 AsterError 体系）。**不做** 80% LRU 清除——聊天历史本来不进 localStorage（v1 内存级），localStorage 只剩 Provider/Key/flag 小数据，无大数据可清。

### TS / lint 强制（AGENT-08 / TOOL-04）

- **D-15:** **本 phase flip 开 humanLabel + reverse 的 TS/lint 强制**（Phase 3 D-13 埋的 eslint rule 此 phase 正式 enforce）：每个 write tool `execute` 返回必须含 `reverse: InverseDescriptor`，缺则编译失败 / 不让注册到 registry；每个 tool 必须 export `humanLabel`，缺则 lint 失败。
- **D-16:** OperationLog 数据结构从 Phase 3 的全局数组重构为 **`Map<runId, entries[]>`**（operationLog.ts 注释已建议），支持 D-07 按 runId 范围 undo all + D-08 多轮保留。具体形态 = Claude's Discretion。

### inverse op 真实回放（AGENT-10）

- **D-17:** 三宿主各验证 1 个 write tool 的 inverse 闭环（TOOL-03 子集 + TOOL-04，模型 PoC）：Word `append_paragraph`→删该段（精确定位）；PPT `insert_slide`→`slide.delete()`（SP-5 已验真删）；Excel `set_range_values`→before-image 覆写（SP-4 已验）。全套 write tools 铺开是 Phase 6。
- **D-18:** inverse 一律走 Office.js API path（SP-4/SP-5 真机 PASS），**不做 snapshot fallback**，**禁用 Office.js native undo**（AP-3：PPT 无 `presentation.undo()` + Office undo stack 不透明 + 撞用户手动操作）。

### CARRY-03 copy step log（折入 todo copy-chat-history.md）

- **D-19:** copy step log = 全量三角色（user / assistant / tool）消息 + tool name + humanLabel + result，按时间序 dump。
- **D-20:** 默认 **Markdown** 格式（贴 issue / 分享 debug 友好）；JSON 作为备选（按钮或修饰键切换 = Claude's Discretion）。
- **D-21:** 自动脱敏：API Key、Provider id 不输出；URL 保留（todo 原意）。
- **D-22:** 入口 = **主界面 + Settings 双入口**（todo 建议）。

### Claude's Discretion

- OperationLog `Map<runId>` 重构的具体数据结构 / Zustand selectors
- 每宿主稳定目标定位的具体手段（内容指纹 vs 对象 id；researcher 据 SP-4 API path 确认）
- 汇总卡的视觉细节（teal token / 间距 / 折叠交互）—— 走 `aster-design-system` skill
- copy step log 的 Markdown 模板 + JSON 切换 UI
- undo all 二次确认对话框文案
- humanLabel/reverse eslint rule enforce 的具体写法（Phase 3 rule 已埋）

### Folded Todos

- **`copy-chat-history.md`（CARRY-03）** — 折入本 phase。扩展为 schema-aware copy step log（D-19..D-22）。原 todo：全量会话 dump 成 Markdown/JSON、脱敏 Key/Provider id、主界面 + Settings 双入口。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents（researcher / planner / executor）MUST 读这些文件，决策依据全在里面。**

### 项目级（必读）
- `.planning/ROADMAP.md` — Phase 5 段（goal / 7 条 SC / 4 条 Risk）。**注意：原 SC5「sessionStorage F5 恢复」已被本 CONTEXT D-13 移除；SC7 quota guard 已被 D-14 瘦身**
- `.planning/REQUIREMENTS.md` — 本 phase 范围 = AGENT-07/09/10/11 + TOOL-03(Word/PPT/Excel 各 1 写工具 inverse)/TOOL-04 + CARRY-03 + NFR-05；AGENT-08 humanLabel 强制本 phase flip
- `.planning/PROJECT.md` — Core Value（trust 担保 = 首见 Aster，Q8）/ Q9 失控控制（undo all 是衍生责任）/ 5 条硬约束

### 研究产出（必读）
- `.planning/research/PITFALLS.md` — A-09 undo all 不撤用户手动操作（HIGH，→ D-09/D-10）/ A-11 diff log 撑爆 localStorage（→ D-13/D-14 纯内存）/ A-13 humanLabel 缺失（→ D-15）/ A-15 刷新中途（→ D-13 移除恢复）
- `.planning/research/ARCHITECTURE.md` — AP-3 禁用 Office.js native undo（→ D-18）+ inverse op 模型 + Message schema
- `.planning/research/FEATURES.md` — diff log / undo UX patterns + anti-features

### Spike 真机验证（CRITICAL — inverse op 可行性结论）
- `.planning/spikes/SP-4-reverse-ops/findings.md` — ✅ PASS：Word `paragraph.delete()` / Excel `range.load(['values','address'])` before-image 覆写 / PPT slides 读取，三宿主 reverse API path 全可达，**无需 snapshot fallback**
- `.planning/spikes/SP-5-ppt-slide-delete/findings.md` — ✅ PASS：PPT `slide.delete()` Web 端真删（3→2）；**getSelectedSlides 反向排序留本 phase 验**，实现 PPT undo all 时显式逆序遍历自有 OperationLog 绕过（→ D-05 PPT）

### 上游 phase 已交付产物（直接消费）
- `.planning/phases/03-agent-loop-privacy-word-demo/03-CONTEXT.md` — D-07 agent 模块结构 / D-08 Message+OperationLog 骨架 / D-12 append_paragraph reverse descriptor / D-13 humanLabel eslint rule 埋点（本 phase flip）
- `.planning/phases/04-read-tools-agentcontrolbar/04-CONTEXT.md` — read tools 全套（inverse op 的 before-image / 比对前 read 来源）；AgentControlBar 三态；circuit breaker 完整

### 关键源文件（plan 的 read_first 候选）
- `src/agent/operationLog.ts` — Phase 3 骨架（in-memory 数组 + appendOperation + getOperationsByRun + ReverseDescriptor/OperationLogEntry 类型）；本 phase 重构为 Map<runId> + 真实 replay
- `src/agent/tools/index.ts` — ToolDef（humanLabel 已在类型强制）+ ToolResult.reverse? + dispatchTool sanitize 边界 + buildToolsForHost；本 phase flip humanLabel/reverse lint enforce
- `src/agent/tools/write/word.ts` — append_paragraph（reverse 现为 delete_last_paragraph，本 phase 改精确定位）
- `src/lib/storage.ts` — 本 phase 给 setItem 加 quota guard 薄包装（D-14）
- `src/components/ChatStream.tsx` — 现已渲染 role='tool' humanLabel 折叠卡；本 phase 末尾追加 DiffLogPanel 汇总卡
- `src/agent/agentStore.ts` — Zustand；undo all / per-step undo action 落点
- `src/adapters/{Word,Ppt,Excel}Adapter.ts` — 三宿主 read（before-image）+ 新增 inverse 写方法（paragraph.delete / slide.delete / range.values 覆写）
- `.planning/todos/pending/copy-chat-history.md` — CARRY-03 来源（D-19..D-22）

### UI
- `CLAUDE.md` §UI 设计系统 / §发布授权
- `aster-design-system` skill（teal 克制；DiffLogPanel / 二次确认对话框 / copy 按钮走现有 token）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/agent/operationLog.ts` — Phase 3 已有 `appendOperation` / `getOperationsByRun(runId)` / `ReverseDescriptor{tool,args}` / `OperationLogEntry{runId,stepIndex,toolName,args,humanLabel,reverse,timestamp}`。本 phase 加 replay/undo 逻辑 + 重构为 Map<runId>。
- `src/agent/tools/index.ts` — `ToolResult.reverse?: ReverseDescriptor` 字段已在；`ToolDef.humanLabel` 已在类型强制（lint enforce 本 phase flip）；`dispatchTool` 的 sanitize 边界 + 15s 超时已稳。
- `src/agent/tools/write/word.ts` — append_paragraph 完整实现 + humanLabel + reverse descriptor 模板（reverse 改精确定位）。
- `src/adapters/*Adapter.ts` — Phase 4 read() 全套（list_slides/get_* / get_range_values/get_used_range_summary / get_paragraph_*）= 比对前 read + before-image 抓取的现成来源。
- `src/components/ChatStream.tsx` — role='tool' humanLabel 折叠卡渲染（DiffLogPanel 汇总卡复用此视觉）。
- `src/lib/storage.ts` — partitioned localStorage 工具（setItem 现为裸调用，本 phase 包 try/catch）。
- `src/errors/index.ts` — AsterError 体系（quota guard 抛业务异常沿用）。
- `src/components/icons.tsx` / `src/styles.css` — 内联 SVG + teal token（汇总卡 / 撤销按钮 / 二次确认对话框）。

### Established Patterns
- Adapter「纯数据进 / 纯数据出」，proxy 不出 *.run 闭包（A-06 + eslint rule 守门）—— inverse 写方法同样在各自 *.run 闭包内开闭一次
- 每个 plan 一个 commit + 真机 UAT 重测（D-06 强制气质继承）
- UI 全走 styles.css CSS 变量 + Lingui macro（zh-CN）
- LLM 调用原生 fetch（不引 SDK）；0 净新增运行时依赖（NFR-02，bundle ≤ 1MB，CI gate 现 ≤82KB gzip 紧）

### Integration Points
- loop.ts 每步 write tool 返回 `{result, reverse}` → `appendOperation` 写入当前 runId 的 OperationLog
- DiffLogPanel ← 订阅 agentStore / operationLog（按 runId 取该轮写操作）
- 「撤销该步」/「撤销本次所有操作」→ agentStore action → 逆序 replay：每步先 `adapter.read()` 比对 post-state → 一致则执行 reverse（adapter 对应 inverse 方法）→ 不一致跳过标注
- copy step log ← chatStore messages（三角色）+ operationLog（humanLabel/result），脱敏后写剪贴板

</code_context>

<specifics>
## Specific Ideas

- **这是首见 Aster 的 trust 担保**（Q8：v1 不发，v2 第一个 release 就是用户首次见到）。undo 兜底要让用户敢放手让 agent 改文档——比「功能多」更重要的是「敢撤回」。
- **用户主动选了更强的「任意顺序单撤」而非省事的 LIFO** —— 说明 per-step undo 要真做实，reverse 必须精确定位（不是 delete_last 偷懒）。planner 别退回 LIFO。
- **用户持续「自用工具、砍非必要」气质**：本次又主动砍掉 F5 恢复（SC5）+ 瘦身 quota guard（SC7）。planner 在任何「健壮性/边角 UX」前先想：这是给用户*信任 Aster* 的核心兜底，还是给企业合规看的？后者别做。详见 [[project-aster-privacy-simplified]] / [[project-aster-cost-removed]]。
- **比对严格度的取舍是「误跳过 vs 误撤销」**：用户选「只比目标对象内容」= 既不被格式归一化误跳（能回滚到 SC3 的 4 处），又绝不误撤用户手改的那 1 处。规范化比对是关键工程点。
- **teal 克制延续**：DiffLogPanel 汇总卡 / undo 按钮 / 二次确认对话框走现有 token，不另造观感。详见 [[feedback-beauty-over-fluent]]。
- **bundle 预算紧**（CI ≤82KB gzip，初始 main bundle 已接近）：DiffLogPanel + undo 逻辑进主 chunk 要盯 size；非热路径能懒加载的懒加载。详见 [[project-bundle-size-guard]]。

</specifics>

<deferred>
## Deferred Ideas

### 移除 / 推后
- **SC5 sessionStorage F5 恢复** — 用户 discuss-phase 5 主动移除（D-13）。归类同 FUT-03 resume-from-checkpoint，未来扩用户范围 / OSS 公开后再评估。
- **全套 PPT/Excel/Word write tools + 差异化护城河（set_shape_property / move_shape）** — Phase 6（本 phase 每宿主只验 1 个 write tool 的 inverse 闭环 PoC）。
- **Killer scenario empty-state chip / Ribbon 降级** — Phase 6。
- **getSelectedSlides 多 slide 反向排序真机验证** — 本 phase 实现 PPT undo all 时验（SP-5 留尾），但用「自有 OperationLog 逆序遍历」绕过排序不确定性。

### Reviewed Todos（not folded）
- **`builtin-model-dropdown.md`** — CARRY-02，已在 **Phase 4 交付**（model select 下拉），**不并入** Phase 5。todo.match-phase 因关键词模糊匹配到，实际已完成。

### v2.1+
- Resume from checkpoint（FUT-03）/ Per-action consent（FUT-04，永不做）/ Multi-agent spawn（FUT-05）/ Cross-session memory（FUT-06）

</deferred>

---

*Phase: 05-diff-log-undo-all-3*
*Context gathered: 2026-05-29 via /gsd-discuss-phase 5*
