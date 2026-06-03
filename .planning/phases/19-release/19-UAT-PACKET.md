---
phase: 19
slug: release
milestone: v2.2
milestone_name: 多模态四件套
status: passed  # 真机 UAT 2026-06-03 PASS；v2.2 shipped（tag v2.2，线上 0d5fccf）
created: 2026-06-03
author: uat-packet teammate
covers_requirements: 22  # v2.2 全部 22 需求（MDL/VIS/IMG/FILE/LIB + NFR）
uat_scenarios: 24        # 本 packet 真机/回归场景数（见下索引）
---

# Phase 19 — v2.2「多模态四件套」真机 UAT Packet

> **这是一份你（用户）可以照着一步步做的真机验收清单。** v2.2 的所有代码 + 自动化验证 + code-review 已全部完成（Phase 14-18，5/6 phase done）。Phase 19 只剩两件事：**① 在真实 Office for Web 里把四件套手动跑一遍；② 全 PASS 后发布 tag v2.2。**
>
> Aster 是浏览器内嵌的 Office Add-in，很多行为（CORS、iframe CSP、宿主写操作是否静默失败）**只有在真机才暴露**，命令行/单测验不了——这就是这份 packet 存在的原因。
>
> **配套 skill：** 真机操作时建议加载 `office-addin-browser-uat`（Aster 专属：sideload 验证、"打开 Aster" Task Pane、确认 github.io Pages 部署是真正渲染的版本）+ 它依赖的通用 `browser-driving`（截图坐标要重新取、canvas 不在 a11y 树、UI 不是真相源、缓存 vs 真 bug）。

---

## ✅ UAT 结果（2026-06-03）—— v2.2 SHIPPED

真机 UAT 由用户执行，关键 gate 全 PASS，已发布 `tag v2.2`（线上 `0d5fccf`）：

- **🔴 HR-1 pdf.js worker CSP → PASS**：worker 在 GitHub Pages base + Office iframe CSP 下成功加载，PDF 解析可用。
- **🔴 HR-2 Pexels 双重 CORS（含 M-1 取图面）→ PASS**：检索面 + 取图面均放行；`images.pexels.com` 返回跨域许可，**M-1 未坐实、无需 Cloudflare Worker 兜底**。
- **四件套冒烟（VIS / FILE / IMG / LIB）→ PASS**。
- 发布 gate 实跑：build ✅ / size 80.53KB ≤82KB ✅ / tsc exit0 ✅ / 885 tests ✅ / 0 净新增依赖 ✅。

> 覆盖范围说明（诚实记录）：用户验的是「两个最高风险 gate + 四件套各 happy-path 一条」，是最强可发布信号。**未逐条覆盖**的边缘项（另一浏览器全量回归、错误处理如不支持类型/超大文件、**IN-05 alert 在 iframe 可见性**、Excel 诚实拒绝、多轮复用、「换一张」翻页等）作为发布后回归/补丁候选，详见下方各场景（状态仍标 ⬜/🔁）。

---

## 0. 怎么用这份文档

1. 先做 **§1 前置条件**（sideload 已部署版本 + 配好 Key）。
2. 先打 **§2 置顶高危项**（最可能 fail；fail 了后面很多场景会连带挂，且需要动作——加 Cloudflare Worker）。
3. **§3 里程碑级 gate**：标 `✅ 已自动验证` 的不用你重跑（我已在命令行跑过）；标 `⬜ 待真机` 的需要你在真机掐表/观察。
4. 按 **§4 四件套场景**（VIS / FILE / IMG / LIB × 三宿主）逐条做，每条勾 PASS/FAIL。
5. 全 PASS → 走 **§5 发布清单**。
6. 任何一条 FAIL → 按该场景「⑥ 失败时抓什么」截图 + 抓日志，发给 team-lead / 记进 bug-logs。

**状态图例：** ⬜ 待真机 · ✅ 已自动验证（命令行/单测，无需真机重跑）· 🔁 已真机 PASS（2026-06-02 Edge）需 Phase 19 回归 · 🔴 高危（最可能 fail）

---

## 1. 前置条件（开工前必须全部就绪）

| # | 前置 | 说明 |
|---|------|------|
| P-1 | **线上已部署最新版** | tag v2.2 发布**之前**，sideload 拿到的是「上一次 push 到 main 后 Pages 部署完成」的版本。⚠️ 本地 commit ≠ 线上。先确认 `wynne-cwb.github.io/Aster/` 是含 Phase 18 的版本（看 Settings 里有没有「图库 / Pexels API Key」字段——有=已是 Phase 18 版本）。**若线上还没有该字段，需先 `npm run build` + push + 等 Pages 部署（见 §5 发布清单第 1-3 步），UAT 才有意义。** |
| P-2 | **sideload manifest** | 在 Office for Web（PowerPoint / Excel / Word，地址形如 `*.cloud.microsoft`）插入 → 上传我的加载项 → 选 `manifest.xml` → 打开「Aster」Task Pane。 |
| P-3 | **aihubmix Key** | 看图（VIS）+ 生图（IMG）都走 aihubmix。Settings → 填 aihubmix API Key。覆盖 vision（gpt-5.4）+ 三个生图模型（doubao-seedream-5.0-lite / gpt-image-2 / gemini-3.1-flash-image-preview）。 |
| P-4 | **Pexels Key** | 图库（LIB）需 BYO Pexels key（[pexels.com/api](https://www.pexels.com/api/) 免费申请）。Settings → 「图库 / Pexels API Key」密码框 → 粘贴。 |
| P-5 | **两个浏览器** | v2.2 验收要求 **Chrome × Edge 都过**。Phase 15/16 当初只在 **Edge** 真机验过 → Chrome 这次要补回归（见 🔁 标记场景）。 |
| P-6 | **测试素材** | 准备：① 每类型一份真实文件（.docx / .xlsx / .pdf-含文本层 / .pptx / 一份扫描件 pdf / 一个 .zip 测不支持类型 / 一份 >20MB 文档 测超限）；② 一两张测试图片（png/jpg/webp，含一张 >5MB 测超限）；③ PPT 里放一张图/一个图表、Excel 里放一个图表、Word 里放一张内嵌图（VIS 取图用）。 |

---

## 2. 置顶高危项（最可能 fail，fail 后需要动作）🔴

> 这两项是整个 v2.2 里程碑技术不确定性最高的地方。**强烈建议第一批就验**——它们决定了 FILE（pdf）和 LIB（图库）这两件套是否真能用。

### 🔴 HR-1 — pdf.js worker 在 GitHub Pages base + Office iframe CSP

- **风险**：pdf 解析需要加载一个独立的 worker 文件（`pdf.worker.min.mjs`，1.2MB，静态资产）。它能否在 ① GitHub Pages 的子路径 base（`/Aster/`）+ ② Office for Web Task Pane iframe 的 CSP（`worker-src` 限制）下成功加载，**只有真机能验**。
- **已做的缓解**：code-review CR-01 已把 worker 路径从硬编码 `/Aster/` 改成 `import.meta.env.BASE_URL`（Vite 构建注入，prod=`/Aster/`、dev=`/`），**路径正确性已保证**；但 **CSP 是否放行 worker 仍需真机**。
- **怎么验**：见 §4 FILE-PDF 场景。
- **失败兜底动作**：若 CSP 拦截 worker → pdf 这一类走降级提示「该宿主暂不支持 PDF 解析」（其余 docx/xlsx/pptx 不受影响）。最坏情况记为已知限制，不阻塞发布其余三件套。
- **失败时抓**：devtools Console 的 CSP 报错全文（关键词 `worker-src` / `Refused to create a worker`）+ Network 里 `pdf.worker.min.mjs` 的状态码。
- **涉及文件**：`src/lib/parsers/pdf.ts`、`public/pdf.worker.min.mjs`。

### 🔴 HR-2 — Pexels 双重 CORS（检索面 + 取图面，**M-1 取图面最危**）

Pexels 图库有**两个**独立的网络面，**各自可能被 CORS 拦**：

| 面 | 请求 | baseURL 可配？ | 风险 | 兜底 |
|----|------|---------------|------|------|
| **检索面** | `GET api.pexels.com/v1/search` | ✅ 经 `PEXELS_BASE_URL` override | 中 | 切 `PEXELS_BASE_URL` 到 Cloudflare Worker（**这条路径代码已贯通，待真机确认有效**） |
| **🔴 取图面（M-1）** | `fetch(images.pexels.com/...) → blob → base64` | ❌ **不经 baseURL override** | **最高** | **当前 Worker 救不了**（Worker 不会重写图片 URL）。需评估：见下 |

- **M-1 是 code-review 标出的唯一 MEDIUM 设计缺口**（`18-lib/REVIEW.md` §M-1）：取图的 full-res `fetch()+blob()→base64` 直连 `images.pexels.com` CDN，**绕过了可配 baseURL**。若它被 CORS 拦，单切 `PEXELS_BASE_URL` 不管用。
- **两种可能（真机才知道）**：
  - **乐观**：`images.pexels.com` 作为公开图床 CDN，**很可能本就返回 `Access-Control-Allow-Origin: *`** → 取图根本不需要 Worker，M-1 不成立，直接 PASS。
  - **悲观**：CDN 不放行跨域 fetch → 取图挂。此时**需要扩展 Cloudflare Worker 让它也代理图片 URL**（而非只代理检索 API），并评估安全面（Worker 代理任意图片 URL 的滥用风险）。这是设计决策 + 代码改动，超出本 UAT 范围，FAIL 后交回规划。
- **怎么验**：见 §4 LIB 场景（先验检索通不通，再验取图插入成不成功）。
- **失败时抓**：devtools Console 的 CORS 报错（区分是 `api.pexels.com` 还是 `images.pexels.com` 报的——这决定是检索面还是取图面）+ Network 里两个请求各自的状态 / response header（特别看 `images.pexels.com` 响应有没有 `access-control-allow-origin`）。
- **涉及文件**：`src/providers/pexels-client.ts`（`searchPexels` + `fetchPexelsImageToBase64`）、`src/agent/tools/write/search-stock-image.ts`、`src/providers/registry.ts`（stock-image case，`PEXELS_BASE_URL`）。
- **相关记忆**：`project_no_backend_status`（CORS 失败兜底上 Cloudflare Worker，不上阿里云 VM）；`project_browser_image_gen_gotchas`（签名 URL 被 CORS 拦要 b64_json 内联——生图侧已踩过同类坑）。

---

## 3. 里程碑级 Gate 快照（2026-06-03）

> Phase 19 success criteria #2：`bundle ≤82KB / P95≤10s / npm test green / 0 净新增初始依赖`。

| Gate | 目标 | 结果 | 状态 | 来源 |
|------|------|------|------|------|
| **Bundle size** | main-*.js ≤ 82KB gzip | **80.53 KB gzip**（余量 1.47KB） | ✅ 已自动验证 | `npm run build && npm run size`（18-lib/REVIEW.md §7） |
| **全量测试** | npm test green | **885 passed / 72 files / 0 failed**（尾部 3 个 retry.test unhandled rejection = 已知噪音，非真失败） | ✅ 已自动验证 | `npm test`（18-lib/REVIEW.md §7） |
| **TypeScript** | tsc exit 0 | **exit 0，0 错误**（含 insertImage.ts 删除后无悬空 import） | ✅ 已自动验证 | `npx tsc --noEmit` |
| **0 净新增运行时依赖** | 解析库/Provider 全懒加载或原生 fetch | ✅ 解析库（mammoth/xlsx/pdfjs/jszip）全 `await import()` 独立 chunk，不进初始 main；Pexels 走原生 fetch（0 SDK） | ✅ 已自动验证 | 17-06-SUMMARY.md + 18-01-SUMMARY.md |
| **生产供应链 audit** | 0 高危 | `npm audit --omit=dev` = **0 vulnerabilities**（xlsx/pdfjs/jszip/mammoth 均在已修复版之上）。⚠️ dev 工具链 esbuild/vite/vitest 有既存漏洞，**永不进用户浏览器静态产物**，另案处理 | ✅ 已自动验证 | 17-REVIEW.md §CVE |
| **P95 端到端 ≤ 10s** | 真机掐表 | — | ⬜ 待真机 | 见 §4 各场景顺带观察 |
| **首 token ≤ 2s** | 真机掐表 | — | ⬜ 待真机 | 见 §4 VIS/IMG 场景顺带观察 |

> **性能口径**：P95/首 token 在真机做各场景时顺带感知即可（不必精确仪表化）。生图本身不可流式（doubao/gpt-image-2/gemini 单次返回，high 档可能 ~90s+），不计入「首 token ≤2s」的对话流——那条只针对 LLM 文字流式回复。

---

## 4. 四件套 × 三宿主 UAT 场景

> 四件套 = **VIS 视觉看图 / FILE 文件解析 / IMG 生图插入 / LIB 图库检索**。每条给：① 场景 ② 步骤（宿主+浏览器）③ 预期 ④ 涉及功能/文件 ⑤ 前置 ⑥ 失败抓什么。

---

### 🅥 VIS — 视觉看图（Phase 15；🔁 2026-06-02 Edge 已 PASS，需 Chrome 回归）

> Phase 15 已于 2026-06-02 在 **Office for Web / Edge** 真机 UAT 全 PASS（见 `15-VALIDATION.md` 真机结果栏）。Phase 19 主要是 **Chrome 回归** + 确认迭代后无退化。已知限制：PPT 选中图直接取图在 Web 不可用（Preview API 未 GA）→ fallback 引导上传，属预期内非缺陷。

#### VIS-1 — Excel 选中图表 → agent 看图作答 🔁
- **② 步骤**（Excel / Chrome + Edge）：打开含图表的 Excel → **单击激活图表** → 打开 Aster → 问「这个图表说明了什么趋势？」
- **③ 预期**：agent 自动调 `get_shape_image` 取图表 base64 → 调 aihubmix-vision → 据图作答（描述趋势）。首 token ≤2s（文字流）。
- **④ 功能/文件**：VIS-01；`ExcelAdapter.ts` get_shape_image（`chart.getImage()` + `getActiveChartOrNullObject()`，ExcelApi 1.2）、`aihubmix-vision.ts`、`chat.ts` sendMessage vision 注入。
- **⑤ 前置**：P-2/P-3（aihubmix key）；Excel 内有图表。
- **⑥ 失败抓**：Console（取图报错 / vision 调用报错）+ Network（aihubmix `/chat/completions` 请求状态 + 是否带 image content part）。

#### VIS-2 — Word 选中内嵌图片 → agent 看图作答 🔁
- **② 步骤**（Word / Chrome + Edge）：打开含 inline picture 的 Word → 选中那张图 → Aster 问「描述这张图片」
- **③ 预期**：agent 调 `get_shape_image`（`InlinePicture.getBase64ImageSrc()`，WordApi 1.1）→ vision 据图作答。
- **④ 功能/文件**：VIS-01；`WordAdapter.ts` get_shape_image。
- **⑤ 前置**：P-2/P-3；Word 内有 inline picture。
- **⑥ 失败抓**：同 VIS-1。

#### VIS-3 — PPT 选中图 → fallback 引导上传 🔁（已知限制）
- **② 步骤**（PPT / Chrome + Edge）：选中 PPT 里一张图 → Aster 问「看看这张图」
- **③ 预期**：PPT Preview API 取图在 Web 不可用 → agent 返回结构化 `HOST_API_FAILED` + **诚实引导**「请用回形针上传这张图」（**不假成功**）。
- **④ 功能/文件**：VIS-01 fallback；`PptAdapter.ts` get_shape_image（L564-647，`getSelectedShapes()`+`getImageAsBase64()` Preview API + HOST_API_FAILED fallback）。
- **⑤ 前置**：P-2/P-3。
- **⑥ 失败抓**：若 agent 假装看到了图（幻觉）= FAIL → 抓对话截图 + Console。

#### VIS-4 — 上传/粘贴图片 → agent 看图作答 + 多轮复用 🔁
- **② 步骤**（任一宿主 / Chrome + Edge）：① 点回形针上传 1-2 张图（png/jpg/webp）→ 问「这些图里有什么？」；② 接着再问一句「第一张是什么颜色为主？」（验多轮复用）；③ 试 **Ctrl+V 粘贴**一张图（iframe Permissions Policy 验证点）。
- **③ 预期**：① 据图作答；② 第二轮仍记得图（内存态会话内复用，不重复调 vision——D-03 缓存）；③ Ctrl+V 触发 paste 事件，缩略图 chip 正常出现并可据图作答。刷新页面后图丢失（内存态，符合预期）。
- **④ 功能/文件**：VIS-02 / FILE-06；`attachments.ts` store、`InputBar.tsx`（回形针激活 + paste handler + chip）、`chat.ts` vision 注入 + evidence 缓存。
- **⑤ 前置**：P-2/P-3；测试图片（含一张 >5MB 测超限——预期诚实拦截提示）。
- **⑥ 失败抓**：Console（paste 事件没触发 / clipboard 被 Permissions Policy 阻断）+ 看超大图是否给了提示（注意 IN-05：alert 在 iframe 可能被抑制，见 FILE-5）。

#### VIS-5 — 三类看图失败的诚实错误 🔁
- **② 步骤**：① 没配 aihubmix key 时看图；② 上传一个非图片文件（如 .txt）当图看；③ 取图挂时。
- **③ 预期**：分别给结构化错误——`没配 key` / `不是图` / `取图失败`，**都不假成功**；非图片文件诚实提示（FILE 解析见下，不是图就别当图）。
- **④ 功能/文件**：VIS 三类错误 UX（D-13）。
- **⑥ 失败抓**：对话截图（错误文案是否诚实、是否泄露 key）。

---

### 🅕 FILE — 文件上传与解析（Phase 17；⬜ 全部首次真机）

> Phase 17 **从未真机验过**（17-06 Task 2 本地 dev E2E 按里程碑策略延后至此）。这是首次真机。pdf 部分见 §2 HR-1。

#### FILE-1 — docx 上传 → 解析 → agent 据内容作答 ⬜
- **② 步骤**（任一宿主 / Chrome + Edge）：回形针入口应显示「**参考文件**」→ 上传一份 .docx → chip 先显示「解析中…」→ 变成「文件名 + 仅供 AI 阅读」→ 问「总结这份文档」
- **③ 预期**：chip 正确标注「**仅供 AI 阅读**」（FILE-01/FILE-07 只读边界）；agent 据 docx 内容作答（注入生效）。含中文正常。
- **④ 功能/文件**：FILE-02；`src/lib/parsers/docx.ts`（mammoth `extractRawText`，懒加载）、`InputBar.tsx`、`chat.ts` 文档注入。
- **⑤ 前置**：P-2；真实 .docx（含中文）。
- **⑥ 失败抓**：Network（mammoth chunk `docx-*.js` 是否加载）+ Console（解析报错）+ 对话截图（是否真读到内容）。

#### FILE-2 — xlsx 上传 → 多 sheet CSV 解析 ⬜
- **② 步骤**：上传多 sheet + 含中文的 .xlsx → 问「这个表格的关键数据是什么？」
- **③ 预期**：解析为 CSV 注入（多 sheet 都在），agent 据内容作答；超大表有行截断标记（读前 N 行）。
- **④ 功能/文件**：FILE-03；`src/lib/parsers/xlsx.ts`（SheetJS，懒加载 `xlsx-*.js` 162.96KB chunk）。
- **⑤ 前置**：P-2；多 sheet xlsx。
- **⑥ 失败抓**：Network（`xlsx-*.js` chunk）+ 对话截图。已知 LOW（IN-02）：CSV 含内嵌换行时行数可能多算——不阻断，仅行截断标记数不精确。

#### 🔴 FILE-PDF — pdf 上传 → worker 加载 → 文本提取（= HR-1）⬜
- **② 步骤**（任一宿主 / Chrome + Edge）：上传一份**含文本层**的 .pdf → 问「这份 PDF 讲了什么？」；再上传一份**扫描件 pdf**（无文本层）。
- **③ 预期**：① 含文本层 → worker 成功加载 + 文本提取成功 + agent 据内容作答；② 扫描件 → 结构化报错 `PDF_NO_TEXT_LAYER`（诚实告知没有文本层，**不假成功**）。
- **④ 功能/文件**：FILE-04 / NFR-10 / **HR-1**；`src/lib/parsers/pdf.ts`（pdfjs-dist 5.7.284，懒加载 `pdf-*.js` chunk + `public/pdf.worker.min.mjs` 静态资产，路径用 `import.meta.env.BASE_URL`）。
- **⑤ 前置**：P-2；含文本层 pdf + 扫描件 pdf。
- **⑥ 失败抓**：**Console CSP 报错全文**（`worker-src` / `Refused to create a worker`）+ Network `pdf.worker.min.mjs` 状态码（应 200，注意 base 是否 `/Aster/`）。见 §2 HR-1 兜底动作。

#### FILE-3 — pptx 上传 → 文本 + 备注解析 ⬜
- **② 步骤**：上传一份 .pptx → 问「这个演示文稿的大纲」
- **③ 预期**：按 slide 数字序提取文本（含演讲者备注），agent 据内容作答。
- **④ 功能/文件**：FILE-05；`src/lib/parsers/pptx.ts`（jszip 懒加载 `jszip.min-*.js` 29.87KB + 正则提 `<a:t>`）。
- **⑤ 前置**：P-2；.pptx。
- **⑥ 失败抓**：Console + 对话截图。已知 LOW（IN-03 slide 标签号在删过页时可能偏差、IN-01 XML 实体已修）——不阻断。

#### FILE-4 — 附件 vs 自取文档边界 + 移除 + 不支持类型 ⬜
- **② 步骤**：① 上传 docx 后看 chip 是否标「仅供 AI 阅读」（只读快照）对比 agent 自取当前文档（live 可写回）；② 点 chip 的 × 移除 → 再问 → agent 不再引用；③ 上传一个 **.zip**（不支持类型）；④ 上传一个 **>20MB** 文档（超限）；⑤ 同一条消息混合**图片 + docx**。
- **③ 预期**：① 边界清晰（附件只读、不写回——FILE-07）；② 移除生效；③ 诚实提示「暂不支持该文件类型…」（非旧占位、非假成功）；④ 前置拦截「文件过大」；⑤ 两路派生文本都进 prompt（图走 vision evidence + docx 走 derivedText，D-05）。
- **④ 功能/文件**：FILE-07 / FILE-01；`attachments.ts`（判别联合 `AttachedImage | AttachedDocument`）、`InputBar.tsx`（20MB 文档 / 5MB 图前置拦）。
- **⑥ 失败抓**：见 FILE-5（错误反馈用 alert，iframe 可能不弹）。

#### FILE-5 — ⚠️ IN-05：错误反馈 alert 在 iframe 是否可见 ⬜
- **② 步骤**：触发 FILE-4 的 ③（不支持类型）/ ④（超大文件）/ VIS-4 的超大图。
- **③ 预期**：用户**能看到**「暂不支持该文件类型」/「文件过大」反馈。
- **⚠️ 已知风险（code-review IN-05）**：错误用原生 `window.alert()`，而 Office for Web Task Pane iframe **可能抑制 alert** → 用户拿不到反馈。
- **④ 功能/文件**：`InputBar.tsx`（图过大/文件过大/不支持类型用 alert）。codebase 已有 `useToastStore`。
- **失败动作**：若 alert 不弹 → 建议后续改走 `showToast`（已列入技术债，非发布阻塞，但 UX 缺陷需记录）。
- **⑥ 失败抓**：录屏/截图（触发后有没有任何可见反馈）+ Console（有没有 alert 被宿主拦的提示）。

#### FILE-6 — NFR-09：文档 derivedText 不进持久化（可命令行验，真机抽查）✅/⬜
- **③ 预期**：`serializeForStorage` 白名单只存 user/assistant 文本；derivedText/base64 绝不进 localStorage 持久化历史。
- **状态**：✅ 已自动验证（chat.test.ts 路径 A/B/C/D/E + attachments.test.ts 守门，17-REVIEW.md §正向核验确认无旁路）。真机可抽查：上传文档 → 发消息 → 刷新页面 → 历史里不应残留文档全文（只有你打的字）。

---

### 🅘 IMG — 图片生成插入（Phase 16；🔁 2026-06-02 Edge 已 PASS，需 Chrome 回归）

> Phase 16 已于 2026-06-02 在 **Office for Web** 真机 UAT 全 PASS（见 `16-VERIFICATION.md`，含 PPT 自动直插+撤销+AI 自主排版、Word body 级直插、Excel 诚实拒绝、对话式重画、NFR-09）。**设计已反转**：原「预览后确认再插入」→「AI loop 内自动直插 + 只读结果卡」。Phase 19 主要 **Chrome 回归**。

#### IMG-1 — PPT 生图 → 自动直插 → AI 自主排版 → 撤销 🔁
- **② 步骤**（PPT / Chrome + Edge）：① 「生成一张星空的图插到这页」→ ② 接着「把它移到右上角并缩小」→ ③ 用 Undo 撤销。
- **③ 预期**：① AI 在 loop 内**自动插入**当前 slide（无确认打断），chat 出现**只读结果卡**（缩略图）；② AI 用返回的 shape_id 调 move_shape/set_shape_property 自主挪图缩放成功；③ Undo 走 `delete_shape_by_id`（Record 对象 reverse 路径）可撤。
- **④ 功能/文件**：IMG-01/03/04；`ppt-image.ts`、`PptAdapter.addImageShape`（裸 base64 + 写后回读）。
- **⑤ 前置**：P-2/P-3（aihubmix key）。**生图慢**（gpt-image-2 high ~90s+）——dispatchTool 已设 120s 超时不误杀（`project_browser_image_gen_gotchas`）。
- **⑥ 失败抓**：Console（生图 CORS / 超时 / 吞错）+ Network（aihubmix `/images` 或 predictions 请求；注意 doubao 已知坑要 b64_json 内联）+ slide 截图。

#### IMG-2 — Word body 级生图插入 + noop 诚实撤销 🔁
- **② 步骤**（Word / Chrome + Edge）：「生成一张海边的图插进文档」→ 试 Undo。
- **③ 预期**：body 级插入 inline picture 成功（`insertInlinePictureFromBase64` 裸 base64，规避 range 级 bug #3434）；Undo **诚实标 noop**「Word 图片插入暂不支持自动撤销」（DiffLog 显示），不假装撤销。
- **④ 功能/文件**：IMG-02；`word-image.ts`、`WordAdapter.insertBodyImage`。
- **⑥ 失败抓**：Console + Word body 截图。

#### IMG-3 — 切生图 model + 对话式「换一张」🔁
- **② 步骤**：① Settings → 生图 model picker 切 model；② 生图后说「换一张」/「用 gpt-image-2 重画」。
- **③ 预期**：① model 切换生效（三级优先级：工具 model_id > storage PREF > registry 默认 doubao）；② AI 重调工具直插换图。
- **④ 功能/文件**：IMG-04；Settings model picker、`registry` image-gen resolve、`PREF_IMAGE_GEN_MODEL`。
- **⑥ 失败抓**：Network（请求里的 model 字段是否切换）。

#### IMG-4 — Excel 诚实拒绝插图 🔁
- **② 步骤**（Excel / Chrome + Edge）：要求 agent「生成一张图插进来」。
- **③ 预期**：agent 诚实回答「Excel 无原生插图 API，不支持插图」（generate 工具未注册到 excel host）。
- **④ 功能/文件**：IMG-05；`buildToolsForHost`（tools-host.test 守门：excel 不含 generate_*_image）。
- **⑥ 失败抓**：对话截图（是否假装插了 / 是否报丑陋错误而非诚实拒绝）。

#### IMG-5 — NFR-09：生图 base64 不进 history ✅/⬜
- **状态**：✅ 已自动验证（thumbnail base64 仅进内存态 tool message，serializeForStorage tool role 整条丢弃）。真机抽查：生图后刷新页面 → 历史不含 base64。

---

### 🅛 LIB — 公开图库检索 Pexels（Phase 18；⬜ 全部首次真机；= HR-2）

> Phase 18 **从未真机验过**。这件套的核心风险就是 §2 HR-2 的双重 CORS（尤其 M-1 取图面）。**建议顺序：先验检索通不通（LIB-1），再验取图插入成不成功（LIB-2）。**

#### 🔴 LIB-1 — Pexels 检索 → 缩略图（检索面 CORS）⬜
- **② 步骤**（PPT 或 Word / Chrome + Edge）：① Settings →「图库 / Pexels API Key」密码框粘贴 key（输入/清空/刷新持久——partitioned localStorage round-trip）；② chat「找张海边日落的图插进来」。
- **③ 预期**：agent 调 `search_and_insert_stock_image` → `api.pexels.com/v1/search`（locale=zh-CN）检索成功（**不被 CORS 拦**）→ 拿到候选。
- **④ 功能/文件**：LIB-01；`pexels-client.ts` searchPexels（裸 key 无 Bearer）、`registry.ts` stock-image case（`PEXELS_BASE_URL` 可配）、`SettingsPanel.tsx` Pexels key 字段。
- **⑤ 前置**：P-2/P-4（Pexels key）。
- **⑥ 失败抓**：Console CORS 报错（确认是 `api.pexels.com` 报的=检索面）+ Network `/v1/search` 状态。**若检索面被拦** → 兜底切 `PEXELS_BASE_URL` 到 Cloudflare Worker（这条 override 已贯通，验证它能救）。也验：没配 key 时给 `KeyInvalidError` 气泡诚实引导。

#### 🔴 LIB-2 — 取图 full-res → 裸 base64 → 直插（M-1 取图面 CORS，最危）⬜
- **② 步骤**：接 LIB-1，若检索通 → 看 full-res 取图 + 插入是否成功。
- **③ 预期**：`fetchPexelsImageToBase64(photo.src.large)` 从 `images.pexels.com` CDN `fetch→blob→base64` 成功 → 裸 base64 直插 PPT（`fill.setImage`）/ Word（`insertInlinePictureFromBase64`）→ 返回 shape_id。
- **🔴 已知缺口 M-1**：取图**不经** `PEXELS_BASE_URL` override → 若 CORS 拦，切 Worker 救不了取图。
- **④ 功能/文件**：LIB-02；`pexels-client.ts` `fetchPexelsImageToBase64`、`search-stock-image.ts`（timeoutMs=120s）、`PptAdapter.addImageShape` / `WordAdapter.insertBodyImage`。
- **⑤ 前置**：LIB-1 通过；慢网大图——`STOCK_IMAGE_TIMEOUT_MS`=120s 不被默认 15s 误杀（待真机确认）。
- **⑥ 失败抓**：**Console CORS 报错（确认是 `images.pexels.com` 报的=取图面 M-1）+ Network `images.pexels.com` 请求的 response header 有没有 `access-control-allow-origin`**。
  - **若 CDN 返 `ACAO:*`** → M-1 不成立，取图直接 PASS（乐观路径）。
  - **若被拦** → M-1 坐实 → FAIL，交回规划：评估「扩展 Cloudflare Worker 代理图片 URL」（含安全面）。**这是发布阻塞项之一**（LIB 这件套不可用）。

#### LIB-3 — chat 署名卡（不叠水印）⬜
- **② 步骤**：接 LIB-2 插入成功后，看 chat 里的署名卡 + 插入的图片本身。
- **③ 预期**：chat 显示「照片来自 Pexels · 摄影师 X」**可点链接**（Pexels 链 + 摄影师链，`rel="noopener noreferrer"` 防 tabnabbing）；缩略图用**远程 URL**（`photo.src.tiny`，`<img src>` 不受 CORS 限）；**插入到 slide/文档的图片本身无水印**（署名只在 chat，不叠在图上）。
- **④ 功能/文件**：LIB-03；`StockImageResultCard.tsx`（lazy chunk）、`ChatStream.tsx`（据 thumbnail_url+photographer 识别图库结果，与生图卡互斥）。
- **⑥ 失败抓**：chat 截图（署名链接可点否、图上有没有水印）+ slide/文档截图。

#### LIB-4 — 「换一张」翻页 ⬜
- **② 步骤**：插入后说「换一张」。
- **③ 预期**：AI 递增 `page` 重调工具取下一批（D-05 最简形态，工具无候选游标）。
- **④ 功能/文件**：LIB-02；`search-stock-image.ts`（photos[0] + AI 控 page）。
- **⑥ 失败抓**：Network（第二次请求 page 是否 +1）。

#### LIB-5 — NFR-09：图库 tool data 不进 history ✅/⬜
- **状态**：✅ 已自动验证（chat.test.ts 路径 E：tool role 整条丢弃，thumbnail_url/base64/inserted 标记均不进 serialize）。真机抽查：插图后刷新 → 历史不残留。

---

## 5. 发布清单（用户真机 UAT 全 PASS 后执行）

> **⚠️ 顺序很重要**：tag v2.2 之前必须先 push + Pages 部署，否则 sideload 拿到的不是要发布的版本。
>
> **谁来 push/tag**：按项目约定 + 记忆 `feedback_push_before_deploy_claims`，**push 与 tag 由用户、或 team-lead 在用户明确确认真机 UAT 通过后执行**。本 packet 作者（uat-packet）不 push、不 tag。

| 步 | 动作 | 命令 / 说明 | 验收 |
|----|------|------------|------|
| 1 | 构建 | `npm run build` | vite build 成功，无 TS 错误 |
| 2 | 确认 bundle | `npm run size`（**先 build 再 size**，避免陈旧 dist 假绿——记忆 `project_bundle_size_guard`） | main-*.js ≤ 82KB gzip（当前 80.53KB，余量 1.47KB） |
| 3 | 推送触发部署 | `git push origin main` → GitHub Pages 自动部署 | Pages Actions 绿；`wynne-cwb.github.io/Aster/` 更新 |
| 4 | 线上 sideload 复验 | 部署完成后，sideload 线上版**快速冒烟**四件套各一条（不必全套重跑） | 线上版本 = 刚 push 的版本（Settings 有 Pexels 字段 + 四件套可用） |
| 5 | 打 tag | `git tag v2.2 && git push origin v2.2` | tag v2.2 出现在远程；对齐 v2.0/v2.1 发布范式 |
| 6 | 收尾对账 | 更新 STATE（status→milestone complete）+ ROADMAP（Phase 19 → Complete，v2.2 milestone ✅）+ 归档（参 `/gsd-complete-milestone`） | STATE/ROADMAP 标 v2.2 shipped + 线上 commit hash + tag |

**发布前再核一遍里程碑级 gate（§3）：** bundle ≤82KB ✅ / 885 tests green ✅ / 0 净新增依赖 ✅ / tsc 0 ✅ — 已自动验证；P95≤10s + 首 token≤2s 由真机 UAT 顺带确认。

**若 LIB-2（M-1 取图 CORS）FAIL：** 这是发布阻塞项 → 不 tag，交回规划评估「扩展 Cloudflare Worker 代理图片 URL」。其余三件套（VIS/FILE/IMG）若全 PASS，可考虑与用户商议「先发 VIS/FILE/IMG、LIB 标 known-issue / 下个补丁」——但这属产品决策，由用户拍板。

---

## 附录：UAT 场景索引（24 条）

| 件套 | 场景 | 状态 | 高危 |
|------|------|------|------|
| 置顶 | HR-1 pdf.js worker CSP | ⬜ | 🔴 |
| 置顶 | HR-2 Pexels 双重 CORS（含 M-1） | ⬜ | 🔴 |
| VIS | VIS-1 Excel 图表看图 | 🔁 Chrome 回归 | |
| VIS | VIS-2 Word 内嵌图看图 | 🔁 Chrome 回归 | |
| VIS | VIS-3 PPT fallback 引导上传 | 🔁 Chrome 回归 | |
| VIS | VIS-4 上传/粘贴图 + 多轮复用 | 🔁 Chrome 回归 | |
| VIS | VIS-5 三类看图失败诚实错误 | 🔁 Chrome 回归 | |
| FILE | FILE-1 docx 解析 | ⬜ 首次真机 | |
| FILE | FILE-2 xlsx 多 sheet | ⬜ 首次真机 | |
| FILE | FILE-PDF pdf 解析（=HR-1） | ⬜ 首次真机 | 🔴 |
| FILE | FILE-3 pptx 文本+备注 | ⬜ 首次真机 | |
| FILE | FILE-4 附件边界+移除+不支持类型 | ⬜ 首次真机 | |
| FILE | FILE-5 IN-05 alert 在 iframe 可见性 | ⬜ 首次真机 | ⚠️ |
| FILE | FILE-6 NFR-09 文档不进持久化 | ✅ + 真机抽查 | |
| IMG | IMG-1 PPT 自动直插+排版+撤销 | 🔁 Chrome 回归 | |
| IMG | IMG-2 Word body 直插+noop 撤销 | 🔁 Chrome 回归 | |
| IMG | IMG-3 切 model + 换一张 | 🔁 Chrome 回归 | |
| IMG | IMG-4 Excel 诚实拒绝 | 🔁 Chrome 回归 | |
| IMG | IMG-5 NFR-09 生图不进 history | ✅ + 真机抽查 | |
| LIB | LIB-1 检索 CORS（检索面） | ⬜ 首次真机 | 🔴 |
| LIB | LIB-2 取图 CORS（M-1 取图面） | ⬜ 首次真机 | 🔴🔴 |
| LIB | LIB-3 署名卡不叠水印 | ⬜ 首次真机 | |
| LIB | LIB-4 「换一张」翻页 | ⬜ 首次真机 | |
| LIB | LIB-5 NFR-09 图库不进 history | ✅ + 真机抽查 | |

**来源**：ROADMAP §Phase 19 success criteria；17-VALIDATION/17-REVIEW/17-06-SUMMARY；18-VALIDATION/18-lib/REVIEW/18-0X-SUMMARY；15-VALIDATION/15-VERIFICATION/15-05-SUMMARY；16-VALIDATION/16-VERIFICATION/16-05-SUMMARY；14-VALIDATION（三路真打执行期已过；doubao CORS 已在 Phase 16 修复，无遗留）。
