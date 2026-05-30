---
phase: "06"
plan: "01"
subsystem: "test-infrastructure"
tags: ["wave-0", "tdd-stubs", "inverse-guard", "write-tools", "onboarding", "chips", "system-prompt"]
dependency_graph:
  requires: []
  provides:
    - "src/agent/tools/write/excel.test.ts — insert_chart/apply_formula/set_cell inverse stubs"
    - "src/agent/tools/write/ppt.test.ts — set_shape_property/move_shape/set_shape_text inverse stubs"
    - "src/agent/tools/write/word.test.ts — Phase 6 新 word tool stubs 追加"
    - "src/components/ChatStream.test.tsx — host-specific chips render stubs"
    - "src/components/Onboarding/OnboardingModal.test.tsx — 单步 onboarding test stubs + Wave 0 冒烟"
    - "src/agent/system-prompt.test.ts — per-host 领域段 stubs"
  affects:
    - "Wave 1-3 实现可在 RED→GREEN 节奏中进行（stub 就位）"
    - "operationLog.integration.test 需在 Wave 2 后按新 inverse 方法扩展 case"
tech_stack:
  added: []
  patterns:
    - "describe.skip Wave 解锁注释范式（Wave 0 → Wave N 激活）"
    - "vi.hoisted 解决 vi.mock factory 顶层变量提升问题"
    - "Record<string,unknown> inverse 签名守门注释（防 Phase 5 地雷复发）"
key_files:
  created:
    - src/agent/tools/write/excel.test.ts
    - src/agent/tools/write/ppt.test.ts
    - src/components/Onboarding/OnboardingModal.test.tsx
  modified:
    - src/agent/tools/write/word.test.ts
    - src/components/ChatStream.test.tsx
    - src/agent/system-prompt.test.ts
decisions:
  - "system-prompt per-host 断言也用 describe.skip（而非直接 RED），防止 CI 新增 FAIL——与计划 verification 备注一致"
  - "OnboardingModal.test.tsx Wave 0 冒烟测（基础渲染 + 跳过写 storage）不 skip，即时有效，验证 import 链路完整"
  - "vi.hoisted 修复 vi.mock factory 顶层变量引用（Rule 3 auto-fix，阻塞 OnboardingModal mock 工厂）"
metrics:
  duration: "~7 min"
  completed: "2026-05-30T03:49:59Z"
  tasks_completed: 2
  files_modified: 6
---

# Phase 6 Plan 01: Wave 0 测试桩 Summary

**一句话概括：** 为 Phase 6 全部 write tool、UI chips、Onboarding 单步化、system prompt per-host 断言建立 6 个测试桩文件，以 describe.skip 保证 Wave 0 不新增 FAIL，Wave 1-3 实现后逐步解锁 RED→GREEN。

## Tasks Completed

| # | Task | Commit | Key Artifacts |
|---|------|--------|---------------|
| 1 | Excel/PPT/Word write tool 测试桩（RED 阶段） | `86e67eb` | excel.test.ts（新建）/ ppt.test.ts（新建）/ word.test.ts（扩展） |
| 2 | ChatStream/OnboardingModal/system-prompt 扩展 | `63cd408` | ChatStream.test.tsx（扩展）/ OnboardingModal.test.tsx（新建）/ system-prompt.test.ts（扩展） |

## Verification

```
npx vitest run src/agent/tools/write/excel.test.ts ... (6 files)
PASS (33) FAIL (0) — 30 passed, 33 skipped（skip 不算 fail）

npm test -- --run（全套）
45 passed | 2 skipped (47 files)
530 passed | 36 skipped (566 tests)
3 errors = 预存在 retry.test.ts flaky（Phase 04.1 已记录，单跑 9/9 PASS，非本次引入）
```

### Grep 验证

- `excel.test.ts` 含 `delete_chart_by_name` ✅
- `ppt.test.ts` 含 `restore_shape_text`（set_shape_text TOOL-03 P1）✅
- `word.test.ts` 含 `Record<string, unknown>`（inverse 签名守门）✅
- `ChatStream.test.tsx` 含「帮我做一份 Q3 销售复盘 PPT」✅

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vi.mock factory 顶层变量引用**
- **发现于：** Task 2 OnboardingModal.test.tsx 运行时
- **问题：** `const mockStorageSet = vi.fn()` 定义在 `vi.mock('../../lib/storage', () => ...)` factory 外部，vi.mock 被提升到文件顶部导致 `mockStorageSet` 此时未定义，报 vitest error
- **修复：** 改用 `vi.hoisted(() => ({ mockStorageSet: vi.fn() }))` 确保 mock 工厂内可正确引用变量
- **文件：** src/components/Onboarding/OnboardingModal.test.tsx
- **Commit：** `63cd408`

**2. [Rule 3 - Blocking] ChatStream props 缺 onSettings**
- **发现于：** Task 2 ChatStream chips 测试桩 TypeScript 检查
- **问题：** chips 测试 helper 中 `<ChatStream />` 未传 `onSettings` prop（接口必填），导致 tsc 报错
- **修复：** 改为 `<ChatStream onSettings={() => {}} />`
- **文件：** src/components/ChatStream.test.tsx（chips describe.skip 内）
- **Commit：** `63cd408`

**3. [Assumption] system-prompt per-host 断言使用 describe.skip 而非直接 RED**
- **原因：** 计划 verification 注释「若 RED 影响 CI 则也用 skip」——当前 `buildSystemPrompt` 无 per-host 领域段，3 个断言都会 RED，导致 CI 新增 FAIL
- **决策：** 用 `describe.skip` 包裹，注释「Wave 3 实现后取消 skip」，保持 npm test 零新增 FAIL
- **影响：** Wave 3（06-08-PLAN）实现 per-host 领域段后，同步取消 skip

## Known Stubs

以下为明确的 Wave 0 占位桩（预期行为，非缺陷）：

| 文件 | describe 块 | 解锁 Wave |
|------|-------------|-----------|
| excel.test.ts | insert_chart/apply_formula/set_cell | Wave 2 |
| ppt.test.ts | set_shape_property/move_shape/set_shape_text | Wave 2/3 |
| word.test.ts | insert_paragraph/replace_paragraph/insert_text_at_cursor/replace_selection | Wave 2 |
| ChatStream.test.tsx | CHIPS-01 host-specific chips | Wave 3 |
| OnboardingModal.test.tsx | 单步化 ONB-01/02/03 | Wave 3 |
| system-prompt.test.ts | per-host 领域段（list_slides 等）| Wave 3 |

OnboardingModal.test.tsx 的 Wave 0 冒烟测（基础渲染 + 跳过写 storage）**非**桩，即时有效。

## Self-Check: PASSED

文件存在检查：
- `src/agent/tools/write/excel.test.ts` ✅
- `src/agent/tools/write/ppt.test.ts` ✅
- `src/agent/tools/write/word.test.ts` ✅（修改）
- `src/components/ChatStream.test.tsx` ✅（修改）
- `src/components/Onboarding/OnboardingModal.test.tsx` ✅
- `src/agent/system-prompt.test.ts` ✅（修改）

Commit 存在检查：
- `86e67eb` ✅（Task 1）
- `63cd408` ✅（Task 2）
