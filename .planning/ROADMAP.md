# Roadmap: Aster

**Core Value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 **AI 代理** 能力，能完成绝大部分文档工作（多步任务、精细化操作）；无后台、BYO Key、纯浏览器直连。

## Milestones

- ✅ **v1.0 已交付的基座** — Phases 0 / 1 / 2 / 2.1（spike + foundation + Provider 抽象 + UAT gap closure）— 作为 v2 基座保留，未单独发布（Q8）
- ✅ **v2.0 Office 智能代理** — Phases 3 / 4 / 04.1 / 5 / 6 / 7（shipped 2026-05-30，线上 `f9fdcc4`，tag `v2.0`，首次公开发布）
- ✅ **v2.1 从能用到好用** — Phases 8 / 9 / 10 / 11 / 12 / 13（shipped 2026-06-01，线上 `2c0201e`，tag `v2.1`，三宿主真机 UAT 全 PASS）
- ✅ **v2.2 多模态四件套** — Phases 14 / 15 / 16 / 17 / 18 / 19（shipped 2026-06-03，线上 `0d5fccf`，tag `v2.2`）— 视觉看图 / 文件上传解析 / 图片生成插入 / 公开图库检索 + AiHubMix model 修正 + PPT casing 根治（22 需求）；真机 UAT 全 PASS（pdf.js worker CSP + Pexels 双重 CORS 含 M-1 取图面 + 四件套冒烟，M-1 未坐实无需 Worker）
- ✅ **v2.3 精装与定力** — Phases 20 / 21 / 22 / 23 / 24（shipped 2026-06-05，线上 `1fe9529`，tag `v2.3`）— A PPT 视觉质量纵深（设计 token + 几何自查 + apply_slide_layout 盖印章 + 6 版式库 + 自渲染预览自查）+ B 上下文/抗幻觉（时钟脱前缀 + token 水位摘要压缩 + 抗幻觉指引）（13 需求）；三宿主真机 UAT 全过（11 个真机 bug 全修），PVQ-06 spike-gate 判铺开
- 🚧 **v2.4 扩疆域** — Phases 25 / 26 / 27 / 28 / 29（started 2026-06-05）— WPS spike-gate 探路 + C 工具补全三宿主 ~11 个 + 配置导入导出（17 需求）

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

<details>
<summary>✅ v2.2 多模态四件套 (Phases 14–19) — SHIPPED 2026-06-03，线上 0d5fccf，tag v2.2</summary>

完整内容见 [`milestones/v2.2-ROADMAP.md`](milestones/v2.2-ROADMAP.md)。需求存档见 [`milestones/v2.2-REQUIREMENTS.md`](milestones/v2.2-REQUIREMENTS.md)。

- [x] Phase 14: MDL — AiHubMix Provider 重写 + model 修正 + PPT casing 根治（6 plans）— aihubmix-image 三路解析（doubao/gpt-image-2/gemini）+ 两套鉴权 + 视觉/生图 model 清单 + dispatch 层 casing 归一化（清 v2.1 技术债）— completed 2026-06-01
- [x] Phase 15: VIS — 视觉看图（5 plans）— `get_shape_image` 第 12 read tool（三宿主取选中图）+ 回形针/粘贴上传图（FILE-06 前移）→ 都走 aihubmix-vision 返文本 evidence，base64 不进 history（NFR-09）— completed 2026-06-02
- [x] Phase 16: IMG — 图片生成插入（PPT + Word）（5 plans）— `generate_ppt/word_image` write tool，AI loop 内**自动直插**（设计反转）+ 只读结果卡 + model 可选；insert helper 供 Phase 18 复用 — completed 2026-06-02
- [x] Phase 17: FILE — 文件上传与解析（6 plans）— docx/xlsx/pdf/pptx 四解析库全懒加载（0 净新增初始 bundle）+ 附件 vs 自取文档 UX 边界 — completed 2026-06-02
- [x] Phase 18: LIB — 公开图库检索（Pexels, BYO key）（3 plans）— Settings BYO key 检索 + 缩略图网格选中插入（复用 insert helper）+ 摄影师署名 — completed 2026-06-03
- [x] Phase 19: v2.2 UAT + Release — 四件套三宿主真机 UAT 全 PASS（pdf.js worker CSP + Pexels 双重 CORS）+ 已发布 — completed 2026-06-03

**Requirements:** 22/22 全部交付（三宿主真机 UAT 全 PASS）。**真机 UAT 两高危均解：** HR-1 pdf.js worker 在 GitHub Pages base + Office iframe CSP 下加载成功；HR-2 Pexels 双重 CORS（检索面 + M-1 取图面）均放行，**M-1 未坐实、无需 Cloudflare Worker**。**已知限制：** PPT 取选中图 Preview API 未 GA（Office for Web）→ fallback 引导上传。

</details>

<details>
<summary>✅ v2.3 精装与定力 (Phases 20–24) — SHIPPED 2026-06-05，线上 1fe9529，tag v2.3</summary>

完整内容见 [`milestones/v2.3-ROADMAP.md`](milestones/v2.3-ROADMAP.md)。需求存档见 [`milestones/v2.3-REQUIREMENTS.md`](milestones/v2.3-REQUIREMENTS.md)。

- [x] Phase 20: B 快赢——时钟脱前缀 + 守门（1 plan）— 时钟从 system 前缀迁到 user message 末尾，前缀变静态，结构性守门防回退（CTX-01/02）— completed 2026-06-03
- [x] Phase 21: B 核心——摘要压缩 + 抗幻觉（2 plans）— token 水位摘要压缩 compaction + `[system][摘要]` 稳定缓存前缀 + version:2 持久化 + applyHistoryBackstop 截断重审 + 三宿主抗幻觉指引（CTX-03/04/05/06）— completed 2026-06-03
- [x] Phase 22: A P0 基座——设计 token + 几何自查（1 plan）— `ppt-tokens.ts` 结构 token（配色不锁死）+ `geometry-check.ts` 四项确定性自查 + `check_slide_layout` read 工具（PVQ-01/02）— completed 2026-06-03
- [x] Phase 23: A P1 主力——盖印章工具 + 版式库 + prompt 重写（2 plans）— `apply_slide_layout` (B)create+fill write 工具 + `ppt-layouts.ts` 6 套固化版式 + PPT 领域段 prompt 重写（PVQ-03/04/05）— completed 2026-06-03
- [x] Phase 24: A P2 自渲染预览 + bundle 守门（4 plans）— `SlidePreviewPanel`（React.lazy）+ html2canvas 懒加载截图 → aihubmix-vision 自查闭环 + bundle CI gate 维持（PVQ-06/NFR-11）— completed 2026-06-03

**Requirements:** 13/13 全部交付（三宿主 Office for Web 真机 UAT 全过，11 个真机 bug 全修）。**PVQ-06 spike-gate 真机判铺开**（`PVQ06_VISUAL_CHECK_ENABLED=true`）。**已知 follow-up（不阻塞）：** WR-02（`visual_check_slide` slideIndex 入参被忽略）/ WR-03（多预览面板 identity 守卫），单 layout 无影响。

</details>

### 🚧 v2.4 扩疆域（进行中）

**Milestone Goal:** 一手扩 Aster「能改的范围」（C 工具补全三宿主 ~11 个高价值 write 工具），一手探「能跑的平台」（WPS Windows 桌面版 spike-gate 可行性裁定），并打通「配置可移植」（明文 JSON 导入导出，解换机/换宿主重输地狱）。

**横切约束（贯穿所有 phase）：** 初始 bundle CI gate ≤82KB gzip（余量 ~0.7KB，很紧）；新功能/重模块必须懒加载；每个 phase 成功标准均含 bundle gate 验收。

- [ ] **Phase 25: WPS spike-gate** - WPS Windows 桌面版可行性调研（Claude 出调研报告）+ 真机验证（用户在 Windows+WPS 实测），出 go/no-go 裁定
- [ ] **Phase 26: 配置导入导出** - 明文 JSON 文件导出/导入全部持久化配置（含 API keys），醒目安全警告，Settings UI 遵循 teal 克制设计系统；复用 v2.2 FILE 上传基建（独立于 C 工具线，提前交付高频"换机搬家"实用价值）
- [ ] **Phase 27: Word 工具补全** - 五个高价值 Word write 工具：高亮/列表/批注/页眉页脚/edit_table，全部按既有合约（inverse Record + PostStateSnapshot kind + operationLog.integration 守门）
- [ ] **Phase 28: Excel 工具补全** - 三个高价值 Excel write 工具：合并单元格/删除重复项/数据透视表，含 Office for Web API 可用性前验（EXCEL-13 透视表降级门控）
- [ ] **Phase 29: PPT 工具补全 + NFR-12 收口** - 三个高价值 PPT write 工具：插入表格/线条箭头/渐变填充，含 API 可用性前验（三工具均标 API 风险，部分可能诚实降级）；末位 phase 承接 NFR-12 bundle gate ≤82KB 全里程碑收口

## Phase Details

### Phase 25: WPS spike-gate
**Goal**: 团队拿到 WPS Windows 桌面版 Office.js 兼容性的完整调研报告和真机验证结论，能做出有根据的 go/no-go 裁定
**Depends on**: Phase 24（v2.3 已交付）
**Requirements**: WPS-01, WPS-02
**Success Criteria** (what must be TRUE):
  1. 调研报告已产出：涵盖 WPS 加载项架构、Office.js manifest 支持程度、`PowerPoint.run`/`Excel.run`/`Word.run` 兼容性、sideload 机制、已知限制、社区/官方证据
  2. 调研报告给出初步 go/no-go 信号，并附真机验证清单（用户在 Windows+WPS 需实测的具体项目）
  3. 用户在 Windows + WPS 桌面版完成真机 sideload + 三宿主 `run()` API 实测，记录跑通/跑挂清单
  4. 最终 go/no-go 裁定已明确：go 时附适配工作量估算；no-go 时里程碑照常 ship C+配置两条线
  5. WPS-02 真机验证层可与 Phase 26–28 并行异步进行（不阻塞里程碑其它工作）
**Plans**: TBD

### Phase 26: 配置导入导出
**Goal**: 用户能在 Settings 一键导出全部持久化配置为 JSON 文件、在新机器/新浏览器/新宿主上传导入，附醒目安全警告，彻底解决换机/换宿主重输地狱
**Depends on**: Phase 24（v2.3 已交付）；功能独立于 C 工具线，复用 v2.2 FILE 上传基建 → 提前交付高频"换机搬家"实用价值
**Requirements**: CFG-01, CFG-02, CFG-03
**Success Criteria** (what must be TRUE):
  1. 用户能在 Settings 点「导出配置」，浏览器下载一个 JSON 文件，含 Provider 配置/API keys/默认 Provider/附件开关/用户偏好/主题强调色/Pexels key（不含聊天历史）（CFG-01）
  2. 用户能在 Settings 上传 JSON 配置文件导入；相同 id Provider 覆盖前出现确认提示；非法/损坏 JSON 给可操作错误提示（CFG-02）
  3. 导出和导入流程均有醒目警告（「此文件含明文密钥，请妥善保管、用完即删、勿通过不安全渠道传输」），警告文本不可忽略（CFG-03）
  4. 导出文件中的 API key 仅落用户本地，不经过 Aster 任何服务器（无后台硬约束验证）
  5. Settings UI 改动遵循 teal 克制设计系统；本 phase 不破 bundle 门（最终 NFR-12 全里程碑收口在 Phase 29）
**Plans**: TBD
**UI hint**: yes

### Phase 27: Word 工具补全
**Goal**: 用户能通过 agent 对 Word 文档执行五种高频格式与结构操作：文字高亮、项目符号/编号列表、批注、页眉页脚编辑、表格单元格编辑
**Depends on**: Phase 24（v2.3 已交付）
**Requirements**: WORD-06, WORD-07, WORD-08, WORD-09, WORD-10
**Success Criteria** (what must be TRUE):
  1. Agent 能给选中/指定文字加高亮底色，并可通过 undo all 撤销（WORD-06）
  2. Agent 能把段落转成项目符号或编号列表，并可撤销（WORD-07）
  3. Agent 能给指定文字插入批注，并可撤销（WORD-08）
  4. Agent 能编辑文档页眉/页脚文字，并可撤销（WORD-09）
  5. Agent 能按行列定位编辑已有表格的单元格内容，并可撤销（WORD-10）；五个工具全部通过 `operationLog.integration.test` 守门 + bundle CI gate ≤82KB gzip
**Plans**: TBD

### Phase 28: Excel 工具补全
**Goal**: 用户能通过 agent 对 Excel 工作表执行三种高频数据整理操作：合并/取消合并单元格、删除重复行、创建数据透视表（不可用时诚实降级）
**Depends on**: Phase 24（v2.3 已交付）
**Requirements**: EXCEL-11, EXCEL-12, EXCEL-13
**Success Criteria** (what must be TRUE):
  1. Agent 能合并或取消合并指定单元格区域，并可撤销（EXCEL-11）
  2. Agent 能删除区域内重复行，并可撤销（EXCEL-12）
  3. EXCEL-13 数据透视表：plan-phase 已验 Office for Web `Worksheet.pivotTables.add` 可用性；若可用，agent 能创建数据透视表并可撤销；若不可用，工具诚实降级（noop+gate），不假装能做（EXCEL-13）
  4. 三个工具全部通过 `operationLog.integration.test` 守门 + bundle CI gate ≤82KB gzip
**Plans**: TBD

### Phase 29: PPT 工具补全 + NFR-12 收口
**Goal**: 用户能通过 agent 对 PPT 幻灯片执行三种高频操作：插入表格、添加线条/箭头、设置渐变填充；三个工具均存在 API 风险，需前验可用性，不可用时诚实降级。作为末位实现 phase，承接 NFR-12 bundle gate 全里程碑收口
**Depends on**: Phase 26, Phase 27, Phase 28（NFR-12 全里程碑 bundle 收口需所有功能代码就位）；可与 Phase 25 WPS-02 真机验证并行
**Requirements**: PPT-09, PPT-10, PPT-11, NFR-12
**Success Criteria** (what must be TRUE):
  1. PPT-09 插入表格：plan-phase 已验 PowerPoint JS API 网页版表格支持；若可用，agent 能在幻灯片插入表格；若不可用（网页版可能不支持原生建表），工具诚实降级/fallback，不假装能做
  2. PPT-10 线条/箭头：plan-phase 已验 `ShapeCollection.addLine` 网页版可用性；若可用，agent 能添加线条/箭头连接符并可撤销；若不可用，诚实降级（PPT-10）
  3. PPT-11 渐变填充：plan-phase 已验 `ShapeFill` 渐变支持；若可用，agent 能给形状设渐变填充；若只支持纯色或不支持，诚实降级为纯色或拒绝（PPT-11）
  4. 三个工具全部通过 `operationLog.integration.test` 守门（或已记录诚实降级理由）；成功标准允许「部分工具诚实降级」——只要降级行为诚实（明确错误、不静默假成功），即为成功
  5. NFR-12 全里程碑 bundle CI gate 收口：所有 v2.4 新功能代码（配置导入导出 + Word/Excel/PPT 工具补全）整体构建后 main bundle 仍 ≤82KB gzip（余量仅 ~0.7KB，必要时懒加载）；动 bundle 前先 build 再 size（NFR-12）
**Plans**: TBD
**UI hint**: yes

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
| 14. MDL Provider 重写 + PPT casing | v2.2 | 6/6 | Complete | 2026-06-01 |
| 15. VIS 视觉看图 | v2.2 | 5/5 | Complete | 2026-06-02 |
| 16. IMG 图片生成插入 | v2.2 | 5/5 | Complete | 2026-06-02 |
| 17. FILE 文件上传解析 | v2.2 | 6/6 | Complete | 2026-06-02 |
| 18. LIB 图库检索 | v2.2 | 3/3 | Complete | 2026-06-03 |
| 19. v2.2 UAT + Release | v2.2 | — | Complete | 2026-06-03 |
| 20. B 快赢——时钟脱前缀 + 守门 | v2.3 | 1/1 | Complete | 2026-06-03 |
| 21. B 核心——摘要压缩 + 抗幻觉 | v2.3 | 2/2 | Complete | 2026-06-03 |
| 22. A P0 基座——设计 token + 几何自查 | v2.3 | 1/1 | Complete | 2026-06-03 |
| 23. A P1 主力——盖印章工具 + 版式库 + prompt 重写 | v2.3 | 2/2 | Complete | 2026-06-03 |
| 24. A P2 自渲染预览 + bundle 守门 | v2.3 | 4/4 | Complete | 2026-06-03 |
| 25. WPS spike-gate | v2.4 | 0/? | Not started | - |
| 26. 配置导入导出 | v2.4 | 0/? | Not started | - |
| 27. Word 工具补全 | v2.4 | 0/? | Not started | - |
| 28. Excel 工具补全 | v2.4 | 0/? | Not started | - |
| 29. PPT 工具补全 + NFR-12 收口 | v2.4 | 0/? | Not started | - |

---

*Last updated: 2026-06-05 — 🟡 **v2.4「扩疆域」roadmap 创建 + 重排**。5 phases（25–29）/ 17 需求全映射（WPS-01/02 + CFG-01~03 + WORD-06~10 + EXCEL-11~13 + PPT-09~11 + NFR-12）。**用户重排（2026-06-05）**：配置导入导出提前至 Phase 26（独立于 C 工具线，提前交付"换机搬家"实用价值），C 工具线顺延 Word 27 / Excel 28 / PPT 29；NFR-12 bundle 收口移至末位实现 phase（29 PPT，全代码就位才收口）。Phase 25 WPS spike 仍首个（WPS-02 真机层可与 26–29 并行异步）。Phase 编号从 25 续接（v2.3 止于 Phase 24，不 reset）。*
*Earlier: 2026-06-05 — ✅ **v2.3「精装与定力」收官归档**（`/gsd-complete-milestone`）。5 phases（20–24）全部折叠归档，phase 明细见 `milestones/v2.3-ROADMAP.md`。v2.3：5 phase / 10 plans / 98 commits（v2.2..v2.3 区间）/ **81.3 KB bundle**（≤82KB，余量 ~0.7KB）/ **1075 tests green / 0 failed** / tsc 0 / 0 净新增运行时依赖 / 13/13 需求 / 三宿主真机 UAT 全过（11 个真机 bug 全修）/ PVQ-06 spike-gate 判铺开 / tag `v2.3`（线上 `1fe9529`）。收官修正 11 项 stale checkbox（CTX-01~06 + PVQ-01~05，第 5 次复发）。*
