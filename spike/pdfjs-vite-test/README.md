# pdf.js 生产构建 Worker 测试（Spike #7 — 核心部分）

CDN 版本基础验证在 `../pdfjs-test.html` 完成。**本目录用于 Vite 生产构建 worker 加载测试**，
对应 Pitfall 7 的核心场景：`?url` 导入在 `vite build` 生产模式下断，必须用 `new URL(..., import.meta.url)` 替代。

> **为什么必须分开测**：CDN 版 worker 是绝对 URL，跟 bundler 完全无关；
> bug 只在 Vite 把 `pdf.worker.min.mjs` 当成静态资源 hash 重命名 + emit 到 `dist/assets/` 时才触发。

---

## 一、初始化最小 Vite 项目

```bash
cd spike/pdfjs-vite-test
npm create vite@latest . -- --template vanilla-ts
npm install
npm install pdfjs-dist@^5.7.0
```

> 锁定 `pdfjs-dist@^5.7.x`，跟 CLAUDE.md §File Parsers 一致。Worker 与主包版本必须精确匹配。

## 二、关键代码（main.ts）

```ts
import * as pdfjsLib from 'pdfjs-dist';

// 正确：用 new URL(..., import.meta.url) 让 Vite 把 worker 当资源处理
// dev 模式下保留路径；build 模式下 emit 到 dist/assets/pdf.worker.min-<hash>.mjs
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

// 错误（Pitfall 7）：不要用 ?url 导入
// import workerUrl from 'pdfjs-dist/build/pdf.worker.js?url';
// pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
// 这种写法在 dev 下 OK，build 后 worker 文件无法被找到（react-pdf #1843, #1148）。

const input = document.querySelector<HTMLInputElement>('#pdfFile')!;
input.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  console.log(`PDF loaded: ${pdf.numPages} pages`);

  const page = await pdf.getPage(1);
  const text = await page.getTextContent();
  console.log(text.items.map((i: any) => i.str).join(' ').slice(0, 200));
});
```

`index.html` 加一个 `<input type="file" id="pdfFile" accept=".pdf" />` 即可。

## 三、关键验证步骤

```bash
# 1. dev 模式确认能跑（基线）
npm run dev
# 用浏览器打开 http://localhost:5173，上传 5MB PDF，确认 console 有页数 + 文本输出

# 2. 生产构建
npm run build

# 3. 确认 worker 是独立文件（不是被 inline 到主 bundle）
ls dist/assets/ | grep worker
# 预期输出形如：pdf.worker.min-<hash>.mjs

# 4. 预览生产构建
npm run preview
# 用浏览器打开 http://localhost:4173，重跑上传 PDF 流程，
# DevTools Network 面板里应该看到一次对 pdf.worker.min-*.mjs 的请求（200 + 来自 dist/assets/）
```

## 四、PASS 判据

- `dist/assets/` 中存在独立的 `pdf.worker.min-<hash>.mjs` 文件
- `npm run preview` 下上传 5MB PDF：
  - 控制台无 "Setting up fake worker failed" 警告
  - 文本提取成功，首页非空字符 ≥ 50
- DevTools Network 面板中 worker 请求 HTTP 200，且来自同源（不是 CDN）

## 五、FAIL 时的 fallback（Pitfall 7 工作流）

如果 `new URL(..., import.meta.url)` 在某种 Vite 配置下仍出问题，按 PITFALLS.md Pitfall 7 §Prevention：

1. 锁定 pdf.js 版本（去掉 `^`），避免 worker 与主包版本漂移
2. 加 `optimizeDeps: { include: ['pdfjs-dist'] }` 到 vite.config.ts
3. 最坏情况：把 `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` 复制到 `public/`，
   `workerSrc = '/pdf.worker.min.mjs'`（绝对路径，规避 import 解析）

把 FAIL 现象 + workaround 记到 `.planning/spikes/007-pdfjs-production-build/findings.md`。

## 六、CSP 注意

GitHub Pages 默认无 CSP；后续如果 Phase 1 上 Cloudflare Pages 或加 CSP，需要 `worker-src 'self' blob:`，
否则 Vite 5+ 用 blob URL 加载 worker 会被拦截。Spike 阶段不需要处理。

---

## 七、为什么这一步不在 spike/pdfjs-test.html 里做

`spike/` 顶层是「纯静态 HTML，直接 push GitHub Pages」的丢弃式 spike。
Vite 生产构建测试需要 build 步骤、需要 dist 产物、需要本地预览服务器 —— 与 GitHub Pages 静态托管模型不兼容。
因此本测试由用户在本地执行 `npm run build` + `npm run preview`，把截图归档到
`.planning/spikes/007-pdfjs-production-build/`。
