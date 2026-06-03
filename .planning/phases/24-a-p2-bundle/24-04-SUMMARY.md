---
phase: 24-a-p2-bundle
plan: "04"
subsystem: ui/components
tags: [ppt, pvq-06, slide-preview, react-lazy, lingui, bundle-gate, uat]
dependency_graph:
  requires:
    - plan: "24-01"
      provides: visual_check_slide stub + visual-check.test.ts skeleton
    - plan: "24-02"
      provides: mapShapesToRender (slide-preview.ts) + PVQ06_VISUAL_CHECK_ENABLED flag
    - plan: "24-03"
      provides: visual_check_slide real execute() + registerPreviewElement() export
    - src/agent/design/ppt-layouts.ts (buildLayout, ShapeSpec, LayoutName)
    - src/agent/design/slide-preview.ts (mapShapesToRender)
    - src/agent/tools/read/visual-check.ts (registerPreviewElement)
  provides:
    - SlidePreviewPanel React component (lazy chunk, teal 克制 UI)
    - ChatStream ToolResultCard apply_slide_layout 结果 → SlidePreviewPanel 挂载
    - 24-UAT-PACKET.md (spike-gate 人眼判定采集包)
  affects:
    - 后续 UAT 阶段 (spike-gate 人眼判定，LOCKED-1)
    - visual_check_slide 工具（通过 registerPreviewElement DOM ref 截图）
tech-stack:
  added: []
  patterns:
    - "SlideLayoutArgs interface 从 SlidePreviewPanel 导出，ChatStream 只传 args 对象（不 import buildLayout）"
    - "buildLayout 在 lazy chunk 内调用（ppt-layouts 不进 main）：bundle safety pattern"
    - "React.lazy + Suspense fallback=null 条件挂载（与 imageResult/stockResult 同范式）"
    - "layoutArgs 从 ToolCall.arguments（已是对象）提取，不 JSON.parse，不从 toolResult.data 读"
    - "coverage.test.ts 守门：npm run extract 必须在每次代码行数变化后 commit，否则行号 diff 失败"

key-files:
  created:
    - src/components/SlidePreviewPanel.tsx
    - .planning/phases/24-a-p2-bundle/24-UAT-PACKET.md
  modified:
    - src/components/ChatStream.tsx
    - src/styles.css
    - src/i18n/locales/zh-CN/messages.po

key-decisions:
  - "buildLayout 移入 SlidePreviewPanel lazy chunk（不进 main），而非在 ChatStream 静态 import：保证 ppt-layouts 不拖入 main chunk"
  - "SlidePreviewPanel props 改为 args: SlideLayoutArgs（{layout,content,accent_color}），ChatStream 只提取原始 args 对象不做 buildLayout 调用"
  - "Lingui extract 必须在代码行数变化后 commit messages.po，coverage.test.ts 用 git diff 守门"
  - "UAT-PACKET spike-gate 是纯人眼判定（LOCKED-1），不写数值断言/自动化比对"

patterns-established:
  - "lazy chunk interface export: SlideLayoutArgs 在 lazy 组件文件内 export，调用方 type import — 类型不拉入 main runtime"
  - "Lingui extract + commit 联动：任何行数变化都要 re-extract + re-commit，否则 coverage.test.ts 红"

requirements-completed:
  - PVQ-06
  - NFR-11

duration: 40min
completed: 2026-06-03
---

# Phase 24 Plan 04: Phase 24 收尾 Summary

**SlidePreviewPanel React.lazy 懒加载 UI 组件（teal 克制，注册 DOM ref 供截图）+ ChatStream apply_slide_layout 结果接线（args→buildLayout 在 lazy chunk）+ bundle gate 80.86KB 通过 + UAT-PACKET spike-gate 人眼判定采集包**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-06-03T15:30:00Z
- **Completed:** 2026-06-03T15:48:00Z
- **Tasks:** 3
- **Files modified:** 5 (SlidePreviewPanel.tsx 新建, ChatStream.tsx, styles.css, messages.po 更新, 24-UAT-PACKET.md 新建)

## Accomplishments

- SlidePreviewPanel.tsx 创建：teal 克制设计，React.lazy 可懒加载，registerPreviewElement DOM ref 注入，ResizeObserver 16:9 动态缩放，buildLayout 在 lazy chunk 内调用（颜色物理隔离）
- ChatStream.tsx 接线：lazy SlidePreviewPanel + ToolResultCard 内 layoutArgs 提取（apply_slide_layout tool-call args 直接读，不 JSON.parse，不从 toolResult.data 读 shapes）+ Suspense 条件挂载
- bundle gate 通过：main-*.js **80.86KB gzip**（门限 82KB，余量 1.14KB）；SlidePreviewPanel 独立 chunk 1.06KB，html2canvas 独立 chunk 47.43KB
- UAT-PACKET.md：步骤 A/B/C/D 保真度对比图采集、spike-gate 人眼评估四项表、降级路径 flag flip 指南、3 个可调项默认值 + 开关位置

## Task Commits

1. **Task 1: SlidePreviewPanel UI 组件 + styles.css CSS 类** - `931eb32` (feat)
2. **Task 2: ChatStream.tsx 接线 + Lingui extract** - `979f831`, `aeddcf1` (feat + chore)
3. **Task 3 bundle fix: buildLayout 移入 lazy chunk** - `9162f94` (fix)
4. **Task 3 Lingui re-extract: bundle fix 后行号更新** - `8c27796` (chore)
5. **Task 3 UAT-PACKET.md** - `febb51f` (docs)

## Files Created/Modified

- `src/components/SlidePreviewPanel.tsx` — 幻灯片自渲染预览面板（default export，React.lazy，buildLayout 内置，registerPreviewElement 注入，mapShapesToRender 渲染）
- `src/components/ChatStream.tsx` — lazy SlidePreviewPanel 声明 + ToolResultCard layoutArgs 提取 + Suspense 条件挂载；移除 buildLayout 静态 import
- `src/styles.css` — Phase 24 CSS 类块（.slide-preview-panel / __header / __title / __status / __status--error + .slide-preview-container），teal 克制，无渐变无 backdrop-filter
- `src/i18n/locales/zh-CN/messages.po` — Lingui extract 同步（149 条目，幻灯片预览 msgid 新增 + 行号更新）
- `.planning/phases/24-a-p2-bundle/24-UAT-PACKET.md` — UAT 对比图采集包（spike-gate 人眼判定，LOCKED-1）

## Decisions Made

- **buildLayout 移入 lazy chunk**：计划预期 buildLayout 体积极小可进 main，但实测 ppt-layouts.ts（326行）拖进 main 导致超标 83.64KB。修复：把 buildLayout 调用移入 SlidePreviewPanel（已在 lazy chunk），ChatStream 只传 SlideLayoutArgs（类型 import，不进 runtime）。
- **SlidePreviewPanel props 改为 args 对象**：props 从 `shapes: ShapeSpec[]` 改为 `args: SlideLayoutArgs`，让 panel 内部重建 shapes，与计划原始意图等效（单一真相源，0 改 write/ppt.ts），同时解决 bundle 问题。
- **Lingui extract 必须 commit 守门**：coverage.test.ts 用 git diff 守门，任何代码行数变化（包括 bundle fix 后的行号位移）都必须 re-extract + re-commit。

## P95 不退化论证

截图路径（visual_check_slide 触发时序）：
1. apply_slide_layout 完成（write tool）
2. AI 收到 layout_check evidence（几何自查结果）
3. AI 主动决定调 visual_check_slide（on-demand，非自动）
4. execute()：本地 DOM html2canvas 截图（< 200ms 本地 canvas，无网络）
5. analyzeImages vision API（~2-5s，与既有 get_shape_image 同量级）
6. 文字 evidence 进下一轮

**P95 = 首 token ≤2s 硬约束。** 截图在 agent loop 中间步骤，不在首 token 路径。渲染是离散事件（apply_slide_layout 完成后），不在 LLM 流式逐 token 热路径。buildLayout 重建 shapes 是本地纯函数，无网络无 Office.js round-trip。→ **截图不退化 P95。**（对应 threat model T-24-08 accept disposition）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ppt-layouts 静态 import 导致 main chunk 超标 83.64KB > 82KB**
- **Found during:** Task 3 bundle gate（stop-if-fail 检查点）
- **Issue:** ChatStream 静态 import `buildLayout` from `ppt-layouts.ts`（326行），把整个模块拉进 main chunk，导致 83.64KB > 82KB 门限
- **Fix:** 把 buildLayout 调用移入 SlidePreviewPanel（lazy chunk）；ChatStream 改为只传 SlideLayoutArgs args 对象（type import，不进 runtime）；SlidePreviewPanel props 从 `shapes` 改为 `args`
- **Files modified:** `src/components/SlidePreviewPanel.tsx`，`src/components/ChatStream.tsx`
- **Verification:** `npm run build && npm run size` → 80.86KB（< 82KB 门限）
- **Committed in:** `9162f94` (fix)

**2. [Rule 3 - Blocking] Lingui coverage.test.ts 连续 3 次行号 diff 导致失败**
- **Found during:** Task 2 + Task 3
- **Issue:** coverage.test.ts 内部跑 `lingui extract` 后用 git diff 守门。每次修改 ChatStream/SlidePreviewPanel 行数都会导致 messages.po 行号位移，必须 re-extract + re-commit
- **Fix:** 每次代码行数变化后额外运行 `npm run extract` 并 commit messages.po
- **Files modified:** `src/i18n/locales/zh-CN/messages.po`（3 次 commit）
- **Verification:** `npx vitest run src/i18n/coverage.test.ts` → PASS
- **Committed in:** `aeddcf1`, `8c27796` (chore)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 3 blocking)
**Impact on plan:** bundle 超标是关键 stop-if-fail 问题，修复方案等效于计划原始意图（buildLayout 在 lazy chunk 内调用，单一真相源）。Lingui 守门是已知模式（memory project_i18n_extract_and_test_noise），行号 diff 是假 blocking，不是真缺失。

## Known Stubs

无。SlidePreviewPanel 已接入 buildLayout（来自 ppt-layouts，6 套版式全实现）+ mapShapesToRender（Phase 24-02 实现），数据流已通（args → buildLayout → ShapeSpec[] → mapShapesToRender → 渲染 div）。视觉自查工具（visual_check_slide）通过 registerPreviewElement 可取到 previewEl，截图链路完整。

## Threat Flags

无新增 threat surface。截图范围限于 `.slide-preview-container`（AI 生成形状，不含 API Key UI）；T-24-07（截图范围）和 T-24-02（base64 不进 history）均已在 Plan 24-03 threat model 覆盖；SlidePreviewPanel 不 import html2canvas。

## Next Phase Readiness

Phase 24 全部 4 个 Plan 执行完成：
- 24-01：visual_check_slide stub + 测试骨架
- 24-02：slide-preview.ts mapShapesToRender + PVQ06_VISUAL_CHECK_ENABLED flag
- 24-03：visual_check_slide real execute()（html2canvas + vision）
- 24-04：SlidePreviewPanel UI + ChatStream 接线 + bundle gate 通过

**Spike-gate 待 UAT：** PVQ06_VISUAL_CHECK_ENABLED = true（默认铺开），UAT 人眼判定后决定是否降级。采集包在 `.planning/phases/24-a-p2-bundle/24-UAT-PACKET.md`。

两条路径最终状态：
- 铺开路径：PVQ06_VISUAL_CHECK_ENABLED = true（当前默认）；visual_check_slide 工具在 AI 可用列表中
- 降级路径：PVQ06_VISUAL_CHECK_ENABLED = false；visual_check_slide 从工具列表消失；check_slide_layout 几何自查兜底

---

## Self-Check

已验证：

- `src/components/SlidePreviewPanel.tsx` 存在
- `.planning/phases/24-a-p2-bundle/24-UAT-PACKET.md` 存在
- `931eb32`, `979f831`, `aeddcf1`, `9162f94`, `8c27796`, `febb51f` 均在 git log

## Self-Check: PASSED

---
*Phase: 24-a-p2-bundle*
*Completed: 2026-06-03*
