<!-- ============================================================
本文件结构（2026-06-03 重排，v2.2 SHIPPED 后）：
顶层按「实装状态」分三大块 → 块内按功能区 / 宿主分组。
  ✅ 已实装    = 已核对 src/agent/tools/ 实际 ToolDef 注册表确认；行尾标对应 tool / Phase
  🟡 部分实装  = 底层能力已实装但未单列为通用 tool（如 base64 插图复用于生图/图库），或平台受限只能半做
  ⬜ 未实装    = 还没做 / 刻意未做（行尾注明原因）；含两大块未来规划（上下文缓存、PPT 视觉质量）

标记依据 = src/agent/tools/ 实际 ToolDef name + 合并工具参数覆盖核对（非凭印象）。
合并工具：Word set_word_character_format（粗/斜/下划线/字号/字体/色）、set_word_paragraph_format（对齐/行距/段距/缩进）；
Excel format_excel_range（数字格式/字体/填充/对齐）、manage_worksheet（add/rename）。
============================================================ -->


# ✅ 已实装

## 优化 / Word 选区 / UI / 聊天 / 偏好（v2.1 Phase 8-12）
* [x] 批量修改 Tool：操作效率低 / 工具卡太多 → 批量 ✅ 已实装（batch_write 单闭包单 sync + 可展开批量卡，v2.1 Phase 11）
* [x] 选区精度：选择文本 tool 给坐标信息，避免多个相同文本改错 ✅ 已实装（WSEL-01：paragraphIndex + uniqueLocalId 消歧，v2.1 Phase 9）
* [x] AI 回复 Markdown 整体优化（表格无边框等） ✅ 已实装（表格 CSS + XSS 防御，v2.1 Phase 12）
* [x] 读取工具卡降权：UI 更轻、无边框、占位更小 ✅ 已实装（读卡降权，v2.1 Phase 12）
* [x] 首屏加载骨架屏 ✅ 已实装（骨架屏，v2.1 Phase 12）
* [x] 消息发出后 AI loading 气泡（知道 AI 在继续） ✅ 已实装（loading 气泡，v2.1 Phase 12）
* [x] 「本次改动」卡片跟随当次 loop，不再永远沉底 ✅ 已实装（DiffLog 跟随 loop，v2.1 Phase 12）

## AIHubMix 多模态 + 生图模型设置（v2.2 Phase 14 MDL）
* [x] AIHubMix 区分多模态模型与生图模型，参考设计稿 ✅ 已实装（aihubmix-vision + 三生图 model 三路解析重写）
* [x] 默认模型支持 ✅ 已实装 ⚠️ 实装默认与原 todo 不同：多模态=gpt-5.4、生图默认=doubao-seedream-5.0-lite（gpt-image-2 / gemini-3.1-flash-image-preview 均在清单可选）

## 聊天记录（v2.1 Phase 8）
* [x] 支持聊天记录，存 localStorage ✅ 已实装（持久化 F）
* [x] 调研分文档存储：不支持则全局统一存 localStorage + 支持清空 ✅ 已实装（全局 localStorage + 支持清空；未做分文档，按 todo 兜底方案）
* [x] 传给 LLM 的上下文最多 20 轮，tool 不计入轮次 ✅ 已实装（truncateTo20Turns，tool 不计轮次，v2.1）

## 新增偏好（v2.1 Phase 8）
* [x] 用户自定义偏好注入 prompt，无需每次聊天重复输入 ✅ 已实装（用户偏好注入 + injection 防御）

## Office.js · Word —— 字符/字符格式
# ✅ 已合并为 set_word_character_format（v2.1 Phase 9）：bold/italic/underline/size/name/color
* [x] `set_font_bold` 加粗/取消加粗（font.bold）✅ set_word_character_format.bold
* [x] `set_font_italic` 斜体（font.italic）✅ set_word_character_format.italic
* [x] `set_font_underline` 下划线，含类型（font.underline / Word.UnderlineType）✅ set_word_character_format.underline
* [x] `set_font_size` 字号（font.size，points）✅ set_word_character_format.size
* [x] `set_font_name` 字体名，如「微软雅黑」「Times New Roman」（font.name）✅ set_word_character_format.name
* [x] `set_font_color` 字体颜色 #RRGGBB（font.color）✅ set_word_character_format.color

## Office.js · Word —— 段落格式
# ✅ 已合并为 set_word_paragraph_format（v2.1 Phase 9）：alignment/lineSpacing/spaceBefore/spaceAfter/indent/leftIndent
* [x] `set_paragraph_alignment` 对齐：左/居中/右/两端（paragraph.alignment）← 点名痛点 ✅ set_word_paragraph_format.alignment
* [x] `set_line_spacing` 行距（paragraph.lineSpacing）✅ set_word_paragraph_format.lineSpacing
* [x] `set_paragraph_spacing` 段前距/段后距（spaceBefore / spaceAfter）✅ set_word_paragraph_format.spaceBefore/spaceAfter
* [x] `set_paragraph_indent` 左/右/首行缩进（leftIndent / rightIndent / firstLineIndent）✅ set_word_paragraph_format.indent/leftIndent

## Office.js · Word —— 样式 / 结构
* [x] `apply_paragraph_style` 套内置样式：标题1-9/标题/副标题/正文/引用 ← 点名痛点 ✅ 已实装（apply_paragraph_style，v2.1 Phase 9）
* [x] `insert_table` 插入表格并填内容（body.insertTable）✅ 已实装（insert_table）
* [x] `find_and_replace` 全文查找替换（body.search + insertText/replace）✅ 已实装（find_and_replace）

## Office.js · Excel —— 单元格格式
# ✅ 多数已合并为 format_excel_range（v2.1 Phase 10）：numberFormat/font(bold/color/size)/fill/alignment
* [x] `set_number_format` 数字格式：货币/百分比/日期/千分位（range.numberFormat）✅ format_excel_range.numberFormat
* [x] `set_cell_font` 字体名/字号/加粗/斜体/颜色（format.font）✅ format_excel_range.font（bold/color/size）
* [x] `set_cell_fill` 背景填充色（format.fill.color）✅ format_excel_range.fill
* [x] `set_cell_alignment` 水平/垂直对齐、自动换行 ✅ format_excel_range.alignment（水平；垂直/wrapText 待补，见未实装）
* [x] `set_column_row_size` 列宽/行高/自动适应 ✅ 已实装（set_column_row_size）

## Office.js · Excel —— 数据操作
* [x] `sort_range` 按列排序（range.sort.apply）✅ 已实装（sort_range）
* [x] `apply_filter` 自动筛选/按条件筛选 ✅ 已实装（set_auto_filter）
* [x] `find_and_replace_excel` 查找替换 ✅ 已实装（excel_find_and_replace）

## Office.js · Excel —— 结构对象
* [x] `create_table` 把区域建成表格（worksheet.tables.add）✅ 已实装（create_table）
* [x] `add_conditional_format` 条件格式：色阶/数据条/高亮规则 ✅ 已实装（add_conditional_format）
* [x] `freeze_panes` 冻结首行/首列/指定窗格 ✅ 已实装（freeze_panes）

## Office.js · Excel —— 工作表 / 图表
# ✅ add/rename 已合并为 manage_worksheet（v2.1 Phase 10）；delete 因不可逆刻意排除（见未实装）
* [x] `add_worksheet` 新增工作表（worksheets.add）✅ manage_worksheet(operation=add)
* [x] `rename_worksheet` 重命名工作表 ✅ manage_worksheet(operation=rename)
* [x] `set_chart_title` 改图表标题（chart.title）✅ 已实装（set_chart_title）

## Office.js · PPT —— 形状文字 / 形状操作
* [x] `set_shape_text_font` 形状文字字体名/字号/颜色/加粗/斜体/下划线 ✅ 已实装（set_shape_text_font）
* [x] `set_shape_text_alignment` 形状文字段落对齐（PPT API 支持有限，已实测）✅ 已实装（set_shape_text_alignment）
* [x] `add_shape` 新增几何形状（slide.shapes.addGeometricShape）✅ 已实装（add_shape）
* [x] `delete_shape` 删除形状（shape.delete）✅ 已实装（delete_shape）
* [x] `rotate_shape` 旋转形状（shape.rotation）✅ 已实装（rotate_shape）

## Office.js · PPT —— 幻灯片级
* [x] `delete_slide` 正向删除幻灯片 ✅ 已实装（manage_slides operation=delete，正向 tool；不可自动撤销）
* [x] `set_slide_background` 设置幻灯片背景填充色（纯色）← 点名「换背景」部分可做 ✅ 已实装（set_slide_background）

## v2.2 三块「孤儿能力」（2026-05-30 补记，v2.2 落地）
* [x] **视觉 / 看图（FUT-14）** — `aihubmix-vision.ts` 客户端 + registry `taskKind='vision'`，让 agent 能「看」选中的图/图表当 evidence ✅ 已实装（v2.2 Phase 15 VIS：get_shape_image read tool + 回形针/粘贴上传图 + aihubmix-vision；PPT 取图 Web 不支持→诚实引导上传。决策：直接用 aihubmix-vision，不验 DeepSeek 原生多模态）
* [x] **文件上传与解析（FUT-15）** — chat 附件上传 docx/xlsx/pdf/pptx/图片 → 懒加载解析（mammoth/SheetJS/pdfjs）作 agent context ✅ 已实装（v2.2 Phase 17 FILE：docx/xlsx/pdf/pptx + txt/md/csv/json 懒加载解析、附件本会话多轮复用、图文混传、chip「仅供 AI 阅读」边界。图片附件 FILE-06 前移 Phase 15。⚠️ pdf.js worker CSP 真机 = Phase 19 已 PASS）
* [x] **图片生成并插入（FUT-16）** — 「生成图 → 插入 PPT/Word」write tool（含 reverse + humanLabel）✅ 已实装（v2.2 Phase 16 IMG：generate_ppt_image/generate_word_image，AI loop 内自动直插+只读结果卡+可切 model；model 已对齐 Phase 14。底层 base64 插入 addImageShape/insertBodyImage 即此条「同一条线」）


# ============================================================


# 🟡 部分实装（底层有 / 未单列通用 tool / 平台受限）

* [~] `insert_image`（Word）插入图片 base64（insertInlinePictureFromBase64）— 底层能力已实装（WordAdapter.insertBodyImage，被 generate_word_image / search_and_insert_stock_image 复用，v2.2 Phase 16/18）；未单列为通用「插任意 base64 图」tool
* [~] `add_image`（PPT）插入图片 base64（shapes.addImageFromBase64）— 底层能力已实装（PptAdapter.addImageShape，被 generate_ppt_image / search_and_insert_stock_image 复用，v2.2 Phase 16/18）；未单列为通用「插任意 base64 图」tool
* [~] `duplicate_slide` 复制幻灯片 / 重排顺序 — copy_slide tool 已建（v2.1 Phase 10），但⚠️网页版微软 Slide.copy() 天生不支持→诚实失败（转桌面版）；重排顺序未做


# ============================================================


# ⬜ 未实装

# Web search 能力
* [ ] 新增 Web Search 能力，接入 https://www.tavily.com/ 的 SDK 或者 API
* [ ] 随着配置越来越多了，所以需要一个配置导入导出功能，尤其是 API key 之类的，快速给用户适配到不同的电脑或者 App

* [ ] 生图模型切换与 AIHubMix 设置割裂（一个在 Provider 设置、一个在 Setting 外）⚠️ 部分：v2.2 Phase 16 已加 Settings 生图 model picker；但「与 Provider 设置割裂」的统一仍待确认（保留）
* [ ] 新增“快捷指令“功能，类似于用户可以自定义一串 prompt，这串 prompt 可能是一个经常性的重复逻辑操作，存起来后，后续可以在 Aster 输入框上快速选择对应的快捷指令

# 说明：以下 Office.js「改」方法待 Wynne review，不要的直接删。
# 标 ❌ = Office.js 平台本身不支持，建不了，仅列出供决策。

## Office.js · Word —— 字符格式（待补）
* [ ] `set_font_strikethrough` 删除线（font.strikeThrough / doubleStrikeThrough）— 未覆盖（合并工具暂无删除线）
* [ ] `set_font_highlight` 文字高亮色（font.highlightColor）— 未覆盖
* [ ] `set_font_super_subscript` 上标/下标（font.superscript / subscript）— 未覆盖

## Office.js · Word —— 段落格式（待补）
* [ ] `set_paragraph_keep` 与下段同页/段中不分页（keepWithNext / keepTogether）— 未覆盖

## Office.js · Word —— 样式（待补）
* [ ] `apply_named_style` 套文档里的自定义命名样式（paragraph.style）— 未实装
* [ ] `modify_named_style` 修改某个命名样式的字体/段落属性（getStyles().getByNameOrNullObject）— 未实装

## Office.js · Word —— 列表
* [ ] `make_bulleted_list` 把若干段转成项目符号列表（startNewList / list API）
* [ ] `make_numbered_list` 转成编号列表
* [ ] `set_list_level` 调整列表层级/缩进

## Office.js · Word —— 结构与对象
* [ ] `edit_table` 表格行列增删/单元格合并/套表格样式（Word.Table API）— 未实装
* [ ] `insert_break` 插入分页/分节/换行符（insertBreak）— 未实装
* [ ] `insert_hyperlink` 给文字加超链接（range.hyperlink）— 未实装

## Office.js · Word —— 文档级
* [ ] `set_header_footer` 设置页眉/页脚文字（section.getHeader/getFooter）
* [ ] `insert_comment` 插入批注（range.insertComment）
* [ ] `toggle_track_changes` 开/关修订（document.changeTrackingMode）
* [ ] ❌ 页边距/纸张方向/纸张大小 —— Word JS API 对 pageSetup 支持极弱，基本拿不到

## Office.js · Excel —— 单元格格式（待补）
* [ ] `set_cell_borders` 边框（format.borders）— 未覆盖（format_excel_range 暂无边框）
* [ ] `set_cell_alignment` 垂直对齐 / 自动换行（verticalAlignment / wrapText）— format_excel_range 仅覆盖水平，垂直/wrapText 待补
* [ ] `merge_cells` 合并/取消合并单元格（range.merge / unmerge）— 未实装

## Office.js · Excel —— 数据操作（待补）
* [ ] `remove_duplicates` 删除重复行（range.removeDuplicates）— 未实装
* [ ] `clear_range` 清除内容/格式/全部（range.clear）— 未实装
* [ ] `insert_delete_cells` 插入/删除行列或单元格（insert / delete + shift）— 未实装

## Office.js · Excel —— 结构对象（待补）
* [ ] `edit_table_excel` 表格加行/列、汇总行、套表格样式 — 未实装
* [ ] `create_pivot_table` 创建数据透视表（worksheet.pivotTables.add）— 未实装
* [ ] `add_data_validation` 数据验证：下拉列表/范围限制（range.dataValidation）— 未实装
* [ ] `define_named_range` 定义命名区域（names.add）— 未实装

## Office.js · Excel —— 工作表/工作簿（待补）
* [ ] `delete_worksheet` 删除工作表 — 刻意未做（不可逆操作，manage_worksheet 明确排除 delete）
* [ ] `set_sheet_tab_color` 设置标签页颜色 / 显示隐藏 — 未实装

## Office.js · Excel —— 图表深化（现有 insert_chart 太浅）
* [ ] `set_chart_axes` 坐标轴标题/范围/刻度（chart.axes）— 未实装
* [ ] `set_chart_legend` 图例显示/位置（chart.legend）— 未实装
* [ ] `set_chart_series_color` 数据系列颜色/数据标签（series.format / dataLabels）— 未实装
* [ ] `change_chart_type` 改图表类型（chart.chartType）— 未实装

## Office.js · PPT —— 形状操作（待补）
* [ ] `add_text_box` 新增文本框（shapes.addTextBox）— 未实装
* [ ] `add_line` 新增线条/箭头（shapes.addLine）— 未实装
* [ ] `set_shape_fill_advanced` 渐变/图片填充（现仅纯色 setSolidColor）— 未实装

## Office.js · PPT —— 幻灯片级（待补）
* [ ] `insert_table_ppt` 插入/编辑表格（1.8/1.9 table API）— 未实装（insert_table 目前为 Word）
* [ ] `insert_hyperlink_ppt` 形状/文字加超链接 — 未实装
* [ ] `insert_slides_from_template` 从另一个 .pptx 插入幻灯片（insertSlidesFromBase64，可近似"套模板"）— 未实装

## Office.js · PPT —— ❌ 平台不支持（建不了，列出供决策）
* [ ] ❌ 动画效果 animation —— 官方 API 完全无此接口 ← 点名「动画」，做不了
* [ ] ❌ 切换/转场效果 transition —— 无 API
* [ ] ❌ SmartArt —— 无 API
* [ ] ❌ 套用主题/模板 theme —— 无 API（issue #6185 仍是 feature request）
* [ ] ❌ 读取背景色/主题色 —— 无文档化 API（只能写背景，不能可靠读）


# ============================================================
# 系统 Prompt 调整 + 三宿主 skills 调研（🟡 部分实装）
# 🟡 v2.3：PPT 领域段 system prompt 已重写（PVQ-05, Phase 23，盖印章/故事线/自查指引下沉）。
#    仍未做：Excel/Word 专属设定深化 + 三宿主 skills 调研。
# ============================================================
* [ ] 从能用到好用，让 Aster 专注功能，最好 Excel/Word/PPT 各有一套特定设定，甚至调研对应 PPT/Excel/Word 的 Skills 丰富 Agent 能力。下面是可参考的 Skill（参考它们怎么设计 PPT/Word/Excel 部分，不需要脚本部分）
    * [ ] PPT： https://www.skills.sh/daymade/claude-code-skills/ppt-creator
    * [ ] PPT：https://github.com/anthropics/skills/blob/main/skills/pptx/SKILL.md
    * [ ] PPT: https://mcpmarket.com/zh/tools/skills/gemini-ppt-slide-optimizer
    * [ ] Excel： https://www.skills.sh/davila7/claude-code-templates/excel-analysis
    * [ ] Word： https://www.skills.sh/shubhamsaboo/awesome-llm-apps/content-writer


# ============================================================
# 多软件兼容（未实装）
# ============================================================
* [ ] 兼容 WPS https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/wps-integration-mode/wps-addin-development/generate-the-first-wps-addin


# ============================================================
# 上下文 / 缓存 / 抗幻觉优化（2026-06-01 讨论结论）（✅ v2.3 已实装，2026-06-05，Phases 20-21）
# ✅ v2.3 SHIPPED 映射：时钟脱前缀=CTX-01/02(Phase 20)；摘要压缩(高/低水位 token 触发)=CTX-03/04/05(Phase 21)；
#    F5 恢复=CTX-04；抗幻觉「信刚读文档」指引=CTX-06(Phase 21)。详见 .planning/ROADMAP/REQUIREMENTS。
# 动机：① 命中 prompt 缓存省 token  ② 更怕的——上下文太长 AI 会幻觉
# 关联：上面「聊天记录」第 3 条「最多存 20 轮」已被摘要压缩策略取代（按 token 水位而非硬砍轮数）
# ============================================================

# 1. 改时钟：把 system prompt 里的实时时间挪走（纯赚，可先做）
# 背景机制（防误解先讲清）：DeepSeek / OpenAI-compatible 的 prompt 缓存是「前缀匹配」——
#   从 messages 第一个 token 起，与上一次请求「连续相同的开头」越长，这段开头就按缓存价计费
#   （DeepSeek Flash 缓存命中价 ~$0.0028/M vs 全价 $0.14/M，约 50× 便宜；Pro 约 120×，见 CLAUDE.md DeepSeek pricing）。
#   一旦某个位置变了，从该位置往后全部 miss、按全价计。所以胜负手 = 「每次请求开头有多长是原封不动的」。
* [ ] 现状问题（精确）：`buildSystemPrompt`（src/agent/system-prompt.ts:93）在每次 runAgent 时用 `new Date()` 注入三段动态内容到 system message：
      `today`（YYYY-MM-DD，system-prompt.ts:98）、`clock`（HH:MM，精度到分钟，:99）、`weekday`（:100）。
      system message 恒为 messages 数组第 0 位（loop.ts:71）；其中 `clock` 每过 1 分钟就变 →
      整个请求从第一个 token 即 miss → 全额付费。⚠️ 这与对话轮数无关：哪怕只聊 1-2 轮、两次发言间隔 ≥1 分钟也必 miss。
* [x] ✅ v2.3 已实装(CTX-01/02, Phase 20) — 改法（最优，推荐）：把日期/时间整体从 system prompt 移除，改为拼到「当前这条 user message」的末尾
      （例：userPrompt 后追加一行「（当前时间：2026-06-01 周一 14:37，用户本地时间）」）。
      效果：system + tools + 历史 这一长段前缀变成完全静态 → 缓存高命中；动态时间在数组末尾，不破坏任何前缀；agent 仍拿得到精确时间。
      铁律：任何「每次请求都会变」的内容一律放 messages 末尾，绝不放进前缀（system / 靠前历史）。
* [ ] 改法（备选，最小改动）：保留时间在 system，但只留 `today`（日期）、删掉 `clock`（HH:MM）。
      日期一天才变一次 → 当天所有请求前缀稳定、全命中，只在跨天那一刻 miss 一次。次于「移到末尾」，但改动最小、风险最低。
* [x] ✅ v2.3 已实装(Phase 20) — 测试守门（精确）：在 system-prompt.test.ts 加断言——`buildSystemPrompt(host)` 返回值不匹配分钟级时钟
      （如断言不出现 `/\d{1,2}:\d{2}/` 形态的时:分），防以后有人把实时时钟又加回 system 前缀。
      （对应记忆「复发故障 → 加结构性守门」：同类回退靠 test 挡，不靠纪律。）
* [ ] 否决方案：把「取当前时间」做成 tool。理由：时间是 agent 几乎每轮都要用的信息；做成 tool = 每次模型得先发一轮请求
      说「我要调 get_time」→ 我们返回 → 再继续，多一次网络往返（拖慢首 token，违背 ≤2s 体感）+ 那一轮整段 prompt 还要重发。
      属高射炮打蚊子；放 message 末尾用几十个 token 即可达到同效果且零往返。

# 2. 长对话上下文管理 + 抗幻觉（认真规划，单独一轮，别随手做）
* [ ] 核心顾虑：Aster 目前是单一聊天窗口，且用户大概率不会手动清空 → 上下文只增不减、越堆越长 → AI 质量下降 / 幻觉。
      三个具体机理：① lost-in-the-middle（模型对上下文「中间段」注意力最弱，开头结尾记得牢，越长中间漏得越多）；
      ② 过时信息当真（早期被用户推翻的旧要求/旧数据仍躺在上下文里，被当成现行有效 → 事实性幻觉）；
      ③ context rot（无关历史堆积，信噪比下降，注意力被稀释，更易跑偏 / 自相矛盾）。
* [ ] 认知修正（重要）：DeepSeek 100 万 token 窗口是「物理塞得下」的上限，不等于「塞满还聪明」；实测塞越满越笨。
      所以控制上下文长度不只是省钱，更是「保输出质量」。这条修正了早前「窗口大就别管长度」的直觉。
* [ ] 现状好消息（精确）：loop.ts:67-68 在拼 historicalMsgs 时，对截断后的历史又 `filter` 掉了 `tool` 和 `error` 消息、
      只保留 `user` / `assistant`。意味着跨对话历史里不含「旧的工具读取结果」→「拿几十轮前过时的文档读数当现在的」
      这种最毒的幻觉源已基本避开。剩余风险主要来自对话文字本身堆太长。
* [ ] 「20 轮硬砍」要重审（精确）：当前实现 = `truncateTo20Turns`（loop-helpers.ts:191），按「user 轮次」滑动窗口，
      超过 20 个 user turn 就从最老处整组丢弃（tool 不计入轮次）。它从抗幻觉看有正面价值（短=干净），
      但两个代价：① 破坏缓存（每丢一轮、历史前缀整体后移，见下「缓存友好截断」条）；② 盲目丢最老的，可能丢掉仍有用的早期上下文。
      ⚠️ 重审时别走极端：既不要保留「每轮挪一格」的滑动窗口（缓存灾难），也别盲目放宽成超大额度（= 喂幻觉）。
* [x] ✅ v2.3 已实装(CTX-03/04/05, Phase 21) — 业界正解 = 摘要压缩（summarization / compaction），ChatGPT / Claude Code 同款，契合 Aster 无后台约束（只多一次 LLM 调用，不需数据库 / 向量库）。
      具体设计（⚠️ 下列数值是建议初值、待真机调，非定值）：
      · 触发：按 token 水位、不按轮数。用「高水位触发、压到低水位」的批量策略——例如历史超过 ~6 万 token（高水位）才触发，
        压缩后使历史回落到 ~3 万 token（低水位）。高/低水位拉开差距，是为了「压一次能撑很多轮」（见下条「狠而少」）。
      · 压什么：最老的一段（从最旧消息到低水位线之间）；最近若干轮原文保留不动。
      · 压成什么：调一次便宜 LLM（可用同 Provider 的 flash 档），压缩 prompt 要点 =「把以下对话压成要点，保留所有【仍然有效】的
        事实 / 决定 / 用户偏好，明确【扔掉已被推翻的】，越短越好」——这一步顺手清掉过时信息，是省钱 + 抗幻觉一鱼两吃。
      · 摘要放哪：作为一条固定消息，放在 system 之后、保留的原文历史之前，即 [system][SUM][最近原文][当前]。
        这样 [system][SUM] 成为新的稳定前缀，两次压缩之间缓存照常命中（只在「压缩那一刻」miss 一次）。
      · 存哪：摘要跟聊天记录一起存 localStorage（无后台约束）。
* [ ] 缓存友好截断技巧（精确，与上面两条同一原理的三种表述）：缓存按前缀匹配，任何在「靠前位置」动刀的截断都会破坏前缀。
      所以 ① 别用「每轮丢最老一条」的滑动窗口（每轮前缀都变 → 几乎每轮全 miss）；
      ② 改「攒够一大批才砍 / 压一刀」（高水位批量），大部分轮次前缀不动，只在「砍那一刻」断一次、之后连续命中到下次压缩。
* [x] ✅ v2.3 已实装(CTX-06, Phase 21) — 让 agent 永远信「刚重读的文档现状」而非历史里的旧记忆：文档会被用户或 agent 自己改动，几十轮前的读取结果早已过时。
      （现状 loop.ts:67 已 filter 掉历史里的旧 tool 结果；这条主要是 system prompt 指引层面的强化，避免模型凭旧印象操作。）


# ============================================================
# PPT 视觉质量提升（2026-06-01 讨论 + 网络检索结论）（✅ v2.3 已实装，2026-06-05，Phases 22-24）
# ✅ v2.3 SHIPPED 映射：P0 设计 token=PVQ-01(Phase22, ppt-tokens.ts)；P0 几何自查=PVQ-02(Phase22, geometry-check.ts，
#    含 UAT-6 近似未对齐)；P1 盖印章 apply_slide_layout + CSS 导坐标版式库(6 套) + 五件套联动 + reverse=PVQ-03/04(Phase23)；
#    PPT 领域段 system prompt 重写=PVQ-05(Phase23)；P2 自渲染预览 + vision 自查 spike=PVQ-06(Phase24, 真机 PASS→铺开)。
#    仍未做（诚实）：P2 备选「show-don't-tell 2-3 缩略图选择」、三宿主 skills 调研。
#    ⚠️ 真机历经 UAT-1..11 修复（非法枚举/网页版建页竞态/视觉/color picker/对齐检测/batch/新形状 race/超时/预览面板挂载）。
# ============================================================

# 锁定取舍（用户 2026-06-01 定）：可编辑 > 好看，但好看也很重要
* [ ] 默认路线 = 全程「可编辑的原生形状」打底；只有原生实在做不出、又确实影响美观的（复杂图表/装饰/配图）才局部用截图/生图插成图片（这一小块不可编辑）
* [ ] 心法：不是整页二选一，是「分元素决策」——90%（文字/标题/要点/KPI/色块/简单形状）走可编辑原生形状，少数装饰才破例用图
* [ ] 诚实天花板：选「可编辑优先」就等于给「好看」设了上限（Office.js 网页版对原生形状控制力有限）。目标是「整洁/专业/规范/不溢出不重叠」，惊艳留给局部图片块——别期望像素级设计

# 业界检索结论（对 Aster 有用的铁律，多源 + 官方 skill 印证）
* [ ] 【内容与渲染分离】先让 LLM 出结构化内容（JSON：每页标题+要点），再单独渲染成版面。别边想内容边排版，更别让 LLM 直接写 PPT XML（公认低效、写不稳）
* [ ] 【先故事线再做页】← Aster system-prompt 金字塔原则已对齐，保持
* [ ] 【创作前先做设计分析】生成前先判断 主题/行业/语气 → 选 3-5 色调色板（主色+辅助+强调）→ 声明设计选择再动手。Aster 现在完全没有，加进 PPT 领域段开头
* [ ] 【预置调色板】预存几套呼应品牌的调色板（含 teal 系），明确避开「通用 AI 审美」（检索原话点名 purple gradients on white）——和 04.1 teal 克制方向一致
* [ ] 【自查 4 项清单】文字截断/溢出 · 元素重叠 · 贴边越界 · 对比不足，改到对为止。其中能用坐标确定性判定的（前三项 + 对比度）走「P0 几何自查」（精确阈值见下方该条）；留白/整体观感这类粗粒度问题走「P2 vision 自查」。两者都用这同一份 4 项清单
* [ ] 【版面禁则】图表/表格用两栏或整页，绝不把图表竖向堆在文字下面

# 落地分级（从最去粗糙 / 最易做 往下）
* [x] ✅ v2.3 已实装(PVQ-01, Phase 22, ppt-tokens.ts) — 【P0｜纯指引+现有工具，零新依赖｜收益最大】设计系统 token（⚠️ 下列是建议初值，待真机/UAT 调）：
      字号阶梯 = 标题 28pt / 副标 18pt / 正文 14pt；统一页边距 = 40pt；网格 = 「整页 / 左右两栏」两套基础布局（可扩 12 列）；
      配色板呼应品牌 = 主色 teal（light #009887 / dark #4FC9B8）+ 1-2 个中性灰 + 1 个强调色，共 3-5 色。
      生成时让 agent 显式带这些参数摆放（add_shape / set_shape_text_font / set_shape_property 已具备能力，缺的只是「指引把它们组合成规范版面」）。
      ⚠️ token 值应集中放一个模块（如 src/agent/design/ppt-tokens.ts）由代码注入，不要硬写散落在 system prompt 里（便于统一调 + 避免 prompt 膨胀）。
* [x] ✅ v2.3 已实装(PVQ-02, Phase 22, geometry-check.ts；UAT-6 补近似未对齐) — 【P0｜纯 TS，确定性，零网络零依赖】几何自查：拿每个元素的 {left,top,width,height}（来自 list_shapes_on_slide / adapter），
      代码确定性算出版面问题，把违规清单作为 evidence 喂回 LLM 让它重排（替换 system-prompt 现在「让 LLM 拿坐标脑补重叠」的第 8 条）。
      基准：16:9 slide = 720×405pt（4:3 = 720×540pt）；页边距用上面的 token（初值 40pt）。四项判断标准（⚠️ 数值待真机调）：
      ① 溢出：文本预估宽高 > 文本框宽高。预估 = 字符数 × 字号 × 系数（中文全角 ≈1.0×字号/字、英文 ≈0.5×；行高 ≈1.2×字号），取保守上界（宁可误判溢出，对应记忆 TOOL-06 的保守估算思路）。
      ② 重叠：任意两元素 bounding box 矩形相交，且相交边长 >2pt 才算（避开亚像素误判）。
      ③ 越界：元素任一边超出 slide 画布，或元素到画布边缘距离 < 页边距 token。
      ④ 对比不足：文字色与其背景色的 WCAG 对比度 < 4.5:1（正文）/ < 3:1（≥18pt 加粗大字）。
# 【P1 决策｜用户 2026-06-01 拍板：直接上最完美的，不在乎开发成本】
#   运行时 = 「盖印章/做工具」（不走「纯指引让 LLM 手摆」——后者 LLM 易摆歪 + 一页十几张撤销卡，否决）
#   印章来源 = 「开发期 CSS 导坐标」（最精致的印章）
#   天花板：可编辑优先 → 好看有物理上限（Office.js 网页版），目标是「可编辑前提下最整齐专业」，惊艳块靠 P2 局部图片
* [x] ✅ v2.3 已实装(PVQ-03, Phase 23；真机 UAT-1..11 修齐) — 【P1 运行时=工具】做 apply_slide_layout write tool：入参 {layout, 内容字段}，工具内部按模板坐标一次性建好整页所有原生形状。收益：版面由代码定→稳定不歪；一个 tool call=一整页→撤销一页一张卡，顺手解决上面「优化」区「工具卡片太多」痛点
* [x] ✅ v2.3 已实装(Phase 23, ppt-layouts.ts) — 【P1 印章来源=CSS 导坐标】开发期用 CSS/浏览器把每套版式排好看 → 自动导出元素坐标固化成数据 → 内嵌进 apply_slide_layout。开发时享受 CSS 排版力，运行时仍是纯可编辑原生形状。⚠️ 导出坐标要校准 Office.js 的 pt/px 换算 + 字体回退 fidelity 偏差
* [x] ✅ v2.3 已实装(Phase 23, 6 套) — 【P1 版式清单（起步）】封面 / 大数字KPI / 两栏对比 / 时间线 / 图文左右 / 要点列表
* [x] ✅ v2.3 已实装(Phase 23) — 【P1 工程影响面 = 新 write tool「五件套」联动】① write/ppt.ts 工具定义+reverse descriptor ② index.ts import + buildToolsForHost 注册 + **加进 PPT_TOOLS 集合**（否则 camel/snake casing 静默失败，v2.2 Phase 14 在治的债）③ PptAdapter.ts Office.js 批量建形状 + inverse 方法 ④ operationLog.ts 新 PostStateSnapshot kind ⑤ DiffLogPanel.tsx humanLabel + operationLog.integration.test 守门
* [x] ✅ v2.3 已实装(Phase 23, reverse=delete_slide_by_index 收 Record 对象) — 【P1 reverse 要点 ⚠️】apply_slide_layout 是批量插入 → 逆向=批量删该页新建的所有形状：要记录全部 newShapeId；inverse 方法**必须收 Record 对象、不能用位置参**（Phase 5 Word 位置签名致真机撤销全挂的教训）；内容超长仍可能溢出 → 工具内考虑自适应，或交给 P0 几何自查兜底
* [x] ✅ v2.3 已实装(PVQ-06, Phase 24；真机 PASS→铺开，PVQ06_VISUAL_CHECK_ENABLED=true) — 【P2｜中，需 spike｜搭 v2.2 vision 顺风车】自渲染预览 + 多模态自查：用 Aster 已知的元素，在 task pane 用绝对定位 div 按 16:9（720×405pt 等比缩放）重建一个 slide 预览 → 用 html2canvas 截成图 → 喂多模态模型查「自查 4 项」。三个约束：
      ① html2canvas 必须懒加载（动态 import），不进 initial chunk——initial main-*.js 有 CI 硬门 ≤82KB gzip（见记忆 bundle-size-guard）；动 bundle 前要先 build 再 npm run size（陈旧 dist 会给假绿）。
      ② 依赖 v2.2 Phase 15 vision（aihubmix-vision）落地后才能接。
      ③ 自渲染预览 ≠ PowerPoint 真实渲染（字体回退 / 自动换行有偏差），只用于查粗粒度问题（溢出 / 重叠 / 留白 / 对比），别指望像素级保真。
* [ ] 【P2 备选 UX】「show don't tell」：出 2-3 个版式预览缩略图让用户挑，而不是让用户描述审美偏好（参考 frontend-slides）— ⬜ v2.3 未做（spike 走「自渲染预览 + vision 自查」路线已达成 P2 目标；缩略图选择留后续）
* [ ] 【放弃】用 Office.js 导出 slide 真实渲染图自查——PowerPoint Web 无可靠「单页转 PNG」API，用 P2 自渲染预览替代

# 参考 skills / 资料（检索 2026-06-01）
* [ ] Anthropic 官方 pptx skill（html2pptx + 缩略图网格自查 + 创作前设计分析 + 18 示例调色板含 Teal&Coral）：github.com/ComposioHQ/awesome-claude-skills/blob/master/document-skills/pptx/SKILL.md
* [ ] frontend-slides（用前端/CSS 能力做 slide，零依赖单 HTML，避开通用 AI 审美，show-don't-tell 预览选择）：github.com/zarazhangrui/frontend-slides
* [ ] 业界综合（内容/渲染分离 + 模板优先 + 防溢出 + fact-check）：pondhouse-data.com/blog/how-to-create-powerpoint-with-AI、listenlabs.ai/blog/ppt-generator

# 【参考】PPT 领域段 system prompt 草稿（起点，非最终稿）
# ⚠️ 由后续执行 AI 调研优化，主优化方向 = 版面设计
# 使用须知（重要，别照抄）：
#   定调（用户 2026-06-01）：优先「描述精确、无歧义、防误解」——长度本身不是敌人，冗余和歧义才是。不要为了简短而缩略或牺牲信息。
#   1. 这版是参考起点、非定稿。落地时该做的不是「为短而短」，而是「消除冗余 + 消除歧义 + 把必要的事说精确」。
#   2. 真正该从 prompt 删除的，只是「机制能焊死的冗余规则」：P0 设计 token / P1 印章工具 / P0 几何自查 就位后，
#      那些「教模型怎么排版（具体字号 / 坐标 / 自查清单）」的条款应「下沉到机制」并从 prompt 移除——因为机制已经保证，prompt 再写就是冗余。
#      ⚠️ 删的是「冗余规则」，不是「精确描述」；该说清楚的（边界、禁则、判断标准）务必写到精确无歧义，不怕长。
#   3. prompt 最终聚焦「只有模型能判断的」（故事线 / 选哪个模板 / 填什么内容 / 标题怎么写出洞察）+ 硬底线（可编辑优先 / 收到自查反馈就改 / 诚实边界）；这些条目该写多精确就写多精确。
#   4. lost-in-the-middle 的真实风险来自「塞一堆机制已保证的冗余规则稀释注意力」，不来自「把必要的事说清楚」——别因此牺牲精确。
#   5. 必须真机验证「模型到底照没照做」，A/B 迭代收敛，别纸上定稿。
# ---------------------------------------------------------------
#   【PowerPoint 领域指导】
#   你的目标是产出「视觉整洁、有设计规范、可继续编辑」的 deck，而不是「文字对、但粗糙」的大纲。
#   全程用可编辑的原生形状（标题/正文/要点/KPI/色块/简单形状）；只有原生实在做不出的复杂图表/装饰/配图才局部插图。
#
#   〔工作流 · 按顺序，别跳步〕
#   1. 先 list_slides 摸清现有结构和页数，再规划全部页面。
#   2. 【先故事线】定核心结论 → 3-5 条支撑 → 证据（金字塔）。全 deck 标题串起来即逻辑链。跳过故事线直接做页是最常见错误。
#   3. 【创作前设计分析】先想清楚主题/行业/语气，据此选一套调色板（主色+辅助+强调，3-5 色），第一句话简短声明设计选择。避开「紫渐变+白底」廉价 AI 观感。
#   4. 【选版式】每页按内容选一个版式模板（封面/大数字KPI/两栏对比/时间线/图文左右/要点列表），按模板既定位置和字号填内容，不从零摆。
#   5. 【batch 生成】全部页规划好后，一次 emit 多个 tool_call 平行推进。
#
#   〔设计规范 · 全 deck 统一〕
#   6. 字号阶梯：标题/副标/正文显式设定，不靠默认母版。
#   7. 配色：整份只用选定的 3-5 色；强调色仅点关键数字/结论。
#   8. 版面：统一页边距，元素对齐网格；正文左对齐禁止居中；每页 ≤5 要点、每点 ≤15 字，超出拆页或两栏。
#   9. 【版面禁则】图表/表格用两栏或整页，绝不竖向堆在正文下；新元素不与现有形状重叠。
#   10.【视觉重点】每页一个焦点：关键数字/结论用更大字号或强调色顶出来。
#
#   〔标题质量〕
#   11. 断言式完整结论句（「华东 Q3 超目标 15%，主因大客户续签」），非话题词。≤15 字，含数字/结论，主动语态。
#
#   〔自查 · 没过不许说做完〕
#   12. 每 batch 完成后系统自动几何检测（溢出/重叠/越界/对齐）并回你；收到问题必须改到通过。
#   13. 自查 4 项：① 文字被截断 ② 元素重叠 ③ 贴边/离边界太近 ④ 文字背景对比。
#
#   〔定位与诚实边界〕
#   14. 改形状前 get_shape 确认 id；用户说「这个形状」先看 selection_detail，有 selectedShapeId 就直接用别 list 全部猜。
#   15. 配图/复杂图表/装饰：原生做不出的诚实告知「已预留占位，建议手动配图」或走生图；不造假。
# ---------------------------------------------------------------

