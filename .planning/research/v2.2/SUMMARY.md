# Research Summary — Aster v2.2「多模态四件套」

**Project:** Aster（中文职场用户的 Office.js AI 代理，PPT/Excel/Word for Web）
**Domain:** 无后台、BYO-Key、纯浏览器直连的 Office 内嵌 AI 代理 — 多模态扩展
**Researched:** 2026-06-01
**Sources:** STACK.md / FEATURES.md / ARCHITECTURE.md / PITFALLS.md + PROJECT.md + spikes/011-image-gen-api-formats
**Consumer:** gsd-roadmapper → REQUIREMENTS.md → Phase 14+ plans
**Confidence:** MEDIUM-HIGH（架构/pitfalls HIGH；Pexels CORS + PPT 插图 API MEDIUM；DeepSeek-V4 vision LOW）

---

## Executive Summary

v2.2 的本质是**「接通」而非重建**——五个 Provider 接入点（vision/image 客户端、registry taskKind 路由）已躺在 v1 基座里，但从未接进 agent loop、无 tool、无 UI。四件套（看图 / 读文件 / 生图 / 找图）+ MM-05 model 修正，工作量集中在补接每条路径的「最后一公里」+ 三宿主 Office.js 插图/取图 API 的真机验证。

四个研究维度**强烈收敛**于同一构建顺序：**MM-05 Provider 重写必须第一**（`aihubmix-image.ts` 现写旧 `gpt-image-1` + OpenAI `/images/generations` 形态，而 spike 011 已实测三个生图模型走三套完全不同的 wire format + 两套鉴权；不先修 model routing，MM-01/MM-03 都无法工作）。之后 MM-03（生图插入）/ MM-01（视觉）可并行，MM-02（文件解析）完全独立，MM-04（图库）最后（CORS spike 门控，复用 MM-03 的 insert helper）。

**最高风险三连**：① **base64 图片数据进 localStorage 聊天历史** = 配额炸 + LLM 重放永久失败循环（已知 chatbot 中毒模式）——「图片字节不进 history」是**设计契约**，不是事后补丁；② **PPT 插图 API 分歧**（`shapes.addImage` BETA + 已知 bug vs `setSelectedDataAsync` GA）——spike 决定走哪条、影响 undo 策略；③ **DeepSeek-V4 官方文档至今无 vision**——MM-01 必须 spike 验证，fallback 走 aihubmix-vision。研究全程零额外初始 bundle 压力（解析库全部 lazy-load）。

---

## Key Findings

### Recommended Stack

详见 [STACK.md](./STACK.md)。所有新增解析库 **dynamic import → Vite 自动分 chunk → initial bundle 增量 = 0 KB**，维持 75 KB 量级 ≤82 KB CI gate。所有 Provider/图库调用走 **native fetch**，零 SDK。

**Core technologies（全部 lazy-loaded，按需）:**
- **mammoth `1.12.0`**（docx→text）— ~200–250 KB gzip，无 worker，`import mammoth from 'mammoth'`；**版本须 ≥1.11.0**（CVE-2025-11849）+ npm audit gate
- **SheetJS xlsx `0.20.3`**（xlsx→json）— ~180 KB gzip，**从 `cdn.sheetjs.com` 装 tgz，不能 `npm i xlsx`**（npm 包是废弃 legacy）
- **pdfjs-dist `5.7.284`**（pdf→text）— main ~150 KB + worker ~400 KB（独立文件）；Vite `?worker` import；worker 在 GitHub Pages 真机需验证
- **jszip `3.10.1` + 浏览器原生 DOMParser**（pptx→text，DIY 提 `<a:t>`）— ~33 KB；**否决 `@jvmr/pptx-to-html`**（单作者新库无生产验证）
- **Pexels REST API**（图库，非 Unsplash）— native fetch + `Authorization` header + `locale=zh-CN`；200 req/h（Unsplash 仅 50/h demo）；attribution 宽松（Unsplash 强制每图署名+UTM，插进 PPT 破坏视觉且违约吊 key）
- **aihubmix-vision**（已存在，格式正确：OpenAI `image_url` content part）— 只需把 registry model 常量改为 spike 验证的实际可用 id

**明确不加：** `@jvmr/pptx-to-html`、`unsplash-js`、`pexels` npm 包、OpenAI/任何 LLM SDK。

### Expected Features

详见 [FEATURES.md](./FEATURES.md)。

**Must have (table stakes):**
- 选区驱动「半隐式」视觉 — 用户选中图片/图表直接发问，agent 自动携带图像调 vision（复用已有 selection capsule；无需单独「上传图片」按钮）
- 文件附件上传 + 解析为只读 context — 📎 + 「参考文件」文案 + chip 标「仅供 AI 阅读」
- 生图**预览后确认再插入**（非直接插入）— PPT 编辑场景下一张错图还要 undo，预览是更低风险默认
- 图库检索 → 缩略图网格 → 选中插入 — chat 内显示 Pexels 署名即满足授权

**Should have (competitive / 差异化):**
- 默认生图 `doubao-seedream-5.0-lite`（几秒，满足 P95≤10s）+ 可切 model
- 「重新生成」最低成本再试路径

**反功能（早期/无后台/BYO-Key 下刻意不做）:**
- 不做 4 变体并排生成（成本/UI 复杂度）
- 视觉不做 Copilot 式全自动 context 包含（成本不可控）
- 图片字节不写入聊天历史持久化

**关键 UX 边界（必须明确，不能模糊）:** 「附件上传」=用户主动传外部文件、仅快照 context、**不可写回**；「agent 自取当前文档」=已有 read tool、实时 live、**可写回**。两条路径 UI + 文案区分（附件 chip「仅供 AI 阅读」）。

### Architecture Approach

详见 [ARCHITECTURE.md](./ARCHITECTURE.md)。**核心判断：尽量复用现有 read-tool / write-tool / OperationLog 路径，不改 loop.ts 结构、不改 chatStore Message schema。**

**Major components:**
1. **`aihubmix-image.ts` 完整重写**（MM-05）— 按 model 参数分发三路解析器（doubao `output[].url` / gpt-image-2 `output.b64_json[].bytesBase64` / gemini `candidates[].content.parts[].inlineData.data`）；**内部统一为 base64 data URL**（doubao URL 需浏览器 fetch 转 base64）；gemini 用 `x-goog-api-key` header + 跳过 1.5M 字符 `thoughtSignature`
2. **Vision = READ TOOL**（MM-01，非消息层 image_url augmentation）— 新增 `get_shape_image` adapter kind + read ToolDef，零改 loop.ts；接已存在的 `aihubmix-vision.ts`
3. **生图插入 = WRITE TOOL**（MM-03）— `insert_image`/`insert_image_on_slide`；统一吃 rawBase64；**undo 分两档**：PPT 复用已实现 `deleteShapeById`（v2.1 add_shape 的 inverse，零新增代码）、Word 用 `noop_inverse`（诚实标「图片插入暂不支持自动撤销」）；**MM-03 仅 PPT + Word**（Excel 无原生插图 API）
4. **文件附件**（MM-02）— upload → lazy-load parser → 解析文本拼到 `sendMessage` prompt 头部（augmented user prompt），chatStore 零改；图片附件走 vision client 一次性调用
5. **图库**（MM-04）— Pexels 检索 tool 返候选 + 复用 MM-03 的 insert helper

### Critical Pitfalls

详见 [PITFALLS.md](./PITFALLS.md)（每条含症状/根因/预防/预警/phase 归属）。

1. **base64 图片进聊天历史 → localStorage 配额炸 + LLM 重放永久失败循环** — 设计契约：图片字节**永不**进 persisted history；加 serialize-test 守门（MM-01/MM-03）
2. **PPT 插图 Web 端双 bug 叠加**（issue #2775 addImage 删已选 shape + #3083 setSelectedShapes([]) Web 无效）— 需 workaround；spike 决定 `addImage` vs `setSelectedDataAsync`（MM-03）
3. **图库/签名 URL CORS 无后台无 proxy 逃生路**（Unsplash #47 / Pexels #19 浏览器失败实例）— MM-04 Pexels CORS 三浏览器 spike 必须先于实现；失败则需 Cloudflare Worker proxy = 设计大变（MM-04）
4. **DeepSeek-V4 vision API 端至今仅文本**（NVIDIA NIM 文档 + 官方 news 确认，灰度仅官方 app 内）— MM-01 spike 必须先于路由代码；fallback aihubmix-vision（MM-01）
5. **三套 wire format 单一解析器 = 静默失败** + **doubao 签名 URL 有 TTL**（尽快 fetch 转 base64）+ **mammoth CVE 锁版本** + **文件内容→LLM 是 OWASP LLM01 注入面**（沿用 v2.0 sanitize 边界）

---

## Implications for Roadmap

研究收敛建议 **6 个 phase（编号从 14 续接）**。每个新 write/插图工具沿用 v2.1 合约：先声明 undo 类型 + 配 `operationLog.integration.test` 守门。

### Phase 14: MM-05 AiHubMix Provider 重写
**Rationale:** 零依赖，**必须第一个**——下游所有 image/vision 工具的硬前提；spike 011 已锁定全部 wire format，直接实现。
**Delivers:** 重写 `aihubmix-image.ts`（三路解析器 + base64 统一 + 两套鉴权 + gemini 端点族）；修正 registry/pricing model 清单（视觉 model vs 三生图 model）；Phase 14 时查 `/v1/models` 验证 aihubmix vision model id。
**Avoids:** 三套 wire format 单一解析器静默失败（三路 smoke test 守门）。

### Phase 15: MM-03 图片生成插入（PPT + Word）
**Rationale:** 依赖 14；产出的 `insertImageBase64` helper 是 MM-04 的前置。
**Delivers:** `insert_image` write tool（PPT + Word；Excel out-of-scope）+ 预览后确认 UX + 生成中 loading；PPT undo 复用 deleteShapeById、Word noop_inverse。
**内嵌 spike:** PPT 插图 API 分歧（`addImage` BETA vs `setSelectedDataAsync` GA）+ 写后回读验证（防 v2.1「假成功」重演）。
**Avoids:** base64 进 history（serialize 守门）；PPT 插图 Web 双 bug。

### Phase 16: MM-01 视觉看图
**Rationale:** 依赖 14；与 15 可并行（不同代码面）。
**Delivers:** `get_shape_image` read tool + 接 aihubmix-vision；选区驱动半隐式触发。
**内嵌 spike（P0）:** DeepSeek-V4 vision 可用性 + PPT `shape.image.getBase64ImageData()`/`getBase64()` 在 Office for Web 真机；失败 fallback（DeepSeek→aihubmix；取图不支持→引导用 MM-02 附件）。

### Phase 17: MM-02 文件上传与解析
**Rationale:** **完全独立**，可任意时段插入。
**Delivers:** 📎 附件 UI + mammoth/SheetJS/pdfjs/jszip 懒加载解析 → augmented prompt；附件 vs 自取文档 UX 边界落地（chip「仅供 AI 阅读」）。
**内嵌 spike:** pdf.js worker 在 Vite + GitHub Pages（CSP）真机（部署后才暴露）。
**Avoids:** mammoth CVE 锁版本 + npm audit gate；文件内容注入 sanitize。

### Phase 18: MM-04 公开图库检索（Pexels）
**Rationale:** 依赖 15（共享 insert helper）+ CORS spike 结论。
**Delivers:** Pexels 检索 tool + 缩略图选择 + 插入 + chat 内署名。
**内嵌 spike（本 milestone 最高风险）:** Pexels CORS 在 Office Web iframe 三浏览器实测；失败 = 架构大变（需 proxy，触发无后台原则重评，见 memory `project_no_backend_status`）。

### Phase 19: v2.2 UAT + Release
**Delivers:** 四件套三宿主（可插图的 PPT/Word + 视觉/附件全宿主）Office for Web 真机端到端 UAT + 发布 + tag `v2.2`。

### Phase Ordering Rationale
- **14 必须最先**：Provider 重写解锁所有下游 image/vision 工具。
- **15 ∥ 16**：生图与视觉代码面不重叠，可并行；单人串行推荐 **14 → 16 → 15 → 17 → 18 → 19**（先把两个 spike-gated 的高不确定项 16/15 验掉）。
- **17 独立**：文件解析不依赖任何 Provider 改动，随时可做。
- **18 最后**：依赖 15 的 insert helper + 其自身 CORS spike 是最高风险，放后面避免阻塞。

### Research Flags
**开工前需 spike（4 个 gating）:**
- **Phase 15:** PPT `addImage`(BETA) vs `setSelectedDataAsync`(GA) — 决定实现 + undo 策略
- **Phase 16:** DeepSeek-V4 vision API + PPT `getBase64ImageData()` 真机 — 决定 vision 走 DeepSeek 还是 aihubmix、能否从 PPT 取图
- **Phase 17:** pdf.js worker + GitHub Pages CSP — 仅部署后暴露
- **Phase 18:** Pexels CORS 三浏览器 + Office Web iframe — 失败则设计大变（proxy）

**标准模式（无需 research-phase）:**
- **Phase 14:** spike 011 已锁定全部 wire format
- **Phase 17（mammoth/xlsx 部分）:** 文档成熟，直接实现

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack（解析库版本/策略） | HIGH | npm/官方文档直接验证；全 lazy，0 initial bundle |
| Stack（Office.js 插图 API） | MEDIUM | requirement sets + 已知 bug issue；Web 真机需 spike |
| Features（UX 边界 + 生图预览） | HIGH | 竞品明确分析 + Aster 约束推导自洽 |
| Architecture（集成路径） | HIGH | 基于完整代码库阅读 + spike 011 锁定 |
| Pitfalls | HIGH | Office.js GitHub issue + 图库 SDK issue 直接证据 |
| Pexels CORS（Office Web iframe） | MEDIUM | 大量 browser fetch 实例，但 Task Pane 环境需真机 |
| DeepSeek-V4 vision | LOW | 官方文档无证据，第三方声称但无 endpoint 级验证 |
| aihubmix vision model id | MEDIUM | API format 正确，model id 需 `/v1/models` 验证 |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address
- **DeepSeek-V4 vision**：spike 门控 Phase 16；fallback aihubmix-vision。
- **PPT 插图 API（addImage BETA）**：spike 门控 Phase 15。
- **Pexels CORS（Office Web iframe）**：spike 门控 Phase 18；失败触发无后台原则重评。
- **aihubmix vision model id**：Phase 14 查 `/v1/models`。
- **开放产品决策（roadmap/用户定，研究不替决）:** ① Pexels API key 内置（src 硬编码，泄露风险）vs BYO（配置负担）；② XLSX 附件真实需求强度（Excel 用户多直接操作当前文档）；③ doubao 签名 URL — Office.js 插图接受 URL 还是必须 base64（Phase 15 spike 验）；④ PPT snake/camel casing 技术债根治是否折叠进某 phase。

## Sources

### Primary (HIGH confidence)
- `.planning/spikes/011-image-gen-api-formats/findings.md` — 三生图模型真实付费 API 实测（wire format 锁定）
- 代码库 `src/agent/loop.ts` / `src/agent/tools` / `src/providers/*` / 三宿主 adapters / operationLog — 完整阅读
- npm + 官方文档 — mammoth 1.12.0 / SheetJS 0.20.3 / pdfjs-dist 5.7.284 / jszip 3.10.1
- Office.js requirement sets + GitHub issues #2775 / #3083 / #3434 / #447（插图/CORS bug）
- NVIDIA NIM + DeepSeek 官方 news — V4 仅文本

### Secondary (MEDIUM confidence)
- Pexels vs Unsplash API Terms（attribution / rate limit / locale）
- Pexels #19 / Unsplash #47（浏览器 CORS 失败实例）
- SentinelOne 漏洞库 — mammoth CVE-2025-11849

### Tertiary (LOW confidence)
- 第三方关于 DeepSeek-V4 多模态的声称（无 endpoint 级证明）
- doubao 签名 URL TTL（官方无明确文档，依对象存储通用行为推断）

---
*Research completed: 2026-06-01*
*Ready for roadmap: yes*
