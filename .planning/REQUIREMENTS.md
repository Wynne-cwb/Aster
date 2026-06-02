# Requirements: Aster v2.2「多模态四件套」

**Defined:** 2026-06-01
**Core Value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 AI 代理能力，能完成绝大部分文档工作；无后台、BYO Key、纯浏览器直连。
**Milestone Goal:** 给 Office 智能代理加上「看 / 读文件 / 生图 / 找图」四种多模态能力——Provider 客户端已在基座，v2.2 把它们接进 agent loop、配 tool、配 UI。
**Phase numbering:** 从 14 续接（v2.1 止于 Phase 13）。

---

## v2.2 Requirements

每个新 write/插图工具沿用 v2.1 合约：先声明 undo 类型 + 配 `operationLog.integration.test` 守门。研究基线见 `.planning/research/SUMMARY.md`；生图 wire format 见 `.planning/spikes/011-image-gen-api-formats/findings.md`。

### MDL — AiHubMix Provider 重写（MM-05，下游硬前提）

- [x] **MDL-01**: 重写 `src/providers/aihubmix-image.ts` — 按 model 分发三路 response 解析器（doubao `output[].url` / gpt-image-2 `output.b64_json[].bytesBase64` / gemini `candidates[].content.parts[].inlineData.data`），内部统一为 base64 data URL（doubao URL 浏览器 fetch 转 base64），两套鉴权（Bearer / `x-goog-api-key`），gemini 走 `/gemini/v1beta` 端点族并跳过巨大 `thoughtSignature` 字段
- [x] **MDL-02**: 修正默认 model 清单 — registry/pricing 区分视觉 model（aihubmix-vision，开工时查 `/v1/models` 验证真实可用 id）与三个生图 model（doubao-seedream-5.0-lite 默认 / gpt-image-2 / gemini-3.1-flash-image-preview）；三路 provider smoke test 守门
- [x] **MDL-03**: PPT 工具 snake/camel casing 中央归一化根治 — dispatch 层统一 args 归一化，移除散落的双键容错兜底，加守门用例（防 v2.2 新增 PPT 生图工具重蹈 casing 覆辙）

### VIS — 视觉看图（MM-01）

- [x] **VIS-01**: agent 可「看」当前选中的图片/图表作 evidence — 新增 `get_shape_image` read tool（三宿主取图：PPT shape image / Excel chart / Word inline picture），选区驱动半隐式触发（复用现有 selection capsule，无需单独「上传图片」按钮）
- [x] **VIS-02**: 视觉走 aihubmix-vision（OpenAI `image_url` content part 格式，已存在客户端）；取图/调用失败给结构化错误（沿用 `{code,message,recoverable,hint}`）。**不验 DeepSeek-V4 原生多模态**（用户决定，省 spike）

> **范围更新（discuss-phase 15，2026-06-01）：** Phase 15 同时交付 **FILE-06 图片上传附件**（从 Phase 17 前移）——「看图」两个来源（agent 取当前文档选中图 + 用户上传/粘贴图）统一在本阶段走 aihubmix-vision、返回文本作 evidence。做法 = 激活 InputBar 现有禁用回形针（**仅图片**：png/jpg/webp、多张、粘贴、本会话内存态复用、绝不持久化）；Phase 17 再把回形针推广到 docx/xlsx/pdf/pptx 解析。

### IMG — 图片生成插入（MM-03，仅 PPT + Word）

- [x] **IMG-01**: PowerPoint「生成一张图并插入」write tool — 接 MDL-01 生图，插入到当前 slide；reverse 复用已有 `deleteShapeById`（v2.1 add_shape 的 inverse）+ humanLabel
- [x] **IMG-02**: Word「生成一张图并插入」write tool — `body.insertInlinePictureFromBase64`（body 级，非 range，Web 已知 bug）；reverse 用 `noop_inverse` 并诚实标注「Word 图片插入暂不支持自动撤销」
- [x] **IMG-03**: 生成结果 **AI 自动插入文档**（agent loop 内直插，非人工确认——确认卡打断 AI 自主排版 loop，反转自原「预览后确认」设计，2026-06-02 用户拍板）+ 聊天**只读结果缩略图**展示 + 生成中 loading 态（工具进行中指示；生图不可流式，一次性整块返回）+ 插错靠撤销(PPT delete_shape_by_id)/手动删(Word noop_inverse)兜底
- [x] **IMG-04**: 生图 model 可选（默认 doubao-seedream-5.0-lite，几秒满足 P95）—— Settings 生图 model picker + 工具 model_id 参数（对话式指定）；「重新生成」改对话式（用户说「换一张」/「用 gpt-image-2 重画」AI 重调工具）
- [x] **IMG-05**: Excel 明确 out-of-scope（无原生插图 API）——在工具/文案层诚实表达，不假装支持

### FILE — 文件上传与解析（MM-02，全五类）

- [ ] **FILE-01**: chat 附件上传 UI（📎 入口 + 「参考文件」文案 + 附件 chip 标「仅供 AI 阅读」）
- [ ] **FILE-02**: docx 附件解析为文本（mammoth ≥1.11.0，懒加载；CVE-2025-11849 版本锁 + npm audit gate）
- [ ] **FILE-03**: xlsx 附件解析为文本/JSON（SheetJS 0.20.3，从 cdn.sheetjs.com，懒加载）
- [ ] **FILE-04**: pdf 附件解析为文本（pdfjs-dist 5.7.x，懒加载，worker 独立文件）
- [ ] **FILE-05**: pptx 附件解析为文本（jszip + 原生 DOMParser 提 `<a:t>`，懒加载；text-only 不保真）
- [x] **FILE-06**: 图片附件 → 走 aihubmix-vision（与 VIS-01 互补：附件=用户主动传外部图，VIS=agent 取当前文档内图）。**（交付于 Phase 15，与 VIS 同属视觉；discuss-phase 15 决定前移；见 §Traceability）**
- [ ] **FILE-07**: 明确「附件上传」vs「agent 自取当前文档」UX 边界 — 附件=只读快照、不可写回；自取=live、可写回；附件内容注入为 augmented user prompt（沿用 sanitize 注入边界），不改 chatStore Message schema

### LIB — 公开图库检索（MM-04，Pexels + BYO key）

- [ ] **LIB-01**: Pexels 检索 — Settings 新增 BYO Pexels API key 字段（不内置，符合 BYO/无后台/开源原则）；native fetch + `Authorization` header + `locale=zh-CN`
- [ ] **LIB-02**: 检索结果缩略图网格 → 选中插入（复用 IMG 的 insert helper：PPT + Word）
- [ ] **LIB-03**: chat 内显示 Pexels 摄影师署名 + 链接（满足授权；不在插入的图片上叠水印，保 slide 视觉）

### NFR — 非功能（延续 + 新增）

- [x] **NFR-09**: base64 图片字节**永不**写入 persisted 聊天历史（localStorage 配额防护 + LLM 重放死循环防护）——设计契约，加 serialize-test 守门
- [ ] **NFR-10**: 全部解析库 + 图库走 lazy-load / native fetch，初始 bundle 0 增量，维持 ≤82KB gzip CI gate；P95≤10s / Key 不上传 / undo 守门延续

---

## Future Requirements（v2.2 不做，已识别）

### 图库 / 视觉增强
- **LIB-D1**: Unsplash 备选接入（若 Pexels 中文质量/限额不足再评估）
- **VIS-D1**: DeepSeek-V4 原生多模态验证（原 Q6；v2.2 跳过，未来扩用户/降本时重评）

### 生图增强
- **IMG-D1**: 多变体并排生成（4 张选 1）——early-user 阶段不做
- **IMG-D2**: 图片编辑/局部重绘（image edit endpoint）

### 文件增强
- **FILE-D1**: pptx 高保真解析（含版式/图）——v2.2 仅 text-only

## Out of Scope

| Feature | Reason |
|---------|--------|
| Excel 内插入图片 | Office for Web 无原生 Excel 插图 API（`addPicture` BETA 不可用于生产） |
| 内置共享 Pexels key | 开源仓库硬编码 key 必被爬走滥用/封号，且违反无后台/BYO 原则（用户决定 BYO） |
| 图片数据进聊天历史持久化 | localStorage 配额炸 + LLM 重放死循环（已知 chatbot 中毒模式）；NFR-09 反向约束 |
| Cloudflare Worker 图片代理 | 维持无后台；仅当 Pexels CORS spike 失败才触发重评（见 memory `project_no_backend_status`） |
| 视频 / 音频多模态 | 超出 v2.2 四件套范围 |
| Vercel/OpenAI 等 LLM SDK | OpenAI 兼容 wire 格式手写即可，0 净新增运行时依赖原则 |

## Traceability

> 由 gsd-roadmapper 填充（每个需求映射到恰好一个 phase）。

| Requirement | Phase | Status |
|-------------|-------|--------|
| MDL-01 | Phase 14 | Complete |
| MDL-02 | Phase 14 | Complete |
| MDL-03 | Phase 14 | Complete |
| VIS-01 | Phase 15 | Complete |
| VIS-02 | Phase 15 | Complete |
| NFR-09 | Phase 15 | Complete |
| IMG-01 | Phase 16 | Complete |
| IMG-02 | Phase 16 | Complete |
| IMG-03 | Phase 16 | Complete |
| IMG-04 | Phase 16 | Complete |
| IMG-05 | Phase 16 | Complete |
| FILE-01 | Phase 17 | Pending |
| FILE-02 | Phase 17 | Pending |
| FILE-03 | Phase 17 | Pending |
| FILE-04 | Phase 17 | Pending |
| FILE-05 | Phase 17 | Pending |
| FILE-06 | Phase 15 | Complete |
| FILE-07 | Phase 17 | Pending |
| NFR-10 | Phase 17 | Pending |
| LIB-01 | Phase 18 | Pending |
| LIB-02 | Phase 18 | Pending |
| LIB-03 | Phase 18 | Pending |

> Phase 19（UAT + Release）覆盖全部 22 需求的真机验证，不单独映射独立需求。

**Coverage:**
- v2.2 requirements: 22 total
- Mapped to phases: 22 ✓（Phase 14:3 / 15:4 / 16:5 / 17:7 / 18:3）
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-01*
*Last updated: 2026-06-01 — discuss-phase 15：FILE-06（图片上传附件）从 Phase 17 前移至 Phase 15（与 VIS 统一为「视觉看图」）；映射数 15:3→4 / 17:8→7，总数仍 22。*
*Earlier: 2026-06-01 after initial definition（/gsd-new-milestone v2.2）*
