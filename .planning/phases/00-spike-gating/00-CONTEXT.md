# Phase 0: Spike & 风险验证 (GATING) - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

**Phase 0 不交付代码或 v1 需求**——它是一个 ≤ 1 周硬时间盒的风险消减 spike，对 10 项最高风险做实证验证，决定 PRD 与架构能否进入 Phase 1。

- **GATING（红线）**：CORS / PPT 写回 / 存储 scope 三项任一 fail → 立即停下来修订 PRD，不进 Phase 1
- **非 GATING**：其余 7 项（API mixing、getSelectedSlides reverse、pdf.js worker、pptx jszip、bundle baseline、sideload checklist）fail 不止损，记录 fallback
- **输出**：每项 pass/fail 决策 + 证据归档 + GATING 报告。10 项验收清单本身在 Phase 7 由 REL-05 作为 regression 重跑

**本次讨论范围：** 不重新决定"验证什么"（已在 ROADMAP success criteria #1-#5 锁定），而是锁定"怎么验证"——4 项 spike 执行操作决策。

</domain>

<decisions>
## Implementation Decisions

### 生产托管（GATING #1 CORS 验证前置）

- **D-01: 平台**：GitHub Pages
  - 理由：免费、与仓库同源、零账号额外负担、贴合"开源副业"定位
  - 取舍：放弃 `Cache-Control: public, max-age=3600` 自定义（GitHub Pages 默认 10min 不可改）—— INSTALL-05 由 Phase 1 处理；如 #10 sideload 暴露图标失效，Phase 1 评估迁 Cloudflare Pages
- **D-02: URL 形态**：仓库 root（形如 `wb-chen.github.io/aster` 或对应 GitHub username 路径）
  - 不上 custom domain。v1.0 发布前如有需要再迁
- **D-03: 部署触发**：main push 自动部署（GitHub Actions workflow）
  - Phase 0 反复 push 验证频率高，自动化是必要的；spike 分支模型会拖慢迭代

### Spike 执行节奏

- **D-04: 顺序**：严格 gate-first
  - Day 1-2 **只跑 GATING #1 CORS + #2 PPT 写回 + #3 存储 scope**
  - 三项全 pass 后才启动 Day 3-5 的其余 7 项
  - 理由：fail-fast，避免 GATING 失败时浪费 50%+ 时间盒
- **D-05: GATING 失败止损规则**：立即止损 + 会诊重估
  - 任一 GATING fail = 当天停掉后续 spike
  - 当天写 1-2 页"GATING #X failed" 决策备忘（现象 / 已尝试 / Plan B 选型 / PRD scope 影响）
  - 全项目进入 PRD 修订状态，不进 Phase 1

### CORS Fallback（OQ-6 预提锁定）

- **D-06: CORS fail 触发的恢复路径**：直接走 Cloudflare Worker 代理
  - 不走"drop Provider"路径——v1 功能范围不因 CORS 失败而缩水
  - **形态锁定**：Cloudflare Worker（serverless 边缘函数，免费 100k 请求/天，零运维，不需要 ICP 备案）
  - 不选阿里云 VM（备案 2-3 周 + 持续运维成本 + 与"开源副业"定位脱节）
  - 不选 Vercel Edge（与 CF Worker 同类，仅在已有 Vercel 账号偏好时考虑）
- **D-07: CORS fallback 触发后的连带调整（仅 fail 时生效）**：
  - Onboarding 文案追加"用户请求经 Worker 透明转发，Key 不存"说明
  - PROJECT.md Core Value 第一句需小调整（不再 100% 无后台）
  - 这些是 fail 后的连带 work，**不在 Phase 0 主要交付物里**——只在 GATING #1 实际 fail 时由 PRD 修订处理

### Spike 代码与证据归档

- **D-08: 代码处理**：丢弃式
  - 所有 spike 代码放 `spike/` 顶层目录，与正式仓库代码隔离
  - Phase 1 从 Yo Office 重新起步，不复用 spike hack
  - `spike/README.md` 明确写"本目录是 Phase 0 验证代码，不是 v1 实现"——避免后续贡献者混淆
- **D-09: 证据归档位置**：`.planning/spikes/00X-{slug}/` 一项一子目录
  - 例：`001-cors-verify/`、`002-ppt-writeback/`、`003-storage-scope/`...
  - 每个子目录含：脚本/录屏/响应头截图/`findings.md`（pass/fail + 证据指针 + 决策）
  - 顶层 `.planning/spikes/MANIFEST.md` 列 10 项 + pass/fail 状态 + 链接到详情
  - Phase 7 REL-05 regression 重跑直接对照此 MANIFEST
- **D-10: 仓库可见度**：全部 commit 进开源仓库
  - 代码 + 证据 + MANIFEST 均推 GitHub
  - 视频如超 100MB 单文件限制 → 走 GitHub Release attachments
  - 透明化 = 开源用户能看到决策依据 + future-self 能复现 + REL-05 起点是公开可访问的

### DeepSeek-V4 多模态验证

- **D-11: 验证三步法**：
  1. 读 DeepSeek API 官方文档 + change log（15 分钟）——确认是否明言支持多模态
  2. 实际发一次 `image_url` 请求到 `deepseek-v4-pro`（30 分钟 + 几分钱）——200 状态 + 合理图像描述 = pass
  3. fail → 锁定 aihubmix vision 为 v1 唯一图片通路（PRD R2 fallback 已知，**不止损**）
- **D-12: 默认 vision routing 决策推迟**：
  - 即使 DeepSeek 支持多模态，"是否切默认 vision provider 为 DeepSeek" 不在 Phase 0 范围
  - 留到 Phase 2 `ProviderRegistry.resolve('vision')` 实现时决定

### Claude's Discretion

下列由 Claude/planner 决定，不需要用户预先锁定：
- spike 代码的具体目录结构（`spike/cors-test.html` 还是 `spike/001-cors/index.html`）
- GitHub Actions workflow 的具体内容（trigger / build steps / cache）
- 各 spike 项的具体测试脚本写法
- `findings.md` 的模板（建议含：场景 / 步骤 / 实测结果 / 证据链接 / pass-fail / 备注）
- `MANIFEST.md` 的具体表格设计

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents（researcher / planner）MUST 读这些文件，决策依据全在里面。**

### 核心规划

- `.planning/ROADMAP.md` — Phase 0 success criteria（10 项验收清单 + GATING 标记 + 与 REL-05 的 regression 链接）
- `.planning/REQUIREMENTS.md` — 78 v1 需求；Phase 0 不直接交付任何 REQ-ID，但 REL-05 把 10 项 spike 作为 regression
- `.planning/PROJECT.md` — Core Value（"无后台"硬约束的源头）、Key Decisions、Open Questions Q1-Q6
- `prds/2026-05-26-aster-office-addin/PRD.md` — 原始 PRD；R1-R6 风险 + AC1-AC8 验收 + Q1-Q6 开放问题；F5 存储 API 已被 SUMMARY.md 修正

### 研究产出

- `.planning/research/SUMMARY.md` — 4 个并行研究 agent 汇总；10 项 spike 清单的原始出处；OQ-1 至 OQ-7 用户决策点
- `.planning/research/PITFALLS.md` — 24 项 pitfall 编目；Phase 0 最相关的：
  - Pitfall 1（PowerPoint Web 写回 parity）→ GATING #2
  - Pitfall 2（`setSelectedDataAsync` 与 `PowerPoint.run` 混用挂死 #5022）→ spike #5
  - CORS catastrophic → GATING #1
- `.planning/research/STACK.md` — 已锁定的技术栈（Vite 7 / React 19 / Fluent UI v9 / Zustand 5 / Lingui 5）；spike 期间不再选型
- `.planning/research/ARCHITECTURE.md` — DocumentAdapter 分层模式（Phase 1+ 用，但 spike 中 PPT 写回测试不要污染该结构）
- `.planning/research/FEATURES.md` — Ribbon 按钮 6 选 + v1 gaps（grammar/spell、cost visibility、inline Key validation）

### 项目约束

- `CLAUDE.md` — 项目 constraints 摘要 + Tech Stack 完整推荐表 + Phase 0 spike 必验项的 stack-level 出处

### 外部参考（spike 验证时按需查阅）

- DeepSeek API 文档：https://api-docs.deepseek.com/ （D-11 Step 1）
- aihubmix 文档：https://docs.aihubmix.com/en （GATING #1 CORS 验证目标之一）
- Office.js bug 报告：
  - #5022 setSelectedDataAsync × PowerPoint.run 挂死 → spike #5
  - #3618 getSelectedSlides reverse → spike #6
- Microsoft Learn — Persist add-in state and settings（GATING #3 partitionKey 行为参照）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

**当前仓库无源代码——只有 `.planning/` 与 `prds/`。** Phase 0 是首个产出代码的阶段，但产出物归 `spike/`、不进入 v1 代码树。

### Established Patterns

无既有代码模式。但 STACK / ARCHITECTURE / PITFALLS 已锁定 Phase 1+ 将采用的模式：

- **DocumentAdapter 抽象层**（ARCHITECTURE.md）—— spike 阶段验证 `getSelection()` / `insertSlidesFromBase64` / `setSelectedDataAsync` 时**不要**搭这层，spike 是"能不能跑"，不是"怎么封装"
- **Office.js CDN script tag**（STACK.md）—— spike 直接用 `<script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js">`，NPM `@microsoft/office-js` 已 deprecated
- **CORS 由 Provider 服务器决定**（PITFALLS.md）—— spike #1 验证 `Origin: https://wb-chen.github.io` 是否被 DeepSeek/aihubmix 允许；客户端无法 bypass

### Integration Points

- **GitHub Pages 公开 URL** 即 manifest 的 SourceLocation（spike #10 sideload 测试用同一个 URL）
- **Office.js CDN 加载**—— GATING #1 验证 https 域名 CORS 同时验证 CDN 加载

</code_context>

<specifics>
## Specific Ideas

### 来自讨论的具体偏好

- **D-06 CORS fallback 走 CF Worker 而非 drop-provider**——用户明确表达"宁愿小幅妥协架构，也不缩水 v1 功能"。这是 Aster 在用户体验上的优先级信号
- **D-10 全部 commit 公开**——开源副业语境下，spike 决策本身就是项目透明度的一部分。future-self / 贡献者 / future-Claude 都能从 spike 证据回溯"为什么这么选"

### 来自研究的具体引用

- **CORS 80%+ 通过率预期**——DeepSeek 走 OpenAI 兼容协议（OpenAI 官方支持 `dangerouslyAllowBrowser`）+ aihubmix 是 API 中转服务（CORS 是其存在前提）。SUMMARY.md 标 CATASTROPHIC 是"万一 fail 后果重"，非"很可能 fail"
- **PPT 写回 Plan B 已锁定**——PITFALLS.md 把"copy-paste"路线否决，改为 `setSelectedDataAsync(html, {coercionType: Html})`。spike #2 验证主路径同时 smoke-test Plan B

</specifics>

<deferred>
## Deferred Ideas

### 推到 Phase 1+ 处理

- **INSTALL-05 图标 Cache-Control**：GitHub Pages 默认 10min 不可改。Phase 0 #10 sideload 测试时若图标失效有体感影响，Phase 1 评估迁 Cloudflare Pages
- **CORS fallback 触发后的 Onboarding 文案 + PROJECT.md Core Value 调整**：仅 GATING #1 真的 fail 时执行；属于 PRD 修订动作，不在 Phase 0 主交付
- **Default vision routing 决策**：DeepSeek 多模态 pass 后是否切默认 vision provider，留到 Phase 2 `ProviderRegistry` 实现时

### 推到后续 spike / Phase

- **Q1 图库 Unsplash vs Pexels**：ROADMAP Phase 0 的 10 项没包含此项，本次讨论也未深入。明确推到 Phase 4 PPT 杀手场景规划阶段（PPT-02 配图功能开发前 1-2 小时对比 API 限额 + 中文搜索质量 + 商用授权）
- **Q4 量化成功指标 / 遥测决策**：PRD Q4 / SUMMARY.md OQ-5。Phase 7 REL-06/REL-07 之前定，Phase 0 不涉及
- **Q5 6 个 Ribbon 按钮最终选型**：SUMMARY.md FEATURES 已给出推荐分配（PPT 主题→大纲 + 配图，Excel 自然语言→公式 + 公式解释，Word 多风格润色 + TL;DR）。Phase 1 写 manifest 时确认；Phase 4-6 实施时确认

### 不做（避免 scope creep）

- **PRD F5 存储 API 修正流程**：已在 KEY-01 完成；Phase 0 spike #3 是验证"修正后的 partitioned localStorage 是否真符合预期"，不是重新讨论存储方案
- **Phase 1 expansion 是否合理**：已在 ROADMAP 锁定；Phase 0 spike 不重新评估
- **加 v1 v2 stretch 项目到 Phase 0**：所有 Stretch 已在 REQUIREMENTS.md 标记，Phase 0 严格只做 10 项验收

</deferred>

---

*Phase: 00-spike-gating*
*Context gathered: 2026-05-26*
