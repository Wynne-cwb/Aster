# Feature Research — Aster v2.2 多模态四件套

**Domain:** Office.js AI Agent Add-in — multimodal capabilities (vision / file attachment / image generation / stock search)
**Researched:** 2026-06-01
**Confidence:** MEDIUM-HIGH (竞品观察 HIGH；Aster 具体 UX 边界判断 MEDIUM，基于推论而非直接用研)

---

## 关键 UX 边界决策（在分类之前必须先明确）

### 附件上传 vs Agent 自取当前文档 — 两条不同路径

这是 v2.2 最重要的 UX 边界，必须明确区分，不能留白。

| 维度 | Agent 自取当前文档（已有，v2.0/v2.1） | 文件附件上传（MM-02 新增） |
|------|--------------------------------------|--------------------------|
| **触发方式** | 用户自然对话："帮我优化这份 PPT" | 用户点击 📎 回形针图标 / 拖拽文件 |
| **文件来源** | Office 宿主内当前打开的文档（实时） | 用户从本地文件系统主动上传的外部文件 |
| **数据形态** | Office.js 读 API → 结构化内容（形状树、单元格值、段落列表） | 浏览器 File API → 懒加载 parser → 文本内容快照 |
| **可写回** | Agent 可用 write tool 直接修改文档 | 仅作 context 输入，Agent 无法写回附件文件 |
| **时效性** | 实时反映文档当前状态 | 上传时刻的快照，不随文档变化更新 |
| **用户心智** | "让 AI 处理我正在编辑的这份文档" | "给 AI 看另一份参考文件" |
| **UI 锚点** | 无需额外操作（selection capsule 已有） | chat 输入框旁的 📎 按钮 |

**重叠/冲突场景与推荐处理：**

- 用户在 Excel 中打开 A.xlsx，同时上传 B.xlsx 附件：A.xlsx 仍由 agent read tool 自取，B.xlsx 内容作为附件文本注入 system context。两者不冲突，但 Agent 无法"写回 B.xlsx"——任何写操作都只针对当前打开的 A.xlsx。
- 用户上传当前打开的同一个文件：这是误用场景。UI 上不主动防止，但 system prompt 应告知 Agent：附件是静态快照，write tool 写的是当前 live 文档。
- 用户上传 PPT 附件并问"帮我按这个风格改我的 PPT"：附件提供参考内容，Agent 再用 read tool 读当前 PPT，结合两者给出操作。这是理想的跨文件参考场景，是 MM-02 的核心价值。

**推荐 UX 表达（UI 文案）：**
- 📎 按钮 tooltip / placeholder：「上传参考文件（docx/xlsx/pdf/pptx/图片）」
- 附件 chip 显示：「📄 B.xlsx（参考文件，仅供 AI 阅读）」
- Agent 在引用附件内容时，humanLabel 写「参考附件 B.xlsx：…」以区别于当前文档操作

---

## 四个功能的 UX 模式研究

### MM-01 视觉看图（Vision）

**竞品 UX 模式：**

- **Microsoft Copilot**（2026 GA）：Declarative Agents 可自动分析 Word/PPT/Excel 中嵌入的图片与图表，无需用户显式触发——只要文档已打开，Copilot 能将图片作为 evidence 回答问题。用户问"这张图表显示什么趋势？"时，Copilot 会自动抓取选中或当前聚焦的图表。
- **Claude/ChatGPT**（上传附件路径）：用户必须主动上传图片才能分析——属于「显式触发」。不会自动读取文档内嵌图片。
- **WPS AI**：PPT 内图片可在 AI 对话中替换，但分析图片内容主要在独立文档阅读功能中（上传文件 → 提问）。

**用户期望分析：**

两种期望在不同场景下都存在：
1. **隐式（自动包含）**：用户选中一个图表，直接发送"分析这张图"，期望 Agent 已经"看到"了——不想再点按钮上传。这在 Copilot 的体验里已经建立了预期。
2. **显式（明确触发）**：用户需要知道"AI 正在用这张图"，避免担心 AI 在乱猜。

**Aster 推荐方式：**

选择「基于选区的半显式」触发：
- 当用户在 PPT/Excel/Word 中选中了含图片的 shape 或含图表的区域，selection capsule（已有）会显示"[图片已选中]"或"[图表已选中]"的标记。
- 用户在 chat 中发问时，Agent 自动将选中图片的 base64 编码包含到 vision API 调用的 content 中——这是"选区驱动的隐式包含"。
- 若用户未选中任何图像，直接问"分析图表"，Agent 应回复"请先在文档中选中图片或图表"，不猜测。
- 不需要独立的"上传图片分析"按钮（与 MM-02 附件上传区分，视觉来自 Office 文档内）。

---

### MM-02 文件上传解析（File Attachment）

**竞品 UX 模式：**

- **ChatGPT**：📎 图标在输入框旁；上传后立即显示文件名 chip + 上传/解析 spinner；解析完成显示文件类型图标；发送消息后 AI 开始引用内容。无"已解析 N 页"的反馈——仅"上传成功"。每 3 小时限 80 个文件（Plus）。
- **Claude.ai**：📎 按钮 + 拖拽区域；上传后显示文件名 chip + "Processing…"状态；解析完显示"Ready"；支持 PDF/DOCX/图片等，单文件最大 32MB；不支持 XLSX（需转 CSV）——这对职场用户是明显短板。
- **Microsoft Copilot**（M365）：在 Word/PPT/Excel 内，Copilot 直接读取打开的文档，不另提供"上传附件"功能；外部文件上传是在独立的 Copilot 界面（teams/web）而非 Office 内。这个设计刻意隔离了"当前文档 vs 外部文件"两条路径。
- **WPS AI**（灵犀）：支持最多 50 个文件；显示文件列表 + 解析状态；能给出"已读取 N 页"反馈；多文件并行对话。

**用户期望（职场中文用户）：**

- 上传后立刻能看到文件被"接收"（chip + 文件名），不担心上传失败
- 知道 AI 在"读"文件（loading 态），不是石沉大海
- 支持 PDF（汇报/合同主要格式）+ DOCX（Word 文档）+ XLSX（数据表）+ PPT（参考方案）+ 图片（截图/扫描件）
- 不需要配额管理 UI（早期用户量少）
- 文件内容直接融入对话，不需要用户管理"文件库"

**Aster 推荐方式：**

- 最多同时 **3 个文件**（bundle 内存约束 + 防止 context 超限）
- 文件大小限制：每文件 **20MB**（PDF 图片流较大，20MB 覆盖绝大多数职场文件）
- 上传后状态机：「上传中…」→「解析中…」→「已解析（文件名·格式·粗略字数）」→ 可用
- 解析反馈文案举例：「📄 Q1报告.pdf · 已解析，约 12,400 字」
- 不做多文件管理界面（不是文件库，临时附件，对话清除后消失）
- 图片文件作为视觉输入走 MM-01 路径（而非文本解析路径），需在 UI 上区分

---

### MM-03 图片生成插入（Image Generation）

**竞品 UX 模式：**

- **Microsoft Copilot for PowerPoint**（2026）：生图走 DALL·E 或「Microsoft AI Image 2 Efficient」模型；用户在 Copilot 面板输入提示词；AI 直接生成并插入 slide，无"预览后确认"步骤（即直接插入）；用户可在插入后用 Designer Editor 再编辑（改背景/分辨率/风格）。这是「直接插入」模式。
- **Notion AI**（2026-03-09 上线）：`/image` → 输入描述 → 生成 → **显示预览图** → 用户点确认插入到页面。无模型选择（Notion 不透露底层模型）。单日限 10 次，月限 30 次（Beta）。这是「预览后确认」模式。
- **Gamma**（2026）：AI 自动生成并内嵌到 card，用户可要求重新生成；支持在 card 内 hover 后点「Regenerate」；不显示多变体。股图 + AI 生图混用，按内容自动选择。
- **WPS AI 设计室**（2026-02）：输入描述 → 生成多个风格变体（通常 4 个）→ 用户从 grid 中选择 → 插入。这是「多变体选择」模式。
- **Adobe Firefly / Canva AI**（参考）：4 个变体 grid + hover 操作菜单 + 「Regenerate variants」按钮。行业标准。

**用户期望：**

- 生成过程有明显 loading 态（图片生成 3–90 秒，远比 LLM 首 token 慢）
- **大多数用户期望在插入前看到图片**（避免将不合适的图插入 PPT 后还要删除），这是「预览后确认」的核心价值
- 能重新生成（不满意时不想重新输入完整 prompt）
- 能直观选择插入位置（当前 slide / 光标位置）
- 不需要复杂的参数控制（尺寸/质量 等技术参数对职场用户不友好）

**Aster 推荐方式（综合成本与 UX）：**

采用「预览后确认 + 单图（不做多变体）」：
- Agent 调用生图 write tool 时，**先生成图片，暂存为 data URL，在 DiffLogPanel 内显示预览图**（一个 img 标签，约 3MB，in-memory，不持久化）
- 卡片内显示：预览图 + 「插入到文档」按钮 + 「重新生成」按钮
- 用户点「插入」→ 执行 Office.js 插图 API → DiffLogPanel 显示已插入
- 用户点「重新生成」→ Agent 用同一 prompt 重新调用生图 API，刷新预览图
- 不支持多变体（复杂度 HIGH，bundle 内存 3MB×N）
- 默认模型：**doubao-seedream-5.0-lite**（速度最快，几秒内返回，URL 模式最省内存）
- 用户若想换模型：在 Settings 中选择（不在生成流程里）

---

### MM-04 公开图库检索（Stock Image Search）

**竞品 UX 模式：**

- **Gamma**：AI 自动从 Unsplash 拉取与内容相关的图片，内嵌到 card；不提供手动搜索界面——AI 决策图片选择，用户可手动替换。
- **Canva**：在设计工具栏有完整的图库搜索入口；搜索返回 grid（每页 20–30 张）；点击选中 + 拖拽插入或点「Use in design」；有 Pexels/Unsplash/Pixabay 等多源切换；不强制显示 attribution。
- **Beautiful.ai**：生成时选择 image source（AI-generated / stock）；stock 图片来源未透露；自动填入 slide，用户可替换。
- **PowerPoint Copilot**：用户可要求"加一张股图"，Copilot 用 Microsoft licensed stock library 选图，直接插入；用户无法浏览 / 选择图库。

**Unsplash vs Pexels API 关键差异（影响实现决策）：**

| 维度 | Unsplash | Pexels |
|------|----------|--------|
| API attribution 要求 | **强制**：每次显示图片必须展示摄影师姓名 + 可点击链接到其 profile | 不强制（鼓励但不必须） |
| 中文搜索质量 | 一般（英文库为主，中文关键词命中率低） | 类似，需英文关键词 |
| 免费配额 | 50 requests/hour（Demo），需申请 Production；Production 无公开限额 | 200 requests/hour，20,000 requests/month |
| 商用授权 | 免费，无需署名（内容 license 层）；但 API 层强制 attribution | 免费，无需署名 |

**Attribution 问题对 Aster 的影响：**

Unsplash API 要求：每次图片展示必须包含摄影师姓名和可点击的 profile 链接——这意味着在 PPT slide 里插入图片后，**必须同步插入署名文字或 tooltip**，否则违反 API 使用条款（可被吊销 key）。在 PPT 幻灯片上强制显示"Photo by XXX on Unsplash"会破坏设计美感，对职场用户是明显的体验劣化。

**Aster 推荐选择：Pexels**（attribution 无强制要求，无需在 slide 里插入水印/署名文字）。

**Aster 推荐 UX 方式：**

- Agent 接到"搜索图片"指令 → 调用 Pexels search API → 返回 5–8 张缩略图
- 在 chat 内显示图片缩略图 grid（每行 2 列，约 150×100px thumbnail）
- 每张图片有「插入」按钮；点击 → 获取大图 → 转 base64 → 调用 Office 插图 API
- attribution：在 chat 内图片下方显示「© [photographer] via Pexels」，不强制插入 slide
- 搜索关键词由 Agent 从用户意图中提取（中文 → 英文翻译，Agent 自行翻译 keyword）
- 不做独立的"图库搜索界面"（保持在 chat 流里）

---

## 功能分类

### 表格必备（Table Stakes）— 缺少会让产品感觉不完整

| 功能 | 为何用户期望 | 复杂度 | 对现有功能的依赖 |
|------|------------|--------|----------------|
| MM-01 选区驱动视觉分析 | Copilot / WPS AI 已建立「选中图表 → AI 分析」预期；职场用户高频需求（Excel 图表解读 / PPT 配图理解） | MEDIUM | 依赖已有 selection capsule（读选区 base64）+ 新增 vision API call |
| MM-02 基础文件附件上传（PDF/DOCX/图片） | ChatGPT/Claude/WPS AI 已将附件上传标准化；「给 AI 看参考文件」是基本工作流 | MEDIUM | 依赖现有 lazy-load parsers（mammoth/pdfjs，已在 codebase 但未接入 agent） |
| MM-02 上传状态反馈（chip + 解析进度） | 无反馈 = 用户不知文件是否上传成功，会重复上传或放弃 | LOW | chat UI + Zustand chatStore 扩展 |
| MM-03 生图预览后确认插入 | 直接插入不合适图片 → 用户需找 undo → 体验差；预览是现代 AI 生图 UX 基准 | MEDIUM | 依赖 spike 011 已验证的 3 个生图 API + 新增 insert_image_on_slide write tool（PPT/Word） |
| MM-03 重新生成按钮 | 第一张图不满意是常态；重新生成是最低成本的「再试一次」路径 | LOW | 依赖上面 MM-03 预览机制 |
| MM-04 图库搜索返回缩略图 grid | Canva/Gamma 已将「搜索 → 选图 → 插入」标准化；用户不会接受 AI 自动选图不让看 | MEDIUM | Pexels API（新 HTTP call）+ chat 内 grid 渲染（新 UI 组件） |
| MM-04 图库图片一键插入 | 搜索到合适图片后插入应一步完成，不需跳出 Office | MEDIUM | insert_image_on_slide write tool（与 MM-03 共用）|

### 差异化功能（Differentiators）— 竞品少见或 Aster 独特角度

| 功能 | 价值主张 | 复杂度 | 备注 |
|------|---------|--------|------|
| MM-01 Agent loop 内 vision（多步任务中自动看图） | Copilot Vision 需用户主动触发；Aster 作为 Agent 可在多步任务中自主决定「看」某个选区的图（如：先列出 slide，再看某张配图，再建议替换）——这是 Aster agent 模式的独特之处 | HIGH | 需 Agent loop 能携带图片 content 到 LLM；context 大（每张图 ~1MB base64） |
| MM-01 Excel 图表直接分析（不截图，直接用 chart canvas） | Excel 图表可通过 Office.js 读为 base64 图片；无需用户手动截图 | MEDIUM | Office.js `chart.getImageAsBase64()` API — 需 spike 验证可用性 |
| MM-02 支持 XLSX 附件（竞品 Claude 不支持） | Claude 不支持 XLSX，需转 CSV；职场 Excel 文件是高频参考需求；Aster 用 SheetJS 直接解析 → 竞争窗口 | MEDIUM | SheetJS 已在 lazy-load 依赖中 |
| MM-02 支持 PPTX 附件（竞品少见） | 分析竞品 PPT / 参考方案 PPT 是职场常见场景；ChatGPT/Claude 支持 PPTX 但解析质量一般 | MEDIUM-HIGH | @jvmr/pptx-to-html 或 jszip DIY（已在 CLAUDE.md 中标注为 LOW confidence spike needed）|
| MM-03 三模型可选（doubao/gpt-image-2/gemini） | 不同场景不同需求：doubao 快 / gpt-image-2 质量高 / gemini 有思考步骤；BYO Key 用户掌控选择 | MEDIUM | Settings 中切换，不在生成流中 |
| MM-04 Pexels 搜索（无 attribution 强制） | Unsplash API 强制 attribution 会在 slide 里产生「水印」，Pexels 无此问题——Aster 选 Pexels 是有意识的 UX 决策 | LOW（选型决策）| 需 Pexels API key（BYO 还是 Aster 内置？spike 决定）|

### 反功能（Anti-Features）— 对 Aster（无后台/BYO Key/早期用户）来说不应做

| 反功能 | 为何被请求 | 为何不应做 | 替代方案 |
|--------|----------|----------|---------|
| 多变体生成（4 张图同时展示） | Adobe Firefly / WPS AI 设计室的行业惯例 | 每张图 base64 约 3MB，4 张 = 12MB in-memory；gpt-image-2 每张约 90s+；doubao URL 模式快但签名 URL 有时效；早期用户对速度的容忍度低 | 单图预览 + 快速重新生成（doubao 几秒，成本低）|
| 图片历史 / 图片库管理 | 用户想复用之前生成的图 | 无后台 = 无持久化存储；localStorage 放 base64 会迅速打满（5MB 限制）；与"附件是临时的"原则一致 | 用户若需复用图片，在 Office 中保存是更自然的行为 |
| 自动为生成图选择最佳模型 | 智能 = 好的 DX | 三个模型价格/速度/质量差异大（doubao 分钱 vs gpt-image-2 几毛），BYO Key 下用户应掌控选择；自动切换会产生意外账单 | Settings 明确选模型 + 各模型标注「速度/质量/价格」提示 |
| Unsplash 集成（代替 Pexels） | Unsplash 品牌知名度更高、摄影质量更佳 | API 要求强制 attribution（每次展示必须显示摄影师链接），在 PPT slide 里插入 attribution 文字破坏设计；违规会被吊销 API 访问 | Pexels（商用免费，attribution 非强制，摄影质量也优秀）|
| 图片搜索结果无限滚动 / 分页浏览 | Canva 风格的完整图库体验 | Task Pane 空间有限（约 350px 宽）；Pexels 20,000 requests/month 配额有限；早期用户不需要海量选择 | 每次返回 5–8 张，支持「再搜索」指令 |
| 文件上传后的「文件管理」界面 | 多文件场景 | 增加 UI 复杂度；附件是 session 内临时的；对话清除后消失是合理预期 | 上传文件作为 chat context chip 显示，跟随消息流 |
| Vision 分析时的图片上传按钮（独立于 Office 选区） | 允许分析任意图片（不只是 Office 内的） | 与「Agent 在 Office 内工作」的定位冲突；附件上传（MM-02）已覆盖图片上传场景；两个入口造成混淆 | MM-02 附件支持图片格式，走同一入口 |
| 为每张 Pexels 图在 Slide 里插入署名文字 | 最终的合规诚意 | Pexels 不强制要求；自动插入署名文字破坏 PPT 视觉 | 在 chat UI 内显示署名（Pexels API Terms 允许此方式）；在 README 注明 |
| gpt-image-2 high quality 作为默认 | 质量最高 | high quality 约 90s+ 等待 + 3MB base64 + 价格高；P95 ≤10s 硬约束直接违反 | 默认 doubao-seedream-5.0-lite（几秒内）；gpt-image-2 作为可选的「高质量」模式（用户主动选） |

---

## 功能依赖图

```
MM-01 视觉看图
    ├── requires ──> selection capsule 已有（v2.0）
    ├── requires ──> Office.js getBase64() API (PPT shape) — spike 验证
    ├── requires ──> Office.js chart.getImageAsBase64() (Excel) — spike 验证
    └── requires ──> aihubmix-vision.ts 已有（v1），需接入 agent loop

MM-02 文件上传解析
    ├── requires ──> 📎 UI 入口（chat 输入框改造）
    ├── requires ──> mammoth（lazy）已在 codebase，需接入
    ├── requires ──> pdfjs-dist（lazy）已在 codebase，需接入
    ├── requires ──> SheetJS（lazy）已在 codebase，需接入
    └── requires ──> @jvmr/pptx-to-html 或 jszip DIY（spike needed）

MM-03 图片生成插入
    ├── requires ──> spike 011 三模型 API 格式（已完成）
    ├── requires ──> aihubmix-image.ts 重写（旧文件用 gpt-image-1 + 旧 format）
    ├── requires ──> insert_image_on_slide write tool（PPT — 从未实现）
    ├── requires ──> insertInlinePictureFromBase64 write tool（Word — 从未实现）
    └── requires ──> 预览 UI（DiffLogPanel 扩展或 chat 内 inline 预览）

MM-04 公开图库检索
    ├── requires ──> Pexels API（新增 HTTP client）
    ├── requires ──> insert_image_on_slide write tool（与 MM-03 共用）
    └── requires ──> chat 内 thumbnail grid 组件（新 UI）

MM-03 ──enhances──> MM-04（共用 insert_image_on_slide tool）
MM-02 图片格式 ──enhances──> MM-01（图片附件走 vision 路径）
MM-05 model 修正 ──enables──> MM-01 + MM-03（正确的模型 ID 和 routing）
```

**依赖关键说明：**

- **MM-03 和 MM-04 共用 `insert_image_on_slide`**：这个 tool 是 v2.2 最关键的新 write tool（PPT/Word 各一个），两个功能都需要，优先实现。
- **MM-01 依赖 spike 验证**：Office.js `shape.getBase64()` 和 `chart.getImageAsBase64()` 是否在 Office for Web 三宿主都可用，必须 spike 再动工。
- **MM-02 PPTX 解析是 LOW confidence**：`@jvmr/pptx-to-html` 单作者 2026-03-09 发布，稳定性未验证；如果 spike 失败，降级到 jszip DIY 文本提取。
- **MM-05 是 MM-01 + MM-03 的前置**：不修正 aihubmix-image.ts 和 model routing，MM-01/MM-03 都无法正确工作。

---

## MVP 定义（v2.2 交付范围）

### 必须交付（v2.2 core）

- [ ] **MM-05 AiHubMix model 修正** — 前置，不改其他都跑不通（model routing + aihubmix-image.ts 重写）
- [ ] **MM-01 视觉看图基础版** — 选区内图片/图表 → vision API → agent 回答；仅 PPT shape 和 Excel chart（spike 验证后）
- [ ] **MM-02 文件附件基础版** — PDF + DOCX + 图片（三种最高频格式）；📎 UI；chip 状态反馈；注入 agent context
- [ ] **MM-03 图片生成基础版** — doubao 模型（最快）；预览后确认；PPT insert；重新生成
- [ ] **MM-04 图库检索基础版** — Pexels 搜索；thumbnail grid；点击插入 PPT

### 交付后评估（v2.2 stretch / v2.3 候选）

- [ ] **MM-02 XLSX 附件** — SheetJS 路径已知，但 Excel 文件作为「附件 context」的实际价值需要验证（Excel 用户通常直接操作当前文档，很少传附件）
- [ ] **MM-02 PPTX 附件** — 依赖 spike 结果；@jvmr/pptx-to-html 不稳定风险
- [ ] **MM-03 Word insert_image** — Office.js Word 图片插入 API 行为需 spike（`insertInlinePictureFromBase64` 位置控制限制多）
- [ ] **MM-03 gpt-image-2 / gemini 作为可选** — Settings 切换，依赖 MM-03 core 完成后追加

---

## 优先级矩阵

| 功能 | 用户价值 | 实现成本 | 优先级 |
|------|---------|---------|--------|
| MM-05 model 修正 | HIGH（不做其他全挂） | LOW | **P0 前置** |
| MM-03 生图 + 插入（PPT，doubao） | HIGH | MEDIUM | P1 |
| MM-01 视觉看图（PPT shape / Excel chart） | HIGH | MEDIUM | P1 |
| MM-02 文件附件 PDF/DOCX/图片 | HIGH | MEDIUM | P1 |
| MM-04 图库检索插入（Pexels） | MEDIUM | MEDIUM | P2 |
| MM-02 XLSX 附件 | MEDIUM | LOW（SheetJS 已有）| P2 |
| MM-03 Word 图片插入 | MEDIUM | MEDIUM | P2 |
| MM-02 PPTX 附件 | LOW-MEDIUM | HIGH（spike needed）| P3 |
| MM-03 多模型切换（Settings）| LOW（早期用户少） | LOW | P3 |

---

## 竞品功能对照

| 功能 | Microsoft Copilot | ChatGPT / Claude | Notion AI | WPS AI | Aster v2.2 方案 |
|------|-----------------|-----------------|-----------|--------|----------------|
| **Vision（文档内图片分析）** | 自动包含（Declarative Agents）| 仅附件上传路径 | 无 | 有限（独立阅读功能）| 选区驱动的半隐式：选中图片/图表后 agent 自动使用 |
| **文件附件** | Copilot 独立界面（非 Office 内）| 完整，限 XLSX | 无 | 多文件，最多 50 个 | 最多 3 文件，支持 PDF/DOCX/图片/XLSX/PPTX（spike permitting）|
| **图片生成 + 插入** | 直接插入（DALL·E / AI Image 2）| 无（生图不插 Office）| 预览后确认 | 多变体选择 | 预览后确认，单图，doubao 默认（快）|
| **图库搜索** | Microsoft licensed stock（不可浏览）| 无 | 无 | 无独立图库 | Pexels，5–8 张 thumbnail grid，用户手选 |
| **Attribution 处理** | Microsoft 内置（透明）| N/A | Notion 内（不插文档）| 无 | Pexels：chat 内显示署名，不插 slide |

---

## 附录：UX 文案建议（中文）

| 场景 | 推荐文案 |
|------|---------|
| 📎 按钮 tooltip | 「上传参考文件」|
| 附件 chip（上传中）| 「⏳ 上传中…」|
| 附件 chip（解析中）| 「🔄 解析中…」|
| 附件 chip（就绪）| 「📄 文件名.pdf · 约 N 字」|
| 图片附件 chip（就绪）| 「🖼 图片名.png · 图片，AI 可看」|
| Vision 无选区提示 | 「请先在文档中选中图片或图表」|
| 生图 loading | 「正在生成图片，请稍候…」|
| 生图预览卡片 | 「[预览图] ／ 插入到文档 ／ 重新生成」|
| 图库搜索 loading | 「正在搜索 Pexels 图库…」|
| 图库结果提示 | 「找到 8 张相关图片（via Pexels）」|
| 图库图片 attribution | 「© photographer-name via Pexels」|

---

## 来源

### HIGH confidence（官方文档 + 直接产品使用记录）

- [Microsoft Copilot agentic capabilities GA — Microsoft 365 Blog](https://www.microsoft.com/en-us/microsoft-365/blog/2026/04/22/copilots-agentic-capabilities-in-word-excel-and-powerpoint-are-generally-available/)
- [Copilot in PowerPoint image suggestions FAQ — Microsoft Support](https://support.microsoft.com/en-us/topic/copilot-in-powerpoint-image-suggestions-faq-20037a67-17f4-4f73-a720-d4277e74a33c)
- [Notion AI Image Generation — Notion Help Center](https://www.notion.com/help/create-and-edit-images-with-notion-ai)
- [Pexels License — pexels.com](https://www.pexels.com/license/)
- [Unsplash API Terms — unsplash.com](https://unsplash.com/api-terms)
- [Pexels API Documentation — pexels.com](https://www.pexels.com/api/documentation/)
- [spike 011 findings — .planning/spikes/011-image-gen-api-formats/findings.md](本项目内部)

### MEDIUM confidence（多方来源交叉验证）

- [Gamma AI Review 2026 — effloow.com](https://effloow.com/articles/gamma-ai-review-presentation-builder-guide-2026)
- [Gamma adds AI image-generation tools — TechCrunch](https://techcrunch.com/2026/03/17/gamma-adds-ai-image-generation-tools-in-bid-to-take-on-canva-and-adobe/)
- [WPS AI PPT 深度测评 2026 — keynote.org.cn](https://keynote.org.cn/blog/wps-ai-ppt-review-2026/)
- [WPS AI 设计室自动生图 — 80aj.com](https://www.80aj.com/2026/02/14/wps-ai-image-generation/)
- [ChatGPT File Uploads FAQ — OpenAI Help Center](https://help.openai.com/en/articles/8555545-file-uploads-faq)
- [AI Image Generation UX Patterns — ShapeofAI.com](https://www.shapeof.ai/patterns/variations)
- [Free Image API comparison 2026 — blog.laozhang.ai](https://blog.laozhang.ai/en/posts/free-image-api)
- [Unsplash license attribution analysis 2026 — licenseorg.com](https://www.licenseorg.com/blog/unsplash-license-attribution-required)
- [Can Copilot Read Images? — datastudios.org](https://www.datastudios.org/post/can-copilot-read-images-in-documents-ocr-and-visual-understanding)

### LOW confidence（单一来源或推断）

- Excel `chart.getImageAsBase64()` 在 Office for Web 三宿主可用性 — 推断，需 spike 验证
- PPT `shape.getBase64()` 是否适用于所有 shape 类型（含 picture shape）— 推断
- @jvmr/pptx-to-html 稳定性 — 单作者 2026-03-09，无生产环境验证记录
- Pexels API 中文关键词搜索质量 — 推断（英文库为主，Agent 需自行翻译）

---

*Feature research for: Aster v2.2 multimodal four-pack (MM-01 vision / MM-02 file attachment / MM-03 image gen / MM-04 stock search)*
*Researched: 2026-06-01*
