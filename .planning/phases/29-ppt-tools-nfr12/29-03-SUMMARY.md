---
phase: 29-ppt-tools-nfr12
plan: 03
subsystem: ppt-tools
tags: [ppt, gradient, set-shape-gradient, bundle-gate, nfr-12, tooldef, undo, degradation]

requires:
  - phase: 29-ppt-tools-nfr12
    plan: 02
    provides: "insertPptTableTool + addLineTool + PPT_TOOLS Set（insert_ppt_table/add_line）已注册；operationLog.ts ppt_shape_gradient kind union + CONTRACT 行 + integration.test 守门用例已就位（Plan 01）"

provides:
  - "setShapeGradientTool (name: 'set_shape_gradient'): PPT-11 渐变降级纯色，复用既有 setShapeProperty，0 新 adapter 方法（方案 A）"
  - "pickFirstStopColor helper：容错字符串/对象/空数组兜底 #009887"
  - "D-29-06 before-image 读不回降级：fillColor===null && fillType!=='NoFill' → noop_inverse（不拿 null 假装还原）"
  - "data.notice 量化告知：平台不支持渐变填充，已用纯色 #RRGGBB 代替（ROADMAP SC#4 诚实降级判据）"
  - "tools/index.ts PPT_TOOLS Set +1（set_shape_gradient）+ pptWriteTools +1 + import +1"
  - "NFR-12 全里程碑收口：main-Bi3ptDtV.js gzip 82.48 KB / gate 100 KB / 余量 17.52 KB（PASS）"

affects:
  - "Phase 29 里程碑收口：v2.4 全功能代码就位，NFR-12 bundle gate 已实测闭合"

tech-stack:
  added: []
  patterns:
    - "方案 A（0 新 adapter 方法）：ToolDef 直接 (ctx.adapter as PptAdapter).setShapeProperty({ fillColor: firstColor }) 复用既有路径"
    - "D-29-06 before-image 读不回降级：beforeImage.fillColor===null && fillType!=='NoFill' → noop_inverse，不拿 null 假装还原（镜像 setShapeTextAlignmentTool 范式）"
    - "pickFirstStopColor：stops[0] 容错（字符串或 { color } 对象），空数组兜底 teal 主品牌色 #009887"
    - "humanLabel + notice 纯中文模板字符串（非 Lingui 宏），避开 npm run extract 依赖"
    - "NFR-12 先 build 后 size（不依赖陈旧 dist），bundle 守门纪律落实"

key-files:
  created: []
  modified:
    - src/agent/tools/write/ppt.ts
    - src/agent/tools/index.ts

key-decisions:
  - "方案 A 零新 adapter 方法：setShapeGradientTool.execute 直接调 (ctx.adapter as PptAdapter).setShapeProperty({ fillColor: firstColor })，不写新 PptAdapter 方法；git diff 不含 PptAdapter.ts（已验证）"
  - "D-29-06 before-image 读不回走 noop_inverse：beforeImage.fillColor===null && fillType!=='NoFill' 时不拿 null fillColor 假装还原；正常路径 restore_shape_property 仍有效可撤销"
  - "notice 精确量化首色十六进制（如 #009887），不静默假成功——ROADMAP SC#4 诚实降级判据满足"
  - "NFR-12 实测 82.48 KB（三工具 PPT-09/10/11 纯 Office.js，净增量 ~0.13 KB；全里程碑 v2.4 累积值；gate 100 KB 余量充裕 17.52 KB）"

metrics:
  duration: ~3 min
  completed: 2026-06-06
  tasks: 2
  files_modified: 2
---

# Phase 29 Plan 03: setShapeGradientTool（PPT-11 渐变降级）+ NFR-12 全里程碑 bundle 收口（Wave 3）Summary

**setShapeGradientTool 复用既有 setShapeProperty（0 新 adapter 方法），降级纯色+量化告知+restore_shape_property undo；tools/index.ts 三处接线；67 测试全绿；NFR-12 收口 main-Bi3ptDtV.js gzip 82.48 KB / 100 KB gate（余量 17.52 KB，PASS）**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-06T08:27:43Z
- **Completed:** 2026-06-06T08:29:55Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

### Task 1: setShapeGradientTool ToolDef + 注册

- **pickFirstStopColor helper**（ppt.ts L951-963）：容错字符串色值或 `{ color }` 对象；空数组 → 兜底 teal 主品牌色 `#009887`
- **setShapeGradientTool**（ppt.ts L965-1022）：
  - 复用 `(ctx.adapter as PptAdapter).setShapeProperty(slide_index, shape_id, { fillColor: firstColor })`，**0 新 adapter 方法（方案 A）**
  - 主路径 reverse = `restore_shape_property`（beforeImage 完整 Record args：fill_type/fill_color/line_color/line_weight/line_visible/width/height）
  - D-29-06 降级：`beforeImage.fillColor === null && beforeImage.fillType !== 'NoFill'` → reverse = `noop_inverse`（warn 不中断，不拿 null 假装还原）
  - postState.kind = `ppt_shape_gradient`
  - data.notice = `平台不支持渐变填充，已用纯色 ${firstColor} 代替`（精确量化首色，ROADMAP SC#4 诚实降级判据）
- **tools/index.ts 三处接线**：import +1、PPT_TOOLS Set +1（`'set_shape_gradient'`）、pptWriteTools +1（`setShapeGradientTool`）
- `npx tsc --noEmit`：通过
- `PptAdapter.ts` 未改动（git diff 确认）

### Task 2: NFR-12 全里程碑 bundle 收口

先 `npm run build` 再 `npm run size`（不依赖陈旧 dist，按 memory `project_bundle_size_guard` 纪律）：

| 项目 | 数值 |
|------|------|
| 主包文件名 | `dist/assets/main-Bi3ptDtV.js` |
| gzip 大小 | **82.48 KB** |
| gate（.size-limit.json） | 100 KB |
| 余量 | **17.52 KB** |
| 结论 | **PASS** |

全里程碑 v2.4 代码（Phase 26 配置导入导出 + 27 Word + 28 Excel + 29 PPT 三工具）累积值，PPT-09/10/11 三工具纯 Office.js 调用，净增量 ~0.13 KB，远低于 17.5 KB 余量预估。

## Task Commits

1. **Task 1: setShapeGradientTool（PPT-11 渐变降级纯色）+ PPT_TOOLS 注册** - `7180a5c` (feat)
2. **Task 2: NFR-12 收口验证** — 纯验证无源码改动，结果记录于本 SUMMARY（final docs commit 覆盖）

## Files Created/Modified

- `src/agent/tools/write/ppt.ts` — pickFirstStopColor helper（L951-963）+ setShapeGradientTool ToolDef（L965-1022，+78 行）
- `src/agent/tools/index.ts` — import L14 +1（setShapeGradientTool）；PPT_TOOLS L53 +1（`'set_shape_gradient'`）；pptWriteTools L333 +1（inline）

## Key Interfaces Delivered

### setShapeGradientTool 关键路径
```typescript
// 复用既有 adapter（方案 A，0 新 adapter 方法）
const { beforeImage } = await (ctx.adapter as PptAdapter).setShapeProperty(slide_index, shape_id, { fillColor: firstColor });
// D-29-06 before-image 读不回降级
const beforeUnreadable = beforeImage.fillColor === null && beforeImage.fillType !== 'NoFill';
const reverse: ReverseDescriptor = beforeUnreadable
  ? { tool: 'noop_inverse', args: { reason: '原填充读不回（平台 fill 读取不稳），此步无法自动撤销' } }
  : { tool: 'restore_shape_property', args: { slide_index, shape_id, fill_type, fill_color, line_color, line_weight, line_visible, width, height } };
// 降级告知（量化首色，ROADMAP SC#4）
data.notice = `平台不支持渐变填充，已用纯色 ${firstColor} 代替`
```

### pickFirstStopColor 取色逻辑
- `stops[0]` 是字符串 → 直接用
- `stops[0]` 是 `{ color: string }` → 取 `.color`
- 空数组或无法解析 → `'#009887'`（teal 主品牌色）

## Decisions Made

- **方案 A（0 新 adapter 方法）**：ToolDef 直接复用 `setShapeProperty({ fillColor: firstColor })`，不写新 PptAdapter 方法；简洁且已验证（setShapeProperty 返回 beforeImage，restoreShapeProperty 还原，路径 GA）
- **D-29-06 noop_inverse 降级**：`fillColor===null && fillType!=='NoFill'` 时走 noop+gate（warn 不中断），不拿 null 假装还原。CONTRACT 行仍声明主路径 `restore_shape_property`（noop+gate 是运行时降级分支，与 contract.test 无冲突）
- **NFR-12 先 build 后 size**：按 memory `project_bundle_size_guard` 纪律，陈旧 dist 给假绿，必须真 build 确认

## Deviations from Plan

无 — 计划严格执行，零偏差。所有 acceptance criteria 满足：
- ppt.ts 含 setShapeGradientTool（pickFirstStopColor + 复用 setShapeProperty + restore_shape_property reverse + ppt_shape_gradient postState + 量化告知）
- tools/index.ts 三处接线（import/PPT_TOOLS/pptWriteTools）
- 67 tests passed（Plan 01 set_shape_gradient 守门用例仍 rolled_back，正确）
- PptAdapter.ts 未改动（方案 A）
- npm run build 成功，npm run size PASS（82.48 KB / 100 KB gate）

## Test Results

```
npm test -- --run src/agent/contract.test.ts src/agent/operationLog.integration.test.ts
✓ src/agent/contract.test.ts (9 tests)
✓ src/agent/operationLog.integration.test.ts (58 tests)
Tests: 67 passed (67)
```

set_shape_gradient 守门用例仍 `rolled_back`（正确——integration test 测的是 reverse 侧，reverse 侧 restoreShapeProperty 已在 Plan 01 前完成；正向 adapter 走模拟 mock，无需新测试）

## NFR-12 Bundle Closure (v2.4 Milestone)

```
npm run size
  Size limit:   100 kB
  Size:         82.48 kB gzipped
  Loading time: 1.7 s    on slow 3G
  Running time: 34 ms    on Snapdragon 410
  Total time:   1.7 s
✔ Running JS in headless Chrome
```

**全里程碑 v2.4 代码（Phase 26+27+28+29）累积：82.48 KB gzip，gate 100 KB，余量 17.52 KB，PASS。**

PPT 三工具（PPT-09/10/11）纯 Office.js 调用，无新外部依赖，净增量约 0.13 KB（实测 82.47→82.48），与预估（~1.5-2.5 KB）相比极小——因工具代码已在 adapter/loop 的懒加载 chunks 中，main chunk 仅新增 ToolDef 注册体积。

## v2.4 全里程碑 PPT 三工具诚实降级总结

| 工具 | 要求 | 实现路径 | 诚实降级措施 |
|------|------|----------|-------------|
| PPT-09 insert_ppt_table | 原生表格 | PowerPointApi 1.8 门控 + set-diff + 填值 | 生效回读失败 → notEffectiveResult（诚实失败，不假绿） |
| PPT-10 add_line | 线条可插 + 箭头诚实告知 | PowerPointApi 1.4 门控 + lineFormat | with_arrow=true → data.notice「不支持箭头头样式」 |
| PPT-11 set_shape_gradient | 渐变降级纯色 + 告知 | 唯一路径：取首色 + setShapeProperty | data.notice「平台不支持渐变填充，已用纯色 #RRGGBB 代替」 |

允许部分诚实降级为成功（ROADMAP SC#4 判据），不静默假成功。

## Known Stubs

无 — setShapeGradientTool 实现完整：pickFirstStopColor 取色、setShapeProperty 纯色写入、notice 量化告知、restore_shape_property/noop_inverse 两路 undo、ppt_shape_gradient postState。无 TODO/placeholder。

## Threat Flags

无新增 threat surface（setShapeGradientTool 复用既有 setShapeProperty 路径，trust boundary 未扩展；T-29-03-1 至 T-29-03-5 均已在 plan 内 mitigate）。

## Real-Machine UAT Items

- **U-3**：PPT-11 真机验证 — 网页版 Office for Web `set_shape_gradient` 调用：形状变为纯色、data.notice「已用纯色 #RRGGBB 代替」正确展示、`restore_shape_property` 撤销正常恢复原填充（或 noop_inverse warn 显示无法撤销）
- **U-4**：PPT 三工具诚实降级验证 — PPT-09 网格填值（真机 cell.text 生效）；PPT-10 线条插入（with_arrow=true 时 notice 显示）；PPT-11 渐变降级纯色（notice 文案）
- **U-5**：线上 bundle 验证（Pages deploy 后 DevTools Network 实测 main-*.js ≤100 KB gzip）

这些均需在真机 Office for Web 跑，Claude 无法代劳（memory `feedback_self_run_spikes`）。Phase 29 gate `/gsd-verify-work` 时统一跑。

---

## Self-Check

### Files exist:
- `src/agent/tools/write/ppt.ts` — FOUND (setShapeGradientTool L965-1022, pickFirstStopColor L951-963)
- `src/agent/tools/index.ts` — FOUND (import L14, PPT_TOOLS L53, pptWriteTools L333)

### Commits exist:
- `7180a5c` feat(29-03): setShapeGradientTool（PPT-11 渐变降级纯色）+ PPT_TOOLS 注册 — FOUND

## Self-Check: PASSED

---
*Phase: 29-ppt-tools-nfr12*
*Completed: 2026-06-06*
