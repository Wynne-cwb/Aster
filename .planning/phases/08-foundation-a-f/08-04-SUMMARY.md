---
phase: "08"
plan: "04"
subsystem: persistence-full-chain
tags: [tdd, green, docKey, localStorage, truncation, chat-history, hist-01, hist-02, hist-03, hist-04]
dependency_graph:
  requires:
    - src/lib/storage.ts (STORAGE_KEYS.CHAT_HISTORY_PREFIX, storage.get/set/remove)
    - src/store/preferences.ts (usePreferencesStore.getState().loadPrefs/userPrefs)
    - src/errors/index.ts (StorageQuotaError)
    - src/lib/docKey.test.ts (Wave 0 RED stubs — Plan 01)
    - src/agent/loop-helpers.test.ts (truncateTo20Turns RED stubs — Plan 01)
  provides:
    - src/lib/docKey.ts (getDocKey + hashUrl + GLOBAL_CHAT_KEY)
    - src/store/chat.ts (loadHistory + saveHistory + clearHistory(docKey?) extension)
    - src/agent/loop-helpers.ts (truncateTo20Turns export)
    - src/agent/loop.ts (userPrefs injection + history truncation + saveHistory wiring)
    - src/main.tsx (Phase 8 hydrate: loadPrefs + getDocKey + loadHistory)
  affects:
    - Phase 9/10 (loop.ts now includes history context; saveHistory called each turn)
    - Phase 13 UAT (刷新后历史可见 HIST-01 verified end-to-end)
tech_stack:
  added: []
  patterns:
    - hashUrl: URL.pathname 末 80 字符 → btoa URL-safe（防 T-08-tokenleak SharePoint session token）
    - serializeForStorage: 白名单过滤（user/assistant only，≤2000 chars，drop tool/error/streaming）
    - truncateTo20Turns: user 消息计数，整 run 删除（user+assistant+tool 整组，防孤立 tool 消息）
    - saveHistory: 仅正常结束调用；QuotaExceeded → 丢最旧 20% 重试
    - getDocKey: 同步 Office.context.document.url → 异步 getFilePropertiesAsync → GLOBAL_CHAT_KEY fallback
    - main.tsx hydrate 顺序: hydrateFromStorage → loadPrefs → getDocKey → loadHistory → render
key_files:
  created:
    - src/lib/docKey.ts
  modified:
    - src/lib/docKey.test.ts (dynamic require stubs → direct import, 8 tests GREEN)
    - src/agent/loop-helpers.ts (truncateTo20Turns export appended)
    - src/agent/loop-helpers.test.ts (noop fallback → direct import, BLOCKER #1 fixed)
    - src/store/chat.ts (loadHistory + saveHistory + clearHistory(docKey?) + serializeForStorage)
    - src/store/chat.test.ts (HIST-01/02 persistence tests appended, 3 tests GREEN)
    - src/agent/loop.ts (getDocKey + usePreferencesStore + truncateTo20Turns + saveHistory wiring)
    - src/main.tsx (Phase 8 hydrate sequence before render)
decisions:
  - "hashUrl 只取 pathname（不含 query/hash）防止 SharePoint 的 session token 写入 localStorage key"
  - "truncateTo20Turns 整 run 删除（从第 N-20 个 user 消息的索引 slice），tool 消息随 run 整组丢弃"
  - "saveHistory 仅正常结束（toolCallsThisTurn.length===0 分支）调用，error/abort 路径豁免（消息不完整不保存）"
  - "serializeForStorage 白名单：只存 role=user/assistant；丢弃 tool/error/isStreaming=true 中间态"
  - "StorageQuotaError: 丢最旧 20% 重试一次；二次失败静默不影响 UI"
  - "loop-helpers.test.ts tool 消息字段改为 role: 'tool' as const（Rule 1 TypeScript strict 类型修复）"
metrics:
  duration: "~10m"
  completed_date: "2026-05-30"
  tasks_completed: 2
  files_changed: 7
---

# Phase 8 Plan 04: 持久化 F 全链路实现 Summary

docKey 分文档 key 构建（pathname 防 token 泄露）+ 20 轮截断（整 run 删除）+ chat history localStorage 往返 + loop.ts/main.tsx 接线——Wave 0 RED 测试（HIST-03/04）全部 GREEN，全套 655/655 通过。

## One-liner

hashUrl 取 pathname 末 80 字符防 SharePoint session token 泄露，truncateTo20Turns 整 run 删除保证 tool 消息不孤立，saveHistory/loadHistory 经 storage.* 持久化聊天历史，loop.ts 注入 userPrefs + 历史截断，main.tsx 在 render 前三步 hydrate——HIST-01~04 全部落地。

## Completed Tasks

| # | Name | Commit | Files | Status |
|---|------|--------|-------|--------|
| 1 | 新建 docKey.ts + 扩展 loop-helpers.ts（truncateTo20Turns） | `0348d58` | src/lib/docKey.ts, src/lib/docKey.test.ts, src/agent/loop-helpers.ts, src/agent/loop-helpers.test.ts | 13/13 GREEN |
| 2 | chat.ts 扩展 + loop.ts 接线 + main.tsx hydrate | `c8752ac` | src/store/chat.ts, src/store/chat.test.ts, src/agent/loop.ts, src/main.tsx | 655/655 GREEN |

## Architecture: docKey Strategy

```
Office.context.document.url (sync)
  └─► hashUrl(url)
        └─► new URL(url).pathname.slice(-80) → btoa-url-safe → "aster:chat:{hash}"
              ↑ query/hash dropped (T-08-tokenleak mitigation)
  
  fallback 1: getFilePropertiesAsync (async, Office Desktop)
  fallback 2: GLOBAL_CHAT_KEY = "aster:chat:global"
```

## Architecture: truncateTo20Turns

```
messages: [u0,a0,t0, u1,a1,t1, ... u20,a20,t20]
userIndices.length = 21 > 20
cutIdx = userIndices[21-20] = index of u1
result = messages.slice(cutIdx) → [u1,a1,t1, ... u20,a20,t20]
# u0+a0+t0 整组删除，t 消息不孤立
```

## Architecture: Hydrate Sequence in main.tsx

```
Office.onReady(async) → createAdapter
  → hydrateFromStorage()      // providers store
  → loadPrefs()               // preferences store
  → docKey = await getDocKey() // per-doc key
  → loadHistory(docKey)        // chat history
  → root.render(...)           // React tree
```

## Test Results

```
Task 1 (docKey + loop-helpers):
  docKey.test.ts: 8/8 GREEN (GLOBAL_CHAT_KEY + hashUrl 5 cases + getDocKey fallback)
  loop-helpers.test.ts: 5/5 GREEN (streamAssistantTurn 2 + truncateTo20Turns 3)

Task 2 (chat.ts + loop.ts + main.tsx):
  chat.test.ts: 12/12 GREEN (9 existing + 3 new HIST-01/02 persistence)
  
Full suite: 655/655 GREEN (52 test files)
Build: main-*.js 74.45 KB gzip (≤82KB budget ✓)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] loop-helpers.test.ts tool 消息缺少 `as const` 类型注解**
- **Found during:** Task 1 测试运行（tsc --noEmit 报错）
- **Issue:** 测试中 `{ role: 'tool', content: '', tool_call_id: 'tc0' }` 的 role 被推断为 `string`，不兼容 `Message.role: 'user' | 'assistant' | 'tool' | 'error'`；`tool_call_id` 字段也不在 Message 接口里
- **Fix:** 改为 `role: 'tool' as const`，移除 `tool_call_id`（测试只验证 id，不需要该字段）
- **Files modified:** src/agent/loop-helpers.test.ts
- **Commit:** `0348d58`（包含在 Task 1 commit 中）

## Threat Flags

无新增安全面。T-08-tokenleak 已由 hashUrl pathname 截取缓解；T-08-quota 已由 StorageQuotaError catch + 丢最旧 20% 缓解；T-08-deser 已由 version 验证 + Array 检查缓解；T-08-tooldata 已由 serializeForStorage 白名单缓解。

## Self-Check

检查创建/修改文件存在：

| File | Status |
|------|--------|
| src/lib/docKey.ts | FOUND |
| src/lib/docKey.test.ts (修改) | FOUND |
| src/agent/loop-helpers.ts (修改) | FOUND |
| src/agent/loop-helpers.test.ts (修改) | FOUND |
| src/store/chat.ts (修改) | FOUND |
| src/store/chat.test.ts (修改) | FOUND |
| src/agent/loop.ts (修改) | FOUND |
| src/main.tsx (修改) | FOUND |

检查 commits 存在：

| Commit | Message |
|--------|---------|
| 0348d58 | feat(08-04): add docKey.ts + truncateTo20Turns — HIST-03/HIST-04 GREEN |
| c8752ac | feat(08-04): wire chat persistence full-chain — HIST-01/02/03 GREEN |

## Self-Check: PASSED
