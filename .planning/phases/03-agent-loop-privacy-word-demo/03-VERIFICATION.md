---
phase: 03-agent-loop-privacy-word-demo
verifier: Claude (verify-work)
date: 2026-05-29
verdict: PASS-AUTO (with caveats) — real-device UAT deferred to user
base_commit: 396c890
head_commit: d3dbf37
commits_in_phase: 43
tests: 303/303 pass (30 test files)
bundle_kb_gzipped: 76.26
bundle_budget_kb: 80
bundle_target_kb_original: 70
ts_strict_errors: 11   # ⚠ executor 漏 — 见 Findings §F1
real_device_uat: deferred (.planning/uat/03-uat-checklist.md — 5 项)
---

# Phase 3 — Verification Report

> 验证范围：`/gsd-verify-work 3` 自动化层；真机 UAT (SC1/SC2/CARRY-01/SP-4/SP-5) 由用户跑 `.planning/uat/03-uat-checklist.md`。
> 用户睡觉中，**不 push origin main**（CLAUDE.md §发布授权允许，但本次明确留用户决定）。

---

## 1. 6 Success Criteria — Goal-Backward Verdict

| # | SC（ROADMAP Phase 3） | Verdict | Evidence |
|---|---|---|---|
| **SC1** | 代理 demo 跑通（Word prompt → ≥1 append_paragraph + role='tool' 折叠卡） | **PASS-MANUAL** | `system-prompt.test.ts` 7/7 pass（教 LLM 三件事）；Plan 04 `WordAdapter.appendParagraph` + `tools/write/word.ts` ToolDef + index dispatch；Plan 06 ChatStream role='tool' 折叠卡 + ToolResultCard 单测。**真机 LLM round-trip + Word.run 异步行为只能真机验** → UAT checklist § SC1 |
| **SC2** | 失控控制可观察（AgentControlBar pause/abort + step counter + max_steps=20 软着陆） | **PASS-MANUAL** | Plan 07 `AgentControlBar.test.tsx` pass（pause/abort/step counter/glass UI）；Plan 03 agent loop `MAX_STEPS=20` + `StepLimitError` + soft-landing 卡片单测；agentStore.pause/abort 测试覆盖。**UI 玻璃拟态 + in-flight tool 语义只能真机验** → UAT checklist § SC2 |
| **SC3** | 错误协议结构化 + sanitized（`{code,message,recoverable,hint}` 不含 stack/绝对路径/Key） | **PASS-AUTO** | `src/errors/index.ts`：12 个 AsterError 子类 × `public readonly recoverable` × `public readonly hint` 全部对齐（grep 验证：`recoverable` 12 个 / `hint` 12 个）；HostApiError 构造器收 hostError 后**不存进实例字段**（line 188 注释 + 实现）；`errors/index.test.ts` 16.3KB 覆盖 sanitize；message/hint 全部中文字面量、无 string interpolation。 |
| **SC4** | CARRY-01 修复（三宿主首次开 Task Pane SelectionPill/ContextCard 立即显示） | **PASS-MANUAL** | Plan 08 路径 A：`main.tsx` Office.onReady 提前 `pre-fetch selection` → `useSelectionStore`；三宿主单测 `selection.test.ts` 50 行 pass。**真机首帧抖动 + Office.js onReady 三宿主时序只能真机验** → UAT checklist § CARRY-01 |
| **SC5** | v1 cost 完全拆除（CostBadge / pricing.ts 删 + Message 无 costCny/tokenCount + 8 vitest 删） | **PASS-AUTO** | `git log` 确认 `CostBadge.tsx` / `pricing.ts` / `pricing.test.ts` 已 `D`（commit `9bdaa06`）；运行时 src/ grep `costCny\|tokenCount\|CostBadge\|autoInsertMode\|acceptToolCall\|rejectToolCall` 仅剩**注释/test 名称残留**（无活跃 code path）。⚠ 小问题见 Findings §F2（Lingui 编译产物含 5 个 obsolete msgid，bundle 浪费 <0.5KB）。 |
| **SC6** | 0 净新增运行时依赖 + bundle ≤ ~70KB target / ≤ 1MB 硬上限 | **PASS-AUTO**（目标超 6.26KB；硬上限 PASS） | `npm run size`：76.26 KB gzipped / 80 KB 预算（size-limit 通过）；`git diff 396c890..HEAD package.json` ⇒ **runtime deps 0 净新增**（Plan 03-01 已收紧 size-limit 到 80KB 作为 NFR-02 ratchet）。**超原 70KB target 6.26KB**：Plan 06 role='tool' 折叠卡 + Plan 07 AgentControlBar+glass UI 累计成本。仍远低于 1 MB 硬上限。Recommendation 见 §5。 |

**总体结论：6 SC 全部 PASS（3 PASS-AUTO + 3 PASS-MANUAL）。** 真机 UAT 由用户起床后跑 `.planning/uat/03-uat-checklist.md`。

---

## 2. 自动化验证证据（命令 + 输出）

| 检查项 | 命令 | 结果 |
|---|---|---|
| 全套单测 | `npm test` | **30 test files / 303 tests pass** ✅ |
| 类型 strict 校验 | `npx tsc --noEmit` | **⚠ 11 errors in 3 files**（见 §F1） |
| 生产构建 | `npm run build` | ✅ 336 modules transformed |
| Bundle 实测 | `npm run size` | **76.26 KB gzipped / 80 KB 预算** ✅ |
| commits Phase | `git log 396c890..HEAD --oneline \| wc -l` | 43 commits |
| 改动面 | `git diff 396c890..HEAD --stat` | 84 files / +6811 -1143 |
| SC5 dead strings | `grep -rE "costCny\|tokenCount\|CostBadge\|autoInsertMode\|acceptToolCall\|rejectToolCall" src/` | 全部为注释/test 名称/messages.po obsolete `#~`（无运行时代码） |
| PRIV-* 越界 | `grep -rE "PRIV-0[1-5]\|fullDocAccess\|Provider allowlist\|Step3Privacy" src/` | **0 命中** ✅ |
| errors 四字段 | `grep -cE "public readonly recoverable\|public readonly hint" src/errors/index.ts` | **12 / 12** ✅ |
| agent loop 长度 | `awk '/^export async function runAgent/,/^}$/' src/agent/loop.ts \| wc -l` | **43 行**（≤ 80 ✅） |
| Lingui catalog active | `grep -E "本次：.*token\|AI 自动写文档\|AI 想要写入文档\|总成本\|cost.*meter" messages.po` | 仅命中 `#~` obsolete 区（active 区 0 命中 ✅） |

---

## 3. 9 Plan SUMMARY 累积已交付摘要

| Plan | Status | Deliverable | Bundle (gzipped) |
|---|---|---|---|
| 03-01 cost-rollback | complete | 拆 `CostBadge.tsx` / `pricing.ts` / `pricing.test.ts` / Message.costCny / size-limit 80KB ratchet | 74.79 KB |
| 03-02 errors-foundation | complete | 12 AsterError 子类 × {code,message,recoverable,hint} + CircuitOpenError + StepLimitError + isAsterErrorWithMeta 守卫 | (no delta) |
| 03-03 agent-loop-core | complete | `loop.ts` 43-line runAgent + agentStore + circuit-breaker 骨架 + operationLog 骨架 + tools/index dispatch sanitize + openai-compat tools 签名 + SP-1/3/7 自跑 PASS + SP-2/6 归档 + SP-4/5 probe.tsx | 75.10 KB |
| 03-04 tools-write-word | complete | `WordAdapter.appendParagraph` + `tools/write/word.ts` ToolDef + 删 INSERT_TO_DOCUMENT_TOOL hardcode + eslint humanLabel rule + index.types.test.ts | 74.93 KB |
| 03-05 chatStore-core | complete | Message 加 `role: 'tool'` + sendMessage thin-delegate → `useAgentStore.runAgent` + 删 acceptToolCall/rejectToolCall + 删 autoInsertMode + InputBar Send disabled during run | 75.44 KB |
| 03-06 chat-ui-cleanup | complete | ChatStream 渲染 role='tool' 折叠卡 + soft-landing 卡片 + ChatBubble 删 3 legacy 子组件 + Settings 删「AI 自动写文档」开关 + 80 行孤儿 CSS 清扫 | 75.76 KB |
| 03-07 agent-control-bar | complete | AgentControlBar pause+abort+step counter+PauseIcon/PlayIcon+glass-bg CSS | 77.27 KB |
| 03-08 carry-01-selection-fix | complete | `main.tsx` Office.onReady 路径 A + `useSelectionStore` + 三宿主 selection.test.ts | 75.25 KB |
| **03-09 demo-uat** | **partial-complete** | system-prompt demo refine（教 LLM 三件事：hostLabel / parallel tool_calls / evidence vs 指令）+ system-prompt.test.ts 7/7 + `.planning/uat/03-uat-checklist.md`（190 行）+ Lingui catalog B5 obsolete 隔离 | **76.26 KB** |

---

## 4. Findings — Executor 漏掉/疑似 bug

### F1. **HIGH — `npx tsc --noEmit` 报 11 TS strict errors（运行时不崩，但 type contract 已破）**

`vitest` 用 `esbuild` 不做 TS strict check → 303 tests pass 是误信号。CI 若加 `tsc --noEmit` 会红。

| 文件 | 行 | 代码 | 错误 | 影响 |
|---|---|---|---|---|
| `src/components/ChatStream.test.tsx` | 125/141/160/176/201/217/247/263/290（9 处） | TS2353 | `useChatStore.setState({ ..., isStreaming: false, abortController: null })` 用了 ChatState 已删字段（Plan 03-05 chatStore thin-delegate 把 `isStreaming` / `abortController` 迁到 agentStore，测试 setState 没跟着改） | tests 仍 pass（zustand setState 静默接受 unknown key 然后丢掉）；type 已 drift |
| `src/components/ChatStream.tsx` | 218 | TS2554 | `onRetry={() => void retryMessage(m.id)}` — `retryMessage` 签名是 `(messageId, adapter)`，漏传 adapter | **runtime 风险**：用户在 error bubble 点重试按钮 → 触发 retryMessage(messageId, undefined) → 后续 sendMessage(prompt, ctx, undefined) → adapter undefined 进 runAgent，可能炸 |
| `src/store/chat.ts` | 102 | TS2783 | `pushMessage` 内 `role: m.role` 后紧接 `...m` spread，role 被自身覆盖 | 功能无 bug，但是死代码/redundant；轻 |

**Recommendation：** 起床后开个 follow-up 小 plan（不必入 03-09）或 hotfix commit：
- `ChatStream.test.tsx` 删 setState 里的 `isStreaming` / `abortController` 字段
- `ChatStream.tsx:218` 改为 `onRetry={() => void retryMessage(m.id, adapter)}` 并从 context 拿 adapter（已有 AdapterContext 注入）
- `chat.ts:102` 删 `role: m.role,` 一行（用 `...m` 即可）

> **触发 [feedback_recurring_failure_add_gate]**：TS strict 与 vitest esbuild 不一致已是第 2 次让 type drift（Phase 2 cost rollback 时也有类似漏）。建议在 `npm test` 之前/CI 加 `tsc --noEmit` 守门。

### F2. **MEDIUM — Lingui `messages.ts` 编译产物仍含 5 个 dead msgids**

EXECUTION-NOTES 声称「23 obsolete 已隔离到 `#~`」，**`.po` 文件确实 OK**（`#~` 注释区 5 处死字符串都在 obsolete 区），但 **`src/i18n/locales/zh-CN/messages.ts`（lingui compile 产物）的 `JSON.parse(...)` 仍包含**：

| msgid | 字面量 |
|---|---|
| `7l0l44` | 本次：{tokenCount} token |
| `90WI/n` | AI 自动写文档 |
| `gd2cUq` | 本次：{tokenCount} token · 约 ¥{0} |
| `nGwD84` | AI 自动写文档模式 |
| `wrxxVi` | AI 想要写入文档 |

**影响：** bundle 浪费约 <0.5 KB；无运行时 bug（没 React component `<Trans>` 引用这些 msgid）。

**Recommendation：** 跑 `npx lingui extract --clean` 后再 `compile`；或检查 `lingui.config.ts` 是否设了 `compileNamespace: false` 让 obsolete 也写入。优先级低，可与 F1 一起 hotfix。

### F3. **LOW — `deferred-items.md` 列出的 3 个 Unhandled Errors（baseline 既有）**

`retry.test.ts` / `queue.test.ts` 内 `setTimeout`-backed retry promise 在 it() resolve 后 reject 逃逸（NETWORK / RATE_LIMIT serialized）。`stash` 验证 baseline 同样有，**非本 phase 引入**。Plan 02 SUMMARY 已记录。不阻断。

---

## 5. Bundle 76.26 KB vs 70 KB target — Recommendation

- **当前**：76.26 KB gzipped
- **原 target**：~70 KB
- **safety budget**：80 KB（已通过）
- **Phase 3 baseline**：74.79 KB（Plan 01 cost 拆除后）
- **Phase 3 delta**：+1.47 KB（Plan 06 role='tool' 折叠卡 + Plan 07 AgentControlBar+glass UI 累计）

**Recommendation:**
1. **不调阈值**：当前 80 KB 是 NFR-02 ratchet，主动收紧已防御未来 regression。
2. **不触发 follow-up phase**：Phase 4 read tools 全套 + Phase 5 Diff Log + Phase 6 多宿主 write 都会再叠加；预算耗尽前先看实际增量。
3. **真要回到 70 KB target** → 与 F2 一起 cleanup `messages.ts` obsolete msgids；或 Phase 4 落地前评估 react-markdown chunk（当前 50.45KB gzipped 独立 chunk，已 lazy）是否能再瘦。

---

## 6. Deferred Items（用户责任 vs 后续 phase）

| 项 | 类型 | 责任 | 触发 |
|---|---|---|---|
| SC1 Word 真机 demo | 真机 UAT | **用户** | `.planning/uat/03-uat-checklist.md` § SC1 |
| SC2 AgentControlBar 真机交互 | 真机 UAT | **用户** | § SC2 |
| CARRY-01 三宿主首帧选区 | 真机 UAT | **用户** | § CARRY-01 |
| SP-4 三宿主 reverse 操作探测 | 真机 spike | **用户**（probe.tsx 已落） | § SP-4 + `.planning/spikes/SP-4-reverse-ops/findings.md` |
| SP-5 PPT slide.delete + Web 反向排序 | 真机 spike | **用户**（probe.tsx 已落） | § SP-5 + `.planning/spikes/SP-5-ppt-slide-delete/findings.md` |
| GitHub Pages 部署生效验证 | 部署后真机 | **用户**（push origin main 后） | § GitHub Pages |
| F1 TS strict 11 errors hotfix | 自动化 | 后续 plan / hotfix | Phase 3 收尾 task 或独立 phase |
| F2 Lingui messages.ts dead msgids | 自动化 | 后续 plan / hotfix（可与 F1 同 commit） | 同上 |
| F3 retry/queue Unhandled Errors | 自动化 | baseline issue，**非本 phase** | 单独 maintenance phase |
| Diff log UI 卡片 + undo all | 后续 | **Phase 5** | ROADMAP line 81 |
| Circuit breaker sliding window | 后续 | **Phase 4 ERR-03** | ROADMAP line 81 |

---

## 7. Recommended Next Action（用户起床后）

按优先级：

1. **跑真机 UAT** — `.planning/uat/03-uat-checklist.md`（SC1 / SC2 / CARRY-01 三宿主 / SP-4 / SP-5）
2. **如 UAT 全 PASS** → push origin main 触发 Pages 部署 → 验线上 manifest → 勾 ROADMAP Phase 3 顶级 `[ ]` → `/gsd-progress` 进 Phase 4
3. **如 UAT FAIL** → 按 D-25 fallback 决策（用户确认后 Claude 接力）
4. **F1 + F2 hotfix**（可放 Phase 4 前或与 UAT FAIL 修复并案）：
   - `ChatStream.test.tsx` 删 setState 死字段
   - `ChatStream.tsx:218` 加 adapter 参数（从 AdapterContext 拿）
   - `chat.ts:102` 删 role duplicate
   - `npx lingui extract --clean && compile`，清 messages.ts obsolete msgid
   - 加 `tsc --noEmit` 到 `npm test` pre-step 或 CI gate（防 F1 复发）
5. **不要在自动化层 mark Phase 3 ROADMAP 顶级 `[x]`** — 真机 UAT 通过才勾（用户偏好 [[feedback_push_before_deploy_claims]]）

---

## 8. 验证产物

- 本文件：`.planning/phases/03-agent-loop-privacy-word-demo/03-VERIFICATION.md`
- 不修改源码（verify-only）
- 不 push origin main
- 不勾 ROADMAP Phase 3 顶级行
