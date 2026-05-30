---
phase: "08"
plan: "03"
subsystem: preferences-store
tags: [zustand, injection-defense, storage, pref-01, pref-02, tdd-green]
dependency_graph:
  requires:
    - src/lib/storage.ts (STORAGE_KEYS 常量基础)
    - src/store/preferences.test.ts (Plan 01 Wave 0 RED stubs)
  provides:
    - src/store/preferences.ts (usePreferencesStore + sanitizePrefs)
    - src/lib/storage.ts (USER_PREFERENCES + CHAT_HISTORY_PREFIX constants)
  affects:
    - Phase 8 Plan 04 (loop.ts 可读取 usePreferencesStore.getState().userPrefs)
    - Phase 8 Plan 05 (SettingsPanel UI 可接 usePreferencesStore)
tech_stack:
  added: []
  patterns:
    - Zustand create + 初始值从 storage 读取（同 providers.ts attachEnabled 模式）
    - INJECTION_KEYWORDS includes-based 大小写不敏感扫描（无正则，避免灾难性回溯）
    - sanitizePrefs 单一清洗点：三道门（空/超长/注入词）→ null，合法 → trim
key_files:
  created:
    - src/store/preferences.ts
  modified:
    - src/lib/storage.ts
    - src/store/preferences.test.ts
    - src/lib/storage.test.ts
decisions:
  - "sanitizePrefs 用 String.includes 而非正则——保持简单，避免正则引擎灾难性回溯（Rule 2 安全考量）"
  - "setPrefs 存原始文本（rawInput）到 storage，sanitize 后结果写 userPrefs——文本框显示保留用户原始输入，LLM 注入点只拿 sanitized 值"
  - "storage.ts 新增常量遵循现有 SCREAMING_SNAKE_CASE + aster: namespace 前缀约定，向后兼容（不修改任何已有 key）"
metrics:
  duration: "4m 4s"
  completed_date: "2026-05-30"
  tasks_completed: 2
  files_changed: 4
---

# Phase 8 Plan 03: 偏好基础设施 Summary

preferences Zustand store + sanitizePrefs 注入防御函数 + storage 常量，Wave 0 RED 测试全部 GREEN。

## One-liner

sanitizePrefs 静默过滤 11 类注入词（中英文 + 分隔符 + jailbreak）+ usePreferencesStore 持久化偏好到 partitioned localStorage，PREF-01/PREF-02 测试从 RED→GREEN（15→21 用例全绿）。

## Completed Tasks

| # | Name | Commit | Files | Status |
|---|------|--------|-------|--------|
| 1 | storage.ts 追加常量 + 新建 preferences.ts | `348e1f7` | src/lib/storage.ts, src/store/preferences.ts | GREEN 15/15 |
| 2 | preferences.test.ts GREEN 验证（补齐 store 集成测试）| `144e00c` | src/store/preferences.test.ts | GREEN 21/21 |

## Store Shape

```typescript
// usePreferencesStore 状态形状
{
  userPrefs: string | null;  // sanitize 后（null = 未设置或被注入词过滤）
  rawInput: string;          // 原始文本框内容（始终保留，用于 UI 显示）
  setPrefs(raw: string): void;   // 写 storage + 更新双字段
  loadPrefs(): void;              // hydrate from storage（main.tsx onReady 调用）
}
```

## sanitizePrefs 过滤规则

| 条件 | 返回值 |
|------|--------|
| 空/仅空白 | `null` |
| 长度 > 500 字符 | `null`（D-08 安全上限） |
| 命中 INJECTION_KEYWORDS（11 类）| `null`（D-09 静默过滤） |
| 合法偏好 | `raw.trim()` |

**INJECTION_KEYWORDS 11 类覆盖：**
- 中文直接指令：忽略/无视/跳过/放弃上面/现在开始/从现在起/你的新角色/你现在是/你是一个/新的指令/忘记
- 中文角色切换：扮演/假设你是/想象你是
- 英文直接注入：ignore/disregard/forget/override/new instruction/your new role/you are now/act as/pretend
- 分隔符注入：`---`/`===`/` ```system`/`[INST]`/`<<SYS>>`
- 越狱前缀：DAN/jailbreak/bypass/system prompt

## Storage Constants Added

```typescript
STORAGE_KEYS = {
  // ...原有 6 个 keys（不变）...
  CHAT_HISTORY_PREFIX: 'aster:chat:',   // Phase 8 F：聊天记录前缀（docKey.ts 生成完整 key）
  USER_PREFERENCES: 'aster:prefs:user', // Phase 8 A：用户偏好文本
}
```

## Test Results

```
RED → GREEN:
  preferences.test.ts: 0 → 21/21 (15 sanitizePrefs 注入防御 + 6 store 集成)

全套测试：
  Test Files  1 failed | 51 passed (52)
  Tests  2 failed | 647 passed (649)
  
  剩余 2 failed = loop-helpers.test.ts truncateTo20Turns（Plan 04 目标，预期 RED）
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] storage.test.ts 键数断言 6→8**
- **Found during:** Task 2 全量测试验证
- **Issue:** storage.test.ts 断言 `Object.keys(STORAGE_KEYS)).toHaveLength(6)`，但 Plan 03 Task 1 新增 2 个常量（USER_PREFERENCES + CHAT_HISTORY_PREFIX）后变成 8 个，测试失败
- **Fix:** 更新断言为 `toHaveLength(8)` + 更新说明文字（Phase 8 Plan 03 新增）
- **Files modified:** src/lib/storage.test.ts
- **Commit:** `3310e25`

## Threat Flags

无新增安全面。sanitizePrefs 本身即是 T-08-injection 的缓解措施，storage 写入走 partitioned localStorage 分区隔离（T-08-storage-leak 已 accept）。

## Self-Check

检查创建/修改文件存在：

| File | Status |
|------|--------|
| src/store/preferences.ts | FOUND |
| src/lib/storage.ts (修改) | FOUND |
| src/store/preferences.test.ts (修改) | FOUND |
| src/lib/storage.test.ts (修改) | FOUND |

检查 commits 存在：

| Commit | Message |
|--------|---------|
| 348e1f7 | feat(08-03): add preferences store + sanitizePrefs injection defense |
| 144e00c | test(08-03): add store integration tests to preferences.test.ts |
| 3310e25 | fix(08-03): update storage.test.ts key count 6→8 for Phase 8 new keys |

## Self-Check: PASSED
