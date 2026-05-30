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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0（基座，未单独发布） | — | 0–2.1 | spike-gating → foundation → Provider 抽象；Fluent UI → 自写 CSS（美观自主权反转） |
| v2.0 | 295 (v2 区间) | 3–7 | 单步提效工具 → multi-step agent；plan-then-execute → LLM 自决 tool loop；Phase 04.1 插入 teal 设计迁移 |

### Cumulative Quality

| Milestone | Test files | Bundle (gzip) | Zero-Dep Additions |
|-----------|-----------|---------------|-------------------|
| v1.0 | — | ~63–68 KB | baseline |
| v2.0 | 49 | 73.42 KB | 0 净新增运行时依赖 |

### Top Lessons (Verified Across Milestones)

1. **真机 UAT 抓的 bug 单测抓不到** — v1.0 Phase 2.1 gap closure 和 v2.0 三个 phase 反复验证
2. **美观/简洁自主权优先于框架默认** — Fluent UI 弃用 + teal 克制 + ONB/cost/隐私主动 descope，都是「克制 > 堆功能」
3. **GSD 工具链收尾簿记不可信，必须手工核对** — 跨 v1.0 / v2.0 两次 milestone close 均出现 stale-checkbox / STATE frontmatter 错误
