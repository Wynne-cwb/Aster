# Spike SP-4: 三宿主 reverse 操作可达性

**Type:** ③ 用户真机
**Status:** ✅ **PASS** (2026-05-29 真机验证完成)
**Date issued:** 2026-05-29
**Date verified:** 2026-05-29

## 验证目标
- Word:paragraph.delete() 跨 await 可用?
- Excel:选区 before-image (.values) 抓取与覆写
- PPT:slides 读取(SP-5 一起跑插入+删除)

## 探测方法
临时 Task Pane 按钮组件(`src/components/SpikeProbesPanel.tsx`,UAT 后 revert)挂到 Settings 底部。
用户在 PPT/Excel/Word for Web sideload Aster → 设置底部点对应按钮 → 日志框输出结果。

## 结果(真机)

| Probe | 输出 | Verdict |
|-------|------|---------|
| **Word** delete last paragraph | `total paragraphs: 5` → `last paragraph deleted OK` | ✅ PASS |
| **Excel** selected before-image | `selected address: Sheet1!Q7` → `before-image rows: 1` | ✅ PASS |
| **PPT** read slide count | `initial slides: 3` | ✅ PASS |

## 结论

**三宿主 reverse 操作核心 API 全部可达**,Phase 5 OperationLog reverse 实现路径明确:

- **Word inverse**: 直接 `paragraph.delete()` (proxy 跨 await 安全 — 在 `Word.run` 闭包内再 load `paragraphs.items` 即可)
- **Excel inverse**: `range.load(['values', 'address'])` 抓 before-image → 反操作时 `range.values = stored` 覆写
- **PPT slides 读取**: `ctx.presentation.slides.load('items')` 跨 await 正常(配合 SP-5 PPT slide.delete 也通过)

## Fallback (D-25 类型 ③) — 不再需要

原 fallback「Phase 5 Word inverse 改 snapshot」**作废**,直接走 inverse op 路径。

## 影响下游

- **Phase 5** OperationLog: reverse() 描述符可直接走 API path,无需 snapshot 兜底
- **Phase 4** read tools: `get_range_values` / `get_paragraph_text` / `list_slides` 同样走 `*.load(...)` + `await ctx.sync()`,proxy 跨 await 安全已二次验证

## Spike artifact

- probe.tsx(原始): `.planning/spikes/SP-4-reverse-ops/probe.tsx`
- 临时集成(已 revert): commits `0233c24`(挂入)→ `revert` SHA TBD(撤掉)
