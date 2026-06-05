# Milestones

## v2.3 精装与定力 (Shipped: 2026-06-05)

**Delivered:** 在 v2.2 多模态地基上做两个纵深提质——（A）让 PPT 产出从「文字对但粗糙」升级到「有设计规范、整齐专业、可继续编辑」（设计 token + 确定性几何自查 + `apply_slide_layout` 盖印章工具 + 6 套 CSS 导坐标版式库 + 自渲染预览自查闭环）；（B）让 agent 在长对话里保持清醒（时钟脱前缀缓存友好 + token 水位摘要压缩抗幻觉），既保输出质量又顺带省 token。三宿主 Office for Web 真机端到端 UAT 全过（11 个真机 bug 全修），已上线 GitHub Pages（线上 `1fe9529`，tag `v2.3`，origin/main 同步）。

**Stats:**
- Phases: 5（20, 21, 22, 23, 24）
- Plans: 10（20:1 · 21:2 · 22:1 · 23:2 · 24:4；Phase 24 含 UAT/Release 收尾）
- Commits（v2.2..v2.3 区间 `0d5fccf..1fe9529`）: 98（含 v2.2 收官 quick task 260603-fx8 + v2.3 全部实现 + 11 个真机 UAT 修复 + 2 个收尾 quick task 260604-fzn/gld）
- Files changed: 111（+17.1K / −0.7K，含 .planning 文档）· src LOC: ~39.4K（ts/tsx，v2.2 ~34.7K → +~4.7K）
- Tests: **1075 passed / 0 failed**（80 files；尾部 3 个 `retry.test.ts` NetworkError 是已知噪音非失败）· Bundle: **81.3 KB gzip ≤ 82 KB CI gate**（余量 ~0.7KB，UAT-5 品牌色 picker 后较 Phase 24 收口 80.86KB 略涨）· tsc 0 · undo `operationLog.integration` 39 green · **0 净新增运行时依赖**（html2canvas 仅动态 import）
- Timeline: 2026-06-03（milestone start，同 v2.2 ship 日）→ 2026-06-05（ship）
- Tag: `v2.3` @ `1fe9529`

**Key accomplishments:**

1. **B 时钟脱前缀——缓存友好（CTX-01/02）** — 实时时钟从 `buildSystemPrompt` 的 system 前缀迁到 wire 末尾当前 user message（新增导出 `buildTimeContext()`，`loop.ts` 唯一注入站点），`system+tools+历史` 长段前缀变完全静态可缓存；`chatStore` 持久化 raw userPrompt（历史永远无时间戳干净）；CTX-02 用 `not.toMatch(/\d{1,2}:\d{2}/)` 三宿主结构性测试守门防回退
2. **B token 水位摘要压缩 + 稳定前缀 + 持久化 + 截断重审（CTX-03/04/05）** — 新建 `compaction.ts`：按 token 高/低水位（HIGH 120K「严格大于」触发 / LOW 40K 回落 / FLOOR 4 轮 / BACKSTOP 160K，初值 UAT 可调）把最老一段历史折成要点摘要（复用 `resolveLLMConfig()` 已配置 model 静默压缩，**不硬编 flash**），摘要作 `role:'system'` 固定消息插在 `[system]` 后 → `[system][摘要]` 成新稳定缓存前缀（绝不 mutate `chatStore.messages`，UI 历史完整）；摘要 + `summaryThroughId` 随 `saveHistory` 持久化（version 1→2，F5 可恢复）；`truncateTo20Turns` 滑动窗口重构为 token 上界 + 整轮丢 + 地板保护的兜底 `applyHistoryBackstop`（compaction 是常规主控，backstop 是兜底的兜底）
3. **B 三宿主抗幻觉指引（CTX-06）** — PPT/Excel/Word 领域段各加一条**独立**「文档现状权威」抗幻觉项（统一锚点句「旧读数早已过时」），让模型永远信任刚重读的文档现状、不依赖几十轮前旧读数；写成与坐标/自查规则解耦的独立条目，使 Phase 23（PVQ-05）能干净删 PPT 冗余坐标/自查规则而保留此指引
4. **A P0 设计 token（配色不锁死）+ 几何自查四项（PVQ-01/02）** — 新建 `ppt-tokens.ts` 集中**结构** token（商务密实字号阶梯 + 页边距 + 两套参数化网格 + `DEFAULT_CANVAS_PT` 960×540pt 标准宽屏），**配色不锁死**（用户 2026-06-03 推翻固定调色板，无 palette 数组，配色运行时由 AI freehand 生成 hex，teal 仅兜底）；新建 `geometry-check.ts` 纯 TS 零依赖四项确定性自查——溢出/重叠/越界/对比（WCAG，配色不锁死后**唯一颜色护栏**，bg 读不到诚实降级非假阳性）；`check_slide_layout` read 工具把违规清单喂回 LLM 自主重排（PPT 工具 21→22）
5. **A P1 盖印章工具 + 6 版式库 + prompt 重写（PVQ-03/04/05）** — `apply_slide_layout` write 工具（架构 **(B) create+fill**：单 `PowerPoint.run` 建末页 + 填整页原生可编辑形状；**reverse = 删整张新页**复用 `delete_slide_by_index`（Record 对象，零新增 inverse，撤销原子，按构造绝不动既有内容）；新 `PostStateSnapshot.kind 'ppt_layout'` + humanLabel + 入 PPT_TOOLS + `operationLog.integration.test` 守门）；`ppt-layouts.ts` 6 套固化 960×540 坐标版式（封面/大数字KPI/两栏对比/时间线/图文左右/要点列表，配色全参数化收 AI hex，geometry dogfood 6/6 零 overlap/oob）；内部自动跑几何自查 → `data.layout_check` evidence + `image_slots` autonomous-insert；PPT 领域段 prompt 重写（删机械摆坐标 / 宪法式自查清单冗余规则，保 CTX-06 抗幻觉 + 全部精确判断标准，加判断级指引 + 硬底线）（PPT 工具 22→23）
6. **A P2 自渲染预览 + 视觉自查闭环 + bundle 守门（PVQ-06/NFR-11）** — `SlidePreviewPanel`（React.lazy 独立 chunk，teal 克制，绝对定位 div 按 960×540 等比重建 slide）+ `html2canvas`（精确版本 1.4.1，**仅动态 import**，0 main 增量）截图 → 复用 v2.2 `aihubmix-vision` 自查 4 项（溢出/重叠/留白/对比）→ 文字 evidence（NFR-09 base64 纯局部不进 ToolResult）；`visual_check_slide` read 工具受 `PVQ06_VISUAL_CHECK_ENABLED` flag 控（铺开/降级双路径都落地）；bundle CI gate 全程维持 ≤82KB

**真机 UAT（spike-gate 铺开 + 11 个真机 bug 全修）:**
- **PVQ-06 spike-gate 裁定 = ✅ 铺开**（2026-06-05 用户 Office for Web 真机人眼对比拍板，自渲染预览 vs PowerPoint 保真度够用）→ `PVQ06_VISUAL_CHECK_ENABLED` 保持 `true`，PVQ-06 完整交付（非降级）
- **UAT-1/2** `apply_slide_layout` 真机 `ok=false`：非法 `GeometricShapeType`（`RoundedRectangle`→`RoundRectangle`、裸 `Arrow`→`RightArrow`）+ 几何形状内写文字/字体路径；失败时事务性删孤儿页；编译期穷举 `satisfies` 守门关 mock-vs-real gap
- **UAT-4** 输出质量：删默认占位符 + 去黑边 + KPI 淡底居中（解决「很丑」）
- **UAT-5** Settings 加默认强调色 color picker（用户自定义品牌色，配色不锁死的缺省入口）
- **UAT-6** geometry-check 加「近似未对齐」odd-one-out near-miss 检测（PVQ-02 增强）
- **UAT-7** `batch_write` PPT 参数键名读下划线 + 补 `set_shape_text_font` 分支（PPT 批量必挂修复）
- **UAT-8/9** PPT 网页版新形状定位 race 根治：从「拆双 sync / `GetItem(id)`」改为「reload 集合 + set-diff / 取末 N 个」范式（apply_slide_layout/add_shape/insertImage 共因）
- **UAT-10/11** ③ 自渲染预览端到端跑通：`apply_slide_layout` 加 45s `timeoutMs` + `visual_check` 轮询等懒预览面板挂载（UAT-10）；流式 assistant 消息 finalize 漏写 `toolCalls`→store→ChatStream 取不到 layoutArgs→预览面板从不挂载（UAT-11 真根因）
- **诊断增强（260604-gld）**：调试报告注入构建版本戳 `commit@time`（判是否跑缓存旧 bundle）+ 透出工具失败 code/message/hint + HostApiError 捕底层宿主错误 cause

**Requirements outcome:** **13/13 全部交付**（CTX 6 + PVQ 6 + NFR 1；code-level 验证全绿 + 三宿主真机 UAT 全过）。收尾把 11 项 stale checkbox（CTX-01~06 + PVQ-01~05，实已交付）从 `[ ]`/Pending 翻为 ✅ Complete——GSD `phase.complete` 复发的 stale-checkbox quirk，**第 5 次跨 milestone 复发**（见 memory `project_gsd_tooling_quirks` / `recurring_failure_add_gate`）。

**Known follow-up（不阻塞，记录待后续）:**
- **WR-02**（低）：`visual_check_slide` 的 `slideIndex` 入参声明 required 但实现忽略（截图始终来自最后挂载面板）；单 layout UAT 无影响
- **WR-03**（低）：多预览面板共存时全局 getter 无 identity 守卫（当前无虚拟滚动不触发）
- **风格一致性**（轻微）：`visual_check_slide` 返回未走 `wrapReadResult`（少 result_type 标签 + 50K size-cap），功能无碍
- 详见 `.planning/phases/24-a-p2-bundle/24-REVIEW.md`

**Deferred / carry forward:**
- **C 工具补全**（广度 triage，后续 milestone）：Word ~15 / Excel ~15 / PPT ~6 候选 write tool（高亮/列表/批注/合并单元格/数据透视/线条箭头/PPT 表格等）
- **D WPS 兼容**（换平台押注，独立 milestone，需先决策值不值得做）
- v2.1/v2.2 既有 backlog 残项：LIB-D1 Unsplash 备选 · VIS-D1 DeepSeek 原生多模态降本 · IMG-D1/D2 · FILE-D1 高保真 pptx
- 平台天花板（建不了，非 bug）：PPT 动画/转场/SmartArt/套主题/读背景色 · Word 页边距/纸张 · PPT 取选中图 Preview API 未 GA · `copy_slide` 网页版微软接口不支持

**Known deferred items at close（artifact audit acknowledged，详见 STATE.md §Deferred Items）:** 26 项均为陈旧簿记或已被里程碑 UAT 覆盖，**0 真正未完成**——2 debug sessions（均 fix-applied + 2026-05-29 已部署，状态位未翻）+ 16 quick tasks（均完成有 commit，status 字段缺失的扫描器怪癖）+ 1 todo（builtin-model-dropdown，已由 CARRY-02 v2.0 交付）+ 7 uat_gap 文件（04/07/19 属 v2.0/v2.2 已发布归档 0 open；09/10 属 v2.1 已被 Phase 13 里程碑 UAT 覆盖；24 本里程碑 UAT 刚过 0 open）。**第 5 次复发同一 stale-bookkeeping 模式**——确定待还债（结构性守门至今未兑现）。

---

## v2.2 多模态四件套 (Shipped: 2026-06-03)

**Delivered:** 给 v2.0/v2.1 的 Office 智能代理加上**「看 / 读文件 / 生图 / 找图」四种多模态能力**——Provider 客户端（`aihubmix-vision.ts` / `aihubmix-image.ts`）此前在基座里但从未接进 agent loop，v2.2 把它们接进 loop、配 tool、配 UI，并顺手清掉 v2.1 遗留的 PPT casing 技术债。四件套三宿主 Office for Web 真机端到端 UAT 全 PASS，已上线 GitHub Pages（线上 `0d5fccf`，tag `v2.2`，origin/main 同步）。

**Stats:**

- Phases: 6（14, 15, 16, 17, 18, 19）
- Plans: 25（14:6 · 15:5 · 16:5 · 17:6 · 18:3；Phase 19 = UAT/Release 无独立 plan）
- Commits（v2.1..v2.2 区间 `2c0201e..0d5fccf`）: 130
- Files changed: 187（+34.4K / −2.5K，含 .planning 文档）· src LOC: ~34.7K（ts/tsx，v2.1 ~29.9K → +~4.8K）
- Tests: 885 passed（72 files，收官后 quick task 260603-fx8 增至 892）· Bundle: 80.53 KB gzip ≤ 82 KB CI gate（余量 1.47KB）· 生产 `npm audit --omit=dev` 0 漏洞 · **0 净新增运行时依赖**（4 解析库全懒加载）
- Timeline: 2026-06-01（milestone start）→ 2026-06-03（ship）
- Tag: `v2.2` @ `0d5fccf`

**Key accomplishments:**

1. **MDL — AiHubMix Provider 三路重写 + PPT casing 根治** — `aihubmix-image.ts` 重写为三生图模型三路 response 解析（doubao `output[].url`→fetch 转 base64 / gpt-image-2 `b64_json` / gemini `inlineData`，跳过巨大 thoughtSignature）+ 两套鉴权（Bearer / `x-goog-api-key`，gemini 走 `/gemini/v1beta`），统一裸 base64 `{ base64, mimeType }`；registry 区分视觉 model（gpt-5.4）与三生图 model（默认 doubao-seedream-5.0-lite）；**PPT 工具 casing 中央归一化根治**（dispatch 层 `normalizeToSnakeCase` + 删散落双键容错，清 v2.1 技术债）（MDL-01/02/03）
2. **VIS — 视觉看图（取图 + 上传双来源）** — `get_shape_image` 第 12 个 read tool（PPT shape / Excel chart / Word inline picture）+ 回形针/Ctrl+V 上传图（`attachments` 内存 store，FILE-06 前移）→ 都走 aihubmix-vision 返回文本 evidence；base64 **不进** message.content / serializeForStorage（NFR-09 serialize 守门）；PPT 取图为已知宿主限制（Preview API 未 GA）→ fallback 引导上传（VIS-01/02, FILE-06, NFR-09）
3. **IMG — 图片生成插入（AI 自动直插）** — `generate_ppt_image`（GA `addImageShape` + 独立 run 回读规避 #5022）/ `generate_word_image`（body 级规避 #3434）write tool，**AI 在 loop 内自动直插**（设计反转：原「预览后确认」打断 AI 自主排版 loop，与自动化愿景冲突）+ 返回 shape_id 让 AI 继续 move_shape/set_shape_property 自主排版 + 只读结果卡 + model 三级优先级可选；Excel 诚实拒绝；insert helper 供 Phase 18 复用（IMG-01~05）
4. **FILE — 文件上传与解析（四类全懒加载）** — docx（mammoth ≥1.11.0，CVE 版本锁）/ xlsx（SheetJS 0.20.3）/ pdf（pdfjs-dist 5.7.x，worker 独立文件）/ pptx（jszip + DOMParser 提 `<a:t>`）解析为文本注入 augmented user prompt；附件 chip 标「仅供 AI 阅读」；附件（只读快照）vs agent 自取文档（live 可写回）UX 边界清晰；**4 库全懒加载、0 净新增初始 bundle**（FILE-01~05/07, NFR-10）
5. **LIB — Pexels 公开图库检索** — Settings BYO Pexels key（native fetch + `locale=zh-CN`）→ 缩略图网格 → 选中插入 PPT/Word（复用 IMG insert helper）+ chat 内摄影师署名 + 链接（不叠水印）；code-review 无 HIGH（LIB-01/02/03）
6. **三宿主真机 UAT 全 PASS + 上线** — 四件套 Chrome × Edge 真机端到端验证；**两高危均解**：HR-1 pdf.js worker 在 GitHub Pages base + Office iframe CSP 下加载成功（`public/pdf.worker.min.mjs` 静态路径 `/Aster/`）；HR-2 Pexels 双重 CORS（检索面 + M-1 取图面）均放行——`images.pexels.com` CDN 返回 ACAO，**M-1 未坐实、无需 Cloudflare Worker 兜底**（守住无后台原则）；已部署 GitHub Pages，885 tests green / 0 净新增依赖 / 80.53 KB

**真机 UAT / 收官修复（见 memory `project_browser_image_gen_gotchas` / `project_excel_adapter_gotchas`）:**

- doubao `response_format:'url'` 火山 TOS 签名 URL 被浏览器 CORS 拦死 → 改 `b64_json` 内联
- dispatchTool 15s 超时误杀 21s 慢生图 → ToolDef.timeoutMs 120s 覆盖
- pdf.js worker Vite 7 未 emit → `public/pdf.worker.min.mjs` 静态路径 `/Aster/`
- 收官 quick task `260603-fx8`（post-tag）：Excel adapter 两 bug——executeBatch 按 op.tool 分派（batch_write 含 apply_formula/set_cell 不再从 index 0 失败）+ resolveRange helper 解析「表名!A1」sheet-qualified 地址（15 处统一替换）；892 tests green

**设计反转（IMG-03，2026-06-02 用户拍板）:** 原「预览后确认再插入」(D-01/02/03) → AI 自动直插——确认卡打断 AI 自主排版 loop，与「AI 自动化操作」愿景及既有「无授权 UX/信任 agent」哲学冲突（见 memory `project_image_insert_autonomous`）。

**Requirements outcome:** **22/22 全部交付**（code-level 验证 + 三宿主真机 UAT 全 PASS）。收官修正 REQUIREMENTS 溯源表 stale 记账：LIB-01/02/03（Phase 18 已交付，2026-06-03，code-review 无 HIGH）从 Pending → Complete（同 v2.0 7 项 / v2.1 UI-04·UI-06 的 GSD `phase.complete` stale-checkbox quirk）。

**Known limitation（非 bug）:** PPT 取选中图片 Preview API 未 GA（Office for Web）→ fallback 引导回形针上传；PPT `copy_slide` 网页版微软接口仍不支持（v2.1 已知，转桌面版）。

**Deferred / carry forward:**

- **LIB-D1** Unsplash 备选（若 Pexels 中文质量/限额不足再评估）· **VIS-D1** DeepSeek-V4 原生多模态验证（扩用户/降本时重评）
- **IMG-D1** 多变体并排生成（4 选 1）· **IMG-D2** 图片编辑/局部重绘 · **FILE-D1** pptx 高保真解析
- **v2.1 B 工具 defer 仍在 backlog**：EXCEL merge/remove_dup/pivot、WORD 高亮/列表/批注/edit_table/页眉页脚、PPT add_line/渐变填充/insert_table、WSEL 绝对字符偏移

**Known deferred items at close（artifact audit acknowledged，详见 STATE.md §Deferred Items）:** 23 项均为陈旧簿记或已被里程碑 UAT 覆盖，0 真正未完成——2 debug sessions（均 fix-applied + 已部署）+ 14 quick tasks（均完成有 commit，status 字段缺失的扫描器怪癖；新增唯一 260603-fx8 已交付）+ 1 todo（builtin-model-dropdown，已由 CARRY-02 v2.0 交付）+ 6 uat_gap 文件（04/07 属 v2.0、09/10 属 v2.1 已被里程碑 UAT 覆盖、19-UAT-PACKET 实测全 PASS 状态位未翻）。

---

## v2.1 从能用到好用 (Shipped: 2026-06-01)

**Delivered:** 在 v2.0「Office 智能代理」基座上，把 Aster 从「能用」推到「好用」——agent 更懂三宿主（per-host domain prompt + 用户偏好注入）、能改更多（Word 5 / Excel 10 / PPT 8 共 23 个 write tool 全补）、改得更快更准（批量操作 + Word 选区精度）、体验更顺（UI 打磨套件）、记得住历史（聊天记录持久化）。三宿主 Office for Web 真机端到端 UAT 全 PASS，已上线 GitHub Pages（线上 `2c0201e`，origin/main 同步，CI+Deploy 双 success）。

**Stats:**

- Phases: 6（8, 9, 10, 11, 12, 13）
- Plans: 27（8:5\* · 9:7 · 10:5 · 11:5 · 12:5；Phase 13 = UAT/Release 无独立 plan）
- Commits（v2.1 区间 `f9fdcc4..HEAD`）: 162（含 v2.0 收官 + v2.1 setup 数个 doc commit）
- Files changed: 171（+42.2K / −3.6K，含 .planning 文档）· src LOC: ~29.9K（ts/tsx，v2.0 ~20.7K → +~9K）
- Tests: 773 passed / 0 failed · Bundle: 75.03 KB gzip ≤ 82 KB CI gate · 0 净新增运行时依赖
- Timeline: 2026-05-30（milestone start）→ 2026-06-01（ship）
- Tag: `v2.1`（同 commit 补标 v2.0 @ `f9fdcc4`）

\*Phase 8 磁盘 4 个 SUMMARY；08-05（Settings 偏好 UI + Spike S6）交付折叠进偏好链路与配套 quick task，无独立 SUMMARY——偏好功能已真机 UAT 验证。

**Key accomplishments:**

1. **A 能力变聪明** — PPT/Excel/Word 三宿主各一套深化 domain system prompt（PPT 断言式标题 + ≤5 点/页 + verify-after-create；Excel 先 get_used_range_summary + 分块 + pipeline；Word 先取大纲保论点只改语言）；用户偏好注入（Settings 自定义 → 自动注入每轮 prompt），带 prompt-injection 防御（sanitizePrefs String.includes 防回溯 + 原始/sanitize 分离 + ≤500 字符 + 命中注入词静默过滤）（PROMPT-01, PREF-01/02）
2. **B-Word 精准写 + 选区精度** — 5 write tool（字符格式/段落格式/套样式 locale-safe/查替换快照 undo/插表格）+ WSEL-01 `selection_detail` 返 paragraphIndex + uniqueLocalId，多个相同文本时精确定位正确那一段（WORD-01~05, WSEL-01）
3. **B-Excel + B-PPT 工具全补** — Excel 10 工具（数字格式/列宽行高/排序/筛选/查替换/条件格式/建表/冻结/工作表/图表标题）+ PPT 8 工具（字体/对齐/形状增删/旋转/背景/幻灯片管理）；13 完整 inverse + noop+gate 分类 + 3 spike 门控降级；D-17 23/23 守门通过（EXCEL-01~10, PPT-01~08）
4. **C 批量操作** — `batch_write` 单 `Excel.run`/`Word.run` 闭包 + 单 `context.sync()` + fail-fast（第 i 步失败立即停报告）+ `batch_reverse` 逆序整批 undo + DiffLogPanel「批量改动 N 处」可展开卡；守门当场抓出双重逆序 bug 并修（BATCH-01/02）
5. **F 持久化 + E UI 打磨** — 聊天记录 localStorage 持久化（白名单字段 + 每条 ≤2000 字符 + QuotaExceeded 丢最旧）+ 一键清空 + 20 轮上下文截断（整 run 删防孤立 tool）+ docKey 分文档（pathname 防 token 泄露）；UI-01 safeUrlTransform XSS 防御 + UI-02 思考气泡 + UI-03 DiffLog 边界跟随 loop + UI-04 表格边框 + UI-05 读卡降权 + UI-06 骨架屏（HIST-01~04, UI-01~06）
6. **三宿主真机 UAT 全 PASS + 上线** — Excel/Word 全套 + PPT（选区/字体/对齐/背景/旋转/加形状/删除）+ 界面 + 偏好/持久化，Chrome × Edge 真机端到端验证；多轮 PPT 真机迭代修复 spike「假成功」+ snake/camel 键名 bug + 写后回读「假失败」误判；已部署 GitHub Pages，773 tests green / 0 净新增依赖 / 75.03 KB

**项目原则确立（v2.1）:** AI 生成质量 >> token 成本 & 包体积——NFR-07 由 `<3000 字符硬 CI gate` 降为软提醒、NFR-08 去掉 toolDefs ≤15KB token 门；undo 守门 / bundle gate / P95 仍硬卡（见 memory `project_quality_over_cost`）。

**Requirements outcome:** **42/42 全部交付**（code-level 验证 + 三宿主真机 UAT 全 PASS）。收官修正 REQUIREMENTS 溯源表 stale 记账：UI-04（表格边框，12-03 已交付）+ UI-06（骨架屏，12-02 `c2840dc` 已交付）从 Pending/未勾 → Complete。

**Known limitation（非 bug，→ v2.2/桌面版）:** PPT `copy_slide` 网页版 `Slide.copy()` 微软接口天生不支持 → 诚实失败（桌面版可用）。

**Deferred / 拆出:**

- **v2.2 多模态四件套**（MM-01..05）：视觉看图 / 文件上传解析 / 图片生成插入 / 公开图库检索 + AiHubMix model 修正——独立 milestone
- **B 工具 defer → v2.2**：EXCEL merge/remove_dup/pivot、WORD 高亮/列表/批注/edit_table/页眉页脚、PPT add_line/渐变填充/insert_table/add_image、WSEL 绝对字符偏移
- **技术债根治 → v2.2**：PPT 工具 snake/camel 不一致（已双键容错兜住，根治 = dispatch 层中央归一化）

**Known deferred items at close（artifact audit acknowledged，详见 STATE.md §Deferred Items）:** 20 项均为陈旧簿记或已被 Phase 13 里程碑 UAT 覆盖，0 真正未完成——2 debug sessions（均 fix-applied + 已部署）+ 12 quick tasks（均完成有 commit，status 字段缺失的扫描器怪癖）+ 5 uat_gap 文件（04/07 属 v2.0 已发布；09/10 partial 场景已被 Phase 13 里程碑 UAT 实测覆盖）+ 1 todo（builtin-model-dropdown，已由 CARRY-02 v2.0 交付）。

---

## v2.0 Office 智能代理 (Shipped: 2026-05-30)

**Delivered:** Aster 从「单步 AI 提效工具」重写为「Office 内嵌智能代理」——在当前打开的单个 Office 文档内由 LLM 自主多步执行任务，用户全程可观察 / 暂停 / 兜底回滚；v2.0 是 Aster 首次公开发布（线上 `f9fdcc4`，GitHub Pages，Chrome × 三宿主 sideload）。

**Stats:**

- Phases: 6（3, 4, 04.1, 5, 6, 7）
- Plans: 53 · Commits（v2 区间 `9bdaa06..HEAD`）: 295（115 feat/fix/refactor）
- Files changed: 303（+58.4K / −2.7K）· src LOC: ~20.7K（ts/tsx）
- Bundle: 73.42 KB gzip ≪ 1MB（CI gate ≤82 KB）· 0 净新增运行时依赖
- Timeline: 2026-05-28（vision pivot）→ 2026-05-30（ship）
- Tag: `v2.0`

**Key accomplishments:**

1. **Multi-step agent loop 地基** — 手写 `src/agent/loop.ts`（≤80 行 while runner + Zustand + AbortController，不引 XState）+ max_steps=20 fail-safe + 软着陆；统一 `AbortReason = 'visibility'|'user'|'max_steps'|'circuit'` 入口（AGENT-01/02/13）
2. **Context-aware read tools 全套** — 三宿主 `adapter.read()` + 11 个离散 read tool + prompt-injection 包装 `{result_type, content, source}` + 50K token / 10K cell size cap + TOOL-07 eslint rule 禁 Office.js proxy 出闭包（TOOL-01/02/05/06/07）
3. **Diff Log + Undo All 跨三宿主** — `OperationLog` + 自写 inverse op（禁用 Office native undo）+ DiffLogPanel humanLabel 汇总卡 + per-step/undo-all + before-image 手改防御 + sessionStorage F5 兜底（AGENT-07/09/10/11, TOOL-03/04）
4. **多宿主 write tools + 差异化护城河** — PPT/Excel/Word write tools 全套，含 `set_shape_property`/`move_shape`（Copilot Agent Mode 不暴露的 shape 精细化能力）；TS 强制 reverse + humanLabel 缺失编译失败（AGENT-08）
5. **错误恢复协议** — 结构化 `{code, message, recoverable, hint}` + `sanitizeFromAsterError` 唯一脱敏边界（不读 stack/路径/Key）+ (tool×code) sliding-window circuit breaker + 「Agent gave up」红卡（ERR-01/02/03/04）
6. **4 killer scenario as agent flows + teal 克制设计 + 首发** — PPT topic→deck / Excel 清洗+图+洞察 / Word 整篇润色 / PPT shape 精细化，Chrome × 三宿主真机端到端 UAT 全 PASS；Phase 04.1 完成 teal 克制设计系统迁移（无渐变/无 backdrop-filter）；README 重写为代理定位 + sideload 发布

**Requirements outcome:** 31 项中 **30 项交付**（code-level 验证 + 三宿主真机 UAT 全 PASS）。

**Descoped (→ v2.1):**

- **ONB-01** Onboarding GIF/动画 — Phase 6 决策 D-18/D-19 把 Onboarding 收成单步、删 `Step2Guide.tsx`，GIF 承载位移除；心智锚定由 empty-state killer-scenario chips（ONB-03）+ 全程中文 humanLabel step 摘要（ONB-02）承担。FUT-13。**→ 2026-05-30 Cancelled：不进任何后续 milestone（用户决定不做），不补回。**
- **FUT-16 图片生成插入（`insert_image_on_slide`）** — v2.0 TOOL-03 名义含此项，Phase 6 Out-of-scope 列为 stretch **未实现**；aihubmix 生图客户端（`aihubmix-image.ts`）在基座但未接 agent。TOOL-03 其余 13 write tool 全部交付。
- **FUT-14 视觉 / 看图（multimodal vision）** & **FUT-15 文件上传与解析** — 收官时发现这两块在 v2.0 既无需求也不在原 FUT 列表（视觉：`aihubmix-vision.ts` 客户端在基座但未接 agent；文件上传：仅禁用态回形针图标）。收官补记为 v2.1 候选（见 PROJECT.md Active），避免归档时丢失。

**Known deferred items at close（artifact audit acknowledged，详见 STATE.md §Deferred Items）:** 12 项均为陈旧簿记，0 真正未完成——2 debug sessions（Phase 4 PPT host-fail / reasoning-content roundtrip，均 fix-applied + 已部署）+ 6 quick tasks（均完成有 commit，状态字段缺失）+ 3 uat_gap 文件（04/07，`open_scenario_count: 0`，UAT 实际全 PASS）+ 1 todo（builtin-model-dropdown，已由 CARRY-02 交付）。

> **过程修订记录：** REQUIREMENTS.md traceability 表中 7 项需求（AGENT-02/08/13, ERR-01/02, CARRY-01, NFR-02）虽标 Pending 实为已交付（GSD `phase.complete` 复发的 stale-checkbox quirk，见记忆 `project_gsd_tooling_quirks`）；收官时已逐项 code-level 核验修正为 Complete。

---
