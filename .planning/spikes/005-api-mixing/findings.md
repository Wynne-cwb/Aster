# Office.js API 混用挂死验证（Spike #5）— INCONCLUSIVE（规避规则成立）

> 非 GATING：重现不出具体挂死，但"不混用 Common+Host API"的规避规则成立，不止损

## 场景

验证 Office.js bug #5022：setSelectedDataAsync × PowerPoint.run 混用后，
第二次 context.sync() 是否无限挂死。

## 测试步骤

1. 在 PPT Task Pane 执行：PowerPoint.run → setSelectedDataAsync(image/html) → 再次 PowerPoint.run
2. 记录第二次 context.sync() 的响应时间（>5s 则判定为 bug 触发）
3. 测试 workaround：每次 setSelectedDataAsync 之后插入 `await new Promise(r => setTimeout(r, 0))`

## 实测结果（2026-05-27，PPT for Web Task Pane）

Bug 是否能稳定重现：**重现不出**
第二次 sync 响应时间：N/A（序列未跑到第二次 sync）
Workaround 是否有效：N/A

**实测细节：**
- 测试 A（重现 #5022）：Step 1 `PowerPoint.run` sync ✅ 成功（12ms），随后序列中断于 `setSelectedDataAsync(Html)` 步骤，报「当前宿主应用程序中不支持枚举」（错误 5007）
- Workaround 测试：Step 1 sync ✅（20ms），同样中断于 setSelectedDataAsync(Html) 「不支持枚举」

**为什么重现不出：** #5022 的重现序列依赖 `setSelectedDataAsync(html, {coercionType: Html})` 去制造 Common+Host API 混用。但 PPT **根本不支持 Html coercion**（错误 5007，与 Spike #2 Plan B 失败、本测试两次中断三处一致）。序列在"混用"发生之前就被"Html 不支持"挡掉，因此无法触发原 #5022 的挂死。可能 MS 已修该挂死，也可能只是被 Html-不支持错误提前阻断——无法判定。

## 证据

- [x] 实测确认：序列两次均中断于 setSelectedDataAsync(Html) 「不支持枚举」5007
- [ ] DevTools Performance 截图：未采集（序列未达挂死点，无阻塞可截）

## 决策

**结果：** ⚠ INCONCLUSIVE（重现不出具体挂死）—— 非 GATING，不止损

**规避规则成立（Phase 4 PPT adapter 设计铁律）：**
- **不要在同一流程里混用 Common API（setSelectedDataAsync）与 Host API（PowerPoint.run）。** 这条规则本身就是 #5022 的 workaround，无论挂死是否仍存在，照做即规避。
- Phase 4 PPT 写回主路径全部走 Host API（insertSlidesFromBase64 / textRange.text）；图片插入用的 `setSelectedDataAsync(Image)` 应作为独立操作，不与 PowerPoint.run 在同一 tick 交错。
- 附带确认（与 #2 一致）：`setSelectedDataAsync(Html)` 在 PPT 不支持（5007），PRD R1 的 Html Plan B 作废。
