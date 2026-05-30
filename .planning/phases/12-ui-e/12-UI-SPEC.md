---
phase: 12
slug: ui-e
status: draft
shadcn_initialized: false
preset: none
created: 2026-05-31
mode: --auto (Claude 替挑剔用户拍默认；逐条 flag【待复核】)
design_system: teal-quiet (frozen, real-machine UAT PASS 2026-05-29)
---

# Phase 12 — UI Design Contract (UI 打磨 E)

> 在**已冻结、真机 UAT PASS 的 teal 克制设计系统内**做精修——不是新视觉方向。
> 设计真相源：`src/styles.css`（像素级真相，优先于设计稿）+ `aster-design-system` skill。
> 本 SPEC 把 6 项需求（UI-01..06）落成可测试的视觉/交互合约；所有【待复核】项是 `--auto` 下 Claude 替用户拍的默认值，等用户回来纠偏。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none（自写 CSS 设计系统，非 shadcn/Fluent/AntD/MUI——铁律，永不回头） |
| Preset | not applicable |
| Component library | none（内联手写组件 + CSS 类） |
| Icon library | 内联 SVG `src/components/icons.tsx`（Lucide 风，`stroke=currentColor`，strokeWidth 1.5） |
| Font | Inter + Noto Sans SC（`--font-body`）/ JetBrains Mono（`--font-mono`，时间戳/代号/code/URL） |
| 样式落点 | 全部走 `src/styles.css` + CSS 变量 `[data-theme="light\|dark"]`；禁硬编码 hex/px、禁内联 style 传色（**唯一例外：UI-06 骨架屏内联 CSS，见 §UI-06**） |

**Registry Safety:** not applicable —— 无第三方 registry，无 shadcn，本阶段 0 净新增运行时依赖（NFR-06 bundle ≤82KB，当前 ~74.56KB 余量小）。

---

## Spacing Scale（复用既有 token，非新造）

线上 `:root` 已规整为 `--space-1..6`；本阶段所有新增间距**必须复用**，禁散落 px。

| Token | Value | 本阶段用途 |
|-------|-------|-----------|
| `--space-1` | 4px | 三点间隙、cell padding 纵向、骨架行间小隙 |
| `--space-2` | 8px | 表格上下 margin、卡内 gap、骨架块间距 |
| `--space-3` | 12px | 卡 padding 横向、消息行间 |
| `--space-4` | 16px | 气泡间距（`.aster-messages` gap，UAT 定）、面板内距 |
| `--space-5` | 20px | 列表缩进基准（`ul/ol padding-left:20px` 既有） |
| `--space-6` | 24px | 空态/骨架顶部 header 区 |

Exceptions（本阶段允许的非 scale 微值，均沿用既有约定）：
- 表格 cell padding `6px 8px`（D-11，**【待复核】**数值）——既有气泡内已有 `9px 13px`/`8px 10px` 类非 scale 微值先例。
- 三点跳动圆点直径 `4px`（= `--space-1`）。
- 骨架屏内联值（§UI-06）独立，不引用 token（早于 CSS 加载）。

---

## Typography（复用既有字号阶，非新造）

线上字号阶只有 11/12/13/14/16/18（**无 fs-15**，照搬设计稿会引用不存在变量）。

| Role | Size | Weight | Line Height | 本阶段用途 |
|------|------|--------|-------------|-----------|
| Body（气泡正文） | `--fs-14` 14px | 400 | 1.55（既有 `.bubble`） | AI 气泡 markdown 正文（UI-02 思考气泡复用） |
| 表格内文 | `--fs-13` 13px | 400 / th 600 | 1.4 | UI-04 `.bubble-ai table`（**【待复核】**13px） |
| code/pre/mono | `--fs-12` 12px | 400 | 1.5 | UI-04 代码块/内联 code（既有，仅审计一致性） |
| 工具卡文字 | `--fs-12` 12px | 400 | 1.5 | UI-05 read 卡 humanLabel（既有 `.wb-action-head`） |
| 时间戳/代号 | `--fs-11` 11px | 400 | nowrap | 既有，不改 |

**禁止**：新引字号、引用 `--fs-15`、给 read 卡降权用「更小字号」时不得跳出 11/12（D-15 推荐沿用 `--fs-12` + 字色降权，不缩字号——**【待复核】**降权是否含缩字号）。

---

## Color（teal 克制，单一品牌色，全变量驱动）

| Role | Value（变量） | Usage |
|------|--------------|-------|
| Dominant (60%) | `--bg` / `--surface` = `#FFFFFF`（light）/ `#0E0E10`（dark） | 聊天底、面板底 |
| Secondary (30%) | `--surface-2` `#F3F2EE`/`#1F1F21`、`--surface-3`、`--bubble-ai-bg` `#EEEEF0`/`#1F1F23` | AI 气泡、表头底、code 底、卡面 |
| Accent (10%) | `--accent` teal `#009887`（light）/ `#4FC9B8`（dark） | **仅** 见下「Accent reserved for」 |
| Destructive | `--error` `#DC2626`/`#F87171`（dark 提亮）+ `--error-soft` | 错误卡 stripe / 错误行字色（本阶段不新增 destructive 动作） |
| 降权文字 | `--text-3` `#92908A`/`#6E6E76` | UI-05 read 卡字色、时间戳、source 行 |
| 边框 | `--border` `#E7E5DF`/`#26262A` | UI-04 表格 cell border、卡边框（read 卡去此边） |

**Accent reserved for**（本阶段 teal 只允许出现在这些地方，不得溢出）：
- 用户气泡实底（既有，不改）
- soft-landing 卡描边 + DiffLogPanel「已撤销」badge（既有，不改）
- focus ring `--ring-focus`（所有新可聚焦控件统一）
- ❌ **思考气泡三点不得用 teal**（D-07：用 `--text-3`，克制不喧宾夺主）
- ❌ **read 卡降权不得引入任何新彩色**（D-16：靠 `--text-3` + 去边框区分，不加图标/不加色）
- ❌ **表格不得用 teal 描边/表头**（D-11：border 用 `--border`，表头底用 `--surface-2`）
- ❌ **骨架屏不得用 teal**（D-19：纯中性灰明度渐变，非品牌色）

**硬禁**（贯穿全 6 项）：❌ 多色渐变 ❌ backdrop-filter/玻璃拟态 ❌ emoji ❌ 栅格图标 ❌ 散落硬编码 hex（UI-06 例外见下）。

---

## 逐需求视觉/交互合约

### UI-01 — react-markdown urlTransform XSS 防御【硬约束 P0，第一个 plan，独立】

**性质**：纯安全/逻辑合约，无视觉变化（链接命中危险协议时退化为无 href 纯文本，可读性不破坏）。

| 项 | 合约 | 来源 |
|----|------|------|
| 版本确证 | 已装 `react-markdown@9.1.0`（`package.json ^9.0.0`），**原生支持 `urlTransform` prop**（取代旧 `transformLinkUri`）。✓ 无需升级 | 本次确证 |
| 落点 | `src/components/ChatBubble.tsx` assistant 分支 `<ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={...}>`——唯一渲染 LLM 文本处 | D-02 |
| 策略 | **白名单放行 + 危险协议返回 `''`**：放行 `http:`/`https:`/`mailto:`/相对路径/锚点 `#`；命中 `javascript:`/`data:`/`vbscript:`/`file:` → 返回空串 → react-markdown 丢弃 href，链接退化为无跳转纯文本 | D-03 |
| 函数位置 | 抽到 `src/utils/`（如 `safeUrlTransform.ts`）便于单测（Claude's Discretion 推荐） | D-03 / Discretion |
| 内置兜底 | **【待复核】** 是否额外保留 react-markdown 内置 `defaultUrlTransform` 作兜底。推荐：以自写 allowlist 为唯一真相（行为可预测、可测、可读），不叠内置 | D-03 |
| 测试守门【硬】 | 新建/扩展 `ChatBubble`（或 util）单测，RED→GREEN 随 plan 同交付：① `[x](javascript:alert(1))` → DOM anchor 无 `javascript:` href；② `[x](data:text/html;base64,...)` → 拦截；③ `[ok](https://example.com)` → 保留 href（不误杀）；④ `![](javascript:...)` img src 同类防御 | D-04 |

**可测断言**：渲染后 query `a[href]` / `img[src]`，断言不含 `javascript:`/`data:`/`vbscript:`；合法 https 链接 href 完整保留。

---

### UI-02 — AI「思考中」loading 气泡

**需求措辞校正（硬）**：REQUIREMENTS 写 `agentStatus==='pending'`，但 `AgentStatus` 实为 `'idle'|'running'|'paused'|'soft-landing'`，**无 `'pending'`**。**不新增 store 状态**。

| 项 | 合约 | 来源 |
|----|------|------|
| 触发条件【待复核】 | 在 `ChatStream` 渲染：当存在一条**当前 run（`currentRunId`）的 assistant 消息且 `isStreaming===true` 且 `content.trim()===''`** 时，在消息流尾部渲染思考气泡。语义 = 「消息已发、首 token 未到」。**确证**：`loop-helpers.streamAssistantTurn` 每轮开头即 push `{role:'assistant', content:'', isStreaming:true, agentRunId, agentStep}`（L78-81），首 token 经 `appendDeltaToMessage` 进 content → 条件自动失效，交回正常流式气泡 | D-05/D-06 |
| 现状缺口 | 空 content assistant 气泡被 `ChatBubble` `return null`（L79-81）→ 首 token 前消息流无任何 AI 反馈。UI-02 正是补此空窗（ChatBubble 的 null 行为**保持不变**，思考气泡由 ChatStream 单独渲染，不改 ChatBubble 的空气泡判定） | D-06 |
| 视觉形态【待复核】 | **三点跳动 typing indicator**：复用 `.bubble-ai` 外壳（左对齐、`--bubble-ai-bg`、左下角拉直 `--radius-1`、1px `rgba(0,0,0,0.04)` 描边），内部 3 个直径 4px 圆点，色 `--text-3`，staggered 跳动 | D-07 |
| 动画规格 | 新 `@keyframes aster-typing`：圆点 `translateY` 或 `opacity` 错峰（建议 3 点延迟 0 / 0.16s / 0.32s，单周期约 `--dur-slow` 320ms 区间循环）。**新增 class 建议 `.bubble-typing` + `.bubble-typing__dot`**（复用 `.msg.msg-ai` + `.bubble.bubble-ai` 外壳） | D-07 |
| 备选（未选） | 单点脉冲 / shimmer 条 / 纯文字「正在思考」——选三点：聊天通用心智、纯 CSS、零依赖、teal 克制相符 | D-07 |
| 补文字？【待复核】 | 是否在三点旁加一行极淡文字（如「正在思考」）。推荐**不加**，纯三点更克制 | D-07 |
| reduced-motion【硬】 | `prefers-reduced-motion` 下动画停掉 → 静态三点（全局 `* { animation: none }` 已覆盖；确认静态态仍是 3 个 `--text-3` 点，不空白） | D-07 |
| 与 AgentControlBar 关系【待复核】 | loading 气泡（消息流内「这条回复正在生成」占位）与既有 `AgentControlBar`（全局 quiet pill / thinking·reading·writing 三态 + 可中断）**并存、职责不同**。推荐保留两者：气泡解决「消息流空窗」，pill 解决「全局可中断状态」。是否担心冗余留用户定 | D-08 |

**可测断言**：发消息后、`appendDeltaToMessage` 首次调用前，DOM 存在 `.bubble-typing`；首 token 到达后 `.bubble-typing` 消失、出现正常 `.bubble-ai`。run 结束（idle）无残留。

---

### UI-03 — DiffLogPanel 跟随当次 loop（按 agentRunId 边界插入）

| 项 | 合约 | 来源 |
|----|------|------|
| 现状问题【硬】 | `ChatStream` 当前把 `completedRunIds.map(runId => <Suspense><DiffLogPanel/></Suspense>)` **全部渲染在 `nodes` 之后**（消息流最底部，L402-406）→ 多次 loop 改动卡全沉底、与对应回复脱节 | D-09 |
| 修复方案【待复核】 | **边界插入**：在构建 `nodes` 的遍历里，检测每个 `agentRunId` 的「最后一条消息」边界（下一条消息 `agentRunId` 不同 / 到达数组末尾），若该 runId ∈ `completedRunIds`，则**紧跟其后**插入 `<Suspense key={runId} fallback={null}><DiffLogPanel runId={runId}/></Suspense>`。**移除底部统一渲染块** | D-10 |
| 边界判定【待复核】 | 插入点 = 「messages 数组中该 runId 最后一条 message 之后」。无 `agentRunId` 的旧历史/纯聊天轮次不触发（`completedRunIds` 只含真实 agent run）。**一个 runId 只插一张卡（去重）** | D-10 |
| 与合并组协调【硬】 | DiffLogPanel 是 full-width 卡，插入时机须在 `flushToolRun()` 之后（不打断/混进 `.tool-group` 行）。建议在遇到 runId 边界处先 `flushToolRun()` 再 push DiffLogPanel 节点 | 既有 flush 逻辑 + D-10 |
| 懒加载守护【硬】 | 保留 `lazy(() => import('./DiffLogPanel'))` + `<Suspense fallback={null}>`（NFR-05/NFR-06，DiffLogPanel 不进初始 chunk） | D-10 |
| 0 写操作防守 | DiffLogPanel 内部 `getWriteOpsByRun(runId).length===0` 即 `return null`（既有 L211），无需外部 length 检查——纯聊天 run 插了也自动隐形 | D-10 |
| 算法实现 | Map 分组 vs 单次遍历标记 last-index——具体算法属 Claude's Discretion | Discretion |

**可测断言（扩展 `ChatStream.test.tsx`）**：构造两个 run（各含写操作）穿插的消息序列，断言每张 DiffLogPanel 紧跟在其 runId 的最后一条 message 之后（DOM 顺序），而非两张都在末尾；同 runId 只渲染一次。

---

### UI-04 — Markdown 渲染优化（表格 + 列表/代码块一致性）

**纯 `src/styles.css` 改动**，全部复用既有变量；CSS 规则就近归到「ChatBubble」段（`.bubble-ai` 系列，L721+）。

**表格规则【待复核】数值**（D-11，全部复用变量）：

```css
.bubble-ai table { border-collapse: collapse; width: 100%; font-size: var(--fs-13); margin: var(--space-2) 0; }
.bubble-ai th, .bubble-ai td { border: 1px solid var(--border); padding: 6px 8px; text-align: left; }
.bubble-ai th { background: var(--surface-2); font-weight: 600; }
```

| 决策 | 推荐值 | 状态 |
|------|--------|------|
| 边框粗细 | 1px `var(--border)` | 【待复核】 |
| 表头底色 | `var(--surface-2)` | 【待复核】 |
| cell padding | `6px 8px`（纵 6 横 8） | 【待复核】 |
| 字号 | `--fs-13` 13px | 【待复核】 |
| 斑马纹 | **不加**（保持克制） | 【待复核】（推荐不加） |
| 窄面板溢出 | 350px task pane 下宽表可能横向溢出——**【待复核】** 是否给 table 包一层 `overflow-x:auto` 容器（react-gfm 表格无外层，需 wrapper 或 `.bubble-ai { overflow-x:auto }` 取舍）。推荐：表格单独允许横向滚动（不同于代码块的 `pre-wrap` 策略，表格不宜换行） | 【待复核】（D-11 延伸） |

**列表/代码块一致性审计**（D-12，既有规则在 L727-750，本阶段只「统一」不「重造」）：
- 既有 `.bubble-ai pre`：`white-space:pre-wrap; overflow-x:auto; --fs-12; --surface-2 底; --radius-2; padding 8px 10px`——窄面板换行优先（350px 硬约束）。审计确认保留。
- 既有 `.bubble-ai code`（内联）：`--font-mono; --fs-12; --surface-2 底; --radius-1; padding 1px 4px`——保留。
- 既有 `.bubble-ai ul/ol`：`padding-left:20px; margin:4px 0`——审计行距/缩进与正文 `p`（`margin 0 0 8px`）的视觉一致性，**【待复核】** 列表项 `li` 行距是否需补 `line-height`（推荐继承气泡 1.55，不单独设）。
- **不引入 shiki**（D-12，按需 lazy，本阶段不接）。

**硬约束**：所有颜色走变量，禁散落 hex；尺寸优先复用 spacing/radius token（D-13）。

---

### UI-05 — 读取工具卡轻量化降权（write 卡不降权）

**read/write 判定单一真相源**（D-14 关键发现）：`ToolDef.kind?: 'read'|'write'`（`src/agent/tools/index.ts` L74）。

| 项 | 合约 | 来源 |
|----|------|------|
| 判定落地【待复核】 | **推荐 (a)**：在 `loop-helpers.ts` push tool 消息处把 `kind` 一并写进 `Message`。**确证**：push 点（L149-152）此处 `def` 已解析（L143 `const def = tools.find(...)`，L144 已读 `def.kind`），加 `kind: def?.kind` 零额外查表成本。需给 `Message` 接口加可选字段 `kind?: 'read'\|'write'`。避免 UI 侧静态反查重量级工具注册表（破坏懒加载预算 NFR-06） | D-14 |
| 备选（不推荐为主） | UI 侧从 `toolResult.reverse` 存在=write / `toolResult.data` 形如 `{content,source}`=read 推断——更脆，仅作降级 | D-14 |
| read 卡降权程度【待复核】 | read 卡 = **去边框**（移除 `.aster-tool-card` 的 `border`）+ humanLabel 字色 `--text-3`（更淡）+ 内边距略收 / 字号沿用 `--fs-12`（不缩字号，**【待复核】**是否缩）。整体「次要信息」观感 | D-15 |
| write 卡【硬】 | **保持不变**：`1px var(--border)` 边框 + `--text-2` 正常字色 + 正常权重 | D-15 |
| 实现 class | 建议新增修饰类 `.aster-tool-card--read`（单卡）+ `.tool-group--read`（合并组）；据 message.kind 加 class。read 变体规则就近写在「ToolResultCard / MergedToolGroup」CSS 段 | D-15 + Discretion |
| 合并组处理【待复核】 | `MergedToolGroup`：组内**全是 read** → 整组走轻量（`.tool-group--read`）；**含任一 write** → 整组保持正常。推荐「任一 write 即整组正常」（最简单，避免逐行差异化视觉割裂） | D-15 |
| 保留可展开【待复核】 | read 卡**保留 chevron 可展开**（用户仍可查证据/source），只降视觉权重不砍功能。是否更狠（默认不可展开/折单行无 chevron）留用户定，推荐保留 | D-15 |
| 前缀图标？【待复核】 | 是否给 read 卡加极淡「读取」图标（书本/眼睛 SVG）。推荐**不加**，靠字色 + 去边框已足够区分，保持克制（Accent reserved-for 已禁新色/新图标溢出） | D-16 |

**可测断言**：read 工具消息渲染的卡含 `--read` 修饰类（无 border）、write 工具卡无此类（有 border）；全 read 合并组整组轻量、混合组整组正常。

---

### UI-06 — 首屏纯 CSS shimmer 骨架屏

| 项 | 合约 | 来源 |
|----|------|------|
| 不引库【硬】 | 纯 CSS shimmer，0 净新增运行时依赖。骨架屏写在 `index.html` 的 `<div id="root">…</div>` 内 + 内联 `<style>`，**不进 JS bundle**（对 bundle 体积零影响，守 NFR-06 ≤82KB） | D-17 |
| 硬编码例外【硬·唯一正当例外】 | 骨架屏在 `Office.onReady` 之前、`main.tsx` 导入 `styles.css` 之前、`#root` 设 `data-theme` 之前就要显示——**此时 CSS 变量与主题都不可用**。故骨架屏**必须自带内联 CSS、用中性灰**（贴近 `--surface`/`--surface-2` 的 light 值，如 `#ffffff` 底 + `#f3f2ee`/`#e9e7e0` 块）。**这是全项目「禁硬编码 hex」的唯一被批准例外**，须在代码注释显式标注原因 | D-18 |
| light/dark【待复核】 | 是否加 `@media (prefers-color-scheme: dark)` 让骨架也分深浅（深灰底 ≈ `#0e0e10` + 块 `#1f1f21`）。推荐**加**（成本极低，兜住 dark 宿主首屏不刺眼）。注意：宿主主题来自 `Office.context.officeTheme` 而非系统 `prefers-color-scheme`，二者**可能不一致**——骨架只活几百毫秒，系统 preference 近似可接受 | D-18 |
| 布局形态【待复核】 | 模拟 task pane 骨架：顶部一条 header 占位（≈ AgentControlBar / 标题高度）+ 下方 2–3 条消息行 shimmer 块（高度/圆角贴近真实气泡，圆角 ≈ 12px 对齐 `--radius-3`）。具体行数/高度留用户定 | D-19 |
| shimmer 动画【待复核·澄清】 | `@keyframes shimmer` 横扫高光 = `background: linear-gradient(...)` 单色明度渐变 + `background-position` 动画。**这是单色明度 shimmer，不是被禁的「多色品牌渐变」**，属骨架屏行业惯例——flag 给用户确认这条不违反「无渐变」铁律 | D-19 |
| 自动消失【硬】 | React `createRoot(document.getElementById('root')).render()` 挂载时覆盖 `#root` 内骨架 → 自动消失，**无需手动移除逻辑**。骨架放在 `<div id="root">…骨架…</div>` 内 | D-19 |
| reduced-motion【硬】 | `prefers-reduced-motion: reduce` 下 shimmer 动画停掉 → 静态灰块（内联 `<style>` 内自带此 media query，不能依赖 styles.css 的全局降级——styles.css 此时还没加载） | D-19 |

**可测断言**：`index.html` 的 `#root` 含骨架 HTML + 内联 `<style>`；骨架 CSS 含 `@media (prefers-reduced-motion: reduce)` 关动画分支；`npm run build && npm run size` 验 initial main-*.js ≤82KB 未因 E phase 增长（骨架不计入 JS bundle）。

---

## Copywriting Contract

本阶段几乎无新文案（精修为主）；新增/涉及的中文文案如下（UI 默认中文，走 Lingui `<Trans>`，骨架屏除外因其不在 React 树内）。

| Element | Copy | 备注 |
|---------|------|------|
| Primary CTA（本阶段无新主 CTA） | —— | UI-03 复用既有「撤销该步」「撤销本次所有操作」 |
| 思考气泡（UI-02） | 纯三点，**无文字**（推荐）；若【待复核】决定加 → 「正在思考」（极淡 `--text-3`） | D-07 |
| 表格/代码块（UI-04） | 无文案（纯样式） | — |
| read 卡（UI-05） | 沿用既有 humanLabel（中文人话，loop-helpers push 时写入），不新增文案 | D-15 |
| 骨架屏（UI-06） | **无文字**（纯灰块占位，避免 i18n 进 index.html 内联） | D-19 |
| 链接退化（UI-01） | 无提示文案（危险链接静默退化为纯文本，不打断阅读） | D-03 |

无 destructive 确认新增（UI-03 的撤销确认 modal 文案既有，不改）。

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| （无） | 无第三方 registry / 无 shadcn / 0 净新增依赖 | not applicable |

---

## 待复核清单汇总（给用户快速纠偏）

| # | 需求 | 待复核点 | Claude 默认 |
|---|------|----------|-------------|
| 1 | UI-01 | 是否叠 react-markdown 内置 `defaultUrlTransform` 兜底 | 不叠，自写 allowlist 为唯一真相 |
| 2 | UI-02 | 触发条件（isStreaming 空 content assistant 消息） | 采用（不新增 store 状态） |
| 3 | UI-02 | 视觉形态 | 三点跳动 |
| 4 | UI-02 | 是否加「正在思考」文字 | 不加 |
| 5 | UI-02 | 是否担心与 AgentControlBar 冗余 | 保留两者 |
| 6 | UI-03 | 边界插入修复方案 | 采用边界插入 + 移除底部块 |
| 7 | UI-03 | 边界判定（runId 最后一条消息之后、去重） | 采用 |
| 8 | UI-04 | 表格边框 1px / 表头 `--surface-2` / padding 6×8 / 13px / 无斑马纹 | 如表 |
| 9 | UI-04 | 宽表横向滚动 wrapper | 表格单独允许横向滚动 |
| 10 | UI-04 | 列表 li 是否单独设 line-height | 继承 1.55 |
| 11 | UI-05 | 判定落地 (a) kind 写进 Message vs (b) UI 查表 | (a) |
| 12 | UI-05 | read 卡降权（去边框 + `--text-3` + 收内距） | 采用，不缩字号 |
| 13 | UI-05 | 是否缩字号 | 不缩（沿用 `--fs-12`） |
| 14 | UI-05 | 混合合并组处理 | 任一 write 即整组正常 |
| 15 | UI-05 | read 卡是否保留可展开 | 保留 chevron |
| 16 | UI-05 | read 卡是否加前缀图标 | 不加 |
| 17 | UI-06 | 是否加 `prefers-color-scheme: dark` 分主题 | 加 |
| 18 | UI-06 | 骨架布局（header + 2–3 行气泡块） | 采用 |
| 19 | UI-06 | 确认单色明度 shimmer 不违反「无渐变」铁律 | 确认是惯例例外 |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
