<div align="center">
  <img src="docs/aster-logo.png" width="120" alt="Aster logo" />
  <h1>Aster</h1>
  <p><strong>在原生 Office 里的 AI 代理</strong><br/>你说一句话，Aster 自主完成多步文档任务，每步可见、随时撤销。</p>
  <p>
    <img src="https://img.shields.io/badge/Office-PowerPoint%20%C2%B7%20Excel%20%C2%B7%20Word-009887?style=flat-square" alt="PowerPoint · Excel · Word" />
    &nbsp;
    <a href="https://wynne-cwb.github.io/Aster/"><img src="https://img.shields.io/badge/Live-sideload-009887?style=flat-square" alt="Live sideload" /></a>
    &nbsp;
    <img src="https://img.shields.io/badge/BYO%20Key-无后台-444?style=flat-square" alt="BYO Key · 无后台" />
  </p>
</div>

---

Aster 是一个面向中文职场用户的 Office 加载项（Add-in），跑在 **PowerPoint / Excel / Word** 三个宿主里。它把 LLM（DeepSeek-V4）和图像模型直接嵌进原生 Office —— 你用一句自然语言下达任务，Aster 作为 **AI 代理**自主调用工具、分多步完成，并在侧边栏实时汇报进度。

定位在 **Microsoft Copilot** 与**浏览器版 ChatGPT** 之间：开源、自带 Key（BYO Key）、零后台 —— 在原生 Office 内部享受 AI 提效，无需切网页、无需订阅 Copilot、无需把数据交给中间服务器。

> [!NOTE]
> Aster 由作者（[@wynne-cwb](https://github.com/wynne-cwb)）为自己的日常 Office 工作打造，现以开源形式分享。当前处于早期阶段，面向自用与有技术背景的早期用户；BYO Key 意味着你对自己的 API Key 与数据流向负责。

## 特性

- **AI 代理，而非一问一答** —— agent loop 自主多步：读现状 → 规划 → 逐步写入，单任务可达十几步
- **三宿主统一体验** —— PPT / Excel / Word 共用一套代理内核，通过 `DocumentAdapter` 抽象宿主差异
- **每步可见 + 一键撤销** —— DiffLog 卡片列出每次改动，支持逐条或全部撤销（自研 `operationLog` 反向引擎，不依赖宿主 Ctrl+Z）
- **BYO Key · 纯浏览器直连 · 零后台** —— 所有 LLM / 图像调用从你的浏览器直连 Provider，API Key 永不离开本机
- **多 Provider** —— DeepSeek（推荐）、AiHubMix，或任意 OpenAI 兼容端点
- **不止文本** —— 视觉看图、AI 生图插入、在线图库检索、本地文件解析（docx / xlsx / pdf / pptx）
- **Shape 级精细操作** —— 「把左下角那张图加红框再右移 10px」这类细活，连 Copilot 都不暴露给你

## 工作原理

输入：「帮我做一份『Q3 销售复盘』PPT，给 leadership 看，重点华东」

```
你的指令
   │
   ▼
① read tools 理解现状      列出已有 slides、读取内容、感知选区
   │
   ▼
② 多步 write tools         插入 slides → 写标题 → 填要点（边做边在侧栏汇报）
   │
   ▼
③ DiffLog 汇总改动          每步一张卡片，可逐条撤销或「全部撤销」
   │
   ▼
随时暂停 / 中止             不满意？Undo All 一键还原
```

## 核心场景

| 场景 | 你说的话 | Aster 做的事 |
|------|---------|-------------|
| **PPT：Topic → Deck** | 「帮我做一份 Q3 销售复盘 PPT，重点华东」 | 8–15 步：读 PPT 现状 → 批量插 8–10 张 slides → 填标题与要点 |
| **Excel：清洗 + 图表 + 洞察** | 「清洗数据，看哪个产品最好卖，做个图，给我三句洞察」 | 10–18 步：扫 used range → 清洗 → `apply_formula` → 插图表 → 总结 |
| **Word：润色 + 重构** | 「整篇润色，口语改正式，顺便检查逻辑顺序」 | 6–12 步：分批读段落 → 逐段 `replace_paragraph`，长文不爆 context |
| **PPT Shape 精细化** | 「把左下角那张图改成红色边框，右移 10px」 | 3–6 步：列形状 → 按坐标推断「左下角」→ 改边框 + 移动 |

## 快速开始

### 前置条件

- 一个 LLM Provider 的 API Key —— 推荐 [DeepSeek](https://platform.deepseek.com)（`sk-` 开头）
- 现代浏览器（Chrome / Edge 最新两版）+ Office for Web 账号，**或** Windows 桌面版 WPS（实验性）

### Office for Web（Chrome / Edge）

1. 访问 [office.com](https://office.com)，用 Microsoft 账号登录
2. 打开 PowerPoint / Excel / Word 任一文档
3. 「开始」标签 → 加载项 → 上传我的加载项
4. 上传仓库里的 [`manifest.xml`](manifest.xml)（或直接填其 GitHub raw URL）
5. 点 Aster 按钮打开侧边栏 → 在设置里填 API Key → 开始对话

> [!NOTE]
> 当前验证范围：Chrome / Edge 最新两版 × Office for Web 三宿主。Windows 桌面版 Office 在路线图上。

### WPS（Windows 桌面版）

> [!WARNING]
> **实验性：代码已写完，但 WPS 真机尚未验证。** WPS 走独立的 `wpsjs` 加载项形态（非 Office.js manifest），三宿主已实现全工具读写撤销，但属盲写草稿。完整安装与逐项测试脚本见 **[`public/wps/README.md`](public/wps/README.md)**（线上版：[wps/README.md](https://wynne-cwb.github.io/Aster/wps/README.md)）。

二选一安装，重启 WPS 后在功能区点「Aster」→「打开 Aster」：

- **路径 A（专业版，`oem.ini`）** —— 加两行后重启：
  ```ini
  JsApiPlugin=true
  JSPluginsServer=https://wynne-cwb.github.io/Aster/wps/jsplugins.xml
  ```
- **路径 B（个人版 12.1.0.16910+，一键装）** —— 浏览器打开 [`wps/publish.html`](https://wynne-cwb.github.io/Aster/wps/publish.html) → 点「安装」（需 `oem.ini` 内 `JsApiPlugin=false`，与路径 A 互斥）

> [!TIP]
> 首次上真机，建议先跑探针（约 30 秒，在空白文件上确认 WPS 容器是否支持直连 LLM，不碰你的真实文档）：见 [`public/wps/README.md` 第 0 步](public/wps/README.md)。

## BYO Key · 无后台

Aster 是纯静态 Web 加载项，**没有服务器**。所有 LLM 与图像请求都从你的浏览器**直连** Provider API。

- API Key 存在浏览器的 partitioned **localStorage**，不经过任何 Aster 服务器
- 切换浏览器或清空浏览器数据后需重新填 Key（与任何纯前端应用一致）
- 支持 DeepSeek、AiHubMix，以及任意 OpenAI 兼容的自定义端点

## 技术栈

| 层 | 选型 |
|----|------|
| 宿主 | Office.js Add-in（XML manifest）× PowerPoint / Excel / Word；WPS 走平行的 `wpsjs` 形态 |
| 构建 | Vite 7 + React 19 + TypeScript（strict） |
| 状态 | Zustand 5 |
| 样式 | 自写 CSS 设计系统（teal 克制风格，CSS 变量驱动 light / dark） |
| LLM 调用 | 原生 `fetch` + `ReadableStream`（OpenAI 兼容 SSE，无 SDK，零后台） |
| 文件解析 | mammoth（docx）/ SheetJS（xlsx）/ pdf.js（pdf）/ JSZip（pptx）—— 全部按需懒加载 |
| 存储 | partitioned localStorage（Key 不离浏览器） |
| Bundle | 入口 chunk ≤ 100 KB gzip（CI 门禁）；重解析库与 Provider 代码懒加载，不进首屏 |

## 本地开发

```bash
npm ci
npm run dev        # Vite dev server（自动生成本地 HTTPS 证书，Office for Web 调试需要）
npm run build      # 生产构建（lingui compile + vite build）
npm test           # tsc --noEmit + vitest run
npm run size       # bundle size 门禁（入口 ≤100 KB gzip）
```

> [!NOTE]
> 测试 / 构建需 Node 22（jsdom 依赖 Node ≥ 20.19）。Office for Web 本地调试需 HTTPS —— `npm run dev` 会用 `office-addin-dev-certs` 自动签发本地证书。

## 隐私

你在对话中提供或选中的内容，会发往你配置的 AI Provider（DeepSeek / AiHubMix 等）。**Aster 没有服务器，不做任何数据中转**，也无从读取你的 Key 或文档。

欢迎 issue / PR，尤其是真机 bug 报告（Windows / Mac / WPS 宿主差异）。
