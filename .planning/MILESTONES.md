# Milestones

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
- **ONB-01** Onboarding GIF/动画 — Phase 6 决策 D-18/D-19 把 Onboarding 收成单步、删 `Step2Guide.tsx`，GIF 承载位移除；心智锚定暂由 empty-state killer-scenario chips（ONB-03）+ 全程中文 humanLabel step 摘要（ONB-02）承担。FUT-13。

**Known deferred items at close（artifact audit acknowledged，详见 STATE.md §Deferred Items）:** 12 项均为陈旧簿记，0 真正未完成——2 debug sessions（Phase 4 PPT host-fail / reasoning-content roundtrip，均 fix-applied + 已部署）+ 6 quick tasks（均完成有 commit，状态字段缺失）+ 3 uat_gap 文件（04/07，`open_scenario_count: 0`，UAT 实际全 PASS）+ 1 todo（builtin-model-dropdown，已由 CARRY-02 交付）。

> **过程修订记录：** REQUIREMENTS.md traceability 表中 7 项需求（AGENT-02/08/13, ERR-01/02, CARRY-01, NFR-02）虽标 Pending 实为已交付（GSD `phase.complete` 复发的 stale-checkbox quirk，见记忆 `project_gsd_tooling_quirks`）；收官时已逐项 code-level 核验修正为 Complete。

---
