---
status: issues_found
phase: 29
phase_name: ppt-tools-nfr12
depth: standard
diff_range: 0e0b1ee^..47ce21c
files_reviewed: 8
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
blocking: false
recommended_next: verify
reviewed_at: 2026-06-06
---

# Phase 29 代码审查 — PPT 工具补全 + NFR-12 收口

审查范围 diff：`0e0b1ee^..47ce21c`（9 commits，含首 commit `0e0b1ee` 与 deviation 修复 `47ce21c`）。
审查源文件 8 个（已排除 `.planning/` 文档）：

- `src/agent/operationLog.ts`（+3 kind）
- `src/adapters/PptAdapter.ts`（+insertTable / +addLine）
- `src/agent/tools/write/ppt.ts`（+insertPptTableTool / +addLineTool / +setShapeGradientTool / pickFirstStopColor）
- `src/agent/tools/index.ts`（PPT_TOOLS +3 / pptWriteTools +3 / import）
- `src/agent/contract.test.ts`、`src/agent/operationLog.integration.test.ts`（守门）
- `src/agent/tools/index.test.ts`、`src/agent/tools/read/tools.test.ts`（计数 deviation 修）

**结论：0 CRITICAL / 0 HIGH，无阻断性问题。** 2 MEDIUM + 5 LOW，均为「诚实/一致性」打磨与真机验证项，不影响合并/收口。本地全量 443 个 agent 测试 + `tsc --noEmit` + `npm run size`（fresh build）全绿。

---

## 验证基线（本机实跑）

| 检查 | 结果 |
|---|---|
| `tsc --noEmit` | exit 0 ✅ |
| 4 守门测试文件（contract / integration / index / read.tools） | 103 passed ✅ |
| `src/agent/` 全量 | 28 文件 / 443 tests passed ✅ |
| `npm run build` → `npm run size`（fresh dist） | **82.48 KB gzip ≤ 100 KB gate → NFR-12 PASS** ✅ |

---

## 重点维度核验（全部通过）

### ① undo 正确性 — ✅ 正确
- **复用反操作、0 新 executeReverse case 已确认**：`insert_ppt_table`/`add_line` → `delete_shape_by_id`（operationLog.ts:481，已存在 case）；`set_shape_gradient` → `restore_shape_property`（operationLog.ts:375，已存在 case）。本 phase 未向 `executeReverse` 增任何 case。
- **Record 对象（非位置参，Phase 5 教训）已遵守**：`deleteShapeById(args: Record<string, unknown>)`（PptAdapter.ts:2043）与 `restoreShapeProperty(args: Record<string, unknown>)`（PptAdapter.ts:1033）均从 Record 解 snake_case 键；tool 产出的 `reverse.args` 用 `{ slide_index, shape_id, fill_type, ... }` 全 snake_case，键名逐一对齐。
- **reverse 名四处对齐**：tool 产出 / contract.test CONTRACT / integration replay / executeReverse case —— 四处 `delete_shape_by_id`、`restore_shape_property` 完全一致。
- **新 kind readTargetState 保守 undefined 已确认**：`ppt_table`/`ppt_line`/`ppt_shape_gradient` 未进 `readTargetState` switch（operationLog.ts:250-299），落 `default: return undefined`；`isTargetStateConsistent(undefined,...)` → `true`（保守通过，绝不跳过 undo）。这是安全侧，正确。

### ② 降级诚实性（本 phase 核心）— ✅ 诚实
- **PPT-09**：门控 1.8 失败 → `{ effective:false }` → tool 返回 `notEffectiveResult('插入表格')`（ok:false、无 reverse/postState，不假成功）；写后回读 `afterShapes.length < beforeCount+1` → 抛 HostApiError（PptAdapter.ts:1763），同样 ok:false 无 undo 记录。set-diff 定位新 shape（`created = afterShapes.filter(!beforeIds.has(id))`，取 `created[last]`，PptAdapter.ts:1777）正确。
- **PPT-10**：`with_arrow=true` 时仅在 `data.notice` 诚实告知「平台支持线条但不支持箭头头样式，已插入无箭头线条」（ppt.ts:935-937），**不伪造箭头**；description 也显式标「**不支持箭头头样式**」。
- **PPT-11**：降级纯色为唯一路径（`pickFirstStopColor` 取首色 → 复用 `setShapeProperty({ fillColor })`）；`data.notice` 量化告知；`humanLabel` 标「（渐变降级）」。**before-image 读不回**（`fillColor===null && fillType!=='NoFill'`，ppt.ts:1000）→ 走 `noop_inverse`（不拿 null 假装还原），范式与 `setShapeTextAlignmentTool` 一致；`noop_inverse` 在 executeReverse 抛 → skipped_error → DiffLog「此步无法自动撤销」。

### ③ PPT gotchas — ✅ 已规避
- 3 工具全部加入 `PPT_TOOLS` Set（index.ts:51-53），dispatch 入口 `normalizeToSnakeCase`（index.ts:218）对其 camelCase 一级键归一化 → 防 LLM camelCase 静默丢参 no-op。
- 写后回读验证：insertTable/addLine 均有 count+1 校验（PptAdapter.ts:1650/1763/1884），网页版静默 no-op 不会假成功。

### ④ PPT_WRITE_TOOLS 分类（deviation 修复）— ✅ 正确
- 3 工具均声明 `kind: 'write'`（ppt.ts:810/866/973）。
- `read/tools.test.ts:308` 的 `PPT_WRITE_TOOLS` 测试清单补入 3 名 → 否则会被 `readTools` 过滤器纳入并以 `kind==='read'` 断言失败。修复正确。
- 计数 **27 = 7 read + 19 write + 1 selection** 在 index.test.ts:73 与 read/tools.test.ts:218 两处对齐；CONTRACT 长度守门 `≥35` 通过。

### ⑤ NFR-12 — ✅ PASS（82.48 KB gzip）
- gate 100 KB（2026-06-05 Phase 26 从 82 KB 上调），fresh build 后实测 82.48 KB，余量充足。

---

## MEDIUM findings（2）

### WR-01 [MEDIUM] `add_line` description 过度承诺「虚线」能力，但 schema/execute 不暴露 dashStyle
- **位置**：`src/agent/tools/write/ppt.ts:867`（description「可设颜色/粗细/**虚线**」）+ `ppt.ts:919`（`lineProps = (color!==undefined || weight!==undefined) ? { color, weight } : undefined` —— 不含 dashStyle）；`src/adapters/PptAdapter.ts:1911`（`lineShape.lineFormat.dashStyle = lineProps.dashStyle` 为不可达代码）。
- **问题**：tool description 告诉 LLM 可设「虚线」，但 `parameters` schema **没有任何 dash 参数**，`execute` 构造 `lineProps` 时也只传 `{ color, weight }`。结果：LLM 被告知有此能力却无入参可用；adapter 里支持 dashStyle 的分支永远收不到值（dead code）。这与本 phase「降级诚实」的主旨轻微相悖——description 承诺了交付不了的能力。
- **建议**：二选一——(a) 给 schema 增 `dash_style`（如 `enum: ['Solid','Dash','Dot',...]`）并在 execute 透传进 `lineProps`，打通 adapter 已有路径；或 (b) 从 description 删「虚线」并移除 adapter 的 dashStyle 分支。推荐 (a)，因 adapter 实现成本已付。

### WR-02 [MEDIUM] `add_line` 反向/向上线条产生负 width/height，真机可能被 Office.js 拒绝
- **位置**：`src/adapters/PptAdapter.ts:1873-1874`（`width: end.left - start.left`、`height: end.top - start.top`）。
- **问题**：当终点在起点左侧或上方（end.left < start.left 或 end.top < start.top）时，传给 `shapes.addLine(connectorType, { left, top, width, height })` 的 width/height 为负。Office for Web 的 `ShapeAddOptions` 对负 width/height 的行为未在本仓库验证——可能抛「invalid argument」或绘制异常。
- **影响**：最坏情形是**诚实失败**（addLine 抛 → count+1 校验也抛 → ok:false，无数据损坏），不会静默错绘；但「从右下到左上画线」这类合理指令可能整类失效。
- **建议**：真机 UAT 必验项。若 Office.js 拒负值，应在 adapter 内对 left/top 取 `Math.min`、width/height 取 `Math.abs`（连接符方向另由 begin/end connection 或仅作为包围盒对角线表达）。无法在浏览器 mock 验证，列入 PPT-10 真机清单。

---

## LOW / INFO findings（5）

### IN-01 [LOW] `insertTable` docstring 承诺的「拆独立 PowerPoint.run 填值」#5022 兜底未实现
- **位置**：`src/adapters/PptAdapter.ts:1695`（docstring 写「若同 run 填值崩 → 拆独立 PowerPoint.run 填值，镜像 addImageShape 两次 run」），但实际填值在**同一 run 的 sync 5** 完成，无两次 run 兜底。
- **问题**：注释描述了一条不存在的容错路径。规避 #5022 的「不碰 add-return proxy + reload 取稳定 proxy」部分**已实现**，填值用的是 post-reload 稳定 proxy，多数宿主应可行；但若 Office for Web 在逐格填值仍偶发 #5022，当前单 run 实现没有 docstring 承诺的降级。
- **建议**：要么实现两次 run 兜底，要么把 docstring 改成「当前单 run；如真机 #5022 复发再拆 run」。真机 UAT 关注表格填值是否稳定。

### IN-02 [LOW] `connector_type` 枚举值直传 Office.js，需真机确认与 `PowerPoint.ConnectorType` 对齐
- **位置**：`src/agent/tools/write/ppt.ts`（schema `enum: ['Straight','Elbow','Curve']`）→ `PptAdapter.ts:1870`（直传 `addLine(connectorType, ...)`）。
- **问题**：字符串 'Straight'/'Elbow'/'Curve' 直接作为 ConnectorType 传入。大概率与 Office.js 枚举字符串值一致（PowerPoint 枚举多为首字母大写），但本仓库未验证。若实际为小写或别名，addLine 可能抛。
- **建议**：低风险，真机顺带确认；不一致则做一层 map。

### IN-03 [LOW] `pickFirstStopColor` 不校验 hex 格式；空数组静默兜底 teal
- **位置**：`src/agent/tools/write/ppt.ts:952`。
- **问题**：(a) 首元素为字符串即原样返回，不校验是否 `#RRGGBB`——非法色（如 'red'、'notacolor'）透传到 `setSolidColor` → 真机可能抛（→ 诚实失败，可接受）；(b) `gradient_stops` 为空数组时静默返回 DEFAULT `#009887`（teal），用户看到 notice 说「已用纯色 #009887 代替」但其实是兜底色，轻微意外。
- **建议**：可选增 `#RRGGBB` 正则校验，非法则报 INVALID_ARGS 而非传给宿主；空数组场景属退化输入，保持现状亦可。

### IN-04 [LOW] 新工具无 rows/cols/坐标的输入校验，依赖宿主抛错
- **位置**：insertPptTableTool（rows/cols 可为 0/负）、addLineTool（坐标无范围校验）。
- **问题**：非法数值不在 tool 层拦截，靠 Office.js 抛 → 诚实失败。与既有 PPT 工具范式一致，非新增坏味道。
- **建议**：可不改；如要更友好可在 execute 前置 `rows>0 && cols>0` 校验返回 INVALID_ARGS。

### IN-05 [INFO] `humanLabel` 读未归一化的 `tc.arguments`（全 PPT 工具既有范式，非本 phase 回归）
- **位置**：`src/agent/loop-helpers.ts:161`（`def.humanLabel(tc.arguments)` 用原始 args；normalize 仅作用于 `def.execute`，index.ts:218-221）。
- **问题**：若 LLM 发 camelCase，`humanLabel` 内 `a.slide_index`/`a.gradient_stops` 取不到 → 显示「第 undefined 张」。但这是**所有** PPT 工具的既有行为（schema 用 snake_case，LLM 正常会遵循），新 3 工具与既有范式完全一致，**非 Phase 29 引入的回归**。仅作记录。
- **建议**：如要彻底修，应统一在 dispatch 边界对 humanLabel 也喂归一化 args（全 PPT 工具受益），属独立小重构，不在本 phase 范围。

---

## 回归核验
- 既有 PPT 工具 / operationLog / PPT_TOOLS 归一化：未触碰其逻辑，仅追加。`src/agent/` 全量 443 测试通过，无既有用例红。
- `tsc --noEmit` 干净。
- index.test.ts:73 与 read/tools.test.ts:218 残留的「16 write / 23」注释为 Phase 23 历史上下文（正确），非遗漏的陈旧计数断言。

## 推荐下一步
**无 HIGH+ → 进 verify（goal-backward 验收）。** MEDIUM/LOW 全部为诚实/一致性打磨与真机验证项：
- WR-01（dash 虚线）建议在 verify 前快速收口（5 行：补 schema 参数 + execute 透传，或删 description「虚线」字样），以免 LLM 被误导。
- WR-02 / IN-01 / IN-02 列入 PPT-09/10 真机 UAT 清单（负坐标线条、表格填值稳定性、connector 枚举），浏览器 mock 无法覆盖。
