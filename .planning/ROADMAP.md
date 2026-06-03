# Roadmap: Aster

**Core Value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 **AI 代理** 能力，能完成绝大部分文档工作（多步任务、精细化操作）；无后台、BYO Key、纯浏览器直连。

## Milestones

- ✅ **v1.0 已交付的基座** — Phases 0 / 1 / 2 / 2.1（spike + foundation + Provider 抽象 + UAT gap closure）— 作为 v2 基座保留，未单独发布（Q8）
- ✅ **v2.0 Office 智能代理** — Phases 3 / 4 / 04.1 / 5 / 6 / 7（shipped 2026-05-30，线上 `f9fdcc4`，tag `v2.0`，首次公开发布）
- ✅ **v2.1 从能用到好用** — Phases 8 / 9 / 10 / 11 / 12 / 13（shipped 2026-06-01，线上 `2c0201e`，tag `v2.1`，三宿主真机 UAT 全 PASS）
- ✅ **v2.2 多模态四件套** — Phases 14 / 15 / 16 / 17 / 18 / 19（shipped 2026-06-03，线上 `0d5fccf`，tag `v2.2`）— 视觉看图 / 文件上传解析 / 图片生成插入 / 公开图库检索 + AiHubMix model 修正 + PPT casing 根治（22 需求）；真机 UAT 全 PASS（pdf.js worker CSP + Pexels 双重 CORS 含 M-1 取图面 + 四件套冒烟，M-1 未坐实无需 Worker）
- 🟡 **v2.3 精装与定力** — Phases 20 / 21 / 22 / 23 / 24（started 2026-06-03）— A PPT 视觉质量纵深 + B 上下文/抗幻觉（13 需求）

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

### v2.3 精装与定力 (Phases 20–24) — Started 2026-06-03

**Goal:** 在 v2.2 多模态地基上做两个纵深提质——（A）让 PPT 产出从「文字对但粗糙」升级到「有设计规范、整齐专业、可继续编辑」；（B）让 agent 在长对话里保持清醒：摘要压缩抗幻觉 + system prompt 缓存友好。
**Requirements:** 13 条（CTX-01~06 + PVQ-01~06 + NFR-11）；全部映射，0 unmapped。
**Phase numbering:** 从 20 续接（v2.2 止于 Phase 19，不 reset）。

- [x] **Phase 20: B 快赢——时钟脱前缀 + 守门** - 把实时时钟从 system prompt 前缀移到 user message 末尾，system 前缀变静态，结构性 test 守门防回退 — completed 2026-06-03
- [x] **Phase 21: B 核心——摘要压缩 + 抗幻觉** - 按 token 高/低水位触发摘要压缩 compaction，截断策略重审做到缓存友好，prompt 层抗幻觉指引 — completed 2026-06-03
- [x] **Phase 22: A P0 基座——设计 token + 几何自查** - 集中设计 token 模块，确定性几何自查（溢出/重叠/越界/对比度）替换 LLM 脑补 — completed 2026-06-03
- [ ] **Phase 23: A P1 主力——盖印章工具 + 版式库 + prompt 重写** - apply_slide_layout write tool（六版式），CSS 导坐标版式库，PPT 领域段 system prompt 重写
- [ ] **Phase 24: A P2 自渲染预览 + bundle 守门** - task pane 自渲染 slide 预览 spike，html2canvas 懒加载截图喂多模态自查，bundle CI gate 维持

## Phase Details

### Phase 20: B 快赢——时钟脱前缀 + 守门
**Goal**: System prompt 前缀变完全静态，prompt 缓存高命中；精确时间依旧可用，通过结构性测试守门防未来回退
**Depends on**: Nothing（v2.3 第一个 phase）
**Requirements**: CTX-01, CTX-02
**Success Criteria** (what must be TRUE):
  1. `buildSystemPrompt(host)` 返回值不再包含分钟级时间（`HH:MM` 形态），时间改在当前 user message 末尾出现（如「当前时间：2026-06-03 周三 14:37，用户本地时间」）
  2. agent 在每次 runAgent 仍能从 messages 末尾拿到精确的日期 + 时间 + 星期，PPT/Excel/Word 三宿主均可用
  3. `system-prompt.test.ts` 加断言：`buildSystemPrompt(host)` 不匹配 `/\d{1,2}:\d{2}/`，CI 通过，防分钟级时钟再被加回 system 前缀
  4. 现有测试（892+）全部 green，bundle 无变化（纯字符串改动，0 新依赖）
**Plans**: 1 plan

Plans:
- [x] 20-01-PLAN.md — 新增 buildTimeContext() + 重构 getSharedBase + loop.ts 接线 + CTX-02 守门测试 — completed 2026-06-03

---

### Phase 21: B 核心——摘要压缩 + 抗幻觉
**Goal**: 长对话不幻觉：摘要压缩 compaction 按 token 水位触发（非按轮数），截断策略改为缓存友好的批量高水位策略，prompt 层强化「信刚读的文档」指引
**Depends on**: Phase 20
**Requirements**: CTX-03, CTX-04, CTX-05, CTX-06
**Success Criteria** (what must be TRUE):
  1. 历史 token 超过高水位时自动触发压缩：调同 Provider flash 档 LLM 把最老一段压成要点摘要（保留仍有效事实/决定/偏好，扔掉已被推翻的），压后历史回落到低水位；高/低水位差值足够大，使一次压缩可撑多轮
  2. 摘要作为固定消息放在 `[system][摘要][最近原文][当前]` 结构，两次压缩之间 `[system][摘要]` 前缀稳定，缓存可持续命中；摘要随聊天记录存入 localStorage，F5 刷新后可恢复
  3. `truncateTo20Turns`（`loop-helpers.ts`）截断策略改为「攒够一批才压/砍」（高水位批量），不再是每轮丢最老一条的滑动窗口，避免前缀每轮都变的缓存灾难；极端长对话有明确兜底路径，不无上限增长也不盲目丢有用上下文
  4. PPT/Excel/Word 三宿主 system prompt 均加入「永远信任刚重读的文档现状，不信历史里几十轮前的旧读取记忆；文档会被改动，旧读数早已过时」指引
  5. loop / loop-helpers 相关单测覆盖 compaction 触发边界（高水位 above/below/at boundary）；所有现有测试 green
**Plans**: 2 plans

Plans:
- [x] 21-01-PLAN.md — compaction.ts 摘要压缩水位逻辑 + chat.ts version:2 持久化 + loop.ts wire 接线 + applyHistoryBackstop（CTX-03/04/05）— completed 2026-06-03
- [x] 21-02-PLAN.md — 三宿主 system prompt 抗幻觉独立项 + 守门（CTX-06）— completed 2026-06-03

---

### Phase 22: A P0 基座——设计 token + 几何自查
**Goal**: 建立 PPT 设计规范的代码化基础：集中 token 模块使参数可统一调，确定性几何自查从代码层面消除「LLM 脑补坐标」
**Depends on**: Phase 21（B 系列完成后开 A 系列）
**Requirements**: PVQ-01, PVQ-02
**Success Criteria** (what must be TRUE):
  1. `src/agent/design/ppt-tokens.ts` 存在并包含：字号阶梯（标题/副标/正文 pt 值，商务密实偏紧凑）、统一页边距、网格两套布局（整页/左右两栏）；**配色不锁死（用户 2026-06-03 推翻固定调色板）**——不内置 palette 数组，仅 teal `#009887`/dark `#4FC9B8` 缺省兜底常量 + 涨跌 success/error 独立语义色，实际配色运行时由 AI freehand；代码中无散落硬编码字号/页边距重复值
  2. 几何自查函数接收元素列表 `{left, top, width, height}[]`，确定性输出违规清单，基准为 16:9 画布（canvas 参数化，默认 **960×540pt** 标准宽屏 @72pt/in；真机实报基准待 UAT 确认，偏差只改一个常量），覆盖四项：① 文本溢出（预估宽高 > 文本框，保守上界）② 矩形重叠（相交边长 > 2pt）③ 越界（超画布或到边缘 < 页边距 token）④ 对比不足（文字/背景 WCAG < 4.5:1 正文 / < 3:1 ≥18pt 加粗大字）
  3. 几何自查输出的违规清单可拼入 LLM 下一轮 messages 作为 evidence（Phase 22 经新 read 工具 `check_slide_layout` 交付）；删 system prompt「让 LLM 拿坐标脑补重叠」冗余表述**整体留 Phase 23 PVQ-05**（避免三方改同段：Phase 21 刚加 CTX-06、Phase 23 删 #6/#8），Phase 22 不碰 prompt
  4. 几何自查纯 TS、零网络零依赖，单测覆盖四项各 happy-path + edge case；bundle 无增量（纯内部模块）
**Plans**: 1 plan

Plans:
- [x] 22-01-PLAN.md — ppt-tokens.ts 结构 token（配色不锁死）+ geometry-check.ts 四项确定性自查 + check_slide_layout read 工具 + 计数 21→22（PVQ-01/02）— completed 2026-06-03

---

### Phase 23: A P1 主力——盖印章工具 + 版式库 + prompt 重写
**Goal**: PPT 产出从「文字对但粗糙」升级到「版面规范、整齐专业、可继续编辑」：盖印章工具一个 call 建好整页，版式库用 CSS 导坐标保证稳定，prompt 重写让模型聚焦判断而非机械摆版
**Depends on**: Phase 22（PVQ-01/02 基座就位）
**Requirements**: PVQ-03, PVQ-04, PVQ-05
**Success Criteria** (what must be TRUE):
  1. `apply_slide_layout` write tool 注册可用：入参 `{layout, 内容字段}`，一个 tool call 在目标幻灯片上建好整页所有原生形状，支持六套版式：封面、大数字KPI、两栏对比、时间线、图文左右、要点列表
  2. `apply_slide_layout` reverse 要点全部满足：批量删除该页新建的所有形状（记录全部 `newShapeId`），inverse 方法收 Record 对象参数（非位置参，Phase 5 教训）；新 `PostStateSnapshot` kind + humanLabel；工具入 `PPT_TOOLS` Set（casing 归一化）；`operationLog.integration.test` 有守门用例
  3. 版式库坐标来自开发期 CSS 导坐标（pt/px 换算 + 字体回退偏差校准），不是 LLM 或手写估值；在 Office for Web PPT 真机 sideload 验证时各版式版面整洁、不溢出不重叠
  4. PPT 领域段 system prompt 已移除「教模型如何摆坐标/排字号/自查清单」等机制已保证的冗余规则；prompt 聚焦故事线/选版式/填内容/标题写出洞察，以及硬底线（可编辑优先/收到自查反馈就改/诚实边界）；精确描述（边界/禁则/判断标准）保留不删
  5. 所有现有测试 green；bundle ≤82KB gzip（动 bundle 前先 build 再 `npm run size`）
**Plans**: TBD
**UI hint**: yes

---

### Phase 24: A P2 自渲染预览 + bundle 守门
**Goal**: Spike 验自渲染预览保真度——保真度够用则接入 html2canvas 截图喂多模态自查形成闭环；不够用则诚实降级；全程 bundle CI gate 维持
**Depends on**: Phase 23（PVQ-03/04 版式库就位，PVQ-02 几何自查就位）；v2.2 vision 基座（aihubmix-vision）已就位
**Requirements**: PVQ-06, NFR-11
**Success Criteria** (what must be TRUE):
  1. **Spike gate（必须先跑）**: 在 task pane 中用绝对定位 div 按 16:9（720×405pt 等比缩放）重建 slide 预览，用 `html2canvas`（动态 import 懒加载）截图，人工核查「自渲染预览 vs PowerPoint 真实截图」的溢出/重叠/留白/对比粗粒度可辨认程度，给出明确结论：「保真度够用，铺开」或「保真度不足，降级」
  2. **铺开路径**（spike 通过）: 自渲染截图喂多模态模型（搭 v2.2 aihubmix-vision），用「自查 4 项」清单（溢出/重叠/留白/对比）输出违规文字反馈，可作为 evidence 拼入 LLM 下一轮 messages；整条链路在 Office for Web PPT 真机端到端可用
  3. **降级路径**（spike 不通过）: 诚实记录降级原因，仅保留 Phase 22 PVQ-02 几何自查兜底，PVQ-06 不铺开；REQUIREMENTS.md 更新状态并告知用户
  4. `html2canvas` 通过动态 import 懒加载，0 净新增初始 bundle 增量；build + `npm run size` 验证 initial main bundle ≤82KB gzip；P95 端到端性能不因自渲染截图路径退化（截图在本地 DOM 层）
  5. 所有现有测试 green；undo 守门（operationLog.integration.test）/ bundle gate / P95 三项 CI gate 全部通过
**Plans**: TBD
**UI hint**: yes

---

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
| 22. A P0 基座——设计 token + 几何自查 | v2.3 | 0/? | Not started | - |
| 23. A P1 主力——盖印章工具 + 版式库 + prompt 重写 | v2.3 | 0/? | Not started | - |
| 24. A P2 自渲染预览 + bundle 守门 | v2.3 | 0/? | Not started | - |

---

*Last updated: 2026-06-03 — ✅ **Phase 22 完成**（PVQ-01/02）。ppt-tokens.ts 结构 token（字号阶梯/页边距/两套 canvas 参数化网格/默认画布 960×540/兜底单色 teal/涨跌语义色，**配色不锁死无固定调色板**）+ geometry-check.ts 四项确定性自查（溢出保守上界含显式\n / 重叠>2pt / 越界 / 对比 WCAG + bg 不可读诚实降级）+ check_slide_layout read 工具（复用 list_shapes_on_slide，零 adapter 改动、不进 PPT_TOOLS、无 undo）；plan-check 5 修订全落地；PPT 工具 21→22；963 tests green、bundle 80.61 KB（≤82KB，~0 增量、0 净新增依赖）、tsc 0。本 phase 不碰 system-prompt.ts（留 Phase 23 PVQ-05）。下一步：Phase 23（A P1 主力——盖印章工具 + 版式库 + prompt 重写）。*
*Earlier: 2026-06-03 — ✅ **Phase 21 完成**（CTX-03/04/05/06）。token 水位摘要压缩（compaction.ts，120K/40K）+ [system][摘要] 稳定缓存前缀 + version:2 持久化（F5）+ applyHistoryBackstop 截断重审 + 三宿主抗幻觉指引；plan-review 4 修订全落地并测守门（abort no-commit / 跨轮缓存稳定 / 摘要超上限 no-commit / estimateTokens DRY）；933 tests green、bundle 80.6 KB（≤82KB，与 80.53 基线持平）、tsc 0。*
*Earlier: 2026-06-03 — ✅ **Phase 20 完成**（CTX-01/02）。时钟脱 system 前缀（新增 buildTimeContext() 拼 wire 末尾 user message）+ CTX-02 结构性测试守门；901 tests green、bundle 80.53 KB（0 增量）、tsc 0。*
*Earlier: 2026-06-03 — 🟡 **v2.3「精装与定力」roadmap 创建**。5 phases（20–24）/ 13 需求全映射（CTX-01~06 + PVQ-01~06 + NFR-11）/ B 系列（Phase 20-21）在 A 系列（Phase 22-24）之前 / PVQ-06 独立 phase 含 spike-gate + 诚实降级路径。Phase 编号从 20 续接（v2.2 止于 Phase 19，不 reset）。*
*Earlier: 2026-06-03 — ✅ **v2.2「多模态四件套」已归档**。4 个 milestone（v1.0 基座 / v2.0 / v2.1 / v2.2）全部折叠归档，phase 明细见各 `milestones/v{X.Y}-ROADMAP.md`。v2.2：6 phase（14–19）/ 25 plans / 130 commits（v2.1..v2.2 区间）/ 80.53 KB bundle（≤82KB，余量 1.47KB）/ 885 tests green / 0 净新增运行时依赖 / 22/22 需求 / 三宿主真机 UAT 全 PASS / tag `v2.2`（线上 `0d5fccf`）。收官修正 LIB-01/02/03 stale-checkbox（Phase 18 已交付，溯源表残留 Pending）。*
*Earlier: 2026-06-01 — ✅ v2.1「从能用到好用」已归档（6 phase / 27 plans / 75.03 KB / 773 tests / 42/42 需求 / 三宿主真机 UAT 全 PASS / tag `v2.1`，回补 `v2.0`）。*
