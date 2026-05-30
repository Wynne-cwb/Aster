---
phase: 06-write-tools-killer-scenarios
source_review: 06-REVIEW.md
fixed: 2026-05-30
fixed_count: 11
skipped_count: 3
mode: scoped (TL fix-runner scope table，非 blanket auto-fix)
gates:
  build: PASS
  size: "73.07 kB gzip ≤ 82 kB"
  test: "584 passed（仅 retry.test.ts 预存 flaky 全suite fail；单跑 9/9）"
  eslint: "改动文件 0 error；ChatStream 残留 1 个预存 error（见备注）"
---

# Phase 06: Code Review Fix Report

按 TL 精确 scope 表定向修复 `06-REVIEW.md` 的 issue（非 blanket `/gsd-code-review-fix`）。
逐条处置如下。

## ✅ FIXED（11 条）

### CR-01 — PptAdapter.insert append_end 在 sync 前访问 shape proxy
**File:** `src/adapters/PptAdapter.ts`
旧实现在 sync 1 之前就取 `shapes.getItemAt(0).textFrame.textRange` + `tr.load('text')`，空 slide 时
`getItemAt(0)` 会随 sync 1 发到服务端抛 `ItemNotFound`，令整个 insert 以 HostApiError 失败。
**修复：** 改为先 `await ctx.sync()` 加载 `shapes.items` → `items.length === 0` 优雅 no-op（不写、不崩）
→ `>0` 才取已加载的 `items[0].textFrame.textRange` 写入（两 sync 变三 sync，与下方 cursor 路径对称）。
cursor/replace_selection 路径未动。

### CR-02 — ChatStream CIRCUIT_OPEN 卡片响应性 + rid undefined 防御
**File:** `src/components/ChatStream.tsx`
(a) `lastCircuitInfo` 从 `useAgentStore.getState()` 快照改为 **Hook 订阅** `useAgentStore((s) => s.lastCircuitInfo)`
（提到组件顶部，与其它 hook 同级，保证 store 更新后卡片重渲染）。
(b) `const rid = message.agentRunId`：rid 缺失时**不再**用 `agentRunId === undefined` 去 find user/assistant 消息
（会抓到无关 run 的错 prompt）——suggestion/prompt 安全降级为 `''`；prompt 为空时**不渲染「重新试试」按钮**
（避免重发空 prompt）。runAgent 改为点击时 `useAgentStore.getState().runAgent(...)`。
**保留** 04.1 的 `useAdapter()` 取 adapter（未退回 getState）。

### CR-03 — InputBar 发送键 agent 运行时假装「停止」
**File:** `src/components/InputBar.tsx`（+ `src/styles.css`）
诚实方案（不新增 abort 路径）：`isAgentBusy` 时发送键**保持 disabled**，但显示 `SendIcon`（disabled 态）、
`aria-label` 恒为「发送」，移除 `StopIcon` 与 `data-streaming` 属性。停止入口交给 AgentControlBar。
同步删除 styles.css 中已失效的 `.send-btn[data-streaming]` 死规则；移除未用的 `StopIcon` import
（StopIcon 仍被 AgentControlBar 使用，export 保留）。

### CR-04 — replace_selection inverse 误导（用户已拍板：诚实标注无法撤销）
**Files:** `src/agent/tools/write/word.ts` + `src/adapters/WordAdapter.ts` + `src/agent/operationLog.ts`
+ `src/agent/tools/write/word.test.ts`
- word.ts：`replace_selection` 的 `reverse.tool` 从误导性的 `delete_paragraph_by_content`（用新文本指纹，
  会去删新文本而非还原原文）改为 **`noop_inverse`**（args 带 reason）→ DiffLog 老实显示「此步无法自动撤销」
  （replay engine 标 skipped_error）。不再接收/记录 beforeImage 进 reverse。
- WordAdapter.ts：删除永不被调用的死方法 **`restoreSelection`**（executeReverse 无对应 case，确认全仓 0 调用方）；
  更新 `replaceSelection` docstring。
- operationLog.ts：更新 `noop_inverse` case 注释（现 replace_selection 会走此分支）。无死分支需删（`restore_selection` case 本就不存在）。
- word.test.ts：`expect reverse.tool` 从 `'delete_paragraph_by_content'` 改为 `'noop_inverse'`；
  原「noop_inverse 未出现」用例反转为「reverse.tool === noop_inverse」断言。
humanLabel 保持清晰中文（未动）。

### WR-01 — ExcelAdapter append_end catch 块内无意义 ctx.sync()
**File:** `src/adapters/ExcelAdapter.ts`
删除 catch 分支里的 `await ctx.sync()`（对已损坏 context 再 sync 掩盖真实错误且无意义；后续 write 的 sync 2 已覆盖）。

### WR-02 — PptAdapter.insertSlideAfter 空列表越界
**File:** `src/adapters/PptAdapter.ts`
`sorted.length === 0` 时 throw 清晰 HostApiError（别 `undefined.index`）；catch 加 `if (err instanceof HostApiError) throw err`
保留内层清晰错误不二次包裹。

### WR-04 — operationLog.readTargetState ppt_slide content 解包错误
**File:** `src/agent/operationLog.ts`
ppt.ts 里 `postState.content` 是对象 `{ index, title }` 而非 string，旧 `typeof === 'string'` 恒 false → title 恒 `''`，
D-11 手改侦测对 slide 永远失效。**修复：** `typeof content === 'string' ? content : content?.title ?? ''`（兼容两种形态）。

### WR-05 — ExcelAdapter get_used_range_summary getRow(0) 越界
**File:** `src/adapters/ExcelAdapter.ts`
先 `load(['address','rowCount','columnCount'])` + sync，再判 `rowCount > 0 && columnCount > 0` 才 `getRow(0)` 读首行 schema；
空表 `headerSample = []` 不崩（getRow(0) 越界 OutOfRange 不在 WR-06 的 ItemNotFound 保护内）。

### WR-07 — console.assert 恒真死断言
**Files:** `src/agent/tools/write/excel.ts`（4 处）+ `src/agent/tools/write/ppt.ts`（1 处）
删除 5 处 `console.assert(reverse !== undefined, ...)`——reverse 是字面量赋值恒非 undefined，断言恒真无意义；
按 scope 仅删除，不引入可能误伤正常路径的 throw。

### IN-01 — Step1Keys 按钮缺 type
**File:** `src/components/Onboarding/Step1Keys.tsx`
「跳过」「开始使用」两按钮加 `type="button"`。

### IN-03 — ChatStream 残留 eslint-disable（验证后删除）
**File:** `src/components/ChatStream.tsx`
删除第 309 行 `// eslint-disable-next-line react-hooks/rules-of-hooks`——该 Hook 在所有早期 return 之前无条件调用，本就合规。
验证：本仓 eslint 配置**未启用 react-hooks 插件**，该 disable 实际触发 "Definition for rule not found" error；
删除后该 error 消失（ChatStream error 数 2→1）。**保留**第 305 行的 `exhaustive-deps` disable（合法意图性抑制，且不在本条 scope）。

## 🚫 SKIPPED（3 条）

### WR-03 — agentStore.awaitResume listener/subscribe 顺序
**跳过。** reviewer 自承「整体逻辑是安全的」，且其给的修复片段有 `unsub` 前向引用 bug（先用后声明）。
现状安全，按 scope 默认跳过（无干净无 bug 的重排收益 > 回归风险）。

### WR-06 — WordAdapter.normalizeText trimEnd vs trim
**跳过。** reviewer 自己说当前 Word 比对「是正确的」；这正是 Phase 5 真机撤销全挂 bug 的同一段匹配逻辑、已 UAT 验证，
为「理论一致性」改它有回归风险。Word/Ppt 两处 normalizeText 均未动。

### IN-02 — operationLog.clearRun 未被调用
**跳过。** in-memory、关页即清、非泄漏，不值得为此动 agent 生命周期。

## 收尾门禁结果

| Gate | 结果 |
|---|---|
| `npm run build` | ✅ PASS（TS strict 经 test 的 tsc --noEmit 验证；main chunk 73.19 kB gzip） |
| `npm run size` | ✅ **73.07 kB gzip ≤ 82 kB**（新鲜 dist） |
| `npm test` | 584 passed / 585；唯一 fail = `retry.test.ts`（TL 点名预存 flaky，并行 timer 泄漏 unhandled rejection）。单跑 `retry.test.ts` 9/9、`queue.test.ts` 9/9 全绿。我改动相关 7 套件定向跑 **86/86 PASS**。 |
| eslint（无 `lint` script，用 `npx eslint`） | 改动的 9 个文件 **0 error**。ChatStream 残留 1 个 **预存** error（`react-hooks/exhaustive-deps` disable @ line 305，因 react-hooks 插件未装而报 "rule not found"，改动前即存在、非本次引入、不在 scope）。 |

## 备注 / 需 TL 知晓

- **预存 eslint 技术债（非本次引入）：** 本仓 `eslint.config.js` **未注册 `eslint-plugin-react-hooks`**，
  导致所有 `react-hooks/*` 的 eslint-disable 注释报 "Definition for rule not found" error。
  我已顺手清掉其中一个无意义的（IN-03 的 rules-of-hooks）；另一个（exhaustive-deps @305）是合法意图性抑制，未动。
  根治需安装/注册 react-hooks 插件，超出本修复 scope，留给 TL 判断。
- 未 push（改了 src 影响线上 bundle，按约定由 TL 收尾统一部署）。
