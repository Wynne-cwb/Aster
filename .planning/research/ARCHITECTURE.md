# Architecture Research

**Domain:** Cross-host Office.js Add-in (PPT / Excel / Word), no-backend, BYO LLM provider
**Researched:** 2026-05-26
**Confidence:** HIGH (Office.js platform topics verified against Microsoft Learn + OfficeDev GitHub; LLM provider patterns verified against multiple production OSS implementations; Vite chunking verified against official Vite docs)

---

## Executive Summary

Aster's architecture must reconcile three forces that fight each other:

1. **One SPA, three hosts** — A single React Task Pane bundle serves PPT / Excel / Word. Microsoft does **not** ship an official "cross-host SPA" template, but the platform supports it cleanly via `Office.onReady() → info.host → Office.HostType.{PowerPoint,Excel,Word}` dispatch. The right boundary is a **DocumentAdapter** interface, with three implementations, selected once at boot.
2. **Ribbon buttons must talk to the Task Pane** — Office.js gives us exactly one supported mechanism for this in 2026: the **shared runtime**. Without it, ribbon function commands run in their own JavaScript context, can't see Task Pane state, and can't share the provider/key/chat singletons. Aster MUST configure a shared runtime in the manifest. This is non-negotiable.
3. **1MB initial bundle vs. heavy parsers + LLM SDKs** — `pdfjs-dist` alone is ~1.5MB, `xlsx` is ~900KB, `mammoth` is ~200KB. None of them may live in the initial chunk. The discipline is: **everything below the "provider abstraction" line is lazy-loaded via dynamic `import()`, with `manualChunks` giving each library a stable, cacheable filename.**

The PRD's Phase 0-7 build order is **mostly correct** but has one critical reordering recommendation: Phase 2 (Provider abstraction) and Phase 3 (file parsing) should swap, because file parsing depends on multimodal Provider routing, but Provider abstraction does not depend on file parsing. See "Build Order Validation" below.

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Office Host (PPT / Excel / Word)               │
│  ┌────────────────────────┐         ┌──────────────────────────────┐ │
│  │   Ribbon (6 buttons)   │         │   Task Pane (iframe webview) │ │
│  │   ┌────────────────┐   │         │   ┌────────────────────────┐ │ │
│  │   │ FunctionFile   │   │         │   │   React SPA            │ │ │
│  │   │ commands.html  │◄──┼─shared──┼──►│   (single bundle)      │ │ │
│  │   │ + commands.ts  │   │ runtime │   │                        │ │ │
│  │   └────────────────┘   │         │   └────────────────────────┘ │ │
│  └────────────────────────┘         └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (single JS runtime, shared globals)
┌──────────────────────────────────────────────────────────────────────┐
│                          App Shell (React 18)                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │           Host Dispatcher (Office.onReady → HostType)          │  │
│  │       selects DocumentAdapter + host-specific React subtree    │  │
│  └────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│                       Domain Services (host-agnostic)                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────────┐  │
│  │ Provider    │ │ Settings    │ │ Chat        │ │ Selection      │  │
│  │ Registry    │ │ Store       │ │ Session     │ │ Watcher        │  │
│  │ (LLM+Image) │ │ (Roaming)   │ │ (in-memory) │ │ (Office events)│  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│                       Adapter Layer (host-specific)                  │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌────────────────┐  │
│  │ PptAdapter          │ │ ExcelAdapter        │ │ WordAdapter    │  │
│  │ (PowerPoint.run)    │ │ (Excel.run)         │ │ (Word.run)     │  │
│  └─────────────────────┘ └─────────────────────┘ └────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│                       Lazy Layer (dynamic import)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌────────────┐   │
│  │ mammoth  │ │ xlsx     │ │ pdfjs    │ │ pptx-   │ │ Provider   │   │
│  │ (.docx)  │ │ (.xlsx)  │ │ (.pdf)   │ │ parser  │ │ adapters   │   │
│  └──────────┘ └──────────┘ └──────────┘ └─────────┘ └────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                              │ (fetch + SSE streaming)
                              ▼
        ┌─────────────────────┴────────────────────────┐
        │   External APIs (direct from user browser)   │
        │   DeepSeek  •  aihubmix  •  Unsplash/Pexels  │
        └──────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **App Shell** | Mount React root inside `Office.onReady`, dispatch host, render layout | `src/app/main.tsx`, `src/app/AppShell.tsx` |
| **Host Dispatcher** | Read `Office.context.host`, instantiate the right `DocumentAdapter`, expose via React Context | `src/app/HostProvider.tsx` |
| **DocumentAdapter** | Interface — abstracts host-specific Office.js calls behind 6-8 verbs | `src/adapters/{ppt,excel,word}/*.ts` |
| **Provider Registry** | Holds active LLM + Image providers, factory, fallback rules | `src/providers/registry.ts` |
| **LLMProvider / ImageProvider** | OpenAI-compatible chat / image SDK adapter | `src/providers/openai-compatible.ts` (shared by DeepSeek + custom) |
| **Settings Store** | Read/write API keys + provider configs via Office.context.settings (in Word/Excel/PPT; not RoamingSettings — see Pitfalls) | `src/services/settings.ts` |
| **Chat Session** | In-memory chat history, streaming chunk reducer, "insert to doc" handoff | `src/services/chat.ts` + Zustand store |
| **Selection Watcher** | Subscribes to `Office.context.document.addHandlerAsync(DocumentSelectionChanged, ...)` and updates SelectionContext | `src/services/selection.ts` |
| **Ribbon Command Handlers** | UI-less functions invoked from Ribbon buttons, reach into shared-runtime globals to drive the Task Pane | `src/commands/commands.ts` + `commands.html` |
| **Lazy Parser Modules** | `mammoth` / `xlsx` / `pdf.js` / pptx wrapped behind dynamic `import()` | `src/parsers/{docx,xlsx,pdf,pptx}.ts` |

### Component boundaries (acyclic)

The directional rule, enforced by lint or convention:

```
App Shell ───► Host Dispatcher ───► Domain Services ───► Adapters
                                          │
                                          ├──► Providers (LLM/Image)
                                          ├──► Settings Store
                                          ├──► Chat Session
                                          └──► Parsers (lazy)
```

- **Adapters never import Providers.** A PPT adapter doesn't know LLMs exist.
- **Providers never import Adapters.** A DeepSeek client doesn't know about slides.
- **Domain Services orchestrate both.** E.g. `OutlineGenerator` calls `LLMProvider.chat()` then `DocumentAdapter.insertSlides()`.
- **UI components (`src/components/`) talk only to Domain Services**, never directly to Adapters or Providers.

This is the single most important architectural invariant. Violating it (e.g. a React button directly calling `PowerPoint.run`) is how Office add-ins rot.

---

## Recommended Project Structure

```
aster/
├── manifest.xml                    # XML manifest — see "Manifest Decision" below
├── vite.config.ts                  # Vite build, manualChunks, CDN externals
├── tsconfig.json
├── package.json
│
├── public/                         # Static assets served by Vite
│   ├── taskpane.html               # Task Pane entry (loads main.tsx)
│   ├── commands.html               # Ribbon UI-less function file
│   └── icons/                      # Ribbon button icons (16/32/64/80 PNG)
│
├── src/
│   ├── app/                        # App shell + host dispatch
│   │   ├── main.tsx                # ReactDOM.createRoot inside Office.onReady
│   │   ├── AppShell.tsx            # Layout: context card / chat / input
│   │   ├── HostProvider.tsx        # React Context exposing DocumentAdapter
│   │   └── routes.tsx              # Hash-based routing (Office nulls pushState!)
│   │
│   ├── commands/                   # Ribbon function command entrypoints
│   │   ├── commands.ts             # Office.actions.associate() registrations
│   │   ├── ppt-outline.ts          # "主题→大纲" handler
│   │   ├── ppt-illustrate.ts       # "选中 slide 配图" handler
│   │   ├── excel-formula.ts        # "自然语言→公式" handler
│   │   ├── excel-explain.ts        # "公式解释" handler
│   │   ├── word-polish.ts          # "多风格润色" handler
│   │   └── word-longform.ts        # "大纲→长文" handler
│   │
│   ├── adapters/                   # DocumentAdapter implementations
│   │   ├── index.ts                # createAdapter(host: HostType): DocumentAdapter
│   │   ├── types.ts                # DocumentAdapter interface, SelectionContext, etc.
│   │   ├── ppt/
│   │   │   ├── index.ts            # PptAdapter implements DocumentAdapter
│   │   │   ├── selection.ts        # getSelectedSlides + thumbnail
│   │   │   ├── insert-slide.ts     # insertSlidesFromBase64 wrapper
│   │   │   ├── insert-image.ts     # shape.fill.setImage / insertPicture
│   │   │   └── pptx-template.ts    # Build a 1-slide PPTX in-browser for insert
│   │   ├── excel/
│   │   │   ├── index.ts
│   │   │   ├── selection.ts        # getSelectedRange + values
│   │   │   ├── write-formula.ts
│   │   │   └── write-range.ts
│   │   └── word/
│   │       ├── index.ts
│   │       ├── selection.ts        # getSelection + paragraph context
│   │       ├── replace-text.ts
│   │       └── insert-paragraph.ts
│   │
│   ├── providers/                  # LLM + Image provider abstraction
│   │   ├── types.ts                # LLMProvider / ImageProvider interfaces
│   │   ├── registry.ts             # ProviderRegistry singleton
│   │   ├── openai-compatible.ts    # Shared impl: DeepSeek + user-custom both use this
│   │   ├── aihubmix-image.ts       # gpt-image-2 wrapper
│   │   ├── aihubmix-vision.ts      # Multimodal image-understanding wrapper
│   │   ├── stock-image.ts          # Unsplash/Pexels (lazy)
│   │   └── errors.ts               # Typed error classes
│   │
│   ├── services/                   # Cross-cutting domain services
│   │   ├── settings.ts             # Office.context.settings wrapper (NOT RoamingSettings)
│   │   ├── chat.ts                 # ChatSession: messages, streaming reducer
│   │   ├── selection.ts            # SelectionWatcher → SelectionContext
│   │   ├── ribbon-bus.ts           # Shared-runtime global bus: ribbon → task pane
│   │   └── insert.ts               # Orchestrates LLM result → DocumentAdapter
│   │
│   ├── scenarios/                  # The 9 killer scenarios (host-tagged)
│   │   ├── ppt/
│   │   │   ├── outline-from-topic.ts
│   │   │   ├── illustrate-slide.ts
│   │   │   └── compress-bullets.ts
│   │   ├── excel/
│   │   │   ├── nl-to-formula.ts
│   │   │   ├── explain-formula.ts
│   │   │   └── clean-split.ts
│   │   └── word/
│   │       ├── polish.ts
│   │       ├── summarize.ts
│   │       └── outline-to-longform.ts
│   │
│   ├── parsers/                    # All lazy-loaded
│   │   ├── index.ts                # parseFile(file) dispatches by mime/ext
│   │   ├── text.ts                 # txt/md/csv/json (eager — tiny)
│   │   ├── docx.ts                 # await import('mammoth')
│   │   ├── xlsx.ts                 # await import('xlsx')
│   │   ├── pdf.ts                  # await import('pdfjs-dist')
│   │   └── pptx.ts                 # OOXML extract (custom; see Pitfalls)
│   │
│   ├── components/                 # React UI (presentational)
│   │   ├── ChatStream.tsx
│   │   ├── ContextCard.tsx
│   │   ├── FileUpload.tsx
│   │   ├── InsertButton.tsx
│   │   ├── Onboarding.tsx
│   │   └── SettingsPanel.tsx
│   │
│   ├── store/                      # Zustand stores
│   │   ├── chat.store.ts
│   │   ├── settings.store.ts
│   │   └── ui.store.ts
│   │
│   └── lib/                        # Pure utilities, no Office dependency
│       ├── sse.ts                  # SSE/streaming fetch helper
│       ├── base64.ts
│       └── tokens.ts               # Rough token counting for context-window guard
│
└── tests/                          # Vitest + Playwright (later)
```

### Structure Rationale

- **`adapters/` is the heart.** It is the layer that absorbs the entire R5 risk (cross-host API inconsistency). Adding a host = adding one folder under `adapters/` that implements `DocumentAdapter`.
- **`commands/` is small but special** — these files are loaded by `commands.html`, run in the **same shared runtime** as the task pane, and just call into `services/` and `scenarios/`. They are thin orchestrators, not business logic.
- **`scenarios/` is the only place host-tagged logic lives outside `adapters/`.** Each of the 9 killer scenarios gets one file. UX changes there, not in adapters.
- **`providers/` is OpenAI-compatible-first.** DeepSeek, user custom Provider, and any future OpenAI-compatible vendor all flow through `openai-compatible.ts`. Only aihubmix's image and vision APIs get bespoke clients, because they may diverge from chat-completion shape.
- **`parsers/` is the lazy-load wall.** Nothing else dynamic-imports anything heavy; concentrating it here makes bundle analysis trivial.
- **`store/` uses Zustand**, not Redux. Office Add-ins are small; Redux Toolkit adds ~13KB before any logic. Zustand is ~1KB, supports persistence middleware (which we wire to `settings.ts`), and is React-18-friendly.

---

## Key TypeScript Interface Sketches

### `DocumentAdapter` — the cross-host abstraction (R5 mitigation)

```typescript
// src/adapters/types.ts

export type HostType = 'powerpoint' | 'excel' | 'word';

/**
 * What the user has currently selected in the active document.
 * Discriminated union so consumers can narrow by host.
 */
export type SelectionContext =
  | {
      host: 'powerpoint';
      slideId: string | null;          // null = no slide selected
      slideIndex: number | null;       // 1-based; null if no selection
      slideCount: number;
      selectedText: string;            // Aggregated text on selected slide
      thumbnail?: string;              // Base64 PNG, populated lazily
    }
  | {
      host: 'excel';
      sheetName: string;
      rangeAddress: string;            // e.g. "Sheet1!A1:C10"
      values: unknown[][];             // 2-D row-major
      rowCount: number;
      columnCount: number;
      hasFormulas: boolean;
      formulas?: string[][];           // populated on demand
    }
  | {
      host: 'word';
      text: string;                    // Selected text (empty if cursor only)
      paragraphCount: number;
      isCollapsed: boolean;            // True if cursor only, no real selection
      contextBefore?: string;          // ~200 chars before selection
      contextAfter?: string;
    };

/**
 * Anything we can write back into the document. Discriminated by `kind`.
 * Each host adapter decides which kinds it supports.
 */
export type InsertableContent =
  | { kind: 'text'; text: string; mode: 'replace' | 'insertAtCursor' | 'append' }
  | { kind: 'paragraphs'; paragraphs: string[]; mode: 'replace' | 'insertAtCursor' }
  | { kind: 'bullets'; items: string[]; mode: 'replace' | 'insertAtCursor' }
  | { kind: 'formula'; formula: string }                          // Excel only
  | { kind: 'range-values'; values: unknown[][]; targetAddress?: string }
  | { kind: 'slides'; outline: SlideOutline[] }                   // PPT only
  | { kind: 'image'; source: ImageSource; placement?: ImagePlacement };

export interface SlideOutline {
  title: string;
  bullets: string[];
  layoutHint?: 'title-content' | 'two-column' | 'section-header';
}

export type ImageSource =
  | { kind: 'url'; url: string }
  | { kind: 'base64'; data: string; mimeType: string };

export type ImagePlacement =
  | { kind: 'replaceOnSelectedSlide' }
  | { kind: 'newSlide'; title?: string }
  | { kind: 'atCursor' };                                          // Word

/**
 * The contract every host adapter must satisfy.
 * Methods that don't apply to a host throw UnsupportedOperationError.
 */
export interface DocumentAdapter {
  readonly host: HostType;

  /** Read current selection. Should be cheap; called often by Selection Watcher. */
  getSelection(): Promise<SelectionContext>;

  /** Write content back. Throws typed errors on host API failures. */
  insertContent(content: InsertableContent): Promise<InsertResult>;

  /**
   * Generate a thumbnail/preview of selection for the chat UI.
   * PPT: slide PNG. Excel: range as CSV string. Word: text snippet.
   */
  getSelectionPreview(): Promise<SelectionPreview>;

  /** Subscribe to selection-changed events. Returns disposer. */
  onSelectionChanged(callback: () => void): () => void;

  /**
   * Capability query — used by UI to enable/disable buttons before user clicks.
   * E.g. PPT may report `canInsertSlides: false` on web if API gap discovered in spike.
   */
  capabilities(): AdapterCapabilities;
}

export interface InsertResult {
  ok: true;
  affectedRangeDescription: string;    // For toast: "已插入 8 张幻灯片"
} | {
  ok: false;
  error: AdapterError;
  recovered?: 'copyToClipboard';       // Fallback used
};

export interface AdapterCapabilities {
  canInsertSlides: boolean;
  canReplaceSelectionText: boolean;
  canInsertImageOnSlide: boolean;
  canWriteFormula: boolean;
  canWriteRangeValues: boolean;
  canInsertParagraph: boolean;
  maxBase64UploadBytes: number;        // For pptx insert via base64
}

export type SelectionPreview =
  | { kind: 'image'; base64: string }
  | { kind: 'text'; text: string }
  | { kind: 'csv'; csv: string };
```

The 9 killer scenarios map cleanly onto this surface:

| Scenario | `insertContent` kind | Adapter method |
|---|---|---|
| PPT 主题→大纲 | `slides` | `insertContent({kind:'slides', outline})` |
| PPT 选中 slide 配图 | `image` | `insertContent({kind:'image', placement:{kind:'replaceOnSelectedSlide'}})` |
| PPT 大段文字 → bullet | `bullets` (mode: replace) | replaces text on selected slide |
| Excel NL → 公式 | `formula` | writes to active cell |
| Excel 公式解释 | (none — chat output only) | — |
| Excel 数据清洗 / 拆列 | `range-values` | writes to right of selection |
| Word 润色 | `text` (mode: replace) | replaces selected text |
| Word 长文总结 | (none — chat output, optional `paragraphs` insert) | — |
| Word 大纲 → 长文 | `paragraphs` (mode: insertAtCursor) | — |

### `LLMProvider` and `ImageProvider`

```typescript
// src/providers/types.ts

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | MultimodalContent[];
}

export type MultimodalContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };           // OpenAI vision shape

export interface ChatOptions {
  model?: string;                    // Override default; e.g. switch to flash for cheap task
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;              // For cancel
}

export interface ChatChunk {
  delta: string;                     // Incremental text token(s)
  finishReason?: 'stop' | 'length' | 'content_filter' | null;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface ProviderCapabilities {
  streaming: boolean;
  vision: boolean;                   // Accepts image inputs
  toolCalling: boolean;              // Not needed for v1; future-proofs
  maxContextTokens: number;          // For context-overflow guard
  supportedModels: string[];
}

export interface LLMProvider {
  readonly id: string;               // 'deepseek' | 'aihubmix-vision' | user-custom UUID
  readonly displayName: string;
  readonly capabilities: ProviderCapabilities;

  /** Streaming chat. Always async-iterable; non-streaming providers wrap a single chunk. */
  chat(messages: ChatMessage[], opts?: ChatOptions): AsyncIterable<ChatChunk>;

  /** Sanity-check that this provider is usable (key valid, network OK). */
  ping(): Promise<{ ok: boolean; error?: string }>;
}

export interface ImageGenOptions {
  size?: '512x512' | '1024x1024' | '1792x1024';
  style?: string;
  signal?: AbortSignal;
}

export interface ImageResult {
  url?: string;
  base64?: string;
  mimeType: string;
}

export interface ImageProvider {
  readonly id: string;
  readonly displayName: string;
  generate(prompt: string, opts?: ImageGenOptions): Promise<ImageResult>;
}

export interface StockImageProvider {
  readonly id: 'unsplash' | 'pexels';
  search(query: string, opts?: { perPage?: number }): Promise<StockImage[]>;
}

export interface StockImage {
  thumbUrl: string;
  fullUrl: string;
  credit: { author: string; sourceUrl: string };
}
```

### `ProviderRegistry` — selection / fallback / per-task routing

```typescript
// src/providers/registry.ts

export type TaskKind =
  | 'chat'              // Long-form conversation
  | 'short-task'        // Single-turn (formula gen, polish) — prefer flash
  | 'vision'            // Image understanding
  | 'image-gen'         // Generate image
  | 'stock-image';      // Search free stock

export interface ProviderRegistry {
  /** Resolve which provider should serve this task kind. */
  resolve<T extends TaskKind>(kind: T): ProviderForTask<T>;

  /** Register a custom OpenAI-compatible LLM at runtime (Settings UI). */
  registerCustomLLM(config: CustomLLMConfig): void;

  /** Remove a custom provider. */
  unregister(providerId: string): void;

  list(): ProviderInfo[];
}

export type ProviderForTask<T extends TaskKind> =
  T extends 'chat' | 'short-task' ? LLMProvider :
  T extends 'vision' ? LLMProvider :
  T extends 'image-gen' ? ImageProvider :
  T extends 'stock-image' ? StockImageProvider :
  never;

export interface CustomLLMConfig {
  id: string;                        // UUID
  displayName: string;
  baseURL: string;                   // e.g. https://openrouter.ai/api/v1
  apiKey: string;
  defaultModel: string;
  capabilities?: Partial<ProviderCapabilities>;
}
```

**Selection / fallback rules (Phase 2 baseline):**

- `chat` → user's selected default LLM (DeepSeek `deepseek-v4-pro` factory default)
- `short-task` → user's "lightweight" override if set; otherwise default LLM at `deepseek-v4-flash` model
- `vision` → aihubmix vision (DeepSeek vision availability TBD by Q6 spike)
- `image-gen` → aihubmix `gpt-image-2`
- `stock-image` → user's chosen stock provider (Q1 spike outcome)

**Fallback in v1 is explicit, not automatic** — when a call fails, the UI offers "重试 / 换 Provider / 缩短上下文" rather than silently switching providers. Silent fallback is a v1.1+ feature once we have telemetry to know which fallbacks are safe.

### Adding a custom OpenAI-compatible Provider (user flow)

```typescript
// In Settings UI, user enters: name, baseURL, apiKey, defaultModel
providerRegistry.registerCustomLLM({
  id: crypto.randomUUID(),
  displayName: 'My OpenRouter',
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: 'sk-or-...',
  defaultModel: 'anthropic/claude-sonnet-4.5',
});
// Under the hood, this instantiates the same OpenAICompatibleLLM class
// that powers DeepSeek — only baseURL/apiKey/model differ.
```

### Typed Error Classes

```typescript
// src/providers/errors.ts

export abstract class AsterError extends Error {
  abstract readonly code: string;
  abstract readonly userAction: string;          // Localized fragment for UI
}

export class KeyInvalidError extends AsterError {
  readonly code = 'KEY_INVALID';
  readonly userAction = '请到设置检查 Provider Key';
}

export class QuotaExceededError extends AsterError {
  readonly code = 'QUOTA_EXCEEDED';
  readonly userAction = 'Provider 配额超限,可切换轻量模型或更换 Key';
}

export class ContextTooLongError extends AsterError {
  readonly code = 'CONTEXT_TOO_LONG';
  readonly userAction = '上下文过长,请减少选中或上传内容';
  constructor(public readonly tokensUsed: number, public readonly limit: number) {
    super(`context ${tokensUsed} > limit ${limit}`);
  }
}

export class NetworkError extends AsterError {
  readonly code = 'NETWORK';
  readonly userAction = '网络异常,检查代理或稍后重试';
}

export class UnsupportedOperationError extends AsterError {
  readonly code = 'UNSUPPORTED';
  readonly userAction = '该操作在当前宿主或环境下不受支持';
}

export class HostApiError extends AsterError {
  readonly code = 'HOST_API';
  readonly userAction = 'Office 写回失败,请重试或复制内容手动粘贴';
  constructor(public readonly hostErrorCode?: string, msg?: string) { super(msg); }
}
```

**Where they live in the layering:**

```
Provider layer throws: KeyInvalidError, QuotaExceededError, ContextTooLongError, NetworkError
Adapter layer throws:  HostApiError, UnsupportedOperationError
Scenario layer:        catches everything; maps to UI toast + recovery offer
React UI:              never throws; only renders the toast/dialog
```

---

## Architectural Patterns

### Pattern 1: Host Dispatcher (single SPA, three hosts)

**What:** A single `Office.onReady()` callback reads `info.host`, picks one of three `DocumentAdapter` implementations, and exposes it to the React tree via Context. The Task Pane SPA renders one shared layout, with host-tagged sub-screens for scenario UI.

**When to use:** Always, in this codebase. The alternative (three separate manifests + three separate bundles) wastes build time, kills code reuse, and triples the install instructions in the README.

**Trade-offs:**
- **Pro:** One build, one manifest section per host, near-100% code sharing.
- **Con:** Initial bundle must contain bootstrapping code for all three hosts. The adapter layer mitigates this — each adapter folder is small (~5KB), and PowerPoint.run / Excel.run / Word.run are all part of Office.js itself (loaded from CDN, not bundled).

**Example:**

```typescript
// src/app/main.tsx
import { createRoot } from 'react-dom/client';
import { AppShell } from './AppShell';
import { HostProvider } from './HostProvider';
import { createAdapter } from '../adapters';

Office.onReady((info) => {
  if (info.host === null) {
    // Running outside Office (local dev preview, broken sideload)
    renderFallback('Aster 必须在 Office for Web 中运行');
    return;
  }
  const adapter = createAdapter(info.host);   // throws if unsupported host
  const root = createRoot(document.getElementById('root')!);
  root.render(
    <HostProvider adapter={adapter}>
      <AppShell />
    </HostProvider>
  );
});

// src/adapters/index.ts
export function createAdapter(host: Office.HostType): DocumentAdapter {
  switch (host) {
    case Office.HostType.PowerPoint: return new PptAdapter();
    case Office.HostType.Excel:      return new ExcelAdapter();
    case Office.HostType.Word:       return new WordAdapter();
    default:
      throw new UnsupportedOperationError(`Host ${host} not supported`);
  }
}
```

### Pattern 2: Shared Runtime + Ribbon Bus

**What:** The manifest declares a `<Runtime>` element with `lifetime="long"` shared between the Task Pane page and `commands.html`. Both run in **the same JavaScript runtime** with shared globals. Ribbon button handlers can call into Task Pane state directly.

**When to use:** Whenever a ribbon button needs to (a) show progress in the Task Pane, (b) reuse the LLM provider singleton, or (c) keep state alive after the Task Pane closes. **Aster needs all three.** Shared runtime is mandatory.

**Trade-offs:**
- **Pro:** Direct function calls between ribbon command and Task Pane. No `postMessage`, no `localStorage` polling.
- **Con:** Only **one** Task Pane allowed per shared runtime. Aster has exactly one, so fine. Also: SharedRuntime requirement set is 1.1 in PPT/Word, 1.2 only in Excel — design for the 1.1 lowest common denominator.

**Example:**

```typescript
// src/services/ribbon-bus.ts
// Lives in the shared global namespace; both commands.ts and React import it.

export class RibbonBus {
  private taskPaneReady = false;
  private pendingScenarios: ScenarioInvocation[] = [];

  markTaskPaneReady() { this.taskPaneReady = true; this.flush(); }

  invokeScenario(scenarioId: string, payload: unknown) {
    if (!this.taskPaneReady) {
      this.pendingScenarios.push({ scenarioId, payload });
    } else {
      this.dispatch(scenarioId, payload);
    }
  }
  // ... dispatch reads chatStore + scenarios/* and runs the flow
}

export const ribbonBus = new RibbonBus();    // Module-singleton in shared runtime

// src/commands/commands.ts
import { ribbonBus } from '../services/ribbon-bus';

async function pptOutlineFromTopic(event: Office.AddinCommands.Event) {
  // Open the task pane and dispatch — both share the same `ribbonBus` instance
  await Office.addin.showAsTaskpane();
  ribbonBus.invokeScenario('ppt:outline-from-topic', { source: 'ribbon' });
  event.completed();
}
Office.actions.associate('pptOutlineFromTopic', pptOutlineFromTopic);
```

### Pattern 3: Lazy-loaded Parser Boundary

**What:** All heavyweight parsers (`mammoth`, `xlsx`, `pdfjs-dist`, pptx OOXML) live behind `await import()`. Vite's `manualChunks` gives each a stable filename for HTTP caching. The initial bundle never imports them, even transitively.

**When to use:** Always for the parser layer. N2 (≤1MB initial JS) is impossible otherwise — `pdfjs-dist` alone exceeds it.

**Trade-offs:**
- **Pro:** Initial Task Pane load stays small. Each parser downloads on first use, then cached forever.
- **Con:** First file upload has ~300ms-1s parser-download latency. Mitigation: prefetch on hover/focus of the upload icon (via `<link rel="prefetch">` emitted manually).

**Example:**

```typescript
// src/parsers/index.ts
export async function parseFile(file: File): Promise<ParsedContent> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'txt': case 'md': case 'csv': case 'json':
      return parseText(file);                                  // eager
    case 'docx': {
      const { parseDocx } = await import('./docx');            // → docx.chunk.js
      return parseDocx(file);
    }
    case 'xlsx': {
      const { parseXlsx } = await import('./xlsx');            // → xlsx.chunk.js
      return parseXlsx(file);
    }
    case 'pdf': {
      const { parsePdf } = await import('./pdf');              // → pdfjs.chunk.js
      return parsePdf(file);
    }
    case 'pptx': {
      const { parsePptx } = await import('./pptx');            // → pptx.chunk.js
      return parsePptx(file);
    }
    default:
      throw new UnsupportedOperationError(`不支持的文件类型: ${ext}`);
  }
}

// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'parser-docx':  ['mammoth'],
          'parser-xlsx':  ['xlsx'],
          'parser-pdf':   ['pdfjs-dist'],
          'react-vendor': ['react', 'react-dom'],
        },
      },
      external: ['office-js'],                                 // Loaded via <script> in HTML
    },
    chunkSizeWarningLimit: 1500,                               // pdfjs is large; suppress noise
  },
});
```

### Pattern 4: Settings Mirror (Office.context.settings + Zustand)

**What:** API keys and provider configs are written to `Office.context.document.settings` (PPT/Excel/Word) — **not** RoamingSettings, which is Outlook-only. They're mirrored into a Zustand store at boot, kept in sync with `saveAsync` on change.

**When to use:** For any user-editable persistent state. Aster has: default LLM provider id, default LLM key, default image provider id, default image key, list of custom providers.

**Trade-offs:**
- **Pro:** Survives Task Pane close + document close. Survives Office restart.
- **Con:** **Document-scoped**, not user-scoped. The PRD says "用户级、不随文档共享" — this is actually wrong for non-Outlook hosts. RoamingSettings is Outlook-only. For Word/Excel/PPT, persistence is document-scoped via `Settings`, or browser-scoped via partitioned `localStorage` (using `Office.context.partitionKey`). **For Aster, partitioned localStorage is the right choice** — it gives user-level scope while staying browser-local. See Pitfalls #1 for the correction.

**Example:**

```typescript
// src/services/settings.ts
const KEY = 'aster:v1:settings';

export async function loadSettings(): Promise<AsterSettings> {
  // partitionKey isolates per Office account, exactly what the PRD wants
  const namespace = Office.context.partitionKey ?? 'default';
  const raw = localStorage.getItem(`${KEY}:${namespace}`);
  return raw ? JSON.parse(raw) : DEFAULT_SETTINGS;
}

export async function saveSettings(s: AsterSettings): Promise<void> {
  const namespace = Office.context.partitionKey ?? 'default';
  localStorage.setItem(`${KEY}:${namespace}`, JSON.stringify(s));
}
```

---

## Data Flow

### Flow 1: Ribbon button → LLM → write back

```
[User clicks Ribbon "主题→大纲"]
        │
        ▼
commands.ts: pptOutlineFromTopic(event)
        │  ① Office.addin.showAsTaskpane()
        │  ② ribbonBus.invokeScenario('ppt:outline-from-topic')
        │  ③ event.completed()
        ▼
RibbonBus (shared global)
        │  routes to scenarios/ppt/outline-from-topic.ts
        ▼
Scenario.run(adapter, providerRegistry, chatStore)
        │  ① adapter.getSelection() → SelectionContext (PPT)
        │  ② chatStore.appendUser({prompt + selection summary})
        │  ③ provider = registry.resolve('chat')
        │  ④ for await chunk of provider.chat(messages, {signal})
        │       chatStore.appendAssistantDelta(chunk.delta)
        │  ⑤ parse final JSON outline from assistant text
        │  ⑥ render <InsertButton onClick={() => adapter.insertContent(...)} />
        ▼
[User reviews in Task Pane, clicks "插入到文档"]
        │
        ▼
adapter.insertContent({kind:'slides', outline}) → PowerPoint.run
        │  ① Build base64 pptx in-browser (JSZip + minimal OOXML template)
        │  ② presentation.insertSlidesFromBase64(base64, {targetSlideId})
        │  ③ context.sync()
        ▼
[Toast: "已插入 8 张幻灯片"]
```

### Flow 2: File upload → multimodal chat

```
[User drops PDF + image into chat input]
        │
        ▼
FileUpload component → parsers.parseFile(pdf) AND parseFile(image)
        │  ① pdf: dynamic-imports pdfjs.chunk.js (one-time)
        │  ② image: no parsing, kept as base64
        ▼
chatStore.appendUser({
  text: prompt,
  attachments: [
    {kind:'text', content: extractedPdfText},
    {kind:'image', base64: imgBase64},
  ]
})
        │
        ▼
provider = registry.resolve('vision')  // routes to aihubmix-vision
        │  Provider sees mixed content → emits OpenAI vision-shaped messages
        │  Text from PDF goes as text block; image as image_url block
        ▼
[Streamed response renders in chat]
```

### Flow 3: Selection-triggered context update

```
Office.context.document.addHandlerAsync(DocumentSelectionChanged, ...)
        │
        ▼ (debounced 150ms)
SelectionWatcher → adapter.getSelection()
        │
        ▼
selectionStore.set(context)
        │
        ▼
[ContextCard component re-renders: "当前选中:Slide 3"]
```

### State Management

```
┌──────────────────────────────────────────────────────────────┐
│                      Zustand Stores                          │
├──────────────────────────────────────────────────────────────┤
│  chatStore       — messages[], streamingDelta, isPending     │
│  selectionStore  — current SelectionContext + preview        │
│  settingsStore   — providers, keys, default Provider id      │
│  uiStore         — onboardingComplete, theme, panel width    │
└──────────────────────────────────────────────────────────────┘
        ↑                ↑                ↑                ↑
        │                │                │                │
        │     ┌──────────┘                │                │
        │     │              ┌────────────┘                │
        │     │              │                ┌────────────┘
   Scenarios  SelectionWatcher  Settings UI         Onboarding
   RibbonBus
   ChatStream UI
```

- `chatStore` is **in-memory only** (PRD says no v1 persistence).
- `selectionStore` is **in-memory**, refreshed by event handler.
- `settingsStore` is **mirrored to partitioned localStorage** at every change.
- `uiStore` is **mirrored to partitioned localStorage** (small things like onboarding-complete flag).

---

## Manifest Decision

**Recommendation: XML "add-in only" manifest for v1.0. Migrate to unified JSON in v1.1+ if mature.**

Rationale:
1. **Unified JSON manifest is still in preview for Excel/PowerPoint/Word as of 2026.** Production-supported only for Outlook. The OfficeDev/office-js#6513 open letter from Feb 2026 documents serious feature gaps with unified manifest in non-Outlook hosts, including ExecuteFunction not working.
2. **Cross-host XML is a single file** with multiple `<Host Name="Workbook"/>`, `<Host Name="Document"/>`, `<Host Name="Presentation"/>` declarations. Mature, well-documented, fully supported.
3. **Sideload via XML works on Office for Web today, no preview-channel requirement.** Aster's MVP target.
4. **Migration path is documented** — `office-addin-manifest convert` tool exists for XML→JSON when we're ready.

**Single manifest, multiple hosts:**

```xml
<OfficeApp xsi:type="TaskPaneApp" ...>
  <DefaultLocale>zh-CN</DefaultLocale>
  <Hosts>
    <Host Name="Presentation"/>
    <Host Name="Workbook"/>
    <Host Name="Document"/>
  </Hosts>
  <Requirements>
    <Sets>
      <Set Name="SharedRuntime" MinVersion="1.1"/>
    </Sets>
  </Requirements>
  ...
  <VersionOverrides ...>
    <Hosts>
      <Host xsi:type="Presentation">
        <Runtimes>
          <Runtime resid="Taskpane.Url" lifetime="long"/>
        </Runtimes>
        <DesktopFormFactor>
          <GetStarted>...</GetStarted>
          <FunctionFile resid="Commands.Url"/>
          <ExtensionPoint xsi:type="PrimaryCommandSurface">
            <CustomTab id="Aster.PPT.Tab">
              <Group id="Aster.PPT.Group">
                <Label resid="Aster.PPT.Group.Label"/>
                <Control xsi:type="Button" id="Aster.PPT.OutlineBtn">
                  <Action xsi:type="ExecuteFunction">
                    <FunctionName>pptOutlineFromTopic</FunctionName>
                  </Action>
                </Control>
                ...
              </Group>
            </CustomTab>
          </ExtensionPoint>
        </DesktopFormFactor>
      </Host>
      <!-- Repeat for Workbook (Excel) and Document (Word) -->
    </Hosts>
  </VersionOverrides>
</OfficeApp>
```

The `<Runtime lifetime="long"/>` is the crucial line that enables the shared runtime.

---

## Build Output

Vite builds produce:

```
dist/
├── manifest.xml                    # Hand-maintained, copied as-is
├── taskpane.html                   # References ./assets/main-[hash].js
├── commands.html                   # References ./assets/commands-[hash].js
├── assets/
│   ├── main-[hash].js              # App shell + adapters + providers + UI (~800KB target)
│   ├── commands-[hash].js          # ~30KB
│   ├── parser-docx-[hash].js       # ~250KB, lazy
│   ├── parser-xlsx-[hash].js       # ~900KB, lazy
│   ├── parser-pdf-[hash].js        # ~1.5MB, lazy
│   ├── parser-pptx-[hash].js       # ~150KB, lazy
│   └── react-vendor-[hash].js      # ~140KB
└── icons/
    ├── icon-16.png ... icon-80.png
```

**Sideload package:** Just `manifest.xml` + all of `dist/` hosted on a static host (GitHub Pages for the OSS distribution). The README links to the manifest URL; users sideload it directly in Office for Web.

**Future AppSource path:** AppSource accepts XML manifests today. When we migrate to unified JSON post-v1.1, `office-addin-manifest convert manifest.xml` produces a JSON manifest plus the required `colorIcon.png` / `outlineIcon.png` per current AppSource spec.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 users | No changes. Direct browser→Provider works. README + sideload manifest sufficient. |
| 100-10k users | Still no backend. Optionally publish to AppSource (XML manifest works today). Consider a Discord/issues board for support. |
| 10k+ users | Architecture unchanged (BYO Key keeps backend at zero), but operationally: add error telemetry (opt-in, OSS-friendly — Sentry self-hosted or PostHog). |

### Scaling Priorities

1. **First bottleneck: token cost on user side.** Heavy chat users blow through Provider quotas. Mitigation already in design — flash-model routing for short tasks (`registry.resolve('short-task')`).
2. **Second bottleneck: parser performance on large files.** `pdfjs-dist` extracts text synchronously; a 200-page PDF blocks the Task Pane UI. Mitigation: parsers run in a Web Worker (Phase 3 polish item — not MVP).

---

## Anti-Patterns

### Anti-Pattern 1: Direct `PowerPoint.run` calls in React components

**What people do:** Component handlers call `PowerPoint.run(async ctx => ...)` directly.
**Why it's wrong:** Couples UI to host APIs, makes Excel/Word reuse impossible, kills testability. The component must work in three hosts; the host-specific code must not.
**Do this instead:** Components call `useHost().adapter.insertContent(...)`. The adapter is the only place `PowerPoint.run` exists.

### Anti-Pattern 2: Provider SDK imports at top of file

**What people do:** `import OpenAI from 'openai'` at the top of `chat.ts`. Imports `mammoth` at the top of `file-upload.tsx`.
**Why it's wrong:** Vite bundles eagerly. Either inflates initial bundle past 1MB, or — worse — only blows up after `vite build` when a user reports "Aster takes 8 seconds to open".
**Do this instead:** Heavy modules only via `await import(...)` inside the function that needs them. For OpenAI SDK — actually, don't use it at all; the SDK is ~200KB and we only need `fetch + SSE parsing`. Write 80 lines of SSE-aware fetch in `lib/sse.ts`.

### Anti-Pattern 3: Storing keys in document Settings

**What people do:** Use `Office.context.document.settings.set('apiKey', ...)`.
**Why it's wrong:** (a) keys end up embedded in the document — they roam with the .pptx/.xlsx/.docx; (b) any collaborator on a shared file can read them; (c) the PRD's stated goal is user-level scope.
**Do this instead:** Partitioned `localStorage` keyed on `Office.context.partitionKey`. User-scoped, browser-scoped, document-independent.

### Anti-Pattern 4: Using React Router (browser history mode)

**What people do:** Configure React Router with `createBrowserRouter()`.
**Why it's wrong:** Office.js nulls `window.history.pushState` and `replaceState`. Browser-history routing silently breaks navigation.
**Do this instead:** Hash routing (`createHashRouter`) or no router at all — Aster's UI is shallow enough that a simple state-driven `<Onboarding | MainApp | Settings>` switch suffices.

### Anti-Pattern 5: Auto-fallback between providers

**What people do:** Catch a `QuotaExceededError`, silently retry with another provider.
**Why it's wrong:** User doesn't know whose key was used or charged. Different providers have different prompts/quality. Breaks the "BYO Key, transparent" core value.
**Do this instead:** Surface the error, offer "Retry with X" as an explicit user action.

### Anti-Pattern 6: Long-lived `await context.sync()` inside React render

**What people do:** Call `await adapter.getSelection()` directly inside a `useEffect` body that runs on every render.
**Why it's wrong:** `context.sync()` is expensive (round-trip to Office process). Hammering it freezes the UI.
**Do this instead:** Selection state lives in the `selectionStore`. One subscriber (`SelectionWatcher`) updates it; React components read from the store, never call the adapter directly.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| DeepSeek (`api.deepseek.com/v1`) | OpenAI-compatible fetch + SSE | `deepseek-v4-pro` (default), `deepseek-v4-flash` (short tasks). Both stream via SSE; reasoning models emit `reasoning_content` deltas separate from `content`. 1M token context. |
| aihubmix (`gpt-image-2`) | REST POST, returns URL or base64 | Image gen. Validate result URL is reachable from Office iframe (CSP / CORS) — spike item. |
| aihubmix vision | OpenAI-compatible vision-format messages | DeepSeek-V4 native multimodal is Q6 spike; aihubmix is the de-risked path. |
| Unsplash or Pexels | REST search; Q1 spike decides which | Direct browser fetch. Keys are public client keys, not BYO. Bundle credit attribution per their TOS. |
| Office host (`PowerPoint.run`, `Excel.run`, `Word.run`) | Office.js promise API | Loaded from CDN (`appsforoffice.microsoft.com/lib/1/hosted/office.js`), not bundled. Marked external in Vite config. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Commands ↔ Task Pane | Shared runtime globals (`ribbonBus`) | Required: `<Runtime lifetime="long"/>` in manifest |
| Adapter ↔ Office host | `PowerPoint.run` / `Excel.run` / `Word.run` | Always batch through one `context.sync()` per logical operation |
| Provider ↔ External API | `fetch` + SSE parser (`lib/sse.ts`) | No vendor SDKs in initial bundle |
| Scenario ↔ Adapter | Direct function call | Adapter passed in via Host Context |
| Scenario ↔ Provider | Via `ProviderRegistry.resolve(taskKind)` | Never instantiate providers directly |
| UI ↔ Services | Via Zustand stores + React Context | UI never imports adapters or providers directly |

---

## Build Order Validation (PRD Phase 0-7)

**PRD-proposed phases:**

| # | Phase | Validated? |
|---|-------|-----------|
| 0 | Spike | ✅ Correct — highest-risk validation, 1-week timebox |
| 1 | Foundation (scaffold + manifest + Task Pane skeleton + Ribbon placeholders) | ✅ Correct |
| 2 | Provider abstraction + Settings + Onboarding | ⚠️ Reorder — see below |
| 3 | File upload + parsers | ⚠️ Reorder — see below |
| 4 | PPT 3 scenarios + 2 Ribbon buttons | ✅ Correct |
| 5 | Excel 3 scenarios + 2 Ribbon buttons | ✅ Correct |
| 6 | Word 3 scenarios + 2 Ribbon buttons | ✅ Correct |
| 7 | Polish + sideload docs + README + v1.0 release | ✅ Correct |

### Reorder recommendation: Phase 2 ⇄ Phase 3? No — keep PRD order, but **expand Phase 1** to include `DocumentAdapter` interface + skeleton implementations.

After deeper analysis, the PRD order is actually right. But the PRD's Phase 1 is too light. **Phase 1 should explicitly deliver the `DocumentAdapter` interface plus a stub for each host** that returns hard-coded data. Otherwise Phase 2 (Provider abstraction) has no way to validate against real selection contexts, and Phase 4-6 each have to reinvent the adapter.

**Revised Phase 1 deliverables:**

1. Yeoman / Office Add-in CLI scaffold ✅
2. XML manifest with three `<Host>` declarations + shared runtime ✅
3. Vite + React 18 + TypeScript build ✅
4. Task Pane shell with host-dispatcher (Office.onReady → adapter) ✅
5. **NEW: `DocumentAdapter` interface + `SelectionContext` types in `src/adapters/types.ts`** ⭐
6. **NEW: `PptAdapter` / `ExcelAdapter` / `WordAdapter` skeletons with `getSelection()` working** ⭐
7. Ribbon button placeholders (6 buttons, all wired to `console.log`) ✅
8. `commands.html` + `Office.actions.associate` registrations ✅

This makes Phase 2 (Provider) and Phase 4-6 (scenarios) able to consume a real adapter, not a mock.

### Missing items in PRD's phase plan

1. **Testing harness** — PRD has no test phase. Vitest + Playwright should be added to Phase 1 (smoke tests for adapter skeletons) and built upon in Phases 4-6.
2. **Bundle budget enforcement** — N2 requires ≤1MB. Phase 7 polish is too late to discover we're at 1.4MB. Add a `vite-bundle-visualizer` CI check from Phase 1.
3. **Error model rollout** — Typed error classes (KeyInvalidError, etc.) should land in Phase 2 alongside Provider abstraction, not be retrofitted.
4. **Telemetry-free analytics for OSS** — PRD lists no telemetry, which is fine for v1.0. Document this explicitly in README so users know nothing phones home. Optional self-hosted PostHog is a v1.1+ consideration.
5. **i18n scaffold** — Even though English is v1.1 stretch, the Phase 1 scaffold should put strings in a single `src/i18n/zh.ts` file so v1.1 i18n isn't a refactor.

### Parallelizable: PPT (Phase 4) → Excel/Word (Phase 5+6)

PRD already calls this out — Phase 4/5/6 are parallelizable. Reinforcing: **build PPT first as the reference implementation** (PRD's recommendation), then 5 and 6 can fork from the same adapter pattern.

### Suggested final phase ordering

```
Phase 0:  Spike (1 wk timebox) ─────► R1/R2/R3 verdicts
Phase 1:  Foundation + DocumentAdapter interface + adapter skeletons + Vite/Vitest
Phase 2:  Provider abstraction + Settings + Onboarding + typed errors + bundle budget CI
Phase 3:  File upload + lazy parsers + multimodal routing through providers
Phase 4:  PPT 3 scenarios + 2 Ribbon buttons (reference implementation)
Phase 5:  Excel 3 scenarios + 2 Ribbon buttons   ┐
Phase 6:  Word 3 scenarios + 2 Ribbon buttons    ┘ (parallelizable with Phase 5)
Phase 7:  Cross-host polish + README + sideload docs + v1.0 release
```

This matches PRD intent with the Phase-1 expansion noted above.

---

## Sources

### Office.js Platform (HIGH confidence — Microsoft Learn)

- [Office Add-ins manifest overview](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/add-in-manifests)
- [Unified manifest overview (preview status for Excel/PPT/Word)](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/unified-manifest-overview)
- [Compare add-in only manifest with unified manifest](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/json-manifest-overview)
- [Configure your Office Add-in to use a shared runtime](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/configure-your-add-in-to-use-a-shared-runtime)
- [Runtimes in Office Add-ins](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/runtimes)
- [Shared runtime requirement sets (1.1 / 1.2)](https://learn.microsoft.com/en-us/javascript/api/requirement-sets/common/shared-runtime-requirement-sets)
- [Office.HostType enum](https://learn.microsoft.com/en-us/javascript/api/office/office.hosttype)
- [Connect Office.js to any JavaScript framework (Vite/Webpack guidance)](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/connect-to-javascript-frameworks)
- [Application-specific API model (PowerPoint.run, Excel.run, Word.run)](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/application-specific-api-model)
- [Persist add-in state and settings](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/persisting-add-in-state-and-settings)
- [PowerPoint insertSlidesFromBase64 + insert into selection](https://learn.microsoft.com/en-us/office/dev/add-ins/powerpoint/insert-slides-into-presentation)
- [Create add-in commands with the add-in only manifest](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/create-addin-commands)
- [Announcing changes to ExecuteFunction commands (Office.actions.associate)](https://devblogs.microsoft.com/microsoft365dev/announcing-changes-to-office-add-ins-executefunction-commands/)
- [Dialog best practices (router/pushState gotcha)](https://github.com/OfficeDev/office-js-docs-pr/blob/main/docs/develop/dialog-best-practices.md)
- [Office Add-in TaskPane React template (official)](https://github.com/OfficeDev/Office-Addin-TaskPane-React)
- [Open letter on Office.js stability (Feb 2026, OfficeDev/office-js#6513)](https://github.com/OfficeDev/office-js/issues/6513) — confidence MEDIUM, community source but cited for unified-manifest preview gaps

### LLM Provider Abstraction Patterns (MEDIUM-HIGH — multiple production OSS sources)

- [Continue's LLM Abstraction Layer architecture](https://deepwiki.com/continuedev/continue/4.1-extension-architecture)
- [lunary-ai/abso — OpenAI-shaped TS SDK for 100+ providers](https://github.com/lunary-ai/abso)
- [pi-ai LLM Provider Abstraction](https://deepwiki.com/agentic-dev-io/pi-agent/3-llm-provider-abstraction-(pi-ai))
- [Architecting AI Agents with TypeScript (apeatling)](https://apeatling.com/2025/04/21/architecting-ai-agents-with-typescript/)
- [LiveKit Agents LLM Integration](https://deepwiki.com/livekit/agents/4-llm-integration)

### DeepSeek API (HIGH — official DeepSeek docs + 2026 reviews)

- [DeepSeek API — Your First API Call](https://api-docs.deepseek.com/)
- [DeepSeek V4 API Guide 2026 (Codersera)](https://codersera.com/blog/how-to-use-deepseek-v4-api-developer-guide-2026/)
- [DeepSeek API Streaming SSE Guide for V4](https://deepseekai.guide/api/deepseek-api-streaming/)

### Vite Code Splitting (HIGH — official Vite docs)

- [Vite Features — code splitting & async chunks](https://vite.dev/guide/features)
- [Vite Discussion: optimize large projects with dynamic imports](https://github.com/vitejs/vite/discussions/17730)
- [Vite Discussion: chunks larger than 500KB warning](https://github.com/vitejs/vite/discussions/9440)
- [Office-Addin-React-Vite-Template (community Vite + React 18)](https://github.com/ExtraBB/Office-Addin-React-Vite-Template)

---

*Architecture research for: Aster cross-host Office.js Add-in (PPT / Excel / Word)*
*Researched: 2026-05-26*
