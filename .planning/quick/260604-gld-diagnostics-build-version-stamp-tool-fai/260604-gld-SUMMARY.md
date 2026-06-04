---
quick_id: 260604-gld
slug: diagnostics-build-version-stamp-tool-fai
title: 诊断增强——构建版本号 + 工具失败原因 + 宿主错误 cause 捕获
date: 2026-06-04
status: complete
commits:
  - 93ad314 feat(diag) Task 1 构建版本戳
  - 756eef4 feat(diag) Task 2 透出工具失败原因
  - cb174a3 feat(diag) Task 3 HostApiError debugCause + adapter console.warn
---

# Quick Task 260604-gld — 诊断增强 SUMMARY

## 做了什么

补上两个诊断盲区（缓存旧 bundle 问题 + 工具失败无原因），让用户**下一份调试报告**就能自证版本 + 看到真实错误。

### Task 1 — 构建版本戳（MUST，已完成）
- `vite.config.ts`：`define` 注入 `__BUILD_COMMIT__`（`git rev-parse --short HEAD`，try/catch→`'unknown'`）+ `__BUILD_TIME__`（`new Date().toISOString()`，Node 构建期）。
- `src/vite-env.d.ts`（新建）：`declare const __BUILD_COMMIT__/__BUILD_TIME__: string` + `/// <reference types="vite/client" />`。
- `debugReport.buildEnvSection()`：环境节顶部加 `- build: <commit> @ <time>`，`typeof` 守卫防 define 未生效崩溃。
- **报告行样例**：`- build: cb174a3 @ 2026-06-04T04:05:00.000Z`（define 未生效退回 `- build: unknown @ unknown`）。
- CI（GitHub Actions Deploy）checkout 后 git 可用 → hash 即线上部署版本。

### Task 2 — 透出工具失败原因（MUST，已完成）
- `debugReport.buildChatSection()`：tool `ok=false` 时追加 `| error: <code> <message>`（有 hint 再 `| hint: <hint>`），来源 `msg.toolResult?.error`，经 `redactKey`。
- `copyStepLog.buildStepLog()`：失败 tool 在「结果：失败」后加 `- 错误：<code> <message>` + `- 提示：<hint>`，经 `redactKey`。
- **失败行样例（chat 段）**：
  `[12:05 tool] 套用版式 | toolName=apply_slide_layout ok=false | error: HOST_API_FAILED PPT applySlideLayout 失败 | hint: 宿主操作可瞬时失败，可重试一次`
- **失败行样例（操作记录段）**：
  ```
  ### [12:05] 工具调用：apply_slide_layout
  - 描述：套用版式
  - 结果：失败
  - 错误：HOST_API_FAILED PPT applySlideLayout 失败
  - 提示：宿主操作可瞬时失败，可重试一次
  ```

### Task 3 — 底层宿主错误 cause（强烈想要：安全半量已做 + 报告内展示 DEFER）
**已做**：
- `HostApiError` 新增 `debugCause?: string` —— 构造第二参为 Error/string 时抽取其 `message`（截断 300 字、仅 message、守类型）。**不挂到 `ToolResult`**：`sanitizeFromAsterError` 只读 code/message/hint/recoverable 四字段，实例随 catch 丢弃。
- `PptAdapter.applySlideLayout` catch：包装后 `console.warn('[Aster] applySlideLayout 宿主错误原因:', wrapped.debugCause)` —— **真机 DevTools 控制台即可看到真实 Office.js 原因**。

**DEFER（报告内展示 debugCause）+ 原因**：
- 调试报告唯一数据源 = chat 消息上的 `ToolResult`，而该对象正是 **LLM wire 同一对象**（`loop-helpers.ts:157 JSON.stringify(result)` 直接发给模型）。
- 现有 ERR-02 隐私门（`dispatch.test.ts:144`）**硬性断言** `JSON.stringify(result)` 不含 `sk-`/`/Users/`/`process.env`/`__dirname` —— 用恶意 cause 构造的 HostApiError 验证。把 cause 放到 `result` 任何位置都会击穿此门（`do NOT regress` + `do NOT half-break privacy path`）。
- 因此「报告内展示真实 cause」需要新建 **dispatchTool → chat 侧信道**（绕开 `ToolResult`/LLM wire），属侵入式改动，超 `/gsd-quick` 单任务范围，且会动到刻意设计的隐私路径。判定为后续独立任务更安全。
- **净效果**：真机下用户开 DevTools 即见真实 Office.js 原因（Task 3 console.warn）；报告内则见 sanitize 后的 `HOST_API_FAILED | PPT applySlideLayout 失败 | hint`（Task 2）—— 已能定位「哪个工具 + 是宿主 API 失败」，两者合用基本覆盖诊断需求。

## 验证
- `npx tsc --noEmit`：✅ 通过（0 error）。
- `npx vitest run`：✅ **1013 passed, 0 failed**（基线 1004 + 新增 9）。尾部 3 个 `retry.test.ts` unhandled-rejection 是已知噪音（MEMORY: i18n extract & test noise），非真失败。
- 隐私门全绿：`debugReport.test.ts`（T-vtc-01..04 + 新 redact 用例）、`dispatch.test.ts` ERR-02（26 passed）、`copyStepLog.test.ts`（含新失败用例）。
- `npm run build && npm run size`：✅ **80.91 KB gzipped < 82 KB**。`debugReport` 为独立懒加载 chunk（gzip 2.15KB），版本戳 define 只入 debugReport chunk，**不动 main 初始包**（main 81.04KB raw / size-limit 80.91KB）。

## 新增测试
- `errors/index.test.ts`：debugCause 抽 Error.message / string / 截断 300 / 非 Error→undefined / 无 cause→undefined（5）。
- `copyStepLog.test.ts`：失败 tool 打印 code/message/hint（1）。
- `debugReport.test.ts`：build 戳行存在 / 失败 tool 聊天段透出原因 / 失败 error.message 含 sk- 仍脱敏（3）。

## 风险
- **低**。改动集中在诊断渲染路径 + 一个纯增量错误字段，无业务逻辑变更。
- 版本戳每次构建变化属预期；`typeof` 守卫确保 define 缺失时不崩。
- `console.warn` 仅在 applySlideLayout 真失败时触发，打 DevTools，永不进 LLM/报告。
- **诚实边界**：本机无法跑 Office for Web。真正价值在用户**下一份调试报告**——届时即可看到 `- build: <hash>`（自证是否旧 bundle）+ 失败工具的真实 sanitize 错误；若开 DevTools 还能看到原始 Office.js cause。
