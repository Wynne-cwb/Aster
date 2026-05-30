---
phase: "06"
plan: "06"
subsystem: agent-tools-ppt
tags: [write-tools, ppt, shape-property, shape-text, d01-moat, tool-03]
dependency_graph:
  requires: ["06-03"]
  provides: ["set_shape_property", "move_shape", "set_shape_text"]
  affects: ["src/agent/tools/index.ts", "src/agent/operationLog.ts"]
tech_stack:
  added: []
  patterns:
    - "ToolDef<TArgs> 范式（execute → adapter call → before-image → reverse Record args → postState ppt_shape）"
    - "D-01 护城河（set_shape_property + move_shape）：SC4 magic moment PPT 形状差异化能力"
    - "D-11 optional expected_state 并发防御透传 adapter"
    - "fail-closed TEXT_SHAPE_TYPES 守门（setShapeText 复用 adapter 层已有守门）"
key_files:
  created: []
  modified:
    - src/agent/tools/write/ppt.ts
    - src/agent/tools/write/ppt.test.ts
    - src/agent/tools/index.ts
    - src/agent/operationLog.ts
decisions:
  - "ppt_shape 类型扩展到 operationLog.ts PostStateSnapshot.kind（Rule 2 — ToolDef 写入 postState 必须有对应 kind）"
  - "set_shape_text 为低风险文本编辑工具，不强制 expected_state（D-11 只给高风险写工具可选，与 CONTEXT.md D-11 一致）"
  - "取消 ppt.test.ts 所有 describe.skip，接入真实 ToolDef mock 测试，Wave 0 → Wave 3 GREEN"
metrics:
  duration: "210s"
  completed_date: "2026-05-30"
  tasks: 2
  files_modified: 4
---

# Phase 06 Plan 06: PPT Shape Write Tools Summary

实现三个 PPT shape write ToolDef：set_shape_property（D-01 差异化护城河）、move_shape（SC4 magic moment 移动部分）、set_shape_text（TOOL-03 P1 文本编辑）。

## What Was Built

### set_shape_property（D-01 护城河 / SC4 magic moment）

- name: `set_shape_property`, kind: `write`
- 参数：slide_index（1-based）, shape_id, fill_color?, line_color?, line_weight?, width?, height?, expected_state?
- 调用 `PptAdapter.setShapeProperty` 获取 before-image（fill/line/geometry 全快照）
- reverse: `restore_shape_property`，args 是全量 Record 对象（含 fill_type/fill_color/line_color/line_weight/line_visible/width/height）
- D-11 expected_state：可选并发防御，透传到 adapter（mismatch → adapter throw HostApiError）
- postState: `{ kind: 'ppt_shape', content: { slide_index, shape_id, ... } }`
- humanLabel：中文，拼接实际改了哪些属性（填充色/边框色/粗细），无变化则显示"尺寸调整"

### move_shape（D-01 护城河）

- name: `move_shape`, kind: `write`
- 参数：slide_index, shape_id, left, top（均 required）
- 调用 `PptAdapter.moveShape` 获取 beforeLeft/beforeTop
- reverse: `restore_shape_geometry`，args 包含 { slide_index, shape_id, left: beforeLeft, top: beforeTop }
- humanLabel：中文，显示移动目标坐标

### set_shape_text（TOOL-03 P1）

- name: `set_shape_text`, kind: `write`
- 参数：slide_index, shape_id, text（均 required）
- 调用 `PptAdapter.setShapeText` 获取 beforeText（before-image）
- reverse: `restore_shape_text`，args 包含 { slide_index, shape_id, before_text: beforeText }（Record 对象）
- postState: `{ kind: 'ppt_shape' as const, ... }`
- humanLabel：中文，截断超长文字（> 20 字符 → 末尾加 …）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Type] operationLog.ts 扩展 ppt_shape kind**
- **Found during:** Task 1（写 postState 时 TS 报错：'ppt_shape' 不在 union 中）
- **Issue:** `PostStateSnapshot.kind` union 缺少 `'ppt_shape'`，三个新 ToolDef 的 postState 无法编译
- **Fix:** 在 `src/agent/operationLog.ts` 第 35 行扩展 union：`| 'ppt_shape'`
- **Files modified:** `src/agent/operationLog.ts`
- **Commit:** dfdf614

## Test Results

| 测试文件 | 测试数 | 状态 |
|---------|--------|------|
| src/agent/tools/write/ppt.test.ts | 18 tests | GREEN |
| src/agent/tools/index.types.test.ts | 2 tests | GREEN |

- 取消 ppt.test.ts 的 3 个 `describe.skip`
- 接入真实 ToolDef 调用（mockAdapter + mockCtx 范式）
- 覆盖：ok=true、reverse.tool 命名守门、reverse.args Record 对象守门、postState.kind 守门、humanLabel 截断

## Build

```
dist/assets/main-ow8ErDAV.js  249.51 kB │ gzip: 81.54 kB
```

81.54 KB ≤ 82 KB size limit 通过。

## Verification

- `grep -c "export const setShapeProperty\|export const moveShape\|export const setShapeText" ppt.ts` = 3
- `grep "restore_shape_property" ppt.ts` 存在
- `grep "expected_state" ppt.ts` 存在（D-11 可选参数）
- `grep "restore_shape_text" ppt.ts` 存在
- `grep -c "kind: 'ppt_shape'"` = 3（三工具各一个 postState）
- `npm test -- --run ppt.test.ts` GREEN（18 tests）
- `npm run build` 通过，81.54 KB ≤ 82 KB

## Known Stubs

无。三个工具均已完整实现（execute → adapter → before-image → reverse → postState），未留 TODO/FIXME。

## Threat Flags

无新增安全表面。所有新增工具均经 adapter 层 bounds check（T-06-06-01/02）和 fail-closed 守门（T-06-06-04），与 PLAN.md threat model 一致。

## Self-Check: PASSED

- `src/agent/tools/write/ppt.ts` — 存在（含 3 个新 ToolDef 导出）
- `src/agent/tools/index.ts` — setShapeProperty/moveShape/setShapeText 已注册 ppt write tools
- `src/agent/operationLog.ts` — ppt_shape 已加入 kind union
- Task 1 commit dfdf614 — 存在
- Task 2 commit d183e0c — 存在
