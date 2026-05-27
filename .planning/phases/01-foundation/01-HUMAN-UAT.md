---
status: partial
phase: 01-foundation
source: [01-VERIFICATION.md]
started: 2026-05-27T12:00:00Z
updated: 2026-05-27T16:55:00Z
---

## Current Test

number: 1
name: 三宿主 sideload + Task Pane 三段布局可见
state: issue（清缓存后复测：布局正确，但 zh-CN 文案全渲染成 Lingui hash id — 空 catalog bug）
awaiting: 用户决定是否进入修复流程

## Tests

### 1. 三宿主 sideload + Task Pane 三段布局可见（SC1 / AC1）
expected: 在 Edge 和 Chrome 最新版 sideload manifest.xml 后，分别打开 PPT / Excel / Word for Web，三宿主均能打开 Aster Task Pane；顶部上下文卡 + 中部空态聊天（「开始使用 Aster」）+ 底部禁用输入栏全部可见，350px 三段布局；浏览器 console 无 error
result: issue
severity: major
reported: "Chrome / PPT for Web，用户手动清缓存后复测：面板标题已变为『Aster』（= 当前部署的真构建，非旧 spike），三段布局结构正确（顶部上下文卡区 / 中部居中空态 / 底部 Provider 下拉 + 输入框 + 发送按钮）。但所有 zh-CN 契约文案仍渲染成 Lingui 自动生成的 hash id：空态标题=1HgTuA（应为『开始使用 Aster』）、空态正文=bhewSJ、Provider 下拉=lsstWU、输入框=AjjbWw、发送按钮=yFzc9w。布局达标，文案完全不可读。Excel / Word 宿主、Edge 浏览器、console 检查本轮未覆盖。"
diagnosis: |
  根因（源码 + 构建配置坐实，非缓存）：
  - src/i18n/index.ts 正确调用 i18n.loadAndActivate({locale:'zh-CN', messages})
  - 但 src/i18n/locales/zh-CN/messages.ts === `export const messages = {}`（空 catalog，0 条）
  - vite.config 的 @lingui/vite-plugin + babel macros 配置正确（宏能在构建期转成 message id）
  - package.json `"build": "vite build"` 未在构建前跑 `lingui compile`；extract/compile 脚本存在但未接进 build/prebuild
  → 运行时激活空 catalog → 每个 <Trans>/t`` 宏退化为渲染其 hash id，无中文。
  修复：补 `lingui extract && lingui compile` 生成 catalog，并把 compile 接进 build（如 `"build": "lingui compile && vite build"` 或 prebuild 钩子），重新部署后复测。

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
issues: 1
pending: 3
skipped: 0
blocked: 0

## Gaps

- truth: "Task Pane 三段全部显示正确的 zh-CN 契约文案（开始使用 Aster / 配置 Provider 后即可开始对话 / Provider（即将开放）/ 输入消息… / 发送）"
  status: failed
  reason: "实测渲染成 Lingui hash id（1HgTuA/bhewSJ/lsstWU/AjjbWw/yFzc9w）而非中文"
  severity: major
  test: 1
  artifacts: ["src/i18n/locales/zh-CN/messages.ts", "package.json", "src/i18n/index.ts", "vite.config.ts"]
  missing: ["lingui extract && lingui compile 生成的非空 catalog", "build 脚本前置 lingui compile 步骤"]
