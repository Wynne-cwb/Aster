# Phase 35 SUMMARY — WPS 三宿主全工具拉齐（WPS-D1 代码侧完成）

**状态：code-drafted · 真机验证 pending**（NOT Complete）
**日期：** 2026-06-29（投机性预写第三批；用户第三次授权「大胆点放心干，直接代码维度拉齐」，认可推倒重来成本）

## 交付（代码草稿）

三个 WPS adapter 从 Phase 34 的核心最小集，补齐到对齐 Office.js 全工具集。接缝上方零改动——
复用全套 Office.js 工具（loop.ts:54 按 `capabilities().host` 建工具），只补 adapter 方法 + 类型 +
诚实裁剪 + 集成测试。

| 文件 | 内容 |
|------|------|
| `src/adapters/wps/WpsWordAdapter.ts`（365→1293 行） | +9 write（字符格式/段落格式/样式/查找替换/插表/列表/批注/页眉页脚/编辑单元格）+ 9 inverse（restoreRangeFont/ParagraphFormat/ParagraphStyle/RangeSnapshot/deleteTableByMarker/deleteCommentById/restoreWordHeaderFooter/restoreTableCell；list 走 noop_inverse） |
| `src/adapters/wps/WpsPptAdapter.ts`（521→1446 行） | +10 write（形状属性/字体/对齐/旋转/背景/复制页/删页/版式建页/原生表/线条；渐变降级走 setShapeProperty）+ inverse（restoreShapeProperty/Font/Alignment/Rotation/SlideBackground/deleteSlideByIndex）；颜色 BGR↔#RRGGBB 双向 helper；**保留刻意不实现 readPptSlideTitle** |
| `src/adapters/wps/WpsExcelAdapter.ts`（328→1580 行） | +13 write（格式/行列尺寸/筛选/条件格式/建表/排序/查找替换/合并/去重/工作表管理/图表标题/插图表/透视表）+ 6 inverse（restoreRangeFormat/ColumnRowSize/AutoFilter/ConditionalFormat/MergeState/WorksheetSnapshot + deleteTableByName/ChartByName/PivotTableByName + 共享 restoreRangeValuesSnapshot）；颜色 BGR helper；snapshot/tooLarge→noop_inverse；HR-01 去重列展开门 |
| `src/agent/tools/index.ts` | 三宿主核心集扩到含全部新实现工具；仍排除 batch_write / 生图·图库 / get_shape_image / visual_check_slide / freeze_panes |
| `src/agent/tools/wps-tools-trim.test.ts` | 高级工具从「不暴露」改「暴露」；加「构建工具数 === 核心集大小」不变式（抓核心集拼错工具名） |
| 三份 operationLog 集成测试 | +39 test（Word +10 / PPT +13 / Excel +16）：每个新工具 round-trip undo + undo-all 逆序 + tooLarge→noop_inverse→skipped_error |

类型扩展走各 adapter 文件顶部 `declare global` 块（TS 声明合并），**未碰共享 `wps-jsapi.d.ts`**——
三宿主并行实现零文件冲突。

## 关键设计决策

- **同步 VBA 风格**（沿用）：方法体同步调 `globalThis.Application.*`，async 仅满足接口签名。桌面 wpsjs ≠ WebOffice 云端异步。
- **颜色 BGR 转换**：VBA `ColorFormat.RGB`/`Interior.Color`/`Font.Color` 是 BGR 长整数，非 `#RRGGBB`。
  三 adapter 各写 `hexToBgr`/`bgrToHex` helper，读写双向转换（[真机待验] 字节序）。
- **诚实裁剪保持**：仍未实现的工具（生图/图库/视觉/批量/freeze_panes）不进白名单，AI 不会调到未实现工具。
- **inverse 全收 Record**（[[adapter-inverse-signature]]）；reverse 派发经 operationLog.executeReverse 现有 case 命中，**operationLog 零改动**。
- **PPT 续不实现 readPptSlideTitle**：对齐 Office.js PptAdapter，避免 insert_slide undo 误判 skipped_manual。

## 代码侧验证（全过）

- tsc 0 / build 成功（三 adapter 懒 chunk gz：Excel 5.08KB / Word 5.28KB / PPT 5.99KB；主 Office 入口 main-*.js 仍 1.96KB **零膨胀**）
- size gate：主入口 1KB gz ≪ 100KB
- eslint 0 error（2 warning 在共享 d.ts，pre-existing unused-disable，与本次无关）
- 全量 **1194 passed** / 0 failed / 3 retry errors=噪音（较 Phase 34 的 1155 多 39）

## [真机待验] 重点（盲写推断，真机大概率要修）

- **颜色 BGR 字节序**（三宿主全部颜色相关工具）；**Shape.Id** 同页唯一/稳定性（PPT）。
- **高级 OM 签名**：PPT `Shapes.AddTable(rows,cols,l,t,w,h)` / `AddLine(x1,y1,x2,y2)` / `AddConnector` / `Slide.Duplicate`；
  Excel `FormatConditions.Add` / `ListObjects.Add` / `Range.Sort` 位置参 / `Range.Replace`（无替换计数，best-effort 估）/
  `RemoveDuplicates`（无 removed 返回，靠 snapshot vs Rows.Count 推）/ `ChartObjects.Add` / `PivotCaches.Create`（**最高风险**，WPS 可能无此 OM）。
- **Word**：段落 \r、Find.Execute 参数序 + 替换计数近似、Comments.Index 不稳定（删除会移位，真机或需稳定 ID）、
  Style 区域设置（英文 builtin 名在中文 WPS 上可能 ItemNotFound）、Headers/Footers 写后回读 fail-honest 已加。
- **honest-unsupported 兜底**：PPT get_shape_image（无可靠 base64 导出）已诚实降级；Excel pivot/chart 若 OM 缺失抛 HostApiError，工具层降 ok:false。

## 真机批量测脚本

复用 `public/wps/README.md` §真机验证脚本框架，三宿主各覆盖高级工具一轮多步 agent loop + undo all：
文字（格式/样式/插表/批注 + 撤销）、演示（形状属性/字体/旋转/背景/版式/插表/线条 + 撤销）、
表格（格式/排序/筛选/条件格式/建表/合并/去重/透视表/图表 + 撤销）。

## 为何不可标 Complete

Phase 30 两条 make-or-break 仍未真机验；no-go 则含本 phase 全废。全部新方法 WPS 桌面 VBA JSAPI 盲写推断，
未在 Windows WPS 真机跑过一次，高级 OM（透视表/图表/条件格式/连接线/原生表）大概率要修。
