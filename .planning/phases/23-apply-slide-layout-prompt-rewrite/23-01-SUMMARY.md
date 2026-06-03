---
phase: 23-apply-slide-layout-prompt-rewrite
plan: 01
subsystem: ppt-agent-tools
tags: [office-js, powerpoint, layouts, undo, operationLog, geometry-check, design-tokens]

requires:
  - phase: 22-ppt-design-tokens-geometry-check
    provides: ppt-tokens.ts（FONT_LADDER/MARGINS/GAP/gridFull/gridTwoColumn/DEFAULT_ACCENT/SEMANTIC/Canvas/Rect）+ geometry-check.ts（checkSlideLayout/formatViolations/ShapeBox/TextBoxAnnotation）
provides:
  - "apply_slide_layout write 工具（盖印章建整页，create+fill；入 PPT_TOOLS + buildToolsForHost('ppt')）"
  - "src/agent/design/ppt-layouts.ts — 6 套版式库（cover/kpi/two_column/timeline/image_text/bullet_list）固化 960×540 坐标 + buildLayout 分派"
  - "PptAdapter.applySlideLayout(shapeSpecs) — 单 PowerPoint.run 建末页 + 填整页形状 + 捕 id/index 双定位 + newShapeIds"
  - "PostStateSnapshot kind 'ppt_layout'；reverse 复用既有 delete_slide_by_index inverse（撤销整张新页，原子）"
  - "PPT host 工具计数 22→23"
affects: [23-02-prompt-rewrite, 24-self-render-preview, v2.3-uat]

tech-stack:
  added: []
  patterns:
    - "create+fill 盖印章：一个 write tool call = 一整页原生形状；reverse = 删整张新页（复用 copy_slide 的 delete_slide_by_index，index+ID 双定位）"
    - "版式库 = 纯数据 + 纯函数（复用 ppt-tokens 网格/字号/边距，固化 960×540 坐标），零宿主 API / 零调色板"
    - "FIX2 分层=单形状：色块白字用一个 addGeometricShape 同时携 fillColor+text+bgForContrast；时间线连接线分段不压节点 → 几何自查 0 overlap"
    - "工具内部自动跑 Phase 22 checkSlideLayout → data.layout_check evidence（零 round-trip，AI 同 tool-result 自纠）"

key-files:
  created:
    - src/agent/design/ppt-layouts.ts
    - src/agent/design/ppt-layouts.test.ts
  modified:
    - src/adapters/PptAdapter.ts
    - src/agent/tools/write/ppt.ts
    - src/agent/operationLog.ts
    - src/agent/tools/index.ts
    - src/agent/tools/write/ppt.test.ts
    - src/agent/operationLog.integration.test.ts
    - src/agent/contract.test.ts
    - src/agent/tools/read/tools.test.ts
    - src/agent/tools/index.test.ts

key-decisions:
  - "架构 (B) create+fill（Lead 2026-06-03 接受、plan-check SOUND）：建新页填整页 → reverse 删整页，按构造永不动既有内容、撤销原子、无新 adapter inverse"
  - "配色全参数化收 accent_color hex，DEFAULT_ACCENT 仅兜底，涨跌用 SEMANTIC，绝不内置调色板（D-23-04）"
  - "唯一颜色护栏 = 内部 checkSlideLayout 对比度自查（D-23-05）"
  - "bullet_list 每条要点用单 TextBox 渲染（heading：text），未拆双框 bold-heading（overlap 安全优先，属 Claude's Discretion 实现细节，待 UAT 调）"

patterns-established:
  - "新增破坏性 PPT write 工具 → operationLog.integration.test 加 round-trip 守门 + contract.test CONTRACT 补行（integrationTest:true）+ PPT 计数同步 +1（结构性 gate）"
  - "版式 dogfood：把生成的 ShapeSpec[] 喂回 Phase 22 checkSlideLayout 断言 0 overlap/0 out_of_bounds（版式自身按构造干净）"

requirements-completed: [PVQ-03, PVQ-04]

duration: ~35min
completed: 2026-06-03
---

# Phase 23 (Plan 01): apply_slide_layout 盖印章工具 + 6 套版式库 Summary

**create+fill 盖印章 write 工具 `apply_slide_layout`：一个 tool call 在末尾建一张新页并按 6 套固化版式（封面/大数字KPI/两栏对比/时间线/图文左右/要点列表）建好整页原生可编辑形状；reverse=删整张新页（复用 copy_slide 的 delete_slide_by_index），内部自动跑几何自查返回 layout_check evidence；配色全参数化收 AI hex 无调色板。**

## Performance
- **Duration:** ~35 min
- **Tasks:** 5（全部 auto，原子提交）
- **Files created:** 2 | **modified:** 9

## Accomplishments
- `src/agent/design/ppt-layouts.ts`：6 套版式参数化生成函数 + 固化 960×540 坐标（复用 ppt-tokens 网格/字号/边距，紧凑、随 canvas 缩放）；KPI 弹性 1–4 + caps slice 截断 + capNotes；图文左右返 image_slots（autonomous-insert）；配色参数化（accent 入参 + DEFAULT_ACCENT 兜底 + SEMANTIC 涨跌 + 无调色板数组）。
- `PptAdapter.applySlideLayout`：单 `PowerPoint.run` slides.add 建末页 + reload + PPT-05 取末页 + 捕 id/index 双定位 + 逐 ShapeSpec addTextBox/addGeometricShape + fill/line/font/对齐 + 收 newShapeIds；A-06 proxy 不出闭包、catch→HostApiError；FIX4 几何写文字/字体前 `TEXT_SHAPE_TYPES.has(type)` 守门。
- `apply_slide_layout` ToolDef：reverse=`delete_slide_by_index`（Record 对象 {capturedIndex,capturedId}，复用既有 inverse）+ postState kind `ppt_layout` + humanLabel 版式中文名 + 内部 `checkSlideLayout`→`data.layout_check` evidence + `image_slots`；入 PPT_TOOLS + buildToolsForHost('ppt') write 列表。
- `operationLog.ts`：`PostStateSnapshot.kind` 联合加 `'ppt_layout'`（readTargetState/isTargetStateConsistent 走 default 安全侧，不加 case）。
- 测试：ppt-layouts dogfood（6 版式 0 overlap/0 oob + KPI 弹性 + 配色 + image_slots + 无调色板）+ apply_slide_layout 工具测 + **operationLog.integration.test 硬 gate（apply_slide_layout→delete_slide_by_index→rolled_back）** + contract.test PhaseNum 扩 +23 + CONTRACT 补行 + PPT 计数 22→23。

## Task Commits
1. **Task 1: ppt-layouts.ts（6 版式 + 固化坐标，PVQ-04）** - `c689e22` (feat)
2. **Task 2: PptAdapter.applySlideLayout（单 run 建整页，PVQ-03）** - `e2079af` (feat)
3. **Task 3: apply_slide_layout ToolDef + 注册 + ppt_layout kind** - `9e0bb31` (feat)
4. **Task 4: 测试（dogfood + 工具测 + undo 守门 + contract + 计数 22→23）** - `fc88d21` (test)

## Files Created/Modified
- `src/agent/design/ppt-layouts.ts` (new) - 6 版式库 + buildLayout 分派（纯数据/纯函数）
- `src/agent/design/ppt-layouts.test.ts` (new) - 版式 dogfood 几何守门
- `src/adapters/PptAdapter.ts` - 新增 applySlideLayout 方法（单 run 建整页）
- `src/agent/tools/write/ppt.ts` - 新增 applySlideLayoutTool + 3 import
- `src/agent/operationLog.ts` - PostStateSnapshot.kind 加 'ppt_layout'
- `src/agent/tools/index.ts` - import + PPT_TOOLS + buildToolsForHost('ppt') write 列表
- `src/agent/{operationLog.integration,contract,tools/index,tools/read/tools}.test.ts` + `tools/write/ppt.test.ts` - 守门/计数

## Decisions Made
- **架构 (B) create+fill**（Lead 接受、plan-check SOUND）：建新页填整页 → reverse 删整页；按构造绝不动既有内容、撤销原子、复用既有 deleteSlideByIndex 无新 inverse。
- **bullet_list 单框渲染**：每条要点用一个 TextBox（`• heading：text`），未拆「heading 加粗框 + 正文框」双框——overlap 安全优先 + 简洁；属 Claude's Discretion 实现细节，bold-heading 视觉细化待 v2.3 末 UAT。

## Deviations from Plan
None - plan executed as written. 计划骨架示意外的唯一额外改动：read/tools.test.ts 的 `PPT_WRITE_TOOLS` 数组（read/write 分类守门用）需补 `apply_slide_layout`，否则新 write 工具被误判为 read（这是计划「PPT 计数 22→23」隐含的同文件配套改动，非偏差）。

## Issues Encountered
- read/tools.test.ts 一处 read/write 分类守门初次失败（apply_slide_layout 未在该测试本地 `PPT_WRITE_TOOLS` 白名单 → 被当 read tool）。补入白名单后全绿。

## User Setup Required
None.

## Next Phase Readiness
- 机制就位（apply_slide_layout + image_slots + layout_check），23-02 可据此重写 PPT system prompt（删坐标脑补/宪法自查冗余规则、加判断级指引）。
- ⚠️ 真机 UAT（攒 v2.3 末，D-23-02 deferred）：slides.add 后同 run 内几何形状 + fill/font 在 Office for Web 稳定性；6 版式固化坐标/cap/字号商务密实成品观感。
- bundle main gzip 80.6KB ≤82KB（ppt-layouts/applySlideLayout/apply_slide_layout 全落懒加载 loop chunk，~0 初始增量，0 净新增依赖）。

---
*Phase: 23-apply-slide-layout-prompt-rewrite*
*Completed: 2026-06-03*
