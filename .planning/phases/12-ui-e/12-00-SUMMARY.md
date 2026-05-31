---
phase: 12-ui-e
plan: "00"
subsystem: utils/test
tags: [ui, security, tdd, xss, wave-0, test-stubs]
dependency_graph:
  requires: []
  provides:
    - safeUrlTransform XSS 防御函数（UI-01）
    - Wave 0 RED 测试桩（UI-01 DOM / UI-02 / UI-03 / UI-05）
  affects:
    - src/utils/safeUrlTransform.ts
    - src/utils/safeUrlTransform.test.ts
    - src/components/ChatBubble.test.tsx
    - src/components/ChatStream.test.tsx
    - src/agent/loop-helpers.test.ts
tech_stack:
  added: []
  patterns:
    - safeUrlTransform allowlist (new URL().protocol + Set lookup)
    - jsdom DOM-level XSS assertion (container.querySelector)
    - TDD RED stubs for Wave 1/2/3 implementation gates
key_files:
  created:
    - src/utils/safeUrlTransform.ts
    - src/utils/safeUrlTransform.test.ts
    - src/components/ChatBubble.test.tsx
  modified:
    - src/components/ChatStream.test.tsx (+170 lines: UI-02/03/05 stubs)
    - src/agent/loop-helpers.test.ts (+14 lines: UI-05 kind placeholder)
decisions:
  - safeUrlTransform returns '' not null (null serializes as "null" string in href)
  - ChatBubble.test.tsx all 5 GREEN at Wave 0: react-markdown defaultUrlTransform already blocks javascript:/data:/vbscript:; Wave 1 wires safeUrlTransform for stricter tested allowlist
  - UI-02-A RED: ChatStream has no showTyping logic yet; Wave 2 (12-03) implements it
  - UI-05-A RED: ChatStream ToolResultCard has no --read class logic yet; Wave 2 (12-03) adds it
metrics:
  duration: "~4 minutes (256 seconds)"
  completed: "2026-05-31"
  tasks: 3
  files: 5
---

# Phase 12 Plan 00: Wave 0 测试桩 Summary

**One-liner:** Wave 0 TDD 基础设施——safeUrlTransform XSS 防御工具函数（8 个 unit 测试全 GREEN）+ UI-01/02/03/05 RED 测试桩（为后续 Wave 1/2/3 实现守门）。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | safeUrlTransform.ts + test（UI-01 GREEN） | ceada3c | src/utils/safeUrlTransform.ts, src/utils/safeUrlTransform.test.ts |
| 2 | ChatBubble.test.tsx（UI-01 DOM 断言） | 7b62195 | src/components/ChatBubble.test.tsx |
| 3 | ChatStream.test.tsx + loop-helpers.test.ts 扩展（UI-02/03/05 RED 桩） | 14f9c58 | src/components/ChatStream.test.tsx, src/agent/loop-helpers.test.ts |

## Test Results Summary

### GREEN 测试（Wave 0 末尾 PASS）

| Test File | Tests | Status |
|-----------|-------|--------|
| src/utils/safeUrlTransform.test.ts | 8（UI-01-A..H） | GREEN |
| src/components/ChatBubble.test.tsx | 5（UI-01-A..E DOM 级别） | GREEN |
| ChatStream UI-02-B | content 非空 → .bubble-typing 消失 | GREEN |
| ChatStream UI-02-C | agentStatus idle → 无 .bubble-typing 残留 | GREEN |
| ChatStream UI-03-A | nodes 定义（软断言） | GREEN |
| ChatStream UI-03-B | DiffLogPanel 去重 ≤1 | GREEN |
| ChatStream UI-05-B | write 卡不含 --read 类 | GREEN |
| loop-helpers UI-05 kind | 占位测试 | GREEN |

注：ChatBubble.test.tsx UI-01-A/B/D/E 在 Wave 0 也全部 GREEN——react-markdown@9.1.0 的 `defaultUrlTransform` 已内置拦截 `javascript:`/`data:`/`vbscript:`。Wave 1 接线 `safeUrlTransform` 后提供更严格、可测的白名单防御，测试仍 GREEN。

### RED 测试桩（Wave 0 末尾 FAIL，为预期 TDD RED 状态）

| Test | 失败原因 | 实现计划 |
|------|----------|----------|
| ChatStream UI-02-A: `.bubble-typing` 出现 | ChatStream 尚无 showTyping 逻辑 | Wave 2（12-03-PLAN）添加 showTyping 条件 |
| ChatStream UI-05-A: kind=read 卡含 `--read` 类 | ChatStream ToolResultCard 尚无 kind 检查 | Wave 2（12-03-PLAN）添加 cardClass 扩展 |

**vitest 最终计数：** 731 total, 729 passed, **2 failed（均为预期 RED 桩）**

**基线对比：** Wave 0 前 710 passed → Wave 0 后 729 passed（+19 新测试用例）

## TypeScript 状态

`tsc --noEmit` 通过（0 类型错误）。

## i18n 状态

messages.po **无需重新提取**——Wave 0 仅新增测试文件，未添加任何 `<Trans>` 或 `t\`\`` 宏。`src/i18n/coverage.test.ts` PASS。

## Deviations from Plan

### 偏差（细节调整）

**1. [Rule 1 - Observation] ChatBubble.test.tsx UI-01-A/B/D/E 在 Wave 0 为 GREEN 而非 RED**

- **发现于：** Task 2 验证
- **情况：** 计划说这 4 个 DOM 测试在 Wave 0"可能 RED"（ChatBubble 尚无 urlTransform prop）。实际测试全部 GREEN，因为 react-markdown@9.1.0 的内置 `defaultUrlTransform` 已过滤 `javascript:`/`data:`/`vbscript:` 协议。
- **处理：** 保持 GREEN 状态，无需修改。Wave 1 接线 safeUrlTransform 后测试仍 GREEN（严格白名单，无副作用）。
- **结论：** 对安全性更有利——react-markdown 默认已提供基础防御，自写白名单是额外加固层。

**2. [Info] useAgentStore.setState 中新增 completedRunIds 字段**

- **发现于：** Task 3 开发
- **情况：** 现有 ChatStream.test.tsx 的 `useAgentStore.setState` 调用未包含 `completedRunIds`，新 UI-02/03/05 describe 块需要加此字段以防止 store 遗留状态跨测试污染。
- **处理：** 新增的 describe 块均在 `beforeEach` 内加入 `completedRunIds: []`，用 `as never` 保持一致风格。

## Known Stubs

| Stub | File | 说明 |
|------|------|------|
| `expect(true).toBe(true)` | loop-helpers.test.ts (UI-05 kind) | 占位测试，Wave 1（12-02-PLAN）实现 loop-helpers.ts kind 字段写入后替换为 spy 断言 |

## Threat Flags

无新增安全面——本计划仅新增测试文件，未修改任何运行时代码路径。`safeUrlTransform.ts` 本身是防御性代码，尚未 wire 进 ChatBubble（Wave 1 接线）。

## Self-Check: PASSED

文件存在检查：
- src/utils/safeUrlTransform.ts: FOUND
- src/utils/safeUrlTransform.test.ts: FOUND
- src/components/ChatBubble.test.tsx: FOUND

提交存在检查：
- ceada3c: FOUND（safeUrlTransform）
- 7b62195: FOUND（ChatBubble.test.tsx）
- 14f9c58: FOUND（ChatStream + loop-helpers 扩展）
