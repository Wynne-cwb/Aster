---
phase: 29
phase_name: ppt-tools-nfr12
status: partial
fix_scope: critical_warning
findings_in_scope: 2
fixed: 4
skipped: 3
iteration: 1
fixed_findings: [WR-01, WR-02, IN-01, IN-03]
backlog_findings: [IN-02, IN-04, IN-05]
reviewed_at: 2026-06-06
test_baseline: 1125
test_after: 1137
tsc: PASS
build: PASS
size_gzip_kb: 82.47
size_limit_kb: 100
---

# Phase 29 代码审查修复报告 — PPT 工具补全 + NFR-12 收口

> 输入：`29-REVIEW.md`（0C / 0H / 2M / 5L，无阻断）
> 结论：**2 MEDIUM 全部修复并加自动守门测试；2 个廉价 LOW（IN-01 / IN-03）顺手修；3 个 LOW（IN-02 / IN-04 / IN-05）记 backlog / 真机 UAT（附理由）。**
> `npm test` 全绿（1125→1137，+12 守门）、`tsc --noEmit` PASS、`npm run build` PASS、`npm run size` **82.47 KB gzip ≤ 100 KB**（v2.4 全里程碑最终 bundle 收口复核）。
> ⚠️ WR-02 的对角线「哪个角→哪个角」朝向 + connector_type 枚举 + dash 真机渲染仍需 Office for Web 真机 UAT 收口（见末节种子）。

## 处置总表

| Finding | 严重度 | 处置 | commit | 自动守门测试 |
|---|---|---|---|---|
| WR-02 | MEDIUM | ✅ 已修 | `e4ddcdb` | ✅ 4 条（PptAdapter.test.ts） |
| WR-01 | MEDIUM | ✅ 已修（+ 类型修正 `9ba64c3`） | `0628fff` | ✅ 4 条（ppt.test.ts） |
| IN-03 | LOW | ✅ 已修 | `ff580a4` | ✅ 4 条（ppt.test.ts） |
| IN-01 | LOW | ✅ 已修（docstring） | `2ee207e` | n/a（注释，无行为变更） |
| IN-02 | LOW | ⏸ 真机 UAT | — | — |
| IN-04 | LOW | ⏸ backlog | — | — |
| IN-05 | INFO | ⏸ backlog | — | — |

## 修复详情

### WR-02 — `add_line` 反向/向上线条产生负 width/height（正确性）｜`e4ddcdb`
- **改动**：`src/adapters/PptAdapter.ts` `addLine`。包围盒原点改为 `left: Math.min(start.left, end.left)`、`top: Math.min(start.top, end.top)`；尺寸改为 `width: Math.abs(end.left - start.left)`、`height: Math.abs(end.top - start.top)`。
- **先查真实签名（关键）**：核 `@types/office-js` 确认 **PowerPoint** 的 `ShapeCollection.addLine(connectorType, ShapeAddOptions)` 收的是**包围盒** `{left, top, width, height}`——**不是**起止坐标（`(startLeft, startTop, endLeft, endTop, connectorType?)` 那是 `Excel.Shapes.addLine` 的签名）。故 team-lead 建议的「直接传起止坐标」不适用 PowerPoint，落到 fallback：取 abs + 正确 origin（min）。
- **从「未验证」升级为「确证 bug」**：`ShapeAddOptions.width` / `.height` 的官方 JSDoc 明示 *"Throws an `InvalidArgument` exception when set with a negative value."* 修复前 `width = end - start` 在「右→左 / 下→上 / 反向对角线」会传负值 → 真机直接抛 → 该类指令整类失效。
- **朝向取舍（诚实记录）**：`PowerPoint.Shape` 无 `flipHorizontal`/`flipVertical` API（已 grep 确认），故纯对角线「哪个角→哪个角」的朝向无法在创建期指定；但纯水平/垂直线在任一方向都完全正确，且所有方向都不再因负尺寸被宿主拒绝。对角线朝向列入真机 UAT。
- **守门（4 条）**：① 正向对角线 → `{left:100,top:80,width:200,height:140}`；② 反向对角线（右下→左上）→ 同上包围盒、`width/height ≥ 0`（修复前会传 -200/-140）；③ 向上垂直线 → `width:0` + 原点取 min；④ 向左水平线 → `height:0` + 原点取 min。

### WR-01 — `add_line` description 过度承诺「虚线」但无 dash 入参（over-promise + dead code）｜`0628fff`（+ `9ba64c3`）
- **改动**：`src/agent/tools/write/ppt.ts` `addLineTool`。① schema 新增 `dash_style` 枚举参数（`['Solid','Dash','DashDot','DashDotDot','LongDash','LongDashDot','RoundDot','SquareDot']`，与 `PowerPoint.ShapeLineDashStyle` 字面量逐一对齐——**不含** 'Dot'，因 Office.js 无此值，避免直传抛错）；② `execute` 读 `dash_style` 并并入 `lineProps.dashStyle`（含「只传 dash 不传 color/weight 也构造 lineProps」分支）；③ description 文案更新为「可设…虚线样式（dash_style，如 Dash/RoundDot）」。
- **理由**：选 team-lead 首选修法 (a)——adapter 的 `lineFormat.dashStyle = lineProps.dashStyle` 分支（PptAdapter.ts:1911）实现成本已付却是 dead code，LLM 被 description 告知「可设虚线」却无入参可用。暴露 `dash_style` → dead code 复活 + description 属实，一举消除 over-promise 与死代码。
- **守门（4 条）**：① schema 暴露 `dash_style` 枚举且含 Solid/Dash/DashDot/RoundDot/SquareDot；② 传 `dash_style:'Dash'` → adapter.addLine 第 5 实参 `lineProps.dashStyle==='Dash'`；③ 只传 `dash_style:'RoundDot'`（无 color/weight）也透传；④ 完全不传样式 → `lineProps===undefined`（不强塞空样式）。
- **类型修正 `9ba64c3`**：守门①初版 `addLineTool.parameters.properties` 触发 tsc TS2339（`ToolDef.parameters` 类型为 `object`），改为先 cast 再取 `.properties`，tsc 复绿。

### IN-03 — `pickFirstStopColor` 空数组/非法 hex 静默兜底 teal（取色诚实性）｜`ff580a4`
- **改动**：`src/agent/tools/write/ppt.ts`。① 新增 `isValidHexColor`（`/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/`）；② `pickFirstStopColor` 返回类型 `string` → `string | null`，删 teal `DEFAULT` 兜底——空数组 / 首元素非合法 hex（字符串或 `{color}` 对象）→ 返回 `null`；③ `execute` 在 `firstColor===null` 时返回 `INVALID_ARGS`（**不碰 adapter**，不把非法色透传给宿主）；④ `humanLabel` 对 `null` 显示「（首个色标无效）」占位、**不抛错**。
- **理由**：修复前空 stops 或 `'red'`/`'notacolor'` 等会静默返回 teal `#009887`，用户被 `notice` 告知「已用纯色 X 代替」但其实是兜底色（误导），且非法色会透传给 `setSolidColor` 由宿主抛（晚失败）。改为工具层早失败 + 诚实报错，符合本 phase「降级诚实」主旨。
- **守门（4 条）**：① 合法首色 `['#123456','#abcdef']` → 透传、adapter 收到 `{fillColor:'#123456'}`、`applied_color` 正确；② 空数组 → `INVALID_ARGS` 且 `setShapeProperty` 未被调用；③ 非法 hex `['red']` → `INVALID_ARGS` 且不碰 adapter；④ `humanLabel({gradient_stops:[]})` 返回字符串且含「第 2 张」（不抛错）。

### IN-01 — `insertTable` docstring 承诺不存在的「两次 run」兜底（注释失实）｜`2ee207e`
- **改动**：`src/adapters/PptAdapter.ts` `insertTable` docstring。删「若同 run 填值崩 → 拆独立 PowerPoint.run 填值（镜像 addImageShape 两次 run 范式）」的失实描述，改为如实写「当前单 PowerPoint.run 内完成（建表 + reload 取稳定 proxy + 逐格填值，sync 5），尚无两次 run 兜底；若真机仍偶发 #5022 再拆 run」。
- **理由**：纯注释失实——实现是单 run（sync 5 同 run 填值），该容错路径并不存在。规避 #5022 的「不碰 add-return proxy + reload 取稳定 proxy」部分已实现且保留。无行为变更。

## Backlog / 真机 UAT（3 LOW，附理由）

### IN-02 — `connector_type` 枚举值直传 Office.js，需真机确认与 `PowerPoint.ConnectorType` 对齐【真机 UAT】
- **不在本 phase 改的理由**：schema 已声明 `enum: ['Straight','Elbow','Curve']`，与 `@types/office-js` 的 `addLine(connectorType?: "Straight" | "Elbow" | "Curve", ...)` 字面量重载一致（已核 d.ts），低风险。但真机字符串是否被 ConnectorType 接受无法在浏览器 mock 验证 → 列入真机 UAT；若真机拒绝再加一层 map。

### IN-04 — 新工具无 rows/cols/坐标输入校验，依赖宿主抛错
- **不修理由**：与既有全部 PPT 工具范式一致（坐标/数值校验靠 Office.js 抛 → 诚实失败），非 Phase 29 新增坏味道。要更友好可在 execute 前置 `rows>0 && cols>0`，属独立小重构，价值低，记 backlog。

### IN-05 — `humanLabel` 读未归一化的 `tc.arguments`（全 PPT 工具既有范式）
- **不修理由**：`loop-helpers.ts` 对 `humanLabel` 喂原始 args（normalize 仅作用于 `execute`）是**所有** PPT 工具的既有行为，新 3 工具与既有范式完全一致，非本 phase 引入的回归。要彻底修需在 dispatch 边界对 humanLabel 也喂归一化 args（全 PPT 工具受益），属独立小重构，不在本 phase 范围。

## 验证实测（诚实）

| 检查 | 命令 | 结果 |
|---|---|---|
| 全量测试 | `npm test`（tsc + vitest run） | ✅ **81 Test Files / 1137 Tests passed**（基线 1125 + 12 新守门） |
| 类型检查 | `tsc --noEmit`（含在 npm test） | ✅ PASS（无 `error TS`） |
| 构建 | `npm run build`（先 build 再 size，避免 stale dist 假绿） | ✅ built（main chunk 248.25 KB raw / 82.59 KB gzip） |
| 包体积 | `npm run size` | ✅ **82.47 KB gzip ≤ 100 KB limit**（v2.4 全里程碑最终 bundle） |

> 关于「3 errors」：来自 `src/providers/retry.test.ts` 的 RATE_LIMIT / NetworkError 重试用例尾部 unhandled rejection 噪音（非测试失败，Test Files 与 Tests 均全 passed）——即项目既有的「尾部 3 retry = 噪音」。
> bundle 实测 82.47 KB 与 29-REVIEW.md 基线 82.48 KB 几乎持平，确认 `dash_style` schema（~5 行）对包体积影响可忽略。

## 新增守门测试清单（关键，共 12 条）

- `src/adapters/PptAdapter.test.ts`：WR-02 ×4（正/反对角线、向上垂直、向左水平 — 捕获传给 addLine 的 options 断言无负尺寸 + min 原点）
- `src/agent/tools/write/ppt.test.ts`：WR-01 ×4（dash_style 暴露/透传/只传 dash/不传）、IN-03 ×4（合法透传/空数组/非法 hex/humanLabel 不抛错）

## 真机 UAT 种子（mock 无法判定，需 Office for Web 真机收口）

1. **WR-02 / 反向线条**：在真机画「从右下到左上」「从下到上」的线条 → 断言**成功插入**（修复前会因负 width/height 被 InvalidArgument 拒）；并观察对角线朝向是否符合预期（PowerPoint.Shape 无 flip API → 对角线朝向可能恒为左上→右下，若业务需要精确朝向再评估 flip 方案）。
2. **WR-01 / dash 真机展示**：传 `dash_style: 'Dash'` / `'RoundDot'` 画线 → 断言真机线条**确为虚线/点线**（验证 `PowerPoint.ShapeLineDashStyle` 字面量在真实 Office.js 下被接受并生效）。
3. **IN-02 / connector_type 枚举**：分别传 `'Straight'` / `'Elbow'` / `'Curve'` → 断言三种连接符形态都被接受不抛错（验证枚举字符串与 `PowerPoint.ConnectorType` 对齐）。
4. **IN-01 / 表格填值稳定性**：真机插入带 `data` 的表格（多行多列）→ 断言所有单元格填值落地（验证单 run 逐格填值在 Office for Web 不偶发 #5022；若复发再启用两次 run 兜底）。

## 推荐下一步

`/gsd-verify-work 29` —— 以真机 UAT 收口上述 4 个种子后即可验收 Phase 29，完成 v2.4 全里程碑收官。
