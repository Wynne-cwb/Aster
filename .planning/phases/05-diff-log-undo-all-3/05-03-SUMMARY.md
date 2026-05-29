---
phase: 05-diff-log-undo-all-3
plan: "03"
subsystem: storage-guard + agent-state + eslint-policy
tags:
  - storage
  - quota-guard
  - agent-store
  - eslint
  - d-14
  - d-15
  - agent-07
  - nfr-05
dependency_graph:
  requires:
    - "05-01"  # storage.test.ts quota guard stubs
  provides:
    - StorageQuotaError (src/errors/index.ts)
    - storage.ts quota guard setItem try/catch
    - agentStore.completedRunIds + useCompletedRunIds selector
    - eslint.config.js D-15 flip 策略文档化
  affects:
    - src/lib/storage.ts
    - src/errors/index.ts
    - src/agent/agentStore.ts
    - eslint.config.js
tech_stack:
  added: []
  patterns:
    - AsterError 子类范式（StorageQuotaError 按 UnsupportedOperationError 范式）
    - Zustand functional updater（set(s => ...) 读旧 state 追加 completedRunIds）
key_files:
  created: []
  modified:
    - src/lib/storage.ts
    - src/errors/index.ts
    - src/agent/agentStore.ts
    - eslint.config.js
    - src/lib/storage.test.ts
decisions:
  - "storage.ts 从 errors/index.ts import StorageQuotaError（非从 storage.ts 重出口），避免循环引用"
  - "endRun 用 functional updater set(s => ...) 读旧 completedRunIds 追加，避免闭包过时引用"
  - "loop.test.ts soft-landing 失败为预存在 bug（Phase 05-01 之前已存在），不在本计划范围内"
metrics:
  duration: "4min"
  completed_date: "2026-05-30"
  tasks_completed: 2
  files_modified: 5
---

# Phase 05 Plan 03: Storage Quota Guard + agentStore.completedRunIds + ESLint D-15 策略 Summary

**One-liner:** localStorage QuotaExceededError → StorageQuotaError 业务化（D-14）+ agentStore.completedRunIds 为 DiffLogPanel 挂载铺路（AGENT-07）+ eslint D-15 flip 策略文档化。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | quota guard 失败测试（TDD RED） | `git rev-parse --short HEAD~2` | src/lib/storage.test.ts |
| 1 | storage quota guard + StorageQuotaError + agentStore.completedRunIds | 6985c7b | src/lib/storage.ts, src/errors/index.ts, src/agent/agentStore.ts |
| 2 | eslint.config.js D-15 flip 策略注释更新 | 94e2462 | eslint.config.js |

## What Was Built

### Task 1: Storage Quota Guard + StorageQuotaError + agentStore.completedRunIds

**StorageQuotaError（src/errors/index.ts）:**
- 新增 `StorageQuotaError extends AsterError`，按 `UnsupportedOperationError` 范式实现
- `recoverable = false`，`code = 'STORAGE_QUOTA'`，`category = 'adapter'`
- hint: `'浏览器存储空间已满，请清理浏览器数据后重试'`（中文字面量）
- T-05-03-01 Denial of Service 威胁缓解（用户得到业务错误而非裸 DOMException）

**storage.ts quota guard（src/lib/storage.ts）:**
- `set()` 方法包 try/catch
- 捕获 `DOMException`：name === 'QuotaExceededError' 或 legacy code === 22 → throw `new StorageQuotaError()`
- 其余异常原样 rethrow
- 导入 `StorageQuotaError` from `'../errors/index'`

**agentStore.completedRunIds（src/agent/agentStore.ts）:**
- `AgentState` interface 新增 `completedRunIds: string[]`
- 初始值 `completedRunIds: []`
- `endRun()` 改为 functional updater：取 `currentRunId`，非 null 时追加到 `completedRunIds`
- 新增 selector：`export const useCompletedRunIds = () => useAgentStore((s) => s.completedRunIds);`
- Wave 4 DiffLogPanel 将订阅此 selector 渲染已完成 run 列表

**TDD 周期:**
- RED: 展开 storage.test.ts 中 4 个 `it.todo` 为真实失败测试（StorageQuotaError 不存在时 fail）
- GREEN: 实现 StorageQuotaError + quota guard → 21 PASS

### Task 2: ESLint D-15 Flip 策略文档化

**eslint.config.js 注释更新:**
- `aster/require-human-label: 'off'` 保持不变（rule 严重度不改）
- 注释说明 D-15 flip 策略已确认（2 层守门）：
  1. 注册层：`assertWriteToolRegisterable`（Plan 07 Task 2 实现）——kind='write' 缺 humanLabel → throw Error
  2. Test 层：`expect(result.reverse).toBeDefined()`（src/agent/tools/write/word.test.ts line 85）
- 记录 eslint rule 保持 'off' 的理由：no-restricted-syntax 精度不足区分 write tool，false positive 风险

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run src/lib/storage.test.ts` | 21 PASS ✅ |
| `npx vitest run src/agent/` | 115 PASS, 1 FAIL（预存在 loop.test.ts soft-landing，非本计划回归）✅ |
| `grep -c StorageQuotaError src/lib/storage.ts` | 4（≥1）✅ |
| `grep -c completedRunIds src/agent/agentStore.ts` | 4（≥3）✅ |
| `grep assertWriteToolRegisterable eslint.config.js` | 2 处（注释中含此 helper 名）✅ |
| `npx tsc --noEmit` | 无 error ✅ |
| `npm run build && npm run size` | 81.23 KB ≤ 82 KB ✅ |
| `npx eslint src/agent/tools/write/` | No issues found ✅ |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — 所有实现均为功能完整代码；`completedRunIds` 字段为真实数据（不是硬编码 `[]`，endRun 时会追加）。

## Threat Flags

No new threat surface introduced beyond what was in the threat model. `StorageQuotaError` 专门缓解 T-05-03-01。

## Self-Check: PASSED

- src/lib/storage.ts: FOUND ✅
- src/errors/index.ts: FOUND (StorageQuotaError) ✅
- src/agent/agentStore.ts: FOUND (completedRunIds) ✅
- eslint.config.js: FOUND (assertWriteToolRegisterable in comments) ✅
- Commits 6985c7b, 94e2462: confirmed in git log ✅
