# Roadmap: Aster

**Core Value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 **AI 代理** 能力，能完成绝大部分文档工作（多步任务、精细化操作）；无后台、BYO Key、纯浏览器直连。

## Milestones

- ✅ **v1.0 已交付的基座** — Phases 0 / 1 / 2 / 2.1（spike + foundation + Provider 抽象 + UAT gap closure）— 作为 v2 基座保留，未单独发布（Q8）
- ✅ **v2.0 Office 智能代理** — Phases 3 / 4 / 04.1 / 5 / 6 / 7（shipped 2026-05-30，线上 `f9fdcc4`，首次公开发布）
- 📋 **v2.1 从能用到好用** — Phases 8 / 9 / 10 / 11 / 12 / 13（current milestone）

## Phases

<details>
<summary>✅ v1.0 已交付的基座 (Phases 0–2.1) — 未单独发布，作为 v2 基座</summary>

完整内容见 [`ROADMAP-v1.0.md`](ROADMAP-v1.0.md)。

- [x] Phase 0: Spike & 风险验证（CORS / PPT 写回 / 存储 scope 三项 GATING + 7 项实证）
- [x] Phase 1: Foundation 与跨宿主骨架（Vite 7 + React 19 + TS strict + DocumentAdapter + 三宿主 adapter + 错误类层级 + bundle CI + i18n + Vitest + GitHub Pages）
- [x] Phase 2: Provider 抽象 + Settings + Onboarding + 错误 UX（OpenAI-compat + aihubmix + partitioned localStorage + 8 类错误 UX + SSE 流式 + 三宿主 insert）
- [x] Phase 2.1: UAT Gap Closure（滚动/对齐/流式滚到底/错误分类/AI tool-calling 写文档/选区胶囊 toggle 等 8 条 gap）

**v1.0 取消项：** Phase 2.2 整体取消（PROJECT.md Q12 / Q8）；3 件 UAT follow-up 转嫁 v2.0（CARRY-01..03）。

</details>

<details>
<summary>✅ v2.0 Office 智能代理 (Phases 3–7) — SHIPPED 2026-05-30，线上 f9fdcc4</summary>

完整内容见 [`milestones/v2.0-ROADMAP.md`](milestones/v2.0-ROADMAP.md)。需求存档见 [`milestones/v2.0-REQUIREMENTS.md`](milestones/v2.0-REQUIREMENTS.md)。

- [x] Phase 3: Agent Loop 地基 + Word 多步 demo（9 plans）— completed 2026-05-29
- [x] Phase 4: Read Tools 全套 + AgentControlBar 步骤文案（9 plans）— completed 2026-05-29
- [x] Phase 04.1: Aster redesign migration — teal 克制设计系统迁移（7 plans, INSERTED）— completed 2026-05-29
- [x] Phase 5: Diff Log + Undo All 跨 3 宿主（10 plans）— completed 2026-05-30
- [x] Phase 6: 多宿主 Write Tools + Killer Scenarios 重写（12 plans）— completed 2026-05-30
- [x] Phase 7: UAT + Sideload Release Prep（6 plans）— completed 2026-05-30 = 首次公开发布

**Requirements:** 31 项交付 30（ONB-01 Onboarding GIF 主动 descope → 已取消）。

</details>

### 📋 v2.1 从能用到好用 (Phases 8–13)

- [ ] **Phase 8: Foundation + 能力 A + 持久化 F** — 工具合并设计合约 + per-host domain prompt 深化 + 用户偏好注入（含 injection 防御）+ 聊天记录持久化（localStorage + 清空 + 20 轮截断 + docKey spike）
- [x] **Phase 9: Word 精准写 (D + B-Word)** — Word 选区精度（paragraphIndex + uniqueLocalId）+ Word 5 工具完整（字符格式 / 段落格式 / 套样式 / 查替换 / 插表格），含 undo 基础设施 (completed 2026-05-31)
- [ ] **Phase 10: Excel + PPT 工具完整 (B-Excel + B-PPT)** — Excel 10 工具（格式/列宽行高/排序/筛选/查替换/条件格式/建表/冻结/工作表/图表标题）+ PPT 8 工具（字体/对齐/形状增删/旋转/背景/幻灯片复制删除），含 spikes S1-S4/S7 + undo 基础设施
- [ ] **Phase 11: 批量操作 (C)** — batch_write 单闭包单 sync + OperationLog batch 条目 + DiffLogPanel 可展开批量卡 + 一键 undo 整批
- [ ] **Phase 12: UI 打磨 (E)** — XSS 防御 + loading 气泡 + DiffLogPanel 跟随 loop + Markdown 表格 CSS + 读卡轻量化 + 首屏骨架屏
- [ ] **Phase 13: v2.1 UAT + Release** — A–F 六大能力全覆盖端到端验证，三宿主 Office for Web（Chrome/Edge）真机 UAT + 发布

## Phase Details

### Phase 8: Foundation + 能力 A + 持久化 F
**Goal**: 工具合并设计合约落地（后续 B/C 工具有明确 token 预算 + undo 分类表），agent 变聪明（三宿主各自的专属系统 prompt + 用户偏好注入），聊天记录在刷新后仍保留
**Depends on**: Phase 7（v2.0 已交付基座）
**Requirements**: PROMPT-01, PREF-01, PREF-02, HIST-01, HIST-02, HIST-03, HIST-04, NFR-06, NFR-07, NFR-08
**Success Criteria** (what must be TRUE):
  1. 在 PPT 宿主问「帮我做 5 页 PPT」，agent 的系统 prompt 包含断言式标题 + ≤5 点/页 + verify-after-create 的 PPT 专属指导（可在「复制调试信息」中验证 prompt 内容）
  2. 用户在 Settings 填写偏好「用正式语气」后，下一轮对话的 system prompt 包含该偏好，且尝试注入「忽略上述指令」会被静默过滤不注入
  3. 刷新 Office for Web 页面后，聊天记录（user/assistant 消息）仍可见；「清空聊天记录」按钮执行后聊天窗口清空且 localStorage 无残留
  4. 第 21 轮及以后的 user 消息，loop.ts 传给 LLM 的 messages 数组最多保留 20 轮（工具消息不计轮次），不超出
  5. npm test 全绿（含 system-prompt injection 防御测试 + 20 轮截断测试 + 每个新 inverse 的 operationLog.integration.test 硬守门）；bundle ≤82 KB；system prompt 长度走**软提醒不卡构建**（原 <3000 字符硬 CI gate 已废，见 08-CONTEXT D-05）；能力合约表产出且每个工具 undo 类型声明齐全
**Plans**: 5 plans
Plans:
- [x] 08-01-PLAN.md — Wave 0 测试桩（system-prompt.test.ts 软化 + preferences/docKey/contract/loop-helpers 测试骨架）
- [x] 08-02-PLAN.md — 能力合约 + system-prompt 三宿主深化 + buildSystemPrompt 签名扩展
- [x] 08-03-PLAN.md — 偏好基础设施（preferences.ts + sanitizePrefs + storage 常量）
- [x] 08-04-PLAN.md — 持久化 F 全链路（docKey.ts + loop-helpers truncateTo20Turns + chat.ts 扩展 + loop.ts/main.tsx 接线）
- [ ] 08-05-PLAN.md — Settings UI 偏好文本框 + 预设 chips + Spike S6 真机验证

### Phase 9: Word 精准写 (D + B-Word)
**Goal**: agent 在 Word 里能改字体/段落格式/套样式/查替换/建表格，且多个相同文本段落时能精准定位到正确的那一段
**Depends on**: Phase 8（工具合并设计合约 + undo 分类表）
**Requirements**: WSEL-01, WORD-01, WORD-02, WORD-03, WORD-04, WORD-05
**Success Criteria** (what must be TRUE):
  1. agent 收到「把第二段加粗并改为 14 号字」时，能调用 `set_word_character_format` 且改的是第二段而不是第一个同名段落（`paragraphIndex` + `uniqueLocalId` 定位生效）
  2. agent 可一步完成「把所有正文段落改为 1.5 倍行距、段前 6pt」（`set_word_paragraph_format` 参数化，单工具调用）
  3. agent 可把选中段落套用「标题 1」样式（`apply_paragraph_style` 使用 `Word.BuiltInStyleName` enum，不因语言版本 crash）
  4. agent 执行「把全文所有"公司"替换成"企业"」后，「本次改动」卡显示改动数，且执行 undo 后文字全部还原（find_and_replace 快照式 undo 生效）
  5. agent 插入一个 3×3 表格后，undo 执行后表格消失（delete_table_by_marker 逆向生效）；每个新 inverse 有 operationLog.integration.test 守门
**Plans**: 7 plans
Plans:
- [x] 09-01-PLAN.md — Wave 0 测试骨架（5 条 integration 守门 RED + selection_detail 单测 + D-08 placeholder）
- [x] 09-02-PLAN.md — operationLog.ts 地基（DocumentAdapterForReplay + executeReverse 5 case + PostStateSnapshot.kind）
- [x] 09-03-PLAN.md — WSEL-01 selection_detail 扩展（paragraphIndex + uniqueLocalId + 降级路径）
- [x] 09-04-PLAN.md — WORD-01/02：set_word_character_format + set_word_paragraph_format（2 个简单逆向工具）
- [x] 09-05-PLAN.md — WORD-03：apply_paragraph_style（D-08 allowlist + locale-safe styleBuiltIn）
- [x] 09-06-PLAN.md — WORD-04：find_and_replace（快照式 undo，100 段超限 noop+gate）
- [x] 09-07-PLAN.md — WORD-05：insert_table（内容指纹逆向）+ Phase 9 合约完整收尾
**UI hint**: yes

### Phase 10: Excel + PPT 工具完整 (B-Excel + B-PPT)
**Goal**: agent 能完成 Excel 高频格式化操作（数字格式/排序/筛选/条件格式/建表/工作表管理）和 PPT 高频形状操作（字体/形状增删/旋转/幻灯片管理），所有破坏性操作有 undo 或明确的 noop+gate
**Depends on**: Phase 8（工具合并设计合约）、Phase 9 不是硬依赖但建议串行（复用 undo 模式）
**Requirements**: EXCEL-01, EXCEL-02, EXCEL-03, EXCEL-04, EXCEL-05, EXCEL-06, EXCEL-07, EXCEL-08, EXCEL-09, EXCEL-10, PPT-01, PPT-02, PPT-03, PPT-04, PPT-05, PPT-06, PPT-07, PPT-08
**Success Criteria** (what must be TRUE):
  1. agent 可一步把 A1:D10 的数字格式改为「千分位 + 2 位小数」并填充黄色背景（`format_excel_range` 单工具调用，undo 后格式还原）
  2. agent 按 B 列降序排序一个含 500 行的表格后，「本次改动」卡显示 sort 操作，且 undo 后行顺序完整还原（sort_range 快照 undo 生效）
  3. agent 可在 PPT 当前幻灯片插入一个文本框写「季度总结」，undo 后该文本框消失（add_shape 简单逆向；addTextBox 已绕过 #2775 bug）
  4. agent 调用 `delete_shape` 或 `delete_slide` 时，DiffLogPanel 显示「此操作不可自动撤销」警告但 agent 流程不中断（noop+gate 行为正确）
  5. Spikes S1/S2/S4 结论已记录：`rotate_shape` / `set_slide_background` / `set_shape_text_alignment` 各自采用简单逆向或 noop+gate；每个新 inverse 有 operationLog.integration.test 守门；bundle ≤82 KB
**Plans**: 5 plans
Plans:
- [x] 10-01-PLAN.md — Wave 0 undo 基础设施骨架（operationLog +15 接口/case/kind + integration.test 18 工具守门骨架）
- [x] 10-02-PLAN.md — Wave 1 Excel 简单逆向 6 工具（format_excel_range/set_column_row_size/set_auto_filter/add_conditional_format/create_table/freeze_panes）
- [x] 10-03-PLAN.md — Wave 2 Excel 快照式 + manage_worksheet + set_chart_title（sort_range/excel_find_and_replace/manage_worksheet/set_chart_title）
- [x] 10-04-PLAN.md — Wave 3 PPT 简单逆向 3 工具（set_shape_text_font/add_shape/copy_slide）
- [ ] 10-05-PLAN.md — Wave 4 PPT spike 门控 + noop+gate（set_shape_text_alignment/rotate_shape/delete_shape/manage_slides/set_slide_background）
**UI hint**: yes

### Phase 11: 批量操作 (C)
**Goal**: agent 可以在单次工具调用中批量执行多个写操作，解决当前逐单元格操作慢、工具卡片爆炸的问题；整批操作可一键 undo
**Depends on**: Phase 9 + Phase 10（batch 内部 dispatch 依赖已注册工具的 execute 函数，B 工具必须全部就位）
**Requirements**: BATCH-01, BATCH-02
**Success Criteria** (what must be TRUE):
  1. agent 调用 `batch_write` 一次性格式化 10 个单元格区域（各不同格式），Office 只触发单次 context.sync，DiffLogPanel 显示「批量改动 10 处」（而不是 10 张独立工具卡）
  2. 批次中第 5 步失败时，前 4 步的改动保留、第 5-10 步不执行，DiffLogPanel 报告失败位置（不静默跳过继续写入）
  3. 对「批量改动 10 处」执行 undo，全部 10 处改动一键还原（batch_reverse case 在 OperationLog 正确记录 subOps）
  4. DiffLogPanel 的批量卡支持展开，展开后显示每个子操作的 humanLabel
**Plans**: 5 plans
Plans:
- [ ] 11-01-PLAN.md — Wave 0 Nyquist 测试桩（batch.test.ts / ExcelAdapter.batch.test.ts / DiffLogPanel.test.tsx 新建 + contract.test.ts / CONTRACT.md 修改）
- [ ] 11-02-PLAN.md — Wave 1 OperationLog 类型扩展（PostStateSnapshot.kind 'batch' + OperationLogEntry.subOps + batch_reverse case + ToolResult.subOps + loop-helpers 透传）
- [ ] 11-03-PLAN.md — Wave 2 ExcelAdapter executeBatch 两阶段 + executeBatchReverse + batch.ts ToolDef + 三宿主注册
- [ ] 11-04-PLAN.md — Wave 3 DiffLogPanel 嵌套渲染 + styles.css .batch-sub-ops CSS
- [ ] 11-05-PLAN.md — Wave 4 operationLog.integration.test.ts batch_reverse 逆序守门 + contract.test integrationTest=true
**UI hint**: yes

### Phase 12: UI 打磨 (E)
**Goal**: 消除界面体验摩擦——XSS 安全漏洞修复、交互反馈及时（loading 气泡）、改动卡跟随当次对话（不沉底）、Markdown 渲染整洁（表格有边框）、读工具卡视觉降权、首屏有骨架屏
**Depends on**: Phase 8（可与 9/10/11 并行；UI-01 XSS 修复是 P0 第一行改动应尽早完成）
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06
**Success Criteria** (what must be TRUE):
  1. react-markdown 渲染的链接不会执行 `javascript:` URI（urlTransform 防御生效；CVE-2025-24981 同类问题修复）
  2. 用户发送消息后、首个 token 到达前，聊天区域出现「AI 思考中」loading 气泡（agentStatus==='running' + 空 content isStreaming assistant 消息时渲染）
  3. 多次 agent run 后，每次「本次改动」DiffLogPanel 卡紧跟在对应 loop 的回复后方，不全部沉到消息流底部
  4. Markdown 表格在聊天气泡中有可见边框（border-collapse + cell border，使用 --border/--surface-2 变量）；代码块和列表渲染一致整洁
  5. 首屏在 Office.onReady 完成前显示 CSS shimmer 骨架屏，避免白屏；bundle 不因 E phase 增长超过 82 KB
**Plans**: 5 plans
Plans:
- [ ] 12-00-PLAN.md — Wave 0 测试桩（safeUrlTransform.ts + 测试文件 + ChatStream/loop-helpers 扩展）
- [ ] 12-01-PLAN.md — Wave 1 UI-01 实现（ChatBubble urlTransform 接线，RED→GREEN）
- [ ] 12-02-PLAN.md — Wave 1 UI-05 数据层 + UI-06 骨架屏（Message.kind + loop-helpers kind + index.html）
- [ ] 12-03-PLAN.md — Wave 2 UI-02 思考气泡 + UI-04 表格 CSS + UI-05 UI 层（ChatStream.tsx + styles.css）
- [ ] 12-04-PLAN.md — Wave 3 UI-03 DiffLogPanel 边界插入（ChatStream.tsx nodes 循环改造）
**UI hint**: yes

### Phase 13: v2.1 UAT + Release
**Goal**: v2.1 全部 A–F 能力经过三宿主真机端到端验证，确认「从能用到好用」已兑现；发布到 GitHub Pages
**Depends on**: Phase 8 + Phase 9 + Phase 10 + Phase 11 + Phase 12（全部完成）
**Requirements**: （UAT 覆盖前述所有 42 个 v2.1 需求的端到端验证，无独立新增需求）
**Success Criteria** (what must be TRUE):
  1. Excel 杀手场景：agent 一次对话完成「给 A1:E20 加数字格式 + 排序 + 高亮前 5 名」，批量操作生效，DiffLogPanel 记录改动，undo 全部还原——Office for Web Chrome + Edge 双浏览器 PASS
  2. Word 杀手场景：agent 一次对话完成「把第 3 段改为标题 1 样式 + 全文把'产品'替换成'方案'」，选区精准定位，查替换快照 undo 生效——三宿主 PASS
  3. PPT 杀手场景：agent 一次对话完成「在第 2 页插入文本框写内容 + 把所有形状字号改为 18」，add_shape + set_shape_text_font 生效，undo 正确——三宿主 PASS
  4. 偏好注入验证：Settings 填写偏好后，下一轮对话语气/格式符合偏好；聊天记录刷新后保留
  5. npm test 全绿；bundle ≤82 KB；system prompt 长度软提醒不卡构建（原 <3000 字符硬 gate 已废，见 08-CONTEXT D-05）；发布 commit push 到 main，GitHub Pages 部署成功
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 0. Spike & 风险验证 | v1.0 | — | Complete | (v1 base) |
| 1. Foundation 跨宿主骨架 | v1.0 | — | Complete | (v1 base) |
| 2. Provider + Settings + Onboarding | v1.0 | — | Complete | (v1 base) |
| 2.1 UAT Gap Closure | v1.0 | — | Complete | (v1 base) |
| 3. Agent Loop 地基 + Word demo | v2.0 | 9/9 | Complete | 2026-05-29 |
| 4. Read Tools 全套 + AgentControlBar | v2.0 | 9/9 | Complete | 2026-05-29 |
| 04.1 teal 设计系统迁移 | v2.0 | 7/7 | Complete | 2026-05-29 |
| 5. Diff Log + Undo All 跨 3 宿主 | v2.0 | 10/10 | Complete | 2026-05-30 |
| 6. 多宿主 Write Tools + Killer Scenarios | v2.0 | 12/12 | Complete | 2026-05-30 |
| 7. UAT + Sideload Release Prep | v2.0 | 6/6 | Complete | 2026-05-30 |
| 8. Foundation + 能力 A + 持久化 F | v2.1 | 3/5 | In Progress|  |
| 9. Word 精准写 (D + B-Word) | v2.1 | 7/7 | Complete   | 2026-05-31 |
| 10. Excel + PPT 工具完整 (B-Excel + B-PPT) | v2.1 | 4/5 | In Progress|  |
| 11. 批量操作 (C) | v2.1 | 0/5 | Planning done | - |
| 12. UI 打磨 (E) | v2.1 | 0/5 | Planning done | - |
| 13. v2.1 UAT + Release | v2.1 | 0/? | Not started | - |

---

*Last updated: 2026-05-31 — Phase 12 规划完成（5 plans，Wave 0-3 结构；UI-01..06 全覆盖）。next = `/gsd-execute-phase 8`（Phase 8 尚有 1 plan 未完成）。*
