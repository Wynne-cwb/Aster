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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0（基座，未单独发布） | — | 0–2.1 | spike-gating → foundation → Provider 抽象；Fluent UI → 自写 CSS（美观自主权反转） |
| v2.0 | 295 (v2 区间) | 3–7 | 单步提效工具 → multi-step agent；plan-then-execute → LLM 自决 tool loop；Phase 04.1 插入 teal 设计迁移 |
| v2.1 | 162 (v2.1 区间) | 8–13 | 深化 + 打磨（无架构 pivot）；23 write tool + undo 三分类合约；「质量 >> 成本」原则确立（NFR-07/08 软化）；引入 git tag（回补 v2.0） |

### Cumulative Quality

| Milestone | Test count | Bundle (gzip) | Zero-Dep Additions |
|-----------|-----------|---------------|-------------------|
| v1.0 | — | ~63–68 KB | baseline |
| v2.0 | ~604 | 73.42 KB | 0 净新增运行时依赖 |
| v2.1 | 773 | 75.03 KB | 0 净新增运行时依赖 |

### Top Lessons (Verified Across Milestones)

1. **真机 UAT 抓的 bug 单测抓不到** — v1.0 Phase 2.1 gap closure、v2.0 三个 phase、v2.1 PPT 网页版三轮迭代反复验证；网页版 Office.js「能读 ≠ 能写生效」需写后回读
2. **美观/简洁自主权优先于框架默认** — Fluent UI 弃用 + teal 克制 + ONB/cost/隐私主动 descope；v2.1 进一步确立「AI 生成质量 >> token 成本 & 包体积」
3. **GSD 工具链收尾簿记不可信，必须手工核对** — 跨 v1.0 / v2.0 / v2.1 三次 milestone close 均出现 stale-checkbox / 缺 SUMMARY / STATE frontmatter 错误，已是确定模式，应加自动核对守门
