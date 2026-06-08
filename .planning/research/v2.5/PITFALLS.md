# Pitfalls Research

**Domain:** WPS Windows Desktop Add-in (v2.5 滩头堡 — porting Aster React/SSE/localStorage agent to wpsjs)
**Researched:** 2026-06-08
**Confidence:** MEDIUM (architecture facts HIGH; CEF-specific behavior MEDIUM; write-op gotchas LOW until real-machine)

> **读者注意：** 本文件直接衔接 `25-WPS-01-REPORT.md` 的四个高危面（CEF CSP/CORS、CEF 内核版本、JSAPI read/write/undo 可用性、localStorage 持久性），将其转化为**实施层防坑**。每条陷阱标注了"哪个 WPS-02 清单项能证伪它"和"哪个里程碑 Phase 要处理它"。

---

## Critical Pitfalls（产品死亡级）

### Pitfall 1: CEF 容器 CSP/CORS 拦截直连 fetch → 无后台模型在 WPS 内挂掉

**What goes wrong:**
Aster 的核心价值链是"用户浏览器直连 DeepSeek/aihubmix SSE + Pexels 图片"，零后台。若 WPS 加载项容器在加载项页面上注入了严格的 `Content-Security-Policy`（尤其是 `connect-src 'self'`），或者 CEF 以非标准方式处理跨域请求，所有 `fetch` 调用将被浏览器层静默拒绝（HTTP 400 模拟响应），SSE 流无从建立，DeepSeek 调用全挂。整个 agent loop 无法运行。

**Why it happens:**
WPS 加载项有权在加载项 `index.html` 的 HTTP 响应头中注入 CSP，或通过 CEF 层全局 CSP 覆盖。WPS-01 调研发现 WPS 加载项容器的实际 CSP 策略**在文档中未披露**。Office for Web 的同类 CSP 问题在 Aster v2.2 Pexels CORS 验证中已被实证（双重 CORS 放行），但 WPS 不是 Office for Web。CEF 在某些嵌入式配置（如 `webRequest` 拦截）下会叠加额外限制。

**How to avoid:**
1. **WPS-02 清单第 1-2 项（最高优先）：** 在最小 `wpsjs` spike 加载项中直接 `fetch` DeepSeek `/chat/completions`（`stream:true`，BYO key），观察是否拿到 `text/event-stream` 响应还是被拦截。同时 `fetch` aihubmix 生图接口 + Pexels 检索（1-3 项）。
2. **DevTools 检查：** ALT+F12 打开调试器 → Network 面板 → 观察 CORS preflight 和 CSP 错误（`Refused to connect to ...`）。
3. **若被拦截：** 在加载项 `index.html` 的响应头显式设置宽松 CSP（`connect-src * https://api.deepseek.com https://api.aihubmix.com https://api.pexels.com`），或在 `wpsjs publish` 服务器的 Nginx/Apache 配置中加头。若 WPS 容器级 CSP 不可覆盖，则**无后台模型在此平台不可行**，里程碑必须升级为 GO-NO（整个 v2.5 叫停）。
4. **备用：** Cloudflare Worker proxy（已在项目记忆 `project_no_backend_status` 预备），仅在 WPS CSP 确实不可绕过时启用，但这会引入后台依赖——应作为最后手段并在里程碑内明确决策。

**Warning signs:**
- DevTools Console 出现 `Refused to connect to 'https://api.deepseek.com'...`
- Network 面板中 preflight OPTIONS 请求返回 400/blocked
- `fetch` 调用无报错但 `response.body` 为 null

**Phase to address:**
**WPS-02 真机验证（硬门）— 清单第 1-2、1-3 项。** 必须在任何 adapter 重写之前坐实。若失败，整个 v2.5 滩头堡停工，升级为 no-go。

---

### Pitfall 2: CEF 内核版本过旧 → React 19 / ReadableStream / ES2020+ 无法运行

**What goes wrong:**
WPS 加载项的 CEF 内核版本随 WPS 构建而异，文档未披露具体版本号。若内嵌 Chromium 版本过低（如 Chromium < 80），`ReadableStream`（SSE 流解析核心）、`Promise.allSettled`、`globalThis`、可选链（`?.`）、空值合并（`??`）等 ES2020+ 特性不可用，React 19 也无法运行（需要 Chromium 94+）。整个前端 UI 层和 SSE 流式解析层崩溃。

**Why it happens:**
CEF 版本号在 WPS 官方文档中无记录。社区类比（FiveM 平台案例）显示"应用内嵌旧 CEF 导致现代 Web 特性不可用"是有据可查的嵌入式 CEF 痛点模式。WPS-01 调研定性"内核=CEF/Chromium 确认 HIGH，具体版本=未知-需真机"。

**How to avoid:**
1. **WPS-02 清单第 1-1 项（第一个执行的命令）：** 加载项 DevTools（ALT+F12）→ Console → 执行 `navigator.userAgent`，记录 `Chrome/XX` 版本号。
2. **特性探测脚本（优于 UA 判断）：** 在同一 Console 执行以下探测，全通才 go：
   ```js
   // ES2020+ 特性探测
   const ok = [
     typeof ReadableStream !== 'undefined',           // SSE 核心
     typeof globalThis !== 'undefined',               // React 19 依赖
     typeof Promise.allSettled === 'function',        // ES2020
     (() => { try { return !!eval('null?.x'); } catch(e) { return false; } })(), // optional chaining
   ];
   console.log('feature check:', ok, ok.every(Boolean) ? 'PASS' : 'FAIL');
   ```
3. **若版本过低（< Chromium 80）：** 无法在 WPS 当前版本上运行 Aster，**必须要求用户升级 WPS 到最新专业版**（截至 2026 年，WPS 最新专业版内嵌 CEF 应≥ Chromium 100）。如升级仍不通，整个 v2.5 no-go。
4. **构建降级备选（不推荐，成本高）：** 若 Chromium 版本在 Chromium 70-89 区间，可用 Vite 降级 target 到 `es2019` + `@babel/plugin-transform-optional-chaining` 等 polyfill，但需额外 build 配置分支，且 React 19 本身不支持 Chromium < 70。

**Warning signs:**
- `navigator.userAgent` 显示 `Chrome/7x` 或 `Chrome/8x`
- Console 出现 `ReadableStream is not defined`
- 加载项页面空白 / React hydration 报错

**Phase to address:**
**WPS-02 真机验证（硬门）— 清单第 1-1 项，必须是验证序列的第一步。** 若版本不达标，在 WPS 升级前无需继续后续验证项。

---

## Critical Pitfalls（适配层重写死亡级）

### Pitfall 3: WPS JSAPI 写操作静默失败（无异常、无回调错误码）

**What goes wrong:**
WPS JSAPI 属性写操作在目标对象状态异常时（文档未激活、权限不足、API 子集未覆盖），**不抛出 JS 异常，也不返回错误对象**，而是静默 no-op。这与 Aster 在 Office for Web 上踩过的 "write-then-readback verify" 坑（详见项目记忆 `project_ppt_officejs_gotchas` + `project_excel_adapter_gotchas`）是同一类陷阱，但在 WPS 上更隐蔽，因为 WPS JSAPI 对象属性写错**连 console 报错也没有**。

**Why it happens:**
WPS JSAPI 设计源于 VBA 对象模型，VBA 传统上对属性赋值采用"尽力执行"策略（不能改就忽略）。搜索结果中开发者明确指出"属性写操作 silent fail"并建议"写后立即回读验证"。与 Office for Web 不同，WPS 没有 `isSetSupported` 等版本门控机制，API 子集覆盖度隐性不透明。

**How to avoid:**
1. **所有 WPS JSAPI 写操作必须跟随立即回读：** 仿照 Aster 现有 `project_ppt_officejs_gotchas` 守门规则——写操作后立即读回该属性值与期望值比对，不等于则上报 `{ok:false, code:'WRITE_NOOP', ...}`。
   ```js
   // 示例：WPS PPT 设置形状文字后回读
   shape.TextFrame.TextRange.Text = "新标题";
   const actual = shape.TextFrame.TextRange.Text;
   if (actual !== "新标题") {
     return { ok: false, code: 'WRITE_NOOP', hint: 'WPS JSAPI write silently no-op' };
   }
   ```
2. **WPS-02 清单第 2 段（2-P2/2-E2/2-W2）：** 三宿主写操作验证时，必须加回读断言，而非仅"调用无报错就算通"。记录哪些写操作在 WPS 上静默 no-op。
3. **新建 WPS adapter 时，所有 write 方法默认带回读门控：** 在 `WpsAdapter`（新建）的 base class 加 `assertWriteResult(expected, actual, opName)` 工具函数，结构化 error 复用现有 `{code, message, recoverable, hint}` 契约。
4. **callback 模式的调用不能假设同步：** WPS JSAPI 的管理类接口（`WpsAddonMgr.*`）是显式 callback 风格；部分写操作可能也是异步 callback 而非 Promise（社区案例显示混用）。若 adapter 使用 `async/await`，必须先确认目标 API 是 Promise-based 还是 callback-based，不能混用。

**Warning signs:**
- WPS-02 真机验证：写操作 DevTools 无报错，但回读值与期望不符
- agent loop 执行 write tool 成功（LLM 得到 `ok:true`），但文档内容无变化

**Phase to address:**
**WPS-02 真机验证（第 2 段）** — 发现哪些写操作静默 no-op。**滩头堡 Phase（wpsjs 外壳 + 单宿主适配）** — 每个 write 方法建立时加回读守门，纳入 integration test 守门（仿照 `operationLog.integration.test`）。

---

### Pitfall 4: 宿主识别入口写错 — `Office.onReady` 在 WPS 静默不触发，页面白屏

**What goes wrong:**
Aster `src/main.tsx` 第一步就是 `Office.onReady(info => createAdapter(info.host))`。在 WPS 内，`Office` 全局对象即使通过 CDN 加载了 office.js 脚本，运行时桥接也不会初始化，`onReady` 回调**永远不触发**。结果：React 应用挂载失败，页面永久白屏，没有任何报错。

**Why it happens:**
WPS 无 Office.js 运行时桥接（WPS-01 Fact ②，确定性 HIGH）。CDN 脚本加载后"空转"，`Office.context` 为 undefined 或 proxy 对象但不激活。这与 Fact ① 一致。

**How to avoid:**
1. **WPS 版本完全移除 office.js CDN 依赖：** `wpsjs` 加载项的 `index.html` 不能引入 `appsforoffice.microsoft.com/.../office.js`，改用 WPS 原生 `wps_sdk.js`（由 `wpsjs` CLI 生成）。
2. **宿主识别改写：** 用 `typeof Application !== 'undefined'` + 宿主特有对象（`ActiveDocument` / `ActiveWorkbook` / `ActivePresentation`）判断宿主类型（WPS-01 调研已确认三宿主识别方式）：
   ```js
   function detectWpsHost() {
     try {
       if (typeof Application.ActiveDocument !== 'undefined') return 'wps'; // Writer
       if (typeof Application.ActiveWorkbook !== 'undefined') return 'et';  // Spreadsheet
       if (typeof Application.ActivePresentation !== 'undefined') return 'wpp'; // Presentation
     } catch (e) {}
     return 'unknown';
   }
   ```
3. **`jsplugins.xml` 的 `type` 属性：** 三宿主分别用 `type="wps"` / `type="et"` / `type="wpp"` 注册独立加载项条目，不能共用一个 type 条目跨宿主。
4. **WPS-02 证伪测试（清单第 0-2 项）：** 在 WPS 加载项 webview 里打开 Aster Task Pane URL，观察 `typeof Office` 和 `Office.onReady` 是否存在——坐实 Fact ②，记录确切表现（undefined / 超时）。

**Warning signs:**
- 加载项面板空白，DevTools 无 React root 挂载
- `console.log(typeof Office)` 输出 `undefined` 或 `'object'` 但 `onReady` 不触发
- WPS-02 0-2 测试：超过 10s 后 `Office.onReady` 回调仍未执行

**Phase to address:**
**wpsjs 外壳 Phase（滩头堡第一步）** — 这是最先要建的部分，宿主识别是所有后续代码的门。必须在任何 adapter 代码之前验证宿主识别可工作。

---

## Moderate Pitfalls（适配工程质量风险）

### Pitfall 5: localStorage 持久性不确定 — API Key 在 WPS 关闭后可能丢失

**What goes wrong:**
Aster 用 `partitioned localStorage` 存 API Key（`project_adapter_inverse_signature` 记忆）。在 WPS CEF 环境中，`localStorage` 理论上持久，但 CEF 宿主进程若采用独立用户数据目录（`--user-data-dir` 参数指向临时目录），或 WPS 在每次启动时清除 WebView 缓存，`localStorage` 会静默清空。用户重启 WPS 后 API Key 消失，需重新输入。

**Why it happens:**
WPS-01 Fact ⑦ 确认：WPS 原生 `wps.PluginStorage` 明确"非持久"（官方文档原文）。CEF `localStorage` 大概率持久但"未实证"，CEF 多进程架构中用户数据目录由宿主应用控制，WPS 可能在不同进程间共享或隔离。

**How to avoid:**
1. **WPS-02 清单第 1-4 项（localStorage 持久性测试）：** 写值 → 关 WPS → 重开 WPS → 读值，3 分钟内完成。若丢失，说明 CEF 用户数据目录每次清空。
2. **若 localStorage 不持久：** 降级到 WPS `FileSystem` API（持久化到本地文件）存 API Key。`FileSystem` 是 WPS 官方推荐持久化方案（WPS-01 Fact ⑦ 官方明确）。需要写一个 `WpsStorageAdapter`，API 不兼容标准 `localStorage`（WPS `FileSystem` 是文件 I/O 模式）。
3. **绝对不要用 `wps.PluginStorage` 存 API Key：** 官方明确关闭加载项即失效，重开后 Key 消失。
4. **Aster `src/lib/storage.ts` 已有 `partitionKey === undefined` 降级分支（WPS-01 Fact ⑦ 已分析）：** 若 CEF localStorage 可用，最小改动是让 `partitionKey` 返回一个 WPS-specific 固定前缀（`wps-aster-`），复用现有存储层逻辑。

**Warning signs:**
- WPS-02 测试：localStorage 值在 WPS 重启后消失
- 用户报告每次打开 WPS 都需要重新输入 API Key

**Phase to address:**
**WPS-02 真机验证（清单 1-4）** — 决定存储落点。**滩头堡 Phase** — 按真机结论选 CEF localStorage 或 WPS FileSystem，写入 `WpsStorageAdapter`。

---

### Pitfall 6: WPS JSAPI 参数 casing / 集合访问 / 参数占位不同于 VBA 标准

**What goes wrong:**
WPS JSAPI 虽然是 VBA 风格对象模型，但 JS 层有特定规则，直接照抄 VBA 文档写法会静默失败：
- VBA 集合可用数组下标 `Slides(1)` → JSAPI 必须用 `.Item(1)`（不带括号为 undefined）
- VBA 方法可缺省参数不写 → JSAPI 缺省参数必须用 `undefined` 占位（否则参数错位）
- VBA `Set obj = ...` 不需要 → JSAPI 不需要 `Set`，但若照抄 VBA 代码会引入语法错误

类似 Aster 在 Office for Web 上踩过的 snake_case/camelCase 不一致（`project_ppt_officejs_gotchas` 记忆），WPS JSAPI 有自己的命名/调用规范，从 VBA 文档照搬会产生无报错的静默失败。

**Why it happens:**
WPS JSAPI 是从 VBA 对象模型翻译为 JS 绑定，翻译层会引入 JS 特有约束。开发者倾向于直接参考 WPS/VBA 官方文档示例，但示例是 VBA 语法，不是 JSAPI JS 语法。知乎专栏《从 VBA 转到 JavaScript》明确列出这些差异。

**How to avoid:**
1. **WPS-02 清单第 2 段：** 每个 JSAPI 调用都在 DevTools Console 交互式验证，观察返回值（不是仅看有无报错），特别是集合访问（`.Item(1)` vs `[0]`）和多参数方法的参数顺序。
2. **建立 WPS adapter 内的命名规范表：** 仿照 Aster 现有 `normalizeToSnakeCase`，建立 WPS JSAPI 调用规范文档（`src/adapters/wps/WPS-API-NOTES.md`）——记录每个已验证 API 的 JS 正确调用形式，特别是集合访问和缺省参数。
3. **所有缺省参数用 `undefined` 显式占位：** WPS JSAPI 方法的可选参数不能省略，必须用 `undefined` 占位，否则后续参数错位导致静默失败。
4. **回读验证守门（同 Pitfall 3）：** 任何属性写操作后回读。

**Warning signs:**
- JSAPI 调用 `Slides(1)` 返回 function（被当成方法调用而非集合访问）
- 多参数方法调用结果不符合预期但无报错
- DevTools Console 中对象属性为 `undefined` 而非预期值

**Phase to address:**
**WPS-02 真机验证（第 2 段，每个 read/write 调用交互验证）。滩头堡 Phase（建 adapter 时同步建规范文档）。**

---

### Pitfall 7: `wpsjs publish` 部署流程与个人版限制导致加载项无法载入

**What goes wrong:**
WPS 个人版自 12.1.0.16910 起禁止通过修改 `oem.ini` 加载加载项（旧的离线 sideload 方式）。即使用户升级了 `wpsjs` 工具链并执行 `wpsjs publish`，publish 流程需要一个可访问的 HTTP 服务器托管 `wps-addon-build` 和 `publish.html`，纯本地文件（`file://`）不可用。若用户只有个人版（非专业版），`jsplugins.xml` 动态传递模式也可能受限。

**Why it happens:**
WPS-01 Fact ⑧ 确认：WPS 加载项 sideload 机制与微软完全不同，且个人版在 2024 年的安全收紧后限制了传统 oem.ini 路径。CSDN/exwps 社区实证一致。用户确认是"专业版"（v2.5 里程碑上下文），但专业版的具体版本号和 wpsjs 工具链版本仍需验证。

**How to avoid:**
1. **WPS-02 环境前置：** 确认 WPS 专业版版本（≥ 12.2.0.17153，规避 CVE-2024-7262/7263 漏洞，同时该版本 `wpsjs debug` 已修复）。执行 `npm install -g wpsjs` 后 `wpsjs --version` 确认工具链版本。
2. **sideload 路径选择：**
   - **开发阶段（WPS-02 验证）：** `wpsjs debug`（会自动用本地 devserver 启动并注入加载项）是最低成本验证路径，**无需外部服务器**。
   - **生产/滩头堡：** `wpsjs publish` + 本地 HTTP 服务（可用 `npx serve` 托管 `wps-addon-publish/`）→ 访问 `publish.html` 安装。或 GitHub Pages 托管（与现有 Aster Pages 分开，建 `aster-wps-addon` repo）。
3. **专业版 oem.ini 仍可用（条件性）：** 专业版通过 OEM 定制渠道部署，`JSPluginsServer` 指向本地 `jsplugins.xml` 仍可能受支持，但需真机确认。备用：升级 `wpsjs` 工具包走 publish 路径。
4. **WPS-02 清单第 0-1 项：** 尝试用任何方式加载 Aster 微软 manifest → 预期无入口，坐实机制不同。

**Warning signs:**
- `wpsjs debug` 执行后 WPS 未自动加载加载项
- `jsplugins.xml` 路径修改后 WPS 无响应（个人版安全限制）
- WPS 功能区找不到加载项入口

**Phase to address:**
**WPS-02 环境准备（验证门前的前置）。滩头堡 Phase（确立 sideload 路径后，固化部署脚本）。**

---

## Minor Pitfalls（工程质量风险）

### Pitfall 8: DevTools 调试能力受限 — ALT+F12 在任务窗格不稳定

**What goes wrong:**
WPS 加载项的 DevTools 入口是 ALT+F12（触发 WPS 调试器对话框），任务窗格和对话框可进入 DevTools；但 WPS-01 Fact ⑤ 及官方公告均记录"在 wpsjs debug 模式下，对话框和任务窗格的 DevTools 某些版本无法打开"（个人版 12.1.0.16910 起，后版本已修复）。大型 React 应用（~80KB gzip）在 CEF 调试器中 Source Map 加载缓慢，断点设置困难。

**How to avoid:**
1. **确认 WPS 版本已修复调试问题：** `wpsjs debug` 调试模式 DevTools 无法打开的问题已在 `wpsjs` 工具更新后修复——先 `npm update -g wpsjs` 再测试。
2. **加大 console.log 覆盖面：** 在所有 JSAPI 调用前后加详细 `console.log`（含调用名、参数、返回值），在 DevTools 不稳定时作为主要调试手段。
3. **建立独立 JSAPI 测试页：** 单独一个 `test.html` 只跑 JSAPI 调用，不引入 React，方便隔离问题（React 应用 + JSAPI 问题难以区分来源）。
4. **Source Map 保留：** Vite 构建加 `sourcemap: true`，便于 DevTools 中追踪 React 代码位置。

**Warning signs:**
- ALT+F12 无反应或打开空白调试器
- Console 报错消息截断（CEF 调试器行数上限）

**Phase to address:**
**WPS-02 验证阶段（环境准备确认调试可用）。滩头堡 Phase（把调试策略写入开发日志）。**

---

### Pitfall 9: 三宿主完整对等 → 范围蔓延，滩头堡变全量移植

**What goes wrong:**
WPS-01 明确"三宿主完整移植 = WPS-D1 全量，本里程碑（v2.5）只建单宿主滩头堡"。若在 WPS-02 go 后立即对齐三宿主，JSAPI 重写工作量等同"再做一遍 v2.0+v2.1 三宿主 write/read/undo"，而 WPS-02 验证只坐实了"可行性信号"，不是"三宿主全绿"。提前铺开会在真机验证未完全通过的宿主上浪费大量代码。

**How to avoid:**
1. **单宿主滩头堡严格限定：** v2.5 里程碑内只选最高价值单宿主（discuss-phase 定，候选：WPS 演示/Presentation），其余两宿主 adapter 留空（仅注册宿主识别入口，方法全部 `throw new Error('WPS-D1 reserved')`）。
2. **代码门控：** 非目标宿主在加载项启动时弹提示"此宿主计划支持，敬请期待"，不做任何功能尝试。
3. **D-02 判定保守：** 即便三宿主 JSAPI 全绿，v2.5 也不上三宿主功能；功能完整性交给 WPS-D1 里程碑。

**Warning signs:**
- PR/commit 中出现三个宿主的 adapter 实现代码
- 里程碑 ROADMAP 中出现"三宿主对齐"任务

**Phase to address:**
**里程碑 Kickoff / discuss-phase（锁定单宿主目标）。滩头堡 Phase（代码层 throw 门控）。**

---

### Pitfall 10: 字体/渲染降级 — Google Fonts 在 CEF 内无法加载

**What goes wrong:**
Aster teal 设计系统依赖 Google Fonts（Inter + Noto Sans SC + JetBrains Mono），通过单条 Google Fonts URL 在 `index.html` 加载。若 CEF 容器的 CSP 限制了 `font-src`，或用户处于无外网环境（政企用户 WPS 常见），Google Fonts 加载超时，UI 降级到系统默认字体（宋体/微软雅黑），整体观感明显下降但不影响功能。

**How to avoid:**
1. **WPS-02 清单第 1-5 项：** 验证 CEF 内 Google Fonts 是否加载，观察 Inter/Noto Sans SC 是否生效。
2. **内嵌字体备选（若 Google Fonts 受限）：** 将 Noto Sans SC 子集（常用汉字 ~200KB）内嵌为 base64 woff2，或在 `wpsjs publish` 服务器本地托管字体文件，`index.html` 改用本地字体 URL。
3. **CSS 变量兜底栈已存在：** `--font-body` 已有 `PingFang SC / 微软雅黑` 兜底，用户感知不严重，不阻 go/no-go。

**Warning signs:**
- WPS-02 DevTools Network 面板：`fonts.googleapis.com` 请求 blocked 或 timeout
- UI 字体明显变为宋体/黑体

**Phase to address:**
**WPS-02 真机验证（清单 1-5，低优先）。滩头堡 Phase（若需字体离线化，计入工时）。**

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| 共用单份 React bundle 给 Office + WPS 两个 entry | 节省构建配置 | 若 CEF 版本/特性不同，bundle target 需分叉；两端调试互相干扰 | CEF 版本经真机确认 ≥ Chromium 94 且特性全通后 |
| 先写 WPS adapter 代码、再跑真机验证 | 加快开发速度 | JSAPI 调用静默失败难以提前发现，大量代码可能需要重写 | **永不**——WPS-02 必须先绿再写大量 adapter |
| `wps.PluginStorage` 存临时状态（非持久） | API 简单直接 | 加载项重新打开时所有临时状态丢失，用户体验差 | 只用于加载项会话内传参（如宿主类型），永不存 API Key |
| 在 WPS adapter 内直接调用 `eval()` | 动态执行 WPS 宏代码灵活 | CEF CSP 可能禁止 `unsafe-eval`；代码可读性差；安全风险 | **永不** |
| 跳过 write-after-readback 验证 | 代码量少 | 写操作静默 no-op 无法被 agent loop 感知，LLM 认为成功但文档未变化 | **永不**——是 WPS adapter 必须遵循的守门规则 |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| DeepSeek SSE 流 | 假设 CEF 的 fetch+ReadableStream 与浏览器行为完全一致，直接复用 `src/lib/sse.ts` | 先跑 WPS-02 1-2 项验证，确认 SSE 流可建立；`sse.ts` 逻辑可复用，但前提是 fetch 未被 CSP 拦 |
| WPS JSAPI 集合访问 | 用 `Slides[0]` 或 `Slides(1)` VBA 写法 | 必须用 `Slides.Item(1)`（1-indexed，JS 方法调用） |
| WPS JSAPI 多参数方法 | 省略可选参数（与 VBA 行为相同） | 用 `undefined` 显式占位，否则后续参数错位 |
| `wps.PluginStorage` 宿主类型传参 | 用 PluginStorage 存 API Key（认为等同 localStorage） | PluginStorage 关闭加载项即清空，只用于同一会话内的参数传递 |
| `jsplugins.xml` 三宿主配置 | 用单个 `type="wps"` 条目覆盖三宿主 | 三宿主分别用 `type="wps"` / `type="et"` / `type="wpp"` 写三条 `<jspluginonline>` |
| Vite 构建产物部署到 wpsjs publish 服务器 | 使用 `file://` 协议直接打开 `index.html` | 必须通过 HTTP(S) 服务器托管（`npx serve dist/`），WPS 不支持 `file://` 加载加载项 |

---

## "Looks Done But Isn't" Checklist

- [ ] **CEF fetch 直连：** `fetch` 到 DeepSeek 未报错，但要确认是拿到真实 200 响应而非 `mode:'no-cors'` 的不透明响应（opaque response）——验证 `response.status === 200` 且 `response.headers.get('content-type')` 包含 `text/event-stream`
- [ ] **WPS JSAPI 写操作：** 调用无报错 ≠ 写入成功——必须回读值比对，才算该 API 真正可用
- [ ] **localStorage 持久性：** 能写入 ≠ 持久——必须关 WPS 重开后读回，才算存储落点确认
- [ ] **宿主识别：** `typeof Application.ActivePresentation !== 'undefined'` 返回 true ≠ API 可用——必须实际调用 `.Slides.Count` 等方法验证对象是真实激活状态
- [ ] **wpsjs debug 可用：** `wpsjs debug` 命令无报错启动 ≠ 加载项真正注入进了 WPS——打开 WPS 功能区确认加载项入口出现
- [ ] **三宿主全绿：** 单宿主 read/write/undo 通过 ≠ 三宿主全通——v2.5 里程碑只要单宿主，不提前做"三宿主全绿"假设

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| P1: CSP/CORS 拦截 fetch | WPS-02 真机验证（最高优先，清单 1-2/1-3） | 在 CEF DevTools 确认 SSE 流建立，HTTP 200，无 CSP 报错 |
| P2: CEF 内核版本过旧 | WPS-02 真机验证（清单 1-1，第一步） | `navigator.userAgent` Chrome 版本 + 特性探测脚本全通 |
| P3: JSAPI 写操作静默失败 | WPS-02 真机验证（清单 2 段）+ 滩头堡 adapter Phase | 每个 write 操作加回读断言；integration test 守门 |
| P4: 宿主识别白屏 | wpsjs 外壳 Phase（滩头堡第一步） | WPS 功能区出现入口 + 加载项面板正常渲染 React UI |
| P5: localStorage 不持久 | WPS-02 真机验证（清单 1-4）+ 滩头堡存储层 Phase | 关 WPS 重开后 API Key 仍在 |
| P6: JSAPI casing/集合访问错误 | WPS-02 真机验证（清单 2 段，交互验证每个 API）| DevTools 回读值与期望一致 |
| P7: wpsjs publish 部署限制 | WPS-02 环境前置准备 | `wpsjs debug` 成功，功能区出现加载项入口 |
| P8: DevTools 调试受限 | WPS-02 环境准备确认 | ALT+F12 打开 DevTools，Console 正常输出 |
| P9: 三宿主范围蔓延 | 里程碑 kickoff（discuss-phase 锁定单宿主） | v2.5 ROADMAP 只包含单宿主适配任务 |
| P10: 字体无法加载 | WPS-02 真机验证（清单 1-5，低优先）| Network 面板字体请求成功 / UI 字体符合设计系统 |

---

## Sources

- [WPS-01 调研报告 — `.planning/phases/25-wps-spike-gate/25-WPS-01-REPORT.md`](../phases/25-wps-spike-gate/25-WPS-01-REPORT.md)（WPS-01 Fact ①-⑩，所有架构性结论的一手来源）
- [WPS 加载项 Add-ins Overview（open.wps.cn）](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/wps-integration-mode/wps-addin-development/addin-overview)（CEF 基础、三宿主 type 区分）
- [WPS 加载项深入开发解析（知乎）](https://zhuanlan.zhihu.com/p/266673886)（CEF 多进程架构、调试方法）
- [近期 WPS 加载项不能调试和加载的问题说明（WPS 官方社区 bbs.wps.cn/topic/36774）](https://bbs.wps.cn/topic/36774)（oem.ini 安全收紧、wpsjs 修复路径）
- [WPS 加载项介绍（exwps.com）](https://www.exwps.com/2024/03/19/wps%E5%8A%A0%E8%BD%BD%E9%A1%B9%E4%BB%8B%E7%BB%8D/)（个人版 vs 专业版限制差异）
- [WPS 加载项创建/发布/部署（CSDN blog.csdn.net/daqinzl）](https://blog.csdn.net/daqinzl/article/details/138747544)（wpsjs publish 完整流程、版本要求 WPS Pro 11.8.2.12195+）
- [wps.PluginStorage 对象（wpscdn 官方文档镜像）](https://qn.cache.wpscdn.cn/encs/doc/office_v13/topics/WPS%20%E5%9F%BA%E7%A1%80%E6%8E%A5%E5%8F%A3/%E5%8A%A0%E8%BD%BD%E9%A1%B9%20API%20%E5%8F%82%E8%80%83/%E5%8A%A0%E8%BD%BD%E9%A1%B9%E6%95%B0%E6%8D%AE/PluginStorage%20%E5%AF%B9%E8%B1%A1.htm)（PluginStorage 非持久，官方明确）
- [WPS JSAPI 开放平台表格 JSAPI 更新（bbs.wps.cn/topic/40878）](https://bbs.wps.cn/topic/40878)（JSAPI 属性写操作 silent fail 社区实证）
- [从 VBA 转到 JavaScript（kancloud.cn）](https://www.kancloud.cn/pwedu/wps-js-macros/2259295)（集合用 .Item()、参数 undefined 占位）
- [JSAPI 总览（open.wps.cn）](https://open.wps.cn/documents/app-integration-dev/client/web-apps/JSAPI-overview.html)（wps/et/wpp 三宿主 ClientType）
- [WPS JSAPI 崩溃问题（bbs.wps.cn/topic/15633）](https://bbs.wps.cn/topic/15633)（静默崩溃无日志，调试困难）
- [Chromium Embedded Framework（Wikipedia）](https://en.wikipedia.org/wiki/Chromium_Embedded_Framework)（CEF 版本号 = 对应 Chromium major version，2019 年后）
- [FiveM CEF 版本过旧阻碍现代 Web 特性（cfx.re 社区）](https://forum.cfx.re/t/request-update-cef-chromium-embedded-framework-version-to-support-latest-web-technologies/5301767)（CEF 旧版阻碍 React 18+/ES2021+ 的类比案例）
- 项目记忆：`project_ppt_officejs_gotchas`（snake/camelCase + write-then-readback 教训）
- 项目记忆：`project_excel_adapter_gotchas`（resolveRange + op.tool dispatch 教训）
- 项目记忆：`project_no_backend_status`（无后台靠 CORS GATING，Cloudflare Worker 备用）

---
*Pitfalls research for: WPS Windows Desktop Add-in port (Aster v2.5 滩头堡)*
*Researched: 2026-06-08*
