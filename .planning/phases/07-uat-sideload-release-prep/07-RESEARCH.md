# Phase 7: UAT + Sideload Release Prep — Research

**Researched:** 2026-05-30
**Domain:** Office.js Add-in UAT 验证 + tool-call 兼容性探针 + README 重写 + 开源发布
**Confidence:** HIGH（代码已全部可读；CONTEXT.md 极详细，锁定所有关键决策）

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**A. A-21 model 兼容性「测试 tool calling」按钮 + 拦截 UX**
- D-01: 「测试 tool calling」按钮放在 `ProviderForm.tsx`（Provider 编辑表单内）
- D-02: Pre-flight 拦截——启动 agent run 前，若 `supportsToolCall === false`，直接弹明确错误「当前 Provider/Model 不支持 tool calling，请切到 DeepSeek-V4 或 gpt-5.1」，不发起 LLM call
- D-03: 内置 model（BUILTIN_MODEL_OPTIONS 清单内）hardcode `supportsToolCall=true`，跳过测试；只对自定义 Provider / 手填 model 真机测一遍
- D-04: 测试结果呈现 = Provider 列表行 badge（✓支持 / ✗不支持 / 未测）+ 点测试时 inline loading→结果状态，复用现有 badge 体系
- D-05: 测试探针 = 复用 `openai-compat` 发最简 dummy tool call，看 `finish_reason`/error 判定；结果写回 `setSupportsToolCall`

**B. README 重写范围**
- D-06: 定位主轴全面转「Office 智能代理」，拿掉旧「一键文档操作 + 多轮聊天」提法
- D-07: 含 4 killer scenario 具体输入示例 + 「Aster 怎么工作」心智锚定段
- D-08: 截图/GIF = 文字为主 + UAT 顺手截 2-3 张关键图（agent 跑完汇报 / DiffLogPanel）
- D-09: 产品口径 = 诚实写「作者自用 + 开源，早期阶段」
- D-10: 既定事实纠正：Fluent UI → 自写 CSS；bundle 改实测值；删 REL-01/REL-03/REL-04/NFR-06 幻影引用；删草稿 banner；保留 N5 一句话隐私告知

**C. UAT 执行**
- D-11: Claude 备清单 + 自跑非真机门禁；用户跑 4 killer scenario 真机
- D-12: 浏览器矩阵放宽 = **Chrome only（最新版），去掉 Edge**；ROADMAP SC1/SC4 措辞须同步更新
- D-13: Windows 桌面端不进 Phase 7，保持 FUT-10/v1.1
- D-14: 证据格式 = 步数 + 端到端耗时 + DiffLogPanel 截图（每 scenario）
- D-15: PASS 标准 = 允许修复迭代（发现 bug → 当场修 → 重测）
- D-16: UAT 报告不出现 ¥；清 ROADMAP 残留 ¥（Phase 6 SC1/2/3 + Phase 7 SC1）

**D. 性能复盘（NFR-03）**
- D-17: P95 单 LLM step ≤ 10s / 首 token ≤ 2s = 真机 UAT 肉眼观察，必要时加临时 `performance.now()` 日志（不进生产）；bundle ≤1MB 靠现有 CI size-limit gate

### Claude's Discretion
- A-21 测试探针的具体 tool schema、超时时长、错误文案细节
- README 章节顺序、措辞、具体示例 prompt 文案
- UAT 清单的具体颗粒度、计时日志实现

### Deferred Ideas (OUT OF SCOPE)
- 英文 i18n（FUT-09）
- Windows Office Desktop 同 manifest 验证（FUT-10）
- DeepSeek thinking mode 调优 Settings（FUT-12）
- Per-action consent（永不做）
- AppSource 商店上架
- PRIVACY.md / 完整隐私政策
- 完整 GIF 演示
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ERR-04 | 「Agent gave up」UX — 强制 abort 后红色卡片说明「试了 X 次都失败，建议 Y」 | Phase 4 已完成（ERR-04 Complete）；Phase 7 验证 UAT 4 个 scenario 中 circuit breaker 正确触发，非新实现 |
| NFR-01 | 跨平台 API 子集 — 只用 Office.js Web/Windows 共同支持的 API | Web 三宿主真机 UAT 验证（Chrome）；现有代码库已全部走 Web/Windows 共同子集 |
| NFR-03 | 性能 P95 单 LLM step ≤ 10s / 首 token ≤ 2s | 真机 UAT 肉眼观察 + 可选临时 `performance.now()` 日志；非新实现 |
| NFR-04 | API Key 永不上传 Aster 自有服务器 | 架构验证（代码审查确认 Key 只在 localStorage + 直连 Provider）；README 中明文描述 |
| NFR-05 | CI bundle-size gate 维持 1MB 上限；超出阻断 merge | 已 Complete；`.size-limit.json` 配置 `82 KB` 门禁；`npm run size` 自跑验证 |
</phase_requirements>

---

## Summary

Phase 7 是验证和发布阶段，**唯一真正的新代码是 A-21**（测试 tool calling 按钮 + pre-flight 拦截）。其余工作是 UAT 执行、README 重写、sideload 验证、发布。

代码库已经为 A-21 铺好了 3/4 的地基：`supportsToolCall` 字段在 `ProviderConfig`（`types.ts:131`）、被动探测逻辑在 `openai-compat.ts`（56-68 行）、`setSupportsToolCall` 写回 action 在 `providers.ts`（185-191 行）。Phase 7 只需补：主动测试探针（按钮触发的 dummy tool call）、pre-flight 拦截（agentStore.runAgent 入口前读 `supportsToolCall`）、badge 呈现（ProviderList.tsx 复用现有 badge-accent/success 体系）。

sideload 验证 = 确认 GitHub Pages 已部署最新 build + Chrome 三宿主能正常上传 manifest + Task Pane 渲染正确。manifest.xml 已就绪（三宿主 Host、shared runtime、GitHub Pages URL）。

README 重写是创作任务：从 113 行过时初稿（Phase 1 写，提及 Fluent UI、138KB、旧幻影需求、草稿 banner）重写为代理定位、4 killer scenario、BYO Key 架构说明、准确技术栈描述。

**Primary recommendation:** 严格按 CONTEXT.md D-01~D-17 执行，代码量极少，主要工作在 UAT 执行和文档创作。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| A-21 测试按钮 UI | Browser / Client (Task Pane) | — | ProviderForm.tsx 是纯 React 组件，在 webview 中跑 |
| A-21 dummy tool call 探针 | Browser / Client (fetch) | — | 无后台，浏览器直连 Provider API |
| A-21 pre-flight 拦截 | Browser / Client (Zustand) | — | agentStore.runAgent 入口读 providerStore |
| A-21 badge 呈现 | Browser / Client (React) | — | ProviderList.tsx 读 Zustand state |
| UAT 执行 | User (Real Machine) | Claude (清单备注) | 真机 Office for Web 必须用户操作 |
| README 重写 | Static Files (git) | — | 纯文档 commit，触发 Pages 部署 |
| sideload 验证 | Browser / Client + User | — | 用户在 Chrome 上传 manifest |
| bundle size 验证 | CI / Local (npm run size) | — | size-limit 读 dist/ gzip 值 |

---

## Standard Stack

### Core（已就位，Phase 7 零新增运行时依赖）

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | `^19` | Task Pane UI | 项目基座 [VERIFIED: package.json] |
| Zustand | `^5.0.0` | Provider state + A-21 状态 | 项目基座 [VERIFIED: package.json] |
| TypeScript | `^5.7.0` | 强类型 | 项目基座 [VERIFIED: package.json] |
| Vitest | `^2.0.0` | 单元/集成测试 | 项目基座 [VERIFIED: package.json] |
| size-limit | `^11.0.0` | bundle gate | 已配置 82KB 上限 [VERIFIED: .size-limit.json] |

### Phase 7 不新增任何运行时依赖
[VERIFIED: CONTEXT.md + CLAUDE.md 硬约束：0 净新增运行时依赖]

---

## Architecture Patterns

### A-21 test-probe 实现方案（代码地图）

```
ProviderForm.tsx（按钮触发）
  ↓ 调用
probeToolCallSupport(config: LLMConfig) → Promise<boolean>
  ↓ 内部
  OpenAICompatibleLLM.streamChat(
    messages=[{role:'user', content:'ping'}],
    config,
    signal,
    tools=[{ type:'function', function:{ name:'ping', description:'ping', parameters:{type:'object', properties:{}} }}]
  )
  ↓ 看结果
  if (finish_reason === 'tool_calls') → true
  if (4xx + tool关键词) → false（被动探测已有）
  if (finish_reason === 'stop' && no tool_calls) → false（不支持）
  ↓ 写回
  useProviderStore.getState().setSupportsToolCall(providerId, result)
```

**关键：probeToolCallSupport 是新建的纯函数，不是修改现有路径。**

### pre-flight 拦截挂载点

```
src/store/chat.ts → sendMessage()
  → useAgentStore.getState().runAgent(...)
      ↑ 在此处或 runAgent 函数体最开始插入 pre-flight check：

agentStore.runAgent(prompt, selectionCtx, adapter):
  1. 读取 currentProvider = providerStore.providers.find(defaultLLMProviderId)
  2. if (currentProvider?.supportsToolCall === false):
       push error message「当前 Provider/Model 不支持 tool calling，请切到 DeepSeek-V4 或 gpt-5.1」
       return（不 beginRun，不发任何 LLM call）
  3. 否则走正常 beginRun → loop
```

**注意：** `supportsToolCall === null` 或 `undefined`（未测试）= 放行，不拦截。只有明确 `=== false` 才拦截。这与现有 `shouldAttachTools` 逻辑一致（`me?.supportsToolCall !== false`）。

### badge 状态 → CSS 映射（复用现有 ProviderList.tsx 体系）

| supportsToolCall 值 | badge 文字 | badge 类名 |
|--------------------|-----------|-----------|
| `undefined` / `null` | 未测试 | `badge`（默认灰） |
| `true` | ✓ 支持 tool call | `badge badge-success`（绿） |
| `false` | ✗ 不支持 | `badge badge-accent` 或新增 `badge-error`（红/橙） |

[VERIFIED: ProviderList.tsx 现有 badge-accent / badge-success / badge 三种类名]

### probe 的最简 dummy tool schema

```typescript
// Claude's Discretion 区域，但以下是 research 推荐：
const PROBE_TOOL: OpenAIToolWire = {
  type: 'function',
  function: {
    name: 'aster_ping',
    description: 'Aster compatibility probe. Call this tool immediately.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

const PROBE_MESSAGES = [
  { role: 'user' as const, content: 'Call the aster_ping tool now.' }
];
// stream: false（或者 stream:true 读第一个 finish_reason chunk 即可中止）
// AbortController timeout: 10 秒
```

**判定逻辑：**
- 收到 `finish_reason: 'tool_calls'` → `true`
- 收到 4xx 错误 + body 含 `tool|function|not supported` 关键词 → `false`（现有被动探测已覆盖）
- 收到 `finish_reason: 'stop'`，但 message 无 `tool_calls` → `false`（不支持 tool calling）
- 超时 10s → 不写回（视为网络问题，不影响 `supportsToolCall` 现有状态）

[ASSUMED: `finish_reason: 'stop'` 无 tool_calls = 不支持，这是 OpenAI-compat 行为的推论，未对所有 Provider 逐一验证]

### D-03 内置 model 跳过探测的实现

```typescript
// 在「测试」按钮渲染逻辑中：
const isBuiltInModel = provider?.isBuiltIn ?? false;
// 内置 model hardcode supportsToolCall=true，按钮对内置 Provider 不显示
// 或显示为 disabled + 「内置 Provider 默认支持」提示
```

[VERIFIED: BUILTIN_MODEL_OPTIONS = { deepseek: [...], aihubmix: [...] }，这两个 isBuiltIn=true 的 Provider 都在清单内]

---

## Office for Web Sideload 验证机制

### 实际步骤（Chrome，三宿主）

1. 访问 office.com，用 Microsoft 个人账号登录
2. 打开对应宿主文档（PowerPoint / Excel / Word）
3. 点击「开始」标签 → 加载项 → 更多加载项（或「上传我的加载项」）
4. 上传 `manifest.xml`（从本地文件或 GitHub raw URL 下载）
5. 验证 Task Pane 渲染正确、Aster 按钮出现在 Ribbon

[VERIFIED: manifest.xml 现状 — 三宿主 Host 全配、shared runtime、SourceLocation = https://wynne-cwb.github.io/Aster/]

### 关键陷阱（已知问题）

**陷阱 1：缓存 vs 实际部署**

GitHub Pages 缓存 CDN 可能让浏览器拿到旧版本。验证时须：
- 强制刷新 Task Pane（Ctrl+Shift+R 或清浏览器缓存）
- 检查 Task Pane 的 JS 文件 hash（Network 面板 → main-*.js 的 URL）
- 与最新 `git push` 后 Pages 部署的 hash 对比

**陷阱 2：sideload 作用域**

sideload 的加载项绑定到「同一浏览器 profile + 同一个人账号」。换 profile 或无痕模式需重新 sideload。Phase 7 UAT 用全新 profile（D-12 要求）。

**陷阱 3：AppDomains 缺失**

manifest.xml 已声明 `deepseek.com` 和 `aihubmix.com`，用户自定义 Provider 的域名**不在 AppDomains**。这意味着：自定义 Provider 的 CORS 请求在 Web Add-in 的 shared runtime 中可能被拦截（Office for Web 的 iframe sandbox 规则）。

**当前 manifest.xml 的局限（已知，记录供 planner 注意）：**
- 内置两个 AppDomain：`https://api.deepseek.com` 和 `https://api.aihubmix.com`
- 用户如果填了第三方自定义 Provider（如 openrouter.ai），理论上需要在 manifest 中加 AppDomain，否则 CORS 请求可能失败
- **Phase 7 scope：验证内置 Provider（DeepSeek + AiHubMix）正常；自定义 Provider CORS 限制属已知约束，不是 Phase 7 要修的**

[ASSUMED: Office for Web shared runtime 的 CORS 规则与普通 iframe 相近；AppDomains 缺失是否真的拦截依赖实际测试]

**陷阱 4：manifest Version 字段**

Office 对 Version 字段有要求（`1.0.0.0` 格式）。当前 manifest.xml 已是 `1.0.0.0`，无需改。

**陷阱 5：Pages 部署延迟**

`git push` 触发 Pages 部署通常需 30-90 秒。UAT 前确认 Pages 部署状态（GitHub Actions badge 或直接访问 https://wynne-cwb.github.io/Aster/ 检查 JS hash）。

[VERIFIED: manifest.xml SourceLocation = https://wynne-cwb.github.io/Aster/ 对应 GitHub Pages 部署]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tool call 探针 | 自己写 fetch | 复用 `OpenAICompatibleLLM.streamChat` | 现有路径已处理 CORS、retry、singleFlight、error 包装 |
| badge 状态 | 新增 badge 组件库 | 复用 `ProviderList.tsx` 现有 `badge / badge-success / badge-accent` CSS | 已有三种 className，只是加新状态映射 |
| 错误文案 | 随意自造 | 遵循现有 `{code, message, hint}` 结构 + CONTEXT.md 指定文案 | 一致性；D-02 已锁定文案 |
| Performance 监测 | 引入 monitoring SDK | `performance.now()` 临时日志（dev-only） | 生产不需要，UAT 肉眼即可，D-17 决策 |

---

## Common Pitfalls

### Pitfall 1：A-21 探针把内置 Provider 也测了

**What goes wrong:** 按钮对 DeepSeek/AiHubMix 内置 model 显示并可点，浪费 API 调用
**Why it happens:** 没按 D-03 区分 `isBuiltIn`
**How to avoid:** 测试按钮仅对 `!isBuiltIn` 的 Provider（或内置 Provider 但用了清单外的 model）显示；内置 Provider 改 model 时若 model 在 BUILTIN_MODEL_OPTIONS 清单内也跳过
**Warning signs:** 按钮在 DeepSeek 编辑表单内可见

### Pitfall 2：pre-flight 拦截未消耗 `undefined` 状态

**What goes wrong:** `supportsToolCall === undefined`（新建自定义 Provider 未测试）被误判为 false 而拦截
**Why it happens:** 条件写成 `!supportsToolCall` 而非 `=== false`
**How to avoid:** 严格用 `supportsToolCall === false` 才拦截
**Warning signs:** 新建自定义 Provider 第一次跑 agent 就被拦截

### Pitfall 3：ROADMAP ¥ 残留未清

**What goes wrong:** Phase 6 SC1/SC2/SC3 仍有 `¥ <3` 等字段；Phase 7 SC1 仍有 cost 验收指标
**Why it happens:** D-16 要求清除但是文档更新漏掉
**How to avoid:** planner 明确一个 plan 专门处理文档残留（ROADMAP + README）

### Pitfall 4：README 仍引用 REL-01/REL-03/REL-04/NFR-06

**What goes wrong:** 开源仓库 README 引用不存在的需求编号（v2.0 REQUIREMENTS.md 里没有这些 ID）
**Why it happens:** README 是 Phase 1 初稿，引用了 v1.0 旧编号
**How to avoid:** D-10 明确删除这些幻影引用

### Pitfall 5：sideload 后 Task Pane 渲染旧版本

**What goes wrong:** Pages 刚部署完，浏览器缓存还是旧 JS，用户测到旧功能
**How to avoid:** UAT 清单里明确「先清缓存/强制刷新 Task Pane，再验 JS hash」

### Pitfall 6：probe 请求 body 含 `stream: true` 导致超时不易判断

**What goes wrong:** SSE stream 不自动关闭，probe 需要手动 abort 或检测特定 chunk
**How to avoid:** probe 可以用 `stream: false`（普通 JSON response）或者 `stream: true` 但收到第一个 `finish_reason` 后立即 AbortController.abort()

---

## Code Examples

### A-21 probe 函数骨架

```typescript
// src/providers/probeToolCall.ts（新建）
// Source: 基于 openai-compat.ts 现有模式推导 [VERIFIED: openai-compat.ts]

import type { LLMConfig } from './types';
import { OpenAICompatibleLLM } from './openai-compat';
import { useProviderStore } from '../store/providers';

const PROBE_TOOL = {
  type: 'function' as const,
  function: {
    name: 'aster_ping',
    description: 'Aster compatibility probe. Call this function immediately.',
    parameters: { type: 'object', properties: {} },
  },
};

export async function probeToolCallSupport(
  config: LLMConfig,
): Promise<boolean | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000); // 10s timeout

  try {
    const llm = new OpenAICompatibleLLM();
    const gen = llm.streamChat(
      [{ role: 'user', content: 'Call the aster_ping tool now.' }],
      config,
      controller.signal,
      [PROBE_TOOL],
    );

    for await (const event of gen) {
      // 看到 tool_calls delta = 支持
      if (event.type === 'delta' && event.toolCalls?.length) {
        return true;
      }
      // 看到 finish_reason = tool_calls
      if (event.type === 'finish' && event.finishReason === 'tool_calls') {
        return true;
      }
      // 看到 finish_reason = stop 但无 tool_calls = 不支持
      if (event.type === 'finish' && event.finishReason === 'stop') {
        return false;
      }
    }
    return false;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return null; // 超时，不写回
    }
    // 4xx 带 tool 关键词：openai-compat 被动探测已写回 false，这里也返回 false
    return false;
  } finally {
    clearTimeout(timer);
  }
}
```

**注意：** `SSEEvent` 的 `type` 枚举需对照 `src/lib/sse.ts` 实际定义，上面 `delta/finish/toolCalls` 字段名是推导，executor 需核对真实接口。[ASSUMED: SSEEvent 有 type 区分字段]

### pre-flight 拦截挂入点

```typescript
// src/agent/agentStore.ts — runAgent 方法开头插入
async runAgent(prompt, selectionCtx, adapter) {
  // A-21 pre-flight：supportsToolCall===false 才拦截（null/undefined 放行）
  const providerStore = useProviderStore.getState();
  const currentProvider = providerStore.providers.find(
    (p) => p.id === providerStore.defaultLLMProviderId
  );
  if (currentProvider?.supportsToolCall === false) {
    useChatStore.getState().pushMessage({
      role: 'error',
      content: '当前 Provider/Model 不支持 tool calling，请切到 DeepSeek-V4 或 gpt-5.1',
      errorCode: 'UNSUPPORTED',
    });
    return; // 不 beginRun，不发 LLM call
  }

  const runId = crypto.randomUUID();
  const controller = get().beginRun(runId);
  // ... 后续正常流程
}
```

[VERIFIED: agentStore.ts runAgent 的完整实现在 agentStore.ts:175-188]

### ProviderForm 测试按钮 UI 骨架

```tsx
// 在 ProviderForm.tsx model 字段之后、apiKey 之前插入
{!isBuiltIn && (
  <div className="aster-form-field">
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={handleTestToolCall}
      disabled={testState === 'loading' || !apiKey.trim()}
    >
      {testState === 'loading' ? '测试中...' : '测试 tool calling'}
    </button>
    {testState === 'supported' && (
      <span className="badge badge-success">✓ 支持</span>
    )}
    {testState === 'unsupported' && (
      <span className="badge badge-accent">✗ 不支持</span>
    )}
  </div>
)}
```

[VERIFIED: 按钮 className 来自 ProviderForm.tsx 现有 btn/btn-ghost/btn-sm 体系]

---

## README 重写内容框架（D-06~D-10）

### 应包含的章节（planner 参考）

1. **Hero / 一句话定位**（代理定位）：「Aster 是原生 Office 里的 AI 代理——你说一句话，它自主完成多步文档任务，边跑边让你看到进度，随时可以暂停、撤回」

2. **Aster 怎么工作**（心智锚定）：用流程图 or 纯文字说明「输入 → 多步 LLM + Office 操作循环 → diff log 汇报 → undo all 兜底」

3. **4 Killer Scenarios**（含具体输入示例）：
   - PPT: 「帮我做一份『Q3 销售复盘』PPT，给 leadership 看，重点华东」
   - Excel: 「清洗这份数据，看哪个产品卖得最好，做个图，给我三句话洞察」
   - Word: 「整篇润色，把口语化改成正式书面，顺便检查逻辑顺序」
   - PPT shape: 「把左下角那张图改成红色边框，然后右移 10 px」

4. **BYO Key / 无后台说明**（保留现有准确内容）

5. **Sideload 步骤**（Chrome only，三宿主；更新浏览器矩阵为 Chrome only，符合 D-12）

6. **技术架构概览**（更新事实）：
   - UI: 自写 CSS 设计系统（teal 克制）— 删 Fluent UI 引用
   - Bundle: 实测 ~73 KB gzip（重写时以最新 `npm run build && npm run size` 为准）

7. **诚实产品口径**（D-09）：「作者自用 + 开源，早期阶段；BYO Key 由用户自负责」

8. **N5 一句话隐私告知**：「选中内容会发往您配置的 AI Provider，不经过 Aster 服务器」

9. **开发**（保留现有 `npm ci / npm run dev / npm run build / npm test / npm run size`）

### 必须删除的内容

- 文件顶部「草稿状态」banner
- 底部「将在 Phase 7 REL-01/REL-03/REL-04 补全」footer
- 「sideload 视频/GIF 待补」承诺
- REL-01 / REL-03 / REL-04 / NFR-06 任何引用（这些在 v2.0 REQUIREMENTS.md 不存在）
- 「Fluent UI React v9」提法（已迁移到自写 CSS）
- bundle「约 138 KB gzip」（已是 ~73 KB）
- 浏览器矩阵从「Edge + Chrome 最新两版」改为「Chrome（最新版）」

[VERIFIED: 现有 README.md = 113 行，Phase 1 初稿，包含上述全部需删除内容]

---

## ROADMAP 文档残留修正清单（planner 必须处理）

以下 ROADMAP.md 措辞与 CONTEXT.md 决策不一致，planner 须在某个 plan 中一并修正：

| 位置 | 当前措辞 | 应改为 |
|------|---------|--------|
| Phase 7 SC1 | 「Edge + Chrome 最新两版 × 全新 profile」 | 「Chrome（最新版）× 全新 profile」 |
| Phase 7 SC4 | 「sideload manifest 在 Office for Web Edge/Chrome × 三宿主」 | 「Office for Web Chrome × 三宿主」 |
| Phase 7 SC3 | 「gpt-4o」 | 「gpt-5.1」 |
| Phase 6 SC1 | 「¥ <3」 | 删除 ¥ 提法，改「步数 + 耗时」 |
| Phase 6 SC2 | 「¥ <1.5」 | 删除 ¥ 提法 |
| Phase 6 SC3 | 「¥ <2」 | 删除 ¥ 提法 |
| Phase 7 SC1 | cost 相关验收标准 | 改为「步数 + 端到端耗时 + DiffLogPanel 截图」 |
| REQUIREMENTS.md Traceability | ERR-04 Phase = 4, Status = Complete | 正确（UAT 是验证不是实现，不用改） |

---

## Performance Verification (NFR-03) 方案

**肉眼观察基准：**
- P95 单 LLM step ≤ 10s：从 AgentControlBar 步进到下一步，观察时间戳变化
- 首 token ≤ 2s：从用户按 Send 到 Task Pane 出现第一个 streaming token，秒表计时

**可选 dev-only 计时日志（Claude's Discretion）：**
```typescript
// 在 loop.ts 的 step 开始前（开发模式）
if (import.meta.env.DEV) {
  console.time(`step-${stepNum}`);
}
// step 完成后
if (import.meta.env.DEV) {
  console.timeEnd(`step-${stepNum}`);
}
```
- `import.meta.env.DEV` 由 Vite 在 production build 中 tree-shake 掉 [VERIFIED: Vite 7 标准行为]
- 不引入任何新依赖，不影响 bundle size

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `SSEEvent` 有 `type: 'delta' \| 'finish'` 和 `finishReason` 字段（用于 probe 判定） | Code Examples (probe 函数) | probe 函数需对照 `src/lib/sse.ts` 真实接口调整；不影响整体方案 |
| A2 | `finish_reason: 'stop'` 且无 `tool_calls` = Provider 不支持 tool calling | A-21 probe 判定逻辑 | 某些 Provider 可能返回不同的 finish_reason；executor 需真机测试验证 |
| A3 | Office for Web shared runtime 中 AppDomains 缺失确实会拦截用户自定义 Provider 的 CORS 请求 | sideload 陷阱 3 | 如果不拦截，则自定义 Provider 测试比预期更顺畅；若拦截，需告知用户这是已知限制 |

---

## Open Questions

1. **probe 函数复用 `streamSSE` 还是用 `fetch` 直连？**
   - What we know: `OpenAICompatibleLLM.streamChat` 封装了 singleFlight + withRetry，probe 不需要这些（一次性）
   - What's unclear: 直接调 `streamSSE` 或者 `fetch` 是否更干净
   - Recommendation: 调 `OpenAICompatibleLLM.streamChat` 最省事（复用所有错误处理），probe 本身加 10s AbortController 超时即可

2. **`badge-error` 是否存在于 styles.css？**
   - What we know: `ProviderList.tsx` 现有 `badge / badge-success / badge-accent` 三种
   - What's unclear: `badge-error`（红色）是否已定义
   - Recommendation: 如果不存在，复用 `badge-accent`（橙/teal）表示「不支持」，或 planner 在 styles.css 新增 `badge-error` CSS 变量

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Chrome（最新版）| UAT D-12 | ✓ | 用户自备 | — |
| GitHub Pages | sideload + 发布 | ✓ | 已部署 `wynne-cwb.github.io/Aster/` | — |
| `npm run build` | bundle 验证 | ✓ | Vite 7 | — |
| `npm run size` | NFR-05 gate | ✓ | size-limit 11 | — |
| `npm test` | vitest 门禁 | ✓ | vitest 2 | — |
| DeepSeek API Key | A-21 probe 测试 | ✓ | 用 `.env.local` 提供 | — |
| AiHubMix API Key | A-21 probe 测试 | ✓ | 用 `.env.local` 提供 | — |

**Missing dependencies with no fallback:** 无

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x |
| Config file | `vite.config.ts`（vitest 默认配置，无独立 vitest.config.ts）|
| Quick run command | `npm run test:unit` |
| Full suite command | `npm test`（含 `tsc --noEmit && vitest run`）|

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NFR-05 | CI bundle gate ≤82KB | bundle | `npm run build && npm run size` | ✅ `.size-limit.json` |
| NFR-04 | Key 不上传 Aster 服务器 | 代码审查 + 架构验证 | `grep -r "aster.*server\|aster.*api" src/ --include="*.ts"` | ✅（无服务器 URL）|
| NFR-03 | P95 ≤10s / 首 token ≤2s | manual-only（真机肉眼）| — | manual only |
| NFR-01 | 只用 Web/Windows 共同 API 子集 | manual-only（真机三宿主 UAT）| — | manual only |
| ERR-04 | Agent gave up 红卡 UX | manual-only（UAT 验证现有实现）| — | manual only |
| A-21 probe 函数 | `probeToolCallSupport` 返回正确结果 | unit | `npm run test:unit -- src/providers/probeToolCall.test.ts` | ❌ Wave 0 |
| A-21 pre-flight | `supportsToolCall===false` 时拒绝 runAgent | unit | `npm run test:unit -- src/agent/agentStore.test.ts` | ✅（需补新 case）|
| A-21 内置跳过 | isBuiltIn model 不显示/触发 probe | unit | `npm run test:unit -- src/components/Settings/ProviderForm.test.tsx` | ✅（需补新 case）|
| README 事实 | bundle 数值、技术栈、删除幻影引用 | manual-only（人工核对）| — | manual only |
| Sideload 三宿主 | manifest 上传 + Task Pane 渲染 | manual-only（真机）| — | manual only |

### Sampling Rate

- **Per task commit:** `npm run test:unit`（vitest run）
- **Per wave merge:** `npm test`（tsc + vitest run）
- **Phase gate:** `npm test` 全绿 + `npm run build && npm run size` 通过（≤82KB）→ 再进真机 UAT

### Wave 0 Gaps

- [ ] `src/providers/probeToolCall.ts` — A-21 probe 函数实现
- [ ] `src/providers/probeToolCall.test.ts` — probe 函数单测（mock openai-compat；验证 true/false/null 三态）
- [ ] `src/agent/agentStore.test.ts` 补充 case — `supportsToolCall===false` 时 runAgent 推 error message 并 return
- [ ] `src/components/Settings/ProviderForm.test.tsx` 补充 case — 测试按钮仅对非内置 Provider 显示

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes（probe 的 baseURL 须是 https://）| 现有 ProviderForm validate() 已守门 |
| V6 Cryptography | no | — |

### Known Threat Patterns（Phase 7 相关）

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| probe 时 apiKey 泄露进 error.message | Information Disclosure | openai-compat 现有 G-07：Key 不进 error.message（T-01-04 约束）|
| probe 发向用户伪造的 baseURL（SSRF 变体）| Tampering | ProviderForm 已做 `https://` 前缀校验 |
| README 中过度承诺隐私保护 | Trust | D-09 要求诚实口径；N5 一句话告知 |

---

## Sources

### Primary (HIGH confidence)

- `src/providers/types.ts` — `ProviderConfig.supportsToolCall` 字段定义（LINE 131）[VERIFIED]
- `src/providers/openai-compat.ts` — 被动探测实现（LINE 56-68）+ `shouldAttachTools`（LINE 80-83）[VERIFIED]
- `src/store/providers.ts` — `BUILTIN_MODEL_OPTIONS`（LINE 30）+ `setSupportsToolCall`（LINE 185-191）[VERIFIED]
- `src/components/Settings/ProviderForm.tsx` — 按钮落点（LINE 160-191 model 字段区域）[VERIFIED]
- `src/components/Settings/ProviderList.tsx` — badge 体系（badge / badge-success / badge-accent）[VERIFIED]
- `src/agent/agentStore.ts` — `runAgent` 实现（LINE 175-188）pre-flight 挂入点 [VERIFIED]
- `src/store/chat.ts` — `sendMessage` thin-delegate 路径（LINE 137-142）[VERIFIED]
- `manifest.xml` — 三宿主 Host、AppDomains、SourceLocation = GitHub Pages [VERIFIED]
- `package.json` — 测试/build/size 脚本 [VERIFIED]
- `.size-limit.json` — 82KB 门禁配置 [VERIFIED]
- `README.md` — 待重写的 113 行初稿 [VERIFIED]
- `.planning/phases/07-uat-sideload-release-prep/07-CONTEXT.md` — D-01~D-17 锁定决策 [VERIFIED]
- `.planning/REQUIREMENTS.md` — ERR-04 Complete / NFR-01/03/04 Pending / NFR-05 Complete [VERIFIED]

### Secondary (MEDIUM confidence)

- `vite.config.ts` — `import.meta.env.DEV` tree-shake 行为（Vite 7 标准）[CITED: Vite docs]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 全部 verified 读 package.json + 实际文件
- Architecture（A-21）: HIGH — 代码已全量读取，地基确认；probe 判定逻辑 MEDIUM（`SSEEvent` 字段名 ASSUMED）
- sideload 陷阱: MEDIUM — AppDomains CORS 行为 ASSUMED，其余 VERIFIED
- README 重写框架: HIGH — CONTEXT.md D-06~D-10 极详细
- Pitfalls: HIGH — 来自真实代码审查 + CONTEXT.md 明文记录

**Research date:** 2026-05-30
**Valid until:** 2026-06-30（稳定阶段；Phase 7 完成后即可 archive）
