# pdf.js 生产构建 worker（Spike #7）— PENDING

> 非 GATING：FAIL 时记录替代方案，不止损

## 场景

在 Vite 生产构建模式下（非 dev），pdf.js worker 正确加载并解析 5MB PDF。
在 GitHub Pages（非 localhost）测试。

## 测试步骤

1. 在 spike/ 创建 pdf-test.html，动态 import pdfjs-dist
2. 使用 `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` 设置 workerSrc
3. 运行 vite build，检查 worker 文件是否在 dist 中
4. 部署到 GitHub Pages，加载 5MB PDF，提取文本
5. 记录是否出现 "Setting up fake worker" 警告

## 实测结果

生产构建 worker 文件存在：（待填）
Worker 加载成功：（待填）
5MB PDF 解析成功：（待填）
Pitfall 7 的 `?url` 导入问题是否出现：（待填）

## 证据

- [ ] vite build 输出截图（worker 文件名）
- [ ] DevTools Network 截图（worker 加载请求）
- [ ] PDF 解析成功截图（提取文本片段）

> ⚠ 安全提示：测试 PDF 不含敏感数据；截图前确认网络请求中无 API Key

## 决策

**结果：** PENDING

**PASS：** Phase 3 使用 `new URL(..., import.meta.url)` 模式（非 `?url` import）
**FAIL 时 workaround：** 记录替代加载方式
