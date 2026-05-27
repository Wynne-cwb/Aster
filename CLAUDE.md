## Language
I am from Singapore and have recently been learning Chinese, as it is one of Singapore's official languages. Please communicate with me in Chinese from now on.


<!-- GSD:project-start source:PROJECT.md -->
## Project

**Aster**

Aster 是一个面向中文职场用户的 Office.js Add-in，跑在 PowerPoint / Excel / Word 三个宿主之上，通过 LLM（DeepSeek-V4）与图像模型（aihubmix）把"一键文档操作 + 多轮聊天"两种 AI 提效形态直接嵌进原生 Office。定位在 Microsoft Copilot 与浏览器版 ChatGPT 之间——开源、BYO Key、无后台。

**Core Value:** **在原生 Office 内部，让中文职场用户用自带 API Key 享受到 AI 提效，无需切网页、无需订阅 Copilot、无需把数据交给中间服务器。** 如果这一点失败（比如必须复制粘贴出 Office 才能用 AI），整个产品就没有意义。

### Constraints

- **Tech — Host**: Office.js Add-in 架构 — 跨 PPT / Excel / Word 三宿主，使用 Web/Windows 共同支持的 API 子集（参考 Office.js capabilities matrix）
- **Tech — Frontend**: Task Pane 是浏览器内嵌 web view，构建产物必须是纯静态 + 浏览器可直连第三方 API
- **Tech — No Backend**: 零后台服务，所有 LLM/图像调用从用户浏览器直连 Provider —— 这是 Core Value 的硬约束，不可妥协
- **Tech — Bundle**: 初始 JS ≤ 1MB，解析库（mammoth/SheetJS/pdf.js）与 Provider SDK 必须懒加载
- **Performance**: P95 端到端 ≤ 10s，首 token ≤ 2s
- **Security**: API Key 永不离开用户浏览器到 Aster 自有服务器；存储在 Office RoamingSettings
- **Compatibility — MVP**: Office for Web（Edge / Chrome 最新两版）三宿主必须 sideload 正常
- **Compatibility — v1.1**: Windows Office Desktop 同 manifest 验证
- **Compatibility — Out**: Mac / iOS / Android 不在 v1 验证范围
- **Language**: UI 默认中文；英文 i18n 推迟到 v1.1
- **Distribution**: v1 仅 sideload + 开源仓库 manifest，不走 AppSource
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## TL;DR — Recommended Stack
| Layer | Choice | Version (May 2026) | Confidence |
|---|---|---|---|
| Scaffolding | `generator-office` (Yo Office) → eject to Vite | `^7.x` | HIGH |
| Build tool | **Vite** (community Office-addin plugin) | `vite@^7`, `vite-plugin-office-addin@^1.x` | MEDIUM |
| Language | TypeScript (strict) | `typescript@^5.7` | HIGH |
| UI framework | **React 19** | `react@^19`, `react-dom@^19` | HIGH |
| Component library | **Fluent UI React v9** (`@fluentui/react-components`) | `9.73.x` | HIGH |
| State (client) | **Zustand** | `zustand@^5.x` | HIGH |
| State (server) | **TanStack Query** (only if we cache LLM history) | `@tanstack/react-query@^5.x` | MEDIUM — defer to Phase 2 |
| i18n | **lingui** (`@lingui/react` + `@lingui/macro`) | `@lingui/react@^5.x` | MEDIUM |
| Office.js runtime | **CDN script tag** (NOT npm) | `https://appsforoffice.microsoft.com/lib/1/hosted/office.js` | HIGH |
| Office.js types | `@types/office-js` | latest | HIGH |
| HTTPS dev certs | `office-addin-dev-certs` | `^1.x` (bundled by Yo Office) | HIGH |
| LLM client | **Native `fetch` + `ReadableStream`** (no SDK) | n/a | HIGH |
| docx parser | `mammoth` (browser build) | `mammoth@^1.12.0` | HIGH |
| xlsx parser | `xlsx` (SheetJS CE, ESM, mini build) | `xlsx@^0.20.x` from `cdn.sheetjs.com` | HIGH |
| pdf parser | `pdfjs-dist` (modular import) | `pdfjs-dist@^5.7.x` | HIGH |
| pptx parser | `@jvmr/pptx-to-html` OR DIY JSZip + DOMParser | `@jvmr/pptx-to-html` (Mar 2026) | LOW — Phase 0 spike |
| Markdown render | `react-markdown` + `remark-gfm` | `react-markdown@^9.x` | HIGH |
## Recommended Stack — Detail
### Core Framework
| Technology | Version | Purpose | Why |
|---|---|---|---|
| **React 19** | `^19` | Task Pane UI | De-facto for Office Add-ins; Microsoft's own React TaskPane template ships React; Fluent UI v9 requires React 18+; ecosystem is overwhelming. Vue/Svelte work but Fluent UI v9 only targets React, so picking anything else means rolling our own Microsoft-look components — net negative for a solo dev. |
| **TypeScript 5.7+** | `^5.7` | Language | Office.js types via `@types/office-js` are accurate and Microsoft-maintained. Strict mode catches host-API typos that would otherwise only surface at runtime in an embedded webview. |
| **Vite 7** | `^7` | Dev server + bundler | Vite HMR ≈ 87 ms vs Webpack ≈ 2.1 s on a non-trivial React app — a ~24× gap that compounds across a multi-month build. For a single Task Pane entry point + a few commands HTML files, the Vite setup is straightforward via `vite-plugin-office-addin`. |
### UI / Components
| Technology | Version | Purpose | Why |
|---|---|---|---|
| **`@fluentui/react-components` v9** | `9.73.x` | UI components | Microsoft's own; v9 is a complete rewrite (NOT v8 upgrade) — uses **Griffel** CSS-in-JS with near-zero runtime overhead and proper tree-shaking. Looks native inside Office. Real-world PCF bundles using Fluent v9 Badge + Slider stay under 90 kB. Accessibility is tested with real assistive tech users by Microsoft. |
| **`@fluentui/tokens`** | `9.x` | Theme tokens | Comes with `react-components`; gives us the Office light/dark/HC themes "for free" when the host sends theme changes. |
| **`react-markdown` + `remark-gfm`** | `^9.x` / `^4.x` | Render LLM output | Chat bubbles need MD rendering (code blocks, tables, lists). `react-markdown` is the safe industry default, plays well with Fluent UI typography. |
| **`shiki`** (optional, lazy) | `^1.x` | Syntax highlight in code blocks | Lazy-load only when the AI returns code — Excel formula explanations especially. ~150 kB if loaded; lazy keeps initial bundle under budget. |
- **shadcn/ui** — beautiful, but Tailwind + Radix means no Fluent visual parity. Inside Office, looking off-brand makes the add-in feel like a foreign body. shadcn would only win in raw bundle math; we'd lose the "feels like Office" trust that the PRD's BYO-key value prop depends on.
- **Ant Design** — Chinese audience UI wisdom suggests AntD, but AntD inside Office is jarring (different dialog, different inputs, different motion). The Chinese audience benefit is from copy + tone, not the components. Use AntD-style copy patterns in Fluent UI components.
- **`@fluentui/react` v8** — different library, different architecture, no longer the recommended path. v9 has proper React 19 peer deps; v8 doesn't.
- **MUI** — designed for Material, not Fluent. Same visual-foreign-body problem.
### State + Data
| Technology | Version | Purpose | Why |
|---|---|---|---|
| **Zustand** | `^5.x` | Client UI state (chat history, current provider, draft input, selection ctx) | ~1.2 KB gzipped, no Provider boilerplate, selector-based re-renders (perfect for chat where 100+ messages stream in). Best fit for "small to medium app, lots of frequent updates" — exactly Aster. |
| (Defer) TanStack Query | — | Not needed for v1 | We don't have a backend, and LLM responses are one-shot streams (not idempotent cacheable GETs). Skip. Revisit only if we add image library search (Unsplash/Pexels). |
- **Redux Toolkit** — 13.8 KB gzipped, heavy boilerplate, no advantage over Zustand for a chat UI built by one dev. Time-travel debugging is a luxury we won't use.
- **Jotai** — viable (atomic state fits "per-message" patterns) but two libs do the job of one. Zustand wins on simplicity.
- **React Context** — works for the 80% case but causes whole-tree re-renders on chat updates. Avoid for the message store.
### Office.js Integration
| Technology | Version | Purpose | Why |
|---|---|---|---|
| **CDN script tag** | `https://appsforoffice.microsoft.com/lib/1/hosted/office.js` | Office runtime | **The npm `@microsoft/office-js` package is officially deprecated.** npm page literally says "no longer officially supported." Microsoft pushes fixes/security to the CDN — bundling locally means missing them. The CDN loader is also platform-aware (it pulls host-specific code for PPT/Excel/Word). |
| **`@types/office-js`** | latest | TypeScript types | Install as devDependency; gives `Office.context.host`, `PowerPoint.run`, `Excel.run`, `Word.run` typings. |
| **`office-addin-dev-certs`** | bundled by Yo Office | Local HTTPS cert | Generates a localhost cert signed by a dev CA, installs to trusted root, valid 30 days. On first `npm start` it prompts you (and the Edge WebView loopback exemption). |
| **Shared runtime** (manifest opt-in) | n/a | CORS + ribbon + task pane in one runtime | Required if Ribbon button needs to share state/CORS with Task Pane. We do. Enable in manifest. |
### Storage — **PRD ASSUMPTION INVALIDATED**
| API | Scope | Lives Where | Persists Across Files? | Aster Suitability |
|---|---|---|---|---|
| `Office.context.document.settings` (Common) | Document | Inside the .docx/.xlsx/.pptx file | NO — tied to that file | **Bad** — Key would travel with file (security disaster) |
| `Excel.SettingCollection`, `Word.SettingCollection` (app-specific) | Document | Same as above | NO | Same problem |
| `Office.context.roamingSettings` | Mailbox / user | Exchange mailbox | Yes — across all Outlook clients | **Unavailable** in PPT/Excel/Word |
| Partitioned `localStorage` (`Office.context.partitionKey`) | Browser origin + partition | Browser local storage | Yes within same browser+host | **The actual answer for non-Outlook hosts** |
| Custom server | Whatever | Your DB | Yes | Out — Aster has no backend |
- Keys are stored in **browser local storage**, per-browser + per-partition.
- Switching browsers (Edge → Chrome) → re-enter key.
- Clearing browser data → re-enter key.
- This is the same storage class as any web app; no Microsoft-managed sync.
- **Don't use cross-app persistence** — Microsoft explicitly forbids reading Word's localStorage from Excel; they may live in different origins.
### Streaming LLM Calls
| Technology | Version | Purpose | Why |
|---|---|---|---|
| **Native `fetch` + `ReadableStream`** | built-in | All LLM calls | Smallest possible footprint (0 KB added). DeepSeek and AiHubMix are OpenAI-compatible Server-Sent Events — the same `text/event-stream` format. A 40-line `parseSSE()` helper covers everything we need: chunk parsing, `[DONE]` detection, JSON line decode, AbortController for cancel. |
- **Vercel AI SDK (`ai`)** — designed around a server proxy pattern. The SDK does NOT natively support `dangerouslyAllowBrowser` (open issue #3041), and its "Edge runtime" assumption fights the no-backend constraint. We'd be importing ~15–20 KB to wrap something we can hand-write in 50 lines. The `useChat` hook is nice DX but it expects a server route to POST to.
- **`@anthropic-ai/sdk` / `openai` SDK with `dangerouslyAllowBrowser: true`** — works (these SDKs do support browser usage with the flag), but adds 30–60 KB and is overkill for the Chat Completions endpoint we need. DeepSeek is OpenAI-compatible at the wire level, not the SDK level — we don't need the abstraction.
- **`@ai-sdk/deepseek`** — Vercel-flavored DeepSeek provider; same issue as the AI SDK.
### LLM / Image Provider Specifics
#### DeepSeek (LLM — HIGH confidence on API; LOW on multimodal)
| Field | Value | Source |
|---|---|---|
| Base URL | `https://api.deepseek.com` (also accepts `/v1`) | DeepSeek API docs |
| Endpoint | `POST /chat/completions` (OpenAI Chat Completions wire format) | DeepSeek docs |
| Model IDs (May 2026) | `deepseek-v4-pro`, `deepseek-v4-flash` | `GET /models` |
| Context window | 1M tokens (both), 384K max output | DeepSeek V4 release |
| Streaming | `stream: true` → standard OpenAI SSE format (`data: {...}\n\n` + `data: [DONE]`) | DeepSeek docs |
| Reasoning mode | `extra_body: {"thinking": {"type": "enabled"}}` + `reasoning_effort: "high"/"medium"/"low"` | DeepSeek V4 release notes |
| Legacy models | `deepseek-chat`, `deepseek-reasoner` deprecated **2026-07-24** — do NOT use | DeepSeek change log |
| Pricing (Flash) | $0.14 / $0.28 per 1M input/output tokens | DeepSeek pricing |
| Pricing (Pro) | $1.74 / $3.48 per 1M input/output (75% off until 2026-05-05) | DeepSeek pricing |
| Cache hit pricing | Flash: $0.0028/M (50× cheaper); Pro: $0.003625/M (120× cheaper) | DeepSeek pricing |
- DeepSeek V4 has a "Vision" variant (separate from the base V4 Pro text model). Per multiple third-party writeups it accepts image input with the OpenAI multi-content message format (`role:"user", content:[{type:"text",...}, {type:"image_url",...}]`).
- **Whether `deepseek-v4-pro` or `deepseek-v4-flash` directly accept image input via `api.deepseek.com` is NOT confirmed in the official docs we surfaced** — official docs are silent on multimodal at these specific model IDs.
- **Spike action:** call `POST https://api.deepseek.com/chat/completions` with an `image_url` content part, model `deepseek-v4-pro`. If it errors, fall back to AiHubMix vision (which the PRD already plans). This validates PRD Q6 / R2.
#### AiHubMix (Image generation + Vision — MEDIUM confidence)
| Field | Value | Source |
|---|---|---|
| Base URL | `https://api.aihubmix.com/v1` (also `https://aihubmix.com/v1` in some docs) | AiHubMix docs |
| Endpoint shape | OpenAI SDK-compatible: `POST /chat/completions`, `POST /images/generations`, `POST /images/edits` | AiHubMix docs |
| `gpt-image-2` availability | **Likely supported** (AiHubMix advertises "all mainstream models" and OpenAI-compatible passthrough), but **no dedicated docs page surfaced for `gpt-image-2`** as of May 2026 — only `gpt-image-1` docs are explicit. | inferred; spike needed |
| `gpt-image-2` upstream pricing | OpenAI: $8/M image input tokens, $30/M image output tokens, $5/M text input tokens. Per-image quotes (low/medium/high): ~$0.006 / $0.053 / $0.211 at 1024×1024 | OpenAI pricing page |
| Streaming | Chat: yes (OpenAI SSE). Image generation: **not streamable** — single response with base64 or URL | OpenAI / AiHubMix conventions |
| Vision model on AiHubMix | Has multiple options — likely `gpt-4o`, `gpt-5`, claude-opus-4.7, etc., all OpenAI-compatible. Pick one in spike based on per-image cost. | inferred |
### File Parsers (all lazy-loaded)
| Library | Version | Approx browser-min gzipped | Use | Notes |
|---|---|---|---|---|
| **`mammoth`** | `^1.12.0` (Mar 2026) | ~200–250 KB (browser bundle) | docx → HTML/text | Mature, single-author maintained, no real competitors. Use `mammoth.browser.min.js` or import from `mammoth/lib/index.js`. **Security:** no HTML sanitization built-in — sanitize before injecting (we only feed it to LLM as text, so safe). |
| **`xlsx` (SheetJS CE)** | `^0.20.x` (install from `cdn.sheetjs.com`, NOT npm) | ~180 KB (mini build, ESM) | xlsx → JSON/CSV | Critical: install from SheetJS CDN, the npm package is unmaintained legacy. Use ESM build + `writeFileXLSX` for tree-shaking. We only need read paths, so even smaller. |
| **`pdfjs-dist`** | `^5.7.x` | ~150 KB main + ~400 KB worker (separate file) | pdf → text | Worker MUST be in a separate file (Vite static asset). Use `getDocument({data}).promise → page.getTextContent()`. No rendering needed (text only for MVP). |
| **`@jvmr/pptx-to-html`** OR DIY | Mar 2026 release | ~50–100 KB est. | pptx → text | LOW confidence — library is new (Mar 2026), single author, untested for our use case. **Spike must validate.** Fallback: `jszip` + native `DOMParser` to extract `<a:t>` text nodes from `ppt/slides/slide*.xml` — straightforward and roughly 30 KB. PRD already accepts "text only, no fidelity" for pptx in MVP. |
| `jszip` | `^3.x` | ~33 KB gzipped | pptx fallback only | Standard library for zip-in-browser. Use if `@jvmr/pptx-to-html` doesn't work out. |
| (text files) | — | 0 KB | txt/md/csv/json | Direct `File.text()`. |
| Component | Est. gzipped | Notes |
|---|---|---|
| React 19 + ReactDOM | ~45 KB | core |
| Fluent UI v9 (only used components) | ~120 KB | Button, Input, Drawer, Tabs, etc. with tree-shaking |
| Griffel + tokens | ~15 KB | bundled with v9 |
| Zustand | ~1.2 KB | tiny |
| react-markdown + remark-gfm | ~40 KB | |
| App code (Aster) | ~80 KB | estimate |
| Office.js types/runtime | 0 KB | from CDN |
| **Total initial** | **~300 KB gzipped** | well under 1 MB budget |
| **Lazy chunks (loaded on demand)** | mammoth ~250, xlsx ~180, pdfjs ~150+400 worker, shiki ~150 | each loaded only when file type used |
### i18n
| Technology | Version | Purpose | Why |
|---|---|---|---|
| **`@lingui/react` + `@lingui/macro`** | `^5.x` | Strings | Smallest runtime (~3–5 KB gzipped vs ~22 KB for react-i18next), compile-time message extraction (no runtime JSON resolution), PO files (translator-friendly). For Aster: v1 is Chinese-only — macros tag strings now, English PO file lands in v1.1 with zero refactor. |
### Manifest
| Item | Choice | Why |
|---|---|---|
| Manifest format | **XML manifest** (not unified/JSON manifest) for v1 | Web add-in JSON manifest is GA but tooling support outside Outlook is still uneven in 2026. XML manifest works everywhere. Re-evaluate for v1.1. |
| Shared runtime | **Enabled** | Required for CORS consistency across Task Pane + Ribbon, and to share Provider state (chat history, current Key) between Ribbon-triggered actions and Task Pane chat. |
| Add-in commands | Function commands (Ribbon buttons) + ShowTaskpane | Function commands for "确定性一键动作" buttons, ShowTaskpane for opening the chat. |
| Host targets | `Workbook` (Excel), `Document` (Word), `Presentation` (PowerPoint) — three separate `<Host>` entries in one manifest | Yes, a single manifest with three hosts is supported. |
## Installation Commands
# 1. Scaffold (you may eject from Webpack to Vite after)
# Choose: Office Add-in Task Pane project | React framework | TypeScript | Excel/Word/PowerPoint
# 2. (After ejecting to Vite) Core runtime deps
# 3. Lazy-loaded parsers (these go in dependencies but ONLY dynamic-import them)
# Optional, decide in spike:
# 4. Dev deps
## Alternatives Considered (Recap Table)
| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| Scaffolding | Yo Office → eject to Vite | Microsoft 365 Agents Toolkit | VS Code-only; Yo Office gives us a portable CLI flow |
| Build | Vite + community Office plugin | Webpack (official Yo template) | Vite HMR is 20×+ faster; we don't need Webpack's enterprise features |
| UI | Fluent UI v9 | shadcn/ui, AntD, MUI | Native Office look matters more than 30 KB savings |
| State | Zustand | Redux Toolkit, Jotai | 1.2 KB beats 13.8 KB, no boilerplate, selector subs perfect for chat |
| LLM client | Native fetch | Vercel AI SDK, OpenAI SDK | No-backend constraint makes the SDKs strictly worse; OpenAI-compat wire fmt is trivial |
| Office.js | CDN script | `@microsoft/office-js` npm | npm package is officially deprecated by Microsoft |
| Storage | partitioned localStorage | RoamingSettings, document.settings, custom server | RoamingSettings = Outlook-only; document.settings leaks Key into the file; we have no server |
| i18n | Lingui | react-i18next, react-intl | Smallest runtime + compile-time extraction; Chinese-only v1 doesn't need a heavy framework |
| docx | mammoth | docx4js, others | No real competitor; mammoth is the canonical browser solution |
| xlsx | SheetJS CE | exceljs | SheetJS has the broadest format support; exceljs has Node-only paths |
| pdf | pdfjs-dist | pdf-lib | pdf-lib is for editing, not text extraction |
| pptx | @jvmr/pptx-to-html OR jszip DIY | officeparser, PptxViewJS | officeparser is full-AST (heavy), PptxViewJS is a Canvas viewer (heavy); we only need text |
## Phase 0 Spike — Stack Items That MUST Be Verified
## Sources
### Microsoft / Office Add-ins (HIGH confidence)
- [Microsoft Learn — Set up your development environment](https://learn.microsoft.com/en-us/office/dev/add-ins/overview/set-up-your-dev-environment)
- [Microsoft Learn — Yeoman Generator overview](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/yeoman-generator-overview)
- [Microsoft Learn — Referencing the Office JavaScript API library](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/referencing-the-javascript-api-for-office-library-from-its-cdn)
- [Microsoft Learn — Persist add-in state and settings](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/persisting-add-in-state-and-settings)
- [Microsoft Learn — Address same-origin policy limitations](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/addressing-same-origin-policy-limitations)
- [Microsoft Learn — Configure your Office Add-in to use a shared runtime](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/configure-your-add-in-to-use-a-shared-runtime)
- [Microsoft Learn — Fluent UI React in Office Add-ins](https://learn.microsoft.com/en-us/office/dev/add-ins/quickstarts/fluent-react-quickstart)
- [Microsoft Learn — Office.RoamingSettings interface](https://learn.microsoft.com/en-us/javascript/api/outlook/office.roamingsettings)
- [Microsoft Learn — Office.Context interface](https://learn.microsoft.com/en-us/javascript/api/office/office.context)
- [OfficeDev/generator-office (GitHub)](https://github.com/OfficeDev/generator-office)
- [OfficeDev/generator-office SSL docs](https://github.com/OfficeDev/generator-office/blob/master/src/docs/ssl.md)
- [OfficeDev/office-js (GitHub)](https://github.com/OfficeDev/office-js)
- [office-addin-dev-certs (npm)](https://www.npmjs.com/package/office-addin-dev-certs)
- [@microsoft/office-js (npm — DEPRECATED)](https://www.npmjs.com/package/@microsoft/office-js)
- [@fluentui/react-components (npm)](https://www.npmjs.com/package/@fluentui/react-components)
- [Fluent UI React v9 docs](https://react.fluentui.dev/)
- [DeepWiki — Fluent UI React v9](https://deepwiki.com/microsoft/fluentui/3.1-react-v9-(@fluentuireact-components))
### Build Tooling (MEDIUM confidence)
- [Vite vs Webpack 2026: 24x HMR Speed Gap (Tested) — Tech Insider](https://tech-insider.org/vite-vs-webpack-2026-2/)
- [Vite vs Webpack in 2026 (jsmanifest)](https://jsmanifest.com/vite-vs-webpack-2026)
- [ExtraBB/Office-Addin-React-Vite-Template (GitHub)](https://github.com/ExtraBB/Office-Addin-React-Vite-Template)
- [jozefizso/vite-plugin-office-addin (GitHub)](https://github.com/jozefizso/vite-plugin-office-addin)
- [OfficeDev/Office-Addin-TaskPane-React (GitHub — Webpack official template)](https://github.com/OfficeDev/Office-Addin-TaskPane-React)
### State Management (HIGH confidence)
- [State Management in 2026: Zustand vs Jotai vs Redux Toolkit vs Signals — DEV.to](https://dev.to/jsgurujobs/state-management-in-2026-zustand-vs-jotai-vs-redux-toolkit-vs-signals-2gge)
- [Zustand vs Redux 2026: 7M Downloads, 7x Bundle Gap — Tech Insider](https://tech-insider.org/zustand-vs-redux-2026/)
- [Zustand vs Redux Toolkit vs Jotai — Better Stack](https://betterstack.com/community/guides/scaling-nodejs/zustand-vs-redux-toolkit-vs-jotai/)
### i18n (MEDIUM confidence)
- [React i18n in 2026: react-intl vs i18next vs LinguiJS — auto18n](https://www.auto18n.com/en/blog/react-i18n-2026)
- [next-intl vs i18next vs Lingui — BuildPilot](https://trybuildpilot.com/910-next-intl-vs-i18next-vs-lingui-2026)
### LLM SDKs & Streaming (MEDIUM confidence)
- [AI SDK by Vercel — docs](https://ai-sdk.dev/docs/introduction)
- [Vercel AI SDK Issue #3041 — dangerouslyAllowBrowser](https://github.com/vercel/ai/issues/3041)
- [Vercel BYOK docs](https://vercel.com/docs/ai-gateway/authentication-and-byok/byok)
### DeepSeek (HIGH on API; LOW on multimodal)
- [DeepSeek API Docs (root)](https://api-docs.deepseek.com/)
- [DeepSeek V4 Preview Release](https://api-docs.deepseek.com/news/news260424)
- [DeepSeek API Change Log](https://api-docs.deepseek.com/updates)
- [DeepSeek API List Models](https://api-docs.deepseek.com/api/list-models)
- [DeepSeek V4 API Migration Guide — WaveSpeed](https://wavespeed.ai/blog/posts/blog-deepseek-v4-model-name-migration/)
- [DeepSeek V4 Vision — MindStudio](https://www.mindstudio.ai/blog/deepseek-v4-vision-cheaper-multimodal-ai-workflows)
- [DeepSeek V4 Vision Guide — Scale Xpert](https://scale-xpert.com/deepseek-v4-vision-guide-is-it-the-best-for-multimodal-tasks/)
- [DeepSeek V4 Pro Model Overview — DeepInfra](https://deepinfra.com/blog/deepseek-v4-pro-model-overview)
### AiHubMix (MEDIUM confidence)
- [AiHubMix Documentation Hub](https://docs.aihubmix.com/en)
- [AiHubMix gpt-image-1 docs](https://docs.aihubmix.com/en/api/GPT-Image-1)
- [AiHubMix Deep Dive — Skywork](https://skywork.ai/skypage/en/AiHubMix-Deep-Dive-The-Comprehensive-Guide-for-AI-Users/1976176916070199296)
### GPT Image 2 (MEDIUM confidence — model background)
- [GPT Image 2 — OpenAI API docs](https://developers.openai.com/api/docs/models/gpt-image-2)
- [GPT Image 2 Pricing 2026 — WaveSpeed](https://wavespeed.ai/blog/posts/gpt-image-2-pricing-2026/)
- [GPT Image 2 Pricing Guide — TokenMix](https://tokenmix.ai/blog/gpt-image-2-pricing-cost-signals-2026)
### File Parsers (HIGH confidence)
- [mammoth (npm)](https://www.npmjs.com/package/mammoth)
- [mwilliamson/mammoth.js (GitHub)](https://github.com/mwilliamson/mammoth.js/)
- [xlsx (SheetJS) docs](https://docs.sheetjs.com/)
- [SheetJS Standalone Browser Scripts](https://docs.sheetjs.com/docs/getting-started/installation/standalone/)
- [pdfjs-dist (npm)](https://www.npmjs.com/package/pdfjs-dist)
- [@jvmr/pptx-to-html (npm)](https://www.npmjs.com/package/@jvmr/pptx-to-html)
- [officeparser (npm)](https://www.npmjs.com/package/officeparser)
- [gitbrent/PptxGenJS (GitHub — generation only, for reference)](https://github.com/gitbrent/PptxGenJS)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
