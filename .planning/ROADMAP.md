# Roadmap: Aster

**Core Value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 **AI 代理** 能力，能完成绝大部分文档工作（多步任务、精细化操作）；无后台、BYO Key、纯浏览器直连。

## Milestones

- ✅ **v1.0 已交付的基座** — Phases 0 / 1 / 2 / 2.1（spike + foundation + Provider 抽象 + UAT gap closure）— 作为 v2 基座保留，未单独发布（Q8）
- ✅ **v2.0 Office 智能代理** — Phases 3 / 4 / 04.1 / 5 / 6 / 7（shipped 2026-05-30，线上 `f9fdcc4`，tag `v2.0`，首次公开发布）
- ✅ **v2.1 从能用到好用** — Phases 8 / 9 / 10 / 11 / 12 / 13（shipped 2026-06-01，线上 `2c0201e`，tag `v2.1`，三宿主真机 UAT 全 PASS）
- 📋 **v2.2 多模态四件套**（next）— 视觉看图 / 文件上传解析 / 图片生成插入 / 公开图库检索 + AiHubMix model 修正（MM-01..05）— 待 `/gsd-new-milestone`

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

### 📋 v2.2 多模态四件套 (next milestone — 待 `/gsd-new-milestone` 细化)

- [ ] MM-01 视觉/看图（接 aihubmix-vision）
- [ ] MM-02 文件上传解析（chat 附件 docx/xlsx/pdf/pptx/图片 → 懒加载解析）
- [ ] MM-03 图片生成插入（aihubmix-image，model 对齐 gpt-image-2）
- [ ] MM-04 公开图库检索（Unsplash/Pexels）
- [ ] MM-05 AiHubMix model 修正（视觉 gpt-5.2 / 生图 gpt-image-2 + gemini-3.1-flash-image-preview）
- [ ] （技术债候选）PPT 工具 snake/camel casing 中央归一化根治

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

---

*Last updated: 2026-06-01 — ✅ **v2.1「从能用到好用」已归档**。3 个 milestone（v1.0 基座 / v2.0 / v2.1）全部折叠归档，phase 明细见各 `milestones/v{X.Y}-ROADMAP.md`。v2.1：6 phase / 27 plans / 75.03 KB bundle / 773 tests green / 42/42 需求 / 三宿主真机 UAT 全 PASS / tag `v2.1`（回补 `v2.0`）。next milestone = v2.2 多模态四件套（MM-01..05），待 `/gsd-new-milestone` 启动。*
