# Feature Research — Aster (AI Office Add-in)

**Domain:** AI productivity Office.js Add-in (PowerPoint / Excel / Word, Chinese-first, BYO Key, no backend)
**Researched:** 2026-05-26
**Confidence:** HIGH for competitor coverage and table-stakes; MEDIUM for ribbon-button predictions (lab signals only, no user research yet); LOW for Chinese-market-specific differentiators (extrapolated from WPS AI behavior, not measured).

> Scope note: PRD already locks the 9 killer scenarios + general capabilities. This file's job is **not** to re-derive scenarios; it's to validate them against the 2026 AI-Office landscape, surface gaps, and pre-empt scope creep by listing anti-features explicitly.

---

## 1. Competitor Scenario Coverage Map

This is the validation layer for the PRD. For each host, which scenarios does each major competitor own, and where does Aster's PRD overlap / miss / deliberately abstain?

### PowerPoint

| Scenario | MS Copilot | WPS AI | ChatGPT Web | Gamma | Beautiful.ai | **Aster PRD** |
|---|---|---|---|---|---|---|
| Topic → multi-slide outline | Yes (Narrative Builder, ≤40k words) | Yes (one-click) | Manual copy/paste | Yes (≈30s end-to-end) | Yes (Smart Slides) | **Yes — killer #1** |
| Doc/PDF → presentation | Yes (up to 5 files) | Yes | Manual | Yes (URL/file) | Yes | Partial (via file upload + outline) |
| Slide image generation | Yes (DALL-E/Copilot Designer) | Yes (auto-match) | Manual | Yes | Yes | **Yes — killer #2 (gen + stock dual)** |
| Bullet compression / rewrite | Yes ("Condense"/"Make professional") | Yes (refine slides) | Manual | Limited | Limited | **Yes — killer #3** |
| Speaker notes generation | Yes (high-quality, contextual) | No (limited) | Manual | **Yes (Gamma's signature strength)** | Limited | **GAP — not in PRD** |
| Whole-deck redesign / theme apply | Yes (template/brand kit) | Yes (auto-layout) | No | Yes | **Yes (Smart Slide engine — best in class)** | Out (PRD: only text + image into slide) |
| Translate whole deck | Yes (40+ languages, preserves charts/tables) | Yes (100+ languages) | Manual | Limited | Limited | **GAP — flagged but v1.1 anyway** |
| Animate/transition suggestions | Limited | Limited | No | Yes | Yes | Out (anti-feature for v1) |
| Slide-to-slide flow / reorder | Yes (Agent Mode reorders) | Limited | No | Yes | Yes | Out (v1) |

**PRD coverage verdict:** Aster's 3 PPT scenarios hit the 80/20 of Copilot/WPS table stakes. **Single biggest gap = speaker notes** (Gamma's hero feature, surprisingly powerful, low-cost to add — see §3).

### Excel

| Scenario | MS Copilot | WPS AI | ChatGPT Web | Formula Bot | Julius AI | **Aster PRD** |
|---|---|---|---|---|---|---|
| NL → formula | Yes (=COPILOT() cell function) | Yes | Yes (copy/paste) | Yes (signature) | Yes | **Yes — killer #1** |
| Formula explain | Yes | Yes | Yes | Yes (lesson-style) | Yes | **Yes — killer #2** |
| Formula error debug (#REF!, #VALUE!) | Yes | Yes | Yes | Yes | Yes | **Yes — killer #2 (combined)** |
| Data cleaning / column split | Yes (Agent Mode multi-step) | Yes | Manual | Yes | Yes | **Yes — killer #3** |
| PivotTable generation | Yes (replaced "Recommended PivotTables") | Yes | No | Yes | Yes | **GAP — high table-stakes, not in PRD** |
| Chart suggestion + generation | Yes | Yes | No (suggests but can't insert) | Yes | Yes (auto-chart even unprompted) | Stretch (v1.1 only — risk: feels missing) |
| What-if / scenario analysis | Yes (Scenario Agent Mode) | Limited | Manual | Limited | Yes | Out (v1) |
| Numerical insight summarization | Yes (Analyze Data + Copilot insights) | Yes | Manual | Yes | Yes | Stretch combined with chart |
| Trend / outlier detection | Yes | Limited | Manual | Limited | Yes | Out (v1) |
| Forecasting (time series) | Yes (Python integration) | Limited | Limited | Limited | Yes | Out (v1) |

**PRD coverage verdict:** Aster's 3 Excel scenarios are correct table stakes. **Two notable gaps:** (a) PivotTable — Copilot/WPS treat this as core; users will ask; (b) chart insertion — currently Stretch but the 2026 baseline has chart-with-insight bundled. **Recommendation:** keep chart as Stretch but make sure the Task Pane "insert chart" flow is at least *possible* via chat (no Ribbon button), not blocked.

### Word

| Scenario | MS Copilot | WPS AI | ChatGPT Web | Notion AI | **Aster PRD** |
|---|---|---|---|---|---|
| Multi-style rewrite / tone shift | Yes (Auto rewrite, Make formal, Make shorter) | Yes (academic/business/email contexts) | Yes | Yes (Slash commands) | **Yes — killer #1** |
| TL;DR / summarize | Yes (up to 1.5M words, with citations) | Yes | Yes | Yes (/summarize block) | **Yes — killer #2** |
| Outline → long-form draft | Yes (Draft with Copilot) | Yes | Yes | Yes (Continue writing) | **Yes — killer #3** |
| Grammar / spelling check | Yes (Fix spelling and grammar) | Yes | Yes | Yes | **GAP — implicit in 多风格润色 but not explicit; users expect a dedicated path** |
| Translation in-place | Yes (preserves formatting) | Yes (100+ langs, side-by-side) | Manual | Yes | Out (v1.1 with i18n) — **acceptable for Chinese audience** |
| Citation / reference insertion | Limited (refs only inside M365) | Limited | Manual | Limited | Out (v1) — **niche, defer OK** |
| Table generation from text | Limited | Yes | Manual | Yes | Out (v1) — possibly low-effort to add via chat |
| Track changes / audit trail | **Yes (Frontier program, April 2026)** | Limited | No | Limited | Out (v1) — Office.js Web API may not support |
| Mail merge / template fill | Limited | Yes | No | Yes (autofill DB) | Out (v1) — not on PRD radar, **probably skip** |
| Action items extraction | Limited | Limited | Manual | Yes (/action items block) | Stretch consideration |

**PRD coverage verdict:** Word 3 scenarios cover 90% of daily use. **Real gap = grammar/spell check as a dedicated entry.** It's bundled into "多风格润色" today, but Copilot/WPS/Notion all expose it separately. Cost to add: trivial (one prompt template). High user expectation.

### Cross-Host Common Features

| Feature | MS Copilot | WPS AI | ChatGPT Web | Notion AI | **Aster PRD** |
|---|---|---|---|---|---|
| Multi-turn chat panel | Yes | Yes | Yes | Yes (Cmd+K, Cmd+J) | **Yes — F1** |
| File upload (multi-format) | Yes (5 files: docx/pdf/xlsx) | Yes | Yes (most formats) | Yes | **Yes — F4** (broader format set) |
| Multimodal image understanding | Yes | Limited | Yes | Limited | **Yes — F4 via aihubmix** |
| Selection-as-context | Yes | Yes | Manual | Yes | **Yes — F1** |
| Streaming output | Yes | Yes | Yes | Yes | **Yes — F6** |
| Insert-to-document button | Yes (Track Changes integration) | Yes | No (copy/paste) | Yes (inline) | **Yes — F8** |
| Slash commands (/summarize, /rewrite) | Limited | No | Limited | **Yes (signature)** | **GAP — worth considering in Task Pane input** |
| Conversation pinning | Limited | No | No (extensions only) | Yes | Out (v1 — chat history not persisted) |
| Prompt templates / saved prompts | Yes (Workspace) | Limited | Yes (Custom GPTs) | Yes (Workspace-wide) | **GAP — quick-win for power users** |
| Voice input | Yes | Limited | Yes | **Yes (5s vs 30s typed)** | Out — defer |
| BYO API Key | **No (hard locked)** | No | No | No | **Yes — DIFFERENTIATOR** |
| Open source | No | No | No | No | **Yes — DIFFERENTIATOR** |
| No-backend / direct-to-provider | No | No | No | No | **Yes — DIFFERENTIATOR (Core Value)** |
| Chinese-first LLM (DeepSeek-V4) | No (Chinese tuning weak) | Partial (WPS native model) | No | No | **Yes — DIFFERENTIATOR** |

---

## 2. Feature Landscape

### 2.1 Table Stakes (Users Expect These — PRD MUST Cover)

| Feature | Why Expected | Complexity | Phase | PRD Status |
|---|---|---|---|---|
| Task Pane multi-turn chat | Every competitor has it; baseline for "feels like an AI tool" | M | 1-2 | **Covered (F1)** |
| Selection-as-context awareness | Without it, Aster = ChatGPT web; defeats Core Value | M | 2 | **Covered (F1)** |
| Streaming output (first token ≤2s) | Below this = "broken / hung" perception | M | 2 | **Covered (F6, N3)** |
| Insert-to-document button | Without this, Core Value collapses (copy/paste defeats the product) | M | 4-6 (per host) | **Covered (F8)** |
| BYO Key onboarding + storage | Required by Core Value; RoamingSettings is correct choice | M | 2 | **Covered (F5)** |
| Multi-format file upload (docx/xlsx/pptx/pdf/txt/md/csv/img) | Competitors offer 5+ formats; less = "limited" feeling | L (parsers + lazy load) | 3 | **Covered (F4)** |
| Multimodal image understanding | Copilot/ChatGPT both ship this; "AI can't see screenshots" feels primitive | M | 3 | **Covered (F4 via aihubmix vision)** |
| Provider abstraction + pluggable Key | BYO Key crowd expects to switch models; lock-in is anti-pattern | L | 2 | **Covered (F3)** |
| Error UX classification (key/quota/context/network) | Below this = "AI is broken" Stack Overflow tickets | M | 2 | **Covered (F7)** — see §6 for spec gap |
| **NL → formula (Excel)** | Single-most-cited Copilot use case; "killer demo" | M | 5 | **Covered** |
| **Formula explain + debug (Excel)** | Second-most-cited Excel use; teaches users to fish | M | 5 | **Covered** |
| **Topic → outline (PPT)** | "Magic moment" demo; if missing, no AI-PPT story | M | 4 | **Covered** |
| **Slide image suggestion (PPT)** | Visual = wow factor; Copilot/Gamma both default to it | L (gen + stock fallback) | 4 | **Covered (image gen + stock dual)** |
| **Multi-style rewrite (Word)** | Most-used Word AI action; 1-click default expectation | S | 6 | **Covered** |
| **TL;DR (Word)** | Universal; "summarize this PDF" is a top-3 LLM query overall | S | 6 | **Covered** |
| **Grammar / spelling correction (Word)** | Copilot/WPS/Notion all surface this separately; bundling into 润色 risks "where's spell check?" feedback | S | 6 | **GAP — flag for PRD review** |
| First-token feedback within 2s | <2s = magic; 2-5s = acceptable; >5s = "is it stuck?" | M (streaming first-token UX) | 2 | **Covered (N3)** |
| Onboarding that delivers value in <60s | 2026 standard: validate Key + 1 success on first session | M | 2 | **Covered (Onboarding) — verify time-to-first-success** |

### 2.2 Differentiators (Aster's Edge)

| Feature | Value Proposition | Complexity | Phase | Status |
|---|---|---|---|---|
| **BYO API Key (no markup, no subscription)** | Cline's playbook: cost transparency, provider freedom. Aster's #1 wedge vs Copilot ($30/mo). | M | 2 | **Covered** |
| **No backend / direct-to-provider** | Privacy story Copilot/WPS can't tell. Required by Core Value. | (architectural) | All | **Covered (N4)** |
| **Open source + sideload distribution** | Trust + dev community; verifiable "where does my Key go" answer. | (process) | 7 | **Covered (Out: AppSource)** |
| **DeepSeek-V4 Chinese-quality default** | WPS AI is locked to WPS; Copilot's Chinese is weak; Aster is the only "Chinese-first inside native Office." | M | 2 | **Covered** |
| **Multi-Provider pluggable (OpenAI-compatible)** | User can swap to local Ollama / Azure / Anthropic; competitor moat for the power-user segment. | M | 2 | **Covered (F3)** |
| **Image gen + stock dual-track** | Copilot only does gen (cost + speed); Gamma only stock-ish. Dual gives user choice. | M | 4 | **Covered** |
| **DeepSeek-V4-flash low-cost tier auto-routing** | Hidden cost optimization users don't get with Copilot. **Note: PRD names the model but doesn't define when it triggers.** | S | 2-4 | **PARTIAL — flag** |
| **Transparent token/cost visibility per turn** | Cline ships this; BYO Key users care about cost. Aster could ship in v1 cheaply via DeepSeek usage headers. | S | 2 | **GAP — quick win** |
| **Prompt templates (saved/shared)** | Notion AI workspace templates; high power-user appeal; pairs with open-source community sharing. | S | Stretch | **GAP — defer to v1.1** |

### 2.3 Anti-Features (Deliberately NOT Building — Make Explicit)

| Anti-Feature | Why Requested | Why Problematic for Aster | Alternative |
|---|---|---|---|
| **VBA / Office Script generation** | "AI can write code" is a popular Copilot demo | Conflicts with "one-click" route; debugging generated VBA is a worse UX than not having it | Stick to deterministic API writeback (F8) |
| **Whole-deck auto-redesign / theme apply** | Beautiful.ai's Smart Slide engine is a "wow" feature | Requires deep OOXML manipulation; Office.js Web API gap (R1 risk); maintenance burden for theming | Stay text+image only; let user keep their template |
| **Auto-presentation / voice narration** | "AI presents for you" demos go viral | Outside MVP scope; not a daily-use problem; quality bar very high | Listed in PRD Non-Goals — keep |
| **Multi-user real-time collaboration on AI output** | "Two people prompting together" sounds cool | Requires backend (violates Core Value); Office already collaborates natively | Let Office handle multi-user; Aster is single-session |
| **Chat history sync across devices** | ChatGPT/Notion AI standard | Requires backend or user-controlled cloud; v1 scope explosion | RoamingSettings stores Key (good enough); chat is per-session (v1.1 evaluate IndexedDB) |
| **Auto-execute / no-confirm writeback (Agent Mode style)** | Copilot Agent Mode is the 2026 hot feature | Office.js Web write APIs are limited (R1); silent failures = trust collapse; "Keep users in control" is in MS's own design guidelines | Always show preview + explicit "插入到文档" — matches PRD design |
| **AppSource distribution at launch** | "Real" Office add-ins ship there | Adds review cycle + privacy attestation overhead; conflicts with open-source iteration speed | Sideload + open repo for v1; AppSource only if community demand justifies |
| **Mac / Mobile compatibility at launch** | "Should work everywhere" reflex | Office.js mobile API surface is too narrow; Mac sideload UX is broken | Web for v1; Windows v1.1; Mac/mobile **Out** (PRD locked) |
| **Custom-trained / fine-tuned models** | "Our model knows your company" pitch | Conflicts with BYO Provider route; needs backend + data pipeline | User picks Provider; Aster ships prompt-engineering layer only |
| **AI-driven citation / source verification (RAG over user files)** | "AI cites where it got the answer" Copilot demo | Requires vector DB + embedding pipeline = backend; high quality bar | v1: file upload puts raw text in context window; let LLM cite verbatim. RAG = explicit Non-Goal for v1 |
| **Real-time formula validation on every keystroke** | "Always-on assistant" pattern | Burns API quota; users hate latency; cost explosion on BYO Key | On-demand only via Ribbon button or chat |
| **Web search / browsing capability** | ChatGPT Plus / Perplexity-style feature | Cost (separate API), latency, scope creep; no Provider in PRD supports it out-of-box | Out of scope; user can paste search results manually |
| **Auto-translation of whole document** | Copilot/WPS have this | Office.js Web API supports replace on selection but whole-doc translation has formatting risk; Chinese audience doesn't need it for v1 | v1.1 with i18n; user can chat-translate selection today |
| **Floating action button on document surface** | Copilot's failed 2026 experiment was rolled back; Microsoft itself reverted | Microsoft's May 2026 telemetry: engagement up, satisfaction down. "Productivity software is not a billboard." | **Stick with Ribbon + Task Pane only — explicit anti-pattern** |

---

## 3. PRD Gap Analysis — Flag for User Review

Features the broader market expects that PRD doesn't address. Listed by severity.

### High Severity (Risk of "Feels Incomplete")

1. **Grammar / spell check as a dedicated Word entry**
   - **Evidence:** Copilot, WPS AI, Notion AI all surface this as a top-level command.
   - **PRD status:** Implicitly bundled into "多风格润色"; no Ribbon button or chat slash for it.
   - **Cost:** S (one prompt template + maybe slash command `/grammar`).
   - **Recommendation:** Add as 3rd Word Ribbon button OR as the default 一键 inside 多风格润色 (e.g., "校对" tab).

2. **Speaker notes generation for PPT**
   - **Evidence:** Gamma's hero feature; Copilot ships it natively.
   - **PRD status:** Not mentioned.
   - **Cost:** S–M (per-slide prompt; writeback to `slide.notes` API — verify Office.js Web support).
   - **Recommendation:** Add as Stretch for v1, or replace one of the weaker PPT killer scenarios. Strong "wow" with low effort.

3. **PivotTable generation for Excel**
   - **Evidence:** Copilot replaced the legacy "Recommended PivotTables" dialog with this; WPS has it.
   - **PRD status:** Not mentioned. Chart is Stretch but Pivot isn't.
   - **Cost:** M (Office.js Excel.PivotTable APIs exist on Web — verify N1; prompt + writeback).
   - **Recommendation:** Add as Stretch alongside chart; both target the data-analyst persona.

### Medium Severity (Power-User Expectation)

4. **Token / cost visibility per request**
   - **Evidence:** Cline ships this; BYO Key crowd is cost-sensitive by definition.
   - **PRD status:** Not mentioned.
   - **Cost:** S (parse `usage` block from DeepSeek/OpenAI-compatible response; small UI badge).
   - **Recommendation:** Cheap differentiator — add in Phase 2.

5. **Slash commands in Task Pane input**
   - **Evidence:** Notion AI / many tools normalize `/rewrite`, `/summarize`, `/translate`.
   - **PRD status:** Not mentioned (Ribbon button is the discrete-action surface).
   - **Cost:** S (lightweight parser on input).
   - **Recommendation:** Defer to v1.1 unless trivial. Ribbon already covers the discoverability gap.

6. **Time-to-first-success measurement in Onboarding**
   - **Evidence:** 2026 PLG standard — onboarding must deliver value in <60s.
   - **PRD status:** Onboarding is "2 steps" but no time/value target.
   - **Cost:** S (instrument + show success state).
   - **Recommendation:** Add as Onboarding AC — "complete first 一键 within 90s of Key paste."

### Low Severity (Defer or Skip)

7. **Prompt template library** — Defer to v1.1; aligns with open-source contribution model.
8. **Translation as a first-class feature** — Chinese-first audience doesn't need it inside v1.
9. **Whole-document tone consistency check** — Niche; defer.
10. **Citation / reference insertion** — Niche academic case; skip for v1.
11. **Action items extraction** — Useful but covered by existing 长文总结 prompt.
12. **Mail merge** — Out of scope; not a target-user job.

---

## 4. Feature Dependencies

```
F5 (Settings + Key + Onboarding)
   └── enables ── F3 (Provider abstraction)
                     └── enables ── F6 (Streaming)
                                       └── enables ── F1 (Task Pane chat)
                                                          └── enables ── All host killer scenarios
                                                          └── enables ── F4 (File upload)
                                                                            └── enables ── Multimodal image understanding

F1 + F8 (Writeback) ── jointly enable ── F2 (Ribbon one-click buttons)
                                            └── depends on ── Host adapter (PPT/Excel/Word)

F7 (Error UX) ── crosscuts ── F3, F4, F6 (every provider call path)

Phase 0 spike ── unblocks ── R1 (PPT writeback), R2 (DeepSeek vision), R3 (pptx parse)
                                  └── if R1 fails ── PPT killer #1 + #2 degrade to "copy-paste from Task Pane"
                                  └── if R2 fails ── multimodal stays on aihubmix (already PRD fallback)
                                  └── if R3 fails ── pptx upload listed as "not supported"

Speaker notes (gap) ── depends on ── PowerPoint.SlideNotes API ── verify in Phase 0 spike
PivotTable (gap)   ── depends on ── Excel.PivotTable Web API ── verify in Phase 0 spike
Grammar entry (gap) ── trivially built on top of F1 + Word adapter
```

### Critical Dependency Notes

- **F5 → F3 → F1:** Settings/Key/Onboarding is the gate. No Key = no provider = no chat. PRD's Phase 2 ordering is correct.
- **F2 depends on F1 + F8:** Ribbon buttons need a Task Pane to render results and a writeback path. Confirms PRD's Phase 4-6 ordering (after Phase 1-3 foundation).
- **Phase 4-6 (PPT/Excel/Word) can parallelize** because each only depends on Phase 1-3 + its own host adapter — matches PRD Handoff Notes.
- **Conflict: Auto-execute writeback ↔ "Keep users in control":** Don't let Agent Mode UX patterns leak in. Every writeback goes through explicit "插入到文档."

---

## 5. Ribbon Button Selection (6 Total — 2 per Host)

PRD lists candidates but flags Q5 (final selection pending UX). Synthesizing from competitor research + Microsoft's May 2026 Copilot button rollback lesson ("muscle memory > novelty"):

### Selection Criteria (in priority order)

1. **First-touch wow:** Demo-able in <30s with a visible "magic" outcome.
2. **Daily-use frequency:** Used multiple times per session, not once per document.
3. **Determinism:** Output is reliable enough that one-click (no preview prompt) works.
4. **Office.js Web API support:** Writeback path must work without R1 risk.

### Recommended Ribbon Allocation

| Host | Button 1 (Wow) | Button 2 (Daily) | Rationale |
|---|---|---|---|
| **PPT** | 主题→大纲 (Topic → Outline) | 选中 slide 配图 (Image for Slide) | Outline = the demo that sells the product (Copilot/Gamma's lead). Image = highest per-session frequency for slide makers. Bullet压缩 lives in Task Pane chat — less Ribbon-worthy. |
| **Excel** | 自然语言→公式 (NL → Formula) | 公式解释/调修 (Explain + Fix) | NL→Formula = strongest Excel demo across all competitors. Explain+Fix = daily use for anyone reading inherited workbooks. Data cleaning is multi-step, fits Task Pane better. |
| **Word** | 多风格润色 (Multi-style Polish) | TL;DR (长文总结) | Polish = most-frequent Word action (every email, every paragraph). TL;DR = highest "wow" for the reading-heavy persona (PM/consultant/legal). 大纲→长文 stays in Task Pane (interactive refinement). |

### Anti-recommendation

- **Don't put "大纲→长文" (Word outline-to-doc) on Ribbon** — it needs the chat-like refinement loop, not a one-shot. Better as a chat slash command or quick-action card inside Task Pane.
- **Don't put "数据清洗" (Excel cleaning) on Ribbon** — multi-step preview is part of the value; one-click bypasses the preview.
- **Don't put "Bullet 压缩" (PPT) on Ribbon** as a primary slot — it's a "refinement" action, not a "start" action. Slot it as a Task Pane quick action.

### Microsoft's 2026 Lesson (Applied)

> "The most successful version of Copilot may be one users notice less often. It may be summoned through selection, command search, shortcuts, or task-specific prompts rather than a floating badge." — May 2026 Copilot ribbon rollback analysis.

**Implication for Aster:** Ribbon is the right surface. 6 buttons (2/host) is correct restraint. **Do NOT** consider floating "magic button" overlays on slides/cells/paragraphs. Selection-driven context + Ribbon entry + Task Pane execution is the proven pattern.

---

## 6. Error UX Standard (PRD F7 — Spec Gap)

PRD F7 says "Key 失效 / 配额超限 / context 超长 / 网络失败均给可操作提示" but doesn't specify the *taxonomy* or *recovery actions*. 2026 standard (OpenAI/Cline/Claude Code synthesis):

| Error Class | Detection | UX | Recovery CTA |
|---|---|---|---|
| `invalid_api_key` (401) | error.type or 401 status | Block + clear "Key 无效" copy | "去设置改 Key" → opens Settings → focus Key field |
| `insufficient_quota` (429, billing) | error.type=`insufficient_quota` | Block, no auto-retry | "查看 Provider 控制台余额" → external link to DeepSeek/aihubmix billing |
| `rate_limit_reached` (429, throughput) | error.type=`rate_limit_reached` | Auto-retry with visible backoff timer | "稍等 N 秒后自动重试" (countdown) |
| `context_length_exceeded` (400) | error.type or message scan | Show context size badge | "压缩对话" (clear pre-current) / "切换 flash 模型" / "裁剪上传文件" |
| `network_error` (fetch fail / timeout) | fetch catch | Inline banner, retry button | "重试" (manual) — DO NOT auto-retry billing errors |
| `content_filter` (200 but refusal) | response parse | Soft warning | "换个表述试试" |
| `model_not_found` (404) | status code | Block | "切换 Provider 或检查模型名" |
| `aihubmix_image_quota` (Provider-specific) | parse provider response | Block image gen, allow text path | "切换图库检索 / 升级 aihubmix 套餐" |

**Critical UX rules (from OpenAI error-handling 2026 guidance):**
1. **Never show raw provider error JSON** — classify and translate.
2. **Distinguish billing-quota from rate-limit** — they require opposite actions (one needs human, the other auto-retries).
3. **Context-too-long is often a misdiagnosis** — actual cause may be rate-limit fallback. Show context size badge so user can verify.
4. **Track error rates in dev mode** — but no telemetry to Aster servers (Core Value: no backend).

**Recommendation:** Add to PRD F7 acceptance criteria — "每种错误类别有独立 copy + CTA + 不混用网络错误兜底文案."

---

## 7. Onboarding Pattern (PRD: 2-step — Is It Enough?)

PRD says: "首启 modal，2 步——① 选默认 Provider + 填 Key；② 简短功能介绍卡片（每宿主一张）."

### 2026 Best Practice Checklist

| Pattern | Source | PRD Compliance | Gap |
|---|---|---|---|
| Single-field-first (paste Key, nothing else required) | Cursor minimalism | Partial — also asks Provider selection | OK if Provider has a sensible default |
| Inline Key validation (test call before "Save") | Cline pattern | Not specified | **ADD** — invalid Key should be caught at paste, not at first request |
| Time-to-first-success <60s | 2026 PLG standard | Not measured | **ADD** as Onboarding AC |
| Progressive disclosure (don't show advanced settings) | All 2026 onboarding guides | Compliant (advanced Provider config in Settings, not Onboarding) | OK |
| Per-host functional intro card | Notion / Cursor empty state | Compliant (PRD step 2) | OK |
| "Get a Key" deep link | Cline + standard BYO pattern | Not specified | **ADD** — link to DeepSeek + aihubmix Key creation pages directly from Onboarding |
| Skip-and-continue option | All modern onboarding | Not specified | **CONSIDER** — let user dismiss and fill Key later via Settings (with banner reminder in Task Pane) |
| Cost transparency primer | Cline (token cost visible) | Not specified | Optional — "DeepSeek-V4-pro ≈ ¥X/百万 tokens" snippet in Onboarding |

**Verdict:** PRD's 2-step is structurally correct but needs to specify:
- Inline Key validation
- "How to get a Key" link
- Time-to-first-success target

**Recommendation:** Tighten Onboarding spec in Phase 2; consider time-to-first-success as Phase 2 acceptance criterion.

---

## 8. MVP Definition (Validation of PRD v1.0 Scope)

### Launch With (v1.0) — Aligned with PRD

- [x] F1-F8 functional + N1-N5 non-functional (PRD covers)
- [x] 9 killer scenarios (3/host) — PRD covers
- [x] 6 Ribbon buttons — selection per §5 above
- [x] Office for Web on Edge / Chrome — PRD covers
- [ ] **ADD: Grammar/spell check as Word entry** (gap #1)
- [ ] **ADD: Inline Key validation in Onboarding** (gap onboarding)
- [ ] **ADD: Detailed error UX taxonomy per §6** (gap F7 detail)
- [ ] **ADD: "Get a Key" deep links in Onboarding** (gap onboarding)

### Add After Validation (v1.1) — Aligned with PRD Stretch + New

- [ ] Excel chart + insight (PRD)
- [ ] Windows Desktop validation (PRD)
- [ ] English i18n (PRD)
- [ ] **NEW: Speaker notes generation for PPT** (gap #2 — strong "wow" candidate)
- [ ] **NEW: PivotTable generation for Excel** (gap #3)
- [ ] **NEW: Token / cost visibility per request** (gap #4)
- [ ] **NEW: Slash commands in Task Pane** (gap #5)
- [ ] Chat history IndexedDB persistence (PRD Q2)
- [ ] Prompt template library

### Future (v2+) — Out of v1 / v1.1

- [ ] Mac Desktop / Mobile (PRD Out)
- [ ] AppSource listing (PRD Out)
- [ ] RAG over user files (anti-feature for v1)
- [ ] Auto-redesign / whole-deck theme (anti-feature for v1)
- [ ] Voice input
- [ ] Whole-document translation
- [ ] What-if / scenario analysis (Excel)
- [ ] Track-changes-aware writeback (Word)

---

## 9. Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| Task Pane chat + streaming (F1+F6) | HIGH | MEDIUM | **P1** |
| Insert-to-document writeback (F8) | HIGH | MEDIUM (per host) | **P1** |
| BYO Key + Onboarding (F5) | HIGH (Core Value) | MEDIUM | **P1** |
| Provider abstraction (F3) | HIGH (differentiator) | MEDIUM | **P1** |
| File upload + parsers (F4) | HIGH | HIGH (lazy load + format coverage) | **P1** |
| Error UX taxonomy (F7) | HIGH (trust) | LOW–MEDIUM | **P1** |
| PPT outline (killer #1) | HIGH | MEDIUM | **P1** |
| PPT image (killer #2) | HIGH | HIGH (gen + stock + writeback) | **P1** |
| PPT bullet compress (killer #3) | MEDIUM | LOW | **P2** |
| Excel NL→formula (killer #1) | HIGH | MEDIUM | **P1** |
| Excel formula explain/debug (killer #2) | HIGH | LOW | **P1** |
| Excel data cleaning (killer #3) | MEDIUM | MEDIUM | **P2** |
| Word multi-style polish (killer #1) | HIGH | LOW | **P1** |
| Word TL;DR (killer #2) | HIGH | LOW | **P1** |
| Word outline→long-form (killer #3) | MEDIUM | LOW | **P2** |
| Word grammar/spell (GAP) | HIGH | LOW | **P1 — add to v1** |
| Speaker notes (GAP) | MEDIUM-HIGH | LOW–MEDIUM | **P2 — strong v1.1 candidate, consider for v1** |
| Pivot generation (GAP) | MEDIUM | MEDIUM | **P2 — v1.1** |
| Token cost visibility (GAP) | MEDIUM | LOW | **P2 — cheap diff** |
| Chart + insight | MEDIUM | MEDIUM-HIGH | **P2 — Stretch** |
| Slash commands | LOW–MEDIUM | LOW | **P3** |
| Chat history persistence | LOW (v1) | MEDIUM | **P3 — v1.1+** |
| English i18n | LOW (v1) | MEDIUM | **P3 — v1.1** |
| Prompt templates | LOW (v1) | LOW | **P3 — v1.1+** |
| RAG / citation | LOW (anti) | HIGH | **OUT** |
| Auto-redesign | LOW (anti) | HIGH | **OUT** |
| VBA generation | LOW (anti) | MEDIUM | **OUT** |
| Floating action button | NEGATIVE | LOW | **OUT — anti-pattern (MS reverted)** |

---

## 10. Phase Mapping (for Roadmap)

| Phase | Owns These Features |
|---|---|
| Phase 0 (Spike) | R1 PPT writeback API verification; R2 DeepSeek-V4 multimodal verification; R3 pptx parse feasibility; **NEW: speaker notes API + Pivot API verification** (so v1.1 candidates aren't blocked by Web API gaps) |
| Phase 1 (Foundation) | Yeoman scaffold; 3-host manifest; Task Pane shell; Ribbon button stubs (6) |
| Phase 2 (Provider + Settings + Onboarding) | F3 (Provider abstraction), F5 (Settings + Key + Onboarding incl. **inline validation** + **Get-a-Key links**), F6 (Streaming), F7 (Error taxonomy per §6), **token cost visibility quick-win** |
| Phase 3 (File upload + Parse) | F4 (lazy-loaded parsers: mammoth / SheetJS / pdf.js / pptx-text / image multimodal) |
| Phase 4 (PPT) | 主题→大纲 (Ribbon #1) + 选中 slide 配图 (Ribbon #2) + Bullet 压缩 (Task Pane quick-action); slide writeback (F8 PPT); **speaker notes if Phase 0 spike green** |
| Phase 5 (Excel) | NL→公式 (Ribbon #1) + 公式解释 (Ribbon #2) + 数据清洗 (Task Pane); cell writeback (F8 Excel); Stretch: chart + Pivot |
| Phase 6 (Word) | 多风格润色 (Ribbon #1) + TL;DR (Ribbon #2) + 大纲→长文 (Task Pane); paragraph writeback (F8 Word); **grammar / spell entry — add to Polish dropdown OR slash command** |
| Phase 7 (Polish + Release) | Sideload docs; open-source README; AC verification; v1.0 release |

---

## 11. Competitor Feature Analysis (Direct Comparison)

| Feature | MS Copilot | WPS AI | Notion AI | Gamma | **Aster Approach** |
|---|---|---|---|---|---|
| Pricing model | $30/user/mo subscription | $4.99/mo+ (cheapest Slides) | $10/mo | $10/mo Plus | **BYO Key, pay provider directly (~10x cheaper for moderate users)** |
| Chinese LLM | Weak | Strong (proprietary) | Weak | Weak | **Strong (DeepSeek-V4-pro)** |
| Native Office integration | Yes | WPS only | No (separate app) | No (export only) | **Yes (Office.js Add-in)** |
| Backend / data routing | MS cloud | Kingsoft cloud | Notion cloud | Gamma cloud | **None — direct browser→provider** |
| Open source | No | No | No | No | **Yes** |
| File upload limit | 5 files | Varies | Yes | URL/file | **No artificial limit (provider context limit applies)** |
| Multimodal | Yes | Limited | Limited | Yes | **Yes (via aihubmix)** |
| Speaker notes (PPT) | Yes | Limited | N/A | **Best in class** | **GAP — recommend adding** |
| Pivot generation (Excel) | Yes | Yes | N/A | N/A | **GAP — v1.1 candidate** |
| Grammar check (Word) | Yes (separate) | Yes (separate) | Yes | N/A | **GAP — bundle into 润色 dropdown or add slash** |
| Ribbon button budget | Many (full Copilot UX) | Many | N/A | N/A | **6 (2/host) — disciplined and correct** |
| Error UX | Polished | Polished | Polished | Polished | **Spec needs sharpening (§6)** |
| Onboarding | Multi-step subscription flow | Account signup | Account signup | Account signup | **BYO Key paste — fastest in class IF inline validation works** |

---

## Sources

- [Microsoft Copilot in PowerPoint (Microsoft Support)](https://support.microsoft.com/en-us/office/create-a-new-presentation-with-copilot-in-powerpoint-3222ee03-f5a4-4d27-8642-9c387ab4854d) — HIGH
- [PowerPoint Copilot Tutorial: What Actually Works in 2026 (Winning Presentations)](https://winningpresentations.com/powerpoint-copilot-whats-works/) — MEDIUM
- [Microsoft Copilot PowerPoint Review 2026 (Deckary)](https://deckary.com/blog/copilot-powerpoint-review) — MEDIUM
- [Copilot in Microsoft PowerPoint 2026 AI Presentation Design](https://www.udemy.com/course/powerpoint-copilot/) — LOW
- [WPS AI Slides: Complete 2026 Guide (WPS Office Academy)](https://www.wps.com/academy/wps-ai-slides-guide-quick-tutorials-1898624/) — MEDIUM (vendor)
- [WPS AI features overview (WPS Office Academy)](https://www.wps.com/academy/a-comprehensive-overview-of-wps-ais-latest-features/wps-ai/1881865/) — MEDIUM (vendor)
- [Notion AI Features 2026 (Fazm Blog)](https://fazm.ai/blog/notion-ai-features-2026) — MEDIUM
- [Notion AI Updates 2026 (Fazm Blog)](https://fazm.ai/blog/notion-ai-updates-2026) — MEDIUM
- [Using slash commands (Notion Help)](https://www.notion.com/help/guides/using-slash-commands) — HIGH (official)
- [Get started with Copilot in Excel (Microsoft Support)](https://support.microsoft.com/en-us/office/get-started-with-copilot-in-excel-d7110502-0334-4b4f-a175-a73abdfc118a) — HIGH
- [Create PivotTables with Copilot in Excel (Microsoft Support)](https://support.microsoft.com/en-us/topic/create-pivottables-with-copilot-in-excel-93f14f4e-1cb4-4d24-9509-d36a8677d652) — HIGH
- [Excel Analyze Data vs Copilot Upsell (Windows News)](https://windowsnews.ai/article/excel-analyze-data-vs-copilot-upsell-native-ai-insights-for-spreadsheets.419350) — MEDIUM
- [10 Best AI Tools for Excel in 2026 (Kuse.ai)](https://www.kuse.ai/blog/excel/10-best-ai-tools-for-excel-in-2026-from-formula-bots-to-agentic-coworkers) — MEDIUM
- [Excel AI Data Analysis Tools: 10 Compared 2026 (FindAnomaly)](https://www.findanomaly.ai/excel-ai-data-analysis-tools-2026) — MEDIUM
- [AI-Powered Excel What-If Analysis 2.0 (ExcelMojo)](https://www.excelmojo.com/ai-excel-what-if-analysis/) — MEDIUM
- [Welcome to Copilot in Word (Microsoft Support)](https://support.microsoft.com/en-us/office/welcome-to-copilot-in-word-2135e85f-a467-463b-b2f0-c51a46d625d1) — HIGH
- [Copilot in Word: New Capabilities April 2026 (Microsoft Tech Community)](https://techcommunity.microsoft.com/blog/microsoft365copilotblog/copilot-in-word-new-capabilities-for-document-workflows/4508974) — HIGH
- [How to use Copilot for writing in Microsoft 365 (Computerworld)](https://www.computerworld.com/article/3479705/how-to-use-microsoft-copilot-for-writing-in-microsoft-365-word-outlook-onenote.html) — MEDIUM
- [Best practices for developing Office Add-ins (Microsoft Learn)](https://learn.microsoft.com/en-us/office/dev/add-ins/concepts/add-in-development-best-practices) — HIGH (official)
- [Office UI elements for Office Add-ins (Microsoft Learn)](https://learn.microsoft.com/en-us/office/dev/add-ins/design/interface-elements) — HIGH (official)
- [Icon guidelines for Office Add-ins (Microsoft Learn)](https://learn.microsoft.com/en-us/office/dev/add-ins/design/add-in-icons) — HIGH (official)
- [Microsoft Lets Users Move Copilot Button Back to the Ribbon May 2026 (Windows News)](https://windowsnews.ai/article/microsoft-lets-users-move-copilot-button-back-to-the-ribbon-may-2026.419446) — MEDIUM (key 2026 design lesson)
- [Microsoft's Copilot rollback (XDA Developers)](https://www.xda-developers.com/microsofts-big-copilot-rollback-continues-as-office-now-lets-you-move-its-button-to-the-ribbon/) — MEDIUM
- [Best Cursor Alternatives 2026 (Verdent)](https://www.verdent.ai/guides/claude-code-alternatives-2026) — MEDIUM (Cline BYOK pattern)
- [User Onboarding Best Practices 2026 (Userpilot)](https://userpilot.com/blog/user-onboarding/) — MEDIUM
- [OpenAI API error codes (OpenAI Developer Docs)](https://developers.openai.com/api/docs/guides/error-codes) — HIGH
- [OpenAI API Quota Exceeded Troubleshooting Guide 2026 (AI Free API)](https://www.aifreeapi.com/en/posts/openai-api-key-quota-exceeded) — MEDIUM
- [Fix context_length_exceeded (LaoZhang AI Blog)](https://blog.laozhang.ai/en/posts/openclaw-context-length-exceeded) — MEDIUM
- [Top 5 AI Presentation Tools 2026 (Deepak Gupta)](https://guptadeepak.com/tools/top-5-ai-presentation-tools-2026/) — MEDIUM
- [Gamma AI Review 2026 (SlideGMM)](https://www.slidegmm.ai/en/blog/gamma-ai-review-2026) — MEDIUM
- [Best AI Presentation Tools Comparison 2026 (SlideGMM)](https://www.slidegmm.ai/en/blog/ai-presentation-tools-comparison-2026) — MEDIUM
- [How to Organize ChatGPT Conversations 2026 (AI Toolbox)](https://www.ai-toolbox.co/chatgpt-management-and-productivity/organize-chatgpt-conversations-complete-guide-2026) — MEDIUM

---

*Feature research for: Aster — AI Office.js Add-in (PPT/Excel/Word, Chinese-first, BYO Key, no backend)*
*Researched: 2026-05-26*
*Downstream: REQUIREMENTS.md should incorporate gaps (§3) and ribbon allocation (§5); roadmap should map phase ownership per §10.*
