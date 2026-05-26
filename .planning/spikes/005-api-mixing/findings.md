# Office.js API 混用挂死验证（Spike #5）— PENDING

> 非 GATING：FAIL 时记录 workaround，不止损

## 场景

验证 Office.js bug #5022：setSelectedDataAsync × PowerPoint.run 混用后，
第二次 context.sync() 是否无限挂死。

## 测试步骤

1. 在 PPT Task Pane 执行：PowerPoint.run → setSelectedDataAsync(image/html) → 再次 PowerPoint.run
2. 记录第二次 context.sync() 的响应时间（>5s 则判定为 bug 触发）
3. 测试 workaround：每次 setSelectedDataAsync 之后插入 `await new Promise(r => setTimeout(r, 0))`

## 实测结果

Bug 是否能稳定重现：（待填）
第二次 sync 响应时间：（待填）
Workaround 是否有效：（待填）

## 证据

- [ ] DevTools Performance 截图（显示 sync 阻塞时长）

> ⚠ 安全提示：截图前确认 API Key / Authorization header 不在可见区域

## 决策

**结果：** PENDING

**记录 workaround**（Phase 4 PPT adapter 设计参考）
