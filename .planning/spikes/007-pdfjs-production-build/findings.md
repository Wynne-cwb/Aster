# pdf.js 生产构建 worker（Spike #7）— IN_PROGRESS

> 非 GATING：FAIL 时记录替代方案，不止损

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

## 实测结果

CDN 版本（步骤 1-2）：（待 Task 3 填）
Vite 生产构建 worker 文件名（步骤 3-4）：（待 Task 3 填）
Pitfall 7 的 `?url` 反模式问题是否在用户实操中再现：（待 Task 3 填）
首页文本提取非空字符数：（待 Task 3 填）

## 证据

- [x] CDN 测试代码：`spike/pdfjs-test.html`
- [x] Vite 生产构建步骤文档：`spike/pdfjs-vite-test/README.md`
- [ ] CDN 测试 PDF 解析成功截图（Task 3）
- [ ] `ls dist/assets/ | grep worker` 截图（Task 3）
- [ ] `npm run preview` 加载 5MB PDF 截图（Task 3）

> 安全提示：测试 PDF 不含敏感数据；截图前确认网络请求中无 API Key

## 决策

**结果：** IN_PROGRESS（CDN 验证代码 + Vite 生产构建步骤文档就绪，待 Task 3 用户实操验证）

**PASS：** Phase 3 使用 `new URL(..., import.meta.url)` 模式（非 `?url` import）；worker 独立文件确认
**FAIL 时 workaround：**
- 锁定 pdf.js 版本（去 `^`）防止 worker / 主包漂移
- 加 `optimizeDeps: { include: ['pdfjs-dist'] }`
- 最坏：worker 复制到 `public/`，workerSrc 用绝对路径 `/pdf.worker.min.mjs`
