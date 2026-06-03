---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: 多模态四件套
status: archived
stopped_at: v2.2「多模态四件套」已发布并归档（tag v2.2，线上 0d5fccf）。6 phases（14–19）/ 25 plans / 22/22 需求 / 三宿主真机 UAT 全 PASS。ROADMAP 折叠归档、REQUIREMENTS 存档至 milestones/v2.2-REQUIREMENTS.md（根 REQUIREMENTS.md 已 git rm，待 /gsd-new-milestone 重建）、MILESTONES.md + RETROSPECTIVE.md + PROJECT.md 收官更新。下一步：/gsd-new-milestone 或 /gsd-review-backlog。
last_updated: "2026-06-03"
last_activity: 2026-06-03 -- v2.2 milestone 收官归档（/gsd-complete-milestone）：ROADMAP 折叠 + REQUIREMENTS 存档 + MILESTONES/RETROSPECTIVE/PROJECT 更新；tag v2.2 此前已打
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 25
  completed_plans: 25
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-03 — Milestone v2.2「多模态四件套」收官归档)

**Core value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 **AI 代理** 能力，能完成绝大部分文档工作；无后台、BYO Key。
**Current focus:** v2.2「多模态四件套」已发布并归档 ✅（tag v2.2，线上 0d5fccf）。**当前无活跃 milestone**——下一步 `/gsd-new-milestone` 启动新里程碑，或 `/gsd-review-backlog` 处理 backlog。

## Current Position

Phase: 19 (release/uat) — ✅ COMPLETE（v2.2 SHIPPED 2026-06-03）
Plan: not applicable（Phase 19 = 真机 UAT + 发布，不规划 PLAN）
Status: v2.2 全 6 phase done；真机 UAT 全 PASS（见 `phases/19-release/19-UAT-PACKET.md` UAT 结果栏）；tag v2.2 已推送
Last activity: 2026-06-03 -- Completed quick task 260603-fx8: 修复 2 个 Excel adapter bug（batch_write 子操作分派 + sheet-qualified 地址解析）

### v2.2 Phase List（详见 ROADMAP.md）

| Phase | Goal | Requirements | Depends |
|-------|------|--------------|---------|
| **14** MDL Provider 重写 + PPT casing 根治 | aihubmix-image 三路解析 + model 清单 + dispatch 层 casing 归一化 | MDL-01/02/03 (3) | — |
| **15** VIS 视觉看图 | 看选中图作 evidence（read tool）+ aihubmix-vision | VIS-01/02, NFR-09 (3) | 14 |
| **16** IMG 图片生成插入 | PPT/Word 生图 AI 自动直插 + 只读结果卡 + model 可选 | IMG-01~05 (5) | 14 |
| **17** FILE 文件上传解析 | docx/xlsx/pdf/pptx/图片 懒加载解析 + 附件边界 | FILE-01~07, NFR-10 (8) | 15 |
| **18** LIB Pexels 图库检索 | BYO key 检索 + 选中插入 + 署名 | LIB-01/02/03 (3) | 16 |
| **19** v2.2 UAT + Release | 四件套三宿主真机 UAT + tag v2.2 | （全 22 需求 UAT；0 独立新需求） | 14–18 |

**Phase Dependencies:** 14 →（15 ∥ 16）→ 17（依赖 15 vision）→ 18（依赖 16 insert helper）→ 19（依赖全部）。单人串行推荐 14→15→16→17→18→19。

**Coverage:** 22/22 ✓（REQUIREMENTS.md §Traceability：14:3 / 15:3 / 16:5 / 17:8 / 18:3）

### Progress Bar

[████████░░] 83% — **v2.2 实现全部收口（Phase 14-18 = 5/6 phase done）**，仅剩 Phase 19 真机 UAT + 发布（留用户）。Phase 18 LIB 全 3 plans 交付 + code-review（**无 HIGH、无需修正错误**；1 MEDIUM 设计缺口 M-1「取图 full-res CORS 缺口」延 Phase 19、3 LOW 报告）。里程碑级 gate 全绿快照（2026-06-03）：**885 tests pass（72 files）/ main 80.53KB gzip ≤82KB（余量 1.47KB）/ tsc exit0 / 生产 `npm audit --omit=dev` 0 漏洞 / 0 净新增运行时依赖**。25/25 plan 完成（14:6+15:5+16:5+17:6+18:3）。注：frontmatter percent=83 = phase 完成度（5/6）；Phase 19 = 真机 UAT + 发布，不规划 PLAN，不计入 total_plans。延后真机项已全部汇总至 `phases/19-release/19-UAT-PACKET.md`（含置顶 2 高危：pdf.js worker CSP + Pexels 双重 CORS 含 M-1 取图面）。Phase 15/16 已于 2026-06-02 真机 UAT PASS（仅 Edge），Phase 19 需 Chrome 回归 + Phase 17/18 首次真机。

### v2.2 启动期已知输入

- **生图三模型已实测**（`.planning/spikes/011-image-gen-api-formats/findings.md`）：`doubao-seedream-5.0-lite`（predictions/URL）+ `gpt-image-2`（predictions/base64，output 是对象 `{b64_json,urls}`）+ `gemini-3.1-flash-image-preview`（Gemini streamGenerateContent/base64，`x-goog-api-key` 头）。三套 wire format + 两套鉴权，MM-03 需按模型分发解析。
- **v2.1 已知限制延续**：PPT copy_slide 网页版 `Slide.copy()` 微软接口天生不支持（转 v2.2/桌面版）；PPT 工具 snake/camel casing 技术债（双键容错兜住，根治候选）。

> v2.1 收尾快照（phase 8–13 全 PASS、773 tests、75.03 KB、三宿主真机 UAT 全 PASS、tag `v2.1`）已归档至 `.planning/milestones/v2.1-ROADMAP.md` + `MILESTONES.md`。

## Performance Metrics

**Velocity (v2.2):** Phase 14（P01 2tasks/5files、P05 1task/3files）+ Phase 15（P01 2tasks/4files、P04 2tasks/1file）+ Phase 16（P01 11min/2tasks/5files、P02 ~20min/2tasks/3files、P03 ~12min/2tasks/9files、**P04 ~5min/2tasks/7files**）。main bundle 78.12 KB gzip（≤82KB 门内；新增 1 个 settings select + 1 段 CSS，+0.09KB）。

**历史参考：** v2.1 = 6 phases / 27 plans / 75.03 KB bundle（2026-06-01）；v2.0 = 6 phases / 53 plans / 295 commits / 73.42 KB bundle（首次公开发布 2026-05-30）。

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
- [Phase ?]: D-01 落地：ImageGenResult = { base64 + mimeType }，裸 base64，贴合 Office.js 三宿主插图 API（14-01）
- [Phase ?]: Wave 0 TDD 脚手架：fixture-based 单测先建，CI 不打真 API，Plan 05 实现后变绿（14-01 D-15）
- [Phase ?]: analyzeImages 不暴露 focus 参数：focus 由调用方在 userText 内拼接传入，签名保持 (userText, images, config)，向后兼容最简
- [Phase ?]: attachments.test.ts 用 describe.skip 而非动态 import：避免 tsc strict Module Not Found 错误，Wave 0 语义完整
- [Phase ?]: VisionImage interface export 给下游 Plan 02/03 直接 import，无需重复声明
- [Phase 16-02]: PPT addImageShape 保持 GA 实现（addGeometricShape('Rectangle') + fill.setImage 裸base64 + 独立 run 回读），真机 spike PASS 无需 fallback
- [Phase 16-02]: fill.setImage / insertInlinePictureFromBase64 接受裸 base64（无 data: 前缀）——真机实测确认，insertImage helper 透传裸格式不拼前缀（推翻 RESEARCH A5 的 data URL 假设分支）
- [Phase 16-02]: bug #5022 由两次独立 PowerPoint.run 规避（第一次创建+填充、第二次回读），真机实测 setImage sync 不卡死；Word body 级规避 range 级 bug #3434（pic w/h=0.75pt 即成功）
- [Phase 16-02]: insertImage reverse.args 用 snake_case（slide_index/shape_id Record 对象），postState.content 用 camelCase（slideIndex/shapeId）——与 D-17 analog + Phase 16 integration 守门一致
- [Phase 16-03]: 生图工具 D-02 解耦——execute 只调 AihubmixImageClient.generate 返回 {base64,mimeType,prompt,preview_pending:true}，不写文档、reverse=undefined；插入由 Plan 16-05 预览卡按钮触发 insertImage helper（届时手动 appendOperation 设 reverse）
- [Phase 16-03]: ProviderRegistry.resolve('image-gen', getDefaultLLM) 的 image-gen case 不调用 getDefaultLLM（直接读 storage aihubmix key）；工具层传 `() => {throw}` 虚拟函数，避免为不被调用的参数改 ToolExecContext 接口（该接口无 getDefaultLLM 字段）
- [Phase 16-03]: AihubmixImageClient D-08 真取消最小侵入——ImageGenOptions 新增可选 signal?: AbortSignal，generate→3 私有方法（doubao/gpt-image-2/gemini）→fetchUrlToBase64 逐层透传 signal 给 fetch；旧调用 generate(prompt,config) 向后兼容
- [Phase 16-03]: 生图工具错误三态——缺 prompt→INVALID_ARGS(可恢复)；KeyInvalidError→PERMISSION_DENIED(不可恢复，T-16-08 字面量 message 防 key 泄漏)；网络/超时/AbortError/未知 model→HOST_API_FAILED(可恢复)
- [Phase 16-03]: IMG-05 per-host 注册——generate_ppt_image 入 PPT_TOOLS Set（casing 归一化）+ ppt case；generate_word_image 仅 word case；excel case 不注册（Excel 无原生插图 API）；工具数 Word 17→18、PPT 19→20
- [Phase 16-04]: PREF_IMAGE_GEN_MODEL='aster:pref:image-gen-model'——Settings model picker 写入 + registry image-gen resolve 读取覆盖默认 doubao（缺省回退 DEFAULT_IMAGE_GEN_MODEL.id）；与 16-03 工具层三级优先级闭环（args.model_id > storage PREF > registry 默认）
- [Phase 16-04]: registry image-gen case 最小侵入扩展——仅 +1 行 storage.get(PREF) + fallback，model 字段从硬编码改 preferredModel ?? DEFAULT；不动 resolve 签名/其他 case
- [Phase 16-04]: .aster-settings__select 新建仿 .aster-settings__pref-input，CSS 变量以线上 styles.css 为准（--space-N/--radius-1，非 PLAN 示例的 --sp-2/--radius-2）；teal 焦点 ring，aster-design-system 克制风格
- [Phase ?]: worker fallback：new URL 方案 Vite 7+pdfjs 未 emit；改 public/pdf.worker.min.mjs + 静态路径 /Aster/

### Roadmap Evolution

- Phase 04.1 inserted after Phase 4 (2026-05-29): Aster redesign migration — UI 设计系统迁移到 teal 克制方向 (URGENT)。canonical_ref = `.planning/design/aster-redesign/`（INDEX.md 第 48 行预埋此插入）。范围：token 迁 teal `#009887` + 暖白底 `#FAFAF8`、去玻璃拟态/渐变、重写 `styles.css`、重皮组件、按新语言补设计 agent 运行时面、更新 CLAUDE.md §UI 设计系统 + 记忆 `feedback_beauty_over_fluent` + 标 `01-UI-SPEC.md` 过时、丢掉 cost、`/gsd-sketch-wrap-up` 固化 project design skill 供 Phase 5/6 消费。Phase 4 仍按现有设计系统建，迁移在 4 完成后进行。
- v2.1 Phases 8–13 created (2026-05-30): 42 需求全覆盖（A:3/Word:5/Excel:10/PPT:8/C:2/D:1/E:6/F:4/NFR:3）；6 个 phase 按研究 SUMMARY.md 8a–8f 概念映射为顺序编号 8–13；硬依赖约束已保留（8→9→10→11；12 可并行；13 最后）。

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

- `builtin-model-dropdown`（high）— **陈旧/已交付**：已由 v2.0 CARRY-02「内置 Provider model 下拉」交付，todo 文件未移走。v2.2 若 MM-05 调整 model 清单可顺手清理此 todo。

### Blockers/Concerns

[Issues that affect future work]

v2.1 的 spike blockers（S1–S7）均已在 v2.1 执行期 resolved。v2.2 待 research/spike 解决的开放点：

- **MM-01 视觉**：DeepSeek-V4 是否原生多模态（原 Q6）vs 走 aihubmix-vision；视觉消息内容格式（`image_url` content part）+ 选区图片/图表如何取成可发送的 base64/URL。
- **MM-02 文件解析**：mammoth/SheetJS/pdfjs/pptx 懒加载对 bundle CI gate（≤82KB gzip）的影响 + 0 净新增运行时依赖原则的权衡（这些解析库会是净新增依赖，需评估）；「附件」vs「agent 自取当前文档」UX 边界。
- **MM-03 生图插入**：三模型三套 wire format（spike 011 已实测）；URL vs base64 内部统一表示；Office.js 三宿主插图 API（PPT `shapes.addImage` / Word `insertInlinePictureFromBase64`）+ undo/reverse 策略；生图不可流式 → loading UX。
- **MM-04 图库**：Unsplash vs Pexels（原 Q1）API 限额/中文搜索质量/商用授权 spike 对比。
- **技术债候选**：PPT 工具 snake/camel casing 中央归一化根治（双键容错兜住，根治=dispatch 层归一化）。

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
| 260531-m4x | 修复 3 个 PPT spike 工具网页版「假成功」：对齐换正确属性 horizontalAlignment（.alignment 不存在）、背景换 setSolidFill（SlideBackgroundFill 无 setSolidColor）、三工具加写后回读验证（!effective→诚实失败不报✅不记undo）、修 rotate_shape humanLabel undefined（snake/camel 键名容错）；adapter+工具+集成3层测试守门 | 2026-05-31 | 3a0bf09 | [260531-m4x-fix-ppt-spike-false-success](./quick/260531-m4x-fix-ppt-spike-false-success/) |
| 260601-dul | PPT 真机 UAT 两修复：① getSelection 额外读 getSelectedShapes（PowerPointApi 1.5）带出 selectedShapeId/Ids/Type，agent 精确定位不再 list 全部猜（typeof 守门+降级不回归）；② 三工具写后回读「假失败」修复——改为仅「回读==旧值且旧值≠目标」确凿 no-op 才判 effective:false，回读 null/读不到一律判生效（对齐 horizontalAlignment、背景 fill.type vs Solid、旋转容差0.5）；adapter 级 mock 单测 7 条守门。仍需真机复测 | 2026-06-01 | 4381e01 / a8bad44 | [260601-dul-ppt-uat-id-type](./quick/260601-dul-ppt-uat-id-type/) |
| 260601-ki6 | 优化 README：新增居中视觉头部（logo 120px + h1 + tagline + 2 个 teal badge：宿主 + 在线 sideload 链向 Pages）+ docs/aster-logo.png 资产；去除旧头部三行重复，正文 8 章节零删减 | 2026-06-01 | ef5e593 | [260601-ki6-readme-logo-badge](./quick/260601-ki6-readme-logo-badge/) |
| Phase 14 P01 | 2 | 2 tasks | 5 files |
| Phase 14 P05 | 15min | 1 tasks | 3 files |
| Phase 15-vis P15-01 | 4 | 2 tasks | 4 files |
| Phase 15-vis P04 | 8min | 2 tasks | 1 files |
| Phase 17-file P02 | 20 | 2 tasks | 11 files |
| Phase 17 P04 | 10min | 2 tasks | 3 files |
| Phase 17 P05 | 15min | 2 tasks | 7 files |
| 260603-fx8 | 修复 2 个 Excel adapter bug：① executeBatch 无视 op.tool 把所有子操作当 set_range_values，导致 batch_write 含 apply_formula/set_cell 必从 index 0 失败 → 改按 op.tool 分派（switch writeKind，仍 2-sync，reverse.args 仍 Record）；② 全部 range 走 getActiveWorksheet().getRange() 不接受「表名!A1」前缀 → 抽 resolveRange/resolveRangeOrNull helper 解析 sheet-qualified 地址（含引号表名+''转义），15 处 getRange 站点统一替换。守门：batch.test 9 绿 + integration 47 绿 + 全套 892 绿 + tsc 0 | 2026-06-03 | f67c29b | [260603-fx8-excel-adapter-bug-batch-write-sheet-qual](./quick/260603-fx8-excel-adapter-bug-batch-write-sheet-qual/) |

## Deferred Items

Items acknowledged and deferred at **v2.2 milestone close on 2026-06-03** (artifact audit `audit-open`，23 项)。经逐项核对：**全部为陈旧簿记或已被里程碑级 UAT 覆盖，0 真正未完成的工作**（v2.2 已三宿主真机 UAT 全 PASS + 上线 tag v2.2）。

| Category | Item | Status |
|----------|------|--------|
| debug | ppt-list-slides-host-fail / reasoning-content-roundtrip | 均 fix-applied + 已部署（2026-05-29）；状态位未翻，实际已解（v2.0/v2.1 已确认） |
| quick_task | 14 项（260527-o8j / opp / q1c · 260529-vtc · 260530-b7s / c14 · 260531-b5o / bg2 / l4z / l7v / m4x · 260601-dul / ki6 · 260603-fx8） | 均已完成有 commit（见上方 Quick Tasks 表）；目录缺 status 文件的扫描器怪癖。新增唯一 260603-fx8（Excel adapter bug，commit f67c29b）已交付 |
| todo | builtin-model-dropdown（high） | 已由 CARRY-02「内置 Provider model 下拉」v2.0 交付；todo 文件未移走 |
| uat_gap | 04-UAT-EVIDENCE / 07-UAT-CHECKLIST / 07-UAT-REPORT | 属 v2.0（已发布归档），`open_scenario_count: 0` |
| uat_gap | 09-HUMAN-UAT（2）/ 10-HUMAN-UAT（4） | 属 v2.1，partial 场景已被 Phase 13 里程碑级 UAT 实测覆盖；文件状态位未翻 |
| uat_gap | 19-UAT-PACKET | v2.2 Phase 19，真机 UAT 实测全 PASS（HR-1/HR-2 + 四件套冒烟），`open_scenario_count: 0`，状态位未翻 |

> **第四次复发提醒：** stale-checkbox / status 字段缺失 / uat 状态位未翻 已是跨 v1.0/v2.0/v2.1/v2.2 四次 milestone close 的确定模式（memory `recurring_failure_add_gate` / `project_gsd_tooling_quirks`）。「同一故障 ≥2 次加结构性守门」原则在 GSD 收尾簿记上至今未兑现——确定待还债。

---

Items acknowledged and deferred at v2.1 milestone close on 2026-06-01 (artifact audit `audit-open`)。经逐项核对：**全部为陈旧簿记或已被 Phase 13 里程碑级 UAT 覆盖，0 真正未完成的工作**（v2.1 已三宿主真机 UAT 全 PASS + 上线）。

| Category | Item | Status |
|----------|------|--------|
| debug | ppt-list-slides-host-fail | fix-applied + 已部署（2026-05-29）；状态位未翻，实际已解 |
| debug | reasoning-content-roundtrip | fix-applied + 已部署（2026-05-29）；状态位未翻，实际已解 |
| quick_task | 260527-o8j / 260527-opp / 260527-q1c / 260529-vtc / 260530-b7s / 260530-c14 | 均已完成有 commit（见 STATE Quick Tasks 表）；目录缺 status 文件的扫描器怪癖 |
| quick_task | 260531-b5o / 260531-bg2 / 260531-l4z / 260531-l7v / 260531-m4x / 260601-dul | 同上——均已完成有 commit，status 字段缺失 |
| uat_gap | 04-UAT-EVIDENCE / 07-UAT-CHECKLIST / 07-UAT-REPORT | 属 v2.0（已发布归档），`open_scenario_count: 0` |
| uat_gap | 09-HUMAN-UAT（2 pending）/ 10-HUMAN-UAT（4 pending） | uniqueLocalId / find_replace undo / S1/S2/S4/S7 spike 场景已在 v2.1 真机 UAT 实测通过；文件状态位未翻 |
| todo | builtin-model-dropdown（high） | 已由 CARRY-02「内置 Provider model 下拉」v2.0 交付；todo 文件未移走 |

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
| PPT Web 限制 | copy_slide 网页版 `Slide.copy()` 微软接口不支持（诚实失败）；set_shape_text_alignment/set_slide_background 真机已验生效但属高风险面 | 转桌面版验证（v1.1 范围）/ v2.2 复核 |
| 技术债根治 | PPT 工具参数 snake/camel 不一致——已加双键容错兜住，根治=dispatch 层中央 args 归一化或统一 casing（见 memory project_ppt_officejs_gotchas） | defer v2.2 |

## Session Continuity

Last session: 2026-06-03
Stopped at: **v2.2 milestone 收官归档（/gsd-complete-milestone）** — ROADMAP 折叠 + REQUIREMENTS 存档至 milestones/v2.2-REQUIREMENTS.md（根 REQUIREMENTS.md 已 git rm）+ MILESTONES/RETROSPECTIVE/PROJECT 收官更新 + artifact audit 23 项 acknowledge。tag v2.2 此前真机 UAT 后已打（线上 0d5fccf）。
Resume file: None

Next step: **当前无活跃 milestone**。启动新里程碑 `/clear` 后 `/gsd-new-milestone`（questioning → research → requirements → roadmap，REQUIREMENTS.md 会重建）；或 `/gsd-review-backlog` 处理已识别的增强项（v2.1 B 工具 defer + v2.2 IMG-D1/D2 / FILE-D1 / LIB-D1 / VIS-D1）。
