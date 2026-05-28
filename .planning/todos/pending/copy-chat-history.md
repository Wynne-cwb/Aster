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
