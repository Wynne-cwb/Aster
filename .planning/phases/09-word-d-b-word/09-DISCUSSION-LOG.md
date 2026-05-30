# Phase 9: Word 精准写 (D + B-Word) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 09-word-d-b-word
**Mode:** `--auto`（Claude 替用户取推荐默认；交互问题在自主模式不可用）
**Areas discussed:** 选区精度+S5降级、简单逆向三工具before-image、find_and_replace快照范围、insert_table逆向定位、undo基础设施+D-17守门

---

## G-A 选区精度 + Spike S5 降级（WSEL-01）

| Option | Description | Selected |
|--------|-------------|----------|
| paragraphIndex 主锚 + uniqueLocalId 可选消歧 | 与现有 index 语义一致，uniqueLocalId 仅校验 | ✓ |
| uniqueLocalId 为主锚 | 跨 session 重置、desktop null，不稳 | |
| 仅 paragraphIndex（不接 uniqueLocalId） | 多同名段无法消歧，违 SC#1 | |

**Selected:** paragraphIndex 主锚 + uniqueLocalId 可选消歧。
**Spike S5（uniqueLocalId 可用性）:** 不前置阻塞 → 运行时 `isSetSupported('WordApi','1.6')` 门控 + 降级（不支持→paragraphIndex+内容指纹）。真机确认列 UAT。
**Notes:** 【替用户拍 — 待复核】S5 需真机，Claude 无法自跑；降级路径即安全网，研究评 HIGH 信心。

---

## G-B 简单逆向三工具 before-image（WORD-01/02/03）

| Option | Description | Selected |
|--------|-------------|----------|
| 整段作用域 + 属性包 before-image | paragraphIndex 指定段整 range，存属性包还原 | ✓ |
| 任意字符子区间 | 需绝对字符偏移，WSEL-D1 已 defer v2.2 | |

**Selected:** 整段作用域；character/paragraph/style 各存属性包；apply_paragraph_style 同存 style+styleBuiltIn；styleName allowlist 校验（locale-safe）。
**Notes:** 【待用户复核】混合格式段（font 返 null）按 CONTRACT 锁定的简单逆向做 best-effort 还原，记为已知限制，不升级快照式。

---

## G-C find_and_replace 快照范围（WORD-04）

| Option | Description | Selected |
|--------|-------------|----------|
| 受影响段落整段 before-image | 按 paragraphIndex→原段文本快照，undo 按段还原 | ✓ |
| 全文单块快照 | body.insertText replace 还原会毁其余段格式/表格 | |

**Selected:** 受影响段落整段 before-image；上限（建议 200 段，planner 实测定）；超限 noop+gate warn；matchCase/matchWholeWord 透传；返回 replaced 数。
**Notes:** 【替用户拍 — 待复核】team-lead 点名关注项。与 Excel sort_range 写前 readSnapshot 范式同构。

---

## G-D insert_table 逆向定位（WORD-05）

| Option | Description | Selected |
|--------|-------------|----------|
| 内容指纹 marker（cells+行列数+锚） | 与 deleteParagraphByContent 范式一致 | ✓ |
| 表 ID/uniqueLocalId | Word 表无可靠稳定 ID | |
| 纯位置（afterParagraphIndex） | doc 改动后漂移、不稳 | |

**Selected:** 插入时记内容指纹存 reverse.args（Record）；delete_table_by_marker 按指纹+行列数匹配 body.tables 删；空表后备=行列数+锚位置，定位不到→skipped_error 诚实标。
**Notes:** 【替用户拍 — 待复核】team-lead 点名关注项。具体指纹字段由 researcher 查 Word.Table API 后定。

---

## G-E undo 基础设施扩展 + D-17 守门（贯穿 5 工具）

| Option | Description | Selected |
|--------|-------------|----------|
| 每工具显式 3 步守门 plan 任务 + 保守 postState | reverse 名对齐 contract.test.ts，Record 签名，integration test，保守 undefined 手改侦测 | ✓ |
| 仅 contract.test 翻 true 不加 integration test | 违 D-17 硬卡，CI 挂 | |

**Selected:** reverse 名逐字对齐 contract.test.ts；adapter 签名 Record；每工具 acceptance_criteria 含三步（contract.test integrationTest→true + integration.test 守门用例 + CONTRACT.md status→done）；新 postState kind 走保守 undefined 手改侦测。
**Notes:** 数据安全硬门，不走 quality>>cost 软化。memory project_adapter_inverse_signature / feedback_recurring_failure_add_gate 依据。

---

## Claude's Discretion
- find_and_replace 快照上限具体数字、insert_table marker 指纹字段、新 PostStateSnapshot.kind 命名、工具文案 → planner/researcher 定。

## Deferred Ideas
- 绝对字符偏移定位（WSEL-D1）→ v2.2。
- 文字高亮/列表/批注、edit_table/insert_image/页眉页脚（WORD-D1/D2）→ v2.2。
- 混合格式段精确还原升级 → v2.2 视真机反馈评估。
- `builtin-model-dropdown.md` todo — 误匹配，不纳入。
