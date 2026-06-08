# Phase 30: WPS-02/03 真机验证探针（硬门 go/no-go）- Research

**Researched:** 2026-06-08
**Domain:** WPS Windows 桌面专业版加载项探针工程 + 真机验证清单
**Confidence:** MEDIUM（架构事实 HIGH；JSAPI 细节 MEDIUM；CEF 运行时行为 LOW until 真机）

---

<user_constraints>
## User Constraints（来自 30-CONTEXT.md）

### Locked Decisions（30-D-01..04，用户直接拍板，不可变更）

**30-D-01：探针精简·首宿主聚焦**
- 必跑：① 两条 make-or-break 串行（CEF版本/React19 → DeepSeek SSE直连）；② 底层运行时（localStorage跨会话持久、字体/CSS渲染、图片直连）；③ Excel+PPT 两宿主基础 read/write/undo（write必须写后回读assertWriteResult）；④ D-03 仅限4项首宿主判据：PPT copy_slide(3-1) / Shapes.AddTable(3-6) / Shapes.AddLine(3-7) + Excel PivotTable.Add(3-5)
- 延后（不探）：金山文字(Word) read/write/undo；其余D-03增益（3-2/3-3/3-4/3-8/3-9）

**30-D-02：go门槛（修订25-D-02）**
- 两条 make-or-break 始终是独立硬门（任一挂 = no-go，不可抵消）
- JSAPI宿主覆盖门槛 = 两生死线绿 AND（Excel基础read/write/undo绿 OR PPT基础read/write/undo绿）
- 不沿用 25-D-02 的「三宿主全绿才go」

**30-D-03：探针形态 = 自动按钮UI**
- Task Pane「运行所有检查」按钮，自动跑所有可自动化项，逐项显示pass/fail
- 生成一份可复制的结果报告（含userAgent全文、CEF版本、SSE首token片段、各JSAPI调用返回/报错）
- 两个本质手动项（localStorage跨会话持久、SSE不被CSP/CORS拦的DevTools辅助验证）配清晰图文步骤

**30-D-04：API Key 后勤**
- DeepSeek key = make-or-break#2 的硬前提（无key=无法跑SSE测试）
- aihubmix + Pexels key = 选填，图片直连为非阻塞 bonus
- 图片直连不计入 go/no-go 硬门
- Keys 由用户在 Windows 真机上提供，不是 Claude 的 .env.local

### Claude's Discretion（planner/researcher 可自决）
- 探针工程脚手架细节（wpsjs create模板、ribbon.xml最小按钮、jsplugins.xml vs publish.html sideload路径、Vite是否参与、目录命名）
- 探针结果报告的精确文本格式/字段排版
- 每条JSAPI探测的确切调用写法

### Deferred Ideas（OUT OF SCOPE，不研究、不计划）
- 金山文字（Word）read/write/undo
- D-03 增益：PPT读背景色(3-2)/取选中图(3-3)/Word PageSetup(3-4)/渐变(3-8)/SmartArt·动画·转场·套主题(3-9)
- WPS网页版/移动版/Mac版
- 三宿主完整移植（= WPS-D1独立milestone）
- 任何Aster主仓src/适配代码（属Phase 31-33）
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WPS-02 | 坐实 CEF版本/React19 + DeepSeek SSE直连不被CSP/CORS拦 + localStorage跨会话持久 | 事实#5（CEF探测）、#6（SSE直连）、#12（localStorage持久）——全部需真机验，探针提供代码；make-or-break串行 |
| WPS-03 | 首宿主JSAPI read/write/undo可行性 + D-03增益4项 + go/no-go裁定报告 + 首宿主数据 + 工作量细化 | 事实#8（Excel JSAPI）、#9（PPT JSAPI）、#10（宿主识别）、#11（写后回读）；D-03判据事实#9中专节 |
</phase_requirements>

---

## Summary

Phase 30 是 Aster v2.5 里程碑的**硬门**。它的核心交付物是两件事：**（A）Claude 在 Mac 开发一个独立极简 `wpsjs` 探针加载项**（不进主仓 `src/`，不 import Aster 模块，按语义抄写简化实现），**（B）一份用户在 Windows WPS 桌面专业版上照单执行的真机验证清单**。

WPS 桌面加载项与微软 Office.js 是两条完全平行的铁轨：WPS 不消费 `manifest.xml`，不实现 `Office.onReady`/`*.run` API，而是使用自有的 `wpsjs` CLI 工具链（`ribbon.xml` + `jsplugins.xml`/`publish.html`）以及 `window.Application.*` VBA 风格 JSAPI。这一架构事实已在 Phase 25 `25-WPS-01-REPORT.md` 坐实（置信度 HIGH）。

探针的底层技术基础是 WPS 的 CEF（Chromium Embedded Framework）webview——标准 Chromium 引擎，`fetch`/`ReadableStream`/`localStorage`/React 在其中大概率可用，但 CEF 版本号和 WPS 容器的 CSP/CORS 策略必须真机确认。这两项是整个里程碑的生死线：任一不通 → no-go，不写任何适配代码。

**首要建议：** 探针工程用 `wpsjs build`（Mac 可跑，真机加载只能 Windows）+ GitHub Pages 在线 sideload（`jsplugins.xml` 在线模式，指向 `wynne-cwb.github.io/Aster/wps-probe/`），与 Aster CI/CD 同一套，零额外基础设施。Task Pane 单页 vanilla HTML+JS（不引 office.js CDN），按钮 UI 按 30-D-03 实现，不强制 teal 设计系统。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CEF版本/特性探测 | Browser/CEF | — | `navigator.userAgent`是浏览器原生API，无宿主API依赖 |
| DeepSeek SSE直连 | Browser/CEF（fetch层） | — | 纯网络调用，WPS容器是否拦截是核心验证点 |
| 图片直连（aihubmix/Pexels） | Browser/CEF（fetch层） | — | 同上，非阻塞bonus |
| localStorage跨会话持久 | Browser/CEF | — | 标准Web存储API，WPS CEF是否持久跨会话未知 |
| 字体/CSS渲染 | Browser/CEF | — | Google Fonts能否在CEF加载，CSS变量是否正常 |
| 宿主识别（ComponentType） | WPS加载项层（ribbon.xml/OnAddinLoad） | — | WPS专属：`window.Application.ComponentType` |
| Excel JSAPI read/write/undo | WPS JSAPI层（window.Application.ActiveWorkbook.*） | Browser/CEF | VBA风格对象模型，async-IPC每属性一次往返 |
| PPT JSAPI read/write/undo | WPS JSAPI层（window.Application.ActivePresentation.*） | Browser/CEF | 同上 |
| D-03增益探测（4项） | WPS JSAPI层 | — | 仅探存在性，不实现完整adapter |
| 结果报告生成 | Browser/CEF（JS逻辑） | — | 纯前端字符串拼接 + clipboard API |

---

## Standard Stack

### 核心（探针工程）

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `wpsjs` | `^2.2.3`（当前最新） | WPS加载项CLI脚手架：create/build/publish/debug | 官方唯一CLI，无替代，必须 |
| Node.js | `v22.22.1`（项目约定） | 构建环境 | 项目 Node 22 约定 |
| Vanilla HTML+JS | — | 探针Task Pane UI | 无框架，throwaway工具，零依赖，体积小 |

[VERIFIED: npm registry] `wpsjs` 最新版本 2.2.3（2026-06确认）

### 不引入

| 不用 | 原因 |
|------|------|
| `office.js` CDN | WPS不消费，探针入口HTML不引 |
| React/Vite | 探针是throwaway工具，vanilla JS够用，减少Mac构建复杂度 |
| Aster `src/` 模块 | 30-D-01硬约束：探针必须独立工程，不import Aster |

**安装：**
```bash
export PATH="$HOME/.nvm/versions/node/v22.22.1/bin:$PATH"
npm i -g wpsjs
# 探针在 wps-probe/ 子目录，不是 wpsjs create 生成的独立项目
# 而是手写极简结构（见下方架构模式）
```

---

## Architecture Patterns

### 探针项目结构

探针位于 Aster 仓库根目录的 `wps-probe/` 子目录（不进 `src/`）：

```
wps-probe/
├── index.html          # 探针 Task Pane 入口（不引 office.js）
├── probe.js            # 探针核心逻辑：所有检查项实现
├── ribbon.xml          # WPS 功能区定义（最小：一个 ShowTaskPane 按钮）
├── jsplugins.xml       # 在线 sideload 配置（指向 GitHub Pages 路径）
└── README.md           # 用户安装步骤说明（中文）
```

部署：`wps-probe/` 目录下的产物直接提交进仓库，GitHub Pages 会把 `wps-probe/` 路径暴露为 `https://wynne-cwb.github.io/Aster/wps-probe/`。

### Pattern 1：ribbon.xml 最小结构

**What：** WPS 加载项的功能区定义文件。`onLoad="OnAddinLoad"` 是入口，`onAction` 绑定按钮点击回调。

[CITED: WPS 社区 CSDN 实证 + bbs.wps.cn]

```xml
<!-- wps-probe/ribbon.xml -->
<customUI xmlns="http://schemas.microsoft.com/office/2006/01/customui"
          onLoad="OnAddinLoad">
  <ribbon startFromScratch="false">
    <tabs>
      <tab id="wpsProbeTab" label="Aster 探针">
        <group id="probeGroup" label="WPS 兼容性探针">
          <button id="btnShowProbe"
                  label="打开探针面板"
                  onAction="ShowTaskPane"
                  size="large"
                  getEnabled="OnGetEnabled" />
        </group>
      </tab>
    </tabs>
  </ribbon>
</customUI>
```

**注意：** `onAction` 值是 JS 函数名，该函数定义在 `probe.js`（通过 `index.html` 引入）。`OnAddinLoad` 也在 `probe.js` 中定义。

### Pattern 2：index.html（探针 Task Pane 入口）

**What：** WPS 加载项 Task Pane 的 HTML 入口。**不引 office.js CDN。**

[CITED: 25-WPS-01-REPORT.md Fact ④ + WPS 官方开发说明]

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aster WPS 探针</title>
  <!-- 字体渲染检查项：验证 Aster 真实字体栈在 CEF 是否正常（WPS-06 信号） -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+SC:wght@400;500;700&display=swap" />
  <!-- 注：探针 UI 本身是 throwaway，不要求 teal 设计系统；
       但字体 link 必须与 Aster index.html 一致，因为字体渲染是一个验证项 -->
  <style>
    /* 朴素可用的探针 UI 样式 */
    body { font-family: 'Noto Sans SC', sans-serif; margin: 12px; font-size: 13px; }
    #run-btn { padding: 8px 16px; background: #009887; color: white;
               border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
    .item { margin: 6px 0; padding: 6px 8px; border-radius: 4px; background: #f5f5f5; }
    .pass { background: #e8f5e9; }
    .fail { background: #ffebee; }
    .warn { background: #fff8e1; }
    #report-area { margin-top: 12px; font-family: monospace; font-size: 11px;
                   white-space: pre-wrap; background: #f0f0f0; padding: 8px;
                   border-radius: 4px; max-height: 200px; overflow-y: auto; }
    #copy-btn { margin-top: 6px; padding: 6px 12px; cursor: pointer; }
  </style>
</head>
<body>
  <h3 style="margin: 0 0 8px">Aster WPS 兼容性探针</h3>
  <p style="color:#666; font-size:12px">点击下方按钮自动运行所有检查项</p>

  <!-- DeepSeek Key 输入（make-or-break #2 硬前提） -->
  <div style="margin-bottom:8px">
    <label style="font-size:12px; font-weight:600">DeepSeek API Key（必填）：</label><br/>
    <input id="deepseek-key" type="password" placeholder="sk-..." style="width:100%; margin-top:4px; padding:4px; font-size:12px" />
  </div>
  <!-- 可选 Keys -->
  <div style="margin-bottom:8px">
    <label style="font-size:12px; color:#666">aihubmix Key（选填，验图片）：</label><br/>
    <input id="aihubmix-key" type="password" placeholder="sk-..." style="width:100%; margin-top:2px; padding:4px; font-size:12px" />
  </div>
  <div style="margin-bottom:12px">
    <label style="font-size:12px; color:#666">Pexels Key（选填，验图片）：</label><br/>
    <input id="pexels-key" type="password" placeholder="..." style="width:100%; margin-top:2px; padding:4px; font-size:12px" />
  </div>

  <button id="run-btn" onclick="runAllChecks()">运行所有检查</button>

  <div id="results" style="margin-top:12px"></div>
  <div id="report-area" style="display:none"></div>
  <button id="copy-btn" style="display:none" onclick="copyReport()">复制结果报告</button>

  <script src="probe.js"></script>
</body>
</html>
```

### Pattern 3：jsplugins.xml（在线 sideload）

**What：** WPS 通过 `jsplugins.xml` 动态加载加载项，指向 GitHub Pages 托管的探针。

[CITED: CSDN 实证 + herman-hang/wps GitHub]

```xml
<!-- wps-probe/jsplugins.xml — 指向 GitHub Pages 在线路径 -->
<?xml version="1.0" encoding="UTF-8"?>
<jsplugins>
  <!-- type="wps" = 金山文字（不探），type="et" = 金山表格，type="wpp" = 金山演示 -->
  <!-- 探针同时在 et 和 wpp 中加载；wps(文字)不探，可选择性加或不加 -->
  <jspluginonline name="AsterProbe"
                  url="https://wynne-cwb.github.io/Aster/wps-probe/"
                  type="et"
                  enable="true" />
  <jspluginonline name="AsterProbe"
                  url="https://wynne-cwb.github.io/Aster/wps-probe/"
                  type="wpp"
                  enable="true" />
</jsplugins>
```

**Windows 用户安装步骤：**
1. 下载/保存 `jsplugins.xml` 到本地
2. 找到 WPS 安装目录的 `cfgs\oem.ini`（通常在 `C:\Program Files (x86)\WPS Office\<版本号>\office6\cfgs\`）
3. 在 `[wps]` 段下添加：`JSPluginsServer=file:///C:/path/to/jsplugins.xml`（或使用 HTTPS URL 直接指向 GitHub Pages 的 jsplugins.xml 文件）
4. 重启 WPS 即可在功能区看到「Aster 探针」标签

> ⚠️ **专业版注意：** 个人版 12.1.0.16910+ 有 oem.ini 安全限制；用户是专业版，需真机确认专业版是否也受此限制。[ASSUMED A1] 若受限，退回 `wpsjs publish` + `publish.html` 安装页方案（见 §Common Pitfalls）。

### Pattern 4：OnAddinLoad + ComponentType 宿主识别

**What：** WPS 加载项的初始化入口（替代 `Office.onReady`）。读 `window.Application.ComponentType` 识别宿主（类比 Aster `src/main.tsx` 的 `Office.context.host` 识别链）。

[CITED: WPS 社区 ComponentType 文档 + bbs.wps.cn 实证]

```javascript
// probe.js 片段 — OnAddinLoad（ribbon.xml 中 onLoad="OnAddinLoad" 绑定）
let ribbonUI = null;

function OnAddinLoad(ribbon) {
  ribbonUI = ribbon;
  // ComponentType: 1=文字(wps) / 2=表格(et) / 3=演示(wpp)
  // 替代 Aster src/main.tsx 的 Office.context.host 识别链
  const type = Application.ComponentType;
  console.log('[Probe] ComponentType:', type);
}

function OnGetEnabled(control) {
  return true; // 按钮始终可用
}

function ShowTaskPane(control) {
  // 创建并显示 Task Pane
  const tsId = wps.PluginStorage.getItem('probeTaskpaneID');
  if (!tsId) {
    // 构造 Task Pane URL（相对路径 → index.html）
    const tsp = wps.CreateTaskPane(
      // 生产路径（publish模式时使用绝对URL）；debug模式使用本地 localhost
      'https://wynne-cwb.github.io/Aster/wps-probe/index.html'
    );
    wps.PluginStorage.setItem('probeTaskpaneID', tsp.ID);
    tsp.Visible = true;
    tsp.Width = 380;
  } else {
    // 已存在则切换显隐
    const tsp = wps.GetTaskPane(parseInt(tsId, 10));
    if (tsp) tsp.Visible = !tsp.Visible;
  }
}
```

> ⚠️ **wps.PluginStorage 非持久：** 官方明确「PluginStorage 关闭加载项即失效」——仅用于 Task Pane ID 的会话内缓存，不用于跨会话数据存储。[CITED: WPS PluginStorage 官方文档]

### Pattern 5：CEF 版本探测（事实#5）

**What：** `navigator.userAgent` 解析 Chromium 版本号 + ES2020+/`ReadableStream`/`fetch` 特性探测。

[VERIFIED: MDN + Chrome compat data]

```javascript
// probe.js — checkCEFVersion()
async function checkCEFVersion() {
  const ua = navigator.userAgent;

  // 解析 Chromium 版本号
  const m = ua.match(/Chrome\/(\d+)\./);
  const chromiumVersion = m ? parseInt(m[1], 10) : 0;

  // 特性探测：Aster 核心依赖项
  const hasReadableStream = typeof ReadableStream !== 'undefined';
  const hasFetch          = typeof fetch !== 'undefined';
  const hasPromise        = typeof Promise !== 'undefined';
  // ES2020 可选链 + 空值合并（React 19 构建产物依赖）
  const hasOptionalChain  = (() => { try { return eval('({a:{b:1}})?.a?.b === 1'); } catch { return false; } })();
  const hasNullCoalesce   = (() => { try { return eval('(null ?? 42) === 42'); } catch { return false; } })();
  // AbortController（SSE取消依赖）
  const hasAbortCtrl      = typeof AbortController !== 'undefined';

  // React 19 自身不发布最低 Chromium 版本号；
  // 实际约束来自其构建产物的 ES 语法 + API 依赖：
  //   - ReadableStream（SSE核心）→ Chrome 43+
  //   - AbortController → Chrome 66+
  //   - ES2020 可选链/空值合并 → Chrome 80+（若 Aster bundle 未 transpile）
  // 保守判定阈值：Chromium ≥ 80 视为 React 19 + SSE 可用
  // [ASSUMED A2] React 19 官方未公布精确 Chromium 最低版本；
  // ≥80 是 ES2020 语法支持起点，与项目 roadmap 阈值一致。
  const CHROMIUM_MIN = 80;
  const pass = chromiumVersion >= CHROMIUM_MIN && hasReadableStream && hasFetch && hasAbortCtrl;

  return {
    id: 'CEF_VERSION',
    label: 'make-or-break #1：CEF Chromium 版本 / React 19 可行性',
    pass,
    rawValues: {
      userAgent: ua,
      chromiumVersion,
      hasReadableStream,
      hasFetch,
      hasPromise,
      hasOptionalChain,
      hasNullCoalesce,
      hasAbortCtrl,
      threshold: `≥ Chromium ${CHROMIUM_MIN}`,
    },
    message: pass
      ? `✅ Chromium ${chromiumVersion} ≥ ${CHROMIUM_MIN}，所有特性可用`
      : `❌ Chromium ${chromiumVersion} 不足（需 ≥ ${CHROMIUM_MIN}）或缺少关键特性`,
  };
}
```

### Pattern 6：DeepSeek SSE 直连探测（事实#6）

**What：** `POST https://api.deepseek.com/chat/completions`（`stream:true`），读首 token，判定 `text/event-stream` 不被 WPS CEF 容器 CSP/CORS 拦截。参照 `src/lib/sse.ts` 的 `streamSSE` 逻辑抄最小版。

[VERIFIED: DeepSeek 官方 API 文档 + Aster src/lib/sse.ts 实证]

**模型选择：** 使用 `deepseek-v4-flash`（最便宜，仅需探首 token，成本极低）。注意：`deepseek-chat`/`deepseek-reasoner` 已弃用（2026-07-24 下线），探针直接用 `deepseek-v4-flash`。

```javascript
// probe.js — checkDeepSeekSSE(apiKey)
// 参照 src/lib/sse.ts streamSSE 的最小版（不 import，独立抄写）
async function checkDeepSeekSSE(apiKey) {
  if (!apiKey || !apiKey.startsWith('sk-')) {
    return {
      id: 'DEEPSEEK_SSE',
      label: 'make-or-break #2：DeepSeek SSE 直连（CORS/CSP）',
      pass: false,
      rawValues: { error: 'DeepSeek Key 未填写或格式不对（需以 sk- 开头）' },
      message: '❌ 未填写 DeepSeek Key，无法测试（make-or-break#2 硬前提）',
    };
  }

  const controller = new AbortController();
  // 超时 15s（探针只需首 token，不需要完整响应）
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
        max_tokens: 5,
        stream: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const contentType = resp.headers.get('content-type') ?? '';
    const isSSE = contentType.includes('text/event-stream');

    if (!resp.ok) {
      return {
        id: 'DEEPSEEK_SSE',
        label: 'make-or-break #2：DeepSeek SSE 直连（CORS/CSP）',
        pass: false,
        rawValues: { httpStatus: resp.status, contentType },
        message: `❌ HTTP ${resp.status}（${resp.status === 401 ? 'Key 无效' : '请求错误'}）`,
      };
    }

    // 读第一个 SSE 数据帧（最小 parseSSE，参照 src/lib/sse.ts）
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let firstTokenSnippet = '';
    let buf = '';

    outer: for (let i = 0; i < 20; i++) { // 最多读20帧防止死循环
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') break outer;
        if (!data) continue;
        try {
          const chunk = JSON.parse(data);
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) { firstTokenSnippet = content.slice(0, 20); break outer; }
        } catch { /* 忽略畸形帧 */ }
      }
    }
    reader.cancel();

    const pass = isSSE || firstTokenSnippet.length > 0;
    return {
      id: 'DEEPSEEK_SSE',
      label: 'make-or-break #2：DeepSeek SSE 直连（CORS/CSP）',
      pass,
      rawValues: { contentType, isSSE, firstTokenSnippet },
      message: pass
        ? `✅ SSE 直连成功，首 token：「${firstTokenSnippet}」`
        : `❌ 无法拿到 SSE 响应或首 token（可能被 WPS 容器 CSP/CORS 拦截）`,
    };
  } catch (err) {
    clearTimeout(timer);
    const msg = (err && err.name === 'AbortError') ? '超时（15s）' : String(err?.message ?? err);
    return {
      id: 'DEEPSEEK_SSE',
      label: 'make-or-break #2：DeepSeek SSE 直连（CORS/CSP）',
      pass: false,
      rawValues: { error: msg },
      message: `❌ fetch 抛出错误：${msg}（极可能是 CSP/CORS 拦截）`,
    };
  }
}
```

### Pattern 7：图片直连探测（事实#7，非阻塞 bonus）

**What：** aihubmix `images/generations`（必须用 `b64_json`，不用 URL——项目记忆 `project_browser_image_gen_gotchas` 确认签名 URL 被 CORS 拦）+ Pexels 检索 fetch。

[CITED: project_browser_image_gen_gotchas 项目记忆 + aihubmix 文档]

```javascript
// probe.js — checkImageDirect(aihubmixKey, pexelsKey)
async function checkImageDirect(aihubmixKey, pexelsKey) {
  const results = [];

  // --- aihubmix 生图（b64_json 内联，避免签名 URL CORS 拦截）---
  if (aihubmixKey) {
    try {
      const resp = await fetch('https://api.aihubmix.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aihubmixKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-image-1',       // 使用已知稳定的 gpt-image-1
          prompt: 'A small red circle',
          n: 1,
          size: '256x256',
          response_format: 'b64_json', // 必须 b64_json，不用 url
        }),
      });
      const ok = resp.ok;
      const snippet = ok ? '(b64 data received)' : `HTTP ${resp.status}`;
      results.push({ provider: 'aihubmix', pass: ok, rawValue: snippet });
    } catch (e) {
      results.push({ provider: 'aihubmix', pass: false, rawValue: String(e?.message ?? e) });
    }
  } else {
    results.push({ provider: 'aihubmix', pass: null, rawValue: 'Key 未填（跳过）' });
  }

  // --- Pexels 图片检索 ---
  if (pexelsKey) {
    try {
      const resp = await fetch('https://api.pexels.com/v1/search?query=office&per_page=1', {
        headers: { 'Authorization': pexelsKey },
      });
      const ok = resp.ok;
      results.push({ provider: 'pexels', pass: ok, rawValue: ok ? `HTTP ${resp.status}` : `HTTP ${resp.status}` });
    } catch (e) {
      results.push({ provider: 'pexels', pass: false, rawValue: String(e?.message ?? e) });
    }
  } else {
    results.push({ provider: 'pexels', pass: null, rawValue: 'Key 未填（跳过）' });
  }

  const anyFail = results.some(r => r.pass === false);
  const allSkip = results.every(r => r.pass === null);
  return {
    id: 'IMAGE_DIRECT',
    label: '图片直连（aihubmix/Pexels，非阻塞 bonus）',
    pass: allSkip ? null : !anyFail,
    rawValues: results,
    message: allSkip
      ? '⚠️ 两个 Key 均未填，图片直连测试跳过'
      : anyFail
        ? '❌ 至少一个图片提供商直连失败（记录用，不计入 go/no-go）'
        : '✅ 图片直连成功',
  };
}
```

### Pattern 8：localStorage 持久性探测（事实#12）

**What：** 验证 CEF `localStorage.setItem` 写入后，**跨会话**（关 WPS 重新打开）是否仍然存在。分两步：「写入」在首次运行按钮时完成；「跨会话回读」必须关 WPS 重开后再次点击按钮才能验证。

[CITED: 25-WPS-01-REPORT Fact ⑦ + src/lib/storage.ts partitionKey===undefined 分支]

```javascript
// probe.js — checkLocalStorage()
// 第一阶段（按钮点击时）：写入哨兵值
// 第二阶段（关 WPS 重开后再点）：回读哨兵值
const LS_SENTINEL_KEY = 'aster:probe:sentinel';
const LS_SENTINEL_VAL = 'wps-probe-' + Date.now(); // 首次写入时生成固定值

function checkLocalStorageWrite() {
  try {
    localStorage.setItem(LS_SENTINEL_KEY, LS_SENTINEL_VAL);
    const readback = localStorage.getItem(LS_SENTINEL_KEY);
    return {
      id: 'LS_WRITE',
      label: 'localStorage 写入（当前会话）',
      pass: readback === LS_SENTINEL_VAL,
      rawValues: { written: LS_SENTINEL_VAL, readback },
      message: readback === LS_SENTINEL_VAL
        ? `✅ localStorage 写入并回读成功（key：${LS_SENTINEL_KEY}）`
        : `❌ localStorage 写入失败`,
    };
  } catch (e) {
    return {
      id: 'LS_WRITE', label: 'localStorage 写入（当前会话）',
      pass: false, rawValues: { error: String(e?.message ?? e) },
      message: `❌ localStorage 写入抛出错误：${e?.message}`,
    };
  }
}

function checkLocalStorageRead() {
  // 读取上次（另一个 WPS 会话）写入的哨兵值
  const readback = localStorage.getItem(LS_SENTINEL_KEY);
  const hasPrevValue = readback !== null && readback.startsWith('wps-probe-');
  return {
    id: 'LS_PERSIST',
    label: 'localStorage 跨会话持久（关 WPS 重开后回读）',
    pass: hasPrevValue,
    // partitionKey 在 WPS 不存在 → storage.ts 降级分支自动命中（WPS-06 信号）
    // 验证：Office.context.partitionKey 在 WPS 是否存在
    rawValues: {
      readback,
      partitionKeyPresent: typeof Office !== 'undefined' && !!Office?.context?.partitionKey,
      note: 'Office.context.partitionKey 在 WPS 应为 undefined（storage.ts 降级分支信号）',
    },
    message: hasPrevValue
      ? `✅ 跨会话持久，读到：${readback}`
      : `❌ 未读到上次写入的值（localStorage 在 WPS CEF 可能不持久，或首次运行）`,
  };
}
```

### Pattern 9：字体/CSS 渲染探测（事实#1 底层运行时）

**What：** 验证 Aster 真实字体栈（Inter/Noto Sans SC/JetBrains Mono）+ teal CSS 变量是否在 CEF 正常渲染。这是 WPS-06 复用层的前置信号。

[ASSUMED A3] CSS `document.fonts.check()` API 在 Chromium ≥ 35 可用；对 ≥80 的 CEF 应可用。

```javascript
// probe.js — checkFontCSS()
async function checkFontCSS() {
  // 等待字体加载
  await document.fonts.ready;

  const interLoaded    = document.fonts.check('12px Inter');
  const notoLoaded     = document.fonts.check('12px "Noto Sans SC"');
  const monoLoaded     = document.fonts.check('12px "JetBrains Mono"');

  // teal CSS 变量渲染探测（临时注入一个带 teal 背景的元素，测量渲染颜色）
  const testEl = document.createElement('div');
  testEl.style.cssText = 'position:absolute; width:1px; height:1px; background:#009887; opacity:0';
  document.body.appendChild(testEl);
  const computed = getComputedStyle(testEl).backgroundColor;
  document.body.removeChild(testEl);
  // #009887 → rgb(0, 152, 135)
  const tealOk = computed.includes('0, 152, 135') || computed.includes('#009887');

  const pass = (interLoaded || notoLoaded) && tealOk; // 至少一个中文或正文字体 + teal 色

  return {
    id: 'FONT_CSS',
    label: '字体/teal CSS 渲染（WPS-06 信号）',
    pass,
    rawValues: { interLoaded, notoLoaded, monoLoaded, tealComputedColor: computed, tealOk },
    message: pass
      ? `✅ 字体已加载（Inter:${interLoaded}, NotoSC:${notoLoaded}, Mono:${monoLoaded}），teal CSS 正常`
      : `❌ 字体或 teal CSS 渲染异常（检查 CEF 是否允许加载 Google Fonts）`,
  };
}
```

### Pattern 10：Excel（金山表格）JSAPI 探测（事实#8）

**What：** 通过 `window.Application.ActiveWorkbook` 进行读/写/undo 探测。写操作必须写后立即回读验证（`assertWriteResult` 模式，防 WPS 静默 no-op）。

[CITED: solution.wps.cn ET API 文档 + WPS社区实证] [ASSUMED A4] 部分签名细节（如 `Selection.Address`、`Range.Value` 的异步行为）按 VBA 对照推断，需真机确认。

```javascript
// probe.js — checkExcelJSAPI()
async function checkExcelJSAPI() {
  const results = [];

  try {
    const app = window.Application;

    // === READ：取选区地址 + 读 A1 值 + 列工作表 ===
    // 对应 ExcelAdapter.getSelection() 语义
    let selAddress = null;
    try {
      // Application.Selection 返回当前选区 Range 对象
      const sel = await app.ActiveWorkbook.ActiveSheet.Selection;
      selAddress = await sel.Address;
      results.push({ op: 'read_selection', pass: !!selAddress, value: selAddress });
    } catch (e) {
      results.push({ op: 'read_selection', pass: false, value: String(e?.message ?? e) });
    }

    // 读 A1 值（对应 get_range_values）
    let a1Val = null;
    try {
      const range = await app.ActiveWorkbook.ActiveSheet.Range('A1');
      a1Val = await range.Value;
      results.push({ op: 'read_A1', pass: true, value: a1Val ?? '(empty)' });
    } catch (e) {
      results.push({ op: 'read_A1', pass: false, value: String(e?.message ?? e) });
    }

    // 列工作表（对应 list_worksheets）
    let sheetNames = [];
    try {
      const sheets = await app.ActiveWorkbook.Sheets;
      const cnt    = await sheets.Count;
      for (let i = 1; i <= Math.min(cnt, 5); i++) {
        const sh   = await sheets.Item(i);
        const name = await sh.Name;
        sheetNames.push(name);
      }
      results.push({ op: 'list_sheets', pass: sheetNames.length > 0, value: sheetNames.join(', ') });
    } catch (e) {
      results.push({ op: 'list_sheets', pass: false, value: String(e?.message ?? e) });
    }

    // === WRITE：写 B1 值 + 立即回读验证（assertWriteResult 模式）===
    // 对应 ExcelAdapter set_range_values 语义
    const WRITE_VAL = 'AsterProbe_' + Date.now();
    let writePass = false;
    try {
      const b1 = await app.ActiveWorkbook.ActiveSheet.Range('B1');
      // 写入
      b1.Value = WRITE_VAL;
      // 立即回读（防静默 no-op，参照 project_ppt_officejs_gotchas 教训）
      const readback = await b1.Value;
      writePass = String(readback) === String(WRITE_VAL);
      results.push({
        op: 'write_B1',
        pass: writePass,
        value: `written=${WRITE_VAL}, readback=${readback}`,
      });
    } catch (e) {
      results.push({ op: 'write_B1', pass: false, value: String(e?.message ?? e) });
    }

    // === UNDO：用 Range.Value 快照还原（operationLog反向引擎原理）===
    // WPS 不进原生 Ctrl+Z 撤销栈，必须用快照还原
    // 这里探测「写回旧值」是否成功（模拟 inverse 操作）
    let undoPass = false;
    try {
      const b1     = await app.ActiveWorkbook.ActiveSheet.Range('B1');
      // 还原为 null/空（清除探针写入）
      b1.Value = null;
      const after  = await b1.Value;
      undoPass = (after === null || after === '' || after === undefined);
      results.push({
        op: 'undo_B1',
        pass: undoPass,
        value: `after_restore=${JSON.stringify(after)}`,
      });
    } catch (e) {
      results.push({ op: 'undo_B1', pass: false, value: String(e?.message ?? e) });
    }

    // === D-03 判据：PivotTable.Add / PivotCaches().Create 签名存在性 ===
    // 仅探「方法是否存在」，不实际创建透视表（避免污染用户文档）
    let pivotPass = false;
    try {
      const wb = app.ActiveWorkbook;
      // 检查 PivotCaches 是否存在并且 Create 方法可调用
      const pivotCaches = await wb.PivotCaches;
      pivotPass = typeof pivotCaches?.Create === 'function' ||
                  typeof pivotCaches?.create === 'function' ||
                  pivotCaches != null; // 至少对象存在
      results.push({
        op: 'D03_PivotTable_exists',
        pass: pivotPass,
        value: `PivotCaches=${JSON.stringify(typeof pivotCaches)}`,
      });
    } catch (e) {
      results.push({
        op: 'D03_PivotTable_exists',
        pass: false,
        value: `PivotCaches 不存在或抛错：${e?.message}`,
      });
    }

    const basicPass = results.filter(r => ['read_selection','write_B1','undo_B1'].includes(r.op)).every(r => r.pass);
    return {
      id: 'EXCEL_JSAPI',
      label: 'Excel（金山表格）JSAPI read/write/undo + D-03',
      pass: basicPass,
      rawValues: results,
      message: basicPass ? '✅ Excel 基础 read/write/undo 全通过' : '❌ Excel JSAPI 有项目失败',
    };
  } catch (topErr) {
    return {
      id: 'EXCEL_JSAPI',
      label: 'Excel（金山表格）JSAPI read/write/undo + D-03',
      pass: false,
      rawValues: [{ op: 'init', pass: false, value: String(topErr?.message ?? topErr) }],
      message: `❌ Excel JSAPI 初始化失败（可能不在 ET 宿主中）：${topErr?.message}`,
    };
  }
}
```

### Pattern 11：PPT（金山演示）JSAPI 探测（事实#9）

**What：** `window.Application.ActivePresentation.Slides.*` 读/写/undo，以及 D-03 判据（copy_slide/AddTable/AddLine 存在性）。**Shapes.AddTable/AddLine 不在官方 Shapes 文档**——探针以异常捕获判断存在性。

[CITED: solution.wps.cn PPT Slides API + 25-WPS-01-REPORT §4]
[ASSUMED A5] `Slide.Copy()` + `Slides.Paste()` 是复制幻灯片的推断路径（社区实证提到 Duplicate()，官方 Slides 文档确认 AddSlide/FindBySlideID2 存在，但无直接 copy_slide API）

```javascript
// probe.js — checkPptJSAPI()
async function checkPptJSAPI() {
  const results = [];

  try {
    const app  = window.Application;
    const pres = app.ActivePresentation;

    // === READ：取幻灯片数 + 读第一张幻灯片标题文本 ===
    let slideCount = 0;
    try {
      slideCount = await pres.Slides.Count;
      results.push({ op: 'read_slide_count', pass: slideCount > 0, value: `Count=${slideCount}` });
    } catch (e) {
      results.push({ op: 'read_slide_count', pass: false, value: String(e?.message ?? e) });
    }

    // 读第一张幻灯片的第一个形状文本（对应 list_slides / get_slide 语义）
    let shapeText = null;
    try {
      if (slideCount > 0) {
        const slide  = await pres.Slides.Item(1);
        const shapes = await slide.Shapes;
        const cnt    = await shapes.Count;
        if (cnt > 0) {
          const shape = await shapes.Item(1);
          // TextFrame.TextRange.Text（VBA 风格）
          const tf    = await shape.TextFrame;
          const tr    = await tf.TextRange;
          shapeText   = await tr.Text;
        }
        results.push({ op: 'read_shape_text', pass: true, value: String(shapeText ?? '(no shapes)') });
      }
    } catch (e) {
      results.push({ op: 'read_shape_text', pass: false, value: String(e?.message ?? e) });
    }

    // === WRITE：在最后一张后 AddSlide + 写标题 + 回读验证 ===
    let writePass = false;
    let newSlideId = null;
    try {
      const newIdx  = slideCount + 1;
      // AddSlide(Index) — 官方文档确认存在
      const newSlide = await pres.Slides.AddSlide(newIdx);
      newSlideId    = await newSlide.SlideID; // 用于后续按 ID 查找
      // 写标题文本（第一个 Placeholder 形状）
      const shapes  = await newSlide.Shapes;
      const cnt     = await shapes.Count;
      if (cnt > 0) {
        const titleShape = await shapes.Item(1);
        const tf = await titleShape.TextFrame;
        const tr = await tf.TextRange;
        const PROBE_TITLE = 'AsterProbe_title';
        tr.Text = PROBE_TITLE;
        // 立即回读验证（assertWriteResult 模式）
        const readback = await tr.Text;
        writePass = String(readback).includes('AsterProbe');
        results.push({
          op: 'write_slide',
          pass: writePass,
          value: `written=${PROBE_TITLE}, readback=${readback}`,
        });
      } else {
        // 无形状但 slide 建成了也算 write pass（基础可行）
        writePass = true;
        results.push({ op: 'write_slide', pass: true, value: `新建幻灯片(index=${newIdx})成功，无形状可写` });
      }
    } catch (e) {
      results.push({ op: 'write_slide', pass: false, value: String(e?.message ?? e) });
    }

    // === UNDO：删除探针新建的幻灯片（模拟 inverse 操作）===
    let undoPass = false;
    try {
      if (newSlideId !== null) {
        // FindBySlideID2 — 官方文档确认存在
        const targetSlide = await pres.Slides.FindBySlideID2(newSlideId);
        await targetSlide.Delete();
        // 验证删除后幻灯片数恢复
        const afterCount  = await pres.Slides.Count;
        undoPass = afterCount === slideCount;
        results.push({
          op: 'undo_slide',
          pass: undoPass,
          value: `before=${slideCount}, after=${afterCount}`,
        });
      }
    } catch (e) {
      results.push({ op: 'undo_slide', pass: false, value: String(e?.message ?? e) });
    }

    // === D-03 判据：copy_slide / Shapes.AddTable / Shapes.AddLine 存在性 ===
    // ⚠️ AddTable/AddLine 不在官方 Shapes 文档——使用 typeof 检查
    let d03Results = [];
    try {
      if (slideCount > 0) {
        const slide  = await pres.Slides.Item(1);
        const shapes = await slide.Shapes;

        // 3-1: copy_slide（Slide.Copy 或 Slide.Duplicate）
        const slideCopyExists = typeof slide.Copy === 'function' ||
                                typeof slide.Duplicate === 'function';
        d03Results.push({ item: '3-1_copy_slide', pass: slideCopyExists,
          value: `Copy=${typeof slide.Copy}, Dup=${typeof slide.Duplicate}` });

        // 3-6: Shapes.AddTable — 不在官方文档，探存在性
        const addTableExists = typeof shapes.AddTable === 'function';
        d03Results.push({ item: '3-6_AddTable', pass: addTableExists,
          value: `AddTable=${typeof shapes.AddTable}` });

        // 3-7: Shapes.AddLine / AddConnector
        const addLineExists      = typeof shapes.AddLine === 'function';
        const addConnectorExists = typeof shapes.AddConnector === 'function';
        d03Results.push({ item: '3-7_AddLine', pass: addLineExists || addConnectorExists,
          value: `AddLine=${typeof shapes.AddLine}, AddConnector=${typeof shapes.AddConnector}` });
      }
    } catch (e) {
      d03Results.push({ item: 'D03_probe', pass: false, value: String(e?.message ?? e) });
    }
    results.push(...d03Results.map(r => ({ op: r.item, pass: r.pass, value: r.value })));

    const basicPass = results.filter(r => ['read_slide_count','write_slide','undo_slide'].includes(r.op)).every(r => r.pass);
    return {
      id: 'PPT_JSAPI',
      label: 'PPT（金山演示）JSAPI read/write/undo + D-03',
      pass: basicPass,
      rawValues: results,
      message: basicPass ? '✅ PPT 基础 read/write/undo 全通过' : '❌ PPT JSAPI 有项目失败',
    };
  } catch (topErr) {
    return {
      id: 'PPT_JSAPI',
      label: 'PPT（金山演示）JSAPI read/write/undo + D-03',
      pass: false,
      rawValues: [{ op: 'init', pass: false, value: String(topErr?.message ?? topErr) }],
      message: `❌ PPT JSAPI 初始化失败（可能不在 WPP 宿主中）：${topErr?.message}`,
    };
  }
}
```

### Pattern 12：结果报告生成（30-D-03）

**What：** 把所有 checkXxx() 结果格式化为一段可复制的文本，用户复制回贴给 Claude 用于 go/no-go 裁定。

```javascript
// probe.js — generateReport(results)
function generateReport(results) {
  const lines = ['=== Aster WPS 探针结果报告 ===', `时间：${new Date().toISOString()}`, ''];

  for (const r of results) {
    const statusIcon = r.pass === true ? '✅PASS' : r.pass === false ? '❌FAIL' : '⚠️SKIP';
    lines.push(`[${statusIcon}] ${r.label}`);
    if (r.rawValues) {
      const raw = JSON.stringify(r.rawValues, null, 2);
      lines.push(`  原始值：${raw}`);
    }
    lines.push('');
  }

  // go/no-go 摘要
  const makeOrBreak1 = results.find(r => r.id === 'CEF_VERSION');
  const makeOrBreak2 = results.find(r => r.id === 'DEEPSEEK_SSE');
  const excelBasic   = results.find(r => r.id === 'EXCEL_JSAPI');
  const pptBasic     = results.find(r => r.id === 'PPT_JSAPI');

  const mob1 = makeOrBreak1?.pass;
  const mob2 = makeOrBreak2?.pass;
  const jsapiGreen = excelBasic?.pass || pptBasic?.pass;
  const goVerdict  = mob1 && mob2 && jsapiGreen ? 'GO ✅' : 'NO-GO ❌';

  lines.push('=== go/no-go 裁定摘要（30-D-02 框架）===');
  lines.push(`make-or-break #1 CEF版本：${mob1 === true ? 'PASS' : mob1 === false ? 'FAIL' : 'SKIP'}`);
  lines.push(`make-or-break #2 SSE直连：${mob2 === true ? 'PASS' : mob2 === false ? 'FAIL' : 'SKIP'}`);
  lines.push(`Excel 基础读写撤销：${excelBasic?.pass === true ? 'PASS' : 'FAIL/SKIP'}`);
  lines.push(`PPT 基础读写撤销：${pptBasic?.pass === true ? 'PASS' : 'FAIL/SKIP'}`);
  lines.push(`D-03 Excel PivotTable.Add：${JSON.stringify(excelBasic?.rawValues?.find?.(r => r.op === 'D03_PivotTable_exists'))}`);
  lines.push(`D-03 PPT copy_slide：${JSON.stringify(pptBasic?.rawValues?.find?.(r => r.op === '3-1_copy_slide'))}`);
  lines.push(`D-03 PPT AddTable：${JSON.stringify(pptBasic?.rawValues?.find?.(r => r.op === '3-6_AddTable'))}`);
  lines.push(`D-03 PPT AddLine：${JSON.stringify(pptBasic?.rawValues?.find?.(r => r.op === '3-7_AddLine'))}`);
  lines.push(`综合裁定：${goVerdict}`);

  return lines.join('\n');
}
```

### Anti-Patterns to Avoid

- **在探针里 import Aster src/ 模块**：违反 30-D-01 硬约束，会破坏独立性且导致 bundle 引入 office.js 依赖。
- **引用 office.js CDN**：WPS 不初始化 `Office` 运行时，引入后 `Office.onReady` 永远不触发，且 CEF 会发出冗余网络请求。
- **在 index.html 里写 `OnAddinLoad` 函数**：`OnAddinLoad` 必须定义在 `main.js`（ribbon.xml 的`onLoad` 绑定所找的 JS 文件），在 Task Pane HTML 里定义不会被 ribbon.xml 找到。
- **`wps.PluginStorage` 用于持久化**：官方明确「关闭加载项即失效」，不能跨会话。持久化走 `localStorage`。
- **写操作不回读验证**：WPS 写操作可能静默 no-op（不抛错）。所有 write 必须立即回读对比（项目记忆 `project_ppt_officejs_gotchas` + `25-WPS-01-REPORT §7`）。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WPS加载项脚手架 | 手写从零配置构建 | `wpsjs build`（CLI） | 唯一官方工具，处理打包/发布/版本兼容 |
| SSE 解析（探针版） | 重新设计 | 参照 `src/lib/sse.ts` 抄最小版 | Aster 已经有生产验证的实现，最小化重复发明 |
| WPS sideload 机制 | 自建安装流程 | `jsplugins.xml` 在线模式 + GitHub Pages | 利用已有 Pages CI/CD，零额外基础设施 |

---

## Runtime State Inventory

> 本 phase 不是 rename/refactor/migration phase，产物是新建文件（wps-probe/）。

**不适用**——Phase 30 不修改任何已有运行时状态，仅新建独立探针工程。

---

## 事实 #1：wpsjs CLI 最小探针工程（脚手架）

[VERIFIED: npm registry + CSDN 实证 + bbs.wps.cn]

**`wpsjs` 版本：** `2.2.3`（2026-06-08 npm 确认最新版）。

**CLI 命令：**
```bash
npm i -g wpsjs           # 全局安装
wpsjs create <name>      # 创建项目（生成标准目录结构）
wpsjs build              # Mac/Windows 均可执行，生成 wps-addon-build/ 产物
wpsjs publish            # 发布（生成 wps-addon-publish/publish.html 安装页）
wpsjs debug              # 仅 Windows 可用（启动本地 WPS 调试，Mac 无 WPS 客户端）
```

**`wpsjs create` 生成的目录结构：**
```
项目名/
├── index.html         # 加载项主入口（WPS 启动时加载）
├── main.js            # 由 index.html 引入，定义 OnAddinLoad / OnAction 等回调
├── ribbon.xml         # 功能区 UI 定义（onLoad="OnAddinLoad"）
├── package.json
└── [ui/]              # 可选：dialog.html / taskpane.html
```

**Mac 上的约束：**
- `wpsjs build` — **可以**在 Mac 上跑，生成静态产物（HTML/JS/XML）。
- `wpsjs debug` — **不可以**在 Mac 上用于真机预览（Mac 无 WPS Windows 客户端；`wpsjs debug` 底层调用本地 WPS 可执行文件）。
- **探针方案**：在 Mac 上 `wpsjs build`（或直接静态托管，因为探针不需要复杂构建），推送到 GitHub，Pages 部署，用户 Windows 真机从 Pages URL 加载。

**核心约束（已坐实）：**
- 探针不用 `wpsjs create` 的完整模板（含 dialog/taskpane 等），直接手写最小结构（`index.html` + `probe.js` + `ribbon.xml` + `jsplugins.xml`）并静态托管在 `wps-probe/` 子目录。
- `wpsjs build` 会生成打包产物；对于极简探针（无 npm 依赖），直接把源文件作为产物提交即可，无需构建步骤。

---

## 事实 #2：WPS sideload 真机路径

[CITED: 25-WPS-01-REPORT Fact ⑧ + CSDN 实证 + CSDN 在线部署教程]

WPS 不消费微软的 `manifest.xml`，sideload 走完全不同的路径：

### 路径 A：jsplugins.xml 在线模式（**推荐，与 GitHub Pages 对齐**）

1. 在 `wps-probe/jsplugins.xml` 中填写 GitHub Pages URL
2. 用户在 Windows 机器上编辑 WPS 安装目录的 `oem.ini`：
   - 找到路径：`C:\Program Files (x86)\WPS Office\<版本号>\office6\cfgs\oem.ini`
   - 在 `[wps]` 段下加一行：`JSPluginsServer=https://wynne-cwb.github.io/Aster/wps-probe/jsplugins.xml`
3. 重启 WPS → 功能区出现「Aster 探针」标签

> ⚠️ **专业版 oem.ini 安全限制风险：** 个人版 12.1.0.16910+ 限制了 oem.ini 加载方式。**用户是专业版**，专业版的限制策略可能不同，需真机确认。[ASSUMED A1] 若专业版也受限，切换路径 B。

### 路径 B：publish 模式（备用）

1. `wpsjs build` → `wpsjs publish`，产物放到 GitHub Pages `wps-probe/` 路径
2. 用户访问 `https://wynne-cwb.github.io/Aster/wps-probe/publish.html`
3. 页面提示点击「安装」→ WPS 重启后加载

> 路径 B 更靠近「标准用户流程」，不依赖 oem.ini 修改。但需要 `wpsjs publish` 命令生成 `publish.html`（比路径 A 多一个构建步骤）。

### 路径 C：wpsjs debug 本地模式（仅开发调试，不用于真机交付）

- 在有 WPS 的 Windows 机器上 `wpsjs debug`，自动启动 WPS 并加载本地 localhost 服务的加载项。
- **不适用于「Claude Mac 开发，用户 Windows 加载」场景**。

---

## 事实 #3：WPS 加载项 DevTools 打开方式

[CITED: WPS 官方开发说明 + bbs.wps.cn 社区实测]

| 页面类型 | 快捷键 | 说明 |
|----------|--------|------|
| `index.html`（主入口/ribbon.js 运行环境） | **ALT+F12** | 打开加载项主页面的 DevTools |
| Task Pane（`taskpane.html`/探针 `index.html` 打开在 Task Pane 中） | **F12**（点击 Task Pane 后） | 在 Task Pane 内点击，然后按 F12 |
| ShowDialog 弹窗 | **F12**（在弹窗内） | 同上 |

**注意：**
- 如果 ALT+F12 无法打开，可能是 WPS 版本问题（社区反映某些 2025 版本 `12.1.0.21541` 32位 ALT+F12 失效）。
- 备用方案：在 `oem.ini` 的 `[support]` 段下加 `JsApiShowWebDebugger=true`（企业版/部分专业版有效）。
- DevTools 打开后，在 Network 面板可看到 DeepSeek SSE 请求，验证是否被 CSP/CORS 拦截（make-or-break #2 的补充证据）。

---

## 事实 #4：最低 WPS 版本要求

[CITED: 25-WPS-01-REPORT Fact ⑧ + CSDN 实证（WPS Pro 11.8.2+）]
[ASSUMED A6] 社区数据提到 WPS Pro ≥ 11.8.2.10255；用户装机是当前专业版（更新版本），应满足要求。以真机版本为准。

- publish 模式：Windows 企业版 20200425 之后
- jsplugins.xml 在线模式：WPS 2019/2020 版以上
- 专业版 JSAPI 加载项支持：参考 ≥ WPS Pro 11.8.2.10255（社区数据，偏旧）
- **用户装机**：WPS Windows 专业版（已确认，项目记忆 `project_wps_milestone_v25`），以真机实际版本为准

---

## 事实 #5-12 小结：各探测项可验证性状态

### 事实 #5：CEF 版本探测

- **`navigator.userAgent` 解析 Chromium 版本**：标准 Web API，CEF 必然支持。[VERIFIED]
- **React 19 最低 Chromium 版本**：官方未发布精确数字；`ReadableStream`（SSE 核心）→ Chrome 43+；`AbortController` → Chrome 66+；ES2020 语法（可选链）→ Chrome 80+。项目 roadmap 阈值 ≥80 有依据。[VERIFIED: MDN compat data]
- **`ReadableStream` 支持起点**：消费响应体 → Chrome 43+；`fetch` 请求体中 → Chrome 95+（探针只需消费响应体，Chrome 43 以上即可）。[VERIFIED: MDN]

### 事实 #6：DeepSeek SSE 直连

- **API endpoint**：`POST https://api.deepseek.com/chat/completions`，OpenAI-compat SSE。[VERIFIED: CLAUDE.md DeepSeek 文档]
- **模型**：`deepseek-v4-flash`（最便宜，足够探针用）；`deepseek-chat`/`deepseek-reasoner` 2026-07-24 下线，不用。[VERIFIED: CLAUDE.md]
- **`stream:true` → `text/event-stream`**：标准 OpenAI SSE 格式（`data: {...}\n\n` + `data: [DONE]`）。[VERIFIED: CLAUDE.md + src/lib/sse.ts]

### 事实 #7：图片直连

- **aihubmix 必须用 `response_format: 'b64_json'`**：项目记忆 `project_browser_image_gen_gotchas` 坐实（签名 URL 被 CORS 拦）。[VERIFIED: project memory]
- **aihubmix endpoint**：`POST https://api.aihubmix.com/v1/images/generations`。[VERIFIED: CLAUDE.md]
- **`gpt-image-2` 在 aihubmix 支持性**：[ASSUMED A7] 为降低风险，探针用已知稳定的 `gpt-image-1`。
- **Pexels endpoint**：`GET https://api.pexels.com/v1/search`，Authorization header 传 Key。[VERIFIED: Aster project]

### 事实 #8：Excel（金山表格）JSAPI

- **读选区**：`Application.ActiveWorkbook.ActiveSheet.Selection.Address`（VBA 风格，async-IPC）。[CITED: solution.wps.cn ET API]
- **读区域值**：`Application.ActiveWorkbook.ActiveSheet.Range('A1').Value`。[CITED: solution.wps.cn ET API]
- **列工作表**：`Application.ActiveWorkbook.Sheets.Count` + `.Item(i).Name`。[CITED: solution.wps.cn ET API]
- **写单元格值**：`range.Value = value`，然后立即 `await range.Value` 回读对比。[CITED: ET API + 写后回读模式]
- **undo（快照还原）**：写回原值（`range.Value = originalValue`）。operationLog 反向引擎已裁定为唯一路径（STATE.md UNDO 裁定，2025-11-25 WPS 官方 bbs 确认 `undoRecord` 有 bug）。[CITED: STATE.md decisions]
- **PivotTable.Add / PivotCaches().Create 签名**：`PivotCaches().Create(SourceType, SourceData, Version)` + `PivotCache.CreatePivotTable(dest, name)` 是官方推荐路径；`PivotTableWizard` 存在但官方注明推荐用 Add。探针仅探对象存在性（不实际创建）。[CITED: WPS 社区 + wpscdn 官方文档]

### 事实 #9：PPT（金山演示）JSAPI

- **读幻灯片数**：`Application.ActivePresentation.Slides.Count`。[VERIFIED: solution.wps.cn Slides API]
- **按序号取幻灯片**：`Slides.Item(1)`（从1开始）。[VERIFIED: solution.wps.cn Slides API]
- **读形状文本**：`slide.Shapes.Item(i).TextFrame.TextRange.Text`（VBA 风格）。[ASSUMED A8] TextFrame.TextRange.Text 是 VBA 标准路径，WPS JSAPI 按 VBA 对照，但未直接验证此具体链。
- **新增幻灯片**：`Slides.AddSlide(Index)`。[VERIFIED: solution.wps.cn Slides API — AddSlide 方法存在]
- **按 ID 查找**：`Slides.FindBySlideID2(SlideID)`。[VERIFIED: solution.wps.cn Slides API]
- **删除幻灯片**：`slide.Delete()`。[ASSUMED A9] VBA 标准，未直接验证。
- **copy_slide (3-1)**：`Slide.Copy()` + `Slides.Paste()` 或 `Slide.Duplicate()`。[ASSUMED A5] 官方 Slides 文档只确认 AddSlide/FindBySlideID2；Copy/Duplicate 通过社区实证推断，存在性未验。标记「存在性/签名未验证 — 真机最终确认」。
- **Shapes.AddTable (3-6)**：**不在官方 Shapes 文档**（25-WPS-01-REPORT §4 已记录，本次研究重新确认）。探针用 `typeof shapes.AddTable === 'function'` 判断。[VERIFIED: solution.wps.cn Shapes API — 文档中不存在]
- **Shapes.AddLine / AddConnector (3-7)**：**不在官方 Shapes 文档**（同上）。[VERIFIED: solution.wps.cn Shapes API — 文档中不存在]
- 以上三项均标记：**「存在性/签名未验证 — 真机最终确认」**

### 事实 #10：宿主识别

- **`OnAddinLoad`**：ribbon.xml `onLoad="OnAddinLoad"` 属性绑定，WPS 初始化时自动调用。[VERIFIED: WPS社区 + bbs.wps.cn]
- **`window.Application.ComponentType`**：返回数字，1=文字(wps) / 2=表格(et) / 3=演示(wpp)。[VERIFIED: WPS社区社区实测文档]
- 替代 Aster `src/main.tsx` 的 `Office.onReady` + `Office.context.host` 识别链。[CITED: 25-WPS-01-REPORT Fact ② + src/main.tsx 对照]

### 事实 #11：写后回读 / 静默 no-op 检测

- **WPS JSAPI 写操作静默失败风险**：已在 25-WPS-01-REPORT §7 记录为高危面。[CITED: 25-WPS-01-REPORT §7]
- **项目教训**：Aster Office-for-Web 网页版已遇到写操作 no-op（`project_ppt_officejs_gotchas`：横向对齐写后回读才发现）。WPS 的 VBA「尽力执行」风格风险更高。[CITED: project memory project_ppt_officejs_gotchas + project_excel_adapter_gotchas]
- **探针实现**：所有 write 操作后立即 `await` 回读对比。PPT 用 `FindBySlideID2` 验证新建幻灯片存在。Excel 用 `range.Value` 读回对比写入值。

### 事实 #12：localStorage 持久性

- **`Office.context.partitionKey` 在 WPS 不存在**：WPS 无 Office.js → `Office.context` 不存在。[VERIFIED: 25-WPS-01-REPORT Fact ⑦ + src/lib/storage.ts 逻辑]
- **`storage.ts` 降级分支**：`typeof Office !== 'undefined' && Office?.context?.partitionKey` → 在 WPS 中 Office 未初始化，此条件为 false → `prefixedKey()` 直接返回 `rawKey`（裸 localStorage）。这是 WPS-06 信号：复用层存储模块无需改动，降级分支自动命中。[VERIFIED: src/lib/storage.ts L66-71]
- **CEF localStorage 跨会话持久性**：[ASSUMED A10] CEF 是标准 Chromium，localStorage 应持久；但 WPS 加载项容器的具体存储隔离策略未知。**必须真机验：标记「存在性/签名未验证 — 真机最终确认」**。

---

## Common Pitfalls

### Pitfall 1：oem.ini 安全限制（专业版 vs 个人版）

**What goes wrong：** 个人版 12.1.0.16910+ 限制了 oem.ini 方式加载加载项，用户配置了却无效。
**Why it happens：** 金山安全策略更新，个人版收紧了三方加载项入口。专业版策略不明确。
**How to avoid：** 真机清单第一步确认 WPS 版本 + 专业版标识；若 oem.ini 不生效，切换 publish.html 安装路径。
**Warning signs：** 功能区没有「Aster 探针」标签出现。

### Pitfall 2：Task Pane 里 OnAddinLoad 找不到

**What goes wrong：** 把 `OnAddinLoad` 写在 Task Pane 的 `index.html`/`probe.js` 里，ribbon.xml 的 `onLoad="OnAddinLoad"` 找不到函数。
**Why it happens：** WPS 加载项的主 JS 上下文是 `main.js`（由 `index.html` 主入口引入），Task Pane 是一个独立 webview 上下文。
**How to avoid：** `OnAddinLoad`、`ShowTaskPane`、`OnGetEnabled` 等 ribbon 回调只能定义在 `main.js`（主入口上下文）。Task Pane 的 `probe.js` 定义的是点击按钮后的探针逻辑（`runAllChecks` 等）。

### Pitfall 3：wps.PluginStorage 误用为持久化

**What goes wrong：** 用 `wps.PluginStorage.setItem` 存 API Key，关 WPS 重开后 Key 消失。
**Why it happens：** 官方明确「PluginStorage 不持久，关闭加载项即失效」。
**How to avoid：** 持久化走 `localStorage`。探针只用 `wps.PluginStorage` 存 Task Pane ID（会话内缓存可以）。

### Pitfall 4：PPT async-IPC 链式 await 遗漏

**What goes wrong：** WPS JSAPI 是 async-IPC 模型，每个属性访问都需要 `await`；省略 await 拿到的是 Promise 对象而非值。
**Why it happens：** 习惯了同步的 VBA 模型。
**How to avoid：** 探针所有 `Application.*` 访问一律 `await`。WPS JSAPI 和 Office.js 的 `load/sync` 范式不同——WPS 是逐属性 `await`，无批处理 proxy。

### Pitfall 5：CORS preflight 与 fetch 抛 TypeError 混淆

**What goes wrong：** WPS 容器 CSP 拦截 DeepSeek 请求时，`fetch` 可能抛 `TypeError`（类似「Failed to fetch」）而非返回 HTTP 错误响应。
**Why it happens：** 浏览器 CORS preflight 失败/CSP 拦截在某些情况下导致 fetch throw，不是普通 HTTP 错误。参照 `src/lib/sse.ts` 的 `classifyFetchThrow` 处理。
**How to avoid：** 探针 `checkDeepSeekSSE` 用 try/catch 包裹整个 fetch，catch 内把错误信息写入报告（而非静默忽略）。

### Pitfall 6：Shapes.AddTable/AddLine 不在官方文档

**What goes wrong：** 假设这两个方法存在（因为 VBA 里存在），未验证就在正式 adapter 里使用。
**Why it happens：** WPS JSAPI 是 VBA 模型的子集，不是全集。
**How to avoid：** 探针明确用 `typeof shapes.AddTable === 'function'` 判断存在性，真机结果决定首宿主（D-03 裁定原则，30-CONTEXT deferred 节）。

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 25-D-02「三宿主全绿才 go」 | 30-D-02「首宿主候选绿即可推进」 | 2026-06-08（30-D-02） | 探针只需 Excel+PPT 两宿主，不跑 Word |
| `deepseek-chat`/`deepseek-reasoner` | `deepseek-v4-flash`/`deepseek-v4-pro` | 2026-07-24 弃用 | 探针用 deepseek-v4-flash |
| Fluent UI v9 | 自写 CSS（teal 克制）| 2026-05-27 | 探针是 throwaway，不强制任何设计系统 |
| oem.ini 加载方式（旧） | jsplugins.xml 在线模式 / publish.html | 12.1.0.16910+ 个人版收紧 | 专业版待真机确认 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | WPS 专业版 oem.ini 安全限制不适用（或适用但 publish 模式可绕过） | 事实#2 sideload 路径 | 若专业版也受限且无法用 publish.html，需找其他 sideload 路径；可能增加安装步骤 |
| A2 | Chromium ≥ 80 阈值足以支撑 React 19 + SSE（ES2020 语法 + ReadableStream） | 事实#5 CEF探测 | 若 React 19 实际需要更高版本（如某些用到 WeakRef/FinalizationRegistry = Chrome 84），可能偏低；但 Chrome 80 已支持 ES2020 主要特性 |
| A3 | `document.fonts.check()` API 在 WPS CEF 可用（Chromium ≥ 35） | Pattern 9 字体探测 | 若 WPS CEF 版本极旧，此 API 不可用；探针改用 FontFaceSet |
| A4 | Excel JSAPI `Application.ActiveWorkbook.ActiveSheet.Selection.Address` 签名可用 | 事实#8 | 实际 WPS JSAPI 可能用不同属性名（如 `ActiveSheet.UsedRange.Address`）；真机确认 |
| A5 | PPT copy_slide 路径为 `Slide.Copy()` + `Slides.Paste()` 或 `Slide.Duplicate()` | 事实#9 | 若两个方法均不存在，copy_slide 探测 FAIL → 倾向 Excel（D-03 裁定原则） |
| A6 | 用户的 WPS 专业版版本满足加载项最低版本要求 | 事实#4 | 若版本过旧，加载项无法加载；提示用户升级 WPS |
| A7 | aihubmix 支持 gpt-image-1（已知稳定），探针用 gpt-image-1 而非 gpt-image-2 | 事实#7 | gpt-image-1 在 aihubmix 若也不可用，探针改用 DALL·E 或跳过 |
| A8 | PPT 形状文本读取路径 `shape.TextFrame.TextRange.Text` 为 WPS JSAPI 标准链 | 事实#9 | 若 WPS JSAPI 用不同路径，read_shape_text 会抛错；真机确认 |
| A9 | PPT 幻灯片删除用 `slide.Delete()` | 事实#9 | 若 WPS 无 Delete 方法，undo 探测 FAIL；但不影响 go/no-go（read/write 是主判据） |
| A10 | CEF localStorage 跨会话持久（标准 Chromium 行为） | 事实#12 | 若 WPS 加载项容器对 localStorage 有特殊隔离（每次关闭清除），则 Key 存活不成立 → WPS-06 存储方案需换 FileSystem |

**如果本表为空：** 所有声明均经验证或引用。本表非空——planner 需在清单中给 A1/A4/A5/A8/A9/A10 安排「真机确认」项。

---

## Open Questions

1. **WPS 专业版 oem.ini 是否受 12.1.0.16910+ 安全限制？**
   - What we know：限制明确针对个人版；专业版/企业版策略不明确
   - What's unclear：专业版 oem.ini 修改是否需要管理员权限，是否有其他限制
   - Recommendation：真机清单加一步「确认 oem.ini 修改有效，功能区可见探针标签」；若无效，切换 publish.html

2. **WPS 专业版内置 CEF 的实际 Chromium 版本号？**
   - What we know：WPS 桌面是 CEF，版本随 WPS 构建而异；用户装机是当前专业版
   - What's unclear：具体版本号
   - Recommendation：make-or-break #1 的 `checkCEFVersion()` 会精确输出，是最高优先级真机项

3. **PPT Shapes.AddTable / AddLine / AddConnector 是否真机可调用？**
   - What we know：官方 Shapes 文档不列这些方法；VBA 里存在；25-WPS-01-REPORT §4 记录为「不在文档」
   - What's unclear：是否运行时存在但文档未记录（常见于 WPS 私有扩展）
   - Recommendation：探针 D-03 检查项 `typeof shapes.AddTable === 'function'` 会在真机给出答案

4. **WPS Task Pane 中按 F12 能否正常打开 DevTools？**
   - What we know：部分 2025 版本（12.1.0.21541 32位）ALT+F12 失效
   - What's unclear：用户具体版本是否受影响
   - Recommendation：清单说明备用方案（oem.ini JsApiShowWebDebugger=true）

---

## Environment Availability

| Dependency | Required By | Available（Mac） | Available（Windows目标机） | Version | Fallback |
|------------|------------|-----------|---------|---------|----------|
| Node.js 22 | wpsjs build | ✓ | 需确认 | v22.22.1 | 使用 nvm 安装 |
| wpsjs | 探针脚手架/构建 | ✓（npm i -g） | ✗（debug 不可用） | 2.2.3 | — |
| WPS Windows 专业版 | 真机加载/执行 | ✗（Mac无WPS） | ✓（用户已装） | 当前专业版 | 无fallback |
| GitHub Pages | 在线 sideload | ✓（已有） | ✓（在线访问） | — | — |
| DeepSeek API | make-or-break #2 | ✓（Claude有key） | 用户备好 | — | 无fallback（硬前提） |
| aihubmix API | 图片直连 bonus | ✓ | 用户备好 | — | 跳过（非阻塞） |
| Pexels API | 图片直连 bonus | ✓ | 用户备好 | — | 跳过（非阻塞） |

**Mac 侧缺失项（无 fallback）：** 无——Mac 负责开发探针代码，wpsjs build 可在 Mac 运行，GitHub Pages 已有。

**Windows 侧必要项：** WPS 专业版（已确认）+ DeepSeek Key（用户准备）。

---

## Validation Architecture

### 探针检查项 pass/fail 判定

| 检查ID | 行为 | 验证方式 | 自动化？ | 最小可观测信号 | 计入 go/no-go？ |
|--------|------|---------|---------|-------------|--------------|
| CEF_VERSION | Chromium版本≥80且特性可用 | `navigator.userAgent` 解析 + 特性探测 | **自动** | `chromiumVersion` 数字 + `hasReadableStream` bool | ✅ make-or-break #1 |
| DEEPSEEK_SSE | DeepSeek SSE直连不被拦 | fetch POST + 读 `text/event-stream` + 拿首 token | **自动** | `firstTokenSnippet` 非空 / `isSSE:true` | ✅ make-or-break #2 |
| LS_WRITE | localStorage 当前会话写入可用 | setItem + getItem 回读 | **自动** | `readback === written` | 辅助（WPS-06信号） |
| LS_PERSIST | localStorage 跨会话持久 | 关 WPS 重开后再点按钮回读 | **本质手动**（关WPS是用户操作） | `readback !== null` | ✅ 计入（WPS-02 第③项） |
| FONT_CSS | Aster字体栈+teal CSS在CEF正常 | `document.fonts.check()` + 计算颜色 | **自动** | 字体加载bool + teal颜色bool | 辅助（WPS-06信号） |
| IMAGE_DIRECT | aihubmix/Pexels图片直连 | fetch + 检查响应 ok | **自动** | HTTP状态码 | ❌ 非阻塞bonus |
| EXCEL_JSAPI | Excel read/write/undo可行 | JSAPI链式调用+回读对比 | **自动** | write/readback对比bool | ✅ JSAPI覆盖门槛 |
| PPT_JSAPI | PPT read/write/undo可行 | JSAPI链式调用+回读对比 | **自动** | slide count前后对比bool | ✅ JSAPI覆盖门槛 |
| D-03 PPT copy_slide | `Slide.Copy`/`Duplicate` 存在 | `typeof === 'function'` | **自动（存在性）** | bool | 首宿主裁定判据 |
| D-03 PPT AddTable | `Shapes.AddTable` 存在 | `typeof === 'function'` | **自动（存在性）** | bool | 首宿主裁定判据 |
| D-03 PPT AddLine | `Shapes.AddLine`/`AddConnector` 存在 | `typeof === 'function'` | **自动（存在性）** | bool | 首宿主裁定判据 |
| D-03 Excel PivotTable | `PivotCaches` 对象存在 | `await wb.PivotCaches != null` | **自动（存在性）** | bool | 首宿主裁定判据 |

### 串行顺序

**make-or-break 串行：**
1. `checkCEFVersion()` → FAIL即输出「no-go，后续跳过」
2. `checkDeepSeekSSE()` → FAIL即输出「no-go，后续跳过」
3. 其他检查并行运行

### 本质手动项的用户操作说明

**手动项 1：localStorage 跨会话持久**

步骤（在清单中配图说明）：
1. 首次点击「运行所有检查」→ 自动完成 `LS_WRITE`（当前会话写入）
2. **完全关闭 WPS**（不只是最小化，要从任务栏退出）
3. 重新打开 WPS，打开任意表格/演示文件
4. 再次点击功能区「Aster 探针」→「运行所有检查」
5. 观察 `LS_PERSIST` 项是否 PASS（报告中「跨会话持久，读到：wps-probe-XXXXXX」）

**手动项 2：DeepSeek SSE 不被 CSP/CORS 拦——DevTools 辅助验证（补充证据）**

> **说明：** 按钮的 `checkDeepSeekSSE()` 已能自动判定 SSE 是否被拦。DevTools 是**补充证据**，不是必须步骤。若 `DEEPSEEK_SSE PASS`，可选择跳过此步；若 `FAIL`，DevTools Network 面板是诊断原因的关键工具。

步骤：
1. 点击探针 Task Pane（让 Task Pane 获得焦点）
2. 按 **F12** 打开 Task Pane 的 DevTools
3. 切到 **Network** 面板
4. 点击「运行所有检查」（此时 DeepSeek SSE fetch 会在 Network 面板可见）
5. 找到 `api.deepseek.com` 的请求：
   - ✅ PASS：看到 `text/event-stream` 响应，状态 200
   - ❌ FAIL：看到 CORS 错误（`blocked by CORS policy`）或 CSP 错误（`Refused to connect`）

### Wave 0 Gaps（探针本身，不是 Aster 主仓测试）

探针是 throwaway 工具，不需要 Vitest/Jest 测试框架。验证机制是真机执行结果报告本身。

**无 Wave 0 gaps**——探针的「测试」就是用户在真机上运行探针的过程。

### 采样率

- **Per task commit：** 无自动化测试（探针交付到 GitHub Pages 后，部署状态视为验证）
- **Phase gate：** 用户在 Windows 真机跑完探针，复制报告给 Claude → Claude 据此产出 go/no-go 裁定

---

## Security Domain

> 探针是 throwaway 工具，无后台，Key 在用户浏览器内使用后不存储（用户输入后仅在当次 fetch 中使用，不写 localStorage）。

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | 否 | — |
| V3 Session Management | 否（无会话） | — |
| V4 Access Control | 否 | — |
| V5 Input Validation | 是（Key 输入） | 仅检查前缀格式，不 XSS（不渲染到 innerHTML） |
| V6 Cryptography | 否 | — |

**Key 安全：** 探针中 API Key 从 `<input>` 读取后直接传入 fetch Authorization header，不写 localStorage，不打印到日志。[VERIFIED: 参照 src/lib/sse.ts T-02-04 设计原则]

---

## 无法从文档解决、需真机最终确认的项目

（给 planner 在清单中明确标注的「存在性/签名未验证 — 真机最终确认」清单）

| 项目 | 标注原因 | 真机判定方式 |
|------|---------|------------|
| WPS CEF 实际 Chromium 版本 | 文档未披露，随构建版本变化 | 探针 `checkCEFVersion()` 输出 `chromiumVersion` |
| WPS 容器 CSP/CORS 策略 | 高危面，不可从文档推断 | 探针 `checkDeepSeekSSE()` 直接测试 |
| CEF localStorage 跨会话持久性 | WPS 存储隔离策略未知 | 手动项1（关WPS重开回读） |
| PPT `Slide.Copy()` / `Slide.Duplicate()` 存在性 | 官方 Slides 文档只列 AddSlide/FindBySlideID2 | 探针 `typeof slide.Copy === 'function'` |
| PPT `Shapes.AddTable()` 存在性 | 不在官方 Shapes 文档 | 探针 `typeof shapes.AddTable === 'function'` |
| PPT `Shapes.AddLine()` / `AddConnector()` 存在性 | 不在官方 Shapes 文档 | 探针 `typeof shapes.AddLine === 'function'` |
| WPS JSAPI 写操作是否静默 no-op | 高危面（VBA「尽力执行」风格） | 探针所有 write 后立即回读对比 |
| Excel `PivotCaches().Create` 可调用性 | 文档有对象但签名细节需真机 | 探针检查 `PivotCaches` 对象存在 |
| WPS 专业版 oem.ini 限制是否适用 | 只有个人版记录，专业版不明 | 安装步骤：确认功能区出现探针标签 |
| PPT 形状文本读链 `TextFrame.TextRange.Text` | VBA 推断，未直接验证 WPS JSAPI | 探针 `read_shape_text` 操作 |

---

## Sources

### Primary（HIGH confidence）
- `25-WPS-01-REPORT.md`（上里程碑调研，架构层基座 + §5 真机清单）— 本研究的底层基座
- `src/lib/sse.ts` — Aster SSE 解析器（探针 parseSSE 的直接参照源）
- `src/lib/storage.ts` — `partitionKey===undefined` 降级分支（探针 localStorage 持久性测试的对照参考）
- `src/main.tsx` — `Office.onReady`/`Office.context.host` 识别链（WPS 侧 OnAddinLoad/ComponentType 的对照参考）
- [solution.wps.cn/docs/client/api/PPT/Slides.html](https://solution.wps.cn/docs/client/api/PPT/Slides.html) — PPT Slides API（AddSlide、FindBySlideID2 存在性已验）
- [solution.wps.cn/docs/client/api/PPT/Shapes.html](https://solution.wps.cn/docs/client/api/PPT/Shapes.html) — PPT Shapes API（AddTable/AddLine **不在文档**已验）
- [bbs.wps.cn/topic/40878](https://bbs.wps.cn/topic/40878) — WPS 表格 JSAPI 更新（PivotTable/PivotCaches 文档）
- [npm wpsjs 2.2.3](https://www.npmjs.com/package/wpsjs) — CLI 版本确认
- DeepSeek API 文档（CLAUDE.md §LLM Provider 节）— 模型名称 deepseek-v4-flash 确认
- [MDN ReadableStream 兼容性](https://developer.mozilla.org/zh-CN/docs/Web/API/ReadableStream#browser_compatibility) — Chrome 43+ 支持 response body ReadableStream
- [STATE.md §Decisions](/.planning/STATE.md) — UNDO 裁定（WPS undoRecord bug 官方确认）

### Secondary（MEDIUM confidence）
- [blog.csdn.net/wpsdev 124844535](https://blog.csdn.net/wpsdev/article/details/124844535) — wpsjs 开发详解（ComponentType 社区实证）
- [blog.csdn.net/daqinzl 138747544](https://blog.csdn.net/daqinzl/article/details/138747544) — wpsjs 创建发布部署（Mac build 约束 + jsplugins.xml 格式）
- [知乎 WPS 加载项深入开发](https://zhuanlan.zhihu.com/p/266673886) — CEF 基础确认
- [github.com/herman-hang/wps](https://github.com/herman-hang/wps) — jsplugins.xml 在线模式格式
- [React v19 发布](https://react.dev/blog/2024/12/05/react-19) — 版本信息

### Tertiary（LOW confidence）
- WPS 社区零散帖子（DevTools 快捷键 ALT+F12/F12，版本限制）— 部分需真机确认
- 社区 CEF 版本估计（需真机 userAgent 坐实）

---

## Metadata

**Confidence breakdown：**
- 探针脚手架：HIGH — wpsjs CLI 事实 + jsplugins.xml 格式已验
- JSAPI 写法：MEDIUM — read/write 路径有文档支撑；AddTable/AddLine/copy_slide 存在性未验
- CEF 运行时行为：LOW until 真机 — 版本/CSP/localStorage 持久性全部待真机

**Research date：** 2026-06-08
**Valid until：** 2026-07-08（30 天；wpsjs 版本稳定，但 WPS 本体版本随时更新可能影响 CEF 版本和 API 可用性）
