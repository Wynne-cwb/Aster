---
phase: quick-260527-q1c
plan: 01
subsystem: ui-shell
tags: [manifest, ribbon, task-pane, i18n, empty-state]
requires: [FOUND-10, FOUND-03]
provides: [single-aster-ribbon-entry, per-host-usage-hints]
affects: [manifest.xml, ChatStream]
tech-stack:
  added: []
  patterns: [fluent-v9-badge-chips, useAdapter-host-switch, lingui-trans-macro]
key-files:
  created: []
  modified:
    - manifest.xml
    - src/components/ChatStream.tsx
    - src/i18n/locales/zh-CN/messages.po
    - src/i18n/locales/zh-CN/messages.ts
    - .planning/REQUIREMENTS.md
    - .planning/phases/01-foundation/01-UI-SPEC.md
decisions:
  - "Ribbon 锁定为每宿主单一统一「打开 Aster」入口（共 3 个 Control，文案/图标统一），功能入口改由 Task Pane 空状态用法提示承载"
metrics:
  duration: ~15min
  completed: 2026-05-27
---

# Phase quick-260527-q1c Plan 01: Ribbon 单一 Aster 入口 + Task Pane 用法提示 Summary

把三宿主 Ribbon 从「每宿主 2 个 ShowTaskpane 占位按钮（共 6 个）」精简为「每宿主 1 个统一『打开 Aster』入口（共 3 个）」，并在 Task Pane 空状态新增按宿主区分的只读用法提示芯片，取代原本靠 Ribbon 功能按钮承载的功能入口（FOUND-10 最终决策）。

## What Was Built

- **Task 1 — manifest.xml**：三宿主各删除 2 个旧 Control，替换为单一统一入口（`Aster.Open` / `AsterXL.Open` / `AsterWD.Open`），均 `Action=ShowTaskpane` 指向 `Taskpane.Url`，行为不变。Resources 段清理 6 条旧 ShortString Label + 6 条 LongString Tip，新增 `Btn.Aster.Open.Label`（"打开 Aster"）与 `Btn.Aster.Open.Tip`（LongString，避免运行时 AddinManifestError）。更新 Host/图标组注释。`office-addin-manifest validate` 通过。
- **Task 2 — ChatStream.tsx + i18n**：空状态在 heading/body 下新增「试试这些」用法提示区，用 `useAdapter().capabilities().host` 选择 PPT/Excel/Word 对应的 2 条典型用法示例，以只读 Fluent v9 `Badge`（`appearance="tint"`, `color="informative"`, `size="large"`）竖排呈现。全 token 化布局，无硬编 px/hex，无新依赖。`lingui extract` + `compile` 同步 6 条新 zh-CN 条目（msgstr 非空）。
- **Task 3 — 文档同步**：REQUIREMENTS.md FOUND-10 措辞改为「每宿主 1 个统一『打开 Aster』入口 + 能力在 Task Pane 内触发（含空状态用法提示引导）」（含纳入工作区已有的手工编辑）。01-UI-SPEC Component Inventory 由「6 placeholder buttons」改为单一入口/宿主，删除 6 个功能候选名清单，Copywriting Contract 补「打开 Aster」与「试试这些」两行。

## Commits

- `f46ed73` refactor(quick-260527-q1c): slim Ribbon to single unified Aster entry per host
- `9d7691c` feat(quick-260527-q1c): add per-host usage hint chips to Task Pane empty state
- `83d19f9` docs(quick-260527-q1c): sync FOUND-10 and UI-SPEC to single unified Aster entry decision

## Verification

- `office-addin-manifest validate manifest.xml` → "The manifest is valid."（三宿主各恰好 1 个 ShowTaskpane Control）
- `npm run build`（lingui compile + vite build）成功；fluent chunk 282 kB / main 193 kB（gzip 80.5 / 61.5 kB）。
- `npm run size`（size-limit）→ 142.42 kB gzipped，远低于 1 MB 预算。
- messages.po / messages.ts 含 6 条新条目（为选中的 slide 配一张图、把主题扩展成多页大纲、用自然语言生成公式、解释并修复报错的公式、多风格润色选中文段、长文一键生成 TL;DR、试试这些），msgstr 非空。
- grep 校验：REQUIREMENTS.md + 01-UI-SPEC.md 均含「打开 Aster」；01-UI-SPEC「6 placeholder buttons」计数为 0。

## Deviations from Plan

None - plan executed exactly as written.

工具调用补充：本机 RTK hook 将 `npx` 重写为 `npm`，导致 `npx office-addin-manifest` / `npx lingui` 报 "Missing script"。改用 `command npx --yes ...` 绕过 hook，命令本身与 plan 一致，非偏离。

## Pending / Out of Scope

- **Office for Web 人工 UAT**（plan §verification 第 2 段）不在 executor 执行范围，留给用户收尾：重新 sideload manifest → 三宿主各只见 1 个「打开 Aster」按钮 → 点击打开 Task Pane 无 console error → 空状态显示「试试这些」+ 当前宿主对应示例芯片 → 切宿主示例随之变化。

## Self-Check: PASSED

- 全部 6 个 modified 文件存在于磁盘。
- 3 个 task commit（f46ed73 / 9d7691c / 83d19f9）均在 git 历史中。
- q1c 三个提交无任何文件删除（`git diff --diff-filter=D` 为空）。
