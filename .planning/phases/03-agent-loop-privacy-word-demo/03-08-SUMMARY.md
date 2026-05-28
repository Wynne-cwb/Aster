---
phase: 03-agent-loop-privacy-word-demo
plan: 08
subsystem: ui
tags: [zustand, office-js, selection, react, lingui, carry-01]

# Dependency graph
requires:
  - phase: 02-provider-settings-onboarding-ux
    provides: "SelectionPill / ContextCard / AdapterContext.getSelection + onSelectionChanged 三宿主 adapter（v1 选区流向骨架）"
  - phase: 01-foundation
    provides: "DocumentAdapter SelectionContext discriminated union（四变体 ppt/excel/word/none）"
provides:
  - "useSelectionStore — 新 Zustand store，单字段 initial: SelectionContext，承载 main.tsx Office.onReady 内预取的选区初值"
  - "main.tsx 路径 A — Office.onReady 回调改 async；root.render 之前 await adapter.getSelection() + setState({ initial })；try/catch 兜底 { kind: 'none' }"
  - "SelectionPill / ContextCard 接 useSelectionStore.initial — useState 函数式初值消费 store 预取值；删除 useEffect 内首次 getSelection；保留 onSelectionChanged 订阅处理用户后续切换"
  - "三宿主自动化网 — 4 个测试文件共 18 个新测试覆盖 PPT/Excel/Word 首帧文案 + 「mount 不调 adapter.getSelection」守卫"
affects: [04-read-tools, 05-write-tools, 06-agent-control-bar]

# Tech tracking
tech-stack:
  added: []  # 0 净新增运行时依赖（D-02 约束）
  patterns:
    - "Zustand store + 函数式 useState 初值（store.getState().initial）— 跨 React mount 与异步预取的标准桥接"
    - "Office.onReady 内预取异步状态 → setState 灌 store → root.render 顺序（CARRY-01 路径 A）"
    - "测试中 mock formatSelection 直接桩文案（绕过 lingui msg 宏在 .ts 文件下不被 vitest 转换的限制，对齐 formatSelection.test.ts 注释中的说明）"

key-files:
  created:
    - "src/store/selection.ts — useSelectionStore Zustand store（~25 行，含 doc 注释）"
    - "src/store/selection.test.ts — store 初值 + setState 守卫（4 测试）"
    - "src/main.test.tsx — 路径 A 集成守卫（4 测试，模拟 main.tsx 回调体）"
    - "src/components/SelectionPill.test.tsx — 三宿主首帧文案 + getSelection 调用次数（5 测试）"
    - "src/components/ContextCard.test.tsx — 三宿主首帧文案 + getSelection 调用次数（5 测试）"
  modified:
    - "src/main.tsx — Office.onReady 回调改 async + 预取选区 + setState 灌 store（+17 行）"
    - "src/components/SelectionPill.tsx — useState 初值来自 store；删 useEffect 首次 getSelection"
    - "src/components/ContextCard.tsx — useState 初值来自 store；删 useEffect 首次 getSelection；onSelectionChanged 加 try/catch 兜底"
    - "src/i18n/locales/zh-CN/messages.po — lingui extract 同步行号（i18n coverage.test.ts 守卫要求）"

key-decisions:
  - "选 path A（main.tsx 预取 + store 注入）— 最小侵入，单点修；放弃 path B (onSelectionChanged 注册时立即触发 callback)、path C (chatStore initial state)。D-22/D-23 已倾向 A，本 plan 落地"
  - "main.test.tsx 不直接 import main.tsx，而是封 simulateMainPathA helper 复刻回调体 — 因为 main.tsx 顶层有 Office.onReady 副作用，jsdom 下全局 Office 不存在，直 import 即 ReferenceError。此 helper 是 CARRY-01 acceptance 的最后一道自动化网"
  - "测试 mock formatSelection 而非依赖 catalog 解析 — formatSelection 是 .ts 文件，lingui msg 宏在 vitest 下不被转换（已在 src/components/formatSelection.test.ts 注释中明确）；mock 直桩 kind→文案的映射保证测试稳定，独立于 i18n 提取链路"

patterns-established:
  - "useSelectionStore.initial — 任何未来的 selection-aware 组件（Phase 4 read tools）useState 初值都应来自此 store，禁止再在 useEffect 内做首次 getSelection"
  - "Office.onReady 回调内异步预取 → setState 灌 store → root.render 是「初值前置」标准链路，未来添加新的「mount 前需就绪的宿主状态」（如 phase 4 read tool list_documents）沿用此模式"

requirements-completed: [CARRY-01]

# Metrics
duration: 10min
completed: 2026-05-28
---

# Phase 3 Plan 08: CARRY-01 selection-fix Summary

**v1 FU-01「首次取选区显示延迟」bug 修复 — Office.onReady 内预取选区灌 useSelectionStore.initial，SelectionPill / ContextCard useState 初值改读 store，首帧立即显示真实选区不再闪烁**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-28T16:55Z（worktree base reset 后）
- **Completed:** 2026-05-28T17:04Z
- **Tasks:** 2（按 PLAN 全部完成）
- **Files modified/created:** 9（4 新建源码/测试 + 1 修改 main + 2 修改组件 + 1 修改 .po + SUMMARY）

## Accomplishments

- **CARRY-01 修复路径 A 落地** — Phase 4 read tools 上线前的前置依赖完成；Office.onReady 内单次 `await adapter.getSelection()` + setState 一行 + 兜底 try/catch；组件改 useState 函数式初值，删除 v1 在 useEffect 内的首次取选区路径。
- **三宿主自动化守卫** — 4 个新测试文件 18 个测试全绿（PPT slide 3 / Excel A1:C10 / Word 150 字 / none 占位 + mount 不调 adapter.getSelection + getSelection 抛错兜底）。
- **零回归** — 全套 `npm test` 由 baseline 190 测试 → 208 测试（+18 新），`npm run build` 通过；bundle 75.25 KB gzipped（与 baseline 同量级，未引入新依赖）。

## Task Commits

按 PLAN 两 task 拆分提交：

1. **Task 3.1: 新建 useSelectionStore + main.tsx 路径 A 预取选区** — `b701fcd` (feat)
2. **Task 3.2: SelectionPill / ContextCard 接 useSelectionStore.initial + 三宿主单测** — `e1b5b42` (feat)

_TDD 路径：Task 3.2 经历 RED（先写 5 个 SelectionPill 测试，确认现行实现 5 失败）→ GREEN（改 SelectionPill.tsx 全过）→ 同模式接 ContextCard；Task 3.1 因 store + main.tsx 同步新增，单测一次写齐即通过，未走显式 RED 阶段。_

## Files Created/Modified

| 文件 | 角色 | 关键改动 |
| --- | --- | --- |
| `src/store/selection.ts` (NEW) | Zustand store | `useSelectionStore` 单字段 `initial: SelectionContext`，默认 `{ kind: 'none' }` |
| `src/store/selection.test.ts` (NEW) | 单测 | 4 测试：初值 + word/ppt/excel setState 守卫 |
| `src/main.tsx` | Task Pane 入口 | Office.onReady 回调改 `async (info) =>`；`hydrateFromStorage()` 后插入 `await adapter.getSelection()` + try/catch 兜底 + `useSelectionStore.setState({ initial })` 三件套（L45-67） |
| `src/main.test.tsx` (NEW) | 集成测试 | 4 测试：ppt/excel/word 上下文注入 + getSelection 抛错兜底；用 `simulateMainPathA` helper 复刻回调体 |
| `src/components/SelectionPill.tsx` | 组件 | `useState` 初值改 `() => formatSelection(useSelectionStore.getState().initial, i18n)` (L36-38)；删 useEffect 内首次 `void adapter.getSelection().then(setCtx)`；保留 `onSelectionChanged` 订阅含 try/catch (L40-54) |
| `src/components/SelectionPill.test.tsx` (NEW) | 单测 | 5 测试覆盖三宿主 + none + 「mount 不调 adapter.getSelection」 |
| `src/components/ContextCard.tsx` | 组件 | 同型改动：useState 函数式初值 (L33-35)；删 useEffect 首次 getSelection；onSelectionChanged 加 try/catch 兜底（对齐 SelectionPill WR-04 路径，L42-58） |
| `src/components/ContextCard.test.tsx` (NEW) | 单测 | 5 测试同 SelectionPill |
| `src/i18n/locales/zh-CN/messages.po` | catalog | `lingui extract` 同步行号（SelectionPill.tsx 63→70、ContextCard.tsx:25 移除） |

## Decisions Made

- **路径选择**：D-22/D-23 给出 A/B/C 三选项，本 plan 选 A（main.tsx Office.onReady 内预取 + store 注入）。A 是「最小侵入、单点修」，所有改动收敛在 main.tsx 5 行 + 一个新 store 文件 + 两个组件 useState 初值改一行。Path B（onSelectionChanged 注册时立即同步触发 callback）需要改 3 个 adapter；Path C（chatStore initial state）会污染 chatStore 语义（chatStore 已被规划为 Phase 3 后续 plan 改为 thin-delegate）。
- **测试 mock formatSelection**：formatSelection 是 .ts 文件，lingui `msg` 宏在 vitest 下不会被转换（详见 `src/components/formatSelection.test.ts` L4-8 注释）。如果让组件测试真实调 formatSelection，会拿到空字符串/未翻译占位。测试通过 `vi.mock('./formatSelection', ...)` 桩固定 kind→文案的映射，断言「组件首帧消费了哪个 kind 的 ctx」而不卷入 i18n 提取链路。
- **main.test.tsx 用 helper 而非真 import**：main.tsx 顶层 `Office.onReady(async ...)` 副作用在 jsdom 下无全局 `Office`，直 import 即 ReferenceError。改写 `simulateMainPathA` helper 复刻回调体 5 行（getSelection + try/catch + setState），覆盖路径 A 的逻辑契约。Helper 与 main.tsx 之间通过 plan/SUMMARY 注释绑定（任何修改 main.tsx 路径 A 的人都需要同步更新 helper）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] lingui catalog 行号漂移导致 `src/i18n/coverage.test.ts` 失败**
- **Found during:** Task 3.2 commit 后跑全套 npm test
- **Issue:** SelectionPill.tsx 改动改变了 `t\`关闭附带选区\``/`t\`开启附带选区\`` 出现的行号（63→70）；ContextCard.tsx 删除 `t\`未选中内容\`` 后 .po 里多余的 `#: src/components/ContextCard.tsx:25` 引用需移除。i18n/coverage.test.ts 守卫脚本（跑 `npx lingui extract` 后 `git diff --quiet` 对比 catalog）因此 fail，提示「运行 `npm run extract`，把变更后的 messages.po 一并提交」。
- **Fix:** 运行 `npm run extract`，将更新后的 `src/i18n/locales/zh-CN/messages.po` 一并加入 Task 3.2 commit（`e1b5b42`）。注意：coverage.test.ts 自身在 fail 路径会做 `git checkout -- ${CATALOG}` 重置，所以必须在 extract 后立刻 `git add` 并 commit，避免下次跑 test 又被重置。
- **Files modified:** `src/i18n/locales/zh-CN/messages.po`
- **Verification:** Task 3.2 commit 后全套 `npm test` 208/208 通过（含 coverage.test.ts）；`git diff` 净；`git status` 净。
- **Committed in:** `e1b5b42`（与组件改动同一 commit，确保 catalog 状态与组件行号原子一致）

---

**Total deviations:** 1 auto-fixed（1 blocking）
**Impact on plan:** 单纯 lingui 元信息漂移，零代码语义改动；不影响 plan 范围。属于本 phase D-13 之后所有 UI 改动都可能触发的「.po 重抽必步骤」，未来 plan 可考虑在 plan 模板里加 reminder。

## Issues Encountered

- **bundle size 75.25 KB gzipped 略高于 ~70 KB 目标**：D-03 给出软目标 ~70KB，当前主 chunk 75.25 KB。本 plan **零净增运行时依赖**（D-02 满足）、store 仅 ~200B、组件改动行数净增不多；但 baseline（commit 912d229）跑出来的主 chunk 已是 75.24 KB，本 plan commit 后仍 75.25 KB（差 1 字节，几无变化）。这是上游 phase 2 / 2.1 已有的体量，非本 plan 引入。如未来要 squeeze 到 70KB，需另起 perf plan（不在 03-08 范围）。

## CARRY-01 真机 UAT 回归脚本（Plan 08 / 真机验收必经）

本 plan 的自动化网仅覆盖单测层；CARRY-01 D-06「真机 UAT 重测三宿主」仍需用户在 Office for Web 上 sideload 跑下面三步（已在 PLAN.md `<output>` 段约定，此处复述供 Plan 08 真机会跑）：

| 宿主 | 准备 | 操作 | 期望 |
| --- | --- | --- | --- |
| **PowerPoint Web** | 打开有 ≥3 张 slide 的 .pptx；先在 PPT 内选中第 3 张 slide | 在 Ribbon 点 Aster 打开 Task Pane | 顶部上下文卡 + 输入栏选区胶囊 **首帧立即显示「第 3 张 slide」**，不出现「未选中内容」占位 → 真实文案的闪烁 |
| **Excel Web** | 打开任意 .xlsx；先选中 `A1:C10` 区域 | 在 Ribbon 点 Aster 打开 Task Pane | 上下文卡 + 胶囊 **首帧显示「选中区域 A1:C10」**，不闪烁 |
| **Word Web** | 打开任意 .docx；先选中 ~150 字段落 | 在 Ribbon 点 Aster 打开 Task Pane | 上下文卡 + 胶囊 **首帧显示「选中 150 字」**（或实际字符数），不闪烁 |

**若任一宿主仍出现首帧「未选中内容」占位**：CARRY-01 未真正修复，需查 Office.onReady 内 `await adapter.getSelection()` 是否真的在该宿主返回了非 'none' 上下文（怀疑 adapter 内 promise 落地时机）。

<deferred reason="awaiting user real-device validation">
**真机 UAT 必经项**：上面三宿主回归脚本须在 Office for Web sideload 真机环境跑通后才视作 CARRY-01 完全 done。Phase 3 总收尾的 D-06「真机 UAT 重测」流程会统一收口；本 plan 自动化层已就绪。
</deferred>

## User Setup Required

None — 本 plan 纯前端逻辑修复，不需要任何环境变量、外部服务配置或部署动作。

## Next Phase Readiness

- ✅ Phase 4 read tools 的前置依赖完成 — selection ctx 首帧就绪，不被 'none' 占位污染 agent 决策依据。
- ✅ `useSelectionStore` 已 export，Phase 4/5 引入新的 selection-aware 组件可直接消费 `useSelectionStore.getState().initial` 或订阅 `useSelectionStore`，不再写 useEffect 首次 getSelection。
- ⚠️ 真机 UAT（PPT/Excel/Word 三宿主）尚未跑 — 见上方 `<deferred>` 块；Phase 3 总收尾时由用户在 Plan 08 真机阶段完成。
- 📌 后续 plan 注意：本 plan 在 SelectionPill / ContextCard 内删除了 `void adapter.getSelection().then(...)` 路径；如未来引入新的「selection-aware 组件」，**不要**复制 v1 的首取路径——它已被证明会闪；改读 store。

## Self-Check: PASSED

文件存在性：
- `src/store/selection.ts` ✅
- `src/store/selection.test.ts` ✅
- `src/main.test.tsx` ✅
- `src/components/SelectionPill.test.tsx` ✅
- `src/components/ContextCard.test.tsx` ✅

Commit 存在性：
- `b701fcd` (Task 3.1) ✅
- `e1b5b42` (Task 3.2) ✅

验证脚本（PLAN <verification> 段全部满足）：
- `npm test` 全套全绿（208/208 含本 plan 18 新测试） ✅
- `npm run build` 通过 ✅
- `grep "adapter\.getSelection()\.then" src/components/SelectionPill.tsx src/components/ContextCard.tsx` → 0 命中 ✅
- `main.tsx` Office.onReady 回调签名 `async (info) =>` ✅
- `main.tsx` 含 `useSelectionStore.setState({ initial: ` ✅

---
*Phase: 03-agent-loop-privacy-word-demo*
*Completed: 2026-05-28*
