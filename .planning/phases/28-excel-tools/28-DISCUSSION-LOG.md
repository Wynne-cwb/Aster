# Phase 28: Excel 工具补全 — Discussion Log（审计轨迹）

**Date:** 2026-06-05
**Step:** `gsd-discuss-phase`（user-led，团队模式 / team-lead 协调）
**Agent:** discuss TeamMate（aster-v2.4）
**Outcome:** 人类决策 = **NONE**；产物 = `28-CONTEXT.md` + 本 log；下一步 = `gsd-plan-phase`

---

## 1. 输入与上下文读取

读取的权威来源：
- `.planning/REQUIREMENTS.md` — EXCEL-11/12/13 全文 + EXCEL-13 ⚠️ plan-phase 必验标注 + §Deferred（确认三者 = 原 v2.1 EXCEL-D1/D2/D3）+ §Out of Scope + Traceability（三者全映射 Phase 28，status Pending）。
- `.planning/ROADMAP.md` §Phase 28 — Goal + 4 条 Success Criteria（SC#3 = EXCEL-13 可用则建/不可用则诚实 noop+gate；SC#4 = 守门 + bundle gate）。
- `.planning/phases/10-excel-ppt-b-excel-b-ppt/10-CONTEXT.md` — v2.1 Excel write 工具既有范式（undo 三分类、快照式 + 超限 noop+gate、守门四步 D-17~D-21、Record 签名 D-18、命名真相源、新 kind 保守 undefined）。

Codebase scout（实证既有范式已落地）：
- `src/agent/contract.test.ts` — CONTRACT 常量第 41-50 行 = Phase 10 十个 Excel 工具；守门：`length>=24`（line 145）、host 枚举（line 85）、D-17 `fs.readFileSync`（line 118）。三新工具尚未进 CONTRACT。
- `src/agent/operationLog.ts` — `restore_range_values_snapshot` case（line 422，remove_duplicates 可复用）、`noop_inverse` case（line 537，超限/不可用降级共用）、`PostStateSnapshot.kind` union（line 38-47）、接口 Record 签名（line 132+）。
- `src/adapters/ExcelAdapter.ts` — `resolveRange`（line 57）、`readRangeValuesSnapshot`/`restoreRangeValuesSnapshot`（line 1235/1265）、`SNAPSHOT_LIMIT=10_000`（line 1223）、`isSetSupported('ExcelApi','1.9')` 先例（line 1336）、`create_table`+`delete_table_by_name` 简单逆向范式。
- `src/agent/tools/write/excel.ts`（ToolDef 范式）+ `src/agent/tools/index.ts:294-309`（`buildToolsForHost('excel')` 注册 + `assertWriteToolRegisterable`）。
- 无 `merge`/`unmerge`/`removeDuplicates`/`pivot` 既有实现（grep 确认）→ 三工具均为新增。

---

## 2. 灰区二分分析（核心审计）

### 方法
对每个候选「灰区」逐一判定：**需人类拍板**（产品/UX 取向、用户偏好分叉）vs **可自决**（既有范式 technical default）vs **可研究/必验**（客观技术事实，留 research/plan）。

### 逐项裁决

| # | 候选 | 判定 | 依据 |
|---|------|------|------|
| 1 | EXCEL-13 透视表 API 在 Web 可用性 | **可研究（plan-phase 必验）** | REQUIREMENTS 已显式标为 plan-phase 验证项；客观技术事实，用户无法替 API 拍板 |
| 2 | 透视表不可用时的行为 | **已拍板（非灰区）** | 用户已在 REQUIREMENTS / ROADMAP SC#3 定「诚实 noop+gate，不假装」 |
| 3 | merge 是否快照恢复被丢弃单元格值 | **可自决（数据安全硬门）** | undo 忠实还原是既定硬门（非偏好）；快照式范式已落地（D-06/07） |
| 4 | 三工具命名 / 单工具 vs 多工具 | **可自决** | 沿用 Phase 10 命名真相源 + casing 归一化范式；planner 定 |
| 5 | removeDuplicates 快照上限数字 | **可自决** | 复用既有 `SNAPSHOT_LIMIT=10_000` + 超限 noop+gate（已落地） |
| 6 | 透视表字段配置深度 | **可自决（planner discretion）** | 见下方深度论证 |
| 7 | 是否纳入 batch_write | **可自决** | 非硬性需求；planner 定 |
| 8 | bundle 是否需懒加载 | **可研究（实测后定）** | NFR-12 硬约束；build-then-size 实测，非用户偏好 |

### 唯一最接近「产品取向」的候选（#6 透视表字段深度）—— 为何不升级为用户问题
3 条论证（详见 `28-CONTEXT.md` §灰区二分 A）：
1. **被 API 边界先行约束**：若 R1 验出 `pivotTables.add` 在 Web 不可用，整工具 noop+gate，深度无意义。
2. **无用户口味分叉**：更丰富永远更好，只受 API 能力 + bundle 预算约束 → 「能做多少」的工程判断，非「想要哪种」的产品判断。
3. **无新 UI 表面**：沿用 agent-tool 模型（AI loop 自主调用、无确认卡 UX，memory `image_insert_autonomous`），用户无需定交互。
→ 记为 planner discretion + 推荐默认（D-13c），不打断用户。

### team-lead 预判核对
TL 指令明确：「本 phase 大概率纯技术、合约+降级行为已定（EXCEL-13 不可用即诚实 noop+gate，已拍板）……如果没有，不要硬造问题，直接报 none+充分理由」。
→ 本次二分**完全印证 TL 预判**：所有候选均落「可自决 / 可研究 / 已拍板」，无一需用户产品/UX 输入。**遵循指令，不硬造问题。**

---

## 3. 决策结论

**人类决策：NONE。**

未触发 `AskUserQuestion`——无真正的产品/UX 取向决策。所有不确定性已分流：
- 技术事实 → §可研究事实清单（R1 透视表 Web 可用性为 plan-phase 必验 CRITICAL 项 / R2 removeDuplicates 1.9 / R3 merge 语义 / R4 bundle 实测 / R5 合约接线）。
- 实现默认 → §可自决记录（D-EX11 / D-EX12 / D-EX13 / D-GATE，全沿用 Phase 10 已落地范式）。
- 降级行为 → 用户已拍板（EXCEL-13 不可用→诚实 noop+gate）。

---

## 4. 产物

- `.planning/phases/28-excel-tools/28-CONTEXT.md` — 权威决策 + 可自决记录 + 可研究事实清单（含 EXCEL-13 R1 必验点）+ HARD CONSTRAINTS + UAT 种子 + canonical refs。
- `.planning/phases/28-excel-tools/28-DISCUSSION-LOG.md` — 本审计轨迹。

**未 git commit**（遵 team-lead 指令）。

---

## 5. 下一步建议

→ **`gsd-plan-phase`（Phase 28）**。plan-phase 必须：
1. **优先验 R1**（EXCEL-13 `pivotTables.add` 在 Office for Web 可用性）——这是本 phase go/降级 分水岭，决定 create_pivot_table 是完整实现还是 noop+gate。
2. 新增 CONTRACT.md 3 行 + contract.test.ts 3 行 + operationLog 接线 + 真 adapter 守门用例（D-GATE 四步）。
3. 建议 wave：Wave 0 合约+守门桩（先红）→ Wave 1 merge_cells + remove_duplicates（复用既有快照基建，低风险）→ Wave 2 create_pivot_table（高风险，运行时降级门控）。
4. 收尾 `npm run build && npm run size` 守 ≤82KB（本 phase 增量；全里程碑收口在 Phase 29）。

---

*Discussion completed: 2026-06-05*
