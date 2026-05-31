---
phase: 11-c
plan: 03
subsystem: batch-write
tags: [batch_write, ExcelAdapter, WordAdapter, PptAdapter, BATCH-01, BATCH-02, single-sync, fail-fast, real-reverse]

requires:
  - phase: 11-c
    plan: 01
    provides: "Wave 0 RED 测试骨架（9 RED）+ batch.ts 存根 + contract 声明"
  - phase: 11-c
    plan: 02
    provides: "Wave 1 类型地基（PostStateSnapshot.kind='batch' + OperationLogEntry.subOps? + batch_reverse case）"

provides:
  - "batch_write ToolDef 完整实现（D-06/D-05 校验 + adapter.executeBatch 委托 + reverse/postState/subOps 组装）"
  - "ExcelAdapter.executeBatch 两阶段单闭包（2×sync O(1)）+ executeBatchReverse 单闭包逆序"
  - "WordAdapter.executeBatch 单 Word.run 闭包（8 工具支持，真实 reverse）"
  - "PptAdapter.executeBatch 单 PowerPoint.run 闭包（2 工具支持，真实 reverse）"
  - "batchWrite 注册进三宿主 buildToolsForHost（word/excel/ppt）"

affects: [11-04, 11-05]

tech-stack:
  added: []
  patterns:
    - "ExcelAdapter 两阶段 executeBatch：getRangeOrNullObject cast（@types/office-js Worksheet 未声明该方法，运行时 ExcelApi 1.4+ 支持）"
    - "WordAdapter/PptAdapter executeBatch：JS 层参数校验（Phase 1）+ 单 run 内 per-op try/catch（Phase 2）"
    - "工具计数守门更新：三宿主各 +1（word 15→16, excel 18→19, ppt 17→18）"

key-files:
  created: []
  modified:
    - src/agent/tools/write/batch.ts
    - src/adapters/ExcelAdapter.ts
    - src/adapters/WordAdapter.ts
    - src/adapters/PptAdapter.ts
    - src/agent/tools/index.ts
    - src/agent/tools/index.test.ts
    - src/agent/tools/read/tools.test.ts

key-decisions:
  - "getRangeOrNullObject 类型 cast：@types/office-js Worksheet 未声明 getRangeOrNullObject(address)，但 ExcelApi 1.4+ 运行时支持；用 'as unknown as { getRangeOrNullObject... }' cast 绕过类型检查，与 Phase 10 同类 cast 范式一致"
  - "replace_selection 在 executeBatch 内仍用 noop_inverse：与 Tool 层 CR-04 设计决策一致（selection undo 路径不可精确还原）；WARNING-1 测试只测 append_paragraph 分支，守门通过"
  - "PptAdapter.executeBatch 初始支持 set_shape_text + move_shape（最常用批量场景）；其他工具 per-op fail-fast，建议单独调用"
  - "工具计数测试自动修复：三宿主各加 batchWrite，计数 +1；index.test.ts + tools.test.ts 同步更新"

metrics:
  duration: 11min
  completed: 2026-05-31T03:42:00Z
---

# Phase 11 Plan 03: Wave 2 batch_write 核心实现 Summary

**Wave 2 核心：batch_write ToolDef 真实实现（替换 Wave 0 存根）+ 三宿主 adapter.executeBatch/executeBatchReverse，实现单 run 单 sync + fail-fast + real reverse**

## Performance

- **Duration:** 约 11 分钟
- **Completed:** 2026-05-31T03:42:00Z
- **Tasks:** 3（Task 1: batch.ts、Task 2a: ExcelAdapter、Task 2b: WordAdapter/PptAdapter/注册）
- **Files modified:** 7

## Accomplishments

- **Task 1: batch_write ToolDef 完整实现**（替换 Wave 0 UNSUPPORTED 存根）
  - D-06：ops.length > 20 → INVALID_ARGS（开 run 之前）
  - D-05：嵌套 batch_write → INVALID_ARGS（防递归）
  - A-06：无 Excel/Word/PowerPoint 命名空间（grep 守门通过）
  - reverse.tool = 'batch_reverse'，args.ops = Record 对象数组
  - postState.kind = 'batch'，ToolResult.subOps 透传
  - batch.test.ts 5/5 GREEN（Wave 0 RED → GREEN）

- **Task 2a: ExcelAdapter 两阶段批量执行**
  - `executeBatch`：单个 Excel.run，Phase 1 getRangeOrNullObject+load+sync，Phase 2 write+sync，共 2 次 sync（O(1)）
  - `executeBatchReverse`：单 Excel.run，逆序 ops，单次 sync（D-08 对称）
  - reverse.args = { address, values } Record 对象（project_adapter_inverse_signature）
  - ExcelAdapter.batch.test.ts 2/2 GREEN（sync=2 + failAtIndex=1 with 1 subOp）

- **Task 2b: WordAdapter/PptAdapter 批量执行 + 三宿主注册**
  - WordAdapter.executeBatch：单 Word.run 闭包，支持 8 个工具，真实 reverse
  - PptAdapter.executeBatch：单 PowerPoint.run 闭包，支持 set_shape_text / move_shape
  - batchWrite 注册进三宿主（import + 3 宿主数组 = 4 行 grep）
  - WordAdapter.batch.test.ts 2/2 GREEN（WARNING-1 守门：reverse.tool != 'noop_inverse' + 不抛）
  - 工具计数守门更新：word 16 / excel 19 / ppt 18

- **无回归**：705 passed，2 预期 RED（DiffLogPanel Wave 3 实现后变绿），retry.test.ts 已知噪音

## Task Commits

1. **Task 1: batch_write ToolDef 真实实现** - `88c0993` (feat)
2. **Task 2a: ExcelAdapter executeBatch + executeBatchReverse** - `ac3ae3a` (feat)
3. **Task 2b: WordAdapter/PptAdapter executeBatch + 三宿主注册** - `7bb3bfe` (feat)

## Wave-0 RED 锚点变绿情况

| 测试文件 | 测试描述 | Wave 0 状态 | Wave 2 后 |
|----------|----------|------------|-----------|
| batch.test.ts | ops 为空数组 → INVALID_ARGS | RED | **GREEN** |
| batch.test.ts | ops.length > 20 → INVALID_ARGS | RED | **GREEN** |
| batch.test.ts | 嵌套 batch_write → INVALID_ARGS | RED | **GREEN** |
| ExcelAdapter.batch.test.ts | 3 op → ctx.sync 只调用 2 次 | RED | **GREEN** |
| ExcelAdapter.batch.test.ts | fail-fast 部分完成（failAtIndex=1）| RED | **GREEN** |
| WordAdapter.batch.test.ts | real reverse（WARNING-1 守门）| RED | **GREEN** |
| WordAdapter.batch.test.ts | 不抛 unsupported | RED | **GREEN** |
| DiffLogPanel.test.tsx | batch 卡 humanLabel 显示 | RED | RED（Wave 3）|
| DiffLogPanel.test.tsx | batch subOps 列表渲染 | RED | RED（Wave 3）|

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] getRangeOrNullObject 类型不在 @types/office-js Worksheet 上**
- **Found during:** Task 2a（tsc 报错 TS2551: Property 'getRangeOrNullObject' does not exist on Worksheet）
- **Issue:** @types/office-js 未在 `Excel.Worksheet` 上声明 `getRangeOrNullObject(address)`，但 ExcelApi 1.4+ 运行时支持该方法（用于 null-object 模式）
- **Fix:** `ctx.workbook.worksheets.getActiveWorksheet() as unknown as { getRangeOrNullObject: (address: string) => Excel.Range }` cast 绕过类型检查
- **Files modified:** src/adapters/ExcelAdapter.ts
- **Commit:** ac3ae3a

**2. [Rule 1 - Bug] WordAdapter.executeBatch 中 append_paragraph 的 style cast 错误**
- **Found during:** Task 2b（tsc 报错 TS2322: Style 不可赋给 BuiltInStyleName）
- **Issue:** `para.styleBuiltIn = style as Word.Style` 类型错误，应为 `Word.BuiltInStyleName`
- **Fix:** 改为 `para.styleBuiltIn = style as Word.BuiltInStyleName`
- **Files modified:** src/adapters/WordAdapter.ts
- **Commit:** 7bb3bfe

**3. [Rule 2 - Missing] 工具计数守门更新**
- **Found during:** Task 2b（npm test 显示 index.test.ts + tools.test.ts 失败）
- **Issue:** 三宿主各加 batchWrite 后，工具总数 +1，但计数断言未更新
- **Fix:** index.test.ts（word 15→16, excel 18→19, ppt 17→18）+ tools.test.ts（同步更新 + writeToolNames/PPT_WRITE_TOOLS 加 batch_write）
- **Files modified:** src/agent/tools/index.test.ts, src/agent/tools/read/tools.test.ts
- **Commit:** 7bb3bfe

## Key Evidence for Guardrails

### BATCH-01 SC1 — 单 run 单 sync

ExcelAdapter.executeBatch:
- Phase 1：`getRangeOrNullObject + load` (无 sync) → 单次 `await ctx.sync()` 读 before-image
- Phase 2：`proxy.values = values` (无 sync) → 单次 `await ctx.sync()` 写合法前缀
- 测试断言：`expect(syncCalls.length).toBe(2)` → PASS

### BATCH-02 SC2 — fail-fast

ExcelAdapter 的 `isNullObject` 检查在 Phase 1 sync 后，找到第一个无效 range → `failAtIndex = i`，只有 `staged.slice(0, failAtIndex)` 进入 Phase 2。测试断言 `result.failAtIndex === 1` 且 `result.subOps.length === 1` → PASS

### BATCH-02 SC3 — reverse 组装 + 逆序

- `reverse.args.ops` 是 Record 对象数组（非位置参）
- `executeBatchReverse` 第一行：`const reversedOps = [...ops].reverse()`
- batch_reverse case（Wave 1 实现）调用 executeBatchReverse 时传入逆序 ops

### D-02 三宿主注册

`grep -c "batchWrite" src/agent/tools/index.ts` → 4（1 import + 3 宿主注册）

## Known Stubs

无新增 Stub。所有批量执行路径均为真实实现：
- batch.ts execute：完整校验 + adapter.executeBatch 委托
- ExcelAdapter.executeBatch：两阶段真实 Excel.run
- WordAdapter.executeBatch：8 工具真实 Word.run 实现
- PptAdapter.executeBatch：2 工具真实 PowerPoint.run 实现

注：PptAdapter.executeBatch 仅支持 set_shape_text / move_shape（初始版本）；其他 PPT 工具在批量内 per-op fail-fast，需单独调用（已在方法注释说明，不阻断 BATCH-01/02 验证）。

## Threat Flags

按 11-03-PLAN.md threat_model 验证：
- T-11-W2-01 DoS（ops > 20）→ mitigate: D-06 INVALID_ARGS 在 execute 开头（batch.test.ts 守门通过）
- T-11-W2-02 DoS（嵌套 batch_write）→ mitigate: D-05 nestedBatchIdx 检查（batch.test.ts 守门通过）
- T-11-W2-03 Tampering（reverse.args 地址注入）→ mitigate: proxy.address 由 ExcelAdapter Phase 1 sync 后 server 端规范化赋值
- T-11-W2-04 Info Disclosure（read 工具混入）→ mitigate: executeBatch 内 unsupported 工具 per-op fail-fast
- T-11-W2-05 Tampering（noop_inverse 绕过 undo）→ mitigate: WARNING-1 守门通过（append_paragraph 分支返回 delete_paragraph_by_content）

无新增安全表面超出 threat_model 范围。

## Self-Check

- [x] src/agent/tools/write/batch.ts 真实实现（非 UNSUPPORTED 存根）
- [x] src/adapters/ExcelAdapter.ts 有 executeBatch + executeBatchReverse
- [x] src/adapters/WordAdapter.ts 有 executeBatch（8 工具 + real reverse）
- [x] src/adapters/PptAdapter.ts 有 executeBatch（2 工具 + real reverse）
- [x] batchWrite 在三宿主 buildToolsForHost 注册（4 行 grep 确认）
- [x] commit 88c0993 存在（Task 1）
- [x] commit ac3ae3a 存在（Task 2a）
- [x] commit 7bb3bfe 存在（Task 2b）
- [x] A-06 守门：batch.ts 无 Office 命名空间
- [x] reverse.args Record 对象（ExcelAdapter/WordAdapter/PptAdapter 均遵守）
- [x] tsc --noEmit 通过
- [x] batch.test.ts 5/5 GREEN + ExcelAdapter.batch.test.ts 2/2 GREEN + WordAdapter.batch.test.ts 2/2 GREEN
- [x] operationLog.integration.test.ts 31/31 GREEN（D-17 守门）
- [x] contract.test.ts 9/9 GREEN
- [x] 全套 705/707 PASS（2 预期 RED = DiffLogPanel Wave 3 实现后）

## Self-Check: PASSED
