---
status: issues_found
phase: 27
phase_name: word-tools
depth: standard
reviewed_at: 2026-06-06
diff_base: e9346d1^
diff_head: 4248f53
files_reviewed: 8
findings:
  critical: 0
  high: 0
  medium: 2
  low: 6
  warning: 2
  info: 6
  total: 8
gates:
  typecheck: pass
  lint: pass
  tests: "88 passed (contract / operationLog.integration / index / read.tools)"
blocking: false
recommended_next: verify  # 无 CRITICAL/HIGH；2 个 MEDIUM 建议随手修，非阻断
---

# Phase 27（Word 工具补全）代码审查报告

**审查范围**：`e9346d1^..4248f53`（11 commit，含 27-01 合约骨架的 operationLog.ts）
**审查深度**：standard（逐文件 + 跨文件 4 处对齐核对）
**审查文件（8）**：

| 文件 | 性质 |
|---|---|
| `src/agent/operationLog.ts` | 4 PostStateSnapshot kind + 3 inverse 声明 + 3 switch case |
| `src/adapters/WordAdapter.ts` | WORD-06 highlightColor 折入 4 处 + 7 新方法 |
| `src/agent/tools/write/word.ts` | 4 新 ToolDef + highlightColor 类型 + cap 常量 |
| `src/agent/tools/index.ts` | 注册 4 工具 |
| `src/agent/contract.test.ts` | 4 守门合约行 |
| `src/agent/operationLog.integration.test.ts` | 4 undo 守门用例 + WORD-06 null 写回断言 |
| `src/agent/tools/index.test.ts` | 计数 19→23 |
| `src/agent/tools/read/tools.test.ts` | 计数 19→23 |

## 结论摘要

**总体质量高，无阻断问题。** Phase 5 的位置参致命教训已被系统性规避：7 个新 adapter 方法**全部**收 `Record<string, unknown>` 并在方法体第一行解包，3 个 inverse 的「四处对齐」（reverse.tool / operationLog switch case / contract.test 行 / adapter 方法名）逐一核对一致；WORD-07 诚实 noop+gate（守门断言 `skipped_error`）；WORD-06 null 写回逻辑正确（仅 `!== undefined` 守卫，null 不被跳过）；4 个新 PostStateSnapshot kind 全部落到保守 `default`（不盲加 read 比对）。typecheck / lint / 88 测试全绿。

发现 **2 个 MEDIUM**（均关于「降级诚实性」与「定位安全网在 undo 路径被绕过」，非 undo 主链断裂）+ 6 个 LOW/观察。两个 MEDIUM 都不阻断验收，但建议随手修复（尤其 M-1）。

---

## CRITICAL（0）

无。

---

## HIGH（0）

无。undo round-trip 主链（Record 签名 / 四处对齐 / before-image restore / noop 诚实）经核对全部正确，未发现 Phase 5 类位置参回归或 reverse 名错位。

---

## MEDIUM（2）

### MR-1 — WORD-10：editTableCell 存的是「编辑前」指纹，首行单元格编辑会让 undo 的指纹定位失效，静默退化为裸 tableIndex（drift 下可能撤错表）

- **文件**：`src/adapters/WordAdapter.ts:2187`（`editTableCell` 计算指纹）+ `:2230-2250`（`restoreTableCell` 指纹匹配三策略）
- **问题**：
  `buildTableFingerprint`（`WordAdapter.ts:38-45`）= **首行文本** `join('|')` + `__rows×cols`。`editTableCell` 在写入**之前**（L2187，`table.values` 仍是编辑前快照）计算 `tableFingerprint` 并存进 `reverse.args`。但前向随即把单元格写成新值——**若编辑的是首行单元格（`rowIndex===0`），文档里这张表的指纹此刻已经变了**。
  撤销时 `restoreTableCell`（L2230-2250）用**当前**（编辑后）文档重新算各表指纹去匹配存下的（编辑前）指纹：
  - 策略 1（tableIndex + 指纹校验）→ 当前指纹 ≠ 存的指纹 → 不匹配；
  - 策略 2（遍历找指纹）→ 没有任何表的当前指纹等于存的旧指纹 → 不匹配；
  - 策略 3（兜底）→ 退回裸 `tableIndex`。
  即：**D-06 想要的「防 index drift 错定位」安全网，在 undo 路径上对首行编辑被静默绕过**。无 drift 时撤销仍正确（兜底 tableIndex 命中同一张表）；但**一旦在前向与撤销之间发生表序漂移（如用户在前面插了一张表）且编辑的是首行**，兜底 tableIndex 会指向**另一张表**，撤销把错表的单元格改掉——静默数据损坏，且不报错。
- **测试为何没抓到**：`operationLog.integration.test.ts:546-575` 的 mock 表是**静态**的——`cell.value = text` 不会改 `values`，所以 `restoreTableCell` 重算的指纹永远等于 `'原内容|B__2x2'`，策略 1 命中、测试绿。真机里 `values` 会变，掩盖了该缺陷。
- **建议**：让撤销能匹配到「文档当前状态」。二选一：
  1. `editTableCell` 在**写入之后**重算指纹再返回（存「编辑后」指纹），`restoreTableCell` 即可正常用指纹定位；或
  2. `buildTableFingerprint` 改为**不含被编辑单元格**的稳定标识（如表维度 + 首列/末行等不参与编辑的轴），让指纹对单格编辑稳定。
  无论哪种，建议补一个「mock `cell.value` 写入会回写 `values[row][col]`」的回归用例，使指纹漂移在测试可见。

### MR-2 — WORD-09 / WORD-10：写后回读校验是「空壳」（检测到不一致只有注释、不抛不报），网页版静默 no-op 无法被发现

- **文件**：`src/adapters/WordAdapter.ts:2041-2043`（`setWordHeaderFooter`）、`:2196-2198`（`editTableCell`）
- **问题**：两处都做了「写后回读」（重新 `load('text')`/`load('value')` + `sync` + 比对），符合 PPT 教训「网页版写操作静默 no-op 需写后回读验证」的形。但**不一致分支体是空的（仅 `// soft warning` 注释）**——既不抛 `HostApiError`，也不回传 warning 标记，更不改 `data`。结果：若 Word for Web 对页眉/页脚 `insertText(Replace)`（Assumption A4 明确写「待真机 UAT 确认」）或单元格直写**静默 no-op**，工具仍返回 `ok:true, modified:true`，AI 与用户都以为成功，但文档纹丝未动。这正是该校验本要防的故障，校验却是**装饰性**的。
  注：undo 主链不受影响（before-image 已正确捕获），问题是**前向会假报成功**。
- **建议**：与「诚实降级」原则对齐，二选一：
  1. 确认不一致时 `throw new HostApiError('...页眉写入疑似被宿主静默忽略...', undefined)`（让前向诚实失败，符合 fail-honest）；或
  2. 若决定真机 UAT 前先放行，则**至少回传**一个 soft-fail 信号（如 `data.verified=false` + 在 `humanLabel`/结果里提示），不要让「检测到却吞掉」造成虚假信心。
  当前空壳实现既花了回读的 `ctx.sync` 成本、又拿不到任何防护收益。A4 可以延后到真机验证，但应作为**已知缺口被显式跟踪**，而非静默吞没。

---

## LOW / 观察（6）

### LR-1 — WORD-06：`highlightColor = null` 移除高亮属「未经类型背书的运行时假设」
- **文件**：`src/adapters/WordAdapter.ts:551`（前向写）、`:620`（restore 写）
- `as unknown as string` 两处兜底**类型安全**且范围窄（只作用于 highlightColor 赋值，不会掩盖其它字段的真 bug）。但「给 `font.highlightColor` 赋 `null` 能移除高亮」是 @types/office-js（类型为 `string`）**没有背书**的运行时行为，需真机 UAT 确认。逻辑核对：前向 `!== undefined` 守卫让 null 通过（移除）、before-image 存 `f.highlightColor`（含 null）、restore `!== undefined` 守卫写回——**round-trip 逻辑正确**。但集成测试只断言了 restore **非 null**（`'#FFFF00'`）方向（integration.test L465-468），**前向写 null** 与 **restore 写 null（移除）** 两条路径未被断言覆盖，仅靠肉眼核对。建议真机验后补一条「before 无高亮 → 设高亮 → undo 应移除」的断言。

### LR-2 — WORD-07：`setLevelBullet/Numbering` 的 `??` 兜底在非法 style 时会把「整个枚举对象」当枚举值传入
- **文件**：`src/adapters/WordAdapter.ts:1249`、`:1256`
- `((Word).ListBullet)?.[bulletStyle] ?? (Word).ListBullet`：若 LLM 传了非法 `bulletStyle`（不在枚举键内），`?.[key]` 为 undefined，`??` 兜底成**整个 `ListBullet` 枚举对象**（而非某个合法枚举值），传给 `setLevelBullet` 多半得到非预期/抛错。默认值 `'Solid'/'Arabic'` 合法、常路无碍；但参数来自 LLM，非法值不是边缘情况。建议：对 `bulletStyle/numberStyle` 做白名单校验，非法时回落到已知合法值（如 `ListBullet.solid` / `ListNumbering.arabic`），别回落到枚举对象本身。

### LR-3 — WORD-09：`setWordHeaderFooter` 缺 `isSetSupported` 门控（其余 3 法都有）
- **文件**：`src/adapters/WordAdapter.ts:1998-2050`（方法体无 1.x 门控）
- WORD-07/08/10 分别门控 WordApi 1.3/1.4/1.3，唯独 WORD-09 直接进 `Word.run`。`section.getHeader/getFooter` 是 WordApi **1.1** 基线，技术上无需门控；但为一致性与更清晰的降级文案，可加 `isSetSupported('WordApi','1.1')` 兜底（低优先，纯一致性）。

### LR-4 — WORD-08：`comment.id` 跨 undo 稳定性是未验证假设
- **文件**：`src/adapters/WordAdapter.ts:1290-1340`（insert 回读 id）、`:1352-1380`（deleteCommentById 按 id 删）
- 前向回读 `comment.id` 存入 reverse.args，撤销按 id 删——依赖 `Comment.id` 在 insert→undo 窗口内稳定（工具描述自承「Word for Web 批注可能需刷新页面才可见」，跨刷新更需稳定）。Office.js 文档将 `Comment.id` 记为稳定标识，应可；列为真机 UAT 关注点。`[Aster] ` 前缀（L1283 `COMMENT_PREFIX`）已落实，写后回读 id 为空即抛（防静默失败）——这点处理正确。

### LR-5 — Word `executeBatch` 对 4 个新工具走「明确 throw」而非静默吞（正向确认，非缺陷）
- **文件**：`src/adapters/WordAdapter.ts:1442-1697`
- 核对回归：Word `executeBatch` 按 `op.tool` 分派，未支持的工具落到 L1697 `throw HostApiError('Word executeBatch: 暂不支持工具 ...，请单独调用')`。4 个新工具未纳入 batch 内联，若被放进 `batch_write` 会**清晰报错**而非静默 no-op——符合诚实降级。无回归。

### LR-6 — 命名碰撞 + 测试 mock 复用（纯整洁度）
- ToolDef 导出名（`setWordListFormat` 等，`write/word.ts`）与 `WordAdapter` 同名方法**标识符重名**，grep 时略费神；与既有 `setWordCharacterFormat` 模式一致，无害。
- `operationLog.integration.test.ts:281-287` 的 `tableCellMockDefault` 是被所有表共享的**单例 mock 对象**；当前单表用例无碍，未来多单元格用例可能相互污染（仅测试质量，非生产）。

---

## 跨文件对齐核对表（undo 正确性，重点维度）

| 工具 | reverse.tool（word.ts） | operationLog switch case | contract.test reverseTool | adapter inverse 方法 | 签名收 Record | undo 判定 |
|---|---|---|---|---|---|---|
| set_word_list_format | `noop_inverse` | （复用既有 noop_inverse）| `noop_inverse` | 无（诚实降级）| — | ✅ `skipped_error`（守门断言）|
| insert_word_comment | `delete_comment_by_id` | `delete_comment_by_id`→`deleteCommentById` | `delete_comment_by_id` | `deleteCommentById(args)` ✅ | ✅ | ✅ `rolled_back` |
| set_word_header_footer | `restore_word_header_footer` | `restore_word_header_footer`→`restoreWordHeaderFooter` | `restore_word_header_footer` | `restoreWordHeaderFooter(args)` ✅ | ✅ | ✅ `rolled_back`（见 MR-2 前向假报警示）|
| edit_table_cell | `restore_table_cell` | `restore_table_cell`→`restoreTableCell` | `restore_table_cell` | `restoreTableCell(args)` ✅ | ✅ | ✅ `rolled_back`（见 MR-1 指纹绕过警示）|
| set_word_character_format(+highlightColor) | `restore_range_font` | （既有）| （既有）| `restoreRangeFont(args)` ✅ | ✅ | ✅ null 写回断言通过 |

四处对齐**全部一致**；每个 inverse switch case 都有「adapter 未实现 → throw」守卫（operationLog.ts:548/554/560）。

## 验证门（read-only 复跑）

- `npx tsc --noEmit` → **PASS**（exit 0）
- `npx eslint`（4 个生产源文件）→ **PASS**（exit 0）
- `npx vitest run`（4 个受影响测试文件）→ **88 passed**（contract 9 / integration 43 / read.tools 25 / index 11）

---

*审查者：review-27（gsd-code-review, standard）。仅审查，未改代码、未 commit。*
