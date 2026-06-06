---
phase: 28
phase_name: excel-tools
review_depth: standard
status: issues_found
files_reviewed: 8
findings:
  critical: 0
  warning: 4   # CRITICAL(0) + HIGH(2) + MEDIUM(2) 映射到 GSD warning 层
  info: 4      # LOW(4)
  total: 8
by_severity:
  CRITICAL: 0
  HIGH: 2
  MEDIUM: 2
  LOW: 4
verified_safe: 6
reviewed_at: 2026-06-06
diff_range: 5e70565^..7791b94
validation:
  vitest_contract_integration_counts: 99/99 PASS（contract 9 + integration 54 + index 11 + read/tools 25）
  tsc_noEmit: PASS（EXIT 0）
  eslint: PASS（4 源文件 0 问题）
---

# Phase 28 代码审查报告 — Excel 工具补全（EXCEL-11/12/13）

> 深度：standard ｜ 审查范围：`5e70565^..7791b94`（含首 commit，9 个 commit，8 源文件）
> 结论：**无 CRITICAL / 无硬阻断。undo 路由 + Record 签名 + reverse 名四处对齐 + 计数测试全部正确，tsc/eslint/vitest 全绿。**
> 但有 **2 个 HIGH**：① `remove_duplicates` 默认 `columns=[]` 的「全列判重」语义未经真机验证，最坏可致误删（数据安全）；② `create_pivot_table` 字段配置 sync 时序在坏字段名下会留下孤儿透视表且无法撤销。两者修复后再 verify。

## 审查范围（8 文件）

核心（深度审查）：
- `src/adapters/ExcelAdapter.ts`（+256 行，5 新方法：mergeCells / restoreMergeState / removeDuplicatesRange / createPivotTable / deletePivotTableByName）
- `src/agent/tools/write/excel.ts`（+203 行，3 ToolDef：mergeCellsTool / removeDuplicatesTool / createPivotTableTool）
- `src/agent/operationLog.ts`（+20 行，2 kind + 2 接口方法 + 2 switch case）

接线/守门（核验一致性）：
- `src/agent/tools/index.ts`（excelWriteTools 数组 +3 工具）
- `src/agent/contract.test.ts`（+3 合约条目，PhaseNum 加 28）
- `src/agent/operationLog.integration.test.ts`（+6 守门用例 + mockExcel 扩展 merge/unmerge/removeDuplicates/pivotTables）
- `src/agent/tools/index.test.ts` / `src/agent/tools/read/tools.test.ts`（计数 20→23）

交叉核验（未改但影响正确性）：`src/agent/loop-helpers.ts`（appendOperation 门控）、`src/agent/tools/index.ts` dispatchTool 错误处理、ExcelAdapter `resolveRange` / `readRangeValuesSnapshot` / `executeBatch`。

## 发现计数

| 严重度 | 数量 |
|---|---|
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 2 |
| LOW | 4 |
| 已核验安全（INFO） | 6 |

## 验证执行结果（实跑佐证）

| 检查 | 结果 |
|---|---|
| `vitest run contract + integration + index + read/tools` | ✅ 99/99 PASS |
| `tsc --noEmit` | ✅ EXIT 0 |
| `eslint`（ExcelAdapter / excel.ts / operationLog.ts / index.ts） | ✅ 0 问题 |

---

## HIGH

### HR-01 `remove_duplicates` 默认 `columns=[]` 的「全列判重」语义未经验证，最坏可致误删（数据安全）

**位置：** `src/agent/tools/write/excel.ts:739`（`removeDuplicatesRange(address, columns, includes_header)`）+ `src/adapters/ExcelAdapter.ts:1925`（`range.removeDuplicates(columns ?? [], includesHeader ?? true)`）

**问题：** 工具参数 `columns` 缺省时，链路一路透传 `undefined` → adapter 用 `columns ?? []` 传给 Office.js。设计意图（28-RESEARCH.md D-EX12 / 工具描述「默认全列」）认为空数组 `[]` 表示「按全部列判重」。**但 RESEARCH 引用的官方文档只确认了 `Range.removeDuplicates(columns: number[], includesHeader: boolean)` 的参数形状与返回值，并未确认「空数组 = 全列」这一语义。**

风险：Office.js `removeDuplicates([])` 的真实行为存在三种可能且未经真机验证：
1. 抛 InvalidArgument（拒空数组）；
2. **按「零列」判重 → 任意两行在「零列」上都相等 → 除首行外全部行被判为重复并删除（大面积误删）**；
3. no-op（不删任何行）。

其中可能性 2 是数据安全事故：而「不指定列、直接删重复行」恰是 LLM 最常触发的调用形态。snapshot 式 undo 仅在 ≤10,000 单元格时可救回；超限走 noop_inverse → **永久丢失**。

**建议：** `columns` 缺省时不要传 `[]`，而是读区域 `columnCount` 后传显式全列索引 `[0,1,…,n-1]`（在 `readRangeValuesSnapshot` 已 load 的 range 上顺带 load `columnCount` 即可）。并补一条真机 UAT：对「不指定列」的删重断言「仅删真正整行重复」而非「删到只剩 1 行」。

---

### HR-02 `create_pivot_table` 字段配置 sync 时序：坏字段名留下孤儿透视表 + 报 ok:false + 无法撤销

**位置：** `src/adapters/ExcelAdapter.ts:1976-1998`（`createPivotTable` 两次 sync）

**问题：** 建表分两个 `ctx.sync()`：
- sync 1（L1983）：`pivotTables.add(...)` + `load(['name'])` —— **此 sync 已把空透视表提交进文档**。
- sync 2（L2001）：循环 `rowHierarchies.add(pivotTable.hierarchies.getItem(f))` 等字段配置后提交。

`hierarchies.getItem(f)` 大小写敏感（工具描述明确警告字段名必须与列头完全匹配、区分大小写——属高发错误）。字段名不匹配时，sync 2 抛 ItemNotFound → 整个 `Excel.run` 抛 → 外层 try/catch 包成 HostApiError → 工具 catch 返回 `ok:false` + `noop_inverse`。

净结果：
1. sync 1 已建的**空透视表残留在工作表里**（文档被改）；
2. 工具却报 `ok:false`（声称没建成）——前后矛盾；
3. 无法撤销：失败分支用 `noop_inverse`，且 `pivotTableName` 在抛错前从未被捕获进 reverse，DiffLog 也无 `delete_pivot_table_by_name` 可走。

**建议：** sync 1 后已拿到 `pivotTableName`；在字段配置（sync 2）失败的 catch 里做 best-effort `pivotTable.delete()` 回滚孤儿表，**或**把 `pivotTableName` 透出，使失败路径仍能返回 `reverse: delete_pivot_table_by_name`（让用户可撤）。最稳妥是二选一并补真机 UAT（故意传错字段名，断言文档无残留透视表）。

---

## MEDIUM

### MR-01 `create_pivot_table` 失败路径返回 reverse → operationLog 记录「幻影」撤销条目（与既有约定不一致）

**位置：** `src/agent/tools/write/excel.ts:822-839`（失败分支 `return { ok:false, …, reverse, postState }`）

**问题：** loop-helpers.ts:168 的 `appendOperation` 门控是 `if (result.reverse && def)`，**不**判 `result.ok`。create_pivot_table 在失败时仍返回 `reverse: noop_inverse` + `postState`，于是一次「失败、未改动文档」的调用也会被记进 operationLog，DiffLog 出现一条「此操作无法自动撤销」的写操作条目——但实际什么都没发生（除 HR-02 的孤儿场景外）。

对照同 phase 的 `remove_duplicates`：它在 ExcelApi 1.9 不支持时让 adapter 抛 `HostApiError` 向上传播，由 dispatchTool（index.ts:222-237）转 `ok:false` 且**不带 reverse** → 不进 operationLog（干净）。`manage_worksheet` 的 ok:false 分支也不返回 reverse。create_pivot_table 是唯一打破「ok:false 不带 reverse」约定的工具。

**建议：** 失败分支改为 `return { ok:false, data:{ error: message } }`（去掉 reverse/postState），或干脆移除工具内 try/catch、让 HostApiError 像 remove_duplicates 一样自然传播给 dispatchTool。两种都能保住「诚实降级、不中断 agent」且不产生幻影撤销条目。（注：本项与 HR-02 都源于 pivot 失败路径，但属不同症状——HR-02 是孤儿表，MR-01 是幻影日志条目。）

### MR-02 merge undo「还原被丢弃的非左上值」这一数据安全硬门未被自动断言覆盖

**位置：** `src/agent/operationLog.integration.test.ts:1689-1705`（merge_cells 守门用例）

**问题：** 团队重点要求验证的「merge undo 真能还原被丢弃的非左上单元格值」，在集成测试里**只断言了 `detail.status === 'rolled_back'`（即 reverse 路由成功、未抛错），并未断言快照值真的被写回**。原因是 mockExcel 的 `range.values=` 是普通对象属性赋值（no-op），mock 天然无法验证单元格值还原。

代码逻辑本身**正确**（已人工核验）：`mergeCells` 在 `merge()` 前于独立 `Excel.run` 内 `readRangeValuesSnapshot` 抓全区值 → `restoreMergeState` 走 `unmerge()` → sync → `range.values = snapshot` → sync，两次 sync 时序对（先解合并提交、再写回值）。但「硬门」当前只靠代码推理 + 待做真机 UAT 兜底，自动守门比表面看起来弱。

**建议：** 补一条真机 UAT（mock 无能为力）：A1:C1 写 `[标题,X,Y]` → merge → undo → 断言 B1/C1 恢复为 `X`/`Y`（非空）。或在守门测试中用可记录写入的 fake range（捕获 `values` setter）断言写回的二维数组等于 snapshot。

---

## LOW

### LR-01 merge `across=true` 的逐行合并拓扑在 unmerge-undo 路径不还原
**位置：** `src/adapters/ExcelAdapter.ts:1828`（restoreMergeState unmerge 分支 `range.merge(across)`，`across` 来自 reverse.args 的 `across ?? false`）
原 `unmerge` 操作不带 `across`（默认 false），其 undo 重新 `merge(false)` 按整块合并。若被取消合并的原区是逐行合并（across=true）形态，undo 会还原成整块合并而非逐行。**无值丢失**（unmerge 不丢值），仅合并拓扑的视觉差异。LOW。

### LR-02 非超限快照失败被统一误报为「区域过大」
**位置：** `src/adapters/ExcelAdapter.ts:1810-1816`（mergeCells）、`1908-1914`（removeDuplicatesRange）
snapshot 读取的 catch 对**任何**错误都 `tooLarge=true`，ToolDef 随后给出 reason「区域过大（超过 10,000 单元格）」。降级本身是诚实的（抓不到快照→不假装可撤），但当真实原因并非超限（如瞬时 sync 失败）时，错误文案会误导。与既有 `sortRange`（L1306-1313）同款先例。LOW。

### LR-03 集成测试 it() 标题与断言自相矛盾（stale Wave 0 文案）
**位置：** `src/agent/operationLog.integration.test.ts:1681`、`1722`
两条用例标题写「Wave 0 时 skipped_error（adapter 未实现）」，断言却是 `expect(detail.status).toBe('rolled_back')`（注释另说「Wave 2/3 已实现 → rolled_back」）。describe 块标题也仍称「Wave 0 桩」。测试行为正确，但命名残留误导读者。建议更新标题去掉 Wave 0 字样。LOW。

### LR-04 pivot 失败 postState 用 `tooLarge:true` 语义错配
**位置：** `src/agent/tools/write/excel.ts:831`
API 不可用/运行时失败本质不是「区域过大」，却写 `content: { tooLarge: true }`。因 `excel_pivot` kind 在 readTargetState/isTargetStateConsistent 都走 default（返回 undefined/true），content 不被消费，无功能影响。仅语义不准。LOW。

---

## 已核验安全（INFO）

1. **reverse 名四处/五处对齐** ✅ — 三工具的 reverse.tool 在 contract.test ↔ excel.ts ToolDef ↔ operationLog switch case ↔ adapter 方法名 ↔ DocumentAdapterForReplay 接口 全部一致：
   - `merge_cells → restore_merge_state`（5 处齐：contract L69 / excel.ts L694 / operationLog L576 / adapter L1843 / 接口 L183）
   - `create_pivot_table → delete_pivot_table_by_name`（contract L71 / excel.ts L841 / operationLog L580 / adapter / 接口 L185）
   - `remove_duplicates → restore_range_values_snapshot`（**正确复用** Phase 10 既有 case L441 + 既有 adapter 方法，未新建——符合「remove_duplicates 复用快照 inverse」设计）
2. **inverse Record 签名（Phase 5 翻车防御）** ✅ — `restoreMergeState(args: Record<string, unknown>)` / `deletePivotTableByName(args: Record<string, unknown>)` 均收 Record 对象并逐字段解包，非位置参；6 条 integration 守门用例全部以 `reverse.args` 对象形态传入并通过。
3. **executeBatch 按 op.tool 分派、对新工具 fail-closed** ✅ — executeBatch（index/adapter L1629 switch on `op.tool`）只支持 set_range_values/apply_formula/set_cell，对 merge/dedup/pivot 走 `default → failAtIndex`（明确失败而非静默吞），无硬编码参数形状回归（Excel adapter gotcha #2 满足）。
4. **pivot 降级双层门控诚实** ✅ — `isSetSupported('ExcelApi','1.8')`（L1964）+ 整个 Excel.run 外包 try/catch（L1962-2007）；deletePivotTableByName 用 `getItem + try/catch` 静默 ItemNotFound（幂等 undo，因 pivotTables 集合无 getItemOrNullObject 变体，处理正确）。
5. **snake_case 参数 + Chinese humanLabel + excelWriteTools 数组** ✅ — 三工具参数全 snake_case（`source_range`/`row_fields`/`includes_header` 等），humanLabel 全中文，注册进 `excelWriteTools` 数组（无 `*_TOOLS` set 反模式），计数测试 20→23 同步更新（read 4 + write 18 + selection 1）。
6. **merge 快照时序无竞态 + 超限诚实降级** ✅ — snapshot 在 `merge()` 之前于独立 Excel.run 内完成（await 后才执行合并）；snapshot 失败或超限 → `tooLarge=true` → ToolDef 走 `noop_inverse`（不假装可撤），与 sortRange/excelFindAndReplace 先例一致。

---

## 回归评估

未发现对既有 Excel 工具 / operationLog / executeBatch 的破坏：
- operationLog 仅新增 2 kind + 2 case，既有 switch 分支不变，default 仍保守抛「未知 reverse tool」。
- tools/index.ts 仅向 excelWriteTools 数组追加 3 工具，未动既有注册/dispatch。
- 99/99 既有 + 新增测试全绿；tsc/eslint 干净。

## 推荐下一步

**有 HIGH → 建议先 `/gsd-code-review-fix 28` 修 HR-01 / HR-02（+ 顺手 MR-01/MR-02），再 verify。**

- **HR-01（数据安全，最优先）**：`columns` 缺省改传显式全列索引；补真机 UAT。
- **HR-02（孤儿透视表）**：字段配置失败时 best-effort 删除孤儿表或透出 reverse；补错字段名 UAT。
- **MR-01**：pivot 失败分支去掉 reverse/postState（对齐 remove_duplicates 约定）。
- **MR-02**：补 merge undo 值还原的真机 UAT（mock 无法覆盖该硬门）。
- LOW 项可在同一轮顺带清理（尤以 LR-03 stale 测试标题最易改）。

> ⚠️ HR-01 与 HR-02 都依赖**真机 Office for Web** 才能最终判定（前者验 `removeDuplicates([])` 真实语义，后者验 sync 时序残留）。代码层修复后务必以真机 UAT 收口，勿仅凭 mock 测试判绿。
