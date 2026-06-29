# Phase 33 SUMMARY — killer scenario 收口 + 诚实裁剪 + 安装流程固化

**状态：code-drafted · 真机验证 pending**（NOT Complete）
**日期：** 2026-06-29（投机性预写）

## 交付（代码草稿）

| 文件 | 内容 |
|------|------|
| `src/agent/tools/index.ts` | `isWpsRuntime()` + `WPS_EXCEL_CORE_TOOLS` 白名单 + buildToolsForHost WPS 裁剪包装（excel→核心 7 工具；word/ppt→[]） |
| `src/agent/tools/wps-tools-trim.test.ts` | 裁剪守门 3 test：非 WPS 完整集 / WPS excel 仅核心 / WPS word·ppt 空 |
| `public/wps/publish.html` | Aster 三宿主 publish 模式安装器（复刻 wpsjs 模板，curList=wps/et/wpp，url=/Aster/wps/） |
| `public/wps/README.md` | 安装两路径（oem.ini / publish.html）+ **7 步真机验证脚本**（含 Phase 30 两条 make-or-break 嵌入）+ 诚实边界 |

## 诚实收口（Roadmap Phase 33 SC-2 核心）

- **WPS Excel**：只暴露已实现的核心 7 工具，AI 不会去调未实现的高级工具（避免「宿主操作失败」）。
- **WPS Word/PPT**：buildToolsForHost 返 `[]` + WpsWordAdapter/WpsPptAdapter stub 抛「WPS-D1 预留」→ 不裸奔、不假装能用。
- 既有行为零回退：非 WPS（Office for Web / 测试）仍返完整工具集（守门测试 + 既有 tools-host/index 测试全绿）。

## WPS 入口 bundle 独立核算（Roadmap Phase 33 SC-3）

- WPS 专属代码：入口 `wps-*.js` gz 1.17KB + `WpsExcelAdapter` 懒 chunk gz 1.63KB + 三 stub（各 ~0.17KB）≈ **gz ~3KB**。
- 其余（agent loop / store / UI / markdown / providers）与 Office 入口**共享 chunk**，不重复计。
- **主入口 `main-*.js` 仍 1.96KB（gz 1.00KB）—— Office 入口零膨胀**（WPS 代码不漏进）。
- 独立于 Office 的 ≤100KB size gate，WPS 入口远低于预算。

## 安装流程固化（Roadmap Phase 33 SC-4）

两条路径都文档化 + 提供安装文件：
- 路径 A：oem.ini `JsApiPlugin=true` + `JSPluginsServer=…/wps/jsplugins.xml`（专业版）
- 路径 B：`publish.html` 一键装（个人版 12.1.0.16910+，`JsApiPlugin=false`）

## 代码侧验证（全过）

- tsc 0 / build 成功（dist/wps/ 六文件齐：README/index.html/jsplugins.xml/publish.html/ribbon-wps.js/ribbon.xml）
- 全量 **1143 passed**（1140 + 新 3 裁剪 test）/ 0 failed / 3 retry errors=噪音

## 为何不可标 Complete

Roadmap Phase 33 SC-1 是「WPS 真机完成多步 agent loop + undo all UAT PASS」——**纯真机**，本 phase 无法跑。
SC-2/3/4（诚实收口 / bundle 核算 / 安装流程）代码侧已就位，但「真机点安装后生效 + killer scenario 端到端」仍 pending。

## killer scenario（真机批量测脚本，见 public/wps/README.md §真机验证脚本）

7 步：面板加载 → SSE 直连（生死线）→ Key 持久 → 读 → 写+回读 → 撤销 → 诚实收口。
覆盖 Phase 30（make-or-break）+ 31（外壳）+ 32（adapter）+ 33（收口）全部真机成功标准。
