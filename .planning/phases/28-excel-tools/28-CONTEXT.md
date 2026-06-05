# Phase 28: Excel 工具补全 - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning
**Mode:** user-led discuss（团队模式：team-lead 代为协调；本步只做灰区二分 + 上下文固化，不规划/不实现）

---

## 人类决策结论：**NONE（无需用户拍板）**

> 经灰区二分，Phase 28 **不存在需人类拍板的产品/UX 取向决策**。理由见 §灰区二分。
> 本 phase = 三个高价值 Excel write 工具的合约补全 + undo 接线，**全部落在既有 v2.1 Phase 10 已建立并已在 codebase 落地的范式之内**；唯一的不确定性（EXCEL-13 透视表 API 在 Office for Web 可用性）已被 REQUIREMENTS 明确为 **plan-phase 必验的技术事实**，且降级行为（不可用→诚实 noop+gate）**已由用户预先拍板**，不再作为灰区重问。

---

<domain>
## Phase Boundary

Phase 28 给 **Excel 宿主新增 3 个 write 工具**，承接 v2.1 Phase 10 已交付的 EXCEL-01~10（10 个 Excel write 工具）+ Phase 11 batch：

| REQ | 能力 | Office.js API | API 要求集 | 平台风险 |
|-----|------|---------------|-----------|----------|
| **EXCEL-11** | 合并 / 取消合并单元格 | `Range.merge(across?)` / `Range.unmerge()` | **ExcelApi 1.2**（GA，Web 稳） | 低 |
| **EXCEL-12** | 删除区域内重复行 | `Range.removeDuplicates(columns, includesHeader)` | **ExcelApi 1.9** | 中（1.9 较新，需 isSetSupported 门控 + Web 实测） |
| **EXCEL-13** | 创建数据透视表 | `Worksheet.pivotTables.add(name, source, destination)` | **ExcelApi 1.8** | **高 ⚠️**（API 复杂，Office for Web 可用性 **plan-phase 必验**；不可用→诚实 noop+gate，已拍板） |

**所有破坏性操作的 undo 三分类**沿用 Phase 10 锁定的合约范式：要么简单逆向、要么快照式（带 `SNAPSHOT_LIMIT` 上限 + 超限 noop+gate 降级）、要么直接 noop+gate（执行但 warn「不可自动撤销」，**绝不中断 agent**）。

**不在本阶段**：
- Word / PPT 工具（Phase 27 / 29 各自负责）。
- batch_write（Phase 11 已交付）、UI 打磨。
- Excel 其余 deferred 候选（数据验证下拉 / 分类汇总 / 迷你图 / 命名区域 / 保护工作表 / 超链接 / 批注 等 → 后续里程碑 triage，见 REQUIREMENTS §Deferred）。
- NFR-12 全里程碑 bundle 收口（**收口动作在 Phase 29 末位**；但本 phase 新增代码仍受 ≤82KB gzip 硬约束，见 §HARD CONSTRAINTS）。

**Requirements covered (3):** EXCEL-11, EXCEL-12, EXCEL-13

> **历史脉络**：这三个工具 = v2.1 Phase 10 的 deferred 项 **EXCEL-D1 / D2 / D3**（`merge_cells` / `remove_duplicates` / `create_pivot_table`），当时因「快照式 undo 代价大 / H 复杂度 / pivot 样式无 undo（PITFALLS E6）」推迟。v2.4 用户已决定纳入。三者**尚未进 `CONTRACT.md`**（现有合约只含 Phase 10 的 10 行 + Phase 11 batch 行），plan-phase 需新增 CONTRACT 行 + `contract.test.ts` 行。
</domain>

---

<gray_area_triage>
## 灰区二分（需人类拍板 vs 可研究/可自决）

### A. 需人类拍板 —— **NONE**

逐项审视所有候选灰区，全部归入「可自决」或「可研究」，无一真正需要用户产品/UX 取向输入：

| 候选「灰区」 | 表面像决策？ | 实际归类 | 为何不问用户 |
|---|---|---|---|
| EXCEL-13 透视表 API 在 Web 是否可用 | 像 go/no-go | **可研究（plan-phase 必验）** | REQUIREMENTS 已明确标为 plan-phase 验证项；用户无法替 API 可用性「拍板」，这是客观技术事实 |
| 透视表不可用时怎么办 | 像产品取向 | **已拍板（不是灰区）** | 用户在 REQUIREMENTS / ROADMAP SC#3 已定「不可用→诚实降级 noop+gate，不假装能做」 |
| merge_cells 是否快照恢复被丢弃的非左上单元格值 | 像 UX 权衡 | **可自决（数据安全硬门）** | undo 必须忠实还原是既定硬门（非用户偏好）；正确做法 = 快照式还原，planner 按范式落地 |
| 三工具命名 / 是否合并成 operation 枚举工具 | 像设计选择 | **可自决** | 沿用 Phase 10 命名真相源范式（snake_case + casing 归一化）；planner/researcher 定 |
| removeDuplicates 快照上限数字 | 像参数选择 | **可自决** | 复用既有 `SNAPSHOT_LIMIT = 10_000`，超限走 noop+gate（已落地范式） |
| 透视表字段配置深度（行/列/值/筛选） | **最接近产品取向** | **可自决（planner discretion）** | 见下方说明——受 API 可用性边界约束，不构成需用户拍板的独立取向 |

**关于「透视表字段配置深度」为何不升级为用户问题**（唯一较接近产品取向的候选）：
- 「创建数据透视表」的丰富度（仅建空透视框 vs 同时配置 行/列/值/筛选 字段）确实影响 agent 实用性，但：
  1. 它被 **API 可用性边界**先行约束——若 `pivotTables.add` 在 Web 根本不可用，整工具 noop+gate，字段深度无意义；plan-phase 验证结果会直接收窄这个空间。
  2. 它无明显「用户口味」分叉——更丰富永远更好，只受 API 能力 + bundle 预算约束；这是「能做多少」的工程判断，非「想要哪种」的产品判断。
  3. 沿用 Aster 既有 agent-tool 模型（工具暴露参数、AI loop 内自主调用、无确认卡 UX——见 memory `image_insert_autonomous`），无新 UI 表面需要用户定。
- **结论**：作为 Claude/planner discretion 记录推荐默认（见 §可自决记录 D-13c），不问用户。若 plan-phase 验出 API 可用且 researcher 发现字段配置 API 有重大取舍分叉，再由 planner 视情况 flag——但当前证据不支持预先打断用户。

### B. 可自决（technical defaults，已按既有范式定）—— 见 §可自决记录

### C. 可研究/必验（留给 research/plan，不问用户）—— 见 §可研究事实清单
</gray_area_triage>

---

<decisions>
## 可自决记录（Implementation Decisions — technical defaults）

> 全部沿用 Phase 10（`10-CONTEXT.md`）已锁定并已在 codebase 落地的范式。planner 可微调具体字段/数字，但**合约硬约束不可破**（见 §HARD CONSTRAINTS）。

### D-EX11 merge_cells（EXCEL-11）
- **D-11a 单工具 + operation 枚举**：推荐 `merge_cells` 单工具，参数 `{ address, operation: 'merge' | 'unmerge', across?: boolean }`（across 控制 `Range.merge(across)` 是整块合一还是逐行横向合并）。范式同 `manage_worksheet`（operation 枚举 + 单一 undoType）。
- **D-11b undo = 快照式**（数据安全硬门）：
  - **merge 会丢弃非左上单元格的值**（Office.js 语义：合并后仅保留左上值，其余清空）。忠实 undo 必须先快照合并区 2D values（+ 记录区域地址），inverse = `unmerge` 该区 → 再用 `range.values = snapshot` 覆写还原被丢弃的值。
  - **unmerge 无值丢失**，但 undo 需重新合并：inverse = 对原区域 `merge`。
  - 两路统一走快照式：reverse 记录足以重建前态的信息（合并布局 + values）。**reverse 工具名 / undoType / kind 由 planner 定**（可新建如 `restore_merge_state` + 新 `PostStateSnapshot.kind`，或评估能否复用 `restore_range_values_snapshot` + 额外 merge 标志——researcher 验 `Range.merge`/`unmerge` 与 values 覆写的交互后定）。
  - **已知限制写进 description**：合并区已含合并单元格时再排序会抛 GeneralException（PITFALLS E5，已知 Excel 坑），merge 丢值在 description 注明。
- **D-11c 复用 `resolveRange` helper**：worksheet 级 getRange 拒收「表名!A1」前缀（memory `project_excel_adapter_gotchas`），merge/unmerge 的 address 必须经 `resolveRange` 路由 getItem。

### D-EX12 remove_duplicates（EXCEL-12）
- **D-12a undo = 快照式（复用既有基建）**：`Range.removeDuplicates` 物理删除重复行、区域缩小，不可原生撤销。写前用既有 `readRangeValuesSnapshot(address)` 快照整块 2D values → inverse `restore_range_values_snapshot`（**已存在的 case + adapter 方法 + 接口声明**，operationLog.ts:142/422）覆写还原全部原始行（含被删的重复行）。这是 sort_range / excel_find_and_replace 同构范式（D-20 共享 reverse 名）。
- **D-12b 超限 → noop+gate**：复用既有 `SNAPSHOT_LIMIT = 10_000` 单元格上限（ExcelAdapter.ts:1223）。超限 → 仍执行删重，但 `reverse = { tool: 'noop_inverse', args: { reason: '区域过大，无法自动撤销' } }` → executeReverse throw → `skipped_error` → DiffLog「此步无法自动撤销」warn 不中断。
- **D-12c 参数**：推荐 `{ address, columns?: number[], includesHeader?: boolean }`（columns = 判重列索引，默认全列；includesHeader 默认 true）。`removeDuplicates` 返回 `RemoveDuplicatesResult { removed, uniqueRemaining }` → humanLabel/ToolResult 回显「删除 N 行重复」。
- **D-12d ExcelApi 1.9 运行时门控**：`isSetSupported('ExcelApi', '1.9')` 已有先例（ExcelAdapter.ts:1336 replaceAll）；不支持 → 诚实拒绝（明确错误，不静默假成功）。**Web 可用性 plan-phase 实测**（见 §可研究事实清单 R2）。

### D-EX13 create_pivot_table（EXCEL-13）⚠️ 降级门控
- **D-13a 双层门控**：
  1. **静态/编译层**：plan-phase 必验 `Worksheet.pivotTables.add` 在 Office for Web 是否真正可用（不止类型存在，要真机/spike 实跑——见 R1）。
  2. **运行时层**：实现内 `isSetSupported('ExcelApi', '1.8')` + try/catch 包裹 add 调用；不支持或抛错 → **当场诚实 noop+gate**（明确错误信息「当前 Office for Web 不支持创建数据透视表」，不中断 agent）。**降级路径本身即安全网，不需等 spike 通过才动工**（镜像 Phase 10 D-10/D-11 PPT spike 运行时降级范式）。
- **D-13b undo = 简单逆向**（若 API 可用）：`pivotTables.add` 返回 PivotTable；捕获其 name → inverse = `worksheet.pivotTables.getItem(name).delete()`（范式同 `create_table` 的 `delete_table_by_name`，简单逆向）。**注意 PITFALLS E6：pivot 样式/字段配置本身无 undo**——但「删除整个透视表」可逆，故工具级 undo = 删表（够用）。reverse 名由 planner 定（如 `delete_pivot_table_by_name`）。
- **D-13c 字段配置深度（planner discretion）**：推荐默认 = 支持 `{ sourceRange, destination, name?, rowFields?, columnFields?, dataFields?, filterFields? }`，行/列/值字段为可选数组，按 `pivotTable.rowHierarchies.add` / `dataHierarchies.add` API 配置。**实际能配多深取决于 R1 验证结果**——若 Web 仅支持建空透视框，则收窄到 sourceRange+destination。planner 按 researcher 的 API 调研定最稳子集。
- **D-13d 成功标准的「诚实降级」判定**（ROADMAP SC#3）：可用→建表+可删除即 PASS；不可用→工具明确拒绝/noop+gate + 清晰错误信息即 PASS（**不静默假成功、不中断 agent** 是降级是否「诚实」的判据）。

### D-GATE undo 守门 + 合约接线（贯穿 3 工具，**数据安全硬门，不软化**）

沿用 Phase 10 D-17~D-21 范式，每个新工具的 plan acceptance_criteria 必含**四步**（缺一 CI 挂）：
1. **`CONTRACT.md` 新增 3 行**（toolName / host=excel / undoType / reverseTool / phase=28 / integration_test）+ status planned→done。
2. **`src/agent/contract.test.ts` 新增 3 行**（CONTRACT 常量数组）；注意现有 `CONTRACT.length >= 24` 守门（contract.test.ts:145）——加 3 工具后长度上升，断言仍通过（≥24 是下限）。
3. **`src/agent/operationLog.ts` 扩展**：`DocumentAdapterForReplay` 接口加新 inverse 方法声明（remove_duplicates 复用既有 `restoreRangeValuesSnapshot`，**无需新增**；merge_cells / pivot 各按 D-11b/D-13b 加新方法或复用）；`executeReverse` switch 加对应 case（**case 字符串逐字 = CONTRACT reverse 名**）；按需扩 `PostStateSnapshot.kind` union（新 kind → `readTargetState` 返 `undefined` 保守一致，**不盲加比对规则**，memory `project_adapter_inverse_signature` / Phase 10 D-21）。
4. **`src/agent/operationLog.integration.test.ts` 追加守门用例**：用**真 `ExcelAdapter` 实例（非 mock）** 经 `replayUndoSingle` 断言简单逆向/快照工具 → `rolled_back` 且 adapter 收到 **Record 对象**；noop+gate 路径（remove_duplicates 超限 + pivot 不可用降级）断言 → `skipped_error`。**每个新 toolName 字符串必须出现在该文件内**（contract.test.ts:118 `fs.readFileSync` D-17 硬卡）。

- **adapter inverse/read/snapshot 签名一律 `(args: Record<string, unknown>)`**（memory `project_adapter_inverse_signature` 硬约束；Phase 5 位置签名致真机撤销全挂的翻车点）。
- **入 host 工具集 + casing 归一化**：3 工具的 ToolDef 加进 `src/agent/tools/write/excel.ts`，在 `buildToolsForHost('excel')`（tools/index.ts:294-309 `excelWriteTools` 数组）注册并过 `assertWriteToolRegisterable`；参数键用 snake_case（dispatch 不校验、camel/snake 不一致会静默失败——memory `project_ppt_officejs_gotchas`；tools/index.ts:59 有 camelCase→snake 归一化逻辑，新工具参数沿用既有约定）。
- **executeBatch 分派认 op.tool**：若三工具需进 batch，分派必须按 `op.tool` 路由、别硬编码 `set_range_values` 参数形状（memory `project_excel_adapter_gotchas` 260603-fx8 教训）。**本 phase 是否纳入 batch 由 planner 定**（非硬性需求）。

### Claude's Discretion（planner/researcher 可定）
- 三工具最终 snake_case 名 + reverse 工具名（推荐沿用 deferred 命名 `merge_cells` / `remove_duplicates` / `create_pivot_table`，但以 plan-phase 写入 CONTRACT 的为逐字真相源）。
- merge_cells 的 reverse 名 / 是否复用 `restore_range_values_snapshot` vs 新建 reverse（D-11b）。
- 新 `PostStateSnapshot.kind` 命名（如 `excel_merge` / `excel_pivot`）。
- remove_duplicates 快照上限是否沿用 10_000（推荐沿用）。
- pivot 字段配置深度的最稳 API 子集（D-13c，依赖 R1 结果）。
- 三工具 humanLabel 中文文案、参数 description 措辞（NFR-08 已从硬 gate 改软提醒——memory `project_quality_over_cost`，不设死长度但删冗余）。
- wave 切分（建议：Wave 0 合约+守门桩先红 → Wave 1 merge_cells + remove_duplicates（复用既有快照基建，低风险）→ Wave 2 create_pivot_table（高风险，含运行时降级））。

### Folded Todos
无折叠。无匹配的 active todo。
</decisions>

---

<research_facts>
## 可研究事实清单（留给 research/plan，不问用户）

> ⚠️ 标 **[CRITICAL / plan-phase 必验]** 的是 ROADMAP/REQUIREMENTS 显式要求的前验点，是 Phase 28 plan-phase 的 go/降级 分水岭。

### R1 — 【CRITICAL / plan-phase 必验】EXCEL-13 透视表 API 在 Office for Web 可用性
- **必验**：`Worksheet.pivotTables.add(name, source, destination)`（ExcelApi 1.8）在 **Office for Web**（Edge/Chrome）是否**真正可用且功能正常**——不止 `@types/office-js` 类型存在、不止 `isSetSupported('ExcelApi','1.8')` 返 true，要真机/spike 实跑一次 add + 配置字段 + delete 全链路。
- **为何 Claude 不能纯自跑**：需真机 Office for Web 环境（memory `feedback_self_run_spikes`：能自跑的别让用户跑，但真机必须的列 UAT）。可先用 `.env.local` + browser UAT（skill `office-addin-browser-uat`）由 Claude 在浏览器侧探一手；最终 verdict 由真机 UAT 给。
- **分支**：
  - 可用 → 实现完整 create_pivot_table（D-13b/c），undo = 删表。
  - 不可用 / 部分不可用（如能建框但不能配字段，或 Web 抛 NotImplemented）→ **诚实降级 noop+gate**（D-13a/d），明确错误信息，不假装。
- **已知风险点**：PITFALLS E6「pivot 样式无 undo」——透视表的字段重排/样式无法逐项撤销，但工具级「删整表」可逆（D-13b 已据此设计）。

### R2 — EXCEL-12 removeDuplicates（ExcelApi 1.9）Web 可用性
- 验 `Range.removeDuplicates(columns, includesHeader)` 在 Office for Web 可用（1.9 较新）。`isSetSupported('ExcelApi','1.9')` 已有先例（ExcelAdapter.ts:1336 replaceAll 门控），沿用即可。
- 验返回值 `RemoveDuplicatesResult { removed, uniqueRemaining }` 字段，供 humanLabel 回显。
- 风险低于 R1（1.9 比 1.8 pivot 简单），但仍需运行时门控 + 实测确认。

### R3 — EXCEL-11 merge/unmerge 语义 + undo 忠实度
- 确认 `Range.merge(across)` 的 across 行为（true=逐行横向合并 / false=整块合一）+ 合并后非左上单元格值的清空语义。
- 确认忠实 undo 所需快照范围（values 2D + 合并布局），定 reverse 实现（D-11b）：unmerge 后 `range.values = snapshot` 覆写能否完整还原（含格式？本 phase 只还原 values，格式各管各——Phase 10 D-09 范式）。
- 验合并单元格与后续 sort 的 GeneralException 交互（PITFALLS E5，写进 description 不防御性拦截）。

### R4 — bundle 影响实测（NFR-12 硬约束，余量 ~0.7KB 极紧）
- 三工具新增代码（adapter 写方法 + inverse + ToolDef + executeReverse case）对 initial main-*.js gzip 的增量：**动 bundle 前先 `npm run build` 再 `npm run size`**（memory `project_bundle_size_guard`：size 测陈旧 dist 给假绿）。
- pivot 工具是三者最重；若逼近 82KB，评估是否需懒加载（Excel adapter 本就按 host 运行时加载，但 ToolDef 在主路径——researcher/planner 评估）。
- **注意**：NFR-12 全里程碑收口在 Phase 29 末位；Phase 28 只需保证本 phase 增量不破 gate（局部守）。

### R5 — CONTRACT.md / contract.test.ts 接线细节
- 现有 `CONTRACT.length >= 24` 守门（contract.test.ts:145）；现有 Phase 10 十行（41-50）+ Phase 11 batch 行（61）。新增 3 行后需确认 `contract.test.ts` 的 host 枚举校验（line 85 `validHosts`）、undoType 枚举、reverseTool 非空等断言全过。
- D-17 `fs.readFileSync` 硬卡（contract.test.ts:118）：3 个新 toolName 必须逐字出现在 `operationLog.integration.test.ts`。
</research_facts>

---

<uat_seeds>
## UAT 种子（真机验证清单 — 留给里程碑收尾 / verify-work）

> 三宿主 sideload 后在 **Office for Web Excel** 真机跑。重点验「正向生效 + undo 忠实还原 + 降级诚实」。

### EXCEL-11 合并 / 取消合并
1. **合并**：选区 A1:C1 各填值（标题、X、Y）→ 让 agent「把 A1:C1 合并成一个标题单元格」→ 合并成功、显示左上值；**undo 后** A1:C1 拆回 3 个独立单元格**且 B1/C1 原值恢复**（验快照式忠实还原被丢弃的值）。
2. **取消合并**：对已合并区 → 「取消合并 A1:C1」→ 拆开；**undo 后**重新合并。
3. 改动卡 humanLabel 中文清晰（如「合并单元格 A1:C1」）。

### EXCEL-12 删除重复行
4. **正常**：A1:D100 含若干重复行 → 「删除 A1:D100 内的重复行」→ 重复行删除、回显「删除 N 行重复」；**undo 后**所有原始行（含重复）**完整恢复**（值层面）。
5. **超限降级**：对 > 10,000 单元格区域（如 5 万行 × 多列）→ 删重仍执行，但 DiffLog 显示「此步无法自动撤销（区域过大）」**warn 不中断 agent**（验 noop+gate）。
6. （若 1.9 不可用）→ 工具诚实拒绝、明确告知，不静默假成功。

### EXCEL-13 数据透视表（**分支依 R1 验证结果**）
7. **若 API 可用**：A1:D50 有结构化数据（地区/月份/销售额）→「用 A1:D50 创建数据透视表放到 F1，行=地区，值=销售额求和」→ 透视表生成且字段正确；**undo 后**透视表删除、F1 区域清空。
8. **若 API 不可用**（plan-phase 验出）：工具**诚实降级**——明确告知「当前 Office for Web 不支持创建数据透视表」，**不静默假成功、不中断 agent**（这是「诚实降级」的 PASS 判据，ROADMAP SC#3）。

### 守门 / 回归
9. `npm test` 全绿（含新增 `operationLog.integration.test` 守门用例 + `contract.test.ts`）；动 UI/宏则跑 `npm run extract`（本 phase 大概率不动 UI/i18n 宏）。
10. `npm run build && npm run size` → initial main bundle ≤82KB gzip（本 phase 增量不破 gate）。
</uat_seeds>

---

<hard_constraints>
## HARD CONSTRAINTS（不可妥协，已知事实，非灰区 — 来自 team-lead 指令 + 项目记忆）

- **Bundle**：initial main-*.js ≤82KB gzip CI gate，余量 ~0.7KB 极紧；重模块懒加载；**动 bundle 先 `npm run build` 再 `npm run size`**（陈旧 dist 给假绿，memory `project_bundle_size_guard`）。
- **Node 22**：`export PATH="$HOME/.nvm/versions/node/v22.22.1/bin:$PATH"`。
- **write 工具合约**：inverse/read/snapshot 收 **Record 对象**（非位置参，memory `project_adapter_inverse_signature` / Phase 5 翻车点）；按需新 `PostStateSnapshot.kind`（新 kind → readTargetState 保守 undefined）；中文 humanLabel；过 `operationLog.integration.test` 守门（**真 adapter 实例非 mock**）；入 `buildToolsForHost('excel')` 工具集 + 参数 snake_case casing 归一化。
- **Excel adapter 坑（事实）**：worksheet 级 getRange 拒收「表名!A1」前缀 → 用 `resolveRange` helper 路由 getItem（memory `project_excel_adapter_gotchas`）；executeBatch 分派认 `op.tool` 别硬编码参数形状。
- **undo 守门是数据安全硬门，不软化**（memory `project_quality_over_cost` 边界）；NFR-08 工具 token 门已去掉（质量 > 成本），但 bundle / P95≤10s / Key 不上传 仍硬守。
- **降级诚实**：不可用即明确拒绝/noop+gate + 清晰错误，**绝不静默假成功、绝不中断 agent**（ROADMAP SC#3）。
</hard_constraints>

---

<canonical_refs>
## Canonical References（下游 agent 规划/实现前必读）

### Phase 28 直接地基（最高优先，逐行对齐）
- `.planning/phases/10-excel-ppt-b-excel-b-ppt/10-CONTEXT.md` — **v2.1 Excel write 工具既有范式真相源**：undo 三分类、快照式「写前 readSnapshot + 超限 noop+gate」（D-06/07）、`resolveRange`、守门四步（D-17~D-21）、命名真相源裁决（D-01/02）、adapter Record 签名（D-18）、新 kind 保守 undefined（D-21）。Phase 28 三工具直接镜像。
- `src/agent/contract.test.ts` — CONTRACT 常量 + 守门断言（`length>=24` line 145、host 枚举 line 85、D-17 `fs.readFileSync` line 118）。新增 3 行的接线模板 = 第 41-50 行 Phase 10 十行。
- `src/agent/operationLog.ts` — `DocumentAdapterForReplay` 接口（line 132+）、`executeReverse` switch（`restore_range_values_snapshot` line 422 可复用 / `noop_inverse` line 537）、`PostStateSnapshot.kind` union（line 38-47）。
- `src/adapters/ExcelAdapter.ts` — **核心改动文件**：`resolveRange` helper（line 57）、`readRangeValuesSnapshot`+`restoreRangeValuesSnapshot`（line 1235/1265，remove_duplicates 复用）、`SNAPSHOT_LIMIT=10_000`（line 1223）、`isSetSupported('ExcelApi','1.9')` 门控先例（line 1336）、`create_table`/`delete_table_by_name` 简单逆向范式（pivot 镜像）、`HostApiError` 包装范式。
- `src/agent/tools/write/excel.ts` — ToolDef 范式（reverse descriptor 字面量 + postState + humanLabel）；`src/agent/tools/index.ts:294-309` — `buildToolsForHost('excel')` 注册点 + `assertWriteToolRegisterable`。
- `src/agent/operationLog.integration.test.ts` — D-19 守门测试范式（真 ExcelAdapter 实例 → replayUndoSingle → rolled_back / skipped_error）。

### 里程碑 / 需求
- `.planning/REQUIREMENTS.md` §C·Excel（EXCEL-11/12/13 全文 + EXCEL-13 ⚠️ plan-phase 必验标注）+ §Deferred（这三个 = 原 EXCEL-D1/D2/D3）+ §Out of Scope。
- `.planning/ROADMAP.md` §Phase 28（Goal + 4 条 Success Criteria）。

### 项目记忆（约束）
- `project_adapter_inverse_signature` — Record 签名 + 真 adapter 守门 + 新 kind 保守 undefined（D-GATE 依据）。
- `project_excel_adapter_gotchas` — resolveRange 路由 + executeBatch 认 op.tool。
- `project_bundle_size_guard` — 82KB gate + build-then-size + 懒加载。
- `project_quality_over_cost` — undo 守门硬门不软化；bundle/P95 仍守。
- `feedback_self_run_spikes` — Claude 自跑能跑的别让用户跑；真机必须的列 UAT（R1 依据）。
- `feedback_recurring_failure_add_gate` — 同故障复发加结构性守门（D-GATE 依据）。
- `image_insert_autonomous` — agent 工具 AI loop 内自主调用、无确认卡 UX（无新 UI 表面依据）。
</canonical_refs>

---

*Phase: 28-excel-tools*
*Context gathered: 2026-06-05*
*Human decisions required: NONE（纯技术，降级行为已拍板）*
