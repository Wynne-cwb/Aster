# Technology Stack — Aster v2.0 Office 智能代理（增量）

**Project:** Aster — v2.0 milestone "Office 智能代理"
**Researched:** 2026-05-28
**Scope:** **增量** — v1 已锁定栈不重研，仅就 v2 agent loop 新增的 6 个问题给版本 + 落点 + 反例
**Overall confidence:** HIGH（agent loop pattern 是行业 ReAct 共识 + 两家 Provider 均确认 OpenAI tools schema）

---

## 0. 阅读顺序

本文是 **v1 STACK 的差分（patch）**，不是替换。

- **v1 已锁定不变**：React 19 / TS 5.7 / Vite 7 / Zustand 5 / 自写 CSS + 内联 SVG / Office.js CDN / 三宿主 Adapter / partitioned localStorage / native fetch+SSE / DeepSeek + aihubmix OpenAI-compatible / mammoth+xlsx+pdfjs 懒加载。
  完整 v1 决策见 `.planning/research/v1.0/STACK.md`。
- **本文新增**：v2 agent loop 所需的 6 项决策（agent framework、tool 调用线协议、状态机、diff/undo、token 计数、bundle 预算复核）。
- **本文不再讨论的内容**：所有 v1 Phase 0 spike 验证完的栈条目（CORS、Office.js host API、parsers）一律按 v1 实测结果继续用，不复活旧讨论。

---

## TL;DR — v2.0 增量栈

| Concern | 决策 | 版本 | 体积 | 信心 |
|---|---|---|---|---|
| **Agent loop** | 自写 50 行循环（继承 v1 SSE adapter，不引框架） | n/a | 0 KB | HIGH |
| **Tool 调用线协议** | OpenAI **`tools` + `tool_calls`** schema（DeepSeek + aihubmix 原生支持） | OpenAI 2024-12 后版本 | 0 KB | HIGH |
| **状态机** | 沿用 **Zustand**，agent loop 用纯 TS 函数 + AbortController | `zustand@^5.x`（已装） | 0 KB | HIGH |
| **Diff log / Undo all** | **自写 inline `OperationLog` + 反向操作**（Office.js 无 transaction API） | n/a | 0 KB | HIGH |
| **Token 计数** | **不引 tokenizer**；用 SSE `stream_options.include_usage` 取 Provider 真实计数 | n/a | 0 KB | HIGH |
| **Markdown 渲染**（已装）| `react-markdown@^9` + `remark-gfm@^4`（v1 已规划，v2 chat UI 正式接入） | 已装 | ~3 KB（已计入） | HIGH |
| **JSON schema runtime 校验**（可选，仅 dev） | **不在 prod 加 ajv/zod**；prod 只看 Provider 报错 | n/a | 0 KB | MEDIUM |

**净新增运行时依赖：0 个。** 全部能力靠现有栈 + 自写代码实现。Bundle 预算（≤ 1 MB initial）无变化，当前实测 ~63–68 KB gzipped 保持不变。

---

## 1. Agent Framework — 自写循环，不引框架

### 决策

**自写一个 ~50 行的 agent loop runner**，挂在 v1 的 `chatStore` / `Provider`（OpenAI-compatible fetch+SSE）之上。**不**引入 LangChain.js、LangGraph.js、Vercel AI SDK Agent class、instructor-js。

### 理由（按硬约束逐条对账）

| 约束 | 自写 | LangChain.js | Vercel AI SDK v5 | OpenAI SDK |
|---|---|---|---|---|
| **No backend（必须）** | OK | OK（granular import 可纯浏览器跑） | **冲突** — `useChat`/Agent class 设计绕 server route；浏览器侧 BYO Key 路径不是一等公民（issue #3041） | OK（`dangerouslyAllowBrowser:true`） |
| **JS ≤ 1 MB initial** | +0 KB | +~101 KB gzipped 全量，granular 后~37 KB | +~67 KB gzipped | +~34 KB gzipped |
| **BYO Key 浏览器直连** | OK | OK | 二等 | OK |
| **OpenAI-compatible wire fmt（已锁）** | 直用 | 抽象一层后仍直发 | 抽象后强约定 ModelMessage/UIMessage 分离 v5 | 直用 |
| **替换 Provider 成本** | 改一个字符串 | 改 Provider class | 改 model 字符串（AI Gateway 路径）但浏览器路径不稳 | 改一个字符串 |

**核心论证**：

1. **agent loop 本身是 ~50 行代码**——while + fetch + 拼 messages + 派发 tool。Oracle / SitePoint 2026 综述都明确：ReAct/four-phase 是行业唯一收敛形态，"define tools → LLM 选并填参 → 执行 → 把结果回灌"。框架卖的是**抽象 + 中间件**（HITL、retries、fallbacks、memory），Aster v2 这些都要**自己定制**才能满足 Q9/Q10/Q11（pause/diff/undo/单 opt-out/自决恢复 + circuit breaker），框架抽象在这里是**负值**。
2. **框架的"省事"前提是有 server**。LangGraph.js / Vercel AI SDK Agent 的最佳路径是「浏览器 useChat ↔ server route ↔ Provider」；Aster 跳掉中间层，框架的 60% 价值（路由、流式协议、persistence）当场失效。
3. **v1 已经手写了 OpenAI SSE 解析 + Provider 抽象**——`adapters/` + `lib/sse.ts`（v1 Phase 2 交付）。再引一层框架就是把同一个 wire fmt 包两次。
4. **MCP 现阶段不进 v1.x**——MCP client 在浏览器侧需要 stdio/socket transport，与 Office webview + 无后台冲突。本地"tool"就是 Office.js Adapter 的薄包装，不需要 MCP 协议。如果未来要接外部 MCP server，那要么走代理（破约束），要么等浏览器原生 transport 成熟（v2.x 后议）。

### 落点（与现有代码集成）

新增三个文件，**不动**现有 `chatStore` 的对外形状（只加 action）：

```
src/agent/
├── loop.ts            # runAgent(): while-loop runner，纯 TS 函数
├── tools.ts           # registerTool() + ToolRegistry；adapter 注册成 tool 描述
└── operationLog.ts    # OperationLog + reverse() 反向操作记录器（见 §4）
```

`chatStore` 增量：

```ts
// 已有
interface ChatStore {
  messages: Message[];
  status: 'idle' | 'streaming';
  send(prompt: string): Promise<void>;
  abort(): void;
}

// v2 增量（追加，不破坏 v1 形状）
interface ChatStore {
  // ...上面保留
  agentStatus: 'idle' | 'thinking' | 'tool-running' | 'paused' | 'aborted';
  currentStep: number;          // 用于 max_steps=20 hard cap
  costAccum: { promptTok: number; completionTok: number; rmb: number };
  operationLog: OperationLogEntry[];   // 一回合内的可逆操作列表
  pause(): void;                 // Q9 用户随时点暂停
  undoAll(): Promise<void>;      // Q9 兜底回滚一回合
  setPrivacyOptOut(v: boolean): void;  // Q10 关闭全文发送单开关
}
```

### Agent loop 骨架（参考实现）

```ts
// src/agent/loop.ts — 约 50 行（伪代码骨架，HIGH confidence patterns）
const MAX_STEPS = 20;                          // Q9 硬上限，不可绕过
const COST_CAP_RMB = 10;                       // Q9 建议默认值，可在 Settings 调

export async function runAgent(opts: {
  provider: Provider;                          // v1 已抽象
  messages: Message[];
  tools: ToolDef[];                            // OpenAI tools schema
  signal: AbortSignal;                         // 暂停/中止
  onStep: (s: StepEvent) => void;              // UI 推进
}): Promise<AgentResult> {
  const toolFailCount = new Map<string, number>();  // Q11: 同 tool >2 次强制 abort

  for (let step = 0; step < MAX_STEPS; step++) {
    if (opts.signal.aborted) return { reason: 'user-abort', step };
    if (chatStore.costAccum.rmb >= COST_CAP_RMB) return { reason: 'cost-cap', step };

    // 1. 调 LLM（v1 已有的 streamChatCompletion，+ tools + stream_options.include_usage）
    const res = await opts.provider.chat({
      messages: opts.messages,
      tools: opts.tools,
      stream: true,
      stream_options: { include_usage: true },  // §5：靠 Provider 真实 usage 累加
      signal: opts.signal,
    });

    // 2. 累加成本（usage 在 SSE 最后一个 chunk）
    if (res.usage) chatStore.addCost(res.usage);

    // 3. 终止条件：模型不再 call tool
    if (!res.tool_calls?.length) {
      opts.messages.push({ role: 'assistant', content: res.content });
      return { reason: 'done', step };
    }

    // 4. 执行 tool_calls（DeepSeek/aihubmix 都支持并行）
    opts.messages.push({ role: 'assistant', tool_calls: res.tool_calls });
    for (const call of res.tool_calls) {
      try {
        const result = await invokeTool(call);           // Office.js Adapter
        opts.messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
        chatStore.operationLog.push({ call, reverse: result.reverse });  // §4
      } catch (e) {
        // Q11: 结构化 error push 回 LLM
        const fails = (toolFailCount.get(call.function.name) ?? 0) + 1;
        toolFailCount.set(call.function.name, fails);
        if (fails > 2) return { reason: 'tool-loop-break', step, tool: call.function.name };
        opts.messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ ok: false, code: e.code, recoverable: e.recoverable, hint: e.hint }),
        });
      }
    }
    opts.onStep({ step, tool_calls: res.tool_calls });
  }
  return { reason: 'max-steps', step: MAX_STEPS };
}
```

### Anti-patterns（v2 明确**不**做）

| 不做 | 原因 |
|---|---|
| 引 LangChain.js 跑 `create_agent` | 101 KB（全量）/ 37 KB（granular）净新增；浏览器侧 BYO Key 路径不是一等公民；抽象掉了我们要定制的 Q9/Q10/Q11 行为 |
| 引 Vercel AI SDK v5 `Agent` class | server-route 假设深植；`dangerouslyAllowBrowser` 不在主线（issue #3041 仍 open）；UIMessage/ModelMessage 分离反而增加心智 |
| 引 OpenAI SDK + `dangerouslyAllowBrowser:true` | +34 KB 抽象，v1 已写的 SSE adapter 把 fmt 包了一遍，再包一层纯亏 |
| 接 MCP 协议 | 浏览器无 stdio/socket transport；与无后台冲突；本地 Office.js Adapter 当 tool 用更轻 |
| 引 instructor-js 强约束 schema | DeepSeek 已原生 `strict: true`；浏览器侧再做一遍 ajv runtime 校验是重复工作 |

### Sources

- [Oracle Developers — What Is the AI Agent Loop?](https://blogs.oracle.com/developers/what-is-the-ai-agent-loop-the-core-architecture-behind-autonomous-ai-systems) (HIGH — ReAct/4-phase 是行业共识)
- [SitePoint — Agentic Design Patterns 2026](https://www.sitepoint.com/the-definitive-guide-to-agentic-design-patterns-in-2026/) (MEDIUM — 2026 SOTA 综述)
- [Strapi — LangChain vs Vercel AI SDK vs OpenAI SDK 2026](https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide) (MEDIUM — bundle 数据：101.2 / 67.5 / 34.3 KB)
- [LangChain.js Multiple JS Environments blog](https://blog.langchain.com/js-envs/) (HIGH — 浏览器/Workers 支持已经稳定)
- [Vercel AI SDK issue #3041 — `dangerouslyAllowBrowser`](https://github.com/vercel/ai/issues/3041) (HIGH — 浏览器 BYO Key 仍是二等)
- [Vercel AI SDK 5 docs — Tools and Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) (HIGH — v5 用 inputSchema/outputSchema 替换 parameters/result)

---

## 2. Tool 调用线协议 — OpenAI `tools` + `tool_calls`

### 决策

**线协议用 OpenAI Chat Completions `tools` + `tool_calls` schema**，**不**用 JSON-mode 自己 prompt。

### 理由

**两家 Provider 都原生支持**（HIGH confidence）：

| Provider | Tool 调用支持 | 并行调用 | strict mode | 最大 function 数 |
|---|---|---|---|---|
| **DeepSeek `deepseek-v4-pro`** | OpenAI `tools` schema 原生 | **支持**（"parallel and multi-turn tool calls"） | **支持**（`base_url=/beta` + `strict: true`） | **128** |
| **DeepSeek `deepseek-v4-flash`** | OpenAI `tools` schema 原生 | 支持 | 支持 | 128 |
| **aihubmix（passthrough）** | OpenAI `tools` schema 原生 | 取决于底层模型（GPT/Claude/Qwen 均支持） | 取决于底层模型 | 取决于底层模型 |

**结论：v1 已选的 OpenAI 兼容线协议在 v2 一字不改可直接跑 agent**。这是把 DeepSeek/aihubmix 选成主 Provider 时无意中收的红利。

### Schema 规范（v2 Aster 落地用）

```ts
// 工具定义 — 注册时写
interface ToolDef {
  type: 'function';
  function: {
    name: string;                  // 如 "ppt_new_slide" / "excel_set_range" / "word_insert_paragraph"
    description: string;
    parameters: JSONSchema;        // OpenAI 标准 JSON Schema
    strict?: boolean;              // DeepSeek strict 模式（可选；先不开，让模型容错）
  };
}

// 模型返回 — LLM 选了哪个 tool
interface ToolCall {
  id: string;                      // 必须回灌到 role:'tool' 的 tool_call_id
  type: 'function';
  function: { name: string; arguments: string };  // arguments 是 JSON 字符串
}

// 工具结果回灌 — Aster 执行完后 push 的消息
interface ToolMessage {
  role: 'tool';
  tool_call_id: string;
  content: string;                 // 推荐：JSON.stringify(结构化结果)，方便 LLM 解析
}
```

### Streaming `tool_calls`（重要细节）

- OpenAI SSE 风格下，`tool_calls` 以 **delta** 形式增量到达（先 `index`+`id`+`function.name`，后续 chunk 流 `function.arguments` 字符串拼接），最后一个 chunk 收到 `finish_reason: "tool_calls"` 才算闭合。
- DeepSeek 官方 tool_calls 文档**未明确说明 streaming delta 行为**（已确认 LOW）；按 OpenAI 兼容惯例处理即可，但 **spike 必须验证一次**（见 §7）。
- v1 已有的 `parseSSE()` 需要扩：解析 `delta.tool_calls[]` 并按 `index` 维护增量拼接缓冲区。
- **`stream_options.include_usage: true` 是 v2 必加**——v1 没设；最后一个 chunk 携带 `usage` 字段（`prompt_tokens` + `completion_tokens` + `total_tokens`），是 §5 token 计数的**唯一可信来源**。

### 已知坑

- **DeepSeek strict mode** 要换 base URL（`/beta`），先不开，让模型自我修正参数；如果 spike 看到模型经常填错参数，再考虑开 strict。
- **NVIDIA NIM 的 DeepSeek 端点**在 Claude Code/Anthropic-compatible 客户端下有 streaming tool_calls 不闭合的报告——**Aster 直连 `api.deepseek.com`**，不走 NIM，规避。
- **aihubmix passthrough 不保证 strict mode**——切换 Provider 时 strict 字段降级为忽略。

### Sources

- [DeepSeek API — Tool Calls](https://api-docs.deepseek.com/guides/tool_calls) (HIGH — 官方文档确认 OpenAI schema)
- [Lushbinary — DeepSeek V4 Agents: Function Calling, MCP & Agentic Guide](https://lushbinary.com/blog/deepseek-v4-ai-agents-function-calling-mcp-guide/) (MEDIUM — V4-Pro 并行 + 128 函数 + MCPAtlas 73.6)
- [TypingMind — DeepSeek V4 Flash](https://www.typingmind.com/guide/deepseek/deepseek-v4-flash) (MEDIUM — Flash 明确支持 tool_calls + 128 max + JSON output)
- [OpenAI API Reference — Function Calling](https://developers.openai.com/api/docs/guides/function-calling) (HIGH — schema 权威定义)
- [OpenAI Streaming Events Reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events) (HIGH — delta tool_calls 格式)

---

## 3. State machine — Zustand 够用，**不**引 XState

### 决策

**沿用现有 `chatStore`（Zustand 5）**，agent loop 用纯 TS 函数 + `AbortController`，**不**新增 XState 或 `@xstate/store`。

### 理由

| 状态数 | 转换数 | XState 价值 | Aster 实际情况 |
|---|---|---|---|
| 5 个名义状态（`idle / thinking / tool-running / paused / aborted`） | 大约 8 个转换 | 显式 statechart + visualizer 当状态数 ≥ 15 / 转换 ≥ 30 时显著省心 | **远低于阈值** |

社区共识（搜索结论）：

- "XState can be way too sophisticated for simpler needs. If there are no complicated state transitions that actually need the sophistication of XState, there are pain points like learning curve and boilerplate code which would have been justified if the app actually had that kind of complexity."
- `@xstate/store`（< 1 KB）是 Zustand-like 的中间选项，但**它和 Zustand 解决同一类问题**——在 Aster v2 没有差异化收益，反而引入第二个 store 概念混淆。

**Aster v2 agent loop 的所有"状态机"行为都可由这三件事完成**：

1. `chatStore.agentStatus` 枚举字段（Zustand 一次 `set()`）；
2. `AbortController.signal`（pause = 调 `controller.abort()`，新一轮 = `new AbortController()`）；
3. for-loop + early-return（max_steps 硬上限 / cost cap / 用户 abort / tool-loop-break）。

**XState 真正赢的场景**：并行子状态、嵌套 history、可视化调试、跨组件复用复杂状态。Aster v2 loop 是**单线程纯顺序**，全部躺在 `runAgent()` 一个函数里，不需要这些。

### Anti-patterns

| 不做 | 原因 |
|---|---|
| XState 5 核心（~14 KB gzipped） | 状态数远低于 XState 收益门槛；学习成本由 solo dev 全吃 |
| `@xstate/store`（< 1 KB） | 与 Zustand 重叠，引入第二概念，且没有视觉化 store 之外的优势 |
| 把 agent loop 拆成多个 Zustand action | 状态机分散到 store 里，反而比 `runAgent()` 一个函数更难读 |

### Sources

- [Stately — @xstate/store](https://stately.ai/docs/xstate-store) (HIGH — < 1 KB store API)
- [Makers' Den — React State Management 2025](https://makersden.io/blog/react-state-management-in-2025) (MEDIUM)
- [StackShare — XState vs Zustand](https://stackshare.io/stackups/xstate-vs-zustand) (MEDIUM)
- [XState migration discussion #4708](https://github.com/statelyai/xstate/discussions/4708) (MEDIUM — 「XState too sophisticated for simpler needs」社区共识)

---

## 4. Diff log + Undo all — 自写 `OperationLog`，**不**引第三方库

### 决策

**v2 自写一个 `OperationLog` 反向操作记录器**——每个 tool 在 adapter 层执行后返回 `{ result, reverse: () => Promise<void> }`，loop 把 `reverse` 推进 `chatStore.operationLog`；`undoAll()` 反序执行所有 `reverse`。**不**引 immer/Yjs/jsondiffpatch。

### 关键事实（必须先告诉用户）

**Office.js 没有 transaction / programmatic undo API**（HIGH confidence）：

- GitHub `OfficeDev/office-js#2543` 多年未解：custom function 执行后 native Ctrl+Z **直接禁用**。
- Microsoft Learn 也未列出任何 Word/Excel/PowerPoint 的 transaction/rollback API。
- 用户的 Ctrl+Z 栈对 add-in 写入的内容**不可靠**——可能跳过我们写的内容，也可能整体被禁用。

**意味着 Q9 的"一键 undo all 兜底"必须由 Aster 自己实现**——这件事不是可选优化，是 Q9 决议的必需配套。

### 设计

```ts
// src/agent/operationLog.ts
interface OperationLogEntry {
  toolCallId: string;
  toolName: string;
  args: any;
  timestamp: number;
  reverse: () => Promise<void>;    // adapter 层在执行时一并产出
  result: any;
}

// 每个 tool 在 adapter 里产出 reverse
// 例如 ppt_new_slide:
async function ppt_new_slide(args): Promise<{ result; reverse }> {
  const slideId = await PowerPoint.run(async ctx => {
    const s = ctx.presentation.slides.add();
    await ctx.sync();
    return s.id;
  });
  return {
    result: { slideId },
    reverse: async () => {
      await PowerPoint.run(async ctx => {
        const s = ctx.presentation.slides.getItem(slideId);
        s.delete();
        await ctx.sync();
      });
    },
  };
}

// undo all = 反序执行
async function undoAll() {
  const log = chatStore.operationLog.slice().reverse();
  for (const entry of log) {
    try { await entry.reverse(); } catch (e) { /* 标记失败，不阻塞 */ }
  }
  chatStore.operationLog = [];
}
```

### 关键约束（每个 write tool 上线都要满足）

- **adapter 写 tool = 必须产出 reverse**。`registerTool()` 在 v2 必须强类型要求返回 `{ result, reverse }`，不给 reverse 不让注册（用 TS 强制）。
- **read tool 不需要 reverse**（无副作用）。
- **reverse 失败不阻塞**——比如用户中途手动改动了那张 slide，reverse 报 not found 是正常的，标记进 diff log UI（"无法回滚：用户已修改"）。
- **diff log UI** 直接遍历 `operationLog` 渲染即可，不需要 jsondiffpatch 类库。

### Anti-patterns

| 不做 | 原因 |
|---|---|
| 依赖 native Ctrl+Z | 已知 add-in 写入会破坏 undo 栈；不可靠 |
| Yjs / CRDT 做协同 diff | 单文档 / 单用户 / 无后台，CRDT 解决的问题 Aster 没有 |
| immer patches + reverse patches | 那是 React store diff，Office.js 的副作用在 add-in 外，不在我们 store 内 |
| jsondiffpatch | diff 视觉化用得上的是字符串/对象差异，Aster 需要的是"操作回放"——两件事 |

### Sources

- [GitHub `OfficeDev/office-js#2543` — Undo unavailable after running custom functions](https://github.com/OfficeDev/office-js/issues/2543) (HIGH — 长期未解)
- [Microsoft Learn — Understand the Office JavaScript API](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/understand-the-javascript-api-for-office) (HIGH — 未列 transaction API)
- [GitHub `OfficeDev/office-js#6513` — Open letter on Office.js stability](https://github.com/OfficeDev/office-js/issues/6513) (MEDIUM — 2026-02 社区信，平台稳定性议题)

---

## 5. Token 计数 — 用 Provider `usage` 字段，**不**装客户端 tokenizer

### 决策

**SSE 请求一律加 `stream_options: { include_usage: true }`**，从最后一个 chunk 的 `usage.{prompt_tokens, completion_tokens, total_tokens}` 累加 Q9 的 ¥10/prompt cap。**不**装 `gpt-tokenizer` / `js-tiktoken` / `tiktoken-wasm`。

### 理由

| 来源 | 优点 | 缺点 | Aster 适配 |
|---|---|---|---|
| **Provider `usage` 字段** | 0 KB、Provider 真实计费口径、自动适配 DeepSeek / aihubmix 不同 tokenizer | 只有响应回来之后才知道；无法**预估**用户输入会花多少 | **够用** — Q9 是"超 ¥10 停"，不是"预估输入要多少"。可以在每步**累加之后**判断 |
| `gpt-tokenizer` ~50 KB | 客户端预估、最快的纯 JS BPE、tree-shakeable per-model | DeepSeek 用的 tokenizer **不是 OpenAI 的**——估出来的数字与 Provider 实际计费有偏差；不能跨模型一致 | **不准** — 估错的成本计数比没估更糟 |
| `js-tiktoken` ~200 KB | OpenAI 维护、生态稳定 | 同上 tokenizer 不匹配；体积更大 | 同上 |

**关键事实**：DeepSeek 用的是自家 BPE（V4 系列），与 GPT-4o 的 `o200k_base` 不一致；用 tiktoken 估 DeepSeek 的 token 会**系统性偏差**。准确成本只能等 Provider 回 `usage`。

**Q9 的 ¥10 cap 怎么落**：

```ts
// 每步 LLM 调用后累加，下一步开始前判断
chatStore.addCost(res.usage);  // 累加 prompt + completion
if (chatStore.costAccum.rmb >= COST_CAP_RMB) return { reason: 'cost-cap' };
```

这是**事后判断**——某一步可能略微超出（比如第 5 步从 ¥9.8 跳到 ¥10.3 才停），但**不会失控**因为下一步立即被拦下，且 max_steps=20 是更早的硬上限。

### 单价表（用于 RMB 换算，落到 `costAccum.rmb` 字段）

```ts
// 写在 Provider config（已 v1 抽象），跟着 model 走
const DEEPSEEK_V4_PRO   = { promptUSD: 1.74, completionUSD: 3.48 };   // per 1M tok
const DEEPSEEK_V4_FLASH = { promptUSD: 0.14, completionUSD: 0.28 };
const USD_TO_RMB = 7.2;   // 写死或读用户设置
```

**Spike 必须验**：aihubmix passthrough 是否也在 SSE 最后 chunk 返回 `usage`——大多数 OpenAI-compatible gateway 都遵守，但要现场确认。

### Anti-patterns

| 不做 | 原因 |
|---|---|
| 装 `gpt-tokenizer` ~50 KB | DeepSeek tokenizer 不同，估值系统偏差；50 KB 净亏没买到准确 |
| 装 `js-tiktoken` ~200 KB | 同上 + 体积大 4× |
| 装 `@dqbd/tiktoken` WASM | 同上 tokenizer 不同；WASM 初始化时间 + 体积更糟 |
| 客户端预估 + 服务端 reconcile | 没有服务端 |
| 不 enable `include_usage` 自己估 | 偏差更大，不如直接 0 估值（不可接受） |

### Sources

- [OpenAI streaming events — `stream_options.include_usage`](https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events) (HIGH — 官方 schema)
- [OpenAI Dev Community — Usage stats in streaming](https://community.openai.com/t/usage-stats-now-available-when-using-streaming-with-the-chat-completions-api-or-completions-api/738156) (HIGH — 发布说明)
- [PkgPulse — gpt-tokenizer vs js-tiktoken vs Xenova 2026](https://www.pkgpulse.com/guides/gpt-tokenizer-vs-js-tiktoken-vs-xenova-transformers-llm-2026) (MEDIUM — 体积对比 50 / 200 KB)
- [niieani/gpt-tokenizer GitHub](https://github.com/niieani/gpt-tokenizer) (HIGH — npm 包细节)

---

## 6. Bundle 预算复核（≤ 1 MB initial）

v1 当前实测 ~63–68 KB gzipped initial（移除 Fluent v9 后）。v2 增量决策**全部 0 KB 新增运行时依赖**：

| 增量 | 增量 KB gzipped | 备注 |
|---|---|---|
| `src/agent/loop.ts` | ~1 KB | 50 行 TS 编译后 |
| `src/agent/tools.ts` | ~1 KB | ToolRegistry + adapter wiring |
| `src/agent/operationLog.ts` | < 1 KB | reverse 记录器 |
| Provider adapter 扩 tool_calls delta 解析 | ~1 KB | 扩 v1 已有 `parseSSE()` |
| `chatStore` 新 fields（agentStatus / cost / log / pause） | < 1 KB | Zustand action 追加 |
| **小计** | **~4–5 KB** | |
| **v2 initial total（估）** | **~67–73 KB gzipped** | 预算 ≤ 1 MB，**剩余 ~93%+ headroom** |

**Markdown 渲染**：`react-markdown` + `remark-gfm`（~3 KB gzipped）在 v1 STACK 表里已计入，v2 chat UI 接入时**lazy import**（只在第一次渲染包含 markdown 的 assistant 消息时拉取），不进 initial chunk。

**Shiki 代码高亮**：仅当 AI 返回代码块时 lazy load（~150 KB）。v2 Excel agent 写公式解释场景概率高，但仍按 lazy 处理。

---

## 7. Phase 0 Spike — v2 新增验证项

v1 已 spike 过的项目（CORS / Office.js host API / DeepSeek 文本 / aihubmix / partitioned localStorage / pptx 解析）不再重复。**v2 新增 4 个 spike**：

1. **DeepSeek `tool_calls` streaming delta** — 给 `deepseek-v4-pro` 一个简单 tool（如 `get_time()`），开 `stream: true`，记录 SSE chunk 中 `delta.tool_calls` 的实际格式（`index` / `id` / `function.name` / `function.arguments` 的到达顺序与拼接规则）。如果与 OpenAI 标准不一致，扩 `parseSSE()` 适配。
2. **DeepSeek `stream_options.include_usage` 是否在最后 chunk 返回 `usage`** — 直接验。如果 DeepSeek 不支持这字段，回退方案：每步调用结束后单发一个非 streaming 请求询问（成本翻倍，**不可接受**）；更现实的回退是用 `usage` 字段在非 streaming 模式校准 + streaming 模式用近似估算（仍优于装 tokenizer）。
3. **aihubmix passthrough `tool_calls` + `usage`** — 同上对 `gpt-image-2` / vision model 验一遍。
4. **Office.js reverse 操作的实际可达性** — 对每个 v2 计划的写 tool（new_slide / delete_slide / set_range / set_formula / insert_paragraph / replace_text）写一个 happy-path 单测，验 reverse 在三宿主 Web 端能跑通。**关键风险点：** 删除内容后能否拿到足够元数据回放？某些操作（如格式化）的 reverse 可能需要 read-then-write 两步——预算到 P9X 的 ≤ 10s 内是否合理，需要实测。

---

## 8. Installation Commands

**v2 增量：0 个新依赖。** v1 现有 `package.json` 已含 `zustand@^5`、`react-markdown@^9`、`remark-gfm@^4`、`@types/office-js`、`vite@^7`、`typescript@^5.7`。

```bash
# 无需 npm install 任何新包。
# 全部 v2 能力在 src/agent/ 三个新文件 + chatStore 增量字段中实现。
```

---

## 9. Alternatives Considered（v2 增量决策 Recap）

| Concern | Recommended | Alternative | Why Not |
|---|---|---|---|
| Agent loop | 自写 ~50 行 | LangChain.js | +37–101 KB；浏览器侧 BYO Key 非一等；抽象掉要定制的 Q9/Q10/Q11 |
| Agent loop | 自写 ~50 行 | Vercel AI SDK v5 Agent | server-route 假设；issue #3041 仍 open；ModelMessage/UIMessage 心智成本 |
| Agent loop | 自写 ~50 行 | OpenAI SDK `dangerouslyAllowBrowser` | +34 KB 包一层 v1 已有的 SSE adapter |
| Agent loop | 自写 ~50 行 | MCP client | 浏览器无 stdio/socket transport；与无后台冲突 |
| Tool 线协议 | OpenAI `tools`/`tool_calls` | JSON-mode prompt 自抠 | DeepSeek + aihubmix 都原生支持 tools，没理由倒退 |
| 状态机 | Zustand + AbortController | XState 5 | 状态数远低于 XState 收益门槛 |
| 状态机 | Zustand + AbortController | `@xstate/store` | 与 Zustand 重叠，无差异化收益 |
| Diff/Undo | 自写 OperationLog | Native Ctrl+Z | Office.js 写入会破坏 undo 栈（issue #2543） |
| Diff/Undo | 自写 OperationLog | immer patches / jsondiffpatch | 反向操作发生在 Office.js host 内，不在 React store 里 |
| Token 计数 | Provider `usage` 字段 | `gpt-tokenizer` ~50 KB | DeepSeek tokenizer 不同；估值系统偏差 |
| Token 计数 | Provider `usage` 字段 | `js-tiktoken` ~200 KB | 同上 + 体积大 4× |
| JSON schema 校验 | 不在 prod 加 | `ajv` / `zod` | DeepSeek `strict: true` 原生可开；浏览器侧重复校验是浪费 |

---

## 10. 与 v1 已有代码的集成清单（给后续 phase 用）

| v1 文件 | v2 改动 |
|---|---|
| `src/adapters/*` (PPT/Excel/Word) | 把现有 write 函数包成 ToolDef + 在 invoke 时返回 `{ result, reverse }` |
| `src/lib/sse.ts`（v1 SSE 解析） | 扩 `delta.tool_calls[]` 增量拼接（按 `index` 维护缓冲区） |
| `src/lib/provider.ts`（Provider 抽象） | `chat()` 增加 `tools` 入参；请求 body 加 `stream_options.include_usage: true` |
| `src/state/chatStore.ts` | 追加 `agentStatus / currentStep / costAccum / operationLog / pause() / undoAll() / setPrivacyOptOut()` |
| `src/components/*` | 新增 `<AgentStatusBar/>` (pause + cost meter + step 计数)、`<DiffLog/>`（操作回放列表 + Undo all 按钮）、Settings 加「关闭文档全文发送」开关、Onboarding 加「全文读取授权」步骤 |
| **新增** `src/agent/loop.ts` | runAgent runner |
| **新增** `src/agent/tools.ts` | registerTool + ToolRegistry |
| **新增** `src/agent/operationLog.ts` | OperationLogEntry + undoAll |

---

## 11. Open Stack Questions（spike / roadmap 阶段解决）

- **Q-S1**：DeepSeek streaming `tool_calls` delta 实际格式是否完全对齐 OpenAI？（spike 1）
- **Q-S2**：DeepSeek 是否支持 `stream_options.include_usage` 字段？（spike 2）若不支持，回退方案。
- **Q-S3**：aihubmix passthrough 时 `usage` 是否如实透传？（spike 3）
- **Q-S4**：Office.js 三宿主 reverse 操作的实测可行性（删除 / 撤销格式化）—— 哪些操作无法可靠回滚？需要在 UI 上标"此操作不可撤销"还是直接不让 agent 跑？（spike 4，可能影响 tool 池设计）
- **Q-S5**：`reasoning_effort: "high"`（V4 thinking mode）对 token 成本影响多大？是否要在 ¥10 cap 之外单独限制思考 token？（roadmap）
- **Q-S6**：DeepSeek strict mode（`base_url=/beta` + `strict:true`）开 vs 不开对参数填错率的实测差异（roadmap，进生产前做一次 A/B）

---

## Sources（全集）

### Agent loop / framework（HIGH — pattern；MEDIUM — bundle 数字）
- [Oracle Developers — The AI Agent Loop](https://blogs.oracle.com/developers/what-is-the-ai-agent-loop-the-core-architecture-behind-autonomous-ai-systems)
- [SitePoint — Agentic Design Patterns 2026](https://www.sitepoint.com/the-definitive-guide-to-agentic-design-patterns-in-2026/)
- [Strapi — LangChain vs Vercel AI SDK vs OpenAI SDK 2026](https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide)
- [LangChain.js Multiple JS Environments blog](https://blog.langchain.com/js-envs/)
- [LangChain.js bundle size issue #809](https://github.com/langchain-ai/langchainjs/issues/809)
- [Vercel AI SDK 5 — Tool Calling docs](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Vercel AI SDK issue #3041 — `dangerouslyAllowBrowser`](https://github.com/vercel/ai/issues/3041)
- [Vercel AI SDK 5 release notes](https://vercel.com/blog/ai-sdk-5)

### Tool calling line protocol（HIGH）
- [DeepSeek API — Tool Calls guide](https://api-docs.deepseek.com/guides/tool_calls)
- [DeepSeek V4 Preview Release](https://api-docs.deepseek.com/news/news260424)
- [Lushbinary — DeepSeek V4 Agents guide](https://lushbinary.com/blog/deepseek-v4-ai-agents-function-calling-mcp-guide/)
- [TypingMind — DeepSeek V4 Flash guide](https://www.typingmind.com/guide/deepseek/deepseek-v4-flash)
- [NVIDIA NIM DeepSeek streaming tool_calls bug report](https://forums.developer.nvidia.com/t/deepseek-v4-pro-v4-flash-on-nvidia-nim-streaming-tool-calls-do-not-continue-in-claude-code-anthropic-compatible-agent-workflow/368085)
- [OpenAI API Reference — Function Calling guide](https://developers.openai.com/api/docs/guides/function-calling)
- [OpenAI Streaming Events Reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events)
- [AiHubMix overview](https://www.toolify.ai/tool/aihubmix)

### State machine（MEDIUM）
- [Stately — @xstate/store](https://stately.ai/docs/xstate-store)
- [StackShare — XState vs Zustand](https://stackshare.io/stackups/xstate-vs-zustand)
- [Makers' Den — React State Management 2025](https://makersden.io/blog/react-state-management-in-2025)
- [XState migration discussion #4708](https://github.com/statelyai/xstate/discussions/4708)

### Office.js undo / transaction（HIGH on negative result）
- [GitHub `OfficeDev/office-js#2543` — Undo unavailable after custom functions](https://github.com/OfficeDev/office-js/issues/2543)
- [GitHub `OfficeDev/office-js#6513` — Open letter on Office.js stability](https://github.com/OfficeDev/office-js/issues/6513)
- [Microsoft Learn — Understand the Office JavaScript API](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/understand-the-javascript-api-for-office)

### Token counting（HIGH on `usage`；MEDIUM on tokenizer bundle）
- [OpenAI API — `stream_options.include_usage`](https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events)
- [OpenAI Dev Community — Usage stats in streaming](https://community.openai.com/t/usage-stats-now-available-when-using-streaming-with-the-chat-completions-api-or-completions-api/738156)
- [PkgPulse — gpt-tokenizer vs js-tiktoken vs Xenova 2026](https://www.pkgpulse.com/guides/gpt-tokenizer-vs-js-tiktoken-vs-xenova-transformers-llm-2026)
- [niieani/gpt-tokenizer GitHub](https://github.com/niieani/gpt-tokenizer)
- [js-tiktoken on npm](https://www.npmjs.com/package/js-tiktoken)

### Reference — v1 STACK
- 见 `.planning/research/v1.0/STACK.md`（v1 完整决策；v2 不重研那些条目）
