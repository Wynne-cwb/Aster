# Aster

## What This Is

Aster 是一个面向中文职场用户的 Office.js Add-in，跑在 PowerPoint / Excel / Word 三个宿主之上，通过 LLM（DeepSeek-V4）与图像模型（aihubmix）把 AI **作为 Office 内嵌的智能代理**直接接入用户的工作流。定位在 Microsoft Copilot 与浏览器版 ChatGPT 之间——开源、BYO Key、无后台。

## Core Value

**在原生 Office 内部，让中文职场用户用自带 API Key 享受到 AI 代理能力，能完成绝大部分文档工作（多步任务、精细化操作、跨场景协作），无需切网页、无需订阅 Copilot、无需把数据交给中间服务器。** 如果这一点失败（比如必须复制粘贴出 Office 才能用 AI，或 AI 只能给单步建议无法真正执行），整个产品就没有意义。

## Current State

**v2.1「从能用到好用」已交付 ✅（2026-06-01，线上 `2c0201e`）** — Aster 第二个公开发布。在 v2.0 agent 基座上，agent 更懂三宿主（per-host domain prompt + 用户偏好注入）、能改更多（Word 5 / Excel 10 / PPT 8 = 23 个 write tool）、改得更快更准（批量操作 + Word 选区精度）、体验更顺（UI 打磨套件）、记得住历史（聊天记录持久化）。**42/42 需求交付，三宿主 Office for Web 真机 UAT 全 PASS。** 6 phases / 27 plans / 75.03 KB bundle / 773 tests green / 0 净新增运行时依赖。详见 `.planning/MILESTONES.md` + `.planning/milestones/v2.1-ROADMAP.md`。

**已知限制：** PPT `copy_slide` 网页版 `Slide.copy()` 微软接口天生不支持（诚实失败，转 v2.2/桌面版）。

## Current Milestone: v2.2 多模态四件套

**Started:** 2026-06-01（`/gsd-new-milestone`）

**Goal:** 给 Office 智能代理加上「看 / 读文件 / 生图 / 找图」的多模态能力。Provider 客户端（`aihubmix-vision.ts` / `aihubmix-image.ts`）已在基座，但从未接进 agent loop / 无 tool / 无 UI。

**Target features:**
- **MM-01 视觉看图** — agent 可「看」选中图片/图表作 evidence（接 aihubmix-vision；是否验 DeepSeek-V4 原生多模态一并定）
- **MM-02 文件上传解析** — chat 附件 docx/xlsx/pdf/pptx/图片 → 懒加载解析作 agent context（明确「附件」vs「agent 自取当前文档」UX 边界）
- **MM-03 图片生成插入** — PPT/Word「生成图并插入」write tool。**三个生图模型、三套 wire format**（已实测存档 `.planning/spikes/011-image-gen-api-formats/findings.md`）：`doubao-seedream-5.0-lite`（predictions/URL，新增）、`gpt-image-2`（predictions/base64）、`gemini-3.1-flash-image-preview`（Gemini streamGenerateContent/base64）。需按模型分发 response 解析 + 两套鉴权（Bearer / x-goog-api-key）
- **MM-04 公开图库检索** — Unsplash/Pexels 检索免费正版图并插入（与 MM-03 互补；Q1 spike 对比 API 限额/中文搜索/商用授权）
- **MM-05 AiHubMix model 修正** — 区分视觉 model 与生图三模型，重写 `src/providers/aihubmix-image.ts`（旧文件仍写 `gpt-image-1` + 大概率 OpenAI `/images/generations` 形态 → 改 predictions/gemini 双形态），修正默认 model 清单

**v2.2 技术债已清 ✓：** PPT 工具 snake/camel casing 中央归一化根治（Phase 14 MDL-03：dispatch 层 `normalizeToSnakeCase` + 删散落双键容错 pick* helper + 守门用例，见 memory `project_ppt_officejs_gotchas`）。

**硬约束不变：** 无后台 / BYO Key / 纯浏览器直连 / 三宿主 API 子集 / 初始 bundle CI gate ≤82KB gzip（解析等重模块懒加载）/ P95≤10s / Key 不上传 / 0 净新增运行时依赖（图库/解析等如需引入需评估）。**项目原则：AI 生成质量 >> token 成本 & 包体积**（NFR-07/08 软化，undo 守门 / bundle gate / P95 仍硬卡）。

<details>
<summary>v2.1 milestone 原始 goal + A–F features（已交付 2026-06-01，归档）</summary>

**Goal:** 在 v2.0 的 agent 地基上，让 Aster 从「能用」走到「好用」——agent 更懂三个宿主、能改更多东西、改得更快更准，体验更顺手。多模态（看图/生图/文件/图库）拆到 v2.2。

**Target features（A–F）:**
- **A 能力变聪明** — Per-host 系统 prompt（PPT/Excel/Word 各一套专属设定）+ 调研三宿主 agent Skills 的设计思路 + 用户自定义偏好注入 prompt
- **B 能力补全** — 把 Office.js 高频「改」方法暴露成 LLM write tool；~60 项候选清单 triage 裁剪只留高频痛点
- **C 批量操作** — batch write 路径，解决逐单元格操作慢、工具卡片爆炸
- **D Word 选区精度** — 选文本 read tool 补坐标/定位信息，避免多个相同文本改错
- **E UI 打磨** — Markdown 优化（表格边框）+ 读卡轻量化 + 首屏骨架屏 + AI loading 气泡 + 「本次改动」卡跟随当次 loop
- **F 聊天记录持久化** — localStorage 存储 + 清空 + 分文档 + 传 LLM 上下文上限 ~20 轮

</details>

## Baseline — v2.0 SHIPPED ✅ (2026-05-30)

**v2.0「Office 智能代理」已首次公开发布**（线上 `f9fdcc4`，GitHub Pages，三宿主 sideload）——Aster 第一个正式 release（v1 按 Q8 作为 v2 基座保留，未单独发布）。6 phases / 53 plans / bundle 73.42 KB gzip；4 个 killer scenario Chrome × 三宿主真机 UAT 全 PASS；31 需求交付 30（ONB-01 当时 descope，现已取消）。详见下方 §Shipped Milestone + `.planning/MILESTONES.md`。

---

## Shipped Milestone: v2.0 Office 智能代理

**Goal:** 把 Aster 从「单步 AI 提效工具」重写为「Office 内嵌智能代理」——在当前打开的单个 Office 文档内执行多步任务，由 LLM 自主决定下一步 tool call，用户全程可观察 / 暂停 / 兜底回滚。**[已交付 2026-05-30]**

**Target features:**
- **A1 Multi-step agent loop** — chat.ts 状态机支持 `tool call → execute → push result → continue` 循环（max_steps=20 硬上限）
- **A2 Tool result feedback** — adapter 执行结果（含失败原因）push 回 messages 让 LLM 作为下一步决策依据
- **A3 Context-aware read tools** — LLM 可主动获取文档结构 / shape 元数据 / 选区详情等只读上下文
- **A4 失控控制 UX** — 始终可见 pause；完成后 step-by-step diff log；一键 undo all 兜底（Q9 衍生，cost meter 在 /gsd-discuss-phase 3 砍掉，max_steps=20 是唯一防御）
- **A5 错误恢复协议** — 代理自决恢复，但同 tool 重复失败 >2 次强制 abort；tool error 文案结构化（含 code + 可恢复性 hint）（Q11 衍生）
- ~~**隐私模型重写**~~ — Q10 衍生 PRIV-01..05 在 /gsd-discuss-phase 3 整批移除（早期用户=自己+亲人，不做授权 UX）；read tool 默认全开，无 opt-out、无 banner、无 PRIVACY.md
- **Phase 2.2 嵌入三件** — FU-01 首次取选区 bug、FU-02 model 下拉 UX、FU-03 copy chat history（v1 Phase 2.2 取消时转嫁）

**Key context:**
- v1 代码（Phase 0-2.1）作为 v2 基座保留在 main，不打 tag、不写 release notes（Q8）
- Phase 0/1/2/2.1 已交付的底层基座 95%+ 可复用：spike gating / foundation / Provider 抽象 / SSE / 错误分类 / cost badge / 选区胶囊 / 三宿主 Adapter
- 代理能力上限 = Office.js 三宿主可用 API 子集；不跨文档、不跨应用（Q7）
- v2.0 roadmap 从 Phase 3 继续编号（v1.0 Phase 2.2 取消，Phase 3-7 全部 needs-replan）

## Vision Pivot — 2026-05-28

**从「AI 提效工具」扩展到「Office 智能代理」。**

**起因**：Phase 02.1 真机 UAT 完成后，项目作者明确愿景：希望 Aster 最终成为「Office 内的智能代理，能完成绝大部分事情」——例如"根据关键词创建完整 PPT"、对 shape 做精细化操作、跨多步推进任务。这要求 multi-turn agent loop + context-aware read tools + 工具结果反馈给 LLM，**与原 PRD R1「v1 是提效工具，不是代理」直接冲突**。

**判断**：当前已完成的 Phase 0/1/2/2.1（spike + foundation + Provider 抽象 + UAT gap closure）在代理愿景下 **95%+ 可复用**——它们是底层基座（CORS / 三宿主 Adapter / SSE / 错误分类 / cost badge / 选区胶囊）。**真正需要重新规划的是 Phase 2.2 / 3-7**（Phase 4-6 原本按 plan-then-execute 思路设计，代理模式下要重写）。

**最佳转向时机**：现在。Phase 4 开工前转向 ≈ 零损失；做完 Phase 4 再转向 ≈ 杀手场景重写一遍。

**当前状态**：
- v1.0 milestone **暂停**在 Phase 2.1 完成位置
- Phase 2.2（02.1 UAT follow-ups）暂搁置——评估哪些 UX 优化在代理 UX 下还有意义
- Phase 3-7 全部标 **needs-replan**
- 下一步：spec agent 架构的边界 / 失控控制 / 隐私模型，然后基于 spec 重写 ROADMAP

**PRD R1 状态**：**superseded**。原约束「v1 是提效工具，不是代理」推翻；保留作为历史记录。

**仍然不变的约束**（继续作为代理愿景的硬约束）：
- 无后台、纯 BYO Key、纯浏览器直连（Tech — No Backend / Security）
- 三宿主跨平台 API 子集（Tech — Host / N1）
- 初始 JS ≤ 1MB（Tech — Bundle / N2）
- P95 ≤ 10s / 首 token ≤ 2s（Performance / N3）
- API Key 永不上传 Aster 自有服务器（Security / N4）

**已锁定的边界**（2026-05-28）：
- **能力范围 = 仅单文档内多步**（Q7）：Agent 只在当前打开的那一个 Office 文档内执行多步操作；不跨文档读、不跨应用调用。三宿主 Office.js 能力 = 代理能力上限
- **v1.0 不单独发布**（Q8）：v1 代码作为 v2 基座保留；Phase 2.2 取消；不打 tag / 不写 release notes

**已锁定的边界**（2026-05-28 续）：
- **失控控制 = 宽松**（Q9 + /gsd-discuss-phase 3 修订）：max_steps=20 硬上限；后台跑完汇报；用户随时 pause；需配套 pause + diff log + undo all（cost meter / pre-call gate / Settings cap 全砍）
- **隐私模型 = 完全开放**（Q10 + /gsd-discuss-phase 3 整批移除）：read tool 默认全开；文档全文可发给 LLM；**PRIV-01..05 全部不做**（Onboarding 仍 2 步，无 Step3Privacy；Settings 无 opt-out；无 Provider allowlist / banner；不写 PRIVACY.md）。详见 .planning/phases/03-agent-loop-privacy-word-demo/03-CONTEXT.md §D-17-19
- **错误恢复 = 代理自决**（Q11）：tool error push 回 LLM 自决恢复；需 max_steps 硬上限作 fail-safe + 结构化 error 文案 + 同 tool 重复失败 >2 次强制 abort

**已在 /gsd-discuss-phase 3（2026-05-28）锁定：**
- 与现有 chatStore / Adapter 接口的差异：chatStore 降级为纯 message store + thin-delegate 到 agentStore.runAgent（详见 03-CONTEXT.md §D-01/D-08）
- ~~Q9 cost cap 数字~~ — 整批移除（详见 03-CONTEXT.md §D-20-21）
- ~~Q10 Privacy doc + Onboarding 授权~~ — 整批移除（详见 03-CONTEXT.md §D-17-19）
- Q11 tool error 结构化 schema = `{code, message, recoverable, hint}` + 严格 allowlist + 兜底占位 sanitization（详见 03-CONTEXT.md §D-14-16）

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

**v2.0 Office 智能代理 — shipped 2026-05-30，三宿主真机 UAT 全 PASS：**

- ✓ **A1 Multi-step agent loop** — `src/agent/loop.ts` ≤80 行 while runner + max_steps=20 fail-safe + 软着陆 — v2.0 (AGENT-01/02/13)
- ✓ **A2 Tool result feedback** — tool 结果（含失败）结构化回灌 messages 作下一步依据 — v2.0
- ✓ **A3 Context-aware read tools** — 三宿主 `adapter.read()` + 11 个离散 read tool + prompt-injection 包装 + size cap — v2.0 (TOOL-01/02/05/06/07, AGENT-12)
- ✓ **A4 失控控制 UX** — 常驻 AgentControlBar（pause/abort/step counter/差异化文案）+ DiffLogPanel humanLabel + per-step/undo-all + 手改防御 + sessionStorage 兜底 — v2.0 (AGENT-07/09/10/11, CARRY-03, NFR-05)
- ✓ **A5 错误恢复协议** — 结构化 `{code,message,recoverable,hint}` + sanitize 边界 + (tool×code) sliding-window circuit breaker + 「Agent gave up」红卡 — v2.0 (ERR-01/02/03/04)
- ✓ **多宿主 write tools 全套** — PPT/Excel/Word write tools（含差异化护城河 `set_shape_property`/`move_shape`）+ TS 强制 reverse + humanLabel — v2.0 (TOOL-03/04, AGENT-08)
- ✓ **4 killer scenario as agent flows** — PPT topic→deck / Excel 清洗+图+洞察 / Word 整篇润色 / PPT shape 精细化 — v2.0 端到端 UAT PASS
- ✓ **teal 克制设计系统** — 单一品牌色 teal + 纯白底 + 无渐变/无 backdrop-filter（Phase 04.1 迁移）— v2.0
- ✓ **N1/N3/N4/N5 非功能** — 跨平台 API 子集 / P95 性能 / Key 不上传 / Onboarding 透明 — v2.0 (NFR-01/03/04)
- ✓ **N2 包体积** — 73.42 KB gzip ≪ 1MB，0 净新增运行时依赖，CI gate ≤82 KB 维持 — v2.0 (NFR-02)
- ✓ **CARRY-01/02** — 首次取选区 bug 修复 + 内置 Provider model 下拉 — v2.0
- ✓ **ONB-02/03** — step 摘要全中文化 + empty-state killer-scenario chips（替代 v1 Ribbon 6 按钮）+ Ribbon 降级 — v2.0

**Descoped at v2.0 close → 现已取消（2026-05-30 用户决定，不进任何后续 milestone）：**
- ⊘ **ONB-01 / FUT-13** Onboarding GIF/动画 — **Cancelled**。Phase 6 D-18/D-19 收成单步 Onboarding、承载位移除；心智锚定由 chips（ONB-03）+ 中文 humanLabel（ONB-02）承担，无需补回

**v2.1「从能用到好用」— shipped 2026-06-01，三宿主真机 UAT 全 PASS（42/42）：**

- ✓ **A 能力变聪明** — PPT/Excel/Word 三宿主深化 domain system prompt + 用户偏好注入（prompt-injection 防御：sanitizePrefs String.includes / 原始-sanitize 分离 / ≤500 字符 / 静默过滤）— v2.1 (PROMPT-01, PREF-01/02)
- ✓ **B-Word 5 write tool + 选区精度** — 字符格式/段落格式/套样式（locale-safe）/查替换（快照 undo）/插表格 + WSEL-01 paragraphIndex + uniqueLocalId 精确定位 — v2.1 (WORD-01~05, WSEL-01)
- ✓ **B-Excel 10 write tool** — 数字格式/列宽行高/排序/筛选/查替换/条件格式/建表/冻结/工作表/图表标题 — v2.1 (EXCEL-01~10)
- ✓ **B-PPT 8 write tool** — 字体/对齐/形状增删/旋转/背景/幻灯片管理（13 完整 inverse + noop+gate 分类 + 3 spike 门控降级）— v2.1 (PPT-01~08)
- ✓ **C 批量操作** — batch_write 单闭包单 sync + fail-fast + batch_reverse 逆序整批 undo + DiffLogPanel 可展开批量卡 — v2.1 (BATCH-01/02)
- ✓ **E UI 打磨** — UI-01 XSS safeUrlTransform + UI-02 思考气泡 + UI-03 DiffLog 边界跟随 loop + UI-04 表格边框 + UI-05 读卡降权 + UI-06 骨架屏 — v2.1 (UI-01~06)
- ✓ **F 聊天记录持久化** — localStorage（白名单 + ≤2000 字符 + QuotaExceeded 丢最旧）+ 一键清空 + 20 轮截断（整 run 删）+ docKey 分文档（pathname 防 token 泄露）— v2.1 (HIST-01~04)
- ✓ **NFR carry** — bundle 75.03 KB ≤82 KB + 0 净新增依赖；NFR-07/08 由硬 gate → 软提醒（质量 >> 成本原则确立）— v2.1 (NFR-06/07/08)

### Active

> v2.1「从能用到好用」A–F 全部交付 ✓（见上方 §Requirements Validated）。**当前 milestone = v2.2 多模态四件套（started 2026-06-01）**——详见上方 §Current Milestone。下方 FUT-14..17 为本 milestone 的需求种子，REQUIREMENTS.md 会细化为正式 MM-* REQ-ID。

**v2.2 多模态四件套（current milestone — started 2026-06-01）—— Provider 客户端在基座里、但从未接进 agent loop / 无 tool / 无 UI：**

- [ ] **FUT-14 视觉 / 看图（multimodal vision）** — `src/providers/aihubmix-vision.ts` 客户端已在（v1 PROV-03）、registry 路由 `taskKind='vision'` 已在，但未接 agent、无 read/tool 入口、无 UI。需求：让 agent 能「看」选中的图片/图表（如 Excel 图表、PPT 配图）作 evidence。是否同时验证 DeepSeek-V4 原生多模态（原 Q6）一并定
- [ ] **FUT-15 文件上传与解析** — v1 F4（FILE-01..07），v2.0 完全未纳入；src 仅有禁用态回形针图标。需求：chat 附件上传 docx/xlsx/pdf/pptx/图片 → 懒加载解析（mammoth/SheetJS/pdfjs/pptx）作为 agent context 输入源。与「agent 直接读当前打开文档」是两条不同路径，要明确 UX 边界（附件 vs agent 自取）
- [ ] **FUT-16 图片生成并插入** — `src/providers/aihubmix-image.ts` 客户端已在（v1，但写旧 `gpt-image-1` + 大概率 OpenAI `/images/generations` 形态，需重写）；`insert_image_on_slide` write tool **从未实现**（v2.0 TOOL-03 名义含此项但 Phase 6 列为 stretch 未做）。需求：PPT/Word 内「生成一张图并插入」write tool（含 reverse + humanLabel），与图库检索互补。**三个生图模型、三套 wire format 已实测**（spike 011）：`doubao-seedream-5.0-lite`（predictions/URL，新增）+ `gpt-image-2`（predictions/base64）+ `gemini-3.1-flash-image-preview`（Gemini streamGenerateContent/base64），需按模型分发 response 解析
- [ ] **FUT-17 公开图库检索接入** — Unsplash 或 Pexels（原 Q1 / v1 图库检索）；agent 可检索免费正版图库并插入，与 FUT-16 生图互补。spike 对比 API 限额 / 中文搜索质量 / 商用授权
- [x] **AiHubMix model 修正 + Provider 重写 + PPT casing 根治** — ✓ **Validated in Phase 14（MDL-01/02/03，2026-06-01）**：`aihubmix-image.ts` 重写为三模型三路 response 解析（doubao URL→base64 / gpt-image-2 b64_json / gemini inlineData，跳过 thoughtSignature）+ 两套鉴权（Bearer / x-goog-api-key）；registry 区分视觉 model（gpt-5.4）与三生图 model（默认 doubao-seedream-5.0-lite）+ 带 metadata 的 `IMAGE_GEN_MODELS` 供 Phase 16 picker 消费；PPT 工具 casing 中央归一化。三路真打 HTTP 200 × 3 + 791 tests green + bundle 75.03KB ≤82KB

> **已取消（不进任何后续 milestone，2026-05-30 用户决定）：** ~~ONB-01 / FUT-13 Onboarding GIF/动画~~ — v2.0 Phase 6 收单步 Onboarding 已移除承载位，心智锚定由 empty-state chips（ONB-03）+ 中文 humanLabel（ONB-02）承担，无需补回。

<details>
<summary>v1.0/v2.0 路线下的历史需求块（F1-F8 / A1-A5 / N1-N5 / MVP 平台）— 已全部在 v2.0 Validated 兑现，留作历史溯源</summary>

<!-- v1.0 scope FROZEN 2026-05-28 due to vision pivot to智能代理. F1-F8 below were drafted under PRD R1 (single-step tool); they are reviewed and tagged as 复用 / needs-replan after pivot. -->

**已实现并复用到代理愿景的基础能力（Phase 0-2.1 交付）**

- [x] **F1 Task Pane**（部分） — 右侧聊天面板 + 选中上下文 + 流式 + "插入到文档"（confirm/auto 二模式）。**代理愿景下保留**，需要扩 agent loop 状态机 + read tool UI
- [x] **F3 可插拔 Provider 架构** — 默认 DeepSeek + aihubmix，可新增 OpenAI 兼容 Provider。**代理愿景下保留**（多 tool 调用机制兼容）
- [x] **F5 设置与 Key 管理**（部分） — partitioned localStorage 存储（替代原 PRD F5 RoamingSettings 设想），首启 Onboarding 引导
- [x] **F6 流式输出** — 所有 LLM 调用 fetch streaming，首 token ≤ 2s。**代理愿景下保留**
- [x] **F7 错误处理** — Key 失效 / 配额超限 / context 超长 / 网络失败均给可操作提示
- [x] **F8 写回文档**（基础版本） — 三宿主 insert / replace API + tool-calling 接入。**代理愿景下扩展**：write tool 池从 1 个 → 多个（new_slide / edit_shape / apply_formula 等）

**FROZEN / needs-replan（v1.0 路线下的需求，转向后重新评估）**

- [ ] ~~**F2 Ribbon 6 个一键按钮**~~ — needs-replan：代理愿景下 ribbon 入口的角色是「快速进入特定 agent 模式」还是「保留传统单步操作」待定
- [ ] ~~**F4 文件上传与解析**~~ — needs-replan：代理愿景下文件仍是 context 输入源，解析路径基本不变，但 UX 接入方式（chat 附件 vs agent 自取）待重新设计
- [ ] ~~**PPT 杀手场景**（主题→大纲 / slide 配图 / bullet 压缩）~~ — needs-replan：原 plan-then-execute 思路在代理模式下要重写为 multi-step agent flow
- [ ] ~~**Excel 杀手场景**（自然语言→公式 / 解释 / 清洗）~~ — needs-replan：同上
- [ ] ~~**Word 杀手场景**（润色 / TL;DR / 大纲→长文）~~ — needs-replan：同上

**新增（代理愿景下的核心需求，等 spec 落定后细化为 Fn 编号）**

- [ ] **A1 Multi-step agent loop** — chat.ts 状态机支持「tool call → execute → push result → continue」循环，含 max_steps / token budget 终止条件
- [ ] **A2 Tool result feedback** — 把 adapter 执行结果（含失败原因）push 回 messages 让 LLM 看见，作为下一步决策依据
- [ ] **A3 Context-aware read tools** — 让 LLM 主动获取文档结构 / shape 元数据 / 选区详情等只读上下文
- [ ] **A4 失控控制 UX** — 每步用户可观察 / 暂停 / 中止；超预算自动停；隐私 read tool 逐项授权
- [ ] **A5 错误恢复协议** — multi-step 中间失败时 LLM 是否能 retry / 部分回滚 / 自我诊断

**非功能（PRD N1-N5）**

- [ ] **N1 跨平台 API 子集** — 只用 Office.js Web / Windows 都支持的 API
- [ ] **N2 包体积** — 初始加载 JS ≤ 1MB（解析库 + Provider SDK 懒加载）
- [ ] **N3 性能** — 单条 prompt 端到端 P95 ≤ 10s
- [ ] **N4 安全** — API Key 永不上传 Aster 自有服务器（无后台）
- [ ] **N5 隐私透明** — Onboarding + README 明确告知"选中内容会发往 Provider"

**MVP 平台**

- [ ] Office for Web（Edge / Chrome 最新两版）三宿主可 sideload 并正常运行

</details>

### Stretch（v1.1，明确不进 MVP）

- [ ] Excel 第 4 场景：选中数据 → 图表 + 三句话洞察
- [ ] Windows 桌面端兼容验证
- [ ] 英文 i18n

### Out of Scope

明确不做（PRD 已锁定 Non-Goals）：

- **Mac 桌面端** — v1 不验证；API 一致性不确认前不投入
- **iOS / Android Office 移动端** — Office.js 移动 API 限制大，投入产出不成立
- **企业 SSO / 账号体系 / Token 计费 / 订阅** — 开源副业定位，不做后台
- **自训练模型 / 模型微调** — 与 BYO Provider 路线冲突
- **AppSource 商店上架** — v1 仅 sideload + 开源仓库 manifest
- **VBA / Office Script 代码生成** — 与"一键操作"路线冲突
- **真人语音朗读 / PPT 自动演讲** — 超出 MVP 范围
- **协作能力（多人共编 / 评论）** — 与无后台架构冲突
- **聊天历史本地持久化** — v1 内存级；v1.1 评估 IndexedDB

## Context

**运营形态**：个人副业 / 开源项目，无后台服务、无账号体系、无计费。开源仓库 + sideload manifest 分发，社区驱动。

**模型与第三方集成**：
- LLM 主力：DeepSeek `deepseek-v4-pro`（OpenAI 兼容协议，HTTP 直连）
- LLM 轻量档：DeepSeek `deepseek-v4-flash`（短任务降本）
- 生图与视觉：aihubmix `gpt-image-2` + 同源多模态视觉模型
- 图库检索：Unsplash 或 Pexels（spike 阶段二选一 — Open Question Q1）

**Key 管理**：用户自带 API Key（BYO），存储在 Office RoamingSettings（用户级、不随文档共享、切 MS 账号会丢——符合预期）。

**目标用户**：中文职场白领——产品经理、运营、市场、销售、数据分析师、财务、HR、咨询顾问。每天 1 小时以上在 Office 内工作。技术门槛：能照 README 完成 sideload 安装、能在 DeepSeek/aihubmix 控制台拿 Key 粘贴到 Aster。

**竞品定位**：
- Microsoft Copilot — 强但贵且需企业订阅，中文调优一般
- WPS AI — 中文好但锁定 WPS，无法在原生 Office 用
- 网页版 ChatGPT/DeepSeek — 需复制粘贴，丢上下文，无法写回

Aster 填的是"原生 Office 内 + BYO Key + 开源透明"这个缝隙。

## Constraints

- **Tech — Host**: Office.js Add-in 架构 — 跨 PPT / Excel / Word 三宿主，使用 Web/Windows 共同支持的 API 子集（参考 Office.js capabilities matrix）
- **Tech — Frontend**: Task Pane 是浏览器内嵌 web view，构建产物必须是纯静态 + 浏览器可直连第三方 API
- **Tech — No Backend**: 零后台服务，所有 LLM/图像调用从用户浏览器直连 Provider —— 这是 Core Value 的硬约束，不可妥协
- **Tech — Bundle**: 初始 JS ≤ 1MB，解析库（mammoth/SheetJS/pdf.js）与 Provider SDK 必须懒加载
- **Performance**: P95 端到端 ≤ 10s，首 token ≤ 2s
- **Security**: API Key 永不离开用户浏览器到 Aster 自有服务器；存储在 Office RoamingSettings
- **Compatibility — MVP**: Office for Web（Edge / Chrome 最新两版）三宿主必须 sideload 正常
- **Compatibility — v1.1**: Windows Office Desktop 同 manifest 验证
- **Compatibility — Out**: Mac / iOS / Android 不在 v1 验证范围
- **Language**: UI 默认中文；英文 i18n 推迟到 v1.1
- **Distribution**: v1 仅 sideload + 开源仓库 manifest，不走 AppSource

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 主 LLM 选 DeepSeek-V4 而非 OpenAI/Anthropic | 中文场景质量好 + 价格低 + OpenAI 兼容协议（替换简单） | — Pending |
| 生图与视觉走 aihubmix 而非 DeepSeek | DeepSeek-V4 多模态能力待确认（Q6 spike），先用 aihubmix 解耦风险 | — Pending |
| Hybrid 形态：Ribbon 一键 + Task Pane 聊天 | 一键确定性动作 + 开放对话，覆盖"快"和"灵活"两种需求场景 | — Pending |
| BYO Key + Office RoamingSettings | 开源 + 无后台路线下唯一可行方案；用户级、跨文档可用 | — superseded by partitioned localStorage (Phase 0 spike) |
| MVP 只做 Office for Web | API 一致性最强、安装门槛最低、迭代最快；Desktop 推 v1.1 | — Pending |
| pptx 解析 MVP 仅提文本，不保真 | 浏览器侧 OOXML 全保真成本过高（R3）；不支持则降级到"不可上传 pptx" | — Pending |
| Provider 抽象层（Phase 2）作为后续所有 AI 调用基础 | 后续 4-7 phase 都依赖；质量门槛最高的基础模块 | — Delivered Phase 2 / 2.1 |
| Phase 0 spike 1 周时间盒 | 最高风险消减（R1/R2/R3）；spike 完才能决定 PPT 写回是否要降级 | — Delivered |
| **2026-05-28 Pivot：v1 从「AI 提效工具」扩展到「Office 智能代理」** | Phase 02.1 UAT 完成后明确：希望 Aster 能完成绝大部分 Office 工作（多步任务、精细操作、跨场景）。`plan-then-execute` 思路下 Phase 4-6 实现完 v2 又要推翻，性价比太低；最佳转向时机就是现在 | ✓ Good — PRD R1 superseded；Phase 0-2.1 复用，Phase 3-7 重写为 agent flows，v2.0 已交付 |
| **手写 agent loop（≤80 行 while + Zustand + AbortController），不引 XState** | 0 净新增运行时依赖硬约束 + bundle headroom；状态机简单到不值得框架 | ✓ Good — v2.0 交付，bundle 73.42 KB，loop.ts 稳定跑通 4 killer scenario |
| **inverse op 自写 undo，禁用 Office.js native undo** | PPT 无 `presentation.undo()` + Office undo stack 不透明 + 撞用户手动操作（PITFALLS A-03/A-09） | ✓ Good — 三宿主 inverse + before-image 比对 + undo-all 真机 UAT PASS |
| **max_steps=20 是 v2.0 唯一失控防御（cost cap / 隐私授权 UX 全砍）** | 早期用户 = 作者本人 + 亲人，授权/经费 UX = 过度工程；/gsd-discuss-phase 3 整批移除 PRIV-01..05 + AGENT-03..06 | ✓ Good — v2.0 交付未出现失控；扩用户后重评 |
| **2026-05-30 v2.0 收官：ONB-01 (Onboarding GIF) 主动 descope** | Phase 6 D-18/D-19 把 Onboarding 收成单步删 Step2Guide，GIF 承载位消失；心智锚定改由 empty-state chips + 中文 humanLabel 承担 | ⚠️ Revisit — 扩用户范围 / OSS 推广时补回（FUT-13） |
| **2026-05-30 v2.1：项目原则「AI 生成质量 >> token 成本 & 包体积」确立** | 自用 + 亲人早期用户场景下，生成质量远比省 token/省体积重要；NFR-07 由 `<3000 字符硬 CI gate`→软提醒、NFR-08 去掉 toolDefs ≤15KB token 门 | ✓ Good — v2.1 交付 42/42，bundle 仍 75.03 KB ≤82 KB；prompt 不为凑长度灌水 |
| **v2.1 工具合并设计合约 + undo 三分类（简单逆向/快照式/noop+gate）** | 工具更少更清晰 → AI 选工具更准（NFR-08 参数化合并）；每个新 write tool 先声明 undo 类型 + 配 `operationLog.integration.test` 守门，破坏性操作不裸奔 | ✓ Good — 23 工具全交付，13 完整 inverse + noop+gate 分类，守门当场抓出 batch 双重逆序 bug |
| **v2.1 PPT 网页版写操作「写后回读验证」(不假成功)** | 真机暴露 3 个 spike 工具网页版「假成功」（错属性名 + 只探测不验写生效）；改为写后回读，没生效诚实报「网页版未生效」不假 ✅ | ✓ Good — 诚实失败优于假成功；copy_slide 网页版微软接口不支持也据此诚实报错（转桌面版/v2.2） |
| **v2.1 收官引入 git tag：v2.1 + 回补 v2.0** | v1.0/v2.0 此前未打 tag（Q8），但两个公开发布应有版本锚点；从 v2.1 起引入 tag 惯例并回补 v2.0 @ f9fdcc4 | ✓ Good — 2026-06-01 |

## Open Questions（不阻塞 PRD，spike / UX / 后续 phase 解决）

- **Q1**：免费图库选 Unsplash vs Pexels（spike 对比 API 限额、中文搜索质量、商用授权）
- **Q2**：聊天历史本地持久化（IndexedDB）—— v1 不做，v1.1 评估
- **Q3**：英文 i18n 进度 —— v1.1
- **Q4**：v1 量化成功指标 —— 待项目作者补充（GitHub stars / 周活跃 sideload / 单次操作完成率）
- **Q5**：6 个 Ribbon 按钮的最终选型 —— UX 阶段做用户访谈或自身使用验证
- **Q6**：DeepSeek-V4 是否原生多模态 —— Phase 0 spike 从官方文档 + 实际 API 验证

### 新增（2026-05-28 Vision Pivot 引入，spec 阶段必须先答）

- **Q7 ✅ RESOLVED 2026-05-28**：**代理能力边界 = 仅单文档内多步**。Agent 只在用户当前打开的那一个 Office 文档（PPT / Excel / Word 其中之一）内执行多步任务——可以创建 slide / 编辑 shape / 填表 / 生成段落，但**不跨文档、不跨应用**。Office.js 三宿主能力 = 代理能力的硬上限。跨文档读 / 跨应用流程留到 v2.1+ 评估。
- **Q8 ✅ RESOLVED 2026-05-28**：**直接放弃 v1，专注 v2 agent**。v1 代码（Phase 0-2.1）作为 v2 基座保留在 main，但**不打 tag / 不写 release notes / 不写 sideload README**。Phase 2.2 / 3-7 全部释放给 v2 重写。代价：没有 v1 早期 feedback 循环，需要 v2 第一个 release 直接接住用户预期。
- **Q9 ✅ RESOLVED 2026-05-28，2026-05-28 修订**：**失控控制 = 宽松默认**。`max_steps = 20`（硬上限，不可绕过 fail-safe，v2.0 唯一失控防御）；agent 后台连续跑完一波再汇报，不阻断每步；用户可随时点「暂停」中止 in-flight。**原隐含责任 cost cap / cost meter 在 /gsd-discuss-phase 3 整批移除**（自用工具不做经费 UX）；保留 (1) pause + abort 始终可见；(2) step-by-step diff log（Phase 5）；(3) 一键 undo all（Phase 5）。详见 .planning/phases/03-agent-loop-privacy-word-demo/03-CONTEXT.md §D-20-21。
- **Q10 ✅ RESOLVED 2026-05-28，2026-05-28 完全推翻**：**隐私模型 = 完全开放**。Read tool 默认全开；文档全文可发给 LLM。**原隐含责任 PRIV-01..05 (Onboarding 授权 step / Settings opt-out / Provider allowlist / 切换 banner / PRIVACY.md) 在 /gsd-discuss-phase 3 整批移除**——理由：v2.0 早期用户 = 项目作者自己 + 亲人，不做授权 UX。未来扩用户范围 / OSS 公开后重新评估。详见 .planning/phases/03-agent-loop-privacy-word-demo/03-CONTEXT.md §D-17-19。
- **Q11 ✅ RESOLVED 2026-05-28**：**错误恢复 = 代理自决**。失败 tool 的 error message push 回 LLM，让 LLM 决定 retry/调参/skip/abort。**隐含责任**：(1) 死循环防护——max_steps=20 必须严守，否则 LLM 在错误里烧 ¥；(2) tool error 文案必须**结构化**（含 code / 可恢复性 hint），不能只是堆栈 dump，否则 LLM 推理不出原因；(3) 同一个 tool 重复失败 >2 次 Aster 强制 abort（不再让 LLM 自决）。
- **Q12**：**Phase 2.2 命运（Q8 已部分回答）** —— v1 放弃后，Phase 2.2 原 4 件 UAT follow-up：(a) FU-01 首次取选区是 v1 现有 bug，v2 也会受影响——**应嵌入 v2 实现**；(b) FU-02 model 下拉 UX 优化——**嵌入 v2 重写**；(c) FU-03 copy chat 是 debug 工具——**嵌入 v2 重写**；(d) FU-04 Excel 回归——**不再需要**（v1 放弃 = v1 的 UAT 验收意义减弱，Excel auto 写入在 v2 测试期重新覆盖即可）。**结论：Phase 2.2 整体取消**，4 件事并入 v2 规划。

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-01 — **Milestone v2.2「多模态四件套」started**（`/gsd-new-milestone`）。MM-01 视觉看图 / MM-02 文件上传解析 / MM-03 图片生成插入 / MM-04 公开图库检索 / MM-05 AiHubMix model 修正。用户新增第三个生图模型 `doubao-seedream-5.0-lite`；三模型三套 wire format 已实测存档（spike 011：doubao predictions/URL + gpt-image-2 predictions/base64 + gemini streamGenerateContent/base64）。Phase 编号从 14 续接（非 reset），选择「先调研」。技术债候选：PPT casing 中央归一化。*

*Phase 14 complete 2026-06-01 — MDL（AiHubMix Provider 重写 + model 修正 + PPT casing 根治）交付并验证 PASS（7/7 must-haves，6/6 plans，791 tests，bundle 75.03KB）。v2.2 进度 1/6，下一站 Phase 15 VIS 视觉看图。*
*Earlier: 2026-06-01 — **Milestone v2.1「从能用到好用」收官归档**。6 phases（8–13）/ 27 plans / 75.03 KB bundle / 773 tests green / 0 净新增依赖，三宿主真机 UAT 全 PASS，42/42 需求交付，线上 `2c0201e`（tag `v2.1`，回补 `v2.0` @ `f9fdcc4`）。A–F 全部移入 Validated；v1.0/v2.0 路线遗留需求块折叠归档。项目原则「质量 >> 成本&包体积」确立。已知限制：PPT copy_slide 网页版微软接口不支持（转 v2.2/桌面版）。*
*Earlier: 2026-05-30 — **Milestone v2.1「从能用到好用」started**（A–F：per-host prompt + Skills 调研 + 偏好注入 / Office.js write tool 补全 triage / 批量操作 / Word 选区坐标 / UI 打磨 / 聊天记录持久化）。G 多模态四件套拆为 v2.2；ONB-01/FUT-13 Onboarding GIF 取消。Phase 编号从 8 续接。*
*Earlier: 2026-05-30 — **v2.0「Office 智能代理」milestone 收官归档**。6 phases / 53 plans / 295 commits / 73.42 KB bundle，4 killer scenario 三宿主真机 UAT 全 PASS，线上 `f9fdcc4` 首次公开发布。31 需求交付 30（ONB-01 当时 descope，现取消）。所有 A1-A5 + N1-N5 + TOOL/ERR/CARRY/ONB-02/03 validated。*
*Earlier: 2026-05-30 — Phase 5（Diff Log + Undo All 跨 3 宿主）完成：OperationLog + 三宿主 inverse op + DiffLogPanel 汇总卡（humanLabel）+ per-step/undo-all + Word 手改防御 + copy step log 脱敏，三宿主真机 UAT 全 6 SC PASS，线上 d68303b。*
*Earlier: 2026-05-28 — Milestone v2.0 "Office 智能代理" started; v1.0 frozen at Phase 2.1 as v2 基座; v2.0 roadmap continues from Phase 3; same-day revision via /gsd-discuss-phase 3: PRIV-01..05 + cost (AGENT-03/04/05/06 + v1 COST-01/02) 整批移除*
