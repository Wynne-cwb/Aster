---
phase: 12-ui-e
plan: "03"
subsystem: ui
tags: [typing-indicator, table-css, read-card, animation, css-variables]
dependency_graph:
  requires: ["12-02"]
  provides: ["UI-02-showTyping", "UI-04-table-css", "UI-05-read-card-class"]
  affects: ["src/components/ChatStream.tsx", "src/styles.css"]
tech_stack:
  added: []
  patterns:
    - "Zustand selector per-field (agentStatus, currentRunId)"
    - "Conditional JSX rendering (showTyping bubble)"
    - "CSS modifier class pattern (aster-tool-card--read, tool-group--read)"
    - "CSS keyframe animation via CSS variables (aster-typing)"
    - "prefers-reduced-motion degradation"
key_files:
  modified:
    - src/components/ChatStream.tsx
    - src/styles.css
    - src/i18n/locales/zh-CN/messages.po
decisions:
  - "showTyping uses strict agentStatus === 'running' || === 'paused' (not !== 'idle') to exclude soft-landing D-05"
  - "MergedToolGroup allRead uses messages.every() — any write in group disables --read modifier D-15"
  - "bubble-typing JSX inserted after nodes but before DiffLogPanel block to respect stream rendering order"
  - "UI-04 table uses display:block + overflow-x:auto to enable horizontal scroll in 350px task pane"
  - "All new CSS colors use CSS variables only — 0 new hardcoded hex values"
metrics:
  duration: "12 min"
  completed: "2026-05-31"
  tasks_completed: 2
  files_modified: 3
---

# Phase 12 Plan 03: Typing Bubble + Table CSS + Read-Card Class Summary

**One-liner:** showTyping 三点气泡（UI-02）+ Markdown 表格边框（UI-04）+ read 工具卡降权修饰类（UI-05），Wave 0 RED stubs UI-02-A/UI-05-A 全变 GREEN。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ChatStream.tsx: showTyping + read-card class (UI-02/UI-05) | ba9181a | src/components/ChatStream.tsx, src/i18n/locales/zh-CN/messages.po |
| 2 | styles.css: typing animation + table CSS + read variants (UI-02/04/05) | afa83c8 | src/styles.css |

## Changes Summary

### Task 1: ChatStream.tsx (5 sub-changes)

1. **[UI-02] 新增 Zustand 选择器**（L275-276）：`agentStatus`、`currentRunId`，遵循 per-field 选择器范式。
2. **[UI-02] showTyping 计算逻辑**（L363-372）：`agentStatus === 'running' || === 'paused'` 严格判定 + 当前 run 最后一条 assistant 消息 content 为空且 isStreaming 时显示。
3. **[UI-05] ToolResultCard cardClass 扩展**（L180）：`message.kind === 'read'` 时追加 `aster-tool-card--read`。
4. **[UI-05] MergedToolGroup allRead + groupClass**（L235-236）：`messages.every(m => m.kind === 'read')` 判全读组，`tool-group--read` 修饰。
5. **[UI-02] 思考气泡 JSX**（L418-428）：`{showTyping && <div .bubble-typing>...三点 span...</div>}`，位于 `{nodes}` 与 DiffLogPanel 之间。

### Task 2: styles.css (3 CSS blocks added)

1. **[UI-02] @keyframes aster-typing + .bubble-typing**：三点跳动动画，translateY -4px，opacity 0.4→1，0.96s；nth-child(2/3) delay 0.16s/0.32s；prefers-reduced-motion 降级 animation:none + opacity:0.5。
2. **[UI-04] .bubble-ai table**：display:block + overflow-x:auto（350px 任务窗格横向滚动）；border-collapse:collapse；cell border `var(--border)`；th background `var(--surface-2)`。
3. **[UI-05] .aster-tool-card--read + .tool-group--read**：read 单卡去边框 + `var(--text-3)` 字色；全 read 合并组去组边框 + 头字色降权 + list item 边框透明。

### i18n: messages.po re-extracted

ChatStream.tsx 新增代码导致行号偏移（3 条消息的 `#:` 注释行号各 +5），`npm run extract` 重新生成，已包含在 Task 1 commit。

## Verification Results

| Check | Result |
|-------|--------|
| vitest UI-02-A (RED → GREEN) | PASS |
| vitest UI-02-B | PASS |
| vitest UI-02-C | PASS |
| vitest UI-05-A (RED → GREEN) | PASS |
| vitest UI-05-B | PASS |
| vitest total (59 files) | 731 passed, 0 failed |
| i18n coverage.test.ts | PASS |
| tsc --noEmit | PASS (clean) |
| npm run build | PASS |
| npm run size | 74.88 KB gzip (limit: 82 KB) |

## Deviations from Plan

None — plan executed exactly as written. All 5 ChatStream changes and 3 CSS blocks match plan specifications.

## Known Stubs

None introduced in this plan. Wave 3 (12-04) will implement UI-03 DiffLogPanel boundary insertion.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. This plan is pure CSS rules + conditional state rendering. T-12-07/08/09 all accepted as noted in plan threat register.

## Self-Check: PASSED

- src/components/ChatStream.tsx: FOUND (showTyping logic + bubble-typing JSX + read-card class + allRead/groupClass)
- src/styles.css: FOUND (@keyframes aster-typing, .bubble-typing, .bubble-ai table, .aster-tool-card--read, .tool-group--read)
- src/i18n/locales/zh-CN/messages.po: FOUND (re-extracted, line numbers updated)
- commit ba9181a: FOUND
- commit afa83c8: FOUND
- New hardcoded hex in styles.css: 0
- Skill("aster-design-system"): CONSULTED (SKILL.md read before CSS edits)
