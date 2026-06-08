---
title: 一键 copy 聊天记录（debug + 真机 UAT 回报用）
captured: 2026-05-28
source: phase-02.1-uat-feedback
priority: medium
size: quick-task
resolves_phase: 5
resolves_req: CARRY-03
---

## 需求
真机 UAT 时无法把 Task Pane 里的 AI 输出快速复制出来核验（例如 UAT-1 ① 看长 URL 是否换行需要肉眼判断，难证伪）。加一个「复制聊天记录」按钮，把当前会话全量 dump 成 Markdown / JSON 到剪贴板。

## 落点（建议）
- 入口：Settings 主页 + 主界面右上某处
- 范围：整个会话 messages[]（user / assistant / error / system-tool-call）
- 格式：Markdown（默认）+ JSON（按 alt 键切换或独立按钮）
- 内容：每条 message 的 role / content / 时间戳 / toolCalls 状态
- 字段脱敏：API Key、Provider id 不输出；URL 保留

## 价值
- 真机 UAT 反馈成本降一截（贴 markdown 比贴截图快）
- debug 也用得上（用户上报问题时复制粘贴对话）

## 关联 phase
02.1 UAT 期间被发现需求；可走 quick task 或并入 02.2。

---

## ✅ 实装确认（v2.4 close 代码对账，2026-06-08）

**状态：DELIVERED & LIVE（形态已演化）**（CARRY-03）。
- **当前形态**：原「复制聊天记录 / 操作记录」的 **Settings 入口已移除**（05-10 UX-1，见 `SettingsPanel.tsx:431` 注释），演化为 **InputBar 的「复制调试信息」按钮**（`src/components/InputBar.tsx:335`，16-05；图标 `icons.tsx:254` clipboard-copy）。
- **落点**：`src/lib/debugReport.ts` 组装调试报告（import `src/lib/copyStepLog.ts` 的 `buildStepLog`/`redactKey` + 工具失败环形缓冲 `agent/tools/index.ts:228` + Office diagnostics），`src/lib/clipboard.ts` 写剪贴板，成功弹 toast。
- **脱敏**：`redactKey` 脱敏 API Key（满足原需求「Key 不输出」）。
- **与原 capture 的偏差（说明）**：范围从「整段会话 `messages[]` dump（Markdown/JSON 切换）」演化为「调试报告（步骤日志 + 工具失败 code/message/hint + 宿主诊断 + 构建版本戳）」——实际更贴合原始价值主张「真机 UAT 回报 + debug 上报」（贴 markdown 比贴截图快、能判是否跑缓存旧 bundle）；入口从 Settings 换成 InputBar 就近按钮。原始「全量对话 dump」未单独保留，如未来需要可另起 todo。
