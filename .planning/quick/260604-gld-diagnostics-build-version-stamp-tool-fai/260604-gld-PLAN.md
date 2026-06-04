---
quick_id: 260604-gld
slug: diagnostics-build-version-stamp-tool-fai
title: 诊断增强——构建版本号 + 工具失败原因 + 宿主错误 cause 捕获
date: 2026-06-04
status: in-progress
---

# Quick Task 260604-gld — 诊断增强

## 背景（为什么）

真机 UAT 复测 `apply_slide_layout` 仍 `ok=false`，但我们已证明服务器托管的是修复后代码 → 用户极可能跑在**缓存的旧 bundle**。两个诊断盲区必须补上：

1. 调试报告看不出**当前跑的是哪个构建**（Office host version 永远 0.0.0.0，无 app build 版本）。
2. 工具失败只显示 `ok=false`，**没有错误原因**（code/message/hint 全无）。

## 任务（做什么）

### Task 1 — 构建版本号戳（MUST，用户明确要求）
- `vite.config.ts`：用 `define` 注入 `__BUILD_COMMIT__`（`git rev-parse --short HEAD`，try/catch 兜底 `'unknown'`）与 `__BUILD_TIME__`（`new Date().toISOString()`，Node 构建期执行），均 `JSON.stringify`。
- 新建 `src/vite-env.d.ts`：`declare const __BUILD_COMMIT__/__BUILD_TIME__: string`（含 `/// <reference types="vite/client" />` 保留现有 env 类型）。
- `debugReport.ts buildEnvSection()`：顶部加 `- build: <commit> @ <build time>`，用 `typeof X !== 'undefined'` 守卫（define 未生效时退回 `unknown`，不崩）。

### Task 2 — 透出工具失败原因（MUST）
- `debugReport.ts buildChatSection()`：tool 消息 `ok=false` 时追加 `| error: <code> <message>`（有 hint 再加 `| hint: ...`），来源 `msg.toolResult?.error`，经 `redactKey` 脱敏。
- `copyStepLog.ts buildStepLog()`：失败 tool 在「结果：失败」后追加 `- 错误：<code> <message>` + `- 提示：<hint>`，经 `redactKey`。

### Task 3 — 捕获底层宿主错误 cause（强烈想要，安全半量 + 文档化 defer）
- `errors/index.ts HostApiError`：构造第二参 cause 时把 `(cause as Error)?.message` 存为 `this.debugCause`（守类型、截断 300 字、仅 message）。**不挂到 result** —— dispatchTool 只读 code/message/hint/recoverable，实例随 catch 丢弃，故 `dispatch.test.ts:144` ERR-02 隐私门不受影响。
- `PptAdapter.applySlideLayout` catch：包装后 `console.warn` 其 `debugCause`，把真实 Office.js 原因打到 DevTools（真机可见，ERR-02 设计注释本就承诺 adapter 层 console.warn）。
- **DEFER 在报告里展示 debugCause**：报告唯一数据源（chat 消息上的 `ToolResult`）= LLM wire 同一对象（`loop-helpers.ts:157 JSON.stringify(result)`），且被 ERR-02 隐私门硬性要求「不含宿主内部」。要把 cause 送进报告需新建 dispatchTool→chat 侧信道，超出 /gsd-quick 范围且会动隐私路径。记为后续。

## 约束
- Node 22 跑测试/构建（已确认 v22.21.1）。基线 1004 passed。
- Bundle ≤82KB gzip（`npm run build` 后再 `npm run size`）。版本戳是 inline 短字符串，预期 ~0 delta。
- 不得回归隐私测试：debugReport T-vtc-01..04 + dispatch.test.ts ERR-02。错误透出全程 `redactKey`，绝不打印 Key，绝不扩大 LLM 可见面。
- 原子提交。不 push（Team Lead 控发布）。

## 验证
- `npx tsc --noEmit` 通过。
- `npx vitest run` 全绿，计数 ≥ 1004 + 新增。
- 新增测试：构建戳行存在；失败 tool 在 chat/steplog 段显示 error code/message；HostApiError 捕获 debugCause；隐私门仍绿。
- `npm run build && npm run size` ≤ 82KB gzip。
