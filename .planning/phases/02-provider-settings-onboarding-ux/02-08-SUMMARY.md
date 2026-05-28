---
phase: 02-provider-settings-onboarding-ux
plan: 02-08-app-shell-wiring
status: partial
checkpoint: failed
subsystem: ui
tags: [react, zustand, office-addin, chatstream, inputbar, onboarding, settings]

requires:
  - phase: 02-05
    provides: chatStore (sendMessage / stopStreaming / useMessages / useIsStreaming) + providerStore (hydrateFromStorage)
  - phase: 02-06
    provides: ChatBubble / SelectionPill / CostBadge / ErrorBubble 组件
  - phase: 02-07
    provides: SettingsPanel / OnboardingModal / ProviderForm

provides:
  - App.tsx 已串联 SettingsPanel + OnboardingModal + 未配 Key 提示条（代码层面 DONE）
  - InputBar 激活：发送/停止切换（D-14）+ SelectionPill（D-15）
  - ChatStream 渲染消息列表（有消息 → ChatBubble，无消息 → 空态）
  - main.tsx hydrateFromStorage 在 Office.onReady 后、render 前调用
  - 构建产物：226KB / gzip 72KB，165 tests 全绿

affects: [02.1-gap-closure, phase-03-ai-actions]

tech-stack:
  added: []
  patterns:
    - "App.tsx 作为 shell 层持有 showSettings / showOnboarding state，子组件通过 onSettings(anchor?) 深链回调打开 Settings"
    - "ChatStream 接受 onSettings 透传给 ChatBubble → ErrorBubble CTA"
    - "InputBar 消费 useIsStreaming，发送键原地切换为停止方块（D-14）"

key-files:
  created: []
  modified:
    - src/App.tsx
    - src/components/InputBar.tsx
    - src/components/ChatStream.tsx
    - src/main.tsx

key-decisions:
  - "02-08 代码任务（commit 6ab6d08）通过编译 + 165 单元测试，但 blocking checkpoint SC1-SC6 真机 UAT 失败，plan 状态为 partial"
  - "8 条 gap（G-01..G-08）归入 02.1 gap closure phase 处理，不在本 plan 内修复"

requirements-completed: []

duration: partial（代码完成，UAT 失败）
completed: 2026-05-28
---

# Phase 02 Plan 08: App Shell Wiring Summary

**App.tsx / InputBar / ChatStream / main.tsx 串联代码已完成（6ab6d08，构建 226KB/gzip 72KB，165 tests 全绿），但 blocking checkpoint 人工 UAT（SC1-SC6）发现 8 条缺陷，plan 状态为 partial，gap 归入 02.1 phase 处理。**

---

## 代码任务状态

| 项目 | 状态 |
|------|------|
| Task 1: 串联 App.tsx + 激活 InputBar + 改造 ChatStream + main.tsx 水化 | DONE |
| commit | `6ab6d08` |
| TypeScript 编译 | 0 错误 |
| vitest | 165 tests 全绿 |
| 构建产物 | 226KB / gzip 72KB（远低于 1MB 预算） |
| Checkpoint SC1-SC6 人工 UAT | **FAILED — 8 gaps** |

---

## Passed — 真机 UAT 通过项

以下功能在真机验证中确认正常：

- **SC1 Onboarding 核心**：首启弹出引导 modal，2 步流程（Key 配置 → 功能卡），完成后不再弹出，「重看引导」入口存在
- **SC2 流式渲染 + 停止**：LLM token 逐字流式渲染正常，停止按钮原地切换（D-14），停止后已生成内容保留
- **SC3 错误气泡 + 深链 CTA + 重试**：错误时气泡出现，「前往设置更新 Key」CTA 可点击并打开 Settings（深链 D-12），「重试」按钮重新发送原 prompt（D-11）— 注：错误分类消息本身有问题见 G-07
- **SC4 Provider 管理完整**：新增自定义 Provider、编辑字段、删除、内置 DeepSeek 删除按钮 disabled 全部正常
- **SC5 选区胶囊基础显示**：选区上下文胶囊在输入框上方出现，× 可关闭
- **SC6 三宿主写回本身**：PPT / Excel / Word for Web「插入到文档」功能均可写入

---

## Gaps — UAT 失败项（归入 02.1 处理）

### G-01 Task Pane 出现意外水平/垂直滚动条

- **涉及 plan**：02-08（App.tsx shell）/ 02-06（styles.css）
- **场景**：SC1 / SC2 通用
- **观察现象**：截图显示 Task Pane 底部出现滚动条，说明根容器溢出视口宽度
- **初步根因猜测**：InputBar / SelectionPill / pill-row 宽度 100% + padding 撑破容器；或 App.tsx 根 layout 高度/overflow 没控住
- **严重性**：中
- **建议归属**：`02.1-01-fix-taskpane-overflow`

---

### G-02 选区胶囊与输入框不对齐

- **涉及 plan**：02-06（SelectionPill）/ 02-08（InputBar 整合）
- **场景**：SC5 选区胶囊
- **观察现象**：截图红色箭头标注，「第 2 张 slide」胶囊与下方输入框左右内缩不一致
- **初步根因猜测**：`.aster-inputbar__pill-row` 与 InputBar 内框的 padding/gap token 不统一
- **严重性**：中
- **建议归属**：`02.1-02-align-selection-pill`

---

### G-03 流式 token 追加时 ChatStream 不自动滚到底

- **涉及 plan**：02-08（ChatStream）
- **场景**：SC2 流式对话
- **观察现象**：流式输出正常但对话框没自动滚到底，用户需手动滚动
- **初步根因猜测**：ChatStream 的滚动 useEffect 依赖只看 `messages.length`，流式期间 token 追加只改 content 不增加数组长度，hook 不触发；应改为依赖 `messages` 整体或最后一条 content
- **严重性**：高
- **建议归属**：`02.1-03-fix-chatstream-autoscroll`

---

### G-04 DeepSeek（内置）成本徽章只显示 token 数，未显示 ¥

- **涉及 plan**：02-06（CostBadge）/ 02-05（chatStore 流式 usage 收集）
- **场景**：SC2 成本徽章
- **观察现象**：用户用 DeepSeek，徽章显示「N token」但没有「约 ¥X.XXXX」
- **初步根因猜测**：① CostBadge 的 isBuiltIn 判断错误把 deepseek 当自定义；② chatStore 的 sendMessage 没正确收 streamSSE 末尾的 SSEUsage；③ calcCostCny 输入参数为 0 或 model 未命中内置单价
- **严重性**：高
- **建议归属**：`02.1-04-fix-costbadge-deepseek`

---

### G-05 「插入到文档」按钮在每条 AI 回复后显示——产品设计变更

- **涉及 plan**：02-06（ChatBubble）/ D-16 重审
- **场景**：SC6 插入到文档
- **观察现象**：每条 assistant 气泡下都有「插入到文档」按钮；用户期望改为 AI 自主决定（tool-call / 意图识别）
- **初步根因猜测**：不是 bug，是设计偏差。原 D-16 给了按钮兜底，但 PRD 实际意图是 AI 主动写
- **严重性**：高（产品定位相关）
- **建议归属**：`02.1-05-redesign-doc-insertion`（需先 spec 确认新行为）

---

### G-06 Settings 编辑 Provider 表单：保存/取消应固定底部、布局错位

- **涉及 plan**：02-07（ProviderForm / SettingsPanel）
- **场景**：SC4 Provider 管理
- **观察现象**：截图显示「保存/取消」在表单中间 inline 出现，下方还跟着「自动附带选区内容」开关 + 「重看引导」链接，结构混乱
- **初步根因猜测**：ProviderForm 没用 sticky/fixed footer；SettingsPanel 把全局配置项和当前编辑表单错放进同一垂直流里
- **严重性**：中
- **建议归属**：`02.1-06-fix-settings-layout`

---

### G-07 错误 Key 显示「网络连接失败」而非「API Key 无效」

- **涉及 plan**：02-04（openai-compat / mapHttpError）
- **场景**：SC3 错误 UX
- **观察现象**：把 DeepSeek Key 改成 `sk-invalid` 发送后，错误气泡显示「网络连接失败」（NETWORK），用户预期应是 KEY_INVALID
- **初步根因猜测**：① 浏览器 fetch 对 401 + 无 CORS 头的响应在某些路径会 throw TypeError → 被识别为 NETWORK；② DeepSeek 可能在 invalid key 时返回 non-2xx 但被 fetch 的 throw 路径而非 response 路径捕获；③ mapHttpError 的 401 分支没正确进入
- **严重性**：高（误导用户排错方向）
- **建议归属**：`02.1-07-fix-invalid-key-classification`（需真机抓 console + network 面板）

---

### G-08 选区胶囊一次性 dismiss 后无法恢复——产品设计变更

- **涉及 plan**：02-08（InputBar）/ 02-05（chatStore selection state）
- **场景**：SC5 选区胶囊
- **观察现象**：用户 × 胶囊后无法重新启用；期望改为可切换的 enable/disable 开关
- **初步根因猜测**：不是 bug，是设计调整。原 D-15 为「本次屏蔽」单次行为
- **严重性**：中
- **建议归属**：`02.1-08-selection-pill-toggle`

---

## Gap 汇总

| ID | 标题 | 严重性 | 建议 02.1 plan |
|----|------|--------|----------------|
| G-01 | Task Pane 意外滚动条 | 中 | 02.1-01-fix-taskpane-overflow |
| G-02 | 选区胶囊与输入框不对齐 | 中 | 02.1-02-align-selection-pill |
| G-03 | ChatStream 不自动滚到底 | 高 | 02.1-03-fix-chatstream-autoscroll |
| G-04 | 成本徽章缺少 ¥ 价格 | 高 | 02.1-04-fix-costbadge-deepseek |
| G-05 | 插入文档按钮设计偏差 | 高 | 02.1-05-redesign-doc-insertion |
| G-06 | Settings 布局错位 | 中 | 02.1-06-fix-settings-layout |
| G-07 | 错误 Key 显示「网络失败」 | 高 | 02.1-07-fix-invalid-key-classification |
| G-08 | 选区胶囊无法恢复设计偏差 | 中 | 02.1-08-selection-pill-toggle |

高严重性 4 条（G-03 G-04 G-05 G-07），中严重性 4 条（G-01 G-02 G-06 G-08）。

---

## Task Commits

1. **Task 1: 串联 App.tsx + 激活 InputBar + 改造 ChatStream + main.tsx 水化** — `6ab6d08` (feat)

---

## Files Modified

- `src/App.tsx` — 串联 SettingsPanel + OnboardingModal + 未配 Key 提示条 + 深链支持
- `src/components/InputBar.tsx` — 激活发送/停止切换（D-14）+ SelectionPill（D-15）
- `src/components/ChatStream.tsx` — 从空态变为消息列表渲染器，透传 onSettings
- `src/main.tsx` — hydrateFromStorage 在 Office.onReady 后、render 前调用

---

## Decisions Made

- 代码任务完成但 UAT 失败，plan 状态标记为 `partial` 而非 `complete`，不触发 roadmap 更新
- 8 条 gap 全部归入 02.1 gap closure phase，本 plan 不修复任何 bug，防止在未规划的状态下引入更多变更

---

## Self-Check: FAILED (human-verify checkpoint)

Checkpoint `SC1-SC6` 真机 UAT 失败，8 条缺陷已记录为 G-01..G-08。代码 commit `6ab6d08` 存在，构建通过，但产品验收未达标。

---

*Phase: 02-provider-settings-onboarding-ux*
*Status: partial — checkpoint failed*
*Last updated: 2026-05-28*
