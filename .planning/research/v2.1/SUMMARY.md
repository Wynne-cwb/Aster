# Research Summary — Aster v2.1「从能用到好用」

**Synthesized:** 2026-05-30
**Sources:** STACK.md / FEATURES.md / ARCHITECTURE.md / PITFALLS.md + PROJECT.md + todos.md
**Consumer:** gsd-roadmapper → REQUIREMENTS.md → Phase 8+ plans

---

## TL;DR（roadmapper 可直接行动的 8 条）

1. **0 净新增运行时依赖。** react-markdown/remark-gfm/zustand 均已安装；A–F 全部靠现有 stack 交付。bundle CI gate ≤82 KB 不受影响。
2. **B 的核心裁决：35 do-now 操作 → 参数化合并后约 23 个工具定义。** todos.md ~60 候选经 FEATURES 三轮筛后留 35 个 do-now；ARCHITECTURE 要求参数化合并（`set_word_character_format` 包 6 个 font 操作、`format_excel_range` 包 5 个格式操作）使最终工具定义数每宿主 ≤8 净新增，全局上限 ~23 个工具定义。两者兼容，不矛盾。
3. **undo 基础设施先于任何破坏性工具。** PITFALLS 明确：sort_range / remove_duplicates / merge_cells / find_and_replace / delete_worksheet / delete_shape / delete_slide 需要快照 undo 或 noop+gate；这些反向路径必须在工具本身之前设计好。
4. **B triage 是 Phase 8 的第一个产出，不是最后一个。** 在任何 B 工具开始编码前，必须先产出参数化工具合并设计文档（每宿主 ≤8 净新增，工具定义 ≤25 条，每条 description ≤50 字）。
5. **F 的 docKey spike 要在 F 实现开始之前跑完。** `Office.context.document.url` 在 Office for Web 的稳定性决定是否支持分文档存储；如果 URL 不稳定则回退为全局单 key，这个决策影响 chatStore 接口签名。
6. **PPT 有 3 个 spike 门控：** shape.rotation 可写性（GitHub issue #3022）、slide.background 读取（PPT API 1.10）、table 支持（PowerPointApi 1.8 on Web）。这 3 个 spike 通过才能确定对应工具的 undo 策略。
7. **E 最先开始，E-UI-1（react-markdown urlTransform XSS）是第一行改动。** 然后 DiffLogPanel 位置修复（E1）→ Markdown CSS（E2）→ 读卡轻量化（E3）→ 骨架/loading 气泡（E4）。E 与 A 可并行，不依赖 B/C/D。
8. **A 偏好注入必须加 prompt injection 防御（OWASP LLM01:2025）**，且 system prompt 整体 <3000 字符 CI gate 必须维持。

---

## Stack verdict

**结论：0 净新增运行时依赖。**

| 需求 | 现状 | 行动 |
|------|------|------|
| react-markdown 表格边框 | `react-markdown@^9` + `remark-gfm@^4` **已安装**，ChatBubble 已接线 | 只需在 `styles.css` `.bubble-ai table` 加 `border-collapse: collapse` + cell border — 0 行 JS |
| F 聊天持久化 | `zustand/middleware` persist **已在** zustand 包内（0 KB 新增）；但推荐复用 `src/lib/storage.ts`（已处理 partitionKey） | 手动 `saveHistory/loadHistory` 优于 persist middleware，因为后者不感知 partitionKey |
| B 批量写入 | Office.js 原生 `Excel.run` 单闭包 + 单 `context.sync()` | 只需新 adapter 方法 + 新 ToolDef，无需任何库 |
| D Word 选区精度 | `paragraph.uniqueLocalId`（WordApi 1.6）via CDN — 0 KB | 只需扩展 `WordAdapter.read 'selection_detail'` case |
| B Office.js API | PPT 1.4/1.8，Excel 1.1–1.8，Word 1.1–1.6 — 全部 CDN 可用 | 0 新依赖；PPT 1.8 table + shape.rotation + slide.background 需 spike |

**明确不加：** immer、dexie/idb、diff/jsdiff、shiki（v2.2 评估）、TanStack Query、任何 UI 组件库、XState、react-virtuoso。

---

## Feature B triage — 核心裁量产出

### 关键调解：「35 do-now 工具 vs ≤8 净新增/宿主」是假矛盾

FEATURES.md 列出 35 个 do-now 工具（Word 11 + Excel 15 + PPT 9）。ARCHITECTURE.md 要求每宿主 ≤8 净新增工具定义（token 预算：25 工具 × 350 token/工具 = 8,750 token 固定开销/轮）。PITFALLS.md 要求 triage 至每宿主 8–12 个工具，含 undo 预分类。

**调解结论：** 参数化合并让 35 个操作折叠进 ~23 个工具定义，完全兼容。举例：

- `set_word_character_format(operation: enum['bold','italic','underline','size','color','name'], value, paragraph_index)` — 1 个定义覆盖 6 个 font 操作
- `set_word_paragraph_format(alignment?, line_spacing?, spacing_before?, spacing_after?, indent?)` — 1 个定义覆盖 4 个段落格式操作
- `format_excel_range(address, font?, fill?, borders?, alignment?, number_format?)` — 1 个定义覆盖 5 个单元格格式操作

### B-Word 合并后工具表

| 工具名（合并后） | 覆盖的 todos.md 候选 | v2.1/defer/❌ | Undo 类型 | 复杂度 |
|---|---|---|---|---|
| `set_word_character_format` | set_font_bold / italic / size / color / underline / name（6 合 1） | **v2.1** | 简单逆向（restore_range_font，新 adapter 方法） | L |
| `set_word_paragraph_format` | set_paragraph_alignment / set_line_spacing / set_paragraph_spacing / set_paragraph_indent（4 合 1） | **v2.1** | 简单逆向（restore_paragraph_format，新 adapter 方法） | L |
| `apply_paragraph_style` | apply_paragraph_style | **v2.1** | 简单逆向（restore_paragraph_style，需同时保存 styleBuiltIn + style） | L |
| `find_and_replace` | find_and_replace | **v2.1** | **快照必须**（枚举所有匹配的 before-image，match-list） | M |
| `insert_table` | insert_table | **v2.1** | 简单逆向（delete_table_by_marker） | M |
| set_font_highlight | set_font_highlight | defer v2.2 | — | L |
| make_bulleted_list / make_numbered_list | list 操作 | defer v2.2 | — | M |
| insert_comment | insert_comment | defer v2.2 | — | M |
| edit_table / insert_image / set_header_footer | 复杂 / 依赖 FUT-15 | defer | — | H |
| modify_named_style | modify_named_style | ❌ noop+gate（改全文样式，逆向不实际） | — | H |
| toggle_track_changes | toggle_track_changes | ❌ GitHub issue #5874 已知 bug | — | — |

**Word 净新增工具定义：5 个**（3 个合并定义 + find_and_replace + insert_table）

### B-Excel 合并后工具表

| 工具名（合并后） | 覆盖的 todos.md 候选 | v2.1/defer/❌ | Undo 类型 | 复杂度 |
|---|---|---|---|---|
| `format_excel_range` | set_number_format / set_cell_font / set_cell_fill / set_cell_borders / set_cell_alignment（5 合 1） | **v2.1** | 简单逆向（restore_range_format） | L |
| `set_column_row_size` | set_column_row_size | **v2.1** | 简单逆向（restore_column_row_size） | L |
| `sort_range` | sort_range | **v2.1** | **快照必须**（全范围 2D before-image；上限 10,000 单元格，超限 noop+gate） | M |
| `apply_filter` | apply_filter | **v2.1** | 简单逆向（restore_autofilter） | L |
| `find_and_replace_excel` | find_and_replace_excel | **v2.1** | **快照必须**（所有匹配地址+原值的 before-image） | M |
| `add_conditional_format` | add_conditional_format | **v2.1** | 简单逆向（delete_conditional_format_at_index） | M |
| `create_table` | create_table | **v2.1** | 简单逆向（delete_table_by_name） | L |
| `freeze_panes` | freeze_panes | **v2.1** | 简单逆向（restore_freeze_panes） | L |
| `add_worksheet` | add_worksheet | **v2.1** | 简单逆向（delete_worksheet_by_name） | L |
| `rename_worksheet` | rename_worksheet | **v2.1** | 简单逆向（restore_worksheet_name） | L |
| `set_chart_title` | set_chart_title | **v2.1** | 简单逆向（restore_chart_property） | L |
| `merge_cells` | merge_cells | defer v2.2 | **快照必须**（合并丢失非左上角内容） | M |
| `remove_duplicates` | remove_duplicates | defer v2.2 | **快照必须**（全范围 before-image；上限 5,000 行） | M |
| `create_pivot_table` | create_pivot_table | defer v2.2 | **快照必须** | H |
| `delete_worksheet` | delete_worksheet | ❌ **noop+gate（微软文档明确不支持 undo，全内容永久丢失）** | — | — |
| insert_delete_cells（删除路径） | insert_delete_cells delete | defer | **快照必须** | M |

**Excel 净新增工具定义：10 个**（1 个大合并 format + 9 个独立工具）

### B-PPT 合并后工具表

| 工具名（合并后） | 覆盖的 todos.md 候选 | v2.1/defer/❌ | Undo 类型 | 复杂度/Spike |
|---|---|---|---|---|
| `set_shape_text_font` | set_shape_text_font | **v2.1** | 简单逆向（restore_shape_text_font） | L |
| `set_shape_text_alignment` | set_shape_text_alignment | **v2.1（spike 门控 S4）** | 简单逆向或 noop（取决于 spike） | M / SPIKE |
| `add_shape` | add_shape + add_text_box（shape_type 参数区分） | **v2.1** | 简单逆向（delete_shape_by_id）；addTextBox 前必须 deselect（bug #2775） | M |
| `delete_shape` | delete_shape | **v2.1（noop+gate）** | ❌ noop（无法完整序列化形状状态） | L |
| `rotate_shape` | rotate_shape | **v2.1（spike 门控 S1）** | 简单逆向或 noop | L / SPIKE |
| `delete_slide` | delete_slide（正向工具，现仅有 inverse 用的 deleteSlideByTitle） | **v2.1（noop+gate）** | ❌ noop（无 PPT slide export API，STATE.md SP-5） | L |
| `duplicate_slide` | duplicate_slide | **v2.1** | 简单逆向（delete_slide_by_id，不用 title） | M |
| `set_slide_background` | set_slide_background | **v2.1（spike 门控 S2）** | 简单逆向或 noop（取决于 spike） | M / SPIKE |
| add_line / set_shape_fill_advanced | 渐变填充复杂 | defer v2.2 | — | H |
| insert_table_ppt | PPT API 1.8（spike 门控 S3） | defer v2.2（spike 后评估） | — | H / SPIKE |
| insert_slides_from_template / add_image | FUT-15/16 依赖 | defer v2.2 | — | H |
| ❌ 动画/转场/SmartArt/主题 | Office.js 平台不支持 | ❌ 永久不做 | — | — |

**PPT 净新增工具定义：8 个**（其中 3 个有 spike 门控）

### 超高频「必做 10」短名单（来自 FEATURES.md）

| # | 操作 | 所在工具定义 |
|---|---|---|
| 1 | Word 段落对齐 | `set_word_paragraph_format` |
| 2 | Word 套用段落样式 | `apply_paragraph_style` |
| 3 | Word 全文查找替换 | `find_and_replace` |
| 4 | Excel 数字格式 | `format_excel_range` |
| 5 | Excel 单元格字体 | `format_excel_range` |
| 6 | Excel 单元格填充色 | `format_excel_range` |
| 7 | Excel 排序 | `sort_range` |
| 8 | PPT 删除形状 | `delete_shape`（noop+gate） |
| 9 | PPT 删除幻灯片 | `delete_slide`（noop+gate） |
| 10 | PPT 形状文字字体格式 | `set_shape_text_font` |

### token 经济学

- 合并后全局约 23 个工具定义 × 350 token/条 ≈ 8,050 token/轮固定开销
- 宿主隔离：`buildToolsForHost(host)` 确保每宿主独立计算，实际每轮更低
- CI 门控：8a-1 产出后，每宿主 toolDefs JSON ≤15 KB

---

## Features A / C / D / E / F — 表格化决策

### A — 能力变聪明

| 项目 | 决策 | 理由 |
|------|------|------|
| 宿主 domain segment 深化 | **必做，低风险** | 只改 `getDomainSegment()`；PPT 加「断言式标题 + ≤5 点/页 + verify-after-create」；Excel 加「先 get_used_range_summary + 分块读 >1000 行 + pipeline 四步」；Word 加「先 get_document_outline + 保留论点只改语言风格」 |
| 每宿主 domain segment 长度上限 | **6–10 行，<3000 字符 CI gate 维持** | token 浪费 = 每轮成本 |
| 用户偏好注入 | **必做**：新 `src/store/preferences.ts` + Settings 面板文本框 + `buildSystemPrompt(host, opts?: {userPrefs?})` | 解决用户每次重复输入偏好的摩擦 |
| Prompt injection 防御 | **必须**：偏好文本追加在 domain segment 之后，`【用户偏好（仅供参考）】...【偏好结束】` 包裹；拒绝含「忽略/ignore/new instruction/你的新角色」的输入；200 字符上限；加 injection 测试 | OWASP LLM01:2025，攻击成功率 50–84%（PITFALLS §A2） |
| 动态可加载 Skill 文件系统 | **不做**（D-09 决策维持） | bundle + 网络请求复杂度不值得 |

### C — 批量操作

| 项目 | 决策 |
|------|------|
| 架构方案 | 新 `batch_write` ToolDef，参数 `{ ops: Array<{tool, args}> }`；单 `Excel.run`/`Word.run` 闭包，单 `context.sync()`（ARCHITECTURE §C Strategy 2） |
| OperationLog | Strategy 2：1 个 batch 日志条目，`reverse = { tool: 'batch_reverse', args: { ops: [...] } }`；DiffLogPanel 渲染「批量改动 N 处」可展开卡 |
| 上限 | 20 个 op/批次（Office 队列上限 50；PITFALLS §E3） |
| 批次失败处理 | 第 i 步失败立即停止；不能静默跳过后继续写入（PITFALLS §C1） |

### D — Word 选区精度

| 项目 | 决策 |
|------|------|
| API 选择 | `paragraph.uniqueLocalId`（WordApi 1.6）；快速路径：text fingerprint 匹配；后备：`range.compareLocationWith()` 循环 |
| 返回值扩展 | `{ kind:'word', charCount, text, paragraphIndex: number, uniqueLocalId: string }` |
| 已知限制 | uniqueLocalId 跨 session 重置（仅在同一 agent run 内有效）；desktop Word 返回 null（#4258），v2.1 目标 Web 可接受 |
| 不做 | 绝对字符偏移（Office.js 无原生 API，推迟 v2.2） |

### E — UI 打磨

| 优先级 | 项目 | 复杂度 | 关键注意 |
|--------|------|--------|---------|
| P0 | react-markdown `urlTransform` XSS 防御 | XS | **第一行改动**；CVE-2025-24981 同类问题（PITFALLS §E-UI-1） |
| P1 | AI loading bubble | L | `agentStatus === 'pending'` 立即渲染，不等 `isStreaming`（PITFALLS §E-UI-2） |
| P1 | DiffLogPanel 跟随 loop（E1） | M | ChatStream 消息循环内 `runId` 边界检测；移除 tail `completedRunIds.map` |
| P2 | Markdown 表格 CSS（E2） | XS | `.bubble-ai table` 作用域；使用已有变量 `--border`/`--surface-2` |
| P2 | 读卡轻量化（E3） | L | `.aster-tool-card--read`：无 border，`--text-3` 字色；write 卡不降权重 |
| P3 | 首屏骨架屏（E4） | L | Office.onReady 前纯 CSS shimmer；不引新库 |

**Anti-features：** 全屏 loading overlay、typewriter effect、toast 弹窗、hover-to-expand — 全部不做。

### F — 聊天记录持久化

| 项目 | 决策 |
|------|------|
| 存储路径 | 复用 `src/lib/storage.ts`（已处理 partitionKey）；手动 `saveHistory/loadHistory` |
| per-doc vs 全局 | **先实现全局 key**；spike S6 可行则同 Phase 升级为 per-doc key |
| docKey 构建 | `'aster:chat:' + btoa(url.slice(-80)).replace(/[+/=]/g, '_')`；**禁止用 raw 完整 URL**（含 session token；PITFALLS §F1） |
| 持久化范围 | 只持久化 `role='user' | 'assistant'` 文字消息；每条 content 上限 2000 字符 |
| LLM 上下文 20 轮上限 | 在 `loop.ts` wire message 构建处截断；「1 轮 = 1 条 user 消息」；超出则从最早 user 消息起整 run 删除 |
| 序列化安全 | `serializeForStorage()` 白名单字段；丢弃 reverse/postState/ToolResult.data（PITFALLS §F4） |
| QuotaExceeded | `storage.ts` 已处理；超 4 MB 自动丢最旧 20% |

---

## Architecture integration

### 现有架构约束（v2.0 已锁定，v2.1 必须遵守）

- **A-06：** adapter 方法必须在 `*.run` 闭包内执行，输入输出纯数据
- **project_adapter_inverse_signature（memory）：** inverse 方法接收 Record 对象，不接收位置参数；每个新 inverse 必须同时加 `operationLog.integration.test` 守门
- **D-07/D-09：** system prompt 不泄露实现细节；不做动态加载
- **D-11：** OperationLog postState 用于手改防御

### 每 feature 集成点

| Feature | 新建文件 | 主要改动文件 |
|---------|---------|------------|
| A | `src/store/preferences.ts`；Settings 组件扩展 | `system-prompt.ts`（getDomainSegment + opts.userPrefs）；`loop.ts`（传 prefs）；`system-prompt.test.ts`（injection 测试必须加） |
| B-Word | `src/agent/tools/write/word.ts`（新 ToolDef） | `WordAdapter.ts`（新 adapter + inverse）；`operationLog.ts`（DocumentAdapterForReplay + executeReverse case）；`operationLog.integration.test.ts`（每 inverse 守门测试） |
| B-Excel | 同上模式 | sort_range / find_and_replace_excel 还需新增 `readRangeSnapshot` adapter 方法 |
| B-PPT | 同上模式 | addShape/addTextBox 合并为参数化；addTextBox 实现前必须加 deselect 逻辑 |
| C | `src/agent/tools/write/batch.ts` | `operationLog.ts`（PostStateSnapshot.kind 'batch'；subOps 字段；batch_reverse case）；`DiffLogPanel.tsx`（subOps 嵌套渲染）；`tools/index.ts`（三宿主均注册） |
| D | — | `WordAdapter.ts`（selection_detail case 扩展）；`WordAdapter.read.test.ts` |
| E | `LoadingBubble.tsx`（可 inline） | `ChatStream.tsx`（DiffLogPanel 位置重构、读卡样式分支）；`styles.css`（table CSS + 读卡 modifier + skeleton + loading animation） |
| F | `src/lib/docKey.ts` | `src/store/chat.ts`（loadHistory/saveHistory/clearHistory）；`loop.ts`（20-turn 截断）；`main.tsx`（hydrate）；`storage.ts`（CHAT_HISTORY 常量） |

### 工具数量爆炸缓解

- 参数化合并（首选）：同类操作合一；description ≤50 字
- humanLabel 仅供 UI，永不进 LLM 上下文（现有架构已保证）
- 宿主隔离：`buildToolsForHost` 已确保每宿主独立
- 不做：动态工具过滤（与「run 内随时可切」设计冲突）

---

## ⚠ Top risks + undo/reverse 不可逆性分类

### 高危工具（不做快照 undo 就不能上线）

| 工具 | 风险 | 缓解策略 |
|------|------|---------|
| `sort_range` | `range.sort.apply()` 清空 Office 撤销栈（官方文档）；行顺序永久改变 | 写前全量 `readRangeSnapshot`；上限 10,000 单元格；超限 noop+gate（PITFALLS §Excel E1） |
| `remove_duplicates` | 行永久删除，API 无原始数据 | 全范围 before-image；上限 5,000 行 |
| `merge_cells`（Excel + Word） | 非左上角单元格内容永久丢失 | 全 2D before-image；unmerge + overwrite 恢复 |
| `find_and_replace` / `_excel` | 所有匹配批量替换 | 替换前枚举所有匹配 (address, original) 对 |
| `delete_worksheet` | 整表永久删除；微软文档明确不支持 undo | ❌ noop+gate；**建议彻底从工具列表移除** |
| `delete_shape`（PPT） | 形状状态无法完整序列化 | ❌ noop+gate；warn「此操作不可自动撤销」 |
| `delete_slide`（PPT） | 无 slide export API（STATE.md SP-5） | ❌ noop+gate；warn 用户 |
| `create_pivot_table` | 目标范围原内容被覆盖 | 目标范围 before-image；defer v2.2 |

### Spike 门控工具

| 工具 | Spike 问题 | 通过 = 简单逆向；失败 = noop+gate |
|------|-----------|--------------------------------|
| `set_shape_text_alignment` | `textRange.paragraphFormat.alignment` 在 Office for Web 是否可读写 | — |
| `set_slide_background` | `slide.background.fill.*` 是否可读（PPT API 1.10） | — |
| `rotate_shape` | `shape.rotation` 在 Office for Web 是否可写（GitHub issue #3022） | — |
| `insert_table_ppt` | PowerPointApi 1.8 `isSetSupported` in Office for Web | — |

### 其他关键风险

| 风险 | 来源 | 防御 |
|------|------|------|
| batch 部分失败 OperationLog 不一致 | PITFALLS §C1 | 第 i 步失败立即停止 |
| addTextBox 在 PPT Web 静默删除选中形状 | PITFALLS §P2 / GitHub #2775 | 先 deselect + 插入后验证 shape count |
| Word 段落 index drift | PITFALLS §W1 | 工具 description 注明；domain segment 强化 |
| Word 中文样式名 locale crash | PITFALLS §W3 | 只允许 `Word.BuiltInStyleName` enum 值 |
| F localStorage 5MB 配额 | PITFALLS §F2 | strip tool result blobs；catch QuotaExceededError |
| react-markdown XSS | PITFALLS §E-UI-1 / CVE-2025-24981 | `urlTransform` prop（一行修复，P0） |
| A prompt injection via 用户偏好 | PITFALLS §A2 / OWASP LLM01:2025 | 包裹块 + 关键词拒绝 + 200 字符上限 + 测试 |

---

## Spikes required（全 4 份文档汇总）

| # | Spike 问题 | 阻塞的功能 | 预期信心 | Phase 位置 |
|---|-----------|------------|---------|-----------|
| S1 | `shape.rotation = 45` 在 Office for Web 不报错（GitHub issue #3022） | rotate_shape undo 策略 | HIGH | 8c 实现前 |
| S2 | `slide.background.fill.*` 在 Office for Web 可读（PPT API 1.10） | set_slide_background undo 策略 | MEDIUM | 8c 实现前 |
| S3 | PowerPointApi 1.8 `isSetSupported` in Office for Web | insert_table_ppt 是否进 v2.1 | MEDIUM；失败 = defer v2.2 | 8c 实现前 |
| S4 | `textRange.paragraphFormat.alignment` 读写支持 on Office for Web | set_shape_text_alignment undo | MEDIUM | 8c 实现前 |
| S5 | `paragraph.uniqueLocalId` WordApi 1.6 `isSetSupported` in Office for Web | D feature | HIGH（WordApi 1.6 GA 2022） | 8b 实现前 |
| S6 | `Office.context.document.url` 在 Office for Web 的格式 + 稳定性 | F per-doc key 策略 | MEDIUM | 8a 并行 |
| S7 | addTextBox 前 deselect 绕过 shape 删除有效性（GitHub #2775） | add_text_box adapter | HIGH | 8c 实现前 |

---

## Suggested phase decomposition（从 Phase 8 续接）

**硬依赖约束：**
- 8a-1（工具合并设计）必须先于 8b/8c/8d
- 8d（batch）必须在 8b/8c 全部完成后（batch 内部 dispatch 依赖已注册工具的 execute 函数）
- undo 基础设施必须与破坏性工具同 Phase，不可拆分
- E 和 A 可并行，两者均不依赖 B/C/D
- F 的 docKey spike（S6）先于 F 主体实现，可与 8a 并行

### Phase 8a — Foundation + 工具合并设计（0 新功能，全部前置条件）

交付物：(1) 工具合并设计文档（每宿主工具定义清单，参数化方案，undo 分类表，token-count 测试）；(2) F：docKey spike + `src/lib/docKey.ts` + chatStore loadHistory/saveHistory + main.tsx hydrate；(3) A：getDomainSegment 内容深化 + preferenceStore + injection 防御 + test。

Spike：S6 并行。研究标记：无需额外 research。

### Phase 8b — Word 工具完整（D + B-Word）

交付物：(1) D：WordAdapter selection_detail 扩展（paragraphIndex + uniqueLocalId）；(2) B-Word：5 个合并后工具定义 + adapter + inverse + integration test；(3) find_and_replace 快照 undo（readMatchSnapshot adapter 方法）。

Spike 前置：S5。研究标记：标准 Office.js 模式，无需额外 research。

### Phase 8c — Excel + PPT 工具完整

交付物：(1) B-Excel：10 个合并后工具定义；sort_range / find_and_replace_excel 快照 undo；(2) B-PPT：8 个工具定义（S1–S4 spike 结论决定 undo 策略）。

Spike 前置（必须在 8c 实现前完成）：S1, S2, S3, S4, S7。研究标记：PPT spike 结论可能产生 noop+gate fallback，需预留时间。

### Phase 8d — 批量操作（C）

交付物：`src/agent/tools/write/batch.ts`（batch_write ToolDef）；operationLog.ts（PostStateSnapshot.kind 'batch' + subOps + batch_reverse case）；DiffLogPanel.tsx（subOps 嵌套渲染）；批次失败处理。

依赖：Phase 8b + 8c 全部完成。研究标记：无需额外 research。

### Phase 8e — UI 打磨（E，可与 8b/8c 并行）

交付物：(P0) urlTransform XSS 修复；(E1) DiffLogPanel 跟随 loop；(E2) Markdown 表格 CSS；(E3) 读卡轻量化；(E4) 首屏骨架屏 + loading bubble。

研究标记：无需额外 research；STACK.md §E 给定全部实现路径。

### Phase 8f — UAT + Release

A–F 全覆盖杀手场景，三宿主 Office for Web（Chrome/Edge）真机 UAT。

---

## Open questions（需用户确认）

| # | 问题 | 影响 | 当前倾向 |
|---|------|------|---------|
| Q1 | `merge_cells` 是否进 v2.1（需快照 undo，M 复杂度，月级频率）？ | Excel 工具数量 | 建议 defer v2.2 |
| Q2 | `delete_worksheet` 是否彻底从工具列表移除，还是保留 noop+gate？ | agent 安全性 | 建议彻底移除 |
| Q3 | `delete_shape` / `delete_slide` noop+gate UX：warn 后继续，还是要求确认？ | agent 流畅度 | warn 后继续（不中断 agent 流程） |
| Q4 | F 的「20 轮」定义：20 条 user 消息，还是 20 个 user+assistant pair？ | loop.ts 截断逻辑 | 建议：20 条 user 消息 |
| Q5 | F per-doc 存储：spike S6 可行则 v2.1 内升级，还是留 v2.2？ | docKey 接口 | 建议：spike 可行则同 Phase 升级 |
| Q6 | A 用户偏好 UI 入口：Settings 面板新区块，还是内联 chip？ | UI 实现方式 | Settings 面板区块（偏好是持久配置） |
| Q7 | `create_pivot_table` 是否进 v2.1（H 复杂度）？ | Excel 工具数量 | 建议 defer v2.2 |
| Q8 | B 全局工具定义上限：~23 个可接受还是需压缩到 ≤20？ | token 经济 | 23 是合并后结果；token-count 测试后按数据决定 |

---

## Confidence map

| 领域 | 信心 | 理由 |
|------|------|------|
| Stack（0 新依赖） | **HIGH** | package.json 实际审计；代码库确认 |
| Word Office.js API（1.1–1.6） | **HIGH** | Microsoft Learn 官方文档直接确认 |
| Excel Office.js API（1.1–1.8） | **HIGH** | 同上；sort/conditional-format/pivot 都有专页文档 |
| PPT Office.js API（1.4 核心） | **HIGH** | 官方 shapes 文档（2025-05-06 更新） |
| PPT API 1.8 table + rotation + slide.background read | **MEDIUM** | 需 spike S1–S4 确认 |
| 工具参数化合并策略 | **HIGH** | ARCHITECTURE 引用 STRAP pattern（多来源佐证） |
| undo 快照策略 | **HIGH** | operationLog.ts 代码审计 + 官方 undo capabilities 文档 |
| F localStorage 稳定性 | **MEDIUM** | document.url spike 未跑 |
| B triage 频率判断 | **MEDIUM-HIGH** | WPS AI / Copilot 竞品研究 + 中文职场场景分析；非直接用户访谈 |
| A prompt injection 防御 | **MEDIUM** | 关键词检测是最基础防御，非完备 |

**Overall: MEDIUM-HIGH** — 架构和 stack 决策 HIGH 信心；主要不确定点集中在 PPT 几个 API（spike S1–S4 可消除）和 F per-doc key（spike S6 可消除）。

---

## Sources（聚合自全部 4 份文档）

### HIGH 信心

- Aster codebase（loop.ts, operationLog.ts, adapters/*.ts, store/chat.ts, lib/storage.ts）
- [Microsoft Learn — Excel JS API performance optimization](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/performance)
- [Microsoft Learn — Work with shapes (PPT JS API)](https://learn.microsoft.com/en-us/office/dev/add-ins/powerpoint/shapes)
- [Microsoft Learn — Word.Paragraph class](https://learn.microsoft.com/en-us/javascript/api/word/word.paragraph?view=word-js-preview)
- [Microsoft Learn — Undo capabilities Excel JS API](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/excel-add-ins-undo-capabilities)
- [OfficeDev/office-js GitHub issue #1098](https://github.com/OfficeDev/office-js/issues/1098)（无 document GUID 官方确认）
- [OfficeDev/office-js GitHub issue #2775](https://github.com/OfficeDev/office-js/issues/2775)（addTextBox 删除选中形状 bug）
- [OfficeDev/office-js GitHub issue #4258](https://github.com/OfficeDev/office-js/issues/4258)（uniqueLocalId desktop Word null）
- [OWASP LLM01:2025 — Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [Microsoft Learn — Error handling, batch queue limit 50](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/application-specific-api-error-handling)

### MEDIUM 信心

- [GitHub anthropics/skills pptx/SKILL.md](https://github.com/anthropics/skills/blob/main/skills/pptx/SKILL.md)
- [MCP Tool Schema Bloat — Layered.dev](https://layered.dev/mcp-tool-schema-bloat-the-hidden-token-tax-and-how-to-fix-it/)
- [I Reduced MCP Tools from 96 to 10 — Alma Tuck](https://almatuck.com/articles/reduced-mcp-tools-96-to-10-strap-pattern)
- [WPS AI 官网](https://ai.wps.cn)（中文职场 AI 高频场景）
- [Microsoft Copilot "vibe working" 2026-05-28](https://cloudwars.com/cloud/microsoft-introduces-agent-mode-and-office-agent-in-microsoft-365-copilot-to-power-vibe-working/)
- [Hatchworks — Agent UX Patterns 2025](https://hatchworks.com/blog/ai-agents/agent-ux-patterns/)
