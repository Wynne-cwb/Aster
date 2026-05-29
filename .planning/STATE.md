---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: 已交付的基座（不重复列）
status: executing
stopped_at: Phase 5 UI-SPEC approved
last_updated: "2026-05-29T17:54:54.953Z"
last_activity: 2026-05-29
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 35
  completed_plans: 33
  percent: 94
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-28 — milestone v2.0 started)

**Core value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 **AI 代理** 能力，能完成绝大部分文档工作；无后台、BYO Key。
**Current focus:** Phase 05 — Diff Log + Undo All 跨 3 宿主

## Current Position

Phase: 05 (Diff Log + Undo All 跨 3 宿主) — EXECUTING
Plan: 8 of 10
Plans: 0 of 0 (未规划)
Status: Ready to execute
Last activity: 2026-05-29

Phase 04.1 完成结果（2026-05-29）:

  - teal 克制设计系统迁移落地：token 层（--accent #009887 light / #4FC9B8 dark）、无渐变、backdrop-filter = 0、ContextCard 退役、selpill 整合进 InputBar、组件全量重皮
  - D-08 三宿主真机 UAT（PPT/Excel/Word light + dark 抽查）：✅ 用户逐项确认 PASS
  - D-07 文档收尾：CLAUDE.md §UI 改 teal 克制、01-UI-SPEC.md 标 SUPERSEDED、3 个记忆文件同步、UAT skill 更新、aster-design-system project skill 固化（供 Phase 5/6 消费）
  - 验证：gsd-verifier 对抗式核验 11/11 must-have 真相组通过（status: passed）
  - 门禁：build OK；size-limit 80.54 KB ≤ 82 KB；test 460 passed / 1 failed（retry.test.ts 预存在 flaky，单跑 9/9，非 04.1 回归）
  - code review：1 BLOCKER（CR-01 ChatStream CIRCUIT_OPEN retry `undefined as never`）实为 phase 04（7ca7c9a）预存在 bug，非 04.1 引入 → 建议后续 /gsd-code-review-fix
  详见 .planning/phases/04.1-aster-redesign-migration-ui-teal/04.1-VERIFICATION.md + 04.1-REVIEW.md + 04.1-07-SUMMARY.md

Progress:
  [█████████░] 94%
  v2.0 (本 milestone): next = Phase 5（Diff Log + Undo All），其后 Phase 6 → 7

## v2.0 Phase List

| Phase | Goal | Requirements | UI hint |
|-------|------|--------------|---------|
| **3** Agent Loop 地基 + Privacy 授权 + Word demo | 50 行 while runner + max_steps=20 + pre-call cost gate + 错误协议 + Privacy 授权 + Word append_paragraph 跑通第一个真代理 demo (含 SP-1..SP-7 spike week 1) | AGENT-01/02/05/06/08/13, ERR-01/02, PRIV-01/02/03, CARRY-01, NFR-02 (12 reqs) | — |
| **4** Read Tools 全套 + Privacy 落地 + AgentControlBar | 三宿主 adapter.read + 11 read tools + 防 prompt injection + Privacy gate + size cap + 实时 cost/step UI | AGENT-03/04/12, ERR-03/04, PRIV-04, TOOL-01/02/05/06/07, CARRY-02 (12 reqs) | yes |
| **5** Diff Log + Undo All 跨 3 宿主 | OperationLog + inverse op + DiffLogPanel + humanLabel + per-step undo + undo all + 用户手动改防御 + sessionStorage 兜底 | AGENT-07/09/10/11, TOOL-03 (Word inverse PoC) + TOOL-04, CARRY-03, NFR-05 (8 reqs) | yes |
| **6** 多宿主 Write Tools + Killer Scenarios 重写 | PPT/Excel/Word write tools 全套（含 set_shape_property 差异化护城河）+ 4 killer scenarios as agent flows + Ribbon 降级 | TOOL-03 (其余宿主), ONB-01/02/03 (4 reqs) | yes |
| **7** UAT + Privacy Doc + Sideload Release Prep | 4 killer scenario 端到端 UAT + PRIVACY.md + README + sideload 三宿主全验 + 开源仓库发布 | PRIV-05, ERR-04, NFR-01/03/04/05 (6 reqs) | — |

**Phase Dependencies:** 3 → 4 → 5 → 6 → 7（严格串行；Phase 5 undo 兜底必须先于 Phase 6 destructive write tools）

**Coverage:** 40/40 ✓ (see REQUIREMENTS.md §Traceability)

## Performance Metrics

**Velocity:**

- Total plans completed: 26 (v1.0 baseline)
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 00 (v1) | 11 | - | - |
| 02.1 (v1) | 8 | - | - |
| 3-7 (v2) | 0 | - | - |
| 04.1 | 7 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 02 P01 | 15min | 3 tasks | 6 files |
| Phase 02 P02 | 25min | 2 tasks | 4 files |
| Phase 02 P04 | 15min | 2 tasks | 8 files |
| Phase 02.1 P01 | 15min | - tasks | - files |
| Phase 02.1 P02 | 12min | 1 task | 1 file |
| Phase 02.1 P03 | 5min | 2 tasks | 4 files |
| Phase 02.1 P04 | 20min | 2 tasks | 4 files |
| Phase 02.1 P02.1-06 | 20min | 2 tasks | 4 files |
| Phase 02.1 P08 | 10 | 2 tasks | 9 files |
| Phase 02.1-gap-closure-02-uat P02.1-05 | 727 | 4 tasks | 16 files |
| Phase 04 P05 | 20min | 1 tasks | 2 files |
| Phase 04 P07 | 17 | 2 tasks | 8 files |
| Phase 04 P08 | 7min | 2 tasks | 7 files |
| Phase 04.1 P03 | 13min | 2 tasks | 9 files |
| Phase 04.1 P04.1-04 | 13min | 2 tasks | 7 files |
| Phase 04.1 P05 | 14min | 3 tasks | 10 files |
| Phase 05 P05-04 | 106 | 1 tasks | 2 files |
| Phase 05 P07 | 30 | 2 tasks | 8 files |
| Phase 05 P05-08 | 19min | 2 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Initialization (2026-05-26): Stack locked = Vite 7 + React 19 + Fluent UI v9 + Zustand + Lingui + 原生 fetch+SSE + XML manifest + shared runtime
- Initialization (2026-05-26): Key 存储修正为 partitioned localStorage（PRD F5 原文 `roamingSettings` 是 Outlook 专用，已修正）
- Initialization (2026-05-26): v1 成功指标只看 GitHub stars + issues（不引入 Plausible/PostHog SDK）
- Initialization (2026-05-26): v1 含 Word grammar/spell 作为润色下拉一项（gap #1）+ token 成本徽章（gap #4）；Onboarding 内联 Key 校验推迟到 v1.1（ONB-01）
- Initialization (2026-05-26): Phase 0 spike 前 3 项（CORS / PPT 写回 / 存储 scope）是 GATING——失败必须修订 PRD 才能进 Phase 1
- [Phase ?]: ESLint 从零安装（flat config，eslint@^9），阻断 PROV-10 legacy 模型名与 LLM SDK 导入
- [Phase 02-02]: streamSSE 内部注入 stream_options.include_usage:true，调用方无需传入（防止成本徽章永远 0 token）
- [Phase 02-02]: apiKey 从 body 副本提取注入 Authorization header，请求体 JSON 不含 apiKey（T-02-04）
- [Phase ?]: setupVisibilityAbort 放在 queue.ts（非 openai-compat）：chatStore 持有 AbortController，职责分离
- [Phase ?]: withRetry 包裹在 singleFlight 内部：429 重试等待在队列内，不阻塞其他 Provider
- [Phase 02-05]: PowerPoint TextFrame 通过 .textRange.text 赋值（无直接 .text 属性）；PLAN.md 伪代码已在实现时修正
- [Phase 02-05]: hydrateFromStorage() 在 main.tsx Office.onReady 内、root.render 前调用，确保首次渲染拿到持久化 Provider 配置
- [Phase 02.1-01]: 修订 .aster-shell min-width:350px → min-width:0 + width:100% (Office iframe 宽度由宿主决定，固定 min-width 反而易撑破)
- [Phase 02.1-01]: 代码块在 350px 窄面板用 white-space:pre-wrap + max-width:100% 替代横向滚动 (CLAUDE.md §UI 设计系统美观优先)
- [Phase 02.1-01]: Flex 链路 min-width:0 兜底范式 (.aster-shell → .aster-chat → .aster-messages → .aster-bubble--assistant) — 后续所有 UI plan 复用
- [Phase 02.1-03]: useEffect 依赖改为 [messages] 整体引用（非 messages.length）——chatStore 流式 delta 每次 set 生成新数组引用，确保 delta 追加触发滚动 effect
- [Phase 02.1-03]: 新消息用 smooth 滚动，流式 delta 用 auto 滚动（auto 跟随 token 速度不产生视觉抖动）；isAtBottom 阈值 8px 避免亚像素误判
- [Phase 02.1-02]: pill-row 横向 padding 改为 sp-2=8px（与 composer 内部对齐），外层 inputbar 提供 --inputbar-padding-x=sp-4 统一基准，消除胶囊与输入框文本起点 4px 错位
- [Phase 02.1-02]: .aster-composer padding 改为统一 var(--sp-2) 四向 8px（原左 12px 右 8px 不对称），对齐更可预测
- [Phase ?]: calcCostCny 签名扩展为 3 参数 (usage, providerId, model): providerId 作 namespace 守门，model 二级查 PROVIDER_PRICING 表
- [Phase ?]: D-13 ①: isBuiltIn 判断下沉至 calcCostCny；CostBadge 不再判 isBuiltIn，只看 costCny 是否为 null
- [Phase 02.1-06]: SettingsPanel 编辑态独占（非 D-26 字面同屏三区）：350px 窄面板同屏三区拥挤，独占更符合 UX，且更强兑现「全局选项不与表单混排」
- [Phase 02.1-06]: ProviderList 编辑/新建 state 上移至 SettingsPanel，通过 onEdit/onCreate props 上抛事件；深链 focusAnchor 改为触发 onEdit，SettingsPanel 透传 initialFocus 到 ProviderForm（保留 D-12 深链行为）
- [2026-05-28 Vision Pivot]: PRD R1 superseded — Aster 从「AI 提效工具」扩展到「Office 智能代理」；Phase 0-2.1 复用，Phase 2.2 + 3-7 needs-replan
- [2026-05-28 Q7]: 代理能力边界 = 仅单文档内多步；不跨文档不跨应用
- [2026-05-28 Q8]: 放弃 v1 单独发布，专注 v2；v1 代码作为 v2 基座保留，不打 tag 不写 release notes
- [2026-05-28 Q9]: 失控控制 = 宽松默认 (max_steps=20 + ¥10 cap + always-visible pause/cost/diff log/undo all)
- [2026-05-28 Q10]: 隐私模型 = 宽松 (默认全开 read tool + Onboarding 一次性授权 + Settings 单一 opt-out)，PRD KEY-03 superseded
- [2026-05-28 Q11]: 错误恢复 = 代理自决 (tool error push 回 LLM + max_steps fail-safe + 同 tool >2 次失败强制 abort)
- [2026-05-28 Q12]: Phase 2.2 整体取消；4 件 UAT follow-up 中 FU-01/02/03 转嫁 v2 (CARRY-01..03)，FU-04 Excel 回归不再需要
- [2026-05-28 Roadmap]: v2.0 Phase 3-7 (5 phases) 收敛于 ARCHITECTURE/FEATURES/PITFALLS/SUMMARY 4 文件一致建议；0 净新增运行时依赖；bundle 目标 ~70KB
- [2026-05-28 Roadmap]: Phase 顺序硬约束 — Phase 5 undo 兜底必须先于 Phase 6 destructive write tools 大规模铺开
- [2026-05-28 Roadmap]: CARRY-01 (FU-01 selection bug) 必须在 Phase 3 修，否则 Phase 4 read tools 上线后所有 selection-aware tool 都被污染
- [2026-05-28 Roadmap]: Phase 3 Week 1 内嵌 7 项 spike (SP-1..SP-7) 子任务而非独立 spike phase；SP-5 (PPT slide.delete) 提前到 Phase 3 跑避免 Phase 5 架构 pivot
- [Phase 04-01 ERR-03]: circuit-breaker 成功用哨兵 code '_ok' 占 slot，绝不 delete/reset — A-10 灵魂（sliding window WINDOW=5 THRESHOLD=3）
- [Phase 04-01 TOOL-06]: token 估算用 1.6 chars/token 保守上界，比实际 2.5 中文字/token 偏大，让 50K cap 更早触发（安全方向，D-12）
- [Phase 04-01 TOOL-05]: wrapReadResult 失败路径原样透传，不读 err.stack；result_type 分类由调用方 tool execute 决定（不在包装层自判断）
- [Phase 04-02 TOOL-01]: ReadToolError 用 type-only 复制而非 import ToolError，防 adapter→agent 反向依赖（0-import 约束）
- [Phase 04-02 TOOL-07]: Assumption A3 验证通过：no-restricted-globals 正常拦截 PowerPoint.run（成员访问基础标识符），无需改用 no-restricted-syntax
- [Phase 04-02 TOOL-07]: ns-violation.ts fixture 不加 ignores，日常 lint 时拦截 fixture 即证明 rule 生效；CI 用 grep -v __fixtures__ 过滤统计摘要
- [Phase 04.1-02]: teal token 来源 aster.css .v-quiet.acc-teal 块（light --accent #009887 / dark #4fc9b8）；.v-quiet 基础块 accent 是橙色 #E64A19 不用
- [Phase 04.1-02]: [data-theme] 选择器保持不变（main.tsx 在 #root 设值，通用选择器即可），不引入 .v-quiet 父类
- [Phase 04.1-02]: font-body 优先 Inter（拉丁/数字），中文 fallback Noto Sans SC；font-mono 用 JetBrains Mono
- [Phase ?]: D-04 保留原有 send-btn disabled 行为（isAgentBusy || !text.trim()），plan 示例代码有误，以约束为准

### Roadmap Evolution

- Phase 04.1 inserted after Phase 4 (2026-05-29): Aster redesign migration — UI 设计系统迁移到 teal 克制方向 (URGENT)。canonical_ref = `.planning/design/aster-redesign/`（INDEX.md 第 48 行预埋此插入）。范围：token 迁 teal `#009887` + 暖白底 `#FAFAF8`、去玻璃拟态/渐变、重写 `styles.css`、重皮组件、按新语言补设计 agent 运行时面、更新 CLAUDE.md §UI 设计系统 + 记忆 `feedback_beauty_over_fluent` + 标 `01-UI-SPEC.md` 过时、丢掉 cost、`/gsd-sketch-wrap-up` 固化 project design skill 供 Phase 5/6 消费。Phase 4 仍按现有设计系统建，迁移在 4 完成后进行。

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- Phase 3 Week 1 spike SP-3 (aihubmix 上游 model tool calling 一致性) 结果未知；若上游 claude / Doubao 完全不兼容，Phase 4 model 选择需对应调整 UX
- Phase 5 SP-5 (PPT slide.delete) 提前到 Phase 3 跑；若 PPT 不可靠 reverse，整个 PPT undo 路线需走 snapshot fallback，Phase 5 接口要预留
- Phase 7 PRIVACY.md / README 重写形式待定（视频 / GIF / 文字比例），不阻塞前期阶段
- Cost cap ¥10 默认数值需在 Phase 7 通过真实用户访谈 / UAT 验证（中文白领对一次 agent 跑的心理价位）

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260527-o8j | Fix empty Lingui zh-CN catalog so Task Pane renders Chinese | 2026-05-27 | b02773f | [260527-o8j-fix-empty-lingui-zh-cn-catalog-so-task-p](./quick/260527-o8j-fix-empty-lingui-zh-cn-catalog-so-task-p/) |
| 260527-opp | Fix context card dynamic i18n strings (blank slide number) | 2026-05-27 | e8edc67 | [260527-opp-fix-context-card-dynamic-i18n-strings-no](./quick/260527-opp-fix-context-card-dynamic-i18n-strings-no/) |
| 260527-q1c | 精简 Ribbon 入口为单一 Aster 入口并在 Task Pane 内加用法提示 | 2026-05-27 | 83d19f9 | [260527-q1c-ribbon-aster-task-pane](./quick/260527-q1c-ribbon-aster-task-pane/) |
| 260529-vtc | 一键复制聊天记录 + Debug 信息（InputBar 剪贴板按钮，Key 不泄露守门） | 2026-05-29 | d534b92 | [260529-vtc-debug](./quick/260529-vtc-debug/) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v1 Phase 2.2 | FU-04 Excel for Web auto 写入回归补测 | Cancelled (v1 不发=验收意义减弱; v2 测试期重新覆盖) | 2026-05-28 (Q12) |

## Session Continuity

Last session: 2026-05-29T17:54:54.942Z
Stopped at: Phase 5 UI-SPEC approved
Resume file: None

### 上个 phase 收尾记录（Phase 04.1，2026-05-29 完成）

- Plans 01-07：✅ 全部完成（7/7，summary 齐全）
- D-08 三宿主真机 UAT：✅ 用户逐项确认 PASS（SC1-SC7，含 dark 抽查）
- 验证：gsd-verifier 11/11 must-have 通过（`04.1-VERIFICATION.md` status: passed）
- code review：`04.1-REVIEW.md` = 1 BLOCKER / 5 WARNING / 6 INFO（advisory）
  · ✅ **CR-01 已修（`53fa6eb`，已 push 部署）**：ChatStream CIRCUIT_OPEN「重新试试」原传 `undefined as never` adapter → 点击必抛 TypeError（熔断恢复死路径）。改为 `useAdapter()` 取真实 adapter + 加守门测试。源头是 phase 04（7ca7c9a）预存在 bug。
  · ✅ **WR-01 也已修（`7821c75`，已 push）**：配置 Key 后 banner 即时消失（providerStore 加响应式 configuredKeyIds + 守门测试）。源头同为 phase 02 预存在。
  · 剩余 WR/INFO（WR-02 send 按钮误导 aria、WR-03 重试丢 selectionCtx、WR-04 AlertIcon arc path、WR-05 PaperclipIcon size、死图标/死 ContextCard 等）未处理 → 可后续 `/gsd-code-review-fix 04.1` 批量收。

- 门禁：build OK；size-limit 80.54 KB ≤ 82 KB；test 460 passed / 1 failed（`src/providers/retry.test.ts` 预存在 flaky，单跑 9/9 PASS，phase 02 起的测试隔离问题，非 04.1 回归）
- 线上 HEAD（前序 session 部署）= `3c0f706`；本次收尾 commit 仅文档/规划（SUMMARY/REVIEW/VERIFICATION/tracking），**无托管资产变化，无需重新部署**

⚠ GSD 复发坑（记忆 [[project_gsd_tooling_quirks]]）：本次 `phase.complete` 又出现 STATE.md frontmatter 漏更（stopped_at/last_updated/current focus stale + 残留 Phase 4 UAT 块），已手工核对并修正；ROADMAP 进度表 04.1 = Complete ✓、next_phase = 5 ✓ 均已人工确认。
