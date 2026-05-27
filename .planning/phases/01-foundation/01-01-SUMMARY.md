---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [vite, typescript, react, fluent-ui, zustand, lingui, office-js, vitest, size-limit, vite-plugin-office-addin]

# Dependency graph
requires: []
provides:
  - "repo 根 package.json：React 19 + Fluent UI v9 + Zustand + Lingui + Vitest + size-limit 依赖栈（~135KB gzip 基线）"
  - "vite.config.ts：office-addin 插件 + lingui 插件 + base /Aster/ + 双 HTML 入口 + manualChunks"
  - "tsconfig.json：TS strict + office-js 全局类型"
  - "index.html：CDN Office.js + module entry（Task Pane 入口）"
  - "lingui.config.ts：zh-CN only Lingui scaffold"
  - "src/i18n/index.ts：loadAndActivate zh-CN，供 I18nProvider 消费"
  - "src/i18n/locales/zh-CN/messages.ts：占位 catalog"
affects: [01-02, 01-03, 01-04, 01-05, 01-06]

# Tech tracking
tech-stack:
  added:
    - "react@^19.0.0, react-dom@^19.0.0"
    - "@fluentui/react-components@^9.73.0, @fluentui/react-icons@^2.0.0"
    - "zustand@^5.0.0"
    - "react-markdown@^9.0.0, remark-gfm@^4.0.0"
    - "@lingui/react@^5.0.0, @lingui/macro@^5.0.0, @lingui/cli@^5.0.0, @lingui/vite-plugin@^5.0.0"
    - "vite@^7.0.0, @vitejs/plugin-react@^4.0.0"
    - "vite-plugin-office-addin@^1.0.0"
    - "vitest@^2.0.0"
    - "size-limit@^11.0.0, @size-limit/preset-app@^11.0.0"
    - "@types/office-js@latest"
  patterns:
    - "CDN Office.js script 先于 module entry（INSTALL-04 硬约束）"
    - "vite-plugin-office-addin 管 HTTPS dev 证书与 manifest serve"
    - "@vitejs/plugin-react 配 babel macros 支持 Lingui macro 转换（非 SWC 版）"
    - "browserslist Edge/Chrome >= 120 限定 MVP 目标平台"
    - "base: /Aster/ 用于 GitHub Pages 子路径托管"
    - "manualChunks: fluent/markdown/react 三块拆分"
    - "Lingui zh-CN only，extract/compile 工作流就位"

key-files:
  created:
    - "package.json"
    - "tsconfig.json"
    - "index.html"
    - "vite.config.ts"
    - "lingui.config.ts"
    - "src/i18n/index.ts"
    - "src/i18n/locales/zh-CN/messages.ts"
  modified: []

key-decisions:
  - "沿用 @vitejs/plugin-react（非 SWC）+ babel macros，与 @lingui/vite-plugin 组合；不换 react-swc（会与 babel-macro 冲突）"
  - "vite-plugin-office-addin 需传空 options 对象 officeAddin({})，其函数签名要求 options 参数"
  - "npm install 成功，5 个中级漏洞来自传递依赖，非本 plan 引入，记录后不处理"

patterns-established:
  - "Shared Pattern 2: worker/static asset 必须用 new URL(..., import.meta.url).href，禁 ?url"
  - "Shared Pattern 3: CDN Office.js script 先于 module entry"
  - "Lingui macro 接线：react() + babel macros + @lingui/vite-plugin 三件套"

requirements-completed: [FOUND-01, FOUND-02, FOUND-08, INSTALL-04]

# Metrics
duration: 3min
completed: 2026-05-27
---

# Phase 01 Plan 01: 脚手架基座 Summary

**Vite 7 + React 19 + Fluent UI v9 + Lingui zh-CN + office-addin 插件全链路接线，repo 根目录 7 个配置/入口文件就位，TypeScript strict + office-js 类型零报错**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-27T07:24:40Z
- **Completed:** 2026-05-27T07:27:39Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- package.json：React 19 + Fluent UI v9 + Zustand + Lingui + Vitest + size-limit 完整依赖栈，browserslist Edge/Chrome >= 120，scripts 含 test/size/extract/compile
- vite.config.ts：office-addin 插件 + lingui 插件 + base /Aster/ + 双 HTML 入口（index.html + commands.html）+ manualChunks 保留 spike 基线
- tsconfig.json：strict=true + office-js 全局类型（Office.onReady/PowerPoint.run/Excel.run/Word.run 唯一来源）
- index.html：CDN Office.js 先于 module entry，lang=zh-CN，title=Aster
- Lingui scaffold：lingui.config.ts（zh-CN only）+ src/i18n/index.ts（loadAndActivate）+ 占位 messages.ts
- npm install 成功（510 packages），npx tsc --noEmit 零错误

## Task Commits

1. **Task 1: 提升 package.json + tsconfig.json + index.html** - `d33b8bd` (chore)
2. **Task 2: 创建 vite.config.ts** - `155a1ba` (chore)
3. **Task 3: Lingui scaffold** - `879551b` (feat)

## Files Created/Modified

- `package.json` — 正式依赖栈 + scripts（test/size/extract/compile）+ browserslist
- `tsconfig.json` — TS strict + office-js types + include *.config.ts
- `index.html` — Task Pane 入口，CDN Office.js 先于 module entry
- `vite.config.ts` — office-addin 插件 + lingui 插件 + base /Aster/ + 双 HTML 入口 + manualChunks
- `lingui.config.ts` — zh-CN only Lingui scaffold，format=po
- `src/i18n/index.ts` — loadAndActivate zh-CN，export i18n 供 I18nProvider
- `src/i18n/locales/zh-CN/messages.ts` — 占位 catalog（extract 后自动填充）

## Decisions Made

- 保留 `@vitejs/plugin-react`（非 SWC 版）并配 `babel: { plugins: ['macros'] }`，与 `@lingui/vite-plugin` 协作——切换到 SWC 版会与 babel-macro 冲突
- `vite-plugin-office-addin` 函数签名要求必传 options 对象，用 `officeAddin({})` 满足约束

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vite.config.ts 中 officeAddin() 调用缺少必需参数**

- **Found during:** Task 3（tsc --noEmit 验证阶段）
- **Issue:** `vite-plugin-office-addin` 的导出函数签名为 `officeManifest(options: Options): Plugin`，options 参数为必需（无默认值），`officeAddin()` 零参调用导致 TS2554 类型错误
- **Fix:** 改为 `officeAddin({})` 传入空 options 对象，Options 接口字段均为 optional（devUrl?/prodUrl?），空对象满足类型约束
- **Files modified:** `vite.config.ts`
- **Verification:** `npx tsc --noEmit` 输出 "TypeScript compilation completed"，零错误
- **Committed in:** `879551b`（Task 3 commit，含 vite.config.ts 修复）

---

**Total deviations:** 1 auto-fixed（Rule 1 - Bug）
**Impact on plan:** 修复为正确性必要项（构建配置文件类型错误会阻断后续 plan）。无范围蔓延。

## Issues Encountered

- npm audit 报 5 个中级漏洞，均来自传递依赖（非本 plan 直接引入），不影响构建，记录后不处理。

## Known Stubs

- `src/i18n/locales/zh-CN/messages.ts` — `export const messages = {}` 占位，需在首次添加业务字符串后运行 `npm run extract && npm run compile` 填充。这是 plan 设计内的意图性占位，plan 05（main.tsx）使用 I18nProvider 时触发首次 extract。

## Threat Flags

无新增威胁面——本 plan 仅为配置/脚手架文件，无网络端点、无 auth 路径、无文件访问。T-01-02（API Key 默认值）：package.json 与 vite.config.ts 均未引入任何 Provider 凭证或 localStorage 键名常量，符合 mitigate 要求。

## Next Phase Readiness

- 构建底座就位，所有后续 plan（01-02 到 01-06）可直接依赖本 plan 的配置文件
- 下一步：01-02（manifest.xml 扩展三宿主 + shared runtime）和 01-03（Vitest smoke test）均已具备先决条件
- commands.html（01-04 创建）已在 vite.config.ts rollupOptions.input 声明入口路径，plan 04 创建文件后即可 build

---
*Phase: 01-foundation*
*Completed: 2026-05-27*
