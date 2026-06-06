# Phase 29: PPT 工具补全 + NFR-12 收口 - Research

**Researched:** 2026-06-06
**Domain:** Office.js PowerPointApi（3 个新 PPT write 工具：表格 / 线条 / 渐变填充）+ NFR-12 全里程碑 bundle 收口
**Confidence:** HIGH（三工具 web API 可用性全部经官方 Microsoft Learn 文档 + 本地 `@types/office-js` v1.0.591 类型定义双重核实；undo/合约接线基于 codebase 实测范式）

---

## 一句话 verdict 摘要（最高优先级）

| 工具 | Office.js API | API set | Web 文档结论 | Verdict |
|------|--------------|---------|-------------|---------|
| **PPT-09 表格** | `ShapeCollection.addTable(rows, cols, options)` | **PowerPointApi 1.8** | 1.8 = **Web Supported** | ✅ **原生建表（推翻 CONTEXT「网页版不支持原生建表」的过时假设）**；运行时门控 + 回读兜底，真机 UAT 终判；网格模拟降为远端 fallback |
| **PPT-10 线条** | `ShapeCollection.addLine(connectorType, options)` | **PowerPointApi 1.4** | 1.4 = **Web Supported** | ✅ **插线条**；⚠️ **箭头头无法设**（PowerPoint 命名空间无 arrowhead 属性，仅 Excel 有）→ 工具命名/描述须收为「线条/连接符」，箭头降级诚实告知 |
| **PPT-11 渐变** | `ShapeFill` 仅 `setSolidColor`/`setImage`/`clear` | PowerPointApi 1.4 | **无任何 setGradient 方法（含 preview）** | ⛔ **不支持渐变 → 降级纯色（D-29-02 直接触发）**，HIGH 置信负面结论 |

**Primary recommendation:** 三工具都「先实现原生 happy-path + 运行时门控降级」。PPT-09/PPT-10 原生 web 可用（文档级 HIGH，真机 UAT 坐实）；PPT-11 渐变在 Office.js 根本不存在写 API → 直接实现为纯色填充工具（取渐变首色）+ 明确告知。NFR-12 现状极宽松（基线 82.47KB / gate 100KB / 余量 17.53KB），三工具纯 Office.js 调用 0 净新增依赖，无需懒加载。

---

<user_constraints>
## User Constraints（来自 29-CONTEXT.md）

### Locked Decisions（人类已拍板，不可改）

- **D-29-01 PPT-09 表格降级 = 形状网格模拟**（用户拍板）：若 Office for Web 不支持原生建表 → 多文本框/形状拼表格外观。⚠️ **本 research verdict：web 原生建表实际可用** → 网格模拟降为「真机 UAT 证伪原生时」的远端 fallback，不是默认路径。
- **D-29-02 PPT-11 渐变降级 = 降级为纯色**（用户拍板）：网页版 ShapeFill 不支持渐变 → 取渐变首色/主色 setSolidColor + **明确告知**「平台不支持渐变，已用纯色 X 代替」。⚠️ **本 research verdict：Office.js 全平台（含桌面）都无渐变写 API** → 纯色是唯一路径，不存在「原生支持渐变的宿主」分支。
- **D-29-03 PPT-10 线条/箭头降级 = 诚实拒绝**（Claude 自决）：addLine 不支持即诚实拒绝，无模拟。⚠️ **本 research 补充：addLine web 可用，但「箭头头」在 PowerPoint Office.js 完全无 API** → 线条可插，箭头部分诚实告知「平台不支持箭头样式」。
- **D-29-04** 三工具 API verdict = plan-phase 必验 + 运行时门控降级是安全网，真机 UAT 终判（Claude 跑不了真机）。
- **D-29-05** 合约接线逐字对齐 contract.test.ts CI 真相源（HARD）。
- **D-29-06** undo 设计 per-tool 简单逆向优先。
- **D-29-07** 网页版静默 no-op 防御 = 写后回读验证。
- **D-29-08** NFR-12 bundle 收口（技术验收）。

### Claude's Discretion（planner/researcher 可定）
- 3 工具最终 snake_case 名 + reverse 工具名（不撞 Word `insert_table`）。
- 表格参数结构（rows/cols/data 二维数组）+ 网格模拟几何算法（复用 ppt-tokens）。
- add_line 参数（起止坐标 / 连接符类型枚举）。
- 渐变参数结构 + 纯色降级取色逻辑（首色 vs 主色）。
- 新 reverse 工具名 + 新 PostStateSnapshot.kind 命名。
- 3 工具 humanLabel 中文 + 参数 description + 降级告知文案（精确量化）。
- 运行时 isSetSupported 的具体 PowerPointApi 版本号（见 §三工具 API verdict 表，表格 1.8 / 线条 1.4 / 渐变不适用）。
- 是否新增 reverse 工具 vs 复用 `delete_shape_by_id`/`restore_shape_property`。
- wave/plan 切分。

### Deferred Ideas（本 phase 完全不做）
- PPT 表格高保真编辑 / 网格升级为原生（本 phase 已是原生，反向：若真机证伪才退网格）。
- 渐变高级控制（多 stops / 径向 / 角度）。
- 读文档实际渐变/填充做和谐护栏（沿用 Phase 22 D-22-05 诚实降级，web fill 读不稳）。
- PPT SmartArt / 动画 / 转场 / 套主题 / 读背景色（永久 Out of Scope，平台天花板）。
- Word / Excel 工具（Phase 27/28 已交付）。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PPT-09 | 用户能让 agent 在幻灯片插入表格，可撤销 | `ShapeCollection.addTable(rowCount, columnCount, options)` PowerPointApi 1.8，**Web Supported**；`TableAddOptions.rows[].values` 或 `cell.text` 填值；undo = delete_shape_by_id（表格是单 shape） |
| PPT-10 | 用户能让 agent 添加线条/箭头连接符，可撤销 | `ShapeCollection.addLine(connectorType?, options?)` PowerPointApi 1.4，**Web Supported**；⚠️ **箭头头无 API**（PowerPoint 无 arrowhead 属性）；undo = delete_shape_by_id |
| PPT-11 | 用户能让 agent 给形状设渐变填充，可撤销 | ⛔ **Office.js ShapeFill 无渐变写 API**（仅 setSolidColor/setImage/clear）→ D-29-02 降级纯色；undo = restore_shape_property（写前 before-image fill）已有范式 |
| NFR-12 | 初始 main bundle ≤100KB gzip CI gate | 实测基线 **82.47KB gzip**（2026-06-06 Phase 28 完成后），gate 100KB，余量 **17.53KB**；三工具 0 净新增依赖，无需懒加载 |
</phase_requirements>

---

## ⚠️ 关键澄清：CONTEXT.md 的两处过时信息

1. **bundle gate ≠ 82KB**：29-CONTEXT.md 通篇写「≤82KB / 余量仅 ~0.7KB——极紧」是**过时**的（Phase 26 拍板前旧值）。真相源 = `.size-limit.json`（`limit: "100 KB"`, gzip）+ REQUIREMENTS NFR-12（2026-06-05 用户永久上调自 82KB）+ ROADMAP §Phase 29 SC#5。**实测基线 82.47KB gzip / gate 100KB / 余量 17.53KB，宽松**。本 RESEARCH 全程以 **100KB gate** 为准。
2. **PPT-09 网页版「不支持原生建表」是过时假设**：CONTEXT 锁的 D-29-01 网格模拟是基于「Phase 10 spike 当时记 PowerPointApi 1.8 web 待验」。本次官方文档核实 **PowerPointApi 1.8 = Office on the web: Supported**，`addTable` 是 1.8 成员 → **网页版原生建表文档级可用**。D-29-01 网格模拟从「默认 fallback」降为「真机 UAT 若证伪原生才启用的远端兜底」——但因这是用户拍板的 LOCKED 安全网，plan 仍应保留降级路径骨架（运行时门控失败时走它），只是 happy-path 改为原生建表。

---

## Summary

Phase 29 给 PPT 宿主补 3 个 write 工具，是 v2.1 Phase 10 的 deferred 项（add_line / insert_table_ppt / 渐变）的兑现，全部走 Phase 10 已落地的 PPT write 工具合约。三工具的核心研究焦点 = Office for Web API 可用性 verdict：

**PPT-09 表格 — 原生 web 可用（HIGH）。** `ShapeCollection.addTable(rowCount, columnCount, options)` 属 PowerPointApi 1.8，官方平台矩阵明确 1.8「Office on the web: Supported」。表格作为单个 shape 插入（`Shape.type === 'Table'`，`Shape.getTable()` 取 Table 对象）。填值两条路：(a) `addTable` 时传 `TableAddOptions`（含初始 values，**空单元格必须 `""`，缺失/undefined 会 throw**）；(b) 建后 `table.getCellOrNullObject(r,c).text = value`（TableCell.text 是 1.8 成员）。undo 极简：表格 = 单 shape → 捕获 shape id → **复用现有 `delete_shape_by_id`，零新 reverse 工具**。这推翻了 D-29-01 的「网格模拟」前提（详见上方澄清）。

**PPT-10 线条 — 原生 web 可用（HIGH），但箭头不可设（HIGH 负面）。** `ShapeCollection.addLine(connectorType?, options?)` 属 PowerPointApi 1.4，web Supported。connectorType 是 `ConnectorType` 枚举（`Straight`/`Elbow`/`Curve`）——这是**连接符形态**，不是箭头。逐一核查 `Shape` / `ShapeLineFormat` 类：PowerPoint 命名空间**完全没有 arrowhead 属性**（`beginArrowheadStyle`/`endArrowheadStyle` 等只存在于 `Excel.Shape`，PowerPoint 没有）。`ShapeLineFormat` 仅 color/weight/dashStyle/style/transparency/visible。结论：**线条可插（含虚线、颜色、粗细），但箭头头无法控制**。REQUIREMENTS PPT-10 写「线条/箭头连接符」——线条部分原生可用，箭头部分须诚实告知平台不支持。undo = `delete_shape_by_id`（线条是 shape），零新 reverse。

**PPT-11 渐变 — 不支持，降级纯色（HIGH 负面，D-29-02 直接触发）。** 逐一核查 `ShapeFill` 类（含 powerpoint-js-preview moniker）：方法只有 `clear()` / `setImage()` / `setSolidColor()` / `load()` / `toJSON()`；属性只有 `foregroundColor` / `transparency` / `type`。**没有任何 setGradientFill / gradient 写方法。** `type` 枚举虽含 `"Gradient"`，但那是只读返回值（能识别已有渐变，无法设置）。这不是「web 不支持、桌面支持」——而是 Office.js PPT API 层面**全平台都无渐变写能力**。故 D-29-02 的「原生支持渐变的宿主仍上真渐变」分支不存在，纯色是唯一实现路径。渐变工具实质 = 接收渐变参数（stops/方向）→ 取首色 setSolidColor + 明确告知「平台不支持渐变，已用纯色 X 代替」。undo 复用 `set_shape_property` 的 before-image fill + `restore_shape_property`（已有完整范式，PptAdapter L889/L1033）。

**NFR-12 — 宽松（HIGH）。** 实测 `npm run build && npm run size` → 82.47KB gzip，gate 100KB，余量 17.53KB。三工具纯 Office.js 调用（无新解析库/SDK），PptAdapter 经 createAdapter 动态 import 已懒加载，ToolDef 在 agent 主路径但增量预估 ~1.5-2.5KB gzip，远在预算内。全里程碑（Phase 26 配置 UI + 27 Word + 28 Excel + 29 PPT）累积已含在当前 82.47KB 实测里。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| addTable / addLine / fill.setSolidColor 写入 | API/Host（PowerPoint.run 闭包内） | — | A-06：Office.js proxy 不出闭包，错误包 HostApiError |
| 写前 fill before-image（PPT-11 渐变→纯色 undo） | adapter（PptAdapter.ts） | operationLog.ts | 复用 setShapeProperty before-image 范式 |
| 新 shape id 捕获（PPT-09/10 undo 定位） | adapter（set-diff reload，office-js #5022 工作区） | — | 复用 addShape 的 beforeIds set-diff 范式 |
| inverse 方法（复用 deleteShapeById / restoreShapeProperty） | adapter（PptAdapter.ts） | operationLog.ts executeReverse 调度 | 零或极少新 inverse 方法 |
| ToolDef / humanLabel / postState / 参数 snake_case | tools/write/ppt.ts | tools/index.ts PPT_TOOLS Set + buildToolsForHost('ppt') | PPT 工具层，casing 归一化关键 |
| 运行时门控（isSetSupported + 写后回读） | adapter 方法开头 | tools/write/ppt.ts notEffectiveResult | 不支持/回读失败 → effective:false → 诚实失败/降级 |
| 合约守门（contract.test / integration.test） | CI（Vitest） | — | D-29-05 四处对齐 + D-17 fs.readFileSync 硬卡 |
| 网格模拟（远端 fallback，仅真机证伪原生时） | adapter 复合 create（多 textbox/shape） | ppt-tokens.ts 几何 token | D-29-01 安全网，非默认路径 |

---

## 三工具 Office for Web API verdict 表（核心交付物）

| 工具 | Office.js API | 所需 API set | 官方文档证据 | 社区证据 | 置信度 | Verdict | 运行时门控版本号 |
|------|--------------|-------------|-------------|---------|--------|---------|----------------|
| **PPT-09 表格** | `slide.shapes.addTable(rowCount, columnCount, options?)` 返回 Table-shape；`shape.getTable()`；`table.getCellOrNullObject(r,c).text = v` | **PowerPointApi 1.8**（建表 + cell.text + columnCount/rowCount/values）；格式化/合并/边框需 1.9 | 平台矩阵：1.8 = **Office on the web Supported**（minimum web，build 2504 桌面）。`ShapeCollection.addTable` 文档示例 + "Work with tables" 指南确认 web 可用，`TableAddOptions` 支持初始 values 二维数组 | WebSearch：addTable web 可用，常见坑=未传 1.8 门控 / 单元格 undefined throw（须用 `""`） | **HIGH**（文档）/ 真机 UAT 终判 | `isSetSupported('PowerPointApi', '1.8')`（仅建表+填文字）；若用样式/合并需 `'1.9'` |
| **PPT-10 线条** | `slide.shapes.addLine(connectorType?, options?)` 返回 line-shape；`shape.lineFormat.color/weight/dashStyle` | **PowerPointApi 1.4**（addLine + ShapeLineFormat 全属性） | 平台矩阵：1.4 = **Office on the web Supported**。`ShapeCollection.addLine` 文档示例（left/top=起点，width/height=终点偏移）。⚠️ `ShapeLineFormat` + `Shape` 类**无 arrowhead 属性**（arrowhead 仅 Excel.Shape） | WebSearch：addLine web 可用；connectorType=Straight/Elbow/Curve（连接符形态非箭头） | **HIGH**（文档）/ 真机 UAT 终判 | `isSetSupported('PowerPointApi', '1.4')` |
| **PPT-11 渐变** | ❌ 无。`ShapeFill` 仅 `setSolidColor(color)` / `setImage(b64)` / `clear()`（PowerPointApi 1.4/1.8） | — | `ShapeFill` 类（含 powerpoint-js-preview）**无任何 setGradient 方法**；`type` 含 `"Gradient"` 仅只读返回值。全平台（含桌面）Office.js 都无渐变写 API | — | **HIGH 负面** | 不适用（无 API 可门控）→ 直接走纯色 + 告知 |

### Verdict 详解

**PPT-09（HIGH，可用）** — `addTable` 是 1.8 的 ShapeCollection 方法，1.8 平台矩阵列 web Supported（本地 `@types/office-js` v1.0.591 index.d.ts:184197 确认签名 `addTable(rowCount: number, columnCount: number, options?: PowerPoint.TableAddOptions): PowerPoint.Shape`）。填值最佳路径：**addTable 时传 `TableAddOptions`（不直接支持纯 2D values 顶层字段，须用 rows/columns 属性数组）；更稳妥是建表后逐 cell `getCellOrNullObject(r,c).text = value`**（TableCell.text 是 1.8 成员，index.d.ts:182545+）。⚠️ 坑：`TableAddOptions` 的 rows/columns 数组长度必须等于 rowCount/columnCount（否则 throw）。建议 plan 用「addTable(r,c) 裸建 → reload 定位 → 逐 cell.text 填值」三段式（镜像 addShape set-diff 范式规避 office-js #5022）。

**PPT-10（HIGH，线条可用 / 箭头不可用）** — `addLine` 是 1.4 成员（index.d.ts:184173/184184，两个重载：枚举 + 字符串），1.4 web Supported。line shape 的几何语义：`options.left/top` = 起点坐标，`options.width/height` = 终点相对偏移（文档示例明示）。**箭头头：PowerPoint 命名空间无 arrowhead 任何属性**（grep `@types/office-js` 确认 `beginArrowheadStyle`/`endArrowheadStyle` 仅在 `Excel.Shape` L56286+，PowerPoint 区段无）。→ 工具能加直线/折线/曲线连接符（含颜色/粗细/虚线），**无法加箭头三角头**。plan 须处理：① 工具命名建议 `add_connector` 或 `add_line`（不暗示箭头）；② 若用户请求箭头 → 诚实告知「平台支持线条但不支持箭头样式，已插入无箭头线条」（部分价值，不静默假装）。

**PPT-11（HIGH 负面，降级纯色）** — `ShapeFill` 完整 API 已逐一核查（含 preview moniker），无渐变写方法。这是确定性负面结论，非「待真机验证」。D-29-02 降级纯色是**唯一**路径。注意：渐变降级与现有 `set_shape_property`（fill_color → setSolidColor）功能重叠（用户已接受，D-29-02）。渐变工具的差异化价值 = 接收 LLM 给的渐变 stops + 方向参数，**取首色（或主色）落纯色 + 量化告知**，让 agent 不必知道平台限制就能调用（工具内部降级）。

---

## NFR-12 bundle 收口章节

### 实测基线（2026-06-06，Phase 28 完成 + 本次 `npm run build && npm run size`）

```
main-*.js gzip: 82.47 KB   [VERIFIED: npm run size 实测，dist/assets/main-KjySbOO7.js]
Size limit:     100 KB     [VERIFIED: .size-limit.json limit:"100 KB" gzip:true]
余量:           17.53 KB gzip
```

**全里程碑累积已在基线内**：当前 82.47KB 已包含 Phase 26（配置导入导出 UI / configBackup.ts + SettingsPanel 分区）+ Phase 27（Word 5 工具）+ Phase 28（Excel 3 工具）全部代码 —— 因为这些 phase 都已 completed 并合入 main。**Phase 29 只需在此基线上叠加 3 个 PPT 工具增量**，不存在 CONTEXT 担心的「叠加 Phase 26 配置 UI 未计入」风险（26 已计入）。

### 新代码落点分析

| 落点 | 是否进初始 main chunk | 增量预估（gzip） | 处理 |
|------|---------------------|----------------|------|
| `PptAdapter.ts` 新增 3 写方法 + 0-1 inverse | ❌ 懒加载（createAdapter 动态 import，`adapters/index.ts` 已验，dist 有独立 PptAdapter-*.js chunk） | 不进 main | 无需处理 |
| `tools/write/ppt.ts` 新增 3 ToolDef | ✅ 进 main（agent 路径同步 import） | ~1.0-2.0 KB | 在预算内，无需懒加载 |
| `operationLog.ts` 扩 kind/接口/case | ✅ 进 main | ~0.2 KB | 在预算内 |
| `tools/index.ts` PPT_TOOLS Set 加 3 名 | ✅ 进 main | 极小 | 在预算内 |
| 网格模拟（若启用，复合 create + ppt-tokens 几何） | 在 PptAdapter（懒加载 chunk） | 不进 main | ppt-tokens.ts 已是现有模块，复用不增量 |

**合计初始 main 增量预估 ~1.5-2.5 KB gzip → 收口后约 84-85 KB，远低于 100 KB gate。结论：不需任何懒加载改造。**

### 收口守则（D-29-08）

- **动 bundle 前先 `npm run build` 再 `npm run size`**（memory `project_bundle_size_guard`：size 测陈旧 dist 给假绿）。Phase 29 收尾 plan 的 acceptance_criteria 必含此两步顺序。
- 质量 >> 包体积（memory `project_quality_over_cost`），但 bundle gate 仍硬守。当前余量充裕，无需为省字节牺牲工具完整度。
- 若未来意外超 100KB（不太可能）：优先把 PPT 工具的非热路径剥离到 PptAdapter 懒加载 chunk（ToolDef 的 execute 委托给 adapter，本就是这个结构）。

---

## Standard Stack

### Core（沿用 Phase 10 已落地 PPT 范式）

| Library / API | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| `Office.js` CDN | PowerPointApi 1.8（表格）/ 1.4（线条 + fill） | PPT 宿主 API | 唯一接口，类型由 `@types/office-js` v1.0.591 提供 [VERIFIED] |
| `PptAdapter.ts` | 当前 codebase（~3106 行） | 3 写方法 + inverse | `PowerPoint.run` 闭包范式、before-image+inverse、addShape set-diff 定位、deleteShapeById |
| `operationLog.ts` | 当前 codebase | kind union + DocumentAdapterForReplay 接口 + executeReverse | 反操作调度层 |
| `tools/write/ppt.ts` | 当前 codebase（~796 行） | 3 ToolDef | set_shape_property（L141）/ add_shape（L369）/ apply_slide_layout（L726）范式 |
| `tools/index.ts` | 当前 codebase | PPT_TOOLS Set（L34-51）+ buildToolsForHost('ppt')（L319） | casing 归一化 + 注册点 |

### 三工具 API set 确认

| 工具 | Office.js API | API set | Office for Web | 信心 |
|------|--------------|---------|----------------|------|
| insert_ppt_table（建议名） | `shapes.addTable(rows, cols, opts?)` | PowerPointApi 1.8 | Supported | HIGH [CITED: Microsoft Learn PowerPointApi requirement sets 平台矩阵 + ShapeCollection 类] |
| insert_ppt_table（填值） | `table.getCellOrNullObject(r,c).text = v` | PowerPointApi 1.8 | Supported | HIGH [CITED: index.d.ts:182545+ TableCell] |
| add_line（建议名） | `shapes.addLine(connectorType?, opts?)` | PowerPointApi 1.4 | Supported | HIGH [CITED: ShapeCollection 类 addLine 重载] |
| add_line（颜色/粗细） | `shape.lineFormat.color/weight/dashStyle` | PowerPointApi 1.4 | Supported | HIGH [CITED: ShapeLineFormat 类] |
| add_line（箭头） | ❌ 无 PowerPoint arrowhead API | — | 不可用 | HIGH 负面 [VERIFIED: grep @types/office-js arrowhead 仅 Excel] |
| set_shape_gradient（建议名）→ 纯色 | `shape.fill.setSolidColor(color)` | PowerPointApi 1.4 | Supported | HIGH [CITED: ShapeFill 类] |
| set_shape_gradient（真渐变） | ❌ 无 ShapeFill 渐变写 API | — | 不可用（全平台） | HIGH 负面 [CITED: ShapeFill 类无 setGradient] |

**安装：** 无需新依赖（全部 Office.js CDN runtime + 既有 `@types/office-js`）。**0 净新增运行时依赖**（CONTEXT 目标达成）。

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PPT-09 原生 addTable | 形状网格模拟（D-29-01） | 网格模拟非真实表格对象、复合 undo 更复杂、成本更高 → 仅真机证伪原生时启用；原生可用就别用 |
| PPT-09 cell.text 逐格填 | addTable 时传 TableAddOptions values | TableAddOptions 的 rows/columns 数组要求长度严格匹配 + 空格须 `""`，逐 cell.text 更鲁棒、错误隔离更好 |
| PPT-11 真渐变 | 纯色降级（D-29-02） | Office.js 无渐变 API → 纯色是唯一路径，无 tradeoff |

---

## Architecture Patterns

### System Architecture Diagram

```
LLM tool_call (camelCase 或 snake_case 参数)
     │
     ▼
dispatchTool (tools/index.ts)
     │ PPT_TOOLS.has(name) ? normalizeToSnakeCase : 透传
     │ ⚠️ 新工具名必须入 PPT_TOOLS Set，否则 camelCase 参数不归一化 → 静默丢参 no-op
     ▼
ToolDef.execute (tools/write/ppt.ts)   snake_case 解构
     ├─ insert_ppt_table → adapter.insertTable(slideIndex, rows, cols, data?)
     │     │ ① addTable(r,c) 裸建 → sync → ② reload set-diff 定位新 table-shape id
     │     │ ③ getTable().getCellOrNullObject(r,c).text=v 逐格填 → sync
     │     │ ④ 写后回读 shape count +1（生效验证）
     │     └─ 返回 { newShapeId }
     ├─ add_line → adapter.addLine(slideIndex, connectorType, start, end, lineProps?)
     │     │ ① addLine(type, {left,top,width,height}) 裸建 → sync → ② set-diff 定位
     │     │ ③（可选）reload-proxy 设 lineFormat.color/weight → sync
     │     │ ④ 写后回读 shape count +1
     │     └─ 返回 { newShapeId }；箭头请求 → 告知不支持
     └─ set_shape_gradient → adapter.setShapeGradientAsSolid(slideIndex, shapeId, firstColor)
           │ 复用 setShapeProperty before-image 读 fill → setSolidColor(firstColor) → 回读 fill.type
           └─ 返回 { beforeImage }；告知「纯色代替渐变」
     │
     ▼
ToolResult { ok, data:{new_shape_id|...}, reverse, postState }
     │  ⚠️ 写后回读失败 → notEffectiveResult()（ok:false，不带 reverse/postState，不假成功）
     ▼
operationLog.appendOperation
     │
     ▼  (undo 时)
executeReverse(reverse, adapter)
     ├─ 'delete_shape_by_id' → adapter.deleteShapeById(args)   ← PPT-09 表格 + PPT-10 线条 复用（零新 reverse）
     └─ 'restore_shape_property' → adapter.restoreShapeProperty(args)  ← PPT-11 纯色降级 复用（零新 reverse）
```

### Recommended Project Structure（仅改动点）

```
src/adapters/PptAdapter.ts        ← 新增 insertTable / addLine / setShapeGradientAsSolid（或复用 setShapeProperty）
                                     （inverse 大概率全复用 deleteShapeById / restoreShapeProperty，零新 inverse）
src/agent/operationLog.ts         ← PostStateSnapshot.kind 加 'ppt_table'/'ppt_line'/'ppt_shape_gradient'
                                     （readTargetState 保守返 undefined，不加比对）
                                     reverse 大概率复用现有 case，可能 0 个新 executeReverse case
src/agent/contract.test.ts        ← CONTRACT 加 3 行 phase:29 + PhaseNum 加 29 + 长度断言 ≥24→≥27（可选）
src/agent/tools/write/ppt.ts      ← 新增 3 ToolDef
src/agent/tools/index.ts          ← PPT_TOOLS Set 加 3 名 + pptWriteTools 数组加 3 ToolDef + import
src/agent/operationLog.integration.test.ts ← 新增 3 守门用例（含 3 toolName 字面量，D-17）
.planning/phases/08-foundation-a-f/CONTRACT.md ← 可选同步加 Phase 29 段（非 CI 真相源）
```

### Pattern 1: 新建 shape + delete_shape_by_id undo（PPT-09 表格 / PPT-10 线条共用）

```typescript
// Source: PptAdapter.ts:1584 addShape（set-diff 定位规避 office-js #5022）+ tools/write/ppt.ts:369 add_shape ToolDef
// 表格/线条都是「新建 shape → 捕获 id → delete 逆向」，直接镜像 add_shape
async insertTable(slideIndex: number, rows: number, cols: number, data?: string[][]): Promise<{ newShapeId: string }> {
  return await PowerPoint.run(async (ctx) => {
    const slides = ctx.presentation.slides; slides.load('items'); await ctx.sync();
    const idx = slideIndex - 1;
    if (idx < 0 || idx >= slides.items.length) throw new HostApiError(`第 ${slideIndex} 张不存在`, undefined);
    const slide = slides.items[idx] as unknown as { shapes: { load:(f:string)=>void; items:Array<{id:string}>; addTable:(r:number,c:number,o?:unknown)=>unknown } };
    // 运行时门控（PowerPointApi 1.8）：不支持 → 触发 D-29-01 网格模拟 fallback（plan 决定）
    // sync 2: before-ids（set-diff）
    slide.shapes.load('items/id'); await ctx.sync();
    const beforeIds = new Set((slide.shapes.items as Array<{id:string}>).map(s=>s.id));
    const beforeCount = slide.shapes.items.length;
    // 裸建（office-js #5022：不碰 add-return proxy 的属性）
    slide.shapes.addTable(rows, cols);
    await ctx.sync(); // sync 3
    // reload 定位 + 写后回读 count+1
    slide.shapes.load('items/id'); await ctx.sync(); // sync 4
    const after = slide.shapes.items as Array<{id:string}>;
    if (after.length < beforeCount + 1) throw new HostApiError('PPT insertTable: 表格未落地（count 未增）', undefined);
    const newShapeId = after.filter(s=>!beforeIds.has(s.id)).pop()!.id;
    // 填值：在稳定 proxy 上 getTable().getCellOrNullObject(r,c).text = v（plan 实现，逐格 + sync）
    return { newShapeId };
  });
}
```

```typescript
// ToolDef reverse（tools/write/ppt.ts）— 复用 delete_shape_by_id，零新 reverse 工具
const reverse: ReverseDescriptor = { tool: 'delete_shape_by_id', args: { slide_index, shape_id: newShapeId } };
const postState: PostStateSnapshot = { kind: 'ppt_table', content: { slide_index, shape_id: newShapeId } };
```

### Pattern 2: 渐变降级纯色 + before-image undo（PPT-11）

```typescript
// Source: PptAdapter.ts:889 setShapeProperty（before-image fill 读 + setSolidColor 写）+ :1033 restoreShapeProperty
// 渐变工具内部：取 stops 首色 → 复用 setShapeProperty 的 fillColor 路径 → reverse = restore_shape_property
// execute（tools/write/ppt.ts）：
const firstColor = pickFirstStopColor(gradient_stops); // discretion：首色 vs 主色
const { beforeImage } = await (ctx.adapter as PptAdapter).setShapeProperty(slide_index, shape_id, { fillColor: firstColor });
const reverse: ReverseDescriptor = {
  tool: 'restore_shape_property',
  args: { slide_index, shape_id, fill_type: beforeImage.fillType, fill_color: beforeImage.fillColor,
          line_color: beforeImage.lineColor, line_weight: beforeImage.lineWeight,
          line_visible: beforeImage.lineVisible, width: beforeImage.width, height: beforeImage.height },
};
const postState: PostStateSnapshot = { kind: 'ppt_shape_gradient', content: { slide_index, shape_id } };
// data 含降级告知：「平台不支持渐变，已用纯色 #RRGGBB 代替」（精确量化，memory precision_over_brevity）
return { ok: true, data: { slide_index, shape_id, applied_color: firstColor, degraded: 'gradient_to_solid' }, reverse, postState };
```

### Pattern 3: 写后回读验证 + 诚实失败（D-29-07）

```typescript
// Source: PptAdapter.ts:2572 setSlideBackground（写后回读 fill.type）+ tools/write/ppt.ts:84 notEffectiveResult
// 网页版静默 no-op 防御：addTable/addLine 后回读 shape count +1；setSolidColor 后回读 fill.type==='Solid'
// 回读失败（count 未增 / type 未变）→ throw HostApiError 或返回 effective:false → 工具层 notEffectiveResult()
if (!effective) return notEffectiveResult('插入表格');  // ok:false，不带 reverse/postState，不报 ✅，熔断记 failure
```

### Anti-Patterns to Avoid

- **新工具名不入 PPT_TOOLS Set：** LLM 给 camelCase 参数（slideIndex）→ normalizeToSnakeCase 不处理 → execute 读 snake_case（slide_index）得 undefined → 静默丢参 no-op（memory `project_ppt_officejs_gotchas`，PPT 专属坑，Word/Excel 无此 Set）。**3 个新工具名必须加进 tools/index.ts:34 PPT_TOOLS Set。**
- **PPT 表格工具名撞 Word `insert_table`：** Word 已有 `insert_table`（contract.test.ts:39）。PPT 表格须用不撞名（建议 `insert_ppt_table`）。host 隔离机制：`buildToolsForHost('ppt')` 与 `'word'` 返回独立工具集，但 contract.test.ts CONTRACT 数组是全局扁平表 + integration.test 守门用 toolName 字符串匹配 → **同名会让 D-17 fs.readFileSync 误匹配 + 语义混乱**。不撞名是硬要求。
- **碰 add-return proxy：** addTable/addLine 返回的 proxy 立即读 id / 设属性 → 网页版 `InvalidParam passed to GetItem(id)`（office-js #5022，UAT-8/9 真机根因）。必须裸建 → sync → reload 集合 → set-diff 取稳定 proxy 再操作（PptAdapter.ts:1622-1666 已固化此范式）。
- **inverse 用位置参：** `restoreShapeProperty(slide_index, shape_id)` 触发 Phase 5 翻车点 → 真机撤销全挂。必须 `(args: Record<string, unknown>)`（memory `project_adapter_inverse_signature`）。
- **新 PostStateSnapshot.kind 盲加 readTargetState 比对：** 新 kind 在 readTargetState 必须保守返 undefined（不加 case）→ isTargetStateConsistent 视为一致 → 不误判手改（memory `project_adapter_inverse_signature`：盲加会误判全部手改跳过 undo）。
- **假装设了渐变 / 假装加了箭头：** PPT-11 必须告知纯色代替；PPT-10 箭头请求必须告知线条无箭头。不静默假成功（ROADMAP SC#4 诚实降级判据）。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PPT 表格对象 | 形状网格模拟（多 textbox 拼） | `shapes.addTable(r,c)` 原生（1.8 web 可用） | 原生是真实可编辑表格对象，网格模拟非表格、undo 复合更脆；网格仅真机证伪原生时的 fallback |
| 新 shape id 定位 | 自己猜 append 顺序 / index | addShape 的 beforeIds set-diff reload 范式 | office-js #5022：碰 add-return proxy 会抛 InvalidParam，set-diff 是已验证正解 |
| 表格/线条 undo | 新 reverse 工具 | 复用 `delete_shape_by_id` | 表格/线条都是单 shape，现有 deleteShapeById 直接够用，零新 reverse |
| 渐变 undo | 新 restore_shape_gradient | 复用 `restore_shape_property`（before-image fill） | 纯色填充的 before-image 还原与 set_shape_property 完全同构 |
| 写生效判定 | 假设写就成功 | 写后回读 count/fill.type（notEffectiveResult 范式） | 网页版静默 no-op 常见，回读是诚实底线（PptAdapter:2572） |

**Key insight:** Phase 29 三工具的 undo 设计极可能**零或极少新 reverse 工具**——表格/线条复用 `delete_shape_by_id`，渐变纯色复用 `restore_shape_property`。这大幅降低合约接线复杂度（D-29-06 的「倾向复用」推断被证实）。

---

## Runtime State Inventory

> 本 phase 是新增 write 工具（无 rename/refactor/migration）。

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — undo 记录是 in-memory（operationLog Map<runId>），不落 localStorage（PITFALLS A-11） | 无 |
| Live service config | None — 无外部服务，纯 Office.js 宿主调用 | 无 |
| OS-registered state | None | 无 |
| Secrets/env vars | None — 三工具不涉及 API Key（Office.js 宿主调用，非 Provider fetch） | 无 |
| Build artifacts | None — 无 pyproject/egg-info；JS bundle 由 vite build 重新生成 | 无 |

---

## Common Pitfalls

### Pitfall 1: PPT 工具参数 snake/camel 不一致 → 静默丢参 no-op
**What goes wrong:** LLM 发 camelCase（`slideIndex`），execute 解构 snake_case（`slide_index`）得 undefined，工具静默执行成 no-op。
**Why it happens:** dispatch 不校验参数；PPT 工具靠 `PPT_TOOLS.has(name) → normalizeToSnakeCase` 归一化（Word/Excel 无此 Set）。新工具未加 PPT_TOOLS 就不归一化。
**How to avoid:** 3 个新工具名必须加进 `tools/index.ts:34 PPT_TOOLS Set`；adapter 内部对易错键做 snake/camel 双键容错。
**Warning signs:** 工具报成功但幻灯片无变化；真机比测试环境更易暴露（mock 不复现 casing）。

### Pitfall 2: addTable/addLine 返回 proxy 立即访问 → InvalidParam（office-js #5022）
**What goes wrong:** `const t = shapes.addTable(3,4); t.load('id')` → sync 抛 `InvalidParam passed to GetItem(id)`。
**Why it happens:** 网页版新 shape 尚未在宿主端登记完，碰 fresh add-proxy 的任何访问都可能崩 sync（拆 sync 无效）。
**How to avoid:** 裸建（只调 addTable/addLine 本身）→ sync → reload 整个 shapes 集合 → set-diff 取稳定 proxy 再读 id / 填值。镜像 PptAdapter.ts:1622-1666。
**Warning signs:** 真机网页版插入崩溃（测试 mock 不复现）。

### Pitfall 3: 网页版写操作静默 no-op（addTable/setSolidColor 报成功但没生效）
**What goes wrong:** 工具返回 ok 但表格/线条/颜色没出现。
**Why it happens:** Office for Web PPT 写操作偶发静默失败。
**How to avoid:** 写后回读验证——addTable/addLine 回读 shape count +1；setSolidColor 回读 fill.type==='Solid'。回读失败 → `notEffectiveResult()`（ok:false，不记 undo，不报 ✅）。
**Warning signs:** undo 时报「形状不存在」（因正向其实没建成）。

### Pitfall 4: TableAddOptions / cell.text 填值的 undefined throw
**What goes wrong:** 给 addTable 传含 undefined 的 values，或 TableAddOptions 的 rows/columns 数组长度 ≠ rowCount/columnCount → API throw。
**Why it happens:** addTable 要求空单元格用 `""`（非 undefined）；rows/columns 属性数组长度严格匹配。
**How to avoid:** 用「addTable(r,c) 裸建 + 逐 cell.text 填值」三段式（错误隔离好），data 缺格用 `""` 兜底；不用 TableAddOptions 的 values 路径。
**Warning signs:** addTable 直接抛 InvalidArgument。

### Pitfall 5: 把渐变/箭头当成功上报（违反诚实降级）
**What goes wrong:** 渐变工具静默上纯色却不告知 / 线条工具忽略箭头请求不说明。
**Why it happens:** Office.js 无渐变写 API、无 PPT arrowhead API。
**How to avoid:** 渐变 → data 含「平台不支持渐变，已用纯色 #RRGGBB 代替」；箭头请求 → 告知「平台支持线条但不支持箭头样式」。量化精确（memory `precision_over_brevity`）。这是 ROADMAP SC#4 诚实降级 PASS 判据。
**Warning signs:** 用户以为上了渐变/箭头，视觉与预期不符却无解释。

### Pitfall 6: isSetSupported 在 integration test mock 环境缺失
**What goes wrong:** 门控调用 `Office.context.requirements.isSetSupported` 在 mock 中抛 TypeError。
**Why it happens:** mockPpt 工厂默认不设 Office 全局。
**How to avoid:** 复用 `mockOfficeSupportsAll()`（operationLog.integration.test.ts:389，所有版本返 true）；afterEach `delete global.Office`（L383 已有）。adapter 门控判断须容错 `typeof Office === 'undefined'`（PptAdapter:2593 范式）。
**Warning signs:** 守门用例报 TypeError 而非 rolled_back/skipped_error。

---

## Code Examples

### 合约接线四处对齐（D-29-05，照搬 Phase 28 行 70-72 范式）

```typescript
// 1. contract.test.ts:18 — PhaseNum 联合类型加 29
type PhaseNum = 9 | 10 | 11 | 23 | 27 | 28 | 29;

// 2. contract.test.ts CONTRACT 数组加 3 行（reverseTool 大概率全复用现有）
// ─── Phase 29 PPT 工具补全 ───
{ toolName: 'insert_ppt_table', host: 'ppt', undoType: '简单逆向', reverseTool: 'delete_shape_by_id', phase: 29, integrationTest: true },
{ toolName: 'add_line', host: 'ppt', undoType: '简单逆向', reverseTool: 'delete_shape_by_id', phase: 29, integrationTest: true },
{ toolName: 'set_shape_gradient', host: 'ppt', undoType: '简单逆向', reverseTool: 'restore_shape_property', phase: 29, integrationTest: true },

// 3. contract.test.ts:154 长度断言（当前 ≥24，现有 CONTRACT 共 31 行，加 3 后 34 行）
//    ≥24 加 3 后仍通过；CONTEXT 建议上调 ≥27（可选，非必需，34 远超 24）

// 4. operationLog.ts PostStateSnapshot.kind union 加 3 个（readTargetState 保守 undefined）
//    | 'ppt_table' | 'ppt_line' | 'ppt_shape_gradient'

// 5. executeReverse switch：delete_shape_by_id 与 restore_shape_property case 已存在（L371/L167），
//    复用即可 → 极可能 0 个新 case
```

### integration.test 守门用例（D-17 硬卡，镜像 add_shape 用例 L1245）

```typescript
// Source: operationLog.integration.test.ts:1245 add_shape → delete_shape_by_id → rolled_back
it('D-29: insert_ppt_table → delete_shape_by_id → rolled_back', async () => {
  mockPpt('');                       // mock PowerPoint 全局（需扩 addTable mock）
  mockOfficeSupportsAll();           // mock isSetSupported（PowerPointApi 1.8 门控）
  const adapter = new PptAdapter();  // ⚠️ 真 PptAdapter 实例（非 mock adapter，才抓得到 Record 签名错配）
  const entry: OperationLogEntry = {
    runId: 'r29', stepIndex: 0, toolName: 'insert_ppt_table',
    args: { slideIndex: 1, rows: 3, cols: 4 },
    humanLabel: '在第 1 张幻灯片插入 3×4 表格',
    reverse: { tool: 'delete_shape_by_id', args: { slide_index: 1, shape_id: 'new-shape-uuid' } },
    postState: { kind: 'ppt_table', content: { slide_index: 1, shape_id: 'new-shape-uuid' } },
    timestamp: 0,
  };
  const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
  expect(detail.status).toBe('rolled_back');
});
// add_line / set_shape_gradient 各加一条同构用例；3 个 toolName 字面量必现于本文件（D-17 fs.readFileSync 硬卡）
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 10 spike 记「PowerPointApi 1.8 web 表格待验」→ 假设网页版不能建表 | PowerPointApi 1.8 已 GA + web Supported（addTable 文档示例） | 1.8 web GA（2025，build 2504 桌面同期） | PPT-09 可原生建表，网格模拟降为 fallback |
| `slide.background.fill.setSolidColor`（不存在） | `SlideBackgroundFill.setSolidFill({color})`（背景）/ `ShapeFill.setSolidColor`（形状） | 260531-m4x 修复 | 形状填充用 ShapeFill.setSolidColor（PPT-11 纯色路径） |
| `@microsoft/office-js` npm 包 | CDN script tag | 官方 deprecated | npm 包无平台感知 |

**Deprecated/outdated:**
- 渐变填充 Office.js API：**从未存在**（不是 deprecated，是 never implemented）。PPT-11 必须降级纯色。
- PowerPoint arrowhead API：**从未存在于 PowerPoint 命名空间**（仅 Excel.Shape 有）。PPT-10 箭头不可设。

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PowerPointApi 1.8 在真机 Office for Web 上 `addTable` 真正生效（非仅类型/isSetSupported 返 true） | verdict 表 PPT-09 | 若真机静默 no-op → 写后回读 count 兜底 → 触发 D-29-01 网格模拟 fallback（安全网已锁，不阻塞） |
| A2 | `addLine` 在真机 web 真正生效 + line shape 可被 deleteShapeById 删除 | verdict 表 PPT-10 | 若 web no-op → 写后回读兜底 → 诚实拒绝（D-29-03，安全网） |
| A3 | `getCellOrNullObject(r,c).text = v` 在真机 web 填值生效（1.8 cell.text 写） | verdict 表 PPT-09 | 若填值 no-op → 退「建空表 + 告知请手动填」或网格模拟 |
| A4 | 渐变工具降级纯色与现有 set_shape_property 重叠可接受（用户 D-29-02 已接受） | PPT-11 | 用户已拍板，无风险 |
| A5 | 三工具 undo 全复用 delete_shape_by_id / restore_shape_property，0 新 reverse 工具 | Don't Hand-Roll | 若 plan 发现某降级需特殊逆向 → 新增 reverse + executeReverse case + 接口（成本可控） |

**真机 UAT 是 A1/A2/A3 的最终 verdict 来源**（Claude 跑不了真机 Office for Web，memory `feedback_self_run_spikes`）。文档级 HIGH + 运行时门控降级安全网已足以让 plan/execute 推进，不前置阻塞。

---

## Open Questions

1. **PPT-09 表格填值最佳 sync 切分**
   - What we know: addTable 裸建 → reload 定位 → getTable().getCellOrNullObject(r,c).text=v 填值
   - What's unclear: 填值是否需独立 PowerPoint.run（office-js #5022 同 run 内插入后再操作偶发卡死，generate_ppt_image 用独立 run 回读）
   - Recommendation: plan 实现时若同 run 填值崩 → 拆独立 run 填值（镜像 IMG-01 回读用独立 run）

2. **PPT-10 工具命名 + 箭头语义边界**
   - What we know: addLine 加线条/连接符（Straight/Elbow/Curve），无箭头头 API
   - What's unclear: 工具命名是否暗示箭头（`add_line` vs `add_connector`）；用户请求箭头时如何措辞
   - Recommendation: 命名 `add_line`，description 明示「支持直线/折线/曲线连接符 + 颜色/粗细/虚线，不支持箭头头样式」；箭头请求 → 插无箭头线条 + 告知

3. **网格模拟 fallback 是否需要真造**
   - What we know: 原生 addTable web 可用（文档级），网格模拟是 D-29-01 安全网
   - What's unclear: 真机 UAT 前无法 100% 确证原生生效；是否值得预先实现网格模拟代码
   - Recommendation: plan 先实现原生 happy-path + 运行时门控（isSetSupported false / 回读失败 → 报诚实失败）。网格模拟**先不实现**，标为「真机 UAT 若证伪原生 → 补网格」的 follow-up（避免预造可能用不上的复合 undo 代码 + bundle 增量）。这符合 memory `feedback_self_run_spikes`（v1 验过/能跑的别预造）。⚠️ 但 D-29-01 是用户 LOCKED 决策 → plan 须在 PLAN/VALIDATION 显式记录此推断，留 verify-work / discuss 复核。

---

## Environment Availability

Step 2.6: SKIPPED（Phase 29 是纯 Office.js API + 代码变更，无外部 CLI/服务/数据库依赖；所有 API 通过 Office.js CDN runtime 提供，构建用既有 Node 22 + vite + lingui + vitest）。

---

## Validation Architecture

> Nyquist validation 启用（.planning/config.json 无 nyquist_validation:false）。

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest（vitest.config.ts 已存在） |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --run src/agent/contract.test.ts src/agent/operationLog.integration.test.ts` |
| Full suite command | `npm test -- --run` |

⚠️ test 脚本 = `tsc --noEmit && vitest run`（先类型检查再跑）。memory `i18n_extract_and_test_noise`：「N failed」才是真失败，尾部 3 个 retry errors 是噪音。

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PPT-09 | insert_ppt_table 正向（真 PptAdapter）→ delete_shape_by_id → rolled_back | integration | `npm test -- --run operationLog.integration.test.ts` | ❌ Wave 0 新建 |
| PPT-09 | 门控/回读失败 → 诚实失败（notEffectiveResult / skipped_error） | integration | 同上 | ❌ Wave 0 新建 |
| PPT-10 | add_line 正向 → delete_shape_by_id → rolled_back | integration | 同上 | ❌ Wave 0 新建 |
| PPT-11 | set_shape_gradient 降级纯色 → restore_shape_property → rolled_back | integration | 同上 | ❌ Wave 0 新建 |
| PPT-11 | 降级告知文案含「纯色代替」（诚实降级） | unit（ToolDef data 断言）或 integration | 同上 | ❌ Wave 0 新建 |
| 合约 | CONTRACT 长度 ≥24（加 3 后 34）+ host/undoType/reverseTool 枚举校验 | unit | `npm test -- --run contract.test.ts` | ✅ 已存在，加 3 行自动通过 |
| 合约 | D-17：3 个 toolName 字面量出现在 integration.test.ts | unit | 同上 | ❌ Wave 0 守门用例后满足 |
| 合约 | PhaseNum 加 29（TS 编译） | type | `tsc --noEmit`（含在 npm test） | ❌ Wave 0 改 |
| NFR-12 | main-*.js gzip ≤100KB | manual/CI | `npm run build && npm run size`（先 build 再 size） | ✅ 已配置 .size-limit.json |

### Sampling Rate

- **Per task commit:** `npm test -- --run src/agent/contract.test.ts src/agent/operationLog.integration.test.ts`
- **Per wave merge:** `npm test -- --run`（全套绿）
- **Phase gate:** 全套绿 + `npm run build && npm run size` ≤100KB + 真机 UAT（U-1~U-5）before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/agent/operationLog.integration.test.ts` — 追加 3-5 个守门用例（每工具 ≥1 正向 rolled_back + 降级路径断言；3 toolName 字面量满足 D-17）
- [ ] `src/agent/operationLog.integration.test.ts` — mockPpt 扩 addTable/addLine mock（参照现有 mockPpt L176）
- [ ] `src/agent/contract.test.ts` — CONTRACT 加 3 行 + PhaseNum 加 29
- [ ] `src/agent/operationLog.ts` — PostStateSnapshot.kind 加 3 个（ppt_table/ppt_line/ppt_shape_gradient）；executeReverse 大概率 0 新 case（复用 delete_shape_by_id / restore_shape_property）
- [ ] Lingui 宏：3 工具是否触及 UI surface？→ **大概率不触及**（工具是 agent loop 内调用，结果走 DiffLog 卡 humanLabel 中文字面量，非 Lingui 宏；同 Phase 27/28，无 UI-SPEC）。若 humanLabel/告知文案用了 `t`/`<Trans>` 宏 → 须跑 `npm run extract`（否则 coverage.test.ts 红）。plan 确认：沿用现有 ppt.ts humanLabel 的纯中文模板字符串（非宏）即可避开。

*（框架已就绪：Vitest + contract.test + integration.test 基建完整，仅需追加用例，无框架安装。）*

---

## Security Domain

> security_enforcement 默认启用。

本 phase 无新认证/会话/加密表面（API Key 不涉及——三工具是 Office.js 宿主调用，非 Provider fetch 路径）。

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes（轻度） | slide_index/shape_id/rows/cols 经 adapter bounds check（idx 越界 → HostApiError）；颜色字符串传 Office.js setSolidColor 由宿主校验；错误用字面量包装不 interpolate err.message（防 apiKey 从错误链泄漏，T-16-05 范式） |
| V6 Cryptography | no | — |

### Known Threat Patterns for Office.js PPT write

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 错误消息 interpolate 宿主 err.message 泄漏 Key | Information Disclosure | 错误用字面量（HostApiError 固定中文），不拼 err.message（PptAdapter 既有范式） |
| 越界 slide_index/shape_id | Tampering / DoS | adapter bounds check → HostApiError NOT_FOUND（既有范式 PptAdapter:919） |

---

## Sources

### Primary（HIGH confidence）

- [Microsoft Learn — PowerPoint JavaScript API requirement sets（平台矩阵，更新 2025-12-16）](https://learn.microsoft.com/en-us/javascript/api/requirement-sets/powerpoint/powerpoint-api-requirement-sets) — PowerPointApi 1.1-1.10 全部 Office on the web **Supported**；1.4=shapes（addLine）、1.8=tables（addTable）、1.9=table formatting、1.10=slide background
- [Microsoft Learn — PowerPoint.ShapeCollection class（更新 2026-05-29）](https://learn.microsoft.com/en-us/javascript/api/powerpoint/powerpoint.shapecollection) — `addTable(rowCount, columnCount, options)` [1.8] / `addLine(connectorType?, options?)` [1.4] / `addGeometricShape` [1.4] / `addTextBox` [1.4] 全部签名 + 示例
- [Microsoft Learn — PowerPoint.ShapeFill class](https://learn.microsoft.com/en-us/javascript/api/powerpoint/powerpoint.shapefill) — 方法仅 clear/setImage/setSolidColor/load/toJSON；属性 foregroundColor/transparency/type；**无渐变写 API**（含 preview moniker）
- [Microsoft Learn — PowerPoint.ShapeLineFormat class](https://learn.microsoft.com/en-us/javascript/api/powerpoint/powerpoint.shapelineformat) — 属性 color/weight/dashStyle/style/transparency/visible [1.4]；**无 arrowhead**
- [Microsoft Learn — PowerPoint.Shape class](https://learn.microsoft.com/en-us/javascript/api/powerpoint/powerpoint.shape) — **无 arrowhead 任何属性**
- [Microsoft Learn — Work with tables using the PowerPoint JavaScript API](https://learn.microsoft.com/en-us/office/dev/add-ins/powerpoint/work-with-tables) — addTable web 用法 + TableAddOptions 初始 values（空格须 `""`，undefined throw）
- `node_modules/@types/office-js` v1.0.591 index.d.ts [VERIFIED]：L184173/184184 addLine、L184197 addTable、L183585+ PowerPoint.Table（cell.text/columnCount/rowCount/values [1.8]）、L182545+ TableCell.text、L56286+ arrowhead 仅 Excel.Shape
- `src/adapters/PptAdapter.ts` [VERIFIED codebase]：setShapeProperty:889 / restoreShapeProperty:1033（before-image fill）、addShape:1584（set-diff 定位 #5022）、deleteShapeById:1809、setSlideBackground:2572（写后回读 fill.type + isSetSupported 1.10 门控）
- `src/agent/contract.test.ts` [VERIFIED]：CONTRACT 31 行、PhaseNum:18、长度断言 ≥24:154、D-17 fs.readFileSync:127-149
- `src/agent/operationLog.ts` [VERIFIED]：PostStateSnapshot.kind:34-54、DocumentAdapterForReplay:108-190、executeReverse delete_shape_by_id/restore_shape_property case
- `src/agent/tools/index.ts` [VERIFIED]：PPT_TOOLS Set:34-51、normalizeToSnakeCase:55、buildToolsForHost('ppt'):319
- `.size-limit.json` [VERIFIED]：limit "100 KB" gzip
- `npm run build && npm run size` [VERIFIED 2026-06-06]：82.47KB gzip / 100KB gate / 17.53KB 余量

### Secondary（MEDIUM confidence）

- WebSearch（addTable/addLine web 可用性 + 坑）：交叉验证文档结论，常见坑=未传门控 / 单元格 undefined throw

### Tertiary（LOW confidence）
- 无单独依赖的低置信来源（核心 verdict 全部官方文档 + 本地类型定义双重坐实）

---

## Metadata

**Confidence breakdown:**
- 三工具 web API 可用性 verdict: **HIGH** — 官方平台矩阵（PowerPointApi 1.4/1.8 web Supported）+ 类/方法文档 + 本地 d.ts v1.0.591 三重确认；PPT-11 渐变 / PPT-10 箭头是 HIGH 负面结论（API 根本不存在，非待验）。真机生效由 UAT 终判（A1/A2/A3）。
- undo 设计（复用 delete_shape_by_id / restore_shape_property）: HIGH — codebase 既有范式 + shape 语义分析
- 合约接线: HIGH — contract.test/operationLog/integration.test 逐行确认 + Phase 28 范式
- NFR-12 bundle: HIGH — 实测 build + size
- 网格模拟 fallback 必要性: MEDIUM — 原生文档级可用但真机未坐实（Open Question 3）

**Research date:** 2026-06-06
**Valid until:** 2026-07-06（PowerPointApi 平台矩阵季度更新，30 天稳定）
