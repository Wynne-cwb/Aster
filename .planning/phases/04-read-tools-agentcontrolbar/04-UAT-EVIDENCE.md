---
status: passed
blocked_on: none
phase: 04-read-tools-agentcontrolbar
plan: 09
source: [04-09-PLAN.md]
started: "2026-05-29"
updated: "2026-05-29"
result: "全 SC PASS（真机实测）。UAT 过程中暴露并修复 3 个真机 bug：reasoning_content 往返 400、PPT textFrame InvalidArgument、并行工具调用 host 卡死冻 UI。线上 = main-DphSYwO0.js。"
---

# Phase 4 真机 UAT — 用户手动操作手册 + 证据回填

> **怎么用这份文档**
> 线上已是最新版本（HEAD `9335dd6`，已实证 = index.html 引用 main-D3SPZ_tW.js，无需再 push）。
> 请在**已登录 M365、已 sideload Aster 的 Edge/Chrome** 里，按下面 5 节逐条点。每节最后有【回填栏】，把 PASS/FAIL + 备注 + 截图文件名填进去（截图随便存哪，文件名写进来即可）。跑完把本文件发回，或把每条结果贴给我，我来归档 + 收尾。
> **核对要点**：下面【预期 PASS 判据】里的中文文案都是从代码里抄的原文，你肉眼对一下 Task Pane 里出现的字是不是这些就行，不用懂代码。

## 门禁（已自跑通过，供参考）
- `npm run test`：440 passed / 1 failed（唯一失败 = loop.test.ts AGENT-02，Phase 3 预存在，非本期引入）
- `npm run build`：OK；`npm run size`：79.1 KB ≤ 80 KB ✓；净新增依赖 0
- 线上部署：Deploy workflow success，线上 = 当前 commit（哈希实证）

---

## SC1 — PPT 复合 demo（read 链路）

- **【宿主】** PowerPoint
- **【前置】** 打开一个 ≥3 张 slide 的 deck，其中**一张内容明显最多**（文字/形状最多那张），方便验证 agent 能挑出"最长"那张。
- **【操作步骤】**
  1. 打开 Aster Task Pane（Ribbon 点「Aster」→ 显示任务窗格）。
  2. 在输入框输入这句原文，发送：
     `在最长那张 slide 后插入一张总结要点的新 slide`
  3. 观察聊天流里 agent 逐步调工具时冒出的**折叠卡**。
- **【预期 PASS 判据】**
  - 出现 read 折叠卡，卡头是**中文人话**，不是英文 tool 名。至少应看到：
    - 「**读取了全部幻灯片清单**」（list_slides）
    - 「**读取了第 N 张幻灯片**」（get_slide，N = 它判定最长的那张序号）
  - 卡头**不**是 `list_slides` / `get_slide` 这种 raw 名字。
  - 关于真正"插入新 slide"：**insert_slide 是 Phase 6 才做，本期没有**。所以 agent 走到 read 链路后，应表现为「没有插入工具 / 说还不能插入 / 停在读取后」——**这是预期，不算 FAIL**。本条只验 read 链路 + 折叠卡中文文案。
- **【要截的图】** 截 1 张：聊天流里那两张 read 折叠卡（能看清「读取了全部幻灯片清单」「读取了第 N 张幻灯片」）。
- **【回填栏】** 结果：`PASS` 备注：`真机实测。出现「读取了全部幻灯片清单」+「读取了第 N 张幻灯片」中文折叠卡；agent 读完全部 8 张、按内容量排序（选出第 6 张最长），并正确说明"不具备插入能力"（Phase 6），停在 read = 预期。先经 reasoning_content / textFrame / 并行卡死三处修复后通过。` 截图：`用户聊天流截图（已贴对话）`

---

## SC2 — 三宿主 read 全覆盖（含 A-24 大区域防御）

### SC2-Word（最先、最简）
- **【宿主】** Word
- **【前置】** 一个 ≥3 段正文的文档（段落清楚分开；有个标题更好）。
- **【操作步骤】** Task Pane 输入并发送：`数一下文档有几段并把第 3 段读出来`
- **【预期 PASS 判据】**
  - 出现折叠卡「**读取了文档段落总数**」（get_paragraph_count）
  - 出现折叠卡「**读取了第 3 段**」（get_paragraph_at）
  - 最终回复里段数正确、第 3 段内容正确（对着文档肉眼核）。
- **【要截的图】** 1 张：两张折叠卡 + 最终回复。
- **【回填栏】** 结果：`PASS` 备注：`真机实测（测试文档 Aster-UAT-Word.docx，5 段）。出现「读取了文档段落总数」+「读取了第 3 段」两张中文折叠卡；段数与第 3 段内容正确。` 截图：`用户实测确认`

### SC2-Excel（含 A-24）
- **【宿主】** Excel
- **【前置】** 一个有数据的表，used range **> 20 行**（比如填到 A1:E50）。
- **【操作步骤 a（正常 read）】** 输入并发送：`告诉我当前 used range 的形状和前 20 行`
  - **【预期 PASS】** **必须同时**出现两张折叠卡（缺任一判 FAIL）：
    - 「**读取了已用区域概况**」（get_used_range_summary）
    - 「**读取了区域 {地址} 的内容**」（get_range_values，{地址} 形如 A1:E20）
    - 概况（行列数/形状）和前 20 行数据对着表肉眼核对正确。
- **【操作步骤 b（A-24 大区域防御）】** 另起一句，输入并发送：
  `读取 A1:Z100000 这个区域的所有值`（这是 26 列 × 10 万行 = 260 万单元格，远超 1 万上限）
  - **【预期 PASS】** agent **不卡死、不崩 tab**；read 返回被拒绝，错误/提示文案应含这类原文：
    - 「**选区有 …… 个单元格，过大无法整块读取**」
    - 「**请改用 get_used_range_summary 看概况，或指定更小的 address**」
  - agent 应据此**改走 get_used_range_summary**（或回复让你缩小范围），**绝不**真的把 260 万格读出来。
- **【要截的图】** 2 张：① 步骤 a 两张折叠卡；② 步骤 b 的"过大无法整块读取"提示 + tab 仍正常。
- **【回填栏】** a 结果：`PASS` b(A-24) 结果：`PASS` 备注：`真机实测（测试文档 Aster-UAT-Excel.xlsx，used range A1:E50）。步骤 a：「读取了已用区域概况」+「读取了区域 A1:E20 的内容」双卡齐出、数据正确。步骤 b：A1:Z100000 被拒、tab 不崩。` 截图：`用户实测确认`

### SC2-PPT
- **【宿主】** PowerPoint
- **【前置】** 多 slide deck（每张最好有标题）。
- **【操作步骤】** 输入并发送：`列出所有 slide 标题`
- **【预期 PASS 判据】**
  - 出现折叠卡「**读取了全部幻灯片清单**」（list_slides）。
  - 最终回复把标题**按顺序**列出（第 1 张→第 N 张，**不能反序/乱序**——这是已知 Web 反序 bug 的防御点 PPT-05）。
- **【要截的图】** 1 张：折叠卡 + 有序标题列表。
- **【回填栏】** 结果：`PASS` 备注：`真机实测。出现「读取了全部幻灯片清单」中文折叠卡；8 张标题按 1→8 顺序列出（无反序，PPT-05 防御有效）。` 截图：`用户聊天流截图（已贴标题表）`

---

## SC3 — AgentControlBar 三态文案 + 5 秒安抚

- **【宿主】** 任一（PPT/Excel/Word 都行，挑一个跑即可）
- **【前置】** 能正常触发一次 agent run（沿用上面任意一条指令）。
- **【操作步骤】**
  1. 发一条会触发读取/思考的指令（如 SC2-Word 那句）。
  2. **盯住 Task Pane 顶部那条状态栏（AgentControlBar）**，看 run 过程中文案变化。
  3. （验 5 秒安抚）想办法制造一次"慢"——比如让它读较大内容、或网络较慢时——使某一阶段 **超过 5 秒没更新**。
- **【预期 PASS 判据】**
  - 顶部 bar 文案随阶段**变化、非统一 spinner**，应能看到这几种原文之一/多个：
    - 「**正在思考…**」（等 LLM 时）
    - 「**正在读取…**」（跑 read tool 时）
    - 「**正在写入…**」（跑 write tool 时；本期写工具少，可能不出现，不强求）
  - 当某阶段 **>5 秒无更新**，bar 多出一条**安抚行**，文案是这几种之一：
    - 「**还在跑，正在等 LLM 思考…**」（思考阶段）
    - 「**正在读取，稍候…**」（读取阶段）
    - 「**正在写入，稍候…**」（写入阶段）
- **【要截的图】** 1–2 张：一张正常三态文案，一张 5 秒后的安抚行（若能制造慢）。
- **【回填栏】** 三态结果：`PASS` 5秒安抚结果：`PASS` 备注：`用户本机实测通过。` 截图：`用户实测确认`

---

## SC5 — 熔断「Agent gave up」红卡（最难构造，看清触发法）

- **【宿主】** 任一（Word 最好构造，见下）
- **【背景】** 熔断规则：**同一个工具连续失败 ≥3 次（同错误码）** → 强制 abort（CIRCUIT_OPEN）→ 弹红色「Agent gave up」卡。难点是要让 agent 真的把同一个失败工具连按 3 次。
- **【操作步骤 — 推荐触发法（Word 写锁）】**
  1. 在 Word 里把文档设为**受保护/限制编辑**（审阅 → 限制编辑 → 勾「仅允许此类编辑：不允许任何更改(只读)」→ 启动强制保护），或标记为最终状态使其只读。
  2. Task Pane 输入一条**要求改写文档**的指令，例如：`在文档末尾追加一段总结`
  3. 由于文档只读，写操作（append_paragraph）会反复失败（同错误码）。观察 agent 是否自动重试到第 3 次触发熔断。
- **【操作步骤 — 备选触发法】** 若上面 agent 没自然重试到 3 次：跑 write 指令的同时**临时断网**（关 Wi-Fi）制造连续 HOST_API/网络层同码失败，看是否累计 3 次熔断。
- **【预期 PASS 判据】**
  - 出现**红色**卡片，标题原文：「**Aster 试了几次都没成功**」
  - 卡片描述含原文：「**试了 X 次 {工具名} 都失败了。**」（X ≥ 3）后面可能跟一句 LLM 的建议。
  - 卡片有「**重新试试**」按钮，点它能**重开一轮**。
  - **关键反向核对：卡片上没有「撤销本次」/撤销类按钮**（本期设计 D-05：红卡只给重试，不给撤销）。
- **【构造不出来怎么办（如实标注）】** 如果试了推荐 + 备选都无法让 agent 自然连续失败 3 次（LLM 可能失败 1 次就放弃不重试），**不要硬凑、不要伪造**。把本条结果标 **N/A（真机无法稳定构造连续3次同码失败）**，备注说明你试了哪些方法。该熔断逻辑已有代码层覆盖（circuit-breaker.test.ts 8 测试 + ChatStream.giveup.test.tsx 9 测试全绿），真机 N/A 可接受。
- **【要截的图】** 若 PASS：1 张红卡（看清标题/「试了 X 次」/「重新试试」/无撤销按钮）。
- **【回填栏】** 结果：`PASS`（升级自原计划的 N/A） 触发法：`真机自然触发——UAT 早期 list_slides 因 textFrame InvalidArgument 连续 3 次同码失败，自动触发 CIRCUIT_OPEN。` 备注：`红卡标题「Aster 试了几次都没成功」、描述「试了 3 次 list_slides 都失败了」、有「重新试试」按钮、无撤销按钮（D-05 反向核对通过）。该 list_slides 故障随后已修复，但这张红卡本身是 SC5 的有效真机证据。` 截图：`用户聊天流红卡截图（已贴）`

---

## SC6 — model 字段下拉（select vs input）

- **【宿主】** 通用（任一宿主的 Task Pane → Settings 即可）
- **【前置】** 无（不需要发指令，纯看表单控件）。
- **【操作步骤】**
  1. 打开 Settings（设置面板）。
  2. **编辑内置 DeepSeek**：进它的编辑表单，看 model 字段。
  3. **编辑内置 AiHubMix**：同样看 model 字段。
  4. **新建/编辑一个自定义 Provider**：看 model 字段。
- **【预期 PASS 判据】**
  - 内置 **DeepSeek**：model 是**下拉 select**，选项 = `deepseek-v4-pro`、`deepseek-v4-flash`。
  - 内置 **AiHubMix**：model 是**下拉 select**，选项 = `gpt-5.1`、`gemini-3.5-flash`。
  - **自定义 Provider**：model 是**文本输入框 input**（可手打任意字符串），不是下拉。
- **【要截的图】** 2 张：① 内置 Provider 的 select（拉开看选项）；② 自定义 Provider 的 input。
- **【回填栏】** 内置select结果：`PASS` 自定义input结果：`PASS` 备注：`用户本机实测：内置 DeepSeek/AiHubMix model 为下拉 select（选项符合）；自定义 Provider model 为文本输入框。` 截图：`用户实测确认`

---

## 汇总（用户填完后给我，我归档收尾）

| SC | 内容 | 结果(PASS/FAIL/N-A) | 截图 |
|----|------|---------------------|------|
| SC1 | PPT read 链路 + 中文折叠卡 | `PASS` | 用户聊天流截图 |
| SC2-Word | 段落计数 + 读第3段 | `PASS` | 用户实测确认 |
| SC2-Excel(a) | used range 概况 + 前20行(双卡) | `PASS` | 用户实测确认 |
| SC2-Excel(b) | A-24 大区域拒绝不爆 tab | `PASS` | 用户实测确认 |
| SC2-PPT | slide 标题有序列出 | `PASS` | 用户聊天流截图 |
| SC3 | 三态文案 + 5秒安抚 | `PASS` | 用户实测确认 |
| SC5 | 熔断红卡 + 重试 + 无撤销 | `PASS` | 用户聊天流红卡截图 |
| SC6 | model select / 自定义 input | `PASS` | 用户实测确认 |

> **结果：全 8 项 PASS（真机实测）。** → 建 04-09-SUMMARY.md + 走 phase.complete。

## UAT 过程中发现并修复的真机 bug（单测 mock 盲区，已补结构性守门）

真机 UAT 暴露了 3 个单测从未覆盖的真实环境 bug，均已修复 + 部署 + 加测试守门：

1. **reasoning_content 往返 400**（commit `6f2ab08`）— DeepSeek V4 thinking 模式下，带 tool 结果发起的第二轮请求必须回传 assistant 的 `reasoning_content`，否则 400。Aster 全链路曾丢弃该字段，导致**所有多步 tool calling 真机崩溃**。修复：sse.ts 解析 reasoning_delta、loop-helpers 累积并非空回传。守门：sse.test + loop-helpers.test。
2. **PPT textFrame InvalidArgument**（commit `3cab5f7`）— `Shape.textFrame` 对 Image/Group/Table 等无文本框类型在访问时即抛 InvalidArgument，导致 list_slides/get_slide 真机必挂（测试 deck 首张即 Logo 图片）。修复：按 `shape.type` 白名单过滤再碰 textFrame。守门：PptAdapter.read.test +2。
3. **并行工具调用 host 卡死冻 UI**（commit `cfb24d7`）— LLM 一次并行发起 8 个 get_slide → 大量 PowerPoint.run 在 Office for Web 卡住，agent 无 per-tool 超时 → 冻死 5 分钟。修复：dispatchTool 加 15s 超时降级。守门：tools/index.test +2。

调试记录：`.planning/debug/reasoning-content-roundtrip.md`、`.planning/debug/ppt-list-slides-host-fail.md`。
最终线上构建：`main-DphSYwO0.js`（HEAD = `cfb24d7`）。
