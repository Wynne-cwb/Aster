# Phase 3 Plan 09 — Execution Notes

**Date:** 2026-05-29
**Executor:** Claude (parallel executor, wave 6 / sole)
**Status:** **partial-complete** — 自动化部分 done，真机 UAT defer 给用户
**Trigger:** `/gsd-execute-phase` orchestrator（用户睡觉中，明确要求 defer 真机 UAT）

---

## 已自动验证（Automated — done in this run + previous waves）

### 本次 Plan 09 自动跑通

| 项 | 验证方式 | 结果 |
|---|---|---|
| `src/agent/system-prompt.ts` refine | 替换 Plan 03 占位为完整 demo prompt（教 LLM 三件事：宿主标签 / parallel tool_calls / evidence vs 指令） | ✅ |
| `src/agent/system-prompt.test.ts` 单测 | TDD：RED commit `fdbb566` → GREEN commit `402cf55` | ✅ 7/7 it pass（it.each 三宿主 ×4 断言 + 三个单独宿主标签 + 长度 < 1500） |
| `.planning/uat/03-uat-checklist.md` | 新建 190 行 checklist（SC1 / SC2 / CARRY-01 / SP-4 / SP-5 / GitHub Pages / NFR-02） | ✅ commit `b1a529e` |
| Lingui catalog 死字符串 (B5) | `npm run extract && npm run compile`；active msgid 区无 v1 cost / confirm/auto 字符串残留 | ✅ 23 obsolete 已隔离到 `#~` 注释区 |
| `npm test` 全套 | 30 test files / 303 tests passed（baseline 296 → +7 system-prompt = 303） | ✅ |
| `npm run build` | vite 7 build OK，336 modules transformed | ✅ |
| `npm run size` | 76.26 KB gzipped / 80 KB 预算 | ✅ |

### 来自 wave 1-8 SUMMARY 的累积证据

| Plan | 关键自动化结论 | bundle size 实测 |
|---|---|---|
| 03-01 cost-rollback | 176 tests pass；size-limit 80KB 监控线落地 | 74.79 KB |
| 03-02 errors-foundation | 210/210 tests pass；ERR-01/-02 schema + sanitize 单测覆盖 | (no delta) |
| 03-03 agent-loop-core | 253 tests pass；agent skeleton + loop.test + agentStore.test + sanitize 测试 | 75.10 KB |
| 03-04 tools-write-word | 267 tests pass；WordAdapter.appendParagraph + ToolDef + dynamic tool injection | 74.93 KB |
| 03-05 chatstore-thin-delegate | 291 tests pass；chatStore 降级 + autoInsertMode 全删 | 75.44 KB |
| 03-06 chat-ui-cleanup | 296 tests pass；role='tool' 折叠卡 + soft-landing 卡片 | 75.76 KB |
| 03-07 agent-control-bar | 260 tests pass；AgentControlBar pause/abort + step counter + glass UI | 77.27 KB |
| 03-08 carry-01-selection-fix | 208 tests pass；CARRY-01 路径 A initial selection pre-fetch | 75.25 KB |
| **03-09 (本次)** | **303 tests pass**；system-prompt demo + UAT checklist | **76.26 KB** |

### Spike 自动验证状态（① 归档 / ② Claude 自跑）

| Spike | 类型 | Status | 自动化结论 |
|---|---|---|---|
| SP-1 DeepSeek 3-tool 并行 | ② Claude 自跑 | **PASS**（commit `4e90efc`） | `deepseek-v4-flash` 3 unique id + 3 index + finish_reason=tool_calls；PITFALLS A-03 未复现 |
| SP-2 include_usage | ① 归档 | PASS | v1 已验过；v2 cost 砍后不消费（`@deprecated` jsdoc） |
| SP-3 AiHubMix passthrough | ② Claude 自跑 | **PASS**（commit `4e90efc`） | gpt-4o-2024-11-20 标准 OpenAI tool_calls 透传，openai-compat 接口直接服务 |
| SP-6 proxy await | ① 归档 | PASS | PITFALLS A-06 + v1 三 adapter 已防御 |
| SP-7 三 tool 并行 fixture | ② Claude 自跑 | **PASS**（复用 SP-1 raw log） | SP-1 + SP-7 闭环 PITFALLS A-03 |

### 已自动化覆盖的 requirement（Plan 09 维度）

- **AGENT-01 / -02 / -13**：Plan 03 + 05 + 06 + 07 已落 + 测试覆盖（loop / agentStore / AgentControlBar / soft-landing）
- **AGENT-08**：Plan 04 已落 WordAdapter.appendParagraph + ToolDef + humanLabel
- **ERR-01 / -02**：Plan 02 + 03 已落 sanitize + schema 单测
- **CARRY-01**：Plan 08 已落路径 A，三宿主 SelectionPill / ContextCard initial selection 测试覆盖
- **NFR-02**：每个 plan 都跑 size，本 plan 收尾 76.26 KB ≤ 80 KB
- **system prompt（D-25 / RESEARCH §2.5）**：本 plan refine + 单测覆盖

---

## 待用户真机验证（Deferred — awaiting user real-device validation）

> 用户睡觉中，所有真机 UAT 都 defer。Plan 09 自动化部分已可以独立 commit。
> 真机 UAT 跑完后由 Claude 接力归档 `.planning/uat/03-uat-checklist.md` + SP-4/SP-5 `findings.md`。

### SC1 — Word demo prompt 跑通（AGENT-01 / AGENT-08）

- **what:** 在 Word for Web 真机 sideload Aster 后，输入 ROADMAP 固定 prompt **「写 3 段关于跨境电商物流的内容」**
- **why manual:** 需要真实 DeepSeek LLM round-trip + 真实 Office.js Word.run 在 Word for Web 的异步行为；自动化测试 mock 不到 LLM 真实 tool 调用决策
- **expected:** LLM 在 ≥ 1 个 turn 内调 `append_paragraph` ≥ 1 次 + Word 文档真多 ≥ 1 段 + Task Pane chat 出现 role='tool' 折叠卡
- **checklist 位置:** `.planning/uat/03-uat-checklist.md` § SC1

### SC2 — pause/resume/abort/软着陆 真机交互（AGENT-02 / AGENT-13）

- **what:** SC1 跑的同时观察 AgentControlBar 玻璃拟态 + 三个交互（pause / resume / abort）+ 可选 max_steps=20 软着陆卡片
- **why manual:** UI 玻璃拟态 + step counter 真机渲染 + Office.js 异步真实行为；in-flight tool 不被打断的语义只能真机验
- **checklist 位置:** `.planning/uat/03-uat-checklist.md` § SC2

### CARRY-01 — 三宿主（PPT / Excel / Word）Task Pane 首帧选区无空帧 / 无闪烁

- **what:** 三宿主分别先选中状态 → 打开 Aster Task Pane → SelectionPill / ContextCard 立即显示选区信息
- **why manual:** Office.js onReady 时序 + 三宿主 selection API 在真机的实际首帧表现；mock test 已覆盖路径 A 但真机首帧抖动只能真机看
- **checklist 位置:** `.planning/uat/03-uat-checklist.md` § CARRY-01

### SP-4 — 三宿主 reverse 操作可达性探测（type ③ 用户真机）

- **what:** 临时挂载 `.planning/spikes/SP-4-reverse-ops/probe.tsx` 的 SP4ReversePanel 到 App.tsx，跑 Word delete last paragraph / Excel before-image / PPT slides read 三个按钮
- **state:** `.planning/spikes/SP-4-reverse-ops/findings.md` status=pending；probe.tsx 已落，等用户跑
- **fallback (D-25 类型 ③):** Word delete 不可用 → Phase 5 Word inverse 改 snapshot fallback；Excel before-image 抓不到 → 同上；PPT 读 slides 失败 → 与 SP-5 一起处理
- **checklist 位置:** `.planning/uat/03-uat-checklist.md` § SP-4

### SP-5 — PPT slide.delete + Web 反向排序探测（type ③ 用户真机）

- **what:** 临时挂载 `.planning/spikes/SP-5-ppt-slide-delete/probe.tsx` 的 SP5SlideDeleteProbe 到 PPT 真机，跑读初始 slide / 删最后一张 / 多选排序三个按钮
- **state:** `.planning/spikes/SP-5-ppt-slide-delete/findings.md` status=pending；probe.tsx 已落
- **fallback (D-25 类型 ③):** slide.delete() silently 失败 → Phase 5 PPT inverse 改 snapshot fallback 或 demo 时回避 PPT delete tool；getSelectedSlides 反向 → Phase 5 PPT adapter 加 `slides.reverse()` 修正；两者都失败 → Phase 8 PPT demo 降级为 Word-only
- **checklist 位置:** `.planning/uat/03-uat-checklist.md` § SP-5

### GitHub Pages 部署后 sideload 生效验证

- **what:** Plan 01-09 全部 commit 已 push 到 main 触发 Pages 部署后，sideload manifest URL（`https://wynne-cwb.github.io/Aster/manifest.xml`）拿到的是 Phase 3 完整版
- **why manual:** 部署 1-2 分钟生效期 + Edge/Chrome sideload 实际加载行为；Pages CDN 缓存层只能真机验
- **note:** 本 plan **未 push origin main**（CLAUDE.md §发布授权允许但本次 objective 明确不 push；由 Task 8.4 续接后跑）

---

## 决策记录

- **Worktree base reset:** 启动时 `git merge-base HEAD bb8bdb8...` 返回 `4725243`（pivot 决议 commit），与 expected base `bb8bdb8` 不同。`git reset --hard bb8bdb8...` 把 worktree 拉到 wave 5 完成状态（含 wave 6/7/8 所有 commit 在历史里），符合 worktree_branch_check 协议。
- **未推送 origin main:** objective 明确 "DO NOT push origin main"；Task 8.4 push 部署动作 defer 给用户唤醒后或下一执行回合。
- **未更新 SP-4/SP-5 findings:** plan 写明真机跑完后再归档，本次 defer。
- **未更新 STATE.md / ROADMAP.md:** `<parallel_execution>` 明确禁止。

---

## 下一步（用户唤醒后）

1. **用户跑 .planning/uat/03-uat-checklist.md 真机 UAT**（SC1 / SC2 / CARRY-01 三宿主 / SP-4 / SP-5）
2. **结果反馈给 Claude**：每项 PASS / FAIL + 一句说明；SP-4/5 把 `<pre>` 日志贴回
3. **Claude 接力 Task 8.4：**
   - 归档 `.planning/uat/03-uat-checklist.md` 每项结论 + SP-4/SP-5 `findings.md` status
   - FAIL 项按 D-25 fallback 决策（Claude 提议，用户确认）
   - 全 PASS 后 `git push origin main` 触发 Pages 部署
   - 用户确认线上 manifest 生效 → Phase 3 ready for `/gsd-verify-work`
