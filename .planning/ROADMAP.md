# Roadmap: Aster

**Core Value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 **AI 代理** 能力，能完成绝大部分文档工作（多步任务、精细化操作）；无后台、BYO Key、纯浏览器直连。

## Milestones

- ✅ **v1.0 已交付的基座** — Phases 0 / 1 / 2 / 2.1（spike + foundation + Provider 抽象 + UAT gap closure）— 作为 v2 基座保留，未单独发布（Q8）
- ✅ **v2.0 Office 智能代理** — Phases 3 / 4 / 04.1 / 5 / 6 / 7（shipped 2026-05-30，线上 `f9fdcc4`，tag `v2.0`，首次公开发布）
- ✅ **v2.1 从能用到好用** — Phases 8 / 9 / 10 / 11 / 12 / 13（shipped 2026-06-01，线上 `2c0201e`，tag `v2.1`，三宿主真机 UAT 全 PASS）
- ✅ **v2.2 多模态四件套** — Phases 14 / 15 / 16 / 17 / 18 / 19（shipped 2026-06-03，线上 `0d5fccf`，tag `v2.2`）— 视觉看图 / 文件上传解析 / 图片生成插入 / 公开图库检索 + AiHubMix model 修正 + PPT casing 根治（22 需求）；真机 UAT 全 PASS（pdf.js worker CSP + Pexels 双重 CORS 含 M-1 取图面 + 四件套冒烟，M-1 未坐实无需 Worker）
- ✅ **v2.3 精装与定力** — Phases 20 / 21 / 22 / 23 / 24（shipped 2026-06-05，线上 `1fe9529`，tag `v2.3`）— A PPT 视觉质量纵深（设计 token + 几何自查 + apply_slide_layout 盖印章 + 6 版式库 + 自渲染预览自查）+ B 上下文/抗幻觉（时钟脱前缀 + token 水位摘要压缩 + 抗幻觉指引）（13 需求）；三宿主真机 UAT 全过（11 个真机 bug 全修），PVQ-06 spike-gate 判铺开

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
| 23. A P1 主力——盖印章工具 + 版式库 + prompt 重写 | v2.3 | 2/2 | Complete   | 2026-06-03 |
| 24. A P2 自渲染预览 + bundle 守门 | v2.3 | 4/4 | Complete   | 2026-06-03 |

---

*Last updated: 2026-06-05 — ✅ **v2.3「精装与定力」收官归档**（`/gsd-complete-milestone`）。5 phases（20–24）全部折叠归档，phase 明细见 `milestones/v2.3-ROADMAP.md`。v2.3：5 phase / 10 plans / 98 commits（v2.2..v2.3 区间）/ **81.3 KB bundle**（≤82KB，余量 ~0.7KB）/ **1075 tests green / 0 failed** / tsc 0 / 0 净新增运行时依赖 / 13/13 需求 / 三宿主真机 UAT 全过（11 个真机 bug 全修）/ PVQ-06 spike-gate 判铺开 / tag `v2.3`（线上 `1fe9529`）。收官修正 11 项 stale checkbox（CTX-01~06 + PVQ-01~05，第 5 次复发）。*
*Earlier: 2026-06-03 — ✅ **Phase 23 完成**（PVQ-03/04/05）。apply_slide_layout 盖印章 write 工具（架构 (B) create+fill：单 PowerPoint.run 建新页 + 填整页原生形状，reverse=删整张新页复用 delete_slide_by_index 双定位，postState kind ppt_layout，内部自动跑 checkSlideLayout→data.layout_check evidence + image_slots autonomous-insert）+ ppt-layouts.ts 6 套版式库（cover/kpi/two_column/timeline/image_text/bullet_list 固化 960×540 坐标、复用 ppt-tokens、配色全参数化收 accent hex 无调色板、KPI 弹性 1-4 + caps、FIX2 色块白字单形状/时间线连接线分段 → dogfood 6/6 0 overlap）+ getDomainSegment('ppt') prompt 重写（删 #6 坐标推算/#8 宪法式自查冗余、保 #10 CTX-06 抗幻觉、修 stale #9 图片现可用、加判断级指引+配色+硬底线，精确标准未弱化）。硬 gate 全绿（operationLog.integration apply_slide_layout→delete_slide_by_index→rolled_back + contract D-17 +23 + PPT 工具 22→23 + 既有 L59-65/L115-117 + PVQ-05 5 守门）；989 tests green、bundle 80.6 KB（≤82KB，~0 增量、0 净新增依赖、落 loop 懒加载 chunk）、tsc 0。下一步：Phase 24（A P2 自渲染预览 spike + bundle 守门，milestone 末 spike-gate）。*
*Earlier: 2026-06-03 — ✅ **Phase 21 完成**（CTX-03/04/05/06）。token 水位摘要压缩（compaction.ts，120K/40K）+ [system][摘要] 稳定缓存前缀 + version:2 持久化（F5）+ applyHistoryBackstop 截断重审 + 三宿主抗幻觉指引；plan-review 4 修订全落地并测守门（abort no-commit / 跨轮缓存稳定 / 摘要超上限 no-commit / estimateTokens DRY）；933 tests green、bundle 80.6 KB（≤82KB，与 80.53 基线持平）、tsc 0。*
*Earlier: 2026-06-03 — ✅ **Phase 20 完成**（CTX-01/02）。时钟脱 system 前缀（新增 buildTimeContext() 拼 wire 末尾 user message）+ CTX-02 结构性测试守门；901 tests green、bundle 80.53 KB（0 增量）、tsc 0。*
*Earlier: 2026-06-03 — 🟡 **v2.3「精装与定力」roadmap 创建**。5 phases（20–24）/ 13 需求全映射（CTX-01~06 + PVQ-01~06 + NFR-11）/ B 系列（Phase 20-21）在 A 系列（Phase 22-24）之前 / PVQ-06 独立 phase 含 spike-gate + 诚实降级路径。Phase 编号从 20 续接（v2.2 止于 Phase 19，不 reset）。*
*Earlier: 2026-06-03 — ✅ **v2.2「多模态四件套」已归档**。4 个 milestone（v1.0 基座 / v2.0 / v2.1 / v2.2）全部折叠归档，phase 明细见各 `milestones/v{X.Y}-ROADMAP.md`。v2.2：6 phase（14–19）/ 25 plans / 130 commits（v2.1..v2.2 区间）/ 80.53 KB bundle（≤82KB，余量 1.47KB）/ 885 tests green / 0 净新增运行时依赖 / 22/22 需求 / 三宿主真机 UAT 全 PASS / tag `v2.2`（线上 `0d5fccf`）。收官修正 LIB-01/02/03 stale-checkbox（Phase 18 已交付，溯源表残留 Pending）。*
*Earlier: 2026-06-01 — ✅ v2.1「从能用到好用」已归档（6 phase / 27 plans / 75.03 KB / 773 tests / 42/42 需求 / 三宿主真机 UAT 全 PASS / tag `v2.1`，回补 `v2.0`）。*
