# Aster v2.1 能力合约表

**Phase:** 8 定义地基（Phase 9/10/11 实现时逐行更新 status + integrationTest）
**D-16/D-17：** 人读合约表 + contract.test.ts CI 守门双保险
**D-18：** 参数化合并设计原则（工具更少更清晰 → AI 选工具更准）；不设 toolDefs token CI gate
**D-19：** B 工具裁剪沿用已锁结论：merge_cells/create_pivot_table → v2.2；delete_worksheet 不做；delete_shape/delete_slide = noop+gate

## Undo 三分类说明

| 分类 | 判定标准 | 实现模式 |
|------|----------|---------|
| 简单逆向 | 写前可读原值；写后可精确还原 | before-image + restore_* adapter；reverse.args = Record 对象（非位置参） |
| 快照式 | 批量覆盖原数据（sort/find_replace）；必须先 readXxxSnapshot | 写前 adapter.readSnapshot() → 存 reverse.args.snapshot；executeReverse restore_xxx_snapshot |
| noop+gate | 状态无法序列化（delete_shape/delete_slide）或规模超上限 | noop_inverse case 抛 Error；DiffLog 显示"此步无法自动撤销"；warn 不中断 agent |

## Phase 9 Word 工具（D + B-Word）

| tool_name | host | parameters 摘要 | undo_type | reverse_tool | integration_test | phase | status |
|-----------|------|----------------|-----------|--------------|-----------------|-------|--------|
| set_word_character_format | word | paragraphIndex, uniqueLocalId?, font{bold,italic,size,color} | 简单逆向 | restore_range_font | false | 9 | planned |
| set_word_paragraph_format | word | paragraphIndex, uniqueLocalId?, format{lineSpacing,spaceBefore,spaceAfter,alignment} | 简单逆向 | restore_paragraph_format | false | 9 | planned |
| apply_paragraph_style | word | paragraphIndex, uniqueLocalId?, styleName(Word.BuiltInStyleName) | 简单逆向 | restore_paragraph_style | false | 9 | planned |
| find_and_replace | word | searchText, replaceText, matchCase?, matchWholeWord? | 快照式 | restore_range_snapshot | false | 9 | planned |
| insert_table | word | rows, cols, afterParagraphIndex?, content[][]? | 简单逆向 | delete_table_by_marker | false | 9 | planned |

## Phase 10 Excel 工具（B-Excel）

| tool_name | host | parameters 摘要 | undo_type | reverse_tool | integration_test | phase | status |
|-----------|------|----------------|-----------|--------------|-----------------|-------|--------|
| format_excel_range | excel | address, numberFormat?, fill{color}?, font{bold,color,size}? | 简单逆向 | restore_range_format | false | 10 | planned |
| set_column_row_size | excel | target(column/row), indices[], size(number/autoFit) | 简单逆向 | restore_column_row_size | false | 10 | planned |
| sort_range | excel | address, key{column,ascending}[] | 快照式 | restore_range_values_snapshot | false | 10 | planned |
| set_auto_filter | excel | address, enabled, criteria?[] | 简单逆向 | restore_auto_filter | false | 10 | planned |
| excel_find_and_replace | excel | searchText, replaceText, address?, matchCase? | 快照式 | restore_range_values_snapshot | false | 10 | planned |
| add_conditional_format | excel | address, rule{type,operator,value,format} | 简单逆向 | restore_conditional_format | false | 10 | planned |
| create_table | excel | address, hasHeaders?, tableName? | 简单逆向 | delete_table_by_name | false | 10 | planned |
| freeze_panes | excel | freezeRows, freezeColumns | 简单逆向 | restore_freeze_panes | false | 10 | planned |
| manage_worksheet | excel | operation(rename/add), sheetName, newName? | 快照式 | restore_worksheet_snapshot | false | 10 | planned |
| set_chart_title | excel | chartName, title | 简单逆向 | restore_chart_title | false | 10 | planned |

## Phase 10 PPT 工具（B-PPT）

| tool_name | host | parameters 摘要 | undo_type | reverse_tool | integration_test | phase | status |
|-----------|------|----------------|-----------|--------------|-----------------|-------|--------|
| set_shape_text_font | ppt | slideIndex, shapeId, font{size,bold,italic,color} | 简单逆向 | restore_shape_font | false | 10 | planned |
| set_shape_text_alignment | ppt | slideIndex, shapeId, alignment(left/center/right/justify) | 简单逆向 | restore_shape_alignment | false | 10 | planned |
| add_shape | ppt | slideIndex, shapeType, position{left,top,width,height}, text? | 简单逆向 | delete_shape_by_id | false | 10 | planned |
| delete_shape | ppt | slideIndex, shapeId | noop+gate | noop_inverse | false | 10 | planned |
| rotate_shape | ppt | slideIndex, shapeId, rotation(degrees) | 简单逆向 | restore_shape_rotation | false | 10 | planned |
| set_slide_background | ppt | slideIndex, color(hex) | 简单逆向 | restore_slide_background | false | 10 | planned |
| manage_slides | ppt | operation(delete/reorder), slideIndex, targetIndex? | noop+gate | noop_inverse | false | 10 | planned |
| copy_slide | ppt | sourceIndex, targetIndex | 简单逆向 | delete_slide_by_index | false | 10 | planned |

## 参数化合并设计原则（STRAP，D-18）

工具数量精简原则：同类操作合并为一个 tool + operation 枚举（非省 token，是"工具更少更清晰 → AI 选工具更准"）。

| 合并示例 | 合并前 | 合并后 |
|----------|--------|--------|
| Excel 格式化 | set_number_format + set_fill_color + set_font_bold | format_excel_range(address, {numberFormat, fill, font}) |
| PPT 形状字体 | set_font_size + set_font_bold + set_font_color | set_shape_text_font(slideIndex, shapeId, {size, bold, color}) |
| Excel 工作表管理 | add_worksheet + rename_worksheet | manage_worksheet(operation, sheetName, newName?) |
| PPT 幻灯片管理 | delete_slide + reorder_slide | manage_slides(operation, slideIndex, targetIndex?) |

## v2.2 Defer 清单（D-19 已锁结论）

以下工具不在 v2.1 范围，Phase 8-11 不实现：

| tool_name | 原因 |
|-----------|------|
| merge_cells | 操作不可逆（unmerge 无法还原原格式），defer v2.2 |
| create_pivot_table | Spike S3 失败则 defer；API 复杂度高 |
| remove_duplicates | 快照式 undo 代价大，defer v2.2 |
| delete_worksheet | noop+gate 行为与 delete_shape 同类，用户明确不做 |

## 使用说明（Phase 9/10/11 实现时）

每个工具实现完成后，更新本表对应行：
1. `status`: planned → done
2. `integration_test`: false → true
3. 同时在 `src/agent/contract.test.ts` 对应行改 `integrationTest: false → true`
4. 同时在 `src/agent/operationLog.integration.test.ts` 追加守门测试

**D-17 硬卡：** 步骤 3 + 4 缺一不可，否则 CI 挂。reverse.args 必须是 Record 对象（非位置参），否则真机 undo 全挂（Phase 5 教训）。
