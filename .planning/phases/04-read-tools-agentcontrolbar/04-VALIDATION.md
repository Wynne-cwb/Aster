---
phase: 4
slug: read-tools-agentcontrolbar
status: draft
nyquist_compliant: true
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

> 从 9 个 PLAN.md 抽实 task ID / plan / wave / requirement / 命令。本表给出 phase 级覆盖；read 真宿主行为见下「Manual-Only Verifications」。

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| P01-T1 circuit-breaker sliding window | 01 | 1 | ERR-03 | A-10 | 最近 5 次内 ≥3 同 code + 中间成功不重置 → CIRCUIT_OPEN | unit | `npx vitest run src/agent/circuit-breaker.test.ts` | ❌ W0 | ⬜ pending |
| P01-T2 read-result 包装 + size cap | 01 | 1 | TOOL-05, TOOL-06 | A-24 | `{result_type,content,source}` 包装 + 50K token cap + truncated 标记 | unit | `npx vitest run src/agent/read-result.test.ts` | ❌ W0 | ⬜ pending |
| P02-T1 ReadableQuery/Result 类型 + read() 接口 | 02 | 1 | TOOL-01 | — | 离散 per-query read 类型契约（禁 fat inspect） | type | `npx tsc --noEmit`（DocumentAdapter 无类型错） | ✅ | ⬜ pending |
| P02-T2 Office namespace eslint rule | 02 | 1 | TOOL-07 | A-06 | `*.run` 命名空间不出闭包（fixture 触发，真码干净） | lint | `npx eslint src/agent/__fixtures__/ns-violation.ts`（fixture 命中） | ❌ W0 | ⬜ pending |
| P03-T1 WordAdapter.read() 5 kind | 03 | 2 | TOOL-01, TOOL-02 | — | Word read 纯数据出 `*.run`，proxy 不外泄 | unit | `npx vitest run src/adapters/WordAdapter.read.test.ts` | ❌ W0 | ⬜ pending |
| P04-T1 PptAdapter.read() 5 kind | 04 | 2 | TOOL-01, TOOL-02 | — | PPT read batch + index 排序（list_slides 含 title） | unit | `npx vitest run src/adapters/PptAdapter.read.test.ts` | ❌ W0 | ⬜ pending |
| P05-T1 ExcelAdapter.read() 4 kind | 05 | 2 | TOOL-01, TOOL-02, TOOL-06 | A-24 | >10K cells 读前 cellCount 判定拒绝 full mode | unit | `npx vitest run src/adapters/ExcelAdapter.read.test.ts` | ❌ W0 | ⬜ pending |
| P06-T1 11 read ToolDef + registry 接线 + 包装注入 | 06 | 3 | TOOL-02, TOOL-05 | — | ToolDef `kind:'read'` + wrapReadResult 注入 evidence 标记 | unit | `npx vitest run src/agent/tools/read/tools.test.ts` | ❌ W0 | ⬜ pending |
| P06-T2 agentStore 三态字段 + setPhase + system prompt 防注入 | 06 | 3 | AGENT-12, TOOL-05 | A-05 | `[USER]` 指令 vs tool evidence 区分（prompt injection 防御） | unit | `npx vitest run src/agent/agentStore.test.ts` | ❌ W0 | ⬜ pending |
| P07-T1 AgentControlBar 三态文案 + 5 秒安抚 | 07 | 4 | AGENT-12 | A-12 | currentPhase 差异化文案 + 计时挂组件不进 store | unit | `npx vitest run src/components/AgentControlBar.test.tsx` | ❌ W0 | ⬜ pending |
| P07-T2 ChatStream「Agent gave up」红卡 + 截断预览 + circuit 元数据 | 07 | 4 | ERR-04 | A-10, A-22 | 红卡 X/Y 受控 + 重新试试 runAgent + 无撤销 + read 截断预览 | unit | `npx vitest run src/components/ChatStream.giveup.test.tsx src/agent/circuit-breaker.test.ts` | ❌ W0 | ⬜ pending |
| P08-T1 ProviderForm model select + aihubmix 默认 model | 08 | 4 | CARRY-02 | — | 内置 select / 自定义 input 分支 | unit | `npx vitest run src/components/Settings/ProviderForm.test.tsx` | ❌ W0 | ⬜ pending |
| P08-T2 registry.ts 过时常量更新 | 08 | 4 | CARRY-02（D-09）| — | model 常量仅改值，类型无错 | type | `npx tsc --noEmit`（registry 无错） | ✅ | ⬜ pending |
| P09-T1 全套 vitest + build + size gate + 部署 | 09 | 5 | TOOL-02, AGENT-12, ERR-04, CARRY-02 | — | 80KB gate + 全套不回归 | suite | `npm run test -- --run && npm run build && npm run size` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*File Exists ❌ W0 = Wave 0 须先建测试文件（见下）。*

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter
- [ ] `wave_0_complete: true`（执行 Wave 0 建测试文件后才勾）

**Approval:** pending（执行前最后一项待 Wave 0 完成）
