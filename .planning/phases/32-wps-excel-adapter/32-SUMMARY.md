# Phase 32 SUMMARY — WPS Excel adapter（滩头堡）read/write + operationLog 移植

**状态：code-drafted · 真机验证 pending**（NOT Complete）
**日期：** 2026-06-29（投机性预写）
**滩头堡宿主：Excel（金山表格）** — 用户拍板（盲写最稳）

## 交付（代码草稿）

| 文件 | 内容 |
|------|------|
| `src/adapters/wps/types/wps-jsapi.d.ts` | 扩 Excel OM 子集（Workbook/Worksheets/Worksheet/Range/UsedRange/Cells，同步 VBA 签名） |
| `src/adapters/wps/WpsExcelAdapter.ts` | stub → 核心实现：getSelection / read(4 kind) / insert(text·formula·range-values) / setRangeValues / setCell / applyFormula / overwriteRange(inverse Record 签名) + resolveWpsRange + normalize2D helper |
| `src/adapters/wps/WpsExcelAdapter.operationLog.integration.test.ts` | 真 WpsExcelAdapter × replay engine：往返还原 + $ 绝对地址消费 + 单格标量规范化 + undo-all 逆序（3 test 全过） |

## 接缝复用（零改动证实）

`loop.ts:54` 按 `capabilities().host='excel'` → `buildToolsForHost('excel')` 复用**全套 Office.js Excel 工具**；
工具调 `ctx.adapter.setRangeValues/setCell/applyFormula/overwriteRange/read/getSelection` → WpsExcelAdapter 同名同签实现 →
**dispatch / operationLog / undo / DiffLog 全部零改动**。inverse 走 `overwrite_range` ReverseDescriptor，回放调 `adapter.overwriteRange(Record)`。

## 代码侧验证（全过）

- `tsc --noEmit`：0
- `vite build`：成功。WpsExcelAdapter 独立懒 chunk（gzip 1.63KB）；**主入口 main-*.js 仍 1.96KB（Office 入口零膨胀）**
- WPS 集成测试：3/3 过（含 [[adapter-inverse-signature]] Record 守门 + $ 地址 gotcha 坐实）
- 全量：**1140 passed**（原 1137 + 新 3）/ 0 failed / 3 retry errors=已知噪音
- chat.ts dynamic-import warning：既有（main.tsx 已在列表），非回归

## VBA gotcha 处理（盲写防御）

1. **Value2 单格标量 / 多格 2D** → `normalize2D()` 统一成 2D（读 before-image / read values）
2. **Address 返 `$A$1:$B$2` 绝对格式** → resolveWpsRange 解析 `$` + 测试用 `$` 地址往返坐实 overwriteRange 能吃
3. **同步抛错语义未知** → try/catch 包 HostApiError

## 为何不可标 Complete

Roadmap Phase 32 的 4 条成功标准全是「WPS 真机……read 取值一致 / write 后回读不静默 no-op / inverse 回滚复原 / 批量 undo 复原」。
mock 测试只证**代码逻辑 + 接缝契约**对，**不证 WPS JSAPI 真机行为**（Value2/Address/错误语义是推断）。

## 范围边界（诚实）

- 只实现**核心 ~9 方法**（Roadmap 限定，非全 ~15 Excel 工具）。
- 未实现的高级 Excel 方法（formatExcelRange/sortRange/setAutoFilter/…）：WpsExcelAdapter 无此方法 →
  AI 调对应工具时 dispatchTool catch 兜底为 ok:false（generic「宿主操作失败」）。
  **Phase 33 做 WPS 工具集裁剪**，让 AI 不见未实现工具（诚实收口）。

## `[真机待验]` 清单

- Value2 单格/多格返回形态、空表 UsedRange 行为、Address 是属性还是 `.Address()` 方法
- WPS 选区事件 API（onSelectionChanged 当前 no-op，supportsSelectionEvents=false）
- 同步 API 错误语义（抛异常？返 undefined？）→ Phase 33 killer scenario 真机加写后回读校验

## 下一步

Phase 33：killer scenario 端到端（WPS Excel agent loop 多步 + undo all）+ 非核心工具诚实裁剪 + 非目标宿主 throw stub + wpsjs publish 安装流程固化 + WPS 入口 bundle 独立核算。
