# pdf.js 生产构建 worker（Spike #7）— PARTIAL PASS（CDN 解析 PASS；生产构建 worker 推迟到 Phase 1/3）

> 非 GATING：CDN 基础解析已 PASS；生产构建 worker 验证用真实 Vite build 做更合适

## 场景

两步验证：
- (a) CDN 版本基础能力：`spike/pdfjs-test.html` 在 GitHub Pages 上能否解析 1-5MB PDF
- (b) Vite 生产构建 worker：用户本地按 `spike/pdfjs-vite-test/README.md` 步骤跑 `npm run build` + `npm run preview`，验证 dist 中独立 worker 文件 + 预览页能跑

## 实现

- `spike/pdfjs-test.html`：动态 import pdf.js@4.9.155 CDN（ES module），CDN worker URL；
  GitHub Pages 上传 PDF 即可测基础解析能力。
- `spike/pdfjs-vite-test/README.md`：完整步骤说明：
  - 初始化 vanilla-ts Vite 项目
  - 用 `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href` 设置 workerSrc
  - 明示**禁止** `?url` 导入（Pitfall 7 反模式）
  - `npm run build` + `ls dist/assets/ | grep worker` + `npm run preview`
  - PASS 判据 + 三级 fallback（锁版本 / optimizeDeps / `public/` 兜底）

## 测试步骤（Task 3 待执行）

1. 部署 spike/ 到 GitHub Pages（用户已配 SourceLocation = https://wynne-cwb.github.io/Aster/）
2. 访问 `pdfjs-test.html`，上传 1-5MB PDF，截图结果区域
3. 在本地按 `spike/pdfjs-vite-test/README.md` 执行 Vite 项目初始化 + build + preview
4. 截图：`ls dist/assets/ | grep worker` 输出 + preview 页面解析结果
5. 截图保存至本目录

## 实测结果（2026-05-27）

**CDN 版本（步骤 1-2）：✅ PASS**
- 测试文件：交强险.pdf（0.38MB，真实中文 PDF）
- pdf.js@4.9.155 模块加载完成，workerSrc 设置成功
- PDF 加载成功（459ms），页数 3，第 1/2 页中文文本正确抽出（保单号、保险条款等）
- 结论：pdf.js 浏览器端文本抽取能力验证通过

**Vite 生产构建 worker（步骤 3-4）：⏳ 推迟到 Phase 1/3**
- `spike/pdfjs-vite-test/` 目前只有 README（步骤文档），无可跑的 Vite 项目
- 决策：不在 throwaway spike 里搭一套完整 Vite 项目；Pitfall #7（worker 在打包后独立文件 + 不 404）属构建配置问题，用 Phase 1/3 的**真实 Vite build** 验证更有意义
- README 已固化正确模式：`new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href`，禁用 `?url` 反模式

## 证据

- [x] CDN 测试代码：`spike/pdfjs-test.html`
- [x] Vite 生产构建步骤文档：`spike/pdfjs-vite-test/README.md`
- [ ] CDN 测试 PDF 解析成功截图（Task 3）
- [ ] `ls dist/assets/ | grep worker` 截图（Task 3）
- [ ] `npm run preview` 加载 5MB PDF 截图（Task 3）

> 安全提示：测试 PDF 不含敏感数据；截图前确认网络请求中无 API Key

## 决策

**结果：** ✅ PARTIAL PASS —— CDN 解析能力 PASS（pdf.js 可用，真实 PDF 抽文成功）；生产构建 worker 验证推迟到 Phase 1/3 真实 build

**对后续的影响：** pdf.js 选型成立（Phase 3 文件上传可用）。Phase 1/3 接入真实 Vite build 时必须用 `new URL(..., import.meta.url)` 模式（非 `?url` import）并确认 `dist/assets/` 下有独立 worker 文件——此为 Pitfall #7 的最终闭环点，在真实项目里跑回归。
**FAIL 时 workaround：**
- 锁定 pdf.js 版本（去 `^`）防止 worker / 主包漂移
- 加 `optimizeDeps: { include: ['pdfjs-dist'] }`
- 最坏：worker 复制到 `public/`，workerSrc 用绝对路径 `/pdf.worker.min.mjs`
