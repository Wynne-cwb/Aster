---
plan_number: "09"
title: "非 GATING #7+#8 — pdf.js 生产构建 worker + pptx jszip 文本提取"
phase: 0
wave: 4
depends_on: ["06"]
files_modified:
  - spike/pdfjs-test.html
  - spike/pptx-extract.html
  - .planning/spikes/007-pdfjs-production-build/findings.md
  - .planning/spikes/008-pptx-text-extraction/findings.md
autonomous: false
requirements: []
estimated_duration: "4 hours"
must_haves:
  goal: "pdf.js 生产构建 worker 模式验证通过；pptx jszip+DOMParser ≤80 行提取文本原型完成"
  truths:
    - ".planning/spikes/007-pdfjs-production-build/findings.md 第一行含 PASS 或 FAIL（非 PENDING）"
    - ".planning/spikes/008-pptx-text-extraction/findings.md 第一行含 PASS 或 FAIL（非 PENDING）"
    - "007 findings.md 含 vite build 生产构建后 worker 文件路径 + PDF 解析是否成功"
    - "008 findings.md 含提取代码行数（目标 ≤80）+ 三个 pptx 文件的提取质量"
    - ".planning/spikes/MANIFEST.md Spike #7 和 #8 条目状态已更新（非 PENDING）"
threat_model:
  threats:
    - id: T-00-09-01
      description: "pdfjs worker CSP 违规（worker-src 缺失）"
      mitigation: "spike 阶段记录 CSP worker-src 要求；Phase 1 生产托管配置时添加 worker-src 'self' blob:"
---

<objective>
非 GATING Spike #7 + #8（合并 plan）：

Spike #7：验证 Vite 生产构建模式下 pdf.js worker 正确加载（Pitfall 7 闭环）。
在 GitHub Pages（非 localhost）测试 5MB PDF 解析。

Spike #8：用 jszip + DOMParser ~80 行代码从真实 pptx 文件提取 `<a:t>` 文本节点，
证明不需要第三方 pptx 库（Pitfall 8 建议的简单方案）。

Purpose: 两个 spike 都是 Phase 3 文件解析层的前置验证。Pitfall 7 明确指出 pdf.js
`?url` 导入在 Vite 生产模式下会断；Pitfall 8 说明自实现 pptx 解析 ~80 行即可完成。

Output:
- `spike/pdfjs-test.html`（pdf.js 生产构建测试）
- `spike/pptx-extract.html`（pptx 文本提取原型 ≤80 行逻辑）
- 两个 findings.md 更新
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/00-spike-gating/00-CONTEXT.md
@.planning/research/PITFALLS.md

决策出处：
- PITFALLS.md Pitfall 7（pdf.js worker 设置：`?url` import 在 Vite 生产模式下断；使用 `new URL(..., import.meta.url)` 替代）
- PITFALLS.md Pitfall 8（pptx 提取：jszip + DOMParser，~80 行，不需要第三方库）
- CLAUDE.md §File Parsers — pdfjs-dist ^5.7.x，worker 必须独立文件；jszip ~33KB gzipped
- ROADMAP.md §Phase 0 Success Criteria #5（其余 7 项，含 pdf.js 和 pptx）

技术要点（Spike #7）：
- 正确模式：`new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` 赋给 workerSrc
- 错误模式（不要用）：`import workerUrl from 'pdfjs-dist/build/pdf.worker.js?url'`
- Worker 与主包版本必须精确匹配（exact version pin）
- Office Add-in Task Pane 是 iframe，worker 从 same origin 加载（self-hosted）

技术要点（Spike #8）：
- pptx 是 ZIP 文件（.pptx = .zip 重命名）
- jszip 读取 ZIP → 遍历 `ppt/slides/slide*.xml` → DOMParser.parseFromString → 提取所有 `<a:t>` 文本节点
- 目标：≤80 行代码（不含 HTML 骨架）
- 不解析样式/颜色/表格结构/图片，只要文本
</context>

<tasks>

<task type="auto">
  <name>Task 1：创建 pdf.js 生产构建测试页（spike #7）</name>
  <files>spike/pdfjs-test.html</files>
  <read_first>
    - .planning/research/PITFALLS.md Pitfall 7（完整的 pdf.js worker 设置错误描述 + 正确方案）
    - CLAUDE.md §File Parsers — pdfjs-dist 安装和 worker 配置说明
  </read_first>
  <action>
创建 `spike/pdfjs-test.html`。

**重要说明**：pdf.js 是 npm 包，需要 Vite 构建才能使用 `new URL(..., import.meta.url)` 语法。
对于 Phase 0 spike（纯静态 HTML），可以使用 pdf.js CDN 版本做基础 CORS 验证，
但生产构建 worker 测试需要一个最小 Vite 项目。

因此创建两个组件：

**组件 A（spike/pdfjs-test.html）— CDN 版本快速验证**：
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>pdf.js 测试 — Spike #7</title>
  <!-- Office.js -->
  <script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>
  <!-- pdf.js CDN（用于基础可用性测试；生产构建测试需要 Vite 项目） -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs" type="module"></script>
</head>
<body>
  <h2>pdf.js 测试 — Spike #7</h2>
  <p>⚠ 此页面是 CDN 版本的基础测试。生产构建 worker 测试需要 spike/pdfjs-vite-test/ 子项目。</p>
  <input type="file" id="pdfFile" accept=".pdf" />
  <button onclick="testPDF()">测试 PDF 解析</button>
  <div id="result" style="margin-top:16px; white-space:pre-wrap; font-family:monospace;"></div>

  <script type="module">
    import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs';

    window.testPDF = async function() {
      const file = document.getElementById('pdfFile').files[0];
      if (!file) { alert('请选择 PDF 文件'); return; }

      const result = document.getElementById('result');
      result.textContent = '正在加载 PDF...\n';

      try {
        // CDN 版本直接使用 fake worker（无独立 worker 文件问题）
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs';

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        result.textContent += `PDF 加载成功！页数: ${pdf.numPages}\n`;

        // 提取前两页文本
        const page1 = await pdf.getPage(1);
        const textContent = await page1.getTextContent();
        const text = textContent.items.map(item => item.str).join(' ');
        result.textContent += `第1页文本（前200字符）: ${text.slice(0, 200)}\n`;
        result.textContent += '\n✅ CDN 版本 pdf.js 可用（基础验证通过）\n';
        result.textContent += '生产构建 worker 测试：参见下方 Vite 项目说明\n';

      } catch (err) {
        result.textContent += '❌ PDF 解析失败: ' + err.message + '\n';
      }
    };
  </script>
</body>
</html>
```

**组件 B（spike/pdfjs-vite-test/README.md）— 生产构建测试说明**：

同时创建 `spike/pdfjs-vite-test/README.md`，说明生产构建 worker 测试步骤：
```markdown
# pdf.js 生产构建 Worker 测试（Spike #7 — 核心部分）

CDN 版本测试在 `../pdfjs-test.html` 完成。本目录用于 Vite 生产构建测试。

## 测试步骤

```bash
# 初始化 Vite 项目（极小配置）
npm create vite@latest . -- --template vanilla-ts
npm install pdfjs-dist@5.7.x
```

## 关键配置（Pitfall 7 避坑）

在 main.ts 中使用正确的 worker 加载方式：

```typescript
import * as pdfjsLib from 'pdfjs-dist';

// ✅ 正确：使用 new URL(..., import.meta.url)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

// ❌ 错误（Pitfall 7）：不要用 ?url 导入
// import workerUrl from 'pdfjs-dist/build/pdf.worker.js?url';  // 生产构建会断
```

## 验证命令

```bash
npm run build
# 检查 dist/ 目录是否有独立的 worker 文件
ls dist/assets/ | grep worker
# 预览生产构建
npm run preview
```

在预览页面上传 5MB PDF，验证能正确解析。
```

在 findings.md 007 中记录：
- CDN 版本基础验证结果
- Vite 生产构建 worker 测试的步骤说明（实测需用户执行 npm 项目）
  </action>
  <acceptance_criteria>
    - spike/pdfjs-test.html 存在：`ls spike/pdfjs-test.html` 返回 0
    - 含 Office.js CDN：`grep -c 'appsforoffice.microsoft.com' spike/pdfjs-test.html` 返回 ≥ 1
    - 含 pdf.js 加载逻辑：`grep -c 'pdfjsLib\|getDocument\|pdfjs' spike/pdfjs-test.html` 返回 ≥ 2
    - 不含 ?url 导入（Pitfall 7 错误模式）：`grep -c 'pdf.worker.js?url\|?url' spike/pdfjs-test.html` 返回 0
    - spike/pdfjs-vite-test/README.md 存在：`ls spike/pdfjs-vite-test/README.md` 返回 0
    - README.md 含正确 worker 模式：`grep -c 'new URL.*import.meta.url' spike/pdfjs-vite-test/README.md` 返回 ≥ 1
  </acceptance_criteria>
  <verify>
    <automated>ls spike/pdfjs-test.html && ls spike/pdfjs-vite-test/README.md</automated>
  </verify>
  <done>spike/pdfjs-test.html（CDN 版本快速验证）+ spike/pdfjs-vite-test/README.md（生产构建测试步骤）已创建；不含 Pitfall 7 错误模式</done>
</task>

<task type="auto">
  <name>Task 2：创建 pptx 文本提取原型（spike #8）</name>
  <files>spike/pptx-extract.html, .planning/spikes/008-pptx-text-extraction/findings.md</files>
  <read_first>
    - .planning/research/PITFALLS.md Pitfall 8（pptx 提取：jszip + DOMParser，~80 行，OOXML 结构）
    - CLAUDE.md §File Parsers — jszip ~33KB，ESM 可用
  </read_first>
  <action>
创建 `spike/pptx-extract.html`，实现 pptx 文本提取。

目标：核心提取逻辑 ≤80 行（不含 HTML 骨架），纯浏览器，无第三方 pptx 库。

**pptx 文本提取核心逻辑（≤80 行）**：
```javascript
// 依赖：jszip（CDN 加载）
// pptx 是 ZIP 文件，包含 ppt/slides/slide*.xml

async function extractPptxText(file) {
  // Step 1：用 JSZip 读取 zip
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Step 2：找到所有 slide XML 文件（按文件名排序）
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0');
      const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0');
      return numA - numB;
    });

  const results = [];

  // Step 3：逐 slide 提取文本
  for (const slideName of slideFiles) {
    const xmlContent = await zip.files[slideName].async('string');

    // Step 4：DOMParser 解析 XML
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'application/xml');

    // Step 5：提取所有 <a:t> 文本节点（Drawing ML 命名空间）
    // 风险注意：querySelectorAll('t') 匹配所有命名空间的 <t> 元素，可能包含非 DrawingML 文本（如 XML 关系文件中的 <t>）。
    // Task 3 人工验证步骤会将提取文本与原始 pptx 大纲对比，记录误匹配/重复情况。
    const textNodes = doc.querySelectorAll('t');  // 'a:t' 选择器在 DOMParser 中用 't'
    const slideText = Array.from(textNodes)
      .map(node => node.textContent?.trim())
      .filter(text => text && text.length > 0)
      .join(' ');

    if (slideText) {
      results.push({
        slide: slideName.match(/slide(\d+)/)?.[1] || '?',
        text: slideText
      });
    }
  }

  return results;
}
```

**完整 HTML**：
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>pptx 文本提取 — Spike #8</title>
  <script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>
  <!-- jszip CDN（v3.x） -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
</head>
<body>
  <h2>pptx 文本提取 — Spike #8</h2>
  <p>上传 .pptx 文件，提取所有 slide 的文本内容（不解析样式/颜色/图片）</p>
  <input type="file" id="pptxFile" accept=".pptx" />
  <button onclick="runExtract()">提取文本</button>
  <div id="result" style="margin-top:16px; background:#f5f5f5; padding:12px; white-space:pre-wrap; font-family:monospace; font-size:12px; max-height:400px; overflow-y:auto;"></div>

  <script>
    Office.onReady(function() {});  // Office.js 初始化（Task Pane 需要）

    // [核心提取逻辑粘贴于此 —— extractPptxText 函数]

    async function runExtract() {
      const file = document.getElementById('pptxFile').files[0];
      if (!file) { alert('请选择 .pptx 文件'); return; }

      const result = document.getElementById('result');
      result.textContent = '正在解析...\n';

      try {
        const slides = await extractPptxText(file);
        result.textContent = `共提取 ${slides.length} 张 slide 的文本：\n\n`;
        slides.forEach(s => {
          result.textContent += `=== Slide ${s.slide} ===\n${s.text}\n\n`;
        });
        result.textContent += '✅ 提取完成';
      } catch (err) {
        result.textContent += '❌ 提取失败: ' + err.message + '\n';
        if (err.message.includes('JSZip')) {
          result.textContent += '提示：JSZip 未加载，请检查 CDN 连接';
        }
      }
    }
  </script>
</body>
</html>
```

executor 需将 extractPptxText 函数（~35 行核心逻辑）嵌入 HTML，合计核心逻辑 ≤80 行。

**同时更新 `.planning/spikes/008-pptx-text-extraction/findings.md`**，填入：
- 提取代码行数（目标 ≤80）
- 注明需要用户提供 3 个真实 pptx 文件进行测试
- 人工运行结果占位区域

更新 `.planning/spikes/MANIFEST.md` Spike #8 状态。
  </action>
  <acceptance_criteria>
    - spike/pptx-extract.html 存在：`ls spike/pptx-extract.html` 返回 0
    - 含 jszip：`grep -c 'JSZip\|jszip' spike/pptx-extract.html` 返回 ≥ 2
    - 含 slide XML 路径模式：`grep -c 'ppt/slides/slide' spike/pptx-extract.html` 返回 ≥ 1
    - 含 a:t 文本提取逻辑：`grep -c 'querySelectorAll.*t\|<a:t>\|textNodes' spike/pptx-extract.html` 返回 ≥ 1
    - 不引入第三方 pptx 库：`grep -c 'pptx-parser\|pptxtojson\|nodejs-pptx\|@jvmr/pptx-to-html' spike/pptx-extract.html` 返回 0
    - 含 Office.js CDN：`grep -c 'appsforoffice.microsoft.com' spike/pptx-extract.html` 返回 ≥ 1
  </acceptance_criteria>
  <verify>
    <automated>grep -c 'ppt/slides/slide' spike/pptx-extract.html && grep -c 'pptx-parser\|pptxtojson' spike/pptx-extract.html | grep '^0$'</automated>
  </verify>
  <done>spike/pptx-extract.html 创建：jszip + DOMParser 提取 a:t 文本节点，核心逻辑 ≤80 行，不用第三方 pptx 库</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3：手动运行两个解析器测试并记录结论</name>
  <what-built>
    - spike/pdfjs-test.html（CDN 版本 pdf.js 基础验证）已部署到 GitHub Pages
    - spike/pdfjs-vite-test/README.md（生产构建 worker 测试步骤说明）
    - spike/pptx-extract.html（pptx 文本提取原型）已部署到 GitHub Pages
  </what-built>
  <how-to-verify>
**Spike #7 — pdf.js 测试：**
1. 访问 GitHub Pages 上的 pdfjs-test.html
2. 上传一个 PDF 文件（建议 1-5MB），点击测试
3. 截图结果区域，保存至 `.planning/spikes/007-pdfjs-production-build/`
4. 按 spike/pdfjs-vite-test/README.md 步骤运行 Vite 生产构建测试（必须执行）
5. 更新 007 findings.md，分两段记录：
   - (a) CDN 版本测试结果（步骤 1-3 结论）
   - (b) Vite 生产构建后 worker 文件路径（`ls dist/assets/ | grep worker` 输出）+ PDF 解析是否成功
6. 将 007 findings.md 首行改为 PASS 或 FAIL

**Spike #8 — pptx 提取测试：**
7. 访问 GitHub Pages 上的 pptx-extract.html（或在 Task Pane 中打开）
8. 上传 3 个不同的 .pptx 文件（简单/含表格/含图注）
9. 查看提取结果，**将提取文本与原始 pptx 大纲对比，记录是否有误匹配/重复**（querySelectorAll('t') 匹配所有命名空间的 <t> 元素，可能包含非 DrawingML 文本，此步验证实际影响）
10. 截图保存至 `.planning/spikes/008-pptx-text-extraction/`
11. 统计提取代码行数（核心逻辑是否 ≤80 行）
12. 更新 008 findings.md 首行为 PASS 或 FAIL，并记录误匹配情况

**更新 MANIFEST.md Spike #7 和 #8 状态。**
  </how-to-verify>
  <resume-signal>
验证完成后输入：
- "#7 [PASS/FAIL: 描述], #8 [PASS/FAIL: 行数X行, 文件N个测试通过]"
例：#7 PASS: CDN版本可用，生产构建待测; #8 PASS: 42行，3个pptx均提取成功
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User upload → jszip / pdfjs | 文件在浏览器内处理，不上传服务器 |
| jszip CDN → spike page | CDN 脚本加载（Phase 1 起改为 npm 懒加载）|

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-00-09-01 | Denial of Service | pdf.js 大文件解析 | accept | spike 测试用 5MB 限制；生产中会有文件大小检测 |
| T-00-09-02 | Information Disclosure | pptx 内容解析 | accept | spike 只提取文字到页面展示；不上传；v1 用户上传的是自己的文件 |
| T-00-09-03 | Tampering | jszip CDN 供应链 | accept | spike 阶段可接受 CDN；Phase 3 改为 npm 包（固定版本）懒加载 |
</threat_model>

<verification>
整体验证（Spike #7 + #8 完成后）：
1. `head -1 .planning/spikes/007-pdfjs-production-build/findings.md` 含 PASS 或 FAIL
2. `head -1 .planning/spikes/008-pptx-text-extraction/findings.md` 含 PASS 或 FAIL
3. MANIFEST.md Spike #7 和 #8 状态非 PENDING
</verification>

<success_criteria>
- pdf.js CDN 版本基础验证通过；生产构建 worker 步骤文档已创建
- pptx 提取原型 ≤80 行核心逻辑，3 个真实 pptx 测试结论有记录
- findings.md 007 和 008 首行均为 PASS 或 FAIL
- MANIFEST.md 状态已更新
</success_criteria>

<output>
完成后创建 `.planning/phases/00-spike-gating/00-09-SUMMARY.md`，包含：
- Spike #7 结论：CDN 版本结果 + 生产构建 worker 步骤文档路径
- Spike #8 结论：提取行数 + 三文件测试结果
- Phase 3 文件解析层的两个实现建议（基于 spike 结果）
</output>
