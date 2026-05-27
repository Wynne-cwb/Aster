---
phase: "01"
plan: "04"
subsystem: manifest
tags: [manifest, ribbon, office-addin, commands]
dependency_graph:
  requires: ["01-01"]
  provides: ["manifest.xml", "commands.html", "src/commands.ts"]
  affects: ["01-05", "01-06"]
tech_stack:
  added: []
  patterns:
    - "XML manifest 三宿主单文件模式（Presentation/Workbook/Document）"
    - "ShowTaskpane Action 模式（Phase 1 统一打开 Task Pane）"
    - "FunctionFile 轻量入口 + Office.actions.associate 预留扩展点（Phase 4-6 ExecuteFunction 用）"
    - "manifest 3 必修项：Version>=1.0 / base 三件套 / Supertip Description 引 LongString"
key_files:
  created:
    - manifest.xml
    - commands.html
    - src/commands.ts
  modified: []
decisions:
  - "采用 ShowTaskpane 而非 ExecuteFunction（Phase 1 按钮行为 = 打开 Task Pane，最简实现，FOUND-10）"
  - "6 个按钮共用同一 ButtonId1 TaskpaneId（所有按钮打开同一 Task Pane，Phase 1 无差异化需求）"
  - "commands.ts 预注册 openTaskpane associate，Phase 1 不触发，Phase 4-6 改 ExecuteFunction 时直接可用"
  - "Supertip Description 全部使用 LongString（必修项 3，避免运行时 AddinManifestError）"
metrics:
  duration: "~15 分钟"
  completed: "2026-05-27T07:41:14Z"
  tasks_completed: 2
  files_created: 3
---

# Phase 01 Plan 04: Manifest 正式化 + 6 Ribbon 按钮 Summary

**一行概述：** 将 spike 验证 manifest 升级为正式三宿主 XML manifest（正式 GUID、PRD 功能名 6 ribbon 按钮、3 必修项保留），配套 commands.html 和 src/commands.ts FunctionFile 入口。

---

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | manifest.xml — 提升 + 6 ribbon 按钮 + 正式化 | `7ad8b89` | manifest.xml（290 行新增） |
| 2 | commands.html + src/commands.ts（FunctionFile 入口） | `9cf013c` | commands.html、src/commands.ts |

---

## What Was Built

### manifest.xml

从 `spike/manifest.xml` 升级为正式 manifest：

**正式化：**
- `<Id>` 换为正式 GUID `8046ED7D-C288-4D5D-896B-259A5BD3330D`（替换 spike 占位 `00000000-0000-0000-0000-000000000001`）
- `<ProviderName>` 改为 `Aster`，去掉 "(Phase 0 Spike)"
- `<DisplayName>` 改为 `Aster`
- `<Description>` 改为正式 AI 提效描述，无 spike 字样

**三宿主结构：**
- `Presentation`（PPT）：shared runtime long lifetime + 2 ribbon 按钮
- `Workbook`（Excel）：shared runtime long lifetime + 2 ribbon 按钮
- `Document`（Word）：shared runtime long lifetime + 2 ribbon 按钮

**6 ribbon 按钮（PRD 候选功能名，D-09）：**
- PPT：`主题→大纲`（id: PPT.Outline）/ `选中 slide 配图`（id: PPT.SlideImage）
- Excel：`自然语言→公式`（id: XL.Formula）/ `公式解释·调修`（id: XL.ExplainFix）
- Word：`多风格润色`（id: WD.Polish）/ `TL;DR`（id: WD.Tldr）

**manifest 3 必修项（spike #010 教训）全部保留：**
1. `<Version>1.0.0.0</Version>` — 必须 >=1.0
2. base 段三件套：`<IconUrl>`、`<HighResolutionIconUrl>`、`<SupportUrl>` — VersionOverrides 内的不顶用
3. 6 个按钮 Supertip `<Description>` 全部引 `<bt:LongStrings>` 中的 id — 引 ShortString 时 validate 不报错但 Office 运行时报 AddinManifestError

### commands.html

- `<html lang="zh-CN">`，title `Aster — Commands`
- CDN Office.js script（先于 module 加载，INSTALL-04）
- `<script type="module" src="/src/commands.ts">` 引入 Vite 处理的 commands entry
- 内嵌注释说明 Phase 1 FunctionFile 角色与 Phase 4-6 扩展指南

### src/commands.ts

- `Office.onReady()` 内预注册 `Office.actions.associate('openTaskpane', handler)`
- handler 中 `event.completed()` 正确调用
- 注释说明：Phase 1 走 ShowTaskpane，associate 暂未被触发；Phase 4-6 改 ExecuteFunction 时直接可用
- `tsc --noEmit` 0 错误（使用 `Office.AddinCommands.Event` 类型）

---

## Deviations from Plan

无 — 计划执行完全按照 PLAN.md 描述，无需额外修复。

---

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| T-01-09 mitigated | manifest.xml | 所有 URL 强制 HTTPS（wynne-cwb.github.io），AppDomains 仅列 deepseek/aihubmix 两个 Provider 域名，无 Aster 自有服务器域名 |
| T-01-10 mitigated | manifest.xml | 使用正式 GUID 替换 spike 占位 `00000000-0000-0000-0000-000000000001`，避免与其他 add-in ID 冲突 |
| T-01-11 accepted | src/commands.ts | Phase 1 ribbon 仅打开 Task Pane，不传递参数/凭证，无 Key 外发 |

---

## Known Stubs

无 — manifest.xml、commands.html、src/commands.ts 无占位数据，均为功能完整的配置与入口文件。

---

## Self-Check

**文件存在性验证：**
- `manifest.xml`：存在（290 行）
- `commands.html`：存在（30 行）
- `src/commands.ts`：存在（30 行）

**commit 存在性验证：**
- `7ad8b89`：存在（feat(01-04): promote manifest.xml）
- `9cf013c`：存在（feat(01-04): add commands.html + src/commands.ts）

**验收标准核对：**
- [x] `grep -c '<Control xsi:type="Button"' manifest.xml` = 6
- [x] 3 个 base `<Host Name=` 声明：Presentation、Workbook、Document
- [x] 3 处 `<Runtime ... lifetime="long"/>`（每宿主一个）
- [x] `<Version>1.0.0.0</Version>`
- [x] base 段含 `<IconUrl`、`<HighResolutionIconUrl`、`<SupportUrl`
- [x] 6 个按钮标签：主题→大纲、选中 slide 配图、自然语言→公式、公式解释·调修、多风格润色、TL;DR
- [x] `<Id>` 不再是全 0 占位
- [x] 无 "Spike"/"spike" 字样残留
- [x] 每个 Supertip Description resid 均在 `<bt:LongStrings>` 内有定义
- [x] commands.html：CDN Office.js + `lang="zh-CN"` + module src/commands.ts
- [x] src/commands.ts：`Office.onReady` + `Office.actions.associate('openTaskpane')` + ShowTaskpane 注释
- [x] `tsc --noEmit` 0 错误

## Self-Check: PASSED
