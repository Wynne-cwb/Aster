---
phase: "06"
plan: "10"
subsystem: "chat-ui"
tags: ["chips", "empty-state", "draftPrompt", "killer-scenarios", "d15", "d16", "onb-03"]
dependency_graph:
  requires:
    - "06-01 — Wave 0 ChatStream.test.tsx chips 桩（CHIPS-01 describe.skip）"
  provides:
    - "chatStore.draftPrompt / setDraftPrompt / clearDraftPrompt（chip fill 机制）"
    - "ChatStream 空态 host-specific chips（ppt/excel/word 各 3 条，seed 锁定）"
    - "InputBar useEffect 监听 draftPrompt，填充后 focus textarea"
    - "styles.css .suggestions 容器 + chip hover translateX(2px)"
  affects:
    - "所有三宿主的空态 UX：chip 点击填充 InputBar，引导用户进入 killer scenario"
    - "Wave 4 UAT checkpoint（三宿主 smoke 验收）将测试 chip 填充行为"
tech_stack:
  added: []
  patterns:
    - "chatStore draftPrompt 单向数据流：chip → store → InputBar useEffect → text state"
    - "host-specific 静态 CHIPS Record<string, chip[]>（零 bundle，字符串字面量）"
    - "CSS .suggestions flex-column + .btn.btn-ghost.btn-sm 复用既有 teal 克制按钮体系"
key_files:
  created: []
  modified:
    - src/store/chat.ts
    - src/components/InputBar.tsx
    - src/components/ChatStream.tsx
    - src/components/ChatStream.test.tsx
    - src/styles.css
decisions:
  - "CHIPS 数据结构放在 ChatStream 组件函数体内（messages.length === 0 分支之前），避免 module-level 全局变量，清晰表达「只在空态时用」"
  - "InputBar 新增 textareaRef：chip 填充后自动 focus，减少用户额外点击"
  - "useChatStore hook 调用放在 messages.length === 0 分支之前（react-hooks/rules-of-hooks 要求 hook 不在条件内）"
  - "测试新增 CHIPS-01-E（host=unknown 降级）和 CHIPS-01-F（文案验证），超出原计划 4 个，补全边界覆盖"
metrics:
  duration: "~3 min"
  completed: "2026-05-30T05:06:24Z"
  tasks_completed: 2
  files_modified: 5
---

# Phase 6 Plan 10: Empty-State Killer-Scenario Chips Summary

**一句话概括：** 为三宿主空态添加 host-specific killer-scenario chips（ppt/excel/word 各 3 条），chip 点击填充 InputBar（D-16 不直发）；通过 chatStore draftPrompt 单向数据流协调 ChatStream ↔ InputBar。

## Tasks Completed

| # | Task | Commit | Key Artifacts |
|---|------|--------|---------------|
| 1 | chatStore draftPrompt + InputBar 接线 | `7bded96` | chat.ts（新增 3 字段）/ InputBar.tsx（useEffect + ref） |
| 2 | ChatStream 空态 chips + 测试 GREEN | `22a743d` | ChatStream.tsx（实现 D-15/D-16）/ styles.css（.suggestions）/ ChatStream.test.tsx（6 新测试） |

## Verification

```
npm test -- --run src/components/ChatStream.test.tsx
PASS (22 tests) — 含新增 CHIPS-01 A/B/C/D/E/F 6 个

npm run build && npm run size
Size: 73 kB gzipped ≤ 82 kB ✅（EXIT 0）
```

### Grep 验证

- `grep "setDraftPrompt\|CHIPS\|suggestions" ChatStream.tsx` ✅（各存在）
- `grep "或挑一个下面的例子" ChatStream.tsx` ✅（新文案）
- `grep "draftPrompt" InputBar.tsx` ✅（监听接线）
- `grep -c "draftPrompt\|setDraftPrompt\|clearDraftPrompt" chat.ts` = 6 ✅

## Deviations from Plan

### 超出计划（Rule 2 — 补全边界覆盖）

**1. [Rule 2 - Auto-add] 测试补充 CHIPS-01-E（unknown host 降级）+ CHIPS-01-F（文案验证）**
- **发现于：** Task 2 写测试时
- **原计划：** 4 个测试（A/B/C/D）
- **补充：** E（host=unknown 渲染空 .suggestions 不报错）+ F（空态文案验证）
- **理由：** Plan 成功标准明确「host 未知时渲染空不报错」，需测试覆盖；文案验证属正确性需求
- **文件：** src/components/ChatStream.test.tsx
- **Commit：** `22a743d`

**2. [Rule 2 - Auto-add] CSS .suggestions 新增 justify-content: flex-start + text-align: left**
- **发现于：** Task 2 styles.css 实现时
- **原计划：** 只需 hover translateX(2px)
- **补充：** chip 左对齐（UI-SPEC §1 anatomy「label 13px left-aligned」）
- **文件：** src/styles.css
- **Commit：** `22a743d`

**3. [Assumption] useChatStore hook 调用位置**
- hook 调用（`const setDraftPrompt = useChatStore(...)`）放在 `messages.length === 0` 分支之前，避免 react-hooks/rules-of-hooks 警告（hook 不能在条件内调用）
- Plan 伪代码把 CHIPS 定义放在条件内部，已调整位置但保持等价语义

## Known Stubs

无。Plan 目标完整实现：chip 渲染 + 填充机制 + 测试覆盖均已交付。

## Threat Flags

无新增安全相关 surface。chip seed 为硬编码字符串字面量（T-06-10-01 accept），draftPrompt 为 UI 临时内存状态（T-06-10-02 accept），均在 Plan threat model 范围内。

## Self-Check: PASSED

文件存在检查：
- `src/store/chat.ts` ✅（修改）
- `src/components/InputBar.tsx` ✅（修改）
- `src/components/ChatStream.tsx` ✅（修改）
- `src/components/ChatStream.test.tsx` ✅（修改）
- `src/styles.css` ✅（修改）

Commit 存在检查：
- `7bded96` ✅（Task 1）
- `22a743d` ✅（Task 2）

Build + size 检查：
- `npm run build` ✅（TypeScript 无错）
- `npm run size` ✅（73 kB ≤ 82 kB）

测试检查：
- `npm test -- --run src/components/ChatStream.test.tsx` ✅（22/22 PASS）
