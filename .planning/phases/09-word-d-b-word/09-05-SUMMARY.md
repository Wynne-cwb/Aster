---
phase: 09-word-d-b-word
plan: "05"
subsystem: word-adapter-tools
tags: [word, apply-paragraph-style, undo, allowlist, locale-safe, d08, d17]
dependency_graph:
  requires:
    - 09-04 (set_word_character_format + set_word_paragraph_format)
    - 08-foundation-a-f CONTRACT.md (undo 合约地基)
  provides:
    - apply_paragraph_style ToolDef (word 宿主注册)
    - restore_paragraph_style adapter 方法（Record 签名，D-17 守门）
    - D-08 allowlist 校验（工具层，VALID_BUILTIN_STYLES Set）
  affects:
    - src/adapters/WordAdapter.ts
    - src/agent/tools/write/word.ts
    - src/agent/tools/write/word.test.ts
    - src/agent/tools/index.ts
    - src/agent/contract.test.ts
    - .planning/phases/08-foundation-a-f/CONTRACT.md
tech_stack:
  added: []
  patterns:
    - D-08 allowlist: VALID_BUILTIN_STYLES Set 在 tool 层 execute 前拦截非法 styleName
    - D-17 Record 签名: restoreParagraphStyle(args: Record<string, unknown>) 第一行解包
    - before-image D-06: 同时存 style + styleBuiltIn，还原时优先 styleBuiltIn（locale-safe）
    - 双重定位: index 快路径 + 内容指纹降级（防 index drift，复用已有范式）
key_files:
  created: []
  modified:
    - src/adapters/WordAdapter.ts
    - src/agent/tools/write/word.ts
    - src/agent/tools/write/word.test.ts
    - src/agent/tools/index.ts
    - src/agent/tools/index.test.ts
    - src/agent/tools/read/tools.test.ts
    - src/agent/contract.test.ts
    - .planning/phases/08-foundation-a-f/CONTRACT.md
decisions:
  - "INVALID_PARAM 加入 ToolErrorCode（Rule 2 补全）：D-08 要求返回此 code，原枚举缺失。新增一行枚举值，不影响现有映射逻辑"
  - "工具数量从 12 → 13：index.test.ts + read/tools.test.ts 同步更新断言，防计数测试误报"
metrics:
  duration: "7 minutes"
  completed_date: "2026-05-31"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 8
---

# Phase 9 Plan 05: apply_paragraph_style（WORD-03）实现摘要

一句话：用 `VALID_BUILTIN_STYLES` Set 在工具层守门 + `styleBuiltIn` 属性 locale-safe 写入，彻底消除中文 Office 环境下样式名 crash 风险，并通过 Record-signature `restoreParagraphStyle` 满足 D-17 undo 守门。

## 实现完成

### Task 1: WordAdapter.ts 新增 applyParagraphStyle + restoreParagraphStyle

**`applyParagraphStyle(args: Record<string, unknown>)`**
- 写前读取 `{ style, styleBuiltIn }` 存为 before-image（D-06）
- 使用 `para.styleBuiltIn = styleName as Word.BuiltInStyleName` 写入（locale-safe，避免中文 Office `ItemNotFound`）
- `uniqueLocalId` 消歧（D-04）：WordApi 1.6 支持时先精确匹配，不支持时仅用 index
- allowlist 校验在 ToolDef 层（不在 adapter），adapter 信任调用方

**`restoreParagraphStyle(args: Record<string, unknown>)`（D-17）**
- 第一行解包：`index / expectedText / before`（D-17 Record 签名守门）
- 双重定位：index 快路径 + 内容指纹降级（防 index drift）
- 还原策略：`before.styleBuiltIn !== 'Other'` → `para.styleBuiltIn`；否则回退 `para.style`（自定义样式）

### Task 2: ToolDef + 测试 + 注册 + 合约标志位

- **word.ts**：`applyParagraphStyle` ToolDef + `VALID_BUILTIN_STYLES` Set（21 个有效值）；allowlist 校验返回 `INVALID_PARAM + recoverable: true`
- **word.test.ts**：3 个 D-08 allowlist 真实断言 GREEN（替换 Wave 0 placeholder）；形状测试骨架更新
- **index.ts**：注册 `applyParagraphStyle` 到 `wordWriteTools` 数组；`ToolErrorCode` 新增 `INVALID_PARAM`
- **index.test.ts + read/tools.test.ts**：工具数量断言 12 → 13
- **contract.test.ts**：`apply_paragraph_style` `integrationTest: false → true`
- **CONTRACT.md**：`apply_paragraph_style` `status: planned → done`，`integration_test: false → true`

## 成功标准验证

- [x] `apply_paragraph_style` 工具已实现 + 注册，含 D-08 allowlist 校验
- [x] `restore_paragraph_style` inverse：Record 对象签名（非位置参，D-17）
- [x] `apply_paragraph_style` integration 守门测试 GREEN（真 WordAdapter，`rolled_back`）
- [x] `word.test.ts` allowlist 3 个测试 GREEN（真实断言，替换 placeholder）
- [x] `CONTRACT.md` 行 + `contract.test.ts` 行：`done / integrationTest: true`
- [x] `tsc --noEmit` 通过；只有 `find_and_replace` + `insert_table` inverse 测试保持 RED（计划 06/07）

## 偏差记录

### 自动修复（Rule 2）

**1. [Rule 2 - 补全必要功能] 新增 `INVALID_PARAM` 到 `ToolErrorCode` 枚举**
- **发现于：** Task 2 实现 D-08 allowlist 时
- **问题：** `ToolError.code` 是 `ToolErrorCode` 类型，但原枚举不含 `INVALID_PARAM`；计划明确指定此 code（D-08 设计决定），且 `word.test.ts` 测试断言 `error.code === 'INVALID_PARAM'`
- **修复：** `src/agent/tools/index.ts` 新增 `| 'INVALID_PARAM'` 枚举值（含注释说明用途）
- **文件：** `src/agent/tools/index.ts`
- **提交：** 2a77f99

**2. [Rule 2 - 修正计数测试] 工具数量断言 12 → 13**
- **发现于：** Task 2 注册 `applyParagraphStyle` 后全套测试
- **问题：** `index.test.ts` 和 `read/tools.test.ts` 的断言 `toHaveLength(12)` 在新增第 8 个 write tool 后失败
- **修复：** 更新为 `toHaveLength(13)`，补充 `apply_paragraph_style` 名称检查
- **文件：** `src/agent/tools/index.test.ts`, `src/agent/tools/read/tools.test.ts`
- **提交：** 2a77f99

## 已知 Stub

无。所有实现为真实逻辑，无硬编码空值或 placeholder。

## Threat Flags

无新增 threat surface（plan 内 T-9-09/T-9-10/T-9-11 已由实现覆盖）。

## Self-Check: PASSED

所有文件已存在，提交哈希已验证：
- Task 1 commit: 9576fa9 (`feat(09-05): add applyParagraphStyle + restoreParagraphStyle to WordAdapter`)
- Task 2 commit: 2a77f99 (`feat(09-05): implement apply_paragraph_style tool + D-08 allowlist + contract done`)
