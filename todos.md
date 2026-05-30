# 系统 Prompt 调整
* [ ] 从能用到好用，应该让 Aster 专注于功能，而且最好是 Excel, Word, PPT 都有各自的一套特定的设定，甚至是我们应该调研一些对应 PPT，Excel，Word 的 Skills 之类的来丰富 Agent 的能力，下面是一些可参考的 SKill，里面应该有一些是用了 Python 的能力，我们只需要参考他们怎么设计 PPT，Word，Excel 的部分，不需要脚本部分
    * [ ] PPT： https://www.skills.sh/daymade/claude-code-skills/ppt-creator
    * [ ] PPT：https://github.com/anthropics/skills/blob/main/skills/pptx/SKILL.md
    * [ ] PPT: https://mcpmarket.com/zh/tools/skills/gemini-ppt-slide-optimizer
    * [ ] Excel： https://www.skills.sh/davila7/claude-code-templates/excel-analysis
    * [ ] Word： https://www.skills.sh/shubhamsaboo/awesome-llm-apps/content-writer


# 优化
* [ ] 目前 Tool 操作效率有点低，应该需要支持批量修改，不然工具卡片太多，同时操作效率太低


# Word 优化
* [] 目前选择文本 tool 当前给的数据中只有文本内容和长度，没有坐标信息，如果出现多个相同文本容易改错


# UI 相关
* [ ] AI 回复的 Markdown 格式问题表格没有边框，进行一版整体 Markdown 优化
* [ ] 读取的工具卡太过打扰，UI 做得更轻一些，不要边框，占用位置需要更小
* [ ] 首屏加载添加骨架屏
* [ ] 消息发出后应该 AI 现有有个 loading 气泡，不然目前有点不知道 AI 是否在继续
* [ ] “本次改动“卡片一直沉底，不会跟着当次的 loop 进行聊天记录，如果有多次 loop，那么就都会沉在底部


# AIHubMix 的 Setting 设置不对
* [ ] AIHubMix 应该是有个多模态模型和生图模型，参考设计稿
* [ ] AIHubMix 默认模型支持：多模态默认支持 gpt-5.2, 生图模型支持 gpt-image-2 及 gemini-3.1-flash-image-preview


# 聊天记录
* [ ] 支持聊天记录，存放在 localstorage
* [ ] 调研分文档存储，不一定支持，支持清空，如果不支持分文档就全局统一存放在 localstorage 支持清空就行
* [ ] 传递给 LLM 的聊天记录上下文最多存 30 轮


# 新增偏好
* [ ] 支持用户自定义定制偏好，无需每次聊天都重复输入


# ============================================================
# Office.js 修改能力补全（把官方所有"改"方法暴露成 LLM tool）
# 格式：* [ ] `建议tool名` 中文说明（对应 Office.js API）
# 标 ❌ = Office.js 平台本身不支持，建不了，仅列出供决策
# 待 Wynne review，不要的直接删
# ============================================================


# Office.js 补全 · Word —— 字体/字符格式（range.font，目前完全没有）
* [ ] `set_font_bold` 加粗/取消加粗（font.bold）
* [ ] `set_font_italic` 斜体（font.italic）
* [ ] `set_font_underline` 下划线，含类型（font.underline / Word.UnderlineType）
* [ ] `set_font_strikethrough` 删除线（font.strikeThrough / doubleStrikeThrough）
* [ ] `set_font_size` 字号（font.size，points）
* [ ] `set_font_name` 字体名，如「微软雅黑」「Times New Roman」（font.name）
* [ ] `set_font_color` 字体颜色 #RRGGBB（font.color）
* [ ] `set_font_highlight` 文字高亮色（font.highlightColor）
* [ ] `set_font_super_subscript` 上标/下标（font.superscript / subscript）

# Office.js 补全 · Word —— 段落格式（paragraph / paragraphFormat）
* [ ] `set_paragraph_alignment` 对齐：左/居中/右/两端对齐（paragraph.alignment，Word.Alignment）← 你点名的痛点
* [ ] `set_line_spacing` 行距（paragraph.lineSpacing）
* [ ] `set_paragraph_spacing` 段前距/段后距（spaceBefore / spaceAfter）
* [ ] `set_paragraph_indent` 左/右/首行缩进（leftIndent / rightIndent / firstLineIndent）
* [ ] `set_paragraph_keep` 与下段同页/段中不分页（keepWithNext / keepTogether）

# Office.js 补全 · Word —— 样式（styleBuiltIn / style）
* [ ] `apply_paragraph_style` 套内置样式：标题1-9/标题/副标题/正文/引用（paragraph.styleBuiltIn）← 你点名的痛点
* [ ] `apply_named_style` 套文档里的自定义命名样式（paragraph.style）
* [ ] `modify_named_style` 修改某个命名样式的字体/段落属性（getStyles().getByNameOrNullObject）

# Office.js 补全 · Word —— 列表
* [ ] `make_bulleted_list` 把若干段转成项目符号列表（startNewList / list API）
* [ ] `make_numbered_list` 转成编号列表
* [ ] `set_list_level` 调整列表层级/缩进

# Office.js 补全 · Word —— 结构与对象
* [ ] `insert_table` 插入表格并填内容（body.insertTable）
* [ ] `edit_table` 表格行列增删/单元格合并/套表格样式（Word.Table API）
* [ ] `insert_image` 插入图片，base64（insertInlinePictureFromBase64）
* [ ] `insert_break` 插入分页/分节/换行符（insertBreak）
* [ ] `insert_hyperlink` 给文字加超链接（range.hyperlink）
* [ ] `find_and_replace` 全文查找替换（body.search + insertText/replace）

# Office.js 补全 · Word —— 文档级
* [ ] `set_header_footer` 设置页眉/页脚文字（section.getHeader/getFooter）
* [ ] `insert_comment` 插入批注（range.insertComment）
* [ ] `toggle_track_changes` 开/关修订（document.changeTrackingMode）
* [ ] ❌ 页边距/纸张方向/纸张大小 —— Word JS API 对 pageSetup 支持极弱，基本拿不到


# Office.js 补全 · Excel —— 单元格格式（range.format，目前完全没有）
* [ ] `set_number_format` 数字格式：货币/百分比/日期/千分位（range.numberFormat）
* [ ] `set_cell_font` 单元格字体名/字号/加粗/斜体/颜色（format.font）
* [ ] `set_cell_fill` 单元格背景填充色（format.fill.color）
* [ ] `set_cell_borders` 边框（format.borders）
* [ ] `set_cell_alignment` 水平/垂直对齐、自动换行（horizontalAlignment / verticalAlignment / wrapText）
* [ ] `merge_cells` 合并/取消合并单元格（range.merge / unmerge）
* [ ] `set_column_row_size` 列宽/行高/自动适应（columnWidth / rowHeight / autofitColumns）

# Office.js 补全 · Excel —— 数据操作
* [ ] `sort_range` 按列排序（range.sort.apply）
* [ ] `apply_filter` 自动筛选/按条件筛选（worksheet.autoFilter / table filters）
* [ ] `remove_duplicates` 删除重复行（range.removeDuplicates）
* [ ] `find_and_replace_excel` 查找替换（worksheet/range replace）
* [ ] `clear_range` 清除内容/格式/全部（range.clear）
* [ ] `insert_delete_cells` 插入/删除行列或单元格（insert / delete + shift）

# Office.js 补全 · Excel —— 结构对象
* [ ] `create_table` 把区域建成表格（worksheet.tables.add）
* [ ] `edit_table_excel` 表格加行/列、汇总行、套表格样式
* [ ] `create_pivot_table` 创建数据透视表（worksheet.pivotTables.add）
* [ ] `add_conditional_format` 条件格式：色阶/数据条/高亮规则（conditionalFormats.add）
* [ ] `add_data_validation` 数据验证：下拉列表/范围限制（range.dataValidation）
* [ ] `define_named_range` 定义命名区域（names.add）
* [ ] `freeze_panes` 冻结首行/首列/指定窗格（worksheet.freezePanes）

# Office.js 补全 · Excel —— 工作表/工作簿
* [ ] `add_worksheet` 新增工作表（worksheets.add）
* [ ] `delete_worksheet` 删除工作表
* [ ] `rename_worksheet` 重命名工作表
* [ ] `set_sheet_tab_color` 设置标签页颜色 / 显示隐藏

# Office.js 补全 · Excel —— 图表深化（现有 insert_chart 太浅）
* [ ] `set_chart_title` 改图表标题（chart.title）
* [ ] `set_chart_axes` 坐标轴标题/范围/刻度（chart.axes）
* [ ] `set_chart_legend` 图例显示/位置（chart.legend）
* [ ] `set_chart_series_color` 数据系列颜色/数据标签（series.format / dataLabels）
* [ ] `change_chart_type` 改图表类型（chart.chartType）


# Office.js 补全 · PPT —— 形状内文字格式（textFrame.textRange.font，现在只能改文字内容）
* [ ] `set_shape_text_font` 形状文字的字体名/字号/颜色/加粗/斜体/下划线（textRange.font）
* [ ] `set_shape_text_alignment` 形状文字段落对齐（textRange paragraphFormat，注：PPT API 支持有限，需实测）

# Office.js 补全 · PPT —— 形状操作（现有只有改属性/移动/改字）
* [ ] `add_shape` 新增几何形状（slide.shapes.addGeometricShape）
* [ ] `add_text_box` 新增文本框（shapes.addTextBox）
* [ ] `add_line` 新增线条/箭头（shapes.addLine）
* [ ] `add_image` 插入图片，base64（shapes.addImageFromBase64 — 配合生图模型很有价值）
* [ ] `delete_shape` 删除形状（shape.delete，正向能力当前缺失）
* [ ] `rotate_shape` 旋转形状（shape.rotation）
* [ ] `set_shape_fill_advanced` 渐变/图片填充（现仅纯色 setSolidColor）

# Office.js 补全 · PPT —— 幻灯片级
* [ ] `delete_slide` 正向删除幻灯片（adapter 已有 deleteSlideByTitle，仅当撤销用，没暴露成正向 tool）
* [ ] `duplicate_slide` 复制幻灯片 / 重排顺序
* [ ] `set_slide_background` 设置幻灯片背景填充色（1.10 background，纯色可行）← 你点名的「换背景」部分可做
* [ ] `insert_table_ppt` 插入/编辑表格（1.8/1.9 table API）
* [ ] `insert_hyperlink_ppt` 形状/文字加超链接
* [ ] `insert_slides_from_template` 从另一个 .pptx 插入幻灯片（insertSlidesFromBase64，可近似"套模板"）

# Office.js 补全 · PPT —— ❌ Office.js 平台不支持（建不了，列出供决策）
* [ ] ❌ 动画效果 animation —— 官方 API 完全无此接口 ← 你点名的「动画」，做不了
* [ ] ❌ 切换/转场效果 transition —— 无 API
* [ ] ❌ SmartArt —— 无 API
* [ ] ❌ 套用主题/模板 theme —— 无 API（issue #6185 仍是 feature request）
* [ ] ❌ 读取背景色/主题色 —— 无文档化 API（只能写背景，不能可靠读）