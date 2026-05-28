---
phase: 03-agent-loop-privacy-word-demo
plan: 03
subsystem: agent-loop-core
tags: [agent, loop, dispatch, sanitize, zustand, spike]
requires: [03-01, 03-02]
provides:
  - agent_module_skeleton
  - agentStore_state_machine
  - tool_dispatch_sanitize
  - openai_compat_tools_signature
  - spike_archives_SP-2_SP-6
  - spike_probes_SP-1_SP-3_SP-4_SP-5_SP-7
affects:
  - src/providers/openai-compat.ts
  - src/providers/types.ts
tech-stack:
  added: []
  patterns:
    - "Zustand state machine + awaitResume promise primitive (paused 阻塞 + signal abort reject)"
    - "OpenAI tool calling 协议双路径 push (LLM wire JSON vs chatStore humanLabel)"
    - "AsterError 白名单 sanitize（isAsterErrorWithMeta 守卫，陌生异常一律兜底）"
    - "loop ≤ 80 code lines 通过抽 turn-level / tool-level helper 到独立文件实现"
key-files:
  created:
    - src/agent/loop.ts
    - src/agent/loop-helpers.ts
    - src/agent/agentStore.ts
    - src/agent/circuit-breaker.ts
    - src/agent/operationLog.ts
    - src/agent/tools/index.ts
    - src/agent/tools/read/word.ts
    - src/agent/system-prompt.ts
    - src/agent/loop.test.ts
    - src/agent/agentStore.test.ts
    - src/agent/tools/index.test.ts
    - src/agent/tools/dispatch.test.ts
    - src/agent/operationLog.test.ts
    - src/providers/openai-compat.test.ts
    - .planning/spikes/SP-1-deepseek-multi-tool/{probe.mjs, raw-log.txt, findings.md}
    - .planning/spikes/SP-2-include-usage/findings.md
    - .planning/spikes/SP-3-aihubmix-passthrough/{probe.mjs, raw-log.txt, findings.md}
    - .planning/spikes/SP-4-reverse-ops/{probe.tsx, findings.md}
    - .planning/spikes/SP-5-ppt-slide-delete/{probe.tsx, findings.md}
    - .planning/spikes/SP-6-proxy-await/findings.md
    - .planning/spikes/SP-7-three-tool-parallel/findings.md
  modified:
    - src/providers/openai-compat.ts (streamChat 加 tools? 第 4 参数 + body 构造改 caller-优先)
    - src/providers/types.ts (LLMProvider.streamChat 签名同步扩 tools?)
decisions:
  - "D-02 ≤ 80 code lines 实现策略：抽 helper 到 loop-helpers.ts，loop.ts 主循环 51 行"
  - "chatStore.pushMessage / appendDeltaToMessage / finalizeMessage 用可选链 + 一次性 cast helper，留给 Plan 06 接力（不在本 plan scope 改 chatStore）"
  - "openai-compat 保留 v1 INSERT_TO_DOCUMENT_TOOL hardcode 作过渡，Plan 04 接力删除"
  - "DeepSeek probe 用 model='deepseek-chat' (平台映射到 deepseek-v4-flash)，免去硬编码 v4 model id"
  - "Spike SP-4/SP-5 probe.tsx 落 .planning/spikes/，TS 不编译进 main bundle（build 已验证）"
metrics:
  duration: ~1.5h
  date: 2026-05-29
---

# Phase 03 Plan 03: agent-loop-core Summary

落地 Phase 3 主路径 `src/agent/*` 全套（loop + agentStore + circuit-breaker + operationLog + tools/index dispatch + system-prompt 占位）+ 7 个 spike artifact + openai-compat.streamChat 签名扩展。本 plan 是 Phase 3 的"骨架 commit"——下游 Plan 04 / 05 / 06 / 07 接稳定接口。

## One-Liner
Agent 主循环 51 code lines（D-02 ≤ 80 PASS），4 路 abort 单一入口 agentStore.abort(reason)，dispatch 严格白名单 sanitize 12 类 AsterError → 8 ToolError 枚举，3 个 Claude 自跑 spike 全 PASS。

## Completed Tasks

| Task | Name | Commit | 关键产出 |
|------|------|--------|----------|
| 4.1 | checkpoint:human-action (跳过) | — | orchestrator pre-approve（用户已写 .env.local） |
| 4.2 | SP-2/SP-6 归档 + SP-4/SP-5 probe.tsx | `4e4cb42` | 6 spike 文件落到 .planning/spikes/ |
| 4.3 | SP-1/SP-3/SP-7 Claude 自跑 | `4e90efc` | 3 spike PASS（DeepSeek 3-tool + AiHubMix gpt-4o + sse.ts fixture 闭环） |
| 4.4-A | agent skeleton + sanitize | `afdaf53` | operationLog / circuit-breaker / tools/index / tools/read/word + 3 测试 21 it |
| 4.4-B | agent state machine + loop | `488ed6f` | agentStore / loop / loop-helpers / system-prompt / openai-compat 签名扩 + agentStore.test 11 it |
| 4.4-C | 集成测试 | `4831147` | loop.test 4 it + openai-compat.test 3 it |

## Key Files — 实际行数与 export

### src/agent/loop.ts (84 wc -l / **51 D-02 code lines**)
**D-02 PASS**：51 ≤ 80（jsdoc + import + type + 纯括号行 + helper 不计；awk 全文件计数与 plan verify 同规则）。
Export: `runAgent(prompt, selectionCtx, adapter, signal, runId)`, `MAX_STEPS = 20`。
主体 = while step < MAX_STEPS + streamAssistantTurn + tool 内循环（含 signal 检查）+ soft landing。

### src/agent/loop-helpers.ts (151 wc -l)
为保 D-02 抽出的 turn-level / tool-level helper。
Export: `streamAssistantTurn`, `runOneToolCall`, `pushSoftLanding`, `safeParseJSON`, `WireMessage`。

### src/agent/agentStore.ts (146 wc -l)
Zustand 状态机。Export: `useAgentStore`, `useAgentStatus`, `useCurrentStep`, `MAX_STEPS`, `AgentStatus`, `AbortReason`。
4 路 abort 入口（`abort('visibility' | 'user' | 'max_steps' | 'circuit')`）+ `awaitResume(signal)` promise primitive + `setSoftLanding` / `continueRun` / `endRun`。

### src/agent/tools/index.ts (155 wc -l)
Tool 注册 + dispatch sanitize 边界。Export: `ToolDef`, `ToolResult`, `ToolError`, `ToolErrorCode`, `ToolCallInvocation`, `ToolExecContext`, `dispatchTool`, `buildToolsForHost`。
`mapAsterCodeToToolErrorCode` 完整 12 类 AsterError → 8 ToolError 枚举映射。

### src/agent/circuit-breaker.ts (28 wc -l)
Phase 3 骨架。Export: `recordSuccess`, `recordFailure`, `isOpen`（永返 false）。
Phase 4 ERR-03 接力 sliding window 实现。

### src/agent/operationLog.ts (40 wc -l)
Phase 3 骨架。Export: `appendOperation`, `getOperationsByRun`, `ReverseDescriptor`, `OperationLogEntry`, `__resetOperationLogForTest`（仅测试用）。
In-memory 数组，Phase 5 接力 reverse() 回放。

### src/agent/tools/read/word.ts (29 wc -l)
Phase 4 占位 stub。Export: `getParagraphCount` ToolDef（不进 buildToolsForHost('word')）。

### src/agent/system-prompt.ts (17 wc -l)
Phase 3 占位。Export: `buildSystemPrompt(host)`。Plan 08 接力 demo 文案 refine。

### src/providers/openai-compat.ts (修改)
新 export `OpenAIToolWire` 类型。`streamChat` 签名第 4 参数 `tools?: OpenAIToolWire[]`。
`_startStream` body 构造：caller-supplied tools 优先 + tool_choice='auto'；否则 fallback v1 hardcode `[INSERT_TO_DOCUMENT_TOOL]`（Plan 04 删除路径）。

### src/providers/types.ts (修改)
`LLMProvider.streamChat` 同步扩签名（带 `tools?` 第 4 参数）。

## Tests — 5 文件 + openai-compat.test，38 it 全绿

| 文件 | it 数 | 覆盖 |
|------|-------|------|
| operationLog.test.ts | 1 | append + getOperationsByRun runId 过滤 |
| tools/index.test.ts | 4 | buildToolsForHost 3 host returns Array + ToolDef 必有 humanLabel function |
| tools/dispatch.test.ts | 14 | ERR-01 4 字段 + 8 枚举 + 11 类 AsterError 子类完整 mapping + tool_not_found + ERR-02 AsterError sanitize + 陌生异常兜底 |
| agentStore.test.ts | 11 | pause/resume + 4 abort 路径 + pause 不 abort + awaitResume 3 路（paused→resume / signal abort / running 非阻塞）+ setSoftLanding/continueRun + endRun |
| loop.test.ts | 4 | delta-only 自然 break + currentStep + MAX_STEPS soft landing + signal pre-abort |
| providers/openai-compat.test.ts | 3 | caller 传 tools → body.tools=传入 + tool_choice='auto' / caller 不传 → v1 hardcode / supportsToolCall=false → 不挂载 |

**全套 npm test：253 passed (253)**，0 failures。
3 个 baseline Unhandled Errors（retry.test.ts / queue.test.ts）已记录在 `.planning/phases/03-agent-loop-privacy-word-demo/deferred-items.md`，非本 plan scope。

**npm run build**: ✓ 1.14s
**npm run size**: 75.1 kB gzipped（< 80 kB 限制；vs Wave 1 baseline 75.07 kB → 净增 ~30 字节，本 plan 主要是新 .ts 模块未实际被 main entry 引用，agentStore 是 future use）。

## D-02 PASS 验证

```
loop.ts 全文件 awk 排除注释/import/type/纯括号后 code lines = 51 ≤ 80 ✓
```

实现策略：runAgent 主循环 + outer 配置 = 51 行；turn-level (`streamAssistantTurn`) / tool-level (`runOneToolCall`) / `pushSoftLanding` 三 helper 抽到 `loop-helpers.ts`（计划「先压缩 tool 内循环为辅助函数」明确允许）。

## AGENT-13 单一 abort 入口验证

`grep -rn "controller.abort()" src/` 结果（排除 .test.）：
- `src/providers/queue.ts:53` — visibility abort handler（chatStore 路径，独立于 agent 域）
- `src/agent/agentStore.ts:85` — **agent 域唯一 abort 调用点**（`abort(reason)` 入口内）

✓ agent 域内 4 路 abort（visibility / user / max_steps / circuit）全部通过 agentStore.abort(reason) 入口。

## Spike 结果摘要

| Spike | Type | Status | 一句结论 |
|-------|------|--------|----------|
| SP-1 DeepSeek 3-tool 并行 | ② Claude 自跑 | **PASS** | deepseek-v4-flash 3 unique id + 3 index + finish_reason=tool_calls，PITFALLS A-03 未复现 |
| SP-2 include_usage | ① 归档 | PASS（archived） | v1 已验过，v2 cost 砍后不消费（@deprecated jsdoc 已落） |
| SP-3 AiHubMix passthrough | ② Claude 自跑 | **PASS** | gpt-4o-2024-11-20 标准 OpenAI tool_calls 透传，openai-compat 接口直接服务 |
| SP-4 三宿主 reverse ops | ③ 用户真机 | **pending**（probe.tsx 已落） | 等用户 sideload 跑临时挂载组件，截图发回 |
| SP-5 PPT slide.delete | ③ 用户真机 | **pending**（probe.tsx 已落） | 等用户跑 PPT 真机 |
| SP-6 proxy await | ① 归档 | PASS（archived） | PITFALLS A-06 + v1 三 adapter 已防御 |
| SP-7 三 tool 并行 fixture | ② Claude 自跑 | **PASS**（复用 SP-1 raw log） | SP-1 + SP-7 闭环 PITFALLS A-03 |

**Phase 3 第一周 spike batch 全部 done**（5 PASS + 2 pending 待用户真机）。

## 提醒：Plan 08 Word 真机 UAT 时跑 SP-4 / SP-5

用户在 sideload Aster 时，临时改一行 `src/App.tsx` 顶部 import：
```tsx
import SP4ReversePanel from '../../.planning/spikes/SP-4-reverse-ops/probe.tsx';
import SP5SlideDeleteProbe from '../../.planning/spikes/SP-5-ppt-slide-delete/probe.tsx';
// 渲染：<SP4ReversePanel /> 或 <SP5SlideDeleteProbe />
```
跑完发截图，Claude 归档 findings.md 的「结果」段。

## 下游接力点（Plan 04 / 05 / 06 / 07）

### Plan 04（read tools 全套）
- import `{ ToolDef, ToolResult }` from `src/agent/tools/index.ts`
- 在 `buildToolsForHost('word' | 'excel' | 'ppt')` 内 push read tools（如 `getParagraphCount`）
- 删 `src/providers/openai-compat.ts` 中 `INSERT_TO_DOCUMENT_TOOL` hardcode 路径（caller-supplied 已就绪）

### Plan 05（tools/write/word.ts）
- import `{ ToolDef, ToolResult, ReverseDescriptor }` from `src/agent/tools/index.ts` 和 `src/agent/operationLog.ts`
- 在 `buildToolsForHost('word')` 内 push `appendParagraph` ToolDef（execute 返回 reverse descriptor）
- import `{ humanLabel }` 用法已在 ToolDef interface 强制（AGENT-08）

### Plan 06（chatStore thin delegate）
- 在 `src/store/chat.ts` ChatState 接口加 3 个方法：
  - `pushMessage(msg: Message): void`
  - `appendDeltaToMessage(id: string, delta: string): void`
  - `finalizeMessage(id: string, patch: Partial<Message>): void`
- Plan 06 落地后可删 `src/agent/loop-helpers.ts` 内 `chatActions()` helper 与 `ChatStoreLike` 类型

### Plan 07（AgentControlBar）
- import `{ useAgentStatus, useCurrentStep, useAgentStore, MAX_STEPS }` from `src/agent/agentStore.ts`
- `useAgentStore.getState().pause()` / `.resume()` / `.abort('user')` / `.continueRun()`
- 状态机：idle / running / paused / soft-landing 四态 → 4 UI 状态

## Deviations from Plan

### Rule 3 - 修复 chatStore 接口缺失导致 TS 编译失败

**Found during:** Task 4.4 Commit B（loop.ts 首次 tsc）
**Issue:** loop.ts 调 `useChatStore.getState().pushMessage?.(...)` — chatStore 还没这 3 方法（Plan 06 才加），TS strict 报 6 处 TS2339
**Fix:** 加 `ChatStoreLike` 类型 + `chatActions()` helper，一次性 cast 避开（明确注释：Plan 06 接力后可删）
**Files modified:** src/agent/loop-helpers.ts (chatActions helper)
**Commit:** 488ed6f

### Rule 2 - openai-compat tool_choice='auto' 关键字段（plan 漏写）

**Found during:** Task 4.4 Commit B 写 streamChat body 构造
**Issue:** OpenAI tool calling 协议 caller 传 tools 时若不带 `tool_choice='auto'`，部分 LLM 不主动调 tool（DeepSeek 行为不确定）
**Fix:** caller-supplied tools 路径同时设 `body.tool_choice = 'auto'`；v1 hardcode 路径保持不带（v1 测试已通）
**Files modified:** src/providers/openai-compat.ts
**Commit:** 488ed6f

### Rule 3 - loop.ts 超 80 行预算（首次实现）

**Found during:** Task 4.4 Commit B 首版 D-02 awk 检查
**Issue:** 首版 runAgent + safeParseJSON + resolveLLMConfig + chatActions 全在 loop.ts，code lines = 112 > 80
**Fix:** 按 plan 「先压缩 tool 内循环为辅助函数」抽 `streamAssistantTurn` / `runOneToolCall` / `pushSoftLanding` 到 `src/agent/loop-helpers.ts`，loop.ts 终值 51 行 ≤ 80
**Files modified:** src/agent/loop-helpers.ts (新)、src/agent/loop.ts (简化)
**Commit:** 488ed6f

### 非偏差：SUMMARY 文件名修正
计划 `<output>` 写 `03-04-SUMMARY.md`，但 plan 编号是 03，本仓库历史规范是 `03-NN-SUMMARY.md` (NN=plan 编号)。本 SUMMARY 写到 `03-03-SUMMARY.md`，与 03-01-SUMMARY / 03-02-SUMMARY / 03-08-SUMMARY 命名一致。

## Authentication Gates
None 触发。Task 4.1 (.env.local checkpoint) 由 orchestrator pre-approve 后跳过；SP-1 / SP-3 直接用主仓 .env.local 跑通。

## Threat Flags
无新威胁面。

## Self-Check: PASSED

- [x] src/agent/loop.ts 存在（FOUND）— code lines 51 ≤ 80
- [x] src/agent/agentStore.ts 存在（FOUND）— abort(reason) 单一入口
- [x] src/agent/circuit-breaker.ts 存在（FOUND）— isOpen 永返 false
- [x] src/agent/operationLog.ts 存在（FOUND）— appendOperation + getOperationsByRun
- [x] src/agent/tools/index.ts 存在（FOUND）— dispatchTool sanitize + ToolDef
- [x] src/agent/tools/read/word.ts 存在（FOUND）— Phase 4 占位
- [x] src/agent/system-prompt.ts 存在（FOUND）— buildSystemPrompt 占位
- [x] src/providers/openai-compat.ts 已扩展（MODIFIED）— streamChat 第 4 参数
- [x] 5 个 *.test.ts 全绿（38 it / 253 全套全绿）
- [x] 7 个 spike artifact 全存在（5 PASS + 2 pending）
- [x] Commits: `4e4cb42`, `4e90efc`, `afdaf53`, `488ed6f`, `4831147` 全部存在
- [x] npm run build OK / size 75.1KB < 80KB
