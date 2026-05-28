---
phase: 03-agent-loop-privacy-word-demo
plan: 06
subsystem: chat-ui
tags: [chat-ui, role-tool, soft-landing, css-cleanup, plan-05-cascade]
requires:
  - 03-03  # agent loop + agentStore.continueRun / abort
  - 03-04  # WordAdapter.appendParagraph + humanLabel pipeline
  - 03-05  # chatStore Message v2 (role='tool' + toolResult fields)
provides:
  - "ChatStream 渲染 role='tool' 折叠卡 + soft-landing 两按钮卡片"
  - "loop.ts pushSoftLanding 写入的特殊消息有 UI 落地（继续 20 步 / 停下）"
  - "干净的 CSS — orphan selectors 全清，新版 .aster-tool-card* 玻璃拟态化"
affects:
  - src/components/ChatStream.tsx
  - src/components/ChatStream.test.tsx
  - src/styles.css
  - src/i18n/locales/zh-CN/messages.po
  - src/i18n/locales/zh-CN/messages.ts
tech-stack:
  added: []
  patterns:
    - "React state hook for 折叠/展开（useState<boolean>）"
    - "Zustand named selector for continueRun / abort"
    - "Lingui <Trans> macro 用于两按钮中文文案"
    - "ToolResultCard 子组件内嵌于 ChatStream（不抽独立文件 — Plan 06 仅 chat-ui-cleanup 范围）"
key-files:
  created: []
  modified:
    - src/components/ChatStream.tsx (+95 lines — ToolResultCard 子组件 + role 分发)
    - src/components/ChatStream.test.tsx (+180 lines — 5 new it() for Plan 06)
    - src/styles.css (−30 lines net — 删 116 orphan + 加 86 新版 tool-card)
    - src/i18n/locales/zh-CN/messages.po (+8 line — 继续 20 步 / 停下)
    - src/i18n/locales/zh-CN/messages.ts (lingui compile output)
decisions:
  - "ToolResultCard 嵌在 ChatStream.tsx 内部，不抽独立文件 — Plan 06 范围是 chat-ui-cleanup，不引入新文件成本"
  - "soft-landing 卡片用品牌渐变 primary 按钮（继续 20 步） + 描边二级按钮（停下） — 视觉层级表达「推荐 vs 停止」"
  - "折叠卡 humanLabel 在 header 显示纯文本（不展开就看不到 JSON），符合「不打扰」气质（CONTEXT specifics）"
  - "Plan 05 deferred-items.md 的 orphan CSS 在本 plan 一并清干净（cascade follow-up） — 不留新一轮 deferred"
metrics:
  duration_min: 9
  completed: "2026-05-28T18:19:21Z"
---

# Phase 03 Plan 06：chat-ui-cleanup Summary

**One-liner:** ChatStream 渲染 role='tool' 折叠卡 + soft-landing 两按钮卡片（继续 20 步 / 停下），并清理 Plan 05 cascade 遗留的 ~80 行 orphan CSS。

## 范围回顾

Plan 05 已落地 chatStore Message v2 schema（含 `role='tool'` + `toolName` + `toolResult`）并完成 InputBar / providers / chatStore 的核心改造。Plan 06 接力把渲染层补齐：

- ChatStream 按 role 分发：`'tool'` → ToolResultCard，其余 → ChatBubble（原路径不动）
- loop.ts hit MAX_STEPS=20 时 `pushSoftLanding` 写入的特殊消息（`toolName='soft-landing'`）有 UI 落地
- 用户点「继续 20 步」走 `useAgentStore.continueRun`（reset step + status=running）
- 用户点「停下」走 `useAgentStore.abort('user')`（设 lastAbortReason + abort controller）

Plan 06 顺手清理 Plan 05 deferred-items.md 记录的 ~80 行 orphan CSS（`.aster-segmented*`、`.aster-insert-btn*`、`.aster-insert-menu*`、`.aster-bubble__actions`、旧版 `.aster-tool-card--accepted/--rejected`/`__pos`/`__preview`）。

## ToolResultCard 子组件结构

```tsx
function ToolResultCard({ message }: { message: Message }): ReactElement {
  const continueRun = useAgentStore((s) => s.continueRun);
  const abort = useAgentStore((s) => s.abort);
  const [expanded, setExpanded] = useState(false);

  // 路径 1：soft-landing 两按钮卡片（D-09）
  if (message.toolName === 'soft-landing') {
    return (
      <div className="aster-tool-card aster-tool-card--soft-landing">
        <div className="aster-tool-card__title">{message.content}</div>
        <div className="aster-tool-card__actions">
          <button className="aster-btn-primary aster-btn-primary--sm"
                  onClick={() => continueRun()}>
            <Trans>继续 20 步</Trans>
          </button>
          <button className="aster-tool-card__btn-secondary"
                  onClick={() => abort('user')}>
            <Trans>停下</Trans>
          </button>
        </div>
      </div>
    );
  }

  // 路径 2：常规 tool 折叠卡（humanLabel header + JSON 展开）
  const showLabel = message.content || message.toolName || 'tool';
  const isError = message.toolResult?.ok === false;
  return (
    <div className={`aster-tool-card${isError ? ' aster-tool-card--error' : ''}`}>
      <button className="aster-tool-card__header"
              onClick={() => setExpanded(v => !v)}
              aria-expanded={expanded}>
        <span className="aster-tool-card__label">{showLabel}</span>
        <span className="aster-tool-card__chev">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <pre className="aster-tool-card__body">
          {JSON.stringify(message.toolResult, null, 2)}
        </pre>
      )}
    </div>
  );
}
```

## CSS 清理对照

| 选择器                          | 状态 | 原用途                                | 处置                          |
| ------------------------------- | ---- | ------------------------------------- | ----------------------------- |
| `.aster-segmented*`             | 删   | 「AI 自动写文档」segmented control    | TSX 已删 → 删 CSS             |
| `.aster-insert-btn*`            | 删   | CostBadge 时代的「插入到文档」按钮    | TSX 已删 → 删 CSS             |
| `.aster-insert-menu*`           | 删   | FallbackInsertMenu 下拉               | TSX 已删 → 删 CSS             |
| `.aster-bubble__actions`        | 删   | 配合 `.aster-insert-btn` 的容器       | 无引用 → 删                   |
| `.aster-tool-card--accepted`    | 删   | v1 confirm/auto 已接受态              | confirm/auto 砍 → 删          |
| `.aster-tool-card--rejected`    | 删   | v1 confirm/auto 已拒绝态              | confirm/auto 砍 → 删          |
| `.aster-tool-card__pos`         | 删   | v1 「光标处 / 追加末尾」位置 chip     | 无引用 → 删                   |
| `.aster-tool-card__preview`     | 删   | v1 LLM 待写文本 preview               | 无引用 → 删                   |
| `.aster-tool-card`              | 重写 | 旧版（实色 surface）                  | 新版用 `--glass-bg` 玻璃拟态  |
| `.aster-tool-card__header`      | 重写 | 旧版 div 布局                         | 新版整行 button + focus ring  |
| `.aster-tool-card__actions`     | 保留 | 按钮行（右下对齐）                    | 跨 plan 复用                  |
| `.aster-tool-card--error`       | 新增 | toolResult.ok===false 错误描边        | 红色边 + label danger 色      |
| `.aster-tool-card--soft-landing`| 新增 | soft-landing 品牌描边卡               | brand 边 + glass-bg           |
| `.aster-tool-card__title`       | 保留+ | soft-landing 标题文案                | 不变 但只在 soft-landing 用   |
| `.aster-tool-card__label`       | 新增 | header 文本（ellipsis 单行）          | 配合新版 header               |
| `.aster-tool-card__chev`        | 新增 | header 折叠箭头 ▸ / ▾                | 11px 小字                     |
| `.aster-tool-card__body`        | 新增 | 展开区 pre 块（JSON dump）            | 等宽字体 + max-height 滚动    |
| `.aster-btn-primary--sm`        | 保留 | 小号 primary（继续 20 步）            | 已存在，复用                  |
| `.aster-tool-card__btn-secondary` | 新增 | soft-landing 二级描边按钮（停下）   | outline，区别于 primary       |

## 测试覆盖

新增 5 个 it() in `ChatStream.test.tsx`（既有 4 个粘底测试不动）：

| Test            | 断言                                                                       | 状态 |
| --------------- | -------------------------------------------------------------------------- | ---- |
| ChatStream-1    | role='tool' append_paragraph → 渲染 humanLabel header + 默认折叠（JSON 不展示） | PASS |
| ChatStream-5    | 点 header → 展开 + 渲染 `"written": 5`                                     | PASS |
| ChatStream-2    | toolName='soft-landing' → 渲染两按钮「继续 20 步」+「停下」                | PASS |
| ChatStream-3    | 点「继续 20 步」 → agentStatus='running' + currentStep=0                   | PASS |
| ChatStream-4    | 点「停下」 → lastAbortReason='user' + ctrl.signal.aborted                  | PASS |

**全套 vitest**：29 files / 296 tests pass + 3 pre-existing baseline unhandled errors（retry/queue test infrastructure，已记录 deferred-items.md，非本 plan 引入）。

## Plan 05 cascade 验证

| Symbol                                  | 结果                                                    |
| --------------------------------------- | ------------------------------------------------------- |
| `ToolCallPreviewCard` / `AutoInsertEffect` / `FallbackInsertMenu` 在 `src/components/*.tsx` 中 | 0 命中（仅 ChatBubble jsdoc 注释提及变更历史） |
| `autoInsertMode` / `setAutoInsertMode` 在 `src/components/*.tsx` 中 | 0 命中（仅 ChatBubble + SettingsPanel jsdoc 注释提及变更历史） |
| `AI 自动写文档` 在 `src/components/*.tsx` 中 | 0 命中（仅 SettingsPanel jsdoc 注释提及；messages.po 是 `#~ obsolete` 块，已是抽取器留的死代码标记，非活引用） |

Plan 05 的清理 + Plan 06 的 CSS 清理 → 链路完整闭合，Plan 05 deferred-items.md 中记录的「CSS cleanup 归 Plan 06 接力」交付完成。

## Bundle 实测

| 项                  | Plan 05 后 | Plan 06 后  | Δ            |
| ------------------- | ---------- | ----------- | ------------ |
| CSS gzip            | 4.49 KB    | 4.39 KB     | −0.10 KB（−2%） |
| JS main gzip        | 75.44 KB   | 75.90 KB    | +0.46 KB（+0.6%）— ToolResultCard + 2 lingui msg |
| **size-limit 实测** | n/a        | **75.76 KB** | 80 KB 预算下安全（剩 4.24 KB 余量） |

JS 净增 0.46 KB 是 ToolResultCard 子组件 + 两条新 lingui 文案的代价，可接受。CSS 净减体现 orphan 清理。

## Deviations from Plan

### 与 PLAN 描述的差异（记录但非 deviation rule）

**1. ToolResultCard 用 `.aster-btn-primary--sm` 而非 PLAN 提示的 `.aster-iconbtn--primary`**
- **原因：** styles.css 现有的是 `.aster-btn-primary`/`.aster-btn-primary--sm`（连字符变体），不是 `.aster-iconbtn--primary`。`.aster-iconbtn` 是图标按钮基类，没有 `--primary` 修饰符。
- **选择：** 复用现有 `.aster-btn-primary--sm`（继续 20 步用品牌渐变 accent）+ 新增 `.aster-tool-card__btn-secondary` 描边二级按钮（停下）。
- **符合 CLAUDE.md UI 系统：** 渐变只作 accent，主操作（继续）走品牌渐变，二级（停下）走描边，层级清晰。

### Plan 05 cascade follow-up

**[Rule 3 - Blocking] Orphan CSS 在 Plan 06 范围内一并清理**
- **来源：** Plan 05 SUMMARY 显式 defer 给 Plan 06「chat-ui-cleanup 接力」
- **处理：** styles.css 删 116 + 加 86 = 净减 30 行；同时新版 `.aster-tool-card*` 玻璃拟态化（Plan 06 视觉系统设计）
- **commit：** 131c841 `refactor(03-06): wipe orphan CSS from Plan 05 cascade + restyle ToolResultCard`

### Auto-fixed Issues

None — 本 plan 范围内没有发现 bug / missing critical functionality。

### Authentication Gates

None — 本 plan 全 UI 改动，零网络调用 / 零 Provider 交互。

## Commits

| Commit      | Type     | 描述                                                           |
| ----------- | -------- | -------------------------------------------------------------- |
| 343f520     | test     | RED — 5 new it() in ChatStream.test.tsx（折叠/展开/soft-landing/两按钮交互） |
| 11117f3     | feat     | GREEN — ChatStream 加 ToolResultCard 子组件 + role 分发 + lingui extract+compile |
| 131c841     | refactor | Cleanup — 删 orphan CSS（80 行）+ 新版 .aster-tool-card* 玻璃拟态化 |

## Threat Model 复核

| Threat ID | Category | Component                       | Disposition | 实际落地                                                                    |
| --------- | -------- | ------------------------------- | ----------- | --------------------------------------------------------------------------- |
| T-06-01   | Info disclosure | role='tool' toolResult JSON | accept      | ✅ 默认折叠（aria-expanded=false）；展开时 `JSON.stringify` 转的是 loop.ts dispatch 已 sanitize 的 ToolResult，不含 stack/Key/路径（Plan 02 ERR-02 保障） |
| T-06-02   | Tampering | soft-landing 按钮             | mitigate    | ✅ 两按钮都走 agentStore named selector（`continueRun` / `abort`），不直接 mutate controller / chatStore；agentStore 是单一受控入口 |

无新增 threat surface。

## Self-Check: PASSED

**Files**
- `[ ]` src/components/ChatStream.tsx — FOUND (Plan 06 重构)
- `[ ]` src/components/ChatStream.test.tsx — FOUND (5 new it)
- `[ ]` src/styles.css — FOUND (净减 30 行)
- `[ ]` src/i18n/locales/zh-CN/messages.po — FOUND (+2 msg)
- `[ ]` src/i18n/locales/zh-CN/messages.ts — FOUND (lingui compile)
- `[ ]` .planning/phases/03-agent-loop-privacy-word-demo/03-06-SUMMARY.md — FOUND (this file)

**Commits**
- `[x]` 343f520 — FOUND in git log
- `[x]` 11117f3 — FOUND in git log
- `[x]` 131c841 — FOUND in git log

**Tests / Build / Size**
- `[x]` `npm test` → 29 files / 296 tests pass（+3 pre-existing unhandled errors，已 deferred-items 记录）
- `[x]` `npm run build` → built in 1.19s, no errors
- `[x]` `npm run size` → 75.76 KB / 80 KB budget — PASS

**Grep validation**
- `[x]` `grep ToolCallPreviewCard|AutoInsertEffect|FallbackInsertMenu src/components/*.tsx` → 0 active references（仅 jsdoc 注释）
- `[x]` `grep autoInsertMode|setAutoInsertMode|'AI 自动写文档' src/components/*.tsx` → 0 active references（仅 jsdoc 注释 + messages.po 的 `#~` obsolete 块）
- `[x]` `grep aster-segmented|aster-insert-btn|aster-insert-menu|aster-bubble__actions|aster-tool-card--accepted|aster-tool-card--rejected|aster-tool-card__pos|aster-tool-card__preview src/styles.css` → 0 active selectors（仅清理注释中提及变更历史）
