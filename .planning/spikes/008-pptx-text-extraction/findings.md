# pptx 文本提取（Spike #8）— IN_PROGRESS

> 非 GATING：FAIL 时可将 pptx 列入"不支持上传"，不止损

## 场景

用 jszip + DOMParser ≤ 80 行代码从真实 pptx 文件提取 `<a:t>` 文本节点。
目标：提取全部 slide 的文本内容，无需第三方 pptx 库（不解析样式 / 颜色 / 表格结构 / 图片）。

## 实现

- 文件：`spike/pptx-extract.html`
- 核心函数：`extractPptxText(file)`
- 行数统计：
  - 完整函数 44 行（含注释 + 空行）
  - 纯代码 33 行（去注释 + 去空行）
  - **远低于目标 ≤ 80 行**
- 依赖：JSZip 3.10.1（CDN，spike 阶段；Phase 3 改 npm 懒加载）+ 浏览器原生 DOMParser
- 第三方 pptx 库：无（pptx-parser / pptxtojson / nodejs-pptx / @jvmr/pptx-to-html 全部未引入）

## 已知风险（Task 3 人工验证项）

- `doc.querySelectorAll('t')` 不限命名空间 —— 理论上会匹配非 DrawingML 命名空间的 `<t>` 元素
  - 实际影响：需要 3 个真实 pptx 测试时**对比提取文本与原大纲**，记录是否出现误匹配 / 重复
  - 备选方案：改用 `doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 't')`，更严格但牺牲若干兼容性

## 测试步骤（Task 3 待执行）

1. 部署 spike/ 到 GitHub Pages（或在 Task Pane 中打开 pptx-extract.html）
2. 准备 3 个不同的 .pptx 测试文件：
   - 简单文本（仅 title + bullet 的几张 slide）
   - 含表格（验证表格内文本是否被提取）
   - 含图注（验证图片附近的文字框是否被提取）
3. 逐个上传，截图记录：
   - slide 数 / `<t>` 节点数 / 字符数 / 耗时
   - 提取文本与原 pptx 大纲对比，是否存在误匹配 / 漏抓
4. 截图保存至本目录

## 实测结果

提取代码行数：33 行纯代码（远 ≤ 80 行目标）
pptx 文件 1（简单）：（待 Task 3 填）
pptx 文件 2（含表格）：（待 Task 3 填）
pptx 文件 3（含图注）：（待 Task 3 填）
`querySelectorAll('t')` 命名空间误匹配实测：（待 Task 3 填）

## 证据

- [x] 提取代码：`spike/pptx-extract.html`（核心逻辑 33 行）
- [ ] 三个 pptx 的提取结果对比截图（Task 3）
- [ ] 命名空间误匹配现象记录（Task 3）

> 安全提示：测试 pptx 不含敏感数据；截图前确认 Console 无 API Key

## 决策

**结果：** IN_PROGRESS（代码就绪，待 Task 3 三文件人工验证）

**PASS：** Phase 3 使用 jszip + DOMParser 方案（≤ 80 行核心逻辑），无需第三方 pptx 库
**FAIL：** pptx 上传列入不支持（PRD R3 原始降级路径）；或改用 `getElementsByTagNameNS` 严格命名空间过滤后重测
