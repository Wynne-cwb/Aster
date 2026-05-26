# PPT 写回（Spike #2）— PENDING

> ✅ **GATING**：FAIL 时写 GATING-FAILED-2.md，项目进入 PRD 修订状态

## 场景

在 PPT for Web（Edge + Chrome 各一次）验证三个写回操作：
1. `insertSlidesFromBase64` 插入含文本的新 slide
2. 在选中 slide 上插入图片（`slide.shapes.addImage` 或同等 API）
3. 替换 slide 上的文字内容

## 测试步骤

1. sideload spike manifest 到 PPT for Web
2. 场景一：调用 insertSlidesFromBase64，验证新 slide 出现且含文本
3. 场景二：选中特定 slide，插入图片，验证图片出现在目标 slide
4. 场景三：读取 slide 文字，替换为新文字，验证显示更新
5. 每个场景录屏
6. 同时 smoke-test Plan B：setSelectedDataAsync(html, {coercionType: Html})

## 实测结果

<!-- 填写时间：Day 1-2 -->

**场景一（insertSlidesFromBase64）：**
- Edge：（待填）
- Chrome：（待填）

**场景二（选中 slide 插图）：**
- Edge：（待填）
- Chrome：（待填）

**场景三（替换文本）：**
- Edge：（待填）
- Chrome：（待填）

**Plan B smoke test（setSelectedDataAsync html）：**
- 结果：（待填）

## 证据

- [ ] 场景一录屏（Edge）
- [ ] 场景一录屏（Chrome）
- [ ] 场景二录屏（Edge）
- [ ] 场景二录屏（Chrome）
- [ ] 场景三录屏（Edge 或 Chrome）

> ⚠ 安全提示：截图/录屏前确认 Authorization header 不在可见区域，或已 redact

## 决策

**结果：** PENDING

**PASS 条件：** 三个场景在 Edge + Chrome 均端到端成功

**PARTIAL PASS 条件（降级）：** 主路径部分不可用时，Plan B setSelectedDataAsync(html) 可作为替代方案——此时 PRD R1 降级路径激活，记录在此

**FAIL 行动：**（仅在所有路径均 FAIL 时填写）
- 当天写 `.planning/spikes/GATING-FAILED-2.md`
- 评估 PRD PPT killer 场景范围缩减
