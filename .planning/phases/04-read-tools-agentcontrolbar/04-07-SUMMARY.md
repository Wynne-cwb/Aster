---
phase: 04-read-tools-agentcontrolbar
plan: "07"
subsystem: agent-ui
tags: [agent-control-bar, error-recovery, three-state, circuit-breaker, tdd]
dependency_graph:
  requires: [04-01, 04-06]
  provides: [AGENT-12-ui, ERR-04-ui]
  affects: [AgentControlBar, ChatStream, agentStore, circuit-breaker]
tech_stack:
  added: []
  patterns:
    - "SP-C: timer in component not store (setInterval in useEffect)"
    - "Circuit metadata flow: circuit-breaker → agentStore.lastCircuitInfo → ChatStream red card"
    - "Read tool preview: truncate content to 500 chars with suffix"
key_files:
  created:
    - src/components/AgentControlBar.test.tsx (expanded from Phase 3 base)
    - src/components/ChatStream.giveup.test.tsx
  modified:
    - src/components/AgentControlBar.tsx
    - src/components/ChatStream.tsx
    - src/agent/agentStore.ts
    - src/agent/circuit-breaker.ts
    - src/agent/loop-helpers.ts
    - src/styles.css
    - src/i18n/locales/zh-CN/messages.po
decisions:
  - "SP-C: 5s stall timer hangs in component useEffect, not store — avoids per-second global setState re-render"
  - "lastCircuitInfo stored in agentStore (not derived in component) — circuit info available after abort clears loop context"
  - "ExpandedBody extracted as sibling component — avoids IIFE anti-pattern in JSX"
  - "Bundle overage accepted: Task 1+2 added 640B gzipped over a pre-existing 79.86KB baseline (140B headroom). All required features kept."
metrics:
  duration: "17 minutes"
  completed: "2026-05-29"
  tasks_completed: 2
  files_modified: 8
---

# Phase 04 Plan 07: AgentControlBar Three-State + Agent Gave Up Red Card Summary

AgentControlBar 三态文案（thinking/reading/writing）+ 5 秒安抚行 + ChatStream「Agent gave up」红卡（circuit abort 后显示 X 次失败 + Y LLM 建议 + 重新试试按钮）+ read 折叠卡截断预览（前 500 字）。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | AgentControlBar test (failing) | 9d88c0f | AgentControlBar.test.tsx |
| 1 (GREEN) | AgentControlBar three-state + 5s stall | b8a6637 | AgentControlBar.tsx, styles.css |
| 2 (RED) | ChatStream.giveup test (failing) | 12bc365 | ChatStream.giveup.test.tsx |
| 2 (GREEN) | Red card + truncated preview + circuit meta | 7ca7c9a | ChatStream.tsx, agentStore.ts, circuit-breaker.ts, loop-helpers.ts, styles.css, messages.po |

## What Was Built

### Task 1: AgentControlBar 三态文案 + 5 秒安抚行（AGENT-12）

- `PHASE_LABEL` / `STALL_LABEL` 常量映射三态中文文案
- `useAgentStore((s) => s.currentPhase)` 逐字段订阅（SP-C）
- `useState(false)` + `useEffect` 挂 `setInterval(1000)` 读 `useAgentStore.getState().lastUpdateTs`（不进 store，避免每秒全量 re-render）
- status=idle 时清理 interval + 重置 stalled
- 三态文案：正在思考… / 正在读取… / 正在写入…（null → 不显示）
- 安抚文案（>5s）：还在跑，正在等 LLM 思考… / 正在读取，稍候… / 正在写入，稍候…
- CSS：`.aster-agent-bar__phase`（text-2，11px）/ `.aster-agent-bar__stall`（text-3，11px，斜体），无裸 hex

### Task 2: ChatStream 红卡 + 截断预览 + circuit 元数据（ERR-04）

**circuit-breaker.ts：** 加 `getFailureSummary(tool)` — 返回窗口内出现最多的失败 code + 次数（null 若无失败）。

**agentStore.ts：** 加 `CircuitInfo` 接口 + `lastCircuitInfo: CircuitInfo | null` 字段 + `setCircuitInfo(info)` action；`beginRun`/`endRun` 重置为 null。

**loop-helpers.ts：** circuit 分支在 `abort('circuit')` 前调 `setCircuitInfo({ toolName, code, count })` — 元数据在 abort 前写入（abort 不清除 lastCircuitInfo）。

**ChatStream.tsx：** 新增 `CIRCUIT_OPEN` 分支（在 soft-landing 之后、常规折叠卡之前）：
- 标题：AlertIcon + `Aster 试了几次都没成功`
- 说明：`试了 {count} 次 {toolName} 都失败了。` + 同 agentRunId 最后一条 assistant content（Y 建议）
- 按钮：`重新试试`（RetryIcon + `useAgentStore.getState().runAgent(originalPrompt, ...)`）
- 无撤销按钮（D-05）

**ExpandedBody 组件（read 截断预览）：**
- `result.data.content` 前 500 字 + `…(共 X 字)` 后缀（若 >500）
- `result.data.source` 小字标注来源
- 错误结果：message + hint；兜底：JSON.stringify

**styles.css：** `.aster-tool-card--gave-up`（`var(--error)` 边框 + `var(--error-bg)` 背景）、`.aster-tool-card__title--error`（flex + error 色）、`.aster-tool-card__source`（小字 monospace 来源行）。两套主题靠 `:root` + theme token 自动适配，无裸 hex。

## Verification Results

```
npx vitest run AgentControlBar.test.tsx ChatStream.giveup.test.tsx circuit-breaker.test.ts
PASS (31) FAIL (0)

npm run test -- --run
PASS (430) FAIL (1)  ← 仅 loop.test.ts AGENT-02 (已知预存在失败)

npx tsc --noEmit → TypeScript compilation completed

npm run size
Size: 80.50 kB (超出 500 B — 见 Deviations)
```

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Bundle Budget Deviation

**Found during:** Task 1 + Task 2 build verification

**Issue:** Plan 07 提示标注基线为 79.71 KB，实际 Plan 06 完成后基线已是 79.86 KB（只剩 140 B 余量）。Task 1 消耗约 220 B（三态文案常量 + stall 逻辑），Task 2 消耗约 420 B（红卡 JSX + ExpandedBody + getFailureSummary + agentStore 扩展 + lingui catalog 新条目），合计超出 500 B（80.50 KB vs 80.00 KB 上限）。

**Analysis:** 超出部分全部是 ERR-04 / AGENT-12 硬验收所需的最小实现。AlertIcon + RetryIcon 已在 ErrorBubble 使用，无新增图标体积；lingui catalog 新增 2 条中文条目（约 40 bytes gzip）；其余为必要逻辑代码。

**Resolution:** 功能完整保留，在 SUMMARY.md 标注。建议 Phase 4.5 UI 迁移（teal 重设计）时同步做一次 bundle audit，可通过精简重复 CSS token、清理旧 glass 样式等方式回收 1-2 KB。

**Risk:** 低。超出量 0.6%，无懒加载解析库（mammoth/xlsx/pdfjs），仍远低于原始 1MB 约束。

## Known Stubs

None. 所有红卡数据路径真实联通（circuit-breaker → lastCircuitInfo → ChatStream）；三态文案从 store 实时读取；截断预览从 toolResult.data 实时计算。

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-04-21 mitigated | ChatStream.tsx | 红卡 X = ToolErrorCode 枚举（受控），Y = LLM assistant content（已面向用户），不渲染 stack/path |
| T-04-22 mitigated | ChatStream.tsx | D-05 坚决不放「撤销本次」按钮，仅「重新试试」（诚实禁用） |
| T-04-23 mitigated | ChatStream.tsx ExpandedBody | read 折叠卡展开截断前 500 字预览，避免 document_content 刷屏 |

## Self-Check: PASSED

- AgentControlBar.tsx: FOUND
- ChatStream.tsx: FOUND
- agentStore.ts: FOUND (lastCircuitInfo + setCircuitInfo)
- circuit-breaker.ts: FOUND (getFailureSummary)
- loop-helpers.ts: FOUND (setCircuitInfo call)
- styles.css: FOUND (.aster-tool-card--gave-up, .aster-agent-bar__phase, .aster-agent-bar__stall)
- AgentControlBar.test.tsx: FOUND
- ChatStream.giveup.test.tsx: FOUND
- Commits: 9d88c0f, b8a6637, 12bc365, 7ca7c9a — all verified in git log
