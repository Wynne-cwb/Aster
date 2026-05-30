# Phase 10: Excel + PPT 工具完整 (B-Excel + B-PPT) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 10-excel-ppt-b-excel-b-ppt
**Mode:** `--auto`（Claude 替用户按推荐默认填全部灰区；team-lead 代 TL）
**Areas discussed:** G-A 命名真相源裁决 / G-B manage_worksheet 范围 / G-C Excel 快照范围+上限 / G-D PPT spike 降级 / G-E PPT noop+gate / G-F add_shape+copy_slide 逆向 / G-G undo 守门 / G-H wave 切分

---

## G-A 命名真相源裁决（CONTRACT/contract.test.ts vs REQUIREMENTS 文字差异）

| Option | Description | Selected |
|--------|-------------|----------|
| 以 contract.test.ts + CONTRACT.md 为逐字真相源 | reverse 名/工具名对齐 CI 守门文件，REQUIREMENTS 散文差异以此覆盖 | ✓ |
| 以 REQUIREMENTS.md 措辞为准 | apply_filter / find_and_replace_excel / delete_slide / duplicate_slide | |

**Auto-selected:** 以 contract.test.ts 为准（recommended）。**理由**：contract.test.ts 是 CI 守门（CONTRACT 长度 ≥23 + 每工具 reverseTool/undoType + D-17 `fs.readFileSync` 断言）；reverse 名不一致会导致规划落地 CI 直接挂。裁决：set_auto_filter / excel_find_and_replace / manage_slides / copy_slide / delete_slide_by_index 等以 CONTRACT 字面为准。

---

## G-B manage_worksheet 范围裁决（EXCEL-09 ⚔ CONTRACT 内部冲突）【待复核】

| Option | Description | Selected |
|--------|-------------|----------|
| operation 限定 add\|rename（保留工具名/reverse/undoType 字面） | 安全侧 + REQUIREMENTS/TL/Out-of-Scope 侧；轻量元数据快照 | ✓ |
| 按 CONTRACT 参数摘要做 add/rename/delete/copy 全 4 op | 含 delete_worksheet，需整表内容快照（不可行） | |

**Auto-selected:** 限定 add\|rename（recommended）。**理由**：CONTRACT.md 自身冲突——第 38 行参数摘要写 `(rename/add/delete/copy)`，但同份 D-19 + v2.2 Defer + REQUIREMENTS EXCEL-09 ⚠ + Out of Scope 表 + TL 显式指令全部要求「绝不含 delete_worksheet」（整表永久丢失、Office.js 不支持 undo）。取安全侧，仅 add/rename；工具名/reverse 名/undoType 仍逐字保 CONTRACT（manage_worksheet / restore_worksheet_snapshot / 快照式），快照语义降为轻量元数据 before-image。**待 team-lead/用户复核此裁决。**

---

## G-C Excel 快照式 undo 范围 + 上限（sort_range / excel_find_and_replace）【待复核】

| Option | Description | Selected |
|--------|-------------|----------|
| 2D values before-image + 上限超限 noop+gate | readRangeValuesSnapshot 存全量；≤10,000 单元格快照，超限降级 | ✓ |
| 无上限全量快照 | 大区域超 5MB API 上限会崩（PITFALLS E4） | |

**Auto-selected:** 2D values before-image + 上限 noop+gate（recommended，上限建议 10,000 单元格，planner 实测定）。**理由**：sort_range `range.sort.apply()` 清空原生撤销栈且不可逆，必须先存；Office for Web Excel 5MB API 上限（PITFALLS E4）。共享 reverse `restore_range_values_snapshot`。

---

## G-D PPT 3 个 spike 工具运行时降级（PPT-02/05/08，S4/S1/S2）【待复核】

| Option | Description | Selected |
|--------|-------------|----------|
| spike 不阻塞 + 运行时 isSetSupported 门控 + try/catch 降级 noop+gate | 镜像 Phase 9 D-02；CONTRACT 简单逆向 = happy path，读不到当场降级 | ✓ |
| 等真机 spike 通过才规划/执行 | 阻塞，Claude 无法自跑 spike | |

**Auto-selected:** 不阻塞 + 运行时门控降级（recommended）。**理由**：S1/S2/S4 需真机 Office for Web，Claude 无法自跑（memory feedback_self_run_spikes）。降级路径本身是安全网；integration.test 验 happy-path 简单逆向，真机 UAT 给最终 verdict。

---

## G-E PPT noop+gate 工具行为（delete_shape PPT-04 / manage_slides PPT-06）【待复核】

| Option | Description | Selected |
|--------|-------------|----------|
| 执行 + warn 不中断（reverse=noop_inverse → skipped_error） | 现有 CR-04 范式；DiffLog「此步无法自动撤销」 | ✓ |
| 执行前要求用户确认 | 中断 agent 流畅度 | |

**Auto-selected:** 执行 + warn 不中断（recommended）。**理由**：ROADMAP SC#4 明确「warn 但 agent 流程不中断」。manage_slides v2.1 限定 operation='delete'（reorder 推迟，见 Deferred）。

---

## G-F add_shape #2775 deselect + copy_slide 逆向定位（PPT-03 / PPT-07）【待复核】

| Option | Description | Selected |
|--------|-------------|----------|
| addTextBox 前 deselect + 校验 shape count；copy_slide index+ID 双定位 | 绕 #2775；防 index 漂移误删（PITFALLS P2/P4） | ✓ |
| 纯 index 定位 / 不 deselect | #2775 静默删形状；同标题 slide 误删 | |

**Auto-selected:** deselect + 双定位（recommended）。**理由**：#2775（addTextBox 静默删选中形状，spike S7 HIGH）+ P4（复制 slide 同标题，纯 index 易漂移）。reverse 名保 CONTRACT 字面 `delete_slide_by_index`，内部 ID/指纹优先。

---

## G-G undo 基础设施扩展 + D-17 守门（贯穿 18 工具，数据安全硬门）

| Option | Description | Selected |
|--------|-------------|----------|
| 每工具四步守门（contract.test + 真 adapter integration.test + CONTRACT.md + noop 守门），Record 签名 | 镜像 Phase 9 G-E；真 ExcelAdapter/PptAdapter 实例非 mock | ✓ |
| 仅单测 / mock 守门 | mock 抓不到 Record 签名错配（Phase 5 翻车点） | |

**Auto-selected:** 四步硬门 + 真 adapter（recommended，不软化）。**理由**：memory project_adapter_inverse_signature + feedback_recurring_failure_add_gate + project_quality_over_cost（undo 守门是数据安全硬门）。共享快照名双守门（D-20）；新 kind 保守 undefined（D-21）。

---

## G-H wave 切分 + split 评估

| Option | Description | Selected |
|--------|-------------|----------|
| 单一 Phase 10 全保真 18 工具 + 5 wave | TL 指令优先；undo 基础设施 wave 0 先行 | ✓ |
| 主动拆分 Excel/PPT 两 phase | 拆分是用户级决策，不自行改 roadmap | |

**Auto-selected:** 单一 Phase 全保真（recommended）。**理由**：TL 显式指令。若 planner 返回「PHASE SPLIT RECOMMENDED」→ flag team-lead（建议切分轴 Excel 10 / PPT 8），不自行拆。

## Claude's Discretion

- Excel 快照上限具体数字（D-07）；format_excel_range before-image 字段组合；add_conditional_format rule 结构 + 索引漂移防御；copy_slide 双定位指纹字段；新 PostStateSnapshot.kind 命名；18 工具 humanLabel + description 措辞；wave 切分与并行度。

## Deferred Ideas

- merge_cells / remove_duplicates / create_pivot_table（EXCEL-D1/D2/D3）→ v2.2；delete_worksheet → Out of Scope 永久不做；manage_worksheet copy op / manage_slides reorder op → v2.1 不做；set_shape_fill_advanced / add_line（PPT-D1）/ insert_table_ppt（PPT-D2 S3）→ v2.2；PPT 动画/转场/SmartArt/主题/读背景 → Out of Scope。
- builtin-model-dropdown.md todo（score 0.4 误匹配）→ 不纳入。
</content>
