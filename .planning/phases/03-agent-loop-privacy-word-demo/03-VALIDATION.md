---
phase: 3
slug: agent-loop-privacy-word-demo
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 03-RESEARCH.md §Validation Architecture (line 956+).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.0 + @testing-library/react 16.3 + jsdom 29 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` (= `vitest run`) |
| **Full suite command** | `npm test && npm run build && npm run size` |
| **Bundle gate** | `npm run size` (size-limit, NFR-02 阈值建议 ~80KB gzipped 留余量) |
| **Estimated runtime** | ~30 seconds (unit + component);build+size ~25 s |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test && npm run build && npm run size`
- **Before `/gsd-verify-work`:** Full suite must be green + Word 真机 UAT pass
- **Max feedback latency:** 30 seconds (vitest unit + component)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-XX-XX | cost-rollback | 1 | (cleanup) | — | N/A | build+test | `npm test && grep -r "costCny\|tokenCount\|CostBadge" src/` (0 命中 except 删除 PR) | ✅ existing test will fail until done | ⬜ pending |
| 3-XX-XX | errors-foundation | 1 | ERR-01 | T-ERR-01 | Tool error 4 字段 schema 强制 (code/message/recoverable/hint),code ∈ 8 枚举 | unit | `npm test -- src/agent/tools/dispatch.test.ts -t "ToolError schema"` | ❌ Wave 0 (新建) | ⬜ pending |
| 3-XX-XX | errors-foundation | 1 | ERR-02 | T-ERR-02 | mock tool 抛 stack + 绝对路径 + 假 Key → sanitized toolResult 不含路径/Key/stack | unit | `npm test -- src/agent/tools/dispatch.test.ts -t "sanitize ERR-02"` | ❌ Wave 0 | ⬜ pending |
| 3-XX-XX | errors-foundation | 1 | ERR-02 | T-ERR-02 | 陌生异常(非 AsterError)→ 兜底 UNSUPPORTED + 占位 hint | unit | `npm test -- src/agent/tools/dispatch.test.ts -t "unknown exception fallback"` | ❌ Wave 0 | ⬜ pending |
| 3-XX-XX | agent-loop-core | 2 | AGENT-01 | T-AGENT-01 | runAgent 多步 while 循环,LLM 无 tool_calls 时自然退出 | unit | `npm test -- src/agent/loop.test.ts -t "natural stop"` | ❌ Wave 0 | ⬜ pending |
| 3-XX-XX | agent-loop-core | 2 | AGENT-01 | — | tool dispatch → role:'tool' 消息正确 push 到 chatStore | unit | `npm test -- src/agent/loop.test.ts -t "tool result push"` | ❌ Wave 0 | ⬜ pending |
| 3-XX-XX | agent-loop-core | 2 | AGENT-02 | T-AGENT-02 | max_steps=20 hit 时不 abort 而 push 软着陆 prompt | unit | `npm test -- src/agent/loop.test.ts -t "max_steps soft landing"` (mock LLM 永远返 tool_calls) | ❌ Wave 0 | ⬜ pending |
| 3-XX-XX | agent-loop-core | 2 | AGENT-02 | — | 用户点「继续 20 步」时 step counter reset,同一 agentRunId 累计 ≥20 | unit | `npm test -- src/agent/loop.test.ts -t "soft landing continue"` | ❌ Wave 0 | ⬜ pending |
| 3-XX-XX | agent-loop-core | 2 | AGENT-13 | T-AGENT-13 | 单一 abort 入口;visibility / user / max_steps / circuit 4 路都调 `agentStore.abort(reason)` | unit | `npm test -- src/agent/agentStore.test.ts -t "abort sources"` | ❌ Wave 0 | ⬜ pending |
| 3-XX-XX | agent-loop-core | 2 | AGENT-13 | — | pause primitive: await resume promise 不打断 in-flight tool | unit | `npm test -- src/agent/agentStore.test.ts -t "pause does not abort inflight"` | ❌ Wave 0 | ⬜ pending |
| 3-XX-XX | tools-write-word | 2 | AGENT-08 | — | append_paragraph 调用 WordAdapter + humanLabel 输出 + reverse descriptor 形态 | unit | `npm test -- src/agent/tools/write/word.test.ts` | ❌ Wave 0 | ⬜ pending |
| 3-XX-XX | tools-write-word | 2 | AGENT-08 | — | 每个 ToolDef 必须 export `humanLabel` 函数(Phase 3 TS 强制不阻断 lint,但接口要求) | unit | `npm test -- src/agent/tools/index.test.ts -t "humanLabel required"` | ❌ Wave 0 | ⬜ pending |
| 3-XX-XX | chatstore-thin-delegate | 3 | AGENT-01 | — | sendMessage thin-delegate 到 agentStore.runAgent;Message 加 'tool' role + agentRunId/agentStep 字段 | unit | `npm test -- src/store/chat.test.ts -t "thin delegate"` | ✓ existing chatStore test 需更新 | ⬜ pending |
| 3-XX-XX | agent-control-bar | 3 | AGENT-01 | — | pause/abort 按钮 + step counter 渲染 + idle 不渲染 + 软着陆 card 渲染 | component | `npm test -- src/components/AgentControlBar.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 3-XX-XX | carry-01-selection-fix | 1 | CARRY-01 | T-CARRY-01 | 三宿主首次 mount(已选中状态下)selection ctx 不是 'none' | component | `npm test -- src/components/SelectionPill.test.tsx -t "CARRY-01 initial selection"` + `ContextCard.test.tsx` | ❌ Wave 0 (新建) | ⬜ pending |
| 3-XX-XX | carry-01-selection-fix | 1 | CARRY-01 | — | mock adapter `getSelection()` resolve 后,App 首帧 SelectionPill 已显示「第 N 张 slide」 / 「选中 N 字」 / 「选中区域 A1:C10」 | component | three host mocks integration | ❌ Wave 0 | ⬜ pending |
| 3-XX-XX | (all plans) | all | NFR-02 | — | bundle 实测 ≤ ~70KB gzipped(实测目标),≤ 1MB(硬上限) | bundle check | `npm run build && npm run size` | ✓ size-limit 已配,需调阈值 | ⬜ pending |
| 3-XX-XX | demo-uat | 3 | SC1 | — | Word 真机 prompt「写 3 段关于跨境电商物流的内容」LLM 调 `append_paragraph` ≥1 次 + 文档真多段 | manual UAT | `office-addin-browser-uat` skill — 无自动化(D-06 强制) | manual-only | ⬜ pending |
| 3-XX-XX | demo-uat | 3 | SC2 | — | 真机用户点 pause → step 不再进 + in-flight tool 跑完 + step counter 显示「步骤 N (paused)」 | manual UAT | 真机 + DevTools | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Task IDs 占位为 `3-XX-XX`,plan-checker 通过 + STATE 提交后由 planner 填实际编号。

---

## Wave 0 Requirements

新增测试文件(Wave 0 必须建):

- [ ] `src/agent/loop.test.ts` — AGENT-01 / AGENT-02 / AGENT-13 主路径
- [ ] `src/agent/agentStore.test.ts` — pause/resume/abort/setCurrentStep state transitions
- [ ] `src/agent/tools/index.test.ts` — ToolDef 接口、buildToolsForHost、humanLabel required
- [ ] `src/agent/tools/dispatch.test.ts` — ERR-01 schema + ERR-02 sanitize + 兜底
- [ ] `src/agent/tools/write/word.test.ts` — append_paragraph adapter 调用 + humanLabel + reverse descriptor
- [ ] `src/agent/operationLog.test.ts` — appendOperation + getOperationsByRun(骨架)
- [ ] `src/components/AgentControlBar.test.tsx` — pause/abort 按钮、step counter、idle 不渲染、软着陆 card
- [ ] `src/components/SelectionPill.test.tsx`(新建)— CARRY-01 初值断言
- [ ] `src/components/ContextCard.test.tsx`(新建)— CARRY-01 初值断言
- [ ] `src/main.test.tsx`(新建,可选)— CARRY-01 路径 A integration test:mock Office.onReady + mock adapter.getSelection → 断言 App 收到 initialSelection prop

**已有可复用 mock 基础设施:**
- `src/adapters/DocumentAdapter.test.ts` — 示范 DocumentAdapter stub mock 模式(适合 agent loop 测试)
- `src/lib/sse.test.ts` — 示范 SSE chunk fixture 构造(可复用为 SP-1 多 tool fixture)
- `src/components/ChatStream.test.tsx` — 示范 RTL + jsdom 模式

**Framework install: 无需。** Vitest + RTL + jsdom 已全装。

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Word 真机 demo 跑通 | SC1 / AGENT-01 / AGENT-08 | 验证 LLM 实际 tool 调用 + Office.js append_paragraph 在 Word for Web 真机 round-trip | 1) `npm run build && npm run start:word`;2) sideload Aster 到 Word for Web;3) 输入 ROADMAP 固定 prompt「写 3 段关于跨境电商物流的内容」;4) 观察:Task Pane chat 出现 ≥1 条 role:'tool' 折叠卡片「步骤 N: 在文档末尾追加段落『...』」;5) 观察 Word 文档真多段(≥1 段)|
| pause/abort 真机交互 | SC2 / AGENT-13 | UI 玻璃拟态 + step counter 真机渲染 + Office.js 异步真实行为 | 1) 跑 demo prompt;2) LLM 第二步前点 pause → 观察:agent 不再进、AgentControlBar 显示 paused、in-flight tool 跑完;3) 点 resume → 继续 |
| 三宿主首次取选区(CARRY-01)| CARRY-01 | Office.js onReady 时序 + 三宿主 selection API 在真机的实际表现 | 1) PPT/Excel/Word 三宿主分别真机 sideload;2) 进入文档时先选中(slide N / range A1:C10 / 段落);3) 打开 Aster Task Pane → 观察 SelectionPill 立即显示选区信息(不需要再点一次)|
| max_steps 软着陆 | SC2 / AGENT-02 | mock LLM 永远返 tool_calls 跑满 20 步,需要真实 LLM round-trip 或开发 mock provider | 单元测试已覆盖(mock LLM);真机可选,触发条件难复现 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (上面 10 个新增测试文件)
- [ ] No watch-mode flags (npm test = `vitest run`,不是 `vitest`)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (执行完成后由 verifier 翻转)

**Approval:** pending
