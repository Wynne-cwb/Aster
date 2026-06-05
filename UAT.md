# Aster v2.3「精装与定力」UAT 清单 + 续作交接

> **这份文件两用：**
> - **【第一部分】给后续 Agent 的接力交接** —— 新 session 开始时，Agent 请先读完这一部分再动手。
> - **【第二部分】给用户的大白话测试清单** —— 你逐条照着做。
> - **【第三部分】结果记录区** —— 每测一条就在这里打勾记结果，跨 session 接力不丢进度。
>
> 用户会**分多次（可能重启 session）逐条测**。Agent 每次进来先看【第三部分】哪些还没测，接着陪测。

---

# 第一部分：给后续 Agent 的接力交接（新 session 必读）

## 你的角色
你是 Aster v2.3 里程碑的 **Team Lead 接棒人**。代码已全部写完、测过、**已部署上线**。现在停在「等用户逐条做真机 UAT」这一步。你的活 = 陪用户逐条验收 → 记录结果 → 处理失败项 → 全过后收尾归档。整套流程遵循 `gsd-team-lead` skill。

## 当前状态快照（截至 2026-06-05 —— ✅ UAT 全过，待 /gsd-complete-milestone）
- **5 个实现阶段全部完成**（Phase 20–24，10 个 plan），均已 `git push` 上线。
- `origin/main` HEAD = **`cbd56e9`**（含 v2.3 全部 + 真机修复链 **UAT-1..11**），GitHub Pages 已部署，CI（含打包体积守门）绿。
- 线上地址：**https://wynne-cwb.github.io/Aster/manifest.xml** —— 已是 v2.3 最新，可直接 sideload 真机测。
- 自动化检查全绿（Team Lead 已独立复跑）：**测试 1075 passed / 0 failed**、**打包体积 81.3KB ≤ 82KB**、**撤销守门 39 passed**、tsc 0。
- **✅ UAT 全部 PASS（2026-06-05 用户验收）**：①②③ 逐项真机详验（③ spike-gate 用户拍板**铺开**），④⑤⑥/A1-5/batch_write 统一 UAT 用户整体验收 PASS。spike-gate 三决策已定（铺开 / 预览面板显示侧边栏 / 簿记脚本收尾定）。
- 真机修复链 UAT-1..11 全部 Lead 独立复验 + push + Pages 部署（最新 UAT-11=`cbd56e9` 修预览面板挂载真根因）。
- **下一步 = `/gsd-complete-milestone`**（用户将在新 session 跑）：打 tag `v2.3`、归档里程碑、STATE verifying→complete。
- 任务看板：team **`aster-v23`**，task **#6「统一 UAT + 收尾」= in_progress**（收尾中）；其余全 completed；**所有 TeamMate 已关停**（团队无活跃成员）。
- `.planning/STATE.md` 仍 `status: verifying` —— /gsd-complete-milestone 会转 complete。

## v2.3 到底做了啥（一句话版）
- **A 系列（PPT 视觉质量）**：① 一个工具一键搭好一整页幻灯片（`apply_slide_layout`，6 套版式，可编辑原生形状，撤销=删整页）② AI 用确定性代码自查版面（溢出/重叠/越界/对比度）③ 侧边栏自渲染预览 + 看图自查（spike，保真度待用户人眼判）。
- **B 系列（上下文抗幻觉）**：④ 长对话按 token 水位自动压缩摘要 + F5 恢复 ⑤ 抗幻觉「信刚读的、不信旧记忆」⑥ 时钟移出缓存前缀（性能）。

## 规矩（务必遵守）
- **逐条测、跨 session**：结果记在【第三部分】表格。每次进来先看哪些 `未测`，接着陪测。
- **某条 FAIL 时，别自己埋头裸改**：
  1. 开一个**全新 TeamMate**（用 `Agent` 工具，`team_name: "aster-v23"`，起个名如 `fixer-xx`），走 GSD 修复流程（`/gsd-debug` 或 `/gsd-quick`）。**一个 TeamMate 只做一个 bounded step**，不复用。
  2. 修完 → 跑回归测试（**Node 22**）→ Team Lead 独立复验 → **用结构化对象关停** TeamMate：`SendMessage` 的 `message` 字段设成 `{"type":"shutdown_request","reason":"..."}`（⚠️ 不能发纯文本，否则进程不会真终止）。
  3. 请用户重测那一条。
- **改任何代码前走 GSD**（`/gsd-quick` 小改 / `/gsd-debug` 查 bug），别裸用 Edit/Write 改源码。
- **跑测试/构建一定用 Node 22**：系统 `node` 若是 20.x 会因 jsdom 误报一堆失败。本机有 nvm v22（`~/.nvm/versions/node/v22.22.1/bin`）。
- **改 UI 前先 `Skill("aster-design-system")`**（teal 克制风格）；动 Lingui 文案（`@lingui/macro`）后必须 `npm run extract`，否则 coverage 测试红。
- **打包体积红线 82KB**：余量只剩 ~1.1KB，任何重模块必须懒加载；验证先 `npm run build` 再 `npm run size`（陈旧 dist 会给假绿）。
- **簿记 bug 老复发**：勾 `ROADMAP.md` 要勾**两处**（顶层 phase-list 行 + 下方进度表行），改 `STATE.md` 状态位也手工核对。

## 待向用户收集的 3 个决策（UAT 时顺便问）
1. **[C] 预览面板要不要显示**：现在默认「显示在侧边栏」。当初讨论想「先藏后台不显示」，但最终方案定的是「显示」。问用户保留显示还是改藏后台（开关：`src/agent/tools/visual-check-config.ts`，把 `SlidePreviewPanel` 的挂载方式改 offscreen 即可，改动极小）。
2. **spike-gate 结论**（测试③的产物）：预览图 vs 真实 PPT 够不够像 → **够用 = 保留**（默认）；**不够用 = 关掉**（改 `src/agent/tools/visual-check-config.ts` 里 `PVQ06_VISUAL_CHECK_ENABLED = false` → `visual_check_slide` 工具不再注册，回落到只剩②的几何自查）。
3. **要不要加「簿记一致性守门脚本」**：上面那个勾选漏同步 bug 已复发 5 次，用户原则是「复发≥2 次加结构守门」。要加就写个轻量脚本断言「顶层 `[x]` 的 phase 都有对应『Complete』进度表行」。

## UAT 全过后的收尾动作（按顺序）
1. 把 [C] + spike 结论回填到 `.planning/phases/24-a-p2-bundle/24-UAT-PACKET.md`。
2. 若 spike 判**降级**：改 `PVQ06_VISUAL_CHECK_ENABLED = false` + 更新 `.planning/REQUIREMENTS.md` 的 PVQ-06 状态 + 告知用户已回落几何自查。
3. `STATE.md` 的 `status` 从 `verifying` 改为里程碑完成态。
4. 打 tag `v2.3`，用 `/gsd-complete-milestone` 归档里程碑。
5. `git push origin main`（含 tag）→ 确认 Pages 部署绿。**发布动作本项目已授权可直接做**（仅限 main 常规 push + Pages），做完告知用户 commit hash + 部署状态。

## 真相源文件（要细节去这看）
- **技术版完整 UAT 包**：`.planning/v2.3-UAT-PACKET.md`
- **spike 专项步骤**（采对比图怎么采）：`.planning/phases/24-a-p2-bundle/24-UAT-PACKET.md`
- **已知小毛病清单**：`.planning/phases/24-a-p2-bundle/24-REVIEW.md`
- **里程碑状态**：`.planning/STATE.md`（`status: verifying`）
- **路线图**：`.planning/ROADMAP.md`（v2.3 = Phases 20–24）

## 已知小毛病（不阻塞验收，别当成新 bug 去查）
- **WR-02**（低）：`visual_check_slide` 的 `slideIndex` 参数声明了但实现没用（截图始终来自最后挂载的预览面板）。**单页测无影响**。
- **WR-03**（低）：多个预览面板同时存在时全局取值缺身份守卫（当前 UI 不会触发）。
- → 所以提醒用户测预览那条（③）时**一次只做一页**，避开这俩。
- **风格小不一致**：`visual_check_slide` 返回没走统一的 `wrapReadResult` 包装，功能无碍。

---

# 第二部分：给用户的大白话测试清单

## 准备（约 5 分钟）
1. 在 **PowerPoint 网页版**打开一个演示文稿（随便有几页字的）。
2. 打开 Aster 侧边栏，设置里填好 **DeepSeek 的 Key**（聊天用）和 **AiHubMix 的 Key**（看图自查用）。
3. 刷新一下页面，确保拿到的是刚上线的新版。

---

## 第一组：PPT 做得好不好看（在 PowerPoint 里测）

### 测试 ① AI 一键做一整页幻灯片 ⭐最该测
- **测什么**：以前 AI 摆一页要分十几个小动作、撤销很烦。现在一次就搭好一整页。
- **怎么做**：跟 AI 说「**帮我做一页 KPI 幻灯片，主题是 2026 第一季度营收，给我 4 个关键数字**」。
- **怎样算过**：
  - [ ] PPT 多出一页，标题/数字/说明摆得**整整齐齐**，没有字溢出框、没有两块叠在一起。
  - [ ] 这些文字框是**能点能改的真形状**（点一下能选中、能改字、能拖动），不是一张图片。
  - [ ] 点 Aster 的**撤销**，刚那一整页**干净消失**，文档回到没做之前。
- **多试几种版式**：再让它做「封面页」「两栏对比」「时间线」「左图右文」「要点清单」——一共 6 种，每种看看摆得齐不齐。

### 测试 ② AI 会自己检查版面有没有问题
- **测什么**：AI 能自己发现「这块字太多溢出了 / 这两块叠住了 / 这颜色太浅看不清」，而不是瞎猜。
- **怎么做**：故意让它往一个小框塞很长一段字，或对一个很挤的页面说「**帮我检查一下这页排版有没有问题**」。
- **怎样算过**：
  - [ ] AI 能**具体指出**哪里溢出/重叠/太挤/颜色看不清。
  - [ ] AI **主动帮你改好**（缩字、挪位置、换颜色）。

### 测试 ③ 幻灯片小预览图 + 看图自查 ⭐这个要你拍板
- **测什么**：做完一页后，侧边栏会冒出一个**小预览图**（Aster 自己画的、模拟这页长啥样），AI 还能给它「拍照看图」挑毛病。**但自画的预览和 PowerPoint 真实显示不可能一模一样**（字体不同会让换行不一样），所以要你亲眼判断：够不够像、值不值得留这功能。
- **怎么做**：
  1. 接着①做完那页，看侧边栏是不是出现了**幻灯片预览**小图。
  2. 跟 AI 说「**帮我对这页做个视觉自查**」，它会给预览图拍照、用文字告诉你哪里有问题。
  3. **自己截两张图**：一张侧边栏的预览小图，一张 PowerPoint 里真实那页。
  4. 两张图并排看。
- **你要回答（整个里程碑唯一要你拍板的）**：
  - [ ] 这俩图**大致像不像**？（字体造成的小换行差异不算）
  - [ ] 溢出/重叠/留白/颜色这四点，预览图判断的和真实的**方向一致吗**？
  - **结论**：□ 像 → 保留这功能　□ 差太远 → 让我关掉（只留②的纯算坐标检查兜底）
- **顺带帮我定 [C]**：这预览小图现在**默认显示在侧边栏**。你看了觉得：□ 显示出来好（还能当产品雏形）　□ 别显示、藏后台就行
- ⚠️ **一次只做一页再测**，别连着做好几页一起测（有个已知小毛病在多页同时预览时会迷糊，单页没事）。

---

## 第二组：AI 长时间聊天清不清醒（PPT / Excel / Word 都能测）

### 测试 ④ 聊很久也不乱、刷新不丢
- **测什么**：聊得特别长时，AI 会自动把最早的对话**压成要点**记着，省得越聊越糊涂；刷新页面也不会全忘。
- **怎么做**：跟它进行一段**很长**的对话（多贴几篇长文档、多来回几十轮）→ 按 **F5 刷新**侧边栏。
- **怎样算过**：
  - [ ] 聊很久后，它**仍记得前面定下的关键事**（你的偏好、决定）；被你**推翻过的旧信息应该忘掉**。
  - [ ] F5 刷新后，**聊天记录和记忆都还在**，不是空白。

### 测试 ⑤ 你改了文档，AI 会重新看（不用老印象）
- **测什么**：AI 读过文档后，如果你手动改了内容，过几轮再让它干活，它应该**重新看现在的样子**，而不是凭几十轮前的老记忆。
- **怎么做**：让 AI 读一下文档 → 你**手动改几个字** → 隔几轮再让它基于文档做点事。
- **怎样算过**：
  - [ ] 它干活用的是**你改之后的最新内容**，没拿过时旧数据。

### 测试 ⑥ 问时间答得对（顺手测）
- **测什么**：之前为优化性能把「当前时间」在内部挪了位置，确认 AI 还能正常答时间。
- **怎么做**：问它「**现在几点？今天星期几？**」
- **怎样算过**：
  - [ ] 能答出**对的日期、时间、星期**。

---

## 测哪些软件（不用全测）
| | PowerPoint | Excel | Word |
|---|---|---|---|
| 第一组（①②③ 做 PPT）| ✅ 必测 | 没这功能 | 没这功能 |
| 第二组（④⑤⑥ 长聊/改文档/时间）| ✅ | 抽一个测 | 抽一个测 |

**最省事跑法**：PowerPoint 把 ①~⑥ 全测；Excel 或 Word 随便挑一个，把 ④⑤⑥ 快速过一下。

---

# 第三部分：结果记录区（测一条记一条）

> 测完一条就把状态从「未测」改成「✅ 通过」或「❌ 失败」，失败的在备注写**哪一步、什么现象**（能附截图最好）。Agent 据此判断要不要开修复 TeamMate。

| 测试项 | 软件 | 状态 | 备注 / 失败现象 | 测试日期 |
|---|---|---|---|---|
| ① 一键做整页幻灯片 | PPT | ✅ 通过（KPI 场景，build 191fb82）| `apply_slide_layout` 真机 ok=true + **视觉用户确认"不错"**。**已确认**：A1-2 真形状可编辑 ✅、A1-4 撤销删整页 ✅、A1-3 版面好看 ✅。历经 UAT-1 非法枚举 → UAT-2/3 网页版建页竞态（拆双 run）→ UAT-4 视觉（删默认占位符 + 去黑边 + 淡 teal 圆角卡 + 数字 H/V 居中 + 默认品牌色 teal）。**A1-5**（其余 5 套版式 cover/two_column/timeline/image_text/bullet_list 抽查）：✅ 用户验收 PASS（06-05，统一 UAT 整体拍板；6 套版式同一 apply_slide_layout 路径，KPI 已真机充分验，dogfood 0 misalignment）。 | 06-04→05 |
| ② AI 自查版面问题 | PPT | ✅ 对齐检测真机确认（build 2f2a0e2）| 06-04 闭环 OK + 发现"漏查对齐"缺口 → UAT-6 加 checkAlignment。06-05 真机验到（build 2f2a0e2，实为用户 ③ 尝试里几何自查兜底出场）：AI 自查一页 KPI（4 卡顶边 217.2/234.18×3），`check_slide_layout` 准确报出 `[misalignment] shapeIds=[5,8,11,14] 形状5上缘217 与 8/11/14（234）相差17pt`，AI 列表呈现并主动问要不要下移对齐。**UAT-6 缺口闭环。** 注：本轮 AI 全程只调读工具（停在征求修复确认），batch_write 未触发（见 UAT-7 行）。 | 06-05 |
| ③ 预览图 + 看图自查（含拍板）| PPT | ✅ **PASS + 铺开**（build cbd56e9，06-05）：自渲染预览面板首次真正挂载、visual_check_slide 不再 skip 出 vision 四项分析、端到端跑通。用户拍板**保真度够用 → 铺开**（PVQ06_VISUAL_CHECK_ENABLED 保持 true，无需改 flag）；预览面板「显示在侧边栏」形态验证可用。历经 race(UAT-9)→建页超时(UAT-10)→预览面板真根因 toolCalls 落 store(UAT-11) 三修 | 06-05 用户对**现有旧页**说「做视觉自查」：AI 调 `visual_check_slide` 正确返回 advisory `预览面板未打开，视觉自查跳过`（设计内兜底，不崩），退回几何自查 `check_slide_layout`（顺带验证了 ② 对齐检测）。**根因**：预览面板仅在 AI 刚 `apply_slide_layout` 建页时挂载、且只画那次的版式数据（ChatStream.tsx:154-169），不能渲染任意旧页 → 看图自查无图可看。**正确测法**＝先「生成一页 KPI 幻灯片」让预览面板出现 → 再「对刚生成这页做视觉自查」→ 采附图1（预览）vs 附图2（PPT真机）四项对比 → 填铺开/降级。**已知边界**：看图自查不支持任意现有页（spike 有意范围；待 ③ 测完定是否记 follow-up）。 | 06-05 |
| ④ 长对话压缩 + F5 恢复 | PPT | ✅ 用户验收 PASS（06-05）| 统一 UAT 收尾用户整体拍板 PASS。底层有 Phase 21 结构性测试守门（摘要压缩高/低水位触发 CTX-03、F5 localStorage 恢复 CTX-04、被推翻信息丢弃 CTX-05）。未提供逐项真机调试报告，按 UAT owner 整体验收记。 | 06-05 |
| ④ 长对话压缩 + F5 恢复 | Excel/Word | ✅ 用户验收 PASS（06-05）| 同上；B 系列压缩/恢复逻辑三宿主共用（host 无关），PPT 验收覆盖即代表性通过。 | 06-05 |
| ⑤ 改文档后 AI 重新看 | PPT | ✅ 用户验收 PASS（06-05）| 统一 UAT 收尾用户拍板 PASS。CTX-06「信刚读文档」= system prompt「文档现状权威」指引 + loop.ts filter 掉历史旧 tool 读数（双层），有 Phase 21 落地。按 UAT owner 整体验收记。 | 06-05 |
| ⑥ 问时间答得对 | PPT | ✅ 用户验收 PASS（06-05）| 统一 UAT 收尾用户拍板 PASS。时间挂 user message 末尾仍可答精确日期+时间+星期（CTX-01/02）；有 system-prompt.test.ts 结构守门（前缀不含分钟级时钟）。 | 06-05 |

## 三个待拍板决策（测到相关项时填）
| 决策 | 选项 | 你的选择 |
|---|---|---|
| [C] 预览面板 | 显示在侧边栏 / 藏后台不显示 | ✅ **显示在侧边栏**（③ PASS 时验证可用，06-05）|
| spike-gate 保真度 | 够用·保留 / 不够·关掉 | ✅ **够用·保留**（PVQ06_VISUAL_CHECK_ENABLED=true 不变，06-05）|
| 簿记守门脚本 | 加 / 不加 | （内部 dev 决策，非阻塞；收尾时定）|

## 失败项 → 修复跟踪（Agent 维护）
| 失败的测试项 | 开了哪个修复 TeamMate | 修复 commit | 复验结果 | 用户重测 |
|---|---|---|---|---|
| ① UAT-1：KPI 非法枚举 `'RoundedRectangle'` | fixer-uat1（已关停）| 1ecc05f→3659ce7 | ✅ 自动化全绿 + teeth 守门 RED 验证 | 真机重测仍 ok=false → 暴露第二根因 ↓ |
| ① 诊断增强：调试报告打构建版本号 + console.warn 宿主原始错误 | diag-uat2（已关停）| 49a08d5 | ✅ 全绿（build 戳 + debugCause→DevTools）| 用 build 戳确认非缓存、拿到原始错误 |
| ① 诊断增强：宿主原始错误进调试报告本地通道（免开 DevTools，不入 LLM）| fixer-uat2（已关停）| 41e4516 | ✅ 1022 passed / ERR-02 隐私门绿 / size 80.93KB | 用户报告直接显示 `InvalidParam passed to GetItem(id)` |
| ① **UAT-2/3：网页版建页竞态**（office-js #2903/#2172）| fixer-uat3（已关停）| 29ce212 | ✅ tsc 0 / 1023 passed / undo 39 / size 80.93KB；Lead 亲读双 run 结构确认 | ✅ 真机 ok=true（build 29ce212）但视觉"很丑"→ UAT-4 ↓ |
| ① **UAT-4：视觉质量**（删默认占位符 + 去黑边 + 淡 teal 圆角卡 + 数字 H/V 居中 + 默认品牌色 teal + AI 不乱选色）| fixer-uat4（已关停）| 191fb82 | ✅ tsc 0 / 1033 passed / undo 39 / size 80.92KB；Lead 亲读 Run B 时序（先建后删避空白页）确认 | ✅ **真机用户确认"不错"通过**（build 191fb82，06-04）|
| **UAT-5：Settings 品牌主题色 color picker**（用户需求，新增功能）| fixer-uat5（已关停）| 5bee75c | ✅ tsc 0 / 1049 passed / undo 39 / **size 81.3KB≤82（余量仅 ~0.7KB，watch）**；i18n extract 已跑。字段 `brandAccentColor`@usePreferencesStore，accent 优先级 = AI明确色 > 用户品牌色 > #009887 | ✅ **真机 PASS**（build 5bee75c，06-04）|
| **UAT-6：自查加"近似未对齐"检测**（测试②发现：自查漏查对齐，AI 修完仍 17pt 错位却报 0 违规）| fixer-uat6（已关停）| 728c810 | ✅ tsc 0 / 1058 passed / 6 版式 dogfood 0 misalignment / size 81.3KB / undo 39。geometry-check 加 checkAlignment（odd-one-out，簇≥3+严格多数派+离群(2,24]pt，跨边去重），保守低误报 | ✅ **真机 PASS**（build 2f2a0e2，06-05）：自查准确报 `[misalignment]` 17pt 偏差，AI 呈现并主动提议对齐 |
| **UAT-7：batch_write PPT 键名 snake/camel 必挂**（测试②发现：batch 首个 op 必挂、单发才成；复发≥2次）| fixer-uat7（已关停）| 2f2a0e2 | ✅ tsc 0 / 1061 passed / size 81.31KB（executeBatch 在 lazy chunk 不压 main）/ undo 39。executeBatch 改 pick 双键（下划线优先）；补 set_shape_text_font 分支(restore_shape_font Record)；failReason 透出真因（隐私干净）；工具描述讲清可批量集；加守门测试 | ✅ 用户验收 PASS（06-05，统一 UAT 整体拍板）。修复有结构性守门测试（executeBatch pick 双键 + set_shape_text_font 分支）；真机未单独触发 batch 多步场景，按 UAT owner 整体验收记 |
| **UAT-8：PPT 网页版「同 sync 建形状即回读 id」竞态**（③ 第二次测发现：apply_slide_layout 真机 Run B·sync 连挂 `InvalidParam passed to GetItem(id)`；AI 降级 add_shape 同样中招，id 5→8 留孤儿；最终熔断。复发≥2次=UAT-2 建页竞态同族）| fixer-uat8（已关停）| **5fd9523**（已 push+Pages 部署完成 06-05）| ✅ Lead 独立复验：tsc 0 / **vitest 1068 passed 0 failed** / undo 39 / **size 81.3KB≤82**；亲读 4 处源码改动（applySlideLayout Run B + addShape 几何/TextBox + addImageShape，均拆「建→commit→post-commit 读 id」，newShapeIds[i]↔spec[i] 不变，#2775 守门留）；**亲做变异测试**：把 h.load(['id']) 塞回创建循环→测试立刻抛真机原句 InvalidParam→守门确实会咬。根因：在创建形状同一 ctx.sync() 回读新形状 .id，网页版宿主对未登记完的新形状按 id 解析即间歇抛错（adapter 自 191fb82 未改=纯潜伏竞态）。结构守门=PptAdapter.test.ts createRaceState() 竞态内核 + 7 聚焦测试 | **待用户重测**（build 5fd9523）：在**干净空白页**上「做一页 KPI 幻灯片…做完视觉自查」，确认 apply_slide_layout ok=true、无孤儿形状/页；顺带 ③ 解除阻塞可继续 ❌ **真机仍挂（5fd9523），被 UAT-9 取代** |
| **UAT-9：正解——reload 集合 + set-diff 定位新形状**（office-js #5022；UAT-8 拆 sync 真机无效后查实）| fixer-uat9（已关停）| **7fcc697**（已 push+Pages 部署完成 06-05）| ✅ Lead 独立复验：tsc 0 / **vitest 1071 passed 0 failed** / undo 39 / **size 81.3KB≤82**；亲读三处 diff 确认对 add-return proxy **零访问**（裸建→sync→reload→set-diff，稳定 proxy 上设属性/读 id），映射断言 newShapes 数==spec 数、#2775 守门留、UAT-4「对齐 post-commit」保住、700ms #2903 延时；**亲做变异测试**：碰一下 add-proxy → 测试立刻红抛真机原句「建形状 Run B·sync」→ 守门会咬。结构守门=污染 Proxy 内核（任何 get/set/call/.load on add-proxy→下一 sync 抛 InvalidParam）+ 10 聚焦测试。细粒度 sync 标签（建形状/重载定位/填充属性 Run B·sync）便于残留定位 | **待用户重测**（build 7fcc697）：**干净空白页**「做一页 KPI 幻灯片…做完视觉自查」，确认 apply ok=true、无孤儿、add_shape 反复不挂；③ 解除阻塞可继续。⚠️ 平台 bug 的 workaround（非 100% 完美）——若仍挂，error: 行会精确指出哪个 sync。✅ **真机验到 race 已根治**（build 7fcc697，06-05）：apply_slide_layout ok=true、13 形状齐全、无 GetItem 错、无孤儿、映射正确。但暴露两个挡 ③ 的新小问题 → UAT-10 |
| **UAT-10：③ 端到端两个小阻塞**（建页 spurious 超时 + 预览面板懒加载时序）| fixer-uat10（已关停）| **e8eeaa8**（已 push+Pages 部署完成 06-05）| ✅ Lead 独立复验：tsc 0 / **vitest 1073·0** / visual-check 7·0 / undo 39 / **size 81.31KB≤82**；亲读两处 diff。(A) apply_slide_layout 首次报「工具调用超时」=15s dispatch 默认太紧（建整页 Run A+700ms+Run B 多 sync）+ 超时留重复孤儿页 → 加 timeoutMs:45s。(B) visual_check_slide 仍「预览面板未打开」=SlidePreviewPanel 懒加载、AI 立刻自查时未 mount → 改轮询等待（同步先探→每150ms→上限5s→settle 400ms）再截图，等不到才回退 skip；加 timeoutMs:40s。不碰 UAT-9 adapter、NFR-09 路径不变。守门=fake-timer 测「等到→真截图」「全程无→跳过」 | **待用户重测**（build e8eeaa8）：干净页「建 KPI 页 → 视觉自查」端到端，确认建页不超时/无孤儿 + 看图自查真正出 vision 反馈 → ③ 进保真度判定（采附图1预览 vs 附图2真机四项对比，填铺开/降级）。✅ **真机验到建页修复**（e8eeaa8）：apply_slide_layout 第一次即 ok=true、不超时、无孤儿、13 形状齐。但 visual_check 仍 skip → 暴露 ③ 真根因 UAT-11 |
| **UAT-11：预览面板从不挂载真根因——store assistant 消息漏写 toolCalls**（③ 从未成功的真因；非时序/非懒加载，UAT-10 轮询在等一个永不挂载的面板）| fixer-uat11（已关停）| **cbd56e9**（已 push+Pages 部署完成 06-05）| ✅ Lead 独立复验：tsc 0 / **vitest 1075·0** / loop-helpers 11·0 / undo 39 / **size 81.3KB≤82**；亲读 diff。根因：loop-helpers.ts streamAssistantTurn finalize 只写 {isStreaming:false}，toolCalls 只进 wire messages 不进 chat store；ChatStream 按 store m.toolCalls 反查 apply_slide_layout 推 layoutArgs 挂 SlidePreviewPanel → store 无 toolCalls → layoutArgs 恒 null → 面板从不挂载 → visual_check 永远 skip。修：finalize 带 toolCalls:toolCallsThisTurn（有 tool call 时）。守门=测「有 apply_slide_layout 轮→store 消息 toolCalls 含对象 args .layout 可读」+ 已验旧代码下该测试 FAIL。注：F5 不恢复预览（serializeForStorage 丢 tool 消息，超范围）；隐私 OK（args 无 key）| **待用户重测**（build cbd56e9）：干净页「做一页 KPI…做完视觉自查」，**预期首次真正看到「幻灯片预览」面板 + visual_check 出 vision 四项分析** → ③ 进保真度判定（附图1预览 vs 附图2真机四项对比 → 填铺开/降级）|

### 修复 UAT-1 范围（apply_slide_layout 真机失败）
**根因**（Lead 已查实）：`src/agent/design/ppt-layouts.ts` 的几何形状类型用了 `'RoundedRectangle'`，非 Office.js `GeometricShapeType` 合法值（合法=`'RoundRectangle'`，无"ed"）。`'Rectangle'`/`'Ellipse'` 是合法的，所以只有带圆角矩形的版式（KPI）真机挂；纯 TextBox 版式（封面/两栏/要点/图文）和时间线（Rectangle+Ellipse）理论上没事。mock 测试不校验枚举值 → 假绿。
**三处修**：
1. **主因**：`ppt-layouts.ts` L31 类型 union + L175 kpi_value 的 `'RoundedRectangle'` → `'RoundRectangle'`。全文件扫一遍有没有别的非法 shapeType。
2. **次生（孤儿页）**：`PptAdapter.applySlideLayout`——任一步在 `slides.add()` 之后抛错时，用已捕获的 index/id 另起一个 `PowerPoint.run` 删掉半成品新页再 re-throw，失败不留脏页。
3. **结构守门（防复发）**：加测试断言「6 套版式产出的所有非-TextBox shapeType + ShapeSpec 类型 union 里的值，都 ∈ Office.js GeometricShapeType 合法集」。补强 mock：addGeometricShape mock 收到非法枚举值就抛（复刻真机），堵住 mock-vs-real 缺口。
**验证**：tsc + 全量测试（Node 22）+ build/size（≤82KB）。**真机只能用户重测**（我们这边连不上 Office for Web）。修完 Lead push 上线，用户重测①。
