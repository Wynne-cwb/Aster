# Phase 12: UI 打磨 (E) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 12-ui-e
**Mode:** `--auto`（auto-selected recommended defaults；UI 选择全部 flag 待复核）
**Areas discussed:** UI-01 XSS urlTransform / UI-02 loading 气泡 / UI-03 DiffLogPanel 跟随 loop / UI-04 Markdown 渲染 / UI-05 读卡降权 / UI-06 骨架屏

---

## UI-01 — react-markdown urlTransform XSS 防御

| Option | Description | Selected |
|--------|-------------|----------|
| 白名单 allowlist（http/https/mailto/相对/锚点，危险协议返回空串丢 href） | 行为可预测、可测、可读 | ✓ |
| 仅依赖 react-markdown 内置 defaultUrlTransform | 省事但行为不显式、不易断言 | |
| 渲染前对 markdown 文本做正则过滤 | 脆弱、易绕过 | |

**Auto-selected:** 白名单 allowlist（推荐默认）。
**Notes:** P0 硬约束——独立首个 plan + RED→GREEN 测试守门（javascript:/data:/vbscript:/file: 拦截，https 不误杀，img src 同防）。落点 ChatBubble `<ReactMarkdown urlTransform>`。

## UI-02 — AI「思考中」loading 气泡

| Option | Description | Selected |
|--------|-------------|----------|
| 三点跳动 typing indicator（.bubble-ai 外壳 + --text-3 点 + staggered keyframes） | 聊天通用心智、纯 CSS、零依赖、克制 | ✓ |
| 单点脉冲 | 太弱 | |
| shimmer 条 | 与骨架屏重复语义 | |
| 「Aster 正在思考…」纯文字 | 不够生动 | |

**Auto-selected:** 三点跳动（推荐默认，待复核）。
**Notes:** 需求措辞 `agentStatus==='pending'` 校正为「running 且当前 run 无 assistant token」（store 无 pending 状态，不新增）。首 token 到达即消失。prefers-reduced-motion 降级静态。与 AgentControlBar 并存（职责不同）。

## UI-03 — DiffLogPanel 跟随当次 loop

| Option | Description | Selected |
|--------|-------------|----------|
| 按 agentRunId 边界插入消息流（每个 run 最后一条消息后插卡，移除底部统一块） | 卡跟随对应回复、不沉底 | ✓ |
| 保持底部但加分隔/标题 | 仍脱节，未解决根因 | |

**Auto-selected:** 边界插入（推荐默认，待复核边界判定细节）。
**Notes:** 保留 lazy+Suspense；DiffLogPanel 自带 0 写操作返回 null；一个 runId 只插一张卡（去重）；无 agentRunId 的旧历史/纯聊天轮不触发。

## UI-04 — Markdown 渲染优化（表格 + 一致性）

| Option | Description | Selected |
|--------|-------------|----------|
| border-collapse + 1px var(--border) cell border + 表头 --surface-2 底，无斑马纹 | 克制、复用变量 | ✓ |
| 加斑马纹 / 加粗边框 | 偏重，违克制 | |

**Auto-selected:** 克制边框无斑马纹（推荐默认，待复核边框粗细/表头底色/padding/斑马纹）。
**Notes:** 列表/代码块一致性：审计现有 ul/ol/pre/code，统一缩进行距 + pre 横向滚动（350px 宽不撑破）。不接 shiki。禁硬编码 hex。

## UI-05 — 读取工具卡轻量化降权

| Option | Description | Selected |
|--------|-------------|----------|
| 据 ToolDef.kind 判定；读卡无边框 + --text-3 字 + 更小内边距；write 卡不变 | 单一真相源、克制降权 | ✓ |
| 用 toolResult.reverse / data 形状启发式判定 | 脆弱 | |
| 读卡折成单行不可展开 | 砍功能，过度 | |

**Auto-selected:** kind 判定 + 无边框降权（推荐默认，待复核降权幅度/混合组处理/是否加读取图标）。
**Notes:** 推荐把 `kind` 在 loop-helpers push 时写进 Message（避免 UI 反查重量级注册表破坏懒加载预算）。混合合并组：任一 write 即整组正常。读卡保留 chevron 可展开（用户仍可查证据）。不加额外读取图标。

## UI-06 — 首屏 CSS shimmer 骨架屏

| Option | Description | Selected |
|--------|-------------|----------|
| index.html 内 #root 注入骨架 HTML + 内联 CSS shimmer（header + 2-3 消息行块） | 纯 CSS、0 bundle 影响、React 挂载自动覆盖 | ✓ |
| 在 React 内做 loading 组件 | Office.onReady 前 React 还没挂载，解决不了白屏 | |
| 引骨架屏库 | 违铁律（0 新依赖 + bundle） | |

**Auto-selected:** 内联骨架（推荐默认，待复核布局形态 + light/dark 处理）。
**Notes:** 内联 CSS 是「禁硬编码 hex」唯一正当例外（早于 styles.css/主题加载，CSS 变量不可用），用中性灰。推荐加 prefers-color-scheme dark 覆盖（宿主主题 vs 系统 preference 可能不一致，flag 确认）。单色明度 shimmer 非被禁的多色品牌渐变。prefers-reduced-motion 停动画。

## Claude's Discretion

- 测试文件组织、CSS 规则物理位置、urlTransform 抽 util、agentRunId 边界检测算法实现。

## Deferred Ideas

- `builtin-model-dropdown.md` todo（model 下拉）：误匹配（仅命中关键词 phase），属新能力，不折叠。
