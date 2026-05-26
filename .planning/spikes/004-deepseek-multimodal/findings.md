# DeepSeek-V4 多模态验证（Spike #4）— PENDING

> 非 GATING：FAIL 时锁定 aihubmix 为唯一视觉路径，不止损

## 场景

对 `deepseek-v4-pro` 发送含 `image_url` content block 的请求，判断官方 API 是否原生多模态。

## 测试步骤（D-11 三步法）

1. 读 DeepSeek API 文档 + change log（15 分钟）
2. 构造请求：POST https://api.deepseek.com/chat/completions
   - model: deepseek-v4-pro
   - messages: [{role: user, content: [{type: text, text: "描述这张图片"}, {type: image_url, image_url: {url: "data:image/png;base64,..."}}]}]
3. 观察响应：200 + 合理描述 = PASS；4xx = FAIL

## 实测结果

API 文档确认：（待填）
实际请求响应状态：（待填）
响应内容摘要：（待填）

## 证据

- [ ] 请求/响应 JSON 截图（mask Authorization header）
- [ ] API 文档相关截图（若有多模态说明）

> ⚠ 安全提示：截图前 mask Authorization header；不要把真实 API Key 提交到证据中

## 决策

**结果：** PENDING

**PASS：** PRD Q6/R2 关闭，deepseek-v4-pro 可作为视觉路径之一
**FAIL：** 锁定 aihubmix 为 v1 唯一多模态路径（D-12 推迟默认 routing 决策到 Phase 2）
