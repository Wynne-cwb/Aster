---
phase: 11-c
verified: 2026-05-31T12:05:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "在 Excel for Web 中让 agent 执行 batch_write（含 3 个以上 set_range_values 子操作），观察 DiffLogPanel 出现「批量改动 N 处」条目并可展开查看 subOps 列表"
    expected: "卡头显示「批量改动 N 处」；展开后显示所有子操作 humanLabel（只读，无 per-subOp 撤销按钮）；一键「撤销该步」整批撤销后文档还原"
    why_human: "Office for Web 宿主行为无法在单测环境验证；需要真实 Excel.run 单闭包实际产生 O(1) sync 并与 DiffLogPanel 完整连通"
  - test: "batch_write 中第 i 个 op 的 range 地址无效时，确认 fail-fast：只有前 i-1 个 op 实际写入，DiffLogPanel 报告部分完成"
    expected: "返回 failAtIndex=i；completedSubOps.length=i；文档只有前 i-1 处被改"
    why_human: "fail-fast 行为依赖 Excel.run 的 isNullObject 真实响应，单测用 mock 替代，需真机验证"
  - test: "batch_write 执行后在 DiffLogPanel 点「撤销该步」，验证整批 undo 逆序还原（最后写的先撤）"
    expected: "三个 subOp 按 A3→A2→A1 顺序还原；SummaryModal 显示 rolledBack=N，skippedManual=0"
    why_human: "executeBatchReverse 逆序路径（单 Excel.run 闭包）需在真机上验证文档实际状态"
  - test: "手动改动 batch_write 某一 subOp 改过的单元格后，再点「撤销该步」，确认该 subOp 被 skipped_manual 而其余正常撤销"
    expected: "SummaryModal 显示 skippedManualChange=1；其余 subOp 正常 rolledBack"
    why_human: "per-subOp 手改防御（D-09）的 readExcelRange 对比逻辑需真机文档状态才能触发"
---

# Phase 11（批量操作 C）验证报告

**Phase 目标：** batch_write 单闭包单 sync + OperationLog batch 条目 + DiffLogPanel 可展开批量卡 + 一键 undo 整批
**验证时间：** 2026-05-31T12:05:00Z
**状态：** human_needed
**是否 re-verification：** 否（初始验证）

---

## 目标达成情况

### 可观测真相验证

| # | 真相 | 状态 | 证据 |
|---|------|------|------|
| 1 | `batch_write` 是 ToolDef，注册于 Excel/Word/PPT 三宿主 | ✓ VERIFIED | `src/agent/tools/index.ts` buildToolsForHost 三个 case 均含 `batchWrite`；`assertWriteToolRegisterable` 守门通过（build 成功） |
| 2 | adapter.executeBatch 使用单闭包单 sync（O(1)，非 O(N)） | ✓ VERIFIED | `ExcelAdapter.ts:1483-1565` 单个 `Excel.run` 内两阶段：Phase 1 getRangeOrNullObject + sync，Phase 2 proxy.values= + sync，总计 2 次。`ExcelAdapter.batch.test.ts` 断言 syncCalls.length===2 且全绿 |
| 3 | ops 上限 20 + 嵌套 batch_write 拒绝 + 第 i 步失败 fail-fast | ✓ VERIFIED | `batch.ts:77-112` 在 execute 开头 D-06/D-05 校验；`batch.test.ts` 5 个测试全绿（INVALID_ARGS/嵌套拒绝/属性结构） |
| 4 | OperationLog 有 kind='batch' + subOps 字段；case 'batch_reverse' 存在 | ✓ VERIFIED | `operationLog.ts:45`（`'batch'` 加入 PostStateSnapshot.kind）；`operationLog.ts:63-68`（OperationLogEntry.subOps?）；`operationLog.ts:462-524`（case 'batch_reverse' 完整实现含优先路径+降级路径） |
| 5 | per-subOp 手改防御（D-09）在优先路径和降级路径均生效；executeBatchReverse 只收 survivingOps | ✓ VERIFIED | `operationLog.ts:468-492`（循环检测 + survivingOps 过滤）；integration test `per-subOp 手改防御` 断言 spyBatchReverse 收到 length=1 且全绿 |
| 6 | DiffLogPanel 渲染 batch entry 可展开卡（entry.humanLabel）+ subOps 只读列表 + 无 per-subOp 撤销按钮 | ✓ VERIFIED | `DiffLogPanel.tsx:332-341`（entry.subOps && entry.subOps.length > 0 渲染 .batch-sub-ops ul，无 per-subOp 按钮）；`DiffLogPanel.test.tsx` 3 个 batch 渲染测试全绿（包括「批量改动 3 处」humanLabel 可见 + no per-subOp 撤销按钮） |
| 7 | batch_reverse 逆序执行守门（D-11 D-17）：integration test 断言 A3→A2→A1 顺序 + executeBatchReverse spy 调用 1 次 | ✓ VERIFIED | `operationLog.integration.test.ts:991-1055`（逆序断言 + spy 断言，真 ExcelAdapter 非 mock）；33 个 integration test 全绿 |
| 8 | contract.test.ts batch_write 行 integrationTest=true；CONTRACT[] 长度 ≥ 24 | ✓ VERIFIED | `contract.test.ts:61`（integrationTest: true）；`contract.test.ts:142`（length ≥ 24 守门）；contract.test 9 个测试全绿 |

**得分：** 8/8 真相已验证

---

### 必要制品

| 制品 | 状态 | 详情 |
|------|------|------|
| `src/agent/tools/write/batch.ts` | ✓ VERIFIED | 实体实现（221 行），包含 D-06/D-05 校验、adapter.executeBatch 调用、reverse/postState/subOps 组装 |
| `src/adapters/ExcelAdapter.ts` | ✓ VERIFIED | executeBatch（两阶段，lines 1473-1565）+ executeBatchReverse（line 1578+）已实现 |
| `src/adapters/WordAdapter.ts` | ✓ VERIFIED | executeBatch 单 Word.run 闭包（line 1200+）已实现，返回真实 reverse（delete_paragraph_by_content 等），非 noop_inverse |
| `src/adapters/PptAdapter.ts` | ✓ VERIFIED | executeBatch 单 PowerPoint.run 闭包（line 2144+）已实现，返回真实 reverse（restore_shape_text 等），非 noop_inverse |
| `src/agent/operationLog.ts` | ✓ VERIFIED | PostStateSnapshot.kind='batch'、OperationLogEntry.subOps?、DocumentAdapterForReplay.executeBatchReverse?、case 'batch_reverse' 完整实现 |
| `src/agent/tools/index.ts` | ✓ VERIFIED | ToolResult.subOps? 字段（line 62-66）+ batchWrite 注册于三宿主 |
| `src/agent/loop-helpers.ts` | ✓ VERIFIED | appendOperation 调用处透传 `subOps: result.subOps`（line 164） |
| `src/components/DiffLogPanel.tsx` | ✓ VERIFIED | batch entry 嵌套渲染分支（entry.subOps && entry.subOps.length > 0 → .batch-sub-ops ul），无 per-subOp 撤销按钮 |
| `src/styles.css` | ✓ VERIFIED | .batch-sub-ops / .batch-sub-op / .batch-sub-op__label（lines 1376-1390），只用 CSS 变量 `var(--border)` / `var(--text-2)`，无硬编码 hex |
| `src/agent/operationLog.integration.test.ts` | ✓ VERIFIED | 追加 describe「集成：replay engine × batch_reverse」（lines 943+），含逆序断言（A3→A2→A1）+ spy 断言（D-08 优先路径）+ per-subOp 手改防御断言（D-09）；33 测全绿 |
| `src/agent/contract.test.ts` | ✓ VERIFIED | UndoType 含 'batch'、batch_write 行 integrationTest=true、长度守门 ≥24；9 测全绿 |
| `.planning/phases/08-foundation-a-f/CONTRACT.md` | ✓ VERIFIED | Phase 11 章节已追加，batch_write 行存在 |

---

### 关键链路验证

| 从 | 到 | 方式 | 状态 |
|----|----|----|------|
| `batch.ts execute` | `adapter.executeBatch` | `ctx.adapter as BatchCapableAdapter` 调用 | ✓ WIRED |
| `ExcelAdapter.executeBatch` | `Excel.run` 单闭包 | 两阶段 `await ctx.sync()` 各一次 | ✓ WIRED |
| `loop-helpers.ts appendOperation` | `OperationLogEntry.subOps` | `subOps: result.subOps` 透传 | ✓ WIRED |
| `DiffLogPanel.tsx entry.subOps` | `.batch-sub-ops ul` | `entry.subOps && entry.subOps.length > 0` 分支 | ✓ WIRED |
| `operationLog.ts case 'batch_reverse'` | `adapter.executeBatchReverse` | 优先路径检测 + spy 断言已验证 | ✓ WIRED |
| `contract.test.ts batch_write integrationTest=true` | `operationLog.integration.test.ts` | D-17 四步守门（fs.readFileSync 检查 toolName 字符串出现） | ✓ WIRED |

---

### 数据流追踪（Level 4）

| 制品 | 数据变量 | 数据来源 | 产出真实数据 | 状态 |
|------|----------|----------|-------------|------|
| `DiffLogPanel.tsx` | `writeOps`（entry.subOps） | `getWriteOpsByRun(runId)` → `operationLogMap`（loop-helpers 追加） | 是（loop 真实写操作透传） | ✓ FLOWING |
| `ExcelAdapter.executeBatch` | `beforeImage`（proxy.values） | 真实 `Excel.run + ctx.sync()` 读取 | 是（单测 mock + 真机路径存在） | ✓ FLOWING（已 mock 验证，真机待 UAT） |

---

### 行为抽查（Step 7b）

| 行为 | 命令 | 结果 | 状态 |
|------|------|------|------|
| batch.test.ts 全绿（D-06/D-05 校验） | `npm test -- --run src/agent/tools/write/batch.test.ts` | 5 passed | ✓ PASS |
| ExcelAdapter.batch.test.ts 全绿（sync=2 + fail-fast） | `npm test -- --run src/adapters/ExcelAdapter.batch.test.ts` | 2 passed | ✓ PASS |
| DiffLogPanel.test.tsx 全绿（batch 卡渲染） | `npm test -- --run src/components/DiffLogPanel.test.tsx` | 3 passed | ✓ PASS |
| integration.test.ts 全绿（33 tests 含 batch_reverse 逆序守门） | `npm test -- --run src/agent/operationLog.integration.test.ts` | 33 passed | ✓ PASS |
| contract.test.ts 全绿（integrationTest=true / 长度 ≥24） | `npm test -- --run src/agent/contract.test.ts` | 9 passed | ✓ PASS |
| 生产构建成功，main bundle ≤82 KB gzip | `npm run build` | 74.70 KB gzip（≤82 KB） | ✓ PASS |

---

### 需求覆盖

| 需求 | 来源计划 | 描述 | 状态 | 证据 |
|------|----------|------|------|------|
| BATCH-01 | 11-01/03 | batch_write 单 run 闭包 + 单 sync，上限 20，fail-fast | ✓ SATISFIED | batch.ts D-06/D-05 校验；ExcelAdapter.executeBatch 两阶段 2 次 sync；Word/PPT 单 run 闭包；三宿主注册 |
| BATCH-02 | 11-01/02/04/05 | OperationLog batch 条目 + DiffLogPanel 批量卡 + 一键 undo 整批 | ✓ SATISFIED | OperationLogEntry.subOps?；case 'batch_reverse'；DiffLogPanel .batch-sub-ops 渲染；integration test 逆序守门 |

---

### 反模式扫描

扫描范围：phase 11 修改的核心文件（batch.ts、ExcelAdapter.ts/WordAdapter.ts/PptAdapter.ts 新增方法、operationLog.ts、DiffLogPanel.tsx、loop-helpers.ts）。

| 文件 | 发现 | 严重性 | 说明 |
|------|------|--------|------|
| `DiffLogPanel.tsx:332` | `{entry.subOps.length > 0 && expanded}` 依赖外层 `expanded` 状态 | 信息 | 这不是 bug：subOps 列表只在整体折叠状态展开时显示，符合设计意图（可展开卡）；DiffLogPanel 默认 expanded=true |
| `batch.ts:214` | `ok: !partialOk \|\| completedSubOps.length > 0` 的 ok 逻辑 | 信息 | 部分完成时 ok=true（设计意图：已完成的子操作有效，DiffLogPanel 正常显示），与 PLAN 描述一致 |

无 BLOCKER 反模式发现。

---

### 需要人工验证的项目

以下 4 项需在 Office for Web 真机上验证，原因是 Office.js API 行为无法在单元测试环境中完整复现：

#### 1. batch_write 正向端到端（真机 Excel for Web）

**测试步骤：** 在 Excel for Web 通过 agent 执行 batch_write（含 3 个以上 set_range_values 子操作）
**预期结果：** DiffLogPanel 出现「批量改动 N 处」的 entry；展开后显示各子操作 humanLabel（只读，无 per-subOp 撤销按钮）；网络标签页只产生 1 次 Excel.run 批量请求
**无法自动化原因：** 需要真实 Excel.run 单闭包实际执行，且 DiffLogPanel 连通需要完整 agent loop 运行

#### 2. fail-fast 部分完成（真机 Excel for Web）

**测试步骤：** batch_write 中某个 op 使用不存在的 range 地址
**预期结果：** 只有前 i-1 个 op 实际写入文档；DiffLogPanel 报告 `completed=i, total=N, failed={index:i}`
**无法自动化原因：** getRangeOrNullObject 的 isNullObject 行为需 Excel 宿主真实响应

#### 3. batch 一键 undo 逆序还原（真机 Excel for Web）

**测试步骤：** batch_write 后在 DiffLogPanel 点「撤销该步」（或「撤销本次所有操作」）
**预期结果：** 三个 subOp 按写入逆序还原（最后写的先撤）；SummaryModal 显示 rolledBack=N
**无法自动化原因：** executeBatchReverse 单 Excel.run 闭包需真机文档状态

#### 4. per-subOp 手改防御（真机 Excel for Web）

**测试步骤：** batch_write 后手动修改某个 subOp 改动的单元格，再触发 undo
**预期结果：** 被手改的 subOp 显示「未回滚 · 手改」；其余正常回滚；SummaryModal 显示 skippedManualChange=1
**无法自动化原因：** 需要用户真实手动改动文档，readExcelRange 才能检测不一致

---

## 整体结论

自动化验证全部通过（8/8 must-haves VERIFIED，所有测试绿灯，构建 74.70 KB ≤ 82 KB）。Phase 11 的核心逻辑——batch_write ToolDef、三宿主 executeBatch 单闭包、OperationLog batch 条目、case 'batch_reverse' 逆序单闭包优先路径、DiffLogPanel 可展开批量卡——均已在代码中正确实现并通过自动化守门。

状态设为 **human_needed** 是因为 Aster 是 Office.js Add-in，批量写入路径的 Excel.run 单闭包行为和 DiffLogPanel 真实显示需要在 Office for Web 真机 UAT 中最终确认，这是所有 Office.js add-in 工具的共同硬约束。

---

_验证时间：2026-05-31T12:05:00Z_
_验证人：Claude（gsd-verifier）_
