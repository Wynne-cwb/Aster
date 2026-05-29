---
slug: ppt-list-slides-host-fail
status: fix-applied-pending-uat
trigger: "Phase 4 真机 UAT — PowerPoint Web 上 list_slides 每次失败（报『宿主操作可瞬时失败』），连续 3 次触发熔断红卡，read 链路（SC1/SC2）全崩。"
created: "2026-05-29"
updated: "2026-05-29"
phase: 04-read-tools-agentcontrolbar
---

# Debug Session: ppt-list-slides-host-fail

## Symptoms
- list_slides 在真机 PowerPoint Web 每次失败（非瞬时），3 次同码失败 → CIRCUIT_OPEN 红卡。
- selection_detail 同时**成功**（「读取了当前选区详情」）。
- 兜底文案「宿主操作可瞬时失败，可重试一次」把真实 Office.js 报错盖住。

## Root Cause (差分证据 + warnHostErr 诊断 + 官方文档三重坐实)
1. 差分证据：`getSelection()`（真机成功）做了 `slides.load('items')` 后按 `.index` 排序 → 证明 `load('items')` 在真机加载了 index，PowerPoint.run/presentation 正常。getSelection 成功 vs list_slides 失败的唯一差异 = 碰 `shape.textFrame`。
2. 部署 `warnHostErr` 诊断后，真机 console 实测错误码 = **`InvalidArgument`**。
3. 官方文档 + office-js issue #4380（表格）/#3609（组合）确认：**`Shape.textFrame` 对不支持文本框的类型（Image/Group/Table/Chart/SmartArt/Media/Line…）在「访问 .textFrame 那一刻」就抛 `InvalidArgument`**——不是读 hasText/textRange 时。

根因：`list_slides`/`get_slide`/`get_shape` 对**每个 shape 盲碰 `shape.textFrame`**。测试 deck 首张首形状是 aftership Logo（type=Image）→ 碰 textFrame 抛 InvalidArgument → 整个 PowerPoint.run 失败 → 3 次重试触发熔断。

单测从未覆盖：mock 的 `makeShape` 永远带可读 textFrame，从不模拟「碰 textFrame 即抛」的非文本类型。

注：首版尝试用 `textFrame.hasText` 守卫无效——因为抛错发生在**访问 .textFrame 本身**，连 hasText 都来不及读。

## Fix（类型白名单，fail-closed）
先 `load('items/type')` 取 `shape.type`，仅对**确定含文本框**的类型读文本，其余类型一律当无文本、绝不碰 textFrame：
- 白名单 `TEXT_SHAPE_TYPES = {GeometricShape, TextBox, Placeholder, Callout}`。
- `list_slides`：标题取**首个白名单文本形状**的首行（跳过 Image/Logo/Table…）。
- `get_slide` / `get_shape`：非白名单形状 text 返空串，不抛错；shapes scalar 字段改显式 `load('items/id,items/type,...)`。
- `list_shapes_on_slide`：scalar 字段改显式 load。
- `warnHostErr()`：catch 里 console.warn 真实 Office.js 错误码 + `debugInfo.errorLocation`（无后台诊断用，不挂 AsterError、不泄漏 stack）。

### Files changed
- `src/adapters/PptAdapter.ts` — TEXT_SHAPE_TYPES 类型白名单过滤 + 显式属性 load + warnHostErr 诊断。
- `src/adapters/PptAdapter.read.test.ts` — mock 改为**非文本类型访问 textFrame 抛错**（真实复现 InvalidArgument）；现有 get_slide 用例假类型 'Rectangle'→真实 'GeometricShape'；+2 守门测试（list_slides 跳过 Image 取文本框标题 / get_slide Image 形状 text 空串）。

### Test gate（堵复发盲区）
mock 现在让非文本类型访问 textFrame 抛错——旧实现盲碰 → RED（stash 验证：旧源码 5 fail），新实现类型过滤 → GREEN。锁死「PPT read 必须按 type 过滤才碰 textFrame」。

### Gate results
- `npm run test`: 446 passed / 1 failed（唯一 fail = loop.test.ts AGENT-02，预存在、无关）。PptAdapter.read 24 全绿（含 +2 守门）。
- `npm run build`: 通过。`npm run size`: 79.13 kB ≤ 80 kB。

## Verification Plan
- 真机重跑 SC1（PPT read 链路中文折叠卡：list_slides + get_slide 两卡成功）、SC2-PPT（标题有序列出）。⏳
- 已部署后验证（线上 hash 匹配）。

## Follow-up：8 并行 get_slide 冻死（agent loop 硬化，已修）
type-filter 修复后 list_slides + 单 get_slide 真机跑通（SC2-PPT PASS；`读取第3张` PASS，
两张中文卡 + 正确内容）。但 SC1 的"找最长"prompt 让 LLM **一次并行发起 8 个 get_slide**，
agent 顺序执行这批 host 调用时真机冻死 5 分钟（diagnose：turn 2 SSE 含 8 个 get_slide
tool_calls；单 get_slide 与 2 次顺序 run 都正常 → 病因是短时间大量 PowerPoint.run 小批次
在 Office for Web 卡死，且 agent 无 per-tool 超时）。
- Fix：`src/agent/tools/index.ts` dispatchTool 加 `TOOL_TIMEOUT_MS=15s` 超时（Promise.race），
  host 卡住 → 降级为可恢复 HOST_API 错误 → agent 可重试，连续 3 次 → 熔断红卡，绝不冻 UI。
- Test：`src/agent/tools/index.test.ts` +2（execute 永不 resolve → 超时返回 HOST_API_FAILED / 超时前 resolve 不误触发）。

## Current Focus
- status: 两处 PPT 真机问题（textFrame InvalidArgument + 并行 host 卡死）均已修复部署
- next_action: SC1（读链路+中文卡，PASS）已达标；继续 SC2-Word/Excel，收尾 Phase 4
