---
phase: quick-260531-bg2
plan: "01"
subsystem: Settings UI
tags: [ux, two-step-confirm, i18n, tdd]
dependency_graph:
  requires: []
  provides: [inline-confirm-clear-history]
  affects: [SettingsPanel, styles.css, i18n-catalog]
tech_stack:
  added: []
  patterns: [useState-confirming, vi.hoisted-spy, lingui-Trans]
key_files:
  created: []
  modified:
    - src/components/Settings/SettingsPanel.tsx
    - src/components/Settings/SettingsPanel.test.tsx
    - src/styles.css
    - src/i18n/locales/zh-CN/messages.po
    - src/i18n/locales/zh-CN/messages.ts
decisions:
  - "内联 confirming state（非 modal/alert）与 Office 任务窗格风格一致且无外部依赖"
  - "vi.hoisted 提升 clearHistory spy 确保跨测试的稳定引用"
  - "i18n 行号注释偏移需额外 commit 同步（lingui extract 会更新 #: 位置注释）"
metrics:
  duration: "~10 min"
  completed: "2026-05-31"
---

# Phase quick-260531-bg2 Plan 01: SettingsPanel 清空聊天记录内联两步确认 Summary

**一句话：** 「清空聊天记录」按钮改为内联两步确认（`confirming` state），首次点击只进确认态不执行清空，点「确认」才调 `clearHistory`，点「取消」还原，0 新依赖，7 个测试全绿。

## 改动文件列表

| 文件 | 类型 | 变更内容 |
|------|------|----------|
| `src/components/Settings/SettingsPanel.tsx` | 修改 | 新增 `confirming` state，HIST-02 区块替换为内联两步确认 UI |
| `src/styles.css` | 修改 | 新增 `.hist-confirm-row` / `__label` / `__actions` CSS 类 |
| `src/components/Settings/SettingsPanel.test.tsx` | 修改 | `vi.hoisted` 提升 clearHistory spy + T-bg2-01~03 三个新测试 |
| `src/i18n/locales/zh-CN/messages.po` | 修改 | 新增 `确认清空？`、`确认` 两个 msgid；更新行号注释 |
| `src/i18n/locales/zh-CN/messages.ts` | 修改 | compile 同步 |

## 确认态 UI 实现方式

**内联 state，不是 modal**——在组件顶部 state 区块添加：

```tsx
const [confirming, setConfirming] = useState(false);
```

HIST-02 区块三分支渲染：
- `confirming === false`：渲染原「清空聊天记录」按钮，`onClick` 只做 `setConfirming(true)`
- `confirming === true`：渲染 `.hist-confirm-row` 行——「确认清空？」标签 + 「取消」（`btn-ghost btn-sm`）+ 「确认」（`btn-primary btn-sm`）按钮
- 「确认」`onClick`：先 `clearHistory(docKeyRef.current)` 再 `setConfirming(false)`
- 「取消」`onClick`：只 `setConfirming(false)`

## 样式类名 `.hist-confirm-row`

```css
.hist-confirm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.hist-confirm-row__label {
  font-size: var(--fs-13);
  color: var(--text-2);
  flex: 1;
}
.hist-confirm-row__actions {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}
```

全部使用 CSS 变量，0 硬编码 hex，0 内联 style。

## i18n catalog 同步步骤

1. `npm run extract` — 提取新文案（`确认清空？`、`确认`），并更新所有行号注释
2. 手动填入 msgstr（均与 msgid 相同，中文 source）
3. `npm run compile --typescript` — 同步 messages.ts
4. 两个文件连同代码变更一起提交
5. 注意：coverage.test.ts 会在测试时重新跑 extract 检查 git diff，因此 messages.po **必须提交最新 extract 结果**（含行号注释）

## 测试结果

### SettingsPanel 单文件（7 用例）

```
✓ src/components/Settings/SettingsPanel.test.tsx (7 tests) 46ms
  ✓ SP-01：渲染不抛错
  ✓ SP-02：偏好 textarea 存在
  ✓ SP-03：三个预设 chips 都渲染
  ✓ SP-04：清空聊天记录按钮存在
  ✓ T-bg2-01：点一次触发确认态，clearHistory 未调用
  ✓ T-bg2-02：确认态点「确认」→ clearHistory 调用 1 次
  ✓ T-bg2-03：确认态点「取消」→ 回初始态，clearHistory 未调用
```

### 全套测试

```
Test Files  53 passed (53)
Tests  662 passed (662)
```

（基线 659 + 3 新测试 = 662，全绿）

### Build

```
✓ built in 1.34s   // 0 TS errors, 0 warnings
```

### Bundle Size

```
Size limit:   82 kB
Size:         74.58 kB gzipped   // 守门通过（< 82 KB）
```

## Commits

| Hash | 说明 |
|------|------|
| `7451a26` | feat(quick-260531-bg2-01): add inline two-step confirm for clear history |
| `ad727ba` | chore(quick-260531-bg2-01): sync i18n catalog line numbers after SettingsPanel refactor |

## Deviations from Plan

**1. [Rule 2 - Additional commit] i18n 行号注释需额外提交**

- **发现于：** Task 1 完成后全套测试
- **问题：** SettingsPanel.tsx 增加约 30 行代码后，lingui extract 更新了所有现有字符串的 `#: src/...tsx:N` 行号注释。coverage.test.ts 在每次运行时重新跑 extract 并用 `git diff` 检测，导致测试失败
- **修复：** 补充一个 chore commit 将 extract/compile 后的最新 messages.po/ts 提交
- **影响：** 不影响功能，属于工具链守门的正常流程

## Known Stubs

无。

## Threat Flags

无新增安全面。

## Self-Check: PASSED

- [x] `src/components/Settings/SettingsPanel.tsx` 包含 `confirming` state
- [x] `src/styles.css` 包含 `.hist-confirm-row` 定义
- [x] `src/components/Settings/SettingsPanel.test.tsx` 包含 `T-bg2-01`
- [x] Commits `7451a26` + `ad727ba` 存在于 main 分支
- [x] 全套 662 测试绿
- [x] Bundle 74.58 KB < 82 KB
