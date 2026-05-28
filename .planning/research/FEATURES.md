# Feature Research — Aster v2.0 Office 智能代理

**Domain:** In-Office multi-step AI agent (PowerPoint / Excel / Word), Chinese-first, BYO Key, no backend
**Researched:** 2026-05-28
**Confidence:** HIGH for competitor agent-UX patterns (Cursor / Cline / Claude Code / Copilot Agent Mode GA April 2026 are all documented and shipping); MEDIUM for Chinese-office-worker-specific behaviors (extrapolated from WPS AI + DeepSeek-V4 community usage, not measured); HIGH for Office.js read/write API surface as agent-tool inventory.

> **Scope note.** v1 FEATURES.md (历史) catalogued single-step competitor coverage and 9 killer scenarios. This file is **not** a redo — it answers a different question: *given that the agent loop / Provider / SSE / writeback / 选区胶囊 base is built (Phase 0-2.1), what does a user expect from "代理" that the v1 single-step UI does not deliver?*
>
> Every feature below explicitly states which v1 component it reuses or extends, and how it interacts with the locked v2 边界（Q7 单文档 / Q9 max_steps=20 / Q10 默认全开 read tool / Q11 同 tool 重试 ≤2）。

---

## 0. v1 Components Reused (Anchor — Do Not Re-spec)

These are FROZEN base, referenced by every feature below. Don't re-describe them.

| v1 Asset (Phase 0-2.1) | What it does | How v2 features depend on it |
|---|---|---|
| **Task Pane chat shell** | Right-side panel, streaming bubbles, selection pill | Hosts agent step log + diff log + pause/cost meter |
| **SSE 流式输出** | First token ≤ 2s, fetch + ReadableStream parseSSE() | Same path for every agent step; per-step tokens stream same way |
| **Provider 抽象层** | DeepSeek + aihubmix + 用户加 OpenAI-compatible | Tool-calling protocol layered on top; same Key, same endpoint |
| **错误分类 (F7)** | Key 失效 / quota / context / network | Error code surface that LLM sees in tool result feedback (A2 / Q11) |
| **选区胶囊 + Selection context** | "当前选中" pill on input | Becomes one read tool among many; agent can ask "what's selected?" |
| **三宿主 Adapter (PPT/Excel/Word)** | Single-step insert / replace | Multiplied: each adapter exposes N tools, not 1 |
| **Cost badge per assistant message** | Tokens + ¥ per Provider response | Aggregates into agent-session cost meter (A4) |
| **partitioned localStorage Key 存储** | API Key persistence | Unchanged |
| **Markdown render (react-markdown + remark-gfm)** | LLM output rendering | Used for diff log step summaries |
| **Onboarding (Key paste + 引导)** | First-launch flow | v2 inserts 全文读取授权 step (Q10) — see F4-PRIV |

---

## 1. The Agent UX Paradigm Shift (Background)

A user prompting an **agent** has fundamentally different expectations than prompting a **single-step tool**. Industry consensus (Cursor / Cline / Claude Code / Copilot Agent Mode GA April 2026 / Devin / Manus):

| Dimension | Single-step (v1) | Agent (v2) |
|---|---|---|
| **Trust mental model** | "AI 给我一段文字，我自己贴" | "AI 替我做完，我事后审" |
| **Time horizon** | Seconds (one prompt → one reply) | Minutes (many steps in background) |
| **Failure cost** | Low (你贴或不贴) | High (它已经动了文档) |
| **Required affordances** | Insert button, copy button | Pause, cost meter, diff log, undo all |
| **Cost surface** | Per-reply badge | Running tab + budget cap + auto-stop |
| **Permission surface** | "选中内容会发往 Provider" | "整个文档随时可能被读" |

**Implication for Aster v2:** v1's UI是 "AI writer" mental model；v2 必须是 "AI worker" mental model。中文职场用户对前者已有 ChatGPT/WPS AI 心智锚定，对后者大多没有——所以 **教育成本和 trust UX 是 v2 最贵的设计预算**，不是 tool 数量。

---

## 2. Kill Scenarios — End-to-End Agent Jobs (Concrete Prompts)

These are the demos that sell v2.0. For each: example prompt + expected agent trajectory + which read/write tools it exercises + complexity.

### 2.1 PPT — "From Keyword to Complete Deck"

> **User prompt:** "帮我做一份「Q3 销售复盘」的 PPT，给 leadership 看的，重点是华东区表现"

**Expected agent trajectory (8-15 steps, ¥1-3):**
1. `get_presentation_outline()` → 现状（空白 / 已有几页？）
2. LLM 自决：从空白起，先规划 8-10 页大纲（封面 / 目录 / 整体表现 / 华东 / 北区 / 风险 / 下季规划 / Q&A）
3. `insert_slide(layout="title", title="Q3 销售复盘", subtitle="华东聚焦")` 
4. `insert_slide(layout="content", title="..", bullets=[..])` × N
5. (可选) `insert_image_placeholder(slide_id=3)` → 触发图像生成或图库检索
6. `get_presentation_outline()` 再次自查 → 是否覆盖了用户要求的「华东聚焦」
7. 完成汇报 + diff log

**Read tools exercised:** `get_presentation_outline`, `get_slide_shapes`
**Write tools exercised:** `insert_slide`, `insert_text_box`, `set_shape_text`, (lazy) `generate_image`
**Complexity:** L — 多种 layout 选择、占位符规划、图像 fallback、token 预算容易破
**v1 reuse:** Provider + SSE + 错误分类 + PPT Adapter writeback + cost badge
**Failure modes:** 模板差异、layout 名不一致、image gen quota、用户中途 pause 后状态恢复

### 2.2 Word — "Polish + Restructure"

> **User prompt:** "整篇润色一下，把口语化改成正式书面，顺便检查逻辑顺序、调整结构"

**Expected agent trajectory (6-12 steps, ¥0.5-2):**
1. `get_document_outline()` → 段落层级 / 标题结构
2. `get_paragraph_count()` → 决定分批处理大小
3. LLM 自决：把全文按 5 段一批读入
4. `get_paragraph_range(start=0, end=5)` × N → 取文本
5. 每批生成润色后版本 → `replace_paragraph(id, new_text)` 多次
6. （可选）`reorder_paragraphs([3,1,2,4,5])` 如果 LLM 判断逻辑顺序需调整
7. 完成汇报 + step-by-step diff

**Read tools exercised:** `get_document_outline`, `get_paragraph_range`, `get_paragraph_count`
**Write tools exercised:** `replace_paragraph`, `insert_paragraph`, (差异化) `reorder_paragraphs`
**Complexity:** M — 段落 ID 稳定性、长文 context 超限、reorder 风险高（建议 v2.0 不开放，v2.1 评估）
**v1 reuse:** Word Adapter（已有 replace），扩展为 batch replace
**Failure modes:** context 超限（长文）、段落 ID 漂移（用户在 agent 跑时改了文档）

### 2.3 Excel — "Clean + Chart + Insight"

> **User prompt:** "把这份数据清洗一下，看看哪个产品卖得最好，做个图，再给我三句话洞察"

**Expected agent trajectory (10-18 steps, ¥0.5-1.5):**
1. `get_sheet_schema()` → 表头 + 行数 + 数据类型推断
2. `get_used_range_sample(rows=20)` → 头 20 行实际数据看脏度
3. LLM 自决：发现「单位混用 / 空行 / 重复」等问题
4. `set_range_values(range="C2:C100", values=[..])` 清洗
5. `apply_formula(cell="E2", formula="=SUMIF(..)")` × N
6. `insert_chart(type="bar", range="A1:B11", target_cell="G2")`
7. `get_range_values("G2:K20")` 自查图表区域无冲突
8. 文本气泡输出三句话洞察 + diff log

**Read tools exercised:** `get_sheet_schema`, `get_used_range`, `get_range_values`, `get_chart_inventory`
**Write tools exercised:** `set_range_values`, `apply_formula`, `insert_chart`, `format_range`
**Complexity:** L — 公式正确性、清洗判断风险高、图表类型选择、用户 undo 边界
**v1 reuse:** Excel Adapter（已有 setValues）、Provider、cost badge
**Failure modes:** SUMIF 类公式拼错（Q11 重试机制兜底）、范围超出 used range、图表覆盖现有数据

### 2.4 Shape 精细化操作 (Differentiator)

> **User prompt:** "把左下角那张图改成红色边框，然后右移 10 px"

**Expected agent trajectory (3-6 steps, ¥0.05-0.2):**
1. `get_slide_shapes(slide_id=current)` → shape inventory (id, type, name, left, top, width, height)
2. LLM 自决：根据 (left, top) 推断「左下角」= shape_id=5
3. `set_shape_property(shape_id=5, prop="line.color", value="#FF0000")`
4. `set_shape_property(shape_id=5, prop="line.weight", value=2)`
5. `set_shape_property(shape_id=5, prop="left", value="current+10")`
6. 完成

**Read tools exercised:** `get_slide_shapes`, `get_selection_metadata`
**Write tools exercised:** `set_shape_property` (the workhorse — 单点 prop 写入)
**Complexity:** S-M — Office.js PowerPoint API 1.4+ 已支持 shape 位置/格式；难点在 LLM 准确解析「左下角」这种空间语义
**v1 reuse:** PPT Adapter（已有 insert，需扩展 shape mutation）
**Why differentiator:** Copilot Agent Mode GA 不暴露 shape-level 操作给用户自然语言；这是 Aster 能赢的窄缝
**Failure modes:** 「左下角」语义模糊（多个候选 shape）、px ↔ pt 单位转换、shape 锁定状态

### 2.5 Anti-Scenario — "做一份从去年 Q3 到今年 Q3 的对比 PPT"

**Why anti:** 需要跨文档读历史数据 — **Q7 已锁定单文档边界，不做**。
**正确响应:** Agent 应识别"我需要去年的数据但只能看到当前文档" → 提示用户提供数据，不假装能跨文档。
**v1.0 已支持的替代路径:** 用户用 v1 文件上传把去年文档传进 context window；v2 read tool 只覆盖 current host document，**上传文件继续走 v1 的 F4 上传通道**（FROZEN needs-replan 状态待 Phase 3 重 spec）。

---

## 3. Feature Landscape

### 3.1 Read Tools (Table Stakes — Locked Q10 默认全开)

These are the agent's "eyes." Without them the LLM is blind and hallucinates everything. **All read tools are default-on per Q10** — single opt-out toggle disables the whole class (用户切回类似 v1 单步模式)。

| Read Tool | Host | What It Returns | v1 Reuse | Complexity | Priority |
|---|---|---|---|---|---|
| `get_selection_metadata` | All | 选区类型、长度、所在 slide/sheet/paragraph、字数 | 选区胶囊已捕获，扩展 metadata | S | P1 |
| `get_presentation_outline` | PPT | slide id / title / layout / shape count per slide | PPT Adapter | M | P1 |
| `get_slide_shapes` | PPT | shape inventory: id, name, type, left/top/width/height, text | PPT Adapter, 调 PowerPoint.Shape API 1.4+ | M | P1 |
| `get_slide_notes` | PPT | speaker notes 文本 | PPT Adapter, slide.notes API | S | P2 |
| `get_sheet_schema` | Excel | sheet 名 / used range / 表头推断 / 列类型 | Excel Adapter, getUsedRange + 表头扫一遍 | M | P1 |
| `get_range_values` | Excel | (range, values, formulas, formats) | Excel Adapter, range.load + sync | S | P1 |
| `get_chart_inventory` | Excel | charts: id, type, source range, position | Excel Adapter, worksheets.charts | S | P2 |
| `get_table_inventory` | Excel | tables: name, range, columns | Excel Adapter, worksheets.tables | S | P2 |
| `get_document_outline` | Word | 标题层级 / 段落数 / 表格 / image 数 | Word Adapter, body.paragraphs + style | M | P1 |
| `get_paragraph_range` | Word | (start, end) 段落 → 文本 | Word Adapter, paragraphs collection slice | S | P1 |
| `get_document_styles` | Word | 文档使用的 style 列表 | Word Adapter | S | P3 |
| `get_document_full_text` | Word/PPT/Excel | 全文（受 Q10 隐私开关控） | 跨 Adapter | S | P1 — **核心 Q10 行为** |

**Why default-on (revisit Q10):** Industry pattern is **scope-tagged retrieval** (each chunk carries owner/region/purpose tags, filtered at runtime — see [Protecto.ai LLM Consent](https://www.protecto.ai/blog/why-user-consent-is-revolutionizing-llm-privacy-practices/)). Aster 没后台无法做 server-side scope filter — 所以走「显式 Onboarding 授权 + Settings 单一 opt-out」(F4-PRIV) 而非每步弹框（per-action consent 在 BYO Key 无后台架构下 = 用户疲劳 + 流程不可用）。

### 3.2 Write Tools (Table Stakes vs Differentiators)

Write tools是 "agent's hands." 分两类：**确定性单点 mutation** 和 **粗粒度内容产出**。

#### Table Stakes Write Tools

| Write Tool | Host | What It Does | v1 Reuse | Complexity | Priority |
|---|---|---|---|---|---|
| `insert_slide` | PPT | 创建 slide（layout + title + bullets） | PPT Adapter 已有 insert，扩展 layout 参数 | M | P1 |
| `set_shape_text` | PPT | 设置 shape 内文字 | PPT Adapter | S | P1 |
| `insert_text_box` | PPT | 新增 text shape | PPT Adapter, shapes.addTextBox | S | P1 |
| `set_range_values` | Excel | 写入一片单元格 | Excel Adapter 已有 | S | P1 |
| `apply_formula` | Excel | 写公式（单 cell 或范围） | Excel Adapter, range.formulas | S | P1 |
| `insert_chart` | Excel | 插图表（type + source + position） | Excel Adapter, sheet.charts.add | M | P1 |
| `format_range` | Excel | 字体/底色/数字格式 | Excel Adapter, range.format | M | P2 |
| `insert_paragraph` | Word | 插段落（位置 + 文本 + style） | Word Adapter | S | P1 |
| `replace_paragraph` | Word | 替换段落文本（保 style） | Word Adapter 已有 replace | S | P1 |
| `delete_paragraph` | Word | 删段 | Word Adapter | S | P2 |

#### Differentiator Write Tools

| Write Tool | Host | What It Does | Why Differentiator | Complexity | Priority |
|---|---|---|---|---|---|
| `set_shape_property` | PPT | 单点改 shape 属性（color/size/position/border/fill） | Copilot Agent Mode 不暴露 shape-level UX；中文场景「把那个图调小一点」很高频 | M | P1 |
| `move_shape` | PPT | 改 (left, top)，支持相对位移 | 同上 | S | P1 |
| `resize_shape` | PPT | 改 (width, height)，保 aspect | 同上 | S | P2 |
| `apply_table_format` | Excel | 整张表样式（条件格式 / 表头粗体） | 比 format_range 高抽象，省 token | M | P2 |
| `generate_speaker_notes` | PPT | 单 slide 自动生成讲者备注 | v1 FEATURES.md GAP #2；Gamma 招牌；Office.js slide.notes 已支持 | S | P2 |
| `insert_pivot_table` | Excel | 自然语言 → PivotTable | v1 FEATURES.md GAP #3；Excel.PivotTable Web API 已 GA | M | P2 |
| `reorder_paragraphs` | Word | 段落重排（cut + insert） | Q9 失控控制 — 风险高，v2.0 默认关闭，作为 stretch | L | P3 |

**Why per-property write is the secret sauce:** 中文用户表达常含「把那个图」「这段字」「往右一点」这种**指代 + 相对量**——LLM 必须先 `get_slide_shapes()` 看 inventory，再发 `set_shape_property(id, "left", current+10)`。这条 read→reason→write 链路是 agent 的核心价值，**v1 single-step 模型完全做不出来**——v1 顶多接受「设置这个图为红色」这种**已选中**的当前对象，不能定位 + 评估 + 操作。

### 3.3 Control UX — Pause / Resume / Step Log (Table Stakes — Q9 衍生)

| Feature | What It Does | Patterns Borrowed From | v1 Reuse | Complexity | Priority |
|---|---|---|---|---|---|
| **Always-visible pause button** | 跑期间 Task Pane 顶部红色 ⏸ 按钮，点击立即停下一步 tool call | Claude Code interrupt; Cursor 0.46 unified Agent panel | Task Pane shell | S | **P1 — Q9 锁定** |
| **Step ticker / live progress** | 每 step 滚动追加「读了什么 / 写了什么」一行；类似 Claude Code 的 streaming thoughts | Claude Code (`thinking` blocks streamed); Devin's session view | SSE + Task Pane | M | P1 |
| **Cost meter (running)** | 顶部固定一行：「已用 ¥X / ¥10 上限」，超阈值变红→灰禁 | Cline v3.78 Spend Limit Reached UI; Devin ACU breakdown | cost badge 升级 | S | **P1 — Q9 锁定** |
| **Step-by-step diff log (post-run)** | 跑完显示 N 步卡片：每张 = 一个 tool call + before/after snippet + 单步「撤销该步」 | Cursor checkpoints; Claude Code `/diff` | 新建 | L | **P1 — Q9 锁定** |
| **One-click undo all** | 一键回滚到 agent 启动前状态 | Cursor checkpoints; Devin's snapshot revert | 新建（详见 §6 Undo） | M | **P1 — Q9 锁定** |
| **Max-steps hard ceiling (20)** | 后台逻辑：max_steps 到 → 强制 abort，UI 上显示「已达上限，是否继续」 | Cursor 25 tool call limit; Claude Code's bounded execution | agent loop 内部 | S | **P1 — Q9 锁定** |
| **Resume from checkpoint** | 历史 step 卡片上「从这里重新规划」 — 把后续 N 步删掉，让 LLM 重新分支 | Cursor checkpoint revert; Claude Code `--resume` | 新建 | L | P3 — v2.1 |
| **Streaming "thinking"** | LLM reasoning 段实时展开/折叠 | Claude Code; Devin's "Preview upcoming features" toggle | SSE | S | P2 |
| **Per-step approval (optional)** | 用户可在 Settings 切「每步前问我」 — agent 跑完一步后等用户点 ✓ | Cursor 默认行为；Cline 默认开 | agent loop 内部插 await | M | P2 — 保守用户兜底 |

**Critical from research — don't repeat Microsoft's May 2026 mistake:** Copilot ribbon button rollback 教训 = "productivity software is not a billboard." 翻译到 agent UX = **pause/cost meter 必须 always visible, 不能折叠在二级菜单**。这是 Q9 锁定背后的隐含 UX 责任。

### 3.4 Privacy UX — One-Time Consent + Opt-Out (Q10 衍生)

| Feature | What It Does | Patterns Borrowed From | v1 Reuse | Complexity | Priority |
|---|---|---|---|---|---|
| **F4-PRIV Onboarding 全文读取授权** | 首启 / v2 升级用户首次见到 agent 入口时弹一次：「Aster 代理在执行任务时会向当前 Provider 发送当前文档全文，是否同意？」明确按钮：「同意启用代理」/「保留单步模式」 | EU AI Act 2026 explicit consent pattern; arXiv 2026 contextualized privacy defense | Onboarding 流程扩展 | S | **P1 — Q10 锁定** |
| **F4-PRIV Settings 单一 opt-out 开关** | Settings 一个 toggle：「关闭文档全文发送（只发选区）」— 切回 v1 行为 | 简化版的 Anthropic / OpenAI training opt-out | Settings UI | S | **P1 — Q10 锁定** |
| **Provider 切换时再次警示** | 切换 Provider 后第一次跑 agent 前提示「当前 Provider = 数据发往地：{endpoint}，确认继续？」 | "Choice belongs in product, not buried" pattern | Settings + agent entry | S | P1 |
| **Privacy doc rewrite** | README + 单独 PRIVACY.md：明确「LLM 看到的范围 = 整个当前文档」 | 2026 GDPR / EU AI Act transparency 要求 | docs | S | **P1 — Q10 锁定** |
| **Read tool name surfaced in step log** | Diff log 里每步显式标「读取了：文档全文 / 选区 / shape 列表」 | Notion AI source citation | step log 字段 | S | P2 |
| **Per-action consent prompt (anti-feature)** | 每次 read tool 弹框问 | 2026 文献 (Protecto/arXiv) 学术理想，但 BYO Key 无后台架构下 = 用户疲劳 | — | — | **Anti — 不做** |

**Why one-time + opt-out, not per-action:** 学术界 2026 共识是 contextualized per-action consent，但前提是有 server-side runtime enforcement 把不允许的 chunk filter 掉。Aster **无后台**，要么把所有过滤推给用户决策（=每步弹框=用户立刻关）要么默认开 + 显式 opt-out（=Q10 选的路径）。这是隐私 vs 可用性的硬权衡，**Q10 已拍**。

### 3.5 Cost UX (Q9 衍生)

| Feature | What It Does | Patterns Borrowed From | v1 Reuse | Complexity | Priority |
|---|---|---|---|---|---|
| **Running cost meter (always visible)** | Task Pane 顶部「¥X used / ¥10 cap」；超 cap 自动 pause | Cline v3.78 "Spend Limit Reached" 弹层 | cost badge 升级 | S | **P1 — Q9 衍生** |
| **Per-step cost detail** | 点 step 卡片展开 → 看本步 tokens/¥ 拆分 | Devin ACU-level breakdown modal | cost badge | S | P2 |
| **Cost cap 可在 Settings 改** | 默认 ¥10 / agent run；用户可在 Settings 调 (¥1 - ¥50) | OpenAI monthly budget hard cap UX | Settings | S | P1 |
| **Provider 单价显示在 Onboarding** | 用户填 Key 时旁边显示「DeepSeek-V4-pro ≈ ¥X/百万 tokens」帮估算 | Cline cost transparency primer | Onboarding | S | P2 |
| **"This task cost ¥X" 完结摘要** | 跑完后 step log 顶部一行 "本次代理消耗：¥X / 共 N 步" | Devin completion modal | — | S | P1 |

**Note:** v1 FEATURES.md 已把 "token cost visibility" 标为 GAP；v2 因为 Q9 锁定必须做，**这个 GAP 自动闭合**。

### 3.6 Error Recovery UX (Q11 衍生)

| Feature | What It Does | Patterns Borrowed From | v1 Reuse | Complexity | Priority |
|---|---|---|---|---|---|
| **Structured tool error schema** | 所有 tool 失败 push 回 LLM 的格式：`{code, message, recoverable, suggestion}` | OpenAI Chat Completions tool result format; LangChain tool error pattern | 错误分类升级 | M | **P1 — Q11 衍生** |
| **Per-tool retry counter (max 2)** | agent loop 内部记 (tool_name → fail_count)；同 tool 第 3 次失败强制 abort 整个 run | Cursor 25-tool cap + Cline loop guard | agent loop | S | **P1 — Q11 衍生** |
| **"Agent gave up" UX** | 强制 abort 后 step log 末尾红色卡片：「Aster 觉得这事干不了；试过 X、Y、Z 都失败。建议：[由 LLM 给]」 | Claude Code refuses with explanation pattern; Devin failure email | step log | M | P1 |
| **错误分类继承 v1** | tool 内部错误仍走 v1 的 (Key/quota/context/network) 分类，但包装成 structured format 给 LLM | v1 F7 | F7 直接复用 | S | P1 |
| **隐式诊断提示** | tool error message 里 LLM 可读的 hint：「`apply_formula` 失败：cell 锁定；建议先 `unlock_cell` 再重试」 | LangChain / smolagents tool error best practice | tool layer | M | P2 |

### 3.7 Differentiators (Aster's Unique Edges)

| Feature | Value Proposition | v1 Reuse | Complexity |
|---|---|---|---|
| **BYO Key + 无后台 in agent mode** | Copilot Agent Mode 必须企业订阅 + 数据走 MS cloud；Aster 是唯一「BYO Key 跑代理 + 数据从浏览器直连 Provider」的产品 | v1 Provider 抽象 + 无后台架构 | (架构性，无新代码) |
| **DeepSeek-V4 中文场景下的代理质量** | Copilot Agent Mode 中文调优一般；WPS AI 锁定 WPS；Aster 是唯一「在原生 Office 跑中文 agent」 | v1 Provider | (架构性) |
| **Shape 级精细化 agent 操作** | Copilot Agent Mode 只暴露内容生成，不暴露 shape mutation；中文用户「这个图调小一点」诉求被 Copilot 漏掉 | PPT Adapter 扩展 | M |
| **可中断 + 一键回滚兜底** | Copilot Agent Mode 改完就改了（依赖 OneDrive 版本历史回退）；Aster 提供 in-product undo all | 新建 | L |
| **Open source agent loop** | 用户能审 agent 的 prompt / tool list / loop 逻辑；Copilot / Devin / Cursor 都不开源核心 loop | — | (架构性) |
| **Provider 切换换模型不改流程** | 用 DeepSeek 跑代理太贵？切到 Flash 跑同样任务；用户用自家 Azure OpenAI 也可以 | v1 F3 直接复用 | — |
| **流式 thinking + 步骤完全透明** | 用户能看到 LLM 每步思考 + 调了什么 tool + 返回了什么 | SSE + step log | S |

### 3.8 Anti-Features (Don't Build — Explicit)

| Anti-Feature | Why Tempting | Why Bad for Aster v2 | What to Do Instead |
|---|---|---|---|
| **跨文档 agent** ("帮我把这份 docx 转成 pptx") | 中文用户高频问 | Q7 已锁单文档；跨宿主 API 不存在；OneDrive 集成 = 后台路线 | 引导用户分两次跑 — Word agent 出大纲 → PPT agent 接大纲 |
| **跨应用 agent** ("从 Excel 数据生成 PPT") | Copilot 路线 | 同上；Office.js 不允许 host A 调 host B API | 同上 |
| **Per-step approval 默认开** | "更安全" | Cline 的教训：每步问 = 用户立刻关 = 失去 agent 价值 | Q9 锁定宽松默认；想保守的用户可在 Settings 切 |
| **Auto-execute YOLO 模式 (无 pause / 无 cap)** | Cursor YOLO 路线 | Q9 锁定必须 pause + cost cap；Office 文档 ≠ Git 工作区，回滚成本高 | 默认 max_steps=20 + ¥10 cap + always-visible pause |
| **VBA / Office Script 生成 + 代理执行** | "AI 能写脚本" wow | v1 已锁 anti-feature；agent 模式下执行 VBA = 完全失控 | 坚持走 Office.js API tool call |
| **跨 session memory** ("记住我上次让你做的") | ChatGPT Memory feature | 无后台架构下要么本地 IndexedDB 要么 Provider memory（数据外发）；Q10 已经够复杂 | v1 决定的 chat 不持久化保持；v2.1 评估 |
| **Whole-deck redesign / theme apply** | Beautiful.ai 路线；v1 anti-feature | Office.js Web API 限制 + agent 改样式失败率高 + 与用户模板冲突高 | 坚持文本 + image，theme 用户自己保 |
| **Auto-citation / RAG over user files** | "AI 能引用来源" | 需 vector DB / 后台；v1 已锁 anti | 上传文件继续作 context 输入，让 LLM 自然 cite |
| **Agent 自动跳过 Q11 max-retry 限制** | "LLM 知道自己在干嘛" | Q11 死循环烧 ¥ 防线；ICLR 2026 研究：reasoning 越强 hallucinated tool call 越多 | 严守 max_steps=20 + 同 tool 重试 ≤2 |
| **Floating "agent suggestion" badge on document surface** | Copilot 2026 短暂尝试 | Microsoft 自己 May 2026 已 rollback；engagement up satisfaction down | Ribbon + Task Pane only — 与 v1 anti-feature 一致 |
| **Multi-agent / agent-spawn-agent** | Claude Code Agent View / Manus 路线 | 单 prompt ¥10 cap 下，spawn 子 agent = cost 爆炸 + UX 不可观测 | v2.0 单 agent loop；v2.1 评估 |
| **Per-action 隐私弹框** | 学术 2026 标准；GDPR 风格 | BYO Key 无后台架构下 = 用户疲劳 + 流程不可用 | Q10 锁定的 Onboarding 一次性 + opt-out 单开关 |
| **持续后台 agent / scheduled agent** | Devin 风格 | Office Add-in 是浏览器内嵌；Office 关 = agent 死 | 单 prompt 单 session |

---

## 4. Feature Dependencies

```
[v1 Phase 0-2.1 base (Provider / SSE / 错误分类 / Adapter / cost badge / 选区胶囊 / partitioned localStorage)]
   │
   ├──> [A1 Multi-step agent loop (chat.ts 状态机)]
   │       │
   │       ├──> [A2 Tool result feedback (push tool error back to messages)]
   │       │       └──> [Q11 错误恢复 + structured error schema + max-2-retry]
   │       │
   │       ├──> [A3 Read tools] ──> [F4-PRIV Onboarding 全文读取授权] (Q10)
   │       │       ├──> get_presentation_outline / get_slide_shapes / get_slide_notes
   │       │       ├──> get_sheet_schema / get_range_values / get_chart_inventory
   │       │       └──> get_document_outline / get_paragraph_range
   │       │
   │       ├──> [Write tools] (扩展 v1 Adapter)
   │       │       ├──> Table stakes: insert_slide / set_range_values / replace_paragraph ...
   │       │       └──> Differentiators: set_shape_property / generate_speaker_notes / insert_pivot
   │       │
   │       └──> [Max-steps = 20 hard ceiling] (Q9 fail-safe)
   │
   ├──> [A4 失控控制 UX]
   │       ├──> Always-visible pause button       (Q9)
   │       ├──> Live cost meter + ¥10 cap         (Q9 + v1 cost badge upgrade)
   │       ├──> Step-by-step diff log             (Q9 — new component)
   │       └──> One-click undo all                (Q9 — new, depends on §6)
   │
   └──> [Phase 2.2 嵌入 — v1 转嫁]
           ├──> FU-01 首次取选区 bug (会污染 get_selection_metadata)
           ├──> FU-02 model 下拉 UX (代理产生大量调用，model 切换更频繁)
           └──> FU-03 copy chat (debug 工具) → 扩展为 copy step log
```

### Dependency Notes

- **A1 → A2 → A3:** Multi-step agent loop 是地基；没它，所有 read tools 没意义（因为没人调它们多次）。
- **A3 → F4-PRIV:** Read tools 默认全开（Q10）→ 必须先有 Onboarding 授权步骤兜底。**Phase 顺序锁定：F4-PRIV 必须先于第一个 read tool 上线**。
- **写工具池 → §6 Undo:** 每个 write tool 必须可逆，否则 undo all 兜不住。写工具上线前必须先有 undo 基建。
- **Q9 max_steps 是 hard floor:** 没它，A2 错误反馈机制 + Q11 自决 = 死循环烧 ¥。**实现 A1 时就必须带 max_steps 检查**，不能 P2 推迟。
- **v1 选区胶囊 → get_selection_metadata:** v1 选区捕获 bug（Phase 2.2 FU-01 转嫁）会直接污染 agent 决策 — **Phase 2.2 FU-01 必须先于 PPT/Excel/Word agent 上线修复**。

---

## 5. MVP Definition (v2.0)

### v2.0 Launch With

**核心 agent 能力:**
- [ ] A1 Multi-step agent loop (max_steps=20 fail-safe)
- [ ] A2 Tool result feedback (structured error schema — Q11)
- [ ] Q11 max-2-retry per tool

**Read tools (P1):**
- [ ] get_selection_metadata
- [ ] get_presentation_outline + get_slide_shapes (PPT)
- [ ] get_sheet_schema + get_range_values (Excel)
- [ ] get_document_outline + get_paragraph_range (Word)
- [ ] get_document_full_text (Q10 核心行为)

**Write tools (P1):**
- [ ] insert_slide + set_shape_text + insert_text_box + **set_shape_property + move_shape** (PPT)
- [ ] set_range_values + apply_formula + insert_chart (Excel)
- [ ] insert_paragraph + replace_paragraph (Word)

**控制 UX (Q9 锁定):**
- [ ] Always-visible pause button
- [ ] Live cost meter + ¥10 cap (可在 Settings 调)
- [ ] Step-by-step diff log
- [ ] One-click undo all (依赖 §6 undo 基建)
- [ ] Max-steps = 20 + auto-stop

**隐私 UX (Q10 锁定):**
- [ ] F4-PRIV Onboarding 全文读取授权步骤
- [ ] Settings 单一 opt-out 开关
- [ ] Privacy doc + README 重写
- [ ] Provider 切换时警示

**v1 转嫁 (Phase 2.2):**
- [ ] FU-01 首次取选区 bug 修复
- [ ] FU-02 model 下拉 UX 优化
- [ ] FU-03 copy chat history → 扩展为 copy step log

### v2.0 Stretch (打不进 P1 但希望进 v2.0)

- [ ] get_chart_inventory + get_table_inventory (Excel)
- [ ] get_slide_notes + generate_speaker_notes (PPT — v1 FEATURES.md GAP #2 闭合机会)
- [ ] insert_pivot_table (Excel — v1 FEATURES.md GAP #3 闭合机会)
- [ ] format_range + resize_shape
- [ ] Streaming thinking 实时展开
- [ ] Per-step approval 模式（Settings toggle）

### v2.1 (Future)

- [ ] Resume from checkpoint
- [ ] reorder_paragraphs (Word)
- [ ] delete_paragraph 多步 (危险写操作)
- [ ] Multi-agent spawn (跨子任务并行)
- [ ] Cross-session memory (持久化)
- [ ] Image gen tool (聚合 v1 F4 multimodal + Q1 图库)

### Out of Scope (永不做)

参见 §3.8 Anti-Features — 跨文档 / 跨应用 / VBA / Whole-deck redesign / RAG / Floating badge etc.

---

## 6. Undo All — Mental Model & Implementation Note

Q9 锁定「一键 undo all 兜底」是 v2 最重的 trust 担保。Industry pattern survey:

| Product | Undo Strategy | Aster Adoptability |
|---|---|---|
| Cursor | Auto-checkpoint before each iteration; revert = restore files from snapshot | High — analog 是 "agent 启动前快照 + 撤回应用" |
| Claude Code | File snapshot before edit + `/diff` viewer | Medium — Aster 没有 file system，是 Office 文档对象 |
| Devin | VM snapshot revert | Low — 太重 |
| Copilot Agent Mode | OneDrive version history | Low — 依赖 OneDrive；Aster 是 BYO/无后台 |
| Office native undo (Ctrl+Z) | Per-operation stack | **Inherent** — Office.js 写操作自动入 native undo 栈 |

**Recommended approach for Aster (待 Phase spec 验证):**
- **Phase A (v2.0 P1 minimal):** 利用 Office native undo — agent run 期间记下「这次 run 总共调用了 N 次 write」，undo all = 调 N 次 Ctrl+Z 等效 API。需 spike 验证三宿主 native undo API 可控性。
- **Phase B (v2.1 robust):** 启动前做 snapshot（PPT: 全 slide JSON export / Excel: used range values + format / Word: full text + structure），undo all = 还原 snapshot。代价：大文档 snapshot 慢，¥ token 占用。

**Spike action (P0 / 上线前必验):** 三宿主 Office.js native undo API 是否能从 add-in 触发？还是只能用户手动 Ctrl+Z？这决定 Phase A 是否可行。如果三宿主之一不支持，那个宿主必须直接走 Phase B snapshot 路线。

---

## 7. Feature Prioritization Matrix

| Feature | User-Perceived Magic | Implementation Cost | v1 Reuse | Priority |
|---|---|---|---|---|
| A1 Multi-step agent loop | HIGH (核心) | M | Provider/SSE | **P1** |
| A2 Tool result feedback (structured) | HIGH | S | F7 升级 | **P1** |
| Read tools P1 set (8 个) | HIGH | M per tool, L overall | Adapter | **P1** |
| Write tools P1 set (10 个) | HIGH | S-M per tool | Adapter 扩展 | **P1** |
| set_shape_property (差异化) | **HIGHEST** (差异化护城河) | M | PPT Adapter | **P1** |
| Always-visible pause | HIGH (trust) | S | Task Pane | **P1** |
| Step-by-step diff log | HIGH (trust + 教育) | L (新建) | Task Pane | **P1** |
| Live cost meter + ¥10 cap | HIGH (trust) | S | cost badge | **P1** |
| One-click undo all | HIGH (trust) | M (Phase A) / L (Phase B) | 新建 + Office native undo spike | **P1** |
| Max-steps = 20 hard ceiling | HIGH (fail-safe) | S | agent loop | **P1** |
| Q11 max-2-retry per tool | HIGH (fail-safe) | S | agent loop | **P1** |
| F4-PRIV Onboarding 全文授权 | HIGH (合规) | S | Onboarding 扩展 | **P1** |
| Settings 单一 opt-out | HIGH (合规) | S | Settings | **P1** |
| Privacy doc rewrite | HIGH (合规) | S | docs | **P1** |
| FU-01 选区 bug 修复 | HIGH (污染所有 agent decision) | S | v1 转嫁 | **P1** |
| Streaming thinking | MEDIUM (透明度) | S | SSE | P2 |
| Per-step approval (保守用户) | MEDIUM (差异化兜底) | M | agent loop | P2 |
| generate_speaker_notes | MEDIUM | S | PPT Adapter | P2 — GAP 闭合机会 |
| insert_pivot_table | MEDIUM | M | Excel Adapter | P2 — GAP 闭合机会 |
| format_range / resize_shape | MEDIUM | S | Adapter | P2 |
| get_chart/table_inventory | MEDIUM | S | Adapter | P2 |
| Resume from checkpoint | LOW (v2.0) | L | 新建 | P3 / v2.1 |
| reorder_paragraphs | LOW (v2.0 高风险) | L | Word Adapter | P3 / v2.1 |
| Multi-agent / spawn | LOW (v2.0) | XL | 重构 loop | P3 / v2.1 |
| Cross-session memory | LOW | L | 需 IndexedDB | P3 / v2.1 |

---

## 8. Competitor Agent Feature Comparison

| Feature | Copilot Agent Mode (GA Apr 2026) | Cursor Composer / Agent | Claude Code | Devin | Gamma Agent | **Aster v2** |
|---|---|---|---|---|---|---|
| Native Office integration | **Yes (in-app)** | No | No | No | Export only | **Yes (Office.js Add-in)** |
| BYO Key / no subscription | No (M365 Copilot 必需) | Limited (Cursor Pro 必需) | No (Anthropic 订阅) | No (ACU 计费) | No | **Yes (核心差异化)** |
| 数据走 own infra | MS Cloud | Cursor Cloud (or own infra for Enterprise) | Anthropic | Cognition | Gamma Cloud | **None — 直连 Provider** |
| Multi-step in single doc | Yes | Yes (代码库) | Yes (代码库) | Yes | Yes | **Yes (Q7 单文档)** |
| Cross-app orchestration | No (April 2026 still roadmap) | N/A (代码) | N/A | N/A | N/A | **No (Q7 锁) — 一致** |
| Shape-level precision ("把那个图调小") | Limited | N/A | N/A | N/A | Limited | **Yes (差异化护城河)** |
| Pause button | Yes | Yes (interrupt) | Yes | Yes (cancel snapshot) | Limited | **Yes (Q9 锁)** |
| Step-by-step diff log | Yes (in-doc track changes) | Checkpoints | `/diff` viewer | Session view | Limited | **Yes (Q9 锁)** |
| One-click undo all | Via OneDrive version | Yes (checkpoint revert) | File snapshot | VM snapshot | Limited | **Yes (Q9 锁 — native undo or snapshot)** |
| Cost meter visible | No (订阅制) | Limited | Limited | **Yes (ACU breakdown)** | No | **Yes (Q9 锁 — running + cap)** |
| Hard cost cap | Account-level | API-level | API-level | ACU plan limit | Account | **Per-run ¥10 cap (Q9)** |
| Max-steps ceiling | Not exposed | 25 (standard) / 200 (Max) | Configurable | N/A | N/A | **20 hard (Q9)** |
| Privacy: doc-read consent | Implicit (订阅条款) | Explicit | Explicit | Enterprise SSO | Implicit | **One-time Onboarding + opt-out (Q10)** |
| Per-action consent | No | No | Configurable | Enterprise | No | **No (anti-feature)** |
| Multi-agent spawn | No | Background Agent | Agent View / sub-agents | Yes (parallel sessions) | Limited | **No (v2.0 — single loop)** |
| Open source agent loop | No | No | Partial (system prompts published) | No | No | **Yes (差异化)** |
| Chinese-first LLM | Weak | N/A | N/A | N/A | Weak | **Yes (DeepSeek-V4 + 差异化)** |
| Office for Web 支持 | **No (must Desktop + M365)** | N/A | N/A | N/A | N/A | **Yes (差异化 — sideload free)** |

**Aster's defensive moat in one sentence:** Aster 是唯一一个「在原生 Office Web 跑 + BYO Key + 无后台数据外送 + 中文 agent 质量 + shape 级精细化操作 + 开源 loop」的产品。Copilot 拿走「企业订阅 + 跨 app 编排（roadmap）」，Aster 守住「副业用户 + 数据隐私 + 中文质量 + 开源透明」。

---

## 9. Chinese Office Worker Lens — What "看得见的代理魔法" Means

中文职场场景下用户对 agent 的预期 ≠ 北美开发者对 Claude Code 的预期。基于 v1 FEATURES.md 调研 + WPS AI 中文用户行为：

### 高频期待（中文用户 specifically）

1. **"帮我做一份关于 X 的 PPT"** — Topic-to-deck 是 v1 PRD 已锁的 killer #1；v2 agent 模式下变成 "topic → 10 page deck 一气呵成"，是用户最容易认知到的「magic moment」。
2. **"把这表清洗一下并出个图"** — 中文数据分析师 / 财务高频；agent 多步是天然适配（清洗 + 图 + 解读 ≥ 3 步）。
3. **"整篇润色"** — 「整篇」是关键词，single-step v1 做不到（一次只能改选中），agent 模式下可一次跑全文。
4. **"把那个图弄红一点 / 往右挪一下"** — 中文用户表达常含**指代 + 相对量**，这是 v1 single-step 完全的盲区，agent 的 read→reason→write 链路是唯一能解的方式。这条是 **Aster vs Copilot Agent Mode 最锋利的差异化**——Copilot 不暴露 shape-level UX。

### 低频或反向预期（中文用户不要的）

1. **复杂权限 / 审批 / 多人协作** — Aster 单机 BYO 路线和这些天然冲突；中文用户期望的是「赶紧给我做完」而非「先发起协作流程」。
2. **每步弹框确认** — WPS AI 已经踩过坑：中文用户的耐心阈值低于美国开发者；per-action consent 模式（学术 2026 ideal）在中文办公场景 = 立刻被关。
3. **英文 UI / 英文术语** — v1 已锁中文优先；agent 步骤摘要必须翻译成「读取了第 3 张幻灯片的形状清单」而不是「called get_slide_shapes(slide_id=3)」。

### 教育成本最高的概念

1. **"agent 在后台跑" 的心智** — 中文用户习惯「输入 → 立即出文字」的 ChatGPT 心智；「输入 → 等一会儿 → 跑完看 N 步 diff」是新概念，需要 Onboarding 第二步加上一段动画 / GIF 示意「跑完会这样汇报」。
2. **"undo all" 是兜底而非常规操作** — 用户首次见到「一键撤销全部」按钮可能会条件反射地点；UX 上要 secondary（灰按钮 + 二次确认），不和主流程混。
3. **"max_steps 上限" 的存在** — 用户不该意识到这个数字，但 hit 到的时候要软着陆：「Aster 觉得这事还没干完，要继续吗？（已用 12/20 步，预计还需 4 步，会再多花 ¥0.3）」

---

## 10. Phase Mapping (for v2.0 Roadmap)

| Phase Topic | Owns These Features | Depends On |
|---|---|---|
| **Phase 3 spike** (新) | Office.js native undo 三宿主探查；shape mutation API 1.4+ 三宿主一致性；F4-PRIV Onboarding 文案设计 | v1 base ready |
| **Phase 4 agent base** | A1 multi-step loop + A2 tool result feedback + Q11 max-2-retry + max_steps=20 + structured error schema + F4-PRIV Onboarding + Settings opt-out + Privacy doc rewrite | Phase 3 spike clean |
| **Phase 5 PPT agent** | get_presentation_outline + get_slide_shapes + insert_slide + set_shape_text + set_shape_property + move_shape + Phase 2.2 FU-01 (选区) | Phase 4 base + PPT Adapter |
| **Phase 6 Excel agent** | get_sheet_schema + get_range_values + set_range_values + apply_formula + insert_chart | Phase 4 base + Excel Adapter |
| **Phase 7 Word agent** | get_document_outline + get_paragraph_range + insert_paragraph + replace_paragraph | Phase 4 base + Word Adapter |
| **Phase 8 control UX** | Always-visible pause + step ticker + live cost meter + cap + diff log + undo all + Phase 2.2 FU-02/03 (model 下拉 / copy step log) | Phase 5-7 deliver enough trajectory data |
| **Phase 9 polish + release** | Streaming thinking + GAP 闭合机会（speaker notes / pivot）+ AC verification + open-source README 重写 + sideload docs | Phase 8 ready |

**Note:** 上面是 FEATURES 视角的 phase 建议；最终 ROADMAP 由后续 spec 阶段 + roadmap agent 决定。Phase 顺序的硬约束只有：
- Phase 4 base 必须先于 Phase 5-7 任何 host
- Phase 3 spike 必须先于 Phase 4 base（undo 方案不定，整个 trust UX 没法收尾）
- Phase 2.2 FU-01 选区 bug 必须在 Phase 5 PPT 上线前修

---

## Sources

### Copilot Agent Mode (HIGH — GA Apr 22, 2026)
- [Copilot's agentic capabilities in Word, Excel, and PowerPoint are generally available — Microsoft 365 Blog](https://www.microsoft.com/en-us/microsoft-365/blog/2026/04/22/copilots-agentic-capabilities-in-word-excel-and-powerpoint-are-generally-available/)
- [Get started with Agent Mode in Word, Excel, and PowerPoint — Microsoft Support](https://support.microsoft.com/en-us/topic/get-started-with-agent-mode-in-word-excel-and-powerpoint-4d322d7f-5e89-4f66-9fa4-57d328b156ff)
- [Microsoft Copilot Agent Mode Now GA — Windows News](https://windowsnews.ai/article/microsoft-copilot-agent-mode-now-ga-in-word-excel-and-powerpoint.415032)
- [Copilot Agent Mode Word Excel PowerPoint Explained — Office Watch](https://office-watch.com/2026/copilot-agent-mode-word-excel-powerpoint/)
- [Microsoft Copilot Agent Mode in Word, Excel, and PowerPoint — Pasquale Pillitteri (April 2026)](https://pasqualepillitteri.it/en/news/1401/microsoft-copilot-agent-mode-word-excel-powerpoint-april-2026)
- [Introducing Word, Excel, and PowerPoint Agents in Microsoft 365 Copilot — Microsoft Community Hub](https://techcommunity.microsoft.com/blog/microsoft365copilotblog/introducing-word-excel-and-powerpoint-agents-in-microsoft-365-copilot/4470604)

### Cursor Agent / Composer (HIGH)
- [Cursor 2026: Composer, Agent Mode, MCP & Background Agent — DeployHQ](https://www.deployhq.com/guides/cursor)
- [Complete Guide to Cursor Agent Mode (2026) — BetterLink](https://eastondev.com/blog/en/posts/dev/20260110-cursor-agent-complete-guide/)
- [Agent Improvements, Yolo Mode, Cursor Tab Update — Cursor Docs](https://cursordocs.com/en/changelog/01-agent-improvements-yolo-mode-cursor-tab-update)
- [How to use Cursor Agent in Yolo mode (safely) — augmentedSWE](https://www.augmentedswe.com/p/how-to-use-cursor-agent-in-yolo-mode)
- [Cursor Agent Mode: How It Works (2026 Guide) — MorphLLM](https://www.morphllm.com/cursor-agent-mode)

### Claude Code (HIGH)
- [How Claude Code works — Anthropic Docs](https://code.claude.com/docs/en/how-claude-code-works)
- [Claude Code Changelog 2026 — claudefa.st](https://claudefa.st/blog/guide/changelog)
- [Claude Agent SDK: Agent Loops, Tool Calls — Augment Code](https://www.augmentcode.com/guides/claude-agent-sdk-agent-loops-tool-calls)
- [Beyond One-Shot Prompts: 5 Claude Code Workflow Patterns — MindStudio](https://www.mindstudio.ai/blog/claude-code-agentic-workflow-patterns)
- [What Is Claude Code Agent View — MindStudio](https://www.mindstudio.ai/blog/what-is-claude-code-agent-view)

### Devin (HIGH)
- [Devin Docs — 2026 Release Notes](https://docs.devin.ai/release-notes/2026)
- [Devin AI Pricing 2026 — CostBench](https://costbench.com/software/ai-coding-assistants/devin-ai/)
- [Devin Pricing — Pensero](https://pensero.ai/blog/devin-pricing)

### Cline (HIGH on cost UX)
- [Cline for VS Code: Free AI Coding Agent — DeployHQ 2026](https://www.deployhq.com/guides/cline)
- [AI Agents Burn 50x More Tokens Than Chats — LeanOps](https://leanopstech.com/blog/agentic-ai-cost-runaway-token-budget-2026/)
- [Hidden Costs of AI Agents 2026 — Teamvoy](https://teamvoy.com/blog/hidden-costs-of-ai-agents/)
- [Meta Burned 60T Tokens in 30 Days — Patrick Hughes](https://bmdpat.com/blog/meta-60t-token-burn-ai-agent-budget-control-2026)

### Gamma + Manus (MEDIUM — for deck-generation pattern)
- [How Gamma App 2026 Turns One-Sentence Prompts Into Polished Decks — Flowith](https://flowith.io/blog/gamma-app-2026-one-sentence-prompt-polished-deck-60-seconds/)
- [Gamma Review 2026 — Max Productive](https://max-productive.ai/ai-tools/gamma/)
- [Manus vs Genspark vs Gamma vs Skywork — Tweakslides](https://www.tweakslides.com/blog/best-ai-presentation-agent-2026)
- [Gamma AI Review 2026 — Alai](https://getalai.com/blog/gamma-alternatives)

### Office.js Agent-Tool API Surface (HIGH — official)
- [PowerPoint.Slide class — Microsoft Learn](https://learn.microsoft.com/en-us/javascript/api/powerpoint/powerpoint.slide?view=powerpoint-js-preview)
- [PowerPoint.Shape class — Microsoft Learn](https://learn.microsoft.com/en-us/javascript/api/powerpoint/powerpoint.shape?view=powerpoint-js-preview)
- [Work with shapes using the PowerPoint JavaScript API — Microsoft Learn](https://learn.microsoft.com/en-us/office/dev/add-ins/powerpoint/shapes)
- [Insert slides from another PowerPoint presentation — Microsoft Learn](https://learn.microsoft.com/en-us/office/dev/add-ins/powerpoint/insert-slides-into-presentation)
- [PowerPoint JavaScript API requirement sets — Microsoft Learn](https://learn.microsoft.com/en-us/javascript/api/requirement-sets/powerpoint/powerpoint-api-requirement-sets)
- [Excel.Chart class — Microsoft Learn](https://learn.microsoft.com/en-us/javascript/api/excel/excel.chart?view=excel-js-preview)
- [Get a range using the Excel JavaScript API — Microsoft Learn](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/excel-add-ins-ranges-get)
- [Set and get range values, text, or formulas — Microsoft Learn](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/excel-add-ins-ranges-set-get-values)
- [Work with charts using the Excel JavaScript API — Microsoft Learn](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/excel-add-ins-charts)
- [Word JavaScript API overview — Microsoft Learn](https://learn.microsoft.com/en-us/office/dev/add-ins/reference/overview/word-add-ins-reference-overview)
- [Word.Paragraph class — Microsoft Learn](https://learn.microsoft.com/en-us/javascript/api/word/word.paragraph?view=word-js-preview)

### Agent Privacy / Consent UX (MEDIUM — 2026 literature)
- [Why User Consent Is Revolutionizing LLM Privacy Practices — Protecto.ai](https://www.protecto.ai/blog/why-user-consent-is-revolutionizing-llm-privacy-practices/)
- [AI, privacy and compliance in 2026 — Regolo.ai](https://regolo.ai/ai-privacy-and-compliance-in-2026-what-changes-for-llm-providers/)
- [Contextualized Privacy Defense for LLM Agents — arXiv 2026](https://arxiv.org/pdf/2603.02983)
- [User Consent Best Practices for AI Agents — Curity](https://curity.io/blog/user-consent-best-practices-in-the-age-of-ai-agents/)
- [LLM Access Control — TrueFoundry](https://www.truefoundry.com/blog/llm-access-control)

### Agent Anti-Patterns (MEDIUM)
- [AI Agent Harness Failures: 13 Anti-Patterns — Atlan](https://atlan.com/know/agent-harness-failures-anti-patterns/)
- [Agent Observability Anti-Patterns — Digital Applied](https://www.digitalapplied.com/blog/agent-observability-anti-patterns-trace-quality-mistakes-2026)
- [Anti-patterns: things to avoid — Simon Willison](https://simonwillison.net/guides/agentic-engineering-patterns/anti-patterns/)
- [Fix Agent Tool Hallucinations With a 4-Section Prompt — Roborhythms](https://www.roborhythms.com/fix-agent-tool-hallucinations-4-section-prompt/)
- [What Are Agentic Design Patterns? 2026 Pattern Catalog — Augment Code](https://www.augmentcode.com/guides/agentic-design-patterns)
- [Microsoft Lets Users Move Copilot Button Back to the Ribbon May 2026 — Windows News](https://windowsnews.ai/article/microsoft-lets-users-move-copilot-button-back-to-the-ribbon-may-2026.419446)

---

*Feature research for: Aster v2.0 Office 智能代理*
*Researched: 2026-05-28*
*Downstream: ROADMAP should map phase ownership per §10; ARCHITECTURE should structure the agent loop + tool registry + undo strategy per §6; PITFALLS should anchor on §3.8 anti-features and §3.6 error recovery boundaries.*
