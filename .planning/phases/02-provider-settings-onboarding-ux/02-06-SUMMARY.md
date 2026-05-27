---
phase: 02-provider-settings-onboarding-ux
plan: "06"
subsystem: chat-ui-components
tags: [chat-bubble, error-bubble, cost-badge, selection-pill, react-markdown, lingui, css-design-system]
dependency_graph:
  requires:
    - "02-05"  # chatStore（messages）、providerStore（autoAttach）、adapter insert()
  provides:
    - src/components/ChatBubble.tsx
    - src/components/ErrorBubble.tsx
    - src/components/CostBadge.tsx
    - src/components/SelectionPill.tsx
  affects:
    - src/styles.css
    - "02-08"  # ChatStream + InputBar 将在 Wave 5 组装这些组件
tech_stack:
  added:
    - react-markdown 9.x (AI 输出渲染，已安装)
    - remark-gfm 4.x (表格/删线/任务列表，已安装)
  patterns:
    - CSS 变量驱动双主题（--error/--error-bg 新增）
    - ContextCard useAdapter + onSelectionChanged 订阅模式
    - ERROR_UI_MAP 静态映射（安全隔离 error.message）
    - Lingui Trans/t 包裹全部 UI 字符串
key_files:
  created:
    - src/components/ChatBubble.tsx
    - src/components/ErrorBubble.tsx
    - src/components/CostBadge.tsx
    - src/components/SelectionPill.tsx
  modified:
    - src/styles.css
decisions:
  - "ChatBubble 提前依赖 ErrorBubble（Task 1 与 Task 2 组件同批创建）——避免中间状态编译错误"
  - "ErrorBubble.message prop 加 _message 重命名 + eslint-disable 明确标注安全意图（T-02-22）"
metrics:
  duration: ~15min
  completed: 2026-05-27
  tasks_completed: 2
  files_changed: 5
---

# Phase 02 Plan 06: 聊天 UI 组件（气泡 / 错误 / 成本 / 选区胶囊）Summary

**一句话**：React-markdown 驱动的三角色聊天气泡 + 8 类 CTA 错误气泡 + token 成本徽章 + 自适应选区胶囊，全部使用 CSS 变量双主题，Lingui 包裹所有 UI 字符串。

## Completed Tasks

| Task | 名称 | Commit | 关键文件 |
|------|------|--------|---------|
| 1 | ChatBubble / CostBadge / SelectionPill + styles.css | 03744ad | ChatBubble.tsx, CostBadge.tsx, SelectionPill.tsx, styles.css |
| 2 | ErrorBubble（8 类 CTA + 深链）| 9b21629 | ErrorBubble.tsx |

## What Was Built

### ChatBubble.tsx

Props: `{ message: Message; onRetry: () => void; onSettings: (anchor?: string) => void }`

| role | 渲染 |
|------|------|
| user | `<div className="aster-bubble aster-bubble--user">` + 纯文本 |
| assistant | `<div className="aster-bubble aster-bubble--assistant">` + `<ReactMarkdown remarkPlugins={[remarkGfm]}>` + `<CostBadge>` + 「插入到文档」按钮 |
| error | 委托 `<ErrorBubble>` |

- `isStreaming=true`：末尾显示 `.aster-cursor` 闪烁动画（`prefers-reduced-motion` 降级）
- 插入到文档：`adapter.insert({ type: 'text', value: message.content })`，仅在 `!isStreaming` 时显示
- 安全：`<ReactMarkdown>` 默认禁用原始 HTML，无 `dangerouslySetInnerHTML`（T-02-21）

### ErrorBubble.tsx

Props: `{ errorCode, message, retryPrompt?, onRetry, onSettings }`

**8 类错误 CTA 文案（ERROR_UI_MAP，D-13 锁定）：**

| 错误码 | reason | ctaType | anchor |
|--------|--------|---------|--------|
| KEY_INVALID | API Key 无效 | settings | key-input |
| QUOTA | 账户余额不足 | action | — |
| RATE_LIMIT | 请求过快，已自动重试 | action | — |
| CONTEXT | 内容过长 | none | — |
| NETWORK | 网络连接失败 | action | — |
| FILTER | 内容被过滤 | action | — |
| MODEL | 模型不存在 | settings | model-input |
| IMAGE_QUOTA | 图像生成配额用尽 | action | — |

- `ctaType='settings'`：`onSettings(anchor)` 深链到 Settings 对应字段（D-12）
- `ctaType='action' + retryPrompt`：RetryIcon + onRetry 回调按钮
- `ctaType='none'`：纯文字提示
- 安全：`message` prop 以 `_message` 重命名，不渲染到 UI（T-02-22 / T-01-04）

### CostBadge.tsx

Props: `{ tokenCount: number; costCny: number | null }`

- `costCny !== null`（内置 Provider）：`本次：N token · 约 ¥X.XXXX`
- `costCny === null`（自定义 Provider）：`本次：N token`
- 安全（T-02-23）：costCny 来自 calcCostCny 计算，非 AI 生成文本

### SelectionPill.tsx

Props: `{ onDismiss: () => void }`

- 订阅 `adapter.onSelectionChanged()`，显示 formatSelection() 格式化元数据
- `useProviderStore(s => s.autoAttach)`：false 时返回 null（D-15）
- XIcon × 按钮调用 onDismiss，移除当前附带

## New CSS Classes（styles.css 新增）

| Class | 用途 |
|-------|------|
| `.aster-bubble` | 气泡基础（padding / radius / margin） |
| `.aster-bubble--user` | 用户气泡（surface-2 背景 / 右对齐 / max-width 85%）|
| `.aster-bubble--assistant` | 助手气泡（透明背景 / 左对齐 / Markdown 重置）|
| `.aster-bubble__actions` | 操作行容器（flex / gap）|
| `.aster-insert-btn` | 插入按钮（12px / border / hover 品牌色）|
| `.aster-cursor` | 流式光标（闪烁 / reduced-motion 降级）|
| `.aster-cost-badge` | 成本徽章（11px / text-3 / tabular-nums）|
| `.aster-selection-pill` | 选区胶囊（11px / pill / overflow ellipsis）|
| `.aster-selection-pill__text` | 胶囊文本（flex / ellipsis）|
| `.aster-selection-pill__dismiss` | 胶囊 × 按钮（12px icon）|
| `.aster-error-bubble` | 错误气泡（error-bg / error 边框）|
| `.aster-error-bubble__icon-row` | 图标行（AlertIcon + reason）|
| `.aster-error-bubble__cta-row` | CTA 行（flex / wrap）|
| `.aster-error-bubble__cta` | CTA 按钮（error 边框 / hover error-bg）|
| `.aster-error-bubble__hint` | 纯文字提示（无按钮情况）|

**新增 CSS 变量（两套主题）：**
- Light: `--error: #ef4444; --error-bg: rgba(239,68,68,0.1)`
- Dark: `--error: #f87171; --error-bg: rgba(248,113,113,0.08)`

## TypeScript Compilation

```
npx tsc --noEmit → TypeScript compilation completed (0 errors)
```

## Test Results

```
npx vitest run → PASS (165) FAIL (0) — no regressions
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Dependency Pre-creation] ErrorBubble 与 ChatBubble 同 Task 1 批次创建**
- **Found during**: Task 1 实现
- **Issue**: ChatBubble.tsx 导入 ErrorBubble，若 Task 1 只创建三个文件会导致 TypeScript 编译失败
- **Fix**: Task 1 同时创建 ErrorBubble.tsx 完整实现；Task 2 commit 时已完整，无需重写
- **Files modified**: src/components/ErrorBubble.tsx（提前创建）
- **Commit**: 03744ad（Task 1）/ 9b21629（Task 2 独立提交）

## Self-Check: PASSED

- src/components/ChatBubble.tsx: FOUND
- src/components/ErrorBubble.tsx: FOUND
- src/components/CostBadge.tsx: FOUND
- src/components/SelectionPill.tsx: FOUND
- Commits 03744ad + 9b21629: FOUND
- 165 vitest tests: PASS
