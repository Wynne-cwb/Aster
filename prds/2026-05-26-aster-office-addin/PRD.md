# Aster PRD

> Office.js AI Add-in for PPT / Excel / Word
> Owner: wb.chen
> Date: 2026-05-26
> Status: Draft v1 — pending GSD planning

## Background

Aster 是一个面向中文职场用户的 Office.js Add-in，运行在 PowerPoint / Excel / Word 三个宿主之上，通过 LLM 与图像模型为日常文档操作提供 AI 提效能力。

- **运营形态**：个人副业 / 开源项目，无后台服务、无账号体系、无计费。
- **集成模型**：
  - LLM 主：DeepSeek `deepseek-v4-pro`（OpenAI 兼容协议）
  - LLM 轻量档：DeepSeek `deepseek-v4-flash`（短任务降本）
  - 生图与视觉：aihubmix `gpt-image-2` 及同源多模态视觉模型
  - 图库检索：Unsplash 或 Pexels（spike 阶段二选一）
- **Key 管理**：用户自带 API Key（BYO），存储在 Office RoamingSettings（用户级、不随文档共享）。
- **MVP 平台**：Office for Web（Edge / Chrome）。v1.1 扩展到 Windows 桌面端。Mac 推迟。

## Problem

中文职场用户在三个 Office 宿主里有三组真实且高频的痛点：

1. **PPT**：做汇报/周报/方案时，排版慢、文字堆砌、找配图困难，导致从草稿到能用的成稿需要数小时。
2. **Excel**：公式记不住、看不懂别人写的公式、报错时不知如何修复；数据清洗与字段拆分依赖手工或 VBA。
3. **Word**：写报告/合同/长文档时，润色、翻译、生成大纲、统一风格等环节重复劳动多。

现有方案的不足：
- **Office 365 Copilot**：能力强但需企业订阅、价格高、对中文场景调优一般。
- **WPS AI**：中文好但平台锁定 WPS，无法在原生 Office 中使用。
- **浏览器里的 ChatGPT/DeepSeek 网页版**：每次需要复制粘贴、丢失文档上下文、无法直接写回。

Aster 在原生 Office 内提供"轻量、可控、可自带 Key"的 AI 提效层，定位介于"Copilot"和"网页版 ChatGPT"之间。

## Goals

MVP（v1.0）必须达成：

1. **PPT 宿主**提供三个杀手场景：
   - 一键从主题文本生成多页幻灯片大纲（N 张 slide）。
   - 选中 slide 一键配图（生图 + 图库检索，二选一）。
   - 一键润色 / 压缩（大段文字 → 要点式 bullet 结构）。
2. **Excel 宿主**提供三个杀手场景（第 4 个为 v1.1 Stretch）：
   - 自然语言 → 公式（含相对/绝对引用）。
   - 公式解释 + 报错调修。
   - 数据清洗 / 拆列（地址拆分、日期统一等）。
3. **Word 宿主**提供三个杀手场景：
   - 多风格润色 / 改写（严谨、口语化、简洁、抒情等）。
   - 长文总结（TL;DR + 关键要点列表）。
   - 大纲 → 长文生成。
4. **通用能力（跨三宿主）**：
   - Task Pane 多轮聊天 + 文件上传 + 选中上下文展示 + "插入到文档"按钮。
   - Ribbon 一键按钮（每宿主 2 个、共 6 个）。
   - 文件上传支持：txt / md / csv / json / docx / xlsx / pptx / pdf / 图片（多模态）。
   - 可插拔 Provider 架构：默认 DeepSeek + aihubmix；用户可在设置中添加自定义 Provider 与 Key。
5. **MVP 平台**：Office for Web，Edge / Chrome 主流版本可 sideload 并正常运行。

## Stretch Goals (v1.1)

- Excel 第 4 个场景：选中数据 → 一键生成图表 + 三句话洞察。
- Windows 桌面版兼容（同一份 manifest，验证三宿主可用）。
- 英文 i18n（界面双语切换）。

## Non-Goals

明确不做（避免后续 GSD 阶段 scope creep）：

- Mac 桌面版（v1 不验证）。
- iOS / Android Office 移动端（API 限制大，不在范围）。
- 企业 SSO、账号体系、Token 计费、订阅。
- 自训练模型、模型微调。
- AppSource 商店上架（v1 仅 sideload + 开源仓库 manifest）。
- VBA / Office Script 代码生成（与"一键操作"路线冲突）。
- 真人语音朗读 PPT / PPT 自动演讲。
- 协作能力（多人共编、评论）。
- 聊天历史本地持久化（v1 仅内存级，关闭 Task Pane 即丢失；v1.1 评估）。

## Target Users

- **主要用户**：中文职场白领。
  - 角色：产品经理、运营、市场、销售、数据分析师、财务、HR。
  - 工作场景：写汇报、出方案、做表算账、写合同/邮件。
- **技术门槛**：能根据 README 完成 sideload manifest 安装、能从 DeepSeek / aihubmix 控制台获取 API Key 并粘贴到 Aster 设置里。
- **语言**：UI 默认中文。英文 i18n 列为 v1.1 Stretch。

## User Stories

PPT
- 作为运营，我把月报文字稿复制进 Aster，让它一键生成 8 页 PPT 大纲（标题 + 要点）插入到当前 PPT。
- 作为产品经理，我选中某张 slide，告诉 Aster"配一张和'用户增长'相关的配图"，Aster 自动给出生图与图库两个候选，我点击其一插入。
- 作为销售，我把现有 slide 上的一大段说明文字一键压缩为 3 条 bullet。

Excel
- 作为财务，我选中销售明细的某列，告诉 Aster"算每个门店近 30 天均值"，Aster 给我可粘贴的 AVERAGEIFS 公式。
- 作为数据分析师，我选中一个 #REF! 报错的公式，让 Aster 解释错在哪、应该怎么改。
- 作为运营，我选中"地址"列，让 Aster 拆分为"省 / 市 / 区"三列并预览结果后写回。

Word
- 作为产品经理，我选中一段需求描述，让 Aster 改写为"对外严谨"风格。
- 作为咨询顾问，我把一份长报告丢给 Aster，让它给我 TL;DR 和 5 条关键要点。
- 作为新人，我给 Aster 一个标题与 5 条要点，让它生成一份完整的多段落报告草稿。

通用
- 作为任意用户，我上传一份 PDF 报告 + 一张截图，让 Aster 基于报告内容回答问题，并在当前文档里生成对应内容。

## Requirements

### 功能性需求

- **F1 Task Pane**：右侧聊天面板，支持多轮对话、文件上传、当前选中上下文展示、流式输出、"插入到文档"按钮。
- **F2 Ribbon 一键按钮**：每个宿主提供 2 个一键按钮（共 6 个），点击预填 prompt 并执行 → 结果在 Task Pane 可见、可一键写回文档。具体按钮选型在 UX 阶段定稿（见 Q5），下方为当前候选：
  - PPT 一键按钮（候选）：① 主题→大纲；② 选中 slide 配图。
  - Excel 一键按钮（候选）：① 自然语言→公式；② 公式解释。
  - Word 一键按钮（候选）：① 多风格润色；② 大纲→长文。
- **F3 Provider 架构**：可插拔的 LLM / Image / Vision provider，默认 DeepSeek + aihubmix；用户可在设置中新增 OpenAI 兼容 Provider 及对应 Key。
- **F4 文件上传与解析**：
  - 纯文本：txt / md / csv / json → 直接读字符串。
  - Office：docx（mammoth.js）、xlsx（SheetJS）、pptx（OOXML 解包，MVP 仅提取文本）。
  - PDF：pdf.js 抽取文本（扫描件不在 MVP 保真范围）。
  - 图片：直接走多模态 Provider（默认 aihubmix vision），不做本地 OCR。
  - 所有解析库**懒加载**，按上传文件类型动态 import。
- **F5 设置与 Key 管理**：
  - Key 存储在 Office RoamingSettings（用户级、不随文档共享）。
  - 首次启动 Onboarding：引导用户填写 DeepSeek Key + aihubmix Key（至少 DeepSeek 必填）。
  - 设置面板允许新增/编辑/删除自定义 Provider。
- **F6 流式输出**：所有 LLM 调用支持流式（fetch streaming），首 token 体验 ≤ 2s（DeepSeek 网络正常时）。
- **F7 错误处理**：Key 失效、配额超限、context 超长、网络失败等场景均给出可操作提示（"去设置改 Key" / "切换 flash 模型" / "上传文件过大请裁剪"）。
- **F8 写回文档**：
  - PPT：能新建 slide 并填充标题 + 内容；能在选中 slide 上替换/插入文本与图片。
  - Excel：能将公式字符串写入选中单元格；能将清洗后的数据写入选中区域。
  - Word：能替换选中文本（保留基本样式）；能在光标处插入新段落。

### 非功能性需求

- **N1 跨平台 API 约束**：MVP 只使用 Office.js 中跨 Web / Windows 都支持的 API 子集。在 Office.js capabilities matrix 中确认每个 API 的 Web 支持后再用。
- **N2 包体积**：初始加载 JS bundle ≤ 1MB（解析库懒加载、Provider SDK 按需 import）。
- **N3 性能**：单条 prompt 端到端 P95 ≤ 10s（含 LLM 流式首 token；DeepSeek 网络正常）。
- **N4 安全**：API Key 永远不上传任何 Aster 自有服务器（无后台）；所有 LLM/图像调用从用户浏览器直连 Provider。
- **N5 隐私透明**：在 Onboarding 与 README 明确告知"选中的文档内容会发送到所配置的 Provider"。

## UX / Interaction Notes

- **形态**：Hybrid Action + Chat。Ribbon 按钮 = 确定性一键动作；Task Pane = 开放聊天 + 文件上传 + 多轮对话。
- **Task Pane 布局（默认 350px 宽，可调）**：
  - 顶部：当前上下文卡片（宿主感知）——显示"当前选中：X" / "当前 slide：第 N 张" / "已上传：文件名"。
  - 中部：聊天流（用户气泡 + AI 气泡 + "插入到文档"动作按钮）。
  - 底部：输入框 + 文件上传图标 + Provider 切换下拉。
- **Ribbon 按钮交互**：
  - 点击 = 直接执行（基于当前选中），不打开模态。
  - 执行中：Task Pane 自动打开并展示进度 + 流式输出。
  - 执行完：在 Task Pane 中提供"插入到文档"按钮（用户可二次审阅再写回）。
- **Onboarding**：首启 modal，2 步——① 选默认 Provider + 填 Key；② 简短功能介绍卡片（每宿主一张）。

## Data / Integration Needs

- **DeepSeek API**：`deepseek-v4-pro`（默认） / `deepseek-v4-flash`（短任务降本）。OpenAI 兼容协议，HTTP 直连。
- **aihubmix API**：`gpt-image-2`（生图） + 视觉模型（多模态文件理解，型号在 spike 阶段确认）。
- **图库 API**：Unsplash 或 Pexels（spike 阶段对比 API 限额、商用授权、中文搜索质量后选一）。
- **文件解析库**：
  - `mammoth.js`（docx）
  - `xlsx` / SheetJS（xlsx）
  - `pdf.js`（pdf）
  - pptx：评估 `pptx-parser` 或自实现 OOXML 解包 + XML 解析。
- **无后台服务**：所有请求从浏览器直连第三方 API；无数据持久化（v1 不做聊天历史云同步）。

## Acceptance Criteria

- **AC1 — 安装**：在 Edge 与 Chrome 中 sideload Aster manifest 后，PPT for Web / Excel for Web / Word for Web 三个宿主均能成功打开 Task Pane，无 console error。
- **AC2 — Ribbon 写回**：六个 Ribbon 一键按钮全部可触发，并能正确写回文档：
  - PPT：成功插入新 slide 或替换选中 slide 内容。
  - Excel：成功将公式字符串写入选中单元格、清洗结果写入指定区域。
  - Word：成功替换选中文本、在光标处插入新段落。
- **AC3 — 文件上传**：上传一份 docx、一份 pdf、一份 xlsx、一张图片，各自能正确解析并被后续对话使用（图片走多模态、其余抽文本）。
- **AC4 — 设置流**：API Key 未填时，所有 AI 操作引导至 Onboarding；Key 填错时给出明确错误（"Key 无效"而非"网络错误"）。
- **AC5 — 性能**：单条 prompt 端到端 P95 ≤ 10s（DeepSeek 直连、5MB 以内文件）。
- **AC6 — 持久化**：切换文档不丢 API Key；切换 Microsoft 账号会丢 Key（RoamingSettings 是用户级，符合预期）。
- **AC7 — MVP 浏览器兼容**：MVP 在 Edge / Chrome 桌面浏览器最新两版均正常工作（PPT / Excel / Word for Web 三宿主）。
- **AC7.1 — v1.1 Windows 兼容（Stretch）**：v1.1 阶段在 Windows Office Desktop 三宿主验证 Task Pane + 6 个 Ribbon 按钮可用。
- **AC8 — 流式**：所有 AI 输出为流式渲染（用户能看到逐字输出），首 token ≤ 2s。

## Risks

- **R1 Office.js Web 写回 API 受限**：尤其 PPT 的 slide 插入与样式保真在 Web 版可能有 API gap。
  - **Mitigation**：MVP 启动前一周做 spike，验证三宿主写回 API；如 PPT 插入 slide 不可用则降级为"生成内容到 Task Pane，用户复制粘贴"。
- **R2 DeepSeek-V4 多模态能力未确认**：是否原生支持视觉输入待文档核实。
  - **Mitigation**：PRD 已规划 fallback——图片走 aihubmix 视觉 Provider，与文本 Provider 分离。
- **R3 pptx 解析复杂度**：OOXML 解包 + XML 解析在浏览器侧成本高。
  - **Mitigation**：MVP 仅提取 pptx 文本，不解析样式、不解析图片；如开源库不可用，pptx 列入"不支持上传"列表。
- **R4 BYO Key 体验门槛**：开源用户填 Key 是流失环节。
  - **Mitigation**：README + 视频引导 + Onboarding 内嵌"如何获取 DeepSeek Key"链接；后期可探索社区试用 Key 池。
- **R5 跨宿主 API 一致性**：Office.js 在 PPT / Excel / Word 三宿主的 API 不统一，需要 host-specific 适配层。
  - **Mitigation**：架构设计阶段定义统一的"DocumentAdapter"抽象，三个宿主各实现一份。
- **R6 单文件超 context window**：上传大 PDF 时超出 DeepSeek 上下文。
  - **Mitigation**：解析后做长度检测，超长给出"截断 / 切片 / 升级 Provider"提示；v1 暂不做 RAG。

## Open Questions

以下问题不阻塞 PRD 完成，将在 GSD 规划或 spike 阶段解决：

- **Q1**：免费图库选 Unsplash 还是 Pexels？（spike 阶段对比限额、中文搜索质量、商用授权）。
- **Q2**：聊天历史是否做本地持久化（IndexedDB）？v1 默认内存级；v1.1 评估。
- **Q3**：英文 i18n 是否进 MVP？当前规划在 v1.1。
- **Q4**：成功标准的量化目标（GitHub stars / 周活跃 sideload 用户 / 单次操作完成率）需要项目作者给出 v1 验收数字。
- **Q5**：六个 Ribbon 按钮的最终选型——当前规划每宿主 2 个，但具体哪 2 个最值得"一键化"，需在 UX 阶段做用户访谈或自身使用验证。
- **Q6**：DeepSeek-V4 是否原生多模态，需要 spike 阶段从官方文档与实际 API 调用验证。

## GSD Handoff Notes

### 建议的 phase 切分

- **Phase 0 — Spike（≤ 1 周）**：验证 Office.js Web 三宿主写回 API、DeepSeek-V4 多模态能力、pptx 浏览器解析可行性。Spike 产出决定 R1/R2/R3 的最终对策。
- **Phase 1 — Foundation**：Add-in 脚手架（Yeoman / Office Add-in CLI），三宿主 manifest 配置，Task Pane 框架，Ribbon 占位。
- **Phase 2 — Provider 抽象 + Settings + Onboarding**：可插拔 Provider 接口，RoamingSettings 读写，Onboarding 流程，错误处理框架。
- **Phase 3 — 文件上传与解析**：lazy-loaded 解析器集成（mammoth / SheetJS / pdf.js / pptx），多模态图片走视觉 Provider。
- **Phase 4 — PPT 三功能 + 2 个 Ribbon 按钮**。
- **Phase 5 — Excel 三功能 + 2 个 Ribbon 按钮**（Stretch：图表 + 洞察）。
- **Phase 6 — Word 三功能 + 2 个 Ribbon 按钮**。
- **Phase 7 — 跨宿主 polish + Sideload 文档 + 开源 README + 发布 v1.0**。

### 关键依赖

- Phase 0 → 1 → 2 → 3 是顺序依赖。
- Phase 4 / 5 / 6 可并行（不同宿主、不同人/分支可同时推进）。
- Phase 7 依赖 Phase 4-6 完成。

### 优先重点

- Phase 0 spike 是最高风险消减项，建议先做且时间盒严控（1 周内）。
- Provider 抽象（Phase 2）是后续所有 AI 调用的基础，质量门槛要拉高。
- 第一个完成的宿主（建议 PPT，因为是首启动机最直观的展示）应作为参考实现，其余两宿主复刻其架构。
