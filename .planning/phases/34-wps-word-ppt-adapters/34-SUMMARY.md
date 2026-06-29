# Phase 34 SUMMARY — WPS 文字 + 演示 adapter（三宿主滩头堡）

**状态：code-drafted · 真机验证 pending**（NOT Complete）
**日期：** 2026-06-29（投机性预写第二批；用户二次授权，认可推倒重来成本）

## 交付（代码草稿）

| 文件 | 内容 |
|------|------|
| `src/adapters/wps/types/wps-jsapi.d.ts` | 扩展：Word（Document/Paragraphs/Paragraph/WpsWordRange/WpsWordSelection）+ PPT（Presentation/Slides/Slide/Shapes/Shape/TextFrame/WpsPptWindow）桌面 VBA 对象模型子集，全程 [真机待验] |
| `src/adapters/wps/WpsWordAdapter.ts` | 完整实现（替换 stub）：read 5 + write 5 + inverse（deleteParagraphByContent / restoreParagraphAt / readWordParagraph） |
| `src/adapters/wps/WpsPptAdapter.ts` | 完整实现（替换 stub）：read 6 + write 5 + inverse（restoreShapeText / deleteShapeById / restoreShapeGeometry / deleteSlideByTitle）；刻意不实现 readPptSlideTitle |
| `src/adapters/wps/WpsAdapterStub.ts` | **删除**（三宿主 adapter 现均直接实现 DocumentAdapter，stub 成死代码） |
| `src/agent/tools/index.ts` | 加 `WPS_WORD_CORE_TOOLS`(10) + `WPS_PPT_CORE_TOOLS`(11)；buildToolsForHost 三宿主各只暴露已实现工具 |
| `src/agent/tools/wps-tools-trim.test.ts` | word/ppt 从「返 []」改为「各自核心集」守门 |
| `src/adapters/wps/WpsWordAdapter.operationLog.integration.test.ts` | 新增 5 test：append/replace round-trip、D-11 手改跳过、undo-all、read 形状 |
| `src/adapters/wps/WpsPptAdapter.operationLog.integration.test.ts` | 新增 6 test：setShapeText/move/add/insertSlide round-trip、undo-all、read 形状 |

## 接缝复用坐实（与 Phase 32 同构）

- `loop.ts:54` 按 `capabilities().host` 建工具：WpsWordAdapter host='word' / WpsPptAdapter host='ppt'
  → 复用全套 Office.js Word/PPT 工具 + operationLog + undo，**只写 adapter 方法**。
- inverse 全收 `(args: Record)`（[[adapter-inverse-signature]]）；reverse 派发经 operationLog.executeReverse
  现有 case（delete_paragraph_by_content / restore_paragraph_at / restore_shape_text /
  restore_shape_geometry / delete_shape_by_id / delete_slide_by_title）命中，**无需改 operationLog**。

## 关键设计决策

- **同步 VBA 风格**：方法体同步调 `window.Application.ActiveDocument/ActivePresentation.*`，async 仅满足接口签名。
  桌面 wpsjs 加载项 ≠ WebOffice 云端（后者 `instance.Application` + `await instance.ready()` 异步、对象参数）。
- **PPT 刻意不实现 readPptSlideTitle**：对齐 Office.js PptAdapter（同样未实现）。operationLog 的
  `isTargetStateConsistent` 对 `ppt_slide` 把对象 postState.content 串成 `[object Object]`，若实现
  readPptSlideTitle 反会令 insert_slide undo 误判 skipped_manual → 破坏撤销。两宿主一致关闭 slide 级手改侦测。
- **诚实收口**：三宿主各只暴露 adapter 已实现工具，AI 不会调到未实现的高级工具。

## 代码侧验证（全过）

- tsc 0 / build 成功（新增 `WpsWordAdapter` gz 1.86KB + `WpsPptAdapter` gz 2.65KB 懒 chunk）
- size gate：主入口 `main-*.js` 仍 1.96KB（gz 0.999KB），**Office 入口零膨胀**；WPS 入口无 office.js 泄漏
- 全量 **1155 passed** / 0 failed / 3 retry errors=噪音

## 真机批量测脚本

复用 `public/wps/README.md` §真机验证脚本框架，但首宿主从 Excel 扩到三宿主：
文字（读全文→改段落→撤销）、演示（列页→改形状文字/加形状→撤销）各跑一遍多步 agent loop + undo all。

## 为何不可标 Complete

Phase 30 两条 make-or-break 仍未真机验（CEF/React19、SSE 直连不被 WPS CSP/CORS 拦）；no-go 则含本 phase 全废。
全部 adapter 方法基于 WPS 桌面 VBA JSAPI **盲写推断**，未在 Windows WPS 真机跑过一次，大概率要修
（段落 \r 标记、Range.Text 替换语义、Shape.Id 稳定性/同页唯一、MsoShapeType/AutoShapeType 枚举值、
Slides.Add/AddTextbox 位置参签名、HasTextFrame 语义、ActiveWindow 选区读取 —— 全 [真机待验]）。
