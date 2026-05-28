# Phase 3: Agent Loop 地基 + Privacy 授权 + Word 多步 demo - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 03-agent-loop-privacy-word-demo
**Areas discussed:** Agent 触发语义 / Privacy step 时机 / Cost cap 默认值与估算 / AgentControlBar 骨架边界 / 错误 sanitization 实现 / Spike SP-1..SP-7 失败 fallback

---

## Agent 触发语义

### Q1: 用户按 Send 默认走哪条路径？

| Option | Description | Selected |
|--------|-------------|----------|
| 全部默认走 agent loop （推荐） | chatStore.sendMessage 转为 thin-delegate 到 agentStore.runAgent | ✓ |
| 双模式 Settings toggle | Settings 「单步 / 代理」开关，默认代理 | |
| Phase 3 只用独立 entry 跑 demo | agent loop 不接默认 sendMessage；独立入口跑 demo | |

**用户选择：** 全部默认走 agent loop

### Q2: v1 现有「AI 自动写文档 confirm/auto」Settings toggle（D-19）怎么处理？

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 3 直接砍掉（推荐） | agent loop 默认 inline 执行；与代理愿景矛盾 | ✓ |
| 换成「每步问我」toggle | 重命名为「每步 tool call 前请示意」 | |
| 保留现状 confirm/auto | 保留 v1 D-19 | |

**用户选择：** Phase 3 直接砍掉

### Q3: Phase 3 Word demo「跑通」怎么算？

| Option | Description | Selected |
|--------|-------------|----------|
| 只跑一条固定 prompt，看看反应（推荐） | ROADMAP「写 3 段关于跨境电商物流的内容」固定 fixture；LLM 调 append_paragraph 几次都接受（>1次即可） | ✓ |
| 跑 3-5 个不同 prompt | 验证 LLM 泛化能力 | |
| 不设样本限制，全开放 | 任意 prompt 都要验收（属 Phase 7 范围） | |

**用户选择：** 只跑一条固定 prompt
**Notes:** 用户在前一轮先反馈"看不懂"，我重新解释了 LLM 变性问题（同一句 prompt 不同时刻可能调 3/4/1 次 append_paragraph）后用户拍板。

---

## Privacy step 时机

### Q1: 「全文读取授权」这一屏什么时候出现？

| Option | Description | Selected |
|--------|-------------|----------|
| Onboarding 第 3 步常驻 | 三步连贯，老用户单独补授权 modal | |
| Lazy：第一次 send 拦截 | Onboarding 仍 2 步，首次 send 时弹 modal | |
| Settings 主动开 | Settings 加总开关，不主动提示 | |
| **全部砍掉** | PRIV-01..05 全套 superseded（最终用户决议） | ✓ |

**用户最终拍板：** PRIV-01..05 全部砍掉

**Notes:**
- 用户首先指出"没有老用户"误区（v1 不发，Q8 已锁），让我把"老用户兼容"这条抹掉
- 重新框定后用户进一步说"直接自动读取不需要用户授权 + 保留选区概念"
- 我列出 PRIV-01..05 五条让用户拆分（建议保留 02/03/04/05 技术防御 + 公示）
- 用户决议："砍掉所有的这些授权，因为这个工具初期用户都是我自己或者亲人"
- 决策沉淀到 memory `[[project-aster-privacy-simplified]]`

---

## Cost cap 默认值与估算

### Q1: Cost cap 默认值锁在哪？

| Option | Description | Selected |
|--------|-------------|----------|
| ¥10 hardcode + Settings 可调 ¥1-50 | ROADMAP/SUMMARY 一致推荐 | |
| ¥10 hardcode，Settings 不可改 | Phase 3 不动 Settings UI | |
| 首启问一次，设后不改 | Onboarding 加 cost cap 选择 | |
| **我先直接移除这个 cost 功能** | 砍 cost cap + meter | ✓ |

### Q2: aihubmix LLM 单价与自定义 Provider 怎么走？

| Option | Description | Selected |
|--------|-------------|----------|
| aihubmix 补单价 + 自定义拒在门外 | 查 aihubmix 文档补价 | |
| aihubmix 用 deepseek-pro 作保守上限 | 不查 aihubmix 文档 | |
| 仅 deepseek 走代理 + cap | aihubmix LLM / 自定义 Provider 关门 | |
| **直接移除 cost 功能** | 同 Q1 | ✓ |

### Q3: v1 已交付的「消息底部成本徽章」（CostBadge）要不要一起拆？

| Option | Description | Selected |
|--------|-------------|----------|
| 保留 v1 CostBadge，只砍 v2 新增 | CostBadge 不打扰，pricing.ts 保留 | |
| **全部成本相关的都砍掉** | v1 CostBadge / pricing.ts 一并拆 | ✓ |

**用户决议：** 全部 cost 相关都砍，v1 CostBadge 一起拆。决策沉淀到 memory `[[project-aster-cost-removed]]`。

---

## AgentControlBar 骨架边界

### Q1: Phase 3 AgentControlBar 骨架做到哪一层？

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 3 完整做完不才骨架（推荐） | pause + abort + step counter + max_steps 软着陆提示，Phase 4 只加文案 | ✓ |
| Phase 3 只占位 visible 不可交互 | pause/abort 留 Phase 4 接 | |
| Phase 3 不出 AgentControlBar | 留 Phase 4 整体上线 | |

**用户选择：** Phase 3 完整做完

---

## 错误 sanitization 实现

### Q1: ERR-02 tool error 怎么 sanitize 给 LLM？

| Option | Description | Selected |
|--------|-------------|----------|
| Allowlist 透传四字段 | 严格 allowlist，作者忘写 hint 漏 | |
| Blocklist 正则剥除 | 原始 message + stack 经正则剥敏感 | |
| **Allowlist + LLM 静默备份** | 严格 allowlist + 兜底占位 | ✓ |

**用户决议：** 选项 3（严格 allowlist + 兜底占位）

**Notes:**
- 用户首轮提问"这个错误是用户错误还是 Agent loop 过程中的错误？" —— 我之前没拆清楚两种错误路径
- 我详细解释了 A：用户看到的 UI 红色失败气泡（v1 已实现）vs B：agent loop 内 tool 调用失败 push 回 LLM（v2 新增，Phase 3 在做）
- 用户理解后确认选 3："优先保证 Agent loop 正确运行是第一位"

---

## Spike SP-1..SP-7 失败 fallback

### Q1: 7 项 spike 按踏线严重程度怎么划？

**用户首先反馈** —— 不要直接答 hard gate / soft fallback 分类，而是质疑前提：

> "这里面是不是有一些是我可以在本地的 .env.local 中把对应的 API_KEY 给你，你直接跑就行了？而且在 v1 中好像也都验证过，我觉得如果验证过或者你能够自主验证的，别让我动手"

这是一个**工作分工偏好反馈**，已沉淀到 memory `[[feedback-self-run-spikes]]`。

我据此重新拆 7 项 spike 成三类，提交给用户确认：

| Spike | 类别 | 跑法 |
|---|---|---|
| SP-1 DeepSeek tool_calls delta 多 tool 累积 | Claude 自跑 | curl/Node 脚本 + DEEPSEEK_API_KEY |
| SP-2 include_usage 返 usage | 已 v1 验过 + cost 砍后归档 | 归档不跑 |
| SP-3 aihubmix passthrough tool_calls | Claude 自跑 | curl/Node 脚本 + AIHUBMIX_API_KEY |
| SP-4 三宿主 reverse 操作可达性 | 用户真机 | Claude 写探测代码，用户 sideloaded Aster 跑 |
| SP-5 PPT slide.delete() + 反向排序 | 用户真机 | 同上 |
| SP-6 Office.js proxy 跨 await | PITFALLS A-06 已知 + v1 防御过归档 | 归档不跑 |
| SP-7 三 tool 并行 SSE raw log 归档 | Claude 自跑 | 同 SP-1，归档到 .planning/spikes/ |

**用户确认：** "可以"

**衍生决策：** spike 失败 fallback 按分工各归各人 —— Claude 自跑失败 Claude 直接写 fallback；用户真机跑失败用户告知 Claude 提议 fallback 用户确认；归档的不会失败。**不预设全部 fallback 路径**。

---

## Claude's Discretion

下列灰区用户没主动选讨论，归 Claude's Discretion 在 plan 阶段处理：

- CARRY-01 首次取选区 bug 具体修复路径（路径 A/B/C 三选一）
- Demo system prompt 初稿设计
- humanLabel eslint rule 写法 + Phase 3 不 enforce 的注释
- AgentControlBar 玻璃拟态 / 渐变 / 间距视觉细节
- max_steps 软着陆卡片具体文案

---

## Deferred Ideas

讨论中触发的 deferred 项（CONTEXT.md `<deferred>` 已收录完整）：

- PRIV-01..05 全部 → 永久砍，扩用户范围 / OSS 公开后再评估
- AGENT-03/04/05/06 + v1 COST-01/02 → 永久砍
- v1 confirm/auto insert mode toggle → 永久砍（D-08 删 acceptToolCall / rejectToolCall）
- humanLabel eslint enforce → Phase 5 多 tool 上线时 flip 开关
- ONB-01 Onboarding GIF 示意 → 原属 Phase 6，本 phase 不动

## Reviewed Todos（not folded）

- `builtin-model-dropdown.md` — 已 tag `resolves_phase: 4`，归 Phase 4 CARRY-02
- `copy-chat-history.md` — 已 tag `resolves_phase: 5`，归 Phase 5 CARRY-03

---

*Discussion conducted 2026-05-28 via /gsd-discuss-phase 3*
