# getSelectedSlides 反序 workaround（Spike #6）— PASS（bug 实锤 + workaround 有效）

> 非 GATING：bug #3618 仍存在，sort-by-index workaround 已验证有效

## 场景

验证 Office.js bug #3618：PPT for Web getSelectedSlides() 是否返回反序结果。
验证 workaround：对结果按 slide.index 排序后是否正确。

## 测试步骤

1. 在 PPT for Web 选中多张 slide（如 slide 3, 5, 7）
2. 调用 getSelectedSlides()，打印返回顺序
3. 对比用户选择顺序与 API 返回顺序
4. 应用 sort-by-index workaround，确认顺序正确

## 实测结果（2026-05-27，PPT for Web Task Pane，多选 2 张 slide）

原始返回顺序：`[0] index=1` → `[1] index=0`（**非升序**）
预期顺序：`[0] index=0` → `[1] index=1`（升序）
Bug 是否可复现：**✅ 是，Bug #3618 真实触发**（原始 first.index=1，应为 0）
Workaround 有效：**✅ 是** —— `items.slice().sort((a,b)=>a.index-b.index)` 后顺序正确（first.index=0）

**附带发现：** `ctx.presentation.getActiveSlideOrNullObject` 在当前 PPT for Web **不是 function**（API 未就绪）。这是测试里的次要附加检查，不影响 #6 核心结论；Phase 4 若需"当前活跃 slide"应另寻 API 或用选区。

## 证据

- [x] 实测确认：原始 `[index=1, index=0]` 反序；sort 后 `[index=0, index=1]` 正确

## 决策

**结果：** ✅ PASS

**Phase 4 PPT adapter 铁律：** 所有 `getSelectedSlides()` 调用后**必须**立即 `items.slice().sort((a,b)=>a.index-b.index)` 再使用，不能信任 API 返回的原始顺序（#3618）。Spike #2 的 ppt-writeback-test 已内置此 workaround。
