---
phase: 28
phase_name: excel-tools
status: partial
fix_scope: critical_warning
findings_in_scope: 4
fixed: 6
skipped: 2
iteration: 1
fixed_findings: [HR-01, HR-02, MR-01, MR-02, LR-03, LR-04]
backlog_findings: [LR-01, LR-02]
reviewed_at: 2026-06-06
test_baseline: 1115
test_after: 1122
tsc: PASS
build: PASS
size_gzip_kb: 82.49
size_limit_kb: 100
---

# Phase 28 代码审查修复报告 — Excel 工具补全（EXCEL-11/12/13）

> 输入：`28-REVIEW.md`（0C / 2H / 2M / 4L）
> 结论：**2 HIGH + 2 MEDIUM 全部修复并加自动守门测试；2 LOW（LR-03/LR-04）顺手修；2 LOW（LR-01/LR-02）记 backlog（附理由）。**
> `npm test` 全绿（1115→1122，+7 守门）、tsc PASS、build PASS、size 82.49 KB gzip ≤ 100 KB。
> ⚠️ HR-01 / HR-02 的真实 Office.js 语义仍需真机 UAT 收口（见末节种子）。

## 处置总表

| Finding | 严重度 | 处置 | commit | 自动守门测试 |
|---|---|---|---|---|
| HR-01 | HIGH | ✅ 已修 | `ff7f75b` | ✅ 3 条（ExcelAdapter.test.ts） |
| HR-02 | HIGH | ✅ 已修 | `e7e79da` | ✅ 1 条（ExcelAdapter.test.ts） |
| MR-01 | MEDIUM | ✅ 已修 | `b25091a` | ✅ 2 条（excel.test.ts） |
| MR-02 | MEDIUM | ✅ 已修（补守门） | `fbf9c07` | ✅ 1 条（operationLog.integration.test.ts） |
| LR-03 | LOW | ✅ 已修（stale 标题） | `fbf9c07` | n/a（测试文案） |
| LR-04 | LOW | ✅ 已修（MR-01 副产品） | `b25091a` | 覆盖于 MR-01 守门 |
| LR-01 | LOW | ⏸ backlog | — | — |
| LR-02 | LOW | ⏸ backlog | — | — |

## 修复详情

### HR-01 — `remove_duplicates` 缺省 columns 传显式全列索引（数据安全）｜`ff7f75b`
- **改动**：`src/adapters/ExcelAdapter.ts` `removeDuplicatesRange`。缺省/空数组 `columns` 不再把 `[]` 直传 Office.js `removeDuplicates`；改为在该 `Excel.run` 内 `range.load(['columnCount']) → sync`，展开为显式全列索引 `[0..n-1]` 再传。
- **理由**：「空数组 = 全列判重」官方文档从未确认，最坏会被解释为「按零列判重」→ 任意两行在「零列」上相等 → 除首行外全部行被删（大面积误删）。显式 `[0..n-1]` 与「默认全列」意图一致且可证。
- **守门（3 条）**：① 缺省 columns → 断言传给 `removeDuplicates` 的是 `[0,1,2,3]`（且 `not.toEqual([])`）；② 显式 `columns=[0,2]` 原样透传；③ 显式空数组 `columns=[]` 也被视为缺省 → 展开全列（不把 `[]` 传给 Office.js）。

### HR-02 — `create_pivot_table` sync2 失败清理孤儿透视表（文档污染+无法撤销）｜`e7e79da`
- **改动**：`src/adapters/ExcelAdapter.ts` `createPivotTable`。把字段配置 + sync2 包进内层 `try/catch`；失败时 best-effort 调 `this.deletePivotTableByName({ pivotTableName })`（独立 `Excel.run`、幂等、删除自身失败也吞掉以保留原始 `fieldErr`），再向上抛错。
- **理由**：sync1 已把空透视表提交进文档；若 sync2 因字段名大小写不匹配抛 ItemNotFound，旧逻辑留孤儿表 + 报 ok:false + 无法撤销（三重矛盾）。修后失败 = 干净回滚（文档无残留），工具层据抛错返回 ok:false。
- **守门（1 条）**：模拟 ctx.sync 第 2 次抛错 → 断言孤儿表 `delete` 被调用 1 次 + 抛 `HostApiError`（工具层据此 ok:false）。

### MR-01 — `create_pivot_table` 失败路径去 reverse/postState（无幻影撤销条目）｜`b25091a`
- **改动**：`src/agent/tools/write/excel.ts` `createPivotTableTool` catch 分支。失败只返回 `{ ok:false, data:{error} }`，去掉 `reverse:noop_inverse` 与 `postState`。
- **理由**：`loop-helpers.appendOperation` 门控是 `if (result.reverse && def)`（**不判 `result.ok`**），失败若带 reverse 会在 operationLog 留「无法自动撤销」幻影条目（实际什么都没建成）。修后与 `remove_duplicates`/`manage_worksheet` 的 ok:false 约定一致 → 失败 pivot 不进 DiffLog。
- **守门（2 条）**：① 失败 → ok:false 且 `reverse`/`postState` 均 `undefined`；② 对照：成功路径仍返回 `delete_pivot_table_by_name` reverse。
- **附带**：同步消除 **LR-04**（失败 postState 写 `content:{tooLarge:true}` 的语义错配——API 不可用 ≠ 区域过大；postState 整体已移除）。

### MR-02 — merge undo 值还原数据安全守门（补自动测试）｜`fbf9c07`
- **改动**：`src/agent/operationLog.integration.test.ts` 新增 `makeLiveMergeMock`（`range.values` setter 真回写 backing 数组，仿 Phase 27 `makeLiveTable`），新增用例。代码逻辑本身正确（REVIEW 已人工核验），本项是**补齐自动守门**。
- **守门（1 条）**：初始 `A1:C1=['标题','','']`（模拟 merge 已清空 B1/C1）→ replay `restore_merge_state`（snapshot `['标题','X','Y']`）→ 断言 `unmerge` 被调用 + B1/C1 真恢复为 `X`/`Y`（非空）。**若 `restoreMergeState` 退化成「只 unmerge 不写回」此断言立即变红**。
- **附带**：同 commit 修 **LR-03**（去掉 Phase 28 守门 describe/it 标题里 stale 的「Wave 0 桩 / Wave 0 时 skipped_error（adapter 未实现）」字样，实际断言是 rolled_back）。

## Backlog（2 LOW，附理由）

### LR-01 — merge `across=true` 逐行合并拓扑在 unmerge-undo 不还原
- **不修理由**：**无值丢失**（unmerge 不丢数据），仅合并拓扑的视觉差异（整块 vs 逐行）。要正确修复需在 unmerge 前探测原合并拓扑，而 Office.js 不便暴露该信息，改造成本与收益不匹配。属真·低风险，记 backlog。

### LR-02 — 非超限快照失败被统一误报「区域过大」
- **不修理由**：当前对任何快照失败都 `tooLarge=true`（保守、诚实降级——抓不到快照就不假装可撤），行为正确；仅错误**文案**在罕见的瞬时 sync 失败时不精确。要精确区分需让 adapter 多返回一个 reason 字段（签名改造），且与既有 `sortRange`(L1306-1313) 先例一致。低价值改造，记 backlog；若日后统一处理快照失败文案再一并改。

## 验证实测（诚实）

| 检查 | 命令 | 结果 |
|---|---|---|
| 全量测试 | `npm test`（tsc + vitest run） | ✅ **81 Test Files / 1122 Tests passed**（基线 1115 + 7 新守门） |
| 类型检查 | `tsc --noEmit`（含在 npm test） | ✅ PASS（无 `error TS`） |
| 构建 | `npm run build` | ✅ built（main chunk 248.25 KB raw / 82.60 KB gzip） |
| 包体积 | `npm run size`（先 build 后 size） | ✅ **82.49 KB gzip ≤ 100 KB limit** |

> 关于「3 errors」：来自 `src/providers/retry.test.ts` 的 NetworkError 重试用例尾部 unhandled rejection 噪音（非测试失败，Test Files 与 Tests 均全 passed）——即项目既有的「尾部 3 retry = 噪音」。

## 新增守门测试清单（关键，共 7 条）

- `src/adapters/ExcelAdapter.test.ts`：HR-01 ×3、HR-02 ×1（计 4）
- `src/agent/tools/write/excel.test.ts`：MR-01 ×2
- `src/agent/operationLog.integration.test.ts`：MR-02 ×1（+ `makeLiveMergeMock` 工厂）

## 真机 UAT 种子（mock 无法判定，需 Office for Web 真机收口）

1. **HR-01 / removeDuplicates 全列语义**：在真机对「不指定列」的删重操作，断言「仅删真正整行重复」而非「删到只剩 1 行」（验证显式全列索引在真实 Office.js 下的语义符合预期）。
2. **HR-02 / pivot 孤儿表清理**：故意传错字段名（大小写不匹配）创建透视表 → 断言工具报 ok:false **且工作表内无残留透视表**（验证 sync2 失败后孤儿表被真实删除）。
3. **MR-02 / merge 值恢复**：`A1:C1` 写 `[标题, X, Y]` → merge → undo → 断言 B1/C1 真恢复为 `X`/`Y`（验证 unmerge + 写回快照的真机时序）。

## 推荐下一步

`/gsd-verify-work 28` —— 以真机 UAT 收口上述 3 个种子后即可验收 Phase 28。
