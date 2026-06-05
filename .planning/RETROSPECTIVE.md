# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.0 — Office 智能代理

**Shipped:** 2026-05-30
**Phases:** 6（3, 4, 04.1, 5, 6, 7） | **Plans:** 53 | **Commits (v2 区间):** 295

### What Was Built
- **Multi-step agent loop** — 手写 `src/agent/loop.ts`（≤80 行 while + Zustand + AbortController，0 框架）+ max_steps=20 fail-safe + 软着陆 + 统一 4 路 abort 入口
- **Context-aware read tools 全套** — 三宿主 `adapter.read()` + 11 read tool + prompt-injection 包装 + size cap + TOOL-07 eslint「纯数据进出」守门
- **Diff Log + Undo All 跨三宿主** — `OperationLog` + 自写 inverse op（禁 Office native undo）+ DiffLogPanel humanLabel + per-step/undo-all + before-image 手改防御 + sessionStorage F5 兜底
- **多宿主 write tools + 差异化护城河** — PPT/Excel/Word write tools 全套，含 `set_shape_property`/`move_shape`（Copilot 不暴露的 shape 精细化）；TS 强制 reverse + humanLabel
- **错误恢复协议** — 结构化 `{code,message,recoverable,hint}` + 单一 sanitize 边界 + (tool×code) sliding-window circuit breaker + 「Agent gave up」红卡
- **4 killer scenario as agent flows + teal 克制设计 + 首发** — 三宿主真机 UAT 全 PASS；Phase 04.1 teal 迁移；README 重写 + sideload 发布（线上 `f9fdcc4`）

### What Worked
- **Phase 5 undo 兜底先于 Phase 6 destructive write** — 硬约束排序让「第一次出错就有 undo」，trust 担保在铺开危险写操作前就位
- **Wave-based 并行 + 自主 team 执行** — 按 `files_modified` 真实依赖切波（同 wave 零文件重叠），多 plan 并行；Phase 7 团队串行编排跑通
- **Spike 内嵌 Phase 3 第一周（SP-1..SP-7）而非独立 phase** — SP-5（PPT slide.delete）提前跑，避免 Phase 5 架构 pivot
- **adapter「纯数据进 / 纯数据出」+ eslint rule** — 从结构上杜绝 Office.js proxy 跨 await 边界失效（A-06 CRITICAL pitfall）
- **TS/lint 强制 reverse + humanLabel** — 缺失即编译失败，把「undo 可行性」和「中文人话」变成不可绕过的注册前置条件

### What Was Inefficient
- **真机 UAT 反复抓出单测从未覆盖的 bug** — Phase 4 修 3 个、Phase 5 修 6 个 gap、Phase 7 修 2 个 bug，全部只在真机 Office 暴露（mock 永远绿）。单测覆盖 ≠ 真机正确
- **GSD 工具链复发坑吃掉收尾时间** — `phase.complete` / `milestone.complete` 反复（a）漏勾需求 checkbox（本次 7 项 stale）、（b）mangle STATE.md frontmatter（本次 `milestone:v1.0` + `percent:94` 全错）、（c）worktree 劫持 HEAD。每次收尾都要手工核对修正
- **`retry.test.ts` 长期 flaky** — 全量跑偶发 1 failed，单跑 9/9 PASS，是 Phase 02 起的测试隔离问题，跨多个 milestone 未根治
- **Word 位置签名错配致真机撤销全挂（Phase 5）** — inverse/read 方法用位置参而非 Record 对象，单测没守到，真机才炸

### Patterns Established
- **inverse op 自写、永不用 Office.js native undo** — PPT 无 `presentation.undo()` + undo stack 不透明 + 撞用户手动操作
- **before-image 比对 + 跳过冲突** — undo all 前先 `adapter.read()` 抓当前 state 与 diff log post-state 比对，手动改过的步跳过并标注
- **单一 sanitize 边界** — `sanitizeFromAsterError` 是唯一脱敏出口，allowlist 取字段，绝不读 `err.stack`/`toString`
- **adapter inverse 方法收 Record 对象（非位置参）** — replay 用 `adapter.method(args对象)` 调用；新 inverse 补 `operationLog.integration.test` 守门（记忆 `adapter_inverse_signature`）
- **descope 纪律** — cost meter / 隐私授权 UX（PRIV-01..05）/ ONB-01 GIF 都按「早期用户=作者+亲人」原则主动砍，max_steps=20 是唯一失控防御

### Key Lessons
1. **真机 UAT 是不可谈判的验收关卡** — 三个 phase 的关键 bug（reasoning_content 往返 400、PPT textFrame 类型、Word 撤销签名）都只在真机暴露；mock 单测给的是假安全感。每个写操作 phase 都要排真机 UAT checkpoint
2. **同一故障模式复发 ≥2 次就加结构性守门，不靠纪律** — GSD 工具链 stale-checkbox / STATE mangle 已复发多次，应在收尾流程加自动核对脚本（记忆 `recurring_failure_add_gate` + `project_gsd_tooling_quirks`）
3. **危险能力上线前先建兜底** — Phase 5 undo 先于 Phase 6 destructive write 的硬排序，是 v2「第一个 release 就是用户首见」前提下不流失用户的关键
4. **0 净新增运行时依赖可以扛住一个完整 agent milestone** — 手写 loop + 原生 fetch/SSE，bundle 从 ~63KB 长到 73.42 KB，全程 ≪ 1MB

### Cost Observations
- Model mix: 以 Opus（quality profile）为主导，wave 并行 + 自主 team 执行
- 测试规模: 49 test files / ~604 tests passing（Phase 7 收官门禁）
- Notable: 53 plans / 295 commits 在 ~2 天高强度执行内完成（2026-05-28 pivot → 05-30 ship）；vision pivot 选在 Phase 4 开工前转向 ≈ 零返工损失

---

## Milestone: v2.1 — 从能用到好用

**Shipped:** 2026-06-01
**Phases:** 6（8, 9, 10, 11, 12, 13） | **Plans:** 27 | **Commits (v2.1 区间):** 162 | **Tests:** 773 passed/0 failed | **Bundle:** 75.03 KB

### What Was Built
- **A 能力变聪明** — PPT/Excel/Word 三宿主深化 domain system prompt + 用户偏好注入（sanitizePrefs String.includes 防回溯 + 原始/sanitize 分离 + ≤500 字符 + 注入词静默过滤）
- **B 23 个 write tool** — Word 5（含查替换快照 undo）+ Excel 10 + PPT 8；13 完整 inverse + noop+gate 分类 + 3 spike 门控降级；NFR-08 参数化合并
- **D Word 选区精度** — WSEL-01 `selection_detail` 返 paragraphIndex + uniqueLocalId，多个相同文本精确定位
- **C 批量操作** — batch_write 单闭包单 sync + fail-fast + batch_reverse 逆序整批 undo + DiffLogPanel 可展开批量卡
- **F 持久化 + E UI 打磨** — 聊天记录 localStorage（20 轮截断 + 清空 + docKey 分文档）+ XSS 防御 + 思考气泡 + DiffLog 边界跟随 loop + 表格边框 + 读卡降权 + 骨架屏
- **三宿主真机 UAT 全 PASS + 上线** — Excel/Word/PPT + 界面 + 偏好/持久化，线上 `2c0201e`，tag `v2.1`（回补 `v2.0`）

### What Worked
- **工具合并设计合约先于编码** — Phase 8 先产 undo 三分类表 + 参数化合并 + token 预算，B/C 工具铺开时每个都有明确 undo 类型 + 守门要求，破坏性操作不裸奔
- **undo 守门测试当场抓 bug** — `operationLog.integration.test` 在 Phase 11 当场抓出 batch 双重逆序 bug（`eb218f2`）；守门把「逆向正确性」前移到执行期
- **「质量 >> 成本」原则解放了 prompt 深化** — NFR-07 硬 gate → 软提醒后，per-host domain prompt 可写足 6–10 行高价值指导，不再为凑 3000 字符上限做无谓裁剪
- **诚实失败胜过假成功** — PPT 写后回读验证把 3 个 spike 工具的网页版「假成功」拦成诚实失败；copy_slide 网页版不支持也据此诚实报错而非假装成功

### What Was Inefficient
- **PPT 网页版写操作真机反复迭代** — spike「假成功」（错属性名 + 只探测不验写生效）→ snake/camel 键名 bug（8 工具）→ 写后回读「假失败」误判，三轮真机才收敛；根因都是「网页版 Office.js 行为与类型/文档不符」，mock 永远绿
- **PPT 工具 snake/camel 不一致是设计债** — dispatch 不校验参数键名，LLM 跟随 snake_case 同族工具传参致 camelCase execute 拿 undefined 静默失败；本 milestone 只做双键容错兜底，根治（中央归一化）推 v2.2
- **REQUIREMENTS 溯源表 stale 记账复发** — UI-04/UI-06 实际交付但溯源表标 Pending/未勾（同 v2.0 的 7 项 stale-checkbox quirk），收尾仍需手工核对修正
- **Phase 8 08-05 无独立 SUMMARY** — Settings 偏好 UI 交付折叠进偏好链路 + quick task，磁盘只 4/5 个 summary（roadmap.analyze 仍判 complete，但簿记不齐）

### Patterns Established
- **每个新 write tool 先声明 undo 类型（简单逆向/快照式/noop+gate）+ 配 integration.test 守门** — undo 可行性是注册前置条件，不可绕过
- **PPT 网页版写操作必须写后回读验证** — 对齐用 `horizontalAlignment`（非 `.alignment`）、背景用 `setSolidFill`（非 `setSolidColor`）；没生效诚实报「网页版未生效」不假成功（记忆 `project_ppt_officejs_gotchas`）
- **prompt 注入防御用 String.includes 非正则** — 避免灾难性回溯（OWASP LLM01）；存原始文本 + sanitize 后分离，注入点只拿 sanitized 值
- **docKey 只 hash pathname** — 防 SharePoint session token 写进 localStorage key
- **项目原则「AI 生成质量 >> token 成本 & 包体积」** — NFR 软化，但 undo 守门 / bundle gate / P95 仍硬卡（记忆 `project_quality_over_cost`）

### Key Lessons
1. **网页版 Office.js 的「能读 ≠ 能写生效」必须写后回读验证** — PPT spike 工具「假成功」证明：探测 API 可读不等于写操作真生效；唯一可靠验收是写后回读比对，没生效就诚实失败
2. **参数键名 casing 不一致是静默失败温床** — dispatch 不校验键名时，snake/camel 错配让 execute 静默拿 undefined；要么统一 casing，要么 dispatch 层中央归一化，双键容错只是止血
3. **GSD 收尾簿记 stale 已是跨 3 个 milestone 的确定模式** — stale-checkbox / 缺 SUMMARY / frontmatter mangle 每次都来，应在收尾流程加自动核对（记忆 `recurring_failure_add_gate`），本次又靠手工核对兜住
4. **「质量优先」原则一旦明确，能反向解放被成本约束压制的质量动作** — prompt 深化、工具合并都因 NFR 软化而做得更彻底

### Cost Observations
- Model mix: 以 Opus（quality profile）为主导，wave 并行执行
- 测试规模: 773 passed / 0 failed（v2.0 收官 ~604 → v2.1 +~169）
- Notable: 27 plans 在 ~2 天内完成（2026-05-30 start → 06-01 ship）；深化打磨型 milestone（无架构 pivot），返工集中在 PPT 网页版真机三轮迭代

---

## Milestone: v2.2 — 多模态四件套

**Shipped:** 2026-06-03
**Phases:** 6（14, 15, 16, 17, 18, 19） | **Plans:** 25 | **Commits (v2.1..v2.2 区间):** 130 | **Tests:** 885 passed/0 failed（收官 fx8 后 892） | **Bundle:** 80.53 KB

### What Was Built
- **MDL AiHubMix Provider 三路重写** — `aihubmix-image.ts` 三生图模型三套 wire format（doubao URL→fetch / gpt-image-2 b64_json / gemini inlineData）+ 两套鉴权（Bearer / x-goog-api-key）统一裸 base64；视觉/生图 model 清单修正；**PPT casing 中央归一化根治**（dispatch 层 normalizeToSnakeCase，清 v2.1 技术债）
- **VIS 视觉看图** — `get_shape_image` 第 12 read tool（三宿主取选中图）+ 回形针/Ctrl+V 上传图（attachments 内存 store，FILE-06 前移）→ 都走 aihubmix-vision 返文本 evidence；base64 不进 history（NFR-09 serialize 守门）
- **IMG 图片生成插入** — generate_ppt/word_image write tool，**AI loop 内自动直插**（设计反转）+ 返回 shape_id 让 AI 自主排版 + 只读结果卡 + model 三级优先级；PPT GA addImageShape 独立 run 回读规避 #5022，Word body 级规避 #3434
- **FILE 文件上传解析** — docx/xlsx/pdf/pptx 四解析库全懒加载（mammoth/SheetJS/pdfjs/jszip）→ 文本注入 augmented prompt；附件（只读快照）vs agent 自取文档（live 可写回）UX 边界；0 净新增初始 bundle（NFR-10）
- **LIB Pexels 图库检索** — Settings BYO key（locale=zh-CN）→ 缩略图网格 → 选中插入（复用 IMG insert helper）+ 摄影师署名链接（不叠水印）
- **三宿主真机 UAT 全 PASS + 上线** — 四件套 Chrome × Edge 真机端到端；两高危均解（pdf.js worker CSP + Pexels 双重 CORS）；线上 `0d5fccf`，tag `v2.2`

### What Worked
- **Provider 重写靠 spike 011 提前实测三路 wire format** — 三生图模型三套 response + 两套鉴权的差异在编码前已存档（`.planning/spikes/011`），Phase 14 按图施工，无试错往返
- **设计反转敢在真机 UAT 后推翻既定合约** — IMG「预览后确认 → AI 自动直插」是用户真机体验后拍板；保留确认卡会打断 AI 自主排版 loop，与产品愿景冲突，反转零包袱（D-01/02/03 作废）
- **fallback 引导上传兜住 PPT 取图宿主限制** — PPT Preview API 未 GA 是硬限制，VIS 不假装支持，诚实降级到回形针上传，能力不缺口
- **Team Lead 模式（TeamCreate）自主推进收口** — Phase 16→17→18→收尾由每个 GSD step 一个 fresh teammate 串行编排跑通，主上下文不爆
- **0 净新增运行时依赖扛住「引入 4 个解析库 + 图库」的 milestone** — 全懒加载 + native fetch，初始 bundle 仅从 75.03 → 80.53 KB（+5.5KB），≤82KB CI gate 守住（余量 1.47KB）

### What Was Inefficient
- **浏览器直连生图两坑只在真机暴露** — doubao 签名 URL 被 CORS 拦死（改 b64_json 内联）+ dispatchTool 15s 超时误杀 21s 慢生图（timeoutMs 120s），都是 mock 永远绿、真机才炸（同 v2.0/v2.1 的「真机 ≠ 单测」模式第 N 次复现）
- **bundle 余量收紧到 1.47KB** — 四件套 + 4 解析库接线把初始包推到 80.53/82 KB，下个 milestone 再加非懒加载代码前必须先 build 再 size（memory `project_bundle_size_guard`：陈旧 dist 给假绿）
- **LIB stale-checkbox 又复发** — Phase 18 已交付但 REQUIREMENTS 溯源表 LIB-01/02/03 残留 Pending，同 v2.0 7 项 / v2.1 UI-04·UI-06，第三次 milestone close 手工核对修正（GSD `phase.complete` quirk 仍未加自动守门）
- **各 plan SUMMARY 一行摘要格式不统一** — `summary-extract --pick one_liner` 多数 phase 取不到，收官 accomplishments 靠 PROJECT.md/ROADMAP 详情段反推（簿记不齐，非阻塞）

### Patterns Established
- **生图返回裸 base64 `{ base64, mimeType }`，不拼 data URL 前缀** — 真机实测 Office.js fill.setImage / insertInlinePictureFromBase64 接受裸 base64（推翻 RESEARCH A5 的 data URL 假设分支）
- **浏览器直连生图：要 b64_json 内联、慢生图工具单独 timeoutMs** — 签名 URL 被 CORS 拦（要内联）+ 默认 15s 超时杀慢生图（生图工具用 120s）（memory `project_browser_image_gen_gotchas`）
- **base64 永不进 persisted 历史（NFR-09）+ serialize 守门** — localStorage 配额防护 + LLM 重放死循环防护，加 serialize-test 结构性守门
- **重模块全懒加载维持初始 bundle 0 增量** — mammoth/SheetJS/pdfjs/jszip 动态 import，解析库不进主路径（NFR-10 延续 §CLAUDE.md bundle 约束）
- **pdf.js worker 用 public/ 静态资产 + base 路径，不靠 new URL** — Vite 7 + pdfjs 的 `new URL` 方案未 emit worker；改 `public/pdf.worker.min.mjs` + `/Aster/` 静态路径（GitHub Pages CSP 真机 PASS）
- **executeBatch 按 op.tool 分派、range 走 resolveRange 解析 sheet-qualified 地址** — batch 子操作不能硬编码 set_range_values 参数形状；worksheet 级 getRange 拒收「表名!A1」前缀需 helper 路由 getItem（memory `project_excel_adapter_gotchas`）

### Key Lessons
1. **浏览器直连第三方 API 的 CORS / 超时坑是无后台架构的固定税** — 生图签名 URL CORS、Pexels 双重 CORS、慢生图超时，每个外部 Provider 接入都要在真机 iframe 里实测 CORS + 调超时；无后台省了服务器，但把 CORS 风险全压到浏览器侧（memory `project_no_backend_status`）
2. **真机 UAT 后敢推翻设计合约是产品敏感度，不是返工** — IMG 自动直插反转证明：UX 合约（D-01/02/03）在真机体验前都是假设；与核心愿景（AI 自动化、信任 agent）冲突的合约，越早在真机后推翻越省
3. **GSD stale-checkbox 已是跨 4 个 milestone 的铁律，仍靠手工兜** — v1.0/v2.0/v2.1/v2.2 close 全部出现 LIB/UI/AGENT 类需求溯源表 stale，第四次仍未加自动核对守门（memory `recurring_failure_add_gate`）——「同一故障 ≥2 次加结构性守门」原则在此项上至今未兑现，是确定的待还债
4. **bundle 余量进入个位数 KB，预算管理从「宽松」转「紧」** — 73.42（v2.0）→ 75.03（v2.1）→ 80.53（v2.2）/82 KB，下个 milestone 任何非懒加载新代码都要先量；懒加载是唯一能继续加重模块的路（memory `project_bundle_size_guard`）

### Cost Observations
- Model mix: 以 Opus（quality profile）为主导；Team Lead 模式（TeamCreate）每 GSD step 一个 fresh teammate 串行编排
- 测试规模: 885 passed / 0 failed（v2.1 收官 773 → v2.2 +112；收官 fx8 后 892）
- Notable: 25 plans / 130 commits 在 ~2 天内完成（2026-06-01 start → 06-03 ship）；多模态接线型 milestone，返工集中在浏览器直连生图两坑（CORS + 超时）真机迭代

---

## Milestone: v2.3 — 精装与定力

**Shipped:** 2026-06-05
**Phases:** 5（20, 21, 22, 23, 24） | **Plans:** 10 | **Commits (v2.2..v2.3 区间):** 98 | **Tests:** 1075 passed/0 failed | **Bundle:** 81.3 KB

### What Was Built
- **B 时钟脱前缀（CTX-01/02）** — 实时时钟从 `buildSystemPrompt` 前缀迁到 wire 末尾 user message（`buildTimeContext()`），system 前缀变完全静态可缓存；`not.toMatch(/\d{1,2}:\d{2}/)` 三宿主结构性守门防回退
- **B token 水位摘要压缩 + 抗幻觉（CTX-03/04/05/06）** — `compaction.ts` 按 token 高/低水位（120K/40K）折最老段为 `role:'system'` 摘要 → `[system][摘要]` 稳定缓存前缀（不 mutate chatStore）+ version:2 持久化 F5 可恢复 + `applyHistoryBackstop` 兜底；三宿主抗幻觉「旧读数早已过时」独立项
- **A P0 设计 token + 几何自查（PVQ-01/02）** — `ppt-tokens.ts` 结构 token（配色不锁死，无 palette 数组）+ `geometry-check.ts` 纯 TS 确定性溢出/重叠/越界/对比四项（WCAG 是配色不锁死后唯一颜色护栏）+ `check_slide_layout` read 工具
- **A P1 盖印章工具 + 6 版式库 + prompt 重写（PVQ-03/04/05）** — `apply_slide_layout` (B)create+fill（reverse=删整页复用 `delete_slide_by_index`）+ `ppt-layouts.ts` 6 套固化 960×540 坐标版式（dogfood 6/6 零 overlap）+ PPT prompt 删机械摆坐标/宪法式自查冗余
- **A P2 自渲染预览 + vision 自查闭环（PVQ-06/NFR-11）** — `SlidePreviewPanel`（React.lazy）按 960×540 等比重建 + `html2canvas`（1.4.1 仅动态 import）截图 → aihubmix-vision 自查 4 项 → 文字 evidence（NFR-09 base64 不进 ToolResult）
- **统一 UAT 全过 + 上线** — 三宿主真机 UAT 全过（11 个真机 bug 全修）；PVQ-06 spike-gate 真机判**铺开**；线上 `1fe9529`，tag `v2.3`

### What Worked
- **plan-review 阶段把 compaction 4 个隐蔽 bug 提前堵住** — abort 时半截摘要绝不提交（`!newSummary||signal.aborted` 早退）/ 跨轮缓存前缀字节稳定守门 / 摘要超上限 no-commit 防膨胀螺旋 / estimateTokens DRY；都是「会在长对话真机才炸」的坑，在 plan-check 就守住
- **几何自查 dogfood + 编译期穷举守门** — 6 套版式跑 `checkSlideLayout` 自测 6/6 零 overlap/oob；`satisfies` 编译期穷举合法 `GeometricShapeType` 集，关 UAT-1 暴露的 mock-vs-real gap（mock 接受非法枚举、真机拒绝）
- **配色不锁死把审美自由交给 AI、用单一确定性护栏兜底** — 推翻固定调色板后，几何自查 WCAG 对比度成唯一颜色护栏；接受「兜不了整体不协调」换「AI 按客户意图自由配色」的最大自由（用户已知接受）
- **spike-gate 诚实安排到 milestone 末人眼 UAT** — 自渲染预览 vs PowerPoint 保真度结构上无法自动化 → 不假装自动化，建好对比采集包、攒到最后由用户人眼拍板「铺开」，双路径（铺开/降级 flag）都先落地
- **discuss harvest + Team Lead 模式** — 5 phase discuss 决策批量挖完再跟用户澄清（2 个真决策：压缩积极度 / PPT 成品调性）；UAT 修复也由 fresh teammate 串行编排

### What Was Inefficient
- **PPT 网页版「新建即回读」竞态真机三轮才根治** — UAT-8 拆双 sync 无效 → UAT-9 改「reload 集合 + set-diff / 取末 N 个」范式才真修；apply_slide_layout/add_shape/insertImage 共因，又是 mock 永远绿、真机才炸（「真机 ≠ 单测」模式第 N 次）
- **预览面板挂载链路 bug 藏得深（UAT-10/11）** — ③ 端到端跑不通根因是流式 assistant 消息 finalize 漏写 `toolCalls`→store→ChatStream 取不到 layoutArgs→面板从不挂载；加 timeoutMs + 轮询等待（UAT-10）后才暴露真根因（UAT-11）
- **24-01 executor 误降级 jsdom@29→25 破 11 个 parser 测试** — Node 版本陷阱（本机默认 node 20.17 太旧、jsdom@29 要求 ≥20.19），executor 选择降级 jsdom 而非升 Node，破 FILE-02~05；orchestrator revert 回 ^29.1.1 并固化「测试/构建必须 Node 22」
- **第 5 次 stale-checkbox（本次 11 项，历次最多）+ stale-bookkeeping** — CTX-01~06 + PVQ-01~05 实已交付但 REQUIREMENTS `[ ]`/Pending；外加 720 文字、Phase 22 进度行 stale；收尾仍全靠手工核对（GSD `phase.complete` quirk 第 5 次未加自动守门）

### Patterns Established
- **PPT 网页版新形状定位用「reload 集合 + set-diff / 取末 N 个」，不靠 `GetItem(id)` 即时回读** — 同 sync 内建形状即回读 id 触发网页版竞态，拆 sync 都不够；重载形状集合后取差集定位才稳（memory `project_ppt_officejs_gotchas`）
- **token 水位摘要压缩（非按轮数）+ `[system][摘要]` 稳定缓存前缀** — 缓存铁律「每轮变的内容放末尾」；高/低水位批量压一刀（非每轮丢最老的滑动窗口，那样前缀全 miss）；摘要作 system 角色固定消息成新稳定前缀；复用已配置 model 不硬编 flash；绝不 mutate chatStore（UI 历史完整）
- **盖印章 write 工具 (B) create+fill：reverse = 删整页复用既有 inverse，零新增** — 建新页 + 填整页原生形状，撤销=删整页（`delete_slide_by_index` index+ID 双定位），原子无孤儿、新页天然无既有内容满足「绝不毁既有内容」硬合约
- **审美护栏可以下沉到确定性代码（WCAG 对比度）** — 配色不锁死后不靠 LLM 自律也不锁调色板，用纯 TS WCAG 算实际所选色对比度作唯一颜色护栏；bg 读不到诚实降级非假阳性
- **测试/构建必须 Node 22，绝不为兼容降级关键依赖** — jsdom@29 要求 Node ≥20.19，降 jsdom@25 会破 parser 测试（File 无 arrayBuffer）；正解是升 Node 而非降依赖（memory：STATE Phase 24 决策）

### Key Lessons
1. **PPT 网页版「新建即回读」是平台级竞态，拆 sync 治标、换定位范式才治本** — UAT-8→9 两轮证明：同 sync 建形状后即 `GetItem(id)` 在 Office for Web 必踩竞态；可靠解是「reload 集合 + 取差集/末 N 个」，这是所有「建形状后要拿 id」工具的共因，应作为 PPT 写工具的默认范式
2. **结构上无法自动化的判定，要诚实安排人眼验收，不假装自动化** — spike-gate（自渲染预览保真度）从设计就标 LOCKED-1 人眼判定，安排到 milestone 末统一 UAT、双路径先落地，是「诚实边界」原则在验收流程的体现
3. **「质量 >> 约束」原则延伸到审美维度 = 选 AI 自由 + 单一确定性护栏** — 配色不锁死推翻固定调色板，接受「兜不了整体不协调」换最大配色自由，只用 WCAG 对比度兜「不可读」底线；与 v2.1「质量>>成本」一脉相承
4. **GSD stale-checkbox 已第 5 次复发、本次 11 项创新高，结构性还债严重逾期** — v1.0/v2.0(7)/v2.1(2)/v2.2(3)/v2.3(11) 跨五次 milestone，`phase.complete` 从不翻 traceability checkbox；候选守门（close 前自动核对 quick task status + 翻 checkbox 脚本）至今未建，每次收尾纯手工兜（memory `recurring_failure_add_gate`）

### Cost Observations
- Model mix: 以 Opus（quality profile）为主导；discuss harvest（并行 discuss teammate 挖决策）+ Team Lead 模式（每 GSD step / 每个 UAT 修复一个 fresh teammate）
- 测试规模: 1075 passed / 0 failed（v2.2 收官 892 → v2.3 +183，含 11 个 UAT 回归用例）
- Notable: 10 plans 实现 + 11 个真机 UAT 修复，98 commits 在 ~2 天内完成（2026-06-03 start → 06-05 ship）；返工集中在 PPT 网页版新形状 race 三轮 + 预览面板挂载链路深层 bug

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0（基座，未单独发布） | — | 0–2.1 | spike-gating → foundation → Provider 抽象；Fluent UI → 自写 CSS（美观自主权反转） |
| v2.0 | 295 (v2 区间) | 3–7 | 单步提效工具 → multi-step agent；plan-then-execute → LLM 自决 tool loop；Phase 04.1 插入 teal 设计迁移 |
| v2.1 | 162 (v2.1 区间) | 8–13 | 深化 + 打磨（无架构 pivot）；23 write tool + undo 三分类合约；「质量 >> 成本」原则确立（NFR-07/08 软化）；引入 git tag（回补 v2.0） |
| v2.2 | 130 (v2.1..v2.2 区间) | 14–19 | 多模态接线（看/读文件/生图/找图）；外部 Provider 直连 CORS/超时成为固定税；Team Lead 模式（TeamCreate）自主收口；IMG 真机后推翻「预览确认」合约改 AI 自动直插 |
| v2.3 | 98 (v2.2..v2.3 区间) | 20–24 | 纵深提质（A PPT 视觉质量 + B 上下文/抗幻觉）；配色不锁死（推翻固定调色板，WCAG 对比度作唯一护栏）；盖印章 (B)create+fill 工具；token 水位摘要压缩 + 稳定缓存前缀；spike-gate 诚实安排人眼 UAT；PPT 网页版新形状 race 换 reload+diff 范式根治 |

### Cumulative Quality

| Milestone | Test count | Bundle (gzip) | Zero-Dep Additions |
|-----------|-----------|---------------|-------------------|
| v1.0 | — | ~63–68 KB | baseline |
| v2.0 | ~604 | 73.42 KB | 0 净新增运行时依赖 |
| v2.1 | 773 | 75.03 KB | 0 净新增运行时依赖 |
| v2.2 | 885（fx8 后 892） | 80.53 KB（≤82KB，余量 1.47KB） | 0 净新增运行时依赖（4 解析库全懒加载） |
| v2.3 | 1075 | 81.3 KB（≤82KB，余量 ~0.7KB） | 0 净新增运行时依赖（html2canvas 仅动态 import） |

### Top Lessons (Verified Across Milestones)

1. **真机 UAT 抓的 bug 单测抓不到** — v1.0 Phase 2.1 gap closure、v2.0 三个 phase、v2.1 PPT 网页版三轮迭代、v2.2 浏览器直连生图 CORS/超时两坑、v2.3 PPT 网页版新形状 race 三轮 + 预览面板挂载链路（11 个真机 bug）反复验证；网页版 Office.js「能读 ≠ 能写生效」「新建即回读必踩竞态」+ 浏览器直连 API 的 CORS 都只在真机暴露
2. **美观/简洁自主权优先于框架默认** — Fluent UI 弃用 + teal 克制 + ONB/cost/隐私主动 descope；v2.1 确立「AI 生成质量 >> token 成本 & 包体积」；v2.2 IMG 真机后推翻「预览确认」合约；v2.3「质量>>约束」延伸到审美维度——配色不锁死，AI 自由配色 + WCAG 单一护栏（产品敏感度优先于既定 plan/模板）
3. **GSD 工具链收尾簿记不可信，必须手工核对** — 跨 v1.0 / v2.0(7) / v2.1(2) / v2.2(3) / **v2.3(11，创新高)** 五次 milestone close 均出现 stale-checkbox / 缺 SUMMARY / STATE frontmatter 错误，已是铁律；「同一故障 ≥2 次加结构性守门」原则在此项上**第 5 次仍未兑现**，是确定且严重逾期的待还债（候选守门：close 前自动核对 quick task status + 翻 traceability checkbox 脚本）
4. **无后台架构把 CORS/超时风险全压浏览器侧（v2.2 新增）** — 外部 Provider 直连（生图签名 URL、Pexels 双重 CORS、慢生图超时）每个接入都要真机 iframe 实测 CORS + 调超时；省了服务器，代价是每个第三方 API 的浏览器侧适配税
5. **bundle 预算从宽松转紧（v2.2 起）** — 73.42 → 75.03 → 80.53 → **81.3** / 82 KB，余量从个位数 KB 收到 ~0.7KB；懒加载是唯一能继续加重模块的路（v2.3 html2canvas 仅动态 import），非懒加载新代码必须先 build 再 size（防陈旧 dist 假绿）
6. **结构上无法自动化的判定要诚实安排人眼验收（v2.3 新增）** — spike-gate（自渲染预览保真度）从设计标 LOCKED-1 人眼判定，安排到 milestone 末统一 UAT、铺开/降级双路径先落地，不假装自动化；「诚实边界」原则在验收流程的体现
