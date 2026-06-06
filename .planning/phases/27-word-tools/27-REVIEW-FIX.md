---
status: all_fixed
phase: 27
phase_name: word-tools
fixed_at: 2026-06-06
review_source: 27-REVIEW.md
findings_in_scope: 5
fixed: 5
backlog: 3
skipped: 0
iteration: 1
gates:
  typecheck: pass
  build: pass
  tests: "1109 passed（既有 1104 + 新增 5 守门用例）；3 个尾部 retry unhandled errors 为已知噪音"
  bundle_size: "82.48 KB gzip（limit 100 KB）"
structural_tests_added: true
recommended_next: verify  # gsd-verify-work 27
---

# Phase 27（Word 工具补全）代码审查修复报告

**修复来源**：`27-REVIEW.md`（2 MEDIUM + 6 LOW）
**修复方式**：逐条修复，每修复原子 commit（本地，未 push）
**结论**：审查范围内全部 finding 已处置——2 MEDIUM + 3 LOW 已修并补结构性守门测试；3 LOW 经判断列入 backlog / 真机 UAT 跟踪（含 1 条本就是「正向确认、非缺陷」）。

---

## 逐条处置

| # | 级别 | 处置 | Commit | 说明 |
|---|---|---|---|---|
| MR-1 | MEDIUM | ✅ 已修 + 守门测试 | `491a500` / `7448150` | editTableCell 存「编辑后」指纹 |
| MR-2 | MEDIUM | ✅ 已修 + 守门测试 | `491a500` / `7448150` | editTableCell + setWordHeaderFooter 写后回读不一致 throw |
| LR-1 | LOW | ✅ 已补测试断言 | `7448150` | WORD-06 highlightColor=null 前向 + restore 双路径断言 |
| LR-2 | LOW | ✅ 已修 | `fb3725c` | WORD-07 非法 list style 白名单回落 |
| LR-3 | LOW | ✅ 已修 | `fb3725c` | WORD-09 setWordHeaderFooter 补 WordApi 1.1 门控 |
| LR-4 | LOW | 📋 backlog（真机 UAT） | — | comment.id 跨 undo 稳定性是未验证假设 |
| LR-5 | LOW | ✅ 无需修（正向确认） | — | executeBatch 对新工具明确 throw = 诚实降级，非缺陷 |
| LR-6 | LOW | 📋 backlog（整洁度） | — | 命名碰撞 + 共享 mock 复用 |

---

## MEDIUM 修复详情（必修，触及项目硬价值）

### MR-1 — editTableCell undo 指纹定位失效（撤销安全 / 防静默数据损坏）

**根因**：`buildTableFingerprint` = 首行文本 join + 维度。`editTableCell` 旧实现在
**写入前**算指纹并存进 `reverse.args`。若编辑首行单元格，写入后文档里该表指纹立即改变；
`restoreTableCell` 用**当前（编辑后）**文档重算指纹去匹配存储的**编辑前**指纹 →
三策略（tableIndex+指纹 / 遍历指纹 / 兜底裸 index）全部落空 → 退回裸 `tableIndex`。
一旦在前向与撤销之间发生**表序漂移**且编辑的是**首行**，兜底 tableIndex 指向另一张表 →
**撤错表的单元格、静默数据损坏且不报错**。

**修法**（采用 review 建议方案 1）：写入 + `ctx.sync()` 后**重载 `table.values`** 再
`buildTableFingerprint`，改存「编辑后」指纹。`restoreTableCell` 在当前文档状态下即可用
指纹精确命中正确表（含漂移场景）。

**结构性守门测试**（`operationLog.integration.test.ts`，新 `makeLiveTable` + `mockWordTables`）：
- 旧静态 mock（`cell.value=text` 不回写 `values`）测不出本缺陷 → 扩成「写入会改 values」的
  live mock：`cell.value` setter 回写 `values[r][c]`，`table.values` getter 反映写入。
- 用例：前向编辑首行 cell(0,1) 'B'→'NEW'（断言存储指纹 = `'A|NEW__2x2'` 而非旧的 `'A|B__2x2'`）→
  `unshift` 一张漂移表使被编辑表移位 → undo → **断言 editedTable 还原为 'B' 且 driftTable
  纹丝未动 'Q'**。旧实现下此断言双向变红（撤错表）= 真回归防线。

### MR-2 — 写后回读「空壳」（诚实性 / 击穿写后回读教训）

**根因**：`setWordHeaderFooter`（:2037-2044）与 `editTableCell`（:2193-2198）都做了写后回读，
但**不一致分支体为空（仅 `// soft warning` 注释）**——不抛、不回传、不改 data。若 Word for Web
对 header/footer `insertText(Replace)`（Assumption A4 待真机）或单元格直写**静默 no-op**，工具
仍返回 `ok:true, modified:true`，前向**假报成功**。这违背 memory `project_ppt_officejs_gotchas`
「网页版写操作静默 no-op 需写后回读验证」。

**修法**（采用 review 建议方案 1 / fail-honest）：回读不一致即 `throw new HostApiError(结构化文案)`，
让前向诚实失败。undo 主链不受影响（before-image 已正确捕获；前向 throw 后不会注册 reverse，
no-op 本就无内容可撤）。

**结构性守门测试**：
- `editTableCell`：cell.value setter 为 no-op（模拟网页版静默忽略写入）→ `rejects(/写后回读不一致/)`。
- `setWordHeaderFooter`：sectionHeader 静态文本 + insertText no-op → `rejects(/写后回读不一致/)`。
- 断言「mock 回读返回旧值 → 前向失败，不得 ok」，正是 review 要求的击穿守门。

---

## LOW 修复详情

- **LR-1（WORD-06 highlightColor=null）**：代码 round-trip 逻辑本就正确（`!== undefined` 守卫让
  null 通过），review 指出「前向写 null」与「restore 写 null」两条路径未被断言。补两条断言：
  ①前向 `setCharacterFormat({highlightColor:null})` → `font.highlightColor === null`（移除高亮）+
  before-image 捕获原 `'#FFFF00'`；②`restoreRangeFont({before:{highlightColor:null}})` → 写回 null。
- **LR-2（WORD-07 非法 list style）**：旧 `Word.ListBullet?.[key] ?? Word.ListBullet` 在非法 key 时
  把整个枚举对象当值传入 setLevelBullet。改为 `typeof resolved === 'string'` 守卫——仅合法 string
  枚举值才用，否则回落到 `'Solid'`/`'Arabic'`（双向兼容枚举键大小写约定），绝不回落到枚举对象本身。
- **LR-3（WORD-09 门控一致性）**：setWordHeaderFooter 补 `isSetSupported('WordApi','1.1')` 门控，
  与 WORD-07/08/10 保持一致并给出清晰降级文案。

---

## Backlog / 真机 UAT 跟踪（不强求改）

- **LR-4 — `Comment.id` 跨 undo 稳定性**：insert 回读 id 存 reverse.args、undo 按 id 删，依赖
  `Comment.id` 在 insert→undo（含 Web 端可能需刷新）窗口内稳定。Office.js 文档记为稳定标识，
  代码处理（`[Aster] ` 前缀 + 回读 id 为空即抛）已正确。**列真机 UAT 关注点**，不预改。
- **LR-5 — executeBatch 对新工具 throw**：经核对为**正向确认**（未支持工具落到清晰 `throw`
  而非静默 no-op，符合诚实降级）。**非缺陷，无需修**。
- **LR-6 — 命名碰撞 + 共享 mock**：ToolDef 导出名与 adapter 同名方法标识符重名（与既有
  `setWordCharacterFormat` 模式一致，无害）；`tableCellMockDefault` 单例 mock 当前单表用例无碍。
  **纯整洁度，列 backlog**，未来多单元格用例若出现污染再重构。

---

## 验证门（诚实实测，committed 状态复跑）

| 门 | 结果 |
|---|---|
| `npx tsc --noEmit` | **PASS** |
| `npm run build` | **PASS** |
| `npm run size` | **82.48 KB gzip**（limit 100 KB）✅ |
| `npm test`（vitest） | **1109 passed（既有 1104 + 新增 5 守门）/ 0 failed** |
| 尾部 errors | 3 个 retry.test.ts unhandled rejection（RATE_LIMIT/NETWORK）= **已知噪音**，非失败 |

**MR-1/MR-2 结构性测试均已加**（review 明确要求的「写入改 values」live mock + 漂移撤错表 +
no-op 假报守门）。

---

## 原子 commit 清单（本地，未 push）

| Commit | 内容 |
|---|---|
| `491a500` | fix(27): MR-1 editTableCell 存编辑后指纹 + MR-2 写后回读不一致 throw |
| `fb3725c` | fix(27): WORD-07 list style 白名单回落（LR-2）+ WORD-09 页眉 WordApi 1.1 门控（LR-3） |
| `7448150` | test(27): MR-1/MR-2/LR-1 结构性守门用例 |

> 说明：因 RTK 代理改写 `git diff` 输出 + MR-1/MR-2 在 editTableCell 同一代码块共址，
> 采用「MEDIUM 修复 / LOW 修复 / 测试」三段式原子提交（每条 finding 在 commit body 内逐条标注）。

---

## 推荐下一步

`gsd-verify-work 27` — 验证 Phase 27 目标达成。
其余真机 UAT 跟踪项（LR-4 comment.id 稳定性 / A4 页眉写后回读真机行为 / WORD-06 null 移除高亮
真机确认）随 v2.4 真机 UAT packet 一并验。

*修复者：fix-27（gsd-code-review-fix, phase 27）。*
