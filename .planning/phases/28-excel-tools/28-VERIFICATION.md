---
phase: 28-excel-tools
verified: 2026-06-06T07:15:11Z
status: human_needed
score: 4/4 must-haves verified (代码层)
overrides_applied: 0
human_verification:
  - test: "HR-01 / removeDuplicates 全列真实语义（Office for Web 真机）"
    expected: "对「不指定列」的删重，断言仅删真正整行重复，而非删到只剩 1 行（验证显式全列索引 [0..n-1] 在真实 Office.js 下语义符合预期）"
    why_human: "Office.js removeDuplicates 的真实判重语义无法在 mock 验证（mock 只能断言传参 [0..n-1]≠[]，真机行为需 Office for Web 执行）"
  - test: "HR-02 / pivot 孤儿表真机清理（Office for Web 真机）"
    expected: "故意传错字段名（大小写不匹配）创建透视表 → 工具报 ok:false 且工作表内无残留透视表（验证 sync2 失败后孤儿表被真实删除）"
    why_human: "sync1/sync2 双 sync 时序 + delete 时序是 Office.js 运行时行为，mock 只能断言 deletePivotTableByName 被调用一次，真机残留需肉眼/真实文档确认"
  - test: "MR-02 / merge 值恢复真机时序（Office for Web 真机）"
    expected: "A1:C1 写 [标题,X,Y] → merge → undo → 断言 B1/C1 真恢复为 X/Y（验证 unmerge + 写回快照的真机 sync 时序）"
    why_human: "代码逻辑 + makeLiveMergeMock 已守门写回逻辑，但 unmerge→sync→values=snapshot→sync 的真机两段 sync 时序需 Office for Web 实测"
---

# Phase 28: Excel 工具补全 — 验证报告

**Phase Goal:** 用户能通过 agent 对 Excel 工作表执行三种高频数据整理操作：合并/取消合并单元格、删除重复行、创建数据透视表（不可用时诚实降级）
**Verified:** 2026-06-06T07:15:11Z
**Status:** human_needed（代码层 4/4 PASS，3 项 Office for Web 真机语义 = 里程碑收尾 UAT 种子）
**Re-verification:** No — 初始验证

---

## 总裁定

**代码层 PASS（4/4 SC + 全部子标准 VERIFIED，0 gap / 0 blocker）。** 三个 Excel write 工具（merge_cells / remove_duplicates / create_pivot_table）全链路落地：adapter 方法 + ToolDef + 注册 + operationLog 接线 + 合约守门 + 集成测试守门全部就位且全绿。REVIEW 的 2H/2M/2L（HR-01/HR-02/MR-01/MR-02/LR-03/LR-04）经源码逐行核验确认**真实闭合**（非 SUMMARY 声称），LR-01/LR-02 backlog 理由成立。自动化实测：`npm test` 1122 全绿、tsc 0 错、build 成功、size 82.48 KB gzip ≤ 100 KB。

**唯一未结：** HR-01/HR-02/MR-02 三项 **Office.js 真机语义**无法以 mock 程序化判定（团队明确将其列为里程碑收尾 UAT packet，**不在本 verify 做**）。本步已核验「代码层正确性 + 降级诚实性」，三项真机判定列入下方 UAT 种子。故状态为 `human_needed`（automated 全过，待真机确认）——**非 Phase 阻断**：按项目既有「里程碑收尾 UAT packet」惯例，Phase 28 代码层已 complete，可进 Phase 29，3 个种子随 v2.4 里程碑收尾 UAT 一并收口。

---

## Goal Achievement

### Observable Truths（ROADMAP 4 SC + goal-backward 子标准）

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | Agent 能合并/取消合并单元格区域，并可撤销（EXCEL-11） | ✓ VERIFIED | `mergeCellsTool`（excel.ts L654-703）→ `adapter.mergeCells`（ExcelAdapter L1792-1833）；undo `restore_merge_state`→`restoreMergeState`（L1843-1870）；集成守门 rolled_back（integration.test L1751） |
| SC2 | Agent 能删除区域内重复行，并可撤销（EXCEL-12） | ✓ VERIFIED | `removeDuplicatesTool`（excel.ts L706-754）→ `removeDuplicatesRange`（L1884-1953）；undo 复用 `restore_range_values_snapshot`；集成守门 rolled_back（L1820） |
| SC3 | EXCEL-13 透视表：plan 已验 Web 可用；可用→创建+可撤销；不可用→诚实降级 | ✓ VERIFIED | RESEARCH R1 VERDICT=「Web 可用」（ExcelApi 1.8 Supported）；完整实现 `createPivotTable`（L1966-2031）含字段配置；双层门控（isSetSupported L1975 + try/catch L1979）；不可用→ok:false 明确错误（excel.ts L829-833） |
| SC4 | 三工具全部过 operationLog.integration.test 守门 + bundle gate ≤100KB | ✓ VERIFIED | 6 个 Phase 28 守门用例全绿（merge rolled_back×2 + dedup rolled_back+noop + pivot rolled_back+noop）；contract.test integrationTest=true ×3 + D-17 扫描门；size 82.48 KB ≤ 100 KB |
| T-EX11a | merge undo **快照式还原被丢弃的非左上值**（MR-02 守门） | ✓ VERIFIED | `restoreMergeState` merge 路径 = unmerge→sync→`range.values=snapshot`→sync（L1852-1859）；`makeLiveMergeMock` 真回写断言 `cells[0][1]='X'`/`cells[0][2]='Y'`（integration.test L1780-1782，「只 unmerge 不写回」会立即变红） |
| T-EX11b | merge 超限 noop 诚实降级 | ✓ VERIFIED | 快照失败/超限→tooLarge=true→ToolDef 走 `noop_inverse`（excel.ts L691-692）；集成守门 skipped_error（L1799） |
| T-EX12a | dedup undo 复用快照完整还原 | ✓ VERIFIED | reverse=`restore_range_values_snapshot`（excel.ts L742）复用 Phase 10 既有 case+adapter，未新建 |
| T-EX12b | **HR-01：缺省读 columnCount 传显式全列 [0..n-1]，绝不传 []** | ✓ VERIFIED | ExcelAdapter L1927-1933：缺省/空数组→`range.load(['columnCount'])`→`Array.from({length:colCount},(_,i)=>i)`；守门 3 条断言 `[0,1,2,3]` 且 `not.toEqual([])`（ExcelAdapter.test L329-347） |
| T-EX12c | dedup rolled_back | ✓ VERIFIED | integration.test L1820 |
| T-EX13a | 完整实现 + undo 删表 | ✓ VERIFIED | `createPivotTable` 含 row/data/columnHierarchies.add（L1999-2013）；undo `delete_pivot_table_by_name`→`deletePivotTableByName`（L2036-2053，幂等 getItem+try/catch） |
| T-EX13b | 双层降级门控诚实（不假成功） | ✓ VERIFIED | isSetSupported('ExcelApi','1.8')（L1975）+ 整个 Excel.run try/catch（L1979-2030）→失败抛 HostApiError→工具 ok:false+明确错误，不静默假成功 |
| T-EX13c | **HR-02：配字段失败 catch best-effort 删孤儿表** | ✓ VERIFIED | L1996-2023：字段配置+sync2 包内层 try/catch，fieldErr 时 best-effort `deletePivotTableByName({pivotTableName})`（独立 Excel.run、幂等、删自身失败也吞保留 fieldErr）再抛；守门断言孤儿表 delete 被调 1 次 + 抛 HostApiError（ExcelAdapter.test L408-419） |
| T-EX13d | **MR-01：失败 pivot 不带 reverse、无幻影 DiffLog 条目** | ✓ VERIFIED | excel.ts L822-834：catch 仅返回 `{ok:false,data:{error}}`，无 reverse/postState；守门断言 `reverse`/`postState` 均 `toBeUndefined()`（excel.test L247/L249），对照成功路径仍返回 delete_pivot_table_by_name（L268） |

**Score:** 4/4 ROADMAP SC verified（代码层）；全部 13 条 goal-backward 子标准 VERIFIED。

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/adapters/ExcelAdapter.ts` | 5 新方法 | ✓ VERIFIED | mergeCells(L1792)/restoreMergeState(L1843)/removeDuplicatesRange(L1884)/createPivotTable(L1966)/deletePivotTableByName(L2036) 全实质实现，非桩 |
| `src/agent/tools/write/excel.ts` | 3 ToolDef | ✓ VERIFIED | mergeCellsTool(L654)/removeDuplicatesTool(L706)/createPivotTableTool(L757)，snake_case 参数 + 中文 humanLabel |
| `src/agent/operationLog.ts` | 2 kind + 2 接口 + 2 case | ✓ VERIFIED | excel_merge/excel_pivot(L50-51 走保守 default)；restoreMergeState/deletePivotTableByName 接口(L183/185)；2 switch case(L576/580) |
| `src/agent/tools/index.ts` | excelWriteTools +3 | ✓ VERIFIED | import(L15)+数组(L307/309)，无 `*_TOOLS` set 反模式 |
| `src/agent/contract.test.ts` | 3 合约行 integrationTest:true | ✓ VERIFIED | L70-72，PhaseNum 含 28(L18)，reverseTool 名对齐 |
| `src/agent/operationLog.integration.test.ts` | 6 守门 + makeLiveMergeMock | ✓ VERIFIED | makeLiveMergeMock(L438)真回写 + 6 用例(L1740-1876) |
| `CONTRACT.md` Phase 28 段 | status done | ✓ VERIFIED | L92-98 三行 status=done、integrationTest=true |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| mergeCellsTool.execute | adapter.mergeCells | `ctx.adapter as ExcelAdapter` | ✓ WIRED | excel.ts L686 |
| executeReverse 'restore_merge_state' | adapter.restoreMergeState | operationLog switch | ✓ WIRED | operationLog L576-578 |
| removeDuplicatesTool.execute | adapter.removeDuplicatesRange | `ctx.adapter as ExcelAdapter` | ✓ WIRED | excel.ts L739 |
| executeReverse 'restore_range_values_snapshot' | adapter.restoreRangeValuesSnapshot | 复用既有 case | ✓ WIRED | operationLog 既有 case + adapter L1265 |
| createPivotTableTool.execute | adapter.createPivotTable | `ctx.adapter as ExcelAdapter` | ✓ WIRED | excel.ts L813 |
| executeReverse 'delete_pivot_table_by_name' | adapter.deletePivotTableByName | operationLog switch | ✓ WIRED | operationLog L580-582 |
| reverse 名四处对齐 | contract ↔ ToolDef ↔ switch ↔ adapter | 逐字匹配 | ✓ WIRED | merge_cells→restore_merge_state / create_pivot_table→delete_pivot_table_by_name / remove_duplicates→restore_range_values_snapshot 全对齐 |

### 合约 / Excel gotchas 专项核验

| 项 | Status | Evidence |
|----|--------|----------|
| inverse 收 Record 对象（Phase 5 翻车防御） | ✓ VERIFIED | restoreMergeState/deletePivotTableByName 均 `(args: Record<string, unknown>)` 逐字段解包，非位置参（ExcelAdapter L1843/L2036） |
| 2 新 kind 保守 default | ✓ VERIFIED | excel_merge/excel_pivot 在 readTargetState/isTargetStateConsistent 均无 case → default(undefined/true) 安全侧（operationLog L293/L339） |
| 中文 humanLabel | ✓ VERIFIED | excel.ts L676-679/L728-731/L798-801 全中文 |
| snake_case + excelWriteTools 数组 | ✓ VERIFIED | source_range/row_fields/includes_header 等全 snake_case；注册进数组无 `*_TOOLS` set |
| integration.test 真 ExcelAdapter 守门 | ✓ VERIFIED | `new ExcelAdapter()` 真实例经 replayUndoSingle（integration.test L1761/L1805/L1843） |
| resolveRange 路由「表名!A1」前缀 | ✓ VERIFIED | indexOf('!') 分裸址/引号表名/普通表名三路（ExcelAdapter L61-71）；5 新方法均经 resolveRange |
| executeBatch 认 op.tool（fail-closed） | ✓ VERIFIED | switch on op.tool，merge/dedup/pivot 走 default→failAtIndex（明确失败非静默吞，REVIEW INFO #3 已核） |
| count 测试 20→23 | ✓ VERIFIED | index.test L49-54：excel = 23（4 read + 18 write + selection） |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 全量测试 | `npm test`（tsc --noEmit && vitest run） | 81 Test Files / **1122 Tests passed**（尾部 3 retry errors = retry.test.ts NetworkError/RateLimit unhandled rejection 噪音） | ✓ PASS |
| 类型检查 | `npx tsc --noEmit` | error TS 计数 = **0** | ✓ PASS |
| 构建 | `npm run build` | ✓ built in 3.71s（main chunk 248.25 KB raw / 82.60 KB gzip） | ✓ PASS |
| 包体积 | `npm run size`（先 build 后 size，避免陈旧 dist 假绿） | **82.48 KB gzipped ≤ 100 KB limit** | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EXCEL-11 | 28-01/28-02 | 合并/取消合并单元格，可撤销 | ✓ SATISFIED | SC1 + T-EX11a/b VERIFIED；REQUIREMENTS L121 Complete |
| EXCEL-12 | 28-01/28-02 | 删除区域内重复行，可撤销 | ✓ SATISFIED | SC2 + T-EX12a/b/c VERIFIED；HR-01 数据安全闭合 |
| EXCEL-13 | 28-01/28-03 | 创建数据透视表，可撤销 + Web 可用性已验 | ✓ SATISFIED | SC3 + T-EX13a/b/c/d VERIFIED；RESEARCH R1 Web 可用裁定 |

### Review Findings 闭合核验（逐条源码确认，非 SUMMARY 声称）

| Finding | 严重度 | 处置 | 源码核验 | Status |
|---------|--------|------|----------|--------|
| HR-01 | HIGH | 缺省 columns 传显式 [0..n-1] | ExcelAdapter L1927-1933 + 3 守门（ExcelAdapter.test L329-347） | ✓ 闭合 |
| HR-02 | HIGH | sync2 失败 best-effort 删孤儿表 | ExcelAdapter L1996-2023 + 1 守门（ExcelAdapter.test L408-419） | ✓ 闭合 |
| MR-01 | MEDIUM | 失败 pivot 去 reverse/postState | excel.ts L822-834 + 2 守门（excel.test L247/249/268） | ✓ 闭合 |
| MR-02 | MEDIUM | merge undo 值还原守门（live mock 真回写） | makeLiveMergeMock L438 + 断言 cells[0][1/2]='X'/'Y'（L1780-1782） | ✓ 闭合 |
| LR-03 | LOW | 去 stale「Wave 0 桩」标题 | Phase 28 守门区无残留 stale 字样（L569 残留属 Phase 9-10 注释区，非 Phase 28） | ✓ 闭合 |
| LR-04 | LOW | 移除失败 postState tooLarge 语义错配 | 随 MR-01 一并移除（excel.ts L828 注释 + postState 已删） | ✓ 闭合 |
| LR-01 | LOW | across=true 拓扑 undo 不还原 | backlog——无值丢失，仅视觉拓扑差异，Office.js 不便探测原拓扑 | ✓ backlog 合理 |
| LR-02 | LOW | 非超限快照失败误报「区域过大」 | backlog——降级本身诚实（抓不到快照不假装可撤），仅文案在罕见瞬时失败时不精确 | ✓ backlog 合理 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | 无 | — | 失败路径 `return {ok:false,...}` 是诚实降级约定（非 stub）；快照初始 null 由后续写入覆盖；2 新 kind default 返回是显式安全侧设计——均非 stub |

---

## Human Verification Required（里程碑收尾 UAT 种子，3 项）

> 团队明确：HR-01/HR-02/MR-02 的**最终真机判定**属 v2.4 里程碑收尾 UAT packet，**不在本 verify 做**。代码已改为 safe-by-default，本步已核验代码层正确性 + 降级诚实性。以下 3 项需 Office for Web 真机收口，**非 Phase 28 阻断项**。

### 1. HR-01 / removeDuplicates 全列真实语义
**Test:** 在真机对「不指定列」的删重操作执行
**Expected:** 仅删真正整行重复，而非删到只剩 1 行（验证显式全列索引 [0..n-1] 在真实 Office.js 下语义符合预期）
**Why human:** Office.js removeDuplicates 真实判重语义 mock 无法验证（mock 只能断言传参 ≠[]）

### 2. HR-02 / pivot 孤儿表真机清理
**Test:** 故意传错字段名（大小写不匹配）创建透视表
**Expected:** 工具报 ok:false 且工作表内**无残留透视表**（验证 sync2 失败后孤儿表被真实删除）
**Why human:** 双 sync + delete 时序是 Office.js 运行时行为，残留需真实文档确认

### 3. MR-02 / merge 值恢复真机时序
**Test:** A1:C1 写 [标题,X,Y] → merge → undo
**Expected:** B1/C1 真恢复为 X/Y（验证 unmerge + 写回快照的真机两段 sync 时序）
**Why human:** 真机两段 sync 时序需 Office for Web 实测（mock 已守门写回逻辑，真机时序待证）

---

## Gaps Summary

**无代码层 gap。** 所有 ROADMAP SC（4/4）+ goal-backward 子标准（13/13）+ review findings 闭合（HR-01/HR-02/MR-01/MR-02/LR-03/LR-04）均经源码逐行 VERIFIED，自动化全绿。唯一未结为 3 项 Office.js 真机语义（按团队设计列入里程碑 UAT packet，非 Phase 阻断）。

**簿记提醒（team-lead 收口处理，本 agent 不动）：**
- 当前 HEAD 领先 origin/main（Phase 28 全部 commit + review-fix 未 push）——线上 sideload 尚未含本阶段。Phase 28 改动进 main bundle（ExcelAdapter/工具），收尾需 `git push origin main` 触发 Pages 部署后线上方生效。
- ROADMAP Plans 已勾 [x]×3；REQUIREMENTS EXCEL-11/12/13 已标 Complete；STATE advance / completed_phases / ROADMAP 提前 Complete 标记由 team-lead 统一对账（项目已知 phase.complete 簿记 quirk）。

---

_Verified: 2026-06-06T07:15:11Z_
_Verifier: Claude (gsd-verifier)_
