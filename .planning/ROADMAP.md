# Roadmap: Aster

**Core Value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 **AI 代理** 能力，能完成绝大部分文档工作（多步任务、精细化操作）；无后台、BYO Key、纯浏览器直连。

## Milestones

- ✅ **v1.0 已交付的基座** — Phases 0 / 1 / 2 / 2.1（spike + foundation + Provider 抽象 + UAT gap closure）— 作为 v2 基座保留，未单独发布（Q8）
- ✅ **v2.0 Office 智能代理** — Phases 3 / 4 / 04.1 / 5 / 6 / 7（shipped 2026-05-30，线上 `f9fdcc4`，tag `v2.0`，首次公开发布）
- ✅ **v2.1 从能用到好用** — Phases 8 / 9 / 10 / 11 / 12 / 13（shipped 2026-06-01，线上 `2c0201e`，tag `v2.1`，三宿主真机 UAT 全 PASS）
- ✅ **v2.2 多模态四件套** — Phases 14 / 15 / 16 / 17 / 18 / 19（shipped 2026-06-03，线上 `0d5fccf`，tag `v2.2`）— 视觉看图 / 文件上传解析 / 图片生成插入 / 公开图库检索 + AiHubMix model 修正 + PPT casing 根治（22 需求）；真机 UAT 全 PASS（pdf.js worker CSP + Pexels 双重 CORS 含 M-1 取图面 + 四件套冒烟，M-1 未坐实无需 Worker）

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

---

*Last updated: 2026-06-03 — ✅ **v2.2「多模态四件套」已归档**。4 个 milestone（v1.0 基座 / v2.0 / v2.1 / v2.2）全部折叠归档，phase 明细见各 `milestones/v{X.Y}-ROADMAP.md`。v2.2：6 phase（14–19）/ 25 plans / 130 commits（v2.1..v2.2 区间）/ 80.53 KB bundle（≤82KB，余量 1.47KB）/ 885 tests green / 0 净新增运行时依赖 / 22/22 需求 / 三宿主真机 UAT 全 PASS / tag `v2.2`（线上 `0d5fccf`）。收官修正 LIB-01/02/03 stale-checkbox（Phase 18 已交付，溯源表残留 Pending）。下一步：`/gsd-new-milestone` 启动新里程碑，或 `/gsd-review-backlog` 处理 backlog。*
*Earlier: 2026-06-03 — 🎉 **v2.2 SHIPPED**（tag `v2.2`，线上 `0d5fccf`）。Phase 19 真机 UAT 全 PASS：HR-1 pdf.js worker CSP + HR-2 Pexels 双重 CORS（M-1 未坐实无需 Worker）+ 四件套冒烟全 PASS。Team Lead 模式（TeamCreate）自主推进 Phase 16→17→18→收尾。*
*Earlier: 2026-06-01 — 🚧 v2.2 roadmap 创建（Phases 14–19）；22 需求映射 6 phase；4 个 spike gate（PPT 取图 / PPT 插图 API / pdf.js worker / Pexels CORS）。*
*Earlier: 2026-06-01 — ✅ v2.1「从能用到好用」已归档（6 phase / 27 plans / 75.03 KB / 773 tests / 42/42 需求 / 三宿主真机 UAT 全 PASS / tag `v2.1`，回补 `v2.0`）。*
