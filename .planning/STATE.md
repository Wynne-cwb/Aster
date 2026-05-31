---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: 从能用到好用
status: executing
stopped_at: Phases 8-12 executed + automation-green + TL-verified; awaiting Phase 13 real-machine UAT
last_updated: "2026-05-31T05:11:22.630Z"
last_activity: 2026-05-31 -- Phases 9/10/11/12 executed in sequence (teammate-per-phase), all automation gates green, local main, not pushed
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 27
  completed_plans: 27
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-30 — Milestone v2.1「从能用到好用」started)

**Core value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 **AI 代理** 能力，能完成绝大部分文档工作；无后台、BYO Key。
**Current focus:** Phase 13 — v2.1 UAT + Release（gated on user real-machine UAT）

## Current Position

Phase: 13 (v2.1 UAT + Release) — PENDING（依赖用户真机 UAT，仅用户可做）
Plan: TBD
Status: Phases 8/9/10/11/12 全部 code-complete + 自动化全绿（npm test 731 passed/0 failed、build、size 75.01KB≤82KB、0 净新增依赖）+ TL 逐阶段独立核验。**本地 main 未 push**。合并真机 UAT 待办清单见本次会话交付。
Last activity: 2026-05-31 -- Completed quick task 260531-l7v: W1 部分失败 batch 通知熔断器（partialFailure 解耦）

### v2.1 执行收尾摘要（2026-05-31）

- **Phase 9 Word 精准写**：5 工具 + WSEL-01；测试 677；2 真机 UAT（S5 uniqueLocalId / find_and_replace undo 写回）。
- **Phase 10 Excel+PPT 18 工具**：13 完整 inverse + 2 noop+gate（delete_shape/manage_slides）+ 3 spike 降级 noop+gate（S1/S2/S4）；测试 695；4 真机 spike UAT（S1/S2/S4/S7）。code-review CR-01（set_column_row_size 列 >Z 非法地址，对称 clean failure，2 行可修）待复核。
- **Phase 11 批量操作**：batch_write 单闭包 + fail-fast + batch_reverse 逆序 undo + DiffLogPanel 可展开批量卡；测试 710。守门当场抓出双重逆序 bug（已修 eb218f2）。code-review CR-01（Word 批量 undo 静默失效）经真 WordAdapter 探针实测 = **假阳性**（undo 本就工作），但顺手做 Path B 显式 hardening（1b0a173）消除 normalizeText null-guard latent 脆性 + 加 Word batch_reverse 真 adapter 守门；并修了一个被误判为 retry 噪音的真·失败测试（i18n coverage，e786e64）。W1（部分成功 batch 返回 ok:true 抹熔断计数）待复核。
- **Phase 12 UI 打磨**：UI-01 XSS safeUrlTransform（白名单挡 javascript:/data:/vbscript:，react-markdown@9 已内置同类防御故为 defense-in-depth）+ UI-02 思考气泡 + UI-03 DiffLog 边界插入 + UI-04 表格 CSS + UI-05 读卡降权 + UI-06 骨架屏；测试 731；视觉项（light/dark）待真机。

### v2.1 Phase List

| Phase | Goal | Requirements | UI hint |
|-------|------|--------------|---------|
| **8** Foundation + 能力 A + 持久化 F | 工具合并设计合约 + per-host domain prompt 深化 + 用户偏好注入（injection 防御）+ 聊天记录持久化（localStorage + 清空 + 20 轮截断 + docKey spike） | PROMPT-01, PREF-01, PREF-02, HIST-01, HIST-02, HIST-03, HIST-04, NFR-06, NFR-07, NFR-08 (10 reqs) | — |
| **9** Word 精准写 (D + B-Word) | Word 选区精度（paragraphIndex + uniqueLocalId）+ Word 5 工具完整（字符格式/段落格式/套样式/查替换/插表格），含 undo 基础设施 | WSEL-01, WORD-01, WORD-02, WORD-03, WORD-04, WORD-05 (6 reqs) | yes |
| **10** Excel + PPT 工具完整 (B-Excel + B-PPT) | Excel 10 工具（格式/列宽行高/排序/筛选/查替换/条件格式/建表/冻结/工作表/图表标题）+ PPT 8 工具（字体/对齐/形状增删/旋转/背景/幻灯片管理），spikes S1-S4/S7，undo 基础设施 | EXCEL-01~10, PPT-01~08 (18 reqs) | yes |
| **11** 批量操作 (C) | batch_write 单闭包单 sync + OperationLog batch 条目 + DiffLogPanel 可展开批量卡 + 一键 undo 整批 | BATCH-01, BATCH-02 (2 reqs) | yes |
| **12** UI 打磨 (E) | XSS 防御 + loading 气泡 + DiffLogPanel 跟随 loop + Markdown 表格 CSS + 读卡轻量化 + 首屏骨架屏 | UI-01, UI-02, UI-03, UI-04, UI-05, UI-06 (6 reqs) | yes |
| **13** v2.1 UAT + Release | A–F 全能力三宿主 Office for Web（Chrome/Edge）真机端到端 UAT + 发布 | （覆盖全部 42 个 v2.1 需求的 UAT 验证；0 独立新需求） | — |

**Phase Dependencies:**

- Phase 8 → Phase 9 → Phase 10 → Phase 11（B 工具必须全部就位，batch 才能 dispatch）
- Phase 12 可与 Phase 9/10/11 并行（但 UI-01 XSS 修复 P0，应尽早）
- Phase 13 依赖所有前序 phases（8/9/10/11/12）全部完成

**Coverage:** 42/42 ✓ (see REQUIREMENTS.md §Traceability)

### Progress Bar

[████████░░] 83% — Phases 8-12 done (code+automation green, TL-verified, local main); Phase 13 real-machine UAT + release pending

## Performance Metrics

**Velocity (v2.1):**

- Total plans completed: 27 (Phases 8-12 all executed)
- Average duration: -

**v2.0 历史参考：** 6 phases / 53 plans / 295 commits / 73.42 KB bundle（首次公开发布 2026-05-30）

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
- [Phase ?]: Wave 0 test stubs: system-prompt per-host 断言用 describe.skip
- [Phase ?]: vi.hoisted 修复 vi.mock factory 顶层变量提升问题（Wave 0 OnboardingModal test fix）
- [Phase ?]: 06-05: mutated 字段不加入 ToolResult，PostStateSnapshot.kind 扩展 excel_chart（Rule 2）
- [Phase ?]: 三 PPT shape write tool 共用 postState kind
- [Phase ?]: D-06 共享+专属结构：getSharedBase + getDomainSegment 内部函数拆分，buildSystemPrompt 签名不变
- [Phase ?]: D-07 去技术化：prompt 字符串删除 API Key 路径/后台描述等架构细节，not.toContain 测试守门
- [Phase ?]: D-08 领域指导：PPT/Excel/Word 各 6 行关键词（list_slides/get_used_range_summary/replace_paragraph），零 bundle 写入 prompt 字符串（D-09）
- [2026-05-30 v2.1 Roadmap]: Phase 8 内嵌 S6 spike（document.url 稳定性）；Phases 9/10 内嵌 S5 + S1/S2/S3/S4/S7 spike；spike 作为相关 Phase 首个子任务执行
- [2026-05-30 v2.1 Roadmap]: 工具合并设计合约（每宿主 ≤8 净新增工具定义，全局 ~23 个，description ≤50 字，undo 分类表）作为 Phase 8 第一个产出，先于任何 B 工具编码
- [2026-05-30 v2.1 Roadmap]: undo 基础设施（restore_* adapter 方法 + OperationLog reverse cases + integration tests）与破坏性/新 write 工具同 Phase 交付，不可拆分
- [2026-05-30 v2.1 Roadmap]: batch_write（Phase 11）必须在 Phase 9 + Phase 10 全部完成后启动，因为 batch 内部 dispatch 依赖已注册工具的 execute 函数
- [2026-05-30 v2.1 Roadmap]: Phase 12（UI 打磨）可与 Phase 9/10/11 并行；UI-01 XSS 修复是 P0 第一行改动
- [Phase 08-03]: sanitizePrefs 用 String.includes 而非正则——保持简单，避免正则引擎灾难性回溯（OWASP LLM01 注入防御）
- [Phase 08-03]: setPrefs 存原始文本到 storage（rawInput 显示用）+ sanitize 后写 userPrefs（LLM 注入点只拿 sanitized 值，D-09）
- [Phase 08-04]: hashUrl 只取 pathname（不含 query/hash）防止 SharePoint session token 写入 localStorage key（T-08-tokenleak 缓解）
- [Phase 08-04]: truncateTo20Turns 整 run 删除（从第 N-20 个 user 消息索引 slice），tool 消息随 run 整组丢弃，防孤立 tool 消息导致 LLM 400
- [Phase 08-04]: saveHistory 仅正常结束调用（toolCallsThisTurn.length===0 分支），error/abort 路径豁免不保存不完整历史
- [Phase 09-03]: WSEL-01 文本指纹快路径（非 compareLocationWith）：normalizeText 消除末尾 \r\n，取第一个匹配段落 index，无需额外 sync，v2.1 Web 验证可接受
- [Phase 09-03]: typeof Office !== 'undefined' 门控前置：防 test 环境 Office 未 mock 时 Office.context?.requirements 访问崩溃（isSetSupported 门控标准写法）
- [Phase 09-03]: WSEL-01 降级测试独立 mock（不复用 mockWordForRead）：mockWordForRead 内部总设置 isSetSupported=true，降级测试必须完全独立设置 Word/Office
- [Phase 09-05]: D-08 VALID_BUILTIN_STYLES allowlist 在 word.ts 工具层（非 adapter）；返回新枚举值 INVALID_PARAM（已加入 ToolErrorCode），recoverable:true 允许 LLM 重试合法值
- [Phase 09-05]: restoreParagraphStyle Record-signature + 双重定位（index 快路径 + 内容指纹降级）；还原优先 styleBuiltIn（'Other' 时回退 para.style）
- [Phase 10-05]: spike S4 (paragraphFormat.alignment) 需 `as unknown as Array<...>` 中转规避 @types/office-js ParagraphFormat 类型不完整（缺 alignment 字段）
- [Phase 10-05]: manage_slides v2.1 仅 delete：schema enum=['delete'] + adapter 运行时 `if (operation !== 'delete') throw` 双保险 (D-14 T-10-16)
- [Phase 10-05]: 3 spike 工具（S1/S2/S4）integration happy-path 需扩展 mockPpt 补 shape-03/paragraphFormat/slide.background.fill；真机 UAT 结论待 Phase 13
- [Phase 10-05]: Phase 10 全 18 工具（EXCEL-01..10 + PPT-01..08）完成；D-17 23/23 守门通过；bundle 74.59 KB
    - [Phase 12-03]: showTyping 严格用 agentStatus === 'running' || === 'paused'（排除 soft-landing），D-05
    - [Phase 12-03]: MergedToolGroup allRead 用 messages.every()——任一 write 即全组不降权，D-15
    - [Phase 12-03]: UI-04 table 用 display:block + overflow-x:auto 实现 350px 窗格内横向滚动
    - [Phase 12-03]: bundle 74.88 KB（12-03 后，含新 CSS）
    - [Phase 12-04]: toolRunLastIdx 独立变量追踪 regularTool 的 messages index，避免 i-1 偏移不精确（Pitfall-3 守门）
    - [Phase 12-04]: completedRunSet（Set 查找 O(1)）替代 completedRunIds.includes（O(n*m)）
    - [Phase 12-04]: bundle 75.01 KB（12-04 后，边界插入算法无额外体积）

### Roadmap Evolution

- Phase 04.1 inserted after Phase 4 (2026-05-29): Aster redesign migration — UI 设计系统迁移到 teal 克制方向 (URGENT)。canonical_ref = `.planning/design/aster-redesign/`（INDEX.md 第 48 行预埋此插入）。范围：token 迁 teal `#009887` + 暖白底 `#FAFAF8`、去玻璃拟态/渐变、重写 `styles.css`、重皮组件、按新语言补设计 agent 运行时面、更新 CLAUDE.md §UI 设计系统 + 记忆 `feedback_beauty_over_fluent` + 标 `01-UI-SPEC.md` 过时、丢掉 cost、`/gsd-sketch-wrap-up` 固化 project design skill 供 Phase 5/6 消费。Phase 4 仍按现有设计系统建，迁移在 4 完成后进行。
- v2.1 Phases 8–13 created (2026-05-30): 42 需求全覆盖（A:3/Word:5/Excel:10/PPT:8/C:2/D:1/E:6/F:4/NFR:3）；6 个 phase 按研究 SUMMARY.md 8a–8f 概念映射为顺序编号 8–13；硬依赖约束已保留（8→9→10→11；12 可并行；13 最后）。

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- Spike S1（rotate_shape 可写性）+ S2（slide.background 可读性）+ S4（textRange.paragraphFormat.alignment 可读写）是 Phase 10 PPT 工具 undo 策略的门控；3 个 spike 失败则对应工具降级为 noop+gate（已在需求 PPT-02/05/08 中标注）
- Spike S3（PowerPointApi 1.8 table on Web）决定 insert_table_ppt 是否提前至 v2.1；失败 = defer v2.2（已在 REQUIREMENTS.md Deferred PPT-D2 标注）
- Spike S6（document.url 格式稳定性）决定 HIST-04 per-doc 存储是否启用；失败 = 全局单 key 回退（Phase 8 内并行跑）
- Spike S5（uniqueLocalId WordApi 1.6 on Web）HIGH 信心但仍须确认；关系 WSEL-01 降级策略（Phase 9 首任务）
- Spike S7（addTextBox deselect 绕过 #2775 有效性）关系 PPT-03 add_shape 是否需要额外守门（Phase 10 首任务）

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260527-o8j | Fix empty Lingui zh-CN catalog so Task Pane renders Chinese | 2026-05-27 | b02773f | [260527-o8j-fix-empty-lingui-zh-cn-catalog-so-task-p](./quick/260527-o8j-fix-empty-lingui-zh-cn-catalog-so-task-p/) |
| 260527-opp | Fix context card dynamic i18n strings (blank slide number) | 2026-05-27 | e8edc67 | [260527-opp-fix-context-card-dynamic-i18n-strings-no](./quick/260527-opp-fix-context-card-dynamic-i18n-strings-no/) |
| 260527-q1c | 精简 Ribbon 入口为单一 Aster 入口并在 Task Pane 内加用法提示 | 2026-05-27 | 83d19f9 | [260527-q1c-ribbon-aster-task-pane](./quick/260527-q1c-ribbon-aster-task-pane/) |
| 260529-vtc | 一键复制聊天记录 + Debug 信息（InputBar 剪贴板按钮，Key 不泄露守门） | 2026-05-29 | d534b92 | [260529-vtc-debug](./quick/260529-vtc-debug/) |
| 260530-b7s | 修复 AGENT-02 max_steps soft-landing 测试（per-turn 唯一工具名绕过熔断器） | 2026-05-30 | 9cffdbc | [260530-b7s-loop-test-ts-agent-02-max-steps-soft-lan](./quick/260530-b7s-loop-test-ts-agent-02-max-steps-soft-lan/) |
| fast | 移除 InputBar 冗余"复制操作记录"按钮（保留 SettingsPanel 入口 + lingui catalog 同步清理） | 2026-05-30 | 1b02f44 | — (gsd-fast inline，无 quick dir) |
| 260530-c14 | 复制调试信息按钮补齐操作记录能力（buildDebugReport 末尾拼接 buildStepLog：含 toolResult.data + redactKey 脱敏；新建 clipboard.ts 解 copyToClipboard 循环依赖） | 2026-05-30 | 951ff66 | [260530-c14-copytoclipboard](./quick/260530-c14-copytoclipboard/) |
| 260531-b5o | 修复 Settings 面板白屏（React #185 无限重渲染：偏好 selector 返回新对象 → 拆为个别 selector）+ SettingsPanel 冒烟测试守门（4 用例，真挂载不 mock store） | 2026-05-31 | e162985 | [260531-b5o-settings-react-185](./quick/260531-b5o-settings-react-185/) |
| 260531-bg2 | SettingsPanel「清空聊天记录」按钮加内联两步确认（防误点；点一次进确认态、点「确认」才 clearHistory、「取消」还原）+ 3 个守门用例 | 2026-05-31 | 7451a26 | [260531-bg2-settingspanel-clear-history-button-confi](./quick/260531-bg2-settingspanel-clear-history-button-confi/) |
| Phase 10-excel-ppt-b-excel-b-ppt P01 | 3min | 2 tasks | 2 files |
| Phase 10-excel-ppt-b-excel-b-ppt P02 | 9min | 2 tasks | 6 files |
| 260531-l4z | CR-01 Excel 列索引 >Z 非法地址修复（columnIndexToLetter helper：0→A/25→Z/26→AA/27→AB/701→ZZ；前向+restore 两处；4 守门用例） | 2026-05-31 | b509262 | [260531-l4z-cr-01-excel-z](./quick/260531-l4z-cr-01-excel-z/) |
| 260531-l7v | W1 部分失败 batch 通知熔断器（partialFailure 解耦：ok 保持 true 保留 undo，新增信号让 loop-helpers 走 recordFailure；appendOperation 未动；5 守门用例） | 2026-05-31 | 9f22588 | [260531-l7v-w1-batch](./quick/260531-l7v-w1-batch/) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v1 Phase 2.2 | FU-04 Excel for Web auto 写入回归补测 | Cancelled (v1 不发=验收意义减弱; v2 测试期重新覆盖) | 2026-05-28 (Q12) |
| requirement | ONB-01 / FUT-13 Onboarding GIF/动画 | **Cancelled** — 不进任何后续 milestone（2026-05-30 用户决定）；心智锚定由 chips(ONB-03)+中文 humanLabel(ONB-02)承担 | 2026-05-30 |

v2.1 Deferred（不在本 milestone，规划在 v2.2）:

| Category | Item | Status |
|----------|------|--------|
| B tools defer | EXCEL-D1 merge_cells / EXCEL-D2 remove_duplicates / EXCEL-D3 create_pivot_table | defer v2.2 |
| B tools defer | WORD-D1 高亮/列表/批注 / WORD-D2 edit_table/insert_image/页眉页脚 | defer v2.2 |
| B tools defer | PPT-D1 add_line/渐变填充 / PPT-D2 insert_table_ppt（spike S3 决定）/ PPT-D3 add_image | defer v2.2 |
| D tools defer | WSEL-D1 绝对字符偏移（Office.js 无原生 API） | defer v2.2 |
| v2.2 多模态 | MM-01 视觉/看图 / MM-02 文件上传解析 / MM-03 图片生成插入 / MM-04 公开图库检索 / MM-05 AiHubMix model 修正 | v2.2 独立 milestone |

## Session Continuity

Last session: 2026-05-31 — v2.1 Phase 9/10/11/12 顺序执行完成
Stopped at: Phases 8-12 code-complete + automation-green + TL-verified; local main, not pushed
Resume file: None

Next step: 用户真机 UAT（见本次会话合并 UAT 待办清单）→ 决定是否 push 部署 → `/gsd-execute-phase 13`（或 plan Phase 13）做端到端真机 UAT + 发布
