---
status: partial
phase: 01-foundation
source: [01-VERIFICATION.md]
started: 2026-05-27T12:00:00Z
updated: 2026-05-27T12:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 三宿主 sideload + Task Pane 三段布局可见（SC1 / AC1）
expected: 在 Edge 和 Chrome 最新版 sideload manifest.xml 后，分别打开 PPT / Excel / Word for Web，三宿主均能打开 Aster Task Pane；顶部上下文卡 + 中部空态聊天（「开始使用 Aster」）+ 底部禁用输入栏全部可见，350px 三段布局；浏览器 console 无 error
result: [pending]

### 2. 6 个 ribbon 按钮点击均打开 Task Pane（SC2 / FOUND-10）
expected: 三宿主各点击 2 个 Aster ribbon 按钮（共 6 次）——PPT: 主题→大纲 / 选中 slide 配图；Excel: 自然语言→公式 / 公式解释·调修；Word: 多风格润色 / TL;DR——每次点击均打开 Task Pane，不执行业务逻辑
result: [pending]

### 3. PPT 上下文卡 slide 序号正确（SC3，CR-01 真机终验）
expected: 在 PPT for Web 依次选中第 1 / 3 / 最后一张 slide，上下文卡显示「第 1 张 slide」/「第 3 张 slide」/「第 N 张 slide」，与实际序号完全匹配、无偏移（CR-01 已在代码层修复并有回归测试覆盖，此为真机最终验收）
result: [pending]

### 4. GitHub Pages 生产托管可达（SC5 / INSTALL-06）
expected: 浏览器访问生产 Pages URL（见 README sideload 草稿）确认 HTTPS 可达、页面加载、manifest.xml 图标 URL 可访问、sideload 后 Task Pane 可打开
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
