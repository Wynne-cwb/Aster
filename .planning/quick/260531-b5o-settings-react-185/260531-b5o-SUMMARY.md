---
phase: quick/260531-b5o
plan: "01"
subsystem: settings-ui
tags: [bugfix, react-185, zustand, i18n, smoke-test]
dependency_graph:
  requires: []
  provides: [SettingsPanel-stable-mount, SettingsPanel-smoke-gate]
  affects: [src/components/Settings/SettingsPanel.tsx, src/components/Settings/SettingsPanel.test.tsx]
tech_stack:
  added: []
  patterns: [zustand-independent-selector, testing-library-jsdom-no-jest-dom]
key_files:
  created:
    - src/components/Settings/SettingsPanel.test.tsx
  modified:
    - src/components/Settings/SettingsPanel.tsx
    - src/i18n/locales/zh-CN/messages.po
decisions:
  - "独立 selector 而非 useShallow：与同文件既有 attachEnabled/clearHistory 等写法完全一致，零新依赖"
  - "messages.po 行号同步：3 行 selector 改 2 行后所有行号 -1，必须一并提交，否则 i18n coverage 测试每次 extract 都失败"
metrics:
  duration: "~15 分钟"
  completed: "2026-05-31"
  tasks_completed: 1
  files_changed: 3
---

# Quick 260531-b5o: 修复 SettingsPanel React #185 + 冒烟测试守门 Summary

**一句话**：将 usePreferencesStore 对象 selector 拆成两个独立 selector，消除 useSyncExternalStore 引用相等性触发的无限重渲染，并新建 4 用例冒烟测试作为 CI 守门。

## 任务完成情况

| Task | 名称 | Commit | 文件 |
|------|------|--------|------|
| 1 | 修复 selector + 冒烟测试守门 | e162985 | SettingsPanel.tsx, SettingsPanel.test.tsx, messages.po |

## 根因与修复

**根因**：`SettingsPanel.tsx` 第 55-57 行使用了返回新对象的 zustand selector：
```typescript
// 修复前（触发 React #185）
const { rawInput, setPrefs } = usePreferencesStore(
  (s) => ({ rawInput: s.rawInput, setPrefs: s.setPrefs })
);
```
每次 render 时 selector 返回新对象引用 → `useSyncExternalStore` 检测到引用变化 → 触发重渲染 → 无限循环 → React #185 白屏。

**修复**：拆成两个独立 selector（与同文件 attachEnabled/clearHistory 等写法完全一致）：
```typescript
// 修复后（与同文件范式一致）
const rawInput = usePreferencesStore((s) => s.rawInput);
const setPrefs = usePreferencesStore((s) => s.setPrefs);
```

## 验证结果（实测数字）

### npm test（新测试）
```
src/components/Settings/SettingsPanel.test.tsx (4 tests) — 全通过
SP-01: 渲染不抛错 ✓
SP-02: 偏好 textarea 存在 ✓
SP-03: 三个预设 chips 都渲染 ✓
SP-04: 清空聊天记录按钮存在 ✓
```

### npm test -- --run（全套）
```
Test Files  53 passed (53)
     Tests  659 passed (659)   (修复前 655，新增 4 = 659)
```

### npm run build
```
✓ built in 1.45s（无 TypeScript error）
```

### npm run build && npm run size
```
Size limit:   82 kB
Size:         74.56 kB gzipped   ← 低于 82 KB 守线
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] messages.po 行号注释需同步**
- **发现于**：Task 1（运行全套测试时 i18n coverage 失败）
- **问题**：selector 由 3 行改为 2 行，导致 SettingsPanel.tsx 后续所有文案的行号注释偏移 1；i18n coverage 测试每次 `npx lingui extract` 后检测到 git diff 而报错
- **修复**：运行 `npm run extract` 同步 messages.po 行号注释，一并提交
- **文件修改**：`src/i18n/locales/zh-CN/messages.po`（仅 `#: ...tsx:NNN` 注释行，无文案变更）
- **Commit**：e162985（与主改动同一次提交）

## Known Stubs

无。

## Self-Check: PASSED

- [x] `src/components/Settings/SettingsPanel.tsx` 存在且已修复 selector
- [x] `src/components/Settings/SettingsPanel.test.tsx` 存在，4 个用例全绿
- [x] `src/i18n/locales/zh-CN/messages.po` 已同步行号
- [x] Commit e162985 存在（`git log --oneline -1` 确认）
- [x] 全套 659 个测试通过
- [x] Bundle size 74.56 KB < 82 KB 守线
