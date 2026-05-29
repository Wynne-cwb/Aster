---
phase: quick
plan: 260529-vtc
subsystem: debugReport, icons, InputBar
tags: [debug, clipboard, security, tdd]
dependency_graph:
  requires: [useProviderStore, useAgentStore, useChatStore, useSelectionStore, formatTime]
  provides: [buildDebugReport, copyToClipboard, ClipboardIcon]
  affects: [InputBar]
tech_stack:
  added: []
  patterns: [TDD RED-GREEN, vi.mock module factory, vitest stubGlobal]
key_files:
  created:
    - src/lib/debugReport.ts
    - src/lib/debugReport.test.ts
  modified:
    - src/components/icons.tsx
    - src/components/InputBar.tsx
    - src/i18n/locales/zh-CN/messages.po
    - src/i18n/locales/zh-CN/messages.ts
decisions:
  - T-vtc-01：绝不调 getKey()，只输出 configuredKeyIds（id 列表），KEY GATE 守门测试钉死
  - T-vtc-03：只记录 partitionKey 是否存在（boolean），不记录 partitionKey 值
  - ClipboardIcon 按真实 icons.tsx 的 {...base} spread 范式编写，props 与 GearIcon 一致
  - messages.po 随 InputBar 新增翻译条目一并提交（coverage test 守门要求）
metrics:
  duration: "~8 分钟"
  completed: "2026-05-29"
  tasks_completed: 2
  files_modified: 6
---

# Quick Task 260529-vtc: 一键复制调试信息 Summary

**One-liner:** 在 InputBar 工具行 gear 旁加剪贴板按钮，点击生成含 5 节 Markdown 的调试报告并写入剪贴板，API Key 原文结构性守门杜绝泄露。

## Objective

用户在任意状态点击 InputBar 剪贴板按钮，得到一段包含环境/Provider 配置/Agent 状态/当前选区/聊天记录的 Markdown 报告，直接粘给 Claude 排查问题，取代截图+口头描述。

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 (RED) | debugReport.test.ts 守门测试 | f10164b | src/lib/debugReport.test.ts |
| 1 (GREEN) | debugReport.ts 实现 | a209a1f | src/lib/debugReport.ts |
| 2 | ClipboardIcon + InputBar 按钮 + i18n | d534b92, 77065a2 | icons.tsx, InputBar.tsx, messages.po/ts |

## Task 3: 真机校验（✅ 已校验通过 — approved 2026-05-29）

用户在真机（Office for Web sideload，已部署版本）确认按钮位置、复制行为、报告结构、Key 无泄露，2026-05-29 回复 "approved"。

## 收尾后补丁（executor summary 之后发生）

- **`70a107b` fix：懒加载 debugReport 守 size-limit。** orchestrator 收尾发现 CI `Bundle Size Guard` 红：debugReport 经 InputBar 静态 import 进了初始 bundle，82.1KB 超 82KB 限额 102B。改为 `await import('../lib/debugReport')` → 拆独立 4KB lazy chunk，initial 回到 80.98KB。CI + Deploy 双绿。教训见记忆 project_bundle_size_guard（npm run size 测陈旧 dist，动 bundle 前须先 build 再 size；非热路径模块一律懒加载）。
- **部署状态：** 已 push origin/main，GitHub Pages 部署成功，线上 sideload 可用。最终 HEAD（功能侧）= `70a107b`。

### 原始校验步骤（已通过，留档）

Task 3 是 blocking checkpoint，需要用户在 Office for Web 或本地 dev server 真机验证，自动化代理无浏览器宿主，无法自行操作。

**校验步骤：**

1. `npm start` 启动本地开发服务器（或在 Office for Web 已部署版本打开 Aster Task Pane）
2. 确认 InputBar 工具行：gear 右边有剪贴板图标按钮（细线风格，与 gear 尺寸一致，`size=15 strokeWidth=1.4`）
3. 不发任何消息，直接点剪贴板按钮 → 应立即（无卡顿）复制成功，按钮 title 变为「已复制 ✓」，2 秒后恢复
4. 打开文本编辑器粘贴，检查报告结构：
   - 有 `# Aster Debug Report` 标题和 ISO 时间戳
   - 有 `## 环境`、`## Provider 配置`、`## Agent 状态`、`## 当前选区`、`## 聊天记录` 5 节
   - Provider 配置节含 baseURL / model，但无任何 `sk-` 开头的 Key 字符串
   - 聊天记录节显示「（无消息）」
5. 发一条消息，等回复后再点复制，确认聊天记录节有 user / assistant 两条
6. 选中 Excel/Word 内容再点复制，确认「当前选区」节包含正文文字

**恢复信号：** 输入 "approved" 或描述问题

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - i18n Coverage] 新增翻译条目后需同步更新 messages.po**

- **Found during:** Task 2 完成后 `npm test` 运行时
- **Issue:** InputBar 加入 `t\`复制调试信息\`` / `t\`已复制\`` / `t\`已复制 ✓\`` 三个 Lingui 宏后，`coverage.test.ts` 守门测试通过 `git diff messages.po` 检测到 catalog 未更新
- **Fix:** 运行 `npm run extract && npm run compile`，将更新后的 messages.po + messages.ts 作为单独 commit `77065a2` 提交
- **Files modified:** src/i18n/locales/zh-CN/messages.po, src/i18n/locales/zh-CN/messages.ts
- **Commit:** 77065a2

**2. [Rule 1 - Test Fix] [SELECTION TEXT] 测试的 vi.mocked 范式与模块工厂 mock 不兼容**

- **Found during:** Task 1 GREEN 阶段首次运行
- **Issue:** 测试中用 `vi.mocked(useSelectionStore.getState).mockReturnValueOnce(...)` 对手工 mock 对象调用 vitest spy API，报 `TypeError: vi.mocked(...).mockReturnValueOnce is not a function`
- **Fix:** 改为直接替换 `selMod.useSelectionStore.getState = vi.fn(...)` 并在测试结束后恢复原始引用
- **Files modified:** src/lib/debugReport.test.ts
- **Commit:** a209a1f（随实现一起修正）

## Known Stubs

无。debugReport 从真实 Zustand store 读取数据，Office API 读取有 try/catch 兜底（失败输出说明文字而非占位符）。

## Threat Flags

无新增网络端点、auth 路径或文件访问模式。buildDebugReport 读取内存 store + Office API，写入 OS 剪贴板，与原 threat_model 描述一致。

## npm test 结果

```
tsc --noEmit: 通过（0 错误）
vitest run: 468 passed / 1 failed（预存在 flaky）

预存在 flaky（与本任务无关，Phase 04.1 STATE.md 已记录）：
  src/agent/loop.test.ts > runAgent — AGENT-02 max_steps soft landing
  → expected 'idle' to be 'soft-landing'（测试隔离问题，单跑通过）

守门测试全通过：
  ✓ [KEY GATE] buildDebugReport 输出不包含 API Key 原文
  ✓ [SECTIONS] 报告含 5 个分节标题
  ✓ [EMPTY MESSAGES] 空消息时不崩溃，输出（无消息）
  ✓ [SELECTION TEXT] word 选区正文正确包含在报告里
  ✓ Lingui catalog coverage（messages.po 已更新）
```

## Self-Check

- [x] src/lib/debugReport.ts 存在
- [x] src/lib/debugReport.test.ts 存在
- [x] src/components/icons.tsx 包含 ClipboardIcon
- [x] src/components/InputBar.tsx 包含 handleCopyDebug
- [x] 提交 f10164b, a209a1f, d534b92, 77065a2 均存在
- [x] 4 个守门断言全绿
- [x] tsc --noEmit 无报错

## Self-Check: PASSED
