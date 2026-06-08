# Stack Research — v2.5 WPS Port (Toolchain & Build)

**Domain:** WPS Windows Desktop 专业版加载项移植
**Researched:** 2026-06-08
**Confidence:** MEDIUM（工具链核心事实 HIGH；Mac 开发体验细节 MEDIUM；wps-jsapi 包完整性 MEDIUM）

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `wpsjs` CLI | `2.2.3`（latest as of 2026-06) | WPS 加载项脚手架、开发服务器、打包发布 | 官方唯一 CLI：`wpsjs create` 生成外壳文件（`ribbon.xml` + `jsplugins.xml` + `publish.html`）；`wpsjs debug` 启动本地 HTTP 服务让 WPS 加载在线版；`wpsjs build` 打包离线；`wpsjs publish` 打包发布页。**在 Mac 上 `npm i -g wpsjs` 本身可执行；`wpsjs debug` 启动 HTTP 服务在 Mac 上也可运行（充当静态服务器），但 WPS 客户端本体只在 Windows 上——验证探针时需要在 Windows 机器上执行 `wpsjs debug` 或手动用 `jsplugins.xml` 指向一个公网 URL。** |
| `wps-jsapi` | `1.0.5`（npm, ISC） | WPS JSAPI 的 TypeScript 类型定义（IntelliSense 用） | 唯一已知的 TypeScript 类型包（社区维护，wpsjs 官方生态关联作者）。说明包内是"WPS 加载项 JSAPI 对象模型的 TypeScript 描述"，方便 VSCode 代码补全。**注意：版本可能滞后于最新 WPS JSAPI，需结合官方 API 文档手动补类型；不足之处见下方。** |
| Vite 7 | 已有（Aster 既存） | WPS 加载项的 taskpane SPA 构建 | CEF = Chromium，接受标准静态 HTML + JS，Aster 现有 Vite 7 构建产物（`dist/index.html` + 分块 JS）可直接作为 WPS taskpane 页面——无需换构建工具。WPS 加载项的 taskpane 就是一个普通网页，打包成静态文件即可。 |
| React 19 + TypeScript strict | 已有（Aster 既存） | UI 渲染层 | CEF 内核运行在 Chromium 上（`navigator.userAgent` 待真机核查具体版本），React 19 所依赖的 ES2020+ 特性在 2019+ WPS 的 CEF 内大概率支持。复用层无需改动。 |
| Zustand 5 | 已有（Aster 既存） | UI 状态管理 | 同上，与宿主无关，全在 webview 层。 |
| native `fetch` + `ReadableStream` | 已有（Aster 既存） | SSE 流式 LLM 调用 | CEF = Chromium，原生 fetch 和 ReadableStream 大概率支持（**高危真机项**，见 §WPS-02 checklist 1-2）。 |
| `localStorage`（裸 rawKey，无 partitionKey） | 已有降级分支 | API Key 等持久化存储 | `src/lib/storage.ts` 已有 `partitionKey === undefined` 降级路径（直接用 rawKey）——WPS 环境 `Office.context.partitionKey` 不存在，降级分支**开箱即用**，无需新增代码。`wps.PluginStorage` 非持久（关加载项即丢），不用。 |

### WPS 加载项外壳专属文件（新增，非 Aster 既有）

| 文件 | 作用 | 产生方式 |
|------|------|---------|
| `ribbon.xml` | 定义 WPS 功能区按钮/UI（CustomUI 标准，与 MS Office 同一规范） | `wpsjs create` 生成模板；按 Aster 需求手写 |
| `jsplugins.xml` | 加载项列表文件；在线模式下 `<jspluginonline url="..."/>` 指向托管 URL | `wpsjs create` 生成；填入 GitHub Pages URL 即可在线模式 sideload |
| `publish.html` | `wpsjs publish` 发布模式的安装页，用户访问后安装加载项 | `wpsjs publish` 自动生成 |
| `main.js` / `wps.js` | 加载项入口 JS（宿主识别 + WPS JSAPI 调用），由 `ribbon.xml` 中的 `onAction` 引用 | 手写；探针阶段极简版即可 |
| `wps-addon-build/` | `wpsjs build` 打包产物（离线部署用） | `wpsjs build` 生成 |
| `wps-addon-publish/` | `wpsjs publish` 打包产物（含 `publish.html`） | `wpsjs publish` 生成 |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `wps-jsapi` | `1.0.5` | TypeScript IntelliSense 类型补全 | 开发期 `devDependencies`；配合 `declare namespace wps {}` 手动补充缺失类型 |
| `jszip` | `^3.x`（已有 Aster 依赖） | 探针阶段若需 pptx/zip 操作 | 如无需求不引入新依赖 |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `wpsjs` CLI 2.2.3 | 脚手架 + 本地 HTTP 服务 + 打包 | `npm install -g wpsjs`；Mac 上可用于代码编写+打包，`wpsjs debug` 在 Mac 启动 HTTP 服务但 WPS 客户端不在 Mac 上，**实际调试必须在 Windows WPS 机器上执行** |
| WPS DevTools（ALT+F12 / CEF F12） | CEF webview 内调试 JS | Windows WPS 专业版中，在加载项 webview 内 F12 或 ALT+F12 开调试器；`oem.ini` 中 `JsApiShowWebDebugger=true` 可固化开启 |
| GitHub Pages | 静态文件托管 + 在线模式 sideload | Mac 构建 → push → Pages 部署 → `jsplugins.xml` 的 `url` 填 Pages 地址 → Windows 用户通过 `oem.ini` 指向该 `jsplugins.xml` 加载；**与 Aster 现有 Pages 部署流程同路** |

---

## "One Build or Two?" — 明确回答

**结论：需要两个独立项目，但 Aster 的大部分代码（React UI + SSE + store + 设计系统）可直接复用。**

具体拆分如下：

| 层 | Office for Web（现有） | WPS 端口（新增） |
|---|---|---|
| **加载项外壳** | `manifest.xml`（Office XML manifest） | `ribbon.xml` + `jsplugins.xml` + `main.js`（wpsjs 外壳） |
| **宿主识别入口** | `Office.onReady` → `Office.context.host` | `wps.WpsApplication()` + 组件上下文（WPS 自有 VBA 风格） |
| **三个 Adapter** | `PptAdapter`/`ExcelAdapter`/`WordAdapter`（Office.js `*.run` + load/sync） | 全量重写为 WPS JSAPI VBA 风格（`app.ActivePresentation.*` 等） |
| **React UI / agent loop / SSE / store / i18n / 设计系统** | `src/` 核心代码 | **直接复用**（CEF = Chromium，底层 Web 运行时一致） |
| **构建工具** | Vite 7（现有 `vite.config.ts`） | 复用同一 Vite 7 构建，产物 `dist/` 作为 WPS taskpane HTML；可能需要单独 `vite.config.wps.ts` 调整入口 |
| **存储** | `src/lib/storage.ts`（partitionKey 分区） | 同文件，`partitionKey===undefined` 降级分支已有 |
| **bundle gate** | 初始 ≤100KB gzip | WPS 端口同样应守此门（CEF = Chromium，同约束） |

**实践建议：** 在现有 Aster 仓库中新增 `src/wps/` 目录存放 WPS 专属适配层（`WpsAdapter.ts`，三宿主各一个），并在 `src/main.tsx` 中加宿主检测分支（`typeof wps !== 'undefined'` vs `typeof Office !== 'undefined'`）。**探针阶段不需要这个——探针是独立极简 wpsjs 项目，只验底层能力。**

---

## Mac → Windows 开发环路（最低摩擦路径）

探针（WPS-02）阶段推荐的最低摩擦路径：

```
Mac（开发）
  └─ wpsjs create 生成探针项目（纯静态文件）
  └─ 写探针 HTML + JS（fetch SSE / localStorage / WPS JSAPI read/write）
  └─ vite build / wpsjs build 打包
  └─ git push → GitHub Pages 部署（自动 CI，与 Aster 现有流程同）
        │
        ▼
Windows（WPS 专业版用户机）
  └─ 配 oem.ini: JSPluginsServer=<GitHub Pages jsplugins.xml URL>
  └─ 启动 WPS → 自动拉取并加载探针加载项
  └─ 在加载项 webview 内 ALT+F12 开调试器
  └─ 逐项跑 §5 清单（navigator.userAgent / fetch SSE / localStorage / WPS JSAPI）
```

**关键点：**
- `wpsjs debug` 的 HTTP 服务可在 Mac 上跑，但 WPS 客户端在另一台 Windows 机器上，**Mac localhost 对 Windows WPS 不可达**——所以探针必须托管到公网（GitHub Pages 是现成方案）。
- `wpsjs build` 在 Mac 上可正常执行（纯 Node.js，无 Windows 依赖）。
- `wpsjs publish` 在 Mac 上可正常执行，生成 `publish.html`（可选，探针用 jsplugins.xml 即可）。
- 不需要在 Mac 上安装 WPS——Mac 上没有 WPS Windows 桌面专业版。
- Windows 用户只需要：①安装 WPS 专业版、②配 `oem.ini`、③打开 WPS。

---

## Minimum WPS Version / Edition

| 项 | 要求 | 置信度 |
|---|---|---|
| **版本** | **WPS 2019 专业版 ≥ 11.8.2.10255**（WPS-01 引用）或更高；实际用户机为 WPS 2023 专业版（≥ 12.x）更优 | MEDIUM（社区数据；WPS-01 已标注） |
| **版次** | **专业版或专业增强版**（个人版 JSAPI 加载项入口受限；专业版含完整 JSAPI 支持） | HIGH |
| **oem.ini 限制** | 个人版 ≥ 12.1.0.16910 限制了 oem.ini 加载方式；专业版此限制不同——**用户机为专业版，此问题可绕开** | MEDIUM（需真机确认当前版本行为） |
| **wpsjs CLI** | `npm update -g wpsjs` 升级到 2.2.3 可解决旧版 debug 失效问题 | HIGH |

---

## TypeScript Types for WPS JSAPI

**现状：** 没有官方 `@types/wps` DefinitelyTyped 包。唯一已知的社区包是 `wps-jsapi@1.0.5`（npm，ISC 许可），提供 WPS JSAPI 对象模型的 TypeScript 描述。版本滞后风险：包上次发布时间未明（估计 2020 前后），部分较新 API 可能未覆盖。

**推荐策略（按优先级）：**

1. `npm install --save-dev wps-jsapi` 安装基础类型（IntelliSense + 基本结构）
2. 在 `src/wps/types/wps-ext.d.ts` 中用 `declare namespace wps {}` 手动补充缺失 API（探针阶段只需要几个核心 API，补充量极小）
3. 开发时对照官方 WPS API 文档（`https://solution.wps.cn/docs/client/api/`）查实际 API 签名

**样例补充类型（探针阶段最小集）：**
```typescript
// src/wps/types/wps-ext.d.ts
declare namespace wps {
  function WpsApplication(): Application;
  interface Application {
    ActivePresentation: Presentation;
    ActiveWorkbook: Workbook;
    ActiveDocument: Document;
  }
  // ... 按需补充
}
```

---

## Installation

```bash
# 全局安装 wpsjs CLI（Mac 或 Windows 均可）
npm install -g wpsjs

# 创建 WPS 探针项目（生成外壳文件结构）
wpsjs create aster-wps-probe
# 选择：演示/表格/文字（三选一或逐个建）
# 选择：无框架（探针阶段；后续滩头堡可选 React）

# WPS JSAPI TypeScript 类型（加入 Aster 主仓库 devDependencies）
npm install --save-dev wps-jsapi

# 更新 wpsjs（如已装旧版）
npm update -g wpsjs
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| GitHub Pages 在线模式 sideload | `wpsjs debug` 本地 HTTP + Windows 本地 WPS | 只有当 Mac 开发机和 WPS Windows 机器在同一局域网、且可 NAT 穿透时才考虑（复杂，不推荐探针阶段用） |
| `wps-jsapi` + 手写 `declare namespace` | 完全手写 `wps.d.ts` | 若 `wps-jsapi` 包缺失核心 API 太多，则完全手写更可控 |
| 复用现有 Vite build + 单独 `vite.config.wps.ts` | 独立新建 Vite 项目 | 若探针验证后需要严格隔离（不推荐；共享 vite.config 更简洁） |
| 单仓多包（monorepo-light：`packages/office/` + `packages/wps/`） | 两个独立仓库 | 若 WPS-D1 全量移植开启时，可迁移到 monorepo 结构；v2.5 探针阶段无此必要 |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@microsoft/office-js` npm 包 | WPS 端口不消费 Office.js；且该 npm 包已被微软官方废弃 | 保持 CDN script tag（仅 Office for Web 端用） |
| Vercel AI SDK / `openai` SDK | WPS 端口同样走无后台直连，`dangerouslyAllowBrowser` 约束和 no-backend 约束不变 | 继续用 native `fetch` + `ReadableStream`（`src/lib/sse.ts`） |
| `wps.PluginStorage` | 非持久（关加载项即丢），不适合存 API Key | 裸 `localStorage`（CEF 持久，`storage.ts` 降级分支已有） |
| 单独引入 React Router / 新 i18n 方案 | WPS taskpane 是单页面，不需要路由；i18n 方案已有 lingui | 复用现有代码 |
| 加任何新运行时依赖（探针阶段） | 探针阶段目标是最小验证，零新依赖风险最低 | 探针用原生 JS + WPS JSAPI；滩头堡阶段再引入 React SPA |

---

## Phase-Specific Notes

### 探针项目（WPS-02 阶段）所需最小文件集

```
aster-wps-probe/
├── index.html          # 探针 taskpane 入口（纯 HTML，不需要 React）
├── main.js             # 宿主识别 + JSAPI 探测逻辑
├── ribbon.xml          # 最简 ribbon（一个按钮触发探测）
├── jsplugins.xml       # 指向 GitHub Pages URL 的在线模式配置
└── package.json        # 仅含 wpsjs devDep
```

探针 `main.js` 需要覆盖的探测项（对应 §5 清单）：
- `navigator.userAgent` → CEF 版本
- `fetch('https://api.deepseek.com/...')` → CORS + SSE 直连
- `localStorage.setItem/getItem` → 持久性
- `wps.WpsApplication().ActivePresentation.Slides` → PPT JSAPI
- `wps.WpsApplication().ActiveWorkbook.ActiveSheet` → Excel JSAPI
- `wps.WpsApplication().ActiveDocument.Paragraphs` → Word JSAPI

### 滩头堡阶段（WPS-02 go 之后）

复用 Aster 现有 Vite 7 构建：
- `vite.config.wps.ts` — 新增，入口指向 WPS 专属 `src/wps/main.tsx`（替代 `src/main.tsx` 的 `Office.onReady` 逻辑）
- `src/wps/main.tsx` — `typeof wps !== 'undefined'` 分支 → `createWpsAdapter()` → 渲染 App
- `src/wps/adapters/` — WPS JSAPI VBA 风格重写的三宿主 adapter（与 `src/adapters/` 共用接口 contract，不共用实现）
- `public/ribbon.xml` — 复制到 `dist/` 作为 wpsjs 外壳文件

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `wpsjs@2.2.3` | Node.js ≥ 16（推荐 ≥ 20） | v2.2.3 发布时测试了 Node 20.15；Mac M1/M2 无已知阻塞问题（`wpsjs create` + `wpsjs build` 纯 Node，无平台原生二进制） |
| `wps-jsapi@1.0.5` | TypeScript ≥ 4.x（Aster 用 TS 5.7，完全兼容） | 包可能缺失 2020 年后新增的 WPS JSAPI；需手动补 |
| React 19 in WPS CEF | WPS 专业版 ≥ 12.x（CEF Chromium ≥ ~100） | [需真机] CEF 具体版本待 WPS-02 `navigator.userAgent` 核查；React 19 需要 Chrome 64+ 等价的现代 JS 引擎 |
| native `fetch` + SSE | 同上 | [需真机] ReadableStream 需 Chromium ≥ 80 |

---

## Sources

- [wpsjs — npm（latest 2.2.3）](https://www.npmjs.com/package/wpsjs) — CLI 版本确认
- [wps-jsapi — jsDelivr CDN](https://www.jsdelivr.com/package/npm/wps-jsapi) — TypeScript 类型包版本 1.0.5 确认
- [WPS 加载项深入开发解析（知乎，CEF 基础）](https://zhuanlan.zhihu.com/p/266673886) — CEF 内核事实
- [WPSJS 加载项开发详解（CSDN）](https://blog.csdn.net/wpsdev/article/details/124844535) — 项目文件结构
- [WPS 加载项 JSAPI 创建发布部署（CSDN）](https://blog.csdn.net/daqinzl/article/details/138747544) — `wpsjs build/publish` 流程
- [WPSJS 在线模式和离线模式（CSDN）](https://blog.csdn.net/wpsdev/article/details/125085716) — 两种部署模式
- [WPS 加载项开发（mac版 wpsjs debug 报错）— WPS 社区](https://bbs.wps.cn/topic/36504) — Mac 调试限制
- [WPS 加载项开发和离线部署（CSDN）](https://blog.csdn.net/huaermeier/article/details/132502705) — GitHub Pages sideload 可行性
- [herman-hang/wps（GitHub）](https://github.com/herman-hang/wps) — jsplugins.xml 在线模式示例
- [WPS JSAPI 最低支持版本（CSDN）](https://blog.csdn.net/QIU176161650/article/details/147251449) — 版本要求
- [WPS 开放平台 Add-in Overview](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/wps-integration-mode/wps-addin-development/addin-overview) — 官方架构文档
- [WPS WebOffice API 文档](https://solution.wps.cn/docs/client/api/PPT/Presentation.html) — JSAPI 对象模型
- [WPS-01 调研报告](../../../phases/25-wps-spike-gate/25-WPS-01-REPORT.md) — 架构事实基础（HIGH confidence）

---

## Open Questions（WPS-02 真机才能定论）

| 问题 | 影响 | 真机验证项 |
|------|------|-----------|
| CEF Chromium 版本号是多少？ | 决定 React 19 / ES2020+ / ReadableStream 是否可用 | §5 1-1：`navigator.userAgent` |
| WPS 加载项容器是否注入额外 CSP 拦 fetch？ | **最高优先**：若拦截，无后台直连模型在 WPS 全挂 | §5 1-2：fetch SSE 直连 DeepSeek |
| `localStorage` 在 WPS CEF 中是否跨会话持久？ | 决定 API Key 存储方案 | §5 1-4：重启 WPS 后 getItem |
| WPS 专业版用户机的具体版本/build 号？ | 影响 API 覆盖度 | 用户提供版本号 |
| `wps-jsapi@1.0.5` 是否覆盖三宿主基础 read/write API？ | 影响开发体验（缺失需手写 declare） | 安装后对照文档核查 |

---

*Stack research for: WPS Windows Desktop 专业版移植，v2.5「登陆 WPS 滩头堡」*
*Researched: 2026-06-08*
