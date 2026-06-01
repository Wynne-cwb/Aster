<div align="center">
  <img src="docs/aster-logo.png" width="120" alt="Aster logo" />
  <h1>Aster</h1>
  <p>在原生 Office 里的 AI 代理 &nbsp;·&nbsp; 你说一句话，Aster 自主完成多步文档任务</p>
  <p>
    <img src="https://img.shields.io/badge/Office-PowerPoint%20%C2%B7%20Excel%20%C2%B7%20Word-009887?style=flat-square" alt="Office PowerPoint · Excel · Word" />
    &nbsp;
    <a href="https://wynne-cwb.github.io/Aster/"><img src="https://img.shields.io/badge/Live-sideload-009887?style=flat-square" alt="Live sideload" /></a>
  </p>
  <p><strong>BYO Key · 无后台 · 纯浏览器直连 · 开源</strong></p>
</div>

---

## Aster 怎么工作

你输入：「帮我做一份『Q3 销售复盘』PPT，给 leadership 看，重点华东」

Aster 的工作流程：

1. 调用 read tools 理解当前文档状态（列出已有 slides、获取内容）
2. 多步调用 write tools 逐步完成任务（插入 slides → 写标题 → 填内容）
3. 每步完成后在 Task Pane 汇报进度（步骤 N：在第 3 张幻灯片后插入...）
4. 跑完后 DiffLog 卡片列出所有改动，可逐步撤销或一键撤回全部
5. 随时暂停 / 中止，不满意就 Undo All

---

## 4 个核心场景

### PPT: Topic → Deck

> 「帮我做一份『Q3 销售复盘』PPT，给 leadership 看，重点华东」

Aster 在 8-15 步内完成：读取 PPT 现状 → batch insert 8-10 张 slides → 填标题和要点。

### Excel: Clean + Chart + Insight

> 「清洗这份数据，看哪个产品卖得最好，做个图，给我三句话洞察」

Aster 在 10-18 步内完成：扫 used range → set_range_values 清洗 → apply_formula → insert_chart → 三句话总结。

### Word: Polish + Restructure

> 「整篇润色，把口语化改成正式书面，顺便检查逻辑顺序」

Aster 在 6-12 步内完成：分批 read 段落 → replace_paragraph 逐段改写，长文不超 context window。

### PPT Shape 精细化

> 「把左下角那张图改成红色边框，然后右移 10 px」

Aster 在 3-6 步内完成：list_shapes_on_slide → 根据坐标推断「左下角」→ set_shape_property（border）+ move_shape（+10px）。

这是 v1 单步模型完全做不到的、Microsoft Copilot 也不暴露的操作级能力。

---

## BYO Key / 无后台

Aster 是纯静态 Web Add-in，所有 LLM / 图像调用从你的浏览器直连 Provider API。

- **API Key 存在浏览器的 localStorage**，不经过 Aster 服务器（Aster 没有服务器）
- 支持 DeepSeek（推荐）、AiHubMix、任意 OpenAI-compatible 自定义 Provider
- 内置 model：`deepseek-v4-pro`、`deepseek-v4-flash`、`gpt-5.1`、`gemini-3.5-flash`

---

## Sideload 安装（Chrome，Office for Web）

1. 访问 [office.com](https://office.com)，用 Microsoft 账号登录
2. 打开 PowerPoint / Excel / Word 任一文档
3. 点击「开始」标签 → 加载项 → 上传我的加载项
4. 上传 [`manifest.xml`](manifest.xml)（从本仓库下载，或直接填 GitHub raw URL）
5. 点击 Aster 按钮打开 Task Pane，在 Settings 输入 API Key，即可开始

**当前支持：** Chrome 最新版 × Office for Web（PowerPoint / Excel / Word 三宿主）

**路线图：** Windows 桌面版 Office（v1.1 验证中）

---

## 技术架构

| 层 | 选型 |
|----|------|
| 宿主 | Office.js Add-in（XML manifest）× PPT / Excel / Word |
| 构建 | Vite 7 + React 19 + TypeScript strict |
| 样式 | 自写 CSS 设计系统（teal 克制，CSS 变量驱动 light / dark）|
| 状态 | Zustand 5 |
| LLM 调用 | 原生 fetch + ReadableStream（无 SDK，0 后台）|
| Bundle（初始） | ~73.3 KB gzip（CI 门禁 ≤82 KB）|
| 存储 | partitioned localStorage（Key 不离浏览器）|

---

## 产品口径

Aster 是作者（[@wynne-cwb](https://github.com/wynne-cwb)）为自己日常 Office 工作打造的工具，现以开源形式分享。

早期阶段：面向自用 + 有技术背景的早期用户；尚无面向大众的多用户隐私授权 UX。BYO Key 使用意味着你对自己的 API Key 和数据流向负责。

欢迎 issue / PR，尤其是真机 bug 报告（Windows / Mac 宿主差异）。

---

## 隐私

选中内容会发往您配置的 AI Provider（DeepSeek / AiHubMix 等），不经过 Aster 服务器。Aster 无服务器，没有数据中转。

---

## 开发

```bash
npm ci
npm run dev       # 启动 Vite dev server（含 HTTPS 开发证书）
npm run build     # 生产构建
npm test          # tsc --noEmit + vitest run
npm run size      # bundle size 门禁（≤82 KB gzip）
```

Office for Web 本地调试需要 HTTPS：`npm run dev` 会自动用 `office-addin-dev-certs` 生成本地证书。
