# Requirements: Aster

**Defined:** 2026-05-26
**Core Value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 AI 提效，无需切网页、无需订阅 Copilot、无需把数据交给中间服务器。

来源：`prds/2026-05-26-aster-office-addin/PRD.md` + `.planning/research/SUMMARY.md` + 用户在 GSD 初始化时的决策。

---

## v1 Requirements

### 安装与浏览器兼容（INSTALL）

- [ ] **INSTALL-01**：单一 XML manifest 包含 3 个 `<Host>` 声明（Presentation / Workbook / Document）与 `<Runtime lifetime="long"/>` shared runtime
- [ ] **INSTALL-02**：每个 `<Host>` 内部独立声明 `<Requirements>`（不要放顶层——会阻断其他宿主加载）
- [ ] **INSTALL-03**：在 Edge / Chrome 最新两版 sideload manifest 后，PPT for Web / Excel for Web / Word for Web 三宿主均能打开 Task Pane，无 console error（PRD AC1）
- [ ] **INSTALL-04**：Office.js 从 CDN 加载（`https://appsforoffice.microsoft.com/lib/1/hosted/office.js`），不使用已废弃的 `@microsoft/office-js` npm 包
- [ ] **INSTALL-05**：Manifest 图标 host 端配置 `Cache-Control: public, max-age=3600`，避免 sideload 图标失效
- [ ] **INSTALL-06**：生产托管（GitHub Pages 或 Vercel）+ HTTPS + 正确 CSP，sideload 流程文档化在 README

### 基础设施与跨宿主抽象（FOUND，Phase 1 扩大范围）

- [ ] **FOUND-01**：脚手架基于 Yo Office → eject 到 Vite 7 + `vite-plugin-office-addin`；构建产物纯静态
- [ ] **FOUND-02**：React 19 + TypeScript 5.7 strict + browserslist 限定 Edge ≥120 / Chrome ≥120
- [ ] **FOUND-03**：`Office.onReady()` 读 `info.host`，按宿主实例化对应 `DocumentAdapter`，通过 React Context 暴露
- [ ] **FOUND-04**：`DocumentAdapter` 接口定义 + `SelectionContext`（discriminated union）+ `InsertableContent`（discriminated union：text / paragraphs / bullets / formula / range-values / slides / image）+ `AdapterCapabilities`
- [ ] **FOUND-05**：`PptAdapter` / `ExcelAdapter` / `WordAdapter` 三个骨架，至少 `getSelection()` 返回真实数据；`capabilities()` 返回桩
- [ ] **FOUND-06**：类型化错误类层级——Provider 层：`KeyInvalidError` / `QuotaExceededError` / `ContextTooLongError` / `NetworkError`；Adapter 层：`HostApiError` / `UnsupportedOperationError`
- [ ] **FOUND-07**：CI 打包体积守卫，初始 JS bundle >1MB 则 CI 失败（`size-limit` 或 `vite-bundle-visualizer` 阈值）
- [ ] **FOUND-08**：Lingui 5 + Vite SWC 插件 i18n 脚手架，v1 只 ship zh-CN
- [ ] **FOUND-09**：Vitest 测试框架配置，adapter 骨架带 smoke test
- [ ] **FOUND-10**：三宿主各 1 个统一的「打开 Aster」Ribbon 入口按钮（PPT/Excel/Word 共 3 个），`Action=ShowTaskpane`，点击打开 Aster Task Pane；无功能动作按钮——所有 AI 能力在 Task Pane 内触发（含空状态用法提示引导）

### Provider 抽象与设置（PROV，Phase 2）

- [x] **PROV-01**：`LLMProvider` / `ImageProvider` / `StockImageProvider` 接口定义；OpenAI-compatible-first 设计
- [x] **PROV-02**：`OpenAICompatibleLLM` 单一实现服务 DeepSeek + 用户自定义 Provider（仅 baseURL / apiKey / model 不同）
- [x] **PROV-03**：aihubmix 视觉客户端 + image-gen 客户端（专用，不复用 OpenAI-compatible 路径）
- [x] **PROV-04**：`ProviderRegistry.resolve(taskKind)` 路由 chat / short-task / vision / image-gen / stock-image,无自动 fallback（错误显式抛给 UI）
- [ ] **PROV-05**：用户在 Settings 中可新增 / 编辑 / 删除自定义 OpenAI-compatible Provider 与对应 Key
- [x] **PROV-06**：流式输出实现——`src/lib/sse.ts` 约 40 行原生 `fetch` + `ReadableStream` SSE 解析；首 token ≤ 2s（DeepSeek 网络正常）（PRD AC8）
- [x] **PROV-07**：每个 LLM 请求都通过 `AbortController` 取消；Task Pane `visibilitychange` 隐藏时主动 abort；同一 Provider 单飞队列
- [x] **PROV-08**：8 类错误 UX 分类——KEY_INVALID / QUOTA / RATE_LIMIT / CONTEXT / NETWORK / FILTER / MODEL / IMAGE_QUOTA；每类对应可操作 CTA（"去设置改 Key" / "切换 flash 模型" / "上传文件过大请裁剪"）（PRD F7）
- [x] **PROV-09**：429 错误自动指数退避 + 遵守 `Retry-After`；billing 类错误不自动重试
- [x] **PROV-10**：ESLint 规则禁用 legacy 模型名（`deepseek-chat` / `deepseek-reasoner`，2026-07-24 退役）与 `openai` / `@anthropic-ai/sdk` 包导入

### 设置与 Key 管理（KEY,Phase 2）

- [x] **KEY-01**：API Key 存储使用 partitioned `localStorage`，键名通过 `Office.context.partitionKey` 分区（修正 PRD F5——`Office.context.roamingSettings` 是 Outlook 专用）
- [ ] **KEY-02**：首次启动 Onboarding modal,2 步——① 选默认 Provider + 填 DeepSeek Key（必填）+ aihubmix Key（选填）;② 简短功能介绍卡片（每宿主一张）
- [ ] **KEY-03**：Onboarding 与 README 明确告知"选中的文档内容会发送到所配置的 Provider"（PRD N5）
- [ ] **KEY-04**：API Key 永远不上传任何 Aster 自有服务器；所有 LLM / 图像调用从用户浏览器直连 Provider（PRD N4）
- [x] **KEY-05**：Key 持久化跨文档切换不丢；换浏览器或清除浏览器数据会丢（明确告知,修正 PRD AC6）

### Token / 成本可见性（COST,Phase 2 — Features 研究 gap）

- [x] **COST-01**：解析 OpenAI-compatible `usage` 字段（prompt_tokens / completion_tokens / total_tokens）
- [x] **COST-02**：聊天气泡下方显示成本徽章。内置 DeepSeek + aihubmix 显示"本次：N token · ¥X"（单价写死不可改，DeepSeek 官价 USD 经内置固定汇率换算为 ¥，只显总数不拆 prompt/completion）；自定义 Provider 不录单价，其徽章只显"本次：N token"无价格（修订：原"自定义 Provider 可在 Settings 输入单价"已作废，见 Phase 2 CONTEXT D-08/D-09/D-17）

### Task Pane（PANE,Phase 1-2 跨阶段）

- [ ] **PANE-01**：Task Pane 默认 350px 宽、可调;顶部上下文卡片（宿主感知,显示"当前选中"/"当前 slide"/"已上传文件"）+ 设置入口（齿轮）;中部聊天流;底部输入框 + 文件上传图标（修订：Provider 切换不放输入栏,改由顶部齿轮进入的设置页管理——见 Phase 2 CONTEXT D-07,与 Phase 1 已落地 InputBar 一致）（PRD F1）
- [ ] **PANE-02**：多轮对话,AI 输出流式渲染（逐字呈现）
- [ ] **PANE-03**：聊天历史仅内存级（v1 不持久化;关闭 Task Pane 即丢失）
- [ ] **PANE-04**：每条 AI 输出提供"插入到文档"按钮,写回通过对应宿主 Adapter

### 文件上传与解析（FILE,Phase 3）

- [ ] **FILE-01**：解析器分发 `src/parsers/index.ts` 按 MIME / 扩展名路由
- [ ] **FILE-02**：纯文本（txt / md / csv / json）直接 `text()` 读字符串
- [ ] **FILE-03**：docx → `mammoth` 抽文本（懒加载,~250KB chunk）
- [ ] **FILE-04**：xlsx → SheetJS CE（从 `cdn.sheetjs.com` 引入,非 npm 已废弃版本）抽表格文本（懒加载,~180KB）
- [ ] **FILE-05**：pdf → `pdfjs-dist` 抽文本,worker 通过 `new URL(..., import.meta.url)` 模式（避免 Vite 生产构建 broken）（懒加载,~150KB + 400KB worker）
- [ ] **FILE-06**：pptx → `jszip` + DOMParser 解 OOXML `<a:t>` 文本（MVP 仅提取文本,不解析样式/图片）（懒加载,~30KB）
- [ ] **FILE-07**：图片 → 直接走多模态 Provider（默认 aihubmix vision）,HEIC/BMP 客户端转 JPEG;>2MB 图片自动 resize 到 ≤1920px
- [ ] **FILE-08**：上传前做 MIME / 扩展名验证;pptx 用 ZIP 签名校验（避免恶意改扩展名）
- [ ] **FILE-09**：解析后长度检测,超出 Provider context window 给出"截断 / 切片 / 升级 Provider"提示

### PPT 杀手场景（PPT,Phase 4）

- [ ] **PPT-01**：主题文本 → 多页幻灯片大纲,N 张 slide 插入到当前 PPT（PRD Goals 1.1）。Ribbon 一键按钮（"主题→大纲"）
- [ ] **PPT-02**：选中 slide 一键配图——生图（aihubmix `gpt-image-2`）+ 图库（Unsplash 或 Pexels,spike 阶段决定）两个候选,用户点击其一插入（PRD Goals 1.2）。Ribbon 一键按钮（"选中 slide 配图"）
- [ ] **PPT-03**：大段文字 → bullet 要点压缩（Task Pane 内动作,无 Ribbon 按钮）（PRD Goals 1.3）
- [ ] **PPT-04**：写回——使用 `insertSlidesFromBase64` 插入新 slide（带模板 pptx）;或在选中 slide 上替换/插入文本与图片（PRD F8 PPT）
- [ ] **PPT-05**：`getSelectedSlides()` 调用结果按 `.index` 排序后再使用（绕过 Web 版反序 bug #3618）
- [ ] **PPT-06**：不混用 `setSelectedDataAsync` 与 `PowerPoint.run`（绕过 `context.sync()` 卡死 bug #5022）
- [ ] **PPT-07**：如 Phase 0 spike 确认 `insertSlidesFromBase64` 不可用,降级为 `setSelectedDataAsync(html, {coercionType: Html})` 在当前 slide 写入（修正 PRD R1 降级方案）

### Excel 杀手场景（XLS,Phase 5）

- [ ] **XLS-01**：自然语言 → 公式（含相对 / 绝对引用）,可粘贴到单元格（PRD Goals 2.1）。Ribbon 一键按钮（"自然语言→公式"）
- [ ] **XLS-02**：公式解释 + 报错调修,可解释 `#REF!` / `#VALUE!` 等并给出修复（PRD Goals 2.2）。Ribbon 一键按钮（"公式解释/调修"）
- [ ] **XLS-03**：数据清洗 / 拆列（地址拆省/市/区、日期统一、去空格等）,选中区域 + 自然语言指令 → 预览 → 确认后写回（Task Pane 内动作）（PRD Goals 2.3）
- [ ] **XLS-04**：`ExcelAdapter` 严格遵守 two-sync 规则（每个方法最多 2 次 `context.sync()`）
- [ ] **XLS-05**：批量写回使用 `range.values = 2DArray`（不要逐 cell 写）
- [ ] **XLS-06**：大量数据写入前 `suspendApiCalculationUntilNextSync()`
- [ ] **XLS-07**：操作 >100 个 proxy 时 `untrack()` 防内存泄漏
- [ ] **XLS-08**：数据清洗 LLM 调用按 50 行 batch 发送（不是逐行调用）

### Word 杀手场景（DOC,Phase 6）

- [ ] **DOC-01**：多风格润色 / 改写,下拉选「严谨 / 口语化 / 简洁 / 抒情 / 检查语法拼写」（含 Features 研究的 gap #1：语法/拼写检查作为下拉选项）（PRD Goals 3.1 + gap）。Ribbon 一键按钮（"多风格润色"）
- [ ] **DOC-02**：长文总结——TL;DR + 关键要点列表（PRD Goals 3.2）。Ribbon 一键按钮（"TL;DR"）
- [ ] **DOC-03**：大纲 → 长文生成,给标题 + 5 条要点,生成完整多段落报告草稿（Task Pane 内动作）（PRD Goals 3.3）
- [ ] **DOC-04**：写回——替换选中文本时保留基本样式（`insertText("Replace")` 前捕获 `styleBuiltIn` + font.*,写入后重新应用）;在光标处插入新段落（PRD F8 Word）

### 非功能性需求（NFR,跨阶段）

- [ ] **NFR-01**：初始加载 JS bundle ≤ 1MB（PRD N2）——由 FOUND-07 CI 守卫强制
- [ ] **NFR-02**：单条 prompt 端到端 P95 ≤ 10s（DeepSeek 网络正常、5MB 以内文件）（PRD N3 / AC5）
- [x] **NFR-03**：所有 LLM 调用支持流式,首 token ≤ 2s（PRD F6 / AC8）
- [ ] **NFR-04**：MVP 平台只用 Office.js Web / Windows 都支持的 API 子集（PRD N1）
- [ ] **NFR-05**：跨宿主 API 不一致通过 `DocumentAdapter` 抽象层吸收（PRD R5 mitigation）
- [ ] **NFR-06**：MVP 在 Edge / Chrome 桌面浏览器最新两版均正常工作（PPT / Excel / Word for Web 三宿主）（PRD AC7）

### 发布（REL,Phase 7）

- [ ] **REL-01**：开源仓库 README 包含 sideload 指南（动画 GIF + 30 秒视频）
- [ ] **REL-02**：Manifest 在 GitHub Release 页面发布（Office Web 不支持 load-from-URL,用户需下载本地 sideload）
- [ ] **REL-03**：Privacy doc 列明"哪些数据会发往 Provider,哪些不会"
- [ ] **REL-04**：AC1-AC8 验收矩阵在 Edge + Chrome + fresh profile + 3 宿主全部通过
- [ ] **REL-05**：Phase 0 spike 的 10 项验收测试作为 regression 重跑一次
- [ ] **REL-06**：v1.0 git tag + GitHub Release notes
- [ ] **REL-07**：成功指标基线——记录 v1.0 发布时的 GitHub stars / forks / open issues 作为后续追踪起点（不引入遥测）

---

## v2 Requirements（v1.1 / v2 Stretch,明确推迟）

### 桌面端与 i18n（DESK / I18N）

- **DESK-01**：Windows Office Desktop 三宿主验证 Task Pane + 6 个 Ribbon 按钮可用（PRD AC7.1）
- **I18N-01**：英文 i18n（UI 双语切换）;Lingui PO 文件已脚手架就绪,零重构

### Excel Stretch（XLS-V2）

- **XLS-V2-01**：选中数据 → 一键生成图表 + 三句话洞察（PRD Stretch）
- **XLS-V2-02**：PivotTable 生成（Features 研究 gap #3——Copilot 已替换 legacy 推荐 PivotTable 入口）

### PPT Stretch（PPT-V2）

- **PPT-V2-01**：Speaker notes 生成（Features 研究 gap #2——Gamma 的招牌功能）

### 持久化与 Onboarding 增强（PERS / ONB）

- **PERS-01**：聊天历史本地 IndexedDB 持久化（PRD Q2,v1 内存级,v1.1 评估）
- **ONB-01**：Onboarding 内联 Key 校验——保存 Key 时发 1-token 测试请求,立即告知 Key 有效/无效;附"如何获取 Key"链接（Features 研究 gap #5,v1.0 决定不做,推迟）

### 高级能力

- **ADV-01**：流式输出取消后服务端继续计费的提示与 token 用量补偿展示
- **ADV-02**：跨会话提示词模板库

---

## Out of Scope

PRD Non-Goals + Features 研究的 anti-features。明确不做,避免后续 scope creep。

| 功能 | 不做原因 |
|------|----------|
| Mac 桌面端 | v1 不验证;API 一致性不确认前不投入 |
| iOS / Android Office 移动端 | Office.js 移动 API 限制大,投入产出不成立 |
| 企业 SSO / 账号体系 / Token 计费 / 订阅 | 开源副业定位,与"无后台"硬约束冲突 |
| 自训练模型 / 模型微调 | 与 BYO Provider 路线冲突 |
| AppSource 商店上架 | v1 仅 sideload + 开源仓库 manifest |
| VBA / Office Script 代码生成 | 与"一键操作"路线冲突 |
| 真人语音朗读 / PPT 自动演讲 | 超出 MVP 范围 |
| 协作能力（多人共编 / 评论） | 与无后台架构冲突 |
| 聊天历史本地持久化（v1） | v1 内存级;v1.1 评估 IndexedDB |
| Whole-deck auto-redesign | 与"一键操作 + 用户审阅再写回"路线冲突 |
| Auto-execute writeback | 一律要求"用户二次确认",不做 AI 自动写文档 |
| Floating action button | 2026-05 Microsoft 自己已经回退此设计——满意度反而下降 |
| RAG over user files / Web 搜索增强 | 超出"AI 提效"定位;v1 不引入向量库 |
| Whole-document translation | 与多风格润色场景边界冲突;用户用润色场景代替 |
| 自动遥测 / 用户行为采集 | 与"无后台 + 用户隐私"路线冲突;v1 仅看 GitHub stars + issues |
| 跨设备 / 跨浏览器 Key 同步 | 与"无后台"硬约束冲突;MS 账号级同步是 Outlook 专属能力 |

---

## Traceability

由 gsd-roadmapper 在 2026-05-26 ROADMAP 创建时填充。Phase 0 作为风险消减 spike 不直接交付 v1 REQ-ID（其 10 项验证作为 REL-05 在 Phase 7 重跑）；REQ-ID 全部映射到 Phase 1-7。

| Requirement | Phase | Status |
|-------------|-------|--------|
| INSTALL-01 | Phase 1 | Pending |
| INSTALL-02 | Phase 1 | Pending |
| INSTALL-03 | Phase 1 | Pending |
| INSTALL-04 | Phase 1 | Pending |
| INSTALL-05 | Phase 1 | Pending |
| INSTALL-06 | Phase 1 | Pending |
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 1 | Pending |
| FOUND-06 | Phase 1 | Pending |
| FOUND-07 | Phase 1 | Pending |
| FOUND-08 | Phase 1 | Pending |
| FOUND-09 | Phase 1 | Pending |
| FOUND-10 | Phase 1 | Pending |
| PROV-01 | Phase 2 | Complete |
| PROV-02 | Phase 2 | Complete |
| PROV-03 | Phase 2 | Complete |
| PROV-04 | Phase 2 | Complete |
| PROV-05 | Phase 2 | Pending |
| PROV-06 | Phase 2 | Complete |
| PROV-07 | Phase 2 | Complete |
| PROV-08 | Phase 2 | Complete |
| PROV-09 | Phase 2 | Complete |
| PROV-10 | Phase 2 | Complete |
| KEY-01 | Phase 2 | Complete |
| KEY-02 | Phase 2 | Pending |
| KEY-03 | Phase 2 | Pending |
| KEY-04 | Phase 2 | Pending |
| KEY-05 | Phase 2 | Complete |
| COST-01 | Phase 2 | Complete |
| COST-02 | Phase 2 | Complete |
| PANE-01 | Phase 1 | Pending |
| PANE-02 | Phase 2 | Pending |
| PANE-03 | Phase 2 | Pending |
| PANE-04 | Phase 2 | Pending |
| FILE-01 | Phase 3 | Pending |
| FILE-02 | Phase 3 | Pending |
| FILE-03 | Phase 3 | Pending |
| FILE-04 | Phase 3 | Pending |
| FILE-05 | Phase 3 | Pending |
| FILE-06 | Phase 3 | Pending |
| FILE-07 | Phase 3 | Pending |
| FILE-08 | Phase 3 | Pending |
| FILE-09 | Phase 3 | Pending |
| PPT-01 | Phase 4 | Pending |
| PPT-02 | Phase 4 | Pending |
| PPT-03 | Phase 4 | Pending |
| PPT-04 | Phase 4 | Pending |
| PPT-05 | Phase 4 | Pending |
| PPT-06 | Phase 4 | Pending |
| PPT-07 | Phase 4 | Pending |
| XLS-01 | Phase 5 | Pending |
| XLS-02 | Phase 5 | Pending |
| XLS-03 | Phase 5 | Pending |
| XLS-04 | Phase 5 | Pending |
| XLS-05 | Phase 5 | Pending |
| XLS-06 | Phase 5 | Pending |
| XLS-07 | Phase 5 | Pending |
| XLS-08 | Phase 5 | Pending |
| DOC-01 | Phase 6 | Pending |
| DOC-02 | Phase 6 | Pending |
| DOC-03 | Phase 6 | Pending |
| DOC-04 | Phase 6 | Pending |
| NFR-01 | Phase 1 | Pending |
| NFR-02 | Phase 2 | Pending |
| NFR-03 | Phase 2 | Complete |
| NFR-04 | Phase 1 | Pending |
| NFR-05 | Phase 1 | Pending |
| NFR-06 | Phase 1 | Pending |
| REL-01 | Phase 7 | Pending |
| REL-02 | Phase 7 | Pending |
| REL-03 | Phase 7 | Pending |
| REL-04 | Phase 7 | Pending |
| REL-05 | Phase 7 | Pending |
| REL-06 | Phase 7 | Pending |
| REL-07 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: **78**
- Mapped to phases: **78** ✓
- Unmapped: **0** ✓
- Phase 0（GATING spike）不直接交付 v1 REQ-ID——其 10 项实证验收作为 REL-05 在 Phase 7 作为回归重跑

**By Phase:**

| Phase | Requirement Count | REQ-IDs |
|-------|------|---------|
| Phase 0 | 0 (gating spike) | — |
| Phase 1 | 21 | INSTALL-01..06, FOUND-01..10, PANE-01, NFR-01, NFR-04, NFR-05, NFR-06 |
| Phase 2 | 22 | PROV-01..10, KEY-01..05, COST-01..02, PANE-02, PANE-03, PANE-04, NFR-02, NFR-03 |
| Phase 3 | 9 | FILE-01..09 |
| Phase 4 | 7 | PPT-01..07 |
| Phase 5 | 8 | XLS-01..08 |
| Phase 6 | 4 | DOC-01..04 |
| Phase 7 | 7 | REL-01..07 |
| **Total** | **78** | **100% coverage** |

---

*Requirements defined: 2026-05-26*
*Source: PRD v1 draft + research SUMMARY.md + user decisions during /gsd-new-project*
*Last updated: 2026-05-26 — ROADMAP.md created, traceability filled (78/78 v1 requirements mapped)*
