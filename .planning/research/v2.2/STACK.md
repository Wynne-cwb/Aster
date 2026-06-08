# Stack Research — v2.2 多模态四件套

**Domain:** Office.js Add-in multimodal capabilities (vision / file parsing / image generation / stock image search)
**Researched:** 2026-06-01
**Confidence:** MEDIUM-HIGH (parsers HIGH; stock-image MEDIUM; DeepSeek vision LOW — needs spike)

> **范围说明**：本文件只覆盖 v2.2 新增的多模态能力所需技术决策。现有已锁定栈（Vite 7 / React 19 / TS strict / Zustand 5 / native fetch+SSE / teal CSS / Lingui / @types/office-js CDN / partitioned localStorage）**不再复述，不再复研究**。

---

## 核心结论 TL;DR

| 问题 | 答案 | 置信度 |
|------|------|--------|
| MM-02 docx 解析 | mammoth `1.12.0` + Vite dynamic import | HIGH |
| MM-02 xlsx 解析 | SheetJS `0.20.3` from cdn.sheetjs.com tgz | HIGH |
| MM-02 pdf 解析 | pdfjs-dist `5.7.284` + `?worker` Vite suffix | HIGH |
| MM-02 pptx 解析 | jszip `3.10.1` + 浏览器原生 DOMParser（DIY） | HIGH |
| MM-04 图库 | **Pexels**（优于 Unsplash；直接 browser fetch CORS OK） | MEDIUM |
| MM-01 视觉 model | aihubmix `gpt-5.1` 或 `gpt-4o`，OpenAI-compat image_url | MEDIUM |
| MM-01 DeepSeek V4 原生多模态 | **官方文档无证据** — Q6 仍 OPEN，fallback = aihubmix | LOW |
| MM-03 PPT 插图 API | `setSelectedDataAsync(CoercionType.Image)` base64 — Web GA | HIGH |
| MM-03 Word 插图 API | `body.insertInlinePictureFromBase64` — Web 支持；range.insert 有问题 | MEDIUM |
| MM-03 Excel 插图 | 不支持 — Excel 无原生图片插入 Office.js API | HIGH |

---

## (a) 文件解析器 — MM-02 文件上传解析

### mammoth（docx → text）

| 属性 | 值 |
|------|----|
| 版本 | `1.12.0`（2026-03-12 发布，当前 latest） |
| 安装 | `npm install mammoth`（从 npm 安装，无问题） |
| 浏览器 ESM import | `import mammoth from 'mammoth'`（bundler 自动选 ESM 入口；或用 `mammoth.browser.min.js` standalone） |
| 估算 gzip | ~200–250 KB（包含所有依赖，install size 2.2 MB unpacked；browser bundle 小很多） |
| Worker | **不需要**，纯同步 JS，无 Worker 要求 |
| 懒加载策略 | `const { default: mammoth } = await import('mammoth')` — 用户点击上传 .docx 时才加载 |
| 安全注意 | 无内置 HTML sanitization；我们只取 text，不注入 DOM，安全 |
| 为何选它 | 浏览器侧 docx 解析的标准事实选择，无实质竞争对手；BSD-2-Clause；TS 类型内置 |

**使用方式（text-only 模式）：**
```typescript
const { default: mammoth } = await import('mammoth');
const result = await mammoth.extractRawText({ arrayBuffer: fileArrayBuffer });
return result.value; // 纯文本
```

---

### SheetJS xlsx（xlsx → JSON/CSV）

| 属性 | 值 |
|------|----|
| 版本 | `0.20.3`（npm registry 的 `xlsx` 包停在 0.18.5 且不再维护，**必须从 cdn.sheetjs.com 安装**） |
| 安装 | `npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`（或 `xlsx-latest`） |
| 浏览器 ESM import | `import * as XLSX from 'xlsx'`（包含 `xlsx.mjs` ESM 入口） |
| 估算 gzip | ~180 KB（full build；mini build 更小但去掉非 XLSX 格式支持，适合我们只读路径） |
| Worker | **不需要** |
| 懒加载策略 | `const XLSX = await import('xlsx')` — 用户上传 .xlsx 时才加载 |
| tree-shaking 注意 | `writeFile`/`writeFileXLSX` 等写路径我们不需要；import 时避免全量导入写方法（Vite tree-shake 会自动优化，但只引入读方法更明确） |
| 为何选它 | 最广泛格式支持；官方推荐安装路径是 cdn.sheetjs.com，npm 包是废弃 legacy |

**CRITICAL 安装警告：** 不要 `npm install xlsx`（npm registry 版本是 0.18.5，有已知安全问题，且不是当前维护版本）。必须从 `cdn.sheetjs.com` 安装 tgz。

```typescript
const XLSX = await import('xlsx');
const wb = XLSX.read(arrayBuffer, { type: 'array' });
const ws = wb.Sheets[wb.SheetNames[0]];
return XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
```

---

### pdfjs-dist（pdf → text）

| 属性 | 值 |
|------|----|
| 版本 | `5.7.284`（2026-05 latest；v5 是 ESM-only，已删 UMD bundle） |
| 安装 | `npm install pdfjs-dist` |
| 浏览器 ESM import | `import * as pdfjsLib from 'pdfjs-dist'` |
| 估算 gzip | main layer ~150 KB；**worker 文件 ~400 KB（必须独立 chunk）** |
| Worker 要求 | **必须** 配置 `GlobalWorkerOptions.workerSrc`，否则报错 |
| Vite worker 策略 | 使用 `import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'` 然后 `pdfjsLib.GlobalWorkerOptions.workerPort = new pdfWorker()`；或 `?url` suffix |
| 懒加载策略 | 包含 worker 设置的整块作为 dynamic import chunk；worker 本身由 Vite 自动 emit 为独立文件 |
| 为何选它 | Mozilla 官方出品；浏览器侧 PDF 文本提取的唯一成熟选择 |

**v5 重要变化：** ESM-only，UMD 已删。Vite 项目 `package.json` 需确认 `"type": "module"`（Aster 已有）。Worker 版本号必须与主包版本一致。

```typescript
async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  const pdfWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?worker');
  pdfjsLib.GlobalWorkerOptions.workerPort = new pdfWorker.default();
  
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = await Promise.all(
    Array.from({ length: doc.numPages }, (_, i) =>
      doc.getPage(i + 1).then(p => p.getTextContent())
    )
  );
  return pages.flatMap(p => p.items.map((it: { str: string }) => it.str)).join(' ');
}
```

---

### pptx 文本提取（JSZip + 原生 DOMParser DIY）

**决策：选 DIY（jszip + 浏览器原生 DOMParser），否决 `@jvmr/pptx-to-html`**

理由：
- `@jvmr/pptx-to-html` 是 2026-03 发布的单作者新库，无生产验证，风险高
- DIY 路径（jszip + DOMParser）是 2026 年浏览器 pptx 文本提取的行业标准模式；大量生产代码在用
- DOMParser 是浏览器原生，**零额外 bundle**；jszip 3.10.1 约 33 KB gzip
- 我们只需要 `<a:t>` 文本节点，不需要渲染/布局，DIY 路径 30 行代码可以搞定
- PRD 已接受「text only，不保真」的降级

| 属性 | 值 |
|------|----|
| jszip 版本 | `3.10.1`（npm latest，4 年未更新但稳定，6,683+ 项目在用） |
| 安装 | `npm install jszip` |
| 估算 gzip | ~33 KB（CJS；ESM fork `@progress/jszip-esm` 更小但增加维护风险） |
| Worker | 不需要 |
| 懒加载策略 | `const JSZip = await import('jszip')` — 用户上传 .pptx 时才加载 |
| DOMParser | 浏览器原生，0 KB 额外 bundle |

```typescript
async function extractPptxText(arrayBuffer: ArrayBuffer): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(arrayBuffer);
  const textParts: string[] = [];
  
  // 遍历 ppt/slides/slide*.xml
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort(); // 按幻灯片顺序
  
  for (const filename of slideFiles) {
    const xml = await zip.files[filename].async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const textNodes = doc.querySelectorAll('t'); // <a:t> 标签
    textNodes.forEach(node => textParts.push(node.textContent ?? ''));
  }
  
  return textParts.join(' ');
}
```

---

### 懒加载 Bundle 策略（≤82 KB CI gate）

**重要**：所有解析器都是重量级模块，**绝对不能进 initial chunk**。

| 模块 | 估算 lazy chunk gzip | 触发时机 |
|------|---------------------|---------|
| mammoth | ~200–250 KB | 用户上传 .docx |
| SheetJS xlsx | ~180 KB | 用户上传 .xlsx |
| pdfjs main | ~150 KB | 用户上传 .pdf |
| pdfjs worker | ~400 KB（独立 worker 文件） | pdfjs 主 chunk 加载时由 Worker API 加载 |
| jszip | ~33 KB | 用户上传 .pptx |
| **合计 initial 影响** | **0 KB** | 均为 dynamic import，Vite 自动分 chunk |

**Vite 配置要点：** 不需要手动配置 `manualChunks`；Vite 对 `await import(...)` 自动分 chunk。pdfjs worker 用 `?worker` suffix 会生成独立 worker bundle。

---

## (b) 图库 API — MM-04 公开图库检索

**推荐：Pexels（优先于 Unsplash）**

### Pexels vs Unsplash 对比

| 维度 | Pexels | Unsplash | 决策权重 |
|------|--------|----------|---------|
| 浏览器直连 CORS | **支持**（大量 browser fetch 实例，Authorization header） | **有问题**（CORS preflight 历史缺失 `authorization` header；建议用 proxy） | 高 |
| 免费 rate limit | 200 req/小时 + 20,000/月（default）；可申请无限制 | 50 req/小时 demo；1,000/小时 production 审批 | 中 |
| 中文搜索 | **原生支持** `locale=zh-CN` 参数 | 不明确，无 locale 参数文档 | 高（Aster 中文定位） |
| Attribution 要求 | API 使用需显示 Pexels 链接 + 摄影师链接（可接受，插入图片时显示） | API 使用**强制** attribution + UTM 参数 + download endpoint 调用 | 中 |
| 商用授权 | 完全免费商用，仅禁止转卖未修改图片 | 完全免费商用，同限制 | 相同 |
| 视频支持 | 有（可后续扩展） | 无 | 低 |

**选 Pexels 的核心理由：**
1. **CORS**：Pexels API 被大量 browser-side 应用直接调用（`Authorization: YOUR_API_KEY` header，无 Bearer 前缀）。Unsplash 有已知 CORS preflight 问题，需要 proxy — 而 Aster 无后台，proxy 是硬约束违反。
2. **中文搜索**：Pexels 有文档明确的 `locale=zh-CN` 参数，对中文职场用户直接有益。
3. **Rate limit**：200/小时对内嵌 Office 场景绰绰有余；Unsplash 的 50/小时 demo 限制太低。

**API 调用形态（browser fetch，无需任何库）：**
```typescript
async function searchPexelsPhotos(
  query: string,
  apiKey: string,
  locale = 'zh-CN',
  perPage = 15
): Promise<PexelsPhoto[]> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&locale=${locale}&per_page=${perPage}`;
  const resp = await fetch(url, { headers: { Authorization: apiKey } });
  if (!resp.ok) throw new Error(`Pexels ${resp.status}`);
  const data = await resp.json() as { photos: PexelsPhoto[] };
  return data.photos;
}
```

**Attribution 实现建议：** 插入图片时在 task pane 显示「来源：Pexels / 摄影师姓名」文字链接（类似 Unsplash 插件做法）。这满足 API ToS，无需后端。

**API Key 存储：** 与 DeepSeek/aihubmix key 一样，存 `partitioned localStorage`，同一 `STORAGE_KEYS.KEY_PREFIX + 'pexels'` 模式。

---

## (c) 视觉能力 — MM-01 视觉看图

### DeepSeek V4 原生多模态：Q6 仍 OPEN（LOW confidence）

**调研结论：DeepSeek V4 官方 API 文档没有 vision/image input 的任何记录。**

核实路径：
1. `api-docs.deepseek.com/` — 首页只列 text chat completions
2. `api-docs.deepseek.com/quick_start/pricing` — model feature 表只有 JSON Output / Tool Calls / FIM，无 vision
3. `api-docs.deepseek.com/api/list-models` — 只有 `deepseek-v4-flash` 和 `deepseek-v4-pro`，无视觉 model
4. 第三方文章（MindStudio, Clore.ai）声称 V4 支持 vision，但**均无 API endpoint 或 model ID 级别的证据**

**结论：**
- DeepSeek V4 模型架构层面可能是多模态的（学术论文声称），但 `api.deepseek.com` 的 Chat Completions API 目前**不暴露 image_url content parts 的文档或 model**
- Q6「DeepSeek-V4 是否原生多模态」的答案是：**官方文档无证据，spike 仍然必要**
- Spike 动作：向 `POST https://api.deepseek.com/chat/completions` 发送 `model=deepseek-v4-pro` + `content=[{type:'image_url', image_url:{url:'data:image/png;base64,...'}}]`。如果返回 400/unsupported，则确认 V4 API 不支持，继续用 aihubmix vision

**fallback 已就绪：** `src/providers/aihubmix-vision.ts` 已实现，registry 路由 `taskKind='vision'` 已在。只需接入 agent loop + tool，不需要新 Provider 代码。

---

### aihubmix vision model 选择（MEDIUM confidence）

`src/providers/registry.ts` 当前 `AIHUBMIX_VISION_MODEL = 'gpt-5.1'`。

调研发现：
- aihubmix 文档的 Multimodal 页展示的是 Gemini 系列模型（`gemini-2.5-flash-image-preview`）的 image_url 格式
- aihubmix 是 OpenAI-compat 代理，支持的 vision 模型包括 `gpt-4o`、`gpt-5` 系列、Gemini 系列等
- `gpt-5.1` 是否存在：**未在官方文档找到该 model ID**；registry 里的 `gpt-5.1` 是 Phase 06 更新的猜测值

**建议：**
- 默认 vision model 改为 `gpt-4o`（aihubmix 明确支持，vision 稳定，价格合理）
- 进阶可选 `gpt-5`（aihubmix 宣称支持，如可用则视觉能力更强）
- **一次性 spike** 验证 `gpt-5.1` / `gpt-5` / `gpt-4o` 在 aihubmix 上实际可用的 model ID

**API 格式（已在 aihubmix-vision.ts 中实现，格式正确）：**
```jsonc
POST https://api.aihubmix.com/v1/chat/completions
Headers: Authorization: Bearer <KEY>
{
  "model": "gpt-4o",   // 或 gpt-5
  "stream": false,
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "描述这张图片" },
      { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
    ]
  }]
}
```
`aihubmix-vision.ts` 的现有格式**不需要修改**；只需更新 registry 常量为已验证 model ID。

---

## (d) Office.js 插图 API — MM-03 图片生成插入

### PowerPoint：`setSelectedDataAsync` with `CoercionType.Image`（GA）

| 属性 | 值 |
|------|-----|
| API | `Office.context.document.setSelectedDataAsync(base64data, { coercionType: Office.CoercionType.Image }, callback)` |
| Requirement Set | `ImageCoercion 1.1`（Common API，不是 PPT-specific） |
| Office for Web | **正式支持**（ImageCoercion 1.1 明确列出 PowerPoint on the web） |
| 输入格式 | base64 字符串（不含 `data:image/png;base64,` 前缀，只传原始 base64） |
| 位置控制 | 图片插入到当前选中位置（幻灯片中央如无选区） |

**注意事项：**
- `shapes.addPicture(base64, options)` 是更现代的 API，但目前是 **BETA/Preview**（`PowerPointApi BETA`），不能用于生产
- `setSelectedDataAsync` 是 Common API，较旧但 Office for Web 稳定支持
- 有报告说 Desktop 工作而 Web 报错，这通常是旧版本 Office 问题；现代 Office for Web 有 ImageCoercion 1.1 支持
- **「写后回读验证」原则仍适用**（v2.1 memory `project_ppt_officejs_gotchas`）：插入后验证 shapes count 增加

```typescript
// PPT 插图（base64，不含 data URI 前缀）
await new Promise<void>((resolve, reject) => {
  Office.context.document.setSelectedDataAsync(
    base64Image,          // 纯 base64，无前缀
    { coercionType: Office.CoercionType.Image },
    (result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) resolve();
      else reject(new Error(result.error.message));
    }
  );
});
```

### Word：`body.insertInlinePictureFromBase64`（GA，有注意事项）

| 属性 | 值 |
|------|-----|
| API | `context.document.body.insertInlinePictureFromBase64(base64, insertLocation)` |
| 输入格式 | base64 字符串（无前缀） |
| Office for Web | **支持**（ImageCoercion 1.1 包含 Word on the web） |
| CRITICAL 注意 | **`range.insertInlinePictureFromBase64` 在 Word Online 报 `NotAllowed`** — 必须用 `body` 而不是 `range` |

**必须使用 body 级别，不能用 range 级别：**
```typescript
// Word 插图 — 用 body，不用 range（range 在 Web 上 NotAllowed）
await Word.run(async (context) => {
  context.document.body.insertInlinePictureFromBase64(base64Image, Word.InsertLocation.end);
  await context.sync();
});
```

若未来需要在特定光标位置插入，可考虑 `insertOoxml` 方式包装 `<w:drawing>`（workaround，复杂度高，v2.2 MVP 不需要）。

### Excel：**不支持**

Office.js 没有在 Excel 中插入图片的原生 API。Excel JavaScript API 的 `shapes` 集合支持 `addGeometricShape`、`addTextBox` 等，但**不支持 `addImage` 或任何图片插入**（截至 2026-06 PowerPoint API requirement sets 文档）。

**v2.2 决策：Excel 不做图片生成插入功能（MM-03 仅限 PPT + Word 两宿主）。**

---

## (e) 净新增运行时依赖分析

### 真正需要的新依赖

| 库 | 新增原因 | 类型 | bundle 影响 |
|----|---------|------|------------|
| `mammoth@1.12.0` | docx → text 解析（无竞争对手） | lazy（MM-02 触发） | ~0 KB initial |
| `xlsx@0.20.3`（cdn.sheetjs.com） | xlsx → JSON 解析（无竞争对手） | lazy（MM-02 触发） | ~0 KB initial |
| `pdfjs-dist@5.7.284` | pdf → text 解析（无竞争对手） | lazy（MM-02 触发） | ~0 KB initial |
| `jszip@3.10.1` | pptx text extraction（DIY 30行） | lazy（MM-02 触发） | ~0 KB initial |

**Pexels / aihubmix / DeepSeek：使用原生 fetch，0 额外依赖。**

### 不需要的依赖

| 避免 | 理由 |
|------|------|
| `@jvmr/pptx-to-html` | 新库（2026-03），单作者，无生产验证；DIY jszip+DOMParser 30 行足够 |
| `unsplash-js` | 官方 SDK；Unsplash CORS 问题使直接 browser fetch 不可靠，整个 Unsplash 方案排除 |
| `pexels` npm 包 | 官方 SDK 增加 bundle，原生 fetch 已够；且 SDK 也是 browser 调用，没有 CORS 优势 |
| `openai` SDK / `@anthropic-ai/sdk` | 已验证的架构原则，vision 用 native fetch 即可 |
| `fflate` / `client-zip` | 我们只需要读 zip（jszip），不需要写/压缩，无需替换 |

### initial bundle 影响

所有 4 个解析库均为 dynamic import，Vite 自动分 chunk。**initial bundle 增量 = 0 KB**。

当前 initial bundle：75.03 KB gzip（v2.1 实测），CI gate ≤82 KB。v2.2 新增代码（tool 定义 + adapter + UI）预计增加 ~3–5 KB，仍远低于 gate。

---

## 安装命令

```bash
# 文件解析器（均为 lazy，进 dependencies 但只 dynamic import）
npm install mammoth
npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
npm install pdfjs-dist
npm install jszip

# 无其他新依赖（Pexels/aihubmix/DeepSeek 均用 native fetch）
```

**注意：** 不要 `npm install xlsx`（npm registry 旧版，不安全）。

---

## 需要 Spike 验证的项目（阻塞 phase 开始前必须完成）

| Spike 项 | 目的 | 验证方式 |
|---------|------|---------|
| DeepSeek V4 vision (Q6) | 确认 `deepseek-v4-pro` 是否接受 `image_url` content part | 用 `.env.local` KEY 发一次带图片的请求，看返回 200 还是 400 |
| aihubmix vision model ID | 确认 `gpt-5.1` / `gpt-5` / `gpt-4o` 在 aihubmix 实际可用 | `GET https://api.aihubmix.com/v1/models` 查列表；发一次 vision 请求 |
| Pexels CORS in Office Web | 验证从 Office for Web Task Pane iframe 调用 Pexels API 无 CORS 拦截 | 在 sideload 环境 fetch Pexels search 端点 |
| pdfjs worker Vite setup | 验证 `?worker` suffix 或 `?url` suffix 在 `vite@7` 下正确 emit worker file | 本地 build + size check |

---

## Sources

### 高置信度（官方文档）
- [mammoth npm page](https://www.npmjs.com/package/mammoth) — v1.12.0 版本、ESM 支持、2026-03-12 发布确认
- [SheetJS CDN](https://cdn.sheetjs.com/) — v0.20.3 当前版本、cdn.sheetjs.com 安装路径
- [pdfjs-dist npm](https://www.npmjs.com/package/pdfjs-dist) — v5.7.284 当前版本、ESM-only in v5
- [pdfjs-dist worker setup discussion](https://github.com/mozilla/pdf.js/discussions/19090) — `GlobalWorkerOptions.workerSrc` 配置
- [PowerPoint ShapeCollection docs](https://learn.microsoft.com/en-us/javascript/api/powerpoint/powerpoint.shapecollection?view=powerpoint-js-preview) — `addPicture` 是 BETA/Preview
- [ImageCoercion requirement sets](https://learn.microsoft.com/en-us/javascript/api/requirement-sets/common/image-coercion-requirement-sets?view=word-js-preview) — PPT/Word on web 均支持 ImageCoercion 1.1
- [PowerPoint requirement sets](https://learn.microsoft.com/en-us/javascript/api/requirement-sets/powerpoint/powerpoint-api-requirement-sets?view=word-js-preview) — 各 API set Web 支持状态
- [DeepSeek API docs](https://api-docs.deepseek.com/) — V4 模型列表，无 vision 端点文档
- [DeepSeek pricing page](https://api-docs.deepseek.com/quick_start/pricing) — feature 表无 vision

### 中置信度（官方文档 + 社区验证）
- [Pexels API docs](https://www.pexels.com/api/documentation/) — rate limits、locale 参数、Attribution 要求
- [jszip npm](https://www.npmjs.com/package/jszip) — v3.10.1 当前版本
- [GitHub issue #3434 OfficeDev/office-js](https://github.com/OfficeDev/office-js/issues/3434) — Word range.insertInlinePictureFromBase64 Web NotAllowed 确认
- [AiHubMix Multimodal docs](https://docs.aihubmix.com/en/api/Multimodal-Interaction-with-Gemini) — image_url format 确认（gpt-4o 兼容）
- [Free Image API comparison 2026 — LaoZhang AI Blog](https://blog.laozhang.ai/en/posts/free-image-api) — Pexels vs Unsplash 推荐

### 低置信度（需 spike 确认）
- DeepSeek V4 native vision — 第三方文章（MindStudio, Scale Xpert）声称支持，但无官方文档证据
- aihubmix `gpt-5.1` model ID — registry 里是猜测值，需 API 验证
- Pexels CORS from Office Web iframe — 有 browser fetch 工作示例但未在 Office Task Pane 环境实测

---

*Stack research for: Aster v2.2 多模态四件套 (Office.js Add-in multimodal capabilities)*
*Researched: 2026-06-01*
