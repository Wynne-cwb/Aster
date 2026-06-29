# Roadmap: Aster

**Core Value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 **AI 代理** 能力，能完成绝大部分文档工作（多步任务、精细化操作）；无后台、BYO Key、纯浏览器直连。

## Milestones

- ✅ **v1.0 已交付的基座** — Phases 0 / 1 / 2 / 2.1（spike + foundation + Provider 抽象 + UAT gap closure）— 作为 v2 基座保留，未单独发布（Q8）
- ✅ **v2.0 Office 智能代理** — Phases 3 / 4 / 04.1 / 5 / 6 / 7（shipped 2026-05-30，线上 `f9fdcc4`，tag `v2.0`，首次公开发布）
- ✅ **v2.1 从能用到好用** — Phases 8 / 9 / 10 / 11 / 12 / 13（shipped 2026-06-01，线上 `2c0201e`，tag `v2.1`，三宿主真机 UAT 全 PASS）
- ✅ **v2.2 多模态四件套** — Phases 14 / 15 / 16 / 17 / 18 / 19（shipped 2026-06-03，线上 `0d5fccf`，tag `v2.2`）— 视觉看图 / 文件上传解析 / 图片生成插入 / 公开图库检索 + AiHubMix model 修正 + PPT casing 根治（22 需求）；真机 UAT 全 PASS（pdf.js worker CSP + Pexels 双重 CORS 含 M-1 取图面 + 四件套冒烟，M-1 未坐实无需 Worker）
- ✅ **v2.3 精装与定力** — Phases 20 / 21 / 22 / 23 / 24（shipped 2026-06-05，线上 `1fe9529`，tag `v2.3`）— A PPT 视觉质量纵深（设计 token + 几何自查 + apply_slide_layout 盖印章 + 6 版式库 + 自渲染预览自查）+ B 上下文/抗幻觉（时钟脱前缀 + token 水位摘要压缩 + 抗幻觉指引）（13 需求）；三宿主真机 UAT 全过（11 个真机 bug 全修），PVQ-06 spike-gate 判铺开
- ✅ **v2.4 扩疆域** — Phases 25 / 26 / 27 / 28 / 29（shipped 2026-06-08，线上 `41e4d70`，tag `v2.4`）— WPS spike-gate 探路（WPS-01）+ C 工具补全三宿主 11 个 + 配置导入导出（**16/17 交付**，WPS-02 真机层延后；三宿主真机 UAT 全 PASS）
- 🟡 **v2.5 登陆 WPS（滩头堡）** — Phases 30 / 31 / 32 / 33（进行中，2026-06-08 起）— 证据优先分阶段：**Phase 30 = 真机验证硬门（go/no-go）**，通过则建单宿主 `wpsjs` 滩头堡（外壳 + 复用层坐实 + 单宿主 adapter + 端到端 killer scenario）

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

<details>
<summary>✅ v2.4 扩疆域 (Phases 25–29) — SHIPPED 2026-06-08，线上 41e4d70，tag v2.4</summary>

完整内容见 [`milestones/v2.4-ROADMAP.md`](milestones/v2.4-ROADMAP.md)。需求存档见 [`milestones/v2.4-REQUIREMENTS.md`](milestones/v2.4-REQUIREMENTS.md)。

- [x] Phase 25: WPS spike-gate（spike）— WPS Windows 桌面版可行性调研报告 + 真机验证清单（WPS-01）；WPS-02 真机层 ⏸️ Deferred/Async（用户无 Windows 环境，设计内延后）— completed 2026-06-05
- [x] Phase 26: 配置导入导出（3 plans）— 明文 JSON 导出/导入全部持久化配置（含 API key）+ 醒目警告 + 同 id 覆盖确认 + 复用 FILE 基建 — completed 2026-06-05
- [x] Phase 27: Word 工具补全（3 plans）— 高亮/列表/批注/页眉页脚/表格单元格 5 write tool（既有合约 inverse Record + 守门）— completed 2026-06-06
- [x] Phase 28: Excel 工具补全（3 plans）— 合并单元格/删除重复行/数据透视表 3 write tool（含 HR-01 全列语义 + HR-02 孤儿清理 + API 降级门控）— completed 2026-06-06
- [x] Phase 29: PPT 工具补全 + NFR-12 收口（3 plans）— 插入表格（原生 addTable）/线条箭头/渐变降级 3 write tool + bundle gate ≤100KB 全里程碑收口 — completed 2026-06-06

**Requirements:** 16/17 交付（C 工具 11 + 配置 3 + NFR 1 + WPS-01）；WPS-02 真机层 ⏸️ Deferred/Async（用户当前无 Windows 环境，按设计延后到有环境时/独立 milestone，非 v2.4 硬条件）。三宿主 Office for Web 真机 UAT 全 PASS（12/12 区块，含北极星「配置跨 partition 零重输」+ 3 个真机分水岭，0 阻塞 bug）。**收官修正 1 项 stale checkbox（WPS-01，第 6 次复发）。**

</details>

## v2.5 登陆 WPS（滩头堡）— Phases 30–33

**策略：证据优先分阶段。Phase 30 是整个里程碑的硬门（go/no-go 验证探针）；Phases 31–33 以 Phase 30 = go 为前提。任一 make-or-break 项挂 → 里程碑在 Phase 30 干净收口，不写任何适配代码。**

- [ ] **Phase 30: WPS-02/03 真机验证探针（硬门）** — go/no-go 裁定：两条 make-or-break 串行（① CEF 内核/React19 可行性 → ② DeepSeek SSE 直连不被 WPS 容器 CSP/CORS 拦截）+ JSAPI read/write/undo 基础可行性 + 首宿主数据（Excel vs PPT）+ 工作量细化；探针 = 独立极简 wpsjs 项目，不进 Aster 主仓 src/；**真机步骤只能用户在 Windows WPS 上跑**
- [ ] **Phase 31: wpsjs 外壳 + 宿主识别 + 复用层 CEF 坐实**（条件：Phase 30 = go）— `ribbon.xml` + sideload + `index-wps.html` + Vite 多入口 `main-wps.tsx`；`OnAddinLoad`/`ComponentType` 宿主路由；React UI + SSE 直连 + localStorage + 字体 CEF 真机无降级坐实
- [ ] **Phase 32: 单宿主 adapter read/write + operationLog 移植**（条件：Phase 30 = go；宿主 Excel vs PPT 待 Phase 30 真机数据 + discuss-phase 裁定）— 选定宿主 WPS JSAPI read/write（`assertWriteResult` 写后回读守门）+ inverse（operationLog 反向引擎移植，Record 对象签名）+ WPS operationLog.integration.test 守门
- [ ] **Phase 33: killer scenario 端到端 + 诚实收口**（条件：Phase 30 = go）— 选定宿主 agent loop 多步 + undo all 真机 UAT PASS；非目标宿主 adapter throw stub（「WPS-D1 预留」诚实不裸奔）；WPS 入口 bundle 独立核算；wpsjs publish/sideload 安装流程固化

## Phase Details

### Phase 30: WPS-02/03 真机验证探针（硬门）
**Goal:** 在 Windows WPS 桌面专业版真机上，用最小探针跑完 go/no-go 验证，拿到整个里程碑的进行/停工裁定。
**Depends on:** Phase 29（v2.4 完成基座）
**Requirements:** WPS-02, WPS-03
**Success Criteria** (what must be TRUE):
  1. make-or-break 第一项：用户在 Windows WPS 真机运行探针，能通过 `navigator.userAgent` + 特性探测确认 CEF Chromium 版本 ≥ 80，`ReadableStream`/`fetch` 可用，React 19 可加载（否则 no-go）
  2. make-or-break 第二项（串行，仅第一项通过才跑）：探针能直连 `api.deepseek.com` 拿到 `text/event-stream` SSE 流，WPS 容器 CSP/CORS 不拦截（否则 no-go，无后台 Core Value 在 WPS 失效）
  3. `localStorage` 跨会话持久性坐实：关闭 WPS 再打开，探针写入的键仍存在
  4. 选定宿主（Excel 或 PPT）的 WPS JSAPI read 操作（取选区/读结构）+ write 操作（写后回读 `assertWriteResult` 验证不静默 no-op）真机可行性可见
  5. 产出 go/no-go 最终裁定报告 + 首宿主数据（Excel vs PPT）+ 适配工作量细化（Phase 31-33 依据）
**Plans:** 3 plans
Plans:
- [x] 30-01-PLAN.md — 探针脚手架（ribbon.xml + jsplugins.xml + index.html）✅ 2026-06-08
- [x] 30-02-PLAN.md — probe.js 完整检查逻辑（12 检查项 + 报告生成器）✅ 2026-06-08
- [x] 30-03-PLAN.md — 真机验证清单 + README（用户操作指引）✅ 2026-06-08
**Note:** 探针是独立极简 `wpsjs` 项目，不进 Aster 主仓 `src/`。真机步骤只能用户在 Windows WPS 上跑（Claude 在 Mac 开发探针 + 写清单，无法代跑 —— 同 Office for Web 真机 UAT 分工）。**两条 make-or-break 串行：任一挂 → 里程碑 no-go，Phases 31–33 全部取消。**

### Phase 31: wpsjs 外壳 + 宿主识别 + 复用层 CEF 坐实
**Goal:** 在 WPS CEF 容器内建起能加载 Aster Task Pane 的完整加载项外壳，并真机坐实复用层（React/SSE/存储/字体）零降级运行。
**Depends on:** Phase 30（验证 = go）
**Requirements:** WPS-04, WPS-05, WPS-06
**Success Criteria** (what must be TRUE):
  1. 用户在 Windows WPS 真机通过 `jsplugins.xml`/`oem.ini` sideload，能看到 Aster Task Pane 在 WPS 内打开（不引 office.js CDN，加载不报错）
  2. `main-wps.tsx` 通过 `OnAddinLoad` + `window.Application.ComponentType` 正确识别当前宿主（文字/表格/演示），路由到对应 `createWpsAdapter(type)`，接缝上方 agent loop / store / UI 零改动
  3. SSE 直连 DeepSeek（BYO key）在 WPS CEF 内流式输出，首 token 可见（无 CORS/CSP 拦截，与 Phase 30 探针结论一致）
  4. API Key 写入 `localStorage` 后，关闭 WPS 再打开，key 仍在（partitionKey 降级分支自动命中）
  5. teal 设计系统（Inter/Noto Sans SC/JetBrains Mono 字体 + CSS 变量）在 WPS CEF 内正常渲染，无字体降级/样式错乱
**Plans:** TBD
**UI hint**: yes

### Phase 32: 单宿主 adapter read/write + operationLog 移植
**Goal:** 为选定宿主（Excel 或 PPT，由 Phase 30 真机数据 + discuss-phase 裁定）实现基于 WPS JSAPI 的完整 read/write/undo adapter，接缝上方 agent loop 无感调用。
**Depends on:** Phase 31（外壳真机成功）；**首宿主（Excel vs PPT）待 Phase 30 数据 + discuss-phase 裁定，Phase 32 开工前锁定**
**Requirements:** WPS-07, WPS-08
**Success Criteria** (what must be TRUE):
  1. AI agent 能在选定宿主内调用 read 工具（取选区/读结构/读值文本），返回结果与 WPS 文档实际内容一致（WPS JSAPI async-IPC 路径跑通）
  2. AI agent 能在选定宿主内调用 write 工具，写操作后 `assertWriteResult()` 立即回读确认不静默 no-op（坐实 WPS 写后回读守门机制）
  3. 每个 write 操作的 `inverse` 收 Record 对象签名（Phase 5 教训沿用），调用 `operationLog` 反向引擎能正确回滚（WPS 无原生程序化撤销，operationLog 是唯一路径）
  4. WPS 版 `operationLog.integration.test` 守门通过：批量 write + 整批 undo 逆序回滚，文档状态复原
**Plans:** TBD
**Note:** 首宿主 Excel vs PPT 开放决策：若 Phase 30 §3 探测中 PPT `Shapes.AddTable`/`AddLine`/`copy_slide` ≥2 项通过，discuss-phase 倾向 PPT；否则倾向 Excel（JSAPI 15 个核心操作全有文档化路径，风险最低）。Phase 32 开工前必须通过 discuss-phase 锁定。

### Phase 33: killer scenario 端到端 + 诚实收口
**Goal:** 在 WPS 真机完成一个完整 killer scenario 的端到端验证，并做好诚实收口（非目标宿主不裸奔，sideload 流程可分发）。
**Depends on:** Phase 32（adapter 真机可用）
**Requirements:** WPS-09, WPS-10
**Success Criteria** (what must be TRUE):
  1. 用户在 Windows WPS 真机，选定宿主内完成一个多步 agent loop 场景（AI 自主多步改文档），全程可观察步骤 + 能暂停 + 完成后一键 undo all 全回滚，真机 UAT PASS
  2. 非目标宿主（未实现 adapter）的调用一律 `throw` 并附「WPS-D1 预留」提示，不裸奔静默失败
  3. WPS 加载项 bundle 预算独立核算（与 Office.js 主工程隔离），结果记录在收口报告
  4. `wpsjs publish` 或 sideload 安装流程文档化固化，真实 Windows 用户可按步骤自行安装 Aster WPS 版
**Plans:** TBD

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
| 25. WPS spike-gate | v2.4 | — (spike) | Complete (WPS-01；WPS-02 ⏸️Deferred) | 2026-06-05 |
| 26. 配置导入导出 | v2.4 | 3/3 | Complete   | 2026-06-05 |
| 27. Word 工具补全 | v2.4 | 3/3 | Complete   | 2026-06-06 |
| 28. Excel 工具补全 | v2.4 | 3/3 | Complete   | 2026-06-06 |
| 29. PPT 工具补全 + NFR-12 收口 | v2.4 | 3/3 | Complete   | 2026-06-06 |
| **30. WPS-02/03 真机验证探针（硬门）** | **v2.5** | 3/3 | **探针就绪·待真机 go/no-go** | — |
| **31. wpsjs 外壳 + 宿主识别 + 复用层 CEF 坐实** | **v2.5** | 1/1 | 🟡 code-drafted·真机 pending（投机预写，Phase 30 门未过；代码侧 tsc/build/test 全过） | — |
| **32. 单宿主 adapter read/write + operationLog 移植（Excel 滩头堡）** | **v2.5** | 1/1 | 🟡 code-drafted·真机 pending（投机预写；核心 9 方法 + WPS 集成测试 3/3 过；接缝零改动复用 Excel 工具） | — |
| **33. killer scenario 端到端 + 诚实收口** | **v2.5** | 0/? | Not started（条件：Phase 30 = go） | — |

---

*Last updated: 2026-06-08 — 🟡 **v2.5「登陆 WPS（滩头堡）」roadmap 创建**（`/gsd-new-project` roadmapper）。4 phases（30–33）/ 9 需求全映射（WPS-02..10）。证据优先分阶段：Phase 30 = 硬门探针（go/no-go），Phases 31–33 = 条件于 go。**两条 make-or-break 串行：CEF/React19 可行性（第 1 步）→ DeepSeek SSE 直连不被 WPS CSP/CORS 拦（第 2 步）**；任一挂即 no-go，里程碑干净收口在 Phase 30，不写任何适配代码。首宿主（Excel vs PPT）开放决策，待 Phase 30 真机数据 + discuss-phase 裁定（Phase 32 开工前锁定）。Phase 编号从 30 续接（v2.4 止于 Phase 29，不 reset）。*
*Earlier: 2026-06-08 — ✅ **v2.4「扩疆域」收官归档**（`/gsd-complete-milestone`）。5 phases（25–29）全部折叠归档，phase 明细见 `milestones/v2.4-ROADMAP.md`、需求存档 `milestones/v2.4-REQUIREMENTS.md`。v2.4：5 phase / 12 plans / ~112 commits（v2.3 tag `3bb7bc9`..v2.4 区间）/ **本机 82.48KB / 线上 80.03KB bundle**（≤100KB gate，2026-06-05 上调自 82KB）/ **1137 tests green / 0 failed** / tsc 0 / 0 净新增运行时依赖 / **16/17 需求交付**（C 11 + 配置 3 + NFR 1 + WPS-01；WPS-02 真机层 ⏸️ 延后）/ 三宿主 Office for Web 真机 UAT 全 PASS（12/12 区块，北极星 + 3 分水岭，0 阻塞 bug）/ tag `v2.4`（线上 `41e4d70`）。收官修正 1 项 stale checkbox（WPS-01，**第 6 次复发**）。*
*Earlier: 2026-06-05 — 🟡 **v2.4「扩疆域」roadmap 创建 + 重排**。5 phases（25–29）/ 17 需求全映射（WPS-01/02 + CFG-01~03 + WORD-06~10 + EXCEL-11~13 + PPT-09~11 + NFR-12）。**用户重排（2026-06-05）**：配置导入导出提前至 Phase 26（独立于 C 工具线，提前交付"换机搬家"实用价值），C 工具线顺延 Word 27 / Excel 28 / PPT 29；NFR-12 bundle 收口移至末位实现 phase（29 PPT，全代码就位才收口）。Phase 25 WPS spike 仍首个（WPS-02 真机层可与 26–29 并行异步）。Phase 编号从 25 续接（v2.3 止于 Phase 24，不 reset）。*
*Earlier: 2026-06-05 — ✅ **v2.3「精装与定力」收官归档**（`/gsd-complete-milestone`）。5 phases（20–24）全部折叠归档，phase 明细见 `milestones/v2.3-ROADMAP.md`。v2.3：5 phase / 10 plans / 98 commits（v2.2..v2.3 区间）/ **81.3 KB bundle**（≤82KB，余量 ~0.7KB）/ **1075 tests green / 0 failed** / tsc 0 / 0 净新增运行时依赖 / 13/13 需求 / 三宿主真机 UAT 全过（11 个真机 bug 全修）/ PVQ-06 spike-gate 判铺开 / tag `v2.3`（线上 `1fe9529`）。收官修正 11 项 stale checkbox（CTX-01~06 + PVQ-01~05，第 5 次复发）。*
