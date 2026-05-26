---
phase: 0
plan: "03"
subsystem: spike-gating
tags:
  - cors
  - gating-1
  - deepseek
  - aihubmix
  - office-js
dependency-graph:
  requires:
    - phase-00-plan-01 (spike/ 目录骨架 + Office.js 加载样例)
    - phase-00-plan-02 (.planning/spikes/001-cors-verify/findings.md 模板已存在)
  provides:
    - spike/cors-test.html (DeepSeek + aihubmix CORS 验证页)
    - GATING #1 验证执行入口
  affects:
    - Wave 3 后续 spike (依赖 GATING #1 PASS 才允许启动)
tech-stack:
  added: []
  patterns:
    - "原生 fetch + ReadableStream SSE reader（无 SDK，0 KB overhead）"
    - "Office.js CDN script tag（非 npm @microsoft/office-js）"
    - "事件监听器外置（无内联 onclick）"
key-files:
  created:
    - spike/cors-test.html
  modified: []
decisions:
  - "Task 1: DeepSeek model 锁定为 deepseek-v4-flash（非 pro），max_tokens=20，成本最小化"
  - "Task 1: aihubmix model 锁定为 gpt-image-1，size=256x256，成本最小化"
  - "Task 1: API Key 只从 type=password 输入框读取，零 hardcode；placeholder 不含 'sk-' 字样以通过 acceptance gate"
metrics:
  duration: "≈ 15 min（Task 1 自动执行；Task 2 人工验证未计入）"
  completed_date: "2026-05-26"
  tasks_completed: "1/2 (Task 2 awaiting human verification)"
  files_created: 1
  files_modified: 0
status: paused-at-checkpoint
checkpoint-type: human-verify
---

# Phase 0 Plan 03: GATING #1 — CORS 验证 Summary

**One-liner:** 创建 `spike/cors-test.html`，提供从生产 Task Pane 直连 DeepSeek（流式聊天）+ aihubmix（生图）的 CORS 实测入口；Task 2 人工验证暂停等待 sideload + 截图 + 录屏。

## 执行状态

- **Task 1（auto）**：✅ 完成 — spike/cors-test.html 已创建并通过全部 acceptance criteria
- **Task 2（checkpoint:human-verify）**：⏸ 暂停 — 需要人工执行 sideload / 实测 / 截图 / 录屏 / 更新 findings.md

## Task 1 完成内容

### 创建文件

- `spike/cors-test.html`（200 行，单文件 HTML + 内联 JS）

### 实现细节

| 模块 | 内容 |
|------|------|
| UI | type=password Key 输入框 × 2、3 个按钮（DeepSeek / aihubmix / 清空）、结果输出区 |
| DeepSeek 测试 | `POST https://api.deepseek.com/chat/completions`，model `deepseek-v4-flash`，stream=true，max_tokens=20，SSE 流式 reader 逐 token 显示 |
| aihubmix 测试 | `POST https://api.aihubmix.com/v1/images/generations`，model `gpt-image-1`，size `256x256`，单图生成 |
| 响应头展示 | 两个测试均读取并显示 `Access-Control-Allow-Origin` 与 `Access-Control-Allow-Methods` |
| Office.js | CDN 脚本标签加载 + `Office.onReady` 显示宿主信息（host / platform） |
| 安全 | 无 hardcoded API Key；事件监听器外置（无内联 onclick） |

### Acceptance Criteria 验证（全 PASS）

| 检查 | 期望 | 实测 |
|------|------|------|
| 文件存在 `ls spike/cors-test.html` | 0 (exit) | ✅ 存在 |
| `grep -c 'sk-'` | 0 | ✅ 0 |
| `grep -c 'api.deepseek.com/chat/completions'` | ≥1 | ✅ 1 |
| `grep -c 'api.aihubmix.com/v1/images'` | ≥1 | ✅ 1 |
| `grep -c 'deepseek-v4-flash'` | ≥1 | ✅ 1 |
| `grep -c 'deepseek-chat\|deepseek-reasoner'` | 0 | ✅ 0 |
| `grep -c 'appsforoffice.microsoft.com'` | ≥1 | ✅ 1 |
| `grep -c 'Access-Control-Allow-Origin'` | ≥2 | ✅ 4 |

### Commit

- `90076df` — `feat(00-03): 创建 spike/cors-test.html CORS 验证页`

## Task 2 等待人工执行（checkpoint:human-verify）

### 前置（人类需准备）

1. 确认 GitHub Pages 自动部署已生效，访问 `https://<username>.github.io/aster/cors-test.html` 应能打开测试页
2. 准备 DeepSeek dev/test Key 与 aihubmix dev/test Key（小额度，非生产）
3. 在 PPT for Web 中 sideload `spike/manifest.xml`，通过 Ribbon 打开 Task Pane

### DeepSeek 验证步骤

1. Task Pane 内填入 DeepSeek dev Key
2. 点击「测试 DeepSeek CORS（流式）」
3. DevTools → Network → 选 `chat/completions` → **Response Headers** 标签（不要展开 Request Headers — Authorization 在 Request 中）
4. 截图 Response Headers 区域，需含 `Access-Control-Allow-Origin` 行
5. 保存为 `.planning/spikes/001-cors-verify/deepseek-response-headers.png`

### aihubmix 验证步骤

1. 填入 aihubmix dev Key
2. 点击「测试 aihubmix CORS（生图）」
3. DevTools Network → 选 `images/generations` → **Response Headers** 标签 → 截图
4. 保存为 `.planning/spikes/001-cors-verify/aihubmix-response-headers.png`

### 录屏（必须满足其一）

- 录制整个验证过程的视频，保存到 `.planning/spikes/001-cors-verify/recording.{mp4,gif,webm}`（≤ 100MB）
- 或上传 GitHub Release 并在 `findings.md` 中写入 `release-video: <URL>`

### 更新 findings.md & MANIFEST.md

- `.planning/spikes/001-cors-verify/findings.md` 第一行从 `PENDING` 改为 `PASS` 或 `FAIL`
- 填入 DeepSeek + aihubmix 各自的 `Access-Control-Allow-Origin` 实测值
- 更新 `.planning/spikes/MANIFEST.md` 第 1 行 spike 条目状态

### Resume Signal

- 两个 Provider 均 CORS 通过 → 输入 `PASS`
- 任一失败 → 输入 `FAIL: [Provider名] — [具体错误]`，触发 D-06 Cloudflare Worker fallback 路径

## Deviations from Plan

无。Task 1 严格按 PLAN.md `<action>` 中提供的代码片段实现，唯一调整是 placeholder 文本：

| 调整 | 原因 |
|------|------|
| DeepSeek 输入框 placeholder 从 `sk-...` 改为 `DeepSeek dev key（仅 UI 输入，不写入代码）` | acceptance criteria 严格要求 `grep -c 'sk-'` 返回 0；placeholder 中的 `sk-` 字面会命中 grep。改为中文描述既满足 gate 又不改变 UI 语义。 |

这不是 Rule 1-3 范围的代码缺陷修复，只是把 plan 字面里的 placeholder 文案对齐 acceptance gate（plan `<action>` 的 placeholder 与 acceptance criteria 互相矛盾，选择 acceptance criteria 为准）。

## Threat Surface Scan

未引入计划之外的新威胁面。Plan `<threat_model>` 中 T-00-03-01 / T-00-03-02 / T-00-03-03 / T-00-03-04 的 mitigations 已在 cors-test.html 中体现：

- T-00-03-01（测试 Key 泄露进公开仓库）：`type=password` 输入框 + 无 hardcoded key + grep 'sk-' = 0 已通过 acceptance
- T-00-03-02（截图 Authorization 泄露）：findings.md 模板已注明截图规程；spike HTML 不渲染 Authorization 到结果区
- T-00-03-03（dev Key 泄露）：纯 UI 输入；不写代码、不写存储
- T-00-03-04（aihubmix 身份）：accept disposition，spike 不验证 TLS 链以外的身份

## Self-Check: PASSED

文件存在性：
- ✅ FOUND: spike/cors-test.html

Commit 存在性：
- ✅ FOUND: 90076df

Acceptance criteria：全 8 项通过（见上表）。

## Awaiting Resume

Plan 03 在 Task 2 `checkpoint:human-verify` 暂停。Orchestrator 需在人工完成验证、更新 `.planning/spikes/001-cors-verify/findings.md` 与 `.planning/spikes/MANIFEST.md` 后，根据 PASS / FAIL 结果决定 Wave 3 是否启动。
