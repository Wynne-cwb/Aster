---
phase: 21-ctx-compaction-antihallucination
plan: 01
subsystem: agent
tags: [compaction, prompt-caching, llm, watermark, persistence, vitest, ctx-03, ctx-04, ctx-05]

# Dependency graph
requires:
  - phase: 20-ctx-clock-deprefix-guard
    provides: buildTimeContext() wire-tail 注入 + system 前缀静态化（缓存铁律范式）
  - phase: 08-foundation
    provides: chatStore 持久化（saveHistory/loadHistory version:1）+ truncateTo20Turns 滑动窗口
provides:
  - "src/agent/compaction.ts：watermark 常量（HIGH 120K/LOW 40K/FLOOR 4/BACKSTOP 160K/SUMMARY_MAX 8K）+ selectCompactionPlan(纯) + messagesAfterCutoff + buildSummaryMessage + summarizeSegment + maybeCompactHistory（abort 防腐 + 摘要超上限 no-commit）"
  - "applyHistoryBackstop(messages, maxTokens?)：token 上界整轮丢 + 地板兜底，取代 truncateTo20Turns（CTX-05）"
  - "chatStore.summary/summaryThroughId 独立字段 + setCompactionState + version:2 持久化（v1|v2 兼容）"
  - "loop.ts wire：[system][摘要(system)][最近原文 post-cutoff][当前 user+时间尾]，[system][摘要] 成新稳定缓存前缀（CTX-04）"
affects: [22-pvq-design-token-geometry, 23-pvq-stamp-tool-layout-prompt]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "缓存铁律延伸：摘要折老入 wire 固定 system 消息（[system][摘要] 前缀），易变内容（最近原文 + 时间尾）靠后；绝不 mutate chatStore.messages（UI 历史完整）"
    - "abort 防腐：openai-compat streamChat 在 AbortError 时静默 return → summarizeSegment 返回半截串 → maybeCompactHistory 提交前 `!newSummary || signal.aborted` 早退（防截断摘要永久持久化）"
    - "no-commit clamp 收敛：摘要超 SUMMARY_MAX_TOKENS 不提交（保持旧 summary/cutoff），防膨胀螺旋（每轮重压 + 前缀每轮 miss）"
    - "DRY：estimateTokens 单一真相源在 read-result.ts，compaction import+re-export，loop-helpers 从 './compaction' 拿（路径稳定，无 import 循环）"

key-files:
  created:
    - src/agent/compaction.ts
    - src/agent/compaction.test.ts
  modified:
    - src/agent/loop-helpers.ts
    - src/agent/loop.ts
    - src/store/chat.ts
    - src/agent/loop-helpers.test.ts
    - src/agent/loop.test.ts
    - src/store/chat.test.ts

key-decisions:
  - "压缩模型复用 resolveLLMConfig() 已配置 model（不硬编码 flash、不加 Settings 字段）— D-21-02"
  - "摘要 role=system（wire 第 2 条），保证 [system][摘要] 稳定前缀 + 避免模型当新指令回复 — D-21-04"
  - "summaryThroughId 用 message id（稳定指针，抗 index 漂移）；id 找不到（quota-trim 删）→ 兜底全部由下次压缩重触发 — D-21-05"
  - "compaction = 常规长度主控（折老不丢内容）；applyHistoryBackstop = 兜底的兜底（仅压缩失效/压后仍超硬顶时盲丢最老整轮）— D-21-07"
  - "静默（无压缩 UI），summarizeSegment 不走 streamAssistantTurn、不 push chatStore — D-21-08"

patterns-established:
  - "token 水位触发压缩（>HIGH 严格大于触发，压后回落 <=LOW，高/低 80K gap → 一次压撑多轮）"
  - "plan-review 4 修订全部落地并测守门：abort no-commit / 跨轮缓存稳定 / 摘要超上限 no-commit / estimateTokens DRY"

requirements-completed: [CTX-03, CTX-04, CTX-05]

# Metrics
duration: ~50min
completed: 2026-06-03
---

# Phase 21 Plan 01: 摘要压缩 + 稳定前缀持久化 + 截断重审 Summary

**按 token 高/低水位（120K/40K）把最老一段历史折进 system 角色摘要消息，使 `[system][摘要]` 成新稳定缓存前缀；摘要 + 截断点随聊天记录持久化（version:1→2，F5 可恢复）；`truncateTo20Turns` 滑动窗口重构为 token 上界 + 整轮丢 + 地板保护的兜底 `applyHistoryBackstop`。绝不 mutate `chatStore.messages`（UI 历史完整）。**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-06-03
- **Completed:** 2026-06-03
- **Tasks:** 6（5 改动任务 + 1 验证任务）
- **Files created:** 2 | **Files modified:** 6

## Accomplishments
- **CTX-03 compaction.ts（新建）**：5 个水位常量（带「初值/UAT 可调」注释）+ 纯函数 `selectCompactionPlan`（>HIGH 严格触发、预算回落 <=LOW、`RECENT_TURNS_FLOOR=4` 地板）+ `messagesAfterCutoff`（id 指针，兜底全部）+ `buildSummaryMessage`（带 marker）+ `summarizeSegment`（复用 cfg、不传 toolDefs、只取 delta、不 push chatStore）+ `maybeCompactHistory`（入口，try/catch 静默降级 + 成功即 saveHistory）
- **CTX-04 chat.ts**：新增 `summary`/`summaryThroughId` 独立字段（不进 messages）+ `setCompactionState` setter；`saveHistory` bump version:2 带摘要字段；`loadHistory` 兼容 v1|v2（v1 旧存档 summary 默认 ''）；`clearHistory` 一并重置摘要
- **CTX-04 loop.ts 接线**：`buildSystemPrompt → maybeCompactHistory(复用 cfg) → messagesAfterCutoff + applyHistoryBackstop → wire [system][摘要(system)][最近原文][当前+时间尾]`；摘要只进 wire，Phase 20 时间尾原样保留
- **CTX-05 loop-helpers.ts**：`truncateTo20Turns`（20 轮滑动窗口，前缀每轮变全 miss）重构为 `applyHistoryBackstop`（token 上界、按整轮丢、地板保护、正常 no-op 前缀稳定）
- **plan-review 4 修订全落地**：(R1) abort 半截摘要 `!newSummary || deps.signal.aborted` 早退；(R2) loop.test 跨两轮 cutoff-不推进 + `[system][摘要]` 字节稳定守门；(R3) `SUMMARY_MAX_TOKENS=8K` no-commit clamp；(R4) `estimateTokens` 复用 read-result（import + re-export，无循环）

## Task Commits

Each task was committed atomically:

1. **Task 2: chatStore summary/summaryThroughId 状态 + version:2 持久化（CTX-04）** - `c43444f` (feat) — 先落字段供 Task 1 编译
2. **Task 1: compaction.ts 摘要压缩水位逻辑 + abort/膨胀防御（CTX-03）** - `ac09a62` (feat)
3. **Task 3: truncateTo20Turns → applyHistoryBackstop token 兜底（CTX-05）** - `9995db1` (refactor)
4. **Task 4: loop.ts wire 接线 compaction + 摘要消息 + backstop（CTX-03/04/05）** - `ec4ffb4` (feat)
5. **Task 5: compaction 边界 + 缓存稳定 + abort/膨胀防御 + 持久化往返守门** - `e0e6cde` (test)

Task 6（最终验证）无文件改动，结果见下。

## Files Created/Modified
- `src/agent/compaction.ts`（新建）- 水位常量 + selectCompactionPlan + messagesAfterCutoff + buildSummaryMessage + summarizeSegment + maybeCompactHistory + estimateTokens re-export
- `src/agent/compaction.test.ts`（新建，18 测）- token 边界 / messagesAfterCutoff / buildSummaryMessage / summarizeSegment / maybeCompactHistory 编排 + REVISION 1/3 守门
- `src/store/chat.ts` - summary/summaryThroughId 字段 + setCompactionState + version:2 saveHistory + loadHistory v1|v2 兼容 + clearHistory 重置
- `src/agent/loop-helpers.ts` - 删 truncateTo20Turns，加 applyHistoryBackstop（import compaction 常量）
- `src/agent/loop.ts` - import compaction；wire 接线 maybeCompactHistory + 摘要 system 消息 + applyHistoryBackstop
- `src/agent/loop-helpers.test.ts` - 3 个 truncateTo20Turns 用例换 applyHistoryBackstop（4 用例）
- `src/agent/loop.test.ts` - compaction 接线集成 describe（3 用例，含 REVISION 2 跨轮缓存稳定守门）
- `src/store/chat.test.ts` - version:2 摘要往返 + v1 兼容 + clearHistory 重置（旧 version:1 断言改 version:2）

## Decisions Made
None beyond plan — 决策均为计划内锁定（D-21-01..08），含 plan-review 4 修订。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule: test 断言修正以 PASS + 保真意图] loop.test 首个集成测「messages.length).toBe(16)」未计入主 run 追加的 assistant 气泡**
- **Found during:** Task 5（loop.test.ts compaction 集成断言）
- **Issue:** 计划测试代码断言 `useChatStore.getState().messages.length).toBe(16)`，但 `runAgent` 主 run 经 `streamAssistantTurn` 会向 chatStore push 一条 assistant 流式气泡（loop-helpers.ts L78），实际 length = 17，会假红。该断言意图是「compaction 不 mutate UI 历史」（不删 16 条原始消息），非「总条数恒为 16」。
- **Fix:** 改为 `messages.filter((m) => /^m\d+$/.test(m.id)).toHaveLength(16)`——精确断言 16 条 seed 历史一条不少（compaction 绝不删/改），对主 run 追加的 assistant 回复鲁棒。意图不变。注：compaction.test.ts 里直调 `maybeCompactHistory`（不经 streamAssistantTurn、不 push）的测试仍保留精确 `messages.length === seed.length` 守门。
- **Files modified:** src/agent/loop.test.ts
- **Verification:** 四测重跑 64 passed；全套 933 passed
- **Committed in:** `e0e6cde`（Task 5 commit）

---

**Total deviations:** 1 auto-fixed（test 断言修正，保真意图，不改设计）
**Impact on plan:** 无 scope creep；计划意图与产出形态不变。其余 5 个 must_have truths + plan-review 4 修订全部按计划落地并测守门。

## Issues Encountered
- `npm test` 尾部恒有 3 个 `retry.test.ts` unhandled-rejection errors（RATE_LIMIT/NETWORK）——既有 flaky 噪音，与本 phase 无关（memory `i18n_extract_and_test_noise`）。
- `npm run build` 报 vite:reporter 警告：`chat.ts` 被 agentStore 动态 import 同时被 compaction/loop-helpers/loop 等静态 import。**既有现象**（Phase 21 前 loop.ts 已静态 import chat.ts）；compaction/loop-helpers 与 loop 同属 loop chunk，无新 chunk 移动；size 实测 80.6KB（与 80.53KB 基线持平）证明初始包零增量。

## Verification（Task 6）
- `npx tsc --noEmit` → exit 0
- `npm test -- --run` → **73 files / 933 tests passed**（901 基线 + 32 新增），0 真实失败（3 retry errors 既有噪音）
- **3 个 load-bearing 守门全 PASS**：
  - REVISION 1 abort 半截 no-commit（compaction.test.ts：abort 后 `summary===''`/`summaryThroughId===null`）✓
  - REVISION 2 跨两 sub-HIGH 轮缓存稳定（loop.test.ts：`summaryThroughId`/`summary` 不变 + `[system][摘要]` 前缀字节稳定）✓
  - REVISION 3 摘要超上限 no-commit（compaction.test.ts：超 SUMMARY_MAX_TOKENS 后 `summary==='OLD'`/`summaryThroughId===null`）✓
- `npm run build && npm run size` → main bundle **80.6 KB gzipped ≤ 82 KB**（与 80.53KB 基线持平，0 净新增依赖）
- 持久化往返：chat.test.ts v2 saveHistory + loadHistory v2 恢复 + v1 旧存档兼容（summary 默认 ''）+ clearHistory 重置 全绿
- Success criteria 1-5 全部 TRUE

## User Setup Required
None - 无外部服务配置；压缩复用用户已配置的 LLM Provider/model。

## Next Phase Readiness
- CTX-03/04/05 交付，`[system][摘要]` 稳定缓存前缀 + token 水位压缩 + 兜底就位，长对话上下文控制完成。
- 摘要质量 / 水位初值（120K/40K）/ 第 2 条 system 消息 Provider 兼容性（非-DeepSeek 显式门）→ 攒到 v2.3 里程碑末统一 UAT（Team Lead 决定，DEFER #5/#6 已文档化 fallback）。
- Plan 02（CTX-06 抗幻觉指引）见 21-02-SUMMARY.md。

---
*Phase: 21-ctx-compaction-antihallucination (Plan 01)*
*Completed: 2026-06-03*
