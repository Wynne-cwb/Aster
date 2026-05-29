# Spike SP-5: PPT slide.delete() Web 端可达性 + getSelectedSlides 反向排序

**Type:** ③ 用户真机
**Status:** ✅ **PASS (slide.delete)** + ⚠ **partial (反向排序未在 Phase 3 验证 — 留 Phase 5)**
**Date issued:** 2026-05-29
**Date verified:** 2026-05-29

## 验证目标
1. Office for Web PPT 端 `slide.delete()` 是否真删(部分 Web API 有 silently 失败已知问题)
2. `getSelectedSlides()` 返回顺序是否与 Ribbon 顺序一致(PITFALLS 有反向排序传闻)

## 探测方法
临时 Task Pane 按钮组件(`src/components/SpikeProbesPanel.tsx`,UAT 后 revert)挂到 Settings 底部。

## 结果(真机)

| Step | 输出 | Verdict |
|------|------|---------|
| 1) Read initial slide count | `initial slide count: 3` | ✅ baseline |
| 2) Delete last slide | `last slide delete() called OK` → `after delete: 2` | ✅ **真删** |
| 3) Check selected slides order | `selected slides count: 1` → `[0] id=256#703088496` | ⚠ N/A (用户只选了 1 张,无法验顺序) |

## 结论

### slide.delete() — Web 端真删 ✅

`PowerPoint.run` 闭包内 `slides.items[N-1].delete()` + `await ctx.sync()` 在 PPT for Web **真实生效**(3→2)。**Fallback「snapshot 兜底」作废**,Phase 5 PPT undo 直接走 `slide.delete()` API path 即可。

### getSelectedSlides 反向排序 — Phase 3 未验证

用户跑 step 3 时只选了 1 张 slide,无法复现顺序问题。这条**留 Phase 5 实现 PPT undo all 时再跑**(那时 inverse op 需要按反向顺序删插入的多张 slide,会自然撞上这个问题)。

**Phase 5 实现策略**:实现 `PptOperationLog.replayInverse()` 时,显式按反向遍历 slides 数组(`for (let i = slides.length - 1; i >= 0; i--)`),不依赖 `getSelectedSlides()` 返回顺序。PITFALLS 文档已记录此已知行为作为防御参考。

## Fallback (D-25 类型 ③) — slide.delete 部分作废

| Fallback 原议项 | 状态 |
|---|---|
| slide.delete() 不可用 → snapshot 兜底 | ❌ **作废**(真删通过) |
| getSelectedSlides 反向 → PPT adapter slides.reverse() 修正 | ⏳ 留 Phase 5 验证 + 防御 |
| 两者都失败 → demo 降级为 Word-only | ❌ 不需要(Word demo 已 SC1 PASS,且 PPT API 也通过) |

## 影响下游

- **Phase 5 PPT undo**: 直接调 `slide.delete()`(SP-5 step 2 已实测),不需要 snapshot fallback
- **Phase 5 PPT undo all**: 实现 replayInverse 时显式反向遍历自有 OperationLog 顺序,绕过 `getSelectedSlides` 排序不确定性
- **Phase 8 PPT 多步 demo**(原 ROADMAP 计划): 全部 API 走通,demo 可放心安排

## Spike artifact

- probe.tsx(原始): `.planning/spikes/SP-5-ppt-slide-delete/probe.tsx`
- 临时集成(已 revert): commits `0233c24`(挂入)→ `revert` SHA TBD(撤掉)
