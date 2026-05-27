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
state: 已修复待复验（quick 260527-opp / commit e8edc67，build+catalog 层已验；待 Pages 部署后真机看到「第 N 张 slide」）
awaiting: Pages 部署完成 + 用户选 slide 真机确认

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
result: issue
severity: major
reported: "PPT for Web 真机：选中第 2 张 slide 时，上下文卡区域空白（既非『未选中内容』也非『第 2 张 slide』）。getSelection() 确实返回了 kind:'ppt'（否则会显示『未选中内容』），但 formatSelection 的插值串渲染成空。CR-01 的 off-by-one（slideIndex+1）本身代码无误，但更上层的 i18n 渲染让 slide 序号根本显示不出来。"
diagnosis: |
  根因（与 quick 260527-o8j 的空 catalog 不同，是独立 bug）：
  - formatSelection.ts 把 `t` 当普通函数参数（t: TFn）接收，并用 `t`第 ${n} 张 slide`` 等插值。
  - 这不是 @lingui/macro 的宏调用点 → lingui extract 扫不到 → 「第 {n} 张 slide」「选中区域 {0}」「选中 {n} 字」三条插值消息从未进 catalog（.po 里 0 匹配，仅 8 条非插值串）。
  - 运行时 ContextCard 传入 useLingui() 的真 t，查不到这些消息 → 返回空串 → 上下文卡空白。
  - 受影响：PPT(第 N 张 slide) / Excel(选中区域) / Word(选中 N 字) 全部选区显示。
  - 测试盲区：formatSelection.test.ts 用 identity mock t（还原成普通插值），CR-01 回归测试过了，却完全没碰真 Lingui runtime，掩盖了集成 bug。
  修复方向：改用可提取的 Lingui 动态消息方式——用 `msg`(@lingui/core/macro) 定义 MessageDescriptor + i18n._() 解析；formatSelection 改为接收 i18n（而非裸 t）；extract/compile 后这三条会进 catalog；并把单测从 identity mock 改为走真实/代表性 i18n，关闭测试盲区。

### 4. GitHub Pages 生产托管可达（SC5 / INSTALL-06）
expected: 浏览器访问生产 Pages URL（见 README sideload 草稿）确认 HTTPS 可达、页面加载、manifest.xml 图标 URL 可访问、sideload 后 Task Pane 可打开
result: [pending]

## Summary

total: 4
passed: 1
issues: 1
pending: 2
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

- truth: "PPT 选中 slide 时上下文卡显示『第 N 张 slide』，序号与实际一致（CR-01）"
  status: failed
  reason: "真机选中第 2 张 → 上下文卡空白。formatSelection 用裸参数 t 做插值，三条选区消息（第 N 张 slide / 选中区域 / 选中 N 字）未被 lingui extract 提取进 catalog，运行时查不到渲染为空。单测用 identity mock t 掩盖了此集成 bug。"
  severity: major
  test: 3
  status_update: "fix_deployed_pending_reverify — quick 260527-opp（commit e8edc67）已实现全部修复项；build+catalog 层验证通过（dist 含 第 {0} 张 slide 等编译消息，64 测试过）。待 Pages 部署后真机复验上下文卡显示「第 N 张 slide」。"
  artifacts: ["src/components/formatSelection.ts", "src/components/ContextCard.tsx", "src/components/formatSelection.test.ts", "src/i18n/locales/zh-CN/messages.po"]
  resolved_by: ["用 msg 宏(@lingui/core/macro) + i18n._() 解析", "formatSelection 改接收 i18n", "单测改 catalog 解析守卫(generateMessageId+真 i18n)，关闭 identity-mock 盲区"]
