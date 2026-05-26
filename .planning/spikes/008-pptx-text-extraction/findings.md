# pptx 文本提取（Spike #8）— PENDING

> 非 GATING：FAIL 时可将 pptx 列入"不支持上传"，不止损

## 场景

用 jszip + DOMParser ~80 行代码从真实 pptx 文件提取 <a:t> 文本节点。
目标：提取全部 slide 的文本内容，无需第三方 pptx 库。

## 测试步骤

1. 在 spike/ 创建 pptx-extract.html
2. 实现 80 行以内的 jszip + DOMParser 提取逻辑
3. 用 3 个真实 pptx 文件测试（简单 / 含表格 / 含图注）
4. 记录提取质量（文本完整性 vs 原始 pptx 内容）

## 实测结果

提取代码行数：（待填，目标 ≤ 80 行）
pptx 文件 1（简单）：（待填）
pptx 文件 2（含表格）：（待填）
pptx 文件 3（含图注）：（待填）

## 证据

- [ ] 提取代码截图或文件
- [ ] 三个 pptx 的提取结果对比截图

> ⚠ 安全提示：测试 pptx 不含敏感数据；截图前确认 Console 无 API Key

## 决策

**结果：** PENDING

**PASS：** Phase 3 使用 jszip + DOMParser 方案，无需第三方 pptx 库
**FAIL：** pptx 上传列入不支持（PRD R3 原始降级路径）
