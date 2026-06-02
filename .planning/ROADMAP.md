# Roadmap: Aster

**Core Value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 **AI 代理** 能力，能完成绝大部分文档工作（多步任务、精细化操作）；无后台、BYO Key、纯浏览器直连。

## Milestones

- ✅ **v1.0 已交付的基座** — Phases 0 / 1 / 2 / 2.1（spike + foundation + Provider 抽象 + UAT gap closure）— 作为 v2 基座保留，未单独发布（Q8）
- ✅ **v2.0 Office 智能代理** — Phases 3 / 4 / 04.1 / 5 / 6 / 7（shipped 2026-05-30，线上 `f9fdcc4`，tag `v2.0`，首次公开发布）
- ✅ **v2.1 从能用到好用** — Phases 8 / 9 / 10 / 11 / 12 / 13（shipped 2026-06-01，线上 `2c0201e`，tag `v2.1`，三宿主真机 UAT 全 PASS）
- 🚧 **v2.2 多模态四件套**（in progress，started 2026-06-01）— Phases 14–19；视觉看图 / 文件上传解析 / 图片生成插入 / 公开图库检索 + AiHubMix model 修正 + PPT casing 根治（22 需求）

## Phases

<details>
<summary>✅ v1.0 已交付的基座 (Phases 0–2.1) — 未单独发布，作为 v2 基座</summary>

完整内容见 [`ROADMAP-v1.0.md`](ROADMAP-v1.0.md)。

- [x] Phase 0: Spike & 风险验证（CORS / PPT 写回 / 存储 scope 三项 GATING + 7 项实证）
- [x] Phase 1: Foundation 与跨宿主骨架（Vite 7 + React 19 + TS strict + DocumentAdapter + 三宿主 adapter + 错误类层级 + bundle CI + i18n + Vitest + GitHub Pages）
- [x] Phase 2: Provider 抽象 + Settings + Onboarding + 错误 UX（OpenAI-compat + aihubmix + partitioned localStorage + 8 类错误 UX + SSE 流式 + 三宿主 insert）
- [x] Phase 2.1: UAT Gap Closure（滚动/对齐/流式滚到底/错误分类/AI tool-calling 写文档/选区胶囊 toggle 等 8 条 gap）

**v1.0 取消项：** Phase 2.2 整体取消（PROJECT.md Q12 / Q8）；3 件 UAT follow-up 转嫁 v2.0（CARRY-01..03）。

</details>

<details>
<summary>✅ v2.0 Office 智能代理 (Phases 3–7) — SHIPPED 2026-05-30，线上 f9fdcc4，tag v2.0</summary>

完整内容见 [`milestones/v2.0-ROADMAP.md`](milestones/v2.0-ROADMAP.md)。需求存档见 [`milestones/v2.0-REQUIREMENTS.md`](milestones/v2.0-REQUIREMENTS.md)。

- [x] Phase 3: Agent Loop 地基 + Word 多步 demo（9 plans）— completed 2026-05-29
- [x] Phase 4: Read Tools 全套 + AgentControlBar 步骤文案（9 plans）— completed 2026-05-29
- [x] Phase 04.1: Aster redesign migration — teal 克制设计系统迁移（7 plans, INSERTED）— completed 2026-05-29
- [x] Phase 5: Diff Log + Undo All 跨 3 宿主（10 plans）— completed 2026-05-30
- [x] Phase 6: 多宿主 Write Tools + Killer Scenarios 重写（12 plans）— completed 2026-05-30
- [x] Phase 7: UAT + Sideload Release Prep（6 plans）— completed 2026-05-30 = 首次公开发布

**Requirements:** 31 项交付 30（ONB-01 Onboarding GIF 主动 descope → 已取消）。

</details>

<details>
<summary>✅ v2.1 从能用到好用 (Phases 8–13) — SHIPPED 2026-06-01，线上 2c0201e，tag v2.1</summary>

完整内容见 [`milestones/v2.1-ROADMAP.md`](milestones/v2.1-ROADMAP.md)。需求存档见 [`milestones/v2.1-REQUIREMENTS.md`](milestones/v2.1-REQUIREMENTS.md)。

- [x] Phase 8: Foundation + 能力 A + 持久化 F（5 plans）— per-host domain prompt + 用户偏好注入（injection 防御）+ 聊天记录持久化 — completed 2026-05-31
- [x] Phase 9: Word 精准写 (D + B-Word)（7 plans）— Word 5 write tool + WSEL-01 选区精度（paragraphIndex + uniqueLocalId）— completed 2026-05-31
- [x] Phase 10: Excel + PPT 工具完整 (B-Excel + B-PPT)（5 plans）— Excel 10 + PPT 8 工具 + spikes S1-S4/S7 + undo 基础设施 — completed 2026-05-31
- [x] Phase 11: 批量操作 (C)（5 plans）— batch_write 单闭包单 sync + batch_reverse 整批 undo + 可展开批量卡 — completed 2026-05-31
- [x] Phase 12: UI 打磨 (E)（5 plans）— XSS 防御 + loading 气泡 + DiffLog 跟随 loop + 表格 CSS + 读卡降权 + 骨架屏 — completed 2026-05-31
- [x] Phase 13: v2.1 UAT + Release — A–F 六大能力三宿主真机端到端 UAT 全 PASS + 已发布 — completed 2026-06-01

**Requirements:** 42/42 全部交付（三宿主真机 UAT 全 PASS）。**已知限制：** PPT copy_slide 网页版微软接口不支持（诚实失败，转 v2.2/桌面版）。

</details>

### 🚧 v2.2 多模态四件套 (Phases 14–19, in progress — started 2026-06-01)

研究基线：[`research/SUMMARY.md`](research/SUMMARY.md)；生图 wire format：[`spikes/011-image-gen-api-formats/findings.md`](spikes/011-image-gen-api-formats/findings.md)。每个新 write/插图工具沿用 v2.1 合约（先声明 undo 类型 + 配 `operationLog.integration.test` 守门）。决策：Pexels BYO key / 视觉直接 aihubmix-vision（不验 DeepSeek 原生多模态）/ PPT casing 纳入 Phase 14 根治 / **图片上传（FILE-06）前移 Phase 15 归「视觉看图」，Phase 17 专做 docx·xlsx·pdf·pptx 文本解析（discuss-phase 15）**。

- [x] **Phase 14: MDL — AiHubMix Provider 重写 + model 修正 + PPT casing 根治**（6 plans）— completed 2026-06-01
- [x] **Phase 15: VIS — 视觉看图**（5 plans，4 waves）（选中文档图 + 上传图片；FILE-06 前移入此） (completed 2026-06-02)
- [ ] **Phase 16: IMG — 图片生成插入（PPT + Word）**
- [ ] **Phase 17: FILE — 文件上传与解析（docx/xlsx/pdf/pptx）**
- [ ] **Phase 18: LIB — 公开图库检索（Pexels, BYO key）**
- [ ] **Phase 19: v2.2 UAT + Release**

**Phase Dependencies:** 14 →（15 ∥ 16，皆依赖 14）→ 17（依赖 15 的 vision）→ 18（依赖 16 的 insert helper）→ 19（依赖全部）。单人串行推荐：14 → 15 → 16 → 17 → 18 → 19。

**Coverage:** 22/22 ✓（见 REQUIREMENTS.md §Traceability）

---

### Phase 14: MDL — AiHubMix Provider 重写 + model 修正 + PPT casing 根治

**Goal**: 重写 `aihubmix-image.ts` 为三模型三路 response 解析（base64 统一 + 两套鉴权 + gemini 端点族），修正 model 清单，PPT 工具 casing 中央归一化——解锁所有下游 image/vision 工具。
**Requirements**: MDL-01, MDL-02, MDL-03
**Depends on**: —（基座，最先）
**Plans**: 6 plans（4 waves）
- **Wave 1** *(并行，无前置)*
  - [x] 14-01-PLAN.md — types.ts 接口契约（ImageGenResult）+ Wave 0 fixture/test scaffold
  - [x] 14-02-PLAN.md — ppt.ts snake_case schema 统一 + 删 pick* helpers
- **Wave 2** *(blocked on Wave 1)*
  - [x] 14-03-PLAN.md — registry.ts IMAGE_GEN_MODELS + gpt-5.4 + aihubmix-vision.ts model 对齐 *(依赖 14-01)*
  - [x] 14-04-PLAN.md — dispatchTool 中央 normalize + dispatch.test.ts PPT casing 守门 *(依赖 14-02)*
- **Wave 3** *(blocked on Wave 2)*
  - [x] 14-05-PLAN.md — aihubmix-image.ts 三路解析器完整重写 *(依赖 14-01, 14-03)*
- **Wave 4** *(blocked on Wave 3)*
  - [x] 14-06-PLAN.md — 一次性真打三路 smoke + fixture 录制 + bundle gate *(依赖 14-05, 14-04；含 human-verify checkpoint)*

**Cross-cutting constraints**: apiKey 仅进 header 不入 body/error.message（T-14-01）；裸 base64 返回契约 `{ base64, mimeType }`（D-01/D-04）；0 净新增运行时依赖、bundle ≤82KB；CI 永不打真 API（fixture 守门 D-15）。

**Success Criteria**:
1. 三个生图 model 各真请求一次，response 都被正确解析为统一裸 base64（无 `data:` 前缀）+ 独立 mimeType（返回 `{ base64, mimeType }`，对齐 D-04；doubao URL→fetch 转 / gpt-image-2 b64_json / gemini inlineData，跳过 thoughtSignature）
2. registry/pricing model 清单区分视觉 model（/v1/models 验证 id）与三生图 model，默认生图 = doubao-seedream-5.0-lite
3. PPT 工具参数经 dispatch 层中央归一化，移除散落双键容错，守门用例通过（snake/camel 任一传参都正确）
4. 三路 provider smoke test + 全量 npm test green，bundle ≤82KB

---

### Phase 15: VIS — 视觉看图

**Goal**: 所有「看图」能力——agent 既能「看」当前文档里**选中**的图片/图表（`get_shape_image` read tool，带可选 focus 参数），也能「看」用户**上传/粘贴**的图片（FILE-06 从 Phase 17 前移）；两路都走已就位的 aihubmix-vision（gpt-5.4）、返回**文本**作 evidence，图片 base64 不进主 LLM 消息层。
**Requirements**: VIS-01, VIS-02, FILE-06, NFR-09
**Depends on**: Phase 14（vision model 路由 / gpt-5.4 已就绪）
**Spike（开工先跑）**: PPT/Excel/Word 取选中图为 base64（`shape.image.getBase64ImageData()` 等）在 Office for Web 真机；失败 fallback **引导改用回形针上传**（本阶段已交付图片上传，无需等 Phase 17）
**Success Criteria**:
1. 选中 PPT 图片/图表 / Excel 图表 / Word inline picture → 提问 → agent 自动调 `get_shape_image`（带可选 focus）携图调 aihubmix-vision 并据图作答；选中多个取第一张并提示
2. 经回形针按钮/粘贴上传图片（多张、png/jpg/webp）→ agent 据图作答；上传图本会话内可多轮复用（内存态，刷新即丢）
3. 三类失败给结构化错误（不是图/取图挂/没配 aihubmix key），不假成功；非图片文件诚实提示「文件解析即将开放」（Phase 17）
4. base64 图片字节**不写入** persisted 聊天历史（serialize 守门用例通过 = NFR-09）
**Plans**: 5 plans（4 waves）
- **Wave 1** *(并行，无前置)*
  - [x] 15-01-PLAN.md — aihubmix-vision 多图扩展 + DocumentAdapter get_shape_image kind + 测试脚手架
- **Wave 2** *(blocked on Wave 1；02 与 03 可并行)*
  - [x] 15-02-PLAN.md — get_shape_image read tool + 三宿主 adapter case + tools 注册（VIS-01/VIS-02）
  - [x] 15-03-PLAN.md — InputBar 回形针激活 + attachments store + chat.ts sendMessage vision 注入（FILE-06）
- **Wave 3** *(blocked on Wave 2)*
  - [x] 15-04-PLAN.md — NFR-09 serialize-test 守门 + bundle size gate
- **Wave 4** *(blocked on Wave 3；含 human-verify checkpoint)*
  - [x] 15-05-PLAN.md — 三宿主取图/粘贴 spike 真机验证 + UAT

**Cross-cutting constraints**: base64 不进 message.content 也不进 serializeForStorage（D-12/NFR-09 设计契约）；apiKey 仅进 header（T-14-01 继承）；三类结构化错误 UX（D-13）；PPT 取图为 Preview API spike，失败 fallback 引导回形针上传（D-07）；零新增 npm 依赖、bundle ≤82KB。

---

### Phase 16: IMG — 图片生成插入（PPT + Word）

**Goal**: PPT/Word「生成一张图并插入」write tool，预览后确认，model 可选。
**Requirements**: IMG-01, IMG-02, IMG-03, IMG-04, IMG-05
**Depends on**: Phase 14（生图 provider）
**Spike（开工先跑）**: PPT 插图 API（`shapes.addImage` BETA vs `setSelectedDataAsync` GA）+ 写后回读验证（防 v2.1「假成功」重演）
**Success Criteria**:
1. PPT「生成一张 X 的图插到这页」→ 预览 → 确认 → 插入当前 slide，undo（deleteShape）可撤
2. Word 同等生图插入（insertInlinePictureFromBase64 body 级），undo 诚实标 noop
3. 可切生图 model + 一键重新生成；Excel 诚实报「不支持插图」（IMG-05）
4. 产出可复用 insert helper（供 Phase 18）；图片 base64 不进 history

**Plans**: 5 plans（4 waves，含 Wave 0 测试脚手架 + Wave 1 真机 spike）
- **Wave 0** *(先行，无前置)*
  - [x] 16-01-PLAN.md — 测试脚手架（ppt-image/word-image test + operationLog 守门 + NFR-09 路径 C + tools-host）
- **Wave 1** *(blocked on Wave 0；含 human-verify spike checkpoint)*
  - [x] 16-02-PLAN.md — PPT/Word adapter 插图方法 + insertImage helper + PPT GA 路线真机 spike *(依赖 16-01)*
- **Wave 2** *(blocked on Wave 1；02 与 03 可并行)*
  - [x] 16-03-PLAN.md — generate_ppt/word_image ToolDef + PPT_TOOLS + buildToolsForHost 注册（IMG-01/02/05）*(依赖 16-02)*
  - [x] 16-04-PLAN.md — Settings 生图 model picker + registry image-gen model 覆盖（IMG-04）*(依赖 16-02)*
- **Wave 3** *(blocked on Wave 2；含 human-verify UAT checkpoint)*
  - [ ] 16-05-PLAN.md — ImagePreviewCard UI + ChatBubble 集成 + 真机 UAT（IMG-03/04）*(依赖 16-03, 16-04)*

**Cross-cutting constraints**: base64 不进 message.content/serializeForStorage（NFR-09）；apiKey 仅 header（T-14-01 继承）；三类结构化错误 ；PPT 写后回读验证（memory project_ppt_officejs_gotchas）；零新增 npm 依赖；bundle ≤82KB gzip；generate_ppt_image 加入 PPT_TOOLS Set（Phase 14 D-10 casing 根治守门）。

---

### Phase 17: FILE — 文件上传与解析（docx/xlsx/pdf/pptx）

**Goal**: 把 Phase 15 已激活的回形针上传从「仅图片」推广到 docx/xlsx/pdf/pptx → 懒加载解析为文本 → 注入 agent context；明确附件 vs 自取文档边界。（图片附件 FILE-06 已前移至 Phase 15。）
**Requirements**: FILE-01, FILE-02, FILE-03, FILE-04, FILE-05, FILE-07, NFR-10
**Depends on**: Phase 15（复用其回形针上传入口 + 附件基础设施；本阶段加文档解析库）
**Spike（开工先跑）**: pdf.js worker 在 Vite + GitHub Pages（CSP）真机（仅部署后暴露）
**Success Criteria**:
1. 📎 上传 docx/xlsx/pdf/pptx → 解析文本注入 prompt，agent 据附件内容作答；附件 chip 标「仅供 AI 阅读」
2. 附件（只读快照、不可写回）vs agent 自取当前文档（live、可写回）UX 边界清晰（FILE-07）
3. 解析库全懒加载，初始 bundle 0 增量 ≤82KB（NFR-10）；mammoth 版本锁 ≥1.11.0 + npm audit green

---

### Phase 18: LIB — 公开图库检索（Pexels, BYO key）

**Goal**: Pexels 检索免费正版图并插入，复用 Phase 16 insert helper。
**Requirements**: LIB-01, LIB-02, LIB-03
**Depends on**: Phase 16（insert helper）
**Spike（开工先跑，本里程碑最高风险）**: Pexels CORS 在 Office Web iframe 三浏览器实测；失败触发无后台原则重评（见 memory `project_no_backend_status`）
**Success Criteria**:
1. Settings 填 BYO Pexels key → 检索（locale=zh-CN）返缩略图网格
2. 选中图片插入 PPT/Word（复用 insert helper）
3. chat 内显示摄影师署名 + 链接（不在插入图片上叠水印）

---

### Phase 19: v2.2 UAT + Release

**Goal**: 四件套三宿主 Office for Web（Chrome/Edge）真机端到端 UAT + 发布 tag v2.2。
**Requirements**: （覆盖全部 22 个 v2.2 需求的 UAT 验证；0 独立新需求）
**Depends on**: Phases 14–18
**Success Criteria**:
1. 视觉/附件全宿主 + 生图/图库 PPT·Word 真机 UAT 全 PASS（Chrome × Edge）
2. bundle ≤82KB、P95≤10s、npm test green、0 净新增初始依赖
3. 部署 GitHub Pages + tag v2.2

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 0. Spike & 风险验证 | v1.0 | — | Complete | (v1 base) |
| 1. Foundation 跨宿主骨架 | v1.0 | — | Complete | (v1 base) |
| 2. Provider + Settings + Onboarding | v1.0 | — | Complete | (v1 base) |
| 2.1 UAT Gap Closure | v1.0 | — | Complete | (v1 base) |
| 3. Agent Loop 地基 + Word demo | v2.0 | 9/9 | Complete | 2026-05-29 |
| 4. Read Tools 全套 + AgentControlBar | v2.0 | 9/9 | Complete | 2026-05-29 |
| 04.1 teal 设计系统迁移 | v2.0 | 7/7 | Complete | 2026-05-29 |
| 5. Diff Log + Undo All 跨 3 宿主 | v2.0 | 10/10 | Complete | 2026-05-30 |
| 6. 多宿主 Write Tools + Killer Scenarios | v2.0 | 12/12 | Complete | 2026-05-30 |
| 7. UAT + Sideload Release Prep | v2.0 | 6/6 | Complete | 2026-05-30 |
| 8. Foundation + 能力 A + 持久化 F | v2.1 | 5/5 | Complete | 2026-05-31 |
| 9. Word 精准写 (D + B-Word) | v2.1 | 7/7 | Complete | 2026-05-31 |
| 10. Excel + PPT 工具完整 (B-Excel + B-PPT) | v2.1 | 5/5 | Complete | 2026-05-31 |
| 11. 批量操作 (C) | v2.1 | 5/5 | Complete | 2026-05-31 |
| 12. UI 打磨 (E) | v2.1 | 5/5 | Complete | 2026-05-31 |
| 13. v2.1 UAT + Release | v2.1 | — | Complete | 2026-06-01 |
| 14. MDL Provider 重写 + PPT casing | v2.2 | 6/6 | Complete    | 2026-06-01 |
| 15. VIS 视觉看图 | v2.2 | 5/5 | Complete    | 2026-06-02 |
| 16. IMG 图片生成插入 | v2.2 | 4/5 | In Progress|  |
| 17. FILE 文件上传解析 | v2.2 | 0/? | Not started | — |
| 18. LIB 图库检索 | v2.2 | 0/? | Not started | — |
| 19. v2.2 UAT + Release | v2.2 | — | Not started | — |

---

*Last updated: 2026-06-01 — discuss-phase 15：① 补全 v2.2（14–19）`### Phase N:` 详情段（原内联生成只有摘要清单格式，触发 SDK malformed_roadmap）；② FILE-06「图片上传附件」从 Phase 17 前移 Phase 15，与 VIS 统一为「视觉看图」，Phase 17 收窄为 docx/xlsx/pdf/pptx 解析（映射 15:3→4 / 17:8→7，总数仍 22）。*
*Earlier: 2026-06-01 — Phase 14 计划创建（6 plans，4 waves）。*
*Earlier: 2026-06-01 — 🚧 **v2.2「多模态四件套」roadmap 创建**（Phases 14–19，inline 生成——roadmapper subagent 写 report 类文件被 harness 钩子拦截，由主 agent 落盘）。22 需求映射 6 phase：14 MDL Provider 重写+PPT casing 根治 → 15 VIS 视觉 → 16 IMG 生图插入 → 17 FILE 文件解析 → 18 LIB Pexels 图库 → 19 UAT+Release。4 个 spike gate（PPT 取图 / PPT 插图 API / pdf.js worker / Pexels CORS）。研究见 `research/SUMMARY.md`，生图格式见 `spikes/011`。*
*Earlier: 2026-06-01 — ✅ **v2.1「从能用到好用」已归档**。3 个 milestone（v1.0 基座 / v2.0 / v2.1）全部折叠归档，phase 明细见各 `milestones/v{X.Y}-ROADMAP.md`。v2.1：6 phase / 27 plans / 75.03 KB bundle / 773 tests green / 42/42 需求 / 三宿主真机 UAT 全 PASS / tag `v2.1`（回补 `v2.0`）。*
