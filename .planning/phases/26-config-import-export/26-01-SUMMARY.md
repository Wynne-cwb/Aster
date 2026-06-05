---
phase: 26-config-import-export
plan: 01
subsystem: config
tags: [vitest, zustand, localStorage, tdd, config-backup]

# Dependency graph
requires:
  - phase: 08-prefs-history
    provides: usePreferencesStore setPrefs / setBrandAccentColor（applyImport 写入路径）
  - phase: 02-providers
    provides: useProviderStore / hydrateFromStorage / STORAGE_KEYS（导出/导入全部 storage 读写）
provides:
  - configBackup.ts: 配置导出/导入/校验/合并纯函数层 + applyImport 副作用层（10+ 具名符号）
  - configBackup.test.ts: CFG-01/CFG-02 全部 9 个自动化单测守门（19 cases 全绿）
affects:
  - 26-02 (Settings UI)
  - 26-03 (CSS + icons)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD RED→GREEN: 先提交失败测试（RED 90f9b27），再实现使测试通过（GREEN 715a6bf）
    - Result<T,E> 模式: parseImportFile 返回 { ok: true; config } | { ok: false; error }，不 throw
    - 方案 A upsert: useProviderStore.setState 直接 upsert 绕开 addProvider 的 randomUUID 障碍（F-08）
    - hydrateFromStorage 守门: applyImport 最后一步统一调用，确保 configuredKeyIds 响应式刷新（F-07/WR-01）

key-files:
  created:
    - src/lib/configBackup.ts
    - src/lib/configBackup.test.ts
  modified: []

key-decisions:
  - "方案 A upsert（useProviderStore.setState 直接 upsert）保留导入 provider 原 id，绕开 addProvider 强制 randomUUID 障碍"
  - "applyImport 最后一步统一调用 hydrateFromStorage()，确保 configuredKeyIds 响应式刷新（红条消失路径）"
  - "pexelsKey 走单独字段（非 keys Record），与 provider API keys 分离存储"
  - "禁止收集 CHAT_HISTORY_PREFIX / ONBOARDING_SEEN / PEXELS_BASE_URL（D-02 out-of-scope 守门）"

patterns-established:
  - "Result<T,E> 模式: parseImportFile 不 throw，返回结构化 ok/error 对象（4 个 ImportErrorCode）"
  - "Zustand 外部消费: useProviderStore.getState() / useProviderStore.setState() 在非组件层使用"
  - "vi.mock 顺序: mock 在 import 之前，mock 后再 import 被测文件（参照 registry.test.ts 范式）"

requirements-completed:
  - CFG-01
  - CFG-02

# Metrics
duration: 4min
completed: 2026-06-05
---

# Phase 26 Plan 01: 配置导入导出核心逻辑 Summary

**纯函数层 + 副作用层：configBackup.ts 实现 export/import/validate/merge 全流程，19 个 Vitest 单测全绿守门（TDD RED→GREEN）**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-05T12:13:14Z
- **Completed:** 2026-06-05T12:17:01Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- `configBackup.ts` 导出 11 个具名符号（ASTER_CONFIG_VERSION + 5 接口/类型 + 5 函数）
- `buildExportData()` 收集全部 D-02 锁定字段，不收集 CHAT_HISTORY_PREFIX / ONBOARDING_SEEN / PEXELS_BASE_URL
- `parseImportFile()` 实现 4 个 ImportErrorCode（INVALID_JSON / NOT_ASTER_CONFIG / UNSUPPORTED_VERSION / EMPTY_CONFIG），Result 形态不 throw
- `applyImport()` 方案 A upsert（保留原 id）+ setKey + setPrefs + setBrandAccentColor + hydrateFromStorage() 守门
- `configBackup.test.ts` 覆盖 VALIDATION.md 全部 9 个自动化用例，19 cases 全绿

## Task Commits

TDD 任务分两次提交：

1. **RED（测试先行）:** `90f9b27` — `test(26-01): add failing tests for configBackup.ts`
2. **GREEN（实现）:** `715a6bf` — `feat(26-01): implement configBackup.ts`

## Files Created/Modified

- `src/lib/configBackup.ts` — 配置导出/导入核心逻辑（341 行）：ASTER_CONFIG_VERSION 常量 + 5 类型定义 + 5 导出函数
- `src/lib/configBackup.test.ts` — 单测守门（~280 行，19 个 test case），覆盖 VALIDATION.md 全部 9 个自动化用例

## Decisions Made

- **方案 A upsert**: `upsertProviderById()` 通过 `useProviderStore.setState` 直接更新 providers 数组，绕开 `addProvider` 强制 `crypto.randomUUID()` 的障碍，保留导入 provider 的原 id（F-08 方案 A）。
- **hydrateFromStorage 守门**: `applyImport` 所有写入完成后统一调用，重算 `configuredKeyIds`（WR-01 红条消失路径）。
- **pexelsKey 独立字段**: 与 provider API keys 的 `keys` Record 分离，单独存 `pexelsKey` 字段，避免 `pexels` id 混入 provider key 遍历逻辑。

## Deviations from Plan

无 — 计划按预期执行。`ImportError` 接口为计划要求 4 接口之外额外导出的辅助类型，合理附加。

## grep 验证结果

- `grep -c "ASTER_CONFIG_VERSION" configBackup.ts` → **3**（PASS，≥1）
- `grep -c "hydrateFromStorage" configBackup.ts` → **7**（PASS，≥1，包含 import + 文档 + 调用）
- `grep -c "CHAT_HISTORY_PREFIX\|ONBOARDING_SEEN\|PEXELS_BASE_URL" configBackup.ts` → **2**（仅在 JSDoc 注释中，实现代码 0 处使用 — PASS）

## Issues Encountered

无 — TDD 流程顺利，RED 阶段套件因缺少实现文件失败，GREEN 阶段 19/19 全绿。

## Known Stubs

无 — configBackup.ts 是纯逻辑层，所有函数均完整实现，无占位符或硬编码空值。

## Threat Flags

无新增安全面（configBackup.ts 全部代码路径已在 26-01-PLAN.md threat_model 中覆盖：T-26-01 parseImportFile 结构校验、T-26-03 applyImport 经 setPrefs/setBrandAccentColor 含 sanitize/normalize）。

## Next Phase Readiness

- **26-02（Settings UI）**: `configBackup.ts` 全部导出函数就绪，SettingsPanel.tsx 可直接 import `exportConfig / parseImportFile / detectConflicts / applyImport`
- **Wave 0 完成**: `wave_0_complete` 可在 VALIDATION.md 中置 true

---
*Phase: 26-config-import-export*
*Completed: 2026-06-05*

## Self-Check: PASSED

- `src/lib/configBackup.ts` — 文件存在 ✓
- `src/lib/configBackup.test.ts` — 文件存在 ✓
- commit `90f9b27` — 存在 ✓ (test RED)
- commit `715a6bf` — 存在 ✓ (feat GREEN)
- vitest run: 19 PASS / 0 FAIL ✓
