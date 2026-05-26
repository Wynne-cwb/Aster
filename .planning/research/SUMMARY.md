# Research Summary — Aster

**Project:** Aster — Office.js AI Add-in (PowerPoint / Excel / Word for Web)
**Domain:** Cross-host Office Add-in, BYO LLM key, no backend, open-source, Chinese-first
**Researched:** 2026-05-26
**Overall confidence:** HIGH on stack + architecture + feature landscape; MEDIUM on Office.js Web write-back parity (Phase 0 spike pending); LOW on DeepSeek-V4 multimodal model ID + CORS-from-browser to providers (Phase 0 spike pending)

---

## TL;DR — What the Roadmapper and User Must Act On

Four parallel research agents converged on a small set of cross-validated conclusions that must be resolved before Phase 1 begins.

### 1. PRD corrections needed before Phase 1

| PRD section | Problem | Source | Fix |
|---|---|---|---|
| **F5 storage** (RoamingSettings) | `Office.context.roamingSettings` is **Outlook-only**. Does NOT exist for PPT/Excel/Word. | Stack + Architecture + Pitfalls (3-way confirmed) | Use **partitioned `localStorage`** keyed on `Office.context.partitionKey`. Update F5 + AC6 + Onboarding copy. |
| **AC6** ("切 MS 账号会丢 Key") | Behavior doesn't match the chosen API. localStorage survives MS-account switches in the same browser profile; loss happens on browser/device switch or cleared data. | Pitfalls | Rewrite AC6: "换浏览器或清除浏览器数据 → Key 丢失；同一浏览器内 MS 账号切换 → Key 保留". |
| **R1 fallback** ("降级为复制粘贴") | Cross-iframe clipboard friction in Office Web. | Pitfalls | Use `setSelectedDataAsync(html, {coercionType: Html})` on current slide as Plan B. |
| **R3 fallback** ("pptx 不支持上传") | Too pessimistic. `jszip + DOMParser` `<a:t>` extraction is ~80 lines. | Pitfalls | Attempt jszip approach before declaring failure. |
| **Risks list — missing R7-R10** | PRD doesn't enumerate CORS, bundle-size discipline, API mixing hangs, or product-feedback risk. | Pitfalls | Add R7 (CORS), R8 (bundle gate), R9 (telemetry), R10 (API mixing). |
| **Phase 1 scope** | PRD Phase 1 = "scaffold + Task Pane shell + Ribbon placeholders" is too thin. | Architecture | Expand: DocumentAdapter interface + skeletons, typed error classes, bundle-size CI gate, i18n scaffold, Vitest harness. |
| **F2 Ribbon selection (PRD Q5)** | Candidates listed; no decision. | Features | Recommended allocation locked (see §Ribbon). |
| **F7 error taxonomy** | "可操作提示" with no spec. | Features | Define 8-class taxonomy (KEY_INVALID / QUOTA / RATE_LIMIT / CONTEXT / NETWORK / FILTER / MODEL / IMAGE_QUOTA). |

### 2. Phase 0 spike — consolidated must-verify list (10 items, by risk)

Items 1–4 are **GATING** (failure = PRD revision before Phase 1).

| # | Spike Item | Severity | Evidence Required |
|---|---|---|---|
| 1 | **CORS from real https Task Pane → `api.deepseek.com` + `api.aihubmix.com`** (NOT localhost). Stream a chat completion. Generate one image. | **CATASTROPHIC** | Production hosting + screen recording |
| 2 | **PPT Web killer scenarios end-to-end**: insert populated slides via `insertSlidesFromBase64`, insert image into selected slide, replace slide text. Edge + Chrome. | HIGH (gating) | Video per scenario |
| 3 | **Storage scope** (PRD F5 invalidated): write key in doc A, open doc B same account same browser, verify localStorage persists; test `Office.context.partitionKey` | HIGH (gating) | Test on all 3 hosts |
| 4 | **DeepSeek-V4 multimodal** (PRD Q6/R2): POST to `api.deepseek.com/chat/completions` with `model:'deepseek-v4-pro'` + `image_url` content block. | MEDIUM (fallback known) | One real API call |
| 5 | **API mixing test**: `PowerPoint.run` → `setSelectedDataAsync` → `PowerPoint.run`. Verify second sync resolves <5s. (#5022) | HIGH | Integration test |
| 6 | **`getSelectedSlides()` order bug** (#3618): workaround = sort by `.index` | MEDIUM | Unit test fixture |
| 7 | **pdf.js production build worker**: deploy to actual hosting; load 5MB PDF | HIGH | Production build, not dev |
| 8 | **pptx text extraction prototype**: 80-line jszip + DOMParser on 3 real pptx files | MEDIUM | Working script |
| 9 | **Bundle-size baseline**: scaffolded Aster + Fluent UI v9, no logic | MEDIUM | `vite-bundle-visualizer` output |
| 10 | **Manifest sideload on all 3 hosts**: PPT/Excel/Word for Web, Edge + Chrome, fresh + existing profiles | MEDIUM | Sideload checklist |

**If items 1, 2, or 3 fail → STOP for PRD revision.**

### 3. Stack — LOCKED

**Vite 7** (build, `vite-plugin-office-addin`) + **React 19** + **TypeScript 5.7 strict** + **Fluent UI React v9** (`@fluentui/react-components` — Microsoft-native, Griffel CSS-in-JS, tree-shakes well) + **Zustand 5** (~1.2 KB) + **Lingui 5** (i18n, ~3-5 KB runtime, zh-CN today / en in v1.1 with zero refactor) + **native `fetch` + `ReadableStream` SSE parser** (NO Vercel AI SDK, NO OpenAI npm SDK — both fight no-backend) + **XML manifest** with three `<Host>` declarations + `<Runtime lifetime="long"/>` **shared runtime** + **Office.js loaded from CDN** (`https://appsforoffice.microsoft.com/lib/1/hosted/office.js`; npm `@microsoft/office-js` is **deprecated by Microsoft**). Parsers (`mammoth`, **SheetJS CE** from `cdn.sheetjs.com`, `pdfjs-dist`, `jszip` for pptx) are **all dynamic-`import()` lazy-loaded** — none in initial bundle. DeepSeek-V4 IDs: `deepseek-v4-pro` + `deepseek-v4-flash` (legacy `deepseek-chat`/`deepseek-reasoner` **retire 2026-07-24**).

**Initial bundle target:** ~300 KB gzipped (under 1 MB budget).

### 4. Phase 1 expansion (beyond PRD's "scaffold + shell + placeholders")

Phase 1 MUST also deliver:

- `DocumentAdapter` interface + `SelectionContext` + `InsertableContent` discriminated unions
- `PptAdapter` / `ExcelAdapter` / `WordAdapter` skeletons with working `getSelection()` + `capabilities()` stub
- Typed error classes (`KeyInvalidError`, `QuotaExceededError`, `ContextTooLongError`, `NetworkError`, `UnsupportedOperationError`, `HostApiError`)
- Bundle-size CI gate (`size-limit` or `vite-bundle-visualizer`) failing builds at >1 MB initial
- i18n scaffold (Lingui + Vite SWC plugin)
- Vitest harness
- Per-host `<Requirements>` inside `<Host>` VersionOverrides (NOT top-level — top-level `PowerPointApi` blocks load in Excel/Word)
- Manifest icons hosted with `Cache-Control: public, max-age=3600`

### 5. PRD feature gaps — 5 surfaced

| # | Gap | Severity | Disposition |
|---|---|---|---|
| 1 | **Word grammar/spell check** as dedicated entry | HIGH | **Add to v1.0** — 3rd option in 多风格润色 dropdown (cost: S) |
| 2 | **Speaker notes generation for PPT** | HIGH (Gamma hero feature) | **Defer to v1.1** — verify `slide.notes` API in Phase 0 |
| 3 | **PivotTable generation for Excel** | MEDIUM | **Defer to v1.1** — verify `Excel.PivotTable` Web API in Phase 0 |
| 4 | **Token / cost visibility per request** | MEDIUM | **Add to v1.0 (Phase 2)** — parse `usage` block, UI badge (cost: S) |
| 5 | **Inline Key validation in Onboarding** | HIGH | **Add to v1.0 (Phase 2)** — 1-token test call on Save + "Get a Key" deep links (cost: S) |

### 6. Open questions for user decision

- **OQ-1** Accept PRD F5 correction (RoamingSettings → partitioned localStorage) + AC6 rewrite? *(Default: yes)*
- **OQ-2** Phase 1 expansion (8 items above) approved? *(Default: yes)*
- **OQ-3** Ribbon button allocation locked, or defer to UX phase? *(PRD Q5)*
- **OQ-4** Include gaps #1, #4, #5 in v1.0? *(Default: yes — all S-cost, high-value)*
- **OQ-5** v1 quantitative success metric? *(PRD Q4 — opt-in Plausible/PostHog vs "stars + issues only")*
- **OQ-6** If Phase 0 CORS fails — fallback ranking? Cloudflare Worker proxy (violates no-backend) / drop affected provider / abandon
- **OQ-7** Image library Unsplash vs Pexels decided now or after Phase 0? *(PRD Q1)*

---

## Executive Summary

Aster is a cross-host Office.js Add-in bringing AI productivity into native PowerPoint, Excel, and Word for Web, distinguished by **BYO LLM key + no backend + open source** — a wedge between Microsoft Copilot ($30/user/mo, weak Chinese tuning) and browser-based ChatGPT (no native integration). The product's Core Value depends on three architectural bets: (1) Office.js Web APIs are rich enough to write back content; (2) DeepSeek and aihubmix accept browser-origin CORS; (3) a single SPA can serve three hosts via a `DocumentAdapter` abstraction. Research confirms bets (1) and (3) are tractable with known patterns; **bet (2) is UNVERIFIED and CATASTROPHIC if broken** — making Phase 0 CORS verification the single highest-leverage spike item.

The recommended technical approach is a **Vite 7 + React 19 + Fluent UI v9 + Zustand** SPA, with all heavy parsers (mammoth, SheetJS, pdf.js, jszip-based pptx extraction) behind dynamic `import()`. LLM calls use native `fetch` + a 40-line SSE parser — no Vercel AI SDK, no OpenAI npm SDK (both add 200+ KB and fight the no-backend model). The `DocumentAdapter` interface absorbs cross-host divergence; adapters never import providers and vice versa; UI talks only to domain services. The 9 PRD killer scenarios map cleanly onto a small `InsertableContent` discriminated union. The PRD's Phase 0-7 build order is correct except **Phase 1 must expand** to land the adapter interface, typed errors, and bundle-size CI gate as foundations.

The biggest risks aren't the ones the PRD enumerates. **PRD R1-R6 are real but missing R7-R10 are larger**: R7 CORS-from-browser (catastrophic), R8 bundle-size discipline gap (PRD has goal but no enforcement), R9 no-backend = no product feedback signal (PRD Q4 unanswerable without this), R10 API mixing hangs (Office.js bug #5022). The PRD's F5 storage assumption is **objectively wrong** — `Office.context.roamingSettings` is Outlook-only and must be replaced with partitioned `localStorage`. None of these block Phase 0, but all must be addressed before Phase 1 architecture is committed.

---

## Key Findings

### Recommended Stack (HIGH confidence)

- **Vite 7 + `vite-plugin-office-addin`** — HMR ~87ms vs Webpack ~2.1s. Community plugin; fall back to official Webpack template if Phase 0 reveals issues.
- **React 19 + TypeScript 5.7 strict** — de-facto.
- **Fluent UI React v9** (`@fluentui/react-components`) — Microsoft-native, tree-shakes to <120 KB real bundle. NOT v8 (different library), NOT shadcn (no Fluent parity), NOT AntD (visual foreign body).
- **Zustand 5** — ~1.2 KB, no provider boilerplate, selector-based re-renders perfect for streaming.
- **Native fetch + ReadableStream** for LLM — DeepSeek and aihubmix are both OpenAI-compatible SSE; 40-line `parseSSE()` helper covers everything.
- **Lingui 5** — smallest i18n runtime; compile-time message extraction; zero-refactor English add in v1.1.
- **Office.js from CDN** — npm `@microsoft/office-js` is **officially deprecated**. Use `@types/office-js` for types only.
- **Partitioned `localStorage`** for Keys — keyed by `Office.context.partitionKey`. NOT `roamingSettings` (Outlook-only). NOT `document.settings` (leaks into file).
- **XML manifest** with three `<Host>` declarations + shared runtime. Unified JSON still preview for Excel/PPT/Word in 2026.
- **Lazy parsers, all dynamic-imported**: mammoth (~250KB), SheetJS CE (~180KB), pdfjs-dist (~150KB main + ~400KB worker), jszip (~30KB) + DOMParser for pptx text-only.

Details: `.planning/research/STACK.md`.

### Expected Features

**Table stakes (PRD covers):** Task Pane multi-turn chat + streaming + insert-to-doc, multi-format upload with lazy parsers, multimodal image understanding, BYO Key + Onboarding (corrected to localStorage), provider abstraction, 9 killer scenarios, P95 ≤10s / first-token ≤2s.

**Differentiators (PRD covers):** BYO Key with no markup (#1 wedge vs Copilot's $30/mo), no backend / direct-to-provider privacy, open source + sideload, DeepSeek-V4 Chinese-first default, image-gen + stock dual-track.

**Gaps to add to v1.0 (cheap, high-value):** Word grammar/spell entry, token cost visibility, inline Key validation.

**Defer to v1.1:** Speaker notes (PPT), PivotTable (Excel), chart+insight, slash commands, IndexedDB persistence, English i18n, Windows Desktop, prompt template library.

**Anti-features (explicit):** VBA gen, whole-deck redesign, auto-execute writeback, Mac/Mobile, floating action button (Microsoft reverted this themselves in May 2026), AppSource at launch, RAG, whole-doc translation.

#### Ribbon Button Allocation (PRD Q5)

| Host | Button 1 (Wow / Demo) | Button 2 (Daily Use) | Task Pane Only |
|---|---|---|---|
| **PPT** | 主题→大纲 | 选中 slide 配图 | Bullet 压缩 |
| **Excel** | 自然语言→公式 | 公式解释/调修 | 数据清洗 |
| **Word** | 多风格润色 (含 grammar/spell 下拉) | TL;DR | 大纲→长文 |

Details: `.planning/research/FEATURES.md`.

### Architecture (HIGH confidence)

Layering: **App Shell → Host Dispatcher → Domain Services → Adapters / Providers / Parsers (lazy) / Settings**. Adapters never import providers; providers never import adapters; UI never imports either directly.

Major components:

1. **App Shell + Host Dispatcher** — `Office.onReady()` reads `info.host`, instantiates correct adapter, exposes via React Context.
2. **DocumentAdapter interface** — verbs: `getSelection`, `insertContent`, `getSelectionPreview`, `onSelectionChanged`, `capabilities`. 9 scenarios map to `InsertableContent` discriminated union (`text`/`paragraphs`/`bullets`/`formula`/`range-values`/`slides`/`image`).
3. **ProviderRegistry + LLMProvider/ImageProvider/StockImageProvider** — OpenAI-compatible-first; one `openai-compatible.ts` powers DeepSeek + user-custom; aihubmix bespoke for vision/image-gen.
4. **Shared-runtime `RibbonBus`** — module-singleton in shared global namespace; `<Runtime lifetime="long"/>` in manifest is **non-negotiable** (ribbon ↔ task pane state sharing).
5. **Lazy parser boundary** — `await import()` with Vite `manualChunks` for stable cached filenames. `pdfjs-dist` worker via `new URL(..., import.meta.url)` (the `?url` import works in dev but breaks Vite production build).
6. **Settings Store (Zustand) mirrored to partitioned localStorage** — keyed on `Office.context.partitionKey`. Single async `getKey()`.
7. **Typed error layering** — Provider throws `KeyInvalidError`/`QuotaExceededError`/`ContextTooLongError`/`NetworkError`; Adapter throws `HostApiError`/`UnsupportedOperationError`; scenario catches → UI toast; React UI never throws.

Details: `.planning/research/ARCHITECTURE.md`.

### Critical Pitfalls (24 cataloged; top 5)

1. **CORS-from-browser to DeepSeek/aihubmix** — `<AppDomains>` does NOT enable CORS bypass; CORS is enforced by API server headers. If either rejects, no-backend collapses. **Mitigation:** Phase 0 from real https origin. **Recovery: CATASTROPHIC.**
2. **PRD F5 storage uses wrong API** — `roamingSettings` is Outlook-only. **Mitigation:** Partitioned localStorage. **Recovery: MEDIUM** if discovered post-launch.
3. **PowerPoint Web write-back parity** — `insertSlidesFromBase64` requires template; image insertion to non-active slides has gaps; mixing `setSelectedDataAsync` with `PowerPoint.run` **hangs context.sync() indefinitely** (#5022); `getSelectedSlides()` reverses on Web (#3618). **Mitigation:** Phase 0 video demos; Plan B = `setSelectedDataAsync(html)` on current slide.
4. **Bundle size death by Fluent + icons + parsers** — N2 invisible until prod build. Fluent v8 barrels (+500KB), naive icon imports (4MB!), OpenAI SDK (+250KB). **Mitigation:** CI bundle-size gate from Phase 1 day 1. **Recovery: HIGH** if discovered Phase 7.
5. **Streaming fetch without proper AbortController** — concurrent streams garble UI; cancel without abort keeps consuming tokens (DeepSeek charges per streamed token even if you stop reading); Task Pane close doesn't fire `beforeunload` reliably. **Mitigation:** One `AbortController` per request; `visibilitychange` listener aborts on hide; single-flight per provider.

Details: `.planning/research/PITFALLS.md`.

#### Missing Risks (R7-R10 to add to PRD)

| New Risk | Severity | Source |
|---|---|---|
| **R7 CORS-from-browser blocking direct Provider calls** | CATASTROPHIC | Pitfalls |
| **R8 Bundle size discipline gap** | HIGH | Pitfalls |
| **R9 No-backend = no product feedback signal** | MEDIUM | Pitfalls |
| **R10 Office.js API mixing hangs (#5022)** | HIGH | Pitfalls |

---

## Implications for Roadmap

Phase structure largely follows PRD's Phase 0-7. Two changes: **Phase 1 expanded**, **Phase 0 gate explicit**.

| Phase | Goal | Key Deliverables |
|---|---|---|
| **0 — Spike (≤1 wk, GATING)** | Verify R1, R2, R3, R7-R10 before architecture is committed | 10-item demo artifact set. Items 1-3 are GATING |
| **1 — Foundation (EXPANDED)** | Solid foundations: not just scaffold | Yo Office → Vite eject; XML manifest + 3 hosts + shared runtime; Task Pane shell with host dispatch; 6 ribbon stubs; `DocumentAdapter` interface + 3 skeletons (`getSelection` working); typed error classes; bundle-size CI gate; Lingui i18n scaffold; Vitest harness; production hosting + CSP + cache headers |
| **2 — Provider + Settings + Onboarding + Error UX** | Gate for all AI calls | `LLMProvider`/`ImageProvider`/`StockImageProvider`; `OpenAICompatibleLLM`; aihubmix vision + image-gen; `ProviderRegistry` task-kind routing; custom provider UI; Settings store + partitioned localStorage; Onboarding modal with inline Key validation + "Get a Key" links; SSE parser; 8-class error taxonomy; single-flight + exponential backoff on 429; token cost visibility; ESLint rule banning legacy model names |
| **3 — File Upload + Lazy Parsers + Multimodal** | F4 routing through correct resolver | `src/parsers/index.ts` MIME dispatch; mammoth, SheetJS CE, pdfjs-dist (worker via `new URL`), jszip+DOMParser pptx text; HEIC→JPEG, image resize >2MB; file-size/MIME validation; long-PDF context-overflow estimator; multimodal vision routing |
| **4 — PPT (reference impl)** | Killer demo + reference adapter | `PptAdapter` full; 3 scenarios + 2 ribbon buttons; `insertSlidesFromBase64` with in-browser template; image dual-track (aihubmix + stock); `getSelectedSlides` sort-by-index workaround; NO `setSelectedDataAsync` mixing |
| **5 — Excel (parallel w/ 6)** |  | `ExcelAdapter` with two-sync rule; 3 scenarios + 2 buttons; `range.values = 2DArray` bulk writes; `suspendApiCalculationUntilNextSync`; `untrack()` for >100-proxy ops; data cleaning batches 50 rows per LLM call |
| **6 — Word (parallel w/ 5)** |  | `WordAdapter` full; 3 scenarios incl. grammar/spell dropdown (gap #1) + 2 buttons; style preservation: capture `styleBuiltIn` + font/* before `insertText("Replace")`, reapply after |
| **7 — Polish + Release** | Ship v1.0 | Sideload README + animated GIF + 30s video; manifest on GitHub Release page; privacy doc; telemetry decision (Q4/R9); AC1-AC8 verification matrix; re-run Phase 0 acceptance tests as regression; v1.0 tag |

### Research Flags

- **Phase 0** — no further research; needs explicit acceptance-test plan from 10-item checklist
- **Phase 4** — MAY need research if Phase 0 reveals new PPT API gaps
- **Phase 7** — needs focused decision-research on opt-in analytics platforms (Plausible / PostHog / Cloudflare Analytics) + privacy doc patterns from comparable OSS (Continue, Cline)
- **Skip research:** Phases 1, 2, 3, 5, 6 — architecture docs exhaustive; patterns canonical or replicate Phase 4

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Office Add-in conventions, React 19, Fluent UI v9, Zustand, parsers all backed by official docs + 2026 community consensus |
| Features | HIGH | Competitor coverage verified across 30+ sources |
| Architecture | HIGH | Microsoft Learn + OfficeDev GitHub. Shared-runtime pattern non-negotiable per official docs |
| Pitfalls | HIGH | Linked to GitHub issues #5022, #3618, #5896, #4577, #258, #4805 |
| **Overall** | HIGH | 4 independent agents converged on same conclusions |

### Gaps to Address (need human or Phase 0 decision before roadmap finalization)

- **CORS verdict** (Phase 0 item #1) — CATASTROPHIC if either rejects. OQ-6.
- **DeepSeek-V4 multimodal model ID** (Phase 0 #4) — PRD Q6/R2
- **PowerPoint Web write-back parity** (Phase 0 #2)
- **`Office.context.partitionKey` behavior across hosts** (Phase 0 #3)
- **Image library: Unsplash vs Pexels** (PRD Q1, OQ-7)
- **Telemetry / success metric decision** (PRD Q4, OQ-5)
- **Ribbon button final selection** (PRD Q5, OQ-3)
- **PRD F5 storage correction approval** (OQ-1)
- **Phase 1 expansion approval** (OQ-2)
- **v1.0 gaps #1, #4, #5 inclusion** (OQ-4)

---

## Sources (top-level)

- Microsoft Learn — Office Add-ins manifest, shared runtime, persist state, addressing same-origin, Excel performance, PowerPoint requirement sets, Fluent UI quickstart
- DeepSeek API docs + change log (legacy model retirement 2026-07-24)
- OfficeDev/office-js bug reports #5022, #3618, #5896, #4577, #258, #4805, #6513 (Feb 2026 stability letter)
- `@microsoft/office-js` npm DEPRECATED notice
- May 2026 Copilot ribbon Dynamic Action Button rollback (Windows News)
- ExtraBB/Office-Addin-React-Vite-Template, jozefizso/vite-plugin-office-addin
- Continue's LLM Abstraction Layer, lunary-ai/abso
- DeepSeek V4 Guide (Codersera), V4 Vision (MindStudio)
- Vercel AI SDK Issue #3041 (confirms SDK not browser-first)

Per-topic sources: see individual research files.
