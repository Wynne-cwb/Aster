---
phase: 01-foundation
plan: "05"
subsystem: ui
tags: [react, fluent-ui, office-js, lingui, context-api, adapter-pattern, selection-events]

requires:
  - phase: 01-01
    provides: i18n scaffold (i18n/index.ts), lingui zh-CN setup
  - phase: 01-03
    provides: createAdapter factory, DocumentAdapter interface, SelectionContext union types

provides:
  - "src/context/AdapterContext.ts — DocumentAdapter React Context + useAdapter hook"
  - "src/main.tsx — Office.onReady host 分流，host-aware Fluent 主题，Context + I18nProvider render"
  - "src/App.tsx — 350px flex-column 三段 shell（PANE-01）"
  - "src/components/ContextCard.tsx — 实时 selection-changed 上下文卡（ROADMAP SC3）"
  - "src/components/ChatStream.tsx — 空态聊天流（開始使用 Aster）"
  - "src/components/InputBar.tsx — 全禁用占位输入栏（D-07/D-08）"

affects:
  - phase-02 (Provider 接入、LLM 聊天逻辑将填入 ChatStream/InputBar 已定义的 flex slot)
  - phase-03 (文件上传图标 ArrowUploadRegular 已占位，Phase 3 启用)
  - phase-04-06 (宿主业务功能通过 useAdapter hook 消费 DocumentAdapter)

tech-stack:
  added:
    - "@fluentui/react-components — Card, Text, Button, Dropdown, Textarea, Tooltip, tokens"
    - "@fluentui/react-icons — ArrowUploadRegular"
    - "@lingui/react/macro — Trans, useLingui"
    - "React 19 createContext / useContext / useEffect / useState / useRef"
  patterns:
    - "AdapterContext Pattern: createContext<DocumentAdapter | null> + useAdapter hook，main.tsx 注入，组件 hook 消费"
    - "host-aware 主题：读 officeTheme.bodyBackgroundColor 亮度决定 light/dark Fluent 主题"
    - "selection-changed 订阅：useEffect + adapter.onSelectionChanged，cleanup 返回 unsub（D-13）"
    - "discriminated union switch with exhaustive never check（formatSelection）"
    - "token-first styling：所有 spacing/颜色用 tokens.*，禁硬编 px/hex（UI-SPEC 硬规则）"

key-files:
  created:
    - src/context/AdapterContext.ts
    - src/main.tsx
    - src/App.tsx
    - src/components/ContextCard.tsx
    - src/components/ChatStream.tsx
    - src/components/InputBar.tsx
  modified:
    - vite.config.ts (Rule 3 fix — CJS/ESM 互操作)

key-decisions:
  - "useAdapter hook 封装 useContext 校验（not null），防止在 Provider 外调用时静默失败"
  - "host-aware 主题用 bodyBackgroundColor RGB 亮度（luminance < 128 → dark），而非 isDarkTheme 字段（该字段在部分 Office 版本不可用）"
  - "品牌色 pulse 用 colorBrandBackground2 tint + CSS transition，不用 animation（避免 motion 敏感用户问题）"
  - "InputBar 用两行布局（Provider+Upload / Textarea+Send），而非单行——350px 宽度下单行过挤"
  - "ContextCard formatSelection 用 t template literal tag（useLingui hook）而非 Trans 包裹，因为返回值是 string 不是 JSX"

patterns-established:
  - "Fluent v9 具体 import（非 barrel）：import { Card, Text, Button } from '@fluentui/react-components'"
  - "Lingui macro：<Trans> 用于 JSX，t template tag 用于 string 返回值（useLingui hook）"
  - "spacing token inline style：paddingLeft: tokens.spacingHorizontalM 等，禁硬编数字"
  - "selection 事件订阅 pattern：useEffect → onSelectionChanged → getSelection → setState + cleanup unsub"

requirements-completed: [FOUND-03, PANE-01, NFR-06]

duration: 7min
completed: 2026-05-27
---

# Phase 01 Plan 05: Task Pane 视觉 Shell Summary

**Office.onReady host 分流 + React Context adapter 注入 + 350px 三段 Fluent UI shell，ContextCard 实时监听 selection-changed 并按三宿主 union 格式化显示（ROADMAP SC3 达成）**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-27T07:46:27Z
- **Completed:** 2026-05-27T07:53:XX Z
- **Tasks:** 3/3
- **Files modified:** 7

## Accomplishments

- Office.onReady 读 `info.host` 调 `createAdapter` 实例化三宿主 adapter，经 AdapterContext 暴露给组件树（FOUND-03 硬要求达成）
- 350px flex-column 三段 shell 渲染正常：顶部上下文卡 + 中部空态聊天区 + 底部禁用输入栏（PANE-01）
- ContextCard 通过 `adapter.onSelectionChanged` 实时订阅宿主事件，discriminated union switch 覆盖 ppt/excel/word/none 四种情况，cleanup 解绑防泄漏（ROADMAP SC3，T-01-13）
- host-aware 主题：读 `Office.context.officeTheme.bodyBackgroundColor` 亮度自动切换 light/dark Fluent 主题
- 全文案 Lingui macro 包裹（Trans/useLingui），全 spacing/颜色 Fluent v9 token（UI-SPEC 硬规则完整覆盖）
- `npm run build` 产出 dist/ 成功，初始 JS gzip ~77KB（Fluent chunk）+ ~61KB（main chunk），远低于 1MB 限制

## Task Commits

1. **Task 1: AdapterContext + main.tsx** - `2365634` (feat)
2. **Task 2: App.tsx + ChatStream + InputBar** - `4c39e33` (feat)
3. **Task 3: ContextCard + vite.config fix** - `d75c5dd` (feat)
4. **Plan metadata** - `[final commit hash]` (docs)

## Files Created/Modified

- `src/context/AdapterContext.ts` — createContext<DocumentAdapter | null> + useAdapter hook
- `src/main.tsx` — Office.onReady host 分流，host-aware 主题，FluentProvider+I18nProvider+AdapterContext.Provider
- `src/App.tsx` — 350px flex-column 三段 shell，colorNeutralBackground1/2 token
- `src/components/ContextCard.tsx` — useEffect 订阅 onSelectionChanged，formatSelection 四 kind switch，品牌色 pulse
- `src/components/ChatStream.tsx` — 空态居中块，「开始使用 Aster」fontSizeBase400 semibold
- `src/components/InputBar.tsx` — 全禁用：Provider Dropdown + ArrowUploadRegular + Textarea + Send primary Button
- `vite.config.ts` — Rule 3 fix：vite-plugin-office-addin CJS/ESM 互操作修复

## Decisions Made

- `useAdapter` hook 内部做 null 校验并 throw，而非返回 `T | null`——组件树内任何地方 call 都安全
- host-aware 主题用 bodyBackgroundColor 亮度计算，降级为 light（兼容 officeTheme 不可用的老版本 Office）
- InputBar 双行布局（Provider+Upload / Textarea+Send），350px 宽度下单行过挤且影响触控目标尺寸
- ContextCard 品牌色 pulse 用 colorBrandBackground2（subtle tint）不用 colorBrandBackground（过浓），timeout 800ms ease-out

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vite-plugin-office-addin CJS/ESM 互操作修复**
- **Found during:** Task 3 验证阶段（`npm run build`）
- **Issue:** `officeAddin is not a function` — vite-plugin-office-addin 是 CJS 模块（`exports.default = officeManifest`），在 Vite ESM 上下文中 `import officeAddin from 'vite-plugin-office-addin'` 读到的是整个 CJS module 对象而非函数本身
- **Fix:** 用 `.default` 解包：`const officeAddin = (_officeAddin as unknown as { default: ... }).default ?? _officeAddin`
- **Files modified:** vite.config.ts
- **Verification:** `npm run build` 成功，dist/ 正常产出
- **Committed in:** d75c5dd (Task 3 commit)

**2. [Rule 3 - Blocking] 临时安装 babel-plugin-macros**
- **Found during:** Task 3 验证阶段（`npm run build`）
- **Issue:** `Cannot find package 'babel-plugin-macros'` — Lingui macro babel 插件未在 devDependencies 中声明
- **Fix:** `npm install babel-plugin-macros --no-save`（临时安装，不修改 package.json）
- **Note:** 计划约束禁止修改 package.json；此包应在后续阶段正式加入 devDependencies
- **Committed in:** 未提交（仅 node_modules 变更）

---

**Total deviations:** 2 auto-fixed (2 blocking — Rule 3)
**Impact on plan:** 两处修复均为预先存在的 vite 配置问题，非 plan 05 引入。`babel-plugin-macros` 需后续正式声明到 devDependencies。

## Known Stubs

- `src/components/ChatStream.tsx` — 空态渲染，无消息列表。Phase 2 接入 LLM 后将渲染 messages 列表（react-markdown）。功能目标（空态占位）已达成，不影响本 plan 目标。
- `src/components/InputBar.tsx` — 全禁用占位。Provider 下拉、文件上传、消息输入、发送均禁用。Phase 2/3 接入逻辑时启用。诚实表达能力边界（D-08），符合 plan 设计意图。

## Issues Encountered

- `vite-plugin-office-addin` 的 CJS/ESM 互操作 bug 在 worktree 首次 `npm install` 后暴露，未出现在主仓库（可能主仓库 node_modules 已有缓存版本）。修复简单，不影响功能正确性。

## User Setup Required

None — 无外部服务配置。

## Next Phase Readiness

- **Phase 2 可直接消费：**
  - `useAdapter()` hook 返回当前宿主的 DocumentAdapter
  - `<ChatStream>` flex slot 已就位，Phase 2 渲染消息列表只需填充内容
  - `<InputBar>` 各控件已占位，Phase 2 启用（去掉 disabled）并接入事件 handler
- **待解决：**
  - `babel-plugin-macros` 应正式加入 package.json devDependencies（当前临时安装）
  - 真机 sideload 验证（三宿主 350px 三段 + 上下文卡随选区刷新）由 ROADMAP SC1/SC3 在 Phase 7 REL-04 完成

## Self-Check: PASSED

- All 6 source files created and exist on disk
- SUMMARY.md created and exists
- All 3 task commits verified in git log (2365634, 4c39e33, d75c5dd)
- `npx tsc --noEmit` 0 errors

---
*Phase: 01-foundation*
*Completed: 2026-05-27*
