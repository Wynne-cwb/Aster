# Phase 12: UI 打磨 (E) — Research

**Researched:** 2026-05-31
**Domain:** React 19 + react-markdown v9 + 纯 CSS 动效 + Zustand 状态机 + Office.js Task Pane UI
**Confidence:** HIGH（全部基于 node_modules 真实代码 + codebase 逐行阅读验证）

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01** UI-01 P0，第一行改动，独立首个 plan，有测试守门
- **D-02** 落点：`ChatBubble.tsx` `<ReactMarkdown>` 加 `urlTransform` prop
- **D-03** 白名单放行 `http:`/`https:`/`mailto:`/相对路径/`#`；危险协议返回 `''`
- **D-04** 测试守门：4 个用例（js:攻击/data:攻击/https正常/img同类），RED→GREEN 随 plan 交付
- **D-05** `agentStatus==='pending'` 已确认不存在，语义映射为 running + 空 content + isStreaming
- **D-06** 触发：当前 run 的最后一条 assistant 消息 `content===''` 且 `isStreaming===true`；ChatBubble 的 null 行为保持不变
- **D-07** 视觉：三点跳动，`--text-3` 色，staggered，reduced-motion 降级为静态三点
- **D-08** loading 气泡与 AgentControlBar 并存
- **D-09** DiffLogPanel 当前在 nodes 之后统一渲染（底部沉积），这是 bug
- **D-10** 修复：边界插入——在 nodes 循环内按 agentRunId 最后一条消息之后插入；移除底部统一块；保留 lazy+Suspense；去重
- **D-11** 表格：`border-collapse:collapse; width:100%; --fs-13; --space-2 margin`；cell `1px --border; 6×8 padding`；th `--surface-2 + 600`；无斑马纹
- **D-12** 列表/代码块：审计一致性，不引 shiki
- **D-13** 禁硬编码 hex（UI-06 内联 CSS 是唯一正当例外）
- **D-14** read/write 判定真相源：`ToolDef.kind`；推荐 (a) 在 loop-helpers push 时写进 Message
- **D-15** read 卡：去边框 + `--text-3` 字色 + 收内距；write 卡不变；混合组「任一 write 整组正常」
- **D-16** read 卡不加前缀图标
- **D-17** 骨架屏：纯 CSS，0 净新增依赖，写在 index.html `#root` 内 + 内联 `<style>`
- **D-18** 内联 CSS 硬编码例外：骨架屏在 Office.onReady 前无 CSS 变量可用
- **D-19** 布局：header 占位 + 2–3 条气泡块；shimmer 单色明度渐变（非品牌渐变）；createRoot 自动覆盖；reduced-motion 停动画

### Claude's Discretion
- 测试文件组织方式
- CSS 规则在 styles.css 内的物理位置
- urlTransform 函数位置（抽 `src/utils/` 或内联）
- agentRunId 边界检测的具体算法（Map 分组 vs 单次遍历 last-index）

### Deferred Ideas (OUT OF SCOPE)
- Settings model 下拉（builtin-model-dropdown.md）
- 任何新视觉方向、新组件库、聊天功能增强、动效系统重构
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | react-markdown 加 `urlTransform` XSS 防御（P0，CVE-2025-24981 同类） | `urlTransform` 签名 + `defaultUrlTransform` 行为 + 测试模式全部验证 |
| UI-02 | 消息发出后立即显示 AI「思考中」loading 气泡（不等首 token） | loop-helpers push 行为 + ChatBubble null 路径 + agentStore 状态机全部验证 |
| UI-03 | DiffLogPanel 卡按 agentRunId 边界插入消息流 | ChatStream 节点构建循环 + flushToolRun 时机 + 算法边界全部验证 |
| UI-04 | Markdown 渲染优化——表格加边框 + 列表/代码块一致性 | 现有 styles.css `.bubble-ai` 规则审计完成 |
| UI-05 | 读取工具卡轻量化降权（write 卡不降权） | ToolDef.kind 字段 + loop-helpers push 点 + Message 接口验证 |
| UI-06 | 首屏纯 CSS shimmer 骨架屏（Office.onReady 前） | index.html 结构 + main.tsx onReady 时机 + createRoot 覆盖机制全部验证 |
</phase_requirements>

---

## Summary

Phase 12 是在**已冻结 teal 克制设计系统内的精修**，6 项需求（UI-01..06）通过逐行读取 codebase 完成了全部技术细节验证。所有关键实现路径均已确认，不存在架构层面的不确定性——本阶段的挑战在于执行精度而非探索未知。

**UI-01**（P0 安全）：react-markdown@9.1.0 已安装，`urlTransform` prop 原生支持，签名为 `(url: string, key: string, node: Element) => string | null | undefined`。它通过 `html-url-attributes` 包的 `urlAttributes` 映射作用于**所有 URL 属性**（`href` for `a`/`area`/`base`/`link`，`src` for `img`/`audio`/`video`/`iframe` 等共 11 类属性），不局限于 `a[href]` 和 `img[src]`。`defaultUrlTransform` 已过滤非 `https?|ircs?|mailto|xmpp` 协议，但它不是白名单（它允许 ircs/xmpp 等），自写更清晰可测。

**UI-02**：`loop-helpers.streamAssistantTurn` 在每轮开头（L78-81）push `{content:'', isStreaming:true, agentRunId, agentStep}`；`ChatBubble` L79-81 对空 content 直接 `return null`——这是 UI-02 要填补的空窗期。触发信号完全在 `messages` 数组中可读取，无需新增 store 状态。

**UI-03**：`ChatStream` L402-406 当前把所有 DiffLogPanel 渲染在 `nodes` 之后。边界插入算法需在 `for (const m of messages)` 循环中追踪 agentRunId 变化，在 `flushToolRun()` 之后插入 DiffLogPanel 节点——时序约束已确认：须先 flush 工具组再插面板。

**主要建议：** 按 UI-01（P0 安全）→ UI-02/UI-05（共同改 loop-helpers+Message 类型时合并考虑 kind 字段）→ UI-03 → UI-04 → UI-06 的顺序规划 plan，最大化代码改动的连贯性。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| XSS URL 过滤（UI-01） | Frontend（ChatBubble） | utils（safeUrlTransform） | 渲染层拦截，抽 util 便于单测 |
| 思考气泡渲染（UI-02） | Frontend（ChatStream） | agentStore/chatStore（只读状态） | ChatStream 是消息流唯一分发点 |
| DiffLogPanel 插入位置（UI-03） | Frontend（ChatStream） | — | 纯节点构建算法，无跨层协议 |
| Markdown 样式（UI-04） | styles.css | — | 纯 CSS，零 JS 改动 |
| read/write kind 字段（UI-05） | agent/loop-helpers（写入）| Frontend（ChatStream/ToolResultCard 读取） | 在 push 点写入保证单一真相源，UI 侧只读 kind 字段 |
| 首屏骨架屏（UI-06） | index.html（静态 HTML+CSS） | — | 必须在 JS bundle 执行前显示，不可在 React 层 |

---

## Standard Stack

### Core（已安装，0 新增）

| Library | 已装版本 | 用途 | 本阶段作用 |
|---------|---------|------|-----------|
| react-markdown | 9.1.0 | LLM 输出 Markdown 渲染 | UI-01 加 urlTransform prop |
| remark-gfm | 4.x | GFM 表格/列表/代码块扩展 | UI-04 表格渲染前提（已启用） |
| zustand | 5.x | 客户端状态 | UI-02 读 agentStore/chatStore |
| vitest + jsdom | 2.x | 测试框架 | UI-01 安全测试守门 |
| @testing-library/react | 16.x | 组件渲染测试 | UI-01/02/03/05 DOM 断言 |

**本阶段净新增运行时依赖：0**（硬约束 D-17/NFR-06）

### 版本确认

| Package | 安装版本 | 来源 |
|---------|---------|------|
| react-markdown | **9.1.0** | `node_modules/react-markdown/package.json` [VERIFIED: node_modules] |
| `urlTransform` 支持 | **v9.0.0+** 引入（取代旧 `transformLinkUri` / `transformImageUri`） | [VERIFIED: node_modules 反编译] |

---

## Architecture Patterns

### UI-01：urlTransform XSS 防御

**精确 API（[VERIFIED: node_modules react-markdown@9.1.0]）：**

```typescript
// 类型定义（index.d.ts）
type UrlTransform = (url: string, key: string, node: Readonly<Element>) => string | null | undefined;

// 作用范围：html-url-attributes 包的 urlAttributes 对象，包括：
// href：a, area, base, link
// src：audio, embed, iframe, img, input, script, source, track, video
// 其他：action(form), cite, data(object), formAction, icon, itemId, manifest, ping, poster

// 调用点（index.js L374-377）：
// for (key in urlAttributes) {
//   if (test === null || test.includes(node.tagName)) {
//     node.properties[key] = urlTransform(String(value || ''), key, node)
//   }
// }
```

**关键行为：**
- 返回 `''`（空串）→ react-markdown 把属性值设为 `''`（链接退化为无 href 纯文本，`<a href="">text</a>`）
- 返回 `null` / `undefined` → 同样设为 `''`（String(null) = 'null' 会进去，注意：直接 `return null` 实际是 `String(null||'') = ''`，等效空串）
- `defaultUrlTransform` 允许协议：`/^(https?|ircs?|mailto|xmpp)$/i`（包含 ircs/xmpp，比自写 allowlist 宽）

**自写 allowlist 推荐实现（[ASSUMED] 逻辑合理，但需 RED→GREEN 测试验证）：**

```typescript
// src/utils/safeUrlTransform.ts
// 白名单：http/https/mailto + 相对路径（无协议部分）+ 锚点(#)
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function safeUrlTransform(url: string): string {
  if (!url) return '';
  // 相对路径 / 锚点 / 无协议 → 放行
  if (url.startsWith('#') || url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
    return url;
  }
  try {
    const parsed = new URL(url, 'https://example.com');
    return SAFE_PROTOCOLS.has(parsed.protocol) ? url : '';
  } catch {
    // URL 解析失败（非标准格式）→ 相对路径降级，放行
    return url;
  }
}
```

**注意：** `javascript:` / `data:` / `vbscript:` / `file:` 均不在 SAFE_PROTOCOLS 中，命中 → 返回 `''`。

**urlTransform 在 ChatBubble 中的用法：**

```tsx
// src/components/ChatBubble.tsx（改后）
import { safeUrlTransform } from '../utils/safeUrlTransform';

<ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={safeUrlTransform}>
  {message.content}
</ReactMarkdown>
```

### UI-02：思考气泡触发条件

**[VERIFIED: loop-helpers.ts L77-81] push 行为确认：**

```typescript
// streamAssistantTurn 每轮开头立即执行：
chatActions().pushMessage?.({
  id: assistantMsgId, role: 'assistant', content: '', isStreaming: true,
  agentRunId: runId, agentStep: step,
} as never);
// → messages 数组中存在 {role:'assistant', content:'', isStreaming:true, agentRunId:currentRunId}
```

**[VERIFIED: ChatBubble.tsx L79-81] 空 content 返回 null：**

```typescript
if (!message.content.trim()) {
  return null;  // ← 这是空窗期，UI-02 在 ChatStream 层补 loading 气泡
}
```

**[VERIFIED: agentStore.ts L26] AgentStatus 枚举：**

```typescript
export type AgentStatus = 'idle' | 'running' | 'paused' | 'soft-landing';
// 无 'pending'——REQUIREMENTS.md 写错了，D-05 已校正
```

**触发条件的最简读法（ChatStream 内）：**

```typescript
// 读 agentStatus 和 currentRunId
const agentStatus = useAgentStore((s) => s.agentStatus);
const currentRunId = useAgentStore((s) => s.currentRunId);
const messages = useMessages();

// 判断是否显示思考气泡
const lastAssistant = currentRunId
  ? [...messages].reverse().find(
      (m) => m.role === 'assistant' && m.agentRunId === currentRunId
    )
  : undefined;

const showTyping =
  (agentStatus === 'running' || agentStatus === 'paused') &&
  lastAssistant !== undefined &&
  lastAssistant.isStreaming === true &&
  lastAssistant.content.trim() === '';
```

**纯 CSS 三点动画模式（[VERIFIED: styles.css 现有动效规范]）：**

```css
/* 复用 .bubble-ai 外壳，新增 .bubble-typing 修饰 */
.bubble-typing {
  /* 继承 .bubble-ai 外壳样式 */
  display: flex;
  align-items: center;
  gap: 4px; /* --space-1 */
  padding: 9px 13px; /* 与 .bubble 一致 */
  min-height: 36px; /* 避免气泡过小 */
}
.bubble-typing__dot {
  width: 4px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--text-3);
  animation: aster-typing 0.96s ease-in-out infinite;
  flex-shrink: 0;
}
.bubble-typing__dot:nth-child(2) { animation-delay: 0.16s; }
.bubble-typing__dot:nth-child(3) { animation-delay: 0.32s; }
@keyframes aster-typing {
  0%, 100% { transform: translateY(0); opacity: 0.4; }
  50% { transform: translateY(-4px); opacity: 1; }
}
/* reduced-motion 降级 */
@media (prefers-reduced-motion: reduce) {
  .bubble-typing__dot { animation: none; opacity: 0.5; }
}
```

**单周期约 0.96s（3 倍 --dur-slow=320ms），错峰延迟 0.16s ≈ 0.5 × --dur-slow。**

### UI-03：DiffLogPanel agentRunId 边界插入

**[VERIFIED: ChatStream.tsx L362-408] 现有 nodes 构建循环结构：**

```typescript
const nodes: ReactElement[] = [];
let toolRun: Message[] = [];
const flushToolRun = (): void => { /* 合并 ≥2 常规 tool 卡 */ };

for (const m of messages) {
  if (isRegularTool(m)) { toolRun.push(m); continue; }
  flushToolRun();
  // ... 分发渲染
}
flushToolRun(); // ← 最后一次 flush

// 目前：底部统一渲染（bug）
completedRunIds.map(runId => <Suspense><DiffLogPanel runId={runId}/></Suspense>)
```

**边界插入算法（[ASSUMED] 算法逻辑，待实现验证）：**

```typescript
// 预先计算每个 agentRunId 的最后一条消息 index
const runLastIndex = new Map<string, number>();
messages.forEach((m, i) => {
  if (m.agentRunId && completedRunIds.includes(m.agentRunId)) {
    runLastIndex.set(m.agentRunId, i);
  }
});
const insertedRuns = new Set<string>(); // 去重

for (let i = 0; i < messages.length; i++) {
  const m = messages[i];
  if (isRegularTool(m)) { toolRun.push(m); continue; }
  flushToolRun();
  // ... 分发渲染
  // 检查是否是某 runId 的最后一条消息
  if (m.agentRunId && runLastIndex.get(m.agentRunId) === i && !insertedRuns.has(m.agentRunId)) {
    insertedRuns.add(m.agentRunId);
    nodes.push(
      <Suspense key={`dlp-${m.agentRunId}`} fallback={null}>
        <DiffLogPanel runId={m.agentRunId} />
      </Suspense>
    );
  }
}
flushToolRun();
// 移除旧的底部统一渲染块
```

**协调 flushToolRun 的约束：**
- DiffLogPanel 是 full-width 卡（`.tool-group` 结构外），不应混进 `.tool-group` 内
- 插入点在 `flushToolRun()` 之后、下一个消息处理之前——但上面算法在渲染当前消息（非 tool）之后再插，已满足此要求
- 若 runId 的最后一条消息恰好是 regularTool，需特殊处理：在 `i` 处 push 进 `toolRun`，下次 `flushToolRun` 会先渲染组，之后循环继续——此时最后一条是 tool，不会触发上面的非 tool 分支。需在 `flushToolRun` 调用后额外检查。**简化方案**：用 `for...of` + 索引，每次 flush 后立即检查 toolRun 的最后一条是否是某 runId 的最后消息。

**更健壮的算法（推荐 planner 选择）：** 先 `for...of` 建立 `runLastIndex` Map，然后改为 index-based 循环，每次 `flushToolRun()` 后检查 `toolRun` 末尾消息的 runId，决定是否在 flush 后插入 DiffLogPanel。

### UI-04：styles.css 表格规则审计结果

**[VERIFIED: styles.css L727-750] 现有 `.bubble-ai` 规则：**

- `.bubble-ai pre`：`white-space:pre-wrap; overflow-x:auto; --fs-12; --surface-2; --radius-2; padding 8px 10px`——**保留**
- `.bubble-ai code`（内联）：`--font-mono; --fs-12; --surface-2; --radius-1; padding 1px 4px`——**保留**
- `.bubble-ai ul/ol`：`padding-left:20px; margin:4px 0`——**需审计 li 行距**（现无 `line-height`，继承 `.bubble` 的 1.55，视觉上可接受）
- `.bubble-ai p`：`margin:0 0 8px`，`:last-child margin-bottom:0`——**保留**

**缺失的规则（需新增）：**

```css
/* UI-04 — 表格（D-11，数值标 [待复核]）*/
.bubble-ai table {
  border-collapse: collapse;
  width: 100%;
  font-size: var(--fs-13);      /* [待复核] */
  margin: var(--space-2) 0;     /* 8px */
}
.bubble-ai th,
.bubble-ai td {
  border: 1px solid var(--border);
  padding: 6px 8px;             /* [待复核] */
  text-align: left;
}
.bubble-ai th {
  background: var(--surface-2);
  font-weight: 600;
}
/* 宽表横向滚动（task pane 350px 宽约束，[待复核]）*/
.bubble-ai table {
  display: block;
  overflow-x: auto;
}
```

**注意：** remark-gfm 已启用（`ChatBubble.tsx L86`），表格 HTML 已能生成，只缺 CSS 样式。

### UI-05：kind 字段写入 Message

**[VERIFIED: tools/index.ts L74] ToolDef.kind：**

```typescript
export interface ToolDef<TArgs = unknown> {
  kind?: 'read' | 'write';  // ← 已有字段
}
```

**[VERIFIED: loop-helpers.ts L143-152] push 点 def 已解析：**

```typescript
const def = tools.find((t) => t.name === tc.name);
useAgentStore.getState().setPhase(def?.kind === 'write' ? 'writing' : 'reading'); // ← def 已用
// ...
chatActions().pushMessage?.({
  role: 'tool', toolCallId: tc.id, toolName: tc.name, toolResult: result,
  content: humanLabel, agentRunId: runId, agentStep: step,
  // 加：kind: def?.kind   ← 零额外查表成本
} as never);
```

**Message 接口需新增：**

```typescript
// src/store/chat.ts Message 接口
export interface Message {
  // ... 现有字段 ...
  kind?: 'read' | 'write';  // UI-05：tool 消息的 read/write 分类（来自 ToolDef.kind）
}
```

**CSS 修饰类建议：**

```css
/* UI-05 read 卡降权（D-15）*/
.aster-tool-card--read {
  border: none;  /* 去边框（write 卡保留 border） */
}
.aster-tool-card--read .wb-action-head {
  color: var(--text-3);  /* 字色降权 */
  padding: 4px 8px;      /* 内距略收（[待复核]） */
}
/* MergedToolGroup 全 read 降权 */
.tool-group--read {
  border: none;
}
.tool-group--read .tool-group__head {
  border-bottom: none;
  color: var(--text-3);
}
.tool-group--read .tool-group__list > li {
  border-bottom-color: transparent; /* 或 none */
}
```

**UI 侧判定逻辑（ChatStream ToolResultCard 和 MergedToolGroup）：**

```typescript
// 单卡：
const cardClass = `aster-tool-card${isError ? ' aster-tool-card--error' : ''}${message.kind === 'read' ? ' aster-tool-card--read' : ''}`;

// MergedToolGroup：
const allRead = messages.every((m) => m.kind === 'read');
const groupClass = `tool-group${allRead ? ' tool-group--read' : ''}`;
```

### UI-06：骨架屏结构

**[VERIFIED: index.html] 当前 `#root` 为空：**

```html
<div id="root"></div>
```

**[VERIFIED: main.tsx L50-94] Office.onReady 时机：**

```
index.html 加载
  → office.js CDN 脚本执行
    → Office.onReady 回调（异步，等待 Office 初始化）
      → createAdapter / hydrateFromStorage / loadHistory / getDocKey
        → createRoot(container).render(...)  ← 骨架被覆盖
```

骨架屏活跃时间 = 从 HTML 渲染到 Office.onReady 完成的时间（数百毫秒，最慢约 1-2 秒）。

**骨架屏实现模式（内联 HTML + CSS，[ASSUMED] 具体 px 值，待用户复核 D-19）：**

```html
<div id="root">
  <!-- UI-06 shimmer 骨架屏：仅在 Office.onReady 前显示，React.createRoot 挂载后自动覆盖 -->
  <!-- 注意：此处硬编码 hex 是全项目唯一批准例外（D-18）：styles.css 和 data-theme 此时尚未加载 -->
  <style>
    /* 骨架屏内联样式（不依赖 CSS 变量，早于 styles.css 加载） */
    #root-skeleton {
      display: flex;
      flex-direction: column;
      padding: 12px;
      gap: 8px;
      background: #ffffff;
      height: 100vh;
      box-sizing: border-box;
    }
    .sk-header {
      height: 40px;
      border-radius: 8px;
      background: #f3f2ee;
      animation: sk-shimmer 1.4s ease-in-out infinite;
      background-size: 200% 100%;
      background-image: linear-gradient(
        90deg, #f3f2ee 25%, #e9e7e0 50%, #f3f2ee 75%
      );
    }
    .sk-bubble {
      height: 56px;
      border-radius: 12px;
      max-width: 85%;
      background: #eeeef0;
      animation: sk-shimmer 1.4s ease-in-out infinite;
      background-size: 200% 100%;
      background-image: linear-gradient(
        90deg, #eeeef0 25%, #e0e0e3 50%, #eeeef0 75%
      );
    }
    .sk-bubble:nth-child(2) { animation-delay: 0.2s; }
    .sk-bubble:nth-child(3) { animation-delay: 0.4s; max-width: 60%; }
    @keyframes sk-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @media (prefers-color-scheme: dark) {
      #root-skeleton { background: #0e0e10; }
      .sk-header { background: #1f1f21; background-image: linear-gradient(90deg, #1f1f21 25%, #28282b 50%, #1f1f21 75%); }
      .sk-bubble { background: #1f1f23; background-image: linear-gradient(90deg, #1f1f23 25%, #2a2a2e 50%, #1f1f23 75%); }
    }
    @media (prefers-reduced-motion: reduce) {
      .sk-header, .sk-bubble { animation: none !important; }
    }
  </style>
  <div id="root-skeleton">
    <div class="sk-header"></div>
    <div class="sk-bubble"></div>
    <div class="sk-bubble"></div>
    <div class="sk-bubble"></div>
  </div>
</div>
```

**注意：shimmer 使用单色明度渐变（灰系 `#f3f2ee` → `#e9e7e0`），不是品牌多色渐变，符合「无多色品牌渐变」铁律（D-19 已澄清）。**

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL 协议解析 | 手写正则解析 protocol | 使用 `new URL(url, base)` + `.protocol` | URL 边缘 case 极多（data:URI, javascript: encoding 变体, vbscript:） |
| react-markdown URL 拦截 | 自定义 rehype plugin | `urlTransform` prop | 官方支持，作用于 all URL attributes，包括 img src |
| 工具 read/write 分类 | UI 侧反查工具注册表 | `Message.kind` 字段（loop-helpers push 时写入） | 反查工具注册表破坏懒加载预算（注册表为重量级模块） |
| CSS shimmer | 引入外部骨架屏库 | 内联 `@keyframes` + `background-position` | 0 依赖，不进 JS bundle |

---

## Common Pitfalls

### Pitfall 1：urlTransform 返回 null 不等于"不变"

**What goes wrong：** 开发者以为返回 `null` 等同于「保持原 URL 不变」，实际上 react-markdown 代码为 `String(value || '')` 处理输入但输出时直接设为 `null`，某些版本会渲染为 `href="null"` 字符串。

**Why it happens：** API 文档不够清晰；type 是 `string | null | undefined` 但行为等价于空串。

**How to avoid：** 危险协议一律 `return ''`（空串），不 return null。白名单函数返回原 `url` 字符串或 `''`，不返回 null。

**Warning signs：** 测试断言 `href` 不含 `javascript:` 能过，但 `href` 值为 `"null"` 字符串。

### Pitfall 2：思考气泡触发条件过宽，导致 soft-landing 时也显示

**What goes wrong：** `agentStatus === 'running'` 条件过宽——`soft-landing` 时 agentStatus 是 `'soft-landing'`，但若条件写成 `agentStatus !== 'idle'` 会在 soft-landing 时也触发（soft-landing 状态下已有 tool 卡，不需要 loading 气泡）。

**How to avoid：** 严格用 `agentStatus === 'running' || agentStatus === 'paused'`，不用 `!== 'idle'`（因为 soft-landing 也不是 idle）。

### Pitfall 3：DiffLogPanel 边界检测漏掉最后一条是 regularTool 的情况

**What goes wrong：** 如果一个 run 的最后一条消息是 regularTool（tool 折叠卡），它会进入 `toolRun` 数组，在后续 `flushToolRun()` 才渲染，此时边界检测已跳过该消息，DiffLogPanel 不会插入。

**How to avoid：** 在 `flushToolRun()` 函数内部，检查被 flush 的最后一条消息的 `agentRunId` 是否命中 `runLastIndex` Map，若是则在 flush 后立即插入 DiffLogPanel。

**Warning signs：** 当 run 的最后操作是 read/write tool 时，DiffLogPanel 仍然沉底。

### Pitfall 4：骨架屏 `prefers-color-scheme: dark` 与 Office 主题不一致

**What goes wrong：** 骨架屏使用系统 `prefers-color-scheme`，但 Office 宿主主题来自 `Office.context.officeTheme`，两者可能不一致（如系统 dark 但 Office 用 light 主题）。

**Why it happens：** 骨架屏在 Office.onReady 之前运行，此时无法读取 `Office.context`，只能用系统媒体查询近似。

**How to avoid：** D-18 已认可此局限——骨架屏只活几百毫秒，不一致是可接受的代价。代码注释需显式说明。

### Pitfall 5：completedRunIds 包含无写操作的 run，DiffLogPanel 插入时产生空白

**What goes wrong：** 所有 agent run（包括纯读或纯聊天的）都会进 `completedRunIds`。边界插入算法若在所有 run 的边界都插 DiffLogPanel，会产生大量空节点。

**How to avoid：** DiffLogPanel 内部已有守门（L211：`if (writeOps.length === 0) return null`）——Suspense fallback=null 会在 return null 时什么也不渲染。无需外部 length 检查，插入算法可对所有 `completedRunIds` 无条件插入，DiffLogPanel 自行隐形。

---

## Code Examples

### UI-01：safeUrlTransform 函数（抽 util）

```typescript
// src/utils/safeUrlTransform.ts
// [VERIFIED: 结合 react-markdown@9.1.0 node_modules 真实 API]

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/**
 * react-markdown urlTransform 回调——白名单放行，拦截危险协议。
 * 签名：(url: string, key: string, node: Element) => string
 * 作用于所有 URL 属性（href for a/area/link, src for img/video/iframe 等）。
 *
 * 危险协议（javascript:/data:/vbscript:/file:）→ 返回 '' → react-markdown 把属性设为 ''
 * → 链接退化为无 href 纯文本，不破坏可读性。
 */
export function safeUrlTransform(url: string): string {
  if (!url) return '';
  // 相对路径、锚点、协议相对 URL → 放行
  if (
    url.startsWith('#') ||
    url.startsWith('/') ||
    url.startsWith('./') ||
    url.startsWith('../') ||
    url.startsWith('//')
  ) {
    return url;
  }
  try {
    const { protocol } = new URL(url);
    return SAFE_PROTOCOLS.has(protocol) ? url : '';
  } catch {
    // URL 解析失败 → 可能是合法的相对路径或锚点（已上面处理），此处作保守放行
    return url;
  }
}
```

### UI-03：ChatStream nodes 循环改造示意

```typescript
// 改造后的 ChatStream 节点构建（示意，具体实现属 Claude's Discretion）
// 预处理：找每个 completedRunId 的最后消息 index
const completedRunSet = new Set(completedRunIds);
const runLastIndex = new Map<string, number>();
messages.forEach((m, i) => {
  if (m.agentRunId && completedRunSet.has(m.agentRunId)) {
    runLastIndex.set(m.agentRunId, i);
  }
});
const insertedRuns = new Set<string>();

// 辅助：flush 后检查是否需要插入 DiffLogPanel
const checkAndInsertDiffLog = (lastMsg: Message | undefined): void => {
  if (!lastMsg?.agentRunId) return;
  const rid = lastMsg.agentRunId;
  if (runLastIndex.get(rid) !== undefined && !insertedRuns.has(rid)) {
    // 还需确认当前 i 就是 lastIndex（这个检查在调用处）
    // 此处简化：调用方确保只在 lastIndex 时调用
    insertedRuns.add(rid);
    nodes.push(
      <Suspense key={`dlp-${rid}`} fallback={null}>
        <DiffLogPanel runId={rid} />
      </Suspense>
    );
  }
};

// 修改 flushToolRun
const flushToolRunWithDiffCheck = (afterIndex: number): void => {
  if (toolRun.length === 0) return;
  const lastInRun = toolRun[toolRun.length - 1];
  if (toolRun.length >= 2) {
    nodes.push(<MergedToolGroup key={`group-${toolRun[0].id}`} messages={toolRun} />);
  } else {
    for (const tm of toolRun) nodes.push(<ToolResultCard key={tm.id} message={tm} />);
  }
  // 检查 lastInRun 是否是某 runId 的最后消息
  if (lastInRun.agentRunId && runLastIndex.get(lastInRun.agentRunId) === afterIndex && !insertedRuns.has(lastInRun.agentRunId)) {
    insertedRuns.add(lastInRun.agentRunId);
    nodes.push(<Suspense key={`dlp-${lastInRun.agentRunId}`} fallback={null}><DiffLogPanel runId={lastInRun.agentRunId} /></Suspense>);
  }
  toolRun = [];
};
```

---

## Runtime State Inventory

> 本阶段是纯 UI 精修（非 rename/refactor/migration），跳过此节。

---

## Environment Availability

> 本阶段无外部服务依赖（仅改 React 组件 + CSS + HTML）。

| 工具 | 用途 | 可用 | 版本 |
|------|------|------|------|
| vitest | 测试运行 | ✓ | ^2.0.0（package.json） |
| jsdom | DOM 测试环境 | ✓ | ^29.1.1 |
| @testing-library/react | 组件渲染 | ✓ | ^16.3.2 |
| size-limit | bundle 体积守门 | ✓ | ^11.0.0（.size-limit.json: ≤82KB） |

---

## Validation Architecture

> nyquist_validation: true（config.json），必须包含此节。

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 2.x + @testing-library/react 16.x |
| Config file | `vitest.config.ts`（environment: 'jsdom', globals: true） |
| Quick run command | `vitest run --reporter=verbose src/utils/safeUrlTransform.test.ts src/components/ChatBubble.test.tsx` |
| Full suite command | `npm run test`（= tsc --noEmit && vitest run） |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | javascript: href 被拦截（返回 ''） | unit | `vitest run src/utils/safeUrlTransform.test.ts -t "javascript"` | ❌ Wave 0 新建 |
| UI-01 | data: URI href 被拦截 | unit | `vitest run src/utils/safeUrlTransform.test.ts -t "data:"` | ❌ Wave 0 新建 |
| UI-01 | https: href 放行（不误杀） | unit | `vitest run src/utils/safeUrlTransform.test.ts -t "https"` | ❌ Wave 0 新建 |
| UI-01 | img src javascript: 被拦截 | component-render | `vitest run src/components/ChatBubble.test.tsx -t "img src"` | ❌ Wave 0 新建 |
| UI-01 | ChatBubble 渲染后 DOM 无危险 href | component-render | `vitest run src/components/ChatBubble.test.tsx` | ❌ Wave 0 新建 |
| UI-02 | 发消息后、首 token 前出现 .bubble-typing | component-render | `vitest run src/components/ChatStream.test.tsx -t "typing"` | ❌ 扩展现有文件 |
| UI-02 | 首 token 到达后 .bubble-typing 消失 | component-render | `vitest run src/components/ChatStream.test.tsx -t "typing disappears"` | ❌ 扩展现有文件 |
| UI-02 | run 结束后无残留 .bubble-typing | component-render | `vitest run src/components/ChatStream.test.tsx -t "typing idle"` | ❌ 扩展现有文件 |
| UI-03 | 多 run 时 DiffLogPanel 紧跟对应 run 末尾 | component-render | `vitest run src/components/ChatStream.test.tsx -t "DiffLog boundary"` | ❌ 扩展现有文件 |
| UI-03 | 同 runId 只渲染一张 DiffLogPanel | component-render | `vitest run src/components/ChatStream.test.tsx -t "DiffLog dedup"` | ❌ 扩展现有文件 |
| UI-04 | 纯 CSS 改动，无 JS test（视觉回归手动） | manual / build | `npm run build && npm run size`（守 ≤82KB） | n/a |
| UI-05 | read 工具消息渲染卡含 --read 修饰类 | component-render | `vitest run src/components/ChatStream.test.tsx -t "read card"` | ❌ 扩展现有文件 |
| UI-05 | write 工具卡不含 --read 修饰类 | component-render | `vitest run src/components/ChatStream.test.tsx -t "write card"` | ❌ 扩展现有文件 |
| UI-05 | loop-helpers push tool 消息时 kind 字段写入 | unit | `vitest run src/agent/loop-helpers.test.ts -t "kind"` | ❌ 扩展现有文件 |
| UI-06 | index.html `#root` 含骨架 HTML + 内联 style | build artifact check | `grep 'sk-shimmer' dist/index.html` | n/a（构建后检查） |
| UI-06 | 骨架 CSS 含 prefers-reduced-motion | build artifact check | `grep 'prefers-reduced-motion' dist/index.html` | n/a |
| UI-06 | build 后 initial JS ≤82KB | build-size | `npm run build && npm run size` | ✅ 已有 CI guard |

### 安全测试重点（UI-01，P0）

UI-01 的测试 **必须** 覆盖 DOM-level 断言（不能只测函数返回值），需要在 jsdom 环境下渲染 ChatBubble 并 query DOM：

```typescript
// 测试模式（[VERIFIED: 已有 ChatStream.test.tsx 的 jsdom + testing-library 基础设施]）
import { render } from '@testing-library/react';
import ChatBubble from './ChatBubble';

const makeMsgWithContent = (content: string) =>
  ({ id: '1', role: 'assistant' as const, content, isStreaming: false });

it('UI-01-A: javascript: href 被拦截', () => {
  const { container } = render(
    <ChatBubble message={makeMsgWithContent('[点我](javascript:alert(1))')}
      onRetry={() => {}} onSettings={() => {}} />
  );
  const a = container.querySelector('a');
  expect(a?.getAttribute('href')).not.toMatch(/javascript:/i);
});

it('UI-01-C: https: href 保留（不误杀）', () => {
  const { container } = render(
    <ChatBubble message={makeMsgWithContent('[链接](https://example.com)')}
      onRetry={() => {}} onSettings={() => {}} />
  );
  const a = container.querySelector('a');
  expect(a?.getAttribute('href')).toBe('https://example.com');
});
```

**ChatBubble.test.tsx 需 mock `@lingui/react/macro`**（参照 ChatStream.test.tsx 的 mock 模式）。

### Sampling Rate

- **Per task commit（每次代码改动）：** `vitest run --reporter=dot`（快速全量）
- **Per wave merge：** `npm run test`（= typecheck + full vitest）
- **Phase gate（/gsd-verify-work 前）：** `npm run test && npm run build && npm run size`

### Wave 0 Gaps

- [ ] `src/utils/safeUrlTransform.test.ts` — 覆盖 UI-01（纯 unit，4 个核心用例）
- [ ] `src/components/ChatBubble.test.tsx` — 覆盖 UI-01 DOM-level 断言（5 个用例）
- [ ] `src/utils/safeUrlTransform.ts` — 实现文件本身（Wave 0 同步创建）
- [ ] ChatStream.test.tsx 扩展：UI-02/03/05 用例（追加到现有文件）
- [ ] loop-helpers.test.ts 扩展：kind 字段写入验证（追加到现有文件）

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `safeUrlTransform` 中 `new URL(url).protocol` 可正确识别 `javascript:` 等危险协议 | UI-01 Code Example | 如果 URL 构造函数在某些 URL 格式下抛出或行为异常，防御可能失效——需 RED→GREEN 测试覆盖 |
| A2 | DiffLogPanel 边界插入算法（示意代码）能正确处理「最后一条是 regularTool」的边缘情况 | UI-03 Code Example | 算法细节属 Claude's Discretion，示意代码可能需调整——planner 应指示实现者补全边缘测试 |
| A3 | 骨架屏内联 CSS 中 `#f3f2ee` / `#eeeef0` / `#0e0e10` / `#1f1f21` 等灰值在真机上视觉效果可接受 | UI-06 Code Example | light/dark 颜色选取基于 styles.css token 反推，未真机 UAT——用户复核 D-19 时可调整 |
| A4 | `completedRunIds.includes(m.agentRunId)` 的 O(n×m) 查找在实际消息量下性能可接受 | UI-03 Architecture | 单次会话消息量通常 < 200 条，completedRunIds < 20，O(4000) 比较可忽略——转为 Set 查找更优 |

---

## Open Questions

1. **UI-04 宽表横向滚动方案**
   - What we know: remark-gfm 生成的 `<table>` 无外层容器，直接在 `.bubble-ai` 内
   - What's unclear: 给 `table { display: block; overflow-x: auto }` 是否影响 `border-collapse` 展示（block display 可能影响表格布局）
   - Recommendation: 实现时测试 `display: block + overflow-x:auto` vs 外层 wrapper div，选渲染效果好的

2. **UI-02 paused 状态下是否显示思考气泡**
   - What we know: D-06 条件包含 `agentStatus === 'paused'`
   - What's unclear: paused 时 isStreaming 是否依然 true（loop-helpers pause 不 abort controller，in-flight tool 继续跑）
   - Recommendation: 实现时用实际 paused 路径测试，若 paused 时 assistant 消息 isStreaming 已 false 则条件自然不满足

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation (Output Encoding) | **YES** | `safeUrlTransform` allowlist + react-markdown 默认禁 raw HTML |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `javascript:` href in LLM output | Tampering / Elevation | `safeUrlTransform` 返回 `''` → href 为空 → 无跳转 |
| `data:text/html;base64,` URI | Tampering / Info Disclosure | 同上，`data:` 不在 SAFE_PROTOCOLS |
| `vbscript:` (IE-class) | Tampering | 同上 |
| LLM prompt injection via href text | Tampering | react-markdown 默认不渲染 raw HTML（`skipHtml` 默认 false 但 GFM raw HTML 限制）；href 内容只影响属性值，不影响 DOM 结构 |

**CVE-2025-24981 类别：** 攻击向量是 LLM 生成含 `javascript:` href 的 Markdown 链接，用户点击时在 TaskPane webview 中执行任意 JS（可读取 RoamingSettings / localStorage 中的 API Key）。`urlTransform` 返回 `''` 直接从根本上切断这条攻击链。

---

## Sources

### Primary (HIGH confidence)
- `node_modules/react-markdown/lib/index.js` — urlTransform 调用逻辑、defaultUrlTransform 实现、safeProtocol 定义 [VERIFIED: node_modules]
- `node_modules/react-markdown/lib/index.d.ts` — UrlTransform 类型签名 `(url: string, key: string, node: Readonly<Element>) => string | null | undefined` [VERIFIED: node_modules]
- `node_modules/html-url-attributes/index.js` — urlAttributes 映射（确认 href/src 均在作用域） [VERIFIED: node_modules]
- `src/agent/loop-helpers.ts` — streamAssistantTurn push 行为（L77-81）、runOneToolCall def 解析点（L143）、push tool 消息点（L149-152） [VERIFIED: codebase]
- `src/components/ChatBubble.tsx` — 空 content return null（L79-81）、ReactMarkdown 现无 urlTransform [VERIFIED: codebase]
- `src/components/ChatStream.tsx` — DiffLogPanel 底部渲染位置（L402-406）、nodes 构建循环（L362-395）、flushToolRun 函数 [VERIFIED: codebase]
- `src/agent/agentStore.ts` — AgentStatus 枚举（L26）、beginRun 立即置 running（L88-101）、completedRunIds 追加时机 [VERIFIED: codebase]
- `src/agent/tools/index.ts` — ToolDef.kind 字段（L74）[VERIFIED: codebase]
- `src/store/chat.ts` — Message 接口（L43-63）[VERIFIED: codebase]
- `index.html` — `#root` 当前为空 [VERIFIED: codebase]
- `src/main.tsx` — Office.onReady 异步流程 + createRoot 覆盖时机（L50-94）[VERIFIED: codebase]
- `src/styles.css` — 现有 `.bubble-ai` 规则（L727-750）、CSS 变量定义（L44-101）[VERIFIED: codebase]
- `package.json` — react-markdown ^9.0.0、vitest ^2.0.0、@testing-library/react ^16.3.2 [VERIFIED: codebase]
- `.size-limit.json` — `initial-js ≤ 82 KB gzip` [VERIFIED: codebase]
- `vitest.config.ts` — environment: 'jsdom', globals: true [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- `src/components/ChatStream.test.tsx` — 现有测试基础设施（jsdom mock 模式、store 重置、vi.mock 用法）[VERIFIED: codebase]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 全部 node_modules 真实版本验证
- Architecture Patterns: HIGH — 逐行 codebase 阅读，关键路径全部确认
- Pitfalls: HIGH — 基于真实代码推断，非假设
- UI-06 具体 px 值: MEDIUM — 基于 styles.css token 反推，需用户 UAT 确认

**Research date:** 2026-05-31
**Valid until:** 2026-06-28（30 天，设计系统已冻结，变化风险低）
