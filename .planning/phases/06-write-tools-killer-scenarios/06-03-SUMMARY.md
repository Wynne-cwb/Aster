---
phase: "06"
plan: "03"
subsystem: adapter
tags: [ppt, write-tools, inverse, before-image, shape-api]
dependency_graph:
  requires:
    - "06-01 (Wave 0 test stubs + tool registry foundation)"
    - "Phase 5 PptAdapter (insertSlideAfter + deleteSlideByTitle 范式)"
  provides:
    - "PptAdapter.setShapeProperty (before-image + D-11 expected_state)"
    - "PptAdapter.restoreShapeProperty (Record 签名 + Pitfall 2 防御)"
    - "PptAdapter.moveShape (before-image left/top)"
    - "PptAdapter.restoreShapeGeometry (Record 签名)"
    - "PptAdapter.setShapeText (TEXT_SHAPE_TYPES fail-closed + before-image)"
    - "PptAdapter.restoreShapeText (Record 签名)"
  affects:
    - "06-05 (PPT write tool ToolDef — 消费这 6 个 adapter 方法)"
    - "06-08 (operationLog integration test — 扩展 inverse 守门)"
tech_stack:
  added: []
  patterns:
    - "PowerPoint.run 四 sync 范式 (slides→shapes→before-image→write)"
    - "Pitfall 2 NoFill 防御: shape.fill.clear() 而非写 null 颜色"
    - "Record<string,unknown> inverse 签名（防 Phase 5 UAT 地雷复发）"
    - "TEXT_SHAPE_TYPES fail-closed 类型守门（setShapeText/restoreShapeText 共用）"
    - "D-11 expected_state 并发防御（setShapeProperty 可选参数）"
key_files:
  created: []
  modified:
    - src/adapters/PptAdapter.ts
decisions:
  - "setShapeProperty 在同一个 PowerPoint.run 内完成 before-image 读取 + 新值写入（4 sync）"
  - "restoreShapeProperty Pitfall 2: fill_type==='NoFill' 分支用 shape.fill.clear()，有颜色分支用 setSolidColor"
  - "moveShape 独立方法（不合并进 setShapeProperty），保持职责单一，inverse 只还原 left/top"
  - "setShapeText 复用 TEXT_SHAPE_TYPES 白名单，非文本形状 throw HostApiError（fail-closed）"
  - "restoreShapeText 同样经类型守门，确保幂等还原安全（非文本形状 → replay engine skipped_error）"
metrics:
  duration: "~3min"
  completed_date: "2026-05-30"
  tasks: 3
  files_modified: 1
---

# Phase 06 Plan 03: PptAdapter 6 个 Shape Write/Inverse 方法 Summary

**One-liner:** PptAdapter 新增 setShapeProperty/moveShape/setShapeText + 对应 3 个 Record<string,unknown> inverse 方法，以 PowerPoint.run 四 sync 范式 + Pitfall 2 fill.clear() + TEXT_SHAPE_TYPES fail-closed 守门实现 D-01 护城河 + TOOL-03 P1 set_shape_text 能力基础。

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | setShapeProperty + restoreShapeProperty | 4284bcb | src/adapters/PptAdapter.ts |
| 2 | moveShape + restoreShapeGeometry | 4284bcb | src/adapters/PptAdapter.ts |
| 3 | setShapeText + restoreShapeText | 4284bcb | src/adapters/PptAdapter.ts |

*Tasks 1-3 同一 commit 实现（同文件顺序添加，不可分割的单元）*

## Implementation Details

### setShapeProperty (lines 636-758)
- 四 sync：slides.load → shapes.load（含几何）→ fill/lineFormat.load（before-image）→ 写入生效
- T-06-03-01: bounds check（idx < 0 || idx >= slides.items.length → HostApiError）
- T-06-03-02: shape not found → HostApiError
- T-06-03-03: D-11 expected_state → fillColor mismatch → HostApiError 并发冲突
- T-06-03-04: lineColor/lineWeight 可能 null，原样存入 beforeImage
- 返回: `{ beforeImage: { fillType, fillColor, lineColor, lineWeight, lineVisible, width, height } }`

### restoreShapeProperty (lines 763-860)
- args: Record<string, unknown> 签名（4个字段：slide_index, shape_id, fill_type, fill_color, line_color, line_weight, line_visible, width, height）
- Pitfall 2 防御：`fill_type === 'NoFill'` → `shape.fill.clear()`（而非写 null）
- line 还原：`!line_visible` → `shape.lineFormat.visible = false`；否则还原 color + weight + visible=true
- geometry 还原：shape.width = width; shape.height = height

### moveShape (lines 876-927)
- 三 sync：slides.load → shapes.load（含 left/top）→ 写入生效
- 抓 beforeLeft/beforeTop 后直接写新值，单 run 完成
- 返回: `{ beforeLeft, beforeTop }`

### restoreShapeGeometry (lines 932-984)
- args: Record<string, unknown>（slide_index, shape_id, left, top）
- 直接还原旧位置，两 sync

### setShapeText (lines 1003-1067)
- 四 sync：slides.load → shapes.load（id/type）→ textRange.load('text') → 写入
- T-06-03-05: `TEXT_SHAPE_TYPES.has(shape.type)` fail-closed 守门（GeometricShape/TextBox/Placeholder/Callout）
- 返回: `{ beforeText }` 旧文本 before-image

### restoreShapeText (lines 1072-1136)
- args: Record<string, unknown>（slide_index, shape_id, before_text）
- 同样经 TEXT_SHAPE_TYPES 守门（幂等还原安全）
- 三 sync：slides.load → shapes.load（id/type）→ 写入 before_text

## Verification Results

```
grep -c "setShapeProperty|restoreShapeProperty|moveShape|restoreShapeGeometry|setShapeText|restoreShapeText"
→ 36 matches (方法声明 + 文档注释 + 错误消息，6 个方法完整)

grep -c "fill\.clear" → 2 (Pitfall 2 防御存在)

grep "Record<string, unknown>" ... | grep "Promise" → 4 个方法（deleteSlideByTitle + 3 个新 inverse）

grep -c "TEXT_SHAPE_TYPES.has" → 9 (原有路径 + setShapeText + restoreShapeText 新增)

npm run build → ✓ built in 1.36s，无 TypeScript 错误
  PptAdapter bundle: 11.50 kB gzip: 3.24 kB
  main bundle: 245.62 kB gzip: 80.39 kB (≤82KB ✓)

npm test -- --run src/agent/tools/write/ppt.test.ts → 9 skipped (Wave 0 占位桩，符合预期)
```

## Deviations from Plan

None — 计划执行完全按照 PLAN.md 规格实现。

Tasks 1、2、3 分别对应 plan 中的三个任务，但由于都是向同一文件顺序追加方法，合并为一个 commit 提交（原子性更好）。

## Known Stubs

无。所有 6 个方法均为完整实现（非占位符），可直接被 Wave 3 PPT write tool ToolDef 消费。

Wave 0 test stubs（`ppt.test.ts` 中的 `describe.skip`）是预先存在的测试结构，将在 Wave 3 实现 PPT write tool ToolDef 后解锁（`set_shape_property`/`move_shape`/`set_shape_text` ToolDef 实现后打开 skip）。

## Threat Surface Scan

无新增安全相关表面。所有 6 个方法：
- 均在 PowerPoint.run 闭包内消费 proxy（A-06 合规）
- 参数来自 ToolDef schema 验证后的 args（由 dispatchTool 边界控制）
- bounds check 防越界（T-06-03-01）
- shape_id 查找失败 → HostApiError NOT_FOUND（T-06-03-02）
- 无新 network endpoint、无新 auth 路径、无新文件访问

## Self-Check: PASSED

- [x] `src/adapters/PptAdapter.ts` exists and modified (1139 lines)
- [x] Commit `4284bcb` exists: `git log --oneline -1 → 4284bcb feat(06-03): add 6 PPT shape write/inverse methods to PptAdapter`
- [x] Build passes: `npm run build` no errors
- [x] Tests pass: no new FAIL (9 skipped, as expected)
- [x] Bundle size: 80.39 KB ≤ 82 KB gzip limit
