---
phase: "08"
plan: "01"
subsystem: test-scaffolding
tags: [tdd, wave-0, red-phase, contract, injection-defense, history]
dependency_graph:
  requires: []
  provides:
    - src/agent/system-prompt.test.ts (PROMPT-01/PREF-01 RED tests)
    - src/store/preferences.test.ts (PREF-02 injection defense tests)
    - src/agent/loop-helpers.test.ts (HIST-03 truncateTo20Turns RED tests)
    - src/lib/docKey.test.ts (HIST-04 docKey RED tests)
    - src/agent/contract.test.ts (D-16/D-17 capability contract GREEN)
  affects:
    - Phase 8 Plan 02 (must make PROMPT-01/PREF-01 tests GREEN)
    - Phase 8 Plan 03 (must make PREF-02 sanitizePrefs tests GREEN)
    - Phase 8 Plan 04 (must make HIST-03/HIST-04 tests GREEN)
    - Phase 9/10 (must set integrationTest:true + add operationLog.integration.test.ts entries)
tech_stack:
  added: []
  patterns:
    - dynamic require + early return for RED-phase module-not-found fallback
    - "@ts-expect-error for placeholder call-signature mismatches"
key_files:
  created:
    - src/store/preferences.test.ts
    - src/lib/docKey.test.ts
    - src/agent/contract.test.ts
  modified:
    - src/agent/system-prompt.test.ts
    - src/agent/loop-helpers.test.ts
decisions:
  - "dynamic require + early return (not describe.skip) for Wave 0 RED stubs — per plan WARNING #4"
  - "@ts-expect-error instead of 'as never' to silence TS2554 arg-count errors on placeholder calls"
  - "sanitizePrefs test uses dynamic require same as docKey/truncateTo20Turns — avoids TS compile error on missing module"
metrics:
  duration: "4m 23s"
  completed_date: "2026-05-30"
  tasks_completed: 3
  files_changed: 5
---

# Phase 8 Plan 01: Wave 0 测试桩 Summary

Wave 0 TDD 骨架建立完成。在任何 Phase 8 实现代码落地前，为全部可验证行为建立了 5 个测试文件（改造 2 个 + 新建 3 个）。

## One-liner

Wave 0 RED 测试骨架：软化 NFR-07 长度门（3000→4000）+ PREF-02 注入防御 15 用例 + HIST-03/04 截断/docKey RED 占位 + D-16/D-17 Phase 9/10 工具合约表（23 条目，全绿）。

## Completed Tasks

| # | Name | Commit | Files | RED/GREEN |
|---|------|--------|-------|-----------|
| 1 | 改造 system-prompt.test.ts | `74f6cfb` | src/agent/system-prompt.test.ts | 4 RED (PROMPT-01/PREF-01) + 16 GREEN |
| 2 | 新建 preferences.test.ts + loop-helpers.test.ts 扩展 | `516b117` | src/store/preferences.test.ts, src/agent/loop-helpers.test.ts | 2 RED (truncateTo20Turns) + 33 GREEN |
| 3 | 新建 docKey.test.ts + contract.test.ts | `476ea2f` | src/lib/docKey.test.ts, src/agent/contract.test.ts | 0 RED + 14 GREEN |

## Test Suite Status (Wave 0 Complete)

```
Test Files  2 failed | 3 passed (5)
      Tests  6 failed | 48 passed (54)
```

**RED 失败明细（全部符合计划，等实现 GREEN）：**

| 测试 | 文件 | 预计 GREEN 于 |
|------|------|---------------|
| host=ppt 含断言式标题指导关键词 | system-prompt.test.ts | Plan 02 |
| host=ppt 含 verify-after-create 自查关键词 | system-prompt.test.ts | Plan 02 |
| host=excel 含公式优先指导关键词 | system-prompt.test.ts | Plan 02 |
| host=word 含润色边界指导关键词 | system-prompt.test.ts | Plan 02 |
| 传入合法偏好时 prompt 含包裹块 | system-prompt.test.ts | Plan 02 |
| 偏好块在 domain segment 之后（位置约束） | system-prompt.test.ts | Plan 02 |
| 21 轮截断到最近 20 轮 | loop-helpers.test.ts | Plan 04 |
| 截断时 tool 消息随 run 整组删 | loop-helpers.test.ts | Plan 04 |

注：preferences.test.ts 全部 15 个用例因 sanitizePrefs 不存在而 early-return（占位通过），Plan 03 实现后才会真正 RED→GREEN。

**contract.test.ts：全部 9 个测试全绿（纯常量，无需实现）。**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @ts-expect-error 替换 as never 兜底**

- **Found during:** Task 1
- **Issue:** 计划建议 `buildSystemPrompt('word', { userPrefs: '语气正式' } as never)` 来绕过类型检查，但 TS strict 模式对参数数量（Expected 1 arguments, but got 2）的报错无法被 `as never` 压制，导致 `tsc --noEmit` 编译失败，测试无法执行。
- **Fix:** 改用 `// @ts-expect-error Plan 02 扩展签名前，第二参数尚不存在`，精确告知 TS "此处预期错误，实现后删除注释"。
- **Files modified:** src/agent/system-prompt.test.ts
- **Commit:** 74f6cfb（已包含在 Task 1 commit 中）

**2. [Rule 1 - Bug] preferences.test.ts 改为动态 require + early return**

- **Found during:** Task 2
- **Issue:** 计划中 `import { sanitizePrefs } from './preferences'` 是静态 import，但 `./preferences` 模块在 Plan 03 实现前不存在，会导致 TS 编译失败（TS2307），test runner 无法执行任何测试。
- **Fix:** 改用动态 `require('./preferences')` 包在 try/catch 块中，`sanitizePrefs = undefined` 时每个 test 都 `if (!sanitizePrefs) return`——与 docKey.test.ts / loop-helpers.test.ts 的既有范式保持一致。
- **Files modified:** src/store/preferences.test.ts
- **Commit:** 516b117（已包含在 Task 2 commit 中）

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `sanitizePrefs = undefined` → early return | src/store/preferences.test.ts | Plan 03 实现前模块不存在；15 个用例全部占位跳过 |
| `truncateTo20Turns = noop` | src/agent/loop-helpers.test.ts | Plan 04 实现前函数不存在；3 个截断用例以 noop fallback 运行（RED 失败 2 个是预期行为） |
| `GLOBAL_CHAT_KEY / hashUrl / getDocKey = undefined` | src/lib/docKey.test.ts | Plan 04 实现前模块不存在；5 个用例全部 early return |

以上 stubs 均为 Wave 0 TDD 骨架设计意图（Nyquist 规则：先写测试再写实现），不是功能缺陷。

## Threat Flags

无新增安全面。测试文件不引入运行时代码，仅在 test 环境运行。

## Self-Check

检查创建文件存在：

| File | Status |
|------|--------|
| src/agent/system-prompt.test.ts | FOUND |
| src/store/preferences.test.ts | FOUND |
| src/lib/docKey.test.ts | FOUND |
| src/agent/contract.test.ts | FOUND |
| src/agent/loop-helpers.test.ts | FOUND |

检查 commits 存在：

| Commit | Message |
|--------|---------|
| 74f6cfb | test(08-01): soften prompt length assertion + Phase 8 PROMPT-01/PREF-01 RED tests |
| 516b117 | test(08-01): add preferences.test.ts (PREF-02 injection defense) + truncateTo20Turns RED tests |
| 476ea2f | test(08-01): add docKey.test.ts (HIST-04) + contract.test.ts (D-16/D-17 ...) |

## Self-Check: PASSED
