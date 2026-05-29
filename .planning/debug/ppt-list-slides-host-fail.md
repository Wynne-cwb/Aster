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

## Root Cause (差分证据定位，非猜测)
`getSelection()`（真机成功）做了 `slides.load('items')` 后按 `.index` 排序 → 证明 `load('items')` 在真机**确实加载了 index**，且 PowerPoint.run/presentation 正常。getSelection 成功 vs list_slides 失败的**唯一差异 = 读 textFrame 文本**。

根因：`list_slides`/`get_slide`/`get_shape` 盲读 `shape.textFrame.textRange.text`。真机上图片/Logo/线条等**无文本框**形状读 textRange.text 会抛错，令整个 PowerPoint.run 失败。测试 deck 首张首形状即 aftership Logo 图片 → list_slides 必挂。

单测从未覆盖：mock 的 `makeShape` 永远带 textFrame.textRange.text，从不模拟无文本形状。

## Fix
用 `textFrame.hasText` 守卫文本读取（先 load hasText → 仅对 hasText 的 shape load/读 textRange.text）：
- `list_slides`：跳过无文本形状，标题取**首个有文本形状**的首行。
- `get_slide` / `get_shape`：无文本形状 text 返空串，不抛错；并把 shapes scalar 字段改为显式 `load('items/id,...')` 更稳。
- `list_shapes_on_slide`：scalar 字段改显式 load。
- 加 `warnHostErr()`：catch 里 console.warn 真实 Office.js 错误码（无后台诊断用，不挂 AsterError，不泄漏 stack）。

### Files changed
- `src/adapters/PptAdapter.ts` — hasText 守卫 + 显式属性 load + warnHostErr 诊断。
- `src/adapters/PptAdapter.read.test.ts` — mock 加 hasText 且**无文本形状读 text 抛错**（真实复现真机行为）；+2 守门测试（list_slides 跳过图片取文本框标题 / get_slide 无文本形状 text 空串）。

### Test gate（堵复发盲区）
mock 现在让无文本形状访问 textRange.text 抛错——旧实现盲读 → RED（已 stash 验证），新实现 hasText 守卫 → GREEN。锁死「PPT read 必须处理无文本形状」。

### Gate results
- `npm run test`: 446 passed / 1 failed（唯一 fail = loop.test.ts AGENT-02，预存在、无关）。PptAdapter.read 24 全绿（含 +2 守门）。
- `npm run build`: 通过。`npm run size`: 79.13 kB ≤ 80 kB。

## Verification Plan
- 真机重跑 SC1（PPT read 链路中文折叠卡：list_slides + get_slide 两卡成功）、SC2-PPT（标题有序列出）。⏳
- 已部署后验证（线上 hash 匹配）。

## Current Focus
- hypothesis: 盲读无文本形状 textFrame 导致 list_slides 真机必挂（差分证据定位，fix 已落地+守门）
- next_action: 部署后真机重跑 SC1/SC2-PPT；通过后继续 SC2-Word/Excel，收尾 Phase 4
