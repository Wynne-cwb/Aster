---
phase: 03-agent-loop-privacy-word-demo
plan: 05
subsystem: chat-store / providers-store / input-bar
tags: [agent-loop, thin-delegate, autoInsertMode-removal, send-button-guard]
requires: [03, 04]
provides:
  - chatStore.sendMessage thin delegate to useAgentStore.runAgent
  - Message v2 schema with role 'tool' + agent metadata
  - chatStore.{pushMessage, appendDeltaToMessage, finalizeMessage} primitives
  - useProviderStore without autoInsertMode (v1 confirm/auto removed)
  - InputBar Send button disabled while agentStatus !== 'idle'
affects:
  - src/store/chat.ts (rewritten as thin store)
  - src/store/providers.ts (autoInsertMode 全删)
  - src/lib/storage.ts (AUTO_INSERT_MODE constant removed)
  - src/components/InputBar.tsx (Send guard + 3-arg sendMessage)
  - src/components/ChatBubble.tsx (Rule 3 cascade — 3 sub-components deleted)
  - src/components/Settings/SettingsPanel.tsx (Rule 3 cascade — toggle 段删)
tech-stack:
  added: []
  patterns:
    - Zustand thin store (pure data + delegate actions)
    - Selector hook delegation (useIsStreaming → useAgentStatus !== 'idle')
key-files:
  created:
    - src/store/chat.test.ts
    - src/store/providers.test.ts
    - src/components/InputBar.test.tsx
  modified:
    - src/store/chat.ts
    - src/store/providers.ts
    - src/lib/storage.ts
    - src/lib/storage.test.ts
    - src/components/InputBar.tsx
    - src/components/ChatBubble.tsx
    - src/components/Settings/SettingsPanel.tsx
    - src/i18n/locales/zh-CN/messages.po
    - src/i18n/locales/zh-CN/messages.ts
decisions:
  - D-01 / D-08 thin-delegate landed (chatStore 不再持有 LLM streaming 路径)
  - D-19 G-05 v1 confirm/auto 双模式砍 (acceptToolCall / rejectToolCall / autoInsertMode 全删)
  - A6 残留 localStorage `aster:autoInsertMode` 不做迁移清理（用户重装即丢）
  - A-14 InputBar Send 在 agent run 中 disabled，停止走 AgentControlBar 中止按钮（D-10 / AGENT-13）
  - sendMessage 签名扩展为 (prompt, selectionCtx, adapter) — 由 InputBar 通过 useAdapter context 注入（最小侵入方案 A）
metrics:
  duration: "~14 min"
  completed: 2026-05-29
  tasks_completed: 2
  files_changed: 12
  insertions: 524
  deletions: 596
  net_loc_change: -72
  test_count: 291 passed / 0 failed (29 test files; 3 baseline unhandled errors deferred)
  bundle_kb_gzipped_before: 77.43
  bundle_kb_gzipped_after: 75.44
  bundle_delta_kb: -1.99
---

# Phase 3 Plan 05: chatStore-core Summary

**One-liner:** chatStore 降级为纯 message store（sendMessage thin delegate 到 agent loop）+ Message v2 schema 加 role='tool' agent metadata + providers / storage 全删 v1 confirm/auto 双模式残留 + InputBar Send 按钮在 agent run 中 disabled — Phase 3 agent loop 是唯一主路径（D-01）落地。

---

## What Was Built

### Task 5.1 — chatStore thin delegate + autoInsertMode 全删

**chatStore (src/store/chat.ts)** 整体重写：

| 改造点 | 之前 (v1) | 之后 (Plan 05) |
|---|---|---|
| `Message.role` | `'user' \| 'assistant' \| 'error'` | `'user' \| 'assistant' \| 'tool' \| 'error'` |
| `Message` 新字段 | — | `toolCallId / toolName / toolResult / agentRunId / agentStep` |
| `sendMessage` 签名 | `(prompt, selectionCtx?)` | `(prompt, selectionCtx, adapter)` |
| `sendMessage` 实现 | ~170 行：LLM streaming / setupVisibilityAbort / for-await event 分发 / tool_call_end schema 校验 | **5 行 thin delegate**：push user message → `useAgentStore.getState().runAgent(prompt, ctx, adapter)` |
| `stopStreaming` | `controller?.abort()` | `useAgentStore.getState().abort('user')` (D-10 / AGENT-13 单一入口) |
| `clearHistory` | `controller?.abort()` + 清空 messages + reset isStreaming | `abort('user')` + 清空 messages |
| `retryMessage` | 移除 error 气泡 → 调本 store sendMessage(prompt) | 同语义但走 3-arg sendMessage(prompt, undefined, adapter) |
| `acceptToolCall` | 64 行实现（adapter.insert + status='accepted'/'rejected'） | **删除** (D-19 G-05) |
| `rejectToolCall` | 16 行实现 | **删除** (D-19 G-05) |
| 新增 primitives | — | `pushMessage / appendDeltaToMessage / finalizeMessage` 三个 thin 方法 — loop-helpers.ts 已用 optional chaining 提前消费，本 plan 正式落到 ChatState 接口 |
| Imports 砍 | `OpenAICompatibleLLM / setupVisibilityAbort / ProviderRegistry / LLMConfig / AsterError` | 全删；新增 `useAgentStore` + `ToolResult` type |
| `useIsStreaming` selector | 直接读 `isStreaming` 字段 | delegate 到 `useAgentStore.agentStatus !== 'idle'` (兼容 v1 调用方) |
| `isStreaming` / `abortController` 字段 | 都在 store | **isStreaming 字段从 state 移除**（hook 改 delegate）；`abortController` 字段从 state 移除（agentStore 持有） |

注：`Message.isStreaming` 字段仍保留（agent loop 流式 token 期间的「单条 message 闪烁光标」标识，与 store 级 `isStreaming` 是不同语义）。

**providers (src/store/providers.ts)** 删除清单（全部按 PATTERNS L1137-1145 跟随）：

| 符号 | 命运 |
|---|---|
| `AutoInsertMode` type | 删 |
| `ProviderState.autoInsertMode` 字段 | 删 |
| `ProviderState.setAutoInsertMode` 方法 | 删 |
| create initial state `autoInsertMode: storage.get(...) ?? 'confirm'` | 删 |
| `setAutoInsertMode` 实现 | 删 |
| `hydrateFromStorage` 内 `autoInsertMode` 读路径（2 处） | 删 |

`attachEnabled` / `setSupportsToolCall` / `addProvider` 等其它 API 全部不动。

**storage (src/lib/storage.ts)：**

- 删 `STORAGE_KEYS.AUTO_INSERT_MODE` 常量（A6 决策：残留 localStorage key `aster:autoInsertMode` **不**做迁移清理，用户重装即丢）
- `storage.test.ts` 配套更新：7 keys → 6 keys + 新增 `AUTO_INSERT_MODE undefined` 断言

### Task 5.2 — InputBar Send disabled during agent run

**InputBar (src/components/InputBar.tsx)：**

| 改造点 | 之前 (v1 D-14) | 之后 (Plan 05 A-14) |
|---|---|---|
| 按钮状态机 | 发送 / 停止原地切换（isStreaming 决定 icon + onClick） | **始终是发送图标**；停止由 AgentControlBar 中止按钮接管 |
| `disabled` 表达式 | `!isStreaming && !text.trim()` | `isAgentBusy \|\| !text.trim()` |
| `aria-disabled` | 隐含 | 显式（true / false） |
| textarea `disabled` | `isStreaming` | `isAgentBusy`（agent busy 时一并禁用，防键入半成品 prompt） |
| `useAgentStatus` 订阅 | 无 | 新增（agentStatus !== 'idle' → isAgentBusy=true） |
| `sendMessage` 调用 | `sendMessage(prompt, sel ?? undefined)` | `sendMessage(prompt, sel ?? undefined, adapter)` |
| `StopIcon` import | 用 | 删（按钮不再切换） |
| 新增 `title` 文案 | — | `t\`Agent 正在运行\`` (busy 时悬停提示) |

**InputBar.test.tsx (NEW)：** 5 个 RTL test (run via vitest + jsdom):
- `it.each` 3 状态（running / paused / soft-landing）— Send 按钮 disabled
- `idle + 非空 input` → enabled
- `idle + empty input` → disabled（v1 empty-input 路径保留）

---

## Cascade Cleanup (Rule 3 — Blocking Issue)

Plan 05 frontmatter 列的 `files_modified` 不含 ChatBubble / SettingsPanel，但 chat.ts 删 `acceptToolCall`/`rejectToolCall` + providers.ts 删 `autoInsertMode` 后，这两个组件的现有引用会让 `npm run build` 失败。Plan 06（chat-ui-cleanup）原本接力这两个文件的**完整改造**（含 role='tool' 渲染骨架）。

按 Rule 3 + Plan 06 frontmatter 已声明接力，本 plan 在 ChatBubble / SettingsPanel 做了**最小级联清理**（只删「对已删 API 的活引用」+ 多余子组件）— Plan 06 仍需补 ChatStream 内的新 role='tool' 折叠卡片 + soft-landing 卡片渲染：

### ChatBubble.tsx 削减（272 行 → 67 行；-205 行）

删除：
- `ToolCallPreviewCard` 子组件（confirm 模式预览卡 + accept/reject 按钮）— 65 行
- `AutoInsertEffect` 子组件（auto 模式自动调 adapter.insert）— 26 行
- `FallbackInsertMenu` 子组件（supportsToolCall=false 时回退菜单）— 41 行
- `positionLabel` helper — 8 行
- `acceptToolCall / rejectToolCall / autoInsertMode` 订阅
- `useChatStore / useProviderStore / useAdapter / useState / useEffect / useRef / DocumentAdapter` import
- `InsertIcon / CheckIcon` import
- `useLingui` / `Trans` import（assistant role 仅留 ReactMarkdown，无 i18n 文案）

保留：error / user / assistant 三 role 渲染骨架。Plan 06 接力时 ChatStream 直接渲染 `role='tool'` 折叠卡，不经过 ChatBubble。

### SettingsPanel.tsx 削减

删除：
- `autoInsertMode / setAutoInsertMode` 订阅
- 「AI 自动写文档」segmented control 段（confirm / auto 二选一 + 描述 hint）— ~28 行

保留：Provider 列表 / 选区附带开关 / 重看引导 / Provider 编辑表单 等全部 v1 行为。

---

## Plan 03 loop.ts 双路径 push 行为确认

本 plan **不动 loop.ts**。Plan 03 落地的 `loop-helpers.ts` 已用 optional chaining 提前消费 chatStore 上的 `pushMessage / appendDeltaToMessage / finalizeMessage`（见 L46-55 注释「Plan 06 才在 chatStore 上加…一旦 Plan 06 在 ChatState 接口上声明三方法，可直接删此 helper」）。**Plan 05 正好把这三方法落到 ChatState** —— loop-helpers.ts 的 optional chaining 现在每次都命中真实方法，行为无变化。

Plan 03 loop.ts 的双路径 push（LLM wire 用 JSON.stringify(toolResult) vs chatStore 用 humanLabel 中文人话）仍按 loop-helpers.ts 内现有实现工作；ChatStream 渲染 role='tool' 卡片由 **Plan 06** 接力消费 message.content（humanLabel）+ message.toolResult（折叠展开）。

---

## Tests / Build / Size

| Metric | Before (Wave 3 收尾 b52f13c) | After Plan 05 | Delta |
|---|---|---|---|
| Tests | 274 passed | **291 passed** | +17 |
| Test files | 26 | 29 | +3 (chat.test, providers.test, InputBar.test) |
| Vitest "Unhandled Errors" | 3 (baseline) | 3 (baseline) | 0 |
| `npm run build` | ✓ | ✓ | — |
| Main chunk gzipped | 77.43 KB | **75.57 KB** | **-1.86 KB** |
| size-limit gzipped | 77.49 KB | **75.44 KB** | **-2.05 KB** |
| Bundle 预算（80 KB） | ✓ | ✓ | — |

Bundle 主要下降来源：ChatBubble 三子组件删除（~95 行 TSX + Trans macro 拉链）+ chatStore 主路径砍 LLM/SSE/setupVisibilityAbort import + providers 删 autoInsertMode 全套。

---

## Verification (Plan 05 success_criteria)

| Criterion | Status |
|---|---|
| `Message` role 含 `'tool'` 分支 | ✓ src/store/chat.ts L43 |
| `Message` agent metadata 字段齐（toolCallId / toolName / toolResult / agentRunId / agentStep） | ✓ src/store/chat.ts L49-53 |
| `sendMessage` 调 `useAgentStore.runAgent` 一次 | ✓ chat.test Test 1 |
| `sendMessage` 先 push user message 再 delegate | ✓ chat.test Test 2 |
| `chatStore` 无 `acceptToolCall / rejectToolCall` | ✓ chat.test Test 4 |
| `useProviderStore` 无 `autoInsertMode / setAutoInsertMode` | ✓ providers.test Tests 1/2 |
| `STORAGE_KEYS.AUTO_INSERT_MODE` 不存在 | ✓ storage.test.ts (6 keys) |
| `InputBar` Send 按钮 disabled 条件正确 | ✓ InputBar.test 5 个 it |
| `npm test` 全套全绿（baseline unhandled errors 除外） | ✓ 291/291 |
| `npm run build` 通过 | ✓ |
| `npm run size` ≤ 80 KB | ✓ 75.44 KB |
| 无 modifications to shared/plan-phase artifacts | ✓（仅写 03-05-SUMMARY.md + deferred-items.md） |

---

## Deviations from Plan

### Rule 3 — Cascade cleanup (blocking issue)

**1. [Rule 3 — Blocker fix] ChatBubble / SettingsPanel 最小级联清理**
- **Found during:** Task 5.1 删 chatStore.acceptToolCall / rejectToolCall + providers.autoInsertMode 后，`npm run build` 必然失败（ChatBubble L66-67/207, SettingsPanel L50-51, storage.test 7-keys assert 全部硬引用已删符号）。
- **Plan 05 frontmatter** `files_modified` 列表未含 ChatBubble / SettingsPanel；Plan 06 frontmatter 明确接力两个文件的**完整**改造（含 ChatStream 内 role='tool' 渲染）。
- **Fix:** 在 Plan 05 内做**最小级联**：仅删 ChatBubble 三个子组件（ToolCallPreviewCard / AutoInsertEffect / FallbackInsertMenu）+ 相关订阅；删 SettingsPanel 「AI 自动写文档」段；改 storage.test.ts 7→6 keys + 新增 undefined 断言。
- **Plan 06 仍需做：** ChatStream 内新增 role='tool' 折叠卡片 + soft-landing 卡片渲染（消费 message.content humanLabel + message.toolResult 折叠 JSON）。Plan 05 留下的 ChatBubble assistant role 骨架（ReactMarkdown + 流式光标）原样保留。
- **Files modified:** src/components/ChatBubble.tsx (272 → 67 lines), src/components/Settings/SettingsPanel.tsx (-28 lines)
- **Commit:** e422baa

**2. [Rule 3 — Blocker fix] InputBar.tsx sendMessage 调用签名同步**
- **Found during:** Task 5.1 把 chatStore.sendMessage 签名扩展为 3-arg (prompt, selectionCtx, adapter)；InputBar.handleSend 仍用 2-arg → `npm run build` TypeScript 报错。
- **Fix:** InputBar 内 `sendMessage(prompt, sel, adapter)` — 由 useAdapter context 注入。Plan 05 task action 已建议方案 A，本 plan 落地。
- **Files modified:** src/components/InputBar.tsx
- **Commit:** 00618ba

### Rule 1 / Rule 2 — None

无 bug 修复 / 无缺失安全功能。

### Out-of-scope discoveries (deferred)

**1. Orphan CSS — `.aster-tool-card*` / `.aster-insert-btn*` / `.aster-insert-menu*`**
- 13 处 CSS selector 在 styles.css 仍存在（~80 行），对应 Plan 05 删掉的三个 ChatBubble 子组件。
- 不影响 build / runtime；只是无用 selector。
- 记录到 deferred-items.md，归 Plan 06（chat-ui-cleanup）接力新增 role='tool' 卡片 CSS 时一并整理。

**2. Lingui catalog obsolete entries**
- `npm run extract` 后 catalog 标记 v1 confirm/auto 文案为 `#~ obsolete`（「AI 想要写入文档」/「AI 自动写文档」/「光标处」/「已写入 N 字到」/「已拒绝写入」/「拒绝」/「停止生成」等 ~10 条）。
- 正常 i18n catalog 演进 — obsolete entry 不会进入 build chunk（Lingui compile 只保留活跃 msgid）。

---

## Authentication Gates

None — Plan 05 纯 chatStore / providers / storage / InputBar 改造，无 LLM 调用 / 无 Provider Key 路径。

---

## Threat Flags

**threat_flag: T-05-01 mitigation landed** — chatStore.sendMessage 是唯一入口 → useAgentStore.runAgent 是唯一 LLM 调用路径；v1 confirm/auto 双模式（acceptToolCall 旁路）已物理删除。

**threat_flag: T-05-03 mitigation landed** — InputBar Send 按钮在 agentStatus !== 'idle' 时 disabled + aria-disabled='true'；防止用户在 agent run 中串场新 prompt（A-14）。

无新增 threat surface 不在 plan threat_model 内。

---

## Known Stubs

None — 本 plan 不引入新 stub；ChatBubble assistant role 仍用真实 ReactMarkdown 渲染；InputBar 真实调 useAgentStore.runAgent；providers / storage 真实持久化 attachEnabled。

ChatStream 内 role='tool' 渲染（Plan 06 接力）现在会落到 ChatBubble 默认分支 → 显示 message.content as markdown（humanLabel 中文字面量「在文档末尾追加段落…」）。这是 acceptable fallback 直到 Plan 06 正式接管。

---

## Commits (Plan 05)

| Commit | Type | Message |
|---|---|---|
| f2094f2 | test | add failing tests for chatStore thin delegate + providers autoInsertMode removal (RED) |
| e422baa | feat | chatStore thin delegate + autoInsertMode 全删 (Task 5.1 GREEN) |
| 00618ba | feat | InputBar Send disabled during agent run + sendMessage 3-arg signature (Task 5.2) |

TDD Gate: ✓ RED (test commit) → ✓ GREEN (feat commits)

---

## Plan 06 Handoff

Plan 06（chat-ui-cleanup）已具备的前置：
- `Message.role === 'tool'` 类型可用（Plan 05 落地）
- `Message.content` 字段 = humanLabel 字面量（Plan 03 loop.ts L84-92 双路径 push 已实现）
- `Message.toolResult` 字段可用（折叠展开看 JSON 用）
- `useAgentStore.continueRun` / `useAgentStore.abort('user')` selector hook（Plan 03 落地）

Plan 06 待做：
- ChatStream messages.map 内按 role 分发：role='tool' → 渲染折叠卡片（humanLabel 头 + toolResult JSON 折叠区）
- ChatStream messages.map 内 role='tool' && toolName==='soft-landing' → 渲染软着陆卡片（两按钮：继续 20 步 → continueRun / 停下 → abort('user')）
- 清理 styles.css 内孤儿 `.aster-tool-card*` / `.aster-insert-btn*` selector（与新 role='tool' 卡片 CSS 一并整理）
- ChatStream.test.tsx 新增 4-5 个 RTL test 覆盖上面行为

---

## Self-Check: PASSED

**Files created:**
- ✓ FOUND: src/store/chat.test.ts (158 lines)
- ✓ FOUND: src/store/providers.test.ts (37 lines)
- ✓ FOUND: src/components/InputBar.test.tsx (123 lines)
- ✓ FOUND: .planning/phases/03-agent-loop-privacy-word-demo/03-05-SUMMARY.md (this file)

**Files modified:**
- ✓ FOUND: src/store/chat.ts (rewrite)
- ✓ FOUND: src/store/providers.ts (autoInsertMode 全删)
- ✓ FOUND: src/lib/storage.ts (AUTO_INSERT_MODE 删)
- ✓ FOUND: src/lib/storage.test.ts (6 keys)
- ✓ FOUND: src/components/InputBar.tsx (Send guard + 3-arg)
- ✓ FOUND: src/components/ChatBubble.tsx (cascade cleanup)
- ✓ FOUND: src/components/Settings/SettingsPanel.tsx (cascade cleanup)
- ✓ FOUND: src/i18n/locales/zh-CN/messages.po (obsolete markers + new msgid)
- ✓ FOUND: src/i18n/locales/zh-CN/messages.ts (compiled catalog)
- ✓ FOUND: .planning/phases/03-agent-loop-privacy-word-demo/deferred-items.md (orphan CSS noted)

**Commits exist (git log --oneline):**
- ✓ FOUND: f2094f2 test(03-05): add failing tests for chatStore thin delegate
- ✓ FOUND: e422baa feat(03-05): chatStore thin delegate + autoInsertMode 全删
- ✓ FOUND: 00618ba feat(03-05): InputBar Send disabled during agent run

All 291 vitest tests pass (3 baseline unhandled errors recorded in deferred-items.md, pre-existing). Bundle 75.44 KB gzipped ≤ 80 KB size-limit.
