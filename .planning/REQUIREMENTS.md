# Requirements: Aster v2.1「从能用到好用」

**Defined:** 2026-05-30
**Core Value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 AI 代理能力，能完成绝大部分文档工作；无后台、BYO Key、纯浏览器直连。
**Milestone goal:** 在 v2.0 agent 地基上从「能用」走到「好用」——agent 更懂三宿主、能改更多、改得更快更准、体验更顺、记得住历史。多模态（看图/生图/文件/图库）拆到 v2.2。
**Research:** `.planning/research/SUMMARY.md`（4 维度研究综合，0 净新增运行时依赖，B 工具 triage + undo 分类 + 7 个 spike）

> **Undo 约定（贯穿 B 全部 write tool）：** 每个新 write tool 必须声明 undo 类型——**简单逆向**（restore_* adapter 方法 + inverse op）、**快照式**（写前 before-image，OperationLog 存快照）、或 **noop+gate**（不可自动撤销，执行时 warn「此操作不可自动撤销」但不中断 agent）。每个新 inverse 必须补 `operationLog.integration.test` 守门（memory: project_adapter_inverse_signature）。

---

## v2.1 Requirements

### A 能力变聪明（系统 prompt + 偏好）

- [x] **PROMPT-01**: Agent 在 PPT/Excel/Word 三宿主各有一套深化的 domain system prompt（PPT：断言式标题 + ≤5 点/页 + verify-after-create；Excel：先 get_used_range_summary + 分块读 + pipeline；Word：先取大纲 + 保留论点只改语言）；每宿主 segment 6–10 行；system prompt 长度走**软提醒**（超参考值仅 warn + 显示大概 token 成本，不卡构建；见 08-CONTEXT D-05，原 <3000 字符硬 CI gate 已废）
- [x] **PREF-01**: 用户可在 Settings 面板填写自定义偏好（如语气、术语、默认格式），持久化后自动注入每次对话的 system prompt，无需每次重复输入
- [x] **PREF-02**: 偏好注入带 prompt-injection 防御——偏好文本以「用户偏好（仅供参考）」块包裹、拒绝含「忽略指令/你的新角色」等关键词、**≤500 字符上限**（08-CONTEXT D-08 放宽自原 200；此上限为防注入安全面，非防成本），命中注入词完全静默过滤不注入、不提示用户，并有 injection 守门测试

### B 能力补全 · Word（write tools）

- [x] **WORD-01**: Agent 可设置选区字符格式（加粗/斜体/下划线/字号/颜色/字体名）via 参数化 `set_word_character_format`（简单逆向）
- [x] **WORD-02**: Agent 可设置段落格式（对齐/行距/段前段后距/缩进）via 参数化 `set_word_paragraph_format`（简单逆向）— ★超高频
- [x] **WORD-03**: Agent 可套用内置段落样式（标题1-9/正文/引用等）via `apply_paragraph_style`，仅允许 `Word.BuiltInStyleName` enum 值（locale-safe，简单逆向）— ★超高频
- [x] **WORD-04**: Agent 可全文查找替换 via `find_and_replace`（替换前枚举所有匹配的 before-image，快照式 undo）— ★超高频
- [x] **WORD-05**: Agent 可插入表格并填内容 via `insert_table`（简单逆向 delete_table_by_marker）

### B 能力补全 · Excel（write tools）

- [x] **EXCEL-01**: Agent 可设置单元格格式（数字格式/字体/填充色/边框/对齐）via 参数化 `format_excel_range`（简单逆向）— ★超高频
- [x] **EXCEL-02**: Agent 可设置列宽/行高/自动适应 via `set_column_row_size`（简单逆向）
- [x] **EXCEL-03**: Agent 可按列排序 via `sort_range`（快照式 undo，≤10,000 单元格；超限 noop+gate）— ★超高频
- [x] **EXCEL-04**: Agent 可应用自动筛选/条件筛选 via `apply_filter`（简单逆向 restore_autofilter）
- [x] **EXCEL-05**: Agent 可查找替换 via `find_and_replace_excel`（所有匹配地址+原值 before-image，快照式 undo）
- [x] **EXCEL-06**: Agent 可添加条件格式（色阶/数据条/高亮规则）via `add_conditional_format`（简单逆向 delete_at_index）
- [x] **EXCEL-07**: Agent 可把区域建成表格 via `create_table`（简单逆向 delete_table_by_name）
- [x] **EXCEL-08**: Agent 可冻结首行/首列/指定窗格 via `freeze_panes`（简单逆向）
- [x] **EXCEL-09**: Agent 可新增/重命名工作表 via `add_worksheet` / `rename_worksheet`（简单逆向）— ⚠ 不含 delete_worksheet（见 Out of Scope）
- [x] **EXCEL-10**: Agent 可修改图表标题 via `set_chart_title`（简单逆向 restore_chart_property）

### B 能力补全 · PowerPoint（write tools）

- [x] **PPT-01**: Agent 可设置形状文字字体格式（字体名/字号/颜色/加粗/斜体/下划线）via `set_shape_text_font`（简单逆向）— ★超高频
- [x] **PPT-02**: Agent 可设置形状文字段落对齐 via `set_shape_text_alignment`（**spike S4 门控**：可读写=简单逆向，否则 noop+gate 或 defer）
- [x] **PPT-03**: Agent 可新增几何形状/文本框 via 参数化 `add_shape`（含 text box；addTextBox 前必须 deselect 绕过 #2775 静默删形状 bug；简单逆向 delete_shape_by_id）
- [x] **PPT-04**: Agent 可删除形状 via `delete_shape`（**noop+gate**：warn「不可自动撤销」不中断）
- [x] **PPT-05**: Agent 可旋转形状 via `rotate_shape`（**spike S1 门控**：shape.rotation 可写=简单逆向，否则 noop+gate）
- [x] **PPT-06**: Agent 可删除幻灯片 via 正向 `delete_slide`（**noop+gate**：无 slide export API / STATE SP-5；warn 不中断）
- [x] **PPT-07**: Agent 可复制幻灯片 via `duplicate_slide`（简单逆向 delete_slide_by_id）
- [x] **PPT-08**: Agent 可设置幻灯片背景填充色 via `set_slide_background`（**spike S2 门控**：background 可读=简单逆向，否则 noop+gate）

### C 批量操作

- [ ] **BATCH-01**: Agent 可在单个 tool call 内批量执行多个写操作 via `batch_write({ops:[...]})`——单 `Excel.run`/`Word.run` 闭包 + 单 `context.sync()`；上限 20 ops/批次；第 i 步失败立即停止并报告（不静默续写）
- [ ] **BATCH-02**: 批量操作在 OperationLog 记 1 条 batch 条目（含 subOps reverse 列表 + `batch_reverse` case），DiffLogPanel 渲染「批量改动 N 处」可展开卡——一键 undo 整批

### D Word 选区精度

- [x] **WSEL-01**: Word `selection_detail` read tool 返回 `paragraphIndex` + `uniqueLocalId`（WordApi 1.6，**spike S5 门控**），让 agent 在多个相同文本时定位准确——快路径 text fingerprint，后备 `compareLocationWith`；desktop 返回 null 时降级（v2.1 仅 Web）

### E UI 打磨

- [ ] **UI-01**: react-markdown 加 `urlTransform` XSS 防御（P0，第一行改动；CVE-2025-24981 同类）
- [ ] **UI-02**: 消息发出后立即显示 AI「思考中」loading 气泡（`agentStatus==='pending'` 即渲染，不等首 token），让用户知道 agent 在继续
- [ ] **UI-03**: 「本次改动」DiffLogPanel 卡跟随当次 loop（按 `agentRunId` 边界插入消息流），多次 loop 不再都沉底
- [ ] **UI-04**: Markdown 整体渲染优化——表格加边框（`.bubble-ai table` border-collapse + cell border，复用 `--border`/`--surface-2`），及列表/代码块一致性
- [ ] **UI-05**: 读取工具卡轻量化（无边框、`--text-3` 字色、占位更小、降视觉权重；write 卡不降权）
- [ ] **UI-06**: 首屏骨架屏（Office.onReady 前纯 CSS shimmer，不引新库）

### F 聊天记录持久化

- [x] **HIST-01**: 聊天记录持久化到 localStorage（复用 `src/lib/storage.ts` 的 partitionKey 前缀）——只序列化 user/assistant 文字消息（白名单字段，丢弃 reverse/postState/ToolResult.data），每条 ≤2000 字符，hydrate 于 main.tsx；QuotaExceeded 自动丢最旧
- [x] **HIST-02**: 用户可一键清空聊天记录
- [x] **HIST-03**: 传给 LLM 的上下文上限 20 轮（1 轮 = 1 条 user 消息，tool 消息不计；超出从最早 user 消息起整 run 删除），在 loop.ts wire message 构建处截断
- [x] **HIST-04**: 分文档存储——docKey = `'aster:chat:'+btoa(url.slice(-80))` 变体（禁用 raw URL，防 session token 泄露；**spike S6 门控**：document.url 稳定=启用分文档，不稳定=回退全局单 key）

### 非功能（NFR，carry from v2.0）

- [x] **NFR-06**: 初始 bundle ≤82 KB gzip 维持，0 净新增运行时依赖（A–F 全靠现有 stack 交付）
- [x] **NFR-07**: system prompt 长度走**软提醒**（超某参考值只警告 + 显示大概 token 成本，**不卡构建**）——原 `<3000 字符硬 CI gate` 已废（08-CONTEXT D-05；项目原则「质量 >> 成本&包体积」见 memory project_quality_over_cost）。仍守「内容对非内容多」：高价值 domain 指导尽管加，不为凑长度灌水
- [x] **NFR-08**: B 工具**参数化合并**（同类操作合一，如 `set_word_character_format` 包 6 个 font 操作）——理由为「工具更少更清晰 → AI 选工具更准」（质量收益），全局约 23 条工具定义为**设计目标非硬上限**。**原 per-host toolDefs ≤15 KB CI 门已去掉**（08-CONTEXT D-18；不检查工具定义 token）

---

## Deferred Requirements（v2.2 / later — 不在本 milestone roadmap）

### v2.2 多模态四件套（已规划独立 milestone）

- **MM-01**: 视觉/看图——agent 可「看」选中图片/图表作 evidence（aihubmix-vision 接 agent；FUT-14；是否验 DeepSeek-V4 原生多模态一并定）
- **MM-02**: 文件上传与解析——chat 附件 docx/xlsx/pdf/pptx/图片 → 懒加载解析作 agent context（FUT-15；明确「附件」vs「agent 自取当前文档」UX 边界）
- **MM-03**: 图片生成并插入——PPT/Word「生成图并插入」write tool（aihubmix-image，model 对齐 gpt-image-2；FUT-16）
- **MM-04**: 公开图库检索接入——Unsplash/Pexels 检索免费正版图并插入（FUT-17 / 原 Q1；与 MM-03 互补）
- **MM-05**: AiHubMix model 修正——区分多模态视觉 model（gpt-5.2）与生图 model（gpt-image-2 + gemini-3.1-flash-image-preview），修正默认 model 清单

### B 工具 defer（用户拍板 / 研究推荐 → v2.2）

- **EXCEL-D1**: `merge_cells` 合并单元格（快照式 undo，月级频率）— defer v2.2
- **EXCEL-D2**: `remove_duplicates` 删重（快照式 undo，行永久删）— defer v2.2
- **EXCEL-D3**: `create_pivot_table` 透视表（H 复杂度，快照式 undo）— defer v2.2
- **WORD-D1**: 文字高亮色 / 项目符号·编号列表 / 插入批注 — defer v2.2
- **WORD-D2**: edit_table / insert_image（依赖 FUT-15）/ 页眉页脚 — defer v2.2
- **PPT-D1**: add_line / 渐变·图片填充 set_shape_fill_advanced — defer v2.2
- **PPT-D2**: insert_table_ppt（PowerPointApi 1.8，**spike S3 门控**，通过则评估提前）— defer v2.2
- **PPT-D3**: insert_slides_from_template / add_image（依赖 FUT-15/16）— defer v2.2
- **WSEL-D1**: 绝对字符偏移（Office.js 无原生 API）— defer v2.2

---

## Out of Scope

明确不做（平台不支持 / 安全 / 已取消）：

| Feature | Reason |
|---------|--------|
| `delete_worksheet`（整表删除 tool） | 整表内容永久丢失、Office.js 明确不支持 undo；用户决定不暴露（手动删更安全） |
| `modify_named_style`（改全文命名样式） | 影响全文、逆向不实际（noop 也救不回） |
| `toggle_track_changes`（修订开关） | GitHub issue #5874 已知 bug，不可靠 |
| PPT 动画 / 转场 / SmartArt / 套主题模板 | Office.js 平台完全无 API（issue #6185 仍是 feature request） |
| PPT 读取背景色/主题色 | 无文档化 read API（只能写背景，不能可靠读） |
| Word/Excel 页边距 / 纸张方向 / 纸张大小 | Word/Excel JS API 对 pageSetup 支持极弱 |
| 绝对字符偏移定位（Word） | Office.js 无原生 char-offset API（issue #390）；用 paragraphIndex+uniqueLocalId 折中 |
| 动态可加载 Skill 文件系统 | bundle + 运行时网络请求复杂度不值得（D-09 决策维持）；只取 Skills 设计思路写进静态 prompt |
| ONB-01 / FUT-13 Onboarding GIF | **Cancelled**——不进任何后续 milestone（2026-05-30 用户决定）；心智锚定由 chips + 中文 humanLabel 承担 |
| 多模态（看图/生图/文件/图库） | 拆为独立 v2.2 milestone（见 Deferred MM-01..05），不在 v2.1 |

---

## Traceability

由 roadmapper 在创建 roadmap 时填充（每个 v2.1 requirement 映射到恰好一个 phase）。

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROMPT-01 | Phase 8 | Complete |
| PREF-01 | Phase 8 | Complete |
| PREF-02 | Phase 8 | Complete |
| HIST-01 | Phase 8 | Complete |
| HIST-02 | Phase 8 | Complete |
| HIST-03 | Phase 8 | Complete |
| HIST-04 | Phase 8 | Complete |
| NFR-06 | Phase 8 | Complete |
| NFR-07 | Phase 8 | Complete |
| NFR-08 | Phase 8 | Complete |
| WSEL-01 | Phase 9 | Complete |
| WORD-01 | Phase 9 | Complete |
| WORD-02 | Phase 9 | Complete |
| WORD-03 | Phase 9 | Complete |
| WORD-04 | Phase 9 | Complete |
| WORD-05 | Phase 9 | Complete |
| EXCEL-01 | Phase 10 | Complete |
| EXCEL-02 | Phase 10 | Complete |
| EXCEL-03 | Phase 10 | Complete |
| EXCEL-04 | Phase 10 | Complete |
| EXCEL-05 | Phase 10 | Complete |
| EXCEL-06 | Phase 10 | Complete |
| EXCEL-07 | Phase 10 | Complete |
| EXCEL-08 | Phase 10 | Complete |
| EXCEL-09 | Phase 10 | Complete |
| EXCEL-10 | Phase 10 | Complete |
| PPT-01 | Phase 10 | Complete |
| PPT-02 | Phase 10 | Complete |
| PPT-03 | Phase 10 | Complete |
| PPT-04 | Phase 10 | Complete |
| PPT-05 | Phase 10 | Complete |
| PPT-06 | Phase 10 | Complete |
| PPT-07 | Phase 10 | Complete |
| PPT-08 | Phase 10 | Complete |
| BATCH-01 | Phase 11 | Pending |
| BATCH-02 | Phase 11 | Pending |
| UI-01 | Phase 12 | Pending |
| UI-02 | Phase 12 | Pending |
| UI-03 | Phase 12 | Pending |
| UI-04 | Phase 12 | Pending |
| UI-05 | Phase 12 | Pending |
| UI-06 | Phase 12 | Pending |

**Coverage:**
- v2.1 requirements: 42 total（A:3 / Word:5 / Excel:10 / PPT:8 / C:2 / D:1 / E:6 / F:4 / NFR:3）
- Mapped to phases: 42
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-30*
*Last updated: 2026-05-30 — Traceability table filled by roadmapper（42/42 requirements mapped to Phases 8–12；Phase 13 = UAT/Release 无独立新需求）*
*Revised: 2026-05-30 — Phase 8 discuss 后修订 3 条 NFR/PREF（08-CONTEXT D-05/D-08/D-18）：NFR-07 硬 gate→软提醒、PREF-02 偏好上限 200→500、NFR-08 去掉 toolDefs ≤15KB token 门。项目原则「质量 >> 成本&包体积」确立。*
