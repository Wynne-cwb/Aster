# Pitfalls Research — Aster Office.js Add-in

**Domain:** Cross-host Office.js Add-in (PPT/Excel/Word for Web), BYO LLM key, no backend
**Researched:** 2026-05-26
**Confidence:** HIGH for documented Office.js behaviors and DeepSeek API; MEDIUM for 2026-specific bundler/Vite edge cases; MEDIUM for PowerPoint Web parity claims (need Phase 0 spike to confirm against current `requirementSet` matrix)

This document expands PRD risks R1-R6 and surfaces what the PRD missed. Each pitfall has: severity, PRD-risk linkage (if any), warning signs, prevention, phase responsibility, and recovery cost.

---

## Critical Pitfalls

### Pitfall 1: Locking architecture before verifying PowerPoint Web write-back parity

**Severity:** CRITICAL
**PRD link:** Expands R1 (insufficient — PRD treats R1 as "verify and downgrade"; reality is "verify or scope-cut a Goal").

**What goes wrong:**
The PPT Goal section promises three killer scenarios — "主题→大纲 N slides", "选中 slide 配图", "大段文字→bullet". The first two depend on inserting brand-new slides programmatically and inserting images into a specific (non-active) slide. Both are areas where the PowerPoint JS API has **known gaps and bugs even on Windows**, and the Web parity story for the PowerPoint requirement set lags Word/Excel substantially.

Specific known gaps that affect Aster's PPT killer scenarios (confirmed from `OfficeDev/office-js` issues and `learn.microsoft.com` requirement-set docs):

| Aster operation | Modern API | Known issues |
|---|---|---|
| Insert new slide from template | `presentation.insertSlidesFromBase64(b64, {targetSlideId, formatting})` — PowerPointApi 1.2+ | Formatting fidelity bugs reported on Desktop (issue #5896); requires a host pptx serialized as base64 — not a "compose slide from text" API |
| Insert image into a **specific** slide | `PowerPoint.run` + `slide.shapes.addImage` (preview) OR legacy `setSelectedDataAsync` | `setSelectedDataAsync` only inserts on the **active** slide. Mixing `setSelectedDataAsync` image insertion with subsequent `PowerPoint.run` calls **hangs `context.sync()` indefinitely** (issue #5022). |
| Get selected slides | `presentation.getSelectedSlides()` 1.5+ | Returns slides in **wrong order on PowerPoint Web** (issue #3618). |
| Replace slide content / set a slide's title | No first-class API — must manipulate shapes by index | Shapes-on-a-slide enumeration depends on requirement set 1.4+; preview APIs may be needed |
| Apply theme / change template to existing slides | **Not supported at all** | Confirmed by Microsoft Q&A — no slide-master / theme engine in Office.js |

**Why it happens:**
PRD R1 mitigation says "spike, then downgrade to copy-paste". This treats it as a binary. In reality, "PPT 一键大纲" needs Aster to programmatically *create slides with new text content*, which is closer to `insertSlidesFromBase64` (requires a template pptx, not freeform) than to "compose slides API". The right output of the spike is not "yes/no API works" but "which exact sequence of API calls produces the desired user-visible result on Web".

**Warning signs (early detection):**
- Any spike that says "PowerPoint.run worked, we can ship" without producing the **full end-to-end flow** (text → N populated slides, each with title + bullets, inserted at correct position, visible to user immediately).
- Spike validates `slides.add()` but doesn't validate populating the new slide with text content / layout.
- Spike runs on Windows Desktop and assumes Web parity.
- Spike skips "用户选中 slide 配图" — image-on-non-active-slide is the single trickiest PPT operation in this product.

**Prevention strategy:**
1. **Phase 0 spike MUST produce a hello-world Aster build that completes each PPT killer scenario end-to-end on PowerPoint Web (not Desktop, not Mac, Edge + Chrome).** Acceptance: video of operation working, not "API doesn't throw".
2. Use `Office.context.requirements.isSetSupported('PowerPointApi', 'X.Y')` runtime checks for every API call, even for the minimum set you depend on, so deprecated platforms degrade gracefully.
3. Define a `PowerPointAdapter` interface where each method declares its minimum requirement set; fail fast on load if not met.
4. Pre-build a **fallback ship plan** before spike: if `insertSlidesFromBase64` text composition is impractical, the killer scenario becomes "generate Markdown outline in Task Pane, user clicks 'Insert' which uses `setSelectedDataAsync(html, {coercionType: Html})` to drop content on **current** slide one at a time". This is a real product, not a degraded one, and gives Phase 0 a known-feasible Plan B.

**Phase to address:** Phase 0 spike (gating — this is the #1 reason Phase 0 exists). If spike says "PPT scope-cut to 1-2 scenarios instead of 3", that goes back to PRD before Phase 1 starts.

**Recovery cost:** HIGH if discovered in Phase 4. Each killer scenario is publicly committed in the PRD; cutting after Phase 4 burns sunk cost and morale.

**PRD gap flagged:** R1 mitigation says "降级为生成内容到 Task Pane 用户复制粘贴". This is too weak as the **only** fallback — copy-paste in Office Web is friction-heavy (clipboard cross-iframe issues). A better Plan B is `setSelectedDataAsync` with HTML coercion, which is much closer to a real product.

---

### Pitfall 2: Mixing legacy `setSelectedDataAsync` with modern `*.run` causes infinite hangs

**Severity:** CRITICAL
**PRD link:** Not in PRD. Direct technical landmine.

**What goes wrong:**
Office.js has two object models living side-by-side: the legacy "Common API" (`Office.context.document.setSelectedDataAsync`, `getSelectedDataAsync`, callback-based) and the modern application-specific APIs (`Excel.run`, `Word.run`, `PowerPoint.run`, promise-based with `context.sync()`).

Documented bug (`OfficeDev/office-js` issue #5022): after inserting an image via `setSelectedDataAsync` in PowerPoint, *all subsequent* `PowerPoint.run` calls' `context.sync()` may **never resolve** — the bug "seems random", but is consistent enough to be a known landmine.

A solo-dev project will hit this because PPT image insertion is most easily done via the legacy API (it's the one that works on Web with the fewest preview-API headaches), but everything else (shape enumeration, slide ID lookup, title reading) wants `PowerPoint.run`.

**Why it happens:**
The two APIs use different IPC pipes to the host; mixing them creates pipe-ordering race conditions. The bug is in Office's host runtime, not the developer's code. Most blog tutorials show one API or the other but never warn about mixing.

**Warning signs:**
- `context.sync()` calls that succeed in isolation but freeze when called after `setSelectedDataAsync`.
- Add-in works on first invocation but hangs on second/third.
- Closing and reopening Task Pane unfreezes the issue temporarily.

**Prevention strategy:**
1. **Pick one API surface per host adapter** and enforce in lint. Recommendation: use `PowerPoint.run` for everything; use `setSelectedDataAsync` ONLY when there is no modern equivalent, and segregate it into its own transaction with no `PowerPoint.run` calls afterward in the same Task Pane session.
2. If you must mix, fully `await` and let the microtask queue drain (e.g., `await new Promise(r => setTimeout(r, 0))`) before the next `*.run`. This is folklore — not officially documented — and is unreliable; prefer not mixing.
3. Add an integration test that does `PowerPoint.run → setSelectedDataAsync → PowerPoint.run` and times the second sync. If >2s it's the bug.

**Phase to address:** Phase 0 (spike must include this exact sequence) and Phase 1 (lint rule, adapter design).

**Recovery cost:** MEDIUM. Refactor a host adapter to single-API. Painful if discovered after Phase 4.

---

### Pitfall 3: `context.sync()` inside loops — the Excel performance killer

**Severity:** HIGH
**PRD link:** Indirectly N3 (P95 ≤ 10s). Not explicit.

**What goes wrong:**
Excel's "AVERAGEIFS 公式" scenario will likely involve reading a column (`range.values`), inferring header row, finding distinct values, and writing back a formula range. Naive code calls `context.sync()` inside a loop over rows or columns. This:
- **Hits Office's batch queue cap of 50** — beyond that, `sync()` errors.
- Generates massive round-trip latency (each `sync` = host process IPC).
- Causes the "数据清洗" scenario to take 30+ seconds on a 5000-row sheet.
- On Excel Web specifically, exceeds the **5 MB payload limit** if syncing many tiny operations that the host coalesces into one giant payload.

**Why it happens:**
The promise-based `.load()` / `.sync()` model deceives developers into thinking each await is "just a network call". They write `for (row of rows) { await context.sync(); }` because that's what AsyncIterators feel like. The required mental model — "queue all reads, sync once, process JS-side, queue all writes, sync once" — is non-obvious.

**Warning signs:**
- Any operation taking >2s on a sheet under 1000 rows.
- DevTools network/perf tab shows >5 sync round-trips per user action.
- "数据清洗 5000 行" UX has visible per-row progress (means per-row sync).

**Prevention strategy:**
1. **Two-sync rule:** every Excel adapter method has at most 2 `context.sync()` calls — one to load, one to write. If you need 3, you're doing something wrong.
2. **Bulk writes only:** assign `range.values = 2DArray`, never `cell.values = singleValue` in a loop.
3. **`untrack()` proxy objects** explicitly when working with >100 ranges in a single transaction.
4. **Apply `suspendApiCalculationUntilNextSync()`** before large writes (cleaning data into 5000 cells will trigger formula recalc storms otherwise).
5. **Hoist invariants out of loops** — `context.workbook.worksheets.getActiveWorksheet()` is the canonical example.
6. **Chunk operations** with payload size in mind: keep each `sync()` payload under 1 MB to stay well clear of the 5 MB cap.

**Phase to address:** Phase 5 (Excel implementation). Phase 2 should establish the `ExcelAdapter` template demonstrating the two-sync pattern as the reference.

**Recovery cost:** LOW per call-site, HIGH if the entire data-cleaning architecture is row-by-row. Refactor difficulty grows with codebase size.

---

### Pitfall 4: PRD's AC6 "切换账号会丢 Key" — verify that RoamingSettings is the right scope

**Severity:** HIGH
**PRD link:** R4 + AC6 (PRD assumes this is the actual behavior — needs verification).

**What goes wrong:**
PRD F5 stores DeepSeek/aihubmix API keys in `Office.context.roamingSettings`. PRD AC6 documents the expected behavior as "切文档不丢、切 MS 账号会丢". But:

1. **`Office.context.roamingSettings` is documented as the Outlook mailbox-scoped store.** It is part of the Outlook-specific API surface. For non-Outlook add-ins (PPT/Excel/Word), the equivalent is `Office.context.document.settings` — which is **document-scoped, not user-scoped**. A key stored there is lost when the user opens a different presentation.
2. There is **no first-party "user-scoped, cross-document" persistent storage** in Office.js for non-Outlook hosts. To get user-level persistence, you must either:
   - Use `localStorage` / `IndexedDB` in the Task Pane (works because the Task Pane is hosted on your domain — same origin across documents).
   - Use Microsoft Graph user storage (requires SSO and OAuth — incompatible with "no backend").
3. RoamingSettings has a **32KB total cap** with error code 9057 when exceeded. Even if you tried to use the Outlook variant, an LLM chat history + multiple provider configs could blow this fast.
4. The RoamingSettings object is initialized from persisted storage **only on first load**. If the Task Pane reloads (e.g., user navigates away and back), in-memory state resets even if persisted state changed. First-write race conditions in onboarding are real.

**Why it happens:**
"RoamingSettings" is the most-googled Office.js storage term — most blog posts about Office add-in settings are about Outlook because Outlook is the most popular add-in host. Cross-host docs are thinner.

**Warning signs:**
- Aster works in one document, user opens a new presentation, key is gone.
- User reopens Task Pane after navigation and sees "Key not set" briefly before it loads.
- Adding new providers eventually fails with error 9057.

**Prevention strategy:**
1. **Phase 0 spike must verify the storage scope decision on all 3 hosts.** Test: set key in document A, open document B in same browser, same MS account — is key still there?
2. **For non-Outlook hosts, use `localStorage` of the Task Pane domain as the primary store**, NOT `Office.context.document.settings`. localStorage is per-origin and survives across documents. (Confirms with PRD constraint "无后台" — localStorage is browser-local, no server involved.)
3. **Account-switch behavior:** localStorage is browser-scoped, not MS-account-scoped. PRD AC6 says "切 MS 账号丢 Key" — with localStorage, key actually **survives** account switches (because it's the same Edge profile). This is *better* than PRD assumes, but is a different mental model — update PRD AC6 to reflect verified behavior.
4. **Mitigate the no-encryption risk:** localStorage is plaintext-readable by any script on the same origin (only your code, but XSS would expose). Add a clear privacy notice in onboarding.
5. **Initialization race:** all Key reads go through a single `getKey()` async function that awaits an initialization promise resolved once on Task Pane boot. No component reads localStorage directly.

**Phase to address:** Phase 0 spike (verify scope), Phase 2 (implement settings layer correctly), Phase 7 (privacy docs / README disclosure).

**Recovery cost:** MEDIUM. Migrating storage layer mid-development means existing users lose keys at upgrade time.

**PRD gap flagged:** PRD F5 says "Office RoamingSettings". This is likely the wrong API for non-Outlook hosts. PRD AC6 documents an assumed behavior that may not match the chosen API. **Both need correction after Phase 0 spike.**

---

### Pitfall 5: PowerPoint Web `getSelectedSlides()` returns slides in wrong order

**Severity:** HIGH
**PRD link:** Not in PRD. Bug-level landmine.

**What goes wrong:**
`presentation.getSelectedSlides()` (PowerPointApi 1.5) returns selected slides in **reverse order on PowerPoint Web** (issue #3618). For Aster's "选中 slide 配图" scenario, if the user selects slides 3, 5, 7 in the slide pane, the API might return them as [7, 5, 3]. Aster's "first selected slide" logic breaks silently.

**Why it happens:**
Open Microsoft bug; PRD doesn't account for individual API bugs.

**Warning signs:**
- Image inserted on wrong slide when user has multiple slides selected.
- Behavior differs between Web and Desktop testing.

**Prevention strategy:**
1. Always also call `getActiveSlideOrNullObject()` and prefer it when only one selection is meaningful.
2. If multi-slide is needed, sort the returned collection by `slide.index` (load `index` explicitly) — don't trust order.
3. Add a unit test fixture documenting this bug, and a host-detection branch.

**Phase to address:** Phase 4 (PPT killer scenarios), but the adapter contract from Phase 2 should already require index-based sort.

**Recovery cost:** LOW per bug, but multiplied across all "selected X" APIs (there are many — `Word.range.getSelection`, `Excel.workbook.getSelectedRange`, all have host quirks).

---

### Pitfall 6: Bundle size death by Fluent UI + icons + parser libs

**Severity:** HIGH
**PRD link:** N2 (≤ 1MB initial JS) — PRD has the goal but understates how aggressive the discipline must be.

**What goes wrong:**
Office Add-ins are *expected* to look like Office. Developers reach for `@fluentui/react` (v8) or `@fluentui/react-components` (v9). Either can singlehandedly burn the 1MB budget.

Concrete bundle-bloat sources documented in the wild:
- **Fluent UI v8 barrel imports:** `import { Button } from '@fluentui/react'` pulls the entire react package via barrel re-export. Fix: `import { Button } from '@fluentui/react/lib/Button'`.
- **Fluent UI v9 icons:** `@fluentui/react-icons` has 2000+ icons; naive imports pull ~4MB unminified. Direct-path imports are mandatory.
- **Side-by-side v8 + v9:** developers mid-migration end up with both; both are large.
- **TypeScript module resolution:** wrong `tsconfig.json` (e.g., `"module": "commonjs"`) defeats tree-shaking. Must be `"module": "esnext"` or `"es2015"`, `"moduleResolution": "node"` or `"bundler"`.
- **lodash full import** vs `lodash-es` + specific imports.
- **Parser libs imported eagerly** instead of dynamic import. mammoth/SheetJS/pdf.js are each multi-hundred-KB.
- **Polyfills auto-injected** by `core-js` / Babel for legacy targets. Office Web only needs modern Edge/Chrome — `targets: "Chrome >= 120, Edge >= 120"` is fine.
- **Provider SDKs:** OpenAI's JS SDK is ~200KB; not worth shipping when 5 lines of `fetch` does the job.
- **pdf.js main bundle:** ~500KB even without worker. Always lazy-load.

**Why it happens:**
The 1MB target is invisible until production build. Solo devs trust their bundler ("vite is fast, so it must be small").

**Warning signs:**
- `npm run build` output >1MB for `index.js` or `main.js` at first push to git.
- No bundle analyzer in package.json scripts.
- Production builds untested on real network (works fine on localhost).

**Prevention strategy:**
1. **CI bundle-size gate from Phase 1, day 1.** `size-limit` or `webpack-bundle-analyzer` with hard cap. Build fails at >1MB initial. Cap is BEFORE gzip — gzip should bring it to ~300KB.
2. **Lazy-load every parser library** with `await import()` triggered by user action (file upload). They never touch the initial bundle.
3. **Lazy-load every provider call site** similarly — split DeepSeek client and aihubmix client into separate chunks.
4. **Choose Fluent UI v9 (`@fluentui/react-components`) over v8** — better tree-shaking. But carefully: v9 lacks `Stack`; you'll write flex CSS.
5. **No OpenAI SDK / Anthropic SDK** — write `fetch` calls directly. Provider SDKs are huge for what they do.
6. **`sideEffects: false`** in package.json of your own packages.
7. **Set browserslist to modern targets only** — `Edge >= 120, Chrome >= 120` aligns with PRD compatibility constraint.

**Phase to address:** Phase 1 (CI gate + tsconfig + browserslist), Phase 3 (lazy-load parsers — already in PRD F4), Phase 2 (provider SDK structure).

**Recovery cost:** HIGH if discovered in Phase 7. The cleanest fix is sometimes "rewrite the UI in lighter library", which is weeks of work.

---

### Pitfall 7: pdf.js worker setup is bundler-specific and often broken in production

**Severity:** HIGH
**PRD link:** PRD F4 — listed but underestimated.

**What goes wrong:**
pdf.js requires a **separate worker JS file** loaded at runtime. The main thread is small-ish (~500KB); the worker is ~1.5MB. The worker URL must be set via `pdfjsLib.GlobalWorkerOptions.workerSrc` or `workerPort` BEFORE first `getDocument()` call. Configuration depends entirely on bundler:

- **Vite known bug:** the `?url` import of `pdfjs-dist/build/pdf.worker.js?url` works in dev mode but **breaks in `vite build` production mode** when combined with React.lazy / dynamic import of the parent component (`wojtekmaj/react-pdf` issues #1843, #1148).
- **Webpack:** must use `pdfjs-dist/webpack` auto-config OR `new Worker(new URL(...), import.meta.url)` pattern with Webpack 5+.
- **Version mismatch:** worker version MUST exactly match `pdfjs-dist` package version. Silent failures with cryptic "Failed to fetch" errors otherwise.
- **ESM vs CJS:** recent pdfjs-dist ships `.mjs` worker. Bundler config must allow `.mjs` resolution.
- **Office Add-in iframe context:** the Task Pane is in an iframe with a specific origin (your https host). Workers must be loaded from the same origin OR have CORS headers. If you accidentally point `workerSrc` to a CDN, this may fail.
- **`sideload` localhost:** Office sideload often uses HTTPS over localhost with self-signed certs. Worker loading sometimes fails in this configuration without explicit `worker-src` CSP.

**Why it happens:**
pdf.js predates modern ES module conventions; its packaging is hybrid. Solo devs copy-paste a snippet from StackOverflow that works for someone else's bundler.

**Warning signs:**
- "Setting up fake worker failed" error in console.
- pdf.js works in `npm run dev` but fails in `npm run build` preview.
- Different behavior in Edge vs Chrome (one has the worker cached, one doesn't).

**Prevention strategy:**
1. **Phase 0 mini-spike: get pdf.js loading a 5MB PDF in production-built Aster running on the chosen hosting platform (GitHub Pages / Cloudflare Pages).** Not localhost. Not dev mode.
2. Use Vite's `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` pattern (or Webpack 5 equivalent) instead of `?url` imports — more reliable across modes.
3. Lock pdf.js version in package.json — avoid `^` semver bumps that can mismatch worker.
4. Add a `worker-src 'self' blob:` CSP if your hosting requires CSP (Cloudflare Pages does by default).
5. Self-host worker file; never CDN.

**Phase to address:** Phase 0 (spike production build), Phase 3 (full integration).

**Recovery cost:** LOW per attempt, but can burn 1-2 days if you don't know the patterns.

---

### Pitfall 8: pptx browser parsing is harder than PRD R3 acknowledges

**Severity:** HIGH
**PRD link:** R3 (PRD acknowledges complexity but downgrade plan is "list as 不支持" — likely too aggressive).

**What goes wrong:**
A pptx file is a ZIP containing OOXML (`presentation.xml`, `slide1.xml`, etc.) + media files + theme XML. Browser-side parsing requires:
- A ZIP reader (jszip or fflate — both work, fflate is ~10x smaller).
- An XML parser that handles namespaces (browser native `DOMParser` works but is finicky).
- Walking slides → shapes → text runs → applying paragraph/run properties.

Open source libs that do this:
- `pptx-parser` — sparse maintenance, last meaningful commit years ago.
- `nodejs-pptx` — Node-only, not browser.
- `pptxtojson` — sometimes recommended; bundle size is significant.
- Custom: jszip + DOMParser + manual XPath. Roll your own = days of work.

For Aster's MVP scope (extract text from uploaded pptx for LLM context), the simplest is: jszip → read each `ppt/slides/slide*.xml` → DOMParser → extract all `<a:t>` text nodes → join. ~80 lines of code. **No third-party pptx lib needed.**

**Why it happens:**
R3 mitigation says "如开源库不可用，pptx 列入不支持列表". This is unnecessarily conservative — the minimal "extract text" use case is achievable without a pptx library.

**Warning signs:**
- Time-boxed evaluation of `pptx-parser` reveals broken builds, version pin issues.
- "We can't parse pptx" decision made before trying the jszip + DOMParser approach.

**Prevention strategy:**
1. **Phase 0 mini-spike:** in 2 hours, write jszip + DOMParser code to extract all text from a pptx. If achieved, R3 is closed without dependency.
2. Lazy-load jszip; ~30KB minified.
3. Document explicit non-goals: do NOT parse `<a:srgbClr>` colors, do NOT preserve table structure, do NOT extract images. Text only.
4. Make it clear in onboarding that pptx upload extracts text only.

**Phase to address:** Phase 0 (spike text extraction), Phase 3 (implement).

**Recovery cost:** LOW if discovered early. The "drop pptx support" downgrade is mostly free; the gain (full text extraction) is real.

**PRD gap flagged:** R3's downgrade path is too pessimistic. A "text-only pptx via jszip" path is feasible and worth attempting before declaring failure.

---

### Pitfall 9: Streaming fetch + AbortController must handle Office Task Pane lifecycle

**Severity:** HIGH
**PRD link:** F6 (streaming) — PRD doesn't address cancellation semantics.

**What goes wrong:**
DeepSeek streaming responses arrive as SSE. A typical streaming response runs for 5-30 seconds. During that time, several things may happen:
- User clicks "新对话" / cancel button.
- User switches slide / cell / document (PPT scenarios in particular have a strong "selection changed" event).
- User closes the Task Pane (which doesn't reload, but pauses the iframe).
- Network drops or DeepSeek hits a 429.
- Office host triggers add-in reload (rare but happens, e.g., on long idle).

Without proper `AbortController` handling, you get:
- Multiple concurrent streams hitting the same React state (race conditions, tokens interleaved).
- "setState on unmounted component" warnings.
- Memory leaks (stream readers never closed).
- Spurious LLM costs (DeepSeek charges per token streamed even if you stopped reading).
- "First token" timer in the UI gets stuck because old stream is hung.

**Why it happens:**
React + fetch streaming + AbortController is a recently-stabilized pattern. Solo dev may copy-paste a non-cancellation-aware example.

**Warning signs:**
- Sending a second prompt while first is streaming causes garbled output.
- Network tab shows EventStream still active after user pressed cancel.
- DeepSeek bills more tokens than UI displayed.

**Prevention strategy:**
1. **One `AbortController` per request**, owned by the in-flight LLM call. Stored in a `useRef` or class instance.
2. On new request: `controller.abort()` previous → null out reference → create new controller → fire new request.
3. **On Task Pane close detection:** listen for `visibilitychange`; on hidden → abort. (Office.js does not expose a clean "task pane closing" event; visibilitychange + beforeunload is the cross-host way.)
4. **Wrap reader loop in try/finally** that calls `reader.cancel()`.
5. Detect `AbortError` in catch and **don't** surface it as user error.
6. Add explicit UX: stream-in-progress shows a "Stop" button that triggers `controller.abort()`.
7. Single-flight per provider — prevent UI from firing 2 simultaneous DeepSeek calls.

**Phase to address:** Phase 2 (Provider abstraction must take an `AbortSignal`).

**Recovery cost:** MEDIUM — re-architecting the streaming layer to be cancellation-aware late means touching every UI component that displays tokens.

---

## Moderate Pitfalls

### Pitfall 10: DeepSeek's "dynamic rate limit" gives no headroom signal

**Severity:** MEDIUM
**PRD link:** R6 partial (PRD covers context overflow; doesn't cover throughput).

**What goes wrong:**
DeepSeek API has **no published rate limit table**. Limits are dynamic, server-load-dependent. You hit a 429 with no `X-RateLimit-Remaining` header to plan against. The `Retry-After` header may or may not be present.

For Aster, this affects:
- Phase 5 Excel "数据清洗 5000 行" — if cleaning calls DeepSeek per row (it shouldn't), 429s will flood.
- User stress-testing the Task Pane with rapid-fire prompts.
- Demo videos that hammer the API.

**Why it happens:**
DeepSeek doesn't publish limits; users learn empirically. Codebases that assume "OpenAI-compatible == OpenAI-rate-limit-semantics" misbehave.

**Prevention strategy:**
1. **Single-flight queue per provider** — at most 1 in-flight DeepSeek call from Aster at a time. Queue UI commands.
2. **Exponential backoff on 429** with jitter; respect `Retry-After` when present.
3. **Surface 429s as actionable** — "DeepSeek is throttling, retrying in 5s..." not "Network error".
4. **Never iterate user data through LLM** in a per-row loop. Always batch into one prompt (e.g., "clean these 50 addresses, return JSON array").
5. Cache aggressive prompt prefixes if available (DeepSeek supports prefix caching).

**Phase to address:** Phase 2 (provider abstraction with queue + retry), Phase 5 (Excel scenarios must batch).

**Recovery cost:** LOW per provider, MEDIUM if entire scenario design assumed unlimited concurrency.

---

### Pitfall 11: DeepSeek-V3/V4 model name migration deadline

**Severity:** MEDIUM
**PRD link:** Not in PRD.

**What goes wrong:**
PRD specifies `deepseek-v4-pro` and `deepseek-v4-flash` (correct, current). Code samples and copy-pasted snippets in the wild use legacy aliases `deepseek-chat` and `deepseek-reasoner`. Per 2026 DeepSeek docs: **legacy aliases are deprecated and fully retired after July 24, 2026.** After that date, requests using those names fail with 400.

**Why it happens:**
Solo dev copy-pastes from older blog posts / tutorials.

**Warning signs:**
- Code anywhere in repo using `deepseek-chat`, `deepseek-reasoner`.
- Settings UI offering legacy model names as options.

**Prevention strategy:**
1. **Model name allowlist** in provider abstraction — hardcode `deepseek-v4-pro`, `deepseek-v4-flash`, fail loudly for anything else.
2. ESLint rule banning legacy strings.
3. If supporting "thinking mode" for hard math (was `deepseek-reasoner`), use `model: 'deepseek-v4-flash'` with `thinking: {type: 'enabled'}` parameter.

**Phase to address:** Phase 2 (provider abstraction).

**Recovery cost:** LOW.

---

### Pitfall 12: aihubmix base64 image vision quirks

**Severity:** MEDIUM
**PRD link:** R2 partial (covers DeepSeek multimodal uncertainty, not aihubmix gotchas).

**What goes wrong:**
PRD F4 says image upload goes to "multimodal Provider (default aihubmix vision)". aihubmix is OpenAI-compatible. OpenAI-compatible base64 image vision has documented warts:
- Format must be `data:image/png;base64,...` or `data:image/jpeg;base64,...`. Some providers reject base64 entirely and require URL.
- Image must be ≤ 20MB; some providers fail at 5MB.
- Only PNG / JPEG / GIF / WebP — Office screenshot tools often produce BMP or HEIC.
- Mixed content blocks (text + image_url) must follow exact order; some providers fail "Invalid chat format" otherwise.
- aihubmix specific: **calls are billed even on generation failure.**
- aihubmix specific: image generation moderation blocks names of living artists ("宫崎骏" etc.) — surface this as a user error, not generic failure.

**Prevention strategy:**
1. **MIME-type detect + convert** before upload — if user uploads HEIC, convert to JPEG (canvas dance) or reject with clear message.
2. **Resize images >2MB to ≤1920px** before base64 — saves tokens and works around provider size caps.
3. **Catch moderation_blocked specifically** and offer prompt rewrite hint.
4. **Don't retry image generation 429s** silently — every retry burns money.

**Phase to address:** Phase 3 (file upload) + Phase 4 (PPT 配图 scenario).

**Recovery cost:** LOW.

---

### Pitfall 13: Word `insertText("Replace")` strips paragraph styles silently

**Severity:** MEDIUM
**PRD link:** F8 ("替换选中文本（保留基本样式）") — PRD says "保留基本样式" but the API doesn't guarantee it.

**What goes wrong:**
`Word.Range.insertText(text, "Replace")` returns a Range. The returned Range's font/style **may not match the original**, depending on whether the original Range spanned a full paragraph or sub-range. Replacing a whole paragraph with `insertText("Replace")` does NOT preserve `Heading 1` style automatically — you must re-apply `styleBuiltIn`. The "Word 多风格润色" scenario will silently strip bold/italic/heading levels of pasted text.

Additional documented bug: on Mac with Office 365, `insertText('Replace')` on a search-result range **silently fails** (no error, no change). This affects Mac users in v1.1 stretch.

**Prevention strategy:**
1. Before replacement: `load("styleBuiltIn", "font/*")` on original range; sync.
2. After replacement: re-apply captured styles to the returned Range.
3. Prefer **sub-range replacement** (find a sub-string and replace just that) over **paragraph replacement** when possible — preserves surrounding style automatically.
4. For Mac (v1.1): test the search-result-replace flow explicitly. Known bug, may still be open.

**Phase to address:** Phase 6 (Word implementation).

**Recovery cost:** LOW.

---

### Pitfall 14: HTTPS hosting cache-control gotcha for icon images

**Severity:** MEDIUM
**PRD link:** Not in PRD.

**What goes wrong:**
Office Add-in manifest references icon images by URL. **The hosting server must NOT return `Cache-Control: no-cache` or `no-store` for icon URLs** — Office requires icons to be cacheable. Default Vercel / Cloudflare Pages / GitHub Pages settings vary:
- GitHub Pages: defaults to short cache, usually OK.
- Vercel: defaults to immutable for hashed assets, OK for icons.
- Cloudflare Pages: default OK but `_headers` file can break it.
- Localhost dev: typically `no-cache` — Office shows "icon not loading" warnings in sideload.

If the manifest references the start page URL and the server sends wrong Cache-Control, sideload mysteriously fails or icons go missing.

**Prevention strategy:**
1. For prod hosting, verify icon URLs return `Cache-Control: public, max-age=3600` or longer.
2. Use long-lived hash-suffixed URLs for icons (`icon-32-a1b2c3.png`) — bundlers do this automatically.
3. Include `<meta http-equiv="Cache-Control">` is NOT a substitute — Office reads the actual HTTP header.

**Phase to address:** Phase 1 (manifest + hosting setup).

**Recovery cost:** LOW.

---

### Pitfall 15: `<AppDomains>` (XML manifest) vs `validDomains` (unified manifest) confusion

**Severity:** MEDIUM
**PRD link:** Not in PRD.

**What goes wrong:**
For Aster to call `api.deepseek.com` and `aihubmix.com` from the Task Pane (Web), **no `<AppDomains>` entry is strictly required**. The `<AppDomains>` element trusts external domains for **navigation within the task pane root (Desktop only)** and **iframe Office.js access** — NOT for fetch/CORS to external APIs. The browser's same-origin policy applies regardless of manifest.

This is a common confusion: developers add `<AppDomains>` for `api.deepseek.com` expecting it to enable CORS-free calls. It doesn't. CORS is enforced by the API endpoint server's headers.

- DeepSeek API: does it set `Access-Control-Allow-Origin: *`? — verify in Phase 0.
- aihubmix API: same question.
- If either does NOT allow browser-origin CORS, Aster's "no backend" constraint is **broken** — calls must go through a proxy.

**Why it happens:**
The Microsoft docs are clear about `<AppDomains>` being for navigation, but the name suggests "permitted external domains".

**Warning signs:**
- Adding domains to `<AppDomains>` doesn't fix the issue.
- Fetch fails with "CORS policy" error, not "permission denied".

**Prevention strategy:**
1. **Phase 0 spike must call DeepSeek + aihubmix from a real Task Pane on real https origin**, not curl, not localhost (localhost can have different CORS allowlists). Verify response headers include `Access-Control-Allow-Origin` matching your Task Pane origin OR `*`.
2. If CORS fails: hard pivot needed. Options:
   - DeepSeek explicitly supports CORS from browser? Need to verify. (As of 2026, DeepSeek API docs don't mention CORS explicitly.)
   - User-provided backend / Cloudflare Worker proxy (violates "无后台" — major PRD revision).
   - Use a community-provided proxy (security risk for BYO Key).
3. Add `<AppDomains>` for DeepSeek and aihubmix **anyway** — for the Desktop-version (v1.1) navigation safety, even though Web doesn't require it.

**Phase to address:** Phase 0 spike (CORS verification is GATING for the entire product).

**Recovery cost:** CATASTROPHIC if CORS blocks direct browser calls. The whole "no backend" premise of Aster collapses. This is a real "spike-must-prove" item before Phase 1 starts.

**PRD gap flagged:** Neither PRD nor PROJECT.md call out CORS-from-browser as a Phase 0 spike requirement. **Add to Phase 0 acceptance.**

---

### Pitfall 16: Provider SDK choice — don't import the OpenAI Node SDK

**Severity:** MEDIUM
**PRD link:** Implicitly N2 (bundle size).

**What goes wrong:**
DeepSeek docs say "use the OpenAI SDK with `base_url` override". The `openai` npm package is ~250KB minified, has Node-style dependencies (form-data, file polyfills), and is designed for server use, not browser. Adding it for Aster means:
- ~250KB bundle hit for what is ultimately `fetch + JSON.parse`.
- Polyfills bloat further.
- SSE streaming may misbehave under browser fetch vs Node fetch differences.

A direct `fetch` to `https://api.deepseek.com/chat/completions` with a custom SSE reader is ~80 lines and 0 KB.

**Prevention strategy:**
1. **No `openai` or `anthropic` npm packages** in Aster. Write provider clients directly with `fetch`.
2. Single shared SSE parser utility.
3. Provider abstraction (PRD F3) makes this easier — each provider is just a thin `fetch` wrapper.

**Phase to address:** Phase 2 (provider architecture).

**Recovery cost:** LOW per provider.

---

### Pitfall 17: Manifest `Hosts` / `Capabilities` mismatch between PPT/Excel/Word

**Severity:** MEDIUM
**PRD link:** N1 (cross-platform API subset) — adjacent.

**What goes wrong:**
The XML manifest declares `<Hosts><Host Name="Document" /><Host Name="Workbook" /><Host Name="Presentation" /></Hosts>` and requirement sets per host. Common mistakes:
- Declaring `PowerPointApi 1.5` requirement at the top-level — this **blocks load in Excel/Word** because they don't support PowerPointApi at all.
- Missing per-host requirement sets — add-in loads on Web but fails to register Ribbon buttons because the button's function requires an API set not declared.
- One host loads fine, another doesn't, with cryptic "Add-in failed to load" errors.

For Aster: 3 hosts × 2 Ribbon buttons each × different APIs = high risk of per-host misconfiguration.

**Prevention strategy:**
1. **One add-in manifest, with per-host VersionOverrides.** Don't try to ship 3 manifests.
2. **Per-host requirement sets via `<Requirements>` under each `<Host>`** in VersionOverrides.
3. Use `Office.context.requirements.isSetSupported()` at runtime even for declared requirements — defense in depth.
4. **Manual sideload test on each host before claiming a Phase milestone done.**

**Phase to address:** Phase 1 (manifest setup), revisit Phase 4/5/6 as each host's APIs solidify.

**Recovery cost:** LOW per host.

---

### Pitfall 18: Sideload distribution friction — README + manifest URL

**Severity:** MEDIUM
**PRD link:** R4 partial (BYO Key friction); R4 doesn't mention sideload friction.

**What goes wrong:**
PRD constraint: "v1 仅 sideload + 开源仓库 manifest, 不走 AppSource". Sideload steps for Office for Web:
1. Open Office.com in Edge/Chrome.
2. Open a document.
3. Insert → Get Add-ins (or Office Add-ins).
4. "Upload My Add-in" → browse to a local manifest.xml.
5. Confirm.

The user needs the **manifest XML file** locally. Hosting the manifest at `https://aster.example.com/manifest.xml` doesn't help — Office on Web does NOT support "load manifest from URL"; only manual file upload. (Outlook on Web does; PPT/Excel/Word on Web does not, per current docs.)

This means README must say "download manifest.xml from this GitHub release". Each manifest update requires user re-sideloads.

**Why it happens:**
PRD doesn't analyze the actual install UX of sideload-only distribution.

**Warning signs:**
- README "Install" section is more than 5 bullet points.
- Users in issues say "I clicked the link and nothing happened".

**Prevention strategy:**
1. **One-click sideload page:** README links to a GitHub Release page where users download manifest.xml in one click. Bundle a 30-second screen recording.
2. **Manifest does NOT need updates for code changes** — manifest references your start page URL, which serves the latest code. Update manifest only when API surface (Ribbon buttons, requirement sets) changes.
3. **Versioning discipline:** treat manifest XML changes as breaking changes for users. Notify in release notes.
4. **Test sideload on a fresh browser profile** as part of Phase 7 release process.

**Phase to address:** Phase 7 (sideload docs), but architecture decisions in Phase 1 (manifest stability) affect this.

**Recovery cost:** LOW.

---

### Pitfall 19: No-backend = no telemetry = no product iteration signal

**Severity:** MEDIUM
**PRD link:** Not in PRD. **PRD gap.**

**What goes wrong:**
PRD constraint: "无后台". Combined with "v1 内存级聊天历史" and "no AppSource", Aster has **no signal of what users do** — no analytics, no error tracking, no "Ribbon button X was clicked Y times". This is intentional (privacy-aligned) but creates a real product problem:
- Q4 (PRD Open Question) — "成功标准的量化目标" — can't be measured.
- Bug reports come only when users open GitHub issues, biasing toward power users.
- "Phase 4 PPT scenarios" success is measured by author's own use; PMF signal weak.

**Prevention strategy:**
1. **Explicit opt-in anonymous telemetry, hosted on third-party privacy-respecting platform** (Plausible / PostHog Cloud free tier / Cloudflare Analytics). Counts only "Aster opened", "Ribbon button clicked", "AI call started". No content, no Key, no user ID.
2. **Make opt-in default OFF**, with onboarding step: "Help improve Aster — enable anonymous usage stats? [Yes/No]".
3. **README + privacy doc** must explicitly state what is and isn't collected.
4. **GitHub repo "tell us how it went" issue template** as additional qualitative channel.
5. **Or accept the constraint as truly binding** — explicitly write into PROJECT.md "we measure success only by GitHub stars + issue reports".

**Phase to address:** Phase 7 (post-MVP / release).

**Recovery cost:** LOW per decision, but the cost of not deciding is months of building without feedback.

**PRD gap flagged:** PRD has no explicit "how do we know if Aster works" loop. Q4 open question is real and unaddressed. **Decision needed before Phase 7.**

---

## Minor Pitfalls

### Pitfall 20: Office.context.requirements.isSetSupported() returns false for newer API sets on older Office Web builds — silent fallback

**Severity:** LOW

**Prevention:** Always have a fallback branch. Don't `throw` if a feature isn't supported — degrade UX.

**Phase:** Phase 2 (provider/adapter base classes).

---

### Pitfall 21: Office Add-in iframe has `unload` / `beforeunload` events that don't fire reliably

**Severity:** LOW

**What goes wrong:** Saving chat history on tab close via `beforeunload` doesn't work reliably in Office iframes. Use `visibilitychange` + interval save instead.

**Phase:** Phase 2 (settings layer).

---

### Pitfall 22: Office.js initialization timing — `Office.onReady()` must wrap all entry points

**Severity:** LOW

**What goes wrong:** Calling Office APIs before `Office.onReady()` resolves throws "Office is not loaded". React apps often try to render before this is done.

**Prevention:** Block render with a Suspense boundary that resolves only after `Office.onReady()`.

**Phase:** Phase 1.

---

### Pitfall 23: `RequestedRuntimes` element confusion

**Severity:** LOW

**What goes wrong:** Newer manifest spec allows `<Runtimes>` element for shared/event-based runtime declaration. Old templates omit it; new APIs (e.g., custom functions) may require it. For Aster (Task Pane only, no custom functions), default settings are fine — don't over-configure.

**Prevention:** Use Yeoman generator (`yo office`) defaults; only edit when adding features.

**Phase:** Phase 1.

---

### Pitfall 24: React Suspense + streaming UI race

**Severity:** LOW

**What goes wrong:** Streaming token updates trigger `setState` in a Suspense boundary's child. If the boundary unmounts mid-stream (user switches Task Pane tab), React warns about state on unmounted component.

**Prevention:** Already covered by AbortController pattern (Pitfall 9). Additionally, use `useSyncExternalStore` for the streaming store — Suspense-aware.

**Phase:** Phase 2.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use `setSelectedDataAsync` everywhere | Fewer API surfaces to learn | Hangs when mixed; locks out targeted-slide ops | Never for Aster — Phase 0 must commit to `*.run` |
| Bundle parser libs eagerly | Simpler imports | Burns N2 budget on startup | Never |
| Ignore `untrack()` for proxy objects | Simpler code | Memory pressure on Excel 5000-row scenarios | OK if all transactions <100 proxies |
| Use OpenAI Node SDK for DeepSeek | Familiar API | +250KB bundle, browser-incompat surprises | Never |
| Skip CORS verification on DeepSeek | Move fast in spike | Discover at Phase 5 that whole architecture fails | Never — gate Phase 0 |
| Skip per-host sideload tests | Move fast | Discover host-specific bugs at Phase 7 | Never |
| Skip bundle-size CI gate | Move fast in Phase 1 | Reach Phase 7 at 3MB; refactor weeks | Never — gate from Phase 1 |
| Treat RoamingSettings as user-scope | Less code than localStorage | Wrong scope for non-Outlook hosts; data loss | Never for Aster |
| Use `<AppDomains>` to "enable" external API calls | Feels safer | Doesn't do anything; masks real CORS issue | Add anyway for Desktop nav safety; don't rely on it |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| DeepSeek streaming | Buffer entire response then display | SSE reader, dispatch on each chunk |
| DeepSeek model name | Use `deepseek-chat` / `deepseek-reasoner` | Use `deepseek-v4-flash` / `deepseek-v4-pro` (legacy retired 2026-07-24) |
| DeepSeek 429 | Retry immediately | Exponential backoff, respect `Retry-After`, queue serialize |
| DeepSeek 402 | Treat as transient | It's "insufficient balance" — surface clearly |
| aihubmix vision | Upload HEIC base64 | Convert to PNG/JPEG ≤ 20MB ≤ 1920px first |
| aihubmix image gen | Allow "Hayao Miyazaki" in prompt | Filter living-artist names; suggest style alternatives |
| pdf.js worker | Set workerSrc via CDN | Self-host worker, lock version, use `new URL(..., import.meta.url)` |
| SheetJS on 50MB xlsx | Parse in main thread | Web Worker + dense mode + chunk to CSV |
| mammoth.js | Expect formatting parity | Treat as semantic-only; document UX caveat |
| pptx upload | Use heavyweight pptx-parser | jszip + DOMParser + `<a:t>` extraction (80 lines) |
| Office.js CORS | Add `<AppDomains>` and expect CORS bypass | CORS is enforced by API server; check `Access-Control-Allow-Origin` in spike |
| Office.js API mixing | Combine `setSelectedDataAsync` + `PowerPoint.run` | Pick one; segregate hard if you must mix |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `context.sync()` in loop | >2s for small ops | Two-sync rule per adapter method | >50 iterations: hard error |
| Eager parser imports | First load >1MB | `await import()` on user action | Always |
| No `AbortController` on streams | Memory growing per prompt | Single-flight + abort on Task Pane hide | 5+ prompts/session |
| Per-row LLM calls | Excel cleaning takes minutes | Batch 50 rows per prompt | >100 rows |
| Cell-by-cell write | Slow + flicker | `range.values = 2DArray` | 1000+ cells |
| No `untrack()` | Memory creep across operations | Untrack 100+ proxy objects | 5000+ row scenarios |
| Full lodash import | +70KB | `import x from 'lodash/x'` or `lodash-es` | Always |
| Fluent UI barrel | +500KB | Scoped imports / v9 + direct paths | Always |
| Synchronous large JSON | UI freeze | Stream-parse or move to Worker | >5MB |
| Re-querying inside loop | Slow per-iteration | Hoist invariants | Loops >100 |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Store DeepSeek Key in plaintext localStorage | Key visible to any same-origin XSS | Disclose in onboarding + privacy doc; review React for XSS vectors |
| Use any 3rd-party "API key proxy" service | User's key sent to unknown server | Never. Direct browser → Provider only |
| Render LLM HTML output via `dangerouslySetInnerHTML` | LLM-injected XSS | Sanitize via `DOMPurify` or render Markdown to React, not HTML |
| Trust file upload MIME type from browser | Spoofed types crash parsers | Verify by file header (jszip can detect pptx by ZIP signature) |
| Log full prompt + completion to console | API content leaks in shared screen | Debug logs gated by env flag |
| Embed API key in error reports | Sensitive data in GitHub issues | Redact `Authorization` header from any auto-report |
| Allow arbitrary user-supplied "custom Provider URL" without scheme check | Phishing user to malicious endpoint that steals key | Validate scheme = https, reject http/localhost in non-dev |
| No CSP on hosted Task Pane | XSS surface increases | Set `Content-Security-Policy` to allow only your origin + Provider origins |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Show full error: "TypeError: cannot read property 'value' of undefined" | User confused, opens GitHub issue | Catch and map to "Something went wrong — try a shorter prompt" + diagnostic copy button |
| Show 401 from DeepSeek as "Network error" | User checks WiFi, not Key settings | "DeepSeek Key 无效，前往设置 →" with deep link |
| Stream completes but "Insert to document" button isn't enabled | User assumes streaming still running | Distinct "done" state in UI |
| Ribbon button executes without confirmation on multi-slide selection | Mass-replaces content unexpectedly | Show preview in Task Pane; require "Apply" click |
| Sideload UX hidden behind 5 menu clicks | Install rate drops 70% | Animated GIF in README, exact path screenshotted |
| Onboarding asks for Key before showing value | User abandons before getting Key | Show demo / sample mode first, then Key |
| File upload spinner with no progress | User thinks it's stuck on 50MB pdf | Token progress (% pages parsed) |
| No "Stop" button during streaming | User can't cancel a long response | Stop button visible during all in-flight streams |
| Provider switch silently uses old Key | Key works for old, fails for new | On Provider switch, validate Key with a 1-token test call |
| Chat history lost on Task Pane close | User loses work | At minimum: warn before close if unsent input. v1.1: IndexedDB |

---

## "Looks Done But Isn't" Checklist

Things that appear complete in a Phase but are missing critical pieces. Run this before declaring any Phase done.

### Phase 0 Spike

- [ ] **PPT killer scenarios:** verified end-to-end on PPT for Web (Edge + Chrome), not just "API doesn't throw"
- [ ] **CORS:** verified DeepSeek + aihubmix accept browser-origin fetch with `Access-Control-Allow-Origin` matching production hosting origin — NOT localhost only
- [ ] **pdf.js production build:** parser works in `npm run build` mode, not just dev
- [ ] **pptx text extraction:** jszip + DOMParser approach proven on 3 real pptx files
- [ ] **Storage scope:** verified key persistence behavior across documents + account switches on actual hosts
- [ ] **DeepSeek multimodal:** confirmed from docs whether V4 takes image input directly OR confirmed aihubmix fallback works
- [ ] **API mixing:** `PowerPoint.run` then `setSelectedDataAsync` then `PowerPoint.run` does NOT hang on PPT Web
- [ ] **Manifest sideload:** completed full sideload on Edge, Chrome, fresh profile, on all 3 hosts

### Phase 1 Foundation

- [ ] CI bundle-size gate failing builds at >1MB initial JS
- [ ] `Office.onReady()` wraps all entry points
- [ ] Manifest validates with `office-addin-manifest validate`
- [ ] Per-host `<Requirements>` declared, not top-level
- [ ] Sideload works on all 3 hosts (Edge + Chrome)
- [ ] HTTPS production hosting configured with correct cache headers on icons
- [ ] No console errors on first Task Pane load

### Phase 2 Provider Abstraction

- [ ] Provider client uses bare `fetch`, NOT openai/anthropic SDK
- [ ] `AbortSignal` plumbed through every Provider method
- [ ] 429 retry with backoff + `Retry-After` honored
- [ ] 401/402/422 mapped to actionable user messages
- [ ] Single-flight queue per provider
- [ ] SSE reader properly handles `[DONE]` terminator and partial chunks
- [ ] Storage layer correctly scoped (likely localStorage, NOT `document.settings` and NOT `roamingSettings` for non-Outlook hosts)

### Phase 3 File Parsing

- [ ] Every parser lazy-loaded via `await import()`
- [ ] pdf.js worker correctly configured for both dev AND production
- [ ] File size + MIME validation before parse
- [ ] Image conversion (HEIC → JPEG) tested
- [ ] >2MB images resized before upload
- [ ] Long PDF detection: warn user with "context overflow" estimate before sending
- [ ] pptx text extraction limit: ≤ 200KB extracted text or paginated

### Phase 4 PPT

- [ ] `getSelectedSlides()` results sorted by `index` (workaround for #3618)
- [ ] No `setSelectedDataAsync` + `PowerPoint.run` mixing in same transaction
- [ ] Slide insertion at correct position (verify with multi-slide selection)
- [ ] "配图" works on non-active slide
- [ ] Streaming output renders progressively in Task Pane
- [ ] AbortController cancels in-flight on host selection change

### Phase 5 Excel

- [ ] Every adapter method: max 2 `context.sync()` calls
- [ ] Data cleaning batches 50 rows per LLM call, NOT per-row
- [ ] `suspendApiCalculationUntilNextSync()` around large writes
- [ ] `untrack()` called for >100-proxy operations
- [ ] Payload size <1MB per sync

### Phase 6 Word

- [ ] Paragraph styles captured before `insertText("Replace")` and reapplied
- [ ] Sub-range replacement preferred over paragraph replacement
- [ ] Mac search-result-replace bug tested (relevant for v1.1)

### Phase 7 Release

- [ ] Sideload README has animated screenshot + 30s video
- [ ] Privacy doc explicitly lists what is/isn't sent to Provider, what isn't to Aster
- [ ] Telemetry decision made and documented (opt-in or none)
- [ ] All Phase 0 spike assumptions still hold (re-run spike acceptance tests)
- [ ] Each host's manifest tested with fresh browser profile
- [ ] Error handling catches `AbortError` and doesn't surface as failure
- [ ] No `console.log` of Key or full prompts in prod build

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| PPT slide-insert API doesn't work as expected | HIGH | Pivot to `setSelectedDataAsync(html)` on current slide; reduce PPT scenarios from 3 to 2; update PRD |
| CORS blocks browser → Provider | CATASTROPHIC | Either: (a) drop "no backend" — Cloudflare Worker proxy; (b) drop scope to providers that allow CORS; (c) abandon affected feature |
| Bundle >1MB | HIGH | Lazy-load more, switch Fluent v8→v9, drop OpenAI SDK, audit with bundle-analyzer, code-split per-host |
| RoamingSettings wrong scope | MEDIUM | Migrate to localStorage; ship migration script; release notes warn users to re-enter Key |
| Provider hangs streams | MEDIUM | Add timeout (60s); abort + show error; serialize per-provider |
| Excel sync-in-loop slow | MEDIUM | Refactor adapter to two-sync rule per method; this is mechanical |
| pdf.js worker breaks in prod | LOW | Switch bundler pattern; lock version; self-host worker |
| Word style stripping | LOW | Capture-then-reapply pattern in adapter |
| Sideload friction lowers adoption | LOW (UX) / HIGH (adoption) | Better README, video, GitHub release pinning |
| No telemetry signal | MEDIUM | Add opt-in analytics; or formalize "stars + issues" as success metric |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| #1 PPT Web parity | Phase 0 spike | Working PPT killer scenario videos on Web |
| #2 API mixing hangs | Phase 0 + Phase 1 lint rule | Integration test: PowerPoint.run + setSelectedDataAsync + PowerPoint.run completes |
| #3 Excel sync-in-loop | Phase 2 adapter template + Phase 5 | Adapter code review; perf budget per method |
| #4 RoamingSettings scope | Phase 0 + Phase 2 | Cross-document key persistence test |
| #5 getSelectedSlides order | Phase 4 | Multi-slide selection test |
| #6 Bundle bloat | Phase 1 CI gate | Build fails at >1MB |
| #7 pdf.js worker | Phase 0 + Phase 3 | Prod build loads 5MB PDF |
| #8 pptx parsing | Phase 0 + Phase 3 | jszip approach on 3 real files |
| #9 Streaming + Abort | Phase 2 provider design | Rapid-fire prompts don't garble |
| #10 DeepSeek rate limits | Phase 2 provider queue | Stress test: 10 prompts queued, none lost |
| #11 Model name deprecation | Phase 2 | ESLint ban legacy names |
| #12 aihubmix base64 vision | Phase 3 + Phase 4 | Image upload tested w/ PNG, JPEG, HEIC |
| #13 Word style stripping | Phase 6 | Heading 1 paragraph replacement preserves style |
| #14 Hosting cache headers | Phase 1 | Curl response headers for icon URLs |
| #15 AppDomains vs CORS | Phase 0 | CORS spike — gating |
| #16 OpenAI SDK | Phase 2 | No openai/anthropic in package.json |
| #17 Per-host manifest | Phase 1 | All 3 hosts sideload clean |
| #18 Sideload friction | Phase 7 | User test: time to first AI response from manifest download |
| #19 No telemetry | Phase 7 | Decision documented |
| #20-24 Minor | Various | Per-feature integration tests |

---

## Phase 0 Spike Checklist — Concrete Items

The PRD says "1 周 time-box" for Phase 0. To use that week well, the spike must produce **demonstrable artifacts** for each of the following — not "we read the docs":

1. **PPT Web write-back end-to-end:** a working Aster build on PowerPoint for Web (Edge + Chrome) that:
   - Inserts 3 new slides with title + bullets from a hardcoded outline.
   - Inserts an image into a non-active selected slide.
   - Replaces text on an existing slide.
   - All three operations verified in Edge AND Chrome on fresh browser profiles.

2. **CORS verification (GATING):** from a Task Pane on a real https origin (NOT localhost), successfully:
   - Stream chat completion from `api.deepseek.com`.
   - POST image generation to `aihubmix.com`.
   - Confirm `Access-Control-Allow-Origin` response header is present.
   - If either fails: full stop, PRD revision needed.

3. **DeepSeek-V4 multimodal verification (Q6):** from docs + 1 real API call, confirm whether `deepseek-v4-pro` accepts image_url content blocks. Resolves R2's fallback decision.

4. **Storage scope verification:** in actual sideloaded build, write a value, open a different document with same account, confirm whether value persists. Test with `Office.context.document.settings` vs `localStorage` to determine the right API.

5. **API mixing test:** PowerPoint.run, then setSelectedDataAsync image insert, then PowerPoint.run — does the second `*.run`'s sync resolve within 5s?

6. **getSelectedSlides order test:** select slides 1, 3, 5 in slide pane; call `getSelectedSlides()`; verify order in returned collection. Confirm bug #3618 is still present.

7. **pdf.js production build:** spike build deployed to chosen hosting platform (GitHub Pages or Cloudflare Pages), loads 5MB PDF without "Setting up fake worker failed" error.

8. **pptx text extraction prototype:** 80-line jszip + DOMParser script extracts text from 3 real-world pptx files (corporate template, slidedeck export, downloaded sample). Verifies R3 fallback before declaring "drop pptx support".

9. **Bundle size baseline:** scaffolded Aster with Fluent UI, no business logic, no parsers — what's the bundle size? Sets baseline for N2 discipline.

10. **Manifest sideload on all 3 hosts:** sideload a hello-world manifest on PPT, Excel, Word for Web; both Edge and Chrome; both fresh and existing browser profiles.

If any of items 1, 2, 4 fail → PRD scope cut decision required BEFORE Phase 1 starts.

---

## Sources

### Office.js Documentation
- [PowerPoint JavaScript API requirement sets](https://learn.microsoft.com/en-us/javascript/api/requirement-sets/powerpoint/powerpoint-api-requirement-sets) — official requirement set matrix
- [Specify Office hosts and API requirements with the unified manifest](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/specify-office-hosts-and-api-requirements-unified)
- [Office versions and requirement sets](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/office-versions-and-requirement-sets)
- [Understanding platform-specific requirement sets](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/platform-specific-requirement-sets)
- [Excel JavaScript API performance optimization](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/performance)
- [Avoid using context.sync inside loops (correlated objects pattern)](https://learn.microsoft.com/en-us/office/dev/add-ins/concepts/correlated-objects-pattern)
- [AppDomain element in the manifest](https://learn.microsoft.com/en-us/javascript/api/manifest/appdomain) — clarifies it is NOT for CORS
- [Addressing same-origin policy limitations](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/addressing-same-origin-policy-limitations)
- [Sideload Office Add-ins to Office on the web](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-office-add-ins-for-testing)
- [Office Add-ins manifest overview](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/add-in-manifests)
- [Unified manifest overview](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/unified-manifest-overview)
- [PowerPoint.Presentation class](https://learn.microsoft.com/en-us/javascript/api/powerpoint/powerpoint.presentation)
- [Word.Paragraph class](https://learn.microsoft.com/en-us/javascript/api/word/word.paragraph)
- [Word.Range class](https://learn.microsoft.com/en-us/javascript/api/word/word.range)
- [Document.setSelectedDataAsync](https://github.com/umasubra/office-js-docs-1/blob/master/reference/shared/document.setselecteddataasync.md)
- [Common JavaScript API object model](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/office-javascript-api-object-model)

### Office.js Bug Reports (OfficeDev/office-js GitHub)
- [#5022 — PowerPoint.run hangs after setSelectedDataAsync image insertion](https://github.com/OfficeDev/office-js/issues/5022)
- [#3618 — getSelectedSlides returns slides in backwards order on PowerPoint Web](https://github.com/OfficeDev/office-js/issues/3618)
- [#5896 / #4428 — insertSlidesFromBase64 formatting fidelity issues](https://github.com/OfficeDev/office-js/issues/5896)
- [#4755 — How to insert image to a specific slide by index](https://github.com/OfficeDev/office-js/issues/4755)
- [#1094 — insertText not working on Mac desktop](https://github.com/OfficeDev/office-js/issues/1094)
- [#3565 — context.sync taking progressively more time](https://github.com/OfficeDev/office-js/issues/3565)
- [#4805 — Excel Online stuck on context.sync](https://github.com/OfficeDev/office-js/issues/4805)
- [#6513 — Open letter on Office.js stability concerns (Feb 2026)](https://github.com/OfficeDev/office-js/issues/6513)
- [office-js-docs-reference #833 — How to insert a slide with insertSlidesFromBase64](https://github.com/OfficeDev/office-js-docs-reference/issues/833)

### DeepSeek API
- [DeepSeek API Error Codes](https://api-docs.deepseek.com/quick_start/error_codes)
- [DeepSeek API Quick Start](https://api-docs.deepseek.com/)
- [DeepSeek V4 API Guide 2026 (codersera)](https://codersera.com/blog/how-to-use-deepseek-v4-api-developer-guide-2026/)
- [DeepSeek API Rate Limits — How They Actually Work 2026](https://deepseekai.guide/api/deepseek-api-rate-limits/)
- [DeepSeek Error Codes Explained](https://chat-deep.ai/docs/deepseek-error-codes/)
- [DeepSeek V4 Review 2026](https://toolsdepth.com/reviews/deepseek-v4-review-2026/)

### aihubmix
- [aihubmix gpt-image-1 API docs](https://docs.aihubmix.com/en/api/GPT-Image-1)

### Parsing Libraries
- [pdf.js Wiki — setup-pdf.js-in-a-website](https://github.com/mozilla/pdf.js/wiki/setup-pdf.js-in-a-website)
- [pdf.js #15302 — Correct way to use pdf.js with NPM/Yarn and Webpack 5](https://github.com/mozilla/pdf.js/issues/15302)
- [pdf.js #10838 — Webpack should handle loading worker](https://github.com/mozilla/pdf.js/issues/10838)
- [react-pdf #1843 — Vite + React.lazy worker config issue](https://github.com/wojtekmaj/react-pdf/issues/1843)
- [react-pdf #1148 — Vite ?url import broken](https://github.com/wojtekmaj/react-pdf/issues/1148)
- [mammoth.js README](https://github.com/mwilliamson/mammoth.js/)
- [SheetJS Large Datasets / Stream demo](https://docs.sheetjs.com/docs/demos/bigdata/stream/)
- [SheetJS #1136 — xlsx can't read huge files of 90MB](https://github.com/SheetJS/sheetjs/issues/1136)
- [SheetJS vs ExcelJS vs node-xlsx 2026](https://www.pkgpulse.com/guides/sheetjs-vs-exceljs-vs-node-xlsx-excel-files-node-2026)

### RoamingSettings & Storage
- [office-js-docs-reference — RoamingSettings (Outlook)](https://github.com/OfficeDev/office-js-docs-reference/blob/main/docs/docs-ref-autogen/outlook_1_2/outlook/office.roamingsettings.yml)
- [office-js #4577 — RoamingSettings get() size limit](https://github.com/OfficeDev/office-js/issues/4577)
- [office-js #258 — RoamingSettings 32KB limit](https://github.com/OfficeDev/office-js/issues/258)
- [Cameron Dwyer — Outlook Add-in Roaming Settings Behaviour](https://camerondwyer.com/2021/01/06/outlook-add-in-roaming-settings-behaviour-and-shared-mailboxes/)

### Bundle Optimization
- [fluentui #7581 — improve production bundle size](https://github.com/microsoft/fluentui/issues/7581)
- [fluentui Wiki — Advanced Usage (tree-shaking)](https://github.com/microsoft/fluentui/wiki/Advanced-Usage)
- [PCF Controls — Reduce Bundle Size](https://aidevme.com/pcf-controls-tips-tricks-how-to-reduce-bundle-size-and-improve-performance/)
- [Tree-Shaking for Better Bundle Size](https://itmustbecode.com/pcf-controls-tree-shaking-for-better-bundle-size/)

### Hosting
- [GitHub Pages alternatives 2026](https://danubedata.ro/blog/github-pages-alternatives-static-site-hosting-2026)
- [Cloudflare Pages custom domain HTTPS](https://gist.github.com/cvan/8630f847f579f90e0c014dc5199c337b)
- [Netlify alternatives 2026](https://danubedata.ro/blog/best-netlify-alternatives-static-site-hosting-2026)

### Streaming + Cancellation
- [Cancelling async tasks with AbortController](https://cameronnokes.com/blog/cancelling-async-tasks-with-abortcontroller/)
- [AbortController and Timeouts](https://agentfactory.panaversity.org/docs/TypeScript-Language-Realtime-Interaction/async-patterns-streaming/abort-controller-timeouts)
- [Node.js Abortable Fetch + Streams](https://medium.com/@hadiyolworld007/node-js-abortable-fetch-streams-cooperative-cancellation-across-the-stack-26e222a0c4f1)

### Office Telemetry
- [Office Telemetry Dashboard (deprecated)](https://learn.microsoft.com/en-us/office/compatibility/manage-add-ins-by-using-telemetry-dashboard-in-office)

---

## PRD Risk Coverage Summary

| PRD Risk | Coverage Status | Gap Flagged |
|---|---|---|
| **R1 Office.js Web 写回 API 受限** | Expanded by Pitfalls #1, #2, #5 | PRD's "downgrade to copy-paste" fallback is too weak; recommend `setSelectedDataAsync(html)` as Plan B; Phase 0 must produce working demos, not API checks |
| **R2 DeepSeek-V4 multimodal** | Covered by Phase 0 spike item #3; Pitfall #12 covers aihubmix-specific gotchas | aihubmix moderation-blocked and billed-on-failure not in PRD |
| **R3 pptx parsing complexity** | Pitfall #8 | PRD's "drop pptx support" downgrade is too pessimistic; jszip + DOMParser approach is feasible without external library |
| **R4 BYO Key friction** | Pitfall #18 (sideload friction); Pitfall #19 (no-telemetry friction) | Sideload UX friction is also a flow risk PRD doesn't articulate |
| **R5 Cross-host API inconsistency** | Pitfall #17 (manifest); each adapter pitfall (#3 Excel, #5 PPT, #13 Word) | PRD acknowledges abstraction layer; doesn't enumerate specific divergences — this PITFALLS doc fills that gap |
| **R6 Context window overflow** | Pitfall #10 (rate limits) — adjacent; PRD has mitigation | Token counting not addressed; recommend tiktoken-equivalent in browser or hard char-count heuristic |

**Missing risks (not in PRD):**
- **R7 CORS-from-browser blocking direct Provider calls** (Pitfall #15) — CATASTROPHIC; must be Phase 0 gate. PRD assumes browser → Provider works.
- **R8 Bundle size discipline gap** (Pitfall #6) — PRD has N2 goal but no enforcement mechanism; CI gate needed from Phase 1.
- **R9 No-backend = no product feedback signal** (Pitfall #19) — PRD's Q4 quantification question is unanswerable without this decision.
- **R10 Office.js API mixing hangs** (Pitfall #2) — specific landmine PRD doesn't anticipate.

---

*Pitfalls research for: Aster Office.js Add-in (PPT/Excel/Word for Web)*
*Researched: 2026-05-26*
*Confidence: HIGH for documented Office.js / DeepSeek behaviors. MEDIUM for 2026-specific bundler edge cases — Phase 0 spike to verify.*
