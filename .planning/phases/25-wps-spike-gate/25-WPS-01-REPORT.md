# WPS-01：WPS Windows 桌面版 Office.js 兼容性调研报告

**Phase:** 25-wps-spike-gate
**Requirement:** WPS-01（v2.4 交付层）
**作者:** research TeamMate（Claude）
**日期:** 2026-06-05
**范围约束（D-04）:** 严格只覆盖 **WPS Windows 桌面版**；WPS 网页版 / 移动版完全不提。
**判定框架（D-02）:** go = PPT / Excel / Word **三宿主 `run()` 基础读写全绿**（最保守阈值）。
**增益视角（D-03）:** 桌面独有能力（网页版 Office.js 做不到的）算 go 加分项，逐项探。
**交付边界（D-01）:** 本报告 = 调研层（初步信号 + 真机清单）。真机实测 + 最终裁定（WPS-02）已延后，**本报告不假装有真机结论**。

> ⚠️ **一句话先讲清楚（大白话）：** WPS 不是"装个微软插件就能跑"的关系。WPS 有它**自己的一整套插件体系**（自己的 API、自己的清单文件、自己的安装方式），跟微软 Office.js 是**两条平行铁轨**。Aster 现在这套代码（微软 manifest + office.js + `PowerPoint.run` 等）**没法直接搬到 WPS 上 sideload 就用**——要上 WPS 等于**重写一层适配**，不是"换个壳"。下面是详细证据。

---

## 1. 执行摘要 + 初步 go/no-go 信号

### 1.1 核心结论

**北极星问题**是："在 WPS Windows 桌面版里 sideload Aster 线上版，三宿主的 agent 改文档（含 undo）能不能跑通？"

**调研层的诚实回答：不能——以"sideload 现有代码即用"为口径，这条路在架构上被堵死。** 证据高度一致（10+ 一手/社区来源）：

- WPS 桌面版**不消费**微软的 `OfficeApp` XML manifest，也**不实现** `Office` / `Word` / `Excel` / `PowerPoint` 这套 JS 命名空间（即 `PowerPoint.run` / `Excel.run` / `Word.run`）。
- WPS 用的是**自有加载项体系**：`wps.*` JSAPI 命名空间（VBA 风格对象模型）+ `ribbon.xml`（UI）+ `jsplugins.xml` / `publish.xml`（部署）+ `wpsjs` CLI 工具链。
- 多位开发者明确指出两条技术路线"**不兼容**"；把 Office.js 调用映射到 WPS API 的适配层目前**只是理论设想，无成熟实现**。

### 1.2 用 D-02 框架判定的初步信号

D-02 阈值 = "三宿主 `run()` 基础读写全绿才 go"。

| 判定项 | 信号 | 依据 |
|---|---|---|
| 三宿主 `run()` 能否在 WPS 跑通（现有代码原样） | 🔴 **全红（不是部分红）** | WPS 根本不提供 `*.run` API；Office.js 运行时不会在 WPS 内初始化（`Office.onReady` 不会触发）。三宿主同时挂，连 bootstrap 都进不去。 |
| **D-02 下的初步裁定** | 🔴 **NO-GO（按"sideload 即用"口径）** | 任一宿主挂即 no-go；此处是三宿主全挂，且原因是架构性而非 API 版本落后。 |

### 1.3 关键再定性：这是「移植」问题，不是「sideload」问题

D-02 的字面阈值（"三宿主 run() 全绿"）**用现有代码无法达成**——但这不代表"WPS 完全不能承载 Aster"。要把两个不同的问题分开：

- **问题 A（本 spike 的字面问题）：** Aster 现有 manifest + office.js + `*.run` 代码能否在 WPS sideload 即用？→ **不能（架构性 NO-GO）。**
- **问题 B（更值钱的问题）：** WPS 桌面版是否是 Aster 值得投入的目标平台（通过专门重写一层 WPS 适配）？→ **潜在可行，但需重写**。理由：WPS 桌面加载项跑在 **Chromium/CEF webview** 里（所以 React UI + `fetch` + SSE 流式 + localStorage 这套**底层 Web 能力大概率能用**），且 WPS 的 VBA 风格 API **甚至可能解锁 D-03 那批网页版做不到的能力**。

**因此本报告给团队的诚实信号是：**

> **对"WPS-D1 = 把现有代码 sideload 到 WPS"——NO-GO（此路不通）。**
> **对"WPS-D1 = 为 WPS 桌面写一套独立适配层"——条件性可行（GO-with-rewrite），且 D-03 增益是真实加分项，但全部是重写换来的，没有免费午餐。**
> 最终裁定仍需 WPS-02 真机层坐实（尤其 CEF 内核版本、CORS/CSP 实际策略、WPS API 各操作真机可用性）。本报告只给信号，不给裁定（D-01）。

### 1.4 对真机清单（D-05）的影响

D-05 默认"真机用线上 GitHub Pages manifest sideload"——但本调研发现 **WPS 不消费微软 manifest，没有"浏览 manifest.xml 上传"这个流程**。按 D-05 的明文授权（"若 sideload 机制与微软不同，researcher 给出 WPS 侧步骤，真机清单据此调整"），真机清单已相应改写（见 §5）：保留一个"低成本证伪测试"（确认 MS manifest 确实进不去 WPS），主体改为"WPS 原生 `wpsjs` 最小 spike"路径来验证底层能力。

---

## 2. 11 项 researchable facts 逐项发现

> 证据质量分级：**【官方明确】** = WPS/微软官方文档直述；**【社区实测】** = 开发者博客/论坛/开源仓库实证；**【推断】** = 由已确认事实逻辑推导，未见直接证据；**【未知-需真机】** = 调研层无法定论，必须 WPS-02 真机验。

### Fact ① WPS 是否支持微软 Office.js Add-in 架构 / XML manifest？

**发现：不支持。WPS 用完全独立的自有加载项体系。** 置信度：**HIGH**。

- WPS 加载项是"一套基于 Web 技术扩展 WPS 的方案，每个加载项打开一个网页，通过调用网页中 JavaScript 方法完成逻辑"，底层"以 Chromium 开源浏览器项目为基础进行优化扩展"。【官方明确】
- WPS 的配置/清单文件是 **`ribbon.xml`**（自定义功能区 UI）+ **`jsplugins.xml`**（动态传递模式）/ **`publish.xml`**（publish 模式），由 `wpsjs` CLI（`npm i -g wpsjs` → `wpsjs create`）生成。**WPS 体系里没有 `manifest.xml`**（那是微软 Office Add-in 的文件，两套不可混用）。【官方明确 + 社区实测】
- 开发者直述："由于 WPS 和 MSOffice 技术路线的不兼容……"，并指出兼容层（把 WPS 接口按 Office 接口签名包装）目前是"理论设想"。【社区实测】

> 含义：Aster 的 `manifest.xml`（三 `<Host>`：Presentation/Workbook/Document + shared runtime + Pages URL）**不是 WPS 能识别的 sideload 对象**。这是 go/no-go 的真正分水岭——结论是分水岭落在"不通"一侧。

来源：[WPS 加载项 Add-ins Overview（open.wps.cn）](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/wps-integration-mode/wps-addin-development/addin-overview)；[wpsjs 项目结构与配置文件区别（CSDN）](https://blog.csdn.net/daqinzl/article/details/138747544)；[WPS 加载项开发说明（wpscdn 官方文档镜像）](https://qn.cache.wpscdn.cn/encs/doc/office_v8/topics/WPS%20%E5%8A%A0%E8%BD%BD%E9%A1%B9%E5%BC%80%E5%8F%91/WPS%20%E5%8A%A0%E8%BD%BD%E9%A1%B9%E5%BC%80%E5%8F%91%E8%AF%B4%E6%98%8E.html)；[公文排版助手开发计划（两路线不兼容讨论）](https://xkonglong.com/wordaddfuture/)

### Fact ② `Office.onReady` / `Office.context.host` 宿主识别行为？

**发现：在 WPS 内不会工作。WPS 用自己的 `wps.WpsApplication()` + 组件上下文识别。** 置信度：**HIGH（推断为主，需真机坐实具体表现）**。

- `Office.onReady` / `Office.context.host` 依赖微软 Office.js 运行时与宿主之间的**原生桥接**。WPS 不实现该桥接 → 即便页面加载了 office.js 脚本，`Office` 全局也不会被宿主初始化，`onReady` 回调**不会触发**，`Office.context.host` 无从解析。【推断，逻辑确定性高】
- WPS 侧对应能力走 `wps.WpsApplication()`（取应用对象），组件类型（金山文字/表格/演示）由 `Application` 对象上下文区分，风格与 VBA 一致。【官方明确】

> 含义：Aster `src/main.tsx` 的"`Office.onReady` 读 `info.host` → `createAdapter(info.host)` → 渲染"这条总入口链，在 WPS 里**第一步就断**。要在 WPS 跑，宿主识别必须改用 WPS API 重写。

来源：[演示文稿 ActivePresentation（WPS WebOffice API）](https://solution.wps.cn/docs/client/api/PPT/Presentation.html)；[WPS JS 宏 Application 对象（看云）](https://www.kancloud.cn/pwedu/wps-js-macros/2259310)

### Fact ③ `PowerPoint.run` / `Excel.run` / `Word.run` requirement set 支持矩阵？

**发现：N/A——WPS 根本不提供 `*.run` 这套 API，所以"requirement set 版本覆盖"是个不适用的问题。** 置信度：**HIGH**。

- Aster 实际用到的 requirement set（代码 `isSetSupported` 实证）：**WordApi 1.6**（`uniqueLocalId` 段落消歧，多处门控）、**ExcelApi 1.9**（`replaceAll` 查找替换）、**PowerPointApi 1.10**（某写操作门控）；v2.4 新工具还将用到 **WordApi 1.4**（`insertComment`）、**ExcelApi 1.8**（`pivotTables`）、**PowerPointApi 1.4**（`addLine`）。这些**全是微软 Office.js 的 requirement set 概念**。
- WPS 的对应能力是 **VBA 风格对象模型**：`app.ActivePresentation.Slides.Item(1)`、`Slides.FindBySlideID2()`、Excel PivotTable 对象、Word PageSetup 等——**与 `*.run` + `load`/`sync` 的 proxy 范式完全不同的 API 形状**。【官方明确】

> 含义：不是"WPS 的 WordApi 版本太旧用不了 1.6"——而是 WPS 压根没有"WordApi requirement set"这个东西。Aster 三个 adapter（`PptAdapter`/`ExcelAdapter`/`WordAdapter`）里**每一个 `*.run()` 闭包、每一处 `load`/`sync`、每一个 inverse 方法**都要按 WPS VBA 模型重写。

来源：[幻灯片集合 Slides（WPS WebOffice API）](https://solution.wps.cn/docs/client/api/PPT/Slides.html)；[WPS 表格 JSAPI（含数据透视表）（WPS 社区）](https://bbs.wps.cn/topic/40878)；代码实证：`src/adapters/WordAdapter.ts:494` 等 `isSetSupported('WordApi','1.6')`、`ExcelAdapter.ts:1336`、`PptAdapter.ts:2595`

### Fact ④ WPS 是否走微软 CDN office.js loader？

**发现：不走。WPS 不通过微软 CDN office.js 引导加载项；即便 CEF 能 fetch 到该文件，`Office` 运行时也不会初始化。** 置信度：**MEDIUM-HIGH（推断；真机可一测便知）**。

- WPS 加载项的引导是：WPS 启动/唤起 → 读 `publish.xml`/`jsplugins.xml` → 打开加载项 `index.html` → 引入 `main.js` → 解析 `ribbon.xml`。**全程没有"从 `appsforoffice.microsoft.com/.../office.js` 加载运行时"这一步**。【官方明确】
- Aster `index.html` 里的 `<script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js">` 这个标签——CEF webview 作为 Chromium 内核**有能力把该 JS 文件下载下来**，但 office.js 需要宿主端原生桥接才能 `Office.onReady` 成功；WPS 无此桥接 → 脚本即使加载也是"空转"。【推断】

> 含义：Fact ④ 与 ① ② 相互印证——CDN office.js 这条 Aster 赖以启动的链路在 WPS 里没有落点。

来源：[WPS 加载项加载流程（CSDN）](https://blog.csdn.net/C_jian_/article/details/144106914)；[微软 office.js CDN 引用方式（Microsoft Learn）](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/referencing-the-javascript-api-for-office-library-from-its-cdn)

### Fact ⑤ WPS Task Pane webview 内核（是否 Chromium？版本？）

**发现：是 Chromium——具体是 CEF（Chromium Embedded Framework）。版本随 WPS 构建而异，需真机 `navigator.userAgent` 查。** 置信度：内核=**HIGH**；具体版本=**未知-需真机**。

- "WPS 加载项的底层是以 Chromium 开源浏览器项目为基础进行的优化扩展"；"JS 加载项以 CEF 为技术基础，加载项的 JS 代码运行在 CEF 内部"。【官方明确 + 社区实测】
- 具体 Chromium 版本号在文档中**未披露**，且不同 WPS 版本内置的 CEF 版本不同。真机可在加载项 DevTools（CEF 捕获 F12 → `ShowDevTools`，或 WPS 调试器 ALT+F12）控制台执行 `navigator.userAgent` 读取。【社区实测】

> 含义（对 Aster 利好的一面）：CEF=Chromium 意味着**现代 JS 引擎**——`fetch` / `ReadableStream` / ES2020+ / React 19 这套**底层 Web 运行时大概率支持**，这是"问题 B（重写后可行）"成立的技术基础。前提仍是先有 WPS 适配把代码送进这个 webview。

来源：[WPS 加载项 Add-ins Overview（open.wps.cn，"基于 Chromium"）](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/wps-integration-mode/wps-addin-development/addin-overview)；[WPS 加载项深入开发解析（CEF 基础）（知乎）](https://zhuanlan.zhihu.com/p/266673886)

### Fact ⑥ CORS / iframe CSP 在 WPS webview 的行为？

**发现：CEF 是标准 Chromium，CORS/fetch 行为应遵循标准 Chromium 语义；DeepSeek/aihubmix/Pexels 已是 CORS 放行的 OpenAI-compat 端点，理论上可直连。但 WPS 加载项容器的实际 CSP 策略未知，是高危面，必须真机验。** 置信度：**MEDIUM（标准行为推断 + 真机必验）**。

- CORS 是浏览器层机制；CEF 作为 Chromium 内核遵循同源策略 + CORS 响应头判定。WebView/Chromium 在某些嵌入式配置下 CORS 行为可能有差异（Chromium 官方专门有 WebView CORS 文档说明嵌入式场景的行为细节）。【社区/官方通用】
- Aster 的无后台模型依赖浏览器直连 DeepSeek / aihubmix / Pexels（SSE 流式 + 图片）。这些端点在 Office for Web 已实证 CORS 放行（v2.2 真机 UAT：Pexels 双重 CORS 均放行）。**若代码运行在 WPS CEF webview 内，同样的直连大概率可行**——但 WPS 加载项是否对加载项页面注入额外 CSP（如限制 `connect-src`）属未知，是 go/no-go 的高危面（类比 v2.2 Pexels CORS 风险）。【推断 + 需真机】

> 含义：这是"问题 B"里**第二个必须真机坐实的风险点**（第一个是 CEF 版本）。若 WPS 加载项容器拦截直连 fetch，Aster 的无后台直连模型在 WPS 内会挂。

来源：[MDN CORS](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Guides/CORS)；[Chromium WebView CORS 行为文档](https://chromium.googlesource.com/chromium/src/+/HEAD/android_webview/docs/cors-and-webview-api.md)；项目记忆 `project_no_backend_status`（无后台靠 CORS GATING）

### Fact ⑦ partitioned localStorage / `Office.context.partitionKey` 在 WPS 是否可用？

**发现：`Office.context.partitionKey` 在 WPS 不存在（无 Office.js）。WPS 自有 `wps.PluginStorage`（⚠️ 非持久，关加载项即失效）+ `FileSystem`（持久化）。标准 CEF `localStorage` 大概率可用且持久——可作为 WPS 端持久化落点。** 置信度：**MEDIUM**。

- `Office.context.partitionKey` 是 Office.js Common API 的一部分，WPS 无 Office.js → 该属性不存在。【推断，确定性高】
- WPS 提供 `wps.PluginStorage.setItem/getItem`，但官方明确"**PluginStorage 不能持久化，数据只在关闭加载项前有效**；持久化需写本地文件（`FileSystem` 对象）"。【官方明确】
- CEF=Chromium → 标准 `localStorage`（5MB、持久）**大概率可用**。真机需验 WPS 加载项页面的 `localStorage` 是否持久跨会话。【推断 + 需真机】

> 含义（利好）：Aster `src/lib/storage.ts` **已经处理了 `partitionKey === undefined` 的降级路径**（注释明示"Windows WebView：partitionKey=undefined，直接用 rawKey"）。也就是说，存储层逻辑对"无 partitionKey"环境**本就有兼容分支**——若 WPS CEF 的 `localStorage` 持久可用，这部分迁移成本低（落点改用裸 `localStorage` 或 WPS `FileSystem`）。

来源：[wps.PluginStorage 对象（wpscdn 官方文档镜像，"不能持久化"）](https://qn.cache.wpscdn.cn/encs/doc/office_v13/topics/WPS%20%E5%9F%BA%E7%A1%80%E6%8E%A5%E5%8F%A3/%E5%8A%A0%E8%BD%BD%E9%A1%B9%20API%20%E5%8F%82%E8%80%83/%E5%8A%A0%E8%BD%BD%E9%A1%B9%E6%95%B0%E6%8D%AE/PluginStorage%20%E5%AF%B9%E8%B1%A1.htm)；[微软 partitioned localStorage + partitionKey（Microsoft Learn）](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/persisting-add-in-state-and-settings)；代码实证：`src/lib/storage.ts:60-69`（partitionKey 不存在时返回 rawKey）

### Fact ⑧ WPS sideload 机制？

**发现：与微软完全不同。WPS 用 `wpsjs build/publish` + `publish.html` 安装页（publish 模式）或 `jsplugins.xml`（动态模式）；旧 `oem.ini` 法自 v12.1.0.16910 起因安全收紧被限制。没有"浏览 manifest.xml 上传"的流程。** 置信度：**HIGH**。

- **Publish 模式**：`wpsjs build` 打包 → `wpsjs publish` 发布 → 把 `wps-addon-build`（代码）+ `wps-addon-publish/publish.html`（安装页）部署到服务器 → 用户访问 `publish.html` 安装；WPS 启动自动加载。
- **动态传递（jsplugins.xml）模式**：`wpsjs build` 打包 → 配 `jsplugins.xml`（`url` 指向加载项地址）→ 部署到服务器 → 业务系统唤起 `WpsInvoke` 传入 `jsplugins.xml` 地址；离线单机用 `oem.ini` 的 `JSPluginsServer` 指向本地 `jsplugins.xml`。
- 安全收紧：WPS 个人版自 **12.1.0.16910** 起限制了改 `oem.ini` 加载加载项的旧法，需升级 `wpsjs` 工具链 + `wpsjs publish` 重新发布。【社区实测】
- 集成文档建议的最低版本参考：WPS2019 专业版 v11.8.2.10255+（Windows 仅 10255+ 专业版支持 JSAPI 加载项）。【社区实测，版本偏旧仅供参考】

> 含义：**D-05 默认的"用线上 GitHub Pages MS manifest sideload"在 WPS 不成立**——WPS 不认这个 manifest。真机清单已据 D-05 明文授权改写（§5）。

来源：[WPS 加载项创建/发布/部署（CSDN）](https://blog.csdn.net/daqinzl/article/details/138747544)；[WPS 离线加载项构建与部署（CSDN）](https://blog.csdn.net/qq506982273/article/details/138347677)；[WPS 加载项介绍（exwps，oem.ini 安全收紧）](https://www.exwps.com/2024/03/19/wps%E5%8A%A0%E8%BD%BD%E9%A1%B9%E4%BB%8B%E7%BB%8D/)；[金山 WPS 客户端 JSAPI 加载项集成文档（致远，版本要求）](https://open.seeyoncloud.com/v5devCTP/1842/1851/1852.html)

### Fact ⑨ 社区 / 官方证据：有人在 WPS 跑通微软 Office.js add-in 吗？

**发现：无证据表明有人原样跑通微软 Office.js add-in。主流证据一致认为两条路线不兼容；适配层只是理论。COM 加载项层面有 CLSID 共用（但那是旧的原生路径，与 Office.js web 加载项无关）。** 置信度：**HIGH**。

- 多位开发者明确："WPS 和 MSOffice 技术路线不兼容"；有评论提出"既然两边都用 JS，可以做一个中间适配层按 Office 接口签名调 WPS 接口"——但被注明是**理论设想，未实现**。【社区实测】
- 唯一的真实"兼容"在 **COM 加载项**层面：WPS 与 Office 官方为互相兼容，Word/Excel/PowerPoint 的 COM 接口**共用相同 CLSID**，一套 interop 库即可兼容两者。**但这是 .NET/C++ COM 原生插件路径，与 Aster 的 Office.js web 加载项是完全不同的技术，不可借用。**【社区实测】
- 一次 WebFetch 中出现过"WPS 也支持兼容 Office JSAPI"的零散表述，但该来源随后描述的是微软官方 partitionKey 文档，疑为模型串台/泛化。**无权威来源坐实"WPS 兼容 Office.js"，按未验处理，真机必须证伪/证实。**

> 含义：社区生态没有"现成的 Office.js→WPS shim"可白嫖；走 WPS 等于自建适配。

来源：[公文排版助手开发计划（路线不兼容 + 适配层理论）](https://xkonglong.com/wordaddfuture/)；[C# 开发 Office 和 WPS COM 加载项（CLSID 共用）（博客园）](https://www.cnblogs.com/BluePointLilac/p/18802868)；[opencode-wps（开源 WPS 插件，证明 WPS 用自有 ribbon.xml + wpsjs）（GitHub）](https://github.com/lnxsun/opencode-wps)

### Fact ⑩ 桌面独有增益候选（D-03 清单）逐项支持情况

**发现：WPS 桌面 JSAPI 是 VBA 风格对象模型，传统上对这批"网页版 Office.js 做不到"的能力有支持——所以 D-03 增益是"真实存在的加分项"。但全部要用 WPS 自有 API 重写实现，不是现有 Office.js 代码能直接拿到。逐项可用性仍需真机验。** 置信度：**MEDIUM（VBA 模型普遍支持；逐 API 真机验）**。

详见 §4 专节逐项评估。一句话：**"迁 WPS 桌面 = 不止对等迁移，还能解锁网页版做不到的能力"这个论断方向上成立，提升 WPS-D1 的 ROI——但代价是为每个增益写 WPS 专属代码。**

来源：[幻灯片集合 Slides（WPS，copy/duplicate slide）](https://solution.wps.cn/docs/client/api/PPT/Slides.html)；[WPS 表格 JSAPI（数据透视表/PivotTable）](https://bbs.wps.cn/topic/40878)；[WPS PPT VBA 自动化（背景/版式/复制幻灯片）（CSDN）](https://blog.csdn.net/tgzssir/article/details/129420147)

### Fact ⑪（报告产出物）综述 + 信号 + 清单

已在 §1（信号）+ §5（真机清单）+ §6（工作量）落地。

---

## 3. 兼容性矩阵（WPS Windows 桌面版 vs Aster 现状）

| 维度 | Aster 当前依赖（Office for Web） | WPS Windows 桌面版现实 | 兼容性 | 置信度 |
|---|---|---|---|---|
| **加载项清单** | `manifest.xml`（`OfficeApp` XML，三 `<Host>` + shared runtime） | `ribbon.xml` + `jsplugins.xml`/`publish.xml`，无 manifest.xml | 🔴 不兼容 | HIGH |
| **宿主识别** | `Office.onReady` → `Office.context.host` | `wps.WpsApplication()` + 组件上下文（VBA 风格） | 🔴 不兼容（链路第一步即断） | HIGH（推断） |
| **PPT `run()`** | `PowerPoint.run` + `load`/`sync` proxy 范式 | `app.ActivePresentation.Slides.*`（VBA 模型） | 🔴 API 形状完全不同，需重写 | HIGH |
| **Excel `run()`** | `Excel.run` + `range.load`/`sync` | `app.ActiveWorkbook.*`（VBA 模型，含 PivotTable） | 🔴 同上 | HIGH |
| **Word `run()`** | `Word.run` + `paragraphs.load`/`sync` | `app.ActiveDocument.*`（VBA 模型） | 🔴 同上 | HIGH |
| **requirement sets** | WordApi 1.4/1.6、ExcelApi 1.8/1.9、PowerPointApi 1.4/1.5/1.10 | 无 requirement set 概念（VBA 模型） | 🔴 不适用 | HIGH |
| **office.js CDN 引导** | `appsforoffice.microsoft.com/.../office.js` 脚本引导 | 不走 CDN 引导；`index.html`+`main.js`+`ribbon.xml` | 🔴 引导链无落点 | MEDIUM-HIGH（推断） |
| **webview 内核** | Edge/Chrome WebView2 / 浏览器 | **CEF（Chromium Embedded Framework）** | 🟢 同属 Chromium，底层 Web 能力一致 | HIGH（版本未知-需真机） |
| **CORS / 直连 fetch + SSE** | 浏览器标准 CORS，端点已放行 | CEF 标准 Chromium CORS（容器 CSP 未知） | 🟡 大概率可用，需真机验 CSP | MEDIUM |
| **持久化存储** | partitioned `localStorage`（`Office.context.partitionKey`） | 无 partitionKey；`wps.PluginStorage`(非持久) + `FileSystem`(持久)；CEF `localStorage` 大概率可用 | 🟡 落点要换，但 storage.ts 已有 partitionKey=undefined 降级分支 | MEDIUM |
| **sideload 机制** | 浏览/上传 manifest.xml（Office for Web） | `wpsjs publish`+`publish.html` / `jsplugins.xml`（无上传 manifest 流程） | 🔴 机制不同，D-05 默认不适用 | HIGH |

**矩阵速读：** 🔴 全部集中在"微软加载项契约层"（清单/宿主识别/`*.run`/requirement set/引导/sideload）——这层 WPS 完全另起炉灶，是 NO-GO 的根因。🟢🟡 集中在"底层 Web 运行时层"（CEF 内核/CORS/存储）——这层 WPS 是标准 Chromium，对"重写后可行"是利好。**分界线非常清晰：UI 与网络/存储层可复用，宿主交互层必须全重写。**

---

## 4. D-03 桌面独有增益候选评估（逐项）

> 评估口径：列出每个候选在 **WPS 桌面 VBA 风格 JSAPI** 层面"能力是否存在"。⚠️ 全部需 WPS 专属代码实现（非现有 Office.js 代码可得）；逐项真机可用性待 WPS-02 验。能力存在性置信度普遍 MEDIUM（VBA 自动化模型历史上支持，但 WPS JSAPI 子集是否覆盖、网页版-vs-桌面版差异需实证）。

| D-03 候选能力 | 网页版 Office.js 现状（Aster 已知） | WPS 桌面 JSAPI 能力信号 | 评估 | 置信度 |
|---|---|---|---|---|
| **PPT `copy_slide`** | 🔴 网页版微软接口不支持（v2.1 已知诚实失败） | 🟢 VBA 模型有 `Slides` 复制/克隆 + `FindBySlideID2` | **可能解锁**（真加分） | MEDIUM |
| **PPT SmartArt / 动画 / 转场 / 套主题** | 🔴 网页版平台天花板（建不了） | 🟡 VBA 桌面模型传统支持动画/转场/主题；SmartArt 视 JSAPI 子集 | 部分可能解锁，逐项验 | LOW-MEDIUM |
| **PPT 读背景色** | 🔴 网页版读不了 slide 背景色 | 🟢 VBA `Slide` 有 Background/FollowMasterBackground | **可能解锁** | MEDIUM |
| **PPT 取选中图片 Preview API** | 🔴 `getImageAsBase64` 网页版未 GA（v2.2 fallback 上传） | 🟡 桌面可能有取图/导出能力（API 形状不同） | 可能解锁，需验 | LOW-MEDIUM |
| **Word 页边距 / 纸张大小** | 🔴 网页版平台天花板 | 🟢 VBA `PageSetup`（margins/paper size）经典支持 | **可能解锁** | MEDIUM |
| **EXCEL-13 数据透视表** | 🟡 v2.4 标 API 风险（plan-phase 须验网页版） | 🟢 WPS 表格 JSAPI 明确有 PivotTable（CalculatedFields/Items） | **可能解锁/更稳** | MEDIUM |
| **PPT-09 插入表格** | 🟡 v2.4 标 API 风险（网页版可能不支持原生建表） | 🟡 VBA `Shapes.AddTable` 经典支持 | 可能解锁，需验 | MEDIUM |
| **PPT-10 线条 / 箭头连接符（addLine）** | 🟡 v2.4 标 API 风险 | 🟡 VBA `Shapes.AddLine`/`AddConnector` 经典支持 | 可能解锁，需验 | MEDIUM |
| **PPT-11 渐变填充** | 🟡 v2.4 标 API 风险（可能只支持纯色） | 🟡 VBA `Fill.*` 有 gradient（`PresetGradient`/`OneColorGradient`） | 可能解锁，需验 | MEDIUM |

**D-03 小结：** 方向性结论成立——**WPS 桌面（非浏览器受限环境）很可能能做一批 Office for Web 做不到的事，这是 WPS-D1 的真实加分项**，会显著抬高 ROI（迁 WPS ≠ 仅对等迁移，还扩能力面）。但两个诚实限定：①这些是"能力存在"信号，非"已验可用"；②全部要写 WPS 专属代码换取，计入重写工作量。

---

## 5. 真机验证清单（用户日后照单跑）

> **重要调整（依 D-05 明文授权）：** 调研发现 WPS 不消费微软 manifest，"用线上 Pages manifest sideload"在 WPS 不成立。故清单分两段：**第 0 段 = 低成本证伪（确认 NO-GO 信号属实）**；**第 1-3 段 = WPS 原生路径（验证"重写后可行"的底层依据）**。每条可勾选；挂/通逐项记录。
>
> **环境前置：** WPS Windows 桌面**专业版/企业版**（JSAPI 加载项需专业版，参考 ≥ WPS2019 专业版 10255 或更高现行版）；Node 环境（`npm i -g wpsjs`）；能开加载项 DevTools（WPS 调试器 ALT+F12 / CEF F12）。

### 第 0 段（P0 证伪）：确认微软 manifest 路径在 WPS 不通

- [ ] **0-1** 在 WPS 桌面尝试用任何方式加载 Aster 线上 manifest（`https://wynne-cwb.github.io/Aster/manifest.xml` 或 SourceLocation URL）→ 预期：**WPS 无"上传 manifest"入口 / 加载无效**。记录实际现象，坐实 Fact ①⑧。
- [ ] **0-2**（可选）在 WPS 加载项的 webview 里（若能进任意页面）打开 Aster 线上 Task Pane URL（`https://wynne-cwb.github.io/Aster/`）→ 观察 `Office.onReady` 是否触发、`typeof Office` / `Office.context` 是否存在 → 预期：**Office 未初始化 / onReady 不触发**，坐实 Fact ②④。

### 第 1 段（P0）：WPS 底层 Web 运行时能力（CEF 是否够跑 Aster 的非宿主部分）

> 建议用一个最小 `wpsjs create` spike 加载项承载这些测试（taskpane.html 内跑一段探测 JS）。

- [ ] **1-1 内核版本**：加载项 DevTools 控制台执行 `navigator.userAgent` → 记录 Chromium/CEF 版本（判断是否支持 React 19 / ES2020+ / `ReadableStream`）。(Fact ⑤)
- [ ] **1-2 fetch + SSE 直连（CORS 高危面）**：在加载项页面 `fetch` 调一次 DeepSeek `/chat/completions`（`stream:true`，BYO key）→ 验证能否拿到 SSE 流（`text/event-stream`）、是否被容器 CSP/CORS 拦。(Fact ⑥) **这是 go 的关键风险点。**
- [ ] **1-3 图片直连**：`fetch` 调一次 aihubmix 图片接口 + 一次 Pexels 检索 → 验证 b64_json/缩略图能否取回（复用 v2.2 经验）。
- [ ] **1-4 localStorage 持久化**：加载项页面 `localStorage.setItem` 写值 → 关 WPS 重开 → `getItem` 是否还在 → 判断 CEF localStorage 是否持久（决定 Key 存储落点）。(Fact ⑦)
- [ ] **1-5 字体/渲染**：确认 Google Fonts（Inter/Noto Sans SC/JetBrains Mono）能否在 CEF 加载，teal 设计系统 CSS 是否正常（无明显降级）。

### 第 2 段（P0 — D-02 三宿主全绿核心）：WPS JSAPI 三宿主 read/write/undo

> ⚠️ 注意：这里测的**不是** Aster 现有 `*.run` 代码（在 WPS 跑不了），而是**用 WPS 自有 JSAPI** 验证"三宿主基础读写撤销在 WPS 能做"。三宿主任一挂 → 即便重写也达不到 D-02 全绿 → no-go。

**金山演示（PPT）**
- [ ] **2-P1 读**：`app.ActivePresentation.Slides` 取页数/取选中页/读形状文本（对应 Aster `list_slides`/`get_slide`/`getSelection`）。
- [ ] **2-P2 写**：新增一页 + 写标题文本框 + 改某形状文字/填充色（对应 `insertSlideAfter`/`setShapeText`/`setShapeProperty`）。
- [ ] **2-P3 撤销**：用 WPS API 撤销上述写（删页/还原文字）——验证可自建 undo（Aster undo-all 守门的对等能力）。

**金山表格（Excel）**
- [ ] **2-E1 读**：取选区地址 + 读区域值 + 列工作表（对应 `getSelection`/`get_range_values`/`list_worksheets`）。
- [ ] **2-E2 写**：写单元格值/公式 + 设格式（对应 `setCell`/`applyFormula`/`formatExcelRange`）。
- [ ] **2-E3 撤销**：还原区域值（对应 `overwriteRange`/快照还原）。

**金山文字（Word）**
- [ ] **2-W1 读**：取选区字符数 + 读段落（对应 `getSelection`/段落读取）。
- [ ] **2-W2 写**：末尾追加段落 + 改某段文字/字体格式（对应 `appendParagraph`/`replaceParagraphAt`/`setCharacterFormat`）。
- [ ] **2-W3 撤销**：删除/还原该段（对应 `deleteParagraphByContent`/`restoreParagraphAt`）。

> **D-02 判定门：** 2-P/2-E/2-W 三组的 read+write+undo **全绿** → 满足 go 的基础信心；任一组挂 → no-go 或仅部分 go。

### 第 3 段（D-03 加分探测）：桌面独有增益逐项真机

- [ ] **3-1** PPT 复制幻灯片（`Slides` copy/duplicate）能否跑通
- [ ] **3-2** PPT 读 slide 背景色
- [ ] **3-3** PPT 取选中图片为 base64（桌面取图能力）
- [ ] **3-4** Word 改页边距 / 纸张大小（`PageSetup`）
- [ ] **3-5** Excel 创建数据透视表（PivotTable）
- [ ] **3-6** PPT 插入表格（`Shapes.AddTable`）
- [ ] **3-7** PPT 线条/箭头连接符（`Shapes.AddLine`/`AddConnector`）
- [ ] **3-8** PPT 渐变填充（`Fill` gradient）
- [ ] **3-9**（可选）SmartArt / 动画 / 转场 / 套主题

> 第 3 段任一通 = WPS-D1 的额外加分理由，记录"WPS 桌面解锁了网页版做不到的 X"。

---

## 6. 适配工作量初估

> 因初步信号是"NO-GO for sideload-as-is / GO-with-rewrite for WPS-D1"，这里给**重写量级**（粗估，真机校准后细化）。

**可大量复用（低成本，~不需重写）：**
- React 19 UI 全栈、teal 设计系统、Zustand store、聊天/agent loop 编排、SSE 流式解析（`src/lib/sse.ts`）、Provider 抽象与直连客户端、文件解析懒加载、i18n。
- 理由：这些都在"webview 内 + 网络层"，CEF=Chromium 大概率原样跑（前提 §5 第 1 段全绿）。
- `storage.ts` 已有 `partitionKey===undefined` 降级分支，落点改造小。

**必须全重写（高成本，WPS 专属）：**
- **加载项外壳**：`manifest.xml` → `ribbon.xml` + `jsplugins.xml`/`publish.xml`；`wpsjs` 工具链打包发布；`publish.html` 安装页。
- **宿主识别入口**：`src/main.tsx` 的 `Office.onReady`/`Office.context.host` → WPS `wps.WpsApplication()` + 组件上下文。
- **三个 adapter 全量重写**：`PptAdapter`/`ExcelAdapter`/`WordAdapter` 的**每一个 `*.run()` + load/sync + read/write/inverse 方法**改为 WPS VBA 风格 JSAPI（这是最大头——三宿主 ~50+ 方法）。
- **undo 引擎适配**：operationLog 的 read/inverse 调用面要对接 WPS API（守门测试需新建 WPS 版本）。
- **D-03 增益**（若做）：每个增益一份 WPS 专属实现。

**量级判断（粗）：** UI/网络/store ≈ 复用 60-70%；宿主交互层（adapter + 外壳 + undo 对接）≈ 0 复用、全新写，是一个**独立 milestone（WPS-D1）的主体工作量**——与"再做一遍 v2.0+v2.1 的三宿主 write/read/undo"同量级，但有现成的工具语义/契约可照搬设计（不需重新设计，只需重新实现 API 绑定）。**这正是 D-02 要"最保守阈值"的原因：投入大，必须三宿主真机全绿再承诺。**

---

## 7. 已知限制 / 风险 / 无真机不可定项

**架构性结论（高置信，调研层可定）：**
- 🔴 Aster 现有 manifest + office.js + `*.run` 代码**不能在 WPS sideload 即用**——这是确定的，不是"可能"。

**高危面（必须 WPS-02 真机坐实，否则裁定悬空）：**
- 🟡 **CEF 容器 CSP/CORS**（Fact ⑥）：若 WPS 加载项容器拦直连 fetch，无后台直连模型在 WPS 内挂 → 即便重写也卡 go。**最高优先真机项（§5 1-2）。**
- 🟡 **CEF 内核版本**（Fact ⑤）：版本过旧可能不支持 React 19 / ES2020+ / `ReadableStream` → 影响 UI/流式复用度。(§5 1-1)
- 🟡 **三宿主 WPS JSAPI 读写撤销可用性**（Fact ③⑩ + §5 第 2 段）：VBA 模型"应该"支持，但 WPS JSAPI 子集覆盖度、网页版-vs-桌面版差异、写操作是否静默 no-op（类比 Aster 网页版需"写后回读验证"的坑）全需真机摸。
- 🟡 **localStorage 持久性**（Fact ⑦）：CEF localStorage 是否跨会话持久未实证。

**无真机不可定项（调研层明确标注，不猜）：**
- WPS 各组件 JSAPI 对 D-03 增益的**逐项**真实可用性（§4 全部 MEDIUM/LOW）。
- WPS 专业版/企业版的**具体版本要求**（社区数据偏旧，需以现行版真机为准）。
- WPS 加载项 DevTools 调试体验是否足以支撑大规模 adapter 重写调试。

**单一存疑来源（诚实标注）：** 一次检索中出现过"WPS 兼容 Office JSAPI"的零散表述，无权威来源支撑、疑为串台，**未采信**；真机第 0 段即可证伪/证实。

---

## 附：引用清单（按主题）

**WPS 官方/准官方文档**
- [WPS 加载项 Add-ins Overview（open.wps.cn）](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/wps-integration-mode/wps-addin-development/addin-overview)
- [WPS Add-on Availability（open.wps.cn）](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/jsapi/addin-api/wps-addin-availability)
- [WPS WebOffice API — 演示文稿 ActivePresentation](https://solution.wps.cn/docs/client/api/PPT/Presentation.html)
- [WPS WebOffice API — 幻灯片集合 Slides](https://solution.wps.cn/docs/client/api/PPT/Slides.html)
- [wps.PluginStorage 对象（wpscdn 官方文档镜像）](https://qn.cache.wpscdn.cn/encs/doc/office_v13/topics/WPS%20%E5%9F%BA%E7%A1%80%E6%8E%A5%E5%8F%A3/%E5%8A%A0%E8%BD%BD%E9%A1%B9%20API%20%E5%8F%82%E8%80%83/%E5%8A%A0%E8%BD%BD%E9%A1%B9%E6%95%B0%E6%8D%AE/PluginStorage%20%E5%AF%B9%E8%B1%A1.htm)
- [WPS 加载项开发说明（wpscdn 官方文档镜像）](https://qn.cache.wpscdn.cn/encs/doc/office_v8/topics/WPS%20%E5%8A%A0%E8%BD%BD%E9%A1%B9%E5%BC%80%E5%8F%91/WPS%20%E5%8A%A0%E8%BD%BD%E9%A1%B9%E5%BC%80%E5%8F%91%E8%AF%B4%E6%98%8E.html)

**WPS 社区/开发者实证**
- [WPS 加载项创建/发布/部署（CSDN）](https://blog.csdn.net/daqinzl/article/details/138747544)
- [WPS 离线加载项构建与部署（CSDN）](https://blog.csdn.net/qq506982273/article/details/138347677)
- [WPS 加载项加载流程解析（CSDN）](https://blog.csdn.net/C_jian_/article/details/144106914)
- [WPS 加载项深入开发解析（CEF 基础）（知乎）](https://zhuanlan.zhihu.com/p/266673886)
- [WPS 加载项介绍（exwps，oem.ini 安全收紧）](https://www.exwps.com/2024/03/19/wps%E5%8A%A0%E8%BD%BD%E9%A1%B9%E4%BB%8B%E7%BB%8D/)
- [WPS 表格 JSAPI（含数据透视表）（WPS 社区）](https://bbs.wps.cn/topic/40878)
- [WPS PPT VBA 自动化教程（CSDN）](https://blog.csdn.net/tgzssir/article/details/129420147)
- [opencode-wps 开源 WPS 插件（GitHub）](https://github.com/lnxsun/opencode-wps)
- [金山 WPS 客户端 JSAPI 加载项集成文档（致远）](https://open.seeyoncloud.com/v5devCTP/1842/1851/1852.html)

**两路线不兼容 / COM 兼容性**
- [公文排版助手开发计划（两路线不兼容 + 适配层理论）](https://xkonglong.com/wordaddfuture/)
- [C# 开发 Office 和 WPS COM 加载项（CLSID 共用）（博客园）](https://www.cnblogs.com/BluePointLilac/p/18802868)

**微软对照（Office.js / manifest / 存储）**
- [Office Add-ins manifest（Microsoft Learn）](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/add-in-manifests)
- [Referencing office.js from CDN（Microsoft Learn）](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/referencing-the-javascript-api-for-office-library-from-its-cdn)
- [Persist add-in state（partitioned localStorage + partitionKey）（Microsoft Learn）](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/persisting-add-in-state-and-settings)

**内核 / CORS 通用**
- [Chromium WebView CORS 行为文档](https://chromium.googlesource.com/chromium/src/+/HEAD/android_webview/docs/cors-and-webview-api.md)
- [MDN — 跨源资源共享 CORS](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Guides/CORS)

---

*WPS-01 调研报告完成于 2026-06-05。本报告交付"初步信号 + 真机清单"，不含真机结论（WPS-02 延后，D-01）。最终 go/no-go 裁定待用户在 Windows+WPS 照本报告 §5 清单实测后产出。*
