---
phase: 4
slug: read-tools-agentcontrolbar
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts / vitest config (Phase 3 已落) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run && npm run build` |
| **Estimated runtime** | ~30 秒 |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run && npm run build`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 秒

---

## Per-Task Verification Map

> 由 planner 在创建 PLAN.md 时填实（task ID / 文件 / 命令）。本表给出 phase 级测试策略骨架，详见 04-RESEARCH.md §Validation Architecture。

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TOOL-01/02 | — | read 纯数据进出，proxy 不出 *.run | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ERR-03 | A-10 | 5 次内 3 失败 + 中间成功不重置 → CIRCUIT_OPEN | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TOOL-06 | A-24 | >10K cells 读前拒绝 full mode | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/agent/circuit-breaker.test.ts` — sliding window + 中间成功不重置 (ERR-03 / A-10)
- [ ] read tool size cap / token 近似估算单测 (TOOL-06 / A-24)
- [ ] read result 包装 `{result_type, content, source}` 单测 (TOOL-05)
- [ ] adapter.read() 各宿主纯数据进出单测（mock Office.run，TOOL-01/07）

*若 Phase 3 vitest 基础设施已就绪，Wave 0 仅新增上述测试文件，不需重装框架。*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PPT 复合 demo（list_slides → get_slide → insert_slide）逐步中文文案 | SC1 / AGENT-12 / TOOL-02 | Office.js 真机宿主行为 + 折叠卡渲染需肉眼 | office-addin-browser-uat：PPT 输入「在最长那张 slide 后插入总结 slide」，看每步 read 折叠卡中文人话 |
| 三宿主 read 全覆盖（Word 段落计数 / Excel used range / PPT slide 标题） | SC2 / TOOL-02 | 三宿主真机 sideload 验证 | office-addin-browser-uat：Word/Excel/PPT 各跑一次对应 read 指令 |
| AgentControlBar 三态文案 + 5 秒安抚 | SC3 / AGENT-12 | 时序/视觉行为，真机观察 | 真机跑 agent run，观察「正在读取/思考/写入」差异化文案 + 5 秒卡住安抚行 |
| Agent gave up 红卡（熔断后）| SC5 / ERR-04 | 需真机触发连续失败 | 真机构造连续 write_locked，验证红卡 + 「重新试试」入口 |
| CARRY-02 model 下拉 | SC6 / CARRY-02 | ProviderForm 交互真机 | 内置 DeepSeek/AiHubMix 编辑表单 model 字段为 select；自定义 Provider 仍为 input |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
