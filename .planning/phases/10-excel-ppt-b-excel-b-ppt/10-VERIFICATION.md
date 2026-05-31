---
phase: 10-excel-ppt-b-excel-b-ppt
verified: 2026-05-31T10:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Spike S7：add_shape(TextBox) 不静默删除选中形状"
    expected: "在 Office for Web PPT 中选中一个形状，然后调用 add_shape(TextBox)，原形状保持存在（count 校验通过）；undo 后文本框消失（delete_shape_by_id 逆向生效）"
    why_human: "addTextBox 是否真正绕过 Office.js #2775 bug 只能在真实 PowerPoint host 上确认；count before/after 校验已在代码实现，但 bug 路径是运行时行为"
  - test: "Spike S1：rotate_shape happy-path + undo"
    expected: "在 Office for Web PPT 中旋转形状 45°，DiffLogPanel 显示「rolled_back」而非 noop+gate；undo 后角度还原"
    why_human: "shape.rotation 的读写能力取决于真实 Office host（PowerPointApi 版本）；代码已实现 try/catch 降级，但 happy-path vs 降级是真机路径"
  - test: "Spike S2：set_slide_background happy-path + undo"
    expected: "在 Office for Web PPT 中设置幻灯片纯色背景，undo 后背景还原；若 PPT API 1.10 不支持则 DiffLogPanel 显示 noop+gate warn"
    why_human: "slide.background.fill.foregroundColor 读取依赖 PowerPointApi 1.10；代码已实现 isSetSupported 门控 + try/catch 降级，真机路径需 UAT"
  - test: "Spike S4：set_shape_text_alignment happy-path + undo"
    expected: "在 Office for Web PPT 中设置文本对齐方式，undo 后对齐还原；若 paragraphFormat.alignment 不可读则显示 noop+gate"
    why_human: "textRange.paragraphFormat.alignment 的读写能力取决于真实 Office host；代码已实现 try/catch 降级，真机路径需 UAT"
---

# Phase 10: Excel + PPT 工具完整 (B-Excel + B-PPT) 验证报告

**Phase Goal:** agent 能完成 Excel 高频格式化操作（数字格式/排序/筛选/条件格式/建表/工作表管理）和 PPT 高频形状操作（字体/形状增删/旋转/幻灯片管理），所有破坏性操作有 undo 或明确的 noop+gate。
**Verified:** 2026-05-31T10:00:00Z
**Status:** human_needed
**Re-verification:** No — 初次验证

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | operationLog.ts 的 DocumentAdapterForReplay 接口包含全部 15 个新 inverse/snapshot 方法声明（Record 签名） | ✓ VERIFIED | 接口第 125-156 行：restoreRangeFormat/restoreColumnRowSize/restoreRangeValuesSnapshot/restoreAutoFilter/restoreConditionalFormat/deleteTableByName/restoreFreezePanes/restoreWorksheetSnapshot/restoreChartTitle/restoreShapeFont/restoreShapeAlignment/deleteShapeById/restoreShapeRotation/restoreSlideBackground/deleteSlideByIndex 全部以 `(args: Record<string, unknown>) => Promise<void>` 声明 |
| 2 | operationLog.ts 的 executeReverse switch 包含全部 15 个新 case（字符串逐字 = CONTRACT reverse 名） | ✓ VERIFIED | switch 第 382-441 行：case 'restore_range_format' 至 case 'delete_slide_by_index' 全部存在，每个 case 有 `if (!adapter.xxx) throw` 守门 |
| 3 | operationLog.integration.test.ts 包含 18 个 Phase 10 工具名字符串字面量（D-17 fs.readFileSync 硬卡前提），全部用真实 ExcelAdapter/PptAdapter 实例（D-19） | ✓ VERIFIED | 18 个 toolName 字面量（format_excel_range 至 copy_slide）全部存在；Phase 10 测试均用 `mockExcel()/new ExcelAdapter()` 和 `mockPpt('')/new PptAdapter()` 真实实例 |
| 4 | Excel 10 工具（EXCEL-01..10）adapter write+inverse 方法实现完整，D-17 四步守门全部完成 | ✓ VERIFIED | ExcelAdapter.ts: formatExcelRange+restoreRangeFormat / setColumnRowSize+restoreColumnRowSize / setAutoFilter+restoreAutoFilter / addConditionalFormat+restoreConditionalFormat / createTable+deleteTableByName / freezePanes+restoreFreezePanes / readRangeValuesSnapshot(private)+restoreRangeValuesSnapshot / sortRange / excelFindAndReplace / manageWorksheet+restoreWorksheetSnapshot / setChartTitle+restoreChartTitle；contract.test.ts 10 行 integrationTest:true；CONTRACT.md 10 行 status:done |
| 5 | PPT 8 工具（PPT-01..08）adapter write+inverse 方法实现完整（含 spike 门控 + noop+gate），D-17 四步守门全部完成 | ✓ VERIFIED | PptAdapter.ts: setShapeTextFont+restoreShapeFont / addShape+deleteShapeById / copySlide+deleteSlideByIndex / setShapeTextAlignment+restoreShapeAlignment / rotateShape+restoreShapeRotation / setSlideBackground+restoreSlideBackground / deleteShape / manageSlides；contract.test.ts 8 行 integrationTest:true；CONTRACT.md 8 行 status:done；spike 三工具 try/catch null 降级信号 + ToolDef 判断 noop_inverse 实现完整 |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/agent/operationLog.ts` | DocumentAdapterForReplay 接口 +15 方法声明 + executeReverse +15 case + PostStateSnapshot.kind 扩展 | ✓ VERIFIED | 接口第 125-156 行含 15 个 Phase 10 方法；switch 第 382-441 行含 15 个新 case；PostStateSnapshot.kind 第 40-43 行含 15 个新 kind（excel_range_format 至 ppt_slide_copy） |
| `src/agent/operationLog.integration.test.ts` | 18 个 Phase 10 工具守门（toolName 字符串字面量预埋，真实 adapter 实例） | ✓ VERIFIED | 第 640 行起独立 describe 块；18 条测试用 mockExcel/new ExcelAdapter 或 mockPpt/new PptAdapter；delete_shape + manage_slides 断言 skipped_error |
| `src/adapters/ExcelAdapter.ts` | 6+4+附 write 方法 + 9 inverse 方法（所有 Record 签名） | ✓ VERIFIED | 11 个 write 方法 + 9 个 inverse 方法（含 private readRangeValuesSnapshot）；全部 Record 签名；manage_worksheet operation enum 硬限 add/rename + 运行时 guard（第 552 行） |
| `src/adapters/PptAdapter.ts` | 8 write 方法 + 6 inverse 方法（所有 Record 签名），addShape #2775 count 校验，deleteSlideByIndex 双定位 | ✓ VERIFIED | setShapeTextFont/addShape/copySlide/setShapeTextAlignment/rotateShape/deleteShape/setSlideBackground/manageSlides 8 个 write 方法；restoreShapeFont/deleteShapeById/deleteSlideByIndex/restoreShapeAlignment/restoreShapeRotation/restoreSlideBackground 6 个 inverse 方法；#2775 countBefore/countAfter 校验第 1372 行；capturedId 双定位第 2065-2067 行 |
| `src/agent/tools/write/excel.ts` | EXCEL-01..10 十个 ToolDef（humanLabel function，reverse Record 字面量） | ✓ VERIFIED | format_excel_range / set_column_row_size / set_auto_filter / add_conditional_format / create_table / freeze_panes / sort_range / excel_find_and_replace / manage_worksheet / set_chart_title 全部存在；manage_worksheet enum: ['add', 'rename'] 第 521 行 |
| `src/agent/tools/write/ppt.ts` | PPT-01..08 八个 ToolDef（含 noop+gate + spike 降级逻辑） | ✓ VERIFIED | set_shape_text_font / add_shape / copy_slide / set_shape_text_alignment / rotate_shape / delete_shape / manage_slides / set_slide_background 全部存在；spike 三工具 beforeXxx === null → noop_inverse 判断第 433-435、514、600 行；manage_slides enum: ['delete'] 第 545 行 |
| `src/agent/tools/index.ts` | 18 个新工具全部注册（excelWriteTools + pptWriteTools 数组） | ✓ VERIFIED | excelWriteTools 第 215-218 行含 10 个 Excel 工具；pptWriteTools 第 230-233 行含 8 个 PPT 工具 |
| `src/agent/contract.test.ts` | 18 行 integrationTest: true（全部 Phase 10 工具） | ✓ VERIFIED | 第 41-59 行：format_excel_range 至 copy_slide 共 18 行全部 integrationTest: true |
| `.planning/phases/08-foundation-a-f/CONTRACT.md` | 18 行 status: done + integration_test: true | ✓ VERIFIED | Phase 10 Excel 第 30-39 行 + Phase 10 PPT 第 45-52 行全部 status: done / integration_test: true |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/agent/contract.test.ts` | `src/agent/operationLog.integration.test.ts` | D-17 fs.readFileSync 扫描 18 个 toolName | ✓ WIRED | 18 个 toolName 字面量全部存在于 integration.test.ts；D-17 硬卡满足 |
| `src/agent/operationLog.ts` | `src/adapters/ExcelAdapter.ts` | executeReverse → adapter.restoreRangeFormat(args) | ✓ WIRED | case 'restore_range_format' 存在；ExcelAdapter.restoreRangeFormat 实现存在并为 Record 签名 |
| `src/agent/operationLog.ts` | `src/adapters/ExcelAdapter.ts` | executeReverse → adapter.restoreRangeValuesSnapshot(args) | ✓ WIRED | case 'restore_range_values_snapshot' 存在；ExcelAdapter.restoreRangeValuesSnapshot 存在（D-20 双工具共享） |
| `src/agent/operationLog.ts` | `src/adapters/PptAdapter.ts` | executeReverse → adapter.deleteShapeById(args) | ✓ WIRED | case 'delete_shape_by_id' 存在；PptAdapter.deleteShapeById 存在并为 Record 签名 |
| `src/agent/operationLog.ts` | `src/adapters/PptAdapter.ts` | executeReverse → adapter.deleteSlideByIndex(args) | ✓ WIRED | case 'delete_slide_by_index' 存在；PptAdapter.deleteSlideByIndex 存在，双定位逻辑（capturedId 优先 + capturedIndex 后备）完整 |
| `src/agent/tools/write/excel.ts` | `src/adapters/ExcelAdapter.ts` | ctx.adapter as ExcelAdapter | ✓ WIRED | 10 个 ToolDef 均通过 `(ctx.adapter as ExcelAdapter).xxxMethod(...)` 调用 adapter |
| `src/agent/tools/write/ppt.ts` | `src/adapters/PptAdapter.ts` | ctx.adapter as PptAdapter | ✓ WIRED | 8 个 ToolDef 均通过 `(ctx.adapter as PptAdapter).xxxMethod(...)` 调用 adapter；spike 工具正确传递 beforeXxx === null 降级判断 |
| `delete_shape/manage_slides ToolDef` | `noop_inverse case` | reverse.tool = 'noop_inverse' | ✓ WIRED | 两个 noop+gate ToolDef 构建 `{ tool: 'noop_inverse', args: { reason: ... } }`；executeReverse switch noop_inverse case 抛错 → skipped_error |
| `sort_range + excel_find_and_replace` | `restore_range_values_snapshot` | D-20 各独立守门 + 共享 reverse | ✓ WIRED | 两工具各有独立 integration.test 用例（toolName 各出现 1 次）；共享 restoreRangeValuesSnapshot inverse |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| ExcelAdapter.restoreRangeFormat | args.address/numberFormat/fillColor 等 | reverse.args（write 时记录的 before-image） | 是（formatExcelRange sync 1 读取真实格式属性） | ✓ FLOWING |
| ExcelAdapter.restoreRangeValuesSnapshot | args.address/snapshot | reverse.args（sortRange/excelFindAndReplace 读快照） | 是（readRangeValuesSnapshot 读取 range.values） | ✓ FLOWING |
| PptAdapter.deleteShapeById | args.slide_index/shape_id | reverse.args（addShape 返回 newShapeId） | 是（addShape 实际 load shape.id 后返回） | ✓ FLOWING |
| PptAdapter.deleteSlideByIndex | args.capturedIndex/capturedId | reverse.args（copySlide 捕获指纹） | 是（copySlide 重新 load slides 后 load id+index） | ✓ FLOWING |
| spike 工具（setShapeTextAlignment 等） | beforeAlignment/beforeRotation/beforeColor | try/catch 读取 → null 降级 | happy-path 读真实属性（真机 UAT 确认路径） | ? UNCERTAIN（代码完整，真机路径待 UAT） |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — 所有工具依赖 Office.js host（Excel.run/PowerPoint.run），无法在 Node.js 环境中直接运行。Unit test 套件用 vitest + mockExcel/mockPpt stub 覆盖；真机行为由 human_verification 项处理。

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| EXCEL-01 | 10-02 | format_excel_range 数字格式/字体/填充色/对齐 | ✓ SATISFIED | ToolDef 存在；ExcelAdapter.formatExcelRange/restoreRangeFormat 实现；integration.test 守门绿 |
| EXCEL-02 | 10-02 | set_column_row_size 列宽/行高/自动适应 | ✓ SATISFIED | ToolDef 存在；ExcelAdapter.setColumnRowSize/restoreColumnRowSize 实现 |
| EXCEL-03 | 10-03 | sort_range 快照式 undo ≤10,000 单元格 | ✓ SATISFIED | ToolDef 存在；sortRange 超限 tooLarge=true → noop+gate；SNAPSHOT_LIMIT=10,000 |
| EXCEL-04 | 10-02 | set_auto_filter 自动筛选 | ✓ SATISFIED | ToolDef 存在；setAutoFilter/restoreAutoFilter 实现 |
| EXCEL-05 | 10-03 | excel_find_and_replace 快照式 undo（D-20 独立守门） | ✓ SATISFIED | ToolDef 存在；excelFindAndReplace/restoreRangeValuesSnapshot 实现；D-20 两条独立守门 |
| EXCEL-06 | 10-02 | add_conditional_format 条件格式 clearAll+重建 | ✓ SATISFIED | ToolDef 存在；addConditionalFormat/restoreConditionalFormat 实现 |
| EXCEL-07 | 10-02 | create_table 建表 resolvedName | ✓ SATISFIED | ToolDef 存在；createTable/deleteTableByName 实现；resolvedName 防序号错配 |
| EXCEL-08 | 10-02 | freeze_panes 冻结窗格 | ✓ SATISFIED | ToolDef 存在；freezePanes/restoreFreezePanes 实现 |
| EXCEL-09 | 10-03 | manage_worksheet add/rename（D-03 枚举硬限） | ✓ SATISFIED | ToolDef schema enum: ['add','rename']；运行时 guard 第 552 行；manageWorksheet/restoreWorksheetSnapshot 实现 |
| EXCEL-10 | 10-03 | set_chart_title 图表标题 三 sync 定位 | ✓ SATISFIED | ToolDef 存在；setChartTitle/restoreChartTitle 实现 |
| PPT-01 | 10-04 | set_shape_text_font 字体格式 TEXT_SHAPE_TYPES 守门 | ✓ SATISFIED | ToolDef 存在；setShapeTextFont/restoreShapeFont 实现；TEXT_SHAPE_TYPES 守门 |
| PPT-02 | 10-05 | set_shape_text_alignment spike S4 降级门控 | ✓ SATISFIED（代码层级）| ToolDef + adapter 实现；try/catch null 降级；真机路径需 UAT |
| PPT-03 | 10-04 | add_shape #2775 count 校验 + deleteShapeById 逆向 | ✓ SATISFIED | ToolDef 存在；addShape countBefore/countAfter 校验；deleteShapeById 实现 |
| PPT-04 | 10-05 | delete_shape noop+gate（不可自动撤销） | ✓ SATISFIED | ToolDef noop_inverse reverse；integration.test 守门断言 skipped_error |
| PPT-05 | 10-05 | rotate_shape spike S1 降级门控 | ✓ SATISFIED（代码层级）| ToolDef + adapter 实现；try/catch null 降级；真机路径需 UAT |
| PPT-06 | 10-05 | manage_slides delete 仅 noop+gate（D-14 enum 硬限） | ✓ SATISFIED | ToolDef schema enum: ['delete']；运行时 guard；integration.test 守门断言 skipped_error |
| PPT-07 | 10-04 | copy_slide index+ID 双定位逆向（D-16） | ✓ SATISFIED | ToolDef 存在；copySlide 捕获 capturedId+capturedIndex；deleteSlideByIndex 双定位实现 |
| PPT-08 | 10-05 | set_slide_background spike S2 + isSetSupported 门控 | ✓ SATISFIED（代码层级）| ToolDef + adapter 实现；isSetSupported PowerPointApi 1.10 门控；try/catch null 降级；真机路径需 UAT |

---

### Anti-Patterns Found

全文扫描 ExcelAdapter.ts / PptAdapter.ts / excel.ts / ppt.ts / operationLog.ts（Phase 10 关键文件）：

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| PptAdapter.ts L1938-1942 | `const beforeColor = slide.background.fill.foregroundColor as string \| null` — null 是 Office.js 正常返回值（主题色），不是 stub | INFO | 设计正确：null 触发降级 noop_inverse |
| ExcelAdapter.ts | `beforeFormats: []` — 在 addConditionalFormat 中，`beforeFormats` 初始为空数组但随即被填充 | INFO | 非 stub：sync 1 后遍历 cfItems 填充 beforeFormats |
| 无阻断性 stub 或 placeholder 发现 | — | — | — |

---

### Human Verification Required

以下行为需要在真实 Office for Web 环境中验证（代码层级已实现完整的降级逻辑，但最终执行路径取决于 Office host）：

#### 1. Spike S7 — addTextBox 绕过 #2775 bug（SC#3）

**Test:** 在 Office for Web PPT 中，先选中一个已有形状，然后让 agent 调用 `add_shape` 插入文本框（shapeType: 'TextBox'）。
**Expected:** 原选中形状保持存在（count 校验通过），新文本框正常插入；undo 后文本框消失（delete_shape_by_id 逆向生效）。
**Why human:** addTextBox 是否真正不触发 #2775（静默删除选中形状）只能在真实 PowerPoint host 确认；代码已实现 countBefore/countAfter 校验并在 count 减少时明确 throw HostApiError。

#### 2. Spike S1 — rotate_shape 旋转角度读写（SC#5）

**Test:** 在 Office for Web PPT 中让 agent 调用 `rotate_shape`（slideIndex 和 shapeId 指向已有形状，rotation=45）。
**Expected（happy-path）:** DiffLogPanel 显示操作成功；undo 后形状旋转角度还原为原值（rolled_back 路径）。
**Expected（降级）:** 若 shape.rotation 不可读/写，DiffLogPanel 显示「此步无法自动撤销」（noop+gate 路径）。
**Why human:** shape.rotation 的可读写性取决于 PowerPointApi 版本和 Office for Web 支持情况；代码已实现 try/catch 降级。

#### 3. Spike S2 — set_slide_background 背景读取（SC#5）

**Test:** 在 Office for Web PPT 中让 agent 调用 `set_slide_background`（slideIndex=1, color='#1A73E8'）。
**Expected（happy-path）:** 幻灯片背景变蓝；undo 后背景还原（restoreSlideBackground 生效）。
**Expected（降级）:** 若 PowerPointApi 1.10 不支持或 background.fill 读取失败，DiffLogPanel 显示 noop+gate warn。
**Why human:** isSetSupported('PowerPointApi', '1.10') 的真实结果 + background.fill.foregroundColor 读取能力需真机确认。

#### 4. Spike S4 — set_shape_text_alignment 段落对齐读写（SC#5）

**Test:** 在 Office for Web PPT 中让 agent 调用 `set_shape_text_alignment`（形状中有文本，alignment='Center'）。
**Expected（happy-path）:** 文字居中对齐；undo 后对齐方式还原（restoreShapeAlignment 生效）。
**Expected（降级）:** 若 textRange.paragraphFormat.alignment 不可读，DiffLogPanel 显示 noop+gate warn。
**Why human:** paragraphFormat.alignment 的读写能力取决于 Office for Web PowerPoint 的 API 实现。

---

### Gaps Summary

无代码层级的阻断性 gap。所有 18 工具的 adapter 实现、ToolDef、index.ts 注册、D-17 四步守门（contract.test.ts/integration.test.ts/CONTRACT.md/noop+gate 验证）全部完整。

唯一待确认项为 4 个真机 spike UAT（S1/S2/S4/S7），这些在代码层级已实现完整的降级安全网（try/catch + null 信号 + noop_inverse），不会因未确认而导致 agent 崩溃，仅影响是否能提供 undo 能力（降级为 noop+gate）。

---

_Verified: 2026-05-31T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
