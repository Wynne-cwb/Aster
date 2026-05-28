# Phase 03 — Deferred Items（不在本阶段任一 plan 范围内的发现）

记录 Phase 3 plans 执行期间发现、但不属于当前 plan 范围的预存在问题。
按 SCOPE BOUNDARY 规则，executors 只修当前 task 直接引入的问题。

## 03-02 Plan execution（errors-foundation）

### Vitest "Unhandled Errors" / "Unhandled Rejection" — retry.test.ts / queue.test.ts

**Discovered during:** 03-02 GREEN phase `npm test` 运行
**Status:** Pre-existing — baseline 同样有 3 个 Unhandled Errors（与 errors/index.ts 改造无关）
**Scope:** 不在 ERR-01 / ERR-02 范围

**Symptom:**
```
⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'NETWORK', category: 'provider', recoverable: true, hint: '网络异常，请检查连接后重试' }
This error originated in "src/providers/retry.test.ts" test file.

Serialized Error: { code: 'RATE_LIMIT', category: 'provider', recoverable: true, hint: '请稍后再试（已退避）', retryAfterSeconds: undefined }
This error originated in "src/providers/queue.test.ts" test file.

Tests  210 passed (210)
Errors  3 errors
```

**Root cause hypothesis:** retry.test.ts / queue.test.ts 内有 setTimeout-backed retry promises 在测试 it() 已 resolve / cleanup 后才 reject，逃过了 await + reject 捕获。属于 retry/queue 测试基础设施的 async lifecycle bug，与本 plan 的 AsterError 子类四字段无关。

**Verification:** stash plan changes 后 `npm test` 仍报同样的 3 个 Unhandled Errors，证明非 03-02 引入。

**Suggested follow-up:** retry/queue 维护者复查 test 内 `await Promise.all([...])` 是否漏掉某个分支，或 retry loop 是否在 cancel / abort 路径上漏 await。本期不动。

## 03-05 Plan execution（chatStore-core）

### Orphan CSS — ToolCallPreviewCard / FallbackInsertMenu 系列

**Discovered during:** 03-05 Task 5.1 ChatBubble 三组件删除后
**Status:** Pre-existing — Plan 05 删了 JS/TSX 引用但 CSS 类仍在 styles.css
**Scope:** 不在 Plan 05 范围（CSS cleanup 归 Plan 06 chat-ui-cleanup 接力，与 ChatStream
role='tool' 折叠卡新 CSS 一并整理）

**Symptom:**
- `src/styles.css` 仍含 `.aster-tool-card*` / `.aster-insert-btn*` / `.aster-insert-menu*`
  系列规则（13 处匹配；约 80 行 CSS）
- 不影响 build / runtime；只是无用 selector

**Suggested follow-up:** Plan 06（chat-ui-cleanup）在新增 role='tool' 折叠卡 CSS 时
一并删除这些孤儿 selector；最终交付时 CSS 行数 / gzip size 应进一步下降。

