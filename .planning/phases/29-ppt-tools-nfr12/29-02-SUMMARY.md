---
phase: 29-ppt-tools-nfr12
plan: 02
subsystem: ppt-adapter
tags: [ppt, insert-table, add-line, office-js, adapter, tooldef, undo]

requires:
  - phase: 29-ppt-tools-nfr12
    plan: 01
    provides: "PostStateSnapshot.kind ppt_table/ppt_line/ppt_shape_gradient union + CONTRACT 3 行 + integration.test mockPpt 扩展 + 3 个 rolled_back 守门用例"

provides:
  - "PptAdapter.insertTable: PowerPointApi 1.8 门控 + set-diff 定位 + 逐 cell.text 填值 + count+1 写后回读"
  - "PptAdapter.addLine: PowerPointApi 1.4 门控 + set-diff 定位 + 可选 lineFormat.color/weight/dashStyle"
  - "insertPptTableTool (name: 'insert_ppt_table'): delete_shape_by_id reverse + ppt_table postState + notEffectiveResult 诚实失败"
  - "addLineTool (name: 'add_line'): delete_shape_by_id reverse + ppt_line postState + 箭头诚实告知"
  - "tools/index.ts PPT_TOOLS Set +2 + pptWriteTools +2 + import +2"

affects:
  - "29-03-PLAN（Wave 3 可直接实现 set_shape_gradient；本 plan 不触 operationLog.ts/contract.test.ts/integration.test.ts）"

tech-stack:
  added: []
  patterns:
    - "PptAdapter 新写方法：isSetSupported 门控 + set-diff 裸建→reload→填值 + count+1 写后回读（镜像 addShape/setSlideBackground）"
    - "addLine options 语义：left/top = 起点，width/height = 终点相对偏移（RESEARCH verdict）"
    - "箭头无 API 诚实告知：with_arrow=true 时 data.notice 量化文案，不静默假成功"
    - "humanLabel 纯中文模板字符串（非 Lingui 宏），避开 npm run extract 依赖"

key-files:
  created: []
  modified:
    - src/adapters/PptAdapter.ts
    - src/agent/tools/write/ppt.ts
    - src/agent/tools/index.ts

key-decisions:
  - "insertTable 门控版本 1.8，addLine 门控版本 1.4（逗号后有空格 'PowerPointApi', '1.8'，镜像 setSlideBackground L2592 精确格式）"
  - "同一 PowerPoint.run 内完成建表+填值（无拆独立 run，因表格是 shape proxy 稳定后再 getTable()，无 #5022 同 run 崩）"
  - "addLineTool 的 with_arrow 参数只用于侦测用户意图并诚实告知，不实际控制 API（API 根本不存在）"
  - "timeoutMs: 45_000 设于 insertPptTableTool（镜像 applySlideLayoutTool L735，防建表+填值超 15s 默认超时）"
  - "PPT_TOOLS Set 加两工具名保证 normalizeToSnakeCase 归一化，防 camelCase 参数静默丢参 no-op"

metrics:
  duration: ~5 min
  completed: 2026-06-06
  tasks: 2
  files_modified: 3
---

# Phase 29 Plan 02: insertTable + addLine 正向实现（Wave 2）Summary

**PptAdapter 新增 insertTable/addLine 两写方法（PowerPointApi 1.8/1.4 门控 + set-diff 定位 + 写后回读），insertPptTableTool/addLineTool 两 ToolDef 注册入 PPT_TOOLS Set + pptWriteTools；箭头诚实告知；67 测试全绿**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-06T08:18:18Z
- **Completed:** 2026-06-06T08:23:24Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- PptAdapter.insertTable（L1709）: PowerPointApi 1.8 门控（逗号后有空格格式）→ 裸建 → reload set-diff → 逐 cell.text 填值（缺格 ""）→ count+1 写后回读；外层 catch 字面量 'PPT insertTable 失败'（T-29-02-2）
- PptAdapter.addLine（L1824）: PowerPointApi 1.4 门控 → 裸建（options.left/top=起点，width/height=终点偏移）→ reload set-diff → 可选 lineFormat.color/weight/dashStyle；外层 catch 字面量 'PPT addLine 失败'
- insertPptTableTool（name: 'insert_ppt_table'）: 不撞 Word insert_table、timeoutMs:45000、notEffectiveResult 诚实失败、delete_shape_by_id reverse、ppt_table postState
- addLineTool（name: 'add_line'）: description 明示「不支持箭头头样式」、with_arrow=true 时 data.notice='平台支持线条但不支持箭头头样式，已插入无箭头线条'、delete_shape_by_id reverse、ppt_line postState
- tools/index.ts 三处接线：import +2、PPT_TOOLS Set +2（insert_ppt_table/add_line）、pptWriteTools +2（applySlideLayoutTool 后）

## Task Commits

1. **Task 1: PptAdapter.insertTable + addLine（set-diff + isSetSupported 门控）** - `8f3aa7c` (feat)
2. **Task 2: insertPptTableTool + addLineTool ToolDef + PPT_TOOLS 注册 + 守门变绿** - `789c83d` (feat)

## Files Created/Modified

- `src/adapters/PptAdapter.ts` — insertTable（L1709-1806，+98 行）+ addLine（L1824-1923，+100 行），两方法分别放在 addShape 和 addImageShape 之间
- `src/agent/tools/write/ppt.ts` — insertPptTableTool（L799-851）+ addLineTool（L853-951），追加在 applySlideLayoutTool 之后
- `src/agent/tools/index.ts` — import L14 +2、PPT_TOOLS L51-52 +2、pptWriteTools L332 +2

## Key Interfaces Delivered

### PptAdapter.insertTable 签名
```typescript
async insertTable(
  slideIndex: number,
  rows: number,
  cols: number,
  data?: string[][],
): Promise<{ newShapeId: string; effective: boolean }>
```
- 门控：`isSetSupported('PowerPointApi', '1.8')`（effective:false 时 newShapeId=''）
- 填值：`table.getCellOrNullObject(r, c).text = data?.[r]?.[c] ?? ''`（缺格 ""）
- 写后回读：`afterShapes.length < beforeCount + 1` → HostApiError

### PptAdapter.addLine 签名
```typescript
async addLine(
  slideIndex: number,
  connectorType: string,
  start: { left: number; top: number },
  end: { left: number; top: number },
  lineProps?: { color?: string; weight?: number; dashStyle?: string },
): Promise<{ newShapeId: string; effective: boolean }>
```
- 门控：`isSetSupported('PowerPointApi', '1.4')`
- options 语义：`{ left: start.left, top: start.top, width: end.left - start.left, height: end.top - start.top }`

## Decisions Made

- 门控格式精确 `'PowerPointApi', '1.8'`（逗号后有空格），与 setSlideBackground L2592 一致，避免 codebase 格式不一
- 建表+填值在同一 PowerPoint.run 内完成（未拆独立 run）：getTable() 在 reload 后的稳定 proxy 上调用，无 #5022 问题
- addLineTool 的 `with_arrow` 参数纯侦测用途，不传给 adapter（adapter 无 API 可用），只用于触发诚实告知文案
- `timeoutMs: 45_000` 给 insertPptTableTool（建表+填值可能超 15s 默认超时），addLineTool 不需要（线条无填值）

## Deviations from Plan

无 — 计划严格执行，零偏差。所有 acceptance criteria 全部满足。

## Test Results

```
npm test -- --run src/agent/contract.test.ts src/agent/operationLog.integration.test.ts
✓ src/agent/contract.test.ts (9 tests)
✓ src/agent/operationLog.integration.test.ts (58 tests)
Tests: 67 passed (67)
```

- Plan 01 的 insert_ppt_table / add_line 守门用例：仍 rolled_back（正确，因为 Plan 02 不新增 forward adapter —— integration test 测的是 reverse 侧，reverse 侧 deleteShapeById 已在 Plan 01 前完成）
- assertWriteToolRegisterable：不抛（两 ToolDef 正确注册）
- `npx tsc --noEmit`：编译通过

## Arrow Disclosure Wording

- description 字段：`不支持箭头头样式（平台限制：PowerPoint Office.js 命名空间无 arrowhead API）`
- execute 中 with_arrow=true 时的 data.notice：`平台支持线条但不支持箭头头样式，已插入无箭头线条`

## Known Stubs

无 — 两工具正向实现完整，无 TODO/placeholder。

表格网格模拟 fallback（D-29-01）本 plan 未实现（RESEARCH Open Question 3 结论：原生 addTable web 可用文档级 HIGH，真机 UAT 才是最终判据；门控/回读失败先走 notEffectiveResult 诚实失败，不预造复合 undo 代码）。此为已知已记录的设计决策，非 stub。

## Real-Machine UAT Items

- **A1 / U-1**：PPT-09 真机验证 — 网页版 Office for Web `addTable` 真正生效（非仅 isSetSupported 返 true），表格可见、cell.text 填值到位、delete_shape_by_id 撤销生效
- **A2 / U-2**：PPT-10 真机验证 — 网页版 `addLine` 真正插入线条，connectorType=Straight/Elbow/Curve 各形态正确，lineFormat.color/weight 生效，delete_shape_by_id 撤销生效；with_arrow=true 时 data.notice 正确显示
- **A3**：PPT-09 填值 — 真机 `getCellOrNullObject(r,c).text = v` 写入生效（若不生效 → 退「建空表+告知请手动填」或考虑网格模拟 follow-up）

这些均需在真机 Office for Web 跑，Claude 无法代劳（memory `feedback_self_run_spikes`）。Phase gate `/gsd-verify-work` 时统一跑 U-1/U-2。

---
*Phase: 29-ppt-tools-nfr12*
*Completed: 2026-06-06*
