---
phase: 04-read-tools-agentcontrolbar
plan: "05"
subsystem: adapters
tags: [excel, office-js, read-tools, a-24, cell-limit, tdd]

# Dependency graph
requires:
  - phase: 04-read-tools-agentcontrolbar plan 02
    provides: ReadableQuery/ReadableResult/ReadToolError types + DocumentAdapter.read() stub
  - phase: 04-read-tools-agentcontrolbar plan 01
    provides: circuit-breaker, wrapReadResult, read-result.ts

provides:
  - ExcelAdapter.read() 4 kind 完整实现（list_worksheets / get_range_values / get_used_range_summary / selection_detail）
  - A-24 读前判定防御：get_range_values 先 load cellCount，>10K cells 返 INVALID_ARGS，绝不 load values
  - ExcelAdapter.read.test.ts 19 个 mock 单测（含 A-24 spy 断言核心）

affects:
  - 04-06 以后：agent tool dispatch 对接 ExcelAdapter.read()
  - Phase 5/6：Excel write tools 可信赖 read 路径

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A-24 读前判定：load cellCount → sync1 → 若 >10K 返 INVALID_ARGS（不 load values） → sync2 才读 values"
    - "CELL_LIMIT = 10_000 常量守卫（TOOL-06）"
    - "getUsedRange(false) 空表不抛范式（WR-06，复用 insert append_end 验证过的守则）"
    - "selection_detail 复用 getSelection() 语义（跨宿主统一 kind）"

key-files:
  created:
    - src/adapters/ExcelAdapter.read.test.ts
  modified:
    - src/adapters/ExcelAdapter.ts

key-decisions:
  - "CELL_LIMIT = 10_000：与 TOOL-06 保持一致，测试边界：10000 放行，10001 拒绝"
  - "get_range_values 返 INVALID_ARGS 而非抛错：recoverable=true，引导 LLM 改用 get_used_range_summary"
  - "get_used_range_summary 只读首行（getRow(0)）做 headerSample，彻底不读全部 values"
  - "selection_detail 直接调 this.getSelection() 复用，不重写逻辑"

patterns-established:
  - "Excel A-24 读前判定范式：cellCount/rowCount/columnCount 先 load → sync1 → 大小判定 → values 条件 load → sync2"
  - "TDD mock 套路：global.Excel = { run: vi.fn(async (cb) => cb(ctx)) }；loadSpy 追踪 load 调用顺序"

requirements-completed: [TOOL-01, TOOL-02, TOOL-06]

# Metrics
duration: 20min
completed: 2026-05-29
---

# Phase 04 Plan 05: ExcelAdapter.read() Summary

**ExcelAdapter.read() 4 kind 全实现 — list_worksheets/get_range_values/get_used_range_summary/selection_detail，含 A-24 读前 cellCount 判定（>10K cells 返 INVALID_ARGS，spy 断言 values 未被 load）**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-29T~10:00Z
- **Completed:** 2026-05-29T~10:20Z
- **Tasks:** 1（TDD：RED + GREEN 两次提交）
- **Files modified:** 2

## Accomplishments

- ExcelAdapter.read() switch 4 kind 完整实现，替换原桩实现
- A-24 核心防御：get_range_values 先 load cellCount/rowCount/columnCount → sync1 → 若 >10K 立即返 INVALID_ARGS（不执行 load('values')），否则 load('values') → sync2；mock spy 断言 values 未被加载
- 19 个 mock 单测全绿，覆盖正常路径、边界（10000 放行 / 10001 拒绝）、空表不抛、UNSUPPORTED kind 防御
- 全套测试无新引入失败（已知预存 AGENT-02 soft-landing 1 条不属本计划）
- bundle 77.68 KB gzipped，仍在 ≤80KB 限制内

## Task Commits

TDD 流程两次提交：

1. **RED — 失败测试** - `9a5b0de` (test)
   - 19 个测试，全部失败（包含 A-24 spy 断言核心）
2. **GREEN — 实现** - `d43659a` (feat)
   - ExcelAdapter.read() 4 kind 实现，19 个测试全绿

**Plan 元数据：** `TBD` (docs: complete plan)

## Files Created/Modified

- `src/adapters/ExcelAdapter.read.test.ts` — 新建，19 个 mock 单测，覆盖 4 kind + A-24 + 边界 + 错误路径
- `src/adapters/ExcelAdapter.ts` — 替换 read() 桩为 4 kind 完整 switch 实现（+131 行，-12 行）

## Decisions Made

- **CELL_LIMIT = 10_000**：与 TOOL-06 规范对齐；边界语义：`> 10000` 拒绝（`=== 10000` 放行）
- **INVALID_ARGS 不抛，返 ok:false**：recoverable=true，允许 LLM 自决改用 get_used_range_summary 或缩小 address，不中断代理循环
- **get_used_range_summary 只读首行**：`used.getRow(0).load('values')` 而非 `used.load('values')`，彻底避免 OOM 风险
- **selection_detail 委托 getSelection()**：不重复实现，保持单一职责

## Deviations from Plan

无偏差 — 计划完全按规格执行。

## Issues Encountered

无异常。测试中 rtk 的 grep 对含括号字符串（`getUsedRange(false)`）匹配时有过滤干扰，实际源码人工确认包含该调用（L129、L244）。

## Threat Model Compliance

| Threat ID | Status | 
|-----------|--------|
| T-04-14 (DoS — >10K cells OOM) | 已缓解：A-24 读前判定，spy 断言 values 未被 load |
| T-04-15 (Proxy 出闭包) | 已缓解：所有 proxy 操作在 Excel.run 内完成，只返 plain values/names |
| T-04-16 (Error 带 stack) | 已缓解：catch → HostApiError，不存 hostError |
| T-04-17 (空表 ItemNotFound) | 已缓解：getUsedRange(false) 不抛（WR-06），测试验证 |

## Known Stubs

无 — 4 kind 全部实现，无占位符。

## Threat Flags

无新增网络端点或信任边界变化。

## Next Phase Readiness

- ExcelAdapter.read() 可直接被 Phase 4 Plan 06+ 的 agent tool dispatch 层对接
- 所有 3 个宿主 adapter（WordAdapter / PptAdapter / ExcelAdapter）的 read() 均已完成，Phase 4 Wave 3 可进入 read tool dispatch 层实现

---
## Self-Check: PASSED

- FOUND: src/adapters/ExcelAdapter.read.test.ts
- FOUND: src/adapters/ExcelAdapter.ts
- FOUND: .planning/phases/04-read-tools-agentcontrolbar/04-05-SUMMARY.md
- COMMIT 9a5b0de: FOUND (test: RED)
- COMMIT d43659a: FOUND (feat: GREEN)
- COMMIT 0cad57a: FOUND (docs: complete plan)

*Phase: 04-read-tools-agentcontrolbar*
*Completed: 2026-05-29*
