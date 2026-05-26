# Aster

## What This Is

Aster 是一个面向中文职场用户的 Office.js Add-in，跑在 PowerPoint / Excel / Word 三个宿主之上，通过 LLM（DeepSeek-V4）与图像模型（aihubmix）把"一键文档操作 + 多轮聊天"两种 AI 提效形态直接嵌进原生 Office。定位在 Microsoft Copilot 与浏览器版 ChatGPT 之间——开源、BYO Key、无后台。

## Core Value

**在原生 Office 内部，让中文职场用户用自带 API Key 享受到 AI 提效，无需切网页、无需订阅 Copilot、无需把数据交给中间服务器。** 如果这一点失败（比如必须复制粘贴出 Office 才能用 AI），整个产品就没有意义。

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current v1.0 scope. All requirements are hypotheses until shipped and validated. -->

**功能性（PRD F1-F8）**

- [ ] **F1 Task Pane** — 右侧聊天面板，多轮对话 + 文件上传 + 选中上下文 + 流式 + "插入到文档"
- [ ] **F2 Ribbon 6 个一键按钮** — 每宿主 2 个，候选见 PRD（UX 阶段定稿）
- [ ] **F3 可插拔 Provider 架构** — 默认 DeepSeek + aihubmix，可新增 OpenAI 兼容 Provider
- [ ] **F4 文件上传与解析** — txt/md/csv/json/docx/xlsx/pptx/pdf/图片，解析库懒加载
- [ ] **F5 设置与 Key 管理** — Office RoamingSettings 存储，首启 Onboarding 引导
- [ ] **F6 流式输出** — 所有 LLM 调用 fetch streaming，首 token ≤ 2s
- [ ] **F7 错误处理** — Key 失效 / 配额超限 / context 超长 / 网络失败均给可操作提示
- [ ] **F8 写回文档** — 三宿主各自的 insert / replace API 覆盖（slide / cell / paragraph）

**PPT 杀手场景（3 个）**

- [ ] 主题文本 → 多页幻灯片大纲
- [ ] 选中 slide 一键配图（生图 + 图库二选一）
- [ ] 大段文字 → bullet 要点压缩

**Excel 杀手场景（3 个）**

- [ ] 自然语言 → 公式（含相对/绝对引用）
- [ ] 公式解释 + 报错调修
- [ ] 数据清洗 / 拆列

**Word 杀手场景（3 个）**

- [ ] 多风格润色 / 改写
- [ ] 长文总结（TL;DR + 关键要点）
- [ ] 大纲 → 长文生成

**非功能（PRD N1-N5）**

- [ ] **N1 跨平台 API 子集** — 只用 Office.js Web / Windows 都支持的 API
- [ ] **N2 包体积** — 初始加载 JS ≤ 1MB（解析库 + Provider SDK 懒加载）
- [ ] **N3 性能** — 单条 prompt 端到端 P95 ≤ 10s
- [ ] **N4 安全** — API Key 永不上传 Aster 自有服务器（无后台）
- [ ] **N5 隐私透明** — Onboarding + README 明确告知"选中内容会发往 Provider"

**MVP 平台**

- [ ] Office for Web（Edge / Chrome 最新两版）三宿主可 sideload 并正常运行

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
| BYO Key + Office RoamingSettings | 开源 + 无后台路线下唯一可行方案；用户级、跨文档可用 | — Pending |
| MVP 只做 Office for Web | API 一致性最强、安装门槛最低、迭代最快；Desktop 推 v1.1 | — Pending |
| pptx 解析 MVP 仅提文本，不保真 | 浏览器侧 OOXML 全保真成本过高（R3）；不支持则降级到"不可上传 pptx" | — Pending |
| Provider 抽象层（Phase 2）作为后续所有 AI 调用基础 | 后续 4-7 phase 都依赖；质量门槛最高的基础模块 | — Pending |
| Phase 0 spike 1 周时间盒 | 最高风险消减（R1/R2/R3）；spike 完才能决定 PPT 写回是否要降级 | — Pending |

## Open Questions（不阻塞 PRD，spike / UX / 后续 phase 解决）

- **Q1**：免费图库选 Unsplash vs Pexels（spike 对比 API 限额、中文搜索质量、商用授权）
- **Q2**：聊天历史本地持久化（IndexedDB）—— v1 不做，v1.1 评估
- **Q3**：英文 i18n 进度 —— v1.1
- **Q4**：v1 量化成功指标 —— 待项目作者补充（GitHub stars / 周活跃 sideload / 单次操作完成率）
- **Q5**：6 个 Ribbon 按钮的最终选型 —— UX 阶段做用户访谈或自身使用验证
- **Q6**：DeepSeek-V4 是否原生多模态 —— Phase 0 spike 从官方文档 + 实际 API 验证

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
*Last updated: 2026-05-26 after initialization from PRD (prds/2026-05-26-aster-office-addin/PRD.md)*
