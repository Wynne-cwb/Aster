---
phase: "05"
plan: "08"
subsystem: "UI / DiffLog / Bundle"
tags: ["diff-log", "undo", "ui", "lazy-load", "bundle-gate", "lingui"]
dependency_graph:
  requires: ["05-03", "05-07"]
  provides: ["DiffLogPanel UI", "per-step undo", "undo-all modal flow", "bundle gate守住"]
  affects: ["ChatStream", "App", "operationLog", "styles.css", "lingui catalog"]
tech_stack:
  added: []
  patterns:
    - "React.lazy + Suspense 切割 DiffLogPanel / SettingsPanel / OnboardingModal 到独立 lazy chunk"
    - ".tool-group + .wb-action-head 复用折叠卡范式（无新组件）"
    - "modal-scrim + modal 复用 OnboardingModal 范式（二次确认 + 总结 modal）"
    - "replayUndoSingle（per-step）+ replayUndoAll（全量）两条撤销路径"
key_files:
  created:
    - "src/components/DiffLogPanel.tsx — 汇总卡 + per-step undo + undo-all 二次确认 + 总结 modal"
  modified:
    - "src/components/ChatStream.tsx — lazy DiffLogPanel 挂载 + useCompletedRunIds"
    - "src/App.tsx — SettingsPanel + OnboardingModal 改 lazy（守住 bundle gate）"
    - "src/agent/operationLog.ts — export replayUndoSingle（单步撤销）"
    - "src/styles.css — .is-undone + .badge-warning + .badge-error + .diff-log-panel + dark 三态色"
    - "src/i18n/locales/zh-CN/messages.po — lingui extract，从 106 → 123 条"
    - "src/i18n/locales/zh-CN/messages.ts — compiled catalog"
decisions:
  - "SettingsPanel + OnboardingModal 改 lazy（Deviation Rule 2）：DiffLogPanel 加上 lingui catalog 新字符串导致 main 超 82KB，通过把两个仅「用户交互后」才显示的组件 lazy 化，把 main 从 83.30KB 降到 80.48KB，同时 DiffLogPanel 在独立 lazy chunk（1.65KB）"
  - "replayUndoSingle export 到 operationLog（而不是内联到 DiffLogPanel）：保持逻辑一致性，DiffLogPanel 的 lazy chunk 通过 import 复用 operationLog 的 postState 对比 + executeReverse 逻辑"
  - "ChatStream 的 getWriteOpsByRun length>0 检查移入 DiffLogPanel 内部（自行 return null），ChatStream 只遍历 completedRunIds 渲染 Suspense 包裹的 DiffLogPanel"
metrics:
  duration: "19 minutes"
  completed_date: "2026-05-30"
  tasks_completed: 2
  files_changed: 8
---

# Phase 05 Plan 08: DiffLogPanel UI + ChatStream 挂载 + Bundle 守门 Summary

## One-liner

DiffLogPanel 汇总卡（`.tool-group` 折叠 + per-step `.btn-ghost` 撤销 + undo-all 二次确认 modal + D-12 三态总结 modal）React.lazy 移出 main chunk，配合 SettingsPanel/OnboardingModal lazy 化守住 82KB bundle gate（80.48KB）。

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | DiffLogPanel.tsx 新建 + styles.css 补全 | `08d35a2` | DiffLogPanel.tsx, styles.css, operationLog.ts |
| 2 | ChatStream 挂载 + App lazy + lingui extract | `eca8e27` | ChatStream.tsx, App.tsx, operationLog.ts, messages.po, messages.ts |

## What Was Built

### DiffLogPanel.tsx

汇总卡 UI（`src/components/DiffLogPanel.tsx`，4.82kB / gzip 1.65kB lazy chunk）：
- 折叠卡头：`button.tool-group__head.diff-log-head`（整行可点），ChevronDownIcon 随展开 rotate(180deg)，「本次改动 N 处」
- 每步行：`ul.tool-group__list > li`，左 `span.wb-action-target`（humanLabel）+ 右 `.btn.btn-ghost.btn-sm 撤销该步`（loading 中 disabled）
- 撤销态：已撤销 → `.is-undone`（删除线中性灰）+ `.badge-accent 已撤销`胶囊 + 细提示文字；手改跳过 → `.badge-warning 未回滚·手改`；报错 → `.badge-error 未能回滚`
- 底部按钮：写操作数 > 1 且无 undoResult 时展示 `button.btn.btn-ghost 撤销本次所有操作`
- 二次确认 modal：`.modal-scrim + .modal`（ESC/scrim 点击关闭），「取消」ghost + 「确认撤销」`btn-primary`（teal 实底）
- 总结 modal（D-12 三态）：成功绿/手改琥珀/报错红，单按钮「知道了」

### operationLog.ts

新增 `export async function replayUndoSingle(entry, adapter)`：对单条 OperationLogEntry 执行撤销（DiffLogPanel per-step undo 用）。

### ChatStream.tsx

```tsx
const DiffLogPanel = lazy(() => import('./DiffLogPanel'));
const completedRunIds = useCompletedRunIds();
// ...
{completedRunIds.map((runId) => (
  <Suspense key={runId} fallback={null}>
    <DiffLogPanel runId={runId} />
  </Suspense>
))}
```

run 完成后自动出现汇总卡（D-02）；DiffLogPanel 内部判断写操作数，0 时 return null。

### styles.css

补全：
- `.is-undone .wb-action-target`（删除线 + `--text-3`）
- `.badge-warning`（`--warning-soft` 底 + `--warning` 字）
- `.badge-error`（`--error-soft` 底 + `--error` 字）
- `[data-theme="dark"]` 三态色（success/warning/error token 补定义）
- `.diff-log-panel { flex-shrink: 0 }`（防 `.aster-messages` flex column 压扁）
- `button.tool-group__head.diff-log-head`（整行 button 可点样式）
- `.diff-log-footer`（底部按钮区）
- `.diff-log-status-row / --success/--warning/--error`（总结 modal 状态行色）
- `.writeback-undone-hint`（已撤销细提示）

### Lingui catalog

从 106 条（提交基准）→ 123 条，新增 DiffLogPanel 全部字符串（zh-CN source locale，含动态量词）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Bundle Gate] SettingsPanel + OnboardingModal 改为 lazy chunk**

- **Found during:** Task 2 bundle 验证
- **Issue:** DiffLogPanel 的 Lingui catalog 新字符串（+10 条）+ ChatStream 新增代码，导致 main bundle 从 81.93KB 升到 83.30KB，超出 82KB gate（超 1.37KB）
- **Fix:** 把 `App.tsx` 中已经条件渲染（只在用户交互后显示）的 SettingsPanel + OnboardingModal 从静态 import 改为 `React.lazy()`，各自降为独立 lazy chunk（2.35kB + 1.44kB）；main 降至 80.48KB
- **Files modified:** `src/App.tsx`
- **Commit:** `eca8e27`

**2. [Rule 2 - Correctness] replayUndoSingle export 到 operationLog**

- **Found during:** Task 1 实现单步撤销
- **Issue:** 计划中 per-step undo 没有明确实现路径，operationLog 的 `replayUndoStep` 是私有函数，DiffLogPanel 无法复用其 postState 对比逻辑
- **Fix:** 在 operationLog.ts 新增 `export async function replayUndoSingle(entry, adapter)` wrapper，DiffLogPanel lazy chunk 通过 import 使用，避免重复逻辑
- **Files modified:** `src/agent/operationLog.ts`
- **Commit:** `08d35a2`

**3. [Rule 2 - Correctness] ChatStream 移除 getWriteOpsByRun length>0 检查**

- **Found during:** Task 2 代码审查
- **Issue:** 计划示例代码在 ChatStream 中做 `getWriteOpsByRun(runId).length > 0` 检查，但这额外 import 了 operationLog（已在 main），且 DiffLogPanel 内部会自行 return null
- **Fix:** 移除 ChatStream 中的 getWriteOpsByRun import，DiffLogPanel 自行判断 writeOps.length === 0 时返回 null
- **Files modified:** `src/components/ChatStream.tsx`
- **Commit:** `eca8e27`

## Bundle Breakdown（最终）

| Chunk | Size (gzip) | 用途 |
|-------|-------------|------|
| main-Cl8oA4Ij.js | 80.60 kB | 主入口（核心运行时） |
| DiffLogPanel-zJvIoVu5.js | 1.65 kB | DiffLogPanel lazy（本 plan） |
| SettingsPanel-C3kjbQAt.js | 2.35 kB | SettingsPanel lazy（本 plan Deviation） |
| OnboardingModal-BP0RhmVq.js | 1.44 kB | OnboardingModal lazy（本 plan Deviation） |
| debugReport-D0uBj4Fg.js | 1.69 kB | debugReport lazy（已有） |

size-limit 测量：**80.48 kB ≤ 82 kB gate**（通过）

## Test Results

- 502 passed / 1 failed（`loop.test.ts` AGENT-02 soft-landing 预存在 flaky，Phase 04.1 已记录，单跑非本 plan 引入）
- Lingui coverage 测试：PASS（messages.po 已提交含所有 123 条字符串）
- tsc --noEmit：0 errors

## Threat Flags

无新增安全相关 surface。DiffLogPanel 渲染 humanLabel（write tool 内部生成，非 LLM 原始输出），React 自动 escape，不存在 XSS 风险。所有 undo 调用通过 adapter 层，不直接操作 Office 命名空间（A-06 守门）。

## Self-Check: PASSED

- [x] `src/components/DiffLogPanel.tsx` 存在
- [x] `08d35a2` commit 存在
- [x] `eca8e27` commit 存在
- [x] `grep "flex-shrink" src/styles.css` 含 `.diff-log-panel { flex-shrink: 0 }`
- [x] `grep -c "is-undone|badge-accent|badge-warning|badge-error" src/styles.css` = 8 (≥4)
- [x] bundle main 80.48 kB ≤ 82 kB
- [x] DiffLogPanel 在独立 lazy chunk
