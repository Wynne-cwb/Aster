# Phase 2: Provider 抽象 + Settings + Onboarding + 错误 UX — Research

**Researched:** 2026-05-27
**Domain:** LLM Client / Provider Routing / Storage / Streaming SSE / Error UX / Office Add-in Task Pane
**Confidence:** HIGH（核心 wire-format / storage 均经官方文档验证；aihubmix image-gen 路径 MEDIUM）

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Onboarding（KEY-02 / KEY-03）**
- D-01: Onboarding 可跳过——允许用户不填 Key 先进入空态。未配 Key 时顶部持续显示「去设置填 Key」提示条；用户发送消息时才拦截并引导。不做强制阻断。
- D-02: 第 1 步默认 Provider 预选 DeepSeek（聊天主力）；DeepSeek Key 为主输入，aihubmix Key 作为视觉/生图的选填项。
- D-03: 第 2 步功能介绍卡只显示当前宿主一张（PPT 里只看 PPT 卡），不三宿主全展示。
- D-04: Onboarding 首启自动弹一次（localStorage 标记已看过）；设置里提供「重看引导」入口可手动重开。
- D-05: 隐私告知落点 = 第 1 步填 Key 区域旁内联常驻文案：「你选中的文档内容会发送到所配置的 Provider」，不单独占一步。

**Settings 形态 + Provider 落点（PROV-05 / KEY-01,05）**
- D-06: 设置页 = 整页从右侧滑入覆盖整个 Task Pane，顶部带返回。
- D-07: Provider 切换归设置管理，输入栏不放下拉。Provider 增删改、Key 管理、默认 Provider 选择全部在设置里完成；输入栏只保留 输入框 + 上传 + 发送。（修订 PANE-01：去掉输入栏的 Provider 下拉）
- D-08: 自定义 OpenAI-compatible Provider 录入表单 = 只要 `baseURL` + `apiKey` + `model` 三字段，不收单价，model 手填。
- D-09: 内置 DeepSeek / aihubmix 单价写死不可改（预填官方单价），用户不能覆写。

**错误 UX 呈现（PROV-08 / PROV-09）**
- D-10: 错误主体 = 聊天流里的「失败气泡」内联呈现（警示色），承载 错误文案 + CTA + 重试。
- D-11: 失败消息留在聊天历史，原 prompt 不丢失；失败气泡带「重试」按钮，点击原地重发同一 prompt。
- D-12: CTA 深链到设置对应项——如 401 的「去设置 →」直接打开设置并定位到出问题那个 Provider 的 Key 字段。
- D-13: 8 类错误文案 = 每类一句明确中文原因 + 一个可操作 CTA（如「DeepSeek Key 无效，去设置 →」）。不做折叠技术详情层。

**聊天交互 + 成本徽章（PANE-02,04 / COST-01,02）**
- D-14: 流式生成中的「停止」键 = 发送键原地变停止方块（同位置），生成完变回发送键。
- D-15: 当前选区默认自动附带给每条消息；胶囊要简洁、不打扰；胶囊上提供去掉当前附带的 ×；并提供一个开关可整体关闭自动附带功能。
- D-16: 「插入到文档」按钮在 Phase 2 = 三宿主 adapter 都实现最小 `text` 插入，按钮真能把纯文本写回当前文档（把 Phase 1 抛 `UnsupportedOperationError` 的 `insert()` 桩替换为至少 `type:'text'` 可用）。
- D-17: 成本徽章 = ¥ 人民币，DeepSeek 官价为 USD，用内置固定汇率换算成 ¥ 显示；徽章只显「本次：N token · ¥X」总数，不拆 prompt/completion。自定义 Provider 徽章只显「本次：N token」无价格。（修订 COST-02：自定义 Provider 不录单价）

### Claude's Discretion
- 内置 USD→CNY 固定汇率的具体数值与是否在徽章旁标注「约」字——研究阶段定一个合理常数，不引入实时汇率 API。
- `ProviderRegistry` 路由表的内部数据结构、单飞队列的实现细节、指数退避的初始间隔/上限——research + planner 按 PROV-04/07/09 定。
- SSE 解析器 `src/lib/sse.ts` 的具体实现（约 40 行 fetch + ReadableStream，`[DONE]` 检测、JSON line decode）。

### Deferred Ideas (OUT OF SCOPE)
- Onboarding 内联 Key 校验（v1.1 ONB-01）
- 聊天历史本地持久化（IndexedDB，v1.1 PERS-01）
- 结构化插入与样式保留写回（Phase 4-6）
- 实时汇率（无后台约束，已排除）
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROV-01 | `LLMProvider` / `ImageProvider` / `StockImageProvider` 接口定义 | §标准技术栈 Provider 接口层 |
| PROV-02 | `OpenAICompatibleLLM` 单一实现服务 DeepSeek + 自定义 Provider | §SSE 解析器具体实现 |
| PROV-03 | aihubmix 视觉客户端 + image-gen 客户端（专用路径） | §aihubmix API shapes |
| PROV-04 | `ProviderRegistry.resolve(taskKind)` 路由，无自动 fallback | §ProviderRegistry 路由表设计 |
| PROV-05 | Settings 里新增/编辑/删除自定义 Provider 与 Key | §设置页 UI 架构 |
| PROV-06 | SSE 流式 `src/lib/sse.ts`，首 token ≤ 2s | §SSE 解析器具体实现 |
| PROV-07 | AbortController 取消 + visibilitychange abort + 单飞队列 | §AbortController + visibilitychange |
| PROV-08 | 8 类错误 UX，每类对应可操作 CTA | §错误类 HTTP 状态映射 |
| PROV-09 | 429 指数退避 + Retry-After 遵守；billing 类不重试 | §指数退避实现 |
| PROV-10 | ESLint 规则禁用 legacy 模型名与 SDK 包导入 | §ESLint 规则 |
| KEY-01 | API Key 存储用 partitioned localStorage + Office.context.partitionKey | §Storage 模式 |
| KEY-02 | 首次启动 Onboarding modal，2 步 | §Onboarding 流程 |
| KEY-03 | Onboarding 明确隐私告知 | §Onboarding 流程 |
| KEY-04 | API Key 永不上传 Aster 服务器 | 架构硬约束，无需额外研究 |
| KEY-05 | Key 跨文档切换不丢；换浏览器丢（明确告知） | §Storage 模式 + partitionKey 行为 |
| COST-01 | 解析 OpenAI-compatible `usage` 字段 | §DeepSeek streaming usage 报告 |
| COST-02 | 成本徽章：内置 Provider 显 ¥，自定义仅显 token 数 | §成本徽章计算 |
| PANE-02 | 多轮对话，AI 输出流式渲染 | §SSE 解析器 + Zustand store |
| PANE-03 | 聊天历史仅内存级 | §Zustand store 设计 |
| PANE-04 | 每条 AI 输出提供「插入到文档」按钮 | §DocumentAdapter.insert() 最小实现 |
| NFR-02 | 单条 prompt 端到端 P95 ≤ 10s | §性能指标 |
| NFR-03 | 所有 LLM 调用支持流式，首 token ≤ 2s | §SSE 解析器具体实现 |
</phase_requirements>

---

## Summary

Phase 2 是 Aster 的「AI 调用总线」——所有上游（Phase 3-6）的 AI 操作都会经过这里。核心交付是一个 40 行左右的 SSE 解析器（`src/lib/sse.ts`）、一个 ProviderRegistry 路由表、partitioned localStorage Key 管理、8 类错误类（Phase 1 补齐 4 个缺失），以及 Onboarding / Settings 这两个 UI 层入口。

技术复杂度集中在三处：(1) DeepSeek 的 `stream_options.include_usage` 必须在请求体里显式打开，才会在 `[DONE]` 前返回 token usage chunk——不打开的话 streaming 全程 `"usage": null`；(2) partitioned localStorage 的 key 必须用 `Office.context.partitionKey` 前缀包装，在 Office for Web (Chrome/Edge ≥115) 上不这样做会导致不同 Office 宿主之间的数据泄漏；(3) 同一 Provider 的单飞队列须用 `Map<providerId, Promise>` 在模块级维护，不能在组件级维护（生命周期不对）。

aihubmix 视觉路径（Phase 0 spike #4 锁定）使用 `POST /chat/completions` 带 `image_url` content part，选用 `gpt-4o` 或 `gpt-4o-mini` 等支持视觉的模型；生图路径使用 `POST /images/generations`，模型 `gpt-image-1`（文档明确支持）或 `gpt-image-2`（ASSUMED，文档无明确页面）。

**主要建议：** 先建 `src/lib/sse.ts` 和 `src/lib/storage.ts`（partitionKey 工具）作为无依赖基础，再构建 `src/providers/` 层，最后接 Zustand store 和 UI。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SSE 解析 / LLM 调用 | 浏览器（客户端 fetch） | — | 无后台硬约束；直连 Provider |
| Key 持久化 | 浏览器（partitioned localStorage） | — | KEY-01 / 无后台 / partitionKey 分区 |
| Provider 路由 | 浏览器（ProviderRegistry singleton） | — | 纯客户端路由，无 CDN 层 |
| Zustand store（聊天历史 + 流式状态） | 浏览器（React 内存） | — | PANE-03 只内存级 |
| Settings / Onboarding UI | 浏览器（Task Pane React） | — | Task Pane = 浏览器内嵌 webview |
| DocumentAdapter.insert() 写回 | Office.js 宿主（API 层） | — | 经 Office.js host API；不可绕过 |
| 错误 UX 气泡 | 浏览器（React 聊天流渲染层） | — | D-10：内联失败气泡，不用 toast |
| 成本徽章计算 | 浏览器（计算层 + React 渲染层） | — | 本地计算，固定汇率，无后台 |

---

## Standard Stack

### 已安装依赖（Phase 2 直接使用，无需新增安装）

| 库 | 已安装版本 | Phase 2 用途 |
|---|---|---|
| `react` + `react-dom` | `^19.0.0`（实测 19.2.6） | 全部 UI 组件 |
| `zustand` | `^5.0.0`（实测 5.0.13） | 聊天 store / Provider 配置 store |
| `@lingui/react` + `@lingui/macro` | `^5.0.0`（实测 6.1.0） | 所有 UI 字符串 i18n 包裹 |
| `react-markdown` + `remark-gfm` | `^9.0.0` / `^4.0.0` | AI 输出 Markdown 渲染 |
| `typescript` | `^5.7.0` | strict 模式 |
| `vitest` | `^2.0.0` | 单元测试 |

[VERIFIED: npm view / package.json]

### Phase 2 无需新增 npm 依赖

所有功能都用已安装的库 + 原生浏览器 API（`fetch`, `ReadableStream`, `AbortController`, `localStorage`, `document.visibilityState`）实现。不引入任何 LLM SDK（技术栈硬约束）。

---

## Architecture Patterns

### 系统数据流图

```
用户输入 (InputBar)
    │ prompt + SelectionContext
    ▼
ChatStore (Zustand)
    │ dispatch sendMessage
    ▼
ProviderRegistry.resolve(taskKind)
    │ → LLMConfig {baseURL, apiKey, model}
    ▼
SingleFlightQueue.enqueue(providerId, fn)   ← 同 Provider 单飞
    │
    ▼
OpenAICompatibleLLM.streamChat(messages, config, abortSignal)
    │   fetch POST /chat/completions
    │   stream_options: { include_usage: true }
    ▼
src/lib/sse.ts parseSSEStream(body)
    │ yield {delta: string} → ChatStore 实时 append
    │ yield {usage: Usage} → CostBadge 更新
    │ AbortController ← StopButton / visibilitychange
    ▼
AI 输出气泡 (ChatStream 渲染)
    │ react-markdown
    │ CostBadge「本次：N token · ¥X」
    │ 插入按钮 → DocumentAdapter.insert({type:'text'})
    ▼
错误路径:
    HTTP状态 → AsterError 子类 → ErrorBubble {原因 + CTA}
                                  CTA → 深链打开 Settings (D-12)
```

**aihubmix 专用路径（图像）：**
```
视觉请求 (vision):
    ProviderRegistry.resolve('vision')
    → AihubmixVisionClient.chat(messages_with_image_url)
    → POST api.aihubmix.com/v1/chat/completions
    → 普通 OpenAI-compatible 响应（非流式或流式，根据需要）

生图请求 (image-gen):
    ProviderRegistry.resolve('image-gen')
    → AihubmixImageGenClient.generate(prompt, size, quality)
    → POST api.aihubmix.com/v1/images/generations  { model: 'gpt-image-1' }
    → { data: [{b64_json: '...'}], usage: {...} }
```

### 推荐目录结构

```
src/
├── lib/
│   ├── sse.ts              # SSE 解析器 (~40 行，原生 fetch + ReadableStream)
│   └── storage.ts          # partitioned localStorage 工具函数
├── providers/
│   ├── types.ts            # LLMProvider / ImageProvider / StockImageProvider 接口
│   ├── registry.ts         # ProviderRegistry.resolve(taskKind) + 路由表
│   ├── openai-compat.ts    # OpenAICompatibleLLM 实现（DeepSeek + 自定义共用）
│   ├── aihubmix-vision.ts  # aihubmix 视觉客户端
│   ├── aihubmix-image.ts   # aihubmix 生图客户端
│   └── queue.ts            # 单飞队列 Map<providerId, Promise>
├── store/
│   ├── chat.ts             # Zustand：消息列表、流式状态、成本徽章
│   └── providers.ts        # Zustand：Provider 配置列表、默认 Provider
├── components/
│   ├── Settings/
│   │   ├── SettingsPanel.tsx   # 整页滑入覆盖（D-06）
│   │   ├── ProviderList.tsx    # Provider 增删改列表
│   │   └── ProviderForm.tsx    # baseURL + apiKey + model 三字段表单（D-08）
│   ├── Onboarding/
│   │   ├── OnboardingModal.tsx # 2 步 modal
│   │   ├── Step1Keys.tsx       # DeepSeek Key（必填）+ aihubmix Key（选填）
│   │   └── Step2Guide.tsx      # 宿主功能介绍卡（D-03）
│   ├── ChatBubble.tsx          # 消息气泡（AI / User / Error）
│   ├── ErrorBubble.tsx         # 失败气泡 + CTA + 重试（D-10..D-13）
│   ├── CostBadge.tsx           # 「本次：N token · ¥X」徽章（D-17）
│   └── SelectionPill.tsx       # 选区胶囊（D-15）
├── errors/
│   └── index.ts            # Phase 1 已有 4 类，Phase 2 补齐 4 类
└── adapters/
    ├── PptAdapter.ts       # insert({type:'text'}) 真实实现（D-16）
    ├── ExcelAdapter.ts     # insert({type:'text'}) 真实实现（D-16）
    └── WordAdapter.ts      # insert({type:'text'}) 真实实现（D-16）
```

---

## Don't Hand-Roll

| 问题 | 不要手写 | 使用 | 原因 |
|------|---------|------|------|
| Markdown 渲染 | 自写 MD 解析 | `react-markdown` + `remark-gfm` | XSS 安全、代码块、表格；已安装 |
| 客户端状态 | useContext/useState 全局链 | `zustand` | 流式 100+ msg 高频更新；selector 订阅；已安装 |
| i18n 字符串 | 硬编码中文 | Lingui `<Trans>`/`t` macro | 统一 catalog，v1.1 加英文零重构 |
| CSS 设计系统 | 新组件自定义样式 | `src/styles.css` CSS 变量 | 已有完整 token 体系，不散落硬编码 |
| Office.js 宿主写回 | document.body DOM 操作 | `DocumentAdapter.insert()` | Office.js 是唯一合法写回路径 |

**关键洞察：** LLM SDK（openai / @anthropic-ai/sdk / ai）在「无后台、浏览器直连」场景下是负担而非帮助——它们增加 30-60KB、需要 `dangerouslyAllowBrowser: true`、按 Node.js server 模式设计。40 行原生 fetch 是正确选择。

---

## SSE 解析器具体实现

**文件：`src/lib/sse.ts`**

```typescript
// Source: DeepSeek API docs + MDN ReadableStream
// stream_options.include_usage = true → 在 data:[DONE] 前额外发一个 usage chunk
// keep-alive 行格式：": keep-alive\n\n" — 必须跳过

export interface SSEDelta {
  type: 'delta';
  content: string;
}

export interface SSEUsage {
  type: 'usage';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type SSEEvent = SSEDelta | SSEUsage;

export async function* streamSSE(
  url: string,
  body: object,
  signal: AbortSignal,
): AsyncGenerator<SSEEvent> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${(body as Record<string, string>).apiKey}`,
    },
    body: JSON.stringify({ ...body, stream: true, stream_options: { include_usage: true } }),
    signal,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw mapHttpError(resp.status, err);
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      if (!data || data.startsWith(':')) continue; // keep-alive 或空行

      try {
        const chunk = JSON.parse(data);
        // usage chunk（最后一个 chunk，choices 为空数组）
        if (chunk.usage && chunk.usage.total_tokens != null) {
          yield {
            type: 'usage',
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          };
        }
        // delta chunk
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          yield { type: 'delta', content };
        }
      } catch {
        // malformed JSON 忽略
      }
    }
  }
}
```

**关键细节（来自 DeepSeek 官方文档）：**
- `stream_options: { include_usage: true }` 是显式 opt-in，不开则全程 `"usage": null`。[VERIFIED: api-docs.deepseek.com]
- keep-alive 行格式：`: keep-alive`（以冒号开头，不是 `data:`）。
- usage chunk 在 `data:[DONE]` 之前、最后一个 content chunk 之后发出，`choices` 为空数组。

---

## Storage 模式（partitioned localStorage）

**文件：`src/lib/storage.ts`**

```typescript
// Source: learn.microsoft.com/en-us/office/dev/add-ins/develop/persisting-add-in-state-and-settings
// partitionKey 是 undefined 时（Windows WebView，无分区）直接用 key 本身

function key(rawKey: string): string {
  const pk = Office.context.partitionKey;
  return pk ? pk + rawKey : rawKey;
}

export const storage = {
  get<T>(rawKey: string): T | null {
    try {
      const v = localStorage.getItem(key(rawKey));
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(rawKey: string, value: unknown): void {
    localStorage.setItem(key(rawKey), JSON.stringify(value));
  },
  remove(rawKey: string): void {
    localStorage.removeItem(key(rawKey));
  },
};
```

**Aster 的 localStorage key 命名约定：**

| Key（不含 partitionKey 前缀） | 类型 | 内容 |
|---|---|---|
| `aster:providers` | `ProviderConfig[]` | Provider 列表（baseURL / model，无 apiKey） |
| `aster:keys:{providerId}` | `string` | 各 Provider 的 API Key（分开存，不与 config 混） |
| `aster:onboarding:seen` | `boolean` | Onboarding 是否已看过（D-04） |
| `aster:selection:autoAttach` | `boolean` | 选区自动附带开关（D-15） |
| `aster:providers:default` | `string` | 当前默认 Provider ID |

**partitionKey 行为总结（Phase 0 spike #3 已验证 + 官方文档确认）：**
- Office for Web (Chrome/Edge ≥115)：partitionKey = hash(top-level domain + addin domain)，例如 `excel.cloud.microsoft` + `wynne-cwb.github.io/Aster` 各产生不同分区。
- 三宿主（PPT / Excel / Word）产生不同 top-level domain，因此 **Key 不在宿主间共享**（这是正确行为——避免 Word 里填的 Key 泄漏到 Excel 的 localStorage）。
- Office on Windows (WebView)：partitionKey = `undefined`，无分区，直接用 rawKey。[VERIFIED: Microsoft Learn 官方文档]

---

## DeepSeek API Wire Format

**完整请求体（chat / short-task 路径）：**

```typescript
// Source: api-docs.deepseek.com [VERIFIED]
const body = {
  model: 'deepseek-v4-flash',  // 或 'deepseek-v4-pro'
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ],
  stream: true,
  stream_options: { include_usage: true },  // 必须显式打开才能在流结束前拿到 usage
};

// 响应 chunk 形状（content delta）：
{
  "id": "...",
  "choices": [{ "index": 0, "delta": { "content": "hello" }, "finish_reason": null }],
  "usage": null
}

// usage chunk（最后一个，choices 为空）：
{
  "id": "...",
  "choices": [],
  "usage": { "prompt_tokens": 17, "completion_tokens": 9, "total_tokens": 26 }
}
```

**模型 ID（2026-05 现行，PROV-10）：**
- 使用：`deepseek-v4-pro`、`deepseek-v4-flash`
- 禁用：`deepseek-chat`、`deepseek-reasoner`（2026-07-24 退役）[VERIFIED: DeepSeek changelog]

---

## aihubmix API Shapes

**Base URL：** `https://api.aihubmix.com/v1` [VERIFIED: docs.aihubmix.com]

### 视觉路径（vision — MEDIUM confidence）

```typescript
// POST /chat/completions
// model 选用支持视觉的模型（gpt-4o 等），OpenAI-compatible
const body = {
  model: 'gpt-4o',  // 或 gpt-4o-mini，视觉能力已验证
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: userQuestion },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } },
    ],
  }],
  stream: false,  // Phase 2 视觉路径可以不流式
};
```

### 生图路径（image-gen — MEDIUM confidence for gpt-image-1, LOW for gpt-image-2）

```typescript
// POST /images/generations
// gpt-image-1 文档明确支持 [CITED: docs.aihubmix.com/en/api/GPT-Image-1]
const body = {
  model: 'gpt-image-1',
  prompt: 'A professional slide background...',
  n: 1,
  size: '1024x1024',  // 或 1536x1024 / 1024x1536 / auto
  quality: 'medium',  // high / medium / low / auto
};
// 响应：{ data: [{ b64_json: '...' }], usage: { input_tokens, output_tokens, total_tokens } }
```

**注意：** aihubmix 生图的 usage 字段用 `input_tokens`/`output_tokens`（不是 `prompt_tokens`/`completion_tokens`），与 LLM 路径不同，成本徽章计算时要区分。[CITED: docs.aihubmix.com/en/api/GPT-Image-1]

---

## ProviderRegistry 路由表设计

**路由表内部数据结构（Claude's Discretion 解析）：**

```typescript
// src/providers/registry.ts

export type TaskKind = 'chat' | 'short-task' | 'vision' | 'image-gen' | 'stock-image';

export interface LLMConfig {
  providerId: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface ImageConfig {
  providerId: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

// 路由规则：每个 taskKind 绑定一个 resolverFn，返回对应配置
// 无自动 fallback——resolve 失败直接抛 ModelError（D-04 / PROV-04）
const TASK_KIND_RESOLVERS: Record<TaskKind, () => LLMConfig | ImageConfig> = {
  'chat': () => resolveDefaultLLM(),
  'short-task': () => resolveDefaultLLM(),
  'vision': () => resolveAihubmixVision(),
  'image-gen': () => resolveAihubmixImageGen(),
  'stock-image': () => { throw new ModelError('stock-image Provider 未配置'); },
};

export class ProviderRegistry {
  static resolve(taskKind: TaskKind): LLMConfig | ImageConfig {
    const resolver = TASK_KIND_RESOLVERS[taskKind];
    if (!resolver) throw new ModelError(`未知 taskKind: ${taskKind}`);
    return resolver();
  }
}
```

**设计原则：**
- 无自动 fallback（PROV-04 明确要求）——resolve 失败立即抛 `ModelError`，由 UI 层展示 MODEL_MISSING 错误。
- `chat` 和 `short-task` 都路由到用户当前默认 LLM Provider。
- `vision` 和 `image-gen` 固定路由到 aihubmix（Phase 0 spike #4 锁定，PROV-03）。

---

## 单飞队列实现（PROV-07）

```typescript
// src/providers/queue.ts
// 同一 Provider 单飞：相同 providerId 的请求队列化，不并发

const inFlight = new Map<string, Promise<void>>();

export async function singleFlight<T>(
  providerId: string,
  fn: () => Promise<T>,
): Promise<T> {
  // 等待同 Provider 的上一个请求完成
  const prev = inFlight.get(providerId);
  if (prev) await prev.catch(() => {});

  let resolve!: () => void;
  const ticket = new Promise<void>((r) => { resolve = r; });
  inFlight.set(providerId, ticket);

  try {
    return await fn();
  } finally {
    resolve();
    // 如果当前 ticket 仍是 Map 里的那个，移除（防泄漏）
    if (inFlight.get(providerId) === ticket) {
      inFlight.delete(providerId);
    }
  }
}
```

**注意：** 这是「排队」而非「去重」——不是让多个调用方共享同一个 Promise，而是让第二个调用等第一个完成后再发新请求（防止 Provider 过载）。Map 在模块级维护（不在 React 组件里），生命周期正确。

---

## AbortController + visibilitychange 模式

**当前选择：** 使用标准 Web API `document.visibilitychange` 事件（已在 Office for Web 测试可用），而非 Office-specific `VisibilityModeChanged`。[VERIFIED: MDN + Office Learn]

```typescript
// ChatStore 内（Zustand）
function setupVisibilityAbort(controller: AbortController) {
  function onHide() {
    if (document.visibilityState === 'hidden') {
      controller.abort();
    }
  }
  document.addEventListener('visibilitychange', onHide);
  // cleanup：请求完成后移除监听（否则泄漏）
  return () => document.removeEventListener('visibilitychange', onHide);
}

// 使用示例：
async function sendMessage(prompt: string) {
  const controller = new AbortController();
  const cleanup = setupVisibilityAbort(controller);
  try {
    for await (const event of streamSSE(url, body, controller.signal)) {
      // 更新 store...
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      // 用户停止或 Task Pane 隐藏 — 不报错，保留已生成内容
    } else {
      throw e;
    }
  } finally {
    cleanup();
  }
}
```

---

## 错误类 HTTP 状态映射

### Phase 2 需要补齐的 4 类错误（Phase 1 已有 KEY_INVALID / QUOTA / CONTEXT / NETWORK）

```typescript
// 追加到 src/errors/index.ts

export class RateLimitError extends AsterError {
  constructor(
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message, 'RATE_LIMIT', 'provider');
  }
}

export class ContentFilterError extends AsterError {
  constructor(message: string) {
    super(message, 'FILTER', 'provider');
  }
}

export class ModelNotFoundError extends AsterError {
  constructor(message: string) {
    super(message, 'MODEL', 'provider');
  }
}

export class ImageQuotaError extends AsterError {
  constructor(message: string) {
    super(message, 'IMAGE_QUOTA', 'provider');
  }
}
```

### HTTP 状态 → 错误类映射表（`src/lib/sse.ts` 的 `mapHttpError` 函数）

| HTTP 状态 | error.type / 场景 | 抛出错误类 | 是否重试 | CTA（D-13） |
|---|---|---|---|---|
| 401 | `authentication_error` | `KeyInvalidError` | 否（billing） | 「Key 无效，前往设置 →」（深链 Key 字段） |
| 402 | `insufficient_balance` / Insufficient Balance | `QuotaExceededError` | 否（billing） | 「账户余额不足，前往充值 →」 |
| 422 | 上下文过长 / invalid parameters | `ContextTooLongError` | 否 | 「内容过长，请减少选区或切换更大模型」 |
| 429 | Rate Limit Reached | `RateLimitError` | 是（指数退避） | 「请求过快，正在自动重试…」（重试中隐藏 CTA，失败后显） |
| 503 | Server Overloaded | `NetworkError` | 是（指数退避） | 「服务繁忙，正在重试…」 |
| 网络失败（fetch reject） | 超时 / DNS 失败 | `NetworkError` | 是（最多 3 次） | 「网络连接失败，请检查网络后重试」 |
| content filter | error body 含 filter/content_policy | `ContentFilterError` | 否 | 「内容被过滤，请修改输入内容」 |
| 404 | model not found | `ModelNotFoundError` | 否 | 「模型不存在，请在设置中检查模型名称 →」 |
| aihubmix 生图配额 | IMAGE_QUOTA（aihubmix 特有） | `ImageQuotaError` | 否（billing） | 「图像生成配额用尽，前往 aihubmix 充值 →」 |

[VERIFIED: api-docs.deepseek.com/quick_start/error_codes — 401/402/422/429/500/503 均有官方定义]

---

## 指数退避实现（PROV-09）

**规则（Claude's Discretion 解析）：**
- 只对 429（Rate Limit）和 503（Server Overloaded）重试。
- billing 类错误（401 / 402 / IMAGE_QUOTA）绝对不重试。
- `Retry-After` 响应头优先（可以是秒数或 HTTP date）。
- 无 `Retry-After` 时：初始间隔 1s，翻倍，最大 30s，加 ±10% jitter，最多 3 次。

```typescript
// src/providers/retry.ts
const RETRYABLE = new Set([429, 503]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

export async function withRetry<T>(
  fn: () => Promise<T>,
  getRetryAfter?: (resp: Response) => number | null,
): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof RateLimitError) && !(e instanceof NetworkError)) throw e;
      if (attempt === MAX_RETRIES) throw e;

      const retryAfterSec = e instanceof RateLimitError ? e.retryAfterSeconds : undefined;
      const delay = retryAfterSec != null
        ? retryAfterSec * 1000
        : Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS) * (0.9 + Math.random() * 0.2);

      await new Promise<void>((r) => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}
```

---

## 成本徽章计算

### USD→CNY 固定汇率（Claude's Discretion 解析）

汇率常数：**`CNY_PER_USD = 7.25`**（2026-05 合理均值，偏保守）。

徽章显示带「约」字前缀，明确标注非实时：**`约 ¥X.XX`**。

[ASSUMED: 汇率常数 7.25 基于训练知识，非实时查询。若用户觉得有出入可手动调整常数]

### 各 Provider 单价表（写死，D-09）

```typescript
// src/providers/pricing.ts
// 单价单位：USD per 1M tokens
const PROVIDER_PRICING: Record<string, { input: number; output: number } | null> = {
  'deepseek-v4-flash': { input: 0.14, output: 0.28 },
  'deepseek-v4-pro': { input: 1.74, output: 3.48 },   // 注：75% off 优惠期至 2026-05-31
  // aihubmix 按图像 token 计费，单独处理（见下）
};

const CNY_PER_USD = 7.25;

export function calcCostCny(
  usage: { promptTokens: number; completionTokens: number },
  providerId: string,
): number | null {
  const pricing = PROVIDER_PRICING[providerId];
  if (!pricing) return null; // 自定义 Provider → 只显 token 数
  const usd =
    (usage.promptTokens / 1_000_000) * pricing.input +
    (usage.completionTokens / 1_000_000) * pricing.output;
  return usd * CNY_PER_USD;
}
```

**aihubmix 生图成本（aihubmix 响应体用 `input_tokens`/`output_tokens`）：**

gpt-image-1 在 aihubmix 的实际单价 ASSUMED（文档无明确中文显示价格）——Phase 2 可以只显示「N token」，等 Phase 4 图像功能正式使用时再补充。[ASSUMED]

---

## DocumentAdapter.insert() 最小 text 实现（D-16）

三宿主各自最小 `{type:'text'}` 写回方式（Phase 2 只实现 text，其余类型在 Phase 4-6）：

### PptAdapter（PPT 文本插入）

```typescript
// 最简路径：在当前 slide 的第一个文本框追加文本
// 注意：不与 setSelectedDataAsync 混用（spike #5022 规避规则）
async insert(content: InsertableContent): Promise<void> {
  if (content.type !== 'text') throw new UnsupportedOperationError('PPT Phase 2 仅支持 text 写回');
  await PowerPoint.run(async (ctx) => {
    const slide = ctx.presentation.getSelectedSlides().getItemAt(0);
    const shapes = slide.shapes;
    shapes.load('items');
    await ctx.sync();
    if (shapes.items.length > 0) {
      const tf = shapes.items[0].textFrame;
      tf.text = content.value; // 覆盖写入
    }
    await ctx.sync();
  });
}
```

### ExcelAdapter（Excel 写入当前选中单元格）

```typescript
async insert(content: InsertableContent): Promise<void> {
  if (content.type !== 'text') throw new UnsupportedOperationError('Excel Phase 2 仅支持 text 写回');
  await Excel.run(async (ctx) => {
    const range = ctx.workbook.getSelectedRange();
    range.load('address');
    await ctx.sync();           // sync 1: load address
    range.values = [[content.value]];
    await ctx.sync();           // sync 2: write
  });
}
```

### WordAdapter（Word 替换选区或在光标处插入）

```typescript
async insert(content: InsertableContent): Promise<void> {
  if (content.type !== 'text') throw new UnsupportedOperationError('Word Phase 2 仅支持 text 写回');
  await Word.run(async (ctx) => {
    const sel = ctx.document.getSelection();
    sel.insertText(content.value, Word.InsertLocation.replace);
    await ctx.sync();
  });
}
```

---

## ESLint 规则（PROV-10）

添加到 `eslint.config.js` 或 `.eslintrc`：

```javascript
// 禁用 legacy 模型名（2026-07-24 退役的 deepseek-chat / deepseek-reasoner）
// 禁用 LLM SDK 包导入
{
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Literal[value=/deepseek-chat|deepseek-reasoner/]',
        message: 'legacy 模型名已废弃，请使用 deepseek-v4-flash 或 deepseek-v4-pro',
      },
    ],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          { group: ['openai', 'openai/*'], message: '禁止引入 openai SDK，使用原生 fetch' },
          { group: ['@anthropic-ai/*'], message: '禁止引入 Anthropic SDK，使用原生 fetch' },
          { group: ['ai', 'ai/*', '@ai-sdk/*'], message: '禁止引入 Vercel AI SDK，使用原生 fetch' },
        ],
      },
    ],
  },
}
```

---

## Zustand Store 设计

### chatStore（`src/store/chat.ts`）

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  // 流式状态
  isStreaming?: boolean;
  // 成本信息
  tokenCount?: number;
  costCny?: number | null; // null = 自定义 Provider，不显示价格
  // 错误信息
  errorCode?: string;
  retryPrompt?: string; // D-11：重试时原地重发的 prompt
}

interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  abortController: AbortController | null;
  // actions
  sendMessage: (prompt: string, selectionCtx?: SelectionContext) => Promise<void>;
  stopStreaming: () => void;
  retryMessage: (messageId: string) => Promise<void>;
  clearHistory: () => void;
}
```

### providerStore（`src/store/providers.ts`）

```typescript
interface ProviderConfig {
  id: string;
  name: string;
  baseURL: string;
  model: string;
  isBuiltIn: boolean; // 内置 Provider（DeepSeek / aihubmix）不可删除
}

interface ProviderState {
  providers: ProviderConfig[];
  defaultLLMProviderId: string;
  // actions
  addProvider: (config: Omit<ProviderConfig, 'id'>) => void;
  updateProvider: (id: string, patch: Partial<ProviderConfig>) => void;
  removeProvider: (id: string) => void;
  setDefaultLLM: (id: string) => void;
  // Key 操作（读写 storage.ts）
  setKey: (providerId: string, apiKey: string) => void;
  getKey: (providerId: string) => string | null;
}
```

**持久化：** providerStore 在每次写操作后同步写 `storage.set('aster:providers', ...)`；读时在 `onReady` 后的初始化 effect 里从 storage 恢复。chatStore 不持久化（PANE-03）。

---

## Onboarding 流程

**触发条件：** `storage.get('aster:onboarding:seen')` 为 null 时（D-04）。

**Step 1：填 Key + 隐私告知**
- 顶部：Provider 选择（默认 DeepSeek，D-02）
- 中部：DeepSeek Key 输入框（必填，用于 form validation，但不阻断整个 Onboarding 完成——D-01）
- 中部：aihubmix Key 输入框（选填）
- 底部内联文案（D-05）：「你选中的文档内容会发送到所配置的 Provider，不经过 Aster 服务器」

**Step 2：功能介绍**
- 只显示当前宿主对应的功能卡（D-03），用 `useAdapter().capabilities().host` 判断

**跳过路径（D-01）：**
- 关闭 Onboarding / 点「跳过」→ `storage.set('aster:onboarding:seen', true)` → 顶部显示「去设置填 Key」提示条
- 提示条点击 → 打开 Settings 并定位到 Key 输入区

---

## 设置页 UI 架构（D-06）

**实现方式：** CSS `transform: translateX(100%)` → `translateX(0)` 的整页滑入，不用 React Router 或 Portal，直接在 `App.tsx` 里条件渲染并用 CSS 变量过渡（与现有 `--ease` / `--dur` 一致）。

```tsx
// App.tsx
const [showSettings, setShowSettings] = useState(false);

return (
  <div className="aster-shell">
    {/* 主界面 */}
    <div className="aster-topbar">
      <ContextCard />
      <button onClick={() => setShowSettings(true)} aria-label="设置">
        <SettingsIcon />
      </button>
    </div>
    <div className="aster-chat"><ChatStream /></div>
    <InputBar />

    {/* 设置面板（整页覆盖，右侧滑入） */}
    <div className={`aster-settings-overlay ${showSettings ? 'is-open' : ''}`}>
      <SettingsPanel onClose={() => setShowSettings(false)} />
    </div>
  </div>
);
```

CSS 样式新增（延续现有系统）：
```css
.aster-settings-overlay {
  position: absolute;
  inset: 0;
  background: var(--bg);
  transform: translateX(100%);
  transition: transform var(--dur) var(--ease);
  z-index: 10;
}
.aster-settings-overlay.is-open {
  transform: translateX(0);
}
```

---

## UI 新增图标（延续 icons.tsx）

Phase 2 需要在 `src/components/icons.tsx` 追加的图标（Lucide 风，stroke=currentColor）：

| 图标 | 用途 |
|---|---|
| `StopIcon`（实心方块） | 发送键变停止（D-14）|
| `InsertIcon`（向文档插入） | 「插入到文档」按钮 |
| `RetryIcon`（循环箭头） | 错误气泡重试（D-11）|
| `XIcon`（×） | 选区胶囊关闭（D-15）|
| `AlertIcon`（三角感叹号） | 错误气泡警示色前缀 |
| `PlusIcon`（+） | Settings 新增 Provider |
| `TrashIcon`（垃圾桶） | Settings 删除 Provider |
| `CheckIcon`（对勾） | Onboarding 步骤完成 |

**禁止：** 不引入外部图标库、不用 emoji、不用 iconfont CDN。

---

## Common Pitfalls

### Pitfall 1：stream_options 未打开导致 usage 永远为 null
**What goes wrong：** 用 `stream: true` 发 DeepSeek 请求但没有 `stream_options: { include_usage: true }`，整个流过程中每个 chunk 的 `usage` 字段都是 `null`，cost badge 永远显示 0 token。
**Why it happens：** DeepSeek 把 usage 报告设为 opt-in，避免低延迟路径必须等 usage 计算。
**How to avoid：** `streamSSE` 函数内部固定注入 `stream_options: { include_usage: true }`，不由调用方传入，消除遗漏可能。
**Warning signs：** CostBadge 显示「0 token」。

### Pitfall 2：partitionKey 未前缀导致跨宿主 Key 泄漏
**What goes wrong：** 直接用 `localStorage.setItem('aster:keys:deepseek', apiKey)` 而不加 partitionKey 前缀，在 Office for Web Chrome ≥115 环境下三个宿主（PPT/Excel/Word）有不同的顶级域名分区，导致在 PPT 里设置的 Key 在 Excel 里读不到（或反之）。
**Why it happens：** Chrome ≥115 Storage Partitioning 根据 top-level domain 隔离 localStorage。
**How to avoid：** 所有 localStorage 操作都走 `src/lib/storage.ts` 的 `storage.get/set`，从不直接调用 `localStorage`。
**Warning signs：** 在一个宿主里设置 Key，在另一个宿主里显示 Key 未设置。

### Pitfall 3：visibilitychange 监听器未清理导致内存泄漏
**What goes wrong：** 每次 sendMessage 都 `addEventListener('visibilitychange', ...)` 但请求完成后没有 `removeEventListener`，多次请求后积累大量废弃监听器。
**Why it happens：** Task Pane 长时间运行，DOM 不卸载，事件监听器不自动清理。
**How to avoid：** `setupVisibilityAbort` 返回 cleanup 函数，在 `finally` block 里调用。
**Warning signs：** DevTools 内存快照里 `visibilitychange` listener 数量随对话次数增长。

### Pitfall 4：SSE 的 `: keep-alive` 行导致 JSON.parse 报错
**What goes wrong：** DeepSeek 在流式等待时发送 `: keep-alive` 注释行，格式是以 `:` 开头而非 `data:`，如果不跳过会尝试 JSON.parse 空字符串或冒号开头的字符串导致 try/catch 吞噬错误、流中断。
**Why it happens：** SSE 规范允许以 `:` 开头的注释行，DeepSeek 用它保持 TCP 连接活跃。
**How to avoid：** SSE 解析器显式跳过不以 `data:` 开头的行，或在过滤后检查 `data` 是否为空 / 以 `:` 开头。
**Warning signs：** 长 prompt 请求（>3s 出首 token）时流式渲染突然中断。

### Pitfall 5：ExcelAdapter.insert() 超过两次 sync
**What goes wrong：** 写入 Excel 时用了超过 2 次 `context.sync()`，在大数据量情况下性能急剧下降（这是 Phase 2 text 写入，Phase 5 才是主要风险，但习惯要从 Phase 2 建立）。
**How to avoid：** 保持 load → sync → write → sync 的两次 sync 模式。

### Pitfall 6：Onboarding Modal 在 Office for Web 的 z-index
**What goes wrong：** Onboarding modal 被 Office chrome 遮挡，或 z-index 设置不当导致覆盖 Office 原生 UI。
**Why it happens：** Task Pane 是 iframe，z-index 只在 iframe 内有效，不能超出 Task Pane 边界覆盖 Office chrome。
**How to avoid：** Onboarding 用覆盖整个 Task Pane 的绝对定位（`position: absolute; inset: 0; z-index: 50`），不尝试超出 Task Pane 范围。

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | aihubmix gpt-image-2 可通过 `/images/generations` 使用（文档只明确 gpt-image-1） | aihubmix API Shapes | 生图路径 Phase 4 需 spike 验证，Phase 2 先用 gpt-image-1 |
| A2 | aihubmix 生图的 CNY 单价计算（`input_tokens` @ OpenAI 价格 passthrough） | 成本徽章计算 | Phase 2 aihubmix 成本徽章可暂时只显 token 数，Phase 4 补充 |
| A3 | USD→CNY 固定汇率 7.25 合理 | 成本徽章计算 | 汇率波动最大约 ±5%，对用户影响极小 |
| A4 | aihubmix 视觉路径用 gpt-4o 时支持 base64 图像 URL | aihubmix API Shapes | Phase 3 文件上传时需验证；Phase 2 不直接触及 |
| A5 | DeepSeek content filter 错误体可通过 error body 中的关键词识别（无官方文档明确错误类型） | 错误类 HTTP 状态映射 | 可能误分类为 400 InvalidFormat；实测后调整 mapHttpError |

---

## Open Questions

1. **aihubmix gpt-image-1 的人民币单价**
   - What we know：OpenAI 官方 gpt-image-1 价格（token-based），aihubmix 是 passthrough
   - What's unclear：aihubmix 的实际加成比例
   - Recommendation：Phase 2 的成本徽章对 aihubmix 生图只显「N token」，Phase 4 再通过实际调用测算单价

2. **DeepSeek content filter 错误的 HTTP 状态**
   - What we know：官方文档列出 400/401/402/422/429/500/503，无内容过滤的专用状态码
   - What's unclear：内容被过滤时返回 400 还是 422，error.type 是什么
   - Recommendation：`mapHttpError` 里在 400/422 中检查 error.message 关键词（"content_policy" / "filter"），兜底归 `ContentFilterError`

3. **visibilitychange 在 Office 共享运行时中是否可靠**
   - What we know：Phase 0 spike 已验证 CORS 可用；visibilitychange 是 Web 标准，MDN 确认可用
   - What's unclear：共享运行时（shared runtime）配置下，Task Pane 隐藏是否触发 visibilitychange
   - Recommendation：实现时同时监听 `document.visibilitychange` 和（如果可用）Office `VisibilityModeChanged`，用 try/catch 降级

---

## Environment Availability

Phase 2 是纯代码变更，无新增外部工具依赖。

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| DeepSeek API (`api.deepseek.com`) | PROV-02 / PROV-06 | ✓（Phase 0 GATING #1 验证） | — | 无 fallback（核心功能） |
| aihubmix API (`api.aihubmix.com`) | PROV-03 | ✓（Phase 0 GATING #1 验证） | — | 无 fallback（Phase 0 锁定唯一多模态路径） |
| Office.context.partitionKey | KEY-01 | ✓（Phase 0 GATING #3 验证） | — | 无 pk 时 fallback 到 plain key（Windows WebView） |
| Vitest | 测试 | ✓（已安装） | `^2.0.0` | — |
| native fetch / ReadableStream | PROV-06 | ✓（现代 Chrome/Edge 内置） | — | — |

---

## Validation Architecture

nyquist_validation enabled（config.json `workflow.nyquist_validation: true`）。

### 测试框架

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x |
| Config file | `vitest.config.ts`（已存在） |
| Quick run | `npx vitest run --reporter=verbose` |
| Full suite | `npx vitest run` |

### Phase 2 Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Wave 0 创建？ |
|--------|----------|-----------|-------------------|-------------|
| PROV-06 / NFR-03 | streamSSE 解析 delta + usage chunk，AbortError 干净处理 | unit | `vitest run src/lib/sse.test.ts` | ❌ 需创建 |
| PROV-07 | singleFlight 队列化同 Provider 请求，abort 停止迭代 | unit | `vitest run src/providers/queue.test.ts` | ❌ 需创建 |
| PROV-08 | mapHttpError 401→KeyInvalidError / 429→RateLimitError 等 | unit | `vitest run src/lib/sse.test.ts` | ❌ 需创建 |
| PROV-09 | withRetry 遵守 Retry-After，billing 错误不重试 | unit | `vitest run src/providers/retry.test.ts` | ❌ 需创建 |
| KEY-01 | storage.get/set 在 partitionKey defined/undefined 两种环境下正确前缀 | unit | `vitest run src/lib/storage.test.ts` | ❌ 需创建 |
| COST-01/02 | calcCostCny 内置 Provider 返回 ¥，自定义 Provider 返回 null | unit | `vitest run src/providers/pricing.test.ts` | ❌ 需创建 |
| PROV-04 | ProviderRegistry.resolve 已知 taskKind 返回正确 config，未知 taskKind 抛 ModelNotFoundError | unit | `vitest run src/providers/registry.test.ts` | ❌ 需创建 |
| PANE-02 / SC2 | 流式渲染首 token ≤ 2s | smoke（UAT） | office-addin-browser-uat 手动验收 | — |
| SC2 | abort 后 token 不再累计（visibilitychange 触发） | smoke（UAT） | 手动隐藏 Task Pane，验证成本徽章冻结 | — |
| D-16 | PptAdapter / ExcelAdapter / WordAdapter insert({type:'text'}) 真实写回 | smoke（UAT） | office-addin-browser-uat 三宿主各插入一次 | — |
| KEY-05 | Key 跨文档切换不丢（同浏览器同账号） | smoke（UAT） | 手动：文档 A 填 Key → 开文档 B → Key 仍在 | — |

**手动 UAT（使用 office-addin-browser-uat skill）：**
- SC2 首 token 计时需在 Office for Web 真实环境测量（DevTools Network Timing）
- 错误 CTA 深链跳转到 Settings 指定字段（D-12）需人工触发 401 场景（用错误 Key）

### Sampling Rate
- **每个 task commit：** `npx vitest run` （全部单元测试，< 30s）
- **每个 wave merge：** `npx vitest run` + UAT smoke checklist
- **Phase gate：** 全套单元测试绿 + SC1-SC6 手动 UAT 通过 → 才能调用 `/gsd-verify-work`

### Wave 0 测试缺口（需在 Wave 0 创建）

- [ ] `src/lib/sse.test.ts` — 覆盖 PROV-06 / PROV-08（mock fetch + ReadableStream）
- [ ] `src/lib/storage.test.ts` — 覆盖 KEY-01（mock Office.context.partitionKey）
- [ ] `src/providers/queue.test.ts` — 覆盖 PROV-07 单飞队列
- [ ] `src/providers/retry.test.ts` — 覆盖 PROV-09 指数退避
- [ ] `src/providers/registry.test.ts` — 覆盖 PROV-04 路由
- [ ] `src/providers/pricing.test.ts` — 覆盖 COST-02 徽章计算

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes（API Key 存储） | partitioned localStorage + 明确告知跨浏览器会丢 |
| V3 Session Management | no（无 session，无后台） | — |
| V4 Access Control | no（单用户本地 add-in） | — |
| V5 Input Validation | yes（Key 格式、Provider URL） | 基本字段校验（非空、URL 格式） |
| V6 Cryptography | no（Key 明文存 localStorage，用户知情） | 明确告知；不加密 |

### Phase 2 关键安全约束（继承 Phase 1 T-01-xx）

| 威胁 | STRIDE | 控制 |
|------|--------|------|
| API Key 泄漏到 Aster 服务器 | Information Disclosure | 无后台架构；fetch 直连 Provider；KEY-04 |
| API Key 嵌入 error.message | Information Disclosure | 继承 Phase 1 T-01-04：`AsterError.message` 禁止包含 Key 原文 |
| 跨 Provider Key 混用 | Elevation of Privilege | `storage.ts` 按 `aster:keys:{providerId}` 分 key 存储，不共享 |
| XSS via AI 输出 | Tampering | 用 `react-markdown`（不用 `dangerouslySetInnerHTML`）；markdown 渲染自动转义 |
| 恶意 baseURL（SSRF 变种） | Tampering | 基本 URL 格式校验（must start with https://）；用户自填，风险用户知情 |

---

## Sources

### Primary（HIGH confidence）
- [DeepSeek API Chat Completion Docs](https://api-docs.deepseek.com/api/create-chat-completion) — SSE 格式 / stream_options / usage chunk 位置
- [DeepSeek API Error Codes](https://api-docs.deepseek.com/quick_start/error_codes) — 401/402/422/429/500/503 定义
- [DeepSeek Rate Limit Docs](https://api-docs.deepseek.com/quick_start/rate_limit) — 429 触发条件
- [Microsoft Learn — Persist add-in state and settings](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/persisting-add-in-state-and-settings) — partitionKey 官方代码示例 + 行为说明
- [aihubmix gpt-image-1 API Docs](https://docs.aihubmix.com/en/api/GPT-Image-1) — 生图请求/响应格式 + usage 字段
- [MDN visibilitychange](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event) — visibilitychange 标准行为
- Phase 0 GATING reports — CORS / partitionKey / aihubmix 实测结果

### Secondary（MEDIUM confidence）
- [DeepSeek SSE Guide 2026](https://deepseekai.guide/api/deepseek-api-streaming/) — keep-alive 行为 / stream_options 使用示例
- [aihubmix docs hub](https://docs.aihubmix.com/en) — base URL / vision 路径模式
- [npm registry] — 实测已安装版本（zustand 5.0.13 / react 19.2.6 / lingui 6.1.0）

### Tertiary（LOW confidence / ASSUMED）
- aihubmix gpt-image-2 在 `/images/generations` 上的可用性（未找到专用文档页）
- aihubmix 视觉路径 gpt-4o base64 图像 URL 支持（推断自 OpenAI-compatible 描述）
- USD→CNY 7.25 汇率常数（基于训练知识，非实时）

---

## Metadata

**Confidence breakdown:**
- SSE wire format + usage reporting: HIGH — DeepSeek 官方文档明确
- Storage / partitionKey: HIGH — Microsoft 官方文档 + Phase 0 spike #3 实证
- Error class mapping: HIGH — 官方错误码表；content filter 路径 ASSUMED
- aihubmix image-gen: MEDIUM — gpt-image-1 文档明确，gpt-image-2 未找到专用页
- 成本徽章汇率: LOW — ASSUMED 常数
- Provider 路由 / 单飞队列 / 指数退避实现: MEDIUM — 业界标准模式，非特定 API 约束

**Research date:** 2026-05-27
**Valid until:** 2026-06-27（DeepSeek 定价变动快，V4-Pro 75% off 优惠期 2026-05-31 到期后单价变化）
