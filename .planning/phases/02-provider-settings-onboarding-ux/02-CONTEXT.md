# Phase 2: Provider 抽象 + Settings + Onboarding + 错误 UX - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段交付 Aster 全部「AI 调用进出口」，Phase 3-6 所有 AI 操作都走这里：

- 一份 `OpenAICompatibleLLM` 客户端（DeepSeek + 用户自定义 Provider 共用，仅 baseURL/apiKey/model 不同）
- aihubmix 视觉 + 生图客户端（专用路径，不复用 OpenAI-compatible）
- `ProviderRegistry.resolve(taskKind)` 路由（chat / short-task / vision / image-gen / stock-image，无自动 fallback）
- partitioned localStorage Key 管理（`Office.context.partitionKey` 分区）
- 首启 2 步 Onboarding
- 8 类错误 UX（KEY_INVALID / QUOTA / RATE_LIMIT / CONTEXT / NETWORK / FILTER / MODEL / IMAGE_QUOTA）
- SSE 流式（`src/lib/sse.ts` 原生 fetch + ReadableStream，首 token ≤ 2s）
- AbortController 取消 + visibilitychange 隐藏自动 abort + 同 Provider 单飞队列
- token 成本徽章
- 聊天历史（内存级，关闭 Task Pane 即清空）
- 「插入到文档」按钮（经宿主 Adapter 写回）

**不在本阶段:** 文件上传与解析器（Phase 3）；宿主业务杀手场景（Phase 4-6 的结构化写回、样式保留、公式、配图）。

**讨论范围:** 需求（PROV-01..10 / KEY-01..05 / COST-01..02 / PANE-02..04 / NFR-02..03 共 22 条）对工程实现已高度具体，本次讨论聚焦「用户怎么看到 / 怎么操作」的呈现层决策。
</domain>

<decisions>
## Implementation Decisions

### Onboarding（KEY-02 / KEY-03）
- **D-01:** Onboarding **可跳过**——允许用户不填 Key 先进入空态。未配 Key 时顶部持续显示「去设置填 Key」提示条；用户发送消息时才拦截并引导。不做强制阻断。（注：KEY-02 字面写「必填」，此处解读为「表单项必填才能完成填写」，而非「不填就锁死面板」。）
- **D-02:** 第 1 步默认 **Provider 预选 DeepSeek**（聊天主力）；DeepSeek Key 为主输入，aihubmix Key 作为视觉/生图的选填项。
- **D-03:** 第 2 步功能介绍卡 **只显示当前宿主一张**（PPT 里只看 PPT 卡），不三宿主全展示——聚焦且与 Task Pane 当前宿主绑定一致。
- **D-04:** Onboarding **首启自动弹一次**（localStorage 标记已看过）；设置里提供「重看引导」入口可手动重开。
- **D-05:** 隐私告知（KEY-03）落点 = 第 1 步填 Key 区域旁**内联常驻**文案：「你选中的文档内容会发送到所配置的 Provider」，不单独占一步。

### Settings 形态 + Provider 落点（PROV-05 / KEY-01,05）
- **D-06:** 设置页 = **整页从右侧滑入覆盖**整个 Task Pane，顶部带返回。350px 窄面板里最清晰、给表单足够纵向空间、不与聊天争屏。
- **D-07:** **Provider 切换归设置管理，输入栏不放下拉。** Provider 增删改、Key 管理、默认 Provider 选择全部在设置里完成；输入栏只保留 输入框 + 上传 + 发送。
  - ⚠️ **修订 PANE-01：** PANE-01 原文写「底部输入框 + 文件上传图标 + **Provider 切换下拉**」。此决策去掉输入栏的 Provider 下拉（与 Phase 1 已落地代码 `InputBar.tsx` 一致）。规划与执行须以本决策为准；建议同步更新 REQUIREMENTS.md PANE-01 文字。
- **D-08:** 自定义 OpenAI-compatible Provider 录入表单 = **只要 `baseURL` + `apiKey` + `model` 三字段**，不收单价，model 手填（不做 GET /models 自动拉取）。
- **D-09:** 内置 DeepSeek / aihubmix **单价写死不可改**（预填 CLAUDE.md 官方单价），用户不能覆写。

### 错误 UX 呈现（PROV-08 / PROV-09）
- **D-10:** 错误主体 = **聊天流里的「失败气泡」内联呈现**（警示色），承载 错误文案 + CTA + 重试。不用顶部 banner / toast——上下文不丢，用户清楚是哪条消息失败。
- **D-11:** 失败消息 **留在聊天历史**，原 prompt 不丢失；失败气泡带「重试」按钮，点击原地重发同一 prompt。
- **D-12:** CTA **深链到设置对应项**——如 401 的「去设置 →」直接打开设置并定位到出问题那个 Provider 的 Key 字段，而非只打开设置首页。
- **D-13:** 8 类错误文案 = **每类一句明确中文原因 + 一个可操作 CTA**（如「DeepSeek Key 无效，去设置 →」），贴 PRD F7。不做折叠技术详情层。

### 聊天交互 + 成本徽章（PANE-02,04 / COST-01,02）
- **D-14:** 流式生成中的「停止」键 = **发送键原地变停止方块**（同位置），生成完变回发送键。不增独立停止控件。
- **D-15:** 当前选区**默认自动附带**给每条消息（PPT 第 N 张 slide / Excel 选区地址 / Word 选中字数，复用 Phase 1 `getSelection()`）。
  - 设计要求：选区胶囊要**简洁、不打扰**（用户明确反馈：胶囊别太抢眼）；胶囊上提供去掉当前附带的 ×；并提供一个**开关可整体关闭自动附带**功能。
- **D-16:** 「插入到文档」按钮在 Phase 2 = **三宿主 adapter 都实现最小 `text` 插入**，按钮真能把纯文本写回当前文档（打通 SC6，把 Phase 1 抛 `UnsupportedOperationError` 的 `insert()` 桩替换为至少 `type:'text'` 可用）。结构化内容（slides/formula/range-values）与样式保留留 Phase 4-6。
- **D-17:** 成本徽章 = **¥ 人民币**，DeepSeek 官价为 USD，用**内置固定汇率**换算成 ¥ 显示；徽章只显「本次：N token · ¥X」总数，**不拆 prompt/completion**。
  - ⚠️ **修订 COST-02：** COST-02 原文「自定义 Provider 可在 Settings 输入单价」与 D-08/D-09 冲突，已被覆盖——自定义 Provider 不录单价，其成本徽章**只显「N token」不显价格**；只有内置 DeepSeek / aihubmix 显「N token · ¥X」。

### Claude's Discretion（授权按合理默认处理，研究/规划时定）
- 内置 USD→CNY 固定汇率的**具体数值**与是否在徽章旁标注「约」字——研究阶段定一个合理常数（如 7.2），不引入实时汇率 API（违反无后台）。
- `ProviderRegistry` 路由表的内部数据结构、单飞队列的实现细节、指数退避的初始间隔/上限——research + planner 按 PROV-04/07/09 定。
- SSE 解析器 `src/lib/sse.ts` 的具体实现（约 40 行 fetch + ReadableStream，`[DONE]` 检测、JSON line decode）。
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与目标（Phase 2 的「SPEC」）
- `.planning/ROADMAP.md` — Phase 2 Goal + 6 条 Success Criteria（SC1-SC6 是验收锚点）+ 依赖
- `.planning/REQUIREMENTS.md` — PROV-01..10 / KEY-01..05 / COST-01..02 / PANE-02..04 / NFR-02..03（22 条，接口成员、错误类、storage scope 均已枚举）
  - ⚠️ 注意本 CONTEXT 修订了两条：**PANE-01**（Provider 下拉移出输入栏，见 D-07）、**COST-02**（自定义 Provider 不录单价，见 D-17）
- `.planning/PROJECT.md` — Core Value（无后台 / BYO Key / Key 不离开浏览器）、技术栈表（DeepSeek/aihubmix API 细节、SSE、Zustand、自写 CSS 设计系统）
- `prds/2026-05-26-aster-office-addin/PRD.md` — F6（流式）/ F7（错误 UX）/ N4-N5（隐私告知）/ AC4,AC6,AC8 出处

### Phase 0 spike 关键结论（锁定多模态路径）
- `.planning/spikes/MANIFEST.md` — 10 项 spike 总览；**#4 DeepSeek-V4 多模态 FAIL → 视觉/生图唯一路径锁 aihubmix**（PROV-03 的硬约束来由）；GATING #1 CORS 已验证可从生产 Task Pane 直连 DeepSeek + aihubmix
- `.planning/spikes/MANIFEST.md` — #5 API 混用挂死规避规则（Phase 4+ 相关，Phase 2 不直接触及但路由设计需知晓）

### Phase 1 已交付底座（Phase 2 直接消费）
- `.planning/phases/01-foundation/01-CONTEXT.md` — Phase 1 全部决策（D-01..D-17），尤其 D-06/07/08（shell 三段布局 + Provider/上传占位禁用，Phase 2 填逻辑）、D-12/13/14（selection-changed 实时监听）
- `src/adapters/DocumentAdapter.ts` — `DocumentAdapter` 接口 + `SelectionContext`（4 变体）+ `InsertableContent`（7 变体）+ `AdapterCapabilities`；Phase 2 `insert()` 从桩→至少 text 可用
- `src/errors/index.ts` — 已定义 `KeyInvalidError`/`QuotaExceededError`/`ContextTooLongError`/`NetworkError`（Provider 层）+ `HostApiError`/`UnsupportedOperationError`（Adapter 层）；Phase 2 补齐 RATE_LIMIT/FILTER/MODEL/IMAGE_QUOTA 四类
- `src/styles.css` + `src/components/icons.tsx` — 自写 CSS 设计系统（CSS 变量 light/dark）+ 内联 SVG 图标；新增 UI 一律走此系统
- `CLAUDE.md` §UI 设计系统 — 美观优先、品牌渐变只作 accent、不回退组件库；DeepSeek/aihubmix API 与单价表
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/adapters/{Ppt,Excel,Word}Adapter.ts` — 三宿主骨架，`getSelection()`/`onSelectionChanged()` 真实可用；Phase 2 在此实现最小 `insert({type:'text'})`（D-16）。
- `src/context/AdapterContext.ts` + `useAdapter()` — React Context 暴露当前宿主 adapter，聊天附带选区（D-15）与插入写回（D-16）都经此取 adapter。
- `src/errors/index.ts` — 错误类层级现成，Phase 2 在 Provider 调用路径抛这些类，UI 按 `code` 映射 8 类 UX（D-10..D-13）。
- `src/components/{InputBar,ChatStream,ContextCard}.tsx` — Phase 1 全禁用占位；Phase 2 填逻辑不改布局（D-06 Phase 1 / shell 已定）。InputBar 已是「无下拉」形态，与 D-07 一致。
- `src/styles.css` 设计系统 + `icons.tsx` — 失败气泡、成本徽章、设置滑入页、Onboarding modal、选区胶囊全部用现有 CSS 变量 + 内联 SVG。
- `zustand` 已装但**尚无 store** — Phase 2 是首个引入客户端状态的阶段（聊天历史、当前 Provider、流式状态、Key 配置）；按技术栈表用 Zustand 建 store。

### Established Patterns
- Office.js 走 CDN，不进 bundle；`Office.context.partitionKey` 做 localStorage 分区（KEY-01）。
- 主题随 Office 宿主：`main.tsx` 读 `officeTheme` 设 `#root` data-theme；新 UI 两套主题都要顾。
- 所有 UI 字符串用 Lingui macro 包裹（zh-CN only）。
- LLM 调用用原生 fetch + ReadableStream，不引 SDK（PROV-06 / 技术栈表）。

### Integration Points
- `DocumentAdapter.insert()` — 「插入到文档」按钮的写回出口（D-16）。
- `getSelection()` / `onSelectionChanged()` — 聊天选区自动附带的数据源（D-15）。
- partitioned localStorage — Key 与 Provider 配置、Onboarding「已看过」标记、自动附带开关偏好的持久化处（KEY-01/05）。
- 顶部齿轮按钮（`App.tsx` 现为 disabled 占位）— Phase 2 接通，打开整页滑入设置（D-06），并作为错误 CTA 深链目标（D-12）。
</code_context>

<specifics>
## Specific Ideas

- 用户对**选区胶囊**有明确审美要求：默认自动附带没问题，但胶囊要「简洁一点，不然有点打扰」——做小、低调，且给用户一个能整体关闭自动附带的开关（D-15）。
- 整体倾向 ChatGPT 式的成熟聊天交互直觉：发送键原地变停止（D-14）、失败消息留历史可原地重试（D-10/D-11）。
- 两处对需求的有意修订（D-07 改 PANE-01、D-17 改 COST-02）都是用户在被明确告知冲突后拍板的，不是无意偏离。
</specifics>

<deferred>
## Deferred Ideas

- **Onboarding 内联 Key 校验**（保存 Key 时发 1-token 测试请求即时告知有效/无效）— 已在 REQUIREMENTS v2 列为 ONB-01，v1.0 明确不做。
- **聊天历史本地持久化（IndexedDB）** — v1 内存级（PANE-03），v1.1 评估（PERS-01）。
- **结构化插入与样式保留写回**（slides/formula/range-values + Word 样式保留）— Phase 4-6 杀手场景。
- **实时汇率** — 不引入（无后台约束）；内置固定汇率即可。

### Reviewed Todos (not folded)
None — 无 pending todo 匹配本阶段（`todo.match-phase` 返回 0）。
</deferred>

---

*Phase: 02-provider-settings-onboarding-ux*
*Context gathered: 2026-05-27*
