# Phase 27: Word 工具补全 — Discussion Log

**Phase:** 27-word-tools
**Date:** 2026-06-05
**Mode:** user-led discuss（team teammate，bounded single step）
**Outcome:** 1 个人类决策（已拍板）+ 全部其余为技术事实/可自决（不问用户）

---

## 1. 输入上下文

读取：
- `.planning/REQUIREMENTS.md`（WORD-06~10 全文 + write 工具合约段）
- `.planning/ROADMAP.md`（§Phase 27 Goal + 5 SC）
- `.planning/phases/09-word-d-b-word/09-CONTEXT.md`（v2.1 Word write 范式 + WSEL-01）

scout codebase：
- `src/agent/tools/write/word.ts`（Phase 9 五工具 = 逐字模板）
- `src/adapters/WordAdapter.ts`（before-image / inverse Record / 双定位范式）
- `src/agent/operationLog.ts`（DocumentAdapterForReplay 接口 / executeReverse / PostStateSnapshot kind / 保守 readTargetState）
- `src/agent/contract.test.ts`（CONTRACT[] + D-17 fs.readFileSync 硬卡）
- `.planning/phases/08-foundation-a-f/CONTRACT.md`（能力合约表）
- `src/agent/tools/index.ts`（buildToolsForHost + PPT_TOOLS 归一化）
- `src/agent/operationLog.integration.test.ts`（mockWordRich + 真 WordAdapter 守门范式）

---

## 2. 灰区二分分析（核心产出）

> 原则：**需人类拍板**（产品取向/UX 品味，无干净默认）→ 问真人；**可研究/可自决的技术事实**（API 可用性、inverse 实现、定位、默认值、casing）→ 记录留给 research/plan，**不问用户**。

| 候选项 | 分类 | 裁定理由 |
|---|---|---|
| **批注 AI 署名策略（WORD-08）** | 🟢 **人类决策** | Office for Web 把批注作者强制署为「当前账号」，Aster 无 API 改作者 → AI 批注与用户手写批注**无法区分**。是否加内容标记区分「AI 建议」vs「人工」= 真实产品取向，两个选项都合理（透明 vs 克制），无干净默认，下游实现分叉。**= team-lead 点名的合法可问例。→ 问。** |
| WORD-06 高亮颜色/作用域 | ⚪ 技术事实 | agent 总会指定颜色；作用域默认整段（仿 set_word_character_format）。无取向。 |
| WORD-06 折入既有工具 vs 独立工具 | ⚪ 可自决 | D-18 STRAP + R1 bundle → 推荐折进 set_word_character_format，但属实现经济性判断，plan 拍。 |
| WORD-07 列表 undo 语义 | ⚪ 技术事实 | detachFromList 能否还原原列表态 = API 行为问题；不可逆则降 noop+gate。research 裁定，非用户取向。 |
| WORD-07 bullet/number | ⚪ 技术事实 | agent 按用户请求选，是参数不是配置。 |
| WORD-08 批注定位/comment id 删 | ⚪ 技术事实 | 定位算法 + inverse 实现，复用既有范式。 |
| WORD-09 页眉页脚作用域默认 | ⚪ 可自决 | 默认第一 section + primary，edge 留默认。无取向。 |
| WORD-10 edit_table 范围 | ⚪ 已锁 | REQUIREMENTS 明确「改文字」，增删行列已 defer。无需问。 |
| WORD-10 表格定位策略 | ⚪ 可自决 | tableIndex + 内容指纹双定位，复用 insert_table 范式。 |
| casing：是否建 WORD_TOOLS Set | ⚪ 事实更正 | codebase 无 WORD_TOOLS set；既有 Word 工具用 camelCase 不归一化且 UAT 通过 → 沿用 camelCase 即可。team-lead 措辞是 PPT 教训泛化，真实意图（防 snake/camel 静默 no-op）由一致 camelCase 满足。记给 plan，非用户问题。 |
| 合约（inverse Record / kind / humanLabel / 守门 / reverse 名对齐） | ⚫ 事实约束 | 非灰区，硬约束，逐字照搬 Phase 9。 |

**结论：5 个工具中，4 个（WORD-06/07/09/10）纯技术，0 处需用户取向；唯 WORD-08 有 1 处真实产品取向 → 问 1 个问题。其余一律不问（不硬造问题）。**

---

## 3. 向用户提问（AskUserQuestion）

**Header:** `P27-批注署名`（单问，multiSelect=false）

**问题：** Office for Web 的 `Range.insertComment` 自动把批注作者署为「当前登录的 Office 账号」（用户本人），Aster 无 API 改作者 → AI 批注与用户手写批注无法区分。是否让 AI 批注带轻量纯文本标记，方便协作/评审分辨「AI 建议」vs「人工批注」？（明确告知：这是唯一需拍板的产品取向，其余 API/撤销/默认值都是技术事实，不打扰。）

**选项：**
- A（推荐）：加纯文本标记（如「Aster 建议：」，无 emoji，遵循设计系统）—— 透明，契合「AI 代理」定位 + 诚实价值。
- B：不加标记，原文即批注（更克制，靠 Office 作者字段=当前账号，但无法区分 AI vs 人工）—— 契合自治+克制偏好。

**用户回答（2026-06-05）：✅ A —「加纯文本标记（推荐）」**

---

## 4. 决策落地

- **G-A（已拍板）：** AI 批注内容前缀轻量纯文本标记（无 emoji，遵循设计系统）；确切文案 = Claude's Discretion（建议「Aster 建议：」）。
- 其余全部记入 27-CONTEXT.md 的 `<research_facts>`（API 可用性 + undo 实现 + 默认值，留 plan/research）与 `<decisions>` 的 G-B（合约事实约束）/ G-C（casing 事实更正）。

---

## 5. 边界声明

- 本 step **未 git commit**（按 team-lead 指令）。
- 本 step **不** plan / research-implement / execute / review / verify / fix。
- 产物：`27-CONTEXT.md` + `27-DISCUSSION-LOG.md`（本文件）。
- 推荐下一步：`gsd-plan-phase`（Phase 27）——含 5 工具 API 可用性前验（WordApi 版本 + Office for Web）+ WORD-07 列表 undo 裁定 + R1 bundle 实测。

---

*Discussion completed: 2026-06-05*
