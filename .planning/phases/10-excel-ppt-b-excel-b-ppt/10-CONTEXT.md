# Phase 10: Excel + PPT 工具完整 (B-Excel + B-PPT) - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning
**Mode:** `--auto`（用户离开，team-lead 代为 TL；Claude 替用户按推荐默认填灰区；所有「替用户拍」项已标【待复核】）

<domain>
## Phase Boundary

Phase 10 在 Phase 8 能力合约 + Phase 9 已建立的 Word undo 范式基础上，给 **Excel 宿主加 10 个 write 工具** + **PPT 宿主加 8 个 write 工具**，让 agent 能做 Excel 高频格式化（数字格式/字体/填充/边框/对齐、列宽行高、排序、筛选、查替换、条件格式、建表、冻结窗格、工作表管理、图表标题）和 PPT 高频形状操作（形状字体、文字对齐、形状增删、旋转、幻灯片背景、幻灯片复制删除）。**所有破坏性操作要么有 undo（简单逆向 / 快照式），要么明确 noop+gate（执行但 warn「不可自动撤销」、不中断 agent）。**

**WHAT 已被 `CONTRACT.md` + `src/agent/contract.test.ts` 双重锁定**（18 个工具名 / 参数摘要 / undo 三分类 / reverse_tool 名 / integration_test 守门）——本次 discuss 只锁 **HOW**（命名真相源裁决、manage_worksheet 范围、Excel 快照范围+上限、PPT 3 个 spike 工具运行时降级、noop+gate 行为、add_shape #2775 deselect、copy_slide 逆向定位、守门接线、wave 切分）。

**不在本阶段**：Word 工具（Phase 9 已规划）、批量 batch_write（Phase 11）、UI 打磨（Phase 12）、`merge_cells`/`remove_duplicates`/`create_pivot_table`（EXCEL-D1/D2/D3 → v2.2）、`delete_worksheet`（Out of Scope，永久不做）、PPT `set_shape_fill_advanced`/`add_line`（PPT-D1 → v2.2）、`insert_table_ppt`（PPT-D2 / spike S3 → v2.2）、slide reorder（非 v2.1 需求 → 见 Deferred）。

**Requirements covered (18):** EXCEL-01~10, PPT-01~08

**18 个工具（`contract.test.ts` 第 41-59 行 = CI 逐字真相源）：**

| # | tool_name | host | undo_type | reverse_tool |
|---|-----------|------|-----------|--------------|
| EXCEL-01 | `format_excel_range` | excel | 简单逆向 | `restore_range_format` |
| EXCEL-02 | `set_column_row_size` | excel | 简单逆向 | `restore_column_row_size` |
| EXCEL-03 | `sort_range` | excel | 快照式 | `restore_range_values_snapshot` |
| EXCEL-04 | `set_auto_filter` | excel | 简单逆向 | `restore_auto_filter` |
| EXCEL-05 | `excel_find_and_replace` | excel | 快照式 | `restore_range_values_snapshot` |
| EXCEL-06 | `add_conditional_format` | excel | 简单逆向 | `restore_conditional_format` |
| EXCEL-07 | `create_table` | excel | 简单逆向 | `delete_table_by_name` |
| EXCEL-08 | `freeze_panes` | excel | 简单逆向 | `restore_freeze_panes` |
| EXCEL-09 | `manage_worksheet` | excel | 快照式 | `restore_worksheet_snapshot` |
| EXCEL-10 | `set_chart_title` | excel | 简单逆向 | `restore_chart_title` |
| PPT-01 | `set_shape_text_font` | ppt | 简单逆向 | `restore_shape_font` |
| PPT-02 | `set_shape_text_alignment` | ppt | 简单逆向（spike S4 门控） | `restore_shape_alignment` |
| PPT-03 | `add_shape` | ppt | 简单逆向 | `delete_shape_by_id` |
| PPT-04 | `delete_shape` | ppt | noop+gate | `noop_inverse` |
| PPT-05 | `rotate_shape` | ppt | 简单逆向（spike S1 门控） | `restore_shape_rotation` |
| PPT-06 | `manage_slides` | ppt | noop+gate | `noop_inverse` |
| PPT-07 | `copy_slide` | ppt | 简单逆向 | `delete_slide_by_index` |
| PPT-08 | `set_slide_background` | ppt | 简单逆向（spike S2 门控） | `restore_slide_background` |

> **注：`restore_range_values_snapshot` 被 EXCEL-03 与 EXCEL-05 共享** — 一个 `executeReverse` case + 一个 adapter 快照还原方法即可，但**两条工具各自仍需独立的 integration.test 守门用例**（D-17 `fs.readFileSync` 断言每个 toolName 字符串都要出现在 `operationLog.integration.test.ts`，见 G-G）。
</domain>

<decisions>
## Implementation Decisions

> 灰区均 `--auto` 由 Claude 取推荐默认。**标【待复核】= Claude 替用户拍的判断**，team-lead 点名关注的：manage_worksheet 范围、Excel 快照范围/上限、3 个 PPT spike 降级、PPT noop+gate 行为、add_shape deselect、copy_slide 逆向 全在此列。

### G-A 命名真相源裁决（CONTRACT/contract.test.ts vs REQUIREMENTS 文字差异）

- **D-01 工具名/reverse 名一律以 `src/agent/contract.test.ts`（第 41-59 行）+ `CONTRACT.md` 为逐字真相源**，REQUIREMENTS.md 的散文措辞差异以此覆盖。已识别并裁决的差异：
  - EXCEL-04：REQUIREMENTS 写 `apply_filter`/`restore_autofilter` → **以 CONTRACT 为准用 `set_auto_filter` / `restore_auto_filter`**。
  - EXCEL-05：REQUIREMENTS 写 `find_and_replace_excel` → **用 `excel_find_and_replace`**；reverse `restore_range_values_snapshot`。
  - PPT 删/复制幻灯片：REQUIREMENTS 写 `delete_slide`（正向）/`duplicate_slide` → **CONTRACT 合并为 `manage_slides`（operation 枚举，noop+gate）+ `copy_slide`（简单逆向，reverse `delete_slide_by_index`）**。`delete_slide` 能力经 `manage_slides(operation='delete')` 承载（PPT-06）；`duplicate_slide` 能力 = `copy_slide`（PPT-07）。
  - PPT-07 reverse：REQUIREMENTS/PITFALLS P4 倾向 by-id，CONTRACT 写 `delete_slide_by_index` → **reverse 名保持 CONTRACT 的 `delete_slide_by_index`（CI 字面）**，但实现内部做 index+ID/title 指纹双定位防漂移（见 D-15）。
- **D-02 理由**：`contract.test.ts` 是 CI 守门（断言 CONTRACT 长度 ≥23 + 每工具 undoType/reverseTool/host 齐全 + D-17 `fs.readFileSync` 断言）；reverse 名若与此文件不一致，规划落地时 CI 直接挂。逐字对齐是硬约束（memory `project_adapter_inverse_signature` + TL 指令）。

### G-B manage_worksheet 范围裁决（EXCEL-09 ⚔ CONTRACT 内部冲突）【待复核，team-lead 点名】

- **D-03 `manage_worksheet` 的 operation 枚举限定为 `add | rename` 两项，绝不含 `delete`/`copy`。** 这是 Phase 10 最关键的裁决——存在 CONTRACT.md 自身的内部冲突：
  - CONTRACT.md 第 38 行参数摘要写 `operation(rename/add/delete/copy)`、undo 标「快照式」`restore_worksheet_snapshot`；
  - **但同一份 CONTRACT.md 的 D-19 锁定结论 + v2.2 Defer 清单 + REQUIREMENTS EXCEL-09 ⚠ + Out of Scope 表 + TL 显式指令 全部要求「绝不含 delete_worksheet」**（整表内容永久丢失、Office.js 明确不支持 undo、快照不实际 = PITFALLS Excel summary）。
- **D-04 工具名 + reverse 名 + undoType 仍逐字保持 CONTRACT/CI（`manage_worksheet` / `restore_worksheet_snapshot` / 快照式），仅收窄 operation 枚举。** 快照语义 = 轻量元数据 before-image：
  - `operation='add'` → 快照存「该表名先前不存在」→ inverse = 删除刚建的表（按名）；
  - `operation='rename'` → 快照存旧表名 → inverse = 改回旧名。
  - 两者都不需要整表内容快照（区别于 delete，delete 才需要不可行的全内容序列化）。这样既对齐 CI（名/reverse/undoType 全中第 49 行）又满足安全红线（无 delete）。
- **D-05 `copy`（复制工作表）同样不进 v2.1**：非 EXCEL-09 需求、`Worksheet.copy` 会清空原生撤销栈（PITFALLS E1），且快照式复制无明确需求。→ 见 Deferred。
- **待复核点**：CONTRACT.md 第 38 行参数摘要 `(rename/add/delete/copy)` 与 D-19/Out-of-Scope 矛盾——Claude 取**安全侧 + REQUIREMENTS/TL 侧**（仅 add/rename）。若用户要保留 delete/copy 能力，需另立 v2.2 并重新设计快照策略。

### G-C Excel 快照式 undo 范围 + 上限（sort_range / excel_find_and_replace，EXCEL-03/05）【待复核，team-lead 点名 EXCEL-03】

- **D-06 快照粒度 = 受影响区域的 2D values before-image**：写前新增 adapter `readRangeValuesSnapshot(address)` 读全量 `range.values`，存 `reverse.args.snapshot`；inverse `restore_range_values_snapshot` 用 `range.values = snapshot` 覆写还原。与 Phase 9 Word `find_and_replace`「写前 readSnapshot」范式同构。
  - `sort_range`：快照 = 排序区域整块 2D values（`range.sort.apply()` 会清空原生撤销栈且不可逆，必须先存）。
  - `excel_find_and_replace`：快照 = 受影响区域（有 `address` 则该区，否则 used range）整块 2D values before-image（所有匹配单元格的原值都在内）。
- **D-07 上限 + 超限行为**【待复核】：快照单元格数 ≤ 上限 → 快照式 undo；**超限 → noop+gate**（仍执行排序/替换，但 warn「区域过大，无法自动撤销」，不中断 agent）。
  - 建议上限 **10,000 单元格**（PITFALLS E4：Office for Web Excel 5MB API 响应上限，5 万行×10 列的 2D JSON 轻松超限）；**planner 按 API 实测定具体数字**。
  - 超限走 noop+gate = `reverse.tool: 'noop_inverse'` + `reason`（executeReverse 已有 noop_inverse case → throw → skipped_error → DiffLog「此步无法自动撤销」）。
- **D-08 已知限制（写进工具 description，不阻塞）**：排序还原用静态 values 覆写，若区域含行相对引用公式，还原静态值可能破坏公式（PITFALLS E1）；`merge_cells` 后的区域 `range.sort.apply()` 会抛 GeneralException（PITFALLS E5）——description 注明，不在本阶段防御性拦截。
- **D-09 公式/格式还原范围**：本阶段 `restore_range_values_snapshot` 只还原 **values**（不含 numberFormats/公式重建）——与 CONTRACT 命名「values_snapshot」一致；格式还原由 `format_excel_range` 的 `restore_range_format` 各管各。

### G-D PPT 3 个 spike 工具运行时降级（PPT-02/05/08，spike S4/S1/S2）【待复核，team-lead 点名全部 3 个】

- **D-10 spike 不前置阻塞规划/执行**（镜像 Phase 9 D-02）：S1（`shape.rotation` 可写，#3022）、S2（`slide.background.fill.*` 可读，PPT API 1.10）、S4（`textRange.paragraphFormat.alignment` 可读写）三者需真机 Office for Web 才能验，Claude 无法自跑（memory `feedback_self_run_spikes`）。**决策：实现里做运行时 `isSetSupported` 门控 + try/catch 读 before-image，读不到就当场降级 noop+gate**——降级路径本身就是安全网，无需等 spike 通过才动工。
- **D-11 CONTRACT 声明的「简单逆向」= happy-path**：三工具的 reverse 名（`restore_shape_alignment` / `restore_shape_rotation` / `restore_slide_background`）按 CONTRACT 字面实现，**integration.test 守门验「读得到 → 简单逆向 → rolled_back」这条路径**（D-17）。**运行时若读不到原值 → 该步 `reverse.tool` 落 `noop_inverse` + reason（warn 不中断）**，作为真机安全网，由真机 UAT 给出 S1/S2/S4 最终 verdict（ROADMAP SC#5「结论已记录」= 记录运行时门控决策 + UAT verdict）。
- **D-12 PPT-08 set_slide_background 只写纯色填充**（`background.fill.setSolidColor(hex)`）；**绝不实现读主题色/读背景的正向 read 工具**（Out of Scope：无文档化 read API）。before-image 经 try/catch 读 `slide.background.fill` 当前色，读不到 → noop+gate。

### G-E PPT noop+gate 工具行为（delete_shape PPT-04 / manage_slides PPT-06）【待复核】

- **D-13 noop+gate = 执行 + warn 不中断**：`delete_shape`、`manage_slides(operation='delete')` 正向**照常执行删除**，但 OperationLogEntry 的 `reverse = { tool: 'noop_inverse', args: { reason: '...' } }`。回放时 executeReverse 的 noop_inverse case throw → `skipped_error` → DiffLogPanel 显示「此步无法自动撤销」（现有 CR-04 范式，ROADMAP SC#4）。**绝不中断 agent 流程**（warn 级，非 error）。
  - `delete_shape` noop 理由：形状完整状态（类型/位置/尺寸/填充/描边/文字/字体）无法可靠序列化重建（PITFALLS PPT）。
  - `manage_slides(delete)` noop 理由：无 slide export/序列化 API（STATE SP-5 / PITFALLS）。
- **D-14 `manage_slides` 的 operation 枚举 v2.1 限定 `delete`**：ROADMAP 文字 = 「幻灯片复制删除」，无 reorder 需求；CONTRACT 参数摘要含 `reorder` 但 reorder 技术上可逆（move 回去）与 noop+gate 声明不自洽。→ **v2.1 只暴露 `operation='delete'`（noop+gate）**；`reorder` 推迟（见 Deferred）。保留 operation 参数形态供未来扩展。

### G-F add_shape #2775 deselect + copy_slide 逆向定位（PPT-03 / PPT-07）【待复核，team-lead 点名 PPT-03 deselect】

- **D-15 `add_shape` 参数化 = 几何形状 + 文本框二合一**：`shapeType` 枚举区分；`text?` 可选填充文字；`position{left,top,width,height}`。
  - **文本框路径（addTextBox）前必须先 deselect 所有形状**（绕 GitHub #2775：Web 端 addTextBox 静默删除当前选中形状），**插入后校验 shape count 增加**（PITFALLS P2 / spike S7，HIGH 信心）。
  - 几何形状走 `shapes.addGeometricShape`。两路都**捕获新形状 ID** → 存 `reverse.args.shapeId` → inverse `delete_shape_by_id` 按 ID 删除。
  - 复用 `TEXT_SHAPE_TYPES` 白名单守卫（PptAdapter.ts:38）；文字写入走现有 `setShapeText` fail-closed 路径范式。
- **D-16 `copy_slide` 逆向 = index + ID/title 指纹双定位**：正向复制后捕获新 slide 的插入位置 index（`copy_slide(sourceIndex, targetIndex)`）。reverse 名按 CONTRACT 字面 = **`delete_slide_by_index`**，但实现内部**优先按捕获的 slide ID/标题指纹定位**、index 为后备（PITFALLS P4：复制出的 slide 与原 slide 同标题，纯 index 易因中途 slide 操作漂移误删）——与 Phase 9 `delete_table_by_marker`（index+内容指纹双定位）同范式。定位不到 → `skipped_error` 诚实标，不删错 slide。
  - `getSelectedSlides()` 结果必须按 `.index` 排序后用（PptAdapter PPT-05 守则 / #3618）。

### G-G undo 基础设施扩展 + D-17 守门（贯穿 18 工具，**数据安全硬门，不软化**）

- **D-17 operationLog.ts 扩展**（A-06：不出现 Office 命名空间）：
  - `DocumentAdapterForReplay` 接口加 15 个新 inverse/snapshot 方法声明（Excel 9：`restoreRangeFormat` / `restoreColumnRowSize` / `restoreRangeValuesSnapshot` / `restoreAutoFilter` / `restoreConditionalFormat` / `deleteTableByName` / `restoreFreezePanes` / `restoreWorksheetSnapshot` / `restoreChartTitle`；PPT 6：`restoreShapeFont` / `restoreShapeAlignment` / `deleteShapeById` / `restoreShapeRotation` / `restoreSlideBackground` / `deleteSlideByIndex`）。
  - `executeReverse` switch 加对应 case，**case 字符串逐字 = CONTRACT reverse 名**（`restore_range_format` / `restore_column_row_size` / `restore_range_values_snapshot` / `restore_auto_filter` / `restore_conditional_format` / `delete_table_by_name` / `restore_freeze_panes` / `restore_worksheet_snapshot` / `restore_chart_title` / `restore_shape_font` / `restore_shape_alignment` / `delete_shape_by_id` / `restore_shape_rotation` / `restore_slide_background` / `delete_slide_by_index`）。`noop_inverse` case 已存在（delete_shape/manage_slides + 超限降级共用）。
- **D-18 adapter inverse/read/snapshot 签名一律 `(args: Record<string, unknown>)`**（memory `project_adapter_inverse_signature` 硬约束；Phase 5 位置签名致真机撤销全挂的翻车点；Phase 9 已据此把守门改真 adapter）。
- **D-19 D-17 守门做成每工具显式 plan 任务**（acceptance_criteria 必含**四步**，缺一 CI 挂）：
  1. `src/agent/contract.test.ts` 对应行 `integrationTest: false → true`；
  2. `src/agent/operationLog.integration.test.ts` 追加「**真 `ExcelAdapter` / `PptAdapter` 实例经 `replayUndoSingle` → `rolled_back` 且 adapter 收到 Record 对象**」守门用例（**用真 adapter 实例，不用 mock**——mock 抓不到 Record 签名错配；且工具名字符串必须出现在该文件内，`contract.test.ts` 第 114-137 行 `fs.readFileSync` 硬卡）；
  3. `CONTRACT.md` 对应行 `status: planned→done` + `integration_test: false→true`；
  4. noop+gate 三类（`delete_shape` / `manage_slides` / 超限降级）守门验「executeReverse(noop_inverse) → throw → skipped_error」路径（非 rolled_back）。
- **D-20 共享 reverse 名的双守门**：`restore_range_values_snapshot` 虽是一个 case + 一个 adapter 方法，但 `sort_range` 与 `excel_find_and_replace` **各需一条 integration.test 用例**（两个 toolName 字符串都要出现在文件内，满足 D-17 `fs.readFileSync` 逐工具断言）。
- **D-21 postState 手改侦测取保守路径**：新工具若需新 `PostStateSnapshot.kind`（如 `excel_range_format` / `excel_snapshot` / `excel_worksheet` / `ppt_shape_font` 等），`readTargetState` 对其**返 `undefined`（保守视为一致，正常回滚）**——**不盲加比对规则**（memory `project_adapter_inverse_signature`：盲加 read 比对会误判全部手改；现有 `ppt_shape`/`excel_chart` 已是保守 undefined）。新 kind 仅供 integration test 断言形状。undo 守门聚焦「reverse Record 签名路径可用 → rolled_back」硬路径（D-17）。

### Claude's Discretion（planner/researcher 可定）
- Excel 快照上限的**具体数字**（D-07，按 Office for Web Excel API 5MB 实测定）。
- `format_excel_range` 的 before-image 属性包**具体字段组合**（numberFormat / font{bold,color,size} / fill{color} / borders / alignment——researcher 查 `Excel.RangeFormat` API 后定最稳子集）。
- `add_conditional_format` 的 rule 参数结构（色阶/数据条/高亮）+ `restore_conditional_format` 按 index 删除的索引漂移防御（PITFALLS：多规则时用 clearAll+restore-all 或 delete_at_index，planner 定）。
- `copy_slide` 双定位指纹的**具体字段**（D-16，researcher 查 PPT slide ID API 后定）。
- 新 `PostStateSnapshot.kind` 的**命名**（D-21）。
- 18 工具的 humanLabel 中文文案、参数 description 措辞（≤50 字/description，NFR-08 软目标）。
- wave 切分与并行度（见 G-H）。

### Folded Todos
无折叠。唯一匹配的 `builtin-model-dropdown.md`（score 0.4，仅命中关键词「phase」）为误匹配，与 Excel/PPT 写工具无关，见 Deferred（与 08/09-CONTEXT 同结论）。

### G-H wave 切分 + split 评估（规划结构建议，planner 定）
- **D-22 优先按现有单一 Phase 10 全保真规划全部 18 工具**（TL 指令：接受较多 plan）。建议 wave 顺序（依赖：undo 基础设施先于工具）：
  - **Wave 0**：operationLog.ts 接口/executeReverse case/kind 扩展骨架 + contract.test/integration.test 测试桩（先红后绿）。
  - **Wave 1 Excel 简单逆向**：format_excel_range / set_column_row_size / set_auto_filter / add_conditional_format / create_table / freeze_panes / set_chart_title（7 工具，同 adapter 文件可分 2-3 plan）。
  - **Wave 2 Excel 快照式 + 工作表**：sort_range / excel_find_and_replace（共享快照逆向）/ manage_worksheet。
  - **Wave 3 PPT 简单逆向**：set_shape_text_font / add_shape（含 #2775 deselect）/ copy_slide。
  - **Wave 4 PPT spike 门控 + noop+gate**：set_shape_text_alignment / rotate_shape / set_slide_background（运行时降级）+ delete_shape / manage_slides（noop+gate）。
- **D-23 若 planner 返回「## PHASE SPLIT RECOMMENDED」**：**不自行改 roadmap 结构**（拆分是用户级决策）。先尽量全规划；若 planner 强烈坚持必须拆，**flag 给 team-lead**（建议切分轴 = Excel 10 工具 / PPT 8 工具，两者 adapter 文件独立、无交叉依赖，是天然切分线）。
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 10 地基（最高优先，规划必须逐行对齐）
- `.planning/phases/08-foundation-a-f/CONTRACT.md` §"Phase 10 Excel 工具" + §"Phase 10 PPT 工具" + §"Undo 三分类说明" + §"参数化合并设计原则（STRAP，D-18）" + §"v2.2 Defer 清单" + 使用说明（实现时改 status + integration_test 的步骤）。**这是 Phase 10 的合约真相源。注意 manage_worksheet 行参数摘要与 D-19/Out-of-Scope 的内部冲突 — 见 G-B D-03 裁决。**
- `src/agent/contract.test.ts` — CONTRACT 常量**第 41-59 行（Phase 10 十八行）= reverse tool 名/undo 类型逐字 CI 真相源**；第 114-137 行 D-17 硬卡（`fs.readFileSync` 断言每个 integrationTest:true 工具名出现在 integration.test.ts）；第 140-142 行 CONTRACT 长度 ≥23 守门。

### Phase 9 已建立范式（建议复用 — undo 三分类 + 守门接线已跑通）
- `.planning/phases/09-word-d-b-word/09-CONTEXT.md` — G-E undo 基础设施扩展 + D-17 守门四步范式（Phase 10 G-G 直接镜像）；快照式 undo「写前 readSnapshot」范式（find_and_replace → sort_range/excel_find_and_replace 同构）；spike 不阻塞 + 运行时门控降级范式（S5 → S1/S2/S4 镜像）。
- `.planning/phases/09-word-d-b-word/09-PATTERNS.md` — Phase 9 已映射的新文件 → 最近似 analog（Phase 10 pattern-mapper 可参照同范式）。

### 里程碑研究（roadmapper 已消化大部分）
- `.planning/research/SUMMARY.md` §"B-Excel 合并后工具表"（10 工具 triage + undo 类型）、§"B-PPT 合并后工具表"（8 工具 + 3 spike 门控）、§"Spikes required"（S1/S2/S4/S7）、§"Top risks + undo/reverse 不可逆性分类"（sort_range 快照、delete_shape/manage_slides noop+gate、addTextBox #2775、manage_worksheet 不含 delete）。
- `.planning/research/FEATURES.md` — B-Excel / B-PPT 工具 triage 明细（do-now vs defer）。
- `.planning/research/PITFALLS.md` — §"Undo/Reverse Irreversibility Triage" Excel/PPT 两表（每工具逆向策略）、§"Office.js Per-Host Quirks" PPT（P1 TEXT_SHAPE_TYPES / P2 #2775 deselect / P3 #3618 slide 反序 / P4 copy_slide 用 ID / P5 background 读不确定）+ Excel（E1 撤销栈清空 / E4 5MB 上限 / E5 merge 阻塞 sort / E6 pivot 样式无 undo）、§"Anti-Features"（动画/SmartArt/主题/pageSetup 永久不做）。
- `.planning/research/ARCHITECTURE.md` — §"每 feature 集成点" B-Excel / B-PPT 行（新 ToolDef + adapter inverse + operationLog executeReverse case + integration test）。

### 项目记忆（约束 — adapter undo 是历史翻车区）
- memory `project_adapter_inverse_signature` — inverse/read/snapshot 方法收 Record 对象（非位置参）；每个新 inverse 配 `operationLog.integration.test` 守门**用真 ExcelAdapter/PptAdapter 实例（非 mock）**；手改侦测 read 方法保守 undefined（D-18/D-19/D-21 依据）。
- memory `feedback_recurring_failure_add_gate` — 同故障复发 ≥2 次加结构性守门（D-19 依据）。
- memory `project_quality_over_cost` — 质量 >> 成本&包体积，但 **undo 守门是数据安全硬门，不软化**（D-19 边界）；bundle ≤82 KB + P95 仍守（NFR-06）。
- memory `feedback_self_run_spikes` — Claude 自跑能跑的别让用户跑；spike 需真机的列 UAT（D-10 依据）。

### REQUIREMENTS
- `.planning/REQUIREMENTS.md` §"B 能力补全 · Excel"（EXCEL-01..10）+ §"B 能力补全 · PowerPoint"（PPT-01..08）+ 顶部「Undo 约定」段 + §"Out of Scope"（delete_worksheet / 动画转场 SmartArt 主题 / 读背景色）+ §"Deferred"（EXCEL-D1/D2/D3 / PPT-D1/D2/D3）。
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/adapters/ExcelAdapter.ts`（20.9KB）— **核心改动文件**。已有 `Excel.run` 闭包范式（A-06）、`getActiveWorksheet().getRange(address)`、`setRangeValues`、`overwriteRange`（现有 inverse 范式，line 362）、`insertChart`+`deleteChartByName`（现有 before-image+inverse 范式，line 404/435）、`HostApiError` 包装。新增 10 工具的写方法 + 9 个 inverse/snapshot 方法（`set_chart_title` 的 `restore_chart_title` 可复用 chart 定位范式；`restore_range_values_snapshot` 复用 `range.values` 覆写）。签名一律 Record（D-18）。
- `src/adapters/PptAdapter.ts`（43KB）— **核心改动文件**。已有 `TEXT_SHAPE_TYPES` 白名单守卫（line 38，新字体/对齐工具复用）、`getSelectedSlides()` 按 `.index` 排序（PPT-05/#3618）、`setShapeProperty`+`restoreShapeProperty`（before-image+inverse 范式）、`setShapeGeometry`+`restoreShapeGeometry`、`setShapeText`+`restoreShapeText`（fail-closed TEXT_SHAPE_TYPES）、`deleteSlideByTitle`（现有 slide inverse + addTextBox 用法 line 515）。新增 8 工具的写方法 + 6 个 inverse（`restore_shape_font`/`restore_shape_alignment`/`restore_shape_rotation` 复用 setShape* before-image 范式；`delete_shape_by_id`/`delete_slide_by_index` 复用定位范式）。
- `src/agent/operationLog.ts`（14.8KB）— `DocumentAdapterForReplay` 接口（加 15 个新方法声明）+ `executeReverse` switch（加 15 个 case，noop_inverse 已存在）+ `PostStateSnapshot.kind` union（按需扩，D-21）+ `readTargetState`/`isTargetStateConsistent`（新 kind 走保守 undefined）。
- `src/agent/tools/write/excel.ts`（6.4KB）+ `src/agent/tools/write/ppt.ts`（11.3KB）— 已有 ToolDef 范式（reverse descriptor 字面量 + postState + humanLabel）。新增工具照此范式（reverse.args 必 Record 对象）。
- `src/agent/operationLog.integration.test.ts`（14KB）— D-19 守门测试范式：真 `ExcelAdapter`/`PptAdapter` 实例 + `replayUndoSingle` 断言 `rolled_back` + 收 Record 对象。每个简单逆向/快照工具加一条；noop+gate 工具加「→ skipped_error」断言。
- `src/agent/contract.test.ts` — 18 行 integrationTest false→true（D-19）。
- `src/agent/tools/index.ts` — `buildToolsForHost('excel')` / `buildToolsForHost('ppt')` 注册新工具（host 隔离已保证 Excel/PPT 工具不互见）。

### Established Patterns
- adapter 方法在 `Excel.run` / `PowerPoint.run` 闭包内、输入输出纯数据（A-06）；proxy 不出闭包；错误包 `HostApiError`（构造器不存 hostError，防 stack 泄漏）。
- inverse/snapshot 收 Record 对象；before-image 写前读、存 reverse.args。
- 快照式：写前 `readXxxSnapshot()` → 存 reverse.args.snapshot → executeReverse 覆写还原（Word find_and_replace 已示范）。
- noop+gate：reverse `{ tool:'noop_inverse', args:{reason} }` → executeReverse throw → skipped_error → DiffLog「此步无法自动撤销」（CR-04 已示范）。
- 定位防漂移：先 index/ID 快路径，不匹配降级内容指纹遍历（`deleteSlideByTitle`/`restoreParagraphAt` 已示范）。
- PPT 形状操作前 `TEXT_SHAPE_TYPES` fail-closed 守门；addTextBox 前 deselect（#2775）。

### Integration Points
- 改：`ExcelAdapter.ts`（10 写方法 + 9 inverse/snapshot）、`PptAdapter.ts`（8 写方法 + 6 inverse）、`operationLog.ts`（接口 +15 + executeReverse +15 case + kind）、`contract.test.ts`（18 行 integrationTest→true）、`operationLog.integration.test.ts`（≥18 守门用例，含共享快照双守门 D-20 + noop+gate 三守门）、`CONTRACT.md`（18 行 status→done）、`tools/index.ts`（注册）。
- 改：`tools/write/excel.ts`（+10 ToolDef）、`tools/write/ppt.ts`（+8 ToolDef）。
- 可能改：`ExcelAdapter.test.ts` / `ExcelAdapter.read.test.ts` / `PptAdapter.test.ts`（新工具单测）、`tools/write/excel.test.ts` / `tools/write/ppt.test.ts`。
</code_context>

<specifics>
## Specific Ideas

ROADMAP Phase 10 五条成功标准（反推 must_haves，planner 须逐条覆盖）：
1. 「把 A1:D10 数字格式改千分位+2 位小数 + 填黄底」→ `format_excel_range` 单工具调用（参数化包数字格式+填充），undo 后格式还原。
2. 「按 B 列降序排序 500 行表」→ 改动卡显示 sort 操作 + undo 后行顺序完整还原（`sort_range` 快照 undo 生效）。
3. 「当前幻灯片插入文本框写『季度总结』」→ undo 后文本框消失（`add_shape` 简单逆向 + addTextBox 已绕 #2775）。
4. 「调用 delete_shape / manage_slides(delete)」→ DiffLogPanel 显示「此操作不可自动撤销」warn 但 agent 不中断（noop+gate 正确）。
5. Spikes S1/S2/S4 结论已记录：`rotate_shape` / `set_slide_background` / `set_shape_text_alignment` 各采用简单逆向或运行时降级 noop+gate；每个新 inverse 有 `operationLog.integration.test` 守门；bundle ≤82 KB。
</specifics>

<deferred>
## Deferred Ideas

- **`merge_cells`（EXCEL-D1）/ `remove_duplicates`（EXCEL-D2）/ `create_pivot_table`（EXCEL-D3）** → v2.2（快照式 undo 代价大 / H 复杂度；D-19 已锁）。
- **`delete_worksheet`（整表删除）** → Out of Scope，**永久不做**（整表永久丢失、Office.js 不支持 undo；用户决定不暴露）。`manage_worksheet` 的 delete operation 因此移除（G-B D-03）。
- **`manage_worksheet` 的 copy operation** → v2.1 不做（非 EXCEL-09 需求、Worksheet.copy 清空撤销栈）；若需要另立 v2.2。
- **`manage_slides` 的 reorder operation** → v2.1 不做（非 ROADMAP/REQUIREMENTS 需求；reorder 技术可逆但与 noop+gate 声明不自洽，需单独设计简单逆向）。
- **PPT `set_shape_fill_advanced`（渐变/图片填充）/ `add_line`（PPT-D1）** → v2.2（渐变状态读回不确定，spike）。
- **`insert_table_ppt`（PPT-D2，spike S3 门控）** → v2.2（PowerPointApi 1.8 Web 支持待验）。
- **PPT 动画 / 转场 / SmartArt / 套主题模板 / 读背景色主题色** → Out of Scope，平台无 API（issue #6185）。

### Reviewed Todos (not folded)
- `builtin-model-dropdown.md`（DeepSeek + AiHubMix 内置 model 下拉）—— score 0.4 但仅命中关键词「phase」的误匹配，属 Provider/model 配置范畴，与 Phase 10 Excel/PPT 写工具无关。**不纳入本阶段**（与 08/09-CONTEXT 同结论）。
</deferred>

---

*Phase: 10-excel-ppt-b-excel-b-ppt*
*Context gathered: 2026-05-31*
</content>
</invoke>
