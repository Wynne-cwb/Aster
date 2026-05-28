---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: 发布
status: vision_pivot_2026-05-28
stopped_at: Vision pivot from "AI 提效工具" to "Office 智能代理" (PROJECT.md Vision Pivot). v1.0 milestone frozen at Phase 2.1 完成位置. Phase 0-2.1 全部交付且复用. Phase 2.2 + 3-7 needs-replan. 下一步：spec agent 架构边界 / 失控控制 / 隐私模型（PROJECT.md Q7-Q12）, then re-plan ROADMAP.
last_updated: "2026-05-28T11:00:00.000Z"
last_activity: 2026-05-28
progress:
  total_phases: 8
  completed_phases: 4
  total_plans: 27
  completed_plans: 27
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-26)

**Core value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 **AI 代理** 能力，能完成绝大部分文档工作；无后台、BYO Key。
**Current focus:** Vision Pivot 2026-05-28 — 从「AI 提效工具」扩展到「Office 智能代理」。v1.0 milestone 暂停于 Phase 2.1，等愿景对齐 spec 完成后再 re-plan Phase 2.2-7。

## Current Position

Phase: VISION PIVOT — 等 spec
Plan: 无（v1 路线 Phase 3-7 全部冻结，待 re-plan）
Next: 回答 PROJECT.md Q7-Q12 → 基于回答 spec agent 架构 → re-plan ROADMAP → 重启执行
Status: Awaiting vision spec
Last activity: 2026-05-28

Progress:
  v1 baseline (复用):   Phase 0 / 1 / 2 / 2.1 全部交付（4/8 phases，100% 代码可复用）
  v2 agent (未启动):    待 spec → re-plan

## Performance Metrics

**Velocity:**

- Total plans completed: 19
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 00 | 11 | - | - |
| 02.1 | 8 | - | - |

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
- [Phase ?]: [Phase 02.1-01]: 修订 .aster-shell min-width:350px → min-width:0 + width:100% (Office iframe 宽度由宿主决定，固定 min-width 反而易撑破)
- [Phase ?]: [Phase 02.1-01]: 代码块在 350px 窄面板用 white-space:pre-wrap + max-width:100% 替代横向滚动 (CLAUDE.md §UI 设计系统美观优先)
- [Phase ?]: [Phase 02.1-01]: Flex 链路 min-width:0 兜底范式 (.aster-shell → .aster-chat → .aster-messages → .aster-bubble--assistant) — 后续所有 UI plan 复用
- [Phase 02.1-03]: useEffect 依赖改为 [messages] 整体引用（非 messages.length）——chatStore 流式 delta 每次 set 生成新数组引用，确保 delta 追加触发滚动 effect
- [Phase 02.1-03]: 新消息用 smooth 滚动，流式 delta 用 auto 滚动（auto 跟随 token 速度不产生视觉抖动）；isAtBottom 阈值 8px 避免亚像素误判
- [Phase 02.1-02]: pill-row 横向 padding 改为 sp-2=8px（与 composer 内部对齐），外层 inputbar 提供 --inputbar-padding-x=sp-4 统一基准，消除胶囊与输入框文本起点 4px 错位
- [Phase 02.1-02]: .aster-composer padding 改为统一 var(--sp-2) 四向 8px（原左 12px 右 8px 不对称），对齐更可预测
- [Phase ?]: calcCostCny 签名扩展为 3 参数 (usage, providerId, model): providerId 作 namespace 守门，model 二级查 PROVIDER_PRICING 表
- [Phase ?]: D-13 ①: isBuiltIn 判断下沉至 calcCostCny；CostBadge 不再判 isBuiltIn，只看 costCny 是否为 null
- [Phase 02.1-06]: SettingsPanel 编辑态独占（非 D-26 字面同屏三区）：350px 窄面板同屏三区拥挤，独占更符合 UX，且更强兑现「全局选项不与表单混排」
- [Phase 02.1-06]: ProviderList 编辑/新建 state 上移至 SettingsPanel，通过 onEdit/onCreate props 上抛事件；深链 focusAnchor 改为触发 onEdit，SettingsPanel 透传 initialFocus 到 ProviderForm（保留 D-12 深链行为）

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- Phase 0 spike Q1（Unsplash vs Pexels 图库选型）将在 Phase 0 期间决出；不阻塞 Phase 1
- Phase 7 sideload 文档与 Privacy doc 形式待定（视频/GIF/文字比例）；不阻塞前期阶段

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260527-o8j | Fix empty Lingui zh-CN catalog so Task Pane renders Chinese | 2026-05-27 | b02773f | [260527-o8j-fix-empty-lingui-zh-cn-catalog-so-task-p](./quick/260527-o8j-fix-empty-lingui-zh-cn-catalog-so-task-p/) |
| 260527-opp | Fix context card dynamic i18n strings (blank slide number) | 2026-05-27 | e8edc67 | [260527-opp-fix-context-card-dynamic-i18n-strings-no](./quick/260527-opp-fix-context-card-dynamic-i18n-strings-no/) |
| 260527-q1c | 精简 Ribbon 入口为单一 Aster 入口并在 Task Pane 内加用法提示 | 2026-05-27 | 83d19f9 | [260527-q1c-ribbon-aster-task-pane](./quick/260527-q1c-ribbon-aster-task-pane/) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none — fresh project)* | | | |

## Session Continuity

Last session: 2026-05-28T08:35:00.000Z
Stopped at: Phase 02.1 完整闭环代码侧——8/8 plans 完成 + code-review 4 BLOCKER + 8 WARNING 全修 + 190 tests pass + build 75 kB gzipped；verifier 6/7 SC verified，SC7 真机 UAT 已写入 02.1-HUMAN-UAT.md 等批量执行
Resume file: .planning/phases/02.1-gap-closure-02-uat/02.1-HUMAN-UAT.md
