# getSelectedSlides 反序 workaround（Spike #6）— PENDING

> 非 GATING：FAIL（bug 仍存在）时确认 sort-by-index workaround，不止损

## 场景

验证 Office.js bug #3618：PPT for Web getSelectedSlides() 是否返回反序结果。
验证 workaround：对结果按 slide.index 排序后是否正确。

## 测试步骤

1. 在 PPT for Web 选中多张 slide（如 slide 3, 5, 7）
2. 调用 getSelectedSlides()，打印返回顺序
3. 对比用户选择顺序与 API 返回顺序
4. 应用 sort-by-index workaround，确认顺序正确

## 实测结果

原始返回顺序：（待填）
预期顺序：（待填）
Bug 是否可复现：（待填）
Workaround 有效：（待填）

## 证据

- [ ] DevTools Console 截图（显示返回顺序对比）

> ⚠ 安全提示：截图前确认 Console 内不含 API Key 明文

## 决策

**结果：** PENDING
