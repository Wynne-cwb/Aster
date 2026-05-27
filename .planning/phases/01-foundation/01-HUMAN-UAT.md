---
status: partial
phase: 01-foundation
source: [01-VERIFICATION.md]
started: 2026-05-27T12:00:00Z
updated: 2026-05-27T16:55:00Z
---

## Current Test

number: 3
name: PPT 上下文卡 slide 序号正确（CR-01 真机终验）
state: 待测（中文外壳已修复并上线，可验；需选中不同 slide 看上下文卡显示「第 N 张 slide」）
awaiting: 用户配合选 slide，或继续

## Tests

### 1. 三宿主 sideload + Task Pane 三段布局可见（SC1 / AC1）
expected: 在 Edge 和 Chrome 最新版 sideload manifest.xml 后，分别打开 PPT / Excel / Word for Web，三宿主均能打开 Aster Task Pane；顶部上下文卡 + 中部空态聊天（「开始使用 Aster」）+ 底部禁用输入栏全部可见，350px 三段布局；浏览器 console 无 error
result: pass
reported: "经 quick task 260527-o8j 修复 + Pages 重新部署后，用户在 PPT for Web 真机复测：Task Pane 标题『Aster』，三段布局齐全且全部 zh-CN 契约文案正确渲染——上下文卡『未选中内容』、空态标题『开始使用 Aster』、空态正文『配置 Provider 后即可开始对话』、Provider 下拉『Provider（即将开放）』(禁用灰)、输入框『输入消息…』(禁用灰)、发送按钮『发送』(禁用)。完全符合 UI-SPEC 契约。先前的 Lingui hash id bug 已消除。"
fix: "quick task 260527-o8j（commit b02773f）：lingui compile --typescript 生成 messages.ts、build 前置 compile、提交 messages.po、删除 messages.mjs。Pages run 26503121245 部署成功，线上 main-DFNUcLuX.js 含全部中文。"
note: "Excel / Word 宿主、Edge 浏览器、console error 检查本轮未覆盖（PPT/Chrome 已验）。"

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
passed: 1
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

- truth: "Task Pane 三段全部显示正确的 zh-CN 契约文案（开始使用 Aster / 配置 Provider 后即可开始对话 / Provider（即将开放）/ 输入消息… / 发送）"
  status: closed
  reason: "已修复（quick 260527-o8j / commit b02773f）+ Pages 重新部署，真机复测全部中文正确渲染。"
  severity: major
  test: 1
  artifacts: ["src/i18n/locales/zh-CN/messages.ts", "package.json", "src/i18n/index.ts", "vite.config.ts"]
  resolved_by: "quick task 260527-o8j（Pages run 26503121245）"
