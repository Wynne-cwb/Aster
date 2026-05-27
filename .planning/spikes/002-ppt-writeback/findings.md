# PPT 写回（Spike #2）— PASS（带 caveat）

> ✅ **GATING**：PASS — PPT 写回端到端可行，不触发 GATING-FAILED-2.md

## 场景

在 PPT for Web 验证三个写回操作：
1. `insertSlidesFromBase64` 插入含文本的新 slide
2. 在选中 slide 上插入图片（`slide.shapes.addImage` 或同等 API）
3. 替换 slide 上的文字内容
4. smoke-test Plan B：`setSelectedDataAsync(html, {coercionType: Html})`

## 测试步骤

1. sideload spike manifest 到 PPT for Web ✓
2. 场景一：调用 insertSlidesFromBase64 → 肉眼确认新 slide 出现 ✓
3. 场景二：选中 slide / shape，插入图片 ✓（见结果）
4. 场景三：替换 slide 文字 → 肉眼确认显示更新 ✓
5. Plan B：setSelectedDataAsync(Html) ✓（见结果）

## 实测结果

**测试上下文：** PowerPoint for Web Task Pane（单浏览器；Edge+Chrome 双浏览器全矩阵留待 Phase 7 REL-04）。

**场景一（insertSlidesFromBase64）：✅ PASS**
- API 调用成功 + **肉眼确认**新 slide 真实出现在演示文稿中

**场景二（选中 slide 插图）：✅ PASS（带约束）**
- 主路径 `slide.shapes.addImage`：**不可用** —— preview API，PPT for Web 当前未 GA
- fallback `setSelectedDataAsync(Image)`：成功，**前提是选中的是整页 slide**（非文字框 shape）
- 行为细节（实测）：
  - 选中**整页 slide** → fallback 成功，图片插入**活跃 slide**
  - 选中**文字框 shape**（如标题占位框）→ fallback 失败「无法写入到当前所选内容」（文字占位框装不下图片）
- 约束：只能插到活跃 slide，无法定向插到任意非活跃 slide

**场景三（替换文本）：✅ PASS**
- `shape.textFrame.textRange.text` 写入成功（目标 slide.index=1）+ **肉眼确认**文字变更为测试串

**Plan B smoke test（setSelectedDataAsync Html）：✗ FAIL**
- 错误 5007「不受支持的枚举 / 当前宿主应用程序中不支持枚举」
- 结论：**PowerPoint 不支持 `setSelectedDataAsync` 的 `Html` coercion**（PPT 仅支持 `Text` 与 `Image`）
- 影响：**PRD R1 写的 PPT 降级方案（Html coercion）无效**。但主路径 insertSlidesFromBase64 成功，不需要此 Plan B

## 证据

- [x] 场景一肉眼确认：新 slide 出现
- [x] 场景三肉眼确认：文字变更
- [x] 场景二实测：整页选区下 fallback 插图成功
- [ ] 正式录屏：本次 session 未归档（live 确认通过）。REL-05 regression 建议补 Edge+Chrome 双浏览器录屏。

## 决策

**结果：** ✅ PASS（带 caveat）

**依据：** 三个写回场景均端到端可行（插 slide ✓ / 改文字 ✓ / 插图 ✓）。PPT 写回这条"无后台 Office 原生写回"路径成立。

**留给 Phase 4 的 3 条 caveat（实现细节，非 GATING 阻塞）：**
1. `slide.shapes.addImage`（干净的指定-shape / 指定-slide 插图）是 preview API，PPT for Web 未 GA → PPT-02 配图只能用 `setSelectedDataAsync(Image)` fallback
2. 插图 fallback 只能插到**活跃 slide**，且要求选中整页（非文字框）。PPT-02 实现需保证：插图前选区是 slide 级（用户选哪页那页即活跃，基本对得上需求）
3. `setSelectedDataAsync(Html)` 在 PPT **不支持**（错误 5007）→ **PRD R1 的 PPT Plan B（Html coercion）作废**，需换降级方案；但主路径 insertSlidesFromBase64 work，PPT-01 不依赖它
