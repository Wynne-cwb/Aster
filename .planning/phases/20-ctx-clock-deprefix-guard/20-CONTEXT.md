# Phase 20: B 快赢——时钟脱前缀 + 守门 - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning
**Source:** Team Lead pre-research (v2.3 milestone autonomous step) — decisions locked, no discuss-phase needed (mechanical phase)

<domain>
## Phase Boundary

把实时时钟（today/clock/weekday）从 system prompt 前缀挪到「当前这条 user message 末尾」，让 `[system][tools][历史]` 这一长前缀变**完全静态**（prompt 缓存高命中），同时 agent 仍每轮拿得到精确「日期+时间+星期」。再加一条**结构性测试守门**防止有人把分钟级时钟又加回 system 前缀。

**In scope（仅这两条需求）:**
- **CTX-01**: `buildSystemPrompt`（`src/agent/system-prompt.ts`）不再注入实时时间到 system message；时间改拼到 `loop.ts` 构造的 wire `messages` 数组里**当前这条 user message** 末尾。
- **CTX-02**: `system-prompt.test.ts` 加断言 `buildSystemPrompt(host)` 返回值不匹配 `/\d{1,2}:\d{2}/`（分钟级时:分），防回退。

**Out of scope（属 Phase 21+，本 phase 不碰）:**
- CTX-03/04/05/06（摘要压缩、稳定前缀持久化、`truncateTo20Turns` 截断策略重审、抗幻觉指引）——下一 phase。
- 不动 `loop-helpers.ts` 的截断逻辑、不动 `getDomainSegment`、不动偏好块。
- 不把「取当前时间」做成 tool（REQUIREMENTS 已明确否决：多一次网络往返拖慢首 token）。

这是纯字符串/结构改动：**0 净新增运行时依赖**，bundle 预期 0 增量。
</domain>

<decisions>
## Implementation Decisions（全部 LOCKED）

### D-20-01 时间字符串落点：当前 user message 末尾（不进 system 前缀）
缓存铁律（STATE.md §缓存铁律）：每次请求都会变的内容一律放 messages **末尾**，绝不放进静态前缀（system / 靠前历史）。时间从 system 前缀 → 当前 user message 末尾。
- 唯一注入站点 = `src/agent/loop.ts` 第 70-77 行构造的 `messages: WireMessage[]` 数组里的**最后一条** `{ role: 'user', content: userPrompt }`（第 76 行）。
- 这是 per-request-changing tail，是缓存友好的正确位置。

### D-20-02 helper：新增并导出 `buildTimeContext()`（放 system-prompt.ts）
- 在 `src/agent/system-prompt.ts` 新增并 `export` 一个 `buildTimeContext(): string`，内部 `new Date()` 计算 today（YYYY-MM-DD）、clock（HH:MM）、weekday（中文周X），返回拼接后缀字符串。
- 返回格式（保留抗幻觉意图）：以换行起头便于附加，例如
  `\n\n（当前时间：2026-06-03 周三 14:37，用户本地时间。凡涉及时间的计算请以此为"现在"，不要自行假设年份或时间。）`
- 放在 system-prompt.ts（而非 loop.ts 内联）：日期/星期/时钟的格式化逻辑与原 `buildSystemPrompt` 同源、便于单测、loop.ts 只需 import + 拼接一行。

### D-20-03 `getSharedBase` 去掉时间参数，变静态
- 现 `getSharedBase(today, clock, weekday, hostLabel)` → 改为 `getSharedBase(hostLabel: string)`。
- 删除其内部第 35 行那句「现在是 ${today} ${weekday} ${clock}（用户本地时间）。凡涉及时间的计算……不要自行假设年份或时间。」——这句的**抗幻觉意图迁移到 `buildTimeContext()`** 的返回串里（见 D-20-02），不是丢弃。
- 同步更新 `buildSystemPrompt` 内：移除 `now/today/clock/weekday` 的计算（这些移交 `buildTimeContext`），`getSharedBase(hostLabel)` 调用相应改签名。`buildSystemPrompt(host, opts?)` 对外签名保持不变（向后兼容，loop.ts:71 调用不变）。

### D-20-04 loop.ts 接线：仅 wire 消息拼时间，持久化历史保持干净
- `loop.ts` 把最后一条 user message 改为 `{ role: 'user', content: \`${userPrompt}${buildTimeContext()}\` }`（import buildTimeContext）。
- **只拼到 wire 的 `messages` 数组**，**不**改写存入 chatStore / localStorage 的原始 user message——UI 在 runAgent 之前已把 raw userPrompt 存进 chatStore；`historicalMsgs`（来自 `useChatStore.getState().messages`）因此永远是无时间戳的原文。
- 这保证：① 持久化历史无 stale 时间戳；② 下一轮 `[system][历史]` 前缀稳定可缓存；③ 当前轮 agent 拿得到精确时间。三宿主（PPT/Excel/Word）同一条主路径，无需 per-host 改动。

### D-20-05 测试守门（CTX-02）：断言 system prompt 不含分钟级时钟
- `system-prompt.test.ts` 新增断言：三宿主 `buildSystemPrompt(host)` 返回值 `.not.toMatch(/\d{1,2}:\d{2}/)`（防分钟级时:分回到 system 前缀）。
- **必须同步修掉会变红的旧断言**（时间/日期已离开 system 前缀）：
  - 第 41-50 行 `it('含运行时当前日期与时间...')`：`toContain(today)`、`toContain('现在是')`、`toContain('用户本地时间')` 全部会失败——改造为「system prompt **不含** today / 不含 `现在是` / 不含 `用户本地时间`」的反向断言，或删除该用例并由新守门用例覆盖。
  - 第 91-96 行 `it('含今天日期注入')`：`toContain(year)`（"2026"）会失败——改/删（year 不再出现在 system prompt）。
- **新增正向断言**保住 success criteria #2：`buildTimeContext()` 返回值**含** today（YYYY-MM-DD）、含中文周X、**匹配** `/\d{1,2}:\d{2}/`、含「用户本地时间」、含抗幻觉那半句（如「不要自行假设年份」），证明精确时间仍可达。
- ⚠️ 不要误改 `circuit-breaker.test.ts:64`（注释里的「现在是」）和 `src/store/preferences.ts:24`（sanitize 黑名单的「你现在是」）——与本 phase 无关。

### D-20-06 loop.test.ts 不回归（视情况补 1 条 wiring 断言）
- `src/agent/loop.test.ts` 存在。planner 须 read_first 确认其没有断言 system prompt 含时间；若它 mock 了 messages，可补 1 条断言「最后一条 user message 含 `/\d{1,2}:\d{2}/`」坐实 wiring（success criteria #2），但不强制——若 loop.test 改动成本高，结构守门（D-20-05）+ buildTimeContext 正向断言已足够。
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 源码（直接改动）
- `src/agent/system-prompt.ts` — `getSharedBase`（第 33-43 行，含时间句）、`buildSystemPrompt`（第 93-103 行，算 now/today/clock/weekday）。本 phase 主改文件。
- `src/agent/loop.ts` — `runAgent` 第 70-77 行 wire `messages` 数组构造；第 76 行最后一条 user message = 注入站点。
- `src/agent/system-prompt.test.ts` — 第 41-50、91-96 行旧时间/日期断言需改；新增守门断言。

### 源码（read_first 防回归，不一定改）
- `src/agent/loop.test.ts` — 确认无 system-prompt-time 断言；可选补 wiring 断言。
- `src/store/chat.ts` — 确认 chatStore 持久化的是 raw userPrompt（佐证 D-20-04 历史保持干净）。

### 项目约束
- `.planning/STATE.md` §缓存铁律 + §v2.3 工程约束 — 0 净新增依赖；bundle ≤82KB gzip CI gate（本 phase 应 0 增量）。
- `./CLAUDE.md` §Conventions — 发布授权、UI 设计系统（本 phase 不动 UI）；§project memory `precision_over_brevity`（prompt 删冗余但保精确）。
- memory `recurring_failure_add_gate` — CTX-02 守门正是此原则的应用（时钟回退是潜在复发故障，加结构性 test 守门）。
</canonical_refs>

<specifics>
## Specific Ideas

- helper 名 = `buildTimeContext`（D-20-02 锁定）。
- 守门正则 = `/\d{1,2}:\d{2}/`（与 REQUIREMENTS CTX-02 原文一致）。
- 时间格式与现有代码一致：`today` = `${y}-${MM}-${DD}`、`clock` = `${HH}:${mm}`、`weekday` = `['周日','周一',...,'周六'][getDay()]`（直接从现 `buildSystemPrompt` 第 97-100 行迁移这段逻辑到 `buildTimeContext`）。
- 后缀以 `\n\n（…）` 包裹，附在 userPrompt 之后，视觉/语义上清晰分隔用户输入与系统注入的时间上下文。

## Verification（success criteria，必须 TRUE）
1. `buildSystemPrompt(host)` 不再含分钟级时间（HH:MM）；时间改在当前 user message 末尾出现。
2. agent 每次 `runAgent` 仍能从 messages 末尾拿到精确 日期+时间+星期，三宿主均可用。
3. `system-prompt.test.ts` 断言 `buildSystemPrompt(host)` 不匹配 `/\d{1,2}:\d{2}/`，CI 通过。
4. 现有测试（892+）全 green，bundle 无变化（纯字符串改动，0 新依赖）。

## Verification commands
- `npx tsc --noEmit`（类型干净）
- `npm test`（全套 green，含新守门用例；注意 memory `i18n_extract_and_test_noise`：尾部 3 个 retry errors 是噪音，「N failed」才是真失败）
- `npm run build && npm run size`（bundle ≤82KB gzip，预期与上次持平——纯字符串改动）
- 本 phase **不动 Lingui 宏字符串**，无需 `npm run extract`。
</specifics>

<deferred>
## Deferred Ideas

- CTX-03/04/05/06 → Phase 21（摘要压缩 + 稳定前缀持久化 + 截断策略重审 + 抗幻觉指引）。
- 真机 UAT 攒到 v2.3 里程碑末统一验（Team Lead 决定，本 phase 不单独 UAT）。
</deferred>

---

*Phase: 20-ctx-clock-deprefix-guard*
*Context gathered: 2026-06-03 via Team Lead pre-research (autonomous milestone step)*
