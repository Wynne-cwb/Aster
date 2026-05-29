---
phase: 04-read-tools-agentcontrolbar
plan: 09
subsystem: uat
tags: [uat, real-machine, deepseek, office-js, agent-loop, deploy]

requires:
  - phase: 04-read-tools-agentcontrolbar
    provides: 三宿主 adapter.read + 11 read tools + AgentControlBar 三态/5秒 + 熔断红卡 + model select

provides:
  - 三宿主真机 UAT 全 8 项 SC PASS（SC1/SC2-Word/Excel(a+b)/PPT/SC3/SC5/SC6）
  - 3 个真机 bug 修复（reasoning_content 往返 / PPT textFrame type 过滤 / per-tool 超时）
  - 线上部署 = main-DphSYwO0.js（HEAD cfb24d7）

affects:
  - Phase 04.1（redesign 迁移）— 现有 read 工具链已真机验证可用，迁移只改视觉层
  - Phase 6（write tools）— per-tool 超时 + 熔断保护已就位，destructive 写更安全

tech-stack:
  added: []
  patterns:
    - "DeepSeek thinking 模式：assistant 消息必须回传 reasoning_content，否则带 tool 结果的下一轮 400"
    - "PPT 读文本前必须按 shape.type 白名单过滤，不能盲碰 textFrame（Image/Group/Table 抛 InvalidArgument）"
    - "dispatchTool per-tool 超时（15s）：host 卡死降级为可恢复错误，连续 3 次 → 熔断红卡，绝不冻 UI"

key-files:
  created:
    - src/agent/loop-helpers.test.ts
    - .planning/debug/reasoning-content-roundtrip.md
    - .planning/debug/ppt-list-slides-host-fail.md
  modified:
    - src/lib/sse.ts
    - src/agent/loop-helpers.ts
    - src/adapters/PptAdapter.ts
    - src/adapters/PptAdapter.read.test.ts
    - src/agent/tools/index.ts
    - src/agent/tools/index.test.ts
    - src/lib/sse.test.ts
    - .planning/phases/04-read-tools-agentcontrolbar/04-UAT-EVIDENCE.md

key-decisions:
  - "真机 UAT 抓到 3 个单测 mock 盲区 bug，均现场修复+部署+加结构性守门测试（复发即加 gate）"
  - "SC5 从计划的 N/A 升级为 PASS：UAT 早期 list_slides 故障自然触发了 CIRCUIT_OPEN 红卡，是有效真机证据"
  - "PPT 文本读取改类型白名单 fail-closed：只读 GeometricShape/TextBox/Placeholder/Callout，未知类型当无文本"

requirements-completed: [AGENT-03, AGENT-04, AGENT-12, ERR-03, ERR-04, TOOL-01, TOOL-02, TOOL-05, TOOL-06, TOOL-07, CARRY-02]

duration: ~3h（含 3 轮 bug 诊断-修复-部署-重验）
completed: 2026-05-29
---

# Phase 4 Plan 09: 三宿主真机 UAT Checkpoint Summary

**三宿主（PPT/Excel/Word）真机 UAT 全 8 项验收点 PASS；过程中暴露并修复 3 个单测 mock 从未覆盖的真实环境 bug，均已部署 + 加结构性守门测试。Phase 4 完成。**

## UAT 结果（全 PASS）

| SC | 内容 | 结果 |
|----|------|------|
| SC1 | PPT read 链路 + 中文折叠卡 | ✅ PASS |
| SC2-Word | 段落计数 + 读第 3 段 | ✅ PASS |
| SC2-Excel(a) | used range 概况 + 前 20 行（双卡） | ✅ PASS |
| SC2-Excel(b) | A-24 大区域（A1:Z100000）拒绝不爆 tab | ✅ PASS |
| SC2-PPT | slide 标题按 1→N 有序列出 | ✅ PASS |
| SC3 | AgentControlBar 三态文案 + 5 秒安抚 | ✅ PASS |
| SC5 | 熔断红卡 + 重试 + 无撤销 | ✅ PASS（升级自计划 N/A） |
| SC6 | 内置 model select / 自定义 input | ✅ PASS |

证据详见 `04-UAT-EVIDENCE.md`。SC2-Word/Excel 用现场生成的测试文档（Aster-UAT-Word.docx 5 段 / Aster-UAT-Excel.xlsx A1:E50）。

## UAT 暴露并修复的 3 个真机 bug

单测全部 mock 了 SSE / Office.js，从未跑过真实 DeepSeek thinking 往返与真实 PowerPoint Web，因此漏掉以下三类真机 bug。均已修复 + 部署 + 补结构性守门测试：

1. **reasoning_content 往返 400**（`6f2ab08`）— DeepSeek V4 thinking 模式下，带 tool 结果的第二轮请求 assistant 消息必须回传 `reasoning_content`，否则 400。Aster 全链路曾丢弃该字段 → **所有多步 tool calling 真机崩溃**。修复：sse.ts 解析 reasoning_delta、loop-helpers 累积并非空回传。守门：sse.test +2 / loop-helpers.test +2（新建）。

2. **PPT textFrame InvalidArgument**（`3cab5f7`）— `Shape.textFrame` 对 Image/Group/Table 等无文本框类型在**访问那一刻**即抛 InvalidArgument（office-js #4380/#3609），导致 list_slides/get_slide 真机必挂（测试 deck 首张即 Logo 图片）。修复：先 load `shape.type`，按白名单 `{GeometricShape,TextBox,Placeholder,Callout}` 过滤再碰 textFrame。守门：PptAdapter.read.test +2（mock 改为非文本类型访问即抛，真实复现）。

3. **并行工具调用 host 卡死冻 UI**（`cfb24d7`）— LLM 一次并行发起 8 个 get_slide → 大量 PowerPoint.run 在 Office for Web 卡住不返回，agent 无 per-tool 超时 → 冻死 5 分钟。修复：dispatchTool 加 15s 超时（Promise.race），host 卡住降级为可恢复 HOST_API 错误，连续 3 次 → 熔断红卡优雅放弃。守门：tools/index.test +2。

调试记录：`.planning/debug/reasoning-content-roundtrip.md`、`.planning/debug/ppt-list-slides-host-fail.md`。

## 门禁（最终）

- `npm run test`: 448 passed / 1 failed（449）。唯一 fail = `loop.test.ts AGENT-02 max_steps soft landing`，**Phase 3 预存在、与本期无关**（retry/queue 测试 mock 泄漏污染共享 OpenAICompatibleLLM mock）。本期新增 8 条守门测试全绿。
- `npm run build`: 通过。
- `npm run size`: 79.21 kB gzipped ≤ 80 kB（余量 ~0.79 kB）。
- 净新增运行时依赖: 0。
- 线上部署: Deploy workflow success；线上 `index.html` 引用 `main-DphSYwO0.js`（= 本地构建，哈希实证）。HEAD = `cfb24d7`。

## 已知遗留

- `loop.test.ts AGENT-02` 预存在失败（非本期引入）— 建议在 Phase 5 或单独 quick 修 retry/queue 测试 mock 泄漏。
- reasoning_content 当前只回传给 API、不渲染进 UI（超出本期范围；如需"思考过程"展示可后续做）。

## Next Phase Readiness

- **Phase 04.1（redesign 迁移）就绪**：read 工具链已真机验证可用，迁移只改视觉层（teal 重设计），不动工具/agent 逻辑。
- Phase 6 write tools：per-tool 超时 + 熔断保护已就位，destructive 写更安全。

---
*Phase: 04-read-tools-agentcontrolbar*
*Completed: 2026-05-29*
